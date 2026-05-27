---
name: security-hardening
description: Threat-model and harden this e-commerce project — JWT secret management, CORS, rate limiting, IDOR on admin/seller endpoints, upload validation, CSRF for cookie auth, secure headers, secrets in env, and audit logging. Trigger whenever the user mentions security, vulnerability, OWASP, XSS, CSRF, SQL injection, IDOR, rate limit, brute force, secrets, .env, secure headers, HSTS, CSP, audit log, or "is this safe to deploy".
---

# Security Hardening

The project handles money (Stripe), identity (JWT), and user-uploaded content — three of the four highest-risk surfaces. This skill is the OWASP-aware companion to the identity-focused `auth-jwt` skill; it covers the threats `auth-jwt` does **not** address.

## When this skill applies

- Pre-deploy review of a new endpoint, especially under `/admin/*` or `/seller/*`.
- Adding or changing CORS, secrets, env vars, or auth cookies.
- Anything touching uploads, downloads, or external links.
- Adding rate limiting or brute-force protection.
- Auditing for IDOR, SSRF, XSS, CSRF, or secret leakage.
- Writing or reviewing audit-log code for admin actions.

For identity, role guards, and JWT issuance see `auth-jwt`. For payment-specific threat surface (webhook signing, PCI scope) see `payment-integration`. For not-leaking errors to clients see `error-handling`.

## Known live gaps in this repo (fix on sight)

These exist as of writing — flag them in any PR that touches the area:

1. **`SECRET_KEY` has a default** in `server/app/core/security.py` (`"your-super-secret-key-change-it"`). A boot-time default is a footgun: it lets prod start with a key any attacker can forge tokens against. Make it required (see "Secrets" below).
2. **CORS is fully open** — `allow_origins=["*"]` with `allow_credentials=True`. This combination is invalid per the CORS spec and modern browsers reject it; some legacy ones don't, leaking credentials. Set explicit origins (see "CORS" below).
3. **No rate limiting anywhere** despite a test comment referencing one. Login, register, OTP, password-reset, and search are all DOS / brute-force candidates.
4. **Upload validation only checks extension**, not MIME type or magic bytes (`server/app/modules/product/router.py` `POST /upload`). An attacker can upload an HTML/JS payload with a `.jpg` extension.

## Secrets

All secrets flow through `server/app/core/config.py` (pydantic-settings). Required secrets must fail at boot if missing — no defaults.

```python
# server/app/core/config.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — fail at boot if not provided
    SECRET_KEY: str = Field(min_length=32)
    DATABASE_URL: str

    # Optional with sane defaults
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    ALGORITHM: str = "HS256"

    # Frontend origins (CSV)
    ALLOWED_ORIGINS: str = "http://localhost:5173"
```

Rules:

- `.env` is gitignored. `.env.example` is committed with placeholder values.
- Rotate `SECRET_KEY` annually and on suspicion of compromise — token revocation needs both a rotated key AND a `jti` blocklist (see `auth-jwt`).
- Per-environment secrets live in the deploy target's secret store (GitHub Actions secrets, AWS SSM, Vault), never in committed files.
- For Stripe/external APIs, use the test key in dev, live key only in prod, and never log them.

## CORS — close the window

Replace the current `allow_origins=["*"] + allow_credentials=True` with explicit origins from settings:

```python
# server/app/main.py
from fastapi.middleware.cors import CORSMiddleware

allowed = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,           # explicit list, no "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"],
    expose_headers=["X-Request-ID"],
    max_age=600,
)
```

- If you need wildcard access (a public read-only API), drop `allow_credentials=True` and never send cookies/Authorization to that origin.
- Subdomains require explicit entries — `*.example.com` is not a valid value here.

## Rate limiting

Add `slowapi` (or `fastapi-limiter` with Redis if you scale beyond one process).

```bash
pip install slowapi
```

```python
# server/app/core/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

```python
# wire into app
from app.core.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(429, {"error": {
        "code": "RATE_LIMITED",
        "message": "Too many requests. Try again later.",
        "details": {"retry_after": exc.retry_after},
        "request_id": request.headers.get("x-request-id"),
    }})
```

Apply per-endpoint with sensible budgets:

| Endpoint | Budget | Key |
| :-- | :-- | :-- |
| `POST /auth/login` | 5 / minute | IP + email body |
| `POST /auth/register` | 3 / minute | IP |
| `POST /auth/forgot-password` | 3 / 10 minutes | IP + email body |
| `POST /auth/verify-otp` | 5 / minute | user_id |
| `GET /products/search` | 60 / minute | IP |
| `POST /reviews` | 5 / hour | user_id |

```python
@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginIn, ...): ...
```

`get_remote_address` reads `request.client.host`. Behind a load balancer, configure your proxy to forward client IP via `X-Forwarded-For` and set Starlette's `ProxyHeadersMiddleware` (uvicorn handles this if you start with `--proxy-headers --forwarded-allow-ips '*'`).

## Authorization — IDOR is the #1 e-commerce CVE

Every route that takes a resource ID in the path or body must verify the caller owns the resource (or has admin role).

```python
# bad — anyone with a token can fetch any order
@router.get("/orders/{order_id}")
def get_order(order_id: UUID, db = Depends(get_db), user = Depends(get_current_user)):
    return db.get(Order, order_id)

# good — caller must own it (or be admin)
@router.get("/orders/{order_id}")
def get_order(order_id: UUID, db = Depends(get_db), user = Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order:
        raise NotFoundError("Order not found")
    if order.user_id != user.id and user.role != UserRole.ADMIN:
        raise ForbiddenError("Not your order")
    return order
```

Apply the same pattern to:

- `/orders/*`, `/cart/*`, `/addresses/*`, `/payment-methods/*` → owned by `user_id`.
- `/seller/products/*`, `/seller/orders/*` → owned by `store.user_id`.
- `/reviews/{id}` PATCH/DELETE → owned by `user_id`.
- Image URLs (`/uploads/<uuid>.jpg`) — currently served as static, so anyone with the URL can fetch. For private artifacts (KYC docs, return-shipping labels), serve through an authenticated endpoint, not `/uploads/`.

## Input handling

### SQL injection

SQLAlchemy ORM parameterizes by default. The only risk is `sa.text("... " + variable)` or `.execute(f"...")` — never concatenate. If you need dynamic SQL, bind parameters explicitly:

```python
db.execute(sa.text("SELECT * FROM products WHERE title = :t"), {"t": title})
```

Today raw `sa.text(...)` only appears in migrations, which take fixed strings — that's fine.

### Upload validation

Today's flow checks only the extension. Add real MIME-sniffing + size cap + dimension check.

```python
# server/app/modules/product/router.py
from io import BytesIO
from PIL import Image  # pillow already in deps for image work

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 4096

@router.post("/upload")
async def upload(file: UploadFile = File(...), user = Depends(get_current_user)):
    if file.content_type not in ALLOWED_MIME:
        raise ValidationError("Unsupported file type")

    blob = await file.read()
    if len(blob) > MAX_BYTES:
        raise ValidationError("File too large (max 5 MB)")

    try:
        img = Image.open(BytesIO(blob))
        img.verify()  # detects truncated / malformed images
    except Exception:
        raise ValidationError("Not a valid image")

    if max(img.size) > MAX_DIMENSION:
        raise ValidationError(f"Image too large ({MAX_DIMENSION}px max side)")

    # store as <uuid>.<ext> based on MIME, not user-supplied filename
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    name = f"{uuid4().hex}.{ext}"
    ...
```

Never use the user-supplied filename in the saved path — path traversal. Always generate a UUID.

For documents (PDFs in disputes, KYC), restrict access with a token-protected endpoint, never via `/uploads/` static.

### Body size limits

Add an upstream cap in your reverse proxy (nginx `client_max_body_size 6m;`) so big payloads die before hitting Python.

## XSS

React escapes string children by default — XSS sneaks in via:

- `dangerouslySetInnerHTML` — avoid. If you must render HTML, sanitize with `dompurify`.
- `href` / `src` attributes built from user input — strip `javascript:` URIs.
- Markdown rendering (reviews, product descriptions) — use a sanitizing renderer (`marked` + `dompurify`, or `react-markdown` with default rules).

Set a Content-Security-Policy header (see "Secure headers" below) to limit damage if a payload slips through.

## CSRF

The project uses `Authorization: Bearer` for the access token — **not** vulnerable to classic CSRF because cookies aren't auto-attached. *But* once you add the **refresh-token cookie** (planned per `auth-jwt`):

- Set the cookie `SameSite=Lax` (default) or `Strict` for the refresh endpoint.
- The `POST /auth/refresh` endpoint should be reachable only via same-site fetch.
- For any state-changing endpoint that *does* read auth from a cookie, require a CSRF token (double-submit cookie pattern is simplest).

## Secure response headers

```python
# server/app/main.py
@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.scheme == "https":
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return resp
```

CSP is project-specific; start in `report-only` mode and tune:

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  img-src 'self' data: https://*.stripe.com;
  script-src 'self' https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.stripe.com;
  frame-src https://js.stripe.com https://hooks.stripe.com;
```

Move to enforced CSP only after a week of clean reports.

## Brute force, enumeration, account safety

- **Login**: same generic error for "user not found" and "wrong password" — don't leak which one. Rate-limit per IP + per email.
- **Register**: don't reveal "email already in use" to an unauthenticated caller. Always respond 200 "if this email is new, we sent a verification link"; the email itself reveals whether it was a fresh registration.
- **Password reset**: same approach — generic response, send email only on hit, rate-limit per email.
- **Timing attacks**: `passlib.verify` is constant-time. Don't add fast-paths that return early for unknown users — that re-introduces a timing oracle. Compare against a fixed dummy hash if the user doesn't exist.

## Logging & audit trail

- **Never log**: passwords, raw JWTs, refresh tokens, Stripe secret keys, full card data, OTP codes, recovery tokens.
- **Do log** (admin/seller actions specifically) — write to `OrderEvent` / a generic `AuditLog` table:
  - Actor (user_id + role)
  - Action (`SELLER_APPLICATION_APPROVED`, `REFUND_ISSUED`, `USER_DEACTIVATED`)
  - Subject (target user_id / order_id)
  - Before/after snapshot of mutated fields
  - Timestamp + request_id

See `logging-observability` for the broader logging conventions.

## Dependency hygiene

- `pip-audit` (Python) and `npm audit` (Node) in CI — fail the build on high-severity CVEs.
- Renovate or Dependabot for automated upgrade PRs.
- Pin major versions; let patches float. Lock with `package-lock.json` (committed) and a `requirements.txt` regenerated from a `requirements.in` via `pip-compile`.

## Common mistakes to flag

- `SECRET_KEY = "your-super-secret-key-change-it"` shipping to prod — make it required-at-boot.
- `allow_origins=["*"]` with `allow_credentials=True` — invalid CORS combo, leaks creds.
- An endpoint that takes `?user_id=` from the query string and trusts it — derive identity from the JWT, never the request.
- Logging the full request body on errors — exfiltrates passwords, OTPs, card numbers.
- Returning the SQLAlchemy `User` object directly — leaks `password_hash`. Always go through a `UserOut` schema.
- Allowing `..` or absolute paths in upload filenames — path traversal.
- Storing uploaded images under the user-supplied filename — easy XSS via `evil.html` saved as `<img src>`.
- Same error message for "session expired" and "you're not authorized to do this" — leaks authz state.
- Using `eval`, `pickle.loads`, or `yaml.load` on any untrusted input.
- Stripe webhook handler that doesn't verify the signature — anyone can mark orders paid (see `payment-integration`).
- Disabling SSL verification in axios / requests / httpx to "make it work in dev" — fixes the wrong layer.

## Checklist

- `SECRET_KEY` required at boot; no default value in code.
- CORS lists explicit origins; `allow_credentials` only with explicit origins.
- Rate limit on `/auth/*`, password reset, OTP, search, review create.
- Every resource-by-id route verifies ownership (or admin).
- Uploads: MIME + size + dimension check; UUID filenames; never the user-supplied name.
- Security headers middleware in place: nosniff, frame-deny, referrer-policy, HSTS in prod.
- No password, token, OTP, or PII in logs.
- Stripe webhook handler verifies signature (`payment-integration` checklist).
- Generic responses for login / register / password-reset failures (no enumeration).
- Admin actions write audit-log rows with actor, subject, before/after.
- `pip-audit` / `npm audit` clean (or knowingly waived with a comment + ticket).
- `.env` gitignored; `.env.example` reflects current schema.
