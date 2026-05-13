---
name: auth-jwt
description: Secure authentication and session management using JWT.
metadata:
  type: professional-standard
---

# Auth & JWT Standard
- Implement short-lived access tokens and long-lived refresh tokens.
- Store refresh tokens in secure, HttpOnly, SameSite=Strict cookies.
- Use strong hashing (e.g., Argon2 or bcrypt) for passwords.
- Implement RBAC (Role-Based Access Control) for Admin/Seller/User roles.
- Ensure all sensitive API endpoints are protected by JWT middleware.
- Provide a clear "Logout" mechanism that invalidates tokens.
