# Claude Skills — Temu Clone (React 19 + FastAPI)

Project-specific Claude Code skills for a Temu-style e-commerce marketplace. Each skill is a focused playbook Claude auto-loads when its description matches the task at hand. Skills here describe **how this project does things**, not generic best practices — they reference the actual file layout, library choices, and conventions in this repo.

## Tech stack the skills are calibrated for

- **Frontend**: React 19 + Vite + Tailwind CSS, Zustand, TanStack Query, react-router-dom v7, Framer Motion, lucide-react, axios, `@tanstack/react-virtual`, `canvas-confetti`. Pure JSX (no TypeScript).
- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL + `pgvector`, Alembic, `python-jose` JWT, `passlib[bcrypt]`, `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim).
- **Testing**: pytest + SQLite in-memory via `server/conftest.py`.

## Layout

```
.claude/skills/
├── README.md                       (this file)
├── INDEX.md                        (directory + task → skill mapping)
│
├── # Backend
├── api-contract-builder/SKILL.md
├── fastapi-endpoint-builder/SKILL.md
├── auth-jwt/SKILL.md
├── postgres-schema/SKILL.md
├── embeddings-search/SKILL.md
├── order-management/SKILL.md
├── payment-integration/SKILL.md
├── media-storage/SKILL.md
│
├── # Frontend
├── react-component-builder/SKILL.md
├── state-management/SKILL.md
├── product-discovery-ui/SKILL.md
├── cart-checkout-ui/SKILL.md
├── gamification-ui/SKILL.md
├── admin-seller-portal/SKILL.md
│
├── # Cross-cutting
├── error-handling/SKILL.md
├── testing-workflows/SKILL.md
├── deployment-cicd/SKILL.md
├── security-hardening/SKILL.md
├── logging-observability/SKILL.md
├── performance-optimization/SKILL.md
│
└── # Workflow
    ├── git-workflow/SKILL.md
    └── coding-standards/SKILL.md
```

22 skills, grouped into four buckets. Most non-trivial tasks span 2–3 of them.

## How Claude uses these

1. You ask Claude to do something (e.g. *"add a coupon endpoint that validates against active campaigns"*).
2. Claude reads the frontmatter description on every `SKILL.md` and picks the ones that match — typically 2–3 per task.
3. Claude then reads the matched bodies and follows the conventions inside.

You can also invoke a skill manually via `/<skill-name>` if you want Claude to apply a specific playbook.

## Customizing

Each `SKILL.md` has two parts:

- **Frontmatter** — `name` and `description`. The description is the trigger; edit it to bias loading.
- **Body** — the actual playbook. Edit freely to match team conventions, new libraries, or renamed paths.

When you change a stack choice (e.g., swap Stripe for Razorpay, or Vite for Next.js), update the relevant skill bodies so Claude stops applying the old pattern.

## Adding new skills

Create a new folder with a `SKILL.md`:

```
.claude/skills/
└── your-new-skill/
    └── SKILL.md
```

Frontmatter template:

```yaml
---
name: your-new-skill
description: One precise sentence covering what the skill does + the trigger phrases that should make Claude pick it up. Specificity wins — vague descriptions trigger too often or not at all.
---
```

Body structure that tends to work:

- **When this skill applies** — explicit list, so Claude doesn't over-trigger.
- **Architecture / conventions** — the patterns used in this project specifically.
- **Code examples** — concrete and matching the actual file paths.
- **Common mistakes to flag** — the failure modes you keep catching in PR review.
- **Checklist** — the "definition of done" for work in this area.

Then add a one-liner to `INDEX.md` so humans can find it too.

## Suggested order of work (greenfield to launch)

1. `git-workflow` + `coding-standards` — set the lane lines before any code lands.
2. `postgres-schema` — lock the data model.
3. `api-contract-builder` + `fastapi-endpoint-builder` — basic CRUD on products / users.
4. `auth-jwt` — login/register, gate everything else.
5. `react-component-builder` + `state-management` — frontend skeleton.
6. `product-discovery-ui` + `embeddings-search` — make the catalog browsable.
7. `media-storage` — product images.
8. `cart-checkout-ui` + `order-management` — the buying path.
9. `payment-integration` — actually take money.
10. `error-handling` + `logging-observability` — wire the envelope, request-IDs, and Sentry end-to-end.
11. `security-hardening` — close OWASP-relevant gaps before any user touches it.
12. `admin-seller-portal` — operate the marketplace.
13. `gamification-ui` — retention surface (quests, flash sales, spin wheel).
14. `performance-optimization` — measure, then trim — bias toward the routes users actually hit.
15. `testing-workflows` + `deployment-cicd` — weave in throughout, not at the end.
