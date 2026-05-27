---
name: auth-jwt
description: Secure authentication, JWT issuance, and role-based access for this project. Trigger whenever the user mentions login, signup, register, JWT, token, refresh, session, logout, password reset, OTP, role guard, CUSTOMER/SELLER/SELLER_PENDING/ADMIN, RBAC, or "protect this endpoint".
---

# Auth & JWT (python-jose + FastAPI)

This project uses `python-jose[cryptography]` for JWT and `passlib[bcrypt]` for password hashing. There are four roles: `CUSTOMER`, `SELLER_PENDING`, `SELLER`, `ADMIN`. The current `get_current_user` dependency lives in `server/app/modules/user/router.py` (with a parallel copy in `store/router.py` for the seller-pending flow).

## When this skill applies

- Adding or changing register / login / refresh / logout endpoints.
- Adding new role guards or protected endpoints.
- Password hashing, password reset, OTP, or social login.
- Anything touching `get_current_user` or the `User.role` enum.

For DB schema of users/sessions see `postgres-schema`. For consistent error responses see `error-handling`.

## Token strategy

| Token | Lifetime | Where it lives | Purpose |
| --- | --- | --- | --- |
| Access JWT | 15–30 min | `Authorization: Bearer <token>` header | Per-request auth |
| Refresh JWT | 14–30 days | HttpOnly Secure SameSite=Lax cookie | Issuing new access tokens |

Settings live in `server/app/core/config.py` (SECRET_KEY, ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS). `SECRET_KEY` must be required-at-boot with no default — the current default (`"your-super-secret-key-change-it"` in `core/security.py`) is a footgun; see `security-hardening`.

## JWT claims (project convention)

```python
{
  "sub": "<user_uuid>",   # subject = user id
  "role": "CUSTOMER",     # role enum (string)
  "type": "access",       # or "refresh"
  "exp": 1715000000,
  "iat": 1714999100,
  "jti": "<uuid>"         # required for refresh tokens to support revocation
}
```

Always include `type` so a refresh token can never be used as an access token by mistake.

## Password hashing

```python
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(p: str) -> str: return pwd.hash(p)
def verify_password(p: str, h: str) -> bool: return pwd.verify(p, h)
```

- Minimum password length 8, recommended 12. Enforce in the Pydantic schema.
- Never log raw passwords. Never return `password_hash` from any endpoint.
- Migrating to Argon2 later? `passlib` will verify both — set `deprecated="auto"` and re-hash on next successful login.

## Token creation / verification

```python
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

def create_token(*, sub: str, role: str, kind: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "role": role, "type": kind,
               "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
```

Wrap `decode_token` in a function that raises `HTTPException(401, "INVALID_TOKEN")` on `JWTError`.

## get_current_user dependency

The canonical version in `app/modules/user/router.py`:

```python
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(
    token: str = Depends(oauth2),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id = payload["sub"]
    except (JWTError, KeyError):
        raise credentials_exc
    user = db.get(User, user_id)
    if not user:
        raise credentials_exc
    if not user.is_active and user.role != UserRole.ADMIN:
        raise HTTPException(403, "USER_INACTIVE")
    return user
```

> A near-duplicate exists in `store/router.py` to handle the SELLER_PENDING signup flow. If you change one, audit the other.

## Role guards (factory pattern)

```python
def require_role(*allowed: UserRole):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(403, "FORBIDDEN")
        return user
    return dep

# usage
@router.get("/admin/stats")
def stats(_: User = Depends(require_role(UserRole.ADMIN))): ...

@router.post("/products")
def upload(body: ..., user = Depends(require_role(UserRole.SELLER, UserRole.ADMIN))):
    ...
```

Role hierarchy: `ADMIN` implicitly passes any seller check. Bake that into `require_role` rather than enumerating it at every call site.

## Signup → seller flow

1. `POST /auth/register` creates a `CUSTOMER` (with optional `referral_code` to set `referred_by`).
2. `POST /store/apply` flips the user to `SELLER_PENDING` and creates a `Store` row with status `PENDING`.
3. Admin reviews via `/admin/seller-applications` and approves → user becomes `SELLER`, store status becomes `ACTIVE`.
4. SELLER_PENDING can hit `store/*` endpoints but not `seller/*` endpoints — these enforce `SELLER` only.

When introducing new seller endpoints, make sure both `SELLER` and `ADMIN` pass, and that `SELLER_PENDING` is rejected with a clear `403 SELLER_NOT_APPROVED`.

## Refresh + logout

- `POST /auth/refresh` reads the refresh cookie, validates `type == "refresh"` and `jti` not revoked, then issues a new access token (and rotates the refresh token).
- `POST /auth/logout` clears the cookie and adds the `jti` to a revocation set (DB table or Redis). Without this, logout is purely client-side and the refresh token is still valid.

## Cross-cutting hooks

- On successful login, call `quest_services.update_quest_progress(db, user_id, "DAILY_LOGIN")`. This drives the gamification surface.
- On register-with-referral, set `referred_by` and call the referral credit flow (see `app/modules/user/services.py`).

## Common mistakes to flag

- Storing access tokens in `localStorage` — XSS exposes them. Use memory + httpOnly refresh cookie.
- Single-token (no refresh) with multi-hour lifetimes — can't revoke; one stolen token is a multi-hour breach.
- Comparing roles with `==` strings instead of the `UserRole` enum.
- Forgetting the `type` claim — a refresh token then works as an access token.
- Letting the SELLER_PENDING role hit SELLER endpoints "because they're applying" — no, gate it.
- Returning the user object via `User.__dict__` — leaks `password_hash`. Always go through a `UserOut` Pydantic schema.

## Checklist

- Access tokens are short (≤30 min) and never persisted on disk client-side.
- Refresh token is HttpOnly + Secure + SameSite=Lax, rotated on use.
- `get_current_user` rejects inactive non-admin users.
- Role guards use the `require_role` factory, with ADMIN as an implicit superset.
- All password schemas enforce min length and don't log/serialize the raw password.
- New auth endpoints have integration tests covering the happy path AND wrong-role / expired-token cases.
