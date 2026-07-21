#!/usr/bin/env python3
"""Replay template v941 -> v942 common-shell changes onto the eight Land pages.

The Land pages contain hand-tuned vocabulary, boss values and per-page progress
identities, so regenerating them from ``template.html`` would destroy data.  This
tool performs a small three-way-style migration instead: every unified-diff hunk
between the supplied v941 base template and the current template must match each
Land page exactly after substituting that page's simple identity placeholders.
If a hunk is ambiguous, or a Land invariant changes, the run fails before any
file is replaced.

Usage:
    python3 sync_land_v942.py --base-template /path/to/v941/template.html
"""

from __future__ import annotations

import argparse
import difflib
import os
from pathlib import Path
import re
import tempfile


ROOT = Path(__file__).resolve().parent
TOKEN = "⟦⟦ISLE_{name}⟧⟧"
BOSS_LINE_TOKEN = "⟦⟦ISLE_BOSS_LINE⟧⟧"
LEGACY_LAND_PERF_COMMENT = "<!-- 🔴v858 性能引擎: 滚动动画闸门+图片卫生 -->"
CURRENT_LAND_PERF_COMMENT = "<!-- v944 性能引擎: 图片卫生·滚动不暂停主题 -->"


def _identity(html: str, number: int) -> dict[str, str]:
    title = re.search(r"<title>(.*?) · (.*?)</title>", html)
    en_isle = re.search(
        re.escape(">" + title.group(1) + "</div>")
        + r'\s*<div[^>]*letter-spacing:1px">([^<]+)</div>',
        html,
    )
    theme = re.search(r"9 个洞同时出([^！]+)！", html)
    boss_line = re.search(r'^\s*<img class="boss-card-img"[^\n]*\n?', html, re.M)
    boss_label = re.search(
        r'<div class="d-label boss-card-label" style="color:([^;!]+)!important;',
        html,
    )
    avatars = re.search(r'^const avatars=\[[^\n]+\];$', html, re.M)
    if not title or not en_isle or not theme or not boss_line or not boss_label or not avatars:
        raise RuntimeError(f"Land{number}: cannot extract page identity")
    return {
        TOKEN.format(name="ZH"): title.group(1),
        TOKEN.format(name="ENTITLE"): title.group(2),
        TOKEN.format(name="ENISLE"): en_isle.group(1),
        TOKEN.format(name="THEME"): theme.group(1),
        TOKEN.format(name="KEY"): f"wordIslandLand{number}",
        TOKEN.format(name="SHORTKEY"): f"land{number}",
        TOKEN.format(name="BLABEL"): boss_label.group(1),
        TOKEN.format(name="AVATARS"): avatars.group(0),
        # Land 的 Boss 入口图是手工内嵌 data URI，不是模板的 icons/<name>。
        # 将整行视为不透明身份数据，公共壳迁移绝不能改写或丢失它。
        BOSS_LINE_TOKEN: boss_line.group(0).rstrip("\r\n"),
    }


def _hunks(base: str, target: str) -> list[tuple[str, str]]:
    # BOSSICON 所在整行在 Land 中是专属 data URI；先在两份模板中归一成同一
    # 哨兵，使资源戳升级不会把它误当作公共壳改动。哨兵稍后再按页还原。
    opaque_line = re.compile(r'^\s*<img class="boss-card-img"[^\n]*\n?', re.M)
    base, base_count = opaque_line.subn(BOSS_LINE_TOKEN + "\n", base)
    target, target_count = opaque_line.subn(BOSS_LINE_TOKEN + "\n", target)
    if base_count != 1 or target_count != 1:
        raise RuntimeError(
            f"boss-card identity line count changed (base={base_count}, target={target_count})"
        )
    lines = list(
        difflib.unified_diff(
            base.splitlines(keepends=True),
            target.splitlines(keepends=True),
            fromfile="template-v941.html",
            tofile="template-v942.html",
            n=3,
        )
    )
    result: list[tuple[str, str]] = []
    old: list[str] | None = None
    new: list[str] | None = None
    for line in lines:
        if line.startswith("@@"):
            if old is not None and new is not None:
                result.append(("".join(old), "".join(new)))
            old, new = [], []
            continue
        if old is None or new is None or line.startswith(("---", "+++")):
            continue
        if line.startswith(" "):
            old.append(line[1:])
            new.append(line[1:])
        elif line.startswith("-"):
            old.append(line[1:])
        elif line.startswith("+"):
            new.append(line[1:])
        elif line.startswith("\\ No newline"):
            continue
        else:
            raise RuntimeError(f"unrecognized diff line: {line[:80]!r}")
    if old is not None and new is not None:
        result.append(("".join(old), "".join(new)))
    if not result:
        raise RuntimeError("base and target templates have no changes")
    return result


def _substitute(text: str, identity: dict[str, str], number: int) -> str:
    for placeholder, value in identity.items():
        text = text.replace(placeholder, value)
    unresolved = sorted(set(re.findall(r"⟦⟦ISLE_[A-Z]+⟧⟧", text)))
    if unresolved:
        raise RuntimeError(
            f"Land{number}: diff hunk crosses unsupported data slots: {unresolved}"
        )
    return text


def _validate(before: str, after: str, number: int) -> None:
    invariants = {
        "word entries": (before.count("{en:"), after.count("{en:")),
        "spell-bee identity": (
            before.count(f"HansenSpellBee.open('land{number}')"),
            after.count(f"HansenSpellBee.open('land{number}')"),
        ),
        "linear progress identity": (
            before.count(f"land{number}_prog"),
            after.count(f"land{number}_prog"),
        ),
        "map-clear identity": (
            before.count("'hsn_landmap_cleared_'+_smm[1]"),
            after.count("'hsn_landmap_cleared_'+_smm[1]"),
        ),
    }
    for label, (old_count, new_count) in invariants.items():
        if old_count != new_count or old_count < 1:
            raise RuntimeError(
                f"Land{number}: {label} changed ({old_count} -> {new_count})"
            )
    if after.count(f"wordIslandLand{number}") < 2:
        raise RuntimeError(f"Land{number}: save identity was lost")
    data = after[after.index("const DATA=[") : after.index("const allW=")]
    bosses = after[
        after.index("const BOSSES=[") : after.index("//🔴v811", after.index("const BOSSES=["))
    ]
    if data.count("{en:") != 30:
        raise RuntimeError(f"Land{number}: expected 30 words")
    if bosses.count("{name:") != 5:
        raise RuntimeError(f"Land{number}: expected 5 bosses")
    if "⟦⟦ISLE_" in after:
        raise RuntimeError(f"Land{number}: unresolved template placeholder")
    if number == 8:
        hp = [int(value) for value in re.findall(r"hp:(\d+)", bosses)]
        if hp != [760, 880, 1000, 1150, 1300]:
            raise RuntimeError(f"Land8: hand-tuned boss HP changed: {hp}")
        if "星核帝皇·弗沙欧" not in bosses:
            raise RuntimeError("Land8: final boss identity changed")


def migrate(base: str, target: str, page: str, number: int) -> str:
    identity = _identity(page, number)
    # Land 页历史上只漏同步了这一段纯注释，导致相邻脚本资源戳组成的统一 hunk
    # 无法三方匹配。先把等价注释归一；不触碰任何词库、Boss 数值或存档身份。
    migrated = page.replace(LEGACY_LAND_PERF_COMMENT, CURRENT_LAND_PERF_COMMENT)
    for index, (old_hunk, new_hunk) in enumerate(_hunks(base, target), 1):
        old_hunk = _substitute(old_hunk, identity, number)
        new_hunk = _substitute(new_hunk, identity, number)
        old_count = migrated.count(old_hunk)
        new_count = migrated.count(new_hunk)
        if old_count == 1:
            migrated = migrated.replace(old_hunk, new_hunk, 1)
        elif old_count == 0 and new_count == 1:
            # Idempotent rerun: this hunk is already applied.
            continue
        else:
            raise RuntimeError(
                f"Land{number}: hunk {index} is not uniquely applicable "
                f"(old={old_count}, new={new_count})"
            )
    _validate(page, migrated, number)
    return migrated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-template", required=True, type=Path)
    parser.add_argument("--check", action="store_true", help="validate without writing")
    args = parser.parse_args()

    base = args.base_template.read_text(encoding="utf-8")
    target = (ROOT / "template.html").read_text(encoding="utf-8")
    outputs: list[tuple[Path, str]] = []
    for number in range(1, 9):
        path = ROOT / f"island_land{number}.html"
        page = path.read_text(encoding="utf-8")
        outputs.append((path, migrate(base, target, page, number)))

    if args.check:
        print(f"Land sync check: {len(outputs)} pages, all hunks and invariants valid")
        return

    staged: list[tuple[Path, Path]] = []
    try:
        for path, content in outputs:
            fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=ROOT)
            temp_path = Path(temp_name)
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            staged.append((path, temp_path))
        for path, temp_path in staged:
            os.replace(temp_path, path)
        print(f"Land sync: migrated {len(outputs)} pages with all invariants preserved")
    finally:
        for _, temp_path in staged:
            if temp_path.exists():
                temp_path.unlink()


if __name__ == "__main__":
    main()
