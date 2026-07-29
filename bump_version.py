#!/usr/bin/env python3
"""bump_version.py — 单词大冒险原子版本升级工具（v964 起）

用户 2026-07-22 规则：每做一个新东西，版本号必须 +1，一个版本一个 Release。
本工具把交接文档规定的完整版本升级清单铸成一条命令，杜绝手工遗漏
（v963 大阅兵抓出过 3 条手工漏网：backup bootstrap 版本、restore_journal 文件名、SW 升级闸门 version）。

一条命令完成：
  1. 资源戳全量迁移  ?v=<旧> → ?v=<新>（template / island_data.json / 独立页 / 8 Land / 全部运行时 JS）
  2. SW 缓存代际原子轮换  shell/pages/assets 各 +1（icons 不动），并同步测试里的当前代际字面量
  3. 六处运行时版本常量  __HBU_VERSION__ / HBU_RUNTIME_VERSION / 备份×2 CURRENT_APP_VERSION /
     SW 升级闸门 version / package.json+lock
  4. package_release.py 追加新版打包合同（历史合同一字不动；961/962 永拒）
  5. VERSION 写入 + generate.py 重新盖章 19 岛
  6. 全仓校验：旧戳清零、旧代际清零（历史合同区除外）、关键 JS 语法

用法：python3 bump_version.py <新版本号> [--dry-run]
"""
from __future__ import annotations
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BANNED = {961, 962}

# 🔴v1061: 原先是**手工维护的清单**，而 spelling_pk.html 从来就没被登记进来——
#   于是它的 10 个脚本资源戳自 v1004/v1021 起再没被更新过。浏览器与 Service Worker
#   按完整 URL 缓存，URL 永不变就一直供着当年缓存的旧文件内容：
#   同一份 hansen_auth 在岛屿页是最新版、在 PK 页却可能还停在 v1004 时代，且毫无报错。
#   手工清单必然走散（本项目已反复踩到），改为**自动枚举**：
#   除 19 个由 generate.py 从 template 重盖的常规岛外，其余 HTML 全部纳入。
#   8 个 Land 页是手工维护、不由 generate 生成，因此必须留在这里。
def _standalone_html() -> list[str]:
    out = []
    for p in sorted(ROOT.glob("*.html")):
        n = p.name
        if n == "land_template.html":
            continue          # 母版：由上面单列盖戳，不作为发布页
        if n.startswith("island_") and not n.startswith("island_land"):
            continue          # 由 generate.py 从 template 重新盖章生成
        out.append(n)
    return out

RUNTIME_CONSTANT_FILES = {
    "hansen_boss_lock.js": [
        ("window.__HBU_VERSION__ = 'v{old}';", "window.__HBU_VERSION__ = 'v{new}';"),
        ("window.HBU_RUNTIME_VERSION = 'v{old}';", "window.HBU_RUNTIME_VERSION = 'v{new}';"),
    ],
    "hansen_backup_v944.js": [("CURRENT_APP_VERSION={old}", "CURRENT_APP_VERSION={new}")],
    "hansen_backup_bootstrap_v944.js": [
        ("CURRENT_APP_VERSION={old}", "CURRENT_APP_VERSION={new}"),
        ("wordminiprogram_v{old}_restore_journal.json", "wordminiprogram_v{new}_restore_journal.json"),
    ],
    "hansen_sw_upgrade_gate_v944.js": [("version: {old},", "version: {new},")],
    "./hansen_backup_v944.js": [("_v{old}_重置故障取证_", "_v{new}_重置故障取证_")],
}


def fail(msg: str) -> None:
    print(f"❌ {msg}")
    sys.exit(1)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def main() -> None:
    if len(sys.argv) < 2 or not sys.argv[1].isdigit():
        fail("用法: python3 bump_version.py <新版本号> [--dry-run]")
    new = int(sys.argv[1])
    dry = "--dry-run" in sys.argv
    old = int(read(ROOT / "VERSION").strip())
    if new in BANNED:
        fail(f"v{new} 已被用户永久淘汰（v961/v962 墓碑），拒绝使用")
    if new <= old:
        fail(f"新版本 {new} 必须大于当前 {old}")

    changes: list[str] = []

    def apply(path: Path, raw: str, updated: str, note: str) -> str:
        if raw != updated:
            changes.append(f"{path.name}: {note}")
            if not dry:
                path.write_text(updated, encoding="utf-8")
        return updated

    # ── 1) 资源戳：根目录全部 html/js/json（测试与生成岛除外；岛由 generate 重盖）──
    # 🔴v1061: 原先只做 "?v=<上一版> → ?v=<新版>" 的字面替换，**替不到落后多版的戳**。
    #   后果：spelling_pk.html 的 10 个脚本自 v1004/v1021 起再没被更新过。
    #   浏览器与 Service Worker 按**完整 URL** 缓存——URL 永不变，就一直供着
    #   当年缓存的旧文件内容。于是同一份 hansen_auth 在岛屿页是最新版、
    #   在 PK 页却可能还停在 v1004 时代，且不会有任何报错提示。
    #   （与 v1059 "多一个 ?v= 让 SDK 分裂成两份" 属同一类问题。）
    #   改为**正则归一**：任何 ?v=<数字> 一律拉到当前版本，落后多少版都追得上。
    stamp_re = re.compile(r"\?v=\d+")
    stamp_new = f"?v={new}"
    # 🔴v1074：land_template.html / land_data.json 必须一并盖戳。
    #   v1073 把 Land 页改成从母版生成后出现的新顺序问题：
    #   先给 island_land*.html 盖了新戳，随后 generate_land 拿**旧戳的母版**
    #   重新盖章，等于把刚盖好的戳又冲回去 —— bump 自检当场报「旧戳残留」。
    #   印章体系下，母版和数据才是真源，戳必须盖在真源上。
    stamp_files = [ROOT / n for n in _standalone_html()] + [ROOT / "island_data.json"]
    stamp_files += [ROOT / "land_template.html", ROOT / "land_data.json"]
    stamp_files += [p for p in ROOT.glob("*.js") if not p.name.startswith("test_")]
    # 🔴v1067: 守卫脚本也必须纳入资源戳迁移。
    #   check_resources.py 里写死了 **68 处 `?v=960`**，是 v960 那会儿写的，之后再没更新——
    #   于是从 v961 起，贾维斯每一版都在报同一批假警（VERSION 未锁定为 960、
    #   未唯一加载 xxx.js?v=960 …），整整 106 个版本。
    #   后果比"少一道守卫"更糟：**守卫天天喊狼来了，真问题就被淹没了**，
    #   本轮 17 个报告里绝大多数都是它自己过期，不是产品坏了。
    #   病根还是那句老话——写死的常量必然漂移。纳入迁移后升版即自动同步。
    stamp_files += [ROOT / n for n in ("check_resources.py", "economy_guard.py",
                                       "hansen_evolve.py", "jarvis_scan.py",
                                       "hansen_health_check.py")]
    for p in stamp_files:
        if not p.exists():
            continue
        raw = read(p)
        stale = [m.group(0) for m in stamp_re.finditer(raw) if m.group(0) != stamp_new]
        if stale:
            behind = sorted({s for s in stale if s != f"?v={old}"})
            note = f"资源戳 ×{len(stale)}" + (f"（追回落后戳 {behind}）" if behind else "")
            apply(p, raw, stamp_re.sub(stamp_new, raw), note)

    # ── 2) SW 代际轮换 + 测试同步 ──
    sw_path = ROOT / "sw_v944.js"
    sw = read(sw_path)
    gens = {}
    for kind in ("shell", "pages", "assets"):
        m = re.search(rf"'({kind}-(\d+))'", sw)
        if not m:
            fail(f"sw_v944.js 缺少 {kind} 代际")
        gens[kind] = (m.group(1), f"{kind}-{int(m.group(2)) + 1}")
    for cur, nxt in gens.values():
        sw = sw.replace(cur, nxt)
    apply(sw_path, read(sw_path), sw, "SW 代际 " + ", ".join(f"{a}→{b}" for a, b in gens.values()))
    for p in sorted(ROOT.glob("test_*.mjs")):
        raw = read(p)
        upd = raw
        for cur, nxt in gens.values():
            upd = upd.replace(cur, nxt)
        if upd != raw:
            apply(p, raw, upd, "测试当前代际同步")

    # ── 3) 运行时版本常量 ──
    for name, pairs in RUNTIME_CONSTANT_FILES.items():
        p = ROOT / name
        raw = read(p)
        upd = raw
        for a, b in pairs:
            aa, bb = a.format(old=old, new=new), b.format(old=old, new=new)
            if aa not in upd:
                fail(f"{name}: 未找到应有的旧常量片段: {aa[:60]}")
            upd = upd.replace(aa, bb)
        apply(p, raw, upd, "运行时版本常量")
    for name in ("package.json", "package-lock.json"):
        p = ROOT / name
        raw = read(p)
        apply(p, raw, raw.replace(f'"version": "{old}.0.0"', f'"version": "{new}.0.0"'), "包版本")

    # ── 4) 打包合同追加 ──
    pr = ROOT / "package_release.py"
    raw = read(pr)
    if f'"{new}":' in raw:
        fail(f"package_release.py 已存在 v{new} 合同")
    anchor = re.search(rf'\n(\s*)"{old}": \(\(([^)]*)\), "v={old}"\),', raw)
    if not anchor:
        fail("package_release.py 未定位到当前版合同行")
    indent = anchor.group(1)
    new_gens = ", ".join(f'"{nxt}"' for _, nxt in gens.values()) + ', "icons-3"'
    contract = f'{anchor.group(0)}\n{indent}"{new}": (({new_gens}), "v={new}"),'
    apply(pr, raw, raw.replace(anchor.group(0), contract, 1), f"打包合同 +v{new}")

    # ── 5) VERSION + 重新盖章 ──
    apply(ROOT / "VERSION", read(ROOT / "VERSION"), f"{new}\n", f"VERSION {old}→{new}")
    if not dry:
        subprocess.run([sys.executable, "generate.py"], cwd=ROOT, check=True)
        # 🔴v1073 治本：单词大陆 8 岛也纳入印章体系。
        #   在此之前 island_land1~8.html 手工维护，同一件事被漏了**六次**
        #   (v1021 账号 / v1030 门槛 / v1034 成就 / v1038 音量 / v1048 云恢复 / v1072 拼写大PK)。
        #   现在改一次母版，27 个岛全部跟上。
        if (ROOT / "generate_land.py").exists():
            subprocess.run([sys.executable, "generate_land.py"], cwd=ROOT, check=True)

    # ── 6) 校验 ──
    if not dry:
        # 🔴v1064: 原来只查「上一版的戳」是否残留，所以像 spelling_pk.html
        #   那种停在 v1004 的落后戳，这道校验根本看不见（漏了几十版）。
        #   改为查**任何不等于当前版本的戳**；测试文件里常引用旧代码原文，故排除。
        stray = []
        for p in list(ROOT.glob("*.html")) + list(ROOT.glob("*.js")) + [ROOT / "island_data.json"]:
            if not p.exists() or p.name.startswith("test_"):
                continue
            behind = {m.group(0) for m in stamp_re.finditer(read(p)) if m.group(0) != stamp_new}
            if behind:
                stray.append(f"{p.name}{sorted(behind)}")
        if stray:
            fail(f"旧戳残留: {stray[:8]}")
        for cur, _ in gens.values():
            hits = [
                p.name for p in list(ROOT.glob("*.js")) + list(ROOT.glob("test_*.mjs"))
                if cur in read(p) and p.name != "package_release.py"
            ]
            if hits:
                fail(f"旧代际 {cur} 残留: {hits[:6]}")
        for name in list(RUNTIME_CONSTANT_FILES) + ["sw_v944.js"]:
            subprocess.run(["node", "--check", str(ROOT / name)], check=True)
        subprocess.run([sys.executable, "-m", "py_compile", str(pr)], check=True)

    print(("[dry-run] " if dry else "") + f"✅ v{old} → v{new} 原子升级完成，共 {len(changes)} 处：")
    for c in changes[:14]:
        print("  ·", c)
    if len(changes) > 14:
        print(f"  · … 另 {len(changes) - 14} 处")
    print("下一步：填写 CHANGELOG → 提交推送 → CI 自动发布 Release v%d" % new)


if __name__ == "__main__":
    main()

# 🔴v998: README 同步提醒 —— v961~v997 曾整段漏更(37版), 立此纪律
def _readme_reminder(new_version):
    try:
        import pathlib as _p, re as _r
        rm = _p.Path(__file__).parent / 'README.md'
        if not rm.exists():
            return
        txt = rm.read_text(encoding='utf-8')
        vs = {int(m[1:]) for m in _r.findall(r'^## (v9\d\d)', txt, _r.M)}
        if new_version not in vs:
            print(f'  [!] README.md 尚未记录 v{new_version} —— 发版前请补写该版章节')
    except Exception:
        pass
