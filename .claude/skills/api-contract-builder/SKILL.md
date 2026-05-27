---
name: api-contract-builder
description: Design robust Pydantic v2 schemas and FastAPI request/response contracts for this project. Trigger whenever the user mentions adding/changing an endpoint, request body, response model, OpenAPI shape, serializer, DTO, or "expose X through the API". Also trigger for validation, field constraints, or error envelope work.
---

# API Contract Builder (FastAPI + Pydantic v2)

This project's backend is a modular FastAPI app under `server/app/modules/*`. Every endpoint must have an explicit Pydantic v2 schema for both request and response. Never return ORM models directly.

## When this skill applies

- Adding or changing any endpoint under `server/app/modules/*/router.py`.
- Defining new `schemas.py` types (Create / Update / Out / Filter).
- Touching pagination, filtering, or error response envelopes.
- Designing query parameters or path parameters with validation.

For DB layer, see `postgres-schema`. For auth-protected endpoints, see `auth-jwt`. For consistent errors, see `error-handling`.

## Module layout (must match the existing pattern)

```
server/app/modules/<domain>/
├── models.py        # SQLAlchemy models
├── schemas.py       # Pydantic v2 request/response models
├── router.py        # FastAPI routes (thin — delegate to services)
├── services.py      # business logic, all DB work
└── tests/
```

Routers are aggregated in `server/app/api/v1/api.py` and mounted at `/api/v1` by `server/app/main.py`.

## Schema naming convention

For a resource `Product`:

```python
# server/app/modules/product/schemas.py
class ProductBase(BaseModel):           # shared read/write fields
class ProductCreate(ProductBase):       # POST body
class ProductUpdate(BaseModel):         # PATCH body — all fields Optional
class ProductOut(ProductBase):          # GET response
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class ProductFilter(BaseModel):         # query params (used with Depends)
class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    cursor: str | None = None
```

Never reuse one schema for both create and read — it leaks server-side fields like `id`, `created_at`, `seller_id`.

## Pydantic v2 specifics

```python
from pydantic import BaseModel, Field, ConfigDict, field_validator, EmailStr

class ProductCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    price_cents: int = Field(gt=0, le=10_000_000)
    sku: str = Field(pattern=r"^[A-Z0-9-]{3,32}$")
    description: str | None = Field(default=None, max_length=10_000)
    category_id: UUID
    attributes: dict[str, Any] = Field(default_factory=dict)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()
```

- Use `ConfigDict(from_attributes=True)` on `*Out` schemas to allow `model_validate(orm_instance)`.
- Prefer `UUID`, `datetime`, `Decimal` over `str`/`float` for typed fields.
- Money is `int` cents on the wire; never `float`.
- `EmailStr` (requires `pydantic[email]`, already in requirements.txt).

## Router pattern

```python
from fastapi import APIRouter, Depends, status
from app.modules.user.router import get_current_user
from app.modules.product import services, schemas

router = APIRouter(prefix="/products", tags=["products"])

@router.post(
    "",
    response_model=schemas.ProductOut,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    body: schemas.ProductCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    return services.create_product(db, body, seller=user)
```

- Always set `response_model=` — it strips extra fields and drives OpenAPI.
- Always set `status_code=` for creates (201), no-content (204), etc.
- Always set `tags=` so Swagger groups routes by domain.
- Router stays thin: parse → auth → call service → return. No DB queries in the router.

## Pagination

Default to **cursor pagination** for feed-like endpoints (products, orders, reviews) and **offset pagination** only for admin lists where total count matters.

```python
class CursorPage(BaseModel):
    items: list[ProductOut]
    next_cursor: str | None = None
```

The cursor is an opaque base64 of `(created_at, id)`. Never expose raw offsets to clients in user-facing endpoints — they break when items are inserted mid-scroll.

## Filtering & query params

Bundle filters into a Pydantic model with `Depends()`:

```python
class ProductFilter(BaseModel):
    q: str | None = None
    category_id: UUID | None = None
    min_price_cents: int | None = Field(default=None, ge=0)
    max_price_cents: int | None = Field(default=None, ge=0)
    sort: Literal["popular", "newest", "price_asc", "price_desc"] = "popular"

@router.get("", response_model=schemas.ProductListOut)
def list_products(f: ProductFilter = Depends(), db: Session = Depends(get_db)):
    return services.list_products(db, f)
```

This way the schema is reusable, validated, and self-documenting in OpenAPI.

## Error envelope (must be consistent)

All errors return the same shape. Use `HTTPException` from FastAPI and a global handler that wraps it:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 units left",
    "details": { "available": 2, "requested": 5 },
    "request_id": "..."
  }
}
```

Map domain exceptions in services (e.g., `InsufficientStockError`) to HTTP codes in a single exception handler in `app/main.py`. See `error-handling` for the full pattern.

## Common mistakes to flag

- Returning ORM objects directly without `response_model` — leaks `password_hash`, `is_admin`, etc.
- Using `dict` or `Any` as a request body — no validation, no OpenAPI docs.
- Re-using `*Create` as `*Out` — server fields leak; clients can post `id`/`created_at`.
- Doing DB queries in the router instead of `services.py`.
- Forgetting `tags=` so the Swagger UI becomes one giant alphabetical list.
- `float` for money. Use `int` cents.

## Checklist

- Every endpoint has `response_model` and `status_code`.
- Request, response, and update schemas are separate types.
- Filters are a Pydantic model with `Depends()`.
- Money is `int` cents end-to-end.
- New router is registered in `server/app/api/v1/api.py`.
- Errors flow through the global handler, not ad-hoc `JSONResponse(...)`.
