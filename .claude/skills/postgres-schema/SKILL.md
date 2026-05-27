---
name: postgres-schema
description: Design PostgreSQL schemas, SQLAlchemy 2.0 models, Alembic migrations, and pgvector indexes for this project's e-commerce backend. Trigger whenever the user mentions database, table, column, schema, migration, alembic, foreign key, index, constraint, embedding, pgvector, jsonb, or "change the data model".
---

# Postgres + SQLAlchemy + Alembic

The backend uses PostgreSQL with the `pgvector` extension, SQLAlchemy 2.0-style models, and Alembic migrations under `server/migrations/versions/`. SQLite is used in `server/conftest.py` for fast isolated tests, so models must avoid Postgres-only features at the Python level (use JSON-compatible types via dialect dispatch).

## When this skill applies

- Adding or changing tables / columns / indexes / constraints.
- Writing or fixing Alembic migrations.
- pgvector embedding columns and HNSW indexes.
- JSONB column design (e.g. `Product.attributes`).

For business validation rules at the API edge, see `api-contract-builder`. For embeddings & search, see `embeddings-search`.

## Conventions used in this project

- **Primary keys**: `UUID` (server-default `gen_random_uuid()`) on user-facing tables (users, products, orders). `BIGSERIAL` for high-throughput append-only tables (events, outbox).
- **Timestamps**: every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and most have `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` with an UPDATE trigger or SQLAlchemy `onupdate=func.now()`.
- **Money**: `BIGINT` cents (column suffix `_cents`). Never `NUMERIC(10,2)` and never `float`.
- **Currency**: `CHAR(3)` ISO 4217 (e.g., `usd`, `inr`).
- **Enums**: SQLAlchemy `Enum(MyEnum, name="my_enum")` — Postgres enum type with a stable `name`.
- **Soft delete**: prefer a `deleted_at TIMESTAMPTZ NULL` column over a `deleted bool`; default queries filter it out.

## Model template (SQLAlchemy 2.0)

```python
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Index, func
from uuid import UUID, uuid4
from datetime import datetime

class Product(Base):
    __tablename__ = "products"

    id:          Mapped[UUID]      = mapped_column(primary_key=True, default=uuid4)
    seller_id:   Mapped[UUID]      = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    category_id: Mapped[UUID]      = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), index=True)
    title:       Mapped[str]       = mapped_column(String(200), nullable=False)
    price_cents: Mapped[int]
    currency:    Mapped[str]       = mapped_column(String(3), default="usd")
    attributes:  Mapped[dict]      = mapped_column(JSONB, default=dict, server_default="{}")
    embedding:   Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)
    is_active:   Mapped[bool]      = mapped_column(default=True, server_default="true")
    created_at:  Mapped[datetime]  = mapped_column(server_default=func.now())
    updated_at:  Mapped[datetime]  = mapped_column(server_default=func.now(), onupdate=func.now())

    seller   = relationship("User", back_populates="products")
    category = relationship("Category")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_products_attributes_gin", "attributes", postgresql_using="gin"),
        Index("ix_products_seller_active", "seller_id", "is_active"),
    )
```

## Foreign keys & cascade rules

- `ON DELETE RESTRICT` for "this row matters" (orders, payments, reviews of sold products).
- `ON DELETE CASCADE` for owned children that have no value alone (`order_items` of an order, `variant_option_values` of a variant).
- `ON DELETE SET NULL` when the link is informational (e.g., `referred_by` on user).
- **Always index FK columns** — Postgres does NOT auto-index them.

## Indexing rules of thumb

- Index every FK column.
- Composite index for "filter + sort" pairs (e.g., `(seller_id, created_at DESC)` on products).
- `GIN` index on JSONB if you'll query into it (`products.attributes`).
- `HNSW` index on `vector` columns (embeddings).
- `pg_trgm` GIN index on text columns used for ILIKE search (product title).

```sql
CREATE INDEX IF NOT EXISTS ix_products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS ix_products_title_trgm
  ON products USING gin (title gin_trgm_ops);
```

Don't over-index — every index slows writes. Add when a query is actually slow, not preemptively.

## pgvector specifics

```python
from pgvector.sqlalchemy import Vector

class Product(Base):
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)
```

- Dim = 384 (sentence-transformers `all-MiniLM-L6-v2`).
- HNSW with `vector_cosine_ops`.
- Backfill via `server/scripts/backfill_category_embeddings.py` (analogous script for products).
- Queries use `<=>` (cosine distance): `ORDER BY embedding <=> :query_vec LIMIT 50`.

## Alembic — writing safe migrations

Generate:

```bash
cd server && alembic revision --autogenerate -m "add discount_cents to products"
```

Always **review** the generated file. Autogenerate misses:

- ENUM type additions (must use `op.execute("ALTER TYPE …")`).
- JSONB / Vector / GIN / HNSW indexes (autogenerate often gets postgres-specific bits wrong).
- Data backfills.

### Migration safety rules

- **NOT NULL on existing tables**: do it in 3 steps if the table is large:
  1. Add nullable column with default.
  2. Backfill in batches.
  3. `ALTER COLUMN … SET NOT NULL`.
- **Dropping a column**: stop writing to it in a release, ship it; drop in a later release.
- **Renaming**: don't autogenerate — Alembic sees it as drop+add. Write the rename by hand or do add-new + backfill + drop-old.
- **Indexes**: in production use `CREATE INDEX CONCURRENTLY` (Alembic: `op.execute("CREATE INDEX CONCURRENTLY ...")` + `with op.get_context().autocommit_block():`).
- **No raw SQL** when there's an op equivalent — keeps the migration reversible.

### Always implement `downgrade()`

Even if you'd never run it in prod, it's the doc of what the migration did and CI may rely on it.

## JSONB design (Product.attributes)

`Product.attributes` is `{ "color": "red", "size_us": "M", "material": "cotton", ... }`. The keys are driven by `CategoryAttributeDefinition` rows so each category controls which keys are allowed.

- Validate keys/types in `services.py` against the active `CategoryAttributeDefinition`s before insert.
- GIN index on the column for facet aggregation in `/products/facets`.
- Don't put list-of-objects in JSONB (e.g., reviews) — promote to a real table.

## Testing — SQLite gotchas

`server/conftest.py` swaps to SQLite in-memory. To stay compatible:

- Use `JSON` (SQLAlchemy generic) when SQLite needs to work, with dialect dispatch:
  ```python
  from sqlalchemy.dialects.postgresql import JSONB
  from sqlalchemy import JSON
  attributes_type = JSON().with_variant(JSONB(), "postgresql")
  ```
- Vector columns: skip them on SQLite by using a server-side fixture that only creates `pgvector` types when the dialect is postgres.
- HNSW / GIN indexes belong in migrations, not in `__table_args__`, so SQLite tests don't trip.

## Common mistakes to flag

- `Float` / `NUMERIC` for money — use `BIGINT` cents.
- Forgetting an index on a FK that's used in joins/filters.
- A migration that adds a NOT NULL column with no default on a populated table → fails in prod.
- Using `op.execute("DELETE FROM ...")` as a "schema fix" — write a migration for schema, a script for data.
- Calling `alembic revision --autogenerate` and shipping without reading the diff.
- Naming an enum without a `name=` — Postgres ends up with a random anonymous type each time.
- Building reviews/comments/timeline rows inside JSONB instead of their own tables.

## Checklist

- New column has the right type, NULL/NOT NULL, default, and index.
- FK has `ondelete=` chosen deliberately (RESTRICT by default).
- Money is `_cents` BIGINT; currency is `CHAR(3)`.
- Migration runs forward AND backward locally.
- Large-table changes are split into safe phases.
- Embedding columns get an HNSW index (in a migration, not in model `__table_args__`).
- Tests pass on SQLite (no PG-only types in column declarations without dialect variants).
