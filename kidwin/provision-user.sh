#!/usr/bin/env bash
# Team KID — per-user setup inside WSL Ubuntu, driven by Install-TeamKID.ps1. Idempotent.
#   provision-user.sh tools  <bundle-dir>   Claude Code, herdr, herdr skill, kid commands, clone projects
#   provision-user.sh helpers               (re)install kid, start-kid, new-kid-project + template
#   provision-user.sh github                git identity, plugins, GitHub repo + labels
#   provision-user.sh finish                finish adaptation after the setup skill, commit, push, check
#   provision-user.sh status                print what is done (one key per line)
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KID="$HOME/team-kid"
mkdir -p "$HOME/.teamkid" "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

claude_logged_in() { [ -s "$HOME/.claude/.credentials.json" ] || [ -f "$HOME/.teamkid/claude-login-done" ]; }

phase_tools() {
  local bundle="${1:?bundle dir}"

  say "Cài Claude Code (bản chính thức, tự cập nhật)"
  if command -v claude >/dev/null 2>&1; then ok "đã có: $(claude --version 2>/dev/null | head -1)"
  else curl -fsSL https://claude.ai/install.sh | bash && ok "$(claude --version | head -1)"; fi

  say "Cài herdr (mỗi agent một ô)"
  if ! command -v herdr >/dev/null 2>&1; then
    curl -fsSL https://herdr.dev/install.sh | sh
    for d in "$HOME/.local/bin" "$HOME/.herdr/bin" "$HOME/bin" /usr/local/bin; do
      [ -x "$d/herdr" ] && { [ "$d" = "$HOME/.local/bin" ] || ln -sf "$d/herdr" "$HOME/.local/bin/herdr"; break; }
    done
  fi
  command -v herdr >/dev/null 2>&1 && ok "herdr $(herdr --version 2>/dev/null | head -1)" || warn "không tìm thấy herdr sau khi cài"

  say "Cài herdr skill cho agent"
  if command -v herdr >/dev/null 2>&1; then
    mkdir -p "$HOME/.agents/skills/herdr" "$HOME/.claude/skills"
    herdr --skill > "$HOME/.agents/skills/herdr/SKILL.md"
    ln -sfn "$HOME/.agents/skills/herdr" "$HOME/.claude/skills/herdr"
    ok "~/.agents/skills/herdr (Claude đọc qua ~/.claude/skills/herdr)"
  fi

  phase_helpers

  say "Tạo ~/team-kid và ~/astragentic-kid"
  ( cd "$bundle" && bash ./setup-team-kid.sh ) | grep -E '✓|•|hook ready' || true
  [ -d "$KID/.git" ] && ok "dự án ở $KID" || { warn "chưa tạo được ~/team-kid"; return 1; }
}

phase_helpers() {
  say "Cài lệnh kid, start-kid, new-kid-project"
  for f in kid kid-projects start-kid new-kid-project kid-office kid-update; do install -m 0755 "$here/$f" "$HOME/.local/bin/$f"; done
  install -m 0644 "$here/env.sh" "$HOME/.teamkid/env.sh"
  mkdir -p "$HOME/.teamkid/office/vendor" && cp "$here/office/server.mjs" "$here/office/index.html" "$here/office/office3d.js" "$HOME/.teamkid/office/" && cp "$here/office/vendor/"* "$HOME/.teamkid/office/vendor/"
  pkill -f "$HOME/.teamkid/office/server.mjs" 2>/dev/null || true   # a running office picks up the new files on next start
  rm -rf "$HOME/.teamkid/project-template" && cp -r "$here/project-template" "$HOME/.teamkid/project-template"
  chmod +x "$HOME/.teamkid/project-template/plugs/"*.sh
  # KID must route build requests through the team, never build them itself (overlay, per project)
  for proj in $(kid-projects 2>/dev/null || "$here/kid-projects"); do
    o="$HOME/$proj/.astraler/project/overlays/kid.md"
    [ -f "$o" ] || { mkdir -p "$(dirname "$o")" && cp "$here/project-template/overlays/kid.md" "$o" && ok "quy tắc KID → $proj"; }
  done
  grep -q 'teamkid/env.sh' "$HOME/.profile" 2>/dev/null || printf '\n[ -f "$HOME/.teamkid/env.sh" ] && . "$HOME/.teamkid/env.sh"\n' >> "$HOME/.profile"
  grep -q 'teamkid/env.sh' "$HOME/.bashrc" 2>/dev/null || printf '\n# Team KID\n[ -f "$HOME/.teamkid/env.sh" ] && . "$HOME/.teamkid/env.sh"\n' >> "$HOME/.bashrc"
  ok "kid, kid-projects, start-kid, new-kid-project, kid-office, kid-update"
}

phase_github() {
  say "Thiết lập danh tính git từ tài khoản GitHub"
  if ! gh auth status >/dev/null 2>&1; then warn "chưa đăng nhập GitHub"; return 1; fi
  gh auth setup-git >/dev/null 2>&1 || true
  local login id name
  login="$(gh api user -q .login)"; id="$(gh api user -q .id)"; name="$(gh api user -q '.name // .login')"
  [ -n "$(git config --global user.name)" ]  || git config --global user.name "$name"
  [ -n "$(git config --global user.email)" ] || git config --global user.email "${id}+${login}@users.noreply.github.com"
  git config --global init.defaultBranch main
  ok "git: $(git config --global user.name) <$(git config --global user.email)>"

  say "Cài plugin mattpocock-skills"
  if ! claude_logged_in; then warn "chưa đăng nhập Claude"; return 1; fi
  claude plugin marketplace add mattpocock/skills >/dev/null 2>&1 || true
  claude plugin install mattpocock-skills@mattpocock >/dev/null 2>&1 || true
  claude plugin list 2>/dev/null | grep -q mattpocock-skills && ok "mattpocock-skills" || warn "chưa cài được mattpocock-skills"

  say "Tạo repo GitHub riêng tư 'team-kid' và các nhãn"
  cd "$KID" || return 1
  if ! git remote get-url origin >/dev/null 2>&1; then
    gh repo create team-kid --private --source . --push >/dev/null && ok "đã tạo $(gh repo view --json url -q .url)" \
      || { warn "không tạo được repo (có thể tên 'team-kid' đã tồn tại trên GitHub)"; return 1; }
  else ok "repo: $(git remote get-url origin)"; fi
  for l in todo needs-owner needs-info needs-triage ready-for-agent wontfix; do gh label create "$l" --force >/dev/null 2>&1 || true; done
  ok "nhãn: todo, needs-owner, needs-info, needs-triage, ready-for-agent, wontfix"
}

phase_finish() {
  cd "$KID" || return 1
  if [ ! -f docs/agents/triage-labels.md ] || [ ! -f docs/agents/domain.md ]; then
    warn "setup skill chưa tạo docs/agents/triage-labels.md và domain.md"; return 1
  fi
  say "Hoàn tất phần thích nghi (Claude tự làm, khoảng 1–3 phút)"
  claude -p --dangerously-skip-permissions --model claude-sonnet-5-5 \
"Read .astraler/releases/$(cat .astraler/state/applied-version)/ADAPT-HARNESS.md sections 2.3 to 2.6 only and finish them for this repo:
verify docs/agents/issue-tracker.md, docs/agents/triage-labels.md and docs/agents/domain.md exist;
make sure the ticket prefix is KID in CLAUDE.md and in issue-tracker.md;
confirm GitHub Issues is reachable with gh and supports assignees and blocked_by edges;
split issue-tracker.md into the pointer half (keep) and move generic mechanics out, saying they live in the github-issue-tracker adapter.
Add one line per decision to .astraler/state/ADAPTATION-REPORT.md and change its result from PENDING to APPLIED if everything is satisfied.
Then stage only docs/ CLAUDE.md AGENTS.md .astraler/state and commit with message 'Finish Team KID adaptation'. Do not push." \
    2>&1 | tail -15
  git push -q origin HEAD 2>/dev/null && ok "đã push lên GitHub" || warn "chưa push được"
  say "Kiểm tra lần cuối"
  ./scripts/check-requirements.sh . --adapted 2>&1 | grep -E '\[MISS\]|REQUIRED|All required' || true
}

phase_status() {
  command -v claude >/dev/null 2>&1 && echo claude-installed
  claude_logged_in && echo claude-login
  command -v herdr >/dev/null 2>&1 && echo herdr
  [ -d "$KID/.git" ] && echo project
  gh auth status >/dev/null 2>&1 && echo gh-login
  git -C "$KID" remote get-url origin >/dev/null 2>&1 && echo github-repo
  claude plugin list 2>/dev/null | grep -q mattpocock-skills && echo plugin
  [ -f "$KID/docs/agents/triage-labels.md" ] && [ -f "$KID/docs/agents/domain.md" ] && echo setup-skill
  ( cd "$KID" 2>/dev/null && ./scripts/check-requirements.sh . --adapted >/dev/null 2>&1 ) && echo adapted
  true
}

case "${1:-}" in
  tools)  shift; phase_tools "$@" ;;
  helpers) phase_helpers ;;
  github) phase_github ;;
  finish) phase_finish ;;
  status) phase_status ;;
  *) echo "usage: $0 tools <bundle-dir> | github | finish | status"; exit 2 ;;
esac
