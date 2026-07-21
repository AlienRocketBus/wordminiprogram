#!/usr/bin/env python3
"""font_guard.py (v934) — 卡通字体子集守卫

Hansen: "为什么我每次让你新做一件事总会出现新的 bug?"

★ 这个守卫要钉死的 bug(v929 埋的, 一直没人发现):
   v929 为了提速, 把 cartoon_font.woff2 从 613KB(1694字) 子集化到 244KB(1060字)。
   子集化的时候【只按当时想到的那些字】留, 结果砍掉了 562 个【真的会显示出来】的字。
   后果非常隐蔽: 缺字不会报错、不会空白, 浏览器会【悄悄回退到系统默认字体】——
   那几个字就和旁边的卡通字长得不一样。这种问题肉眼极难发现, 但一旦发现就是"怎么又冒出个 bug"。

★ 守卫做法(必须真机渲染, 静态扫文件没用):
   走遍全库每个屏 + 每个单词弹窗, 找出所有【计算后的 font-family 真的落到卡通字体上】的元素,
   把它们【真的画出来】的每一个字收集起来, 再去字体的 cmap 里逐字查。
   缺任何一个 → 拒绝打包。
   (emoji / 箭头 / ⌫ 这类符号排除 —— 它们永远由系统表情字体画, 本来就不该在网页字体里。)

★ 为什么静态扫文件不行: 代码注释里的中文、日志字符串里的中文, 都不会显示给用户;
   而真正显示的字散落在成就名/宠物名/任务标题/按钮/弹窗标题/提示条里。
   只有真的渲染出来, 才知道到底哪些字会用卡通字体画。
"""
import json
import os
import signal
import subprocess
import sys
import time

PORT = "8892"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."


def font_char(ch):
    o = ord(ch)
    return (0x20 <= o <= 0x7E) or (0x4E00 <= o <= 0x9FFF) or (0x3000 <= o <= 0x303F) or (0xFF00 <= o <= 0xFF65)


def load_cmap(font_path):
    """Read a WOFF2 cmap without making the guard depend on one decoder.

    FontTools needs the optional Python Brotli extension for WOFF2.  Minimal
    release runners often omit it even though their system font stack can read
    WOFF2 perfectly well.  Prefer FontTools, then fall back to fontconfig's
    authoritative charset output so a missing test-only module cannot create a
    false product failure.
    """
    try:
        from fontTools.ttLib import TTFont
        font = TTFont(font_path)
        cmap = set()
        for table in font["cmap"].tables:
            cmap |= set(table.cmap.keys())
        return cmap, "FontTools"
    except Exception as fonttools_error:
        try:
            result = subprocess.run(
                ["fc-query", "--format", "%{charset}", font_path],
                capture_output=True, text=True, check=True, timeout=30,
            )
            cmap = set()
            for token in result.stdout.split():
                bounds = token.split("-", 1)
                start = int(bounds[0], 16)
                end = int(bounds[1], 16) if len(bounds) == 2 else start
                cmap.update(range(start, end + 1))
            if not cmap:
                raise RuntimeError("fc-query returned an empty charset")
            return cmap, "fontconfig (FontTools WOFF2 decoder unavailable: %s)" % fonttools_error
        except Exception as fontconfig_error:
            raise RuntimeError(
                "cannot read WOFF2 cmap with FontTools (%s) or fontconfig (%s)"
                % (fonttools_error, fontconfig_error)
            )


def main():
    srv = subprocess.Popen([sys.executable, "_imgguard_srv.py", PORT, ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT)
    time.sleep(2)
    try:
        r = subprocess.run(["node", "font_probe.mjs", PORT], capture_output=True, text=True, timeout=420, cwd=ROOT)
        if not os.path.exists("/tmp/cartoon_chars.json"):
            print("  ❌ 字体守卫: 探针没抓到任何字(渲染失败) —— 这种情况绝不能当成'通过'")
            print(r.stdout[-400:])
            return 1
        d = json.load(open("/tmp/cartoon_chars.json", encoding="utf-8"))
        chars = set(d["chars"])
        samples = d.get("samples", {})
        if len(chars) < 60:
            print("  ❌ 字体守卫: 只抓到 %d 个字, 明显没渲染到位 —— 不能当成'通过'" % len(chars))
            return 1

        cmap, cmap_reader = load_cmap(os.path.join(ROOT, "cartoon_font.woff2"))

        real = {c for c in chars if font_char(c)}
        missing = sorted(c for c in real if ord(c) not in cmap)

        # Keep the exact, render-derived input next to the diagnostic promised below.
        # This makes a failed guard directly repairable without guessing which UI
        # strings happened to be visible during the full browser walk.
        with open("/tmp/subset_chars.txt", "w", encoding="utf-8") as subset_file:
            subset_file.write("".join(sorted(real)))

        print("  真机渲染: 全库 %d 个界面, 卡通字体画出来的字符 %d 个(emoji 已排除)" % (len(chars), len(real)))
        print("  字体字符表解析: %s" % cmap_reader)
        if missing:
            print("  ❌ 字体子集守卫: 有 %d 个字【会显示、但字体里没有】→ 会悄悄回退成系统默认字体:" % len(missing))
            for c in missing[:12]:
                print("       「%s」 ← %s" % (c, samples.get(c, "?")))
            print("     重做子集: 用 /tmp/subset_chars.txt 从原字体(git bc16c12~1:cartoon_font.woff2)重新 subset")
            return 1
        print("  ✅ 字体子集守卫: %d 个真的会显示的字, 字体里一个都不缺" % len(real))
        return 0
    except Exception as e:
        print("  ❌ 字体守卫执行失败: %s" % e)
        return 1
    finally:
        try:
            srv.send_signal(signal.SIGTERM)
            srv.wait(timeout=5)
        except Exception:
            try:
                srv.kill()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
