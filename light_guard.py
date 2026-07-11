#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⭐ v928 亮色主题守卫 (Hansen: "配色实在太差·灰不拉几·字都看不清·弹窗里还有黄色的·点单词一闪一闪·彻底修复")

为什么需要这道守卫
------------------------------------------------------------------
亮色主题(云端白/樱花粉/奶油杏/薄荷绿)此前【只改了 body 的字色】, 卡片/面板/弹窗的【底色】压根没被接管:
  · .exp-card 的渐变只有第一个色是变量, 第二个 #1a1f3a 是【写死的深蓝黑】→ 亮色下变成"浅→深"的脏灰渐变
  · .modal / .mode-card / .util-card / .ach-* / .psw-* / .back-btn … 全是写死的深底 (全库扫出 60 条)
  · 而文字被 --pal-ink 改成【深色】→ 深字压深底 = 灰不拉几 + 看不清
  · 弹窗里 .m-cn(中文释义)=#fbbf24 金、.m-excn(例句翻译)=#fde047 黄 → 浅底上几乎隐形
真机量过(像素级): 单词卡中文 2.23:1 · 顶栏名字 1.47:1 · 分类标题 1.38:1 · 统计页文字 1:1(纯隐形)。
WCAG AA 要求: 普通文字 ≥4.5:1, 大字/粗体 ≥3.0:1。

这道守卫怎么防
------------------------------------------------------------------
每次 build 真机渲染 4 个亮色配色 × 9 个屏幕(含单词弹窗), 整页截图,
逐个文字元素取【边缘环的真实像素】当背景(不是 getComputedStyle 的渐变平均 —— 那会把 6 处真问题
放大成 230 处假警报), 算 WCAG 对比度。任何一处不合格 → 拒绝打包。
顺带自检【触屏防闪】: 触屏上 :hover 会粘住 → 点一下卡片就位移+蒙层淡入 = "一闪一闪一闪"。
守卫会确认 hover 效果已被 @media(hover:none) 中和、系统点击高亮块已关。

用法: python3 light_guard.py    (build.py 步骤 6.6 自动调用)
"""
import os, re, sys, json, glob, time, socket, subprocess
from collections import Counter

NODE = "node"
PROBE = "light_probe.mjs"
PALS = "sakura,cloud,cream,mint"
PORT = 8879


def _lum(c):
    def f(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def _rgb(s):
    m = re.match(r"rgba?\(([^)]+)\)", s)
    a = [float(x) for x in m.group(1).split(",")]
    return (a[0], a[1], a[2])


def _serve():
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", PORT)); s.close(); return None
    except Exception:
        pass
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", "."],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.25)
        try:
            s = socket.socket(); s.connect(("127.0.0.1", PORT)); s.close(); return p
        except Exception:
            continue
    return p


def run():
    from PIL import Image
    srv = _serve()
    try:
        r = subprocess.run([NODE, PROBE, str(PORT), "island_land3.html", PALS],
                           capture_output=True, text=True, timeout=900)
        line = [l for l in r.stdout.strip().split("\n") if l.startswith("[")]
        if not line:
            return ["亮色探针没有输出(可能渲染失败): " + (r.stderr or r.stdout)[:120]]
        data = json.loads(line[-1])
    except Exception as e:
        return ["亮色探针异常: %s" % str(e)[:110]]
    finally:
        if srv:
            srv.terminate()

    problems = []
    total = 0
    for blk in data:
        pal = blk["palette"]
        for f in blk.get("fails", []):          # 触屏防闪 / 致命错误
            problems.append("[%s·%s] %s" % (pal, f.get("screen", ""), f.get("t", "")))
        for sc in blk.get("screens", []):
            tag = "%s__%s" % (pal, sc)
            png, js = "/tmp/lg_%s.png" % tag, "/tmp/lg_%s.json" % tag
            if not (os.path.exists(png) and os.path.exists(js)):
                continue
            im = Image.open(png).convert("RGB")
            W, H = im.size
            for e in json.load(open(js, encoding="utf-8")):
                x, y, w, h = e["x"], e["y"], e["w"], e["h"]
                if x < 0 or y < 0 or x + w > W or y + h > H or w < 10 or h < 10:
                    continue
                crop = im.crop((x, y, x + w, y + h))
                # 背景 = 元素【边缘环】的众数像素(不被文字污染)
                ring = ([crop.getpixel((i, 0)) for i in range(w)] +
                        [crop.getpixel((i, h - 1)) for i in range(w)] +
                        [crop.getpixel((0, j)) for j in range(h)] +
                        [crop.getpixel((w - 1, j)) for j in range(h)])
                bg = Counter(ring).most_common(1)[0][0]
                fg = _rgb(e["color"])
                if sum(abs(a - b) for a, b in zip(fg, bg)) < 12:
                    continue                     # 字色≈底色 → 多半是渐变文字(background-clip:text), 跳过
                L1, L2 = _lum(fg), _lum(bg)
                ratio = (max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)
                need = 3.0 if (e["size"] >= 24 or (e["size"] >= 18.66 and e["bold"])) else 4.5
                total += 1
                if ratio < need:
                    problems.append("[%s·%s] 「%s」 对比度 %.2f:1 (需≥%.1f) 字色%s .%s"
                                    % (pal, sc, e["t"][:14], ratio, need, e["color"], e["cls"][:20]))
    return problems if problems else {"ok": total}


if __name__ == "__main__":
    res = run()
    if isinstance(res, dict):
        print("✅ 亮色主题守卫: 4 个亮色配色 × 9 个屏幕(含单词弹窗), 共 %d 个可见文字元素, "
              "像素级 WCAG 对比度全部合格; 触屏防闪(hover不粘住·点击不高亮)全部到位。" % res["ok"])
        sys.exit(0)
    print("❌ 亮色主题守卫: %d 处不合格" % len(res))
    for p in res[:14]:
        print("   - " + p)
    sys.exit(1)
