#!/usr/bin/env python3
"""Compute the next VERSION for staging (rc) vs master (stable promote)."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

VER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$")


def parse(ver: str) -> tuple[int, int, int, int | None]:
    m = VER_RE.fullmatch(ver.strip())
    if not m:
        raise SystemExit(f"VERSION is not semver or X.Y.Z-rc.N: {ver!r}")
    rc = int(m.group(4)) if m.group(4) is not None else None
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), rc


def bump(major: int, minor: int, patch: int, kind: str) -> tuple[int, int, int]:
    if kind == "major":
        return major + 1, 0, 0
    if kind == "minor":
        return major, minor + 1, 0
    return major, minor, patch + 1


def next_version(current: str, branch: str, kind: str) -> tuple[str, str]:
    """Return (next_version, mode) where mode is rc-first | rc-next | promote | stable-bump."""
    major, minor, patch, rc = parse(current)
    if branch == "staging":
        if rc is not None:
            return f"{major}.{minor}.{patch}-rc.{rc + 1}", "rc-next"
        nmaj, nmin, npatch = bump(major, minor, patch, kind)
        return f"{nmaj}.{nmin}.{npatch}-rc.1", "rc-first"
    if branch in ("master", "main"):
        if rc is not None:
            return f"{major}.{minor}.{patch}", "promote"
        nmaj, nmin, npatch = bump(major, minor, patch, kind)
        return f"{nmaj}.{nmin}.{npatch}", "stable-bump"
    raise SystemExit(f"no GitHub Release on branch {branch}")


def unreleased_notes(changelog: str) -> str:
    lines = changelog.splitlines()
    out: list[str] = []
    in_u = False
    for line in lines:
        if line.startswith("## [Unreleased]"):
            in_u = True
            continue
        if in_u and line.startswith("## ["):
            break
        if in_u:
            out.append(line)
    return "\n".join(out).strip()


def insert_version(changelog: str, version: str, today: str, notes: str) -> str:
    lines = changelog.splitlines()
    out: list[str] = []
    i = 0
    inserted = False
    while i < len(lines):
        line = lines[i]
        if line.startswith("## [Unreleased]"):
            out.append("## [Unreleased]")
            out.append("")
            out.append(f"## [{version}] - {today}")
            out.append(notes)
            inserted = True
            i += 1
            while i < len(lines) and not lines[i].startswith("## ["):
                i += 1
            continue
        out.append(line)
        i += 1
    if not inserted:
        raise SystemExit("CHANGELOG.md missing ## [Unreleased]")
    return "\n".join(out) + "\n"


def git_subject() -> str:
    try:
        return subprocess.check_output(
            ["git", "log", "-1", "--pretty=%s"], text=True
        ).strip()
    except subprocess.CalledProcessError:
        return "Release"


def git_branch() -> str:
    env = os.environ.get("GITHUB_REF_NAME", "").strip()
    if env:
        return env
    return subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True
    ).strip()


def run_self_test() -> None:
    assert next_version("0.1.0", "staging", "patch") == ("0.1.1-rc.1", "rc-first")
    assert next_version("0.1.1-rc.1", "staging", "patch") == ("0.1.1-rc.2", "rc-next")
    assert next_version("0.1.1-rc.3", "master", "patch") == ("0.1.1", "promote")
    assert next_version("0.1.1", "master", "patch") == ("0.1.2", "stable-bump")
    assert next_version("0.1.0", "staging", "minor") == ("0.2.0-rc.1", "rc-first")
    assert next_version("1.0.0", "staging", "major") == ("2.0.0-rc.1", "rc-first")
    print("ok")


def main() -> None:
    if "--self-test" in sys.argv:
        run_self_test()
        return
    root = Path(__file__).resolve().parent.parent
    os.chdir(root)
    name = sys.argv[1] if len(sys.argv) > 1 else root.name
    kind = os.environ.get("RELEASE_KIND", "patch")
    if len(sys.argv) > 2:
        kind = sys.argv[2]
    if git_subject().startswith("chore(release):"):
        print(Path("VERSION").read_text().strip())
        return
    current = Path("VERSION").read_text().strip()
    branch = git_branch()
    nxt, mode = next_version(current, branch, kind)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cl = Path("CHANGELOG.md").read_text()
    notes = unreleased_notes(cl)
    if not notes:
        notes = f"- {git_subject()}"
    if mode == "promote":
        notes = f"- Promoted from v{current} to v{nxt}.\n{notes}"
    Path("CHANGELOG.md").write_text(insert_version(cl, nxt, today, notes))
    Path("VERSION").write_text(nxt + "\n")
    prerelease = "-rc." in nxt
    extra = "GitHub prerelease (staging).\n\n" if prerelease else ""
    Path("RELEASE.md").write_text(
        f"# Release v{nxt}\n\nDate: {today}\n\n{extra}## This release\n\n{notes}\n\n## {name} {nxt}\n"
    )
    print(nxt)


if __name__ == "__main__":
    main()
