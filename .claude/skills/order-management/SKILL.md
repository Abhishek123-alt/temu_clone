---
name: order-management
description: Build the order lifecycle on the FastAPI side — placing orders, inventory locking, status transitions (pending → paid → packed → shipped → delivered → returned), shipment tracking, returns/refund flows, and notification fan-out. Trigger whenever the user mentions order, fulfillment, ship, tracking, status update, return, RMA, refund (workflow side), inventory reservation, or "what happens after the user pays".
---

# Order Management

The order lifecycle is the backbone of the post-purchase experience. Every state change is auditable, every transition is explicit, and every side-effect (email, inventory, ledger) happens in a known order.

## When this skill applies

- Implementing `/orders` POST/GET, `/orders/:id/cancel`, `/orders/:id/return`.
- Changing an order's status or wiring the events that fan out from a status change.
- Inventory reservation, oversell prevention.
- Shipment creation, carrier integration, tracking updates.
- Returns, RMAs, partial refunds.

For the actual money capture, see `payment-integration`. For DB schema, see `postgres-schema`.

## State machine (canonical)

```
                ┌──────────► canceled
                │
pending → paid → packed → shipped → delivered ─┐
                                                ├─► returned (full or partial)
                                                │
                                                └─► closed
       │
       └──► payment_failed
```

Rules:

- Transitions are **append-only**: every change writes a row to `order_events` with `from_status`, `to_status`, `actor` (`system`, `user`, `seller`, `admin`), `reason`, `metadata`, `at`.
- Backwards transitions only via `admin` actor with a reason.
- `paid` is set **only** by the Stripe webhook handler — never by the synchronous order POST response.
- `delivered` is set by carrier webhook or, after 14 days post-ship, an automated job.

## Inventory locking

Oversell is the single most common bug in early e-commerce. Use a row-level lock, not application-level state.

```python
async def reserve_inventory(db, lines: list[CartLine]):
    # Lock all rows in a deterministic order to avoid deadlocks
    variant_ids = sorted({l.variant_id for l in lines})
    rows = await db.execute(
        select(InventoryRow)
        .where(InventoryRow.variant_id.in_(variant_ids))
        .with_for_update()
    )
    inventory = {r.variant_id: r for r in rows.scalars()}
    for line in lines:
        inv = inventory[line.variant_id]
        if inv.available < line.quantity:
            raise OutOfStock(line.variant_id)
        inv.reserved += line.quantity
    # commit happens in the calling transaction
```

`available = on_hand - reserved`. When the order moves to `paid`, decrement `on_hand` and `reserved`. On `canceled` or `payment_failed`, decrement `reserved` only.

For really hot SKUs (flash sale), back this with a Redis counter instead of a row lock — see `redis-caching`.

## Order placement transaction

```python
async def place_order(db, user_id, cart_id, address_id, payment_method_id, idem_key):
    async with db.begin():
        cart = await load_cart_locked(db, cart_id, user_id)
        if not cart.items:
            raise EmptyCart()
        await reserve_inventory(db, cart.items)
        totals = compute_totals(cart, address_id)            # tax, shipping
        order = Order(user_id=user_id, total_cents=totals.total, status="pending", ...)
        db.add(order)
        await db.flush()
        for line in cart.items:
            db.add(OrderLine(order_id=order.id, ...))
        log_event(db, order, None, "pending", actor="user")

    # Outside the DB tx — Stripe call:
    intent = await stripe_create_payment_intent(order, payment_method_id, idem_key)
    await persist_payment(db, order.id, intent)
    return order, intent
```

Stripe is called *after* the DB commit so a failing Stripe call doesn't poison the transaction. If Stripe fails, mark the order `payment_failed` in a follow-up tx, which releases inventory.

## Events / fan-out

When status changes, emit an event (in-process for MVP, Kafka/SQS later):

```
OrderPaid     → email confirmation, generate packing slip, notify seller
OrderShipped  → email + push with tracking link
OrderDelivered→ ask for review (after 24h delay)
OrderReturned → refund, restock if grade allows
```

Use a transactional outbox pattern (insert into `outbox` in the same tx, dispatch from a worker) so events are never lost.

## Shipment tracking

```
shipments
  id, order_id, carrier, tracking_number, label_url, status, estimated_delivery, raw
```

Carrier APIs (Shippo, EasyPost, AfterShip) handle multi-carrier abstraction. Pull updates via:

- Webhook (preferred — push from carrier).
- Poll every 6h as a fallback.

Map carrier statuses to your canonical order statuses, but keep the raw status in `shipments.raw` for debugging.

## Returns / RMA

```
1. User opens /orders/:id, clicks "Return"
2. Selects items + reason (drop-down: damaged, wrong item, didn't fit, no longer needed)
3. POST /orders/:id/returns → creates Return row in "requested" state, emails user a label
4. User ships, carrier scan flips Return to "in_transit"
5. Warehouse receives, grades items, marks "received"
6. Approval (auto for low-friction reasons, manual for damage) triggers refund via Stripe
7. Return → "refunded" or "rejected"
```

Refund triggers a `charge.refunded` webhook which closes the loop on the payment side.

## Notifications

| Event | Email | SMS | Push |
| --- | --- | --- | --- |
| OrderPaid | yes | optional | yes |
| OrderShipped | yes | yes | yes |
| OrderDelivered | yes | no | yes |
| OrderRefunded | yes | no | yes |
| ReturnApproved | yes | no | yes |

Templates live in `app/notifications/templates/`. Use a template engine (Jinja2). User can opt out per channel — respect this.

## Common mistakes to flag

- Marking an order paid in the synchronous endpoint (race with webhook).
- Decrementing inventory in `pending` instead of reserving — leads to phantom decrements when payment fails.
- Direct-update to `status` without writing an `order_events` row.
- Sending the "shipped" email from the API call instead of the carrier webhook (status drifts).
- Calling Stripe inside an open DB transaction.
- Forgetting to release reserved inventory on `payment_failed` / `canceled`.

## Checklist

- Every status change writes to `order_events`.
- Inventory uses row-level locks (or Redis for hot SKUs).
- Stripe call is outside the DB transaction.
- Outbox table for events; worker dispatches with retries.
- Webhook handlers are idempotent.
- Return flow has a defined SLA per reason (auto vs. manual approval).
