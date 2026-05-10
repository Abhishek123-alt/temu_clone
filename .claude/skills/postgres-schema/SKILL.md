---
name: postgres-schema
description: Design PostgreSQL schemas, SQLAlchemy models, and Alembic migrations for the e-commerce backend — products, variants, inventory, carts, orders, payments, users, sessions, reviews, rewards. Trigger whenever the user mentions database, schema, table, migration, Alembic, SQLAlchemy, model, foreign key, index, "design the data model", or asks for SQL/DDL.
---

# Postgres Schema

The database is the long-lived asset; code gets rewritten, schemas live for years. Design tables for the **read patterns** you need, not the abstract domain. Use migrations from day one.

## When this skill applies

- Adding a new table, column, or index.
- Authoring or reviewing an Alembic migration.
- Designing relationships (1:1, 1:N, N:M) for a new feature.
- Optimizing a slow query.

For caching strategy on top of these tables, see `redis-caching`. For full-text search and product discovery, see `search-indexing`.

## Conventions

- **Table names**: plural, snake_case (`products`, `order_lines`).
- **Primary keys**: prefixed text IDs (`prod_01HX...`) using ULID or KSUID. Sortable, debuggable, no UUID v4 randomness in indexes.
- **Timestamps**: every table has `created_at` and `updated_at` (`timestamptz NOT NULL DEFAULT now()`). Soft-delete via `deleted_at timestamptz NULL` only when needed.
- **Money**: `cents BIGINT NOT NULL` + `currency CHAR(3) NOT NULL`. Never `numeric(18, 2)` without a clear policy.
- **Enums**: text + CHECK constraint (`status IN ('pending', 'paid', ...)`). Easier to migrate than Postgres enum types.
- **Foreign keys**: always declared, with `ON DELETE` chosen explicitly (RESTRICT by default; CASCADE only for owned children like `order_lines`).
- **Indexes**: explicit, named (`ix_products_category_id`). Don't trust SQLAlchemy's implicit names.

## Core domain tables (sketch)

```sql
users (
  id              text PRIMARY KEY,        -- usr_01H...
  email           citext UNIQUE NOT NULL,
  email_verified  boolean NOT NULL DEFAULT false,
  phone           text UNIQUE,
  password_hash   text,                    -- nullable for social-only users
  role            text NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer','seller','admin')),
  is_active       boolean NOT NULL DEFAULT true,
  locale          text NOT NULL DEFAULT 'en-US',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

sessions (
  id              text PRIMARY KEY,        -- sess_01H...
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_h text NOT NULL,           -- sha256 of refresh token
  user_agent      text,
  ip              inet,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sessions_user_id ON sessions(user_id) WHERE revoked_at IS NULL;

categories (
  id        text PRIMARY KEY,
  parent_id text REFERENCES categories(id) ON DELETE RESTRICT,
  slug      text UNIQUE NOT NULL,
  name      text NOT NULL,
  path      ltree NOT NULL                  -- electronics.phones.cases
);
CREATE INDEX ix_categories_path_gist ON categories USING gist (path);

products (
  id            text PRIMARY KEY,
  seller_id     text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id   text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  base_price_c  bigint NOT NULL CHECK (base_price_c >= 0),
  currency      char(3) NOT NULL DEFAULT 'USD',
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','paused','archived')),
  rating_avg    numeric(3,2) NOT NULL DEFAULT 0,
  rating_count  integer NOT NULL DEFAULT 0,
  sold_count    bigint NOT NULL DEFAULT 0,
  search_vec    tsvector,                    -- maintained by trigger
  attributes    jsonb NOT NULL DEFAULT '{}', -- color sets, materials, etc.
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_products_category_id   ON products(category_id) WHERE status='active';
CREATE INDEX ix_products_search_vec    ON products USING gin (search_vec);
CREATE INDEX ix_products_attributes    ON products USING gin (attributes jsonb_path_ops);

variants (
  id            text PRIMARY KEY,
  product_id    text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku           text UNIQUE NOT NULL,
  options       jsonb NOT NULL,             -- {"color":"red","size":"M"}
  price_c       bigint NOT NULL,
  compare_at_c  bigint,
  weight_g      integer,
  image_id      text REFERENCES product_images(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_variants_product_id ON variants(product_id);

inventory (
  variant_id    text PRIMARY KEY REFERENCES variants(id) ON DELETE CASCADE,
  warehouse_id  text NOT NULL,
  on_hand       integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved      integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

product_images (
  id          text PRIMARY KEY,
  product_id  text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt         text,
  position    integer NOT NULL DEFAULT 0
);

carts (
  id          text PRIMARY KEY,
  user_id     text REFERENCES users(id) ON DELETE CASCADE,  -- nullable: guest carts
  currency    char(3) NOT NULL DEFAULT 'USD',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

cart_lines (
  id           text PRIMARY KEY,
  cart_id      text NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id   text NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
  quantity     integer NOT NULL CHECK (quantity > 0),
  unit_price_c bigint NOT NULL,
  UNIQUE (cart_id, variant_id)
);

orders (
  id            text PRIMARY KEY,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status        text NOT NULL CHECK (status IN
                ('pending','paid','packed','shipped','delivered',
                 'canceled','payment_failed','returned','closed')),
  subtotal_c    bigint NOT NULL,
  shipping_c    bigint NOT NULL,
  tax_c         bigint NOT NULL,
  discount_c    bigint NOT NULL DEFAULT 0,
  total_c       bigint NOT NULL,
  currency      char(3) NOT NULL,
  shipping_addr jsonb NOT NULL,
  billing_addr  jsonb NOT NULL,
  placed_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_orders_user_id_placed_at ON orders(user_id, placed_at DESC);

order_lines (
  id              text PRIMARY KEY,
  order_id        text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id      text NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
  product_title   text NOT NULL,            -- snapshot
  variant_options jsonb NOT NULL,           -- snapshot
  quantity        integer NOT NULL,
  unit_price_c    bigint NOT NULL,
  line_total_c    bigint NOT NULL
);

order_events (
  id          bigserial PRIMARY KEY,
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  actor       text NOT NULL,                 -- system | user | seller | admin
  reason      text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_order_events_order_id_at ON order_events(order_id, at);

payments (
  id                  text PRIMARY KEY,
  order_id            text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider            text NOT NULL,          -- stripe | paypal
  provider_intent_id  text NOT NULL,
  amount_c            bigint NOT NULL,
  currency            char(3) NOT NULL,
  status              text NOT NULL,
  raw                 jsonb NOT NULL DEFAULT '{}',
  last_event_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_intent_id)
);

reviews (
  id          text PRIMARY KEY,
  product_id  text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  order_line_id text REFERENCES order_lines(id),
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       text,
  body        text,
  images      text[] NOT NULL DEFAULT '{}',
  helpful     integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id, order_line_id)
);

coupons (
  code        text PRIMARY KEY,
  type        text NOT NULL CHECK (type IN ('percent','fixed','free_ship')),
  value_c     bigint NOT NULL DEFAULT 0,
  percent_bp  integer NOT NULL DEFAULT 0,    -- basis points (100 = 1%)
  min_total_c bigint NOT NULL DEFAULT 0,
  max_uses    integer,
  used_count  integer NOT NULL DEFAULT 0,
  starts_at   timestamptz,
  ends_at     timestamptz
);

rewards (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      text NOT NULL,                 -- spin | daily | referral | game
  amount_c    bigint NOT NULL,
  expires_at  timestamptz,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

outbox (
  id          bigserial PRIMARY KEY,
  topic       text NOT NULL,
  payload     jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts    integer NOT NULL DEFAULT 0,
  delivered_at timestamptz
);
CREATE INDEX ix_outbox_pending ON outbox(available_at) WHERE delivered_at IS NULL;
```

## Migrations (Alembic)

- One migration per logical change; never edit a merged migration.
- Migrations are reviewed like code — a bad index or a `DROP COLUMN` on a hot table can take prod down.
- For zero-downtime changes follow the **expand → migrate → contract** pattern:
  1. Add new column nullable, deploy.
  2. Backfill in a separate migration or job.
  3. Make NOT NULL / drop old column in a later release.
- `CREATE INDEX CONCURRENTLY` for big tables (set `transactional=False` in Alembic).

## Indexing rules

- Index foreign keys you actually filter or join on.
- Composite indexes lead with the equality column, then range (`(user_id, placed_at DESC)`).
- Partial indexes for "active" rows (`WHERE status='active'`) cut size dramatically on tables with many archived rows.
- GIN on `jsonb` only with `jsonb_path_ops` and a clear access pattern — not blanket.
- Use `EXPLAIN (ANALYZE, BUFFERS)` before adding any index.

## Common mistakes to flag

- Float / numeric without scale for money.
- Missing `ON DELETE` on foreign keys.
- Storing arrays of related entities in JSONB instead of a child table when you'll need to query them.
- Booleans for what's really a small enum (`is_paid`, `is_shipped`...) — use `status`.
- Snapshot-less order lines (lose price/title history when the product changes).
- Indexes on every column "just in case" — they slow writes and chew RAM.

## Checklist

- Every table has `created_at`/`updated_at` and a clear primary key.
- Every FK has an index and an explicit `ON DELETE`.
- Money is `bigint` cents + `char(3)` currency.
- Migrations are reversible (have a `downgrade`).
- New indexes use `CREATE INDEX CONCURRENTLY` on large tables.
- A snapshot of mutable data (price, title, address) is stored on order/order_line.
