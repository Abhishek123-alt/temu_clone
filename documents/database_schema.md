# Database Schema — Temu Clone

PostgreSQL (with the `pgvector` extension). All primary keys are UUIDs unless noted; timestamps are UTC `datetime`. SQLAlchemy models live under `server/app/modules/<module>/models.py`; Alembic migrations under `server/migrations/versions/`.

---

## 👥 User Management (`app/modules/user/models.py`)

### `users`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `email` | String | unique, indexed |
| `phone` | String | nullable |
| `password_hash` | String | bcrypt (passlib) |
| `full_name` | String | required |
| `role` | Enum `UserRole` | `CUSTOMER` / `SELLER` / `SELLER_PENDING` / `ADMIN` |
| `is_active` | Boolean | default `true` |
| `spins_left` | Integer | spin-the-wheel inventory, default 3 |
| `referral_code` | String | unique, indexed |
| `referred_by` | UUID FK → `users.id` | nullable |
| `created_at` | DateTime | UTC |

### `addresses`
`id (UUID PK)`, `user_id (FK)`, `street`, `city`, `state`, `zip`, `country`, `is_default (bool)`.

### `payment_methods`
`id`, `user_id`, `brand` (Visa/Mastercard…), `last4`, `exp_month`, `exp_year`, `is_default`, `provider_id` (gateway token).

### `rewards`
`id`, `user_id`, `reward_type` (`coupon`/`credit`/`freeship`), `value` (display string e.g. `"10% OFF"`), `code` (unique), `is_used`, `created_at`.

---

## 📦 Catalog (`app/modules/product/models.py`)

### `categories`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | String | |
| `slug` | String | unique |
| `description` | Text | |
| `image_url` | String | |
| `parent_id` | UUID FK → `categories.id` | self-reference for tree |
| `embedding` | Vector(384) | semantic search on category name+description |
| `created_at`, `updated_at` | DateTime | |

### `category_attribute_definitions`
Defines the dynamic fields a category supports (e.g. Laptops → RAM, brand).
`id`, `category_id (FK)`, `key`, `label`, `field_type` (`select`/`text`/`number`/`boolean`), `options` JSONB, `filterable` bool, `sort_order`, `created_at`.

### `products`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `title` | String | |
| `slug` | String | unique |
| `description` | Text | |
| `price` | Float | "starting from" / fallback |
| `original_price` | Float | nullable; deal detection when `original_price > price` |
| `stock` | Integer | aggregate across variants |
| `rating`, `review_count`, `sales_count` | Float / Integer | denormalized |
| `is_active` | Boolean | |
| `category_id` | UUID FK | |
| `seller_id` | UUID FK → `users.id` | |
| `embedding` | Vector(384) | HNSW indexed |
| `attributes` | JSONB | dynamic fields per category, GIN-indexed |
| `created_at`, `updated_at` | DateTime | |

### `product_options`, `product_option_values`
Defines variant axes per product. `product_options(name, sort_order)` e.g. "Color" → `product_option_values(value)` e.g. "Red", "Blue".

### `product_variants`
`id`, `product_id`, `sku` (unique), `price`, `original_price`, `stock`, timestamps.

### `variant_option_values` (join)
`(variant_id, option_value_id)` composite PK — links a variant to its specific option-value combination.

### `product_images`
`id`, `product_id`, `url`, `is_main`.

### `wishlist_items`
`id`, `user_id`, `product_id`, `created_at`.

### `recently_viewed`
`id`, `user_id`, `product_id`, `viewed_at`.

---

## 🛒 Cart (`app/modules/cart/models.py`)

### `carts`
`id`, `user_id` (unique — one cart per user), `created_at`, `updated_at`.

### `cart_items`
`id`, `cart_id`, `product_id`, `variant_id` (nullable, cascade on variant/product delete), `quantity`.

---

## 📦 Orders & Logistics (`app/modules/order/models.py`)

### `orders`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID FK | buyer |
| `total_amount` | Float | |
| `status` | Enum `OrderStatus` | see lifecycle below |
| `shipping_address` | String | flattened snapshot |
| `billing_address` | String | nullable |
| `payment_method_id` | UUID FK → `payment_methods.id` | nullable |
| `created_at`, `updated_at` | DateTime | |

**Order lifecycle (`OrderStatus`):** `pending → paid → packed → shipped → delivered`, plus `cancelled`, `payment_failed`, `return_requested`, `return_approved`, `return_rejected`, `returned`, `refunded`, `closed`.

### `order_items`
`id`, `order_id`, `product_id` (SET NULL), `seller_id` (SET NULL — used for per-seller analytics), `quantity`, `price` (at purchase), `product_title`, `product_image` (snapshot).

### `order_events` (audit log)
`id (int)`, `order_id`, `from_status`, `to_status`, `actor` (`SYSTEM/USER/SELLER/ADMIN`), `reason`, `metadata_json` (JSONB), `created_at`.

### `shipments`
`id`, `order_id`, `carrier`, `tracking_number`, `tracking_url`, `status` (carrier raw), `estimated_delivery`, `last_location`, `history` JSONB (list of carrier events), timestamps.

### `returns`
`id`, `order_id`, `status` (`requested/approved/in_transit/received/refunded/rejected`), `reason`, `refund_amount`, timestamps.

### `return_items`
`id`, `return_id`, `order_item_id`, `quantity`, `condition`.

### `outbox`
Buffer for async notifications. `id (int)`, `topic`, `payload` JSONB, `available_at`, `attempts`, `delivered_at`, `created_at`. Consumed by `app/modules/order/worker.py`.

---

## 🏬 Seller Stores (`app/modules/store/models.py`)

### `stores`
`id`, `user_id` (unique), `store_name`, `description`, `logo_url`, `banner_url`, `tax_id`, `business_type`, `category`, `warehouse_address`, `status` (Enum `PENDING/ACTIVE/REJECTED`), timestamps.

---

## ⭐ Reviews (`app/modules/review/models.py`)

### `reviews`
`id`, `user_id`, `product_id`, `rating (int)`, `comment`, `created_at`. Unique constraint `(user_id, product_id)`.

---

## ⚡ Flash Sales (`app/modules/flash_sale/models.py`)

### `flash_sales`
`id`, `name`, `description`, `start_time`, `end_time`, `is_active`.

### `flash_sale_products`
`id`, `flash_sale_id`, `product_id`, `discounted_price`.

Order pricing automatically picks the active flash-sale price for an item when one exists (`order/services.create_order`).

---

## 🎮 Gamification (`app/modules/quest/models.py`)

### `quests`
`id`, `title`, `description`, `requirement_type` (e.g. `PRODUCT_VIEW`, `ADD_TO_CART`, `DAILY_LOGIN`, `PRODUCT_UPLOAD`, `FLASH_SALE_VIEW`), `requirement_value` (int), `reward_value` (string, e.g. `"50"`, `"10%"`), `reward_type` (`credit`/`coupon`/`freeship`), `target_user_role` (`Customer`/`Seller`/`All`), `is_active`.

### `user_quest_progress`
Composite PK `(user_id, quest_id)`, `current_progress`, `is_completed`, `last_updated_at`.

---

## Indexes / Extensions
- `pgvector` extension required.
- `ix_products_embedding_hnsw` — HNSW index on `products.embedding` (migration `72700c2e7802`).
- `ix_products_attributes_gin` — GIN on `products.attributes` (declared in model).
- Standard FK indexes auto-created by Alembic.

## Entity Map (summary)

```
User ──┬── Address
       ├── PaymentMethod
       ├── Reward
       ├── WishlistItem ── Product
       ├── RecentlyViewed ── Product
       ├── Cart ── CartItem ── Product / ProductVariant
       ├── Order ── OrderItem ── Product
       │         ├── OrderEvent
       │         ├── Shipment
       │         └── Return ── ReturnItem
       ├── Review ── Product
       ├── Store
       └── UserQuestProgress ── Quest

Category ── (self) ── Category
        └── CategoryAttributeDefinition
        └── Product ── ProductImage
                  ├── ProductOption ── ProductOptionValue
                  └── ProductVariant ── variant_option_values ── ProductOptionValue

FlashSale ── FlashSaleProduct ── Product
```
