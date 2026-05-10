---
name: deployment-cicd
description: Containerize, build, and deploy the React frontend and FastAPI backend — Dockerfiles, GitHub Actions, environment management, blue-green / canary releases, infrastructure as code, and observability hooks. Trigger whenever the user mentions Docker, Dockerfile, docker-compose, GitHub Actions, CI, CD, pipeline, deploy, deployment, Kubernetes, Helm, Terraform, AWS/GCP/Vercel, env vars, secrets, "ship to prod", or "set up the build".
---

# Deployment & CI/CD

Shipping fast and safely is a separate skill from writing the code. Standardize the pipeline once and the team stops debating it on every PR.

## When this skill applies

- Writing or updating Dockerfiles, compose files, or Kubernetes manifests.
- Building or fixing the GitHub Actions pipeline.
- Setting up environments (dev, staging, prod) and managing secrets.
- Designing the release process (canary, blue-green, feature flags).

## Reference architecture (lean MVP)

```
Frontend (React/Next):   Vercel  or  CloudFront + S3
Backend (FastAPI):       Fly.io / Render / ECS Fargate / GKE
DB:                      RDS / Cloud SQL / Neon Postgres
Cache:                   Upstash Redis / ElastiCache
Object storage / CDN:    Cloudinary or S3 + CloudFront
Search:                  Meilisearch Cloud or OpenSearch
Observability:           Sentry + Better Stack / Datadog
```

Pick one cloud and stay there until you have a real reason to spread.

## Backend Dockerfile (FastAPI, multi-stage)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS builder
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONDONTWRITEBYTECODE=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock* ./
RUN pip install uv && uv sync --frozen --no-dev

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
RUN groupadd -r app && useradd -r -g app app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app
COPY alembic.ini ./
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

Run **gunicorn + uvicorn workers** in production for proper process management:

```
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000 \
  --timeout 30 --graceful-timeout 30 --keep-alive 5
```

## Frontend Dockerfile (Vite SPA)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
```

If using Next.js, deploy via Vercel or use the official `node:20-alpine` runtime image — don't put Next.js behind plain nginx.

## docker-compose for local dev

```yaml
services:
  api:
    build: ./backend
    env_file: backend/.env.local
    depends_on: [db, redis, search]
    ports: ["8000:8000"]
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: temu_dev
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports: ["6379:6379"]
  search:
    image: getmeili/meilisearch:v1.10
    environment:
      MEILI_MASTER_KEY: dev_master
    ports: ["7700:7700"]
volumes:
  pgdata:
```

## GitHub Actions pipeline

```yaml
name: ci

on: [pull_request, push]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: pw, POSTGRES_DB: test }
        options: --health-cmd "pg_isready -U postgres"
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync
      - run: uv run ruff check
      - run: uv run mypy app
      - run: uv run pytest -q
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:pw@localhost/test
          REDIS_URL: redis://localhost:6379/0
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
  e2e:
    needs: [backend, frontend]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # ...spin docker-compose, run playwright
```

## Environments & secrets

Three environments: `dev` (local), `staging` (auto-deploy from `main`), `prod` (manual approval). Each has its own secret set.

- Use the platform's secret manager (GitHub Encrypted Secrets for CI; AWS Secrets Manager / Doppler / 1Password Secrets Automation for runtime).
- Never commit `.env` files. `.env.example` lists every var with placeholder.
- `pydantic-settings` on the backend reads from env. Fail fast if a required var is missing.

## Migrations on deploy

Run Alembic in a one-shot job/task **before** rolling new pods, not in the API container's startup. This avoids racing between two pods migrating simultaneously and lets failed migrations block the deploy.

```
1. Build new image
2. Run `alembic upgrade head` (one-shot job)
3. If success → roll new image (rolling, blue-green, or canary)
4. If failure → keep old image, alert, page on-call
```

## Release strategies

- **Rolling**: default; fine for small changes.
- **Blue-green**: keep old version warm, flip the LB after smoke. Fast rollback.
- **Canary**: route 5% → 25% → 100%. Gate progression on error rate / latency. Best for risky changes.
- **Feature flags**: ship code dark. Use a flag service (Unleash, Flagsmith, LaunchDarkly) for gradual rollouts of UI/business changes.

## Observability hooks

Every service should emit:

- **Logs** — JSON, correlated by `request_id` (middleware adds one if missing).
- **Metrics** — request rate, error rate, latency p50/p95/p99 per endpoint; DB pool stats.
- **Traces** — OpenTelemetry instrumentation on FastAPI, SQLAlchemy, Redis, httpx.
- **Sentry** for errors with release tagging (commit SHA).
- **Health checks**: `/healthz` (process alive) + `/readyz` (DB + Redis reachable).

## Common mistakes to flag

- One image used as both API and worker — separate Dockerfiles or different `CMD`s.
- Migrations in the API entrypoint (race + slow boot).
- Storing secrets in env vars committed to a repo, even encrypted.
- Same Sentry DSN across environments — you'll lose your mind.
- No staging environment (= prod is your staging).
- 99.9% uptime claim with a single replica.

## Checklist

- Backend has a multi-stage Dockerfile under 500 MB.
- CI: lint, typecheck, unit, integration, build artifact.
- Migrations run pre-deploy as a separate step.
- Each env has its own secret store.
- Health and readiness probes implemented.
- Sentry + structured JSON logs + traces wired up.
- Rollback playbook documented (one command, < 5 minutes).
