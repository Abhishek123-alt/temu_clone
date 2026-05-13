---
name: order-management
description: Build the order lifecycle and fulfillment workflow.
metadata:
  type: professional-standard
---

# Order Management Standard
- Implement state machine for order status: PENDING -> PAID -> PACKED -> SHIPPED -> DELIVERED.
- Ensure inventory is locked/reserved when an order is placed.
- Idempotent order processing to prevent double-charging or double-shipping.
- Decouple order placement from payment confirmation via webhooks.
- Atomic transactions for order and inventory updates.
