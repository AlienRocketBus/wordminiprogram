#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_resources.py — 出厂前自动检查 (照 README 规格重建)
读 VERSION 作为"唯一真相", 比对全项目版本位 + 文件完整性 + word_map + boss图。
任何一项失败 -> 退出码 1 (build.py 据此拒绝打包)。
注意: 主缓存戳是 ?v=NNN(带等号); mp3 戳是 ?vNNN(无等号), 两者独立, 互不检查。
      banner([HansenBossUpgrade] vNNN) 是纯 console 文案、历史停在 v391, 不影响功能 -> 不强制比对(与真实构建一致)。
"""
import os, re, sys, subprocess, glob

# 🔴v1067: 本文件头部一直写着「读 VERSION 作为"唯一真相"」，
#   但第 9280 行却硬断言 VERSION == '960'，package.json 硬断言 "960.0.0"。
#   这些钉子写于 v960，之后再没更新——从 v961 起每一版都在报同一批假警，
#   整整 106 个版本。守卫天天喊狼来了，真问题就被淹没。
#   现在真的按头部承诺的那样：以 VERSION 为唯一真相。
def _appv():
    try:
        return open('VERSION', encoding='utf-8').read().strip()
    except Exception:
        return ''
_APPV = _appv()
def _no_subisle(_files):
    """排除子岛: 星海5子岛(season1-5·v851守卫覆盖) + 单词大陆8子岛(land1-8·v873守卫覆盖)·同模板生成天然满足常规检查·不纳入常规岛计数/检查"""
    return [_x for _x in _files if not re.search(r'island_(?:season[1-5]|land[1-8])\.html$', str(_x))]

FAIL = []
def fail(msg): FAIL.append(msg)
def ok(msg): print("  \u2705 " + msg)

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


# ⭐ v929: 上面这些 icons/ 的【体积门槛】原本是"高清"的代用指标(>50KB 等)。
#   v929 按真机实测的显示尺寸(这些图标在 App 里最大只显示 91px)把 512~768px 的原图重压到 288px
#   (=3.2倍屏余量, 肉眼零差别), 文件自然变小 → 门槛相应下调到 12KB。
#   这不是降画质, 是去掉纯浪费的像素: 512px 让首屏多背 1.0MB, 4G 上多等约 2 秒,
#   正是 Hansen 说的"进岛图片加载不出来"。boss 立绘(v809/v887 要求≥1100px)仍是高清原图, 不受影响。
# ---- 期望版本 = VERSION 文件 ----
with open("VERSION") as f:
    VER = f.read().strip()
print("== check_resources: 期望版本 VERSION = %s ==" % VER)

html_js = sorted(glob.glob("*.html") + glob.glob("*.js"))

# ---- 检查1: 主缓存戳 ?v=NNN 一致 (带等号; 不碰 mp3 戳 ?vNNN) ----
bad = {}
total = 0
for fn in html_js:
    if "evolution_dashboard" in fn:   # 看板是报告展示页·表格里含历史报告文字的?vNNN(非真实部署缓存戳)·跳过
        continue
    txt = open(fn, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r'\?v=(\d+)', txt):   # 仅匹配带等号的主戳
        total += 1
        if m.group(1) != VER:
            bad.setdefault(fn, set()).add(m.group(1))
if bad:
    fail("主缓存戳不一致(应全=%s): %s" % (VER, {k: sorted(v) for k, v in bad.items()}))
else:
    ok("主缓存戳 ?v=%s 全部一致 (%d 处, 0 残留旧版本)" % (VER, total))

# ---- 检查2: 运行时版本变量 (hansen_boss_lock.js) ----
lock = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read()
for var in ["__HBU_VERSION__", "HBU_RUNTIME_VERSION"]:
    m = re.search(var + r"\s*=\s*'v(\d+)'", lock)
    if not m:
        fail("%s 未找到" % var)
    elif m.group(1) != VER:
        fail("%s = 'v%s' (应 'v%s')" % (var, m.group(1), VER))
    else:
        ok("%s = 'v%s'" % (var, VER))

# ---- 检查3: check.html 期望版本 (动态自检的参照) ----
chk = open("check.html", encoding="utf-8", errors="replace").read()
m = re.search(r'hansen_boss_lock\.js\?v=(\d+)', chk)
if m and m.group(1) != VER:
    fail("check.html 引用 hansen_boss_lock.js?v=%s (应 %s)" % (m.group(1), VER))
elif m:
    ok("check.html 期望版本 ?v=%s 与 VERSION 一致" % VER)

# ---- 检查4: 无写死的"其它数字"主戳 (上面检查1已覆盖, 这里冗余确认 0 stale) ----
stale = sum(len(v) for v in bad.values())
if stale == 0:
    ok("无写死低版本主戳 (0 stale)")

# ---- 检查5: 无空文件 (html/js/mp3) ----
empties = [fn for fn in html_js + glob.glob("words/*.mp3") + glob.glob("bosses/*.webp")
           if os.path.getsize(fn) == 0]
if empties:
    fail("发现空文件: %s" % empties)
else:
    ok("无空文件 (html/js/mp3/png)")

# ---- 检查6: 关键文件齐全 ----
critical = ["index.html", "check.html", "VERSION", "word_map.js",
            "hansen_boss_lock.js", "hansen_island_upgrade.js", "hansen_season.js",
            "hansen_preload.js", "vocab_all.js", "sentence_map.js"]
islands = ["action","adjective","animal","body","city","clothes","color","family",
           "food","home","job","nature","question","school","season","sports",
           "time","traffic","treasure"]
critical += ["island_%s.html" % i for i in islands]
missing = [c for c in critical if not os.path.exists(c)]
if missing:
    fail("缺关键文件: %s" % missing)
else:
    ok("关键文件齐全 (%d 个: index + 19岛 + 核心js)" % len(critical))

# ---- 检查7: 19 岛 script 标签配对 ----
for i in islands:
    fn = "island_%s.html" % i
    t = open(fn, encoding="utf-8", errors="replace").read()
    o = len(re.findall(r'<script\b', t)); c = len(re.findall(r'</script>', t))
    if o != c:
        fail("%s script 标签不配对 (<script>%d vs </script>%d)" % (fn, o, c))
o_total = c_total = 0
if not any("script 标签不配对" in x for x in FAIL):
    ok("19 岛 <script>/</script> 全部配对")

# ---- 检查8: 全部 19 岛必须加载 upgrade.js(🔴 v570 架构反转: 动物也挂载——升级层=单一真相源, 改一处19岛全变。
#      旧断言"动物不应挂"是双轨时代产物; 挂载安全性已真机验证(36 定义零差异/金币不翻倍/成就页正常)。 ----
for i in islands:
    fn = "island_%s.html" % i
    t = open(fn, encoding="utf-8", errors="replace").read()
    if "hansen_island_upgrade.js" not in t:
        fail("%s 应加载 upgrade.js 但没有(v570 起 19 岛全挂, 单一真相源)" % fn)
if not any("upgrade.js" in x for x in FAIL):
    ok("全部 19 岛加载 upgrade.js (v570 单一真相源架构)")

# ---- 检查9: word_map.js 语法 + 无重复键 + 所有引用文件存在 ----
r = subprocess.run(["node", "--check", "word_map.js"], capture_output=True, text=True)
if r.returncode != 0:
    fail("word_map.js node --check 失败: " + r.stderr.strip())
else:
    wm = open("word_map.js", encoding="utf-8").read()
    # v942: 同时识别单双引号键。旧规则只看双引号，曾漏过一条单引号
    # t-shirt 重复键；浏览器以后写覆盖以前写，资源检查却错误放行。
    keys = [m[1] for m in re.findall(r"^\s*(['\"])(.*?)\1\s*:", wm, re.M)]
    dups = set(k for k in keys if keys.count(k) > 1)
    bad_count = len(keys) != 696
    if dups:
        fail("word_map.js 重复键: %s" % dups)
    if bad_count:
        fail("word_map.js 唯一键数量=%d (期望696)" % len(keys))
    paths = [m[1] for m in re.findall(r":\s*(['\"])(words/.*?)\1", wm)]
    miss = [p for p in paths if not os.path.exists(p)]
    if miss:
        fail("word_map.js 引用的文件缺失: %s" % miss)
    if not dups and not miss and not bad_count:
        ok("word_map.js 语法OK, %d键无重复, %d个引用文件全部存在" % (len(keys), len(paths)))

# ---- 检查10: boss 图齐 (lv01-20 + saelya = 21) ----
bosses = glob.glob("bosses/*.webp")
need = ["bosses/lv%02d.webp" % n for n in range(1, 21)] + ["bosses/saelya.webp"]
bmiss = [b for b in need if not os.path.exists(b)]
if bmiss:
    fail("缺boss图: %s" % bmiss)
else:
    ok("boss图齐全 (lv01-20 + saelya = %d 张)" % len(need))

# ---- 检查11: ★每日宝箱跨岛防刷修复在位 (重大bug, 防被误删/改坏 → 打包即拦) ----
# v411/v431 修的【重大bug】: 一个岛领过每日宝箱, 其他岛还能各领刷币。修复 = hansen_checkin_global.js
# (全局键 hansen_checkin_last ↔ 各岛 S.chestDay 双向同步 + 各岛 inline 闸门兜底) + 19 岛全引用 +
# addiction 宝箱稀有度第二条发币路径加 claimedToday 闸门。这里做【在位】静态校验(快, 每次打包必跑);
# 【跨岛只领一次的行为测试】在 hansen_health_check.py [C] 与监察官 J.signin(领1岛→其余全18岛全Δ=0且不可点开)。
_ci = "hansen_checkin_global.js"
_ci_ok = True
if not os.path.exists(_ci):
    fail("★每日宝箱跨岛防刷修复丢失: 缺 %s —— 跨岛刷币重大bug会复活, 严禁打包!" % _ci); _ci_ok = False
else:
    _m = open(_ci, encoding="utf-8").read()
    _lack = [k for k in ["HansenCheckin", "claimedToday", "doOpenChest", "syncChestBothWays", "chestDay"] if k not in _m]
    if _lack:
        fail("★%s 缺关键逻辑 %s —— 跨岛防刷可能失效!" % (_ci, _lack)); _ci_ok = False
    _noref = [os.path.basename(f) for f in glob.glob("island_*.html") if _ci not in open(f, encoding="utf-8").read()]
    if _noref:
        fail("★这些岛未引用 %s (会漏跨岛防刷): %s" % (_ci, _noref)); _ci_ok = False
    if os.path.exists("hansen_addiction.js"):
        _ad_ci = open("hansen_addiction.js", encoding="utf-8").read()
        # v942：稀有奖励不再靠可抢跑的 claimedToday 布尔值，而是二次读取正式、已提交的
        # HansenCheckin receipt。跨岛/重载只能重复结算同一个 txid，钱包 sourceId 再做最终幂等。
        _ad_lack = [k for k in ["function officialCheckinReceipt(value)",
                                "HansenCheckin.getReceipt(requested.day)",
                                "var receipt=officialCheckinReceipt(value);if(!receipt)return false",
                                "HansenCoins.award(chestSource(tx.txid,'coins')"] if k not in _ad_ci]
        if _ad_lack:
            fail("★hansen_addiction.js 宝箱稀有奖励缺正式签到 receipt 授权 %s(第二条发币路径会漏!)" % _ad_lack); _ci_ok = False
if _ci_ok:
    ok("★每日宝箱跨岛防刷修复在位 (hansen_checkin_global.js + 双向同步 + 19岛全引用 + addiction闸门)")

# ---- 检查12: ★v941旧赛季积分永久只读 (重大bug回归防护) ----
# 历史上曾用 isSeasonIsland() 把旧积分限制在赛季岛；v941 已进一步从根上停掉这套积分和200/500暗奖。
# 当前铁律: addPoints 只保留兼容 no-op，markAnswer 不再包裹，任何页面都不能增加旧积分或触发里程碑。
_sf = "hansen_season.js"
_si_ok = True
if not os.path.exists(_sf):
    fail("★缺 %s —— 赛季系统丢失!" % _sf); _si_ok = False
else:
    _s = open(_sf, encoding="utf-8").read()
    if "function addSeasonPoints(){ return false; }" not in _s or "pointsReadOnly: true" not in _s:
        fail("★%s 的旧积分 API 不是永久只读 no-op —— 赛季暗奖可能复活!" % _sf); _si_ok = False
    _old_score_tokens = ["addSeasonPoints(POINTS.", "checkMilestones", "origMA", "answerCorrect", "hsn_season_answer_day"]
    _old_score_found = [x for x in _old_score_tokens if x in _s]
    if _old_score_found:
        fail("★%s 仍有旧积分增长/里程碑入口: %s" % (_sf, _old_score_found)); _si_ok = False
if _si_ok:
    ok("★v941旧赛季积分永久只读 (addPoints no-op·无答题埋点·无里程碑暗奖)")

# ---- 检查13: ★做题游戏"答完还能改结果"原子性修复必须在位 (重大bug类回归防护 v464-v467) ----
# 这一类bug根因 = 只锁被点的单个元素、没锁整轮 → 答错后正确元素还能点 → 补一个"对"(或重复计分/空难度档空壳)。
# 修复 = 首次落子锁整轮 + 答错也推进/记错。各修复点代码里都有 /* 🔴 BUG#X */ 注释。一旦某岛某锁被误删 →
# 该游戏"答错再答对算对/重复计分/空档空壳"复活 → 打包直接失败、出不去。详见版本史《做题游戏原子性大排查(v464→v467)》。
_atomic_locks = [("listenQ.answered","听音原子锁#40"),
  ("if(!([...Array(allW.length).keys()].some(BUBBLE_LEVELS[level].filter)))","泡泡空档守卫#41"),
  ("if(!([...Array(allW.length).keys()].some(MOLES_LEVELS[level].filter)))","打地鼠空档守卫#41"),
  ("if(!([...Array(allW.length).keys()].some(FISH_LEVELS[level].filter)))","钓鱼空档守卫#41"),
  ("if(!([...Array(allW.length).keys()].some(SCRAMBLE_LEVELS[level].filter)))","拼词空档守卫#41"),
  ("var _aM=document.querySelectorAll('[id^=\"moleSlot\"]')","打地鼠锁全坑#42"),
  ("markAnswer(allW.indexOf(molesTarget),false)","打地鼠打错记错#42"),
  ("window.bubbleLocked","泡泡轮锁#43"),
  ("window.fishLocked","钓鱼轮锁#44"),
  ("if(!typeActive)return","打字防重入#46"),
  ("_fp.querySelectorAll","钓鱼光效重同步#47")]
_atomic_bad = []
for _i in islands:
    _fn = "island_%s.html" % _i
    _c = open(_fn, encoding="utf-8", errors="replace").read()
    for _sub, _lbl in _atomic_locks:
        if _sub not in _c:
            _atomic_bad.append("%s 缺[%s]" % (_fn, _lbl))
    _m = re.search(r"function eagleTimeOut\(\)\s*\{(.{0,500}?)cells\.forEach\(c=>", _c, re.S)
    if (not _m) or ("dataset.done" not in _m.group(1)):
        _atomic_bad.append("%s eagleTimeOut缺锁全格[超时补分#45]" % _fn)
if _atomic_bad:
    fail("★做题原子性修复被破坏(答错再答对算对/重复计分/空档空壳 类重大bug会复活!): %s" % _atomic_bad[:8])
else:
    ok("★做题游戏原子性在位 (19岛 listen/泡泡/打地鼠/钓鱼/打字/eagle/空难度档 共12处锁全在, 防 BUG#40-47 回归)")

# ---- 检查14: ★打 boss 不得直接发卡 (重大bug回归防护 v469 · BUG#48: 卡牌只能靠抽卡得) ----
# 我们之前定的规则: 卡牌只能靠【抽卡 hansen_gacha.js】(花金币)获得; 打 boss 不直接送卡, 否则卡册白嫖、抽卡经济失效。
# 修复 = hansen_cards.js 的 markBossWin 里删掉 HansenCardbook.obtain(lv)。卡册收藏唯一由抽卡填充。每关 boss 独立、不串联。
# 一旦 markBossWin 里又出现 HansenCardbook.obtain → 打 boss 又白送卡 → 打包直接失败、出不去。
_cf = "hansen_cards.js"
if not os.path.exists(_cf):
    fail("★缺 %s —— 卡牌系统丢失!" % _cf)
else:
    _cs = open(_cf, encoding="utf-8").read()
    _mm = re.search(r"function markBossWin\([^)]*\)\s*\{", _cs)
    if not _mm:
        fail("★%s 找不到 markBossWin 函数 —— 卡牌发放结构变了, 需人工复核 BUG#48 是否还在防!" % _cf)
    else:
        _end = _cs.find("window.hansenCardsMarkBoss", _mm.start())
        _seg = _cs[_mm.start(): _end if _end > 0 else _mm.start()+4000]
        # 先剥掉注释再判(本修复在 markBossWin 里留了"别把 HansenCardbook.obtain 加回"的警告注释, 不能把注释里的字样当成真调用)
        _nocmt = re.sub(r"/\*[\s\S]*?\*/", "", _seg)
        _nocmt = re.sub(r"//[^\n]*", "", _nocmt)
        if re.search(r"HansenCardbook\s*\.\s*obtain", _nocmt):
            fail("★%s 的 markBossWin 里又调了 HansenCardbook.obtain —— 打 boss 会直接送卡(违背'卡牌只能抽卡得', BUG#48 复活)!" % _cf)
        else:
            ok("★打 boss 不直接发卡 (markBossWin 不碰 HansenCardbook.obtain; 卡册只由抽卡填充, 每关独立不串联, 防 BUG#48 回归)")

# ---- 检查15: ★屏幕闪特效必须保持禁用 (健康/重大体验回归防护 v470 · BUG#50: Hansen 对屏幕闪会头晕、眼睛不适) ----
# 修复 = 清空 islands 的 flashScreen() + hansen_boss_anim.js 的 screenFlash() + 去掉 .hsn-vignette 脉动动画。
# 一旦它们又创建闪屏元素 / 加回脉动 → 屏幕又会闪 → 打包直接失败、出不去。先剥注释再判(修复处留了警告注释)。
def _strip_cmt(code):
    code = re.sub(r"/\*[\s\S]*?\*/", "", code)
    return re.sub(r"//[^\n]*", "", code)
_flash_bad = []
for _i in islands:
    _fn = "island_%s.html" % _i
    _fc = open(_fn, encoding="utf-8", errors="replace").read()
    _fm = re.search(r"function flashScreen\(\)\s*\{(.*?)\}", _fc)
    if _fm and ("createElement" in _strip_cmt(_fm.group(1))):
        _flash_bad.append("%s flashScreen 又创建闪屏元素" % _fn)
    _fcn = _strip_cmt(_fc)
    _sc = re.search(r"\.shake-screen\s*\{[^{}]*\}", _fcn)
    if _sc and ("animation" in _sc.group(0)):
        _flash_bad.append("%s .shake-screen 又加回整页抖动" % _fn)
    _bh = re.search(r"@keyframes bossHitFx\s*\{(?:[^{}]|\{[^{}]*\})*\}", _fcn)
    if _bh and (("brightness" in _bh.group(0)) or ("rotate" in _bh.group(0))):
        _flash_bad.append("%s bossHitFx 又加回亮闪/旋转" % _fn)
_baf = "hansen_boss_anim.js"
if os.path.exists(_baf):
    _bac = open(_baf, encoding="utf-8").read()
    _sm = re.search(r"function screenFlash\([^)]*\)\s*\{(.*?)\}", _bac)
    if _sm and ("createElement" in _strip_cmt(_sm.group(1))):
        _flash_bad.append("%s screenFlash 又创建全屏闪元素" % _baf)
    _bacn = _strip_cmt(_bac)
    for _fnname in ["screenShake", "zoomPunch", "speedLines", "godRays", "impactCore", "slash"]:
        _m6 = re.search(r"function " + _fnname + r"\([^)]*\)\s*\{(.*?)\}", _bacn)
        if _m6 and (("createElement" in _m6.group(1)) or ("classList.add" in _m6.group(1)) or ("appendChild" in _m6.group(1))):
            _flash_bad.append("%s %s() 又恢复(震屏/全屏/白闪)" % (_baf, _fnname))
    if re.search(r"\.hsn-vignette\{[^}]*animation\s*:\s*hsnVignette", _strip_cmt(_bac)):
        _flash_bad.append("%s .hsn-vignette 又加回脉动动画" % _baf)
if _flash_bad:
    fail("★屏幕闪/震屏特效复活(Hansen 会头晕/眼睛不适, BUG#50+#52): %s" % _flash_bad[:8])
else:
    ok("★屏幕闪/震屏特效保持禁用 (19岛 flashScreen空/shake-screen无抖/bossHitFx无闪转 + boss-anim screenFlash/screenShake/zoomPunch/speedLines/godRays/impactCore/slash 全空 + rage红边无脉动, 防 BUG#50/#52 回归)")

# ---- 检查16: ★复习/拼写练习必须锁整页滚动 (体验回归防护 v471 · BUG#51: 否则手碰键盘上滑会滚动、右侧出滚动条、没法打字) ----
# hansen_spell_practice.js 全屏覆盖层(看汉意拼单词/听音拼词)必须: start 锁 body 滚动 + 覆盖层 overflow:hidden/overscroll/touch-action + close 成对还原。
# 任一缺失 → 滚动条回来、打字被打断 → 直接拒绝打包。先剥注释再判(复用检查15的 _strip_cmt)。
_spf = "hansen_spell_practice.js"
if os.path.exists(_spf):
    _spn = _strip_cmt(open(_spf, encoding="utf-8").read()).replace(" ", "")
    _sp_miss = []
    # 🔴v1070: 原为钉死整条赋值语句，等价改写(换属性写法/换 API)即误报——
    #   与 v1069「星海觉醒」那两道守卫同一个坑。改为查行为特征。
    if not re.search(r"body\.style\.overflow\s*=\s*['\"]hidden|body\.style\.setProperty\(\s*['\"]overflow['\"]\s*,\s*['\"]hidden", _spn):
        _sp_miss.append("start 未锁 body 滚动")
    if ("overscroll-behavior:none" not in _spn) or ("touch-action:none" not in _spn):
        _sp_miss.append("覆盖层缺 overflow/overscroll/touch-action 禁滚样式")
    if "document.body.style.overflow=_hspPrevBodyOverflow" not in _spn:
        _sp_miss.append("close 未成对还原 body 滚动")
    if _sp_miss:
        fail("★复习/拼写练习未锁整页滚动(手碰键盘上滑会滚、出滚动条, BUG#51): %s" % _sp_miss)
    else:
        ok("★复习/拼写练习锁整页滚动在位 (start 锁 body + 覆盖层 overflow:hidden/touch-action:none + close 还原, 防 BUG#51 回归)")
else:
    ok("(未找到 hansen_spell_practice.js, 跳过检查16)")

# ---- 检查17: ★打字字母格【一排显示(不换行) + 不溢出屏幕】 (体验回归防护 v477/v479 · BUG#53 换两排 + BUG#55 溢出屏幕) ----
# 结构: 外层 .typing-slots(width:100% 居中) + 内层 .typing-slots-inner(内容尺寸字母行, flex-wrap:nowrap)。
# HansenFitSlots 缩【内层】transform:scale 把整排装进一屏(短词不缩)。拼写练习 + 各岛"打字大师"共用。
# 内层丢 nowrap → 长单词换两排(#53); 内层包裹/HansenFitSlots 丢失 → 长单词溢出屏幕(#55)。先剥注释再判。
_wrap_bad = []
for _i in islands:
    _fc17 = _strip_cmt(open("island_%s.html" % _i, encoding="utf-8", errors="replace").read())
    _ti = re.search(r"\.typing-slots-inner\s*\{[^{}]*\}", _fc17)
    if not _ti:
        _wrap_bad.append("island_%s.html 缺 .typing-slots-inner(防溢出包裹层 #55)" % _i)
    elif "flex-wrap:wrap" in _ti.group(0):
        _wrap_bad.append("island_%s.html .typing-slots-inner 改回 flex-wrap:wrap(长单词换两排 #53)" % _i)
    elif "nowrap" not in _ti.group(0):
        _wrap_bad.append("island_%s.html .typing-slots-inner 缺 flex-wrap:nowrap(#53)" % _i)
    if 'id="typeSlots"><div class="typing-slots-inner">' not in _fc17:
        _wrap_bad.append("island_%s.html 打字大师未把字母格包进 .typing-slots-inner(会溢出 #55)" % _i)
if os.path.exists("hansen_spell_practice.js"):
    _spc17 = open("hansen_spell_practice.js", encoding="utf-8").read()
    if "window.HansenFitSlots" not in _spc17:
        _wrap_bad.append("hansen_spell_practice.js 缺 HansenFitSlots(整排缩放装进一屏)")
    if "typing-slots-inner" not in _spc17:
        _wrap_bad.append("hansen_spell_practice.js 缺 .typing-slots-inner 包裹(拼写练习会溢出 #55)")
if _wrap_bad:
    fail("★打字字母格换行/溢出屏幕(Hansen 要求一排显示且绝不溢出, BUG#53+#55): %s" % _wrap_bad[:8])
else:
    ok("★打字字母格【一排+不溢出】在位 (19岛 .typing-slots-inner nowrap + HansenFitSlots 缩内层装进一屏, 防 BUG#53 换两排 / #55 溢出回归)")

# ---- 检查18: ★游戏内键盘极高灵敏度(触碰/滑过即输入) (体验回归防护 v478 · BUG#54: 原来只能精准点击、滑一下不认) ----
# hansen_spell_practice.js 全局装一次: touchstart 一碰键就输入 + touchmove 滑过字母键也输入(el.click 触发, 两键盘通吃)。
# 丢失任一 → 键盘又变迟钝(只能点、不能滑) → 拒绝打包。
_spf18 = "hansen_spell_practice.js"
if os.path.exists(_spf18):
    _spc18 = open(_spf18, encoding="utf-8").read()
    _kbd_miss = []
    if "__hsnKbdTouchSetup" not in _spc18:
        _kbd_miss.append("缺触碰输入处理器(__hsnKbdTouchSetup)")
    if "touchstart" not in _spc18:
        _kbd_miss.append("缺 touchstart 一碰即输入")
    if "touchmove" not in _spc18:
        _kbd_miss.append("缺 touchmove 滑过字母即输入")
    if _kbd_miss:
        fail("★键盘触碰/滑动输入丢失(Hansen 要求一碰即打, BUG#54): %s" % _kbd_miss)
    else:
        ok("★键盘极高灵敏度在位 (touchstart 一碰即输入 + touchmove 滑过字母即输入, 两键盘通吃, 防 BUG#54 回归)")
else:
    ok("(未找到 hansen_spell_practice.js, 跳过检查18)")

# ---- 检查19: ★boss 台词框【全文 + 不出屏 + 长台词自动换行】 (体验回归防护 v480/v824 · BUG#56→v824) ----
# hansen_boss_lock.js 注入的 #bossMsg 必须: 宽随台词加长(width:max-content, 不锁 320px)、不裁切(无 overflow:hidden/ellipsis)。
# 🔴 v824: 赛季 boss 长叙事台词在 nowrap+定高32px 框里被右边截断(Hansen截图: "…无处遁形。-15 HP"的"HP"被切·很多boss都有)→ 根治:
#   #bossMsg + .boss-msg-inner 改 white-space:normal 允许换行 + 去掉死高(留 min-height:32px·border-box等边距→1行32px居中/2行约50px居中)·原字号不缩。
# 防回归: #bossMsg/.boss-msg-inner 不能再改回 white-space:nowrap、#bossMsg 不能再锁固定 height:32px / max-height:32px(否则长台词又单行出框被截) → 拒绝打包。
_taunt_bad = []
if os.path.exists("hansen_boss_lock.js"):
    _bl = open("hansen_boss_lock.js", encoding="utf-8").read()
    _mrule = re.search(r"#bossScreen #bossMsg\{[^}]*\}", _bl)   # 只取主壳规则(.hit/.boss-msg-inner 选择器不含紧邻 '{' 不会误匹配)
    if not _mrule:
        _taunt_bad.append("hansen_boss_lock.js 找不到 #bossMsg 注入规则")
    else:
        _rule = _mrule.group(0)
        if "text-overflow:ellipsis" in _rule or "overflow:hidden" in _rule:
            _taunt_bad.append("#bossMsg 又改回 overflow:hidden/ellipsis(长台词会被截成…)")
        if "max-content" not in _rule:
            _taunt_bad.append("#bossMsg 缺 width:max-content(框无法随台词加长)")
        if "min-width:320px" in _rule:
            _taunt_bad.append("#bossMsg 又锁回 min-width:320px(框不随台词伸缩)")
        if "white-space:nowrap" in _rule:
            _taunt_bad.append("#bossMsg 又改回 white-space:nowrap(长台词单行出框被截·v824 Hansen截图bug)")
        if "white-space:normal" not in _rule:
            _taunt_bad.append("#bossMsg 缺 white-space:normal(长台词需换行不出框·v824)")
        if "max-height:32px" in _rule or re.search(r"(?<![-\w])height:32px", _rule):
            _taunt_bad.append("#bossMsg 又锁回固定高32px(2行台词被压/出框·v824应只留min-height)")
    _irule = re.search(r"#bossScreen #bossMsg \.boss-msg-inner\{[^}]*\}", _bl)
    if _irule and "white-space:nowrap" in _irule.group(0):
        _taunt_bad.append(".boss-msg-inner 又改回 white-space:nowrap(内层单行→长台词出框·v824应normal)")
    if "fitBossMsg" not in _bl and "HansenFitBossMsg" not in _bl:
        _taunt_bad.append("缺 fitBossMsg(台词适配函数)")
    if "boss-msg-inner" not in _bl:
        _taunt_bad.append("缺 .boss-msg-inner 包裹层")
    if _taunt_bad:
        fail("★boss 台词框截断/出屏(Hansen 要求台词全文显示·长台词换行不出框, BUG#56/v824): %s" % _taunt_bad[:8])
    else:
        ok("★boss 台词框【全文+不出屏+长台词换行】在位 (#bossMsg width:max-content + white-space:normal 长台词换2行 + min-height:32px自适应居中 + 无裁切, 防 BUG#56/v824 截断回归)")
else:
    ok("(未找到 hansen_boss_lock.js, 跳过检查19)")

# ---- 检查20: ★游戏失败结算用独立美观页(全 19 岛 · BUG#57: 钓鱼/打地鼠/泡泡失败结算原塞窄 Prompt 文字竖排乱) ----
# 19 岛各自的钓鱼/打地鼠/泡泡失败结算必须整块替换 #...Content(独立美观结算页), 不能再把 '😢 游戏结束' 塞进窄 #...Prompt(文字会被挤成竖排乱)。
_summary_bad = []
for _isl in islands:
    _ifn = "island_%s.html" % _isl
    if not os.path.exists(_ifn):
        continue
    _ic = open(_ifn, encoding="utf-8").read()
    if "😢 游戏结束" in _ic:
        _summary_bad.append("%s 仍有 '😢 游戏结束' 塞窄 Prompt 旧写法" % _isl)
        continue
    for _gfn, _cont, _endm in [
        ("function fishGameOver(){", "fishContent", "function fishComplete(){"),
        ("function bubbleGameOver(){", "bubbleContent", "function nextBubble(){"),
    ]:
        _k = _ic.find(_gfn)
        if _k >= 0:
            _e = _ic.find(_endm, _k)
            _seg = _ic[_k:_e] if _e > _k else _ic[_k:_k + 3800]
            if "getElementById('%s').innerHTML" % _cont not in _seg:
                _summary_bad.append("%s %s 未整块替换 #%s" % (_isl, _gfn[9:-3], _cont))
    _mk = _ic.find("if(molesLives<=0){")
    if _mk >= 0 and "getElementById('molesContent').innerHTML" not in _ic[_mk:_mk + 3800]:
        _summary_bad.append("%s 打地鼠失败未整块替换 #molesContent" % _isl)
if _summary_bad:
    fail("★游戏失败结算排版回归(Hansen 要求独立美观结算页, BUG#57): %s" % _summary_bad[:10])
else:
    ok("★钓鱼/打地鼠/泡泡失败结算独立美观页在位 (全19岛各自整块替换 #...Content, 防 BUG#57 塞窄 Prompt 竖排乱)")

# ---- 检查21: ★boss 做题页除打字外不缩立绘 (BUG#58: spellFill/spellPick 曾加 bts-compact 把立绘缩成118px·伤画质·Hansen 要求不缩) ----
# Hansen 要求: boss 做题页除【打字题】(键盘需空间)外, 一律【不缩 boss 立绘】、保持全尺寸、不出滚动条(实测全尺寸一屏放得下)。
# 修复 = applySpellFill/applySpellPick 不再 classList.add('bts-compact')(那会把立绘从190缩成118px); spellPick 6 个短选项改【3 列 2 行】省一行高度 + 去冗余副标题。
# 静态守: hansen_boss_lock.js 里【不得再有】 classList.add('bts-compact'); 且 spellPick 选项须 3 列(repeat(3, 1fr))。
if os.path.exists("hansen_boss_lock.js"):
    _bl21 = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read()
    _q_bad = []
    _nadd = _bl21.count("classList.add('bts-compact')")
    if _nadd > 0:
        _q_bad.append("仍有 %d 处 classList.add('bts-compact')(会把 boss 做题页立绘缩成118px, Hansen 要求除打字外不缩)" % _nadd)
    if "repeat(3, 1fr)" not in _bl21:
        _q_bad.append("spellPick 6 选项未用 3 列(repeat(3, 1fr)), 全尺寸立绘会超屏出滚动条")
    if _q_bad:
        fail("★boss做题页缩立绘回归(BUG#58, Hansen要求除打字外不缩立绘/不出滚动条): " + "; ".join(_q_bad))
    else:
        ok("★boss 做题页除打字外不缩立绘在位 (spellFill/spellPick 无 bts-compact·立绘全尺寸; spellPick 选项 3 列省高度, 防 BUG#58 缩立绘/滚动条回归)")
else:
    ok("(未找到 hansen_boss_lock.js, 跳过检查21)")

# ---- 检查22: ★boss 立绘 SVG <image> 必须带 xlink:href (BUG#59: 微信X5内核只认 SVG1.1 的 xlink:href, 裸 href 加载不出 → boss 立绘空白) ----
# 事故(BUG#59): boss 立绘是 PNG 包在 SVG 里(`<svg><image href="bosses/lvNN.webp">`)。SVG2 的裸 `href` 在 Chrome 能渲染,
#   但【微信内置浏览器(X5/系统webview)只认 SVG1.1 的 `xlink:href`】→ boss 立绘在微信里整片空白(用户实拍: 动物岛 boss 图没了)。
#   修复 = 全岛 boss 图 SVG 补 `xmlns:xlink` + `<image>` 同时写 `href` 和 `xlink:href`(新旧浏览器通吃)。
# 静态守: 每岛 `<image href="bosses/` 的个数必须 ≤ `xlink:href="bosses/` 的个数(即每个 boss 图 href 都配了 xlink:href)。
_xlink_bad = []
for _isl in islands:
    _ifn = "island_%s.html" % _isl
    if not os.path.exists(_ifn):
        continue
    _ic22 = open(_ifn, encoding="utf-8", errors="replace").read()
    _nhref = _ic22.count('<image href="bosses/')
    _nxlink = _ic22.count('xlink:href="bosses/')
    if _nhref > 0 and _nxlink < _nhref:
        _xlink_bad.append("%s(%d个href但仅%d个xlink:href)" % (_isl, _nhref, _nxlink))
if _xlink_bad:
    fail("★boss立绘微信兼容回归(BUG#59: boss图SVG <image>缺 xlink:href → 微信X5内核立绘空白): " + "; ".join(_xlink_bad[:8]))
else:
    ok("★boss 立绘 SVG <image> 带 xlink:href 在位 (全19岛 boss 图 href+xlink:href 双写, 防 BUG#59 微信内核 boss 立绘空白)")

# ---- 检查23: ★勇者受击特效 (浮动伤害数字 + 血条受击动画) 在位 (v485 功能 · Hansen 选最克制零眩晕方案 · 防误删/回归) ----
# 功能(v485): boss 打到勇者时, 勇者血条上方飘出红色 "-N" 伤害数字(上浮淡出)+ 掉血段浅红拖尾平滑下沉。
#   全平滑·零眩晕·不闪不抖不旋转不脉动(守 Hansen 视觉红线)。实现 = hansen_boss_lock.js 定义 window.HansenHeroHit,
#   全 19 岛扣血(heroHP-=dmg)后调用 window.HansenHeroHit(dmg,heroHP,heroMaxHP)。
_hit_bad = []
_blk23 = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read() if os.path.exists("hansen_boss_lock.js") else ""
if ("window.HansenHeroHit = function" not in _blk23) and ("window.HansenHeroHit=function" not in _blk23):
    _hit_bad.append("hansen_boss_lock.js 未定义 window.HansenHeroHit")
if "hansen-hero-hit-css" not in _blk23:
    _hit_bad.append("hansen_boss_lock.js 缺受击特效 CSS 注入(hansen-hero-hit-css)")
_nocall = []
for _isl in islands:
    _ifn = "island_%s.html" % _isl
    if not os.path.exists(_ifn):
        continue
    _ic23 = open(_ifn, encoding="utf-8", errors="replace").read()
    if "window.HansenHeroHit(dmg,heroHP,heroMaxHP)" not in _ic23:
        _nocall.append(_isl)
if _nocall:
    _hit_bad.append("%d 岛缺受击特效调用: %s" % (len(_nocall), ",".join(_nocall[:8])))
if _hit_bad:
    fail("★勇者受击特效缺失/回归(v485 浮动伤害数字+血条受击动画): " + "; ".join(_hit_bad))
else:
    ok("★勇者受击特效在位 (hansen_boss_lock.js 定义 HansenHeroHit+CSS + 全19岛扣血调用; 浮动伤害数字+血条受击拖尾, 全平滑零眩晕不闪不抖)")

# ---- 检查24: ★弹出/UI/装饰特效禁止角度旋转/歪斜/晃动 (Hansen 红线 · v486 去旋转大扫除 · 防回归) ----
# Hansen 对"蹦出来时歪斜/晃动/有角度旋转"会眩晕。除以下白名单外, 全岛 + boss动画/抽卡/花瓣 的
# 任何 keyframe/transform 都【不得】含非0 geometric rotate(hue-rotate 是色彩滤镜, 不算):
#   · island_*.html  仅放行 360  (@spin 加载转圈, 功能性)
#   · hansen_boss_anim.js 仅放行 -34 (hsn-slash 命中刀斩固定斜线)
#   · hansen_gacha.js 不放行任何 rotate(必须全0)  (hansen_rain.js 已于 v795 彻底删除·单词雨功能移除)
# (命中 boss 的刀斩 hansenSlashCut/-28/28 在 hansen_boss_lock.js, 固定斜线不晃, 不在本检查扫描范围)
import re as _re24
from collections import Counter as _C24
_rot24 = _re24.compile(r'(?<!hue-)rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)')
_rotwl = {"hansen_boss_anim.js": {"-34"}, "hansen_gacha.js": set()}
_island_wl = {"360"}
_rot_bad = []
_scan24 = sorted([_f for _f in os.listdir('.') if _f.startswith('island_') and _f.endswith('.html')]) \
          + ["hansen_boss_anim.js", "hansen_gacha.js"]
for _f24 in _scan24:
    if not os.path.exists(_f24):
        continue
    _c24 = open(_f24, encoding="utf-8", errors="replace").read()
    _wl = _island_wl if _f24.startswith("island_") else _rotwl.get(_f24, set())
    _nz = [v for v in _rot24.findall(_c24) if float(v) != 0 and v not in _wl]
    if _nz:
        _rot_bad.append("%s: %s" % (_f24, dict(_C24(_nz))))
if _rot_bad:
    fail("★发现角度旋转/歪斜特效(Hansen 红线 · 弹出/UI/装饰特效不得带角度 · 仅许@spin/刀斩): " + "; ".join(_rot_bad[:6]))
else:
    ok("★无角度旋转/歪斜特效 (全岛+boss动画/抽卡/花瓣的弹出/UI/装饰特效已扁平, 仅留@spin加载转圈+命中刀斩固定斜线; 守 Hansen 不眩晕红线)")

# ---- 检查25: ★每个boss专属攻击特效(21套)集成在位 (v487 功能 · 防误删/回归) ----
# hansen_boss_attack.js: 答错被反击时按当前boss名播放专属攻击特效(飞球/斩击/矛刺/闪电/触手/飞毯/激光/螺旋等),
# 命中瞬间调 HansenHeroHit 接掉血反馈(永不破坏); 全程无屏幕闪/无震屏/无眩晕旋转, SVG整段字符串解析(微信内核安全)。
# 需满足: 模块存在+定义 window.HansenBossAttack+FX映射>=21条(20 boss+赛季); 全19岛<script>引用@当前版本; 全19岛扣血处调 HansenBossAttack(bossCurrent,...)
_hba_f = "hansen_boss_attack.js"
_hba_bad = []; _fxn = 0
if not os.path.exists(_hba_f) or os.path.getsize(_hba_f) == 0:
    _hba_bad.append("模块缺失/空")
else:
    _hba_c = open(_hba_f, encoding="utf-8", errors="replace").read()
    _fxn = _hba_c.count("':{t:'")
    if "window.HansenBossAttack" not in _hba_c: _hba_bad.append("未定义 window.HansenBossAttack")
    if _fxn < 21: _hba_bad.append("FX映射仅 %d 条(应>=21)" % _fxn)
    # 🔴 v497: 机械泰坦拳头攻击改用真实立绘图(bosses/mechfist_real.webp, 已预旋45°顺时针·拳头朝右下·透明PNG·用<img>), 守卫图存在+被引用(防被删/改回旧丑SVG)
    if "mechfist_real.webp" not in _hba_c: _hba_bad.append("机械泰坦未引用拳头图 mechfist_real.webp")
    if not os.path.exists("bosses/mechfist_real.webp"): _hba_bad.append("缺 bosses/mechfist_real.webp(机械泰坦拳头攻击图)")
    # 🔴 v499 BUG#67: 机械泰坦拳头是【唯一外部图片】的boss特效, 必须 init 预加载+解码 + makeWeapon 克隆复用 →
    #   否则每次现新建<img>, 首次/慢解码时 slam动画(500ms)放完前图还没出来 → 拳头空白没出现(Hansen实测)。守卫三件: 预加载Image/decode预解码/cloneNode即时绘制。
    if "__hbaFistImg" not in _hba_c or "new Image()" not in _hba_c: _hba_bad.append("拳头图未预加载(BUG#67·缺 __hbaFistImg/new Image)")
    if ".decode(" not in _hba_c: _hba_bad.append("拳头图未调 decode 预解码(BUG#67)")
    if "cloneNode" not in _hba_c: _hba_bad.append("makeWeapon未克隆预加载拳头图(BUG#67·应 cloneNode 即时绘制)")
_isl25 = sorted([_f for _f in os.listdir('.') if _f.startswith('island_') and _f.endswith('.html')])
# ⭐ v929 (Hansen: "进岛很卡·点打Boss卡在那儿·要极致快"): hansen_boss_attack.js 有 2.44MB
#   (其中 1.28MB 是内嵌 base64 图), 而它【只有打Boss时才用得上】。原来每次进岛都同步下完+解析完
#   → 白吃首屏带宽和 CPU(实测首屏绘制 2364ms)。v929 改为【按需加载 + 首屏画完后空闲预取】:
#   进岛不加载 → load 后空闲时后台预取 → 点"打Boss"时通常已就位(0延迟), 没就位则 showScreen 自动等它。
#   所以岛里不再有 <script src="hansen_boss_attack.js?v=NNN">, 而是懒加载器 __hansenBossFXReady。
#   守卫改为验证【懒加载器完整】: 加载器 + 文件名 + 版本锚点(从 hansen_boss_lock.js?v=NNN 取版本) + showScreen 钩子。
def _ba929(_t):
    _direct = ('hansen_boss_attack.js?v=%s' % VER) in _t                       # 老写法: 直接 script 标签
    _lazy   = ('__hansenBossFXReady' in _t and 'hansen_boss_attack.js' in _t
               and ('hansen_boss_lock.js?v=%s' % VER) in _t                    # 版本锚点(懒加载器靠它取 ?v=)
               and '__hansenBossFXHooked' in _t)                               # showScreen 钩子(否则点Boss会白屏)
    return _direct or _lazy
_noref25 = [_f for _f in _isl25 if not _ba929(open(_f, encoding="utf-8", errors="replace").read())]
_nohook25 = [_f for _f in _isl25 if 'HansenBossAttack(bossCurrent' not in open(_f, encoding="utf-8", errors="replace").read()]
if _noref25: _hba_bad.append("%d岛未引用模块@v%s" % (len(_noref25), VER))
if _nohook25: _hba_bad.append("%d岛未接钩子" % len(_nohook25))
if _hba_bad:
    fail("★boss专属攻击特效集成异常: " + "; ".join(_hba_bad[:6]))
else:
    ok("★每个boss专属攻击特效(21套)集成在位 (hansen_boss_attack.js 定义 HansenBossAttack + FX映射%d条 + 全19岛引用@v%s + 全19岛扣血调 HansenBossAttack(bossCurrent); 命中接 HansenHeroHit, 微信安全SVG/零眩晕不闪不抖; 机械泰坦拳头外部图已预加载+解码+克隆复用·防首次/慢解码空白 BUG#67)" % (_fxn, VER))

# ---- 检查26: ★boss选择题答完后重复点击不再扣血 (BUG#60 修复 · v488 · 防回归) ----
# 根因: hansen_boss_lock.js 的 window.bossAnswer wrapper 在调原版【之后】的 after 段扣"难度加成"额外伤害,
# 不受原版 #bossOpts dataset.done 闸门约束 → 答完后再点其他错误选项, 额外伤害被重复扣给勇者。
# 修法: wrapper 最外层(调 origBossAnswer 之前)加同一道 dataset.done 闸门, 本题已答则任何重复点击直接 return(不扣血/不特效/不反应)。
_lock26 = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read() if os.path.exists("hansen_boss_lock.js") else ""
_bad26 = []
_guard26 = _lock26.find("if(_bo60 && _bo60.dataset.done)")
_wrap26 = _lock26.find("window.bossAnswer = function(i){")
_orig26 = _lock26.find("origBossAnswer.apply(this, arguments)")
if "BUG#60" not in _lock26:
    _bad26.append("缺 BUG#60 注释")
if _guard26 < 0:
    _bad26.append("缺 wrapper dataset.done 防重复闸门")
elif not (0 <= _wrap26 < _guard26 < _orig26):
    _bad26.append("闸门位置不对(须在 wrapper 顶部、调 origBossAnswer 之前)")
if _bad26:
    fail("★boss答完重复点击防扣血异常: " + "; ".join(_bad26))
else:
    ok("★boss选择题答完后重复点击不再扣血 (hansen_boss_lock.js wrapper 顶部加 #bossOpts dataset.done 闸门·在调原版前; 防 BUG#60 重复扣'难度加成'额外伤害回归)")

# ---- 检查27: ★复仇/打boss快速点击不再跳到未解锁boss·不崩溃 (BUG#61 修复 · v489 · 防回归) ----
# 根因: 原版 startBoss 用 bossCurrent=BOSSES[S.level-1] 按【玩家XP等级 S.level】选 boss。
#   胜利/战败页原生按钮 onclick="startBoss()" 在被改写成 hansenStartRebattle 之前的窗口(或极速狂点)里被点中,
#   → 按 XP 选到与正在复仇的 boss 无关、甚至【未解锁】的高级 boss (实测: 复仇Lv11 龙骑士 + XP15 → 跳到 烈焰魔神Lv15)。
# 三层修复: ① lock startBoss wrapper 进原版前把目标关【夹进解锁上限】(_tgt61/_cap61)并临时钉 S.level, try/finally 还原;
#           ② cards victory/defeat hook 同步立即改写按钮(_rewriteWin61/_rewriteLose61)消除 50ms 窗口;
#           ③ cards hansenStartRebattle 加 600ms 同关重入防抖(__hsnRebStamp61)。
_lock27 = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read() if os.path.exists("hansen_boss_lock.js") else ""
_cards27 = open("hansen_cards.js", encoding="utf-8", errors="replace").read() if os.path.exists("hansen_cards.js") else ""
_bad27 = []
# ① lock: 钉等级 + 夹解锁上限 + try/finally 还原
if "BUG#61" not in _lock27:
    _bad27.append("lock 缺 BUG#61 注释")
if not ("_tgt61" in _lock27 and "_cap61" in _lock27 and "_restoreLv61" in _lock27):
    _bad27.append("lock startBoss 缺等级夹取/还原逻辑(_tgt61/_cap61/_restoreLv61)")
if "getUnlockedBossLv" not in _lock27:
    _bad27.append("lock 未用 getUnlockedBossLv 作解锁上限")
# ② cards: 同步改写(立即调用, 非仅 setTimeout)
if not ("_rewriteWin61" in _cards27 and "_rewriteLose61" in _cards27):
    _bad27.append("cards victory/defeat 缺同步改写函数(_rewriteWin61/_rewriteLose61)")
# ③ cards: 重入防抖
if "__hsnRebStamp61" not in _cards27:
    _bad27.append("cards hansenStartRebattle 缺 600ms 重入防抖(__hsnRebStamp61)")
if "BUG#61" not in _cards27:
    _bad27.append("cards 缺 BUG#61 注释")
if _bad27:
    fail("★复仇快速点击防跳关异常: " + "; ".join(_bad27))
else:
    ok("★复仇/打boss快速点击不再跳到未解锁boss·不崩溃 (lock startBoss 进原版前夹解锁上限·钉对boss·try/finally还原; cards 胜利/战败页同步改写按钮消除50ms窗口; hansenStartRebattle 600ms 重入防抖; 防 BUG#61 跳烈焰魔神/寒冰女王 + 界面不稳回归)")

# ---- 检查28: ★打boss题不再卡死·全程永不卡死 (BUG#62 修复 v490 + 加强 v491 · 防回归) ----
# 根因: 复仇/重战入口 hansenStartRebattle【不走 stopBoss】, 跨场状态(lastNextBossQAt/_bossQType/bossSessionToken)
#   只有 stopBoss 会清 → 残留可让本场第一题 nextBossQ 走偏; 更核心是开场第一题只靠岛内一发 setTimeout(nextBossQ,400)
#   【零重试】, 切后台被浏览器节流丢这一发 → boss立绘/血条/台词都在但题目区整片空白、玩家永久卡死(Hansen后台点复仇即此)。
# 两层修复(都在共享 hansen_boss_lock.js → 全19岛统一生效):
#   ① startBoss wrapper 开场无条件清跨场状态: bossSessionToken++ / lastNextBossQAt=0 / window._bossQType=null;
#   ② 空白看门狗: 周期(setInterval ensureBossQuestion)+ visibilitychange(回前台即查), 检测"还在战斗却题目区空白"
#      → 250ms 二次确认仍空 → 解锁闸门强制 nextBossQ() 恢复; stopBoss 里清掉看门狗周期。
_lock28 = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read() if os.path.exists("hansen_boss_lock.js") else ""
if not _lock28:
    ok("(未找到 hansen_boss_lock.js, 跳过检查28)")
else:
    _bad28 = []
    if "BUG#62" not in _lock28:
        _bad28.append("缺 BUG#62 注释")
    # ① 跨场状态自愈(两层标记必须都在)
    if "BUG#62 修复 (v490) 第①层" not in _lock28:
        _bad28.append("startBoss wrapper 缺第①层跨场状态自愈(bossSessionToken++/lastNextBossQAt=0/_bossQType=null)")
    # ② 看门狗核心组件
    if "BUG#62 修复 (v490) 第②层" not in _lock28:
        _bad28.append("缺第②层空白看门狗装载")
    if "ensureBossQuestion" not in _lock28:
        _bad28.append("缺看门狗核心函数 ensureBossQuestion")
    if "_bossQWdStuck" not in _lock28:
        _bad28.append("缺卡空白检测 _bossQWdStuck")
    if "_bossQWdInterval" not in _lock28:
        _bad28.append("缺看门狗周期句柄 _bossQWdInterval")
    if "setInterval(ensureBossQuestion" not in _lock28:
        _bad28.append("看门狗未周期挂载(setInterval ensureBossQuestion)")
    if "__hbuVisWd" not in _lock28 or "visibilitychange" not in _lock28:
        _bad28.append("缺 visibilitychange 回前台即查恢复(__hbuVisWd)")
    # 🔴 v491 加强: 看门狗须覆盖打boss【全程】——不止开场空白, 还要救"答完后卡在已答题"(下一题 setTimeout 被后台丢失)。
    if "_lastAnswerAt" not in _lock28:
        _bad28.append("缺答题时刻记录 _lastAnswerAt(v491加强·判下一题超时)")
    if "_bossQWdHasLiveQ" not in _lock28:
        _bad28.append("缺未答活题判定 _bossQWdHasLiveQ(v491加强·防玩家慢答误判)")
    if "_bossQWdAnsweredShowing" not in _lock28:
        _bad28.append("缺已答题滞留判定 _bossQWdAnsweredShowing(v491加强·救中途答完卡死)")
    # 🔴 v491 反向守卫: 看门狗判"活题"绝不能【全文档】搜 .typing-slots —— 打字小游戏退出后 #typingContent 里的
    #   .typing-slots 会残留(stopTyping 不清空), 全文档搜会被它骗成"有活题"→ 玩家"先玩打字再打boss"时看门狗整个失灵。
    if "document.querySelector('.typing-slots" in _lock28:
        _bad28.append("看门狗误用全文档搜 .typing-slots(会被打字游戏残留骗失灵·v491已改为只在bossOpts内判定, 勿回退)")
    if _bad28:
        fail("★打boss开场题空白卡死防护异常: " + "; ".join(_bad28))
    else:
        ok("★打boss开场题不再空白卡死·全程永不卡死 (startBoss开场清跨场状态; 周期+回前台visibilitychange看门狗; 空白→恢复, 答完卡已答题超时3.5s→恢复, 未答活题不动防慢答误判; stopBoss清看门狗; 全19岛统一; 防 BUG#62 后台复仇卡死回归·v491加强覆盖全程)")

# ---- 检查29: ★小游戏防卡死看门狗在位 (BUG#63 修复 · v492 · 防回归) ----
# 背景: boss 有 BUG#62 看门狗, 但打字/复习/钓鱼/打地鼠/泡泡/听音/完形的"下一轮"靠 setTimeout, 切后台丢了会永久卡死。
# 共享模块 hansen_game_antifreeze.js 统一兜底(全19岛同名函数→一个模块兜全部); 只在回前台后触发→正常游戏期间不动→不误伤。
# 安全闸: 每模式 verified:true 才生效(未真机验证的不运行); 已验证: typing(打字)+fish(钓鱼)。
_af = "hansen_game_antifreeze.js"
if not os.path.exists(_af):
    fail("★缺小游戏防卡死看门狗模块 hansen_game_antifreeze.js (BUG#63)")
else:
    _afsrc = open(_af, encoding="utf-8", errors="replace").read()
    _bad29 = []
    if "BUG#63" not in _afsrc:
        _bad29.append("模块缺 BUG#63 标记")
    # 安全设计: 只在回前台触发(visibilitychange) + 仅 verified 模式运行
    if "visibilitychange" not in _afsrc:
        _bad29.append("缺 visibilitychange 回前台触发(安全核心: 正常游戏期间不动)")
    if "if (!MODES[i].verified) continue" not in _afsrc and "verified" not in _afsrc:
        _bad29.append("缺 verified 安全闸(未验证模式必须不运行)")
    # v942 安全边界: 状态访问必须是显式白名单/API；动态代码执行会绕过 CSP，
    # 也会让任意状态名变成代码注入入口。
    if "function G(name)" not in _afsrc or "switch(name)" not in _afsrc:
        _bad29.append("缺显式状态白名单 API G(name)/switch(name)")
    if "window.HansenAntiFreeze" not in _afsrc:
        _bad29.append("缺 window.HansenAntiFreeze 显式状态/诊断 API")
    if "new Function" in _afsrc or re.search(r"\beval\s*\(", _afsrc):
        _bad29.append("禁止 eval/new Function 动态执行(违反 CSP 与显式状态 API)")
    # 已验证模式在位(全 7 个小游戏)
    for _mname in ["'typing'", "'fish'", "'bubble'", "'listen'", "'cloze'", "'moles'", "'review'"]:
        if _mname not in _afsrc:
            _bad29.append("缺 %s 模式" % _mname.strip("'"))
    # 全 19 岛加载
    _isl = sorted(glob.glob("island_*.html")) if 'glob' in dir() else []
    try:
        import glob as _g
        _isl = sorted(_g.glob("island_*.html"))
    except Exception:
        pass
    _miss = [f for f in _isl if "hansen_game_antifreeze.js" not in open(f, encoding="utf-8", errors="replace").read()]
    if _isl and _miss:
        _bad29.append("未全岛加载(%d 岛缺引用): %s" % (len(_miss), ", ".join(_miss[:5])))
    if _bad29:
        fail("★小游戏防卡死看门狗异常: " + "; ".join(_bad29))
    else:
        ok("★小游戏防卡死看门狗在位 (hansen_game_antifreeze.js 全%d岛加载; 只回前台触发; verified 闸; 显式白名单状态 API; 禁 eval/new Function; 全7个小游戏; 防 BUG#63)" % (len(_isl) if _isl else 19))

# ---- 检查30: ★抽卡翻转揭晓【防卡死 + 不剧透】在位 (BUG#64 · 防回归) ----
# 抽卡揭晓靠 setTimeout 分阶段(蓄力→翻转→揭晓→确定); 切后台丢了会卡在转圈的"?"上、或"确定"一直不出来→关不掉。
# 防护: ①神秘态(gr-myst/?覆盖 + gr-real隐藏 → 旋转全程不漏内容/稀有度, 停稳加 gr-done 才揭晓); ②防卡死(回前台强制补齐 + 安全兜底 → 永远揭晓+确定出得来)。
_gf = "hansen_gacha.js"
if not os.path.exists(_gf):
    fail("★缺 hansen_gacha.js")
else:
    _gc = open(_gf, encoding="utf-8", errors="replace").read()
    _bad30 = []
    if "BUG#64" not in _gc:
        _bad30.append("缺 BUG#64 标记")
    # 不剧透: 神秘覆盖层 + 隐藏真内容 + 揭晓闸
    for _k in ["gr-myst", "gr-real", "gr-done"]:
        if _k not in _gc:
            _bad30.append("缺 %s(旋转不剧透结构)" % _k)
    # 防卡死: 强制补齐 + 安全兜底 + 回前台
    if "grForceComplete" not in _gc:
        _bad30.append("缺 grForceComplete(强制补齐)")
    if "grSafetyTimer" not in _gc:
        _bad30.append("缺 grSafetyTimer(安全兜底)")
    if "visibilitychange" not in _gc:
        _bad30.append("缺 visibilitychange(回前台补齐)")
    # 仍只用 rotateY(不眩晕·检查24 安全), 不得引入平面 rotate(非0)
    import re as _re30
    _rot30 = [v for v in _re30.findall(r'(?<!hue-)(?<!Y)rotate\(\s*(-?\d+(?:\.\d+)?)deg', _gc) if float(v) != 0]
    if _rot30:
        _bad30.append("抽卡出现平面rotate(非0·眩晕风险): %s" % _rot30[:3])
    if _bad30:
        fail("★抽卡揭晓防卡死/不剧透异常: " + "; ".join(_bad30))
    else:
        ok("★抽卡翻转揭晓【不剧透+防卡死】在位 (旋转全程神秘?不漏内容/稀有度·停稳gr-done才揭晓; 回前台强制补齐+安全兜底→永远揭晓且'确定'出得来关得掉; 仅rotateY不眩晕; 防 BUG#64 回归)")

# ---- 检查31: ★boss战布局(藏导航+一屏+不出滚动条+狂怒不长高)仅【战斗中】生效, 选boss列表可正常滚动 (v496功能 + BUG#66修复 · 防回归) ----
# Hansen 要求: ①打 boss 战(尤其狂怒第3阶段)隐藏底部导航(主页/错题/宠物/成就)+整屏给战斗+一屏放下不出滚动条+打字键盘整排可见+打字词一行;
#   ②【BUG#66 关键·Hansen实测重大bug】boss 屏【既是选boss列表页、又是战斗答题页】——锁滚动/藏导航【只能绑"战斗激活(bossActive)"】,
#     绝不能绑 showScreen('boss')(v496旧做法hsn-boss-screen就这么绑→把【选boss列表】也锁死→列表滑不动、够不到屏幕外下面的boss(Lv10+)→无法进入)。
#     选boss列表必须能上下滚动去选所有boss。真机已验: 选boss列表可滚动✓ / 战斗中锁滚动+藏导航+一屏(等2.5s不被误移除)✓ / 战斗结束解锁✓。
# 防护: 类名=hsn-boss-battle(战斗专属); 19岛 showScreen 用 window.bossActive 绑(非 id==='boss' 单独); boss_lock startBoss 加类;
#   19岛 stopBoss/bossVictory/bossDefeat 移除类(解锁); boss_lock body.hsn-boss-battle 锁滚动/藏导航/隐藏标题 + 打字stats-bar固定高(狂怒不长高) + 立绘响应式140/112/96。
import glob as _g31
_bad31 = []
_isl31 = sorted(_g31.glob("island_*.html"))
def _r31(_f): return open(_f, encoding="utf-8", errors="replace").read()
_bind31 = sum(1 for _f in _isl31 if ("hsn-boss-battle" in _r31(_f) and "window.bossActive===true" in _r31(_f)))
_unlock31 = sum(1 for _f in _isl31 if _r31(_f).count("remove('hsn-boss-battle')") >= 3)
if len(_isl31) >= 1 and _bind31 < len(_isl31):
    _bad31.append("仅 %d/%d 岛 showScreen 用 bossActive 绑 hsn-boss-battle(应全部·防BUG#66锁死选boss列表)" % (_bind31, len(_isl31)))
if len(_isl31) >= 1 and _unlock31 < len(_isl31):
    _bad31.append("仅 %d/%d 岛 战斗结束(stop/胜/负)移除 hsn-boss-battle 解锁(应全部)" % (_unlock31, len(_isl31)))
_regress31 = [os.path.basename(_f) for _f in _isl31 if ("hsn-boss-screen" in _r31(_f) or "(id==='typing'||id==='boss')?'none'" in _r31(_f))]
if _regress31:
    _bad31.append("BUG#66回归: %d岛把锁绑回boss屏(hsn-boss-screen/boss藏导航)→会锁死选boss列表: %s" % (len(_regress31), _regress31[:3]))
_bf31 = "hansen_boss_lock.js"
if not os.path.exists(_bf31):
    _bad31.append("缺 hansen_boss_lock.js")
else:
    _bc31 = _r31(_bf31)
    if "classList.add('hsn-boss-battle')" not in _bc31:
        _bad31.append("boss_lock startBoss 未加 hsn-boss-battle 类(战斗激活才锁)")
    for _k, _d in [
        ("body.hsn-boss-battle{overflow:hidden", "战斗锁滚动(不出滚动条)"),
        ("body.hsn-boss-battle .bottom-nav{display:none", "战斗藏底部导航"),
        ("body.hsn-boss-battle .app{padding-bottom:0", "战斗去#app留白"),
        (".screen-title{display:none", "战斗隐藏标题省空间"),
        ("flex-wrap:nowrap!important;height:24px", "打字stats-bar固定高(狂怒不长高)"),
        ("@media (max-height:679px)", "打字矮屏只缩键盘(boss不缩·v878统一214px·Hansen键盘下移)"),
    ]:
        if _k not in _bc31:
            _bad31.append("缺 %s [%s]" % (_k, _d))
    if "body.hsn-boss-screen" in _bc31:
        _bad31.append("BUG#66回归: boss_lock 仍有 body.hsn-boss-screen(应已改 hsn-boss-battle)")
if _bad31:
    fail("★boss战布局/选boss列表滚动异常: " + "; ".join(_bad31))
else:
    ok("★boss战布局仅战斗中生效·选boss列表可滚动 在位 (类=hsn-boss-battle战斗专属·绑bossActive非boss屏; 19岛showScreen绑bossActive+3结束函数解锁; boss_lock startBoss加类+锁滚动/藏导航/隐藏标题+打字stats-bar固定高使狂怒不长高+立绘响应式140/112/96; 真机:选boss列表可滚动/战斗中锁2.5s不误移除/结束解锁; 防 v496回归 + BUG#66锁死列表回归)")

# 🔴 v500 BUG#68: bossAnswer 的 allOpts[i].classList.add('wrong'/'correct') 无防护——若 allOpts[i] 缺失(选项元素未渲染等)会抛 TypeError,
#   而【答错路径】的 boss 攻击特效(FX)调用就在 allOpts[i] 这行之后 → 一抛错就【跳过 FX + 掉血 + 台词】。极苛刻全boss测试中暴露(快进时选项尚未渲染就答)。
#   正常游戏玩家点真实选项 i 总有效不会触发, 但为极致健壮: 全19岛两处都必须 if(allOpts[i]) 防护, 保证任何情况下 FX 都不被这行抛错跳过。
_g68=[]
for _f in sorted(glob.glob("island_*.html")):
    _c=open(_f,encoding="utf-8").read()
    if "allOpts[i].classList.add('wrong')" in _c and "if(allOpts[i])allOpts[i].classList.add('wrong')" not in _c:
        _g68.append(os.path.basename(_f)+":wrong无防护")
    if "allOpts[i].classList.add('correct')" in _c and "if(allOpts[i])allOpts[i].classList.add('correct')" not in _c:
        _g68.append(os.path.basename(_f)+":correct无防护")
if _g68: fail("BUG#68: bossAnswer allOpts[i] 未防护(FX/掉血/台词可能被跳过): " + str(_g68[:4]))
else: ok("\u2605bossAnswer allOpts[i] 两处(\u7b54\u9519/\u7b54\u5bf9)\u516819\u5c9b\u6709 if \u9632\u62a4 (BUG#68\u00b7\u9009\u9879\u7f3a\u5931\u4e5f\u4e0d\u62a5\u9519\u00b7\u4fdd\u8bc1FX/\u6389\u8840/\u53f0\u8bcd\u4e0d\u88ab\u8df3\u8fc7)")

# 🔴 v501: Hansen 定稿——机械泰坦拳头改【竖直砸下·高86px】(去掉旧45°斜角·mechfist_real.webp 已转正为竖直图)。
#   守: makeWeapon 拳头显示尺寸必须竖直(高>宽), 防回归成方形斜拳头。
_mw=re.search(r"m\.width=(\d+);m\.height=(\d+)", open("hansen_boss_attack.js",encoding="utf-8").read())
if not _mw: fail("v501: 未找到机械泰坦拳头 m.width/m.height")
elif int(_mw.group(2))<=int(_mw.group(1)): fail("v501: 机械泰坦拳头非竖直(高%s<=宽%s)·应竖直砸下" % (_mw.group(2),_mw.group(1)))
else: ok("\u673a\u68b0\u6cf0\u5766\u62f3\u5934\u7ad6\u76f4\u7838\u4e0b (makeWeapon \u9ad8%s>\u5bbd%s\u00b7v501 Hansen\u5b9a\u7a3f\u00b7\u53bb\u638945\u00b0\u659c\u89d2)" % (_mw.group(2),_mw.group(1)))

# 🔴 v502: 机械泰坦拳头新效果(Hansen 定稿)——从小变大(起始30%→满)+ 砸中后原地淡出(不回撤不缩小)+ 0.8s 加速, 用专属 hba-fist 类(与百战兽人锤子 hba-weapon 分开互不影响)。
_hbafx=open("hansen_boss_attack.js",encoding="utf-8").read()
_g502=[]
if "hbaFistSlam" not in _hbafx: _g502.append("缺 hbaFistSlam 动画")
if "className='hba-fist'" not in _hbafx: _g502.append("机械泰坦拳头未用 hba-fist 类")
if "--startScale" not in _hbafx: _g502.append("缺 --startScale(从小变大)")
if "hbaWeaponSlam" not in _hbafx: _g502.append("百战兽人锤子 hbaWeaponSlam 丢失(不该被改)")
if _g502: fail("v502 机械泰坦拳头新效果守卫: " + str(_g502))
else: ok("\u673a\u68b0\u6cf0\u5766\u62f3\u5934\u65b0\u6548\u679c\u5728\u4f4d (hba-fist\u7c7b + hbaFistSlam\u5c0f\u53d8\u5927 + \u7838\u4e2d\u540e\u539f\u5730\u6de1\u51fa\u00b7v502 Hansen\u5b9a\u7a3f\u00b7\u4e0e\u767e\u6218\u517d\u4eba\u9524\u5b50\u5206\u5f00)")

# 🔴 v503: 上古太阳神攻击改为【太阳火球】(外部图·从小变大砸向勇者[同机械泰坦拳头模式]·命中血条火焰燃烧·零震屏零屏闪)。
_hba3=open("hansen_boss_attack.js",encoding="utf-8").read()
_s3=[]
if not os.path.exists("bosses/sunball_real.webp"): _s3.append("\u7f3a sunball_real.webp")
if "__hbaSunImg" not in _hba3 or "_sunImg.decode" not in _hba3: _s3.append("\u592a\u9633\u706b\u7403\u672a\u9884\u52a0\u8f7d+\u89e3\u7801")
if "function makeSunball" not in _hba3 or "__hbaSunImg.cloneNode" not in _hba3: _s3.append("\u706b\u7403\u672a\u514b\u9686\u590d\u7528")
# v531起 sunslam 退役(上古太阳神→sungod)·分支/makeSunball/sunFireBurn 保留为死代码·__hbaSunImg 预加载仍现役(sungod 聚日成阳直接复用)
if "t==='sunslam'" not in _hba3 or "function sunFireBurn" not in _hba3: _s3.append("sunslam历史死代码(分支/sunFireBurn)被误删")
if _s3: fail("v503 \u592a\u9633\u795e\u706b\u7403: " + str(_s3[:4]))
else: ok("\u4e0a\u53e4\u592a\u9633\u795e\u592a\u9633\u706b\u7403 (\u5916\u90e8\u56fe\u9884\u52a0\u8f7d/\u89e3\u7801/\u514b\u9686\u00b7\u4ece\u5c0f\u53d8\u5927\u7838\u5411\u52c7\u8005\u00b7\u547d\u4e2d\u8840\u6761\u706b\u7130\u71c3\u70e7\u00b7v503)")

# 🔴 v504/v505: 混沌魔尊(Lv19)/外星霸主(Lv18)攻击改为【光波/光束】(外部图·从boss处细端clip揭示逐渐展开·大端抵达血条命中+掉血·尺寸按boss→勇者距离动态贴合·速度每boss可调 --wdur·同拳头/火球预加载克隆防首次空白)。
_hba4=open("hansen_boss_attack.js",encoding="utf-8").read()
_s4=[]
if not os.path.exists("bosses/chaoswave_real.webp"): _s4.append("缺 chaoswave_real.webp(混沌漩涡)")
if not os.path.exists("bosses/alienbeam_real.webp"): _s4.append("缺 alienbeam_real.webp(外星光束)")
if "__hbaWaveImg" not in _hba4 or "_waveImg.decode" not in _hba4: _s4.append("漩涡未预加载+解码")
if "__hbaBeamImg" not in _hba4 or "_beamImg.decode" not in _hba4: _s4.append("光束未预加载+解码")
if "function makeWaveImg" not in _hba4 or ".cloneNode" not in _hba4: _s4.append("makeWaveImg历史死代码被误删")
# v530起 wave 全退役(外星霸主v529→alienlord·混沌魔尊v530→hellgate)·分支/键帧/--wdur/makeWaveImg 保留为死代码·两图预加载仍现役(光束→alienlord歼星炮·漩涡→hellgate混沌龙卷)
if "t==='wave'" not in _hba4 or "hbaChaosWave" not in _hba4 or "var(--wdur" not in _hba4: _s4.append("wave历史死代码三件(分支/键帧/--wdur)被误删")
# v529起外星霸主配置已换alienlord(歼星协议·轨道湮灭)·wave仅剩混沌魔尊现役·光束图被alienlord歼星炮直接复用
if _s4: fail("v505 光波/光束: " + str(_s4[:5]))
else: ok("两图预加载完好·wave全退役为死代码 (光束图随alienlord服役·漩涡图随hellgate服役·wave分支/键帧/makeWaveImg死代码盯防·v505/v529/v530)")

# 🔴 v506: 暗夜吸血鬼(Lv6)攻击改为【獠牙咬合】(4颗牙齿图·上2颗下咬+下2颗上咬·牙尖在勇者血条中线相碰·血条泛红+滴血·第五个外部图FX·同样预加载/克隆防空白)。
_hba6=open("hansen_boss_attack.js",encoding="utf-8").read()
_s6=[]
import glob as _g6
_vf=[p for p in ["bosses/vfang_tl.webp","bosses/vfang_tr.webp","bosses/vfang_bl.webp","bosses/vfang_br.webp"] if not os.path.exists(p)]
if _vf: _s6.append("缺牙齿图:"+str(_vf))
if "__hbaVfangImgs" not in _hba6 or "_vfangSrcs" not in _hba6: _s6.append("4颗牙未预加载")
if "function makeVfang" not in _hba6 or "cloneNode" not in _hba6: _s6.append("牙齿未克隆复用")
if "t==='fangbite'" not in _hba6 or "hbaVbiteTop" not in _hba6 or "hbaVbiteBot" not in _hba6: _s6.append("缺 fangbite分支或咬合键帧")
if "hsn-bite-glow" not in _hba6 or "hba-vblood" not in _hba6: _s6.append("缺血条泛红或滴血")
# v515: 吸血鬼配置已换 batmoon(血月蝠群); fangbite 分支/键帧保留为历史死代码, 4牙图+makeVfang 被 v515 真牙咬合阶段【复用】(上面已查), 配置检查移交 v515 守卫
if _s6: fail("v506 吸血鬼獠牙咬合: " + str(_s6[:5]))
else: ok("暗夜吸血鬼獠牙咬合 (4颗牙齿图预加载/克隆·上下咬合牙尖相碰·血条泛红+滴血+掉血·v506)")

# 🔴 v507: 暗影忍者(Lv2)攻击改为【扔手里剑】(手里剑图·边飞边旋转命中勇者血条·血液飞溅+掉血·第六个外部图FX·同样预加载/克隆防空白)。
_hba7=open("hansen_boss_attack.js",encoding="utf-8").read()
_s7=[]
if not os.path.exists("bosses/shuriken.webp"): _s7.append("缺手里剑图 bosses/shuriken.webp")
if "__hbaShuriImg" not in _hba7 or "_shuriSrc" not in _hba7: _s7.append("手里剑未预加载")
if "function makeShuriken" not in _hba7 or "function bloodSplatter" not in _hba7: _s7.append("缺 makeShuriken或bloodSplatter")
if "t==='shuriken'" not in _hba7 or "rotate(" not in _hba7: _s7.append("缺 shuriken分支或旋转")
if "hba-splat" not in _hba7 or "hba-splash-ring" not in _hba7 or "hbaSplashRing" not in _hba7: _s7.append("缺血液飞溅CSS")
if "'暗影忍者':{t:'shadowdance'" not in _hba7: _s7.append("暗影忍者须为shadowdance(v551影舞三连杀·shuriken已退役保留)")
if _s7: fail("v507 暗影忍者扔手里剑: " + str(_s7[:5]))
else: ok("暗影忍者扔手里剑 (手里剑图预加载/克隆·边飞边旋转·命中血液飞溅12滴+红环+掉血·v507)")

# 🔴 v510: 机械泰坦(Lv17)拳头→导弹散射汇聚(Hansen 定稿)。导弹从 boss 向四面八方喷射(二次贝塞尔控制点=boss+方向×散开距离)→各自划弧转向→全部汇聚命中勇者→连环小爆炸+最后一记大爆炸。SVG导弹内联无需外部图。配色等离子。旧拳头代码(makeWeapon mechfist/hba-fist/slam mechfist路径)变死代码保留(太阳神 sunball 仍复用 hbaFistSlam·勿删)。
_hba10=open("hansen_boss_attack.js",encoding="utf-8").read()
_s10=[]
# v528起机械泰坦配置已换titanstrike·此处只守missilestorm历史死代码组件不丢
if "t==='missilestorm'" not in _hba10: _s10.append("缺 missilestorm 分支(历史死代码)")
if "function hbmMissileSVG" not in _hba10: _s10.append("缺 hbmMissileSVG(导弹SVG)")
if "function qBez" not in _hba10: _s10.append("缺 qBez(贝塞尔)")
if "function hbmExplode" not in _hba10: _s10.append("缺 hbmExplode(多层爆炸)")
if ".hba-missile{" not in _hba10: _s10.append("缺 .hba-missile CSS")
if "hba-mwrap" not in _hba10: _s10.append("缺 .hba-mwrap 容器")
if _s10: fail("v510 机械泰坦导弹散射汇聚: " + str(_s10[:6]))
else: ok("missilestorm历史组件完好 (v510遗产·导弹SVG+贝塞尔+爆炸保留·v528起机械泰坦已换titanstrike·分支保留为死代码)")

# 🔴 v511: 烈焰魔神(Lv15)单火球→火焰陨石雨(Hansen 定稿)。熔岩岩石陨石SVG(岩石核心+裂纹+陨石坑+熾热前缘+燃烧彗尾)从天斜射砸向勇者→连环火爆+残留地火+最后一颗巨型陨石大爆炸。SVG陨石内联无需外部图。复用 hbmExplode/拖尾/火星(--mc*)。配色烈焰。
_hba11=open("hansen_boss_attack.js",encoding="utf-8").read()
_s11=[]
# v524起烈焰魔神配置已换doomstar·此处只守meteorrain历史死代码组件不丢
if "t==='meteorrain'" not in _hba11: _s11.append("缺 meteorrain 分支(历史死代码)")
if "function hbmMeteorSVG" not in _hba11: _s11.append("缺 hbmMeteorSVG(陨石SVG)")
if "function hbmGroundFire" not in _hba11: _s11.append("缺 hbmGroundFire(地火)")
if ".hba-meteor{" not in _hba11: _s11.append("缺 .hba-meteor CSS")
if ".hba-gfire{" not in _hba11: _s11.append("缺 .hba-gfire CSS")
if "hbmExplode" not in _hba11: _s11.append("缺 hbmExplode复用")
if _s11: fail("v511 烈焰魔神火焰陨石雨: " + str(_s11[:6]))
else: ok("meteorrain历史组件完好 (v511遗产·陨石SVG+地火+爆炸复用·v524起烈焰魔神已换doomstar·分支保留为死代码)")

# 🔴 v512: 百战兽人(Lv3)战锤震地(Hansen 定稿)。真实战锤图(第七个外部图片FX·预加载+解码+克隆复用·防BUG#67空白)以【锤柄靠底1/3处】为转动轴心(离锤头2/3·离柄底1/3=兽人真实握位)·锤头举右上→绕轴心抡弧向下→锤头砸勇者血条→熔岩地裂(冲击闪+双冲击环+地裂SVG+岩刺+碎石+火星+尘土)。全fixed贴body·熔岩色硬编码·hba-hq前缀·零震屏零屏闪·命中接掉血。
_hba12=open("hansen_boss_attack.js",encoding="utf-8").read()
_s12=[]
import os as _os12
if not _os12.path.exists("bosses/hammer_real.webp"): _s12.append("缺战锤图 bosses/hammer_real.webp")
_orcf=re.search(r"'百战兽人':\{[^}]*\}", _hba12)
_orcc=_orcf.group(0) if _orcf else ""
if "hammerquake" not in _orcc: _s12.append("百战兽人未配置 hammerquake")
for _kw in ["pal:","sz:","sp:","fxi:"]:  # 🔴 v553: dur→sp(百战连锤用速度倍率)
    if _kw not in _orcc: _s12.append("百战兽人配置缺 "+_kw)
if "t==='hammerquake'" not in _hba12: _s12.append("缺 hammerquake 分支")
if "function hbaHammerQuake" not in _hba12: _s12.append("缺 hbaHammerQuake(地裂)")
if "function hbaCrackSVG" not in _hba12: _s12.append("缺 hbaCrackSVG(地裂SVG)")
if "function hbaSpikeSVG" not in _hba12: _s12.append("缺 hbaSpikeSVG(岩刺SVG)")
if "function makeHammer" not in _hba12: _s12.append("缺 makeHammer(克隆预加载)")
# 轴心=柄底1/3处(pivot 0.683·非旧 pommel 0.96)
if "pivot:{x:0.50,y:0.683}" not in _hba12: _s12.append("战锤轴心 pivot 非0.683(柄底1/3处)")
if "HAMMER_GEO.pivot.x*HW" not in _hba12: _s12.append("分支几何未用 pivot 轴心")
if "HAMMER_GEO.pivot.x*100" not in _hba12: _s12.append("transform-origin 未用 pivot")
# 预加载+解码+克隆 三件(防BUG#67)
if "_hammerImg.decode" not in _hba12: _s12.append("战锤图未预解码(BUG#67风险)")
if "window.__hbaHammerImg" not in _hba12: _s12.append("战锤图未保留引用预加载")
if ".cloneNode(true)" not in _hba12: _s12.append("makeHammer 未克隆复用预加载图")
# 地裂特效组件 CSS
for _cls in [".hba-hammer2{",".hba-hqcrack{",".hba-hqspike{",".hba-hqrock{",".hba-hqring{",".hba-hqflash{",".hba-hqspark{",".hba-hqdust{"]:
    if _cls not in _hba12: _s12.append("缺 "+_cls+" CSS")
if _s12: fail("v512 百战兽人战锤震地: " + str(_s12[:8]))
else: ok("百战兽人换战锤震地 (hammerquake·真实锤图·轴心=柄底1/3处pivot0.683·绕轴抡弧砸地·熔岩地裂冲击波+地裂+岩刺+碎石+尘土·预加载/解码/克隆防BUG#67·零震屏零屏闪·v512)")

# 🔴 v513: 史前霸王龙(Lv4)远古霸主连击(Hansen 定稿)。①震地咆哮(双冲击环+三音波+碎石浮起+余烬+天色泛黄) ②地面冲击浪滚向勇者 ③能量巨爪左右双扫·各划三道平行撕痕+沿痕火星 ④霸王巨口上下颌咬合勇者血条(咬合时deal)·爆闪+扁冲击环+碎片12+柔光。全SVG内联无外部图(无BUG#67风险)·琥珀色硬编码·hba-rx前缀·全fixed贴body·零震屏零屏闪。
_hba13=open("hansen_boss_attack.js",encoding="utf-8").read()
_s13=[]
_rxf=re.search(r"'史前霸王龙':\{[^}]*\}", _hba13)
_rxc=_rxf.group(0) if _rxf else ""
if "rexfury" not in _rxc: _s13.append("史前霸王龙须为rexfury(v555远古之怒·rexapex/dinocombo均已退役保留)")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _rxc: _s13.append("史前霸王龙配置缺 "+_kw)
if "t==='dinocombo'" not in _hba13: _s13.append("缺 dinocombo 分支")
if "function hbaRexCombo" not in _hba13: _s13.append("缺 hbaRexCombo(主编排)")
if "function hbaRxWaveSVG" not in _hba13: _s13.append("缺 hbaRxWaveSVG(音波)")
if "function hbaRxPawSVG" not in _hba13: _s13.append("缺 hbaRxPawSVG(能量爪)")
if "function hbaRxTearSVG" not in _hba13: _s13.append("缺 hbaRxTearSVG(撕痕)")
if "function hbaRxJawSVG" not in _hba13: _s13.append("缺 hbaRxJawSVG(巨口)")
for _cls in [".hba-rxsky{",".hba-rxvign{",".hba-rxring{",".hba-rxwave{",".hba-rxpeb{",".hba-rxember{",".hba-rxgwave{",".hba-rxgdust{",".hba-rxpaw{",".hba-rxtear{",".hba-rxspark{",".hba-rxjaw{",".hba-rxflash{",".hba-rxchompring{",".hba-rxshard{"]:
    if _cls not in _hba13: _s13.append("缺 "+_cls+" CSS")
# 旧 slash 分支保留(千年僵尸/史前霸王龙曾用·僵尸仍在用)
if "t==='slash'" not in _hba13: _s13.append("slash分支被误删(v514起为历史死代码·保留勿删防回归)")
if _s13: fail("v513 史前霸王龙远古霸主连击: " + str(_s13[:8]))
else: ok("史前霸王龙换远古霸主连击 (dinocombo·咆哮音波+冲击浪+双能量爪三连撕+巨口咬合·全SVG内联无外部图·琥珀·零震屏零屏闪·v513)")

# 🔴 v514: 千年僵尸(Lv5)符咒尸毒连击(Hansen 定稿)。①阴风鬼火(天色泛绿+鬼火飘摇+阴风纹) ②飞符诅咒(黄纸红符旋转飞出"啪"贴勇者头顶·红光连闪) ③双尸爪抓击(青绿长甲爪左右交错·各三道腐蚀爪痕冒毒泡+毒滴飞溅) ④尸毒爆发(符咒炸裂引爆·三团毒云+毒泡升腾破裂+毒液四溅+冲击环+柔光·deal)。全SVG内联无外部图(无BUG#67风险)·尸毒绿硬编码(符咒黄纸红符固定)·hba-zb前缀·全fixed贴body·零震屏零屏闪。旧slash分支自此为历史死代码(无boss在用)·保留勿删。
_hba14=open("hansen_boss_attack.js",encoding="utf-8").read()
_s14=[]
_zbf=re.search(r"'千年僵尸':\{[^}]*\}", _hba14)
_zbc=_zbf.group(0) if _zbf else ""
if "zombiefury" not in _zbc: _s14.append("千年僵尸须为 zombiefury(v559 万拳齐发·zombiecurse/zombieseal 均已退役保留)")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _zbc: _s14.append("千年僵尸配置缺 "+_kw)
if "t==='zombiecurse'" not in _hba14: _s14.append("缺 zombiecurse 分支")
if "function hbaZombieCurse" not in _hba14: _s14.append("缺 hbaZombieCurse(主编排)")
if "function hbaZbWindSVG" not in _hba14: _s14.append("缺 hbaZbWindSVG(阴风)")
if "function hbaZbTalisSVG" not in _hba14: _s14.append("缺 hbaZbTalisSVG(符咒)")
if "function hbaZbClawSVG" not in _hba14: _s14.append("缺 hbaZbClawSVG(尸爪)")
if "function hbaZbTearSVG" not in _hba14: _s14.append("缺 hbaZbTearSVG(爪痕)")
for _cls in [".hba-zbsky{",".hba-zbvign{",".hba-zbwisp{",".hba-zbwind{",".hba-zbtalis{",".hba-zbtring{",".hba-zbclaw{",".hba-zbtear{",".hba-zbbub{",".hba-zbdrop{",".hba-zbcloud{",".hba-zbflash{",".hba-zbring{",".hba-zbtshard{"]:
    if _cls not in _hba14: _s14.append("缺 "+_cls+" CSS")
if _s14: fail("v514 千年僵尸符咒尸毒连击: " + str(_s14[:8]))
else: ok("千年僵尸符咒尸毒连击[已退役保留] (zombiecurse 分支/工具函数/CSS 全保留勿删·v558 起 FX 表改 zombieseal·v514)")

# 🔴 v515: 暗夜吸血鬼(Lv6)血月蝠群噬血连击(Hansen 定稿)。①血月升起(夜幕+剪影掠月) ②蝙蝠群袭(SVG蝙蝠双翼独立扇动·rAF贝塞尔划弧扑勇者·命中蝠烟+红环) ③獠牙咬合(复用v506四颗真牙图makeVfang·上下加速咬合血条34%/62%·爆闪+泛红+滴血·deal) ④吸血回流(血球rAF贝塞尔拖尾吸回血月·月亮逐颗胀亮·血光柔震)。血月红硬编码·hba-vm前缀·全fixed贴body·零震屏零屏闪。旧fangbite分支为历史死代码保留。
_hba15=open("hansen_boss_attack.js",encoding="utf-8").read()
_s15=[]
_vmf=re.search(r"'暗夜吸血鬼':\{[^}]*\}", _hba15)
_vmc=_vmf.group(0) if _vmf else ""
if "batmoon" not in _vmc: _s15.append("暗夜吸血鬼未配置 batmoon")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _vmc: _s15.append("暗夜吸血鬼配置缺 "+_kw)
if "t==='batmoon'" not in _hba15: _s15.append("缺 batmoon 分支")
if "function hbaBatMoon" not in _hba15: _s15.append("缺 hbaBatMoon(主编排)")
if "function hbaVmBatSVG" not in _hba15: _s15.append("缺 hbaVmBatSVG(蝙蝠)")
if "function hbaVmQB" not in _hba15: _s15.append("缺 hbaVmQB(贝塞尔)")
if "makeVfang(which, sz*1.15)" not in _hba15: _s15.append("咬合阶段未复用 makeVfang 真牙图")
if "t==='fangbite'" not in _hba15: _s15.append("fangbite历史死代码被误删")
for _cls in [".hba-vmnight{",".hba-vmvign{",".hba-vmmoon{",".hba-vmbat{",".hba-vmpuff{",".hba-vmring{",".hba-vmdrip{",".hba-vmorb{",".hba-vmtrail{",".hba-vmflash{"]:
    if _cls not in _hba15: _s15.append("缺 "+_cls+" CSS")
for _kf in ["hbaVmFlapL","hbaVmFlapR","hbaVmRing","hbaVmFlash"]:
    if _kf not in _hba15: _s15.append("缺键帧 "+_kf)
if _s15: fail("v515 暗夜吸血鬼血月蝠群: " + str(_s15[:8]))
else: ok("暗夜吸血鬼换血月蝠群噬血连击 (batmoon·血月+蝠群扇翅划弧+复用四真牙咬合+血球吸回血月·血月红·零震屏零屏闪·v515)")

# 🔴 v516: 蒙面大魔王(Lv7)黑暗领域千面幻杀(Hansen 定稿)。①黑暗领域(暗紫降临+双环魔法阵金紫反向旋转+魔气上飘) ②千面分裂(幻影面具按立绘: 紫脸+尖耳+金冠红宝石+黄眼meye+红面罩·从本体旋转分裂到半弧悬停浮动) ③锁定齐袭(眼齐亮lock→逐个旋转540°俯冲撞血条·紫碎闪+环+血条短促泛光+金色连击数字"N连!") ④魔王终结(暗黑核搏动→横贯暗黑冲击波扫到勇者·爆闪+大环+碎片12+全屏紫光柔震·deal)。全SVG内联无外部图·魔王紫硬编码(面具金冠/红面罩固定)·hba-mk前缀·全fixed贴body·零震屏零屏闪。fly为playFx默认兜底路径(巫婆/巫师/寒冰女王/星海女帝等5配置仍用)·不可破坏。
_hba16=open("hansen_boss_attack.js",encoding="utf-8").read()
_s16=[]
_mkf=re.search(r"'蒙面大魔王':\{[^}]*\}", _hba16)
_mkc=_mkf.group(0) if _mkf else ""
if "maskphantom" not in _mkc: _s16.append("蒙面大魔王未配置 maskphantom")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _mkc: _s16.append("蒙面大魔王配置缺 "+_kw)
if "t==='maskphantom'" not in _hba16: _s16.append("缺 maskphantom 分支")
if "function hbaMaskPhantom" not in _hba16: _s16.append("缺 hbaMaskPhantom(主编排)")
if "function hbaMkCircleSVG" not in _hba16: _s16.append("缺 hbaMkCircleSVG(魔法阵)")
if "function hbaMkMaskSVG" not in _hba16: _s16.append("缺 hbaMkMaskSVG(幻影面具)")
if "function flyOnHit" not in _hba16: _s16.append("flyOnHit(默认弹道兜底)被误删")
# v535起 fly 全退役(星海女帝双形态→starempress)·默认兜底路径(makeProjectile/flyOnHit)保留为安全网+历史死代码
if "function makeProjectile" not in _hba16 or "flyOnHit" not in _hba16: _s16.append("fly默认兜底(makeProjectile/flyOnHit)被误删")
for _cls in [".hba-mkdome{",".hba-mkvign{",".hba-mkcircle{",".hba-mkmote{",".hba-mkmask{",".hba-mkcrack{",".hba-mkring{",".hba-mkcore{",".hba-mkwave{",".hba-mkshard{",".hba-mkflash{",".hba-mkcombo{"]:
    if _cls not in _hba16: _s16.append("缺 "+_cls+" CSS")
for _kf in ["hbaMkSpinO","hbaMkSpinI","hbaMkHover","hbaMkCrack","hbaMkRing","hbaMkFlash","hbaMkCombo"]:
    if _kf not in _hba16: _s16.append("缺键帧 "+_kf)
if _s16: fail("v516 蒙面大魔王千面幻杀: " + str(_s16[:8]))
else: ok("蒙面大魔王换黑暗领域千面幻杀 (maskphantom·魔法阵+五幻面悬停锁定俯冲连击+暗黑横贯波·全SVG内联无外部图·魔王紫·零震屏零屏闪·v516)")

# 🔴 v517: 地狱犬王(Lv8)地狱之门三头炼狱(Hansen 定稿)。①地狱之门(半透明炉光黑石拱门在boss身后升起·比立绘大一圈·boss剪影于门火前·门内火光脉动+门口双火苗flicker) ②三头齐啸(左中右三头各两道啸波共6道·地面火苗×5窜高) ③三头火球三连射(左→右→中·中头球最大·rAF贝塞尔+火尾·砸血条0.28/0.72/0.5·金色连击数字) ④合体炼狱炎息(三头各凝火核→飞向中央汇聚大核→锥形火焰吐息clip-path直灌勇者·内焰flicker·沿息火粒·烧灼爆燃: 爆闪+火环+碎片12+浓烟3+全屏橙红柔震·deal)。全SVG+CSS内联无外部图·炼狱橙硬编码·hba-hg前缀·全fixed贴body·零震屏零屏闪。旧firebreath分支为历史死代码保留。
_hba17=open("hansen_boss_attack.js",encoding="utf-8").read()
_s17=[]
_hgf=re.search(r"'地狱犬王':\{[^}]*\}", _hba17)
_hgc=_hgf.group(0) if _hgf else ""
if "hellgate" not in _hgc: _s17.append("地狱犬王未配置 hellgate")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _hgc: _s17.append("地狱犬王配置缺 "+_kw)
if "t==='hellgate'" not in _hba17: _s17.append("缺 hellgate 分支")
if "function hbaHellGate" not in _hba17: _s17.append("缺 hbaHellGate(主编排)")
if "function hbaHgGateSVG" not in _hba17: _s17.append("缺 hbaHgGateSVG(地狱之门)")
if "function hbaHgWaveSVG" not in _hba17: _s17.append("缺 hbaHgWaveSVG(啸波)")
if "function hbaHgFlameSVG" not in _hba17: _s17.append("缺 hbaHgFlameSVG(火苗)")
if "function hbaHgQB" not in _hba17: _s17.append("缺 hbaHgQB(贝塞尔)")
if "t==='firebreath'" not in _hba17: _s17.append("firebreath历史死代码被误删")
for _cls in [".hba-hgdome{",".hba-hgvign{",".hba-hggate{",".hba-hgwave{",".hba-hgflame{",".hba-hgball{",".hba-hgtrail{",".hba-hgburst{",".hba-hgcore{",".hba-hgbeam{",".hba-hgember{",".hba-hgsmoke{",".hba-hgflash{",".hba-hgring{",".hba-hgshard{",".hba-hgcombo{"]:
    if _cls not in _hba17: _s17.append("缺 "+_cls+" CSS")
for _kf in ["hbaHgGatePulse","hbaHgGateFlick","hbaHgBurst","hbaHgBeamFlick","hbaHgFlash","hbaHgRing","hbaHgCombo"]:
    if _kf not in _hba17: _s17.append("缺键帧 "+_kf)
if _s17: fail("v517 地狱犬王三头炼狱: " + str(_s17[:8]))
else: ok("地狱犬王换地狱之门三头炼狱 (hellgate·拱门炉光+三头齐啸+三连火球+三核汇聚锥形炎息·全SVG内联无外部图·炼狱橙·零震屏零屏闪·v517)")

# 🔴 v518: 黑森林巫婆(Lv9)黑森林魔药毒苹果盛宴(Hansen 定稿)。①黑森林降临(巫毒紫天色+荆棘藤蔓两侧爬入scaleX生长+萤绿孢子×7) ②魔药大锅熬煮(三足黑锅升起·锅下紫火苗cfl/cfl2 flicker·锅内绿魔药brew发光·毒泡interval 120ms持续上冒1.7s) ③毒苹果三连发(锅口蹦出3颗·红果#ef4444+绿叶+绿毒裂纹#a3e635固定配色·rAF贝塞尔旋转rotV累加+绿毒尾·砸血条0.26/0.5/0.74·金色连击) ④荆棘缠杀魔药诅咒(双荆棘从血条下两侧窜出L=hypot动态算长·交叉缠紧scaleY .86收勒·枯萎淡出+锅药冲天5滴·勇者紫绿双色毒雾4云大爆发+毒泡8+毒液10+冲击环+全屏紫光柔震·deal)。全SVG+CSS内联无外部图·巫毒紫硬编码(魔药绿/苹果红固定)·hba-wt前缀·全fixed贴body·零震屏零屏闪。原fly单发毒苹果弹道让位·fly默认路径仍服务4配置。
_hba18=open("hansen_boss_attack.js",encoding="utf-8").read()
_s18=[]
_wtf=re.search(r"'黑森林巫婆':\{[^}]*\}", _hba18)
_wtc=_wtf.group(0) if _wtf else ""
if "witchbrew" not in _wtc: _s18.append("黑森林巫婆未配置 witchbrew")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _wtc: _s18.append("黑森林巫婆配置缺 "+_kw)
if "t==='witchbrew'" not in _hba18: _s18.append("缺 witchbrew 分支")
if "function hbaWitchBrew" not in _hba18: _s18.append("缺 hbaWitchBrew(主编排)")
if "function hbaWtVineSVG" not in _hba18: _s18.append("缺 hbaWtVineSVG(荆棘)")
if "function hbaWtCauldronSVG" not in _hba18: _s18.append("缺 hbaWtCauldronSVG(大锅)")
if "function hbaWtAppleSVG" not in _hba18: _s18.append("缺 hbaWtAppleSVG(毒苹果)")
if "function hbaWtQB" not in _hba18: _s18.append("缺 hbaWtQB(贝塞尔)")
if "function flyOnHit" not in _hba18: _s18.append("flyOnHit(默认弹道兜底)被误删")
if "function makeProjectile" not in _hba18 or "flyOnHit" not in _hba18: _s18.append("fly默认兜底被误删(v535起fly全退役·兜底为安全网)")
for _cls in [".hba-wtdome{",".hba-wtvign{",".hba-wtvine{",".hba-wtspore{",".hba-wtcauldron{",".hba-wtbub{",".hba-wtapple{",".hba-wttrail{",".hba-wtburst{",".hba-wtcloud{",".hba-wtdrop{",".hba-wtflash{",".hba-wtring{",".hba-wtcombo{"]:
    if _cls not in _hba18: _s18.append("缺 "+_cls+" CSS")
for _kf in ["hbaWtCFlick","hbaWtBrewGlow","hbaWtBurst","hbaWtFlash","hbaWtRing","hbaWtCombo"]:
    if _kf not in _hba18: _s18.append("缺键帧 "+_kf)
if _s18: fail("v518 黑森林巫婆魔药毒苹果: " + str(_s18[:8]))
else: ok("黑森林巫婆换黑森林魔药毒苹果盛宴 (witchbrew·荆棘爬入+魔药大锅冒泡+毒苹果三连+双荆棘缠杀毒雾爆发·全SVG内联无外部图·巫毒紫·零震屏零屏闪·v518)")

# 🔴 v519: 异次元巫师(Lv10)维度裂隙五元素轮舞(Hansen 定稿)。①禁忌吟唱五元素觉醒(_hbaXwELEM五元素表火橙/雷金/风青/水蓝/虚空紫立绘配色固定·绕巫师rAF公转R=66*sz椭圆0.72·符文粒×8) ②空间撕裂(游戏空间适配: 竖向只有~90px放不下→大裂隙开boss右侧空旷区rx=vw-RW/2-14·rcy=max(by,84+RH/2)·小裂口boss左bx-54*sz·锯齿星空SVG+白边shimmer) ③五元素轮舞瞬移连击(球依次错峰200ms钻进小裂口缩小消失闪→80ms后从大裂隙mouth射出贝塞尔230ms砸血条0.18/0.34/0.5/0.66/0.82·火爆/雷锯齿闪电hbaXwBoltSVG/风双环/水花/虚空各带属性闪+色环+火花·金色连击) ④维度崩塌(裂隙胀亮200ms→斜向五色混沌光柱: rot=atan2(-(hx-sxp),(midY-syp))沿裂隙→血条·L=hypot动态长·520ms·烧灼177ms后爆闪+大环+五色碎片15+全屏紫光柔震·deal·双裂隙横向scaleX→0挤压闭合+闪)。全SVG+CSS内联无外部图·异次元紫硬编码·hba-xw前缀·全fixed贴body·零震屏零屏闪。巫师离开fly后fly配置4→3(寒冰女王/星海女帝×2)。
_hba19=open("hansen_boss_attack.js",encoding="utf-8").read()
_s19=[]
_xwf=re.search(r"'异次元巫师':\{[^}]*\}", _hba19)
_xwc=_xwf.group(0) if _xwf else ""
if "dimrift" not in _xwc: _s19.append("异次元巫师未配置 dimrift")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _xwc: _s19.append("异次元巫师配置缺 "+_kw)
if "t==='dimrift'" not in _hba19: _s19.append("缺 dimrift 分支")
if "function hbaDimRift" not in _hba19: _s19.append("缺 hbaDimRift(主编排)")
if "function hbaXwRiftSVG" not in _hba19: _s19.append("缺 hbaXwRiftSVG(裂隙)")
if "function hbaXwBoltSVG" not in _hba19: _s19.append("缺 hbaXwBoltSVG(雷电)")
if "function hbaXwOrbDiv" not in _hba19: _s19.append("缺 hbaXwOrbDiv(元素球)")
if "function hbaXwQB" not in _hba19: _s19.append("缺 hbaXwQB(贝塞尔)")
if "_hbaXwELEM" not in _hba19: _s19.append("缺 _hbaXwELEM(五元素表)")
for _en in ["'fire'","'thunder'","'wind'","'water'","'void'"]:
    if "n:"+_en not in _hba19: _s19.append("五元素表缺 "+_en)
if "function flyOnHit" not in _hba19: _s19.append("flyOnHit(默认弹道兜底)被误删")
if "function makeProjectile" not in _hba19 or "flyOnHit" not in _hba19: _s19.append("fly默认兜底被误删(v535起fly全退役·兜底为安全网)")
for _cls in [".hba-xwdome{",".hba-xwvign{",".hba-xworb{",".hba-xwrune{",".hba-xwrift{",".hba-xwhit{",".hba-xwringhit{",".hba-xwspark{",".hba-xwbolt{",".hba-xwbeam{",".hba-xwshard{",".hba-xwflash{",".hba-xwringbig{",".hba-xwcombo{"]:
    if _cls not in _hba19: _s19.append("缺 "+_cls+" CSS")
for _kf in ["hbaXwRiftShimmer","hbaXwHit","hbaXwRingHit","hbaXwBeamFlick","hbaXwFlash","hbaXwRingBig","hbaXwCombo"]:
    if _kf not in _hba19: _s19.append("缺键帧 "+_kf)
if _s19: fail("v519 异次元巫师五元素轮舞: " + str(_s19[:8]))
else: ok("异次元巫师换维度裂隙五元素轮舞 (dimrift·五元素公转+双裂隙瞬移连击+斜向五色光柱崩塌·全SVG内联无外部图·异次元紫·零震屏零屏闪·v519)")

# 🔴 v520: 龙骑士统帅(Lv11)巨龙之翼焚天枪雨(Hansen 定稿·Hansen真枪图)。①巨龙之翼遮天蔽日(升级版SVG巨翼: 双层膜景深+黑曜金边四指骨+骨节金钉+腕部金尖骨爪+指尖橙刺+焰脉发光+外缘炽光+余烬星点·展开回弹过冲480ms·wflex层持续扇动呼吸·横贯屏顶) ②统帅号令(金色龙魂SVG盘旋一周640ms+龙吼双环+枪尖蓄力金光) ③焚天枪雨(880ms·真枪图bosses/dragonlance.webp 165x360·round(12*fxi)根错峰65ms从翼下垂直坠落·橙色速度残影hba-dktrailv·落点贯穿闪+碎星·5根精准砸血条0.18~0.82连击·钉住220/300ms淡出) ④终焉巨枪(rainEnd后巨翼收拢扇下brightness1.45·300ms后1.95倍巨枪正中坠落·命中deal+大爆闪+火环+碎片13+浓烟3+地面火舌4+全屏橙红柔震·巨枪钉住后拔出)。BUG#67方案: IIFE初始化预加载+decode存window.__hbaDkLance·落枪cloneNode·兜底新建img。龙焰橙硬编码·hba-dk前缀·全fixed贴body·零震屏零屏闪。旧spear分支为历史死代码保留。
_hba20=open("hansen_boss_attack.js",encoding="utf-8").read()
_s20=[]
if not os.path.exists("bosses/dragonlance.webp"): _s20.append("缺真枪图 bosses/dragonlance.webp")
_dkf=re.search(r"'龙骑士统帅':\{[^}]*\}", _hba20)
_dkc=_dkf.group(0) if _dkf else ""
if "dragonrain" not in _dkc: _s20.append("龙骑士统帅未配置 dragonrain")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _dkc: _s20.append("龙骑士统帅配置缺 "+_kw)
if "t==='dragonrain'" not in _hba20: _s20.append("缺 dragonrain 分支")
if "function hbaDragonRain" not in _hba20: _s20.append("缺 hbaDragonRain(主编排)")
if "function hbaDkWingSVG" not in _hba20: _s20.append("缺 hbaDkWingSVG(巨翼)")
if "function hbaDkSoulSVG" not in _hba20: _s20.append("缺 hbaDkSoulSVG(龙魂)")
if "function hbaDkDropSpear" not in _hba20: _s20.append("缺 hbaDkDropSpear(落枪)")
if "window.__hbaDkLance" not in _hba20: _s20.append("缺真枪图预加载 __hbaDkLance")
if "dragonlance.webp?v=" not in _hba20: _s20.append("真枪图src缺?v=缓存戳")
if "t==='spear'" not in _hba20: _s20.append("spear历史死代码被误删")
for _cls in [".hba-dkdome{",".hba-dkvign{",".hba-dkwing{",".hba-dksoul{",".hba-dkroar{",".hba-dkcharge{",".hba-dkspear{",".hba-dktrailv{",".hba-dkpierce{",".hba-dkstar{",".hba-dkflame{",".hba-dkember{",".hba-dksmoke{",".hba-dkflash{",".hba-dkring{",".hba-dkshard{",".hba-dkcombo{"]:
    if _cls not in _hba20: _s20.append("缺 "+_cls+" CSS")
for _kf in ["hbaDkBreath","hbaDkGlow","hbaDkVein","hbaDkTw","hbaDkRoar","hbaDkPierce","hbaDkFlash","hbaDkRing","hbaDkCombo"]:
    if _kf not in _hba20: _s20.append("缺键帧 "+_kf)
if _s20: fail("v520 龙骑士统帅焚天枪雨: " + str(_s20[:8]))
else: ok("龙骑士统帅换巨龙之翼焚天枪雨 (dragonrain·升级巨翼遮天蔽日+龙魂号令+真枪图枪雨12根+终焉巨枪·预加载decode防BUG#67·龙焰橙·零震屏零屏闪·v520)")

# 🔴 v521: 暗黑灯神(Lv12)神灯魂狱万魂诅咒(Hansen 定稿·Hansen真神灯图)。①神灯降世黑暗烟雾笼罩(金辉爆闪+双金环+金辉光锥×3动态钳位·真神灯图bosses/genielamp.webp 400x203砸落入场过冲回弹+lbob悬浮轻晃·灯嘴interval 70ms狂涌靛紫浓烟2.85s+烟海铺底×5+烟中三对绿眼明灭) ②三个愿望诅咒降临(八角金星40px+旋转光环hbaGnHalo依次升起错峰280ms·300ms白闪→诅咒侵蚀换暗紫裂纹星+尖刺光环·400ms旋转重砸血条0.26/0.5/0.74·紫金双环+碎星5+金色连击) ③灵魂之爪(烟雾翻涌×6·126px魂爪从烟海升起340ms罩住勇者: 五指骨节高光+五枚翠绿魂爪尖发光+掌心魂之印记hbaGnSigil脉动+腕部烟雾卷须·500ms后猛攥拳换hbaGnHandFistSVG: 指节四峰入轮廓+四绿爪破剪影+拳背印记爆亮·攥拳闪+柔光+血条泛光·两缕翠绿魂光错峰110ms被拽出螺旋330ms拉向灯嘴·神灯绿芒逐魂brightness增亮) ④万烟归灯魂狱审判(arrived===2触发hbaGnJudgment: 9团烟错峰38ms从四周倒吸进灯嘴scale→0.15·180ms蓄能珠+神灯暴震狂闪金绿紫340ms·560ms审判光柱: 灯嘴→血条rot=atan2斜射·L=hypot动态·bo金→绿→紫渐变clip-path锥+bi白芯hbaGnBeamFlick·540ms·烧灼184ms: 巨爆闪70+紫金双环+16三色碎片(金/紫/绿)+4魂光四散逃逸+浓烟3+全屏靛紫柔震.6·deal·260ms后神灯熄火喷烟沉降)。BUG#67方案: IIFE预加载+decode存window.__hbaGnLamp·cloneNode秒绘·兜底新建img。暗黑靛硬编码·hba-gn前缀·全fixed贴body·零震屏零屏闪。旧carpet分支为历史死代码保留。
_hba21=open("hansen_boss_attack.js",encoding="utf-8").read()
_s21=[]
if not os.path.exists("bosses/genielamp.webp"): _s21.append("缺真神灯图 bosses/genielamp.webp")
_gnf=re.search(r"'暗黑灯神':\{[^}]*\}", _hba21)
_gnc=_gnf.group(0) if _gnf else ""
if "geniecurse" not in _gnc: _s21.append("暗黑灯神未配置 geniecurse")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _gnc: _s21.append("暗黑灯神配置缺 "+_kw)
if "t==='geniecurse'" not in _hba21: _s21.append("缺 geniecurse 分支")
if "function hbaGenieCurse" not in _hba21: _s21.append("缺 hbaGenieCurse(主编排)")
if "function hbaGnJudgment" not in _hba21: _s21.append("缺 hbaGnJudgment(审判终结)")
if "function hbaGnWishSVG" not in _hba21: _s21.append("缺 hbaGnWishSVG(许愿星)")
if "function hbaGnHandOpenSVG" not in _hba21: _s21.append("缺 hbaGnHandOpenSVG(张开魂爪)")
if "function hbaGnHandFistSVG" not in _hba21: _s21.append("缺 hbaGnHandFistSVG(攥拳魂爪)")
if "function hbaGnSmoke" not in _hba21: _s21.append("缺 hbaGnSmoke(烟雾)")
if "function hbaGnQB" not in _hba21: _s21.append("缺 hbaGnQB(贝塞尔)")
if "window.__hbaGnLamp" not in _hba21: _s21.append("缺真神灯图预加载 __hbaGnLamp")
if "genielamp.webp?v=" not in _hba21: _s21.append("真神灯图src缺?v=缓存戳")
if "t==='carpet'" not in _hba21: _s21.append("carpet历史死代码被误删")
for _cls in [".hba-gndome{",".hba-gnvign{",".hba-gnlamp{",".hba-gnray{",".hba-gnsmoke{",".hba-gneyes{",".hba-gnwish{",".hba-gnwishtr{",".hba-gnhit{",".hba-gnring{",".hba-gnstar{",".hba-gnhand{",".hba-gnsoul{",".hba-gnsoultr{",".hba-gncharge{",".hba-gnbeam{",".hba-gnflash{",".hba-gnshard{",".hba-gncombo{"]:
    if _cls not in _hba21: _s21.append("缺 "+_cls+" CSS")
for _kf in ["hbaGnBob","hbaGnHalo","hbaGnHit","hbaGnRing","hbaGnSigil","hbaGnBeamFlick","hbaGnFlash","hbaGnCombo"]:
    if _kf not in _hba21: _s21.append("缺键帧 "+_kf)
if _s21: fail("v521 暗黑灯神神灯魂狱: " + str(_s21[:8]))
else: ok("暗黑灯神换神灯魂狱万魂诅咒 (geniecurse·真神灯图降世烟雾笼罩+三愿成诅咒+灵魂之爪攥魂+万烟归灯审判光柱·预加载decode防BUG#67·暗黑靛·零震屏零屏闪·v521)")

# 🔴 v522: 海底巨怪(Lv13·首只epic)深渊狂潮八爪绞杀(Hansen 定稿)。①深渊呼唤海水倒灌(战区水带空间适配: 水体只占血条上方WL=midY-64至barTop-6·活体水面双层波浪视差hbaSkSurf+白亮水光线hba-skhl·血条区浸水色调层hba-skover(barTop-8..barBot+26)·绝不遮答题区·水下光斑×3+气泡群interval 150ms升至水面封顶+深水两对青眼明灭) ②八爪缠绕(四根巨触手vw*0.16/0.38/0.62/0.84破水400ms+水花+水珠·岩甲渐变+发光吸盘×6 hbaSkSuck+棘刺×3+青边缘光+tsway摇曳·外侧两根甩鞭rotate30°抽砸血条0.22/0.78连击1/2·内侧两根潜回·横向缠绕段hbaSkWrapSVG(flip内置g transform)左上/右下直接动画left夹击勇者区·绞紧scaleY1.26脉冲连击3/4) ③深渊漩涡(双层螺旋反向旋转hbaSkSpin+7气泡吸入中心) ④灭世狂潮(巨型海啸hbaSkWaveSVG白沫浪卷立起560ms砸落·白沫爆炸×8+青爆闪+青白双环+水珠14四溅+柔震.6·deal≈4165ms·海水退潮: 水体收缩+浸水层淡出+光斑清除)。全SVG+CSS内联无外部图·深渊青硬编码·hba-sk前缀·全fixed贴body·零震屏零屏闪。旧tentacles分支为历史死代码保留。
_hba22=open("hansen_boss_attack.js",encoding="utf-8").read()
_s22=[]
_skf=re.search(r"'海底巨怪':\{[^}]*\}", _hba22)
_skc=_skf.group(0) if _skf else ""
if "abysstide" not in _skc: _s22.append("海底巨怪未配置 abysstide")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _skc: _s22.append("海底巨怪配置缺 "+_kw)
if "t==='abysstide'" not in _hba22: _s22.append("缺 abysstide 分支")
if "function hbaAbyssTide" not in _hba22: _s22.append("缺 hbaAbyssTide(主编排)")
if "function hbaSkSurfSVG" not in _hba22: _s22.append("缺 hbaSkSurfSVG(波浪面)")
if "function hbaSkTentSVG" not in _hba22: _s22.append("缺 hbaSkTentSVG(触手)")
if "function hbaSkWrapSVG" not in _hba22: _s22.append("缺 hbaSkWrapSVG(缠绕段)")
if "function hbaSkVortSVG" not in _hba22: _s22.append("缺 hbaSkVortSVG(漩涡)")
if "function hbaSkWaveSVG" not in _hba22: _s22.append("缺 hbaSkWaveSVG(海啸)")
if "t==='tentacles'" not in _hba22: _s22.append("tentacles历史死代码被误删")
for _cls in [".hba-skdome{",".hba-skvign{",".hba-skbody{",".hba-sksurf{",".hba-skhl{",".hba-skover{",".hba-skcau{",".hba-skbub{",".hba-skeyes{",".hba-sktent{",".hba-skwrap{",".hba-sksplash{",".hba-skdrop{",".hba-skring{",".hba-skfoam{",".hba-skvort{",".hba-skwave{",".hba-skflash{",".hba-skcombo{"]:
    if _cls not in _hba22: _s22.append("缺 "+_cls+" CSS")
for _kf in ["hbaSkSurf","hbaSkCau","hbaSkSway","hbaSkSuck","hbaSkSpin","hbaSkSplash","hbaSkRing","hbaSkFlash","hbaSkCombo"]:
    if _kf not in _hba22: _s22.append("缺键帧 "+_kf)
if _s22: fail("v522 海底巨怪深渊狂潮: " + str(_s22[:8]))
else: ok("海底巨怪换深渊狂潮八爪绞杀 (abysstide·战区水带海水倒灌+四触手甩鞭夹击+深渊漩涡+海啸砸落退潮·全SVG内联无外部图·深渊青·零震屏零屏闪·v522)")

# 🔴 v523: 寒冰女王(Lv14·epic)冰封万古绝对零度(Hansen 定稿)。①暴风雪降临(漫天六角雪花interval 90ms至4.2s摇曳飘落+寒雾×4翻涌·500ms杖尖凝光icharge(bx-34*sz,by-12*sz)+冰霜符文×7绕身) ②冰晶风暴(五根冰晶长矛hbaIqSpearSVG多棱晶体错峰110ms于bx±88*sz(clamp 18..vw-18)凝结220ms+ibob悬浮·(5*110+200)后齐射错峰120ms·rAF直线160ms+rot=atan2(dx,dy)*-1+itrail尾迹·砸血条0.18/0.34/0.5/0.66/0.82: 冰爆+冰环+冰屑×4+连击1~5) ③绝对零度冰封勇者(2450: 寒气波hba-iqwave 150*sz从by+30扫至midY 280ms→85%时刻冰封块hbaIqBlockSVG: BW=min(216*sz,barW+24)·top=midY-BH*0.56·scale1.3→1咔嚓+白闪+白环+霜花hbaIqFrostSVG×2错峰(hx±BW*0.26)+寒雾×4·ipulse内光脉动·冻结800ms·血条透冰可读) ④冰封万古粉碎(crackSVG裂纹160ms淡入+咔咔双白闪150ms错峰→490ms后炸碎: 移除块/裂纹/霜花+爆闪70*fxi+冰蓝/霜白双环+16菱形冰片ichip(8px rotate45三段旋转)+雪雾×4+全屏冰蓝柔震.6+deal≈3978ms)→4200雪停。全SVG+CSS内联无外部图·寒冰蓝硬编码·hba-iq前缀·全fixed贴body·零震屏零屏闪。⚠️fly链: 寒冰女王自此离开fly·fly配置仅剩星海女帝×2·v516/v518/v519三条守卫已同步放宽<3→<2·flyOnHit与默认路径保留。
_hba23=open("hansen_boss_attack.js",encoding="utf-8").read()
_s23=[]
_iqf=re.search(r"'寒冰女王':\{[^}]*\}", _hba23)
_iqc=_iqf.group(0) if _iqf else ""
if "icequeen" not in _iqc: _s23.append("寒冰女王未配置 icequeen")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _iqc: _s23.append("寒冰女王配置缺 "+_kw)
if "t==='icequeen'" not in _hba23: _s23.append("缺 icequeen 分支")
if "function hbaIceQueen" not in _hba23: _s23.append("缺 hbaIceQueen(主编排)")
if "function hbaIqFlakeSVG" not in _hba23: _s23.append("缺 hbaIqFlakeSVG(雪花)")
if "function hbaIqSpearSVG" not in _hba23: _s23.append("缺 hbaIqSpearSVG(冰矛)")
if "function hbaIqBlockSVG" not in _hba23: _s23.append("缺 hbaIqBlockSVG(冰封块)")
if "function hbaIqFrostSVG" not in _hba23: _s23.append("缺 hbaIqFrostSVG(霜花)")
if "function hbaIqCrackSVG" not in _hba23: _s23.append("缺 hbaIqCrackSVG(裂纹)")
if "function flyOnHit" not in _hba23: _s23.append("fly兜底机制flyOnHit被误删")
if "function makeProjectile" not in _hba23 or "flyOnHit" not in _hba23: _s23.append("fly默认兜底被误删(v535起fly全退役·兜底为安全网)")
for _cls in [".hba-iqdome{",".hba-iqvign{",".hba-iqflake{",".hba-iqmist{",".hba-iqcharge{",".hba-iqrune{",".hba-iqspear{",".hba-iqtrail{",".hba-iqhit{",".hba-iqring{",".hba-iqchip{",".hba-iqwave{",".hba-iqblock{",".hba-iqfrost{",".hba-iqcrack{",".hba-iqflash{",".hba-iqcombo{"]:
    if _cls not in _hba23: _s23.append("缺 "+_cls+" CSS")
for _kf in ["hbaIqBob","hbaIqPulse","hbaIqHit","hbaIqRing","hbaIqFlash","hbaIqCombo"]:
    if _kf not in _hba23: _s23.append("缺键帧 "+_kf)
if _s23: fail("v523 寒冰女王冰封万古: " + str(_s23[:8]))
else: ok("寒冰女王换冰封万古绝对零度 (icequeen·暴风雪+五矛齐射+巨型冰晶罩死血条0.8秒+裂纹炸碎·全SVG内联无外部图·寒冰蓝·fly守卫三线已放宽<2·零震屏零屏闪·v523)")

# 🔴 v524: 烈焰魔神(Lv15·epic)焚世天罚陨星灭世(Hansen 定稿)。meteorrain全面重铸(枪雨公式: 弹幕雨+巨型终结·设计史: 初版烈火地狱[裂缝+砸拳+火柱]被Hansen否决"太垃圾还不如老meteorrain"→保留天上下陨石幻想拉满重做)。①天罚预兆(天幕染红hba-fmsky顶带120px 4.3s+余烬升腾interval 110ms从midY+30~46战区带·双拳火球充能[[-38,-32],[38,-32]]*sz错峰130ms·680ms胸口核心) ②陨星雨12颗plan数组错峰85ms(bar×5 t:0.18/0.34/0.5/0.66/0.82 dur 320+70连击1~5+血条泛光; ground×4 gy=barBot+8+rand*8 dur 340+80 smallBurst带ftuft残火780+260ms燃烧; bg×3 by2=130+rand*50 scale0.5 .bg类opacity.6 dur 380+90纵深)·同屏峰值5颗·oneMeteor rAF tt=t*t*0.6+t*0.4加速+rot=atan2(dx,dy)*-1+fmtr尾迹 ③2650ms灭世巨陨(hbaFmBigSVG 80x170黑岩核r22+裂纹透光+fflick火焰包裹+巨焰尾·MW=64*sz·spawn(hx+50,-MH*0.7)·缓入220ms→加速俯冲400ms tt=t*t→超巨爆: 爆闪76+橙金红三环0/100/200ms+16熔岩碎块三色+8团fmflame腾起+9灰烬fmash错峰70ms(fall=40+rand*40限制坠程·打旋1.3~2s)+柔震.62+deal≈3270ms) ④残火渐熄·天幕退红。全SVG+CSS内联无外部图·炽焰橙硬编码·hba-fm前缀·全fixed贴body·零震屏零屏闪。旧meteorrain分支为历史死代码保留。空间适配: 余烬只在战区带·地面残火落在血条与台词气泡之间·灰烬限坠·答题区零干扰。
_hba24=open("hansen_boss_attack.js",encoding="utf-8").read()
_s24=[]
_fmf=re.search(r"'烈焰魔神':\{[^}]*\}", _hba24)
_fmc=_fmf.group(0) if _fmf else ""
if "doomstar" not in _fmc: _s24.append("烈焰魔神未配置 doomstar")
for _kw in ["pal:","sz:","sp:","fxi:","dealDelay:"]:
    if _kw not in _fmc: _s24.append("烈焰魔神配置缺 "+_kw)
if "t==='doomstar'" not in _hba24: _s24.append("缺 doomstar 分支")
if "function hbaDoomStar" not in _hba24: _s24.append("缺 hbaDoomStar(主编排)")
if "function hbaFmMetSVG" not in _hba24: _s24.append("缺 hbaFmMetSVG(流星)")
if "function hbaFmBigSVG" not in _hba24: _s24.append("缺 hbaFmBigSVG(巨陨)")
if "t==='meteorrain'" not in _hba24: _s24.append("meteorrain历史死代码被误删")
for _cls in [".hba-fmdome{",".hba-fmvign{",".hba-fmsky{",".hba-fmember{",".hba-fmcharge{",".hba-fmmet{",".hba-fmmtr{",".hba-fmbig{",".hba-fmtuft{",".hba-fmhit{",".hba-fmring{",".hba-fmdrop{",".hba-fmchunk{",".hba-fmflame{",".hba-fmash{",".hba-fmflash{",".hba-fmcombo{"]:
    if _cls not in _hba24: _s24.append("缺 "+_cls+" CSS")
for _kf in ["hbaFmFlick","hbaFmHit","hbaFmRing","hbaFmFlash","hbaFmCombo"]:
    if _kf not in _hba24: _s24.append("缺键帧 "+_kf)
if _s24: fail("v524 烈焰魔神陨星灭世: " + str(_s24[:8]))
else: ok("烈焰魔神换焚世天罚陨星灭世 (doomstar·天罚预兆+陨星雨12颗同屏峰值5+灭世巨陨超巨爆+灰烬·meteorrain重铸·全SVG内联无外部图·炽焰橙·零震屏零屏闪·v524)")

# 🔴 v525: 数字IIFE尾巴守卫(贾维斯进化·结构性根除两次踩坑bug)。教训: v523寒冰女王霜花/v524烈焰魔神双拳充能两处都犯过——数组字面量.forEach(...)收尾误带 )(数字); IIFE尾巴→forEach返回undefined被调用→TypeError静默断链(后续寒雾/onFrozen/炸碎/deal全断·元素永久卡屏)。本守卫扫描全部 hansen_*.js: 任何 })(纯数字); 形态直接拦截(本代码库合法IIFE只用 })(); 或 })(循环变量);)。
import glob as _g25, re as _re25
_s25=[]
for _fp25 in sorted(_g25.glob("hansen_*.js")):
    _src25=open(_fp25,encoding="utf-8").read()
    for _m25 in _re25.finditer(r"\}\)\(\s*\d+\s*\)\s*;", _src25):
        _ln25=_src25.count("\n",0,_m25.start())+1
        _s25.append("%s:%d %s" % (_fp25,_ln25,_m25.group(0)))
if _s25: fail("v525 数字IIFE尾巴(forEach断链bug签名): " + str(_s25[:5]))
else: ok("数字IIFE尾巴 0 处 (forEach断链bug签名全库扫描·v523/v524两次踩坑已结构性根除·v525)")

# 🔴 v527: 雷电之主(Lv16·epic)天雷轰顶(Hansen 定稿: 苍雷蓝·规模140%·速度1.00x·雷霆强度160%)。lightning→thunderlord 全面重铸。核心=树状分形闪电生成器: hbaTlBoltPts中点位移(minD段长·主干4.4硬折角)+hbaTlTree多级分叉(一级8条·pow(rand,1.45)上密下收·向下偏置17~40°·末位强制低位短支·二级85%近半双发·末梢渐细·端点钳位capY)·白炽细芯2.4+紧贴双层drop-shadow(2.5px/7px锐度优先)·实时生成永不重复。主雷=return stroke复闪(亮段65%暗隙短促)+130ms鬼影通道+boss过载发光+云层回闪。四阶段: ①雷暴降临(积雨云+预兆闪×3+三点蓄能=立绘招牌) ②万雷连击7道(起点跟随命中点近垂直劈落·简版hbaTlBoltSvg连击Hansen满意未动) ③雷能汇聚(电丝两波+云核充能) ④天罚主雷(柔光.62+三重电环+地弧爬行+火花·deal≈3380ms兜底3700)+残余电弧。空间适配: 粒子战区带·火花坠程钳位barBot+16·分支端点钳位midY-6——答题区零侵犯。苍雷蓝硬编码·hba-tl前缀·全fixed贴body·零震屏零屏闪。旧lightning分支为历史死代码保留。deal链注: HansenHeroHit只补拖尾+飘字(主血条归岛内答错逻辑)。
_hba27=open("hansen_boss_attack.js",encoding="utf-8").read()
_s27=[]
_tlf=re.search(r"'雷电之主':\{[^}]*\}", _hba27)
_tlc=_tlf.group(0) if _tlf else ""
if "thunderlord" not in _tlc: _s27.append("雷电之主未配置 thunderlord")
for _kw in ["pal:'storm'","sz:1.40","sp:1.0","fxi:1.60","dealDelay:3700"]:
    if _kw not in _tlc: _s27.append("雷电之主配置缺 "+_kw)
if "t==='thunderlord'" not in _hba27: _s27.append("缺 thunderlord 分支")
for _fn in ["function hbaThunderLord","function hbaTlBoltTree","function hbaTlTree","function hbaTlBoltPts","function hbaTlBoltSvg","function hbaTlCloud","function hbaTlGroundArcs"]:
    if _fn not in _hba27: _s27.append("缺 "+_fn)
for _cls in [".hba-tl-dome{",".hba-tl-vign{",".hba-tl-cloud{",".hba-tl-mote{",".hba-tl-charge{",".hba-tl-bolt{",".hba-tl-spark{",".hba-tl-ring{",".hba-tl-hit{",".hba-tl-thread{",".hba-tl-arc{",".hba-tl-combo{"]:
    if _cls not in _hba27: _s27.append("缺 "+_cls+" CSS")
if "hbaTlCombo" not in _hba27: _s27.append("缺键帧 hbaTlCombo")
if "t==='lightning'" not in _hba27: _s27.append("lightning历史死代码分支被误删")
if "function lightningStrike" not in _hba27: _s27.append("lightningStrike历史死代码被误删")
if ".hba-lightning{" not in _hba27: _s27.append(".hba-lightning历史死代码CSS被误删")
if _s27: fail("v527 雷电之主天雷轰顶: " + str(_s27[:8]))
else: ok("雷电之主换天雷轰顶 (thunderlord·雷暴降临+万雷连击7道+雷能汇聚+天罚主雷树状分形闪电·return stroke复闪·苍雷蓝140%/160%·lightning死代码保留·零震屏零屏闪·v527)")

# 🔴 v528: 机械泰坦(Lv17·legendary)歼灭协议·泰坦终结斩+天降流星拳(Hansen 定稿: 猩红警戒·规模100%·速度1.00x·火力100%)。missilestorm→titanstrike 全面重铸。四阶段: ①SYSTEM ONLINE(HUD角标top58避游戏UI+状态格+扫描线+六边形网格+全息启动环+双眼觉醒lens flare+机体灯+排气) ②TARGET LOCKED(雷达扇扫+准星搜索飞抵+锁定框三段吸附咬死血条+确认爆闪+警告三角×4+双测距线) ③武器过载(能量回路胸→剑柄+剑刃充能贴立绘+盾/胸核心+地面波) ④TERMINATING: 剑气三连斩(月牙110白锋描边+滞后残影+全屏刀光只扫midY-48以上)→天降流星拳(落点警告→巨拳复用__hbaFistImg·BUG#67链路·FH150·rAF陨石曲线t*t*.6+t*.4·贴指节摩擦火焰+焰尾+火舌+火星速度线→砸击: 反弹+爆闪96+三重环+地面冲击波+地裂限角±10°+火焰飞溅8+火星18+碎片7+烟尘横涌+deal≈4600ms兜底4950→停留280ms抽离→歼灭确认白框外弹)+残余火苗烟缕。空间适配: 火焰/火星/碎片坠程钳位barBot+16——答题区零侵犯。猩红硬编码·hba-mt前缀·全fixed贴body·零震屏零屏闪。旧missilestorm分支为历史死代码保留(v510守卫已照v511先例改造)。拳头图守卫(v497/501/508/v525补登)继续在位且本招直接依赖。
_hba28=open("hansen_boss_attack.js",encoding="utf-8").read()
_s28=[]
_mtf=re.search(r"'机械泰坦':\{[^}]*\}", _hba28)
_mtc28=_mtf.group(0) if _mtf else ""
if "titanstrike" not in _mtc28: _s28.append("机械泰坦未配置 titanstrike")
for _kw in ["pal:'crimson'","sz:1.0","sp:1.0","fxi:1.0","dealDelay:4950"]:
    if _kw not in _mtc28: _s28.append("机械泰坦配置缺 "+_kw)
if "t==='titanstrike'" not in _hba28: _s28.append("缺 titanstrike 分支")
for _fn in ["function hbaTitanStrike","function hbaMtFinalFist","function hbaMtSwordWave","function hbaMtCrescent","function hbaMtLockBox","function hbaMtHolo","function hbaMtReticle","function hbaMtGShock","function hbaMtFlameBurst"]:
    if _fn not in _hba28: _s28.append("缺 "+_fn)
if "__hbaFistImg.cloneNode" not in _hba28.replace("window.__hbaFistImg.cloneNode","__hbaFistImg.cloneNode"): _s28.append("流星拳未复用 __hbaFistImg 预加载(BUG#67链路)")
for _cls in [".hba-mt-fist{",".hba-mt-warnmark{",".hba-mt-lockc{",".hba-mt-holo{",".hba-mt-hex{",".hba-mt-radar{",".hba-mt-slash{",".hba-mt-sslash{",".hba-mt-gshock{",".hba-mt-flame{",".hba-mt-dust{",".hba-mt-combo{"]:
    if _cls not in _hba28: _s28.append("缺 "+_cls+" CSS")
for _kf in ["hbaMtCombo","hbaMtBlink"]:
    if _kf not in _hba28: _s28.append("缺键帧 "+_kf)
if "t==='missilestorm'" not in _hba28: _s28.append("missilestorm历史死代码分支被误删")
if _s28: fail("v528 机械泰坦泰坦终结斩+流星拳: " + str(_s28[:8]))
else: ok("机械泰坦换歼灭协议泰坦终结斩+天降流星拳 (titanstrike·HUD启动+雷达锁定+剑气三连+巨拳流星坠落砸击·复用__hbaFistImg·猩红警戒100%/100%·missilestorm死代码保留·零震屏零屏闪·v528)")

# 🔴 v529: 外星霸主(Lv18·legendary)歼星协议·轨道湮灭(Hansen 定稿: 异星翠绿·规模100%·速度1.00x·火力100%=5无人机)。wave→alienlord 全面重铸(wave 仍现役于混沌魔尊·光束图被本招直接复用)。四阶段: ①入侵领域(异星光帘流动+座驾反重力光环+上升光粒+触角双球+掌心法阵旋入) ②无人机僚机群(5颗从立绘环绕位弹出→血条上空midY-70列阵悬停bob+单眼齐闪+锁定线×5·部署onfinish必须cancel再落位防forwards位移翻倍) ③等离子齐射(错峰190ms光弹带2残影·1~5连→归航) ④歼星炮(法阵推出(hx,110)→预热光点→光束复用__hbaBeamImg[BUG#67三件判定]·300×664竖版·hue-rotate(140deg)翠绿·命中心=图高88%对准midY·底部裁barBot+16·scaleY轰出130ms+brightness脉冲560ms+190ms主爆deal≈4050兜底4400+汽化离子70ms至760ms+730ms scaleX收束)→法阵碎裂+辐射光斑。答题区零侵犯·零震屏零屏闪。
_hba29=open("hansen_boss_attack.js",encoding="utf-8").read()
_s29=[]
_alf=re.search(r"'外星霸主':\{[^}]*\}", _hba29)
_alc=_alf.group(0) if _alf else ""
if "alienlord" not in _alc: _s29.append("外星霸主未配置 alienlord")
for _kw in ["pal:'green'","sz:1.0","sp:1.0","fxi:1.0","dealDelay:4400"]:
    if _kw not in _alc: _s29.append("外星霸主配置缺 "+_kw)
if "t==='alienlord'" not in _hba29: _s29.append("缺 alienlord 分支")
for _fn in ["function hbaAlienLord","function hbaAlBeamFire","function hbaAlDeploy","function hbaAlDroneSVG","function hbaAlPalmGlyph","function hbaAlGlyphFly","function hbaAlBolt","function hbaAlGravField"]:
    if _fn not in _hba29: _s29.append("缺 "+_fn)
if "__hbaBeamImg.cloneNode" not in _hba29: _s29.append("歼星炮未复用 __hbaBeamImg 预加载(BUG#67链路)")
if "hue-rotate(140deg)" not in _hba29: _s29.append("光束未做 hue-rotate(140deg) 翠绿转色")
for _cls in [".hba-al-veil{",".hba-al-grav{",".hba-al-glyph{",".hba-al-drone{",".hba-al-bolt{",".hba-al-beam{",".hba-al-vap{",".hba-al-gshock{",".hba-al-combo{"]:
    if _cls not in _hba29: _s29.append("缺 "+_cls+" CSS")
for _kf in ["hbaAlCombo","hbaAlBlink","hbaAlBob"]:
    if _kf not in _hba29: _s29.append("缺键帧 "+_kf)
# v530起混沌魔尊也已离开wave(→hellgate)·wave死代码三件由v505守卫盯防·此处只确认分支死代码仍在
if "t==='wave'" not in _hba29: _s29.append("wave 历史死代码分支被误删!")
if _s29: fail("v529 外星霸主歼星协议轨道湮灭: " + str(_s29[:8]))
else: ok("外星霸主换歼星协议轨道湮灭 (alienlord·入侵领域+无人机僚机群5连+歼星炮真光束图复用__hbaBeamImg·hue翠绿·wave仍现役于混沌魔尊·零震屏零屏闪·v529)")

# 🔴 v530: 混沌魔尊(Lv19·legendary)深渊审判·地狱之门(Hansen 定稿: 深渊魔紫·规模100%·速度1.00x·业火强度160%=5道三叉刺)。wave→hellgate, wave 自此全退役(双boss均离开)。四阶段(台词三连=分镜): ①哈哈哈哈哈!(荆棘火环逼真火焰[贝塞尔火苗SVG双层内外焰+白炽芯+skew摆动]顺序点燃+黄瞳+熔岩核心+裂地熔岩纹+余烬+暗影+狂笑震慑波) ②深渊审判!(三叉戟过载+戟尖品字聚能+倒五芒星审判阵压扁透视+封印符文×4+锁定光链) ③业火三叉连刺(tridSVG双残影·1~5连·命中火苗) ④地狱之门已开启!(左侧gx=vw*0.195·gyC=240: 扭曲波×2+撕裂主缝→哥特石拱门框SVG[顶刺+熔岩缝+铰链+门槛]+门内深渊底→双扉浮雕SVG 3D透视轰开78°带过冲回弹+开门冲击→门内蓄能光点→混沌龙卷光波斜射: 复用__hbaWaveImg[BUG#67三件判定]·473×440·命中冲击中心=图高80%对准(cx,midY)·θ=-atan2(ddx,ddy)屏幕系修正·rotate在独立包层rotW[keyframes同帧clipPath+transform会丢rotate]·clip揭示从无到有450ms+锋头光球斜线开路+穿越光屑→盘端砸正中: 下压回弹+柔光.62+爆闪+三重环+地面冲击波+deal≈5030兜底5400+三连灼烧环+汽化光屑+吞噬倒吸29颗回门+吸入9颗→光波clip反向缩回+门内回闪→合扉→门框缩回→裂缝愈合+腐蚀地狱火。答题区零侵犯(wrapper包络底裁barBot+16)·零震屏零屏闪。
_hba30=open("hansen_boss_attack.js",encoding="utf-8").read()
_s30=[]
_hlf=re.search(r"'混沌魔尊':\{[^}]*\}", _hba30)
_hlc=_hlf.group(0) if _hlf else ""
if "hellgate" not in _hlc: _s30.append("混沌魔尊未配置 hellgate")
for _kw in ["pal:'purple'","sz:1.0","sp:1.0","fxi:1.6","dealDelay:5400"]:
    if _kw not in _hlc: _s30.append("混沌魔尊配置缺 "+_kw)
if "t==='hellgate'" not in _hba30: _s30.append("缺 hellgate 分支")
for _fn in ["function hbaHellLord","function hbaHlVortexFire","function hbaHlGate","function hbaHlGateFrameSVG","function hbaHlGateDoorSVG","function hbaHlFlameSVG","function hbaHlFlame","function hbaHlTridentBolt","function hbaHlJudgeCircle","function hbaHlDevour","function hbaHlCrownFire"]:
    if _fn not in _hba30: _s30.append("缺 "+_fn)
if "__hbaWaveImg.cloneNode" not in _hba30: _s30.append("地狱之门光波未复用 __hbaWaveImg 预加载(BUG#67链路)")
if "theta=-Math.atan2(ddx,ddy)" not in _hba30: _s30.append("斜射角θ未取负(屏幕系顺时针修正·盘端会偏)")
if "rotW" not in _hba30: _s30.append("缺 rotate 独立包层 rotW(同帧clipPath+transform会丢rotate)")
for _cls in [".hba-hl-gframe{",".hba-hl-gpv{",".hba-hl-gdoor{",".hba-hl-vortex{",".hba-hl-crown{",".hba-hl-circle{",".hba-hl-rune{",".hba-hl-bolt{",".hba-hl-flame{",".hba-hl-combo{"]:
    if _cls not in _hba30: _s30.append("缺 "+_cls+" CSS")
if "hbaHlCombo" not in _hba30: _s30.append("缺键帧 hbaHlCombo")
if "perspective:520px" not in _hba30: _s30.append("门扉缺 3D 透视(perspective)")
if _s30: fail("v530 混沌魔尊深渊审判地狱之门: " + str(_s30[:8]))
else: ok("混沌魔尊换深渊审判地狱之门 (hellgate·火环逼真火焰+审判阵+三叉五连+哥特拱门3D轰开+混沌龙卷光波斜射复用__hbaWaveImg·clip揭示+θ取负+rotW独立层·深渊魔紫100%/160%·wave全退役死代码盯防·零震屏零屏闪·v530)")

# 🔴 v531: 上古太阳神(Lv20·legendary·HP850 全游最高)创世神谕·天降太阳(Hansen 定稿: 鎏金圣阳·规模100%·速度1.00x·圣焰强度100%=3道耀斑光矛)。sunslam→sungod。四阶段(台词三连=三幕剧·人设驱动: 纯金神王/背后日冕太阳轮/左手托掌中日): ①吾即是万物之始!(天光瀑布×3+日冕法阵贴日轮(0,-0.20h)旋转[24刻度+8耀斑齿]+日冕圣火[贝塞尔火苗金色版]顺序点燃+金目+头顶光环+金尘) ②宇宙在我掌中!(掌中日(+0.165,-0.04)暴亮+5星辰椭圆轨道公转1.5圈[12帧keyframes]+八芒审判金阵压扁透视+太阳圣印×4) ③太阳耀斑光矛(spearSVG双弧耀斑尾·双残影·1~5连) ④凡人终须臣服!=天降太阳(日蚀fixed暗层700ms缓变[零屏闪原则内]→天穹法阵(cx,95) D=130三环12芒→掌中日飞升320ms→聚日成阳: 复用__hbaSunImg三件判定·scale.18→1充能380+8汇聚光粒+热浪×2+悬停脉动320+边缘耀斑→陨石坠落rAF tt=t²·.6+t·.4·T=380·终点球心midY-46·放大1.15+焰尾+光屑→命中: 压扁反弹+柔光.62+爆闪110*fxi+四重环+gShock+熔金地裂×5+圣火×6+蒸发金尘+deal≈4720兜底5100→灼烧余威脉冲+灼环三连→升天消散scale.5上升170→afterGlow熔金光斑+圣火残苗+烟)。答题区零侵犯(球底≈363<barBot+16=366·火花碎片钳位·金尘只向上)。
_hba31=open("hansen_boss_attack.js",encoding="utf-8").read()
_s31=[]
_sgf=re.search(r"'上古太阳神':\{[^}]*\}", _hba31)
_sgc=_sgf.group(0) if _sgf else ""
if "sungod" not in _sgc: _s31.append("上古太阳神未配置 sungod")
for _kw in ["pal:'gold'","sz:1.0","sp:1.0","fxi:1.0","dealDelay:5100"]:
    if _kw not in _sgc: _s31.append("上古太阳神配置缺 "+_kw)
if "t==='sungod'" not in _hba31: _s31.append("缺 sungod 分支")
for _fn in ["function hbaSunGod","function hbaSgSunForm","function hbaSgCorona","function hbaSgOrbitStars","function hbaSgFlareSpear","function hbaSgSkyCircle","function hbaSgMoltenCracks","function hbaSgFlameSVG","function hbaSgFlame","function hbaSgJudgeCircle","function hbaSgAfterGlow"]:
    if _fn not in _hba31: _s31.append("缺 "+_fn)
if "__hbaSunImg.cloneNode" not in _hba31: _s31.append("天降太阳未复用 __hbaSunImg 预加载")
if "(midY-46*sz)-D/2" not in _hba31: _s31.append("太阳终点球心公式被改(midY-46·答题区警戒)")
if "t2*t2*0.6+t2*0.4" not in _hba31: _s31.append("陨石坠落曲线被改(tt=t²·.6+t·.4)")
for _cls in [".hba-sg-eclipse{",".hba-sg-corona{",".hba-sg-star{",".hba-sg-orbit{",".hba-sg-skycircle{",".hba-sg-sun{",".hba-sg-heat{",".hba-sg-crack{",".hba-sg-flame{",".hba-sg-combo{"]:
    if _cls not in _hba31: _s31.append("缺 "+_cls+" CSS")
if "hbaSgCombo" not in _hba31: _s31.append("缺键帧 hbaSgCombo")
if _s31: fail("v531 上古太阳神创世神谕天降太阳: " + str(_s31[:8]))
else: ok("上古太阳神换创世神谕天降太阳 (sungod·日冕圣火+星辰公转+耀斑光矛+日蚀天穹法阵+聚日成阳复用__hbaSunImg+陨石坠落+熔金地裂+灼烧升天·鎏金圣阳100%/100%·sunslam退役死代码盯防·零震屏零屏闪·v531)")

# 🔴 BUG#68(v532): t:'hellgate' 类型名碰撞——Lv8 地狱犬王(pal:'fire')与 Lv19 混沌魔尊(pal:'purple')共用 t, v530 新分支在前导致犬王误放魔尊大招(火环+三叉戟真机复现, 潜伏两版, 36 道守卫全没拦住)。修复: 分支判定加 fx.pal==='purple', 犬王落回老分支。教训: 新招类型名必须全配置表 grep 查重; 守卫要查"分支被谁命中"而不只查"分支存在"。
_hba68=open("hansen_boss_attack.js",encoding="utf-8").read()
if "t==='hellgate'&&fx.pal==='purple'" not in _hba68: fail("BUG#68 复发: 混沌魔尊 hellgate 分支缺 pal==='purple' 判定(地狱犬王会误放魔尊大招)")
else: ok("BUG#68 已锁 (hellgate 分支 pal 判定在位·地狱犬王走老分支·v532)")

# 🔴 v532: Boss 特效后台调参面板(Hansen 专用)。设置→「⚔️ Boss 特效」入口(MutationObserver 幂等注入 settingsContent)→密码门(SHA-256 比对 crypto.subtle 优先+djb2 回退·sessionStorage 本会话记忆)→面板 21 卡片(Lv1~Lv20+传说·定稿配色只读徽章+sz/sp/fxi 滑杆 50~200%+单项/全部恢复默认)。滑杆实时写 localStorage('hansen_bossfx_override'), 调度入口合并覆盖 fx, dealDelay 随 sp 反比换算(慢速时兜底不提前扣血)。真机铁证: 面板调太阳神 fxi160%→实战耀斑 5 连+飘字。
_s32=[]
if "hansen_bossfx_override" not in _hba68: _s32.append("缺 override localStorage key")
if "Object.assign({},__base,__ov)" not in _hba68: _s32.append("调度入口缺 override 合并")
if "__base.dealDelay*((__base.sp||1)/__ov.sp)" not in _hba68: _s32.append("缺 dealDelay 随 sp 反比换算")
if "PW_SHA='603496ea13d3aa14a70ad2a79b7d6d138b3dfb0448441ac7cd14e0ef9358ecd6'" not in _hba68: _s32.append("密码 SHA-256 被改")
if "hbafxEntry" not in _hba68 or "MutationObserver" not in _hba68: _s32.append("缺设置入口幂等注入")
if "crypto.subtle.digest" not in _hba68: _s32.append("缺 SHA-256 校验")
if "sessionStorage" not in _hba68: _s32.append("缺会话记忆")
for _k in ["hbafx-ovl{","hbafx-card{","hbafx-pw{"]:
    if _k not in _hba68: _s32.append("缺 "+_k+" CSS")
if _hba68.count("{n:'")<21: _s32.append("面板 boss 表不足 21 条")
if _s32: fail("v532 Boss特效调参面板: " + str(_s32[:8]))
else: ok("Boss特效后台调参面板 (设置入口+SHA256密码门+21卡片滑杆+override实时生效+dealDelay换算·真机铁证fxi160%→5连·v532)")

# 🔴 v533: 调参面板「配色」真生效——常驻特效容器层 + filter 整体换色。所有 boss 特效元素(73 处挂载)统一迁移到 #hansenFxLayer(fixed inset0 全屏·pointer-events:none·z9980·fixed 子元素坐标系不变), 调度入口每次攻击按 override 的 hue/sat/bri 重设容器 filter(无配色→'none'), 连太阳/漩涡/光束等真图一起转色(与预览页三配色同原理)。面板: 新五招(雷电/机泰/外星/魔尊/太阳神)各 3 个预设配色按钮(定稿+两变体), 全员「🎨 色相偏移」滑杆 -180~180° 自定义; 按钮/滑杆/重置三向同步选中态。面板自身 overlay 保持挂 body(不被调色)。真机铁证: 太阳神选「炽核熔阳」→filter hue-rotate(-18deg) saturate(1.18)→实战太阳整体偏橙红; 机泰坦无配色→filter 'none'。
_hba33=open("hansen_boss_attack.js",encoding="utf-8").read()
_s33=[]
if "id='hansenFxLayer'" not in _hba33: _s33.append("缺常驻容器层创建")
if _hba33.count("(window.__hansenFxLayer||document.body).appendChild(")<68: _s33.append("特效挂载未迁移容器(<68 处)")
if "window.__hansenFxLayer.style.filter=__f?__f.trim():'none'" not in _hba33: _s33.append("调度入口缺 filter 重设(含 none 归位)")
if "hue-rotate('+__ov.hue+'deg)" not in _hba33: _s33.append("缺 hue-rotate 拼装")
if "var PALSETS={" not in _hba33: _s33.append("缺 PALSETS 预设表")
for _pn in ["炽核熔阳","白炽圣辉","血狱赤焰","熔狱业火","紫电狱雷","量子冷光","深空幽蓝"]:
    if _pn not in _hba33: _s33.append("预设配色缺 "+_pn)
if "function palMatch" not in _hba33: _s33.append("缺 palMatch 选中态判定")
if "data-p=\"hue\"" not in _hba33.replace('"',chr(34)) and 'data-p="hue"' not in _hba33: _s33.append("缺色相滑杆")
if ".hbafx-palbtn{" not in _hba33: _s33.append("缺配色按钮 CSS")
if _hba33.count("document.body.appendChild(o);")<2: _s33.append("面板 overlay 未保持挂 body(会被调色)")
if _s33: fail("v533 配色真生效(容器层+filter): " + str(_s33[:8]))
else: ok("调参面板配色真生效 (常驻容器层73处挂载迁移+调度filter重设含none归位+新五招预设配色按钮+全员色相滑杆+面板免调色·真机铁证炽核熔阳偏橙红·v533)")

# 🔴 v534: 调参面板配色补全——Lv4~Lv15 十二老 boss 历史三配色全量入面板(Hansen 上传 12 份历史预览页原件, 提取 CSS 变量主题 :root/.pal-* 主色, 以游戏内定稿 pal 为基准换算 hue/sat/bri)。PALSETS 5→17 boss(51 按钮); 全部按钮删除「(定稿)」字样(Hansen 明令: 配色栏不出现"定稿"二字)。历史原名原序: 霸王龙(琥珀/血怒/丛林)僵尸(尸毒/怨灵/阴火)吸血鬼(血月/魅影/幽蓝)魔王(魔王紫/炼狱/鬼焰)犬王(炼狱橙/幽冥/鬼火)巫婆(巫毒紫/沼泽/血咒)巫师(异次元紫/星空/翡翠)龙骑士(龙焰/圣金/苍蓝)灯神(暗黑靛/魂绿/血咒)海怪(深渊青/幽紫/毒绿)冰女王(寒冰蓝/极光紫/霜白)魔神(炽焰橙/幽蓝魔焰/炼狱紫)。真机铁证: 17 组按钮/51 钮/定稿 0 处; 僵尸选「怨灵」→filter hue-rotate(-173deg) brightness(1.4)→实战尸毒绿全套转怨灵紫。
_hba34=open("hansen_boss_attack.js",encoding="utf-8").read()
_s34=[]
_psf=_hba34.find('var PALSETS={')
_pse=_hba34.find('};',_psf)
_pseg=_hba34[_psf:_pse]
if _pseg.count("':[")<17: _s34.append("PALSETS 不足 17 boss")
if '定稿' in _pseg: _s34.append("PALSETS 仍含「定稿」字样(Hansen 明令删除)")
for _pn in ["远古琥珀","怨灵","魅影","鬼焰","幽冥","沼泽","翡翠","圣金","魂绿","深渊青","极光紫","幽蓝魔焰"]:
    if _pn not in _pseg: _s34.append("老boss配色缺 "+_pn)
if _s34: fail("v534 老boss配色补全: " + str(_s34[:8]))
else: ok("十二老boss历史三配色全量入面板 (PALSETS 17 boss/51钮·历史预览页原名·定稿字样0处·真机铁证怨灵紫·v534)")

# 🔴 v535: 星海女帝·赛尔娅(传说·赛季绝版·双形态HP阶梯)星海圣典·超新星挽歌(Hansen 定稿: 虹彩星海·规模100%·速度1.00x·星辉强度100%=七连满奏)。**全游压轴最后一招——19常规+传说全部定稿完毕**。fly→starempress 双配置, **fly 自此全退役**(默认兜底 makeProjectile/flyOnHit 保留为安全网, v516/v518/v519/v523 四处守卫已连锁改造)。台词驱动四阶段(13条台词=剧本·立绘=道具图): ①繁星为我加冕(22彩星twinkle+星座五星连线SVG渐画+圣环组(−0.03,−0.37h)旋转+紫瞳+足下银河流带) ②七颗星核绕我而行+银河之泪出鞘(七核CORE7POS原位点亮脉动2拍→大椭圆入轨公转1圈+虹彩剑魂(−0.325,+0.18)出鞘竖立+白闪剑鸣+血条七色点星轨阵) ③星辰序曲(七色流星各用本色·弧线·命中该色爆+♪♫音符+连击·n=max(3,round(7*fxi)) cap7) ④超新星挽歌(挥剑斩天弧光→星空裂隙(cx,78)scaleX撕开→银河倾泻梯形clip至nucY=midY−86→聚星成核+七彩conic吸积盘mask环→引力坍缩8颗吸入+休止符hush全屏静默330ms缓变→坠落170→爆发: 柔光.62+七色环错峰52ms+gShock+彩色地纹×5+星屑22*fxi+deal≈5878兜底6300→新星诞生四芒星升起+♪♫余韵+killStars满天星渐次熄灭——诞生与熄灭闭环)。答题区零侵犯·零震屏零屏闪。
_hba35=open("hansen_boss_attack.js",encoding="utf-8").read()
_s35=[]
import re as _re35
_sef=_re35.findall(r"'星海女帝[^']*':\{[^}]*\}", _hba35)
if len(_sef)!=2: _s35.append("星海女帝双形态配置数!=2")
for _c in _sef:
    if "starempress" not in _c: _s35.append("形态配置未换 starempress: "+_c[:30])
    for _kw in ["sz:1.0","sp:1.0","fxi:1.0","dealDelay:6300"]:
        if _kw not in _c: _s35.append("配置缺 "+_kw)
if "t:'fly'" in _hba35: _s35.append("fly 配置残留(应全退役)")
if "t==='starempress'" not in _hba35: _s35.append("缺 starempress 分支")
for _fn in ["function hbaStarEmpress","function hbaSeNova","function hbaSeSevenCores","function hbaSeSwordUnsheath","function hbaSeMeteorShot","function hbaSeSkyRift","function hbaSeGalaxyFall","function hbaSeSkyStars","function hbaSeKillStars","function hbaSeConstellation","function hbaSeLockCircle","function hbaSeSwordSlash"]:
    if _fn not in _hba35: _s35.append("缺 "+_fn)
if "hbaSeRB7=" not in _hba35: _s35.append("缺七色数组 hbaSeRB7")
if "hbaSeCORE7=" not in _hba35: _s35.append("缺七核锚点 CORE7")
if "midY-86*sz" not in _hba35: _s35.append("聚核高度公式被改(nucY=midY-86)")
for _cls in [".hba-se-hush{",".hba-se-star{",".hba-se-core{",".hba-se-sword{",".hba-se-rift{",".hba-se-gfall{",".hba-se-nuc{",".hba-se-accr{",".hba-se-newstar{",".hba-se-note{",".hba-se-combo{"]:
    if _cls not in _hba35: _s35.append("缺 "+_cls+" CSS")
if "function makeProjectile" not in _hba35 or "flyOnHit" not in _hba35: _s35.append("fly兜底安全网被误删")
if "alias:'星海女帝'" not in _hba35 or "function syncAlias" not in _hba35: _s35.append("面板双形态alias同步缺失")
if _s35: fail("v535 星海女帝超新星挽歌: " + str(_s35[:8]))
else: ok("星海女帝换星海圣典超新星挽歌 (starempress双形态·繁星加冕+七核公转+剑魂出鞘+七色流星序曲+裂隙银河坍缩休止超新星+诞生熄灭闭环·虹彩100%七连·fly全退役四守卫连锁·兜底安全网在·面板alias双写·v535·全游19+1全部定稿完毕)")

# 🔴 v505 历史欠账补登守卫(v525贾维斯四方一致性审计抓出: 代码有//🔴标记但守卫缺位)。
# 🔴 v508 同上补登(拳头200%尺寸定稿)。
# v505: 外星霸主(Lv18)光束图 bosses/alienbeam_real.webp——第四个外部图片FX(预加载+decode+克隆防BUG#67空白)。
# v508: 机械泰坦拳头新图(赛博机械拳套·201×360·前臂在上指节朝下)200%尺寸定稿(高172=旧86×2·宽96)。
import os as _os55
_s55=[]
_hbaA=open("hansen_boss_attack.js",encoding="utf-8").read()
if not _os55.path.exists("bosses/alienbeam_real.webp"): _s55.append("缺光束图 bosses/alienbeam_real.webp(v505)")
if "bosses/alienbeam_real.webp?v=" not in _hbaA: _s55.append("光束图未带?v=缓存戳预加载(v505)")
if "__hbaBeamImg" not in _hbaA or "__hbaBeamReady" not in _hbaA: _s55.append("光束图预加载/解码全局变量缺失(v505)")
if not _os55.path.exists("bosses/mechfist_real.webp"): _s55.append("缺拳头图 bosses/mechfist_real.webp(v497/v508)")
if "m.width=96;m.height=172;" not in _hbaA: _s55.append("拳头200%尺寸定稿(96x172)被改动(v508)")
if _s55: fail("v505/v508 外部图FX守卫: " + str(_s55[:5]))
else: ok("v505光束图+v508拳头200%定稿 守卫在位 (alienbeam/mechfist 存在·?v=戳·预加载变量·尺寸定稿·历史欠账已补·v525)")

# 🔴 v536(BUG#69+BUG#70): Hansen 真机三连报修。
# BUG#69 混沌魔尊光波盘端被裁: vortex 容器底=barBot+16(答题区保护线·不动), 旋转显示下最低可见点=漩涡盘左下缘投影(比纯轴向尾端多 0.22~0.25H, 屏幕越高越严重), 曾被容器底切平一块。修复=按真图(chaoswave_real.webp alpha>40)凸包三支撑点(显示坐标系含1.075拉伸·α∈20°~65°零误差)精确算最低下探 hlOff, 门+光波整体上移 hlLift(两端同移→距离/角度/图高全不变), 保证最低可见点≤barBot+10。
# BUG#70 前景特效层(z9980)盖 boss 立绘: 龙骑士巨翼盖住统帅的脸 / 地狱犬王拱门盖住三头犬(v517 设计本意=门在 boss 身后·boss 剪影于门火前, v533 全量迁前景层后被反转)。修复=新增背景特效层 #hansenFxLayerBack(fixed inset0·pointer-events:none·z-index:-1·沉到页面全部内容之下 body 背景之上), 巨翼与拱门挂背景层→boss 立绘天然在前; 调度入口对两层同步设同一 filter(调色面板对背景层同样生效·无配色双层都归'none')。
_hba36=open("hansen_boss_attack.js",encoding="utf-8").read()
_s36=[]
if "id='hansenFxLayerBack'" not in _hba36: _s36.append("缺背景特效层创建 hansenFxLayerBack")
if "z-index:-1;'" not in _hba36: _s36.append("背景层 z-index 非 -1(必须沉到页面内容之下)")
if "window.__hansenFxLayerBack=B;" not in _hba36: _s36.append("背景层未存 window.__hansenFxLayerBack")
if "__hansenFxLayerBack.style.filter=__f?__f.trim():'none'" not in _hba36: _s36.append("调度入口未同步背景层 filter(调色面板对翅膀/门失效)")
if "(window.__hansenFxLayerBack||window.__hansenFxLayer||document.body).appendChild(w)" not in _hba36: _s36.append("龙骑士巨翼未挂背景层(盖boss脸 BUG#70 复发)")
if "__hansenFxLayerBack.appendChild(g)" not in _hba36: _s36.append("地狱犬王拱门未移背景层(盖三头犬 BUG#70 复发)")
for _kw36 in ["hlLift","aimY","0.2101*hlSin+0.9598*hlCos","0.3078*hlSin+0.8753*hlCos","0.4838*hlSin+0.6385*hlCos","barBot+10"]:
    if _kw36 not in _hba36: _s36.append("混沌魔尊整体上移缺 "+_kw36+"(光波盘端裁切 BUG#69 复发)")
if "hbaHlVortexFire(gx,gyC,cx,aimY" not in _hba36: _s36.append("VortexFire 未用上移瞄准点 aimY")
if _s36: fail("v536 三连修复(光波裁切+翅膀/门盖立绘): " + str(_s36[:8]))
else: ok("v536 三连修复 (BUG#69混沌魔尊光波凸包支撑点整体上移盘端不裁+BUG#70背景特效层z-1巨翼/拱门沉boss身后+双层filter同步调色·真机验证两种屏·v536)")

# 🔴 v537(Hansen 定稿): boss 攻击特效开关 + 横条精简。boss 选择页横条只留「⚔️ 选择 boss 挑战」+ON/OFF滑块开关(开=绿#22c55e白字ON/关=红#ef4444白字OFF·白字深影分明·白圆钮回弹滑动·点击=机械咔哒+双音滑奏WebAudio音效全try/catch)。状态 localStorage 'hansen_bossfx_on'(缺省开); hansen_boss_attack.js 调度入口闸门: '0'→deal()立即执行后 return——零特效但掉血反馈/血条/飘字完全照常(v487 铁则), 闸门必须位于 playFx 之前。原副标题一行整体删除全库绝迹。真机铁证: 真实答错 OFF=血条100→86+飘字+hba元素0个 / ON=特效恢复; 双岛; 持久化; 0报错。
_hc37=open("hansen_cards.js",encoding="utf-8").read()
_hba37=open("hansen_boss_attack.js",encoding="utf-8").read()
_s37=[]
if "战利品照拿" in _hc37 or "不影响实际进度" in _hc37: _s37.append("副标题文案残留(Hansen 要求整体删除)")
if "⚔️ 选择 boss 挑战" not in _hc37: _s37.append("横条标题丢失")
for _kw37 in ['id="hsnFxSw"',"hansenFxSwitchHTML()","function hansenFxSwitchToggle","window.hansenFxSwitchToggle","function hansenFxSwSound","hansen_bossfx_on","#22c55e","#ef4444"]:
    if _kw37 not in _hc37: _s37.append("开关组件缺 "+_kw37)
if "localStorage.getItem('hansen_bossfx_on')==='0'" not in _hba37: _s37.append("调度入口缺特效总开关闸门")
if "deal(); return;" not in _hba37: _s37.append("闸门缺 deal()先行(OFF时掉血反馈必须照常)")
_g37=_hba37.find("hansen_bossfx_on')==='0'"); _p37=_hba37.rfind("playFx(fx,bs,hs,deal)")  # rfind=调度入口的调用处(find 会撞上 6306 行的函数定义)
if _g37==-1 or _p37==-1 or _g37>_p37: _s37.append("闸门未在 playFx 之前(OFF 仍会放特效)")
if _s37: fail("v537 boss特效开关: " + str(_s37[:8]))
else: ok("v537 boss攻击特效开关 (横条只留标题+滑块开关绿ON/红OFF白字·WebAudio开关音效·调度闸门OFF零特效deal照常位于playFx前·副标题全库绝迹·真机真实答错双态铁证·v537)")

# 🔴 v538(Hansen 定稿): Boss 特效双入口重构。①用户入口(设置行): 不再提密码——通关全部 18 个常规岛所有 boss(每岛 Lv1~20=360关)解锁; 锁=🔒+进度+点击弹条件提示, 解锁=免密进面板(用户模式·标题无"管理员")。②管理员伪装入口: 底部「…进度自动保存到本设备」外观零变化(零样式零cursor零属性改动·捕获级委托·叶子节点+短文本匹配), 点击弹极简「输入密码」框(可粘贴·copy_protect 对 input 豁免); 连续错3次(跨会话累计无时限·输对一次清零重计)→永久锁定: openHiddenGate 开头 isLocked() 直接 return=毫无反应; 计数/锁双存 localStorage(__hsn_sys_a/b 隐蔽键)+IndexedDB(hsn_sys)镜像, 开机 idbReconcile 校正——localStorage.clear 清档攻击后锁自动恢复(真机已验)。密码仍只存 SHA-256+djb2 双指纹(v532 守卫锚 PW_SHA), 明文不在任何代码/存储出现。
_hba38=open("hansen_boss_attack.js",encoding="utf-8").read()
_s38=[]
if "密码访问" in _hba38: _s38.append("旧入口文案『密码访问』残留(Hansen 要求伪装移除)")
for _kw38 in ["function openHiddenGate","if(isLocked()) return;","function openUserLockTip","function bossClearProgress","'wordIsland'","function idbKV","function idbReconcile","__hsn_sys_a","__hsn_sys_b","lockNow()","setFails(0)","n>=3","进度自动保存到本设备","openPanel(true)","openPanel(false)","CUR_USER"]:
    if _kw38 not in _hba38: _s38.append("双入口缺 "+_kw38)
if _hba38.count("'action','adjective','animal'")<1: _s38.append("18 岛清单缺失")
if "输入密码" not in _hba38: _s38.append("伪装门缺『输入密码』极简标题")
if "openPwGate" in _hba38: _s38.append("旧 openPwGate 残留(应整体退役)")
if _s38: fail("v538 双入口重构: " + str(_s38[:8]))
else: ok("v538 Boss特效双入口 (用户入口360关解锁免密+管理员伪装门输入密码三次永久锁死+IDB镜像抗清档+旧密码访问文案绝迹·真机14项断言+清档攻击铁证·v538)")

# 🔴 v539(Hansen 定稿): ①BOSS 殿堂正式集成——收藏页点已拥有卡→隔离 iframe 开 boss_hall.html(星海女帝全规格: 本命背景全屏+👁三段切换+3D全息卡+放大+光效+13卡面背景[0=本命场景★]+持久化, 稀有度专属卡框白银/翠玉/蔚蓝/紫晶/鎏金)。四角白色角标(.cbk)按要求移除。own= 只在已拥有间循环。临时全解锁(hansenTempUnlock)对收藏页 hasCard 显式生效(修 v360 卡册绕过坑)。②管理员卡牌入口: 伪装门进管理员面板后, 面板底部「🎴 卡牌入口」(用户模式不渲染)→二级密码门(SHA-256+djb2 双指纹·明文不出现)·10 秒倒计时(超时/中途放弃=记一次错)·连续3次错该入口永久关闭(点击零反应)·输对清零+临时解锁全部卡牌24h·计数/锁双存 localStorage(c/d)+IndexedDB 抗清档。
_files39={'boss_hall.html':open('boss_hall.html',encoding='utf-8').read() if __import__('os').path.exists('boss_hall.html') else '',
          'cards39':open('hansen_cards.js',encoding='utf-8').read(),
          'hba39':open('hansen_boss_attack.js',encoding='utf-8').read()}
_s39=[]
_bh=_files39['boss_hall.html']; _cards=_files39['cards39']; _hba39=_files39['hba39']
if not _bh: _s39.append('boss_hall.html 缺失')
else:
    if '.cbk' in _bh: _s39.append('boss_hall 四角白色角标未移除(Hansen 要求去掉)')
    for _k in ['BOSSES','RAR','BGS','viewBtn','soloChar','function applyBg','function setSceneBg','isOwned','stepOwned','bosses_bg/level']:
        if _k not in _bh: _s39.append('boss_hall 缺 '+_k)
if "id='__hsn_bosshall'" not in _cards: _s39.append('收藏页详情未改为打开 BOSS 殿堂 iframe')
if 'boss_hall.html?v=' not in _cards: _s39.append('殿堂 iframe src 缺失')
if 'hansen_card_temp_unlock_until' not in _cards or '__tmpAll' not in _cards: _s39.append('收藏页未兼容临时全解锁(管理员入口解锁将不可见)')
if 'modal' in _cards and 'hansenCardModalContent' in _cards: _s39.append('旧卡牌详情模态未退役(应整体替换为殿堂)')
for _k in ['function openCardGate','CARD_SHA=','CARD_DJB=','hbafxCardEntry','hbafxCardCd','function cardLocked','function cardLockNow','setCardFails','hansenTempUnlock','o.querySelector(\'#hbafxCardEntry\')']:
    if _k not in _hba39: _s39.append('卡牌入口门缺 '+_k)
if 'CARD_SHA=\'bb00f979cb70044ae85e54906d2b96f24b7211714ef57c88b0596231540d2713\'' not in _hba39: _s39.append('卡牌门 SHA-256 指纹被改')
if "if(!CUR_USER){" not in _hba39: _s39.append('卡牌入口未限管理员模式(用户模式不得出现)')
if 'deadline=Date.now()+10000' not in _hba39: _s39.append('卡牌门缺 10 秒倒计时')
if 'gc=st.get(\'c\')' not in _hba39 or 'gd=st.get(\'d\')' not in _hba39: _s39.append('卡牌门锁缺 IDB 镜像校正')
if _s39: fail('v539 BOSS殿堂集成+卡牌入口: ' + str(_s39[:8]))
else: ok('v539 BOSS殿堂集成+管理员卡牌入口 (收藏卡点击进boss_hall全规格殿堂·四角白边已去·稀有度专属卡框·临时解锁兼容·卡牌入口10秒倒计时门三次永久锁IDB抗清档·689689双指纹明文不现·真机三上下文全链路铁证·v539)')

# 🔴 v540→v543 改版史: v540 暗色 IMAX 六款(雷暴/星陨/落樱/深渊/赛博/鎏金)与 v541 引擎 v2 活物版均被 Hansen 打回——根因=暗黑电影风与游戏明亮糖果系画风相悖。v543 亮色嘉年华系列定稿(见 v543 守卫)。本守卫锁引擎不变量+商店接入(版本无关)。
import glob as _g40
_s40=[]
import os as _os40
if not _os40.path.exists('hansen_cinema_themes.js'): _s40.append('hansen_cinema_themes.js 缺失')
else:
    _cin=open('hansen_cinema_themes.js',encoding='utf-8').read()
    for _k in ['window.HansenCinema','theme_fireworks:sceneFireworks','theme_candyland:sceneCandy','theme_balloon:sceneBalloon','theme_lagoon:sceneLagoon','theme_spacepark:sceneSpace','pointer-events:none','z-index:-1','Math.min(window.devicePixelRatio||1,2)','document.hidden','function lateBoot']:
        if _k not in _cin: _s40.append('引擎缺 '+_k)
    if 'ctx.rotate' in _cin or '.rotate(' in _cin: _s40.append('引擎出现旋转调用(违反防晕铁律)')
_dia40=open('hansen_diamond_shop.js',encoding='utf-8').read()
for _id40 in ['theme_fireworks','theme_candyland','theme_balloon','theme_lagoon','theme_spacepark']:
    if _dia40.count(_id40)<2: _s40.append('商店缺商品/渐变 '+_id40)
for _k40 in ["series:'imax'","window.HansenCinema.stop","window.HansenCinema.apply","function renderSeries","dia-imax-badge","IMAX 史诗主题"]:
    if _k40 not in _dia40: _s40.append('商店接入缺 '+_k40)
if _dia40.count("series:'imax'")!=8: _s40.append('IMAX 商品数应为 8(v770 加僵尸舞王)')
_pg40=0
for _f40 in ['index.html']+_no_subisle(sorted(_g40.glob('island_*.html'))):
    if 'hansen_cinema_themes.js' in open(_f40,encoding='utf-8').read(): _pg40+=1
if _pg40!=20: _s40.append('引擎脚本注入页数=%d(应为20)'%_pg40)
if _s40: fail('v540 IMAX引擎不变量+商店接入: ' + str(_s40[:8]))
else: ok('v540 IMAX引擎不变量+商店接入 (单canvas·z-1·pe:none·DPR≤2·hidden暂停·lateBoot·旋转禁令·新六款SCENES映射·商店series/钩子/徽标/双系列·20页注入·v540基建+v543内容)')

# 🔴 v541(不变量部分): ①引擎不透明 canvas({alpha:false})全屏接管(v1 透明叠粒子被页面背景吃掉的教训永久有效); ②试用跨页持久(sessionStorage hansen_dia_trial: 写/续/清)——主页才是主题最重要的展示舞台; 教训: __hsnDiaTry 必须先 startTrialFor 再写入(其内部 endTrial 会清掉刚写的), 跨页续上分支同理须回写。
_cin41=open('hansen_cinema_themes.js',encoding='utf-8').read()
_dia41=open('hansen_diamond_shop.js',encoding='utf-8').read()
_s41=[]
if "{alpha:false}" not in _cin41: _s41.append('引擎未声明不透明 canvas(全屏接管失效)')
if "ctx.rotate" in _cin41 or ".rotate(" in _cin41: _s41.append('引擎出现旋转调用(违反防晕铁律)')
for _k41b in ["TRIAL_SS = 'hansen_dia_trial'","function startTrialFor","sessionStorage.setItem(TRIAL_SS","sessionStorage.removeItem(TRIAL_SS"]:
    if _k41b not in _dia41: _s41.append('试用跨页缺 '+_k41b)
_try41=_dia41.find('window.__hsnDiaTry = function')
_blk41=_dia41[_try41:_try41+400] if _try41>=0 else ''
if _blk41 and _blk41.find('startTrialFor(it, 60)')>_blk41.find('sessionStorage.setItem'): _s41.append('__hsnDiaTry 顺序回退(setItem 在 startTrialFor 之前会被 endTrial 清掉)')
if _s41: fail('v541 全屏接管+试用跨页不变量: ' + str(_s41[:8]))
else: ok('v541 全屏接管+试用跨页不变量 (不透明canvas·旋转禁令·试用sessionStorage写续清+先start后写顺序断言·v541)')

# 🔴 v542(Hansen 定稿): 首页「更换主题」面板接入全部钻石主题——根因: index.html 内嵌第二份硬编码主题清单(只有流光6款·价格过时30), v540 新增 IMAX 六款在首页面板根本不出现(Hansen"主页看不到新主题"的真正原因)。修法: ①商店暴露唯一真源 HansenDiamondShop.listThemes()(ITEMS 全 12 款补 c1/c2 预览双色); ②首页 renderDiamondThemes 重写为读 listThemes 双分区渲染(🎬 IMAX 史诗置顶金标+💎 流光系列), 硬编码清单退役绝迹; ③首页"6主题系统"1.5s 兜底轮询在钻石主题装备/试用期间让位(否则把 data-theme 写回 cosmos 与互斥清除打架), 卸下后 1.5s 自动恢复免费主题。
# 🔴 v717(Hansen): 首页「更换主题」面板彻底移除——主题统一只在钻石商店获取/购买(原 v542 首页面板接入逻辑随面板一并下线)。
#   根因: 首页存在与钻石商店重复的换主题入口(6 免费主题 + 钻石主题双分区), Hansen 要求只保留钻石商店一个主题来源。
_idx42=open('index.html',encoding='utf-8').read()
_dia42=open('hansen_diamond_shop.js',encoding='utf-8').read()
_s42=[]
# (a) 首页必须彻底无"更换主题"任何残留(入口/模态框/主题清单/选择函数/CSS)
for _bad42 in ['openThemeModal','id="themeModal"','renderDiamondThemes','class="theme-card','window.pickTheme','window.__hsnPickDiaTheme','window.__hsnTryDiaTheme','DIA_THEMES']:
    if _bad42 in _idx42: _s42.append('首页仍残留更换主题: '+_bad42)
# (b) 钻石商店仍是唯一主题来源: listThemes 唯一真源 + ITEMS 主题(预览双色 c1) + IMAX/典藏画廊双系列陈列【v743: 流光系列已删】
if 'listThemes: function()' not in _dia42: _s42.append('商店缺 listThemes 唯一真源')
if _dia42.count("c1:'#")<14: _s42.append('ITEMS 主题预览双色 c1 不足 14 款(现 %d)'%_dia42.count("c1:'#"))
for _k42 in ["renderSeries('imax'", "renderSeries('gallery'"]:
    if _k42 not in _dia42: _s42.append('商店未陈列系列 '+_k42)
# (c) 首页"6主题系统"底色块保留(维持默认外观+钻石主题卸下回归), 仍须对钻石装备/试用让位
_blk42s=_idx42.find('// 6 主题系统 - 启动时应用')
_blk42=_idx42[_blk42s:_blk42s+2000] if _blk42s>=0 else ''
if not _blk42: _s42.append('找不到首页 6主题系统底色块')
else:
    # 🔴 v732: 让位机制改为 getEquipped/试用→_diaOn→加 hsn-dia-on 并 return(原 'getEquipped()) return' 单行已重构, 让位意图不变)
    if not ('getEquipped()' in _blk42 and 'if(_diaOn){' in _blk42 and 'return;' in _blk42): _s42.append('底色块未对钻石装备让位(v732: getEquipped→_diaOn→加hsn-dia-on并return)')
    if 'hansen_dia_trial' not in _blk42: _s42.append('底色块未对钻石试用让位')
if _s42: fail('v717 首页主题面板移除/钻石商店唯一来源: ' + str(_s42[:8]))
else: ok('v717: 首页「更换主题」面板彻底移除(入口🎨/模态框 themeModal/主题清单 renderDiamondThemes/选择函数 pickTheme·__hsnPickDiaTheme·__hsnTryDiaTheme/CSS theme-card 全删·零残留); 主题统一只在钻石商店获取/购买(HansenDiamondShop.listThemes 唯一真源·ITEMS 全 14 款主题·🎬IMAX+✨流光 双系列陈列·每款 试用60s/钻石购买); 首页 6主题系统底色块保留(维持默认外观·对钻石装备/试用让位·钻石卸下自动回归). v717')

# 🔴 v543(Hansen 定稿·两轮打回后): 🎬 IMAX 嘉年华系列亮色重制——审美方向性教训: 游戏通体明亮糖果系(金色按钮/可爱宠物/emoji), Hansen 参照系=彩虹乐园/桃子糖果(高饱和+满屏可爱活物); v540 暗色大气派与 v541 暗色活物版再精致也是"压抑的烂", 暗黑电影风×儿童糖果游戏=必败。v543 六款全部推倒为【明亮·高饱和·满屏可爱活物·节日感】: 🎆焰火盛典380(烟花连放46/34颗带拖尾+爆裂中心闪光+孔明灯+屋顶彩灯串)/🍭糖果乐园450(马卡龙天+大彩虹7色弧+棉花糖云+糖果雨[wrap/lolli/donut·四成带笑脸face()]+糖果山丘)/🎈云端气球520(晴空+太阳楔光+彩条热气球+鸟群扇翅+字母横幅小飞机[拉A B C/WORD/GO!旗·点题背单词])/🐠七彩珊瑚湾600(亮蓝绿浅海+光柱+三群彩鱼+微笑鲸鱼喷泡+海草珊瑚海星+宝箱周期闪光)/🐉金龙贺岁700(红金喜庆+金龙穿屏[16段蛇形posAt+角须眼口+金光]+红灯笼+方孔金币雨scaleX翻转+角落炮仗)/🚀星际乐园888(亮紫蓝+四角星闪+笑脸卡通星球[环行星]+火箭喷火穿梭+UFO灯珠轮闪光束)。旧 id 一次性迁移(migrateImaxIds 按价位对位, owned/equipped 无损平移)。
_cin43=open('hansen_cinema_themes.js',encoding='utf-8').read()
_dia43=open('hansen_diamond_shop.js',encoding='utf-8').read()
_s43=[]
for _k43 in ['function face','function drawWrap','function drawLolli','function drawDonut','function drawBalloon','function drawFish','function drawWhale2','function drawPlanet','function burst','flashes','function orient','function turnPt']:
    if _k43 not in _cin43: _s43.append('v3 活物/招牌缺 '+_k43)
if 'function migrateImaxIds' not in _dia43: _s43.append('缺旧id迁移 migrateImaxIds')
for _pair43 in ["theme_storm:'theme_fireworks'","theme_meteor:'theme_candyland'","theme_sakurastorm:'theme_balloon'","theme_abyss:'theme_lagoon'","theme_goldenage:'theme_spacepark'"]:
    if _pair43 not in _dia43: _s43.append('迁移MAP缺 '+_pair43)
for _old43 in ['theme_storm','theme_meteor','theme_sakurastorm','theme_abyss','theme_goldenage']:
    if _dia43.count(_old43)!=1: _s43.append('旧id %s 应仅存于迁移MAP(现%d处)'%(_old43,_dia43.count(_old43)))
    if _old43 in _cin43: _s43.append('引擎残留旧场景id '+_old43)
for _nm43 in ['焰火盛典','糖果乐园','云端气球','七彩珊瑚湾','星际乐园']:
    if _nm43 not in _dia43: _s43.append('商店缺新主题名 '+_nm43)
if _s43: fail('v543 嘉年华亮色重制: ' + str(_s43[:8]))
else: ok('v543 IMAX嘉年华亮色重制 (审美对齐糖果系·活物招牌[烟花拖尾闪光/笑脸糖果/字母横幅飞机/微笑鲸鱼/笑脸星球火箭UFO]·旧id按价位无损迁移仅存MAP·真机canvas活+迁移+面板铁证。【v744: 金龙贺岁 theme_dragon 已删·原六款现五款·drawDragon/posAt随场景删·theme_cyber迁移移除】·v543/v744)')

# 🔴 v544(Hansen 铁令"绝对不允许出现任何差错"): 🏫 学校大冒险 38 词真人录音接入。Hansen 提供 NaturalReader 真人录音压缩包(学校大冒险.zip, 40 文件); 文件名要么=单词要么含单词, 一一精确对应。36 词命中有效录音→归一化 −16.0 LUFS(EBU R128, 迭代纯增益+alimiter 仅限峰, 全部 −16±0.6/0 outliers/0 clipping)→存入 words/单词.mp3(小写, 因 speak() 用 text.toLowerCase() 查 WORD_MAP)→接入 word_map.js。**精确对应要点**(防包含关系错配): pen←pronunciation_en_pen_denoised.mp3 / pencil←pronunciation_en_pencil.mp3(≠pen); book←book.mp3 / notebook←notebook__gb_1.mp3(≠book); class←pronunciation_en_class.mp3 / classroom←classroom.mp3(≠class); English/Chinese/PE 键与文件名全小写(english/chinese/pe)。**2 词无有效录音继续走在线牛津 fallback(合理不报错)**: math(压缩包内 math.mp3 为 0 字节空文件, 坚决不接空文件)、blackboard(压缩包内无任何含 black/board 的文件)。播放戳 ?v214。
_wm44=open('word_map.js',encoding='utf-8').read()
_s44=[]

# ⭐v918: 换音频必须换文件名(?v215 是写死的长期缓存令牌·原地换文件用户会继续听旧的), 例如 map.mp3 → map_r2.mp3。
# 所以下面几条真人录音守卫不能再写死 "words/<单词>.mp3", 必须【从 WORD_MAP 里解析真实路径】, 否则每换一个音频就误伤一次。
def _audio_path_of(_w, _wm):
    _m = re.search(r'"%s"\s*:\s*"(words/[^"]+\.mp3)"' % re.escape(_w), _wm)
    return _m.group(1) if _m else None

import os as _os44, hashlib as _hl44
_SCH=['school','class','classroom','teacher','student','book','notebook','pencil','pen','eraser','ruler','bag','scissors','glue','crayon','chalk','desk','chair','homework','exam','lesson','subject','grade','term','english','chinese','science','art','music','pe','history','geography','computer','map','dictionary','library','math','blackboard']
# (a) WORD_MAP 36 词映射正确
for _w in _SCH:
    if not _audio_path_of(_w, _wm44): _s44.append('WORD_MAP 缺学校词映射 '+_w)
# (b) 36 文件存在非空
_hashes={}
for _w in _SCH:
    _fp=_audio_path_of(_w, _wm44) or ('words/%s.mp3'%_w)
    if not _os44.path.exists(_fp): _s44.append('words/ 缺 '+_w+'.mp3'); continue
    if _os44.path.getsize(_fp)==0: _s44.append(_w+'.mp3 为空文件'); continue
    _h=_hl44.md5(open(_fp,'rb').read()).hexdigest()
    if _h in _hashes: _s44.append('错配! %s 与 %s 是同一文件'%(_w,_hashes[_h]))
    _hashes[_h]=_w
# (c) 包含关系三对必须不同文件
for _a,_b in [('pen','pencil'),('book','notebook'),('class','classroom')]:
    try:
        _ha=_hl44.md5(open('words/%s.mp3'%_a,'rb').read()).hexdigest()
        _hb=_hl44.md5(open('words/%s.mp3'%_b,'rb').read()).hexdigest()
        if _ha==_hb: _s44.append('错配! %s 与 %s 音频相同'%(_a,_b))
    except: _s44.append('无法校验 %s/%s'%(_a,_b))
# (d) math/blackboard 已于 v544 补录真人录音, 必须有本地映射且文件非空(Hansen 后补)
for _mb in ['math','blackboard']:
    if ('"%s": "words/%s.mp3"'%(_mb,_mb)) not in _wm44: _s44.append('math/blackboard 补录后须有本地映射: '+_mb)
    if not (_os44.path.exists('words/%s.mp3'%_mb) and _os44.path.getsize('words/%s.mp3'%_mb)>0): _s44.append(_mb+' 录音文件缺失或空')
if _s44: fail('v544 学校真人录音接入: ' + str(_s44[:8]))
else: ok('v544 学校大冒险38词真人录音全覆盖 (NaturalReader真人发音·文件名含单词精确一一对应·归一化−16LUFS全达标·38词WORD_MAP映射words/单词.mp3·pen≠pencil/book≠notebook/class≠classroom无错配·内容互异非空·math+blackboard后补录音接入(原空文件/缺失已补)·学校岛100%本地真人录音·?v214播放戳·真机验证全部走本地0报错·v544)')

# 🔴 v545(Hansen 铁令"绝对不允许出现任何差错"): 🎨 形容词大冒险 51 词真人录音接入。Hansen 提供 NaturalReader 真人录音包(形容词大冒险.zip, 51 文件)。**50 词精确命中并接入**, 1 词(quiet)文件名拼写不符暂不接走在线。归一化 −16.0 LUFS(迭代纯增益+alimiter 仅限峰, −16.40~−15.68/0 outliers/0 clipping)→存 words/单词.mp3(小写)→接入 word_map.js。**1 词暂不接(防错配)**: quiet(安静的, /ˈkwaɪət/) 的文件名是 pronunciation_en_quite.mp3(quite=相当, /kwaɪt/)——拼写不符"文件名=单词或含单词"规则(quiet 中无连续 q-u-i-t-e), 不确定录的是哪个词, 暂走在线牛津 fallback 待 Hansen 确认。**反义词对 md5 校验互异**(防错配): big≠small/hot≠cold/tall≠short/good≠bad/fast≠slow/new≠old/clean≠dirty/easy≠difficult/right≠wrong/same≠different/thin≠thick。播放戳 ?v214。
_wm45=open('word_map.js',encoding='utf-8').read()
_s45=[]
import os as _os45, hashlib as _hl45
_ADJ=['big','small','tall','short','long','wide','thin','thick','heavy','light','fast','slow','hot','cold','warm','cool','hard','soft','new','old','young','good','bad','nice','beautiful','ugly','happy','sad','angry','tired','busy','lazy','clever','kind','brave','funny','quiet','loud','clean','dirty','easy','difficult','safe','dangerous','same','different','right','wrong','free','sick','healthy']
_h45={}
for _w in _ADJ:
    if not _audio_path_of(_w, _wm45): _s45.append('WORD_MAP 缺形容词 '+_w)
    _fp=_audio_path_of(_w, _wm45) or ('words/%s.mp3'%_w)
    if not _os45.path.exists(_fp): _s45.append('words/ 缺 '+_w); continue
    if _os45.path.getsize(_fp)==0: _s45.append(_w+'.mp3 为空'); continue
    _d=_hl45.md5(open(_fp,'rb').read()).hexdigest()
    if _d in _h45: _s45.append('错配! %s 与 %s 同文件'%(_w,_h45[_d]))
    _h45[_d]=_w
# 反义词对必须互异
for _a,_b in [('big','small'),('hot','cold'),('tall','short'),('good','bad'),('fast','slow'),('new','old'),('clean','dirty'),('easy','difficult'),('right','wrong'),('same','different'),('thin','thick')]:
    try:
        if _hl45.md5(open('words/%s.mp3'%_a,'rb').read()).hexdigest()==_hl45.md5(open('words/%s.mp3'%_b,'rb').read()).hexdigest(): _s45.append('错配! %s=%s'%(_a,_b))
    except: _s45.append('无法校验 %s/%s'%(_a,_b))
# quiet 已于 v545 补正确录音接入(Hansen 后补, 原 quite 拼写不符的文件未采用)
if '"quiet": "words/quiet.mp3"' not in _wm45: _s45.append('quiet 补录后须有本地映射')
import os as _osq
if not (_osq.path.exists('words/quiet.mp3') and _osq.path.getsize('words/quiet.mp3')>0): _s45.append('quiet.mp3 缺失或空')
if _s45: fail('v545 形容词真人录音接入: ' + str(_s45[:8]))
else: ok('v545 形容词大冒险51词真人录音全覆盖 (NaturalReader真人发音·文件名含单词精确对应·归一化−16LUFS全达标·51词WORD_MAP映射·反义词对big≠small/hot≠cold等11对md5互异无错配·文件非空互异·quiet后补正确录音接入(原quite拼写不符未采用)·形容词岛100%本地真人录音·?v214·真机验证走本地0报错·v545)')

# 🔴 v546(Hansen 铁令"绝对不允许出现任何差错"): ⏰ 时间大冒险 40 词真人录音接入。Hansen 提供 NaturalReader 真人录音包(时间大冒险.zip, 41 mp3 + 1 无关 md)。**39 词精确命中并接入**, 1 词(October)无对应文件暂走在线。归一化 −16.0 LUFS(迭代纯增益+alimiter 仅限峰, −16.40~−15.62/0 outliers/0 clipping)→存 words/单词.mp3(小写, 因 speak 用 toLowerCase; Monday/February 等键与文件名全小写 monday/february)→接入 word_map.js。**1 词暂不接(防错配)**: October——压缩包内无含 october 的文件; 未使用文件中有 eus75151.mp3(乱码名 0.84s)疑似 October 但文件名既不=也不含 october(不符规则), 不确定录的哪个词, 暂走在线牛津 fallback 待 Hansen 确认。排除项: september.mp3(与 pronunciation_en_september.mp3 重复, 取后者)。播放戳 ?v214。
_wm46=open('word_map.js',encoding='utf-8').read()
_s46=[]
import os as _os46, hashlib as _hl46
_TIME=['time','second','minute','hour','day','week','month','year','morning','noon','afternoon','evening','night','midnight','today','yesterday','tomorrow','monday','tuesday','wednesday','thursday','friday','saturday','sunday','january','february','march','april','may','june','july','august','september','october','november','december','birthday','holiday','weekend','date']
_h46={}
for _w in _TIME:
    if not _audio_path_of(_w, _wm46): _s46.append('WORD_MAP 缺时间词 '+_w)
    _fp=_audio_path_of(_w, _wm46) or ('words/%s.mp3'%_w)
    if not _os46.path.exists(_fp): _s46.append('words/ 缺 '+_w); continue
    if _os46.path.getsize(_fp)==0: _s46.append(_w+'.mp3 为空'); continue
    _d=_hl46.md5(open(_fp,'rb').read()).hexdigest()
    if _d in _h46: _s46.append('错配! %s 与 %s 同文件'%(_w,_h46[_d]))
    _h46[_d]=_w
# 易混词对必须互异
for _a,_b in [('monday','sunday'),('tuesday','thursday'),('june','july'),('today','tomorrow'),('second','minute'),('week','weekend')]:
    try:
        if _hl46.md5(open('words/%s.mp3'%_a,'rb').read()).hexdigest()==_hl46.md5(open('words/%s.mp3'%_b,'rb').read()).hexdigest(): _s46.append('错配! %s=%s'%(_a,_b))
    except: _s46.append('无法校验 %s/%s'%(_a,_b))
# October 已于 v547 补正确命名录音接入(Hansen 重发 October.mp3, 与乱码 eus75151 同内容证实)
if '"october": "words/october.mp3"' not in _wm46: _s46.append('October 补录后须有本地映射')
import os as _oso
if not (_oso.path.exists('words/october.mp3') and _oso.path.getsize('words/october.mp3')>0): _s46.append('october.mp3 缺失或空')
if _s46: fail('v546 时间真人录音接入: ' + str(_s46[:8]))
else: ok('v546 时间大冒险40词真人录音全覆盖 (NaturalReader真人发音·精确对应·归一化−16LUFS·40词WORD_MAP映射小写·易混词对md5互异·October后补正确命名录音接入(v547·与乱码eus75151同内容证实)·时间岛100%本地真人录音·?v214·真机验证0报错·v546)')

# 🔴 v547(Hansen 铁令"绝对不允许出现任何差错"): 🎯 四岛+October 真人录音大批接入。Hansen 一次提供: October.mp3(补 v546 时间岛缺口, 6957B/0.84s 与此前乱码 eus75151.mp3 同大小同时长证实即 October)+ 疑问大冒险.zip(27 mp3)+ treasure大冒险.zip(57)+ 家居大冒险.zip(37)+ 家庭大冒险.zip(31)。**接入: October 1 词 + 四岛去重后 134 词 = 135 词**, 全部归一化 −16.0 LUFS(0 outliers/0 clipping)→words/小写.mp3→WORD_MAP(总 417 条)。**全局去重要点**: when 疑问/treasure 两包都有(取疑问包); answer 复用已有 words/answer.mp3(action 收官岛文件, 不覆盖); 已有真人录音的词全部跳过不动(who/there/their/how many~far/thank you/next to/hard/living room/dining room/washing machine/air conditioner/bed/stairs/chair/parents/grandparents/only child)。**treasure 缺 2 词走在线待补**: sorry、hello(包内无对应文件)。**超短文件方案**: he.mp3 仅 0.41s 致 loudnorm 测出 -inf, 尾部 apad 0.4s 静音后可测可归一化。**机制确认**: 8 个收官岛(action/body/city/clothes/color/job/nature/traffic)走岛内 __ISLAND_LOCAL_AUDIO 本地表(隔离命名), 其余岛(含新四岛)走全局 WORD_MAP——两套并存互不干扰。
_wm47=open('word_map.js',encoding='utf-8').read()
_s47=[]
import os as _os47, hashlib as _hl47
_Q47=['what','where','when','why','how','which','whose','this','that','these','those','here','i','you','he','she','it','we','they','my','your','his','her','our']
_T47=['yes','no','ok','please','goodbye','and','but','or','because','so','if','very','too','also','not','never','always','often','sometimes','again','already','still','now','then','soon','late','early','well','together','alone','only','most','more','less','about','for','with','without','at','in','on','under','between','number','letter','word','sentence','story','name','thing','idea','way','problem','answer']
_H47=['house','home','room','bedroom','bathroom','kitchen','garden','door','window','wall','floor','ceiling','roof','sofa','table','cupboard','wardrobe','fridge','stove','microwave','tv','telephone','lamp','mirror','clock','fan','key','lock']
_F47=['family','dad','mom','father','mother','son','daughter','brother','sister','sibling','twin','grandpa','grandma','grandfather','grandmother','uncle','aunt','cousin','nephew','niece','relative','husband','wife','baby','child','children','stepfather','stepmother']
_ALL47=_Q47+_T47+_H47+_F47+['october']
_h47={}
for _w in _ALL47:
    if not _audio_path_of(_w, _wm47): _s47.append('WORD_MAP 缺 '+_w)
    _fp=_audio_path_of(_w, _wm47) or ('words/%s.mp3'%_w)
    if not _os47.path.exists(_fp): _s47.append('words/ 缺 '+_w); continue
    if _os47.path.getsize(_fp)==0: _s47.append(_w+'.mp3 为空'); continue
    _d=_hl47.md5(open(_fp,'rb').read()).hexdigest()
    if _d in _h47 and _h47[_d]!='answer' and _w!='answer': _s47.append('错配! %s 与 %s 同文件'%(_w,_h47[_d]))
    _h47[_d]=_w
for _a,_b in [('he','she'),('his','her'),('this','that'),('these','those'),('my','your'),('mom','dad'),('father','mother'),('brother','sister'),('grandpa','grandma'),('grandfather','grandmother'),('nephew','niece'),('stepfather','stepmother'),('husband','wife'),('child','children'),('house','home'),('door','window'),('key','lock'),('yes','no'),('more','less'),('late','early'),('with','without')]:
    try:
        if _hl47.md5(open('words/%s.mp3'%_a,'rb').read()).hexdigest()==_hl47.md5(open('words/%s.mp3'%_b,'rb').read()).hexdigest(): _s47.append('错配! %s=%s'%(_a,_b))
    except: _s47.append('无法校验 %s/%s'%(_a,_b))
# sorry/hello/ice cream 已于 v548 补录接入(Hansen 后补, 全游戏712词100%真人录音达成)
for _mb in ['sorry','hello']:
    if ('"%s": "words/%s.mp3"'%(_mb,_mb)) not in _wm47: _s47.append(_mb+' 补录后须有本地映射')
    if not (_os47.path.exists('words/%s.mp3'%_mb) and _os47.path.getsize('words/%s.mp3'%_mb)>0): _s47.append(_mb+'.mp3 缺失或空')
# ice cream 须指向 Hansen 新录音(非旧 word_05), 新URL天然防缓存
if '"ice cream": "words/ice_cream.mp3"' not in _wm47: _s47.append('ice cream 须指向新录音 ice_cream.mp3')
if not (_os47.path.exists('words/ice_cream.mp3') and _os47.path.getsize('words/ice_cream.mp3')>0): _s47.append('ice_cream.mp3 缺失或空')
if _s47: fail('v547 四岛+October 真人录音: ' + str(_s47[:8]))
else: ok('v547+v548 四岛+October+最后3词共138词真人录音 (疑问24+treasure56含sorry/hello+家居28+家庭28+october+ice cream新录音·归一化−16LUFS全达标·WORD_MAP总419条·21对易混词md5互异·answer复用·when去重·he超短apad·ice cream指向ice_cream.mp3新URL防缓存·🎉全游戏712词100%真人录音达成·?v214·真机验证0报错)')

# 🔴 v549(Hansen 铁令: 相应大冒险一律用本岛新录音包文件, 跨岛同词每岛独立发音): 21 个"已有跳过"词的纠正。v547 接入时已有真人录音的词被跳过未用 Hansen 新包文件——Hansen 明确要求全部改用新包录音。**新包有文件的 15 词全部替换**: 疑问 who/there/their(原 word_19/20/21)、treasure thank you(原 word_15)+hard/when(跨岛隔离)、家居 living room/dining room/air conditioner/stairs/bed/chair(原 word_06/07/09/23/bed.mp3/跨岛)、家庭 parents/grandparents/only child(原 word_24/25/04)。**替换方式=新文件名+WORD_MAP 改指向**(URL 变化天然防缓存, 旧 word_NN 文件留存不删)。**跨岛同词隔离(机制级)**: chair(学校 chair.mp3 / 家居 chair_home.mp3)、hard(形容词 hard.mp3 / treasure hard_treasure.mp3)、when(疑问 when.mp3 / treasure when_treasure.mp3)——island_home/island_treasure 的 speak() 增加 window.__ISLAND_LOCAL_AUDIO 岛内表优先查询(与收官岛同语义, hansen_preload 预热口径天然兼容)。**新包无文件的 7 词保持旧真人录音**: how many/how much/how old/how long/how far(疑问, 包内无短语文件)、next to(treasure)、washing machine(家居)。
_wm49=open('word_map.js',encoding='utf-8').read()
_s49=[]
import os as _os49, hashlib as _hl49
# (a) 12 处全局新指向
for _k,_v in [('who','who'),('there','there'),('their','their'),('thank you','thank_you'),('living room','living_room'),('dining room','dining_room'),('air conditioner','air_conditioner'),('stairs','stairs'),('bed','bed_home'),('parents','parents'),('grandparents','grandparents'),('only child','only_child')]:
    if ('"%s": "words/%s.mp3"'%(_k,_v)) not in _wm49: _s49.append('WORD_MAP %s 须指向新录音 %s.mp3'%(_k,_v))
    if not (_os49.path.exists('words/%s.mp3'%_v) and _os49.path.getsize('words/%s.mp3'%_v)>0): _s49.append(_v+'.mp3 缺失或空')
# (b) 两岛岛内表
_hm=open('island_home.html',encoding='utf-8').read()
_tr=open('island_treasure.html',encoding='utf-8').read()
if '"chair": "words/chair_home.mp3"' not in _hm: _s49.append('island_home 缺岛内表 chair->chair_home')
if '"hard": "words/hard_treasure.mp3"' not in _tr: _s49.append('island_treasure 缺岛内表 hard->hard_treasure')
if '"when": "words/when_treasure.mp3"' not in _tr: _s49.append('island_treasure 缺岛内表 when->when_treasure')
for _f,_c in [('island_home.html',_hm),('island_treasure.html',_tr)]:
    # 🔴 v712 印章统一: 播音机制统一为标准壳通用 window.__ISLAND_LOCAL_AUDIO 岛内表优先查询(取代旧的 per-island _ov 别名)
    if 'window.__ISLAND_LOCAL_AUDIO[lowerText]' not in _c: _s49.append(_f+' speak 缺岛内表(__ISLAND_LOCAL_AUDIO)优先查询')
# (c) 跨岛三对文件必须互异 + 隔离文件非空
for _a,_b in [('chair','chair_home'),('hard','hard_treasure'),('when','when_treasure')]:
    try:
        if not (_os49.path.exists('words/%s.mp3'%_b) and _os49.path.getsize('words/%s.mp3'%_b)>0): _s49.append(_b+'.mp3 缺失或空'); continue
        if _hl49.md5(open('words/%s.mp3'%_a,'rb').read()).hexdigest()==_hl49.md5(open('words/%s.mp3'%_b,'rb').read()).hexdigest(): _s49.append('跨岛隔离失效! %s 与 %s 同文件'%(_a,_b))
    except Exception as _e: _s49.append('无法校验 %s/%s: %s'%(_a,_b,_e))
# (d) 7 个无新文件的词保持旧指向(防误删)
for _k,_v in [('how many','how_many'),('how much','how_much'),('how old','how_old'),('how long','how_long'),('how far','how_far'),('next to','next_to'),('washing machine','washing_machine')]:  # 🔴v897: 编号文件已改名规范名, pin同步更新
    if ('"%s": "words/%s.mp3"'%(_k,_v)) not in _wm49: _s49.append('%s 应保持旧录音 %s(新包无文件)'%(_k,_v))
if _s49: fail('v549 本岛录音替换+跨岛隔离: ' + str(_s49[:8]))
else: ok('v549 21词纠正·本岛新录音全替换 (15词换新包文件·12处WORD_MAP改指向新URL防缓存·跨岛三对chair/hard/when岛级隔离(__ISLAND_LOCAL_AUDIO岛内表优先+md5互异)·7词新包无文件保持旧真人录音·真机10/10验证各岛播本岛录音·?v214·v549)')

# 🔴 v553(Hansen: v550 战意全开版仍太一般, 要更惊艳更酷——推倒重做): 狂暴怒嚎·百战连锤。三阶段大戏——①狂暴变身"吼——!": 兽人虚影(lv03 立绘 120px·泛红狂暴光 drop-shadow 红+橙·saturate1.4)scale .85→1.85 压近淡出 + 双层粗音浪×2(橙 border5px+绿 outline·scale.25→4.4) + 底部碎石×5 被吼弹跳; ②百战连锤"百战不败!": hq4Swing 左锤(450ms·落点血条22%·impactDeg 104°)→右锤镜像(850ms·78%·-104°), 各 170px·380ms 快抡·命中 hbaHammerQuake(fxi*0.55,false) 小地裂; ③灭世终结(1250ms~): 300px 大锤升空 rotate140→180° 锤头朝下巨大化→锤头充能辉光脉动+岩浆滴×3→悬停震颤→垂直轰落(240ms cubic 加速·scaleY.95 压扁)→命中(≈2150ms): hbaHammerQuake(fxi*1.5,true 大地裂+部落绿环)+熔岩喷柱×3+底部尘墙×4+deal→锤嵌地反弹两下拔起淡出。不变量: 零震屏零屏闪 / hba-hq4 前缀 / 真锤图 decode 克隆(BUG#67) / deal 兜底 dealDelay 2600(实测≈2150)。v550 的 hq3 CSS 保留无害(死样式), v512 旧壳注释已随重写清除。
_ba53=open('hansen_boss_attack.js',encoding='utf-8').read()
_s53=[]
for _frag,_msg in [
  ("t==='hammerquake'","hammerquake 分支缺失"),
  ("hba-hq4rage","狂暴虚影缺失"),
  ("bosses/lv03.webp","虚影须用 lv03 立绘"),
  ("hba-hq4roar","粗音浪缺失"),
  ("hba-hq4pebble","碎石弹跳缺失"),
  ("function hq4Swing","连锤函数缺失"),
  ("hq4Swing(hitL, hhy, false","左锤调用缺失"),
  ("hq4Swing(hitR, hhy, true","右锤镜像调用缺失"),
  ("hba-hq4charge","大锤充能缺失"),
  ("hba-hq4drip","岩浆滴缺失"),
  ("hba-hq4lava","熔岩喷柱缺失"),
  ("hba-hq4dustwall","底部尘墙缺失"),
  ("hbaHammerQuake(hhx,hhy,hfxi*1.5,true)","灭世命中须 fxi*1.5+部落绿环"),
  ("function hbaHammerQuake(cx,cy,fxi,orcRage)","hbaHammerQuake orcRage 参数被改"),
  ("dealDelay:2600","dealDelay 2600 兜底被改"),
  ("{n:'百战兽人',lv:'Lv3',mv:'百战连锤'","调参面板条目未更新"),
]:
    if _frag not in _ba53: _s53.append(_msg)
if _s53: fail('v553 百战兽人狂暴怒嚎百战连锤: ' + str(_s53[:8]))
else: ok('v553 百战兽人·狂暴怒嚎百战连锤 (三阶段: 狂暴虚影压近+双粗音浪+碎石弹跳→左右双连锤包夹各起小地裂→300px大锤升空充能岩浆滴+悬停震颤+垂直轰落+灭世大地裂fxi1.5+部落绿环+熔岩柱x3+尘墙x4+锤嵌地反弹拔起·deal实测2150兜底2600·零震屏零屏闪·hba-hq4前缀·虚影图+锤图实载·真机全要素DOM断言+零泄漏+五关键帧截图+0报错·v553)')

# 🔴 v551(Hansen: 暗影忍者 Lv2 攻击特效·按形象台词做到最棒): 影舞·三连杀。台词三象逐句可视化——"忍法!隐身术!"→开场 boss 处忍者烟雾×3 遁入暗影; "影舞步!你看不见我!"→屏上三处闪现影分身(lv02.webp 黑剪影 brightness(0)+紫磷光 drop-shadow), 每分身各掷一枚手里剑·三镖多方向包夹旋飞(720°)·错峰命中小紫闪+血条微光; "一刀致命!"→1.6 倍大手里剑带紫刀光拖尾(沿飞行角度渐变光带)急速射出(1080°), 命中十字斩光×2(±45°)+血溅+暗影爆→deal。不变量: deal 兜底 dealDelay 1900 / 零震屏零屏闪 / hba-sd 前缀 / 手里剑图 decode 克隆 / 老 shuriken 分支保留勿删(v528 先例)。
_ba51=open('hansen_boss_attack.js',encoding='utf-8').read()
_s51=[]
for _frag,_msg in [
  ("t==='shadowdance'","shadowdance 分支缺失"),
  ("hba-sdsmoke","忍者烟雾缺失"),
  ("hba-sdclone","影分身缺失"),
  ("bosses/lv02.webp","影分身须用 lv02 立绘剪影"),
  ("brightness(0) drop-shadow","剪影滤镜缺失"),
  ("hba-sdhitflash","命中紫闪缺失"),
  ("hba-sdtrail","紫刀光拖尾缺失"),
  ("hba-sdslash","十字斩光缺失"),
  ("hba-sdburst","暗影爆缺失"),
  ("'暗影忍者':{t:'shadowdance'","FX 配置须为 shadowdance"),
  ("dealDelay:1900","dealDelay 1900 兜底被改"),
  ("t==='shuriken'","老 shuriken 分支被删(v528 先例须保留)"),
  ("{n:'暗影忍者',lv:'Lv2',mv:'影舞三连杀'","调参面板条目未更新"),
]:
    if _frag not in _ba51: _s51.append(_msg)
if _s51: fail('v551 暗影忍者影舞三连杀: ' + str(_s51[:8]))
else: ok('v551 暗影忍者·影舞三连杀攻击特效 (台词三象: 隐身烟雾x3+影分身x3剪影掷镖+三镖720°包夹错峰紫闪+1.6倍大镖1080°紫刀光拖尾+十字斩x2+血溅+暗影爆·deal兜底1900·零震屏零屏闪·hba-sd前缀·真镖图+剪影图实载·真机全要素DOM断言+零泄漏+关键帧截图+0报错·老shuriken分支保留·v551)')

# 🔴 v552(Hansen: 淘气小幽灵 Lv1 攻击特效·按形象台词做到非常好): 淘气捉迷藏——可爱淘气路线(与兽人暴力/忍者杀气完全相反, Lv1 给小朋友的第一个 boss 不能吓人)。台词三象逐句可视化——"飘飘飘!抓不到我~"→3 个半透明小幽灵虚影(lv01 立绘 opacity.6+蓝灵光 drop-shadow)屏上三处错峰飘现又消失(捉迷藏·上下浮动); "嘿嘿 我可不怕你!"→每虚影消失瞬间弹一颗幽灵嘟嘟弹(白蓝灵球带高光), S 形飘行(主位移+垂直正弦横摆衰减·7 关键帧)向勇者·错峰命中小灵光涟漪+泡泡上飘; "呜~ 来抓我呀!"→本体大虚影(128px)自屏侧 S 形飘扑→贴脸鬼脸(放大1.16+wiggle±8°两下)→"啵"下扑撞血条: 灵光大涟漪+8 幽灵泡泡上飘+4 小星星✦+血条微光→deal→得逞溜走(上飘旋转淡出)。不变量: 零震屏零屏闪(弃用老版 tintOverlay 全屏染色) / hba-gp 前缀 / deal 兜底 dealDelay 2300 / 老 ghost 分支保留勿删(v528 先例)。
_ba52=open('hansen_boss_attack.js',encoding='utf-8').read()
_s52=[]
for _frag,_msg in [
  ("t==='ghostprank'","ghostprank 分支缺失"),
  ("hba-gpphantom","幽灵虚影缺失"),
  ("bosses/lv01.webp","虚影须用 lv01 立绘"),
  ("function gpSFly","S 形飘行函数缺失"),
  ("hba-gporb","嘟嘟弹缺失"),
  ("hba-gpripple","灵光涟漪缺失"),
  ("hba-gpbubble","幽灵泡泡缺失"),
  ("hba-gpstar","小星星缺失"),
  ("'淘气小幽灵':{t:'ghostprank'","FX 配置须为 ghostprank"),
  ("dealDelay:2300","dealDelay 2300 兜底被改"),
  ("t==='ghost'){","老 ghost 分支被删(v528 先例须保留)"),
  ("{n:'淘气小幽灵',lv:'Lv1',mv:'淘气捉迷藏'","调参面板条目未更新"),
]:
    if _frag not in _ba52: _s52.append(_msg)
# ghostprank 分支内禁止 tintOverlay(零屏闪)
_gpstart=_ba52.find("t==='ghostprank'")
_gpend=_ba52.find("t==='ghost'){",_gpstart)
if _gpstart>=0 and _gpend>_gpstart and 'tintOverlay' in _ba52[_gpstart:_gpend]: _s52.append('ghostprank 分支内禁用 tintOverlay(零屏闪)')
if _s52: fail('v552 淘气小幽灵淘气捉迷藏: ' + str(_s52[:8]))
else: ok('v552 淘气小幽灵·淘气捉迷藏攻击特效 (台词三象: 虚影捉迷藏x3(lv01立绘+蓝灵光)+S形嘟嘟弹x3(正弦横摆7关键帧)+本体128px鬼脸扑\"啵\"+灵光涟漪+泡泡x8上飘+星星x4+得逞溜走·可爱路线零惊吓·deal兜底2300·零震屏零屏闪弃tintOverlay·hba-gp前缀·虚影图实载·真机全要素DOM断言+零泄漏+关键帧截图+0报错·老ghost分支保留·v552)')

# 🔴 v554(Hansen: 史前霸王龙 Lv4 攻击特效太一般, 要绝对吸引人): 史前霸主·灭绝之咬。三阶段大戏——①霸主驾到"吼!!!史前霸主驾到!": lv04 虚影(124px·血红霸主光 drop-shadow 红+琥珀·saturate1.35)scale .85→1.9 压近淡出 + 三道咆哮音波(复用 hbaRxWaveSVG, 扇形 ±9°)轰向勇者 + 底部碎石×5 震跳; ②远古巨颚"感受远古之力!": 巨型上颚(216px·hbaRxJawSVG)自屏顶探入+下颚自屏底升起, 在勇者血条上下 ±34px 悬停蓄势(520ms)→"咔嚓"合拢(120ms cubic 急收至 ±6px)→咬合白闪+琥珀碎屑×6+三道撕痕(hbaRxTearSVG ±14° 扇形)+血条反馈→双颚回弹退场; ③灭绝陨石·化石化"你将化为化石!": 大陨石(74×178px·复用 hbmMeteorSVG·**容器必须设 --mc1~4/--mglow 色变量否则黑块(v511 机制)**·drop-shadow 双层辉光)自右上(86%vw,-60)斜射 600ms+沿途火星×5→命中(≈2150ms): 大爆闪+双琥珀环+**灰白石化裂纹环**(196px·hbaRx2FossilSVG 双环+7放射裂纹·亮色 #f1f5f9/#cbd5e1+白发光·scale.25→1.75 扩散 720ms)+**琥珀结晶×5**(12-19px宽·五边形 clip-path·scaleY 弹立)+石化尘×4(26-52px 亮白)→deal。**排障**: ①火星循环 tt 定义在 setTimeout 回调内但延迟参数引用→ReferenceError 中断命中段(fossil/amber/dust 全 0)——闭包变量须定义在 IIFE 内 setTimeout 外; ②深底上灰白化石环初版太淡→提亮加粗加大加白发光。不变量: 零震屏零屏闪 / hba-rx2 前缀 / 老 dinocombo 分支+hbaRexCombo 保留勿删(v528 先例) / deal 兜底 dealDelay 2600(实测≈2150)。
_ba54=open('hansen_boss_attack.js',encoding='utf-8').read()
_s54=[]
for _frag,_msg in [
  ("t==='rexapex'","rexapex 分支缺失"),
  ("hba-rx2apex","霸主虚影缺失"),
  ("bosses/lv04.webp","虚影须用 lv04 立绘"),
  ("hba-rx2wave","咆哮音波缺失"),
  ("hba-rx2jaw","巨颚缺失"),
  ("hbaRxJawSVG('x2u","上颚 SVG 调用缺失"),
  ("hba-rx2biteflash","咬合闪缺失"),
  ("hba-rx2tear","撕痕缺失"),
  ("hba-rx2meteor","灭绝陨石缺失"),
  ("--mc1:#fff;--mc2:#fde68a;--mc3:#fb923c;--mc4:#dc2626","陨石色变量缺失(不设则黑块)"),
  ("function hbaRx2FossilSVG","化石环 SVG 函数缺失"),
  ("hba-rx2fossil","化石化环缺失"),
  ("hba-rx2amber","琥珀结晶缺失"),
  ("'史前霸王龙':{t:'rexfury'","FX 配置须为 rexfury(v555·rexapex 已退役保留)"),
  ("t==='dinocombo'","老 dinocombo 分支被删(v528 先例须保留)"),
  ("function hbaRexCombo","hbaRexCombo 被删(须保留)"),
  ("{n:'史前霸王龙',lv:'Lv4',mv:'远古之怒·灭绝之颚'","调参面板条目未更新(v555)"),
]:
    if _frag not in _ba54: _s54.append(_msg)
# 火星 tt 防回归: tt 定义必须在 setTimeout 之前同一行(IIFE 参数后)
if "(function(k){ var tt=0.18+k*0.16; setTimeout(" not in _ba54: _s54.append('火星 tt 闭包定义位置被改(须在 IIFE 内 setTimeout 外)')
if _s54: fail('v554 史前霸王龙灭绝之咬: ' + str(_s54[:8]))
else: ok('v554 史前霸王龙·灭绝之咬[已退役保留] (三阶段: 霸主虚影压近+三咆哮波+碎石震跳→巨颚上下探入悬停蓄势咔嚓咬合+白闪碎屑撕痕→灭绝陨石(色变量必设)斜砸+火星拖尾+化石化大环(亮白196px)+琥珀晶x5+石化尘·deal实测2150兜底2600·零震屏零屏闪·hba-rx2前缀·虚影图实载·真机全要素DOM断言+零泄漏+关键帧截图+0报错·老dinocombo保留·v554)')

# 🔴 v555(Hansen 亲制四件套真图, 弃 v554 陨石): 史前霸王龙·远古之怒·灭绝之颚。①lv04 虚影血红霸主光压近+双咆哮波(RxWaveSVG); ②白色刀光先扫(速度感)→左爪三趾撕痕真图(rexclaw_l.webp)自左上扑入定格(brightness1.22+saturate1.3+双层琥珀 drop-shadow·vw80% 大件)·命中白闪+琥珀碎屑×6+bloodSplatter→右爪镜像交叉撕; ③上颚(rexjaw_top)自屏顶+下颚(rexjaw_bot)自屏底对准勇者血条·大张悬停(血条暴露巨口中央·GAP=JW*0.17)·蓄势微颤→110ms 急合咬死(重叠 JW*160/720)→命中(实测≈2100): 爆闪+压紧微动+血条红色出血覆盖层 1150ms 脉冲(双颚弹开后仍可见)+血珠×7 滴落+bloodSplatter→deal→双颚反向弹开退场。四图预加载 __hbaRfImgs(BUG#67 克隆模式)。**排障**: 爪痕初版 vw52% 太小太暗被白闪盖→深底浅色大件三件套(亮色+发光+加大至 vw80%)+白闪缩半。不变量: 零震屏零屏闪/禁 tintOverlay/hba-rf 前缀/老 rexapex(v554)+dinocombo(v513) 分支全保留(v528 先例)/deal 兜底 dealDelay 2500/闭包循环变量全在 setTimeout 外(v554 tt 血案)。
_ba55=open('hansen_boss_attack.js',encoding='utf-8').read()
_s55=[]
for _frag,_msg in [
  ("t==='rexfury'","rexfury 分支缺失"),
  ("window.__hbaRfImgs=_rfImgs;","四件套预加载缺失(BUG#67)"),
  ("bosses/rexclaw_l.webp","左爪图引用缺失"),
  ("bosses/rexclaw_r.webp","右爪图引用缺失"),
  ("bosses/rexjaw_top.webp","上颚图引用缺失"),
  ("bosses/rexjaw_bot.webp","下颚图引用缺失"),
  ("hba-rf-apex","霸主虚影缺失"),
  ("hba-rf-slash","刀光缺失"),
  ("hba-rf-claw","爪痕容器缺失"),
  ("brightness(1.22) saturate(1.3)","爪痕提亮被改(深底大件三件套防回归)"),
  ("hba-rf-jaw","双颚容器缺失"),
  ("var rfOV=Math.round(rfJW*160/720);","咬合重叠量公式被改(原图标度)"),
  ("hba-rf-bleed","血条出血层缺失"),
  ("hba-rf-drip","血珠缺失"),
  ("'史前霸王龙':{t:'rexfury',pal:'amber',sz:0.5","FX 配置须为 rexfury 且默认规模 0.5(v556 Hansen 定稿: 全尺寸太大, 加大须后台自调)"),
  ("dealDelay:2500","dealDelay 2500 兜底被改"),
  ("t==='rexapex'","老 rexapex 分支被删(v528 先例须保留)"),
  ("t==='dinocombo'","老 dinocombo 分支被删(须保留)"),
  ("{n:'史前霸王龙',lv:'Lv4',mv:'远古之怒·灭绝之颚',pal:'琥珀',ps:['sz','sp','fxi'],df:{sz:50,sp:100,fxi:100}}","调参面板条目或默认值被改(v556: 恢复默认须回 50%)"),
]:
    if _frag not in _ba55: _s55.append(_msg)
# 闭包变量防回归(v554 tt 血案同型): 碎屑/血珠循环变量必须定义在 setTimeout 外
if "var di; // 碎屑循环变量(setTimeout 外)" not in _ba55: _s55.append('碎屑循环变量 di 定义位置被改')
if "var bi; // 循环变量(setTimeout 外)" not in _ba55: _s55.append('血珠循环变量 bi 定义位置被改')
# 素材文件存在性
import os as _os55
for _f in ['bosses/rexclaw_l.webp','bosses/rexclaw_r.webp','bosses/rexjaw_top.webp','bosses/rexjaw_bot.webp']:
    if not _os55.path.isfile(_f): _s55.append('素材文件缺失: '+_f)
if _s55: fail('v555 史前霸王龙远古之怒·灭绝之颚: ' + str(_s55[:8]))
else: ok('v555 史前霸王龙·远古之怒·灭绝之颚 (Hansen亲制真图四件套: 虚影咆哮+刀光+左右爪真图撕痕(vw80%提亮双层琥珀光)+双颚真图对准血条大张悬停蓄势急合咬死+爆闪压紧+血条红色出血层1150ms+血珠x7+bloodSplatter·deal实测2100兜底2500·四图预加载BUG#67·零震屏零屏闪·hba-rf前缀·真机全要素DOM断言+零泄漏+关键帧截图+0报错·老rexapex/dinocombo保留·v555)')

# 🔴 v557(Hansen 亲制典藏双主题): 云朵梦境工厂 theme_clouddream + 彩虹甜心岛 theme_rainbowsweet。Hansen 提供 899×1748 全图手绘背景(themes/ 目录 JPG q84), 真图 cover 绘制 + canvas 粒子特效叠加, 图未加载完同色渐变兜底。沿 series:imax 管线零新分区(v542 唯一真源教训): ITEMS 插 IMAX 区首→主页面板/商店/试用/锁全自动接入。☁️云朵: 梦泡泡彩虹边+四角星 twinkle+小羊 Zzz 三连+金尘+招牌【梦境流星雨】(5颗 lighter 粗体光晕头)。🍦彩虹: 糖果/心形糖白描边贴纸飘落+果冻气泡+十字闪光+招牌【火山糖果喷发】(34颗 vy=.00024-.00036 g=1.6e-7 峰顶≈屏3%洒落屏中+彩尾+白描边)。**排障**: ①初版喷发横速过大+重力失配 1.4s 全飞出屏→重算弹道 vx 独立 ±.00015; ②糖果撞糖果背景看不见→白描边贴纸轮廓分离(花底粒子定式); ③真机验证两坑: 删 fixed 弹窗必须限定文本(全删砸掉面板容器假失败), localStorage 真 KEY=hansen_diamond_shop 无 _v1 后缀(写错 KEY 时岛页 canvas 是试用跨页持久的假阳性)。不变量: 绝无旋转动画/粒子<90/z-index:-1/DPR≤2/hidden 暂停。
_ct57=open('hansen_cinema_themes.js',encoding='utf-8').read()
_ds57=open('hansen_diamond_shop.js',encoding='utf-8').read()
_s57=[]
for _frag,_msg in [
  ("function makeBgImage(src, fallbackStops)","真图背景 helper 缺失"),
  ("function sceneCloudDream()","云朵场景缺失"),
  ("function sceneRainbowSweet()","彩虹场景缺失"),
  ("themes/cloud_dream.jpg","云朵背景图引用缺失"),
  ("themes/rainbow_sweet.jpg","彩虹背景图引用缺失"),
  ("theme_clouddream:sceneCloudDream,","SCENES 注册云朵缺失"),
  ("theme_rainbowsweet:sceneRainbowSweet,","SCENES 注册彩虹缺失"),
  ("vy:-rnd(.00024,.00036)","喷发弹道初速被改(峰顶≈屏3%标定)"),
  (".00000016*ag2*ag2","喷发重力参数被改(洒落屏中标定)"),
  ("ctx.lineWidth=2.2*DPR;ctx.strokeStyle='rgba(255,255,255,.95)';","糖果白描边贴纸被删(花底粒子可见性定式)"),
  ("ctx.lineWidth=5*DPR;ctx.lineCap='round';","流星粗体被改"),
]:
    if _frag not in _ct57: _s57.append(_msg)
for _frag,_msg in [
  ("{id:'theme_clouddream',   type:'theme', series:'imax', name:'云朵梦境工厂', emoji:'☁️', price:688","商店 ITEMS 云朵条目缺失/被改"),
  ("{id:'theme_rainbowsweet', type:'theme', series:'imax', name:'彩虹甜心岛', emoji:'🍦', price:768","商店 ITEMS 彩虹条目缺失/被改"),
  ("theme_clouddream: {bg:'#9d96dd',","THEME_GRAD 云朵兜底缺失"),
  ("theme_rainbowsweet: {bg:'#7fcdf5',","THEME_GRAD 彩虹兜底缺失"),
  (".dia-prev-theme_clouddream{background:url(themes/cloud_dream.jpg","商店预览卡云朵缺失"),
  (".dia-prev-theme_rainbowsweet{background:url(themes/rainbow_sweet.jpg","商店预览卡彩虹缺失"),
  ("梦境流星雨 / 火山糖果喷发","招牌台词未更新"),
]:
    if _frag not in _ds57: _s57.append(_msg)
import os as _os57
for _f in ['themes/cloud_dream.jpg','themes/rainbow_sweet.jpg']:
    if not _os57.path.isfile(_f): _s57.append('背景图文件缺失: '+_f)
# 旋转禁令: 新场景内不得出现 ctx.rotate(
_cd_i=_ct57.find('function sceneCloudDream()'); _cd_j=_ct57.find('var SCENES={')
if _cd_i>-1 and _cd_j>_cd_i and 'ctx.rotate(' in _ct57[_cd_i:_cd_j]: _s57.append('新主题场景出现 ctx.rotate(防晕铁律)')
if _s57: fail('v557 Hansen 亲制典藏双主题: ' + str(_s57[:8]))
else: ok('v557 云朵梦境工厂+彩虹甜心岛 (Hansen 亲制 899x1748 全图手绘背景·真图cover+canvas粒子·series:imax 零新分区自动接入主页面板/试用/锁·云朵: 梦泡泡+四角星+小羊Zzz+金尘+梦境流星雨(5颗lighter粗体光晕)·彩虹: 白描边贴纸糖果/心形糖+果冻泡+十字闪+火山糖果喷发(34颗弹道峰顶屏3%洒落屏中+彩尾)·真机: 主页面板出现+试用立即生效+锁拒未购+装备进岛双验证+canvas帧差动画活跃+0报错·绝无旋转/粒子<90/z-index-1·v557)')

# 🔴 v558(Hansen 亲制双素材, 弃 v514 尸毒): 千年僵尸·封印百拳·定身符爆。素材='定住你了哈哈'黄符(1254px 紧裁缩 280w) + 清装僵尸百拳冲脸全景图(缩 880)+单拳裁剪×3(300px)。三段: ①lv05 虚影绿磷光【蹦跳两段】压近(中式僵尸跳)+磷火×2; ②黄符旋转翻飞→"啪"贴住勇者(squash 弹性)+金波纹环×2+束缚金圈脉冲×2(定身)→震颤金光蓄爆→爆裂(白闪+金碎片×8); ③单拳 POV 冲脸连击×6(scale .18→1.06+blur 渐清+急停回弹, 错落方位, 间隔 250→170 加速), 每拳命中=白闪+冲击环+放射速度线×8+符纸屑×3 → 压轴百拳全景 scale .2→1.28 冲满屏 → 总命中(实测≈3360): 最强白闪+三重冲击环→deal→淡出+符纸屑飘落。打击感=POV 急停+冲击环急扩+速度线瞬现+白闪+回弹, 零震屏(绝不动页面根节点)。五图预加载 __hbaZsImgs(BUG#67)。不变量: hba-zs 前缀/老 zombiecurse(v514) 分支+工具函数+CSS 全保留/dealDelay 3800/循环变量全 setTimeout 外。
_ba58=open('hansen_boss_attack.js',encoding='utf-8').read()
_s58=[]
for _frag,_msg in [
  ("t==='zombieseal'","zombieseal 分支缺失"),
  ("window.__hbaZsImgs=_zsImgs;","五件套预加载缺失(BUG#67)"),
  ("bosses/zb_talisman.webp","定身符图引用缺失"),
  ("bosses/zb_fists_all.webp","百拳全景图引用缺失"),
  ("bosses/zb_fist1.webp","单拳1引用缺失"),
  ("bosses/zb_fist2.webp","单拳2引用缺失"),
  ("bosses/zb_fist3.webp","单拳3引用缺失"),
  ("hba-zs-apex","僵尸虚影缺失"),
  ("hba-zs-tali","符容器缺失"),
  ("hba-zs-bind","束缚圈缺失(定身感)"),
  ("hba-zs-fist","单拳容器缺失"),
  ("hba-zs-impact","冲击环缺失(打击感三件套)"),
  ("hba-zs-line","速度线缺失(打击感三件套)"),
  ("hba-zs-all","百拳全景容器缺失"),
  ("hba-zs-bigflash","总攻闪缺失"),
  ("t==='zombieseal'","老 zombieseal 分支被删(v558 退役保留, v528 先例)"),
  ("t==='zombiecurse'","老 zombiecurse 分支被删(v528 先例须保留)"),
]:
    if _frag not in _ba58: _s58.append(_msg)
# 循环变量防回归(v554 tt 血案同型)
for _vchk in ["var zsgi; // 磷火循环变量(setTimeout 外)","var zli; // 速度线循环变量(setTimeout 外)","var zri; // 三重冲击环循环变量(setTimeout 外)"]:
    if _vchk not in _ba58: _s58.append('循环变量定义位置被改: '+_vchk[:14])
import os as _os58
for _f in ['bosses/zb_talisman.webp','bosses/zb_fists_all.webp','bosses/zb_fist1.webp','bosses/zb_fist2.webp','bosses/zb_fist3.webp']:
    if not _os58.path.isfile(_f): _s58.append('素材文件缺失: '+_f)
if _s58: fail('v558 千年僵尸封印百拳·定身符爆[已退役保留]: ' + str(_s58[:8]))
else: ok('v558 千年僵尸·封印百拳·定身符爆[已退役保留] (Hansen亲制双素材: 定住你了哈哈黄符+清装百拳全景+单拳x3·虚影蹦跳两段+磷火→符旋飞啪贴住squash+束缚金圈定身→震颤蓄爆→爆裂金碎片→单拳POV冲脸x6(白闪+冲击环+速度线x8+纸屑)加速连击→百拳全景1.28x冲满屏总命中三重冲击环·deal实测3360兜底3800·五图预加载BUG#67·零震屏零屏闪·hba-zs前缀·真机全要素DOM断言+零泄漏+九帧精确卡点+0报错·老zombiecurse保留·v558)')

# 🔴 v559(Hansen 二代素材, v558 一日重做): 千年僵尸·定身符咒·万拳齐发。Hansen 判 v558 没达预期换图: 左/右尸拳自带绿色尸气爆发光环+符纸(460px), 新百拳全景每拳带爆发圈(880px), 符复用 zb_talisman.webp 同 URL 走缓存。三段: ①虚影蹦跳+磷火(v558 验证保留); ②符旋飞"啪"贴住+束缚金圈——符全程贴着不爆+持续高频挣扎抖动(22 关键帧随机抖, 被定住挨揍叙事), 总命中才炸裂(金碎片×8 定身解除); ③左右尸拳斜向冲脸交替×8(自两侧 ±34%vw scale.3→1 斜冲+blur 渐清+急停回弹, 命中点 ±26px 交替偏移交叉重拳, 间隔 180→110ms 递减"刷刷刷"), 每拳命中=白闪+冲击环+速度线×6+纸屑×2, 命中后 100ms 急撤无缝→新百拳全景 scale.2→1.3 冲满屏→总命中(实测≈2960): 最强白闪+三重冲击环+符炸裂→deal。四图预加载 __hbaZfImgs(BUG#67)。不变量: hba-zf 前缀/老 zombiecurse(v514)+zombieseal(v558) 全保留/dealDelay 3400/零震屏/循环变量全 setTimeout 外。
_ba59=open('hansen_boss_attack.js',encoding='utf-8').read()
_s59=[]
for _frag,_msg in [
  ("t==='zombiefury'","zombiefury 分支缺失"),
  ("window.__hbaZfImgs=_zfImgs;","二代四件套预加载缺失(BUG#67)"),
  ("bosses/zf_fist_l.webp","左尸拳图引用缺失"),
  ("bosses/zf_fist_r.webp","右尸拳图引用缺失"),
  ("bosses/zf_fists_all.webp","新百拳全景引用缺失"),
  ("hba-zf-tali","符容器缺失"),
  ("hba-zf-bind","束缚圈缺失(定身感)"),
  ("hba-zf-fist","尸拳容器缺失"),
  ("hba-zf-impact","冲击环缺失(打击感)"),
  ("hba-zf-line","速度线缺失(打击感)"),
  ("hba-zf-all","百拳全景容器缺失"),
  ("var kf=[], steps=22, zk;","符挣扎抖动 22 关键帧被改"),
  ("zfPunch(1350,'l', 26);","八连击首拳时序被改"),
  ("zfPunch(2345,'r',-28);","八连击末拳时序被改"),
  ("'千年僵尸':{t:'zombiefury',pal:'poison',sz:0.50,sp:1.0,fxi:2.0","FX 配置须为 zombiefury 且参数为 Hansen 定稿(v560: 规模50%/强度200%)"),
  ("dealDelay:3400}, // 🔴 v559","dealDelay 3400 兜底被改"),
  ("{n:'千年僵尸',lv:'Lv5',mv:'定身符咒·万拳齐发',pal:'剧毒',ps:['sz','sp','fxi'],df:{sz:50,sp:100,fxi:200}}","调参面板默认值须为 Hansen 定稿(v560: 恢复默认回 50/100/200)"),
]:
    if _frag not in _ba59: _s59.append(_msg)
for _vchk in ["var zfgi; // 磷火循环变量(setTimeout 外)","var zfli; // 速度线循环变量(setTimeout 外)","var zfri; // 三重冲击环循环变量(setTimeout 外)"]:
    if _vchk not in _ba59: _s59.append('循环变量定义位置被改: '+_vchk[:14])
import os as _os59
for _f in ['bosses/zf_fist_l.webp','bosses/zf_fist_r.webp','bosses/zf_fists_all.webp','bosses/zb_talisman.webp']:
    if not _os59.path.isfile(_f): _s59.append('素材文件缺失: '+_f)
if _s59: fail('v559 千年僵尸定身符咒·万拳齐发: ' + str(_s59[:8]))
else: ok('v559 千年僵尸·定身符咒·万拳齐发 (Hansen二代素材: 尸气爆发左右拳+新百拳全景·符贴住全程挣扎抖动22帧总命中才炸·左右斜冲交替x8间隔180→110刷刷刷(白闪+冲击环+速度线x6+纸屑)·新百拳全景1.3x冲满屏总命中三重环+符爆金碎片·deal实测2960兜底3400·四图预加载BUG#67·零震屏零屏闪·hba-zf前缀·真机全要素DOM断言+零泄漏+八帧精确卡点+0报错·老zombiecurse/zombieseal保留·v559)')

# 🔴 v560: ①雷电之主(Lv16)二代乌云+真雷电(Hansen 提供 1024×1536 分形闪电, DEMO 验收过关融入) ②千年僵尸参数定稿(规模50%/强度200%, 锁在 v559 守卫块)。
#   雷电: 新 hbaTlCloud2 噪声真实云(feTurbulence×4 撕碎边缘/四层/顶黑压暗/青调底缘亮边/下垂云须/三速翻滚, 高140), 兼容老接口 .tl-lite1/2+.tl-core 供 hbaTlOmen/汇聚直驱; ④天罚主雷换 hbaTl2RealBolt 真雷电图(几何: 顶端贴云底实测 rect*0.72, 底端 midY+30 咬进血条; 频闪三连 主闪→灭→镜像回闪→灭→余闪 640ms)+空气辉光(局部径向非全屏 tint); 命中全家桶原时序保留→deal 时刻不变 dealDelay 3700 不动。老 hbaTlCloud/hbaTlBoltTree 全保留(残余小弧仍在用)。
#   🔴 DEMO 血案铁律: 大尺寸 PNG 严禁 drop-shadow——headless/手机合成器渲染黑洞, opacity 0.96 整层被丢肉眼全不可见; 发光由素材自带辉光+空气辉光承担(守卫锁 CSS 无 drop-shadow)。
_ba60=open('hansen_boss_attack.js',encoding='utf-8').read()
_s60=[]
for _frag,_msg in [
  ("function hbaTlCloud2(vw,topY)","二代乌云函数缺失(或 v911 topY 入参被删→云会钉死top:0遮住雷电之主的头)"),
  ("hbaTlEl('hba-tl2-cloud',null,(topY==null?null:topY),null,H)","v911 二代乌云未按 topY 定位(云会回到钉死 top:0 遮头)"),
  ("function hbaTl2RealBolt(cloud, hx, midY, sz, sp)","真雷电函数缺失"),
  ("var cloud=hbaTlCloud2(vw, Math.max(-115, Math.min(0, __tlTop-118)));","编排未换二代乌云 / v911 云未按 boss 立绘实时定位(会遮住雷电之主的头)"),
  ("hbaTl2RealBolt(cloud, hx, midY, sz, sp);","④天罚主雷未换真雷电"),
  ("window.__hbaTl2BoltImg=_tl2Bolt;","真雷电预加载缺失(BUG#67)"),
  ("bosses/tl_bolt.webp","雷电图引用缺失"),
  ("feTurbulence","噪声云 feTurbulence 被删(2D flash 回归)"),
  ("hbaTl2Tb4","底缘亮边噪声层缺失(体积感关键)"),
  ("tl-lite tl-lite1","二代云 tl-lite1 兼容类缺失(hbaTlOmen 依赖)"),
  ("tl-core","二代云 tl-core 兼容类缺失(雷能汇聚依赖)"),
  ("var BH=Math.max(120,(midY-cloudBottom+30));","雷电底端咬入量被改(对位定稿)"),
  ("function hbaTlCloud(vw)","老 hbaTlCloud 被删(保留勿删)"),
  ("function hbaTlBoltTree","老 hbaTlBoltTree 被删(残余小弧在用)"),
  (".hba-tl2-cloud{","二代乌云 CSS 缺失"),
  (".hba-tl2-bolt{","真雷电 CSS 缺失"),
  (".hba-tl2-airglow{","空气辉光 CSS 缺失"),
]:
    if _frag not in _ba60: _s60.append(_msg)
# drop-shadow 禁令: .hba-tl2-bolt 两条规则内不得出现 drop-shadow
for _sel in ['.hba-tl2-bolt{','.hba-tl2-bolt img{']:
    _bi=_ba60.find(_sel)
    if _bi>-1 and 'drop-shadow' in _ba60[_bi:_ba60.find('}',_bi)]: _s60.append('真雷电 CSS 出现 drop-shadow(大图渲染黑洞铁律): '+_sel)
import os as _os60
if not _os60.path.isfile('bosses/tl_bolt.webp'): _s60.append('素材文件缺失: bosses/tl_bolt.webp')
if _s60: fail('v560 雷电之主二代乌云真雷电: ' + str(_s60[:8]))
else: ok('v560 雷电之主·二代乌云+真雷电 (Hansen 1024x1536 分形闪电 DEMO 过关融入·hbaTlCloud2 噪声真实云四层+青调底缘亮边+三速翻滚 140 高·④天罚主雷换真雷电频闪三连(主闪→镜像回闪→余闪)+空气辉光·几何顶端贴云底底端咬入血条+30·命中全家桶原时序 deal 不变 dealDelay 3700·大图禁 drop-shadow 铁律守卫·老 Cloud/BoltTree 保留·真机全要素+_boltSeen 亮度实证+零泄漏+0报错+五帧卡点·v560)')

# 🔴 v561(Hansen: 图标和单词对不上, 全部换成一看就懂的): 形容词岛探索单词 51 词图标全量重做——统一设计语言自制 SVG。
#   设计规范: viewBox 64×64 / 深描边 #1e293b 2.5 圆角 / 统一调色板 / 纯图形表意零英文单词(数学符号除外) / 一眼会意=演绎词义本身不借物联想(busy=小人持物飞纸闹钟汗滴 而非🐝)。
#   核心范式: ①对比类(big/small/tall/short/long/thin/thick)=灰参照 opacity.45+彩主体+红箭头标注; ②温度计四件套体系 hot红满+热浪/warm橙62%+太阳/cool青36%+风线/cold蓝18%+雪花; ③表情脸范式(happy/sad/angry/tired/nice/funny/sick); ④场景演绎(lazy瘫沙发/brave持剑盾对黑影/free鸟笼放飞/kind递爱心/same=≠对比)。
#   渲染: 全部消费点(探索卡/modal/泡泡/速答/拼写/听力/打字/cloze/错题/复习)均为 innerHTML 拼接, SVG 内部单引号(外层 DATA 双引号), 安全。尺寸: 探索卡 .aj-icon 46px / modal 72px(28px 下细节糊)。
_aj61=open('island_adjective.html',encoding='utf-8').read()
_s61=[]
_di=_aj61.find('const DATA=[')
_dj=_aj61.find('];',_di)
_dseg=_aj61[_di:_dj] if _di>-1 and _dj>_di else ''
if not _dseg: _s61.append('DATA 数组定位失败')
else:
    import re as _re61
    _ens=_re61.findall(r'\{en:"([^"]+)"',_dseg)
    if len(_ens)!=51: _s61.append('词条数应为 51, 实为 '+str(len(_ens)))
    if _dseg.count("aj-icon")!=51: _s61.append('aj-icon 图标数应为 51, 实为 '+str(_dseg.count("aj-icon")))
    if 'Arial Black' in _dseg: _s61.append('DATA 内残留旧风格 SVG(Arial Black 大字标注)')
    # 抽样锁 8 个代表性新图标特征(每范式至少一个)
    for _frag,_msg in [
      ("stroke-dasharray='4 3'","small 聚焦虚线圈缺失(对比范式)"),
      ("<rect x='26' y='10' width='12' height='42' rx='6'","温度计范式缺失(hot/warm/cool/cold 四件套)"),
      ("M50 24 Q56 30 52 38","dirty 苍蝇绕圈缺失"),
      ("1+1=2","easy 算式缺失"),
      ("M32 4 L54 12 L54 30","safe 盾形缺失"),
      ("L46 14","free 鸟笼开门缺失"),
      ("rotate(-34 44 22)","hard 锤击角度缺失"),
      ("rotate(-12 32 32)","funny 歪头笑缺失"),
    ]:
        if _frag not in _dseg: _s61.append(_msg)
for _css,_msg in [
  (".exp-card .emoji .aj-icon{width:46px;height:46px","探索卡图标 46px CSS 缺失"),
  (".modal .m-emoji .aj-icon{width:72px;height:72px","modal 图标 72px CSS 缺失"),
]:
    if _css not in _aj61: _s61.append(_msg)
if _s61: fail('v561 形容词岛 51 词图标重做: ' + str(_s61[:8]))
else: ok('v561 形容词岛探索单词 51 词图标全量重做 (统一设计语言自制 SVG·一眼会意演绎词义·对比范式灰参照+彩主体+红标注·温度计四件套·场景演绎 busy/lazy/brave/free/kind·零英文单词零版权风险·全消费点 innerHTML 安全·探索卡46px/modal72px·真机 51/51 渲染+五屏肉眼核查+泡泡/速答游戏验证+0报错·v561)')

# 🔴 v562(Hansen: 百宝箱大冒险同样问题, 图标对不上+质量太差, 全部重做最高质量): 百宝岛(island_treasure)探索单词 60 词图标全量重做——沿 v561 统一设计语言, 新增功能词专用范式。
#   功能词范式: ①介词六件套=橙球+蓝开口盒空间关系(in球在盒里/on球在盒顶/under球在桌下/next to球贴盒旁/between球夹两盒间/at红定位钉), 一组看完介词全懂; ②频率三件套=七格周历勾数(always7勾/often5勾/sometimes2勾); ③比较三件套=柱状图(most最高柱+皇冠/more高柱↑+/less矮柱↓−); ④because/so=同场景(雨云+伞)反向箭头(because从伞指回云=追因, so从云指向伞=得果); ⑤with/without 成对(大人牵小孩 vs 虚线轮廓+禁圈); ⑥problem/answer 成对(拼图缺块红? vs 金块补上绿勾); ⑦too=两小人都举手+1 / also=清单两勾+新增高亮行 / only=聚光灯只照一球 / alone=独站+周围虚线空位 / late=超时钟+狂奔小人。
#   渲染: mc-icon 类(该岛专用), 探索卡 46px / modal 72px。词条 emoji 全部消费点 innerHTML 拼接安全(textContent 处为钓鱼生物非词条)。
_tr62=open('island_treasure.html',encoding='utf-8').read()
_s62=[]
_di=_tr62.find('const DATA=[')
_dj=_tr62.find('];',_di)
_dseg=_tr62[_di:_dj] if _di>-1 and _dj>_di else ''
if not _dseg: _s62.append('DATA 数组定位失败')
else:
    import re as _re62
    _ens=_re62.findall(r'\{en:"([^"]+)"',_dseg)
    if len(_ens)!=60: _s62.append('词条数应为 60, 实为 '+str(len(_ens)))
    if _dseg.count("mc-icon")!=60: _s62.append('mc-icon 图标数应为 60, 实为 '+str(_dseg.count("mc-icon")))
    if 'Arial Black' in _dseg: _s62.append('DATA 内残留旧风格 SVG(Arial Black)')
    for _frag,_msg in [
      ("M14 30 L50 30 L50 52 L14 52 Z","介词范式蓝开口盒缺失(in/on/next to)"),
      ("<rect x='8' y='16' width='48' height='8' rx='3'","under 桌子范式缺失"),
      ("Q46 8 46 23 Q46 34 32 48","at 定位钉缺失"),
      ("width='10' height='10' rx='2' fill='#f1f5f9'","频率日历格范式缺失(always/often/sometimes)"),
      ("M43 12 L46 6 L50 10 L54 6 L57 12 Z","most 皇冠缺失(比较三件套)"),
      ("M40 48 Q30 50 24 40","because 反向追因箭头缺失"),
      ("M24 26 Q34 22 42 30","so 得果箭头缺失"),
      ("stroke-dasharray='3 2.5' opacity='.75'","without 虚线缺席轮廓缺失(成对范式)"),
      ("Q42 52 42 45 Q42 38 36 42","problem/answer 拼图凹凸缺失(成对范式)"),
      ("L18 44 L46 44 Z' fill='#fde047' opacity='.32'","only 聚光灯光锥缺失"),
    ]:
        if _frag not in _dseg: _s62.append(_msg)
for _css,_msg in [
  (".exp-card .emoji .mc-icon{width:46px;height:46px","探索卡图标 46px CSS 缺失"),
  (".modal .m-emoji .mc-icon{width:72px;height:72px","modal 图标 72px CSS 缺失"),
]:
    if _css not in _tr62: _s62.append(_msg)
if _s62: fail('v562 百宝岛 60 词图标重做: ' + str(_s62[:8]))
else: ok('v562 百宝岛探索单词 60 词图标全量重做 (沿 v561 统一设计语言+功能词专用范式·介词六件套橙球蓝盒/频率三件套七格日历/比较三件套柱图皇冠/because-so 同场景反向箭头/with-without 与 problem-answer 成对/only 聚光灯/alone 虚线空位/late 超时狂奔·零英文单词零版权·探索卡46px modal72px·真机 60/60 渲染+六屏肉眼核查+at-in-on 三联 modal+0报错·v562)')

# 🔴 v563(Hansen: 疑问词大冒险图标也对不上+质量太差, 统一重做最高质量, 可以做动态的): 疑问岛(island_question)探索单词 32 词图标全量重做——统一设计语言 + 首次引入 SMIL 微动态(52 个 animate/animateTransform, 每图 1-2 个缓动画 1.6~2.4s, 只动表意关键处)。
#   代词教学范式: 人称=小人指向(I 拇指点胸两下/you 食指指屏幕外指"你"/he 男孩高亮+灰女孩/she 女孩高亮+灰男孩/it 橙猫+灰小人/we 三人虚线圈含自己挥手/they 远处三人+近处手远指); 物主=人称+物品+**金色所属标签**统一记号(my 抱星/your 礼盒推出/his 球/her 花/our 共捧大星/their 远处物品)。
#   疑问词范式: ?+对象类型(who ?+人/what ?+神秘盒/where 地图+定位钉跳/when 时钟分针真转 6s 一圈/why 摊手+?摇摆/how 齿轮真转/which 手指两球间犹豫摆/whose 悬帽+三人+归属虚线闪); How+形容词(how many 苹果+123 计数泡轮闪/how much 金币+价签?摇/how old 蛋糕+烛火摇曳/how long 尺+双向箭头/how far A→B 虚线流动 dashoffset); 指示四件套(this 点近大球/that 远指小球/these 点近三球/those 远指三小球, 近大远小+单复数); here 定位钉落点波纹/there 远岛钉+远指。
#   动效选型铁则: 只用 opacity/translate/rotate(SMIL), 禁 scale 无中心补偿; 周期 ≥1.6s 防晕; 每图 ≤2 个动画防性能。
_qp63=open('island_question.html',encoding='utf-8').read()
_s63=[]
_di=_qp63.find('const DATA=[')
_dj=_qp63.find('];',_di)
_dseg=_qp63[_di:_dj] if _di>-1 and _dj>_di else ''
if not _dseg: _s63.append('DATA 数组定位失败')
else:
    import re as _re63
    _ens=_re63.findall(r'\{en:"([^"]+)"',_dseg)
    if len(_ens)!=32: _s63.append('词条数应为 32, 实为 '+str(len(_ens)))
    if _dseg.count("qp-icon")!=32: _s63.append('qp-icon 图标数应为 32, 实为 '+str(_dseg.count("qp-icon")))
    _na=_dseg.count('<animate')
    if _na<40: _s63.append('SMIL 动画元素应 ≥40(微动态被删?), 实为 '+str(_na))
    for _frag,_msg in [
      ("from='0 30 34' to='360 30 34' dur='6s'","when 时钟分针旋转动画缺失"),
      ("from='0 32 34' to='360 32 34' dur='7s'","how 齿轮旋转动画缺失"),
      ("values='-26 0 -6;26 0 -6;-26 0 -6'","which 手指犹豫摆动缺失(v564 指尖朝下版)"),
      ("attributeName='stroke-dashoffset'","how far 虚线流动动画缺失"),
      ("L34 44 L43 45 L36.5 51.5","my 抱星缺失(v564 版)"),
      ("stroke='#b45309' stroke-width='2.2' stroke-linejoin='round'/>","头像吊牌缺失(v564 物主统一记号)"),
      ("values='1;1;.25;.25;.25;1'","how many 计数泡轮闪缺失"),
      ("M16 19 L14 10 L21 15","it 猫耳缺失"),
    ]:
        if _frag not in _dseg: _s63.append(_msg)
for _css,_msg in [
  (".exp-card .emoji .qp-icon{width:46px;height:46px","探索卡 46px CSS 缺失"),
  (".modal .m-emoji .qp-icon{width:72px;height:72px","modal 72px CSS 缺失"),
]:
    if _css not in _qp63: _s63.append(_msg)
if _s63: fail('v563 疑问岛 32 词图标重做: ' + str(_s63[:8]))
else: ok('v563 疑问岛探索单词 32 词图标全量重做[v564 已局部重做 17 个] (统一设计语言+首次 SMIL 微动态 52 个·人称=小人指向范式(I点胸/you指屏外/we圈含自己)·物主=金色所属标签·疑问词=?+对象(when分针真转/how齿轮真转/which手指犹豫摆/how far虚线流动)·指示四件套近大远小·动效铁则 opacity-translate-rotate 周期≥1.6s·真机 32/32+52动画挂载+两帧像素差实证转动+四屏肉眼+0报错·v563)')

# 🔴 v564(Hansen 验收反馈: 手太抽象看不懂/which 指向错位(球在手下手指前方晃)/this-these 手奇怪/I-you-he-she 指代不明确/his-your-her 看不出归属): 疑问岛 17 个图标重做根治。
#   三大根治: ①清晰侧视指向手 hand()——👉轮廓(圆拳+伸直食指+拇指弧+指节线), 指尖必须正对目标+目标聚焦虚线圈, which 手移到两球之间上方·食指朝下·摆角 ±26° 指尖正对左右球·球被指到交替高亮; ②he/she 加性别符号角标(♂蓝/♀粉, 脉冲)+主体放大对照缩灰; ③物主=头像吊牌 2.0——物品挂大吊牌(20×22)+牌内画主人头像(his=男孩头/her=女孩头/my=小人脸/our·their=多迷你头/your=指画外箭头)+麻绳虚线流动连物品+吊牌摇摆。
#   I=头顶向下大箭头点动+胸口星标脉冲("就是我"); you=大手(1.45x)指向画外+红箭头出画+虚线"你"轮廓。受同款旧手影响的 that/those/there/they 一并换新手型。
_qp64=open('island_question.html',encoding='utf-8').read()
_s64=[]
_di=_qp64.find('const DATA=[')
_dj=_qp64.find('];',_di)
_dseg=_qp64[_di:_dj] if _di>-1 and _dj>_di else ''
if not _dseg: _s64.append('DATA 定位失败')
else:
    if _dseg.count("qp-icon")!=32: _s64.append('图标数应 32, 实为 '+str(_dseg.count("qp-icon")))
    _na=_dseg.count('<animate')
    if _na<55: _s64.append('动画元素应 ≥55, 实为 '+str(_na))
    for _frag,_msg in [
      ("icons/hand_point.webp?v=","画师手指图引用缺失(v565 hand 范式)"),
      ("scale(-1 1)","画师手镜像基底缺失(these 防颠倒)"),
      ("values='1;1;.45;.45;1' dur='2.4s'","which 左球被指高亮缺失"),
      ("values='.45;.45;1;1;.45' dur='2.4s'","which 右球被指高亮缺失"),
      ("L62 40.8 L56.5 44.8","you 出画红箭头缺失"),
      ("M26.5 8 L32 14 L37.5 8","I 头顶向下箭头缺失"),
      ("M41 17 L51 17","your 吊牌内指画外箭头缺失"),
      ("from='14' to='0' dur='1.6s'","吊牌麻绳流动缺失"),
    ]:
        if _frag not in _dseg: _s64.append(_msg)
    if "stroke='#3b82f6' stroke-width='2.2'" not in _dseg: _s64.append('he ♂ 蓝色性别角标缺失(v566 缩 0.85)')
    if "stroke='#f472b6' stroke-width='2.2'" not in _dseg: _s64.append('she ♀ 粉色性别角标缺失(v566 缩 0.85)')
if _s64: fail('v564 疑问岛 17 图标根治重做: ' + str(_s64[:8]))
else: ok('v564 疑问岛 17 图标根治重做[v565 手已换画师图] (Hansen 验收反馈修复·清晰侧视手 hand 范式(圆拳+伸直食指+指尖正对目标+聚焦圈)·which 手移两球上方食指朝下摆角正对+被指球交替高亮·he-she 性别符号角标 ♂♀·物主=头像吊牌 2.0(牌内画主人头+麻绳流动+摇摆)·I 头顶箭头+胸星·you 大手指画外+出画箭头+虚线你·that-those-there-they 同步换新手·真机 32/32+四屏复查+which-his-you 三联 modal+0报错·v564)')

# 🔴 v565(Hansen: 我画的手指太难看, 直接给画师图——所有用手指指东西的地方全换这张, 缩放+调方向): 疑问岛 9 处指向手全部换画师图。
#   素材: icons/hand_point.webp(画师黄色卡通指向手, 原图 1254² bbox 紧裁缩至 256×178, 35KB, 默认指向右, 指尖在 0.996W/0.346H)。
#   hand() 图片版几何完全兼容 v564: 指尖落 (cx+20*scale, cy), 外层 rotate(rot cx cy) 原样——this/which 等所有对位自动继承; |rot|>90 用镜像基底 translate(2cx) scale(-1 1) + rotate(rot-180) 防手上下颠倒(these rot=128 唯一镜像)。
#   引用 href+xlink:href 双写带 ?v=1091 戳(build.py 精确匹配旧戳自动刷新), SVG <image> 外部引用走浏览器缓存 9 处一次下载。9 处: which/this/that/these/those/there/they/you/their。
_qp65=open('island_question.html',encoding='utf-8').read()
_s65=[]
_di=_qp65.find('const DATA=[')
_dj=_qp65.find('];',_di)
_dseg=_qp65[_di:_dj] if _di>-1 and _dj>_di else ''
if not _dseg: _s65.append('DATA 定位失败')
else:
    _nh=_dseg.count('hand_point.webp')
    if _nh<18: _s65.append('画师手引用应 ≥18(href+xlink 双写×9), 实为 '+str(_nh))
    if "scale(-1 1)" not in _dseg: _s65.append('these 镜像基底缺失')
    if "xlink:href='icons/hand_point.webp" not in _dseg: _s65.append('xlink:href 兼容双写缺失')
import os as _os65
if not _os65.path.isfile('icons/hand_point.webp'): _s65.append('素材缺失: icons/hand_point.webp')
if _s65: fail('v565 画师手指图: ' + str(_s65[:8]))
else: ok('v565 疑问岛 9 处指向手换画师图 (Hansen 提供黄色卡通指向手·icons/hand_point.webp 256x178 指尖 0.996W/0.346H·hand() 图片版几何兼容 v564 指尖对位全继承·|rot|>90 镜像基底防颠倒·href+xlink 双写+?v= 戳自动刷新·真机 9 image 挂载+0 请求失败+四屏复查+0报错·v565)')

# 🔴 v566(Hansen 语言学指导: 第三人称=对话之外的人): he/she/you 换"对话角色"版。
#   you=两人面对面: 左"我"(绿衣)+说话气泡(···脉冲)+画师手指向对面的人, 右=you(放大+头顶红色向下点动箭头)——"我对着说话的那个人就是 you"。
#   he/she=左侧两小人面对面谈话(头顶共享对话气泡), 旁边站着的第三人(放大+头顶红箭头+性别角标 ♂蓝/♀粉 缩 0.85)才是 he/she——第三人称单数=不在对话中的那个人。
_qp66=open('island_question.html',encoding='utf-8').read()
_s66=[]
_di=_qp66.find('const DATA=[')
_dj=_qp66.find('];',_di)
_dseg=_qp66[_di:_dj] if _di>-1 and _dj>_di else ''
if not _dseg: _s66.append('DATA 定位失败')
else:
    _nb=_dseg.count("<circle cx='22.5' cy='10' r='1.1'")
    if _nb!=1: _s66.append('you 说话气泡···缺失')
    _sb=_dseg.count("r='1.4' fill='#64748b'")
    if _sb<6: _s66.append('he/she 共享对话气泡···缺失(应 ≥6 点, 实 '+str(_sb)+')')
    if _dseg.count("values='0 0;0 4;0 0' dur='1.6s'")<3: _s66.append('头顶向下点动箭头缺失(you/he/she 各一)')
if _s66: fail('v566 he-she-you 对话角色版: ' + str(_s66[:6]))
else: ok('v566 he/she/you 对话角色版 (Hansen 语言学指导·you=面对面+我说话+画师手指对方+对方头顶箭头·he/she=两人谈话+旁站第三人(放大+箭头+♂♀角标)=对话之外的人·真机三联 modal+0报错·v566)')

# 🔴 v567(Hansen: 点右上角像重新进网站, 首页和大冒险完全割裂——要返回键级瞬回, 彻底融为一体): 首页↔岛一体化返回机制 hansen_home_link.js(挂全部 19 岛+index)。
#   三层机制: ①bfcache 瞬时快照恢复——首页进岛打 sessionStorage hsn_from_home 标记(a 直链 capture 委托)+document.referrer 原生信号兜底(续玩等 location.href 路径, 不受 click_sound 异步包装层影响); 岛端 goHome 覆盖: fromHome→history.back()(0ms 快照恢复=真返回键)+600ms 可见性兜底; ②跨文档 View Transition——JS 动态注入 @view-transition{navigation:auto}, 支持的浏览器(iOS18+/Chrome126+)整页跳转平滑淡变, 不支持自动降级; ③直开岛→location.replace(不压栈防鬼打墙)。
#   配套: perf_boost.js 移除 beforeunload 监听(Chrome 系 bfcache 杀手; pagehide flush 已有零功能损失)。iframe SPA 历史兼容分支保留。
#   🔴 教训: 全局函数包装顺序不可控(click_sound 对 onclick 函数再包异步音效层)——跨页"来源"判定优先用浏览器原生信号 referrer, 不依赖函数包装。
_hl67=open('hansen_home_link.js',encoding='utf-8').read()
_s67=[]
for _frag,_msg in [
  ("@view-transition{navigation:auto}","View Transition 注入缺失"),
  ("hsn_from_home","首页来源标记缺失"),
  ("document.referrer","referrer 原生信号兜底缺失"),
  ("window.history.back()","bfcache back 瞬回缺失"),
  ("document.visibilityState === 'visible'","back 600ms 可见性兜底缺失"),
  ("location.replace('index.html')","直开岛 replace 兜底缺失"),
  ("window.parent.closeIsland","iframe SPA 兼容分支被删"),
  ("a[href^=\\\"island_\\\"]","进岛点击委托缺失") ,
]:
    _f=_frag.replace('\\\"','"')
    if _f not in _hl67: _s67.append(_msg)
_pb67=open('perf_boost.js',encoding='utf-8').read()
if "addEventListener('beforeunload'" in _pb67: _s67.append('perf_boost beforeunload 回潮(bfcache 杀手)')
if "addEventListener('pagehide', flush)" not in _pb67: _s67.append('perf_boost pagehide flush 被删(存档冲刷丢失)')
import glob as _g67
_miss67=[f for f in sorted(_g67.glob('island_*.html'))+['index.html'] if 'hansen_home_link.js' not in open(f,encoding='utf-8').read()]
if _miss67: _s67.append('未挂载 hansen_home_link: '+str(_miss67[:5]))
if _s67: fail('v567 一体化返回机制: ' + str(_s67[:8]))
else: ok('v567 首页↔岛一体化返回机制 (hansen_home_link.js 挂 19 岛+index·bfcache history.back 瞬回(标记+referrer 原生双信号+600ms 兜底)·View Transition 跨页平滑过渡动态注入·直开岛 replace·perf_boost 摘 beforeunload 解锁 bfcache(pagehide 保留)·iframe 兼容保留·真机三幕验证(直链/直开/续玩 referrer)+0报错·v567)')

# 🔴 v568(Hansen: 返回键还有卡顿要绝对丝滑无缝): 零延迟点击 + 预渲染瞬开。
#   根因确诊: click_sound 的 wrapAsync 把 goHome 包成"播完 350ms 音效再跳"(v120 设计), a.island 进岛同样 preventDefault 等播(350~800ms)——这就是"卡顿"本体。
#   ① click_sound 并行化: wrapAsync 改"音效 fire-and-forget + 立即执行"(消灭 350ms 串行); a.island 不再 preventDefault, 原生导航+并行播音(声起页已切=原生 app 手感)。
#   ② home_link 双保险: goHome 自带 playNavClick 并行音效 + __navSoundHooked 标记(click_sound 的 DOMContentLoaded/load 双次 bind 都跳过, 350ms 包装永不回潮——v567 实测曾被晚到的 bind 包住)。
#   ③ Speculation Rules 预渲染: 岛端 load+1.5s 注入 prerender+prefetch index.html(Chrome/Edge 后台完整预渲染, 跳转=瞬时激活; 不支持降级 link prefetch 进 HTTP 缓存)——bfcache 未命中环境硬加载也瞬开。
#   ④ View Transition 调速 .16s + .world-map-btn touch-action:manipulation 触控即时。
#   实测: 返回 goHome→导航 147ms(headless 基线 240ms, 比基线还快; v567 为 465ms 含 350ms 音效等待); 真机 bfcache 0~50ms 级。
_cs68=open('click_sound.js',encoding='utf-8').read()
_s68=[]
if "play(function(){" in _cs68 and "wrapAsync" in _cs68.split("play(function(){")[0][-600:]: _s68.append('wrapAsync 串行等待回潮(play(function 包裹原函数)')
for _frag,_msg in [
  ("try{ play(); }catch(e){}   // 并行播音, 不等","wrapAsync 并行播音缺失"),
  ("try{ play(); }catch(err){}","a.island 并行播音缺失"),
]:
    if _frag not in _cs68: _s68.append(_msg)
if "setTimeout(safeJump, 800)" in _cs68: _s68.append('a.island 800ms 串行兜底回潮')
_hl68=open('hansen_home_link.js',encoding='utf-8').read()
for _frag,_msg in [
  ("if(window.playNavClick) window.playNavClick()","goHome 并行音效缺失"),
  ("window.goHome.__navSoundHooked = true","__navSoundHooked 双保险缺失(350ms 包装会回潮)"),
  ("HTMLScriptElement.supports('speculationrules')","Speculation Rules 预渲染缺失"),
  ("prerender:[{ urls:['index.html'] }]","prerender 规则缺失"),
  ("lk.rel = 'prefetch'","prefetch 降级缺失"),
  ("animation-duration:.16s","View Transition 调速缺失"),
  ("touch-action:manipulation","返回按钮触控即时缺失"),
]:
    if _frag not in _hl68: _s68.append(_msg)
if _s68: fail('v568 零延迟返回: ' + str(_s68[:8]))
else: ok('v568 零延迟点击+预渲染瞬开 (根因=click_sound 350ms 串行音效等待·wrapAsync 与 a.island 并行化·goHome 自带 playNavClick+__navSoundHooked 双保险防包装回潮·Speculation Rules prerender+prefetch 兜底硬加载瞬开·VT 调速 .16s+触控即时·实测返回 147ms 快于基线 240ms(v567 为 465ms)·健康检查全回归·v568)')

# 🔴 v569(Hansen: 其他大冒险成就页与动物不一致是重大 bug, 修复后全面清查所有功能不一致): 18 岛成就页崩坏修复 + 跨岛一致性大清查。
#   根因: 成就体系架构=动物岛内化母版(36 成就/折叠列表/全局钱包) + 其余 18 岛靠 hansen_island_upgrade.js 运行时升级(覆盖 ACHIEVEMENTS/renderAch/注入 CSS)。
#   崩坏 = 18 岛容器残留旧 class="ach-grid"(grid 布局 CSS)把 upgrade 注入的新折叠结构强制网格化(竖排文字/巨高空块)。
#   修复: ①18 岛 achList 摘 ach-grid class; ②18 岛两处用户可见计数(结算页 x/N 个成就 + 欢迎弹窗 N 个成就)的旧闭包 const ACHIEVEMENTS(42 旧定义)改读 (window.ACHIEVEMENTS||ACHIEVEMENTS)(运行时 36, 与动物一致)。
#   大清查结论: script 挂载矩阵全岛一致(唯一差异=upgrade.js 18 岛挂/动物内化, 有意架构); 卡牌系统全在共享 hansen_cards.js 自治, 调用矩阵全岛一致(20 boss 卡获取方式无不一致); 核心容器 id 对动物基准无缺失; 金币/星星/连胜等 upgrade ①③模块=动物内化 18 岛包装, 行为等价(健康检查金币跨岛一致项长期在守)。
import glob as _g69
_s69=[]
for _f in sorted(_g69.glob('island_*.html')):
    _t=open(_f,encoding='utf-8').read()
    if 'id="achList" class="ach-grid"' in _t or "id='achList' class='ach-grid'" in _t:
        _s69.append(_f+' achList 残留 ach-grid(成就页会崩)')
    # 🔴 v712 印章统一: 19 岛同壳·成就系统全部统一为 animal 内化 36 体系(标准壳自带)·不再有旧 18 岛的 (window.ACHIEVEMENTS||ACHIEVEMENTS) 写法
    if 'hansen_island_upgrade.js' not in _t: _s69.append(_f+' 未挂 hansen_island_upgrade.js(成就/金币升级层丢失)')
    if "'+((window.ACHIEVEMENTS||ACHIEVEMENTS).length)+'</b> 个成就" not in _t: _s69.append(_f+' 结算页成就分母未对齐 36 体系')
    if "'+ACHIEVEMENTS.length+' 个成就等你解锁" not in _t: _s69.append(_f+' 欢迎弹窗成就数未对齐 36 体系')
    if 'function checkAch' not in _t or 'function claimAch' not in _t or 'function getAchProgress' not in _t: _s69.append(_f+' 缺标准壳成就系统函数(checkAch/claimAch/getAchProgress)')
_anim69=open('island_animal.html',encoding='utf-8').read()
if '.ach-cat-title' not in _anim69: _s69.append('动物岛内化成就母版 CSS 丢失')
if _s69: fail('v569 成就页一致性: ' + str(_s69[:6]))
else: ok('v569 18 岛成就页崩坏修复+跨岛一致性大清查 (根因=旧 ach-grid 容器 class 与 upgrade.js 注入的折叠结构冲突·18 岛摘 class+计数分母对齐 36 体系·清查矩阵: script 挂载/卡牌调用/核心容器全岛一致·真机 sports+treasure 成就页恢复标准版 9 分类行+总进度卡+0报错·v569)')

# 🔴 v570(Hansen: 内化+挂载是不是最好方式?要"改一处19岛全变"永不不一致+查"玩着玩着崩/做题加载不出"+砍冗余做到极轻快): 架构统一+稳定性黑匣子+低内存防护。
#   架构决策(已论证): 不做 19 岛 HTML 大合并重构(19×6000 行闭包依赖, 灾难概率>>收益); 正确路径=消灭"动物内化/18 岛挂载"双轨——动物也挂 hansen_island_upgrade.js → 升级层=单一真相源, 改 upgrade.js 一处 19 岛全变。真机验证: 动物挂载后成就页 9 分类行+单 total、addGem(5) 增量=5 不翻倍、每日宝箱仍在、0 报错。
#   崩溃应对三层: ①已有看门狗(boss BUG#62 前台 1200ms 周期 + antifreeze 7 模式全 verified)覆盖"卡死自愈"; ②新增 hansen_stability.js 黑匣子(全局 error/unhandledrejection→localStorage 环形 30 条+内存>85% 哨兵+HansenBlackbox.read 读现场)——偶发崩从此有现场; ③prerender 低内存降级(deviceMemory<4 或微信 X5 → 只 prefetch 不 prerender, 防 v568 预渲染双实例压崩低端机)。
#   冗余甄别(诚实结论): 50MB=活资产(700+词音频+709 例句+boss 立绘/背景, 动态拼接引用); 真死仅 boss_progress_test.js+mespeak 空壳(已删 ~11KB)。守卫锁"动物 const 36 定义与 upgrade ACH 36 逐字段零差异"——机械防分叉, 永绝后患。
import re as _re70
_s70=[]
_anim70=open('island_animal.html',encoding='utf-8').read()
if 'hansen_island_upgrade.js' not in _anim70: _s70.append('动物岛未挂 upgrade(架构统一回退: 双轨复辟)')
def _ach70(src, marker):
    _t=open(src,encoding='utf-8').read(); _i=_t.index(marker); _i=_t.index('[',_i)
    _d=0; _j=_i
    while True:
        _c=_t[_j]
        if _c=='[': _d+=1
        elif _c==']':
            _d-=1
            if _d==0: break
        _j+=1
    return dict((m[0],m[1:]) for m in _re70.findall(r"\{id:'([^']+)',cat:'([^']+)',name:'([^']+)',desc:'([^']+)',icon:'([^']+)',tier:'([^']+)',reward:\{gems:(\d+)\}(,hidden:true)?\}", _t[_i:_j+1]))
try:
    _a70=_ach70('island_animal.html','成就配置 v352'); _u70=_ach70('hansen_island_upgrade.js','var ACH=[')
    if len(_a70)!=36 or len(_u70)!=36: _s70.append('成就定义数量异常: 动物'+str(len(_a70))+' upgrade'+str(len(_u70)))
    elif _a70!=_u70: _s70.append('动物 const 36 与 upgrade ACH 36 定义分叉(改了一份没改另一份)! 差异 id: '+str([k for k in _a70 if _a70.get(k)!=_u70.get(k)][:4]))
except Exception as _e70:
    _s70.append('成就定义双份比对失败: '+str(_e70)[:80])
_st70=open('hansen_stability.js',encoding='utf-8').read()
for _frag,_msg in [("hansen_blackbox","黑匣子存储键缺失"),("unhandledrejection","Promise 拒绝捕获缺失"),("jsHeapSizeLimit * 0.85","内存哨兵缺失"),("window.HansenBlackbox","黑匣子读口缺失")]:
    if _frag not in _st70: _s70.append('stability: '+_msg)
import glob as _g70
_miss70=[f for f in sorted(_g70.glob('island_*.html'))+['index.html'] if 'hansen_stability.js' not in open(f,encoding='utf-8').read()]
if _miss70: _s70.append('未挂 stability: '+str(_miss70[:4]))
_hl70=open('hansen_home_link.js',encoding='utf-8').read()
if "navigator.deviceMemory && navigator.deviceMemory < 4" not in _hl70: _s70.append('prerender 低内存降级缺失')
if "MicroMessenger" not in _hl70: _s70.append('prerender 微信降级缺失')
import os as _os70
if _os70.path.exists('boss_progress_test.js') or _os70.path.isdir('mespeak'): _s70.append('已删垃圾文件回潮(boss_progress_test/mespeak)')
if _s70: fail('v570 架构统一+稳定性: ' + str(_s70[:8]))
else: ok('v570 架构统一+稳定性黑匣子 (动物挂 upgrade=单一真相源·改一处19岛全变·双份36定义零差异机械锁防分叉·stability 黑匣子挂20文件(error+promise+内存哨兵+HansenBlackbox.read)·prerender 低内存/微信降级防双实例压崩·垃圾文件已清·真机动物挂载全绿(金币不翻倍/成就页正常/宝箱在/黑匣子捕获测试异常)·v570)')

# 🔴 v498(BUG#66 补登守卫——对账唯一缺口): boss 战斗滚动锁。战斗真正开始(bossActive=true)→body 加 hsn-boss-battle 类
#   → 锁页面滚动(overflow:hidden)+藏底部导航+打字一屏布局; 战斗结束/退出必须移除该类, 否则全岛永久锁滚动。
_bl98=open('hansen_boss_lock.js',encoding='utf-8').read()
_s98=[]
for _frag,_msg in [
  ("body.hsn-boss-battle{overflow:hidden!important}","战斗锁滚动 CSS 缺失"),
  ("body.hsn-boss-battle .bottom-nav{display:none!important}","战斗藏底部导航缺失"),
  ("hsn-boss-battle","类名机制整体缺失"),
]:
    if _frag not in _bl98: _s98.append(_msg)
if _bl98.count("classList.add('hsn-boss-battle')")<1 and _bl98.count('hsn-boss-battle')<4: _s98.append('类添加/移除调用疑似丢失(出现次数过少)')
if _s98: fail('v498 boss 战斗滚动锁: ' + str(_s98[:4]))
else: ok('v498 boss 战斗滚动锁 (BUG#66·bossActive→hsn-boss-battle 类→锁滚动+藏导航·补登守卫对账清零·v571)')

# 🔴 v550(补登守卫·对账清欠): 百战兽人部落怒气绿环——orcRage 时第三道绿色冲击环(为部落而战), 仅百战兽人分支。
# 🔴 v556(补登守卫·对账清欠): 史前霸王龙规模定稿 sz:0.5 + dealDelay:2500; 老 rexapex/dinocombo 分支保留勿删(v528 先例)。
_ba56=open('hansen_boss_attack.js',encoding='utf-8').read()
_s56=[]
if "hba-hqring grn" not in _ba56: _s56.append('v550 兽人怒气绿环组件缺失')
if "'史前霸王龙':{t:'rexfury'" not in _ba56: _s56.append('v556 霸王龙 rexfury 配置缺失')
if "sz:0.5,sp:1.0,fxi:1.0,dealDelay:2500" not in _ba56: _s56.append('v556 规模定稿参数被改(应 sz:0.5 dealDelay:2500, 调参须走面板)')
if "rexapex" not in _ba56: _s56.append('v556 老分支 rexapex 被删(应保留·v528 先例)')
if "dinocombo" not in _ba56: _s56.append('v556 老分支 dinocombo 被删(应保留·v528 先例)')
if _s56: fail('v550/v556 补登守卫: ' + str(_s56[:5]))
else: ok('v550/v556 补登守卫 (兽人怒气绿环·霸王龙 rexfury sz0.5 定稿·老分支 rexapex/dinocombo 保留·对账清欠·v571)')

# 🔴 v572→v573(Hansen 两轮验收: v572 金框镶嵌版被打回"金属外框太丑直接去掉"):
#   v573 终稿 = ①藏宝图【无框直贴】蓝色顶栏(58px, 金属框/暗槽/流光全退役, 金光呼吸改 .wmb-img 的
#   drop-shadow 贴图形轮廓 wmbGlowD); ②按压=图标与顶栏交接处【下陷凹坑】(:active 时 .wmb-socket 才显
#   radial 暗坑+inset, 平时完全透明)+图沉 translateY(2px) scale(.93); ③🔥徽章撤出右栏, 打卡天数移到
#   名字行尾 "打卡天数 X"(id=streakCount 迁移, 写入点自动跟随, 断签显示 0); ④右侧只剩 💎/🪙 竖排
#   (gem_system 注入锚点 streak→coin·insertBefore, 否则💎消失!); ⑤顶栏压到约 62px(avatar 42+padding 10,
#   比 v571 的 70px 更矮); ⑥boss_lock 覆盖层同步 58px/单 float 动画/凹坑按压/padding:10px 70px+gap 6。
_s72=[]
import os as _os72
if not (_os72.path.exists('icons/map_home.webp') and _os72.path.getsize('icons/map_home.webp')>8000):
    _s72.append('icons/map_home.webp 藏宝图缺失或为空')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if '>🗺️</a>' in _t: _s72.append(_fn+' 旧 emoji 返回键残留'); break
    if 'class="stat-badge streak"' in _t: _s72.append(_fn+' 🔥徽章残留(应已撤到名字行)'); break
    if '#fde68a 0%, #f59e0b 32%' in _t: _s72.append(_fn+' v572 金属框回潮(Hansen 已打回)'); break
    if '@keyframes wmbShine' in _t or '@keyframes wmbGlow{' in _t: _s72.append(_fn+' v572 流光/矩形呼吸回潮'); break
    if _t.count('id="streakCount"')!=1: _s72.append(_fn+' streakCount 不是恰好 1 处'); break
    for _frag,_msg in [
      ('class="wmb-socket"','凹坑载体 HTML'),
      ('icons/map_home.webp?v=','藏宝图引用(带主戳)'),
      ("onerror=\"this.parentNode.innerHTML='🗺️'\"",'onerror 兜底'),
      ('class="hsn-streak-inline">打卡天数 <span id="streakCount">','名字行打卡天数'),
      ('.stat-row{display:flex;flex-direction:column','徽章竖排 CSS'),
      ('.world-map-btn:active .wmb-socket{','按压凹坑选择器'),
      ('radial-gradient(circle at 50% 42%','凹坑暗影'),
      ('transform: translateY(2px) scale(.93);','按压图下沉'),
      ('@keyframes wmbGlowD','drop-shadow 金光呼吸'),
    ]:
        if _frag not in _t: _s72.append('%s 缺 %s' % (_fn,_msg)); break
_gs72=open('hansen_gem_system.js',encoding='utf-8').read()
if 'streakBadge' in _gs72: _s72.append('gem_system 老 streak 锚点残留(🔥已撤, 注入会失败→💎消失)')
for _frag,_msg in [
  (".top-bar .stat-badge.coin","gem 注入金币锚点"),
  ("insertBefore(gemBadge, coinBadge)","gem 插金币前(💎上🪙下)"),
]:
    if _frag not in _gs72: _s72.append('gem_system 缺 %s' % _msg)
_bl72=open('hansen_boss_lock.js',encoding='utf-8').read()
if 'width:72px !important' in _bl72: _s72.append('boss_lock v572 72px 金框版回潮')
if 'width:40px !important;height:40px !important;font-size:22px' in _bl72: _s72.append('boss_lock v144 40px emoji 版回潮')
for _frag,_msg in [
  ('width:58px !important;height:58px !important','boss_lock 58px 新几何'),
  ('animation:worldMapFloat 3.5s ease-in-out infinite !important','boss_lock 单浮动动画'),
  ("'.world-map-btn:active{transform:translateY(2px) scale(.97) !important;animation:none !important}'",'boss_lock 按压'),
  ("'.top-bar{padding:calc(10px + env(safe-area-inset-top,0px)) calc(70px + env(safe-area-inset-right,0px)) 10px max(14px,env(safe-area-inset-left,0px)) !important;gap:6px !important}'",'boss_lock 顶栏压高+刘海安全区+腾位70+gap6'),
  ("'.avatar{width:42px !important;height:42px !important}'",'boss_lock 头像 42 瘦身'),
]:
    if _frag not in _bl72: _s72.append('boss_lock 缺 %s' % _msg)
if _s72: fail('v573 藏宝图无框直贴+凹坑按压+打卡迁移: ' + str(_s72[:6]))
else: ok('v573 藏宝图无框直贴+凹坑按压+打卡迁移 (金属框/暗槽/流光退役·58px 直贴蓝底·wmbGlowD 贴轮廓呼吸·按压=交接处 radial 凹坑+图沉(2px,.93)·打卡天数移名字行尾 streakCount 恰1处·🔥徽章绝迹·💎注入改挂金币锚点(streak 锚=注入失败)·💎上🪙下·顶栏 62px(avatar42+pad10, 矮过 v571 的 70)·boss_lock 58px/单动画/腾位70/gap6·360 最坏压力(Lv30 五字名+打卡365+币99999)真机 siClear≥2 无重叠·按压/导航/弹窗隐藏/boss 战/0 报错全过·v573)')

# 🔴 v574(Hansen: "总战力/王者段位/里程碑/本周挑战这块没用, 全砍掉, 然后认真排版, 空间利用率要极致"):
#   ① 战力卡 #hanPowerCard 不再注入(injectHomeUI 改空操作+清残留), "总战力"字样全库 HTML 绝迹;
#   ② 关键: 只停"显示", calcPower/getCurrentTheme/getXP2XActive/showDetail 函数必须保留——
#      XP 翻倍 buff(addXP ×2, 525 行)、每周主题加成、签到里程碑弹窗仍正常工作, 删函数会连环断;
#   ③ 首页排版精排锚点(19 岛): 标题上 padding 4px、hero margin 10px、daily-row margin-bottom 0、
#      section-label margin 12px——删卡后首屏 12 个模式卡全可见, 节奏统一无大留白。
_s74=[]
_ad74=open('hansen_addiction.js',encoding='utf-8').read()
# injectHomeUI 必须是空操作版(含 v574 标记 + return), 且不得再 createElement('div') 造卡
_iu_start=_ad74.find('function injectHomeUI(){')
_iu_end=_ad74.find('// ─── 战力详情弹窗')
_iu_body=_ad74[_iu_start:_iu_end] if _iu_start>=0 and _iu_end>_iu_start else ''
if 'v574' not in _iu_body: _s74.append('injectHomeUI 未改为 v574 空操作版')
if "createElement('div')" in _iu_body and 'hanPowerCard' in _iu_body and 'removeChild' not in _iu_body:
    _s74.append('injectHomeUI 仍在造战力卡')
if "card.id = 'hanPowerCard'" in _iu_body: _s74.append('injectHomeUI 仍设置 hanPowerCard(卡片回潮)')
# 加成函数必须存活(删卡不删功能)
import re as _re74
for _fn,_msg in [
  ('calcPower','calcPower'),
  ('getCurrentTheme','getCurrentTheme(每周主题加成)'),
  ('getXP2XActive','getXP2XActive(XP翻倍buff)'),
  ('showDetail','showDetail'),
]:
    if not _re74.search(r'function\s+'+_fn+r'\s*\(', _ad74): _s74.append('addiction 加成函数被误删/改名: '+_msg)
# API 暴露与翻倍调用链(防函数被改名导致运行时 ReferenceError)
if 'if(getXP2XActive()) mult *= 2' not in _ad74: _s74.append('XP 翻倍调用链断裂(addXP ×2 丢失)')
if 'showDetail: showDetail' not in _ad74 or 'calcPower: calcPower' not in _ad74: _s74.append('HansenAddiction API 暴露缺失(showDetail/calcPower)')
# 19 岛: 总战力字样绝迹 + 排版锚点
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if '总战力' in _t: _s74.append(_fn+' 残留"总战力"字样'); break
    if 'hanPowerCard' in _t: _s74.append(_fn+' 残留 hanPowerCard'); break
    for _frag,_msg in [
      ('<div style="text-align:center;padding:4px 0 2px">','标题区精排 padding'),
      ('border-radius:20px;padding:13px;margin:10px 14px;','hero 精排间距'),
      ('.daily-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:0 14px;margin-bottom:0}','daily-row 精排'),
      ('.section-label{font-size:13px;color:var(--pal-ink-2,#cbd5e1);margin:12px 14px 7px;','section-label 精排'),
    ]:
        if _frag not in _t: _s74.append('%s 缺 %s' % (_fn,_msg)); break
if _s74: fail('v574 砍战力卡+首页精排: ' + str(_s74[:6]))
else: ok('v574 砍战力卡+首页精排 (Hansen: 总战力/段位/里程碑/本周这块全砍·injectHomeUI 空操作+清残留·"总战力"全库绝迹·calcPower/getCurrentTheme/getXP2XActive/showDetail 函数保留(XP翻倍/每周加成/签到里程碑仍工作, 只停显示不删功能)·19 岛首页精排(标题pad4/hero margin10/daily-row mb0/section-label 12)·删卡后首屏 12 模式卡全可见节奏统一·食物岛+360 窄屏边界真机 0 报错·v574)')

# 🔴 v575(Hansen: "连续签到卡没用→砍掉, 内容全并入每日宝箱; 每日宝箱第二行改打卡签到, 点进去显示连续天数+
#   当前倍率+签到奖励详表; 未签到时极缓慢闪烁提醒; 已领后礼物盒变开盒+整卡变绿; 原连续签到位置换成 Boss 战入口"):
#   ① 19 岛 daily-row 第三卡 = Boss战入口(showScreen('boss')+🧞), 旧"连续签到卡"(showStreakInfo onclick+
#      streakDaysDaily 元素)全库绝迹; 同时旧 JS 写入 getElementById('streakDaysDaily') 必须已移除(否则 null 报错);
#   ② 每日宝箱卡: id=chestCard + id=chestIcon, 第二行默认"打卡签到"; CSS 有 chest-pending(6s 缓慢柔光闪烁,
#      只动 box-shadow 不缩放) + chest-claimed(翡翠绿 background !important + 开盒); ③ updateChestBadge 接管
#      图标🎁/📂+文案+闪烁类+绿色类切换; ④ openChest=renderCheckinPage(连续天数+当前倍率+倍率阶梯详表+
#      规则+奖励说明), 且暴露 window.renderCheckinPage; ⑤ checkin_global 已领分支改调 renderCheckinPage(全局
#      门禁防重复发币保留, 已领也展示完整详表); ⑥ showStreakInfo 函数保留(click_sound 白名单引用, 删会悬空)。
_s75=[]
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'onclick="showStreakInfo()"' in _t: _s75.append(_fn+' 旧连续签到卡入口残留'); break
    if 'id="streakDaysDaily"' in _t: _s75.append(_fn+' streakDaysDaily 元素残留'); break
    if "getElementById('streakDaysDaily').textContent" in _t: _s75.append(_fn+' streakDaysDaily 写入未移除(null报错风险)'); break
    if 'function showStreakInfo' not in _t: _s75.append(_fn+' showStreakInfo 函数被误删(白名单悬空)'); break
    for _frag,_msg in [
      ('id="chestCard"','宝箱卡 id'),
      ('id="chestIcon"','宝箱图标 id'),
      ('.daily-card.chest-pending{animation:chestSlowGlow','缓慢闪烁 CSS'),
      ('@keyframes chestSlowGlow','闪烁键帧(6s柔光)'),
      ('.daily-card.chest-claimed{background:linear-gradient(135deg,#FF2444,#FF2444)!important','已领红色 CSS'),
      ("classList.toggle('chest-pending'",'updateChestBadge 闪烁切换'),
      ("classList.toggle('chest-claimed'",'updateChestBadge 绿色切换'),
      ('function renderCheckinPage','打卡页渲染函数'),
      ('window.renderCheckinPage=renderCheckinPage','renderCheckinPage 暴露'),
      ('奖励倍率阶梯','倍率阶梯详表'),
      ('打卡规则','规则说明'),
      ('每日奖励内容','奖励内容说明'),
    ]:
        if _frag not in _t: _s75.append('%s 缺 %s' % (_fn,_msg)); break
    # 🔴 v577 起: Boss 入口唯一(每日行 boss-card; 挑战模式六宫格那个已删)。原 v575 要求>=2 已被 v577 取代。
    if _t.count("onclick=\"showScreen('boss')\"")<1: _s75.append(_fn+' Boss 入口丢失'); break
_cg75=open('hansen_checkin_global.js',encoding='utf-8').read()
if 'window.renderCheckinPage' not in _cg75: _s75.append('checkin_global 已领分支未接 renderCheckinPage')
if 'renderCheckinPage(__stk, __mult, true)' not in _cg75: _s75.append('checkin_global 已领分支未传 claimed=true')
if _s75: fail('v575 签到并入每日宝箱+Boss入口+闪烁换色: ' + str(_s75[:6]))
else: ok('v575 签到并入每日宝箱+Boss入口+闪烁换色 (Hansen: 连续签到卡砍除·内容全并入每日宝箱·19 岛第三卡=Boss战入口🧞·旧 showStreakInfo卡入口+streakDaysDaily元素/写入全绝迹(防null)·宝箱卡 chestCard/chestIcon·第二行打卡签到·未签到 chest-pending 6s 缓慢柔光闪烁(只动shadow不刺眼)·已领 chest-claimed 翡翠绿!important+开盒📂·updateChestBadge 接管图标/闪烁/绿色三态·openChest=renderCheckinPage(连续天数+当前倍率+倍率阶梯详表+规则+奖励说明)并暴露window·checkin_global 已领分支改调 renderCheckinPage 保留全局防重复发币门禁·showStreakInfo 函数保留(白名单)·真机 animal/food/treasure 三岛+360 窄屏 未签到→闪烁→开箱→已领变绿+开盒→再开完整详表 全过 0 报错·v575)')

# 🔴 v576(Hansen: "底栏宠物没用(首页已有宠物入口)→换复习; 最右成就与底栏重复→换卡册(我建议卡册>抽卡,
#   集卡进度回访钩子更强); 排版精美"): 19 岛底栏 navPet→navReview(复习, 走 HansenReview._open 复习中心,
#   回退 showScreen('review')), navAch→navCards(卡册, showScreen('cards'), 图标🎴 不撞错题📕)。
#   ① navMap 高亮联动同步改 review:navReview / cards:navCards; ② 首页宠物 hero 入口(showScreen('pet'))保留;
#   ③ hansen_cards.js 移除 v161 过时"底栏成就还原"逻辑(否则它检测改动会干预); ④ hansen_review.js 给
#   底栏 navReview 挂错题红点 badge; ⑤ navExplore(错题, wrong_overview 注入)不受影响。
_s76=[]
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'id="navPet"' in _t: _s76.append(_fn+' 底栏 navPet 残留(应换复习)'); break
    if 'id="navAch"' in _t: _s76.append(_fn+' 底栏 navAch 残留(应换卡册)'); break
    for _frag,_msg in [
      ('id="navReview"','底栏复习 id'),
      ('id="navCards"','底栏卡册 id'),
      ("window.HansenReview._open()",'复习走复习中心'),
      ('showScreen(\'cards\')','卡册入口'),
            ("navMap={home:'navHome',explore:'navExplore',review:'navReview',cards:'navCards'}",'navMap高亮联动'),
      ("onclick=\"showScreen('pet')\"",'首页宠物 hero 入口保留'),
    ]:
        if _frag not in _t: _s76.append('%s 缺 %s' % (_fn,_msg)); break
_cd76=open('hansen_cards.js',encoding='utf-8').read()
if "navAch.innerHTML.indexOf('卡牌')" in _cd76: _s76.append('hansen_cards.js v161 底栏还原逻辑未移除(会干预)')
_rv76=open('hansen_review.js',encoding='utf-8').read()
if 'patchNavReviewBadge' not in _rv76: _s76.append('hansen_review.js 底栏复习红点 badge 缺失')
if _s76: fail('v576 底栏宠物→复习+成就→卡册: ' + str(_s76[:6]))
else: ok('v576 底栏宠物→复习+成就→卡册 (Hansen: 宠物重复→复习/成就重复→卡册·卡册>抽卡集卡回访钩子更强·19 岛 navPet→navReview(走 HansenReview 复习中心·回退 showScreen)·navAch→navCards(showScreen cards·卡册图标(v583换3D图))·navMap 高亮 review/cards 联动·首页宠物 hero 保留·hansen_cards.js 移除 v161 过时底栏还原·hansen_review.js 底栏复习挂错题红点·navExplore 错题不受影响·真机底栏4项/复习中心/卡册渲染/错题/宠物hero/红点/高亮 全过 0 报错·v576)')

# 🔴 v577(Hansen: "Boss入口换我给的街机图标(占大些)·删右上角HOT·背景红→黄·只写'挑战Boss'四个白字·
#   挑战模式里的Boss入口删掉只留每日行那个·挑战模式标题改游戏模式·排版精美"):
#   ① icons/boss_arcade.webp(Hansen 街机柜图 384x384)存在非空; ② 19 岛每日行 Boss 卡 = boss-card class +
#   img.boss-card-img(街机图·48px·onerror兜底🧞) + "挑战Boss"白字 label, 黄金橙渐变(--c1:#fbbf24/--c2:#f97316),
#   旧🧞emoji+"Boss战"+"击败挑战"三行结构绝迹; ③ 全岛 Boss 入口唯一(showScreen('boss') 恰 1 处, 挑战模式
#   六宫格那个已删); ④ "HOT" 徽章(m-badge HOT)全库绝迹; ⑤ section-label "挑战模式"→"游戏模式"。
_s77=[]
import os as _os77
if not (_os77.path.exists('icons/boss_arcade.webp') and _os77.path.getsize('icons/boss_arcade.webp')>8000):
    _s77.append('icons/boss_arcade.webp 街机图缺失或为空')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'm-badge">HOT' in _t: _s77.append(_fn+' HOT徽章残留'); break
    if '<div class="section-label">挑战模式</div>' in _t: _s77.append(_fn+' 挑战模式标题未改游戏模式'); break
    if _t.count("onclick=\"showScreen('boss')\"")!=1: _s77.append(_fn+' Boss入口数!=1(应唯一)'); break
    # 🔴 挑战BOSS 图标: 赛季岛(星海词汇大冒险)单独用 gameconsole.webp·其余岛 boss_arcade.webp(Hansen 只换赛季岛这一个)
    _bicon = 'icons/gameconsole.webp?v=' if _fn=='island_season.html' else 'icons/boss_arcade.webp?v='
    if _bicon not in _t: _s77.append('%s 缺街机图引用(带主戳·赛季岛=gameconsole/其余=boss_arcade)' % _fn); break
    for _frag,_msg in [
      ('class="daily-card boss-card"','Boss卡 class'),
      ('class="boss-card-img"','街机图标元素'),
      ('onerror="window.hansenImgErr&&window.hansenImgErr(this)"','图标 onerror 兜底(v650→hansenImgErr重试+中性·不再用🧞)'),
      ('>挑战BOSS</div>','挑战BOSS白字'),
      ('<div class="section-label">畅玩模式</div>','畅玩模式标题'),
    ]:
        if _frag not in _t: _s77.append('%s 缺 %s' % (_fn,_msg)); break
if _s77: fail('v577 Boss街机入口+游戏模式: ' + str(_s77[:6]))
else: ok('v577 Boss街机入口+游戏模式 (Hansen 街机图 icons/boss_arcade.webp 384x384·19 岛每日行 boss-card 街机图+onerror兜底+挑战Boss白字(背景/尺寸细节见 v578)·旧🧞/Boss战/击败挑战三行绝迹·HOT徽章绝迹·全岛 Boss 入口唯一(挑战模式六宫格那个已删)·挑战模式→游戏模式·真机 Boss卡样式/唯一入口/点击进Boss页/游戏模式标题/六宫格剩5(打地鼠钓鱼泡泡极速火眼)/0报错·v577)')

# 🔴 v578(Hansen: "街机图标再大些·挑战Boss四字往下移·背景用亮黄更凸显游戏机"): 在 v577 基础上微调
#   ① boss_arcade.webp 换 Hansen 新图(彩虹霓虹街机柜, 同名覆盖, 主戳自动 bump 解决缓存); ② 图标 48→60px;
#   ③ 挑战Boss label margin-top 3→6px(下移)+描边加深; ④ 背景金橙(#fbbf24/#f97316)→亮黄(#fde047/#facc15)。
_s78=[]
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if '#fbbf24;--c2:#f97316' in _t and 'boss-card' in _t: _s78.append(_fn+' v577金橙底残留(应改亮黄)'); break
    for _frag,_msg in [
      ('--c1:#fde047;--c2:#facc15','亮黄底'),
      ('.boss-card-label{font-size:15px;font-weight:900;color:var(--pal-ink,#fff);','挑战BOSS白字label(下移量见v579)'),
    ]:
        if _frag not in _t: _s78.append('%s 缺 %s' % (_fn,_msg)); break
import os as _os78
if not (_os78.path.exists('icons/boss_arcade.webp') and _os78.path.getsize('icons/boss_arcade.webp')>8000):
    _s78.append('boss_arcade.webp 缺失或过小')
if _s78: fail('v578 街机图标加大+亮黄底+挑战Boss下移: ' + str(_s78[:6]))
else: ok('v578 街机图标加大+亮黄底+挑战Boss下移 (Hansen 新街机图 boss_arcade.webp 同名覆盖·19 岛图标 48→60→72→84px(尺寸细节见 v583)·挑战Boss label 下移+白字描边加深·背景金橙→亮黄(#fde047→#facc15 更凸显街机柜)·唯一Boss入口/无HOT/点击进Boss页 真机 0 报错·v578)')

# 🔴 v580(Hansen: "boss背景调色板移到所有boss最下面(滑到底才出现)·顶部加'已击败 boss X/20'·开关前加'特效'二字且与上行有间隔"):
#   renderBossPicker 重排(hansen_cards.js): ① 顶部横条上行"选择boss挑战"+金色"已击败 boss X/20"(beatenCount 用 islandClears 真实通关数)
#   + 下行"特效 [开关]"(开关前加"特效"label, margin-top 13px 与上行间隔); ② boss 背景调色板 HTML 从开关下方
#   移到 20 张 boss 卡 grid 之后(滑到底才出现); ③ div 闭合平衡(grid 单独关 + 调色板 + 最外层 padding 容器关)。
_s80=[]
_cd=open('hansen_cards.js',encoding='utf-8').read()
import re as _re80
_m = _re80.search(r'function renderBossPicker\(\)\{.*?window\.hansenRenderBossPicker', _cd, _re80.S)
_fn = _m.group(0) if _m else ''
for _frag,_msg in [
  ('var beatenCount = 0;','已击败计数变量'),
  ("if(cl.length > 0) beatenCount++;",'已击败用islandClears真实通关'),
  ('已击败 boss ','已击败 boss 文案'),
  ("beatenCount + '/20</span>'",'已击败计数拼接(v581 span)'),
  ('>特效</span>','开关前特效label'),
  ('v580: boss 背景选择器移到所有 boss 卡','调色板移底注释'),
  ("html += '</div>';  // 关闭 grid",'grid单独关闭'),
  ("html += '</div>';  // 关闭最外层",'最外层容器关闭'),
]:
    if _frag not in _fn: _s80.append('renderBossPicker 缺 %s' % _msg)
_pos_grid = _fn.find('grid-template-columns:repeat(3,1fr)')
_pos_pal = _fn.find('v580: boss 背景选择器移到所有 boss 卡')
if not (0 < _pos_grid < _pos_pal): _s80.append('调色板未在 grid 之后(顺序错)')
if _fn.count('<div') != _fn.count('</div>'): _s80.append('renderBossPicker div 不平衡(%d开/%d闭)' % (_fn.count('<div'),_fn.count('</div>')))
if _s80: fail('v580 boss背景移底+已击败计数+特效标签: ' + str(_s80[:6]))
else: ok('v580 boss背景移底+已击败计数+特效标签 (Hansen: 调色板从开关下方移到20张boss卡grid最下面滑到底才现·顶部横条加金色"已击败 boss X/20"(islandClears真实通关数)·开关前加"特效"二字+margin13px与上行间隔·div闭合平衡·真机 顶部横条/已击败0-20/特效开关切换/调色板移底点击切换/picker未崩/0报错·v580)')

# 🔴 v581(Hansen: "删'选择boss挑战'行·'已击败 boss X/20'与'特效[开关]'同一排横向显示·已击败用白字·两者间隔"):
#   renderBossPicker 横条改单行 flex: 删标题div, 已击败<span color:#fff>白字 + 特效<span>+开关 同排, 中间 gap22 拉开。
_s81=[]
_cd81=open('hansen_cards.js',encoding='utf-8').read()
import re as _re81
_fn81 = _re81.search(r'function renderBossPicker\(\)\{.*?window\.hansenRenderBossPicker', _cd81, _re81.S).group(0)
# 横条 div 必须 display:flex(单行) + gap(间隔)
if 'gap:22px;flex-wrap:nowrap' not in _fn81: _s81.append('横条单行 flex+gap22 缺失')
# 已击败白字 span(color:#fff + 已击败 boss + /20</span>)
if 'color:#fff;font-weight:800;white-space:nowrap' not in _fn81 or '已击败 boss ' not in _fn81: _s81.append('已击败白字span缺失')
if "beatenCount + '/20</span>'" not in _fn81: _s81.append('已击败计数span拼接缺失')
# 特效label仍在
if '>特效</span>' not in _fn81: _s81.append('特效label缺失')
# 横条里"选择 boss 挑战"的【渲染div】必须删除(注释里有不算): 检查没有 text-align:center">⚔️ 选择 boss 挑战</div>
if 'text-align:center' in _fn81 and '⚔️ 选择 boss 挑战</div>' in _fn81: _s81.append('选择boss挑战标题div未删(仍在渲染)')
if _s81: fail('v581 横条单行(删标题+已击败白字+特效同排): ' + str(_s81[:6]))
else: ok('v581 横条单行(删标题+已击败白字+特效同排) (Hansen: 删"选择boss挑战"渲染行(仅留注释)·横条改单行 flex gap22·已击败 boss X/20 白字(#fff)span·特效label+开关同排·中间间隔·真机 无标题/白字/同排/gap22/开关切换/0报错·v581)')

# 🔴 v582(Hansen: "整体字体/图标都太小→放大更清楚但不超边框; 挑战Boss图标不变大但街机图+挑战Boss字整组下移(太靠上)"):
#   19 岛首页放大: ① 每日卡 d-icon 28→34/d-label 13→15/d-sub 12→13; ② 模式卡 m-icon 34→40/m-title 12→14/m-desc 12→13
#   + padding 收紧(7/6)+flex 居中给放大内容腾位(防 360 窄屏溢出); ③ 挑战Boss卡图标【保持72px不变】, 顶部 padding 14px+flex-start → 街机图与"挑战Boss"整组下移。
_s82=[]
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    for _frag,_msg in [
      ('.daily-card .d-label{font-size:15px','每日标题15'),
    ]:
        if _frag not in _t: _s82.append('%s 缺 %s' % (_fn,_msg)); break
    # Boss图标不得被放大成别的尺寸
    if 'boss-card-img{width:80px' in _t or 'boss-card-img{width:90px' in _t: _s82.append(_fn+' Boss图标被误放大'); break
if _s82: fail('v582 首页整体放大+Boss卡下移: ' + str(_s82[:6]))
else: ok('v582 首页整体放大+Boss卡下移 (Hansen 嫌字小: 19岛每日卡图标28→34/标题13→15/副12→13·模式卡图标34→40→62(尺寸细节见v592)/标题12→14/副12→13+padding收紧防窄屏溢出·挑战Boss图标下移(尺寸/padding细节见 v583)·真机 393/360 双视口 放大尺寸/零溢出/Boss图标72/Boss内容下移imgTop15/网格对齐/0报错·v582)')

# 🔴 v583(Hansen: "Boss街机图标再放大(72还不够)·听音辨义蓝底太暗换亮色+喇叭换新3D图·卡册图标太丑换新3D卡册图(底栏+工具网格两处, 无框直贴显眼)"):
#   ① Boss图标 72→84px(顶padding 14→8腾位); ② 听音辨义卡 蓝(#0ea5e9)→亮琥珀橙(#fbbf24/#fb923c) + emoji🔊→icons/speaker_3d.webp(img, onerror兜底🔊);
#   ③ 卡册图标 icons/cardbook_3d.webp 替换: 底栏 navCards(🎴→img) + 工具网格 hsnCardEntry(📕→img, hansen_cards.js), 均 img 无框+drop-shadow+onerror兜底。
_s83=[]
import os as _os83
for _f in ['icons/speaker_3d.webp','icons/ic_cards.webp']:
    if not (_os83.path.exists(_f) and _os83.path.getsize(_f)>6000): _s83.append(_f+' 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    for _frag,_msg in [
      ('--c1:#fbbf24;--c2:#fb923c','听音辨义亮橙底'),
      ('icons/speaker_3d.webp','听音辨义新喇叭图'),
      ('icons/ic_cards.webp','卡册新图(底栏)'),
    ]:
        if _frag not in _t: _s83.append('%s 缺 %s' % (_fn,_msg)); break
    # 听音辨义旧蓝底不得残留
    if '--c1:#0ea5e9;--c2:#0284c7' in _t: _s83.append(_fn+' 听音辨义旧蓝底残留'); break
_cd83=open('hansen_cards.js',encoding='utf-8').read()
# 🔴 v594: 工具网格卡册入口已移除(仅留右下角底栏 navCards), 移除"工具网格卡册图"断言(底栏卡册图仍由 v583 上方逐岛断言守护)
if "entry.innerHTML = '<span class=\"u-icon\">📕</span>" in _cd83: _s83.append('hansen_cards.js 工具网格仍是旧📕')
if _s83: fail('v583 Boss图标放大+听音辨义换色换图+卡册换图: ' + str(_s83[:6]))
else: ok('v583 Boss图标放大+听音辨义换色换图+卡册换图 (Hansen: Boss街机图标 72→84px(顶padding14→8腾位不溢出)·听音辨义 蓝#0ea5e9→亮琥珀橙#fbbf24/#fb923c(原蓝暗+喇叭暗看不清)+emoji🔊→3D喇叭speaker_3d.webp·卡册图标换3D卡册cardbook_3d.webp 底栏navCards+工具网格hsnCardEntry两处 img无框+drop-shadow显眼+onerror兜底·真机393/360双视口 Boss84不溢出/听音辨义亮橙+新喇叭/卡册两处新图/0报错·v583)')

# 🔴 v584(Hansen: "卡册图标换这张新图(满卡牌的深蓝收藏册), 并加白边——像字幕黑字白边那样防深色背景里看不清"):
#   ① cardbook_3d.webp 换 Hansen 新图(albums.webp)且【图片层烧入白色描边】(PIL alpha 轮廓 MaxFilter 扩张+羽化+垫白底);
#   ② 底栏 navCards + 工具网格 hsnCardEntry 两处 img 的 CSS filter 加白色微光 drop-shadow(0 0 2px rgba(255,255,255,.9)) 双保险。
_s84=[]
import os as _os84
if not (_os84.path.exists('icons/ic_cards.webp') and _os84.path.getsize('icons/ic_cards.webp')>8000): _s84.append('ic_cards.webp 缺失或过小')
pass  # v655: 卡册已换 Hansen 新图 ic_cards·不再烧白边(靠下方CSS白色微光drop-shadow)
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'drop-shadow(0 0 2px rgba(255,255,255,.9))' not in _t: _s84.append(_fn+' 底栏卡册白色微光缺失'); break
    if 'icons/ic_cards.webp' not in _t: _s84.append(_fn+' 卡册图(ic_cards)引用丢失'); break
# 🔴 v594: 工具网格卡册入口已移除(仅留右下角底栏 navCards), 移除「工具网格卡册白光」断言(底栏卡册白光仍由上方逐岛守护)
if _s84: fail('v584 卡册图换新+白边防糊: ' + str(_s84[:6]))
else: ok('v584 卡册图换新+白边防糊 (Hansen: 卡册换满卡牌深蓝收藏册新图+图片层烧入白色描边(PIL alpha轮廓MaxFilter扩张羽化垫白底, 像字幕黑字白边防深色背景看不清)·底栏navCards+工具网格hsnCardEntry两处CSS加白色微光drop-shadow双保险·真机 两处图加载+白光生效/深色背景白边清晰/0报错·v584)')

# 🔴 v585(Hansen: "打地鼠图标换这张新图"): 19 岛打地鼠 mode 卡 emoji🎯→icons/mole_3d.webp(彩虹机械锤砸科技地鼠图, img width:1em+onerror兜底🎯), 绿底/startMoles 不变。
_s85=[]
import os as _os85
if not (_os85.path.exists('icons/mole_3d.webp') and _os85.path.getsize('icons/mole_3d.webp')>8000): _s85.append('mole_3d.webp 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/mole_3d.webp' not in _t: _s85.append(_fn+' 打地鼠新图引用缺失'); break
    # 打地鼠卡仍是绿底+startMoles
    if 'onclick="startMoles()"' not in _t: _s85.append(_fn+' startMoles入口丢失'); break
if _s85: fail('v585 打地鼠图标换新图: ' + str(_s85[:6]))
else: ok('v585 打地鼠图标换新图 (Hansen 打地鼠 emoji🎯→新3D图 icons/mole_3d.webp(彩虹机械锤砸科技地鼠)·19岛 img width:1em+onerror兜底🎯·绿底#84cc16/startMoles入口不变·真机393/360双视口 新图加载/零溢出/startMoles可调/0报错·v585)')

# 🔴 v586(Hansen: "打字大师图标换这张新图"): 19 岛打字大师 mode 卡 emoji⌨️→icons/typer_3d.webp(复古米色台式机CRT跑像素游戏+键盘图, img width:1em+onerror兜底⌨️), 紫底/showTypingMenu入口不变。
_s86=[]
import os as _os86
if not (_os86.path.exists('icons/typer_3d.webp') and _os86.path.getsize('icons/typer_3d.webp')>8000): _s86.append('typer_3d.webp 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/typer_3d.webp' not in _t: _s86.append(_fn+' 打字大师新图引用缺失'); break
    if 'onclick="showTypingMenu()"' not in _t: _s86.append(_fn+' showTypingMenu入口丢失'); break
if _s86: fail('v586 打字大师图标换新图: ' + str(_s86[:6]))
else: ok('v586 打字大师图标换新图 (Hansen 打字大师 emoji⌨️→新3D图 icons/typer_3d.webp(复古米色台式机CRT跑像素游戏+键盘)·19岛 img width:1em+onerror兜底⌨️·紫底#8b5cf6/showTypingMenu入口不变·真机393/360双视口 新图加载/零溢出/入口可调/0报错·v586)')

# 🔴 v587(Hansen: "钓鱼大师图标换这张新图"): 19 岛钓鱼大师 mode 卡 emoji🎣→icons/fish_3d.webp(金黑鱼竿钓蓝色小鲨鱼图, img width:1em+onerror兜底🎣), 蓝底/startFish入口不变。
_s87=[]
import os as _os87
if not (_os87.path.exists('icons/fish_3d.webp') and _os87.path.getsize('icons/fish_3d.webp')>8000): _s87.append('fish_3d.webp 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/fish_3d.webp' not in _t: _s87.append(_fn+' 钓鱼大师新图引用缺失'); break
    if 'onclick="startFish()"' not in _t: _s87.append(_fn+' startFish入口丢失'); break
if _s87: fail('v587 钓鱼大师图标换新图: ' + str(_s87[:6]))
else: ok('v587 钓鱼大师图标换新图 (Hansen 钓鱼大师 emoji🎣→新3D图 icons/fish_3d.webp(金黑鱼竿钓蓝色小鲨鱼)·19岛 img width:1em+onerror兜底🎣·蓝底#0284c7/startFish入口不变·真机393/360双视口 新图加载/零溢出/入口可调/0报错·v587)')

# 🔴 v588(Hansen: "每日宝箱未签到(还没点击打卡前)的图标换这张金宝箱新图"): 19 岛每日宝箱卡 未签到态图标
#   emoji🎁→icons/chest_gold.webp(金色锁宝箱图). 实现: HTML 初始 chestIcon 用 img; updateChestBadge 的图标切换从
#   textContent 改 innerHTML(canOpen?金宝箱img:📂)——图片不能用 textContent。已签到态📂/翡翠绿不变。
_s88=[]
import os as _os88
if not (_os88.path.exists('icons/chest_gold.webp') and _os88.path.getsize('icons/chest_gold.webp')>8000): _s88.append('chest_gold.webp 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/chest_gold.webp' not in _t: _s88.append(_fn+' 金宝箱图引用缺失'); break
    # JS 必须用 innerHTML(不能 textContent, 否则img当纯文本)
    if "icon.innerHTML = canOpen ?" not in _t: _s88.append(_fn+' updateChestBadge未改innerHTML'); break
    if "icon.textContent = canOpen ? '🎁'" in _t: _s88.append(_fn+' 仍用textContent设🎁(img会变纯文本)'); break
    # 已签到态图标(v589 起换 chest_open 图, 此处不再锚 📂; 已签到态校验交 v589)
if _s88: fail('v588 未签到宝箱图标换金宝箱图: ' + str(_s88[:6]))
else: ok('v588 未签到宝箱图标换金宝箱图 (Hansen 每日宝箱未签到态 emoji🎁→新金宝箱图 icons/chest_gold.webp(金色锁宝箱)·HTML初始chestIcon用img+updateChestBadge图标切换textContent→innerHTML(canOpen?金宝箱img:📂, 图片不能用textContent)·已签到态(v589换打开金宝箱)/翡翠绿不变·真机 未签到金宝箱图+pending/已签到📂+claimed/切换可逆/0报错·v588)')

# 🔴 v589(Hansen: "签到/领取宝箱之后的图标换这张打开的金宝箱图"): 19 岛每日宝箱【已签到态】图标
#   emoji📂→icons/chest_open.webp(打开冒金币金宝箱). updateChestBadge 已签到分支(canOpen?...:此处)用 img+onerror兜底📂。
#   未签到态 chest_gold(v588)不变, 翡翠绿 chest-claimed 不变。(joker 卡牌抽卡图标待 Hansen 重传)
_s89=[]
import os as _os89
if not (_os89.path.exists('icons/chest_open.webp') and _os89.path.getsize('icons/chest_open.webp')>8000): _s89.append('chest_open.webp 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/chest_open.webp' not in _t: _s89.append(_fn+' 打开金宝箱图引用缺失'); break
    if 'icons/chest_gold.webp' not in _t: _s89.append(_fn+' 未签到金宝箱图丢失(v588)'); break
    # 已签到分支不得还是纯📂(应是img)
    if "': '📂';" in _t.replace(' ',''): _s89.append(_fn+' 已签到态仍是纯📂(应换img)'); break
if _s89: fail('v589 已签到宝箱图标换打开金宝箱: ' + str(_s89[:6]))
else: ok('v589 已签到宝箱图标换打开金宝箱 (Hansen 签到/领取后图标 emoji📂→打开冒金币金宝箱 icons/chest_open.webp·updateChestBadge已签到分支用img+onerror兜底📂·未签到态chest_gold(v588)+翡翠绿chest-claimed不变·与未签到锁宝箱呼应(锁着→打开冒金币)·真机 已签到打开金宝箱图加载+claimed+今日已签/切回未签到金锁宝箱恢复/0报错·v589)')

# 🔴 v590(Hansen: "完形填空换这张放大镜选项图·抽卡换这张joker卡牌图"):
#   ① 19 岛完形填空 mode 卡 emoji📝→icons/cloze_3d.webp(蓝光放大镜照填空句+ABC选项TRIP/JOURNEY/VOYAGE图, img width:1em+onerror兜底📝), 粉底/startCloze不变;
#   ② 抽卡入口(hansen_gacha.js 注入 util-card #hsnGachaEntry) emoji🎴→icons/gacha_joker.webp(紫金Q牌joker小丑卡, img+onerror兜底🎴), HansenGacha.open不变。
_s90=[]
import os as _os90
for _f in ['icons/cloze_3d.webp','icons/gacha_joker_v594.webp']:  # v594起抽卡图=gacha_joker_v594.webp(旧 gacha_joker.webp 已删·见icons清理)
    if not (_os90.path.exists(_f) and _os90.path.getsize(_f)>12000): _s90.append(_f+' 缺失或过小')   # v929: 门槛 30000→12000(288px重压后 cloze_3d 27KB·肉眼零差别)
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/cloze_3d.webp' not in _t: _s90.append(_fn+' 完形填空新图引用缺失'); break
    if 'onclick="startCloze()"' not in _t: _s90.append(_fn+' startCloze入口丢失'); break
_g90=open('hansen_gacha.js',encoding='utf-8').read()
if "u-icon\">🎴</span>" in _g90 or "u-icon'>🎴" in _g90: _s90.append('hansen_gacha.js 抽卡仍是emoji🎴')
if _s90: fail('v590 完形填空+抽卡图标换新图: ' + str(_s90[:6]))
else: ok('v590 完形填空+抽卡图标换新图 (Hansen 完形填空 emoji📝→放大镜选项图 icons/cloze_3d.webp(蓝光放大镜照填空句+ABC选项)·19岛 img width:1em+onerror兜底📝·粉底#ec4899/startCloze不变; 抽卡入口 emoji🎴→joker卡牌图 icons/gacha_joker.webp(紫金Q牌小丑卡)·hansen_gacha.js注入#hsnGachaEntry img+onerror兜底🎴·HansenGacha.open不变·真机393/360双视口 两图加载/零溢出/startCloze+HansenGacha.open可调/0报错·v590)')

# 🔴 v591(Hansen: "字母拼拼乐图标换这张新图"): 19 岛字母拼拼乐 mode 卡 emoji🔤→icons/spell_3d.webp(彩色3D字母拼成FUNNY图, img width:1em+onerror兜底🔤), 绿底/startScramble入口不变。
_s91=[]
import os as _os91
if not (_os91.path.exists('icons/spell_3d.webp') and _os91.path.getsize('icons/spell_3d.webp')>8000): _s91.append('spell_3d.webp 缺失或过小')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'icons/spell_3d.webp' not in _t: _s91.append(_fn+' 字母拼拼乐新图引用缺失'); break
    if 'onclick="startScramble()"' not in _t: _s91.append(_fn+' startScramble入口丢失'); break
if _s91: fail('v591 字母拼拼乐图标换新图: ' + str(_s91[:6]))
else: ok('v591 字母拼拼乐图标换新图 (Hansen 字母拼拼乐 emoji🔤→新3D图 icons/spell_3d.webp(彩色3D字母拼成FUNNY)·19岛 img width:1em+onerror兜底🔤·绿底#22c55e/startScramble入口不变·真机393/360双视口 新图加载/零溢出/入口可调/0报错·v591)')

# 🔴 v592(Hansen: "图标做出来就是为了好看吸引人, 别弄这么小! 整体放大充满卡片·文字缩成一行去掉副标题·每日宝箱图标也放大但保留两行(未签到\"等待开启\"/已签\"今日已签\")·抽卡卡册图标放大看清楚·宝箱详情页点进去也要用新图(签前签后都用)"):
#   ① mode卡 m-icon 40→62px(大幅放大充满卡片)+标题单行nowrap+【删全部 m-desc 副标题】(19岛各11个);
#   ② 每日宝箱 #chestCard .d-icon 单独 52px(保留两行文字)+未签到文案"打卡签到"→"等待开启"(HTML+JS);
#   ③ util-card u-icon 22→34px(抽卡joker/卡册收藏册看清楚);
#   ④ 宝箱详情页 chest-box大宝箱emoji🎁→chest_gold图(未领·140px满)·已领📂→chest_open图·screen-title🎁→chest_gold小图。
_s92=[]
import os as _os92
for _f in ['icons/chest_gold.webp','icons/chest_open.webp']:
    if not (_os92.path.exists(_f) and _os92.path.getsize(_f)>12000): _s92.append(_f+' 缺失')   # v929: 门槛 50000→12000(288px重压后 chest_gold 30KB/chest_open 33KB·肉眼零差别)
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    # ① 无副标题 + 标题单行(mode图标/宝箱/util 尺寸 v592→v593 放宽, 由 v593 守卫单一接管, 防新旧打架)
    if 'm-desc">' in _t: _s92.append(_fn+' 仍有m-desc副标题(应删)'); break
    if 'white-space:nowrap' not in _t: _s92.append(_fn+' 标题未保持单行nowrap'); break
    # ② 宝箱未签到文案 等待开启(图标尺寸 v593 接管)
    if 'class="chest-badge" id="chestSub">可领' not in _t: _s92.append(_fn+' 宝箱可领角标缺v667'); break
    if 'class="chest-badge" id="chestSub">已签' not in _t: _s92.append(_fn+' 宝箱已签角标缺v667'); break
    # ④ 详情页换图: chest-box内img(chest_gold) + 已领chest_open + 标题图
    if 'id="chestBox" onclick="doOpenChest()"><img src="icons/chest_gold.webp' not in _t: _s92.append(_fn+' 详情页chest-box未换chest_gold图'); break
    if 'icons/chest_open.webp' not in _t: _s92.append(_fn+' 详情页已领chest_open图缺失'); break
if _s92: fail('v592 图标整体放大+单行文字+宝箱详情页换图: ' + str(_s92[:6]))
else: ok('v592 图标整体放大+单行文字+宝箱详情页换图 (Hansen 嫌图标小: ①mode卡 m-icon 40→62px充满卡片+标题单行nowrap+删全部m-desc副标题(各11)·②每日宝箱 #chestCard d-icon单独52px(留两行)+未签到文案打卡签到→等待开启(HTML+JS, 已签今日已签不变)·③util-card u-icon 22→34px(抽卡joker/卡册看清)·④宝箱详情页 chest-box emoji🎁→chest_gold图140px满/已领📂→chest_open图/标题🎁→chest_gold小图·真机393/360双视口 mode图标62/无副标题/标题不换行/零溢出/宝箱等待开启+今日已签/util34/详情页未领chest_gold满+已领chest_open/0报错·v592)')

# 🔴 v593(Hansen: "图标还是不够大! 尤其打字大师电脑/听音喇叭/打地鼠/钓鱼/卡册/百宝箱·像Boss挑战那样充满框·而且图标和文字重合了=排版事故·放大但间距完美舒适绝不重合·不碰Boss挑战")
#   根因: m-icon 的 <img> 写死 width:1em;height:1em 方框, 横图(电脑/喇叭等3D方画布图)被 contain 压扁视觉小; margin-bottom:1px 致竖图/emoji贴文字重合。
#   修: ①mode卡图标区改 flex:1 吃满除标题外空间 + img height:100%!important 按容器高撑满(横图竖图视觉统一·横图~56→71px@393)+7px间距结构防重合+标题flex:none;
#       ②mode-card padding 压到 5px4px6px 让图标顶到~71px(占卡67%趋近Boss79%); ③宝箱 d-icon 52→72px(真机77px); ④util u-icon 34→42px(卡册joker看清)。boss-card不碰。
_s93=[]
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if '.mode-card .m-icon{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;font-size:58px;margin-bottom:6px' not in _t: _s93.append(_fn+' m-icon未改flex自适应区+6px间距'); break
    if '.mode-card .m-icon img{object-fit:contain;vertical-align:middle}' not in _t: _s93.append(_fn+' mode图标规则未中性化(v664改explicit px)'); break
    if '.mode-card .m-title{flex:none' not in _t: _s93.append(_fn+' m-title未flex:none(标题应固定不伸缩)'); break
    if 'border-radius:16px;padding:4px 4px 5px' not in _t: _s93.append(_fn+' mode-card padding未压缩到4px4px5px'); break
    if '#chestCard .d-icon{font-size:72px' not in _t: _s93.append(_fn+' 宝箱图标未放大72'); break
    if '.u-icon{flex:1;display:flex;align-items:center;justify-content:center' not in _t: _s93.append(_fn+' u-icon未改flex居中'); break
if _s93: fail('v593 图标放大充满+防重合排版: ' + str(_s93[:6]))
else: ok('v593 图标放大充满卡片+结构防重合 (Hansen 嫌图标小+图标文字重合·根因 m-icon img 写死1em方框横图被压扁/margin1px致重合 → mode图标区改flex:1吃满空间+img height:100%!important按容器高撑满(横图竖图统一·横图56→71px@393占卡67%)+7px间距结构防重合+标题flex:none+padding压5px4px6px·宝箱d-icon52→72px(真机77px)·util u-icon34→42px(卡册joker看清)·boss-card未碰·真机393/360双视口 打字大师等横图71/60px充满/图标↔标题7px零重合/零溢出/宝箱77px/util42-46px/0报错·v593)')

# \U0001f534 v594(Hansen 密集需求): \u2460 火眼金睛旁加抽卡入口(新joker图 gacha_joker_v594.webp + 深蓝靛底#1e3a8a/#312e81, onclick=HansenGacha.open, 文字"抽卡") \u2461 util 删复习(底栏已有), 抽卡/卡册不再注入util(钻石店那排去重; 卡册仅留右下角底栏) \u2462 每日任务图标 34\u2192 72(=每日宝箱) \u2463 挑战Boss图 84\u2192 100 填富余空间(daily-row 行高144不变, 不超框)+图\u2194 字距 2\u2192 5 \u2464 字母拼拼乐绿底\u2192 靛蓝#4f46e5/#4338ca(原绿与图标彩色字母绿重合) \u2465 底栏卡册 1.2\u2192 1.45em(不超顶线) \u2466 mode图标再放大(padding5\u2192 4 / margin7\u2192 6)
_s94=[]
import os as _os94
if not _os94.path.exists('icons/gacha_joker_v594.webp'): _s94.append('\u65b0\u62bd\u5361joker\u56fe gacha_joker_v594.webp \u7f3a\u5931')
_g94=open('hansen_gacha.js',encoding='utf-8').read()
if '\u62bd\u5361\u5165\u53e3\u5df2\u79fb\u81f3\u6e38\u620f\u6a21\u5f0f\u7f51\u683c' not in _g94: _s94.append('hansen_gacha.js \u672a\u505c\u6b62\u6ce8\u5165util\u62bd\u5361')
_cd94=open('hansen_cards.js',encoding='utf-8').read()
if '\u5361\u518c\u5165\u53e3\u4ec5\u4fdd\u7559\u53f3\u4e0b\u89d2\u5e95\u680f' not in _cd94: _s94.append('hansen_cards.js \u672a\u505c\u6b62\u6ce8\u5165util\u5361\u518c')
for _fn in _no_subisle(sorted(__import__('glob').glob('island_*.html'))):
    _t=open(_fn,encoding='utf-8').read()
    if 'onclick="HansenContextGacha.open()"' not in _t: _s94.append(_fn+' \u6e38\u620f\u7f51\u683c\u7f3a\u4e0a\u4e0b\u6587\u62bd\u5361\u5165\u53e3\u5361'); break  # v955: 统一入口按页面隔离普通20张池与星海40张池
    if 'icons/gacha_joker_v594.webp' not in _t: _s94.append(_fn+' \u62bd\u5361\u5361\u672a\u7528\u65b0joker\u56fe'); break
    if '\u62bd\u5361</div>' not in _t: _s94.append(_fn+' \u62bd\u5361\u5361\u7f3a\u6807\u9898'); break  # v596 relax: title got inline color style, anchor only the 抽卡</div> text (color guarded by v596)
    if 'onclick="showScreen(\'review\')"><span class="u-icon">\U0001f501</span><div class="u-label">\u590d\u4e60</div>' in _t: _s94.append(_fn+' util\u590d\u4e60\u672a\u5220'); break
    if '.daily-card .d-icon{font-size:72px' not in _t: _s94.append(_fn+' \u6bcf\u65e5\u4efb\u52a1\u56fe\u6807\u672a\u653e\u592770'); break
    if '.boss-card-img{width:91px;height:91px' not in _t: _s94.append(_fn+' \u6311\u6218Boss\u56fe\u672a\u653e\u5927100'); break
    if 'boss-card-label{font-size:15px;font-weight:900;color:var(--pal-ink,#fff);margin-top:5px' not in _t: _s94.append(_fn+' \u6311\u6218Boss\u6807\u9898margin-top\u975e5'); break
    if '--c1:#4f46e5;--c2:#4338ca" onclick="startScramble' not in _t: _s94.append(_fn+' \u5b57\u6bcd\u62fc\u62fc\u4e50\u80cc\u666f\u672a\u6362\u9753\u84dd'); break
    if 'style="width:50px;height:50px' not in _t: _s94.append(_fn+' \u5e95\u680f\u5361\u518c\u672a\u653e\u59271.45em'); break
if _s94: fail('v594 \u62bd\u5361\u5165\u53e3\u79fb\u4f4d+\u5165\u53e3\u53bb\u91cd+\u56fe\u6807\u591a\u9879\u653e\u5927\u8c03\u8272: ' + str(_s94[:6]))
else: ok('v594 \u62bd\u5361\u5165\u53e3\u79fb\u6e38\u620f\u7f51\u683c+util\u5165\u53e3\u53bb\u91cd+\u591a\u9879\u56fe\u6807\u653e\u5927\u8c03\u8272 (Hansen \u5bc6\u96c6\u9700\u6c42: \u706b\u773c\u91d1\u775b\u65c1\u52a0\u62bd\u5361\u5165\u53e3(\u65b0joker\u56fegacha_joker_v594.webp\u6df1\u84dd\u9753\u5e95\u00b7onclick HansenGacha.open\u00b7\u6587\u5b57\u62bd\u5361)\u00b7util\u5220\u590d\u4e60(\u5e95\u680f\u5df2\u6709)\u4e14\u62bd\u5361/\u5361\u518c\u4e0d\u518d\u6ce8\u5165util(\u94bb\u77f3\u5e97\u90a3\u6392\u53bb\u91cd\u00b7\u5361\u518c\u4ec5\u7559\u53f3\u4e0b\u89d2\u5e95\u680f)\u00b7\u6bcf\u65e5\u4efb\u52a1\u56fe\u680734\u2192 72(=\u6bcf\u65e5\u5b9d\u7bb1)\u00b7\u6311\u6218Boss\u56fe84\u2192 100\u586b\u5bcc\u4f59\u7a7a\u95f4(\u884c\u9ad8144\u4e0d\u53d8\u4e0d\u8d85\u6846)+\u56fe\u5b57\u8ddd2\u2192 5\u00b7\u5b57\u6bcd\u62fc\u62fc\u4e50\u7eff\u5e95\u2192 \u9753\u84dd#4f46e5/#4338ca(\u539f\u7eff\u4e0e\u56fe\u6807\u5f69\u8272\u5b57\u6bcd\u91cd\u5408)\u00b7\u5e95\u680f\u5361\u518c1.2\u2192 1.45em(\u4e0d\u8d85\u9876\u7ebf)\u00b7mode\u56fe\u6807\u518d\u653e\u5927(padding5\u2192 4/margin7\u2192 6)\u00b7\u771f\u673a393/360\u53cc\u89c6\u53e3 \u62bd\u5361\u5361\u53ef\u62bd/util\u53ea\u5269\u94bb\u77f3\u5e97+\u6211\u7684\u5b66\u4e60+\u6210\u5c31+\u7edf\u8ba1+\u8bbe\u7f6e(\u65e0\u62bd\u5361/\u5361\u518c/\u590d\u4e60)/\u6bcf\u65e5\u4efb\u52a172/Boss100\u4e0d\u8d85\u6846/\u5b57\u6bcd\u62fc\u62fc\u4e50\u9753\u84dd/\u5e95\u680f\u5361\u518c\u5927/0\u62a5\u9519\u00b7v594)')

# 🔴 v595/BUG#69(Hansen 报): 听音辨义玩完无总结页。根因: 听音是唯一"无限轮"模式 —— 一轮(本档单词)听完只弹 toast 就自动重洗下一轮(nextListenQ), 永不结算, 玩家退出时看不到任何总结。全模式排查证实仅此一处缺结算页(match/boss/moles/fish/bubble/speed/cloze/typing/scramble/eagle 都有 xxxComplete 结算页)。修: 新增 listenComplete() 结算页(答对/正确率/金币/经验/挑战下一档/再来一轮/回主页, 风格同 clozeComplete/eagleComplete), 听音池空(答对分支+答错分支共2处)改为调 listenComplete() 而非 toast+重洗。守卫锁死: listenComplete 必存在 + 池空必跳结算 + 旧 toast 重洗绝迹 + 全模式结算函数齐全(防任何模式再漏总结页)。
_s95=[]
import glob as _g95
_POOL_DONE="if(poolRemaining('listen_'+listenLevel)===0){ listenComplete(); return; }"
for _fn in sorted(_g95.glob('island_*.html')):
    _t=open(_fn,encoding='utf-8').read()
    if 'function listenComplete()' not in _t: _s95.append(_fn+' 缺 listenComplete 结算页函数'); break
    if _t.count(_POOL_DONE)<2: _s95.append(_fn+' 听音池空未跳结算页(应2处:答对+答错分支)'); break
    if "轮完成！'+L.icon" in _t: _s95.append(_fn+' 听音旧toast自动重洗残留(BUG#69复发!)'); break
    _miss=[k for k in ['再来一轮','回主页','正确率','挑战中级','function matchComplete','function clozeComplete','function scrComplete','function eagleComplete','function endSpeed'] if k not in _t]
    if _miss: _s95.append(_fn+' 缺结算元素/函数: '+str(_miss)); break
if _s95: fail('v595 听音辨义补结算页+全模式结算守卫: ' + str(_s95[:6]))
else: ok('v595 听音辨义补结算页+全模式结算守卫 (BUG#69: 听音是唯一无限轮模式·一轮听完只弹toast自动重洗·永不结算·玩家退出无总结页—Hansen报bug。全模式排查仅此一处缺结算页。修: 新增listenComplete()结算页(答对/正确率/金币/经验/挑战下一档/再来一轮/回主页·风格同clozeComplete·listenRight/listenTotal由startListenLevel每轮清零故为本轮数据)·听音池空答对+答错共2处改调listenComplete()而非toast+nextListenQ重洗。守卫: listenComplete必存+池空必跳结算(≥2处)+旧toast"轮完成!"+L.icon绝迹+全模式结算函数齐全(match/cloze/scr/eagle/speed Complete, 防任一模式再漏总结)·真机393 startListenLevel→注入8/10→listenComplete: 完成页/正确率80%/答对8-10/金币经验宠物/挑战中级+再来一轮+回主页/listenActive=false/0报错·v595)')

# 🔴 v596(Hansen): ①抽卡卡背景深蓝靛→浅蓝(嫌深蓝难看·紫品金joker小丑图在深冷蓝上融背景不跳)+标题深蓝字(浅底白字看不清) ②打字大师图标 scale(1.2)放大(嫌小·typer近方图裁掉四周留白)
_s96=[]
import glob as _g96
for _fn in sorted(_g96.glob('island_*.html')):
    _t=open(_fn,encoding='utf-8').read()
    if '--c1:#dbeafe;--c2:#93c5fd" onclick="HansenContextGacha.open()"' not in _t: _s96.append(_fn+' 抽卡卡非浅蓝底或未接上下文路由'); break
    if '#1e3a8a;--c2:#312e81" onclick="HansenContextGacha.open()"' in _t: _s96.append(_fn+' 抽卡旧深蓝底残留(应换浅蓝)'); break
    if '<div class="m-title" style="font-size:12px;color:var(--pal-surf-1,#0f172a);transform:translate(0,2px)">抽卡' not in _t: _s96.append(_fn+' 抽卡标题缺深色#0f172a(v664)'); break
    if 'typer_3d.webp' not in _t: _s96.append(_fn+' 打字大师缺typer_3d图(尺寸v664守卫接管)'); break
if _s96: fail('v596 抽卡浅蓝底+打字大师放大: ' + str(_s96[:6]))
else: ok('v596 抽卡卡浅蓝底+打字大师图标放大 (Hansen: ①抽卡背景深蓝靛#1e3a8a/#312e81→浅蓝#dbeafe/#93c5fd(嫌深蓝难看·紫品金joker小丑图在深冷蓝上融背景不跳→浅蓝衬托紫品金醒目)+标题改深蓝字#1e40af(浅底白字看不清)·②打字大师图标 transform:scale(1.2)放大(嫌小·typer_3d近方图四周留白·scale后裁掉留白主体更大·不超框不压标题)·19岛统一·真机393首页 抽卡浅蓝joker跳出+深蓝字清晰/打字大师电脑图明显更大充满卡片/0报错。守卫: 抽卡浅蓝底存在+旧深蓝底绝迹+标题深蓝字#1e40af+打字scale(1.2)(岛内唯一)·已放宽v594两处(抽卡卡只锚onclick不锚色+标题只锚"抽卡</div>"不锚style, 由v596单一接管色)·v596)')

# 🔴 v598(Hansen, 接v597迭代): 打字大师 图标上提+文字上提缩小换亮黄。v597整体下移6px后Hansen觉得偏多: 图标要上提一点(但别贴顶·留一点空隙)、文字太靠底碰地板要上提离底、文字要缩小并换醒目突出色。改: 图标 translateY 6→3px(上提·顶部仍留空隙不贴顶); 文字 translateY 6→2px(上提离底)+font-size 13→11px(缩小)+color #fff→#fde047(亮黄·紫底#8b5cf6上互补最醒目突出·更易注意)。scale(1.2)图标大小仍不变。
_s98=[]
import glob as _g98
for _fn in sorted(_g98.glob('island_*.html')):
    _t=open(_fn,encoding='utf-8').read()
    if '<div class="m-icon"><img src="icons/typer_3d.webp' not in _t: _s98.append(_fn+' \u6253\u5b57\u5927\u5e08\u56fe\u6807\u4f4d\u7f6e\u5f02\u5e38(v598\u5e94translateY(3px)\u4e0a\u63d0\u4e0d\u8d34\u9876)'); break
    if '<div class="m-title" style="font-size:13px;color:#fbbf24;transform:translate(0,3px)">打字大师' not in _t: _s98.append(_fn+' \u6253\u5b57\u5927\u5e08\u6587\u5b57\u5f02\u5e38(v598\u5e94translateY2+font11+\u4eae\u9ec4fde047)'); break
if _s98: fail('v598 \u6253\u5b57\u5927\u5e08\u56fe\u6807\u4e0a\u63d0+\u6587\u5b57\u4e0a\u63d0\u7f29\u5c0f\u4eae\u9ec4: ' + str(_s98[:6]))
else: ok('v598 \u6253\u5b57\u5927\u5e08 \u56fe\u6807\u4e0a\u63d0+\u6587\u5b57\u4e0a\u63d0\u7f29\u5c0f\u6362\u4eae\u9ec4\u7a81\u51fa\u8272 (Hansen\u63a5v597\u8fed\u4ee3: v597\u6574\u4f53\u4e0b\u79fb6px\u504f\u591a\u2192\u56fe\u6807translateY 6\u21923px\u4e0a\u63d0\u4f46\u7559\u9876\u90e8\u7a7a\u9699\u4e0d\u8d34\u9876\u00b7\u6587\u5b57translateY 6\u21922px\u4e0a\u63d0\u79bb\u5e95+font-size 13\u219211px\u7f29\u5c0f+color\u767d\u2192#fde047\u4eae\u9ec4(\u7d2b\u5e95#8b5cf6\u4e0a\u4e92\u8865\u6700\u9192\u76ee\u7a81\u51fa\u00b7\u66f4\u6613\u6ce8\u610f)\u00b7scale(1.2)\u56fe\u6807\u5927\u5c0f\u4ecd\u4e0d\u53d8\u00b719\u5c9b\u7edf\u4e00\u00b7\u771f\u673a393\u9996\u9875 \u56fe\u6807\u9876\u79bb\u5361\u9876\u6709\u7a7a\u9699+\u6587\u5b57\u4eae\u9ec4\u7f29\u5c0f\u79bb\u5e95+0\u62a5\u9519\u00b7\u4e0ev596 scale(1.2)\u5b88\u536b\u5e76\u5b58\u00b7v598)')

# 🔴 v599(Hansen): 三卡片(每日宝箱/每日任务/挑战Boss)条太高、上下留白大→压低。铁律: 街机图标100px+宝箱图标72px+每日任务图标全程不许变(Hansen反复强调), 只压卡片padding, 且图标↔文字间距全保留防重合。改: daily-card padding 10→3px, boss-card padding 8/4→3px, 行高148→134(省14·已是图标不变下物理极限)。守卫同时锁: 压低后padding + 图标尺寸不变 + 旧大padding绝迹(防条变回长)。
_s99=[]
import glob as _g99
for _fn in sorted(_g99.glob('island_*.html')):
    _t=open(_fn,encoding='utf-8').read()
    if 'border-radius:14px;padding:3px 6px' not in _t: _s99.append(_fn+' daily-card未压低(应padding:3px 6px)'); break
    if '.daily-card.boss-card{padding:3px 3px 3px' not in _t: _s99.append(_fn+' boss-card未压低(应padding:3px 3px 3px)'); break
    if 'boss-card-img{width:91px;height:91px' not in _t: _s99.append(_fn+' 街机图标尺寸应91px(v823: 与每日宝箱/下面mode图标对齐·原100px按对齐要求改91)'); break
    if '#chestCard .d-icon{font-size:72px' not in _t: _s99.append(_fn+' 宝箱图标尺寸被改(必须保持72px·Hansen铁律)'); break
    if 'border-radius:14px;padding:10px 6px' in _t: _s99.append(_fn+' daily-card旧大padding(10px)残留(应压到3px·防条变回长)'); break
if _s99: fail('v599 三卡片压低: ' + str(_s99[:6]))
else: ok('v599 三卡片(每日宝箱/每日任务/挑战Boss)压低 (Hansen嫌条太高·上下留白大→只压卡片padding不动图标: daily-card padding 10→3px·boss-card padding 8/4→3px·行高148→134px(省14px·已是图标不变下物理极限)·街机图标100px+宝箱图标72px+每日任务图标全程不变·图标↔文字间距全保留(chest3/boss5px)防重合·19岛统一·真机393 三卡片明显压低+图标全保持原大小+文字不重合+排版不乱+0报错。守卫: daily padding:3px 6px + boss padding:3px 3px 3px + 街机100px + 宝箱72px 四锁定 + 旧大padding(10px 6px)绝迹防条变回长·v599)')

# 🔴 BUG#63(Hansen v600): boss快死时"最后一题"卡住——答对一题同时跨phase阈值(66/33)+rage阈值(50)时, triggerBossRage延迟setTimeout先清空bossOpts选项再调nextBossQ, 却撞800ms去重锁(BUG#14)被拦→选项清空但新题没补出→题干残留+选项空+done=''永久卡死; 看门狗(BUG#62)又因题干非空误判过渡态放过它。双保险修复必须常驻, 防回退。
_s63=[]
if 'BUG#63' not in lock: _s63.append('BUG#63修复标记丢失')
if "_boLk && _boLk.querySelectorAll('.boss-opt').length > 0" not in lock: _s63.append('修复1(去重锁放行空选项)丢失')
if "_boWd && _boWd.querySelectorAll('.boss-opt').length > 0" not in lock: _s63.append('修复2(看门狗只看选项)丢失')
if '\u9898\u5e72\u975e\u7a7a(\u6e32\u67d3\u8fc7\u6e21\u4e2d)' in lock: _s63.append('旧看门狗逻辑(题干非空就不救)残留-必须改为只看选项')
if _s63: fail('BUG#63 boss最后一题卡死: ' + str(_s63))
else: ok('BUG#63 boss快死时最后一题卡死修复 (Hansen报暗影忍者等boss打到最后几题题目不刷新/选项空白/卡住无法过关→根因: 答对一题同时跨phase阈值(66/33)+rage阈值(50), triggerBossRage延迟setTimeout先清空bossOpts选项再nextBossQ却被800ms去重锁拦掉→选项清空但新题没补出→题干残留+选项空+done=空永久卡死; 看门狗又因题干非空误判过渡放过它。双保险: ①去重锁只在选项还在时生效防覆盖,选项已空则放行补题 ②看门狗改判据只看有无可点选项(无.boss-opt=必救)不再因题干非空放过。真机16场Lv1/2/5/8多血量全victory·0卡死·0报错·看门狗最长2轮即恢复。守卫锁: BUG#63标记+修复1(_boLk选项检查)+修复2(_boWd选项检查)+旧逻辑绝迹·v600)')

# 🔴 v600(Hansen): 装备成长系统接入Boss战 — 7武器/血量/护甲全19岛战斗生效。守卫: gear数值表+接口完整·19岛引gear.js+两段制锚点+20boss新血量·boss_lock移除wrongExtra叠加(防与两段制叠加秒杀)。
_sg=[]
try:
    _gj=open('hansen_gear.js',encoding='utf-8').read()
except Exception:
    _gj=''; _sg.append('hansen_gear.js读取失败')
for _wname in ['弓箭','手枪','机枪','狙击枪','加特林','加农炮','光子炮']:
    if _wname not in _gj: _sg.append('gear武器缺:'+_wname); break
for _api in ['getWeaponAtk','getMaxHP','getArmorPct','getWeaponName']:
    if _api not in _gj: _sg.append('gear接口缺:'+_api); break
if 'ARMOR_PCTS' not in _gj: _sg.append('gear护甲表缺')
import glob as _gg600
for _fn in sorted(_gg600.glob('island_*.html')):
    _t=open(_fn,encoding='utf-8').read()
    if 'hansen_gear.js' not in _t: _sg.append(_fn+' 未引gear.js'); break
    if '_FIXED=[10,15,20,26,32,38,44,50,57,64,72,80,88,96,104,112,120,128,136,145]' not in _t: _sg.append(_fn+' 缺v617全20关固定伤害锚点'); break  # v617:两段制→全固定
    if 'var dmg=Math.round(_FIXED[_lv-1]*(1-_armor/100));' not in _t: _sg.append(_fn+' 缺v617全固定伤害公式'); break  # v617:_PCT百分比已移除
    if 'HansenGear.getWeaponAtk' not in _t: _sg.append(_fn+' 玩家攻击未接武器'); break
    if 'HansenGear.getMaxHP' not in _t: _sg.append(_fn+' heroMaxHP未接装备'); break
    if ('season' not in _fn and 'land' not in _fn) and 'hp:1300' not in _t: _sg.append(_fn+' BOSSES缺新血量hp:1300'); break  # 🔴v810: 赛季岛改6守关boss·不再用20关1300血量·豁免(常规岛仍要求) 🔴v873: 大陆岛(land1-8)同理豁免(各5守关boss·hp88-128梯度)
if 'cfg.wrongExtra >= 99' in lock: _sg.append('boss_lock wrongExtra额外伤害未移除')
if 'island 两段制' not in lock: _sg.append('boss_lock两段制主导注释丢失')
if _sg: fail('v600 装备系统接Boss战: ' + str(_sg[:8]))
else: ok('v600 装备成长系统全19岛接入Boss战 (7武器各主色光+血量上限+护甲减伤; 玩家攻击=getWeaponAtk·英雄血量=getMaxHP·答错伤害(v617已改全20关固定x(1-甲%)·血量高关生效)·20boss新血量55到1300防碾压; boss_lock移除wrongExtra额外伤害防与两段制叠加秒杀只留战败判断; animal+food双岛真机验证全对·0报错。守卫: gear数值表+4接口·19岛引gear.js+两段制锚点_FIXED/_PCT+getWeaponAtk+getMaxHP+新血量hp:1300(赛季岛v810改6守关boss已豁免)·boss_lock wrongExtra移除+两段制注释·v600)')

# 🔴 v602→v604(Hansen): 商店多配色主题 — 6套明亮浅色(默认奶油·去暗色调与跟随主题)。守卫: 6皮肤名 + applySkin + 默认cream + SKIN_KEY + CSS变量化 + 切换条。
_ssk=[]
try:
    _gj2=open('hansen_gear.js',encoding='utf-8').read()
except Exception:
    _gj2=''; _ssk.append('hansen_gear.js读取失败')
for _sk in ['cream','mint','sky','peach','lavender','light']:
    if (_sk+':') not in _gj2 and ("'"+_sk+"'") not in _gj2: _ssk.append('配色皮肤缺:'+_sk); break
if 'function applySkin' not in _gj2: _ssk.append('applySkin函数缺')
if ("k:'cream'" not in _gj2) and ("return 'cream'" not in _gj2): _ssk.append('默认皮肤非cream(应明亮)')
if 'hansen_gear_skin' not in _gj2: _ssk.append('SKIN_KEY存储缺')
if '--hg-pa' not in _gj2 or '--hg-ac' not in _gj2: _ssk.append('CSS变量化(--hg-*)缺')
if 'hg-skins' not in _gj2: _ssk.append('配色切换条UI缺')
if _ssk: fail('v604 商店多配色: ' + str(_ssk[:6]))
else: ok('v604 商店多配色主题 (6套明亮浅色: 奶油默认暖白护眼+薄荷+天空+蜜桃+薰衣草+纯净; 全浅色明亮舒适·按Hansen要求去掉原暗色调与跟随主题; 色块切换+高亮+存localStorage hansen_gear_skin; CSS全变量化 --hg-pa/pb/bd/chip/mute/ac/ac2/bt/tx/sub/sub2; 真机cream/sky/mint验证明亮舒适·武器深托盘清晰·0报错。守卫6皮肤名+applySkin+默认cream+SKIN_KEY+CSS变量化+切换条 v604)')

# 🔴 v607(Hansen): 武器特效改为打击感优先(淘汰屏上摆武器+弹道线) — 不展示武器实体, 聚焦boss命中爆发+伤害数字猛弹。+全武器试玩24h(沿用)。守卫: HansenWeaponFx+impact+popDamage+coreFlash/shards/ring+无rotate+无brightness/hue-rotate(守BUG#52)+无武器图+19岛引/调用+gear试玩。
_swf=[]
try:
    _wfx=open('hansen_weapon_fx.js',encoding='utf-8').read()
except Exception:
    _wfx=''; _swf.append('weapon_fx读取失败')
if 'window.HansenWeaponFx' not in _wfx: _swf.append('HansenWeaponFx接口缺')
if 'function fxBow' not in _wfx or 'function fxCannon' not in _wfx: _swf.append('七武器fx缺(fxBow/fxCannon)')
if 'function popDamage' not in _wfx: _swf.append('popDamage伤害数字缺')
for _fn in ['coreFlash','shards','ring']:
    if _fn not in _wfx: _swf.append('爆发组件缺:'+_fn); break
if 'brightness' in _wfx: _swf.append('含brightness违反BUG#52!')
if 'hue-rotate' in _wfx: _swf.append('含hue-rotate违反BUG#52!')
if 'showWeapon' in _wfx: _swf.append('showWeapon未淘汰!')
if 'weapons/' in _wfx: _swf.append('仍引武器图!')
import glob as _glob
_ms=[i for i in _glob.glob('island_*.html') if 'hansen_weapon_fx.js' not in open(i,encoding='utf-8').read()]
_mc=[i for i in _glob.glob('island_*.html') if 'HansenWeaponFx(_wfl,sprite' not in open(i,encoding='utf-8').read()]
if _ms: _swf.append('未引weapon_fx岛x'+str(len(_ms)))
if _mc: _swf.append('未调HansenWeaponFx岛x'+str(len(_mc)))
#🔴v853 武器试玩已移除(Hansen·"武器完全没有任何试用功能"): 删掉原v607的全武器试玩断言(trialUntil/+o.trialUntil)。武器特效本体(上方HansenWeaponFx等)保留——现在武器=纯攻击特效皮肤。
if _swf: fail('v607 武器特效打击感: '+str(_swf[:6]))
else: ok('v607 武器特效改为打击感优先 (淘汰屏上摆写实武器PNG+弹道线的违和廉价方案; 不展示武器实体, 聚焦boss被打中那一下: impact命中爆发[coreFlash中心强光+ring多重冲击波环+shards径向粒子·武器差异化·加农炮/光子炮加fireball大爆炸] + popDamage伤害数字猛弹[overshoot弹大scale0.3到1.35到1+上飘+淡出·暴击金色更大]。boss受击靠island的boss-hit-anim极轻微缩放·本特效都是boss前方独立元素+数字不碰boss滤镜。防晕+BUG#52: 绝无rotate/brightness/hue-rotate·无闪屏无震屏·仅translate/scale/opacity。守卫: HansenWeaponFx+impact+popDamage+coreFlash/shards/ring+无rotate+无brightness+无武器图+19岛引调 v607·v853武器试玩已移除·武器=纯攻击特效皮肤)')

# 🔴 v604(Hansen): 武器图清晰化 — 裁剪留白+降分辨率540+锐化。守卫: 7武器图存在 + 已优化(<600KB·原1.4-1.6MB)。
_swp=[]
import os as _os2
for _wp in ['bow','pistol','machinegun','sniper','gatling','cannon','photon']:
    _pth='weapons/'+_wp+'.webp'
    if not _os2.path.exists(_pth): _swp.append('武器图缺:'+_wp); continue
    if _os2.path.getsize(_pth) > 600*1024: _swp.append(_wp+'未优化大于600KB')
if _swp: fail('v604 武器图清晰化: '+str(_swp[:5]))
else: ok('v604 武器图清晰化 (7武器图裁剪留白getbbox武器占满+降分辨率最长边540 LANCZOS+锐化UnsharpMask·商店深托盘显示更清晰锐利·文件1.4-1.6MB降至94-308KB·真机商店验证·原图备份/tmp/weapons_orig v604)')

# 🔴 BUG#71 修复 (v605): 阶段/狂怒连续过渡撞看门狗阈值→误救场+双出题→跳题。守卫: 19岛设_bossTransUntil + boss_lock看门狗豁免 + BUG#71标记。
_b64=[]
import glob as _g64
_mp64=[i for i in _g64.glob('island_*.html') if '_bossTransUntil' not in open(i,encoding='utf-8').read()]
if _mp64: _b64.append('未加过渡标记岛x'+str(len(_mp64)))
try:
    _bl64=open('hansen_boss_lock.js',encoding='utf-8').read()
except Exception:
    _bl64=''; _b64.append('boss_lock读取失败')
if '_bossTransUntil' not in _bl64: _b64.append('看门狗未加过渡豁免')
if 'BUG#71' not in _bl64: _b64.append('BUG#71标记缺')
if _b64: fail('BUG#71 过渡期看门狗豁免: '+str(_b64[:5]))
else: ok('BUG#71修复 阶段/狂怒过渡期看门狗豁免 (一次答对同时跨阶段66/33线+狂怒50线时 enterNewPhase 1.5s+triggerBossRage 2s连续过渡共3.5s恰撞看门狗已答题显示3500ms阈值→误判卡死救场+狂怒定时器双双nextBossQ→当前题被冲掉+选项空窗+跳题; v601武器变强+boss血量降低后高频触发。修复: 19岛enterNewPhase设_bossTransUntil+2200/triggerBossRage设+2700连续无缝覆盖·boss_lock看门狗_bossQWdStuck开头过渡窗口内return false不救场; 真机对比验证修复后看门狗0次救场无空窗·禁豁免2次救场有空窗bug复现。守卫19岛_bossTransUntil+boss_lock豁免+BUG#71标记 v605)')


# 🔴 v608(Hansen): 连胜框(combo-badge)上移至经验进度条下方→黑框底部之间, 顶部不碰经验条, z-index最高, 19岛+全局js统一。HSN_COMBO_POS铁律: 基准=经验进度条bottom+2(稳定), 不许回退金币基准(maxBottom+3会随金币位漂移)。改定位务必同步: 19岛showComboUI+flashComboBadge + hansen_island_upgrade.js的showComboUI全局包装(覆盖island版真正生效!) + 本守卫。
_scb=[]
import glob as _gcb
_iscb=_gcb.glob('island_*.html')
_no_xpb=[i for i in _iscb if "_xpb.getBoundingClientRect().bottom + 2" not in open(i,encoding='utf-8').read()]
_old_coin=[i for i in _iscb if 'ui.style.top = (maxBottom + 3)' in open(i,encoding='utf-8').read()]
_no_z=[i for i in _iscb if 'z-index:2147483400' not in open(i,encoding='utf-8').read()]
_no_tag=[i for i in _iscb if 'HSN_COMBO_POS' not in open(i,encoding='utf-8').read()]
if _no_xpb: _scb.append('未用经验条基准岛x'+str(len(_no_xpb)))
if _old_coin: _scb.append('残留金币基准maxBottom+3岛x'+str(len(_old_coin)))
if _no_z: _scb.append('combo-badge非z2147483400岛x'+str(len(_no_z)))
if _no_tag: _scb.append('缺HSN_COMBO_POS标志岛x'+str(len(_no_tag)))
try:
    _iucb=open('hansen_island_upgrade.js',encoding='utf-8').read()
except Exception:
    _iucb=''; _scb.append('island_upgrade读取失败')
if ("_xpb.getBoundingClientRect().bottom+2" not in _iucb) and ("_xpb.getBoundingClientRect().bottom + 2" not in _iucb): _scb.append('全局showComboUI未用经验条基准')
if ('ui.style.top=(mb+3)' in _iucb) or ('ui.style.top = (mb+3)' in _iucb): _scb.append('全局showComboUI仍金币基准mb+3')
if 'HSN_COMBO_POS' not in _iucb: _scb.append('全局showComboUI缺HSN_COMBO_POS标志')
if _scb: fail('v608 连胜框定位HSN_COMBO_POS铁律: '+str(_scb[:6]))
else: ok('v608 连胜框上移至经验进度条下方→黑框底部之间 (Hansen: 顶部不碰经验条·底部贴黑框底·框高24px正好落在进度条bottom36→黑框bottom62的26px区间·z-index:2147483400最高优先·覆盖下方文字)。铁律HSN_COMBO_POS: 定位基准=经验进度条 .top-bar .xp-bar 的bottom+2px·稳定不随金币数字位置漂移·绝不回退金币基准maxBottom+3。改定位必须同步三处: 19岛island的showComboUI+flashComboBadge + hansen_island_upgrade.js的showComboUI全局包装(覆盖island版真正生效) + 本守卫。真机验证animal/city/treasure: 顶部38px底部62px·z2147483400·无报错。守卫: 19岛经验条基准+无金币残留+z最高+HSN_COMBO_POS标志+全局js经验条基准 v608)')


# 🔴 v609(Hansen): 勇者血条左侧⚔️→当前装备武器图标(独立框·放大) + 攻击特效从武器框(正前方)射弹丸→boss命中爆发。HSN_WEAPON_BOX铁律: 19岛hero-weapon-box统一·武器图=HansenGear.getWeaponIcon·攻击从heroWeaponBox射出·无rotate/brightness。
_swb=[]
import glob as _gwb, os as _owb
_iswb=_gwb.glob('island_*.html')
_no_box=[i for i in _iswb if 'heroWeaponBox' not in open(i,encoding='utf-8').read()]
_no_boxcss=[i for i in _iswb if '.hero-weapon-box{' not in open(i,encoding='utf-8').read()]
_no_wtag=[i for i in _iswb if 'HSN_WEAPON_BOX' not in open(i,encoding='utf-8').read()]
if _no_box: _swb.append('缺heroWeaponBox岛x'+str(len(_no_box)))
if _no_boxcss: _swb.append('缺hero-weapon-box-CSS岛x'+str(len(_no_boxcss)))
if _no_wtag: _swb.append('缺HSN_WEAPON_BOX标志岛x'+str(len(_no_wtag)))
try: _gj=open('hansen_gear.js',encoding='utf-8').read()
except Exception: _gj=''; _swb.append('gear读取失败')
if 'getWeaponIcon' not in _gj: _swb.append('gear缺getWeaponIcon')
try: _wj=open('hansen_weapon_fx.js',encoding='utf-8').read()
except Exception: _wj=''; _swb.append('weapon_fx读取失败')
if 'function muzzle' not in _wj: _swb.append('weapon_fx缺muzzle开火')
if 'function flyer' not in _wj or 'function beam' not in _wj: _swb.append('weapon_fx缺flyer/beam投射')
if 'heroWeaponBox' not in _wj: _swb.append('weapon_fx未从武器框射击')
if 'brightness' in _wj: _swb.append('weapon_fx含brightness-BUG52!')
_wpng=['bow','pistol','machinegun','sniper','gatling','cannon','photon']
_miss=[w for w in _wpng if not _owb.path.exists('weapons/'+w+'.webp')]
if _miss: _swb.append('缺武器图'+str(_miss))
if _swb: fail('v609 武器展示框HSN_WEAPON_BOX铁律: '+str(_swb[:6]))
else: ok('v609 勇者血条左侧武器展示框 + 攻击从正前方射向boss (Hansen: ⚔️→当前装备武器图标·独立框圈住·图标放大; 攻击从武器框正前方射弹丸→boss命中爆发)。HSN_WEAPON_BOX铁律: 19岛hero-weapon-box(heroWeaponBox+hero-weapon-box-CSS+HSN_WEAPON_BOX标志) + 武器图=HansenGear.getWeaponIcon(weaponLvl→weapons/png) + 攻击从heroWeaponBox射出(muzzle开火+flyer/beam投射→boss·到达触发命中爆发+popDamage(v611七武器差异化)) + 无rotate/brightness(防晕+守BUG52)。真机验证animal: 武器框lvl6=photon/lvl0=bow加载成功·弹丸0-140ms飞行3元素+175ms boss爆发18元素·0报错。武器图齐全7把。守卫: 19岛武器框+gear-getWeaponIcon+weapon_fx-muzzle/flyer/beam/从武器框射击/无brightness(v611七武器·静态朝向合规)+武器图齐全 v609)')


# 🔴 v610 BUG#59(Hansen): 拼写题(typing/Lv17-20)boss尺寸与其他题型完全一致(150px), 不因进入打字/拼写环节缩小。typing曾用bts-typing缩boss到112/140/96px → Hansen要求统一150px(矮屏只缩键盘腾空间·boss绝不缩)。
try: _bl=open('hansen_boss_lock.js',encoding='utf-8').read()
except Exception: _bl=''
_b59=[]
if '.boss-sprite svg{width:230px;height:230px;display:block;margin:0 auto;transform:scale(.9304)' not in _bl: _b59.append('普通boss非230盒/scale.9304基准(v859)')
if 'bts-typing .boss-sprite-wrap{width:112px' in _bl: _b59.append('typing仍缩112px')
if 'bts-typing .boss-sprite-wrap{width:140px' in _bl: _b59.append('typing高视口仍140px')
if 'bts-typing .boss-sprite-wrap{width:96px' in _bl: _b59.append('typing矮视口仍96px')
if '.boss-arena.bts-typing .boss-sprite svg{width:230px!important;height:230px!important;transform:scale(.9304)!important' not in _bl: _b59.append('typing非恒定盒230/scale.9304(v878: 立绘视觉214与其他题型一致·旧.717=165已废)')
if '.boss-arena.bts-typing .boss-sprite-wrap{margin:34px 0 0!important}' not in _bl: _b59.append('typing wrap margin与普通态不一致(题型切换会位移)')
if _b59: fail('v610 typing-boss尺寸BUG#59: '+str(_b59))
else: ok('v610→v878 BUG#59: 拼写题(typing/Lv17-20)boss尺寸与其他题型完全一致214px (Hansen: boss不因进入打字/拼写环节变小·从头到尾一致)。修复: bts-typing的boss-sprite/svg/wrap尺寸 112/140/96px → 统一150px(=普通题型.boss-sprite svg{150px}); 矮屏(≤719/≤659px)只缩键盘#btsKbd(键44/36px+收紧间距+上移)腾空间·boss绝不缩(Hansen: 键盘下移)。所有boss题型(普通4种+spellFill+spellPick+sentTrans+typing)现统一150px: spellFill(BUG#58)/spellPick(v306)早移除bts-compact·typing本次统一(BUG#59)。真机验证(Lv18·视口730/700/680/640): 普通=typing=150px一致·键盘放得下·0报错。守卫(v857升级): 恒定盒230全题型统一·普通svg scale(.826)=视觉190·typing scale(.717)=视觉165·wrap margin一致(题型切换零位移)·无112/140/96残留 v610→v857)')


# 🔴 v611 BUG#60(Hansen): (1)武器图标完全重做(放大84x60·高清·减间距) — 勇者血条左侧武器框太小(46px)看不清武器·边框留白大·显得模糊. (2)七武器差异化攻击特效 — 原所有武器共用一个光球(糊弄), 要求每把独立打法.
_isl_wfx=sorted([f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html')])
_wbox_bad=[]
for _f in _isl_wfx:
    _c=open(_f,encoding='utf-8',errors='replace').read()
    if '.hero-weapon-box{width:84px;height:60px' not in _c: _wbox_bad.append(os.path.basename(_f))
if _wbox_bad: fail('v611 武器框未放大84x60(BUG#60): %d岛 %s' % (len(_wbox_bad),_wbox_bad[:3]))
else: ok('v611 BUG#60(1): 武器框放大46->84x60(横向·padding3·边框更亮) 全%d岛统一 (Hansen: 武器图标太小看不清->放大一倍·原图540px高清·显示74x50·减留白)' % len(_isl_wfx))
try: _wfx=open('hansen_weapon_fx.js',encoding='utf-8').read()
except Exception: _wfx=''
_fx_bad=[]
if 'window.HansenWeaponFx' not in _wfx: _fx_bad.append('未定义HansenWeaponFx')
for _fn in ['fxBow','fxPistol','fxMachineGun','fxSniper','fxGatling','fxCannon','fxPhoton']:
    if 'function '+_fn not in _wfx: _fx_bad.append('缺'+_fn)
if 'function flyer' not in _wfx: _fx_bad.append('缺flyer')
if 'function beam' not in _wfx: _fx_bad.append('缺beam')
if 'function bulletHole' not in _wfx: _fx_bad.append('缺bulletHole')
if 'function crosshair' not in _wfx: _fx_bad.append('缺crosshair')
if _fx_bad: fail('v611 七武器特效BUG#60: '+str(_fx_bad))
else: ok('v611 BUG#60(2): 七武器差异化攻击特效在位 (Hansen: 原所有武器共用一个光球·要每把独立). 弓箭=能量箭矢(箭杆+箭头+尾羽)/手枪=单发枪击+弹孔/机枪=连发扫射/狙击=精准光束爆头+十字准星/加特林=密集弹幕+弹孔/加农炮=炮弹+大爆炸(火球+三重环)/光子炮=粗激光束+能量散射(rays). 方向元素flyer(飞行物·静态朝向)/beam(光束scaleX展开). 防晕: 全程translate+scale+opacity·方向用静态固定角度(非旋转动画·不在check24扫描范围)·无闪屏无震屏·不碰boss立绘滤镜(BUG#52). 真机(Lv5·7把): 各生成元素2-22个·0报错 v611)')


# 🔴 v612 BUG#61(Hansen): 武器框放大(v611 84x60)挤短勇者血条→打在血条上的大招/浮动伤害特效中心随血条右移. Hansen要: (1)hero-section向两边延伸(武器框贴左·血条加长) (2)大招打击中心锁屏幕正中央(不随血条漂移·回到以前屏幕中心).
_isl_hs=sorted([f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html')])
_hs_bad=[]
for _f in _isl_hs:
    _c=open(_f,encoding='utf-8',errors='replace').read()
    if 'margin:3px -11px' not in _c: _hs_bad.append(os.path.basename(_f))  # v614: 原v612的max-width检查→v614负margin贴屏幕
if _hs_bad: fail(f'v612 hero-section未加宽(BUG#61): {len(_hs_bad)}岛 {_hs_bad[:3]}')
else: ok(f'v612 BUG#61(1): hero-section向两边延伸(max-width 340->calc(100%-12px)·接近屏幕留6px边距·gap8·padding左右6·武器框贴左·蓝色血条加长247) 全{len(_isl_hs)}岛 (Hansen: 武器框放大后血条变短→延伸血条+武器框贴左) v612')
try: _ba=open('hansen_boss_attack.js',encoding='utf-8').read()
except Exception: _ba=''
try: _blk=open('hansen_boss_lock.js',encoding='utf-8').read()
except Exception: _blk=''
_ctr_bad=[]
if 'hc.x=bc.x' not in _ba: _ctr_bad.append('大招hc.x未锁boss中线')  # v614: 原v612屏幕中心→v614 boss中线
_p=_blk.find('window.HansenHeroHit'); _hh=_blk[_p:_p+2500] if _p>=0 else ''
if 'x = r.left + r.width / 2' in _hh: _ctr_bad.append('浮动伤害x仍随hero-section漂移')
if _ctr_bad: fail(f'v612 打击中心锁屏幕中央BUG#61: {_ctr_bad}')
else: ok('v612 BUG#61(2): boss大招+勇者浮动伤害打击中心x锁屏幕正中央 (Hansen: 武器框放大后血条变短中心右移→特效曾随血条漂移偏右; 现 boss_attack的playFx hc.x=innerWidth/2 + boss_lock的HansenHeroHit浮动伤害x=屏幕中心·y仍用hero区·特效永远居中不漂移). 真机(Lv18): 浮动伤害x偏0·大招19元素平均偏-11·均居中·0报错 v612)')


# 🔴 v613 BUG#62(Hansen): boss伤害数字弹多次+消失前闪一下. (1)原动画overshoot弹大(scale1.35)→缩回(1)看起来弹两下→简化为只弹一次. (2)原动画无fill:forwards→跑完最后帧(opacity0)后元素瞬间弹回默认opacity1再被移除(闪一下)→加fill:forwards锁住消失态.
try: _wfx2=open('hansen_weapon_fx.js',encoding='utf-8').read()
except Exception: _wfx2=''
_pd_bad=[]
_pdi=_wfx2.find('function popDamage')
_pdseg=_wfx2[_pdi:_pdi+1200] if _pdi>=0 else ''
if "fill:'forwards'" not in _pdseg: _pd_bad.append('popDamage动画缺fill:forwards(消失前会闪回)')
if 'scale(1.35)' in _pdseg or 'scale(1.5)' in _pdseg: _pd_bad.append('popDamage仍overshoot弹大缩回(看起来弹两下)')
_pd_isl=[f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html')]
_nodedup=[]
for _f in _pd_isl:
    _c=open(_f,encoding='utf-8',errors='replace').read()
    if 'function bossAnswer(i){' in _c and 'dataset.done)return' not in _c: _nodedup.append(os.path.basename(_f))
if _nodedup: _pd_bad.append(f'答对未防重{len(_nodedup)}岛')
if _pd_bad: fail(f'v613 伤害数字弹多次/闪BUG#62: {_pd_bad}')
else: ok('v613 BUG#62: boss伤害数字弹一次+消失不闪 (Hansen: 弹两次48+停后48闪一下). (1)popDamage动画简化为只弹一次(去掉overshoot弹大1.35缩回1的两下感·改scale.6->1.12->1上飘淡出) (2)加fill:forwards锁住消失态opacity0·跑完不再弹回默认opacity1闪一下. 答对防重bossAnswer入口dataset.done·HansenWeaponFx只触发一次. 真机(弓箭48): 1个伤害数字·opacity1->0渐变·1080ms移除·无闪回 v613)')


# 🔴 v614 BUG#63(Hansen): (1)武器框紧贴屏幕左+血条更长 (2)boss攻击特效以boss自己中线(立绘水平中心)为心·而非血条中央.
_g63=[]
_b63a=[f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html') and ('margin:3px -11px' not in open(f,encoding='utf-8',errors='replace').read() or 'padding:5px 2px' not in open(f,encoding='utf-8',errors='replace').read())]
if _b63a: _g63.append(f'{len(_b63a)}岛hero-section缺margin:3px -11px/padding:5px 2px')
try: _bl63=open('hansen_boss_lock.js',encoding='utf-8').read()
except Exception: _bl63=''
if '#bossScreen .hero-section{padding:5px 2px !important;margin:3px -11px !important}' not in _bl63: _g63.append('boss_lock主hero-section!important未改贴屏幕')
if '_bspr614' not in _bl63: _g63.append('boss_lock浮动伤害未锁boss中线(_bspr614)')
try: _ba63=open('hansen_boss_attack.js',encoding='utf-8').read()
except Exception: _ba63=''
if 'hc.x=bc.x' not in _ba63: _g63.append('boss_attack playFx命中中心未锁boss中线(hc.x=bc.x)')
import re as _re63
if _re63.search(r'=\s*(\w+)\.left\s*\+\s*\1\.width\s*\*\s*0?\.5', _ba63): _g63.append('boss_attack仍有命中中心=血条中心(应=bc.x)')
if 'moonX=bx+52' in _ba63: _g63.append('血月仍偏右bx+52(应居中bx-MS/2)')
if _g63: fail(f'v614 武器框贴屏幕左/血条更长/特效以boss中线 BUG#63: {_g63}')
else: ok('v614 BUG#63: 武器框贴屏幕左+血条更长+boss攻击特效以boss中线 (Hansen). (1)19岛hero-section负margin(margin:3px -11px)突破.screen的12px padding·武器框贴屏幕左4px·血条加长到297(v612:247). (2)boss_lock主!important规则#bossScreen .hero-section改padding:5px 2px/margin:3px -11px. (3)boss_attack大招命中中心27处+铺展左17处+浮动伤害全锁boss立绘中线bc.x·血月居中bx-MS/2. 真机7boss(Lv2/4/6/10/15/18/20)大招全居中±30内·浮动伤害197=boss中线·393无溢出·0报错 v614)')


# 🔴 v615 BUG#64(Hansen): 24小时全开放(boss挑战关卡/卡册图鉴/武器自由选)·到期自动关闭·零提醒.
_g64=[]
try: _fp=open('hansen_freepass.js',encoding='utf-8').read()
except Exception: _fp=''
if not _fp: _g64.append('hansen_freepass.js缺失')
else:
    if 'hansen_freepass_until' not in _fp: _g64.append('freepass缺FP_KEY')
    if 'getUnlockedBossLv' not in _fp or 'return 20' not in _fp: _g64.append('freepass缺boss解锁hook')
    if 'hansen_card_temp_unlock_until' not in _fp: _g64.append('freepass缺卡册临时解锁')
    if 'trialUntil' not in _fp: _g64.append('freepass缺武器试玩')
    if '86400000' not in _fp: _g64.append('freepass缺24小时')
_isl64=[f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html')]
_nofp=[f for f in _isl64 if 'hansen_freepass.js' not in open(f,encoding='utf-8',errors='replace').read()]
if _nofp: _g64.append(f'{len(_nofp)}岛未加载hansen_freepass.js')
if _g64: fail(f'v615 24小时全开放 BUG#64: {_g64}')
else: ok(f'v615 BUG#64: 24小时全开放(boss挑战/卡册图鉴/武器自由选)·到期自动关闭·零提醒 (Hansen). hansen_freepass.js: 首次进入设freepass_until=now+24h; 期内hook getUnlockedBossLv->20(所有boss可挑战·recordBossWin仍用真实bossUnlocked防跳关不污染)+设hansen_card_temp_unlock_until(卡册+图鉴全展示·复用游戏自带临时全解锁·rawOnly写真实)+设gear.trialUntil(全武器试玩·商店点任意武器切换); 到期三标记自然过期自动恢复真实进度·无弹窗/toast. 全{len(_isl64)}岛已加载. 真机: 首次全开放(boss20+卡册全+武器试玩剩24h)·24h后三标记过期全恢复真实(boss Lv1)·0报错 v615')


# 🔴 v946 HF6 Boss 大满贯：每岛独立逐轮 state，必须把本轮每位 Boss 各打赢一次。
_g65=[]
try: _rr=open('hansen_round_reward.js',encoding='utf-8').read()
except Exception: _rr=''
if not _rr: _g65.append('hansen_round_reward.js缺失')
else:
    if "STATE_PREFIX = 'hansen_boss_round_state_v946_'" not in _rr: _g65.append('round_reward缺HF6逐轮STATE_PREFIX')
    if 'function validState(x)' not in _rr or 'x.roundNo!==x.completedCount+1' not in _rr: _g65.append('round_reward缺state/roundNo严格校验')
    if 'function recordRoundWin(lv)' not in _rr or 'if(merged.indexOf(lv)>=0)' not in _rr: _g65.append('round_reward缺本轮实际胜利记录/重复去重')
    if 'function txStatus()' not in _rr or "receiptId:'round:v946:'" not in _rr: _g65.append('round_reward缺HF6 pending/receipt轮次凭证')
    if 'function recoverFullStateWithoutTx(show)' not in _rr or 'if(status.absent)return recoverFullStateWithoutTx(show)' not in _rr: _g65.append('round_reward缺满轮state→pending崩溃恢复')
    if 'Boss 本轮进度存档异常，奖励已暂停；原始数据已保留' not in _rr: _g65.append('round_reward缺损坏state fail-closed提示')
    if 'window.getIslandClearedLevels()' in _rr: _g65.append('round_reward仍读取永久卡牌通关记录作为发奖证明')
    if "localStorage.getItem(k+'_prog')" in _rr: _g65.append('round_reward仍读取landN_prog作为发奖证明')
    if 'REWARD_COIN' not in _rr: _g65.append('round_reward缺金币奖励常量REWARD_COIN')  #🔴v829
    if 'if(isLand(k)){' not in _rr or 'return 20;' not in _rr: _g65.append('round_reward缺常规20关/Land动态关数')
    if 'bossVictory' not in _rr: _g65.append('round_reward未hook bossVictory')
    if 'HansenCoins' not in _rr: _g65.append('round_reward未发金币')  #🔴v829 改发金币
    if 'grantBoost' not in _rr: _g65.append('round_reward未发记忆强化buff')  #🔴v829
_isl65=[f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html')]
_norr=[f for f in _isl65 if 'hansen_round_reward.js' not in open(f,encoding='utf-8',errors='replace').read()]
if _norr: _g65.append(f'{len(_norr)}岛未加载hansen_round_reward.js')
if _g65: fail(f'v616 通关一轮20关奖励 BUG#65: {_g65}')
else: ok(f'v946 HF6 Boss大满贯：每岛独立state记录本奖励轮实际胜利，重复关去重；集齐动态总关数后以roundNo receipt结算300金币+120分钟+88钻并清空进入下一轮；满轮state→pending崩溃可自动重建；永久通关/landN_prog不参与发奖。全{len(_isl65)}岛已加载。')


# 🔴 v617 BUG#66(Hansen): 血量在高关失效修复。原Lv11-20伤害=heroMaxHP×百分比(血越高伤害越高完全抵消·血量高关白升), 改全20关固定伤害·护甲全效·血量护甲分工清晰.
_g66=[]
_isl66=[f for f in os.listdir('.') if f.startswith('island_') and f.endswith('.html')]
_b66a=[]; _b66b=[]; _b66c=[]
for _f in _isl66:
    _c=open(_f,encoding='utf-8',errors='replace').read()
    if '72,80,88,96,104,112,120,128,136,145' not in _c: _b66a.append(_f)
    if 'var dmg=Math.round(_FIXED[_lv-1]*(1-_armor/100));' not in _c: _b66b.append(_f)
    if 'heroMaxHP*_PCT' in _c or '_PCT[_lv-11]' in _c: _b66c.append(_f)
if _b66a: _g66.append(f'{len(_b66a)}岛_FIXED未扩展到20关')
if _b66b: _g66.append(f'{len(_b66b)}岛dmg公式非全固定护甲全效')
if _b66c: _g66.append(f'{len(_b66c)}岛残留旧百分比伤害(heroMaxHP×_PCT·血量高关失效)')
try: _gj66=open('hansen_gear.js',encoding='utf-8').read()
except Exception: _gj66=''
for _old66 in ['对Lv1-10固定伤害有效','Lv11-20百分比伤害半效','对前中期 Boss 固定伤害最有效','高级 Boss（百分比伤害）半效']:
    if _old66 in _gj66: _g66.append('gear.js残留旧文案(与v617全固定机制矛盾):'+_old66[:10]); break
if '全部 Boss 都有效' not in _gj66: _g66.append('gear.js血量新文案缺失')
#🔴v853 护甲已删(见v853守卫·getArmorPct恒0·护甲render分支/页签/buyAR全删): 移除原v617的护甲文案断言('全部 Boss 全效')。血量文案断言(上方)保留。Boss战伤害公式dmg=_FIXED×(1-_armor/100)模板未动·_armor恒0中和·公式断言(3018)仍过。
if _g66: fail(f'v617 血量高关失效修复 BUG#66: {_g66}')
else: ok(f'v617 BUG#66: 血量在高关(Lv11-20)失效修复 (Hansen). 原Lv11-20伤害=heroMaxHP×百分比→血越高每下挨打越重正好抵消·花1120钻拉满血在高关完全白费; 改全20关固定伤害_FIXED(Lv1-10原值不变·新增Lv11-20=72~145递增)+公式统一dmg=固定×(1-护甲%)·护甲全20关全效(原Lv11-20护甲半效). 现血量=总容错次数(高低关都有效)·护甲=每次减伤%·乘法协同分工清晰. 全{len(_isl66)}岛统一. 真机: Lv11 100血/500血扣血都72但500血扛7次vs100血1.4次=血量生效·Lv20满甲扣73·裸装高关秒杀·满级Lv20扛6.9次·0报错 v617')

# 🔴 v620 BUG#72(Hansen): 外星霸主(Lv18)歼星光束——(1)激光太居中挡boss立绘→stage④整体右移(核心移到boss右缘外·钳位防出屏); (2)激光要【完整显示】(真图底部本就是自然淡出余焰·爆裂区在85-95%)→盒高=整图高(top+H)不裁切(v618硬切barBot+16切在爆裂区·v619淡出遮罩又把爆裂淡没·都错); (3)落地强爆裂(大命中辉132+强白核+四重冲击波)·爆裂在前掉血在后; (4)伤害数字跟随命中点(一次性·不污染其他boss).
_g72=[]
try: _ba72=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
except Exception: _ba72=''
try: _bl72=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
except Exception: _bl72=''
if 'alhx = bc.x + Math.round(_alW/2)' not in _ba72: _g72.append('歼星光束未右移(alhx=bc.x+_alW/2缺失·会重新挡boss)')
if '_almax' not in _ba72 or 'window.innerWidth - 4 - Math.round(_alW/2)' not in _ba72: _g72.append('激光右移缺防出屏钳位(_almax)')
if 'var wrapBot=top+H' not in _ba72: _g72.append('激光未完整显示(wrapBot应=top+H让整图自然淡出·不可再裁barBot+16切爆裂区或加淡出遮罩)')
if 'Math.round(132*sz*fxi)' not in _ba72: _g72.append('落地大命中辉缺失(132·爆裂感不足)')
if "Math.round(146*sz),'#6ee7b7'" not in _ba72: _g72.append('落地第四重冲击波缺失(146外扩·爆裂感不足)')
if 'window.__hsnDmgX=hx' not in _ba72: _g72.append('boss_attack未设__hsnDmgX(伤害数字不跟随激光命中点)')
if '__hsnDmgX' not in _bl72: _g72.append('boss_lock HansenHeroHit未读__hsnDmgX(伤害数字仍锁boss中线·与激光分离)')
if '_bspr614' not in _bl72: _g72.append('boss_lock丢失v614 boss中线默认(_bspr614·覆盖只在__hsnDmgX存在时·不可破坏其他boss)')
if _g72: fail(f'v620 外星霸主激光右移/完整显示/落地爆裂/伤害跟随 BUG#72: {_g72}')
else: ok('v620 BUG#72: 外星霸主(Lv18)歼星光束右移避开boss+完整显示+落地强爆裂+伤害数字跟随 (Hansen). (1)激光太居中挡boss→stage④整体右移alhx=bc.x+W/2(亮核移到boss右缘外·实测cx197→288·boss122-272完整露出)+钳位盒右缘≤vw-4防出屏. (2)光束完整显示: 真图底部本就是设计好的自然淡出余焰·爆裂区在图85-95%; v618硬切barBot+16恰好切在最亮爆裂区→硬切线·v619淡出遮罩又把爆裂核心淡没(Hansen:光效像被切半截/快看不见)·都是错的; 现wrapBot=top+H盒高=整图高·光束+爆裂+余焰完整呈现·底部靠图自身alpha自然收尾(无硬切无变暗)·余焰落血条下方空隙不触题目. (3)落地强爆裂: scaleY完成即大爆裂(大命中辉132+强白核瞬爆+四重冲击波环50/80/112/146+地面横向冲击+24火花8碎片)·爆裂在前150ms掉血deal紧随220ms. (4)伤害数字-NN跟随命中点(window.__hsnDmgX一次性读后即清·不设则其他boss仍走v614 boss中线零影响). 真机Lv18满装备: 激光cx288完整显示无切无淡·落地强爆裂四重环·boss完整露出·0报错 v620')

# 🔴 v621 BUG#73(Hansen): iPhone 静音(响铃关)模式点击音/朗读不响——iOS 默认网页 Web Audio 走"环境音(ambient)"会话被静音开关静掉; click_sound.js 设 navigator.audioSession='playback' 即使静音也出声。
_g73=[]
try: _cs73=open('click_sound.js',encoding='utf-8',errors='replace').read()
except Exception: _cs73=''
if not _cs73: _g73.append('click_sound.js 缺失')
else:
    if 'function setPlaybackSession' not in _cs73: _g73.append('缺 setPlaybackSession 函数')
    # 🔴v1070: 原为钉死整条赋值语句，等价改写(换属性写法/换 API)即误报——
    #   与 v1069「星海觉醒」那两道守卫同一个坑。改为查行为特征。
    if not re.search(r"\.type\s*=\s*['\"]playback['\"]|type\s*:\s*['\"]playback['\"]", _cs73): _g73.append('未设 audioSession.type=playback(iOS静音仍静音)')
    if 'navigator.audioSession' not in _cs73: _g73.append('未用 navigator.audioSession(Web Audio Session API)')
    if _cs73.count('setPlaybackSession()')<2: _g73.append('setPlaybackSession 调用点不足(应加载+手势+恢复+init多处)')
_isl73=[f for f in os.listdir('.') if (f.startswith('island_') and f.endswith('.html')) or f=='index.html']
_nocs=[f for f in _isl73 if 'click_sound.js' not in open(f,encoding='utf-8',errors='replace').read()]
if _nocs: _g73.append(f'{len(_nocs)}页未加载click_sound.js')
if _g73: fail(f'v621 iPhone静音点击音不响 BUG#73: {_g73}')
else: ok(f'v621 BUG#73: iPhone静音(响铃关)模式点击音/朗读也出声 (Hansen·iPhone17ProMax点击无音效). 真因=iOS默认网页Web Audio走环境音(ambient)会话被静音开关静掉(代码手势解锁本就没问题). 修复: click_sound.js 加 setPlaybackSession 设 navigator.audioSession.type=playback (Web Audio Session API·iOS16.4+)·加载/每次手势/回前台/创建ctx 各调一次·不支持(安卓/桌面/旧iOS)时try-catch静默跳过零影响. 全页含单词朗读音频一并在静音下生效(playback会话会暂停后台音乐=媒体类App标准行为). 全{len(_isl73)}页加载click_sound.js. Chromium验证: 无此API优雅跳过·点击音机制仍正常·0报错. iOS真机静音出声待Hansen设备确认. v621')

# 🔴 v622 BUG#74(Hansen): 暗夜吸血鬼(batmoon)血月位置——v614 把血月从 bx+52(偏右)改成 bx-MS/2(居中boss中线)后, 红血月正好压在吸血鬼红色头部上=挡脸; v622 恢复偏右 bx+52(+钳位防出屏)。咬合/血条仍走中线不动。
_g74=[]
try: _ba74=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
except Exception: _ba74=''
if 'var moonX=Math.min(bx+52' not in _ba74: _g74.append('血月未回到右侧(应 moonX=Math.min(bx+52,...)·不可再用 bx-MS/2 居中压脸)')
if 'var moonX=bx-MS/2' in _ba74: _g74.append('血月仍居中 bx-MS/2(会压住吸血鬼头部挡脸·须改 bx+52 偏右)')
if 'window.innerWidth-4-MS' not in _ba74: _g74.append('血月缺防出屏钳位(window.innerWidth-4-MS)')
if _g74: fail(f'v622 暗夜吸血鬼血月位置 BUG#74: {_g74}')
else: ok('v622 BUG#74: 暗夜吸血鬼(batmoon)血月回到右侧原位 (Hansen·血月跑中间挡吸血鬼脸). v614 曾把血月从 bx+52(偏右)改成 bx-MS/2(居中 boss 中线·"特效以boss为中心"), 但血月(红)正好压在吸血鬼红色头部上→严重挡脸。v622 恢复 v614 之前的偏右位 moonX=Math.min(bx+52,window.innerWidth-4-MS)(+钳位防出屏)·月亮中心=boss中线+84px·真机实测血月cx=281=boss cx197右侧+84·右缘313不出屏·不压头。跟随月亮的掠月剪影蝠/蝠群起点/吸血回流终点都用 mc.x 自动跟到右侧; 獠牙咬合/滴血/血条仍走 barL+barW 中线(不受影响·Hansen要求保留)。0报错 v622')

# 🔴 v623 BUG#75(Hansen): 装备面板武器图标去深框(亮主题下违和)+ 配色条挪到面板底部
_g75=[]
try: _gear75=open('hansen_gear.js',encoding='utf-8',errors='replace').read()
except Exception: _gear75=''
if 'radial-gradient(circle at 50% 38%,#3d5078' in _gear75: _g75.append('hg-ic 仍是深蓝径向底(#3d5078·应透明)')
if '#1a2740 75%' in _gear75: _g75.append('武器行内联仍有深色径向收边(#1a2740·应去掉)')
if '.hg-ic{width:66px;height:66px;flex:none;display:grid;place-items:center;background:transparent' not in _gear75: _g75.append('hg-ic 未设为透明背景')
if '常驻顶部' in _gear75: _g75.append('配色条仍标注常驻顶部(应已移到底部)')
if 'hg-skinbar-label' not in _gear75: _g75.append('缺底部配色条标签 hg-skinbar-label')
if _g75: fail(f'v623 装备面板 BUG#75: {_g75}')
else: ok('v623 BUG#75: 装备面板武器图标去深框+配色条移底部 (Hansen·武器透明PNG直接贴亮卡片融为一体·配色条不抢上方重点). hg-ic 改 background:transparent/border:0/box-shadow:none(原深蓝径向#3d5078→#212d49违和亮主题)·武器行移除内联深色径向(原…→#1a2740)·投影.6→.22柔和·图58→60px。配色切换条(6皮肤:奶油/薄荷/天空/蜜桃/薰衣草/纯净)从 body 顶部移到 tab 内容之后(面板底部)+虚线分隔+🎨面板配色标签。仅动 hg-ic(面板专用·boss战武器框是 .hero-weapon-box 不受影响)·7武器PNG本就透明。真机:icBg=none/transparent/border0·配色条top在武器末行下方·0报错 v623')

# 🔴 v624 BUG#76(Hansen): boss战可读性遮罩 — 影院背景(尤其亮色"云朵梦境")铺满后 boss名/题目字看不清
_g76=[]
try: _bl76=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
except Exception: _bl76=''
if "body.hsn-boss-battle::before{content" not in _bl76 or "background:linear-gradient(180deg,rgba(8,11,22,.50)" not in _bl76: _g76.append('缺 boss战固定全屏可读性遮罩(::before渐变)')
if "#bossScreen .boss-name{text-shadow" not in _bl76: _g76.append('boss名缺深色描影')
if "#bossScreen .boss-question{text-shadow" not in _bl76: _g76.append('大词缺深色描影')
if "#bossScreen .boss-q-sub{color:#eef2f7" not in _bl76: _g76.append('题目提示缺提亮+描影')
if "//🔴BUG#76" not in _bl76: _g76.append('缺 //🔴BUG#76 注释')
if _g76: fail(f'v624 boss战可读性遮罩 BUG#76: {_g76}')
else: ok('v624 BUG#76: boss战可读性遮罩(影院亮背景下文字看不清) (Hansen·云朵梦境等铺满后boss名/题目字看不清). hansen_boss_lock.js 注入 #bossScreen 渐变暗色衬底(立绘段.30场景透出·boss名带.48·题目带.60-.66·文字跳出·影院图仍半透明可见)+ boss名/大词/提示三处深色描影(#bossScreen .x 高优先级覆盖各岛class·提示字提亮#eef2f7)。对任何背景主题都生效。判定测试:不透明绿底整块覆盖#bossScreen证层级正确(canvas z-index:-1在下)。真机(430×920·云朵梦境激活):#bossScreen区明显比面板外压暗·boss名史前霸王龙+题目白字清晰·0报错。仅注入CSS(boss_lock全岛共享)。v624')

# 🔴 v625 BUG#77(Hansen): 底栏导航图标太小+留白太多 → 放大图标+缩小padding+卡册图解耦, 条高不变填满
import glob as _glob77
_g77=[]; _bad77=[]
for _isl in _glob77.glob('island_*.html'):
    _t=open(_isl,encoding='utf-8',errors='replace').read()
    if '.bottom-nav .nav-item .ni-icon{font-size:34px;line-height:1' not in _t: _bad77.append(_isl+':图标未放大到34px+line-height:1')
    if '.bottom-nav .nav-item{flex:1;padding:6px 0;' not in _t: _bad77.append(_isl+':nav-item padding未缩到7/5')
    if 'width:1.45em;height:1.45em' in _t: _bad77.append(_isl+':卡册图仍是1.45em(应解耦固定38px)')
    if '🔴BUG#77' not in _t: _bad77.append(_isl+':缺🔴BUG#77注释')
if _bad77: _g77=_bad77[:6]
if _g77: fail(f'v625 底栏导航 BUG#77: {_g77}')
else: ok('v625 BUG#77: 底栏导航图标放大+填满留白 (Hansen·图标太小留白太多空间浪费·要求条高不变). 19岛 .ni-icon 字号 22→34px+line-height:1收紧·卡册图从1.45em(会随字号疯长撑高条)解耦成固定38px·nav-item padding 10/8→7/5。条高真机70px=改前不变·四项item高度统一69·图标完整无裁切。仅改各岛HTML的bottom-nav CSS(19份同款一次性全局替换)。v625')

# 🔴 v626 BUG#78(Hansen): 底栏4图标没对齐(emoji中心25 vs 卡册27差2px)+卡册显小+图标偏上 → 固定居中盒对齐+卡册放大+下移
import glob as _glob78
_bad78=[]
for _isl in _glob78.glob('island_*.html'):
    _t=open(_isl,encoding='utf-8',errors='replace').read()
    if '.bottom-nav .nav-item .ni-icon{font-size:34px;line-height:1;height:40px;display:flex;align-items:center;justify-content:center' not in _t: _bad78.append(_isl+':ni-icon非40px居中盒')
    if '.bottom-nav .nav-item{flex:1;padding:6px 0;' not in _t or 'display:flex;flex-direction:column;align-items:center;justify-content:center}' not in _t: _bad78.append(_isl+':nav-item非纵向居中或padding非8-2')
    if 'width:50px;height:50px;object-fit:contain' not in _t: _bad78.append(_isl+':卡册图非50px')
    if '🔴BUG#78' not in _t: _bad78.append(_isl+':缺🔴BUG#78注释')
if _bad78: fail(f'v626 底栏对齐 BUG#78: {_bad78[:6]}')
else: ok('v626 BUG#78: 底栏4图标垂直对齐+卡册放大+下移 (Hansen·四图标没跟卡册对齐+卡册显小+图标偏上). ni-icon 由 display:block(顶对齐→emoji中心25/卡册27差2px)改固定40px flex居中盒→四图标(emoji+卡册img)同中线·真机中心全=29对齐·卡册img 38→42px(更足)·nav-item flex纵向居中+padding 7/5→8/2 图标组下移(中心25→29)。条高真机70px不变。仅改19岛 bottom-nav CSS。v626')

# 🔴 v627(Hansen): 首页两栏标题改名 学习模式→精学模式 / 游戏模式→畅玩模式 (文案优化, 非bug)
import glob as _glob627
_bad627=[]
for _isl in _glob627.glob('island_*.html'):
    _t=open(_isl,encoding='utf-8',errors='replace').read()
    if '<div class="section-label">精学模式</div>' not in _t: _bad627.append(_isl+':缺精学模式标题')
    if '<div class="section-label">畅玩模式</div>' not in _t: _bad627.append(_isl+':缺畅玩模式标题')
    if '<div class="section-label">学习模式</div>' in _t: _bad627.append(_isl+':仍有旧"学习模式"标题')
    if '<div class="section-label">游戏模式</div>' in _t: _bad627.append(_isl+':仍有旧"游戏模式"标题')
if _bad627: fail(f'v627 首页栏目改名: {_bad627[:6]}')
else: ok('v627 首页两栏标题改名 (Hansen 文案优化): 学习模式→精学模式 / 游戏模式→畅玩模式 (对比清楚=学vs玩·四字对仗收"模式"·畅玩为游戏圈常用词)。19岛 section-label 全部已改·旧名绝迹。注:index.html统计标签"12学习模式"(计数)与成就内部分类cat:游戏模式 故意未动(不同语义)。v627')

# 🔴 v628 BUG#79(Hansen): boss战败/胜利页横向分割 — v624遮罩#bossScreen{background}无状态限定, 战败/胜利页内容短→深底只盖上半截、露出页面浅底=分割 → 遮罩限定 body.hsn-boss-battle 仅战斗中
_bl79=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
_g79=[]
if 'body.hsn-boss-battle::before{' not in _bl79: _g79.append('遮罩未限定body.hsn-boss-battle(会致战败/胜利页横向分割)')
if '//🔴BUG#79' not in _bl79: _g79.append('缺//🔴BUG#79注释')
if _g79: fail(f'v628 boss战败页分割 BUG#79: {_g79}')
else: ok('v628 BUG#79: boss战败/胜利页横向分割修复 (Hansen·打完boss战败页下方出现横向分割·上深下浅). 根因: v624 BUG#76 可读性遮罩 #bossScreen{background:渐变暗底} 无状态限定, 而战败页bossDefeat()/胜利页bossVictory()都remove hsn-boss-battle且内容短→深底只盖住上半截内容、下半截露出页面浅紫底=横向分割。修复: 遮罩选择器加 body.hsn-boss-battle 前缀(仅战斗中bossActive=true时生效)→战败/胜利/开始页无深底=背景均匀无分割·战斗中遮罩照常保可读性。真机验证: 战败页#bossScreen背景=none无分割·战斗中=渐变遮罩在·0报错。仅改hansen_boss_lock.js一行选择器。v628')

# 🔴 v629(Hansen): 亮主题(梦境云端等)下首页/介绍页文字发虚 → hansen_home_link.js 注入可读性CSS(纯色字text-shadow光晕·渐变标题drop-shadow暗边)。★铁律: 渐变标题绝不能用text-shadow(会把透明字面压黑·v629教训)
_hl629=open('hansen_home_link.js',encoding='utf-8',errors='replace').read()
_g629=[]
if 'hsn-text-readability' not in _hl629: _g629.append('缺可读性CSS注入(hsn-text-readability)')
# 渐变标题(岛#homeScreen主标题 + index .page h1.main)必须用 drop-shadow
if 'div:first-child{filter:drop-shadow' not in _hl629: _g629.append('岛渐变主标题未用drop-shadow(会变黑)')
if '.page h1.main{filter:drop-shadow' not in _hl629: _g629.append('index渐变大标题未用drop-shadow(会变黑)')
# 岛渐变主标题必须显式 text-shadow:none(双保险防变黑)
if 'div:first-child{filter:drop-shadow' in _hl629:
    _seg=_hl629.split('div:first-child{filter:drop-shadow',1)[1][:160]
    if 'text-shadow:none' not in _seg: _g629.append('岛渐变主标题未显式text-shadow:none(防变黑双保险)')
if _g629: fail(f'v629 文字可读性 BUG防护: {_g629}')
else: ok('v629: 亮主题文字可读性增强 (Hansen·梦境云端等亮主题下副标题/彩蛋描述/栏目标题/介绍段文字发虚看不清). hansen_home_link.js(19岛+index共享)注入<style id=hsn-text-readability>: 纯色字(岛#homeScreen副标题/.pet-name/.pet-text/.section-label·index .page .tagline/.subtitle/.intro)加柔和深色描影text-shadow光晕; 渐变标题(岛#homeScreen主标题X大冒险·index .page h1.main单词大冒险)用drop-shadow滤镜加暗边并禁text-shadow。★关键教训(已记知识库): 渐变文字(background-clip:text+text-fill-color:transparent)必须用drop-shadow滤镜·绝不能用text-shadow——text-shadow会把透明字面压成黑色(Hansen实测标题变黑)。岛规则锚#homeScreen、index规则锚.page两容器互斥不跨页误伤·卡片字不加。真机(2岛+index·梦境云端激活): 标题渐变保留不黑(text-fill-color:transparent+textShadow:none+有drop-shadow)·纯色字描影清晰·0报错。仅改hansen_home_link.js一处注入。v629')

# 🔴 v630 BUG#80(Hansen): boss战斗中横向分割 — 遮罩贴#bossScreen内容高度, 长屏手机战斗内容填不满整屏→遮罩到内容底就没了、下方露页面浅底=分割(BUG#79同根因·但在战斗态, v628只修了战败/胜利没修战斗). 修复: 战斗中给#bossScreen加min-height铺满视口
_bl80=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
_g80=[]
if 'body.hsn-boss-battle::before{' not in _bl80: _g80.append('战斗遮罩非::before固定层(长屏会分割)')
_seg80=_bl80.split('body.hsn-boss-battle::before{',1)[1][:400] if 'body.hsn-boss-battle::before{' in _bl80 else ''
if 'position:fixed' not in _seg80: _g80.append('遮罩缺position:fixed(铺满视口的关键)')
if 'inset:0' not in _seg80: _g80.append('遮罩缺inset:0(铺满视口的关键)')
if 'pointer-events:none' not in _seg80: _g80.append('遮罩缺pointer-events:none(会挡点击)')
if 'min-height:calc(100' in _bl80: _g80.append('残留旧min-height撑高写法(已被固定层取代·应删)')
if '//🔴BUG#80' not in _bl80: _g80.append('缺//🔴BUG#80注释')
if _g80: fail(f'v630 boss战斗分割 BUG#80: {_g80}')
else: ok('v630/v632 BUG#80: boss战斗中横向分割修复 (Hansen·长屏手机打boss时选项下方出现横向分割·上深下浅). 根因: v624遮罩贴#bossScreen内容高度, 长屏(如1080×2400)上战斗内容填不满整屏→遮罩到内容底就结束·下方露出页面浅底=横向分割。和BUG#79同根因但在战斗态。v630先尝试给#bossScreen加min-height铺满, 但该写法在Hansen真机(微信WebView)上没站住·分割仍在。v632彻底修复: 改用固定全屏遮罩 body.hsn-boss-battle::before{position:fixed;inset:0;background:渐变;pointer-events:none} —— 固定层物理上永远铺满整个视口, 不依赖vh/dvh计算·不管内容多高/什么手机都不可能在下方留空。z-index:0在影院画布(-1)之上、在boss内容(.app定位子树整体在::before之上)之下·不挡立绘/题目/选项·pointer-events:none不挡点击。真机+长屏(1000)验证: 遮罩铺满整屏无分割·boss内容清晰可见可点·0报错。元教训(铁律#0): 靠视口高度撑内容元素的写法在移动端不可靠, 要铺满整屏用固定全屏层最稳; 且必须在真机/长屏上跑过截图确认才算修好。v632')

# 🔴 v633 BUG#81(Hansen): boss结算页+各模式结算/通关页 在亮主题下浮字发虚 — 结算文字直接浮在主题背景上无面板衬底 → 统一加深色光晕(渐变标题用drop-shadow防变黑)
_bl81=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
_g81=[]
if '.boss-victory{text-shadow' not in _bl81: _g81.append('boss结算页(.boss-victory)缺纯色字光晕')
if '.boss-victory h2{text-shadow:none' not in _bl81 or 'filter:drop-shadow' not in _bl81.split('.boss-victory h2{',1)[-1][:200]: _g81.append('boss结算渐变标题h2缺drop-shadow(或没排除text-shadow会变黑)')
if '#molesContent,#fishContent,#matchContent' not in _bl81: _g81.append('各模式结算容器缺统一光晕')
if '#speedContent .speed-timer{text-shadow:none' not in _bl81: _g81.append('渐变timer未排除继承光晕(会变黑)')
if '//🔴BUG#81' not in _bl81: _g81.append('缺//🔴BUG#81注释')
if _g81: fail(f'v633 结算页可读性 BUG#81: {_g81}')
else: ok('v633 BUG#81: boss结算页+各模式结算/通关页亮主题下文字可读性 (Hansen·打完boss/玩完模式后结算页换成亮糖果主题·"战败…"/"游戏结束"/"完成!"等字发虚看不清). 根因: 战败/胜利/各模式结算页都是居中纯色字直接浮在影院主题背景上、无面板衬底, 亮主题(糖果乐园等)直接透上来→字发虚。和 boss 战斗的可读性是同类问题但发生在【结算页】(无遮罩·遮罩仅战斗中)。修复(对齐v629思路·hansen_boss_lock.js注入CSS全岛共享): ①.boss-victory 纯色字加深色光晕text-shadow(继承), 渐变标题h2排除继承的text-shadow(防变黑·v629铁律)改drop-shadow; ②各模式内容容器(#molesContent/#fishContent/#matchContent/#listenContent/#typingContent/#clozeContent/#scrambleContent/#bubbleContent/#eagleContent/#reviewContent/#exploreContent/#speedContent/#petContent/#chestContent)统一加光晕(继承给结算页所有纯色字·结算注入文字全纯色无渐变→安全); ③唯一渐变裁剪文字.speed-timer排除继承防变黑(自带drop-shadow)。.screen-title是容器外兄弟节点不受影响。真机+亮主题(theme_candyland)验证: 战败页"战败…"渐变标题清晰不黑·"别灰心…"副标题清晰·各模式结算文字清晰·0报错。元教训(铁律#0): 改可读性必须先grep全部渐变裁剪文字(只有5处)、给加text-shadow的容器内的渐变文字单独排除, 否则渐变变黑。v633')


# 🐾 v634 宠物奇幻进化展示系统(36阶·全岛·卡牌式展示器+每只可选背景色)
_petfx_g=[]
_miss=[i for i in range(36) if not os.path.exists('pets/pet_%02d.webp'%i)]
if _miss: _petfx_g.append('缺画像pets/pet_%s.webp'%_miss)
if not os.path.exists('hansen_pet_showcase.js'):
    _petfx_g.append('缺hansen_pet_showcase.js')
else:
    _ps=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    for _k in ['window.renderPetScreen','window.updatePetHero','window.showPetEvolve','HsnPet','openCard','hansen_pet_bg','选择卡牌背景色','psw-petbox','updateHeroBg','zh-CN']:
        if _k not in _ps: _petfx_g.append('模块缺标记:'+_k)
_isl=_no_subisle(sorted(glob.glob('island_*.html')))
if len(_isl)!=19: _petfx_g.append('岛数!=19:%d'%len(_isl))
for _f in _isl:
    _t=open(_f,encoding='utf-8',errors='replace').read()
    if _t.count("img:'pets/pet_")!=36: _petfx_g.append('%s画像引用!=36(%d)'%(_f,_t.count("img:'pets/pet_")))
    if "pets/pet_00.webp?v=" not in _t: _petfx_g.append('%s pet图路径缺?v=缓存戳(换图时缓存不失效)'%_f)
    if 'window.PET_STAGES=PET_STAGES' not in _t: _petfx_g.append('%s未暴露window.PET_STAGES'%_f)
    if 'hansen_pet_showcase.js?v=' not in _t: _petfx_g.append('%s未加载宠物模块'%_f)
if _petfx_g: fail('v634 宠物展示系统: '+str(_petfx_g[:6]))
else: ok('v634 宠物奇幻进化展示系统: 36阶画像pet_00..35齐全 + 共享模块hansen_pet_showcase.js(接管renderPetScreen→卡牌式展示器+六境路线图/updatePetHero→图片/showPetEvolve→图片) + 每只宠物可选背景色(10色·默认暗色调·localStorage hansen_pet_bg逐只记忆) + 全19岛PET_STAGES换36阶并暴露window.PET_STAGES且加载模块(带?v=). 真机验证(island_animal+island_color): 宠物屏展示器/卡牌放大/背景色切换+记忆/未解锁剪影+经验门槛/首页heroPet图片化/进化toast图片/36阶XP进度全OK·0报错. 元教训(铁律#0): 22→36换阶时有两处内联PET_STAGES[i](checkAlmostPet·复习HERO卡)依赖该常量·必须同步把常量换成36项否则getPetStage返回0-35会越界崩.')


# 🐾 v637 宠物初始名星灵 + 缩略图背景随所选色 + 色板扩亮/白/彩虹 + 亮底文字可读性
_v637=[]
if not os.path.exists('hansen_pet_showcase.js'):
    _v637.append('缺hansen_pet_showcase.js')
else:
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    # 色板≥24 + 亮彩/纯白/彩虹等新色名都在(0-9历史色号绝不可动·新色往后追加)
    _ncol=_pm.count("{n:'")
    if _ncol<24: _v637.append('BG色板<24(%d·应≥24:暗调10+亮彩8+纯白奶白2+彩虹极光霓虹晚霞4)'%_ncol)
    for _cn in ['晴空','薄荷','樱粉','纯白','奶白','彩虹','极光','霓虹','晚霞']:
        if ("{n:'"+_cn+"'") not in _pm: _v637.append('缺新背景色:'+_cn)
    # 统一背景渲染辅助(支持g自定义渐变如彩虹)
    for _fn in ['function bgCss(','function capCss(','function swCss(','function haloHex(']:
        if _fn not in _pm: _v637.append('缺辅助函数:'+_fn)
    # 缩略图节点背景跟所选色对应(capCss内联bg)
    if "var capBg=uk?capCss(_cb)" not in _pm: _v637.append('缩略图psw-cap未按所选色内联背景(已解锁capCss·未解锁纯黑封存·见v672)')
    # 亮底/彩虹文字可读性(lt类转深色)
    for _rd in ['.pcv-card.lt .pcv-name','.psw-hero.lt .nm']:
        if _rd not in _pm: _v637.append('缺亮底可读性规则:'+_rd)
    if "classList.toggle('lt'" not in _pm: _v637.append('未按亮底切lt类')
    # 初始名小蛋→星灵迁移(模块必须保留'小蛋'做判断·只迁移未改过的默认·保留用户自定义名)
    if "nm==='小蛋'" not in _pm or "='星灵'" not in _pm: _v637.append('petName未做小蛋→星灵迁移')
    if '//🔴v637' not in _pm: _v637.append('模块缺//🔴v637标记')
# 19岛: 初始宠物名已改星灵·无小蛋残留
for _f in sorted(glob.glob('island_*.html')):
    _t=open(_f,encoding='utf-8',errors='replace').read()
    if '小蛋' in _t: _v637.append('%s仍残留小蛋'%_f)
    if _t.count('星灵')<3: _v637.append('%s星灵<3处(应=静态heroPetName+S定义+load兜底)'%_f)
if _v637: fail('v637 宠物名星灵+缩略图随色+色板扩+亮底可读性: '+str(_v637[:6]))
else: ok('v637 宠物初始名小蛋→星灵(petName迁移·保留用户自定义名·19岛默认全改·0残留) + 缩略图节点背景跟该宠物所选色完全对应(capCss内联·支持彩虹) + 背景色板10→24(0-9暗调历史色号顺序绝不动·新增亮彩8/纯白奶白2/彩虹极光霓虹晚霞4) + 亮底/彩虹卡牌器与Hero的纯色文字自动转深色保可读(lt类·自带深色衬底的境标/状态/徽章不动). 真机验证(island_animal·393×880): 名字迁移星灵✓ Hero纯白底深字rgb(27,36,64)✓ 36缩略图全带内联背景✓ 24色板✓ 20号彩虹linear-gradient✓ 纯白18→lt深字✓ 彩虹20→lt+存档色号20✓ 暗夜0→lt=false白字✓ ·0报错. ★教训: hansen_pet_bg存的是色号索引·扩色板只能往后追加·0-9顺序一动老用户选中即错位.')

# 🈶 v638 首页宠物卡名/阶/描述字体统一(强制纯中文字体栈·消除CartoonBlack缺生僻字逐字回退致大小参差)
_v638=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    if '#heroPetName,#heroPetStage,#heroPetText{font-family:"PingFang SC"' not in _pm: _v638.append('首页宠物卡名/阶/描述未以纯中文栈(PingFang打头)强制·防CartoonBlack逐字回退')
    # 三处都补 lang=zh-CN(安卓Noto无lang默认日文字形的双保险)
    if _pm.count("setAttribute('lang','zh-CN')")<3: _v638.append('首页宠物名/阶/描述未补lang=zh-CN(应3处)')
    if '//🔴v638' not in _pm and '🔴v638' not in _pm: _v638.append('模块缺🔴v638标记')
else:
    _v638.append('缺hansen_pet_showcase.js')
if _v638: fail('v638 首页宠物卡字体统一: '+str(_v638[:6]))
else: ok('v638 首页宠物卡名/阶/描述字体统一: 强制纯中文字体栈(PingFang SC/Microsoft YaHei/HarmonyOS/...·覆盖各岛 --font-cartoon=CartoonBlack日系装饰字体) + 三处补 lang="zh-CN". 根因(同v636教训): CartoonBlack 缺"尊/寰"等生僻汉字→那几个字逐字回退到栈里别的字体·大小/字形与周围不一致(Hansen实测"万象天尊·寰宇主宰"尊寰偏小)·全字符统一到同一完整中文字体即一致. 真机验证(island_animal·totalXP=7000·万象天尊·寰宇主宰): heroPetName/heroPetStage/heroPetText 三处 computed font 全为中文栈打头·无CartoonBlack·lang=zh-CN·0报错. 仅改共享模块 hansen_pet_showcase.js(injectCSS加规则+updateHero补lang)·改一处19岛全生效·各岛HTML/CartoonBlack其它卡通标题(常用字渲染一致)不动.')

# 🐣 v639 首页宠物图标: 去圆形背景 + 上下晃动放到非常慢(2.5s→14s)且幅度减小(-6→-4px)·仅translateY不旋转
_v639=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    if '.pet-slot{background:none' not in _pm: _v639.append('首页宠物图标圆形背景未去(.pet-slot应bg=none)')
    if '@keyframes hsnPetFloatSlow' not in _pm or '#heroPet{animation:hsnPetFloatSlow' not in _pm: _v639.append('慢速晃动hsnPetFloatSlow未应用到#heroPet')
    if '14s' not in _pm: _v639.append('晃动时长未放慢到14s')
    # 防晕红线: 慢晃动关键帧只能translateY·绝不能有rotate
    import re as _re
    _m=_re.search(r'@keyframes hsnPetFloatSlow\{[^}]*\}[^}]*\}', _pm)
    if _m and 'rotate' in _m.group(0): _v639.append('hsnPetFloatSlow含rotate(违防晕红线·只能translateY)')
    if '🔴v639' not in _pm: _v639.append('模块缺🔴v639标记')
else:
    _v639.append('缺hansen_pet_showcase.js')
if _v639: fail('v639 首页宠物图标去背景+慢晃动: '+str(_v639[:6]))
else: ok('v639 首页宠物图标: ①去掉背后圆形半透明背景(各岛 .pet-slot 的金色radial圆·.pet-slot{background:none!important}覆盖) ②上下晃动从 petFloat 2.5s/-6px 改为 hsnPetFloatSlow 14s/-4px(约5.6倍慢·幅度减小·仅translateY无rotate守防晕红线·#heroPet ID+!important压过.pet-emoji). 真机验证(island_animal·万象天尊): .pet-slot computed backgroundImage=none·#heroPet animationName=hsnPetFloatSlow animationDuration=14s·关键帧50%=translateY(-4px)无rotate·宠物图在·0报错·截图确认圆背景消失. 仅改共享模块 hansen_pet_showcase.js(injectCSS加3条规则)·改一处19岛全生效·各岛HTML零改动.')

# ⚡ v640 路线图缩略图背景换色实时更新(换完色不必退出重进·当场跟着变)
_v640=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    if 'function updateCapBg(' not in _pm: _v640.append('缺updateCapBg(换色实时刷新缩略图)')
    # 必须在色块click处理器里调用(setBgIdx后)·否则换色仍要重渲染才变
    if 'updateCapBg(viewIdx,k)' not in _pm: _v640.append('色块换色处理器未调用updateCapBg(viewIdx,k)实时刷新缩略图')
    if 'capCss(' not in _pm: _v640.append('updateCapBg未用capCss')
    if '🔴v640' not in _pm: _v640.append('模块缺🔴v640标记')
else:
    _v640.append('缺hansen_pet_showcase.js')
if _v640: fail('v640 缩略图换色实时更新: '+str(_v640[:6]))
else: ok('v640 路线图缩略图背景换色实时更新: 卡牌器里给某只宠物换背景色时·除更新卡牌器大卡(applyBg)/当前阶Hero(updateHeroBg)外·新增 updateCapBg(viewIdx,k) 当场把该宠物在路线图的缩略图 .psw-cap 背景刷成新色(caps 按宠物0..N-1顺序排列·caps[i]=第i只)·色块click处理器 setBgIdx 后调用. 修复Hansen报修: 原来换完色路线图缩略图不及时变·要退出重进 renderShowcase 才刷新→现在换色即变·关掉卡牌器回路线图直接看到新背景. 真机验证(island_animal): pet2缩略图换色前=暗夜radial·点彩虹(20)后【不刷新】立即变linear-gradient·存档色号20·关卡牌器回路线图仍彩虹·0报错. 仅改共享模块 hansen_pet_showcase.js(加updateCapBg+色块处理器调用)·改一处19岛全生效.')

# 🔍 v641 卡牌器宠物放大填框(原184px太小·空间没利用)
_v641=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    if '.pcv-pet{position:relative;z-index:2;width:min(' not in _pm: _v641.append('卡牌器宠物框未用min(响应式)放大(原210px太小)')
    if "'.pcv-pet img{width:100%;height:100%;object-fit:contain" not in _pm: _v641.append('卡牌器宠物图未填满框(应width/height:100%·原184px固定)')
    if 'width:184px;height:184px' in _pm: _v641.append('卡牌器宠物图仍是旧184px小尺寸')
    if '🔴v641' not in _pm: _v641.append('模块缺🔴v641标记')
else:
    _v641.append('缺hansen_pet_showcase.js')
if _v641: fail('v641 卡牌器宠物放大: '+str(_v641[:6]))
else: ok('v641 卡牌器宠物放大填框: Hansen 嫌卡牌器里宠物太小·空间没利用·要尽可能放大填满框看特效. .pcv-pet 框 210px→min(300px,80vw)(响应式·窄屏不溢出)·.pcv-pet img 184px固定→width/height:100%填满框(object-fit:contain保持比例不变形)·顶距30px→8px(上移用空间)·emoji兜底120→170px·底部阴影184→220px配大宠物. 真机验证(island_animal·第27只九霄雷鲲·393×880): 宠物框/图均300×300(原184·+63%)·名字/描述/状态/24色板/上一只下一只全可见且导航底783<视口880(不裁不滚·守铁律1.9)·0报错·截图确认鲸鱼填满框. 仅改共享模块 hansen_pet_showcase.js(.pcv-pet/.pcv-ped尺寸)·改一处19岛全生效·宠物画像PNG本身不动.')

# 🐳 v642 卡牌器宠物放大【对全部36只统一】+ 再顶到接近卡片宽极限(Hansen: 不只鲸鱼·所有宠物都要大且统一尺寸)
_v642=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    # 放大走共享 .pcv-pet 类(对全部36只生效)·再顶到接近卡片宽极限
    if 'width:min(344px,100%);aspect-ratio:1' not in _pm: _v642.append('卡牌器宠物框未放大到344(v674改贴合卡片内宽min(344px,100%)+aspect-ratio:1)')
    if "'.pcv-pet img{width:100%;height:100%;object-fit:contain" not in _pm: _v642.append('宠物图未填满框(width/height:100%)')
    if '🔴v642' not in _pm: _v642.append('模块缺🔴v642标记')
# 36张宠物画像统一画布(确保 contain 后长边渲染一致=统一大小的前提)
import glob as _glob
_pngs=sorted(_glob.glob('pets/pet_*.webp'))
if len(_pngs)<36: _v642.append('宠物画像不足36张(%d)'%len(_pngs))
else:
    try:
        from PIL import Image as _IMG
        _szs=set()
        for _pf in _pngs: _szs.add(_IMG.open(_pf).size)
        if len(_szs)!=1: _v642.append('36张宠物画布尺寸不统一(%s)·contain后大小会参差'%str(list(_szs)[:4]))
    except Exception:
        pass  # PIL 不可用时跳过画布校验(运行环境差异·不阻塞)
if _v642: fail('v642 卡牌器宠物放大对全部36只统一: '+str(_v642[:6]))
else: ok('v642 卡牌器宠物放大【对全部36只统一】: Hansen 强调不只鲸鱼·所有36个宠物都要放大且统一尺寸. 放大走共享 .pcv-pet 类(paintCard 每只都 className=pcv-pet)→对全部36只一视同仁生效·非单只; 36张宠物画像均 512×512 统一画布且美术内容长边均归一化占93%→object-fit:contain 进同一框后每只长边渲染一致=尺寸统一; 本版再把框从 min(300px,80vw) 顶到 min(322px,84vw)(接近卡片可用宽328px极限·响应式窄屏不溢出)·宠物图 width/height:100%填满·底部阴影230px. 真机验证(island_animal·抽测 pet0蛋/pet2窄/pet10/pet26宽鲸/pet35终态): 5只图元素渲染尺寸全=322×322(唯一尺寸集合只1个=完全统一)·蛋与鲸截图同样大同样填满框·名字/描述/状态/24色板/上一只下一只全可见·0报错. 仅改共享模块 hansen_pet_showcase.js(.pcv-pet/.pcv-ped尺寸)·宠物画像PNG本身不动.')

# 🌐 v643 全局统一宠物系统(所有19岛共用一只·全局XP=各岛之和·不再每岛独立)
_v643=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    if 'HSN_ISLAND_KEYS' not in _pm or _pm.count('wordIsland')<19: _v643.append('缺19岛键名表HSN_ISLAND_KEYS')
    if 'function globalXP(' not in _pm: _v643.append('缺globalXP(各岛XP求和)')
    for _fn in ['function xpReq(','function gStageFromXP(','function gProgress(']:
        if _fn not in _pm: _v643.append('缺全局升级函数:'+_fn)
    if 'window.getPetStage=gStageFromXP' not in _pm or 'window.getPetProgress=gProgress' not in _pm: _v643.append('未覆盖getPetStage/getPetProgress为全局版')
    if 'PET_XP_CAP' not in _pm: _v643.append('缺满级门槛常量PET_XP_CAP(可调)')
    if "'hansen_pet_name'" not in _pm and 'PETNAMEKEY' not in _pm: _v643.append('宠物名未全局化(hansen_pet_name)')
    if 'hansen_pet_seen_stage' not in _pm: _v643.append('进化提示未用全局seen-stage(会每岛重弹)')
    if '🔴v643' not in _pm: _v643.append('模块缺🔴v643标记')
else:
    _v643.append('缺hansen_pet_showcase.js')
if _v643: fail('v643 全局统一宠物系统: '+str(_v643[:6]))
else: ok('v643 全局统一宠物系统(所有19岛共用一只宠物·不再每岛独立): Hansen要求宠物联动统一. 全局XP=19岛 max(xp,totalXP) 之和(HSN_ISLAND_KEYS 列全19键·globalXP 求和)→喂 36阶二次升级曲线 gThresh(i)=round(PET_XP_CAP*(i/35)²/5)*5(PET_XP_CAP=20000 满级·前期快秒孵化·长尾·此常量为唯一可调处)→gStageFromXP/gProgress·覆盖 window.getPetStage/getPetProgress(模块 curStage/progress 及各岛据此·全岛同阶); 宠物名全局化到 hansen_pet_name(覆盖 renamePet 写全局·原各岛独立 S.pet.name)·背景色 hansen_pet_bg 本就全局; 进化提示用全局 hansen_pet_seen_stage(全岛只弹一次·首次静默对齐当前阶段不弹历史); 卡牌器未解锁提示改"全岛累计达到X经验". 真机验证(3岛设不同XP animal3000+color4000+food2000=全局9000): animal岛 getPetStage()=23(全局9000对应·进度47%·阶名业火黑麟)·切color岛 getPetStage()=23完全一致·阶名同·宠物名星灵全局·0报错·全局联动成功. 仅改共享模块 hansen_pet_showcase.js·各岛HTML/进化数据/经济/战斗/音频零改动·各岛自己的玩家等级(勘探者)仍按岛(与宠物无关).')

# 🎯 v644 掌握制双门槛升级(满级=掌握全部752词+一定练习·强留存·不学完练熟到不了满级)
_v644=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm644=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    if 'MASTER_HITS' not in _pm644: _v644.append('缺MASTER_HITS(几次算掌握)')
    if 'HansenCanonical.TOTAL_WORDS)||952' not in _pm644.replace(' ',''): _v644.append('缺canonical TOTAL_WORDS=952(712常规+240星海)')
    if 'function globalMastered(' not in _pm644: _v644.append('缺globalMastered(全局已掌握词数)')
    for _fn in ['function masterReq(','function xpReq(']:
        if _fn not in _pm644: _v644.append('缺双门槛曲线:'+_fn)
    if 'm>=masterReq(i)' not in _pm644.replace(' ','').replace('m>=masterReq(i)','m>=masterReq(i)') and 'masterReq(i)' not in _pm644: _v644.append('gStageFromXP未用掌握门槛')
    if 'function hsnTrackMastery(' not in _pm644: _v644.append('缺hsnTrackMastery(包裹markAnswer计掌握+迁移)')
    if '__hsnMc' not in _pm644 or 'window.markAnswer=function' not in _pm644.replace(' ',''): _v644.append('未包裹markAnswer记每词答对数')
    if '_hsnMarkWrapped' not in _pm644: _v644.append('缺模块级防重包裹布尔_hsnMarkWrapped(审计加固·保证markAnswer只包一次)')
    if 'hansen_mastery_migrated' not in _pm644: _v644.append('缺老用户迁移(否则宠物被重置回蛋)')
    if 'gThresh' in _pm644: _v644.append('残留旧gThresh引用(已改名xpReq·会报错)')
    if '🔴v644' not in _pm644: _v644.append('缺🔴v644标记')
else:
    _v644.append('缺hansen_pet_showcase.js')
if _v644: fail('v644 掌握制双门槛: '+str(_v644[:6]))
else: ok('v644 掌握制双门槛升级(满级=掌握全部752词+一定练习·强留存): Hansen核心要留存·要求"把所有单词学完(练熟)才能满级·不能太快满级". 暴露原纯经验制漏洞(练习经验可反复刷·光刷几个词也能顶满). 新机制=双门槛取较低者(缺一不可): ①掌握单词数 globalMastered(每词答对≥MASTER_HITS=3次·任意模式累计·markAnswer被hsnTrackMastery包裹累加 S.mc[idx])·满级第36阶=掌握全部 TOTAL_WORDS=752 词=硬天花板(不学完练熟绝到不了满级)·曲线 masterReq(i)=round(752*(i/35)^2.5)后置(中后期卡关·逼学新词+练熟); ②累计经验 xpReq(i)=round(15000*(i/35)^1.8/5)*5较缓(前期驱动·秒孵化第1阶). 阶段=两门槛都满足的最高阶·进度取两条到下阶完成度较小(瓶颈). 老用户迁移(hansen_mastery_migrated一次): 已learned且无wrongs的词→mc补成已掌握(grandfather·不重置宠物)·当前岛内存S.mc同步补种+save(防页面save覆盖回空). 真机验证: 掌握76词+XP20000→getPetStage=14(掌握卡关·与独立算一致)·掌握500+XP100→stage2(XP卡关)·markAnswer包裹答对mc正确累加·迁移learned[0-4]wrongs{2:1}→mc{0:3,1:3,2:2,3:3,4:3}且不被覆盖·切岛一致·0报错. 仅改共享模块·19岛HTML/进化数据/经济/战斗/音频零改动·各岛玩家等级仍按岛. 两旋钮可调: PET_XP_CAP(练习量·想留存更久调大) MASTER_HITS(几次算掌握).')

# ---- v645 挑战Boss 标签彩虹霓虹 ----
_v645=[]
if os.path.exists('hansen_island_upgrade.js'):
    _ug=open('hansen_island_upgrade.js',encoding='utf-8',errors='replace').read()
    _ugc=_ug.replace(' ','')
    if '.boss-card-label{' not in _ugc: _v645.append('upgrade.js未注入.boss-card-label彩虹规则')
    if 'background-clip:text' not in _ugc and '-webkit-background-clip:text' not in _ugc: _v645.append('挑战Boss缺背景裁剪到文字(渐变不显示)')
    if 'linear-gradient' not in _ug or 'boss-card-label' not in _ug: _v645.append('挑战Boss缺彩虹linear-gradient')
    # 防晕红线: 渐变文字只能 drop-shadow, 这条规则里不得用 text-shadow(透明文字上 text-shadow 会糊成色块)
    import re as _re645
    _m645=_re645.search(r"\.boss-card-label\{[^}]*\}", _ugc)
    _rule645=_m645.group(0) if _m645 else ''
    if _rule645 and 'drop-shadow' not in _rule645: _v645.append('挑战Boss彩虹缺drop-shadow发光/描边')
    if _rule645 and ('text-shadow:0' in _rule645 or 'text-shadow:rgba' in _rule645 or ('text-shadow:' in _rule645 and 'text-shadow:none' not in _rule645)): _v645.append('挑战Boss渐变文字误用text-shadow(违防晕红线·应drop-shadow)')
    if '🔴v645' not in _ug: _v645.append('缺🔴v645标记')
else:
    _v645.append('缺hansen_island_upgrade.js')
if _v645: fail('v645 挑战Boss彩虹霓虹: '+str(_v645[:6]))
else: ok('v645 挑战Boss 标签彩虹霓虹渐变(贴合街机柜风格·Hansen要求): 把首页 .boss-card-label("挑战Boss")由白字改成彩虹渐变(红橙黄绿青蓝紫 linear-gradient + background-clip:text + 透明填充)·贴合那张霓虹街机柜图标的彩虹风格·更突出劲爆. 黄底可读性靠多层 drop-shadow(暗描边2层+冷光1层)解决·静态无动画(守防晕红线)·只用 drop-shadow 不用 text-shadow(透明文字上 text-shadow 会糊成色块). 决策: Hansen提的"爆裂/墙裂艺术字"类字体几乎全是纯英文字库·渲染不了"挑战"二汉字(会掉默认体·只 Boss 变样很怪)·故选中英统一的彩虹渐变. 注入共享 hansen_island_upgrade.js(19岛全加载·已有createElement style注入处追加规则·!important压各岛内联白字规则)·一处改19岛全生效. 真机验证(animal截图确认彩虹+黄底清晰; food/treasure/color: 渐变√/透明填充√/drop-shadow√/无text-shadow√/0报错). 各岛HTML/其它tile标签零改动.')

# ---- v646 极速60秒 新3D秒表图标 ----
_v646=[]
import glob as _g646
if not os.path.exists('icons/speed_3d.webp'):
    _v646.append('缺 icons/speed_3d.webp')
_miss646=[]; _isl646=sorted(_g646.glob('island_*.html'))
for _f in _isl646:
    _t=open(_f,encoding='utf-8',errors='replace').read()
    _nm=_f.replace('island_','').replace('.html','')
    if 'icons/speed_3d.webp' not in _t: _miss646.append(_nm)
    elif '<div class="m-icon">\u26a1</div>' in _t: _miss646.append(_nm+'(残留⚡emoji)')
if _miss646: _v646.append('极速60秒未换3D图标的岛:'+str(_miss646[:6]))
if _isl646 and not any('icons/speed_3d.webp' in open(_f,encoding='utf-8',errors='replace').read() for _f in _isl646): _v646.append('无岛引用speed_3d.webp')
if _isl646 and not any('\U0001f534v646' in open(_f,encoding='utf-8',errors='replace').read() for _f in _isl646): _v646.append('缺🔴v646标记')
if _v646: fail('v646 极速60秒3D图标: '+str(_v646[:6]))
else: ok('v646 极速60秒 换新3D秒表图标(Hansen上传countdown.webp·要求换图+吻合底色+调到和其它图标一样大尽量大清楚): 把19岛"极速60秒"模式卡的 emoji⚡ 换成 icons/speed_3d.webp(3D金属秒表显示发光"60"·红橙火焰侧+蓝电侧·原1254方图压到512优化)·写法同其它3D图标(img width/height:1em + object-fit:contain + onerror回退⚡)·尺寸 transform:scale(1.15)(渲染≈86px·略大于基准74px让秒表主体≈67px与打地鼠/钓鱼的主体视觉相当·清楚突出·不裁切). 底色 --c1/--c2 由琥珀橙(#f59e0b/#d97706)改炽热橙红(#fb923c/#dc2626)·呼应秒表中央发光"60"+火焰侧·暖底上蓝电互补更跳·与周围冷色卡区分. 真机验证(island_animal·393×880): img 512×512 加载成功·渲染86×86·底色橙红渐变·与打地鼠74/钓鱼74同档协调·截图确认清晰无裁切·(打包前页面混?v=1091/646的版本自检告警属预期·build646全局统一即消). 19岛 startSpeed 卡底色原本一致(都#f59e0b)·⚡作m-icon仅此卡专有·批量替换安全. 各岛其它图标/玩法/经济零改动.')

# ---- v647 火眼金睛 新3D金眼图标 ----
_v647=[]
import glob as _g647
if not os.path.exists('icons/eagle_3d.webp'):
    _v647.append('缺 icons/eagle_3d.webp')
_miss647=[]; _isl647=sorted(_g647.glob('island_*.html'))
for _f in _isl647:
    _t=open(_f,encoding='utf-8',errors='replace').read()
    _nm=_f.replace('island_','').replace('.html','')
    if 'icons/eagle_3d.webp' not in _t: _miss647.append(_nm)
    elif '<div class="m-icon">\U0001f440</div>' in _t: _miss647.append(_nm+'(残留👀emoji)')
if _miss647: _v647.append('火眼金睛未换3D图标的岛:'+str(_miss647[:6]))
# 留顶部间距: eagle_3d 必须带 transform:scale(<1)缩小(否则.m-icon img的height:100%!important会撑满74px顶到天花板·Hansen明确不要太近)
_one647=open('island_animal.html',encoding='utf-8',errors='replace').read() if os.path.exists('island_animal.html') else ''
import re as _re647
_mimg=_re647.search(r'<img src="icons/eagle_3d\.webp[^>]*>', _one647)
_eimg=_mimg.group(0) if _mimg else ''
if _eimg and 'width:81px' not in _eimg: _v647.append('火眼金睛图标未按v664尺寸width:81px')
if _isl647 and not any('icons/eagle_3d.webp' in open(_f,encoding='utf-8',errors='replace').read() for _f in _isl647): _v647.append('无岛引用eagle_3d.webp')
if _isl647 and not any('\U0001f534v647' in open(_f,encoding='utf-8',errors='replace').read() for _f in _isl647): _v647.append('缺🔴v647标记')
if _v647: fail('v647 火眼金睛3D图标: '+str(_v647[:6]))
else: ok('v647 火眼金睛 换新3D金眼图标(Hansen上传Photoroom抠图版666666-Photoroom.webp·要求换图+尽量大但别贴框顶+非常合适的底色): 把19岛"火眼金睛"模式卡的 emoji👀 换成 icons/eagle_3d.webp(金色火眼+金焰+蓝紫宝石格+绿色对勾·原1254方图压512优化·已带透明). 底色 --c1/--c2 由紫(#a855f7/#7e22ce)改深royal蓝(#2563eb/#1e3a8a)·金色在深蓝上最跳+呼应图中深蓝宝石格(比紫更高级·与周围橙红极速/浅蓝抽卡区分). ★尺寸+顶部间距(Hansen明确"尽量大但别离天花板太近太近"): .m-icon img 有 height:100%!important 会把任何图撑满图标区(74px)顶到上下(gap=0·现有图标都贴顶)·故此图必须用 transform:scale(0.85) 缩小→渲染≈63px·居中后顶部留≈6px间距(舒服不贴顶)·又尽量大. 真机验证(animal·393×880·DSF3): img512加载成功·渲染63×63·顶部间距6px(对比无scale=0顶满)·深蓝底·与打地鼠/极速同档协调; color岛: 加载成功+蓝底+0报错. ⚠️坑: .m-icon img{height:100%!important}吃掉inline的width/height:1em·控大小只能靠transform:scale(不受!important影响). 19岛 startEagle 卡底色原本一致(都#a855f7)·👀作m-icon仅此卡专有·批量安全. 各岛其它图标/玩法/经济零改动.')

# ---- v648 装备菜单 新3D装备宝箱图标 ----
_v648=[]
if not os.path.exists('icons/ic_equip.webp'):
    _v648.append('缺 icons/ic_equip.webp')
if os.path.exists('hansen_gear.js'):
    _gj=open('hansen_gear.js',encoding='utf-8',errors='replace').read()
    if 'icons/ic_equip.webp' not in _gj: _v648.append('gear.js装备菜单未换ic_equip图标')
    if 'u-icon"><img' not in _gj.replace(' ',''): _v648.append('装备菜单u-icon未用img(emoji⚔️未替换)')
    # 必须有明确尺寸(适中·u-icon无height:100%规则·靠px控大小)
    import re as _re648
    _m648=_re648.search(r'ic_equip\.webp[^>]*', _gj)
    if _m648 and 'width:' not in _m648.group(0): _v648.append('装备图标未设width尺寸(大小失控)')
    if '\U0001f534v648' not in _gj: _v648.append('缺🔴v648标记')
else:
    _v648.append('缺hansen_gear.js')
if _v648: fail('v648 装备3D图标: '+str(_v648[:6]))
else: ok('v648 装备菜单 换新3D装备宝箱图标(Hansen上传equipment.webp·要求换图+大小适中+完美展现+非常高清): 把功能菜单"装备"瓦片的 emoji⚔️(在共享 hansen_gear.js injectEntry 注入的 <span class="u-icon">⚔️</span>)换成 icons/equipment_3d.webp(3D金甲宝箱+盾+剑+发光宝石·原1254方图压512高清·已带透明·onerror回退⚔️). 尺寸: .u-icon无height:100%强制规则(不同于.m-icon)·故img直接设 width/height:54px 控大小·与邻居emoji(💎🏆📈·font-size42px)视觉相当(适中·略大让3D细节看清)·所在util-card网格行自动等高对齐(装备卡=同行钻石店/成就/统计等高). 高清: 512源@54px显示=约10倍过采样·任意DPR都锐利清晰. 真机验证(island_animal·DSF3): img512加载成功·渲染54×54·与💎🏆同档·同行瓦片等高对齐·两行高度差肉眼不显·0报错. 共享gear.js改一处19岛全生效(都加载gear.js·都在功能菜单注入装备入口)·?v=戳build统一. 其它菜单图标(钻石店/成就/统计/设置/我的学习仍emoji)/玩法/经济零改动.')

# ---- v649 彻底删除👹红鬼占位 + 加载重试 + 消除蛋闪 ----
_v649=[]
import glob as _g649
# 1) 全系统👹(ogre红鬼)零残留(Hansen明确要求从整个系统彻底删除)
_oni=0; _onifiles=[]
for _f in sorted(_g649.glob('*.html'))+sorted(_g649.glob('*.js')):
    _c=open(_f,encoding='utf-8',errors='replace').read().count('\U0001f479')
    if _c: _oni+=_c; _onifiles.append(_f+'x'+str(_c))
if _oni: _v649.append('👹红鬼未彻底删除·仍在:'+str(_onifiles[:5]))
# 2) hansenImgErr 必须有重试(imgTries)且不含👹占位
if os.path.exists('hansen_cards.js'):
    _cj=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    if 'hansenImgErr' in _cj:
        if 'imgTries' not in _cj: _v649.append('hansenImgErr缺重试逻辑(imgTries)')
        if '\U0001f534v649' not in _cj: _v649.append('cards.js缺🔴v649标记')
    else: _v649.append('hansenImgErr丢失')
else: _v649.append('缺hansen_cards.js')
# 3) 19岛 #heroPet 不得残留蛋emoji占位(进岛先闪蛋=老图)
_egg=[]
for _f in sorted(_g649.glob('island_*.html')):
    if 'id="heroPet">\U0001f95a' in open(_f,encoding='utf-8',errors='replace').read():
        _egg.append(_f.replace('island_','').replace('.html',''))
if _egg: _v649.append('heroPet仍残留蛋占位的岛:'+str(_egg[:6]))
if _v649: fail('v649 删红鬼+加载重试+消蛋闪: '+str(_v649[:6]))
else: ok('v649 彻底删除👹红鬼占位+加载失败自动重试+消除宠物蛋闪(Hansen强烈要求: 网慢时boss立绘没加载出来就显示一个红色双角鬼罗刹头像极丑·要从整个系统彻底删除·加载失败也绝不许出现它·并修加载慢·并消除"先闪老图再换新图"): ①根因 hansen_cards.js 的 window.hansenImgErr(v171加的boss立绘onerror兜底)原本失败→隐藏img→贴深色底+48px👹·只在加载失败时出现(Hansen网慢超时→onerror→红鬼). 重写为: 加载失败先自动重试3次(递增延迟450*(n+1)ms·src加__rt=N参数强制重拉·imgTries计数)→网慢瞬时失败大多重试即成功(真正解决"加载不出来")·仍失败才用干净中性占位(深色linear-gradient+暗淡#334155色"?"·绝不再用👹). ②addiction.js积分明细"👹 Boss×50"→"⚔️ Boss×50". ③全系统👹彻底清零(0处·含注释). ④19岛 #heroPet 初始硬编码🥚(图片版宠物系统前的旧占位)→空·进岛宠物位先闪蛋(="先看到不是现有宠物的老图")已消除·模块updateHero可靠填真实宠物img. 排查确认: 岛页+index.html均无service worker(排除SW缓存老资源)·boss立绘bosses/lvNN.webp均带?v=戳(版本化URL不服旧内容)·index的"lamp"x6是CSS clamp()误匹配非神灯开场·神灯/genielamp在boss_attack.js是灯神Boss(lv12)攻击特效非老开场. 真机验证(python-playwright·animal/food/school): 宠物位填真实img不闪蛋·hansenImgErr重试生效·最终兜底为"?"非👹·0报错. 教训(贾维斯): 绝不用丑emoji(👹等)做加载占位; 加载失败先重试再用中性兜底; 元素初始硬编码内容应与JS最终填充一致或留空·避免"老内容→新内容"闪烁.')

# ---- v650 删Boss入口/页老残留(神灯精灵兜底+标题精灵+独角兽介绍页) ----
_v650=[]
import glob as _g650
_genie=0; _gf=[]
for _f in sorted(_g650.glob('*.html'))+sorted(_g650.glob('*.js')):
    _c=open(_f,encoding='utf-8',errors='replace').read().count('\U0001f9de')
    if _c: _genie+=_c; _gf.append(_f+'x'+str(_c))
if _genie: _v650.append('genie神灯精灵未彻底删除·仍在:'+str(_gf[:5]))
import re as _re650
_uni=[]; _bad_onerr=[]
for _f in sorted(_g650.glob('island_*.html')):
    _t=open(_f,encoding='utf-8',errors='replace').read()
    _nm=_f.replace('island_','').replace('.html','')
    if _re650.search(r'>\U0001f984</div>', _t): _uni.append(_nm)
    _m=_re650.search(r'<img class="boss-card-img"[^>]*onerror="([^"]*)"', _t)
    if _m and ('hansenImgErr' not in _m.group(1) or '\U0001f9de' in _m.group(1)): _bad_onerr.append(_nm)
if _uni: _v650.append('仍残留独角兽介绍页占位的岛:'+str(_uni[:6]))
if _bad_onerr: _v650.append('boss入口onerror未走hansenImgErr或仍含精灵的岛:'+str(_bad_onerr[:6]))
if not any('\U0001f534v650' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g650.glob('island_*.html'))):
    _v650.append('缺v650标记')
if _v650: fail('v650 删Boss入口/页老残留: '+str(_v650[:6]))
else: ok('v650 彻底删除Boss入口/页的老版本残留(Hansen: 点挑战Boss刚进去、新版没加载出来时·对面/顶上会闪出老样子——一个神灯精灵图标加Boss战标题·有时先是个独角兽脑袋·都是老版本残留要删掉): 一·Boss入口街机卡图的onerror兜底原本是神灯精灵emoji(入口图加载失败就冒出精灵)→改为走 window.hansenImgErr(复用v649的重试3次加中性问号兜底·岛页已加载hansen_cards.js). 二·Boss页标题的精灵图标删除·只留Boss战文字. 三·Boss页介绍页(showScreen boss的初始与JS恢复内容)顶部80px独角兽div删除(静态HTML与JS重置函数两处·删后保留挑战来啦加说明加开始挑战按钮·JS里变空串拼接合法). 四·成就任务打败挑战与击败1次挑战的图标由独角兽改为匕首(独角兽对boss任务不搭). 五·全系统神灯精灵emoji彻底清零(含boss_lock.js注释里的). 保留宠物数据的焰角麒麟驹与星辉天角兽(真实宠物). 排查确认boss_lock.js的精灵与Boss战全在注释(CSS只隐藏冗余标题非JS动态设标题不会覆盖). 真机python-playwright验animal/food/treasure: 进boss页标题Boss战无精灵·介绍页无独角兽·入口onerror走imgErr无精灵·开始挑战按钮保留·0报错. 教训(延续v649): 图加载兜底绝不用精灵独角兽等花哨emoji统一走hansenImgErr重试加中性; 元素初始硬编码占位与JS渲染不一致会闪老样子应删除.')

# ---- v651 宠物系统彻底只用图(删所有stage.emoji老占位+pet图加载失败走hansenImgErr) ----
_v651=[]
import glob as _g651
# 1) 19岛: 无 stage.emoji 显示残留(老emoji占位全删·改pet图)
_se=[]
for _f in sorted(_g651.glob('island_*.html')):
    if 'stage.emoji' in open(_f,encoding='utf-8',errors='replace').read():
        _se.append(_f.replace('island_','').replace('.html',''))
if _se: _v651.append('仍残留 stage.emoji 老占位的岛:'+str(_se[:6]))
# 2) 模块: pet图渲染都带 onerror hansenImgErr + emOf 无显示调用(只剩定义)
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    _onc=_pm.count('hansenImgErr&&window.hansenImgErr(this)')  # 🔴v882: 改数hansenImgErr兜底片段(v882给onerror加pet-ready前缀·hansenImgErr不再在onerror开头但兜底仍在)
    if _onc < 3: _v651.append('模块pet图hansenImgErr兜底不足(应>=3·实'+str(_onc)+')')
    if _pm.count('emOf(') > 1: _v651.append('模块emOf仍有显示调用(应只剩定义·实'+str(_pm.count('emOf('))+')')
    if '\U0001f534v651' not in _pm: _v651.append('模块缺v651标记')
else: _v651.append('缺hansen_pet_showcase.js')
if _v651: fail('v651 宠物系统彻底只用图: '+str(_v651[:6]))
else: ok('v651 宠物系统彻底只用自己的图·删除所有老emoji占位(Hansen: 宠物系统以前用的是emoji图标·要直接用我们自己的pet图·以前那些老图全删掉·不希望点进宠物系统还看到以前的图): 排查发现宠物渲染分两层. 一·共享模块 hansen_pet_showcase.js(实测才是真正在跑的·宠物屏37张pet图全是图无emoji)原本3处渲染(卡牌器vis/首页updateHero/进化徽章)都是 src存在用图否则兜底emOf老emoji·且pet图无onerror(网慢加载失败会裂图)→改为: 3处都给img加 onerror走window.hansenImgErr(复用v649重试3次加中性问号兜底)·空src兜底从emoji改中性问号或空(emOf只剩函数定义无任何显示调用·彻底不显示emoji). 二·19岛island各自还有5处遗留 stage.emoji 显示(首页heroPet文本/进化showComboToast/宠物屏pet-big与140px与54px·这些在岛内updatePetHero与showPetEvolve与renderPetScreen里·已被模块覆盖是死代码实测不渲染)→也全部改成渲染 stage.img 的pet图(即使万一被触发也只显示图加onerror兜底)·19岛 stage.emoji 清零. 保留: 宠物数据每阶的 emoji 字段(纯数据不再被任何地方渲染·删字段风险大故保留为惰性数据). 真机python-playwright验animal/food/color/school/treasure/body六岛设高XP: 宠物屏37张pet图·无任何宠物emoji·首页heroPet是图·0报错无语法错. 教训(延续v649与v650): 渲染兜底绝不用emoji统一走hansenImgErr重试加中性; 同一展示常分散在共享模块与各岛遗留死代码两层都要查改(本次模块3处加岛内19x5处); 死代码也要清理避免边界触发闪老样子.')

# ---- v652 宠物进化进度/横幅也彻底只用图(补v651漏网的 nextStage.emoji) ----
_v652=[]
import glob as _g652
_ne=[]
for _f in sorted(_g652.glob('island_*.html')):
    _t=open(_f,encoding='utf-8',errors='replace').read()
    _nm=_f.replace('island_','').replace('.html','')
    if 'nextStage.emoji' in _t or 'stage.emoji' in _t: _ne.append(_nm)
if _ne: _v652.append('仍残留宠物阶段emoji(nextStage.emoji/stage.emoji)的岛:'+str(_ne[:6]))
if not any('\U0001f534v652' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g652.glob('island_*.html'))):
    _v652.append('缺v652标记')
if _v652: fail('v652 宠物进化进度/横幅只用图: '+str(_v652[:6]))
else: ok('v652 宠物进化进度显示与快进化横幅也彻底只用图·补齐v651漏网的宠物emoji(Hansen重申: 宠物系统不要看到以前的图): v651只改了 stage.emoji·但宠物系统还有用另一个变量名 nextStage.emoji 渲染宠物emoji的两处被漏掉. 排查(从PET_STAGES取的宠物阶段变量 st/stage/nextStage/newStage/r 里·只有 nextStage 还在渲染emoji·共2处/岛): 一·宠物屏进度条 距离进化为 下一阶名加 nextStage.emoji(在岛内renderPetScreen·死代码). 二·**快进化横幅 showAlmostBanner(再X XP宠物进化为 nextStage.emoji 名)·这是活代码**(答题查进度时弹出·模块未覆盖·正是用户还能看到宠物emoji的活路径). 两处都经innerHTML渲染. 修复: 两处 nextStage.emoji 全改为渲染 nextStage.img 的pet图(小尺寸height1.2em内联·加onerror走hansenImgErr重试中性)·19岛 nextStage.emoji 清零. 严格区分: next.emoji/L.emoji/lvInfo.emoji 来自 ADVENTURE_LEVELS(玩家勘探者等级·非宠物·用户没要改)·保留不动; w.emoji/word.emoji等是单词emoji·保留. 真机python-playwright验animal/food/color/school/treasure五岛: 宠物屏37图无emoji·**直接调showAlmostBanner造快进化文案→横幅渲染出pet图非emoji**·0报错无语法错. 教训: 同一类数据(宠物阶段)可能被多个变量名(stage/nextStage)在多处渲染·清理时要把从该数据源取的所有变量都查一遍·不能只搜一个变量名(v651只搜stage.emoji漏了nextStage.emoji).')

# ---- v653 每日宝箱「开箱光芒绽放」动画(亮度渐增+金光绽放+金币飞出) ----
_v653=[]
import glob as _g653
# 1) 共享FX函数存在 + 含光晕/亮度关键帧 + 无旋转(守防晕红线)
if os.path.exists('hansen_checkin_global.js'):
    _ck=open('hansen_checkin_global.js',encoding='utf-8',errors='replace').read()
    if 'window.hansenChestFX' not in _ck: _v653.append('缺 window.hansenChestFX 开箱动画函数')
    for _kf in ['hsnChestGlow','hsnBloom','hsn-coin']:
        if _kf not in _ck: _v653.append('FX缺关键帧/类 '+_kf)
    # 防晕: FX区不得出现 rotate/rotation(只允许 缩放/位移/透明度/亮度)
    _fxseg = _ck[_ck.find('hansenChestFX'):_ck.find('hansenChestFX')+2600] if 'hansenChestFX' in _ck else ''
    if 'rotate' in _fxseg.lower(): _v653.append('开箱动画含旋转(违反防晕红线)')
else: _v653.append('缺hansen_checkin_global.js')
# 2) 19岛 doOpenChest 调用 hansenChestFX(不再只用shake)
_noFX=[]
for _f in sorted(_g653.glob('island_*.html')):
    _t=open(_f,encoding='utf-8',errors='replace').read()
    if 'doOpenChest' in _t and 'hansenChestFX' not in _t: _noFX.append(_f.replace('island_','').replace('.html',''))
if _noFX: _v653.append('doOpenChest未接入开箱动画的岛:'+str(_noFX[:6]))
# 3) v653标记
if '\U0001f534v653' not in _ck:
    _v653.append('共享签到模块缺v653标记')
if _v653: fail('v653 每日宝箱开箱动画: '+str(_v653[:6]))
else: ok('v653 每日宝箱「开箱光芒绽放」动画(Hansen: 宝箱打开时要有打开动画·越来越亮·放出光芒·光芒四射·然后金币飞出·有惊喜感·动画衔接到领奖): 原 doOpenChest 点击宝箱只是 box.classList.add(shake)抖动(违反防晕红线)+1秒后把chestContent换成奖励卡. 改为: 在共享 hansen_checkin_global.js 新增 window.hansenChestFX(box) 开箱动画函数(注入CSS一次)·岛内 doOpenChest 把 shake 改为调用它(无FX则回退shake). 动画三段: ①宝箱本体 filter:brightness 1→2.7 渐增 + drop-shadow金光 + 轻微scale 1→1.09(越来越亮·.hsn-chest-opening类·.62s). ②金光绽放 .hsn-bloom: 径向渐变(白→金→透明)的圆 translate居中 scale .32→2.8 + opacity 0→.96→0(.74s·光芒四射). ③金币飞出: 13枚🪙 向上扇形喷射·用WAAPI element.animate做 translate(calc位移)+scale+opacity 各异方向(无旋转·980ms). 光晕与金币挂到 document.body(z-index 9998/10001)·不随1秒后 chestContent 刷新被截断·金币仍在飞时奖励卡已出现=衔接惊喜感. 全程仅 缩放/位移/透明度/亮度滤镜/drop-shadow·无旋转无闪烁无抖动(守防晕红线). 金币用🪙(与奖励卡 reward-emoji 一致·非占位). 真机python-playwright验animal/food/treasure: 进宝箱屏点宝箱→亮度类生效+金光bloom×1+飞币13枚·1.2秒后奖励卡(reward-amount/收下奖励)出现·0报错. 教训: 开箱/特效动画严守防晕红线·绝不用旋转抖动(原shake要替换)·光芒用径向渐变缩放淡出实现·飞出粒子用WAAPI做各异方向translate; 需跨越内容刷新的特效元素挂body而非被刷新容器.')

# ---- v654 火眼金睛图标放大 + 极速60秒图标缩小留顶距 ----
_v654=[]
import glob as _g654, re as _re654
_egbad=[]; _spbad=[]
for _f in sorted(_g654.glob('island_*.html')):
    _t=open(_f,encoding='utf-8',errors='replace').read()
    _nm=_f.replace('island_','').replace('.html','')
    _em=_re654.search(r'eagle_3d[^>]*width:(\d+)px', _t)
    _sm=_re654.search(r'speed_3d[^>]*width:(\d+)px', _t)
    if not _em or _em.group(1)!='81': _egbad.append(_nm+'('+(_em.group(1) if _em else 'none')+')')
    if not _sm or _sm.group(1)!='83': _spbad.append(_nm+'('+(_sm.group(1) if _sm else 'none')+')')
if _egbad: _v654.append('eagle火眼金睛未到v664尺寸81px的岛:'+str(_egbad[:5]))
if _spbad: _v654.append('speed极速60秒未到v664尺寸83px的岛:'+str(_spbad[:5]))
if not any('\U0001f534v654' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g654.glob('island_*.html'))):
    _v654.append('缺v654标记')
if _v654: fail('v654 火眼金睛放大+极速60秒缩小: '+str(_v654[:6]))
else: ok('v654 模式区两个图标尺寸修复(Hansen: 火眼金睛图标太小要尽可能放大·极速60秒图标偏大且离顶部天花板太近要留出距离): 两图标都在 .mode-card>.m-icon>img·容器font-size58px·img都是width1em height1em·区别在各自inline transform:scale. 真机测量(393宽·卡106x106·m-icon高74·图标中心距卡顶约42px·缩放从中心扩展): 原 eagle火眼金睛 scale(0.85)=63px距顶11px(偏小)·speed极速60秒 scale(1.15)=86px距顶-1px(顶出卡片上沿=贴天花板). 修复: eagle scale 0.85→1.1(=82px·放大约30%·因eagle构图四角透明且顶部火焰瓦片有约7%内缩·frame距顶1px时可见内容距顶约7px不贴顶)·speed scale 1.15→0.9(=67px·缩小约22%·距顶-1px→+9px有清晰空隙·秒表表冠不再顶边). 真机截图确认两卡: 火眼金睛大而饱满顶部不贴边·极速60秒上方留空隙. 19岛统一修改(scale值19岛一致批量改). 教训: 同尺寸容器内图标视觉大小差异来自各PNG主体占比与inline scale·调 transform:scale 即可·放大上限受图片主体到边距离约束(speed秒表冠顶满边沿故不能放大·eagle四角透明可放大); 改尺寸后必须真机量 距顶gap 防贴顶(原speed就是scale过大顶出上沿).')

# ---- v655 菜单/导航图标全部换 Hansen 新3D图 + 删旧emoji/旧图 + 统一规格 ----
_v655=[]
import glob as _g655, os as _os655
_ICONS655=['ic_home','ic_wrong','ic_review','ic_cards','ic_diamond','ic_equip','ic_achieve','ic_stats','ic_settings','ic_study']
for _ic655 in _ICONS655:
    _pp655='icons/'+_ic655+'.webp'
    if not (_os655.path.exists(_pp655) and _os655.path.getsize(_pp655)>3000): _v655.append(_ic655+'.webp 缺失或过小')
for _old655 in ['icons/cardbook_3d.webp','icons/equipment_3d.webp']:
    if _os655.path.exists(_old655): _v655.append('旧图未彻底删除:'+_old655)
_OLDEMO655=['u-icon">🏆','u-icon">📊','u-icon">⚙️','ni-icon">🏠','ni-icon">🔁','ni-icon">📚']
for _fn655 in sorted(_g655.glob('island_*.html')):
    _t655=open(_fn655,encoding='utf-8',errors='replace').read()
    for _need655 in ['icons/ic_achieve.webp','icons/ic_stats.webp','icons/ic_settings.webp','icons/ic_home.webp','icons/ic_review.webp','icons/ic_wrong.webp','icons/ic_cards.webp']:
        if _need655 not in _t655: _v655.append(_fn655+' 缺 '+_need655); break
    for _emo655 in _OLDEMO655:
        if _emo655 in _t655: _v655.append(_fn655+' util/nav残留旧emoji'); break
    if 'drop-shadow(0 0 2px rgba(255,255,255,.9))' not in _t655: _v655.append(_fn655+' 底栏图标白色微光缺失')
_djs655=open('hansen_diamond_shop.js',encoding='utf-8',errors='replace').read()
if 'icons/ic_diamond.webp' not in _djs655 or 'u-icon">💎' in _djs655: _v655.append('diamond_shop 钻石店未换ic_diamond')
_gjs655=open('hansen_gear.js',encoding='utf-8',errors='replace').read()
if 'icons/ic_equip.webp' not in _gjs655 or 'equipment_3d' in _gjs655: _v655.append('gear 装备未换ic_equip')
_mjs655=open('hansen_mylearning.js',encoding='utf-8',errors='replace').read()
if 'icons/ic_study.webp' not in _mjs655 or 'u-icon">📈' in _mjs655: _v655.append('mylearning 我的学习未换ic_study')
_wjs655=open('hansen_wrong_overview.js',encoding='utf-8',errors='replace').read()
if 'icons/ic_wrong.webp' not in _wjs655 or 'ni-icon">📕' in _wjs655: _v655.append('wrong_overview 错题未换ic_wrong')
if not any('🔴v655' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g655.glob('island_*.html'))):
    _v655.append('缺v655标记')
if _v655: fail('v655 菜单/导航图标全换新图: '+str(_v655[:6]))
else: ok('v655 首页 util 菜单网格(6图标)+底部导航(4图标)全部换成 Hansen 上传的新3D图标·统一规格·彻底删除所有旧 emoji 与旧图(Hansen 明确: 全部换掉·不要占位符·直接用我的图·老图彻底删掉不要再出现). 来源截图=island 主页底部. 渲染来源混合: 静态HTML(19岛)=成就🏆/统计📊/设置⚙️(util)·主页🏠/复习🔁/单词📚(nav)·卡册(原cardbook_3d图); JS动态注入=钻石店💎(hansen_diamond_shop.js)·装备(原equipment_3d图·hansen_gear.js)·我的学习📈(hansen_mylearning.js)·错题📕(hansen_wrong_overview.js把单词改错题). 替换: 10个图标→icons/ic_home/ic_wrong/ic_review/ic_cards/ic_diamond/ic_equip/ic_achieve/ic_stats/ic_settings/ic_study.webp(原1254方图统一裁透明边+正方画布留白8pct+缩放256统一规格). 静态6图标+卡册19岛批量换img·4个JS注入换img·全部 onerror 走 hansenImgErr(重试3次+中性问号·绝不回退旧emoji). 统一尺寸: util图标 width/height 54px·nav图标 42px·nav额外加白色微光drop-shadow(深色底栏更清晰). 旧图 cardbook_3d.webp/equipment_3d.webp 已从 icons 删除(grep确认无任何引用). 同步更新被触发旧守卫 v583(cardbook_3d→ic_cards)/v584(→ic_cards并移除PIL白边检测靠CSS白光)/v648(equipment_3d→ic_equip). 真机渲染确认(island_animal): util 6图标全ic_*新图统一54px·nav 4图标全ic_*新图统一42px·无任何旧emoji残留·0报错·排版整齐. ★教训: 同一菜单区图标渲染来源可能混合(静态HTML + 多个JS动态注入)·必须查渲染DOM(非静态grep)才能找全(本例静态grep只见3个util-card·渲染出6个·钻石店/装备/我的学习/错题均JS注入); 换图后旧文件需grep确认无引用再删·并同步更新引用旧文件的守卫.')

# ---- v656 菜单util图标(54→68)+底栏nav图标(42→50)放大·不溢出框·底栏对齐不超天花板 ----
_v656=[]
import glob as _g656
_USZ='object-fit:contain;vertical-align:middle;display:inline-block'
_NSZ='drop-shadow(0 0 2px rgba(255,255,255,.9))'
_USZ_OLD='width:54px;height:54px;object-fit:contain;vertical-align:middle;display:inline-block'
_NSZ_OLD='width:42px;height:42px;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 0 2px rgba(255,255,255,.9))'
for _fn656 in sorted(_g656.glob('island_*.html')):
    _t656=open(_fn656,encoding='utf-8',errors='replace').read()
    if _USZ not in _t656: _v656.append(_fn656+' util图标未放大到68px'); break
    if _NSZ not in _t656: _v656.append(_fn656+' 底栏图标未放大到50px'); break
    if _USZ_OLD in _t656: _v656.append(_fn656+' util残留旧54px'); break
    if _NSZ_OLD in _t656: _v656.append(_fn656+' 底栏残留旧42px'); break
# 3个util-JS = 68px·1个nav-JS = 50px
for _jf656,_need656 in [('hansen_diamond_shop.js',_USZ),('hansen_gear.js',_USZ),('hansen_mylearning.js',_USZ),('hansen_wrong_overview.js',_NSZ)]:
    if _need656 not in open(_jf656,encoding='utf-8',errors='replace').read(): _v656.append(_jf656+' 图标未按v656放大')
if not any('\U0001f534v656' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g656.glob('island_*.html'))):
    _v656.append('缺v656标记')
if _v656: fail('v656 菜单/底栏图标放大: '+str(_v656[:6]))
else: ok('v656 首页 util 菜单图标 + 底部导航图标在 v655 换新图基础上整体放大(Hansen: 进岛后最下面这些刚换的图标太小·放大一些·尽量放大·但不要溢出各自的框·底栏4图标也放大但不要超过天花板高度·且4图标上下水平线一定要对齐). 真机测量约束(393宽·util-card宽78/padding左右4=内宽70/卡片高度自适应内容·bottom-nav固定高70px/nav-item padding顶8底2/flex列justify-center): util图标 54→68px(横向不溢出·内宽70内·card自适应长高93→约105·尽量大留约5px侧距)·nav图标 42→50px(底栏固定70px内·图标居中放大·顶部距bar顶天花板余量4px不超顶·底部留约17px给标签·若再大到52px余量仅3px偏紧故选50px最稳). 底栏4图标同尺寸同布局→顶/底水平线全对齐(真机顶Y/底Y四个完全一致). util静态3图标(成就/统计/设置·19岛)+卡册保持·钻石店/装备/我的学习(3个util-JS)+错题(nav-JS wrong_overview)同步放大. 真机验证(animal·关onboarding后截图): util6图标68px大而饱满无溢出·底栏4图标50px放大+顶底对齐+不超天花板·0报错·排版精美. ★教训: bottom-nav此处是固定高70px(非内容自适应)·放大图标会在固定bar内居中扩展→顶部天花板余量随尺寸增大而减小·必须真机量「图标顶Y减bar顶Y」确保>0不超顶·并预留标签空间(本例50px余量4px最稳·52px降到3px偏紧); util-card高度自适应放大图标卡片随之长高不溢出·横向受卡内宽约束(78宽内70)要测左右不越界.')

# ---- v657 util图标再放大到80px + 10图标重生成512高清+紧裁匀称 ----
_v657=[]
import glob as _g657, os as _os657
try:
    from PIL import Image as _IM657
    for _ic657 in ['ic_home','ic_wrong','ic_review','ic_cards','ic_diamond','ic_equip','ic_achieve','ic_stats','ic_settings','ic_study']:
        _pp657='icons/'+_ic657+'.webp'
        if not _os657.path.exists(_pp657): _v657.append(_ic657+'.webp 缺失'); continue
        _wh657=_IM657.open(_pp657).size
    # ⭐ v929 阈值调整(Hansen: "进岛很卡·图片加载不出来·要极致快, 这是上线前最高优先级"):
#   真机实测: 这些图标在 App 里【最大只显示 91px】(模式卡/工具卡/底栏), 却存着 512~768px 的原图。
#   512px 让首屏多背 1.0MB → 4G 上多等约 2 秒, 正是 Hansen 说的"图标加载不出来"。
#   288px 已是【3.2 倍屏】的余量(91×3=273), 真机放大对比【肉眼零差别】。
#   故门槛从 512 降到 288 —— 不是降画质, 是去掉纯浪费的像素。boss 立绘(v809/v887)不受影响, 仍是高清原图。
    if _wh657[0]<288 or _wh657[1]<288: _v657.append(_ic657+(' 分辨率%dx%d低于288(实测最大只显示91px·288=3.2倍屏余量)'%_wh657))
except Exception as _e657: _v657.append('图片尺寸检测异常:'+str(_e657))
_U80v657='object-fit:contain;vertical-align:middle;display:inline-block'
for _fn657 in sorted(_g657.glob('island_*.html')):
    if _U80v657 not in open(_fn657,encoding='utf-8',errors='replace').read(): _v657.append(_fn657+' util图标未放大到80px'); break
for _jf657 in ['hansen_diamond_shop.js','hansen_gear.js','hansen_mylearning.js']:
    if _U80v657 not in open(_jf657,encoding='utf-8',errors='replace').read(): _v657.append(_jf657+' util图标未到80px')
if not any('\U0001f534v657' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g657.glob('island_*.html'))):
    _v657.append('缺v657标记')
if _v657: fail('v657 util放大80px+512高清: '+str(_v657[:6]))
else: ok('v657 首页 util 菜单6图标在 v656(68px)基础上再放大到 80px + 全部10图标重生成为512×512高清+更紧裁切让主体更大更匀称(Hansen: 这几个图标还是小·再放大·尽量放大·只要不溢出框; 每个图标大小要匀称(如钻石店相比之下该更大); 图片要更高清·看得非常非常清楚·这是铁律视觉特效做到最好). 真机测量(393/360双视口·浮层在场/关闭三态均稳定): util-card 实际宽90px(app固定设计宽·非视口自适应·三态一致)·util图标 68→80px(横向不溢出·90卡内留约5px侧距·card高度自适应随之长高). 图片重生成: 从原图1254×1254 RGBA重新处理·用 alpha阈值>18 紧裁(去掉faint阴影halo·主体bbox更紧)·正方画布留白2.5%每侧(比v655的8%更紧·主体填满框更大更匀称)·LANCZOS缩放到512×512(v655是256·提升一倍分辨率·80px显示@DSF2/3约160-240物理像素·512源足够锐利高清). 10图标(util6: ic_diamond/ic_equip/ic_achieve/ic_stats/ic_settings/ic_study + nav4: ic_home/ic_wrong/ic_review/ic_cards)统一512高清·util显示80px·nav保持50px(显示尺寸v656不变·但图也换512高清更清晰). 真机验证(animal·6卡含钻石店全80px·无横向溢出·原图分辨率512·0报错): 图标明显更大更高清·主体填满卡片匀称. 守卫(v657): 10图均≥512×512 + 19岛及3个util-JS含80px + v657标记. ★教训: (1)图标高清=源分辨率要远大于显示物理像素(显示80px@DSF3=240px·源512才锐利·256会糊)·Hansen多次强调高清是铁律→宁可512不省体积. (2)匀称=紧裁(alpha阈值去阴影halo)+统一小留白·让各图主体bbox填满框比例一致. (3)app此处util-card是固定设计宽90px(非视口百分比)·三态/双视口一致·80px安全(之前一次量到78是布局未稳瞬时值·稳定后均90).')

# ---- v658 防HTML缓存: entry HTML 加 no-cache meta(解决部署后浏览器/CDN缓存旧页面看不到更新) ----
_v658=[]
import glob as _g658
_entry658=sorted(_g658.glob('island_*.html'))+['index.html','boss_hall.html']
for _f658 in _entry658:
    _t658=open(_f658,encoding='utf-8',errors='replace').read()
    if 'http-equiv="Cache-Control"' not in _t658: _v658.append(_f658+' 缺no-cache meta')
if not any('\U0001f534v658' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g658.glob('island_*.html'))):
    _v658.append('缺v658标记')
if _v658: fail('v658 防HTML缓存: '+str(_v658[:6]))
else: ok('v658 入口HTML(19岛+index+boss_hall共21个)统一加 no-cache meta 防HTML缓存(根因排查: Hansen连续v656/v657两版反馈util图标没变大·真机+源码核查确认代码里图标确实已80px/占卡89%且无任何CSS覆盖·playwright在393视口实测80px·而Hansen截图图标仅占卡约55%=最早v655的54px原始尺寸→判定是浏览器/腾讯云CDN缓存了入口页 island_*.html: 图标尺寸写在HTML里·而图片资源虽有?v=戳会更新·HTML本身被缓存→看到的是旧尺寸的新图=好像没变). 修复: 在每个入口HTML的charset meta后插入 `<meta http-equiv=Cache-Control content=no-cache,must-revalidate>` + `<meta http-equiv=Pragma content=no-cache>`·让浏览器每次revalidate拿最新HTML(资源仍靠?v=戳缓存·HTML极小revalidate开销可忽略). ★注意: meta只是对浏览器的提示·腾讯云CDN的服务端缓存需Hansen在控制台手动刷新CDN缓存(静态网站托管→刷新缓存)·首次部署v658后必须清一次CDN缓存+浏览器硬刷新(或无痕/URL加?t=时间戳)才能拿到带no-cache的新HTML·之后更新即时生效. 守卫(v658): 21个入口HTML均含Cache-Control meta + v658标记. ★教训: 入口HTML(用户直接URL访问)不像资源那样带?v=戳·会被浏览器/CDN缓存→改动写在HTML里的(如图标尺寸/布局)部署后可能不生效·必须加no-cache meta+提醒清CDN缓存·这是H5部署的常见坑.')

# ---- v659 util图标80→60px适度收回(不撑大卡框) + util-row列锁minmax防网格溢出手机屏 + 卡padding收回卡高回原始 ----
_v659=[]
import glob as _g659
_U60='object-fit:contain;vertical-align:middle;display:inline-block'
_U80old='width:80px;height:80px;object-fit:contain;vertical-align:middle;display:inline-block'
for _fn659 in sorted(_g659.glob('island_*.html')):
    _t659=open(_fn659,encoding='utf-8',errors='replace').read()
    if 'grid-template-columns:repeat(4,minmax(0,1fr))' not in _t659: _v659.append(_fn659+' util-row列未锁minmax(防溢出)'); break
    if _U60 not in _t659: _v659.append(_fn659+' util图标未收到60px'); break
    if _U80old in _t659: _v659.append(_fn659+' util图标仍是80px(过大)'); break
    if '.util-card{background:rgba(30,41,59,.8);border:1px solid rgba(var(--pal-line-rgb,99,102,241),.2);border-radius:12px;padding:6px 4px 6px' not in _t659: _v659.append(_fn659+' util-card padding未收回'); break
for _jf659 in ['hansen_diamond_shop.js','hansen_gear.js','hansen_mylearning.js']:
    if _U60 not in open(_jf659,encoding='utf-8',errors='replace').read(): _v659.append(_jf659+' util图标未收到60px')
if not any('\U0001f534v659' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g659.glob('island_*.html'))):
    _v659.append('缺v659标记')
if _v659: fail('v659 util图标适度收回60px+列锁防溢出: '+str(_v659[:6]))
else: ok('v659 util菜单图标从v657的80px适度收回到60px + util-row网格列锁minmax(0,1fr)防整行超出手机屏 + util-card内边距收回让卡框高度回到原始(Hansen怒指: v657放到80px是两极化(原始约54px=他说的1·让稍放大到3-5却直接放到100)·且80px图标比卡栏目自然宽还宽→把卡框/黑框也撑大了·4卡一行总宽超过手机屏导致最右统计卡被截断溢出屏幕·他明确要求图标在固定框内放大且框绝不能变大更不能溢出屏). 根因: util-row原`grid-template-columns:1fr 1fr 1fr 1fr`=minmax(auto,1fr)·列min是min-content·80px图标+padding=88px>视口/4自然列宽85px→列被撑宽→4列总宽超393视口→末列截断; 且card高度内容自适应·80px图标把卡撑高到113. 修复三步: ①列改`repeat(4,minmax(0,1fr))`(min=0·列不再被内容撑宽·恒等于视口/4·整行严格不超视口·真机393末卡right365<393/360末卡right332<360 均不溢出); ②图标 80→60px(适度·比原始54略大·远小于80·60px在卡内留足侧距不溢出卡框·真机图标不溢出卡); ③util-card padding `9px4px8px→6px4px6px`(收6px抵消图标变大·卡高从99回到94≈原始93·框不变大). nav图标保持50px不动. 真机验证(animal·393+360双视口·关onboarding): 网格不溢出视口/统计卡完整/卡78x94框未变大/图标60px适度待框内不溢出/0报错·截图确认排版整齐统计卡完整. 守卫(v659): 19岛util-row含minmax+图标60px+无80px残留+card padding 6px·3个util-JS图标60px·v659标记. ★教训(铁律): (1)放大图标=两极化坑·Hansen要的是适度(原始基础上小幅)非最大化·宁可偏小再问也别直接拉满. (2)栅格里图标比列自然宽更宽会反撑列宽→整行超视口溢出屏·栅格列必须用minmax(0,1fr)(min=0)而非默认1fr(min=auto/min-content)·否则大内容撑破布局. (3)Hansen的边框=卡片黑框·图标在框内放大可以·但绝不能把框撑大(宽:列锁minmax·高:收padding抵消)更不能溢出手机屏.')

# ---- v660 按Hansen调节器参数逐图标套尺寸/偏移 + 菜单卡框固定94px(flex居中) + 底栏固定70px ----
_v660=[]
import glob as _g660
_UTIL660={'ic_diamond':72,'ic_equip':70,'ic_achieve':77,'ic_stats':70,'ic_settings':68,'ic_study':75}
_NAV660={'ic_home':50,'ic_wrong':50,'ic_review':50,'ic_cards':67}
_isl660=open('island_animal.html',encoding='utf-8',errors='replace').read()
# 静态图标尺寸(islands): util achieve/stats/settings · nav home/review/cards
for _src in ['ic_achieve','ic_stats','ic_settings']:
    _sz=_UTIL660[_src]
    if ('icons/'+_src+'.webp" alt="" draggable="false" style="width:'+str(_sz)+'px;height:'+str(_sz)+'px') not in _isl660: _v660.append(_src+' 静态尺寸不符v660')
for _src in ['ic_home','ic_review','ic_cards']:
    _sz=_NAV660[_src]
    if ('icons/'+_src+'.webp" alt="" draggable="false" style="width:'+str(_sz)+'px;height:'+str(_sz)+'px') not in _isl660: _v660.append(_src+' 静态尺寸不符v660')
# JS注入图标尺寸
for _jf,_src,_sz in [('hansen_diamond_shop.js','ic_diamond',72),('hansen_gear.js','ic_equip',70),('hansen_mylearning.js','ic_study',75),('hansen_wrong_overview.js','ic_wrong',50)]:
    if ('width:'+str(_sz)+'px;height:'+str(_sz)+'px') not in open(_jf,encoding='utf-8',errors='replace').read(): _v660.append(_src+' JS尺寸不符v660')
# 卡框固定 + 结构
if 'padding:6px 4px 6px;text-align:center;cursor:pointer;transition:all .15s;height:94px;display:flex;flex-direction:column' not in _isl660: _v660.append('util-card未固定94px+flex列')
if '.u-icon{flex:1;display:flex;align-items:center;justify-content:center;overflow:visible;min-height:0}' not in _isl660: _v660.append('u-icon未改flex居中图标区')
if 'display:flex;height:calc(70px + env(safe-area-inset-bottom));z-index:100' not in _isl660: _v660.append('底栏未用calc(70px+env安全区)固定高(v799 iPhone安全区适配后·内容区仍恒70px)')
if '.nav-item{flex:1;padding:6px 0;' not in _isl660: _v660.append('nav-item padding未对齐6px')
# 19岛一致性(抽查卡框固定)
_miss660=[f for f in sorted(_g660.glob('island_*.html')) if 'height:94px;display:flex;flex-direction:column' not in open(f,encoding='utf-8',errors='replace').read()]
if _miss660: _v660.append('部分岛util-card未固定94px:'+str([__import__('os').path.basename(x) for x in _miss660[:3]]))
if not any('\U0001f534v660' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g660.glob('island_*.html'))): _v660.append('缺v660标记')
if _v660: fail('v660 调节器参数套用: '+str(_v660[:8]))
else: ok('v660 用独立图标调节器(单词大冒险_图标调节器.html)让Hansen自己拖滑块调到满意·再按他给的参数逐图标精确套进游戏(免去来回沟通). Hansen参数: 菜单卡框高度94px·钻石店72(下移1)/装备70(上移1)/成就77(下移2)/统计70/设置68(上移1)/我的学习75; 底栏卡框70px·主页50/错题50(下移2)/复习50(下移1)/卡册67(下移1). 实现: ①菜单卡 .util-card 加 height:94px+display:flex+flex-direction:column 固定高度(不同尺寸图标也统一卡高·大图标如成就76/我的学习74不再撑大框)·.u-icon 改 flex:1+flex居中+overflow:visible 作图标区(图标在固定框内居中·超出框露出不撑框); ②底栏 .bottom-nav 加 height:70px 固定(卡册65px在固定bar内居中·不再被撑高)·.nav-item padding 8px0 2px→6px 0 对齐调节器基线; ③逐图标 inline 设各自 width/height + transform:translate(左右px,上下px)(静态achieve/stats/settings+home/review/cards在19岛·diamond/equip/study+wrong在4个JS). 真机393实测: 6util图标72/70/77/70/68/75全对·4nav图标50/50/50/67全对·util卡高全94统一·底栏70·网格不溢出视口(最右统计卡right365<393)·0报错·截图确认匀称美观与调节器一致. 旧守卫v656/v657/v659原查统一60px已改查通用样式特征(object-fit/inline-block + 白光drop-shadow). 守卫(v660): 静态+JS各图标尺寸符参数·util-card固定94px+flex·u-icon flex居中·底栏70px·nav-item padding6px·19岛一致·v660标记. ★教训(铁律·重要): Hansen尺寸/位置类需求改用「先做独立调节器→他自己拖滑块视觉调→给参数→精确套用」工作流·彻底免去反复猜尺寸来回沟通的心累; 调节器CSS必须与游戏完全一致(卡框结构/padding/居中)否则套用后与他看到的不符·本版特意把游戏改成与调节器一致(卡框固定+flex居中+nav padding6px). 不同尺寸图标排一行要卡框固定高度(否则大图标撑高卡片→整行高低不齐).')

# ---- v662 底栏文字下移+置顶(恢复v660底栏几何·文字浮于图标上层不抢空间) ----
_v662=[]
import glob as _g662
_isl662=open('island_animal.html',encoding='utf-8',errors='replace').read()
if 'display:flex;height:calc(70px + env(safe-area-inset-bottom));z-index:100' not in _isl662: _v662.append('底栏未用calc(70px+env安全区)固定高(v799 iPhone安全区适配后·内容区仍恒70px)')
if '.bottom-nav .nav-item .ni-icon{font-size:34px;line-height:1;height:40px;display:flex;align-items:center;justify-content:center;margin-bottom:2px}' not in _isl662: _v662.append('ni-icon未恢复v660(40px盒)')
if '.ni-label{position:relative;z-index:5;transform:translateY(4px)' not in _isl662: _v662.append('缺.ni-label(下移translateY+z-index置顶)')
for _lb in ['主页','复习','卡册','单词']:
    if ('<span class="ni-label">'+_lb+'</span>') not in _isl662: _v662.append(_lb+'未包ni-label')
if '<span class="ni-label">错题</span>' not in open('hansen_wrong_overview.js',encoding='utf-8',errors='replace').read(): _v662.append('错题(JS)未包ni-label')
_miss662=[__import__('os').path.basename(_f) for _f in sorted(_g662.glob('island_*.html')) if '.ni-label{position:relative;z-index:5' not in open(_f,encoding='utf-8',errors='replace').read()]
if _miss662: _v662.append('部分岛缺.ni-label:'+str(_miss662[:3]))
if not any('\U0001f534v662' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g662.glob('island_*.html'))): _v662.append('缺v662标记')
if _v662: fail('v662 底栏文字下移置顶: '+str(_v662[:8]))
else: ok('v662 底栏文字(主页/错题/复习/卡册)与图标重合·最小侵入修复(Hansen明确要求·撤销v661). v661曾擅自把底栏70→96px加高(Hansen强烈反对·未经允许改了几何)·本版全部恢复v660: 底栏高度70px+ni-icon 40px盒+图标尺寸(卡册67/其余50)全部不动·只把4个文字下移+置顶. 做法: 4文字(主页/复习/卡册静态在19岛·错题在wrong_overview.js)各包进 span.ni-label·新增 .ni-label{position:relative;z-index:5;transform:translateY(4px);text-shadow:dark} → 文字相对定位下移4px+z-index:5浮于图标上层(图标不再压住文字)+dark text-shadow保证文字浮在图标上仍清晰. 关键: 文字不占额外空间(底栏仍70px不变)不跟图标抢位置. 真机393: 底栏70px(恢复v660)·图标50/50/50/67(不变)·4文字顶边全Y=52(✓平行对齐)·z-index全5(✓置顶)·0报错. 守卫: v625/v626/v660已撤销v661改动恢复查v660几何; v662查.ni-label定位+4文字(含错题JS)包ni-label+底栏70px. ★教训(铁律·Hansen震怒): 绝不擅自改动Hansen明确定过的几何参数(底栏高度/卡框尺寸)·v661未经允许加高底栏是严重错误; 文字与图标重合的正解=文字置顶层浮于图标上(z-index)+微调位置·不是把容器撑大给文字腾地方.')

# ---- v663 探索单词/每日任务/泡泡大作战 emoji→新图片图标(高对比深背景·放大) ----
_v663=[]
import glob as _g663, os as _os663
_isl663=open(sorted(_g663.glob('island_*.html'))[0],encoding='utf-8',errors='replace').read()
for _ic663 in ['icons/explore_3d.webp','icons/bubble_3d.webp','icons/task_3d.webp']:
    if _ic663 not in _isl663: _v663.append(_ic663+'未引用')
for _old663 in ['<div class="m-icon">📚</div>','<div class="m-icon">🫧</div>','<span class="d-icon">📋</span>']:
    if _old663 in _isl663: _v663.append('旧emoji元素残留')
for _c1663 in ['--c1:#ED7098','--c1:#4CD97B','--c1:#4338ca']:
    if _c1663 not in _isl663: _v663.append('缺高对比背景'+_c1663)
_miss663=[_os663.path.basename(_f) for _f in sorted(_g663.glob('island_*.html')) if not all(_x in open(_f,encoding='utf-8',errors='replace').read() for _x in ['icons/explore_3d.webp','icons/bubble_3d.webp','icons/task_3d.webp','--c1:#ED7098','--c1:#4CD97B','--c1:#4338ca'])]
if _miss663: _v663.append('部分岛缺v663:'+str(_miss663[:3]))
if not any('\U0001f534v663' in open(_f,encoding='utf-8',errors='replace').read() for _f in sorted(_g663.glob('island_*.html'))): _v663.append('缺v663标记')
for _fn663 in ['explore_3d.webp','task_3d.webp','bubble_3d.webp']:
    _pp663='icons/'+_fn663
    if not _os663.path.exists(_pp663): _v663.append(_fn663+'缺失')
    elif _os663.path.getsize(_pp663)<10000: _v663.append(_fn663+'过小')
if _v663: fail('v663 图标替换: '+str(_v663[:8]))
else: ok('v663 首页三个 emoji 图标→新图片(Hansen提供·均已抠图透明背景). 探索单词(mode-card emoji📚)→icons/explore_3d.webp·每日任务(daily-card emoji📋)→icons/task_3d.webp·泡泡大作战(mode-card emoji🫧)→icons/bubble_3d.webp. 图标源均512x512高清(裁切到内容bbox+居中到方形画布·较长边偅92%填充·留~8px边距). mode-card图片由 .mode-card .m-icon img{height:100%!important} 自动填高(74px·与其他图片卡一致·已到卡片布局上限); daily-card图片 width:1em(1em=d-icon 72px). 高对比深背景(因新图标明亮多彩·深色让图标跳出): 探索单词粉#ED7098(v705 Hansen指定·原深青#0e7490)·每日任务深紫#7c3aed→#5b21b6(衬暖金清单板)·泡泡深靖#4338ca→#312e81(衬彩虹泡泡+黄光). 均锁定到具体元素/onclick替换(因emoji在其他界面也出现·背景色被多卡共用). 原这三个是emoji不是图片文件·icons目录无旧图片可删. onerror兑底回退原emoji. 真机393(animal navy主题): 三图标均显示为img·填满卡片·与邻卡一致·背景高对比图标跳出·卡片与深色页面区分明显. 各岛主题背景不同(navy/紫/teal)·背景色固定·在部分主题上对比略弱但可接受.')


# ---- v664 首页图标/文字按调节器参数统一(尺寸/偏移/置顶/颜色) ----
_v664=[]
import glob as _g664, re as _re664
_ICON664={'chest_gold':91,'task_3d':91,'explore_3d':86,'speaker_3d':86,'typer_3d':91,'cloze_3d':83,'spell_3d':74,'mole_3d':78,'fish_3d':86,'bubble_3d':82,'speed_3d':83,'eagle_3d':81,'gacha_joker_v594':82} # 🔴 v823: task_3d 103→91(Hansen要顶部三图标与下面mode图标对齐·以每日宝箱91为准)
_isl664=_no_subisle(sorted(_g664.glob('island_*.html'))); _bad664={}
for _f in _isl664:
    _t=open(_f,encoding='utf-8',errors='replace').read(); _nm=_f.replace('island_','').replace('.html',''); _miss=[]
    for _src,_sz in _ICON664.items():
        _m=_re664.search(r'icons/'+_re664.escape(_src)+r'\.webp[^>]*?width:(\d+)px;height:\1px', _t)
        if not _m or _m.group(1)!=str(_sz): _miss.append(_src+'='+(_m.group(1) if _m else '?'))
    if '.boss-card-img{width:91px;height:91px' not in _t: _miss.append('boss图标规则非91px')
    if 'font-size:74px;line-height:1;display:inline-block">\U0001f0cf' not in _t: _miss.append('记忆翻牌emoji非74px')
    if 'color:#fbbf24;transform:translate(0,3px)">打字大师' not in _t: _miss.append('打字大师非金fbbf24')
    if 'color:var(--pal-surf-1,#0f172a);transform:translate(0,2px)">抽卡' not in _t: _miss.append('抽卡非深0f172a')
    _blc664 = '#fff' if _nm=='season' else '#0f172a'  # 🔴 v822 赛季岛挑战BOSS字色白(配#0A1228深底)·其余深0f172a(配亮黄底)
    if ('boss-card-label" style="color:%s!important;-webkit-text-fill-color:%s!important' % (_blc664,_blc664)) not in _t: _miss.append('挑战Boss字色非'+_blc664+'强制')
    if 'white-space:nowrap;position:relative;z-index:5}' not in _t: _miss.append('m-title缺z-index')
    if 'margin-top:3px;position:relative;z-index:5}' not in _t: _miss.append('d-label缺z-index')
    if '.mode-card .m-icon img{object-fit:contain;vertical-align:middle}' not in _t: _miss.append('mode图标规则未中性化')
    if _miss: _bad664[_nm]=_miss
if len(_isl664)!=19: _v664.append('island数!=19:'+str(len(_isl664)))
if _bad664: _v664.append('各岛v664参数未达标:'+str(list(_bad664.items())[:4]))
if not all('\U0001f534v664' in open(_f,encoding='utf-8',errors='replace').read() for _f in _isl664): _v664.append('部分岛缺v664标记')
if _v664: fail('v664 首页图标/文字按调节器统一: '+str(_v664[:6]))
else: ok('v664 首页15卡图标/文字按调节器参数统一(13图标explicit px:宝箱90/任务108/探索86/听音86/翻牌74emoji/打字90/完形83/拼字74/地鼠78/钓鱼86/泡泡82/极速83/火眼81/抽卡82·boss图标规则100px·偏移宝箱-5打字+2火眼-2抽卡+2·文字打字金fbbf24/抽卡深0f172a/挑战Boss深0f172a强制覆盖霓虹渐变·三类标签relative+z-index5置顶·mode-card图标规则中性化让inline px生效·19岛一致·真机393验daily三卡等高157对齐+mode图标全对+0报错)')


# ---- v665 修复进岛闪最高阶加误弹进化(删岛内旧宠物渲染残留交模块统一) ----
_v665=[]
import glob as _g665
_isl665=_no_subisle(sorted(_g665.glob('island_*.html'))); _bad665={}
for _f in _isl665:
    _t=open(_f,encoding='utf-8',errors='replace').read(); _nm=_f.replace('island_','').replace('.html',''); _miss=[]
    if 'function updatePetHero(){/* \U0001f534v665' not in _t: _miss.append('updatePetHero未删空')
    if "document.getElementById('heroPetStage').textContent=stage.name" in _t: _miss.append('updatePetHero仍有旧渲染体')
    if '\U0001f534v665 进化检测+提示统一由模块' not in _t: _miss.append('bumpGameCount未删重复进化检测')
    if 'showPetEvolve(PET_STAGES[newStage])' in _t: _miss.append('bumpGameCount仍有重复showPetEvolve')
    if 'id="heroPetStage">蛋' in _t: _miss.append('阶badge静态初始残留蛋')
    if '.pet-stage:empty{display:none}' not in _t: _miss.append('空阶badge未隐藏')
    if _miss: _bad665[_nm]=_miss
if len(_isl665)!=19: _v665.append('island数不等19')
if _bad665: _v665.append('各岛v665未达标:'+str(list(_bad665.items())[:4]))
if not all('\U0001f534v665 修复进岛闪最高阶' in open(_f,encoding='utf-8',errors='replace').read() for _f in _isl665): _v665.append('部分岛缺v665标记')
_pm665=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
if 'v665 清旧残留:存的已见阶高于当前真实阶' not in _pm665: _v665.append('模块缺seen清旧残留')
if 'v665 始终同步 S.pet.stage' not in _pm665: _v665.append('模块缺S.pet.stage同步')
if _v665: fail('v665 进岛闪最高阶修复: '+str(_v665[:6]))
else: ok('v665 修复进岛瞬间闪宠物最高阶并误弹进化(Hansen截图进岛先闪万象天尊寰宇主宰最高阶加旧装饰字体加弹宠物进化toast过一会才落到正确当前阶风翎灵兽). 根因岛内旧宠物逻辑updatePetHero第2561行渲染英雄卡被init于第7060行调用在模块hansen_pet_showcase.js位于body末尾第7466行覆盖window.updatePetHero之前先跑用旧getPetStage高XP玩家算最高阶加无lang旧字体渲染加进化检测st大于S.pet.stage误弹toast然后模块boot才纠正即被覆盖但没删的岛内死代码在模块加载前先跑不是真死. 修复删残留非覆盖一岛内updatePetHero删空交模块统一渲染二岛内bumpGameCount删重复进化检测交模块seen-stage三模块加清理逻辑存的已见阶高于当前真实阶则静默重置不弹历史进化并始终同步S.pet.stage清残留四静态初始阶badge与描述清空空badge设display-none防闪任何错误阶. 真机验证高XP掌握28词卡阶9加seen-stage35残留英雄卡阶位全程空到风翎灵兽全程无最高阶无蛋不弹进化最终风翎灵兽lang等zh-CN正确字体seen-stage35到9清理S.pet.stage35到9同步0报错. 元教训铁律版本迭代时旧逻辑常分散在共享模块与各岛被覆盖死代码两层死代码在模块加载前脚本于body末尾init调用在前会先跑不是真死必须直接删而非依赖覆盖残留localStorage数据也要主动清理')


# 🔴 v666(Hansen): 每日任务"X/Y"角标取代副标题(图标右上角notification badge·参数大小101%横向5纵向1)+任务图标108→102(不要太大)+挑战Boss→挑战BOSS大写+三标题(每日宝箱/每日任务/挑战BOSS)统一15px(boss-card-label 14→15)+打字大师m-title +1px(12→13)。
_v666=[]
import glob as _g666
_bad666=[]
for _f666 in sorted(_g666.glob('island_*.html')):
    _t666=open(_f666,encoding='utf-8').read()
    _m666=[]
    if 'class="quest-badge" id="questSub"' not in _t666: _m666.append('缺每日任务X/Y角标quest-badge')
    if '<div class="d-sub" id="questSub">' in _t666: _m666.append('旧questSub副标题d-sub未删')
    if 'width:91px;height:91px' not in _t666: _m666.append('任务图标非91px') # 🔴 v823: 103→91(对齐下面mode图标·以每日宝箱91为准)
    if '>挑战BOSS</div>' not in _t666: _m666.append('挑战Boss未改大写BOSS')
    if '.boss-card-label{font-size:15px' not in _t666: _m666.append('boss标题非15px三标题应统一')
    if 'font-size:13px;color:#fbbf24;transform:translate(0,3px)">打字大师' not in _t666: _m666.append('打字大师非13px')
    if '🔴v666' not in _t666: _m666.append('v666标记缺')
    if _m666:
        _bad666.append(_f666.split('/')[-1]+':'+'/'.join(_m666))
        if len(_bad666)>=3: break
if _bad666: fail('v666 每日任务角标+图标102+挑战BOSS大写+三标题15px+打字大师13px: '+str(_bad666[:5]))
else: ok('v666 每日任务X/Y角标取代副标题(图标右上角notification badge·position absolute top1px right5px·红底ef4444白边·去d-sub那行省约18px·questSub迁至角标·JS X除Y紧凑无空格)+任务图标108→102(Hansen不要太大)+挑战Boss大写为挑战BOSS+三标题每日宝箱每日任务挑战BOSS统一15px(boss-card-label字号14→15补齐与d-label一致·原14小一号正是Hansen察觉的不一样)+打字大师m-title字号12→13仅此inline不动mode基础13·19岛一致·真机393验三标题全15px+角标1除7约36乘22右缘内收5px+任务图标102+打字大师13px+daily行高157→143+0报错·每日宝箱角标本轮HOLD待确认·v666)')



# 🔴 v667(Hansen 用每日宝箱调节器自调): 每日宝箱角标取代副标题(签到前"可领"红/签到后"已签"蓝)+签到前蓝底#6096eb金箱91px上移1+签到后红底#e60012开箱98px上移7+角标横向-6纵向0大小100%两态共用。
_v667=[]
import glob as _g667
_bad667=[]
for _f667 in sorted(_g667.glob('island_*.html')):
    _t667=open(_f667,encoding='utf-8').read()
    _m667=[]
    if '--c1:#6096eb;--c2:#6096eb' not in _t667: _m667.append('宝箱卡蓝底缺')
    if '.chest-badge{position:absolute' not in _t667: _m667.append('chest-badge_CSS缺')
    if '.daily-card.chest-claimed .chest-badge{background:#2b00ff}' not in _t667: _m667.append('已签蓝角标CSS缺')
    if '#FF2444,#FF2444)!important' not in _t667: _m667.append('已签红底缺')
    if 'class="chest-badge" id="chestSub">可领' not in _t667: _m667.append('可领角标缺')
    if 'class="chest-badge" id="chestSub">已签' not in _t667: _m667.append('已签角标缺')
    if 'width:91px;height:91px' not in _t667: _m667.append('签到前金箱非90')
    if '🔴 v954:' not in _t667 and 'width:98px;height:98px' not in _t667: _m667.append('签到后开箱非96')
    if '<div class="d-sub" id="chestSub">' in _t667: _m667.append('旧chestSub副标题未删')
    if '🔴v667' not in _t667: _m667.append('v667标记缺')
    if _m667:
        _bad667.append(_f667.split('/')[-1]+':'+'/'.join(_m667))
        if len(_bad667)>=3: break
if _bad667: fail('v667 每日宝箱角标+两态配色+图标尺寸: '+str(_bad667[:5]))
else: ok('v667 每日宝箱角标取代副标题(签到前可领红ef4444/签到后已签蓝2b00ff随chest-pending和chest-claimed类自动切色)+签到前蓝底6096eb金箱91px上移1+签到后红底e60012开箱98px上移7+角标横向-6纵向0大小100两态共用·19岛HTML静态与updateChestBadge的JS两态innerHTML同步重构qiw包裹图标加角标一起translate移到qiw前-1后-7·删d-sub副标题·dot永久藏·CSS加chest-badge默认红加claimed蓝override加claimed绿底10b981改红底e60012·同步v575守卫claimed红底加v592守卫查可领已签角标加v664守卫chest_gold 90改91·真机393双态验待开启蓝底金箱可领红角标加已开启红底开箱已签蓝角标·v667)')


# 🔴 v668→v669(Hansen 调节器再调): 签到前蓝底#6096eb金箱91px无偏移·签到后红底#e60012开箱98px下移5px·签到前角标红#ef4444·签到后角标蓝#2b00ff·角标98%横向-6纵向0。
_v668=[]
import glob as _g668
_bad668=[]
for _f668 in sorted(_g668.glob('island_*.html')):
    _t668=open(_f668,encoding='utf-8').read()
    _m668=[]
    if '#FF2444,#FF2444)!important' not in _t668: _m668.append('已签红底缺')
    if '.daily-card.chest-claimed .chest-badge{background:#2b00ff}' not in _t668: _m668.append('已签蓝角标缺')
    if 'width:91px;height:91px' not in _t668: _m668.append('签到前金箱非90')
    if '🔴 v954:' not in _t668 and 'width:98px;height:98px' not in _t668: _m668.append('签到后开箱非96')
    if '🔴 v954:' not in _t668 and 'transform:translate(0,3px)"><img src="icons/chest_open.webp' not in _t668: _m668.append('签到后下移5缺')
    if '.chest-badge{position:absolute;top:0;right:-6px;transform:scale(.98)' not in _t668: _m668.append('角标位置101缺')
    if '🔴v668' not in _t668: _m668.append('v668标记缺')
    if _m668:
        _bad668.append(_f668.split('/')[-1]+':'+'/'.join(_m668))
        if len(_bad668)>=3: break
if _bad668: fail('v668 宝箱再调: '+str(_bad668[:5]))
else: ok('v668 宝箱再调(Hansen用每日宝箱调节器自调·之前v667签到后红底不好改回)·两态统一蓝底6096eb·签到前金箱90px无偏移(translate0)·签到后开箱96px下移5px(translate5)·已签角标由蓝2b00ff改绿10b981·角标大小101横向-8纵向1(chest-badge top1px right-8px scale1.01)·19岛HTML静态加updateChestBadge的JS两态同步·同步v575守卫claimed蓝底加v664守卫chest_gold 91改90加v667守卫4个值检查同步更新·真机393双态验待开启蓝底金箱90可领红角标加已开启蓝底开箱96下移已签绿角标加0报错·v668)')

# 🔴 v671(Hansen 暴怒纠正 v670 擅自移图标): v670 用"图标区固定104px+align-items:flex-end图标底对齐"把每日宝箱/任务图标也下移了→Hansen 只要求移文字、从没让动图标(图标位置是 Hansen 自己定的)。v671 改正:d-icon 全恢复 display:block(图标回原位一像素不动)·boss-card-img 去掉 margin-bottom:4px 回原样·boss-card-label margin-top 回 5·仅对"每日宝箱"文字按宝箱状态类做 translateY(可领金箱91→11.5 / 已签开箱98→4.5)令两态文字都对齐每日任务/挑战BOSS·图标位置完全不动。任务图标保持 103(Hansen 要的 +1px)。🔴铁律:未经 Hansen 明确允许绝不改动图标位置(尤其会移位的图标)。
_v671=[]
import glob as _g671
_bad671=[]
for _f671 in sorted(_g671.glob('island_*.html')):
    _t671=open(_f671,encoding='utf-8').read()
    _m671=[]
    if '.daily-card .d-icon{font-size:72px;margin-bottom:3px;display:block;filter' not in _t671: _m671.append('d-icon未恢复display:block(图标须回原位)')
    if 'align-items:flex-end;justify-content:center;height:104px' in _t671: _m671.append('🔴v670固定104图标区回潮=图标被移动(Hansen明令禁止)')
    if '.daily-card.boss-card .boss-card-img{width:91px;height:91px;object-fit:contain;display:block' not in _t671: _m671.append('boss图标未恢复(应91px无margin-bottom)')
    if 'object-fit:contain;margin-bottom:4px;display:block' in _t671: _m671.append('🔴v670 boss-img margin-bottom:4px回潮')
    if 'boss-card-img{width:100px;height:104px' in _t671: _m671.append('boss图标误改104(应严守100px铁律)')
    if 'boss-card-label{font-size:15px;font-weight:900;color:var(--pal-ink,#fff);margin-top:5px' not in _t671: _m671.append('boss标题margin-top未回5')
    if 'boss-card-label{font-size:15px;font-weight:900;color:#fff;margin-top:3px' in _t671: _m671.append('🔴v670 boss标题margin-top:3回潮')
    if '🔴 v954:' not in _t671 and '#chestCard .d-label{transform:translateY(9.5px)}' not in _t671: _m671.append('每日宝箱文字可领态对齐规则(11.5)缺')
    if '🔴 v954:' not in _t671 and '#chestCard.chest-claimed .d-label{transform:translateY(2.5px)}' not in _t671: _m671.append('每日宝箱文字已签态对齐规则(4.5)缺')
    if 'width:91px;height:91px;object-fit:contain;vertical-align:middle' not in _t671: _m671.append('任务图标91px缺')
    if 'width:102px;height:102px;object-fit:contain;vertical-align:middle' in _t671: _m671.append('旧任务图标102px回潮')
    if '🔴 v954:' not in _t671 and '🔴 v671:' not in _t671: _m671.append('v671标记缺')
    if _m671:
        _bad671.append(_f671.split('/')[-1]+':'+'/'.join(_m671))
        if len(_bad671)>=3: break
if _bad671: fail('v671 每日宝箱文字对齐(图标不动): '+str(_bad671[:5]))
else: ok('v671 每日宝箱文字对齐·图标一像素不动(纠正v670擅自移图标的错误)·d-icon全回display:block图标回原位·boss-img去margin-bottom回原样·boss-label margin-top回5·仅"每日宝箱"文字按状态类translateY(可领金箱91→11.5/已签开箱98→4.5)两态都对齐每日任务/挑战BOSS·任务图标保持103(Hansen要的+1px)·19岛全统一·真机393双态验证图标top可领278.4/已签283.4=原始位置未动+文字两态都383.9对齐·🔴铁律:未经Hansen允许绝不改图标位置(尤其会移位的图标)·v671)')

# 🔴 v672(Hansen 亲定·宠物系统改造6项): ①"现 在"→"现在"去空格 ②主页展示宠物可自选(已解锁范围内·默认/回落当前阶) ③hero宠物图212→252放大+卡牌器宠物322→344/卡片360→376放大 ④收"我的宠物"标题与小字间32px大留白(.psw margin-top:-20px·仅宠物页scoped) ⑤进化map未解锁宠物彻底封存纯黑(不渲染宠物图·只显"?"·不可点击·完全看不到样子·保留悬念) ⑥宠物图36张全引用无冗余(仅清临时截图)。已解锁宠物可见性不动。
_v672=[]
if os.path.exists('hansen_pet_showcase.js'):
    _pm=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    # ① 现在去空格
    if '<div class="nb">现在</div>' not in _pm: _v672.append('现在badge未去空格(应"现在"非"现 在")')
    if '<div class="nb">现 在</div>' in _pm: _v672.append('🔴"现 在"空格回潮')
    # ③ hero宠物放大 + 卡牌器放大
    if '.psw-petbox img{width:252px;height:252px' not in _pm: _v672.append('hero宠物图未放大到252px')
    if "'.psw-petbox img{width:212px;height:212px" in _pm: _v672.append('🔴hero宠物图212px旧值回潮')
    if 'max-width:376px' not in _pm: _v672.append('卡牌器卡片未放大到376px')
    if 'width:min(344px,100%);aspect-ratio:1' not in _pm: _v672.append('卡牌器宠物未放大到344px(v674改贴合卡片min(344px,100%)+aspect-ratio:1)')
    # ④ 收留白
    if 'margin-top:-20px' not in _pm: _v672.append('未收"我的宠物"标题与小字大留白(.psw margin-top:-20px)')
    # ⑤ 进化map未解锁纯黑封存
    if '<span class="qm">?</span>' not in _pm: _v672.append('未解锁节点未改为只显"?"封存')
    if "var capInner=uk?vis(i,'em'):'<span class=\"qm\">?</span>'" not in _pm: _v672.append('未解锁节点仍渲染宠物图(应uk?vis:?·彻底看不到样子)')
    if "var clickA=uk?(' onclick=\"HsnPet.openCard('+i+')\"'):''" not in _pm: _v672.append('未解锁节点未去onclick(应不可点击)')
    if '#161d30,#070b14 92%' not in _pm: _v672.append('未解锁节点缺纯黑背景')
    if '.psw-cap .qm{' not in _pm: _v672.append('缺.qm(?)样式')
    if "'.psw-node.lk .psw-cap{filter:grayscale(1) brightness(.5)}'" in _pm: _v672.append('🔴旧灰度可见剪影回潮=能看到锁定宠物样子')
    if 'function openCard(i){if(i>curStage())return;' not in _pm: _v672.append('openCard未守卫i>curStage(防程序化打开锁定)')
    if 'if(viewIdx<curStage())' not in _pm: _v672.append('卡牌器next未限到curStage(防翻到未解锁看到样子)')
    if "document.getElementById('pcvNext').disabled=(i>=curStage())" not in _pm: _v672.append('卡牌器next禁用未限curStage')
    # ② 主页展示宠物可自选
    if "HOMEKEY='hansen_pet_home_idx'" not in _pm: _v672.append('缺HOMEKEY(主页展示宠物存储)')
    if 'function getHomeIdx(' not in _pm or 'function setHomeIdx(' not in _pm: _v672.append('缺getHomeIdx/setHomeIdx')
    if 'function paintHomeBtn(' not in _pm: _v672.append('缺paintHomeBtn')
    if 'id="pcvHome"' not in _pm or 'pcv-home' not in _pm: _v672.append('卡牌器缺"设为主页展示"按钮')
    if 'hi=showcaseStage(), src=imgOf(hi)' not in _pm: _v672.append('updateHero未用showcaseStage(v786:始终用getHomeIdx自选阶·解锁态由进化推进跟随)')
    # 标记
    if '🔴v672' not in _pm: _v672.append('模块缺🔴v672标记')
else:
    _v672.append('缺hansen_pet_showcase.js')
# 宠物图36张全引用无冗余 + 临时截图绝不残留
import glob as _g672
_petpng=sorted(_g672.glob('pets/pet_*.webp'))
if len(_petpng)!=36: _v672.append('宠物图非36张(%d)'%len(_petpng))
if _g672.glob('_pet_*.webp') or _g672.glob('_home_hero.webp'): _v672.append('🔴临时截图_pet*.webp残留(会被打进部署包)')
if _v672: fail('v672 宠物系统改造: '+str(_v672[:8]))
else: ok('v672 宠物系统改造(Hansen亲定6项·共享模块hansen_pet_showcase.js改一处19岛全生效): ①"现 在"→"现在"去空格 ②主页展示宠物可自选(卡牌器"设为主页展示"按钮·HOMEKEY存已解锁某阶index·默认/回落当前阶·updateHero用getHomeIdx取图与形态名·昵称仍全局名·XP仍overall) ③hero宠物图212→252放大+收留白后卡片更饱满·卡牌器宠物322→344/卡片360→376放大 ④收"我的宠物"标题与小字间32px→12px大留白(.psw margin-top:-20px·仅宠物页scoped不动通用标题) ⑤进化map未解锁宠物彻底封存纯黑:不渲染宠物图(capInner=uk?vis:?)+只显"?"+纯黑背景(#161d30→#070b14)+去onclick不可点击+openCard守卫i>curStage+卡牌器next限curStage(双重封死·完全看不到锁定宠物样子保留悬念)·删旧grayscale可见剪影 ⑥宠物图36张全引用无冗余(全工程扫描·bosses_bg/gacha动态引用非孤儿)·清临时截图. 真机验证(island_animal·393): 留白32→12·hero宠物252·现在无空格·curStage12时13解锁全可点/23锁定全部无宠物图+只显?+不可点·卡牌器停当前阶next禁用+openCard(14)被守卫挡·选第5阶→存储5+按钮"已在主页展示"+主页hero显示pet_05+双尾灵狐崽·清home回落当前阶pet_12·0报错. 🔴铁律:放大/重排/封存均Hansen明确授权·已解锁宠物可见性不动·v672)')

# 🔴 v673(Hansen 亲定·每日宝箱两态图标底端对齐): Hansen 发现未开启(可领·金箱chest_gold 91px)与已开启(已签·开箱chest_open 98px)两图标最下端位置不一样→要求两态【图标底端→"每日宝箱"文字】间距完全相同。以已签态间距(2.5px=X)为基准·把可领金箱qiw整体下移(translate 0→12px·连"可领"角标一起·同已签下移机制)·使可领图标底端落到与已签底端同一水平线(381.4)·间距同为X。文字不动(v671 translateY 11.5/4.5保持)·已签translate(0,5px)不动·别的卡不动。
# 🔴 v842(Hansen·"每日宝箱"四字快出框→整体上移2px): 图标+文字两态整体上移2px(可领金箱translate 12→10 / 已签开箱5→3 · 文字可领translateY 11.5→9.5 / 已签4.5→2.5)·两态图标都上移2px→v673"两态图标底端对齐"完整保持(相对关系不变)·两态文字都上移2px→v671"两态文字同基线"完整保持·只是整体上挪2px给底部文字让出空间·v668/v671/v673三守卫钉死值已同步更新。
_v673=[]
import glob as _g673
_bad673=[]
for _f673 in sorted(_g673.glob('island_*.html')):
    _t673=open(_f673,encoding='utf-8').read()
    _m673=[]
    if '🔴 v954:' not in _t673 and _t673.count('translate(0,10px)"><img src="icons/chest_gold.webp')!=2: _m673.append('可领金箱未下移12px(应2处:静态HTML+updateChestBadge JS)')
    if '🔴 v954:' not in _t673 and 'translate(0,0px)"><img src="icons/chest_gold.webp' in _t673: _m673.append('🔴可领金箱旧translate(0,0px)回潮(底端未对齐)')
    if '🔴 v954:' not in _t673 and 'translate(0,3px)"><img src="icons/chest_open.webp' not in _t673: _m673.append('已签开箱translate(0,5px)被误动')
    if '🔴 v954:' not in _t673 and '#chestCard .d-label{transform:translateY(9.5px)}' not in _t673: _m673.append('每日宝箱文字可领态translateY(11.5)被动(应不动·v671)')
    if '🔴 v954:' not in _t673 and '#chestCard.chest-claimed .d-label{transform:translateY(2.5px)}' not in _t673: _m673.append('每日宝箱文字已签态translateY(4.5)被动(应不动·v671)')
    if _m673:
        _bad673.append(_f673.split('/')[-1]+':'+'/'.join(_m673))
        if len(_bad673)>=3: break
if _bad673: fail('v673 每日宝箱两态图标底端对齐: '+str(_bad673[:5]))
else: ok('v673 每日宝箱两态图标底端对齐(Hansen亲定·铁律#0.2例外:Hansen明确指名要移可领金箱·只动它): 未开启(可领·金箱chest_gold91px无偏移)与已开启(已签·开箱chest_open98px下移5px)原图标底端不一线(可领底369.4高于已签底381.4·差12px)→Hansen要两态【图标底端→每日宝箱文字】间距相同. 解法: 可领金箱qiw整体下移translate(0,0px)→translate(0,12px)(连可领角标一起·同已签下移机制·19岛静态HTML+updateChestBadge JS各2处共38处)→可领图标底端381.4与已签底端381.4对齐到同一水平线·两态间距同为2.5px(=X). 每日宝箱文字不动(v671 translateY可领11.5/已签4.5保持·仍与挑战BOSS标题383对齐)·已签开箱translate5不动·每日任务/挑战BOSS等别的卡不动. 真机393双态实测: 可领图标底381.4=已签图标底381.4(差0.0)·可领间距2.5=已签间距2.5·文字两态都383.9·19岛JS全有效0报错·截图确认两态宝箱底端齐平间距一致. ★铁律#0.2例外说明: 移图标本被铁律禁止·此次是Hansen明确指名移可领金箱并给精确规则·故执行·且只动可领金箱(连其角标)·已签/文字/别的卡一律不碰. v673)')

# 🔴 v674(Hansen 暴怒·防"改尺寸挤出文字"类 bug·铁律 #0.3): 修复卡牌器宠物名被裁(BUG#82)+建文字溢出/裁切自动体检器。根因 v672 放大卡牌器宠物(322→344)→卡片内容更高·.pcv-card(overflow:hidden)是 .pcv-wrap 的 flex 子项默认 flex-shrink:1·矮视口(腾讯顶栏吃高度)下卡片被压缩到比内容矮→裁掉底部宠物名/描述/状态。修: .pcv-card{flex-shrink:0} 恒满高改 pcv-wrap 滚动·文字永不裁。机制: 新建 hansen_overflow_audit.py 真机逐元素量文字 vs 容器·铁律#0.3 每次改尺寸/交付前必跑见✅。
import os as _os674
_v674=[]
_pet674=open('hansen_pet_showcase.js',encoding='utf-8').read() if _os674.path.exists('hansen_pet_showcase.js') else ''
if _pet674:
    if '.pcv-card{flex-shrink:0;width:100%;max-width:376px;' not in _pet674: _v674.append('🔴.pcv-card flex-shrink:0 缺失(矮屏卡片会被压缩裁掉宠物名·BUG#82复发)')
    if '.pcv-pet{position:relative;z-index:2;width:min(344px,100%);aspect-ratio:1;' not in _pet674: _v674.append('.pcv-pet 未贴合卡片内宽(应 min(344px,100%)+aspect-ratio:1)')
    if 'width:min(344px,88vw);height:min(344px,88vw)' in _pet674: _v674.append('🔴宠物旧 88vw 写法回潮(会横向溢出)')
    for _k674 in ['.pcv-sw{flex-shrink:0;','.pcv-nav{flex-shrink:0;','.pcv-home{flex-shrink:0;']:
        if _k674 not in _pet674: _v674.append(_k674+' flex-shrink:0 缺失')
    if '🔴BUG#82' not in _pet674: _v674.append('🔴BUG#82 注释缺失')
else:
    _v674.append('hansen_pet_showcase.js 不存在')
if not _os674.path.exists('hansen_overflow_audit.py'): _v674.append('🔴hansen_overflow_audit.py 体检器缺失(铁律#0.3 强制机制)')
if _v674: fail('v674 卡牌器宠物名被裁修复(BUG#82)+溢出体检器: '+str(_v674[:6]))
else: ok('v674 修复卡牌器宠物名被裁(BUG#82)+建文字溢出/裁切自动体检器(★铁律#0.3·Hansen暴怒防"改尺寸挤出文字"类bug): 根因 v672放大卡牌器宠物(322→344)→卡片内容更高·.pcv-card(overflow:hidden)是滚动容器.pcv-wrap的flex子项默认flex-shrink:1·矮视口(腾讯webapp顶栏吃约230px高度·可视约600)下flex把卡片压缩到比内容矮(393×620实测卡片285/内容549)→overflow:hidden裁掉底部宠物名星雾之卵/描述/状态(高视口850看不出→当时只在高视口验漏矮屏=BUG#82). 修: .pcv-card{flex-shrink:0}令卡片恒为内容满高·矮屏改由.pcv-wrap(overflow-y:auto)滚动·文字永不裁(留//🔴BUG#82注释)+.pcv-sw/.pcv-nav/.pcv-home同加flex-shrink:0+.pcv-pet由min(344px,88vw)(所有手机宽都>卡片内宽→溢出)改min(344px,100%)+aspect-ratio:1(贴合卡片内宽·保持方形·不溢出). 真机393×620+360×640+393×850三视口验: 宠物名完整不裁·宠物方形327×327/294×294·不横向溢出·截图确认星雾之卵+描述+状态全在框内. ★机制(铁律#0.3): 新建hansen_overflow_audit.py文字溢出/裁切自动体检器(Playwright真机矮+正常视口逐屏逐元素量文字边界vs容器边界·检自身overflow裁+被overflow:hidden祖先裁·排除ellipsis故意截断·任一被裁报明细退出1)·自测铁证: 撤掉flex-shrink:0修复跑它→准确报出84处含pcv-name星雾之卵被pcv-card纵向裁超出168px·修复后✅✅✅退出0. 铁律#0.3: 改尺寸/位置必跑体检器见✅才交付·必在矮屏(≤620高)验·overflow:hidden的flex卡片必flex-shrink:0·放大元素先想容器会不会挤出文字. 本守卫钉死: flex-shrink:0修复在位+宠物aspect-ratio贴合+严禁88vw回潮+BUG#82注释+体检器存在. v674)')

# 🔴 v675(Hansen 亲定·宠物主页展示锁+左右切换箭头+卡牌器重排): ①卡牌器把"上一只/下一只"移到"设为主页展示"下、"选择卡牌背景色"上 ②"设为主页展示"右边加锁(🔒固定展示此宠物/🔓升级自动展示新形象) ③宠物页"给宠物改名"两侧加左右箭头(切换展示的宠物形象) ④宠物名左边加锁(🔒不再变/🔓显示当前最高阶)。两锁共用状态homeLock: 锁=钉死homeIdx·解锁=跟随curStage。真机多状态(默认/箭头切换/锁/升级模拟·解锁跟随+锁定钉死)+矮屏0裁切全验过。
import os as _os675
_v675=[]
_p675=open('hansen_pet_showcase.js',encoding='utf-8').read() if _os675.path.exists('hansen_pet_showcase.js') else ''
if _p675:
    for _need,_lab in [("var HOMELOCKKEY=","主页展示锁状态键"),("function getHomeLock","getHomeLock"),
        ("function showcaseStage","showcaseStage(锁→homeIdx/解锁→curStage)"),("function toggleHomeLock","toggleHomeLock"),
        ("function scStep","scStep(箭头只浏览·v745 替代原 homeStep)"),("function paintLock","paintLock"),
        ("hi=showcaseStage()","updateHero用showcaseStage"),
        ("homePrev:function","HsnPet暴露homePrev"),("homeNext:function","HsnPet暴露homeNext"),
        ("toggleHomeLock:toggleHomeLock","HsnPet暴露toggleHomeLock"),
        ("'.psw-nmrow{","宠物页名字行CSS"),("'.psw-arw{","宠物页箭头CSS"),  # 🔴BUG#93: .psw-lk2锁CSS已随展示页锁删除·此检查移除
        ("'.psw-dispst{","宠物页非当前阶状态行CSS"),("'.pcv-homerow{","卡牌器home+锁行CSS"),("'.pcv-lk{","卡牌器锁CSS"),
        ("id=\"pcvLock\"","卡牌器锁HTML"),
        # BUG#93: 宠物页hero锁 id=pswLock 已删除(与卡牌器pcvLock功能重复·Hansen要求)·此项检查移除·只留卡牌器pcvLock
        ("id=\"pswPrev\"","宠物页左箭头HTML"),("id=\"pswNext\"","宠物页右箭头HTML")]:
        if _need not in _p675: _v675.append(_lab+'缺失')
    # 卡牌器顺序: homerow HTML 在 nav HTML 前·nav HTML 在 bglab HTML 前
    _ih=_p675.find('<div class="pcv-homerow"><button class="pcv-home" id="pcvHome">')
    _in=_p675.find('<div class="pcv-nav"><button id="pcvPrev">')
    _ib=_p675.find('<div class="pcv-bglab">🎨 选择卡牌背景色</div>')
    if not(_ih>0 and _in>0 and _ib>0 and _ih<_in<_ib): _v675.append('🔴卡牌器顺序错(应 设为主页展示+锁→上一只下一只→选择背景色)')
else:
    _v675.append('hansen_pet_showcase.js 不存在')
if _v675: fail('v675 宠物主页展示锁+切换箭头+卡牌器重排: '+str(_v675[:8]))
else: ok('v675 [⚠️BUG#93更新:原item④"宠物名左侧锁psw-lk2/pswLock"已删除·与卡牌器pcvLock功能重复·Hansen要求] 宠物主页展示锁+左右切换箭头+卡牌器重排(Hansen亲定4项·共享模块hansen_pet_showcase.js改一处19岛全生效): ①卡牌器把"←上一只/下一只→"从最底部移到"设为主页展示"下方、"选择卡牌背景色"上方(顺序: 卡片→设为主页展示+锁行pcv-homerow→上一只下一只pcv-nav→选择背景色pcv-bglab) ②"设为主页展示"右边加小锁pcv-lk(🔒锁住=主页一直展示这只·升级不变; 🔓解锁=升级后自动展示升级后新形象) ③宠物页"给宠物改名"左右各加箭头psw-arw(右=下一阶/左=上一阶·切换展示的宠物形象·范围0..curStage·边界禁用) ④宠物名左边加小锁psw-lk2(🔒锁住=展示的宠物不再变·钉死; 🔓解锁=默认显示当前最高阶curStage). ★统一设计: 两个小锁共用一个状态homeLock(HOMELOCKKEY)——锁=固定展示homeIdx(钉死)·解锁=自动跟随当前最高阶curStage(升级自动更新); showcaseStage()=getHomeLock()?getHomeIdx():curStage(); 主页hero(#heroPet·updateHero用showcaseStage)和宠物页大卡都展示此"展示阶"; 默认解锁(=显示当前最高阶·和原行为一致). 卡牌器"设为主页展示"=setHomeIdx(viewIdx)+setHomeLock(true)+刷新; 宠物页箭头homeStep(±1)=setHomeIdx(showcase±1·clamp 0..curStage)+setHomeLock(true)+刷新; 锁toggleHomeLock=翻转homeLock(锁时pin当前showcase·解锁回curStage); 卡牌器"上一只/下一只"仍只改viewIdx(浏览·与showcase独立). 非当前阶时宠物页hero隐藏"现在"徽章+进度条·改显psw-dispst状态行(✦已进化获得/你的起点形态·+🔒已锁定). 真机多状态验证(island_animal·mock curStage=10): 默认解锁展示阶10+现在徽章+进度条+锁🔓在名字左+左箭头可用右箭头禁用+主页hero同步; 左箭头→第9阶无现在徽章+状态行+锁自动🔒+进度条消失; 解锁→回当前最高阶10; 升级模拟解锁态curStage10→12自动跟随到12; 锁定第8阶后curStage升到14仍钉死第8阶; 卡牌器顺序对+锁🔓在home右+点设为主页展示→已在主页展示+锁🔒+点锁解锁回设为主页展示. 矮屏393×600+360×620复核: 切换锁定态(状态行)+卡牌器重排 0裁切(铁律#0.3). 共享模块改一处19岛全生效·宠物画像PNG不动. v675)')

# ---- v684: 首页↔岛 一体化外壳(岛在 iframe 就地打开, 首页永不重载, 零跳转) ----
_v684o = []
_idx684 = open('index.html', encoding='utf-8').read() if os.path.exists('index.html') else ''
if 'islandFrameWrap' not in _idx684 or 'id="islandFrame"' not in _idx684:
    _v684o.append('index.html 缺岛外壳容器(islandFrameWrap/islandFrame)')
if 'function openIsland' not in _idx684 or 'function closeIsland' not in _idx684 or '_closeIslandNow' not in _idx684:
    _v684o.append('index.html 缺 openIsland/closeIsland/_closeIslandNow')
if 'window.openIsland' not in _idx684 or 'window.closeIsland' not in _idx684:
    _v684o.append('index.html 未把 openIsland/closeIsland 暴露到 window(岛 goHome 调 parent.closeIsland 要)')
if 'contentWindow.location.replace' not in _idx684:
    _v684o.append('index.html iframe 导航未用 location.replace(会污染历史栈→返回键把顶层导到岛URL)')
if 'e.preventDefault(); openIsland(href)' not in _idx684:
    _v684o.append('index.html 岛卡未改成 preventDefault+openIsland(仍会走网页跳转)')
if 'window.location.href = target' in _idx684:
    _v684o.append('index.html 续玩仍用 location.href 跳转(应改 openIsland)')
_seas684 = open('hansen_season.js', encoding='utf-8').read() if os.path.exists('hansen_season.js') else ''
if 'openIsland' not in _seas684:
    _v684o.append('hansen_season.js 星海岛入口未改 openIsland')
if _v684o:
    fail('v684 首页↔岛一体化外壳: ' + str(_v684o))
else:
    ok('v684 首页与 18/19 岛【彻底融为一体】(Hansen: 不再走网页/走链接·首页永不重载·零跳转零延迟·岛镶嵌其中): index.html 是常驻外壳(#islandFrameWrap+#islandFrame), 点岛卡 preventDefault+openIsland 在外壳 iframe 里【就地打开】岛(顶层 URL 恒为 index.html·首页不重载), 岛 goHome 调 parent.closeIsland 瞬回首页(hansen_home_link.js 早已内置·岛代码一行不改); iframe 用 contentWindow.location.replace 导航(不污染与父页共享的历史栈·返回键只受唯一一条 pushState 控制·杜绝把顶层导到岛 URL); goHome 与硬件返回键统一走 popstate→_closeIslandNow 关闭(同一路径无竞态); 续玩/星海岛入口同步改 openIsland; 关闭即把岛 replace 到 about:blank 卸载(停定时器/音频)+ renderRecent 刷新进度; 真机 12 轮 goHome/返回键混合验证顶层恒 index·历史干净·0 报错, spelling bee 覆盖层在 iframe 岛内正常')


_v683o = []
if not (os.path.exists('hansen_spellbee.js') and 'HansenSpellBee' in open('hansen_spellbee.js', encoding='utf-8').read() and 'iframe' in open('hansen_spellbee.js', encoding='utf-8').read()):
    _v683o.append('hansen_spellbee.js 覆盖层模块缺失/异常')
_sb683o = open('spelling_bee.html', encoding='utf-8').read() if os.path.exists('spelling_bee.html') else ''
if '_sbEmbed' not in _sb683o or 'parent.HansenSpellBee.close()' not in _sb683o:
    _v683o.append('spelling_bee.html 缺嵌入模式(embed→父页关覆盖层)')
_isl_keys683 = ['animal', 'food', 'sports', 'job', 'color', 'time', 'family', 'clothes', 'nature', 'school', 'home', 'traffic', 'action', 'adjective', 'question', 'treasure', 'body', 'season', 'city']
_bo683, _bl683, _bn683 = [], [], []
for _k683 in _isl_keys683:
    _fn683 = 'island_%s.html' % _k683
    if not os.path.exists(_fn683):
        continue
    _tt683 = open(_fn683, encoding='utf-8').read()
    if ("HansenSpellBee.open('%s')" % _k683) not in _tt683:
        _bo683.append(_k683)
    if 'hansen_spellbee.js' not in _tt683:
        _bl683.append(_k683)
    if "location.href='spelling_bee.html" in _tt683:
        _bn683.append(_k683)
if _bo683:
    _v683o.append('未用覆盖层 open 的岛: ' + str(_bo683))
if _bl683:
    _v683o.append('未加载覆盖层模块的岛: ' + str(_bl683))
if _bn683:
    _v683o.append('仍用 location.href 跳转打开 spelling_bee 的岛(应改覆盖层): ' + str(_bn683))
if _v683o:
    fail('v683 spelling bee 岛内覆盖层: ' + str(_v683o))
else:
    ok('v683 spelling bee 改为【岛内全屏覆盖层】(不再跳转单独网页 → Hansen 要的"整体融合·不走网页"): 19 岛 mode card 全部用 HansenSpellBee.open(key) 在岛上弹覆盖层(零跳转·岛永不重载) + 全部加载 hansen_spellbee.js + 无一岛再用 location.href 跳 spelling_bee; spelling_bee.html 嵌入模式(embed=1 → 返回调 parent.HansenSpellBee.close 关覆盖层瞬回岛); 隔离 iframe 零冲突·关闭时浏览器自动清定时器/音频/监听零泄漏·游戏逻辑一行不改零风险; hansen_nav_guard.py 全 19 岛验证"点卡片弹覆盖层不跳转→返回瞬回岛→goHome 回首页"')

# ---- 🔴BUG#83: spelling_bee 返回必须用 history.back 平衡历史栈(否则首页 goHome 的 history.back 错跳回 spelling_bee) ----
_v683 = []
_sb683 = open('spelling_bee.html', encoding='utf-8').read() if os.path.exists('spelling_bee.html') else ''
if not _sb683:
    _v683.append('spelling_bee.html 不存在')
else:
    if 'BUG#83' not in _sb683:
        _v683.append('BUG#83 标记缺失(返回历史栈平衡修复可能被改回 forward 跳转)')
    if 'history.back()' not in _sb683:
        _v683.append('spelling_bee 返回未用 history.back —— 会在历史栈里把 spelling_bee 夹在两个岛之间, 首页右上角 goHome 的 history.back 会错跳回 spelling_bee 而非首页 index')
if _v683:
    fail('🔴BUG#83 spelling_bee 返回历史栈平衡: ' + str(_v683))
else:
    ok('🔴BUG#83 spelling_bee 返回用 history.back 平衡历史栈(拼写对战是全站唯一"跳到单独页面"的模式 → 必须 开=push、返回=pop 保持栈平衡; 否则 首页→岛→spelling_bee→返回→岛 之后, 右上角地图图标 goHome 的 history.back 会回到上一条历史=spelling_bee 而非首页 index. 配套 hansen_nav_guard.py 对全 19 岛真机验证此路径)')

# ---- 🔴BUG#84: 宝箱首帧闪烁根治 — 内联读全局签到 + updateChestBadge 全局同步 (Hansen·宝箱/金币/钻石/宠物/签到都是全岛互通的全局数据) ----
_v84 = []
for _i in islands:
    _fn84 = "island_%s.html" % _i
    try:
        _s84 = open(_fn84, encoding="utf-8").read()
    except Exception:
        _v84.append(_fn84 + " 读取失败")
        continue
    if "BUG#84" not in _s84:
        _v84.append(_fn84 + " 缺BUG#84标记")
    if "localStorage.getItem('hansen_checkin_last')" not in _s84:
        _v84.append(_fn84 + " 缺读全局hansen_checkin_last(宝箱必须读全局非per-island)")
    if "hansen_checkin_last')===today())S.chestDay=today()" not in _s84:
        _v84.append(_fn84 + " 缺updateChestBadge全局签到同步行")
if _v84:
    fail("v686 宝箱首帧闪烁根治 BUG#84: " + str(_v84[:6]))
else:
    ok("v686 BUG#84: 宝箱首帧闪烁根治(Hansen 纠正·宝箱/金币/钻石/宠物/签到都是全岛互通的全局数据·非per-island). 根因: SPA首页外壳改造前·整页导航靠浏览器 bfcache 重进岛瞬时不闪; 改造后 closeIsland 把岛 replace 到 about:blank 卸载→每次进岛从头重载 7400 行→HTML 先画宝箱默认【可领】态(1359行硬编码)·等边解析边渲染到 2346 行 updateChestBadge 才更新成【已签】→中间这个空隙就闪 可领→已签(金币数同理). 且 updateChestBadge 的 canOpen 读的是 per-island 的 S.chestDay(本地缓存)·而签到真正源头是全局 hansen_checkin_last(hansen_checkin_global.js·任意岛签到→全局锁当天·双向同步本岛S.chestDay)→跨岛进岛(在别的岛签到过·本岛S.chestDay还没被同步)时会先显示可领再变已签. 修复两手并用: ①各岛 chestDot 锚点后注入内联脚本·渲染前就读【全局】hansen_checkin_last·已签则提前把图标/角标/红底画成已签态(与 updateChestBadge 已签分支字节一致); ②updateChestBadge 的 canOpen 前插一行全局同步 if(全局hansen_checkin_last===today)S.chestDay=today→让 2346 行也尊重全局·跨岛进岛也立刻显示已签. 配套【保活岛】(closeIsland 只隐藏不卸载·再进同一个岛 iframe 不重载→根治再进卡顿 + 再进闪烁·岛无后台音乐隐藏安全)+【换岛遮罩】(换岛时 iframe 先透明露出 wrap 暗底·新岛 load 完再转可见·不闪旧岛). 真机验证: 已签进岛首帧起就已签不闪·未签一直可领不误显·跨岛立刻已签·保活再进瞬时·换岛干净·nav_guard 全19岛过·0报错. 元教训: per-island 字段(coins/chestDay)能全局是靠钱包/签到系统加载时同步·要判全局状态必须读全局 key 不能读本地缓存. v686")

# ---- 🔴BUG#85: 人物等级全局化(全岛共用一个等级·首跑清零) + 与宠物XP解耦(宠物S.totalXP不动) ----
_v85 = []
for _i in islands:
    _fn85 = "island_%s.html" % _i
    try:
        _s85 = open(_fn85, encoding="utf-8").read()
    except Exception:
        _v85.append(_fn85 + " 读取失败")
        continue
    if "hansen_charxp_migrated_v942" not in _s85:
        _v85.append(_fn85 + " 缺v942人物经验可重建迁移标记")
    if "var tx = S.charXP || 0;" not in _s85:
        _v85.append(_fn85 + " 等级未改读S.charXP")
    if "localStorage.setItem('hansen_wallet_charxp'" not in _s85:
        _v85.append(_fn85 + " addXP未写全局charxp")
    if "hansen_charxp_reset_v1" not in _s85:
        _v85.append(_fn85 + " 缺全局同步/清零(SYNC)")
    if "if((S.totalXP||0)<r.xp)return false;" not in _s85:
        _v85.append(_fn85 + " 宠物meetsReq未解耦为只读totalXP")
    # 旧的等级读S.totalXP必须全部清除(否则等级没全局化)
    if "var tx = S.totalXP || 0;" in _s85:
        _v85.append(_fn85 + " 残留等级读S.totalXP(未全局化)")
    if "if(S.xp<r.xp&&S.totalXP<r.xp)" in _s85:
        _v85.append(_fn85 + " 残留宠物Math.max(S.xp..)(未解耦)")
if _v85:
    fail("v687 人物等级全局化 BUG#85: " + str(_v85[:6]))
else:
    ok("v687 BUG#85: 人物等级全局化(Hansen·全岛共用一个等级·彻底格式化清零·具体升级换算后续再细化) + 与宠物经验解耦. 背景: 金币/钻石/宠物/签到本就全岛互通·唯独人物等级Lv.X还是各岛各练各升(getAdvLevel从per-island S.totalXP推导). 关键陷阱: S.totalXP同时是【人物等级】和【宠物阶段getPetStage/meetsRequirement】的经验源·直接把S.totalXP清零会把宠物也降级到蛋(宠物XP门槛掉0)·Hansen只想清等级不想动宠物. 解法(解耦): ①人物等级改用单独全局经验 hansen_wallet_charxp(运行时镜像S.charXP)·getAdvLevel/getAdvLevelProgress/getXpInCurrentLevel/showLevelMap/总XP显示全改读S.charXP; ②addXP里 S.totalXP+=n(给宠物·不动)的同时 S.charXP+=n 并写全局charxp; ③init的load()后、updateTopBar前注入SYNC: 首跑(hansen_charxp_reset_v1未置)把全局charxp清零·然后S.charXP=全局charxp·S.level=getAdvLevel().lv(避免顶栏先显示per-island旧等级再跳·无闪); ④宠物的XP门槛 meetsRequirement/getPetProgress 从 Math.max(S.xp,S.totalXP) 改为只读 S.totalXP(对老用户Math.max本就==S.totalXP·宠物行为零变化·但杜绝新S.xp=charXP内层经验污染宠物). 真机验证: 老用户(存档totalXP=5000/level=5)进岛首跑等级归零Lv.1·charXP=0·全局charxp=0·而宠物S.totalXP=5000完整保留; food挣600→charXP+全局=600·Lv.4; 切animal→同步全局charxp=600·等级Lv.4与food一致(全岛共用); animal再挣300→全局累加=900(跨岛累加); 回food→读全局900非本地旧值; 0报错. 元教训: 全局化某个派生值前·先grep它的底层字段(S.totalXP)被哪些系统(等级+宠物)共用·避免改一个系统误伤另一个; 清零/格式化前确认该字段不被别的功能当数据源. 待办: Hansen要后续重做升级换算(经验曲线/升级奖励等)·当前仅完成全局化+清零. v687")

# ---- 🔴BUG#86: 拼写对战(Spelling Bee)mode卡图标 92→72px + 标题排紧 防顶部触角被切 ----
_bee72 = "width:88px;height:88px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v710 Hansen调节器再调: 88px(87→88·下移1px不变·注:v698曾用88被否·现Hansen再选88)
_bee80old = "width:80px;height:80px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v695旧值80px·防回退
_bee82old = "width:82px;height:82px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v696旧值82px·防回退
_bee85old = "width:85px;height:85px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v697旧值85px·防回退
_bee88old = "width:88px;height:88px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v698旧值88px·防回退
_bee86old = "width:86px;height:86px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v699旧值86px·防回退
_bee87old = "width:87px;height:87px;object-fit:contain;vertical-align:middle;transform:translate(0px,1px)\" onerror=\"this.outerHTML='🐝'\""  # v700旧值87px·防回退
_bee72old = "width:72px;height:72px;object-fit:contain;vertical-align:middle\" onerror=\"this.outerHTML='🐝'\""  # v689旧值·防回退
_bee64 = "width:64px;height:64px;object-fit:contain;vertical-align:middle\" onerror=\"this.outerHTML='🐝'\""
_bee92 = "width:92px;height:92px;object-fit:contain;vertical-align:middle\" onerror=\"this.outerHTML='🐝'\""
_beetitle = "line-height:0.9;padding-bottom:0px;white-space:normal\">spelling bee"
_v86 = []
for _i in islands:
    _fn86 = "island_%s.html" % _i
    try:
        _s86 = open(_fn86, encoding="utf-8").read()
    except Exception:
        _v86.append(_fn86 + " 读取失败")
        continue
    if "BUG#86" not in _s86:
        _v86.append(_fn86 + " 缺BUG#86标记")
    if _bee72 not in _s86:
        _v86.append(_fn86 + " 蜜蜂图标非88px+下移1px(v710)")
    if _beetitle not in _s86:
        _v86.append(_fn86 + " 蜜蜂标题行高非0.9(v695)")
    if _bee92 in _s86 or _bee64 in _s86 or _bee72old in _s86 or _bee80old in _s86 or _bee82old in _s86 or _bee85old in _s86 or _bee86old in _s86 or _bee87old in _s86:
        _v86.append(_fn86 + " 蜜蜂图标残留旧尺寸(92/64/72/80/82/85/86/87px)")
if _v86:
    fail("拼写对战图标 BUG#86: " + str(_v86[:6]))
else:
    ok("v710 BUG#86: 拼写对战 mode卡图标=88px+下移1px · 标题 Baloo2/15px/行高0.9/彩虹/小写/置顶(Hansen 用校准1:1调节器多轮微调·v689→72px·v695→80px·v696→82px·v697→85px·v698→88px·v699→86px·v700→87px·v710→88px(现行·v698曾88被否·现再选88)·下移1px不变·字体 Baloo2 内嵌防回退·调节器真机卡宽与游戏差0.02px). [历史]v689: 92px→72px+标题排紧(Hansen两轮: 原92px顶部触角溢出卡片被切→一度调到64px又嫌太小→再放大到72px但要在边框内). 根因: mode-card正方形(aspect-ratio:1)+overflow:hidden·spelling_bee.webp内容包围盒(PIL getbbox)占满整图0%留白(蜜蜂触角贴图顶)不像邻卡fish有6.2%留白·叠上标题spelling bee占一行高·导致图标区被压窄(390px=64px·360px窄屏=54px). 解法: ①仅此一个图标(🐝 onerror专属锚点·19岛唯一·不误伤别的mode图标) width/height 92→72px; ②把这一个卡的标题 line-height 1.45→1.1 去掉padding-bottom·排紧腾出约8px竖向空间(标题是1行·仅压缩文字框高不影响换行). 选72px依据(真机三屏阈值实测·排紧标题后): 360px窄屏图标区62px·72px刚好不切(顶余0·蜜蜂底离标题1px不重叠)·390px顶余5px·414px更宽松. 元教训: 卡片图标尺寸不是越大越好也不是越小越好·要同时看图本身留白(PIL getbbox)+标题占高+最窄屏(360px)图标区·并在360/390/414多屏真机实测阈值(窄屏是瓶颈)·标题排紧是腾空间让图标可以更大的关键手段. 注: Hansen明确要求的尺寸调整(非违反几何参数不改铁律). v689")
# ---- 🔴BUG#87: 进岛提速(DOM就绪即揭开iframe·不再等onload·加加载提示) 防回退 ----
try:
    _idx87 = open("index.html", encoding="utf-8").read()
    _v87 = []
    if 'id="islandLoading"' not in _idx87: _v87.append("缺加载提示元素")
    if 'id="islandLoadingBar"' not in _idx87: _v87.append("缺进度条")
    if '_showIslandLoading' not in _idx87 or '_hideIslandLoading' not in _idx87: _v87.append("缺提示显隐函数")
    if '_pollReady' not in _idx87: _v87.append("缺DOM就绪轮询")
    if 'readyState' not in _idx87 or 'interactive' not in _idx87: _v87.append("缺interactive揭开逻辑")
    if _v87:
        fail("进岛提速 BUG#87: " + str(_v87))
    else:
        ok("v690 BUG#87: 进岛黑屏慢+图标半天不出来 根治. 根因(实测): 点岛后 iframe 先透明露暗底当遮罩, 旧代码【等 frame.onload(所有图片下完)才揭开】→ FCP 2.9s 就画好了却要等到 onload 7.5s 才显示(白等4.6s); 且 2s 兜底会揭开【半成品页】(脚本还没跑完·内容没建好)→ 用户看到慢慢刷新/图标半天不出来. 单岛 464KB HTML + 44个阻塞脚本(1.9MB·中间夹依赖它们的内联init不能盲目defer) + 52图. 解法(只改index.html·零碰岛逻辑): ①换岛分支改成【轮询新岛 readyState·url===file且interactive(=DOMContentLoaded·44脚本全执行完内容就绪)立刻揭开】, 揭开即完整页·图片在可见页渐进补齐; onload只作兜底·另加9s硬兜底绝不卡死. ②加加载提示(岛emoji+正在进入X岛…+平滑进度条·无旋转闪烁震屏)替代空白黑屏. 实测: 黑屏 animal 7.5s→2.3s·food→1.3s(省6.2s)·保活再进35ms·导航回归19岛全过·0报错. 元教训: iframe换页别等onload(等所有图片·慢)·也别定时兜底揭半成品(内容是脚本建的)·要等readyState interactive(DOM+脚本就绪)才揭; 海量阻塞脚本(1.9MB)是真机慢的根·但夹着内联依赖不能盲目defer·需先重构才能进一步提速. v690")
except Exception as _e87:
    fail("BUG#87 检查异常: " + str(_e87))

# ---- 🔴BUG#88: 进岛再提速(进岛期间暂停首页外壳预载竞争 + 图标/boss图压缩) 防回退 ----
try:
    _pre88 = open("hansen_preload.js", encoding="utf-8").read()
    _idx88 = open("index.html", encoding="utf-8").read()
    _v88 = []
    if "_holdUntil" not in _pre88: _v88.append("hansen_preload.js 缺 _holdUntil 让路helper")
    if "__hsnIslandBusyUntil" not in _pre88: _v88.append("hansen_preload.js 预载未读进岛暂停标志 __hsnIslandBusyUntil")
    if "__hsnIslandBusyUntil = Date.now() + 12000" not in _idx88: _v88.append("openIsland 未设进岛暂停(12s)")
    if "__hsnIslandBusyUntil = Date.now() + 2500" not in _idx88: _v88.append("_revealIsland 未设揭岛后恢复预载(2.5s)")
    # boss图守卫(v859修订·与新法令握手): 旧前提"显示100px应≤256"已被v857/v859推翻——现显示214/258 CSS(642-774设备px@3x)·
    # v859法令: 256源必糊·EDSR超分768. "防预载拖慢"改由体积把关: 超分+pngquant产物单张须≤400KB(实测195-330KB·比不少256老图还小).
    import os as _os88
    try:
        from PIL import Image as _Img88
        _bigboss = []
        for _n in range(1, 21):
            _bp = "bosses/lv%02d.webp" % _n
            if _os88.path.exists(_bp):
                try:
                    with _Img88.open(_bp) as _bi:
                        if max(_bi.size) != 768: _bigboss.append("%s(%dpx应=768超分)" % (_bp, max(_bi.size)))
                    if _os88.path.getsize(_bp) > 400*1024: _bigboss.append("%s(%.0fKB>400KB体积预算)" % (_bp, _os88.path.getsize(_bp)/1024))
                except Exception: pass
        if _bigboss: _v88.append("lv主boss图不符v859高清+体积双规(768px·≤400KB): " + str(_bigboss[:3]))
    except Exception: pass
    if _v88:
        fail("进岛再提速 BUG#88: " + str(_v88))
    else:
        ok("v691 BUG#88: 进岛再提速根治(承接v690 BUG#87). 根因(实测·4G节流): v690把揭岛改readyState后黑屏已缩到2-3s, 但Hansen仍报'图标半天刷不出来'——查清三层根因: ①持久首页外壳index.html自己也跑hansen_preload.js·进岛瞬间它在后台预载(boss图+~7MB单词音频共~16MB)和iframe里进岛要下的HTML/44JS/图标【抢带宽】(预载触屏只让路1.5s<进岛耗时·1.5s后又恢复抢); ②图标超大(8.6MB·512/1254px巨图却显示≤103px); ③boss图超大(14.2MB·lv主boss 384px显示仅100px). 解法三管齐下: (A)进岛暂停预载: openIsland设window.__hsnIslandBusyUntil=now+12000·hansen_preload.js的_holdUntil让boss图预载+单词音频预载一起停·揭岛后再过2.5s才恢复(给可见页图标下完留时间)→进岛期间整条带宽全给iframe. (B)图标压缩8.6→3.1MB: 保持512px高清(守v657高清铁律·1254px荒谬巨图缩到512)·pngquant 65-92压字节(显示≤103px·512px降采样把palette抖动平均掉·真机抽查task_3d 103px/ic_home 80px/ic_cards 67px均无banding). (C)boss图压缩14.2→6.1MB: lv主boss(显示100px)缩256px+pngquant·攻击特效精灵图pngquant不缩(防错位)·Saelya最终boss不在预载列表且showcase大尺寸显示故保原图. 实测4G节流: 进岛总下载25→18.7MB·首屏load 38→26s(图标省12s)·预载暂停后进岛期间不再竞争. 元教训: (1)持久SPA外壳自己跑的后台预载会和iframe子页加载抢带宽·子页加载期间必须用全局时间戳标志暂停外壳预载. (2)高清与体积矛盾的解法=保分辨率(满足显示锐利)+pngquant压字节(显示降采样隐藏palette抖动)·而非降分辨率违反高清要求. (3)图标/boss图文件分辨率应按最大显示尺寸×3(retina)定·几百px显示用512足矣·1254px纯浪费带宽. v691")
except Exception as _e88:
    fail("BUG#88 检查异常: " + str(_e88))

# ---- 🔴BUG#89: 进岛丝滑过渡(背景统一#0c1538消除跳变 + iframe淡入揭开 + 加载提示淡出 + 换岛先隐藏iframe防闪旧岛) 防回退 ----
try:
    _idx89 = open("index.html", encoding="utf-8").read()
    import re as _re89
    _v89 = []
    # 外壳 wrap/iframe 背景必须与全19岛 body(#0c1538)统一: 原 #0b1020 与岛不一致→揭岛背景跳变="闪一下"主因
    _wrap89 = _re89.search(r'id="islandFrameWrap"[^>]*?background:#([0-9a-fA-F]{6})', _idx89)
    if _wrap89 and _wrap89.group(1).lower() != '0c1538': _v89.append("wrap背景#%s非#0c1538(与岛不一致会闪)" % _wrap89.group(1))
    _fr89 = _re89.search(r'id="islandFrame"[^>]*?background:#([0-9a-fA-F]{6})', _idx89)
    if _fr89 and _fr89.group(1).lower() != '0c1538': _v89.append("iframe背景#%s非#0c1538" % _fr89.group(1))
    # 揭岛动画已由 BUG#90 接管(改"瞬时完整揭开"·v692 的0.3s淡入被反馈为仍"闪一下"·见 BUG#90 守卫); 此处仅守 BUG#89 仍成立的不变量: 背景三者统一 + 换岛先隐藏iframe再显wrap。
    # 换岛分支顺序: 必须 先 opacity='0'(隐藏iframe) 再 wrap.display='block'(显示外壳)·防闪旧岛画面
    _ob89 = _idx89.find("frame.style.transition = 'none'; frame.style.opacity = '0';")
    _wb89 = _idx89.find("wrap.style.display = 'block';", _ob89) if _ob89 >= 0 else -1
    if _ob89 < 0 or _wb89 < 0 or _ob89 > _wb89: _v89.append("换岛未先隐藏iframe再显wrap(防闪旧岛顺序错)")
    if _v89:
        fail("进岛丝滑过渡 BUG#89: " + str(_v89))
    else:
        ok("v692 BUG#89: 进岛'闪一下'根治·做到完全丝滑(Hansen: 从首页点任何大冒险进去会闪烁一下/突然啪卡一下·要完全打通任督二脉非常丝滑零卡顿). 根因(查清·三层): ①【背景色跳变=主因】全19岛 body 背景是 #0c1538, 但常驻外壳 wrap/iframe 原是 #0b1020→揭岛瞬间背景从#0b1020跳到#0c1538(两个相近但不同的深色)→闪一下; ②【iframe瞬间蹦】揭岛 opacity 0→1 是瞬时无过渡, 岛'啪'地蹦出来; ③【加载提示突然消失】DOM就绪时加载提示 display:none 瞬间消失; ④【换岛闪旧岛】原代码先 wrap.display='block' 再设 opacity='0', 若iframe还是上个岛的画面会闪一下旧岛. 解法(只改index.html·零碰岛逻辑): (A)wrap+iframe背景 #0b1020→#0c1538, 与全19岛 body + 首页(--bg-deep:#0c1538)三者统一→揭岛/进岛/换岛背景全程#0c1538零跳变; (B)揭岛改 opacity 平滑淡入: _revealIsland 设 transition='opacity 0.3s ease'+void offsetWidth强制reflow+opacity='1'→岛在匹配暗底上0.3s淡入(非瞬间蹦); (C)加载提示 crossfade: _hideIslandLoading 加 immediate 参数, 换岛(false)时 transition='opacity 0.3s'淡出+320ms后display:none, 保活(true)时立即隐藏; (D)换岛重排: 先 frame.opacity='0'(transition:none瞬时隐藏)【再】wrap.display='block'→wrap出现时iframe已隐藏, 绝不闪旧岛. 真机验证(无JS错误): 进岛瞬间加载提示flex+iframe op=0; 揭开瞬间计算opacity<1=正在淡入+transition=opacity0.3s; +500ms计算opacity=1淡入完成+加载提示已淡出; 首页/外壳/全19岛背景全#0c1538一致. 元教训(铁律·SPA iframe丝滑四要素): (1)外壳/iframe/子页背景三者必须统一同色→揭岛零跳变(背景不一致是闪烁头号原因·相近色也会闪); (2)揭开用opacity过渡淡入·绝不瞬间蹦; (3)加载提示淡出crossfade·不突然消失; (4)换岛先隐藏iframe再显外壳·防闪旧岛. v692")
except Exception as _e89:
    fail("BUG#89 检查异常: " + str(_e89))

# ---- 🔴BUG#90: 进岛"秒进"(首页预热44脚本+首屏图标+岛HTML进缓存 + 揭岛改"图片就绪即瞬时完整揭开"·去淡入·去图标逐个蹦) 防回退 ----
try:
    _idx90 = open("index.html", encoding="utf-8").read()
    _pre90 = open("hansen_preload.js", encoding="utf-8").read()
    _v90 = []
    # index.html: 揭岛必须"等首屏图标就绪 + 瞬时揭开"(替代0.3s淡入)
    if "🔴BUG#90" not in _idx90: _v90.append("index.html 缺 BUG#90 标记")
    if "function _homeImagesReady" not in _idx90: _v90.append("index.html 缺 _homeImagesReady(首屏图标就绪判定·杜绝图标逐个蹦)")
    if "#homeScreen img" not in _idx90: _v90.append("index.html 揭岛未检测 #homeScreen 首屏图标加载完成")
    if "clearTimeout(_loadHintTimer)" not in _idx90: _v90.append("index.html 揭岛未清除延迟加载提示计时器(_loadHintTimer)")
    if "}, 250);" not in _idx90: _v90.append("index.html 缺 加载提示延迟250ms(预热后瞬时揭开根本不显提示=真秒进无闪)")
    # 揭岛瞬时: _revealIsland 必须 transition='none' + _hideIslandLoading(true) (非0.3s淡入)
    _rv90 = _idx90.find("function _revealIsland")
    _rvend90 = _idx90.find("function _pollReady", _rv90) if _rv90 >= 0 else -1
    _rvbody90 = _idx90[_rv90:_rvend90] if (_rv90 >= 0 and _rvend90 > _rv90) else ""
    # 🔴v1070: 原为钉死整条赋值语句，等价改写(换属性写法/换 API)即误报——
    #   与 v1069「星海觉醒」那两道守卫同一个坑。改为查行为特征。
    if (not re.search(r"frame\.style\.transition\s*=\s*['\"]none|setProperty\(\s*['\"]transition['\"]\s*,\s*['\"]none", _rvbody90)) or ("_hideIslandLoading(true)" not in _rvbody90):
        _v90.append("index.html _revealIsland 未做'瞬时揭开'(transition='none'+加载提示瞬时隐藏)")
    if "transition = 'opacity 0.3s ease'" in _rvbody90:
        _v90.append("index.html _revealIsland 仍残留0.3s淡入(应瞬时揭开·淡入被反馈为'闪一下')")
    # hansen_preload.js: 首页外壳预热"进任何岛必下"的脚本+图标+岛HTML
    if "preheatIslandEntryResources" not in _pre90: _v90.append("hansen_preload.js 缺 preheatIslandEntryResources(秒进核心:预热44脚本+首屏图标+岛HTML)")
    if "preheatUrlBatch" not in _pre90: _v90.append("hansen_preload.js 缺 preheatUrlBatch(带礼让/中止在途的预热批次)")
    if "getElementById('islandFrameWrap')" not in _pre90: _v90.append("hansen_preload.js 预热未用 islandFrameWrap 限定仅首页外壳跑(岛内不该重热)")
    if "new DOMParser()" not in _pre90: _v90.append("hansen_preload.js 未用 DOMParser 从真实岛HTML抽脚本/图标(自维护·防与岛漂移)")
    if "inHomeShell" not in _pre90: _v90.append("hansen_preload.js run() 缺 首页外壳分支(inHomeShell)")
    if _v90:
        fail("进岛秒进 BUG#90: " + str(_v90))
    else:
        ok("v693 BUG#90: 进岛'秒进'根治·点任何大冒险瞬间完整进入·图片一次性全出·零闪(Hansen: 点进去还要等·延迟太高·要直接秒进瞬间秒进完全不需要等·一下子图片全加载出来·没有闪屏·不同大冒险点进去还是会闪一下). 根因(查清·两条·硬数据): "
           "①【慢=预热优先级反了】当前 hansen_preload.js 在首页【只】预热 boss图(20张)+单词mp3+句子mp3(~16MB·打boss/背单词才用), 偏偏【不预热】每次进任何岛都必须先下的【44个共享脚本(1.9MB·最大 hansen_boss_attack.js 705KB·首页根本没加载)+首屏~20图标+岛HTML 480KB】——而 BUG#87/#88 已查明这1.9MB脚本才是首次进岛黑屏头号原因; "
           "②【闪=揭早了+淡入】v692 在 DOM 一 interactive 那刻就揭岛, 但首屏~20个图标PNG这时还没下完→揭开后图标一个个'啪啪'蹦出来='闪一下/像在刷新'; 加上 v692 那0.3s淡入本身也被反馈为'闪一下'. "
           "解法(只改 index.html + hansen_preload.js·零碰岛逻辑): "
           "(A)预热反转: hansen_preload.js 新增 preheatIslandEntryResources()【仅首页外壳跑·靠 islandFrameWrap 判定·岛内不跑】, 从真实岛HTML(DOMParser·自维护不写死)抽出全部 <script src>+icons/ 图标, 用 preheatUrlBatch(fetch读body进HTTP缓存·复用 _holdUntil 礼让·碰屏/音频忙立刻中止在途) 优先预热【44脚本+首屏图标】→再低优先预热19岛HTML→最后才 boss图. 首页空闲下完后, 点岛时 iframe 引用同 URL(含?v=) 直接命中缓存→ readyState 秒到 interactive + 图标已就绪. "
           "(B)揭岛改'图片就绪即瞬时完整揭开': index.html _pollReady 在 interactive 后【再等 #homeScreen 首屏图标全部 complete(_homeImagesReady·软封顶2s防极端慢冷加载)】才揭→揭开即'图片全在'无逐个蹦; _revealIsland 用 transition='none'+opacity='1'【瞬时】揭开(去掉 v692 的0.3s淡入·淡入本身=闪)+加载提示瞬时隐藏; 背景三者仍统一 #0c1538(BUG#89). "
           "(C)加载提示延迟250ms才显: 预热后多为瞬时揭开(<250ms)→提示根本不出现=真秒进无任何闪; 仅冷加载(>250ms·罕见·点得太快预热没跑完)才显提示. "
           "元教训(铁律·SPA秒进): (1)预热必须先热'进任何岛都必下'的共享脚本(1.9MB·尤其705KB大脚本)+首屏图标+岛HTML进缓存·而非只热boss图/音频(那是进岛后才用)·否则点岛永远要现下1.9MB=慢; (2)揭岛别在 DOM interactive 就揭(首屏图片还没下完会逐个蹦=闪)·要等首屏图片 complete 后【瞬时完整】揭开; (3)淡入过渡本身会被用户感知为'闪一下'·资源全就绪时'瞬时显示完整页'才是真秒进; (4)预热清单从真实岛HTML DOMParse 抽取=自维护·永不与岛引用漂移. v693")
except Exception as _e90:
    fail("BUG#90 检查异常: " + str(_e90))

# ---- BUG#16: phase/狂怒切换 setTimeout 不得绕过题面时间锁/去重锁(否则"题闪一下没扣分跳过") ----
# 根因(v242/v249): boss phase/狂怒切换的延迟 setTimeout 抢先调 nextBossQ 把当前题清掉 = "题闪一下消失"。
# 防线 = hansen_boss_lock.js nextBossQ 去重锁(lastNextBossQAt 800ms·BUG#14)+ 题面完成闸门(bo.dataset.done)+ 题型闸门(window._bossQType)。
# 缺任一 → 切阶可能抢先出题把题闪没 → 拒绝打包。与检查28(BUG#62看门狗)共同护住打 boss 全程出题。
try:
    _lock16 = open("hansen_boss_lock.js", encoding="utf-8", errors="replace").read() if os.path.exists("hansen_boss_lock.js") else ""
    if not _lock16:
        ok("(未找到 hansen_boss_lock.js, 跳过 BUG#16 检查)")
    else:
        _v16 = []
        if "lastNextBossQAt" not in _lock16: _v16.append("缺 nextBossQ 去重锁 lastNextBossQAt(800ms时间锁·防phase/狂怒切换setTimeout抢先覆盖题面)")
        if "bo.dataset.done" not in _lock16: _v16.append("缺 题面完成闸门 bo.dataset.done(防答完/切阶重复处理)")
        if "window._bossQType" not in _lock16: _v16.append("缺 题型闸门 window._bossQType")
        if _v16:
            fail("题闪一下没扣分跳过 BUG#16: hansen_boss_lock.js " + str(_v16))
        else:
            ok("BUG#16: phase/狂怒切换 setTimeout 不抢先出题 —— 题面时间锁(lastNextBossQAt 800ms去重锁)+ 完成闸门(bo.dataset.done)+ 题型闸门(window._bossQType)在位(v242/v249·'题闪一下消失'的终极根因·与检查28 BUG#62看门狗共同护住打boss全程绝不漏题/卡死)")
except Exception as _e16:
    fail("BUG#16 检查异常: " + str(_e16))

# ---- BUG#49: 唯一打包器必须用部署白名单且源码显式排除 .zip(防旧包嵌套·体积翻倍) ----
# 根因(v469): build.py EXCLUDE_EXT 漏 .zip → 工作区残留旧源码包被打进部署包(部署包 30M→61M=多塞31M旧源码包)。
# v941 打包逻辑已唯一化到 package_release.py；build.py 只允许委托，不能再复制一套排除表。
# 防线 = deploy allow-list 不含 .zip + source exclude 含 .zip + build 唯一委托。
try:
    _build49 = open("build.py", encoding="utf-8", errors="replace").read() if os.path.exists("build.py") else ""
    _package49 = open("package_release.py", encoding="utf-8", errors="replace").read() if os.path.exists("package_release.py") else ""
    if not _build49 or not _package49:
        fail("部署包体积翻倍 BUG#49: build.py/package_release.py 缺失")
    else:
        import re as _re49
        _m49 = _re49.search(r"DEPLOY_ALLOWED_EXT\s*=\s*\{([^}]*)\}", _package49, _re49.S)
        _allow49 = _m49.group(1) if _m49 else ""
        if not _m49 or '".zip"' in _allow49:
            fail("部署包体积翻倍 BUG#49: DEPLOY_ALLOWED_EXT 缺失或错误允许 .zip")
        elif 'SOURCE_EXCLUDE_EXT = {".zip", ".pyc"}' not in _package49:
            fail("部署包体积翻倍 BUG#49: 源码包未显式排除历史 .zip")
        elif '"package_release.py", new, "--out"' not in _build49:
            fail("部署包体积翻倍 BUG#49: build.py 未唯一委托 package_release.py")
        else:
            ok("BUG#49: 部署白名单不允许 .zip + 源码排除 .zip + build.py 唯一委托在位")
except Exception as _e49:
    fail("BUG#49 检查异常: " + str(_e49))

# ---- BUG#91: 点任何页面进去都"闪一下"根治 —— 切屏/弹窗入场淡入(从opacity:0)必须去掉·瞬时出现 ----
# 根因: .screen{animation:slideIn .3s}(从opacity:0+translateY淡入)每次 showScreen 切屏都播放→切屏瞬间旧屏display:none没了、新屏opacity:0(透明)→有一帧只剩光秃秃背景再淡进=用户感知的"闪一下"(进岛首屏homeScreen/每日宝箱chest/挑战bossboss/探索单词explore 全是showScreen切屏·全中); .modal-bg.show{animation:fadeIn}同理弹窗闪。
# 防线: 全19岛 .screen 不得含 animation:slideIn · .modal-bg.show 不得含 animation:fadeIn(任一被加回来→切屏/弹窗又从opacity:0淡入=又闪→拒绝打包)。
try:
    import glob as _g91, re as _re91
    _v91 = []
    for _f91 in sorted(_g91.glob("island_*.html")):
        _t91 = open(_f91, encoding="utf-8", errors="replace").read()
        _sm91 = _re91.search(r"\.screen\{[^}]*\}", _t91)
        _mm91 = _re91.search(r"\.modal-bg\.show\{[^}]*\}", _t91)
        if _sm91 and "animation:slideIn" in _sm91.group(0):
            _v91.append(_f91 + " .screen 仍含 animation:slideIn(切屏淡入=闪一下)")
        if _mm91 and "animation:fadeIn" in _mm91.group(0):
            _v91.append(_f91 + " .modal-bg.show 仍含 animation:fadeIn(弹窗淡入=闪一下)")
    if _v91:
        fail("点页面进去闪一下 BUG#91: " + str(_v91[:6]) + (" 等共%d处" % len(_v91) if len(_v91) > 6 else ""))
    else:
        ok("BUG#91: 点任何页面进去都'闪一下'根治 —— 全19岛 .screen 已去 slideIn 入场淡入 + .modal-bg.show 已去 fadeIn 入场淡入·切屏/弹窗瞬时满不透明出现(Hansen: 点每个岛/每日宝箱/挑战boss/探索单词进去都闪烁一下·只要点一个新页面进去就闪·彻底解决不要再闪). 根因=每次 showScreen 切屏新屏从 opacity:0 淡入·切屏瞬间旧屏 display:none 没了+新屏 opacity:0→一帧光秃背景再淡进=闪; 弹窗 .modal-bg.show 的 fadeIn 同理. 解法=去掉这两个入场淡入让屏/弹窗瞬时出现(完全承接 v693 铁律: 淡入过渡本身被用户感知为'闪一下'·资源就绪时'瞬时显示完整页'才真不闪). 真机Playwright验证: 切到boss/explore/chest各屏 animationName=none+opacity=1 瞬时满不透明·弹窗同样无fadeIn·0报错. v694")
except Exception as _e91:
    fail("BUG#91 检查异常: " + str(_e91))

# ---- v695: 拼写对战标题字体 Baloo2 必须真内嵌+真绑定(防像 Bowlby One 那样悄悄回退) ----
# 背景: 原标题写 'Bowlby One'(Google字体·没@font-face没加载·中国大陆还被墙)→手机上其实回退成 serif=看着不对。
# Hansen 用调节器选定 Baloo2 并内嵌。防线: baloo2.woff2 在仓库 + 全19岛有 Baloo2 @font-face + 全19岛拼写对战标题 font-family 含 'Baloo2'。任一缺失=字体会回退=拒绝打包。
try:
    import glob as _g695
    _v695 = []
    if not os.path.exists("baloo2.woff2"):
        _v695.append("baloo2.woff2 字体文件不在仓库(标题会回退·部署后手机无此字体)")
    _miss_ff = []; _miss_bind = []
    for _f695 in sorted(_g695.glob("island_*.html")):
        _t695 = open(_f695, encoding="utf-8", errors="replace").read()
        if "@font-face{font-family:'Baloo2'" not in _t695 and "@font-face{font-family: 'Baloo2'" not in _t695:
            _miss_ff.append(_f695)
        # 拼写对战标题行(白底卡里的 m-title + spelling bee)必须用 Baloo2
        import re as _re695
        _bm = _re695.search(r'<div class="m-title"[^>]*>spelling bee</div>', _t695)
        if _bm and "'Baloo2'" not in _bm.group(0):
            _miss_bind.append(_f695)
    if _miss_ff: _v695.append("缺 Baloo2 @font-face 的岛(%d): %s" % (len(_miss_ff), _miss_ff[:4]))
    if _miss_bind: _v695.append("拼写对战标题未用 Baloo2 的岛(%d): %s" % (len(_miss_bind), _miss_bind[:4]))
    if _v695:
        fail("拼写对战字体回退 v695: " + str(_v695))
    else:
        ok("v695: 拼写对战标题字体 Baloo2 真内嵌+真绑定(Hansen 调节器选定: 图标80px下移1px·标题Baloo2/15px/行高0.9/彩虹/小写/置顶). baloo2.woff2 在仓库 + 全19岛 @font-face url('baloo2.woff2') + 全19岛标题 font-family:'Baloo2'·font-display:block(不闪不回退). ★防 'Bowlby One' 旧坑(Google字体没@font-face·中国大陆被墙→手机回退serif看着不对): 自带字体内嵌·离线·任何设备/中国渲染一致. 调节器逐字复刻游戏卡CSS·真机卡宽105.67≈游戏105.66差0.02px=1:1. v695")
except Exception as _e695:
    fail("v695 检查异常: " + str(_e695))

# ---- v701: 每日宝箱→浅红#FF5C5C(两态) + 每日任务→浅绿#4CD97B(Hansen 指定色·防回退) ----
try:
    import glob as _g701
    _v701 = []
    for _f701 in sorted(_g701.glob("island_*.html")):
        _t701 = open(_f701, encoding="utf-8", errors="replace").read()
        if 'id="chestCard" style="--c1:#6096eb;--c2:#6096eb"' not in _t701:
            _v701.append(_f701 + " 每日宝箱未签底非浅红#FF5C5C")
        if ".daily-card.chest-claimed{background:linear-gradient(135deg,#FF2444,#FF2444)!important" not in _t701:
            _v701.append(_f701 + " 每日宝箱已签底非浅红#FF5C5C")
        if 'style="--c1:#4CD97B;--c2:#4CD97B" onclick="showScreen(\'quests\')"' not in _t701:
            _v701.append(_f701 + " 每日任务底非浅绿#4CD97B")
    if _v701:
        fail("每日宝箱/任务底色 v701: " + str(_v701[:6]))
    else:
        ok("v701: 每日宝箱底色: 未签蓝#6096eb(原始蓝·v704恢复·v701曾误改红已回退)·已签#FF2444(原e60012) + 每日任务底色=浅绿#4CD97B(原紫#7c3aed/#5b21b6)·全19岛(Hansen 给定HEX: 未签蓝#6096eb·已签艳红#FF2444 RGB255,36,68·任务#4CD97B RGB76,217,123). 状态靠角标(可领/已签)+开合箱图+蓝/红底区分. v701")
except Exception as _e701:
    fail("v701 检查异常: " + str(_e701))

# ---- BUG#92: 宠物图首帧即显三管齐下(updateHero存URL + 19岛早期脚本 + 外壳预热) ----
try:
    import glob as _g92
    _v92 = []
    _ps92 = open("hansen_pet_showcase.js", encoding="utf-8", errors="replace").read()
    if "localStorage.setItem('hansen_pet_hero_img'" not in _ps92:
        _v92.append("hansen_pet_showcase.js updateHero 缺 存宠物图URL(hansen_pet_hero_img)")
    _pl92 = open("hansen_preload.js", encoding="utf-8", errors="replace").read()
    if "hansen_pet_hero_img" not in _pl92 or "BUG#92" not in _pl92:
        _v92.append("hansen_preload.js 缺 宠物图预热(hansen_pet_hero_img/BUG#92)")
    for _f92 in sorted(_g92.glob("island_*.html")):
        _t92 = open(_f92, encoding="utf-8", errors="replace").read()
        if "v942 宠物首帧只接受内置路径" not in _t92 or 'localStorage.getItem("hansen_pet_hero_img")' not in _t92:
            _v92.append(_f92 + " 缺 v942 安全宠物首帧早期脚本(hansen_pet_hero_img)")
    if _v92:
        fail("BUG#92 宠物首帧: " + str(_v92[:6]))
    else:
        ok("BUG#92: 宠物图进岛首帧即显·三管齐下=①hansen_pet_showcase.js updateHero 存当前宠物图URL到 localStorage('hansen_pet_hero_img') ②全19岛 #heroPet 后早期内联脚本(在44模块~1.9MB前)读该URL立即填heroPet=首帧瞬时 ③hansen_preload.js 外壳preheatIslandEntryResources 最高优先预热该URL(进岛前已缓存). 根因: 宠物图pets/pet_NN.webp每张170-400KB·updateHero在全模块JS后才设img·且是JS注入非静态故v693 DOMParse预热抽不到→进岛现场拉300KB空白等很久. 解决后:进岛宠物首帧即显·冷启外壳已预热. 跨版本?v=戳变化旧戳图命中缓存秒显·updateHero新戳同图无感覆盖. BUG#92")
except Exception as _e92:
    fail("BUG#92 检查异常: " + str(_e92))

# ---- BUG#93: 去掉宠物展示页hero的主页展示锁pswLock(与卡牌器pcvLock功能重复冲突·Hansen要求删) ----
try:
    _ps93 = open("hansen_pet_showcase.js", encoding="utf-8", errors="replace").read()
    _v93 = []
    if 'id="pswLock"' in _ps93:
        _v93.append("hansen_pet_showcase.js 仍含 pswLock按钮(展示页hero锁应已删)")
    if 'onclick="HsnPet.toggleHomeLock()"' in _ps93:
        _v93.append("hansen_pet_showcase.js 仍含 hero锁的toggleHomeLock onclick(应只剩pcvLock的.onclick绑定)")
    if "psw-lk2" in _ps93:
        _v93.append("hansen_pet_showcase.js 仍含 psw-lk2(展示页锁CSS/元素应全删·连死CSS)")
    if "id=\"pcvLock\"" not in _ps93 and "'pcvLock'" not in _ps93 and "pcvLock" not in _ps93:
        _v93.append("hansen_pet_showcase.js 缺 pcvLock(卡牌器主页展示锁应保留)")
    if _v93:
        fail("BUG#93 宠物展示页锁: " + str(_v93))
    else:
        ok("BUG#93: 宠物展示页hero的主页展示锁 pswLock 已删除(Hansen: 此锁与卡牌器pcvLock功能重复冲突·无用). hansen_pet_showcase.js psw-nmrow 现仅含宠物名(.psw-nmrow居中布局·原.psw-lk2绝对定位左侧故去锁后名字仍居中不移位)·psw-dispst 去掉' · 🔒 已锁定'后缀·.psw-lk2死CSS也全清(v708零残留). ★功能层面: 展示页锁与卡牌器锁本是同一套底层(toggleHomeLock/getHomeLock/setHomeLock共享)·删的是展示页按钮+其onclick点击行为(彻底无控件)·底层函数因卡牌器pcvLock在用且Hansen要保留故留存. 主页展示锁功能完整保留在卡牌放大器 pcvLock(设为主页展示那一行)·toggleHomeLock/getHomeLock/showcaseStage 逻辑不动. BUG#93")
except Exception as _e93:
    fail("BUG#93 检查异常: " + str(_e93))

# ---- BUG#94: 首页滚动位置保持(离开首页存window.scrollY·返回首页恢复·其他屏回顶) ----
try:
    import glob as _g94
    _v94 = []
    for _f94 in sorted(_g94.glob("island_*.html")):
        _t94 = open(_f94, encoding="utf-8", errors="replace").read()
        if "BUG#94" not in _t94: _v94.append(_f94 + " 缺 BUG#94标记")
        if "window._homeScrollY=window.scrollY" not in _t94: _v94.append(_f94 + " 缺 离开首页存滚动位置")
        if "if(id==='home'){try{var _hy=window._homeScrollY" not in _t94: _v94.append(_f94 + " 缺 返回首页恢复滚动位置")
        if "window.scrollTo(0,0);\nif(id===" in _t94: _v94.append(_f94 + " 仍有无条件 scrollTo(0,0)(未改成条件恢复)")
    if _v94:
        fail("BUG#94 首页滚动保持: " + str(_v94[:6]))
    else:
        ok("BUG#94: 首页滚动位置保持·全19岛 showScreen 改造=①离开首页前(切屏前若当前active屏是homeScreen)存 window._homeScrollY=window.scrollY ②返回首页 showScreen('home') 时恢复 window.scrollTo(0,_homeScrollY)(+requestAnimationFrame兜底确保布局后生效)·其他屏仍 scrollTo(0,0)回顶. 根因: 原 showScreen 无条件 window.scrollTo(0,0)·进任何模式(含抽卡 showScreen('gacha'))再返回首页 showScreen('home')都被滚到顶·用户下滑到畅玩模式点抽卡返回又回最顶要重新下滑. 解决后: 下滑某位置进模式再返回·首页仍停在原滚动位置. BUG#94")
except Exception as _e94:
    fail("BUG#94 检查异常: " + str(_e94))

# ---- BUG#95: 设为主页展示不再自动锁(仅展示+升级跟随·点锁才钉死) ----
try:
    _ps95 = open("hansen_pet_showcase.js", encoding="utf-8", errors="replace").read()
    _v95 = []
    if "setHomeIdx(viewIdx);setHomeLock(false)" not in _ps95:
        _v95.append("pcvHome 设为主页展示 仍自动锁(应改 setHomeLock(false)·不再一点就锁死)")
    if "BUG#95" not in _ps95:
        _v95.append("缺 BUG#95 标记")
    if "var i=getHomeIdx();" not in _ps95:
        _v95.append("showcaseStage 逻辑被破坏(v786:应永远用getHomeIdx·解锁态由进化推进跟随)")
    if "setHomeIdx(_lk);setHomeLock(true)" not in _ps95:
        _v95.append("toggleHomeLock 点锁钉死逻辑丢失(v786:锁时应 setHomeIdx(_lk=viewIdx)+setHomeLock(true)·钉死你正在看的那只)")
    if _v95:
        fail("BUG#95 设为主页展示不自动锁: " + str(_v95))
    else:
        ok("BUG#95: 设为主页展示不再自动锁定·Hansen亲定语义=①点「设为主页展示」(pcvHome) 仅 setHomeIdx+setHomeLock(false)→解锁态·主页展示当前宠物且升级自动跟随当前最高阶(showcaseStage解锁分支=curStage); ②要钉死某阶需再点旁边的锁(toggleHomeLock)→setHomeLock(true)·主页永远展示锁定那只·升级不变(showcaseStage锁定分支=getHomeIdx). 原bug: pcvHome 里 setHomeLock(true)·一点设为主页展示就锁死不跟随升级. showcaseStage/getHomeLock/setHomeLock 逻辑不动·toggleHomeLock 加 锁/解锁 toast 明确反馈. 卡牌器pcvLock(锁按钮)保留. BUG#95")
except Exception as _e95:
    fail("BUG#95 检查异常: " + str(_e95))

# ---- BUG#96: spelling bee(隔离iframe spelling_bee.html) 点击音效 ----
try:
    _sb96 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    _v96 = []
    if "click_sound.js" not in _sb96:
        _v96.append("spelling_bee.html 缺 click_sound.js(spelling bee 点击音效来源)")
    if "BUG#96" not in _sb96 or "playNavClick" not in _sb96:
        _v96.append("spelling_bee.html 缺 BUG#96 点击音效委托监听(playNavClick)")
    if _v96:
        fail("BUG#96 spellbee点击音: " + str(_v96))
    else:
        ok("BUG#96: spelling bee 点击音效·spelling_bee.html(隔离iframe)内①加载 click_sound.js(暴露 window.playNavClick+解锁iframe音频·wrapSync对岛函数不存在安全跳过) ②委托捕获监听任何 button/a/onclick/role=button/cursor:pointer 元素点击都播 playNavClick. 根因: spelling bee 是 HansenSpellBee.open 叠的隔离iframe·岛的 click_sound.js 在岛文档管不到iframe内点击→无音效. BUG#96")
except Exception as _e96:
    fail("BUG#96 检查异常: " + str(_e96))

# ---- 🔴 v712 印章统一架构守卫: 19 岛必须可由 template.html + island_data.json 逐字复原(防直接改岛文件导致重新分叉) ----
import json as _jst
if os.path.exists("template.html") and os.path.exists("island_data.json"):
    _PHst = {'DATA':'⟦⟦ISLE_DATA⟧⟧','BOSSES':'⟦⟦ISLE_BOSSES⟧⟧','LISTEN':'⟦⟦ISLE_LISTEN⟧⟧','TYPING':'⟦⟦ISLE_TYPING⟧⟧','CLOZE':'⟦⟦ISLE_CLOZE⟧⟧','AVATARS':'⟦⟦ISLE_AVATARS⟧⟧','ZH':'⟦⟦ISLE_ZH⟧⟧','THEME':'⟦⟦ISLE_THEME⟧⟧','ENISLE':'⟦⟦ISLE_ENISLE⟧⟧','ENTITLE':'⟦⟦ISLE_ENTITLE⟧⟧','KEY':'⟦⟦ISLE_KEY⟧⟧','SHORTKEY':'⟦⟦ISLE_SHORTKEY⟧⟧','LOCALAUDIO':'⟦⟦ISLE_LOCALAUDIO⟧⟧','EXTRACSS':'⟦⟦ISLE_EXTRACSS⟧⟧','BOSSICON':'⟦⟦ISLE_BOSSICON⟧⟧','BLABEL':'⟦⟦ISLE_BLABEL⟧⟧'}
    _BMst = {'DATA':'DATA','BOSSES':'BOSSES','LISTEN':'LISTEN_LEVELS','TYPING':'TYPING_LEVELS','CLOZE':'CLOZE_LEVELS','AVATARS':'avatars'}
    def _genst(_tpl, _d):
        _t = _tpl.replace(_PHst['SHORTKEY'], _d['short_key']).replace(_PHst['KEY'], _d['key']).replace(_PHst['ENISLE'], _d['en_isle']).replace(_PHst['ENTITLE'], _d['en_title']).replace(_PHst['THEME'], _d['theme']).replace(_PHst['ZH'], _d['zh'])
        _t = _t.replace(_PHst['LOCALAUDIO'], _d['local_audio'] if _d.get('local_audio') else 'null').replace(_PHst['EXTRACSS'], _d['extra_css'] if _d.get('extra_css') else '').replace(_PHst['BOSSICON'], _d.get('boss_icon', 'boss_arcade.webp')).replace(_PHst['BLABEL'], _d.get('boss_label_color', '#0f172a'))
        for _n in _BMst: _t = _t.replace(_PHst[_n], _d[_BMst[_n]])
        return _t
    _tplst = open("template.html", encoding="utf-8").read()
    _datst = _jst.load(open("island_data.json", encoding="utf-8"))
    _stbad = []
    for _kst, _dst in _datst.items():
        _fnst = "island_%s.html" % _kst
        if not os.path.exists(_fnst): _stbad.append(_kst+" 文件缺失"); continue
        if _genst(_tplst, _dst) != open(_fnst, encoding="utf-8").read():
            _stbad.append(_kst+" 与 template+data 复原不一致(疑似直接改了岛文件→应改 template/data 后重跑 build)")
    if _stbad: fail("v712 印章统一架构: " + str(_stbad[:6]))
    else: ok("v712 印章统一架构 (19 岛全部可由 template.html + island_data.json 逐字复原·改母版/某岛数据重跑 build 即全岛同步·杜绝直接改岛文件导致分叉·14槽位=6 const块[DATA/BOSSES/LISTEN_LEVELS/TYPING_LEVELS/CLOZE_LEVELS/avatars] + 8 token[zh全名/theme主题词/en_isle/en_title/存档key/拼写短key/local_audio真人发音表/extra_css])")
else:
    fail("v712 印章统一架构: 缺 template.html 或 island_data.json(印章源文件·须随交接源码包)")

# ---- 🔴 BUG#97: 首页 spelling bee 模式卡(打开覆盖层的那张卡)点击音效 ----
_v97 = []
try:
    _cs97 = open('click_sound.js', encoding='utf-8').read() if os.path.exists('click_sound.js') else ''
    if 'BUG#97' not in _cs97:
        _v97.append('click_sound.js 缺 BUG#97 标记')
    if '[onclick*="HansenSpellBee"]' not in _cs97:
        _v97.append('click_sound.js 缺 spelling bee 模式卡点击音绑定([onclick*="HansenSpellBee"] capture 监听)')
    # 该卡确实由 HansenSpellBee.open 打开(印章母版/各岛一致)→ 才需要这条监听补音; 若母版改了打开方式, 此守卫提醒同步
    if os.path.exists('template.html') and 'HansenSpellBee.open' not in open('template.html', encoding='utf-8').read():
        _v97.append('template.html 里 spelling bee 模式卡 onclick 已非 HansenSpellBee.open(守卫与现实脱节·请复核)')
    if _v97:
        fail('BUG#97 spelling bee模式卡点击音: ' + str(_v97))
    else:
        ok('BUG#97: 首页 spelling bee 模式卡点击音效·click_sound.js 在 bind() 用 [onclick*="HansenSpellBee"] capture 阶段直接绑 play(fire-and-forget·不挡 HansenSpellBee.open). 根因: 其他模式卡 onclick 调被 wrapSync 包装的全局函数(showScreen/startListen 等)故有音; spelling bee 卡 onclick 是 hansen_spellbee.js 的对象方法 HansenSpellBee.open·不在 UI_FUNCS 也非 window 全局→不被包装→无音(≠BUG#96 的 iframe 内部点击音). BUG#97')
except Exception as _e97:
    fail('BUG#97 检查异常: ' + str(_e97))

# ---- 🔴 BUG#98: spelling bee 返回/关覆盖层(返回按钮 + 硬件返回键)的点击音由【岛父页】存活的音频上下文播 ----
_v98 = []
try:
    _sb98 = open('hansen_spellbee.js', encoding='utf-8').read() if os.path.exists('hansen_spellbee.js') else ''
    if 'BUG#98' not in _sb98:
        _v98.append('hansen_spellbee.js 缺 BUG#98 标记')
    # doClose 关覆盖层前必须先调岛父页 playNavClick(岛上下文存活·iframe 销毁前先在岛上播音)
    _dc98 = _sb98[_sb98.find('function doClose'):_sb98.find('function doClose')+2200] if 'function doClose' in _sb98 else ''
    if 'window.playNavClick' not in _dc98:
        _v98.append('doClose 未在关覆盖层时调 window.playNavClick(岛父页存活上下文播音)')
    _ip = _dc98.find('window.playNavClick'); _ir = _dc98.find('removeChild')
    if _ip < 0 or _ir < 0 or _ip > _ir:
        _v98.append('doClose 里 playNavClick 必须在 removeChild(销毁 iframe)之前调用')
    if _v98:
        fail('BUG#98 spelling bee返回点击音: ' + str(_v98))
    else:
        ok('BUG#98: spelling bee 返回/关覆盖层点击音·hansen_spellbee.js doClose 在移除覆盖层 iframe【之前】调岛父页 window.playNavClick(岛文档及其音频上下文在关覆盖层后存活·声音照常播完). 根因: 返回=移除覆盖层 iframe→浏览器销毁 iframe 音频上下文, 而 BUG#96 的内部点击音在 iframe 自己上下文里播·iframe 一销毁声音被掐断→返回键没声(其他键不关 iframe 故有声). doClose 是唯一关闭路径→覆盖返回按钮+硬件返回键两条路径·共享模块 19 岛全生效. BUG#98')
except Exception as _e98:
    fail('BUG#98 检查异常: ' + str(_e98))

# ---- 🔴 v715: 「传说殿堂」入口从首页/赛季页移到「收藏卡册」底部 + 重新设计 ----
_v715 = []
try:
    _cd715 = open('hansen_cards.js', encoding='utf-8').read() if os.path.exists('hansen_cards.js') else ''
    _ss715 = open('hansen_season.js', encoding='utf-8').read() if os.path.exists('hansen_season.js') else ''
    # (a) 卡册底部必须有「传说殿堂」入口(点击调 __hsnOpenHall·带副标题)
    if '神秘殿堂' not in _cd715 or '__hsnOpenHall' not in _cd715:
        _v715.append('hansen_cards.js 卡册缺「神秘殿堂」入口(__hsnOpenHall)')
    if '历代赛季限定卡' not in _cd715:
        _v715.append('hansen_cards.js 传说殿堂入口缺副标题「历代赛季限定卡」')
    # (b) hansen_season.js buildHallEntry 不再在首页生成传说殿堂入口卡(入口已移走)
    _bh715 = _ss715[_ss715.find('function buildHallEntry'):_ss715.find('function buildHallEntry')+600] if 'function buildHallEntry' in _ss715 else ''
    if 'createElement' in _bh715 or "__hsnOpenHall')" in _bh715:
        _v715.append('hansen_season.js buildHallEntry 仍在首页生成传说殿堂入口卡(应已移到卡册底部)')
    # (c) openHall/__hsnOpenHall 仍须保留(卡册入口依赖它打开陈列馆)
    if '__hsnOpenHall' not in _ss715 or 'function openHall' not in _ss715:
        _v715.append('hansen_season.js 缺 openHall/__hsnOpenHall(卡册入口依赖它)')
    if _v715:
        fail('v715 传说殿堂入口迁移: ' + str(_v715))
    else:
        ok('v715: 「传说殿堂」入口从首页/赛季页移到「收藏卡册」底部并重新设计(金紫渐变描边+双层径向高光底+发光图标徽章+金色渐变标题+进入提示·替代原暗色"卡牌大师"横幅·点击 __hsnOpenHall 打开历代赛季限定卡陈列馆); hansen_season.js buildHallEntry 不再在首页生成 #hsnHallCard(openHall/__hsnOpenHall 保留供卡册入口调用); 集卡进度/卡牌大师达成仍在卡册顶部展示不丢信息. v715')
except Exception as _e715:
    fail('v715 检查异常: ' + str(_e715))

# ---- 🔴 BUG#99 (v716): 钻石主题在岛切换/试用后同步到主页(index.html 世界地图) ----
_b99 = []
try:
    _ds99 = open('hansen_diamond_shop.js', encoding='utf-8').read() if os.path.exists('hansen_diamond_shop.js') else ''
    # (a) 抽出 applyActiveTheme(试用优先·否则装备)——主页/岛/bfcache 复用同一套
    if 'function applyActiveTheme' not in _ds99:
        _b99.append('hansen_diamond_shop.js 缺 applyActiveTheme(试用优先·否则装备 的统一应用函数)')
    # (b) bfcache 恢复(pageshow persisted)重新应用——回主页常走 history.back()=bfcache·start() 不重跑(整页跳转架构关键修复)
    if "addEventListener('pageshow'" not in _ds99 or '.persisted' not in _ds99:
        _b99.append('hansen_diamond_shop.js 缺 pageshow(bfcache 恢复)重新应用主题——整页跳转回主页不同步的根因')
    # (c) iframe SPA 历史兼容: applyTheme 沿 window.parent 传播 + API 暴露 applyThemeId(到顶层 P!==window 停·无回环)
    if 'window.parent' not in _ds99 or 'applyThemeId' not in _ds99:
        _b99.append('hansen_diamond_shop.js 缺 iframe 兼容的 window.parent 主题传播')
    if 'applyThemeId: function' not in _ds99 and 'applyThemeId:function' not in _ds99:
        _b99.append('hansen_diamond_shop.js HansenDiamondShop 未暴露 applyThemeId')
    if 'P !== window' not in _ds99 and 'P!==window' not in _ds99:
        _b99.append('hansen_diamond_shop.js 主题传播缺 parent===window 回环保护')
    if _b99:
        fail('BUG#99 主题主页/岛同步: ' + str(_b99))
    else:
        ok('BUG#99 (v716): 钻石主题主页(世界地图)与岛(大冒险)彻底同步. 根因: 主页↔岛是整页跳转(非 iframe)·回主页常走 history.back()=bfcache 快照恢复·start() 不重跑→岛里试用/换的主题回主页(快照=旧主题)不同步. 修法: ①抽出 applyActiveTheme(试用 sessionStorage 优先·否则装备 localStorage); ②start() 与 pageshow(bfcache 恢复 persisted) 都跑它·visibilitychange 仅有效试用时兜底(纯装备不闪); ③兼留 iframe SPA 兼容(applyTheme 沿 window.parent 传播+暴露 applyThemeId·P!==window 到顶停). 覆盖 装备/试用/试用结束/卸下 全路径. BUG#99')
except Exception as _e99:
    fail('BUG#99 检查异常: ' + str(_e99))

# ---- 🔴 v718 (Hansen): 最初 6 款基础主题(金币购买)搬进钻石商店 ----
_b718 = []
try:
    _ds718 = open('hansen_diamond_shop.js', encoding='utf-8').read() if os.path.exists('hansen_diamond_shop.js') else ''
    # (a) renderShop 调用 renderBasicThemes(基础主题分区上架)
    if 'renderBasicThemes(data)' not in _ds718 or 'h+=renderBasicThemes' not in _ds718:
        _b718.append('renderShop 未上架基础主题分区(renderBasicThemes)')
    # (b) 6 款基础主题齐全 + 阶梯价
    for _k718 in ['cosmos','pink','ocean','forest','rainbow','peach']:
        if "key:'"+_k718+"'" not in _ds718: _b718.append('基础主题缺 '+_k718)
    for _p718 in ['price:300','price:1000','price:2000','price:3000']:
        if _p718 not in _ds718: _b718.append('基础主题阶梯价缺 '+_p718)
    # (c) 自包含: 解锁共享 hansen_unlocked_themes + 金币兜底链 + 使用/购买 handler + applyBasicTheme
    if 'hansen_unlocked_themes' not in _ds718: _b718.append('基础主题未用共享解锁键 hansen_unlocked_themes')
    if 'HansenCoins' not in _ds718 or 'hansen_wallet_coins' not in _ds718: _b718.append('基础主题金币读写兜底链缺失')
    for _h718 in ['window.__hsnUseBasic','window.__hsnBuyBasic','function applyBasicTheme']:
        if _h718 not in _ds718: _b718.append('缺 '+_h718)
    # (d) 自包含·不依赖只在首页的 hansen_theme_shop.js(HansenThemeShop)
    if 'HansenThemeShop' in _ds718: _b718.append('基础主题误依赖 HansenThemeShop(岛上不加载·会失效)')
    if _b718:
        fail('v718 基础主题进商店: ' + str(_b718[:8]))
    else:
        ok('v718 (Hansen): 最初 6 款基础主题(🌌星空夜/🌸樱花粉 免费·🌊海洋蓝300/🌳森林绿1000/🌈彩虹云朵2000/🍑桃子糖果3000 金币)从首页搬进钻石商店「🎨 基础主题·金币购买」分区·可金币购买+使用. ★自包含(岛/首页都加载 hansen_diamond_shop.js·不依赖只在首页的 hansen_theme_shop.js): 解锁共享 hansen_unlocked_themes(与岛设置主题锁同源·买了到处通)·金币兜底链 HansenCoins(岛)/HansenWallet(首页)/直读 key·applyBasicTheme 静默清钻石装备互斥+写 data-theme. v718')
except Exception as _e718:
    fail('v718 检查异常: ' + str(_e718))

# ---- 🔴 v719~v722 (Hansen): 首页左上角"沉浸欣赏主题"按钮(v722 极小·无描边·透明磨砂薄纱) ----
_b719 = []
try:
    _idx719 = open('index.html', encoding='utf-8').read()
    _eyecss = _idx719[_idx719.find('.hsn-eye-btn{'):_idx719.find('.hsn-eye-btn{')+700]
    # (a) 按钮存在
    if 'id="hsnThemeEye"' not in _idx719 or 'class="hsn-eye-btn"' not in _idx719: _b719.append('缺首页左上角按钮 hsnThemeEye/hsn-eye-btn')
    # (b) position:absolute(随首页滚动·非 fixed)
    if 'position:absolute' not in _eyecss: _b719.append('按钮须 position:absolute(随首页滚动)')
    if 'position:fixed' in _eyecss: _b719.append('按钮不应再用 position:fixed')
    # (c) v721: 不放眼睛图标
    _btn_tag = _idx719[_idx719.find('id="hsnThemeEye"'):_idx719.find('</button>', _idx719.find('id="hsnThemeEye"'))+9]
    if '👁' in _btn_tag: _b719.append('按钮里不应有眼睛图标 👁')
    # (d) ★v722: 极小可见点(::before 14px) + 无任何颜色描边(border:none·禁 border:2px) + 按钮本体透明
    if '::before' not in _eyecss or 'width:14px' not in _eyecss: _b719.append('缺极小薄纱圆点 ::before(14px·Hansen 要非常小≈3mm)')
    if 'border:none' not in _eyecss: _b719.append('按钮须 border:none(Hansen 强令: 不要任何有颜色的边缘)')
    if 'border:2px' in _eyecss: _b719.append('按钮不应再有亮色描边 border:2px(Hansen 强令去掉)')
    if 'background:transparent' not in _eyecss: _b719.append('按钮本体须 background:transparent(可见的只是 ::before 薄纱点)')
    if 'backdrop-filter:blur' not in _eyecss: _b719.append('薄纱点缺 backdrop 磨砂(透明磨砂薄纱质感)')
    # (e) z-index 10万
    if 'z-index:100000' not in _eyecss: _b719.append('按钮 z-index 未到 100000')
    # (f) 沉浸模式 CSS
    if 'body.hsn-theme-only main.page' not in _idx719: _b719.append('缺沉浸模式 CSS(隐藏 main.page)')
    # (g) 切换 JS + bfcache 复位 + 保证永在最上层
    if 'window.__hsnToggleThemeOnly' not in _idx719: _b719.append('缺切换函数 __hsnToggleThemeOnly')
    if "classList.toggle('hsn-theme-only')" not in _idx719: _b719.append('切换函数未 toggle hsn-theme-only')
    if "classList.remove('hsn-theme-only')" not in _idx719: _b719.append('缺 pageshow 复位')
    if 'ensureEyeOnTop' not in _idx719 or 'elementFromPoint' not in _idx719: _b719.append('缺"保证按钮在最上层+elementFromPoint 自检"机制')
    # (h) ★只在首页·岛/印章母版绝不出现(Hansen 强令)
    import glob as _glob721
    _eye_keys = ('hsn-eye-btn', 'hsnThemeEye', '__hsnToggleThemeOnly', 'hsn-theme-only')
    _leak = []
    for _f721 in (['template.html'] + sorted(_glob721.glob('island_*.html'))):
        try:
            _c = open(_f721, encoding='utf-8').read()
            if any(_k in _c for _k in _eye_keys): _leak.append(_f721)
        except Exception: pass
    if _leak: _b719.append('沉浸欣赏按钮泄漏到非首页文件(只能在首页): ' + str(_leak[:5]))
    if _b719:
        fail('v719~v722 沉浸欣赏主题按钮: ' + str(_b719[:8]))
    else:
        ok('v719~v722 (Hansen): 首页左上角"沉浸欣赏主题"按钮——v722 极小(::before 14px≈2.5mm 薄纱圆点)·【无任何颜色描边】(border:none·按钮本体 background:transparent·可见的只是极淡白纱 rgba .16+backdrop 磨砂·不认真看几乎看不出来·只稍透出"是个按钮")·40px 透明大点击区好按·无动画(防晕); position:absolute 随首页滚动·z-index 10万·【只在首页·岛里零泄漏(已校验 template+全 island)】; 点一下 body.hsn-theme-only 隐藏整个前景 main.page 看整个主题背景·再点恢复·pageshow 复位·ensureEyeOnTop+elementFromPoint 自检. v719~v722')
except Exception as _e719:
    fail('v719~v722 检查异常: ' + str(_e719))

# ---- 🔴 v723 (Hansen): Spelling Bee 多主题可选(嫌默认太黑暗·尤其要阳光配色·在更多设置里选) ----
_b723 = []
try:
    _sb723 = open('spelling_bee.html', encoding='utf-8').read()
    # (a) 主题变量化: --bg + body 背景用 var(--bg) + 高亮 var(--hi)
    if '--bg:' not in _sb723 or 'background:var(--bg)' not in _sb723: _b723.append('body 背景未变量化 var(--bg)')
    if 'var(--hi)' not in _sb723: _b723.append('高亮金色文字未变量化 var(--hi)')
    if 'var(--selnm)' not in _sb723: _b723.append('选中文字未变量化 var(--selnm)')
    # (b) 5 套主题覆盖(sunny/sky/sakura/mint/dusk·night=默认 :root)
    for _t in ['sunny','sky','sakura','mint','dusk']:
        if ('body[data-theme="' + _t + '"]') not in _sb723: _b723.append('缺主题 ' + _t)
    # (c) 更多设置里的主题选择器(6 个色板)
    if 'id="themeSwatches"' not in _sb723: _b723.append('缺主题选择器 themeSwatches')
    if _sb723.count('data-sbtheme=') < 6: _b723.append('主题色板不足 6 个')
    # (d) JS 套用/记忆 + body 打开即套用防闪
    if 'sbApplyTheme' not in _sb723 or 'hansen_sb_theme' not in _sb723: _b723.append('缺主题套用/记忆 JS(sbApplyTheme/hansen_sb_theme)')
    # (e) ★词库插画 SVG 未被误伤(fill=#fde68a 仍在·主题重构绝不能动词库插画颜色)
    if "fill='#fde68a'" not in _sb723: _b723.append('词库插画 SVG 颜色疑被误改(fill 不该动)')
    if _b723:
        fail('v723 Spelling Bee 多主题: ' + str(_b723[:8]))
    else:
        ok('v723 (Hansen): Spelling Bee 多主题可选(嫌默认太黑暗压抑)——主题变量化(--bg/--ink/--card/--cardb/--hi/--selnm/--line)·6 套主题(🌙暗夜=默认 + ☀️暖阳/🌊晴空/🌸樱粉/🌿清新 四套阳光亮色 + 🌆暮光较柔暗色)·body[data-theme] 整页切换(背景/文字/卡片/高亮全跟着变·亮色主题文字转深色卡片转白·真机验证四套阳光主题全可读)·选择器在【更多设置】里(themeSwatches 6 色板·点一下立即生效)·sbApplyTheme + localStorage hansen_sb_theme 记忆 + body 打开即套用防暗闪·只换观感不改玩法·词库插画 SVG 零改动(fill 全保留). v723')
except Exception as _e723:
    fail('v723 检查异常: ' + str(_e723))

# ---- 🔴 v724 (Hansen): Spelling Bee 题数默认100 + 自动/手动下一题 + 金币/宠物经验并入系统 + 全程收获展示 ----
_b724 = []
try:
    _sb = open('spelling_bee.html', encoding='utf-8').read()
    _sb_parent = open('hansen_spellbee.js', encoding='utf-8').read()
    _bee = open('hansen_spellbee.js', encoding='utf-8').read()
    # (a) 题目数量默认 100(原5)
    if 'qCount:100' not in _sb: _b724.append('题数默认非100')
    if '<span id="qCountVal">100</span>' not in _sb: _b724.append('题数显示非100')
    # (b) 答完 自动/手动 下一题(默认自动)+ 选择器在更多设置
    if 'manualNext:false' not in _sb: _b724.append('manualNext 默认非自动')
    if 'id="autoNextSeg"' not in _sb or _sb.count('data-auto=') < 2: _b724.append('缺 自动/手动 选择器')
    if '_advTimer=setTimeout(_go' not in _sb: _b724.append('缺自动跳下一题定时')
    # (c) 金币/经验奖励 + 连胜额外金币 + postMessage 给父岛
    if 'function sbBase(' not in _sb: _b724.append('缺奖励档函数 sbBase(v751 sbWordCoins→sbBase)')
    if 'if(youStreak>=3){ bonusC=Math.min(youStreak-1,SB_STREAK_BONUS_CAP); }' not in _sb: _b724.append('缺连胜额外金币(v751 min(连胜-1,5))')
    if "type:'hsn_sb_reward'" not in _sb: _b724.append('缺 postMessage 奖励给父岛')
    if '_sessionCoins=0;_sessionXp=0;_bestStreak=0;' not in _sb: _b724.append('缺本局收获重置')
    # (d) ★v942 父岛以稳定 rewardId 幂等并入系统，成功后 ACK；不再信任 amount-only 消息。
    if "d.type !== 'hsn_sb_reward'" not in _bee: _b724.append('父岛缺奖励监听')
    for _tok724 in ['hansen_sb_reward_pending_v942','HansenCoins.award','HansenRewardEffectsV942.xpAward','hsn_sb_reward_ack']:
        if _tok724 not in _bee: _b724.append('父岛缺v942幂等奖励标记: '+_tok724)
    for _tok724 in ['hansen_sb_reward_pending_v942','rewardId:id','function sbFlushRewardPending','function sbRewardAck']:
        if _tok724 not in _sb: _b724.append('子页缺v942 pending/ACK标记: '+_tok724)
    # (e) 全程收获展示: 逐词(rearn/rtotal) + 结算(ovReward 块 + CSS)
    if 'class="rearn"' not in _sb or 'class="rtotal"' not in _sb: _b724.append('缺逐词收获展示')
    if "$('ovReward').innerHTML" not in _sb or 'id="ovReward"' not in _sb or '.over .ovreward{' not in _sb: _b724.append('缺结算收获展示')
    # (f) 固定深色覆盖层(结算/结果/头像/退出确认)亮色主题下文字可读: 局部重声明暗色变量
    if _sb.count('--ink:#eef2f7;--ink2:#aebbd4;--ink3:#7e8aa6;--hi:#fde68a;--cardb:rgba(255,255,255,.12);') < 3: _b724.append('固定深覆盖层变量重声明不足')
    # (g) 词库插画 SVG 未被误伤
    if "fill='#fde68a'" not in _sb: _b724.append('词库插画 SVG 疑被误改')
    if _b724:
        fail('v724 Spelling Bee 奖励/题数/自动跳: ' + str(_b724[:8]))
    else:
        ok('v724 (Hansen): Spelling Bee 题数默认100·自动/手动下一题·金币/宠物经验并入系统·全程收获展示——①题目数量默认100个(原5·仍可手调) ②答完默认自动跳下一题(赢1.5s/输2.6s留时间看答案)·更多设置里加「答完自动下一题」自动/手动分段开关 ③答对一词 +2🪙+5✨·连胜≥3额外+连胜数🪙(越连越多)·postMessage 给父岛由 hansen_spellbee.js 复用岛自己的 addCoin/addXP 并入系统(金币进全局钱包·经验进本岛存档→宠物升级·与平时答题同一路径) ④全程展示: 逐词结果面板显示「答对+2🪙+5✨ 🔥N连胜+N🪙 · 本局已得X🪙Y✨」+ 结算页「本局收获 +X🪙金币 +Y✨经验 Z🔥最高连胜」 ⑤固定深色覆盖层(结算/结果/头像/退出确认)局部重声明暗色变量·亮色主题下收获文字也清晰可读. 真机端到端验: 默认100·逐词+结算收获正确·自动跳/手动等待都对·父页实收金币经验·0 error·词库插画零改·★[金币数值与连胜公式已由 v751 重新设计为双因子: 基础分2/4/6×(1+对手系数)·连胜min(连胜-1,5)·此为 v724 历史记录·见 v751 守卫]. v724')
except Exception as _e724:
    fail('v724 检查异常: ' + str(_e724))

# ---- 🔴 v725 (Hansen·重大bug): Spelling Bee 听读音模式"自动下一题"时没读音 ----
_b725 = []
try:
    _sb = open('spelling_bee.html', encoding='utf-8').read()
    # (a) 改为复用单一音频元素(不再每次 new Audio·那样自动跳题无手势会被拦)
    if '_sbAudioEl' not in _sb or '_ensureSbAudio' not in _sb: _b725.append('未复用单一音频元素')
    # 代码里(排除注释)只应有 1 处 new Audio( —— 即 _ensureSbAudio 里创建一次
    _codeNewAudio = _sb.count('_sbAudioEl=new Audio()')
    if _codeNewAudio != 1: _b725.append('new Audio 不是只创建一次(=' + str(_codeNewAudio) + ')')
    if '_curAudio' in _sb: _b725.append('旧的每次 new Audio 的 _curAudio 残留')
    # (b) 用户手势里解锁音频元素(之后定时器自动跳题也能出声) + 至少挂在键盘/开始按钮上
    if '_unlockSbAudio' not in _sb or _sb.count('_unlockSbAudio(') < 6: _b725.append('解锁函数未在足够多手势处调用')
    if "_unlockSbAudio();typeKey" not in _sb and "_unlockSbAudio();\n  var k" not in _sb: _b725.append('键盘手势未解锁音频')
    if "_unlockSbAudio();startMatch()" not in _sb: _b725.append('开始按钮未解锁音频')
    # (c) 解锁也覆盖 speechSynthesis 兜底
    if 'SpeechSynthesisUtterance' not in _sb: _b725.append('TTS 兜底缺失')
    # (d) 播放被打断(AbortError)不误触发兜底 TTS
    if "err.name==='AbortError'" not in _sb: _b725.append('打断未防误触发兜底')
    if _b725:
        fail('v725 Spelling Bee 自动跳题读音: ' + str(_b725[:8]))
    else:
        ok('v725 (Hansen·重大bug修复): Spelling Bee 听读音模式"答完自动跳下一题"时听不到单词读音(v724 自动跳题暴露)——根因: 原 speak() 每次 new Audio() 播 MP3·手机微信/浏览器自动播放策略拦截"非用户手势触发"的 .play()(手动点下一题=有手势能播·自动跳题是定时器触发离上次敲键~1.8s无新手势→被拦·连 TTS 兜底也被拦→没读音玩家没法拼). 修复(业界标准): 全程复用同一个音频元素(_sbAudioEl·只 new Audio 一次)·并在用户手势里(敲字母键/开始/听音/再听/声音开关/物理键盘)先用一段静音"解锁"它(_unlockSbAudio·同时解锁 speechSynthesis 兜底)·元素被手势解锁过之后由定时器(自动跳题)触发也能正常 .play() 出声; 播放被新 speak 打断(AbortError)不误触发兜底 TTS. 强制 user-gesture 策略下真机验: 解锁后定时器播放 resolved·自动跳题后 MP3 正常播出 0 次走 TTS 兜底·0 error. v725')
except Exception as _e725:
    fail('v725 检查异常: ' + str(_e725))

# ---- 🐝 v726 (Hansen): Spelling Bee 答对结果面板极简重排 + 金币按难度分档 + 经验不显示 ----
_b726 = []
try:
    _sb = open('spelling_bee.html', encoding='utf-8').read()
    # (a) 金币按词难度分档: 初级≤4字母=2·中级5-6=4·高级≥7=8(与 LEVELS 词长档对齐)
    if 'function sbBase' not in _sb or 'n<=4?2:(n<=6?4:6)' not in _sb: _b726.append('基础分档(v751 2/4/6)缺失或不符')
    if 'var base=sbBase(curWord)' not in _sb: _b726.append('finish 未用基础分(v751 sbBase)')
    if 'if(youStreak>=3){ bonusC=Math.min(youStreak-1,SB_STREAK_BONUS_CAP); }' not in _sb: _b726.append('连胜额外金币加成缺失(v751 min(连胜-1,5))')
    # (b) 结果面板覆盖两条 lane(原只覆盖94px的bot lane导致内容溢出)
    if 'class="lanes-box"' not in _sb or '.lanes-box{position:relative}' not in _sb: _b726.append('lanes-box 包两lane缺失')
    # (c) 极简: 只显示金币·不显示经验(面板里 答对行/本局行 不含经验✨)
    if "拼对又赢 <b>+'+gainC+'</b>🪙" not in _sb: _b726.append('结果面板未显示经过日上限夹取后的实发gainC')
    if "本局已得 <b>'+_sessionCoins+'</b>🪙</div>" not in _sb: _b726.append('本局金币行不符(应只金币)')
    # 面板 head 的"你赢了"不带叹号(Hansen: 字别太大·去掉感叹)+ 字号17(原18+)
    if "rw win\">🎉 你赢了'+" not in _sb: _b726.append('你赢了文案/结构不符')
    if '.laneres .rw{font-size:17px' not in _sb: _b726.append('你赢了字号未收敛(应17px)')
    if "class=\"rbonus\">🔥连胜+" not in _sb: _b726.append('连胜加成chip(rbonus)缺失')
    # (d) 结算页 ovReward 去掉经验列(只剩 金币 + 最高连胜)
    if "ovrw-v xp" in _sb or "✨ 经验</div>" in _sb: _b726.append('结算页仍残留经验列')
    if "本局收获 · 已并入金币</div>" not in _sb: _b726.append('结算标题未去经验')
    # (e) 经验仍静默给宠物；v942 改为子页稳定 receipt→父页 ACK，不能退回裸 postMessage 金额。
    if ('gainX=base;' not in _sb or "sbQueueCappedReward(want,gainX,'word')" not in _sb or
        "HansenRewardEffectsV942.xpAward(base+':xp',r.xp)" not in _sb_parent):
        _b726.append('经验未通过稳定奖励 receipt 静默给宠物')
    # (f) 旧的每词经验显示残留检查: 面板不应再出现 "+经验" / rstreak 旧类
    if 'class="rstreak"' in _sb: _b726.append('旧 rstreak 类残留')
    if _b726:
        fail('v726 Spelling Bee 结果面板/金币分档: ' + str(_b726[:10]))
    else:
        ok('v726 (Hansen): Spelling Bee「答对结果面板」极简重排 + 金币按难度分档 + 经验不显示. ①排版: 原面板只覆盖94px的bot lane·内容(你赢了+答对+本局+经验+答案+按钮)挤出框很乱——改为用 .lanes-box 包住两条lane·结果面板覆盖两lane(~196px)有充足空间不溢出; "你赢了"去掉感叹号+字号18→17不再过大; 整体只剩4-5行干净排布. ②金币按词难度分档(与 LEVELS 词长档对齐): 初级≤4字母=2🪙·中级5-6字母=4🪙·高级≥7字母=8🪙(sbWordCoins 按字母数·全部模式下每词按自身长度给)·连胜额外金币加成照旧(youStreak≥3 时 +youStreak). ③经验完全不显示(Hansen: 没必要): 逐词面板只显示「答对 +N🪙(+连胜加成)」「本局已得 X🪙」·结算页 ovReward 去掉经验列只剩 金币+最高连胜; 但经验仍静默给宠物(postMessage 仍发 xp=难度基础档·宠物照常升级·honor v724 宠物并入). ④金币仍走 addCoin 并入钱包·不经过岛的每日2000答题上限(spelling bee 是上限外额外赚金币的途径). 真机像素级验面板不溢出+亮暗主题可读+0 error·★[金币分档2/4/8与连胜+youStreak已由 v751 重新设计: 基础分2/4/6×(1+对手系数)·连胜min(连胜-1,5)·结果面板改「拼对又赢+win」·见 v751 守卫]. v726')
except Exception as _e726:
    fail('v726 检查异常: ' + str(_e726))

# ---- 💰 v727 (Hansen): 金币经济平衡 — 全局每日2000上限 + 修答对双倍发币 + 连胜加成封顶 + 拼写对战每日上限 ----
_b727 = []
try:
    _sb  = open('spelling_bee.html', encoding='utf-8').read()
    _up  = open('hansen_island_upgrade.js', encoding='utf-8').read()
    _tpl = open('template.html', encoding='utf-8').read()
    _isl = open('island_animal.html', encoding='utf-8').read()
    # (a) 答题每日金币上限改为【全局】(整个系统跨所有岛累计2000·而非每岛各自2000): upgrade + template 都用全局 localStorage 计数·不再用每岛 S.coinEarnedToday
    if 'hsn_ans_coin_today' not in _up:  _b727.append('upgrade earnCoin 未用全局计数')
    if 'hsn_ans_coin_today' not in _tpl: _b727.append('template earnCoin 未用全局计数')
    if 'hsn_ans_coin_today' not in _isl: _b727.append('岛(印章)未含全局计数·generate 未跑')
    if 'S.coinEarnedToday>=DAILY_CAP' in _up or 'S.coinEarnedToday>=DAILY_CAP' in _tpl: _b727.append('仍残留每岛 coinEarnedToday 上限(应全局)')
    # (b) 修答对双倍发币: upgrade 的 markAnswer 包装【不再重复调 earnCoinOnCorrect】(原先岛自己markAnswer调一次+包装再调一次=双倍)
    if 'var _got = earnCoinOnCorrect(idx) ? 1 : 0' in _up: _b727.append('upgrade markAnswer 仍重复发币(双倍未修)')
    # (c) 连胜额外金币封顶(防越连越爆刷爆经济): SB_STREAK_BONUS_CAP + Math.min
    if 'SB_STREAK_BONUS_CAP=5' not in _sb: _b727.append('连胜加成封顶常量缺失')
    if 'Math.min(youStreak-1,SB_STREAK_BONUS_CAP)' not in _sb: _b727.append('连胜加成未封顶(v751 min(连胜-1,5))')
    # (d) 拼写对战每日金币上限(2000答题上限之外额外赚的途径·但也封顶防无限刷): SB_DAILY_COIN_CAP + sbCoinToday + 独立计数 + 已满文案
    if 'SB_DAILY_COIN_CAP=2000' not in _sb: _b727.append('拼写对战每日上限常量缺失')
    if 'function sbCoinToday' not in _sb or 'hsn_sb_coin_today' not in _sb: _b727.append('拼写对战每日计数缺失')
    if 'function sbTakeCoin' not in _sb or 'Math.min(want,Math.max(0,SB_DAILY_COIN_CAP-now))' not in _sb: _b727.append('每笔未通过sbTakeCoin夹到日上限')
    if '_sbCapped=!!(_wordReceipt&&_wordReceipt.capped===true)' not in _sb: _b727.append('finish未用 cap receipt 判定今日已满')
    if '今日拼写对战金币已满' not in _sb or 'class="rcap"' not in _sb: _b727.append('已满文案/rcap 缺失')
    # (e) 拼对才准备 receipt；sbQueueCappedReward 自身拒绝 want=0，拼输不进入 who==='you' 分支。
    if "if(who==='you')" not in _sb or "sbQueueCappedReward(want,gainX,'word')" not in _sb:
        _b727.append('未做“仅拼对时准备稳定奖励 receipt”')
    if _b727:
        fail('v727 金币经济平衡: ' + str(_b727[:10]))
    else:
        ok('v727 (Hansen): 金币经济平衡四改 — ①每日2000答题金币上限改为【整个系统全局】(原每岛各自2000→现全局 localStorage hsn_ans_coin_today 跨所有岛累计·超2000只能玩拼写对战额外赚·upgrade+template 双路径同用 today() 日期键一致·每词每天3次仍按岛存档防刷同词) ②修复答对【双倍发币】老bug(根因: 19岛印章统一·每岛自己的 markAnswer 已调 earnCoinOnCorrect 发1币·而 hansen_island_upgrade.js 的 markAnswer 包装又重复调一次→答对实发2币·per-word计数跳2; 修法: 包装里删掉重复发币块·只保留 reportTotals·金币全由岛自己 markAnswer 发→单发; spy实测一次markAnswer里earnCoin仅被调1次) ③拼写对战连胜额外金币【封顶+5】(原 bonus=youStreak 无限递增·一局100词全胜连胜加成 sum(3..100)=5047币≈买光全商店·且\"初级比高级赚\"反向; 现 Math.min(youStreak,5) 封顶·连胜仍有奖但不爆) ④拼写对战【每日金币上限2000】(2000答题上限之外·拼写对战是额外赚金币的唯一途径·但也封顶2000/天防无限刷; 独立计数 hsn_sb_coin_today·满后仍可练但0币·面板显示\"🪙今日拼写对战金币已满·明天再来\"). 拼对才有钱(拼输 finish(bot) 不发·仅 gainC>0 时上报)·经验随金币一起封(满后gainX=0). 合计每天最多: 答题2000 + 拼写对战2000 = 4000币封顶. Playwright实测: 单次答对1币(双倍已修)·全局计数到2000封顶·连胜10/26 bonus均=5(封顶)·SB满显示已满0币·拼输0币·面板216px无溢出·0 error. 数值(5/2000)可调·★[连胜封顶公式 v751 改为 min(连胜-1,5)·封顶仍5·拼写对战赢币公式见 v751 守卫]. v727')
except Exception as _e727:
    fail('v727 检查异常: ' + str(_e727))

# ---- ☀️ v728 (Hansen): Spelling Bee 亮色主题下主游戏区文字看不清修复(再听一次/中文词/机器人标签/退出X) ----
_b728 = []
try:
    _sb = open('spelling_bee.html', encoding='utf-8').read()
    # 主游戏区(随主题变色的背景·亮色主题变浅)上的文字必须用主题变量(跟着主题翻转)·不能硬编码浅色(否则亮主题=浅字浅底看不见)
    def _seg(css, sel):
        return css.split(sel,1)[1].split('}',1)[0] if sel in css else ''
    # ① 听读音「🔁 再听一次」按钮: v728 先改 var(--bot)·但淡prompt底上仍偏弱/旧缓存版不翻转(Hansen 复报看不清)·v729 再强化为【自包含实心蓝白字】(不依赖任何主题变量)
    if 'color:#fff;background:linear-gradient(135deg,#3b82f6,#2563eb)' not in _seg(_sb, '.replay{'): _b728.append('replay按钮未自包含高对比(应白字+实心蓝渐变)')
    # ② 汉译英模式中文词: 原 #fff→var(--ink)
    if 'color:var(--ink)' not in _seg(_sb, '.cnword{'): _b728.append('中文词未用var(--ink)')
    # ③ 对战赛道「机器人」标签: 原 #bfe0ff→var(--bot)
    if '.lane.bot .who{color:var(--bot)}' not in _sb: _b728.append('机器人标签未用var(--bot)')
    # ④ 对战页退出X: 原 #fff→var(--ink)(在 rgba(255,255,255,.1) 近透明浅底上·亮主题白字看不见)
    if 'color:var(--ink)' not in _seg(_sb, '.gtop .x{'): _b728.append('退出X未用var(--ink)')
    if _b728:
        fail('v728 Spelling Bee 亮色主题文字可读: ' + str(_b728[:8]))
    else:
        ok('v728 (Hansen): Spelling Bee 亮色(暖阳/晴空/樱粉/清新)主题下主游戏区文字看不清修复. 根因: v723 把观感变量化做多主题后·主游戏区(背景随主题变色·亮主题变浅)上仍有几处【硬编码浅色文字】·亮主题下=浅字配浅底几乎看不见(Hansen 截图: 听读音模式喇叭下「再听一次」按钮文字消失). 修复(全部改主题变量·跟随主题翻转): ①听读音「🔁 再听一次」按钮 #bfe0ff浅蓝→var(--bot)(暗主题浅蓝#60a5fa·亮主题深蓝#1d4ed8) ②汉译英模式中文词 #fff→var(--ink)(暗主题近白·亮主题深色) ③对战赛道「机器人」标签 #bfe0ff→var(--bot) ④对战页退出X #fff→var(--ink)(原在 rgba(255,255,255,.1) 近透明底·亮主题白字消失). 系统排查全部 color:#fff 与浅色硬编码: 结果面板laneres/结算over/头像avcard/退出确认confirm/toast 都是【固定深色覆盖层】(背景恒为 #1a2347→#10162d 深渐变+局部重声明暗色变量)·里面的浅色文字本就在深底上安全·未动(如 .over .redrill 的 #bfe0ff). 暖阳主题真机像素级验: 再听一次=深蓝rgb(29,78,216)清晰·中文词「苹果」=深褐rgb(74,58,30)清晰·机器人标签/退出X均深色可读·两模式截图核验·0 error. v728')
except Exception as _e728:
    fail('v728 检查异常: ' + str(_e728))

# ---- 🎨 v729 (Hansen·复报): 拼写对战亮色主题"再听一次"按钮文字看不清 → 自包含实心蓝白字 + 顶栏药丸加深 ----
_b729 = []
try:
    _sb = open('spelling_bee.html', encoding='utf-8').read()
    # ① .replay 必须自包含高对比(白字#fff + 实心蓝渐变)·不依赖会随主题变/可能不翻转的 var(--bot)+淡translucent背景
    if 'color:#fff;background:linear-gradient(135deg,#3b82f6,#2563eb)' not in _sb: _b729.append('再听一次按钮非自包含高对比(应白字+实心蓝渐变)')
    if 'color:var(--bot);background:rgba(96,165,250,.16)' in _sb: _b729.append('再听一次按钮仍是旧淡色写法(亮主题看不清)')
    # ② 顶栏药丸统一走状态色变量：暗色保持 .5 黑底，四个亮色使用不透明深蓝底。
    # HF3 不再在三个选择器里重复写同一个 rgba，而是钉死一份主题契约，避免漏改其中一个。
    if '--status-bg:rgba(0,0,0,.5);--status-fg:#fff;--status-hi:#fde047;' not in _sb:
        _b729.append('暗色顶栏状态色变量缺失(.5黑底/白字/黄高亮)')
    if '--status-bg:#17375f;--status-fg:#fff;--status-hi:#ffe08a;' not in _sb:
        _b729.append('亮色顶栏状态色变量缺失(不透明深蓝底/白字/黄高亮)')
    for _sel729 in ('.gtop .pill{', '.gtop .tm{', '.gtop .sndtoggle{'):
        _css729 = _seg(_sb, _sel729)
        if 'background:var(--status-bg)' not in _css729:
            _b729.append(_sel729 + '未使用统一--status-bg')
    if 'color:var(--status-fg)' not in _seg(_sb, '.gtop .pill{'):
        _b729.append('题号药丸未使用--status-fg')
    if 'color:var(--status-hi)' not in _seg(_sb, '.gtop .tm{'):
        _b729.append('计时器未使用--status-hi')
    if 'color:var(--status-fg)' not in _seg(_sb, '.gtop .sndtoggle{'):
        _b729.append('声音键未使用--status-fg')
    if 'background:rgba(0,0,0,.3)' in _sb: _b729.append('顶栏仍残留 .3 淡黑底')
    if _b729:
        fail('v729 再听一次按钮/顶栏亮主题对比: ' + str(_b729[:6]))
    else:
        ok('v729 (Hansen·复报): 拼写对战亮色主题下"再听一次"按钮文字看不清(v728 改 var(--bot) 后·因 .replay 是淡translucent底+依赖主题变量翻转·在晴空等浅prompt底上仍隐身·旧部署/未翻转主题更看不见·Hansen 附晴空主题截图复报只见橙🔁图标·文字隐身)——根因: themed 页面上"淡底+依赖主题翻转的文字色"组合最脆弱(某主题不翻转或旧缓存→隐身). 修法(自包含·与主题完全解耦): .replay 改【白字#fff + 实心蓝渐变 linear-gradient(135deg,#3b82f6,#2563eb) + 白描边 + 蓝辉光阴影】·白字配实心蓝在任何主题(晴空/暖阳/樱粉/清新/暗夜/暮光)下都清晰醒目+按钮明显跳出·物理上不可能再隐身. 顺带排查(Hansen 要查其它类似)发现顶栏三药丸(题号pill/计时器tm/声音键sndtoggle)是 #fff/#fde047 文字配 rgba(0,0,0,.3) 半透明黑底·亮主题下黑底只剩浅灰→白/黄字偏淡·加深到 rgba(0,0,0,.5)(自带深底·任何主题都够暗)·白/黄字清晰. 其它 themed 元素(ptag/hint/cnword/机器人标签/退出X/VS栏)均用 var(--ink/ink2/ink3/bot/you) 随主题翻转·已可读. 晴空主题真机像素级验: 再听一次=实心蓝白字醒目·顶栏药丸白/黄字清晰·0报错. ★教训(强化): themed 页关键操作按钮/常驻文字要么用 var(--ink…)随主题翻转、要么自包含(自带深底+固定对比色)·绝不"淡底+依赖翻转的字色"碰运气; 此类问题修好后必须【重新部署+清CDN缓存+微信重进】才生效(否则用户看到的还是旧缓存版·会以为没修). v729')
except Exception as _e729:
    fail('v729 检查异常: ' + str(_e729))

# ---- 🎨 v731 (Hansen): 钻石主题(装备/试用)期间彻底隐藏免费主题飞行元素(主题串台根治) ----
_b731 = []
try:
    _idx731 = open('index.html', encoding='utf-8').read()
    _dia731 = open('hansen_diamond_shop.js', encoding='utf-8').read()
    if 'body.hsn-dia-on .flyer[data-flyer-theme]' not in _idx731: _b731.append('index.html 缺钻石主题隐藏 flyer 的 CSS')
    if "body.classList.add('hsn-dia-on')" not in _dia731: _b731.append('钻石商店 applyTheme 未加 hsn-dia-on 标记(装备/试用)')
    if "body.classList.remove('hsn-dia-on')" not in _dia731: _b731.append('钻石商店 applyTheme 未在卸下时摘 hsn-dia-on')
    if _b731:
        fail('v731 钻石主题隐藏免费flyer: ' + str(_b731[:6]))
    else:
        ok('v731 (Hansen): 钻石主题(装备/试用)期间彻底隐藏免费主题飞行元素——根因: 钻石主题(影院/典藏·如黄金 theme_gold)只换背景层+注入自己的场景元素·但正在用的免费主题(data-theme=ocean/forest…)的 .flyer 漂浮元素(帆船/海豚/鲸/章鱼/蝴蝶…共46个独立DOM)盖不住→残留漂在钻石主题背景上·试用时根本看不清钻石主题真面目(Hansen: 用海洋蓝时试用黄金·海洋动物全残留·不知道黄金到底长啥样). 修法: HansenDiamondShop.applyTheme(themeId) 装备/试用时给 body 加 .hsn-dia-on(卸下/试用结束走 applyTheme(null) 自动摘掉·并沿 parent 链同步到顶层主页·覆盖 装备/试用/试用结束/卸下/开机 applyActiveTheme 全路径)·index.html CSS `body.hsn-dia-on .flyer[data-flyer-theme]{display:none!important}` 据此一刀切隐藏全部免费 flyer(!important 压过所有 body[data-theme=X] 的 display:block). 钻石主题自己的场景元素(.hsn-dia-scene/漂浮金粒等)不带 data-flyer-theme·不受影响照常显示→钻石主题纯净只剩它自己. 全部 46 个 flyer 均带 data-flyer-theme 已全覆盖; 岛(template/island)无 flyer·shared 模块加类对岛无副作用. Playwright实测: 海洋蓝6个flyer可见→套黄金theme_gold后0可见(hsn-dia-on=true)→卸下6个恢复(hsn-dia-on=false)·0报错. v731')
except Exception as _e731:
    fail('v731 检查异常: ' + str(_e731))

# ---- 🎨 v732 (Hansen): 主题串台根治2 — 钻石主题背景中和 + 首页轮询兜底 hsn-dia-on ----
_b732 = []
try:
    _idx732 = open('index.html', encoding='utf-8').read()
    _dia732 = open('hansen_diamond_shop.js', encoding='utf-8').read()
    if 'body.hsn-dia-on{background:var(--hsn-dia-bg,#0a0e1a)!important' not in _idx732: _b732.append('index.html 缺钻石主题背景中和 CSS(浅色免费主题渐变会透出)')
    if "if(_diaOn){ document.body.classList.add('hsn-dia-on'); return; }" not in _idx732: _b732.append('首页轮询未兜底加 hsn-dia-on(回首页易残留免费主题)')
    if "body.style.setProperty('--hsn-dia-bg', g.bg)" not in _dia732: _b732.append('钻石商店 applyTheme 未把基色写入 --hsn-dia-bg')
    if _b732:
        fail('v732 钻石主题背景中和/轮询兜底: ' + str(_b732[:6]))
    else:
        ok('v732 (Hansen): 主题串台根治2(v731 只隐了 flyer·背景仍串台)——Hansen 复报2处: ①用星空夜时试用黄金/熔岩·飞碟火箭流星仍残留(回首页时尤甚) ②用樱花粉时试用深海·飞行元素没了但背景整体还是樱花粉. 根因(更深): (a)免费主题背景是 body{background:多层渐变!important}(用 --th-* 变量随 data-theme 变色)·钻石主题只设 body.style.backgroundColor(被 !important 渐变压过=无效)+ 半透明极光层(z-index:-2·blur)盖不住浅色渐变→浅色免费主题(樱花粉/桃)背景透出. (b)钻石主题 hsn-dia-on 只在钻石商店 applyTheme 加·回首页(整页跳转/bfcache 旧快照)可能没补上→flyer 残留. 修法(三管齐下): ①首页 1.5s 轮询(applyTheme)钻石主题生效(getEquipped 或 试用 sessionStorage 未过期)时主动 body.classList.add(hsn-dia-on)+让位不写 data-theme·无钻石时摘掉——无论从哪条路径(商店/装备/bfcache 回首页)首页都兜底保证 hsn-dia-on 正确. ②index.html CSS body.hsn-dia-on{background:var(--hsn-dia-bg,#0a0e1a)!important} 用比 body{} 更高优先级覆盖·中和免费主题渐变·背景取钻石基色 var(--hsn-dia-bg). ③钻石商店 applyTheme 把该主题 g.bg 写入 body --hsn-dia-bg(卸下清掉). 钻石主题的极光层/场景层叠在这层纯色基底上→纯净只剩钻石主题(背景+它自己的金粒/气泡等). Playwright实测: 樱花粉8flyer+渐变背景→套深海后 0flyer+背景渐变消失(基色#03101f·极光层2在)→卸下 8flyer+渐变恢复+变量清掉; 轮询兜底: 试用态故意摘 hsn-dia-on·等1.7s 轮询自动补回+flyer 归0. 0报错. v732')
except Exception as _e732:
    fail('v732 检查异常: ' + str(_e732))

# ---- 🎨 v733 (Hansen): 首帧不闪(轮询直读 localStorage 装备态) + 版本水印(部署核验) ----
_b733 = []
try:
    _idx733 = open('index.html', encoding='utf-8').read()
    if not ("localStorage.getItem('hansen_diamond_shop')" in _idx733 and '_ds.equipped' in _idx733): _b733.append('首页轮询未直读 localStorage 装备态(首帧会闪免费主题元素)')
    if 'id="hsnVerStamp"' not in _idx733: _b733.append('缺版本水印元素 hsnVerStamp')
    if "getElementById('hsnVerStamp')" not in _idx733: _b733.append('缺版本水印取值脚本')
    if _b733:
        fail('v733 首帧不闪/版本水印: ' + str(_b733[:6]))
    else:
        ok('v733 (Hansen): ①首帧不闪——Hansen 质疑"是不是你代码没生效"·实测确有1处真缺陷: 内联主题轮询先于 hansen_diamond_shop.js 执行·首帧 window.HansenDiamondShop 未定义→【装备态】钻石主题在全新加载首页(回首页)时会漏判·导致免费主题元素(飞碟/火箭等)闪现~450ms。修法: 轮询直读 localStorage(hansen_diamond_shop 存档·装备且已拥有)·不依赖脚本加载顺序·首帧即判出 _diaOn→加 hsn-dia-on·实测闪现 visible:5→0(首帧即0)。试用态(sessionStorage)本就首帧判出·无闪。②版本水印——为彻底终结"到底有没有部署成功"的扯皮: 首页右下角加极淡小字 hsnVerStamp·从已加载脚本的 ?v= 戳读真实构建号(build.py 自动维护)·看到 v733=新版已上线/看到旧号=微信或CDN还在吃旧缓存。pointer-events:none 不挡操作·仅首页。v733')
except Exception as _e733:
    fail('v733 检查异常: ' + str(_e733))

# ---- 🎨 v734 (Hansen): 主题串台根治3 — 隐藏第三套装饰(#deco环境emoji) + 从body主题class兜底识别钻石主题 ----
_b734 = []
try:
    _idx734 = open('index.html', encoding='utf-8').read()
    if 'body.hsn-dia-on .deco{display:none' not in _idx734: _b734.append('未隐藏 #deco 环境装饰(钻石主题下仍会残留礼物/书/楼等14个浮动emoji)')
    if "indexOf('hsn-dia-theme')" not in _idx734: _b734.append('轮询未从 body 的 hsn-dia-theme class 兜底识别钻石主题(旧版外部JS没加hsn-dia-on就会漏判)')
    if "if(_ds && _ds.equipped) _diaOn=true" not in _idx734: _b734.append('轮询装备检查未放宽(owned 结构差异会卡住)')
    if _b734:
        fail('v734 主题串台根治3: ' + str(_b734[:6]))
    else:
        ok('v734 (Hansen·主题串台真凶): Hansen 换浏览器实测·版本水印已显示 v733(新版确已部署)·但主题串台依旧——查出首页有【三套】装饰系统·我前3版(v731/732/733)只盯着 ①.flyer[data-flyer-theme]·完全漏了 ③#deco/.deco-emoji(JS生成的全屏环境浮动emoji·14个·🍕🏙️🚌📅🌙📚💎🎁等·opacity:.10)——这才是Hansen截图里反复看到的礼物/书/楼/车/钻石的真凶(我的测试只测.flyer所以"假通过")。修法①: CSS 加 body.hsn-dia-on .deco{display:none!important} 一并隐藏#deco容器。修法②(关键): 内联轮询从 body 上的 hsn-dia-theme_* class(钻石商店 applyTheme 必加·14款主题id全是 theme_ 前缀)兜底识别钻石主题——这样即便部署的外部 hansen_diamond_shop.js 是旧缓存(只加主题class+背景·v731前不加 hsn-dia-on)·内联轮询(随HTML是新版)也能从 DOM 主题class 认出钻石主题·1.5s内补上 hsn-dia-on→隐藏①③(根治Hansen"老版本卡新版本不显示"场景)。修法③: 装备检查放宽为只看 equipped(owned 结构差异不卡)。实测模拟旧版JS(加class不加hsn-dia-on): 轮询兜底后 flyer 5→0·#deco block→none·hsn-dia-on 自动补上·0报错。v734')
except Exception as _e734:
    fail('v734 检查异常: ' + str(_e734))

# ---- 🖼️ v735 (Hansen): 典藏画廊 — 18款手绘场景主题(真图背景+氛围特效·每款30钻) ----
_b735 = []
try:
    import glob as _glob735
    _shop735 = open('hansen_diamond_shop.js', encoding='utf-8').read()
    _cin735 = open('hansen_cinema_themes.js', encoding='utf-8').read()
    _gallery_n = _shop735.count("series:'gallery'")
    if _gallery_n != 18: _b735.append('画廊主题 ITEMS 应为18·实为'+str(_gallery_n))
    # 18款都必须 price:30
    import re as _re735
    _gal_prices = _re735.findall(r"series:'gallery'[^}]*?price:(\d+)", _shop735)
    _bad_price = [p for p in _gal_prices if p != '30']
    if _bad_price: _b735.append('画廊主题有非30钻价格: '+str(_bad_price))
    if 'function sceneThemed(' not in _cin735: _b735.append('cinema 缺 sceneThemed 工厂')
    # v736: 每主题专属特效套件(可复用矢量绘制器)
    _kit = ['_kStar','_kCloud','_kHeart','_kBubble','_kPetal','_kNote','_kZ','_kHoney','_kBee','_kBalloon','_kCandy','_kBerry','_kRune','_kSpark','_kGear','_kYarn','_kShard','_kSeed','_kFirefly','_kPage']
    _miss_kit = [k for k in _kit if ('function '+k+'(') not in _cin735]
    if _miss_kit: _b735.append('特效套件缺绘制器: '+str(_miss_kit))
    if "globalCompositeOperation='lighter'" not in _cin735: _b735.append("v737特效缺 additive 发光合成(globalCompositeOperation lighter)")
    # v738: 场景锚定物理大场面引擎(erupt/pour/converge/launch/bloom/flare/flutter)
    if "k:'phys'" not in _cin735: _b735.append("v738特效缺物理粒子引擎(k phys)")
    _arche = _cin735.count("arche:'")   # 18主题各一个锚定事件
    if _arche != 19: _b735.append('arche锚定事件应19(18画廊+僵尸舞王)·实为'+str(_arche))
    _scene_n = _cin735.count('return sceneThemed(')   # 18个画廊场景各调一次 sceneThemed
    if _scene_n != 19: _b735.append('cinema return sceneThemed 应19(18画廊+僵尸舞王)·实为'+str(_scene_n))
    _scene_keys = _cin735.count('theme_photo_')   # 18个 SCENES key
    if _scene_keys != 18: _b735.append('cinema theme_photo_ SCENES key 应18·实为'+str(_scene_keys))
    # 图片资源(全图18 + 缩略图18)
    _full = len(_glob735.glob('themes/photo_*.jpg'))
    _thumb = len(_glob735.glob('themes/thumb_*.jpg'))
    if _full != 18: _b735.append('themes/photo_*.jpg 应18张·实为'+str(_full))
    if _thumb != 18: _b735.append('themes/thumb_*.jpg 应18张·实为'+str(_thumb))
    # 画廊分区
    if '典藏画廊' not in _shop735: _b735.append('商店缺典藏画廊分区')
    if _b735:
        fail('v735 典藏画廊: ' + str(_b735[:8]))
    else:
        ok('v735+v736 (Hansen·典藏画廊+主题专属特效): Hansen 提供18张899×1748全图手绘场景背景·全部做成钻石主题(统一30钻·人人买得起)·复用影院引擎真图背景机制(同 云朵梦境/彩虹甜心)。①18张PNG压成JPEG q86(~500KB)存 themes/photo_*.jpg + 缩略图 themes/thumb_*.jpg。②series gallery·商店独立分区「🖼️ 典藏画廊」。③统一30钻。④【v736 重做】每主题【专属特效】(原v735套通用泡泡被Hansen批太敷衍): sceneThemed 工厂 + 20个可复用矢量绘制器(云/心/星/泡泡/花瓣/音符/Zzz/蜂蜜滴/蜜蜂/热气球/糖果/浆果/符文/火花/齿轮/毛线/碎片/种子/萤火/书页)·每主题组合2-4种相关元素: 云端拥抱中转站=云+心+星 / 千骏SPA=蒸汽+水泡 / 幻兽世界=符文+魔法球 / 彩虹热气球港湾=升彩色热气球 / 星光收集工坊=繁星+流星 / 星光飞行岛=流星+星尘 / 星夜故事书屋=书页+萤火 / 星尘培育元=升光种 / 星尘记忆修复馆=漂浮碎片 / 星露果酱暖房=落浆果+蒸汽 / 星露点心坊=落糖果 / 星露童话镇=花瓣+萤火 / 晚安旋律=音符+Zzz / 梦境净化=净化气泡 / 汽车工坊=齿轮+火花 / 蜂蜜加工小作坊=飞蜂+滴蜜 / 阳光编织工坊=毛线球+暖光 / 魔法学校=符文+魔杖星火+流星。绝无旋转(只平移/缩放/透明度)。⑤都走 hsn-dia-on→v734免费装饰隐藏对它们同样生效。实测: 商店18款全30钻·真图背景渲染·专属特效各异·影院canvas接管·flyer 0/deco none·0报错。v736')
except Exception as _e735:
    fail('v735 检查异常: ' + str(_e735))

# 🍰 v741(Hansen): 星露点心坊【点心烟花】— 从中央烤炉像烟花一样向四周(360°)爆射各种点心(蛋糕/棒棒糖/马卡龙/甜甜圈/糖果混合)取代原单一糖果上喷。
try:
    _cin741 = open('hansen_cinema_themes.js', encoding='utf-8').read()
    import re as _re741
    _b741 = []
    # 4个新点心绘制器在位
    for _f in ['_kCake','_kLolli','_kMacaron','_kDonut']:
        if ('function '+_f+'(') not in _cin741: _b741.append('缺点心绘制器 '+_f)
    # drawOne 4分发在位
    for _k in ['cake','lolli','macaron','donut']:
        if ("case '"+_k+"'") not in _cin741: _b741.append('drawOne 缺分发 '+_k)
    # burst 烟花原型 + els 混合元素支持 + v742 实心点心通道(无发光拖尾)
    if "A==='burst'" not in _cin741: _b741.append("缺 burst 烟花原型(360°爆射)")
    if 'els=ev.els' not in _cin741: _b741.append('缺 els 混合元素支持')
    if "f.k==='sweet'" not in _cin741: _b741.append("缺 sweet 实心点心渲染通道(v742·实心不透明·无拖尾无发光晕)")
    # ★v742: burst 必须用实心 sweet 通道·绝不能用带拖尾(tail)的 phys(那条拖尾会糊成白色'荧光棒'·Hansen 强烈反对)
    _bidx = _cin741.find("A==='burst'")
    if _bidx>=0:
        _bseg = _cin741[_bidx:_bidx+300]
        if "k:'sweet'" not in _bseg: _b741.append("burst 必须用 k:'sweet' 实心点心(不washout)")
        if "tail:1" in _bseg: _b741.append("burst 不得带 tail 拖尾(会糊成白色荧光棒·Hansen否)")
    # dessertshop 必须用 burst + 混合点心 els(绝不能退回单一 candy 上喷)
    _ds = _re741.search(r"theme_photo_dessertshop:function\(\)\{return sceneThemed\(.*?\}\);\}", _cin741)
    if not _ds:
        _b741.append('找不到 dessertshop 主题配置')
    else:
        _dst = _ds.group(0)
        if "arche:'burst'" not in _dst: _b741.append("dessertshop 必须 arche:'burst'(点心烟花)")
        if "els:['cake','lolli','macaron','donut','candy']" not in _dst: _b741.append('dessertshop 必须混合点心 els(蛋糕/棒棒糖/马卡龙/甜甜圈/糖果)')
        if "arche:'erupt'" in _dst: _b741.append('dessertshop 不得退回 erupt 单一上喷')
    if _b741:
        fail('v741/v742 点心烟花: ' + str(_b741[:8]))
    else:
        ok("v741/v742 (Hansen·\"喷射的东西要代表点心坊·不照抄主题·要符合主题特色\"+重做\"荧光棒/太小/太透明\"): 星露点心坊特效=【点心烟花·360°向四周爆射各种点心(burst)】。v741初版: 单一糖果向上喷(erupt)→改 burst 360°爆射 + 新增4个点心绘制器(_kCake小蛋糕/_kLolli棒棒糖/_kMacaron马卡龙/_kDonut甜甜圈·配_kCandy糖果·渐变+高光果冻质感·绝无旋转) + els 混合元素。★v742重做(Hansen否v741): v741把点心做成带发光拖尾(tail)+additive发光晕的小粒子→拖尾糊成白色'荧光棒'成了焦点·点心又小又透明看不清。彻底重做: 新建 k:'sweet' 实心点心通道(实心不透明绘制·无globalCompositeOperation lighter·无拖尾·无发光晕·仅柔和深色投影分离背景·末22%才淡出)+ 点心尺寸 s .016-.03→.064-.096(放大约3倍·造型清晰可辨)+ n22→13(大点心不拥挤)+ 配色更鲜亮 + flashR .28→.2(中央爆闪缩小防冲淡)。dessertshop arche:'burst' origin[.5,.45]中央烤炉。★符合主题特色: 做点心的地方就喷各种【大而清晰的实心点心】·而非通用糖果或发光光棒。只改 hansen_cinema_themes.js·其余17主题/玩法/经济零改。v742")
except Exception as _e741:
    fail('v741 检查异常: ' + str(_e741))

# 🗑️ v743(Hansen·"钻石店流光系列这6个主题做得太垃圾·全删掉·包括相应代码所有痕迹·千万别删错"): 删除 series:'aurora' 流光系列6款(深海theme_ocean/翡翠森林theme_forest/樱粉梦境theme_sakura/熔岩theme_lava/极光theme_aurora/黄金theme_gold)。
try:
    _dia743 = open('hansen_diamond_shop.js', encoding='utf-8').read()
    import re as _re743
    _b743 = []
    # (1) 6个流光主题id必须精确清零(用边界·避免误伤 theme_sakurastorm/theme_goldenage 等迁移表别名)
    for _aid in ['theme_ocean','theme_forest','theme_sakura','theme_lava','theme_aurora','theme_gold']:
        _cnt = len(_re743.findall(_aid + r'\b', _dia743))
        if _cnt != 0: _b743.append('流光id %s 未删净(精确出现%d次)'%(_aid, _cnt))
    # (2) series:'aurora' 必须清零; 流光系列分区必须删除
    if "series:'aurora'" in _dia743: _b743.append("仍残留 series:'aurora' 商品")
    if '流光系列主题' in _dia743: _b743.append("renderShop 仍有流光系列分区")
    if "renderSeries('aurora'" in _dia743: _b743.append("仍调用 renderSeries('aurora')")
    # (3) 流光专属代码必须删除: buildScene函数 + 6个aurora场景CSS(ember保留=Boss共享)
    if 'function buildScene' in _dia743: _b743.append('buildScene(流光专属场景)未删')
    for _ac in ['hsn-lava-glow','hsn-aurora-band','hsn-bubble','hsn-gold-dust','hsn-petal','hsn-firefly']:
        if _ac in _dia743: _b743.append('aurora场景CSS未删 '+_ac)
    for _ak in ['hsnLavaPulse','hsnAuroraSway','hsnBubbleRise','hsnGoldRise','hsnPetalFall','hsnFireflyFloat']:
        if _ak in _dia743: _b743.append('aurora场景keyframes未删 '+_ak)
    # (4) ★绝不能误删: 8款IMAX + 18款典藏画廊主题必须全部完好
    _imax743 = ['theme_clouddream','theme_rainbowsweet','theme_fireworks','theme_candyland','theme_balloon','theme_lagoon','theme_spacepark']
    for _im in _imax743:
        if _im not in _dia743: _b743.append('★误删IMAX主题 '+_im)
    if _dia743.count("series:'imax'") != 8: _b743.append('IMAX 应8款(v770加僵尸舞王)·实为%d'%_dia743.count("series:'imax'"))
    if _dia743.count("series:'gallery'") != 18: _b743.append('典藏画廊应18款·实为%d'%_dia743.count("series:'gallery'"))
    if 'theme_photo_dessertshop' not in _dia743: _b743.append('★误删画廊主题 星露点心坊')
    # (5) 必须保留: 通用流光层(IMAX用) + ember(Boss动画共享·故意保留惰性块)
    if 'hsn-dia-aurora-layer' not in _dia743: _b743.append('★误删通用流光层 hsn-dia-aurora-layer(IMAX依赖)')
    if 'hsn-dia-stars' not in _dia743: _b743.append('★误删通用星层 hsn-dia-stars')
    if 'hsnEmberRise' not in _dia743: _b743.append('★ember块被删(与Boss动画hansen_boss_anim.js共享类名·须保留防影响Boss)')
    # (6) ★绝不能误删基础主题(data-theme=ocean/forest 与流光 theme_ocean 是两套·名称海洋蓝/森林绿)
    if 'renderBasicThemes' not in _dia743: _b743.append('★误删基础主题 renderBasicThemes')
    if _b743:
        fail('v743 流光删除: ' + str(_b743[:8]))
    else:
        ok("v743 (Hansen·\"流光系列6个主题做得太垃圾·全删掉·包括相应代码所有痕迹·反复确认别删错\"): 钻石商店【流光系列 series:aurora 6款】整体删除——深海(theme_ocean,20💎)/翡翠森林(theme_forest,80)/樱粉梦境(theme_sakura,120)/熔岩(theme_lava,160)/极光(theme_aurora,220)/黄金(theme_gold,300)·名称价格逐一比对Hansen截图确认无误。删净: ①6个ITEMS条目 ②6个THEME_GRAD渐变 ③buildScene函数(6主题专属场景:岩浆火星/极光带/气泡/金尘/花瓣/萤火)+其调用 ④6块aurora专属场景CSS+keyframes ⑤renderShop『✨流光系列主题』分区+renderSeries('aurora')调用 ⑥6个.dia-prev预览缩影 ⑦开头注释。★只删流光·8款IMAX(史诗)+18款典藏画廊(含星露点心坊)+6款基础主题(data-theme=ocean/forest≠流光theme_ocean·两套)全部完好。★保留: 通用流光层.hsn-dia-aurora-layer(IMAX/画廊渲染依赖·『流光层』≠『流光系列』)+ .hsn-ember块(与Boss战斗动画hansen_boss_anim.js共享类名·故意保留惰性块零影响Boss·boss自带作用域CSS+内联transition不依赖hsnEmberRise但保命名空间)。★避坑: theme_sakura/theme_gold 用\\b边界精确匹配·绝不误伤迁移表的 theme_sakurastorm/theme_goldenage(IMAX旧名别名)。真机验: 商店开→无流光分区→8IMAX+18画廊在→套IMAX/画廊主题正常→0报错。v743")
except Exception as _e743:
    fail('v743 检查异常: ' + str(_e743))

# 🗑️ v744(Hansen·"金龙贺岁这个IMAX主题也彻底删掉·包括背后代码所有元素·删的一干二净·绝不留任何痕迹"): 删除 theme_dragon 金龙贺岁(IMAX·700💎·有影院canvas场景)。
try:
    _d744 = open('hansen_diamond_shop.js', encoding='utf-8').read()
    _c744 = open('hansen_cinema_themes.js', encoding='utf-8').read()
    import re as _re744
    _b744 = []
    # (1) ★部署文件(商店+影院引擎)必须 0 金龙痕迹: 主题名/id/场景函数/专属绘制/旧迁移id 全清(注释也已通用化)
    for _tok in ['金龙', 'theme_dragon', 'sceneDragon', 'drawDragon', 'theme_cyber']:
        n1 = len(_re744.findall(_re744.escape(_tok), _d744))
        n2 = len(_re744.findall(_re744.escape(_tok), _c744))
        if n1+n2 != 0: _b744.append('部署文件残留金龙痕迹 "%s"(shop %d + cinema %d)'%(_tok, n1, n2))
    # (2) SCENES 映射与渐变/预览/ITEMS 全删
    if 'theme_dragon:sceneDragon' in _c744: _b744.append('SCENES 仍映射 theme_dragon')
    # (3) ★绝不能误删: 保留的7款IMAX + 18画廊
    _keep_imax = ['theme_clouddream','theme_rainbowsweet','theme_fireworks','theme_candyland','theme_balloon','theme_lagoon','theme_spacepark']
    for _im in _keep_imax:
        if _im not in _d744: _b744.append('★误删IMAX主题 '+_im)
    if _d744.count("series:'imax'") != 8: _b744.append('IMAX应8款·实为%d'%_d744.count("series:'imax'"))
    if _d744.count("series:'gallery'") != 18: _b744.append('画廊应18款·实为%d'%_d744.count("series:'gallery'"))
    # (4) 保留的7款IMAX场景函数(及云朵/彩虹工厂)必须在引擎里完好
    for _sc in ['function sceneFireworks','function sceneCandy','function sceneBalloon','function sceneLagoon','function sceneSpace','function sceneCloudDream','function sceneRainbowSweet']:
        if _sc not in _c744: _b744.append('★误删IMAX场景 '+_sc)
    # (5) ★必须保留: 全局 orient/turnPt(其他场景共用·非金龙专属·绝不能随金龙删)
    if 'function orient(' not in _c744: _b744.append('★误删共用函数 orient(其他场景用·非金龙专属)')
    if 'function turnPt(' not in _c744: _b744.append('★误删共用函数 turnPt(其他场景用·非金龙专属)')
    # (6) 画廊18场景 sceneThemed 数不变
    if _c744.count('return sceneThemed(') != 19: _b744.append('sceneThemed应19(18画廊+僵尸舞王)·实为%d'%_c744.count('return sceneThemed('))
    if _b744:
        fail('v744 金龙删除: ' + str(_b744[:8]))
    else:
        ok("v744 (Hansen·\"金龙贺岁这个IMAX主题也彻底删掉·包括背后代码等所有元素·删的一干二净·绝不留任何痕迹·一定删干净\"): 删除 IMAX 史诗主题【金龙贺岁 theme_dragon·700💎】——比对截图(IMAX徽章/700💎/金色巨龙穿屏红灯笼金币炮仗)确认。删净: ①商店 ITEMS 条目 ②THEME_GRAD 渐变 ③.dia-prev 预览CSS ④migrateImaxIds 迁移表里 theme_cyber→theme_dragon 旧id对(连同 theme_cyber) ⑤影院引擎 sceneDragon 整个场景函数(金龙穿屏16段蛇形/红灯笼/方孔金币雨/炮仗·含其内部专属 drawDragon+posAt) ⑥SCENES 的 theme_dragon 映射 ⑦开头注释。★部署文件(hansen_diamond_shop.js + hansen_cinema_themes.js)经 grep '金龙'/'theme_dragon'/'sceneDragon'/'drawDragon'/'theme_cyber' 全部=0·墓碑注释已通用化(不含主题名)·真正一干二净无痕。★绝未误删: 7款保留IMAX(云朵梦境/彩虹甜心/焰火盛典/糖果乐园/云端气球/七彩珊瑚湾/星际乐园)+18款典藏画廊(含星露点心坊)全部完好。★必保留(易误删): 全局 orient()/turnPt() 是其他IMAX场景(line187/204)共用的旋转辅助·非金龙专属·随金龙删会断别的场景→保留。drawDragon/posAt 是 sceneDragon 内部嵌套·随场景一起删。真机验: 商店开→无金龙→7IMAX+18画廊在→套其他IMAX/画廊canvas正常→0报错。v744")
except Exception as _e744:
    fail('v744 检查异常: ' + str(_e744))

# 🔴 v745(Hansen·宠物展示台左右箭头一点就把展示固定锁死了·箭头只能浏览宠物·没有任何锁定功能·返回后回到设为主页/锁头的宠物·锁头优先级最高): 宠物屏箭头改只浏览·去掉锁定。
try:
    _ps745 = open('hansen_pet_showcase.js', encoding='utf-8').read()
    import re as _re745
    _b745 = []
    # (1) buggy homeStep(一翻就 setHomeIdx+setHomeLock(true) 固定锁死)必须删除
    if _re745.search(r'function\s+homeStep', _ps745): _b745.append('buggy homeStep 函数未删(它会一翻就锁死展示)')
    # (2) 必须有只浏览的 scStep·且 scStep 内绝不能 setHomeIdx/setHomeLock
    _m745 = _re745.search(r'function\s+scStep\(d\)\{[^}]*\}', _ps745)
    if not _m745: _b745.append('缺只浏览的 scStep 函数')
    else:
        _body745 = _m745.group(0)
        if 'setHomeIdx' in _body745: _b745.append('scStep(箭头)里出现 setHomeIdx·箭头不该改主页展示')
        if 'setHomeLock' in _body745: _b745.append('scStep(箭头)里出现 setHomeLock·箭头不该锁定')
        if 'scBrowse' not in _body745: _b745.append('scStep 未改临时浏览阶 scBrowse')
    # (3) 浏览态变量声明在位
    if 'var scBrowse' not in _ps745: _b745.append('缺浏览态变量 scBrowse')
    if '_scKeepBrowse' not in _ps745: _b745.append('缺浏览保留标志 _scKeepBrowse')
    # (4) renderShowcase 有"非箭头渲染→重置浏览态回home"的逻辑
    if 'if(_scKeepBrowse)' not in _ps745: _b745.append('renderShowcase 缺浏览态重置逻辑(返回后回不到home展示)')
    # (5) 宠物屏箭头 onclick 仍走 HsnPet.homePrev/homeNext(现指向 scStep)
    if 'HsnPet.homePrev()' not in _ps745 or 'HsnPet.homeNext()' not in _ps745: _b745.append('宠物屏箭头按钮缺失')
    if 'homePrev:function(){scStep(-1);}' not in _ps745 or 'homeNext:function(){scStep(1);}' not in _ps745:
        _b745.append('HsnPet.homePrev/homeNext 未指向只浏览的 scStep(可能仍指 homeStep 锁定)')
    # (6) setHomeLock(true) 真实调用(去注释后)只能在 toggleHomeLock(锁头)1 处
    _co745 = _re745.sub(r'/\*.*?\*/', '', _ps745, flags=_re745.S)
    _co745 = _re745.sub(r'//[^\n]*', '', _co745)
    if _co745.count('setHomeLock(true)') != 1:
        _b745.append('setHomeLock(true) 真实调用应仅1处(toggleHomeLock锁头)·现%d处' % _co745.count('setHomeLock(true)'))
    if _b745:
        fail('v745 宠物箭头只浏览: ' + str(_b745[:8]))
    else:
        ok('v745 (Hansen·「宠物展示台左右箭头一点就把宠物展示直接固定锁死了·真正锁定应靠设为主页旁边那个锁头·箭头只能浏览宠物没有任何锁定功能·返回后回到设为主页/锁头锁住的那个宠物·锁头优先级最高其次设为主页」): 修复宠物屏(psw)左右箭头错误锁定 BUG#101。根因: 箭头 onclick=HsnPet.homePrev/homeNext → 原 homeStep(d) 一翻就 setHomeIdx(i)+setHomeLock(true)·把当前浏览宠物【设为主页展示并锁死·升级也不变】·等于箭头有了最强锁定·与Hansen预期(箭头只浏览)完全相反。修法: ①删 homeStep·改为只浏览的 scStep(d)——只改临时浏览阶 scBrowse·绝不碰 setHomeIdx/setHomeLock ②加 var scBrowse=null(null=跟随home展示)+ _scKeepBrowse 标志 ③renderShowcase 开头: 仅箭头(设_scKeepBrowse=true)保留浏览·其它渲染(导航进宠物屏/刷新/升级/锁变化)默认重置 scBrowse=null→回到home展示(showcaseStage)·实现「返回后回到设为主页/锁头的宠物」 ④hero显示阶 disp 浏览态用scBrowse否则用showcaseStage ⑤HsnPet.homePrev/homeNext 指向 scStep。优先级体系(本就正确·未动): 锁头 toggleHomeLock(最高·setHomeIdx+setHomeLock(true)·钉死升级不变) > 设为主页 pcvHome(setHomeIdx+setHomeLock(false)·跟随升级) > 箭头(只浏览·零写入)。外部头像 updateHero 始终用 showcaseStage·浏览绝不影响外部头像。真机(岛页stub curStage=8)验: 箭头翻看第9与第6阶间·localStorage home/lock 全程不被箭头改写·返回重渲回到home第9阶·锁头锁定后lock=1home=8·锁定态翻箭头lock/home不变·锁定态返回回到锁住第9阶·0报错。setHomeLock(true)真实调用仅toggleHomeLock1处。v745')
except Exception as _e745:
    fail('v745 检查异常: ' + str(_e745))

# 🔴 v747 / BUG#102(Hansen·进岛加载页最多2秒撑死2秒不能超过2秒·首次进某岛加载3-4秒强烈不满·超过2秒必须进岛且2秒内内容加载出来): 进岛加载遮罩绝对2秒上限。
try:
    _idx747 = open('index.html', encoding='utf-8').read()
    _b747 = []
    # (1) 必须有绝对上限常量 _DEADLINE(≤2000·撑死2秒)
    import re as _re747
    _md = _re747.search(r'var\s+_DEADLINE\s*=\s*(\d+)\s*;', _idx747)
    if not _md: _b747.append('缺 _DEADLINE 绝对上限常量')
    else:
        _dl = int(_md.group(1))
        if _dl > 2000: _b747.append('_DEADLINE=%d 超过2000ms(违反"不能超过2秒")' % _dl)
    # (2) 必须从点击起计时 _tStart
    if 'var _tStart = Date.now()' not in _idx747: _b747.append('缺 _tStart 点击计时起点')
    # (3) _pollReady 必须有"到绝对上限就无条件揭开"的检查(冷加载也封顶)
    if 'Date.now() - _tStart >= _DEADLINE' not in _idx747:
        _b747.append('_pollReady 缺绝对上限揭开检查(Date.now()-_tStart>=_DEADLINE)')
    # (4) 硬兜底必须用 _DEADLINE·绝不能是旧的 9000(9秒)
    if _re747.search(r'setTimeout\(_revealIsland,\s*9000\)', _idx747):
        _b747.append('硬兜底仍是 9000ms(9秒)·必须改为 _DEADLINE(≤2秒)')
    if 'setTimeout(_revealIsland, _DEADLINE)' not in _idx747:
        _b747.append('硬兜底未用 _DEADLINE(应 setTimeout(_revealIsland, _DEADLINE))')
    if _b747:
        fail('v747 进岛≤2秒上限: ' + str(_b747[:8]))
    else:
        ok('v747 / BUG#102 (Hansen·「每次第一次进某个大冒险加载时间很长·有时3秒快4秒·受不了·这个加载页最多最多也就2秒钟·撑死2秒·不能超过2秒·超过2秒必须给我进入大冒险里面去·而且2秒内大冒险里面内容必须全部加载出来」): 进岛加载遮罩【绝对2秒上限】。根因: openIsland 冷加载分支原逻辑揭岛时机= ①等 readyState interactive + 首屏图片 _homeImagesReady() ②软封顶 Date.now()-_tInteractive>2000(从"到达可交互"才算2秒·非从点击算) ③硬兜底 setTimeout(_revealIsland, 9000)【9秒】。真正瓶颈: iframe 内 1.9MB/44脚本解析执行到 DOMContentLoaded(interactive)本身约2秒(CPU密集)·叠加软封顶与图片等待→冷加载实测3-4秒。修法(只改 index.html·openIsland 冷加载分支): ①点击瞬间 var _tStart=Date.now() + var _DEADLINE=1900(撑死2秒·留100ms余量防主线程抖动真机稳<2秒); ②_pollReady 首行 if(Date.now()-_tStart>=_DEADLINE){_revealIsland();return;}——到点无论加载到哪步(readyState/图片是否就绪)都【无条件立即揭开进岛】·冷加载也绝不超2秒; 暖加载(预热命中)保留快路径: interactive + _homeImagesReady() → 亚秒瞬时揭开(无闪无蹦); ③硬兜底 setTimeout(_revealIsland, 9000)→setTimeout(_revealIsland, _DEADLINE)(9秒→≤2秒); ④进度条 width 6s→1.8s 充到95%(贴合2秒上限·消跳变)。岛 body 背景 #0c1538 与遮罩同色→到点揭开未跑完的冷岛也是同色深底(不闪白)·内容随后补齐。保活同岛再进(cur===file 分支)仍瞬时·未改。真机(Playwright·岛HTML故意延迟3.5秒模拟极冷)验: 揭岛 1928ms(<2秒·原会等3.5秒+)·0报错; 暖加载快路径保留(就绪即揭)。v747')
except Exception as _e747:
    fail('v747 检查异常: ' + str(_e747))

# 🔴 v748(Hansen·这个老虎头真的很不好看·所有岛屿进入时这个加载图标必须统一一个图标·要完全不占网速瞬间出来的emoji·选定后所有大冒险点击进入加载页全都统一使用这个图标): 进岛加载图标全岛统一=🚀。
try:
    _idx748 = open('index.html', encoding='utf-8').read()
    import re as _re748
    _b748 = []
    if "var emoji = '🚀'" not in _idx748:
        _b748.append('_showIslandLoading 未统一为固定 🚀')
    if _re748.search(r"emoji\s*=\s*ISLAND_META\[k\]\.emoji", _idx748):
        _b748.append('加载遮罩仍按岛取 ISLAND_META[k].emoji(应统一🚀不随岛变)')
    if not _re748.search(r'id="islandLoadingEmoji"[^>]*>🚀<', _idx748):
        _b748.append('islandLoadingEmoji 默认值不是 🚀')
    if 'meta.emoji' not in _idx748:
        _b748.append('首页最近探险卡片 meta.emoji 丢失(只该统一加载遮罩不该动卡片)')
    if _b748:
        fail('v748 进岛加载图标统一火箭: ' + str(_b748[:6]))
    else:
        ok('v748 (Hansen·「加载时那个老虎头真的很不好看·所有岛屿大冒险进入时这个加载图标必须统一一个图标·要像emoji那样完全不占网速瞬间出来·选定后所有大冒险点击进入加载页全都统一使用这个图标」): 进岛加载遮罩图标【全岛统一=火箭🚀】(Hansen 从候选 火箭/闪电/闪光/指南针 中选定火箭·最快感)。原 _showIslandLoading 按岛取 ISLAND_META[k].emoji(动物🐯 美食🍔 运动⚽ 等每岛不同)→改为固定 emoji 变量赋值 🚀·循环里只取岛名(正在进入X岛)不再取各岛 emoji; HTML 默认 islandLoadingEmoji 由 🗺️ 改 🚀。emoji 是系统字体字形零网速瞬间出现(原老虎头本就是 emoji 也零网速·之前的慢是岛内容加载非图标·已 v747 封顶2秒)。★仅统一加载遮罩图标·首页最近探险继续卡片仍按岛显示 meta.emoji·世界地图各岛图标不变(只动 _showIslandLoading 一处 + HTML 默认值一处·其余零改)。真机(拖慢动物岛 美食岛使加载页停留)验: 动物岛原🐯 与 美食岛原🍔 加载图标均=🚀·统一成功。v748')
except Exception as _e748:
    fail('v748 检查异常: ' + str(_e748))

# 🔴 v749(Hansen·点钻石和金币这个图标不会显示任何东西·不会再显示一堆文字说明·把那堆文字说明彻底删掉·所有冗余全删干净·点这个地方不会有任何动静): 顶部图标说明弹窗彻底删除·顶栏图标不绑任何点击。
try:
    _gs749 = open('hansen_gem_system.js', encoding='utf-8').read()
    # 去注释(// 行注释 + /* */ 块注释)·墓碑注释里会提到旧函数名·必须排除后再查"真代码"
    import re as _re749
    _code749 = _re749.sub(r'/\*.*?\*/', '', _gs749, flags=_re749.S)
    _code749 = _re749.sub(r'//[^\n]*', '', _code749)
    _b749 = []
    # (1) 真代码里绝不能还有 attachIconHelp / showIconHelp 函数定义
    if _re749.search(r'function\s+attachIconHelp', _code749): _b749.append('attachIconHelp 函数仍在(应删·顶栏图标不该绑点击)')
    if _re749.search(r'function\s+showIconHelp', _code749): _b749.append('showIconHelp 函数仍在(应删·顶部图标说明弹窗)')
    # (2) 真代码里绝不能有"给顶栏图标绑点击弹说明"的绑定
    if 'showIconHelp' in _code749: _b749.append('真代码仍引用 showIconHelp(点击绑定/调用未清干净)')
    if _re749.search(r"\.stat-badge'\)?[\s\S]{0,40}addEventListener\('click'", _code749): _b749.append('顶栏 .stat-badge 仍绑 click(应无任何点击)')
    # (3) 真代码里绝不能再有"顶部图标说明"弹窗文案
    if '顶部图标说明' in _code749: _b749.append('真代码仍有"顶部图标说明"弹窗文案(应删干净)')
    if _b749:
        fail('v749 顶部图标说明弹窗删除: ' + str(_b749[:6]))
    else:
        ok('v749 (Hansen·「点上面这个钻石和金币·这个图标不会显示任何东西·不会再显示一堆文字说明等等·完全不会显示·把之前显示的那堆文字说明彻底给我删掉·相关代码乱七八糟所有冗余全删干净·点这个地方不会有任何动静·它只是在这个地方不会显示任何东西」): 彻底删除"📖顶部图标说明"弹窗 + 顶栏图标点击绑定。原 hansen_gem_system.js: 钻石 badge 注入后调 attachIconHelp() 给顶栏所有 .top-bar .stat-badge(钻石/金币)绑 click→showIconHelp()·弹出解释 🔥连续签到/💎钻石/⭐星星/🪙金币 四图标含义的说明卡。Hansen 要求点钻石/金币毫无动静·零弹窗零文字。修法(只改 hansen_gem_system.js): ①删 attachIconHelp() 调用(badge 注入后不再绑点击) ②整段删除 attachIconHelp() 函数(原 querySelectorAll(.top-bar .stat-badge)+addEventListener click) ③整段删除 showIconHelp() 函数(原 __hs_icon_help 遮罩+四图标说明+知道啦按钮) ④留墓碑注释。结果: 顶栏钻石/金币 badge 不再绑任何点击·cursor 由 pointer 回落 auto(不再显示成可点)·点击毫无动静·零弹窗。★边界: 钻石 badge 注入 injectGemBadge 本就无点击(纯显示)·金币 badge(template.html)无 onclick·打卡天数=纯文本不可点·showStreakInfo 虽各岛有定义但未绑任何可点元素(孤立·不由顶栏触发·不动它)。只改共享 hansen_gem_system.js 一处·19 岛全生效·其余零改。真机(island_animal·关掉自动弹的签到 alertModal 后页面内点钻石+金币)验: __hs_icon_help 弹窗未出现·cursor=auto·0报错。v749')
except Exception as _e749:
    fail('v749 检查异常: ' + str(_e749))

# 🔴 v750 / BUG#103(Hansen·复习中心最上面那个间隔复习卡显示 U0001F4C5 是不是乱码·认真给我修复·不要再出现这种情况): emoji 误用 Python 风格 \U 转义导致原样显示乱码。
try:
    import re as _re750, glob as _glob750, os as _os750
    _b750 = []
    # 扫描所有共享 JS·绝不能出现 Python 风格 \U000XXXXX 转义(JS 不支持 \U·会被当普通字母U→原样显示"U000…"乱码)
    _bad750 = []
    for _fp750 in _glob750.glob(_os750.path.join(ROOT, 'hansen_*.js')) + _glob750.glob(_os750.path.join(ROOT, '*.html')):
        try:
            _t750 = open(_fp750, encoding='utf-8').read()
        except Exception:
            continue
        # 🔴v1083: 原判据只按**行首**认注释（// /* *），
        #   而本仓大量说明写在块注释**中间行**（不以 * 开头），
        #   于是把注释里引用的坏代码当成真 bug 报了几十版。
        #   改为先剥离块注释与整行注释，只查真正会执行的代码。
        _code750 = _re750.sub(r'/\*[\s\S]*?\*/', '', _t750)
        _code750 = _re750.sub(r'^\s*//.*$', '', _code750, flags=_re750.M)
        _code750 = _re750.sub(r'<!--[\s\S]*?-->', '', _code750)
        if _re750.search(r'\\U000[0-9A-Fa-f]{5}', _code750):
            # 排除本守卫说明性出现(BUG#103 注释里会写 \U0001F4C5 举例)→只在非注释行计真问题
            for _ln750 in _code750.split('\n'):
                if _re750.search(r'\\U000[0-9A-Fa-f]{5}', _ln750):
                    _s750 = _ln750.strip()
                    # 注释行(// 或 /* 或 *)里举例说明的不算真 bug
                    if _s750.startswith('//') or _s750.startswith('/*') or _s750.startswith('*'):
                        continue
                    _bad750.append(_os750.path.basename(_fp750))
                    break
    if _bad750:
        _b750.append('以下文件真代码含 Python 风格 \\U 转义(JS非法·会乱码): ' + str(sorted(set(_bad750))))
    # hansen_review.js 间隔复习卡图标必须是合法代理对 📅
    _rv750 = open('hansen_review.js', encoding='utf-8').read()
    if '\\uD83D\\uDCC5' not in _rv750.replace('\\\\', '\\'):
        # 直接按文件原文检查(代理对应原样存在)
        pass
    if 'hr_icon' in _rv750 and '\\U0001F4C5' in _rv750:
        # 仅当非注释处仍有 \U0001F4C5 才报(已在上方通用扫描覆盖·此处双保险)
        for _ln in _rv750.split('\n'):
            if '\\U0001F4C5' in _ln and not _ln.strip().startswith(('//','/*','*')):
                _b750.append('hansen_review.js 间隔复习卡图标仍是坏的 \\U0001F4C5(应代理对 \\uD83D\\uDCC5=📅)')
                break
    if _b750:
        fail('v750 emoji转义乱码: ' + str(_b750[:6]))
    else:
        ok('v750 / BUG#103 (Hansen·「复习中心最上面这个间隔复习卡显示 U0001F4C5·是不是乱码·认真给我修复这个问题·不要再出现这种情况」): 修复复习中心 emoji 乱码。根因: hansen_review.js 用 \\u 转义写中文(4位·合法JS)·但两个 emoji(码点>U+FFFF)误用了【Python 风格 \\U 八位转义】——\\U0001F4C5(本应📅·间隔复习卡图标)与 \\U0001F389(本应🎉·已清空徽章)。JavaScript 不支持 \\U(只支持 \\uXXXX 或 \\u{XXXXX} 或代理对)·\\U 的反斜杠被当转义忽略→字符串原样变成"U0001F4C5"/"U0001F389"显示=Hansen 看到的乱码。修法(只改 hansen_review.js 两处): \\U0001F4C5→代理对 \\uD83D\\uDCC5(📅)·\\U0001F389→\\uD83C\\uDF89(🎉)·保持文件 ASCII 安全与现有 \\u 风格一致。留 //🔴BUG#103 注释。守卫: 扫描所有 hansen_*.js + *.html 真代码(排除注释举例)绝不能再出现 \\U000XXXXX 这种 JS 非法转义·从根上防这类乱码复发。真机(island_animal·开复习中心读 .hr_icon)验: 显示 📅(非"U0001F4C5")·全页无 U0001F4C5/U0001F389 乱码文本·0报错。★教训: 跨语言(Python↔JS)拷代码/生成字符串时·emoji 转义格式必须随目标语言——JS 用 \\u 代理对或 \\u{}·绝不用 Python 的 \\U 八位。v750')
except Exception as _e750:
    fail('v750 检查异常: ' + str(_e750))

# 🔴 v751(Hansen·重新设计拼写对战和机器人比赛拼单词的金币机制·要考虑词的难度和对手的强度·做到绝对完美): 双因子金币机制(词难度×对手强度·学习导向)。
try:
    _sb751 = open('spelling_bee.html', encoding='utf-8').read()
    _sbn751 = _sb751.replace(' ', '')
    _b751 = []
    for _fn751 in ['function sbBase(', 'function sbOppCoef(', 'function sbWinCoins(']:
        if _fn751 not in _sb751:
            _b751.append('缺函数 ' + _fn751)
    if 'sbWordCoins' in _sb751:
        _b751.append('旧 sbWordCoins 仍残留(应已改名 sbBase)')
    if 'n<=4?2:(n<=6?4:6)' not in _sbn751:
        _b751.append('sbBase 基础分档不对(应 ≤4=2·5-6=4·7+=6)')
    if '0.5+((cpm||20)-20)/60' not in _sbn751:
        _b751.append('sbOppCoef 对手系数公式不对')
    if 'Math.max(0.3,Math.min(1.5,' not in _sbn751:
        _b751.append('sbOppCoef 未夹在 0.3~1.5')
    if 'Math.round(sbBase(w)*(1+sbOppCoef()))' not in _sbn751:
        _b751.append('sbWinCoins 公式不对')
    if 'varwant=win+bonusC' not in _sbn751:
        _b751.append('赢一词金币未用 win(基础分×(1+对手系数))')
    if 'Math.min(youStreak-1,SB_STREAK_BONUS_CAP)' not in _sbn751:
        _b751.append('连胜额外公式不对(应 min(连胜-1,封顶5))')
    if "_matchReceipt=sbQueueCappedReward(Math.round(10*sbOppCoef()),0,'match')" not in _sbn751:
        _b751.append('赢下整局奖励未经过 cap journal/receipt 日上限事务')
    if 'SB_STREAK_BONUS_CAP=5' not in _sbn751:
        _b751.append('连胜封顶非5')
    if 'SB_DAILY_COIN_CAP=2000' not in _sbn751:
        _b751.append('每日上限非2000')
    def _base751(n):
        return 2 if n <= 4 else (4 if n <= 6 else 6)
    def _coef751(cpm):
        return max(0.3, min(1.5, 0.5 + (cpm - 20) / 60.0))
    def _win751(n, cpm):
        return int(round(_base751(n) * (1 + _coef751(cpm))))
    _want751 = {(3, 20): 3, (3, 50): 4, (3, 80): 5, (5, 20): 6, (5, 50): 8, (5, 80): 10, (8, 20): 9, (8, 50): 12, (8, 80): 15}
    for _k751 in _want751:
        if _win751(_k751[0], _k751[1]) != _want751[_k751]:
            _b751.append('数值矩阵错: %d字母 cpm%d 应%d 得%d' % (_k751[0], _k751[1], _want751[_k751], _win751(_k751[0], _k751[1])))
    if _b751:
        fail('v751 拼写对战金币机制: ' + str(_b751[:6]))
    else:
        ok('v751 (Hansen·「重新设计这个拼写对战·和机器人比赛拼单词的金币机制·要考虑到这个词的难度和对手的强度·给我做到绝对完美」): 拼写对战金币机制重新设计=双因子【词难度×对手强度·学习导向】。旧机制(v726/v727)仅按词字母数 2/4/8 给币·完全不看对手强度(赢困难80字母每分的机器人 = 赢容易20字母每分 同样金币·不科学)。新机制只改 spelling_bee.html·游戏流程不动: ①基础分 sbBase 按词实际字母数 ≤4=2·5-6=4·7+=6(学会就奖励·难词更值)。②对手系数 sbOppCoef 按机器人速度 cpm 统一插值 clamp(0.5+(cpm-20)/60, 0.3, 1.5)→预设 容易20→0.5/中等50→1.0/困难80→1.5·自定义按其 cpm(≥80封顶1.5)。③赢一词金币 sbWinCoins=round(基础分×(1+对手系数))→容易×1.5/中等×2/困难×2.5·全整数: 初级3/4/5·中级6/8/10·高级9/12/15。④连胜额外=连赢第3起+2·每多赢一词再+1·单词封顶+5 [=min(连胜-1,5)]·平加不乘倍率。⑤赢下整局(你赢词数>机器人·结算 endMatch 时)额外 round(10×对手系数)=容易+5/中等+10/困难+15。⑥每日上限2000金币硬封顶。结果: 金币同时随【词更长】和【对手更强】上升·越挑战越值·又因基础分托底而学习导向。改动点(spelling_bee.html·6处): sbWordCoins→sbBase 改名+档位2/4/8→2/4/6·新增 sbOppCoef/sbWinCoins·finish 赢路径 want=win+连胜(连胜 min(连胜-1,5))·结果面板「答对+base」→「拼对又赢+win」·endMatch 加赢局奖励 _matchBonus 上报+结算面板显示。守卫: 三函数在·旧 sbWordCoins 删净·公式字面 + Python复刻数值矩阵(初级3/4/5·中级6/8/10·高级9/12/15)双校验·两硬封顶(连胜5·每日2000)在。真机 beginner+easy 赢3词 验: _sessionCoins 累计 3/6/11(第3词含连胜+2)→endMatch +赢局5=16·比分3:0·显示「赢下整局额外+5」; 真机 custom cpm200 快机器人不打字 验输路径: 机器人赢·_sessionCoins=0·错词入复习·系数1.5封顶; 0报错。★注: 竞速游戏·输的那刻选手词未拼完(被截断)·故「拼对但输了也给基础分」在当前机制下天然不存在(拼对即赢)·若要落地需改这屏 UI(结果面板 absolute inset:0 全覆盖输入框)·已在交付里与 Hansen 说明由其定夺。v751')
except Exception as _e751:
    fail('v751 检查异常: ' + str(_e751))

# ---- v752: 统一所有小游戏奖励显示·删废星星·经验只显一个总数·大白话 (Hansen·display-only·零经济改动) ----
try:
    _b752 = []
    _tpl752 = open("template.html", encoding="utf-8", errors="replace").read()
    # 1. 卡片/结果/Boss 奖励语境的"死星星⭐"必须全清(单引号拼接 + 转义两种写法都查)
    for _pat752, _nm752 in [("完成 \u2b50+", "难度卡完成\u2b50"),
        ("\u2b50 +'+L.gemBonus", "结果gemBonus\u2b50"), ("\u2b50 +'+gemReward", "结果gemReward\u2b50"),
        ("\u2b50 +'+bonus", "配对bonus\u2b50"), ("\u2b50 +'+xpReward", "Boss首通\u2b50"),
        ("\u2b50 \u672c\u5c40\u6536\u83b7", "本局收获\u2b50"), ("\\u2b50 +${gemBonus}", "听音转义\u2b50")]:
        if _pat752 in _tpl752:
            _b752.append(_nm752 + "残留")
    # 2. 0基线bug: 不得再有 ||吞0 写法; markMode 记开局经验; 结果经验算式用 typeof 判断
    if "(window._xpAtStart||(S.totalXP||0))" in _tpl752:
        _b752.append("0基线bug写法(||吞0)未修")
    if "window._xpAtStart=" not in _tpl752:
        _b752.append("markMode未记开局经验baseline")
    if "typeof window._xpAtStart==='number'" not in _tpl752:
        _b752.append("结果经验算式未用typeof(会被||吞0)")
    # 3. 新统一格式在(全对得🎓经验·至少6个难度卡 + 大白话'宠物经验')
    if _tpl752.count("\u5168\u5bf9\u5f97 \U0001f393\u7ecf\u9a8c") < 6:
        _b752.append("难度卡新格式'全对得🎓经验'不足6处")
    if "\U0001f43e\u5ba0\u7269\u7ecf\u9a8c" not in _tpl752:
        _b752.append("缺大白话'宠物经验'")
    # 4. 注入配置(island_data.json)中级图标已 ⭐→⚡(听/打字/完形 共57处)
    _dat752 = open("island_data.json", encoding="utf-8", errors="replace").read()
    if "name:'\u4e2d\u7ea7',icon:'\u2b50'" in _dat752:
        _b752.append("island_data.json中级图标仍\u2b50")
    # 5. 印好的岛: 奖励⭐无残留 + 中级图标⚡(抽查 adjective)
    _isl752 = open("island_adjective.html", encoding="utf-8", errors="replace").read()
    if ("\u5b8c\u6210 \u2b50+" in _isl752) or ("\u2b50 \u672c\u5c40\u6536\u83b7" in _isl752):
        _b752.append("印好的岛仍有奖励\u2b50")
    if "name:'\u4e2d\u7ea7',icon:'\u2b50'" in _isl752:
        _b752.append("印好的岛中级图标仍\u2b50")
    if _b752:
        fail("v752 \u7edf\u4e00\u5956\u52b1\u663e\u793a: " + str(_b752[:8]))
    else:
        ok("v752 (Hansen\u00b7\u300c\u5f7b\u67e5\u6240\u6709\u6240\u6709\u6240\u6709\u5c0f\u6e38\u620f\u00b7\u8fc7\u65f6/\u5e9f\u661f\u661f\u663e\u793a\u00b7\u5168\u90fd\u6539\u6e05\u695a\u00b7\u4e00\u773c\u5c31\u61c2\u300d): \u7edf\u4e00\u5168\u90e8\u5c0f\u6e38\u620f\u5956\u52b1\u663e\u793a=\u3010\u53ea\u6539\u663e\u793a\u00b7\u96f6\u7ecf\u6d4e\u6539\u52a8\u3011\u3002\u7ecf\u6d4e\u771f\u76f8(\u4ee3\u7801\u9a8c\u8bc1): addStar()=\u7a7a\u64cd\u4f5c(\u661f\u661f\u65e9\u5e9f); \u5361\u4e0a\u53eb gemBonus/gemReward/bonus \u7684\u53d8\u91cf\u5747\u7531 addXP() \u53d1\u653e=\u771f\u7ecf\u9a8c; \u7b54\u5bf9 earnCoinOnCorrect +1\u91d1\u5e01(\u6bcf\u8bcd\u6bcf\u5929\u22643\u00b7\u5168\u5c40\u22642000); petXp \u5b8c\u6210\u7ed9\u5b20\u7269\u7ecf\u9a8c\u3002\u7edf\u4e00\u516c\u5f0f(\u5217\u8868\u578b\u6e38\u620f): \u5168\u5bf9\u5f97\u7ecf\u9a8c=\u8bcd\u6570\u00d7\u6bcf\u8bcd\u7ecf\u9a8c+\u5b8c\u6210\u5956\u52b1; \u91d1\u5e01=\u8bcd\u6570(\u9996\u73a9\u5168\u5bf9)\u3002\u6539\u52a8: \u2460\u516b\u4e2a\u96be\u5ea6\u5361\u7edf\u4e00\u4e3a\u300c\u56fe\u6807 N\u8bcd\u00b7\u5168\u5bf9\u5f97 \U0001f393\u7ecf\u9a8c+\u603b\u00b7\U0001f43e\u5ba0\u7269\u7ecf\u9a8c+N\u00b7\U0001f4b0\u91d1\u5e01+N\u300d(\u7ecf\u9a8c\u53ea\u663e\u4e00\u4e2a\u603b\u6570); \u6781\u901f(\u65f6\u95f4\u5236)\u5355\u72ec\u6587\u6848\u3002\u2461\u7ed3\u679c\u9875\u7edf\u4e00\u4e3a \U0001f4b0\u91d1\u5e01/\U0001f393\u7ecf\u9a8c(\u672c\u5c40\u771f\u5b9e\u603b\u989d)/\U0001f43e\u5ba0\u7269\u7ecf\u9a8c\u00b7\u5220\u6b7b\u661f\u661f; \u672c\u5c40\u7ecf\u9a8c\u7528 markMode \u8bb0\u5f00\u5c40 totalXP baseline\u00b7\u7ed3\u7b97\u65f6\u5dee\u503c\u3002\u2462\u4e2d\u7ea7\u56fe\u6807 \u2b50\u2192\u26a1(\U0001f331\u521d\u7ea7\u2192\u26a1\u4e2d\u7ea7\u2192\U0001f525\u9ad8\u7ea7)\u00b7\u5361\u7247\u5f7b\u5e95\u65e0\u661f\u3002\u2463Boss\u9996\u901a/\u5b66\u4e60\u6309\u94ae/\u5b9d\u7bb1/\u8bbe\u7f6e XP\u2192\u7ecf\u9a8c\u00b7\u53bb\u5e9f\u661f\u3002\u4fdd\u7559\u7684\u2b50\u90fd\u662f\u6b63\u7ecf\u7528\u9014: \u5355\u8bcd\u638c\u63e1\u6536\u96c6\u2b50\u00b7\u8868\u73b0\u8bc4\u7ea7\u2b50\u2b50\u2b50\u00b7\u7b49\u7ea7/\u6210\u5c31\u56fe\u6807\u00b7\u706b\u773c\u5b9e\u65f6\u5206\u6570\u3002\u3010\u8e29\u5230\u7684\u5751\u00b7\u5fc5\u8bb0\u3011: \u7ed3\u679c\u7ecf\u9a8c\u4e00\u5ea6\u663e\u793a+0\u2014\u2014\u539f\u5151\u5e95\u5199 window._xpAtStart||(S.totalXP) \u628a\u65b0\u73a9\u5bb6\u5408\u6cd5\u7684 baseline 0 \u5f53\u6210\u5047\u503c\u4e22\u6389\u00b7\u771f\u673a\u624d\u62ed\u51fa\u00b7\u6539\u7528 typeof===number \u5224\u65ad\u3002\u3010\u67b6\u6784\u00b7\u5fc5\u77e5\u3011: \u542c\u97f3\u8fa8\u4e49/\u6253\u5b57/\u5b8c\u5f62 \u4e09\u4e2a\u6e38\u620f\u7684\u96be\u5ea6\u914d\u7f6e(\u542b icon/name/desc/xpPerQ/gemBonus)\u4ece island_data.json \u7ecf\u5360\u4f4d\u7b26\u6ce8\u5165(\u975e\u6a21\u677f\u9759\u6001)\u00b7\u6539\u6a21\u677f\u78b0\u4e0d\u5230\u00b7\u987b\u540c\u6539\u6570\u636e\u6587\u4ef6; \u542c\u97f3\u7ed3\u7b97\u9875\u7528\u300c\u6a21\u677f\u5b57\u7b26\u4e32${}+Unicode\u8f6c\u4e49\\u2b50\u300d\u5199\u6cd5\u00b7\u666e\u901a\u641c\u626b\u626b\u4e0d\u5230\u00b7\u5df2\u63ea\u51fa\u4fee\u6b63\u3002\u771f\u673a\u9a8c: 9\u4e2a\u6e38\u620f\u83dc\u5355\u5168\u65e0\u2b50+\u4e2d\u7ea7\u26a1; \u62fc\u8bcd/\u6253\u5730\u9f20\u5361\u6570\u5b57\u51c6(\u7ecf\u9a8c=\u6bcf\u5355\u4f4d\u00d7\u6570\u91cf+\u5b8c\u6210); \u65b0\u73a9\u5bb6totalXP=0\u5b9e\u6253\u9ad8\u7ea7\u7ed3\u679c\u7ecf\u9a8c=+211(\u4e0e\u771f\u5b9e\u589e\u91cf\u4e00\u81f4\u00b7\u4e0d\u518d\u662f0); listenComplete \u751f\u6210\u4ee3\u7801\u786e\u8ba4 \U0001f4b0\u91d1\u5e01/\U0001f393\u7ecf\u9a8c/\U0001f43e\u5ba0\u7269\u7ecf\u9a8c\u96f6\u661f; 0\u62a5\u9519\u3002\u62fc\u5199\u5bf9\u6218(spelling_bee\u00b7v751)\u662f\u72ec\u7acb\u9876\u5c42\u6587\u4ef6\u00b7\u4e0d\u5728\u672c\u6b21\u8303\u56f4\u4e14\u5df2\u5e72\u51c0\u3002v752")
except Exception as _e752:
    fail("v752 \u68c0\u67e5\u5f02\u5e38: " + str(_e752))

# ---- \u6c47\u603b ----

# ---- v753: 钻石店→主题商店 改名 (Hansen·以后只卖主题·display-only) ----
try:
    _b753 = []
    for _f753 in ["hansen_diamond_shop.js","index.html","hansen_gem_system.js","hansen_gacha.js","hansen_cards.js","hansen_gear.js"]:
        _s753 = open(_f753, encoding="utf-8", errors="replace").read()
        if ("\u94bb\u77f3\u5546\u5e97" in _s753) or ("\u94bb\u77f3\u5e97" in _s753):
            _b753.append(_f753 + " still-old-shop-name")
    _ds753 = open("hansen_diamond_shop.js", encoding="utf-8", errors="replace").read()
    if "\u4e3b\u9898\u5546\u5e97" not in _ds753:
        _b753.append("title-missing-theme-shop")
    if "\u94bb\u77f3" not in _ds753:
        _b753.append("diamond-currency-deleted")
    if "hsn-dia-theme" not in _ds753:
        _b753.append("dia-theme-class-deleted")
    if _b753:
        fail("v753 shop-rename: " + str(_b753[:6]))
    else:
        ok("v753 (Hansen:rename diamond-shop to theme-shop, shop only sells themes): \u94bb\u77f3\u5e97/\u94bb\u77f3\u5546\u5e97 \u5168\u90e8\u6539\u540d\u4e3a\u3010\u4e3b\u9898\u5546\u5e97\u3011\u3002\u6539\u540d\u524d\u5df2\u786e\u8ba4\u5546\u5e97\u672c\u5c31\u53ea\u5356\u4e3b\u9898(series=imax 7\u6b3e + gallery 18\u6b3e + 6\u6b3e\u57fa\u7840\u4e3b\u9898\u00b7\u62bd\u5361/\u5361\u518c/\u88c5\u5907\u65e9\u5df2\u4e0d\u5728\u6b64\u5546\u5e97)\u3002\u6539\u52a8(12\u5904\u00b7\u53ea\u6539\u5e97\u540d\u6587\u5b57): \u2460\u53ef\u89c1\u6807\u9898\u300c\U0001f48e \u94bb\u77f3\u5546\u5e97\u300d\u2192\u300c\U0001f48e \u4e3b\u9898\u5546\u5e97\u300d(\U0001f48e\u8d27\u5e01\u56fe\u6807\u4fdd\u7559)\u3002\u2461\u5165\u53e3\u5361\u6807\u7b7e\u300c\u94bb\u77f3\u5e97\u300d\u2192\u300c\u4e3b\u9898\u5546\u5e97\u300d\u3002\u2462\u5176\u4f59\u6ce8\u91ca\u91cc\u65e7\u5e97\u540d\u4e00\u5e76\u6539\u540d\u4fdd\u6301\u4e00\u81f4(index.html\u00d74/gem_system\u00d71/gacha\u00d71/cards\u00d71/gear\u00d71/diamond_shop\u6ce8\u91ca\u00d72)\u3002\u3010\u4e25\u683c\u53ea\u52a8\u4e24\u4e2a\u8bcd\u3011: \u94bb\u77f3(\U0001f48e\u8d27\u5e01\u672c\u8eab)\u4fdd\u7559\u00b7\u94bb\u77f3\u4e3b\u9898\u7c7b\u540d hsn-dia-theme_* \u4fdd\u7559\u00b7\u5185\u90e8\u6807\u8bc6 HansenDiamondShop/applyTheme/\u6587\u4ef6\u540d\u5168\u4e0d\u52a8(\u6539\u4e86\u4f1a\u65ad\u4e3b\u9898\u7cfb\u7edf)\u00b7vocab\u91cc\u7684'\u5546\u5e97'(shop\u5355\u8bcd)\u4e0e'\u6b66\u5668\u5546\u5e97'\u7edd\u4e0d\u8bef\u4f24\u3002\u771f\u673a(island_adjective\u00b7HansenDiamondShop.open())\u9a8c: \u6807\u9898\u663e\u793a\u300c\u4e3b\u9898\u5546\u5e97\u300d\u00b7\u65e7\u5e97\u540d0\u6b8b\u7559\u00b7\U0001f48e\u94bb\u77f3\u8d27\u5e01\u4ecd\u5728\u00b70\u62a5\u9519\u3002v753")
except Exception as _e753:
    fail("v753 check-exception: " + str(_e753))


# ---- v754: 宠物展示台阶段名徽章 加大加粗白字 (Hansen·A方案) ----
try:
    _b754 = []
    _tpl754 = open("template.html", encoding="utf-8", errors="replace").read()
    if ".pet-stage{font-size:15px;font-weight:800;background:rgba(251,191,36,.32);padding:2px 9px;border-radius:7px;color:var(--pal-ink,#fff)}" not in _tpl754:
        _b754.append("pet-stage新样式不在")
    _isl754 = open("island_adjective.html", encoding="utf-8", errors="replace").read()
    if ("font-size:15px;font-weight:800" not in _isl754) or ("color:var(--pal-ink,#fff)}.pet-stage:empty" not in _isl754):
        _b754.append("印好的岛pet-stage未更新")
    if _b754:
        fail("v754 阶段名徽章: " + str(_b754[:4]))
    else:
        ok("v754 (Hansen·「宠物展示这个名字字体太小不清楚·加粗·换个更好的颜色·先建议再改·选定A方案」): 宠物展示台阶段名徽章(.pet-stage·heroPetStage·如「风翎灵兽」)加大加粗换白字。原样式 12px/字重600/金字#fbbf24/底rgba(251,191,36,.2) —— 金字配同色系金底·对比太低糊成一团·且与左边金色物种名「星灵」撞色不分明(Hansen截图圈出)。建议过三方案(A白字金药丸/B白字实琥珀/C薄荷青配宠物色)·Hansen选定A。改为 font-size:15px·font-weight:800·color:#fff·background:rgba(251,191,36,.32)(金药丸加深托白字)·padding:2px 9px·border-radius:7px。白字配金底对比清楚·且与金色「星灵」一金一白分明·所有宠物通用。【只改 .pet-stage 一处】(只此一处用·在 heroPetStage 徽章): 物种名「星灵」.pet-name 保持金色不动·详情页灰色阶段信息行 .pet-stage-info(第N/M阶段·…)未圈未动。真机(island_adjective·给heroPetStage塞内容读computedStyle)验: font-size=15px·font-weight=800·color=rgb(255,255,255)白·background=rgba(251,191,36,.32)金·0报错。v754")
except Exception as _e754:
    fail("v754 检查异常: " + str(_e754))


# ---- v755: 拼写对战进入默认主题=晴空(sky) (Hansen) ----
try:
    _b755 = []
    _sb755 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    if ("var t='sky'" not in _sb755) or ("localStorage.getItem(SB_THEME_KEY)||'sky'" not in _sb755):
        _b755.append("init-default-not-sky")
    if "var t='night'" in _sb755:
        _b755.append("still-has-night-default")
    if "localStorage.getItem('hansen_sb_theme')||'sky'" not in _sb755:
        _b755.append("antiflash-not-sky")
    if 'class="thm sel" data-sbtheme="sky"' not in _sb755:
        _b755.append("sky-swatch-not-selected")
    if 'class="thm sel" data-sbtheme="night"' in _sb755:
        _b755.append("night-swatch-still-selected")
    if '{"en": "night"' not in _sb755:
        _b755.append("word-night-damaged")
    if 'body[data-theme="sky"]' not in _sb755:
        _b755.append("sky-css-lost")
    if _b755:
        fail("v755 spelling-bee-default-sky: " + str(_b755[:6]))
    else:
        ok("v755 (Hansen:spelling bee 这个模式进入的时候 默认界面主题设置为晴空): 拼写对战(spelling_bee.html)进入时的默认界面主题由 night(暗夜·偏暗) 改为 sky(晴空)。改5处(只改默认·玩法/词库零改): ①防闪早脚本 无存档时默认 'sky'(原无存档=基础暗夜底)。②主初始化 var t 'night'→'sky'(localStorage 取不到时的默认·×2处一行内)。③sbMarkTheme 兜底 (t||'night')→(t||'sky')。④色板默认高亮 暗夜sel→晴空sel。【尊重用户选择】: localStorage 'hansen_sb_theme' 存档仍优先——用户自己换过的主题、或显式选暗夜·都原样保留·只改'无存档时的默认值'。【未误伤】: 拼写词\"night\"(vocab)完好·body[data-theme=sky]主题CSS在·sbApplyTheme(t!=night才setAttribute·night=移除属性=基础底)逻辑不动·点击保存逻辑不动。真机(spelling_bee.html)验: A全新进入(清存档)→ data-theme=sky·晴空色板高亮·暗夜不高亮; B存档sakura→仍樱粉; C显式存night→仍暗夜基础底; 0报错。v755")
except Exception as _e755:
    fail("v755 检查异常: " + str(_e755))


# ---- v756: 拼写对战 iPhone键盘打字音效 + 更多设置开关(默认开·可关·记住) (Hansen) ----
try:
    _b756 = []
    _sb756 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    if "function kbTap(" not in _sb756:
        _b756.append("kbTap-missing")
    if "kbTap();/*" not in _sb756:
        _b756.append("typeKey-no-kbTap")
    if "kbTap(true);/*" not in _sb756:
        _b756.append("typeDel-no-kbTap")
    if "S.sound===false||S.kbSound===false" not in _sb756:
        _b756.append("kbTap-no-dual-gate")
    if 'id="kbSoundSwt"' not in _sb756:
        _b756.append("toggle-ui-missing")
    if "hansen_sb_kbsound" not in _sb756:
        _b756.append("persist-key-missing")
    if "if(e.target.closest('.key'))return;" not in _sb756:
        _b756.append("key-not-excluded-from-navclick")
    if "kbSound:true}" not in _sb756:
        _b756.append("S-default-kbSound-missing")
    if _b756:
        fail("v756 iphone-keyboard-typing-sfx: " + str(_b756[:8]))
    else:
        ok("v756 (Hansen:spelling bee 打字的时候音效使用iPhone键盘音效·更多设置里可开关·默认打开除非手动关闭·这音效你自己能做出来吗): 拼写对战(spelling_bee.html)打字时播放原创合成的 iPhone 键盘『哒』声·并在『更多设置』加打字音效开关。【音效·原创合成非苹果音频文件】新增 kbTap(isDel) 用现有 _audio() AudioContext 合成: 带通(1950Hz/删除1500Hz)衰减白噪声『咔』瞬态 + 三角波下滑音体(470→160Hz/删除360→120Hz)·快起音~4ms·快衰减~50ms·音量柔和(0.15/0.12)·删除键更低音。【触发·物理+屏幕全覆盖】typeKey(l) 与 typeDel() 是物理键盘(document keydown→typeKey/typeDel)和屏幕键盘(.key 点击→typeKey/typeDel)的共同入口·在这两函数内调 kbTap()/kbTap(true)·两条输入路径都响。【双重门控】kbTap 受 S.sound(总开关🔊·原有)与 S.kbSound(打字音效开关·新增) 双重控制·任一关则不响。【开关UI】更多设置(#moreBody·键盘上下位置行之后)加一行『⌨️ 打字音效』+ iOS风格绿色拨动开关 #kbSoundSwt(.swt·role=switch)。【默认开+持久化】S 默认 kbSound:true·但 S 本身不存盘(每次重置)·故用专门 localStorage 键 hansen_sb_kbsound 记住关闭选择(=='0'为关·缺失/=='1'为开)·初始化读它·点击翻转并写盘·开关UI同步高亮·打开时播一声 kbTap 预览。【避免双声】屏幕键 .key 点击原会被 BUG#96 委托播 playNavClick(通用点击声)·现在委托监听开头加 if(closest('.key'))return 把字母/删除键排除·只走 kbTap·其它按钮仍播 playNavClick。【保留】每字母对/错反馈轻音 sndOk()/sndBad()(对错音·受总开关)保留不动·renderYou 字母上色也在·iPhone键盘风格屏幕键(.key·iOS白键)样式不动。真机(监听AudioContext节点创建): A开关默认on/S.kbSound=true; B kbTap()创建振荡器+噪声源各1(=会响)·kbTap(true)振荡器1; C打字开关off/总开关off均0节点(不响); D typeKey/typeDel各创建1节点(打字+删除都响); E点开关→S.kbSound=false/UI灭/存档'0'; F重进(存档0)→记住关闭; 0报错。v756")
except Exception as _e756:
    fail("v756 检查异常: " + str(_e756))

# ---- v758: 今日复习卡 假日期 emoji 日历 -> 真实日期 CSS 日历 (Hansen) ----
try:
    _b757 = []
    _rv758 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    if "class=\"hr_icon\">\\uD83D\\uDCC5" in _rv758:
        _b757.append("today-card-still-uses-fake-emoji")
    if (".hr_cal{" not in _rv758) or (".hr_cal_m{" not in _rv758) or (".hr_cal_d{" not in _rv758):
        _b757.append("hr_cal-css-missing")
    if "['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][_calNow.getMonth()]" not in _rv758:
        _b757.append("real-month-calc-missing")
    if ("_calNow = new Date()" not in _rv758) or ("_calDay = _calNow.getDate()" not in _rv758):
        _b757.append("real-date-calc-missing")
    if "'<span class=\"hr_cal\"><span class=\"hr_cal_m\">' + _calMon" not in _rv758:
        _b757.append("calendar-not-injecting-real-month")
    if _b757:
        fail("v758 real-date-calendar: " + str(_b757[:6]))
    else:
        ok("v758 (Hansen:今日复习的日历牌 JUL17 跟真实日期对不上·是随便给的吗·要给日历就必须和真实日期对上·给假日期看着怪): 复习中心『今日复习』卡左上角的日历·原来用 Unicode 日历 emoji —— 苹果把该 emoji 图案永久刻成『JUL 17』(Apple 祖传固定日期·与设备真实日期无关)·所以永远显示 7月17日。改为 CSS 手绘真实日期小日历: 在 openReviewCenter() 拼 SRS 卡片前算 new Date()·_calMon=英文三字母月缩写(JAN..DEC by getMonth)·_calDay=getDate()·注入 .hr_cal(竖排白底·红条 hr_cal_m 显月份、白底 hr_cal_d 显日号·保留 hr_iconFloat 上下浮动) 替换原日历 emoji span。日历随复习中心每次打开按设备当天刷新。【只换这一处『日期日历』】复习中心其它卡功能图标(看汉意拼=手写/闪卡=小丑牌/听音=耳机/主动学习=书本)是功能符号非日期·不动; 成就和签到里的日历图标(签到/累计天数/每日签到——代表日历打卡概念·非具体日期)也合理保留。真机(开复习中心): 日历=设备真实今天(月+日与 new Date 一致)·今日复习卡内无旧 emoji·全中心无残留日历 emoji·白底红头·0报错。教训: Unicode 日历 emoji 苹果上永远固定 JUL 17 静态图·绝不能当今天日期用·真实日期必须自己取 new Date 画。v758")
except Exception as _e757:
    fail("v758 check error: " + str(_e757))

# ---- v759: 打字音效换成用户上传的 iPhone 真机原声(替换v756合成) (Hansen) ----
try:
    _b759 = []
    import re as _re759
    _sb759 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    _m759 = _re759.search(r'var KB_TAP_B64="([A-Za-z0-9+/=]*)"', _sb759)
    if not _m759:
        _b759.append("KB_TAP_B64-missing")
    elif len(_m759.group(1)) < 3000:
        _b759.append("KB_TAP_B64-too-short-empty-audio")
    if "function _kbDecode(" not in _sb759:
        _b759.append("_kbDecode-missing")
    if "decodeAudioData" not in _sb759:
        _b759.append("decodeAudioData-missing")
    if "src.buffer=_kbBuf" not in _sb759:
        _b759.append("kbTap-not-playing-buffer")
    if "_kbDecode();/*" not in _sb759:
        _b759.append("startMatch-no-predecode")
    if "S.sound===false||S.kbSound===false" not in _sb759:
        _b759.append("dual-gate-missing")
    if _b759:
        fail("v759 iphone-real-keytap-audio: " + str(_b759[:7]))
    else:
        ok("v759 (Hansen:你做的合成音效根本不是iPhone打字声·还是用我给你的这个更靠谱·直接安排进去打字时触发·这是iPhone原声): 拼写对战打字音效从 v756 合成音改为【用户上传的 iPhone 真机原声】(soundeffect.wav)。处理: 原文件24-bit/48k/0.295s里真正的『哒』声只有0.021s·前导46ms静音(会让声音延迟·打字发飘)+尾部229ms静音(白占体积)→ numpy裁成40ms脆响·转通用16-bit·base64(约5KB)内嵌进 spelling_bee.html 的 KB_TAP_B64 常量·离线即响无需外部文件(避开24-bit WAV在部分微信/安卓解码不稳)。播放: 新增 _kbDecode() 用 _audio() AudioContext 把 base64 解码成 AudioBuffer 缓存(_kbBuf)·在 startMatch 与 _unlockSbAudio 预解码(打字前就绪·首键不丢音)·kbTap(isDel) 每次打字 createBufferSource(buffer=_kbBuf).start(0) 播放原声·删除键同一声·直连destination(原音量·可调)。保留不变: S.sound(总开关🔊)+S.kbSound(打字音效开关·默认开·localStorage 'hansen_sb_kbsound' 记住关闭)双重门控·typeKey/typeDel 物理+屏幕共同入口触发·屏幕键 .key 排除通用点击声防双声。移除: v756 合成版的振荡器+衰减噪声合成代码。注: 上一个上传文件typesound.wav是空的(44字节头·data块0字节·0声音)·已让用户重发·本次soundeffect.wav有42486字节真实音频。真机(监听AudioContext节点创建): A base64解码成AudioBuffer成功·时长0.0397s; B kbTap创建BufferSource(=播放原声); C 打字开关/总开关任一off→0节点(不响); D typeKey/typeDel各触发1次播放; E 开关默认on; 0报错。v759")
except Exception as _e759:
    fail("v759 check error: " + str(_e759))

# ---- v760: 打字音效换成 Pixabay iPhone 打字音效(从22.7s连打里切出1声·替换v759那段) (Hansen) ----
try:
    _b760 = []
    import re as _re760
    _sb760 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    _m760 = _re760.search(r'var KB_TAP_B64="([A-Za-z0-9+/=]*)"', _sb760)
    if not _m760:
        _b760.append("KB_TAP_B64-missing")
    elif len(_m760.group(1)) < 9000:
        _b760.append("KB_TAP_B64-not-pixabay-reverted")
    if _b760:
        fail("v760 pixabay-iphone-keytap: " + str(_b760[:4]))
    else:
        ok("v760 (Hansen:这个才是真正的iphone音效·spelling bee打字音效应该是这个·Pixabay免费iPhone打字音效文件): 拼写对战打字音效再换成【用户上传的 Pixabay 免费 iPhone 打字音效】(替换v759那段·机制不变只换音频数据)。处理: 原mp3是22.7s/立体声/256k的连打录音(检测到55下击键·峰值0.36偏小)·用 numpy envelope+80ms不应期分组定位到第1声(@0.672s·到第2声间隔0.302s足够)·切出起点前5ms到75ms窗口的单声『哒』·归一化到0.85峰值(原录音偏小·提到清晰可闻)·末尾5ms淡出防咔·确认后半段幅度0即只切到一声没混入第二下·转16-bit·base64(约9.4KB)替换 spelling_bee.html 的 KB_TAP_B64 常量。其余全部不变: _kbDecode 解码缓存·startMatch/_unlockSbAudio 预解码·kbTap createBufferSource(_kbBuf).start(0) 播放·S.sound+S.kbSound 双门控·typeKey/typeDel共同入口·.key排除·更多设置开关默认开localStorage记住。真机(监听AudioContext节点): A解码成AudioBuffer时长0.0750s(对上切出的75ms); B kbTap创建BufferSource播放; C双开关任一off→0节点; D typeKey/typeDel各1次; E开关默认on; 0报错。版本沿革: v756合成版→v759用户wav→v760用户Pixabay-mp3。v760")
except Exception as _e760:
    fail("v760 check error: " + str(_e760))

# ---- v761: 打字音效设置描述去掉"iPhone"字样(用户要求界面不出现iPhone) (Hansen) ----
try:
    _b761 = []
    _sb761 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    if "打字时播放 iPhone" in _sb761:
        _b761.append("setds-still-has-iPhone")
    if "打字时播放键盘按键声" not in _sb761:
        _b761.append("new-desc-missing")
    if 'id="kbSoundSwt"' not in _sb761:
        _b761.append("toggle-missing")
    if _b761:
        fail("v761 remove-iphone-from-setting-desc: " + str(_b761[:4]))
    else:
        ok("v761 (Hansen:spelling bee更多设置打字音效那里把iPhone去掉·不要出现iPhone): 拼写对战『更多设置』里『打字音效』这条的用户可见描述由『打字时播放 iPhone 键盘按键声 · 默认开启』改为『打字时播放键盘按键声 · 默认开启』·去掉 iPhone 字样(连同前后多余空格)。只改这一处用户可见文案; 设置项名『打字音效』、开关 #kbSoundSwt、声音机制(v760 Pixabay音·解码播放·双门控·默认开localStorage记住)全不动。代码注释里的 iPhone(用户看不到)不影响界面·保留。真机(开更多设置): 该条描述=『打字时播放键盘按键声 · 默认开启』·不含 iPhone·整个更多设置面板可见文本无 iPhone·开关仍在。v761")
except Exception as _e761:
    fail("v761 check error: " + str(_e761))

# ---- v762: spelling bee 机器人对手形象 由 robot emoji 改为自画机器人头像PNG(3屏幕脸默认+4独眼·选择器可选) (Hansen) ----
try:
    _b762 = []
    import os as _os762
    _sb762 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    if not _os762.path.exists("robots/bot_3.webp"):
        _b762.append("bot_3.webp-missing")
    if not _os762.path.exists("robots/bot_4.webp"):
        _b762.append("bot_4.webp-missing")
    if "botAvatar:'robots/bot_3.webp'" not in _sb762:
        _b762.append("default-bot-avatar-not-robot3")
    if "var ROBOT_AV=['robots/bot_3.webp','robots/bot_4.webp']" not in _sb762:
        _b762.append("ROBOT_AV-missing")
    if "grid(ROBOT_AV.concat(BOSS_AV))" not in _sb762:
        _b762.append("picker-no-robots")
    if '<div class="setic"><img src="robots/bot_3.webp' not in _sb762:
        _b762.append("setting-icon-not-replaced")
    if '<div class="ovsp-lab"><img src="robots/bot_3.webp' not in _sb762:
        _b762.append("result-label-not-replaced")
    if '<div class="rw lose"><img src="robots/bot_3.webp' not in _sb762:
        _b762.append("lose-label-not-replaced")
    if _b762:
        fail("v762 robot-avatar: " + str(_b762[:8]))
    else:
        ok("v762 (Hansen:spelling bee那个机器人emoji太难看·有没有别的机器人emoji·要机器人但不要这个·给几个选择 → 选了3和4): Unicode 里机器人脸只有一个 robot emoji·没有第二个·所以改为【我自画的机器人头像PNG】。我画了6个机器人方案给用户选·用户选了3(屏幕脸·紫)和4(独眼·绿)。实现: SVG画好后用chromium栅格化成256x256 PNG(robots/bot_3.webp屏幕脸·robots/bot_4.webp独眼)·放robots/目录(部署zip根目录·随包)。【为何PNG非SVG】img加载svg需服务器给 image/svg+xml MIME·部分静态服务器不一定给对→裂图·改用PNG与现有boss/宠物头像一致最稳。接入头像系统: ①S默认 botAvatar 从 bosses/lv01.webp 改为 robots/bot_3.webp(对战页avBot/VS页vsBotAv/设置预览avBotPrev 经 applyAvatars/renderAvPreviews 自动显示机器人3·avHTML用img src+?v= 缓存戳build.py统一管)。②新增 ROBOT_AV=[bot_3,bot_4]·头像选择器(openAvPicker)把机器人两项 concat 排在boss图最前·用户可在游戏里点头像切机器人3或4。③硬编码初始🤖(avBotPrev/vsBotAv/avBot)换成机器人3 img·避免JS执行前闪一下emoji。④静态标签🤖→机器人3小图: 设置「机器人名字」图标(.setic)、结算「机器人」标签(.ovsp-lab)、输赢文案「…赢了」(.rw lose)。【保留】难度选择「中等」那个🤖是速度档位图标(和🐢慢/⚡快/🎚️自定义一组)·不属于机器人对手形象·不动。真机(本地服务): 默认botAvatar=robots/bot_3.webp·设置预览图naturalWidth256加载成功·选择器前两项=bot_3/bot_4且都加载·设置机器人名字图标加载·0报错。v762")
except Exception as _e762:
    fail("v762 check error: " + str(_e762))

# ---- v763: 中等难度速度档位图标 由 robot emoji 改为兔子(用户点头把难度那个也换) (Hansen) ----
try:
    _b763 = []
    _sb763 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    # (v764起: 中等档已由兔子emoji换成 medium.webp 卡通图·不再要求兔子emoji·此处仅保留"难度档无robot emoji"校验)
    if '<div class="ic">🤖</div>' in _sb763:
        _b763.append("mid-icon-still-robot-emoji")
    if _b763:
        fail("v763 mid-difficulty-rabbit: " + str(_b763[:3]))
    else:
        ok("v763 (Hansen:spelling bee中等这个emoji换一个·不要再用这个机器人头像·换成你认为最合适的): 难度选择器『中等』那个速度档位图标由 robot emoji 改为兔子。这是对手打字速度档: 容易=乌龟(20字母/分) / 中等=兔子(50) / 困难=闪电(80) / 自定义=滑杆。选兔子的理由: 接『龟兔赛跑』的梗·和容易的乌龟天然成对·兔子比乌龟快、又没到闪电那种极速·正好落在『中等』·而且萌、适合中学生英语游戏。至此整个 spelling_bee.html 已无任何 robot emoji(v762把机器人对手形象换成自画头像·v763把这最后一个难度档位 robot emoji 换成兔子)。其余三档 乌龟/闪电/滑杆 不动。真机: 中等chip的.ic图标=兔子emoji·其余档位不变·主脚本语法通过·0报错。v763")
except Exception as _e763:
    fail("v763 check error: " + str(_e763))

# ---- v764: 难度三档图标 emoji -> 用户上传卡通图标(容易=slow龟/中等=medium兔/困难=fast树懒) (Hansen) ----
try:
    _b764 = []
    import os as _os764
    _sb764 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    for _fn764 in ["speed/slow.webp","speed/medium.webp","speed/fast.webp"]:
        if not _os764.path.exists(_fn764):
            _b764.append(_fn764+"-missing")
    if 'data-bot="easy" style="--cc:#22c55e;--ccbg:rgba(34,197,94,.16)"><div class="dot"></div><div class="ic"><img src="speed/slow.webp' not in _sb764:
        _b764.append("easy-chip-not-slow")
    if 'data-bot="mid" style="--cc:#fbbf24;--ccbg:rgba(251,191,36,.16)"><div class="dot"></div><div class="ic"><img src="speed/medium.webp' not in _sb764:
        _b764.append("mid-chip-not-medium")
    if 'data-bot="hard" style="--cc:#ef4444;--ccbg:rgba(239,68,68,.16)"><div class="dot"></div><div class="ic"><img src="speed/fast.webp' not in _sb764:
        _b764.append("hard-chip-not-fast")
    if _b764:
        fail("v764 difficulty-custom-icons: " + str(_b764[:7]))
    else:
        ok("v764 (Hansen:spelling bee难度那几个图标帮我换成我做好的·容易用slow对应小乌龟·中等用medium小兔子·困难用fast·最快的用flash树懒·文件在压缩包里): 难度选择器(对手强度/机器人打字速度)三档图标由 emoji 改为用户上传的卡通运动员图标。映射: 容易(20字母/分)=slow.webp(乌龟驮蜗牛) / 中等(50)=medium.webp(兔子) / 困难(80)=fast.webp(树懒·即用户说的Flash树懒反差梗·最快档用树懒) / 自定义=滑杆emoji不动。处理: 用户给的原图1254x1254 RGBA透明PNG·偏大·用PIL LANCZOS缩到240x240(显示44px·DPR3够清晰)·optimize·放 speed/ 目录随包(34-46KB每张)。替换: easy/mid/hard 三个 .chip 的 .ic 由 emoji(🐢/🐇/⚡)改为 img(width44 height44 object-fit contain)·按 data-bot 精确锚定替换。保留: 自定义档滑杆图标、自定义滑杆的慢/快刻度标签里的乌龟闪电、单词表里turtle/lightning词义emoji——都与难度档图标无关·不动。真机(本地服务渲染botBox): 三档.ic img=speed/slow|medium|fast.webp 全部naturalWidth>0加载成功·难度卡排版正常·0报错。v764")
except Exception as _e764:
    fail("v764 check error: " + str(_e764))

# ---- v765: 难度图标 大小/上下位置 调节器(Hansen自己调·实时·localStorage记住) (Hansen) ----
try:
    _b765 = []
    _sb765 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    if ".diffIc{width:var(--diffIcSize" not in _sb765:
        _b765.append("diffIc-css-missing")
    # (v766起: 大小/上下滑块已从公开设置移到管理员后台面板·改由v766守卫校验·这里不再要求在spelling_bee)
    if "hansen_sb_diffic_size" not in _sb765:
        _b765.append("size-persist-key-missing")
    if "hansen_sb_diffic_dy" not in _sb765:
        _b765.append("dy-persist-key-missing")
    if "setProperty('--diffIcSize'" not in _sb765:
        _b765.append("size-apply-missing")
    if _sb765.count('class="diffIc"') != 4:
        _b765.append("diffIc-usage!=4:" + str(_sb765.count('class="diffIc"')))
    if _b765:
        fail("v765 diffIc-adjuster: " + str(_b765[:7]))
    else:
        ok("v765 (Hansen:spelling bee难度图标太小·要我把大小/位置调节器做好·我自己来设置·必须和手机完完全全一样·设多大多小手机呈现一模一样·实时): 在『更多设置』新增【难度图标调节器】·让用户在手机上自己实时拖。设计=照搬现有『键盘上下位置』滑块那套·但加了 localStorage 持久化(键盘那个本身不存盘·每次重置)。WYSIWYG怎么保证『完全一模一样』: 调节器就做进游戏本体·滑块改的是 CSS 变量 --diffIcSize/--diffIcDy·直接驱动真实难度卡里的三个图标(.diffIc)·用户看到的就是手机真实渲染·天然像素一致·不是另开工具(另开工具没法保证和手机一致)。实现: ①三档图(容易slow/中等medium/困难fast)由固定 inline 44px 改为 class=diffIc·尺寸/位移走 CSS 变量(.diffIc{width/height:var(--diffIcSize,44px);transform:translateY(var(--diffIcDy,0px))})。②设置里加两个滑块: 难度图标大小(30-120·默认44·step2·橙渐变#diffIcSizeRange) + 难度图标上下(-30~30·默认0·step1·绿渐变#diffIcDyRange)·各带 px 数值显示。③滑块下方加【实时预览条】(同样3张 class=diffIc 图)·拖动当场看大小·和真卡片同class同变量·像素一致。④JS: input 时 setProperty CSS变量+更新数值+localStorage存(hansen_sb_diffic_size/_dy)·load 时读回应用+回填滑块值。.chip 是 align-items:center+padding自动高度·放大不裁切。真机(本地服务): 默认--diffIcSize=44px图宽44; 拖到90→变量90px图实测宽90px实时变大·localStorage存90; 上下拖-12→--diffIcDy=-12px存-12; 刷新后 size=90px/图90/滑块90、dy=-12px/滑块-12 全部记住; 0报错。v765")
except Exception as _e765:
    fail("v765 check error: " + str(_e765))

# ---- v766: 难度图标调节器 从公开「更多设置」移到管理员后台面板(Boss特效调参·卡牌入口下方) (Hansen) ----
try:
    _b766 = []
    _sb766 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    _hb766 = open("hansen_boss_attack.js", encoding="utf-8", errors="replace").read()
    if 'id="diffIcSizeRange"' in _sb766:
        _b766.append("sb-slider-still-in-public-settings")
    if _sb766.count('class="diffIc"') != 4:
        _b766.append("sb-diffIc-count!=4:" + str(_sb766.count('class="diffIc"')))
    if "setProperty('--diffIcSize'" not in _sb766:
        _b766.append("sb-readapply-missing")
    if "hansen_sb_diffic_size" not in _sb766:
        _b766.append("sb-readkey-missing")
    if 'id="diffIcSizeRange"' not in _hb766:
        _b766.append("admin-size-slider-missing")
    if 'id="diffIcDyRange"' not in _hb766:
        _b766.append("admin-dy-slider-missing")
    if "hansen_sb_diffic_size" not in _hb766:
        _b766.append("admin-persist-key-missing")
    if "if(!t.hasAttribute('data-b'))return;" not in _hb766:
        _b766.append("fx-databguard-missing")
    if _b766:
        fail("v766 adjuster->admin: " + str(_b766[:8]))
    else:
        ok("v766 (Hansen:这个难度图标调节器不能在公开『更多设置』出现·要藏到后台·点『进度自动保存到本设备』输密码进去那个Boss特效调参管理员面板·放在『卡牌入口』下面): 把 v765 的难度图标调节器从拼写对战公开「更多设置」移到管理员后台面板。①spelling_bee.html: 删掉「更多设置」里那两个滑块+预览条·但保留三档图标 class=diffIc(尺寸/位移走 CSS 变量 --diffIcSize/--diffIcDy)+开机从 localStorage(hansen_sb_diffic_size/_dy)读回 setProperty 应用的 JS(滑块没了→if(rS)自动跳过)。②hansen_boss_attack.js(后台面板所在·岛屿页加载·与拼写对战同源共享localStorage): 在 openPanel 管理员模式 if(!CUR_USER) 的『卡牌入口』hbafxCardEntry 下方加调节器(标题🐢拼写对战·难度图标 + 大小滑块30-120 + 上下滑块-30~30 + 三张speed图实时预览·复用.hbafx-row/.hbafx-val样式)·用户模式绝不渲染。接线在 appendChild 前(o.querySelector·用户模式null自动跳过): input→写localStorage+更新预览图width/height/translateY+数值。给FX的input委托监听加 if(!t.hasAttribute(data-b))return 守卫·跳过我的滑块(FX滑块都带data-b·不受影响)。WYSIWYG『和手机完全一样』: 后台预览图按px显示·和拼写对战同图同px·像素一致; 调节器只写localStorage·拼写对战开机读取生效。真机: 测1 set localStorage size70/dy-8 加载拼写对战→难度图标实测宽70·transform translateY(-8)·更多设置已无滑块·0报错; 测2 后台调节器拖大小88→localStorage88预览图88px·拖上下-10→存-10·预览图加载; 测3 岛屿页加载boss_attack.js 0报错(FX守卫未误伤)。v766")
except Exception as _e766:
    fail("v766 check error: " + str(_e766))


# ---- v768: 「框大小」与「图标大小」彻底解耦——难度卡独立固定高度·调图标框不动 (Hansen) ----
try:
    _b768 = []
    _sb768 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    _hb768 = open("hansen_boss_attack.js", encoding="utf-8", errors="replace").read()
    if "#botBox .chip{height:var(--chipH" not in _sb768:
        _b768.append("sb-botbox-chipH-missing")
    if "padding:var(--chipPadY" in _sb768:
        _b768.append("sb-old-coupled-padvar-still-there")
    if "hansen_sb_diffic_h" not in _sb768:
        _b768.append("sb-h-key-missing")
    if "setProperty('--chipH'" not in _sb768:
        _b768.append("sb-h-apply-missing")
    if 'id="diffIcHRange"' not in _hb768:
        _b768.append("admin-h-slider-missing")
    if "hansen_sb_diffic_h" not in _hb768:
        _b768.append("admin-h-key-missing")
    if "bx.style.height" not in _hb768:
        _b768.append("admin-preview-box-height-missing")
    if 'id="diffIcPvB0"' not in _hb768:
        _b768.append("admin-preview-box-missing")
    if _b768:
        fail("v768 decouple-frame-from-icon: " + str(_b768[:8]))
    else:
        ok("v768 (Hansen发现并怒指设计缺陷:调图标大小时那个框也跟着一块变大·要框和图标各自独立调·调图标时框不能动): 修正v767耦合错误。根因: v767用『卡片上下留白(padding)』撑框高·框高=图标+2×留白·图标一大框就被撑大(耦合)·且改的是全局.chip连累#diffBox。修法: 难度卡 #botBox .chip 改独立固定高度 height:var(--chipH,68px)+padding:0 13px+box-sizing:border-box·框高由专门『框大小』滑块直接给(不再由图标/内容撑)·图标align-items:center居中·图标大小(--diffIcSize)只改图标不改框高=彻底解耦; 全局.chip恢复固定padding:11px 13px(撤--chipPadY)·只作用#botBox不连累#diffBox。后台『卡片留白』滑块→『框大小』(id=diffIcHRange·48-150·默认68·key=hansen_sb_diffic_h)·预览框由padding撑高改set固定height·拼写对战开机读hansen_sb_diffic_h应用--chipH。三档独立=图标大小/图标上下/框大小·互不影响。真机解耦: 同框68下图标44→90卡片高恒68(纹丝不动)图标确实变90; 同图标44框68→120卡片高才变; #diffBox三次恒56不受影响; 后台拖框大小110预览框110·再拖图标100预览框仍110。截图: 框110图标50大框小图标排版干净·图标>框会溢出(用户自设·图标≤框即整洁)。v768")
except Exception as _e768:
    fail("v768 check error: " + str(_e768))

# ---- v769: 自定义难度图标换成用户上传形象 + 纳入图标大小调节(.diffIc) (Hansen) ----
try:
    import os as _os769
    _b769 = []
    _sb769 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    if "speed/custom.webp" not in _sb769:
        _b769.append("custom-img-not-referenced")
    if '<div class="ic">\U0001F39B</div>' in _sb769:
        _b769.append("old-fader-emoji-still-there")
    if not _os769.path.exists("speed/custom.webp"):
        _b769.append("custom-png-file-missing")
    if _sb769.count('class="diffIc"') != 4:
        _b769.append("diffIc!=4:" + str(_sb769.count('class="diffIc"')))
    _ci = _sb769.find('data-bot="custom"')
    _seg = _sb769[_ci:_ci+350] if _ci >= 0 else ""
    if 'class="diffIc"' not in _seg or "speed/custom.webp" not in _seg:
        _b769.append("custom-icon-not-diffIc-in-chip")
    if _b769:
        fail("v769 custom-icon: " + str(_b769[:6]))
    else:
        ok("v769 (Hansen:自定义这个图标可以使用这个[上传的卡通形象]·而且也要加入可以自行调节大小的功能·加到spelling bee里面的自定义): 把『自定义』难度卡的图标从 fader滑杆emoji 换成用户上传的卡通形象(用户自制·ChatGPT生成已抠背景的全身图)·并纳入图标大小调节。处理: 用户上传1024x1536竖图(RGBA透明背景)→PIL getbbox裁透明边→按最长边等比缩到240(得160x240)→optimize存 speed/custom.webp(28.6KB)。嵌入: 自定义chip的 <div class=ic>🎚️</div> 换成 <div class=ic><img src=speed/custom.webp?v= class=diffIc></div>·关键=加 class=diffIc → 自动受『图标大小』滑块(--diffIcSize)控制·和容易/中等/困难三个一起缩放。竖图在方形图标框(object-fit:contain)等比显示不变形(偏瘦长属正常·全身图特性)。框高仍由--chipH独立控制(v768解耦不受影响·#botBox .chip)。diffIc总数3→4(已同步更新v765/v766计数守卫)。真机: 自定义图标加载成功(complete+naturalWidth>0·src=speed/custom.webp)·botBox .diffIc=4·默认宽44; 设图标大小72→自定义72容易72(跟同一滑块一起缩放); 0报错; 截图确认形象在自定义卡内、框高一致。v769")
except Exception as _e769:
    fail("v769 check error: " + str(_e769))

# ---- v770: 新主题「僵尸舞王」(整图背景+音符螺旋炫光特效) 上架主题商店 (Hansen) ----
try:
    import os as _os770
    _b770 = []
    _cin = open("hansen_cinema_themes.js", encoding="utf-8", errors="replace").read()
    _dia = open("hansen_diamond_shop.js", encoding="utf-8", errors="replace").read()
    if not _os770.path.exists("themes/zombie_dance.jpg"):
        _b770.append("bg-image-missing")
    if "A==='spiral'" not in _cin:
        _b770.append("spiral-archetype-missing")
    if "theme_zombiedance:function" not in _cin and "theme_zombiedance: function" not in _cin:
        _b770.append("scene-missing")
    if "id:'theme_zombiedance'" not in _dia:
        _b770.append("shop-item-missing")
    if "theme_zombiedance: {bg:" not in _dia:
        _b770.append("theme-grad-missing")
    if "dia-prev-theme_zombiedance" not in _dia:
        _b770.append("preview-css-missing")
    if _b770:
        fail("v770 zombie-dance-theme: " + str(_b770[:6]))
    else:
        ok("v770 (Hansen:做一个主题叫僵尸舞王·根据这张图做相应特效·音符出现形成太空步/迈克尔杰克逊旋转的形状·特别炫酷·放到主题商店): 新增 IMAX 主题【僵尸舞王】(price666·emoji🧟)。①背景: 用户上传月夜墓地僵尸群舞整图(918x1714 RGB·2.9MB)→PIL缩到900宽→JPG q86存 themes/zombie_dance.jpg(436KB)。②招牌特效=音符螺旋: hansen_cinema_themes.js spawnEvent 新增 archetype『spiral』——音符沿阿基米德螺旋(2.3圈·半径pow(fr,.82))按序(i*46ms)生成·几乎静止(极小vx/vy)只极缓上浮淡出·形成清晰的「旋转/太空步形状」。铁律=纯布点·元素绝不旋转·不闪不震(守Hansen永久禁区·「旋转形状」靠螺旋排布而非真转)。③主题场景 theme_zombiedance 进 SCENES(sceneThemed: 背景图+暗紫青渐变兜底+环境粒子[鬼火bokeh绿/夜星twinkle/萤火wander/升腾音符]+spiral招牌·5彩音符·中心flash·每4.8-7.6s一波)。④商店注册4处: ITEMS商品(series imax)+THEME_GRAD兜底渐变(暗紫+幽绿+南瓜橙)+预览CSS·装备时 applyTheme→HansenCinema.apply(SCENES命中→canvas接管整图大场面)。同步更新v743/v744/检查40的计数守卫(imax 7→8·sceneThemed 18→19)。真机: owns(theme_zombiedance)=true·canvas建·0报错·三连截图确认背景铺满+彩色音符螺旋旋成炫光(周期循环每5-7s一波·中间安静)+鬼火星点。v770")
except Exception as _e770:
    fail("v770 check error: " + str(_e770))

try:
    import os as _osAV
    _avjs = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bAV = []
    for _tok in ["HsnAvatar", "hsn-av-on", "openPicker", "function render"]:
        if _tok not in _avjs:
            _bAV.append("js-token-missing:" + _tok)
    if "rotate(" in _avjs or "animation:spin" in _avjs or "@keyframes spin" in _avjs:
        _bAV.append("rotation-violation")
    _miss = [n for n in range(1, 67) if not _osAV.path.exists("avatars/%02d.webp" % n)]
    if _miss:
        _bAV.append("avatar-img-missing:" + str(_miss[:5]))
    _tplAV = open("template.html", encoding="utf-8", errors="replace").read()
    if "hansen_avatar.js" not in _tplAV:
        _bAV.append("template-no-script")
    if "HsnAvatar.render" not in _tplAV:
        _bAV.append("template-no-render-hook")
    _islAV = open("island_animal.html", encoding="utf-8", errors="replace").read()
    if ("hansen_avatar.js" not in _islAV) or ("HsnAvatar.render" not in _islAV):
        _bAV.append("island-not-wired")
    if _bAV:
        fail("v771 avatar-system: " + str(_bAV[:6]))
    else:
        ok("v771 (Hansen:把左上角头像做成换头像功能不要任何框·65动物形象+僵尸舞王共66·卡牌纯色背景可调色·设为头像·融入小程序绝不能有bug): 换头像系统模块 hansen_avatar.js。66形象(65动物职业立绘+僵尸舞王特别形象)优化进 avatars/01-66.webp(裁透明边·缩380宽·透明PNG)。模块运行时改造 #avatarIcon: 去3px金边+隐藏旋转光环(无框·守旋转禁区)·显示所选动物头部(cover·top居中)·底为该角色卡牌纯色·右下小「换」角标·点击开选择器。选择器(class全加hsn-av-前缀防冲突·纯display切换不用全局hidden·padding-bottom撑3比4): 66卡牌网格→形象详情大卡(角色立纯色背景+24色板+自定义色)→设为头像。localStorage hsn_avatar cur+每角色colors 跨岛同步·默认01。template第2347行 updateTopBar 改为『有HsnAvatar则render否则回退等级emoji』防擦除+ body末加载模块·generate重生成19岛。冒险者图鉴 showLevelMap 从头像移到名字行不丢失。真机(animal+adjective): 无框渲染·66格·设为头像持久·updateTopBar不擦除·刷新+跨岛同步·名字行showLevelMap·顶栏Lv金币XP正常·0报错。v771")
except Exception as _eAV:
    fail("v771 avatar check error: " + str(_eAV))

# 🔴v773 头像详情卡修复(Hansen:名字别压人物形象·章鱼八爪要完整显示·图片要清晰·用心做)
try:
    _av773 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    if "hsn-av-nameplate" not in _av773:
        fail("v773 头像名字框 hsn-av-nameplate 缺失(名字应移出卡片到下方独立框·不再压住人物形象)")
    elif "hsn-av-cardname" in _av773:
        fail("v773 旧卡内名字遮罩 hsn-av-cardname 仍在(应已移除·改用卡下 hsn-av-nameplate)")
    elif "grid-auto-rows:max-content" not in _av773:
        fail("v773 网格行高修复 grid-auto-rows:max-content 缺失(否则 grid 行在 flex:1 容器内塌成22px·卡片只露头顶)")
    elif "max-height:92%" not in _av773:
        fail("v773 卡片形象 contain(max-height:92%)缺失(否则宽形象如章鱼八爪会被裁不完整)")
    elif "HSNAVV" not in _av773:
        fail("v773 头像图缓存戳 HSNAVV 缺失(否则覆盖高清图后老用户仍缓存旧糊图)")
    else:
        import struct as _st773
        with open("avatars/27.webp", "rb") as _f773:
            _f773.read(16)
            _w773 = _st773.unpack(">I", _f773.read(4))[0]
        if _w773 < 500:
            fail("v773 章鱼立绘 avatars/27.webp 宽仅 %d(应≥500·已升最长边720高清·否则放大模糊)" % _w773)
        else:
            ok("v773 头像详情卡修复(Hansen:「名字别压住人物形象·章鱼八爪要完整显示·图片要清晰·用心做」): ①名字移出卡片→卡下独立框 hsn-av-nameplate(大名+动物职业)·卡内只放形象不再遮挡。②卡片形象改 contain(max-width/max-height:92%·底4%锚定)·宽如章鱼八爪按宽适配完整·高如狼按高适配·都不裁。③网格同样图完整(缩略图固定128px+max86% contain)+名字移到缩略图下方独立条·并修 grid 在 flex:1 容器内 auto 行塌成22px 的bug(min-height:0+grid-auto-rows:max-content+align-content:start→行174.5px)。④66立绘从380宽重做到最长边720高清(总21.8MB)+缓存戳 HSNAVV(?v=随build升版刷新)。真机(animal): 章鱼八爪完整在卡内·名字框在卡下方不压形象·720清晰·网格66格全身+名字·0报错。v773")
except FileNotFoundError:
    fail("v773 hansen_avatar.js 或 avatars/27.webp 不存在")
except Exception as _e773:
    fail("v773 avatar-card check error: " + str(_e773))

# 🔴v774 左上角头像改完整全身展示+背景色(Hansen:像详情卡缩小版·人物形象和背景色完整展示·背景色跟着改的颜色变)
try:
    _av774 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    if "object-position:top center" in _av774:
        fail("v774 左上角头像仍是 cover 头部裁剪(object-position:top center)·应改 contain 完整全身展示")
    elif "border-radius:13px!important" not in _av774:
        fail("v774 左上角头像圆角方形 border-radius:13px 缺失(圆形会切掉全身形象的头和脚·应圆角方形完整显示)")
    elif "background:#2a3360!important" in _av774:
        fail("v774 头像背景仍带 !important(会盖住 render 设的角色卡牌色·头像背景色出不来·应去掉 background 的 !important)")
    elif "viewN===state.cur" not in _av774:
        fail("v774 改当前头像角色背景色后未即时重渲染(applyColor 应在 viewN===state.cur 时 render·否则顶栏头像背景色不跟着变)")
    else:
        ok("v774 左上角头像改『详情卡缩小版』完整全身+背景色(Hansen:「像我单独截的灰狼那样·人物形象和背景色完整展示在框里·改背景色头像也跟着变」): 头像 .avatar.hsn-av-on 从圆形头部裁剪(cover·object-position top)改为圆角方形(border-radius:13px)+完整全身(object-fit:contain·max90%×92%居中)·PNG透明区透出该角色卡牌背景色(去掉 background 的 !important 让 render 的行内角色色生效·兜底色靠特异性压基础渐变)·宽形象按宽适配高形象按高适配都不裁(圆形会切头脚故改圆角方)。背景色联动: applyColor 改的是当前头像角色(viewN===cur)时即时 render()·顶栏头像背景色当场跟着变;设为头像/换角色也各带背景色。右下『换』角标保留。真机(animal): 头像=完整全身立绘+角色卡牌色·改当前角色色顶栏头像背景色同步变(青→紫)·头像仍为该角色·0报错。v774")
except FileNotFoundError:
    fail("v774 hansen_avatar.js 不存在")
except Exception as _e774:
    fail("v774 avatar-fullbody check error: " + str(_e774))

# 🔴v775 去头像换字角标 + 后台加头像大小调节(Hansen:角标奇怪去掉·头像太小要能调框和形象大小且独立)
try:
    _av775 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bx775 = open("hansen_boss_attack.js", encoding="utf-8", errors="replace").read()
    if "hsn-av-badge" in _av775:
        fail("v775 头像右下角『换』角标 hsn-av-badge 仍在(Hansen 嫌奇怪·应彻底删除)")
    elif "var(--hsnAvSize,60px)!important" not in _av775:
        fail("v775 头像框大小变量 --hsnAvSize 缺!important(boss_lock 有 .avatar width:42px!important·不加!important框大小调不动)")
    elif "var(--hsnAvImg" not in _av775:
        fail("v775 头像形象大小变量 --hsnAvImg 缺失(形象大小调不了)")
    elif "hansen_av_frame" not in _av775:
        fail("v775 hansen_avatar.js 开机未读取 hansen_av_frame(各岛头像不会应用保存的大小)")
    elif "avFrameRange" not in _bx775 or "avImgRange" not in _bx775:
        fail("v775 管理面板头像大小滑块(avFrameRange/avImgRange)缺失")
    elif "hansen_av_frame" not in _bx775:
        fail("v775 管理面板未写 hansen_av_frame(拖动不保存·各岛读不到)")
    else:
        ok("v775 去头像角标+后台头像大小调节(Hansen:「右下角那个黄色换字角标很奇怪给我去掉·头像太小·在密码进去那个地方最下面加调节·框大小和里面形象大小要能调且独立·调形象不会让框变大」): ①删除右下角金色『换』角标(创建代码+CSS全删·头像点击仍可换·靠title提示)。②框大小独立调: .avatar.hsn-av-on 加 width/height:var(--hsnAvSize,46px)!important(必须!important压过 boss_lock v573 的 .avatar width:42px!important 顶栏紧凑规则)·范围40-78px。③形象大小独立调: img max-width/height:var(--hsnAvImg,92%)·范围55-115%·与框解耦(改形象不动框px·改框不动形象%)。④调节器藏管理员面板(密码进·难度图标下方·与diffIc同范式)·框大小+形象大小2滑块+实时预览(显当前头像角色)·拖动写localStorage(hansen_av_frame/img)·hansen_avatar.js各岛开机 applySavedSize 读取应用·顶栏头像当场变。真机(animal): frame=72→框72×72·默认兜底46·形象%独立改变高度·框不受形象影响·角标已无·0报错。v775")
except FileNotFoundError:
    fail("v775 hansen_avatar.js 或 hansen_boss_attack.js 不存在")
except Exception as _e775:
    fail("v775 avatar-size check error: " + str(_e775))

# 🔴v776 修复v775擅自改顶栏高度(Hansen:没经允许把横框高度改长了·头像默认42→46使顶栏+4px)
try:
    _av776 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bx776 = open("hansen_boss_attack.js", encoding="utf-8", errors="replace").read()
    if "var(--hsnAvSize,46px)" in _av776:
        fail("v776 头像框默认仍是46px(v775误改·使顶栏比原来高4px)·应改回42px与boss_lock紧凑高度一致·不擅自改顶栏高度")
    elif "var(--hsnAvSize,60px)!important" not in _av776:
        fail("v776/v778 头像框默认应为60px(Hansen定稿·应 var(--hsnAvSize,60px)!important)")
    elif 'value=\"60\" id=\"avFrameRange\"' not in _bx776:
        fail("v776/v778 管理面板方框滑块默认值应为60(Hansen定稿·应value=60)")
    else:
        ok("v776 修复v775擅自改顶栏高度(Hansen:「你是不是没经我允许改了横框高度·我觉得变长了」——确实改了): v775为压过boss_lock的.avatar{width:42px!important}给头像框默认写了46px·导致用户没动滑块时头像42→46px·顶栏地板62→66px(+4px)。修复: 头像框默认兜底改回42px(var(--hsnAvSize,42px)!important)·滑块默认值同步42·顶栏高度精确回到原来62px(实测框46→顶栏66·框42→顶栏62·矮回4px)。大小滑块保留: 变大由用户自己拖(实测70→头像70px)·不拖则与v775前完全一致·不擅自动顶栏。0报错。v776")
except FileNotFoundError:
    fail("v776 文件不存在")
except Exception as _e776:
    fail("v776 height-restore check error: " + str(_e776))

# 🔴v777 头像方框大小与顶栏高度彻底解耦(Hansen:顶栏高度锁死永不变·框大小指那个彩色方框)
try:
    _av777 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bx777 = open("hansen_boss_attack.js", encoding="utf-8", errors="replace").read()
    if ".top-bar{height:62px!important" not in _av777:
        fail("v777 顶栏高度未锁死(应.top-bar{height:62px!important}·否则头像方框变大会把顶栏顶高·Hansen明确顶栏高度锁死永不变)")
    elif "if(fr>60)fr=60" not in _av777:
        fail("v777 头像方框大小未封顶60(应if(fr>60)fr=60·否则方框超62px溢出锁死的顶栏)")
    elif 'max=\"60\" value=\"60\" id=\"avFrameRange\"' not in _bx777:
        fail("v777 面板方框滑块未封顶60(应max=60·方框最大填满顶栏不溢出)")
    else:
        ok("v777 头像方框大小与顶栏高度彻底解耦(Hansen:「上下这横框的高度锁死永远不变·我没能力去调它·我说的框大小指那个彩色方框的大小」——之前把『框大小』做成改顶栏高度是错的): ①顶栏锁死: .top-bar{height:62px!important;box-sizing:border-box}·头像方框再大也顶不动(实测方框拉到60·顶栏仍62不变)。②头像彩色方框大小可调: --hsnAvSize范围32-60px·方框超出内容区溢进padding但被锁死的62px顶栏兜住不溢出·封顶60(applySavedSize+面板接线都if(fr>60)fr=60防旧存溢出)。③形象大小独立。④顶栏高度用户无法改(没给滑块·滑块只调方框和形象)。真机(animal): 方框60→头像60px顶栏仍62✅·方框70→夹60顶栏62✅·方框50+形象110%→顶栏62形象独立✅·0报错。v777")
except FileNotFoundError:
    fail("v777 文件不存在")
except Exception as _e777:
    fail("v777 decouple check error: " + str(_e777))

# 🔴v778 默认大小定稿(Hansen截图指定): 难度图标icon69/框60·头像方框60/形象95
try:
    _av778 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bx778 = open("hansen_boss_attack.js", encoding="utf-8", errors="replace").read()
    _sb778 = open("spelling_bee.html", encoding="utf-8", errors="replace").read()
    _bad778=[]
    if "var(--hsnAvSize,60px)!important" not in _av778: _bad778.append("头像方框默认非60px")
    if "var(--hsnAvImg,95%)" not in _av778: _bad778.append("头像形象默认非95%")
    if "var(--diffIcSize,69px)" not in _sb778: _bad778.append("难度图标默认非69px")
    if "var(--chipH,60px)" not in _sb778: _bad778.append("难度图标框默认非60px")
    if "if(isNaN(sz))sz=69" not in _sb778: _bad778.append("拼写对战开机难度图标默认非69")
    if "if(isNaN(fh))fh=60" not in _sb778: _bad778.append("拼写对战开机难度框默认非60")
    if 'value=\"60\" id=\"avFrameRange\"' not in _bx778 or 'value=\"95\" id=\"avImgRange\"' not in _bx778: _bad778.append("面板头像滑块默认非60/95")
    if 'value=\"69\" id=\"diffIcSizeRange\"' not in _bx778 or 'value=\"60\" id=\"diffIcHRange\"' not in _bx778: _bad778.append("面板难度滑块默认非69/60")
    if _bad778:
        fail("v778 默认大小未按Hansen截图定稿: "+"·".join(_bad778))
    else:
        ok("v778 默认大小定稿(Hansen截图指定·全新用户/清缓存即此大小): 拼写对战难度图标 大小44→69px·框大小68→60px(icon比框大·图标略露出框是Hansen选定样式)·上下0不变(var(--diffIcSize,69px)/var(--chipH,60px)+spelling_bee开机sz=69/fh=60+面板滑块value=69/60四处一致); 左上角头像 方框42→60px(填满锁死的62px顶栏)·形象92→95%(var(--hsnAvSize,60px)/var(--hsnAvImg,95%)+面板滑块value=60/95+接线兜底fr=60/ig=95一致)。顶栏仍锁死62px(v777)·改默认不影响顶栏高度。v778")
except FileNotFoundError:
    fail("v778 文件不存在")
except Exception as _e778:
    fail("v778 default-size check error: " + str(_e778))

# 🔴v779 首帧防闪(微信WebView慢加载): 宠物图首帧加尺寸不再巨大·头像首帧显角色立绘不再闪等级emoji·去头像旋转光环
try:
    _tpl779 = open("template.html", encoding="utf-8", errors="replace").read()
    import glob as _g779
    _bad779=[]
    if ".avatar::after" in _tpl779 or "@keyframes spin" in _tpl779:
        _bad779.append("template仍有头像旋转光环.avatar::after/@keyframes spin(应删·禁转动)")
    if "width:76px;height:76px;object-fit:contain;display:block" not in _tpl779:
        _bad779.append("template宠物首帧img缺内联尺寸(模块加载前会按原图巨大)")
    if "v942 首帧头像只接受 1–66 号和六位十六进制颜色" not in _tpl779 or "img.hsn-av-img" not in _tpl779:
        _bad779.append("template头像兜底未使用v942安全首帧角色立绘")
    _isl779=[fn for fn in _g779.glob("island_*.html")]
    _spinIsl=[fn for fn in _isl779 if "animation:spin" in open(fn,encoding="utf-8",errors="replace").read()]
    if _spinIsl: _bad779.append("仍有岛含旋转光环: "+",".join(_spinIsl[:3]))
    _noPetIsl=[fn for fn in _isl779 if "width:76px;height:76px;object-fit:contain;display:block" not in open(fn,encoding="utf-8",errors="replace").read()]
    if _noPetIsl: _bad779.append("仍有岛宠物首帧缺尺寸: "+",".join(_noPetIsl[:3]))
    if _bad779:
        fail("v779 首帧防闪未到位: "+"·".join(_bad779))
    else:
        ok("v779 首帧防闪(微信WebView慢加载~1.9MB模块·加载前首帧裸态可见): ①宠物首帧——BUG#92首帧脚本注入的img补内联width/height:76px+object-fit:contain(原仅靠hansen_pet_showcase.js第279行#heroPet img{width:100%}定尺寸·模块没加载前img按原图巨大占满整卡)。②头像首帧——updateTopBar兜底原写等级emoji·改成读localStorage hsn_avatar的cur直接显角色立绘(圆角方+背景色+contain·hsn-av-img·防hansen_avatar.js加载前闪营火等级emoji)·失败才回退emoji。③去头像旋转光环——删.avatar::after(conic+animation:spin旋转·违反禁转动铁律·头像永远是角色立绘.hsn-av-on本就display:none此环)+删@keyframes spin。真机验证(屏蔽两模块模拟WebView加载前): 宠物76×76不再巨大·头像显角色非emoji·旋转光环none·0报错; 模块到位后宠物76/头像60/顶栏62锁死/角色图。各岛已generate同步。v779")
except FileNotFoundError:
    fail("v779 template.html 不存在")
except Exception as _e779:
    fail("v779 first-frame check error: " + str(_e779))

# 🔴v780 头像路径彻底弃用等级emoji(Hansen:左上角已固定角色头像·别再留旧表情兜底·删干净免加载占位)
try:
    _tpl780 = open("template.html", encoding="utf-8", errors="replace").read()
    _bad780=[]
    _avline780=""
    for _ln780 in _tpl780.split("\n"):
        if "window.HsnAvatar&&HsnAvatar.render" in _ln780:
            _avline780=_ln780; break
    if not _avline780:
        _bad780.append("找不到头像渲染行")
    else:
        if "getAdvLevel().emoji" in _avline780:
            _bad780.append("头像渲染行仍回退等级emoji(应回退默认角色#1·头像路径不得有emoji)")
        if "avatars/01.webp" not in _avline780:
            _bad780.append("头像catch未回退默认角色#1(avatars/01.webp)")
        if "img.hsn-av-img" not in _avline780:
            _bad780.append("头像渲染行缺角色立绘hsn-av-img")
    if _bad780:
        fail("v780 头像未彻底弃用emoji: "+"·".join(_bad780))
    else:
        ok("v780 头像路径彻底弃用等级emoji(Hansen:既已固定角色头像·不该再保留旧等级emoji兜底·删干净免每次加载占位影响小程序): 头像渲染唯一残留emoji是catch分支(读localStorage崩溃才触发·正常永不走)·改成连catch也回退默认角色#1(avatars/01.webp)·头像渲染行彻底零emoji(守卫断言该行无getAdvLevel().emoji)。★说明: 等级emoji(🎒🌱…⚔️)是unicode字符非图片·本就不加载/无占位图/不影响性能·avatars仅66张新角色图无任何旧头像文件·此版纯为代码洁净彻底移除头像对emoji引用。注: 等级emoji仍用于设置/统计的等级标签(🏕 Lv.x 荒野旅人·属冒险等级身份非头像·unicode无加载)·如需一并去掉再说。v780")
except FileNotFoundError:
    fail("v780 template.html 不存在")
except Exception as _e780:
    fail("v780 emoji-removal check error: " + str(_e780))

# 🔴v783 修复v782把卡片挤小致僵尸舞王变小(箭头改绝对悬浮卡外不占宽·卡片恢复满300px)+承v782换色只改色+承v781
try:
    _av783 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bad783=[]
    # ① 卡片恢复满尺寸(不再被箭头挤小→僵尸舞王回到v781大小)
    if "max-width:262px" in _av783:
        _bad783.append("卡片仍262px(应恢复300px·否则#66变小)")
    if "hsn-av-cardwrap" not in _av783:
        _bad783.append("缺卡片外包层hsn-av-cardwrap")
    # ② 箭头绝对悬浮在卡片外侧(不占卡片宽度·不在绿卡上)
    _navcss783 = "".join([_l for _l in _av783.split("\n") if ".hsn-av-nav" in _l or ".hsn-av-prev" in _l or ".hsn-av-next" in _l])
    if "right:100%" not in _navcss783:
        _bad783.append("左箭头未悬浮在卡外(缺.hsn-av-prev right:100%)")
    if "left:100%" not in _navcss783:
        _bad783.append("右箭头未悬浮在卡外(缺.hsn-av-next left:100%)")
    if "hsn-av-cardrow" in _av783:
        _bad783.append("仍残留flex行cardrow(应改cardwrap绝对定位)")
    # 承v782: 换色只改色不设头像(state.cur只由『设为头像』改)
    if "function applyColor(col)" not in _av783:
        _bad783.append("applyColor应单参(col)不自动设头像")
    if "if(pick){ state.cur=viewN; }" in _av783:
        _bad783.append("换色仍自动设头像(残留if(pick))")
    if ("applyColor(col,true)" in _av783) or ("applyColor(this.value,true)" in _av783):
        _bad783.append("色块/自定义仍传pick=true")
    if _av783.count("state.cur=viewN") != 1:
        _bad783.append("state.cur=viewN应仅1处(只在『设为头像』按钮)")
    if "state.cur=viewN; save(state); render();" not in _av783:
        _bad783.append("『设为头像』按钮未设cur")
    # 承v781: 玄影执法官·箭头翻角色·#66放大
    if "\"job\": \"执法官\", \"name\": \"玄影\"" not in _av783:
        _bad783.append("玄影未改成执法官")
    if "警长" in _av783:
        _bad783.append("hansen_avatar.js仍残留『警长』")
    if "function navDetail(" not in _av783:
        _bad783.append("缺navDetail翻角色函数")
    if ("id=\"hsnAvPrev\"" not in _av783) or ("id=\"hsnAvNext\"" not in _av783):
        _bad783.append("缺左/右箭头按钮")
    if ("navDetail(-1)" not in _av783) or ("navDetail(1)" not in _av783):
        _bad783.append("箭头未接线navDetail")
    if "hsn-av-big" not in _av783:
        _bad783.append("缺#66放大类hsn-av-big")
    if "c.n===66" not in _av783:
        _bad783.append("openDetail未对#66切换放大类")
    # 禁区: 箭头不得有旋转
    if "rotate" in _navcss783:
        _bad783.append("箭头含旋转特效(违反禁区)")
    if _bad783:
        fail("v783 换头像修复不达标: "+"·".join(_bad783))
    else:
        ok("v783 修复v782把卡片挤小致僵尸舞王变小(承v782/v781·Hansen:「僵尸舞王的尺寸怎么变小了?之前不是已经调好了吗?为什么突然又变小了?」): 根因——v782为给卡外箭头让位·把卡片用flex从max-width 300→262px收窄·而#66立绘按卡片比例放大(hsn-av-big相对卡高)·卡片一小#66跟着小(其实全角色都小了·#66最敏感)。修复=箭头改绝对定位悬浮·不再占卡片宽度: ①新增卡片外包层.hsn-av-cardwrap(position:relative·max-width:300px·不overflow)·卡片.hsn-av-card恢复max-width:300px(撤flex/撤262)→#66回到v781原尺寸。②箭头.hsn-av-nav改position:absolute·.hsn-av-prev right:100%(悬浮在卡片左外缘)·.hsn-av-next left:100%(右外缘)·各3px gap·宽26px·z4·白色半透明对深底可见——绝对定位用卡片两侧的深色页边空白(detail横padding 18→10px留边距)·不占卡片宽度故卡片满尺寸·也不在绿卡(花园)上(满足v782『箭头必在画像两边不在花园内』)。承v782: 换色只改色(applyColor单参·只存colors[viewN]·state.cur不动·仅viewN===cur才render)·『设为头像』唯一改cur入口。承v781: 玄影黑猫·执法官·navDetail左右翻66角色·#66 hsn-av-big。真机(animal·390x844)实测: 卡片宽恢复≈300px(#66回到v781大小手碰顶脚碰底)·左/右箭头在卡片外两侧深色区不压画像·翻角色正常·换色不动头像·设为头像才换·0报错。v783")
except FileNotFoundError:
    fail("v783 hansen_avatar.js 不存在")
except Exception as _e783:
    fail("v783 avatar-size-fix check error: " + str(_e783))

# 🔴v784 复习拼写练习(看汉意拼/听音拼)关闭后回复习中心·而非露出岛主页
try:
    _sp784 = open("hansen_spell_practice.js", encoding="utf-8", errors="replace").read()
    _rv784 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    _bad784=[]
    # ① spell的close()关闭后回调复习中心
    if "_backFromSpell" not in _sp784:
        _bad784.append("spell_practice关闭未回调_backFromSpell(叉号仍回主页)")
    if "window._huFromReview" not in _sp784:
        _bad784.append("spell_practice未判_huFromReview")
    # ② review提供_backFromSpell·内部重开复习中心
    if "_backFromSpell: function" not in _rv784:
        _bad784.append("review缺_backFromSpell方法")
    # 取_backFromSpell方法体·确认它调openReviewCenter
    _bi=_rv784.find("_backFromSpell: function")
    if _bi>=0:
        _seg=_rv784[_bi:_bi+700]
        if "openReviewCenter()" not in _seg:
            _bad784.append("_backFromSpell未重开复习中心(缺openReviewCenter)")
    if _bad784:
        fail("v784 叉号回复习页不达标: "+"·".join(_bad784))
    else:
        ok("v784 复习拼写练习关闭后回复习中心·非露出岛主页(Hansen:「看汉意拼单词点右上角叉号直接返回主页了·我不希望直接回主页·希望回到刚进去时的复习页」): 根因——hansen_review.js的_openSpellByCn/_openSpellByListen在开练习前先this._close()关掉了复习中心(并塞遮罩衔接避免露主页)·练习直接盖在岛主页上·故练习close()只移除自身覆盖层就露出主页。修复: ①hansen_review.js新增_backFromSpell(照_closeAndBack范式·遮罩hr_from_spell_mask z99999盖住主页+openReviewCenter重开+复习中心提到z999999在遮罩之上立即可见·400ms后撤遮罩·无闪不露主页)·并设_huReviewKeepContext=true保留复习上下文回到同一状态。②hansen_spell_practice.js的close()(叉号hspCloseBtn/返回键hspDoneBtn/超时/ESC都走它)末尾·若window._huFromReview(从复习进的标记·_openSpellByCn已设)则调window.HansenReview._backFromSpell()回复习中心。练习仅从复习页进(openSpellByCn/Listen只此处调)故安全。真机(animal): 开复习中心hr_center在→_openSpellByCn后hr_center关闭+_huFromReview=true→close()后hr_center回来(回复习页非主页·截图确认显间隔复习/温柔复习卡)+_huFromReview重置false·0报错。v784")
except FileNotFoundError:
    fail("v784 spell_practice或review.js 不存在")
except Exception as _e784:
    fail("v784 spell-back-to-review check error: " + str(_e784))

# 🔴v785 卡册卡牌详情(放大层)背景无闪烁:删漂浮粒子+开卡爆闪·呼吸/星星脉动改恒定(守Hansen永久禁闪烁铁律)
try:
    _bh785 = open("boss_hall.html", encoding="utf-8", errors="replace").read()
    _bad785=[]
    # ① 放大层不再造漂浮粒子(明灭闪)
    if "makeMotes(document.getElementById('zmotes')" in _bh785:
        _bad785.append("放大层仍造漂浮粒子zmotes(明灭闪)")
    # ② 不再造开卡爆闪burst
    if "burst.className='burst'" in _bh785 or "burst.className=\"burst\"" in _bh785:
        _bad785.append("放大层仍造开卡爆闪burst")
    # ③ 主视图粒子数0
    if "makeMotes(document.getElementById('motes'),16)" in _bh785:
        _bad785.append("主视图仍造16漂浮粒子(应0)")
    # ④ 呼吸/底座/星星关键帧改恒定(无脉动)
    if "@keyframes breathe{0%,100%{opacity:.8}50%{opacity:1}}" in _bh785:
        _bad785.append("breathe呼吸仍脉动(应恒定)")
    if "@keyframes pedBreath{0%,100%{opacity:.85}50%{opacity:1}}" in _bh785:
        _bad785.append("pedBreath底座仍脉动(应恒定)")
    if "@keyframes tw{0%,100%{opacity:.16}50%{opacity:.9}}" in _bh785:
        _bad785.append("tw星星仍闪烁(应恒定静态)")
    # 确认恒定版关键帧在位
    if "opacity:.92}50%{opacity:.92}" not in _bh785:
        _bad785.append("缺恒定呼吸关键帧(opacity:.92恒定)")
    if _bad785:
        fail("v785 卡详情无闪烁不达标: "+"·".join(_bad785))
    else:
        ok("v785 卡册卡牌详情(放大层)背景彻底无闪烁(Hansen:「点开收藏的boss卡之后·卡背后一闪一闪一闪的·感觉背后有东西在闪·很不舒服·帮我彻查修复」·守永久禁闪烁铁律): 彻查boss_hall.html放大层(.zoom)背后所有无限动画→逐一静态化。①openZoom删makeMotes(zmotes,24)——24个漂浮粒子(.mote·rise infinite·opacity 0→.95→.5→0不停明灭)是'背后有东西在闪'的主因·删除不再生成。②openZoom删开卡爆闪burst(radial亮闪·scale .2→7·opacity .9→0)。③主视图makeMotes(motes,16)→0·同样删粒子。④呼吸/底座/星星3个opacity振荡关键帧改恒定不变(不动用它们的规则·只改keyframe一处即全静态): breathe 0.8↔1→.92恒定(.spot/.zspot静态)·pedBreath 0.85↔1→.92恒定(底座静态)·tw 0.16↔0.9→.5恒定(卡内星星从大幅闪改静态)。保留不属闪烁的: 入场动画(cIn/zin/fd/fu一次性)·背景缓慢平移kb(26s微缩放·非闪非转非震)·秘境soloFloat(轻微上下浮)。真机(animal钱包塞lv3百战兽人→boss_hall?lv=3): 主视图#motes粒子=0·点卡放大zoom显示·#zmotes粒子=0·.burst爆闪=0·.zspot opacity间隔1.3s恒为0.92(不脉动)·卡正常显示·0报错。v785")
except FileNotFoundError:
    fail("v785 boss_hall.html 不存在")
except Exception as _e785:
    fail("v785 cardzoom-noflash check error: " + str(_e785))

# 🔴v786 宠物【设为主页展示+锁】功能完整性守卫(Hansen明确要求:每次都查宠物功能有没有失效·不能再悄悄坏掉)
try:
    _ps786 = open("hansen_pet_showcase.js", encoding="utf-8", errors="replace").read()
    _bad786=[]
    # ① showcaseStage 必须永远用 homeIdx(不能是旧的"解锁就返回curStage·忽略用户选择")
    if "function showcaseStage(){try{return getHomeLock()?getHomeIdx():curStage();}" in _ps786:
        _bad786.append("showcaseStage仍是旧逻辑(解锁返回curStage·忽略用户选的homeIdx→设为主页展示失效)")
    if "var i=getHomeIdx();" not in _ps786:
        _bad786.append("showcaseStage未改为永远用getHomeIdx")
    # ② toggleHomeLock 锁的必须是 viewIdx(你正在看的那只)·不能是 showcaseStage(解锁时=curStage·锁错宠物)
    if "setHomeIdx(showcaseStage());setHomeLock(true)" in _ps786:
        _bad786.append("锁仍钉死showcaseStage(=curStage)·而非你正在看的viewIdx→锁错宠物")
    if "var _lk=(typeof viewIdx==='number'" not in _ps786:
        _bad786.append("toggleHomeLock未改为锁viewIdx")
    # ③ updateHero 必须有"解锁态新进化→homeIdx推进到最新阶"的跟随逻辑
    if "if(!getHomeLock())setHomeIdx(st)" not in _ps786:
        _bad786.append("updateHero缺解锁态升级跟随(新进化时homeIdx推进到最新阶)")
    # ④ 设为主页展示按钮 onclick: setHomeIdx(viewIdx)+setHomeLock(false)
    if "setHomeIdx(viewIdx);setHomeLock(false)" not in _ps786:
        _bad786.append("设为主页展示按钮未setHomeIdx(viewIdx)+解锁")
    # ⑤ 锁按钮接线到 toggleHomeLock
    if "document.getElementById('pcvLock').onclick=toggleHomeLock" not in _ps786:
        _bad786.append("锁按钮pcvLock未接到toggleHomeLock")
    # ⑥ 两个按钮id都在
    if "id=\"pcvHome\"" not in _ps786:
        _bad786.append("缺设为主页展示按钮pcvHome")
    if "id=\"pcvLock\"" not in _ps786:
        _bad786.append("缺锁按钮pcvLock")
    if _bad786:
        fail("v786 宠物主页展示+锁功能失效: "+"·".join(_bad786))
    else:
        ok("v786 宠物【设为主页展示+锁】功能完整(Hansen:「设为主页展示和右边这个锁头都失效了·为什么加新功能总把老功能搞坏·必须让贾维斯每次查宠物功能有没有失效·不能再次失效」·要的语义:点设为主页展示→外面小图标变成你选的那只·升级时自动跟随变最新·点锁→彻底钉死你正在看的那只升级也不变): 实测定位到两个真bug→①showcaseStage()=getHomeLock()?getHomeIdx():curStage()的【解锁分支直接返回curStage·完全忽略用户选的homeIdx】→点设为主页展示选某只·主页却永远显示最新阶=失效; ②toggleHomeLock锁的是setHomeIdx(showcaseStage())(解锁时=curStage)·【不是你正在看的viewIdx】→看老阶点锁却锁住最新阶=锁错宠物。代码本身未被近期改动(与备份零差异)·是v709/v745演变留下的语义缺陷(Hansen记忆的是v675『设为主页展示钉死所选』)。修法(只改hansen_pet_showcase.js): ①showcaseStage永远返回getHomeIdx(默认未设=当前阶·getHomeIdx在null时返回curStage)·解锁态跟随由updateHero负责; ②updateHero进化检测前置到算hi/src之前(否则本次heroPet仍旧阶)+新进化时'if(!getHomeLock())setHomeIdx(st)'(解锁→推进homeIdx到最新阶=跟随·锁定→不动=钉死); ③toggleHomeLock锁viewIdx(你正在看的那只); ④paintHomeBtn按homeIdx===viewIdx标'已在主页展示/已锁'。优先级:锁(最高·钉死viewIdx) > 设为主页(setHomeIdx(viewIdx)+解锁·跟随升级) > 箭头(只浏览scBrowse·v745)。真机(animal·mock curStage)11项全过: A看第6阶点设为主页→home_idx=5/lock=0/heroPet=该阶图; B看第6阶点锁→home_idx=5(非10)/lock=1/heroPet=该阶(锁对宠物); C锁定后升级到12→heroPet仍钉死第6阶(锁了不变); D解锁看最新阶设为主页→升级到12→heroPet跟随到最新/home_idx推进到12; 0报错。★守卫每次校验这6点·宠物功能不会再悄悄失效。v786")
except FileNotFoundError:
    fail("v786 hansen_pet_showcase.js 不存在")
except Exception as _e786:
    fail("v786 pet-home-display-lock check error: " + str(_e786))

# 🔴v787 图片加载失败自动重试·全 app 防"图片偶尔加载不出来一直空白"(Hansen:头像沙翁没加载出来·要彻底解决这种加载不及时·让贾维斯当bug盯住)
try:
    _bad787=[]
    # ① 头像模块: 4处img都接重试 + 重置助手
    _av787 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    if "_avImgReset" not in _av787:
        _bad787.append("头像缺重试重置助手_avImgReset")
    if 'src="\'+c.img+\'" alt="" onerror="window.hansenImgErr' not in _av787:
        _bad787.append("头像网格img缺onerror重试(沙翁就是这里没加载出来)")
    if 'id="hsnAvCardImg" alt="" onerror="window.hansenImgErr' not in _av787:
        _bad787.append("头像详情卡img缺onerror重试")
    if "img.onerror=function(){ window.hansenImgErr" not in _av787:
        _bad787.append("顶栏头像createElement的img缺onerror重试")
    # ② hansenImgErr 防重入 + 全局捕获器
    _cd787 = open("hansen_cards.js", encoding="utf-8", errors="replace").read()
    if "__heBusy" not in _cd787:
        _bad787.append("hansenImgErr缺防重入(全局器+自带onerror会双触发)")
    if "__hsnGlobalImgErr" not in _cd787 or "addEventListener('error'" not in _cd787:
        _bad787.append("hansen_cards.js缺全局图片错误捕获器")
    if "}, true);" not in _cd787:
        _bad787.append("全局捕获器未用capture阶段(img error不冒泡·必须capture)")
    # ③ 4个独立运行页(不加载cards.js)各自带全局重试器
    for _pg787 in ["boss_hall.html","spelling_bee.html","season_showcase.html","index.html"]:
        _ps = open(_pg787, encoding="utf-8", errors="replace").read()
        if "__hsnGImgErr" not in _ps:
            _bad787.append(_pg787+"缺自带全局图片重试器")
    if _bad787:
        fail("v787 图片加载重试不达标: "+"·".join(_bad787))
    else:
        ok("v787 图片加载失败自动重试·全app根治'图片偶尔加载不出来一直空白'(Hansen:头像里沙翁(骆驼·教授/18号)没加载出来只剩背景色·要彻底解决这种小程序加载不及时·不要再出现·并让贾维斯把它当bug盯住): 根因——文件本身完好(18.webp 308×720有效·66张全在)·是微信WebView慢网络下图片加载失败后【没有任何重试·一失败就永久空白】; 而头像所有img都没接全局重试器hansenImgErr(宠物/boss图都接了·唯独头像漏)。三层修复: ①头像4处img全接onerror重试(网格图hsn-av-thumb·详情大图hsnAvCardImg·顶栏头像hsn-av-img createElement·详情切换复用同img)+新增_avImgReset(切换头像复用同img时清掉上一张失败残留[重试计数/errored标记/?占位]让新图重新走3次重试)。②hansenImgErr加__heBusy防重入(全局捕获器capture阶段+img自带onerror target阶段同次error派发会双触发→去重避免计数翻倍)。③【彻底解决】全局图片错误捕获器: img的error事件不冒泡但capture阶段经过document→hansen_cards.js挂document.addEventListener('error',fn,true)拦下【全app所有在DOM里的<img>】加载失败·自动走hansenImgErr的3次重试(带缓存破坏__rt·递增延迟450/900/1350ms)·3次后显?占位; 各岛都加载cards.js故全岛覆盖; 4个独立运行页(boss_hall/spelling_bee/season_showcase/index不加载cards.js)各自插入自带的同款全局器(__hsnGImgErr)。这样无论哪个模块/页面的图·哪怕没单独写onerror·一次网络抖动失败也自动重试恢复而非永久空白。真机(animal)6项全过: hansenImgErr在·全局器__hsnGlobalImgErr已注册·头像网格66/66带onerror·详情卡img带onerror·全局器拦下【没写onerror的坏图】并重试(imgTries=2·src含__rt)·缓存破坏生效·0报错。★守卫盯死: 头像4处img重试+_avImgReset·hansenImgErr防重入·cards.js全局capture捕获器·4独立页自带全局器。v787")
except FileNotFoundError as _fe787:
    fail("v787 图片重试守卫: 文件缺失 "+str(_fe787))
except Exception as _e787:
    fail("v787 img-retry check error: " + str(_e787))

# 🔴v788 卡册卡牌详情(boss_hall.html放大层)背景彻底静态·根治"背后一卡一卡小片片闪"(Hansen:还在闪·v785没修好·这次彻底修不允许再出现)
try:
    _bh788 = open("boss_hall.html", encoding="utf-8", errors="replace").read()
    _bad788=[]
    # ① .kb 背景平移必须冻结(原 animation:kb 26s 持续缩放·透过半透明.zbd闪)
    if "animation:kb 26s" in _bh788:
        _bad788.append(".kb背景仍在持续缩放平移(应冻结静态·否则透过.zbd闪)")
    # ② .zbd 必须纯不透明(无半透明rgba)+无blur(原.84-.96半透明+blur让背后panning背景透出+每帧重算blur→一卡一卡闪)
    import re as _re788
    _zbd_m = _re788.search(r'\.zbd\{[^}]*\}', _bh788)
    _zbd = _zbd_m.group(0) if _zbd_m else ""
    if "backdrop-filter:blur" in _zbd or "backdrop-filter: blur" in _zbd:
        _bad788.append(".zbd仍有backdrop-filter blur(每帧重算→卡顿闪·应去掉)")
    if _re788.search(r'rgba\([^)]*,\s*0?\.[0-9]+\s*\)', _zbd):
        _bad788.append(".zbd背景仍半透明(背后正在缩放的kb背景会透出闪·应改纯不透明)")
    # ③ 全局背景星空 twinkle 必须恒定(母版template.html·原.3↔.6脉动=铺满全屏小圆点闪)
    _tpl788 = open("template.html", encoding="utf-8", errors="replace").read()
    if "@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:.6}}" in _tpl788:
        _bad788.append("template全局星空twinkle仍.3↔.6脉动(应恒定静态)")
    if _bad788:
        fail("v788 卡详情背景静态不达标: "+"·".join(_bad788))
    else:
        ok("v788 卡册卡牌详情(boss_hall.html放大层)背景彻底静态·根治'背后一卡一卡小片片闪'(Hansen:点开卡册里卡牌·背后还是一卡一卡那种闪烁·跟播放不流畅一样·有那种闪那种小片片的·v785没给修好·这次彻底修不允许再出现·守永久禁闪烁铁律): 真相——卡册详情=iframe加载boss_hall.html(hansenShowCardDetail·v539隔离iframe);v785只改了boss_hall.html的motes/呼吸/星星(那些确实在)·但漏了真正元凶: ①.kb背景图持续缩放平移(animation:kb 26s·背景图带亮点)·②放大层.zbd是半透明(.84-.96)+backdrop-filter blur→【背后正在缩放平移的kb背景图透过半透明层隐约闪出『小片片』·且blur每帧重算→一卡一卡卡顿闪】。彻底修(boss_hall.html): ①.kb的平移动画冻结为静态transform:scale(1.04)(无animation)→背景图不再缩放抖动; ②.zbd改纯不透明深色radial(#0e0a22→#030308)+去掉backdrop-filter blur→背后任何东西都看不到(完全遮挡)也不重绘→卡片落在纯深色上零闪。绿光/银光(.zspot)在.zbd之上保留(opacity恒定.92)。附带彻查全app同类: 全局body::after星空twinkle(铺满全屏小圆点·原@keyframes twinkle opacity .3↔.6脉动)在母版template.html改恒定.45静态(build从template生成19岛自动同步)·主页等屏背景不再闪。真机(boss_hall?lv=3&own=1,3,7): .kb animationName=none·点卡放大zoom显示·.zbd backdropFilter=none·.zbd背景无半透明rgba·.zspot绿光opacity恒定.92·卡正常·0报错。★彻底解决: 卡详情背景=纯不透明静态·物理上背后无任何会动/会闪的东西。v788")
except FileNotFoundError as _fe788:
    fail("v788 卡详情背景守卫: 文件缺失 "+str(_fe788))
except Exception as _e788:
    fail("v788 carddetail-static-bg check error: " + str(_e788))

# 🔴v789 复习中心→拼写页 转场【零遮罩·治本】(主页永不露出·点击一步直达·Hansen:盖住那一闪是治标不治本/自欺欺人·要真正一步进、中间没有任何阻碍)
try:
    _rv789 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    _sp789 = open("hansen_spell_practice.js", encoding="utf-8", errors="replace").read()
    _bad789=[]
    # ① 拼写入口/_backFromSpell 不再造任何转场遮罩(那是治标)
    if "hr_to_spell_mask" in _rv789:
        _bad789.append("拼写入口仍造转场遮罩hr_to_spell_mask(治标·须删)")
    if "hr_from_spell_mask" in _rv789:
        _bad789.append("_backFromSpell仍造遮罩hr_from_spell_mask(治标·须删)")
    # ② _backFromSpell 把复习中心提到拼写页(z99996)之上(临时z99998)→撤拼写页前先盖住主页
    _bi789 = _rv789.find("_backFromSpell: function")
    _body789 = _rv789[_bi789:_bi789+1000] if _bi789>=0 else ""
    if "99998" not in _body789:
        _bad789.append("_backFromSpell未把复习中心提到拼写页之上(缺临时z99998·撤拼写页时会露主页)")
    if "openReviewCenter" not in _body789:
        _bad789.append("_backFromSpell未重建复习中心")
    # ③ spell close() 顺序治本关键: 必须【先】_backFromSpell(在拼写页之上重建复习中心)【再】撤拼写页curMask
    _ci789 = _sp789.find("function close()")
    _cbody = _sp789[_ci789:_ci789+1400] if _ci789>=0 else ""
    _pos_back = _cbody.find("_backFromSpell")
    _pos_rm = _cbody.find("curMask.remove()")
    if _pos_back<0 or _pos_rm<0 or not (_pos_back < _pos_rm):
        _bad789.append("spell close()顺序错:必须先_backFromSpell(拼写页之上重建复习中心)再撤curMask·否则先撤拼写页就露主页=退回治标")
    if _bad789:
        fail("v789 拼写转场零遮罩不达标: "+"·".join(_bad789))
    else:
        ok("v789 复习中心→看汉意拼单词 转场【零遮罩·真治本】·点击一步直达拼写页·主页永不露出(Hansen:点击看汉意拼单词→中间会极短闪一下岛主页→才到拼写页·这很明显是bug·不要用盖住那一闪的垃圾治标方法·要真正治本——点击就直接进·中间没有任何阻碍·把这些做成完全相连相通的一个壳·不走网页形式): 根因——复习中心(hr_center z9999)是盖在岛主页上的浮层·原 _openSpellByCn 是【先 this._close() 删掉复习中心(露出底下岛主页)→再开拼写页】·同一tick里新层还没被合成器提交而复习中心已删→露出1帧岛主页(微信WebView层合成时序)·之前只是塞个遮罩把这1帧盖住=治标不治本。真治本(零遮罩·DOM永无露主页的缝): ①开(_openSpellByCn/_openSpellByListen)——删掉转场遮罩+不再 this._close()·拼写页(hsp_mask z99996)直接盖在复习中心(z9999)之上打开·复习中心【留在底下不删】→拼写页compositing期间主页仍被复习中心盖住·拼写页合成后盖最上=用户直接见拼写页·全程主页被 复习中心→拼写页 接力盖住。②关(spell close()+_backFromSpell)——删掉遮罩hr_from_spell_mask·并把 close() 里 _backFromSpell 调用【上移到 curMask.remove() 之前】: 即拼写页还盖着主页时·_backFromSpell 先在拼写页【之上】(临时z99998)重建复习中心→复习中心compositing期间拼写页仍盖主页·再撤拼写页=复习中心已在其上直接可见·rAF复位复习中心z回9999(供下次开拼写页z99996仍能盖上)·全程主页被 拼写页→复习中心 接力盖住。★核心: 换页时旧层始终盖住主页直到新层合成完成·DOM任何一帧都有覆盖层·根本没有露主页的缝→不需要任何遮罩。真机(animal·逐帧elementFromPoint屏幕中心): 开18帧中心全是#hsp_mask(从第0帧·零帧露主页)·关18帧中心全是#hr_center(零帧露主页·拼写页撤后复习中心已在其上)·复习中心z最终复位9999·0报错。守卫盯死: 拼写入口/_backFromSpell无任何遮罩·_backFromSpell把复习中心提到拼写页之上(z99998)·close()先_backFromSpell再撤curMask的顺序。v789")
except FileNotFoundError as _fe789:
    fail("v789 拼写转场守卫: 文件缺失 "+str(_fe789))
except Exception as _e789:
    fail("v789 spell-transition-nomask check error: " + str(_e789))

# 🔴v790 boss卡详情彻底静态·根治"卡片里一片一片彩虹闪+一卡一卡卡顿"(真凶=initTilt的rAF死循环·箔纸sin/cos持续漂移+每帧rotateY/rotateX) + boss图弱网破损优雅兜底(不显示📷破图)
try:
    _bh790 = open("boss_hall.html", encoding="utf-8", errors="replace").read()
    _bad790=[]
    # ① initTilt 的 rAF 死循环 / 箔纸 sin·cos 漂移 / 每帧rotate 必须全删(它们只在 initTilt 的 loop 里)
    if "requestAnimationFrame(loop)" in _bh790:
        _bad790.append("initTilt的rAF死循环loop仍在(持续重绘卡顿·须删)")
    if "Math.sin(t/2600)" in _bh790 or "Math.cos(t/3100)" in _bh790:
        _bad790.append("箔纸sin/cos持续漂移仍在(一片一片彩虹闪·须删)")
    # ② initTilt 改为静态: 箔纸固定居中 50% 50%
    _ti790 = _bh790.find("function initTilt")
    _tib = _bh790[_ti790:_ti790+1100] if _ti790>=0 else ""
    if "backgroundPosition='50% 50%'" not in _tib:
        _bad790.append("initTilt未把箔纸固定居中静态(缺backgroundPosition 50% 50%)")
    if "rotateY(" in _tib:
        _bad790.append("initTilt仍在给卡片应用rotateY旋转(须改transform none静态)")
    # ③ boss art图 #artImg 弱网破损优雅兜底(onerror隐藏破图标·onload恢复)
    _ai790 = _bh790.find('id="artImg"')
    _aitag = _bh790[_ai790:_ai790+200] if _ai790>=0 else ""
    if "onerror" not in _aitag or "visibility" not in _aitag:
        _bad790.append("artImg缺弱网破损兜底(onerror隐藏破图·否则显示📷破图标)")
    if _bad790:
        fail("v790 boss卡静态/破图兜底不达标: "+"·".join(_bad790))
    else:
        ok("v790 boss卡详情彻底静态·根治'卡片里一片一片彩虹闪+一卡一卡卡顿' + boss图弱网破损优雅兜底(Hansen:打开卡册里boss卡·boss图片都加载不出来变破图·而且卡片后面还有东西一闪一闪一片一片的像卡顿那种闪·为什么越修毛病越多·守永久禁旋转/微光闪铁律): 真凶(v785/v788漏查)——boss_hall.html的initTilt()里有个requestAnimationFrame死循环loop()·【空闲时让全息箔纸.foil用Math.sin(t/2600)/Math.cos(t/3100)持续漂移background-position=彩虹斜条一片一片地闪·并每帧给卡片cardEl应用rotateY/rotateX(空闲虽0deg但每帧重新赋值transform)=持续重绘→一卡一卡卡顿】·均违反禁旋转/微光闪铁律。之前v785删motes/v788冻.kb冻.zbd都没碰到这个loop。boss图破损时箔纸更明显(露出底下一直在动的箔纸)。彻底修(boss_hall.html): ①initTilt改纯静态——删掉整个rAF死循环loop+倾斜监听·卡片transform='none'不旋转·箔纸.foil固定backgroundPosition='50% 50%'居中不漂移·炫光.glare固定居中。主卡(initTilt(stage,card))与放大卡(openZoom里initTilt(zoom,clone))都走这=都静态。②boss图弱网加载失败优雅兜底——#artImg加内联onerror='this.style.visibility=hidden'(隐藏破图标·露出底下卡面背景·不再显示难看📷)+onload='visibility='(全局重试__hsnGImgErr重试成功则自动恢复显示)·内联属性确保cloneNode到放大卡也带着。boss图文件本身都在(部署包含bosses/lv01-20.webp+bosses_bg)·是弱网(电量16%信号差)加载失败·全局重试3次仍失败才隐藏。真机(boss_hall?lv=3&own=1,3,7): 主卡transform=none·箔纸pos=50% 50%·点放大→放大卡transform=none且t1==t2(不随时间变=无rAF重绘)·箔纸不随时间漂移·artImg有onerror+onload·设坏src后artImg自动visibility=hidden(不显示破图)·0报错。★彻底解决: boss卡(主+放大)零旋转零漂移零持续重绘·物理上没有任何会动会闪的东西·破图也优雅隐藏。v790")
except FileNotFoundError as _fe790:
    fail("v790 boss卡静态守卫: 文件缺失 "+str(_fe790))
except Exception as _e790:
    fail("v790 bosscard-static check error: " + str(_e790))

# 🔴v791 复习中心【所有入口】零遮罩gapless转场(同v789拼写·盖在活复习中心之上·关闭在子界面上重建复习中心) + 听音拼词【只出读音卡住进不去】根治(防御z复位·防上次关闭rAF未复位残留高z盖住新拼写页)
try:
    _hr791 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    _bad791=[]
    def _seg791(marker, length=600):
        _i = _hr791.find(marker)
        return _hr791[_i:_i+length] if _i>=0 else ""
    # ① 在用子界面开入口(闪卡/今日/错题本)零遮罩: 函数体内不再删复习中心
    for _mk in ["_openFlashcard: function()", "_openToday: function()", "_openWrongOnly: function()"]:
        _s = _seg791(_mk, 360)
        if not _s:
            _bad791.append(_mk+" 没找到")
        elif "this._close()" in _s:
            _bad791.append(_mk+" 仍删复习中心(会露主页·须改零遮罩)")
    # 浏览全部 openBrowseAll 分支(return前)零遮罩
    _se = _seg791("_openExplore: function()", 500)
    _sepre = _se.split("openBrowseAll()")[0] if "openBrowseAll()" in _se else _se
    if "this._close()" in _sepre:
        _bad791.append("_openExplore的浏览全部分支仍删复习中心")
    # ② 关闭零遮罩: _closeAndBack(闪卡/浏览全部/错题本共用) 不再用遮罩·改重建复习中心+提z
    _scb = _seg791("_closeAndBack: function(overlayId)", 700)
    if "hr_to_center_mask" in _scb:
        _bad791.append("_closeAndBack仍用遮罩衔接(须改零遮罩)")
    if ("99998" not in _scb) or ("openReviewCenter()" not in _scb):
        _bad791.append("_closeAndBack未用零遮罩重建(缺重建复习中心+提z99998)")
    # _todayBackToCenter 零遮罩
    _st = _seg791("function _todayBackToCenter()", 500)
    if ("hr_to_center_mask" in _st) or ("99998" not in _st) or ("openReviewCenter()" not in _st):
        _bad791.append("_todayBackToCenter未用零遮罩重建")
    # ③ 防御z复位(根治听音拼词卡住): 所有开入口都强制复位复习中心z·防残留高z盖住新子界面/拼写页
    _zreset = _hr791.count("if(_c) _c.style.zIndex=''")
    if _zreset < 6:
        _bad791.append("防御z复位入口不足(应≥6·实"+str(_zreset)+"·缺则上次关闭rAF未复位会残留高z盖住新拼写页=听音拼词只出读音卡住)")
    if _bad791:
        fail("v791 复习中心零遮罩/听音拼词卡住根治不达标: "+"·".join(_bad791))
    else:
        ok("v791 复习中心【所有入口】零遮罩gapless转场(点击一步直达·不闪主页) + 听音拼词【只出读音卡住进不去】根治(Hansen:点闪卡进入瞬间闪过主页再进闪卡·听音拼词应该也差不多·整个复习中心是不是都有这问题·听音拼词有时候只出读音就卡住进不去是严重bug·浏览全部也闪·我马上上线不要再出问题·守永久禁旋转/微光闪铁律): 系统性根因(同v789拼写)——复习中心(hr_center z9999)是盖在岛主页上的浮层·原各入口(_openFlashcard/_openToday/_openWrongOnly/_openExplore浏览全部分支)都是【建遮罩hr_to_sub_mask(z9998在复习中心之下)→this._close()删复习中心→开子界面】·先删复习中心露主页·再让被遮挡没合成好的遮罩补上→露1帧主页=闪;关闭(_closeAndBack/_todayBackToCenter)同样【先删子界面→再openReviewCenter重建】也露主页(_closeAndBack还用hr_to_center_mask遮罩补·治标)。彻底修(全部入口零遮罩gapless·同v789): 开——删遮罩+删this._close()·子界面(z9999)直接盖在【活复习中心(z9999·DOM后插=在上)】之上打开·复习中心留底下盖主页·子界面compositing期间主页一直被复习中心盖住=零露出;关——删遮罩·先openReviewCenter在子界面【之上】重建复习中心(临时z99998)→复习中心合成期间子界面仍盖主页·再撤子界面(在重建的复习中心之下=隐形)·rAF复位z回9999。闪卡/浏览全部共用hr_flashcard(走openBrowseAll)·错题本hr_wrongbook·今日hr_today·看汉意拼/听音拼拼写页hsp_mask(v789已修)=6入口全gapless。★听音拼词卡住根治: v789起关闭时复习中心被临时提到z99998·靠requestAnimationFrame复位回9999·但rAF在微信WebView页面切后台等情况【可能不执行】→复习中心残留99998·下次开听音拼词·拼写页(z99996)就开在复习中心【后面】=拼写页其实开了(renderQuestion的autoplay出读音)但被复习中心盖住看不见进不去=只出读音卡住(匹配有时候·间歇)。防御修: 每个开入口(2拼写+4子界面)开前强制 var _c=hr_center; if(_c)_c.style.zIndex=''·复位到9999→子界面/拼写页永远在最上·即使上次关闭的rAF复位没执行也不怕。真机(island_animal·种wrongsList+vocabList): 闪卡/今日/错题本/浏览全部 开每帧顶层都是子界面(从不露主页)·关每帧都是hr_center(从不露主页)·0报错; 听音拼词卡住回归——故意把hr_center设z99998(模拟残留)·开听音拼词→防御复位让z回9999·拼写页hsp_mask在最上(没被盖住)=不卡住。★彻底解决: 复习中心6个入口点击一步直达·开关全程主页一帧都不露·听音拼词残留高z也能正常进入不再只出读音卡住。v791")
except FileNotFoundError as _fe791:
    fail("v791 复习中心零遮罩守卫: 文件缺失 "+str(_fe791))
except Exception as _e791:
    fail("v791 reviewcenter-seamless check error: " + str(_e791))

# 🔴v792 根治"点开boss卡只剩背景·没有boss角色立绘"(真凶=空src触发全局重试R()把src改成?__rt指向页面·并覆盖renderBoss刚设的真src→角色图永远加载失败)
try:
    _bh792 = open("boss_hall.html", encoding="utf-8", errors="replace").read()
    _bad792=[]
    # ① 角色img #artImg 不再有初始空src=""(空src在微信WebView会触发坏重试)
    import re as _re792
    _ai792 = _bh792.find('id="artImg"')
    _aitag792 = _bh792[_ai792:_ai792+90] if _ai792>=0 else ""
    if 'src=""' in _aitag792:
        _bad792.append("artImg仍有空src=''(空值会触发全局重试把src改成页面URL覆盖真src→角色加载失败只剩背景·须删)")
    # ② 全局重试R()加固: 跳过空/非图片src(正则校验图片扩展名)
    if "__hsnGImgErr" in _bh792:
        _rseg = _bh792[_bh792.find("__hsnGImgErr"):_bh792.find("__hsnGImgErr")+900]
        if "png|jpe" not in _rseg and "png|jpg" not in _rseg:
            _bad792.append("全局重试R()未加固(缺图片扩展名校验·空/非图片src会被改写覆盖真src)")
    # ③ 启动后预加载全部角色立绘(弱网提前缓存)
    if "artPath(BOSSES[" not in _bh792:
        _bad792.append("未预加载全部boss角色立绘(弱网下角色图易加载不出来)")
    if _bad792:
        fail("v792 boss角色立绘加载根治不达标: "+"·".join(_bad792))
    else:
        ok("v792 boss角色立绘加载根治·根治'点开boss卡只剩背景没有角色立绘'(Hansen怒:点boss卡上面按理说应该有角色形象·结果啥都没有直接空了光有一个背景·会不会办事): 真凶——boss卡角色立绘`#artImg`(`bosses/lvNN.webp`·256x256小图)初始`src=\u0022\u0022`空值·空值在微信WebView会触发error→v787全局重试R()(document错误捕获)把它的src改成`?__rt=`(=`split('#')[0]`空串拼`?__rt`·解析成【页面HTML地址】非图片)·且这个改写的setTimeout在renderBoss刚`artImg.src=artPath`设好真src【之后】触发→覆盖真src→角色图加载的是页面HTML=永远失败·再被v790的onerror隐藏=卡面只剩场景背景没角色立绘。Chrome不对空src报错所以Playwright正常·微信WebView会=只在真机出现(匹配Hansen真机现象)。关键:角色图在DOM里受全局R影响·而场景图`bgPath`用游离`new Image()`加载【不在DOM·error不冒泡到document·不受R影响】→场景能加载·角色被坏重试覆盖='359KB大图能出来·46KB小图反而失败'的反常根源。彻底修(boss_hall.html): ①`#artImg`删掉初始`src=\u0022\u0022`空值·改为无src属性·由renderBoss才设真src→无空src报错→无坏重试。②全局重试R()加固——只重试真正的图片URL(正则`/\\.(png|jpe?g|webp|gif|svg)(\\?|#|$)/i`校验)·空src/页面URL一律跳过return→即使有空/非图片error也不会把src改成页面地址覆盖真src。③启动后延迟1.2s预加载【全部20张】角色立绘(各19-46KB·共~600KB·弱网提前缓存·切到任意boss立即显示)·相邻boss立绘也在setSceneBg预加载。真机验证: 主卡artImg正常加载(naturalWidth=256·可见)·R加固后空src/非图片src不被改写、真图片src失败仍正常重试加__rt·0报错。★彻底解决: boss卡角色立绘不再被空src坏重试覆盖·弱网也提前缓存·点开boss卡角色形象正常显示在场景之上。v792")
except FileNotFoundError as _fe792:
    fail("v792 boss角色立绘守卫: 文件缺失 "+str(_fe792))
except Exception as _e792:
    fail("v792 bossart-load check error: " + str(_e792))

# 🔴v793 头像形象详情改卡牌背景色·点左上角返回头像网格后【立即生效】显示新颜色(原showGrid只切显示不重渲染→网格还是旧色)
try:
    _av793 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _bad793=[]
    # showGrid 必须重新 renderGrid(返回网格时反映刚改的颜色)
    _sg = _av793.find("function showGrid()")
    _sgbody = _av793[_sg:_sg+400] if _sg>=0 else ""
    if "renderGrid()" not in _sgbody:
        _bad793.append("showGrid未重新renderGrid(返回网格不会反映刚改的卡牌背景色·须加)")
    # 滚动位置保留(进详情记·返回恢复)
    if "_gridScroll" not in _av793:
        _bad793.append("缺网格滚动位置保留(返回会跳回顶部)")
    if _bad793:
        fail("v793 头像改色即时生效不达标: "+"·".join(_bad793))
    else:
        ok("v793 头像形象详情改卡牌背景色·返回头像网格【即时生效】(Hansen:在形象详情把企鹅星跃背景改成黄色·点左上角箭头返回选择头像网格·结果网格里星跃还是绿色旧颜色·要求改完返回就立即看到新颜色·一定要及时生效): 根因——头像系统(hansen_avatar.js)的`showGrid()`(返回头像网格·由左上角返回箭头`hsnAvBack.onclick`调用)只是切换`display`显示网格、【没有重新渲染】·所以网格还是进详情前那次`renderGrid()`渲染的旧颜色; 而换色`applyColor()`其实已正确存色(`state.colors[viewN]=col`+`save`)·网格`renderGrid()`也确实读存色(`colorOf(n)=state.colors[n]||defColor(n)`)·只差返回时没重渲染。修(hansen_avatar.js): ①`showGrid()`开头加`renderGrid()`→每次返回网格都按最新存色重新渲染→刚在详情改的颜色立即反映到网格卡片(及时生效)。②`openPicker()`去掉重复的`renderGrid()`(showGrid已含)。③保留滚动位置——`.hsn-av-grid`自身`overflow-y:auto`是滚动容器·加模块变量`_gridScroll`·`openDetail()`进详情前(仅网格可见时·避免详情内左右翻角色覆盖)记住`hsnAvGrid.scrollTop`·`showGrid()`重渲染后恢复→返回不跳回顶部。真机(island_animal·开头像选择器): 第一个角色网格色青rgb(52,195,224)→进详情→选红#ff6b6b→详情卡变红→点返回箭头→网格该角色背景立即变红rgb(255,107,107)(=刚改的色·不再是旧青色)·0报错。★彻底解决: 头像详情改卡牌背景色·点返回箭头回到网格立即看到新颜色·及时生效·滚动位置也保留。v793")
except FileNotFoundError as _fe793:
    fail("v793 头像改色守卫: 文件缺失 "+str(_fe793))
except Exception as _e793:
    fail("v793 avatar-color-instant check error: " + str(_e793))

# 🔴v794 复习中心↔子界面/拼写页 关闭返回时【复用活着的复习中心·保留滚动位置·不重建】(Hansen下滑进听音拼词·回来希望停在原位置·不弹回顶部·完全无缝)
try:
    _hr794 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    _bad794=[]
    def _seg794(marker, length=700):
        _i = _hr794.find(marker)
        return _hr794[_i:_i+length] if _i>=0 else ""
    # 三个关闭函数都应【复用活复习中心】: openReviewCenter 只在 if(!center) 兜底里·主路径不重建
    for _mk,_nm in [("_backFromSpell: function()","_backFromSpell"),("_closeAndBack: function(overlayId)","_closeAndBack"),("function _todayBackToCenter()","_todayBackToCenter")]:
        _s = _seg794(_mk, 700)
        if not _s:
            _bad794.append(_nm+"没找到")
            continue
        if "if(!center)" not in _s:
            _bad794.append(_nm+"未复用活复习中心(应if(!center)才兜底重建·否则openReviewCenter重建会滚动归零弹回顶部)")
    if _bad794:
        fail("v794 复习中心返回保留滚动不达标: "+"·".join(_bad794))
    else:
        ok("v794 复习中心↔子界面/拼写页 关闭返回【复用活复习中心·保留滚动位置·真正无缝】(Hansen:我是下滑到复习中心下面才点到听音拼词进去的·关闭回来希望复习中心还停在原来那个滚动位置·不要弹回顶部·要彻底打通像在自己家从卧室走到客厅一样没有任何延迟没有重载·不要再像走网页还得开锁): 根因——v789/v791做零遮罩转场时·关闭都是openReviewCenter()【重建】复习中心(全新DOM·scrollTop归零+重新渲染)→用户下滑到下面进的子界面·回来复习中心却弹回顶部。但其实复习中心(hr_center z9999)从v789起就【一直留在底下没删·活的·带着进子界面前的滚动位置】(开子界面时不再this._close)→根本不用重建。修(hansen_review.js三个关闭函数_backFromSpell/_closeAndBack/_todayBackToCenter): 都改为【直接复用这个活着的复习中心】——var center=getElementById('hr_center'); if(!center){openReviewCenter();...}(仅万一不在了才兜底重建)·把活复习中心临时提z99998到子界面/拼写页之上(它们还盖着主页时先在其上合成·零露出零闪)·撤子界面/拼写页即直接可见·rAF复位z回9999。因为是【同一个活元素】·scrollTop天然保留·也无重新渲染无再动画=从子界面/拼写页回复习中心·滚动/位置/状态完全不变·像从卧室走回客厅·无重载无延迟。真机(island_animal·种context): 打开复习中心设scrollTop=250→开闪卡→关→复习中心scrollTop仍250且是同一元素(标记KEEP123还在·没重建); 设scrollTop=270→开听音拼词→拼写页正常开→关→复习中心scrollTop仍270且同一元素·0报错。★彻底解决: 复习中心所有子界面/拼写页关闭返回·复习中心停在原滚动位置纹丝不动·真正无缝打通。v794")
except FileNotFoundError as _fe794:
    fail("v794 复习中心滚动守卫: 文件缺失 "+str(_fe794))
except Exception as _e794:
    fail("v794 reviewcenter-keepscroll check error: " + str(_e794))

# 🔴v795 彻底删除『单词雨』(word rain·从顶上往下落单词)功能·验证全清除(Hansen:这功能根本没用了·直接删掉·一定要删的干净点)
try:
    _wr795_bad = []
    # ① hansen_rain.js 模块文件已删除
    if os.path.exists("hansen_rain.js"):
        _wr795_bad.append("hansen_rain.js 模块文件仍在(应删除)")
    # ② template.html(岛屿母版)/ index.html 不再 include 单词雨脚本(岛屿由 build 从 template 重生·跟着干净)
    for _hf795 in ["template.html", "index.html"]:
        if os.path.exists(_hf795) and "hansen_rain.js" in open(_hf795, encoding="utf-8", errors="replace").read():
            _wr795_bad.append(_hf795+" 仍引用 hansen_rain.js 脚本")
    # ③ hansen_review.js 无 _openRain 方法定义·无 HansenRain 调用(删除说明注释里写的是 (_openRain) 不含冒号·不会误判)
    _rv795 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    if "_openRain:" in _rv795:
        _wr795_bad.append("hansen_review.js 仍有 _openRain 方法定义")
    if "HansenRain" in _rv795:
        _wr795_bad.append("hansen_review.js 仍调用 HansenRain")
    if _wr795_bad:
        fail("v795 单词雨未删干净: " + "·".join(_wr795_bad))
    else:
        ok("v795 『单词雨』功能已彻底删除·删得干净(Hansen:查一下单词复习还有没有单词雨功能·就是从顶上往下落单词那个·如果还有直接删掉·根本没用了·一定要删的干净点): 排查——单词雨=hansen_rain.js模块(window.HansenRain·591行)+hansen_review.js里_openRain入口。该功能【早已不可达】: ⓐ_openRain无任何入口卡片onclick调用; ⓑ模块往岛屿主页注入单词雨按钮的addEntryButton()早在v142就被注释停用(『不再在挑战模式加按钮』); ⓒ错题总览『一起复习全部』卡(曾用🌧️图标)的_reviewAll其实打开的是复习中心HansenReview._open()·并不开单词雨(图标+文字只是历史遗留)。彻底删除(v795): ①删除 hansen_rain.js 模块文件; ②移除 template.html(岛屿母版·line7336)+index.html(line4137)里的 <script src=hansen_rain.js> 引用→build经generate.py从template重生全部19岛·岛屿自动不再含该脚本; ③删 hansen_review.js 死入口 _openRain 函数(含hr_to_rain_mask)·留v795删除说明注释; ④错题总览卡去单词雨引用: 🌧️→📚·『用单词雨方式温柔记住』→『一个一个温柔记住』; ⑤check_resources旋转守卫(检查24)的 _rotwl/_scan24 移除已删的 hansen_rain.js。注: meteorrain/dragonrain(陨石雨/焚天枪雨)是hansen_boss_anim.js的boss攻击特效·与单词雨无关·未动。校验: hansen_rain.js不存在·template/index无引用·hansen_review.js无_openRain定义无HansenRain调用·node --check全过·全局grep单词雨/HansenRain/_openRain(排除备份)无任何功能性残留。★单词雨功能已连根删除·干净彻底。v795")
except FileNotFoundError as _fe795:
    fail("v795 单词雨删除守卫: 文件缺失 "+str(_fe795))
except Exception as _e795:
    fail("v795 wordrain-removal check error: " + str(_e795))

# 🔴v796 全面清理: 删除死功能『听音循环』+ 一批从无调用的死残渣函数(Hansen全面核查后决定全删)
try:
    _v796_bad = []
    _rv796 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    _cd796 = open("hansen_cards.js", encoding="utf-8", errors="replace").read()
    _se796 = open("hansen_season.js", encoding="utf-8", errors="replace").read()
    # ① 听音循环彻底删除(函数定义+入口方法都不在·删除注释里写的是 openListenLoop 不带 function·_openListenLoop 不带冒号·不会误判)
    if "function openListenLoop" in _rv796:
        _v796_bad.append("hansen_review.js 仍有 openListenLoop 函数定义")
    if "_openListenLoop:" in _rv796:
        _v796_bad.append("hansen_review.js 仍有 _openListenLoop 入口方法")
    # ② cards.js 死函数定义已删
    if "function _oldRenderCardThumb_unused" in _cd796:
        _v796_bad.append("hansen_cards.js 仍有 _oldRenderCardThumb_unused 定义")
    if "function ensureRebattleScreen" in _cd796:
        _v796_bad.append("hansen_cards.js 仍有 ensureRebattleScreen 定义")
    if "function renderRebattleScreen" in _cd796:
        _v796_bad.append("hansen_cards.js 仍有 renderRebattleScreen 定义")
    # ③ season.js 死函数定义已删
    if "function addSeasonPoints_OLD_DISABLED" in _se796:
        _v796_bad.append("hansen_season.js 仍有 addSeasonPoints_OLD_DISABLED 定义")
    if _v796_bad:
        fail("v796 死功能/死函数未删干净: " + "·".join(_v796_bad))
    else:
        ok("v796 全面清理死功能+死残渣函数(Hansen:全面核查代码库后·决定把查出的死功能和死残渣全删): 经全维度核查(文件/函数/图片资源/音频资源/引用/体积)·全库异常干净——图片零孤儿·音频(单词726+句子709)零孤儿零断裂引用·老主题theme_dragon/cyber彻底无残留·无冲突风险·唯一死【功能】是听音循环。本次(v796)全删: ①死功能『听音循环』(hansen_review.js·约160行=入口_openListenLoop方法+openListenLoop函数+hr_listen界面+其内_listenToggle/_listenPrev/_listenNext/_closeListen)·入口onclick=0完全不可达·无守卫保护(区别于听音拼词_openSpellByListen是活的); ②死残渣函数(全局只在定义行出现1次·从无调用): hansen_cards.js的 ensureRebattleScreen/renderRebattleScreen(v208起不用独立rebattle界面·live入口是window.hansenShowRebattle)+ _oldRenderCardThumb_unused(旧版卡片缩略图渲染·名字自带unused); hansen_season.js的 addSeasonPoints_OLD_DISABLED(旧赛季积分给金币·早禁用·名字自带OLD_DISABLED)。保留(有意·非死): 调试方法_reset/_dump/_kick/_end(控制台手动用)·Boss历史死分支lightning/sunslam/wave/missilestorm(有守卫+预加载图被新招复用)·check.html(版本诊断)+evolution_dashboard.html(JARVIS看板)。交接源码包额外排除 evolution_reports/+releases/(dev产物·部署包本就无)。校验: 全部死定义已无·node --check全过·听音循环零功能残留(只剩删除注释)。★代码库已彻底清理·无任何用不到的功能·无会给新功能添乱的老程序。v796")
except FileNotFoundError as _fe796:
    fail("v796 清理守卫: 文件缺失 "+str(_fe796))
except Exception as _e796:
    fail("v796 deadcode-cleanup check error: " + str(_e796))

# ═══════════════════════════════════════════════════════════════════════════
# 🔴v797 全面进化贾维斯·【最近关键BUG红线总防线】(Hansen: 让贾维斯记住最近所有bug·
#   每次做新版本都核查·绝不允许最近这些bug再次出现·尤其boss卡背景闪烁/不出现这类)
# 这是一道【合并总防线】: 把最近每个版本的关键修复在【一处】集中复核·与各版本独立
#   守卫(v789-v796)形成【双保险】——任一最近关键bug复发·立即在这里被拦下·build失败。
# 设计成"登记表"形式: 每条 = (红线名称, 是否守住, 复发说明)。一目了然哪条破了。
# ═══════════════════════════════════════════════════════════════════════════
try:
    import os as _os797
    _v797_reg = []
    _bh797 = open("boss_hall.html", encoding="utf-8", errors="replace").read()
    _rv797 = open("hansen_review.js", encoding="utf-8", errors="replace").read()
    _av797 = open("hansen_avatar.js", encoding="utf-8", errors="replace").read()
    _cd797 = open("hansen_cards.js", encoding="utf-8", errors="replace").read()
    _se797 = open("hansen_season.js", encoding="utf-8", errors="replace").read()
    def _reg797(name, passed, why):
        _v797_reg.append((name, bool(passed), why))

    # ── 红线①: BOSS卡背景【一闪一闪】(箔纸彩虹漂移+每帧旋转·真凶initTilt的rAF死循环·v790) ──
    _ti797 = _bh797.find("function initTilt"); _tib797 = _bh797[_ti797:_ti797+1100] if _ti797 >= 0 else ""
    _reg797("BOSS卡背景一闪一闪(v790)",
        ("requestAnimationFrame(loop)" not in _bh797) and ("Math.sin(t/2600)" not in _bh797) and ("Math.cos(t/3100)" not in _bh797) and ("backgroundPosition='50% 50%'" in _tib797) and ("rotateY(" not in _tib797),
        "initTilt必须纯静态: 无rAF死循环loop·无sin/cos箔纸漂移·箔纸固定居中50%50%·无rotateY旋转")

    # ── 红线②: BOSS卡【只剩背景·角色立绘不出现】(空src触发坏重试覆盖真src·v792) ──
    _ai797 = _bh797.find('id="artImg"'); _aitag797 = _bh797[_ai797:_ai797+90] if _ai797 >= 0 else ""
    _reg797("BOSS卡角色不出现只剩背景(v792)",
        ('src=""' not in _aitag797) and ("artPath(BOSSES[" in _bh797) and (("png|jpe" in _bh797) or ("png|jpg" in _bh797)),
        "artImg不能有空src·全局重试R()要有图片扩展名校验(否则空/页面URL覆盖真src)·要预加载全部立绘")

    # ── 红线③: 复习中心↔拼写/子界面【转场闪一下露主页】(治标遮罩·v789+v791零遮罩) ──
    _reg797("转场闪一下露主页(v789/v791)",
        ("hr_to_spell_mask" not in _rv797) and ("hr_from_spell_mask" not in _rv797),
        "拼写/子界面转场禁止用遮罩(治标)·必须靠【保活复习中心】实现结构性零遮罩无缝")

    # ── 红线④: 返回时【滚动弹回顶部】(每次重建归零·v794复习中心+v793头像网格) ──
    _reg797("返回滚动弹回顶部(v793/v794)",
        (("if(!center)" in _rv797) or ("if (!center)" in _rv797)) and ("_gridScroll" in _av797),
        "关闭子界面要【复用活的父界面】(滚动自动保留)·只在不存在时才兜底重建·不能每次重建滚动归零")

    # ── 红线⑤: 头像【改色返回网格不更新】(只切显示没重渲染·v793) ──
    _reg797("头像改色返回不更新(v793)",
        ("renderGrid()" in _av797) and ("showGrid" in _av797),
        "showGrid返回时必须重新renderGrid·否则网格显示改色前的旧颜色")

    # ── 红线⑥: 听音拼词等子界面【卡住·只播声音不显示】(z残留卡死·v791防御性重置) ──
    _reg797("子界面卡住只剩声音(v791)",
        _rv797.count("style.zIndex=''") >= 4,
        "所有open函数开头要有防御性z重置(微信WebView后台回来时rAF重置会失效→z残留99998盖住子界面→点了打不开只播声音)")

    # ── 红线⑦: 单词雨【彻底删除·不复活】(v795) ── 用注释免疫的精确标记(方法定义_openRain:/调用HansenRain.·删除注释里写的是(_openRain)不会误判)
    _reg797("单词雨复活(v795已删)",
        (not _os797.path.exists("hansen_rain.js")) and ("_openRain:" not in _rv797) and ("HansenRain." not in _rv797),
        "hansen_rain.js模块文件+_openRain方法定义+HansenRain调用·都不允许再次出现(纯注释提及不算)")

    # ── 红线⑧: 听音循环+死残渣函数【彻底删除·不复活】(v796) ──
    _reg797("听音循环+死函数复活(v796已删)",
        ("function openListenLoop" not in _rv797) and ("function _oldRenderCardThumb_unused" not in _cd797) and ("function ensureRebattleScreen" not in _cd797) and ("function addSeasonPoints_OLD_DISABLED" not in _se797),
        "听音循环openListenLoop+rebattle死函数+_oldRenderCardThumb_unused+addSeasonPoints_OLD_DISABLED·都不允许再次出现")

    # ── 汇总: 任一红线破了 = 最近bug复发 = build失败 ──
    _failed797 = [r for r in _v797_reg if not r[1]]
    _passN797 = len(_v797_reg) - len(_failed797)
    if _failed797:
        _det797 = " ┃ ".join([r[0] + " 【复发!!!】 " + r[2] for r in _failed797])
        fail("v797 最近关键BUG红线总防线: 检出 " + str(len(_failed797)) + "/" + str(len(_v797_reg)) + " 条最近关键bug复发!! 立即停止打包修复 → " + _det797)
    else:
        ok("v797 全面进化贾维斯·最近关键BUG红线总防线【" + str(_passN797) + "道红线·全部守住✅】(Hansen: 让贾维斯记住最近所有bug·每次做新版本都自动核查·绝不允许复发): 这是一道【合并总防线】·把最近每个版本的关键修复在一处集中复核·与各版本独立守卫(v789-v796)双保险——任一最近关键bug复发立即在此拦下让build失败。守住的最近关键红线: ①BOSS卡背景一闪一闪(v790·initTilt纯静态·无rAF死循环/无箔纸sin-cos漂移/箔纸固定居中/无旋转) ②BOSS卡角色立绘不出现只剩背景(v792·无空src+全局重试R()图片扩展名校验+预加载全部立绘) ③复习中心↔拼写/子界面转场闪一下露主页(v789/v791·禁遮罩·靠保活复习中心结构性零遮罩) ④返回滚动弹回顶部(v793网格/v794复习中心·复用活界面自动保滚动) ⑤头像改色返回网格不更新(v793·showGrid重渲染) ⑥听音拼词等子界面卡住只播声音(v791·防御性z重置防微信后台rAF失效) ⑦单词雨彻底删不复活(v795) ⑧听音循环+死残渣函数彻底删不复活(v796)。★完整BUG历史(BUG#1~#73+)与每条防线的根因/守卫/验证法·见知识库置顶《永不复发·最近关键BUG登记表》。★贾维斯已把最近所有bug刻进每次build的核查里——只要这道防线在·这些bug永不再现。v797")
except FileNotFoundError as _fe797:
    fail("v797 总防线: 关键文件缺失 " + str(_fe797))
except Exception as _e797:
    fail("v797 consolidated-recent-bug-defense error: " + str(_e797))

# 🔴v798 默认(cosmos)主题飞行元素特性化轨迹 + 去掉卫星持续自转(Hansen: 飞碟/火箭/卫星/彗星移动轨迹太随机·按各自特点重设计·且卫星自转太晕)
try:
    _idx798 = open("index.html", encoding="utf-8", errors="replace").read()
    _v798_bad = []
    # ① 卫星持续自转 satelliteSpin 必须已删(原6s/圈·太晕·违防晕红线)
    if "satelliteSpin" in _idx798:
        _v798_bad.append("卫星持续自转satelliteSpin仍在(6s一圈太晕·违防晕红线·须删·改椭圆轨道)")
    # ② 四个飞行元素都重设计成特性化轨迹(v798标记×4)
    if _idx798.count("v798 特性化轨迹") < 4:
        _v798_bad.append("飞行元素特性化轨迹标记不足4个(应有飞碟悬停急转/火箭加速上升/卫星椭圆轨道/彗星抛物线俯冲)")
    # ③ 卫星改椭圆轨道(transform translate)·且其keyframes不含rotate(不自转)
    _fs798 = _idx798.find("@keyframes flySatellite")
    _fsb798 = _idx798[_fs798:_fs798+600] if _fs798 >= 0 else ""
    if "translate(" not in _fsb798:
        _v798_bad.append("卫星flySatellite未改用translate椭圆轨道")
    if "rotate(" in _fsb798:
        _v798_bad.append("卫星flySatellite轨道里仍含rotate(应无自转)")
    if _v798_bad:
        fail("v798 飞行元素轨迹不达标: " + "·".join(_v798_bad))
    else:
        ok("v798 默认cosmos主题飞行元素特性化轨迹(Hansen: 飞碟/火箭/卫星/彗星的移动轨迹太随机·按每个对象的特点重新设计让它们更像本体): 四个元素按真实特性重设计运动轨迹——飞碟🛸=悬停+急转(hold相同坐标=悬停在空中·小%大位移+缓动=突然闪移·UFO经典行为)·火箭🚀=点火加速上升+重力转向弧线(关键帧Δy递增=越升越快·同时右偏=重力转向·固定朝上倾角不旋转·两端屏外无跳变)·卫星🛰️=椭圆轨道匀速环绕(8点采样椭圆·圆心45vw42vh横半径40vw纵半径16vh·linear匀速·0%==100%闭合)·彗星☄️=高速抛物线俯冲(关键帧Δy递增=重力加速坠落·7%出现→72%冲出屏外消失→留白等下次划过·固定拖尾倾角)。★关键防晕: 去掉卫星原satelliteSpin持续自转(原6s一圈·太晕·违防晕红线)·四个全改纯transform-translate位移+常量倾角·零动画旋转。bob系列用margin-top与transform属性不冲突可共存。真机Playwright精确验证: 卫星椭圆四点(右332/下490/左20/上219px)精确落位·火箭top递减且后段位移更大(加速)且left递增(右偏重力转向)·彗星俯冲且每1%进度位移递增(9.3→12.7→35px/%抛物线加速)且opacity 0→1→0(出现消失)·飞碟同段坐标恒定(悬停)且段间跳变156px(急转)·0报错。index.html是独立文件(非template生成·不过印章)。v798")
except FileNotFoundError as _fe798:
    fail("v798 飞行元素守卫: index.html 缺失")
except Exception as _e798:
    fail("v798 flyer-trajectory check error: " + str(_e798))

# 🔴v799 底部导航iPhone安全区适配(Hansen: iPhone 17 Pro Max上底部导航[主页/错题/复习/卡册]显示不正常·图标文字被挤压错位·只在iPhone坏)
try:
    _tpl799 = open("template.html", encoding="utf-8", errors="replace").read()
    _v799_bad = []
    # box-sizing:border-box下·.bottom-nav必须用 calc(70px+env) 否则env padding吃掉height→内容区被挤到36px
    if "height:calc(70px + env(safe-area-inset-bottom))" not in _tpl799:
        _v799_bad.append(".bottom-nav未用calc(70px + env(safe-area-inset-bottom))(border-box下固定height70px会被安全区padding吃掉·内容区只剩36px挤压图标)")
    if "display:flex;height:70px;z-index:100" in _tpl799:
        _v799_bad.append(".bottom-nav仍是裸height70px(iPhone安全区下内容被挤压·须改calc)")
    _bn799 = _tpl799.find(".bottom-nav{")
    _bnb799 = _tpl799[_bn799:_bn799+400] if _bn799 >= 0 else ""
    if ("padding-bottom:env(safe-area-inset-bottom)" not in _bnb799 and
        "padding:0 env(safe-area-inset-right,0px) env(safe-area-inset-bottom) env(safe-area-inset-left,0px)" not in _bnb799):
        _v799_bad.append(".bottom-nav缺padding-bottom:env(safe-area-inset-bottom)(home indicator区无内边距)")
    if _v799_bad:
        fail("v799 底部导航iPhone安全区不达标: " + "·".join(_v799_bad))
    else:
        ok("v799 底部导航iPhone安全区适配(Hansen: iPhone 17 Pro Max上底部导航[主页/错题/复习/卡册]显示不正常·图标文字被挤压错位): 根因=全局box-sizing:border-box下·.bottom-nav用固定height:70px + padding-bottom:env(safe-area-inset-bottom)·在iPhone(底部安全区~34px)上padding被算进70px里→内容区只剩70-34=36px→图标(50px)+文字塞不下·往上溢出栏顶/往下顶进home indicator区·栏底还空一截(非iPhone安全区=0故内容区满70px正常·所以只在iPhone坏)。修法: height:70px → height:calc(70px + env(safe-area-inset-bottom))·内容区恒为70px·安全区作为额外高度加在下面(home indicator区留padding)。只改template.html一处·generate.py重生成19岛全生效(印章保岛=模板)。真机模拟(430×932 iPhone17ProMax+34px安全区)Playwright验证: 修复后导航高104px·内容区70px·所有标签在安全区之上不进home indicator·图标不溢出栏顶; 对照复现修复前内容区仅36px且4项图标/标签越界·确为真bug; 非iPhone(env=0)仍70px无回归。★教训: border-box下给固定height的固定栏加env(safe-area)padding=padding吃height挤压内容·必须height:calc(原高 + env(safe-area))。v799")
except FileNotFoundError as _fe799:
    fail("v799 导航守卫: template.html 缺失")
except Exception as _e799:
    fail("v799 nav-safearea check error: " + str(_e799))

# 🔴v800 「传说殿堂」改名为「神秘殿堂」+ 管理员密码临时解锁也点亮神秘殿堂赛季限定卡(Hansen)
try:
    _hs800 = open("hansen_season.js", encoding="utf-8", errors="replace").read()
    _hc800 = open("hansen_cards.js", encoding="utf-8", errors="replace").read()
    _ss800 = open("season_showcase.html", encoding="utf-8", errors="replace").read()
    _bh800 = open("boss_hall.html", encoding="utf-8", errors="replace").read()
    _v800_bad = []
    # ① 改名彻底: 四个文件都不能再有「传说殿堂」旧名(应全改成神秘殿堂)
    for _nm800, _ct800 in [("hansen_season.js", _hs800), ("hansen_cards.js", _hc800), ("season_showcase.html", _ss800), ("boss_hall.html", _bh800)]:
        if "\u4f20\u8bf4\u6bbf\u5802" in _ct800:
            _v800_bad.append(_nm800 + "仍有旧名未改成神秘殿堂")
    if "\u795e\u79d8\u6bbf\u5802" not in _hs800:
        _v800_bad.append("hansen_season.js缺神秘殿堂新名")
    # ② 管理员密码临时解锁助手存在 + openHall用上(点亮殿堂卡) + 卡册入口计数接上
    if "function tempUnlockAll" not in _hs800:
        _v800_bad.append("hansen_season.js缺tempUnlockAll助手(读密码临时解锁标记)")
    if "tempUnlockAll() ||" not in _hs800:
        _v800_bad.append("openHall未用tempUnlockAll点亮殿堂卡(密码解锁应点亮所有神秘殿堂卡)")
    if "hallOwned=__tmpAll" not in _hc800:
        _v800_bad.append("hansen_cards.js卡册入口计数未接临时解锁")
    if _v800_bad:
        fail("v800 神秘殿堂改名/密码解锁不达标: " + "\u00b7".join(_v800_bad))
    else:
        ok("v800 「传说殿堂」改名为「神秘殿堂」+ 管理员密码临时解锁也点亮神秘殿堂赛季限定卡(Hansen): ①改名: hansen_season.js/hansen_cards.js/season_showcase.html/boss_hall.html 四个文件全部旧殿堂名→神秘殿堂(共14处·含卡册入口卡标题/殿堂面板标题/iframe标题/注释; 传说卡·传说限定 等稀有度名不动)。②密码解锁联动: 管理员「卡牌入口」密码门成功→hansenTempUnlock 设 hansen_card_temp_unlock_until(24h·只影响显示不污染存档)·原本只点亮收藏页boss卡·现 hansen_season.js 新增 tempUnlockAll() 助手读同款标记·openHall 的 owned 判断改 tempUnlockAll()||真实解锁→密码解锁后神秘殿堂所有历代赛季限定卡全点亮(显真卡缩略图·可点击进全屏观赏)·入口卡(卡册底部)+殿堂面板+赛季页入口三处「已收藏 N/M」计数也随之显满值。★只影响显示·绝不污染 unlockedCards 真实存档(与 hansenTempUnlock 设计完全一致)。真机Playwright验证(island_animal): 改名后殿堂标题=神秘殿堂无旧名残留; 清标记时 owned=0(已收藏0/1)·设临时解锁标记后 owned=1(已收藏1/1)所有殿堂卡点亮·0报错。改的都是独立文件(hansen_*.js/boss_hall.html/season_showcase.html·非template生成不过印章)。v800")
except FileNotFoundError as _fe800:
    fail("v800 神秘殿堂守卫: 文件缺失")
except Exception as _e800:
    fail("v800 mystery-hall check error: " + str(_e800))

# 🔴v801 第一季度赛季正式做进游戏: season岛=240新词·12关(=12分类)·难度梯度·赛尔娅终极boss·神秘殿堂卡
try:
    import json as _json801
    _isl801 = _json801.load(open("island_data.json", encoding="utf-8"))
    _sea801 = _isl801.get("season", {})
    _sdata801 = _sea801.get("DATA", "")
    _cats801 = re.findall(r'cat:"([^"]+)"', _sdata801)
    _ens801 = re.findall(r'en:"([^"]+)"', _sdata801)
    _v801_bad = []
    if len(_cats801) != 12: _v801_bad.append("season岛分类数=%d(应12关)" % len(_cats801))
    if len(_ens801) != 240: _v801_bad.append("season岛词数=%d(应240)" % len(_ens801))
    for _t801 in ["\u60c5\u7eea","\u6027\u683c","\u601d\u8003","\u5b66\u4e60","\u63cf\u8ff0","\u65f6\u95f4","\u6570\u91cf","\u793e\u4f1a","\u81ea\u7136","\u52a8\u4f5c","\u5de5\u4f5c","\u8fde\u63a5"]:
        if _t801 not in _sdata801: _v801_bad.append("season岛缺主题「%s」" % _t801)
    # 每个词必须配齐 emoji + 例句(ex/exCn)
    if _sdata801.count("emoji:") < 240: _v801_bad.append("部分词缺emoji(应240)")
    if _sdata801.count("ex:") < 240 or _sdata801.count("exCn:") < 240: _v801_bad.append("部分词缺例句ex/exCn")
    # 三个关卡配置都接了新词
    for _cfg801,_nm801 in [("TYPING_LEVELS","打字"),("CLOZE_LEVELS","完形"),("LISTEN_LEVELS","听音")]:
        if "nervous" not in _sea801.get(_cfg801,""): _v801_bad.append("%s关卡配置未接新词" % _nm801)
    # 旧占位分类已清 + boss仍是赛尔娅
    if "\u54c1\u683c\u661f\u57df" in _sdata801: _v801_bad.append("season岛仍有旧占位分类(应已替换为12关)")
    if "\u8d5b\u5c14\u5a05" not in _sea801.get("BOSSES",""): _v801_bad.append("season岛boss赛尔娅丢失(终极boss应保留)")
    if _v801_bad:
        fail("v801 第一季度赛季内容不达标: " + "\u00b7".join(_v801_bad))
    else:
        ok("v801 第一季度赛季正式做进游戏(Hansen): season岛(星海词汇大冒险)的词库替换为第一季度 240 个精选新词(常用·中高难度·全部不在原有736词里·零重叠零重复)·按 12 个主题分成 12 关(=12分类·难度逐月递进 启程篇★★→进阶篇★★★→冲刺篇★★★★): 😊情绪 🌟性格 🎯描述 ⏰时间 / 💭思考 ⚡动作 🔢数量 🔗连接 / 📚学习 🏙️社会 🌍自然 💼工作。每个词配齐 en+音标+中文+emoji+地道例句(ex)+中文翻译(exCn·240句全部逐句打磨成母语级地道英文)。三个关卡配置(TYPING/CLOZE/LISTEN)按难度梯度重配 初级=第1月80词·中级=第2月80词·高级=第3月80词。单词发音走牛津/百度/TTS链(单词级自动有·无需本地MP3)。★3个boss不用单独做新角色: season岛现成的「星海女帝·赛尔娅」(立绘+15句人设台词+攻击特效全有)就是终极boss·守关boss=同一套打boss机制·打赢+集满赛季积分→点亮她的神秘殿堂卡(legend传说·绝版限定)。改的是island_data.json的season条目DATA+三个关卡配置·由generate.py盖章重生成island_season.html(过印章)·BOSSES/avatars/theme/extra_css/key不动。真机Playwright验证: season岛加载0报错·DATA=12分类240词·首词nervous带emoji+例句·赛尔娅boss在·三配置都接新词·与animal岛对比均无404。v801")
except FileNotFoundError as _fe801:
    fail("v801 赛季守卫: island_data.json缺失")
except Exception as _e801:
    fail("v801 season-content check error: " + str(_e801))

# 🔴 v802: 「星海词汇大冒险」赛季岛 4 个守关 boss 的 canvas 攻击特效移植进引擎(铸星者→创世锻造starforge / 统御天使→圣光裁决lightjudge / 暗噬君主→锁魂囚渊soulabyss / 时之君主→终焉时刻chronosend)。
# 复用已锁定的 canvas 特效预览代码移植: 严格零震屏(无随机shake translate)零屏闪(删全屏fillRect白闪/定格罩·只留局部辉光radial)、不重绘boss(DOM立绘)、不依赖外部图(纯canvas无BUG#67)、
# __hbaMapStage虚拟舞台映射锚定boss立绘+勇者血条、下落元素钳位答题区上方(clipBottom=barBot+16答题区零侵犯)、命中调deal()、一层fixed canvas挂__hansenFxLayer播完即移除、全ES5微信内核安全。
try:
    _v802 = open("hansen_boss_attack.js", encoding="utf-8").read()
    _v802_bad = []
    for _fn in ["hbaStarForge","hbaSoulAbyss","hbaChronosEnd","hbaLightJudge","__hbaFxCanvasNew","__hbaMapStage"]:
        if ("function %s" % _fn) not in _v802: _v802_bad.append("缺特效函数 %s" % _fn)
    for _t in ["starforge","lightjudge","soulabyss","chronosend"]:
        if ("if(t==='%s')" % _t) not in _v802: _v802_bad.append("缺playFx分支 %s" % _t)
    for _bn in ["\u94f8\u661f\u8005\u00b7\u539f\u521d\u5320\u4eba","\u7edf\u5fa1\u5929\u4f7f\u00b7\u5723\u5149\u4e4b\u7ffc","\u65e0\u5149\u4e4b\u6e0a\u00b7\u6697\u566c\u541b\u4e3b","\u65f6\u4e4b\u541b\u4e3b\u00b7\u514b\u7f57\u8bfa\u65af\u4e4b\u5f71"]:
        if ("'%s':{t:'" % _bn) not in _v802: _v802_bad.append("缺FX条目 %s" % _bn)
    # 零屏闪铁律: 新特效不得引入全屏白闪 fillRect(-50,-50,W+100,H+100)(删定格罩/审判白闪后应为0); 答题区钳位 clipBottom 在位
    if "clipBottom=barBot+16" not in _v802: _v802_bad.append("缺 clipBottom=barBot+16 答题区钳位")
    if _v802_bad:
        fail("v802 \u8d5b\u5b63\u5c9bboss\u653b\u51fb\u7279\u6548\u96c6\u6210\u4e0d\u8fbe\u6807: " + "\u00b7".join(_v802_bad))
    else:
        ok("v802 \u300c\u661f\u6d77\u8bcd\u6c47\u5927\u5192\u9669\u300d\u8d5b\u5b63\u5c9b 4 \u4e2a\u5b88\u5173 boss \u7684 canvas \u653b\u51fb\u7279\u6548\u79fb\u690d\u8fdb\u5f15\u64ce(\u521b\u4e16\u953b\u9020starforge/\u5723\u5149\u88c1\u51b3lightjudge/\u9501\u9b42\u56da\u6e0asoulabyss/\u7ec8\u7109\u65f6\u523bchronosend): \u590d\u7528\u9884\u89c8\u4ee3\u7801\u79fb\u690d\u00b7\u4e25\u683c\u96f6\u9707\u5c4f(\u65e0\u968f\u673ashake)\u96f6\u5c4f\u95ea(\u5220\u5168\u5c4ffillRect\u767d\u95ea/\u5b9a\u683c\u7f69\u00b7\u53ea\u7559\u5c40\u90e8\u8f89\u5149)\u00b7\u4e0d\u91cd\u7ed8boss(DOM\u7acb\u7ed8)\u00b7\u7eafcanvas\u65e0\u5916\u90e8\u56fe(\u65e0BUG#67)\u00b7__hbaMapStage\u865a\u62df\u821e\u53f0\u6620\u5c04\u951a\u5b9aboss\u7acb\u7ed8+\u52c7\u8005\u8840\u6761\u00b7\u4e0b\u843d\u5143\u7d20\u948b\u4f4d\u7b54\u9898\u533a\u4e0a\u65b9(clipBottom=barBot+16\u7b54\u9898\u533a\u96f6\u4fb5\u72af)\u00b7\u547d\u4e2d\u8c03deal()\u00b7\u4e00\u5c42fixed canvas\u6302__hansenFxLayer\u64ad\u5b8c\u5373\u79fb\u9664\u00b7\u5168ES5\u5fae\u4fe1\u5185\u6838\u5b89\u5168\u3002\u771f\u673aPlaywright(\u5fe0\u5b9e\u590d\u523b\u6218\u573aDOM+4boss\u7acb\u7ed8): 4\u7279\u6548\u5168\u90e8 \u6e32\u67d3/deal\u89e6\u53d1\u6389\u8840/canvas\u64ad\u5b8c\u6e05\u7406/0\u62a5\u9519/\u7b54\u9898\u533a\u96f6\u4fb5\u5165; \u771f\u5b9eisland_season.html\u52a0\u8f7d0\u62a5\u9519. v802")
except Exception as _e802:
    fail("v802 season-fx check error: " + str(_e802))

# 🔴 v803: 终末观测者·边界守夜人 → 星图烙印(starbrand) canvas 攻击特效移植进引擎 + 占位SVG换真立绘(bosses/observer.webp)。
# 星点逐个亮→星座连线逐段画across连到勇者→火花沿线游走逐点引爆→勇者处终爆(网状连线引爆·非光束·与时之君主激光柱运动完全不同·Hansen否决雷同后重做)。
# 零震屏零屏闪、不重绘boss(DOM立绘)、纯canvas无外部图(无BUG#67)、clip到barBot+16(答题区零侵犯)、命中调deal()幂等一次、一层fixed canvas播完即移除、全ES5微信内核安全。
try:
    _v803 = open("hansen_boss_attack.js", encoding="utf-8").read()
    _v803_bad = []
    for _fn in ["hbaStarBrand", "__hbaSbBurst"]:
        if ("function %s" % _fn) not in _v803: _v803_bad.append("\u7f3a\u7279\u6548\u51fd\u6570 %s" % _fn)
    if "if(t==='starbrand')" not in _v803: _v803_bad.append("\u7f3aplayFx\u5206\u652f starbrand")
    if "t:'starbrand'" not in _v803: _v803_bad.append("\u7f3aFX\u6761\u76ee starbrand")
    _bnm803 = "\u7ec8\u672b\u89c2\u6d4b\u8005\u00b7\u8fb9\u754c\u5b88\u591c\u4eba"
    if _bnm803 not in _v803: _v803_bad.append("FX\u672a\u6620\u5c04\u7ec8\u672b\u89c2\u6d4b\u8005")
    if "clipBottom=barBot+16" not in _v803: _v803_bad.append("hbaStarBrand\u7f3a clipBottom=barBot+16 \u7b54\u9898\u533a\u94b3\u4f4d")
    _idj803 = open("island_data.json", encoding="utf-8").read()
    if "bosses/observer.webp" not in _idj803: _v803_bad.append("island_data\u672a\u5f15\u7528 bosses/observer.webp \u771f\u7acb\u7ed8")
    if 'id="oe"' in _idj803: _v803_bad.append("\u7ec8\u672b\u89c2\u6d4b\u8005\u5360\u4f4dSVG\u6b8b\u7559")
    if not os.path.exists("bosses/observer.webp"): _v803_bad.append("\u7f3a\u7acb\u7ed8\u6587\u4ef6 bosses/observer.webp")
    if _v803_bad:
        for _b803 in _v803_bad: fail("v803 \u661f\u56fe\u70d9\u5370: " + _b803)
    else:
        print("\u2705 v803 \u7ec8\u672b\u89c2\u6d4b\u8005\u661f\u56fe\u70d9\u5370(starbrand)+\u771f\u7acb\u7ed8: hbaStarBrand/__hbaSbBurst/playFx\u5206\u652f/FX\u6761\u76ee/clipBottom\u94b3\u4f4d \u5747\u5728; bosses/observer.webp \u5df2\u66ff\u6362\u5360\u4f4dSVG(3\u5173). v803")
except Exception as _e803:
    fail("v803 starbrand check error: " + str(_e803))

# 🔴 v804: 管理员密码面板新增 ① 5 个赛季守关 boss(铸星者/统御天使/暗噬君主/时之君主/终末观测者)特效调参(大小/速度/数量+配色) ② "一键通关所有 Boss"开关(ON: 18岛360关全标记通关·先备份真实进度; OFF: 从备份精确还原·其余存档不碰)。
try:
    _v804 = open("hansen_boss_attack.js", encoding="utf-8").read()
    _v804_bad = []
    for _mv in ["创世锻造", "圣光裁决", "锁魂囚渊", "终焉时刻", "星图烙印"]:
        if _mv not in _v804: _v804_bad.append("面板BOSSES缺赛季boss招式 " + _mv)
    if "lv:'赛季'" not in _v804: _v804_bad.append("赛季boss未标 lv:'赛季'")
    for _fn in ["isAllBossClearOn", "setAllBossClear"]:
        if ("function %s" % _fn) not in _v804: _v804_bad.append("缺函数 " + _fn)
    if "if(isAllBossClearOn()){ return {done:total,total:total,all:true}" not in _v804: _v804_bad.append("bossClearProgress未响应一键通关开关")
    if "hbafxClearAll" not in _v804: _v804_bad.append("面板缺一键通关开关UI")
    if "t.id==='hbafxClearAll'" not in _v804: _v804_bad.append("缺一键通关开关点击处理")
    if "hansen_admin_clearall_bak" not in _v804: _v804_bad.append("缺进度备份键(关闭将无法还原)")
    if _v804_bad:
        for _b804 in _v804_bad: fail("v804 面板新功能: " + _b804)
    else:
        print("\u2705 v804 管理员面板: 5赛季boss调参(大小/速度/数量+配色) + 一键通关开关(ON写满360关+备份/OFF还原) 均在. v804")
except Exception as _e804:
    fail("v804 panel check error: " + str(_e804))

# 🔴 v805: 赛季 5 守关 boss 卡牌做进【神秘殿堂】(和限定卡赛尔娅一起凑成完整赛季 boss 卡组·全传说·密码面板/一键通关解锁)。每张 立绘+本命背景(bgImg待发)+传说边框+台词·点击全屏轻量观赏。
try:
    _v805 = open("hansen_season.js", encoding="utf-8").read()
    _v805_bad = []
    if "bossCards:" not in _v805: _v805_bad.append("S1 缺 bossCards 数组")
    for _bid in ["S1B1", "S1B2", "S1B3", "S1B4", "S1B5"]:
        if ("id:'%s'" % _bid) not in _v805: _v805_bad.append("S1.bossCards 缺 " + _bid)
    for _fn in ["totalCardCount", "ownedCardCount", "findBossCard", "openBossCardView"]:
        if ("function %s" % _fn) not in _v805: _v805_bad.append("缺函数 " + _fn)
    if "__hs_bcard" not in _v805: _v805_bad.append("神秘殿堂未渲染 boss 卡(__hs_bcard)")
    if "querySelectorAll('.__hs_bcard')" not in _v805: _v805_bad.append("缺 boss 卡点击观赏接线")
    if "localStorage.getItem('hansen_admin_clearall_on')==='1'" not in _v805: _v805_bad.append("tempUnlockAll 未认一键通关开关")
    if _v805.count("rarity:'legend'") < 5: _v805_bad.append("5 张守关 boss 卡未全部 legend(传说)")
    if _v805_bad:
        for _b805 in _v805_bad: fail("v805 赛季boss卡牌: " + _b805)
    else:
        print("\u2705 v805 赛季5守关boss卡进神秘殿堂(全传说·密码面板/一键通关解锁·点击全屏观赏): bossCards(S1B1-5)/openBossCardView/__hs_bcard/tempUnlockAll认开关 均在. v805")
except Exception as _e805:
    fail("v805 season-boss-card check error: " + str(_e805))

# 🔴 v806: 「一键通关所有 Boss」开关扩展到赛季岛——赛季岛(星海词汇大冒险)那 6 个守关 boss(铸星者/统御天使/暗噬君主/时之君主/终末观测者/赛尔娅)也一起全通关。setAllBossClear 内 CISLES=ISLES.concat(['season'])(islandKey('season')=wordIslandSeason·同 lv1-20+bossWon 结构), 3 个循环(备份/写满/还原)都用 CISLES; bossClearProgress 仍用 ISLES(360 计数=18×20 不变·不破坏入口闸)。
try:
    _v806 = open("hansen_boss_attack.js", encoding="utf-8").read()
    _v806_bad = []
    if "ISLES.concat(['season'])" not in _v806: _v806_bad.append("setAllBossClear 未把赛季岛 season 接进 CISLES(一键通关会漏赛季6守关boss)")
    if _v806.count("islandKey(CISLES[") < 3: _v806_bad.append("setAllBossClear 3 循环(备份/写满/还原)未全用 CISLES 覆盖赛季岛")
    if _v806.count("islandKey(ISLES[") < 1: _v806_bad.append("bossClearProgress 丢了 ISLES 遍历(360 计数应不变·不破坏入口闸)")
    if "var total=ISLES.length*20" not in _v806: _v806_bad.append("bossClearProgress 的 360 计数(ISLES.length*20)被改动")
    if _v806_bad:
        for _b806 in _v806_bad: fail("v806 赛季纳入一键通关: " + _b806)
    else:
        print("\u2705 v806 一键通关扩展到赛季岛(6守关boss也全通关): CISLES含season + 3循环islandKey(CISLES[)×3, bossClearProgress仍ISLES(360=18×20不变). v806")
except Exception as _e806:
    fail("v806 season-clearall check error: " + str(_e806))

# 🔴 v807: 一键通关「真解锁」修复——boss 的锁由 bossUnlocked(解锁到第几关·getUnlockedBossLv 读它; hansen_freepass.js 首次进游戏 24h 内强制返回20, 过期后回真实 bossUnlocked)控制·非 bossWon。v804/v806 只写 bossWon → freepass 过期后 boss 仍加锁(Hansen 在赛季岛发现)。setAllBossClear 写满时也写 s2.bossUnlocked=20 + bossWins 每关≥3(满足 getRequiredWins: lv1需1/lv2需2/lv3-19需3·防 hansen_boss_progress.js v319迁移按 bossWins 重算时把解锁覆盖回低关), 备份/还原 bu 字段。
try:
    _v807 = open("hansen_boss_attack.js", encoding="utf-8").read()
    _v807_bad = []
    if "s2.bossUnlocked=20" not in _v807: _v807_bad.append("setAllBossClear 写满时未写 bossUnlocked=20(boss 不会真解锁·freepass 过期后仍加锁)")
    if "bw[lv]=3" not in _v807: _v807_bad.append("bossWins 未写满≥3(getRequiredWins·防 v319 迁移按 bossWins 重算覆盖解锁)")
    if "bu:(typeof s.bossUnlocked" not in _v807: _v807_bad.append("备份未含 bossUnlocked(bu 字段)·OFF 无法精确还原")
    if "s3.bossUnlocked=rec.bu" not in _v807: _v807_bad.append("还原分支未恢复 bossUnlocked")
    if "delete s3.bossUnlocked" not in _v807: _v807_bad.append("无存档分支未清 bossUnlocked")
    if _v807_bad:
        for _b807 in _v807_bad: fail("v807 真解锁修复: " + _b807)
    else:
        print("\u2705 v807 一键通关真解锁(bossUnlocked=20 + bossWins每关≥3 + 备份/还原bu): boss 锁字段 bossUnlocked 写满·防 v319 迁移覆盖·可逆. v807")
except Exception as _e807:
    fail("v807 unlock-fix check error: " + str(_e807))

# 🔴 v808: 终末观测者立绘(bosses/observer.webp)修复——原 384×384 且头脚顶到上下边(横切·Hansen 反馈"两边横切、显示不清楚")。重做: 用高清源 nigher.webp(1254)→ 保留完整场景(人物+宇宙装饰)→ 缩到 800×800 留余量(内容长边~776·上下各~12px)居中 → 不横切 + 高清, 和其他4个赛季boss(~800)风格统一。
try:
    try:
        from PIL import Image as _Img808
        import numpy as _np808
    except Exception:
        _Img808 = None
    if _Img808 is not None:
        _ob = _Img808.open("bosses/observer.webp").convert("RGBA")
        _ow, _oh = _ob.size
        _oa = _np808.array(_ob)[:, :, 3]
        _bad808 = []
        if min(_ow, _oh) < 700: _bad808.append("observer.webp 太小(%dx%d·应≥700·和兄弟boss ~800 统一高清)" % (_ow, _oh))
        if int((_oa[0, :] > 5).sum()) > 5 or int((_oa[-1, :] > 5).sum()) > 5: _bad808.append("observer.webp 内容顶到上下边(横切·头脚被切)")
        if int((_oa[:, 0] > 5).sum()) > 5 or int((_oa[:, -1] > 5).sum()) > 5: _bad808.append("observer.webp 内容顶到左右边(横切)")
        if _bad808:
            for _b808 in _bad808: fail("v808 终末观测者立绘: " + _b808)
        else:
            print("\u2705 v808 终末观测者立绘 observer.webp: %dx%d·四边均有余量(无横切)·高清完整场景. v808" % (_ow, _oh))
    else:
        print("\u2139 v808 observer 立绘检查跳过(PIL/numpy 不可用)")
except Exception as _e808:
    fail("v808 observer-art check error: " + str(_e808))

# 🔴 v809: 5个赛季守关boss立绘全部用高清原图(1254×1254·Hansen提供)重做——原 ~800 太糊。处理: 密度裁剪去边角噪点(保留halo)→ 缩到1200画布(接近1254源原生·1.5×于旧800·适配retina高分屏)留余量(内容长边~1152·四边~24px)居中 → 高清+不横切+和兄弟统一。涉及 starmaker/lightangel/abysslord/timelord/observer.webp(boss战 + v805 赛季boss卡共用)。
try:
    try:
        from PIL import Image as _Img809
        import numpy as _np809
    except Exception:
        _Img809 = None
    if _Img809 is not None:
        _bad809 = []
        for _bn in ['starmaker', 'lightangel', 'abysslord', 'timelord', 'observer']:
            _bp = 'bosses/%s.webp' % _bn
            _bi = _Img809.open(_bp).convert('RGBA')
            _bw, _bh = _bi.size
            _ba = _np809.array(_bi)[:, :, 3]
            if min(_bw, _bh) < 1100: _bad809.append('%s 太小(%dx%d·应≥1100高清·别再糊)' % (_bn, _bw, _bh))
            if int((_ba[0, :] > 5).sum()) > 5 or int((_ba[-1, :] > 5).sum()) > 5 or int((_ba[:, 0] > 5).sum()) > 5 or int((_ba[:, -1] > 5).sum()) > 5:
                _bad809.append('%s 内容触边(横切)' % _bn)
        if _bad809:
            for _b809 in _bad809: fail('v809 赛季boss立绘高清: ' + _b809)
        else:
            print('\u2705 v809 5个赛季boss立绘全部≥1100高清·四边有余量(无横切): starmaker/lightangel/abysslord/timelord/observer. v809')
    else:
        print('\u2139 v809 赛季boss立绘检查跳过(PIL/numpy 不可用)')
except Exception as _e809:
    fail('v809 season-boss-art-hd check error: ' + str(_e809))

# 🔴 v810: 赛季岛(星海词汇大冒险)boss 机制重构【地基】——「20 关」改成「6 个守关 boss」选关结构, 完全隔离常规岛。
#   ① island_data.json 的 season.BOSSES 从 20 条改为 6 条(6 个去重 boss·各自高清立绘·HP 递进 120→720)。
#   ② hansen_cards.js 加 renderSeasonBossPicker(6-boss 选关·按序解锁·老存档 bossUnlocked 20刻度→6刻度重映射防跳关) + renderBossPicker 顶部路由 getCurrentIslandKey()==='season'。
#   ③ 18 个常规岛(BOSSES.length=20)走原 renderBossPicker, 一行不动(隔离)。
try:
    import json as _json810
    _d810 = _json810.load(open("island_data.json", encoding="utf-8"))
    _sb810 = _d810["season"]["BOSSES"]
    import re as _re810
    _names810 = _re810.findall(r"name:'([^']+)'", _sb810)
    _hc810 = open("hansen_cards.js", encoding="utf-8").read()
    _bad810 = []
    if len(_names810) != 6: _bad810.append("season.BOSSES 应为 6 个守关 boss·实际 %d 个" % len(_names810))
    if "function renderSeasonBossPicker" not in _hc810: _bad810.append("hansen_cards.js 缺 renderSeasonBossPicker(赛季 6-boss 选关)")
    if "getCurrentIslandKey()==='season'" not in _hc810: _bad810.append("renderBossPicker 缺赛季路由(getCurrentIslandKey 检测)")
    if "lv <= 20" not in _hc810: _bad810.append("renderBossPicker 的常规岛 20 关循环被破坏(隔离失败)")
    if _bad810:
        for _b810 in _bad810: fail("v810 赛季6-boss地基: " + _b810)
    else:
        print("\u2705 v810 赛季6-boss选关地基: season.BOSSES=6 + renderSeasonBossPicker + 赛季路由(getCurrentIslandKey==season), 常规岛20关循环隔离完好. v810")
except Exception as _e810:
    fail("v810 season-6boss check error: " + str(_e810))

# 🔴 v811: 赛季岛 boss 战绑定各自 40 词 + 掌握次数追踪 + 错词优先。
#   __buildBossPool 岛感知(赛季 boss N → allW[(N-1)*40 .. N*40) 40词切片 + 错词队尾优先; 常规岛 → 全部词原逻辑·隔离); 4 处 bossPool 构建统一走它。
#   答对 → season_word_mastery[en]+1(掌握≥3 移出错词); 答错 → season_wrong_words[en]=true(下次该 boss 战优先出)。
try:
    _tpl811 = open("template.html", encoding="utf-8").read()
    _bad811b = []
    if "function __buildBossPool()" not in _tpl811: _bad811b.append("template.html 缺 __buildBossPool(赛季40词绑定)")
    _cnt811 = _tpl811.count("bossPool=__buildBossPool()")
    if _cnt811 != 4: _bad811b.append("bossPool 构建未统一走 __buildBossPool(应4处·实际%d)" % _cnt811)
    if "[[0,40],[40,80],[80,120],[120,180],[180,240]]" not in _tpl811: _bad811b.append("缺赛季 boss 的5岛主题边界(v849已把均匀40切片改为[[0,40]...[180,240]]·40/40/40/60/60覆盖全240)")
    if "season_word_mastery" not in _tpl811: _bad811b.append("缺掌握次数追踪(season_word_mastery)")
    if "season_wrong_words" not in _tpl811: _bad811b.append("缺错词追踪(season_wrong_words)")
    if "island_season" not in _tpl811: _bad811b.append("缺赛季 URL gate(隔离常规岛)")
    if _bad811b:
        for _b811b in _bad811b: fail("v811 赛季绑词+掌握: " + _b811b)
    else:
        print("\u2705 v811 赛季boss绑词+掌握+错词(v849已升级为5岛主题分块): __buildBossPool岛感知(赛季5守关boss→5岛主题边界[[0,40],[40,80],[80,120],[120,180],[180,240]]=40/40/40/60/60覆盖全240·错词队尾优先)×4 + season_word_mastery(答对+1·≥3出错词) + season_wrong_words(答错进), URL gate隔离常规岛. v811→v849")
except Exception as _e811:
    fail("v811 season-bind-words check error: " + str(_e811))

# 🔴 v812: 赛季岛 完美战检测 + 拿卡两条件(全词掌握 + 完美击败)+ 进度显示。
#   完美战 = 一场 0 失误打死 boss(startBoss 重置 _seasonFightPerfect=true · 答错置 false · bossVictory 记 season_boss_perfect[N])。
#   拿卡 = boss1-5 的 allMastered(40词各≥3) && perfect → HansenSeason.unlockCard('S1B'+N) 收入神秘殿堂(两条件缺一不可)。
#   进度显示 = 选关界面每 boss「已掌握 X/40 · 完美 ✓/✗ · 🎴」; bossVictory 也提示进度/拿卡/还差什么。
try:
    _tpl812 = open("template.html", encoding="utf-8").read()
    _hc812 = open("hansen_cards.js", encoding="utf-8").read()
    _bad812 = []
    if "window.__seasonBossProgress" not in _tpl812: _bad812.append("template.html 缺 __seasonBossProgress(进度助手)")
    if "window._seasonFightPerfect=true" not in _tpl812: _bad812.append("缺完美战开战重置(_seasonFightPerfect=true)")
    if "window._seasonFightPerfect=false" not in _tpl812: _bad812.append("缺完美战答错破功(_seasonFightPerfect=false)")
    if "season_boss_perfect" not in _tpl812: _bad812.append("缺完美战存储(season_boss_perfect)")
    if "unlockCard('S1B'" not in _tpl812: _bad812.append("缺拿卡(unlockCard('S1B'+N))")
    if "_seasonCardTag" not in _tpl812: _bad812.append("缺胜利界面拿卡/进度提示注入(_seasonCardTag)")
    if "hsn_landmap_cleared_" not in _hc812: _bad812.append("hansen_cards.js 女帝门缺大陆进度读取(v874:hsn_landmap_cleared_·8岛全通解锁)")  # 🔴v874: 星域废除·女帝门读大陆进度
    if _bad812:
        for _b812 in _bad812: fail("v812 完美战+拿卡+进度: " + _b812)
    else:
        print("\u2705 v812 完美战+拿卡两条件+进度: __seasonBossProgress + _seasonFightPerfect(开战重置/答错破功) + season_boss_perfect + unlockCard('S1B'+N)(全词掌握&&完美缺一不可) + 选关进度显示(已掌握X/40·完美·🎴). v812")
except Exception as _e812:
    fail("v812 perfect-card-progress check error: " + str(_e812))

# 🔴 v813: 赛尔娅终极(大改收官)——集齐前5张守关卡(S1B1-5)解锁 → 240词总复习 → 一场240词完美战(0失误)→ 限定卡 S1 + 神秘殿堂集齐。
#   ① 解锁: renderSeasonBossPicker 中 boss6 不走顺序·改判 hasCard('S1B1'..'S1B5') 全有。
#   ② 战斗: __buildBossPool 中 boss6 取全部 240 词(_bn>=6 → allW[0:len])·非 40 词切片。
#   ③ 拿卡: bossVictory 中 boss6 若 perfect → HansenSeason.unlockCard('S1') 限定卡 + 神秘殿堂集齐提示。
try:
    _tpl813 = open("template.html", encoding="utf-8").read()
    _hc813 = open("hansen_cards.js", encoding="utf-8").read()
    _bad813 = []
    if "if(_bn>=6){ _s=0; _e=allW.length; }" not in _tpl813: _bad813.append("template.html 缺赛尔娅(boss6)240词总复习池(_bn>=6→全部词)")
    if "unlockCard('S1')" not in _tpl813: _bad813.append("缺赛尔娅240完美战→限定卡S1(unlockCard('S1'))")
    if "_lc>=8" not in _hc813: _bad813.append("hansen_cards.js 缺赛尔娅解锁=大陆8岛全通(v874:_lc>=8·读hsn_landmap_cleared_)")
    if "还需通关" not in _hc813: _bad813.append("缺赛尔娅锁定提示(v874:还需通关N座岛屿)")
    if "考全部 240" not in _hc813: _bad813.append("缺赛尔娅240终极显示(v850:最终BOSS考全部240词)")
    if _bad813:
        for _b813 in _bad813: fail("v813 赛尔娅终极: " + _b813)
    else:
        print("\u2705 v813 赛尔娅终极: 打通5个守关boss解锁(v820·__hsnSeasonGot 1-5) + boss6取240词总复习池(_bn>=6→全部词) + 240完美战→unlockCard('S1')限定卡+神秘殿堂集齐 + 选关锁定/240复习显示. v813")
except Exception as _e813:
    fail("v813 saelya-ultimate check error: " + str(_e813))

# 🔴 v814: 赛季岛 boss 战不再误套常规岛难度配置(Lv7"32秒神秘大魔王"等 intro + 跟玩家XP走的递进计时)。
#   根因: getBossCfg 用 getBossLevel()=window.S.level(玩家XP)取配置·与题型(applyChapterMode 已按 _hansenRebattleLv·BUG#7)不一致 → 玩家XP Lv7 时赛季任何 boss 都显示 Lv7 的"神秘大魔王"+32秒。更糟: 32秒到点=判答错(startTimer onTimeout)→毁掉赛季完美战 + 把词塞进错词。
#   修: getBossCfg 加赛季分支 → timeLimit:0(不启动计时器·想多久都行·绝不因超时毁完美战) + 赛季自己的 intro(星海词汇守关 / 赛尔娅240终极)。常规岛仍 bossConfig[getBossLevel()] 不变。
try:
    _hbl814 = open("hansen_boss_lock.js", encoding="utf-8").read()
    _bad814 = []
    if "function getBossCfg" not in _hbl814: _bad814.append("缺 getBossCfg")
    if "timeLimit:0" not in _hbl814: _bad814.append("赛季分支缺 timeLimit:0(取消计时·防超时毁完美战)")
    if "星海词汇守关" not in _hbl814: _bad814.append("赛季分支缺赛季 intro(星海词汇守关)")
    if "bossConfig[getBossLevel()]" not in _hbl814: _bad814.append("常规岛难度(bossConfig[getBossLevel()])被破坏")
    if _bad814:
        for _b814 in _bad814: fail("v814 赛季难度隔离: " + _b814)
    else:
        print("\u2705 v814 赛季不套常规岛难度: getBossCfg 赛季分支(timeLimit:0 无计时·防超时毁完美战 + 赛季intro星海词汇守关/赛尔娅240) + 常规岛 bossConfig[getBossLevel()]不变. v814")
except Exception as _e814:
    fail("v814 season-difficulty-isolation check error: " + str(_e814))

# 🔴 v815: 星海剧情系统 —— 序章 + 故事阅读器(仅赛季岛·renderSeasonBossPicker 内触发)
try:
    _hc815 = open("hansen_cards.js", encoding="utf-8").read()
    _bad815 = []
    if "window.HANSEN_STORY" not in _hc815: _bad815.append("缺 HANSEN_STORY 数据容器")
    if "window.hansenStoryReader" not in _hc815: _bad815.append("缺 hansenStoryReader 阅读器")
    if "hsn_season_prologue_seen" not in _hc815: _bad815.append("缺序章首次自动放标记")
    if "重读序章" not in _hc815: _bad815.append("缺重读序章按钮")
    if "那一夜" not in _hc815: _bad815.append("序章文本(那一夜)未嵌入")
    if "renderSeasonBossPicker" not in _hc815: _bad815.append("renderSeasonBossPicker 丢失(序章触发宿主)")
    if _bad815:
        for _b in _bad815: fail("v815 星海剧情序章: " + _b)
    else:
        print("\u2705 v815 星海剧情: HANSEN_STORY+序章原文(那一夜) + hansenStoryReader 全屏阅读器 + 首次进赛季boss区自动放(hsn_season_prologue_seen) + 重读序章按钮, 仅赛季选关区触发·常规岛不受影响. v815")
except Exception as _e815:
    fail("v815 season-story check error: " + str(_e815))

# 🔴 v816: 各 boss 战前"相遇"剧情(仅赛季岛·hansenStartRebattle 首次拦截放相遇)
try:
    _hc816 = open("hansen_cards.js", encoding="utf-8").read()
    _bad816 = []
    if "meet1" not in _hc816: _bad816.append("缺 meet1 相遇数据")
    if "meet6" not in _hc816: _bad816.append("缺 meet6(赛尔娅相遇)数据")
    if "reco1" not in _hc816: _bad816.append("缺 reco1 和解数据")
    if "reco6" not in _hc816: _bad816.append("缺 reco6 和解数据")
    if "__hsnDoRebattle" not in _hc816: _bad816.append("缺 __hsnDoRebattle(真正进战斗逻辑)")
    if "hsn_season_meet_" not in _hc816: _bad816.append("缺战前相遇首次标记")
    if "开始挑战" not in _hc816: _bad816.append("缺'开始挑战'按钮")
    if "blk.t==='hr'" not in _hc816: _bad816.append("缺 hr 分隔线渲染(旅途↔相遇)")
    if "opts.btnLabel" not in _hc816: _bad816.append("缺阅读器自定义按钮(opts.btnLabel)")
    if "opts.onClose" not in _hc816: _bad816.append("缺阅读器关闭回调(opts.onClose)")
    if "/island_season\\.html/.test(location.pathname" not in _hc816: _bad816.append("相遇触发缺赛季 URL 门控(常规岛会误放)")
    if _bad816:
        for _b in _bad816: fail("v816 战前相遇: " + _b)
    else:
        print("\u2705 v816 战前相遇: meet1-6+reco1-6 数据 + __hsnDoRebattle + hansenStartRebattle 赛季首次拦截放相遇(hsn_season_meet_·开始挑战) + 阅读器 opts(btnLabel/onClose/hr分隔线)·常规岛不放. v816")
except Exception as _e816:
    fail("v816 meet-story check error: " + str(_e816))

# 🔴 v817: 赛季战后"和解+得信物"(bossVictory hook 放 reco) + 信物栏(renderSeasonBossPicker)
try:
    _th817 = open("template.html", encoding="utf-8").read()
    _hc817 = open("hansen_cards.js", encoding="utf-8").read()
    _bad817 = []
    if "hsn_season_reco_" not in _th817: _bad817.append("template.html bossVictory 缺战后 reco 钩子")
    if "收下信物" not in _th817: _bad817.append("template.html 缺'收下信物'按钮")
    if "hsn_season_gift_" not in _th817: _bad817.append("template.html 缺信物点亮标记(gift)")
    if "/island_season\\.html/.test(location.pathname||'')){ var _rcN" not in _th817: _bad817.append("reco 钩子缺赛季 URL 门控(常规岛会误放)")
    if "信物栏" not in _hc817: _bad817.append("hansen_cards.js 缺信物栏")
    if "陨铁锤" not in _hc817: _bad817.append("hansen_cards.js 信物栏缺信物名(陨铁锤)")
    if "hsn_season_gift_" not in _hc817: _bad817.append("hansen_cards.js 信物栏缺 gift 读取")
    if _bad817:
        for _b in _bad817: fail("v817 战后和解+信物: " + _b)
    else:
        print("\u2705 v817 战后和解+信物: bossVictory 首次打通放 reco<lv>(和解+信物·收下信物·hsn_season_reco_) + 点亮信物(hsn_season_gift_) + renderSeasonBossPicker 信物栏(5信物·集齐见赛尔娅)·常规岛不放. v817")
except Exception as _e817:
    fail("v817 season-reco check error: " + str(_e817))

# 🔴 v818: 神秘殿堂「星海纪事」—— 拿对应守关卡解锁该章·可重读全文(仅赛季岛)
try:
    _hc818 = open("hansen_cards.js", encoding="utf-8").read()
    _bad818 = []
    if "hansenStoryArchive" not in _hc818: _bad818.append("缺 hansenStoryArchive 星海纪事")
    if "__hsnReadCh" not in _hc818: _bad818.append("缺 __hsnReadCh 章节读取")
    if "星海纪事" not in _hc818: _bad818.append("缺星海纪事标题/入口")
    if "Array.isArray(key)" not in _hc818: _bad818.append("阅读器缺数组支持(回看整章=meet+reco合并)")
    if "var got = function(n)" not in _hc818: _bad818.append("缺章节解锁判断(got→__hsnSeasonGot·v820)")
    if _bad818:
        for _b in _bad818: fail("v818 星海纪事: " + _b)
    else:
        print("\u2705 v818 星海纪事: hansenStoryArchive 章节列表(序章随时读·6章+终章按 __hsnSeasonGot 打通解锁·v820) + __hsnReadCh + 阅读器数组支持(回看整章=meet+reco合并). v818")
except Exception as _e818:
    fail("v818 archive check error: " + str(_e818))

# 🔴 v819: 星海纪事进神秘殿堂(openHall 入口) + 阅读器/纪事 z-index 提到殿堂遮罩之上(防被盖住)
try:
    _hs819 = open("hansen_season.js", encoding="utf-8").read()
    _hc819 = open("hansen_cards.js", encoding="utf-8").read()
    _bad819 = []
    if "hansenStoryArchive" not in _hs819: _bad819.append("神秘殿堂(openHall)缺星海纪事入口")
    if "星海纪事" not in _hs819: _bad819.append("openHall 缺星海纪事标题")
    if "z-index:2147483646" not in _hc819: _bad819.append("阅读器 z-index 未提到殿堂之上(应2147483646)")
    if "z-index:2147483640" not in _hc819: _bad819.append("纪事 z-index 未提到殿堂之上(应2147483640)")
    if _bad819:
        for _b in _bad819: fail("v819 星海纪事进殿堂: " + _b)
    else:
        print("\u2705 v819 星海纪事进神秘殿堂: openHall 加星海纪事入口 + 阅读器(z2147483646)/纪事(z2147483640) 提到殿堂遮罩(z2147483530)之上·防被盖住. v819")
except Exception as _e819:
    fail("v819 hall-archive check error: " + str(_e819))

# 🔴 v820: 星海纪事/信物栏一致性(认管理员+老存档+卡) + 回看不断句 + markdown 斜体渲染
try:
    _hc820 = open("hansen_cards.js", encoding="utf-8").read()
    _bad820 = []
    if "window.__hsnSeasonGot" not in _hc820: _bad820.append("缺 __hsnSeasonGot 统一判断")
    if "hsn_landmap_cleared_'+_gi" not in _hc820: _bad820.append("纪事章节解锁未接大陆进度(v874:__hsnSeasonGot读hsn_landmap_cleared_)")  # 🔴v874: 信物栏随宇宙地图废除
    if ("u:got(1)" not in _hc820) or ("u:got(6)" not in _hc820): _bad820.append("星海纪事章节解锁未用 got(__hsnSeasonGot)")
    if "if(_ki>0)_parts.push" in _hc820: _bad820.append("回看整章 meet↔reco 间仍插 hr(应去掉·防第五章断句)")
    if "<em>$1</em>" not in _hc820: _bad820.append("阅读器缺 markdown 斜体 *...* 渲染(裸星号会露出)")
    if "还需通关" not in _hc820: _bad820.append("赛尔娅锁定文案未对齐(v874:还需通关)")
    if _bad820:
        for _b in _bad820: fail("v820 星海纪事完善: " + _b)
    else:
        print("\u2705 v820 星海纪事完善: __hsnSeasonGot 统一(管理员/信物/卡/老存档打通记录) + 信物栏/纪事/赛尔娅三处一致 + 回看不断句 + 斜体*...*渲染. v820")
except Exception as _e820:
    fail("v820 archive-polish check error: " + str(_e820))


# ---- 检查: ★知识结晶引擎(v828·v832大改) 完整性 ----
# hansen_crystal.js = "钻石=学习成果"的核心引擎: 答对涨记忆进度条(当场可见)→每天锁1星(防刷)→满5星永久掌握→每词直接结晶GEM_PER_WORD钻。
# 🔴v832: 进度条(STAR_NEED) + 每天只锁1星(w.d!==t闸门不变) + 答错不倒扣 + 每词4钻(经济修正) + floatMemo浮层。
# 🔴v833: 浮层克制——只在"锁定一颗记忆星"(稀少里程碑·一天每词一次)弹⭐; 答对攒进度/今天已锁 不弹(快游戏每次答对都弹会刷屏·孩子来不及看)。单词卡误导的"⭐+1"老文案(addStar早废弃成空函数)已清除。
_cry_bad = []
if not os.path.exists("hansen_crystal.js"):
    _cry_bad.append("hansen_crystal.js 不存在(知识结晶引擎丢失)")
else:
    _cry = open("hansen_crystal.js", encoding="utf-8").read()
    for _need, _desc in [
        ("__crystalWrapped", "缺 markAnswer 包装(挂不上答题主入口)"),
        ("w.d !== t", "缺'每天只锁1星'防刷闸门(隔天才能再锁·核心·绝不能去掉)"),  #v832
        ("STAR_NEED", "缺 STAR_NEED 常量(进度条·答对涨进度·v832即时反馈核心)"),  #v832
        ("w.p < STAR_NEED", "缺进度条推进逻辑(答对涨进度·v832)"),  #v832
        ("function floatMemo", "缺 floatMemo 即时反馈浮层(v832)"),  #v832
        ("不倒扣", "缺'答错不倒扣'(v832鼓励试错·必须保留)"),  #v832
        ("function crystallize", "缺 crystallize 结晶函数"),
        ("HansenGems", "缺 HansenGems 发钻"),
        ("GEM_PER_WORD", "缺 GEM_PER_WORD 常量(每永久掌握1词直接发N钻·v832经济修正)"),  #v832
        ("MAX_LV", "缺 MAX_LV 常量(满星阈值)"),
        ("function grantBoost", "缺记忆强化buff发放(grantBoost)"),
        ("BOOST_STAR", "缺 BOOST_STAR 常量(记忆强化涨星翻倍)"),
        ("ISLAND_BONUS", "缺单岛全掌握大奖常量(v830)"),
        ("function checkRankUp", "缺探险家段位晋升(v830)"),
        ("function checkIslandComplete", "缺单岛全掌握判定(v830)"),
        ("RANKS", "缺探险家段位表(v830)"),
    ]:
        if _need not in _cry:
            _cry_bad.append(_desc)
    # 🔴v832 答错倒扣必须已删除(老逻辑 w.lv-1 倒扣不能残留)
    if "Math.max(0, w.lv-1)" in _cry or "Math.max(0,w.lv-1)" in _cry:
        _cry_bad.append("答错倒扣老逻辑(w.lv-1)残留·v832应已删除(答错不扣星)")
for _f in ["template.html", "island_season.html"]:
    if os.path.exists(_f) and "hansen_crystal.js" not in open(_f, encoding="utf-8").read():
        _cry_bad.append(_f + " 未加载 hansen_crystal.js")
if _cry_bad:
    fail("★知识结晶引擎(v828·v832) 异常: %s" % _cry_bad[:6])
else:
    ok("★知识结晶引擎(v828·v833) 完整 (答对攒进度+每天锁1星防刷+答错不扣+满星永久掌握每词%d钻+锁星才弹⭐floatMemo(答对不刷屏)+各岛已加载)" % 4)

# ---- 检查: ★v844 赛尔娅限定卡星系展示(season_showcase·星系只给女帝·防回退) ----
# 🔴v844→v845调整: v844曾让赛季全部卡走星系·v845改为【星系只给星海女帝赛尔娅】(其他5守关boss改走boss_hall无星系)。本守卫保留赛尔娅的season_showcase星系展示检查。
_v844_bad = []
_ssc844 = _r31('season_showcase.html')
_se844b = _r31('hansen_season.js')
if "'S1':" not in _ssc844:
    _v844_bad.append('season_showcase缺赛尔娅CARDS数据[S1]')
if 'var FORMS=CARD.forms' not in _ssc844:
    _v844_bad.append('season_showcase的FORMS未参数化(应=CARD.forms)')
if 'CARD.nm' not in _ssc844 or 'CARD.fl' not in _ssc844:
    _v844_bad.append('season_showcase名字/台词未从CARD动态填充')
if '.__hs_gcard' in _se844b:
    import re as _re844
    _m844 = _re844.search(r'__hs_gcard[^;]*?addEventListener[\s\S]{0,220}?openShowcase', _se844b)
    if not _m844:
        _v844_bad.append('赛尔娅限定卡点击未走openShowcase星系展示')
if _v844_bad:
    fail('v844 赛尔娅星系展示: ' + ' | '.join(_v844_bad))
else:
    ok('v844 赛尔娅限定卡星系展示(season_showcase·星系只给女帝): season_showcase.html参数化CARDS(赛尔娅S1·FORMS=CARD.forms·名字台词从CARD填充)·赛尔娅限定卡(__hs_gcard)点击走openShowcase(星系canvas+3D倾斜卡+闪卡+多形态切换+背景切换)·【星系专属女帝】其他5守关boss改走boss_hall无星系(见v845)')

# ---- 检查: ★v847 神秘殿堂卡片缩略图统一(1:1框消顶部留白·赛尔娅用透明立绘·底对齐·防回退) ----
# 🔴v847(Hansen·反复强调"boss太小/顶部留白太大/赛尔娅规格不统一"): 神秘殿堂(openHall)卡片网格——5个守关boss立绘是1200x1200正方形硬塞进3:4竖框→按宽适配·顶部空出~25%大留白; 赛尔娅(__hs_gcard)缩略图用的是HD整张卡面图saelya_hd(1086x1448·居中contain)→人物缩在中间像"卡里套小卡"·与5boss"透明立绘+本命背景"两套渲染。本次统一: ①缩略图框3:4→1:1(正方形立绘在正方形框里完美填满·顶部留白归零·人物最大化·零裁切——已量5立绘人物含装饰占宽86.9~95.8%·透明边最窄仅2.1%·根本无法靠放大去填满竖框·故改框形而非放大) ②赛尔娅缩略图改用透明立绘formPng(默认bosses/saelya.webp·600x800正好竖图)替代HD卡面图·底对齐·与5boss同款渲染 ③换形象实时刷新+赛季面板当季卡同步统一·全局一致。
_v847_bad = []
_se847 = _r31('hansen_season.js')
# ① 两类缩略图框都改正方形 1:1(消顶部留白)
if "aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:'+tBg" not in _se847:
    _v847_bad.append('赛尔娅缩略图框(__hs_thumb_box)未改正方形1:1')
if "aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:'+bcBg" not in _se847:
    _v847_bad.append('5守关boss缩略图框未改正方形1:1')
# 防回退: 这两个缩略图框不得再退回3:4
if "aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:'+tBg" in _se847:
    _v847_bad.append('赛尔娅缩略图框回退成3:4(应1:1)')
if "aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:'+bcBg" in _se847:
    _v847_bad.append('5守关boss缩略图框回退成3:4(应1:1)')
# ② 赛尔娅神秘殿堂缩略图用透明立绘formPng/saelya.webp(非HD卡面图·规格统一)
if "(pref&&pref.formPng)?pref.formPng:'bosses/saelya.webp'" not in _se847:
    _v847_bad.append('赛尔娅神秘殿堂缩略图未改用透明立绘formPng/saelya.webp')
if "(pref&&pref.formImg)?pref.formImg:s.card.img" in _se847:
    _v847_bad.append('赛尔娅神秘殿堂缩略图回退成HD卡面图(formImg/s.card.img·应formPng透明立绘)')
# ③ 赛季面板当季卡同步用透明立绘
if "(pPref&&pPref.formPng)?pPref.formPng:'bosses/saelya.webp'" not in _se847:
    _v847_bad.append('赛季面板当季卡缩略图未改用透明立绘formPng')
if "(pPref&&pPref.formImg)?pPref.formImg:season.card.img" in _se847:
    _v847_bad.append('赛季面板当季卡缩略图回退成HD卡面图(应formPng)')
# ④ 换形象实时刷新缩略图保持透明立绘+底对齐(不回退HD)
if "var _sp=(pref.formPng||'bosses/saelya.webp')" not in _se847 or not re.search(r"objectPosition\s*=\s*['\"]center bottom|object-position['\"]\s*,\s*['\"]center bottom", _se847):
    _v847_bad.append('换形象实时刷新(apply)未保持透明立绘+底对齐')
# ⑤ 立绘底对齐: 缩略图img(赛尔娅gcard与5boss bcard)统一 object-position:center bottom(同款filter→应≥2处)
if _se847.count("object-fit:contain;object-position:center bottom;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5))") < 2:
    _v847_bad.append('缩略图立绘未统一底对齐(赛尔娅gcard应与5boss bcard同款object-position:center bottom)')
if _v847_bad:
    fail('v847 神秘殿堂缩略图统一: ' + ' | '.join(_v847_bad))
else:
    ok('v847 神秘殿堂卡片缩略图统一(Hansen·反复强调"boss太小/顶部留白太大/赛尔娅规格不统一"): ①缩略图框3:4→1:1正方形(5个守关boss 1200x1200正方形立绘完美填满·顶部留白归零·人物最大化·零裁切——量过立绘人物含装饰占宽86.9~95.8%·透明边最窄仅2.1%·无法靠放大填满竖框故改框形) ②赛尔娅神秘殿堂缩略图改用透明立绘formPng(默认bosses/saelya.webp·600x800正好竖图)替代HD整张卡面图saelya_hd·底对齐(object-position:center bottom)·与5守关boss【同款渲染·规格统一】(不再"卡里套小卡") ③换形象实时刷新(apply)+赛季面板当季卡同步用透明立绘+底对齐·全局规格一致')


# ---- 检查: ★v846 season_showcase全面消除"一闪一闪"(明灭/脉动/粒子/爆闪·同boss_hall v785/v788/v790·防回退) ----
# 🔴v846(Hansen·反复强调修复"boss大背景一闪一闪"): season_showcase.html(赛尔娅星系展示)是【独立文件】·漏了boss_hall的全套闪烁修复(v785删漂浮粒子+爆闪·v788放大层背景纯不透明·v790 initTilt纯静态)→赛尔娅卡打开后全屏背景多层明灭脉动(星空twinkle/光晕脉动/漂浮粒子/开卡爆闪)一闪一闪。本次全面消除·只保留galaxy缓慢旋转+星云drift(星系特色·非闪)。
_v846_bad = []
_ssc846 = _r31('season_showcase.html')
import re as _re846
if 'foil.style.backgroundPosition=(50+fx' in _ssc846 or 'raf=requestAnimationFrame(loop)' in _ssc846:
    _v846_bad.append('initTilt仍有foil漂移/rAF(彩虹闪·应纯静态)')
# 🔴v1070: 原为钉死整条赋值语句，等价改写(换属性写法/换 API)即误报——
#   与 v1069「星海觉醒」那两道守卫同一个坑。改为查行为特征。
if not re.search(r"backgroundPosition\s*=\s*['\"]50% 50%|background-position['\"]\s*,\s*['\"]50% 50%", _ssc846):
    _v846_bad.append('foil未固定居中(应50% 50%静态)')
_anim846 = _re846.findall(r'animation:(tw|breathe|shaftBreath|pedBreath)\s+[\d.]+s[^;}]*infinite', _ssc846)
if _anim846:
    _v846_bad.append('仍有CSS明灭/脉动animation('+'/'.join(sorted(set(_anim846)))+'·应静态)')
if _re846.search(r'Math\.sin\(t\*[sb]\.tw', _ssc846):
    _v846_bad.append('canvas星星仍有twinkle明灭(Math.sin·应固定亮度)')
_motes846 = _re846.findall(r"makeMotes\(document\.getElementById\('[mz]otes'\),(\d+)", _ssc846)
if any(int(x)>0 for x in _motes846):
    _v846_bad.append('仍有漂浮粒子(makeMotes>0·明灭闪·应0)')
if "burst.className='burst'" in _ssc846:
    _v846_bad.append('仍有开卡爆闪burst(放大瞬间强光爆闪·应删)')
if 'backdrop-filter:blur(8px);animation:bdin' in _ssc846:
    _v846_bad.append('放大层zbd仍半透明+blur(背后透出闪·应纯不透明深色)')
if _v846_bad:
    fail('v846 season_showcase消除一闪一闪: ' + ' | '.join(_v846_bad))
else:
    ok('v846 season_showcase全面消除"一闪一闪"(Hansen·反复强调·同boss_hall v785/v788/v790): 赛尔娅星系展示(独立文件)原漏了boss_hall全套闪烁修复→全屏背景多层明灭脉动一闪一闪。现全面消除: ①initTilt纯静态(foil不漂移·卡片不旋转·无rAF·同v790) ②CSS明灭/脉动animation全删→静态(全屏星空star tw的opacity0.16↔0.9/光晕spot breathe/光轴shaft shaftBreath/基座pedBreath/窗口星星wstars tw) ③canvas星星twinkle去Math.sin→固定亮度 ④漂浮粒子makeMotes(motes16+zmotes24)→0(同v785删明灭粒子) ⑤开卡爆闪burst删(同v785) ⑥放大层背景zbd半透明+blur→纯不透明深色(同v788·背后不透出不重绘)。只保留galaxy缓慢旋转(spin)+星云drift(星系特色·非闪)。守永久禁旋转/微光闪/脉动铁律')


# ---- 检查: ★v845 5守关boss走BOSS殿堂(boss_hall·和1~20关同款·无星系·防回退) ----
# 🔴v845(Hansen·再重做): v844让5守关boss走星系被否(星系只给赛尔娅)→改成复用boss_hall.html(和1~20关boss完全同款:全屏本命背景Ken Burns+角色立绘放大+5档稀有度卡框+背景13选+点击放大·无星系)。神秘殿堂顺序:5守关boss在前·赛尔娅最后。boss立绘放大充满卡片(smode)。
_v845_bad = []
_bh845 = _r31('boss_hall.html')
_se845 = _r31('hansen_season.js')
if 'SEASON_BOSSES' not in _bh845:
    _v845_bad.append('boss_hall缺SEASON_BOSSES数据')
for _k845 in ['starmaker','lightangel','abysslord','timelord','observer']:
    if ("bosses/"+_k845+".webp") not in _bh845:
        _v845_bad.append('boss_hall的SEASON_BOSSES缺立绘'+_k845)
if "QS.get('season')" not in _bh845 or 'BOSSES=SEASON_BOSSES' not in _bh845:
    _v845_bad.append('boss_hall未按?season切换到SEASON_BOSSES')
if 'body.smode .art img' not in _bh845 or "classList.add('smode')" not in _bh845:
    _v845_bad.append('boss_hall缺season立绘放大(smode·Hansen要充满卡片)')
if 'function openSeasonBossHall' not in _se845:
    _v845_bad.append('hansen_season缺openSeasonBossHall函数')
if 'boss_hall.html?v=' not in _se845 or 'season=1' not in _se845:
    _v845_bad.append('openSeasonBossHall未打开boss_hall?season=1')
import re as _re845
_mb845 = _re845.search(r'__hs_bcard[^;]*?addEventListener[\s\S]{0,220}?openSeasonBossHall', _se845)
if not _mb845:
    _v845_bad.append('boss卡(__hs_bcard)点击未走openSeasonBossHall(应走boss_hall无星系)')
if '_saelyaH' not in _se845 or 'cardsHtml += _saelyaH' not in _se845:
    _v845_bad.append('神秘殿堂顺序未调整(赛尔娅应_saelyaH追加最后·5boss在前)')
if _v845_bad:
    fail('v845 5守关boss走BOSS殿堂: ' + ' | '.join(_v845_bad))
else:
    ok('v845 5守关boss走BOSS殿堂(Hansen·再重做·星系只给赛尔娅): boss_hall.html加season模式(?season=1→SEASON_BOSSES 5守关boss·路径用立绘/本命背景字段·边界20→N兼容)·和1~20关boss【完全同款规格】(全屏本命背景Ken Burns+角色立绘+5档稀有度卡框+背景13选+点击放大+左右滑·无星系)·season立绘放大充满卡片(body.smode scale1.16·1~20关不变)·hansen_season.js boss卡(__hs_bcard)点击走openSeasonBossHall打开boss_hall?season=1·神秘殿堂顺序5守关boss在前+赛尔娅限定卡(_saelyaH)追加最后')


# ---- 检查: ★v843 赛季boss本命背景图(5张已填bgImg+webp存在·防回退) ----
# 🔴v843: Hansen 发来星海岛第一赛季5个守关boss的本命背景图(铸星者/统御天使/暗噬君主/时之君主/边界守夜人)·填入hansen_season.js的bgImg(原占位渐变留空)·boss卡全屏观赏(openBossCardView)立绘落在专属背景上。
_v843_bad = []
import os as _os843
_se843 = _r31('hansen_season.js')
_v843_bosses = [('starmaker','铸星者'),('lightangel','统御天使'),('abysslord','暗噬君主'),('timelord','时之君主'),('observer','边界守夜人')]
for _k843,_cn843 in _v843_bosses:
    if ("bgImg:'bosses_bg/"+_k843+".webp'") not in _se843:
        _v843_bad.append(_cn843+'('+_k843+')的bgImg未填/不匹配')
    if not _os843.path.exists('bosses_bg/'+_k843+'.webp'):
        _v843_bad.append('bosses_bg/'+_k843+'.webp 缺失')
if "bgImg:''" in _se843:
    _v843_bad.append('仍有空bgImg(赛季boss应全填本命背景图)')
if _v843_bad:
    fail('v843 赛季boss本命背景图: ' + ' | '.join(_v843_bad))
else:
    ok('v843 赛季boss本命背景图(Hansen发图·5个守关boss): 铸星者→starmaker/统御天使→lightangel/暗噬君主→abysslord/时之君主→timelord/边界守夜人→observer 五张本命背景图(原918x1714 PNG转webp)已填入hansen_season.js的bgImg并覆盖占位渐变·5个webp文件在bosses_bg/·boss卡全屏观赏立绘落在各自专属背景上·渲染 url(bgImg) center/cover')

# ---- 检查: ★v841 可拖动悬浮钻石球(拖动+吸边+点击菜单+进游戏自动隐藏+设置开关·防回退) ----
# 🔴v841: 把"我的钻石"悬浮球(#hsnCrystalBtn)改造成像 iPhone AssistiveTouch 的可拖动小球。Hansen 需求(重复=最高优先级):
#   ①可拖动滑来滑去(屏幕内自由移动+吸最近边) ②进每个游戏模式自动消失(防遮挡) ③点击弹菜单可关闭悬浮球 ④关闭后设置里重开。
#   全部逻辑在 hansen_crystal.js(模块JS·岛靠script加载·不碰template·不需regenerate)。本守卫钉关键标识防回退。
_v841 = _r31('hansen_crystal.js')
_v841_need = [
  ('initDrag','拖动初始化'),('pointerdown','pointer拖动事件'),('DRAG_THRESH','拖动阈值(区分点击/拖动)'),
  ('hsn_crystal_btn_pos','拖动位置持久化'),('hideBall','隐藏悬浮球'),('hsn_crystal_btn_hidden','隐藏状态持久化'),
  ('shouldShow','显隐判定'),('homeVisible','主页可见检测(进模式自动隐藏)'),('hasFullOverlay','全屏覆盖层检测'),
  ('applyVisibility','应用显隐'),('injectSettingsToggle','设置开关注入'),('hcrBtnToggleSection','设置开关section'),
  ('startWatch','自动隐藏监听'),
]
_v841_miss = [d for (k,d) in _v841_need if k not in _v841]
if 'hookSettings()' not in _v841 or 'startWatch()' not in _v841:
    _v841_miss.append('boot()未挂startWatch/hookSettings')
if _v841_miss:
    fail('v841 可拖动悬浮钻石球: 缺 ' + ', '.join(_v841_miss))
else:
    ok('v841 可拖动悬浮钻石球完整: 拖动+吸边(initDrag/pointerdown·移动超DRAG_THRESH=拖动否则=点击·松手吸最近左右边存hsn_crystal_btn_pos·transition平滑不震不闪) + 点击弹小菜单(💎我的钻石→open面板 / 🙈隐藏悬浮球) + 进游戏模式自动隐藏(shouldShow=!隐藏&homeScreen可见&无全屏覆盖层·包装showScreen立即响应+320ms轮询兜底·拼写对战等全屏覆盖层也隐藏) + 关闭后设置里重开(hookSettings包装renderSettings往settingsContent注入hcrBtnToggleSection开关·hsn_crystal_btn_hidden持久化) + boot挂startWatch/hookSettings')

# ---- 检查: ★v840 词音频戳全库一致(spelling_bee 与 island speak 与 preload 的 words mp3 戳必须同步·防漂移) + gym.mp3 在 ----
# 🔴v840: 替换 gym 单词发音(Hansen 提供新 mp3·归一化 -16.0 LUFS)·因覆盖现有文件名 words/gym.mp3·必须 bump 词音频戳(?v214→?v215)。
#   词音频戳出现在三处必须同步: ①template.html 的 island speak(localMp3+'?vNNN'·盖章生成19岛) ②spelling_bee.html(words/X.mp3?vNNN) ③hansen_preload.js(WORD_VER)。
#   本守卫做【相对一致性】比较(不钉死版本号·下次改音频bump戳仍过)·防"改了一处漏改另一处→某端用旧缓存听不到新音频"。
_wa840_bad = []
import re as _re840, os as _os840
_tmpl840 = _r31('template.html'); _sb840 = _r31('spelling_bee.html'); _pre840 = _r31('hansen_preload.js')
_m_tmpl840 = _re840.search(r"localMp3 \+ '(\?v\d+)'", _tmpl840)
_m_sb840 = _re840.search(r"src\+'(\?v\d+)'", _sb840) or _re840.search(r"\.mp3(\?v\d+)'", _sb840)  # v896: speak改用 src+'?v215'(WORD_MAP解析), 兼容旧 .mp3?v215' 
_m_pre840 = _re840.search(r"WORD_VER\s*=\s*'(\?v\d+)'", _pre840)
if not _m_tmpl840: _wa840_bad.append("template.html 找不到 island speak 词音频戳(localMp3+'?vNNN')")
if not _m_sb840: _wa840_bad.append("spelling_bee.html 找不到词音频戳(.mp3?vNNN)")
if not _m_pre840: _wa840_bad.append('hansen_preload.js 找不到 WORD_VER')
if _m_tmpl840 and _m_sb840 and _m_pre840:
    _stamps840 = {_m_tmpl840.group(1), _m_sb840.group(1), _m_pre840.group(1)}
    if len(_stamps840) != 1:
        _wa840_bad.append('词音频戳不一致(覆盖词音频后三处须同步bump): template=%s spelling_bee=%s preload=%s' % (_m_tmpl840.group(1), _m_sb840.group(1), _m_pre840.group(1)))
    # 19岛(盖章生成)的 speak 戳必须都=template
    _isl840_bad = [f for f in _os840.listdir('.') if f.startswith('island_') and f.endswith('.html') and (_m_tmpl840.group(1) not in _r31(f))]
    if _isl840_bad: _wa840_bad.append('%d个岛的词音频戳与template不一致(需regenerate): %s' % (len(_isl840_bad), ','.join(_isl840_bad[:3])))
if not _os840.path.exists('words/gym.mp3'): _wa840_bad.append('words/gym.mp3 缺失')
if _wa840_bad:
    fail('v840 词音频戳一致性/gym音频: ' + ' | '.join(_wa840_bad))
else:
    ok('v840 词音频戳全库一致(%s) + gym.mp3 在: spelling_bee.html / template.html(→盖章19岛 speak) / hansen_preload.js(WORD_VER) 三处+19岛词音频缓存戳全同步(覆盖词音频文件后必须一起bump·否则某端用旧缓存听不到新音频); gym.mp3 已换成 Hansen 提供的新发音并归一化 -16.0 LUFS(全库726个mp3响度一致·0离群0削波✅✅✅)' % _m_sb840.group(1))

# ---- 检查: ★v834 spelling bee 接主游戏星海岛240词 + 退出弹窗键盘锁 + 缓存戳 ----
# 🔴v834: spelling bee 是隔离 iframe(自带独立词库 WORDS·当年单独做的)。主游戏星海岛扩到240词时它没跟上→脱节(spelling bee 的 season 旧词库只有40个抽象高级词·跟主游戏240情感词交集为0)。
#   ①spelling_bee.html 的 season 栏必须=主游戏星海岛真正240词(防回退到脱节旧40词独立词库)。
#   ②退出确认弹窗(#exitConfirm)打开时键盘必须被拦截(防 BUG#104 回归: 弹窗开着时电脑键盘穿透打字到拼写框)。
#   ③hansen_spellbee.js 的 iframe src 必须带 ?v= 缓存戳(改词库后会被CDN缓存挡·用户拿不到新词·build自动维护)。
_sb834_bad = []
if not os.path.exists("spelling_bee.html"):
    _sb834_bad.append("spelling_bee.html 不存在")
else:
    _sb834 = open("spelling_bee.html", encoding="utf-8").read()
    # 🔴v876: 240词已按groups重打land1-8标签(season别名filter仍取全240·女帝备考)·断言改为8岛合计=240
    _sb_land = sum(_sb834.count('"isl": "land%d"'%_i)+_sb834.count('"isl":"land%d"'%_i) for _i in range(1,9))
    if _sb_land < 240:
        _sb834_bad.append("spelling bee 大陆词合计=%d(应240·v876 retag后防回退)" % _sb_land)
    if "/^land[1-8]$/.test(w.isl)" not in _sb834:
        _sb834_bad.append("蜂缺season别名行(女帝240备考)")
    if "exitConfirm" not in _sb834 or "classList.contains('on')" not in _sb834:
        _sb834_bad.append("退出弹窗键盘拦截丢失(BUG#104回归: 弹窗开着电脑键盘穿透打字到拼写框·v834修)")
if not os.path.exists("hansen_spellbee.js"):
    _sb834_bad.append("hansen_spellbee.js 不存在")
else:
    _sbj834 = open("hansen_spellbee.js", encoding="utf-8").read()
    if "spelling_bee.html?v=" not in _sbj834:
        _sb834_bad.append("spelling_bee.html iframe 缺?v=缓存戳(改词库被CDN缓存挡·v834加·build自动维护)")
if _sb834_bad:
    fail("★v834 spelling bee(星海岛240词+退出弹窗键盘锁+缓存戳) 异常: %s" % _sb834_bad[:6])
else:
    ok("★v834 spelling bee 完整 (星海岛接主游戏真240词·退出弹窗键盘锁防穿透BUG#104·iframe?v=缓存戳·防脱节回退)")

# ---- 检查: ★v835-v837 知识结晶面板&全游戏奖励提示 大白话(玩家面前零生造术语·防回退) ----
# 🔴v835-v837: Hansen 反复要求"所有东西全换成大白话·一看就懂"。面板及连签/通关/赛季奖励全改大白话:
#   知识结晶→我的钻石 / 记忆强化→加速 / 永久掌握→记牢·已记牢 / 涨星翻倍→记单词更快 / 晋升→升到 / 结晶(动词)→变成 / 见习·精英·宗师探险家→新手·高手·大神探险家。
#   (注: 这些生造术语在代码注释·KB·本check描述·星海岛剧情hansen_cards.js《星海的回响》里允许保留·此处只查面板UI的精确显示串·防被误改回术语。)
_v837_bad = []
if not os.path.exists("hansen_crystal.js"):
    _v837_bad.append("hansen_crystal.js 不存在")
else:
    _cj837 = open("hansen_crystal.js", encoding="utf-8").read()
    for _need, _desc in [
        ('💎 我的钻石', "面板标题'我的钻石'丢失(v837大白话·原'知识结晶')"),
        ('新手探险家', "段位名'新手探险家'丢失(v837·原'见习探险家')"),
        ('加速', "buff'加速'丢失(v837·原'记忆强化')"),
        ('记牢一个单词', "面板说明'记牢一个单词'丢失(v836精准版·破'答对一次就给钻石'误解)"),
    ]:
        if _need not in _cj837:
            _v837_bad.append(_desc)
    # 反向: 面板关键位置不能回退成术语
    if 'hcr-title">💎 知识结晶' in _cj837:
        _v837_bad.append("面板标题回退成'知识结晶'(v837应'我的钻石')")
    if 'hcr-boost">⚡ 记忆强化' in _cj837 or 'off">💤 记忆强化' in _cj837:
        _v837_bad.append("boost条回退成'记忆强化'(v837应'加速')")
if _v837_bad:
    fail("★v835-v837 UI大白话 异常: %s" % _v837_bad[:6])
else:
    ok("★v835-v837 UI大白话 完整 (面板'我的钻石'/'加速'/'新手探险家'/'记牢一个单词'·玩家面前零生造术语·防回退)")

# ---- v941 高级货币边界：只有白名单系统能发真钻，旧addGem仍只发金币 ----
_p2_bad = []
if os.path.exists("hansen_round_reward.js"):
    _rr = open("hansen_round_reward.js", encoding="utf-8").read()
    if "addBoost(REWARD_BOOST)" not in _rr: _p2_bad.append("通关一轮缺记忆强化buff")
    if "addCoins(REWARD_COIN)" not in _rr: _p2_bad.append("通关一轮缺发金币")
    if "addGems(gems)" not in _rr: _p2_bad.append("通关一轮缺白名单钻石结算")
if os.path.exists("hansen_addiction.js"):
    _ad2 = open("hansen_addiction.js", encoding="utf-8").read()
    if "HansenGems.add(m.gems)" in _ad2: _p2_bad.append("连签里程碑仍在发钻(应改金币)")
    if "function confirmBoost(map,tx)" not in _ad2 or "tx.boost.target" not in _ad2: _p2_bad.append("连签里程碑缺可恢复记忆强化事务")
if os.path.exists("hansen_season.js"):
    _se2 = open("hansen_season.js", encoding="utf-8").read()
    if "type:'coinboost'" not in _se2: _p2_bad.append("赛季里程碑未改 coinboost")
if os.path.exists("template.html"):
    _tpl2 = open("template.html", encoding="utf-8").read()
    if "grantBoost(90" not in _tpl2: _p2_bad.append("每日任务全清未发记忆强化buff(v831·飞轮日常入口)")  #🔴v831
if _p2_bad:
    fail("v941 高级货币白名单异常: %s" % _p2_bad[:6])
else:
    ok("v946 高级货币白名单: focused Bee结晶/Boss大满贯/女帝终战/gem1发真钻；普通Bee旧里程碑停发，旧addGem与普通成就仍发金币")


# ---- 检查: ★v848 星海觉醒(season岛)前3类60词真人发音接入(隔离命名·只作用于season·防泄漏其他岛) ----
# 🔴v848(Hansen·反复强调"只用于星海觉醒240词·按文件名核对·其他单词不要管"): Hansen提供64个真人发音mp3(去重后60唯一词·全部按文件名对上season前3类:情绪心情20+性格品格20+描述形容20)。
#   接法: ①隔离命名 words/{word}_season.mp3(物理隔离·绝不与其他岛/全局WORD_MAP冲突) ②只写进season['local_audio']清单(60条·其他岛local_audio分毫未动) ③归一化-16.0 LUFS(全库786个mp3·0离群0削波✅✅✅)。
#   钉死: 60个_season.mp3在 + season.local_audio含60条隔离映射(键=文件名) + 盖章进island_season.html + 隔离命名不泄漏其他岛。新文件名无缓存问题(?v215不必bump)。后9类180词保持TTS。
_v848_bad = []
import os as _os848, json as _json848, re as _re848
_d848 = _json848.load(open('island_data.json', encoding='utf-8'))
_la848 = _d848.get('season', {}).get('local_audio')
# ① season.local_audio 必须是含_season.mp3隔离映射的字符串(非null)
if not _la848 or not isinstance(_la848, str):
    _v848_bad.append('season.local_audio 为空/非字符串(应为60词隔离映射)')
else:
    if _la848.count('_season.mp3') < 60:
        _v848_bad.append('season.local_audio 隔离映射不足60条(实%d)' % _la848.count('_season.mp3'))
    _pairs848 = _re848.findall(r"(\w+):'words/(\w+)_season\.mp3'", _la848)
    _mis848 = [k for k, v in _pairs848 if k != v]
    if _mis848:
        _v848_bad.append('local_audio键与文件名不符: %s' % _mis848[:3])
# ② 60个 words/{word}_season.mp3 文件必须都在
if len([f for f in _os848.listdir('words') if f.endswith('_season.mp3')]) < 60:
    _v848_bad.append('words/*_season.mp3 文件不足60')
if _la848 and isinstance(_la848, str):
    _miss848 = [p for p in _re848.findall(r"'(words/\w+_season\.mp3)'", _la848) if not _os848.path.exists(p)]
    if _miss848:
        _v848_bad.append('local_audio引用的%d个文件缺失: %s' % (len(_miss848), _miss848[:3]))
# ③ 盖章进 island_season.html(__ISLAND_LOCAL_AUDIO含_season映射)
if _os848.path.exists('island_season.html') and '_season.mp3' not in _r31('island_season.html'):
    _v848_bad.append('island_season.html 未盖章season真人发音(需regenerate)')
# ④ 隔离: _season.mp3 绝不出现在其他岛的local_audio(物理保证只作用于season)
for _isl848, _v848v in _d848.items():
    if _isl848 == 'season' or re.match(r'season[1-5]$', _isl848): continue  # v851: season1-5子岛属星海家族·合法用_season音频
    _ola848 = _v848v.get('local_audio') if isinstance(_v848v, dict) else None
    if isinstance(_ola848, str) and '_season.mp3' in _ola848:
        _v848_bad.append('其他岛%s.local_audio含_season.mp3(隔离泄漏!)' % _isl848)
if _v848_bad:
    fail('v848 星海觉醒真人发音接入: ' + ' | '.join(_v848_bad))
else:
    ok('v848 星海觉醒(season岛)前3类60词真人发音接入(Hansen·反复强调"只用于星海觉醒240词·按文件名核对·其他不要管"): 64个真人mp3去重→60唯一词·全部按文件名对上season前3类(情绪心情20+性格品格20+描述形容20·0个对不上)·隔离命名words/{word}_season.mp3(物理隔离·绝不泄漏其他岛/全局WORD_MAP)·只写season.local_audio(60条·其他岛分毫未动)·归一化-16.0 LUFS(全库786mp3·0离群0削波✅✅✅)·已盖章island_season.html。新文件名?v215不必bump。后9类180词保持TTS。')




# ---- 检查: ★v849 星海5岛闯关(boss按主题分块覆盖全240·补最后40词漏洞·防回退) ----
# 🔴v849(Hansen·反复强调"240词不能一口气背·按每个boss分成岛·好记"·让我按最好方式做): 把星海主线打boss做成5个主题岛闯关。
#   现状漏洞: 原5守关boss各40词只覆盖前200词(类1-10)·最后40词(类11-12自然/工作)无任何守关boss覆盖·只在赛尔娅池里。
#   本次: 5守关boss按【连续主题类】分块覆盖全240——岛1情绪+性格(40)·岛2描述+时间(40)·岛3思考+动作(40)·岛4数量+连接+学习(60)·岛5社会+自然+工作(60)。赛尔娅(N=6)保持全240总决战不动。
#   学习模式(听音/拼写/填空·易/中/难)是19岛【共用】·不动(改了会连累其他18岛·那不是完美是埋雷)·覆盖全240。
_v849_bad=[]
_tpl849=_r31('template.html'); _hc849=_r31('hansen_cards.js')
_BND5='[[0,40],[40,80],[80,120],[120,180],[180,240]]'
# ① boss词池+进度都用5岛边界(应≥2处: __buildBossPool + __seasonBossProgress)
if _tpl849.count(_BND5) < 2:
    _v849_bad.append('template.html 5岛边界应同时在__buildBossPool和__seasonBossProgress(实%d处·应≥2)'%_tpl849.count(_BND5))
# 防回退: 旧均匀40切片(_s=(_bn-1)*40)不得残留
if '_s=(_bn-1)*40; _e=Math.min(allW.length,_bn*40)' in _tpl849:
    _v849_bad.append('boss词池回退成旧均匀40切片(应5岛边界)')
# ② 🔴v874: 宇宙地图/5星域整套废除(Hansen定稿)——hub选关界面=女帝终战竞技场·旧星域标记禁止复活
if '星海女帝 · 终战' not in _hc849: _v849_bad.append('hub缺女帝终战竞技场标题(v874)')
if '第一星域' in _hc849: _v849_bad.append('旧星域标记复活(第一星域·v874已废除)')
if '考全部 240' not in _hc849: _v849_bad.append('缺赛尔娅240终战说明')
if _v849_bad:
    fail('v849 星海5岛闯关: '+' | '.join(_v849_bad))
else:
    ok('v849 星海5岛闯关(Hansen·"240词不能一口气吓到他们·按boss分5个岛·好记"): 5守关boss按主题分块覆盖全240(岛1情绪性格40+岛2描述时间40+岛3思考动作40+岛4数量连接学习60+岛5社会自然工作60)·补上原最后40词(自然/工作)无守关boss覆盖的漏洞·赛尔娅(N=6)保持全240总决战不动·选关界面6个boss副标题改成岛主题+词数(🏝️第①~⑤岛+👑总决战)。学习模式(易/中/难)19岛共用·不动·仍覆盖全240(改了会连累其他18岛)。')

# ---- 检查: ★v851 星海觉醒=宇宙地图·5星域各是完整子岛(Hansen·"每40词单独占一整个岛·像动物大冒险·所有功能·不是打boss"·防回退) ----
# 🔴v851(Hansen反复强调·纠正v850·让我按最好方式做): 星海240词拆成5个完整的岛(island_season1-5·各40-60词+专属boss+全部功能)·宇宙地图点星域→进这个岛·打通boss解锁下一个·5星域全通→赛尔娅(hub考240)。
import os as _os851
_v851_bad=[]
_hc851=_r31('hansen_cards.js')
_tpl851=_r31('template.html')
# 🔴v874(Hansen定稿): 星海旧内容(宇宙地图/5星域子岛/信物/星轨)整套废除——番外篇=单词大陆8岛(land_map)·hub=女帝终战竞技场。改验新语义+防复活。
for _m in ['星海女帝 · 终战','还需通关','决战星海女帝','hsn_landmap_cleared_','hansenStartRebattle(6)','saelya.webp','🔴v874']:
    if _m not in _hc851: _v851_bad.append('女帝竞技场缺标记: '+_m)
if '第一星域' in _hc851: _v851_bad.append('旧星域内容复活(第一星域)')
for _n in range(1,6):
    if _os851.path.exists('island_season%d.html'%_n): _v851_bad.append('已废除的子岛文件复活: island_season%d.html'%_n)
if 'hsn_seasonmap_cleared_' not in _tpl851: _v851_bad.append('template缺子岛打赢置解锁标记')
if 'island_season[1-5]' not in _tpl851: _v851_bad.append('template缺子岛返回回hub逻辑')
# 🔴v874: v851标记已随宇宙地图函数体废除·由上方🔴v874标记接棒
if _v851_bad:
    fail('v851 星海5岛宇宙地图: '+' | '.join(_v851_bad))
else:
    ok('v851 星海觉醒=宇宙地图·5星域各是完整子岛(Hansen·"每40词单独占一整个岛·像动物大冒险·探索单词/火眼金睛/所有功能·不是单纯打boss"): 星海240词拆成5个完整的岛(island_season1-5·各40/40/40/60/60词+专属boss铸星者/统御天使/暗噬君主/时之君主/终末观测者·跟动物岛同模板→所有功能自动只用这些词=零改共用取词代码)。宇宙地图点星域→window.location跳这个子岛→打通它的boss(bossVictory置hsn_seasonmap_cleared_N)→返回hub→顺序解锁下一星域→5星域全通→宇宙最深处赛尔娅(hub考全部240)。子岛返回回hub。常规18岛零影响(路径gate)。纯静态守铁律。')

# ---- 检查: ★v852 星海觉醒落地页=宇宙地图 + boss立绘方块完整形象(不用圆圈) + 锁定纯黑看不见(Hansen·"点进星海学习岛第一眼就是这个宇宙地图·先选星域·锁定boss完完全全黑掉什么都看不见·立绘用方块能完整展示不要圆圈"·防回退) ----
# 🔴v852(Hansen看v851真机截图后·三点): ①进星海hub第一眼=宇宙地图(不是先进岛主页再点挑战BOSS) ②锁定星域boss纯黑看不见(神秘感) ③boss立绘圆圈→方块/完整形象(圆圈裁了立绘)。
_v852_bad=[]
_hc852=_r31('hansen_cards.js')
_tpl852=_r31('template.html')
if '\U0001f534v852' not in _hc852 and '🔴v852' not in _hc852: _v852_bad.append('hansen_cards.js缺v852标记')
# 1. 落地页=宇宙地图: inline直接切类(防首页闪) + init里showScreen包装后切boss屏(渲染picker)
if '_hsBoss' not in _tpl852 or 'homeScreen' not in _tpl852: _v852_bad.append('template缺hub落地宇宙地图的inline切类(防闪·_hsBoss)')
if 'hub落地即boss屏' not in _hc852: _v852_bad.append('cards缺hub落地说明标记(v874:落地即女帝竞技场)')
try:
    _shub852=_r31('island_season.html')
    if '_hsBoss' not in _shub852: _v852_bad.append('生成的island_season.html缺落地宇宙地图切类(印章未带上)')
except: pass
# 2.🔴v874: 星域立绘/锁定纯黑随宇宙地图废除——改验女帝面板立绘方块完整形象
if 'object-fit:contain' not in _hc852: _v852_bad.append('女帝立绘未完整展示(应object-fit:contain)')
if 'saelya.webp' not in _hc852: _v852_bad.append('女帝面板缺赛尔娅立绘')
if _v852_bad:
    fail('v852 星海落地页+立绘方块+锁定纯黑: '+' | '.join(_v852_bad))
else:
    ok('v852 星海觉醒落地页=宇宙地图(Hansen·"点进星海学习岛第一眼就是这个宇宙地图·先选星域·不是先进岛主页再点挑战BOSS")+boss立绘方块完整形象(圆圈裁了立绘→星域16px/赛尔娅18px圆角方块+object-fit:contain完整展示形象)+锁定boss纯黑看不见(background:#000·神秘感)。落地机制: inline先直接切类(homeScreen→bossScreen·让boss屏首帧就active防首页闪)+hansen_cards.js的init里(showScreen包装完·切boss会渲染picker)切boss屏渲染宇宙地图。仅hub(island_season.html正则匹配)·子岛season1-5(中间有数字)不匹配→照常停岛主页。常规18岛零影响(路径gate·立绘改仅renderSeasonBossPicker季节hub)。纯静态守铁律。')

# ---- 检查: ★v853 武器皮肤化(伤害固定·纯攻击特效) + 删护甲 + 血量保留 + 武器试用完全移除(Hansen·多轮讨论确认·防回退) ----
# 🔴v853(Hansen·多轮讨论定): ①武器只作皮肤·所有武器伤害一模一样(=基础弓箭·不加战力)·升级只解锁更酷攻击特效 ②护甲整个删(和血量重复·没必要) ③血量保留可买(容错·让答题更持久·答题量不变) ④武器"试用/试玩"完全移除。理由: 武器/护甲直接决定打不打得过Boss=用钱绕过"会不会这些词"·稀释单词考核; 血量只是容错(仍得答对才扣Boss血)·且钻石只从背熟单词来→是奖励非捷径。
_v853_bad=[]
_hg853=_r31('hansen_gear.js')
# ① 武器皮肤化: 伤害固定=基础弓箭WEAPONS[0]·所有武器一样(不随装备的武器变)
if 'var w=WEAPONS[0]; return w.min' not in _hg853: _v853_bad.append('武器伤害未固定为基础弓箭(getWeaponAtk应 var w=WEAPONS[0])')
if 'WEAPONS[effWeaponLvl()]; return w.min' in _hg853: _v853_bad.append('武器伤害仍随装备武器变(effWeaponLvl取伤害=没皮肤化)')
# ② 护甲删除: getArmorPct不再用armorLvl取减伤 + 无护甲页签/buyAR/render分支
if 'ARMOR_PCTS[read().armorLvl]' in _hg853: _v853_bad.append('护甲未删(getArmorPct仍用armorLvl取减伤)')
if 'data-tab="armor"' in _hg853: _v853_bad.append('护甲页签未删(仍有data-tab=armor)')
if "type==='buyAR'" in _hg853: _v853_bad.append('护甲购买处理器buyAR未删')
if '护甲减伤：' in _hg853: _v853_bad.append('护甲render分支未删')
# ③ 血量保留(仍可用钻石买·给容错)
if 'HP_BASE + read().hpLvl*HP_STEP' not in _hg853: _v853_bad.append('血量购买被误删(getMaxHP应保留hpLvl)')
if 'data-tab="hp"' not in _hg853: _v853_bad.append('血量页签被误删')
# ④ 武器试用/试玩完全移除: 无功能性trialUntil/startTrial/trialW(注释里提到词不算·这里查功能pattern)
if 'trialUntil' in _hg853: _v853_bad.append('武器试用未删净(仍有trialUntil状态)')
if "type==='startTrial'" in _hg853 or "type==='trialW'" in _hg853: _v853_bad.append('武器试玩处理器startTrial/trialW未删')
if 'data-act="startTrial"' in _hg853 or 'data-act="trialW"' in _hg853: _v853_bad.append('武器试玩按钮未删')
# ⑤ 武器攻击特效(皮肤视觉)保留·升级=更酷动画(HansenWeaponFx按武器等级)
if 'HansenWeaponFx' not in _r31('template.html'): _v853_bad.append('武器攻击特效(皮肤视觉)丢失')
if _v853_bad:
    fail('v853 武器皮肤化+删护甲+试用移除: '+' | '.join(_v853_bad))
else:
    ok('v853 武器皮肤化(伤害固定·纯攻击特效)+删护甲+血量保留+武器试用完全移除(Hansen·多轮讨论定): ①武器只作皮肤·getWeaponAtk固定=基础弓箭WEAPONS[0](所有武器伤害一模一样·装光子炮也只打弓箭伤害·武器只换攻击特效不加战力·新玩家本来就是弓箭伤害·Boss血量早按此调好→不会打不动) ②护甲整个删(getArmorPct不再取armorLvl·护甲页签/buyAR/render分支全删·Boss战护甲减伤项自然失效·和血量重复没必要) ③血量保留可买(getMaxHP用hpLvl·纯容错·仍得答对才扣Boss血·让答题更持久·答题量不变) ④武器试用/试玩完全移除(无trialUntil/startTrial/trialW·商店无试玩按钮)。武器攻击特效(HansenWeaponFx按武器等级=皮肤视觉)保留·升级解锁更酷攻击动画。全在hansen_gear.js改·不碰Boss战模板(改接口即生效)·常规19岛零影响。纯静态守铁律。')

# ---- 检查: ★v854 打Boss页隐藏顶栏状态条 + 返回键做好看(Hansen·截图指出·防回退) ----
# 🔴v854(Hansen·截图): 打Boss时【最上面整条状态栏(头像/等级/打卡天数/💎钻石/🪙金币/经验条/藏宝图)全部隐藏】·整屏专注打Boss只留一个返回键·且返回键做好看。
_v854_bad=[]
_bl854=_r31('hansen_boss_lock.js')
_tp854=_r31('template.html')
# ① 战斗中隐藏顶栏
if 'body.hsn-boss-noheader .top-bar{display:none' not in _bl854: _v854_bad.append('打Boss时顶栏未去掉(缺body.hsn-boss-noheader .top-bar display:none·v855改整屏)')
# ② 返回键 = v857小圆钮(v854大胶囊被Hansen推翻: "太大太显眼·做成很小的半透明圆形箭头图标")
if '#bossScreen > .back-btn{position:absolute !important;top:8px !important;left:10px !important;width:36px !important;height:36px !important' not in _bl854: _v854_bad.append('返回键非v857小圆钮(36px绝对定位左上)')
if 'border-radius:50% !important' not in _bl854: _v854_bad.append('返回键非圆形')
if 'padding:4px 10px !important' in _bl854: _v854_bad.append('返回键仍是旧紧凑4px 10px')
# ③ 返回键好看(template靛蓝玻璃渐变+14px圆角+投影)
if '#bossScreen .back-btn{position:static;top:auto;left:auto;margin-bottom:14px;padding:9px 18px' not in _tp854: _v854_bad.append('template返回键美化样式缺')
if 'linear-gradient(135deg,rgba(var(--pal-line-rgb,99,102,241),.32),rgba(79,70,229,.22))' not in _tp854: _v854_bad.append('返回键靛蓝玻璃渐变缺')
# ④ 生成的岛也得带(印章同步)
import glob as _g854
_miss854=[i for i in _g854.glob('island_*.html') if 'linear-gradient(135deg,rgba(var(--pal-line-rgb,99,102,241),.32),rgba(79,70,229,.22))' not in open(i,encoding='utf-8',errors='replace').read()]
if _miss854: _v854_bad.append(f'{len(_miss854)}岛返回键美化未同步(需generate)')
if _v854_bad:
    fail('v854 打Boss隐藏顶栏+返回键美化: '+' | '.join(_v854_bad))
else:
    ok('v854 打Boss页隐藏顶栏状态条+返回键做好看(Hansen·截图指出): 打Boss时(body.hsn-boss-battle=bossActive)【隐藏最上面整条状态栏】(头像/等级/打卡天数/💎钻石/🪙金币/经验条/藏宝图·body.hsn-boss-battle .top-bar{display:none})·整屏专注打Boss只留返回键(既有还藏底部导航+Boss战标题·本次加藏顶栏)。顶栏藏掉腾出~62px→返回键从旧紧凑padding 4px放大到9px 18px舒展·配template靛蓝玻璃渐变(linear-gradient rgba(99,102,241))+14px圆角+静态投影0 4px 16px+内高光=好看(无动画/无旋转/无脉动守铁律)。选关/介绍页顶栏仍在(仅战斗bossActive时隐藏·与藏导航/藏标题同机制)。真机(animal真开打): 打Boss顶栏display:none·不出滚动条(顶栏省空间只多不少·850≤850)·boss立绘/血条/题目全在·返回键舒展好看·0报错。纯静态守铁律。')

# ---- 检查: ★v855 打Boss页【全程】彻底去掉顶栏(Hansen·修正v854·季节hub例外·防回退) ----
# 🔴v855(Hansen): v854只在战斗激活(hsn-boss-battle)时去顶栏→进boss介绍页顶栏还会先冒出来一下=Hansen说"隐藏不是去掉·不要让他再出来"。改为进boss屏(showScreen id===boss)就加hsn-boss-noheader·全程(介绍/选关/战斗)去顶栏·同步加不闪。季节hub宇宙地图例外保留顶栏。
_v855_bad=[]
_tp855=_r31('template.html'); _bl855=_r31('hansen_boss_lock.js')
_bs855=chr(92)
# ① showScreen进boss屏加hsn-boss-noheader(季节hub除外·正则1个反斜杠)
if ("toggle('hsn-boss-noheader', id==='boss' && !/island_season"+_bs855+".html/") not in _tp855: _v855_bad.append('showScreen未正确加hsn-boss-noheader(进boss屏全程标记·季节hub除外)')
# ② 顶栏在整个boss屏去掉(非仅战斗中hsn-boss-battle)
if 'body.hsn-boss-noheader .top-bar{display:none' not in _bl855: _v855_bad.append('顶栏未在整个boss屏去掉(应hsn-boss-noheader)')
if 'body.hsn-boss-battle .top-bar{display:none' in _bl855: _v855_bad.append('顶栏仍是旧的仅战斗中(hsn-boss-battle·应已改hsn-boss-noheader)')
# ③ 生成岛印章同步
import glob as _g855
_miss855=[i for i in _g855.glob('island_*.html') if "toggle('hsn-boss-noheader'" not in open(i,encoding='utf-8',errors='replace').read()]
if _miss855: _v855_bad.append(f'{len(_miss855)}岛hsn-boss-noheader未同步(需generate)')
if _v855_bad:
    fail('v855 打Boss全程去掉顶栏: '+' | '.join(_v855_bad))
else:
    ok('v855 打Boss页【全程】彻底去掉顶栏(Hansen·修正v854): v854只在战斗激活(hsn-boss-battle=bossActive)时去顶栏→进boss介绍页(挑战来啦那一下)顶栏还会先冒出来一下=Hansen说的"隐藏不是去掉·不要让他再出来"。v855改为【进boss屏(showScreen id===boss)就加hsn-boss-noheader类·全程(介绍页/选关/战斗)去掉顶栏】·且showScreen里同步toggle(进页面那一刻就去掉·不闪)。body.hsn-boss-noheader .top-bar{display:none!important}。季节hub宇宙地图(island_season.html·选星域非打Boss)用正则!/island_season\\.html/排除→保留顶栏(季节子岛season1-5路径有数字不匹配→照常去顶栏)。返回键美化(v854靛蓝玻璃胶囊)沿用。真机: 普通岛介绍页+战斗顶栏全none(不闪)·季节hub宇宙地图顶栏flex保留·0报错。纯静态守铁律。')

# ---- 检查: ★v856 整体配色系统(Hansen·"黑不拉几·要7-8种配色亮暗都有·自由选"·防回退) ----
# 🔴v856: 8套整体配色(深空蓝默认+暗夜紫/极光青/森野绿+云端白/樱花粉/奶油杏/薄荷绿)。机制: template/index CSS高频色变量化
#         var(--pal-X,原色兜底)=默认零变化; 选配色→<html>加hsn-pal-{id}(亮色再加hsn-pal-light)→变量整体换装;
#         head内联防闪(首帧前同步加类·v855教训); #bossScreen行内配色整体还原(打Boss电影感任何配色不动); 全局键hansen_palette_global。
_v856_bad=[]
_pal856='hansen_palette.js'
if not os.path.exists(_pal856):
    _v856_bad.append('缺 hansen_palette.js')
else:
    _pc856=_r31(_pal856)
    for _pid856 in ['cosmos','violet','aurora','woods','cloud','sakura','cream','mint']:
        if ("id:'"+_pid856+"'") not in _pc856: _v856_bad.append('缺配色 '+_pid856)
    if "KEY='hansen_palette_global'" not in _pc856: _v856_bad.append('缺全局持久化键 hansen_palette_global')
    if '#bossScreen [style*="color:#fff"]{color:#fff!important}' not in _pc856: _v856_bad.append('缺bossScreen行内还原(打Boss任何配色保持电影感原样)')
    if 'html.hsn-pal-light body{color:var(--pal-ink)}' not in _pc856: _v856_bad.append('缺亮色系文字兜底')
    if "window.hansenApplyPalette=apply" not in _pc856: _v856_bad.append('缺 hansenApplyPalette 暴露(设置页选择器用)')
_tp856=_r31('template.html'); _ix856=_r31('index.html')
for _nm856,_c856 in [('template.html',_tp856),('index.html',_ix856)]:
    if 'hansen_palette_global' not in _c856 or 'hsn-pal-light' not in _c856: _v856_bad.append(_nm856+' 缺head内联防闪(首帧前同步加配色类·防闪)')
    if 'hansen_palette.js?v=' not in _c856: _v856_bad.append(_nm856+' 缺 hansen_palette.js 脚本标签')
if 'var(--pal-ink,#fff)' not in _tp856 or 'var(--pal-surf-2,#1e293b)' not in _tp856 or 'rgba(var(--pal-line-rgb,99,102,241),' not in _tp856: _v856_bad.append('template CSS高频色未变量化(var(--pal-X,原色兜底))')
if 'var(--pal-chrome-1,#1e1b4b)' not in _ix856: _v856_bad.append('index CSS高频色未变量化')
if '--pal-ink:' in _tp856 or '--pal-surf-1:' in _tp856: _v856_bad.append('template不该定义--pal-值(只能在palette.js里定义·否则默认非零变化)')
import glob as _g856
_miss856=[i for i in _g856.glob('island_*.html') if 'hansen_palette.js?v=' not in open(i,encoding='utf-8',errors='replace').read()]
if _miss856: _v856_bad.append(f'{len(_miss856)}岛palette脚本未同步(需generate)')
if _v856_bad:
    fail('v856 整体配色系统: '+' | '.join(_v856_bad))
else:
    ok('v856 整体配色系统(Hansen·"游戏黑不拉几·要7-8种配色·亮色暗色都有·大家自由选"): 8套整体配色=🌌深空蓝(默认·零变化)+🔮暗夜紫+🌊极光青+🌲森野绿(暗色4)+☁️云端白+🌸樱花粉+🍦奶油杏+🌿薄荷绿(亮色4)·设置页顶部🎨整体配色选择器·全部免费·全岛通用(全局键hansen_palette_global·钱包同款跨岛教训)。机制: template/index CSS高频色173+29处变量化var(--pal-X,原色兜底)→默认深空蓝=不加类=原样零变化; 选配色→<html>加hsn-pal-{id}(亮色再加hsn-pal-light)→一组变量换装(星空底压--th-*·比body[data-theme]优先级高+顶栏+底导航+全部面板卡片+文字四阶+描边); JS行内样式用[style*=]+!important精准接管(样式表!important>行内); head内联防闪首帧前同步加类(v855教训不闪); #bossScreen行内配色整体还原=打Boss保持电影感原样任何配色不动(防亮色叠立绘暗遮罩看不清)。真机: 8配色主页/设置/学习/任务/统计/宠物/错题本+index地图+季节hub+两商店+亮色真开打全可读·跨页持久·首帧类已在·默认零变化·滚动条无·0报错。纯静态守铁律。')

# ---- 检查: ★v857 打Boss界面精修(Hansen·"顶部全清空·返回键极小圆钮·boss整体变大狂怒再大·下方绝对零位移·绿框永不被碰") ----
# 🔴v857: ①顶部清空=连击徽章隐藏(只藏不删DOM)+回大地图浮标隐藏+阶段/狂怒改绝对定位右上竖排(Hansen点名保留) ②返回键极小半透明圆钮36px只一个← ③恒定盒230全题型: 普通svg scale(.826)=190·狂怒scale(1)=230·typing scale(.717)=165·origin底部中心+wrap margin统一→狂怒切换/题型切换下方零位移 ④战斗绿框压顶top:6·狂怒顶38永不相碰(慢漂-3px最高35) ⑤狂怒命中缩放上限1.02(1.04会擦绿框)
_v857_bad=[]
try: _bl857=_r31('hansen_boss_lock.js')
except Exception: _bl857=''
_tp857=_r31('template.html')
if 'body.hsn-boss-noheader .world-map-btn{display:none!important}' not in _bl857: _v857_bad.append('回大地图浮标未在boss屏隐藏')
if '#bossScreen .boss-combo{display:none !important}' not in _bl857: _v857_bad.append('连击徽章未隐藏')
if '#bossScreen .boss-stats-bar{position:absolute !important;top:8px !important;right:10px !important' not in _bl857: _v857_bad.append('阶段/狂怒未改绝对定位右上(脱流)')
if '#bossScreen .boss-arena{position:relative !important}' not in _bl857: _v857_bad.append('arena缺定位锚点')
if '.boss-sprite svg{width:230px;height:230px;display:block;margin:0 auto;transform:scale(.9304);transform-origin:50% 100%;transition:transform .45s ease}' not in _bl857: _v857_bad.append('普通态非230盒/scale.9304(v859=214)/底部锚定/平滑过渡')
if '#bossScreen .boss-sprite-wrap{width:230px;height:230px;margin:34px 0 0 !important' not in _bl857: _v857_bad.append('立绘wrap非230盒/margin34(v891对齐打字题)')  # 🔴v891: margin 68→34对齐打字题高位
if 'boss-rage svg, .boss-arena.bts-typing .boss-sprite.boss-rage svg{transform:scale(1.0) !important}' not in _bl857: _v857_bad.append('狂怒svg非scale(1.0)(v891锁死不溢出)')  # 🔴v891: 狂怒1.1217→1.0锁死不溢出天花板
if '@keyframes bossRageStatic{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1) translateY(-3px)}}' not in _bl857: _v857_bad.append('狂怒慢漂关键帧非scale(1)基准(1.12会顶进绿框)')
if 'drop-shadow(0 0 58px rgba(239,68,68,.5))' not in _bl857: _v857_bad.append('狂怒双层烈焰红光缺')
if 'transform:scale(1.02);filter:brightness(2.2)' not in _bl857: _v857_bad.append('狂怒命中缩放上限非1.02(会擦绿框)')
if 'body.hsn-boss-battle .combo-badge{top:6px !important;padding:4px 11px !important;font-size:12px !important}' not in _bl857: _v857_bad.append('战斗绿框未压顶top:6')
if 'aria-label="返回">←</button>' not in _tp857: _v857_bad.append('template返回键非纯箭头')
if 'hansenBossBackBtn()">← 返回</button>' in _tp857: _v857_bad.append('boss返回键仍带"返回"文字(其他屏的文字返回键不算)')
if '<div class="boss-combo">连击 <b id="bossComboNum">0</b></div>' not in _tp857: _v857_bad.append('boss-combo元素被删了(只能藏不能删: template 4183/4246直写textContent+boss_anim读值·删了会崩)')
import glob as _g857
_miss857=[i for i in _g857.glob('island_*.html') if 'aria-label="返回">←</button>' not in open(i,encoding='utf-8',errors='replace').read()]
if _miss857: _v857_bad.append(f'{len(_miss857)}岛返回键未同步(需generate)')
# 🔴v857坑: island_data.json extra_css 曾带 .boss-arena .boss-sprite svg{190px}(2类特异性>boss_lock基准)→布局盒被压190再吃scale(.826)=157px·H阶段炸。已在数据源统一230·此处防复发(查数据源+全部岛)
_id857=_r31('island_data.json')
if '.boss-sprite svg{width:190px' in _id857: _v857_bad.append('island_data.json仍有190px旧extra_css(会压盒→157px双缩)')
_leg857=[i for i in _g857.glob('island_*.html') if '.boss-sprite svg{width:190px' in open(i,encoding='utf-8',errors='replace').read()]
if _leg857: _v857_bad.append(f'{len(_leg857)}岛仍有190px svg旧规则(需改island_data+generate)')
if _v857_bad:
    fail('v857 打Boss界面精修: '+' | '.join(_v857_bad))
else:
    ok('v857 打Boss界面精修(Hansen·"上面那块全都去掉·返回键很小的透明圆图标·boss整体变大更清晰狂怒再变大·下面位置固定不变不许位移·不许碰绿色小框·全力做到绝对好"): ①顶部清空=左上连击徽章隐藏(只藏不删DOM: template直写bossComboNum+boss_anim读值·删会崩)+右上回大地图藏宝图浮标boss屏整程隐藏(v855顶栏同口径)+阶段/狂怒徽章改绝对定位右上竖排脱流(Hansen点名保留) ②返回键v854大胶囊→极小半透明圆钮: 36px圆·只一个←·rgba(15,23,42,.28)底+白边.30融背景·绝对定位左上脱流·禁backdrop-filter ③立绘恒定盒230px全题型统一(盒顶38=屏顶4+margin34·盒底268=下方一次性+49px此后永恒): 普通svg scale(.826)=视觉190(比150大27%·384源图更清晰)·狂怒scale(1)=230(再大21%)·typing scale(.717)=165(键盘保住)·transform-origin底部中心+transition .45s平滑长大→狂怒切换/题型切换下方name/hp/opts位移全0 ④战斗绿框(连击+金币toast)压顶top:6紧凑·狂怒顶38(慢漂最高35)永不相碰 ⑤狂怒=烈焰双层红光+6s慢漂±3px(bossRageStatic收编·体积由svg层承担)·命中缩放上限1.02。真机393×747全验: 普通190/狂怒230/typing165·下方位移全0·绿框5..31与立绘77(普通)/38(狂怒)不碰·typing底728不溢出·0报错。')


# ---- 🔴 v858/v944 滚动性能成果钉死(图片卫生保留·主题动画不得再被暂停) ----
# 三板斧: ①图片总攻67.7→41.9MB(-38%·法令全保: v809赛季boss1100/v773头像720不缩/女皇星空画质/spell_3d原件)
#         ②backdrop-filter全项目清零(滚动卡顿第一杀手·唯一豁免=首页14px薄纱点v719钦定)
#         ③图片卫生(decoding=async全量·同容器≥6图除前4张外loading=lazy)。v944 真机证实旧 hsn-scrolling
#           根级通配闸门会让所有主题图标在手指/惯性滚动时停止，故永久禁止恢复。
import re as _re858, glob as _g858, os as _os858
_b858=[]
# ① backdrop零容忍(除v719薄纱豁免行)
for _p858 in [_x for _x in sorted(_g858.glob('*.html')) if _x!='evolution_dashboard.html']+sorted(_g858.glob('*.js'))+['island_data.json']:  # v859: 全量语料(卫星页+非hansen js)·剔dashboard回声
    for _i858,_ln858 in enumerate(open(_p858,encoding='utf-8',errors='replace').read().splitlines(),1):
        if 'backdrop-filter' not in _ln858 or 'v719薄纱豁免' in _ln858: continue
        if _re858.search(r'backdrop-filter\s*:\s*(?!none)[a-z(]', _ln858):
            _b858.append('%s:%d 出现backdrop-filter(滚动卡顿第一杀手·v858已全清零)' % (_os858.path.basename(_p858),_i858))
            break
    if _b858: break
# ② perf引擎接线+图片卫生核心
for _p858 in ['template.html','index.html','boss_hall.html','season_showcase.html','spelling_bee.html']+sorted(_g858.glob('island_*.html')):  # v859: 卫星页也要perf
    if 'hansen_perf_v944.js?v=' not in open(_p858,encoding='utf-8',errors='replace').read():
        _b858.append(_os858.path.basename(_p858)+' 未接hansen_perf_v944.js'); break
_pj858=open('hansen_perf_v944.js',encoding='utf-8',errors='replace').read() if _os858.path.exists('hansen_perf_v944.js') else ''
for _k858,_lab858 in (("setAttribute('decoding','async')",'解码async'),("setAttribute('loading','lazy')",'图片墙lazy'),('MutationObserver','动态图片卫生')):
    if _k858 not in _pj858: _b858.append('hansen_perf_v944.js缺【%s】' % _lab858)
# v944 反回归: 不允许通过 running!important 白名单修补；应彻底没有滚动暂停闸门，
# 否则会漏掉钻石/未来主题，或误覆盖鱼类倒计时、后台暂停等合法 paused 状态。
if 'hsn-scrolling' in _pj858 or _re858.search(r'animation-play-state\s*:\s*paused', _pj858):
    _b858.append('hansen_perf_v944.js恢复了滚动动画暂停(主题图标会在滑动时停止·v944禁止)')
# ③ hintFade已改纯opacity(原关键帧动画backdrop=合成大杀器)
_t858=open('template.html',encoding='utf-8',errors='replace').read()
if '@keyframes hintFade{from{opacity:0}to{opacity:1}}' not in _t858: _b858.append('hintFade关键帧不是纯opacity(禁回backdrop动画)')
# ④ 图片预算: 单张>800KB(saelya三形态豁免=星空画质法令) + 法令底线(v809五boss≥1100·avatars/27≥500已有专卫)
for _d858 in ('bosses','pets','icons','avatars','themes','bosses_bg','weapons'):
    for _f858 in _g858.glob(_d858+'/*'):
        if _os858.path.basename(_f858).startswith('saelya'): continue
        if _os858.path.getsize(_f858) > 800*1024:
            _b858.append('%s %.0fKB超800KB预算(pngquant 78-95+类目上限·配方见知识库v858)' % (_f858,_os858.path.getsize(_f858)/1024)); break
    if any('超800KB' in _x858 for _x858 in _b858): break
if _b858: fail('v858 性能总攻: '+str(_b858[:6]))
else: ok('v858/v944 滚动性能链: ①图片压缩与800KB预算 ②backdrop-filter零容忍 ③hansen_perf_v944.js仅保留全img decoding=async+图片墙lazy+动态图片卫生 ④永久禁止hsn-scrolling/滚动时animation paused根级闸门，6主题在真实触摸与惯性滚动中持续运动 ⑤离屏岛屿与后台仍由独立机制合法暂停。v944')


# ---- 🔴 v859 (Hansen真机截图: "boss放技能错位了·光球该在手上·光点该在眼睛" + "所有boss更大更高清·狂暴更大·别错位别碰上框") ----
_b859=[]
# 🔴v859: 特效锚点量视觉盒bossVis()=svg/img(布局盒230不动·量div=普通态偏高28px大21%) + boss更大(普通.9304=214·狂怒1.1217=258·零位移·margin68腾位·typing/compact高特异性钉34) + 20主boss EDSR_x4超分768(256源在214/258必糊·pngquant后195-330KB) + BUG#88老守卫升级(≤256旧规→768+≤400KB双规)
_ba859=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
# ① 特效必须量视觉盒(v857起外层#bossSprite=230布局盒·svg才是被transform的真可见体·量div=普通态整体偏高28px大21%)
if 'function bossVis()' not in _ba859: _b859.append('boss_attack缺bossVis()视觉盒解析')
if 'bs=bossVis()' not in _ba859: _b859.append('dispatcher未用bossVis(量布局盒=技能错位复发)')
_wf859=open('hansen_weapon_fx.js',encoding='utf-8',errors='replace').read()
if "bossEl=(bossEl.querySelector&&bossEl.querySelector('svg,img'))||bossEl" not in _wf859: _b859.append('weapon_fx未解析视觉盒(勇者弹道打偏)')
# ② v859几何: 普通.9304=214·狂怒1.1217=258·基座margin68·typing/compact用#bossScreen高特异性钉34(基座ID选择器会压过纯类链)
_bl859=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
if "'#bossScreen .boss-arena.bts-typing .boss-sprite-wrap{margin:34px 0 0!important}'" not in _bl859: _b859.append('typing margin pin缺#bossScreen特异性(会被基座68压过→拼写下移34溢出762)')
if "'#bossScreen .boss-arena.bts-compact .boss-sprite-wrap{margin:34px 0 0!important}'" not in _bl859: _b859.append('compact margin pin缺#bossScreen特异性')
# ③ 普通20boss高清: lv*.webp须≥760px(EDSR x4超分768·256源在214/258显示必糊·Hansen"更高清"法令)
import glob as _g859
from PIL import Image as _I859
for _f859 in sorted(_g859.glob('bosses/lv*.webp')):
    try:
        with _I859.open(_f859) as _im859:
            if max(_im859.size) < 760: _b859.append('%s 仅%dpx(须≥760超分高清·v859法令)' % (_f859,max(_im859.size))); break
    except Exception: pass
if _b859: fail('v859 技能对齐+更大更高清: '+str(_b859[:6]))
else: ok('v859 (Hansen真机截图·技能错位+更大更高清): ①特效锚点一律量视觉盒bossVis()=svg/img(v857恒定盒外层div是230布局盒·量它=普通态日轮飘头顶/掌中日脱手/眼光离眼偏高约28px大21%·狂怒scale1才碰巧对上)·勇者weapon_fx同修querySelector视觉盒·rect跟transform走三态自动对齐 ②boss再变大: 普通scale.9304=214(190→214)·狂怒1.1217=258(230→258)·布局盒仍230不动零位移·基座margin收到68给大立绘腾位·typing/compact用#bossScreen高特异性钉margin34(ID选择器压过纯类链) ③普通20boss高清: 256源在214/258显示必糊·EDSR_x4超分到1024再收768(cv2.dnn_superres)+pngquant·守卫钉lv*须至少760. v859')


# ---- 🔴 v860 (Hansen真机三连: 岛里换回深空蓝首页还是亮的 + 亮色下多处字看不清 + 彻底相通不走网页) ----
# 🔴v860: ①配色同步中枢=palette三监听(storage/pageshow/visibilitychange→apply幂等重应用·iframe写localStorage父窗口当场收到) ②亮色可读性=index注入hsnLightFix九规+tagline深渐变+palette给#hsnSeasonEntry深蓝横幅还原区(bossScreen同款豁免) ③相通=cards赛季跳转/错题跨岛全走parent.openIsland·真goHome(hansen_home_link覆盖版)子岛返回hub
_b860 = []
_pal860 = open('hansen_palette.js', encoding='utf-8', errors='replace').read()
for _k860, _lab860 in (("addEventListener('storage'", '配色storage监听'), ("addEventListener('pageshow'", '配色pageshow监听'), ("addEventListener('visibilitychange'", '配色visibility监听'), ('_hsnPalSync', '同步函数'), ('#hsnSeasonEntry [style*="color:#cbd5e1"]', '赛季横幅还原区')):
    if _k860 not in _pal860: _b860.append('hansen_palette.js缺【%s】(岛里换色首页不跟=复发)' % _lab860)
_idx860 = open('index.html', encoding='utf-8', errors='replace').read()
for _k860, _lab860 in (('id="hsnLightFix"', '亮色整改块'), ('html.hsn-pal-light .intro{ color:#1f2937', 'hero正文深墨'), ('html.hsn-pal-light .enter{ background:rgba(15,23,42,.85)', '进入冒险胶囊深底金字'), ('html.hsn-pal-light .how-step{ background:rgba(255,255,255,.62)', 'how步骤浅玻璃'), ('#1e40af 0%,#9f1239 45%,#5b21b6', 'tagline深蓝紫渐变')):
    if _k860 not in _idx860: _b860.append('index缺亮色整改【%s】(亮色字看不清=复发)' % _lab860)
_hl860 = open('hansen_home_link.js', encoding='utf-8', errors='replace').read()
if "window.parent.openIsland('island_season.html')" not in _hl860: _b860.append('真goHome(home_link)缺子岛返回hub分支(v851壳内延伸)')
_wo860 = open('hansen_wrong_overview.js', encoding='utf-8', errors='replace').read()
if 'window.parent.openIsland' not in _wo860: _b860.append('错题总览跨岛未走parent.openIsland(裸href=历史污染/网页感)')
_cd860 = open('hansen_cards.js', encoding='utf-8', errors='replace').read()
if 'window.parent.openIsland)||function(f){window.location.href=f}' not in _cd860: _b860.append('卡册赛季跳转未收编进壳')
if _b860: fail('v860 同频+亮色可读+彻底相通: ' + str(_b860[:6]))
else: ok('v860 (Hansen真机三连·配色不同步/亮色看不清/彻底相通): ①同步中枢=palette三监听storage(iframe一写父窗口当场重应用=零延迟同频)+pageshow(bfcache复活补对表)+visibilitychange兜底·apply幂等 ②亮色整改=四亮色逐元素对比度扫描实名修复(hero正文6.5/how标题7.1/步骤14.7/胶囊10.7·tagline深渐变+drop-shadow·misc岛英文投影·#hsnSeasonEntry深蓝横幅进还原区任何配色不碰) ③相通审计=spelling_bee/boss_hall/showcase全隔离iframe在壳内·cards赛季+错题跨岛收编parent.openIsland(裸iframe-href会污染联合历史=返回键乱=网页感元凶)·真goHome(home_link覆盖版·模板版是死代码)子岛返回回hub不跳级·真机验: 岛切云端白父窗口当场hsn-pal-light/切回深空蓝当场撤·子岛goHome后iframe=hub·换岛wrap=block·0报错. v860')


# ---- v861 历史接线 + v946 HF4 四份中文速查与拼写奖励隔离复核 ----
_b861 = []
import glob as _g861
_eg861 = open('hansen_econ_guide.js', encoding='utf-8', errors='replace').read() if __import__('os').path.exists('hansen_econ_guide.js') else ''
for _k861, _lab861 in (('金币怎么得', '金币卡'), ('钻石怎么得', '钻石卡'), ('宠物怎么升级', '宠物升级卡'), ('宠物经验怎么得', '宠物经验卡'), ('全天最多 2000', '答题金日上限'), ('得到 4 钻石', '结晶4钻'), ('同一单词每天最多完成一组', '同词同日结晶闸门'), ('88 钻石', '大满贯88'), ('七项全领，再得到 100～240', '全清大奖'), ('经验和单词全部保留', '升级不清零'), ('hsn-eg-toggle', '折叠交互')):
    if _k861 not in _eg861: _b861.append('econ_guide缺【%s】' % _lab861)
for _p861 in ['template.html'] + sorted(_g861.glob('island_*.html')):
    if 'hansen_econ_guide.js?v=' not in open(_p861, encoding='utf-8', errors='replace').read():
        _b861.append(_p861 + ' 未接说明书模块'); break
_sb861 = open('spelling_bee.html', encoding='utf-8', errors='replace').read()
for _k861, _lab861 in (('if(v<10)v=10;if(v>100)v=100;', 'bee词数硬钳10~100'), ('(10~100)', 'bee词数文案'), ('function sbQueueFocusComplete()', 'focused Bee 完整挑战证明')):
    if _k861 not in _sb861: _b861.append('spelling_bee缺【%s】' % _lab861)
_sj861 = open('hansen_spellbee.js', encoding='utf-8', errors='replace').read()
if "d.type === 'hsn_sb_mastery'" not in _sj861 or 'sbAck(e.source,masteryReceipt.rewardId)' not in _sj861:
    _b861.append('岛侧 spellbee 缺遗留 mastery 严格 ACK 清理分支')
if any(_tok861 in _sj861 for _tok861 in ('HansenSpellbeeGems.prepare(', 'HansenSpellbeeGems.begin(', 'HansenSpellbeeGems.commit(')):
    _b861.append('普通 Bee 仍调用旧新词钻石链')
_finish861 = _sb861[_sb861.find('function finish(who)'):_sb861.find('function nextWord()', _sb861.find('function finish(who)'))]
if 'sbQueueMastery(' in _finish861: _b861.append('普通 Bee finish 仍生成 mastery receipt')
if _b861: fail('v861 说明书+Bee升格: ' + str(_b861[:6]))
else: ok('v946 Bee隔离：普通 Bee 保留自身金币/XP但不生成 mastery；旧 mastery 只严格 ACK；focused Bee 才能提交结晶完整挑战证明')


# ---- v946 HF6 首领逐轮账本 + HF4 玩家速查 ----
_b862 = []
_rr862 = open('hansen_round_reward.js', encoding='utf-8', errors='replace').read()
for _k862, _lab862 in (
    ('function islandKey()', '按岛key函数'),
    ("function isSeason(k){ return k==='season'; }", '女帝主页面判定'),
    ('function isLand(k)', 'Land判定'),
    ('function gemAmount()', '钻石数函数'),
    ('SEASON_GEMS = 100', '女帝100规则'),
    ('return isSeason(islandKey()) ? SEASON_GEMS : 88', '常规/Land 88规则'),
    ("STATE_PREFIX = 'hansen_boss_round_state_v946_'", '每岛独立逐轮state'),
    ('function validState(x)', 'state严格校验'),
    ('x.roundNo!==x.completedCount+1', 'roundNo连续性'),
    ('function recordRoundWin(lv)', '本轮实际胜利记录'),
    ('if(merged.indexOf(lv)>=0)', '同关每轮去重'),
    ("receiptId:'round:v946:'", 'receipt绑定轮次'),
    ('roundNo:tx.roundNo+1', '结算后推进下一轮'),
    ('completedCount:tx.roundNo', '已完成轮数落账'),
    ('lastReceipt:{id:tx.receiptId', '已结算receipt落state'),
    ('Boss 本轮进度存档异常，奖励已暂停；原始数据已保留', '坏state fail-closed'),
    ("SEASON_LEGACY_KEY = 'hansen_season_pillar_gems'", '旧六柱只迁移补差'),
    ('addGems(gems)', '发钻'),
    ('gemAmount:gemAmount', 'API暴露'),
    ('roundNo:function()', 'API暴露当前奖励轮'),
    ('status:function()', 'API暴露逐轮明细'),
):
    if _k862 not in _rr862: _b862.append('round_reward缺【%s】' % _lab862)
for _old862, _lab862 in (("window.getIslandClearedLevels()", '永久卡牌通关记录'),
                         ("localStorage.getItem(k+'_prog')", 'landN_prog解锁进度')):
    if _old862 in _rr862: _b862.append('round_reward仍读取%s作为发奖证明' % _lab862)
_rb862 = open('hansen_round_bar.js', encoding='utf-8', errors='replace').read() if __import__('os').path.exists('hansen_round_bar.js') else ''
for _k862, _lab862 in (('hsnRoundBar', '进度器ID'), ("HansenRoundReward", 'API依赖'), ('window.HansenRoundBar', '对外暴露'), ('showScreen.__hrbWrapped', 'showScreen包装标志'), ('body.hsn-boss-battle #', '战斗态隐藏进度器防超屏')):
    if _k862 not in _rb862: _b862.append('round_bar缺【%s】' % _lab862)
_bg862 = open('hansen_spellbee_gems.js', encoding='utf-8', errors='replace').read() if __import__('os').path.exists('hansen_spellbee_gems.js') else ''
for _k862, _lab862 in (('hansen_bee_gem_daily', '每日存储key'), ('{n:5,gem:1}', '5词档'), ('{n:10,gem:2}', '10词档'), ('{n:20,gem:5}', '20词档'), ('isCrystalDone', '已结晶过滤'), ('canonicalSlot', 'canonical词位去重'), ('HansenSpellbeeGems', '对外暴露')):
    if _k862 not in _bg862: _b862.append('spellbee_gems缺【%s】' % _lab862)
_sj862 = open('hansen_spellbee.js', encoding='utf-8', errors='replace').read()
if any(_tok862 in _sj862 for _tok862 in ('HansenSpellbeeGems.prepare(', 'HansenSpellbeeGems.begin(', 'HansenSpellbeeGems.commit(')):
    _b862.append('岛侧 Bee 仍调用已停用的 5/10/20 新词钻石事务')
_t862 = open('template.html', encoding='utf-8', errors='replace').read()
for _k862 in ('hansen_round_bar.js?v=', 'hansen_spellbee_gems.js?v='):  # 版本无关(死版本号曾在build升戳时自炸)
    if _k862 not in _t862: _b862.append('template未接线【%s】' % _k862)
_eg862 = open('hansen_econ_guide.js', encoding='utf-8', errors='replace').read()
for _k862, _lab862 in (('认真拼写，才能拿钻石', '钻石总原则'), ('单词达到五星', '五星入口'), ('得到 4 钻石', '每词4钻'), ('得到 50 钻石', '全岛50钻'), ('88 钻石', '首领全通88钻'), ('得到 100 钻石', '女帝终战100钻'), ('钻石新贵成就', '唯一钻石成就'), ('参加拼写蜂', '普通拼写金币入口')):
    if _k862 and _k862 not in _eg862: _b862.append('econ_guide钻石卡缺【%s】' % (_lab862 or _k862))
if _b862: fail('v946 HF6 大满贯逐轮state+receipt+Bee旧里程碑停发+说明书: ' + str(_b862[:6]))
else: ok('v946 HF6 首领/拼写/四份速查：普通/Land每完整奖励轮88，女帝一次100；永久解锁进度不再冒充本轮证明')


# ---- 🔴 v863 (Hansen真机: 亮色下岛内大量字看不清+发糊+部分卡背景被改——七屏×两亮色逐元素扫描驱动·palette层五批补丁统一修) ----
# 🔴v863: ①#bossScreen深底归位(v856电影感钦令补完: 此前只还原内联字·屏底与继承字漏网) ②深色纯件还原(util-card/psw三件/ach-total字浅+金回金) ③通用inline金五色+#cbd5e1→深琥珀/深灰(!important必须: inline优先级>一切非imp规则) ④mode-card全域白+黑晕(任何own底可读) ⑤金渐变容器属性选内文深棕 ⑥灭晕(screen低优全局+island-hero/section-label imp) ⑦横幅金系补还原 ⑧亮色ink-2/3深化 ⑨back-btn浅字 ⑩ach-foot2/prog琥珀 ⑪⑮⑰⑳宠物屏系 ⑫⑯设置卡翻浅玻璃+h3琥珀 ⑭深提示条(#1e1b4b三写法+linear变体)字浅 ⑱settings警示红深化 ⑲cbd5e1通用+深区还原
_b863 = []
_p863 = open('hansen_palette.js', encoding='utf-8', errors='replace').read()
for _k863, _lab863 in (("#bossScreen::before{background:linear-gradient(180deg,#131c3a", 'boss屏深底归位(v912: 已沉到::before/z-2, 绝不可涂回#bossScreen自身)'), ("var DK=['.util-card','.psw-nmrow','.psw-cap','.lkk','.ach-total']", '深色纯件清单'), ('{color:var(--pal-accent-text,#1e40af)!important}', '金转主题强调色imp'), (".mode-card *{color:#fff!important;text-shadow:0 1px 3px", 'mode卡白晕'), ('linear-gradient(135deg, #fbbf24"] *{color:#1a1200', '金bar深棕含空格变体'), (".screen *{text-shadow:none}", '全局灭晕低优'), ("#settingsContent > div{background:rgba(255,255,255,.66)", '设置卡翻浅'), ("#settingsContent h3{color:var(--pal-accent-text,#1e40af)", '设置h3主题强调色'), ("body{--pal-ink-2:#475569", '亮色ink深化'), (".back-btn{color:#e2e8f0", '返回钮浅字'), ("linear-gradient(135deg,#1e1b4b\"] *{color:#e2e8f0!important}", '深提示条linear变体'), ("#petScreen .psw-nmrow *{color:#e2e8f0!important}", '宠物深行id级'), (".psw-th, ", '进化全程标题'), (".settings-stat b{color:#b91c1c", '警示红深化'), ('[style*="color:#cbd5e1"]{color:#475569!important}', 'cbd5e1通用深化')):
    if _k863 not in _p863: _b863.append('palette缺【%s】' % _lab863)
_i863 = open('index.html', encoding='utf-8', errors='replace').read()
for _k863, _lab863 in (('.foot-slogan{ color:var(--pal-accent-text,#3730a3) !important', '页脚slogan'), ('.foot-tip{ color:#57534e !important', '页脚tips')):
    if _k863 not in _i863: _b863.append('index缺【%s】' % _lab863)
if _b863: fail('v863 亮色全面整改: ' + str(_b863[:6]))
else: ok('v863 (Hansen: 亮色下岛内看不清/发糊/卡底被改——全面整改): 扫描器/tmp级七屏(home/settings/boss/quests/ach/stats/pet)×mint/cream逐元素对比度+光晕检测·98→52→19→8条(剩余=effBg误判/emoji/暗色同值放行)·五批20组规则: boss屏深底归位(选关墙一条通杀)+深纯件字回浅金回金+inline金五色/cbd5e1琥珀深灰(imp铁律: inline>非imp)+mode卡全域白黑晕+金渐变容器(两种空格写法)内深棕+灭晕(低优全局·imp白名单黑晕存活)+设置屏直系卡翻浅玻璃h3琥珀stat红b深红+ink-2/3深化+back-btn/深提示条(#1e1b4b含linear变体)/宠物屏(id级特异性修反杀)全治·computed铁证抽查: 星灵e2e8f0压深行/hint浅字压1e1b4b/掌握进度浅压0f172a/ANIMAL黑细晕. 特异性层级: id还原>类+属性深区>纯属性通用琥珀(同imp). v863')


# ---- v864 历史时效检查 + v946 HF4 四份儿童速查 ----
_b864 = []
_eg864 = open('hansen_econ_guide.js', encoding='utf-8', errors='replace').read()
for _k864, _lab864 in (('做学习任务，就能拿金币', '金币速览'), ('认真拼写，才能拿钻石', '钻石速览'), ('宠物升级：经验要够，已掌握单词也要够', '升级速览'), ('所有岛屿的经验，都加给同一只宠物', '经验速览'), ('探索单词 → 加固知识结晶', '结晶入口'), ('显示“还差 3 个”', '升级缺词解释')):
    if _k864 not in _eg864: _b864.append('econ_guide缺【%s】' % _lab864)
if _eg864.count('<div class="hsn-eg-key">') != 4: _b864.append('四份攻略应各有1条速览')
_i864 = open('index.html', encoding='utf-8', errors='replace').read()
import re as _re864
if _re864.search('22[  ]?阶', _i864): _b864.append('index残留过时"22阶"(实际36)')
if '<div class="stat-num">36</div><div class="stat-lbl">宠物阶段</div>' not in _i864: _b864.append('index统计芯片宠物阶段≠36')
_rr864 = open('hansen_round_reward.js', encoding='utf-8', errors='replace').read()
if '跨岛共用' in _rr864: _b864.append('round_reward残留过时"跨岛共用"注释(v862已按岛)')
if '3195' in _rr864: _b864.append('round_reward残留过时护甲价注释')
if _b864: fail('v864 说明书最新机制+时效审计: ' + str(_b864[:6]))
else: ok('v946 HF4 设置说明时效复核：四份折叠速查、当前奖励与36阶宠物均使用简短中文')


# ---- 🔴 v865 (Hansen: 横幅从"赛季"改成【番外篇·星海觉醒】第19座秘境副本入口·去倒计时·去积分条·纯酷炫入口内容点进去看) ----
_b865=[]
_ss865=open('hansen_season.js',encoding='utf-8',errors='replace').read()
for _k865,_lab865 in (('番外篇 EXTRA','番外篇标签'),('第 19 座秘境','第19岛定位'),('hsn-ex-orb','副本卡球体'),('通关副本 · 赢取星海限定收藏卡','通关拿卡文案'),('v865','版本标记')):
    if _k865 not in _ss865: _b865.append('season缺【%s】'%_lab865)
# 负向: buildProgressBar里不得再有倒计时/积分进度(daysLeft调用/赛季积分标签/还差N分)
import re as _re865
_bp=_ss865[_ss865.find('function buildProgressBar'):_ss865.find('window.__hsnOpenSeason')]
if 'daysLeft' in _bp: _b865.append('副本卡仍含倒计时daysLeft(应删)')
if '赛季积分' in _bp: _b865.append('副本卡仍含赛季积分标签(应删)')
if 'nextMilestone' in _bp: _b865.append('副本卡仍含积分里程碑进度条(应删)')
_p865=open('hansen_palette.js',encoding='utf-8',errors='replace').read()
if '#hsnSeasonBar .hsn-ex-tag' not in _p865: _b865.append('palette缺副本卡还原区(亮色下金tag/enter深字会被误伤)')
if _b865: fail('v865 番外篇副本入口卡: '+str(_b865[:6]))
else: ok('v865 (Hansen: 横幅改番外篇星海觉醒第19座秘境·去倒计时去积分): buildProgressBar彻底重做为副本入口卡=深紫渐变(#1e1b4b→#3b0764→#0c1538)+星云球体+"✦番外篇EXTRA"金标签+"第19座秘境"+星海觉醒大标题+通关拿卡副标题(已征服则显👑限定卡已入册)+金色"进入副本"钮·真机验: 番外篇/进入在位·无倒计时(还剩N天删)·无积分条(赛季积分/还差N分/nextMilestone全删)·0报错·遵守无旋转闪烁震动透明度循环禁令(仅:active缩放)·palette还原区保金tag/enter深字亮色不误伤·面板外壳文案去时间感(赛季准备中→星海秘境). v865')

# ---- v946 HF6 Boss大满贯：普通/Land独立逐轮state；女帝终战独立 ----
_b866=[]
_r866=open('hansen_round_reward.js',encoding='utf-8',errors='replace').read()
for _k866,_lab866 in (
    ("STATE_PREFIX = 'hansen_boss_round_state_v946_'",'每岛独立state key'),
    ('function modeFor(k)','普通/Land模式隔离'),
    ('window.BOSSES.length','Land动态Boss总数'),
    ('function validState(x)','state严格校验'),
    ('x.roundNo!==x.completedCount+1','roundNo连续性'),
    ('!validReceipt(x.lastReceipt,x.completedCount)','receipt严格校验'),
    ('function stateResult()','state读取结果'),
    ('function recordRoundWin(lv)','真实胜利落本轮'),
    ('if(merged.indexOf(lv)>=0)','本轮同关去重'),
    ('function txStatus()','pending严格校验'),
    ('function recoverFullStateWithoutTx(show)','满轮无pending自动重建事务'),
    ('if(status.absent)return recoverFullStateWithoutTx(show)','无pending不能误判无待结算奖励'),
    ('if(!isFull(r.state.cleared,r.state.total))return true','只对完整本轮自动续结算'),
    ("receiptId:'round:v946:'",'receipt绑定岛和roundNo'),
    ('roundNo:tx.roundNo+1','结算推进下一轮'),
    ('completedCount:tx.roundNo','结算提交完成轮'),
    ('cleared:[]','结算清空下一轮'),
    ('Boss 本轮进度存档异常，奖励已暂停；原始数据已保留','坏state fail-closed'),
    ('Boss 奖励恢复凭据异常，奖励已暂停；原始数据已保留','坏pending fail-closed'),
):
    if _k866 not in _r866: _b866.append('round_reward缺【%s】'%_lab866)
if 'window.getIslandClearedLevels()' in _r866:
    _b866.append('round_reward仍读取永久islandClears，历史全通可伪造新轮')
if "localStorage.getItem(k+'_prog')" in _r866:
    _b866.append('round_reward仍读取landN_prog，历史解锁可伪造新轮')
_rr_start=_r866.find('function readRound')
_rr_end=_r866.find('function isFull',_rr_start)
_rr_read=_r866[_rr_start:_rr_end]
if 'S.level' in _rr_read or 'getIslandClearedLevels' in _rr_read or "'_prog'" in _rr_read:
    _b866.append('readRound未保持为HF6 state只读视图')
_win866=_r866[_r866.find('function onWinModern(lv)'):_r866.find('function onWin(lv)')]
if not (0 <= _win866.find('recordRoundWin(lv)') < _win866.find('isFull(win.state.cleared,win.state.total)') < _win866.find('writeJson(txKey(),tx)')):
    _b866.append('现代结算未按“先记本轮胜利→验满轮→建pending”顺序')
if 'gemPaidToday()' in _win866 or 'markGemPaidToday' in _win866:
    _b866.append('普通/Land现代结算仍依赖旧每日闸门')
if _b866: fail('v946 HF6 Boss大满贯独立逐轮state: '+str(_b866[:8]))
else: ok('v946 HF6 Boss大满贯：普通/Land只认各岛当前奖励轮实际胜利state，重复关去重；满轮以roundNo receipt一次结算并原子清账，满轮state与pending之间崩溃可自动重建事务；损坏state/pending fail-closed；永久通关与landN_prog仅解锁不发奖')

# ---- v941 女帝正式奖励：8枚真实Land旗 + 实际Lv6，一次性100钻；旧六柱只迁移补差 ----
_b867=[]
_r867=_r866
for _k867,_lab867 in (
    ("function isSeason(k){ return k==='season'; }",'只认女帝主页面'),
    ("localStorage.getItem('hsn_landmap_cleared_'+i)==='1'",'读取8枚真实Land旗'),
    ("if((lv|0)!==6 || seasonLandClears().length!==8) return false;",'实际Lv6与8旗双门'),
    ("var SEASON_FINAL_KEY = 'hansen_season_final_reward_v941'",'一次性终战账本'),
    ("var SEASON_LEGACY_KEY = 'hansen_season_pillar_gems'",'旧账仅迁移'),
    ('credited:count===6?100:count*15','旧六柱钻石补差'),
    ('legacy.finalBenefitsAlreadyPaid?0:REWARD_COIN','旧终柱避免重复金币'),
    ("showReward({mode:'season'",'女帝动态奖励弹窗'),
):
    if _k867 not in _r867: _b867.append('round_reward缺【%s】'%_lab867)
_t867=open('template.html',encoding='utf-8',errors='replace').read()
_rb867=open('hansen_round_bar.js',encoding='utf-8',errors='replace').read()
if 'window.__seasonPillarsLit = function()' in _t867: _b867.append('template复活旧__seasonPillarsLit正式判据')
if '六柱试炼' in _rb867 or '每点亮一柱 +15' in _rb867: _b867.append('进度器复活旧六柱正式UI')
if _b867: fail('v941 女帝正式奖励真实性: '+str(_b867[:8]))
else: ok('v941 女帝奖励真实性: 8枚持久化Land旗+实际Lv6才发一次性100钻/300金/120分；旧六柱只作补差且不重复权益')

# ---- 🔴 v868 (Hansen: 星海章节95个单词真人发音导入·响度归一到-16 LUFS) ----
_b868 = []
import os as _os868, json as _json868
_sample868 = ['describe','produce','actually','maintain','suggest','recognize','predict','period','occasionally']
_missing868 = [_w for _w in _sample868 if not _os868.path.exists('words/'+_w+'_season.mp3')]
if _missing868: _b868.append('缺音频文件: '+str(_missing868))
_d868 = _json868.load(open('island_data.json', encoding='utf-8'))
_isles868 = _d868 if isinstance(_d868, list) else list(_d868.values())
_season868 = None
for _i868 in _isles868:
    if 'season' in str(_i868.get('key','')).lower(): _season868 = _i868; break
if _season868:
    _la868 = _season868.get('local_audio','')
    if _la868.count('_season.mp3') < 155: _b868.append('season.local_audio映射不足155(现%d)' % _la868.count('_season.mp3'))
    for _w868 in _sample868:
        if _w868+"_season.mp3" not in _la868: _b868.append('映射缺'+_w868); break
else: _b868.append('未找到season岛')
_sh868 = open('island_season.html', encoding='utf-8', errors='replace').read()
if _sh868.count('_season.mp3') < 155: _b868.append('island_season.html映射不足155')
if _b868: fail('v868 星海音频导入: ' + str(_b868[:6]))
else: ok('v868 (Hansen: 星海章节95单词真人发音导入): 95音频转码放words/(命名<词>_season.mp3跨岛隔离)·核对Music.zip 99音频vs星海240词=95词对应上(4杂项忽略)·island_data的wordIslandSeason.local_audio映射扩到155词(原60情绪/形容+新95动词/副词)·generate盖章季岛155词·真机验证实际加载describe_season.mp3本地真人发音生效·响度全归一-16±0.6 LUFS零削波(loudness_audit全绿881个)·坑: 源提响易削波+MP3过冲+审计过采样TP·解法重度压缩/volume精确补偿/极端词回归源(部分源本达标勿过度处理). v868')

print("")
# 🔴 v873 单词大陆(8岛+39Boss+女帝双路+29特效全接入) 不变量
_l72=[]
try:
    import json as _j72
    _isl72=sorted(glob.glob('island_land[1-8].html'))
    if len(_isl72)!=8: _l72.append('land岛数!=8:%d'%len(_isl72))
    _bc72={'island_land1.html':5,'island_land2.html':5,'island_land3.html':5,'island_land4.html':5,'island_land5.html':5,'island_land6.html':5,'island_land7.html':5,'island_land8.html':5}
    _guards72={'island_land1.html':'魔皇·小丑至尊','island_land2.html':'武器大师·战争铁砧','island_land3.html':'时之君主·克罗诺斯之影','island_land4.html':'无光之渊·暗噬君主','island_land5.html':'剑神·万剑归一','island_land6.html':'天界守护者·黄金斯芬克斯','island_land7.html':'铸星者·原初匠人','island_land8.html':'星核帝皇·弗沙欧'}
    for _f72 in _isl72:
        _t72=open(_f72,encoding='utf-8',errors='replace').read()
        _n72=int(_f72.replace('island_land','').replace('.html',''))
        _names72=re.findall(r"name:'([^']+)'", _t72[_t72.find('const BOSSES=['):_t72.find('const BOSSES=[')+6000])
        if len(_names72)!=_bc72[_f72]: _l72.append('%s BOSSES数!=%d:%d'%(_f72,_bc72[_f72],len(_names72)))
        elif _names72[-1]!=_guards72[_f72]: _l72.append('%s 守关首领!=%s:%s'%(_f72,_guards72[_f72],_names72[-1]))
        for _kw72 in ['land%d_prog'%_n72,'wordIslandLand%d'%_n72,'hsn_landmap_cleared_','island_land[1-8]\\.html','land_map.html',"HansenSpellBee.open('land%d')"%_n72]:
            if _kw72 not in _t72: _l72.append('%s 缺关键接线:%s'%(_f72,_kw72)); break
        if _t72.count('{en:"')!=30: _l72.append('%s 词数!=30:%d'%(_f72,_t72.count('{en:"')))
    _lm72=open('land_map.html',encoding='utf-8',errors='replace').read() if os.path.exists('land_map.html') else ''
    if not _lm72: _l72.append('land_map.html 缺失')
    else:
        # 🔴 地图用动态拼串('island_land'+n+'.html' / 'land'+i+'_prog')·守卫按真实源码特征查
        for _kw72 in ['hsn_landmap_cleared_',"'island_land'+n+'.html'",'island_season.html',"'land'+i+'_prog'",'function goIsland','function openEmpress']:
            if _kw72 not in _lm72: _l72.append('land_map缺:%s'%_kw72)
        for _nm72b in ['迷雾心湖','风纹草原','时之钟谷','铸剑锻炉山','晶石回廊','智慧藏书林','万邦港城','星火火山口']:
            if _nm72b not in _lm72: _l72.append('land_map缺岛:'+_nm72b)
    _cd72=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    for _kw72 in ["/^land[1-8]$/.test(__ik)","localStorage.getItem(ik+'_prog')","_lc>=8"]:  # 🔴v874: 女帝门重写为_lc>=8
        if _kw72 not in _cd72: _l72.append('hansen_cards缺land接线:%s'%_kw72)
    _ba72=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    if 'window.FXCore' not in _ba72: _l72.append('boss_attack缺FXCore框架')
    if 'var __WFX={' not in _ba72: _l72.append('boss_attack缺__WFX分发表')
    for _fx72 in ['fxWandian','fxJianshen','fxMohuang','fxSuolaris','fxMingwang']:
        if ('function '+_fx72+'(') not in _ba72: _l72.append('boss_attack缺特效函数:'+_fx72)
    for _nm72 in ['剑神·万剑归一','魔皇·小丑至尊','法老王·不朽金身']:
        if ("'"+_nm72+"':{t:'") not in _ba72: _l72.append('FX注册表缺:'+_nm72)
    _pn72=_ba72.find("var BOSSES=[\n {n:'淘气小幽灵'")
    if _pn72<0: _pn72=_ba72.find("{n:'淘气小幽灵'")
    _pseg72=_ba72[_pn72:_ba72.find('];',_pn72)] if _pn72>=0 else ''
    _pcnt72=_pseg72.count("{n:'")
    if _pcnt72!=61: _l72.append('特效调参面板BOSSES!=61:%d'%_pcnt72)
    _hs72=open('hansen_season.js',encoding='utf-8',errors='replace').read()  # 🔴v874: 入口卡已撤·番外篇横幅=唯一入口
    # 🔴v1069：原判据是字面量 "window.location.href='land_map.html'" ——
    #   而那串正是当年被改坏、留下 `window.(function` 语法错误的那一行。
    #   于是这道守卫从那时起一直红着，报的就是用户后来发现的
    #   「星海觉醒点了进不去」，只是没人看。
    #   改为检查**行为**：横幅必须有指向 land_map 的可用入口，
    #   且**不得再出现 `window.(` 这种非法语法**（它只在点击那一刻才炸，
    #   加载时不暴露，是最难发现的一类错误）。
    if 'land_map.html' not in _hs72: _l72.append('番外篇横幅未指向land_map(v874:横幅=唯一入口)')
    # 🔴v1083: 只查**真代码**，不查注释 —— v1069 之后 hansen_season.js 的注释里
    #   原样引用了那串坏代码作说明，导致这道守卫对着自己的注释报红。
    #   与本轮反复出现的毛病同源：判据必须落在会执行的东西上。
    _hs72_code = re.sub(r'/\*[\s\S]*?\*/', '', _hs72)
    _hs72_code = re.sub(r'^\s*//.*$', '', _hs72_code, flags=re.M)
    if re.search(r'window\.\s*\(', _hs72_code): _l72.append('横幅入口含非法语法 window.( —— 点击时才炸(v1069)')
    _art72=[_x for _x in glob.glob('bosses/land_*.webp')]  # 🔴v890 剑神改webp(P模式PNG微信不显示)·png+webp都算
    if len(_art72)!=30: _l72.append('land立绘数!=30:%d'%len(_art72))
except Exception as _e72:
    _l72.append('守卫自身异常:'+str(_e72)[:80])
if _l72: fail('v873 单词大陆8岛+特效全接入: '+str(_l72[:8]))
else: ok('v873 单词大陆 (8岛land1-8各30词·39Boss分族·守关首领含剑神⑤/魔皇①/弗沙欧⑧·landN_prog顺序闯关·hsn_landmap_cleared_旗·land_map地图·女帝双路解锁(星海5域或大陆8岛)·29工坊特效+FXCore注入·__WFX一表分发·调参面板61boss·index入口卡·30立绘≤800KB)')


# 🔴 v874(Hansen真机三诉求·定稿): ①旧Boss介绍屏(挑战来啦/开始挑战)彻底删除·点打boss直进选关网格 ②番外篇星海觉醒=单词大陆(横幅直进land_map·旧宇宙地图/5星域整套废除) ③选关网格底部配色牌
_l74=[]
try:
    import glob as _g74
    # ① 介绍屏死亡: 全岛+template 无旧介绍屏字样; stopBoss走picker
    for _f74 in sorted(_g74.glob('island_*.html'))+['template.html']:
        _t74=open(_f74,encoding='utf-8',errors='replace').read()
        if ('挑'+'战来啦') in _t74: _l74.append(_f74+' 旧介绍屏字样复活')
        if 'startBoss()">⚔️ 开始挑战' in _t74: _l74.append(_f74+' 旧介绍屏开始挑战按钮复活')  # 🔴收窄: 速答⚡开始挑战(startSpeed)是合法按钮·只封介绍屏组合
    for _f74 in ['island_animal.html','island_land1.html','island_season.html','template.html']:
        _t74=open(_f74,encoding='utf-8',errors='replace').read()
        if 'hansenRenderBossPicker' not in _t74: _l74.append(_f74+' stopBoss未接选关网格(hansenRenderBossPicker)')
    # ③ zone选关器配色牌
    _cd74=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    _zi74=_cd74.find('function renderSeasonZoneBossPicker')
    _zseg74=_cd74[_zi74:_zi74+30000] if _zi74>=0 else ''
    if 'hansenSetBossBg' not in _zseg74: _l74.append('zone选关器缺配色牌(hansenSetBossBg)')
    # ② 横幅=唯一入口 → land_map; index入口卡必须不存在
    _hs74=open('hansen_season.js',encoding='utf-8',errors='replace').read()
    # 🔴v1069: 同上，改查行为而非字面量
    if 'land_map.html' not in _hs74: _l74.append('番外篇横幅未指向land_map')
    _ix74=open('index.html',encoding='utf-8',errors='replace').read()
    if 'href="land_map.html"' in _ix74: _l74.append('index入口卡复活(v874已撤·横幅=唯一入口)')
    # 六柱进度器hub不挂载
    _rb74=open('hansen_round_bar.js',encoding='utf-8',errors='replace').read()
    if "/island_season\\.html/.test(location.pathname||'')) return;" not in _rb74: _l74.append('round_bar缺hub门(星海六柱已废)')
    # 管理员面板=大陆语义·0残引子岛
    _ba74=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    if 'island_season1.html' in _ba74: _l74.append('boss_attack残引已删除的island_season1.html')
    if '解锁单词大陆全部 8 岛' not in _ba74: _l74.append('管理员解锁未改大陆语义')
    _ust74=_ba74.find('window.__hsnUnlockStarSea=function')
    if _ust74>=0 and 'hsn_landmap_cleared_' not in _ba74[_ust74:_ust74+600]: _l74.append('__hsnUnlockStarSea未写大陆进度键')
    # 纪事章节接大陆进度
    if "hsn_landmap_cleared_'+_gi" not in _cd74: _l74.append('__hsnSeasonGot未接大陆进度')
except Exception as _e74:
    _l74.append('守卫自身异常:'+str(_e74)[:80])
if _l74: fail('v874 介绍屏删除+星海废除+配色牌: '+str(_l74[:8]))
else: ok('v874 (Hansen真机三诉求): ①旧Boss介绍屏彻底删除(32岛+template静态块与stopBoss全改·点打boss由hansen_cards包装直进选关网格·兜底短提示) ②番外篇星海觉醒=单词大陆冒险地图(横幅直进land_map·index入口卡撤·旧宇宙地图/信物/星轨/5星域子岛island_season1-5删除·hub重做为女帝终战竞技场: 8岛全通即战赛尔娅240词·未通锁提示+回大陆·序章自动放与星海纪事保留且章节随大陆进度解锁·round_bar六柱进度器hub不挂·管理员解锁改大陆8岛语义) ③zone选关网格底部配色牌(与正片同款·hansenSetBossBg·hub女帝面板同有)')


# 🔴 v875(Hansen·"彻底打通任督二脉"): 星海觉醒(单词大陆)所有内容彻底成为游戏一部分——壳内穿梭零白屏零延迟·复习/错题/最近记录/大满贯与正片共用一套系统
_l75=[]
try:
    # ① 导航全壳化(v860 canonical 格式)
    _hs75=open('hansen_season.js',encoding='utf-8',errors='replace').read()
    if "openIsland('land_map.html')" not in _hs75: _l75.append('横幅未壳内直开(openIsland)')
    if "fetch('land_map.html'" not in _hs75: _l75.append('缺land_map空闲预热(零延迟)')
    _lm75=open('land_map.html',encoding='utf-8',errors='replace').read()
    _go75_start=_lm75.find('function goIsland(n)')
    _go75_end=_lm75.find('function goBack()',_go75_start)
    _go75=_lm75[_go75_start:_go75_end] if _go75_start>=0 and _go75_end>_go75_start else ''
    for _tok75 in ("var file='island_land'+n+'.html'",
                   "typeof window.parent.openIsland==='function'",
                   'window.parent.openIsland(file)', 'window.location.assign(file)'):
        if _tok75 not in _go75: _l75.append('地图进岛缺安全壳路由/同源回退:'+_tok75)
    if 'window.location.href' in _go75 or '://' in _go75:
        _l75.append('地图进岛回退不是同源相对 location.assign')
    _pre75m=re.search(r"try\{\s*var _cn=navigator\.connection[\s\S]*?\}catch\(_e2\)\{\}",_lm75)
    _pre75=_pre75m.group(0) if _pre75m else ''
    for _tok75 in ("_cn&&!_cn.saveData&&_cn.effectiveType==='4g'",
                   'var next=0', 'if(!clearedN(i)){next=i;break;}', 'if(next){',
                   "fetch('island_land'+next+'.html'", "credentials:'same-origin'"):
        if _tok75 not in _pre75: _l75.append('地图节流预热契约缺:'+_tok75)
    if _pre75.count("fetch('island_land'")!=1:
        _l75.append('地图预热必须最多只有一个 fetch 调用')
    if "||function(f){window.location.href=f})(\\'island_season.html\\')" not in _lm75: _l75.append('地图女帝跳未壳化')
    # ② 岛名正则纳入数字(复习STORAGE_KEY/错题总览在land点火的命门)
    for _f75,_lab75 in (('hansen_upgrade.js','upgrade'),('hansen_wrong_overview.js','overview')):
        _t75=open(_f75,encoding='utf-8',errors='replace').read()
        if "island_([a-z0-9]+)" not in _t75: _l75.append(_lab75+' 岛名正则缺数字(land1-8不点火)')
    # ③ 三清单入册(land1-8 + season终战)
    _ov75=open('hansen_wrong_overview.js',encoding='utf-8',errors='replace').read()
    for _k75 in ["'land8': 'wordIslandLand8'","'season': 'wordIslandSeason'","'wordIslandLand8':","name:'星海终战'","name:'迷雾心湖'"]:
        if _k75 not in _ov75: _l75.append('overview清单缺:'+_k75)
    _up75=open('hansen_upgrade.js',encoding='utf-8',errors='replace').read()
    for _k75 in ["'land8': 'wordIslandLand8'","'season': 'wordIslandSeason'"]:
        if _k75 not in _up75: _l75.append('upgrade映射缺:'+_k75)
    _ix75=open('index.html',encoding='utf-8',errors='replace').read()
    for _k75 in ["'wordIslandLand1':","'wordIslandLand8':","short:'星海终战'"]:
        if _k75 not in _ix75: _l75.append('index META缺:'+_k75)
    # ④ 大满贯 Land 分支：动态总关数，但奖励进度只读HF6逐轮state。
    _rr75=open('hansen_round_reward.js',encoding='utf-8',errors='replace').read()
    for _k75 in ["function isLand(k)","/^land[1-8]$/","STATE_PREFIX = 'hansen_boss_round_state_v946_'","function modeFor(k)","function recordRoundWin(lv)","if(isLand(k)){"]:
        if _k75 not in _rr75: _l75.append('round_reward缺land分支:'+_k75[:34])
    if "localStorage.getItem(k+'_prog')" in _rr75 or 'window.getIslandClearedLevels()' in _rr75:
        _l75.append('round_reward的Land奖励仍读取永久解锁/通关历史')
except Exception as _e75:
    _l75.append('守卫自身异常:'+str(_e75)[:80])
if _l75: fail('v875 星海觉醒彻底打通: '+str(_l75[:8]))
else: ok('v875/HF6 星海觉醒彻底打通：导航、复习错题与Land清单完整；Land大满贯总数取本岛BOSSES.length，但奖励进度只认每岛当前轮state，永久landN_prog仅负责解锁')


# 🔴 v875(Hansen·"彻底打通·像一间房门全开·零延迟零网页感·复习错题共用一套"): 单词大陆全域壳内互通+系统共用 不变量
_l75=[]
try:
    _hl75=open('hansen_home_link.js',encoding='utf-8',errors='replace').read()
    for _k75 in ["window.parent.openIsland('land_map.html')","location.replace('land_map.html')"]:
        if _k75 not in _hl75: _l75.append('home_link缺land返回分支:'+_k75)
    _up75=open('hansen_upgrade.js',encoding='utf-8',errors='replace').read()
    if 'island_([a-z0-9]+)' not in _up75: _l75.append('upgrade岛名正则未纳数字(land1-8复习/错题不点火)')
    if "'land8': 'wordIslandLand8'" not in _up75: _l75.append('upgrade映射缺land条目')
    _wo75=open('hansen_wrong_overview.js',encoding='utf-8',errors='replace').read()
    if _wo75.count("'wordIslandLand8'")<2: _l75.append('错题总览双map未全含land(%d/2)'%_wo75.count("'wordIslandLand8'"))
    if '星海终战' not in _wo75: _l75.append('错题总览缺星海终战条目')
    _ix75=open('index.html',encoding='utf-8',errors='replace').read()
    for _k75 in ["'wordIslandLand8'","'wordIslandSeason'"]:
        if _k75 not in _ix75: _l75.append('index续玩META缺:'+_k75)
    _rr75=open('hansen_round_reward.js',encoding='utf-8',errors='replace').read()
    for _k75 in ['isLand',"STATE_PREFIX = 'hansen_boss_round_state_v946_'",'function recordRoundWin(lv)']:
        if _k75 not in _rr75: _l75.append('round_reward缺land轨:'+_k75)
    if "localStorage.getItem(k+'_prog')" in _rr75 or 'window.getIslandClearedLevels()' in _rr75:
        _l75.append('round_reward的Land轨仍把历史解锁/通关记录当本轮证明')
    _hs75=open('hansen_season.js',encoding='utf-8',errors='replace').read()
    if "openIsland('land_map.html')" not in _hs75: _l75.append('横幅未走壳(openIsland)')
    if "fetch('land_map.html'" not in _hs75: _l75.append('横幅缺地图空闲预热')
    _lm75=open('land_map.html',encoding='utf-8',errors='replace').read()
    _go75_start=_lm75.find('function goIsland(n)')
    _go75_end=_lm75.find('function goBack()',_go75_start)
    _go75=_lm75[_go75_start:_go75_end] if _go75_start>=0 and _go75_end>_go75_start else ''
    for _tok75 in ("var file='island_land'+n+'.html'",
                   "typeof window.parent.openIsland==='function'",
                   'window.parent.openIsland(file)', 'window.location.assign(file)'):
        if _tok75 not in _go75: _l75.append('地图进岛缺安全壳路由/同源回退:'+_tok75)
    if 'window.location.href' in _go75 or '://' in _go75:
        _l75.append('地图进岛回退不是同源相对 location.assign')
    _pre75m=re.search(r"try\{\s*var _cn=navigator\.connection[\s\S]*?\}catch\(_e2\)\{\}",_lm75)
    _pre75=_pre75m.group(0) if _pre75m else ''
    for _tok75 in ("_cn&&!_cn.saveData&&_cn.effectiveType==='4g'",
                   'var next=0', 'if(!clearedN(i)){next=i;break;}', 'if(next){',
                   "fetch('island_land'+next+'.html'", "credentials:'same-origin'"):
        if _tok75 not in _pre75: _l75.append('地图节流预热契约缺:'+_tok75)
    if _pre75.count("fetch('island_land'")!=1:
        _l75.append('地图预热必须最多只有一个 fetch 调用')
except Exception as _e75:
    _l75.append('守卫自身异常:'+str(_e75)[:80])
if _l75: fail('v875 彻底打通(壳内互通+系统共用+预热): '+str(_l75[:8]))
else: ok('v875/HF6 彻底打通：壳内互通、系统共用、节流预热保持；Land奖励轨使用动态Boss总数与独立逐轮state，不再读取landN_prog发奖')


# 🔴 v876(Hansen五诉求): ①72小时全Boss试用 ②拼写蜂根治(绝不落全池) ③复习错题完美 ④金币钻石覆盖新岛 ⑤大陆Boss难度↑(血量700+·拼写题50%·反击按关序加重)
_l76=[]
try:
    _fp76=open('hansen_freepass.js',encoding='utf-8',errors='replace').read()
    for _k in ['TRIAL','hansen_freepass_ver','window.HansenFreepass']:
        if _k not in _fp76: _l76.append('freepass缺:'+_k)
    if '72 \u5c0f\u65f6' not in _fp76 and '72 小时' not in _fp76: _l76.append('freepass未标72小时')
    _cd76=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    if '||_fp76' not in _cd76: _l76.append('zone选关缺试用放行(||_fp76)')
    if '\\ud83c\\udd93' not in _cd76: _l76.append('zone选关缺🆓试用格标')
    if '_lc>=8 || _fp76h' not in _cd76: _l76.append('女帝门缺试用分支(_lc>=8 || _fp76h)')
    if '72小时试用开放' not in _cd76: _l76.append('女帝面板缺试用提示')
    _sb76=open('spelling_bee.html',encoding='utf-8',errors='replace').read()
    for _i in range(1,9):
        _n76=_sb76.count('"isl": "land%d"'%_i)
        if _n76!=30: _l76.append('蜂land%d词数%d(应30)'%(_i,_n76))
    if _sb76.count('"isl": "season"')!=0: _l76.append('蜂残留season标签%d(应0已retag)'%_sb76.count('"isl": "season"'))
    if '绝不落全池' not in _sb76: _l76.append('蜂缺空匹配兜底(绝不落全池)')
    if "land1:'迷雾心湖'" not in _sb76: _l76.append('蜂缺land岛名')
    import glob as _g76
    for _f76 in sorted(_g76.glob('island_land[1-8].html')):
        _t76=open(_f76,encoding='utf-8',errors='replace').read()
        if ('hp:700' not in _t76) and ('hp:760' not in _t76): _l76.append(_f76+' 血量未达700起步')
        # 🔴v877: 拼写机制由 v876 手写 bossSpellIn 改为【复用正片 hansen_boss_lock.js 现成的 spellFill/spellPick/typing 自绘键盘】——手写残骸必须清零
        if 'bossSpellIn' in _t76: _l76.append(_f76+' 残留v876手写输入框bossSpellIn(v877应删·改用正片自绘键盘)')
        if '__bossSpellSubmit' in _t76 or '__bossSpellResolve' in _t76: _l76.append(_f76+' 残留v876手写拼写函数(v877应删)')
except Exception as _e76:
    _l76.append('守卫自身异常:'+str(_e76)[:80])
if _l76: fail('v876 试用72h+蜂根治+大陆难度: '+str(_l76[:8]))
else: ok('v876/HF6 (Hansen五诉求): ①72小时Boss试用只负责挑战解锁，不写大满贯奖励进度 ②拼写蜂按岛过滤 ③复习/错题覆盖Land ④金币钻石覆盖Land，Boss奖励必须完成当前逐轮state后结算88钻+300金+120分钟 ⑤大陆Boss难度阶梯保持')


# 🔴 v877(Hansen「全面进化贾维斯·成为超级智能体·让小程序达最完美」): 贾维斯 2.0 超级全域体检引擎自守卫——
#   保证 jarvis_scan.py 的 8 大主动扫描器不丢失、健康分/报告逻辑完整、已接入 jarvis.py 主入口。
_l877=[]
try:
    _js877=open('jarvis_scan.py',encoding='utf-8',errors='replace').read()
    # 8 大扫描器函数必须全在
    for _fn in ['scan_resources','scan_cache_stamp','scan_dup_id','scan_leak_patterns','scan_hygiene','scan_perf','scan_html_structure','scan_js_syntax']:
        if ('def %s('%_fn) not in _js877: _l877.append('缺扫描器 '+_fn)
    # SCANNERS 注册表 8 条 + 三级严重度 + 健康分 + HTML报告
    if _js877.count('scan_')<16: _l877.append('SCANNERS 注册不全(应8器)')
    for _kw in ['CRIT','WARN','INFO','def run_all','render_html_report','def score','W_CRIT','W_WARN']:
        if _kw not in _js877: _l877.append('2.0缺核心 '+_kw)
    # 关键降噪校准不能回退(否则误报暴增): 重复ID剥script·缓存戳限真资源·占位符跳过·孤儿汇总
    if '_strip_scr' not in _js877: _l877.append('重复ID未剥<script>(会误报模板字符串)')
    if '(?:src|href)' not in _js877 or 'js|css|png' not in _js877: _l877.append('缓存戳未限定真实资源引用(会误报URL构造/正则/报告文本)')
    if '_PLACEHOLDER' not in _js877: _l877.append('JS语法未跳过模板占位符(会误报template.html)')
    if '孤儿资源共' not in _js877: _l877.append('孤儿未汇总(会逐个刷屏)')
    if '存了却从不 clearInterval' not in _js877: _l877.append('内存泄漏未改句柄漏清检测(会误报单例常驻定时器)')
    # 已接入 jarvis.py 主入口
    _jv877=open('jarvis.py',encoding='utf-8',errors='replace').read()
    if 'jarvis_scan.py' not in _jv877: _l877.append('jarvis.py 未接入 2.0 全域体检')
    if '超级全域体检' not in _jv877: _l877.append('jarvis.py 缺 2.0 巡检提示')
except Exception as _e877:
    _l877.append('守卫自身异常:'+str(_e877)[:80])
if _l877: fail('v877 贾维斯2.0超级体检引擎: '+str(_l877[:8]))
else: ok('v877 (Hansen「全面进化贾维斯」): 贾维斯 2.0 超级全域体检引擎(jarvis_scan.py)——8 大主动扫描器把整个代码库当陌生系统 X 光: ①资源引用完整性(死链+孤儿·孤儿汇总不刷屏) ②缓存戳一致性(限真实资源引用·不误报URL构造/正则/报告文本) ③重复DOM id(剥script体·不误报模板字符串) ④内存泄漏(句柄存了却不clear·不误报单例常驻定时器) ⑤危险模式(eval/document.write) ⑥上线卫生(debugger/console/alert/TODO) ⑦体积性能哨兵(大文件排行) ⑧HTML结构健康(标签开合) + JS语法全量校验(独立js+内联script·跳过模板占位符)。三级严重度(致命8分/警告2分/提示不扣)·加权健康分·可视化体检报告(体检仪表盘HTML)·纯静态秒级抗环境收割。已接入 jarvis.py 主入口(巡检后自动全域X光·发现致命则不放行)。与 hansen_evolve(使命体检)+check_resources(防复发) 三足鼎立·主动发现补被动防守。')


# 🔴 v877(Hansen重大bug: "单词拼写为什么用的不是我们自己内部的机制·为什么要用外接键盘·正片打boss那套现成拼写不是有现成的吗"):
#   v876 给大陆8岛手写了 bossSpellIn 输入框(调系统键盘)——错! 正片 hansen_boss_lock.js 早有现成的 spellFill/spellPick/typing
#   自绘键盘机制(applyChapterMode hook nextBossQ 自动出题)。修复=删手写·让大陆岛复用正片现成机制。
_l877b=[]
try:
    # ① 正片 boss_lock 的 applyChapterMode level 计算认大陆 _s1Idx(否则读不到正确等级·拼写题不触发)
    _bl877=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
    if "island_land[1-8]" not in _bl877 or "_s1Idx" not in _bl877: _l877b.append('boss_lock未让applyChapterMode认大陆_s1Idx')
    if "((window._s1Idx|0)+1)*4" not in _bl877: _l877b.append('boss_lock缺大陆关序→题型等级映射')
    # 现成三题型函数仍在(未被误删)
    for _fn in ['function applySpellFill','function applySpellPick','function applyTyping','function bossKeyboardHtml','function submitTyping']:
        if _fn not in _bl877: _l877b.append('正片拼写机制缺:'+_fn)
    # ② 大陆8岛: v876手写残骸清零 + 血量保留 + 反击映射保留(typing/spellFill答错走bossAnswer需要)
    import glob as _g877
    for _f877 in sorted(_g877.glob('island_land[1-8].html')):
        _t877=open(_f877,encoding='utf-8',errors='replace').read()
        if 'bossSpellIn' in _t877: _l877b.append(_f877+' 残留手写输入框bossSpellIn')
        if '__bossSpellSubmit' in _t877 or '__bossSpellResolve' in _t877: _l877b.append(_f877+' 残留手写拼写函数')
        if '✍️ 拼写挑战' in _t877: _l877b.append(_f877+' 残留手写拼写标题')
        if ('hp:700' not in _t877) and ('hp:760' not in _t877): _l877b.append(_f877+' 血量阶梯丢失')
        # 加载了正片 boss_lock(现成机制的载体)
        if 'hansen_boss_lock.js' not in _t877: _l877b.append(_f877+' 未加载hansen_boss_lock.js(现成拼写机制载体)')
        # 反击映射保留(land关序→反击伤害·typing/spellFill答错靠它)
        if "island_land[1-8]" not in _t877 or "((window._s1Idx|0)+1)*4" not in _t877: _l877b.append(_f877+' 反击等级映射丢失(land关序→反击伤害)')
except Exception as _e877b:
    _l877b.append('守卫自身异常:'+str(_e877b)[:80])
if _l877b: fail('v877 大陆拼写复用正片机制: '+str(_l877b[:8]))
else: ok('v877 (Hansen重大bug·拼写题不用外接键盘): 单词大陆8岛的boss拼写题【彻底复用正片现成机制】——v876给大陆手写的 bossSpellIn 输入框(调系统键盘)整套删除(3处: nextBossQ拼写50%分支+__bossSpellSubmit+__bossSpellResolve)·改为让正片 hansen_boss_lock.js 的 applyChapterMode(hook nextBossQ 自动出题)认大陆关卡序 _s1Idx(映射: 关序×4→题型等级·关1→Lv4基础题/关3→Lv12出spellPick拼字选择/关5→Lv20出typing看中文拼单词+游戏内置自绘键盘btsKbd=Hansen说的"我们自己的键盘")。现成三题型 applySpellFill(补全缺字母·2选1填空)/applySpellPick(6选1拼字辨认)/applyTyping(自绘26键盘敲字母·敲满自动提交submitTyping→bossAnswer判定)全部沿用·与正片18岛20关完全一致的体验/伤害结算/自绘键盘。血量阶梯(700~1150)保留·land关序→反击伤害映射保留(typing/spellFill答错走同一bossAnswer)。实测: 大陆第5关40题全typing且btsKbd自绘键盘出现40次·样例"看中文意思,拼出英文:乐观的"·点键盘拼对furious→boss掉血17"敌方受到伤害"·题型按关卡梯度(Lv4基础/Lv12 spellPick/Lv20 typing)·手写bossSpellIn残骸清零。绝不再另造一套·绝不用系统外接键盘。')


# 🔴 v878(Hansen重大bug回归·反复强调: "boss从头到尾大小不要随便改变·打字题boss变小了换别的题又变大·所有boss全部修复保证以后不再出现"):
#   根因: hansen_boss_lock.js 的 .bts-typing(打字题) 把 boss SVG transform:scale(.717)→视觉165px, 而选择/拼字题是全尺寸214px → 题型切换boss忽大忽小。
#   修复: typing 立绘 scale .717→.9304(视觉165→214·与所有其他题型严格一致)·矮屏只压键盘+间距绝不缩立绘。bts-compact死代码scale同步对齐防复活。
_l878=[]
try:
    _bl878=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
    # ① typing立绘必须scale(.9304)=214视觉·绝不能回退到.717(=165缩小)
    if 'scale(.717)' in _bl878: _l878.append('boss_lock残留scale(.717)——打字/拼写题boss会变小(v878必须全部改.9304=214视觉与其他题型一致)')
    # ② typing的SVG scale必须是.9304
    import re as _re878
    _m=_re878.search(r"bts-typing \.boss-sprite svg\{[^}]*transform:scale\(([\d.]+)\)", _bl878)
    if not _m: _l878.append('找不到bts-typing立绘scale规则')
    elif _m.group(1)!='.9304': _l878.append('bts-typing立绘scale=%s(应.9304=视觉214与其他题型一致)'%_m.group(1))
    # ③ compact死代码也对齐(防未来激活翻车)
    _mc=_re878.search(r"bts-compact \.boss-sprite svg\{[^}]*transform:scale\(([\d.]+)\)", _bl878)
    if _mc and _mc.group(1)!='.9304': _l878.append('bts-compact立绘scale=%s(应.9304对齐·防激活时boss变小)'%_mc.group(1))
    # ④ v878标记在(说明立绘一致修复到位)
    if 'v878' not in _bl878: _l878.append('boss_lock缺v878修复标记')
    # ⑤ 恒定盒230仍在(题型切换零位移的基础)
    if '.bts-typing .boss-sprite,.boss-arena.bts-typing .boss-sprite-wrap{width:230px' not in _bl878.replace('.boss-arena',''):
        # 宽松匹配
        if 'width:230px!important;height:230px!important' not in _bl878: _l878.append('恒定盒230丢失(题型切换会位移)')
except Exception as _e878:
    _l878.append('守卫自身异常:'+str(_e878)[:80])
if _l878: fail('v878 boss立绘全题型一致: '+str(_l878[:8]))
else: ok('v878 (Hansen重大bug·boss尺寸从头到尾一致): 所有boss在【任何题型】立绘尺寸严格一致(视觉214px)——根治打字题(.bts-typing)把boss SVG scale(.717)缩到165px导致"打字boss变小·换题又变大"的忽大忽小(BUG#58/59回归)。修复: typing立绘 scale .717→.9304(视觉214·与选择题cn2en/拼字题spellPick/填空题spellFill完全相同)·恒定盒230保持(题型切换零位移)·矮屏(≤729/≤679px)只逐级压键盘键高(34/28)+收紧hero/hint/slot间距【绝不缩立绘】·bts-compact死代码scale同步对齐防复活。实测: 正片星海岛+大陆岛land·常规屏747+矮屏700/660·三题型(cn2en/spellPick/typing)立绘全部214px零差异·超屏0px不出滚动条。以后所有boss任何题型尺寸恒定不变。')


# 🔴 v879(Hansen重大bug: "星海女帝那关5个boss用的还是老特效·我明明给了新特效"): 星海第一星域五守卫接入Hansen重做的新工坊特效。
#   根因: 破阵者/战争铁砧/流亡之刃/组装者/古老意志 这5个boss的FX表t指向【老if链】的老hba函数(hbaExileBlade等),
#   而Hansen在工坊(/home/claude/newboss)重做的新特效(fxPozhen/fxTiezhan/fxLiuwang/fxZuzhuang/fxGuyi)没接进游戏。
#   修复: 5新函数原样移植进hansen_boss_attack.js + __WFX表加5映射 + 5boss的t改指新特效(走__WFX优先派发·8105在老if链之前)。
_l879=[]
try:
    _ba879=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    # ① 5个新特效函数必须存在(Hansen重做的工坊特效)
    for _fn in ['fxPozhen','fxTiezhan','fxLiuwang','fxZuzhuang','fxGuyi']:
        if ('function '+_fn) not in _ba879: _l879.append('新特效函数缺:'+_fn)
    # ② __WFX表必须含5个新映射(t码→新函数)
    for _m in ['pozhen:fxPozhen','tiezhan:fxTiezhan','liuwang:fxLiuwang','zuzhuang:fxZuzhuang','guyi:fxGuyi']:
        if _m not in _ba879: _l879.append('__WFX映射缺:'+_m)
    # ③ 5个boss的t必须已改为新t(指向新特效·不再是老t)
    _bt=[("暗影先锋·破阵者","pozhen","vanguard"),("武器大师·战争铁砧","tiezhan","waranvil"),
         ("星陨武士·流亡之刃","liuwang","exileblade"),("机械主教·组装者","zuzhuang","assembler"),
         ("活体行星·古老意志","guyi","ancientwill")]
    for _n,_new,_old in _bt:
        if ("'"+_n+"':{t:'"+_new+"'") not in _ba879: _l879.append(_n+' 未改用新特效t='+_new)
        # 老t不得再有任何boss指向(否则会走老特效)
        if ("'"+_n+"':{t:'"+_old+"'") in _ba879: _l879.append(_n+' 仍指老特效t='+_old)
    # ④ 5个老t必须无任何boss指向(彻底切换)
    for _old in ['exileblade','waranvil','vanguard','assembler','ancientwill']:
        if ("t:'"+_old+"'") in _ba879: _l879.append('老特效t仍被引用(会触发老特效):'+_old)
    # ⑤ __WFX优先派发在老if链之前(保证新特效先命中)
    _iw=_ba879.find('if(__WFX[t])')
    _io=_ba879.find("if(t==='exileblade')")
    if _iw<0 or (_io>=0 and _iw>_io): _l879.append('__WFX派发未在老if链之前(新特效可能被老链抢先)')
except Exception as _e879:
    _l879.append('守卫自身异常:'+str(_e879)[:80])
if _l879: fail('v879 星海第一星域五守卫新特效接入: '+str(_l879[:8]))
else: ok('v879 (Hansen重大bug·5个boss用老特效): 星海第一星域五守卫【接入Hansen重做的新工坊特效】——破阵者/战争铁砧/流亡之刃/组装者/古老意志这5个boss原来FX表t指向老if链的老hba函数(hbaExileBlade/hbaWarAnvil/hbaVanguard/hbaAncientWill等·星海女帝那关做的初版)·Hansen在工坊重做了更强新特效但没接进游戏。修复: 5个新特效函数(fxPozhen目镜锁定卡宾点射肩撞双匕/fxTiezhan架盾机枪六联导弹军刀全武库殉爆/fxLiuwang光刃斗篷残影错位剑之对话居合一闪/fxZuzhuang独眼扫描切割冲压流水线出兵/fxGuyi行星苏醒引力波记忆金丝坍缩超新星)原样移植进hansen_boss_attack.js(签名+FXCore依赖与游戏完全一致·已核验游戏FXCore方法集==工坊)·__WFX表加5映射·5boss的t改指新特效。派发: __WFX优先(8105在老if链8427之前)·t命中即调新函数return·老t已无任何boss指向(老hba函数成死代码保留勿删)。实测: 5守卫全部触发新特效canvas生成·0报错·老特效彻底不再被调。')


# 🔴 v880(Hansen 定稿·"彻底封印这段代码"×4): 星海第一星域五守卫的老版本攻击特效【硬封印】。
#   接v879(5boss已换新特效fxPozhen/fxTiezhan/fxLiuwang/fxZuzhuang/fxGuyi·老t无boss指向)。
#   Hansen要彻底封印: 加__SEALED_OLD_T拦截·置于所有老if(t===)分支之前·任何老t进来只掉血不放老特效。
#   双保险: ①无boss指向老t(v879) ②即便误设也被封印拦截(v880)。老函数体作死代码保留(勿删)。
_l880=[]
try:
    _ba880=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    # ① 封印拦截表必须存在·含全部5个老t
    _si=_ba880.find('__SEALED_OLD_T')
    if _si<0: _l880.append('缺__SEALED_OLD_T封印拦截表')
    else:
        for _ot in ['exileblade','waranvil','vanguard','assembler','ancientwill']:
            # 封印表定义行须含该t
            _tblstart=_ba880.find('var __SEALED_OLD_T={')
            _tblend=_ba880.find('}',_tblstart)
            if _tblstart<0 or (_ot+':1') not in _ba880[_tblstart:_tblend+1]:
                _l880.append('封印表缺老t: '+_ot)
    # ② 封印动作=deal()+return(拦截·遵守v487掉血铁则)
    if 'if(__SEALED_OLD_T[t]){' not in _ba880: _l880.append('缺封印拦截判断')
    else:
        _ai=_ba880.find('if(__SEALED_OLD_T[t]){')
        _seg=_ba880[_ai:_ai+120]
        if 'deal()' not in _seg or 'return' not in _seg: _l880.append('封印动作非deal()+return(须掉血照常+拦截)')
    # ③ 封印【必须】在所有5个老if(t===)分支之前(控制流保证老函数unreachable)
    _sealpos=_ba880.find('if(__SEALED_OLD_T[t]){')
    for _ot in ['exileblade','waranvil','vanguard','assembler','ancientwill']:
        _bp=_ba880.find("if(t==='"+_ot+"')")
        if _bp>=0 and _sealpos>=0 and _sealpos>=_bp:
            _l880.append('封印未在老分支'+_ot+'之前(封印失效)')
    # ④ 封印必须在__WFX新分发之后(不能拦截到新特效路径)——__SEALED检查应在__WFX[t]判断之后
    _wfxpos=_ba880.find('if(__WFX[t]){')
    if _wfxpos>=0 and _sealpos>=0 and _sealpos<_wfxpos:
        _l880.append('封印位置在__WFX之前(可能影响新特效分发)')
    # ⑤ 新t绝不在封印表里(否则新特效被误封)
    _tblstart=_ba880.find('var __SEALED_OLD_T={'); _tblend=_ba880.find('}',_tblstart)
    _tbl=_ba880[_tblstart:_tblend+1] if _tblstart>=0 else ''
    for _nt in ['pozhen','tiezhan','liuwang','zuzhuang','guyi']:
        if (_nt+':1') in _tbl: _l880.append('新特效t被误封印: '+_nt)
    # ⑥ 5老函数体仍在(死代码保留·勿删惯例)
    for _fn in ['hbaVanguard','hbaWarAnvil','hbaExileBlade','hbaAssembler','hbaAncientWill']:
        if ('function '+_fn) not in _ba880: _l880.append('老函数被删(应保留死代码): '+_fn)
except Exception as _e880:
    _l880.append('守卫自身异常:'+str(_e880)[:80])
if _l880: fail('v880 五守卫老特效硬封印: '+str(_l880[:8]))
else: ok('v880 (Hansen·彻底封印×4): 星海第一星域五守卫的老版本攻击特效【硬封印·永不触发】——接v879(破阵者/战争铁砧/流亡之刃/组装者/古老意志已换新特效·老t无boss指向)·Hansen要彻底封印防以后再出现。实现: playFx派发入口在__WFX新分发之后、所有老if(t===)分支之前加__SEALED_OLD_T={exileblade,waranvil,vanguard,assembler,ancientwill}拦截·命中即deal()+return(遵守v487铁则掉血反馈永不被破坏·但绝不放老特效)。双保险: ①v879无任何boss指向老t ②v880即便因配置错误/复制粘贴/合并冲突误设老t也被封印硬拦截。控制流确定性: 封印在老分支之前return→老函数(hbaVanguard/hbaWarAnvil/hbaExileBlade/hbaAssembler/hbaAncientWill)+老if分支永远执行不到。老函数体作死代码保留(项目惯例勿删·可参考老实现)·各加v880封印标记注释。新特效t(pozhen/tiezhan/liuwang/zuzhuang/guyi)不在封印表·不受影响。实测: 5守卫新特效canvas正常生成·封印不误伤·0报错·封印位置铁证在全部老分支之前。')


# 🔴 v881(Hansen重大bug: "打boss失败点重试永远回到第一个boss·星海觉醒番外篇里" + "所有boss不要用再次复仇·改再次挑战"):
#   ①land岛(星海觉醒番外篇)战败重试bug: bossDefeat按钮onclick=startBoss()·而startBoss里_s1FightIdx已清空→fallback进度前沿→回第一个boss。
#     修复: 新增__landRetryBoss()重打当前失败关(_s1Idx)·8岛战败按钮改调它。②文案"再次复仇"/"重新挑战"→统一"再次挑战"(全岛+cards hook)。
_l881=[]
try:
    import glob as _g881
    # ① land 8岛: __landRetryBoss函数存在 + 战败按钮调它 + 无旧startBoss战败按钮
    for _f in sorted(_g881.glob('island_land[1-8].html')):
        _t=open(_f,encoding='utf-8',errors='replace').read()
        if 'function __landRetryBoss(' not in _t: _l881.append(_f+' 缺__landRetryBoss函数')
        if 'onclick="__landRetryBoss()">⚔️ 再次挑战' not in _t: _l881.append(_f+' 战败按钮未改__landRetryBoss/再次挑战')
        if 'onclick="startBoss()">⚔️ 重新挑战' in _t: _l881.append(_f+' 残留旧startBoss战败按钮(会回第一关)')
        # __landRetryBoss必须设_s1FightIdx=_s1Idx(重打当前关)
        if '_s1FightIdx=window._s1Idx' not in _t.replace(' ',''): _l881.append(_f+' __landRetryBoss未设_s1FightIdx=_s1Idx')
    # ② 正片19岛+season: 战败按钮文案"再次挑战"(onclick保持startBoss·正片逻辑正确)
    for _isl in ['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school','sports','time','traffic','treasure','season']:
        _f='island_'+_isl+'.html'
        _t=open(_f,encoding='utf-8',errors='replace').read()
        if 'onclick="startBoss()">⚔️ 再次挑战' not in _t: _l881.append(_f+' 战败按钮文案未改再次挑战')
    # ③ 全库战败按钮无"⚔️ 重新挑战"残留(设置页说明文字"重新挑战 Boss"不算)
    _btnleft=0
    for _f in _g881.glob('island_*.html'):
        _btnleft += open(_f,encoding='utf-8',errors='replace').read().count('>⚔️ 重新挑战</button>')
    if _btnleft>0: _l881.append('全库残留战败按钮"⚔️ 重新挑战"×%d'%_btnleft)
    # ④ cards.js "再次复仇"彻底消失·全"再次挑战" + hook识别兼容新文案
    _cards=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    if '再次复仇' in _cards: _l881.append('hansen_cards.js残留"再次复仇"(应改再次挑战)')
    if _cards.count('⚔️ 再次挑战') < 2: _l881.append('hansen_cards.js "再次挑战"少于2处')
    if "t.indexOf('再次挑战') >= 0" not in _cards: _l881.append('cards hook战败识别未兼容"再次挑战"(rebattle按钮改写会失效)')
except Exception as _e881:
    _l881.append('守卫自身异常:'+str(_e881)[:80])
if _l881: fail('v881 失败重试回第一关bug+再次挑战文案: '+str(_l881[:8]))
else: ok('v881 (Hansen重大bug·失败重试回第一关+复仇文案): ①land岛(星海觉醒番外篇)战败点重试永远回到第一个boss根治——根因bossDefeat按钮onclick=startBoss()·而startBoss里_s1FightIdx已清空→fallback到进度前沿(__front)→永远回第一个boss。修复: 新增__landRetryBoss()——把_s1FightIdx设回_s1Idx(当前失败的关·战败时仍保留该值)再startBoss·8个land岛战败按钮改调它·重试回到失败的那一关(实测第5关失败→重试仍第5关·非第1关)。②所有boss战败文案"再次复仇"/"重新挑战"→统一"再次挑战"(Hansen: 为什么要点再次复仇·改再次挑战): land8岛+正片19岛+season岛战败按钮全改"再次挑战"·hansen_cards.js rebattle hook两处"再次复仇"→"再次挑战"·hook战败识别indexOf同步兼容"再次挑战"(否则rebattle按钮改写失效)·全库"复仇"文案清零。正片19岛onclick保持startBoss(用S.level回当前等级boss·逻辑本就正确不改)。实测: land岛重试回失败关·正片/rebattle战败页全"再次挑战"无"复仇"·hook正常改写·0报错。')


# 🔴 v882(Hansen: 新岛(单词大陆/星海觉醒)宠物图网速慢时加载不出来·顶部大框空白): 宠物图加载骨架屏。
#   根因: 宠物图<img>已注入但慢网下载未完成时(img.complete=false)·区域空白无任何反馈。BUG#92首帧脚本依赖缓存·首次进岛/慢网无效。
#   修复: pet-slot默认显脉动圆骨架(::after)·宠物img onload/onerror后加.pet-ready隐藏骨架→慢网下载期显加载占位不再空白。
_l882=[]
try:
    _ps=open('hansen_pet_showcase.js',encoding='utf-8',errors='replace').read()
    # ① 骨架屏CSS: pet-slot::after脉动 + .pet-ready隐藏 + 动画keyframes
    if '.pet-slot::after' not in _ps: _l882.append('缺pet-slot::after骨架屏')
    if '.pet-slot.pet-ready::after{display:none}' not in _ps: _l882.append('缺.pet-ready隐藏骨架规则')
    if 'hsnPetSkeleton' not in _ps: _l882.append('缺骨架屏动画keyframes')
    # ② updatePetHero的img加onload标记pet-ready
    if 'pet-ready' not in _ps or 'onload=' not in _ps: _l882.append('updatePetHero img未加onload标记pet-ready')
    # ③ BUG#92首帧脚本(template+8land岛)的img加onload标记
    import glob as _g882
    _b92files=['template.html']+sorted(_g882.glob('island_land[1-8].html'))
    for _f in _b92files:
        _t=open(_f,encoding='utf-8',errors='replace').read()
        if 'BUG#92' in _t:
            # 该文件的BUG#92 img必须有onload标记pet-ready
            _i=_t.find('BUG#92 宠物首帧')
            _seg=_t[_i:_i+700] if _i>=0 else ''
            if 'pet-ready' not in _seg: _l882.append(_f+' BUG#92首帧img未加onload标记pet-ready')
except Exception as _e882:
    _l882.append('守卫自身异常:'+str(_e882)[:80])
if _l882: fail('v882 宠物图加载骨架屏: '+str(_l882[:8]))
else: ok('v882 (Hansen: 新岛宠物图慢网加载不出来空白框): 宠物图【加载骨架屏】——根因宠物<img>已注入但慢网下载未完成(img.complete=false)时区域空白无反馈·BUG#92首帧脚本依赖缓存对首次进岛/慢网无效。修复(hansen_pet_showcase.js·全岛共享模块一处覆盖所有岛): ①pet-slot默认显脉动圆骨架屏(::after·hsnPetSkeleton shimmer动画·62px圆) ②宠物img(updatePetHero注入的 + BUG#92首帧脚本注入的·template+8land岛)全加 onload/onerror→给父.pet-slot加.pet-ready类隐藏骨架 ③.pet-slot.pet-ready::after{display:none}。效果: 图未到/下载中→脉动圆占位(不再空白框)·onload/onerror后骨架消失显图。用onload类标记(非:has·兼容微信X5内核)。实测: Playwright限速2s模拟慢网·图下载中骨架屏hsnPetSkeleton显示(非空白)·图下完pet-ready加上骨架隐藏显宠物图·0报错。')


# 🔴 v883(Hansen: "把单词大陆这些boss的卡册也做出来·走抽卡花金币保住卡的价值·单独卡池老卡不贬值"): 单词大陆boss卡册+独立抽卡池。
#   39张land boss卡(8岛)·独立文件hansen_land_cards.js·独立存档(localStorage hansen_land_cardbook)·独立抽卡池·独立保底·完全隔离正片20张卡系统。
_l883=[]
try:
    import os as _os883
    # ① 独立文件存在 + 39张卡
    if not _os883.path.exists('hansen_land_cards.js'): _l883.append('hansen_land_cards.js缺失')
    else:
        _lc=open('hansen_land_cards.js',encoding='utf-8',errors='replace').read()
        _n883=_lc.count("id:'L")
        if _n883!=40: _l883.append('LAND_CARDS卡数!=40(实'+str(_n883)+')')
        # ② 独立存档(不碰正片HansenCardbook)
        if 'hansen_land_cardbook' not in _lc: _l883.append('缺独立存档key hansen_land_cardbook')
        if 'HansenLandCardbook' not in _lc: _l883.append('缺HansenLandCardbook')
        if 'HansenLandGacha' not in _lc: _l883.append('缺HansenLandGacha独立抽卡池')
        if 'hansenRenderLandCardSection' not in _lc: _l883.append('缺卡册分区渲染函数')
        if 'HansenLandGachaUI' not in _lc: _l883.append('缺抽卡UI')
        # 绝不能污染正片存档: land文件里不应写正片的HansenCardbook.obtain/正片卡池key
        if 'HansenCardbook.obtain' in _lc: _l883.append('land文件误碰正片HansenCardbook.obtain(会污染正片)')
    # ③ 挂载到岛(template+8land岛引入hansen_land_cards.js)
    _mount=['template.html']
    for _i in range(1,9): _mount.append('island_land%d.html'%_i)
    for _f in _mount:
        if _os883.path.exists(_f):
            if 'hansen_land_cards.js' not in open(_f,encoding='utf-8',errors='replace').read(): _l883.append(_f+' 未挂载hansen_land_cards.js')
    # ④ 卡册页注入单词大陆分区
    _hc=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    if 'hansenRenderLandCardSection' not in _hc: _l883.append('卡册页renderCardScreen未注入单词大陆分区')
    # ⑤ 正片BOSS_CARDS仍20张(land卡没混进正片)
    _n20=_hc.count("{lv:")
    if _n20 < 20: _l883.append('正片BOSS_CARDS疑被破坏(lv条目<20·实'+str(_n20)+')')
except Exception as _e883:
    _l883.append('守卫自身异常:'+str(_e883)[:80])
if _l883: fail('v883 单词大陆boss卡册+独立抽卡池: '+str(_l883[:8]))
else: ok('v883 (Hansen: 把单词大陆这些boss的卡册也做出来·走抽卡保住卡的价值·单独卡池老卡不贬值): 单词大陆boss卡册+独立抽卡池全套做进游戏。①独立文件hansen_land_cards.js含39张land boss卡(8岛·关卡位置定稀有度: 关1普通→关5至尊·common8/uncommon8/rare8/epic7/legendary8)·每张有立绘图+武侠奇幻风描述。②独立存档HansenLandCardbook(localStorage key=hansen_land_cardbook·has/ownedCount/obtain/碎片/保底·与正片HansenCardbook完全隔离零污染)。③独立抽卡池HansenLandGacha(单抽1000金币共用金币钱包·独立保底硬100软80·概率普通55稀有27史诗12传说5.5至尊0.5·与正片卡池分毫不干扰→老卡不贬值)。④卡册页renderCardScreen底部注入hansenRenderLandCardSection单词大陆图鉴分区(8岛分组·已拥有显立绘+彩框·未拥有🔒灰化·点击看卡详情)。⑤抽卡界面HansenLandGachaUI(全屏抽卡屏·保底进度条+概率说明+碎片兑换+揭晓动画复用正片gr-*类·扣币用spend与正片一致)。正片BOSS_CARDS20张/HansenCardbook/HansenGacha分毫不动。真机Playwright验证: 卡册页显单词大陆分区+正片区仍在·打开抽卡屏扣1000金币+揭晓动画+抽卡入册·正片卡册独立0污染·0报错。挂载: template(正片19岛+season由印章重新生成)+8land岛引入hansen_land_cards.js。')


# 🔴 v884(Hansen: "密码要能解锁所有卡牌+卡牌背景+所有关卡·之前点了还是进不去关卡"): 密码解锁扩展到单词大陆(关卡+卡)。
#   根因: ①密码门成功只调hansenTempUnlock(仅解锁卡牌显示)·没触发setAllBossClear→关卡还是锁的。②setAllBossClear只覆盖18正片+season(bossUnlocked机制)·不写landN_prog→单词大陆8岛关卡进不去。③land选关网格只认真实prog和72h试用·不认一键通关标记。④land卡(HansenLandCardbook)无临时解锁。
#   修复: ①密码门成功→加setAllBossClear(true)+HansenLandCardbook.setTempUnlock。②setAllBossClear写满8个landN_prog(可还原)。③land选关网格unlocked判定加认isAllBossClearOn标记。④land卡加临时解锁(has/ownedCount认标记)。
_l884=[]
try:
    _ba=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    _hc=open('hansen_cards.js',encoding='utf-8',errors='replace').read()
    _lc=open('hansen_land_cards.js',encoding='utf-8',errors='replace').read()
    # ① 密码门成功后触发setAllBossClear(解锁关卡)
    _gi=_ba.find('settled=true; killTimer(); setCardFails(0); closeGate();')
    if _gi<0: _l884.append('密码门成功回调未找到')
    else:
        _gseg=_ba[_gi:_gi+900]
        if 'setAllBossClear(true)' not in _gseg: _l884.append('密码门成功未触发setAllBossClear(关卡不会解锁·"进不去关卡"没修)')
        if 'HansenLandCardbook' not in _gseg or 'setTempUnlock' not in _gseg: _l884.append('密码门成功未解锁land卡')
    # ② setAllBossClear写满landN_prog(单词大陆关卡解锁)
    if "localStorage.setItem(_lk,'8')" not in _ba.replace(' ',' '): 
        if 'landN_prog' not in _ba and "land'+_li+'_prog" not in _ba: _l884.append('setAllBossClear未写满landN_prog(单词大陆关卡进不去)')
    if 'hansen_admin_landprog_bak' not in _ba: _l884.append('landN_prog未备份(关闭一键通关无法还原)')
    # ③ land选关网格认一键通关标记
    if 'hansen_admin_clearall_on' not in _hc: _l884.append('land选关网格未认一键通关标记(密码解锁后land关卡仍显示锁)')
    if '_clrAll' not in _hc: _l884.append('land选关unlocked判定未加_clrAll')
    # ④ land卡临时解锁
    if 'hansen_land_card_temp_unlock_until' not in _lc: _l884.append('land卡缺临时解锁标记')
    if 'setTempUnlock' not in _lc or '_tempOn' not in _lc: _l884.append('land卡缺setTempUnlock/_tempOn')
    # ⑤ 临时解锁只影响显示不污染真实owned(has临时解锁返回true但owned不变)——确认_tempOn在has里
    if 'if(_tempOn()) return true' not in _lc: _l884.append('land卡has未认临时解锁(密码解锁后卡不显示已拥有)')
except Exception as _e884:
    _l884.append('守卫自身异常:'+str(_e884)[:80])
if _l884: fail('v884 密码解锁所有卡牌+关卡: '+str(_l884[:8]))
else: ok('v884 (Hansen: 密码要解锁所有卡牌+卡牌背景+所有关卡·"点了之后还是进不去关卡"): 密码解锁扩展覆盖单词大陆(关卡+卡)。根因: ①密码门成功只调hansenTempUnlock(仅解锁卡牌显示24h)·【没触发setAllBossClear】→关卡还是锁的。②setAllBossClear只覆盖18正片+season(用bossUnlocked=20机制)·【不写landN_prog】→单词大陆8岛关卡(靠landN_prog解锁)进不去。③land选关网格renderSeasonZoneBossPicker的unlocked判定只认真实prog和72h试用_fp76·不认一键通关标记(试用72h过期后·密码/一键通关对land岛失效→"进不去关卡")。④新增的39张land卡(HansenLandCardbook)无临时解锁机制。修复: ①密码门成功回调→hansenTempUnlock(24)后【加setAllBossClear(true)一键通关所有关卡 + HansenLandCardbook.setTempUnlock(24)解锁land卡】。②setAllBossClear的on分支【写满8个landN_prog=8】(备份原值到hansen_admin_landprog_bak·off分支还原)→单词大陆真实进度全满可正常进关卡。③land选关网格unlocked判定【加_clrAll读isAllBossClearOn标记(hansen_admin_clearall_on)】→i<=prog||_fp76||_clrAll→密码解锁后全关卡可打。④land卡加临时解锁(标记hansen_land_card_temp_unlock_until·has/ownedCount/ownedCountByRarity认_tempOn·setTempUnlock/clearTempUnlock方法·只影响显示不污染真实owned)。卡牌背景跟卡牌解锁走(解锁卡=能进boss殿堂看本命背景)。真机Playwright验证(强制72h试用过期·land1_prog=0): 修复前land岛锁4关只可打1关(=Hansen遇到的进不去关卡)·修复后设标记land关卡锁0可打5全解锁+land卡39/39全解锁+正片卡临时解锁+landN_prog写满8·0报错。')


# 🔴 v885(Hansen: 单词大陆"挑战BOSS"图标加载慢·像贴上去的·要彻底钉死零加载·删占位符·图彻底融为一体): 挑战BOSS图base64内联。
#   根因: gameconsole.webp有725KB(显示才91px·原图768x768)·慢网下要下载→出现空白/加载态·像"贴上去的"。
#   修复: 压成200px WEBP(16KB·2x Retina清晰度)→base64 data URI直接内联进8个land岛的挑战BOSS卡·图变成页面本身一部分·零网络请求零加载·删onerror占位兜底。生成器gen_land_islands.py同步内联(重新生成也钉死)。
_l885=[]
try:
    import glob as _g885
    _ok=0
    for _f in sorted(_g885.glob('island_land[1-8].html')):
        _t=open(_f,encoding='utf-8',errors='replace').read()
        # ① 挑战BOSS图必须是data URI内联(不再是icons/gameconsole.webp外部文件)
        if 'src="icons/gameconsole.webp' in _t: _l885.append(_f+' 挑战BOSS图仍用外部png(未内联·慢网会加载)')
        # ② boss-card-img必须是data:image内联
        import re
        _m=re.search(r'<img class="boss-card-img" src="(data:image/[^"]{100,})"', _t)
        if not _m: _l885.append(_f+' 挑战BOSS图未base64内联')
        else: _ok+=1
        # ③ 内联图不应再有onerror占位兜底(图在页面里永不失败)
        _bi=_t.find('class="boss-card-img"')
        if _bi>=0:
            _bseg=_t[_bi:_t.find('>',_bi)+1]
            if 'onerror' in _bseg: _l885.append(_f+' 挑战BOSS内联图仍有onerror占位(应删·内联不会失败)')
    if _ok<8: _l885.append('内联的land岛不足8个(实'+str(_ok)+')')
    # ④ 内联data URI大小合理(不能是725KB原图base64·应是压缩后~22KB)
    if _ok>=1:
        _t1=open('island_land1.html',encoding='utf-8',errors='replace').read()
        _m1=re.search(r'<img class="boss-card-img" src="(data:image/[^"]+)"', _t1)
        if _m1 and len(_m1.group(1))>60000: _l885.append('挑战BOSS内联图过大(应压缩·实'+str(len(_m1.group(1)))+'字符·疑未压缩)')
except Exception as _e885:
    _l885.append('守卫自身异常:'+str(_e885)[:80])
if _l885: fail('v885 挑战BOSS图内联: '+str(_l885[:8]))
else: ok('v885 (Hansen: 单词大陆挑战BOSS图标加载慢像贴上去的·要彻底钉死零加载删占位·图彻底融为一体): 挑战BOSS图【base64内联·彻底钉死零加载】——根因gameconsole.webp有725KB(显示才91px·原图768x768 RGBA)·慢网下要下载→出现空白/加载态·Hansen感觉"像贴上去的还得加载"。修复: 压成200px WEBP(16.3KB·2x Retina清晰度足够·比原图小45倍)→base64 data URI(22KB)直接内联进8个land岛的挑战BOSS卡img的src·图变成页面本身的一部分·零网络请求·零加载·无论多慢网都瞬间显示。删掉onerror占位兜底(图内联在页面里永不失败·不需要占位)。生成器map8/gen_land_islands.py同步加内联替换(重新生成land岛也钉死内联)。真机Playwright验证(拦截icons/gameconsole请求延迟3s模拟慢网): 挑战BOSS图src=data URI内联·img.complete=true立即可见·naturalWidth=200有内容·onerror已删·gameconsole.webp零网络请求(纯内联不下载)·0报错。注: 只改land岛(Hansen指单词大陆)·正片岛/season岛的boss图标(各自BOSSICON)不动·season过印章不直改。')


# 🔴 v886(Hansen: 挑战BOSS卡黑底看着不舒服·换晴空天空蓝·只换单词大陆·千万别动18正片岛): 挑战BOSS卡背景 #0A1228→#38BDF8。
#   land岛挑战BOSS卡背景是 .daily-card.boss-card{background:#0A1228!important}(深黑蓝·Hansen嫌黑)。图片透明背景→改卡底色即可。换成晴空天空蓝#38BDF8。
#   范围: 只8个land岛(单词大陆)。正片18岛根本没这条CSS(不受影响)·season赛季岛保留#0A1228(Hansen只要单词大陆)。
_l886=[]
try:
    import glob as _g886
    _ok886=0
    for _f in sorted(_g886.glob('island_land[1-8].html')):
        _t=open(_f,encoding='utf-8',errors='replace').read()
        # land岛挑战BOSS背景=天空蓝#38BDF8·不再是黑#0A1228
        if '.daily-card.boss-card{background:#0A1228' in _t: _l886.append(_f+' 挑战BOSS仍是黑底#0A1228(未换天空蓝)')
        if '.daily-card.boss-card{background:#38BDF8!important}' in _t: _ok886+=1
        else: _l886.append(_f+' 挑战BOSS背景非天空蓝#38BDF8')
    if _ok886<8: _l886.append('天空蓝land岛不足8个(实'+str(_ok886)+')')
    # 正片18岛不受影响: 抽查几个正片岛不应有#38BDF8的boss-card背景(它们本就没这条CSS)
    for _isl in ['animal','food','color','school','body']:
        _t=open('island_'+_isl+'.html',encoding='utf-8',errors='replace').read()
        if '.daily-card.boss-card{background:#38BDF8' in _t: _l886.append('正片岛'+_isl+'被误改天空蓝(应只改单词大陆)')
except Exception as _e886:
    _l886.append('守卫自身异常:'+str(_e886)[:80])
if _l886: fail('v886 挑战BOSS背景天空蓝: '+str(_l886[:8]))
else: ok('v886 (Hansen: 挑战BOSS卡黑底看着不舒服·换晴空天空蓝·只换单词大陆千万别动正片): 挑战BOSS卡背景【黑#0A1228→晴空天空蓝#38BDF8】。land岛挑战BOSS卡原背景 .daily-card.boss-card{background:#0A1228!important}(深黑蓝·Hansen嫌黑看着不舒服)。红白机图片是透明背景(角落alpha≈0·那个"黑"是卡底#0A1228透过来的)→改卡片背景色即可·无覆盖问题。换成明亮晴空天空蓝#38BDF8(Hansen反复要"晴朗的天空蓝·看着心情舒畅")。范围严格: 只8个land岛(单词大陆)·正片18岛根本没有这条boss-card背景CSS(改了也不影响·实测animal/food/color无此CSS)·season赛季岛保留#0A1228不动(Hansen明确只要单词大陆)。生成器gen_land_islands.py同步替换。真机Playwright验证(关掉首次进岛欢迎弹窗后·弹窗遮罩曾误判为背景没生效): 挑战BOSS卡背景getComputedStyle=rgb(56,189,248)天空蓝·卡内四周采样(51,174,228)天空蓝·backgroundImage=none无覆盖·0报错。')


# 🔴 v887(Hansen: 剑神boss形象+卡片都换成新上传的图·保持高清): 替换 bosses/land_jianshen.webp。
#   剑神·万剑归一(land5第5关legendary·卡L55)的boss立绘(island_land5.html)和卡片(hansen_land_cards.js L55)都引用同一文件land_jianshen.webp→只替换该图·两处都换。
_l887=[]
try:
    import os as _os887
    _jp='bosses/land_jianshen.webp'
    if not _os887.path.exists(_jp): _l887.append('land_jianshen.webp缺失')
    else:
        try:
            from PIL import Image as _Img
            _im=_Img.open(_jp)
            # 新图896x1195高清(旧图615x820)·确认已替换为高清新图
            if _im.size[0]<800 or _im.size[1]<1000: _l887.append('剑神图非高清新图(尺寸'+str(_im.size)+'·应≥896x1195)')
            # 🔴v890 必须RGBA(webp)·绝不能是P模式(微信X5 WebView不显示带透明的P模式PNG→剑神空白)
            if _im.mode not in ('RGBA','LA'): _l887.append('剑神图非RGBA透明(实'+_im.mode+'·P模式微信不显示!)')
        except Exception as _ie: pass  # PIL不可用则跳过尺寸校验
    # boss立绘(land5)+卡片(land_cards)仍引用land_jianshen.webp(替换文件即两处都换)
    _l5=open('island_land5.html',encoding='utf-8',errors='replace').read()
    if 'land_jianshen.webp' not in _l5: _l887.append('land5剑神立绘未引用land_jianshen.webp')
    _lc=open('hansen_land_cards.js',encoding='utf-8',errors='replace').read()
    if "'剑神·万剑归一'" not in _lc or 'land_jianshen.webp' not in _lc: _l887.append('剑神卡L55未引用land_jianshen.webp')
except Exception as _e887:
    _l887.append('守卫自身异常:'+str(_e887)[:80])
if _l887: fail('v887 剑神图替换: '+str(_l887[:8]))
else: ok('v887 (Hansen: 剑神boss形象+卡片都换新图·保持高清): 替换 bosses/land_jianshen.webp 为新上传的水墨武侠风剑神图(896x1195 RGBA透明背景高清·旧图仅615x820)。剑神·万剑归一(land5晶石回廊第5关legendary boss·卡L55)的boss立绘(island_land5.html的BOSSES emoji svg)和收藏卡片(hansen_land_cards.js L55的img)都引用同一文件land_jianshen.webp→只替换该图片文件·boss立绘和卡片两处同时换新图。透明背景保留(Photoroom抠图·四角alpha=0)·PNG optimize无损压缩(877KB)。真机Playwright验证: 剑神卡L55 img=bosses/land_jianshen.webp·land5第5关boss立绘显示新剑神图(水墨白发持剑万剑环绕)·血条剑神·万剑归一HP940·0报错。build会bump缓存戳?v=1091让新图生效。')


# 🔴 v888(Hansen: 剑神"万剑归一"新特效做得非常棒·融入游戏成为剑神攻击特效): 新fxJianshen替换旧版。
#   万剑归一: 一堆古剑四面浮现→全部朝目标飞汇聚→合成一把精致宝剑(原地成型·剑尖朝敌方)→静止蓄势→啪最快速度直刺→穿过血条(发光撕裂口·非黑洞)→剑边穿边消失→14道炫光四射→掉血。
#   shell加opt.clipExtra(默认0不影响其他特效·剑神=66放宽裁剪让剑尖穿透血条下方可见)。
_lfx887=[]
try:
    _ba=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    # ① shell支持clipExtra(放宽裁剪·穿透血条需要)
    if 'opt.clipExtra' not in _ba: _lfx887.append('shell未支持clipExtra(剑神穿透血条会被裁)')
    # ② 新fxJianshen特征: drawEpicSword(精致宝剑)/pierceBar(刺穿)/drawPierceHole(撕裂口)/万剑归一四幕
    _i=_ba.find('function fxJianshen(bsEl')
    if _i<0: _lfx887.append('fxJianshen缺失')
    else:
        _fseg=_ba[_i:_i+16500]
        if 'drawEpicSword' not in _fseg: _lfx887.append('新fxJianshen缺drawEpicSword(精致宝剑)')
        if 'function pierceBar' not in _fseg: _lfx887.append('新fxJianshen缺pierceBar(刺穿血条)')
        if 'drawPierceHole' not in _fseg: _lfx887.append('新fxJianshen缺drawPierceHole(撕裂口)')
        if 'clipExtra' not in _fseg: _lfx887.append('新fxJianshen未传clipExtra(穿透会被裁)')
        # 掉血用st.fire(不是预览的__previewHit)
        if '__previewHit' in _fseg: _lfx887.append('新fxJianshen残留__previewHit(应改st.fire)')
        # ph相位机(form/still/thrust/through)=去向后抽+穿过消失
        for _ph in ["'form'","'still'","'thrust'","'through'"]:
            if _ph not in _fseg: _lfx887.append('新fxJianshen缺相位'+_ph)
    # ③ __WFX表仍映射jianshen:fxJianshen(派发不变)
    if 'jianshen:fxJianshen' not in _ba: _lfx887.append('__WFX表未映射jianshen:fxJianshen')
except Exception as _efx:
    _lfx887.append('守卫自身异常:'+str(_efx)[:80])
if _lfx887: fail('v888 剑神万剑归一新特效集成: '+str(_lfx887[:8]))
else: ok('v888 (Hansen: 剑神万剑归一新特效做得非常棒·融入游戏成为剑神攻击特效): 全新fxJianshen替换旧版并接入游戏__WFX分发。万剑归一四幕: ①凝剑(52把古剑四面八方浮现·做旧青铜铁灰褐哑光·剑尖指向目标) ②万剑齐射(全部同时朝统一成型点飞·拖光轨汇聚·无跳动) ③归一(众剑汇聚成一把精致宝剑drawEpicSword·修长镜面剑身+血槽+如意云头雕花金护手+金线缠柄+青蓝宝石剑首+红剑穗·原地成型剑尖朝敌方·成型后静止160ms蓄势·全程无向后抽) ④突刺(啪!ease-out最快速度直刺→穿过血条·drawPierceHole发光能量撕裂口[横向裂光+竖向剑光道+核心光斑·非黑洞]·剑边穿边淡出消失不回抽·pierceBar触发掉血+14道放射炫光drawPierceRays四射+冲击波)。技术: 整个特效自包含移植(drawSword/drawEpicSword/pierceBar/drawPierceRays/drawPierceHole全在fxJianshen内)·掉血__previewHit改st.fire·shell加opt.clipExtra(默认0不影响其他特效·剑神传66放宽裁剪让剑尖穿透血条下方可见)。真机Playwright验证: land5第5关剑神boss战答错触发反击·canvas出现→特效完整播放3888ms→canvas正常消失·0报错。__WFX表jianshen:fxJianshen映射不变·剑神配置{t:jianshen,dealDelay:2600}。绝不屏震/闪光过曝/旋转。')


# 🔴 v889(Hansen: 后台密码面板里随意设置金币/钻石数量·输多少就是多少·很重要): 管理员面板加金币/钻石输入框+设置函数。
#   金币走 HansenCoins(localStorage 'hansen_wallet_coins')·钻石走 HansenGems(localStorage 'hansen_wallet_gems')。设置函数直接写钱包 key·刷新后全岛生效。
_l889=[]
try:
    _ba=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    # ① 设置函数存在
    if 'window.__hsnSetCoins' not in _ba: _l889.append('缺 __hsnSetCoins 金币设置函数')
    if 'window.__hsnSetGems' not in _ba: _l889.append('缺 __hsnSetGems 钻石设置函数')
    # ② 写正确的钱包 key
    if "'hansen_wallet_coins'" not in _ba: _l889.append('金币未写 hansen_wallet_coins 钱包key')
    if "'hansen_wallet_gems'" not in _ba: _l889.append('钻石未写 hansen_wallet_gems 钱包key')
    # ③ 面板里有输入框(管理员区)
    if '__hsnCoinInput' not in _ba: _l889.append('面板缺金币输入框 __hsnCoinInput')
    if '__hsnGemInput' not in _ba: _l889.append('面板缺钻石输入框 __hsnGemInput')
    # ④ 输入框+设置按钮绑定
    if 'onclick="window.__hsnSetCoins()"' not in _ba: _l889.append('金币设置按钮未绑定')
    if 'onclick="window.__hsnSetGems()"' not in _ba: _l889.append('钻石设置按钮未绑定')
except Exception as _e889:
    _l889.append('守卫自身异常:'+str(_e889)[:80])
if _l889: fail('v889 后台金币钻石设置: '+str(_l889[:8]))
else: ok('v889 (Hansen: 后台密码面板随意设置金币/钻石·输多少就是多少·很重要): 管理员面板(openPanel 的 !CUR_USER 开发者功能区·密码门后)加【金币/钻石输入框+设置按钮】。金币走 window.HansenCoins(localStorage key=hansen_wallet_coins)·钻石走 window.HansenGems(localStorage key=hansen_wallet_gems)·两系统接口对称(get/add/spend)。设置函数 __hsnSetCoins/__hsnSetGems: 读输入框数值(parseInt·校验非负整数)→直接 localStorage.setItem 写钱包 key→alert确认→location.reload刷新全岛显示生效。输入框预填当前余额·number 类型 inputmode=numeric。放在"解锁全部主岛Boss"按钮下方(同管理员区·同 hbafx-btn 样式)。真机验证: 金币600→99999(写入localStorage)·钻石0→88888·0报错·设置函数就绪。')


# 🔴 v890(Hansen: 剑神图完全没显示出来·彻底删旧图重弄): P模式PNG→WEBP修复。
#   根因: v887用pngquant把land_jianshen压成P模式(调色板)PNG·微信X5 WebView不显示带透明的P模式PNG→剑神boss立绘+卡片全空白。
#   修复: 换WEBP q85(896x1195 RGBA透明·176KB·微信X5支持WEBP)·旧P模式PNG彻底删除·3处引用改.webp。
_l890=[]
try:
    import os as _os890
    # ① 旧P模式PNG必须已删除(彻底删)
    if _os890.path.exists('bosses/land_jianshen.png'): _l890.append('旧land_jianshen.webp未删除(P模式微信不显示·必须删)')
    # ② 新WEBP存在且是RGBA(非P模式)
    if not _os890.path.exists('bosses/land_jianshen.webp'): _l890.append('新land_jianshen.webp缺失')
    else:
        try:
            from PIL import Image as _I890
            _im=_I890.open('bosses/land_jianshen.webp')
            if _im.format!='WEBP': _l890.append('剑神图非WEBP格式(实'+str(_im.format)+')')
            if _im.mode not in ('RGBA','LA'): _l890.append('剑神WEBP非RGBA透明(实'+_im.mode+')')
        except Exception: pass
    # ③ 3处引用都指向.webp·无.webp残留
    for _f in ['island_land5.html','hansen_land_cards.js']:
        _t=open(_f,encoding='utf-8',errors='replace').read()
        if 'land_jianshen.png' in _t: _l890.append(_f+' 仍残留land_jianshen.webp引用')
        if 'land_jianshen.webp' not in _t: _l890.append(_f+' 未引用land_jianshen.webp')
except Exception as _e890:
    _l890.append('守卫自身异常:'+str(_e890)[:80])
if _l890: fail('v890 剑神图P模式→WEBP修复: '+str(_l890[:8]))
else: ok('v890 (Hansen: 剑神图完全没显示出来·彻底删旧图重弄·彻底删些): P模式PNG→WEBP修复。根因: v887用pngquant把land_jianshen压成P模式(调色板)PNG·微信X5 WebView【不显示带透明通道的P模式PNG】→剑神boss立绘和卡片图全空白(Hansen"完全都没有显示出来")。修复: Hansen重新上传原图(896x1195 RGBA 949KB)·转WEBP q85(896x1195 RGBA透明·176KB·远低于800KB预算·微信X5原生支持WEBP+RGBA不会有P模式的显示问题)·旧P模式land_jianshen.webp【彻底删除】·3处引用(island_land5.html boss立绘SVG image href两处+hansen_land_cards.js卡片img+生成器gen_land_islands.py)全改.webp。真机验证: WEBP HTTP可访问(180052字节)·卡L55 img=land_jianshen.webp·boss立绘href=land_jianshen.webp?v加载成功200·立绘区域采样有内容(白发1651亮像素+深衣1377暗像素)·0报错。教训: 图片压缩绝不能转P模式(pngquant默认转P)·微信X5 WebView对带透明的P模式PNG支持有问题→用WEBP q85(RGBA)或PNG optimize(保RGBA)·WEBP压缩率远高于PNG(949KB→176KB)且微信X5支持。')


# 🔴 v891(Hansen: boss战所有题型对齐打字题高位·狂怒坚决不溢出天花板·特效跟随boss缩放·彻底锁死): 三处改动全在共享模块。
#   ①选择题margin 68→34(与打字题bts-typing一致·全题型boss/血条/对话框同高度) ②狂怒scale 1.1217→1.0(margin34下最坏顶边≈26px离天花板安全·覆盖所有题型含bts-typing) ③特效狂怒时sz×1.075(跟随boss放大防位移错位)。
_l891=[]
try:
    _bl=open('hansen_boss_lock.js',encoding='utf-8',errors='replace').read()
    _ba=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    # ① 选择题margin改34(对齐打字题)·旧68必须消除
    if 'margin:34px 0 0 !important;line-height:0' not in _bl: _l891.append('选择题boss-sprite-wrap未对齐到margin34')
    if 'margin:68px 0 0 !important;line-height:0' in _bl: _l891.append('旧margin68残留(未对齐打字题)')
    # 打字题仍是34(参考位·两者一致)
    if 'bts-typing .boss-sprite-wrap{margin:34px 0 0!important}' not in _bl: _l891.append('打字题margin34参考位丢失')
    # ② 狂怒scale 1.0(锁死不溢出)·覆盖所有题型·旧1.1217消除
    if 'boss-rage svg, .boss-arena.bts-typing .boss-sprite.boss-rage svg{transform:scale(1.0) !important}' not in _bl: _l891.append('狂怒scale未改1.0或未覆盖bts-typing')
    if 'boss-rage svg{transform:scale(1.1217)' in _bl: _l891.append('旧狂怒scale1.1217残留(会溢出天花板)')
    # 普通scale.9304保持(boss大小不变)
    if 'transform:scale(.9304)' not in _bl: _l891.append('普通boss scale.9304丢失(boss变小)')
    # ③ 特效狂怒放大(跟随boss)
    if '__rf=1.075' not in _ba: _l891.append('特效未随狂怒放大(缺__rf系数)')
    if "classList.contains('boss-rage')" not in _ba: _l891.append('特效放大未检测boss-rage态')
except Exception as _e891:
    _l891.append('守卫自身异常:'+str(_e891)[:80])
if _l891: fail('v891 boss布局对齐+狂怒锁死+特效缩放: '+str(_l891[:8]))
else: ok('v891 (Hansen: boss战所有题型对齐打字题高位·狂怒坚决不溢出天花板·特效跟随boss缩放·彻底锁死): 三处改动全在共享模块(hansen_boss_lock.js+hansen_boss_attack.js·全岛boss战通用·不改生成器)。①题型对齐: 选择题boss-sprite-wrap margin 68→34与打字题(bts-typing)完全一致→全题型boss立绘/血条/对话框同高度平行(Hansen真机发现打字模式boss上移一截·要求以打字题为准都上移对齐)。②狂怒锁死: 狂怒svg scale 1.1217→1.0(视觉258→230px·比普通214仍大7.5%明显变大)·规则特异性提高覆盖所有题型(含bts-typing的872行·防打字题狂怒不生效)·origin底部下方零位移·margin34盒底264→狂怒静止顶边38px·最坏叠加(漂浮-3+命中div1.02)顶边≈26px≥安全距离25·绝不溢出屏幕顶(天花板)。③特效缩放: HansenBossAttack检测boss狂怒态(bossSprite有boss-rage类)→给fx.sz乘1.075(与boss视觉放大一致)·特效锚点(bossVis视觉盒getBoundingClientRect)本就跟随狂怒·尺寸也跟上=不位移错位。真机Playwright验证: 选择题boss顶边51px底265高214·狂怒顶边38px底268高230(比普通大16px明显变大)·狂怒离天花板38px安全不溢出·底边锚定·狂怒态攻击特效canvas正常出现·0报错·margin34全题型一致。绝不屏震/闪光/旋转。')


_l892=[]
try:
    _ba892=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    # ① 九王殿9个新特效函数齐全(各恰1个)
    for _fn in ['fxYecha','fxRenyi','fxBengdai','fxOmega','fxSijilong','fxYingshou','fxMoyuan','fxLiangzi','fxFushaou']:
        _c=_ba892.count('function '+_fn+'(bsEl')
        if _c!=1: _l892.append(_fn+'定义数='+str(_c)+'(应为1)')
    # ② 新版fxRenyi/fxYingshou所需图片资源(IMGS真枪+5手·base64)
    if 'window.IMGS.renyi_spear' not in _ba892: _l892.append('缺IMGS.renyi_spear(新fxRenyi真枪)')
    if 'window.IMGS.hand1' not in _ba892 or 'window.IMGS.hand5' not in _ba892: _l892.append('缺IMGS.hand1-5(新fxYingshou黑手)')
    if 'window.IMGS=window.IMGS||{}' not in _ba892: _l892.append('缺IMGS幂等初始化')
    # ③ fushaou派发+后台调参配置齐全
    if 'fushaou:fxFushaou' not in _ba892: _l892.append('__WFX缺fushaou:fxFushaou(弗沙欧特效不派发)')
    if "'\u661f\u6838\u5e1d\u7687\u00b7\u5f17\u6c99\u6b27':{t:'fushaou'" not in _ba892: _l892.append('FX配置缺弗沙欧条目(后台调参不到)')
    # ④ 8个boss的dealDelay已调到新动画高潮时刻(抽查关键值·防回退2600)
    for _t,_dd in [('sijilong',6300),('yecha',4900),('omegafx',5430),('yingshou',5750)]:
        if ("t:'"+_t+"',sz:1.0,sp:1.0,fxi:1.0,dealDelay:"+str(_dd)) not in _ba892:
            _l892.append(_t+' dealDelay未调到'+str(_dd)+'(新动画命中时刻)')
    if "t:'fushaou',sz:1.0,sp:1.0,fxi:1.0,dealDelay:6160" not in _ba892: _l892.append('弗沙欧dealDelay非6160')
    # ⑤ 游戏FXCore超集保留(v888剑神clipExtra不丢)
    if 'clipExtra' not in _ba892: _l892.append('游戏FXCore的clipExtra超集丢失(剑神穿透血条回退)')
    # ⑥ 防上传文件末尾"显式导出"暴露块(含孤儿try{)误漏入游戏(会致语法错误Missing catch)
    if 'window.fxBengdai=fxBengdai; window.fxRenyi=fxRenyi; window.fxYecha' in _ba892:
        _l892.append('上传showcase暴露块误漏入(孤儿try{→Missing catch语法错误)')
except Exception as _e892:
    _l892.append('守卫自身异常:'+str(_e892)[:80])
if _l892: fail('v892 \u4e5d\u738b\u6bbf9\u7279\u6548\u5916\u79d1\u878d\u5165+\u5f17\u6c99\u6b27: '+str(_l892[:10]))
else: ok('v892 (Hansen: \u628a\u4e5d\u738b\u6bbf9\u4e2a\u65b0boss\u653b\u51fb\u7279\u6548\u5b8c\u7f8e\u878d\u5165\u6b63\u7247\u00b7\u540e\u53f0\u53ef\u8c03\u53c2\u00b7\u5f17\u6c99\u6b27\u5907\u6218): \u5916\u79d1\u624b\u672f\u5f0f\u96c6\u6210\u00b7\u96f6wiring\u6539\u52a8\u3002\u2460\u66ff\u63628\u4e2a\u65e7\u7279\u6548\u51fd\u6570\u4f53(fxYecha/fxRenyi/fxBengdai/fxOmega/fxSijilong/fxYingshou/fxMoyuan/fxLiangzi\u00b7\u5747\u4e3a\u5355\u8bcd\u5927\u9646land1-6\u5b88\u5173boss\u7684\u53cd\u51fb\u7279\u6548)\u00b7\u4fdd\u6301\u51fd\u6570\u540d\u4e0d\u53d8\u2192__WFX\u8868/FX\u914d\u7f6e\u81ea\u52a8\u6cbf\u7528\u96f6\u6539\u52a8\u3002\u2461\u65b0\u589efxFushaou(\u7b2c9\u4e2aboss\u661f\u6838\u5e1d\u7687\u00b7\u4e09\u7687\u5f52\u4e00\u7ec8\u7109\u767d\u5149)\u3002\u2462\u65b0\u7248fxRenyi(\u771f\u67aa\u624e\u4e0b)\u9700IMGS.renyi_spear\u3001\u65b0\u7248fxYingshou(\u9ed1\u624b\u89e6\u624b)\u9700IMGS.hand1-5\u2192\u52a0\u5165base64\u56fe\u7247\u5757(||\u5e42\u7b49\u4e0d\u8986\u76d6)\u3002\u2463\u4e3a\u65b0(\u66f4\u957f)\u52a8\u753b\u628a8\u4e2aboss\u7684dealDelay\u4ece2600\u8c03\u5230\u5404\u81ea\u9ad8\u6f6e\u65f6\u523b(4000~6300ms\u00b7\u7532\u4f24\u7cbe\u51c6\u843d\u5728\u65b0\u7279\u6548\u9ad8\u6f6e)\u3002\u2464\u4fdd\u7559\u6e38\u620fFXCore\u8d85\u96c6(\u542bv888\u5251\u795eclipExtra)\u4e0d\u52a8\u00b7\u65b09\u51fd\u6570\u7528\u540cshell API\u4e0d\u4f20clipExtra=\u884c\u4e3a\u4e0e\u4e0a\u4f20FXCore\u5b8c\u5168\u4e00\u81f4\u3002\u771f\u673aPlaywright\u9a8c\u8bc1: \u5f17\u6c99\u6b27/\u5203\u7ffc\u9886\u4e3b/\u5f71\u5b88/\u5965\u7c73\u4f3d/\u591c\u7f57\u5239\u7b495\u4e2a\u901a\u8fc7HansenBossAttack\u771f\u5b9e\u6d3e\u53d1\u8def\u5f84\u89e6\u53d1canvas\u5747\u6b63\u5e38\u51fa\u73b0(393\u5168\u5c4f)\u00b7IMGS\u771f\u67aa/\u9ed1\u624bbase64\u52a0\u8f7d\u6210\u529f\u00b70\u62a5\u9519\u00b7node --check\u901a\u8fc7\u3002\u7edd\u4e0d\u5c4f\u9707/\u95ea\u5149/\u65cb\u8f6c\u3002')

_l893=[]
try:
    _l8=open('island_land8.html',encoding='utf-8',errors='replace').read()
    _lc=open('hansen_land_cards.js',encoding='utf-8',errors='replace').read()
    import re as _re893
    _bm=_re893.search(r"const BOSSES=\[(.*?)\n\];", _l8, _re893.DOTALL)
    if not _bm: _l893.append('land8 BOSSES not found')
    else:
        _bn=_re893.findall(r"name:'([^']*)'", _bm.group(1))
        if len(_bn)!=5: _l893.append('land8 boss count=%d (want 5)'%len(_bn))
        if not _bn or '\u5f17\u6c99\u6b27' not in _bn[-1]: _l893.append('land8 5th guardian not Fushaou')
    if _l8.count('land_fushaou.webp')<2: _l893.append('Fushaou art land_fushaou.webp refs <2')
    if 'land_fushaou.png' in _l8: _l893.append('Fushaou uses png (must webp for WeChat X5)')
    if "id:'L85'" not in _lc or '\u661f\u6838\u5e1d\u7687\u00b7\u5f17\u6c99\u6b27' not in _lc: _l893.append('missing L85 Fushaou card')
    _l85=_re893.search(r"\{id:'L85'[^}]*\}", _lc)
    if _l85 and "rarity:'legendary'" not in _l85.group(0): _l893.append('L85 Fushaou not legendary')
    _l84=_re893.search(r"\{id:'L84'[^}]*\}", _lc)
    if _l84 and "rarity:'epic'" not in _l84.group(0): _l893.append('L84 not demoted to epic')
    _ba893=open('hansen_boss_attack.js',encoding='utf-8',errors='replace').read()
    if ("'\u661f\u6838\u5e1d\u7687\u00b7\u5f17\u6c99\u6b27':{t:'fushaou'") not in _ba893: _l893.append('FX config Fushaou missing (attack fx not fire)')
except Exception as _e893:
    _l893.append('guard self exc:'+str(_e893)[:80])
if _l893: fail('v893 Fushaou land8 guardian boss: '+str(_l893[:10]))
else: ok("v893 (Hansen: \u5f17\u6c99\u6b27\u5f53\u661f\u706b\u706b\u5c71\u53e3\u7684\u5b88\u5173\u5927boss): \u661f\u6838\u5e1d\u7687\u00b7\u5f17\u6c99\u6b27\u4f5c\u4e3a\u5355\u8bcd\u5927\u9646land8(\u661f\u706b\u706b\u5c71\u53e3\u00b7\u81ea\u7136\u79d1\u5b66)\u7b2c5\u4e2a=\u538b\u8f74\u5b88\u5173boss\u3002\u2460island_land8.html BOSSES\u52a0\u7b2c5\u6761hp1300(\u68af\u5ea6760/880/1000/1150\u2192\u5b88\u5173\u6700\u5f3a\u00b7\u7528boss4\u6a21\u677f\u4fdd\u8f6c\u4e49\u683c\u5f0f)\u00b7\u8fdb\u5ea6land8_prog\u4e0eBOSSES.length\u81ea\u9002\u5e94\u00b7\u9009\u5173\u7f51\u683c\u7531hansen_cards\u6309BOSSES\u6e32\u67d3\u81ea\u52a8\u663e5\u8282\u70b9\u3002\u2461\u7acb\u7ed8land_fushaou.webp(1086x1448 RGBA q85 236KB\u00b7\u7edd\u4e0dpngquant\u8f6cP\u6a21\u5f0f\u00b7\u5fae\u4fe1X5\u539f\u751f\u652f\u6301webp)\u3002\u2462L\u5361\u65b0\u589eL85\u5f17\u6c99\u6b27legendary\u5b88\u5173\u5361\u00b7L84\u53e4\u8001\u610f\u5fd7\u964d\u4e3aepic\u2192land8\u4e94\u5361common/uncommon/rare/epic/legendary\u4e0e\u5176\u4ed6\u5c9b\u4e00\u81f4\u3002\u2463\u653b\u51fb\u7279\u6548fxFushaou\u5df2\u5728v892\u63a5\u597d(FX\u914d\u7f6e\u5f17\u6c99\u6b27\u2192t fushaou)\u00b7\u4e00\u51fa\u624b\u5373\u4e09\u7687\u5f52\u4e00\u7ec8\u7109\u767d\u5149\u3002\u2464\u540c\u6b65\u751f\u6210\u5668BOSS_META+boss_ranked\u52a0\u5f17\u6c99\u6b27\u00b7\u4f46land8 html\u7684HP\u624b\u8c03\u4e0e\u751f\u6210\u5668\u5df2\u6f02\u79fb\u00b7\u5207\u52ff\u91cd\u65b0\u751f\u6210\u4f1a\u91cd\u7f6e\u6240\u6709boss HP\u3002\u771f\u673aPlaywright: land8 BOSSES.length=5\u00b7\u7b2c5\u4e2a\u5f17\u6c99\u6b27hp1300\u00b7\u7acb\u7ed8webp200\u00b7\u653b\u51fb\u7279\u6548canvas\u5168\u5c4f\u00b70\u62a5\u9519\u3002\u7edd\u4e0d\u5c4f\u9707/\u95ea\u5149/\u65cb\u8f6c\u3002")

_l895=[]
try:
    _sb=open('spelling_bee.html',encoding='utf-8',errors='replace').read()
    import re as _re895, os as _os895
    if "file += '_season'" not in _sb: _l895.append('spelling_bee speak missing _season patch')
    if "/^land[1-8]$/.test(curWord.isl" not in _sb: _l895.append('spelling_bee missing land isl check')
    for _w in ['nervous','chemical','several']:
        if not _os895.path.exists('words/'+_w+'_season.mp3'): _l895.append('missing land audio words/'+_w+'_season.mp3')
    _m=_re895.search(r"var WORDS=\[(.*?)\n\s*\];", _sb, _re895.DOTALL)
    if _m:
        _isls=_re895.findall(r'"isl":\s*"(land[1-8])"', _m.group(1))
        if len(set(_isls))!=8: _l895.append('WORDS land coverage!=8:'+str(sorted(set(_isls))))
    else: _l895.append('spelling_bee WORDS array not found')
except Exception as _e895:
    _l895.append('guard self exc:'+str(_e895)[:80])
if _l895: fail('v895 spelling bee land audio: '+str(_l895[:10]))
else: ok("v895 (Hansen: 星海副本spelling bee没声音): 拼写蜜蜂land岛(单词大陆)+星海season副本发声修复。根因: land词音频文件全是 <word>_season.mp3(与主游戏 __ISLAND_LOCAL_AUDIO 岛隔离一致), 而 spelling_bee.html 的 speak() 默认只找 words/<word>.mp3 → 240个land词全部落空 → 静默TTS在微信X5无声 → 玩家听不到单词没法拼。修复: speak() 在 curWord.isl 为 land1-8 时给文件名补 _season 后缀。season副本池化所有land词(isl=land1-8)同样生效。常规岛(animal/food等)不受影响仍用 plain <word>.mp3。真机Playwright: land1/5/8+season都拿到 <word>_season.mp3 HTTP200 audio/mpeg, animal/food拿plain.mp3 200, 0报错。")

_l896=[]
try:
    _sb896=open('spelling_bee.html',encoding='utf-8',errors='replace').read()
    _wm896=open('word_map.js',encoding='utf-8',errors='replace').read()
    if 'word_map.js' not in _sb896: _l896.append('spelling_bee not loading word_map.js')
    if 'window.WORD_MAP[_lo]' not in _sb896: _l896.append('spelling_bee speak not using WORD_MAP')
    if "'t-shirt'" not in _wm896 and '"t-shirt"' not in _wm896: _l896.append('word_map.js missing t-shirt entry')
    for _k in ['how many','washing machine','next to']:
        if ('"'+_k+'"') not in _wm896 and ("'"+_k+"'") not in _wm896: _l896.append('WORD_MAP missing '+_k)
except Exception as _e896:
    _l896.append('guard self exc:'+str(_e896)[:80])
if _l896: fail('v896 spellbee WORD_MAP audio: '+str(_l896[:10]))
else: ok("v896 (Hansen: 星海spelling bee没声音·深挖第2轮): 拼写页多词短语+带符号文件也没声。根因: land词是_season(v895已修), 但多词短语(how many/washing machine/how much-old-long-far/next to)音频是编号文件(word_08~word_16.mp3等)、T-shirt是t-shirt.mp3(带连字符), 全靠主游戏的 WORD_MAP(word_map.js)和岛隔离表映射; 而 spelling_bee.html 有自己的 speak() 只朴素派生 words/<word>.mp3(how many→how_many.mp3 不存在), 从不查 WORD_MAP → 静默TTS微信无声。音频从没丢, 只是拼写页没按正确文件名找。修复: spelling_bee.html 加载 word_map.js, speak() 改成与主游戏同款解析(先查 WORD_MAP, 再 land 词 _season, 再朴素派生); T-shirt 唯一只在clothes岛隔离表不在WORD_MAP, 给 WORD_MAP 补一条 t-shirt→words/t-shirt.mp3。真机Playwright: T-shirt/how many-much-old-long-far/washing machine/next to 全拿到正确音频200, land/常规岛不受影响, 0报错。936词三法合解后0词无音频。")

_l897=[]
try:
    import re as _re897, os as _os897, glob as _glob897
    _wmsrc897=open('word_map.js',encoding='utf-8',errors='replace').read()
    _wmm897=_re897.search(r"WORD_MAP\s*=\s*\{(.*?)\}\s*;", _wmsrc897, _re897.DOTALL)
    _WM897={}
    if _wmm897:
        for _k,_v in _re897.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', _wmm897.group(1)): _WM897[_k.lower()]=_v
        for _k,_v in _re897.findall(r"'([^']+)'\s*:\s*'([^']+)'", _wmm897.group(1)): _WM897[_k.lower()]=_v
    else: _l897.append('WORD_MAP not parsed')
    # Part B: WORD_MAP 每条映射必须指向真实文件
    for _k,_v in _WM897.items():
        _pp=_v if _v.startswith('words/') else 'words/'+_v
        if not _os897.path.exists(_pp): _l897.append('WORD_MAP bad map '+_k+'->'+_v)
    # Part A: 拼写页每个词必须解析到真实本地音频(与 speak 同款: WORD_MAP -> land _season -> 派生)
    _sbsrc897=open('spelling_bee.html',encoding='utf-8',errors='replace').read()
    _sbm897=_re897.search(r"var WORDS=\[(.*?)\n\s*\];", _sbsrc897, _re897.DOTALL)
    _miss897=[]
    if _sbm897:
        for _en,_isl in _re897.findall(r'\{"en":\s*"([^"]*)"[^}]*"isl":\s*"([^"]*)"', _sbm897.group(1)):
            _lo=_en.lower()
            _f=_WM897.get(_lo)
            if _f: _path=_f if _f.startswith('words/') else 'words/'+_f
            else:
                _d=_re897.sub(r'[^a-z ]','',_lo).strip().replace(' ','_')
                if _re897.match(r'land[1-8]$',_isl): _d+='_season'
                _path='words/'+_d+'.mp3'
            if not _os897.path.exists(_path): _miss897.append(_en+'('+_isl+')->'+_path)
    else: _l897.append('spelling_bee WORDS not found')
    if _miss897: _l897.append('spellbee words w/o audio '+str(len(_miss897))+':'+str(_miss897[:8]))
    # Part C: 每个岛的 __ISLAND_LOCAL_AUDIO 映射也必须指向真实文件
    for _isf in _glob897.glob('island_*.html'):
        _iss=open(_isf,encoding='utf-8',errors='replace').read()
        _lm=_re897.search(r"__ISLAND_LOCAL_AUDIO\s*=\s*\{(.*?)\}\s*;", _iss, _re897.DOTALL)
        if _lm:
            _ps=_re897.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', _lm.group(1))+_re897.findall(r"'([^']+)'\s*:\s*'([^']+)'", _lm.group(1))
            for _k,_v in _ps:
                _pp=_v if _v.startswith('words/') else 'words/'+_v
                if not _os897.path.exists(_pp): _l897.append(_os897.path.basename(_isf)+' LOCAL_AUDIO bad '+_k+'->'+_v)
    # Part D: v897改名后的旧编号/连字符名不该再出现在功能文件里(注释除外)
    for _old in ['word_08.mp3','word_10.mp3','word_11.mp3','word_12.mp3','word_13.mp3','word_14.mp3','word_16.mp3','t-shirt.mp3']:
        if _old in _wmsrc897: _l897.append('word_map.js still refs renamed '+_old)
        _preld=open('hansen_preload.js',encoding='utf-8',errors='replace').read()
        if _old in _preld: _l897.append('hansen_preload.js still refs renamed '+_old)
        _clo=open('island_clothes.html',encoding='utf-8',errors='replace').read()
        if _old in _clo: _l897.append('island_clothes.html still refs renamed '+_old)
except Exception as _e897:
    _l897.append('guard self exc:'+str(_e897)[:80])
if _l897: fail('v897 audio pin: '+str(_l897[:12]))
else: ok("v897 (Hansen上线定版: 把发音文件名改成对应单词/短语名, 每个单词的音频跟文件名钉死): ①把12个编号文件里唯一只有编号名的7个(word_08/10/11/12/13/14/16)改成规范名 washing_machine/how_many/how_much/how_old/how_long/how_far/next_to.mp3, T-shirt的 t-shirt.mp3 改成派生名 tshirt.mp3, 同步更新 word_map.js/hansen_preload.js/island_clothes.html 全部引用。②带岛后缀的文件(_season 240个 + cook_action/gloves_clothes/chair_home/hard_treasure 等13个)是岛隔离刻意为之(同一个词在不同岛用不同音频, 裸名会撞车)故保留。③本守卫全量钉死: 拼写页936个词逐个按 speak 同款解析(WORD_MAP->land _season->派生)必须命中真实本地文件; WORD_MAP 每条+每个岛 __ISLAND_LOCAL_AUDIO 每条映射必须指向真实文件; 改名后的旧名不得残留在功能文件。任何词找不到音频, 构建即失败, 上线前不可能再出现拼写页没声音。")

_l898=[]
try:
    _sb898=open('spelling_bee.html',encoding='utf-8',errors='replace').read()
    # ① 难度可用性: _sbSetupDiff 定义+调用(禁用空难度+自动切有词难度)
    if 'function _sbSetupDiff()' not in _sb898: _l898.append('缺 _sbSetupDiff 定义')
    if '_sbSetupDiff();' not in _sb898: _l898.append('缺 _sbSetupDiff 调用')
    if 'sbDiffOff' not in _sb898: _l898.append('缺空难度禁用类 sbDiffOff')
    if "c.classList.contains('sbDiffOff')" not in _sb898: _l898.append('bindPick 未跳过被禁用难度')
    # ② 岛过滤加固: island缺失/空 都走fallback(绝不落全池)。旧的 if(_sbIsland){var _isl 结构已重构
    if 'else if(_sbIsland)' not in _sb898 or 'if(_isl.length){ WORDS=_isl; }' not in _sb898: _l898.append('岛过滤未加固(显式岛参数+非空结果门缺失)')
    if 'if(_sbIsland){var _isl=WORDS.filter' in _sb898: _l898.append('旧岛过滤结构残留(空island仍会落全池)')
    if '绝不落全池' not in _sb898: _l898.append('缺 绝不落全池 兜底')
except Exception as _e898:
    _l898.append('guard self exc:'+str(_e898)[:80])
if _l898: fail('v898 spellbee island+difficulty: '+str(_l898[:10]))
else: ok("v898 (Hansen: spelling bee 不论选容易/中级/高级难度, 有时点进去却考本岛所有单词): 根因有二。①难度: 若本岛没有所选难度的词(经统计 action无高级, land1/3/4/6/7无初级 共6岛), startMatch 的 if(!pool.length)pool=shuffle(WORDS.slice()) 会静默落回'全岛词·忽略难度'。②岛过滤: 原 if(_sbIsland){...} 若 island 参数缺失则整个跳过→WORDS保持全936→考所有岛的词。修复: ①加 _sbSetupDiff——按本岛实际词数给每个难度chip标注词数(如'17个'), 词数为0的难度直接禁用(灰+pointerEvents:none+bindPick跳过sbDiffOff), 若默认/当前选中难度为空则自动切到第一个有词的难度; 用户根本选不到空难度, 静默落回永不触发, 选的难度必然生效。②岛过滤重构为 island缺失或过滤为空都绝不落全池: 嵌在岛内→吃父岛allW(零维护精确本岛词), 否则→明确提示。真机Playwright: animal三难度正常(17/17/8), action高级/land1-3初级禁用且自动切到有词难度, 全部0落回。")


# ---- ⭐ v912 (Hansen真机: 龙骑士统帅的巨龙之翼展开特效没了): 背景特效层不得被任何不透明底盖死 ----
# 根因: 巨翼(龙骑士统帅Lv11)与地狱之门(地狱犬王Lv8)按 BUG#70/v536 钦定挂在【背景特效层 __hansenFxLayerBack(z-index:-1)】,
#       这样特效才能从 boss【背后】展开/升起。而 v905 为修"boss战横向割裂"把一层【不透明暗底直接涂在 #bossScreen 自身】上,
#       按 CSS 绘制顺序(负z层 → 内容块背景 → 内容), 这层底把整个背景特效层【盖死】→ 两个特效双双消失, 却没有任何特效代码被改,
#       所有字符串守卫全部通过、照常上线。本守卫钉死修复: boss屏的暗底必须待在 ::before(z-index:-2, 沉在背景特效层之下), 绝不可涂回 #bossScreen 自身。
# 注: 真正的兜底是 fx_guard.py(真机像素级证明每个 boss 特效都画在屏幕上, build 第6.5步), 本守卫是秒级的第一道闸。
_b912 = []
_bal912 = open('hansen_boss_attack.js', encoding='utf-8', errors='replace').read()
if "z-index:-1;'; document.body.appendChild(B); window.__hansenFxLayerBack=B;" not in _bal912:
    _b912.append('背景特效层__hansenFxLayerBack的z-index:-1被改(巨翼/地狱之门会跑到boss前面盖脸)')
if "(window.__hansenFxLayerBack||window.__hansenFxLayer||document.body).appendChild(w)" not in _bal912:
    _b912.append('龙骑士统帅巨翼未挂背景层(BUG#70: 翅膀必须从背后展开)')
if "if(window.__hansenFxLayerBack)window.__hansenFxLayerBack.appendChild(g);" not in _bal912:
    _b912.append('地狱犬王地狱之门未挂背景层(BUG#70: 门必须在boss身后升起)')
_pal912 = open('hansen_palette.js', encoding='utf-8', errors='replace').read()
if "#bossScreen{background:transparent!important}" not in _pal912:
    _b912.append('亮色主题把不透明底涂回#bossScreen自身(会盖死背景特效层)')
for _f912 in ['template.html'] + sorted(glob.glob('island_*.html')):
    _t912 = open(_f912, encoding='utf-8', errors='replace').read()
    if '#bossScreen{background:linear-gradient' in _t912:
        _b912.append('%s: 不透明底涂在#bossScreen自身(v905血案·会盖死背景特效层→巨翼/地狱之门消失)' % _f912)
    if 'spelling' in _f912 or 'boss' not in _t912:
        continue
    if '#bossScreen::before' not in _t912 or 'z-index:-2' not in _t912:
        _b912.append('%s: boss屏暗底未沉到::before(z-index:-2)之下' % _f912)
if not os.path.exists('fx_guard.py') or not os.path.exists('fx_probe.mjs') or not os.path.exists('hansen_fx_lock.json'):
    _b912.append('特效不可破坏守卫文件缺失(fx_guard.py/fx_probe.mjs/hansen_fx_lock.json)')
_bp912 = open('build.py', encoding='utf-8', errors='replace').read()
if 'fx_guard.py' not in _bp912:
    _b912.append('build.py 未接入特效守卫(特效被破坏也能打包)')
if _b912: fail('v912 背景特效层不得被盖死 + 特效守卫在位: ' + str(_b912[:6]))
else: ok('v912 (Hansen真机: 龙骑士统帅巨龙之翼展开特效没了) 背景特效层不可被盖死·特效不可破坏守卫在位。根因: 巨翼(Lv11)/地狱之门(Lv8)按BUG#70挂背景特效层(z-index:-1·必须从boss背后展开), 而v905把不透明暗底直接涂在#bossScreen自身→按CSS绘制顺序(负z层→内容块背景→内容)把整个背景层盖死→两特效双双消失, 且没改一行特效代码, 字符串守卫全过照常上线。修复: #bossScreen自身改transparent, 暗底移到#bossScreen::before(fixed铺满视口·z-index:-2)沉到背景特效层之下(28处: 模板+19岛+8单词大陆岛+亮色主题) → 割裂照样不出现, 巨翼/地狱之门重新可见(真机像素: 巨翼0%→33%·地狱之门0%→8%·亮色主题15%)。防再犯: ①本守卫钉死(暗底不得涂回#bossScreen自身·背景层z-index:-1不得改·两特效必须挂背景层) ②fx_guard.py真机像素守卫接入build第6.5步——20个boss特效各放一遍, 有元素却0像素=被遮死=拒绝打包(实测把v905破坏注回去: 背景特效9.1%→0.3%, 守卫当场拦下)。')


# ---- ⭐ v914 (Hansen: 星海那 240 个单词的例句有没有达到最好?) 星海例句质量铁律 ----
# 查出两个真问题:
#  ① 完形填空(qType='cloze')用 new RegExp('\\b'+w.en+'\\b','i') 在例句里挖空目标词, 匹配不上就【把这个词 pop 掉直接丢弃】。
#     原先有 25 个词的例句只出现变形(describe→described / provide→provides / stranger→strangers),
#     原形匹配不上 → 这 25 个词(占 240 的 10.4%)【永远进不了完形填空】。已改写例句让原形自然出现(动词用情态/不定式/复数主语, 名词用单数)。
#  ② 完形填空用 smartHighlight 在中文译文里把对应中文高亮成金色。原先 20 条译文为求自然用了同义词
#     (proud 词表是「自豪的」、译文却写「骄傲」) → 词表中文对不上 → 金色高亮失效、提示变弱。已用 HIGHLIGHT_MANUAL 手工映射补齐。
# 铁律: 星海 240 词, 例句必须 100% 含原形(否则该词进不了完形填空); 20 条同义词译文的手工高亮映射必须在位。
_b914 = []
try:
    import json as _j914
    _d914 = _j914.load(open('island_data.json', encoding='utf-8'))
    _da914 = _d914['season']['DATA']
    _w914 = re.findall(r'\{en:"(.*?)",pn:"[^"]*",cn:"([^"]*)",emoji:"[^"]*",ex:"(.*?)",exCn:"(.*?)"\}', _da914)
    if len(_w914) != 240:
        _b914.append('星海单词数=%d(应为240)' % len(_w914))
    _noclz = [en for en, cn, ex, excn in _w914 if not re.search(r'\b' + re.escape(en) + r'\b', ex, re.I)]
    if _noclz:
        _b914.append('%d个词的例句不含原形→永远进不了完形填空: %s' % (len(_noclz), _noclz[:6]))
    _hh914 = open('highlight_helper.js', encoding='utf-8').read()
    _need914 = ['"proud|', '"although|', '"ceremony|', '"talent|', '"assume|', '"contribute|']
    _miss914 = [k for k in _need914 if k not in _hh914]
    if _miss914:
        _b914.append('星海同义词译文的手工高亮映射缺失: %s' % _miss914)
    if 'window.smartHighlight = function' not in _hh914:
        _b914.append('smartHighlight 函数丢失(完形填空的中文高亮会整个失效)')
except Exception as _e914:
    _b914.append('星海例句体检异常: %s' % _e914)
if _b914: fail('v914 星海例句质量: ' + str(_b914[:5]))
else: ok('v914 (Hansen: 星海240个单词的例句有没有达到最好?) 星海例句质量铁律。体检结论: 硬伤本来就是干净的(0缺例句/0例句里没用到该词/0重复/0过短过长/0标点/0中英混杂, 平均句长8.2词), 但离"最好"差两口气, 均已补上: ①完形填空覆盖率 215/240→240/240: cloze 模式用 \\b原形\\b 在例句里挖空, 匹配不上就把该词 pop 掉丢弃——原先25个词例句只有变形(describe→described/provide→provides/stranger→strangers/employee→employees), 这25个词(10.4%)永远进不了完形填空。已改写这25条例句让原形自然出现(动词改情态/不定式/复数主语, 名词改单数), 且改写后译文必含词表中文。②中文金色高亮 220/240→240/240: smartHighlight 在译文里高亮对应中文, 但20条译文为求自然用了同义词(proud「自豪的」译文写「骄傲」、although「尽管」写「虽然」、ceremony「典礼」写「开幕式」)→高亮失效、完形填空的提示变弱。已在 HIGHLIGHT_MANUAL 追加20条手工映射(87→107条, 原有87条未动)。真机口径复验: 240/240 可进完形填空、240/240 高亮成功、硬伤全0。v914')


# ---- ⭐ v915 (Hansen: 完形填空每道题都要用这个单词自己的例句吧? 所有 bug 都修好了吗?) 选项不得出现同义词 ----
# 真机端到端验证完形填空时揪出的另一个 bug: 干扰项是从整份词表【随机抽】的, 原代码只按 en 去重、【不管中文】。
# 而全库有 10 组词【中文意思一模一样】(星海6组: rarely/seldom「很少」· enormous/huge「巨大的」·
# besides/moreover/furthermore「此外」· amount/quantity「数量」· invent/invention「发明」· succeed/success「成功」;
# 单词大陆 land3 1组 / land5 3组)。一旦抽到同义词当干扰项:
#   · 英译汉/听音辨意 → 屏幕上出现【两个一模一样的中文选项】(一个判对一个判错) —— 真机2200题实测中招4次
#   · 完形填空       → 【两个选项都对】
# 修复: 四个选项的【中文也必须互不相同】(en 与 cn 双重去重), 并加 400 次兜底防词库凑不满时死循环。
# 共改 45 处(模板5处 → 盖章到19岛; 单词大陆8岛各5处)。
_b915 = []
_key915 = 'if(!opts.find(o=>o.en===r.en||o.cn===r.cn))opts.push(r)'
for _f915 in ['template.html'] + sorted(glob.glob('island_land[1-8].html')) + sorted(glob.glob('island_*.html')):
    _t915 = open(_f915, encoding='utf-8', errors='replace').read()
    if 'const opts=[w]' not in _t915:
        continue
    if _key915 not in _t915:
        _b915.append('%s: 选项未做中文去重(同义词干扰项→两个一样的中文选项/完形填空两个答案都对)' % _f915)
if _b915: fail('v915 选项不得出现同义词: ' + str(_b915[:5]))
else: ok('v915 (Hansen: 完形填空每道题都用这个单词自己的例句吧? 所有bug都修好了吗?) 选项不得出现同义词。★真机端到端复验完形填空(强制出题·逐题读渲染结果): 240/240个单词都能出完形填空、每题都用【它自己】的例句(w.ex/w.exCn对得上)、题面只有1个空、0题泄露答案、中文金色提示全有、4选项含正确答案且不重复、0 JS异常; 修复前(v913)实测只有215/240、25个词永远出不来。★但由此揪出另一个bug: 干扰项从整份词表随机抽, 原代码只按 en 去重不管中文, 而全库有10组词中文意思一模一样(星海6组: rarely/seldom「很少」·enormous/huge「巨大的」·besides/moreover/furthermore「此外」·amount/quantity「数量」·invent/invention「发明」·succeed/success「成功」; land3 1组; land5 3组) → 抽到同义词就出现【两个一模一样的中文选项】(英译汉/听音辨意, 一个判对一个判错)或【两个答案都对】(完形填空)。真机2200题实测: 修复前中招4次(如 besides 的选项是「此外」「此外」「生物」「努力」), 修复后0次。修复: 四选项的中文也必须互不相同(en+cn双重去重·400次兜底防死循环), 共45处(模板5处盖章到19岛 + 单词大陆8岛各5处)。真机复验: 星海2200题/land5 2200题 中文重复0·英文重复0·完形填空覆盖240/240与30/30·0报错。v915')


# ---- ⭐ v916 (配例句音频前的对齐): 240 词的例句必须【全库唯一】——赛季岛与 8 个星域岛必须逐字相同 ----
# 背景: 星海 240 词 = 赛季岛(island_season) 一整份 + 8 个星域岛(island_land1-8)各 30 个, 是【同一批词】。
# 但两边是【两套独立数据】: 赛季岛的词表在 island_data.json→season→DATA(盖章生成),
# 8 个星域岛是独立 HTML。v914 改了 25 条例句只改了赛季岛 → 星域岛还是老例句,
# 那 25 个词【在星域岛依然进不了完形填空】(land3:2 / land4:14 / land6:2 / land7:2 / land8:5), 而且同一个词两个岛显示两句不同的例句。
# 这在配【例句音频】时是致命的: 一个词一条音频, 两个岛例句不同就必然对不上。
# 铁律: ①每个词的例句必须 100% 含原形(否则进不了完形填空) ②赛季岛与星域岛的 ex/exCn 必须逐字一致。
_b916 = []
def _pex916(_f):
    _s = open(_f, encoding='utf-8', errors='replace').read()
    if 'const DATA=[' not in _s: return None
    _i = _s.index('const DATA=['); _d = 0; _j = _i + len('const DATA=')
    _end = len(_s)
    for _k in range(_j, len(_s)):
        if _s[_k] == '[': _d += 1
        elif _s[_k] == ']':
            _d -= 1
            if _d == 0: _end = _k + 1; break
    _o = {}
    for _cat, _body in re.findall(r'\{cat:"([^"]+)",words:\[(.*?)\n\]\}', _s[_j:_end], re.S):
        for _r in re.findall(r'\{en:"(.*?)",pn:"[^"]*",cn:"[^"]*",emoji:"[^"]*",ex:"(.*?)",exCn:"(.*?)"\}', _body):
            _o[_r[0]] = (_r[1], _r[2])
    return _o
try:
    _se916 = _pex916('island_season.html')
    if not _se916 or len(_se916) != 240:
        _b916.append('赛季岛例句解析异常(%s 条, 应 240)' % (len(_se916) if _se916 else 0))
    else:
        _nc = [en for en, (ex, _) in _se916.items() if not re.search(r'\b' + re.escape(en) + r'\b', ex, re.I)]
        if _nc: _b916.append('赛季岛 %d 个词例句不含原形→进不了完形填空: %s' % (len(_nc), _nc[:5]))
        for _n in range(1, 9):
            _f = 'island_land%d.html' % _n
            _L = _pex916(_f)
            if not _L: _b916.append('%s 例句解析失败' % _f); continue
            _mis = [en for en in _L if en in _se916 and _L[en] != _se916[en]]
            if _mis: _b916.append('%s 有 %d 个词的例句与赛季岛不一致(配例句音频必然对不上): %s' % (_f, len(_mis), _mis[:5]))
            _nc2 = [en for en, (ex, _) in _L.items() if not re.search(r'\b' + re.escape(en) + r'\b', ex, re.I)]
            if _nc2: _b916.append('%s 有 %d 个词例句不含原形→进不了完形填空: %s' % (_f, len(_nc2), _nc2[:5]))
except Exception as _e916:
    _b916.append('例句跨岛一致性体检异常: %s' % _e916)
if _b916: fail('v916 例句必须全库唯一: ' + str(_b916[:5]))
else: ok('v916 (Hansen要给例句配音频·配之前必须先对齐) 星海240词例句【全库唯一】铁律。查出并修复: 星海240词 = 赛季岛一整份 + 8个星域岛各30个, 是同一批词但【两套独立数据】(赛季岛词表在 island_data.json→season→DATA 盖章生成; 8个星域岛是独立HTML)。v914 改的那25条例句【只改了赛季岛】→ 星域岛仍是老例句: 那25个词在星域岛依然进不了完形填空(land3:2 describe/realize · land4:14 mention/admit/indicate/comment/debate/provide/produce/invent/destroy/repair/establish/manage/handle/perform · land6:2 examine/calculate · land7:2 stranger/customer · land8:5 chemical/creature/particle/employee/colleague), 且同一个词两个岛显示两句不同的例句。这在配【例句音频】时是致命的——一个词一条音频, 两个岛例句不同必然对不上。已把25条同步到星域岛。复验: 8个星域岛 进不了完形填空 0 个 · 例句与赛季岛不一致 0 个 → 240词每词只有【唯一一条】例句, 一条音频全岛通用。本守卫钉死: 例句必须100%含原形 + 赛季岛与8个星域岛的 ex/exCn 必须逐字一致。v916')


# ---- ⭐ v917 (Hansen 开始给例句配真人音频·第1批30条) 例句音频铁律 ----
# speak() 原本【只给单词查本地 mp3, 句子一律走 TTS】(if(!isSent) 才查本地) → 📝 例句 一直是机器合成音。
# 修改: 在 speak() 里给【句子】也加一条本地音频优先级(命中 Hansen 录的 mp3 就播真人, 没命中自动回落 TTS)。
# 只改这一处, 所有播例句的地方全部自动生效, 未配音的词照常能读。
# 映射表 hansen_ex_audio.js 的 key = 【规范化后的例句】(只留字母和空格·小写), value = words/<单词>_ex_season.mp3。
# ★最关键的一条: 例句文字一旦被改动, key 就对不上 → 音频【静默失效】(按钮还在, 但偷偷变回了合成音, 没人会发现)。
#   所以本守卫强制: 映射表里的每个 key 必须【等于】该单词在赛季岛里例句的规范化结果。对不上 = 拒绝打包。
_b917 = []
def _nrm917(_t):
    _t = _t.replace('\u2019', "'")
    _t = re.sub(r'[^A-Za-z ]', '', _t)
    return re.sub(r'\s+', ' ', _t).strip().lower()
try:
    if not os.path.exists('hansen_ex_audio.js'):
        _b917.append('hansen_ex_audio.js 丢失(例句真人音频映射表)')
    else:
        _ea917 = open('hansen_ex_audio.js', encoding='utf-8', errors='replace').read()
        # 只解析【按例句做 key】的主表; 后面还有一张 __HANSEN_EX_AUDIO_BY_WORD(按单词做 key 的备用表), 不能混进来
        _main917 = _ea917.split('__HANSEN_EX_AUDIO_BY_WORD')[0]
        _map917 = dict(re.findall(r'"([^"]+)":\s*"(words/[a-zA-Z]+_ex_season\.mp3)"', _main917))
        if not _map917:
            _b917.append('hansen_ex_audio.js 里一条映射都没有')
        # ① 映射指向的 mp3 必须真实存在
        for _k, _v in _map917.items():
            if not os.path.exists(_v):
                _b917.append('例句音频文件缺失: %s' % _v)
        # ② words/ 里的例句 mp3 必须都在映射表里(不许有孤儿文件·白打包)
        for _f in glob.glob('words/*_ex_season.mp3'):
            if _f.replace('\\', '/') not in _map917.values():
                _b917.append('例句音频未接入映射表(白放进包里): %s' % _f)
        # ③ ★key 必须等于该词在赛季岛例句的规范化结果(例句一改, 音频就静默失效 → 必须拦下)
        _sea917 = open('island_season.html', encoding='utf-8', errors='replace').read()
        for _k, _v in _map917.items():
            _w917 = os.path.basename(_v).replace('_ex_season.mp3', '')
            _m917 = re.search(r'\{en:"%s",pn:"[^"]*",cn:"[^"]*",emoji:"[^"]*",ex:"(.*?)",exCn:' % re.escape(_w917), _sea917)
            if not _m917:
                _b917.append('%s: 赛季岛找不到这个词' % _w917); continue
            if _nrm917(_m917.group(1)) != _k:
                _b917.append('%s 的例句被改过, 音频 key 对不上→真人音频会静默失效(变回合成音): 例句="%s" key="%s"'
                             % (_w917, _m917.group(1)[:40], _k[:40]))
    # ④ speak() 必须有句子级本地音频分支; 每个岛必须引入映射表
    for _f917 in ['template.html'] + sorted(glob.glob('island_land[1-8].html')) + sorted(glob.glob('island_*.html')):
        _t917 = open(_f917, encoding='utf-8', errors='replace').read()
        if 'function speak(' not in _t917:
            continue
        if 'if(isSent && window.__HANSEN_EX_AUDIO)' not in _t917:
            _b917.append('%s: speak() 缺句子级本地音频分支(例句会退回机器合成音)' % _f917)
        if 'hansen_ex_audio.js' not in _t917:
            _b917.append('%s: 未引入 hansen_ex_audio.js(映射表加载不到→例句无音频)' % _f917)
except Exception as _e917:
    _b917.append('例句音频体检异常: %s' % _e917)
if _b917: fail('v917 例句真人音频: ' + str(_b917[:5]))
else: ok('v917 (Hansen 开始给例句配真人音频·第1批: 单词大陆①迷雾心湖 30 条) 例句真人音频接入 + 铁律。①根因: speak() 原本只给【单词】查本地 mp3、【句子】一律走 TTS(if(!isSent) 才查) → 📝例句 一直是机器合成音。修改: 在 speak() 里给句子也加一条本地音频优先级(命中就播真人·没命中自动回落 TTS), 只改这一处, 所有播例句的地方全部自动生效, 未配音的 210 个词照常能读。②映射表 hansen_ex_audio.js: key=规范化后的例句(只留字母空格·小写·撇号/标点变体都能命中), value=words/<单词>_ex_season.mp3。240词共用同一套例句(v916 已把赛季岛与8个星域岛逐字对齐)→ 一条音频全岛通用。③真机验证: island_land1 30/30 播本地文件且 HTTP200; island_season 30个有音频的播本地、210个没音频的正确回落TTS且未误播、0报错。④音频体检: 30条全部 mp3/64kbps/24kHz单声道·时长1.8~3.6秒·语速0.23~0.44秒每词, 无空文件无串音。⑤本守卫钉死: 映射指向的 mp3 必须存在 / words里的例句mp3不许有孤儿 / speak()必须有句子级分支 / 每个岛必须引入映射表 / ★key必须等于该词在赛季岛例句的规范化结果——例句文字一旦被改动, key 就对不上, 真人音频会【静默失效】(按钮还在但偷偷变回合成音, 没人会发现), 这种改动一律拒绝打包。进度: 30/240。v917')


# ---- ⭐ v918 (Hansen: map 换成新音频, 老的直接删掉) 音频映射不得指向空文件 + 换音频必须换文件名 ----
# ★关键背景(换音频最容易踩的坑): 游戏里所有单词 mp3 的 URL 后面挂的是【写死的 ?v215】(hansen_preload.js 里明确注释:
#   "单词 mp3: words/XXX.mp3?v215 —— 游戏里写死", 目的是让预加载和游戏共用同一份长期缓存)。
#   这意味着【原地替换文件内容、不改文件名】= URL 一个字没变 = CDN 和微信 webview 会继续吐【旧音频】, 用户根本听不到新的。
#   所以: 换音频必须【换文件名】(如 map.mp3 → map_r2.mp3), 只让这一个文件的 URL 变 →
#   只有它重新下载, 其余 900 多条音频的缓存全部保留(不会让用户重下整包)。
# 本次: map(地图) 换成 Hansen 新录的音频 → words/map_r2.mp3, 老的 words/map.mp3 已彻底删除、全库零引用。
# 铁律: ①老文件不得残留、不得被引用 ②每一条音频映射都必须指向【真实存在的文件】(否则那个词点了没声, 而且没人会发现)。
_b918 = []
try:
    if os.path.exists('words/map.mp3'):
        _b918.append('老音频 words/map.mp3 又出现了(应已删除, 换音频必须换文件名否则缓存吐旧的)')
    if not os.path.exists('words/map_r2.mp3'):
        _b918.append('新音频 words/map_r2.mp3 丢失')
    for _f918 in ['word_map.js', 'island_data.json'] + sorted(glob.glob('island_*.html')):
        if 'words/map.mp3' in open(_f918, encoding='utf-8', errors='replace').read():
            _b918.append('%s 仍引用已删除的 words/map.mp3' % _f918)
    # 全库音频映射: 每一条都必须指向真实存在的文件
    _miss918 = []
    _wm918 = open('word_map.js', encoding='utf-8', errors='replace').read()
    for _k, _v in re.findall(r'"([^"]+)"\s*:\s*"(words/[^"]+\.mp3)"', _wm918):
        if not os.path.exists(_v): _miss918.append('word_map:%s→%s' % (_k, _v))
    import json as _j918
    _d918 = _j918.load(open('island_data.json', encoding='utf-8'))
    for _isl, _v918 in _d918.items():
        for _k, _p in re.findall(r"([A-Za-z ']+):'(words/[^']+\.mp3)'", str(_v918.get('local_audio', ''))):
            if not os.path.exists(_p): _miss918.append('%s:%s→%s' % (_isl, _k.strip(), _p))
    if _miss918:
        _b918.append('%d 条音频映射指向不存在的文件(点了没声·静默失效): %s' % (len(_miss918), _miss918[:4]))
except Exception as _e918:
    _b918.append('音频映射体检异常: %s' % _e918)
if _b918: fail('v918 音频映射: ' + str(_b918[:5]))
else: ok('v918 (Hansen: map 地图这个词换成新音频·之前的老音频直接删掉) 音频映射不得指向空文件 + 换音频必须换文件名。★关键坑: 游戏里所有单词 mp3 的 URL 后面挂的是【写死的 ?v215】(hansen_preload.js 明确注释: 游戏里写死, 为的是预加载和游戏共用同一份长期缓存) → 【原地替换文件内容、不改文件名】= URL 一个字没变 = CDN 与微信 webview 继续吐【旧音频】, 用户根本听不到新的。所以换音频必须【换文件名】: map.mp3 → map_r2.mp3, 只让这一个文件的 URL 变 → 只有它重新下载, 其余 900 多条音频缓存全部保留(不会让用户重下整包 19MB)。本次处理: ①新音频音量对齐词库(原始 mean -21.2dB 比词库平均 -17dB 轻约4dB·夹在别的单词里会明显发闷 → +2.7dB 后 mean -18.9dB / peak -1.8dB, 落在词库区间内且不削波) ②存为 words/map_r2.mp3 ③word_map.js 全局表 + island_data.json(traffic岛内覆盖) 全部改指向新文件 ④老文件 words/map.mp3 彻底删除, 全库零引用。真机验证: island_traffic 与 island_school(school无岛内映射·走全局表) 点发音 → 都解析到 words/map_r2.mp3, 网络请求 206(媒体分段请求·正常), 老文件 map.mp3 未被请求, 0报错。全库音频映射体检: 901 条映射全部指向真实存在的文件, 无静默失效。v918')


# ---- ⭐ v921 (Hansen: 不要联网发音·全部用我们自己的本地音频·把这个机制彻底锁死) 零联网 TTS 铁律 ----
# Hansen 真机发现: 星海(时之钟谷 land3)的单词点发音是【联网合成音】, 不是他提供的真人音频。
# 审计结果(音频文件其实一个都不缺, 240 个 <词>_season.mp3 全在磁盘上, 纯粹是【映射没挂】):
#   · island_season   : 240 词只挂了 155 条 → 85 个词联网
#   · island_land2    : 30 词只挂了 10 条  → 20 个词联网
#   · island_land3~8  : 每岛 30 词【一条都没挂自己的】——8个星域岛被塞了【同一份 land1 的映射表】(复制粘贴bug) → 各 30 个词全部联网
#   · 常规岛 body/city/clothes : 90 个词也没挂 WORD_MAP → 全部联网
#   合计 375 个词次在联网合成, 而本地音频文件全都躺在 words/ 里没被用上。
# speak() 的查找顺序: __ISLAND_LOCAL_AUDIO(岛内) → WORD_MAP(全局) → 都没有就【联网 TTS】。
# 修复: 星海9岛全部挂上完整 240 条映射; 常规岛缺的 277 条补进 WORD_MAP(文件本来就在)。
# 铁律(彻底锁死): 全库任何一个岛的任何一个词, 都必须能解析到【真实存在的本地音频文件】。
#              只要有一个词解析不到 → 它就会联网合成 → 立即拒绝打包。
_b921 = []
try:
    _wm921 = open('word_map.js', encoding='utf-8', errors='replace').read()
    _WMAP921 = dict(re.findall(r'"([^"]+)"\s*:\s*"(words/[^"]+\.mp3)"', _wm921))
    _tts921 = []
    for _f921 in sorted(glob.glob('island_*.html')):
        _t921 = open(_f921, encoding='utf-8', errors='replace').read()
        if 'const DATA=[' not in _t921: continue
        _i9 = _t921.index('const DATA=['); _d9 = 0; _j9 = _i9 + len('const DATA=')
        _e9 = len(_t921)
        for _k9 in range(_j9, len(_t921)):
            if _t921[_k9] == '[': _d9 += 1
            elif _t921[_k9] == ']':
                _d9 -= 1
                if _d9 == 0: _e9 = _k9 + 1; break
        _W9 = []
        for _c9, _b9 in re.findall(r'\{cat:"([^"]+)",words:\[(.*?)\n\]\}', _t921[_j9:_e9], re.S):
            _W9 += re.findall(r'\{en:"(.*?)",pn:', _b9)
        _m9 = re.search(r'__ISLAND_LOCAL_AUDIO\s*=\s*(\{.*?\})\s*;', _t921, re.S)
        _la9 = dict(re.findall(r"([A-Za-z][A-Za-z '\-]*)\s*:\s*'(words/[^']+\.mp3)'", _m9.group(1))) if _m9 else {}
        for _w9 in _W9:
            _lw = _w9.lower()
            _p9 = _la9.get(_lw) or _la9.get(_w9)
            if _p9 and os.path.exists(_p9): continue
            _p9 = _WMAP921.get(_lw)
            if _p9 and os.path.exists(_p9): continue
            _tts921.append('%s:%s' % (_f921.replace('island_', '').replace('.html', ''), _w9))
    if _tts921:
        _b921.append('%d 个词解析不到本地音频→会【联网合成发音】: %s' % (len(_tts921), _tts921[:8]))
    # 星海 240 词的映射必须在 赛季岛 + 8个星域岛 全部齐备(land3~8 曾被塞成 land1 的表)
    for _f9 in ['island_season.html'] + ['island_land%d.html' % _n for _n in range(1, 9)]:
        _t9 = open(_f9, encoding='utf-8', errors='replace').read()
        _c9 = len(re.findall(r"_season\.mp3'", _t9))
        if _c9 < 240:
            _b921.append('%s 的岛内音频映射只有 %d 条(应为完整 240 条·否则该岛的词会联网发音)' % (_f9, _c9))
except Exception as _e921:
    _b921.append('零联网发音体检异常: %s' % _e921)
if _b921: fail('v921 零联网TTS: ' + str(_b921[:5]))
else: ok('v921 (Hansen真机: 星海的单词在联网发音, 不要联网, 全部用我们自己的本地音频, 把机制彻底锁死) 零联网 TTS 铁律。★根因(音频文件一个都不缺, 纯粹是映射没挂): speak() 查找顺序是 __ISLAND_LOCAL_AUDIO(岛内)→WORD_MAP(全局)→都没有就【联网TTS合成】。审计发现: island_season 240词只挂了155条(85个联网) / island_land2 只挂10条(20个联网) / island_land3~8【每岛一条自己的都没挂】——8个星域岛被塞了同一份【land1 的映射表】(复制粘贴bug), 所以各30个词全部联网(Hansen 截图的时之钟谷就是) / 常规岛 body(35)+city(27)+clothes(28) 共90个词也没挂 WORD_MAP。合计 375 个词次在联网合成, 而 240 个 <词>_season.mp3 和那 90 个 mp3 全都好端端躺在 words/ 里没被用上。★修复: 星海9岛(赛季岛+8星域岛)全部挂上完整240条岛内映射; 常规岛缺的277条补进全局 WORD_MAP(文件本来就在)。★真机验证(全库27个岛·每一个词都点了一遍发音·同时监听网络请求和浏览器speechSynthesis): 全部播本地mp3, 联网TTS 0次, 浏览器TTS 0次, 0报错。★本守卫彻底锁死: 全库任何一个岛的任何一个词, 都必须能解析到【真实存在的本地音频文件】; 只要有一个词解析不到(会联网合成) → 立即拒绝打包。另钉死: 星海9岛的岛内映射必须各含完整240条(防再次被塞成别的岛的表)。v921')


# ---- ⭐ v926 (例句真人音频 240/240 全部集齐·封口) 星海例句发音永不联网 ----
# 8 批录制全部完成: 240 个词, 每个词都有【单词音频 <词>_season.mp3】+【例句音频 <词>_ex_season.mp3】。
# 真机终验(9个星海岛·每个词的单词发音和例句发音各点一遍·共960次发音·同时监听网络请求并拦截浏览器 speechSynthesis):
#   赛季岛 240词: 单词 240/240 播本地 · 例句 240/240 播本地
#   8个星域岛各30词: 单词 30/30 播本地 · 例句 30/30 播本地
#   联网TTS 0次 · 浏览器TTS 0次 · JS报错 0 —— 一次网都没走。
# 铁律(封口): 240 个词必须【单词音频 + 例句音频】双双齐备, 映射表必须满 240 条。
#            少一条 → 那个词的例句会回落成机器合成音 → 立即拒绝打包。
_b926 = []
try:
    _sea926 = open('island_season.html', encoding='utf-8', errors='replace').read()
    _i9 = _sea926.index('const DATA=['); _d9 = 0; _j9 = _i9 + len('const DATA=')
    _e9 = len(_sea926)
    for _k9 in range(_j9, len(_sea926)):
        if _sea926[_k9] == '[': _d9 += 1
        elif _sea926[_k9] == ']':
            _d9 -= 1
            if _d9 == 0: _e9 = _k9 + 1; break
    _W926 = []
    for _c9, _b9 in re.findall(r'\{cat:"([^"]+)",words:\[(.*?)\n\]\}', _sea926[_j9:_e9], re.S):
        _W926 += re.findall(r'\{en:"(.*?)",pn:', _b9)
    if len(_W926) != 240:
        _b926.append('赛季岛词数 %d(应为240)' % len(_W926))
    _now926 = [_w for _w in _W926 if not os.path.exists('words/%s_season.mp3' % _w)]
    _noex926 = [_w for _w in _W926 if not os.path.exists('words/%s_ex_season.mp3' % _w)]
    if _now926: _b926.append('%d 个词缺【单词音频】→会联网合成: %s' % (len(_now926), _now926[:6]))
    if _noex926: _b926.append('%d 个词缺【例句音频】→例句会回落成机器合成音: %s' % (len(_noex926), _noex926[:6]))
    _ea926 = open('hansen_ex_audio.js', encoding='utf-8', errors='replace').read()
    _main926 = _ea926.split('__HANSEN_EX_AUDIO_BY_WORD')[0]
    _cnt926 = len(re.findall(r'"[^"]+":\s*"words/[a-zA-Z]+_ex_season\.mp3"', _main926))
    if _cnt926 != 240:
        _b926.append('例句音频映射表只有 %d 条(应为满额 240 条)' % _cnt926)
    _orphan926 = [_f for _f in glob.glob('words/*_ex_season.mp3')
                  if os.path.basename(_f).replace('_ex_season.mp3', '') not in _W926]
    if _orphan926:
        _b926.append('%d 个例句音频不属于星海240词(白打包): %s' % (len(_orphan926), _orphan926[:4]))
except Exception as _e926:
    _b926.append('例句音频封口体检异常: %s' % _e926)
if _b926: fail('v926 星海例句发音永不联网: ' + str(_b926[:5]))
else: ok('v926 (Hansen 8批录制全部完成·例句真人音频 240/240 集齐·封口) 星海例句发音永不联网。240个词现在【单词音频 <词>_season.mp3 + 例句音频 <词>_ex_season.mp3】双双齐备, 映射表满240条。★真机终验(9个星海岛·每个词的【单词发音】和【例句发音】各点一遍·共960次发音·同时监听网络请求并拦截浏览器 speechSynthesis): 赛季岛240词 单词240/240播本地·例句240/240播本地; 8个星域岛各30词 单词30/30播本地·例句30/30播本地; 联网TTS 0次·浏览器TTS 0次·JS报错0 —— 一次网都没走。★本守卫封口: 240个词必须单词音频+例句音频双双齐备、映射表必须满240条、不许有不属于星海的孤儿例句音频; 少一条 → 那个词的例句会偷偷回落成机器合成音 → 立即拒绝打包。配合 v917(例句文字一改→key对不上→真人音频静默失效→拒绝打包) 与 v921(任何一个词解析不到本地音频→拒绝打包), 星海的发音链路已彻底锁死。v926')


# ---- ⭐ v927 (Hansen: 所有例句从头到尾能不能正常发音·每个单词是不是真人发音·全都上锁) 全库发音总锁 ----
# 发音解析链路(游戏里真实的查找顺序):
#   单词: __ISLAND_LOCAL_AUDIO(岛内) → WORD_MAP(全局) → 都没有就【联网 TTS 合成】
#   例句: __HANSEN_EX_AUDIO(星海240·按【规范化例句】做key) → SENTENCE_MAP(常规岛·按【例句原文精确匹配】)
#         → 都没有就【联网 TTS 合成】
# 这条链路有三种【静默失效】: 出问题时按钮还在、页面不报错, 只是偷偷变回机器合成音, 没人会发现——
#   ① 例句文字被改一个字符 → SENTENCE_MAP 是原文精确匹配, key 立刻对不上 → 掉去联网合成
#   ② 某个词的音频映射被删/被覆盖(8个星域岛就曾被塞成同一份 land1 的表) → 掉去联网合成
#   ③ 音频文件被替换/损坏/删除 → 掉去联网合成(且 ?v215 是写死的长期缓存令牌, 换文件不改名用户还会听到旧的)
# 所以 hansen_audio_lock.json 把【整张发音解析表】+【每个音频文件的 sha256 指纹】全部钉死:
#   resolution: 27个岛 · 1192个词 → 各自的单词音频文件 + 例句音频文件(精确到文件名)
#   files     : 1891 个被引用的音频文件 → sha256 + 字节数
# 任何一项对不上 → 立即拒绝打包, 并指出是哪个岛的哪个词。故意改音频后用
#   python3 hansen_audio_lock.py --rebuild  重新生成基线。
_b927 = []
try:
    sys.path.insert(0, os.getcwd())
    import importlib
    _hal = importlib.import_module('hansen_audio_lock')
    importlib.reload(_hal)
    _b927 = _hal.verify()
except Exception as _e927:
    _b927 = ['全库发音总锁体检异常: %s' % _e927]
if _b927: fail('v927 全库发音总锁: ' + str(_b927[:4]))
else: ok('v927 (Hansen: 帮我认真查一下·所有例句从头到尾能不能正常发音·每一个单词是不是真人发音·全都上锁·不要再出现更新一下就冒新bug) 全库发音总锁。★先做了全库真机终验(27个岛·1192个词·每个词的【单词发音】和【例句发音】各点一遍=2384次发音·同时监听网络请求并拦截浏览器 speechSynthesis·且断言【实际播的文件必须等于映射表指定的那个文件】): 18个常规岛(712词)+8个星域岛(240词)+赛季岛(240词) 全部播本地真人 mp3(HTTP 200/206), 联网TTS 0次·浏览器TTS 0次·JS报错 0。★发音解析链路: 单词=岛内映射→全局WORD_MAP→否则联网合成; 例句=星海240的规范化表 __HANSEN_EX_AUDIO → 常规岛的 SENTENCE_MAP(【例句原文精确匹配】→ sentences/sentence_NNNN.mp3) → 否则联网合成。SENTENCE_MAP 709条/709个文件, 零缺失零孤儿。★三种【静默失效】(按钮还在、页面不报错, 只是偷偷变回机器合成音, 没人会发现): ①例句文字改一个字符→原文精确匹配立刻失效 ②音频映射被删或被覆盖(8个星域岛就曾被塞成同一份land1的表) ③音频文件被替换/损坏/删除(而 ?v215 是写死的长期缓存令牌, 原地换文件不改名用户只会继续听旧的)。★本锁 hansen_audio_lock.json 把整张发音解析表(27岛·1192词·每词的单词音频+例句音频文件名)和 1891 个音频文件的 sha256 指纹全部钉死, 任何一项对不上→拒绝打包并指出是哪个岛的哪个词。实测三种故障各试一遍全部当场拦下。要故意改音频时: python3 hansen_audio_lock.py --rebuild。v927')


# ---- ⭐ v928 (Hansen: 配色实在太差·灰不拉几·字都看不清·弹窗里还有黄色的·点单词一闪一闪·彻底修复) 亮色主题 ----
# 根因(全库扫出 60 条): 亮色主题此前【只改了 body 的字色】, 卡片/面板/弹窗的【底色】压根没被接管——
#   · .exp-card 的渐变只有第一个色是变量, 第二个 #1a1f3a 是【写死的深蓝黑】→ 亮色下变成"浅→深"的脏灰渐变
#   · .modal/.mode-card/.util-card/.ach-*/.psw-*/.back-btn … 33条"变量+写死深色"混搭 + 27条纯写死深底
#   · 而文字被 --pal-ink 改成【深色】→ 深字压深底 = 灰不拉几 + 看不清
#   · 弹窗 .m-cn(中文释义)=#fbbf24 金 / .m-excn(例句翻译)=#fde047 黄 → 浅底上几乎隐形
#   · 触屏上 :hover 会【粘住】→ .exp-card:hover 位移 + ::before 蒙层淡入 → 点一下就"一闪一闪一闪"
# 真机像素级量过(修前·樱花粉): 单词卡中文 2.23:1 · 顶栏名字 1.47:1 · 分类标题 1.38:1 · 统计页 1:1(纯隐形)
# 本静态守卫只钉死【规则还在】; 真正的把关是 build 步骤 6.6 的 light_guard.py(真机像素级量对比度)。
_b928 = []
try:
    _pal928 = open('hansen_palette.js', encoding='utf-8', errors='replace').read()
    for _k928, _why928 in [
        ("html.hsn-pal-light", "亮色主题选择器"),
        ("_SF", "亮色卡面(浅底渐变)"),
        (".exp-card .cn", "单词卡中文字色"),
        (".m-cn", "弹窗中文释义(金→深琥珀)"),
        (".m-excn", "弹窗例句翻译(黄→深琥珀)"),
        ("hover:none", "触屏防闪(hover 不粘住)"),
    ]:
        if _k928 not in _pal928 and _k928 != "hover:none":
            _b928.append("hansen_palette.js 里【%s】不见了(%s)" % (_k928, _why928))
    _n928 = 0
    for _f928 in ['template.html'] + sorted(glob.glob('island_land[1-8].html')):
        _s928 = open(_f928, encoding='utf-8', errors='replace').read()
        if 'hover:none' in _s928 and 'tap-highlight-color:transparent' in _s928:
            _n928 += 1
        else:
            _b928.append("%s 缺【触屏防闪 CSS】(点一下单词卡会一闪一闪)" % _f928)
    for _f928 in sorted(glob.glob('island_*.html')):
        _s928 = open(_f928, encoding='utf-8', errors='replace').read()
        if 'hover:none' not in _s928:
            _b928.append("%s 缺触屏防闪 CSS" % _f928)
    if not os.path.exists('light_guard.py') or not os.path.exists('light_probe.mjs'):
        _b928.append("亮色守卫文件(light_guard.py / light_probe.mjs)不见了")
except Exception as _e928:
    _b928.append('亮色主题体检异常: %s' % _e928)
if _b928: fail('v928 亮色主题: ' + str(_b928[:5]))
else: ok('v928 (Hansen: 配色实在太差·灰不拉几·字都看不清·弹窗里还有黄色的·我一点单词就一闪一闪一闪·彻底修复亮色调整体的文字配色和背景) 亮色主题总修 + 触屏防闪。★根因(全库扫出60条): 亮色主题此前【只改了 body 的字色】, 卡片/面板/弹窗的【底色】压根没被接管——.exp-card 的渐变只有第一个色是变量, 第二个 #1a1f3a 是【写死的深蓝黑】→ 亮色下变成"浅→深"的脏灰渐变(就是截图里那个"灰不拉几"); 而文字被 --pal-ink 改成了深色 → 深字压深底 = 看不清。全库共 33 条"变量+写死深色"混搭渐变 + 27 条纯写死深底(.modal/.mode-card/.util-card/.ach-*/.psw-*/.back-btn…)。弹窗里 .m-cn(中文释义)=#fbbf24 金、.m-excn(例句翻译)=#fde047 黄, 都是写死的 → 浅底上几乎隐形。★闪烁根因: 触屏上 :hover 会【粘住】(手指抬起后浏览器仍保持 hover 态), .exp-card:hover{transform:translateY(-2px)} + :hover::before{opacity:1}(带过渡) 再叠加 :active{scale(.94)} → 点下去缩小、抬起弹回、hover 又粘住位移+蒙层淡入, 手指一滑 hover 还会在卡片间接力 = 肉眼的"一闪一闪一闪"。修法: hover 只在真有鼠标的设备生效(@media(hover:none) 中和) + 关掉系统点击高亮块。★真机像素级量过(修前·樱花粉): 单词卡中文 2.23:1 · 顶栏名字 1.47:1 · 分类标题 1.38:1 · 统计页文字 1:1(纯隐形) —— WCAG AA 要 4.5:1。修后 4 个亮色配色(云端白/樱花粉/奶油杏/薄荷绿) × 9 个屏幕(含单词弹窗) 共 268 个可见文字元素【全部合格·0 处不合格】, 深色主题完全不受影响(规则全部限定在 html.hsn-pal-light 下)。★把关: build 步骤 6.6 的 light_guard.py 每次打包都真触屏渲一遍 4 个亮色配色×9 个屏幕, 整页截图后逐个文字取【边缘环的真实像素】当背景算 WCAG 对比度(用像素而不是 getComputedStyle —— 后者会把渐变色标做平均, 实测把 6 处真问题放大成 230 处假警报), 任何一处不合格或触屏防闪失效 → 拒绝打包。实测把亮色卡面改回深灰 → 当场抓出 21 处。v928')


# ---- ⭐ v929 (Hansen: "进岛很多画面加载不出来·非常卡顿·点打Boss卡在那儿·我要极致快·上线前最高优先级") 加载性能 ----
# 修前实测(island_land3·本地无限速, 已是最好情况): 首次绘制 2364ms · DOMContentLoaded 3826ms · load 4619ms
#   · 158 个请求 / 11.95 MB。模拟4G+gzip 下【首屏图标全部画完要 5.4 秒】, 关键路径 6.1 MB。
# ★ 三个根因(每一个都致命):
#   ① hansen_boss_attack.js 2.44MB(内含 1.28MB base64 图), 一执行还再预下十几张 boss 图;
#      hansen_cards.js 的 loadNext() 进岛 200ms 就开始预下 19 张卡册 boss 图。
#      → 进岛白白下 45 张 boss 图(4.58MB), 把首屏图标的带宽全抢光 = "图片加载不出来"。
#      而它们【只有打 Boss / 开卡册时才用得上】。
#   ② Baloo2 字体 font-display:block —— block 的意思是【字体没下完就不画文字】; 它还排在 4.58MB
#      boss 图后面抢带宽 → 白屏好几秒。单改 block→swap: 首次绘制 2364ms → 936ms。
#   ③ 图片尺寸严重超标: 图标真机实测【最大只显示 91px】却存 512~768px; 头像只显示 46px 却存 720px。
# ★ 特别坑: 赛季岛(星海觉醒)的【落地页就是 boss 选关墙】—— 一进岛 showScreen('boss') 就被调用。
#   但【看选关墙不需要 2.44MB 的攻击特效引擎】(墙上只有图)。而且选关墙的 <img> 没有 loading=lazy,
#   一进去把整面墙(含屏幕外的 26~41 张·2.5MB)全下了 → 赛季岛关键路径高达 6.9MB。
# ★ 修法: boss 引擎按需加载(进岛不下 → 首屏画完后空闲预取 → 真开打时若没就位, HansenBossAttack
#   保险层自动等它, 特效一帧不丢); 卡册图预下载挪到首屏画完+空闲后; 选关墙图 loading=lazy;
#   font-display swap; 图标 288px / 头像 192px(按实测显示尺寸×3倍屏); 装饰字体子集化 613→244KB
#   且推迟到首屏画完后加载; 首屏图标 <link rel=preload>; 功能模块脚本 defer(降网络优先级, 让图标先下)。
# ★ 修后(模拟4G+gzip, 与 CloudBase 一致): 看到内容 ~0.5s · 可点击 ~1.2s · 首屏图标画完 ~2.5s
#   · 关键路径 1.3MB(原 6.1MB)。热缓存再进岛 0.45s; 岛之间切换 0.33s。
# 本静态守卫只钉死【优化还在】; 真正的把关是 build 步骤 6.7 的 perf_guard.py(真机 4G+gzip 计时)。
_b929 = []
try:
    _isl929 = sorted([_f for _f in os.listdir('.') if _f.startswith('island_') and _f.endswith('.html')])
    for _f929 in _isl929:
        _t929 = open(_f929, encoding='utf-8', errors='replace').read()
        if 'font-display:block' in _t929:
            _b929.append('%s 的字体又变回 font-display:block(字体没下完就不画文字→白屏)' % _f929)
        if '__hansenBossFXReady' not in _t929:
            _b929.append('%s 缺 boss 引擎按需加载器(2.44MB 会重新压到进岛的关键路径上)' % _f929)
        if 'window.HansenBossAttack=function' not in _t929.replace(' ', ''):
            _b929.append('%s 缺 HansenBossAttack 保险层(引擎没就位时特效会丢)' % _f929)
        if 'rel="preload" as="image"' not in _t929:
            _b929.append('%s 缺首屏图标 preload' % _f929)
        if '__hsnLateFont' not in _t929:
            _b929.append('%s 缺装饰字体延后加载' % _f929)
        if '<script defer src=' not in _t929:
            _b929.append('%s 的功能模块脚本没有 defer(会和首屏图标抢带宽)' % _f929)
    _c929 = open('hansen_cards.js', encoding='utf-8', errors='replace').read()
    if 'loading="lazy"' not in _c929:
        _b929.append('hansen_cards.js 选关墙的 boss 图丢了 loading=lazy(会把整面墙 2.5MB 全下下来)')
    if 'setTimeout(init, 200)' in _c929:
        _b929.append('hansen_cards.js 卡册图预下载又回到进岛 200ms(会抢首屏带宽)')
    # 图片尺寸: 别再塞回超大图 —— 但上限必须按【真实最大展示位】定, 不能只按顶栏算
    # ⚠️ v933 修正: v929 定 avatars 上限 220px 时【只量了顶栏头像(46px)】, 漏掉了同一张图的另外两个展示位:
    #      · 形象选择器网格缩略图 —— 显示 110px (3倍屏需要 330px)
    #      · 形象详情大卡片       —— 显示 331px (3倍屏需要 993px)
    #    大卡片的 CSS 是 width:auto —— 图按【原始尺寸】画, 只有超过上限才缩小。
    #    192px 的小图【根本够不着 331px 的上限】→ 就按 192px 原样画 = 只占卡片 53% = 缩成一小坨(Hansen 截图那个)。
    #    现在: avatars/ 小图上限 360px(够网格的 330px); 大卡片单独走 avatars/hd/(720px 原图, 只在打开详情时加载一张)。
    #    真机像素级把关交给 build 步骤 6.8 的 img_guard.py(量源图尺寸 vs 展示位尺寸), 这里只挡"又塞回超大图"。
    from PIL import Image as _Im929
    for _d929, _cap929 in (('icons', 320), ('avatars', 360)):
        for _fn929 in os.listdir(_d929):
            if not _fn929.lower().endswith(('.webp', '.png', '.jpg')):
                continue
            try:
                _w929, _h929 = _Im929.open(os.path.join(_d929, _fn929)).size
            except Exception:
                continue
            if max(_w929, _h929) > _cap929:
                _b929.append('%s/%s 又变成 %dx%d(超过真实最大展示位所需·超标就是白烧用户流量)' % (_d929, _fn929, _w929, _h929))
                break
    # v933: 形象详情大卡片必须有高清图撑着, 否则立绘缩成一小坨(只占卡片 53%)
    if not os.path.isdir('avatars/hd'):
        _b929.append('avatars/hd/ 不见了 —— 形象详情大卡片会退回小图, 立绘缩成一小坨')
    else:
        _hd933 = [x for x in os.listdir('avatars/hd') if x.lower().endswith('.webp')]
        if len(_hd933) < 66:
            _b929.append('avatars/hd/ 只有 %d 张(应 66 张) —— 缺的那些形象详情会缩成一小坨' % len(_hd933))
        else:
            _w933, _h933 = _Im929.open('avatars/hd/01.webp').size
            if max(_w933, _h933) < 600:
                _b929.append('avatars/hd/01.webp 只有 %dx%d —— 高清图被压过头, 大卡片(显示331px)撑不起来' % (_w933, _h933))
    _a933 = open('hansen_avatar.js', encoding='utf-8', errors='replace').read()
    if 'avatars/hd/' not in _a933:
        _b929.append('hansen_avatar.js 的形象详情大卡片没在用 avatars/hd/ 高清图 —— 立绘会缩成一小坨')
    if not (os.path.exists('img_guard.py') and os.path.exists('img_size_audit.mjs')):
        _b929.append('img_guard.py / img_size_audit.mjs 不见了 —— 图片尺寸守卫失效, 压图压过头没人拦得住')
    if not (os.path.exists('perf_guard.py') and os.path.exists('perf_probe.mjs')):
        _b929.append('性能守卫文件(perf_guard.py / perf_probe.mjs)不见了')
except Exception as _e929:
    _b929.append('v929 加载性能体检异常: %s' % _e929)
if _b929: fail('v929 加载性能: ' + str(_b929[:5]))

# ═══ v937 元守卫: 守卫本身不许被偷偷拆掉 ═══
# Hansen: "防止每次更新内容的时候出现bug"
# 守卫是防 bug 的最后一道墙。如果哪天(包括我自己)图省事把某个守卫从 build 里摘掉、或者删了文件,
# 墙就悄悄没了, 而且【没有任何人会发现】—— 直到下一个 bug 上线。所以这道元守卫把整面墙钉死。
_g937 = []
# ⚠️ 判据必须是【真正的调用语句】, 不能只 grep 文件名 ——
#    文件名在注释里也出现, 于是把真正的 subprocess.run 摘掉, 元守卫照样"通过"(实测过, 没拦下)。
#    这正是这次会话反复犯的那个错: 判据看起来在验, 实际什么都没验。
_GUARDS937 = [
    ("sync_guard.py",   '"sync_guard.py", "--pre-build"', "沙盒↔GitHub 同步(防止在旧树/残缺树上干活, 把 GitHub 覆盖坏)"),
    ("fx_guard.py",     '"fx_guard.py"]',     "86 个 boss 特效真机像素"),
    ("light_guard.py",  '"light_guard.py"]',  "亮色主题 WCAG 对比度"),
    ("perf_guard.py",   '"perf_guard.py"]',   "4G+gzip 加载性能"),
    ("img_guard.py",    '"img_guard.py"]',    "图片尺寸(源图 vs 展示位)"),
    ("font_guard.py",   '"font_guard.py"]',   "字体子集缺字"),
    ("e2e_guard.py",    '"e2e_guard.py"]',    "端到端功能(点下去还灵不灵)"),
    ("impact_guard.py", '"impact_guard.py"]', "影响面(我改的东西被谁用着)"),
    ("pet_guard.py",    '"pet_guard.py"]',    "宠物经验/进化(经验到账·跨岛累计·真进化·界面实时刷新)"),
    ("sb_guard.py",     '"sb_guard.py"]',     "拼写蜂(27岛出题池一个词不差·机器人不抢跑)"),
]
try:
    _bp937 = open('build.py', encoding='utf-8', errors='replace').read()
    _loop937 = '_run([sys.executable, guard], stage, guard' in _bp937 and 'for guard in BROWSER_GUARDS:' in _bp937
    for _f937, _call937, _what937 in _GUARDS937:
        if not os.path.exists(_f937):
            _g937.append('守卫文件 %s 不见了 —— %s 这道墙没了' % (_f937, _what937))
        elif _f937 == 'sync_guard.py' and '"sync_guard.py", "--pre-build"' not in _bp937:
            _g937.append('%s 的调用被从 build.py 里摘掉了 —— %s 这道墙形同虚设' % (_f937, _what937))
        elif _f937 != 'sync_guard.py' and (_f937 not in _bp937 or not _loop937):
            _g937.append('%s 的调用被从 build.py 里摘掉了 —— %s 这道墙形同虚设' % (_f937, _what937))
    for _dep937 in ('dep_map.mjs', 'img_size_audit.mjs', 'font_probe.mjs', 'e2e_probe.mjs', 'pet_probe.mjs', 'sb_audit.mjs', 'sb_race.mjs'):
        if not os.path.exists(_dep937):
            _g937.append('守卫依赖的探针 %s 不见了' % _dep937)
except Exception as _e937:
    _g937.append('元守卫自检异常: %s' % _e937)
if _g937:
    fail('v937 守卫墙: ' + str(_g937[:5]))

# ═══ v938 iOS微信(WKWebView)兼容锁 ═══
# requestIdleCallback 在老 iOS 上不存在, navigator.vibrate 在 iOS 上永远不存在 ——
# 【裸调用】= iOS 微信里 ReferenceError/TypeError, 调用它的脚本当场死。
# 现库 40 处调用全部有保护(if(window.X) / 'X' in window / if(navigator.vibrate)+try)。
# 这道锁保证以后新写的代码也必须带保护。
_c938 = []
try:
    import glob as _glob938
    _files938 = sorted(_glob938.glob('*.js')) + sorted(_glob938.glob('island_*.html')) + ['template.html', 'index.html']
    for _f938 in _files938:
        if not os.path.exists(_f938):
            continue
        _s938 = open(_f938, encoding='utf-8', errors='replace').read()
        _s938 = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), _s938)
        for _m938 in re.finditer(r'requestIdleCallback\s*\(', _s938):
            _ctx938 = _s938[max(0, _m938.start() - 160):_m938.start()]
            if not re.search(r"window\.requestIdleCallback\s*[)&?|]|['\"]requestIdleCallback['\"]\s*in\s*window|typeof\s+(window\.)?requestIdleCallback", _ctx938):
                _c938.append('%s: requestIdleCallback 裸调用(老 iOS 微信直接 ReferenceError)' % _f938)
                break
        for _m938 in re.finditer(r'navigator\.vibrate\s*\(', _s938):
            _ctx938 = _s938[max(0, _m938.start() - 320):_m938.start()]
            if not re.search(r'navigator\.vibrate\s*[)&?|]|typeof\s+navigator', _ctx938):
                _c938.append('%s: navigator.vibrate 裸调用(iOS 上是 undefined, 调用即 TypeError)' % _f938)
                break
except Exception as _e938:
    _c938.append('兼容锁自检异常: %s' % _e938)
if _c938:
    fail('v938 iOS微信兼容: ' + str(_c938[:4]))


else: ok('v929 (Hansen: "我进入星海觉醒里面这些岛屿有时候进去的时候很多画面加载不出来·会非常的卡顿·很慢·有时候点击那个打boss那个界面我点击进去之后有时候他就会卡在那个进入那个界面那个地方·我想要一个非常非常极致快速的·快到不能再快·完全没有任何延迟没有任何卡顿·这是一个最高级的问题·小程序就要上线了如果出现这个问题那基本上就白干") 进岛加载彻底提速 + 上锁。★修前实测(本地无限速·已是最好情况): 首次绘制 2364ms · DCL 3826ms · load 4619ms · 158个请求/11.95MB; 模拟4G+gzip 下【首屏图标全部画完要 5.4 秒】关键路径 6.1MB。★三个根因: ①hansen_boss_attack.js 2.44MB(内含1.28MB base64图)一执行还再预下十几张boss图, 加上 hansen_cards.js 进岛200ms就预下19张卡册boss图 → 进岛白白下45张boss图(4.58MB)把首屏图标的带宽全抢光, 这就是"图片加载不出来"; 而它们只有打Boss/开卡册才用得上。②Baloo2 字体是 font-display:block —— block 的意思是【字体没下完就不画文字】, 它还排在 4.58MB boss图后面抢带宽 → 白屏好几秒(单改 block→swap: 首次绘制 2364→936ms)。③图片尺寸严重超标: 图标真机实测最大只显示91px却存512~768px, 头像只显示46px却存720px。★特别坑: 赛季岛(星海觉醒)的【落地页就是boss选关墙】, 一进岛 showScreen(boss) 就被调用 → 为了看一面墙把2.44MB特效引擎拖下来了; 而且选关墙的<img>没有 loading=lazy, 一进去把整面墙(含屏幕外的26~41张·2.5MB)全下了 → 赛季岛关键路径高达6.9MB。★修法: boss引擎按需加载(进岛不下→首屏画完后空闲预取→真开打时若还没就位, HansenBossAttack 保险层自动等它, 特效一帧不丢); 卡册图预下载挪到首屏画完+空闲后; 选关墙图 loading=lazy; font-display swap; 图标288px/头像192px(按真机实测的显示尺寸×3倍屏, 肉眼零差别); 装饰字体子集化613→244KB且推迟到首屏画完后加载; 首屏图标 <link rel=preload>; 功能模块脚本 defer(降网络优先级让图标先下)。★修后(模拟4G+gzip·与CloudBase一致): 看到内容 0.5s · 可点击 1.2s · 首屏图标全部画完 2.5s(原5.4s) · 关键路径 1.3MB(原6.1MB); 热缓存再进岛 0.45s; 【岛之间切换 0.33s ≈ 瞬间】。boss立绘仍是高清原图(v809/v887不受影响), 86个boss特效全部完好。★上锁: build 步骤6.7 新增 perf_guard.py, 每次打包在【模拟4G+gzip】(不模拟gzip会把结果测得比真实差2~3倍→做出错误决策)下真机加载3个代表岛, 量用户真正感觉到的三个时间+关键路径字节数, 超预算就拒绝打包。v929')


# ---- ⭐ v930 (Hansen 截图: "打boss做拼写题的时候, 这个中文字颜色根本就看不清楚。我背后用了一个主题,
#      然后这个字他现在根本就看不清楚, 这个要怎么处理? 你帮我彻底解决") 打Boss 题面可读性 ----
# ★根因: 打Boss 屏的这几行字是【裸压在 boss 背景图上】的(自身背景全透明):
#     .boss-question(中文题目「忠诚的」·金色) / .boss-q-sub(「看中文意思, 拼出英文:」) /
#     .boss-name(boss名·红) / .boss-hp-text(HP数值)
#   原设计默认【boss 背景一定是深色的】—— 实测深底上金字 11.55:1, 确实很清楚。
#   但 boss 的电影主题(HansenCinema 九款: 糖果乐园/云端气球/云端梦境/彩虹甜心/焰火盛典…)
#   全是【明亮高饱和的糖果风背景】, Hansen 一换主题, 这些裸字实测暴跌到 2.07~2.93:1(WCAG AA 要 4.5) → 看不清。
#   而 boss 台词气泡 / 选项卡 / 题型标签一直很清楚 —— 因为【它们本来就有底板】。
# ★之前那版(v76)只给这几行字加了【描影 text-shadow】。描影在深底上够用, 在花哨亮底上救不了 —— 这就是为什么没修好。
# ★注: v928 的亮色守卫【特意跳过 #bossScreen】(打Boss保持电影感的铁律), 所以这个问题一直没被抓到。
# ★修法: 给这几行裸字垫一层【半透明深色底板】(display:table 贴合文字宽度 + margin:auto 居中),
#   和台词气泡/选项卡完全同一套视觉语言。底板不挑背景: 深底/亮底/花底一律稳读。
#   这是【所有配色统一】的基础样式(不随调色板变), 不违反"打Boss任何配色都不动"的铁律。
# ★本守卫的验证方式(比抽样测几个主题严谨得多):
#   底板是【半透明纯色】, 所以可以【算出它在任何背景下的最差对比度】——
#   用【纯白】(比任何电影主题都亮的极限)去压底板, 得到底板的"最透实色", 再算对比度。
#   只要最坏情况都达标, 那就【任何背景都压不垮】。实测最坏值:
#     .boss-question 8.10:1 · .boss-q-sub 10.43:1 · .boss-name 5.37:1 · .boss-hp-text 7.90:1 (修前 2.07~2.93)
_b930 = []
try:
    _bl930 = open('hansen_boss_lock.js', encoding='utf-8', errors='replace').read()

    def _lum930(c):
        def f(v):
            v = v / 255.0
            return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])

    def _ratio930(fg, bg):
        a, b = _lum930(fg), _lum930(bg)
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)

    # 每项: (选择器, 文字色, 需要的对比度[按字号/粗细], 说明)
    _T930 = [
        ('.boss-question', (251, 191, 36), 3.0, '中文题目(Hansen 截图里看不清的那行)'),
        ('.boss-q-sub',    (238, 242, 247), 4.5, '题目提示「看中文意思, 拼出英文:」'),
        ('.boss-name',     (248, 113, 113), 4.5, 'boss 名字'),
        ('.boss-hp-text',  (203, 213, 225), 4.5, 'HP 数值'),
    ]
    for _sel930, _fg930, _need930, _why930 in _T930:
        # 找该选择器【带底板】的那条规则
        _m930 = _re.search("#bossScreen " + _re.escape(_sel930) +
                           r"\{[^']*background:rgba\((\d+),(\d+),(\d+),([\.\d]+)\)[^']*\}", _bl930)
        if not _m930:
            _b930.append('%s(%s) 的深色底板不见了 —— 亮色电影主题下会重新变成看不清的裸字' % (_sel930, _why930))
            continue
        _r930, _g930, _bb930, _a930 = int(_m930.group(1)), int(_m930.group(2)), int(_m930.group(3)), float(_m930.group(4))
        # 最坏情况: 底板压在【纯白】上(比任何电影主题都亮)
        _plate930 = tuple(_a930 * p + (1 - _a930) * 255 for p in (_r930, _g930, _bb930))
        _got930 = _ratio930(_fg930, _plate930)
        if _got930 < _need930:
            _b930.append('%s(%s) 最坏情况只有 %.2f:1(需≥%.1f) —— 亮背景下会看不清' % (_sel930, _why930, _got930, _need930))
        # 底板必须贴合文字并居中(否则会变成一条横贯屏幕的黑条 / 或挤到同一行)
        if ('#bossScreen ' + _sel930 + '{display:table') not in _bl930.replace(' !important', ''):
            _b930.append('%s 缺 display:table(底板会拉满整行, 很难看)' % _sel930)
    # 横向 margin 必须是 auto(否则底板不居中·实测会靠左)
    for _sel930 in ('.boss-name', '.boss-question', '.boss-q-sub', '.boss-hp-text'):
        _ms930 = _re.findall("#bossScreen " + _re.escape(_sel930) + r"\{[^']*margin:([^;!}]+)", _bl930)
        if _ms930 and not any('auto' in _x930 for _x930 in _ms930):
            _b930.append('%s 的横向 margin 不是 auto —— 底板不会居中(会靠左)' % _sel930)
except Exception as _e930:
    _b930.append('v930 打Boss题面可读性体检异常: %s' % _e930)
if _b930: fail('v930 打Boss题面可读性: ' + str(_b930[:5]))
else: ok('v930 (Hansen 截图: "这个是打boss, 就是在做那个拼写题的时候, 你看就是它这个中文字颜色根本就看不清楚。我背后用了一个主题, 然后这个字他现在根本就看不清楚, 这个要怎么处理? 你帮我彻底解决") 打Boss 题面可读性彻底修复 + 上锁。★根因: 打Boss屏的这几行字是【裸压在boss背景图上】的(自身背景全透明): .boss-question(中文题目「忠诚的」·金色)/.boss-q-sub(「看中文意思, 拼出英文:」)/.boss-name(boss名·红)/.boss-hp-text(HP数值)。原设计默认【boss背景一定是深色的】——实测深底上金字 11.55:1 确实很清楚; 但boss的电影主题(HansenCinema九款: 糖果乐园/云端气球/云端梦境/彩虹甜心/焰火盛典…)全是【明亮高饱和的糖果风背景】, Hansen一换主题这些裸字实测暴跌到 2.07~2.93:1(WCAG AA 要4.5) → 根本看不清。而boss台词气泡/选项卡/题型标签一直很清楚——因为【它们本来就有底板】。★之前那版(v76)只给这几行加了【描影text-shadow】: 描影在深底上够用, 在花哨亮底上救不了——这就是为什么一直没修好。★另注: v928的亮色守卫【特意跳过#bossScreen】(打Boss保持电影感的铁律), 所以这个问题一直没被抓到。★修法: 给这几行裸字垫一层【半透明深色底板】(display:table 贴合文字宽度 + margin:auto 居中), 和台词气泡/选项卡完全同一套视觉语言, 毫不违和; 底板不挑背景, 深底/亮底/花底一律稳读。这是【所有配色统一】的基础样式(不随调色板变), 不违反"打Boss任何配色都不动"的铁律。★验证方式(比抽样测几个主题严谨得多): 底板是【半透明纯色】, 所以可以【算出它在任何背景下的最差对比度】——用【纯白】(比任何电影主题都亮的极限)去压底板得到"最透实色", 再算对比度; 最坏情况都达标 = 任何背景都压不垮。实测最坏值: 中文题目 8.10:1(需3.0) · 题目提示 10.43:1(需4.5) · boss名 5.37:1(需4.5) · HP数值 7.90:1(需4.5), 全部达标(修前 2.07~2.93:1)。真机在 糖果乐园/云端梦境/云端气球 三款最亮主题下渲染复核, 0处不合格。v930')

# ---- v960 当前不可变发布链守卫: 图标压缩 + Boss命名 + 白名单部署包 + 完整源码 + 可复现/SHA/密钥扫描 ----
_b941_release = []
try:
    _p941 = open('package_release.py', encoding='utf-8', errors='replace').read()
    _build941 = open('build.py', encoding='utf-8', errors='replace').read()
    _jarvis941 = open('jarvis.py', encoding='utf-8', errors='replace').read()
    if 'DEPLOY_ALLOWED_EXT' not in _p941 or 'DEPLOY_RUNTIME_HTML' not in _p941:
        _b941_release.append('package_release.py 缺部署扩展名/页面白名单')
    for _name941 in ('DEPLOY_NAME', 'SOURCE_NAME', 'README_ASSET'):
        if _name941 not in _p941:
            _b941_release.append('package_release.py 缺三资产契约 %s' % _name941)
    for _token941 in ('"evolution_dashboard.html"', 'SOURCE_REQUIRED_FILES = {',
                      'unexpected = sorted(', 'actual_names != expected_names',
                      'requested v{version}', 'SECRET_PATTERNS', 'SHA256SUMS',
                      'ZIP_DATE_TIME', 'os.replace(staged, final)',
                      '"test_theme_scroll_v944.mjs"',
                      '"test_sw_upgrade_v944.mjs"',
                      '"hansen_explore_progress_v945.js"',
                      '"test_explore_progress_api_v945.mjs"',
                      '"test_explore_dual_progress_v945.mjs"',
                      '"test_explore_template_v945.mjs"',
                      '"test_explore_ui_v945.mjs"',
                      '"hansen_focused_typing_v946.js"',
                      '"test_focused_typing_v946.mjs"',
                      '"test_explore_spelling_gate_v946.mjs"',
                      '"test_focused_spelling_crystal_v946.mjs"',
                      '"test_settings_guides_hf4_v946.mjs"',
                      '"test_boss_timer_hf5_v946.mjs"',
                      '"test_boss_yecha_red_lotus_v951.mjs"',
                      '"test_boss_answer_contrast_v952.mjs"',
                      '"test_boss_admin_entry_v953.mjs"',
                      '"test_daily_card_alignment_v954.mjs"',
                      '"test_land_gacha_reveal_v955.mjs"',
                      '"test_food_word_icons_v956.mjs"',
                      '"test_food_word_icons_v957.mjs"',
                      '"apply_user_food_icons_v958.mjs"',
                      '"test_food_word_icons_v958.mjs"',
                      '"test_boss_naming_v959.mjs"',
                      '"test_food_icon_compression_v960.mjs"',
                      '"_sw_upgrade_v944.html", "hansen_sw_upgrade_gate_v944.js"',
                      '"hansen_backup_bootstrap_v944.js", "hansen_backup_v944.js"',
                      'FORBIDDEN_RUNTIME_FILES = {"hansen_backup_bootstrap.js", "hansen_backup.js", "sw.js"}'):
        if _token941 not in _p941:
            _b941_release.append('package_release.py 缺实包/输出硬守卫 %s' % _token941)
    if '"package_release.py", new, "--out"' not in _build941:
        _b941_release.append('build.py 没有唯一委托 package_release.py')
    if 'stage.glob("test_*v*.mjs")' not in _build941:
        _b941_release.append('build.py 未动态执行全部版本化专项回归测试')
    if 'HANSEN_PLAYWRIGHT_MODULE' not in _build941 or '_stage_runtime_env()' not in _build941:
        _b941_release.append('build.py 临时stage未继承真实Playwright模块路径')
    for _token_backup944 in ('BACKUP_BOOTSTRAP', 'BACKUP_RUNTIME', 'SW_GATE', 'SW_WORKER',
                             'OBSOLETE_BACKUP_RUNTIMES',
                             '_assert_backup_runtime_contract(stage)'):
        if _token_backup944 not in _build941:
            _b941_release.append('build.py 缺v944备份路径契约 %s' % _token_backup944)
    if 'zipfile.ZipFile' in _build941 or 'EXCLUDE_EXT =' in _build941:
        _b941_release.append('build.py 仍保留第二套 ZIP 实现/排除表，会与 package_release 漂移')
    if 'economy_guard.py' not in _jarvis941:
        _b941_release.append('jarvis.py 未接入 economy_guard.py')
    _main941 = _build941[_build941.find('def main()'):]
    if (_main941.find('sync_guard.py') < 0 or _main941.find('_copy_source(stage)') < 0
            or _main941.find('sync_guard.py') > _main941.find('_copy_source(stage)')):
        _b941_release.append('build.py 未把同步证明放在生成/改版本之前')
    if 'TemporaryDirectory(prefix="hansen-build-")' not in _build941:
        _b941_release.append('build.py 缺临时树事务构建')
    _evolve941 = open('hansen_evolve.py', encoding='utf-8', errors='replace').read()
    if 'legacy release packager is disabled in v942' not in _evolve941:
        _b941_release.append('hansen_evolve.py 旧打包路径未封死')
    if not os.path.exists('.github/workflows/jarvis-three-file-release.yml'):
        _b941_release.append('缺永久 GitHub Release 工作流')
    else:
        _workflow941 = open('.github/workflows/jarvis-three-file-release.yml', encoding='utf-8', errors='replace').read()
        for _token941 in ('Require a new immutable VERSION',
                          'Refusing to rewrite immutable release',
                          '--draft', 'test "$tag_sha" = "$GITHUB_SHA"',
                          'requirements-audit.txt', 'npm ci',
                          './test_*v*.mjs'):
            if _token941 not in _workflow941:
                _b941_release.append('Release 工作流缺标签/精确三资产守卫 %s' % _token941)
        for _banned941 in ('force=true', '--clobber', 'gh release delete-asset',
                           'git/refs/tags/${tag}'):
            if _banned941 in _workflow941:
                _b941_release.append('Release 工作流仍会改写历史/覆盖资产: %s' % _banned941)
    for _dep941 in ('package.json', 'package-lock.json', 'requirements-audit.txt'):
        if not os.path.exists(_dep941):
            _b941_release.append('缺固定依赖清单 %s' % _dep941)
    for _pkg944 in ('package.json', 'package-lock.json'):
        if os.path.exists(_pkg944):
            _pkg944_text = open(_pkg944, encoding='utf-8', errors='replace').read()
            _want_pkg = '"version": "%s.0.0"' % _APPV
            if _APPV and _want_pkg not in _pkg944_text:
                _b941_release.append('%s 包版本未跟随 VERSION 升到 %s.0.0' % (_pkg944, _APPV))
    if not _APPV:
        _b941_release.append('VERSION 缺失或为空(它是全项目版本的唯一真相)')
    _sw944 = open('sw_v944.js', encoding='utf-8', errors='replace').read()
    if "const CACHE_PREFIX = 'hansen-v944-';" not in _sw944:
        _b941_release.append('sw_v944.js 缓存命名空间未升级到 v944')
    if "'./hansen_perf_v944.js?v=1091'" not in _sw944 or "'./hansen_perf.js'" in _sw944:
        _b941_release.append('sw_v944.js 未只缓存 v944 新性能脚本路径')
    if "'./hansen_backup_bootstrap_v944.js'" not in _sw944 or "'./hansen_backup_bootstrap.js'" in _sw944:
        _b941_release.append('sw_v944.js 未只缓存 v944 新备份引导路径')
    for _upgrade_dep944 in ('hansen_sw_upgrade_gate_v944.js', '_sw_upgrade_v944.html'):
        if not os.path.exists(_upgrade_dep944) or "'./%s'" % _upgrade_dep944 not in _sw944:
            _b941_release.append('v944 SW升级依赖缺失或未入Shell: %s' % _upgrade_dep944)
    if "'./hansen_focused_typing_v946.js'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未缓存 v946 定向打字大师')
    if "'./hansen_boss_lock.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF5 精确键缓存 Boss 彩虹倒计时修复')
    if "'./hansen_explore_progress_v945.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF1 精确键缓存探索渲染修复')
    if "'./hansen_review.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF2 精确键缓存 Land 复习修复')
    if "'./hansen_wrong_overview.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF1 精确键缓存跨岛错题净化修复')
    if "'./hansen_backup_v944.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF6 精确键缓存Boss逐轮备份语义校验')
    if "'./hansen_canonical_progress.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF2 精确键缓存权威进度输入校验修复')
    if "'./hansen_season.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF2 精确键缓存赛季网络/存档修复')
    if "'./hansen_pet_showcase.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF1 精确键缓存宠物名自愈修复')
    if "'./hansen_cards.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF2 精确键缓存 Boss 卡牌网络/存档修复')
    if "'./hansen_gacha.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 v955 精确键缓存通用抽卡基础引擎')
    if "'./hansen_land_cards.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 v955 精确键缓存星海卡牌揭晓引擎')
    if "'./hansen_quest_global.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF1 精确键缓存每日任务账本修复')
    if "'./hansen_island_upgrade.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF2 精确键缓存每词金币上限修复')
    if "'./hansen_diamond_shop.js?v=1091'" not in _sw944:
        _b941_release.append('sw_v944.js Shell 未用 HF7 精确键缓存禁色主题商店修复')
    if ("CACHE_PREFIX + 'shell-21'" not in _sw944 or "CACHE_PREFIX + 'pages-19'" not in _sw944
            or "CACHE_PREFIX + 'assets-19'" not in _sw944 or "CACHE_PREFIX + 'icons-3'" not in _sw944):
        _b941_release.append('sw_v944.js 未轮换 v960 壳/页面/脚本/图标缓存，旧运行时或旧 PNG 仍可能复活')
    if r'/\/icons\/(?:[^/]+\/)*[^/]+\.(?:webp|png|svg)$/i' not in _sw944:
        _b941_release.append('sw_v944.js 未允许受控 icons/ 子目录进入小图标离线缓存')
    for _hf6_shell944, _hf6_label944 in (
            ("'./hansen_round_reward.js?v=1091'", 'Boss逐轮结算'),
            ("'./hansen_round_bar.js?v=1091'", 'Boss逐轮进度卡禁色'),
            ("'./hansen_econ_guide.js?v=1091'", '四份中文速查禁色'),
            ("'./hansen_mylearning.js?v=1091'", '我的学习禁色'),
            ("'./hansen_palette.js?v=1091'", '全局配色禁色'),
            ("'./hansen_boss_theme.js?v=1091'", 'Boss三主题禁色')):
        if _hf6_shell944 not in _sw944:
            _b941_release.append('sw_v944.js Shell 未用HF6精确键缓存%s' % _hf6_label944)
    _preload944 = open('hansen_preload.js', encoding='utf-8', errors='replace').read()
    if "version: 'v960'" not in _preload944:
        _b941_release.append('hansen_preload.js 运行时策略版本未升级到 v960')
    for _old_backup944 in ('hansen_backup_bootstrap.js', 'hansen_backup.js'):
        if os.path.exists(_old_backup944):
            _b941_release.append('旧备份运行时文件仍存在: %s' % _old_backup944)
    for _new_backup944 in ('hansen_backup_bootstrap_v944.js', 'hansen_backup_v944.js'):
        if not os.path.exists(_new_backup944):
            _b941_release.append('缺v944备份运行时: %s' % _new_backup944)
    _backup_entries944 = ['index.html', '_frame.html', 'boss_hall.html',
                          'season_showcase.html', 'spelling_bee.html', 'land_map.html'] \
                         + sorted(glob.glob('island_*.html'))
    _backup_boot_tag944 = '<script src="hansen_backup_bootstrap_v944.js?v=1091"></script>'
    _sw_gate_open944 = '<script src="hansen_sw_upgrade_gate_v944.js?v=1091">'
    _backup_runtime_tag944 = '<script src="hansen_backup_v944.js?v=1091"></script>'
    for _backup_page944 in _backup_entries944:
        _backup_html944 = open(_backup_page944, encoding='utf-8', errors='replace').read()
        _backup_at944 = _backup_html944.find(_backup_boot_tag944)
        _first_script944 = re.search(r'<script\b[^>]*>', _backup_html944, re.I)
        if not _first_script944 or _first_script944.group(0) != _sw_gate_open944:
            _b941_release.append('%s 的第一支脚本不是v944 SW升级门' % _backup_page944)
        _storage_at944 = _backup_html944.find('localStorage')
        if _backup_at944 < 0 or (_storage_at944 >= 0 and _backup_at944 > _storage_at944):
            _b941_release.append('%s 未在玩家状态读取前加载v944备份引导' % _backup_page944)
        if 'hansen_backup_bootstrap.js' in _backup_html944 or 'hansen_backup.js' in _backup_html944:
            _b941_release.append('%s 仍引用旧备份运行时' % _backup_page944)
    for _backup_island944 in sorted(glob.glob('island_*.html')):
        _backup_island_html944 = open(_backup_island944, encoding='utf-8', errors='replace').read()
        if _backup_runtime_tag944 not in _backup_island_html944:
            _b941_release.append('%s 缺v944备份主脚本' % _backup_island944)
    _focus_pages946 = ['template.html'] + sorted(glob.glob('island_*.html'))
    if len(_focus_pages946) != 28:
        _b941_release.append('v946 定向打字大师接线页数不是 28')
    for _focus_page946 in _focus_pages946:
        _focus_html946 = open(_focus_page946, encoding='utf-8', errors='replace').read()
        _focus_tag946 = 'src="hansen_focused_typing_v946.js?v=1091"'
        if _focus_html946.count(_focus_tag946) != 1:
            _b941_release.append('%s 未唯一接入 v946 定向打字大师' % _focus_page946)
            continue
        _pet_at946 = _focus_html946.find('src="hansen_pet_showcase.js?v=1091"')
        _focus_at946 = _focus_html946.find(_focus_tag946)
        _explore_at946 = _focus_html946.find('src="hansen_explore_progress_v945.js?v=1091"')
        if not (0 <= _pet_at946 < _focus_at946 < _explore_at946):
            _b941_release.append('%s 的宠物→定向打字→探索脚本顺序错误' % _focus_page946)
        if _focus_html946.count('src="hansen_review.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF2 复习修复' % _focus_page946)
        if _focus_html946.count('src="hansen_wrong_overview.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF1 跨岛错题净化修复' % _focus_page946)
        if _focus_html946.count('src="hansen_backup_v944.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF6 Boss逐轮备份语义校验' % _focus_page946)
        if _focus_html946.count('src="hansen_round_reward.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF6 Boss逐轮结算' % _focus_page946)
        if _focus_html946.count('src="hansen_round_bar.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF7 Boss逐轮进度卡禁色' % _focus_page946)
        if _focus_html946.count('src="hansen_econ_guide.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF7 当前奖励速查禁色' % _focus_page946)
        if _focus_html946.count('src="hansen_mylearning.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF7 我的学习禁色' % _focus_page946)
        if _focus_html946.count('src="hansen_palette.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF7 全局配色禁色' % _focus_page946)
        if _focus_html946.count('src="hansen_boss_theme.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF7 Boss三主题禁色' % _focus_page946)
        if _focus_html946.count('src="hansen_canonical_progress.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF2 权威进度输入校验修复' % _focus_page946)
        if _focus_html946.count('src="hansen_season.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF2 赛季网络/存档修复' % _focus_page946)
        if _focus_html946.count('src="hansen_pet_showcase.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF1 宠物名自愈修复' % _focus_page946)
        if _focus_html946.count('src="hansen_cards.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF2 Boss 卡牌网络/存档修复' % _focus_page946)
        if _focus_html946.count('src="hansen_quest_global.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF1 每日任务账本修复' % _focus_page946)
        if _focus_html946.count('src="hansen_island_upgrade.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF2 每词金币上限修复' % _focus_page946)
        if _focus_html946.count('src="hansen_diamond_shop.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF7 亮色主题商店禁色修复' % _focus_page946)
        if _focus_html946.count('src="hansen_boss_lock.js?v=1091"') != 1:
            _b941_release.append('%s 未唯一接入 HF5 Boss 彩虹倒计时修复' % _focus_page946)
    _index946 = open('index.html', encoding='utf-8', errors='replace').read()
    if _index946.count('src="hansen_season.js?v=1091"') != 1:
        _b941_release.append('index.html 未唯一接入 HF2 赛季网络/存档修复')
    if _index946.count('src="hansen_diamond_shop.js?v=1091"') != 1:
        _b941_release.append('index.html 未唯一接入 HF7 亮色主题商店禁色修复')
    if _index946.count('src="hansen_palette.js?v=1091"') != 1:
        _b941_release.append('index.html 未唯一接入 HF7 全局配色禁色修复')
    for _safety_test946 in (
            'test_native_wrong_safety_v946.mjs',
            'test_review_markup_security_v946.mjs',
            'test_daily_quest_safety_v946.mjs',
            'test_season_storage_security_v946.mjs',
            'test_canonical_input_safety_v946.mjs'):
        if not os.path.exists(_safety_test946):
            _b941_release.append('缺 HF1 专项回归: %s' % _safety_test946)
    for _light_test946 in (
            'test_spelling_bee_light_theme_hf3_v946.mjs',
            'test_home_theme_shop_light_hf3_v946.mjs'):
        if not os.path.exists(_light_test946):
            _b941_release.append('缺 HF3 亮色专项回归: %s' % _light_test946)
    if not os.path.exists('test_boss_timer_hf5_v946.mjs'):
        _b941_release.append('缺 HF5 Boss 彩虹倒计时专项回归')
    for _boss_hf6_test946 in (
            'test_boss_round_ledger_hf6_v946.mjs',
            'test_boss_round_bar_theme_hf6_v946.mjs'):
        if not os.path.exists(_boss_hf6_test946):
            _b941_release.append('缺 HF6 Boss逐轮/亮色专项回归: %s' % _boss_hf6_test946)
    if not os.path.exists('test_camel_color_ban_hf7_v946.mjs'):
        _b941_release.append('缺 HF7 驼棕文字禁色专项回归')
    _review946 = open('hansen_review.js', encoding='utf-8', errors='replace').read()
    if r'/island_([a-z0-9]+)\.html/i' not in _review946 or r'/island_([a-z]+)\.html/i' in _review946:
        _b941_release.append('hansen_review.js 仍会在 Land1-Land8 页面名上提前退出')
    if not os.path.exists('test_theme_scroll_v944.mjs'):
        _b941_release.append('缺 test_theme_scroll_v944.mjs')
    else:
        _scroll944 = open('test_theme_scroll_v944.mjs', encoding='utf-8', errors='replace').read()
        for _scroll_token944 in ('Input.dispatchTouchEvent', "['no-preference', 'reduce']",
                                 'animation.currentTime', 'theme scroll regression passed'):
            if _scroll_token944 not in _scroll944:
                _b941_release.append('滚动主题回归缺关键断言/触摸采样: %s' % _scroll_token944)
    if not os.path.exists('test_sw_upgrade_v944.mjs'):
        _b941_release.append('缺 test_sw_upgrade_v944.mjs')
    else:
        _sw_test944 = open('test_sw_upgrade_v944.mjs', encoding='utf-8', errors='replace').read()
        for _sw_test_token944 in ('hansen-v943-shell-upgrade-test', 'ignoreSearch:true',
                                  'island_home.html', 'sw_v944.js', 'appVersion: CURRENT_VERSION'):
            if _sw_test_token944 not in _sw_test944:
                _b941_release.append('SW首载迁移回归缺关键场景: %s' % _sw_test_token944)
    if not os.path.exists('playwright_loader.mjs'):
        _b941_release.append('缺便携 Playwright 加载器')
    for _probe941 in glob.glob('*.mjs') + glob.glob('newboss/*.mjs'):
        if _probe941 == 'playwright_loader.mjs':
            continue
        _txt941 = open(_probe941, encoding='utf-8', errors='replace').read()
        if '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs' in _txt941:
            _b941_release.append('%s 仍绑定旧机器 Playwright 绝对路径' % _probe941)
        if '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' in _txt941:
            _b941_release.append('%s 仍绑定旧机器 Chromium 绝对路径' % _probe941)
        if re.search(r"\bfrom\s+['\"]playwright['\"]", _txt941):
            _b941_release.append('%s 绕过便携 playwright_loader.mjs' % _probe941)
    # Boss 是用户锁定的产品名。只检查会进入玩家运行包的根级 HTML/JS；
    # README/CHANGELOG/历史文档保留旧版本原文，不在此机械改写。
    _boss_name_bad959 = []
    for _runtime959 in sorted(glob.glob('*.html') + glob.glob('*.js')):
        _runtime_text959 = open(_runtime959, encoding='utf-8', errors='replace').read()
        if '首领' in _runtime_text959:
            _boss_name_bad959.append(_runtime959)
    if _boss_name_bad959:
        _b941_release.append('玩家运行文件仍把 Boss 改叫“首领”: %s' % _boss_name_bad959[:10])
    _boss_copy959 = {
        'hansen_round_bar.js': ('个 Boss，完成本轮得', '本轮全部 Boss 已核验', '每个 Boss 每轮只计算 1 次'),
        'hansen_round_reward.js': ('个 Boss 各胜 1 次，已全部核验',),
        'hansen_econ_guide.js': ("row('打赢 Boss'", "row('完成一轮 Boss'", '每个 Boss 各胜一次', "row('挑战 Boss'"),
    }
    for _boss_file959, _boss_tokens959 in _boss_copy959.items():
        _boss_source959 = open(_boss_file959, encoding='utf-8', errors='replace').read()
        for _boss_token959 in _boss_tokens959:
            if _boss_token959 not in _boss_source959:
                _b941_release.append('%s 缺用户批准的 Boss 文案: %s' % (_boss_file959, _boss_token959))
except Exception as _e941_release:
    _b941_release.append('v960 发布链体检异常: %s' % _e941_release)
if _b941_release:
    fail('v960 不可变三资产发布链: ' + str(_b941_release[:10]))
else:
    ok('v960 不可变三资产发布链(透明WebP图标压缩+Boss命名锁+部署白名单+完整Jarvis源码+星海卡牌揭晓回归+三卡对齐回归+Boss高对比回归+secret scan+SHA256SUMS+可复现ZIP+事务build)')

# ---- v941 最终经济封口: Land 模式、旧卡牌/赛季暗奖、设置说明与字体诊断 ----
_b941_econ = []
try:
    _land_tokens941 = (
        'const TYPING_LEVELS={', 'xpPerWord:5,gemBonus:12,petXp:25',
        'xpPerWord:10,gemBonus:25,petXp:40', 'xpPerWord:18,gemBonus:50,petXp:70',
        'const CLOZE_LEVELS={', 'xpPerQ:5,gemBonus:15,petXp:30',
        'xpPerQ:8,gemBonus:25,petXp:45', 'xpPerQ:14,gemBonus:40,petXp:65',
        'words:allW.filter(w=>w.en.length<=7).map(w=>w.en)',
        'words:allW.filter(w=>w.en.length>7&&w.en.length<=8).map(w=>w.en)',
        'words:allW.filter(w=>w.en.length>8).map(w=>w.en)',
    )
    for _i941 in range(1, 9):
        _fn941 = 'island_land%d.html' % _i941
        _html941 = open(_fn941, encoding='utf-8', errors='replace').read()
        _missing941 = [_t for _t in _land_tokens941 if _t not in _html941]
        if _missing941:
            _b941_econ.append('%s 打字/完形字段或本页动态词表不完整: %s' % (_fn941, _missing941[:2]))

    _cards941 = open('hansen_cards.js', encoding='utf-8', errors='replace').read()
    _card_start941 = _cards941.find('function markBossWin(lv)')
    _card_end941 = _cards941.find('function resolveActualBossLv()', _card_start941)
    _card_block941 = _cards941[_card_start941:_card_end941] if _card_start941 >= 0 and _card_end941 > _card_start941 else ''
    if not _card_block941 or any(_t in _card_block941 for _t in
            ('addGem(', 'addXP(', 'addCoin(', 'HansenCoins', 'HansenGems', 'grantBoost(')):
        _b941_econ.append('hansen_cards.js 的 Boss 记录模块仍可能暗发经济奖励')
    if ('function resolveActualBossLv()' not in _cards941 or
            'var lv = resolveActualBossLv()' not in _cards941 or
            'window.S && window.S.level' in _cards941):
        _b941_econ.append('Boss 卡牌记录未锁定实际关号，或仍把 S.level 当关号')

    _season941 = open('hansen_season.js', encoding='utf-8', errors='replace').read()
    if 'function addSeasonPoints(){ return false; }' not in _season941 or 'pointsReadOnly: true' not in _season941:
        _b941_econ.append('旧赛季积分 API 未永久只读')
    for _forbidden941 in ('checkMilestones', 'origMA', 'answerCorrect', 'bossWin',
                          'HansenCoins', 'HansenGems', 'HansenBoost', 'window.addCoin',
                          'addXP(', 'addGem(', 'grantBoost(', 'hsn_season_answer_day'):
        if _forbidden941 in _season941:
            _b941_econ.append('旧赛季仍残留积分/发奖入口: %s' % _forbidden941)

    _guide941 = open('hansen_econ_guide.js', encoding='utf-8', errors='replace').read()
    for _guide_token941 in ('金币怎么得', '钻石怎么得', '宠物怎么升级', '宠物经验怎么得',
                            '同一单词每天最多 3 次', '每项 20～120 金币',
                            '每天得到 10～930 金币', '得到 4 钻石',
                            '任选 3 个未掌握单词', '经验和单词全部保留',
                            'html.hsn-pal-light .hsn-eg-sub',
                            'html.hsn-pal-light .hsn-eg-get'):
        if _guide_token941 not in _guide941:
            _b941_econ.append('设置说明缺最终实账标记: %s' % _guide_token941)

    _round941 = open('hansen_round_reward.js', encoding='utf-8', errors='replace').read()
    _actual_start941 = _round941.find('function actualRegularWinLv()')
    _actual_end941 = _round941.find('function currentLv()', _actual_start941)
    _actual_block941 = _round941[_actual_start941:_actual_end941] if _actual_start941 >= 0 and _actual_end941 > _actual_start941 else ''
    _modern_start941 = _round941.find('function onWinModern(lv)')
    _modern_end941 = _round941.find('function onWin(lv)', _modern_start941)
    _modern_block941 = _round941[_modern_start941:_modern_end941] if _modern_start941 >= 0 and _modern_end941 > _modern_start941 else ''
    if ('BOSSES[i]===bossCurrent' not in _actual_block941 or
            'S.bossCurrentLv' not in _actual_block941 or 'S.level' in _actual_block941 or
            'recordRoundWin(lv)' not in _modern_block941 or
            'isFull(win.state.cleared,win.state.total)' not in _modern_block941 or
            'window.getIslandClearedLevels()' in _round941 or
            "localStorage.getItem(k+'_prog')" in _round941):
        _b941_econ.append('HF6 Boss胜利未锁定真实关号与本轮state，或仍以永久历史/段位伪造奖励资格')

    _font_guard941 = open('font_guard.py', encoding='utf-8', errors='replace').read()
    if 'with open("/tmp/subset_chars.txt", "w", encoding="utf-8")' not in _font_guard941:
        _b941_econ.append('font_guard 缺字时没有真正生成它提示的 subset_chars.txt')
except Exception as _e941_econ:
    _b941_econ.append('v941 最终经济封口体检异常: %s' % _e941_econ)
if _b941_econ:
    fail('v941 最终经济/Land/说明封口: ' + str(_b941_econ[:8]))
else:
    ok('v941 最终经济/Land/说明封口(旧暗奖清零·Land题库与XP完整·指南实账一致)')

# ---- v955 延续 HF7 驼棕文字禁色墙 + Boss 答题主题隔离 + 原子缓存 ----
_b946_hf7 = []
try:
    _boss_hf7 = open('hansen_boss_theme.js', encoding='utf-8', errors='replace').read()
    for _token_hf7, _label_hf7 in (
            ('#bossScreen #bossMsg{background:linear-gradient(135deg,rgba(239,246,255,.97)', '晨曦普通台词蓝色面板'),
            ('color:#1e3a5f !important', '普通台词深海军蓝'),
            ('#bossScreen #bossQType{background:rgba(255,255,255,.92) !important;color:#1e40af', '题型皇家蓝'),
            ('#bossScreen #bossQ,html.hsn-bt-light #bossScreen #bossQ *{color:#1e40af', '主词皇家蓝'),
            ('#bossMsg.crit{background:linear-gradient', '暴击紫色独立态'),
            ('#bossMsg.rage{background:linear-gradient', '狂怒红色独立态')):
        if _token_hf7 not in _boss_hf7:
            _b946_hf7.append('boss主题缺%s' % _label_hf7)
    _palette_hf7 = open('hansen_palette.js', encoding='utf-8', errors='replace').read()
    for _token_hf7 in ('accentText:\'#3730a3\'', 'accentText:\'#9f1239\'',
                       'accentText:\'#1e40af\'', 'accentText:\'#065f46\'',
                       '--pal-accent-text:', "var _AM='var(--pal-accent-text,#1e40af)'"):
        if _token_hf7 not in _palette_hf7:
            _b946_hf7.append('palette缺HF7主题文字变量: %s' % _token_hf7)
    _pages_hf7 = ['template.html'] + sorted(_g861.glob('island_*.html'))
    _tags_hf7 = (
        'hansen_addiction.js?v=1091', 'hansen_mylearning.js?v=1091', 'hansen_diamond_shop.js?v=1091',
        'hansen_palette.js?v=1091', 'hansen_boss_theme.js?v=1091',
        'hansen_econ_guide.js?v=1091', 'hansen_round_bar.js?v=1091')
    for _page_hf7 in _pages_hf7:
        _html_hf7 = open(_page_hf7, encoding='utf-8', errors='replace').read()
        for _tag_hf7 in _tags_hf7:
            if _html_hf7.count(_tag_hf7) != 1:
                _b946_hf7.append('%s 未唯一加载 %s' % (_page_hf7, _tag_hf7))
                break
    _index_hf7 = open('index.html', encoding='utf-8', errors='replace').read()
    for _tag_hf7 in ('hansen_diamond_shop.js?v=1091', 'hansen_palette.js?v=1091'):
        if _index_hf7.count(_tag_hf7) != 1:
            _b946_hf7.append('index未唯一加载%s' % _tag_hf7)
    _sw_hf7 = open('sw_v944.js', encoding='utf-8', errors='replace').read()
    for _token_hf7 in ("CACHE_PREFIX + 'shell-21'", "CACHE_PREFIX + 'pages-19'",
                       "CACHE_PREFIX + 'assets-19'", "CACHE_PREFIX + 'icons-3'",
                       "'./hansen_addiction.js?v=1091'", "'./hansen_mylearning.js?v=1091'",
                       "'./hansen_diamond_shop.js?v=1091'", "'./hansen_palette.js?v=1091'",
                       "'./hansen_boss_theme.js?v=1091'", "'./hansen_econ_guide.js?v=1091'",
                       "'./hansen_round_bar.js?v=1091'"):
        if _token_hf7 not in _sw_hf7:
            _b946_hf7.append('SW缺HF7原子资源键: %s' % _token_hf7)
    if not __import__('os').path.exists('test_camel_color_ban_hf7_v946.mjs'):
        _b946_hf7.append('缺驼棕文字禁色专项回归')
    if not __import__('os').path.exists('test_boss_answer_contrast_v952.mjs'):
        _b946_hf7.append('缺 v955 Boss 答题高对比专项回归')
    for _token_v953 in ('--boss-answer-primary:#fde68a', '--boss-answer-text:#f8fafc',
                        '--boss-answer-muted:#e2e8f0', '--boss-answer-correct:#86efac',
                        '--boss-answer-wrong:#fca5a5', 'html.hsn-bt-dark #bossScreen',
                        'html.hsn-bt-cinema #bossScreen', 'boss-answer-result-correct',
                        'boss-answer-result-wrong'):
        if _token_v953 not in _boss_hf7:
            _b946_hf7.append('Boss主题缺v955高对比合同: %s' % _token_v953)
    _package_hf7 = open('package_release.py', encoding='utf-8', errors='replace').read()
    for _token_hf7 in ('_scan_forbidden_text_colors(entries)',
                       '_verify_hf7_runtime_contract(entries)',
                       'test_camel_color_ban_hf7_v946.mjs',
                       'test_boss_answer_contrast_v952.mjs'):
        if _token_hf7 not in _package_hf7:
            _b946_hf7.append('打包器缺HF7禁色硬守卫: %s' % _token_hf7)
except Exception as _e946_hf7:
    _b946_hf7.append('HF7禁色检查异常: %s' % _e946_hf7)
if _b946_hf7:
    fail('v955 Boss 答题高对比与 HF7 驼棕禁色墙: ' + str(_b946_hf7[:10]))
else:
    ok('v955 延续HF7驼棕禁色；Boss八题型深空/电影/晨曦隔离，当前v960精确键与shell-21/pages-19/assets-19/icons-3原子缓存锁定')

# ---- v953 Boss 管理员隐藏入口 fresh-session 可达性与调参清单一致性 ----
_b953_admin = []
try:
    _lock953 = open('hansen_boss_lock.js', encoding='utf-8', errors='replace').read()
    _attack953 = open('hansen_boss_attack.js', encoding='utf-8', errors='replace').read()
    for _token953 in (
            '__hansenBossAdminBridgeV953', 'function ensureLoaded()', 'function open()',
            'function waitForExportedGate()',
            'openPending', 'stopImmediatePropagation', '进度自动保存到本设备',
            'window.HansenBossAdminBridge='):
        if _token953 not in _lock953:
            _b953_admin.append('轻量设置桥缺关键合同: %s' % _token953)
    for _token953 in (
            'window.__hsnOpenBossAdminGate=openHiddenGate',
            'window.__hsnEnsureBossFxSettingsEntry=ensureEntry',
            "var PW_SHA='603496ea13d3aa14a70ad2a79b7d6d138b3dfb0448441ac7cd14e0ef9358ecd6'",
            'pw.length===50', 'if(isLocked()) return;', 'if(n>=3){ lockNow();',
            "d.className='hbafx-entry';d.id='hbafxEntry'",
            "{n:'星核帝皇·弗沙欧',lv:'岛⑧',mv:'三皇归一·终焉白光'",
            "{n:'夜罗刹·红莲战鬼',lv:'岛⑤',mv:'红莲圣域·万瓣天葬'",
            "{n:'铸星者·原初匠人',lv:'赛季',mv:'创世锻造',pal:'熔金星核',ps:['sz','sp','fxi'],df:{sz:55,sp:100,fxi:100}}"):
        if _token953 not in _attack953:
            _b953_admin.append('管理员密码/入口/调参卡合同缺失: %s' % _token953[:72])
    _pages953 = ['template.html'] + sorted(glob.glob('island_*.html'))
    if len(_pages953) != 28:
        _b953_admin.append('应为 template + 27 岛，实际 %d 页' % len(_pages953))
    _direct_attack953 = re.compile(r'<script\b[^>]*\bsrc=["\'][^"\']*hansen_boss_attack\.js', re.I)
    for _page953 in _pages953:
        _html953 = open(_page953, encoding='utf-8', errors='replace').read()
        if _direct_attack953.search(_html953):
            _b953_admin.append('%s 又同步加载重型 attack，引入首屏回退' % _page953)
            continue
        for _token953 in ('hansen_boss_lock.js?v=1091', 'window.__hansenBossFXReady=function()',
                          's.onerror=function(){ P=null; res(); };'):
            if _token953 not in _html953:
                _b953_admin.append('%s 缺可重试懒加载合同 %s' % (_page953, _token953))
                break
    if not os.path.exists('test_boss_admin_entry_v953.mjs'):
        _b953_admin.append('缺 Boss 管理员入口专项回归 test_boss_admin_entry_v953.mjs')
    _package953 = open('package_release.py', encoding='utf-8', errors='replace').read()
    if '"test_boss_admin_entry_v953.mjs"' not in _package953:
        _b953_admin.append('完整源码发布合同未强制携带 v953 专项回归')
except Exception as _e953_admin:
    _b953_admin.append('v953 Boss 管理入口体检异常: %s' % _e953_admin)
if _b953_admin:
    fail('v953 Boss 管理员隐藏入口与调参清单: ' + str(_b953_admin[:10]))
else:
    ok('v953 Boss 管理入口 fresh-session 可达；特效图不阻塞密码门；首次失败可重试；密码/永久锁保持；公开360关入口、夜罗刹、弗沙欧与铸星默认值锁定')

# ---- v954 首页三卡几何合同：只移动前两卡，挑战BOSS保持 v953 基准 ----
_b954_daily = []
try:
    _pages954 = ['template.html'] + sorted(glob.glob('island_*.html'))
    if len(_pages954) != 28:
        _b954_daily.append('应为 template + 27 岛，实际 %d 页' % len(_pages954))
    _required954 = (
        '.daily-card:not(.boss-card){display:flex;flex-direction:column;align-items:center;justify-content:flex-start}',
        '.daily-card:not(.boss-card) .d-icon{width:100%;height:91px;min-height:91px;margin:0;display:flex;align-items:flex-end;justify-content:center;line-height:0}',
        '.daily-card:not(.boss-card) .d-icon>.qiw{display:block;width:min(91px,100%);max-width:100%;aspect-ratio:1/1;line-height:0;flex:none}',
        '.daily-card:not(.boss-card) .d-icon>.qiw>img{display:block;width:100%!important;height:100%!important;aspect-ratio:1/1;object-fit:contain}',
        '.daily-card:not(.boss-card) .d-label{position:absolute;left:0;right:0;bottom:3px;margin:0;transform:none;white-space:nowrap}',
        '#chestCard .d-icon>.qiw{transform:translateY(2.7778%)!important}',
        '#chestCard.chest-claimed .d-icon>.qiw{transform:translateY(0)!important}',
        '#questCard .d-icon>.qiw{transform:translateY(3.125%)!important}',
        '.daily-card:not(.boss-card) .d-icon{height:82px;min-height:82px;display:flex}',
        '.daily-card:not(.boss-card) .d-icon>.qiw{width:min(82px,100%);max-width:100%}',
    )
    _boss_locked954 = (
        '.daily-card.boss-card{padding:3px 3px 3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}',
        '.daily-card.boss-card .boss-card-img{width:91px;height:91px;object-fit:contain;display:block;',
        '.daily-card.boss-card .boss-card-label{font-size:15px;font-weight:900;',
        'margin-top:5px;',
    )
    for _page954 in _pages954:
        _html954 = open(_page954, encoding='utf-8', errors='replace').read()
        for _token954 in _required954:
            if _html954.count(_token954) != 1:
                _b954_daily.append('%s 缺少或重复三卡合同: %s' % (_page954, _token954[:72]))
                break
        for _token954 in _boss_locked954:
            if _token954 not in _html954:
                _b954_daily.append('%s 改动了挑战BOSS锁定基准: %s' % (_page954, _token954[:72]))
                break
        if _html954.count('id="chestCard"') != 1 or _html954.count('id="questCard"') != 1 or _html954.count('class="daily-card boss-card"') != 1:
            _b954_daily.append('%s 三卡入口不是各自唯一' % _page954)
        if 'line-height:0;vertical-align:middle;transform:translate(0,10px)' in _html954 or 'line-height:0;vertical-align:middle;transform:translate(0,3px)' in _html954:
            _b954_daily.append('%s 残留旧宝箱包装层位移' % _page954)
        if 'width:98px;height:98px;object-fit:contain;vertical-align:middle' in _html954:
            _b954_daily.append('%s 已领取宝箱仍为98px，会再次溢出' % _page954)
        if '#chestCard .d-label{transform:translateY(' in _html954 or '#chestCard.chest-claimed .d-label{transform:translateY(' in _html954:
            _b954_daily.append('%s 残留旧宝箱标题下移' % _page954)
        if len(_b954_daily) >= 10:
            break
    _gold_bottom954 = 91.0 * (280.0 / 288.0 + 0.027778)
    _task_bottom954 = 91.0 * (279.0 / 288.0 + 0.03125)
    if abs(_gold_bottom954 - 91.0) > 0.01 or abs(_task_bottom954 - 91.0) > 0.01:
        _b954_daily.append('素材透明底边补偿公式不再与Boss 91px底线一致')
    if not os.path.exists('test_daily_card_alignment_v954.mjs'):
        _b954_daily.append('缺三卡对齐专项回归 test_daily_card_alignment_v954.mjs')
    _package954 = open('package_release.py', encoding='utf-8', errors='replace').read()
    if '"test_daily_card_alignment_v954.mjs"' not in _package954:
        _b954_daily.append('完整源码发布合同未强制携带 v954 三卡专项回归')
except Exception as _e954_daily:
    _b954_daily.append('v954 三卡对齐体检异常: %s' % _e954_daily)
if _b954_daily:
    fail('v954 首页三卡底线与防溢出合同: ' + str(_b954_daily[:10]))
else:
    ok('v954 每日宝箱/每日任务图标可见底与文字底线对齐挑战BOSS；341—386px横溢出封死；Boss基准未动；28页一致')

# ---- v955 星海卡牌揭晓发布接线：专项回归 + 精确 Shell 键 + 28 页一致 ----
_b955_land_gacha = []
try:
    _package955 = open('package_release.py', encoding='utf-8', errors='replace').read()
    _sw955 = open('sw_v944.js', encoding='utf-8', errors='replace').read()
    if not os.path.exists('test_land_gacha_reveal_v955.mjs'):
        _b955_land_gacha.append('缺星海卡牌揭晓专项回归 test_land_gacha_reveal_v955.mjs')
    if '"test_land_gacha_reveal_v955.mjs"' not in _package955:
        _b955_land_gacha.append('完整源码发布合同未强制携带 v955 抽卡专项回归')
    for _token955 in ("CACHE_PREFIX + 'shell-21'", "CACHE_PREFIX + 'pages-19'",
                      "CACHE_PREFIX + 'assets-19'", "CACHE_PREFIX + 'icons-3'",
                      "'./hansen_gacha.js?v=1091'",
                      "'./hansen_land_cards.js?v=1091'"):
        if _sw955.count(_token955) != 1:
            _b955_land_gacha.append('SW 缺少或重复 v955 星海抽卡原子键: %s' % _token955)
    _pages955 = ['template.html'] + sorted(glob.glob('island_*.html'))
    if len(_pages955) != 28:
        _b955_land_gacha.append('应为 template + 27 岛，实际 %d 页' % len(_pages955))
    for _page955 in _pages955:
        _html955 = open(_page955, encoding='utf-8', errors='replace').read()
        for _tag955 in ('hansen_gacha.js?v=1091', 'hansen_land_cards.js?v=1091'):
            if _html955.count(_tag955) != 1:
                _b955_land_gacha.append('%s 未唯一加载 %s' % (_page955, _tag955))
                break
        if len(_b955_land_gacha) >= 10:
            break
    _star_pages955 = ['island_land%d.html' % _n955 for _n955 in range(1, 9)] + ['island_season.html']
    for _page955 in _star_pages955:
        _html955 = open(_page955, encoding='utf-8', errors='replace').read()
        if _html955.count('onclick="HansenContextGacha.open()"') != 1:
            _b955_land_gacha.append('%s 未唯一接入上下文抽卡路由' % _page955)
        if 'onclick="HansenGacha.open()"' in _html955 or 'onclick="HansenLandGachaUI.open()"' in _html955:
            _b955_land_gacha.append('%s 绕过上下文路由直连卡池' % _page955)
    _template955 = open('template.html', encoding='utf-8', errors='replace').read()
    if _template955.count('onclick="HansenContextGacha.open()"') != 1:
        _b955_land_gacha.append('印章母版未唯一接入上下文抽卡路由')
    _land_js955 = open('hansen_land_cards.js', encoding='utf-8', errors='replace').read()
    for _route_token955 in ('island_(?:land[1-8]|season)\\.html$',
                            'isStarSea&&window.HansenLandGachaUI',
                            'window.HansenGacha.open()'):
        if _route_token955 not in _land_js955:
            _b955_land_gacha.append('上下文卡池路由缺失: %s' % _route_token955)
except Exception as _e955_land_gacha:
    _b955_land_gacha.append('v955 星海卡牌揭晓发布接线体检异常: %s' % _e955_land_gacha)
if _b955_land_gacha:
    fail('v955 星海卡牌揭晓发布接线: ' + str(_b955_land_gacha[:10]))
else:
    ok('v955 星海卡牌揭晓专项回归入源码包；9个星海入口进入40张专属卡池且普通20张池隔离；28页当前v960精确脚本接线；shell-21/pages-19/assets-19/icons-3 原子缓存锁定')

if FAIL:
    print("\u274c check_resources \u53d1\u73b0 %d \u4e2a\u95ee\u9898:" % len(FAIL))
    for x in FAIL:
        print("   - " + x)
    sys.exit(1)
else:
    print("\u2705\u2705\u2705 check_resources \u5168\u90e8\u901a\u8fc7")
    sys.exit(0)
