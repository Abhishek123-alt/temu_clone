---
name: fastapi-endpoint-builder
description: Add routes, routers, dependencies, and middleware to this project's modular FastAPI backend (server/app/modules/*). Trigger whenever the user mentions adding an endpoint, route, FastAPI router, dependency, middleware, CORS, request ID, OpenAPI tag, or "wire X into the API".
---

# FastAPI Endpoint Builder

The backend is modular: each domain owns `models.py`, `schemas.py`, `router.py`, `services.py`, `tests/` under `server/app/modules/*`. All routers are aggregated in `server/app/api/v1/api.py` and mounted at `/api/v1` by `server/app/main.py`. This skill is about the router & wiring layer; for Pydantic contracts see `api-contract-builder`, for DB models see `postgres-schema`, for auth dependencies see `auth-jwt`.

## When this skill applies

- Adding a new endpoint, a new domain module, or a new dependency.
- Wiring CORS, middleware, or app-level event handlers.
- Configuring OpenAPI tags, descriptions, or response examples.
- Anything that touches `app/main.py` or `app/api/v1/api.py`.

## Adding a new domain module

```
server/app/modules/<name>/
├── __init__.py
├── models.py
├── schemas.py
├── router.py
├── services.py
└── tests/
    ├── __init__.py
    └── test_<name>_service.py
```

Then register the router in `server/app/api/v1/api.py`:

```python
from app.modules.<name>.router import router as <name>_router
api_router.include_router(<name>_router)
```

That's it — `app/main.py` includes `api_router` once.

## Router boilerplate

```python
# app/modules/wishlist/router.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.user.router import get_current_user
from app.modules.user.models import User
from app.modules.wishlist import services, schemas

router = APIRouter(prefix="/wishlist", tags=["wishlist"])

@router.get("", response_model=list[schemas.WishlistItemOut])
def list_items(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return services.list_items(db, user.id)

@router.post(
    "/items",
    response_model=schemas.WishlistItemOut,
    status_code=status.HTTP_201_CREATED,
)
def add_item(
    body: schemas.WishlistItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return services.add_item(db, user.id, body)

@router.delete("/items/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
    product_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    services.remove_item(db, user.id, product_id)
```

Rules:

- Router stays thin. The whole body is `parse → auth → call service → return`.
- Always set `prefix=` and `tags=`.
- Always set `response_model=`. Empty body? `status_code=204` and return `None`.
- DB work, validation, business logic — all in `services.py`. The router never opens a session, never queries.

## Standard dependencies (re-use, don't invent)

| Need | Use |
| --- | --- |
| DB session | `Depends(get_db)` from `app.db.session` |
| Current user | `Depends(get_current_user)` from `app.modules.user.router` |
| Role guard | `Depends(require_role(UserRole.SELLER, UserRole.ADMIN))` — see `auth-jwt` |
| Pagination | `Depends(PageParams)` — Pydantic model with `cursor`, `limit` |

If you find yourself writing a one-line helper that decodes a header or fetches an object by id, promote it to a dependency in the module so other routes can reuse it.

## Adding middleware

Middleware lives in `app/main.py`. Order matters — outer middleware wraps inner. Standard stack, top-down:

1. **`RequestIDMiddleware`** — generate/propagate `X-Request-ID`. Canonical implementation in `logging-observability`.
2. **Security headers** (`X-Content-Type-Options`, `X-Frame-Options`, HSTS in prod) — see `security-hardening`.
3. **CORS** — explicit allowed origins, never `["*"]` with `allow_credentials=True`. Full pattern in `security-hardening`.
4. **`SlowAPIMiddleware`** for rate limiting — see `security-hardening`.
5. **Exception handlers** — see `error-handling`.

```python
app = FastAPI(title="Temu Clone API", version="1.0")

app.add_middleware(RequestIDMiddleware)           # logging-observability
app.add_middleware(SecurityHeadersMiddleware)     # security-hardening
app.add_middleware(CORSMiddleware, ...)           # security-hardening
app.add_middleware(SlowAPIMiddleware)             # security-hardening
# exception_handler(AppError) etc. — error-handling
```

For one-off middleware (e.g., a per-endpoint header), prefer a **dependency** over a middleware so it's scoped to the routes that need it.

## OpenAPI hygiene

- Always `tags=["wishlist"]` so Swagger groups routes by domain.
- Add a `summary=` for any non-obvious endpoint.
- For complex responses, attach an example:
  ```python
  @router.get("/summary", response_model=schemas.CartSummary,
              responses={200: {"content": {"application/json": {"example": {...}}}}})
  ```
- Mark internal/legacy routes with `include_in_schema=False` (the Stripe webhook does this).

## Async vs sync

This project's routes are mostly **sync** (`def`) because SQLAlchemy sessions are sync. Don't randomly mark a route `async def` unless you're awaiting something — FastAPI will run sync routes in a threadpool, which is fine.

Mark `async def` only when:
- Calling an `httpx.AsyncClient` (e.g., webhook out, external API).
- Using `aiosmtp`, `aioredis`, or another async library.
- Reading the raw request body (`await request.body()`).

Don't mix `async def` route + sync `Session` — the session will block the event loop.

## Static files

User-uploaded media is served at `/uploads` (mounted in `app/main.py`). New uploads go through `app/modules/<domain>/services.py` → write to disk under `server/uploads/<domain>/<id>/...`. For real deployments swap to S3 — see `media-storage`.

## Health & readiness

`/healthz` (process up) and `/readyz` (deps reachable) live in `app/main.py`, unauthenticated, `include_in_schema=False`. Don't put auth, slow work, or 3rd-party calls on either — they're probed every few seconds by orchestrators. Full pattern in `logging-observability`.

## Common mistakes to flag

- DB queries in the router. Always delegate to `services.py`.
- Forgetting to register a new router in `app/api/v1/api.py` (then wondering why the route 404s).
- `prefix="/v1/wishlist"` on the router — the `/v1` is already added by the API gateway include. Just use `/wishlist`.
- Putting `Depends(get_current_user)` inside the function body instead of the signature — won't run.
- Returning a SQLAlchemy model directly without `response_model` — leaks fields.
- `allow_origins=["*"]` with credentials.
- Adding `async def` then making a blocking `db.query(...)` call → event loop stall.

## Checklist

- New router has `prefix` and `tags`.
- Registered in `app/api/v1/api.py`.
- All endpoints have `response_model` + `status_code`.
- Auth/role dependencies are explicit per route.
- Heavy logic lives in `services.py`; tests cover it without spinning up the HTTP layer where possible.
- Swagger at `/docs` groups the new endpoints correctly.
