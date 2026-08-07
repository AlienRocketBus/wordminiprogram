#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jarvis_selftest.py —— 贾维斯 · 守卫自证（v1074）

要解决的问题
============
本项目已经写进知识库的一条元教训是：

    **守卫报红 ≠ 有 bug；守卫全绿 ≠ 没 bug。**

前半句 v1069 已经验证过（抽查 4 条红灯，3 条是虚报）。
**后半句才是更危险的那一半**：一道守卫如果自己坏了（正则失效、
判据钉在早已改写的代码上、文件路径变了），它会安安静静地永远显示 ✅，
而它本该守着的那个 bug 可以大摇大摆地复发。

这不是假想 —— v1069「星海觉醒进不去」那两道守卫恰恰相反地证明了同一件事：
判据钉在具体代码形态上，代码一变，守卫就与现实脱节。

做法：给每道守卫准备一份「故障样本」，逐一注入 → 跑守卫 → 必须变红 → 还原。
**变不红的守卫 = 已经失灵的守卫**，和没有一样，必须当场报出来。

这也是「贾维斯随时进化」真正的落点：
不是每次加几条规则，而是让它**能自己发现哪条规则已经不管用了**。
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
GUARDS = os.path.join(ROOT, 'hansen_guards_v1068.py')

# (守卫显示名, 目标文件, 注入函数)
#   注入函数：拿到原文，返回「坏掉的」新文本；返回 None 表示跳过。
def _inj_session(s):
    """守卫判据：云存档 _app() 里 A.ensureSession() 必须在 A._app() 之前被调用。
       故样本要打在**云存档的调用顺序**上，而不是改 auth 的函数名。"""
    return s.replace('return A.ensureSession().then(function (s) {',
                     'return Promise.resolve(A._app()).then(function (s) {', 1)

def _inj_errvis(s):
    """守卫判据是子串 `'errText' not in auth` —— 所以改名成 errText_GONE 没用
       （仍含 errText 子串，这一点是自证机制自己发现的）。
       必须把**所有** errText 出现处全部改掉才算真的"没有这个能力"。"""
    return s.replace('errText', 'errTXT_GONE')

def _inj_sdk(s):
    return s.replace("import('./vendor_cloudbase_esm_v965.js')",
                     "import('./vendor_cloudbase_esm_v965.js?v=999')", 1)

def _inj_wiring(s):
    return re.sub(r'<script defer src="hansen_auth_v1004\.js\?v=\d+"></script>', '', s, count=1)

def _inj_stamp(s):
    return re.sub(r'\?v=(\d+)', lambda m: '?v=1004', s, count=1)

def _inj_freereward(s):
    """守卫判据：不得出现 progress = Math.min(Math.floor(saved.progress), item.goal)。
       故样本要精确还原那句被 v1060 干掉的写法。"""
    return s.replace('item.progress = 0;\n      } else {\n        item.progress = Math.floor(saved.progress);',
                     'item.progress = Math.min(Math.floor(saved.progress), item.goal);\n      } else {\n        item.progress = Math.floor(saved.progress);', 1)

def _inj_room(s):
    """守卫判据：joinRoom 里不得出现 read(...) 后紧跟 patch(...) 的"先读再写"形态。
       故样本要在 joinRoom 内真的写成那种形态。"""
    return s.replace("    return T().claim(roomId, { status: 'open', guestId: '' }, {",
                     "    return T().read(roomId).then(function(){ return T().patch(roomId, {status:'playing'}); }).then(function(){ return {updated:1}; });\n    return T().claim(roomId, { status: 'open', guestId: '' }, {", 1)

def _inj_dead_assert(s):
    return s + "\nok(true, '这条永远不会跑');\n"

def _inj_onclick(s):
    return s.replace('bar.onclick = function () {',
                     'bar.setAttribute(\'onclick\', "window.(function(){})()");\n      bar.onclick = function () {', 1)

def _inj_clobber(s):
    return s.replace("if(/anonymous|ANONYMOUS|signInAnonymously|匿名/i.test(m))",
                     "if(/anonymous|登录|匿名/i.test(m))", 1)

def _inj_land_parity(s):
    m = re.search(r'<div class="mode-card"[^>]*onclick="openSpellPK\(\)"[^>]*>.*?</div>\s*</div>', s, re.S)
    return s[:m.start()] + s[m.end():] if m else None

def _inj_land_stamp(s):
    return s.replace('<title>', '<title>手改痕迹', 1)



def _inj_ref_missing(s):
    """v1057 类别：引用一个不存在的文件。"""
    return s.replace("import('./vendor_cloudbase_esm_v965.js')",
                     "import('./vendor_cloudbase_esm_v9999.js')", 1)

def _inj_js_syntax(s):
    """整份文件语法坏掉。用无条件追加，保证一定生效。"""
    return s + '\n(function(){ if(( }\n'  # 故意的语法错误

def _inj_data_no_cloud(s):
    """写玩家数据却没有云存档模块。"""
    import re as _r
    return _r.sub(r'<script defer src="hansen_cloud_save_v965\.js\?v=\d+"></script>', '', s, count=1)

def _inj_divergent(s):
    """守卫比的是**相对最长的那一份**，所以砍短基准页没用
       （它自己变成最短的，但"最全的一份"也跟着变）——这一点是自证机制自己发现的。
       真实事故的形态是：**某个 JS 模块里内嵌了一份更短的副本**
       （v1034/v1071 的 hansen_island_upgrade.js 就是 36 条 vs 144 条）。
       所以样本改成：往模块里塞一份 30 条的短副本。"""
    items = ','.join("{id:'fake%d',cat:'x',name:'n',desc:'d'}" % k for k in range(30))
    return s + '\n/* selftest */ var __FAKE_ACH=[' + items + '];\n'

def _inj_divergent_OLD(s):
    """(旧样本，留档说明为什么不行)"""
    import re as _r
    m = _r.search(r'(?:const|var|let)\s+ACHIEVEMENTS\s*=\s*\[', s)
    if not m: return None
    i = m.end() - 1; d = 0
    for j in range(i, len(s)):
        if s[j] == '[': d += 1
        elif s[j] == ']':
            d -= 1
            if d == 0: break
    inner = s[i+1:j]
    parts = _r.findall(r"\{id:'.*?\}(?=,\{id:'|$)", inner)
    if len(parts) < 40: return None
    return s[:i+1] + ','.join(parts[:30]) + s[j:]



def _inj_no_version_watch(s):
    """把某个页面的版本守望者拆掉 —— 那一页就可能永远跑旧代码。"""
    import re as _r
    return _r.sub(r'<script defer src="hansen_version_watch_v1083\.js\?v=\d+"></script>', '', s, count=1)



def _inj_rush_after_login(s):
    """把登录后的等待改回 1.2 秒 —— 那正是会毁掉登录会话的抢跑。"""
    return s.replace('}, 4000);', '}, 1200);', 1)



def _inj_multi_instance(s):
    """守卫用 find('_hasAcct') 定位，改名成 _hasAcctMOVED 仍含该子串 —— 打不中
       （这一点是自证机制自己发现的）。真实故障形态是**多一处 cloudbase.init**，
       那正是并发刷新撞掉凭证的根源。"""
    return s.replace('  function friendly(err){',
                     '  function _selftestExtra(){ return cloudbase.init({ env: \'x\' }); }\n  function friendly(err){', 1)



def _inj_backup_takes_creds(s):
    """把凭证排除拆掉 —— 那正是 v1090 之前的状态，凭证会被备份并写回。"""
    return s.replace('    if(credentialKey(k))return false;      /* v1090', '    /* 已拆除 /* v1090', 1)



def _inj_cjk_off(s):
    """取消中文键放行 —— 用户的「我的学习」数据会让整个备份失败。
       注意：`u4e00` 在说明注释里也出现，简单 replace 会打在注释上（打不中真代码）。
       必须整行替换 KEY_CHARSET 的定义本身。"""
    import re as _r
    i = s.find('var KEY_CHARSET')
    if i < 0: return None
    j = s.find('\n', i)
    return s[:i] + 'var KEY_CHARSET = /^[A-Za-z0-9_:\\-.]+$/;' + s[j:]

def _inj_notready_off(s):
    """把 notReady 去掉 —— 「尚未就绪」又会被说成「已过期」。
       同理：notReady 在注释里也出现，只替换 ensureSession 函数体内的那一处。"""
    i = s.find('function ensureSession')
    if i < 0: return None
    seg = s[i:i+3000]
    if 'notReady' not in seg: return None
    # 函数体内所有 notReady 一并改掉 —— 守卫查的是"这个函数体里有没有这个概念"
    return s[:i] + seg.replace('notReady', 'nrGONE') + s[i+3000:]

def _inj_notes_gone(s):
    """笔记核心结论被删 —— 近 80 版换来的经验会丢。"""
    return s.replace('先修', '（已删）', 1)



def _inj_no_cred_check(s):
    """去掉登录后的凭证校验 —— 又会出现"界面说已登录、云端没会话"。"""
    i = s.find('function loginByPhoneCode')
    if i < 0: return None
    seg = s[i:i+4000]
    if 'credentials' not in seg: return None
    return s[:i] + seg.replace('credentials', 'credGONE') + s[i+4000:]


def _inj_block_login(s):
    """子框内无条件拒绝 —— v1090 就是这样让用户连登录都点不了。"""
    i = s.find('_inFrame')
    if i < 0: return None
    seg = s[i:i+900]
    if '_bgOnly' not in seg: return None
    # 守卫查的是「reject 之前有没有"仅限后台"的限定」——
    # 把限定删掉即模拟 v1090 那种"无条件拒绝"。
    return s[:i] + seg.replace('_bgOnly', 'alwaysBlock') + s[i+900:]


def _inj_auth_desync(s):
    """auth() 不接住 app() 返回的实例 —— 子框借用实例时报「鉴权不可用」。"""
    i = s.find('function auth()')
    if i < 0: return None
    seg = s[i:i+900]
    return s[:i] + seg.replace('app().then(function (a)', 'app().then(function ()') + s[i+900:]


def _inj_diag_pollute(s):
    """删掉 DIAG_KEY_RE —— 诊断键会污染用户备份。"""
    i = s.find('var DIAG_KEY_RE')
    if i < 0: return None
    j = s.find('\n', i)
    return s[:i] + 'var DIAG_KEY_RE=/^__none__$/;' + s[j:]


def _inj_selftest_gap(s):
    """从 CASES 里删掉一条 —— 制造"有守卫没人验证"的状态。"""
    # 守卫从 CASES 段落里提取已覆盖的守卫名。
    # 删掉一整条即制造"有守卫没人验证"。注意 SDK 单实例那条要连行首缩进一起删。
    import re as _r
    m = _r.search(r"\n\s*\('SDK 单实例',[^\n]*\n", s)
    if not m: return None
    return s[:m.start()] + '\n' + s[m.end():]



def _inj_always_true(s):
    """往测试里塞一条恒真断言 —— 那条分支永远不会失败，等于没测。"""
    if 'ok(true,' in s: return None
    return s + "\nok(true, 'selftest injected always-true');\n"



def _inj_theme_fg(s):
    """把选中态的文字色写死成白 —— 亮色主题下就是白底白字。"""
    old = 'background:var(--hpk-sel-bg);color:var(--hpk-txt)!important'
    if old not in s: return None
    return s.replace(old, 'background:var(--hpk-sel-bg);color:#fff', 1)




def _inj_panel_drift(s):
    """把其中一套的文案改掉 —— 模拟"改一处漏另一处"。

    ⚠️ 必须打在**代码里那份**，不能打在注释上：
       这句文案在模块里出现两次（注释一次、代码一次），
       简单 replace 会改到注释那份，守卫照样绿灯 ——
       "守卫查形不查实"的老毛病，这次是样本犯的。"""
    old = 'opacity:.85">登录后自动分配</span>'
    if old not in s: return None
    return s.replace(old, 'opacity:.85">登录后分配</span>', 1)



def _inj_live_ls(s):
    """把快照取值改回 localStorage.key(i) —— 就是"边遍历边读"。
       注意：守卫查的是"循环体里用 localStorage.key 且不只收集键名"，
       所以要同时把循环头也改回实时长度，否则形不成那个模式。"""
    if '_lsk2[i]' not in s: return None
    s2 = s.replace('for(var i=0;i<_lsk2.length;i++)', 'for(var i=0;i<localStorage.length;i++)', 1)
    return s2.replace('var k=_lsk2[i];', 'var k=localStorage.key(i);', 1)


def _inj_orphan_field(s):
    """读一个从没赋值的字段 —— 模拟"改了一半"的残留。"""
    i = s.find('function finish() {')
    if i < 0: return None
    return s[:i] + 'function finish() {\n    var _z = _state.neverAssignedField;\n' + s[i+len('function finish() {'):]


def _inj_n_plus_one(s):
    """在 map 回调里查库 —— N+1。"""
    i = s.find('function listFriends')
    if i < 0: return None
    return s[:i] + ('function listFriends() {\n'
                    '    [1,2].map(function (c) { return T().list({ cid: c }); });\n') \
           + s[i+len('function listFriends() {'):]


def _inj_load_order(s):
    """引入"必须先加载别的模块"的依赖。"""
    i = s.find('function beat()')
    if i < 0: return None
    return s[:i] + ('function beat() {\n'
                    '    var _x = window.HansenLsKeys ? window.HansenLsKeys() : [];\n') \
           + s[i+len('function beat()'):]


def _inj_no_skip_round(s):
    """删掉 skipRound 的函数定义 —— 两人都没拼对时房间状态会停住。"""
    if 'function skipRound' not in s: return None
    return s.replace('function skipRound', 'function skipGONE')


def _inj_guess_side(s):
    """去掉 roundState 返回体里的 mySide —— 让前端靠本地标记猜。
       注意：mySide 在注释里也出现，必须改**返回体里**那一处。"""
    i = s.find('function roundState')
    if i < 0: return None
    seg = s[i:i+900]
    if 'mySide:' not in seg: return None
    return s[:i] + seg.replace('mySide:', 'mySideGONE:', 1) + s[i+900:]



def _inj_notify_proto(s):
    """改回挂原型 —— 生死簿在实例上覆盖了 setItem，挂原型一次都不会触发。"""
    if 'ls.setItem' not in s: return None
    return s.replace('ls.setItem', 'Storage.prototype.setItem')



def _inj_index_path(s):
    """把 indexPath 改掉 —— 部署时不带索引文档，根路径就会被当成文件下发。"""
    if '"indexPath": "index.html"' not in s: return None
    return s.replace('"indexPath": "index.html"', '"indexPath": ""')



def _inj_window_assert(s):
    """把剥注释那一步去掉 —— 加几行注释就会把断言挤出窗口。"""
    marker = "replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')"
    if marker not in s:
        return None
    return s.replace(marker, "slice(0)")



def _inj_fake_assert(s):
    """塞一条只匹配注释的断言 —— 它验的是"文档写了没"，不是"代码做了没"。"""
    marker = "console.log(`\\n\u7ed3\u679c:"
    if marker not in s:
        return None
    inject = ("ok(/\u9000\u4e0d\u51fa\u53bb\u6bd4\u4e22\u4e00\u70b9\u8fdb\u5ea6\u66f4\u7cdf/"
              ".test(fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8')), "
              "'\u6ce8\u91ca\u65ad\u8a00');\n")
    return s.replace(marker, inject + marker, 1)



def _inj_toothless(s):
    """把失败出口拆掉 —— 测试就变成只会打印的装饰品。

    ⚠️ 只动**这个测试文件自己**的退出语句，
    不做任何全局替换 —— v1153 第一版写成 `s.replace('assert', ...)`，
    结果把无关内容也改了，**连产品文件都被污染**（当场从 git 恢复）。
    自证注入必须是**外科手术式**的：改一处、改得准。
    """
    if 'process.exit(fail === 0 ? 0 : 1)' not in s:
        return None
    return s.replace('process.exit(fail === 0 ? 0 : 1)', 'process.exit(0)', 1)



def _inj_acct_switch(s):
    """拆掉 uid 变化信号 —— 换账号就只能靠"把每条路都堵一遍"了。"""
    m = "hsn-account-uid-changed"
    if m not in s:
        return None
    return s.replace(m, "hsn-nobody-listens", 1)



def _inj_self_defeating(s):
    """把写死的缓存号塞回去 —— 越照它要求轮换，它越报错。"""
    m = "_cache_keys = {}"
    if m not in s:
        return None
    return s.replace(m, "if \"CACHE_PREFIX + 'shell-21'\" not in _sw944:\n"
                        "        _b941_release.append('x')\n    " + m, 1)


def _inj_no_browser_test(s):
    """把浏览器测试的驱动部分拆掉 —— 只剩读源码做正则，等于没真跑。"""
    m = "chromium.launch"
    if m not in s:
        return None
    return s.replace(m, "__no_browser_launch", 1)


def _inj_query_optional_field(s):
    """把可能缺失的字段塞回查询条件 —— 旧记录会整批查不出来。"""
    m = ".where({ status: 'open', isPrivate: false })"
    if m not in s:
        return None
    return s.replace(m, ".where({ status: 'open', isPrivate: false, guestId: '' })", 1)



def _inj_ladder_e2e(s):
    """把浏览器启动拆掉 —— E2E 就退化成又一个读源码的测试。"""
    m = "chromium.launch"
    if m not in s:
        return None
    return s.replace(m, "__no_browser", 1)



def _inj_watchdog(s):
    """把"画面动了就解锁"那条拆掉 —— 看门狗就只保护第一次了。"""
    m = "if (_rescued && !document.getElementById('pkRescue')) _rescued = false;"
    if m not in s:
        return None
    return s.replace(m, "/* removed */", 1)



def _inj_residue(s):
    """塞一个注入哨兵进去 —— 模拟"注入完忘了恢复"。"""
    if 'chromium.launch' not in s:
        return None
    return s.replace('chromium.launch', '__no_browser', 1)



def _recover_last_run():
    """🔴v1155：**上次注入没恢复的，开跑前先修回来。**

    自证是"把代码改坏 → 跑守卫 → 恢复"。
    如果进程在中间被杀（超时、断电、Ctrl-C 的某些情况），
    **坏代码就留在工作区了** —— 而且你不会知道，
    因为下一次跑的时候它看起来只是"某个守卫报红"。

    今天为此栽了四次，其中一次是产品代码。
    """
    bakdir = os.path.join(ROOT, '.jarvis_inject_bak')
    pend = os.path.join(bakdir, 'PENDING')
    if not os.path.exists(pend):
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
            shutil.copyfile(bak, os.path.join(ROOT, name))
            print('  \u267b\ufe0f  上次注入没恢复干净，已修回：%s' % name)
            os.unlink(bak)
        os.unlink(pend)
    except Exception as e:
        print('  \u26a0\ufe0f  修复上次残局失败：%s' % e)


_recover_last_run()


def _inj_progress(s):
    """把进度文件里的版本号改老 —— 模拟"它慢慢过期了"。"""
    import re as _re
    out = _re.sub(r'v11\d\d', 'v1050', s)
    return out if out != s else None



def _inj_poisoned_cache(s):
    """把 text/plain 从判据里拿掉 —— 兜底就又形同虚设了。

    这正是 v1156 事故的原样：判据只认 octet-stream / binary / attachment，
    而线上真实回的是 text/plain，于是它大摇大摆地进了缓存。
    """
    m = "ct.startsWith('text/plain') ||"
    if m not in s:
        return None
    return s.replace(m, "", 1)



def _inj_boot_check(s):
    """往核心清单里塞一个不存在的模块 —— 正常情况下就会天天误报。"""
    m = "['HansenCoins', '金币'],"
    if m not in s:
        return None
    return s.replace(m, "['HansenNotExist', '不存在'],\n    " + m, 1)



def _inj_storage(s):
    """把 try 拆掉 —— 隐私模式下整个应用又会被拦停。"""
    m = "try { raw = localStorage.getItem(KEY); }"
    if m not in s:
        return None
    return s.replace(m, "raw = localStorage.getItem(KEY);", 1)



def _inj_auto_dl(s):
    """塞一个"打开就下载"的函数进去 —— 用户一进页面就莫名其妙下东西。"""
    m = "  function build(){"
    if m not in s:
        return None
    inj = ("  setTimeout(function(){var a=document.createElement('a');"
           "a.download='x.json';a.href='#';a.click();},100);\n")
    return s.replace(m, inj + m, 1)



def _inj_dlmaster(s):
    """把总闸的失败返回拆掉 —— 它就再也拦不住任何东西了。"""
    m = "    return 1\n"
    if m not in s:
        return None
    return s.replace(m, "    return 0\n", 1)



def _inj_sentinel(s):
    """把定时触发拆掉 —— 哨兵就只能手动点，等于没有。"""
    if 'schedule:' not in s:
        return None
    return s.replace('schedule:', 'schedule_disabled:', 1)


CASES = [
    ('单一真源·登录态', 'hansen_cloud_save_v965.js',  _inj_session),
    ('错误可见性',      'hansen_auth_v1004.js',       _inj_errvis),
    ('SDK 单实例',      'hansen_cloud_save_v965.js',  _inj_sdk),
    ('页面模块接线',    'island_animal.html',         _inj_wiring),
    ('资源戳统一',      'spelling_pk.html',           _inj_stamp),
    ('白领奖励',        'hansen_quest_global.js',     _inj_freereward),
    ('抢房原子性',      'hansen_pk_room_v1065.js',    _inj_room),
    ('假绿断言',        'test_page_wiring_v1063.mjs', _inj_dead_assert),
    ('onclick 语法',    'hansen_season.js',           _inj_onclick),
    ('文案不被改写',    'hansen_cloud_save_v965.js',  _inj_clobber),
    ('Land 内容一致',   'island_land6.html',          _inj_land_parity),
    ('Land 印章生成',   'island_land4.html',          _inj_land_stamp),
    # 🔴v1075
    ('引用不存在',      'hansen_auth_v1004.js',       _inj_ref_missing),
    ('JS 语法',         'hansen_gear.js',             _inj_js_syntax),
    ('数据跟账号',      'template.html',              _inj_data_no_cloud),
    ('两处真源',        'hansen_gear.js',             _inj_divergent),
    # 🔴v1083
    ('版本守望',        'island_land3.html',          _inj_no_version_watch),
    # 🔴v1086
    ('登录后不抢跑',    'hansen_cloud_restore_v1048.js', _inj_rush_after_login),
    # 🔴v1088
    ('单实例',          'hansen_cloud_save_v965.js',  _inj_multi_instance),
    # 🔴v1090
    ('备份不碰凭证',    'hansen_backup_v944.js',      _inj_backup_takes_creds),
    # 🔴v1096 攻坚笔记转化的守卫
    ('中文键备份',      'hansen_backup_v944.js',      _inj_cjk_off),
    ('三态不分',        'hansen_auth_v1004.js',       _inj_notready_off),
    ('攻坚笔记在册',    '攻坚笔记/跨设备存档攻坚全记录_v1017-v1095.md', _inj_notes_gone),
    # v1097 补齐无样本的守卫
    ('无凭据即成功',    'hansen_auth_v1004.js',       _inj_no_cred_check),
    ('登录被拦死',      'hansen_auth_v1004.js',       _inj_block_login),
    ('app/auth 同步',   'hansen_auth_v1004.js',       _inj_auth_desync),
    ('诊断键污染',      'hansen_backup_v944.js',      _inj_diag_pollute),
    ('守卫都有自证',    'jarvis_selftest.py',         _inj_selftest_gap),
    ('恒真断言',      'test_backup_v942.mjs',       _inj_always_true),
    ('主题前景',      'hansen_friends_ui_v1107.js', _inj_theme_fg),
    ('两套身份条',  'hansen_sb_pk_v1022.js',      _inj_panel_drift),
    # 🔴v1134 六个新守卫
    ('边遍历LS',     'hansen_backup_v944.js',       _inj_live_ls),
    ('孤儿字段',     'hansen_pk_room_ui_v1065.js',  _inj_orphan_field),
    ('循环查库',     'hansen_friends_v1106.js',     _inj_n_plus_one),
    ('加载顺序依赖','hansen_friends_v1106.js',    _inj_load_order),
    ('回合不推进',   'hansen_pk_room_v1065.js',     _inj_no_skip_round),
    ('前端瞎猜',     'hansen_pk_room_v1065.js',     _inj_guess_side),
    ('变更通知',      'hansen_change_notify_v1134.js', _inj_notify_proto),
    ('打开变下载',   'cloudbaserc.json',           _inj_index_path),
    ('窗口断言',     'test_cid_order_v1130.mjs',     _inj_window_assert),
    ('假断言',       'test_cid_order_v1130.mjs',     _inj_fake_assert),
    ('无牙测试',     'test_cid_order_v1130.mjs',     _inj_toothless),
    ('换账号',       'hansen_auth_v1004.js',        _inj_acct_switch),
    ('自打脸检查',   'check_resources.py',          _inj_self_defeating),
    ('要真跑过',     'test_login_no_prompt_v1154.mjs', _inj_no_browser_test),
    ('查询条件',     'hansen_pk_room_v1065.js',     _inj_query_optional_field),
    ('天梯E2E',      'test_ladder_e2e_v1155.mjs',   _inj_ladder_e2e),
    ('对战看门狗',   'hansen_pk_watchdog_v1155.js', _inj_watchdog),
    ('注入残留',     'test_ladder_e2e_v1155.mjs',   _inj_residue),
    ('当前进度',     '当前进度.md',            _inj_progress),
    ('缓存投毒',     'sw_v944.js',                  _inj_poisoned_cache),
    ('启动自检',     'hansen_boot_check_v1156.js',  _inj_boot_check),
    ('存储不可用',   'hansen_backup_bootstrap_v944.js', _inj_storage),
    ('自动下载',     'hansen_backup_v944.js',       _inj_auto_dl),
    ('防下载总闸', '防下载总闸.py',            _inj_dlmaster),
    ('线上哨兵',     '.github/workflows/download-sentinel.yml', _inj_sentinel),
]


def _run_guards():
    """跑一次守卫，返回 {守卫名: 是否报红}。"""
    r = subprocess.run([sys.executable, GUARDS], cwd=ROOT,
                       capture_output=True, timeout=600)
    out = (r.stdout or b'').decode('utf-8', 'replace')
    red = set()
    for m in re.finditer(r'^  ❌ (.+?)(?: —— |\s*$)', out, re.M):
        red.add(m.group(1).strip())
    return red


def main():
    print('=' * 62)
    print('🧪 贾维斯 · 守卫自证（每道守卫必须真的会咬人）')
    print('=' * 62)
    print('  原理：注入一份故障样本 → 守卫必须变红 → 还原。')
    print('       变不红 = 这道守卫已经失灵，和没有一样。\n')

    base_red = _run_guards()
    if base_red:
        print('  ⚠️ 注入前就有守卫报红，先修好再自证：%s\n' % ', '.join(sorted(base_red)))

    dead = []

    skipped = []   # v1155: 基线就红、无法判定的
    # 🔴v1155：**自证也要能断点续跑。**
    #
    #   自证要让 47 道守卫各咬一次故障样本，整轮十几分钟。
    #   在受限环境里跑不完 —— 而每次被强杀都会留下"注入到一半"的残局，
    #   **下一次跑的时候文件已经是坏的，后面的守卫全被带偏**
    #   （实测：两道好守卫被误报成"已失灵"，我差点去改本来正确的守卫）。
    #
    #   和闸门同样的思路：跑过的记下来，下次接着跑。
    #   指纹用守卫文件 + 自证脚本本身 —— 它们一变，结论就作废。
    import hashlib as _hl, glob as _g2
    _STDONE = os.path.join(ROOT, '.jarvis_selftest_progress.json')
    _fp = _hl.sha256()
    for _f in sorted(_g2.glob(os.path.join(ROOT, 'hansen_guards_*.py'))):
        try: _fp.update(open(_f, 'rb').read())
        except Exception: pass
    try: _fp.update(open(os.path.join(ROOT, 'jarvis_selftest.py'), 'rb').read())
    except Exception: pass
    _fpv = _fp.hexdigest()[:16]
    _done_names = set()
    try:
        _d = json.load(open(_STDONE, encoding='utf-8'))
        if _d.get('fp') == _fpv:
            _done_names = set(_d.get('ok', []))
            if _done_names:
                print('  \u23e9 \u7eed\u8dd1\uff1a\u5df2\u9a8c\u8fc7 %d \u9053' % len(_done_names))
    except Exception:
        _done_names = set()

    def _mark_ok(nm):
        _done_names.add(nm)
        try:
            json.dump({'fp': _fpv, 'ok': sorted(_done_names)},
                      open(_STDONE, 'w', encoding='utf-8'))
        except Exception:
            pass

    # v1155: 告诉守卫"我正在跑"，别把我注入的坏代码修回去
    _bakdir0 = os.path.join(ROOT, '.jarvis_inject_bak')
    os.makedirs(_bakdir0, exist_ok=True)
    open(os.path.join(_bakdir0, 'RUNNING'), 'w').write('1')

    # v1155: 开跑前验一次基线（只此一次）
    _b0 = subprocess.run([sys.executable, GUARDS], cwd=ROOT,
                         capture_output=True, text=True, timeout=280)
    _base_bad = (_b0.returncode != 0)
    if _base_bad:
        _w = [l.strip() for l in (_b0.stdout or '').split('\n') if l.strip().startswith('- [')]
        print('  \u26a0\ufe0f  \u57fa\u7ebf\u5c31\u662f\u7ea2\u7684\uff0c\u5148\u4fee\u5b83\u518d\u8dd1\u81ea\u8bc1\uff1a%s'
              % (_w[0][:70] if _w else '(\u672a\u77e5)'))
        return 1
    _first_case = True

    for name, target, inject in CASES:
        if name in _done_names:
            continue
        path = os.path.join(ROOT, target)
        if not os.path.exists(path):
            print('  ⏭  %-16s 目标文件不存在(%s)，跳过' % (name, target))
            continue
        orig = open(path, encoding='utf-8').read()

        # 🔴v1155：**注入前先确认基线是干净的。**
        #
        #   自证是"改坏 → 跑守卫 → 恢复"。如果**改坏之前守卫就已经报红**
        #   （上一道的残局没清、或者代码本来就有问题），
        #   那么"注入后仍然红"这个结果**说明不了任何事** ——
        #   而脚本会把它读成"注入生效了"，或者反过来把好守卫判成失灵。
        #
        #   今天实测撞到：两道本来完好的守卫被误报成"已失灵"，
        #   我差点去改它们 —— 而它们手动一验就正确报红。
        #
        #   所以每道注入前先跑一次：**基线必须绿**，不绿就跳过并说明白，
        #   而不是拿一个说明不了问题的结果去下结论。
        # 🔴v1155：**基线只在最开头验一次，不是每道都验。**
        #
        #   第一版写成"每道注入前都跑一次守卫"，结果：
        #     · 每道多花 7 秒 × 48 道 = 白等 5 分多钟
        #     · 更糟的是**第一道注入的是攻坚笔记**，
        #       它改完之后（哪怕已经恢复）某些时序下基线仍显示红，
        #       于是**后面 47 道全部"无法判定"**
        #
        #   基线该验的是"开跑前工作区是不是干净的"，
        #   那是一次性的事实，不需要反复确认。

        hurt = inject(orig)
        if hurt is None or hurt == orig:
            print('  ⏭  %-16s 注入样本不适用，跳过（需更新样本）' % name)
            continue
        # 🔴v1155：**备份放在固定位置，并留一份"正在注入"的标记。**
        #
        #   原来备份用的是临时文件、靠 `finally` 恢复 ——
        #   而进程被 `timeout` 直接杀掉（SIGKILL）时，
        #   **`finally` 根本不会执行**，坏代码就留在了工作区。
        #
        #   今天为此栽了四次：guestId 塞回房间查询、chromium.launch 被改坏、
        #   hsn-account-uid-changed 被改坏、check_resources 里的注入语句 ——
        #   其中一处是**产品代码**，会让用户报的"换账号换不了"直接复发。
        #
        #   现在：备份写到 `.jarvis_inject_bak/`，同时记一份清单。
        #   下次启动时先看清单，**上次没恢复的先恢复掉**。
        _bakdir = os.path.join(ROOT, '.jarvis_inject_bak')
        os.makedirs(_bakdir, exist_ok=True)
        _bakpath = os.path.join(_bakdir, os.path.basename(path) + '.bak')
        open(_bakpath, 'w', encoding='utf-8').write(orig)
        open(os.path.join(_bakdir, 'PENDING'), 'w', encoding='utf-8').write(
            os.path.basename(path))

        class _Bak:
            name = _bakpath
        bak = _Bak()
        try:
            open(path, 'w', encoding='utf-8').write(hurt)
            red = _run_guards()
            bit = name in red
            print('  %s %-16s %s' % ('✅' if bit else '❌', name,
                                     '注入后正确报红' if bit else '注入后**依然全绿** —— 已失灵'))
            if not bit:
                dead.append(name)
            else:
                _mark_ok(name)
        finally:
            # ⚠️ 备份可能已经被上一轮的"自动修残局"删掉了 ——
            #    那时这里会抛 FileNotFoundError，把整个自证带崩。
            #    **一个"验证守卫会不会咬人"的脚本自己崩掉，比守卫失灵更糟**：
            #    它会让人以为守卫坏了，去改本来正确的守卫。
            if os.path.exists(bak.name):
                shutil.copyfile(bak.name, path)
            try:
                if os.path.exists(bak.name): os.unlink(bak.name)
                _pend = os.path.join(os.path.dirname(bak.name), 'PENDING')
                if os.path.exists(_pend):
                    os.unlink(_pend)
            except Exception:
                pass

    try:
        os.unlink(os.path.join(ROOT, '.jarvis_inject_bak', 'RUNNING'))
    except Exception:
        pass

    if dead:
        print('\n❌ %d 道守卫已失灵（注入故障后仍不报红）:' % len(dead))
        for d in dead:
            print('   - ' + d)
        print('\n   一道不咬人的守卫比没有守卫更危险 —— 它让人误以为有防线。')
        return 1
    print('\n✅ 全部守卫自证通过 —— 每一道都确实会咬人')
    return 0


if __name__ == '__main__':
    sys.exit(main())
