---
name: coding-standards
description: Cross-cutting coding standards for this project — ESLint/Prettier on the React client, ruff/black/isort on the FastAPI server, naming, typing (Pydantic v2, JSDoc-on-JSX), imports, comments, and file-size guardrails. Trigger whenever the user mentions lint, format, prettier, eslint, ruff, black, mypy, naming convention, snake_case, PascalCase, JSDoc, type hints, code style, or "clean this up".
---

# Coding Standards

The client is **pure JSX** (no TypeScript) with a minimal ESLint flat config; the server has **no formatter, no linter, no type checker** configured today. This skill is the source of truth for both — picking conventions that actually fit this stack, and the bootstrap commands when the tooling isn't installed yet.

## When this skill applies

- Adding or changing lint/format/type-check configs (`client/eslint.config.js`, `client/.prettierrc`, `server/pyproject.toml`, `.editorconfig`, `.pre-commit-config.yaml`).
- Naming a new file, component, function, model, or env var.
- Deciding whether to add a comment (almost always: no).
- Reviewing a PR for style consistency.

For per-component patterns (props shape, hooks, animations), see `react-component-builder`. For Pydantic schema patterns specifically, see `api-contract-builder`.

## Frontend (`client/`)

### Tooling baseline

Today: ESLint flat config with `@eslint/js` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. No Prettier. No TypeScript. Pure JSX.

Recommended additions (bootstrap once):

```bash
cd client
npm i -D prettier eslint-config-prettier eslint-plugin-jsx-a11y eslint-plugin-import
```

```js
// client/eslint.config.js — extend the existing flat config
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  reactHooks.configs["recommended-latest"],
  reactRefresh.configs.vite,
  jsxA11y.flatConfigs.recommended,
  importPlugin.flatConfigs.recommended,
  prettier,  // must be last — disables formatting rules ESLint shouldn't own
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "import/order": ["error", {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc" }
      }],
    },
  },
];
```

```json
// client/.prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Naming

| Thing | Convention | Example |
| :-- | :-- | :-- |
| Components | PascalCase, one per file, named export of default | `ProductCard.jsx` |
| Hooks | `use` prefix, camelCase | `useCartTotals.js` |
| Files for non-components | kebab-case | `format-currency.js` |
| Stores (Zustand) | camelCase with `Store` suffix | `authStore.js` |
| Services (axios) | camelCase with `Service` suffix | `productService.js` |
| Booleans | `is/has/can/should` prefix | `isOpen`, `hasDiscount` |
| Handlers | `handle<Event>` (component-local), `on<Event>` (prop) | `handleClick`, `onSubmit` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| CSS class merging | use `clsx` + `twMerge` (already in deps) | `cn(base, isActive && "ring-2")` |

### File structure

- One component per file. Co-locate trivial sub-components only if they're not reused.
- Component file ≤ 250 lines. Above that, extract sub-components or a custom hook.
- Folder layout already in `client/src/components/{layout,common,products,marketing,gamification,reviews,profile,seller}`. Add new components into the matching domain folder, not a flat dump.

### Imports

```js
// 1. External
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// 2. Internal aliases (use @/ from vite.config.js if configured, otherwise relative)
import { useAuthStore } from "@/store/authStore";
import { productService } from "@/services/productService";

// 3. Relative
import ProductCardSkeleton from "./ProductCardSkeleton";
import "./styles.css";  // side-effect imports last
```

`eslint-plugin-import`'s `import/order` rule (configured above) enforces this automatically.

### Types without TypeScript

Pure JSX means **no enforced types** — to compensate, use JSDoc on exported APIs only (services, stores, complex hooks). Don't JSDoc trivial components.

```js
/**
 * Place an order from the current cart.
 * @param {{ idempotencyKey: string, addressId: string }} args
 * @returns {Promise<{ id: string, status: string }>}
 */
export async function placeOrder({ idempotencyKey, addressId }) { ... }
```

If types become load-bearing, migrate to TypeScript — don't accrete JSDoc into a parallel type system.

### React rules of thumb

- Functional components only. No class components.
- Hooks at the top of the body, never in conditionals or loops.
- Lift state up; don't sync two `useState` to each other with `useEffect` (use a derived value or move state up).
- `useEffect` runs **side effects**. Computations belong in render or `useMemo`.
- Prefer URL state (`useSearchParams`) for filters/sort over local state — sharable links matter.
- Keys on lists are stable IDs (`product.id`), never the array index, never `Math.random()`.

See `state-management` for where state should live (Zustand vs. TanStack Query vs. URL vs. local).

### Tailwind

- Class lists ordered: layout → box (size/padding/margin) → typography → color → state/variants. Prettier's `prettier-plugin-tailwindcss` (optional) can enforce this.
- Use `cn()` (clsx + twMerge) for conditional classes. Never string-interpolate Tailwind class names — the JIT won't see them.

## Backend (`server/`)

### Tooling baseline

Today: no `pyproject.toml`, no `ruff`, no `black`, no `mypy`, no `pre-commit`. Adopt them in one PR; mass-format once.

```bash
cd server
pip install ruff black mypy pre-commit
```

```toml
# server/pyproject.toml — create this file
[tool.black]
line-length = 100
target-version = ["py311"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = [
  "E", "F", "W",  # pycodestyle / pyflakes
  "I",            # isort (import order)
  "B",            # bugbear
  "UP",           # pyupgrade
  "S",            # bandit (security)
  "SIM",          # simplify
  "RUF",          # ruff-specific
]
ignore = [
  "E501",   # line length — black owns this
  "S101",   # asserts in tests are fine
]

[tool.ruff.lint.per-file-ignores]
"**/tests/*" = ["S101", "S105", "S106"]   # asserts + hardcoded test secrets OK

[tool.mypy]
python_version = "3.11"
strict = false   # incremental adoption — start lenient
ignore_missing_imports = true
plugins = ["pydantic.mypy"]
```

```yaml
# .pre-commit-config.yaml — repo root
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks: [{ id: ruff, args: [--fix] }, { id: ruff-format }]
  - repo: https://github.com/psf/black
    rev: 24.8.0
    hooks: [{ id: black }]
```

Then `pre-commit install` once per clone.

Add `ruff`, `black` (and optionally `mypy`) to a `server/requirements-dev.txt` so CI installs them; keep them out of `requirements.txt` to avoid bloating prod images.

### Naming

| Thing | Convention | Example |
| :-- | :-- | :-- |
| Modules / files | snake_case | `order_services.py` |
| Functions, vars | snake_case | `reserve_stock`, `current_user` |
| Classes (SQLAlchemy, Pydantic, exceptions) | PascalCase | `OrderItem`, `OrderCreate`, `InsufficientStockError` |
| Constants | SCREAMING_SNAKE_CASE | `ACCESS_TOKEN_EXPIRE_MINUTES` |
| Pydantic schemas | suffix `In` (request), `Out` (response), `Create`, `Update` | `ProductCreate`, `ProductOut` |
| Enums | PascalCase class, SCREAMING_SNAKE_CASE values | `OrderStatus.PAID` |
| Test files | `test_<thing>.py`; tests `test_<behavior>` | `test_place_order_reserves_stock` |
| Migrations | descriptive verb_subject | `add_hnsw_index_to_product_embeddings` |
| Env vars | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `STRIPE_SECRET_KEY` |

### Module layout (already in use — keep it)

Each domain in `server/app/modules/<domain>/` has:

```
models.py       # SQLAlchemy ORM
schemas.py      # Pydantic v2 request/response
router.py       # FastAPI routes — thin, delegates to services
services.py     # business logic — pure functions taking db: Session
tests/
  test_<domain>_services.py
  test_<domain>_router.py    # if needed
```

Router handlers should be ≤ 15 lines: parse → call service → return. All logic lives in `services.py`.

### Type hints

- All function signatures typed. Internal helpers may skip return type if obvious.
- Use modern syntax: `list[int]`, `dict[str, Any]`, `str | None` — not `List`, `Dict`, `Optional`.
- Pydantic v2: prefer `model_config = ConfigDict(...)` over `class Config:`. Use `Field(...)` for constraints, not validators when a constraint expresses it.

```python
from pydantic import BaseModel, ConfigDict, Field

class ProductCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    price_cents: int = Field(ge=0)
    description: str | None = None
```

### Imports (ruff/isort enforces)

```python
# 1. Standard library
from datetime import datetime, timedelta
from uuid import UUID

# 2. Third party
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

# 3. Local
from app.db.session import get_db
from app.modules.user.router import get_current_user
from . import schemas, services
```

### SQLAlchemy 2.0 style

- Use `Mapped[]` + `mapped_column(...)` (2.0 style), not the legacy `Column(...)` form, when adding new models.
- Eager load relationships with `selectinload()` / `joinedload()` at the query site — never rely on lazy access (causes N+1, see `performance-optimization`).
- Filter through `.where(...)` and `.scalars()`, not the legacy `Query` API.

### Function & file size

- Service functions ≤ 50 lines. If longer, decompose by extracting helpers — usually a "validate", "compute", "persist" trio falls out.
- Files ≤ 400 lines. `services.py` growing past that means the module should split into `services/` package.

## Comments

Default: **no comment**. Add one only when the *why* is non-obvious to a future reader.

| Write a comment | Don't write a comment |
| :-- | :-- |
| A workaround for a specific bug or library quirk | Restating what the code does |
| A non-obvious business rule ("`SELLER_PENDING` skipped on purpose — admin must approve first") | "// increment the counter" |
| A hidden constraint enforced elsewhere | "// TODO: refactor later" with no ticket |
| A perf reason (`# avoid N+1: explicit selectinload`) | History or git-blame info (use `git log`) |

No multi-paragraph docstrings on internal functions. Module-level `"""..."""` is fine if it summarises the module's responsibility.

## Secrets, config, env vars

- All runtime config goes through `pydantic-settings` in `server/app/core/config.py`. No `os.getenv(...)` scattered through services.
- `.env` files are gitignored — verify before every PR.
- Required-at-boot secrets (`SECRET_KEY`, `DATABASE_URL`) raise on missing — don't accept silent defaults like `"your-super-secret-key-change-it"` (see `security-hardening`).

## Common mistakes to flag

- Mixing tabs and spaces in Python — ruff/black flags this; never override.
- A 600-line `router.py` doing business logic inline — move to `services.py`.
- `print(...)` left in committed code — use logging (`logging-observability`).
- `# type: ignore` without a comment explaining why.
- Adding `Optional[str]` instead of `str | None` in new code.
- Backend module imports from a router instead of a service (creates circular imports under FastAPI's dependency injection).
- Tailwind class strings built with template literals (`` `bg-${color}-500` ``) — JIT can't see them, classes silently missing in prod.
- JSDoc on every trivial component — adds noise without enforcement.
- Renaming an env var without updating `config.py`, the `.env.example`, and every deploy target.

## Checklist

- Lint passes: `cd client && npm run lint` and `cd server && ruff check . && black --check .`.
- No secrets, generated files, or large binaries in the diff.
- New files follow the naming table for their language.
- Imports grouped + ordered (ESLint or ruff enforces).
- Comments earn their keep — each one says *why*, not *what*.
- Functions ≤ 50 lines, files ≤ 400 lines, components ≤ 250 lines (rough guides, not hard rules).
- Public services have JSDoc / type hints; internal helpers may skip them.
- `.env.example` updated when adding a new env var.
