#!/usr/bin/env python3
"""Regression tests for the v942 fail-closed Jarvis/release toolchain."""

from __future__ import annotations

import hashlib
import json
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
import zipfile


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PACKAGE = load_module("package_release_v942_test", HERE / "package_release.py")
SCAN = load_module("jarvis_scan_v942_test", HERE / "jarvis_scan.py")
BUILD = load_module("build_v942_test", HERE / "build.py")


class PackageReleaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="v942-package-test-")
        self.base = Path(self.temp.name)
        self.root = self.base / "source"
        self.root.mkdir()
        self.original_root = PACKAGE.ROOT
        self.original_skip_jarvis = os.environ.get("HANSEN_SKIP_JARVIS")
        os.environ["HANSEN_SKIP_JARVIS"] = "1"
        PACKAGE.ROOT = self.root

        # Create the complete required source surface with harmless contents.
        for name in PACKAGE.SOURCE_REQUIRED_FILES:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_text("placeholder\n", encoding="utf-8")
        (self.root / "VERSION").write_text("942\n", encoding="utf-8")
        (self.root / "README.md").write_text("# v942 test\n", encoding="utf-8")
        (self.root / ".jarvis_pass.json").write_text("{}\n", encoding="utf-8")
        # A restored source release legitimately contains its previous archive
        # manifest.  Repackaging must replace it, never emit two same-name
        # SHA256SUMS members.
        (self.root / "SHA256SUMS").write_text(
            "0" * 64 + "  stale-release-input\n", encoding="utf-8"
        )
        (self.root / "index.html").write_text(
            '<!doctype html><link rel="manifest" href="manifest.webmanifest">'
            '<link rel="icon" href="favicon.ico"><script src="app.js"></script>',
            encoding="utf-8",
        )
        (self.root / "app.js").write_text("window.ok = true;\n", encoding="utf-8")
        (self.root / "sw_v944.js").write_text(
            "const SHELL = ['./index.html','./manifest.webmanifest','./favicon.ico','./app.js'];\n",
            encoding="utf-8",
        )
        (self.root / "manifest.webmanifest").write_text(
            '{"start_url":"./index.html","icons":[{"src":"favicon.ico"}]}',
            encoding="utf-8",
        )
        (self.root / "favicon.ico").write_bytes(b"icon")
        (self.root / "_viewer_js.js").write_text("window.devOnly=true;", encoding="utf-8")
        (self.root / "_viewer_data.json").write_text('{"generated":true}', encoding="utf-8")
        (self.root / "evolution_dashboard.html").write_text("generated report", encoding="utf-8")
        (self.root / "_wshot4.jpg").write_bytes(b"temporary screenshot")
        (self.root / "_wtest4.html").write_text("temporary reproduction", encoding="utf-8")
        (self.root / "_debug.jpg").write_bytes(b"developer screenshot")
        (self.root / "git_backup.sh").write_text("#!/bin/sh\n", encoding="utf-8")
        (self.root / "preview.html").write_text("dev preview", encoding="utf-8")
        (self.root / "hansen_inspector_report.md").write_text(
            "generated diagnostic\n", encoding="utf-8"
        )

        old = self.root / "arbitrary-old-output"
        old.mkdir()
        (old / "README.md").write_text("old release readme", encoding="utf-8")
        (old / "单词大冒险_v940_可直接部署.zip").write_bytes(b"old")
        (old / "单词大冒险_v940_含贾维斯完整源码.zip").write_bytes(b"old")

        partial = self.root / "partial-old-output"
        partial.mkdir()
        (partial / "README.md").write_text("partial release readme", encoding="utf-8")
        (partial / "单词大冒险_v939_可直接部署.zip").write_bytes(b"partial")

    def tearDown(self) -> None:
        PACKAGE.ROOT = self.original_root
        if self.original_skip_jarvis is None:
            os.environ.pop("HANSEN_SKIP_JARVIS", None)
        else:
            os.environ["HANSEN_SKIP_JARVIS"] = self.original_skip_jarvis
        self.temp.cleanup()

    @staticmethod
    def digest(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def test_reproducible_allowlisted_archives_and_manifests(self) -> None:
        out1 = self.base / "out-one"
        out2 = self.base / "out-two"
        PACKAGE.package("942", out1)
        # Checkout mtimes must not affect the ZIP byte stream.
        for path in self.root.rglob("*"):
            if path.is_file():
                os.utime(path, (1_900_000_000, 1_900_000_000))
        PACKAGE.package("942", out2)

        for template in (PACKAGE.DEPLOY_NAME, PACKAGE.SOURCE_NAME):
            name = template.format(version="942")
            self.assertEqual(self.digest(out1 / name), self.digest(out2 / name))

        deploy = out1 / PACKAGE.DEPLOY_NAME.format(version="942")
        with zipfile.ZipFile(deploy) as archive:
            members = archive.namelist()
            self.assertEqual(members.count("SHA256SUMS"), 1)
            names = set(members)
            self.assertTrue({"index.html", "sw_v944.js", "manifest.webmanifest", "VERSION",
                             "SHA256SUMS"}.issubset(names))
            self.assertTrue({"_sw_upgrade_v944.html", "hansen_sw_upgrade_gate_v944.js",
                             "hansen_backup_bootstrap_v944.js", "hansen_backup_v944.js"}
                            .issubset(names))
            self.assertTrue({"sw.js", "hansen_backup_bootstrap.js", "hansen_backup.js"}
                            .isdisjoint(names))
            self.assertNotIn("_viewer_js.js", names)
            self.assertNotIn("_debug.jpg", names)
            self.assertNotIn("git_backup.sh", names)
            self.assertNotIn("preview.html", names)

        source = out1 / PACKAGE.SOURCE_NAME.format(version="942")
        with zipfile.ZipFile(source) as archive:
            members = archive.namelist()
            self.assertEqual(members.count("SHA256SUMS"), 1)
            names = set(members)
            self.assertIn("SHA256SUMS", names)
            self.assertIn("test_sw_upgrade_v944.mjs", names)
            self.assertTrue({"sw.js", "hansen_backup_bootstrap.js", "hansen_backup.js"}
                            .isdisjoint(names))
            self.assertNotIn("arbitrary-old-output/README.md", names)
            self.assertNotIn("partial-old-output/README.md", names)
            self.assertNotIn("hansen_inspector_report.md", names)
            self.assertNotIn("_viewer_data.json", names)
            self.assertNotIn("evolution_dashboard.html", names)
            self.assertNotIn("_wshot4.jpg", names)
            self.assertNotIn("_wtest4.html", names)
            self.assertNotIn(".jarvis_pass.json", names)

    def test_jarvis_pass_is_bound_to_exact_source_tree(self) -> None:
        os.environ.pop("HANSEN_SKIP_JARVIS", None)
        guard_material = ""
        for name in ("hansen_guards_v1068.py", "check_resources.py",
                     "hansen_bug_registry.py", "jarvis_selftest.py"):
            path = self.root / name
            if path.exists():
                guard_material += hashlib.sha256(path.read_bytes()).hexdigest()[:16]
        guards = hashlib.sha256(guard_material.encode()).hexdigest()[:24]
        record = {
            "version": "942", "at": "fixture", "legacy": 0,
            "guards": guards,
            "source": PACKAGE._source_input_fingerprint(),
        }
        (self.root / ".jarvis_pass.json").write_text(
            json.dumps(record), encoding="utf-8"
        )
        PACKAGE._require_jarvis_pass("942")
        (self.root / "app.js").write_text("window.changed = true;\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "源码树在贾维斯体检之后"):
            PACKAGE._require_jarvis_pass("942")

    def test_secret_failure_preserves_previous_three_assets(self) -> None:
        out = self.base / "stable-output"
        PACKAGE.package("942", out)
        before = {path.name: self.digest(path) for path in out.iterdir()}
        (self.root / "leak.txt").write_text(
            # Keep the test credential signature out of this test source so
            # the production source archive's own secret scan can pass.
            "github_" + "pat_" + "abcdefghijklmnopqrstuvwxyz0123456789",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(RuntimeError, "secret scan rejected"):
            PACKAGE.package("942", out)
        after = {path.name: self.digest(path) for path in out.iterdir()}
        self.assertEqual(before, after)

    def test_sensitive_filename_failure_preserves_previous_three_assets(self) -> None:
        out = self.base / "stable-filename-output"
        PACKAGE.package("942", out)
        before = {path.name: self.digest(path) for path in out.iterdir()}
        # Harmless-looking contents are deliberate: the filename itself must be
        # release-blocking, rather than relying on a secret-content regex hit.
        (self.root / ".env.local").write_text("FEATURE_FLAG=true\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "sensitive credential filename"):
            PACKAGE.package("942", out)
        after = {path.name: self.digest(path) for path in out.iterdir()}
        self.assertEqual(before, after)

    def test_secret_inside_docx_failure_preserves_previous_three_assets(self) -> None:
        out = self.base / "stable-office-output"
        PACKAGE.package("942", out)
        before = {path.name: self.digest(path) for path in out.iterdir()}
        document = self.root / "design-notes.docx"
        with zipfile.ZipFile(document, "w", compression=zipfile.ZIP_DEFLATED) as office:
            office.writestr(
                "word/document.xml",
                "<w:t>github_" + "pat_" + "abcdefghijklmnopqrstuvwxyz0123456789</w:t>",
            )
        with self.assertRaisesRegex(RuntimeError, "secret scan rejected"):
            PACKAGE.package("942", out)
        after = {path.name: self.digest(path) for path in out.iterdir()}
        self.assertEqual(before, after)

    def test_mid_promotion_failure_rolls_back_entire_asset_set(self) -> None:
        stage = self.base / "promotion-stage"
        final = self.base / "promotion-final"
        stage.mkdir()
        final.mkdir()
        pairs = []
        for index in range(1, 4):
            staged = stage / f"asset-{index}"
            target = final / f"asset-{index}"
            staged.write_bytes(f"new-{index}".encode())
            target.write_bytes(f"old-{index}".encode())
            pairs.append((staged, target))
        with self.assertRaisesRegex(RuntimeError, "injected promotion failure"):
            PACKAGE._promote_assets(pairs, stage, fail_at=2)
        self.assertEqual(
            [path.read_text() for _, path in pairs],
            ["old-1", "old-2", "old-3"],
        )

    def test_post_promotion_verification_failure_rolls_back_entire_asset_set(self) -> None:
        stage = self.base / "post-promotion-stage"
        final = self.base / "post-promotion-final"
        stage.mkdir()
        final.mkdir()
        pairs = []
        for index in range(1, 4):
            staged = stage / f"asset-{index}"
            target = final / f"asset-{index}"
            staged.write_bytes(f"new-{index}".encode())
            target.write_bytes(f"old-{index}".encode())
            pairs.append((staged, target))

        def reject_promoted_bytes() -> None:
            raise RuntimeError("injected post-promotion verification failure")

        with self.assertRaisesRegex(RuntimeError, "post-promotion verification failure"):
            PACKAGE._promote_assets(pairs, stage, verify=reject_promoted_bytes)
        self.assertEqual(
            [path.read_text() for _, path in pairs],
            ["old-1", "old-2", "old-3"],
        )


class JarvisCredibilityTests(unittest.TestCase):
    @staticmethod
    def inspector_source() -> str:
        return (HERE / "hansen_inspector.py").read_text(encoding="utf-8")

    def test_inspector_boss_modulo_guard_is_scoped_to_boss_functions(self) -> None:
        inspector = self.inspector_source()
        self.assertIn('start = _st.find("function nextBossQ()")', inspector)
        self.assertIn('not re.search(r"%(?:\\s*)4\\b", boss_build + boss_answer)', inspector)
        self.assertIn("consumes_dynamic", inspector)
        self.assertNotIn('no_mod4 = ("%4" not in _st)', inspector)

    def test_inspector_percent_marker_cannot_crash_string_formatting(self) -> None:
        inspector = self.inspector_source()
        self.assertIn(
            'f"boss 选项可能越界 (函数内含%4={not no_mod4}, 动态生成={dyn}, 动态正解={consumes_dynamic})"',
            inspector,
        )
        self.assertNotIn(
            '"boss 选项可能越界 (含%4=%s, findIndex=%s)" %',
            inspector,
        )

    def test_inspector_checkin_guard_requires_authoritative_receipt(self) -> None:
        inspector = self.inspector_source()
        for required in (
            "function officialCheckinReceipt(value)",
            "HansenCheckin.getReceipt(requested.day)",
            "function settleChestReceipt(value)",
            "result&&result.ok===true?officialCheckinReceipt(result):null",
        ):
            self.assertIn(required, inspector)
        self.assertNotIn('(\"HansenCheckin\" not in a) or (\"claimedToday\" not in a)', inspector)

    def test_inspector_package_size_uses_deploy_allowlist_and_shell_budget(self) -> None:
        inspector = self.inspector_source()
        self.assertIn('package_release._iter_files("deploy"', inspector)
        self.assertIn("shell_total > 2 * 1048576", inspector)
        self.assertIn("total > 100 * 1048576", inspector)
        self.assertNotIn('total = dir_size(".")', inspector)

    def test_inspector_preload_guard_recognizes_bounded_on_demand_policy(self) -> None:
        inspector = self.inspector_source()
        self.assertIn("sentence_builder_dormant", inspector)
        self.assertIn("global_word_builder_dormant", inspector)
        self.assertIn('"preloadAudioBatch(islandWords, 3"', inspector)
        self.assertIn('"var CAP = 8"', inspector)

    def test_inspector_theme_guard_proves_shared_catalog_and_split_wallets(self) -> None:
        inspector = self.inspector_source()
        self.assertIn("shared_unlock", inspector)
        self.assertIn("same_catalog", inspector)
        self.assertIn("routed", inspector)
        self.assertIn('"HansenGems" in dia', inspector)

    def test_jarvis_recognizes_strict_diamond_theme_ownership_guard(self) -> None:
        required = (
            '"!_diamondMeta(id)"',
            '"!Object.prototype.hasOwnProperty.call(o.owned,id)"',
            '"o.owned[id]!==true"',
        )
        inspector = self.inspector_source()
        evolve = (HERE / "hansen_evolve.py").read_text(encoding="utf-8")
        for token in required:
            self.assertIn(token, inspector)
            self.assertIn(token, evolve)
        self.assertNotIn('"!o.owned[id]) return"', inspector)
        self.assertNotIn('"!o.owned[id]) return"', evolve)

    def test_inspector_day_guard_tracks_v942_authorities(self) -> None:
        inspector = self.inspector_source()
        self.assertIn("ANSWER_LEDGER_KEY='hansen_answer_coin_words_v942'", inspector)
        self.assertIn("checkin_ok = _has", inspector)
        self.assertIn("quest_ok = _has", inspector)
        self.assertIn('"pending.day !== day"', inspector)
        self.assertNotIn('season_ok = _has("hansen_season.js", "o.day!==t")', inspector)

    def test_evolve_sw_gate_compares_opening_tag_to_opening_tag(self) -> None:
        evolve = (HERE / "hansen_evolve.py").read_text(encoding="utf-8")
        self.assertIn(
            "gate_open = '<script src=\"hansen_sw_upgrade_gate_v944.js?v=%s\">' % cache_version",
            evolve,
        )
        self.assertIn("first.group(0) != gate_open", evolve)
        self.assertNotIn("gate_tag = '<script src=\"hansen_sw_upgrade_gate_v944.js?v=%s\"></script>'", evolve)

    def test_inspector_browser_probes_honor_portable_chromium_path(self) -> None:
        inspector = self.inspector_source()
        marker = "executablePath:process.env.HANSEN_CHROMIUM_PATH||undefined"
        self.assertEqual(inspector.count(marker), 3)
        self.assertEqual(inspector.count('args:["--no-sandbox"]'), 3)

        for filename in ("hansen_nav_guard.py", "hansen_overflow_audit.py"):
            source = (HERE / filename).read_text(encoding="utf-8")
            self.assertIn('os.environ.get("HANSEN_CHROMIUM_PATH")', source)
            self.assertIn('os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")', source)
            self.assertIn('"args": ["--no-sandbox"]', source)
            self.assertIn('launch_options["executable_path"] = executable', source)

    def test_inspector_uses_current_word_map_and_exact_version_banner_contract(self) -> None:
        inspector = self.inspector_source()
        boss_lock = (HERE / "hansen_boss_lock.js").read_text(encoding="utf-8")
        self.assertIn("WORD_MAP_EXPECTED = 696", inspector)
        self.assertIn('d["wm"] != WORD_MAP_EXPECTED', inspector)
        self.assertIn('d["wm"] == WORD_MAP_EXPECTED', inspector)
        self.assertNotIn('d["wm"] != 154', inspector)
        self.assertNotIn('d["wm"] == 154', inspector)
        marker = "__hansen_version_mismatch_warning"
        self.assertIn(f"document.getElementById('{marker}')", inspector)
        self.assertIn(f"w.id = '{marker}'", boss_lock)
        self.assertNotIn('document.querySelectorAll("div").forEach', inspector)

    def test_resource_guard_counts_single_and_double_quoted_word_map_keys(self) -> None:
        guard = (HERE / "check_resources.py").read_text(encoding="utf-8")
        self.assertIn("bad_count = len(keys) != 696", guard)
        self.assertIn("for m in re.findall", guard)
        self.assertIn(r"(['\"])(.*?)\1", guard)
        word_map = (HERE / "word_map.js").read_text(encoding="utf-8")
        self.assertEqual(word_map.count('"t-shirt": "words/tshirt.mp3"'), 1)
        self.assertNotIn("'t-shirt': 'words/tshirt.mp3'", word_map)

    def test_inspector_behavior_probes_use_mobile_pages_and_fail_closed(self) -> None:
        inspector = self.inspector_source()
        self.assertEqual(inspector.count("newContext({viewport:{width:360,height:640}})"), 3)
        self.assertIn('firstState.path!=="/"+FIRST', inspector)
        self.assertIn('"land1","land2","land3","land4","land5","land6","land7","land8"', inspector)
        self.assertIn('add(ERROR, "签到", "ci_norun"', inspector)
        self.assertIn('add(ERROR, "赛季", "siso_norun"', inspector)

    def test_inspector_enforces_read_only_legacy_season_on_all_pages(self) -> None:
        inspector = self.inspector_source()
        for required in (
            "HansenSeason.pointsReadOnly===true",
            "HansenSeason.addPoints(999)",
            "HansenSeason.nextMilestone()",
            "readonly-answer-sentinel",
            "readonly-boss-sentinel",
            'ctx["islands"] + ctx["extra_islands"]',
        ):
            self.assertIn(required, inspector)
        self.assertNotIn("seasonDelta", inspector)
        self.assertNotIn("仅赛季岛 island_season.html 累加", inspector)

    def test_info_lowers_score_and_scanner_exception_is_critical(self) -> None:
        report = SCAN.Report()
        report.add(SCAN.INFO, "test", "recommendation")
        self.assertLess(report.score(), 100)

        original = SCAN.SCANNERS
        try:
            def broken(_report):
                raise RuntimeError("boom")
            SCAN.SCANNERS = [("broken", broken)]
            failed = SCAN.run_all()
            self.assertEqual(len(failed.by_sev(SCAN.CRIT)), 1)
            self.assertEqual(failed.by_sev(SCAN.CRIT)[0].get("runner"), "broken")
        finally:
            SCAN.SCANNERS = original

    def test_health_and_sync_are_portable_and_fail_closed(self) -> None:
        health = (HERE / "hansen_health_check.py").read_text(encoding="utf-8")
        for forbidden in ("/home/claude", "/opt/pw-browsers", "ckLoad(", "ckAdd(",
                          "done_G", "pkill"):
            self.assertNotIn(forbidden, health)
        self.assertIn("assertions did not all execute", health)
        self.assertIn("Playwright is not installed", health)
        self.assertIn("stderr=subprocess.DEVNULL", health)

        sync = (HERE / "sync_guard.py").read_text(encoding="utf-8")
        self.assertNotIn('replace("https://",', sync)
        self.assertNotIn("%s@", sync)
        self.assertIn("Remote HEAD", sync)
        self.assertIn("fail closed", sync)

    def test_workflow_and_legacy_packager_are_immutable(self) -> None:
        workflow = (HERE / ".github/workflows/jarvis-three-file-release.yml").read_text(
            encoding="utf-8"
        )
        for forbidden in ("force=true", "--clobber", "gh release delete-asset"):
            self.assertNotIn(forbidden, workflow)
        for required in ("Require a new immutable VERSION", "--draft",
                         "Refusing to rewrite immutable release", "release_id"):
            self.assertIn(required, workflow)

        evolve = (HERE / "hansen_evolve.py").read_text(encoding="utf-8")
        self.assertIn("legacy release packager is disabled in v942", evolve)
        self.assertIn("run.by(ERROR) or run.by(WARN)", evolve)

    def test_build_source_commit_failure_restores_original_tree(self) -> None:
        with tempfile.TemporaryDirectory(prefix="v942-build-transaction-") as tmp:
            root = Path(tmp) / "root"
            stage = Path(tmp) / "stage"
            root.mkdir()
            stage.mkdir()
            for name in ("a.js", "b.js"):
                (root / name).write_text("old-" + name, encoding="utf-8")
                (stage / name).write_text("new-" + name, encoding="utf-8")
            original = BUILD.ROOT
            BUILD.ROOT = root
            try:
                with self.assertRaisesRegex(RuntimeError, "injected source commit failure"):
                    BUILD._commit_stage(stage, {"a.js", "b.js"}, fail_at=2)
                self.assertEqual((root / "a.js").read_text(), "old-a.js")
                self.assertEqual((root / "b.js").read_text(), "old-b.js")
            finally:
                BUILD.ROOT = original

    def test_build_copy_omits_custom_old_release_directory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="v942-build-copy-") as tmp:
            root = Path(tmp) / "root"
            stage = Path(tmp) / "stage"
            old = root / "my-downloads"
            old.mkdir(parents=True)
            (root / "app.js").write_text("ok", encoding="utf-8")
            (old / "README.md").write_text("old", encoding="utf-8")
            (old / "单词大冒险_v940_可直接部署.zip").write_bytes(b"old")
            (old / "单词大冒险_v940_含贾维斯完整源码.zip").write_bytes(b"old")
            original = BUILD.ROOT
            BUILD.ROOT = root
            try:
                BUILD._copy_source(stage)
                self.assertTrue((stage / "app.js").is_file())
                self.assertFalse((stage / "my-downloads").exists())
            finally:
                BUILD.ROOT = original


if __name__ == "__main__":
    unittest.main(verbosity=2)
