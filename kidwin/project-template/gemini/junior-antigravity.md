# Junior — Antigravity CLI (Gemini) runtime supplement

**Read `.agents/roles/junior.md` (the base contract) first.** This file carries only what
differs when the junior runs on Google's Antigravity CLI (`agy`, Gemini models). Team KID
addition, not part of Astragentic.

## What you have here

Antigravity reads `AGENTS.md`, `GEMINI.md` and `.agents/rules/`, not `CLAUDE.md`: read
`CLAUDE.md` at the repo root yourself before the first brief. There is no `Skill` tool: a skill
is read by opening its `SKILL.md` under `.agents/skills/` when its description matches. Every
tool call is auto-approved (`--dangerously-skip-permissions`), because nobody sits at this pane.

## Trailer

`Implemented-by: antigravity/<model>` — the model name is in the footer.

## What is not enforced here

The dispatch mod and its gates do not run on this runtime, and nothing on it blocks `git push`.
The boundaries in `junior.md` are yours to keep — above all: never push, never check out the
base branch. The Builder reads the log: a push, a base-branch checkout or a commit outside the
write-set is visible there and ends the session.

## Quota

If a request fails on quota or rate limits, end the turn with
`JUNIOR-BLOCKED <ticket-id> antigravity quota` so the Builder takes the ticket back.
