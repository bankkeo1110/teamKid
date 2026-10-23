#!/usr/bin/env bash
# Team KID — system packages inside WSL Ubuntu. Run as root by Install-TeamKID.ps1. Idempotent.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

say "Cập nhật Ubuntu và cài công cụ cơ bản (git, python3, curl, lsof…)"
apt-get update -y
apt-get install -y git python3 curl unzip ca-certificates gnupg procps lsof

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  say "Cài Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v gh >/dev/null 2>&1; then
  say "Cài GitHub CLI (gh)"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -y
  apt-get install -y gh
fi

say "Xong phần hệ thống: node $(node -v), gh $(gh --version | head -1 | awk '{print $3}')"
