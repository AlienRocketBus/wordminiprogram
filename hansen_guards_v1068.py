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
import os, re, sys, glob

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


GUARDS = [
    ('单一真源·登录态', guard_single_session_truth),
    ('错误可见性',     guard_error_visibility),
    ('SDK 单实例',     guard_single_sdk_instance),
    ('页面模块接线',   guard_page_wiring),
    ('资源戳统一',     guard_stamp_uniform),
    ('白领奖励',       guard_no_free_reward),
    ('抢房原子性',     guard_atomic_room_claim),
    ('守卫自省',       guard_no_hardcoded_pins),
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
