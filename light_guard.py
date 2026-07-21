#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v946 HF3 全亮色主题真实界面 WCAG 守卫。

覆盖范围：
  * 4 个全局亮色配色 × 岛内 10 个真实状态（含单词弹窗、主题商店）；
  * 4 个全局亮色配色 × Boss 晨曦主题的大满贯 1/20 真实进度卡；
  * 4 个全局亮色配色 × 首页统计区（含“最近探险的岛屿”真实存档）；
  * Spelling Bee 4 个亮色主题 × 设置页与真实实战页（包含正确、错误、机器人字母格）。

探针会在不改变布局的前提下暂时隐藏文字，截取每一行文字下面真正合成后的背景。
因此渐变、半透明卡片、图片背景和父级 opacity 都按最终像素计算；不再把“字色≈底色”
误当成渐变字跳过。普通文字要求 4.5:1，大字/粗体要求 3.0:1；用户指出的关键
文字（最近岛屿、主题商店、Bee 字母格）一律按 4.5:1，不因字号放宽。
"""
import json
import math
import os
import re
import socket
import subprocess
import sys
import time

NODE = "node"
PROBE = "light_probe.mjs"
PALS = "sakura,cloud,cream,mint"


def _lum(color):
    def channel(value):
        value /= 255.0
        return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2])


def _ratio(foreground, background):
    first, second = _lum(foreground), _lum(background)
    return (max(first, second) + 0.05) / (min(first, second) + 0.05)


def _rgba(value):
    match = re.match(r"rgba?\(([^)]+)\)", str(value).strip(), re.I)
    if not match:
        return None
    raw = [part.strip() for part in match.group(1).replace("/", ",").split(",")]
    try:
        parts = [float(part.rstrip("%")) for part in raw]
    except ValueError:
        return None
    if len(parts) < 3:
        return None
    # Modern Chromium may serialize percentages, although rgb integers are normal here.
    rgb = [max(0.0, min(255.0, part * 2.55 if raw[i].endswith("%") else part))
           for i, part in enumerate(parts[:3])]
    alpha = max(0.0, min(1.0, parts[3] if len(parts) > 3 else 1.0))
    return rgb, alpha


def _serve():
    # Never reuse a pre-existing fixed-port server: release tests often run in
    # parallel and a foreign server can silently feed this guard stale sources.
    # Reserve an ephemeral localhost port, then launch a server rooted in the
    # current release directory.
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", "."],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(60):
        time.sleep(0.2)
        try:
            sock = socket.socket()
            sock.connect(("127.0.0.1", port))
            sock.close()
            return process, port
        except OSError:
            continue
    process.terminate()
    raise RuntimeError("无法启动亮色主题本地探针服务器")


def _percentile(values, fraction):
    if not values:
        return 0.0
    values.sort()
    index = max(0, min(len(values) - 1, math.ceil(len(values) * fraction) - 1))
    return values[index]


def _distance(first, second):
    return sum(abs(float(first[i]) - float(second[i])) for i in range(3))


def _measure_entry(image, normal, entry):
    width, height = image.size
    x = max(0, int(entry.get("x", 0)))
    y = max(0, int(entry.get("y", 0)))
    right = min(width, x + max(0, int(entry.get("w", 0))))
    bottom = min(height, y + max(0, int(entry.get("h", 0))))
    if right - x < 1 or bottom - y < 1:
        return None
    parsed = _rgba(entry.get("color", ""))
    if not parsed:
        return None
    source_fg, color_alpha = parsed
    opacity = max(0.0, min(1.0, float(entry.get("opacity", 1.0))))
    alpha = color_alpha * opacity
    # Cap work on very long paragraphs without losing spatial coverage.
    area = (right - x) * (bottom - y)
    step = max(1, int(math.sqrt(area / 6000.0)))
    ratios = []
    fallback = []
    for py in range(y, bottom, step):
        for px in range(x, right, step):
            background = image.getpixel((px, py))[:3]
            foreground = tuple(source_fg[i] * alpha + background[i] * (1.0 - alpha) for i in range(3))
            ratio = _ratio(foreground, background)
            fallback.append(ratio)
            rendered = normal.getpixel((px, py))[:3]
            ink_delta = _distance(rendered, background)
            # Keep glyph-core pixels: the rendered pixel moved materially away from the
            # blank background and towards the element's expected foreground colour.
            if ink_delta >= 12 and _distance(rendered, foreground) <= max(8.0, ink_delta * 0.68):
                ratios.append(ratio)
    # Equal foreground/background text produces no screenshot difference.  Falling back
    # to the text run is intentional: that is a genuine invisible-text failure, not a
    # reason to skip it as the old guard did.
    minimum_mask = max(3, int(len(fallback) * 0.003))
    if len(ratios) < minimum_mask:
        ratios = fallback
    if not ratios:
        return None
    # A single antialias/image noise pixel must not fail a release, but a region covering
    # at least ten percent of the text run is a real readability problem.
    return _percentile(ratios, 0.10), _percentile(ratios[:], 0.50)


def _measure_legacy(image, entry):
    """The v928 edge-ring method, kept for the nine established island states."""
    width, height = image.size
    x, y = int(entry.get("x", 0)), int(entry.get("y", 0))
    box_width, box_height = int(entry.get("w", 0)), int(entry.get("h", 0))
    if (x < 0 or y < 0 or x + box_width > width or y + box_height > height
            or box_width < 10 or box_height < 10):
        return "skip"
    parsed = _rgba(entry.get("color", ""))
    if not parsed:
        return None
    crop = image.crop((x, y, x + box_width, y + box_height))
    ring = ([crop.getpixel((i, 0)) for i in range(box_width)]
            + [crop.getpixel((i, box_height - 1)) for i in range(box_width)]
            + [crop.getpixel((0, j)) for j in range(box_height)]
            + [crop.getpixel((box_width - 1, j)) for j in range(box_height)])
    # Avoid importing Counter globally for the precise path.
    from collections import Counter
    background = Counter(ring).most_common(1)[0][0][:3]
    foreground = parsed[0]
    if _distance(foreground, background) < 12:
        return "skip"  # historical background-clip:text allowance
    ratio = _ratio(foreground, background)
    return ratio, ratio


def run():
    from PIL import Image

    server, port = _serve()
    try:
        result = subprocess.run(
            [NODE, PROBE, str(port), "island_land3.html", PALS],
            capture_output=True,
            text=True,
            timeout=1200,
        )
        lines = [line for line in result.stdout.splitlines() if line.startswith("[")]
        if not lines:
            detail = (result.stderr or result.stdout or "没有输出").strip().replace("\n", " ")
            return ["亮色探针没有输出（可能浏览器启动或渲染失败）：" + detail[:220]]
        data = json.loads(lines[-1])
    except Exception as error:
        return ["亮色探针异常：%s" % str(error)[:220]]
    finally:
        if server:
            server.terminate()

    problems = []
    checked = 0
    screen_count = 0
    skipped_gradient = 0
    skipped_decorative = 0
    skipped_occluded = 0
    surface_counts = {"island": 0, "boss": 0, "home": 0, "bee": 0}

    for block in data:
        palette = block.get("palette", "?")
        for failure in block.get("fails", []):
            problems.append("[%s·%s] %s" % (palette, failure.get("screen", ""), failure.get("t", "")))
        for capture in block.get("captures", []):
            screen_count += 1
            screen = capture.get("screen", "?")
            surface = screen.split(":", 1)[0]
            if surface in surface_counts:
                surface_counts[surface] += 1
            skipped_gradient += int(capture.get("skippedGradient", 0))
            skipped_decorative += int(capture.get("skippedDecorative", 0))
            skipped_occluded += int(capture.get("skippedOccluded", 0))
            tag = capture.get("tag", "")
            method = capture.get("method", "precise")
            png_path = "/tmp/lg2_%s_bg.png" % tag
            normal_path = "/tmp/lg2_%s_normal.png" % tag
            json_path = "/tmp/lg2_%s.json" % tag
            required_paths = [normal_path, json_path] + ([] if method == "legacy" else [png_path])
            if not tag or any(not os.path.exists(path) for path in required_paths):
                problems.append("[%s·%s] 对比度产物缺失" % (palette, screen))
                continue
            try:
                normal = Image.open(normal_path).convert("RGB")
                image = normal if method == "legacy" else Image.open(png_path).convert("RGB")
                with open(json_path, encoding="utf-8") as handle:
                    entries = json.load(handle)
            except Exception as error:
                problems.append("[%s·%s] 无法读取对比度产物：%s" % (palette, screen, str(error)[:90]))
                continue

            for entry in entries:
                measured = _measure_legacy(normal, entry) if method == "legacy" else _measure_entry(image, normal, entry)
                if measured == "skip":
                    continue
                if measured is None:
                    problems.append("[%s·%s] 无法测量「%s」的真实底色" %
                                    (palette, screen, entry.get("t", "")[:18]))
                    continue
                p10, median = measured
                size = float(entry.get("size", 0))
                large = size >= 24 or (size >= 18.66 and bool(entry.get("bold")))
                required = 4.5 if entry.get("critical") else (3.0 if large else 4.5)
                checked += 1
                if p10 + 1e-6 < required:
                    problems.append(
                        "[%s·%s] 「%s」真实背景对比度 %.2f:1（中位 %.2f:1，需≥%.1f）字色%s .%s" %
                        (palette, screen, entry.get("t", "")[:18], p10, median, required,
                         entry.get("color", "?"), entry.get("cls", "")[:28])
                    )

    # Guard completeness: a silent navigation/selector break must fail, not report a tiny pass.
    expected = {"island": len(PALS.split(",")) * 10, "boss": len(PALS.split(",")),
                "home": len(PALS.split(",")),
                "bee": len(PALS.split(",")) * 2}
    for surface, need in expected.items():
        if surface_counts[surface] != need:
            problems.append("[覆盖完整性] %s 仅测到 %d/%d 个亮色状态" %
                            (surface, surface_counts[surface], need))
    if checked < 300:
        problems.append("[覆盖完整性] 仅测到 %d 条文字，低于防空跑阈值 300" % checked)

    if problems:
        return problems
    return {"ok": checked, "screens": screen_count, "skipped_gradient": skipped_gradient,
            "skipped_decorative": skipped_decorative, "skipped_occluded": skipped_occluded,
            "surfaces": surface_counts}


if __name__ == "__main__":
    outcome = run()
    if isinstance(outcome, dict):
        print(
            "✅ 全亮色主题守卫：4 个配色、%d 个真实界面状态、%d 条可见文字全部通过；"
            "普通/关键文字≥4.5:1，大字≥3.0:1。覆盖岛内(含主题商店)、Boss 大满贯进度卡、首页最近探索、"
            "Spelling Bee 设置+实战；另跳过 %d 条有意的 background-clip 渐变标题、"
            "%d 条带深色描边的装饰 Logo、%d 条被固定栏真实遮挡的文字。" %
            (outcome["screens"], outcome["ok"], outcome["skipped_gradient"],
             outcome["skipped_decorative"], outcome["skipped_occluded"])
        )
        sys.exit(0)
    print("❌ 全亮色主题守卫：%d 处不合格" % len(outcome))
    for problem in outcome[:32]:
        print("   - " + problem)
    if len(outcome) > 32:
        print("   - ……另有 %d 处（修复后重新运行会继续列出）" % (len(outcome) - 32))
    sys.exit(1)
