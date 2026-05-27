---
name: deployment-cicd
description: Containerize and ship this React + FastAPI app — Dockerfiles, docker-compose for local Postgres+pgvector, GitHub Actions for lint/test/build, environment management, and prod deploy patterns. Trigger whenever the user mentions Docker, Dockerfile, docker-compose, CI, CD, GitHub Actions, deploy, release, env vars, secrets, staging, prod, or "ship it".
---

# Deployment & CI/CD

This app has a Vite SPA client and a FastAPI server backed by Postgres+pgvector. Production setup is: build the React bundle, serve it from any static host (Vercel/Netlify/CF Pages/S3+CF), and run the FastAPI image behind an ASGI server (uvicorn) with Postgres managed externally (RDS/Neon/Supabase).

## When this skill applies

- Writing or updating `Dockerfile` for client/server.
- Setting up `docker-compose.yml` for local dev (Postgres + pgvector + server + worker).
- GitHub Actions workflows (lint, test, build, deploy).
- Environment variable handling and secret rotation.
- Migrations in a deploy pipeline.

## Server Dockerfile (FastAPI)

```dockerfile
# server/Dockerfile
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl && rm -rf /var/lib/apt/lists/*

# pre-download the sentence-transformers model into the image so cold-start is fast
COPY requirements.txt ./
RUN pip install -r requirements.txt
RUN python -c "from sentence_transformers import SentenceTransformer; \
              SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY . .
ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

Notes:

- Pre-downloading the model bakes ~80MB into the image but saves 5–10s on first request after deploy.
- `--proxy-headers` so FastAPI trusts `X-Forwarded-*` from the load balancer.
- Multi-stage build for prod: split builder + runtime if you want to drop `build-essential`.
- Pin Python (3.12) and the model snapshot — "latest" is a recipe for surprise diffs.

## Client Dockerfile (Vite SPA)

```dockerfile
# client/Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

`VITE_*` env vars are baked at build time, not runtime. If you need runtime config, generate a small `/config.js` at container start.

Most teams skip this and ship the React bundle to a CDN (Vercel/Netlify/Cloudflare Pages) — no nginx, no docker, faster.

## docker-compose for local dev

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: temu
      POSTGRES_PASSWORD: temu
      POSTGRES_DB: temu
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temu"]
      interval: 5s
      timeout: 5s
      retries: 10

  server:
    build: ./server
    depends_on:
      db: {condition: service_healthy}
    environment:
      DATABASE_URL: postgresql://temu:temu@db:5432/temu
      SECRET_KEY: dev-only-do-not-use-in-prod
    ports: ["8000:8000"]
    command: >
      bash -c "alembic upgrade head &&
               uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    volumes: ["./server:/app"]

  worker:
    build: ./server
    depends_on:
      db: {condition: service_healthy}
    environment:
      DATABASE_URL: postgresql://temu:temu@db:5432/temu
    command: python -m app.modules.order.worker
    volumes: ["./server:/app"]

volumes:
  pgdata:
```

`pgvector/pgvector` image ships with the extension preinstalled. Don't build your own — that path leads to "extension not found" pain.

## GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      db:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_USER: temu, POSTGRES_PASSWORD: temu, POSTGRES_DB: temu }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U temu" --health-interval 5s
          --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip, cache-dependency-path: server/requirements.txt }
      - run: pip install -r server/requirements.txt
      - run: cd server && alembic upgrade head
        env: { DATABASE_URL: postgresql://temu:temu@localhost:5432/temu }
      - run: pytest server/app/modules -q
        env: { DATABASE_URL: postgresql://temu:temu@localhost:5432/temu, SECRET_KEY: ci-secret }

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: client/package-lock.json }
      - run: cd client && npm ci
      - run: cd client && npm run lint
      - run: cd client && npm run build
```

Use `pgvector/pgvector` in CI too — your tests should hit real PG for any pgvector-touching code (not the SQLite shortcut).

## Migrations in deploy

Run migrations **before** rolling new pods, not after. Two patterns:

1. **Job step**: a pre-deploy job runs `alembic upgrade head` against prod DB, then deploy proceeds only on success.
2. **Init container**: in K8s, an init container runs the upgrade before the app container starts. Risk: rolling deploy with N pods → N init containers race. Use a `helm` hook or `argo` pre-sync instead.

Migrations must be **backward-compatible** with the still-running old version (zero-downtime). If a column is being dropped:
- Release N: stop writing to it.
- Release N+1: deploy + run migration to drop.

See `postgres-schema` for the multi-phase pattern.

## Env vars and secrets

- `.env.example` checked in with every var listed (empty values). `.env` is gitignored.
- Prod secrets in the platform's secret manager (Fly secrets, Railway, AWS SSM, Doppler). Never in Docker env files in the repo.
- Distinguish:
  - `SECRET_KEY` — JWT signing. Rotate by deploying two keys (old verify-only) → switching → removing old.
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payment.
  - `DATABASE_URL` — incl. SSL mode in prod.
  - `CORS_ORIGINS` — comma-separated origins.

Rotate on any suspected leak. The cost of rotation is low; the cost of a compromised key is enormous.

## Deploy targets — pragmatic options

| Component | Easy default | Cheap and good |
| --- | --- | --- |
| Client | Vercel / Cloudflare Pages | Same |
| Server | Fly.io / Railway | Render |
| DB | Neon / Supabase (Postgres with pgvector) | Same |
| Worker | Same host as server, separate process type | Same |
| Static media | S3 + CloudFront / Cloudflare R2 | R2 (free egress) |

Avoid running your own VM until you have a real reason — TLS renewal, OS patching, and oncall steal weeks of time.

## Observability

- Logs: stdout JSON, tagged with `request_id`. Aggregator: Logtail / Axiom / Datadog.
- Errors: Sentry (Python + React) with the same `request_id` linking them.
- Metrics: at minimum p95 latency, error rate, RPS per route; add DB pool saturation when you have traffic.
- Uptime: a hit on `/healthz` every 30s from a third party (UptimeRobot, Better Stack).

For the actual structured-logging setup, request-ID middleware, and Sentry init — see `logging-observability`. For secret rotation + CORS + headers in a deployed environment — see `security-hardening`.

## Common mistakes to flag

- "Latest" tags everywhere — irreproducible builds. Pin versions.
- Running `alembic upgrade head` from inside the app container on boot in prod — concurrent pods race.
- `VITE_API_BASE_URL` set as a runtime env var — Vite bakes them at build; this won't work.
- Checking `.env` into git, even as "just dev". One bad rotation later, that key is in `git log` forever.
- Mixing CI artifact env vars and runtime env vars — `SECRET_KEY` should never be a build arg.
- Health check that hits the DB — a 5s DB blip causes a rolling restart cascade. Split `/healthz` (process alive) from `/readyz` (can serve traffic).
- No backups on the DB. Use the host's PITR; verify a restore works *before* you need it.

## Checklist

- Server Dockerfile pre-downloads the embedding model; CMD uses `--proxy-headers`.
- Client builds with the right `VITE_API_BASE_URL` for each environment.
- `docker-compose up` gets a brand-new contributor to a working app in < 5 minutes.
- CI runs lint + tests for both halves on every PR.
- Migrations run pre-deploy; schema changes are backward-compatible.
- Secrets are in a managed store, not in the repo or build args.
- Sentry + uptime monitoring + log aggregation are live.
- DB has automatic backups; restore drill rehearsed at least once.
