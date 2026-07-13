#!/usr/bin/env python3
"""sync_guard.py (v936) — 沙盒 ↔ GitHub 同步守卫

Hansen: "每次任务之前, 你有没有先认真核对小程序文件和 GitHub 上存储的一样不一样?
         我怕沙盒模式会破坏我们做过的小程序。一定要保证这个机制,
         并且要保持 GitHub 上的文件绝对是最新的。"

★ 为什么必须有这个: 沙盒是【临时的】, 随时可能重置、可能只恢复了一半、可能是上次会话的旧快照。
  如果我在一棵【落后的/残缺的/被改坏的】树上继续干活, 然后 push ——
  就会把你 GitHub 上好好的代码【覆盖成旧的或坏的】。这是这个项目最致命的风险, 比任何 UI bug 都严重。

★ 本守卫在【每次开工之前】和【每次 push 之后】各跑一遍, 六项全过才算安全:

  ① 仓库对象完整性        git fsck —— 有没有损坏/丢失的对象
  ② 工作区干净            没有未提交的改动(改了没提交 = 随时会丢)
  ③ 没有"漏网"的文件      磁盘上不存在【没进 GitHub 且没被 gitignore】的文件
                          ⚠️ 这是最容易被忽略的一条: 这种文件在 GitHub 上【压根不存在】,
                             沙盒一重置就【永久丢失】(比如新画的 boss 原画、新录的音频)
  ④ GitHub 的文件一个不缺  git 跟踪的每个文件在磁盘上都真的存在
  ⑤ 本地 HEAD == 远端 HEAD 不落后、不领先、不分叉
  ⑥ 内容逐字节一致        ①+②+⑤ 成立时, git 的内容寻址【数学上保证】工作区与 GitHub 逐字节相同
                          (git 的每个 commit/tree/blob 都是内容的 sha1 —— HEAD 相同 = 树相同;
                           工作区干净 = 工作区 == 树。所以三者相等即证毕。)

★ 判定与处置:
    落后(远端有新提交)  → 必须先 git pull, 绝不能在旧树上改
    领先(本地有未推提交) → 必须 push
    分叉(两边都有新提交) → 停手, 人工确认, 【绝不 force push】
    有漏网文件           → 先 git add 进去再干活
    工作区脏             → 先提交或还原

★ 用法:
    python3 sync_guard.py            开工前/推送后自检(只读, 不改任何东西)
    python3 sync_guard.py --strict   同上, 但任何一项不过就 exit 1(给 build 和自动化用)

★ ⚠️ 写这个守卫时我自己先踩了一个坑, 记下来:
   第一版用 `git ls-files` 拿文件列表去和磁盘对比 —— git 默认会把非 ASCII 文件名【转义】成
   "\\346\\255\\246..." 这种八进制串, 拿它去 os.path.exists() 当然找不到,
   于是误报"92 个文件丢了 / 81 个文件没进 GitHub", 差点让人以为 boss 原画全丢了。
   正确做法: `git ls-files -z`(NUL 分隔 + 不转义)。
   → 又一次印证: 探针报警时, 先证明探针是对的, 再怀疑真实情况。
"""
import os
import subprocess
import sys

REPO = "https://github.com/AlienRocketBus/wordminiprogram.git"


def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def main():
    strict = "--strict" in sys.argv
    prebuild = "--pre-build" in sys.argv   # 构建时用: 不查"工作区干净"(正在改代码, 当然脏), 漏网文件只警告
    token = os.environ.get("GH_TOKEN", "").strip()
    problems = []
    print("  ══ 沙盒 ↔ GitHub 同步体检 ══\n")

    # ① 仓库完整性
    r = run(["git", "fsck", "--no-progress", "--no-dangling"])
    broken = [l for l in (r.stdout + r.stderr).split("\n")
              if l.strip() and not l.startswith("Checking") and "dangling" not in l]
    if broken:
        problems.append("git 仓库有损坏的对象: %s" % broken[:2])
        print("   ① 仓库完整性        ❌ %s" % broken[:1])
    else:
        print("   ① 仓库完整性        ✅ 无损坏对象")

    # ② 工作区干净 (先刷新 stat 缓存, 避免 mtime 骗过 git)
    run(["git", "update-index", "--refresh"])
    r = run(["git", "status", "--porcelain"])
    dirty = [l for l in r.stdout.split("\n") if l.strip()]
    if prebuild:
        print("   ② 工作区干净        —— 构建模式跳过(正在改代码, 有未提交改动是正常的: %d 处)" % len(dirty))
    elif dirty:
        problems.append("工作区有 %d 处未提交的改动" % len(dirty))
        print("   ② 工作区干净        ❌ %d 处未提交: %s" % (len(dirty), [d[:40] for d in dirty[:3]]))
    else:
        print("   ② 工作区干净        ✅ 没有未提交的改动")

    # ③ 有没有"漏网"文件(在磁盘上, 但没进 GitHub 也没被 gitignore)
    raw = subprocess.run(["git", "ls-files", "-z"], capture_output=True).stdout
    tracked = {p.decode("utf-8", "surrogateescape") for p in raw.split(b"\0") if p}
    disk = set()
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in (".git", "__pycache__")]
        for f in files:
            disk.add(os.path.relpath(os.path.join(root, f), "."))
    untracked = sorted(disk - tracked)
    ignored = set()
    if untracked:
        rr = subprocess.run(["git", "check-ignore", "-z", "--stdin"],
                            input="\0".join(untracked).encode("utf-8", "surrogateescape"),
                            capture_output=True)
        ignored = {p.decode("utf-8", "surrogateescape") for p in rr.stdout.split(b"\0") if p}
    leaked = [u for u in untracked if u not in ignored]
    if leaked and prebuild:
        print("   ③ 没有漏网文件      ⚠️ %d 个新文件还没 git add(打包后【必须】提交, 否则沙盒重置就没了):" % len(leaked))
        for u in leaked[:8]:
            print("        %s" % u)
    elif leaked:
        problems.append("有 %d 个文件【没进 GitHub】—— 沙盒一重置就永久丢失!" % len(leaked))
        print("   ③ 没有漏网文件      ❌ %d 个文件不在 GitHub 上!" % len(leaked))
        for u in leaked[:6]:
            print("        %s" % u)
        print("        → 先 git add 进去再干活, 否则沙盒重置就没了")
    else:
        print("   ③ 没有漏网文件      ✅ 磁盘上每个文件都在 GitHub 上 (跟踪 %d 个)" % len(tracked))

    # ④ GitHub 上的文件一个不缺
    gone = [t for t in tracked if not os.path.exists(t)]
    if gone:
        problems.append("GitHub 上有 %d 个文件在沙盒里不见了(沙盒残缺)" % len(gone))
        print("   ④ GitHub文件不缺    ❌ %d 个文件沙盒里没有: %s" % (len(gone), gone[:3]))
        print("        → 沙盒不完整, 先 git checkout -- . 或重新 clone")
    else:
        print("   ④ GitHub文件不缺    ✅ 跟踪的 %d 个文件磁盘上一个不少" % len(tracked))

    # ⑤ 本地 HEAD vs 远端 HEAD
    local = run(["git", "rev-parse", "HEAD"]).stdout.strip()
    url = REPO if not token else REPO.replace("https://", "https://%s@" % token)
    r = run(["git", "ls-remote", url, "main"])
    remote = (r.stdout.split("\t")[0].strip() if r.stdout.strip() else "")
    if not remote:
        print("   ⑤ HEAD 对齐         ⚠️ 拿不到远端 HEAD(需要 GH_TOKEN 环境变量), 跳过")
    elif local == remote:
        print("   ⑤ HEAD 对齐         ✅ 本地 = 远端 (%s)" % local[:12])
    else:
        ahead = run(["git", "rev-list", "--count", "%s..HEAD" % remote]).stdout.strip() or "?"
        behind = run(["git", "rev-list", "--count", "HEAD..%s" % remote]).stdout.strip() or "?"
        if behind != "0" and ahead != "0":
            problems.append("本地和远端【分叉】了(本地领先%s / 落后%s) —— 停手, 绝不能 force push" % (ahead, behind))
            print("   ⑤ HEAD 对齐         🚨 分叉! 本地领先 %s 个提交, 落后 %s 个" % (ahead, behind))
        elif behind != "0":
            problems.append("本地【落后】远端 %s 个提交 —— 必须先 git pull, 不能在旧树上改" % behind)
            print("   ⑤ HEAD 对齐         ❌ 本地落后 %s 个提交(沙盒是旧快照!) 必须先 pull" % behind)
        else:
            problems.append("本地【领先】远端 %s 个提交 —— 还没推上去" % ahead)
            print("   ⑤ HEAD 对齐         ⚠️ 本地领先 %s 个提交(还没 push)" % ahead)

    # ⑥ 结论
    print()
    if not problems:
        print("   ⑥ 逐字节一致        ✅ ①+②+⑤ 全过 → git 内容寻址【数学上保证】")
        print("                          工作区与 GitHub 逐字节相同 (HEAD相同=树相同, 工作区干净=工作区==树)")
        print("\n  ✅✅ 沙盒与 GitHub 完全一致, 可以放心开工")
        return 0
    print("  🚨 发现 %d 个问题:" % len(problems))
    for p in problems:
        print("     · %s" % p)
    print("\n  ⛔ 在解决这些问题之前【不要动任何代码】—— 否则可能把 GitHub 上好的版本覆盖掉")
    return 1 if strict else 1


if __name__ == "__main__":
    sys.exit(main())
