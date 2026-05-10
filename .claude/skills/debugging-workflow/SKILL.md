---
name: debugging-workflow
description: Debug systematically — reproduce, isolate, hypothesize, test, fix, regression-test. Covers tools (pdb/ipdb, Chrome DevTools, network tab, server logs, traces, EXPLAIN), techniques (binary search through git, bisect, minimum repro), and how to debug what you can't reproduce locally. Trigger whenever the user mentions bug, debug, "it's broken", "it doesn't work", "can't figure out why", stack trace, error message, "intermittent failure", flaky, repro, "works on my machine", or asks for help diagnosing something.
---

# Debugging Workflow

Debugging is a discipline, not a skill you have or don't. The fastest debuggers aren't smarter — they're more methodical. Follow the loop, resist the urge to flail.

## The loop

```
1. Reproduce      → can you make it happen on demand?
2. Isolate        → what's the minimum input that triggers it?
3. Hypothesize    → what specifically would cause this?
4. Test           → one experiment that distinguishes hypotheses.
5. Fix            → smallest change that addresses the root cause.
6. Regression     → write a test so it can't come back.
```

If you can't reproduce, every step that follows is guesswork. Reproduction is 80% of debugging.

## When this skill applies

- A test, endpoint, or UI is misbehaving.
- A user-reported bug.
- An intermittent / flaky failure.
- A performance regression that just appeared.

## Before touching code: gather evidence

- **Exact error message** — copy-paste, don't paraphrase.
- **Stack trace** — the actual line that threw, not "somewhere in the order code".
- **Reproduction steps** — preconditions, exact inputs, expected vs. actual.
- **Environment** — local? staging? prod? which user? which browser? which device?
- **When did it start?** — first time, or recent regression? If recent, what shipped?

For a user-reported bug, paste the bug into a scratch doc and don't start coding until you've answered all of the above.

## Reproducing

If it's not reproducing locally:

- Match the env: same node/python version, same DB version, same data shape.
- Use the **same input** — get the failing user's order_id, the failing image url.
- For race conditions: add artificial delays (`asyncio.sleep`) to widen the window.
- For "intermittent": run in a loop (`for i in $(seq 1 100); do pytest -k test_x; done`) until it fails.
- For prod-only bugs: add structured logging to reproduce *with data*, not from theory.

## Tools by stack layer

| Layer | Reach for |
| --- | --- |
| **Python** | `breakpoint()` (drops to pdb), `ipdb`, `rich.traceback`, `loguru` |
| **JS/TS** | Chrome DevTools, `debugger;`, source maps, React DevTools, Redux/Zustand devtools |
| **Network** | DevTools Network tab, `curl -v`, `httpx --verbose`, mitmproxy |
| **DB** | `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_statements`, `SELECT * FROM pg_locks` |
| **Redis** | `redis-cli MONITOR`, `OBJECT ENCODING`, `DEBUG OBJECT` |
| **Containers** | `docker logs`, `docker exec -it bash`, `docker compose top` |
| **Distributed** | OpenTelemetry traces, request_id correlation in logs |

Don't reach for a tool you haven't learned during a fire. Practice them when nothing's broken.

## The hypothesis discipline

Before changing code, write down (out loud, in a comment, in Slack):

> "I think the bug is X because of Y. If I'm right, doing Z will produce W."

If you can't articulate the hypothesis, you don't have one. You're poking.

Test the *cheapest* hypothesis first. A `print()` line beats reading 400 lines of code.

## Isolating

- **Halve the surface.** Comment out half the function; if the bug persists, the cause is in the remaining half.
- **`git bisect`.** If a recent commit broke it: `git bisect start && git bisect bad && git bisect good <known-good-sha>` and let git find the offending commit.
- **Minimal reproduction.** Strip the failing case down to ~10 lines. Often, the bug becomes obvious in the stripping.

## React-specific debugging

- **State not updating?** React DevTools → check the actual state. Console-log inside the render to see what the component receives.
- **Re-render storms?** React DevTools Profiler → see which components rendered and why.
- **Effect runs too often?** Check the dep array. `useEffect(() => fetch, [])` vs `[obj]` (new every render).
- **Hydration mismatch (Next.js)?** Server and client rendered different HTML — usually a `Date.now()`, `Math.random()`, or `window` reference at render time.
- **TanStack Query stale data?** Check the query key — different keys = different caches.

## FastAPI-specific debugging

- **404 on a route you swear exists?** Probably the trailing slash. Or the router isn't included in `main.py`.
- **422 with a cryptic body?** That's Pydantic — check `.json()` for the exact path.
- **500 with no traceback?** Set `LOGGING_LEVEL=DEBUG`, ensure exception middleware re-raises in dev.
- **`AsyncSession` warnings?** You're using a session outside its scope, or sharing across requests.
- **Slow endpoint?** Wrap with `time.perf_counter()` boundaries to find the slow chunk.
- **Webhooks not arriving?** Use `stripe listen --forward-to localhost:8000/webhooks/stripe`. Check signature verification.

## Database debugging

- "Why is this query slow?" → `EXPLAIN (ANALYZE, BUFFERS)` and look for Seq Scans on big tables.
- "Why are the rows wrong?" → Run the same query in psql with the same params; the ORM may be silently joining or filtering.
- "Lock contention?" → `SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL`.
- Always check the **bind params**, not just the SQL. SQLAlchemy logs them at DEBUG level.

## "Works on my machine"

- Time zone? (UTC vs. local)
- Locale? (`en_US` vs. `en_GB` decimal separators)
- Filesystem case-sensitivity (mac is insensitive, Linux is)
- Different versions of node / python / a system lib
- Different DB seed data

Pin everything in CI: docker-compose for DB/Redis, lockfiles for deps, .nvmrc / .python-version for runtimes.

## Heisenbugs (it disappears when you look)

- Race condition: only happens under concurrency. Stress-test in a loop.
- Memory: only happens after N requests / hours. Run `htop` / `memray`.
- Time-of-day: cron-driven side effect, expired token, daylight savings.
- Stale cache: clear Redis, retry. If gone, you found the layer.

## Once you've fixed it

- **Write the regression test.** Make it fail without the fix, pass with it.
- **Note the root cause** in the PR / commit message — the fix isn't always self-explanatory.
- **Look for siblings.** If `cart` had this bug, does `wishlist` have the same shape?
- **Tell the team.** A 30-second Slack post on a tricky bug saves someone else hours.

## Common debugging anti-patterns

- Changing 5 things at once and re-running.
- "Restart and see if it goes away" as a fix.
- Deleting the error suppression so it merely silences elsewhere.
- Reading code without running it.
- Assuming the test is wrong before checking the code.
- Spending 2 hours alone before asking for help.

## Checklist

- Bug reproduced reliably (or stress-tested into reliable).
- Root cause identified, not just the symptom patched.
- Regression test added.
- PR description explains *why* the bug existed.
- Looked for siblings of the same bug elsewhere.
