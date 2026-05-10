---
name: testing-workflows
description: Set up and write tests for both frontend (Vitest/Jest + React Testing Library + Playwright) and backend (pytest + httpx + pytest-asyncio). Covers unit, integration, and end-to-end. Trigger whenever the user mentions tests, testing, pytest, vitest, jest, RTL, react-testing-library, playwright, cypress, e2e, "is this tested", "add tests for", coverage, or "the build is failing".
---

# Testing Workflows

Tests aren't there to hit a coverage number — they're there to let you change code without fear. For an e-commerce app, the priority is the money path: cart → order → payment → fulfillment.

## When this skill applies

Any time you're adding or fixing tests, setting up CI test runs, or designing the test pyramid for a new feature.

## Test pyramid for this project

```
e2e (Playwright)                    ~20 tests, full purchase paths
   ▲
integration (pytest + httpx)        ~150 tests, real DB, real Redis
   ▲
unit (vitest + RTL, pytest)         ~500+ tests, no I/O
```

E2E covers happy paths only. Edge cases live in integration tests, where they're 50× faster.

## Backend — pytest setup

```python
# conftest.py
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import override_db_dependency

@pytest_asyncio.fixture
async def db():
    # Spin up a fresh schema or use a transaction-rollback pattern
    async with TestSessionMaker() as session:
        async with session.begin():
            yield session
            await session.rollback()

@pytest_asyncio.fixture
async def client(db):
    app.dependency_overrides[get_db_session] = lambda: db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

Use **testcontainers** to spin a real Postgres + Redis in CI — sqlite/fakeredis lie about behavior in ways that bite later.

## Backend — what to test

```python
@pytest.mark.asyncio
async def test_place_order_reserves_inventory(client, seed_cart_with_low_stock_item):
    r = await client.post("/orders", json={"cartId": cart.id, ...},
                          headers={"Idempotency-Key": "k1", "Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    # second call with same idem key returns same order, not a new one
    r2 = await client.post("/orders", json={"cartId": cart.id, ...},
                           headers={"Idempotency-Key": "k1", "Authorization": f"Bearer {token}"})
    assert r2.json()["id"] == r.json()["id"]
```

Cover at minimum:
- Idempotency keys collapse duplicate POSTs.
- Order placement reserves inventory.
- Payment-failed webhook releases inventory.
- Auth dependency rejects expired / missing tokens.
- Coupons that don't meet `min_total` are rejected.
- Unhappy paths return your `ApiError` shape, not a stack trace.

Mock external services (Stripe, Twilio, Cloudinary) at the **client boundary**, not in the middle of business logic. `respx` works well for `httpx.AsyncClient`.

## Stripe-specific testing

- Use **Stripe test mode** keys + the [Stripe CLI](https://stripe.com/docs/stripe-cli) (`stripe listen --forward-to localhost:8000/webhooks/stripe`) for local webhook flow.
- Use Stripe's `tok_visa_chargeDeclined` etc. token to test failure paths.
- For unit tests, mock `stripe.PaymentIntent.create` with `respx` — don't hit Stripe.

## Frontend — Vitest + React Testing Library

```ts
// ProductCard.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "./ProductCard";

test("calls onAddToCart with productId when clicked", async () => {
  const user = userEvent.setup();
  const onAdd = vi.fn();
  render(
    <ProductCard productId="p1" title="Hat" priceCents={1999}
      imageUrl="x.jpg" onAddToCart={onAdd} />
  );
  await user.click(screen.getByRole("button", { name: /add to cart/i }));
  expect(onAdd).toHaveBeenCalledWith("p1");
});
```

Rules for RTL:

- Query by **role + accessible name** (`getByRole("button", { name: /place order/i })`).
- Avoid `getByTestId` unless nothing else works.
- Use `userEvent`, not `fireEvent` — it simulates real keyboard/mouse sequencing.
- Mock the network with **MSW** at the request level, not by stubbing fetch.

## E2E with Playwright

A small set of "money path" specs:

```
1. Guest: search → PDP → add to cart → checkout → place order
2. Logged-in: home feed → PDP → variant select → add → coupon → place order
3. Returns: from confirmation → "Return" → submit RMA
4. Mobile (Pixel 5 viewport): repeat path 1
```

Use Stripe's test card `4242 4242 4242 4242` and assert on the order confirmation URL.

```ts
test("guest can complete checkout", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Search").fill("hoodie");
  await page.getByRole("listitem").first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.getByRole("link", { name: /checkout/i }).click();
  // ...fill address, payment, place
  await expect(page).toHaveURL(/\/orders\/.+\/confirmation/);
});
```

## Coverage targets

| Layer | Target | What's not counted |
| --- | --- | --- |
| Backend services + routers | 85% | Generated migrations, scripts |
| Frontend hooks + components | 70% | Storybook, generated types |
| E2E | Path-based, not %-based | — |

Coverage is a smell detector — low coverage in a folder means risk. Don't game it by writing tests that don't actually assert.

## CI integration

- Lint + typecheck + unit tests on every PR.
- Integration tests on PR + merge.
- E2E on merge to main + nightly.
- Block merging on red. No "skip flaky" without an issue.

See `deployment-cicd` for the pipeline structure.

## Common mistakes to flag

- Tests that mock the thing under test.
- `setTimeout`-based waits in RTL — use `findBy*` queries.
- Sharing test DB state across tests (use transactional rollback or truncate).
- Asserting on internal state (Zustand `getState()`) instead of user-visible behavior.
- E2E tests that use real Stripe charges (use test mode!).
- Snapshot tests of huge JSON blobs — they break on every change and nobody reads them.

## Checklist

- New feature ships with: 1+ unit test for the core logic, 1+ integration test for the endpoint or component, optionally an E2E if it touches the money path.
- Every bug fix ships with a regression test.
- CI runs in under 10 minutes for unit + integration.
- Test names read like sentences ("rejects login with expired refresh token").
- No flaky tests — quarantine and fix or delete.
