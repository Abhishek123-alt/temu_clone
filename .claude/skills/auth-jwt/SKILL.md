---
name: auth-jwt
description: Implement authentication and authorization for the FastAPI backend — registration, login, JWT access + refresh tokens, password hashing, session management, social login (Google/Facebook/Apple), email/phone OTP, and the `get_current_user` dependency. Trigger whenever the user mentions login, signup, register, JWT, token, refresh token, OAuth, social login, password, hashing, session, "who is the user", auth dependency, or protecting an endpoint.
---

# Auth & JWT

E-commerce auth needs to support three flows: email/password, phone OTP, and social login. All three converge on a single `User` row and issue the same JWT pair.

## When this skill applies

- Adding `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- Wiring social login (Google, Facebook, Apple) callbacks.
- Building `get_current_user` and role-based dependencies.
- Password reset, email verification, phone OTP.

For Pydantic schemas of the request/response bodies, see `pydantic-schemas`.

## Token model

| Token | Lifetime | Where it lives | Purpose |
| --- | --- | --- | --- |
| Access | 15 min | `Authorization: Bearer ...` header | Authorize API calls |
| Refresh | 30 days | HttpOnly Secure SameSite=Lax cookie | Get a new access token |

Refresh tokens are **opaque random strings** persisted in DB (one row per session) — not signed JWTs. This lets you revoke them on logout. Access tokens are short-lived JWTs (HS256 with a 32+ byte secret, or RS256 if you anticipate multi-service verification).

## Password hashing

Use `argon2-cffi` (preferred) or `bcrypt` via `passlib`. Never store plaintext, never use SHA-256/MD5.

```python
from argon2 import PasswordHasher
ph = PasswordHasher()

def hash_password(plain: str) -> str:
    return ph.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    try:
        ph.verify(hashed, plain)
        return True
    except Exception:
        return False
```

Re-hash on login if the cost params have changed (`ph.check_needs_rehash`).

## JWT helpers

```python
import jwt, time, uuid
from app.core.config import settings

def make_access_token(user_id: str, role: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + 15 * 60,
        "jti": str(uuid.uuid4()),
        "iss": "temu-clone",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
```

Always set `iat`, `exp`, `iss`. Use `jti` so individual tokens can be revoked via a denylist if needed.

## `get_current_user` dependency

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: DbSession = ...,
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]
```

Optional variant for endpoints that work logged-out: return `None` instead of raising.

## Role / permission gating

```python
def require_role(role: str):
    async def _dep(user: CurrentUser) -> User:
        if user.role != role and user.role != "admin":
            raise HTTPException(403, "Forbidden")
        return user
    return _dep

# usage
@router.post("/admin/products", dependencies=[Depends(require_role("seller"))])
```

## Refresh flow

```
POST /auth/login
  → body: { email, password }
  → response: { accessToken }
  → Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/auth

POST /auth/refresh
  → reads refresh_token cookie
  → looks up Session row, verifies not revoked, not expired
  → rotates: revokes old, issues new refresh + new access
  → returns { accessToken } and a new Set-Cookie
```

Rotation matters: if a refresh is used twice, treat it as a stolen token and revoke the entire session chain.

## Social login (OAuth)

Use `authlib` for Google/Facebook, `python-jose` for Apple ID token verification. Flow:

1. `GET /auth/google/start` → redirects to Google with `state` (signed, anti-CSRF).
2. `GET /auth/google/callback?code=...&state=...` → exchanges code, validates `state`, fetches profile.
3. Find-or-create the `User` row by `email` (with provider linking).
4. Issue access + refresh tokens, redirect to the frontend with the access token in a single-use code (or a one-time hash).

Never log the OAuth `code` or `id_token`.

## OTP / phone login

- Use Twilio Verify (or AWS SNS / SMS API) — don't roll your own SMS.
- Store the verification challenge in Redis with a 5-min TTL: `otp:{phone}` → hashed code.
- Rate limit: 1 send per 60s, 5 per hour per phone.

## Security must-haves

- HTTPS only in production.
- CORS: allowlist your frontend origins explicitly. No `*` with credentials.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` for refresh; access tokens never go in cookies.
- Lock account / require captcha after 5 failed login attempts in 10 min.
- Email verification before allowing checkout (or first-order grace).
- Password requirements: 8+ chars, no other arbitrary rules; check against `haveibeenpwned`'s k-anonymity API on signup.
- Audit log: login success, login fail, password change, role change, refresh-rotation anomalies.

## Common mistakes to flag

- Putting JWT secrets in code or `.env.example` — use a real secrets manager.
- Long-lived access tokens (24h+).
- Refresh tokens as JWTs you can't revoke.
- Forgetting CORS preflight headers when adding a new origin.
- Returning the password hash from `/auth/me`.
- Trusting `email_verified` from any social provider without revalidating.

## Checklist

- Access tokens ≤ 15 min, refresh tokens ≤ 30 days, refresh rotation enabled.
- Passwords stored with argon2/bcrypt, never plaintext.
- `get_current_user` returns 401 with a clear error code, not 500.
- Rate limits on `/auth/login`, `/auth/register`, OTP send.
- Session table exists and is queried on every refresh.
- Logout revokes the current session.
