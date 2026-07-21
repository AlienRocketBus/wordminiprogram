#!/usr/bin/env python3
"""🔴v963 回归：打包器对未登记版本必须失败关闭（交接文档要求）。

- v961/v962（永久淘汰）与任何未来未登记版本 → 一律 RuntimeError 拒绝打包；
- v942–v945 历史打包器测试 fixture → 允许跳过运行时合同（既有单元测试依赖）；
- v963 已登记 → 合同生效：SW/资源戳缺失时按 HF7 合同报错，而不是静默放行。
"""
import importlib.util
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


PACKAGE = load_module("package_release_failclosed_test", HERE / "package_release.py")


class ReleaseContractFailClosed(unittest.TestCase):
    def _entries(self, version: bytes, extra=None):
        entries = [("VERSION", version)]
        if extra:
            entries.extend(extra)
        return entries

    def test_retired_and_unknown_versions_are_rejected(self):
        for bad in (b"961", b"962", b"964", b"999", b"abc", b""):
            with self.subTest(version=bad):
                with self.assertRaises(RuntimeError) as ctx:
                    PACKAGE._verify_hf7_runtime_contract(self._entries(bad))
                self.assertIn("refusing to package", str(ctx.exception))

    def test_historical_fixture_versions_still_skip(self):
        for legacy in (b"942", b"943", b"944", b"945"):
            with self.subTest(version=legacy):
                # 不应抛错：v942 打包器单元 fixture 依赖此跳过路径。
                PACKAGE._verify_hf7_runtime_contract(self._entries(legacy))

    def test_v963_contract_is_enforced_not_skipped(self):
        # 已登记版本缺失 SW/资源戳令牌时必须按 HF7 合同报错（证明不再 fail-open）。
        with self.assertRaises(RuntimeError) as ctx:
            PACKAGE._verify_hf7_runtime_contract(
                self._entries(b"963", extra=[("sw_v944.js", b"// empty"), ("index.html", b"<html></html>")])
            )
        self.assertIn("HF7 cache/query contract mismatch", str(ctx.exception))

    def test_v963_registered_generations(self):
        gens, stamp = None, None
        # 直接读取合同表，锁定 v963 代际与戳，防未来误改。
        import inspect
        src = inspect.getsource(PACKAGE._verify_hf7_runtime_contract)
        self.assertIn('"963": (("shell-22", "pages-20", "assets-20", "icons-3"), "v=963")', src)


if __name__ == "__main__":
    unittest.main(verbosity=1)
