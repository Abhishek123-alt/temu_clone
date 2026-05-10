---
name: git-workflow
description: Run a clean git workflow on this project — branch naming, conventional commits, rebasing, squashing, tags/releases, hotfixes, and recovering from common screw-ups (force-push gone wrong, lost commits, bad merges). Trigger whenever the user mentions git, branch, commit, commit message, rebase, merge conflict, cherry-pick, stash, reset, revert, force push, "fix git", "the history is messy", or "what's the right way to..." in version control.
---

# Git Workflow

A consistent git workflow makes reviews faster, releases boring (the good kind), and history something you can actually debug from. Pick a flow and stick to it.

## When this skill applies

- Starting work on a new feature or fix.
- Authoring commit messages or cleaning up history before a PR.
- Rebasing, resolving conflicts, or recovering from mistakes.
- Tagging releases, cutting hotfixes.

For PR review and merge mechanics, see `pr-review-merge`.

## Branching model (trunk-based)

```
main              ← always deployable, protected
  └── feat/<short-name>   short-lived, ≤ 3 days, squash-merged
  └── fix/<short-name>
  └── chore/<short-name>
  └── hotfix/<short-name>  cut from main, fast-tracked
```

Don't use long-lived `develop` / `release` branches for a project this size — they cause merge debt. Trunk-based with feature flags scales better.

Branch naming: `kind/short-kebab-name` (e.g., `feat/cart-coupons`, `fix/double-charge-on-retry`). Optionally prefix with a ticket id: `feat/CRT-128-cart-coupons`.

## Commit messages — Conventional Commits

```
<type>(<scope>): <subject>

<body — what & why, not how>

<footer — refs / breaking changes>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

Examples:

```
feat(cart): apply server-computed totals on coupon change

Refetch /cart/summary after applyCoupon mutation so the UI matches what
the server will charge. Closes #214.

---

fix(payment): require Idempotency-Key on POST /orders

Prevents duplicate charges when the client retries on slow networks.
The key is stored in Redis with a 24h TTL.

BREAKING CHANGE: requests without Idempotency-Key now return 400.
```

Subject rules: imperative mood ("add", not "added"), ≤ 72 chars, no trailing period.

Why this matters: this format powers automated changelogs, semantic versioning, and makes `git log --oneline` actually scannable.

## Day-to-day workflow

```bash
# start fresh from main
git switch main && git pull --rebase

# branch
git switch -c feat/cart-coupons

# work in small commits
git add -p                          # stage hunks selectively
git commit -m "feat(cart): ..."

# keep branch current vs main (do this often, not at the end)
git fetch origin
git rebase origin/main

# push
git push -u origin feat/cart-coupons
# after rebase:
git push --force-with-lease         # NOT --force
```

`--force-with-lease` refuses to overwrite if someone else pushed to your branch — protects collaborators.

## Cleaning up history before PR

```bash
git rebase -i origin/main
```

Squash WIP commits, reorder, reword. Aim for a PR that reads as a series of logical commits, each one passing tests on its own.

Or: don't bother and rely on **squash-merge** at PR time (most teams do this). Then commit hygiene on the branch matters less and the squashed commit message is what survives.

## Merge strategies

| Strategy | When |
| --- | --- |
| **Squash** | Default for feature branches. One commit per PR on main, clean history. |
| **Rebase + merge** | When the branch already has a tidy series of commits worth preserving. |
| **Merge commit** | Avoid in this repo. Pollutes `main` with merge-noise. |

Configure at the repo level so contributors can't pick the wrong one:

```
GitHub repo settings → Merge button:
  ☑ Allow squash merging   (default)
  ☐ Allow merge commits
  ☐ Allow rebase merging
```

## Releases & tags

Tag releases with semver:

```bash
git tag -a v1.4.0 -m "Release 1.4.0"
git push origin v1.4.0
```

Use `release-please` or `semantic-release` to automate this from Conventional Commits — bumps version + generates CHANGELOG.

## Hotfix flow

```bash
git switch main && git pull
git switch -c hotfix/double-charge
# fix, commit, push, fast-track PR
# after merge, tag and deploy
git tag -a v1.4.1 -m "Hotfix"
```

Don't branch hotfixes off your feature branch — they need to ship from a clean main.

## Recovery cheat sheet

| Problem | Fix |
| --- | --- |
| Wrong branch — committed to `main` locally | `git switch -c feat/x && git switch main && git reset --hard origin/main` |
| Last commit message wrong | `git commit --amend -m "new message"` (only if not pushed, or `--force-with-lease`) |
| Need to undo last commit but keep changes | `git reset --soft HEAD~1` |
| Need to throw away local changes | `git restore .` (tracked) + `git clean -fd` (untracked) |
| Lost commits after a bad reset | `git reflog` → find sha → `git switch -c rescue <sha>` |
| Pulled merge commit you didn't want | `git reset --hard origin/main` (if not pushed) |
| Need to bring one commit from another branch | `git cherry-pick <sha>` |
| Need to pause work | `git stash push -m "wip"` → `git stash pop` |

`git reflog` is your safety net. Almost nothing in git is truly lost for 30 days.

## .gitignore essentials

```
# Frontend
node_modules/
dist/
.next/
.vite/

# Backend
.venv/
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Env / secrets
.env
.env.local
.env.*.local

# IDE / OS
.idea/
.vscode/
.DS_Store
```

Commit `.env.example`, never `.env`.

## Pre-commit hooks (recommended)

Use `pre-commit` (Python) or `lefthook`/`husky+lint-staged` (Node) to run:

- Linters (`ruff`, `eslint`)
- Formatters (`black`, `prettier`)
- Secret scanner (`gitleaks`)
- Conventional-Commit lint (`commitlint`)

Block bad commits before they exist.

## Common mistakes to flag

- `git push --force` (use `--force-with-lease`).
- Long-lived feature branches (> 1 week).
- Merging `main` into your branch instead of rebasing — pollutes history with merge commits.
- "Fix typo" or "WIP" commits on `main` (they should be squashed away).
- Committing `.env`, `node_modules/`, build artifacts, large binary blobs.
- Rewriting public history (force-push to `main`).

## Checklist before opening a PR

- Branch up-to-date with `origin/main` (rebased, not merged).
- Commit messages follow Conventional Commits.
- No secrets, no debug prints, no commented-out code.
- Linters and tests pass locally.
- PR title mirrors the squash-commit title you want on `main`.
