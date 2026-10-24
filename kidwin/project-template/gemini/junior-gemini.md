# Junior — Gemini CLI runtime supplement

**Read `.agents/roles/junior.md` (the base contract) first.** This file carries only what
differs when the junior runs on Gemini CLI. (Team KID addition, not part of Astragentic.)

## What you have here

Gemini CLI loads `GEMINI.md` files, not `CLAUDE.md`: read `CLAUDE.md` and `AGENTS.md` at the
repo root yourself before the first brief. There is no `Skill` tool: a skill is read by opening
its `SKILL.md` under `.agents/skills/` when its description matches. You run with every tool
call auto-approved (`--yolo`), because nobody sits at this pane.

## Trailer

`Implemented-by: gemini/<model>` — the model name is in the footer (`gemini-…`).

## What is not enforced here

The dispatch mod and its gates do not run on this runtime. `.gemini/settings.json` excludes
`git push`, nothing else. The boundaries in `junior.md` are yours to keep, and the Builder reads
the log: a push, a base-branch checkout or a commit outside the write-set is visible there and
ends the session.

## Quota

If Gemini answers with a quota or rate-limit error, end the turn with
`JUNIOR-BLOCKED <ticket-id> gemini quota` so the Builder takes the ticket back.
