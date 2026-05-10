# Claude Skills — Temu Clone (React + FastAPI)

This folder contains Claude Code / Cowork skills tailored to a Temu-style e-commerce app
with a React frontend and a FastAPI backend. Each skill is a focused playbook Claude will
load automatically when its triggers match the task you're working on.

## Installation

This folder lives at the project root as `.claude/skills/`:

```
temu_clone/
├── .claude/
│   └── skills/
│       ├── react-component-builder/SKILL.md
│       ├── fastapi-endpoint-builder/SKILL.md
│       └── ... (28 skills)
├── frontend/
└── backend/
```

Once present, Claude reads each `SKILL.md`'s frontmatter (`name`, `description`) and
invokes the skill body when your prompt matches the triggers described in the description.

## What's included (28 skills)

### Frontend (React) — 5
| Skill | Use when |
| --- | --- |
| `react-component-builder` | Creating any React component — cards, modals, forms, layouts |
| `product-discovery-ui` | Home feed, search, filters, PDP, infinite scroll |
| `cart-checkout-ui` | Cart drawer, checkout steps, payment form |
| `gamification-ui` | Spin wheel, daily rewards, mini-games, flash sales, referrals |
| `state-management` | TanStack Query, Zustand, URL state — "where should this live?" |

### Backend (FastAPI) — 5
| Skill | Use when |
| --- | --- |
| `fastapi-endpoint-builder` | Adding routes, routers, middleware, dependencies |
| `auth-jwt` | Login, register, JWT, refresh tokens, social login, OTP |
| `payment-integration` | Stripe / PayPal / Apple Pay, webhooks, refunds, 3DS |
| `order-management` | Order lifecycle, inventory locking, returns, fulfillment |
| `pydantic-schemas` | Request/response models, validation, OpenAPI shapes |

### Database & Infrastructure — 4
| Skill | Use when |
| --- | --- |
| `postgres-schema` | Tables, migrations (Alembic), indexes, FKs |
| `redis-caching` | Cache, rate limit, idempotency, OTP, hot-SKU counters |
| `media-storage` | S3 / Cloudinary uploads, image variants, CDN, video |
| `search-indexing` | Postgres FTS → Meilisearch/OpenSearch, ranking, facets |

### DevOps, Testing & Security — 4
| Skill | Use when |
| --- | --- |
| `testing-workflows` | pytest, Vitest/RTL, Playwright, CI test setup |
| `deployment-cicd` | Dockerfiles, GitHub Actions, environments, releases |
| `security-review` | OWASP Top 10, auth, payments, PII, PCI, secrets |
| `performance-optimization` | Slow endpoints, N+1, LCP/INP, bundle size, capacity |

### Git, PR & LLM Cost — 3
| Skill | Use when |
| --- | --- |
| `git-workflow` | Branching, conventional commits, rebasing, recovery |
| `pr-review-merge` | PR templates, review rubric, merge gates, CODEOWNERS |
| `token-optimizer` | Cut LLM cost — caching, RAG, model selection, structured output |

### Engineering Hygiene — 4
| Skill | Use when |
| --- | --- |
| `code-review` | Reading code thoughtfully — what to flag, how to comment |
| `debugging-workflow` | Reproduce → isolate → hypothesize → test → fix |
| `error-handling` | Typed exceptions, error envelope, retries, timeouts |
| `logging-monitoring` | Structured logs, Sentry, OpenTelemetry, dashboards, SLOs |

### Operator-facing Surfaces — 3
| Skill | Use when |
| --- | --- |
| `admin-seller-portal` | Admin panel, seller portal, RBAC, audit log |
| `notifications-system` | Email, SMS, push, in-app — templates, prefs, deliverability |
| `api-documentation` | OpenAPI, ADRs, READMEs, changelog |

## How Claude uses these

1. You ask Claude to do something (e.g., "add a `/cart/items` endpoint that supports variants").
2. Claude scans the skill descriptions in the frontmatter, sees that
   `fastapi-endpoint-builder`, `pydantic-schemas`, and possibly `redis-caching` apply.
3. Claude reads the SKILL.md bodies for those skills and follows the patterns inside.

## Customizing

Each `SKILL.md` is two parts:

- **YAML frontmatter** at the top — `name` and `description` decide *when* the skill triggers.
  Edit the description to bias toward or away from triggering.
- **Markdown body** — the actual playbook Claude follows. Edit freely to match your
  team's conventions, libraries, or naming.

If you change a stack choice (e.g., switch from Vite to Next.js, or Stripe to Razorpay),
update the relevant skill body so Claude doesn't keep applying the old pattern.

## Adding new skills

Create a new folder with a `SKILL.md` inside:

```
.claude/skills/
└── your-new-skill/
    └── SKILL.md
```

Frontmatter template:

```yaml
---
name: your-new-skill
description: One sentence about what the skill does + the triggers (keywords/phrases)
  that should make Claude pick it up. Be specific — this is the only thing Claude
  sees when deciding whether to load the skill.
---
```

Then write the body the way you'd write a teammate's onboarding doc: principles,
templates, patterns, anti-patterns, and a checklist.

## Suggested order of work

If you're starting the project from scratch, a sane sequence:

1. `git-workflow` + `pr-review-merge` — set the workflow before code lands.
2. `postgres-schema` — lock the data model first.
3. `pydantic-schemas` + `fastapi-endpoint-builder` — basic CRUD on products/users.
4. `auth-jwt` — login/register, gate the rest.
5. `react-component-builder` + `state-management` — frontend skeleton.
6. `product-discovery-ui` — make the catalog browsable.
7. `media-storage` — product images live somewhere.
8. `cart-checkout-ui` + `order-management` — the buying path.
9. `payment-integration` — actually take money.
10. `error-handling` + `logging-monitoring` — wire telemetry early, not at launch.
11. `redis-caching` + `search-indexing` — performance and discovery once it's working.
12. `notifications-system` — order receipts, shipping updates.
13. `admin-seller-portal` — once you have orders to manage.
14. `gamification-ui` — once core retention is solid.
15. `testing-workflows`, `deployment-cicd`, `security-review`, `performance-optimization`,
    `debugging-workflow`, `code-review`, `api-documentation`, `token-optimizer` —
    ongoing, weave in throughout, not at the end.
