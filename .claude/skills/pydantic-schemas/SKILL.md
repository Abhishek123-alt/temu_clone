---
name: pydantic-schemas
description: Design Pydantic v2 schemas for FastAPI request bodies, query params, response models, and shared DTOs. Trigger whenever the user asks about Pydantic, request body, response model, validation, schema, BaseModel, DTO, model_validator, field_validator, or "what should the API return". Also trigger when adding a new endpoint and needing input/output models.
---

# Pydantic Schemas

Schemas are the contract between the React client and the FastAPI backend. Get the shapes right and the rest of the stack — typing, validation, OpenAPI, codegen — comes along for the ride.

## When this skill applies

- Defining input bodies for `POST`/`PATCH` endpoints.
- Defining `response_model` for any endpoint.
- Building shared types used across services.
- Refactoring schemas after a model change.

This skill is Pydantic v2 only.

## Folder layout

```
app/schemas/
├── __init__.py
├── _base.py            # AppBaseModel, common configs
├── product.py          # ProductOut, ProductListOut, ProductCreate, ProductUpdate
├── cart.py
├── order.py
├── auth.py
├── reward.py
└── ...
```

One file per domain. Don't dump everything in `schemas.py`.

## Base model

```python
# schemas/_base.py
from pydantic import BaseModel, ConfigDict
from humps import camelize  # pyhumps

def to_camel(s: str) -> str:
    return camelize(s)

class AppBaseModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,        # accept snake_case AND camelCase on input
        alias_generator=to_camel,     # serialize as camelCase to JS
        from_attributes=True,         # accept ORM objects
        str_strip_whitespace=True,
        extra="forbid",               # unknown fields = 422
    )
```

The React side gets `{productId, priceCents, ...}` while Python uses `product_id`, `price_cents`. No manual mapping.

## Naming conventions

| Suffix | Purpose |
| --- | --- |
| `*Create` | input for `POST` (no id) |
| `*Update` | input for `PATCH` (all fields optional) |
| `*Out` | response model returned to client |
| `*ListOut` | paginated list wrapper |
| `*InDb` (rare) | internal DTO, never returned to client |

```python
class ProductCreate(AppBaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(max_length=5_000)
    price_cents: int = Field(ge=1)
    category_id: str
    images: list[HttpUrl] = Field(min_length=1, max_length=10)

class ProductOut(AppBaseModel):
    id: str
    title: str
    description: str
    price_cents: int
    original_price_cents: int | None = None
    images: list[HttpUrl]
    sold_count: int
    rating_avg: float
    in_stock: bool
    created_at: datetime

class ProductListOut(AppBaseModel):
    items: list[ProductOut]
    next_cursor: str | None = None
    facets: dict[str, list[FacetOut]] = Field(default_factory=dict)
```

## Validation patterns

```python
from pydantic import field_validator, model_validator

class CartLineCreate(AppBaseModel):
    product_id: str
    variant_id: str
    quantity: int = Field(ge=1, le=99)

    @field_validator("product_id", "variant_id")
    @classmethod
    def validate_id_shape(cls, v: str) -> str:
        if not v.startswith(("prod_", "var_")):
            raise ValueError("Invalid id format")
        return v

class OrderCreate(AppBaseModel):
    cart_id: str
    address_id: str
    payment_method_id: str
    coupon_code: str | None = Field(None, max_length=32)

    @model_validator(mode="after")
    def at_least_one_payment(self):
        # cross-field rules go here
        return self
```

Don't reach into the database from a validator — keep them pure. Use a service layer for "does this id exist" checks.

## Optional vs. required

- **Required + nullable**: `field: str | None` — must be present, can be null.
- **Optional**: `field: str | None = None` — can be omitted entirely.
- For PATCH bodies, use a sentinel pattern so you can tell "didn't send" from "sent null":

```python
from pydantic import Field

class _Unset:
    pass
UNSET = _Unset()

class ProductUpdate(AppBaseModel):
    title: str | None | _Unset = UNSET
    price_cents: int | None | _Unset = UNSET
```

Or simpler: use `model_dump(exclude_unset=True)` and trust callers to omit fields they don't want changed.

## Money, dates, IDs

- Money: `price_cents: int = Field(ge=0)`. Never floats. The frontend formats with `Intl.NumberFormat`.
- Dates: `datetime` (UTC, ISO 8601 on the wire). Don't accept naive datetimes.
- IDs: prefer prefixed strings (`prod_xxx`, `ord_xxx`) — easier to debug in logs than raw UUIDs.

## Error response model

```python
class ApiError(AppBaseModel):
    code: str          # PRODUCT_NOT_FOUND
    message: str       # human-readable
    details: dict = Field(default_factory=dict)

class ErrorResponse(AppBaseModel):
    error: ApiError
```

Wire it in via `responses={404: {"model": ErrorResponse}}` on endpoints.

## Common mistakes to flag

- Returning ORM models without a `response_model` — leaks every column.
- Using `Optional[X]` (Pydantic v1) instead of `X | None` (v2 idiom).
- Mutable default values (`list = []`) — use `Field(default_factory=list)`.
- Schemas that import models that import schemas — circular. Keep schemas dependency-free.
- `extra="allow"` — silently accepts garbage and breaks contracts. Use `forbid` (or `ignore` if absolutely needed).
- Reusing a `*Create` model as the `*Out` — they always diverge eventually.

## Checklist

- Each schema is in the right domain file.
- Inputs and outputs are separate models, even if 90% identical.
- All numeric fields have `ge`/`le` bounds where it makes sense.
- All string fields have `max_length`.
- `extra="forbid"` on input models.
- `alias_generator=to_camel` is set so JS sees camelCase.
