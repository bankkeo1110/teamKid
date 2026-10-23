#!/usr/bin/env bash
# Team KID — unpack into WSL2 (Ubuntu). Run from the unzipped folder (needs internet to clone upstream):
#   bash setup-team-kid.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "$(uname -s)" in Linux) ;; *) echo "Run this inside WSL2 (Ubuntu), not Windows PowerShell."; exit 1;; esac

dest_pkg="$HOME/astragentic-kid"
dest_proj="$HOME/team-kid"

# 1. The customised Astragentic checkout: upstream at 4.1.1 + the Team KID patches (branch kid).
#    Future tweaks + ./install.sh happen here.
BASE=043782b
if [ ! -d "$dest_pkg/.git" ]; then
  git clone -q https://github.com/thientranhung/astragentic.git "$dest_pkg"
  git -C "$dest_pkg" checkout -q -b kid "$BASE"
  git -C "$dest_pkg" -c user.name="Team KID" -c user.email=kid@localhost am -q --committer-date-is-author-date "$here"/patches/*.patch
  git -C "$dest_pkg" remote rename origin upstream
  echo "✓ Astragentic (KID fork, $(cat "$dest_pkg/VERSION")) → $dest_pkg"
else
  echo "• $dest_pkg exists, left as is"
fi

# 2. The project the team builds in, harness already installed and committed.
if [ ! -d "$dest_proj/.git" ]; then
  git clone -q "$here/team-kid.bundle" "$dest_proj"
  git -C "$dest_proj" remote remove origin
  echo "✓ Team KID project → $dest_proj"
else
  echo "• $dest_proj exists, left as is"
fi

# 3. Git hooks are per clone.
( cd "$dest_proj" && .astraler/project/install-hooks.sh )

# 4. What is still missing on this machine.
echo
echo "Machine check (MISS lines are the remaining steps in SETUP.md):"
( cd "$dest_proj" && ./scripts/check-requirements.sh . --adapted ) || true
