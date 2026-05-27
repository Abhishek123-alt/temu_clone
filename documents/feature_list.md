# Temu Clone — Feature List

Status legend: ✅ implemented · 🟡 partial · ⬜ planned

---

## 1. Authentication & Identity
- ✅ Email + password registration & JWT login (`/api/v1/auth/register`, `/login`)
- ✅ Four-role model: `CUSTOMER`, `SELLER_PENDING`, `SELLER`, `ADMIN`
- ✅ Inactive-user block on protected routes (admins exempt)
- ✅ Token issued at registration so signup → onboarding has no extra login step
- ⬜ Social login (Google/Apple/Facebook)
- ⬜ Phone OTP login

## 2. User Profile
- ✅ View/edit profile (`/api/v1/user/me`)
- ✅ Multiple shipping addresses with default flag
- ✅ Multiple payment methods (brand/last4/expiry, provider token field)
- ✅ Wishlist (add/remove/list)
- ✅ Recently viewed feed (capped, ordered by `viewed_at`)
- ✅ Rewards wallet (coupon / credit / freeship / gift)

## 3. Product Catalog & Discovery
- ✅ Hierarchical categories with `parent_id` self-FK (mega-menu via `CategoryDropdown.jsx`)
- ✅ Category-level `embedding` column (semantic category matching)
- ✅ Product embeddings (`all-MiniLM-L6-v2`, 384 dims) with HNSW index
- ✅ Search: text ILIKE + token expansion + semantic category expansion
- ✅ Dynamic category attributes (`CategoryAttributeDefinition`) — fields/options defined per category, stored in `products.attributes` JSONB (GIN-indexed)
- ✅ Faceted filters + price range (`/products/facets`)
- ✅ Sort by price/newest/rating/sales
- ✅ Deal-only / normal-only / new-arrivals toggles
- ✅ Related products (same category)
- ✅ Recommended products (per user)
- ✅ Product options & variants (Color/Size → SKU/price/stock)
- ✅ Multi-image upload with main-image flag
- ✅ Product detail page (`/product/:slug`)
- ✅ Search results page with filter sidebar (`/search`)

## 4. Cart & Checkout
- ✅ Per-user cart with variant-aware items
- ✅ Cart line CRUD (`/api/v1/cart`)
- ✅ Checkout flow: address → payment method → review (`CheckoutPage`, `PaymentPage`)
- ✅ Coupon/reward selection at checkout (`reward_id` on order create)
- ✅ Flash sale prices applied automatically when active
- ⬜ Live shipping/tax calculation
- ⬜ Real Stripe/PayPal/Apple-Pay integration (currently stored payment method only)
- ⬜ Free-shipping progress bar

## 5. Orders & Logistics
- ✅ Order creation from cart with snapshot of title/image/price
- ✅ Order status state-machine (`pending → paid → packed → shipped → delivered`, plus `cancelled`, `payment_failed`, `return_requested/approved/rejected/ed`, `refunded`, `closed`)
- ✅ `OrderEvent` audit log (from/to status, actor, reason, metadata JSONB)
- ✅ Shipments (`carrier`, `tracking_number`, `tracking_url`, history)
- ✅ Returns + return items (status, refund amount, condition)
- ✅ Seller-side fulfillment views (`/orders/seller/orders`, `/orders/seller/returns`)
- ✅ Return approval workflow (seller approves/rejects; admin sees rejected as disputes)
- ✅ Outbox table + async `worker.py` for downstream notifications
- ⬜ Live carrier webhook ingestion
- ⬜ Customer push/email/SMS notifications

## 6. Reviews
- ✅ One review per (user, product) with rating + comment
- ✅ Aggregate `rating` and `review_count` cached on `Product`
- ✅ Review modal + list on product detail page
- ⬜ Photo / video reviews
- ⬜ Helpfulness voting

## 7. Gamification & Marketing
- ✅ Flash sales (admin CRUD, time-bounded, per-product discounted prices)
- ✅ Spin-the-wheel: per-user `spins_left`, prize pool, reward generation
- ✅ Quests (`Quest`, `UserQuestProgress`) with role targeting (`Customer/Seller/All`) and reward types (`coupon`, `credit`, `freeship`)
- ✅ Quest progress hooks: `DAILY_LOGIN`, `PRODUCT_VIEW`, `PRODUCT_UPLOAD`, `FLASH_SALE_VIEW`, `ADD_TO_CART`
- ✅ Referrals: unique `referral_code` per user, `referred_by` link, signup-time redemption granting credit
- ✅ Marketing carousel on home page
- ⬜ Mini-games (Fishland/Farmland style)
- ⬜ Daily check-in calendar
- ⬜ Push notifications

## 8. Seller Portal
- ✅ Apply-to-sell wizard (`OnboardingWizard.jsx`) creates `Store` row in `PENDING` and sets user role to `SELLER_PENDING`
- ✅ Store profile: name, description, logo, banner, tax ID, business type, category, warehouse address
- ✅ Draft save endpoint (`PATCH /store/application/draft`)
- ✅ Seller dashboard (`SellerDashboard.jsx`) with product CRUD, order fulfillment, returns inbox, sales chart
- ✅ Image upload to backend (`/products/upload`)
- ✅ Sales analytics over time (`/admin/sales-orders?seller_id=...`)
- ⬜ Payouts / settlements
- ⬜ Bulk product upload (CSV)

## 9. Admin Panel
- ✅ Platform stats (`/admin/stats`: customers, sellers, products, sales)
- ✅ User management — list, toggle active/inactive (non-admin only)
- ✅ Pending-seller queue + approve/reject (`/admin/sellers/pending`, `/admin/sellers/{id}/review`)
- ✅ Seller list + per-seller sales chart
- ✅ Category CRUD + category attribute definition CRUD
- ✅ Flash sale CRUD
- ✅ Return-dispute view (returns rejected by sellers)
- ⬜ Audit log UI
- ⬜ Marketing campaigns CMS
- ⬜ Multi-currency / multi-language settings

## 10. Infrastructure & DevOps
- ✅ PostgreSQL + Alembic migrations (23 revisions)
- ✅ pgvector extension; HNSW index on product embeddings
- ✅ FastAPI + Uvicorn; static `/uploads` mount
- ✅ Pytest with SQLite in-memory `conftest.py`
- ✅ Seed/maintenance scripts under `server/scripts/`
- ⬜ Redis caching
- ⬜ Celery / proper task queue (currently single async worker over outbox)
- ⬜ Docker Compose
- ⬜ S3 / CDN for media (currently local `/uploads`)

---

## Frontend Routes (current)
| Path | Page | Auth |
| --- | --- | --- |
| `/login`, `/register` | Auth | public |
| `/` | HomePage (feed + carousel + flash sales) | protected |
| `/deals` | DealsPage | protected |
| `/new-arrivals` | NewArrivalsPage | protected |
| `/search` | SearchPage (facets + filter sidebar) | protected |
| `/product/:slug` | ProductDetailPage (gallery, variants, reviews, related) | public |
| `/cart` → `/checkout` → `/payment` | Buy flow | protected |
| `/orders`, `/orders/:orderId` | OrdersPage, OrderDetailPage | protected |
| `/wishlist` | WishlistPage | protected |
| `/profile`, `/profile/addresses`, `/profile/payment-methods`, `/profile/quests` | Profile section | protected |
| `/seller/onboarding` | OnboardingWizard | public (token-gated content) |
| `/seller` | SellerDashboard | protected |
| `/admin` | AdminDashboard | protected (role-checked in UI) |

## Backend Modules (current)
`auth`, `user`, `product`, `cart`, `order`, `review`, `flash_sale`, `quest`, `store`, `admin`.

All mounted at `/api/v1/<module>` via `server/app/api/v1/api.py`.
