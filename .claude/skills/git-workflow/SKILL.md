---
name: git-workflow
description: Git branching, commit messages, PR templates, and merge strategy for this project. Trigger whenever the user mentions branch, commit, message, PR, pull request, merge, rebase, squash, hotfix, release, conflict, .gitignore, CONTRIBUTING, CODEOWNERS, GitHub workflow, or "how should I name this branch".
---

# Git Workflow

This repo uses a lightweight gitflow: `main` is the deployable trunk, `develop` is the integration branch, and short-lived `feature/*` branches merge into `develop` via PR. Today commit messages are ad-hoc ("added code for X") and there is no PR template or CODEOWNERS file — this skill is the convention going forward.

## When this skill applies

- Naming a new branch.
- Writing a commit message or PR description.
- Deciding squash vs. merge vs. rebase.
- Resolving conflicts during a long-lived feature branch.
- Bootstrapping a new repo-level file: `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `CODEOWNERS`, or a `.github/workflows/*.yml`.

For CI workflow specifics (test/lint/build steps), see `deployment-cicd`. For what's allowed *inside* the diff (lint rules, naming), see `coding-standards`.

## Branches

| Branch | Lifetime | Source | Merges into | Notes |
| :-- | :-- | :-- | :-- | :-- |
| `main` | permanent | — | — | Production. Only release merges land here. |
| `develop` | permanent | `main` | `main` (via release PR) | Default integration branch. PRs target this. |
| `feature/<topic>` | short | `develop` | `develop` | New work. Existing examples: `feature/seller-onboard`, `feature/product-filter`. |
| `fix/<topic>` | short | `develop` | `develop` | Bug fixes that aren't urgent. |
| `hotfix/<topic>` | short | `main` | `main` AND `develop` | Urgent production fix. Cherry-pick or merge both ways so develop doesn't regress. |
| `chore/<topic>` | short | `develop` | `develop` | Tooling, deps, config — no behavior change. |

Topic slugs are lowercase, hyphenated, no scope prefix needed (`feature/seller-onboard`, not `feature/server/seller-onboard`). Keep the slug under 40 characters.

## Commit messages — Conventional Commits

Adopt [Conventional Commits](https://www.conventionalcommits.org/) so changelogs and release notes can be generated mechanically.

```
<type>(<scope>): <subject>

<body — optional, wrap at 72 cols>

<footer — optional: BREAKING CHANGE / Closes #123>
```

| Type | Use for |
| :-- | :-- |
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't add a feature or fix a bug |
| `perf` | Performance improvement |
| `test` | Tests only |
| `docs` | Docs / comments only |
| `chore` | Tooling, deps, config |
| `build` | Build system / external deps |
| `ci` | CI config |
| `style` | Formatting only (no logic change) |

Scope is the affected module (`auth`, `order`, `cart`, `admin`, `client`, `server`, `skills`). Optional.

**Good examples** (rewritten from real history in this repo):

```
feat(seller): add seller onboarding application flow
fix(cart): prevent oversell on concurrent checkout for the same variant
refactor(order): extract state-transition matrix into services.py
perf(product): add HNSW index on products.embedding (cosine_ops)
chore(deps): bump @tanstack/react-query 5.99 → 5.100
docs(skills): index new git-workflow + coding-standards skills
```

**Bad examples** (current style — avoid):

```
added the campaing code           # no type, no scope, typo, no detail
added code for filter and sorting # no type, vague
fixed it                          # no type, no scope, no information
```

Subject line rules:

- Imperative mood: "add X", not "added X" or "adds X".
- No trailing period.
- ≤ 72 chars total (`type(scope): subject`).
- Lowercase after the colon.

Body rules:

- Explain **why**, not what (the diff already shows what).
- Reference issues / PRs in the footer: `Closes #123`, `Refs #45`.
- For breaking changes, add `BREAKING CHANGE: <description>` in the footer — this triggers a major version bump.

## Pull requests

**Target `develop`** for `feature/*`, `fix/*`, `chore/*`. **Target `main`** only for `hotfix/*` and release PRs.

### PR title

Mirror the commit convention: `feat(seller): add seller onboarding application flow`. The title becomes the squash-merge commit message, so make it count.

### PR template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

<!-- 1–3 bullets. What changed and why. -->

## Screenshots / clips

<!-- For UI changes. Otherwise: N/A -->

## Test plan

- [ ] `pytest server/app/modules` passes locally
- [ ] `cd client && npm run lint && npm run build` passes
- [ ] Manual: <golden-path steps>
- [ ] Manual: <edge case>

## Risk & rollback

<!-- What could break in prod? How do you roll back? Mention DB migrations explicitly. -->

## Checklist

- [ ] No secrets, `.env`, or large binaries staged
- [ ] Migrations are reversible (`alembic downgrade -1` works)
- [ ] Touched skill bodies if conventions changed
- [ ] Linked issue or context doc
```

### Size & scope

- Aim for **< 400 lines changed**. PRs over 800 lines almost never get a real review.
- One concern per PR. A refactor PR is separate from the feature PR that uses the refactor.
- Half-finished work goes in a draft PR — do not merge "TODO / WIP" code to `develop`.

## Merge strategy

| Source → Target | Strategy | Why |
| :-- | :-- | :-- |
| `feature/*` → `develop` | **Squash & merge** | One clean commit per PR; PR title becomes the message. |
| `develop` → `main` (release) | **Merge commit** | Preserves feature commit history in main. |
| `hotfix/*` → `main` | **Merge commit** | Same as release. |
| `hotfix/*` → `develop` | **Merge commit** | Forward-port the fix so develop doesn't regress. |

**Never force-push to `main` or `develop`.** Force-push is fine on your own `feature/*` branch before the PR review starts; after review begins, prefer `git commit --fixup` + `--autosquash` over force-pushing fresh history.

**Never use `--no-verify`** to skip hooks. If a hook fails, fix the underlying issue.

## Rebasing vs. merging during a long feature

If `develop` moves while you're working on `feature/*`:

- **< 1 week old, no review yet**: rebase. `git fetch && git rebase origin/develop` then force-push your branch.
- **In review**: do not rewrite reviewed commits. `git merge origin/develop` into your branch and resolve conflicts.

Either way, conflicts get resolved by **understanding both sides** — don't pick "ours" or "theirs" blindly. For migrations, look at `server/migrations/versions/` — two parallel features can both add `down_revision` pointing at the same parent; one of them must rebase its revision.

## .gitignore — never commit

The current `.gitignore` already covers `node_modules/`, `__pycache__/`, `.venv/`. Watch for these *additional* hazards:

- `server/uploads/` — user-uploaded files (already ignored? confirm).
- `.env`, `.env.local`, `.env.*` — any file with secrets.
- `*.sqlite`, `*.db` — local test databases.
- `dist/`, `build/`, `client/dist/` — build artifacts.
- IDE: `.vscode/`, `.idea/` (unless team-shared settings agreed).
- macOS noise: `.DS_Store`.

If you accidentally commit a secret: rotate the secret first, then `git filter-repo` or `git filter-branch` to scrub it. **Never just delete it in a later commit** — it stays in history.

## Hotfix flow (production is on fire)

1. `git checkout main && git pull`
2. `git checkout -b hotfix/<topic>`
3. Make the minimal fix. Add a regression test.
4. PR → `main`, get one reviewer, merge commit (not squash).
5. Tag the release: `git tag -a v1.2.3 -m "hotfix: <topic>" && git push --tags`.
6. **Forward-port to develop**: `git checkout develop && git merge main` (or open a second PR).

Step 6 is the most-forgotten step. Skipping it means the bug reappears in the next release.

## CODEOWNERS (recommended)

Create `.github/CODEOWNERS` so the right people get auto-requested as reviewers:

```
# Backend domains
/server/app/modules/order/       @backend-lead
/server/app/modules/payment*/    @backend-lead @payments-lead
/server/migrations/              @backend-lead

# Frontend
/client/                         @frontend-lead

# Skills + docs
/.claude/skills/                 @abhishek
/documents/                      @abhishek
```

GitHub honors this for PR review assignments and (optionally) branch protection rules.

## Common mistakes to flag

- Vague commit subjects ("update", "fix bug", "wip") — useless in `git log`.
- Mixing feature work and unrelated formatting cleanup in one PR — splits the diff into noise.
- Squash-merging `develop → main` — collapses every feature into one commit, you lose history.
- Force-push to a shared branch (`develop`, `main`) — rewrites other people's history.
- Cherry-picking instead of merging when forward-porting a hotfix — leaves the merge graph confused.
- Committing `.env`, `uploads/*`, or `node_modules/` — even once means the secret/file is in history forever.
- Branch name with no prefix (`seller-onboard` instead of `feature/seller-onboard`) — breaks branch protection rules that match on prefix.
- Merging your own PR without review — bypass review only for hotfixes, and even then ping someone async.

## Checklist

- Branch follows `<type>/<topic>` and targets the right base (`develop` or `main`).
- Commit subject is Conventional Commits: `<type>(<scope>): <imperative subject>`.
- PR title mirrors the merge commit you want; body uses the template.
- Diff is under ~400 lines and covers one concern.
- Migrations on the branch don't collide with `develop`'s latest revision.
- `pytest server/app/modules` and `cd client && npm run lint && npm run build` pass locally before pushing.
- No secrets, large binaries, or generated files staged.
- Hotfix is forward-ported to `develop`.
