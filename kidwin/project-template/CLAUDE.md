# {{NAME}}

A software project built by **Team KID**, an AI agent team running on the Astragentic harness
(KID fork, release {{VERSION}}). The owner talks to **KID** only; KID runs the Shaper, Builders, Rin
and QA through the tracker.

## Tracker

- **Tracker:** GitHub Issues, through the `gh` CLI. The adapter is `.agents/skills/github-issue-tracker`;
  the pointer and this project's decisions live in `docs/agents/issue-tracker.md`.
- **Ticket prefix: `{{PREFIX}}`.** Every issue title starts with `{{PREFIX}}-<n> — `. `scripts/ticket-git-facts.sh`
  reads the prefix from here.
- Every ticket is one branch, one worktree, one PR, carrying the same `{{PREFIX}}-<n>` id.

## Standards

Greenfield: there are no coding standards in this repo yet. The first ticket that sets up a stack
also writes its standards as a project skill (an implement playbook), and links it here.

## Rendering path

Greenfield: there is no UI yet, so there is no rendering path. The ticket that adds the first
user-visible surface records here how it is rendered for evidence (e.g. `npm run dev` + Playwright,
or a Vercel preview URL). Until then, a ticket that changes a visible surface is a finding.

## Where verification runs

- Agents verify **locally**, in their own worktree, against local or per-worktree resources only.
- **Production is off limits.** Nothing touches a production deployment, database or provider
  account unless the same journey passed locally first AND the owner gave permission for that run.
  A permission is never carried over from an earlier yes.
- Pushing, merging to `main`, deploying, and changing external services wait for the owner to ask.

## Ledgers

- **Harness ledger** (read-only, overwritten by every release): `.agents/memory/recurring-failure-modes.md`.
- **Project ledger** (this project's, append-only): `docs/ledger.md`. **Every new failure-mode entry
  is written there**, never in the harness ledger. A citation resolves in the ledger that belongs to
  the material carrying it.

## Machine notes

- Git hooks (`pre-commit` drift check, `pre-push` ticket-done gate) live in `.git/hooks`, which is
  not committed: run `.astraler/project/install-hooks.sh` once on every fresh clone.
- `.astraler/` is committed, so `scripts/check-reachability.py` works on a fresh clone.
