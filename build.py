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
