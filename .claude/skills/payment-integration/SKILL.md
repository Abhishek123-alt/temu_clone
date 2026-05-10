---
name: payment-integration
description: Integrate payment gateways (Stripe primary, PayPal/Apple Pay/Google Pay secondary) end-to-end — PaymentIntents, webhooks, refunds, 3DS, idempotency, and reconciling a charge with an order. Trigger whenever the user mentions Stripe, PayPal, Apple Pay, Google Pay, payment, charge, refund, webhook, PaymentIntent, capture, 3D Secure, chargeback, or "process the order".
---

# Payment Integration

Money flows are unforgiving — every edge case (network drops, double-clicks, webhook retries) becomes a customer-service ticket if you get it wrong. Default to **Stripe PaymentIntents** with idempotency, webhook-driven state, and a clean Order ↔ Payment separation.

## When this skill applies

- Wiring `/orders` → Stripe charge → confirmation.
- Building the webhook handler.
- Refunds, partial refunds, payment retries.
- Adding PayPal, Apple Pay, Google Pay alongside Stripe.

The React side of the form is in `cart-checkout-ui`. This skill is the FastAPI side.

## Architectural rule: Stripe is the source of truth for money

Your `payments` table is a **mirror** of Stripe state, not the authority. The webhook is what flips a payment from `pending` → `succeeded`. Never advance state from a synchronous API response alone — webhook can race ahead of, or behind, your HTTP response.

```
orders               payments
─────                ─────────
id (uuid)            id (uuid)
user_id              order_id (FK)
status               provider          ("stripe", "paypal")
total_cents          provider_intent_id ("pi_...")
created_at           amount_cents
                     currency
                     status            ("requires_action" | "succeeded" | "failed" | "refunded")
                     last_event_at
                     raw (jsonb)        last webhook payload
```

## Order placement flow (Stripe Elements)

```
1. Frontend: Stripe Elements collects card → returns paymentMethod.id
2. Frontend → POST /orders { cartId, addressId, paymentMethodId }
   header: Idempotency-Key: <uuid>
3. Backend:
   a. Validate cart, lock inventory rows (FOR UPDATE)
   b. Compute totals authoritatively
   c. Insert order (status="pending")
   d. Create Stripe PaymentIntent:
        amount, currency, payment_method=paymentMethodId,
        confirm=True, off_session=False,
        metadata={"order_id": order.id},
        idempotency_key=<request idem key>
   e. If intent.status == "requires_action" → return { orderId, clientSecret }
      If intent.status == "succeeded" → mark order paid (defensive), return { orderId }
   f. Return order id
4. Frontend handles 3DS if requested, polls /orders/:id until status=="paid"
5. Webhook payment_intent.succeeded arrives → mark order paid, decrement inventory permanently, emit OrderPaid event (email, ship, etc.)
```

The webhook is idempotent — receiving "succeeded" twice must not double-fulfill.

## Webhook handler

```python
@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: DbSession):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Bad signature")

    # Idempotency: store event.id, skip if already processed
    if await event_already_processed(db, event["id"]):
        return {"ok": True}

    handler = WEBHOOK_HANDLERS.get(event["type"])
    if handler:
        await handler(db, event["data"]["object"])
    await mark_event_processed(db, event["id"])
    return {"ok": True}
```

Handle at least:

- `payment_intent.succeeded` → finalize order
- `payment_intent.payment_failed` → mark order failed, restore inventory
- `charge.refunded` / `charge.refund.updated` → record refund
- `charge.dispute.created` → flag for manual review

## Idempotency keys

- Pass an `Idempotency-Key` to Stripe on PaymentIntent creation — Stripe's own idempotency layer protects against double-charges if your code retries.
- Your own `/orders` endpoint accepts `Idempotency-Key` from the frontend and stores `(key → response)` for 24h in Redis so a click-twice or a network retry returns the same order, not two.

## Refunds

```python
async def refund_order(db, order_id, amount_cents=None, reason=None):
    payment = await get_active_payment(db, order_id)
    refund = stripe.Refund.create(
        payment_intent=payment.provider_intent_id,
        amount=amount_cents,                 # None = full refund
        reason=reason or "requested_by_customer",
        idempotency_key=f"refund:{order_id}:{amount_cents or 'full'}",
    )
    # Don't mark refunded here — wait for charge.refunded webhook.
    return {"refund_id": refund.id, "status": refund.status}
```

## Currency & money math

- Always store integer cents (no floats).
- Currency code at payment level, not user level — a user can pay in different currencies on different orders.
- Use a library (`py-moneyed`) or just integers + ISO 4217 code. Never `Decimal` rounding without a clear policy.

## 3D Secure

Stripe handles 3DS automatically when `confirm=True`. Your job is to detect `requires_action` and pass the `clientSecret` back so the React side can call `stripe.confirmCardPayment(clientSecret)`. Don't try to implement 3DS manually.

## PayPal (secondary)

Use the PayPal Orders v2 API. Same pattern: create order on PayPal, frontend approves, your backend captures, mirror state via webhooks.

## Apple Pay / Google Pay

Both work as `paymentMethod` types through Stripe — no separate integration needed if you've already wired Stripe. Just enable them in Stripe Dashboard and use the Payment Request Button on the React side.

## Security must-haves

- Webhook signature verification with the **endpoint signing secret**, not the API key.
- Never log full card data, full PAN, or CVV — Stripe Elements means you never see them anyway, but be careful about what you log around them.
- PCI scope: with Stripe Elements + PaymentIntents, you're SAQ-A. Don't accept raw card numbers on your server — that bumps you to SAQ-D, which is a different world.
- Rotate the webhook signing secret yearly.

## Common mistakes to flag

- Marking the order paid in the synchronous API response (race with webhook).
- No idempotency on `/orders` (double-charge under retry).
- Refund logic that updates DB before webhook confirms.
- Storing the API secret key client-side (only the publishable key goes there).
- Webhook handler that 500s instead of returning 200 — Stripe will retry forever.
- Computing totals on the client and trusting them.

## Checklist

- Stripe webhook signature is verified.
- Webhook handler is idempotent (event id dedupe).
- `Idempotency-Key` accepted on `/orders`, stored 24h.
- All money is integer cents + currency code.
- Refunds, disputes, and failures all have webhook handlers.
- Tested with Stripe CLI (`stripe listen --forward-to ...`).
