---
name: error-handling
description: Design and implement error handling consistently across the React frontend and FastAPI backend — typed exceptions, the API error envelope, retries, timeouts, circuit breakers, user-facing messages, and what to log vs. what to surface. Trigger whenever the user mentions error, exception, try/catch, try/except, error handling, error response, "what to return when", "the user sees a 500", retry, timeout, circuit breaker, or "the error message is unclear".
---

# Error Handling

Bad error handling shows up in three places: customers seeing white screens, support staff drowning in vague tickets, and engineers debugging from "something failed" log lines. Design the error path before you write the happy path.

## When this skill applies

- Designing how an endpoint or service signals failure.
- Wiring retries, timeouts, fallbacks for outbound calls.
- Translating server errors into UI messages.
- Standardizing error logs and alerts.

For HTTP error response shapes, see also `fastapi-endpoint-builder`. For monitoring and alerting, see `logging-monitoring`.

## Three audiences for an error

Every error speaks to three people simultaneously:

1. **The user** — needs a clear next step ("Couldn't apply coupon — try a different code").
2. **Support / ops** — needs to recognize the bucket ("ERR_COUPON_INVALID, 50 today").
3. **The on-call engineer** — needs the cause and stack trace.

A single string can't do all three. Separate the layers: an internal exception with full detail → an API envelope with a code + safe message → a UI message tuned to the user.

## Backend: typed exceptions

```python
# app/core/errors.py
class AppError(Exception):
    code: str = "INTERNAL"
    status: int = 500
    message: str = "Something went wrong"
    def __init__(self, message: str | None = None, **details):
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details

class NotFound(AppError):       code = "NOT_FOUND"; status = 404
class Forbidden(AppError):      code = "FORBIDDEN"; status = 403
class Validation(AppError):     code = "VALIDATION"; status = 422
class Conflict(AppError):       code = "CONFLICT"; status = 409
class RateLimited(AppError):    code = "RATE_LIMITED"; status = 429

# Domain-specific
class OutOfStock(AppError):
    code = "OUT_OF_STOCK"; status = 409
    message = "An item in your cart is no longer in stock"

class CouponInvalid(Validation):
    code = "COUPON_INVALID"
    message = "This coupon code is not valid"
```

Services raise these. The router doesn't try/except them; a global handler converts them to the JSON envelope.

## The API error envelope

```json
{
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "An item in your cart is no longer in stock",
    "details": {
      "variantId": "var_abc",
      "available": 0,
      "requested": 2
    },
    "requestId": "req_01HX..."
  }
}
```

Always include `code`. Codes are stable strings; messages can change. Frontend branches on `code`, displays `message` (or its own translation keyed by `code`).

`requestId` lets a user paste it into support, and the engineer find the request in logs.

## Global exception handler

```python
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    request_id = request.state.request_id
    logger.warning("app_error", code=exc.code, message=exc.message,
                   details=exc.details, request_id=request_id)
    return JSONResponse(
        status_code=exc.status,
        content={"error": {
            "code": exc.code, "message": exc.message,
            "details": exc.details, "requestId": request_id,
        }},
    )

@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    request_id = request.state.request_id
    logger.exception("unhandled", request_id=request_id)
    sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={"error": {
            "code": "INTERNAL", "message": "Something went wrong",
            "requestId": request_id,
        }},
    )
```

Two handlers: one for typed `AppError` (expected), one for everything else (unexpected). The unexpected path is where Sentry hooks in.

## Outbound calls: timeouts, retries, circuit breakers

Every call to a third party (Stripe, Twilio, S3, search engine) needs:

- **Timeout** — `httpx.AsyncClient(timeout=httpx.Timeout(connect=2, read=5, write=5, pool=5))`. Default to too short; raise if you observe legitimate timeouts.
- **Retry with backoff** — retry on 429 / 5xx / network errors. Exponential backoff with jitter. **Idempotent calls only.**
- **Circuit breaker** — after N consecutive failures, stop hammering for a cooldown. Use `purgatory` (Python) or write a Redis-backed counter.
- **Fallback** — search engine down → fall back to Postgres FTS. Reviews service down → hide reviews block, don't fail the PDP.

```python
@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.2, max=2),
       retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)))
async def fetch_recommendations(user_id: str) -> list[ProductOut]:
    ...
```

## React: catching errors at the right level

Three layers of UI error handling:

1. **Field-level** — invalid input, fix-in-place errors. Inline message next to the field.
2. **Action-level** — failed mutation. Toast + revert optimistic update.
3. **Boundary** — a component crashed. `<ErrorBoundary>` shows a recoverable fallback ("Couldn't load this section — Retry").

Use a route-level error boundary so a single broken card doesn't blank the whole page.

```tsx
<ErrorBoundary fallback={({ retry }) => (
  <p>Couldn't load this section. <button onClick={retry}>Retry</button></p>
)}>
  <ProductReviews productId={id} />
</ErrorBoundary>
```

## Mapping API errors to UI

```ts
// shared/errors.ts
export const errorMessages: Record<string, string> = {
  OUT_OF_STOCK: "Sorry — that item just sold out.",
  COUPON_INVALID: "That coupon doesn't seem to work. Double-check the code?",
  RATE_LIMITED: "Too many requests. Take a breath and try again.",
  NOT_FOUND: "We couldn't find that.",
  FORBIDDEN: "You don't have access to this.",
  INTERNAL: "Something went wrong on our end. Please try again.",
};

export function userMessage(err: ApiError): string {
  return errorMessages[err.code] ?? err.message ?? errorMessages.INTERNAL;
}
```

Localize keyed by `code`, not by the server message.

## What to log vs. what to surface

| Severity | Log? | Show user? | Page on-call? |
| --- | --- | --- | --- |
| Validation (user input wrong) | INFO | yes (specific) | no |
| Auth (401/403) | INFO | yes (generic) | only if unusual rate |
| Domain (out of stock, coupon invalid) | INFO | yes (specific) | no |
| 4xx with high rate | WARN | n/a | maybe (possible attack) |
| 5xx unhandled | ERROR + Sentry | yes (generic) | yes if rate spikes |
| External dep down | WARN/ERROR | degrade gracefully | yes after threshold |

Don't show the user the same message you'd put in PagerDuty.

## Idempotency and retries

If a `POST` is retried, the server must not double-act. Pattern:

1. Client sends `Idempotency-Key`.
2. Server stores `(key → response)` in Redis with 24h TTL.
3. Same key replays the stored response — never re-runs the mutation.

Without this, retries on slow networks become double charges.

## Common mistakes to flag

- `except Exception: pass` — silent swallowing.
- One generic 500 for every kind of failure (no `code`, no useful message).
- Showing raw stack traces to users.
- Showing "Internal Server Error" for a recoverable, user-fixable problem (e.g., invalid coupon).
- Retrying non-idempotent calls (POST without an idempotency key).
- No timeout on outbound HTTP — eventually you discover one slow upstream froze the whole pool.
- Logging full request bodies (PII / payment info ends up in log aggregators).

## Checklist

- Domain errors are typed (`AppError` subclasses), not raw `HTTPException`.
- Every error response includes `code`, `message`, `requestId`.
- Outbound calls have timeouts, retries on idempotent calls, and a circuit breaker if hot.
- React has at least one error boundary at the route level.
- User-visible messages are keyed off `code`, not concatenated server strings.
- No try/except blocks that catch `Exception` and continue silently.
- Sentry receives unhandled errors with request id and user id (if any).
