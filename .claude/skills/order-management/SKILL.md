---
name: order-management
description: Build the order lifecycle and fulfillment workflow for this project — order state machine, OrderEvent audit trail, Outbox + worker, stock reservation, returns and refunds. Trigger whenever the user mentions order, place order, checkout completion, fulfilment, shipment, return, refund, order status, packed, shipped, delivered, outbox, worker, or "what happens when an order moves from X to Y".
---

# Order Management

The order flow in this project is event-sourced through an `OrderEvent` audit table and an `Outbox` table consumed by `app/modules/order/worker.py`. Every transition records who did it (`SYSTEM / USER / SELLER / ADMIN`). Money and stock must move atomically.

## When this skill applies

- Adding new order states or transitions.
- Wiring webhooks (payment success/failure) into the order flow.
- Returns, refunds, partial cancellations.
- Touching `app/modules/order/{models,schemas,router,services,worker}.py`.

For the React-side checkout, see `cart-checkout-ui`. For payment gateway specifics, see `payment-integration`. For the audit pattern on admin actions, see `admin-seller-portal`.

## State machine

```
        ┌──────────┐  pay   ┌──────┐  pack   ┌────────┐ ship  ┌─────────┐ deliver  ┌───────────┐
        │ pending  │ ────▶ │ paid │ ─────▶  │ packed │ ────▶ │ shipped │ ───────▶ │ delivered │
        └────┬─────┘        └──┬───┘         └────────┘       └────┬────┘          └─────┬─────┘
             │ cancel           │ refund                            │ lost                │ return_request
             ▼                  ▼                                   ▼                     ▼
        ┌──────────┐        ┌─────────┐                       ┌─────────┐          ┌────────────────┐
        │ canceled │        │ refunded│                       │ lost    │          │ return_pending │
        └──────────┘        └─────────┘                       └─────────┘          └────────┬───────┘
                                                                                            ▼
                                                                                  ┌────────────────┐
                                                                                  │ returned       │
                                                                                  └────────┬───────┘
                                                                                           ▼
                                                                                    refund (above)
```

`OrderStatus` enum is the source of truth. Encode allowed transitions explicitly:

```python
ALLOWED = {
  PENDING:   {PAID, CANCELED},
  PAID:      {PACKED, REFUNDED, CANCELED},
  PACKED:    {SHIPPED, REFUNDED},
  SHIPPED:   {DELIVERED, LOST},
  DELIVERED: {RETURN_PENDING},
  RETURN_PENDING: {RETURNED, DELIVERED},   # rejected → back to delivered
  RETURNED:  {REFUNDED},
}

def transition(order, to: OrderStatus, *, actor: Actor, reason: str = ""):
    if to not in ALLOWED[order.status]:
        raise ConflictError(f"Cannot move from {order.status} to {to}")
    order.status = to
    db.add(OrderEvent(order_id=order.id, from_status=..., to_status=to,
                      actor=actor, reason=reason))
```

Never mutate `order.status` outside `transition()`. That's how audit trails diverge from reality.

## OrderEvent — your audit log

Every state-changing call writes one row. This is also what the seller portal "Order timeline" UI reads — don't bypass it.

```python
class OrderEvent(Base):
    id: UUID
    order_id: UUID
    from_status: OrderStatus | None
    to_status: OrderStatus
    actor: Actor              # SYSTEM | USER | SELLER | ADMIN
    actor_id: UUID | None
    reason: str | None
    metadata: dict            # JSONB; payment_intent_id, tracking_no, etc.
    created_at: datetime
```

## Atomicity: stock + order in one transaction

The "place order" path is the most-broken thing in beginner e-commerce code. The rules:

1. `SELECT … FOR UPDATE` on the variants you're decrementing — prevents two carts buying the last unit.
2. `INSERT` the order, line items, and the initial `OrderEvent` in the **same** transaction.
3. Commit. THEN write the payment intent (or call the gateway) — never inside the DB transaction.
4. On payment success webhook, `transition(order, PAID)` in its own transaction.

```python
def place_order(db, user, cart, idem_key: str):
    if existing := db.query(Order).filter_by(idempotency_key=idem_key).first():
        return existing                              # idempotent replay
    with db.begin():
        variants = db.execute(
            select(ProductVariant)
            .where(ProductVariant.id.in_([l.variant_id for l in cart.lines]))
            .with_for_update()
        ).scalars().all()
        for line in cart.lines:
            v = variants_by_id[line.variant_id]
            if v.stock < line.qty:
                raise InsufficientStockError(...)
            v.stock -= line.qty
        order = Order(user_id=user.id, status=PENDING, idempotency_key=idem_key, ...)
        db.add(order)
        db.add_all(line_items_for(order, cart))
        db.add(OrderEvent(order_id=order.id, to_status=PENDING, actor=USER, ...))
        db.add(Outbox(topic="order.created", payload={"order_id": str(order.id)}))
    return order
```

## Outbox + worker (don't lose events)

Background side-effects (send confirmation email, notify seller, update quest progress, decrement campaign budget) MUST go through the `Outbox` table — not fire-and-forget from the request thread.

- The request handler INSERTs an `Outbox` row inside the same transaction as the state change.
- `app/modules/order/worker.py` polls (or LISTEN/NOTIFY) and processes rows, marking them `processed_at`.
- The worker is idempotent — handlers must tolerate replays.

This pattern survives crashes between "order saved" and "email sent". Without it, a 5xx after commit silently loses notifications.

## Returns & refunds

- Customer files return via `POST /orders/{id}/return` — order moves to `RETURN_PENDING`, return reason saved.
- Seller approves/rejects via `/seller/returns`.
- On `RETURNED`, refund flow kicks in (full or partial, see `payment-integration`).
- Refund only adds stock back if return reason ≠ "defective" — defective stock goes to "quarantine" inventory, not back on sale.

## Cancellation rules

- Customer can self-cancel only in `PENDING` and `PAID` (before `PACKED`).
- After `PACKED`, only seller/admin can cancel (and they trigger a refund).
- After `SHIPPED`, cancellation is impossible — it becomes a return.

## Idempotency for `POST /orders`

The React client sends `Idempotency-Key: <uuid>`. The backend:

1. Looks up an existing order with that key for that user.
2. If found, returns the original response (don't create a new order).
3. If not found, creates the order and stores the key on it (UNIQUE index).

This makes "user double-tapped Place Order" safe.

## Gamification hooks (already wired)

After a state transition, call `quest_services.update_quest_progress(db, user_id, "ORDER_PLACED" / "ORDER_DELIVERED")`. Don't sprinkle this in the router — put it in the service so the worker also triggers it on async transitions.

## Common mistakes to flag

- Decrementing stock outside the order transaction → oversells under contention.
- Mutating `order.status = X` directly without writing an `OrderEvent`.
- Calling the payment gateway *inside* a DB transaction — long held locks; webhooks see a half-committed state.
- Sending the order confirmation email from the request thread (lost if SMTP is down).
- Allowing customer cancel after `PACKED` (seller already paid carrier).
- Forgetting the idempotency key on `POST /orders` → double-charge during retries.
- Restocking on every return regardless of reason.

## Checklist

- All status changes go through `transition()` and write an `OrderEvent`.
- Stock decrement and order creation share one transaction with `SELECT FOR UPDATE`.
- `POST /orders` honors `Idempotency-Key`.
- All side-effects (email, push, quest progress) flow through `Outbox` → worker.
- Allowed-transition matrix has tests for the happy path AND every illegal transition.
- Returns flow updates inventory only when the return reason permits resale.
