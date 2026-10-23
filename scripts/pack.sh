#!/usr/bin/env bash
# Packs the ESM bundle into a tarball and runs publint against it.
# Declared as a sverka step in sverka.config.ts (ci/pack).
set -euo pipefail

# `bun pm pack` prints the tarball name on its own line; the other lines are
# stats, so grep for the extension rather than taking the last line.
TARBALL="$(bun pm pack 2>&1 | grep -E '\.tgz$' | head -1)"
if [ -z "$TARBALL" ]; then
  echo "pack: no .tgz produced by bun pm pack" >&2
  exit 1
fi
echo "packed $TARBALL"
npx --yes publint --strict "$TARBALL"
echo "publint passed for $TARBALL"