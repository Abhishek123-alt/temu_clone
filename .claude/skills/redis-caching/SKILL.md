---
name: redis-caching
description: Use Redis correctly across the backend — product feed caching, rate limiting, idempotency keys, session/refresh tracking, OTP storage, hot-SKU inventory counters, and queue/pubsub for the outbox worker. Trigger whenever the user mentions Redis, cache, caching, cache invalidation, rate limit, idempotency, OTP, "speed up the API", "reduce DB load", or any leaderboard/counter pattern.
---

# Redis Caching

Redis is the second backbone of the system. Used right, it absorbs read traffic, enforces rate limits, and makes hot paths instant. Used wrong, it becomes a stale-data liability.

## When this skill applies

- Caching expensive endpoints (home feed, PDP, search results).
- Idempotency stores for `POST /orders`, `/rewards/spin`, etc.
- Rate limits.
- OTP / verification codes.
- Hot-SKU inventory during flash sales.
- Refresh-token blacklist / session lookup.
- Outbox dispatcher / lightweight queue.

For long-term storage, see `postgres-schema`. Redis is **never the source of truth** for money or orders.

## Connection

Use `redis.asyncio` (the official async client). One client per process, injected as a FastAPI dependency.

```python
from redis.asyncio import Redis
redis: Redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
```

## Key conventions

```
<domain>:<entity>:<id>[:sub]
```

Examples:

```
prod:by_id:prod_123                   product detail JSON
feed:home:v3:user_42:cursor_0         home feed page (versioned in key)
cart:lock:cart_88                     advisory lock
idem:order:0d3f...                    idempotency key → response
otp:phone:+15551234567                hashed OTP, 5min TTL
ratelimit:login:ip:1.2.3.4            sliding window
inv:hot:var_555                       integer counter for flash-sale stock
session:refresh:hash_abc              session id by token hash
outbox:pending                         list of pending events
```

Always set a TTL. A keyless key is a memory leak.

## Cache-aside pattern

```python
async def get_product(db, redis, product_id):
    key = f"prod:by_id:{product_id}"
    raw = await redis.get(key)
    if raw:
        return ProductOut.model_validate_json(raw)
    product = await db.get(Product, product_id)
    if not product:
        await redis.setex(key, 60, "null")           # negative cache short TTL
        return None
    out = ProductOut.model_validate(product, from_attributes=True)
    await redis.setex(key, 600, out.model_dump_json())
    return out
```

Negative caches with a short TTL prevent thundering herds on missing keys.

## Cache invalidation

The hardest problem in computing — pick a strategy and stick to it.

- **Versioned keys** (preferred for feeds): include a version segment (`feed:home:v3:...`). Bump the version to invalidate everything atomically.
- **Tag-based**: maintain `tag:product:prod_123 → set of cache keys`, delete the set on writes.
- **TTL-only**: simplest; accept N-second staleness.
- **Write-through**: update cache after every DB write. Only for small, high-read entities (e.g., `categories`).

For a typical product write path: `update DB` → `DEL prod:by_id:{id}` → bump `feed:*` version. The next read repopulates.

## Idempotency keys

```python
async def get_or_set_idem(redis, key: str, ttl: int = 86400):
    return await redis.set(name=f"idem:{key}", value="processing", ex=ttl, nx=True)

# After processing:
await redis.set(f"idem:{key}:resp", json.dumps(resp), ex=ttl)
```

Pattern in the endpoint:

1. `SET idem:{key} processing NX EX 86400`
2. If success: store the response under `idem:{key}:resp`.
3. On a duplicate request, return the stored response.

## Rate limiting

Sliding-window using `INCR` + `EXPIRE`:

```python
async def allow(redis, bucket: str, limit: int, window_s: int) -> bool:
    p = redis.pipeline()
    p.incr(bucket)
    p.expire(bucket, window_s)
    count, _ = await p.execute()
    return count <= limit
```

For more accuracy, use a sliding-window log (sorted set with timestamps), but the above is fine for most endpoints.

## Hot-SKU inventory (flash sales)

Row-level locking falls over at flash-sale concurrency. Move the hot SKU's inventory into Redis:

```
SET inv:hot:var_555 500          # initial stock
DECRBY inv:hot:var_555 1         # reserve
```

If `DECRBY` returns a negative number, you oversold — `INCRBY` it back and reject. Reconcile to Postgres asynchronously every N seconds and at the end of the sale.

Only do this for SKUs flagged as "hot" (e.g., quantity > 100 with sale active). Cold SKUs stay in Postgres.

## Sessions & refresh tokens

For fast `is this refresh token still valid` checks:

```
HSET session:refresh:<sha256(token)> user_id usr_123 expires_at 1735000000 revoked 0
EXPIRE session:refresh:<sha256(token)> 2592000
```

Postgres still owns the canonical session row — Redis is a hot mirror.

## OTP

```
SETEX otp:phone:+15551234567 300 <hash>
```

5-minute TTL; on verify, `GET` then `DEL`. Do not store plaintext.

## Outbox / queue

For MVP, a simple list works:

```
LPUSH outbox:pending <json>
BRPOP outbox:pending 30           # blocking worker
```

For ordering and consumer groups, switch to Redis Streams (`XADD`, `XREADGROUP`).

## Pitfalls

- **Cache stampede**: 1000 requests miss simultaneously and all hit DB. Mitigate with a `SETNX` lock + small jitter on TTLs.
- **Big keys**: a single `KEY` over 1MB stalls the event loop on read. Page or shard.
- **Unbounded `KEYS *`**: never run this in prod — use `SCAN`.
- **Persistence misconfig**: enable AOF every-second + RDB snapshots, not RDB-only, unless you can afford to lose a few minutes of data.
- **TLS**: production Redis is never plaintext on the wire.

## Common mistakes to flag

- Caching mutable user-specific data without including the user id in the key.
- Caching POST responses.
- Forgetting TTL.
- Storing Pydantic objects via `pickle` — fragile across deploys; use JSON.
- Using `KEYS` in app code.
- Treating Redis as the source of truth for orders/money.

## Checklist

- Every key has a TTL.
- Keys follow the `<domain>:<entity>:<id>` convention.
- Cache misses log and metric so you can spot a stampede.
- Idempotency on all sensitive POSTs.
- Rate limits documented per endpoint.
- Hot-SKU inventory reconciles to Postgres on a schedule.
