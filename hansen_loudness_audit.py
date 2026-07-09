#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hansen_loudness_audit.py —— 全库单词发音"响度一致性"审计 (换音频必查项)

为什么有这个脚本:
  Hansen 严正、反复要求 —— 所有单词发音的响度必须统一, 绝不允许"这个词响、那个词轻"。
  每次只要新增/替换了单词音频文件, 跑完铁律 1.2 的归一化后, 都必须跑这个脚本做全库复查,
  确认 words/ 下每一个 mp3 都落在 -16 LUFS 附近, 没有任何一个偏离 / 削波。

它做什么:
  - 用 ffmpeg(EBU R128 loudnorm 分析 pass)逐个测 words/*.mp3 的积分响度(LUFS)与真峰(dBTP)。
  - 打印全库分布(数量 / 中位 / 均值 / 最小 / 最大 / 跨度)。
  - 标记【离群】: 偏离 -16.0 超过 ±TOL(默认 0.6 LUFS)的文件。
  - 标记【削波】: 真峰 > 0 dBTP 的文件。
  - 全部通过 → 退出码 0(打印 ✅✅✅); 有离群/削波 → 退出码 1(可挂在打包闸门里)。

固定基准(与铁律 1.2 一致):
  目标 -16.0 LUFS / 真峰 ≤ -1.0 dBFS / 44100Hz 单声道 128kbps。

用法:
  python3 hansen_loudness_audit.py            # 默认阈值 ±0.6 LUFS
  python3 hansen_loudness_audit.py --tol 0.4  # 更严的阈值
  python3 hansen_loudness_audit.py --dir words # 指定目录(默认 words)
"""
import subprocess, json, re, glob, os, sys, statistics

TARGET = -16.0
TOL = 0.6                 # 偏离 -16 超过这个值就算离群(默认 0.6; 听觉阈值 ~1dB)
AUDIO_DIR = "words"

# 解析命令行
args = sys.argv[1:]
if "--tol" in args:
    try: TOL = float(args[args.index("--tol") + 1])
    except Exception: pass
if "--dir" in args:
    try: AUDIO_DIR = args[args.index("--dir") + 1]
    except Exception: pass


def measure(path):
    """返回 (积分响度 LUFS, 真峰 dBTP); 失败返回 (None, None)"""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path,
         "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
    if not m:
        return None, None
    try:
        d = json.loads(m.group(0))
        return float(d["input_i"]), float(d["input_tp"])
    except Exception:
        return None, None


def main():
    files = sorted(glob.glob(os.path.join(AUDIO_DIR, "*.mp3")))
    if not files:
        print("❌ 目录 %s 下没有 mp3" % AUDIO_DIR)
        return 1

    print("== hansen_loudness_audit: 全库响度一致性审计 ==")
    print("   目标 %.1f LUFS, 离群阈值 ±%.2f LUFS, 目录 %s/" % (TARGET, TOL, AUDIO_DIR))
    print("   逐个测 %d 个 mp3 ..." % len(files))

    rows, bad_read = [], []
    for f in files:
        i, tp = measure(f)
        if i is None:
            bad_read.append(os.path.basename(f))
        else:
            rows.append((os.path.basename(f), i, tp))

    Is = [r[1] for r in rows]
    span = max(Is) - min(Is)
    print("\n【全库统计】(n=%d)" % len(rows))
    print("   中位 %.2f / 均值 %.2f / 最小 %.2f / 最大 %.2f / 跨度 %.2f LUFS"
          % (statistics.median(Is), statistics.mean(Is), min(Is), max(Is), span))

    outliers = [r for r in rows if abs(r[1] - TARGET) > TOL]
    clips = [r for r in rows if r[2] is not None and r[2] > 0.0]

    print("\n【离群】偏离 %.1f 超过 ±%.2f LUFS: %d 个" % (TARGET, TOL, len(outliers)))
    for n, i, tp in sorted(outliers, key=lambda r: r[1]):
        print("   ⚠️ %-24s I=%6.2f LUFS  TP=%6.2f dBTP" % (n, i, tp))

    print("\n【削波】真峰 > 0 dBTP: %d 个" % len(clips))
    for n, i, tp in clips:
        print("   ⚠️ %-24s TP=%6.2f dBTP" % (n, tp))

    if bad_read:
        print("\n【无法读取】%d 个: %s" % (len(bad_read), ", ".join(bad_read)))

    ok = (not outliers) and (not clips) and (not bad_read)
    print("\n" + "=" * 56)
    if ok:
        print("✅✅✅ 全库响度一致: 全部 %d 个都在 -16±%.2f LUFS、无削波。" % (len(rows), TOL))
        return 0
    else:
        print("❌ 发现不一致 —— 把上面【离群/削波】的文件按铁律 1.2 重新归一化到 -16 LUFS 再复查。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
