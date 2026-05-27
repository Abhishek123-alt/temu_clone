---
name: payment-integration
description: Integrate payment gateways into the order flow of this project — Stripe (default), Razorpay/PayPal as alternates, webhooks, idempotency, refunds, 3DS/SCA. Trigger whenever the user mentions Stripe, Razorpay, PayPal, payment intent, charge, webhook, signature, 3D Secure, SCA, PCI, refund, chargeback, payment method, Apple Pay, or "take money / give it back".
---

# Payment Integration

Money moves through this app via a payment gateway (default: Stripe PaymentIntents). The app never sees raw card data — only PaymentIntent IDs and statuses. All state transitions (paid, refunded) are driven by **signed webhooks** + the order state machine in `order-management`.

## When this skill applies

- Wiring a new gateway or adding a new payment method.
- Webhook handler changes (signature verification, idempotency).
- Refund flows (full, partial, return-driven).
- 3DS / SCA challenge handling.
- Anything in `app/modules/order/services.py` that interacts with a gateway SDK.

For the order state machine and outbox, see `order-management`. For UI-side Stripe Elements / Apple Pay button, see `cart-checkout-ui`. For error envelope, see `error-handling`.

## High-level flow (Stripe-style)

```
[client]              [our API]                       [Stripe]
  │                       │                              │
  │ POST /orders ──────▶  │ create order PENDING         │
  │                       │ create PaymentIntent ─────▶  │
  │   ◀──── client_secret │   ◀── PaymentIntent          │
  │ confirmCardPayment ───┼─────────────────────────▶    │
  │ (Elements does 3DS)   │                              │
  │   ◀── success                                        │
  │                       │   ◀── webhook payment_intent.succeeded
  │                       │ transition(order, PAID)
  │                       │ emit outbox: order.paid
```

The order is created **before** payment to reserve stock and get a stable `order_id`. The webhook is the source of truth — never trust client-side "succeeded" to move money in our DB.

## Configuration & secrets

```
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

- Keys in `.env`, read via `pydantic-settings` in `app/core/config.py`.
- Never commit live keys. Use test keys (`sk_test_…`) in dev. Rotate immediately on leak.
- The publishable key ships to the React client; the secret + webhook secret stay server-side.

## PaymentIntent on order creation

```python
def create_payment_intent(order: Order) -> stripe.PaymentIntent:
    return stripe.PaymentIntent.create(
        amount=order.total_cents,
        currency=order.currency,           # "usd", "inr"
        idempotency_key=f"order:{order.id}",      # ← critical
        metadata={
            "order_id": str(order.id),
            "user_id": str(order.user_id),
        },
        automatic_payment_methods={"enabled": True},
    )
```

- `idempotency_key` is the order id — Stripe will return the same PaymentIntent on retry instead of creating a duplicate.
- Save `payment_intent_id` on the order; everything later joins on it.

## Webhook handler (must verify the signature)

```python
@router.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "BAD_SIGNATURE")

    # idempotency on event.id — Stripe retries the same event
    if db.query(WebhookEvent).filter_by(provider="stripe", event_id=event.id).first():
        return {"status": "duplicate"}
    db.add(WebhookEvent(provider="stripe", event_id=event.id, type=event.type))

    handlers = {
        "payment_intent.succeeded":  handle_pi_succeeded,
        "payment_intent.payment_failed": handle_pi_failed,
        "charge.refunded":           handle_charge_refunded,
        "charge.dispute.created":    handle_chargeback,
    }
    if h := handlers.get(event.type):
        h(db, event.data.object)
    db.commit()
    return {"received": True}
```

- **Return 200 fast.** Stripe retries non-200 for up to 3 days; a slow handler will queue events. Do heavy work via the Outbox.
- The webhook route is unauthenticated by design (the signature IS the auth). Make sure it isn't behind `get_current_user`.
- Log the raw event payload (sans PII) for replay/debug.

## Refunds

```python
def refund_order(order: Order, amount_cents: int | None = None, reason: str = ""):
    refund = stripe.Refund.create(
        payment_intent=order.payment_intent_id,
        amount=amount_cents,                    # None = full refund
        idempotency_key=f"refund:{order.id}:{amount_cents or 'full'}",
        metadata={"order_id": str(order.id), "reason": reason},
    )
    db.add(RefundRecord(order_id=order.id, stripe_id=refund.id,
                        amount_cents=amount_cents or order.total_cents,
                        status=refund.status, reason=reason))
    # do NOT transition the order here — the charge.refunded webhook does it
```

The webhook (`charge.refunded`) is what flips the order to `REFUNDED`. This keeps DB state aligned with what Stripe actually did.

## 3D Secure / SCA

- Use `automatic_payment_methods` on the PaymentIntent — Stripe figures out when 3DS is required.
- On the client, `stripe.confirmCardPayment(client_secret)` handles the challenge UI; no extra work needed.
- If `payment_intent.requires_action` arrives via webhook, the order stays PENDING — don't decrement stock or transition. Wait for `payment_intent.succeeded`.

## Multiple gateways (PayPal, Razorpay, COD)

Keep the order/payment table provider-agnostic:

```python
class Order(Base):
    payment_provider: str        # "stripe", "razorpay", "paypal", "cod"
    payment_intent_id: str | None
    payment_status: PaymentStatus
```

A `services/payments/` subpackage with one module per provider exposes a uniform interface (`create_intent`, `refund`, `verify_webhook`). The router dispatches based on `order.payment_provider`. Don't conditionally `if provider == "stripe"` deep inside services.

## COD / pay-on-delivery

Some markets need cash-on-delivery. The flow:

1. `payment_provider = "cod"`, `payment_status = PENDING_COD`.
2. Order skips the PaymentIntent step but still reserves stock.
3. Seller marks "Paid on delivery" — `transition(order, PAID)` via an admin/seller endpoint, written to OrderEvent with `actor=SELLER`.

## Chargebacks & disputes

`charge.dispute.created` arrives via webhook → create a row in `admin/disputes`, page the team. Don't auto-refund; ops decides. See `admin-seller-portal` for the dispute queue UI.

## PCI scope (keep it narrow)

- Card data NEVER touches our servers. Use Stripe Elements/Checkout on the client.
- Webhook payload may include masked PAN (`...4242`) — fine to store, don't log.
- We are PCI-DSS SAQ-A (simplest tier) only as long as we don't proxy card fields. Don't break this by accepting a raw card number anywhere.

## Common mistakes to flag

- Trusting `confirmCardPayment` success on the client to transition the order in our DB. Webhook is truth.
- Skipping `stripe.Webhook.construct_event` and reading the raw body — anyone can fake a webhook then.
- Not deduplicating by `event.id` — Stripe replays; you'll double-credit.
- Calling Stripe inside a long DB transaction — held locks during a 1s round-trip.
- Forgetting `idempotency_key` on `PaymentIntent.create` / `Refund.create`.
- Logging the full webhook payload including card fingerprints/PII.
- Hardcoding `currency = "usd"` — orders carry their currency; respect it.

## Checklist

- Webhook handler verifies the signature and dedupes on `event.id`.
- Webhook returns 200 quickly; side-effects flow through Outbox.
- Order state changes ONLY through the webhook → `transition()` path.
- All Stripe create-calls pass `idempotency_key`.
- Refunds are kicked off from a server endpoint, finalized by `charge.refunded`.
- Test mode is the default in dev; live keys are loaded only in prod.
- No card data, CVV, or full PAN logged or stored.
