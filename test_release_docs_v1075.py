#!/usr/bin/env python3
"""v1075 release documentation and pipeline contract."""

import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
HEADINGS = (
    "### 背景与根因", "### 实现", "### 兼容", "### 测试", "### 发布与部署",
)


def section(text: str, version: str) -> str:
    match = re.search(rf"^##\s+v{version}\b.*$", text, re.MULTILINE)
    if not match:
        return ""
    next_match = re.search(r"^##\s+v\d+\b.*$", text[match.end():], re.MULTILINE)
    end = match.end() + next_match.start() if next_match else len(text)
    return text[match.start():end]


class ReleaseDocumentationV1075Tests(unittest.TestCase):
    def test_version_and_packaging_contract_are_v1075(self) -> None:
        self.assertEqual((ROOT / "VERSION").read_text(encoding="utf-8").strip(), "1075")
        package_json = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        package_lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(package_json["version"], "1075.0.0")
        self.assertEqual(package_lock["version"], "1075.0.0")
        self.assertEqual(package_lock["packages"][""]["version"], "1075.0.0")

        package = (ROOT / "package_release.py").read_text(encoding="utf-8")
        self.assertIn(
            '"1075": (("shell-134", "pages-132", "assets-132", "icons-3"), "v=1075"),',
            package,
        )
        source_required = package.split("SOURCE_REQUIRED_FILES = {", 1)[1].split("}", 1)[0]
        for required in ("云存档_开通指南_v965.md", "部署说明_解决打开变下载.md"):
            self.assertIn(f'"{required}"', source_required)

    def test_readme_and_release_asset_are_identical_and_detailed(self) -> None:
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        asset = (ROOT / "release-assets" / "README.md").read_text(encoding="utf-8")
        self.assertEqual(readme, asset)
        self.assertIn(f"> 当前代码版本：**v{version}**", readme)
        current = section(readme, version)
        self.assertGreaterEqual(len(current), 1200)
        for heading in HEADINGS:
            self.assertIn(heading, current)

    def test_changelog_has_full_current_version_contract(self) -> None:
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        current = section((ROOT / "CHANGELOG.md").read_text(encoding="utf-8"), version)
        self.assertGreaterEqual(len(current), 800)
        for heading in HEADINGS:
            self.assertIn(heading, current)

    def test_bump_fails_before_writes_when_docs_are_incomplete(self) -> None:
        source = (ROOT / "bump_version.py").read_text(encoding="utf-8")
        self.assertIn("_require_release_docs(new)", source)
        self.assertLess(source.index("_require_release_docs(new)"), source.index("changes: list[str]"))
        self.assertNotIn("def _readme_reminder", source)

    def test_release_attestation_and_single_publisher(self) -> None:
        package = (ROOT / "package_release.py").read_text(encoding="utf-8")
        self.assertIn('".jarvis_pass.json"', package)
        self.assertIn("_source_input_fingerprint", package)
        canonical = (ROOT / ".github/workflows/jarvis-three-file-release.yml").read_text(encoding="utf-8")
        legacy = (ROOT / ".github/workflows/auto-release.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch", legacy)
        self.assertNotIn("branches:\n      - main", legacy)
        self.assertIn("python_tests=(./test_*v*.py)", canonical)
        self.assertIn("wordminiprogram_v", canonical)
        self.assertIn("generate_land.py --verify", canonical)
        self.assertIn("test_auth_vendor_v1075.mjs", package)


if __name__ == "__main__":
    unittest.main(verbosity=2)
