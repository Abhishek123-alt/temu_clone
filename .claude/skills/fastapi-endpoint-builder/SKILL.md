---
name: fastapi-endpoint-builder
description: Build FastAPI endpoints, routers, and the request/response stack — dependency injection, error handling, pagination, rate limiting, OpenAPI docs. Trigger whenever the user asks to add an endpoint, route, API, "GET /something", "POST /something", router, controller, dependency, middleware, or "expose this from the backend". Also trigger when the user says "the API needs to..." or "wire up the FastAPI route for...".
---

# FastAPI Endpoint Builder

The backend is FastAPI. Endpoints must be cleanly typed, async-aware, paginated, and consistently shaped so the React client can rely on them.

## When this skill applies

- Adding a new endpoint or router.
- Refactoring an existing route for pagination, auth, or error handling.
- Wiring middleware (CORS, request id, logging, rate limit).

For database modeling, see `postgres-schema`. For Pydantic input/output models, see `pydantic-schemas`. For auth dependencies (`get_current_user`), see `auth-jwt`.

## Project layout

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, middleware, router includes
│   ├── core/
│   │   ├── config.py            # pydantic-settings
│   │   ├── deps.py              # shared dependencies (db, current user, pagination)
│   │   ├── errors.py            # custom exceptions + handlers
│   │   └── logging.py
│   ├── routers/
│   │   ├── products.py
│   │   ├── cart.py
│   │   ├── orders.py
│   │   ├── auth.py
│   │   ├── rewards.py
│   │   └── ...
│   ├── services/                # business logic, no FastAPI imports
│   ├── models/                  # SQLAlchemy ORM
│   ├── schemas/                 # Pydantic v2 models
│   └── db/
│       ├── session.py           # async SessionMaker
│       └── base.py
└── tests/
```

Routers know about HTTP. Services know about business logic. Models know about the database. Don't blur these.

## Endpoint template

```python
from fastapi import APIRouter, Depends, Query, status
from app.core.deps import DbSession, CurrentUser, Pagination
from app.schemas.product import ProductOut, ProductListOut
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])

@router.get("", response_model=ProductListOut)
async def list_products(
    db: DbSession,
    pagination: Pagination,
    category: str | None = Query(None, max_length=64),
    min_price: int | None = Query(None, ge=0),
    sort: str = Query("popular", pattern="^(popular|price_asc|price_desc|new)$"),
):
    return await product_service.list_products(
        db, pagination=pagination, category=category,
        min_price=min_price, sort=sort,
    )

@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: DbSession):
    return await product_service.get_product_or_404(db, product_id)
```

The router stays thin. All real work is in `product_service`.

## Shared dependencies (`core/deps.py`)

```python
from typing import Annotated
from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db_session

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

class Pagination:
    def __init__(self, cursor: str | None = Query(None), limit: int = Query(20, ge=1, le=50)):
        self.cursor = cursor
        self.limit = limit

PaginationDep = Annotated[Pagination, Depends()]
```

Cursor pagination beats offset for infinite-scroll feeds — no skipped rows when new products arrive between pages.

## Response shapes (consistent)

**Lists:**
```json
{ "items": [...], "nextCursor": "abc123", "facets": {...} }
```

**Errors** (handled by a global exception handler):
```json
{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "Product not found", "details": {} } }
```

Define an `AppError` base class with a `code` and let services raise it. The handler converts to the JSON shape above with the right HTTP status.

## Async correctness

- Endpoints are `async def`.
- DB calls are `await session.execute(...)`.
- Never mix sync I/O (e.g., `requests`, `boto3` sync client) inside an async handler — use `httpx.AsyncClient` and `aioboto3`. Sync calls block the event loop and tank concurrency.
- Wrap CPU-heavy work in `asyncio.to_thread`.

## Idempotency

For `POST /orders`, `POST /rewards/spin`, `POST /cart/items`, accept an `Idempotency-Key` header. Store the key + response for ~24h in Redis (`idem:{key}`); replay the stored response on retry. See `redis-caching`.

## Rate limiting

Use `slowapi` or a custom Redis-backed limiter:

- `/auth/login`, `/auth/register`: 5 per minute per IP.
- `/rewards/spin`: 1 per 5s per user.
- `/products`: 60 per minute per IP.

Apply per-router or per-endpoint, not globally.

## OpenAPI / docs

- Every endpoint gets a `summary` and `description` (markdown).
- Use `response_model` and concrete error response classes — frontend codegen depends on this.
- Tag endpoints (`tags=["cart"]`) so the docs page is browsable.
- Mount Swagger only in non-prod, or behind auth.

## Testing pattern

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_products_filters_by_category(client: AsyncClient, seed_products):
    r = await client.get("/products?category=tops&limit=5")
    assert r.status_code == 200
    body = r.json()
    assert all(p["category"] == "tops" for p in body["items"])
    assert len(body["items"]) <= 5
```

See `testing-workflows` for the full pytest setup.

## Common mistakes to flag

- Putting SQL in the router instead of a service.
- Returning ORM models directly without a Pydantic `response_model` — leaks fields and breaks the contract.
- Catching `Exception` and returning 500 silently.
- Forgetting to commit (`await db.commit()`) — writes silently roll back.
- Sync `time.sleep` or sync HTTP libs inside `async def`.
- Endpoints that return different shapes on different inputs.

## Checklist

- Router has a clear prefix and tag.
- All inputs are typed (Pydantic or `Query`/`Path` with constraints).
- Output uses `response_model` (no raw dict).
- Errors raise typed `AppError`s, not `HTTPException` everywhere.
- DB session injected via dependency, not imported globally.
- Tests cover happy path + at least one failure mode.
