#!/usr/bin/env bash
# Team KID plug — release what a worktree allocated beyond git, for THIS worktree only.
# Greenfield: worktrees allocate nothing yet (no per-worktree DB, port or container).
# When tickets start creating Neon branches or a Compose stack per worktree, release them here.
echo "cleanup-worktree: nothing allocated by ${1:-<worktree>}"
