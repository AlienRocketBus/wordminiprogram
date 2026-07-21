#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fail-closed local checkout ↔ GitHub synchronization guard.

The guard proves equality only when all evidence is available. Remote
unreachability, authentication failure, a dirty tracked file, an untracked
file, a missing tracked file, or a different HEAD is always a hard failure.
Authentication is delegated to Git/GitHub CLI credential configuration; a
token is never embedded in a URL or subprocess argument.
"""

from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parent
EXPECTED_REPOSITORY = "AlienRocketBus/wordminiprogram"


def _run(args: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)


def _problem(problems: list[str], label: str, detail: str) -> None:
    problems.append(detail)
    print(f"   {label:<22} ❌ {detail}")


def _remote_matches(url: str) -> bool:
    clean = url.strip().removesuffix(".git").lower()
    expected = re.escape(EXPECTED_REPOSITORY.lower())
    return bool(
        re.fullmatch(r"https://github\.com/" + expected, clean)
        or re.fullmatch(r"git@github\.com:" + expected, clean)
        or re.fullmatch(r"ssh://git@github\.com/" + expected, clean)
    )


def main() -> int:
    # --strict and --pre-build are retained as no-op compatibility flags. v942
    # intentionally removed their permissive behavior.
    unknown = [arg for arg in sys.argv[1:] if arg not in {"--strict", "--pre-build"}]
    if unknown:
        print(f"❌ unknown arguments: {unknown}", file=sys.stderr)
        return 2

    print("  ══ Workspace ↔ GitHub synchronization proof (fail closed) ══\n")
    problems: list[str] = []

    inside = _run(["git", "rev-parse", "--is-inside-work-tree"])
    if inside.returncode != 0 or inside.stdout.strip() != "true":
        _problem(problems, "① Git worktree", "current source is not a Git worktree")
        return 1
    print("   ① Git worktree          ✅ detected")

    fsck = _run(["git", "fsck", "--no-progress", "--no-dangling"], timeout=300)
    if fsck.returncode != 0:
        _problem(problems, "② Object integrity", (fsck.stderr or fsck.stdout).strip()[:300])
    else:
        print("   ② Object integrity      ✅ git fsck passed")

    status = _run(["git", "status", "--porcelain=v1", "--untracked-files=all"])
    if status.returncode != 0:
        _problem(problems, "③ Workspace state", "git status could not be executed")
    else:
        lines = [line for line in status.stdout.splitlines() if line.strip()]
        untracked = [line[3:] for line in lines if line.startswith("?? ")]
        tracked_dirty = [line for line in lines if not line.startswith("?? ")]
        if tracked_dirty:
            _problem(problems, "③ Tracked files", f"{len(tracked_dirty)} tracked change(s) are uncommitted")
            for line in tracked_dirty[:6]:
                print(f"        {line}")
        else:
            print("   ③ Tracked files         ✅ clean")
        if untracked:
            _problem(problems, "④ Untracked files", f"{len(untracked)} untracked file(s) are not backed up")
            for name in untracked[:6]:
                print(f"        {name}")
        else:
            print("   ④ Untracked files       ✅ none")

    remote_name = os.environ.get("HANSEN_GIT_REMOTE", "origin").strip() or "origin"
    remote_url_result = _run(["git", "remote", "get-url", remote_name])
    if remote_url_result.returncode != 0:
        _problem(problems, "⑤ GitHub remote", f"remote {remote_name!r} is missing")
        remote_url = ""
    else:
        remote_url = remote_url_result.stdout.strip()
        if not _remote_matches(remote_url):
            _problem(problems, "⑤ GitHub remote", "remote does not point to the canonical repository")
        else:
            print(f"   ⑤ GitHub remote         ✅ {remote_name} points to {EXPECTED_REPOSITORY}")

    local_result = _run(["git", "rev-parse", "HEAD"])
    local = local_result.stdout.strip() if local_result.returncode == 0 else ""
    if not local:
        _problem(problems, "⑥ Local HEAD", "could not resolve local HEAD")

    remote = ""
    if remote_url:
        # Use the configured remote name. Git credential helpers may consume
        # GH_TOKEN internally, but the secret never appears in argv or a URL.
        remote_result = _run(
            ["git", "ls-remote", "--exit-code", remote_name, "refs/heads/main"],
            timeout=120,
        )
        if remote_result.returncode != 0 or not remote_result.stdout.strip():
            detail = (remote_result.stderr or "remote main HEAD unavailable").strip()[:300]
            _problem(problems, "⑦ Remote HEAD", detail)
        else:
            remote = remote_result.stdout.split()[0].strip()
            print(f"   ⑦ Remote HEAD           ✅ fetched evidence {remote[:12]}")

    if local and remote:
        if local != remote:
            _problem(problems, "⑧ HEAD equality", f"local {local[:12]} != remote {remote[:12]}")
        else:
            print(f"   ⑧ HEAD equality         ✅ {local[:12]}")
    elif not any("Remote HEAD" in p for p in problems):
        _problem(problems, "⑧ HEAD equality", "comparison was not executed")

    print()
    if problems:
        print(f"  ⛔ Synchronization proof failed with {len(problems)} blocking problem(s).")
        print("     No equality claim is made. Resolve every item before building or editing.")
        return 1

    print("  ✅ Equality proved: valid repository + clean tracked/untracked state + local HEAD == remote main HEAD")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
