#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Transactional release build orchestrator.

The canonical GitHub synchronization proof is the first operation. Generation,
cache/version rewriting, checks, and packaging then happen in a temporary copy.
The source tree is updated only after every guard and both archives pass, and a
failed commit is rolled back from byte-for-byte backups.
"""

from __future__ import annotations

import glob
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parent

BACKUP_BOOTSTRAP = "hansen_backup_bootstrap_v944.js"
BACKUP_RUNTIME = "hansen_backup_v944.js"
OBSOLETE_BACKUP_RUNTIMES = ("hansen_backup_bootstrap.js", "hansen_backup.js")
SW_GATE = "hansen_sw_upgrade_gate_v944.js"
SW_WORKER = "sw_v944.js"
SW_UPGRADE_PAGE = "_sw_upgrade_v944.html"

BROWSER_GUARDS = [
    "fx_guard.py", "light_guard.py", "perf_guard.py", "img_guard.py",
    "font_guard.py", "e2e_guard.py", "impact_guard.py", "pet_guard.py",
    "sb_guard.py", "release_guard.py",
]
SKIP_ENV = {
    "fx_guard.py": "SKIP_FX_GUARD",
    "light_guard.py": "SKIP_LIGHT_GUARD",
    "perf_guard.py": "SKIP_PERF_GUARD",
    "img_guard.py": "SKIP_IMG_GUARD",
    "font_guard.py": "SKIP_FONT_GUARD",
    "e2e_guard.py": "SKIP_E2E_GUARD",
    "impact_guard.py": "SKIP_IMPACT_GUARD",
    "pet_guard.py": "SKIP_PET_GUARD",
    "sb_guard.py": "SKIP_SB_GUARD",
    "release_guard.py": "SKIP_RELEASE_GUARD",
}


def _run(args: list[str], cwd: Path, label: str, *, env: dict[str, str] | None = None) -> None:
    print(f"  ▶ {label}")
    result = subprocess.run(args, cwd=cwd, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"{label} failed with exit code {result.returncode}")


def _stage_runtime_env() -> dict[str, str]:
    """Keep browser tests portable after node_modules is omitted from the stage."""
    env = os.environ.copy()
    if env.get("HANSEN_PLAYWRIGHT_MODULE"):
        return env
    for relative in ("node_modules/playwright/index.mjs", "node_modules/playwright-core/index.mjs"):
        candidate = ROOT / relative
        if candidate.is_file():
            env["HANSEN_PLAYWRIGHT_MODULE"] = str(candidate)
            break
    return env


def _read_version(root: Path) -> str:
    value = (root / "VERSION").read_text(encoding="utf-8").strip()
    if not value.isdigit() or int(value) <= 0:
        raise RuntimeError(f"invalid VERSION: {value!r}")
    return value


def _requested_version(old: str) -> str:
    numeric = [arg for arg in sys.argv[1:] if arg.isdigit()]
    unknown = [arg for arg in sys.argv[1:] if not arg.isdigit() and not arg.startswith("--label=")]
    if unknown:
        raise RuntimeError(f"unknown arguments: {unknown}")
    new = numeric[0] if numeric else str(int(old) + 1)
    if int(new) <= int(old):
        raise RuntimeError(f"new version v{new} must be greater than current v{old}")
    return new


def _copy_source(stage: Path) -> None:
    excluded = {
        ".git", "node_modules", "releases", "release-assets", "evolution_reports",
        ".evolution_backups", "__pycache__", ".pytest_cache", ".mypy_cache",
        ".ruff_cache",
    }

    def ignore(_directory: str, names: list[str]) -> set[str]:
        ignored = {name for name in names if name in excluded or name.endswith((".zip", ".pyc"))}
        parent = Path(_directory)
        for name in names:
            candidate = parent / name
            if not candidate.is_dir() or not (candidate / "README.md").is_file():
                continue
            try:
                child_names = {child.name for child in candidate.iterdir() if child.is_file()}
            except OSError:
                continue
            if (any(item.startswith("单词大冒险_v") and item.endswith("_可直接部署.zip") for item in child_names)
                    and any(item.startswith("单词大冒险_v") and item.endswith("_含贾维斯完整源码.zip") for item in child_names)):
                ignored.add(name)
        return ignored

    shutil.copytree(ROOT, stage, dirs_exist_ok=True, ignore=ignore)


def _write_text(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".build-tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def _prepare_stage(stage: Path, old: str, new: str) -> set[str]:
    if (stage / "template.html").is_file() and (stage / "island_data.json").is_file():
        _run([sys.executable, "generate.py"], stage, "generate canonical islands")

    candidates = sorted(stage.glob("*.html")) + sorted(stage.glob("*.js"))
    if (stage / "island_data.json").is_file():
        candidates.append(stage / "island_data.json")
    # Hotfix suffixes belong only to the current product version.  Advancing to
    # a new integer version must consume the whole old stamp, never create e.g.
    # ``?v=947-hf2`` by replacing just the numeric prefix.
    pattern = re.compile(r"\?v=" + re.escape(old) + r"(?:-hf\d+)?\b")
    changed = 0
    for path in candidates:
        text = path.read_text(encoding="utf-8")
        updated, count = pattern.subn("?v=" + new, text)
        if count:
            _write_text(path, updated)
            changed += count
    print(f"  ✅ cache stamp v{old} → v{new}: {changed} replacement(s)")

    lock_path = stage / "hansen_boss_lock.js"
    lock = lock_path.read_text(encoding="utf-8")
    replacements = 0
    for variable in ("__HBU_VERSION__", "HBU_RUNTIME_VERSION"):
        lock, count = re.subn(
            variable + r"(\s*=\s*')v" + re.escape(old) + r"(')",
            variable + r"\g<1>v" + new + r"\g<2>",
            lock,
        )
        replacements += count
    if replacements == 0:
        raise RuntimeError("runtime version variables were not updated")
    _write_text(lock_path, lock)
    _write_text(stage / "VERSION", new + "\n")

    # Only these generated/versioned files are allowed to flow back to ROOT.
    return {
        path.name for path in candidates
    } | {"VERSION", "hansen_boss_lock.js"}


def _assert_backup_runtime_contract(root: Path) -> None:
    for name in (BACKUP_BOOTSTRAP, BACKUP_RUNTIME, SW_GATE, SW_WORKER, SW_UPGRADE_PAGE):
        if not (root / name).is_file():
            raise RuntimeError(f"required v944 backup runtime is missing: {name}")
    for name in OBSOLETE_BACKUP_RUNTIMES:
        if (root / name).exists():
            raise RuntimeError(f"obsolete backup runtime must not exist: {name}")
    if (root / "sw.js").exists():
        raise RuntimeError("legacy sw.js must not coexist with the v944 worker pathname")

    version = _read_version(root)
    bootstrap_tag = f'<script src="{BACKUP_BOOTSTRAP}?v={version}"></script>'
    runtime_stamp = version + ("-hf2" if version == "946" else "")
    runtime_tag = f'<script src="{BACKUP_RUNTIME}?v={runtime_stamp}"></script>'
    entries = [
        root / name for name in (
            "index.html", "_frame.html", "boss_hall.html", "season_showcase.html",
            "spelling_bee.html", "land_map.html",
        )
    ] + sorted(root.glob("island_*.html"))
    for page in entries:
        text = page.read_text(encoding="utf-8")
        first_script = re.search(r"<script\b[^>]*>", text, re.IGNORECASE)
        gate_open = f'<script src="{SW_GATE}?v={version}">'
        if not first_script or first_script.group(0) != gate_open:
            raise RuntimeError(f"{page.name} must load {SW_GATE} as its first script")
        boot_at = text.find(bootstrap_tag)
        storage_at = text.find("localStorage")
        if boot_at < 0 or (storage_at >= 0 and boot_at > storage_at):
            raise RuntimeError(
                f"{page.name} must load {BACKUP_BOOTSTRAP} before player-state reads"
            )
        if any(name in text for name in OBSOLETE_BACKUP_RUNTIMES):
            raise RuntimeError(f"{page.name} references an obsolete backup runtime")
    for page in sorted(root.glob("island_*.html")):
        if runtime_tag not in page.read_text(encoding="utf-8"):
            raise RuntimeError(f"{page.name} is missing {BACKUP_RUNTIME}")

    template = (root / "template.html").read_text(encoding="utf-8")
    if bootstrap_tag not in template or runtime_tag not in template:
        raise RuntimeError("template.html is not wired to both v944 backup runtimes")
    shell = (root / SW_WORKER).read_text(encoding="utf-8")
    if f"'./{BACKUP_BOOTSTRAP}'" not in shell or "'./hansen_backup_bootstrap.js'" in shell:
        raise RuntimeError("service-worker shell is not pinned to the v944 backup bootstrap")
    for name in (SW_GATE, SW_UPGRADE_PAGE):
        if f"'./{name}'" not in shell:
            raise RuntimeError(f"service-worker shell is missing the upgrade dependency: {name}")
    index = (root / "index.html").read_text(encoding="utf-8")
    if "serviceWorker.register('./sw_v944.js'" not in index or "serviceWorker.register('./sw.js'" in index:
        raise RuntimeError("index.html must never switch the v944 scope back to the legacy sw.js pathname")


def _syntax_and_regressions(stage: Path) -> None:
    _assert_backup_runtime_contract(stage)
    runtime_env = _stage_runtime_env()
    js_files = sorted(stage.glob("*.js"))
    if not js_files:
        raise RuntimeError("no JavaScript files found")
    for path in js_files:
        _run(["node", "--check", path.name], stage, f"node --check {path.name}")

    # Discover every versioned Node regression instead of silently skipping a
    # newly added release line (v951) or older still-supported schema test.
    node_tests = sorted(stage.glob("test_*v*.mjs"))
    if not node_tests:
        raise RuntimeError("no versioned Node regression tests found")
    for path in node_tests:
        _run(["node", path.name], stage, f"regression {path.name}", env=runtime_env)

    python_tests = sorted(stage.glob("test_*v942.py"))
    for path in python_tests:
        _run([sys.executable, path.name], stage, f"regression {path.name}", env=runtime_env)


def _guards(stage: Path) -> None:
    runtime_env = _stage_runtime_env()
    for guard in ("check_resources.py", "economy_guard.py", "hansen_nav_guard.py"):
        if not (stage / guard).is_file():
            raise RuntimeError(f"required guard is missing: {guard}")
        _run([sys.executable, guard], stage, guard, env=runtime_env)

    _run([sys.executable, "jarvis_scan.py"], stage, "Jarvis active scan", env=runtime_env)
    _run([sys.executable, "hansen_health_check.py", "--quick"], stage,
         "portable browser health check", env=runtime_env)

    for guard in BROWSER_GUARDS:
        if not (stage / guard).is_file():
            raise RuntimeError(f"required browser guard is missing: {guard}")
        skip = SKIP_ENV[guard]
        if os.environ.get(skip) == "1":
            raise RuntimeError(f"release build refuses disabled assertion wall: {skip}=1")
        _run([sys.executable, guard], stage, guard, env=runtime_env)


def _commit_stage(stage: Path, names: set[str], *, fail_at: int | None = None) -> dict[Path, bytes]:
    backups: dict[Path, bytes] = {}
    replaced: list[Path] = []
    try:
        for index, name in enumerate(sorted(names), 1):
            source = stage / name
            target = ROOT / name
            if not source.is_file() or not target.is_file():
                raise RuntimeError(f"transaction file is missing: {name}")
            data = source.read_bytes()
            if target.read_bytes() == data:
                continue
            backups[target] = target.read_bytes()
            with tempfile.NamedTemporaryFile(dir=ROOT, prefix=f".{name}.", delete=False) as handle:
                handle.write(data)
                temp_name = Path(handle.name)
            if fail_at == index:
                temp_name.unlink(missing_ok=True)
                raise RuntimeError(f"injected source commit failure at file {index}")
            os.replace(temp_name, target)
            replaced.append(target)
    except Exception:
        for target in reversed(replaced):
            restore = target.with_name("." + target.name + ".rollback")
            restore.write_bytes(backups[target])
            os.replace(restore, target)
        raise
    return backups


def _restore_source(backups: dict[Path, bytes]) -> None:
    for target, data in backups.items():
        with tempfile.NamedTemporaryFile(dir=ROOT, prefix=f".{target.name}.restore-", delete=False) as handle:
            handle.write(data)
            temp_name = Path(handle.name)
        os.replace(temp_name, target)


def _promote_release_assets(staged_dir: Path, out: Path, version: str,
                            *, fail_at: int | None = None) -> None:
    names = [
        f"单词大冒险_v{version}_可直接部署.zip",
        f"单词大冒险_v{version}_含贾维斯完整源码.zip",
        "README.md",
    ]
    expected = set(names)
    existing = {path.name for path in out.iterdir() if path.name != staged_dir.name}
    unexpected = sorted(existing - expected)
    if unexpected:
        raise RuntimeError(f"release output has unexpected entries: {unexpected}")
    pairs = [(staged_dir / name, out / name) for name in names]
    backups: list[tuple[Path, Path]] = []
    promoted: list[Path] = []
    try:
        for index, (_staged, final) in enumerate(pairs, 1):
            if final.exists():
                backup = staged_dir / f".previous-{index}-{final.name}"
                os.replace(final, backup)
                backups.append((final, backup))
        for index, (staged, final) in enumerate(pairs, 1):
            if fail_at == index:
                raise RuntimeError(f"injected release promotion failure at asset {index}")
            os.replace(staged, final)
            promoted.append(final)
    except Exception:
        for final in reversed(promoted):
            final.unlink(missing_ok=True)
        for final, backup in reversed(backups):
            if final.exists():
                final.unlink()
            os.replace(backup, final)
        raise


def main() -> int:
    # Sync is intentionally before VERSION reads, generation, temp copies, or
    # any other build action. The guard itself is fail closed in every mode.
    try:
        _run([sys.executable, "sync_guard.py", "--pre-build"], ROOT,
             "step 0: prove GitHub synchronization")
        old = _read_version(ROOT)
        new = _requested_version(old)
        print(f"== transactional build v{old} → v{new} ==")

        with tempfile.TemporaryDirectory(prefix="hansen-build-") as tmp:
            stage = Path(tmp) / "source"
            _copy_source(stage)
            commit_names = _prepare_stage(stage, old, new)
            _syntax_and_regressions(stage)
            _guards(stage)

            out = Path(os.environ.get("HANSEN_RELEASE_OUT", str(ROOT / "release-assets"))).resolve()
            out.mkdir(parents=True, exist_ok=True)
            staged_assets = Path(tempfile.mkdtemp(prefix=".hansen-build-assets-", dir=out))
            source_backups: dict[Path, bytes] = {}
            try:
                _run([sys.executable, "package_release.py", new, "--out", str(staged_assets)], stage,
                     "build and verify exactly two ZIPs + README")
                source_backups = _commit_stage(stage, commit_names)
                try:
                    _promote_release_assets(staged_assets, out, new)
                except Exception:
                    _restore_source(source_backups)
                    raise
            finally:
                shutil.rmtree(staged_assets, ignore_errors=True)

        print(f"✅✅✅ transactional build v{new} completed; source updated only after all checks")
        return 0
    except Exception as exc:
        print(f"❌ Build aborted without committing staged source changes: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
