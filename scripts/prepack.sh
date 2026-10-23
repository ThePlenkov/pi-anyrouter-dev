#!/usr/bin/env bash
# Runs the tsdown build during `prepack` so `npm publish` ships the bundle.
#
# `npm publish` runs `prepack`, and `bun pm pack` runs it too. The command has
# to work on both: Bun-only hosts have `bunx` but no `npx`, npm/pnpm hosts
# have `npx` but no `bunx`. Pick whichever is present rather than assuming one.
set -euo pipefail

if command -v bunx >/dev/null 2>&1; then
  bunx tsdown
else
  npx --yes tsdown
fi