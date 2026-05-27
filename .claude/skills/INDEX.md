# Master Skills Index

This index maps the project's directory structure and common tasks to the specialized skills available in `.claude/skills/`. Skills auto-load via the frontmatter `description` — this index is for humans navigating the playbook set.

## Skills inventory (22)

### Backend
| Skill | Owns |
| :--- | :--- |
| [api-contract-builder](./api-contract-builder/SKILL.md) | Pydantic v2 request/response schemas, DTO conventions, error envelope |
| [fastapi-endpoint-builder](./fastapi-endpoint-builder/SKILL.md) | Routers, dependencies, middleware, OpenAPI wiring |
| [auth-jwt](./auth-jwt/SKILL.md) | Login/refresh/JWT, role guards, CUSTOMER/SELLER/ADMIN |
| [postgres-schema](./postgres-schema/SKILL.md) | SQLAlchemy 2.0 models, Alembic migrations, indexes, pgvector |
| [embeddings-search](./embeddings-search/SKILL.md) | sentence-transformers + pgvector hybrid search |
| [order-management](./order-management/SKILL.md) | Order state machine, OrderEvent audit, Outbox + worker |
| [payment-integration](./payment-integration/SKILL.md) | Stripe (default), webhooks, refunds, 3DS, idempotency |
| [media-storage](./media-storage/SKILL.md) | Image uploads, resize, EXIF strip, local → S3 abstraction |

### Frontend
| Skill | Owns |
| :--- | :--- |
| [react-component-builder](./react-component-builder/SKILL.md) | Component shape, Tailwind, Framer Motion, accessibility |
| [state-management](./state-management/SKILL.md) | Zustand vs TanStack Query vs URL vs useState |
| [product-discovery-ui](./product-discovery-ui/SKILL.md) | Feed, search, autocomplete, filters, PDP |
| [cart-checkout-ui](./cart-checkout-ui/SKILL.md) | Cart drawer, checkout flow, Place Order idempotency |
| [gamification-ui](./gamification-ui/SKILL.md) | Spin wheel, quests, flash sales, referrals, confetti |
| [admin-seller-portal](./admin-seller-portal/SKILL.md) | Admin panel, seller portal, RBAC UI, audit log surfaces |

### Cross-cutting
| Skill | Owns |
| :--- | :--- |
| [error-handling](./error-handling/SKILL.md) | Backend exception classes, axios interceptor, error envelope |
| [testing-workflows](./testing-workflows/SKILL.md) | pytest + conftest patterns, Vitest setup for the client |
| [deployment-cicd](./deployment-cicd/SKILL.md) | Dockerfiles, docker-compose, GitHub Actions, env/secrets |
| [security-hardening](./security-hardening/SKILL.md) | JWT secret, CORS, rate limiting, IDOR, upload validation, CSRF, secure headers, audit log |
| [logging-observability](./logging-observability/SKILL.md) | Structured JSON logs, request-ID middleware, Sentry, health/ready, metrics |
| [performance-optimization](./performance-optimization/SKILL.md) | Image lazy-load, code splitting, virtualization, N+1 hunts, HNSW tuning, caching |

### Workflow
| Skill | Owns |
| :--- | :--- |
| [git-workflow](./git-workflow/SKILL.md) | Branch naming, Conventional Commits, PR template, merge strategy, hotfix flow |
| [coding-standards](./coding-standards/SKILL.md) | ESLint/Prettier (client), ruff/black/mypy (server), naming, imports, comments, file-size guardrails |

## Directory → Skill mapping

| Path | Primary skill(s) |
| :--- | :--- |
| `server/app/main.py` | `fastapi-endpoint-builder`, `error-handling`, `logging-observability`, `security-hardening` |
| `server/app/api/v1/api.py` | `fastapi-endpoint-builder` |
| `server/app/core/config.py` | `security-hardening`, `coding-standards` |
| `server/app/core/security.py` | `auth-jwt`, `security-hardening` |
| `server/app/core/logging.py` (new) | `logging-observability` |
| `server/app/core/middleware.py` (new) | `logging-observability`, `security-hardening` |
| `server/app/modules/auth/` | `auth-jwt`, `api-contract-builder`, `security-hardening` |
| `server/app/modules/user/` | `auth-jwt`, `api-contract-builder` |
| `server/app/modules/product/` | `api-contract-builder`, `embeddings-search`, `media-storage`, `performance-optimization` |
| `server/app/modules/cart/` | `api-contract-builder` |
| `server/app/modules/order/` | `order-management`, `payment-integration`, `logging-observability` |
| `server/app/modules/review/` | `api-contract-builder`, `media-storage` |
| `server/app/modules/flash_sale/` | `api-contract-builder`, `gamification-ui` |
| `server/app/modules/quest/` | `api-contract-builder`, `gamification-ui` |
| `server/app/modules/store/` | `auth-jwt`, `admin-seller-portal` |
| `server/app/modules/admin/` | `admin-seller-portal`, `auth-jwt`, `security-hardening` |
| `server/app/core/embeddings.py` | `embeddings-search`, `performance-optimization` |
| `server/migrations/` | `postgres-schema` |
| `server/conftest.py` and `*/tests/` | `testing-workflows` |
| `server/pyproject.toml` (new) | `coding-standards` |
| `client/src/pages/home/`, `pages/product/` | `product-discovery-ui`, `performance-optimization` |
| `client/src/pages/cart/`, `pages/orders/` | `cart-checkout-ui`, `order-management` |
| `client/src/pages/seller/`, `pages/admin/` | `admin-seller-portal` |
| `client/src/components/gamification/` | `gamification-ui` |
| `client/src/components/` (shared) | `react-component-builder` |
| `client/src/store/`, `services/` | `state-management` |
| `client/src/services/api.js` | `error-handling`, `logging-observability` |
| `client/eslint.config.js`, `.prettierrc` | `coding-standards` |
| `client/vite.config.js` | `performance-optimization` |
| `Dockerfile`, `docker-compose.yml`, `.github/workflows/` | `deployment-cicd` |
| `.github/PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`, `CONTRIBUTING.md` | `git-workflow` |
| `.gitignore`, `.editorconfig`, `.pre-commit-config.yaml` | `git-workflow`, `coding-standards` |

## Task → Skill mapping

| When the user asks to... | Use skill |
| :--- | :--- |
| Add a new API endpoint | `fastapi-endpoint-builder` + `api-contract-builder` |
| Add a new domain (table + endpoints) | `postgres-schema` → `api-contract-builder` → `fastapi-endpoint-builder` → `testing-workflows` |
| Change the database schema | `postgres-schema` |
| Improve search relevance | `embeddings-search` |
| Add/fix a checkout step | `cart-checkout-ui` (+ `payment-integration` if money moves) |
| Build a reward / quest UI | `gamification-ui` |
| Build the seller dashboard / admin panel | `admin-seller-portal` |
| Decide where some state should live | `state-management` |
| Add error handling for a new failure mode | `error-handling` |
| Write tests for a service or route | `testing-workflows` |
| Set up Docker, CI, or deploy | `deployment-cicd` |
| Upload product or review images | `media-storage` (+ `security-hardening` for validation) |
| Add a role guard or new role | `auth-jwt` |
| Harden an endpoint or audit for vulnerabilities | `security-hardening` |
| Add request-IDs, structured logs, or Sentry | `logging-observability` |
| Diagnose slow page / slow query / large bundle | `performance-optimization` |
| Name a branch, write a commit message, open a PR | `git-workflow` |
| Set up ESLint/Prettier/ruff/black or rename for consistency | `coding-standards` |

## Activation flow
1. **Identify area** — what files are being touched?
2. **Consult this index** — find the governing skill(s).
3. **Read the SKILL.md** — follow the patterns and the checklist at the bottom.
4. **Look across skills** — most non-trivial tasks span 2–3 skills (e.g., adding a new endpoint touches schema, contract, router, and tests).
