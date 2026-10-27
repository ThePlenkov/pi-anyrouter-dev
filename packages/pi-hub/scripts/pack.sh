#!/usr/bin/env bash
# Packs the ESM bundle into a tarball and runs publint against it.
# Declared as a sverka step in sverka.config.ts (ci/pack).
#
# The tarball is normalised to `package.tgz` after packing so the Nx artifact
# output and the GitHub Actions upload path stay version-independent: `bun pm
# pack` names the file from the package version, and pinning that name would
# break caching and artifact upload on the first `nx release` bump.
set -euo pipefail

# Create unique temp file for pack log to avoid race conditions and symlink attacks.
PACK_LOG="$(mktemp)"
trap 'rm -f "$PACK_LOG"' EXIT

# Capture `bun pm pack`'s exit status before the pipe swallows it: without
# `PIPESTATUS` a failed pack is indistinguishable from an empty grep result,
# and the error is hidden behind a misleading "no .tgz produced" message.
TARBALL="$(bun pm pack > "$PACK_LOG" 2>&1; echo ":$?")"
PACK_EXIT="${TARBALL#*:}"
# Use || true to prevent set -e from exiting when grep finds no match
TARBALL="$(grep -E '\.tgz$' "$PACK_LOG" | head -1 || true)"
if [[ "$PACK_EXIT" -ne 0 ]]; then
  echo "pack: bun pm pack failed with exit $PACK_EXIT" >&2
  exit 1
fi
if [[ -z "$TARBALL" ]]; then
  echo "pack: no .tgz produced by bun pm pack" >&2
  exit 1
fi
mv "$TARBALL" package.tgz
echo "packed $TARBALL -> package.tgz"

# Prefer bunx when Bun is the active runtime (a Bun-only host has no npx);
# fall back to npx for npm/pnpm hosts.
if command -v bunx >/dev/null 2>&1; then
  PUBLINT="bunx publint"
else
  PUBLINT="npx --yes publint"
fi
echo "publint: $PUBLINT --strict package.tgz"
$PUBLINT --strict package.tgz
echo "publint passed for package.tgz"