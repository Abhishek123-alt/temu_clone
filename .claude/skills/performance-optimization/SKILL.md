---
name: performance-optimization
description: Hunt and fix performance issues across the stack — slow API endpoints, N+1 queries, slow Postgres queries, large React bundles, slow LCP, memory leaks, blocking event-loop calls in FastAPI. Trigger whenever the user mentions performance, slow, latency, p95, p99, "feels laggy", "the page takes forever", LCP, INP, bundle size, N+1, query plan, EXPLAIN, cache hit rate, or profiling.
---

# Performance Optimization

Performance work is detective work — measure first, change second. Every optimization without a baseline is folklore.

## When this skill applies

- Diagnosing a slow endpoint, page, or query.
- Cutting bundle size or improving Core Web Vitals.
- Reviewing a feature for performance before it ships.
- Capacity planning for a flash sale.

## The order of operations

1. **Define a target.** "p95 latency under 200ms for `/products`" beats "make it faster".
2. **Measure the baseline.** APM / curl timing / Lighthouse / DB stats — whatever the surface is.
3. **Find the hot spot.** Use a profiler or query log; don't guess.
4. **Fix the biggest thing.** Pareto applies aggressively.
5. **Re-measure.** Confirm the change moved the needle in real conditions.

If you skip step 2 you'll spend a week optimizing something that wasn't the bottleneck.

## Backend: where time goes

```
[client] → load balancer → app worker → DB / Redis / 3rd-party HTTP → app worker → [client]
```

Common culprits:

- **N+1 queries**: a list endpoint loops over rows and fetches related data per row. Fix with `selectinload` / `joinedload` (SQLAlchemy) or a single query.
- **Sync calls in async handlers**: `requests.get(...)`, `time.sleep(...)`, sync `boto3` — block the entire event loop. Move to `httpx.AsyncClient`, `asyncio.sleep`, `aioboto3`.
- **Missing indexes**: `EXPLAIN (ANALYZE, BUFFERS)` shows seq scans. Add the index, re-run, verify it's used.
- **Cold cache**: hot endpoints aren't cached. See `redis-caching`.
- **Slow third-party**: Stripe, Twilio, carriers. Wrap with timeouts (3s default), circuit-break, fall back gracefully.

### Postgres tactics

```sql
-- find slow queries
SELECT calls, mean_exec_time, total_exec_time, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 25;

-- explain a real query
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... ;
```

Patterns:

- Cursor pagination, not OFFSET, on big tables.
- Composite indexes match the WHERE+ORDER BY shape: `(user_id, placed_at DESC)`.
- `pg_stat_statements` shows the top offenders in real traffic.
- For analytics, run a read replica or duplicate to a warehouse — don't ship `GROUP BY` over `orders` from the API.

### FastAPI tactics

- One async DB pool, sized for your worker count (e.g., `pool_size=10, max_overflow=20`).
- `gzip` middleware on the API.
- HTTP keep-alive on outbound clients: reuse a single `httpx.AsyncClient`, don't create per-call.
- Don't `json.dumps(big_dict)` in a hot path — Pydantic v2's `model_dump_json` is fast; use it.

## Frontend: Core Web Vitals

Targets (mobile, mid-tier device, 4G):

| Metric | Good | What it measures |
| --- | --- | --- |
| LCP | < 2.5s | Largest content paint (often the hero image) |
| INP | < 200ms | Responsiveness to interactions |
| CLS | < 0.1 | Visual stability (no layout shift) |

### LCP wins

- Preload the LCP image (`<link rel="preload" as="image" href="..." imagesrcset="...">`).
- Modern image formats (`f_auto` → AVIF / WebP).
- Set `width`/`height` (or `aspect-ratio`) so the layout reserves space.
- Inline critical CSS for above-the-fold; defer the rest.
- Minimize render-blocking JS — code-split routes, lazy-load below-the-fold widgets.

### INP wins

- Long tasks (> 50ms) on the main thread block input. Profile with the Performance tab.
- Move heavy work off-main-thread (Web Workers) for things like image processing or large filters.
- Avoid huge re-renders: memoize expensive lists, virtualize feeds (`react-window`, `@tanstack/react-virtual`).
- Debounce expensive on-input handlers.

### Bundle size

- Run `vite build --mode=analyze` (or `next build && next analyze`).
- Cut: moment.js (use `date-fns`), lodash (cherry-pick imports or use `lodash-es`), unused chart libs.
- Code-split: `React.lazy` for routes and any heavy third-party (Stripe Elements should already be lazy via Stripe.js).
- Tree-shake icons (`lucide-react` named imports only).

### Image optimization checklist

- Always responsive `srcset` with at least 3 widths.
- Lazy-load below-the-fold (`loading="lazy"`).
- AVIF/WebP with JPEG fallback via `<picture>`.
- Don't ship 4000×4000 PNGs as 200×200 thumbnails.

## Memory

Backend: monitor RSS per worker. Leaks usually come from:

- Module-level caches that never evict.
- Holding `Session` objects past request scope.
- Long-lived background tasks accumulating refs.

Frontend: leaks usually come from event listeners not removed in `useEffect` cleanup, or huge accumulated arrays in Zustand.

## Capacity for flash sales

Known traffic spike → plan upfront:

- Pre-warm the cache (run a job that fetches the sale's products through the public endpoints).
- Switch hot SKUs to Redis-counter inventory (see `redis-caching`).
- Pre-scale the API pool 30 minutes before kickoff.
- Read-replica the catalog for the product feed.
- Prep a kill-switch for non-essential features (gamification widgets, recommendation calls) so you can shed load.

## Common mistakes to flag

- "It's slow on my machine" — measure on a real device / in production conditions.
- Caching to mask N+1 instead of fixing the query.
- Using `useMemo` everywhere "for performance" without measuring.
- Adding indexes blindly — they cost on writes and can be ignored by the planner.
- Lighthouse scores from desktop, not mobile.

## Checklist for a perf review

- Baseline metric captured (p50, p95, p99 latency or LCP/INP/CLS).
- The slowest 1–3 things identified and prioritized.
- Each fix is measured against the same baseline.
- No regressions introduced (run the relevant tests).
- Document the change so the next person knows why.
