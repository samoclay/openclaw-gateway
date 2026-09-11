#!/usr/bin/env bash
# Bump VERSION, CHANGELOG.md, RELEASE.md. Prints the new version (last line).
# Does not git commit. If HEAD is chore(release):, prints current VERSION and exits 0.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NAME="${1:-$(basename "$ROOT")}"
KIND="${2:-patch}"

if git log -1 --pretty=%s 2>/dev/null | grep -q '^chore(release):'; then
  tr -d '[:space:]' < VERSION
  exit 0
fi

current="$(tr -d '[:space:]' < VERSION)"
IFS=. read -r major minor patch <<<"$current"
major="${major:-0}"
minor="${minor:-0}"
patch="${patch:-0}"

if [[ -n "${GITHUB_SHA:-}" ]] && command -v gh >/dev/null 2>&1 && [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  labels="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/pulls" --jq '.[].labels[].name' 2>/dev/null || true)"
  if echo "$labels" | grep -qx 'release:major'; then KIND=major
  elif echo "$labels" | grep -qx 'release:minor'; then KIND=minor
  fi
fi

case "$KIND" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  *) patch=$((patch + 1)) ;;
esac
next="${major}.${minor}.${patch}"
today="$(date -u +%Y-%m-%d)"

notes="$(python3 - <<'PY'
from pathlib import Path
text = Path("CHANGELOG.md").read_text()
lines = text.splitlines()
out = []
in_unreleased = False
for line in lines:
    if line.startswith("## [Unreleased]"):
        in_unreleased = True
        continue
    if in_unreleased and line.startswith("## ["):
        break
    if in_unreleased:
        out.append(line)
body = "\n".join(out).strip()
print(body)
PY
)"
if [[ -z "$notes" ]]; then
  notes="- $(git log -1 --pretty=%s 2>/dev/null || echo "Release ${next}")"
fi

NOTES="$notes" NEXT="$next" TODAY="$today" python3 - <<'PY'
from pathlib import Path
import os
next_v = os.environ["NEXT"]
today = os.environ["TODAY"]
notes = os.environ["NOTES"]
text = Path("CHANGELOG.md").read_text()
lines = text.splitlines()
out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith("## [Unreleased]"):
        out.append("## [Unreleased]")
        out.append("")
        out.append(f"## [{next_v}] - {today}")
        out.append(notes)
        i += 1
        while i < len(lines) and not lines[i].startswith("## ["):
            i += 1
        continue
    out.append(line)
    i += 1
Path("CHANGELOG.md").write_text("\n".join(out) + "\n")
PY

printf '%s\n' "$next" > VERSION

cat > RELEASE.md <<EOF
# Release v${next}

Date: ${today}

## This release

${notes}

## ${NAME} ${next}
EOF

echo "$next"
