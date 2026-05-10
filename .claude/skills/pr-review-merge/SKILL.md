---
name: pr-review-merge
description: Open, review, and merge pull requests well — PR templates, the review rubric, comment etiquette, when to request changes vs. approve, merge gates, and post-merge follow-ups. Trigger whenever the user mentions PR, pull request, code review, "review my code", merge, "is this ready to merge", "should I approve", reviewer comment, CODEOWNERS, or "what does a good PR look like".
---

# Pull Requests — Review & Merge

A PR is a unit of communication, not a unit of code. The author's job is to make the change easy to evaluate; the reviewer's job is to evaluate it, not to rewrite it.

## When this skill applies

- Authoring a PR.
- Reviewing someone else's PR.
- Setting up branch protection, CODEOWNERS, required checks.
- Resolving "should I block this?" judgment calls.

For commit hygiene before the PR, see `git-workflow`. For security-specific review, see `security-review`. For perf-specific review, see `performance-optimization`.

## What makes a good PR

1. **Small.** Under ~400 lines of diff. Larger PRs get worse reviews because reviewers fatigue.
2. **One thing.** Don't mix a refactor with a feature; reviewers can't tell which lines belong to which.
3. **Self-explanatory description.** Anyone on the team should understand the change without opening a Slack channel.
4. **Tests.** New behavior is tested; bug fixes have a regression test.
5. **Green CI.** Don't ask humans to review red CI.

## PR template

Save as `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What
Brief: what does this PR do, in one sentence.

## Why
Context, link to ticket / issue / spec.

## How
The notable design decisions; alternatives considered; tradeoffs.

## Risk
- Areas of the codebase touched
- What could break, and how it's mitigated
- Migration / backfill / feature flag steps

## Verification
- [ ] Unit tests added / updated
- [ ] Integration tests added / updated
- [ ] Manually tested locally
- [ ] Screenshots / recordings (if UI)

## Checklist
- [ ] Branch rebased on `main`
- [ ] Conventional Commit title
- [ ] No leftover console.logs / debug prints
- [ ] No secrets in diff
- [ ] Docs / comments updated
```

## Reviewer rubric

For each PR, ask:

1. **Does it do what it says?** Diff matches the description, no scope creep.
2. **Will it work in production?** Race conditions, error paths, retries, idempotency, concurrency.
3. **Is it safe?** Auth check on every endpoint, no PII leaks, no SSRF, no SQLi. (`security-review`)
4. **Is it observable?** Logs, metrics, error reporting in place.
5. **Is it tested?** Critical paths covered; edge cases at least named.
6. **Is it readable?** A teammate at 2am can fix it.
7. **Is it the right shape?** Right module, right abstractions, doesn't fight existing patterns.

If a question takes more than 30 seconds to answer from the diff, leave a comment asking — don't guess.

## Comment etiquette

- **Lead with the why.** "This will fan out to N queries — could you batch?" beats "fix this".
- **Distinguish blockers from suggestions.** Use prefixes:
  - `blocker:` must change before merge
  - `nit:` style/preference, won't block
  - `q:` question, possibly indicates a real issue
  - `praise:` something done well — costs nothing, helps culture
- **Suggest concretely.** Use GitHub's suggestion blocks for small fixes.
- **Don't restyle the whole PR.** If the codebase doesn't have a clear convention for the thing you're disagreeing about, that's a separate conversation.

## Author etiquette

- Reply to every comment, even with just "fixed in {commit}" or "good catch".
- Don't take feedback personally — code is the artifact, not your identity.
- If you disagree, say so, with reasoning. Reviewers are sometimes wrong.
- Push the rework as separate commits during review (easier to re-review the delta), squash at merge time.

## When to approve vs. request changes vs. comment

| Verdict | Meaning |
| --- | --- |
| **Approve** | I'm comfortable with this shipping; my outstanding comments are nits. |
| **Request changes** | There are blockers; I want another look. |
| **Comment** | I read it, I have thoughts, but I'm not the deciding voter. |

Don't approve "with comments that must be addressed before merge" — either they're blocking (request changes) or they're not (approve). Ambiguity here is how broken code lands.

## Merge gates (branch protection on `main`)

Configure in the repo settings:

- ☑ Require a pull request before merging.
- ☑ Require at least 1 approving review (2 for backend / payments / auth).
- ☑ Dismiss stale approvals when new commits are pushed.
- ☑ Require review from CODEOWNERS for sensitive paths.
- ☑ Require status checks to pass: `lint`, `typecheck`, `unit`, `integration`, `build`.
- ☑ Require conversations to be resolved.
- ☑ Require linear history (forces rebase or squash).
- ☑ Restrict who can push (only via PR).

## CODEOWNERS

`.github/CODEOWNERS`:

```
# Default
*                      @your-org/eng

# Sensitive paths require domain owner approval
/backend/app/payments/  @your-org/payments
/backend/app/auth/      @your-org/security
/backend/migrations/    @your-org/db
/.github/               @your-org/devops
/infra/                 @your-org/devops
```

Ownership prevents the "anyone can land a payment-flow change" failure mode.

## Merging

- **Squash-merge** is the default. The squash commit title is what shows up in `main`'s history — make sure it follows Conventional Commits.
- **Don't merge your own PR** unless your team has explicitly agreed it's OK for trivial changes.
- **After merge**, delete the branch (auto-delete in repo settings).

## Post-merge follow-ups

- If the PR included a feature flag, monitor metrics before flipping it on for everyone.
- If it included a migration, watch the deploy logs for rollback signals.
- If the PR's description listed risks, sanity-check those areas in the next ~hour.

## Common mistakes to flag

- 800-line PR — push back, ask for a split.
- "LGTM 🚀" on a 600-line diff with no comments (not a real review).
- Approving while CI is red.
- Mixing refactor + feature in one PR.
- Author and reviewer arguing in line comments — escalate to a 5-minute call after 3 round-trips.
- Merging right before EOD on a Friday for a non-urgent change.

## Checklist for "is this ready to merge"

- All blockers resolved (or explicitly waived in writing).
- CI green on the latest commit.
- At least one approval from a non-author (two for sensitive paths).
- Migrations / feature flags / rollback plan called out in the description.
- Squash commit title is Conventional and clear.
