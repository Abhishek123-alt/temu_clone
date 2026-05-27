---
name: error-handling
description: Consistent error handling across the FastAPI backend and React frontend of this project. Trigger whenever the user mentions errors, exceptions, error envelope, retries, axios interceptor, 401/403/404/500, custom exception, error boundary, or "make this fail gracefully".
---

# Error Handling (FastAPI + React)

The whole stack has to agree on what an error looks like. The backend raises domain exceptions → a global handler converts them to a fixed JSON envelope → the React axios instance maps that envelope to user-facing toasts and re-auth redirects. Anything that breaks this contract makes debugging miserable.

## When this skill applies

- Adding new domain exceptions (`InsufficientStockError`, `SellerNotApprovedError`).
- Wiring or changing the global FastAPI exception handler.
- Frontend axios interceptor changes, error boundary work, or toast/error display logic.
- Retries, timeouts, idempotency keys.

For payment-specific errors (3DS challenges, declined cards), see `payment-integration`. For auth-specific 401s, see `auth-jwt`.

## The error envelope (must never change shape)

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 units of \"Tee — Red / M\" left.",
    "details": { "available": 2, "requested": 5, "variant_id": "..." },
    "request_id": "01HV..."
  }
}
```

- `code`: stable, SCREAMING_SNAKE_CASE, programmatic. Frontend switches on this.
- `message`: human-readable; safe to show to the user.
- `details`: optional, structured. Used by the UI to render rich errors (e.g., "only 2 left → adjust qty button").
- `request_id`: copy of the `X-Request-ID` header for log correlation.

## Domain exceptions (backend)

Define one base + concrete exceptions per module:

```python
# server/app/core/exceptions.py
class AppError(Exception):
    code: str = "INTERNAL_ERROR"
    status_code: int = 500
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

class NotFoundError(AppError):       code, status_code = "NOT_FOUND", 404
class ForbiddenError(AppError):      code, status_code = "FORBIDDEN", 403
class ValidationError(AppError):     code, status_code = "VALIDATION_ERROR", 422
class ConflictError(AppError):       code, status_code = "CONFLICT", 409

# domain-specific
class InsufficientStockError(AppError):
    code, status_code = "INSUFFICIENT_STOCK", 409
class SellerNotApprovedError(AppError):
    code, status_code = "SELLER_NOT_APPROVED", 403
```

Services raise these freely:

```python
def reserve_stock(db, variant_id, qty):
    v = db.get(ProductVariant, variant_id)
    if v.stock < qty:
        raise InsufficientStockError(
            f"Only {v.stock} units left",
            details={"available": v.stock, "requested": qty, "variant_id": str(v.id)},
        )
```

## Global handler (one place, wired in `app/main.py`)

```python
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(AppError)
async def app_error_handler(request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {
            "code": exc.code, "message": exc.message,
            "details": exc.details,
            "request_id": request.headers.get("x-request-id"),
        }},
    )

@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    return JSONResponse(422, {"error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request body",
        "details": {"fields": exc.errors()},
        "request_id": request.headers.get("x-request-id"),
    }})

@app.exception_handler(StarletteHTTPException)
async def http_handler(request, exc):
    return JSONResponse(exc.status_code, {"error": {
        "code": _code_for(exc.status_code),
        "message": exc.detail if isinstance(exc.detail, str) else "Error",
        "details": None,
        "request_id": request.headers.get("x-request-id"),
    }})

@app.exception_handler(Exception)
async def unhandled(request, exc):
    logger.exception("Unhandled exception", extra={"request_id": ...})
    return JSONResponse(500, {"error": {
        "code": "INTERNAL_ERROR",
        "message": "Something went wrong",   # never leak stack/SQL
        "details": None,
        "request_id": request.headers.get("x-request-id"),
    }})
```

The `request_id` is set by `RequestIDMiddleware` (canonical implementation in `logging-observability`) and propagated via a `ContextVar`. Every log line, every error envelope, every response header carries the same ID — `grep <rid>` reconstructs the request end-to-end.

## Frontend axios interceptor

```js
// client/src/services/api.js
import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/common/toast";

const api = axios.create({ baseURL: "/api/v1", timeout: 15_000 });

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  cfg.headers["X-Request-ID"] ??= crypto.randomUUID();
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const env = err.response?.data?.error;
    const code = env?.code ?? "NETWORK_ERROR";

    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.assign("/login");
      return Promise.reject(err);
    }
    if (err.response?.status === 403 && code === "SELLER_NOT_APPROVED") {
      window.location.assign("/seller/application-pending");
      return Promise.reject(err);
    }
    // generic display — components can opt-out via cfg.meta.silent
    if (!err.config?.meta?.silent) {
      toast.error(env?.message ?? "Something went wrong");
    }
    return Promise.reject(err);
  }
);
```

In components that want custom error UI (e.g., the cart wants to show an inline "only 2 left" affordance), pass `{ meta: { silent: true } }` in the request config and handle the error locally.

## Error Boundaries (React)

Wrap the top of each route group with an `<ErrorBoundary>` that:
- Logs the error to Sentry/whatever with `request_id` if available.
- Shows a "Something went wrong — Reload" UI.
- Does NOT swallow the error in dev (rethrow in `import.meta.env.DEV`).

## Retries & timeouts

- HTTP timeout: 15s default; 60s for upload endpoints.
- Retry **idempotent** requests (GET) on network failure, max 2, with backoff. Never retry POST/PATCH unless they carry an idempotency key.
- For order placement (`POST /orders`), the client sets `Idempotency-Key: <uuid>`; the backend rejects duplicates with `409 IDEMPOTENT_REPLAY` returning the original response.

## Common mistakes to flag

- Returning a bare string `{"detail": "..."}` from a route — breaks the envelope, the frontend toast becomes "undefined".
- Catching `Exception` in a service just to log and re-raise with no extra info — the global handler already logs.
- Showing the raw 500 stack to the user. Never leak internals.
- Toasting auth errors AND redirecting — pick one (redirect, no toast).
- Retrying `POST /orders` without an idempotency key — double-charge incoming.
- Different error shapes per module ("err", "message", "detail", "error.msg"...). One envelope, period.

## Checklist

- All custom backend errors extend `AppError`; the global handler is the only place that builds the envelope JSON.
- Every response includes `request_id`; logs include the same ID.
- `axios` interceptor maps `code` to UX actions; 401 always redirects to login.
- POST/PATCH that change financial state require `Idempotency-Key`.
- Sensitive errors (SQL, stack traces, internal IDs) never reach the client.
- Tested: unauthenticated → 401, wrong role → 403, missing → 404, validation fail → 422 with `fields`.
