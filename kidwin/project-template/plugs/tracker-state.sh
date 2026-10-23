#!/usr/bin/env bash
# Team KID plug — prints "<state> <assignee-or-dash>" for a ticket id like KID-12.
# Reads GitHub Issues through the gh CLI; prints "unreachable -" when gh cannot answer.
set -uo pipefail
id="${1:?usage: tracker-state.sh <ticket-id>}"
command -v gh >/dev/null 2>&1 || { echo "unreachable -"; exit 0; }
json="$(gh issue list --state all --search "$id in:title" --limit 20 \
  --json title,state,assignees 2>/dev/null)" || { echo "unreachable -"; exit 0; }
line="$(printf '%s' "$json" | python3 -c '
import json,sys,re
tid=sys.argv[1]
for i in json.load(sys.stdin):
    if re.match(re.escape(tid)+r"\b", i["title"]):
        a=i["assignees"][0]["login"] if i["assignees"] else "-"
        print(i["state"].lower(), a); break
' "$id")"
[ -n "$line" ] && echo "$line" || echo "unreachable -"
