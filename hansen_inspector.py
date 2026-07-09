#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 hansen_inspector.py  ——  单词大冒险 · 自进化 AI 监察官 (v2, 2026-06 / 项目 v400+)
================================================================================
"跑一次就把整张《超详细 Bug 清单》逐项过一遍"的自动监察官。

v2 相比 v1 的升级:
  ★ 内置《超详细清单》体检大纲 (RUBRIC): 每次启动按清单**逐项检查**, 输出
    「按清单打勾的体检表」—— 能静态查的自动 ✅/❌, 能浏览器查的真实加载查,
    逻辑类交 AI 层, 需真机的明确标 👁(需眼检) 并告诉你看什么。
  ★ 新增大量静态检查: mp3 缓存戳一致性 / 18岛联动矩阵 / 孤儿文件 / boss 防重复
    与计时器守卫 / 存读档健壮性 / 包体性能。
  ★ 浏览器层增强: 手机视口(360x640)下查横向溢出 + 赛季 boss 战斗界面是否超屏。
  ★ 修复工单 (--fix): 把所有发现连同**精确位置 + 修复建议**写成工单文件。
    注意: 本工具**不会盲改游戏逻辑/UI 代码**(历史 BUG#22 的教训: 为绕 bug 乱改
    会出新 bug)。它自动修的只有"机械且可逆"的安全项; 逻辑/UI 类生成工单交你/我评审后改。

四层验证 + 清单体检 + 工单, 结果按 ERROR/WARN/INFO 分级:
  A 静态质检 (调 check_resources.py 的 10 项)
  B 扩展静态 (KB 守卫 + 新增 6 组静态检查)
  C 真实浏览器 (全岛: 崩溃/白屏/WORD_MAP/版本红条/报错/乱码/横向溢出/赛季boss超屏)
  D AI 审查 (可选, 设 ANTHROPIC_API_KEY 后用 Claude 按清单逐条审逻辑并给修复建议)
  ▶ 清单体检表 + (可选)修复工单

用法 (启动指令):
  python3 hansen_inspector.py            # 【主指令】全量体检 (A+B+C; 有 key 自动带 D) + 清单表
  python3 hansen_inspector.py --fix       # 全量体检 + 生成修复工单 hansen_inspector_fixes.md
  python3 hansen_inspector.py --quick    # 快速 (A+B + 仅 3 岛行为), 日常自查
  python3 hansen_inspector.py --gate      # 打包闸门 (有 ERROR 拦住, build.py 可挂)
  python3 hansen_inspector.py --ai        # 强制 AI 层 (没 key 则报错)
  python3 hansen_inspector.py --no-browser# 跳过浏览器层 (只静态, 调试用)
退出码: 有任何 ERROR -> 1, 否则 0。

【铁律·维护】本工具与 build.py/check_resources.py/hansen_health_check.py 一样:
  完整源码备份进 README《核心开发工具源码备份》章节防丢; 每次改它都同步更新该章节。
================================================================================
"""
import os, re, sys, json, glob, socket, time, subprocess, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

ARGS = sys.argv[1:]
QUICK      = "--quick" in ARGS
GATE       = "--gate" in ARGS
FORCE_AI   = "--ai" in ARGS
NO_BROWSER = "--no-browser" in ARGS
FIX        = "--fix" in ARGS

ERROR, WARN, INFO = "ERROR", "WARN", "INFO"
SEV_RANK = {ERROR: 0, WARN: 1, INFO: 2}
FINDINGS = []   # {sev, cat, cid, msg, where, fix}
def add(sev, cat, cid, msg, where="", fix=""):
    FINDINGS.append({"sev": sev, "cat": cat, "cid": cid, "msg": msg, "where": where, "fix": fix})

# 清单逐项状态: rubric_id -> (icon, detail)
CHECK_STATUS = {}
def setstat(rid, icon, detail=""):
    CHECK_STATUS[rid] = (icon, detail)

ISLAND_NAMES = ["action","adjective","animal","body","city","clothes","color","family",
                "food","home","job","nature","question","school","season","sports",
                "time","traffic","treasure"]

# 应全岛接入的共享模块 (动物岛=原始岛, 不加载 island_upgrade, 属已知例外)
SHARED_MODULES = ["hansen_coin_wallet","hansen_gem_system","hansen_diamond_shop","hansen_gacha",
                  "hansen_cards","hansen_cardbook_wallet","hansen_season","hansen_boss_lock",
                  "hansen_boss_progress","hansen_preload","hansen_addiction","hansen_totals_wallet",
                  "hansen_ach_wallet","hansen_spell_practice"]

# =============================================================================
#  内置知识库 (历史 bug 档案 + 守卫). 修完新 bug 就往这里加一条 -> 永不复发。
# =============================================================================
KB = [
    {"id":"BUG10_cache_desync", "title":"版本/缓存戳不同步导致'图片传上去看不到新图'",
     "cat":"版本一致性", "sev":ERROR, "type":"behavioral", "fixed":"v214/v209",
     "note":"主戳?v=NNN + __HBU_VERSION__/HBU_RUNTIME_VERSION + VERSION 必须全一致; A层静态查 + C层运行时红条 双保险。"},
    {"id":"boss_victory_double_fire", "title":"boss 胜利结算双触发(重复发奖)",
     "cat":"结算", "sev":ERROR, "type":"review", "fixed":"加3秒防重锁",
     "note":"任何'胜利/结算'入口都要有防重触发锁; AI 层重点审 award/settle 是否可能被调两次。"},
    {"id":"season_hooks_homepage_only", "title":"赛季钩子只挂首页、没挂全部岛",
     "cat":"赛季/一致性", "sev":ERROR, "type":"review", "fixed":"全18岛接入",
     "note":"任何系统性功能(赛季/签到/成就/货币)必须18岛+首页全接(铁律0.9)。"},
    {"id":"timer_race", "title":"计时器竞态: 答对/退出/切屏后倒计时没停",
     "cat":"计时器", "sev":ERROR, "type":"review", "fixed":"-",
     "note":"答对、退出、切后台、最后一题都要 clearInterval/clearTimeout。"},
    {"id":"coin_display_vs_grant", "title":"金币显示≠发放(显示了不给 / 给了不显示)",
     "cat":"货币", "sev":ERROR, "type":"review", "fixed":"-",
     "note":"合法金币变量只有 _sessionCoins / coinReward。显示的金币必须 == 实际进钱包。"},
    {"id":"deprecated_currency_stars_grant", "title":"废弃货币 星星 S.stars 仍被主动发放",
     "cat":"货币", "sev":ERROR, "type":"forbid_regex", "fixed":"已统一为金币",
     "pattern":r"S\.stars\s*(\+\+|\+=)|=\s*S\.stars\s*\+", "allow":["hansen_rain.js"],
     "note":"星星已废弃统一为金币。只抓'还在主动给星星'。"},
    {"id":"record_tie_text", "title":"平纪录应显示'追平'、不能显示'还差0分'",
     "cat":"显示", "sev":WARN, "type":"forbid_regex", "fixed":"-",
     "pattern":r"还差\s*0\s*分", "allow":[],
     "note":"本局==历史最高应显示'追平纪录'。"},
    {"id":"garbled_undefined", "title":"显示乱码 undefined/NaN/null/[object Object]",
     "cat":"显示", "sev":WARN, "type":"behavioral", "fixed":"-",
     "note":"C 层真实加载后扫描可见 DOM 文本。"},
    {"id":"load_typeof_reset", "title":"load() 里 typeof!=='number' 一刀切重置会毁对象字段",
     "cat":"存档", "sev":WARN, "type":"review", "fixed":"-",
     "note":"读档时把非 number 字段统一重置成 0 会破坏对象/数组字段。"},
    {"id":"debounced_save", "title":"防抖 save 后立即读 localStorage 会读到旧值",
     "cat":"存档", "sev":INFO, "type":"review", "fixed":"-",
     "note":"测持久化要等约1.5秒再读。"},
]

# =============================================================================
#  《超详细清单》体检大纲 (RUBRIC) —— 每次启动按它逐项过
#  kind: static=自动静态 / browser=自动浏览器 / ai=AI层 / manual=需真机眼检
# =============================================================================
RUBRIC = [
    # ---- 崩溃 / 报错 ----
    ("A.crash",   "崩溃",   "全岛加载无崩溃/白屏 (C层真实加载)", "browser"),
    ("A.console", "崩溃",   "全岛无 console.error / pageerror", "browser"),
    ("A.optcnt",  "崩溃",   "boss 选项数<4 不会越界 (BUG#13: 禁硬编码 %4)", "ai"),
    # ---- 货币 / 经济 ----
    ("B.coininv", "货币",   "金币 显示==发放 (合法变量仅 _sessionCoins/coinReward)", "ai"),
    ("B.geminv",  "货币",   "钻石 显示==发放; spend 余额不足返回false不扣", "ai"),
    ("B.stars",   "货币",   "废弃星星无主动发放 (KB守卫)", "static"),
    ("B.dup",     "货币",   "结算不重复发奖 (boss双路径3秒锁)", "ai"),
    ("B.spendret","货币",   "抽卡/商店先查余额再扣再发, 无'钱不够白送'", "ai"),
    # ---- Boss 战斗 ----
    ("C.bosssz",  "Boss",   "赛季 boss 尺寸不超屏 (横向+竖向)", "browser"),
    ("C.antidup", "Boss",   "boss 防同题重复作答 (dataset.done)", "static"),
    ("C.timer",   "Boss",   "boss 计时器/setTimeout 有 bossActive 守卫", "static"),
    ("C.nextq",   "Boss",   "nextBossQ 去重锁 (BUG#14/16/18)", "static"),
    # ---- 边界显示 ----
    ("D.tie",     "显示",   "平纪录显示'追平'不显示'还差0分' (KB守卫)", "static"),
    ("D.garble",  "显示",   "无乱码 undefined/NaN/null/[object Object]", "browser"),
    ("D.edge",    "显示",   "0分/破纪录/最后一题/满分 边界显示正确", "ai"),
    # ---- 存档 ----
    ("E.save",    "存档",   "save 写主存档+备份(_bak)", "static"),
    ("E.load",    "存档",   "load 逐字段类型校验, 不一刀切重置 (KB)", "static"),
    ("E.multi",   "存档",   "多标签同岛并发写不丢档", "manual"),
    # ---- 缓存 / 版本 ----
    ("F.mainv",   "版本",   "主缓存戳 ?v=NNN 全一致 (A层)", "static"),
    ("F.mp3v",    "版本",   "mp3 戳 ?vNNN 一致 (改mp3必升)", "static"),
    ("F.redbar",  "版本",   "运行时无版本不一致红条", "browser"),
    # ---- 音频 ----
    ("G.vol",     "音频",   "154 词发音音量统一 (v399已归一化)", "manual"),
    ("G.sentvol", "音频",   "例句音频音量是否也统一", "manual"),
    ("G.mute",    "音频",   "静音开关全声音生效/跨岛一致/记忆", "manual"),
    ("G.tts",     "音频",   "真人mp3缺失回退TTS且国内可用", "manual"),
    # ---- UI / 布局 / 移动端 / 美观 ----
    ("H.hover",   "UI",     "各岛首页手机视口无横向溢出", "browser"),
    ("H.safe",    "UI",     "刘海/灵动岛/底部安全区不遮挡", "manual"),
    ("H.touch",   "UI",     "按钮够大(≥44px)/间距/不误触", "manual"),
    ("H.longtxt", "UI",     "超长单词/例句/名称不撑破卡片", "manual"),
    ("H.consist", "UI",     "18岛+首页 配色/字体/圆角/组件 视觉规格统一", "manual"),
    ("H.space",   "UI",     "空间利用合理(留白/层级/首屏黄金区)", "manual"),
    ("H.theme",   "UI",     "换主题后文字对比度够/不撞色", "manual"),
    # ---- 18 岛统一 / 联动 ----
    ("I.matrix",  "联动",   "共享模块全岛接入 (联动矩阵)", "static"),
    ("I.scripts", "联动",   "各岛外部脚本数一致", "static"),
    ("I.wallet",  "联动",   "全局钱包跨岛真共享(非各岛各算)", "manual"),
    ("I.cards",   "联动",   "卡册/抽卡跨岛累计同一套", "manual"),
    # ---- 系统性 ----
    ("J.season",  "系统",   "赛季钩子全岛接入 (KB)", "static"),
    ("J.signin",  "签到",   "★★每日宝箱跨岛只领一次 (v411/v431修复的【重大bug】, 重点必查): 领1岛 → 其余【全部18岛】逐个验, 必须全金币Δ=0 且不可点开 + 连签全局统一", "browser"),
    ("J.seasoniso","赛季",   "★★赛季积分隔离 (v441修复的【重大bug】, 重点必查): 其余【全部18岛】答对题/打boss 赛季积分必须全Δ=0, 仅赛季岛 island_season.html 累加(否则18岛答题全在替赛季boss答题)", "browser"),
    ("J.signw",   "签到",   "★签到修复在位: hansen_checkin_global.js存在+19岛全引用+addiction稀有度闸门 (防修复被删)", "static"),
    ("J.empty",   "系统",   "赛季空窗期加分/抽卡不报错", "ai"),
    # ---- 抽卡 / 卡册 ----
    ("K.pity",    "抽卡",   "保底(软/硬)概率正确 (需模拟脚本)", "manual"),
    ("K.frag",    "抽卡",   "碎片兑换原子/至尊不可换/换未拥有", "ai"),
    # ---- 主题商店 ----
    ("L.dup",     "主题",   "theme_shop(首页) vs diamond_shop(岛内) 是否重叠", "static"),
    ("L.diaown",  "主题",   "钻石主题equip是否校验已购(防后台白嫖, v454)", "static"),
    ("L.apply",   "主题",   "主题切换全界面生效/刷新记忆/默认恢复", "manual"),
    # ---- 性能 ----
    ("M.size",    "性能",   "包体大小 (首屏/弱网影响)", "static"),
    ("M.preload", "性能",   "音频预加载是否拖慢首屏(改懒加载)", "static"),
    ("M.mem",     "性能",   "长玩内存/AudioContext/DOM 回收 (BUG#5)", "manual"),
    ("M.anim",    "性能",   "低端机动画掉帧", "manual"),
    # ---- 数据完整性 ----
    ("N.wm",      "数据",   "WORD_MAP 154键/引用文件全在", "static"),
    ("N.orphan",  "数据",   "无孤儿/重复 js 文件占包体", "static"),
    ("N.online",  "数据",   "线上资源无404(本地有≠线上有)", "manual"),
    # ---- 时间 / 环境 ----
    ("O.day",     "环境",   "跨天(00:00)边界 金币上限/签到/任务", "ai"),
    ("O.tz",      "环境",   "改设备时间能否刷签到", "manual"),
]

# =============================================================================
#  ① 自动发现
# =============================================================================
def discover():
    islands = sorted(n for n in ISLAND_NAMES if os.path.exists("island_%s.html" % n))
    extra_islands = sorted(re.sub(r"^island_|\.html$", "", f)
                           for f in glob.glob("island_*.html")
                           if re.sub(r"^island_|\.html$", "", f) not in ISLAND_NAMES)
    js_modules = sorted(glob.glob("*.js"))
    legal_coin_vars = ["_sessionCoins", "coinReward"]
    systems = {
        "season":  os.path.exists("hansen_season.js"),
        "gem":     os.path.exists("hansen_gem_system.js"),
        "diamond_shop": os.path.exists("hansen_diamond_shop.js"),
        "gacha":   os.path.exists("hansen_gacha.js"),
        "cards":   os.path.exists("hansen_cards.js"),
        "theme_shop": os.path.exists("hansen_theme_shop.js"),
        "coin_wallet": os.path.exists("hansen_coin_wallet.js"),
        "upgrade": os.path.exists("hansen_island_upgrade.js"),
    }
    logic_files = [f for f in [
        "hansen_island_upgrade.js","hansen_coin_wallet.js","hansen_gem_system.js",
        "hansen_diamond_shop.js","hansen_gacha.js","hansen_season.js",
        "hansen_cards.js","hansen_cardbook_wallet.js","hansen_totals_wallet.js",
        "hansen_ach_wallet.js","hansen_boss_progress.js","hansen_spell_practice.js"]
        if os.path.exists(f)]
    return {"islands": islands, "extra_islands": extra_islands, "js_modules": js_modules,
            "legal_coin_vars": legal_coin_vars, "systems": systems, "logic_files": logic_files}

# =============================================================================
#  A 静态质检 (复用 check_resources.py)
# =============================================================================
def layer_A_check_resources():
    print("\n[A] 静态质检 check_resources.py")
    if not os.path.exists("check_resources.py"):
        add(WARN, "工具", "no_check_resources", "缺 check_resources.py, 跳过 A 层 (可从 README 备份恢复)")
        setstat("F.mainv", "⚠️", "缺 check_resources.py"); setstat("N.wm", "⚠️", "缺 check_resources.py")
        return
    r = subprocess.run([sys.executable, "check_resources.py"], capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.returncode != 0:
        for line in r.stdout.splitlines():
            if line.strip().startswith("- "):
                add(ERROR, "静态质检", "check_resources", line.strip()[2:].strip())
        if not any(f["cid"] == "check_resources" for f in FINDINGS):
            add(ERROR, "静态质检", "check_resources", "check_resources.py 未通过 (详见上方输出)")
        setstat("F.mainv", "❌", "check_resources 未过"); setstat("N.wm", "❌", "check_resources 未过")
    else:
        setstat("F.mainv", "✅", "主缓存戳全一致"); setstat("N.wm", "✅", "WORD_MAP 154/引用全在")

# =============================================================================
#  新增静态检查 (B2)
# =============================================================================
def read(f):
    return open(f, encoding="utf-8", errors="replace").read()

def check_mp3_buster():
    nums = set()
    for f in glob.glob("*.html") + glob.glob("*.js"):
        for m in re.finditer(r"\?v(\d+)\b", read(f)):  # ?vNNN 无等号 = mp3 戳
            nums.add(m.group(1))
    if not nums:
        setstat("F.mp3v", "ℹ️", "未发现 mp3 戳"); return
    # 不同资源组(单词发音 / 例句 SENT_VER)各自一套戳是正常的, 只提醒不报错
    listed = ", ".join("?v" + n for n in sorted(nums))
    add(INFO, "版本", "mp3_buster_info",
        "mp3 缓存戳: %s (通常 单词发音 与 例句 各一套, 正常)。提醒: 改了某组音频要把对应那组的 ?vNNN 全部升一档, 否则该组放旧音频。" % listed)
    setstat("F.mp3v", "✅", "戳: %s (各资源组各一套, 正常)" % listed)

def check_island_unification(ctx):
    htmls = {n: read("island_%s.html" % n) for n in ctx["islands"]}
    worst = "✅"
    for mod in SHARED_MODULES:
        miss = [n for n, t in htmls.items() if mod not in t]
        if miss:
            add(WARN, "联动", "unify_%s" % mod,
                "共享模块 %s 没接到这些岛(铁律0.9 系统性功能须全岛统一): %s" % (mod, ", ".join(miss)),
                fix="在缺失岛的 <script> 区按统一顺序加 <script src=\"%s.js?v=NNN\"></script>" % mod)
            worst = "❌"
    # 脚本数一致性
    counts = {n: len(re.findall(r"<script[^>]*src=", t)) for n, t in htmls.items()}
    spread = max(counts.values()) - min(counts.values()) if counts else 0
    if spread <= 1:
        setstat("I.scripts", "✅", "脚本数 %d~%d (仅差 upgrade.js)" % (min(counts.values()), max(counts.values())))
    else:
        odd = [k for k, v in counts.items() if v != max(set(counts.values()), key=list(counts.values()).count)]
        add(WARN, "联动", "script_count", "各岛外部脚本数差异较大(规格可能不统一): %s" % counts)
        setstat("I.scripts", "⚠️", "脚本数差 %d" % spread)
    setstat("I.matrix", worst, "%d 个共享模块全岛接入" % len(SHARED_MODULES) if worst == "✅" else "有岛缺模块")
    setstat("J.season", "✅" if "season" not in [m for m in SHARED_MODULES if any(m not in t for t in htmls.values())] else "❌")

def check_orphan_files(ctx):
    all_html = " ".join(read(f) for f in glob.glob("*.html"))
    orphans = []
    for j in glob.glob("hansen_*.js"):
        if j not in all_html:
            orphans.append(j)
    if orphans:
        add(INFO, "数据", "orphan_js",
            "以下 js 没被任何 html 加载(疑似孤儿/已废弃, 仍占部署包体): %s" % ", ".join(orphans),
            fix="确认是否还需要; 不需要则从部署包剔除以减小体积")
        setstat("N.orphan", "⚠️", "孤儿: %s" % ", ".join(orphans))
    else:
        setstat("N.orphan", "✅", "无孤儿 js")
    # theme_shop vs diamond_shop 重叠
    has_theme = os.path.exists("hansen_theme_shop.js")
    has_dia = os.path.exists("hansen_diamond_shop.js")
    idx = read("index.html") if os.path.exists("index.html") else ""
    if has_theme and has_dia:
        add(INFO, "主题", "theme_dup",
            "同时存在 hansen_theme_shop.js 与 hansen_diamond_shop.js(都卖主题), 可能功能重叠, 建议确认是否两套主题系统并存",
            fix="确认主题购买唯一入口, 避免两套商店不一致/重复扣费")
        setstat("L.dup", "⚠️", "theme_shop 与 diamond_shop 可能重叠")
    else:
        setstat("L.dup", "✅", "无重复主题系统")

def check_boss_safety(ctx):
    miss_dup, miss_active = [], []
    for n in ctx["islands"]:
        t = read("island_%s.html" % n)
        if "dataset.done" not in t: miss_dup.append(n)
        if "bossActive" not in t: miss_active.append(n)
    setstat("C.antidup", "✅" if not miss_dup else "❌", "防同题重复作答" if not miss_dup else "缺 dataset.done: %s" % miss_dup)
    setstat("C.timer", "✅" if not miss_active else "⚠️", "有 bossActive 守卫" if not miss_active else "缺: %s" % miss_active)
    # nextBossQ 去重锁在共享 hansen_boss_lock.js 里(运行时包装全岛), 不在各岛 inline
    bl = read("hansen_boss_lock.js") if os.path.exists("hansen_boss_lock.js") else ""
    has_nextlock = "lastNextBossQAt" in bl
    setstat("C.nextq", "✅" if has_nextlock else "⚠️",
            "nextBossQ 去重锁在 boss_lock.js" if has_nextlock else "未找到去重锁")
    if miss_dup:
        add(WARN, "Boss", "boss_antidup", "这些岛 boss 缺 dataset.done 防重复作答守卫: %s" % miss_dup)
    if not has_nextlock:
        add(INFO, "Boss", "boss_nextq", "未在 hansen_boss_lock.js 找到 nextBossQ 去重锁 lastNextBossQAt(BUG#14/16/18 区域, 建议核对)")

def check_save_load(ctx):
    bad_bak, bad_guard = [], []
    for n in ctx["islands"]:
        t = read("island_%s.html" % n)
        if "_bak" not in t: bad_bak.append(n)
        if len(re.findall(r"typeof S\.", t)) < 8: bad_guard.append(n)
    setstat("E.save", "✅" if not bad_bak else "⚠️", "写主存档+备份" if not bad_bak else "缺备份_bak: %s" % bad_bak)
    setstat("E.load", "✅" if not bad_guard else "⚠️", "逐字段类型校验" if not bad_guard else "字段守卫偏少: %s" % bad_guard)
    if bad_bak:
        add(WARN, "存档", "save_no_bak", "这些岛 save 可能没写备份键 _bak: %s" % bad_bak)
    if bad_guard:
        add(WARN, "存档", "load_weak_guard", "这些岛 load 的逐字段类型校验偏少(KB load_typeof_reset 区域): %s" % bad_guard)

def dir_size(path):
    total = 0
    for dp, _, fns in os.walk(path):
        for fn in fns:
            try: total += os.path.getsize(os.path.join(dp, fn))
            except OSError: pass
    return total

def check_package_size():
    sizes = {}
    for d in ["words", "sentences", "bosses", "mespeak"]:
        if os.path.isdir(d):
            sizes[d] = dir_size(d)
    total = dir_size(".")
    mb = lambda b: round(b / 1048576.0, 1)
    detail = "总 %sMB (%s)" % (mb(total), ", ".join("%s %sMB" % (k, mb(v)) for k, v in sizes.items()))
    if total > 20 * 1048576:
        add(WARN, "性能", "pkg_size",
            "部署包体偏大: %s。首屏/弱网/老机加载慢。建议: 音频更狠压缩或按需加载, 大图压缩。" % detail,
            fix="例句/发音音频压缩或懒加载; boss 大图压缩")
        setstat("M.size", "⚠️", detail)
    else:
        setstat("M.size", "✅", detail)
    # 预加载拖慢首屏
    if os.path.exists("hansen_preload.js"):
        pt = read("hansen_preload.js")
        if re.search(r"\.mp3", pt) and ("for" in pt or "forEach" in pt or "map(" in pt):
            add(INFO, "性能", "preload_heavy",
                "hansen_preload.js 进岛预载大量 mp3 -> 首屏 networkidle 长时间不空闲(监察官/health_check 慢也因此), 真实首屏也受影响。建议改'先进得去, 音频懒加载'。",
                fix="把全量预载改为按需/懒加载, 或只预载当前关卡所需")
            setstat("M.preload", "⚠️", "进岛全量预载 mp3")
        else:
            setstat("M.preload", "✅", "预载不重")
    else:
        setstat("M.preload", "ℹ️", "无 preload")

def check_currency_static(ctx):
    # 仅确认合法发币模式在位(不做易误报的变量名黑扫描, 复杂语义交 AI 层)
    has_earn = any("earnCoinOnCorrect" in read(f) for f in (["hansen_island_upgrade.js"] + glob.glob("island_*.html")) if os.path.exists(f))
    if has_earn:
        add(INFO, "货币", "coin_model", "发币模型在位(earnCoinOnCorrect: 命中上限不发/否则add(1)并返回true; 显示==发放交AI层逐模式确认)")

    # 经济/Boss 红线 确定性静态守卫 (无需 key; 把人工验过的不变量固化为回归保护, 防被改回)
    def _has(fname, *needles):
        if not os.path.exists(fname): return False
        t = read(fname)
        return all(n in t for n in needles)

    if _has("hansen_gem_system.js", "spend:", "w<n", "return false"):
        setstat("B.geminv", "✅", "HansenGems.spend: 余额不足(w<n)返回false不扣")
    else:
        setstat("B.geminv", "❌", "未见 HansenGems.spend 余额守卫"); add(ERROR, "货币", "geminv_guard", "hansen_gem_system.js spend 缺 w<n return false", fix="恢复 if(w<n)return false")

    coin_ok = _has("hansen_coin_wallet.js", "spend:", "return false")
    gem_ok  = _has("hansen_gem_system.js", "spend:", "return false")
    if coin_ok and gem_ok:
        setstat("B.spendret", "✅", "HansenCoins.spend + HansenGems.spend 均先查余额, 不足返回false")
    else:
        miss = [n for n, ok in [("coin", coin_ok), ("gem", gem_ok)] if not ok]
        setstat("B.spendret", "❌", "钱包 spend 缺余额守卫: %s" % miss); add(ERROR, "货币", "spendret_guard", "钱包 spend 缺 return false 余额守卫: %s" % miss)

    if _has("island_season.html", "bossActive", "dataset.done"):
        setstat("B.dup", "✅", "赛季岛 boss: bossActive 守卫 + dataset.done 防重复结算")
    else:
        setstat("B.dup", "⚠️", "赛季岛 boss 防重复守卫不全"); add(WARN, "货币", "dup_guard", "island_season boss 结算防重复守卫不全(bossActive/dataset.done)")

    if _has("hansen_cardbook_wallet.js", "exchangeByFrag", "legendary", "return null"):
        setstat("K.frag", "✅", "exchangeByFrag: 至尊(legendary)不可换(return null)")
    else:
        setstat("K.frag", "⚠️", "未确认 exchangeByFrag 至尊不可换守卫(或已改名)"); add(WARN, "抽卡", "frag_guard", "hansen_cardbook_wallet.js 未见 exchangeByFrag+legendary+return null 同现")

    # 钻石主题 equip 必须校验已购 (v454: 堵后台白嫖钻石主题, A-E真机验过)
    if _has("hansen_diamond_shop.js", "function equip(id)", "!o.owned[id]) return"):
        setstat("L.diaown", "✅", "钻石主题 equip 校验已购(未购不能装备, 堵后台白嫖)")
    else:
        setstat("L.diaown", "❌", "钻石主题 equip 缺已购校验(可后台白嫖!)"); add(ERROR, "主题", "diaown_guard", "hansen_diamond_shop.js equip 缺 owned 校验, 可白嫖钻石主题", fix="equip 加 if(id && !o.owned[id]) return;")

    cap_ok    = _has("hansen_island_upgrade.js", "coinDay", "coinEarnedToday")
    season_ok = _has("hansen_season.js", "o.day!==t")
    if cap_ok and season_ok:
        setstat("O.day", "✅", "金币上限 coinDay!==t 重置 + 赛季计数 o.day!==t 重置")
    else:
        miss = [n for n, ok in [("金币上限", cap_ok), ("赛季计数", season_ok)] if not ok]
        setstat("O.day", "⚠️", "跨天重置未全确认: %s" % miss); add(WARN, "环境", "day_guard", "跨天重置未确认: %s" % miss)

    if os.path.exists("island_season.html"):
        _st = read("island_season.html")
        no_mod4 = ("%4" not in _st) and ("% 4" not in _st)
        dyn = "findIndex" in _st
        if no_mod4 and dyn:
            setstat("A.optcnt", "✅", "无硬编码 %4 + findIndex 动态定位正确项(BUG#13)")
        else:
            setstat("A.optcnt", "❌", "boss 选项可能越界 (含%4=%s, findIndex=%s)" % (not no_mod4, dyn)); add(ERROR, "崩溃", "optcnt_guard", "island_season boss 选项定位疑似硬编码 %4")

# =============================================================================
#  B 扩展静态检查
# =============================================================================
def layer_B_static(ctx):
    print("\n[B] 扩展静态检查 (KB 守卫 + 新增 6 组)")
    files = sorted(glob.glob("*.js") + glob.glob("*.html"))
    # --- KB forbid_regex 守卫 ---
    for entry in KB:
        if entry["type"] != "forbid_regex":
            continue
        pat = re.compile(entry["pattern"]); allow = set(entry.get("allow", []))
        hits = []
        for f in files:
            if f in allow: continue
            for i, ln in enumerate(read(f).splitlines(), 1):
                if pat.search(ln): hits.append("%s:%d" % (f, i))
        if hits:
            add(entry["sev"], entry["cat"], entry["id"],
                "%s (KB守卫命中 %d 处)" % (entry["title"], len(hits)),
                ", ".join(hits[:8]) + (" ..." if len(hits) > 8 else ""))
            if entry["id"] == "record_tie_text": setstat("D.tie", "❌", "命中'还差0分'")
            if entry["id"] == "deprecated_currency_stars_grant": setstat("B.stars", "❌", "仍在发星星")
        else:
            add(INFO, entry["cat"], entry["id"], "KB守卫通过: 未发现「%s」" % entry["title"])
            if entry["id"] == "record_tie_text": setstat("D.tie", "✅", "无'还差0分'")
            if entry["id"] == "deprecated_currency_stars_grant": setstat("B.stars", "✅", "无主动发星星")
    # --- 废弃星星遗留显示 (低优先级 INFO) ---
    star_res = sum(len(re.findall(r"S\.stars", read(f))) for f in glob.glob("island_*.html"))
    if star_res:
        add(INFO, "货币", "stars_residue_display",
            "废弃星星已停发(0 处主动发放), 但仍有 %d 处 schema/显示遗留(低优先级)" % star_res)
    # --- 系统存在性 ---
    for key, fname in [("season","hansen_season.js"), ("gem","hansen_gem_system.js"),
                       ("diamond_shop","hansen_diamond_shop.js")]:
        if not ctx["systems"].get(key):
            add(WARN, "系统", "sys_%s" % key, "缺系统文件 %s" % fname)
    # --- 赛季钩子全岛 ---
    if ctx["systems"].get("season"):
        missing = [n for n in ctx["islands"] if "hansen_season.js" not in read("island_%s.html" % n)]
        if missing:
            add(ERROR, "赛季/一致性", "season_all_islands", "赛季脚本没接到这些岛: %s" % ", ".join(missing))
            setstat("J.season", "❌", "漏接: %s" % missing)
        else:
            add(INFO, "赛季/一致性", "season_all_islands", "赛季脚本已接入全部 %d 岛" % len(ctx["islands"]))
            setstat("J.season", "✅", "全 %d 岛接入" % len(ctx["islands"]))
    # --- 新增 6 组 ---
    check_mp3_buster()
    check_island_unification(ctx)
    check_orphan_files(ctx)
    check_boss_safety(ctx)
    check_save_load(ctx)
    check_package_size()
    check_currency_static(ctx)

# =============================================================================
#  C 真实浏览器 (playwright) —— 增强: 手机视口 + 横向溢出 + 赛季boss超屏
# =============================================================================
BROWSER_JS = r'''
const { chromium } = require("playwright");
const ISL = __ISL__;
const BASE = "http://localhost:__PORT__/";
const GARBLE = ["undefined","NaN","null","[object Object]"];
const SAELYA = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><image href="bosses/saelya.png" width="100" height="100" preserveAspectRatio="xMidYMid meet"/></svg>';
const ARENA = '<div class="screen active" style="display:block"><div id="bossContent"><div class="boss-arena">'
  +'<div class="boss-stats-bar"><div class="boss-combo">连击 <b>0</b></div><div class="boss-phase-tag">第 1 阶段</div></div>'
  +'<div class="boss-sprite-wrap"><div class="boss-sprite boss-float" id="__bs">'+SAELYA+'</div></div>'
  +'<div class="boss-name">星海女帝·赛尔娅</div>'
  +'<div class="boss-hp-bar"><div class="boss-hp-fill" style="width:100%"></div></div>'
  +'<div class="boss-hp-text">HP: 850 / 850</div><div class="boss-divider"></div>'
  +'<div class="boss-q-type">看中文选英文</div><div class="boss-question">勇敢的</div>'
  +'<div class="boss-opts"><div class="boss-opt">brave</div><div class="boss-opt">clever</div><div class="boss-opt">strong</div><div class="boss-opt">kind</div></div>'
  +'</div></div></div>';
(async () => {
  let out = [];
  let browser;
  try { browser = await chromium.launch(); }
  catch(e){ console.log(JSON.stringify({launch_error:String(e).split("\n")[0]})); process.exit(0); }
  for (const i of ISL) {
    const p = "island_"+i+".html";
    const ctx = await browser.newContext({viewport:{width:360,height:640}});
    const page = await ctx.newPage();
    const cerr=[], perr=[];
    page.on("console", m=>{ if(m.type()==="error") cerr.push(m.text()); });
    page.on("pageerror", e=>perr.push(String(e).split("\n")[0]));
    let nav=true;
    try { await page.goto(BASE+p,{waitUntil:"networkidle",timeout:45000}); }
    catch(e){ nav=false; perr.push("GOTO FAIL: "+String(e).split("\n")[0]); }
    await page.waitForTimeout(2000);
    const info = await page.evaluate((G)=>{
      const wm = window.WORD_MAP?Object.keys(window.WORD_MAP).length:-1;
      let redbar=false;
      document.querySelectorAll("div").forEach(d=>{const t=d.textContent||"";
        if(/版本|不一致|mismatch/i.test(t)&&/缓存|刷新|mismatch|不一致/i.test(t)) redbar=true;});
      const bt = (document.body?document.body.innerText:"")||"";
      const garb = G.filter(g=>bt.includes(g));
      const de = document.documentElement;
      const hscroll = de.scrollWidth > de.clientWidth + 1;
      return {wm, kids:document.body?document.body.children.length:0, redbar, garb, hscroll,
              sw:de.scrollWidth, cw:de.clientWidth};
    }, GARBLE);
    let bossfit = null;
    if (i === "season" && nav) {
      bossfit = await page.evaluate((html)=>{
        document.body.insertAdjacentHTML('afterbegin', html);
        const sp=document.getElementById('__bs').getBoundingClientRect();
        const ar=document.querySelector('.boss-arena').getBoundingClientRect();
        const de=document.documentElement;
        return {spriteW:Math.round(sp.width), spriteH:Math.round(sp.height),
                arenaH:Math.round(ar.height), vpH:window.innerHeight,
                hscroll: de.scrollWidth > de.clientWidth + 1};
      }, ARENA);
    }
    const real = cerr.filter(e=>!/favicon|autoplay|play\(\) failed|NotAllowedError/i.test(e));
    out.push({island:i, nav, wm:info.wm, kids:info.kids, redbar:info.redbar, garb:info.garb,
              hscroll:info.hscroll, sw:info.sw, cw:info.cw, bossfit:bossfit,
              perr:perr.slice(0,3), cerr:real.slice(0,3)});
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(out));
})();
'''

def free_port():
    s = socket.socket(); s.bind(("", 0)); p = s.getsockname()[1]; s.close(); return p

def layer_C_browser(ctx):
    print("\n[C] 真实浏览器 (playwright, 手机视口360x640)")
    try:
        subprocess.run(["node", "-e", "require.resolve('playwright')"], check=True, capture_output=True)
    except Exception:
        add(WARN, "浏览器", "no_playwright", "playwright 不可用, 跳过 C 层 (npm i playwright 后可启用)")
        for rid in ["A.crash","A.console","D.garble","F.redbar","H.hover","C.bosssz"]:
            setstat(rid, "⚠️", "playwright 不可用")
        return
    islands = ["animal","food","season"] if QUICK else ctx["islands"]
    PORT = free_port()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    js = BROWSER_JS.replace("__ISL__", json.dumps(islands)).replace("__PORT__", str(PORT))
    open("/tmp/_inspector_browser.js", "w", encoding="utf-8").write(js)
    try:
        r = subprocess.run(["node", "/tmp/_inspector_browser.js"], capture_output=True, text=True, timeout=900)
    finally:
        srv.terminate()
    line = (r.stdout or "").strip().splitlines()[-1] if r.stdout.strip() else "[]"
    try:
        data = json.loads(line)
    except Exception:
        add(ERROR, "浏览器", "browser_parse", "浏览器层输出无法解析: " + (r.stderr or "")[:200])
        return
    if isinstance(data, dict) and data.get("launch_error"):
        add(WARN, "浏览器", "launch_error", "chromium 启动失败, 跳过: " + data["launch_error"])
        return
    n_crash = n_console = n_garb = n_red = n_hover = 0
    for d in data:
        isl = d["island"]; w = "island_%s.html" % isl
        if not d["nav"]:
            add(ERROR, "崩溃", "nav_%s" % isl, "%s 加载失败(白屏/崩溃)" % w, " | ".join(d["perr"])); n_crash += 1; continue
        if d["kids"] == 0:
            add(ERROR, "崩溃", "blank_%s" % isl, "%s 渲染为空(白屏)" % w); n_crash += 1
        if d["wm"] != 154:
            add(ERROR, "数据", "wm_%s" % isl, "%s WORD_MAP=%d (期望154)" % (w, d["wm"]))
        if d["redbar"]:
            add(ERROR, "版本一致性", "redbar_%s" % isl, "%s 出现版本不一致红条" % w); n_red += 1
        if d["garb"]:
            add(WARN, "显示", "garble_%s" % isl, "%s 可见文本含乱码: %s" % (w, ", ".join(d["garb"]))); n_garb += 1
        if d["perr"]:
            add(ERROR, "报错", "perr_%s" % isl, "%s pageerror" % w, " | ".join(d["perr"])); n_console += 1
        if d["cerr"]:
            add(WARN, "报错", "cerr_%s" % isl, "%s console.error" % w, " | ".join(d["cerr"])); n_console += 1
        if d.get("hscroll"):
            add(WARN, "UI", "hover_%s" % isl, "%s 首页在360宽手机视口横向溢出(scrollW %s>视口 %s)" % (w, d.get("sw"), d.get("cw")),
                fix="找超宽元素(固定px宽/负margin/长不换行文本), 改成 max-width:100%/flex/换行"); n_hover += 1
        bf = d.get("bossfit")
        if bf:
            vfit = bf["arenaH"] <= bf["vpH"]
            if bf.get("hscroll") or not vfit:
                add(WARN, "Boss", "boss_overflow",
                    "赛季 boss 战斗界面在360视口: 精灵 %dx%d, 战斗区高 %d/屏高 %d%s%s" % (
                        bf["spriteW"], bf["spriteH"], bf["arenaH"], bf["vpH"],
                        " 横向溢出" if bf.get("hscroll") else "", "" if vfit else " 竖向超出需滚动"),
                    fix="若觉太大可把 island_season.html 的 .boss-arena .boss-sprite svg 宽高调小(如170)")
                setstat("C.bosssz", "⚠️", "精灵%dx%d 区高%d/屏%d" % (bf["spriteW"], bf["spriteH"], bf["arenaH"], bf["vpH"]))
            else:
                setstat("C.bosssz", "✅", "精灵%dx%d, 区高%d≤屏%d, 不超屏" % (bf["spriteW"], bf["spriteH"], bf["arenaH"], bf["vpH"]))
    okn = sum(1 for d in data if d["nav"] and d["kids"] and d["wm"] == 154 and not d["redbar"])
    print("    浏览器层: %d/%d 岛干净通过 | 横向溢出 %d 岛" % (okn, len(data), n_hover))
    setstat("A.crash",   "✅" if n_crash == 0 else "❌", "%d/%d 岛无崩溃" % (len(data)-n_crash, len(data)))
    setstat("A.console", "✅" if n_console == 0 else "❌", "无报错" if n_console == 0 else "%d 处报错" % n_console)
    setstat("D.garble",  "✅" if n_garb == 0 else "⚠️", "无乱码" if n_garb == 0 else "%d 岛有乱码" % n_garb)
    setstat("F.redbar",  "✅" if n_red == 0 else "❌", "无版本红条" if n_red == 0 else "%d 岛红条" % n_red)
    setstat("H.hover",   "✅" if n_hover == 0 else "⚠️", "%d/%d 岛无横向溢出" % (len(data)-n_hover, len(data)))

# =============================================================================
#  D AI 审查 (可选, 按清单逐条审逻辑)
# =============================================================================
AI_SYSTEM = (
    "你是单词大冒险H5游戏的资深QA与代码审计专家。我会给你游戏的逻辑核心源码, 请严格按下面这份"
    "《排查大纲》逐条审查, 只报你有把握的真实问题。只输出一个JSON对象, 不要任何解释或markdown。\n"
    "格式: {\"issues\":[{\"severity\":\"ERROR|WARN|INFO\",\"rubric\":\"对应大纲编号如B.coininv\","
    "\"where\":\"文件:行/函数\",\"title\":\"...\",\"why\":\"为什么是bug\",\"suggested_fix\":\"具体怎么改\"}],"
    "\"suggested_checks\":[\"建议新增的自动检查项, 一句话\"]}\n"
    "《排查大纲》:\n"
    "A.optcnt boss选项数<4是否越界(BUG#13禁硬编码%4); "
    "B.coininv 金币'显示额'是否==实际进钱包(合法变量仅_sessionCoins/coinReward); "
    "B.geminv 钻石显示==发放且spend余额不足返回false不扣; "
    "B.dup 任何结算/胜利是否可能触发两次重复发奖; "
    "B.spendret 抽卡/钻石商店是否先查余额再扣再发(防钱不够白送); "
    "D.edge 0分/平纪录(显追平非'还差0分')/破纪录/最后一题/满分 边界显示; "
    "J.signin 签到跨天重置/当天只领一次/显示==发放; "
    "J.empty 赛季空窗期加分抽卡不报错; "
    "K.frag 碎片兑换原子性/至尊不可换/换的是未拥有卡; "
    "O.day 跨天00:00边界(金币每日上限/签到/任务)是否正确。"
)

def layer_D_ai(ctx):
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        msg = ("AI 审查层未启用(没设 ANTHROPIC_API_KEY)。设了 key 后每次自动用 Claude 按大纲智能审逻辑并给修复建议。"
               "开启: pip install anthropic && export ANTHROPIC_API_KEY=sk-... 然后重跑。")
        if FORCE_AI: add(ERROR, "AI", "no_key", "--ai 要求 AI 层, 但未设 ANTHROPIC_API_KEY")
        else: add(INFO, "AI", "ai_skipped", msg)
        for rid in ["A.optcnt","B.coininv","B.geminv","B.dup","B.spendret","D.edge","J.empty","K.frag","O.day"]:
            cur = CHECK_STATUS.get(rid)
            if cur and cur[0] in ("✅", "❌", "⚠️"):   # 已被确定性静态守卫判定, 不用机器人盖掉
                continue
            setstat(rid, "🤖", "需 AI 层(设 key 后自动审)")
        return
    print("\n[D] AI 审查 (Claude, 按大纲逐条)")
    try:
        import anthropic
    except Exception:
        add(WARN, "AI", "no_sdk", "未装 anthropic SDK: pip install anthropic")
        return
    blob, budget = [], 140000
    for f in ctx["logic_files"]:
        code = read(f)
        if budget - len(code) < 0: code = code[:budget]
        blob.append("==== %s ====\n%s" % (f, code))
        budget -= len(code)
        if budget <= 0: break
    rule_findings = [f for f in FINDINGS if f["sev"] in (ERROR, WARN)]
    user_msg = ("以下是游戏逻辑核心源码, 请按系统提示的《排查大纲》逐条审查。\n\n"
                "规则层已发现(别重复):\n%s\n\n源码:\n%s"
                % (json.dumps(rule_findings, ensure_ascii=False)[:4000], "\n\n".join(blob)))
    try:
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model=os.environ.get("HANSEN_AI_MODEL", "claude-sonnet-4-6"),
            max_tokens=4000, system=AI_SYSTEM,
            messages=[{"role": "user", "content": user_msg}])
        txt = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        txt = re.sub(r"^```json|^```|```$", "", txt.strip(), flags=re.M).strip()
        parsed = json.loads(txt)
    except Exception as e:
        add(WARN, "AI", "ai_error", "AI 调用/解析失败: " + str(e)[:200]); return
    seen_rubric = {}
    for it in parsed.get("issues", []):
        sev = it.get("severity", WARN).upper(); sev = sev if sev in SEV_RANK else WARN
        rid = it.get("rubric", "")
        add(sev, "AI:" + rid, "ai_" + str(abs(hash(it.get("title", ""))) % 99999),
            "🤖 " + it.get("title", "") + " — " + it.get("why", ""),
            it.get("where", ""), it.get("suggested_fix", ""))
        if rid: seen_rubric[rid] = sev
    # 大纲项: AI 报了问题=❌, 没报=✅
    for rid in ["A.optcnt","B.coininv","B.geminv","B.dup","B.spendret","D.edge","J.empty","K.frag","O.day"]:
        setstat(rid, "❌" if seen_rubric.get(rid) in (ERROR, WARN) else "✅",
                "AI: %s" % ("发现问题" if rid in seen_rubric else "未发现问题"))
    for sc in parsed.get("suggested_checks", []):
        add(INFO, "AI:建议", "ai_suggest", "🤖 建议新增检查: " + sc)
    print("    AI 返回 %d 个问题 + %d 条建议" % (len(parsed.get("issues", [])), len(parsed.get("suggested_checks", []))))

# =============================================================================
#  清单体检表 + 报告 + 修复工单
# =============================================================================
def print_checklist():
    lines = ["", "=" * 64, "📋 《超详细清单》逐项体检表", "=" * 64]
    cur = None
    for rid, cat, title, kind in RUBRIC:
        if cat != cur:
            lines.append("── %s ──" % cat); cur = cat
        icon, detail = CHECK_STATUS.get(rid, (None, ""))
        if icon is None:
            icon = {"manual": "👁", "ai": "🤖", "static": "❔", "browser": "❔"}.get(kind, "❔")
            if kind == "manual": detail = "需真机眼检"
        line = "  %s [%s] %s" % (icon, rid, title)
        if detail: line += "  — %s" % detail
        lines.append(line)
    legend = "图例: ✅通过 ❌发现问题 ⚠️需关注/复核 👁需真机眼检 🤖需AI层(设key) ❔未运行该层"
    lines += ["", legend]
    out = "\n".join(lines)
    print(out)
    return out

def write_fix_worklist():
    items = [f for f in FINDINGS if f["sev"] in (ERROR, WARN) or f["fix"]]
    lines = ["# 单词大冒险 · 监察官修复工单",
             "> 时间: %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             "> 说明: 本工具不盲改游戏逻辑/UI(BUG#22教训)。下面是精确定位+修复建议, 逻辑/UI 类请评审后由你或 Claude 来改; 机械且可逆的(如缓存戳)可放心改。",
             ""]
    auto_safe = [f for f in items if f["cid"] in ("mp3_buster_inconsistent",)]
    needs_review = [f for f in items if f not in auto_safe]
    lines.append("## 🟢 可安全自动修复 (机械/可逆)")
    if auto_safe:
        for f in auto_safe:
            lines.append("- **[%s]** %s\n  - 位置: `%s`\n  - 修法: %s" % (f["cat"], f["msg"], f["where"] or "-", f["fix"] or "-"))
    else:
        lines.append("- (本次无)")
    lines.append("")
    lines.append("## 🟡 需评审后再改 (逻辑/UI/需判断)")
    if needs_review:
        for f in needs_review:
            sev = {"ERROR": "❌", "WARN": "⚠️", "INFO": "ℹ️"}[f["sev"]]
            lines.append("- %s **[%s]** %s" % (sev, f["cat"], f["msg"]))
            if f["where"]: lines.append("  - 位置: `%s`" % f["where"])
            if f["fix"]: lines.append("  - 建议: %s" % f["fix"])
    else:
        lines.append("- (本次无)")
    open("hansen_inspector_fixes.md", "w", encoding="utf-8").write("\n".join(lines))
    print("\n🔧 修复工单 -> hansen_inspector_fixes.md (可安全自动修 %d 项 / 需评审 %d 项)" % (len(auto_safe), len(needs_review)))

def write_report(ctx, started, checklist_text):
    FINDINGS.sort(key=lambda f: SEV_RANK.get(f["sev"], 9))
    n_err = sum(1 for f in FINDINGS if f["sev"] == ERROR)
    n_warn = sum(1 for f in FINDINGS if f["sev"] == WARN)
    elapsed = round(time.time() - started, 1)
    lines = ["# 单词大冒险 · 监察官报告 (v2)", "",
             "- 时间: %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             "- 版本(VERSION): %s" % (open("VERSION").read().strip() if os.path.exists("VERSION") else "?"),
             "- 自动发现: %d 岛, %d 个 js 模块, 系统 %s" %
             (len(ctx["islands"]), len(ctx["js_modules"]), ", ".join(k for k, v in ctx["systems"].items() if v))]
    if ctx["extra_islands"]:
        lines.append("- ⚠️ 发现未登记的新岛: %s" % ", ".join(ctx["extra_islands"]))
    lines.append("- 结论: **%s** (ERROR %d / WARN %d, 用时 %ss)" %
                 ("❌ 有阻断问题" if n_err else ("⚠️ 有待复查项" if n_warn else "✅ 全部通过"), n_err, n_warn, elapsed))
    lines.append("")
    for sev in (ERROR, WARN, INFO):
        its = [f for f in FINDINGS if f["sev"] == sev]
        if not its: continue
        icon = {"ERROR": "❌", "WARN": "⚠️", "INFO": "ℹ️"}[sev]
        lines.append("## %s %s (%d)" % (icon, sev, len(its)))
        for f in its:
            w = ("  —  `%s`" % f["where"]) if f["where"] else ""
            fx = ("  \n  - 修复建议: %s" % f["fix"]) if f["fix"] else ""
            lines.append("- **[%s]** %s%s%s" % (f["cat"], f["msg"], w, fx))
        lines.append("")
    lines.append(checklist_text.replace("=" * 64, "").strip())
    open("hansen_inspector_report.md", "w", encoding="utf-8").write("\n".join(lines))
    print("\n" + "=" * 64)
    print("监察官结论: %s   (ERROR %d / WARN %d, %ss)" %
          ("❌ 有阻断问题" if n_err else ("⚠️ 有待复查" if n_warn else "✅ 全部通过"), n_err, n_warn, elapsed))
    print("详细报告 -> hansen_inspector_report.md")
    print("=" * 64)
    return n_err

# =============================================================================
#  ★ 每日签到"跨岛只领一次"检查 (v411 修复的重大 bug 的回归把关, 每次启动监察官必查)
#  bug: 金币是全局钱包, 但原版"今天已领"S.chestDay/连签 S.streak 各岛各存 → 每岛各领一次都进
#       总钱包(打开N个岛领N次)。修复=全局签到模块 hansen_checkin_global.js(包装 openChest/
#       doOpenChest 用 HansenCheckin.claimedToday() 闸门 + 连签全局化) + 堵 addiction 宝箱稀有度
#       的第二条发币路径。下面静态确认修复在位 + 行为确认跨岛只领一次。
# =============================================================================
def check_checkin_wire(ctx):
    """静态: 确认签到修复仍在位 (防被删/改坏)。"""
    ok = True
    if not os.path.exists("hansen_checkin_global.js"):
        add(ERROR, "签到", "ci_nomodule", "缺少全局签到模块 hansen_checkin_global.js —— 每日签到跨岛重复发币 bug 会复活!",
            where="项目根", fix="恢复 hansen_checkin_global.js 并在 19 岛 </body> 前引用")
        ok = False
    else:
        m = read("hansen_checkin_global.js")
        if ("HansenCheckin" not in m) or ("claimedToday" not in m) or ("doOpenChest" not in m):
            add(ERROR, "签到", "ci_modulebad", "hansen_checkin_global.js 未定义 HansenCheckin/claimedToday 或未包装 doOpenChest",
                where="hansen_checkin_global.js")
            ok = False
    no_ref = [os.path.basename(f) for f in glob.glob("island_*.html") if "hansen_checkin_global.js" not in read(f)]
    if no_ref:
        add(ERROR, "签到", "ci_noref", "这些岛未引用全局签到模块: " + ", ".join(no_ref),
            where=",".join(no_ref), fix='在各岛 </body> 前加 <script src="hansen_checkin_global.js?v=NNN">')
        ok = False
    if os.path.exists("hansen_addiction.js"):
        a = read("hansen_addiction.js")
        if ("HansenCheckin" not in a) or ("claimedToday" not in a):
            add(ERROR, "签到", "ci_noaddguard", "hansen_addiction.js 宝箱稀有度未加 HansenCheckin.claimedToday 闸门 —— 第二条发币路径会漏!",
                where="hansen_addiction.js patchChest", fix="在其 doOpenChest 包装顶部加 if(HansenCheckin&&HansenCheckin.claimedToday())return")
            ok = False
    setstat("J.signw", "✅" if ok else "❌", "模块+19岛引用+addiction闸门在位" if ok else "修复缺失/被改坏!")
    return ok

def check_checkin_behavior(ctx):
    """browser: 领1岛 → 其余岛逐个再领, 金币增量必须全=0 (跨岛重复发币回归测试)。"""
    if NO_BROWSER:
        setstat("J.signin", "❔", "--no-browser 跳过"); return
    try:
        subprocess.run(["node", "-e", "require.resolve('playwright')"], check=True, capture_output=True)
    except Exception:
        setstat("J.signin", "⚠️", "playwright 不可用, 跳过行为测试"); return
    first = "animal"
    _ALL = ["animal","food","sports","job","color","nature","traffic","action","body",
            "city","clothes","adjective","home","family","school","time","question","treasure","season"]
    # ★重大bug: 以前只验 food/color/job, 漏了其他岛(所以"通过"但 bug 仍在)。现在领1岛→其余【全部18岛】
    # 逐个验, 必须全 Δ=0 且【不可点开】。--quick 也覆盖含曾漏测的 school/treasure。
    others = ["food", "color", "school", "treasure"] if QUICK else [i for i in _ALL if i != first]
    print("\n[★] 每日宝箱跨岛只领一次 行为测试 (领 %s → 验其余 %d 岛, 必须全 Δ=0 且不可点开)" % (first, len(others)))
    PORT = free_port()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    script = r'''
const { chromium } = require("playwright");
const BASE = "http://localhost:%d/";
const FIRST = "island_%s.html";
const OTHERS = %s;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  async function coins(){ return await page.evaluate(()=> window.HansenCoins?HansenCoins.get():null); }
  async function tryClaim(){ await page.evaluate(()=>{ try{openChest();}catch(e){} try{doOpenChest();}catch(e){} }); await page.waitForTimeout(1200); }
  await page.goto(BASE+FIRST,{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(1200);
  const hasM = await page.evaluate(()=> typeof window.HansenCheckin==='object');
  if(!hasM){ console.log("RESULT|nomodule"); await browser.close(); process.exit(0); }
  const b0=await coins(); await tryClaim(); const a0=await coins();
  const fr=(a0!=null&&b0!=null)?(a0-b0):-1;
  const c0=await page.evaluate(()=> HansenCheckin.claimedToday());
  const s0=await page.evaluate(()=> HansenCheckin.getStreak());
  let leaks=[];
  for(const o of OTHERS){
    await page.goto(BASE+"island_"+o+".html",{waitUntil:"networkidle",timeout:30000}); await page.waitForTimeout(900);
    const b=await coins();
    await page.evaluate(()=>{ try{openChest();}catch(e){} }); await page.waitForTimeout(180);
    const box = await page.evaluate(()=> !!document.getElementById('chestBox'));
    await page.evaluate(()=>{ try{ if(typeof doOpenChest==='function') doOpenChest(); }catch(e){} }); await page.waitForTimeout(1200);
    const a=await coins();
    if(a-b!==0) leaks.push(o+":+"+(a-b));
    else if(box) leaks.push(o+":可点开");
  }
  await browser.close();
  console.log("RESULT|"+fr+"|"+c0+"|"+s0+"|"+(leaks.join(",")||"none"));
  process.exit(0);
})();
''' % (PORT, first, str(others))
    with open("/tmp/_insp_checkin.js", "w") as f:
        f.write(script)
    r = subprocess.run(["node", "/tmp/_insp_checkin.js"], capture_output=True, text=True)
    srv.terminate()
    line = ""
    for ln in r.stdout.splitlines():
        if ln.startswith("RESULT|"): line = ln
    if not line:
        setstat("J.signin", "⚠️", "行为测试无输出")
        add(WARN, "签到", "ci_norun", "签到行为测试未拿到结果", where="hansen_inspector")
        return
    parts = line.split("|")
    if parts[1] == "nomodule":
        setstat("J.signin", "❌", "运行时签到模块未加载")
        add(ERROR, "签到", "ci_runtime_nomodule", "运行时 HansenCheckin 模块未加载")
        return
    fr, c0, s0, leaks = parts[1], parts[2], parts[3], parts[4]
    leaked = (leaks not in ("none", ""))
    print("    首领=%s claimedToday=%s 连签=%s 其余岛泄漏=%s" % (fr, c0, s0, leaks if leaked else "无(全Δ=0)"))
    if leaked or c0 != "true" or fr in ("-1", "0"):
        setstat("J.signin", "❌", "首领%s 泄漏=%s" % (fr, leaks))
        add(ERROR, "签到", "ci_dup", "每日签到跨岛重复发币 bug 复活! 领1岛后其余岛仍发币: " + leaks,
            where="doOpenChest 两条路径", fix="确认 hansen_checkin_global.js + addiction 的 HansenCheckin.claimedToday() 闸门都在")
    else:
        setstat("J.signin", "✅", "领1岛=%s 其余岛Δ=0 连签统一=%s" % (fr, s0))

def check_season_isolation_behavior(ctx):
    """browser: 其余【全部18岛】答对题/打boss → 赛季积分Δ必须全=0; 仅赛季岛 island_season.html 累加 (v441修复的重大bug回归)。"""
    if NO_BROWSER:
        setstat("J.seasoniso", "❔", "--no-browser 跳过"); return
    try:
        subprocess.run(["node", "-e", "require.resolve('playwright')"], check=True, capture_output=True)
    except Exception:
        setstat("J.seasoniso", "⚠️", "playwright 不可用, 跳过行为测试"); return
    _ALL = ["animal","food","sports","job","color","nature","traffic","action","body",
            "city","clothes","adjective","home","family","school","time","question","treasure"]
    # ★教训同签到: 必须验【全部18岛】, 不可只抽查几个。--quick 取代表(含曾漏测的 school/treasure)。
    others = ["animal","food","school","treasure"] if QUICK else _ALL
    print("\n[★] 赛季积分隔离 行为测试 (其余%d岛答对题/打boss → 赛季积分必须全Δ=0; 赛季岛 island_season 答题须Δ>0)" % len(others))
    PORT = free_port()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    script = r'''
const { chromium } = require("playwright");
const BASE = "http://localhost:%d/";
const OTHERS = %s;
(async () => {
  const browser = await chromium.launch();
  async function pts(page){ return await page.evaluate(()=> window.HansenSeason?HansenSeason.getPoints():null); }
  async function answer5(page){ await page.evaluate(()=>{ for(var i=0;i<5;i++){ try{window.markAnswer(i,true);}catch(e){} } }); await page.waitForTimeout(180); }
  let leaks=[]; let nomodule=false;
  for(const o of OTHERS){
    const c = await browser.newContext(); const page = await c.newPage();
    await page.goto(BASE+"island_"+o+".html",{waitUntil:"networkidle",timeout:30000}); await page.waitForTimeout(1200);
    const has = await page.evaluate(()=> typeof window.HansenSeason==='object' && typeof window.markAnswer==='function');
    if(!has){ nomodule=true; await c.close(); continue; }
    const b=await pts(page); await answer5(page);
    await page.evaluate(()=>{ try{ if(typeof window.bossVictory==='function') window.bossVictory(); }catch(e){} }); await page.waitForTimeout(150);
    const a=await pts(page);
    if(b!=null && a!=null && a-b!==0) leaks.push(o+":+"+(a-b));
    await c.close();
  }
  let seasonDelta="na";
  { const c=await browser.newContext(); const page=await c.newPage();
    await page.goto(BASE+"island_season.html",{waitUntil:"networkidle",timeout:30000}); await page.waitForTimeout(1200);
    const has = await page.evaluate(()=> typeof window.HansenSeason==='object' && typeof window.markAnswer==='function');
    if(has){ const b=await pts(page); await answer5(page); const a=await pts(page); seasonDelta=(b!=null&&a!=null)?String(a-b):"null"; }
    await c.close();
  }
  await browser.close();
  console.log("RESULT|"+(nomodule?"nomodule":"ok")+"|"+(leaks.join(",")||"none")+"|"+seasonDelta);
  process.exit(0);
})();
''' % (PORT, str(others))
    with open("/tmp/_insp_seasoniso.js", "w") as f:
        f.write(script)
    r = subprocess.run(["node", "/tmp/_insp_seasoniso.js"], capture_output=True, text=True, timeout=900)
    srv.terminate()
    line = ""
    for ln in r.stdout.splitlines():
        if ln.startswith("RESULT|"): line = ln
    if not line:
        setstat("J.seasoniso", "⚠️", "行为测试无输出")
        add(WARN, "赛季", "siso_norun", "赛季隔离行为测试未拿到结果", where="hansen_inspector"); return
    parts = line.split("|")
    leaks = parts[2]; seasonDelta = parts[3] if len(parts) > 3 else "na"
    leaked = (leaks not in ("none", ""))
    print("    其余岛喂赛季泄漏=%s | 赛季岛答5题Δ=%s" % (leaks if leaked else "无(全Δ=0)", seasonDelta))
    if leaked:
        setstat("J.seasoniso", "❌", "其余岛仍喂赛季: %s" % leaks)
        add(ERROR, "赛季", "siso_leak",
            "★赛季积分隔离失效! 其余岛答对题/打boss 仍在喂赛季 boss 进度: " + leaks + " —— 18岛答题又在替赛季boss答题, 重大bug复活!",
            where="hansen_season.js hookScoreEvents", fix="markAnswer/bossVictory 埋点必须加 isSeasonIsland() 闸门, 只在 island_season.html 累加")
    else:
        try: sd = int(seasonDelta)
        except Exception: sd = None
        if sd is not None and sd <= 0:
            setstat("J.seasoniso", "⚠️", "其余%d岛全Δ=0✅ 但赛季岛答题Δ=%s(应>0, 请核查是否过度隔离)" % (len(others), seasonDelta))
            add(WARN, "赛季", "siso_overgate", "赛季岛答题未加分(Δ=%s), 可能过度隔离" % seasonDelta, where="hansen_season.js isSeasonIsland")
        else:
            setstat("J.seasoniso", "✅", "其余%d岛答题/打boss全Δ=0, 赛季岛答5题Δ=%s(仅赛季岛累加, 隔离正确)" % (len(others), seasonDelta))

# =============================================================================
#  主流程
# =============================================================================
def main():
    started = time.time()
    print("=" * 64)
    print("单词大冒险 · 自进化 AI 监察官 v3  (%s%s)" %
          ("GATE闸门" if GATE else ("QUICK" if QUICK else "全量体检"), " +修复工单" if FIX else ""))
    print("=" * 64)
    ctx = discover()
    print("① 自动发现: %d 岛%s | %d js | 系统: %s | 逻辑核心 %d 文件" % (
        len(ctx["islands"]),
        (" (+新岛 %s)" % ",".join(ctx["extra_islands"]) if ctx["extra_islands"] else ""),
        len(ctx["js_modules"]), ",".join(k for k, v in ctx["systems"].items() if v), len(ctx["logic_files"])))
    layer_A_check_resources()
    layer_B_static(ctx)
    check_checkin_wire(ctx)          # ★ 每日签到修复在位 (静态, J.signw)
    if not NO_BROWSER:
        layer_C_browser(ctx)
    else:
        for rid in ["A.crash","A.console","D.garble","F.redbar","H.hover","C.bosssz"]:
            setstat(rid, "❔", "--no-browser 跳过")
    check_checkin_behavior(ctx)      # ★ 每日签到跨岛只领一次 (行为, J.signin; NO_BROWSER 内部设❔)
    check_season_isolation_behavior(ctx)  # ★ 赛季积分隔离: 仅赛季岛累加 (行为, J.seasoniso; NO_BROWSER 内部设❔)
    layer_D_ai(ctx)
    checklist_text = print_checklist()
    n_err = write_report(ctx, started, checklist_text)
    if FIX:
        write_fix_worklist()
    sys.exit(1 if n_err else 0)

if __name__ == "__main__":
    main()
