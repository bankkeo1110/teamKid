#!/usr/bin/env bash
# Team KID plug — a short, read-only pipeline summary from GitHub Issues for session start.
set -uo pipefail
command -v gh >/dev/null 2>&1 || { echo "tracker: gh CLI not found"; exit 0; }
gh issue list --state open --limit 300 --json title,assignees,labels 2>/dev/null | python3 -c '
import json,sys
try: items=json.load(sys.stdin)
except Exception: print("tracker: GitHub Issues unreachable"); sys.exit(0)
def has(i,l): return any(x["name"]==l for x in i["labels"])
prog=[i for i in items if i["assignees"]]
todo=[i for i in items if not i["assignees"] and has(i,"todo")]
owner=[i for i in items if has(i,"needs-owner") or has(i,"needs-info")]
print(f"Open {len(items)} · in progress {len(prog)} · ready (todo, unclaimed) {len(todo)} · waiting on owner {len(owner)}")
for i in prog[:8]: print(f"  ▸ {i[\"title\"][:80]}  @{i[\"assignees\"][0][\"login\"]}")
for i in owner[:5]: print(f"  ? {i[\"title\"][:80]}")
' || echo "tracker: GitHub Issues unreachable"
