#!/usr/bin/env bash
# Package the hosted CloudFront SPA (not the local Next.js BFF).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="${GITHUB_SHA:-${OPENCLAW_SPA_VERSION:-unknown}}"
OUT="${ROOT}/dist"

mkdir -p "${OUT}/spa"
cp "${ROOT}/site/index.html" "${OUT}/spa/index.html"

cat > "${OUT}/spa/manifest.json" <<EOF
{
  "name": "openclaw-spa",
  "version": "${SHA}",
  "source": "site/index.html",
  "terraformVar": "openclaw_spa_version"
}
EOF

(cd "${OUT}" && zip -r "openclaw-spa-${SHA}.zip" spa)
echo "Wrote ${OUT}/openclaw-spa-${SHA}.zip"
