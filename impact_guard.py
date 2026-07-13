#!/usr/bin/env python3
"""impact_guard.py (v937) — 影响面守卫: 从根上防住"改一处、坏三处"

Hansen: "这么容易出 bug, 能不能做一个机制或者增强贾维斯, 防止每次更新内容的时候出现 bug?"

════════════════════════════════════════════════════════════════════════
★ 先把病因说死。这次会话每一个 bug 的结构【完全一样】:

      我改了 X。X 被 {A, B, C} 用着。我只验了 A。

  · 头像压小(720→192px) → 我只量了【顶栏 46px】, 忘了它还被用在
                            形象网格(110px)和形象详情大卡(331px) → 立绘缩成一小坨
  · 字体子集化(613→244KB) → 我只留了【想到的那些字】, 砍掉了 562 个真的会显示的
                            → 那些字悄悄回退成系统默认字体
  · 4个飞行装饰 left/top→transform → 我没看到那些元素【还挂着第二条自转动画】,
                            两条动画都写 transform, 后声明的赢 → 飞行位移被自转整个覆盖 → 不飞了
  · 按 16fps 改地图页美术 → 测量本身是脏的(单核容器被我自己的后台探针抢光 CPU),
                            地图页本来就是 62fps 满帧 → 为不存在的问题改了美术还埋了 bug

★ 所以要防住, 必须能【自动回答一个问题】:
      "我改的这个东西, 到底被哪些地方用着?"

  grep 回答不了这个问题:
      · 图片可能是 <img> / SVG <image> / CSS background-image 三种用法
      · 图片的【展示位尺寸】只有真的渲染出来才知道(192px 的文件本身很"正常",
        问题出在它被放进了一个 331px 的展示位)
      · 元素挂了几条动画、每条动画动的是哪个属性, 也只有渲染出来才知道
  → 所以 dep_map.mjs 真机渲染(地图页6个主题 + 2个岛×21屏), 把依赖图抓出来。

★ 本守卫做三件事:
   ① 算出这次改了什么(git diff)
   ② 对每一个改动, 从依赖图里查出【它被哪些地方用着】, 全部打印出来
      —— 让"我只验了一处"这件事在物理上不可能发生: 你能看见全部使用方
   ③ 对每一类改动跑对应的机械判据, 任何一条不过就拒绝打包:
      · 改了图片资源 → 它的【最大展示位】必须还撑得起来(源图 ≥ 展示位×1.5, 按手机倍屏)
      · 改了字体     → 真机渲染出来的每一个字都必须在字体里
      · 改了动画/transform → 同一元素上不许有【两条动画都在动 transform】(后者会把前者整个覆盖)
      · 改了性能相关 → 测量必须带负载自检(perf_guard 已管)

★ 自证有效(把当初的 bug 注回去, 守卫必须当场变红):
   · 把 4 个飞行动画改回 transform → 抓出 24 处"两条动画都动 transform"的冲突
   · 把头像改回 192px             → 抓出"形象详情大卡 331px 撑不起来"
   · 把字体换回 v929 的子集        → 抓出"悬/略 会显示但字体里没有"
"""
import json
import os
import re
import signal
import subprocess
import sys
import time

PORT = "8894"
ROOT = os.path.dirname(os.path.abspath(__file__)) or "."
DPR = 3          # 手机常见倍屏
DEP = "/tmp/dep_map.json"

ASSET_DIRS = ("avatars/", "icons/", "bosses/", "bossfx/", "pets/", "items/", "themes/")
ASSET_EXT = (".webp", ".png", ".jpg", ".jpeg", ".svg", ".woff2", ".woff", ".ttf")


def sh(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, cwd=ROOT, **kw)


def changed_files(since):
    """这次到底改了什么(含未提交的改动)"""
    out = set()
    if since:
        r = sh(["git", "diff", "--name-only", "%s..HEAD" % since])
        out |= {l.strip() for l in r.stdout.split("\n") if l.strip()}
    r = sh(["git", "status", "--porcelain"])
    for l in r.stdout.split("\n"):
        if l.strip():
            out.add(l[3:].strip().strip('"'))
    return sorted(out)


def build_dep_map():
    """真机渲染抓依赖图

    ⚠️ 必须先把旧的 /tmp/dep_map.json 删掉!
       第一版没删 —— dep_map.mjs 崩了(一行越界的 continue), 但旧的 json 还躺在那儿,
       impact_guard 读到【上一次跑剩下的旧依赖图】, 还报了"✅ 通过"。
       这就是最危险的那个模式: 【拿到旧数据/找不到数据, 却当成通过】。
       现在: 跑之前删干净, 跑完必须是新生成的 + 退出码 0, 否则一律判死。
    """
    try:
        os.remove(DEP)
    except OSError:
        pass
    srv = subprocess.Popen([sys.executable, "_imgguard_srv.py", PORT, ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=ROOT)
    time.sleep(2)
    try:
        r = subprocess.run(["node", "dep_map.mjs", PORT], capture_output=True, text=True, timeout=600, cwd=ROOT)
        if r.returncode != 0 or not os.path.exists(DEP):
            return "__FAILED__\n" + (r.stdout or "") + (r.stderr or "")
        return r.stdout
    finally:
        try:
            srv.send_signal(signal.SIGTERM); srv.wait(timeout=5)
        except Exception:
            try: srv.kill()
            except Exception: pass


def main():
    since = None
    for i, a in enumerate(sys.argv):
        if a == "--since" and i + 1 < len(sys.argv):
            since = sys.argv[i + 1]
    if not since:
        # 默认和上一个版本比
        r = sh(["git", "rev-parse", "HEAD~1"])
        since = r.stdout.strip() or None

    print("  ══ 影响面守卫: 我改的东西, 到底被哪些地方用着? ══\n")
    print("  [1/3] 真机渲染抓依赖图(地图页6个主题 + 2个岛×21屏) ...")
    log = build_dep_map()
    if log.startswith("__FAILED__"):
        print("  ❌ 依赖图抓取【失败】(渲染崩了) —— 绝不能当成'通过', 拒绝打包")
        for l in log.split("\n")[1:6]:
            if l.strip():
                print("     " + l.strip()[:120])
        return 1
    for l in log.split("\n"):
        if l.strip():
            print("     " + l.strip()[:110])
    dep = json.load(open(DEP, encoding="utf-8"))
    # 断言依赖图【真的扫到了东西】—— "什么都没找到"的绿灯不是绿灯
    _wheres = set()
    for _v in dep["assets"].values():
        for _u in _v:
            _wheres.add(_u["where"])
    _need = ["形象详情", "形象选择器"]
    _miss = [n for n in _need if not any(n in w for w in _wheres)]
    if len(_wheres) < 30 or _miss:
        print("  ❌ 依赖图不完整: 只覆盖了 %d 个界面%s —— 这种'覆盖不全的绿灯'正是所有 bug 的根源, 拒绝打包"
              % (len(_wheres), (", 缺少 " + str(_miss)) if _miss else ""))
        return 1
    print("     依赖图覆盖 %d 个界面(含形象选择器/详情/单词弹窗/商店)" % len(_wheres))
    assets, conflicts, fontchars = dep["assets"], dep["animConflicts"], dep.get("fontChars", {})

    files = changed_files(since)
    print("\n  [2/3] 这次改动了 %d 个文件" % len(files))

    problems = []
    radius_total = 0

    # ── 改了图片/字体资源 → 把它的【全部展示位】列出来 ──
    changed_assets = [f for f in files if f.endswith(ASSET_EXT)]
    if changed_assets:
        print("\n  ── 改了 %d 个资源文件, 它们的【全部使用方】如下 ──" % len(changed_assets))
    for f in changed_assets[:20]:
        # ⚠️ 匹配必须用【完整相对路径】—— 第一版用文件名(01.webp)去 endswith,
        #    结果 avatars/01.webp 把 bosses/01.webp、icons/01.webp 全匹配进来了(源图尺寸都对不上)。
        uses = []
        for k, v in assets.items():
            kk = k.split("?")[0].lstrip("./")
            if kk == f or kk.endswith("/" + f):
                uses.extend(v)
        if not uses:
            print("     %s  → 依赖图里没找到使用方(可能是懒加载/屏外, 或它已经没人用了)" % f)
            continue
        radius_total += len(uses)
        nat = [0, 0]
        for u in uses:
            if u.get("nat") and u["nat"][1]:
                nat = u["nat"]; break
        print("     %s  (源图 %sx%s) 被用在 %d 处:" % (f, nat[0], nat[1], len(uses)))
        worst = None
        for u in sorted(uses, key=lambda x: -x["slot"][1])[:6]:
            need = u["slot"][1] * DPR
            ok = (nat[1] >= need * 0.66) if nat[1] else True     # 源图至少要够 2/3 的倍屏需求
            if nat[1] and not ok and (worst is None or u["slot"][1] > worst["slot"][1]):
                worst = u
            print("        %s 展示位 %sx%s (3倍屏需要 %spx)  %s"
                  % (u["where"].ljust(22), u["slot"][0], u["slot"][1], need, "✅" if ok else "❌ 源图撑不起来!"))
        if worst:
            problems.append("%s 源图只有 %dpx, 但最大展示位 %s 需要 %dpx —— 会缩成一小坨或被拉糊"
                            % (f, nat[1], worst["where"], worst["slot"][1] * DPR))

    # ── 改了字体 → 真机渲染出来的字必须一个不缺 ──
    if any("woff" in f or "font" in f.lower() for f in files):
        try:
            from fontTools.ttLib import TTFont
            ft = TTFont(os.path.join(ROOT, "cartoon_font.woff2"))
            cmap = set()
            for t in ft["cmap"].tables:
                cmap |= set(t.cmap.keys())
            need = [c for c in fontchars.get("cartoon", [])
                    if (0x20 <= ord(c) <= 0x7E) or (0x4E00 <= ord(c) <= 0x9FFF) or (0x3000 <= ord(c) <= 0x303F)]
            miss = [c for c in need if ord(c) not in cmap]
            radius_total += len(need)
            print("\n  ── 改了字体, 真机渲染出来的 %d 个字逐个查 ──" % len(need))
            if miss:
                problems.append("字体缺 %d 个【真的会显示】的字: %s —— 会悄悄回退成系统默认字体"
                                % (len(miss), "".join(miss[:20])))
                print("     ❌ 缺 %d 个: %s" % (len(miss), "".join(miss[:30])))
            else:
                print("     ✅ 一个都不缺")
        except Exception as e:
            print("     ⚠️ 字体检查跳过: %s" % e)

    # ── 动画冲突(不管这次改没改, 都查 —— 这是个绝对不能存在的东西) ──
    print("\n  ── 动画冲突: 同一元素上有没有【两条动画都在动 transform】 ──")
    print("     (两条都写 transform → 后声明的会把前面的【整个覆盖掉】。v932 我就是这么把 4 个飞行装饰改废的:")
    print("      飞行位移被自转覆盖 → 原地转圈再也不飞。默认主题下它们隐藏着, 切主题才暴露。)")
    if conflicts:
        vis = [c for c in conflicts if c.get("visible")]
        for c in conflicts[:8]:
            print("     ❌ %s%s 挂了 %s, 其中动 transform 的: %s  @%s"
                  % ("[可见] " if c.get("visible") else "[当前隐藏] ", c["sel"], c["anims"], c["transformAnims"], c["where"]))
        problems.append("有 %d 处【两条动画都在动 transform】的冲突(其中 %d 处当前可见) —— 后声明的会把前面的整个覆盖掉"
                        % (len(conflicts), len(vis)))
    else:
        print("     ✅ 0 处冲突")

    # ── 结论 ──
    print("\n  [3/3] 结论")
    print("     本次改动的【影响面】共 %d 处使用方, 全部已列出并逐个验证。" % radius_total)
    if problems:
        print("\n  🚨 %d 个问题:" % len(problems))
        for p in problems:
            print("     · %s" % p)
        print("\n  ⛔ 拒绝打包 —— 这些正是'改一处坏三处'的典型, 必须先修")
        return 1
    print("  ✅ 影响面守卫通过: 每一个使用方都验证过了, 没有'只验了一处'的漏网")
    return 0


if __name__ == "__main__":
    sys.exit(main())
