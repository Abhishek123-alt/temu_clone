---
name: api-documentation
description: Produce and maintain API documentation — FastAPI's auto OpenAPI, hand-curated reference, runnable examples, internal architecture docs, and a living changelog. Trigger whenever the user mentions docs, documentation, OpenAPI, Swagger, ReDoc, API reference, README, "document the API", changelog, "where do we put this doc", architectural decision record, ADR, or "the next person needs to understand this".
---

# API & Project Documentation

Docs are the project's memory. A team of three with great docs scales further than a team of ten without. The trick is matching each kind of doc to the audience it serves.

## When this skill applies

- Standing up the API reference for the first time.
- Documenting a new endpoint, schema change, or integration.
- Writing an architecture / design doc or ADR.
- Maintaining a changelog or migration guide.
- Onboarding docs for a new contributor.

## The documentation pyramid

```
            ↑ rarely touched
  Vision / Roadmap            (why we're building this)
  Architecture overview       (how the system fits together)
  ADRs                        (decisions and tradeoffs, immutable)
  ─────────────────────
  Service-level READMEs       (how to run / develop / deploy this service)
  Domain reference            (what objects mean: Order, Cart, ...)
  Feature design docs         (how a specific feature works)
  ─────────────────────
  API reference (OpenAPI)     (endpoint shapes — auto-generated)
  Schema reference            (auto-generated from Pydantic models)
            ↓ frequently regenerated
```

Hand-author the top; auto-generate the bottom. If you find yourself hand-maintaining the API reference, you've made a mistake.

## OpenAPI from FastAPI — get this right first

FastAPI generates OpenAPI from your code. Garbage in → garbage out, so:

```python
@router.post(
    "/orders",
    response_model=OrderOut,
    status_code=201,
    responses={
        409: {"model": ErrorResponse, "description": "Item out of stock"},
        422: {"model": ErrorResponse, "description": "Validation failed"},
    },
    summary="Place an order",
    description="""\
Creates an order from the authenticated user's cart, reserves inventory,
and creates a Stripe PaymentIntent. Requires `Idempotency-Key` header to
guard against duplicate charges.

If the PaymentIntent requires action (3DS), the response will include
`clientSecret` and the client should call `stripe.confirmCardPayment`.
""",
    tags=["orders"],
)
async def place_order(...): ...
```

Every endpoint:
- Concrete `response_model`.
- `responses={...}` for documented error codes.
- `summary` (short) and `description` (markdown, can include code samples).
- A `tag` (groups in the docs UI).

Mount Swagger / ReDoc:

```python
app = FastAPI(
    title="Temu-Clone API",
    version="2026.05.07",
    docs_url="/docs",       # gate behind auth or env in prod
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
```

## Examples in OpenAPI

Real, copy-pasteable examples beat any prose:

```python
class OrderCreate(AppBaseModel):
    cart_id: str
    address_id: str
    payment_method_id: str
    coupon_code: str | None = None

    model_config = ConfigDict(json_schema_extra={
        "examples": [{
            "cartId": "cart_01H...",
            "addressId": "addr_01H...",
            "paymentMethodId": "pm_1Nq...",
            "couponCode": "SAVE10"
        }]
    })
```

Examples appear in Swagger and feed codegen tools.

## Hand-curated guides

OpenAPI tells you *what* an endpoint accepts; guides tell you *how* to use the platform. Keep these short, task-oriented:

```
docs/
├── README.md               # entrypoint: "what is this, where to start"
├── architecture.md         # diagrams + module map
├── runbook.md              # how to run / deploy / debug
├── data-model.md           # entities and their relationships
├── auth.md                 # how to authenticate as a client
├── orders.md               # the order flow end-to-end
├── payments.md             # Stripe integration, webhooks, refunds
├── rate-limits.md
├── error-codes.md          # canonical list of `code` values
├── changelog.md
└── adr/
    ├── 0001-trunk-based.md
    ├── 0002-stripe-elements.md
    └── 0003-redis-for-hot-skus.md
```

Each file ≤ 200 lines. Long docs don't get read.

## Architecture Decision Records (ADRs)

When you make a hard call (database choice, auth model, build vs buy), record it:

```markdown
# 0003 — Use Redis counters for hot-SKU inventory during flash sales

Status: accepted
Date: 2026-04-12
Authors: @gaurang, @abhishek

## Context
Postgres row-level locking on `inventory` falls over at >300 RPS per SKU
during flash sales (observed during the 2026-03-20 dry-run).

## Decision
For SKUs flagged "hot", inventory lives in a Redis integer counter. The
canonical row is reconciled every 30s and at sale end.

## Consequences
+ Handles 5k+ RPS per SKU.
+ Complexity: dual source of truth, reconciliation logic.
- Risk: Redis loss = inventory drift; mitigated by AOF + reconciliation.

## Alternatives considered
- Sharding the inventory table by variant_id (deferred, more invasive).
- Outsourcing flash sales to a third-party (rejected: cost + lock-in).
```

ADRs are immutable. If a decision is reversed, write a new ADR that supersedes the old one.

## API examples + clients

Provide:

- `curl` examples in the docs.
- An auto-generated SDK (TypeScript via `openapi-typescript-codegen` or `orval`).
- A Postman / Bruno collection for manual exploration.

Generate, don't hand-write.

## Changelog

Use `release-please` or `git-cliff` to generate a CHANGELOG.md from Conventional Commits:

```markdown
## [1.4.0] — 2026-05-07
### Features
- (cart) apply server-computed totals on coupon change
### Fixes
- (payment) require Idempotency-Key on POST /orders
### Breaking changes
- requests without Idempotency-Key now return 400
```

Each release is a tag, each tag has a CHANGELOG entry. Customers and integrators read this.

## Onboarding doc

Top-of-repo `README.md` answers, in order:

1. What is this? (1 sentence)
2. How do I run it locally? (5 commands max)
3. How is the code organized? (1 paragraph)
4. Where do I look next? (links to deeper docs)

If a new hire needs more than a day to get a working dev env, the README is the bug.

## Internal vs. external docs

If you publish a public API later:

- External docs are a different audience: stable URLs, examples in 3+ languages, SLA, deprecation policy.
- Don't expose internal endpoints publicly. Mark internal-only endpoints with a tag and exclude them from the published spec.

## Common mistakes to flag

- README says "TODO" or hasn't been updated in 6 months.
- API docs auto-generated but every endpoint has empty `description`.
- Hand-curated `endpoints.md` that drifts from the actual code.
- ADRs that read like marketing ("we chose the best technology") instead of trade-off analyses.
- Architecture diagrams in proprietary tools (Lucid, OmniGraffle) not in the repo — bake them into PNG/SVG and commit.
- "Documentation tax" — long approval flows for doc PRs deter people from writing them.
- Multiple sources of truth for the same fact (the auth doc says one thing, the code does another).

## Checklist

- OpenAPI spec is generated from code, hosted at `/docs` (gated in prod).
- Every endpoint has `summary`, `description`, `response_model`, documented error responses.
- Top-level README runs in under 10 minutes.
- ADR exists for any non-obvious choice (DB, auth, payment, deployment).
- CHANGELOG generated from Conventional Commits.
- Diagrams committed as images in `docs/`, source files alongside.
- Internal vs. external docs separated when there's a public API.
