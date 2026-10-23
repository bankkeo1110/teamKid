#!/usr/bin/env bash
# Team KID — install the two git hooks the harness relies on. Run once per fresh clone.
# Chains into any existing hook instead of replacing it; respects core.hooksPath.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
hooks="$(git config core.hooksPath || true)"; hooks="${hooks:-$(git rev-parse --git-path hooks)}"
mkdir -p "$hooks"
add() {  # $1 hook name, $2 marker, $3 body
  local f="$hooks/$1"
  [ -f "$f" ] || printf '#!/usr/bin/env bash\nset -e\n' > "$f"
  grep -q "$2" "$f" || printf '\n# %s\n%s\n' "$2" "$3" >> "$f"
  chmod +x "$f"; echo "hook ready: $f"
}
add pre-commit "team-kid:payload-drift" 'scripts/check-payload-drift.sh'
# git sends the ref list on stdin once: read it into a variable, feed the gate from a heredoc
add pre-push "team-kid:ticket-done" 'refs="$(cat)"
scripts/pre-push-ticket-done.sh "$@" <<KIDREFS
$refs
KIDREFS'
