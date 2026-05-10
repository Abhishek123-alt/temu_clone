---
name: admin-seller-portal
description: Build the operator-facing surfaces of the marketplace — the seller portal (manufacturers managing products, inventory, orders, analytics) and the admin panel (dispute resolution, user/role management, marketing campaigns, audit log). Trigger whenever the user mentions admin, admin panel, dashboard, seller portal, vendor portal, merchant dashboard, back office, RBAC, role-based access, audit log, dispute, refund approval, or "manage products / orders / users from the backend".
---

# Admin & Seller Portal

The portals are where humans run the business — sellers list their products, ops triages disputes, marketing schedules sales. They have access to powerful actions, so build them with rigor: explicit permissions, audit logs, and dangerous-action guards.

## When this skill applies

- Building or extending the seller-facing UI (catalog management, orders, analytics).
- Building the admin panel (user management, dispute resolution, refund approval).
- Adding new RBAC roles or permissions.
- Designing audit logging for sensitive actions.

For auth/JWT mechanics, see `auth-jwt`. For UI components, see `react-component-builder`. For DB schema, see `postgres-schema`.

## Two portals, one app, separate routes

```
/                 ← customer storefront
/seller/*         ← role: seller (or admin)
/admin/*          ← role: admin only
```

Each portal is a route group with its own layout, navigation, and route guard. Don't ship them as separate apps unless scale forces it — sharing the codebase keeps types and components consistent.

## Roles & permissions (RBAC + scoping)

```
roles
  customer
  seller
  admin

permissions (granular)
  product:read   product:write   product:publish
  order:read     order:fulfill   order:refund
  user:read      user:write      user:impersonate
  campaign:read  campaign:write
  finance:read   finance:write
```

Roles bundle permissions; scope further by **owner** for sellers (a seller can only edit their own products).

```python
# core/permissions.py
def can(user: User, perm: str, obj=None) -> bool:
    if user.role == "admin":
        return True
    if user.role == "seller" and perm in SELLER_PERMS:
        if obj is not None and getattr(obj, "seller_id", None) != user.id:
            return False
        return True
    return False
```

Every protected endpoint:

```python
@router.patch("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate,
                         user: CurrentUser, db: DbSession):
    product = await db.get(Product, product_id)
    if not product: raise NotFound()
    if not can(user, "product:write", product): raise Forbidden()
    ...
```

The check goes in the **service layer** (or in the router right before the service call) — never trust the UI to hide the button.

## Seller portal — typical surfaces

```
/seller/products           list, search, filter own products
/seller/products/new       create product (multi-step wizard)
/seller/products/:id       edit, manage variants, images
/seller/inventory          per-variant stock, low-stock alerts
/seller/orders             orders containing my products only
/seller/orders/:id         line items, packing slip, mark shipped
/seller/returns            returns to approve/process
/seller/analytics          sales, conversion, return rate
/seller/payouts            payout history, balance, account info
/seller/settings           store profile, shipping rules, notifications
```

Tips:

- Bulk operations (bulk price update, CSV import) are first-class — sellers manage 100s–1000s of SKUs.
- An "image-first" product creation flow beats a giant form: upload images → autofill title/category from CV/AI → seller refines.
- Save drafts aggressively (autosave every 5s); never lose typed work.

## Admin panel — typical surfaces

```
/admin                     overview, key metrics, alerts
/admin/users               search users, view orders, ban/unban
/admin/users/:id           full profile, sessions, login history
/admin/orders              search all orders, override status
/admin/disputes            queue of payment disputes / chargebacks
/admin/returns             approve high-value returns
/admin/refunds             issue refunds (with reason, audit log)
/admin/products            moderation queue, takedowns
/admin/sellers             approve, suspend, payout management
/admin/campaigns           flash sales, banners, coupon configs
/admin/coupons             create / edit / disable coupons
/admin/feature-flags       gradual rollout controls
/admin/audit-log           who did what when
/admin/settings            tax rules, shipping, locales
```

## Audit logging — non-negotiable

Every state-changing admin action writes a row:

```sql
admin_audit_events (
  id            bigserial PRIMARY KEY,
  actor_id      text NOT NULL REFERENCES users(id),
  actor_role    text NOT NULL,
  action        text NOT NULL,           -- "user.ban", "order.refund", "product.takedown"
  target_type   text NOT NULL,           -- "user", "order", "product"
  target_id     text NOT NULL,
  before        jsonb,                   -- relevant fields before change
  after         jsonb,
  reason        text,                    -- required for destructive actions
  ip            inet,
  user_agent    text,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_actor ON admin_audit_events(actor_id, at DESC);
CREATE INDEX ix_audit_target ON admin_audit_events(target_type, target_id, at DESC);
```

Wrap admin services with a decorator that auto-logs; don't trust developers to remember.

## Dangerous actions — gated UI

For high-blast-radius actions (mass refund, ban a seller with 1000 orders, push a campaign live):

- **Two-step confirm**: type the resource name to enable the button.
- **Reason required** field (saved to audit log).
- **Cooldown / cooling-off** for irreversible actions (15-min "undo" window where applicable).
- **Multi-approver** for the most dangerous (issuing > $X in refunds, deleting a verified seller).

## Impersonation (with care)

Support reps sometimes need to "view as user X" to debug. Build it but:

- Permission `user:impersonate`, admin-only.
- Banner across the top while impersonating ("You are acting as Sarah J.").
- All actions written to audit with `actor_id` (admin) and `as_user_id` (target).
- Never impersonate to *purchase* or *refund* — switch back to the user's own session for those.

## Bulk actions

Most admin/seller pain comes from clunky bulk flows:

- Multi-select rows → "Apply to N selected" actions.
- Background job for anything > 50 items; show a progress toast.
- CSV import with a dry-run preview (rows that would change vs. rows that would error).

## Analytics tab (sellers)

Show what sellers actually care about, in this order:

1. **Today vs. yesterday vs. last week** (orders, GMV, units).
2. **Top products this week** with conversion rate.
3. **Returns rate** (high → quality issue → fix product).
4. **Inventory at risk** (low stock on best-sellers).
5. **Outstanding payout** (when's the next deposit).

Don't show 25 charts. Pick the 5 that drive action.

## Form patterns

- Products and orders are "fat" entities. Use **tabs** in the editor (Details / Media / Pricing / Inventory / Variants), not one giant scroll.
- Save per tab if possible; otherwise dirty-state warnings on navigation.
- Currency, weight, measurements: locale-aware inputs with units.
- Long descriptions: rich text editor (TipTap, ProseMirror) — sanitize the HTML server-side.

## Common mistakes to flag

- "Hide the button" as the only auth check (UI is not security).
- A single `is_admin` boolean for both panels (use roles + permissions).
- No audit log on refunds, takedowns, role changes.
- Direct DB updates from a "raw SQL" admin page (build a real interface or expose nothing).
- Bulk actions that hit the API one item at a time without a job queue.
- Showing PII (full email, full phone) in admin lists by default — mask, click to reveal, log the reveal.
- Not separating staging admin creds from prod admin creds.

## Checklist

- Both portals are guarded by route-level `can()` checks AND server-side permission checks.
- Every state-changing admin action writes to `admin_audit_events`.
- Dangerous actions require a typed confirmation + reason.
- Bulk operations run as background jobs with progress feedback.
- Impersonation is logged and visually distinct in the UI.
- 2FA required for admin accounts.
- Admin panel has a separate Sentry project / log stream from the storefront.
