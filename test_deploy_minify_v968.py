#!/usr/bin/env python3
"""🔴v968 部署产物 Minify 回归：状态机毒样本 / 语法闸门失败关闭 / 真实文件收益与令牌存活。"""
import importlib.util, sys, unittest
from pathlib import Path
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pr_min_test", HERE / "package_release.py")
PR = importlib.util.module_from_spec(spec); sys.modules["pr_min_test"] = PR; spec.loader.exec_module(PR)
S = PR._strip_js_comments_safe

class MinifyPoison(unittest.TestCase):
    CASES = [
        ("var u='http://a//b';//tail\nnext()", "var u='http://a//b';\nnext()"),
        ("var r=/a\\/\\/b/g;/*c*/x=1", "var r=/a\\/\\/b/g; x=1"),
        ("var t=`a ${ b /*c*/ + `in${d}` } z`;", "var t=`a ${ b   + `in${d}` } z`;"),
        ("a=b/ c;//d\ne=f", "a=b/ c;\ne=f"),
        ("/*! MIT */code()", "/*! MIT */code()"),
        ("x=1 //c\ny=2", "x=1 \ny=2"),
        ('s="he said \\"//no\\"";//real\nk()', 's="he said \\"//no\\"";\nk()'),
        ("if(a){/*x*/}else{//y\n}", "if(a){ }else{\n}"),
        ("m=`${ {a:1}['a'] }`;//t\np()", "m=`${ {a:1}['a'] }`;\np()"),
        ("return /re//g/.test(x)//c\n;", "return /re//g/.test(x)\n;"),
    ]
    def test_poison_table(self):
        for src, want in self.CASES:
            with self.subTest(src=src[:24]):
                self.assertEqual(S(src), want)

    def test_syntax_gate_fail_closed(self):
        with self.assertRaises(RuntimeError):
            PR._node_syntax_ok("var a = ;", "poison")

    def test_real_files_shrink_and_tokens_survive(self):
        appv = (HERE / "VERSION").read_text().strip()
        for name in ("hansen_review.js", "hansen_crystal.js", "hansen_review_rewards_v963.js"):
            raw = (HERE / name).read_bytes()
            out = PR._minify_entry(name, raw)
            self.assertLess(len(out), len(raw), name)
        html = (HERE / "island_animal.html").read_bytes()
        out = PR._minify_entry("island_animal.html", html)
        self.assertLess(len(out), len(html))
        text = out.decode("utf-8")
        self.assertIn(f"?v={appv}", text)                       # 资源戳存活
        self.assertNotIn("<!-- ", text.split("<script")[0])     # 头部HTML注释已剥
        sw = PR._minify_entry("sw_v944.js", (HERE / "sw_v944.js").read_bytes()).decode("utf-8")
        for tok in ("shell-", "pages-", "assets-", "icons-3"):
            self.assertIn(tok, sw)                              # 缓存代际令牌存活(HF7)

    def test_vendor_and_json_untouched(self):
        blob = b"// keep me\nexport default 1;\n"
        self.assertEqual(PR._minify_entry("vendor_x_v965.js", blob), blob)
        j = b'{"a": 1}\n'
        self.assertEqual(PR._minify_entry("island_data.json", j), j)

if __name__ == "__main__":
    unittest.main(verbosity=1)
