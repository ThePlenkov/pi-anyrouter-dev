#!/usr/bin/env bash
# Packs the ESM bundle into a tarball and runs publint against it.
# Declared as a sverka step in sverka.config.ts (ci/pack).
#
# The tarball is normalised to `package.tgz` after packing so the Nx artifact
# output and the GitHub Actions upload path stay version-independent: `bun pm
# pack` names the file from the package version, and pinning that name would
# break caching and artifact upload on the first `nx release` bump.
set -euo pipefail

TARBALL="$(bun pm pack 2>&1 | grep -E '\.tgz$' | head -1)"
if [ -z "$TARBALL" ]; then
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