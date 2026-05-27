---
name: performance-optimization
description: Front-to-back performance budget and tooling for this project — image lazy-loading, route-level code splitting, virtualized feeds (@tanstack/react-virtual), Vite chunking, React Query cache tuning, SQLAlchemy N+1 hunting, pgvector HNSW tuning, embedding model singleton, cursor pagination. Trigger whenever the user mentions slow, perf, performance, bundle size, LCP, INP, lazy, virtualize, memoize, useMemo, useCallback, code split, N+1, EXPLAIN ANALYZE, index, slow query, HNSW ef_search, cache, Redis, lru_cache, or "this page takes forever".
---

# Performance Optimization

A Temu clone lives or dies on perceived speed — fast feed, fast PDP, fast checkout. This skill is the playbook for finding and fixing perf problems on both sides. Default rule: **measure, then fix**. Don't memoize speculatively, don't add Redis before you've seen the slow query.

## When this skill applies

- Feed scroll is janky, list rendering is slow, or a page takes > 1s to interact with.
- Bundle size has crept up; new dep added.
- An endpoint is slow under load — `EXPLAIN ANALYZE` shows seq scans or nested loops.
- Semantic search is slow / inaccurate at scale (ANN params, index tuning).
- Image-heavy pages (PDP, home feed) are LCP-bound.

For the search-relevance side of the same endpoints, see `embeddings-search`. For DB indexing strategy, see `postgres-schema`. For request-level visibility (where time is spent), see `logging-observability`.

## Known live wins in this repo

Surfaced from the audit — high-leverage, low-risk fixes:

1. **`@tanstack/react-virtual@3.13.x` is installed but never imported.** The home feed and search results are not virtualized. On a 200-product feed this costs ~80ms scroll jank on a mid-tier phone.
2. **No `loading="lazy"` on any `<img>` in client.** Above-the-fold images load synchronously; below-the-fold images load eagerly. Adding `loading="lazy"` is free LCP improvement.
3. **`vite.config.js` has no `build.rollupOptions.output.manualChunks`.** Everything ships in one or two big chunks; route-level splits aren't happening.
4. **No caching layer (`lru_cache`, Redis, etc.).** Category trees, featured-product lists, and HNSW search results are recomputed on every request.
5. **No `selectinload` audit** — a few service queries likely have N+1s (a SELECT per product for variants/images is common).

## Performance budget (target on a mid-tier mobile, 3G fast)

| Metric | Target | Hard ceiling |
| :-- | :-- | :-- |
| LCP (home, PDP) | ≤ 2.0s | 3.0s |
| INP (any interaction) | ≤ 200ms | 500ms |
| First JS chunk (parsed+exec) | ≤ 200KB gz | 350KB gz |
| API p95 latency (read path) | ≤ 150ms | 400ms |
| Search p95 latency | ≤ 250ms | 600ms |
| DB query p95 | ≤ 30ms | 100ms |

Budget is a forcing function. If a PR pushes a metric past the hard ceiling, fix it in the same PR or open a follow-up ticket.

## Frontend

### Lazy-load images

Every `<img>` below the fold gets `loading="lazy"`. Above the fold, set explicit width/height (or use CSS `aspect-ratio`) to reserve layout space — prevents CLS.

```jsx
// client/src/components/products/ProductCard.jsx
<img
  src={product.thumbnail_url}
  alt={product.title}
  width={320} height={320}
  loading="lazy"
  decoding="async"
  className="aspect-square w-full object-cover"
/>
```

For the hero / above-the-fold image on PDP, drop `loading="lazy"` and add `fetchPriority="high"` instead.

### Route-level code splitting

Lazy each top-level route component so the initial bundle ships only the shell + home.

```jsx
// client/src/App.jsx
import { lazy, Suspense } from "react";
const ProductDetailPage = lazy(() => import("./pages/product/ProductDetailPage"));
const SearchPage         = lazy(() => import("./pages/product/SearchPage"));
const CheckoutPage       = lazy(() => import("./pages/cart/CheckoutPage"));
const AdminDashboard     = lazy(() => import("./pages/admin/AdminDashboard"));
const SellerDashboard    = lazy(() => import("./pages/seller/SellerDashboard"));

<Suspense fallback={<PageSkeleton />}>
  <Routes>...</Routes>
</Suspense>
```

Admin and Seller pages especially — most customers never load them.

### Vite chunking

```js
// client/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "@tanstack/react-virtual"],
          motion: ["framer-motion", "canvas-confetti"],
          icons: ["lucide-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
```

Big libs land in their own long-cacheable chunks; product code stays small.

### Virtualize long lists (use what's already installed)

`@tanstack/react-virtual` is in `package.json` but unused. Plug it into the home feed and search results once the list passes ~50 items.

```jsx
// sketch — adapt to your feed component
import { useVirtualizer } from "@tanstack/react-virtual";

function Feed({ products }) {
  const parent = useRef(null);
  const v = useVirtualizer({
    count: products.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 380,   // approx card height in px
    overscan: 6,
  });

  return (
    <div ref={parent} className="h-screen overflow-auto">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((row) => (
          <div
            key={products[row.index].id}
            style={{
              position: "absolute", top: 0, left: 0, width: "100%",
              transform: `translateY(${row.start}px)`,
            }}
          >
            <ProductCard product={products[row.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Use a windowed grid (e.g., manual column math + `useVirtualizer`) for multi-column layouts.

### React Query cache tuning

Defaults are too aggressive for an e-commerce read path. Set sensible per-query staleness:

```js
// client/src/lib/queryClient.js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // treat fresh for 30s; no refetch on focus
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, err) =>
        err?.response?.status >= 500 && failureCount < 2,
    },
  },
});
```

Per-query overrides where it matters:

| Query | staleTime | Notes |
| :-- | :-- | :-- |
| `categories.tree` | 1h | Rarely changes; load once. |
| `products.featured` | 5m | Edited by ops. |
| `products.search(q,filters)` | 30s | Recompute often, but burst-stable. |
| `cart` | 0 | Always refetch on mount. |
| `orders.list` | 30s | After place-order, invalidate explicitly. |
| `flash_sale.active` | 10s | Real-time-ish. Use server time, not client. |

### Memoization rule

`useMemo`/`useCallback`/`React.memo` only after you've **measured a real re-render cost**. They have non-zero overhead. Profile in React DevTools, look for "did render because parent rendered" with expensive children — that's the only valid signal.

Anti-patterns to remove if you see them:

- `useCallback` around an inline arrow that's only passed to a DOM `onClick` (no child memo).
- `useMemo` on a primitive (`useMemo(() => count + 1, [count])`).
- `React.memo` on a component that always receives a new object prop.

### Hot main-thread work

- Move heavy JSON parsing or hashing off the main thread with a `Worker` — bigger payoff than micro-optimizing render.
- `requestIdleCallback` for analytics flushes and prefetch.
- `IntersectionObserver` for "prefetch on near-viewport" link hover/scroll.

### Animations

`framer-motion` is GPU-friendly by default — animate `transform` and `opacity`, not `width`/`height`/`top`/`left`. For a flash-sale countdown ticking every 100ms, don't re-render the parent; isolate the digit inside a memoized child.

## Backend

### Eager-load to kill N+1

Default SQLAlchemy lazy loading triggers a SELECT per accessed relationship inside a loop. Audit every service that returns lists.

```python
# bad — 1 + N + N queries (products, then variants per row, then images per row)
products = db.execute(select(Product).where(Product.is_active)).scalars().all()
for p in products:
    for v in p.variants:   # SELECT per product
        ...

# good — 3 total queries
from sqlalchemy.orm import selectinload, joinedload

products = db.execute(
    select(Product)
    .where(Product.is_active)
    .options(selectinload(Product.variants), selectinload(Product.images))
).scalars().all()
```

Rule of thumb:

- **`selectinload`** for `one-to-many` (variants, images, reviews) — a single extra IN-query.
- **`joinedload`** for `many-to-one` (category, store) — folds into the main query.

Avoid `joinedload` on `one-to-many` collections — it explodes row count (cartesian product).

### Cursor pagination

Offset pagination (`OFFSET 10000`) gets slower the deeper you go. For the home feed and search, use a cursor on a sortable, unique column.

```python
# Cursor = base64(json({"created_at": "...", "id": "..."}))
query = (
    select(Product)
    .where(Product.is_active)
    .order_by(Product.created_at.desc(), Product.id.desc())
    .limit(page_size + 1)
)
if cursor:
    c = decode_cursor(cursor)
    query = query.where(
        tuple_(Product.created_at, Product.id) < (c["created_at"], c["id"])
    )
```

Return `next_cursor` only when there's a real next page. Offset is fine for admin tables where pages are bounded.

### Indexes — confirm before adding

Run `EXPLAIN ANALYZE` on the slow query first. Look for `Seq Scan` on a large table or `Sort` that should have been an `Index Scan`. Add the index, re-run, confirm the plan changed.

```sql
EXPLAIN ANALYZE
SELECT * FROM products
WHERE category_id = '...' AND is_active
ORDER BY created_at DESC
LIMIT 24;
```

Track indexes per table in `documents/database_schema.md`. See `postgres-schema` for migration patterns.

### pgvector / HNSW tuning

HNSW index already exists (`server/migrations/versions/72700c2e7802_*` and `0859a58ede22_*`) on `products.embedding` with `vector_cosine_ops`. Two knobs matter at query time:

```sql
SET hnsw.ef_search = 80;   -- default 40; higher = better recall, slower
```

Set per-session for search heavy work. Tune by measuring recall@k against a held-out set; 60–100 is a typical sweet spot.

Build-time params (set at index creation):

- `m`: graph fanout. Default 16 is usually fine.
- `ef_construction`: build quality. 64 default; 128–200 helps recall on large catalogs.

Don't rebuild the index unless you've measured a recall problem — it's slow.

### Embedding model — load once

`sentence-transformers all-MiniLM-L6-v2` is ~80MB and ~1.5s to instantiate. Hold it in a module-level singleton, not per request.

```python
# server/app/core/embeddings.py
from functools import lru_cache
from sentence_transformers import SentenceTransformer

@lru_cache(maxsize=1)
def _model() -> SentenceTransformer:
    return SentenceTransformer("all-MiniLM-L6-v2")

def embed_text(text: str) -> list[float]:
    return _model().encode(text, normalize_embeddings=True).tolist()
```

In tests, stub `embed_text` to return a fixed vector — never load the real model in unit tests.

### Caching (in-process)

Cheap wins for static-ish data:

```python
from functools import lru_cache

@lru_cache(maxsize=1)
def get_category_tree(db: Session) -> list[dict]:
    ...  # build the tree once per process
```

Caveats: lru_cache keys on argument identity — pass a stable key (e.g. `cache_key=date.today()`), and never key on a SQLAlchemy `Session` object (it's mutable). For multi-process deploys, move shared caches to Redis (defer until you actually have multiple workers).

### Bulk operations

For the seller dashboard's "import 200 products" path, use `db.bulk_save_objects(...)` or `db.execute(insert(Product), [dicts])` — orders of magnitude faster than `db.add()` in a loop.

### Static content

`/uploads/*` served by FastAPI's `StaticFiles` is fine in dev. In prod, put nginx or a CDN in front; serve images with `Cache-Control: public, max-age=31536000, immutable` (filenames are UUIDs — content-addressable).

## Measurement playbook

Always measure first.

| Concern | Tool |
| :-- | :-- |
| Frontend render perf | React DevTools Profiler |
| Bundle size | `npm run build` output; visualize with `rollup-plugin-visualizer` |
| Web vitals (LCP/INP/CLS) | Chrome DevTools Performance panel; Lighthouse in CI |
| API latency | server logs (request_id + duration), or add `prometheus-fastapi-instrumentator` |
| DB queries | `EXPLAIN ANALYZE`, `pg_stat_statements`, `SQLAlchemy echo=True` in dev |
| Memory growth | `tracemalloc` snapshots on suspect endpoints |

Don't deploy "we made it faster" without before/after numbers in the PR description.

## Common mistakes to flag

- Sprinkling `useMemo`/`useCallback` everywhere without a measured re-render problem.
- `loading="lazy"` on the LCP image (delays the most important paint).
- `joinedload` on a one-to-many collection (cartesian blowup).
- Inserting a list with `db.add(row); db.commit()` per row in a loop.
- Re-instantiating the embedding model per request.
- `OFFSET 5000` in production paths — switch to cursor.
- A new `HNSW` index every time relevance is bad (try `ef_search` first).
- Caching at the wrong layer — a per-request `lru_cache` survives across requests with stale data.
- Big chunk of `react-router-dom` shipping on first paint because the lazy Suspense isn't actually wrapping the routes.
- Synchronous `console.log(largeObject)` on a hot path — drops a frame.
- Background polling at 1s intervals when 10s would do.
- Importing `framer-motion` everywhere it's installed (it's ~60KB gz). Tree-shake by importing from `framer-motion` directly, not a barrel.

## Checklist

- Above-the-fold images explicit-sized + `fetchPriority="high"`; below-fold `loading="lazy"` + `decoding="async"`.
- Routes split via `lazy()` with a Suspense fallback; admin/seller chunks isolated.
- Vite `manualChunks` configured; first-load JS within budget.
- Lists > 50 items virtualized via `@tanstack/react-virtual`.
- React Query `staleTime`/`gcTime` tuned per query; cart never cached.
- Service queries audited for N+1: every collection access has an explicit `selectinload` / `joinedload`.
- Cursor pagination for any list endpoint expected to exceed ~1000 rows.
- `embed_text` and category tree memoized at process level.
- HNSW `ef_search` set per session for search-heavy code paths.
- Slow endpoints measured with `EXPLAIN ANALYZE` before adding an index.
- PR description includes before/after numbers for any "perf" change.
