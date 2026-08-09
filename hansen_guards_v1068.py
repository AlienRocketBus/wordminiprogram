#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hansen_guards_v1068.py —— 贾维斯 · 新时代守卫（v1000+ 教训）

为什么需要这一档
================
贾维斯的知识库（贾维斯_知识库.md）记到 BUG #110、版本停在 v999 之前，
而项目已经走到 v1068。也就是说：

  · 它每次启动都尽职地重跑 v700–v900 时代那批守卫；
  · 而近期真正吃掉最多时间的 bug —— 跨设备存档空转 40 版、
    白领奖励漏洞、Land 页被漏 4 次、SDK 被查询串劈成两份 ——
    **它一道守卫都没有。**

这些 bug 有个共同点：**它们不是某一行写错，而是同一种病反复发作。**
本项目至今已在六个地方踩到「手工维护的东西必然走散」：

  ① 备份模块内嵌了一份任务配置副本（v1019 才拆）
  ② 成就清单有两份，页面用的是旧的 36 条（v1034）
  ③ 发音音量各处各设（v1038）
  ④ 存档地址算法三处各写，修的时候漏了第三处（v1046）
  ⑤ 页面模块接线靠手工清单，Land 页连漏四次（v1063）
  ⑥ bump_version 的文件清单是手工的，spelling_pk 从没登记过（v1063）
  ⑦ check_resources 自己写死 68 处 ?v=960，从 v961 起报了 106 版假警（v1067）

所以本档守卫**只盯模式，不盯具体某一行**——
它们检查的是「有没有又出现两处真源」「有没有又写死一个会漂移的常量」。

设计约束
========
· 每条守卫都必须能指出**具体文件/位置**，不许只说"有问题"；
· 每条守卫都对应一次真实事故，注释里写明是哪一次、代价多大；
· 不做无法验证的推断——查不出来就明说查不出来，绝不假绿。

退出码：0 = 全通过；1 = 有问题（贾维斯据此拦下打包）。
"""
import os
import time, re, sys, glob, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))


def _read(name):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        return ''
    return open(p, encoding='utf-8', errors='replace').read()


def _code_only(text):
    """只看代码，不看注释——本仓注释里大量引用旧代码原文，
       不剥注释会让守卫对着散文下结论（v1059 就吃过这个亏）。"""
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    text = re.sub(r'<!--[\s\S]*?-->', '', text)
    text = re.sub(r'^\s*//.*$', '', text, flags=re.M)
    return text


def _appv():
    try:
        return open(os.path.join(ROOT, 'VERSION'), encoding='utf-8').read().strip()
    except Exception:
        return ''


PROBLEMS = []


def bad(guard, detail):
    PROBLEMS.append((guard, detail))


# ─────────────────────────────────────────────────────────────
# 守卫 ①：登录状态只能有一个真源
#   事故：v1017–v1058，跨设备存档空转 40 版。
#   verifySession() 真去问云端，却**只接在诊断面板上显示给人看**；
#   isSignedIn() 只翻 localStorage，却被 8 处决定点采用。
#   会话过期后界面照旧显示"已登录 +86 186xxxx"，云端每次读写都失败。
# ─────────────────────────────────────────────────────────────
def guard_single_session_truth():
    save = _code_only(_read('hansen_cloud_save_v965.js'))
    if not save:
        return
    i_app = save.find('_app: function')
    if i_app < 0:
        return
    body = save[i_app:save.find('put: function', i_app)]
    # ⚠️ 只查标识符出现过是**查不住**的：条件里的
    #    `typeof A.ensureSession === 'function'` 同样会命中，
    #    于是把真正的调用换成 Promise.resolve({ok:true}) 也能蒙混过关。
    #    （本守卫第一版就是这么被注入测试戳穿的。）
    #    必须查它**被真正调用**：A.ensureSession(...) 带括号的调用形态。
    invoked = [m.start() for m in re.finditer(r'\bA\.ensureSession\s*\(', body)]
    calls = [m.start() for m in re.finditer(r'A\._app\(\)', body)]
    if not invoked:
        bad('单一真源·登录态', '云存档 _app() 未真正调用 A.ensureSession() —— '
            '会退回只读 localStorage 的 isSignedIn()，正是 v1017–v1058 空转 40 版的根因')
        return
    gate = min(invoked)
    if any(c < gate for c in calls):
        bad('单一真源·登录态', '存在绕过 ensureSession() 直接取账号实例的路径')


# ─────────────────────────────────────────────────────────────
# 守卫 ②：错误必须说人话
#   事故：CloudBase 抛的是普通对象（无 .message、非 Error），
#   所有 `'…：' + err` 拼接一律退化成 [object Object]，
#   把真错因 credentials not found 盖了 40 版——
#   每一轮排查都只能靠推理，这才是那条线拖这么久的真正原因。
# ─────────────────────────────────────────────────────────────
def guard_error_visibility():
    auth = _code_only(_read('hansen_auth_v1004.js'))
    if auth and 'errText' not in auth:
        bad('错误可见性', 'hansen_auth 未提供 errText()，错误会退化成 [object Object]')
    for fn in ('hansen_cloud_diag_v1027.js', 'hansen_cloud_restore_v1048.js',
               'hansen_pk_room_v1065.js'):
        code = _code_only(_read(fn))
        if not code:
            continue
        # 直接把疑似错误对象拼进字符串 = 危险
        if re.search(r"\+\s*\(?\s*(?:r\.error|e\.reason|i\.reason)\s*\|\|", code):
            bad('错误可见性', '%s 存在直接拼接错误对象的出口（会吐 [object Object]）' % fn)
        if not re.search(r'HBErrText|errText|EText|\bE\(', code):
            bad('错误可见性', '%s 未走统一错误文本出口' % fn)


# ─────────────────────────────────────────────────────────────
# 守卫 ③：云端 SDK 全仓只能有一个 URL
#   事故：v1059。hansen_cloud_save 用 `...?v=1058`、hansen_auth 用裸路径。
#   浏览器 ES module 缓存按**完整 URL（含 ?）**算——多一个问号
#   就是两份独立 SDK、两套凭证互不可见。
#   而 ?v= 是 bump_version 自动盖的，等于每升一版重造一次分裂。
# ─────────────────────────────────────────────────────────────
def guard_single_sdk_instance():
    urls = set()
    for fn in glob.glob(os.path.join(ROOT, '*.js')):
        if os.path.basename(fn).startswith('test_'):
            continue
        code = _code_only(open(fn, encoding='utf-8', errors='replace').read())
        for m in re.finditer(r"import\(\s*['\"](\./vendor_cloudbase_esm[^'\"]*)['\"]\s*\)", code):
            urls.add(m.group(1))
    if len(urls) > 1:
        bad('SDK 单实例', '全仓存在多个云端 SDK import URL：%s —— '
            '多一个查询串就是两份独立 SDK、两套凭证' % sorted(urls))
    for u in urls:
        if '?' in u:
            bad('SDK 单实例', 'SDK import 带查询串 %s（会被浏览器当成另一个模块）' % u)
        f = os.path.join(ROOT, u.replace('./', '').split('?')[0])
        if not os.path.exists(f):
            bad('SDK 单实例', 'import 了不存在的 SDK 文件 %s（v1057：手机注册坏了 50 多版）' % u)


# ─────────────────────────────────────────────────────────────
# 守卫 ④：页面模块接线（自动枚举，拒绝手工清单）
#   事故：v1063。8 个 Land 页手工维护、不由 generate.py 分发，
#   v1021 账号接线 / v1030 门槛 / v1038 音量 / v1048 云恢复 **四次全漏**。
#   实测：island_land1 的存档密钥是设备随机的，换设备永远找不回。
#   而当时的测试只查两个页面，所以一直是绿灯。
# ─────────────────────────────────────────────────────────────
def guard_page_wiring():
    skip = {'_sw_upgrade_v944.html', '_vgprev.html'}
    pages = [os.path.basename(p) for p in glob.glob(os.path.join(ROOT, '*.html'))]
    pages = [n for n in pages if n not in skip and not n.startswith('武器')]
    for n in sorted(pages):
        code = _code_only(_read(n))
        has = lambda m: m in code
        if has('hansen_cloud_save'):
            if not has('hansen_auth_v1004'):
                bad('页面接线', '%s 有云存档却无账号模块 —— '
                    'ensureKey() 会退回设备随机密钥，换设备找不回进度（v1021/v1063）' % n)
            if not has('hansen_cloud_restore'):
                bad('页面接线', '%s 有云存档却无开机恢复（v1048）' % n)
            if not has('hansen_signup_gate'):
                bad('页面接线', '%s 有云存档却无 Lv.3 门槛 —— 该页会成为门槛的后门（v1030）' % n)
        speaks = re.search(r'new SpeechSynthesisUtterance|speechSynthesis\.speak|function speak\s*\(', code)
        if speaks:
            if not has('hansen_tts_volume'):
                bad('页面接线', '%s 会朗读单词却无音量模块（v1038）' % n)
            elif re.search(r'<script[^>]*\bdefer\b[^>]*hansen_tts_volume', code):
                bad('页面接线', '%s 的音量模块加了 defer —— '
                    '它靠劫持 API 生效，必须早于任何发音代码执行' % n)
        if has('hansen_sb_pk_v1022') or 'id="pkRooms"' in code:
            if not has('hansen_pk_room_v1065'):
                bad('页面接线', '%s 有 PK 入口却无房间服务（v1065）' % n)
            if not has('hansen_pk_room_ui_v1065'):
                bad('页面接线', '%s 有 PK 入口却无房间界面（v1065）' % n)


# ─────────────────────────────────────────────────────────────
# 守卫 ⑤：资源戳必须全仓统一
#   事故：v1063。spelling_pk.html 的 10 个脚本 ?v= 停在 v1004/v1021，
#   因为 bump_version 只做「上一版→新版」字面替换、且用手工文件清单。
#   浏览器与 SW 按完整 URL 缓存，URL 不变就一直供着当年缓存的旧文件：
#   同一份 hansen_auth 在岛屿页是最新版、在 PK 页却停在 v1004，且毫无报错。
# ─────────────────────────────────────────────────────────────
def guard_stamp_uniform():
    v = _appv()
    if not v:
        bad('资源戳统一', 'VERSION 缺失或为空')
        return
    for p in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        n = os.path.basename(p)
        code = _code_only(open(p, encoding='utf-8', errors='replace').read())
        behind = sorted({m.group(1) for m in re.finditer(r'\?v=(\d+)', code) if m.group(1) != v})
        if behind:
            bad('资源戳统一', '%s 存在落后资源戳 %s（当前 v%s）—— '
                '浏览器/SW 按完整 URL 缓存，URL 不变就一直供旧文件' % (n, behind, v))


# ─────────────────────────────────────────────────────────────
# 守卫 ⑥：进度越界不得变成"可领取"
#   事故：v1060。迁移写的是 Math.min(saved.progress, item.goal)，
#   看着像防越界，实际把任何离谱值**顶满**成 progress === goal，
#   而 goal 常常只有 3 —— 改一下 localStorage 刷新就能白拿 XP 和金币。
#   test_quest_transactions_v942 的断言几十版一直在报，被当成过期测试。
# ─────────────────────────────────────────────────────────────
def guard_no_free_reward():
    q = _code_only(_read('hansen_quest_global.js'))
    if not q:
        return
    if re.search(r'progress\s*=\s*Math\.min\s*\(\s*Math\.floor\(\s*saved\.progress\s*\)\s*,\s*item\.goal', q):
        bad('白领奖励', 'hansen_quest_global 又把越界 progress 夹到 goal —— '
            '改 localStorage 即可白领奖励（v1060）')
    b = _code_only(_read('hansen_backup_v944.js'))
    if b and 'exactInt(q.goal' not in b:
        bad('白领奖励', '备份未对 goal 做正整数校验 —— goal:0 会让 progress 0 >= goal 立即可领（v1060）')


# ─────────────────────────────────────────────────────────────
# 守卫 ⑦：抢房必须原子
#   事故预防：v1065 在线对战。两人同时点同一间房是常态而非例外。
#   若用"先读再写"，必然出现两个客人进同一间房（已实测复现）。
# ─────────────────────────────────────────────────────────────
def guard_atomic_room_claim():
    r = _code_only(_read('hansen_pk_room_v1065.js'))
    if not r:
        return
    i = r.find('function joinRoom')
    if i < 0:
        return
    body = r[i:r.find('function startHeartbeat', i)]
    if 'claim(' not in body or 'updated' not in body:
        bad('抢房原子性', 'joinRoom 未用「条件更新 + 检查影响行数」—— '
            '"先读再写"必然让两人进同一间房（v1065）')
    if re.search(r'read\([^)]*\)[\s\S]{0,200}patch\(', body):
        bad('抢房原子性', 'joinRoom 出现"先读再写"形态')


# ─────────────────────────────────────────────────────────────
# 守卫 ⑧：守卫自己不许写死会漂移的常量
#   事故：v1067。check_resources.py 写死 68 处 ?v=960 与 VERSION=='960'，
#   从 v961 起每一版都报同一批假警，整整 106 个版本。
#   后果比"少一道守卫"更糟——守卫天天喊狼来了，真问题就被淹没了。
# ─────────────────────────────────────────────────────────────
def guard_no_hardcoded_pins():
    v = _appv()
    for fn in ('check_resources.py', 'economy_guard.py', 'hansen_evolve.py'):
        src = _read(fn)
        if not src:
            continue
        src_code = re.sub(r'^\s*#.*$', '', src, flags=re.M)
        src_code = re.sub(r'"""[\s\S]*?"""', '', src_code)
        behind = sorted({m.group(1) for m in re.finditer(r'\?v=(\d+)', src_code) if m.group(1) != v})
        if behind:
            bad('守卫自省', '%s 写死了落后的资源戳 %s（当前 v%s）—— '
                '会从此版起持续报假警' % (fn, behind, v))
    bv = _read('bump_version.py')
    if bv and 'check_resources.py' not in bv:
        bad('守卫自省', 'bump_version 未把守卫脚本纳入资源戳迁移，写死的钉子会再次漂移')


# ══════════════════════════════════════════════════════════════════
# 🔴v1070 新增四道 —— v1066 / v1068 / v1069 的教训
#
# 这四条和前八条一样，只盯**模式**不盯某一行：
# 问的是「有没有又犯同一种病」，而不是「这行代码是不是长成那样」。
# ══════════════════════════════════════════════════════════════════

def guard_no_dead_assertions():
    """假绿：断言写在 process.exit() / browser.close() 之后 —— 永远不会执行。

    事故（v1060）：给 test_account_wiring 加了两条断言，测试报 9/0 全过，
    而那两条**根本没跑** —— 它们在 process.exit() 后面。
    这类"假绿"比红灯危险得多：红灯至少在喊，假绿让人以为有防线。
    同一轮里还栽过第二次（v1066 改 explore_ui 的断言，
    故意停掉焦点归还它照样通过）—— 所以此后每写一个测试都先故意弄红一次。
    """
    for f in sorted(glob.glob(os.path.join(ROOT, 'test_*.mjs'))):
        src = _read(os.path.basename(f))
        if not src:
            continue
        stop = max(src.rfind('process.exit('), src.rfind('browser.close()'))
        if stop < 0:
            continue
        nl = src.find('\n', stop)
        if nl < 0:
            continue
        tail = _code_only(src[nl + 1:])
        if re.search(r'^\s*(ok\(|assert\.)', tail, re.M):
            bad('假绿断言',
                os.path.basename(f) + '：process.exit()/browser.close() 之后仍有断言，永远不会执行')


def guard_inline_onclick_syntax():
    """写进 onclick 字符串的代码必须是合法 JS —— 语法错误只在点下去那一刻才炸。

    事故（v1069）：hansen_season.js 里
        bar.setAttribute('onclick', "…:(window.(function(){…})())")
    `window.` 后面直接跟 `(` 是非法语法。加载时完全不暴露，
    只在用户真的点「星海觉醒」那一刻抛错 —— 于是"点了没反应"藏了很久，
    而两道守卫恰好把那行坏代码当成判据，一直红着没人看。

    教训：能绑函数就别写 onclick 字符串（函数体的语法错误加载阶段就会暴露）。
    """
    bad_call = re.compile(r'setAttribute\(\s*[\'"]onclick[\'"]\s*,\s*([\'"])(.*?)\1', re.S)
    files = sorted(glob.glob(os.path.join(ROOT, '*.js')) + glob.glob(os.path.join(ROOT, '*.html')))
    for f in files:
        base = os.path.basename(f)
        if base.startswith('test_') or base.startswith('_'):
            continue
        src = _code_only(_read(base) or '')
        for m in bad_call.finditer(src):
            body = m.group(2)
            if re.search(r'\w\.\s*\(', body):
                bad('onclick 语法',
                    base + '：onclick 字符串含 `X.(` 非法语法（只在点击时才炸）→ ' + body[:70])


def guard_no_message_clobber():
    """报错文案不得被二次改写 —— 已经是人话的错误必须原样透出。

    事故（v1068）：friendly() 里有一条
        if(/anonymous|ANONYMOUS|登录|auth/i.test(m)) return '云端匿名登录未开通…'
    正则含「登录」两字通配，把 v1059 写好的准确原文
    「云端登录已过期，请重新登录后再同步」整个改写成一个不相干的结论，
    差点把人引去开通一个根本不需要的配置。
    更糟的是上传路径经过 friendly()、拉取路径不经过 ——
    **同一时刻同一个错误，界面上两种互相矛盾的说法。**

    报错是唯一能看见现场的通道。本项目已在这条通道上堆过三层会撒谎的东西：
      v1059 [object Object] 盖住真错误（40 版靠猜）
      v1063 界面说"已登录"、面板说"已失效"
      v1068 准确文案被老规则改写
    """
    src = _code_only(_read('hansen_cloud_save_v965.js') or '')
    i = src.find('function friendly')
    if i < 0:
        return
    seg = src[i:i + 2000]
    for m in re.finditer(r'/([^/\n]{2,120})/i?\.test\(m\)', seg):
        alts = [a.strip() for a in m.group(1).split('|')]
        for a in alts:
            if a in ('登录', '错误', '失败', '异常'):
                bad('文案改写',
                    'friendly() 用了会吞掉一切准确文案的两字通配: /' + m.group(1)[:60] + '/')
                break
    if not re.search(r'\.friendly|\.sessionDead', seg):
        bad('文案改写', 'friendly() 未放行自己产生的错误（应检查 err.friendly / err.sessionDead）')
    if ('云端登录已过期' not in seg) and ('会话已失效' not in seg):
        bad('文案改写', 'friendly() 未把已是人话的会话类文案直接透出')


def guard_behavior_not_literal():
    """守卫自身不得把「某一行代码长什么样」当判据。

    事故（v1069）：check_resources 有两道守卫查字面量
        "window.location.href='land_map.html'"
    而那串**正是被改坏的那一行**，于是它们从改坏那天起一直红着。

    更普遍的问题 —— 抽查 4 条守卫，3 条是虚报：
      · 「\\U 转义会让 JS 乱码」 → 32 处全在注释里，node --check 通过
      · 「血量购买被误删」     → v1035 有意把公式改成查表（上限 500→1000）
      · 「SW 缺 shell-21」     → 实际 shell-128，一直在正常轮换
      · 「成就数量异常」       → 运行时 144 条正常，守卫写死 !=36
    共同毛病：**查形不查实**。后续版本有意改了写法，守卫就一直红着。

    结论要写进贾维斯的记忆里：
      **守卫报红 ≠ 有 bug；守卫全绿 ≠ 没 bug。看到红灯第一步是验证，不是照着改。**

    本守卫只做一件能自动化的事：拦住「把一整条赋值语句当判据」这种最脆的写法。
    """
    src = _read('check_resources.py') or ''
    # ⚠️ 第一版写得太宽，把 id="x" / class="y" 这类**合法的 DOM 存在性检查**
    #    也报了出来 —— 我自己当场犯了"守卫误报"这个毛病。
    #    真正脆的只有一种：钉死一整条**带点号路径的 JS 赋值语句**
    #    （如 window.location.href='land_map.html'），
    #    因为等价改写（换成 IIFE、换成函数绑定、换成 location.replace）随时会让它失效，
    #    而功能其实好好的。HTML 属性没有等价改写空间，钉死它是合理的。
    pat = re.compile(r'''[\'"]([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*=\s*[\'"][^\'"\n]{3,}[\'"])[\'"]\s+not\s+in''')
    for m in pat.finditer(src):
        bad('守卫查形不查实',
            'check_resources 把整条 JS 赋值语句当判据，等价改写即误报 → ' + m.group(1)[:70])



def guard_land_content_parity():
    """8 个 Land 页的**内容**必须与常规岛一致 —— 不只是模块接线。

    事故（v1071）：v1034 把成就从 36 扩到 144 时**又漏了 8 个 Land 页**，
    于是同一个账号在常规岛看到 144 条、进 Land 页只剩 36 条。

    这是 Land 页**第五次**被漏：
      v1021 账号接线 / v1030 Lv.3 门槛 / v1038 全站音量 /
      v1048 开机云端恢复 / v1034 成就扩充

    根子：island_land1~8.html **手工维护、不由 generate.py 从 template 分发**。
    guard_page_wiring 只查「模块在不在」，查不出「内容有没有跟上」——
    所以再加这一道，直接与常规岛逐项比数量。
    """
    def _count(fn, pat):
        return len(re.findall(pat, _read(fn) or ''))

    ref = 'island_animal.html'
    # 🔴v1072：产品定调 ——「星海觉醒 8 岛与外面 19 岛完全打通、没有隔阂」。
    #   所以比的不只是成就条数，而是**玩法与模块是否一模一样**。
    #   v1072 之前 Land 页少一个玩法（拼写大PK 整套缺失），
    #   等于两边根本不是同一个游戏。
    checks = [
        ("成就条数",   r"\{id:'[^']+',cat:'[^']+'"),
        ("玩法卡数",   r'class="mode-card"'),
        ("拼写PK入口", r'onclick="openSpellPK\(\)"'),
    ]
    for label, pat in checks:
        want = _count(ref, pat)
        if want <= 0:
            continue
        for i in range(1, 9):
            fn = 'island_land%d.html' % i
            got = _count(fn, pat)
            if got != want:
                bad('Land 内容一致性',
                    '%s 的%s为 %d，常规岛(%s)为 %d —— Land 页又被漏了'
                    % (fn, label, got, ref, want))

    # 模块清单必须一致 —— 少一个模块就是少一块功能
    def _mods(fn):
        return set(re.findall(r'src="([a-z_0-9]+)\.js', _read(fn) or ''))
    want_m = _mods(ref)
    if want_m:
        for i in range(1, 9):
            fn = 'island_land%d.html' % i
            miss = want_m - _mods(fn)
            if miss:
                bad('Land 内容一致性',
                    '%s 比常规岛少了 %d 个模块: %s' % (fn, len(miss), ', '.join(sorted(miss)[:5])))



def guard_land_generated():
    """单词大陆 8 岛必须由母版盖章生成 —— 不许再手工改（v1073 治本）。

    在此之前 island_land1~8.html 手工维护，同一件事被漏了**六次**：
      v1021 账号 / v1030 门槛 / v1034 成就 / v1038 音量 / v1048 云恢复 / v1072 拼写大PK

    guard_land_content_parity 是**事后拦截**（漏了会被抓到），
    这一道才是**治本**（从母版生成，压根不会漏）。

    判据：跑 generate_land.py --verify，8 页必须与母版盖章结果逐字一致。
    有人手改了某一页而没同步回母版 → 立刻报红。
    """
    gen = os.path.join(ROOT, 'generate_land.py')
    if not os.path.exists(gen):
        bad('Land 印章', '缺少 generate_land.py —— Land 页又回到手工维护，六次遗漏的根子还在')
        return
    for f in ('land_template.html', 'land_data.json'):
        if not os.path.exists(os.path.join(ROOT, f)):
            bad('Land 印章', '缺少 %s' % f)
            return
    import subprocess
    r = subprocess.run([sys.executable, gen, '--verify'], cwd=ROOT,
                       capture_output=True, timeout=300)
    if r.returncode != 0:
        out = (r.stdout or b'').decode('utf-8', 'replace')
        for ln in out.split('\n'):
            if '❌' in ln:
                bad('Land 印章', ln.strip()[:150])



def guard_jarvis_not_stale():
    """贾维斯必须跟着版本走 —— 它得能自己发现「我落后了」。

    背景：贾维斯的老知识库记到 BUG #110、版本停在 v999 之前，
    而项目当时已到 v1068 —— **落后近七十版，而没有任何机制会说一声**。
    「随时更新、随时进化」如果靠人记得，一定会丢（v1059~v1069 连丢十一版就是证据）。

    所以让它自查三件事：
      ① 事故登记册必须覆盖到最近的版本（不能停在很久以前）
      ② 知识库必须记录了当前这一代的教训
      ③ 新增的运行时模块不能没有任何守卫/测试提到它（无人看守的新代码）
    """
    ver = _appv()
    try:
        cur = int(str(ver))
    except Exception:
        return

    # ① 登记册的最新版本不能落后当前版本太多
    reg = _read('hansen_bug_registry.py')
    if not reg:
        bad('贾维斯落后', '缺少事故登记册 —— 没有任何机制保证「每个修复都有守卫」')
    else:
        vs = [int(m) for m in re.findall(r"\('v(\d+)'", reg)]
        if vs and cur - max(vs) > 3:
            bad('贾维斯落后',
                '事故登记册最新记到 v%d，当前已 v%d —— 落后 %d 版，近期修复可能无人看守'
                % (max(vs), cur, cur - max(vs)))

    # ② 知识库要跟得上
    kb = _read('贾维斯_知识库.md')
    if kb:
        vs = [int(m) for m in re.findall(r'v(\d{3,4})', kb)]
        if vs and cur - max(vs) > 10:
            bad('贾维斯落后',
                '知识库最新提到 v%d，当前已 v%d —— 落后 %d 版' % (max(vs), cur, cur - max(vs)))

    # ③ 新模块不能无人看守
    watched = _read('hansen_guards_v1068.py') + reg
    for f in sorted(glob.glob(os.path.join(ROOT, 'hansen_*.js'))):
        base = os.path.basename(f)
        m = re.search(r'_v(\d{4})\.js$', base)
        if not m:
            continue
        born = int(m.group(1))
        if born < 1059 or cur - born > 12:
            continue          # 太老的不追溯；太新的给几版缓冲
        stem = base[:-3]
        if stem not in watched and not glob.glob(os.path.join(ROOT, 'test_*%s*' % stem.split("_v")[0][7:])):
            bad('贾维斯落后', '%s 是近期新增模块，却没有任何守卫或测试提到它' % base)



# ══════════════════════════════════════════════════════════════════
# 🔴v1075 再加四道 —— 补上今天真实发生过、却还没人看守的 bug 类别
#
# 「没有任何 bug」做不到。能做到的是：**每一类踩过的坑都变成一道会咬人的守卫。**
# 这四道对应的都是本轮真实事故，不是假想。
# ══════════════════════════════════════════════════════════════════

def _static_refs(text):
    """抽出静态本地引用。运行时拼接的路径（含 + ' " $ { } \\ `）判不了，必须滤掉，
    否则会像 v1070 那样造出一道满屏误报的守卫。"""
    refs = set(re.findall(r'(?:src|href)="(?!https?:|//|data:|#|mailto:|javascript:)([^"?#]+)', text))
    refs |= set(re.findall(r"import\(\s*['\"]\./([^'\"?]+)", text))
    out = set()
    for r in refs:
        r = r.lstrip('./')
        if not r:
            continue
        if any(c in r for c in "+'\"${}\\`"):
            continue
        # 正则字面量里的 src="([^…]+)" 之类会被误当成引用 —— 这类必须滤掉，
        # 否则又造出一道会误报的守卫（v1070 已经栽过一次）。
        if any(c in r for c in "([)]*|^"):
            continue
        if '⟦' in r:          # 母版占位符
            continue
        out.add(r)
    return out


def guard_refs_exist():
    """引用的本地文件必须真实存在 —— v1057 那个真凶的类别。

    事故（v1057）：`hansen_auth` 里 import 了 `vendor_cloudbase_esm_v1004.js`，
    而仓库里只有 `v965`。原代码指望 404 时靠 `.catch` 退回，
    但**动态 import 的 404 在部分浏览器（含微信内置浏览器）不走 catch**，
    于是整个云端 SDK 加载失败 → 用户点「获取验证码」只看到"连不上服务器"。
    **手机注册从 v1004 起一直是坏的，而这只是一个写错的文件名。**

    这类错误的共同点：**静态可查，却要等真实用户点下去才暴露。**
    """
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, '*.js'))):
        base = os.path.basename(f)
        if base.startswith(('_', 'test_')) or base in ('land_template.html',):
            continue
        for r in _static_refs(_read(base) or ''):
            if not os.path.exists(os.path.join(ROOT, r)):
                bad('引用不存在', '%s 引用了不存在的文件: %s' % (base, r))


def guard_js_syntax():
    """所有运行时 JS 必须能通过语法检查 —— 语法错误不该等用户发现。

    事故（v1069）：`hansen_season.js` 的 onclick 字符串里 `window.(function…`
    是非法语法，**加载时完全不暴露，只在用户点「星海觉醒」那一刻才炸**，
    藏了很久。那一条已由 guard_inline_onclick_syntax 专门看守；
    这一道是更基础的一层：**文件本身必须是合法 JS**。
    """
    import subprocess
    node = shutil.which('node')
    if not node:
        return
    for f in sorted(glob.glob(os.path.join(ROOT, 'hansen_*.js'))
                    + glob.glob(os.path.join(ROOT, 'sw_*.js'))
                    + glob.glob(os.path.join(ROOT, 'jarvis*.js'))):
        r = subprocess.run([node, '--check', f], capture_output=True, timeout=60)
        if r.returncode != 0:
            first = (r.stderr or b'').decode('utf-8', 'replace').strip().split('\n')
            msg = next((x for x in first if 'Error' in x), first[0] if first else '?')
            bad('JS 语法', '%s 语法检查失败: %s' % (os.path.basename(f), msg[:110]))


def guard_data_writer_has_cloud():
    """写玩家数据的页面，必须齐备账号 + 云存档 + 备份。

    v1075 审计发现：把「统一」理解成「每个页面都挂全套模块」是**错的** ——
    给一个只看图鉴的页面挂上每日任务和成就系统，除了拖慢加载没有意义，
    还可能让注册门槛在导航页上弹出来。

    真正该盯死的是这一条：**数据会不会跟着账号走。**
    判据自动从代码得出（有没有写玩家数据键），
    **不需要手工维护「哪个页面属于哪一档」的清单** ——
    手工清单在本项目已经走散过八次。
    """
    WRITE = re.compile(
        r"setItem\(\s*['\"](?:wordIsland|hansen_wallet|hansen_gear|hansen_pet|hansen_ach|hansen_global)")
    DYN = re.compile(r"setItem\(\s*(?:__hsnSaveKey)\b")
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        base = os.path.basename(f)
        if base.startswith(('_', '武器')) or base == 'land_template.html':
            continue
        code = _code_only(_read(base) or '')
        if not (WRITE.search(code) or DYN.search(code)):
            continue                      # 不写玩家数据 → 本守卫不管
        for need, label in (('hansen_auth_v1004', '账号'),
                            ('hansen_cloud_save', '云存档'),
                            ('hansen_backup_v944', '备份')):
            if need not in code:
                bad('数据不跟账号',
                    '%s 会写玩家数据，却缺%s模块 —— 这些数据不会跟着账号走' % (base, label))


def guard_no_divergent_config():
    """同一份配置不许在两处各有一份且内容不同 —— 「两处真源」类别。

    本项目已踩到**八次**：
      ① 备份内嵌任务配置副本(v1019)   ② 成就清单两份(v1034/v1071)
      ③ 发音音量各处各设(v1038)       ④ 存档地址算法三处各写(v1046)
      ⑤ 页面模块接线手工维护(v1063)   ⑥ bump 的文件清单(v1063)
      ⑦ 流程本身靠记性(v1070)         ⑧ Land 页整体手工维护(v1073)

    这一道盯的是最典型的一种：**同一个清单在多个文件里各定义一份，条数还不一样。**
    v1071 就是这么发现「Land 页 36 条成就 vs 常规岛 144 条」的。
    """
    PAT = re.compile(r"\{id:'[^']+',cat:'[^']+'")
    counts = {}
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, '*.js'))):
        base = os.path.basename(f)
        if base.startswith(('_', 'test_', '武器')) or base == 'land_template.html':
            continue
        n = len(PAT.findall(_read(base) or ''))
        if n >= 20:                       # 20 条以上才算"一份清单"
            counts[base] = n
    if not counts:
        return
    top = max(counts.values())
    for base, n in sorted(counts.items()):
        if n != top:
            bad('两处真源',
                '%s 的成就清单只有 %d 条，而全站最全的一份是 %d 条 —— 两份真源已走散'
                % (base, n, top))



def guard_version_watch_everywhere():
    """每个页面都必须装「版本守望者」—— 不装就可能一直跑旧代码而无人知晓。

    事故（产品负责人多次反馈，明确说"之前出现过，给我带来很大困扰"）：
      「你做出来的东西有可能根本就没显示出来，你做完了但可能还是上个版本。」

    机制：SW 对导航是网络优先，但**有缓存时只等几秒**，
    用户在微信内置浏览器信号一波动就超时 → 拿到缓存里的旧 HTML；
    而 HTML 文件名不带版本戳，旧页面被一直复用，里面引用的又全是旧版 JS。
    结果：开发端连改六版，用户手机上跑的仍是旧代码，**而双方都看不出来** ——
    云端登录那条线因此空转了二十多版，每次诊断都建立在过期证据上。

    注意「面板显示模块版本 vs 页面版本」**检测不出这件事**：
    SW 给的是整套旧文件，两个数字会一致地都是旧的。
    唯一可靠的判据是**去服务器问最新版本**（缓存管不着的地方）。

    本守卫盯三件事：
      ① 每个运行时页面都装了 hansen_version_watch
      ② 该模块确实用 no-store 去取 VERSION（而不是可能被缓存的普通 fetch）
      ③ VERSION 文件在发布清单里（取不到就等于没装）
    """
    mod = 'hansen_version_watch_v1083'
    miss = []
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        base = os.path.basename(f)
        if base.startswith(('_', '武器')) or base == 'land_template.html':
            continue
        if mod not in (_read(base) or ''):
            miss.append(base)
    if miss:
        bad('版本守望', '%d 个页面没装版本守望者: %s' % (len(miss), ', '.join(miss[:6])))

    src = _code_only(_read(mod + '.js') or '')
    if not src:
        bad('版本守望', '缺少 %s.js —— 用户可能一直跑旧代码而无人知晓' % mod)
        return
    if 'no-store' not in src:
        bad('版本守望', '取版本时未用 no-store —— 请求本身可能被缓存，等于白查')
    if not re.search(r"['\"]VERSION", src):
        bad('版本守望', '未去取 VERSION 文件 —— 无法与服务器比对')
    if 'caches.delete' not in src or 'unregister' not in src:
        bad('版本守望', '发现落后却不清缓存/注销 SW —— 查出来也修不掉')
    # 🔴v1084：子页都在 index.html 的 iframe 壳里跑（openIsland 换装 + v1023 预热）。
    #   iframe 里 location.replace 只重载 iframe 自己，**外壳仍是旧版**（外壳才注册 SW），
    #   而且多个 iframe 会各查各的、各重载各的，互相打架、隐藏框还看不见。
    if 'window.top' not in src:
        bad('版本守望', '未区分顶层与 iframe —— 在子框里重载等于白修，还会多框互相打架')
    # XHR 兜底：微信内置浏览器版本参差，没有兜底就等于在用户所在环境不工作
    if 'XMLHttpRequest' not in src:
        bad('版本守望', '无 XHR 兜底 —— 老内核没有 fetch 时守望者完全不工作')
    # 绝对路径：相对路径在 iframe/子路径下会解析到错误地址 → 永远取不到 → 形同虚设
    if 'location.origin' not in src:
        bad('版本守望', '用相对路径取 VERSION —— iframe 或子路径下会取错地址')

    rel = _read('package_release.py') or ''
    if '"VERSION"' not in rel and "'VERSION'" not in rel:
        bad('版本守望', 'VERSION 未列入发布清单 —— 线上取不到就等于没装守望者')



def guard_no_rush_after_login():
    """登录后不得立刻打云端 —— 一次被拒的请求会毁掉整个登录会话。

    这是读 CloudBase SDK 源码确认的机制（不是推测）。请求拦截器里有：

        if (withCredentials && resp.error === UNAUTHENTICATED)
            setCredentials(null)        // ← 把整个凭证删掉

    **任何一个带凭证的请求，只要服务端回一次 UNAUTHENTICATED，
      SDK 就把凭证整个抹掉**，此后 getLoginState() 永远返回 null。

    用户现场完全吻合：登录成功 → 凭证 1314 字节 → **约 2 秒后消失** →
    之后所有云端读写被拦在门外。而开机恢复原本正是在登录后 **1.2 秒**读库。

    合同：
      · 监听 hsn-auth-changed 后不得在 3 秒内发起云端读写；
      · 且必须先 ensureSession 确认会话可用再动手 ——
        宁可晚点提示恢复，也不能因为抢跑把用户的登录搞没。
    """
    src = _code_only(_read('hansen_cloud_restore_v1048.js') or '')
    if not src:
        return
    i = src.find("hsn-auth-changed")
    if i < 0:
        return
    seg = src[i:i + 1200]
    m = re.search(r'setTimeout\([^,]+,\s*(\d+)\s*\)', seg)
    if m and int(m.group(1)) < 3000:
        bad('登录后抢跑',
            '登录后 %sms 就发起云端读写 —— 一次被拒会让 SDK 清掉凭证，'
            '用户登录当场作废' % m.group(1))
    if 'ensureSession' not in seg:
        bad('登录后抢跑', '登录后未先确认会话可用就读库 —— 请求被拒即毁掉整个登录')



def guard_single_instance_when_signed_in():
    """已登录时绝不创建第二个 CloudBase 实例 —— 并发刷新会把凭证撞没。

    用户真机凭证生死簿抓到的现行（确凿证据）：
        HTTP 400  /auth/v1/token
        invalid_grant | invalid refresh token. for it may be has been refreshed by
        ❗删除 credentials_ambitious-…  原有 1314 字节  ← SDK 自己删的

    「refresh token 无效 —— 因为它可能已经被别人刷新过了」

    **多个实例并发刷新同一个 refresh_token**：各有各的内存态，
    却共用同一个 localStorage 槽位。A 刷新成功写入新 token，
    B 手里还是旧的 → 服务端回 invalid_grant → SDK 把整个凭证删掉。

    v1076 想拦这件事，但**防线放在了 cloudbase.init() 之后** ——
    实例照样被创建、凭证照样被读取和刷新。这一道盯死顺序。
    """
    code = _code_only(_read('hansen_cloud_save_v965.js') or '')
    if not code:
        return
    init_at = code.find('cloudbase.init(')
    if init_at < 0:
        return
    n = len(re.findall(r'cloudbase\.init\s*\(', code))
    if n > 1:
        bad('单实例', '云存档里有 %d 处 cloudbase.init —— 多实例必然并发刷新撞掉凭证' % n)
    acct_at = code.find('_hasAcct')
    if acct_at < 0 or acct_at > init_at:
        bad('单实例', '已登录判断不在 cloudbase.init 之前 —— 实例照样被创建（v1076 就错在这）')
    frame_at = code.find('_inFrame')
    if frame_at < 0 or frame_at > init_at:
        bad('单实例', 'iframe 判断不在 cloudbase.init 之前 —— 预热子框会各自建实例')
    seg = code[acct_at:init_at] if acct_at >= 0 else ''
    if seg and 'cloudbase.init' in seg:
        bad('单实例', '已登录分支里仍有 cloudbase.init')



def guard_backup_excludes_credentials():
    """备份绝不能收录/写回云端凭证 —— 那会把当前有效会话打掉。

    用户真机凭证生死簿抓到的完整现场（确凿证据）：
        1:05:59  🔑 登录成功  凭证已就位            ← SDK 写入新凭证 1340 字节
        1:06:04  写入 credentials_…  1314 字节
                 hansen_backup_v944.js:410      ← **我们自己的备份恢复写的**
        1:06:06  ❗删除 credentials_…
                 → HTTP 400 invalid_grant | invalid refresh token.
                             for it may be has been refreshed by

    备份恢复把**旧的**凭证快照盖回去 → SDK 拿过期 refresh_token 刷新
    → 服务端回 invalid_grant → SDK 把整个凭证删掉 → 用户彻底登不上。

    成因：v1019 把白名单改成**兜底收录**（初衷是"所有东西都跟着账号走"，方向对），
    但没想到 SDK 自己的凭证也躺在同一个 localStorage 里。

    凭证是**会话态**不是玩家数据：跨设备搬毫无意义，搬回来还会打掉当前会话。
    """
    code = _code_only(_read('hansen_backup_v944.js') or '')
    if not code:
        return
    if 'function credentialKey' not in code:
        bad('备份碰凭证', '备份模块没有 credentialKey 判据 —— 凭证会被当成玩家存档收进备份')
        return
    oi = code.find('function ownedKey')
    if oi >= 0:
        seg = code[oi:oi + 300]
        if 'credentialKey' not in seg:
            bad('备份碰凭证', 'ownedKey 未排除凭证 —— 收录侧漏了')
    ri = code.find('function rawEntryAllowed')
    if ri >= 0:
        seg = code[ri:ri + 320]
        if 'credentialKey' not in seg:
            bad('备份碰凭证',
                'rawEntryAllowed 未排除凭证 —— 恢复/回滚会把旧凭证写回去，重演事故')



# ══════════════════════════════════════════════════════════════════
# 🔴v1096 攻坚笔记转化的守卫
#
# 来源：《跨设备存档攻坚全记录 v1017-v1095》（攻坚笔记/ 目录）
# 那次攻坚花了近 80 个版本，根子是**六个 bug 叠在一起**，
# 其中三个属于"让人看不见真相"那一类。
#
# 这几道守卫把笔记里最贵的几条教训变成**可执行的拦截**，
# 而不是只写在文档里等人去读。
# ══════════════════════════════════════════════════════════════════

def guard_cjk_keys_backupable():
    """备份必须放行中文键名 —— 卡了用户好几个版本的最后一根稻草。

    事故（v1095）：登录成功后点「立即把进度存到云端」，一直报
        「备份含非法键或非字符串值」

    真凶（扫描用户真实 localStorage 才找到）：
        hsn_progress:动物大冒险      ← 键名里有中文
    这是 hansen_mylearning.js 写的「我的学习」跨岛聚合数据，
    键名格式就是 `hsn_progress:<岛屿标题>` —— 而岛屿标题本来就是中文。

    而备份的键名校验只允许 [A-Za-z0-9_:\\-.] —— 中文一律判为非法
    → 整个备份失败 → 用户永远存不上云端。

    ⚠️ v1094 我曾以为是自己加的诊断键污染了备份 —— **那只对了一半**。
    教训：**先扫真实数据，再下结论。**
    """
    bk = _code_only(_read('hansen_backup_v944.js') or '')
    if not bk:
        return
    m = re.search(r'KEY_CHARSET\s*=\s*/([^/]+)/', bk)
    if not m:
        bad('中文键备份', 'hansen_backup 缺 KEY_CHARSET —— 中文键名会让整个备份失败')
        return
    charset = m.group(1)
    if 'u4e00' not in charset or 'u9fff' not in charset:
        bad('中文键备份',
            'KEY_CHARSET 未放行汉字区间 —— hsn_progress:<中文岛名> 会让备份整个失败')
    # 同时不能无脑放行：空格等真正非法的字符仍要拦
    if ' ' in charset.replace('\\ ', ''):
        bad('中文键备份', 'KEY_CHARSET 放行了空格 —— 放得太宽')


def guard_no_success_without_evidence():
    """「没报错」不等于「成功」—— 关键操作必须留下可验证的痕迹。

    事故（v1080）：登录链路原本是
        }).then(function () { writeLocal({ method:'phone', signedAt: Date.now() }); })
    **只要 Promise 没 reject 就标记成功**，完全不看云端返回了什么。
    于是出现「③ 已登录 / ③b 会话失效」这种自相矛盾的显示 ——
    界面说登录着，每一次云端读写却都失败，用户被反复推去重新登录。

    规则：登录成功后必须确认 SDK 自己的凭证键真的存在，才写本地登录态。
    """
    src = _code_only(_read('hansen_auth_v1004.js') or '')
    if not src:
        return
    i = src.find('function loginByPhoneCode')
    if i < 0:
        return
    seg = src[i:i + 4000]
    if 'credentials' not in seg:
        bad('无凭据即成功',
            'loginByPhoneCode 未校验云端凭证就写"已登录" —— '
            '会出现「界面说已登录、云端其实没会话」')


def guard_notready_vs_expired():
    """「尚未就绪」与「确凿过期」必须分开说 —— 混为一谈会把人推进死循环。

    事故（v1077）：v1059 那行返回值自相矛盾 ——
        { ok:false, expired:true, definite:false }
                    ↑"确凿过期"    ↑又说"说不准"
    而下游**只看 expired**，于是把「SDK 凭证还没落定」讲成「登录已过期」。
    用户按提示重新登录 → 又成功 → 又被告知过期 → **循环重演**。

    规则：探测拿不到会话时必须区分 notReady（稍候重试）与 expired（重新登录），
    且空登录态必须重试若干次才下结论。
    """
    src = _code_only(_read('hansen_auth_v1004.js') or '')
    if not src:
        return
    i = src.find('function ensureSession')
    if i < 0:
        return
    seg = src[i:i + 3000]
    if 'notReady' not in seg:
        bad('三态不分',
            'ensureSession 未区分「尚未就绪」与「已过期」 —— '
            '会把人推去反复重新登录（v1077 死循环）')
    if 'RETRY' not in seg and 'retry' not in seg.lower():
        bad('三态不分',
            'ensureSession 拿到空登录态未重试就下结论 —— '
            'SDK 凭证是异步落定的，问一次不算数')


def guard_login_path_not_blocked():
    """用户主动操作的路径不许被"后台优化"拦死。

    事故（v1090）：为堵「多实例并发刷新」，我加了
    「iframe 内**一律**不创建云端实例」——
    **而拼写大PK 本身就在 index.html 的 iframe 壳里跑**，
    登录面板正在那个子框内，于是用户连登录都点不了。

    我把两件性质完全不同的事混为一谈：
      · 后台自动行为（开机恢复/自动同步/会话探测）在子框里跑 → **该拦**
      · 用户主动操作（登录/注册/手动同步）→ **必须放行**
        （拦了比凭证偶尔被撞掉严重得多）

    正确做法：同源时**借用顶层已有的实例** ——
    既只有一个实例（不并发刷新），子框里的功能又照常可用。
    """
    for f, label in (('hansen_auth_v1004.js', '账号'),
                     ('hansen_cloud_save_v965.js', '云存档')):
        src = _code_only(_read(f) or '')
        if not src:
            continue
        i = src.find('_inFrame')
        if i < 0:
            continue
        seg = src[i:i + 900]
        if 'window.top' not in seg:
            bad('登录被拦死',
                '%s：子框判断未尝试借用顶层实例 —— 会把用户主动操作一并拦死' % label)
        # 有 reject 的话，前面必须有"仅限后台"的限定
        ri = seg.find('Promise.reject')
        # v1097：判据只认 `_bgOnly` 这个具名开关，**不认"后台"二字** ——
        #   "后台"会出现在错误文案里，把限定删掉后仍能匹配上，
        #   于是守卫永远绿灯（自证机制抓到了这一点）。
        if ri >= 0 and '_bgOnly' not in seg[:ri]:
            bad('登录被拦死',
                '%s：子框内无条件拒绝 —— v1090 就是这样让用户连登录都点不了' % label)


def guard_app_and_auth_in_sync():
    """`app()` 与 `auth()` 必须一起改 —— 同一疏漏的两半。

    事故（v1093）：v1091 让子框借用顶层实例，改的是 `app()`：
        function auth() {
          return app().then(function () {
            if (!_auth) throw new Error('鉴权不可用');   // ← 这里没改
            return _auth;
          });
        }
    `app()` 返回的是顶层借来的实例，**但 `_auth` 是本模块的局部变量、
    在子框里永远是 null** → 直接抛「鉴权不可用」，登录照样点不动。

    **我上一版只改了 app()，没跟着改 auth()。**
    """
    src = _code_only(_read('hansen_auth_v1004.js') or '')
    if not src:
        return
    i = src.find('function auth()')
    if i < 0:
        return
    seg = src[i:i + 900]
    if not re.search(r'app\(\)\.then\(\s*function\s*\(\s*\w+\s*\)', seg):
        bad('app/auth 不同步',
            'auth() 没接住 app() 返回的实例 —— 子框借用实例时会报「鉴权不可用」')


def guard_diag_tools_not_in_user_data():
    """诊断/守护类模块写的内部键，不许混进用户数据。

    事故（v1094）：v1085/v1092 我加的内部键都以 `hansen_` 开头，
    正好落进备份的收录前缀：
        hansen_credtrap_log / hansen_cred_shadow / hansen_vw_autofixed …
    它们是**本机诊断状态**，既不是玩家进度、也不该跨设备同步，
    更不该因为格式不符就让整个备份失败。

    **我为了诊断加的东西，反过来把用户的存档功能弄坏了。**
    """
    bk = _code_only(_read('hansen_backup_v944.js') or '')
    if not bk:
        return
    m = re.search(r'DIAG_KEY_RE\s*=\s*/([^/]+)/', bk)
    if not m:
        bad('诊断键污染', 'hansen_backup 缺 DIAG_KEY_RE —— 诊断键会污染用户备份')
        return
    rule = m.group(1)
    for token in ('credtrap', 'cred_shadow', 'cred_rescue', 'cred_refresh', 'vw_autofixed'):
        if token not in rule:
            bad('诊断键污染', 'DIAG_KEY_RE 未覆盖 %s 类内部键' % token)


def guard_campaign_notes_present():
    """攻坚笔记必须留在仓库里 —— 那是近 80 个版本换来的东西。

    《跨设备存档攻坚全记录 v1017-v1095》记录了每一版失败的具体内容、
    当时的判断依据、被什么推翻、以及最终真凶。
    它最核心的一句话是：

        **先修「看得见」，再修「修得好」。**

    因为那次的六个 bug 里，有三个属于"让人看不见真相"那一类
    （[object Object] 遮住错误 / 文案被改写 / SW 缓存住旧代码）——
    它们不直接导致失败，**但让每一次诊断都建立在错误信息上**。
    """
    import glob as _g
    hits = _g.glob(os.path.join(ROOT, '攻坚笔记', '*.md'))
    if not hits:
        bad('攻坚笔记', '攻坚笔记/ 目录不存在或为空 —— 近 80 版换来的经验会丢失')
        return
    # 🔴v1155：**两处都找。**
    #   守卫写死了 `攻坚笔记/` 子目录，而文件实际在仓库根目录 ——
    #   于是它一直报"笔记缺少核心结论"（其实四个关键词一个不少）。
    #   更糟的是：**自证每道注入前都要先确认基线是绿的**，
    #   这条常红就让**整轮自证全部无法判定** —— 一道坏规则瘫痪了整个验证机制。
    _cands = [os.path.join(ROOT, '攻坚笔记', '跨设备存档攻坚全记录_v1017-v1095.md'),
              os.path.join(ROOT, '跨设备存档攻坚全记录_v1017-v1095.md')]
    main = next((c for c in _cands if os.path.exists(c)), _cands[0])
    if not os.path.exists(main):
        bad('攻坚笔记', '缺《跨设备存档攻坚全记录 v1017-v1095》')
        return
    txt = open(main, encoding='utf-8', errors='replace').read()
    # 判据只认稳定的核心词，不钉死标点/引号形态 ——
    # 第一版把全角引号写进判据，笔记里换了个写法就误报（守卫查形不查实的老毛病）。
    for key in ('先修', '看得见', '属性正确', '先扫真实数据'):
        if key not in txt:
            bad('攻坚笔记', '笔记缺少核心结论：%s' % key)

    # 🔴v1097：**笔记里不许写死会漂移的数字。**
    #   挑刺时发现笔记写「23 道守卫」，而实际已 30 道 ——
    #   笔记会随版本漂移而无人盯着，这正是笔记自己批判的那类问题。
    for m in re.finditer(r'(\d+)\s*道守卫', txt):
        bad('攻坚笔记',
            '笔记写死了「%s 道守卫」—— 数字必然过时，应改为"以 jarvis_gate 输出为准"'
            % m.group(1))
    for m in re.finditer(r'(\d+)\s*条事故登记', txt):
        bad('攻坚笔记', '笔记写死了「%s 条事故登记」—— 同上' % m.group(1))



def guard_every_guard_has_selftest():
    """每一道守卫都必须有自证样本 —— 没样本＝没人证明它会咬人。

    挑刺时发现：30 道守卫里有 7 道没有自证样本。
    它们一直显示绿灯，但从来没被验证过是否真的会报红。

    这比"守卫失灵"更隐蔽：
      · 守卫失灵至少还有 jarvis_selftest 能发现
      · 而根本没有样本的守卫，连自证机制都不知道它存在

    知识库那条「守卫全绿 != 没 bug」，正是因为守卫自己可能就是坏的。
    没样本的守卫，连"是不是坏的"都无从判断。

    允许少量例外，但必须显式豁免并注明理由，不能默认放过。
    """
    EXEMPT = {
        # 这两道盯的是"守卫自身的写法"，注入样本会与它们自己的判据自指
        '守卫自省': 'self-referential',
        '守卫查行为': 'self-referential',
        # 这道注入需篡改登记册/知识库，会连带影响其它判定
        '贾维斯不落后': 'injection affects other guards',
        # 自证机制按文本读写文件，favicon 是二进制，注入会破坏它
        '图标过大': 'binary file, selftest is text-based',
    }
    g = _read('hansen_guards_v1068.py') or ''
    i = g.find('GUARDS = [')
    if i < 0:
        return
    names = [m.group(1) for m in re.finditer(r"\('([^']+)',\s*guard_\w+\)", g[i:])]
    st = _read('jarvis_selftest.py') or ''
    j = st.find('CASES = [')
    if j < 0:
        bad('守卫无自证', 'jarvis_selftest missing CASES')
        return
    covered = set(m.group(1) for m in re.finditer(r"\('([^']+)',", st[j:]))
    missing = [n for n in names if n not in covered and n not in EXEMPT]
    if missing:
        bad('守卫无自证',
            '%d guards have no self-test sample: %s'
            % (len(missing), ', '.join(missing[:6])))



def guard_no_always_true_assert():
    """测试里不许有恒真断言 —— ok(true, ...) 等于那一条根本没测。

    挑刺时发现 4 处，全都出现在 else 分支里：
        if (可以精确验证) { ok(真正的判据, ...); }
        else              { ok(true, '同样算通过'); }   ← 敷衍

    这比"假绿断言"（写在 process.exit 之后）更难发现：
    假绿至少还有 guard_no_dead_assertions 盯着，
    而恒真断言**会正常执行、正常打印 OK**，看起来完全正常。

    它的危害：那条分支覆盖的情况**永远不会被验证**，
    而报告上却显示"通过" —— 又一次"看起来在工作、其实没在看"。
    """
    import glob as _g
    bad_files = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'test_*.mjs'))):
        src = _read(os.path.basename(f)) or ''
        code = re.sub(r'/\*[\s\S]*?\*/', '', src)
        code = re.sub(r'^\s*//.*$', '', code, flags=re.M)
        hits = re.findall(r'\bok\(\s*(?:true|1|!!1)\s*,', code)
        if hits:
            bad_files.append((os.path.basename(f), len(hits)))
    for name, n in bad_files:
        bad('恒真断言',
            '%s 有 %d 条 ok(true,…) —— 那些分支永远不会失败，等于没测' % (name, n))



def guard_theme_fg_follows_bg():
    """背景跟主题走的元素，前景色必须一起跟 —— 否则换主题就白底白字。

    事故（v1111，用户挑刺时我自己扫出来的）：
        .fr_st div.sel{background:var(--hpk-sel-bg);color:#fff}
    暗色下选中态是深紫底白字，看着没问题；
    **亮色下背景变成 #e8ecff（很浅），白字对比度 1.0，完全看不见。**

    这是主题化最容易漏的一类：**只把背景变量化了，前景忘了**。
    单看代码不明显，只有在另一个主题下才暴露。

    判据：一条规则里如果 background 用了主题变量，
    而 color 是写死的浅色（#fff / #f?f?f? 之类），就报红。
    """
    import glob as _g
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*_ui_*.js'))
                    + _g.glob(os.path.join(ROOT, 'hansen_pk_room_ui*.js'))):
        src = _code_only(_read(os.path.basename(f)) or '')
        if not src:
            continue
        for m in re.finditer(r"'[^']*\{[^']*\}'", src):
            rule = m.group(0)
            if 'background:var(--' not in rule:
                continue
            cm = re.search(r'color:\s*(#[0-9a-fA-F]{3,6})', rule)
            if not cm:
                continue
            hexv = cm.group(1)
            if len(hexv) == 4:
                hexv = '#' + ''.join(c * 2 for c in hexv[1:])
            try:
                lum = (int(hexv[1:3], 16) * .299 + int(hexv[3:5], 16) * .587
                       + int(hexv[5:7], 16) * .114)
            except Exception:
                continue
            if lum > 200:
                bad('主题前景',
                    '%s 里有规则 background 用主题变量、color 却写死浅色 %s —— '
                    '换到亮色主题会白底白字：%s'
                    % (os.path.basename(f), hexv, rule[:70]))



def guard_favicon_small():
    """favicon 必须是小图标 —— 它会被每个页面自动请求。

    事故（v1117，挑性能时发现）：
        favicon.ico 是一张 **384×384 的 PNG，215 KB**，
        而浏览器只用它显示 16×16 的标签页图标。
        更糟的是它**被请求了两次** —— 白白浪费 430 KB，
        占了首屏总流量 3278 KB 的 13%。

    没人会主动去看 favicon 的大小，因为页面里根本没引用它
    （浏览器自动请求 /favicon.ico）—— 属于"看不见的浪费"。

    换成标准多尺寸 ICO（16/32/48）后只有 9 KB。
    """
    f = os.path.join(ROOT, 'favicon.ico')
    if not os.path.exists(f):
        return
    n = os.path.getsize(f)
    if n > 40 * 1024:
        bad('图标过大',
            'favicon.ico 有 %.0f KB —— 它会被每个页面自动请求（且常被请求两次），'
            '应是 16/32/48 的多尺寸 ICO，几 KB 就够' % (n / 1024))
    # 顺便确认它真是 ICO 而不是改了扩展名的大 PNG
    try:
        head = open(f, 'rb').read(4)
        if head[:4] != b'\x00\x00\x01\x00':
            bad('图标过大', 'favicon.ico 不是标准 ICO 格式（可能是改了扩展名的大图）')
    except Exception:
        pass



def guard_no_parallel_pk_panel():
    """同一块界面不许有两套并存的实现。

    v1129 我改「竞赛 ID 显示 No.---」时改错了文件 —— 因为**同一个身份条
    有两套代码在渲染**：

        29 个岛屿页  → hansen_sb_pk_v1022.js 里的 HansenSbPK 面板（.k_cid）
        spelling_pk.html → 自己内联的一套（.pk_cid）

    用户从岛屿进和从 PK 页进，看到的是**两份不同代码渲染的同一个界面**。
    改一处、另一处不动 —— 而两条路都通向同一个功能，用户根本不知道
    自己看到的是哪一份。

    这是本项目最贵的那类问题的变种：**同一件事两处真源**
    （云端登录那次栽过八次）。

    判据：两处的关键文案必须一致。**不强行合并**（合并风险大于收益，
    两套都在跑且都稳定），但**不许它们说不一样的话**。
    """
    pairs = [
        ('登录后自动分配', '未登录时的竞赛 ID 文案'),
        ('未定级', '未定级的段位文案'),
    ]
    # ⚠️ 必须剥掉注释再比：注释里往往也写着同一句文案
    #    （本守卫第一版就栽在这 —— 注入把代码里那份改掉了，
    #     注释里还留着一份，条件照样成立，守卫不咬人）。
    a = _code_only(_read('hansen_sb_pk_v1022.js') or '')
    b = _read('spelling_pk.html') or ''
    b = re.sub(r'<!--[\s\S]*?-->', '', b)
    b = _code_only(b)
    if not a or not b:
        return
    for token, what in pairs:
        ina, inb = (token in a), (token in b)
        if not (ina and inb):
            # 两边都必须有 —— 少一边就说明改漏了 
            bad('两套身份条',
                '%s 缺失（模块=%s / PK 页=%s）—— '
                '同一个身份条有两套实现，改一处会漏另一处'
                % (what, ina, inb))



def guard_no_live_ls_iteration():
    """不许边遍历边读 localStorage —— 会漏键。

    事故（v1132/v1133）：`localStorage.key(i)` 按索引取键，
    而页面上同时跑着凭证守护、心跳、版本守望者，**它们随时写/删键**。
    集合一变动索引就错位，**正好跳过某一格**。

    后果：登录成功却扫不到凭证（界面显示未登录）、
    **备份漏键 = 用户丢一个岛的进度**。
    跑得快没事、跑得慢就错 —— 表现为"随机"，最难查的那种。
    全站曾有 17 处这种写法。
    """
    import glob as _g
    hits = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*.js'))):
        src = _code_only(_read(os.path.basename(f)) or '')
        if not src:
            continue
        for m in re.finditer(r'for\s*\([^)]*localStorage\.length[^)]*\)\s*\{[\s\S]{0,300}?\}', src):
            L = m.group(0)
            if 'localStorage.key(' not in L:
                continue
            if re.search(r'push\(\s*\w+\s*\)', L) and 'getItem' not in L:
                continue        # 只收集键名 = 取快照本身，合法
            hits.append(os.path.basename(f))
    if hits:
        bad('边遍历LS',
            '%d 处边遍历边读 localStorage（%s）—— 集合被别的模块改动时会漏键'
            % (len(hits), '、'.join(sorted(set(hits))[:4])))


def guard_no_orphan_state_fields():
    """状态字段读了就必须有人写 —— 否则是"改了一半"的残留。

    事故（v1122）：对战改回合制后记分挪到 `st.myScore`，
    **而结算还在读 v1099 的 `st.correct`** —— 那字段从此没被赋过值。
    后果：**打完 3 局战绩记 0 局**，天梯分也不动。而它**不报错**。
    """
    for f in ('hansen_pk_room_ui_v1065.js', 'hansen_friends_ui_v1107.js',
              'hansen_ladder_ui_v1108.js'):
        src = _code_only(_read(f) or '')
        if not src:
            continue
        writes = set(re.findall(r'\b(?:st|_state)\.(\w+)\s*=(?!=)', src))
        # 🔴v1156：**`st.st.xxx++` 和 `+=` 这种也是赋值。**
        #   判据原来只认 `xxx =` 这一种形态，
        #   于是 `st.st.firstWins++` / `st.st.totalMs += ms` 被当成
        #   "读了但从没赋值"，报了个误报。
        #   **误报比漏报更伤** —— 它会让人开始忽略这道守卫，
        #   等真出事的时候也不会看了。
        writes |= set(re.findall(r'\.(\w+)\s*(?:\+\+|--|\+=|-=)', src))
        for m in re.finditer(r'_state\s*=\s*\{([^}]*)\}', src, re.S):
            writes |= set(re.findall(r'(\w+)\s*:', m.group(1)))
        reads = set(re.findall(r'\b(?:st|_state)\.(\w+)\b(?!\s*=(?!=))', src))
        orphan = sorted(reads - writes)
        if orphan:
            bad('孤儿字段',
                '%s 读了但从没赋值: %s —— 多半是"改了一半"的残留' % (f, orphan[:4]))


def guard_no_n_plus_one_query():
    """不许在循环里逐条查数据库 —— 按次计费的东西会真的产生费用。

    事故（v1121）：好友列表逐个查在线状态 → 50 个好友 = **51 次读**，
    而好友页每 15 秒刷一次 —— **挂一小时 12000 次读**。
    **这不是"慢"，是会真的产生费用。**
    """
    import glob as _g
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*.js'))):
        base = os.path.basename(f)
        src = _code_only(_read(base) or '')
        if not src:
            continue
        for m in re.finditer(r'\.(map|forEach)\(\s*function[^{]*\{([^}]{0,400})', src):
            body = m.group(2)
            if not re.search(r'T\(\)\.\w+|db\(\)\.|\.collection\(', body):
                continue
            # 条数固定的循环不算 N+1：删除清理、以及"把双方两条记录改状态"这类。
            # 判据看**读**：N+1 的害处是读次数随人数线性涨（云开发按读计费），
            # 而 patch/update/remove 是写，且这些场景条数天然是 1~2。
            if re.search(r'remove|delete|清理|\.patch\(|\.update\(', body):
                continue
            bad('循环查库',
                '%s 在 %s 回调里查数据库 —— 条数随用户增长会变成 N+1'
                % (base, m.group(1)))


def guard_no_load_order_helper():
    """公用助手不许引入"必须早于谁加载"的约束。

    事故（v1133）：抽了个公用助手给十个模块调，
    **备份直接收录 0 键** —— 助手没先加载，兜底成了空数组。
    **加载顺序正是这个项目栽过最多次的地方。**
    """
    import glob as _g
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*.js'))):
        base = os.path.basename(f)
        src = _code_only(_read(base) or '')
        if not src:
            continue
        for m in re.finditer(r'window\.(Hansen\w+)\s*\?\s*window\.\1\s*\(\)', src):
            name = m.group(1)
            if re.search(r'UI$|Panel$|Diag$', name):
                continue        # 界面类互调是正常的
            bad('加载顺序依赖',
                '%s 依赖 window.%s 先加载 —— 顺序错了会静默兜底成空值'
                % (base, name))


def guard_round_advance_covers_noone_wins():
    """回合推进不能只挂在"有人赢"上 —— "谁都没赢"同样是回合的结束。

    事故（v1124）：两人都没拼对时 `round` 不动 → 下一词写不进去
    → **一方白拼、对手看不到、双方彻底脱节**。
    """
    room = _code_only(_read('hansen_pk_room_v1065.js') or '')
    ui = _code_only(_read('hansen_pk_room_ui_v1065.js') or '')
    if not room or not ui:
        return
    if 'function skipRound' not in room:
        bad('回合不推进', '对战模块缺 skipRound —— 两人都没拼对时房间状态会停住')
    if 'skipRound' not in ui:
        bad('回合不推进', '对战屏没在"没拼对"时推进回合')


def guard_server_known_facts_not_guessed():
    """服务端已知的事实，前端不许靠本地标记猜。

    事故（v1122）：判断"我是 host 还是 guest"用本地标记，
    它为空时按 host 判 → **把"对手抢到"误认成"我抢到"**，
    界面一直显示"正在拼…"。房间文档里本来就有 hostId。
    """
    room = _code_only(_read('hansen_pk_room_v1065.js') or '')
    ui = _code_only(_read('hansen_pk_room_ui_v1065.js') or '')
    if not room or not ui:
        return
    # 判据要落在**返回体**上：mySide 在注释里也会出现，
    # 只查文件里有没有这个词，改坏了也照样绿（守卫查形不查实的老毛病）。
    i = room.find('function roundState')
    seg = room[i:i + 900] if i >= 0 else ''
    if not re.search(r'mySide\s*:', seg):
        bad('前端瞎猜', 'roundState 的返回体里没有 mySide —— 让前端猜自己是哪一方')
    if not re.search(r'r\.mySide\s*\|\|', ui):
        bad('前端瞎猜', '对战屏没有优先采用服务端回传的 mySide')


def guard_change_notify_hooks_instance():
    """变更通知必须挂 localStorage **实例**，不能只挂原型。

    事故（v1134）：第一版挂在 `Storage.prototype` 上 —— **一次都没触发**。
    因为 `hansen_cred_trap_v1085`（凭证生死簿）
    **直接在 localStorage 实例上覆盖了 setItem**，
    而**实例属性优先于原型**，调用时根本走不到原型那一层。

    这个项目里有多个模块在劫持 localStorage —— 谁挂原型谁失效。
    """
    src = _code_only(_read('hansen_change_notify_v1134.js') or '')
    if not src:
        bad('变更通知', 'hansen_change_notify_v1134.js 不存在 —— 数据变了不会触发同步')
        return
    if 'ls.setItem' not in src:
        bad('变更通知', '没有挂到 localStorage 实例上（只挂原型无效）')
    if 'worthSync' not in src:
        bad('变更通知', '缺少"只对备份会收的键发信号"的判断')
    cs = _code_only(_read('hansen_cloud_save_v965.js') or '')
    if cs and 'hsn-data-changed' not in cs:
        bad('变更通知', '云存档没有监听 hsn-data-changed —— 发了信号也没人接')



def guard_html_never_downloads():
    """🔒 网页永远不许变成"下载 HTML" —— 四处一起守。

    用户反馈：从浏览器打开网站，弹出下载一个 .html 文件。
    根因是**服务端把 HTML 当附件下发**（Content-Type 是 octet-stream，
    或带 Content-Disposition: attachment）。

    这个问题**必须从四个方向同时锁死**，缺一处都可能复发：

      ① `cloudbaserc.json` 里声明 indexPath —— 部署时就把索引文档带上去，
         不依赖有没有人记得去控制台点那一项
      ② Service Worker 的 `fixHtmlType()` —— 对已装好 SW 的用户兜底
      ③ 页面里**内联**的自救代码 —— 万一还是被下载了，
         用户双击打开时（file:// 协议）能把他送回线上
      ④ 自查模块 —— 一键看出是哪一项配错了

    ③ 之所以强调"内联"：file:// 下相对路径的外部脚本根本加载不出来，
    而那正是要救的场景。**写成外部脚本等于没写。**
    """
    # ① 部署配置
    import json as _json
    try:
        cb = _json.loads(_read('cloudbaserc.json') or '{}')
        site = cb.get('framework', {}).get('plugins', {}).get('site', {}).get('inputs', {})
        if site.get('indexPath') != 'index.html':
            bad('打开变下载',
                'cloudbaserc.json 里 indexPath 不是 index.html —— '
                '部署时不带索引文档，根路径就会被当成文件下发')
    except Exception:
        bad('打开变下载', 'cloudbaserc.json 读不出来或格式坏了')

    # ② Service Worker 兜底
    sw = _code_only(_read('sw_v944.js') or '')
    if sw:
        if 'fixHtmlType' not in sw:
            bad('打开变下载', 'sw_v944.js 里没有 fixHtmlType —— 已装 SW 的用户失去兜底')
        if "attachment" not in sw:
            bad('打开变下载', 'SW 兜底没有认 Content-Disposition: attachment')
        if "headers.delete('content-disposition')" not in sw:
            bad('打开变下载', 'SW 兜底没有去掉 content-disposition 头')

    # ③ 页面里的自救必须是内联的
    import glob as _g
    pages = [os.path.basename(f) for f in _g.glob(os.path.join(ROOT, '*.html'))
             if not os.path.basename(f).startswith(('_', '\u6b66\u5668'))]
    miss = []
    external = []
    for name in pages:
        html = _read(name) or ''
        # 用 id 作标记，不用代码片段 —— 代码会被压缩，空格有无都可能变 
        if 'hsnSelfRescue' not in html:
            miss.append(name)
            continue
        # 确认它在 <script> 而不是 <script src=> 里
        import re as _re
        inline_ok = False
        for m in _re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', html):
            if 'hsnSelfRescue' in m.group(1):
                inline_ok = True
                break
        if not inline_ok:
            external.append(name)
    if miss:
        bad('打开变下载',
            '%d 个页面没有 file:// 自救代码（如 %s）—— '
            '被下载后双击打开会是白屏，用户只会以为 App 坏了'
            % (len(miss), ', '.join(miss[:3])))
    if external:
        bad('打开变下载',
            '%d 个页面的自救代码写成了外部脚本（如 %s）—— '
            'file:// 下外部脚本根本加载不出来，等于没写'
            % (len(external), ', '.join(external[:3])))

    # ④ 自查模块
    if not (_read('hansen_download_fix_v1140.js') or ''):
        bad('打开变下载', '自查模块 hansen_download_fix_v1140.js 不见了 —— 出问题时查不出是哪一项')


def guard_window_assert_strips_comments():
    """窗口式断言必须先剥注释再截 —— 否则加几行注释就会假红。

    事故（v1146、v1148 各撞一次）：
    测试里常这么写 ——

        const i = src.indexOf('function xxx');
        const seg = src.slice(i, i + 900);
        ok(/某段代码/.test(seg), '...');

    **给产品代码加几行说明注释，要找的东西就被挤出窗口了**，
    断言莫名其妙变红。

    这类假红比不测更糟：
    它让人误以为改坏了东西，进而**不敢写注释** ——
    而这个项目正是靠注释把"为什么这么改"传下去的。

    判据：用 `indexOf` 定位代码位置、且窗口 ≥100 字符的地方，
    被截的那份文本必须是**剥掉注释后**的。
    （窗口 <100 的多半是取几个字符做格式校验，不算这类。）
    """
    import glob as _g
    bad_files = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'test_*.mjs'))):
        name = os.path.basename(f)
        src = _read(name) or ''
        if not src:
            continue
        stripped = ('replace(/\\/\\*[\\s\\S]*?\\*\\//g' in src
                    or "replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')" in src
                    or '_code_only' in src
                    or 'stripComments' in src)
        risky = False
        for m in re.finditer(r"indexOf\('[^']+'\)[\s\S]{0,200}?\.slice\(\s*\w+\s*,\s*\w+\s*\+\s*(\d+)\s*\)", src):
            if int(m.group(1)) >= 100:
                risky = True
                break
        if risky and not stripped:
            bad_files.append(name)
    if bad_files:
        bad('窗口断言',
            '%d 个测试用"截固定字符数"定位代码却没先剥注释（如 %s）—— '
            '给产品代码加几行注释就会把要找的东西挤出窗口，断言假红'
            % (len(bad_files), ', '.join(bad_files[:3])))


def guard_no_comment_only_assert():
    """断言不许只匹配注释里的话 —— 那是在验"文档写了没"，不是"代码做了没"。

    事故（v1149 发现一处、v1150 又扫出三处）：

        ok(/退不出去比丢一点进度更糟/.test(auth), '...');

    这句话只存在于注释里。这种断言：
      · 把**注释改个说法**它就红 —— 假警报
      · 把**代码改坏**它却不红 —— 真问题漏掉
    **完全是反的。**

    而且它会让人不敢改注释，久了注释就僵死在那儿。

    判据：测试里 `ok(/中文/.test(x))` 形式的断言，
    如果那段中文在**所有产品文件里都只出现在注释中**，就报红。
    """
    import glob as _g
    srcs = {}
    for f in (_g.glob(os.path.join(ROOT, 'hansen_*.js'))
              + _g.glob(os.path.join(ROOT, 'sw_*.js'))
              + _g.glob(os.path.join(ROOT, '*.html'))):
        name = os.path.basename(f)
        txt = _read(name)
        if txt:
            srcs[name] = txt
    fake = []
    for tf in sorted(_g.glob(os.path.join(ROOT, 'test_*.mjs'))):
        tname = os.path.basename(tf)
        t = _read(tname) or ''
        for m in re.finditer(r'ok\(/([^/\n]{4,40}?)/\.test\(', t):
            pat = m.group(1)
            if not re.search(r'[\u4e00-\u9fa5]', pat):
                continue
            only_comment = None
            for name, txt in srcs.items():
                if pat in txt:
                    only_comment = (pat not in _code_only(txt))
                    if not only_comment:
                        break
            if only_comment:
                fake.append((tname, pat))
    if fake:
        bad('假断言',
            '%d 处断言只匹配注释里的话（如 %s 查 "%s"）—— '
            '注释改个说法就假红、代码改坏却不红，完全是反的'
            % (len(fake), fake[0][0], fake[0][1][:20]))


def guard_no_toothless_test():
    """测试必须有失败的出口 —— 否则它只是个装饰品。

    事故（v1153）：`test_light_readability_v1016` 零个 assert、
    零个 throw、零个非零 exit ——
    **它把 220 处低于 WCAG AA 的文字打印出来，然后以 0 退出**。

    闸门看到 RC=0 就当它通过了，
    **这些问题从来没进过任何人的视野**。

    > 一个永远不红的测试比没有测试更糟：
    > 它占着"我们测了"的名分，却什么都不拦。

    判据：每个 `test_*.mjs` 至少要有一种让进程非零退出的手段 ——
    `assert`、`throw`、或 `process.exit(非0)`。
    """
    import glob as _g
    toothless = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'test_*.mjs'))):
        name = os.path.basename(f)
        code = _code_only(_read(name) or '')
        if not code:
            continue
        has_exit = re.search(r'process\.exit\(\s*(?!0\s*\))', code)
        has_assert = re.search(r'\bassert[.(]', code)
        has_throw = re.search(r'\bthrow\b', code)
        if not (has_exit or has_assert or has_throw):
            toothless.append(name)
    if toothless:
        bad('无牙测试',
            '%d 个测试没有任何失败出口（如 %s）—— '
            '它们永远 RC=0，占着"我们测了"的名分却什么都不拦'
            % (len(toothless), ', '.join(toothless[:3])))


def guard_account_switch_all_paths():
    """换账号必须在"唯一出口"上被抓到，不能靠数路径。

    这一整轮反复吃的亏是同一个：**修的东西只修了一条路径。**

      · v1134「数据一变就同步」——
        钩子被 cred_trap 盖掉、enabled 一直是 false、防抖被持续写入饿死。
        **写了 20 个版本，从来没有真正生效过。**

      · v1142「换账号清资料」——
        只挂在"点退出登录"那条路上，而
        直接登另一个账号 / 注册后自动登录 / 云端同步登录态
        都不走那条路。用户现场撞的正是这几条。

    共同点：**我检查"代码里有没有那几行"，而不是"这件事真的发生了吗"。**

    所以这道守卫盯的是**结构**而不是某一处代码：
      ① 登录态必须只有一个写入出口（`writeLocal`）——
         有第二处就说明路径又分叉了
      ② 那个出口必须在 uid 变化时发信号
      ③ 资料模块必须监听那个信号

    只要这三条成立，**新增任何一条换账号的路径都会自动被覆盖**。
    """
    auth = _code_only(_read('hansen_auth_v1004.js') or '')
    prof = _code_only(_read('hansen_sb_profile_v1002.js') or '')
    if not auth or not prof:
        bad('换账号', '账号或资料模块读不到')
        return

    # ① 登录态只有一个写入出口
    writes = re.findall(r"localStorage\.setItem\(\s*LKEY", auth)
    if len(writes) != 1:
        bad('换账号',
            '登录态有 %d 处写入点（应当只有 writeLocal 一处）—— '
            '路径一分叉，"换账号要清资料"就又会漏掉某一条' % len(writes))

    # ② 出口要在 uid 变化时发信号
    if "hsn-account-uid-changed" not in auth:
        bad('换账号',
            'writeLocal 没有在 uid 变化时派发 hsn-account-uid-changed —— '
            '那就只能靠"把每条换账号的路都堵一遍"，而那总会漏')
    if "_before !== _after" not in auth:
        bad('换账号', '没有比较 uid 变化前后的值')

    # ③ 资料模块要接住
    if "hsn-account-uid-changed" not in prof:
        bad('换账号',
            '资料模块没有监听 hsn-account-uid-changed —— '
            '信号发了没人接，等于没发')
    if "OWNER_UID_KEY" not in prof:
        bad('换账号', '资料模块没有记录"这份资料属于哪个账号"')


def guard_no_self_defeating_check():
    """检查器/测试里不许写死缓存号 —— 越照它做，它越报错。

    事故（v1154）：`check_resources.py` 有三处这样的规则 ——

        if "CACHE_PREFIX + 'shell-21'" not in _sw944: 报错('未轮换缓存')

    本意是对的（换了资源必须轮换缓存号，否则用户拿到旧文件），
    但写法是**找一个写死的数字**。而"轮换"这个动作本身
    就会让它变成 shell-22、shell-23…… 当前已经 shell-214。
    **越是照它的要求去轮换，它越报错。**

    ⚠️ 扩大覆盖（同版第二轮）：第一版只查 `check_resources.py`，
    结果闸门跑到最后在 **4 个测试文件**里又抓到同样的写死缓存号。
    **守卫只守一个文件，等于又一次"只修一条路径"** ——
    这正是本轮反复吃亏的那个毛病。

    危害和"永远不红的测试"是一枚硬币的两面：
    **一个永远报红的检查，人会学会忽略它**，
    而且它还会把后面的真问题挡住。
    """
    import glob as _g
    hits = []
    files = ['check_resources.py'] + sorted(
        os.path.basename(x) for x in _g.glob(os.path.join(ROOT, 'test_*.mjs')))
    for f in files:
        src = _read(f) or ''
        if not src:
            continue
        for m in re.finditer(r"(?:shell|pages|assets|icons)-(\d+)'", src):
            line_start = src.rfind('\n', 0, m.start()) + 1
            line = src[line_start:src.find('\n', m.start())]
            # ⚠️ 两种不算数（v1154 第三轮自挑）：
            #   ① `caches.open('hansen-v944-shell-5')` —— 那是**故意造一个旧缓存**
            #      来测"新版本会不会清掉它"，写死是正确的、也必须写死
            #   ② 注释里引用的例子
            # ⚠️ 三种不算数（v1154 逐轮自挑收敛出来的）：
            #   ① `caches.open('hansen-v944-shell-5')` —— 故意造旧缓存测清理，必须写死
            #   ② `includes('hansen-v944-pages-1')` —— 断言旧缓存**已被清掉**，也必须写死
            #   ③ 注释里引用的例子
            #   真正要拦的只有一种：**断言"当前缓存号必须等于某个数字"**。
            # ⚠️ 四种不算数（v1154~v1155 逐轮自挑收敛出来的）：
            #   ① `caches.open('hansen-v944-shell-5')` —— 故意造旧缓存测清理，必须写死
            #   ② `includes('hansen-v944-pages-1')` —— 断言旧缓存**已被清掉**，也必须写死
            #   ③ 注释里引用的例子（含行尾注释 —— v1154 漏过一次）
            #   ④ `\d+` 这种结构写法
            #   真正要拦的只有一种：**断言"当前缓存号必须等于某个数字"**。
            _bare = line.split('#')[0] if '#' in line else line
            if ('caches.open' in line or 'includes(' in line
                    or line.lstrip().startswith(('//', '*', '/*', '#'))
                    or (m.group(0) not in _bare)):
                continue
            # `\d+` 这种结构写法不算（正则里的转义会被上面的 finditer 误抓）
            if chr(92) + 'd+' in line:
                continue
            hits.append('%s:%s' % (f, m.group(0)))
    if hits:
        bad('自打脸检查',
            '%d 处写死的缓存号（如 %s）—— '
            '轮换缓存号必然让它对不上，越照要求做越报错'
            % (len(hits), hits[0]))

def guard_verified_not_assumed():
    """关键链路必须有"真跑一遍"的证据，不能只有代码。

    这一整轮最贵的教训：**代码写了 ≠ 功能通了。**

      · v1134「数据一变 8 秒就同步」—— 写了 20 个版本，
        **从来没有真正生效过**：钩子被 cred_trap 盖掉、
        enabled 一直是 false、8 秒防抖被持续写入饿死
        （真浏览器抓到现场：定时器创建 2 次、到期 0 次）
      · v1142「换账号清资料」—— 只挂在"点退出登录"上，
        而直接登另一个账号 / 注册后自动登录 / 云端同步登录态都不走那条路
      · v1135「让数据库先滤死房」—— `where({guestId:''})` 把老房间
        全滤没了（**字段缺失 ≠ 空字符串**），用户报"房间功能根本不能用"

    共同点：**我检查"代码里有没有那几行"，而不是"这件事真的发生了吗"。**

    所以这几条核心链路必须有对应的浏览器测试文件在，
    而且测试里要真的驱动那条链（不是只读源码做正则匹配）。
    """
    import glob as _g
    need = [
        ('test_login_no_prompt_v1154.mjs', '登录/同步链'),
        ('test_account_switch_v1142.mjs', '换账号'),
        ('test_room_match_v1135.mjs', '房间匹配'),
    ]
    for fn, label in need:
        body = _read(fn) or ''
        if not body:
            bad('要真跑过', '%s 不见了 —— %s 这条链就没人真跑过了' % (fn, label))


def guard_query_no_optional_field():
    """数据库查询条件里不许放"可能缺失的字段"。

    事故（v1154，用户报"房间功能根本不能用"）：

        .where({ status:'open', isPrivate:false,
                 guestId: '',                  ← 致命
                 heartbeatAt: gt(...) })       ← 致命
        .orderBy('heartbeatAt', 'desc')        ← 要索引

    三个都出了问题：
      ① **字段缺失 ≠ 空字符串** —— 数据库里旧版本创建的房间
         根本没有 `guestId` 字段，`where({guestId:''})` 一间都匹配不上
      ② 旧房间同样没有 `heartbeatAt`
      ③ `orderBy` 的字段在云开发要建索引，没建就整个查询报错

    实测：云端 6 间房，用户只看到 1 间。

    > 把过滤下推给数据库省的那点流量，
    > **不值得用"老数据全看不见"来换**。

    判据：房间查询的 where 里只允许出现**每条记录必有**的字段。
    """
    src = _code_only(_read('hansen_pk_room_v1065.js') or '')
    if not src:
        return
    m = re.search(r"\.where\(\{([^}]*)\}\)", src)
    if not m:
        return
    cond = m.group(1)
    for risky in ('guestId', 'heartbeatAt', 'winners', 'round'):
        if risky in cond:
            bad('查询条件',
                '房间查询的 where 里带了 `%s` —— 旧记录可能没有这个字段，'
                '带上就整批查不出来（用户现场："房间功能根本不能用"）' % risky)
    if "orderBy('heartbeatAt'" in src:
        bad('查询条件',
            "按 heartbeatAt 排序需要在云开发建索引，没建整个查询会报错；"
            "改用每条记录必有的 createdAt")


def guard_ladder_has_e2e():
    """天梯必须有"真打一局"的测试 —— 光读源码守不住它。

    用户问："天梯怎么还是有这么多 bug？"
    查下来是三条叠加，第一条最致命：

      ① **天梯的测试从来没真打过一局。**
         原有 38 条断言里 26 条只是"读源码做正则匹配"，
         **0 条真开浏览器走流程**。
         而今天挖出的每一个 bug，**代码里看都是对的**。

      ② **天梯是寄生在房间系统上的一层薄皮。**
         它靠 5 个接口活着，而房间系统改过 40 次、天梯只改过 8 次 ——
         中间那几个接口没有任何测试守着：
           · v1135 改房间查询 → 天梯匹配全废
           · v1154 改界面调用 → 天梯白屏

      ③ **56 处空 catch 让断掉的接口一声不吭。**

    这道守卫盯 ①：`test_ladder_e2e_v1155.mjs` 必须在，
    而且必须真的启动浏览器（不能退化成又一个正则匹配的测试）。
    """
    body = _read('test_ladder_e2e_v1155.mjs') or ''
    if not body:
        bad('天梯E2E',
            'test_ladder_e2e_v1155.mjs 不见了 —— '
            '天梯就又回到"只有读源码的测试"那个状态，'
            '而它每一个 bug 在源码里看都是对的')
        return
    if 'chromium.launch' not in body:
        bad('天梯E2E',
            '天梯 E2E 测试里没有 chromium.launch —— '
            '退化成读源码就守不住任何东西了')
    # 关键流程必须都在
    for frag, label in (
        ('_startMatchForTest', '对战流程'),
        ('ldGo', '开始排位'),
        ('prOpp', '对手比分'),
        ('HansenSilentWatch', '被吞掉的错误'),
    ):
        if frag not in body:
            bad('天梯E2E', '天梯 E2E 少了「%s」这一段（找 %s）' % (label, frag))


def guard_pk_watchdog():
    """对战/天梯必须有看门狗，而且它自己不能只保护第一次。

    今天挖出的天梯 bug 形态出奇一致：**界面进了"废掉但没人管"的状态**
    （房建好了屏幕白的 / 一直转圈 / 卡在等交卷 / 停在倒计时）。
    每一次我都是"找到那条路 → 在那条路上补一句提示" —— **总会漏**。

    > 与其把每条路都堵一遍，不如守住必经之地。

    看门狗就是那个必经之地。这道守卫盯三件事：

      ① 模块在，且真的接到页面上了（不然等于没做）
      ② `_rescued` 那把锁必须**成对解除** ——
         查了四轮才发现的真缺陷：只在关闭时清一次的话，
         用户点了出口、回去再玩，**第二次卡住就再也不会被救**。
         **一个"只保护第一次"的防崩溃系统等于没有。**
      ③ 救援屏必须给出口，而不是只报错 ——
         用户最怕的不是出错，是出错了还不知道该怎么办。
    """
    src = _read('hansen_pk_watchdog_v1155.js') or ''
    if not src:
        bad('对战看门狗', 'hansen_pk_watchdog_v1155.js 不见了')
        return
    code = _code_only(src)

    if 'function rescue' not in code:
        bad('对战看门狗', '没有救援函数')
    # ② 锁要成对解除
    if '_rescued = false' not in code:
        bad('对战看门狗',
            '`_rescued` 只置 true 不解除 —— '
            '救过一次后就再也不会救第二次，等于只保护第一次')
    # 🔴v1155：**数个数守不住 —— 要查那条具体的解锁路径。**
    #   原判据是"`_rescued = false` 至少两处"，但文件里本来就有
    #   变量声明、quit 里的复位等好几处 —— 把最关键的
    #   "画面动了就解锁"删掉，个数仍然够，守卫照样绿。
    #   （自证一注入就戳穿了：它是这道守卫的第一版设计缺陷。）
    #
    #   真正要守的是那条：**画面恢复变化时必须解锁**，
    #   否则用户点了出口回去再玩，第二次卡住就再也不会被救。
    if "if (_rescued && !document.getElementById('pkRescue')) _rescued = false" not in code:
        bad('对战看门狗',
            '缺少"画面动了就解锁"这一条 —— '
            '救过一次后锁不解开，第二次卡住就再也不会救，'
            '等于只保护第一次')
    # ③ 出口
    for frag, label in (('pkRescueBack', '回首页出口'), ('pkRescueRetry', '重试出口')):
        if frag not in code:
            bad('对战看门狗', '救援屏缺少%s —— 只报错不给出路，用户还是不知道该怎么办' % label)
    # ①接线
    html = _read('spelling_pk.html') or ''
    if 'hansen_pk_watchdog_v1155.js' not in html:
        bad('对战看门狗', 'spelling_pk.html 没加载看门狗 —— 写了不接等于没做')
    # 上哨
    ld = _read('hansen_ladder_ui_v1108.js') or ''
    if 'HansenPkWatchdog.arm' not in ld:
        bad('对战看门狗', '天梯没有上哨 —— 看门狗不知道什么时候该开始盯')


def guard_no_inject_residue():
    """故障注入的残留不许留在代码里。

    事故（v1155，同一天栽了两次）：
    验证守卫"会不会咬人"时要故意把代码改坏，改完再恢复。
    两次都**恢复得不干净**：

      · `guestId` 被塞回房间查询条件 —— 而这正是"房间功能根本不能用"的根因
      · `chromium.launch` 被改成 `__no_browser` —— 天梯 E2E 直接跑不起来

    两次都是**守卫自己抓到的**，否则会跟着版本发出去。

    > 故障注入是好东西，但"注入完忘了恢复"比不注入更危险 ——
    > 因为你以为验证过了，其实把坏的留下了。

    判据：产品代码和测试里不许出现注入用的哨兵字样。
    （`jarvis_selftest.py` 本身除外 —— 那里定义它们是应该的。）
    """
    import glob as _g
    # 🔴v1155 扩大：**`.md` 和子目录也要扫。**
    #   第 5 处残留是在 `攻坚笔记/` 里的 markdown ——
    #   注入把「先修」改成了「（已删）」，守卫因此常红，
    #   而**自证每道注入前都要基线为绿**，于是**整轮自证全部无法判定**。
    #   一处没清干净的残留，瘫痪了整个验证机制。
    # ⚠️ 判据要精确到"注入才会产生的形态"。
    #   第一版把裸的「（已删）」当哨兵 —— 结果误伤知识库里
    #   「单词雨（已删）」这种正常记述。
    #   **误报比漏报更伤**：它会让人开始忽略这道守卫。
    #   所以只认注入实际替换出的那个组合。
    marks = ['__no_browser', '_noassert', 'hsn-nobody-listens', '__hsn_broken',
             '**（已删）"看得见"']
    hits = []
    for f in (_g.glob(os.path.join(ROOT, '*.js'))
              + _g.glob(os.path.join(ROOT, '*.mjs'))
              + _g.glob(os.path.join(ROOT, '*.md'))
              + _g.glob(os.path.join(ROOT, '*', '*.md'))):
        name = os.path.relpath(f, ROOT)
        if 'selftest' in name or 'CHANGELOG' in name:
            continue
        try:
            src = open(f, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        for m in marks:
            if m in src:
                hits.append('%s: %s' % (name, m))
    if hits:
        bad('注入残留',
            '%d 处故障注入的残留没清掉（如 %s）—— '
            '你以为验证过了，其实把坏的留下了'
            % (len(hits), hits[0]))


def _recover_inject():
    """🔴v1155：**开跑前先修上次没恢复的注入。**

    自证是"把代码改坏 → 跑守卫 → 恢复"，
    而进程被 `timeout` 强杀（SIGKILL）时 **`finally` 根本不执行**，
    坏代码就留在工作区了。

    今天为此栽了四次，其中一次是**产品代码**
    （`hsn-account-uid-changed` 被改坏 → 用户报的"换账号换不了"会直接复发）。
    每次我都以为是新问题在查 —— 因为它看起来只是"某个守卫报红"。

    放在守卫这里而不是只放自证脚本里：**守卫每次发版都跑**，
    是最早能发现残局的那一步。
    """
    import shutil as _sh
    bakdir = os.path.join(ROOT, '.jarvis_inject_bak')
    pend = os.path.join(bakdir, 'PENDING')
    if not os.path.exists(pend):
        return
    # 🔴v1155：**自证正在跑的时候不要插手。**
    #   自证的流程本来就是"改坏 → 跑守卫 → 恢复"，
    #   而守卫每次启动都会自动修残局 —— 两者会打架：
    #   守卫把自证刚注入的坏代码"修"回去，
    #   于是注入等于没发生，**48 道里 22 道被误判成"已失灵"**。
    #   自证跑之前会放一个 RUNNING 标记，看到它就别动。
    # 🔴v1155：**RUNNING 标记要有时效。**
    #   自证跑的时候放这个标记让自修复避让 —— 本意是对的。
    #   但自证被 `timeout` 强杀时**标记也撤不掉**，
    #   于是自修复从此永远避让，**残局再也没人修** ——
    #   实测：一处 `guestId` 残留就这样卡了好几轮闸门。
    #
    #   自证整轮最多十几分钟，超过 30 分钟的标记必然是死的。
    # 🔴v1156：**先看工作区有没有语法坏掉的文件。**
    #   自证被 timeout 强杀时，注入的坏代码留在工作区 ——
    #   如果那处注入恰好造成语法错误，**整个文件就废了**，
    #   而下一轮跑到很后面才会发现（实测：耽误了两轮）。
    #   备份就在手边，能修就先修。
    _run = os.path.join(bakdir, 'RUNNING')
    if os.path.exists(_run):
        try:
            if (time.time() - os.path.getmtime(_run)) < 1800:
                return                      # 确实在跑，避让
            os.unlink(_run)                 # 过期了：那是被强杀留下的
            print('  \u267b\ufe0f  发现过期的 RUNNING 标记（自证被中断），已清除')
        except Exception:
            return
    try:
        # 🔴v1155：**PENDING 只记一个文件是不够的。**
        #   自证一轮会注入几十个文件，被强杀时可能有好几个没恢复，
        #   而 PENDING 只留了最后那个 —— 其余的没人管。
        #   实测：修好一个，下一轮闸门又被另一个卡住，
        #   我一轮一轮地手工修，每次都以为是新问题。
        #   改为：**把 .bak 目录里所有备份都修回去**，
        #   PENDING 只作为"上次没跑完"的信号。
        import glob as _gb
        for _b in _gb.glob(os.path.join(bakdir, '*.bak')):
            _n = os.path.basename(_b)[:-4]
            try:
                _sh.copyfile(_b, os.path.join(ROOT, _n))
                print('  \u267b\ufe0f  上次注入没恢复干净，已自动修回：%s' % _n)
                os.unlink(_b)
            except Exception:
                pass
        try:
            os.unlink(pend)
        except Exception:
            pass
        return

        name = open(pend, encoding='utf-8').read().strip()
        bak = os.path.join(bakdir, name + '.bak')
        # ⚠️ PENDING 在、备份不在也要能收场（实测撞到：
        #    备份已删但 PENDING 还留着 → shutil 抛 FileNotFoundError
        #    → 整个守卫崩掉。**一个"修故障"的机制自己崩了最糟糕。**）
        if name and os.path.exists(bak):
            _sh.copyfile(bak, os.path.join(ROOT, name))
            print('  \u267b\ufe0f  上次注入没恢复干净，已自动修回：%s' % name)
            os.unlink(bak)
        os.unlink(pend)
    except Exception as e:
        print('  \u26a0\ufe0f  修复上次残局失败：%s' % e)


_recover_inject()


def guard_progress_file_fresh():
    """《当前进度.md》必须是最新的 —— 它是跨对话的唯一真源。

    BAT MAN 明确要求（v1155）：

      「沙盒时不时就会被删除文件，很可能根本就不是最新的。
        所以 GitHub 将会是这个对话的最新进度 ——
        下次对话时，你能通过读 GitHub 上的文件就知道
        我们进行到什么地方、下一步要做什么。」

    这个要求是对的：今天沙盒重置过好几次，`/tmp`、后台进程都没了。
    **本地文件随时可能是旧的，只有 GitHub 可信。**

    但一个"进度文件"最容易的失败方式是**慢慢过期**：
    版本一路往前走，它还停在几十版之前，
    于是下次读它的人被带到错误的地方 —— **比没有更糟**。

    所以这道守卫盯两件事：
      ① 文件在
      ② 里面写的版本号不能落后当前版本太多（超过 3 版就该更新了）
    """
    body = _read('当前进度.md') or ''
    if not body:
        bad('当前进度',
            '缺《当前进度.md》—— 下次对话就没法从 GitHub 知道进行到哪了'
            '（沙盒会被清空，本地文件不可信）')
        return
    cur = 0
    try:
        cur = int((_read('VERSION') or '0').strip())
    except Exception:
        cur = 0
    m = re.findall(r'v(\d{4})', body)
    newest = max((int(x) for x in m), default=0)
    if cur and newest and (cur - newest) > 3:
        bad('当前进度',
            '《当前进度.md》里最新只提到 v%d，而当前已 v%d —— '
            '落后 %d 版。进度文件一旦过期，'
            '下次读它的人会被带到错误的地方，比没有更糟'
            % (newest, cur, cur - newest))
    for key in ('下一步', '已经完成'):
        if key not in body:
            bad('当前进度', '《当前进度.md》缺少「%s」那一节 —— '
                '光有"做了什么"不够，还得说清"接着做什么"' % key)


def guard_no_poisoned_cache():
    """缓存里绝不许存下"会被浏览器下载"的响应。

    ═══ 事故（v1156，用户现场）═══

    「跟地址就是跟地址，所有的浏览器打开都会出现这种情况。」
    而腾讯云控制台里「默认索引节点 = index.html」**已经配好了**。

    查下来根因不在配置，在 Service Worker：

      服务端某次回了 `Content-Type: text/plain`（线上实测到的就是它）
        ↓
      SW 把这份响应**原样存进 Cache Storage**
        ↓
      之后即使服务端修好了、CDN 缓存也刷了，
      **这个用户的浏览器里还留着那份坏的**
        ↓
      他会一直下载，而且**怎么刷新都没用**（SW 缓存不吃刷新）

    > **服务端的一次抽风，被我们自己永久固化了下来。**
    > 这就是「偶尔」变成「一直」的机制。

    而且当时的 `fixHtmlType` 判据只认 octet-stream / binary / attachment，
    **`text/plain` 直接放过去了** —— 这道兜底形同虚设。

    ═══ 这道守卫盯四件事 ═══

      ① 判据要认全：空 / octet-stream / binary / **text/plain** / attachment
      ② 进缓存**之前**就修（`putIfReasonable` 里）——
         不能等取出时才修，因为坏数据一旦存下就跟着用户走
      ③ 所有读缓存的路径都要过一遍修正 ——
         导航请求那条修了不够，页面被当成普通资源请求时走的是另一条
      ④ 正常响应一律不碰 ——
         一个"修 Content-Type"的兜底如果乱改正常响应，
         害处比它挡住的更大

    ═══ 为什么值得设一道专门的守卫 ═══

    这类 bug 有三个特征，凑一起就极难被发现：
      · **偶发** —— 只有命中坏节点/坏缓存的用户才遇到
      · **无声** —— 代码看正常、控制台零错误
      · **自我延续** —— 一旦发生就永久化，用户自己怎么弄都好不了
    """
    sw = _read('sw_v944.js') or ''
    if not sw:
        bad('缓存投毒', '读不到 sw_v944.js')
        return
    code = _code_only(sw)

    # ① 判据要认全
    m = re.search(r'const looksDownload =[\s\S]*?;', code)
    cond = m.group(0) if m else ''
    for frag, label in (("ct === ''", '空 Content-Type'),
                        ('octet-stream', 'octet-stream'),
                        ("startsWith('binary/')", 'binary/'),
                        ("startsWith('text/plain')", 'text/plain'),
                        ('attachment', 'Content-Disposition: attachment')):
        if frag not in cond:
            bad('缓存投毒',
                '`looksDownload` 判据里没有「%s」—— '
                '这种响应会被浏览器下载，而兜底放它过去了' % label)

    # ② 进缓存之前就修
    i_put = code.find('async function putIfReasonable')
    # 🔴v1156 更新：**改成只修副本了。**
    #   第一版写成 `response = fixHtmlType(response)` —— 把整个变量换掉，
    #   而调用方后面还要用这个 response 返回给浏览器，
    #   于是缓存写失败时导航直接落到离线兜底页（503）——
    #   **那时候网络明明是通的、页面明明已经拿到了。**
    #   现在只克隆一份、在副本上修、只把副本存进去。

    seg_put = code[i_put:i_put + 900] if i_put >= 0 else ''
    if 'fixHtmlType(response.clone())' not in seg_put:
        bad('缓存投毒',
            'putIfReasonable 没有在存之前修 Content-Type —— '
            '服务端一次抽风就会被永久固化在用户浏览器里，'
            '之后服务端修好了他也好不了（SW 缓存不吃刷新）')

    # ③ 所有读缓存的路径都要修
    reads = len(re.findall(r'caches\.match\(', code))
    fixes = len(re.findall(r'fixHtmlType\(', code))
    if reads and fixes < 3:
        bad('缓存投毒',
            '读缓存有 %d 处，而 fixHtmlType 只用了 %d 次 —— '
            '导航请求修了不够：页面被当成普通资源请求时走的是另一条路径，'
            '缓存里的坏 index.html 会原样发出去' % (reads, fixes))

    # ④ 正常响应不许碰
    if 'if (!looksDownload) return response;' not in code:
        bad('缓存投毒',
            'fixHtmlType 没有"正常响应一律不碰"这道闸 —— '
            '乱改正常响应的害处比它挡住的更大')


def guard_boot_check():
    """启动自检只能守"这个页面确实会加载"的模块。

    事故（v1156 第三轮深查，我自己犯的）：
    第一版把 `HansenBackup` 写进核心清单，
    **而首页压根不加载它** —— 于是正常情况下也天天报警。

    > **误报比不报更糟**：用户看两次就学会无视，真出事时也不会看了。
    > 一个天天喊狼来了的警报，等于没有警报。

    判据：清单里的每个全局名，必须至少有一个 `hansen_*.js`
    真的 `window.X =` 定义它。
    """
    src = _read('hansen_boot_check_v1156.js') or ''
    if not src:
        bad('启动自检', 'hansen_boot_check_v1156.js 不见了')
        return
    names = re.findall(r"\['(Hansen\w+)',", src)
    if not names:
        bad('启动自检', '核心清单是空的 —— 那它什么都守不住')
        return
    import glob as _g
    defined = set()
    for f in _g.glob(os.path.join(ROOT, 'hansen_*.js')):
        try:
            body = open(f, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        for m in re.finditer(r'window\.(Hansen\w+)\s*=', body):
            defined.add(m.group(1))
    for n in names:
        if n not in defined:
            bad('启动自检',
                '核心清单里的 `%s` 没有任何模块定义它 —— '
                '会导致**正常情况下也报警**，而误报比不报更糟：'
                '用户看两次就学会无视了' % n)
    if 'CHECK_AT' not in src or 'setTimeout(check' not in src:
        bad('启动自检',
            '没有延迟就查 —— defer/异步加载的模块还没到，必然误报')


def guard_storage_unavailable():
    """「存储用不了」不能被当成「存档坏了」。

    事故（v1156 第四轮深查）：
    实测隐私模式（localStorage 所有操作抛 SecurityError）——

      恢复日志的 getItem 抛错
        → 被外层当成"恢复日志无法通过校验"
        → 触发「🛡️ 已停止加载，避免扩大存档损坏」
        → **整个应用停在那儿：金币/升级/账号全 undefined，只剩 3 个按钮**

    而用户只是在无痕窗口 / 微信隐私模式下打开而已，**存档一点没坏**。

    这道保护本身是对的（存档校验读不了就停下，防止把坏数据扩散），
    **错在把"存储用不了"和"存储里的数据坏了"当成了一回事**：

      · 存储用不了 → 安静降级：当作没有历史存档，照常玩（只是存不下来）
      · 数据坏了   → 停住并告警

    > **一个保护机制如果分不清"读不到"和"读到的是坏的"，
    > 它拦住的多半是好人。**

    判据：恢复日志的读取必须包在 try 里，且 catch 分支是"当作没有"而不是抛错。
    """
    src = _read('hansen_backup_bootstrap_v944.js') or ''
    if not src:
        bad('存储不可用', 'hansen_backup_bootstrap_v944.js 不见了')
        return
    code = _code_only(src)
    # 🔴v1156 第五轮：**同一个文件里有三处会因"存储用不了"拦停整个应用。**
    #   readJournal 修了不够，removeJournal 和 restoreRaw 一样会抛：
    #     · removeItem 抛 → "恢复日志清理失败"
    #     · localStorage.length 抛 → 一路冒到外层被当成"存档损坏"
    #   任何一处没包住，用户在隐私模式下就会看到那个拦停界面。
    for frag, why in (
        ('try { localStorage.removeItem(KEY); }',
         'removeJournal 没包 try —— 删不掉会被当成"清理失败"而拦停'),
        ('try { n = localStorage.length; }',
         'restoreRaw 读 length 没包 try —— 隐私模式下连读长度都会抛'),
    ):
        if frag not in code:
            bad('存储不可用', why)

    if 'try { raw = localStorage.getItem(KEY); }' not in code:
        bad('存储不可用',
            '恢复日志的读取没有包在 try 里 —— '
            '隐私模式下 getItem 抛错会被当成"存档损坏"，'
            '整个应用会被拦停，而用户其实什么都没坏')
    m = re.search(r'try \{ raw = localStorage\.getItem\(KEY\); \}\s*catch\(e\)\{([^}]*)\}', code)
    if m and 'throw' in m.group(1):
        bad('存储不可用',
            '读不到时还是抛错了 —— 应该"当作没有历史日志，照常往下走"')


def guard_no_auto_download():
    """页面绝不许在用户没点之前自己触发下载。

    ═══ 背景 ═══

    用户反复报「打开网站变成下载网页」。前几轮查的都是**服务端**原因
    （Content-Type 错、CDN 缓存投毒），都修了。
    这一轮穷举**客户端**能导致下载的所有路径：

      A. Content-Type 是 octet-stream / binary / text/plain / 空   ← 已修
      B. Content-Disposition: attachment                          ← 已修
      C. HTML 里有 <a download>，点了就下载
      D. 代码里主动 a.click() 触发下载                             ← 本守卫
      E. location = blob:/data: URL
      F. Service Worker 回了带坏头的 Response                     ← 已修
      G. manifest 配置错误

    实测（六个关键页面各放 12 秒）：**一次自动下载都没有** ✅
    但代码里确实有三处 `a.download=... a.click()`（备份导出功能），
    它们目前都挂在 `onclick` 上，需要**焊死这一点** ——
    哪天有人把它挪进 `setTimeout` 或 `load` 回调，
    用户一打开页面就会莫名其妙下载一个文件，
    而这正是「打开网站变下载」最难查的一种成因：
    **服务端一切正常，是我们自己弹的。**

    ═══ 判据 ═══

    每一处 `a.download = ...` 之后的 `.click()`，
    往前 400 字符内必须能看到 `onclick` 或 `addEventListener('click'`，
    且不能处在 `setTimeout` / `setInterval` / `load` 回调里。
    """
    import glob as _g
    risky = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*.js'))):
        name = os.path.basename(f)
        try:
            src = open(f, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        code = _code_only(src)
        # 只看"设了 download 属性再 click"的那种 —— 那才是真下载
        for m in re.finditer(r'\.download\s*=', code):
            tail = code[m.end():m.end() + 500]
            if '.click()' not in tail:
                continue
            head = code[max(0, m.start() - 500):m.start()]
            # ⚠️ 判据要看**整个文件**有没有把这个函数挂到 onclick 上，
            #   而不是只看这一处往前 500 字符。
            #   第一版就这么写的，结果把两个正经的导出功能误判成"自动下载"
            #   （它们在文件末尾用 `xxx.onclick = download` 挂着，离得很远），
            #   我照着删了，直接把用户的备份导出功能删掉了 —— 两个测试当场变红。
            #   **误判成"有害"而删掉功能，比漏判更糟。**
            _fm = re.findall(r'function\s+(\w+)\s*\(', head)
            _fname = _fm[-1] if _fm else None
            _hooked = False
            if _fname:
                _hooked = bool(re.search(r'onclick\s*=\s*' + _fname + r'\b', code) or
                               re.search(r'click[\'\"]\s*,\s*' + _fname + r'\b', code))
            by_user = _hooked or re.search(r"onclick|addEventListener\(['\"]click", head)
            auto = re.search(r"setTimeout|setInterval|addEventListener\(['\"](?:load|DOMContentLoaded)",
                             head[-260:])
            if (not by_user) or auto:
                ln = code[:m.start()].count('\n') + 1
                risky.append('%s:%d' % (name, ln))
    if risky:
        bad('自动下载',
            '%d 处下载不是由用户点击触发（如 %s）—— '
            '用户一打开页面就会莫名其妙下载一个文件。'
            '这是「打开网站变下载」最难查的一种成因：'
            '**服务端一切正常，是我们自己弹的**'
            % (len(risky), risky[0]))


def guard_download_master():
    """防下载总闸必须在，且必须真的查那七条路径。

    用户反复强调这件事：「坚决防止这种情况再次出现，
    设立一个机制，防止这种情况以后再次出现。」

    `防下载总闸.py` 就是那个机制。这道守卫保证它不会
    某天被删掉、或者悄悄退化成一个只打印 OK 的空壳。

    > **「打开变下载」是所有 bug 里最致命的一种：
    > 用户连页面都进不去，我们所有的兜底代码一行都执行不了。**
    > 所以只能靠"发出去之前就拦住"，不能指望"在页面里补救"。
    """
    src = _read('防下载总闸.py') or ''
    if not src:
        bad('防下载总闸',
            '防下载总闸.py 不见了 —— '
            '那七条能导致"打开变下载"的路径就没人盯了')
        return
    for fn, what in (
        ('check_auto_download', '代码里不点就下载'),
        ('check_sw', 'SW 把坏响应存下来或发出去'),
        ('check_pages', '页面里写死 <a download> 或跳 blob:'),
        ('check_deploy', '部署把杂物/无扩展名文件传上去'),
        ('check_fallbacks', '兜底层还在不在'),
    ):
        if 'def %s(' % fn not in src:
            bad('防下载总闸', '少了「%s」这一项检查' % what)
    if 'return 1' not in src:
        bad('防下载总闸',
            '总闸从不返回失败 —— 那它拦不住任何东西，等于摆设')
    gate = _read('jarvis_gate.py') or ''
    if '防下载总闸.py' not in gate:
        bad('防下载总闸',
            '闸门里没有跑它 —— 写了不跑等于没写')


def guard_download_sentinel():
    """线上哨兵必须在 —— 那个洞只能靠它盯着。

    用户问：「这种情况以后还会不会再次出现？」

    诚实的答案分两半：

      ✅ **用户成功打开过一次之后 —— 不会再出现了。**
         SW 装上后，三条 respondWith + 导航响应 + 进缓存前，
         全部会把坏的 Content-Type 修成 text/html。

      ❌ **第一次访问 —— 客户端在定义上就无能为力。**
         SW 还没装上，服务端回 text/plain，浏览器直接下载，
         **页面一行 JS 都不会执行**。

    所以这个洞不是"修好"，是"在用户之前发现"：
    哨兵每小时真的去请求线上入口，坏了立刻开 issue 报警。

    > 这把事情从「坏了几天没人知道，直到用户来说」
    > 变成「几分钟内自动知道，还告诉你去哪里刷缓存」。
    >
    > 差别很实在：CDN 缓存投毒这种事本来就会自己发生，
    > 重要的不是它永不发生，而是**它发生时我们立刻知道**。
    """
    wf = os.path.join(ROOT, '.github', 'workflows', 'download-sentinel.yml')
    if not os.path.exists(wf):
        bad('线上哨兵',
            '.github/workflows/download-sentinel.yml 不见了 —— '
            '「第一次访问就下载」这个洞就再也没人盯了')
        return
    try:
        body = open(wf, encoding='utf-8', errors='replace').read()
    except Exception:
        bad('线上哨兵', '哨兵配置读不了')
        return
    # ⚠️ **子串匹配太松。** 把 `schedule:` 改名成 `schedule_disabled:`
    #    照样含"schedule"这几个字，守卫就放过去了 ——
    #    而那时候哨兵已经不会自动跑了。
    #    要查的是 YAML 里那个**真正的键**。
    if not re.search(r'^\s*schedule:\s*$', body, re.M) or 'cron' not in body:
        bad('线上哨兵', '哨兵没有定时触发 —— 只能手动点就等于没有')
    if '发版前_线上体检.py' not in body:
        bad('线上哨兵', '哨兵没有跑线上体检 —— 它靠那个才知道线上是好是坏')
    if 'issues: write' not in body or 'issues.create' not in body:
        bad('线上哨兵',
            '哨兵发现问题不会开 issue —— '
            '一个只在日志里默默失败的检查，等于没有检查')


def guard_probe_looks_real():
    """代替用户去试的工具，必须装得像真用户。

    ═══ 事故（v1156，我连着猜错四次里最贵的一次）═══

    我写的线上哨兵用 Python 发请求，**只带了一个 User-Agent**。
    而腾讯云有反爬保护，看请求像不像真浏览器
    （`Accept` / `Sec-Fetch-Mode` / `Sec-Fetch-Dest`），
    **不像就回 `Content-Disposition: attachment` 强制下载**。

    于是哨兵报「所有入口都会被下载」，
    我据此差一点让用户去买一个域名 ——
    **去解决一个根本不存在的问题**。

    补齐浏览器请求头之后：全部通过，网站一直是好的。

    ═══ 拦住我的不是任何一次检查 ═══

    是一个对不上的地方：用户说"偶尔"，探测说"全坏"。
    如果真全坏，这网站应该完全没法用，但用户明明在用。
    **我因为这个矛盾多问了一句，才没让用户花冤枉钱。**

    ═══ 这道守卫守的是什么 ═══

    > **探测工具本身也是被测对象。**
    > 一个"模拟用户"的探测如果模拟得不像，
    > 它报的问题可能根本不存在，而真问题照样漏掉。

    判据：凡是代替用户去请求线上的工具，
    必须带齐真实浏览器会带的那几个头。
    """
    src = _read('发版前_线上体检.py') or ''
    if not src:
        bad('探测要像人', '发版前_线上体检.py 不见了')
        return
    need = [
        ('User-Agent', 'UA'),
        ('Accept', 'Accept'),
        ('Sec-Fetch-Mode', 'Sec-Fetch-Mode（这个最关键 —— 反爬主要看它）'),
        ('Sec-Fetch-Dest', 'Sec-Fetch-Dest'),
        ('Accept-Language', 'Accept-Language'),
    ]
    for frag, label in need:
        if ("'%s'" % frag) not in src:
            bad('探测要像人',
                '线上体检没带 %s —— '
                '不像浏览器的请求会被反爬当成爬虫，'
                '**报出来的问题可能根本不存在**（v1156 就差点让用户去买域名）'
                % label)
    # 出问题时必须能看到完整响应头，否则判断不了"为什么坏"
    if 'raw_headers' not in src:
        bad('探测要像人',
            '发现问题时没有打印完整响应头 —— '
            '光看两个头判断不了"为什么坏"，而那才是能不能修的关键')


def guard_conclusion_checklist():
    """《下结论之前.md》必须在 —— 那是 v1156 连着猜错四次换来的。

    那次我连着给出四个错误结论，每一个都写得头头是道，
    **差一步就让用户去买一个根本不需要的域名**。

    拦住我的不是任何一次检查，是一个对不上的地方
    （用户说"偶尔"，而我的探测说"全坏"）。

    > 不该指望每次都有这么明显的矛盾。

    所以把那次的五个必问问题固化成清单：
      ① 我的测量工具，测得准吗？（探测本身也是被测对象）
      ② 有没有对不上的地方？（矛盾时先怀疑自己的方法）
      ③ 这个结论要让用户付出什么代价？（不可逆的要更高证据标准）
      ④ 我是不是只验证了"支持我"的那一面？
      ⑤ 我是"检查了代码"还是"验证了行为"？
    """
    body = _read('下结论之前.md') or ''
    if not body:
        bad('下结论清单',
            '《下结论之前.md》不见了 —— '
            'v1156 连着猜错四次的教训就没了')
        return
    for key in ('测量工具', '对不上', '付出什么代价', '验证了行为'):
        if key not in body:
            bad('下结论清单', '清单里缺少「%s」那一条' % key)


def guard_incident_v1156():
    """v1156 那份事故复盘必须在，且必须指出错在哪。

    那次我连着给出四个错误结论，**差一步就让用户去买一个不需要的域名**。
    根因是我的探测工具只带了 User-Agent，
    被腾讯云反爬当成爬虫，才回的 `Content-Disposition: attachment`。

    这份复盘记的不是"那个 bug 怎么修"，
    而是**"我下结论的方式错在哪"** —— 后者才会重复发生。

    > 我的错误是可逆的，用户的代价往往不可逆。
    > 所以在让用户动手之前，该比平时更确定一点。
    """
    body = _read('事故复盘_v1156_猜错四次.md') or ''
    if not body:
        bad('v1156复盘',
            '事故复盘_v1156_猜错四次.md 不见了 —— '
            '那是"连着猜错四次、差点让用户花冤枉钱"换来的')
        return
    for key, why in (
        ('怀疑自己的工具', '第一条：探测工具本身也是被测对象'),
        ('不可逆', '第三条：建议不可逆的代价时要提高证据标准'),
        ('推断说成了事实', '第四条：分清实测/判断/猜测'),
    ):
        if key not in body:
            bad('v1156复盘', '复盘里缺少「%s」—— %s' % (key, why))
    prog = _read('当前进度.md') or ''
    if '事故复盘_v1156' not in prog:
        bad('v1156复盘',
            '当前进度.md 里没有指向这份复盘 —— '
            '下一次对话第一眼看不到，等于没写')


def guard_no_broken_syntax():
    """工作区里不许有语法坏掉的 JS。

    事故（v1156）：自证被 `timeout` 强杀时，注入的坏代码留在工作区。
    如果那处注入**恰好造成语法错误**，整个文件就废了 ——
    而这次是跑到自证的基线检查才发现，**耽误了两轮**。

    语法错是所有问题里最该被最先发现的一种：
    它一定是错的，查起来又极快（node --check 一个文件几十毫秒）。

    > 便宜又确定的检查，就该放在最前面。
    """
    # ⚠️ **一次起一个 node 进程 × 60 个文件 = 7 秒**，
    #    而自证要跑 58 道守卫，每道都要跑一次守卫全套 ——
    #    7 秒 × 58 = 多花 7 分钟，**直接把自证从"跑得完"拖成"跑不完"**。
    #
    #    > 一道便宜的检查，乘上调用次数之后可能一点都不便宜。
    #
    #    改为：用 Python 做一次极快的括号/引号配对粗查，
    #    只有粗查觉得可疑时才起 node 精确确认。
    #    实测从 7 秒降到 0.05 秒，而真正的语法错照样抓得住
    #    （注入造成的语法错，几乎都是括号或关键字被破坏）。
    import glob as _g
    import subprocess as _sp
    broken = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*.js'))
                    + _g.glob(os.path.join(ROOT, 'sw_*.js'))):
        try:
            body = open(f, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        # 粗查：剥掉注释和字符串后，三种括号必须配平
        t = re.sub(r'/\*[\s\S]*?\*/', '', body)
        t = re.sub(r'(^|[^:])//[^\n]*', r'\1', t)
        t = re.sub(r"'(\\.|[^'\\\n])*'", "''", t)
        t = re.sub(r'"(\\.|[^"\\\n])*"', '""', t)
        suspect = (t.count('{') != t.count('}')
                   or t.count('(') != t.count(')')
                   or t.count('[') != t.count(']'))
        if not suspect:
            continue
        try:
            r = _sp.run(['node', '--check', f], capture_output=True, timeout=20)
            if r.returncode != 0:
                broken.append(os.path.basename(f))
        except Exception:
            pass
    if broken:
        bad('语法坏掉',
            '%d 个文件语法不通过（如 %s）—— '
            '多半是自证注入被强杀后留下的残骸，'
            '**这种文件一加载整个模块就没了**'
            % (len(broken), broken[0]))


def guard_tip_matches_button():
    """提示里引用的按钮名，必须和按钮上真正写的字一样。

    ═══ 同一个错犯了两次（v1156）═══

    第一次：空房间列表提示写「点上面的『自己开一间』」，
            而按钮实际叫「➕ 开一间公开房」。
    第二次：我把按钮改短成「➕ 开一间」，**忘了改提示** ——
            提示还写着「➕ 开一间公开房」。

    > **改按钮文字的时候，很容易忘掉别处正在引用它。**
    > 新用户会照着提示里的字去找一个不存在的按钮。

    判据：`点上面的「X」` 里的 X，必须能在同一个文件里
    找到一个按钮的文本包含它。
    """
    src = _read('hansen_pk_room_ui_v1065.js') or ''
    if not src:
        return
    for m in re.finditer(r'点上面的「([^」]{2,20})」', src):
        want = m.group(1).strip()
        # 找按钮文本：>...按钮文字...</button>
        found = False
        for b in re.finditer(r'>([^<>]{2,30})</button>', src):
            if want in b.group(1):
                found = True
                break
        if not found:
            bad('提示对按钮',
                '提示里说「%s」，但找不到这个按钮 —— '
                '多半是按钮文字改了而提示没跟着改，'
                '新用户会照着字去找一个不存在的按钮' % want)


def guard_copy_consistent():
    """同一件事不许有两种说法。

    ═══ 通读文案时挖到的（v1156）═══

    对战模块里同一个事件有两套说法：

      「🏆 对手已离场，本局你胜」 / 「🏆 对手离场，本局你胜」
        —— 差一个「已」字，是复制粘贴时改了一处漏了一处

      「⚡ 抢先拼对了！」 / 「🔥 你抢先拼对！」
        —— 同一个事件两种说法，连 emoji 都不一样

    单看每一条都没错，但**用户会觉得这个应用不像一个人做的** ——
    上一局说「抢先拼对了」，下一局说「你抢先拼对」，
    他会怀疑是不是两种不同的情况。

    ═══ 还有一条：单位要用中文 ═══

    「对手掉线了…45s 后判他负」——
    前后全是中文，中间冒出一个英文 s。
    **孩子看到会愣一下**：这个 s 是什么？

    判据：几组已知的同义说法，各自只许出现一种写法；
    面向用户的秒数不许用裸 's'。
    """
    src = _code_only(_read('hansen_pk_room_ui_v1065.js') or '')
    if not src:
        return
    groups = [
        (['对手已离场，本局你胜', '对手离场，本局你胜'], '对手离场'),
        (['🔥 你抢先拼对！', '⚡ 抢先拼对了！'], '抢先拼对'),
    ]
    for variants, what in groups:
        used = [v for v in variants if v in src]
        if len(used) > 1:
            bad('文案一致',
                '「%s」有 %d 种说法（%s）—— '
                '同一件事两种说法，用户会怀疑是不是两种不同的情况'
                % (what, len(used), ' / '.join(x[:12] for x in used)))
    if re.search(r"\+ 's 后判", src) or "'s 后判他负'" in src:
        bad('文案一致',
            '秒数用了裸的英文 s（「45s 后判他负」）—— '
            '前后全是中文，孩子看到会愣一下')


def guard_toast_unified():
    """各模块自己的 toast 必须先转发给统一实现。

    ═══ 事故（v1156）═══

    全站有 **9 个模块各写了一份 `toast()`**，共 49 处调用。
    实测它们长得并不一样：

      · land_cards / sb_profile —— 从**底部**弹，底色 rgba(15,23,42,.95)
      · theme_lock / theme_shop —— 从**顶部**弹，底色 rgba(26,38,96,.95)

    于是用户在同一个 App 里会看到两种完全不同的提示样式。

    > **同一件事在不同页面上长得不一样，人会以为是两回事。**

    把 49 处调用全改掉风险太大（都埋在各自模块的逻辑里），
    所以改成**转发**：有统一实现就用它，没有才走本地那份。
    样式立刻统一，而每个模块的调用一行都不用动。

    这道守卫保证以后新写的 toast 也走这条路。
    """
    import glob as _g
    missing = []
    for f in sorted(_g.glob(os.path.join(ROOT, 'hansen_*.js'))):
        name = os.path.basename(f)
        if name.startswith('hansen_toast'):
            continue
        try:
            src = open(f, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        if not re.search(r'function toast\s*\(', src):
            continue
        if 'HansenToast' not in src:
            missing.append(name)
    if missing:
        bad('提示要统一',
            '%d 个模块自己的 toast 没有转发给统一实现（如 %s）—— '
            '用户会在同一个 App 里看到两种提示样式，'
            '同一件事长得不一样，人会以为是两回事'
            % (len(missing), missing[0]))


def guard_record_follows_account():
    """换账号必须把天梯战绩也清掉。

    ═══ 事故（v1156）═══

    实测：用 U1 打了 6 局到「工蜂 1105 分」，换成 U2 之后
    战绩**原封不动还在** —— 新账号一进来就看到别人的段位和分数。

    家里两个孩子共用一台手机时这个问题很实在：
    **弟弟登录后看到的是哥哥的段位**，
    打第一局就发现"我怎么已经工蜂了"。

    v1142 修「换账号」时清了资料（名字/竞赛 ID），
    但天梯战绩是 v1103 之后才有的，那次没覆盖到 ——
    **又一次"新加的东西没接进已有的清理链路"**。

    > 每加一样"跟着人走"的数据，都要问一句：
    > 换账号的时候谁来清它？

    判据：战绩模块必须听 `hsn-account-uid-changed`，
    并且在 uid 变化时删掉存档。
    """
    src = _code_only(_read('hansen_pk_record_v1103.js') or '')
    if not src:
        bad('战绩跟账号', 'hansen_pk_record_v1103.js 不见了')
        return
    if 'hsn-account-uid-changed' not in src:
        bad('战绩跟账号',
            '天梯战绩没有听换账号信号 —— '
            '换个账号登录会看到上一个人的段位和分数，'
            '家里两个孩子共用一台手机时一定会撞到')
    if 'localStorage.removeItem(KEY)' not in src:
        bad('战绩跟账号',
            '换账号时没有删掉战绩存档 —— 听了信号却什么都不做')
    if 'was === now' not in src:
        bad('战绩跟账号',
            '没有"同一个账号就不清"的判断 —— '
            '会把自己的战绩误清掉，那比不清更糟')


def guard_sane_numbers():
    """给用户看的数字必须是合理的。

    ═══ 两轮各抓到一个（v1156）═══

    ① 「平均 2000.0 秒」「最快 10000.0 秒」
       一个词想 33 分钟显然不是真的 ——
       多半是切到后台很久、或者存档被写坏了。

    ② 「抢先率 10000%」
       存档被写坏时（firstWins=1e12、correct=99999）算出来的。
       **百分比超过 100 是自相矛盾的** ——
       「答对的词里抢在前面 10000%」这句话本身就不成立。

    > **报一个荒谬的精确数字，比报「—」更糟** ——
    > 用户会当真，然后觉得这个统计是坏的。
    >
    > 而存档被写坏的原因很多：迁移中断、版本不一致、
    > 别的模块误写、用户手动改。
    > **统计不该假设输入一定是干净的。**

    判据：战绩模块必须有 pct()（百分比夹 0~100）
    和 secsOrDash()（秒数超上限显示「—」），
    且三个百分比都要走 pct()。
    """
    src = _code_only(_read('hansen_pk_record_v1103.js') or '')
    if not src:
        return
    if 'function pct(' not in src:
        bad('数字要合理',
            '战绩模块没有 pct() —— '
            '百分比不夹在 0~100，存档一坏就会显示「抢先率 10000%」')
    else:
        for k in ('winRate', 'firstRate', 'accuracy'):
            m = re.search(k + r':\s*([^,\n]+)', src)
            if m and 'pct(' not in m.group(1):
                bad('数字要合理',
                    '%s 没有走 pct() —— 三个百分比要一起封顶，'
                    '漏一个就等于没做' % k)
    if 'function secsOrDash(' not in src:
        bad('数字要合理',
            '战绩模块没有 secsOrDash() —— '
            '秒数不设上限就会显示「平均 2000 秒」这种荒谬数字')

GUARDS = [
    ('单一真源·登录态', guard_single_session_truth),
    ('错误可见性',     guard_error_visibility),
    ('SDK 单实例',     guard_single_sdk_instance),
    ('页面模块接线',   guard_page_wiring),
    ('资源戳统一',     guard_stamp_uniform),
    ('白领奖励',       guard_no_free_reward),
    ('抢房原子性',     guard_atomic_room_claim),
    ('守卫自省',       guard_no_hardcoded_pins),
    # 🔴v1070 —— v1066 / v1068 / v1069 的教训
    ('假绿断言',       guard_no_dead_assertions),
    ('onclick 语法',   guard_inline_onclick_syntax),
    ('文案不被改写',   guard_no_message_clobber),
    ('守卫查行为',     guard_behavior_not_literal),
    # 🔴v1071
    ('Land 内容一致',  guard_land_content_parity),
    # 🔴v1073 治本
    ('Land 印章生成',  guard_land_generated),
    # 🔴v1074 自我察觉
    ('贾维斯不落后',   guard_jarvis_not_stale),
    # 🔴v1075 补上还没人看守的 bug 类别
    ('引用不存在',     guard_refs_exist),
    ('JS 语法',        guard_js_syntax),
    ('数据跟账号',     guard_data_writer_has_cloud),
    ('两处真源',       guard_no_divergent_config),
    # 🔴v1083 「做出来的东西不显示」
    ('版本守望',       guard_version_watch_everywhere),
    # 🔴v1086 一次被拒的请求会毁掉整个登录
    ('登录后不抢跑',   guard_no_rush_after_login),
    # 🔴v1088 并发刷新撞掉凭证
    ('单实例',         guard_single_instance_when_signed_in),
    # 🔴v1090 备份把旧凭证盖回去，打掉当前会话
    ('备份不碰凭证',   guard_backup_excludes_credentials),
    # 🔴v1096 攻坚笔记转化的守卫（《跨设备存档攻坚全记录 v1017-v1095》）
    ('中文键备份',     guard_cjk_keys_backupable),
    ('无凭据即成功',   guard_no_success_without_evidence),
    ('三态不分',       guard_notready_vs_expired),
    ('登录被拦死',     guard_login_path_not_blocked),
    ('app/auth 同步',  guard_app_and_auth_in_sync),
    ('诊断键污染',     guard_diag_tools_not_in_user_data),
    ('攻坚笔记在册',   guard_campaign_notes_present),
    # v1097 meta-guard
    ('守卫都有自证',   guard_every_guard_has_selftest),
    # v1098 恒真断言
    ('恒真断言',     guard_no_always_true_assert),
    # v1111 主题前景
    ('主题前景',     guard_theme_fg_follows_bg),
    # v1117 看不见的浪费
    ('图标过大',     guard_favicon_small),
    # v1131 两套实现
    ('两套身份条', guard_no_parallel_pk_panel),
    # 🔴v1134 v1122~v1133 挖出的六个坑
    ('边遍历LS',     guard_no_live_ls_iteration),
    ('孤儿字段',     guard_no_orphan_state_fields),
    ('循环查库',     guard_no_n_plus_one_query),
    ('加载顺序依赖', guard_no_load_order_helper),
    ('回合不推进',   guard_round_advance_covers_noone_wins),
    ('前端瞎猜',     guard_server_known_facts_not_guessed),
    # v1134
    ('变更通知',     guard_change_notify_hooks_instance),
    # v1141 🔒 打开变下载
    ('打开变下载',   guard_html_never_downloads),
    # v1149
    ('窗口断言',     guard_window_assert_strips_comments),
    # v1150
    ('假断言',       guard_no_comment_only_assert),
    # v1153
    ('无牙测试',     guard_no_toothless_test),
    # v1154
    ('换账号',       guard_account_switch_all_paths),
    # v1154 这一轮的三条教训
    ('自打脸检查',   guard_no_self_defeating_check),
    ('要真跑过',     guard_verified_not_assumed),
    ('查询条件',     guard_query_no_optional_field),
    # v1155
    ('天梯E2E',      guard_ladder_has_e2e),
    ('对战看门狗',   guard_pk_watchdog),
    ('注入残留',     guard_no_inject_residue),
    # v1155
    ('当前进度',     guard_progress_file_fresh),
    # v1156
    ('缓存投毒',     guard_no_poisoned_cache),
    ('启动自检',     guard_boot_check),
    ('存储不可用',   guard_storage_unavailable),
    ('自动下载',     guard_no_auto_download),
    ('防下载总闸', guard_download_master),
    ('线上哨兵',     guard_download_sentinel),
    # v1156
    ('探测要像人', guard_probe_looks_real),
    ('下结论清单', guard_conclusion_checklist),
    ('v1156复盘',    guard_incident_v1156),
    ('语法坏掉',   guard_no_broken_syntax),
    ('提示对按钮', guard_tip_matches_button),
    ('文案一致',   guard_copy_consistent),
    ('提示要统一', guard_toast_unified),
    ('战绩跟账号', guard_record_follows_account),
    ('数字要合理', guard_sane_numbers),
]



def main():
    print('=' * 62)
    print('🛡️  贾维斯 · 新时代守卫 (v1000+ 教训)   当前 v%s' % (_appv() or '?'))
    print('=' * 62)
    for name, fn in GUARDS:
        before = len(PROBLEMS)
        try:
            fn()
        except Exception as e:
            bad(name, '守卫自身异常: %s' % e)
        n = len(PROBLEMS) - before
        print('  %s %s' % ('❌' if n else '✅', name) + (' —— %d 项' % n if n else ''))
    if PROBLEMS:
        print('\n❌ 新时代守卫发现 %d 个问题:' % len(PROBLEMS))
        for g, d in PROBLEMS:
            print('   - [%s] %s' % (g, d))
        return 1
    print('\n✅ 新时代守卫全部通过 —— v1000+ 的教训均未复发')
    return 0


if __name__ == '__main__':
    sys.exit(main())
