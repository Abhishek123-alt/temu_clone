---
name: code-review
description: Review code thoughtfully — what to look for, how to prioritize feedback, when something is "good enough", and how to say it without making the author defensive. Trigger whenever the user mentions code review, "review this code", "is this code OK", refactor review, design critique, "look at my function", or "what would you change about this".
---

# Code Review (the act of reading and judging code)

Distinct from `pr-review-merge` (the workflow): this skill is about the actual reading. Use it when reviewing a function, file, or a chunk of code in any context — PRs, mid-pairing, or "look at this real quick".

## When this skill applies

- Reviewing a PR's actual diff (combine with `pr-review-merge`).
- A teammate pastes code and asks for feedback.
- Self-reviewing your own work before pushing.
- Periodically auditing legacy code that's becoming a problem.

## The order to read in

1. **Read the description / context first.** Know what the code is *supposed* to do.
2. **Read the tests.** They reveal intent and edge cases the author considered.
3. **Read the public interface.** Function signatures, route shapes, schemas.
4. **Read the implementation.** Now you can spot if it matches the interface.
5. **Read the call sites.** Does it integrate cleanly?

Skipping straight to step 4 makes you a typo-checker, not a reviewer.

## Priority hierarchy (review in this order)

1. **Correctness** — does it work? Race conditions, error paths, edge cases.
2. **Security** — auth, injection, PII, secrets. (`security-review`)
3. **Data integrity** — migrations, idempotency, money math.
4. **Architecture** — right abstraction, right module, follows existing patterns.
5. **Performance** — obvious inefficiencies (N+1, unbounded loops). Defer micro-perf.
6. **Readability** — naming, structure, comments where the why isn't obvious.
7. **Style** — formatting, conventions. Linters should handle 99%.

A correctness bug deserves a "request changes". A naming preference does not.

## Things that should always trigger a comment

- Functions over ~50 lines doing more than one thing.
- Names that don't describe the value (`data`, `result`, `temp`, `x`).
- Mutable global state.
- Mixed levels of abstraction inside the same function (low-level byte handling next to high-level business rules).
- Silent `except:` or `catch (e) {}` that swallows errors.
- Magic numbers (`if x > 86400`) without a constant or comment.
- Copy-pasted blocks (3+ near-identical sections — extract).
- TODOs without an owner or ticket.
- Comments that lie (describe outdated behavior).
- Tests that don't actually assert (`expect(true).toBe(true)`).
- New deps for tiny utilities (left-pad smell).
- Off-by-one risk: loops, slices, ranges.
- Type holes — `any`, `Object`, `dict` where a real type would clarify.
- Anything tagged "temporary" — put a deletion ticket on it now.

## Patterns specific to this stack

### React review

- Server data in Zustand or `useState` instead of TanStack Query.
- `useEffect` with a fetch + setState (use Query).
- Inline arrow functions in long lists.
- Missing `key` or `key={index}` on rendered lists.
- `dangerouslySetInnerHTML` without sanitization.
- Components that take 12+ props (split or use composition).
- A11y: `<div onClick>` instead of `<button>`; missing `alt`.

### FastAPI review

- Router contains business logic and SQL (move to a service).
- Endpoint returns ORM model directly (use `response_model`).
- Sync HTTP / DB calls inside `async def`.
- Missing auth dependency on a protected route.
- Money in floats; missing currency code.
- No idempotency on a sensitive POST.
- Bare `except Exception`.

### SQL review

- Missing index for the WHERE/ORDER BY shape.
- `OFFSET` paginating a large table.
- `SELECT *` (lock in columns explicitly).
- N+1 in a list endpoint.
- Migration that locks a hot table without `CONCURRENTLY` / partitioning.

## How to leave good comments

| Don't | Do |
| --- | --- |
| "This is wrong." | "If `x` is None here, line 42 will TypeError. Want a guard?" |
| "Bad naming." | "`tmp` is hard to follow — could it be `enriched_order`?" |
| "Why did you do this?" | "What's the reason for the manual loop instead of `selectinload`?" |
| "Refactor this." | "This function has three responsibilities — splitting into `validate`, `compute`, `save` would make the tests easier." |

Frame as a question when you're not sure. State as a blocker when you are. Always lead with the why.

## Review-in-flight (synchronous)

When pair-reviewing or working with a teammate live:

- Read out loud what you think the code does, ask if you got it right.
- Use the **rubber duck** trick — sometimes the author spots the bug while explaining.
- Drive the keyboard sparingly; let the author make the change so they remember it.

## Self-review checklist (before pushing)

- Read your own diff in GitHub's PR view (the layout reveals what reviewers see).
- Run the tests locally one more time.
- Search the diff for `console.log`, `print(`, `// TODO`, `breakpoint(`.
- Skim for things you'd flag if you were the reviewer.
- Confirm the PR description still matches what you actually did.

## When to say "ship it" vs. "let's keep iterating"

Ship it when:

- Correctness, security, data integrity are sound.
- Readability is fine, even if not perfect.
- The change is small enough to revert if it bites.
- You have tests covering the risk.

Iterate when:

- Architectural smell that will be hard to undo later (pick the right shape now).
- Missing tests on the risky path.
- The code "works but I'm not sure why" — that's a future bug.

Perfect is the enemy of done. But "done" doesn't mean "fragile".

## Common mistakes (as a reviewer)

- Treating style preferences as blockers.
- Reviewing when tired — fatigue makes you cranky and shallow.
- Reviewing more than ~400 lines in one sitting (split or batch).
- Refactoring the author's code in your comments (suggest, don't dictate).
- Approving without reading the test file.

## Checklist when you've finished a review

- Every blocker is clearly marked.
- Praise something, even if small — culture is built one comment at a time.
- The verdict (approve / request changes / comment) matches the comments.
- If you're unsure, you said so out loud rather than rubber-stamping.
