---
name: logging-observability
description: Structured logging, request-ID propagation, error reporting, metrics, and health checks for this project's FastAPI backend and React client. Trigger whenever the user mentions logging, logger, log level, structlog, request_id, X-Request-ID, trace, Sentry, metrics, Prometheus, health check, readiness, liveness, telemetry, observability, or "I can't see what's happening in prod".
---

# Logging & Observability

The `error-handling` skill assumes a request-ID flows through every response, but the middleware that produces it doesn't exist yet — this skill lands it. Today the backend uses stdlib `logging.getLogger(__name__)` with default formatting and no correlation IDs; the client has no error reporting. We bias toward **structured JSON logs + request-ID correlation + a single error-reporting hook (Sentry-shaped)** rather than a heavy APM agent.

## When this skill applies

- Adding or changing log statements anywhere in `server/` or `client/`.
- Writing the request-ID middleware or wiring it into responses.
- Setting up Sentry / Crashlytics / OpenTelemetry.
- Adding `/health`, `/ready`, or metrics endpoints.
- Debugging "what happened to this request in prod" — usually the answer is "we didn't log enough".

For the error response envelope shape see `error-handling`. For what *not* to log (passwords, tokens, PII) see `security-hardening`.

## Backend logging

### Logger setup

Configure once at app boot — every module then uses `logging.getLogger(__name__)`.

```python
# server/app/core/logging.py
import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[str | None] = ContextVar("user_id", default=None)

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_ctx.get(),
            "user_id": user_id_ctx.get(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for k, v in getattr(record, "extra_fields", {}).items():
            payload[k] = v
        return json.dumps(payload, default=str)

def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    # quiet noisy libs
    logging.getLogger("uvicorn.access").setLevel("WARNING")
    logging.getLogger("sqlalchemy.engine").setLevel("WARNING")
```

Call `configure_logging(settings.LOG_LEVEL)` at the top of `server/app/main.py`, before any logger is created.

### Request-ID middleware (the missing piece)

```python
# server/app/core/middleware.py
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import request_id_ctx, user_id_ctx

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            request_id_ctx.reset(token)
```

Wire it in `app/main.py` — first middleware so every other middleware/handler sees the ID:

```python
from app.core.middleware import RequestIDMiddleware
app.add_middleware(RequestIDMiddleware)
```

To stamp `user_id` after auth resolves, set the context in `get_current_user`:

```python
def get_current_user(...) -> User:
    user = ...  # existing resolution
    user_id_ctx.set(str(user.id))
    return user
```

This is the same `request_id` the global error handler already references in `error-handling`. With the middleware in place, every log line, every error envelope, every response header carry the same ID — `grep <rid>` reconstructs the request end-to-end.

### Log levels — when to use which

| Level | When |
| :-- | :-- |
| `DEBUG` | Local development only. Verbose state dumps. Off in prod. |
| `INFO` | Significant business events: order placed, payment captured, seller approved, worker drained outbox. One line per event, not one per step. |
| `WARNING` | Recoverable anomalies: idempotent replay served from cache, retry succeeded after one failure, deprecated field used in request. |
| `ERROR` | Unrecoverable failure for this request: handled exception, returned 4xx with cause. Includes stack via `logger.exception(...)`. |
| `CRITICAL` | System-level: DB unreachable, can't write to outbox, worker stalled. Pages oncall. |

Use `logger.info("order_placed", extra={"extra_fields": {"order_id": str(order.id), "total_cents": total}})` — the JSON formatter unpacks `extra_fields` into the payload. Stick to **snake_case event names** so logs are searchable.

### What to log (per domain)

| Domain | Log on |
| :-- | :-- |
| auth | login_success, login_failure (with reason), refresh_issued, refresh_denied, logout, password_reset_requested, password_reset_completed |
| order | order_placed, order_status_changed (from→to), refund_issued, refund_denied |
| payment | payment_intent_created, payment_succeeded, payment_failed, webhook_received (signature ok/fail), refund_initiated |
| outbox / worker | outbox_drained (count), worker_retry, worker_dead_letter |
| admin | seller_approved, seller_rejected, user_deactivated, refund_approved |
| upload | upload_rejected (reason), upload_stored (size, mime) |

### What NEVER to log

(Mirror in `security-hardening`.) Passwords (raw or hashed), JWTs, refresh tokens, Stripe secret keys, full PAN / CVV / card numbers, OTP codes, password-reset tokens, full request bodies on auth endpoints. When stack traces from third parties may include these, mask them before re-raising.

### Exception logging

```python
try:
    place_order(...)
except InsufficientStockError as e:
    logger.warning("order_oversell_blocked", extra={"extra_fields": {
        "variant_id": str(e.details.get("variant_id")),
        "requested": e.details.get("requested"),
        "available": e.details.get("available"),
    }})
    raise
except Exception:
    logger.exception("order_place_unhandled")
    raise
```

`logger.exception` is `error` level + automatic stack. Re-raise so the global handler (see `error-handling`) still builds the envelope.

## Error reporting (Sentry-shape)

Sentry is the path of least resistance — works for both backend and frontend, free tier viable, captures the request_id we just plumbed.

### Backend

```python
# server/app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.05,        # 5% perf samples
        send_default_pii=False,         # we set tags explicitly
        environment=settings.ENV,
        release=settings.GIT_SHA,
    )

@app.middleware("http")
async def sentry_request_id(request, call_next):
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("request_id", request_id_ctx.get())
    return await call_next(request)
```

### Frontend

```js
// client/src/main.jsx
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_GIT_SHA,
    tracesSampleRate: 0.05,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend(event) {
      // strip likely PII from the URL query
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/([?&](?:email|token)=)[^&]+/gi, "$1***");
      }
      return event;
    },
  });
}
```

Wrap the route tree in `<Sentry.ErrorBoundary fallback={<ErrorScreen/>}>` so render errors are captured.

### Stripping PII

Set Sentry filters to drop:
- request bodies for `/auth/*`
- the `Authorization` header
- query params: `email`, `token`, `code`, `otp`

## Frontend logging

- No `console.log` in committed code (the ESLint rule from `coding-standards` allows `warn`/`error` only).
- Add a thin helper instead of calling `console.*` directly:

```js
// client/src/lib/log.js
export const log = {
  info: (msg, fields) => import.meta.env.DEV && console.info(msg, fields),
  warn: (msg, fields) => { console.warn(msg, fields); /* Sentry breadcrumb */ },
  error: (msg, err, fields) => {
    console.error(msg, err, fields);
    Sentry.captureException(err, { tags: { msg }, extra: fields });
  },
};
```

Use `log.error("checkout.place_order_failed", err, { cartId })` from the cart UI, not raw `console.error`.

## Health & readiness

Two distinct endpoints, both unauthenticated, both excluded from rate limits and `include_in_schema=False`.

```python
# server/app/main.py
@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}

@app.get("/readyz", include_in_schema=False)
def readyz(db: Session = Depends(get_db)):
    try:
        db.execute(sa.text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(503, "DB not reachable")
```

- `/healthz` — process is up. Used by load balancer for liveness.
- `/readyz` — dependencies (DB, etc.) are reachable. Used by orchestrator for traffic routing.

Don't query slow dependencies in `/readyz` (e.g., loading the embedding model). Keep it under 50ms.

## Metrics (optional, add when needed)

Use `prometheus-fastapi-instrumentator` to expose `/metrics` for Prometheus scrapes:

```bash
pip install prometheus-fastapi-instrumentator
```

```python
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
```

Custom business counters live alongside services, not in routers:

```python
from prometheus_client import Counter
orders_placed = Counter("orders_placed_total", "Orders placed", ["status"])
orders_placed.labels(status="paid").inc()
```

Skip Prometheus until you actually have a place to scrape it from — premature metrics rot.

## Tracing the outbox / worker

The order-management worker drains an outbox table. Log structured events at every drain cycle so you can answer "did event X actually fire?":

```python
logger.info("outbox_drain_started", extra={"extra_fields": {"batch_size": len(rows)}})
for row in rows:
    try:
        dispatch(row)
        logger.info("outbox_event_dispatched", extra={"extra_fields": {
            "event_id": str(row.id), "type": row.type, "retries": row.retries,
        }})
    except Exception:
        logger.exception("outbox_event_failed", extra={"extra_fields": {
            "event_id": str(row.id), "type": row.type,
        }})
```

The worker should be killable mid-batch and pick up where it left off — log the resume point too.

## Common mistakes to flag

- `print(...)` left in committed code instead of `logger.info(...)`.
- `logger.info(f"user {user.email} did X")` — string-interpolating PII into the message; use `extra_fields` so a downstream filter can drop the field.
- Logging at `INFO` for every request — drowns the signal. Stick to business events.
- `logger.error(str(e))` instead of `logger.exception("...")` — loses the stack.
- Catching exception → log → swallow. Re-raise so the global handler still envelopes it.
- One log line per for-loop iteration in a hot path — sample (`if i % 100 == 0:`) or log totals once at the end.
- Sentry DSN hardcoded in source — must be env-driven, off in tests, on in staging/prod.
- A `request_id` that's generated in the global error handler instead of upstream middleware — different ID for the log line vs. the response.
- `console.log(cart)` in production builds — leaks structure, slows the main thread.
- `/ready` that touches every dependency including 3rd-party APIs — turns into a 30s timeout the moment Stripe blinks.

## Checklist

- `configure_logging()` runs at app boot; format is JSON in non-dev.
- `RequestIDMiddleware` is the first middleware; every response carries `X-Request-ID`.
- `request_id` and `user_id` appear in every log line via `ContextVar`s.
- Logs use snake_case event names and `extra_fields` for structured payload.
- No PII, secrets, or tokens in any log message.
- `logger.exception(...)` used in `except` blocks (gives the stack).
- Sentry initialized when `SENTRY_DSN` is set; off in tests.
- `<Sentry.ErrorBoundary>` wraps the route tree on the client.
- `/healthz` and `/readyz` exist, are unauthenticated, and respond < 50ms healthy.
- Frontend uses `log.*` helper, not raw `console.*`.
- Outbox/worker logs every drain cycle's start, each event's dispatch, and failures with the event id.
