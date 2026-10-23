#!/usr/bin/env bash
# Team KID plug — exit 0 while a test suite, build or migration is running, 1 when idle.
pgrep -f -- 'vitest|jest|playwright|next build|prisma migrate|npm (run )?(test|build)|pnpm (test|build)|pytest' >/dev/null 2>&1 && exit 0 || exit 1
