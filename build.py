#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — 自动化构建 (照 README 规格重建)
步骤:
 1. 确定新版本 (命令行参数, 或读 VERSION 自增1)
 2. 全局 sed 主缓存戳 ?v=旧 -> ?v=新 (所有 *.html *.js; 不碰 mp3 戳 ?vNNN)
 3. 同步 hansen_boss_lock.js 的 __HBU_VERSION__ / HBU_RUNTIME_VERSION
    (banner 历史停在 v391、纯console文案不影响功能, 与真实构建一致, 不强改)
 4. 先写 VERSION 文件 (在检查之前)
 5. node --check 所有 *.js
 6. 跑 check_resources.py (全过才继续)
 7. 打 zip 到 /mnt/user-data/outputs/ (排除 *.md *.py *.txt 及死测试页; index.html 在根)
任何一步失败 = 拒绝打包。
用法: python3 build.py 398   |   python3 build.py   (自增)
"""
import os, re, sys, glob, subprocess, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

# ---- 0. 「印章」统一架构: 先从 template.html + island_data.json 盖章生成 19 个岛 ----
#   (改母版 template.html 或某岛数据 island_data.json 后重跑 build, 19 岛自动全部同步, 永不再分叉)
if os.path.exists("template.html") and os.path.exists("island_data.json"):
    print("  [0] 印章生成 19 岛 (template.html + island_data.json) ...")
    r = subprocess.run([sys.executable, "generate.py"])
    if r.returncode != 0:
        print("  \u274c generate.py 失败, 拒绝构建")
        sys.exit(1)

# ---- 1. 版本号 ----
with open("VERSION") as f:
    old = f.read().strip()
arg = [a for a in sys.argv[1:] if a.isdigit()]
new = arg[0] if arg else str(int(old) + 1)
label = ""
for a in sys.argv[1:]:
    if a.startswith("--label="):
        label = a.split("=", 1)[1]
print("== build.py: v%s -> v%s %s==" % (old, new, ("(" + label + ") ") if label else ""))

html_js = sorted(glob.glob("*.html") + glob.glob("*.js"))
# 🔴 v712 印章: island_data.json 的 BOSSES 内含 boss图 ?v= 戳, 必须一同 cache-bust(否则印章守卫复原对不上·boss图缓存也不刷新)
if os.path.exists("island_data.json"):
    html_js.append("island_data.json")

# ---- 2. 主缓存戳 ?v=old -> ?v=new (带等号; 不动 mp3 戳 ?vNNN) ----
pat = re.compile(r'\?v=' + re.escape(old) + r'\b')
n_cb = 0
for fn in html_js:
    txt = open(fn, encoding="utf-8").read()
    new_txt, c = pat.subn('?v=' + new, txt)
    if c:
        open(fn, "w", encoding="utf-8").write(new_txt)
        n_cb += c
print("  [2] 主缓存戳 ?v=%s -> ?v=%s : %d 处" % (old, new, n_cb))

# ---- 3. 运行时版本变量 ----
lock = open("hansen_boss_lock.js", encoding="utf-8").read()
n_var = 0
for var in ["__HBU_VERSION__", "HBU_RUNTIME_VERSION"]:
    lock, c = re.subn(var + r"(\s*=\s*')v" + re.escape(old) + r"(')",
                      var + r"\g<1>v" + new + r"\g<2>", lock)
    n_var += c
open("hansen_boss_lock.js", "w", encoding="utf-8").write(lock)
print("  [3] __HBU_VERSION__ / HBU_RUNTIME_VERSION -> v%s : %d 处 (banner 维持原状, 纯文案)" % (new, n_var))

# ---- 4. 写 VERSION (检查前) ----
open("VERSION", "w").write(new + "\n")
print("  [4] VERSION 文件 -> %s" % new)

# ---- 5. node --check 所有 js ----
print("  [5] node --check 所有 *.js ...")
syntax_bad = []
for fn in sorted(glob.glob("*.js")):
    r = subprocess.run(["node", "--check", fn], capture_output=True, text=True)
    if r.returncode != 0:
        syntax_bad.append((fn, r.stderr.strip().splitlines()[-1] if r.stderr else "?"))
if syntax_bad:
    print("  \u274c JS 语法错误:")
    for fn, e in syntax_bad:
        print("     - %s: %s" % (fn, e))
    sys.exit(1)
print("      \u2705 全部 .js 语法通过")

# ---- 6. check_resources.py ----
print("  [6] 跑 check_resources.py ...")
r = subprocess.run([sys.executable, "check_resources.py"])
if r.returncode != 0:
    print("  \u274c check_resources 未通过, 拒绝打包")
    sys.exit(1)

# ---- 6.5 特效不可破坏守卫 (v912) ----
# Hansen 钦令: boss 攻击特效一旦定稿, 绝不允许被任何改动无声破坏。
# check_resources 全是【盯代码字符串】的守卫 —— v905 没改一行特效代码, 只是把不透明底涂在 #bossScreen 上,
# 就把 z-index:-1 的背景特效层盖死(龙骑士统帅巨翼 / 地狱犬王地狱之门双双消失), 而所有字符串守卫全部通过、照常上线。
# fx_guard 在【真浏览器】里把 20 个 boss 的特效各放一遍, 用【像素】证明特效真的画在屏幕上:
#   有元素却 0 像素 = 被谁遮死了 = 特效已被破坏 → 拒绝打包。
# 跳过方式: 只有明确知道自己在干什么时才 SKIP_FX_GUARD=1(交付给 Hansen 的包永远不许跳)。
if os.environ.get("SKIP_FX_GUARD") == "1":
    print("  [6.5] \u26a0\ufe0f 特效守卫被跳过(SKIP_FX_GUARD=1) —— 交付包严禁跳过!")
else:
    print("  [6.5] 跑 fx_guard.py (真机放一遍 20 个 boss 的攻击特效, 像素级证明没被破坏) ...")
    r = subprocess.run([sys.executable, "fx_guard.py"])
    if r.returncode != 0:
        print("  \u274c 特效守卫未通过: 有 boss 的攻击特效被破坏了, 拒绝打包")
        sys.exit(1)

# ---- 6.6 亮色主题守卫 (v928) ----
# Hansen: "配色实在太差·灰不拉几·字都看不清·弹窗里还有黄色的·点单词一闪一闪·彻底修复"
# light_guard 在【真触屏环境】里把 4 个亮色配色 × 9 个屏幕(含单词弹窗)各渲一遍, 整页截图,
# 逐个文字元素取【边缘环的真实像素】当背景, 算 WCAG 对比度(普通字≥4.5:1 · 大字/粗体≥3.0:1)。
# 为什么用像素而不是 getComputedStyle: 后者拿背景会把渐变的色标做平均(掺进深色星云),
#   实测会把 6 处真问题放大成 230 处假警报 —— 像素才是真相。
# 顺带自检【触屏防闪】: 触屏上 :hover 会粘住 → 点一下卡片就位移+蒙层淡入 = "一闪一闪一闪"。
if os.environ.get("SKIP_LIGHT_GUARD") == "1":
    print("  [6.6] \u26a0\ufe0f 亮色守卫被跳过(SKIP_LIGHT_GUARD=1) —— 交付包严禁跳过!")
else:
    print("  [6.6] 跑 light_guard.py (真触屏渲 4 个亮色配色 x 9 个屏幕, 像素级量对比度 + 防闪自检) ...")
    r = subprocess.run([sys.executable, "light_guard.py"])
    if r.returncode != 0:
        print("  \u274c 亮色守卫未通过: 亮色调下有文字看不清 / 点击会闪, 拒绝打包")
        sys.exit(1)

# ---- 6.7 加载性能守卫 (v929) ----
# Hansen: "进岛很卡·很多画面加载不出来·点打Boss卡在那儿·要极致快·上线前最高优先级"
# perf_guard 在【模拟 4G + gzip】(和用户手机上的 CloudBase 一致)下真机加载 3 个代表岛,
# 量【用户真正感觉到的】三个时间: 看到内容 / 可点击 / 首屏图标全部画完, 外加【关键路径字节数】。
# 任何一项超预算 → 拒绝打包。
# ⚠️ gzip 必须模拟: CloudBase 对文本开 gzip, 本地裸 http 不开 —— 不模拟会把结果测得比真实差 2~3 倍,
#    从而做出错误的优化决策(实测差异: 同一个页面 6.6s vs 1.2s)。
if os.environ.get("SKIP_PERF_GUARD") == "1":
    print("  [6.7] \u26a0\ufe0f 性能守卫被跳过(SKIP_PERF_GUARD=1) —— 交付包严禁跳过!")
else:
    print("  [6.7] 跑 perf_guard.py (模拟4G+gzip 真机加载3个岛, 量用户真正感觉到的时间 + 关键路径字节) ...")
    r = subprocess.run([sys.executable, "perf_guard.py"])
    if r.returncode != 0:
        print("  \u274c 性能守卫未通过: 进岛变慢了 / 关键路径变胖了, 拒绝打包")
        sys.exit(1)

# ---- 6.8 图片尺寸守卫 (v933) ----
# Hansen 截图: "点这个动物头像进来之后, 立体形象怎么变得这么小了?"
# 根因是 v929 提速时把头像 417x720 压到 111x192 —— 顶栏(46px)完全没问题, 但同一张图还被用在:
#   · 形象详情大卡(显示 331px) → CSS 是 width:auto, 图按【原始尺寸】画, 192px 根本够不着 331px 的上限
#                                → 就按 192px 原样画出来 = 只占卡片 53% = 缩成一小坨
#   · 形象选择器网格(显示 110px) → 3 倍屏需要 330px, 192px 被放大 1.7 倍 = 发虚
# 压图时【只按顶栏的显示尺寸算了一遍】, 忘了同一张图还有更大的展示位 —— 这个守卫就是钉死这件事。
# 光看文件尺寸永远发现不了(192px 的文件本身很"正常"), 必须真机渲染量【源图尺寸 vs 展示位尺寸】。
if os.environ.get("SKIP_IMG_GUARD") == "1":
    print("  [6.8] \u26a0\ufe0f 图片尺寸守卫被跳过(SKIP_IMG_GUARD=1) —— 交付包严禁跳过!")
else:
    print("  [6.8] 跑 img_guard.py (真机渲染全库, 量每张图 源图尺寸 vs 展示位尺寸) ...")
    r = subprocess.run([sys.executable, "img_guard.py"])
    if r.returncode != 0:
        print("  \u274c 图片尺寸守卫未通过: 有图在大展示位上缩成一小坨 / 被拉糊, 拒绝打包")
        sys.exit(1)

# ---- 6.9 字体子集守卫 (v934) ----
# v929 把 cartoon_font.woff2 从 613KB(1694字) 子集化到 244KB(1060字), 砍掉了 562 个【真的会显示】的字。
# 缺字不会报错、不会空白 —— 浏览器会【悄悄回退到系统默认字体】, 那几个字和旁边的卡通字长得不一样。
# 这种问题肉眼极难发现。本守卫真机渲染全库每个屏+每个单词弹窗, 把【真的用卡通字体画出来】的每一个字
# 收集起来去字体 cmap 里逐字查, 缺任何一个 → 拒绝打包。(emoji/箭头排除, 它们永远由系统表情字体画。)
if os.environ.get("SKIP_FONT_GUARD") == "1":
    print("  [6.9] \u26a0\ufe0f 字体子集守卫被跳过(SKIP_FONT_GUARD=1) —— 交付包严禁跳过!")
else:
    print("  [6.9] 跑 font_guard.py (真机渲染全库, 逐字查卡通字体子集有没有漏字) ...")
    r = subprocess.run([sys.executable, "font_guard.py"])
    if r.returncode != 0:
        print("  \u274c 字体子集守卫未通过: 有字会悄悄回退成系统默认字体, 拒绝打包")
        sys.exit(1)

# ---- 7. 打包 ----
OUT = "/mnt/user-data/outputs"
os.makedirs(OUT, exist_ok=True)
# 🔴v526: --label 真正接入 zip 名(旧版此处硬编码陈年标签"食物运动真人发音", 且 --label 解析了从未使用, 每次交付都要手动改名)
desc = label if label else "部署"
zip_name = "%s/\u5355\u8bcd\u5927\u5192\u9669_v%s_%s.zip" % (OUT, new, desc)
EXCLUDE_EXT = (".md", ".py", ".txt", ".zip")  # 🔴 必须含 .zip! 否则工作区残留的源码包/旧zip会被打进部署包(曾导致 v469 部署包 61MB=多塞了31MB的v468源码包)。别删 .zip。
# 🔴v526: 引擎产物与死存根不得进部署包——本轮"先跑jarvis体检后打包"使 kb/backlog json 被打进包(=部署包污染,
#   .json 不在 EXCLUDE_EXT); mespeak 两个 21 字节 json 存根在 v525 线上包亦不存在(线上实证不需要; mespeak.js 本体保留对齐线上)。
EXCLUDE_FILE = {"audio_test.html", "spelling_bee_demo.html",
                "hansen_evolve_kb.json", "hansen_evolve_backlog.json",
                "mespeak_config.json", "en-us.json",
                "template.html", "island_data.json"}  # 🔴 印章源文件(母版+每岛数据)只进交接源码包, 绝不进部署包
count = 0
with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__" and d not in ("map8","newboss","releases","evolution_reports")]  # 🔴v899 map8/newboss/releases/reports只进git+交接包·绝不进部署包
        for fn in files:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ".")
            if fn.lower().endswith(EXCLUDE_EXT):
                continue
            if fn in EXCLUDE_FILE:
                continue
            z.write(full, rel)   # rel 保证 index.html 在根, 无包装文件夹
            count += 1
print("  [7] \u2705 \u6253\u5305\u5b8c\u6210: %s (%d \u4e2a\u6587\u4ef6)" % (zip_name, count))
print("\u2705\u2705\u2705 build v%s \u5b8c\u6210" % new)
