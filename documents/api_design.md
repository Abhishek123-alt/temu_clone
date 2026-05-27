# API Design — Temu Clone

All endpoints are mounted under `/api/v1`. The OpenAPI spec is served at `/docs` when the server is running. Auth is JWT bearer (issued by `/auth/login` or `/auth/register`).

Legend: 🔓 public · 🔐 any authenticated user · 👤 owner-only · 🏪 SELLER+ADMIN · 🛡 ADMIN-only

---

## 🔑 Auth (`/auth`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🔓 | Register; returns user + access token. Accepts optional `referral_code` |
| POST | `/auth/login` | 🔓 | Authenticate; returns JWT. Triggers `DAILY_LOGIN` quest |

## 👤 User (`/user`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/user/me` | 🔐 | Current user profile |
| PUT | `/user/me` | 🔐 | Update profile |
| POST | `/user/me/become-seller` | 🔐 | Flip role to `SELLER_PENDING` |
| GET | `/user/me/referral` | 🔐 | Get my referral code |
| POST | `/user/me/redeem-referral?code=` | 🔐 | Redeem a referral code (one-shot) |
| GET/POST/PUT/DELETE | `/user/addresses[/{id}]` | 🔐 | Manage shipping addresses |
| GET/POST/PUT/DELETE | `/user/payment-methods[/{id}]` | 🔐 | Manage saved payment methods |
| GET/POST | `/user/rewards` | 🔐 | List / claim rewards |
| POST | `/user/use-spin` | 🔐 | Consume one spin and roll prize |
| GET/POST/DELETE | `/user/wishlist[/{product_id}]` | 🔐 | Wishlist management |
| GET/POST | `/user/recently-viewed[/{product_id}]` | 🔐 | Recently-viewed list (POST also bumps quest progress) |

## 📦 Products (`/products`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/products/` | 🔓 | List products. Query params: `skip`, `limit`, `search`, `deal_only`, `normal_only`, `category_id`, `new_arrivals`, `sort_by`, `price_min`, `price_max`, `filters` (JSON-encoded attribute filters) |
| GET | `/products/facets` | 🔓 | Aggregate filter facets + price range for current base filters |
| GET | `/products/categories` | 🔓 | Full category tree |
| POST/PUT/DELETE | `/products/categories[/{id}]` | 🛡 | Category CRUD |
| GET | `/products/categories/{id}/attributes` | 🔓 | Dynamic attribute definitions for a category |
| POST/PUT/DELETE | `/products/categories/{id}/attributes`, `/products/attributes/{def_id}` | 🛡 | Attribute definition CRUD |
| GET | `/products/recommended` | 🔐 | Personalized recommendation feed |
| GET | `/products/related/{product_id}` | 🔓 | Related products (same category) |
| GET | `/products/me` | 🏪 | List products owned by current seller |
| GET | `/products/{slug}` | 🔓 | Product detail by slug |
| POST | `/products/` | 🏪 | Create product (also bumps `PRODUCT_UPLOAD` quest) |
| PUT | `/products/{id}` | 🏪 (owner) | Update product |
| DELETE | `/products/{id}` | 🏪 (owner) | Delete product |
| POST | `/products/upload` | 🏪 | Upload image; returns URL under `/uploads/` |

## 🛒 Cart (`/cart`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/cart/` | 🔐 | Get (or create) current cart |
| POST | `/cart/items` | 🔐 | Add item (with optional `variant_id`) |
| PUT | `/cart/items/{product_id}` | 🔐 | Change quantity |
| DELETE | `/cart/items/{product_id}` | 🔐 | Remove item |

## 📦 Orders (`/orders`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/orders/` | 🔐 | Create order from cart (`shipping_address`, optional `reward_id`, `payment_method_id`) — applies active flash-sale prices |
| GET | `/orders/` | 🔐 | My orders |
| GET | `/orders/{id}` | 👤 / 🏪 / 🛡 | Order detail |
| PUT | `/orders/{id}/status` | 🛡 | Force status transition |
| POST | `/orders/{id}/shipments` | 🏪 | Create shipment (carrier, tracking) |
| GET | `/orders/{id}/tracking` | 👤 | Tracking history |
| POST | `/orders/{id}/returns` | 🔐 | Request a return |
| POST | `/orders/returns/{return_id}/process?approved=&reason=` | 🏪 / 🛡 | Approve/reject return |
| GET | `/orders/seller/orders` | 🏪 | Orders containing current seller's items |
| GET | `/orders/seller/returns` | 🏪 / 🛡 | Returns inbox (admin view shows seller-rejected disputes only) |

## ⭐ Reviews (`/reviews`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/reviews/` | 🔐 | Create review (unique per user/product) |
| GET | `/reviews/product/{product_id}` | 🔓 | List reviews with user names |

## ⚡ Flash Sales (`/flash-sales`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/flash-sales/active` | 🔓 | Currently-active sales |
| GET | `/flash-sales/all` | 🔓 | All sales (admin view) |
| GET | `/flash-sales/{id}` | 🔐 | Sale detail (bumps `FLASH_SALE_VIEW` quest) |
| POST | `/flash-sales/admin` | 🛡 | Create sale + products |
| PUT | `/flash-sales/admin/{id}` | 🛡 | Update sale (replaces product list) |
| DELETE | `/flash-sales/admin/{id}` | 🛡 | Delete sale |
| POST | `/flash-sales/{id}/products` | 🛡 | Append a product to a sale |

## 🎮 Quests (`/quests`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/quests/` | 🔓 | All quests |
| GET | `/quests/my-progress` | 🔐 | Role-filtered active quests with current progress |
| POST | `/quests/progress?user_id=&requirement_type=` | 🔐 | Manually bump progress (internal/test hook) |

## 🏬 Stores (`/store`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/store/application` | `SELLER_PENDING` | Submit full seller application |
| PATCH | `/store/application/draft` | `SELLER_PENDING` | Save/update draft |

## 🛠 Admin (`/admin`)
| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/admin/stats` | 🛡 | Customers / sellers / products / total delivered sales |
| GET | `/admin/users` | 🛡 | List all users |
| PATCH | `/admin/users/{user_id}/active` | 🛡 | Toggle active flag (admins cannot be modified) |
| GET | `/admin/sellers` | 🛡 | List sellers |
| GET | `/admin/sellers/pending` | 🛡 | Pending seller applications |
| POST | `/admin/sellers/{user_id}/review` | 🛡 | Approve/reject seller — flips role + store status |
| GET | `/admin/sales-orders?seller_id=` | 🛡 | Time-series sales (platform-wide or per seller) |

---

## Conventions
- **Auth header**: `Authorization: Bearer <jwt>`. Tokens are issued by `app/core/security.py` (HS256 by default).
- **IDs**: UUIDs in URLs; integer PKs only for `order_events` and `outbox`.
- **Errors**: FastAPI default error shape `{ "detail": "..." }`. Permission failures → `403`; missing → `404`; invalid body → `422`.
- **Inactive users** (non-admin) cannot use any authenticated endpoint and receive `403`.
- **Filtering**: list endpoints favor query params; the search `filters` param is a JSON-encoded object so dynamic per-category attributes can be filtered.
