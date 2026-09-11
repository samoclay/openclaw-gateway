#!/usr/bin/env bash
# Bump VERSION, CHANGELOG.md, RELEASE.md. Prints the new version (last line).
# Staging: X.Y.Z-rc.N. Master: promote rc → X.Y.Z (or patch-bump a stable hotfix).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NAME="${1:-$(basename "$ROOT")}"
KIND="${2:-patch}"
export RELEASE_KIND="$KIND"
exec python3 "$ROOT/scripts/bump-release.py" "$NAME"
