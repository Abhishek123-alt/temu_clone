# User Flow & Experience — Temu Clone

Primary user journeys, mapped to the routes and modules that are actually implemented today. Roles: `CUSTOMER`, `SELLER_PENDING`, `SELLER`, `ADMIN`.

---

## 1. Onboarding (Buyer)
1. **Register** at `/register` (optionally with referral code). Token is returned immediately.
2. **Land** on `/` (HomePage): marketing carousel → flash sale section → personalized feed (`/products/recommended`).
3. **Browse**: mega-menu via `CategoryDropdown` → `/search?category_id=…`, or use search bar (semantic + token expansion).
4. **PDP** at `/product/:slug`: gallery, variants (Color/Size → SKU), reviews, related products. View bumps `PRODUCT_VIEW` quest.

## 2. Buy Flow
1. **Add to cart** (optionally with `variant_id`) → cart drawer.
2. `/cart` — review items.
3. `/checkout` — pick shipping address + reward/coupon.
4. `/payment` — pick stored payment method.
5. Order created via `POST /orders/`. Active flash-sale prices override cart price automatically.
6. `/orders` and `/orders/:orderId` track lifecycle (`pending → paid → packed → shipped → delivered`).
7. Customer can request a return from a delivered order; seller approves/rejects.

## 3. Retention & Gamification
1. **Daily login** → `DAILY_LOGIN` quest progress bumped by `/auth/login`.
2. **Spin-the-wheel** at `/profile/quests` (or post-register popup) → `POST /user/use-spin` decrements `users.spins_left` and may grant a `Reward` (coupon/credit/freeship/gift).
3. **Quests** (`/profile/quests`) show role-targeted quests and progress.
4. **Flash sales** (`/deals` and home section) — viewing a sale bumps `FLASH_SALE_VIEW`.
5. **Referrals**: `/user/me/referral` returns the user's code; redemption via `/user/me/redeem-referral?code=` grants $5 credit and a one-time `referred_by` link.

## 4. Seller Journey
1. Customer clicks "Sell on Temu" → `POST /user/me/become-seller` flips role to `SELLER_PENDING`.
2. **Onboarding wizard** at `/seller/onboarding` submits `POST /store/application` (store profile + tax/warehouse details). Drafts saved via `PATCH /store/application/draft`.
3. Application sits in `PENDING` until admin approves (sees role/store activate) or rejects (role → `CUSTOMER`, user deactivated, store `REJECTED`).
4. Active sellers use `/seller`:
   - Product CRUD (with image upload, options, variants, dynamic category attributes).
   - Orders inbox (`/orders/seller/orders`) → enter shipment carrier + tracking (`POST /orders/{id}/shipments`).
   - Returns inbox (`/orders/seller/returns`) → approve/reject (`POST /orders/returns/{id}/process`).
   - Sales chart driven by `/admin/sales-orders?seller_id=<self>`.

## 5. Admin Oversight
1. `/admin` (role-gated UI):
   - KPI cards from `/admin/stats` (customers, sellers, products, total delivered sales).
   - User table with active/inactive toggle (`PATCH /admin/users/{id}/active`).
   - Pending sellers queue → approve/reject flips both `User.role` and `Store.status`.
   - Per-seller sales chart.
   - Category and category-attribute CRUD.
   - Flash sale CRUD.
   - Disputes view: returns rejected by sellers, surfaced via `/orders/seller/returns?admin_view=true`.

## 6. Search & Discovery internals
- Free-text search (`?search=`) is tokenized, embedded (sentence-transformers), and used to:
  1. ILIKE-match `Product.title` / `Product.description` per token.
  2. Cosine-distance match against `categories.embedding` (`< 0.35`) to surface semantically-close categories.
  3. Expand matched categories to their direct children so a search for a parent surfaces all subcategory products.
- `?filters={"ram":"16GB","brand":"Dell"}` filters via JSONB containment on `products.attributes`.
- `/products/facets` returns the set of attribute values and the price range matching the current base filters — used to render the search filter sidebar.

## 7. Returns / Refund State Machine
`return_requested → return_approved → in_transit → received → refunded` (happy path), or `return_requested → return_rejected` (dispute). Rejected returns become Admin-visible disputes. Every transition writes an `OrderEvent`.
