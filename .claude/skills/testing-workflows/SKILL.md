---
name: testing-workflows
description: Set up and write tests for this project — pytest + httpx for the FastAPI backend (SQLite via conftest.py), and unit/integration tests for the React client. Trigger whenever the user mentions test, pytest, fixture, conftest, mock, integration test, e2e, regression, "write a test for X", or "the test is failing".
---

# Testing Workflows

The backend uses **pytest** with SQLite (in-memory) via `server/conftest.py` so suites are fast and isolated. The frontend currently has no formal test runner; when adding, prefer **Vitest + React Testing Library** (Vite-native) over Jest.

## When this skill applies

- Adding tests to `server/app/modules/<domain>/tests/`.
- Writing or fixing fixtures in `server/conftest.py`.
- Setting up Vitest / React Testing Library in `client/`.
- Debugging flaky tests, DB state bleed, or "test passes alone but fails in the suite".

## Backend test layout

```
server/
├── conftest.py                # fixtures: db_session, client, auth headers
└── app/modules/<domain>/tests/
    ├── __init__.py
    ├── test_<domain>_service.py     # unit-style, no HTTP
    └── test_<domain>_api.py         # integration-style, hits TestClient
```

Run patterns:
```
pytest server/app/modules                                # all
pytest server/app/modules/order                          # one module
pytest server/app/modules/order/tests/test_order_service.py::test_place_order_reserves_stock
pytest -k "place_order"                                  # by name fragment
pytest -x --ff                                           # stop on first failure, fail-fast first
```

## conftest.py pattern

```python
# server/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, get_db

@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    return eng

@pytest.fixture
def db_session(engine):
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    s = Session()
    try:
        yield s
    finally:
        s.rollback()
        # truncate all tables to leave a clean state
        for t in reversed(Base.metadata.sorted_tables):
            s.execute(t.delete())
        s.commit()
        s.close()

@pytest.fixture
def client(db_session):
    def override(): yield db_session
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Why this works:

- The engine is session-scoped (one DB), but data is wiped per test — fast and isolated.
- `app.dependency_overrides[get_db]` swaps in the test session so the TestClient and the test code see the same DB.
- `with TestClient(app)` triggers FastAPI startup/shutdown handlers.

## Auth fixtures

```python
@pytest.fixture
def make_user(db_session):
    def _make(role="CUSTOMER", **kw):
        u = User(email=f"u{uuid4().hex}@x.com", password_hash=hash_password("pw"),
                role=role, **kw)
        db_session.add(u); db_session.commit(); db_session.refresh(u)
        return u
    return _make

@pytest.fixture
def auth_headers(make_user):
    def _hdr(role="CUSTOMER"):
        u = make_user(role=role)
        token = create_token(sub=str(u.id), role=role, kind="access", ttl=timedelta(minutes=5))
        return {"Authorization": f"Bearer {token}"}, u
    return _hdr
```

Every protected-endpoint test uses `auth_headers(...)`. Don't hand-craft tokens in each test.

## Service tests vs API tests

- **Service tests** (`test_<domain>_service.py`): call `services.foo(db, ...)` directly, assert on DB state. Fast, easy to write, no HTTP layer noise. Cover business logic edges.
- **API tests** (`test_<domain>_api.py`): call `client.post("/api/v1/...")`, assert on status + JSON shape. Cover the contract (response envelope, status codes, auth gates).

Don't duplicate. If a service test covers a branch, the API test only needs to confirm the route wiring + auth.

## Patterns to use

### State machine tests (orders)

For every transition in the allowed set, write a test. For every disallowed one, write a test that asserts `ConflictError`.

```python
@pytest.mark.parametrize("from_status,to_status,allowed", [
    (PENDING, PAID, True),
    (PENDING, SHIPPED, False),
    (DELIVERED, RETURN_PENDING, True),
    (SHIPPED, CANCELED, False),
])
def test_order_transition(from_status, to_status, allowed, ...):
    ...
```

### Idempotency

`POST /orders` with the same `Idempotency-Key` must return the original order:

```python
def test_place_order_is_idempotent(client, auth_headers):
    h, _ = auth_headers()
    h["Idempotency-Key"] = "fixed-key-1"
    r1 = client.post("/api/v1/orders", json=valid_body, headers=h)
    r2 = client.post("/api/v1/orders", json=valid_body, headers=h)
    assert r1.status_code == 201
    assert r2.json()["id"] == r1.json()["id"]
```

### Concurrency-sensitive paths

For "two carts buying the last unit", a simple test:

```python
def test_place_order_oversells_blocked(db_session, ...):
    variant = make_variant(db_session, stock=1)
    place_order(db_session, user1, cart=[(variant.id, 1)], idem_key="a")
    with pytest.raises(InsufficientStockError):
        place_order(db_session, user2, cart=[(variant.id, 1)], idem_key="b")
```

Real concurrent-transaction tests require Postgres; SQLite is single-writer. Mark them `@pytest.mark.postgres` and skip when not against PG.

## Mocking external services

- **Stripe / payment gateway**: use `pytest-mock` or `monkeypatch` to stub `stripe.PaymentIntent.create`. Don't hit Stripe test mode from unit tests — too slow and flaky.
- **Embeddings**: stub `embed_text` to return a deterministic vector (`[0.0] * 384`). The real model is too slow for unit tests; integration tests on real PG can use it sparingly.
- **Email/SMS**: replace the sender with an in-memory `outbox` list and assert on it.

## SQLite gotchas

- No `pgvector` types — column declarations using `Vector(384)` will fail at table create. Use a dialect variant (see `postgres-schema`) or guard with `if dialect != "sqlite"`.
- No `JSONB` — generic `JSON` works; query operators on JSON are limited.
- No `gen_random_uuid()` — set UUIDs in Python (`default=uuid4`).
- Foreign key enforcement is OFF by default; enable in conftest:
  ```python
  @event.listens_for(engine, "connect")
  def fk_on(conn, _): conn.execute("PRAGMA foreign_keys=ON")
  ```
- Concurrency tests don't translate — use the `@pytest.mark.postgres` marker for those.

## Coverage targets

Aim for **branches** in services that matter (state transitions, auth gates, money math). Don't chase 100% line coverage — getters/setters and Pydantic schemas are noise.

Required coverage areas:

- All order state transitions (allowed + denied).
- Auth: 401 (no token), 403 (wrong role), 200 (right role) per protected route.
- Payment webhook: signature pass + fail, duplicate event de-dup.
- Cart merge on login (guest cart + server cart dedupe by `productId+variantId`).
- Refund flow: full, partial, and "no return — declined".

## Frontend tests (when you add them)

Recommended setup with Vitest:

```bash
cd client && npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```js
// client/vitest.config.js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./src/test/setup.js" },
});
```

Test guidance:

- Use **Testing Library queries that mirror user behavior** (`getByRole("button", { name: /add to cart/i })`), not `getByTestId`.
- Wrap rendered components with the QueryClientProvider in a `renderWithProviders(ui)` helper.
- Mock the `api` axios instance with `vi.mock("@/services/api")` so tests don't actually hit the network.
- For end-to-end, prefer **Playwright** over Cypress (better DX, faster CI).

## Common mistakes to flag

- Sharing a session-scoped `db_session` — tests leak state into each other.
- Calling `db.commit()` in a test and forgetting to wipe — next test sees ghost rows.
- Hitting the real Stripe API in unit tests.
- Loading the real sentence-transformers model in tests (slow boot, OOM in CI).
- `time.sleep(2)` to "wait for the worker" — drive the worker step explicitly instead.
- Assertions only on `response.status_code == 200` with no shape check — contract drift sneaks in.
- Using `pytest.fixture(scope="module")` for DB sessions then mutating state — tests pass alone, fail in suite.

## Checklist

- A new endpoint has both a service test (logic) and an API test (contract + auth).
- Tests don't talk to real external services (mock Stripe, embeddings, email).
- DB state is reset between tests; no order dependency in the suite.
- PG-only behaviors are marked and skipped under SQLite.
- CI runs `pytest server/app/modules` on every PR.
- Failing tests fail fast with a clear diff (use `pytest -vv`).
