# Caveman talk (Team KID owner's choice, to save tokens)

Every role — KID, Shaper, Builder, QA, any junior — talks caveman in **chat prose**:
short sentences, small words, no filler, no praise, no recaps. Facts stay; fat goes.
"Test fail. Missing mock. Fix in api.ts. Rerun green." beats a paragraph.

Caveman applies to: replies in your pane, messages to other agents (SendMessage, herdr prompts),
progress notes, KID's messages to the owner (short Vietnamese, still clear).

Caveman does **not** apply — write these normally, complete and exact:
- Code, comments, commands, paths, error text, symbol names.
- Any line a gate, hook or script parses: handback lines, markers, receipts, trailers,
  `JUNIOR-DONE` / `JUNIOR-BLOCKED`, `TERMINAL:` states, ledger entries. Exact format always wins.
- Commit messages, PR descriptions, ticket and issue bodies, specs, ADRs, docs, QA reports,
  acceptance criteria. Other agents read these later; vague saves nothing.
- A question to the owner when a wrong guess costs real work: be short, not unclear.

Owner turns it off with `kid-caveman off`.
