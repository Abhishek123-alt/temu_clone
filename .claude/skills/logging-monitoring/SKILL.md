---
name: logging-monitoring
description: Set up structured logging, metrics, traces, and alerting across React + FastAPI. Covers log shape, request id correlation, what to log vs. drop, Sentry integration, OpenTelemetry, dashboards, SLOs, and on-call alert design. Trigger whenever the user mentions logs, logging, structured logging, JSON logs, Sentry, observability, OpenTelemetry, traces, metrics, dashboard, alert, alerting, on-call, SLA, SLO, "we don't know what broke", or "set up monitoring".
---

# Logging & Monitoring

If a tree falls in production and no telemetry catches it, did it really fall? Logs, metrics, and traces are how you find out *what* broke; alerts are how you find out *that* it broke. Build both before you need them.

## When this skill applies

- Setting up logging on a fresh service.
- Wiring Sentry / Datadog / OpenTelemetry / Better Stack.
- Adding metrics or building dashboards.
- Designing alerts for the on-call rotation.

## The three pillars

| | What it answers | Cost |
| --- | --- | --- |
| **Logs** | "What happened to this request?" | High (volume) |
| **Metrics** | "How is the system doing?" | Low (aggregated) |
| **Traces** | "Where did the time go in this request?" | Medium |

Use logs for forensics, metrics for trends, traces for latency hunts. Don't try to build dashboards out of logs.

## Logs — structure them

JSON, one event per line, parseable everywhere. Use `structlog` (Python) or `pino` (Node).

```python
# backend setup
import structlog
structlog.configure(processors=[
    structlog.contextvars.merge_contextvars,
    structlog.processors.add_log_level,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.dict_tracebacks,
    structlog.processors.JSONRenderer(),
])
log = structlog.get_logger()

log.info("order_placed", order_id=order.id, user_id=user.id,
         total_cents=order.total_cents, currency=order.currency)
```

Output:

```json
{"event":"order_placed","level":"info","timestamp":"2026-05-07T12:00:00Z",
 "order_id":"ord_01H...","user_id":"usr_01H...","total_cents":4540,"currency":"USD",
 "request_id":"req_01H...","trace_id":"..."}
```

Rules:

- One `event` field with a stable name (snake_case noun_verb). Use it as a search key.
- Structured fields, not interpolated strings. (`order_id=...` not `f"order {id}"`.)
- ISO 8601 UTC timestamps.
- No PII or secrets — never log passwords, tokens, full PANs, full emails (mask: `j***@example.com`).

## Request ID correlation

Middleware adds a `request_id` to every request and injects into the structlog context:

```python
@app.middleware("http")
async def request_id_mw(request: Request, call_next):
    rid = request.headers.get("x-request-id") or f"req_{uuid7()}"
    structlog.contextvars.bind_contextvars(request_id=rid)
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    structlog.contextvars.clear_contextvars()
    return response
```

The frontend includes `X-Request-Id` on outbound API calls (or reads/echoes it). Now a customer report ("error req_01H...") jumps you straight to the right logs.

## Levels — when to use what

| Level | Use for |
| --- | --- |
| `DEBUG` | Developer-only; off in prod (or sampled). |
| `INFO` | Normal events: request received, order placed, login. |
| `WARN` | Recoverable abnormality: external service slow, retry needed, validation that suggests a client bug. |
| `ERROR` | Failure that affected a user. Always paired with Sentry/equivalent. |
| `CRITICAL` | Service is degraded, paging-worthy. |

If everything is INFO, nothing is. Be deliberate.

## What to log on each request

```
INFO  http_request   method, path, status, duration_ms, user_id?, request_id
INFO  domain_event   business-meaningful events (order_placed, refund_issued)
WARN  external_slow  service, latency_ms, status (when an upstream is degraded)
ERROR unhandled      with stack, request_id, user_id
```

Don't log: full request bodies (PII), full headers (tokens), every DB query (use traces).

## Metrics — RED + USE

For every endpoint:

- **R**ate — requests per second
- **E**rrors — error rate (and by `code`)
- **D**uration — p50 / p95 / p99 latency

For every dependency (DB, Redis, queue, third-party):

- **U**tilization — % busy
- **S**aturation — queue depth / pool wait time
- **E**rrors — connection errors, timeouts

Use Prometheus + Grafana, Datadog, or Better Stack. The library doesn't matter as much as actually building the dashboards.

## Traces — OpenTelemetry

Instrument once, ship everywhere:

```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument(engine=engine)
HTTPXClientInstrumentor().instrument()
RedisInstrumentor().instrument()
```

Trace `request → DB → Redis → Stripe → response` shows you exactly which span ate your latency.

Sample at 100% in dev, 1–10% in prod (head-based or tail-based sampling depending on volume).

## Sentry / error tracking

```python
import sentry_sdk
sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENV,            # different env = different stream
    release=settings.GIT_SHA,            # so issues link to the deploy
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    send_default_pii=False,
    before_send=scrub_sensitive,         # strip tokens/cookies
)
```

Frontend mirror: `@sentry/react` with the same `release` SHA so frontend errors join with backend errors via `request_id`.

Tag errors with `user_id`, `request_id`, `feature_flag` evaluations — turns a vague "ERROR" into "ERROR for user X with flag Y on commit Z".

## Health endpoints

- `/healthz` — process is alive (always 200, no DB call).
- `/readyz` — DB + Redis reachable; load balancer should remove on failure.
- `/version` — git sha + deploy timestamp; helps confirm deploys.

## Frontend monitoring

- **Sentry React** — capture render and lifecycle errors.
- **Web Vitals** (`web-vitals` lib) — send LCP, INP, CLS to your analytics.
- **Network errors** — wrap your fetch client to log API failures with request id.
- Don't ship console.log to prod — most build tools strip them; verify yours does.

## SLOs and alert design

Pick 3–5 SLOs to start:

- "99.5% of `POST /orders` complete in < 1.5s."
- "99.9% of `GET /products` complete in < 250ms."
- "< 0.1% of orders end in `payment_failed` for non-card reasons."

For each, set a *page* alert at the burn rate that exhausts the budget in ~1 hour, and a *ticket* alert for slower burn (~24h).

Don't alert on raw error count — alert on **rate** or **burn rate**. A 100-error spike during a deploy is fine; a 0.5%/hour sustained burn is not.

## Dashboards

Three dashboards minimum:

1. **Service health** — RED metrics for the API as a whole and per-router.
2. **Money path** — order placement rate, payment success rate, refund rate, abandoned-cart rate.
3. **Dependencies** — DB pool, Redis ops/sec, Stripe / search engine latency.

Each dashboard has a top-level "is anything red?" indicator; click to drill in.

## Common mistakes to flag

- Plain text logs in prod (unparseable).
- Logging the full Pydantic body (PII).
- One log line per DB query (volume explodes; use traces).
- Sampling so aggressive that errors disappear (sample requests, but keep 100% of errors).
- One Sentry project for all environments — you'll lose your mind when staging spam drowns prod.
- "Useless" alerts — if it pages but no one acts, delete it or downgrade to ticket.
- No runbooks — alerts that page without a "what to do" link train people to ignore them.

## Checklist

- Logs are JSON, with `request_id` on every line.
- Sentry receives all unhandled errors, scrubbed of secrets, tagged with `release`.
- Traces span the request from FastAPI through DB, Redis, and outbound HTTP.
- A health and readiness endpoint exist.
- Dashboards for service health and money path exist.
- 3–5 SLO-based alerts are wired to the on-call rotation.
- Each alert has a runbook link.
