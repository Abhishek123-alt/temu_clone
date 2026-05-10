---
name: search-indexing
description: Build product search and discovery — Postgres full-text for MVP, OpenSearch / Meilisearch / Typesense for scale. Covers indexing, query parsing, faceting, ranking, autocomplete, typo tolerance, and keeping the index in sync with Postgres. Trigger whenever the user mentions search, full-text, OpenSearch, Elasticsearch, Meilisearch, Typesense, autocomplete, faceted search, ranking, relevance, "find products by...", or "make search better".
---

# Search & Indexing

Search drives a huge slice of conversions. Start with Postgres FTS to ship fast, plan the migration to a dedicated engine before traffic outgrows it.

## When this skill applies

- Building product search, autocomplete, "did you mean".
- Adding facets / filters that need fast aggregation.
- Tuning ranking (popularity, recency, price match).
- Keeping the search index in sync with Postgres on writes.

For the React side of search UI, see `product-discovery-ui`. For the underlying tables, see `postgres-schema`.

## Stage 0 — Postgres full-text

Good enough up to ~100k SKUs and modest QPS.

```sql
ALTER TABLE products ADD COLUMN search_vec tsvector;

UPDATE products
SET search_vec =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english',
    coalesce(array_to_string(akeys(attributes::hstore), ' '), '')), 'C');

CREATE INDEX ix_products_search_vec ON products USING gin (search_vec);

-- keep it fresh with a trigger
CREATE TRIGGER trg_products_tsv BEFORE INSERT OR UPDATE
ON products FOR EACH ROW EXECUTE FUNCTION products_tsv_update();
```

Query:

```sql
SELECT id, title,
       ts_rank_cd(search_vec, q, 32) AS rank
FROM products,
     plainto_tsquery('english', :q) q
WHERE status = 'active' AND search_vec @@ q
ORDER BY rank DESC, sold_count DESC
LIMIT 20;
```

Add `pg_trgm` for fuzzy matching:

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX ix_products_title_trgm ON products USING gin (title gin_trgm_ops);
-- query: title % :q  (similarity)
```

## Stage 1 — Dedicated search engine

When you need: typo tolerance, real faceting at scale, multi-language, vector search, instant autocomplete.

| Engine | When to pick |
| --- | --- |
| **Meilisearch** | Typo-tolerant, instant; small to mid scale; easy ops |
| **Typesense** | Same niche as Meili; great Algolia-like API |
| **OpenSearch / Elasticsearch** | Heavy faceting, complex ranking, log analytics on the side |
| **Algolia** (SaaS) | If you'd rather pay than operate |

For a Temu-style discovery experience, **Meilisearch** or **Typesense** is the sweet spot.

## Index document shape

Don't mirror your DB rows; flatten what the search needs:

```json
{
  "id": "prod_01H...",
  "title": "Casual linen midi dress",
  "title_suggest": ["Casual linen midi dress", "linen midi dress"],
  "description": "...",
  "category_path": ["Women", "Dresses", "Midi"],
  "category_id": "cat_dresses_midi",
  "brand": "Sunday Cloth",
  "color": ["red", "olive"],
  "size": ["S", "M", "L"],
  "price_cents": 2499,
  "compare_at_cents": 4999,
  "discount_pct": 50,
  "in_stock": true,
  "sold_count": 1843,
  "rating_avg": 4.6,
  "rating_count": 312,
  "image_url": "https://cdn/.../w_400/abc.jpg",
  "popularity": 0.89,
  "created_at_ts": 1736812800
}
```

`popularity` is your computed ranking signal — a blend of sold_count, recency, conversion rate. Store as a float so the engine can sort by it.

## Keeping the index in sync

Two patterns, in order of preference:

1. **Outbox / CDC**: changes go through an `outbox` table, a worker ships them to the engine. Survives engine downtime.
2. **Direct from service**: write to DB then to engine in the same service call. Simple, but a failure between the two leaves drift.

**Don't** index synchronously in the API request. Indexing latency hits the user.

```python
# In the worker:
async def process_product_event(evt):
    if evt.type == "product.upserted":
        prod = await load_full_product_doc(db, evt.product_id)
        await search.index("products").upsert(prod)
    elif evt.type == "product.deleted":
        await search.index("products").delete(evt.product_id)
```

Schedule a nightly **full reindex** to fix any drift.

## Ranking

Simple weighted score works well to start:

```
score = (
   0.55 * text_relevance         # engine BM25 / typo distance
 + 0.25 * normalize(popularity)
 + 0.10 * normalize(rating_avg)
 + 0.05 * recency_decay
 + 0.05 * in_stock_boost
)
```

Encode this as engine-specific ranking rules (Meili `rankingRules`, Typesense `sort_by`, OpenSearch `function_score`).

A/B test changes — never ship a ranking tweak without measuring CTR and conversion.

## Autocomplete / suggest

- A separate, lightweight suggest index keyed by prefix tokens.
- Return ≤8 results per request.
- 200ms debounce client-side.
- Surface 3 things in suggestions: query terms, categories, top product matches.

## Facets

- Pre-declare facetable attributes (`color`, `size`, `brand`, `price_bucket`).
- Counts per facet come back in the search response.
- Show only facets with at least one result; hide zero-count options unless the user already selected them.
- Price uses **buckets** ($0–10, $10–25, ...), not free-form ranges, to keep counts useful.

## Vector / semantic search (later)

Once basic search is solid, add a vector field for semantic matching ("comfy summer dress" → linen, breathable, light tags). Both Meili (Pro) and Typesense support hybrid search; OpenSearch has k-NN.

## Common mistakes to flag

- Searching only `title` — users type colors, materials, brands.
- Reindexing the entire catalog on every product save (cost-prohibitive).
- Trusting the engine's defaults without setting up your own `rankingRules`.
- Showing zero-count facets (confusing dead ends).
- Returning all matches and paginating client-side (use cursor + limit at the engine).
- No fallback when the engine is down — fall back to Postgres FTS so search degrades, doesn't break.

## Checklist

- Index shape is denormalized for the queries the UI needs.
- Sync uses an outbox or queue, not synchronous writes.
- Nightly full reindex job exists.
- Ranking weights are documented and tested via A/B.
- Autocomplete debounced and request-cancelled on the client.
- Engine outage degrades to Postgres FTS, not a 500.
