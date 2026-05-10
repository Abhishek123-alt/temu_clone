---
name: security-review
description: Review code, configs, and architecture for security issues — OWASP Top 10, auth flaws, injection, SSRF, secrets handling, dependency vulns, PII handling, and PCI scope. Trigger whenever the user mentions security, audit, OWASP, vulnerability, CVE, SQLi, XSS, CSRF, SSRF, IDOR, "is this safe", "review for security", penetration testing, or compliance (SOC2, GDPR, PCI).
---

# Security Review

E-commerce makes you a target. Money flows, PII, payment data — you're worth attacking. Build security in from day one; bolting it on later is more expensive and less effective.

## When this skill applies

- Reviewing a PR for security implications.
- Designing a new feature that touches auth, payments, or user data.
- Responding to a dependency CVE.
- Pre-launch security audit.

## Threat model (specific to this app)

| Asset | Worst case | Mitigation |
| --- | --- | --- |
| User accounts | Mass takeover via credential stuffing | Argon2 + rate limit + breach-list check + 2FA |
| Payment data | Card breach, PCI fine | Stripe Elements (SAQ-A scope), no PAN in logs |
| Inventory / pricing | Oversell, free-product exploit | Server computes totals, row locks |
| Admin panel | RCE, full DB access | Strong auth, network allowlist, audit log |
| Reward system | Coupon farming, referral fraud | Idempotency, anomaly detection, server-side rules |

## OWASP Top 10 — what to check

### 1. Broken Access Control (most common bug)

Every endpoint that takes an `:id`: does the authenticated user own that resource?

```python
@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: CurrentUser, db: DbSession):
    order = await db.get(Order, order_id)
    if not order or order.user_id != user.id:
        raise HTTPException(404)   # 404 not 403 — don't leak existence
    return order
```

IDOR (insecure direct object reference) is the #1 e-commerce bug. Audit every `GET /<thing>/{id}`, every `PATCH`, every `DELETE`.

### 2. Cryptographic Failures

- TLS 1.2+ only.
- Passwords hashed with argon2/bcrypt, never plaintext, never SHA.
- JWT secrets ≥ 32 bytes, in a secrets manager.
- No DIY crypto. Use `cryptography`, never `hashlib` + xor.

### 3. Injection

SQL: only via SQLAlchemy parameterized queries. Search a codebase for raw `f"... {user_input} ..."` strings inside `execute()` — that's the bug.

Command: never `os.system(user_input)`. Use `subprocess.run([...], shell=False)`.

LDAP / NoSQL: same story.

### 4. Insecure Design

Cross-cutting: idempotency keys, server-side total computation, server-side reward decisions, rate limits. Already covered in `auth-jwt`, `payment-integration`, `gamification-ui`. Validate they're in place.

### 5. Security Misconfiguration

- DEBUG off in production. The API docs (Swagger UI) gated or hidden in prod.
- CORS allowlist is explicit and minimal. Never `*` with `credentials: include`.
- Default admin creds removed; default ports closed.
- Database not internet-reachable.
- Headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy` (script-src minimized).

### 6. Vulnerable Components

- `pip-audit` and `npm audit` in CI; fail the build on high-severity.
- Renovate or Dependabot enabled.
- Pin to specific versions; never `latest`.
- Audit `package.json` for sketchy small packages (typosquats).

### 7. Authentication Failures

Already covered in `auth-jwt`. Sanity check during review:
- Lockout / rate limit on `/auth/login`.
- No user enumeration (same response for "wrong password" and "unknown user").
- Refresh rotation with reuse detection.
- 2FA available for admin/seller accounts.

### 8. Software & Data Integrity

- Webhook signatures verified (Stripe especially).
- Container images pinned by digest in production manifests, not tags.
- CI runs in clean ephemeral runners, not shared self-hosted unless hardened.

### 9. Logging & Monitoring

- Log security events: login success/fail, password change, role change, payment events.
- Don't log: passwords, tokens, full card numbers, full PANs, OTP codes.
- Centralize logs; alert on auth-failure spikes and 5xx clusters.

### 10. SSRF

Wherever the backend fetches a URL on the user's behalf (image import, webhook test, OAuth redirect):

- Validate the destination — no private IPs (RFC1918, 169.254.169.254 metadata IP, ::1, etc.).
- Use a vetted SSRF-safe HTTP client (or write a resolver hook in `httpx`).
- Disable redirects unless explicitly needed.

## XSS prevention (frontend)

- React escapes by default — but `dangerouslySetInnerHTML` and unsanitized HTML in product descriptions are the bypass.
- For seller-supplied rich text, sanitize with `DOMPurify` on the server, store the sanitized HTML.
- CSP forbids inline scripts.

## CSRF

Our access tokens live in the `Authorization` header (not cookies), so CSRF is mostly mitigated for the API. But:

- Refresh-token cookie is `SameSite=Lax` (defends most CSRF; `Strict` if your auth flow allows).
- Any state-changing endpoint that does accept cookies should require an `Origin` or `X-CSRF-Token` check.

## PII & GDPR

- Identify PII fields explicitly (`users.email`, `users.phone`, `addresses.*`).
- Add a `/privacy/export` and `/privacy/delete` endpoint — required by GDPR/CCPA.
- Encrypt at rest (RDS encryption is default; verify).
- Limit access via DB roles — your app role doesn't read `password_hash` for non-auth flows.

## PCI scope (with Stripe Elements)

You stay in **SAQ-A** as long as:

- Card data is collected only via Stripe-hosted Elements (an iframe).
- Your servers never see PANs, CVVs, or full track data.
- Webhook endpoint verifies signatures and is HTTPS only.

Don't add a "remember my card" feature that stores card data — let Stripe Customer + payment_methods handle it.

## Secrets management

- Production secrets in AWS Secrets Manager / Doppler / 1Password Secrets Automation.
- Local `.env` in `.gitignore`, `.env.example` only in repo.
- `git-secrets` or `gitleaks` pre-commit and in CI.
- Rotate Stripe webhook secret, JWT secret, DB passwords yearly or after any incident.

## Common mistakes to flag

- `await db.execute(text(f"... {value} ..."))` — interpolation, even "trusted", is a bug.
- `cors_allow_origins=["*"]` with `credentials=True`.
- Storing card data, even tokenized, outside Stripe.
- Returning the password hash from any endpoint.
- Webhook handler that accepts unsigned requests in dev and prod (gate via env).
- `httpx.get(user_supplied_url)` without SSRF guards.
- "We'll add 2FA later" — for admin/seller, ship with it from day one.

## Checklist (pre-launch)

- All endpoints have an authorization check (not just authentication).
- `pip-audit` / `npm audit` clean of high+ severity.
- HTTPS-only, HSTS, CSP, security headers verified.
- Stripe webhook signature verified; tested with the Stripe CLI.
- Rate limits on auth, OTP, rewards.
- Secret scanning in CI (no leaked tokens in history).
- PII export and delete endpoints exist.
- An incident response runbook exists with on-call rotation.
