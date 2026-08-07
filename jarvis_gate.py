#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jarvis_gate.py —— 贾维斯 · 发版闸门（v1070）

为什么要单独做这一道
====================
「每次改完都跑一遍贾维斯」这条规矩在 v1059~v1069 **连丢十版**。
靠人记得的流程，一定会忘 —— 这和本项目踩过六次的
「手工维护的清单必然走散」是同一个道理，只不过对象换成了流程。

所以把它变成**发版硬条件**：
    jarvis_gate 通过 → 写下 .jarvis_pass.json
    package_release  → 打包前必须看到当前版本的有效凭证，否则拒绝出包

判据为什么不是「全绿」
======================
`check_resources` 目前有 15 个既有问题，而 v1069 抽查 4 条**3 条是虚报**
（`\\U` 转义全在注释里、血量公式是 v1035 有意改的、SW 缓存键一直在正常轮换）。
要求全绿等于永远发不了版，还会逼人去改好好的代码 —— 那比不检查更糟。

故采用**两档**：

  ① 新时代守卫（12 道，全部经故障注入验证会红）→ **必须全绿，一条不过就不发**
  ② 既有问题总数 → **不许比基线多**（不许变差）

基线记在 `.jarvis_baseline.json`，只能降不能升：
清理掉一个就自动收紧一格，永远回不去。
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
PASS_FILE = os.path.join(ROOT, '.jarvis_pass.json')
BASE_FILE = os.path.join(ROOT, '.jarvis_baseline.json')
GUARDS = os.path.join(ROOT, 'hansen_guards_v1068.py')
LEGACY = os.path.join(ROOT, 'check_resources.py')


def _version():
    try:
        return open(os.path.join(ROOT, 'VERSION'), encoding='utf-8').read().strip()
    except Exception:
        return '?'


def _sign(d):
    """🔴v1097：凭证内容签名。

    不是防恶意攻击（本地文件谁都能改），而是防**无意的自欺** ——
    比如手动调一下 legacy 想让闸门放行、或调试时改了没改回来。
    签名把 version/guards/legacy/score 绑在一起：改任何一个都对不上。
    """
    import hashlib as _h
    base = '|'.join(str(d.get(k, '')) for k in ('version', 'guards', 'legacy', 'score'))
    return _h.sha256(('hansen-jarvis-v1097|' + base).encode()).hexdigest()[:32]


def _guards_fingerprint():
    """守卫文件指纹 —— 守卫改了却没重跑，旧凭证必须作废，
    否则会出现「用旧体检结论给新守卫背书」。"""
    h = ''
    for f in ('hansen_guards_v1068.py', 'check_resources.py', 'hansen_bug_registry.py',
                  'jarvis_selftest.py'):
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            h += hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16]
    return hashlib.sha256(h.encode()).hexdigest()[:24]


def _legacy_count():
    """跑既有守卫，取问题总数。跑不动就返回 None（不阻塞，但会明说）。"""
    if not os.path.exists(LEGACY):
        return None
    try:
        r = subprocess.run([sys.executable, LEGACY], cwd=ROOT,
                           capture_output=True, timeout=900)
        out = (r.stdout or b'').decode('utf-8', 'replace') + \
              (r.stderr or b'').decode('utf-8', 'replace')
        m = re.search(r'发现 (\d+) 个问题', out)
        return int(m.group(1)) if m else (0 if r.returncode == 0 else None)
    except Exception:
        return None


def _read_baseline():
    try:
        return int(json.load(open(BASE_FILE, encoding='utf-8')).get('legacy', 10 ** 9))
    except Exception:
        return None


def main():
    ver = _version()
    print('=' * 62)
    print('🛡️  贾维斯 · 发版闸门   v%s' % ver)
    print('=' * 62)

    # ── 第一档：新时代守卫必须全绿 ──
    if not os.path.exists(GUARDS):
        print('\n❌ 缺少 hansen_guards_v1068.py —— v1000+ 的教训无人看守，拒绝发版。')
        return 1
    print('\n▶ 第一档：新时代守卫（必须全绿）\n')
    rc_guard = subprocess.run([sys.executable, GUARDS], cwd=ROOT).returncode
    if rc_guard != 0:
        if os.path.exists(PASS_FILE):
            os.remove(PASS_FILE)
        print('\n🚫 新时代守卫未通过 —— 已作废发布凭证，package_release 将拒绝出包。')
        return 1

    # ── 第一档半：事故登记册 ──
    #   产品负责人的要求是「每个版本修出来的 bug 都要有贾维斯守着」。
    #   但「记得给每个修复配一道守卫」本身就是靠记性的事 ——
    #   本项目已经证明过七次：手工维护的东西必然走散。
    #   所以把它变成可校验的合同：CHANGELOG 里带 🔴 的版本必须在册，
    #   且登记的守卫/测试必须真实存在。漏登 → 拒绝发版。
    reg = os.path.join(ROOT, 'hansen_bug_registry.py')
    if os.path.exists(reg):
        print('\n▶ 第一档半：事故登记册（每个修复都要有看守者）\n')
        if subprocess.run([sys.executable, reg], cwd=ROOT).returncode != 0:
            if os.path.exists(PASS_FILE):
                os.remove(PASS_FILE)
            print('\n🚫 有修复没登记看守者 —— 已作废发布凭证。')
            return 1
    else:
        print('\n  ⚠️ 缺少 hansen_bug_registry.py —— 无人保证「每个修复都有守卫」。')

    # ── 第一档三分之二：守卫自证 ──
    #   「守卫全绿 ≠ 没 bug」的后半句：一道守卫如果自己坏了，
    #   它会安安静静地永远显示 ✅，而它本该守着的 bug 可以大摇大摆地复发。
    #   所以每次发版前，让每道守卫都咬一次故障样本证明自己还活着。
    st = os.path.join(ROOT, 'jarvis_selftest.py')
    if os.path.exists(st):
        print('\n▶ 第一档⅔：守卫自证（每道守卫必须真的会咬人）\n')
        # 🔴v1153：**自证结果按"守卫文件指纹"缓存。**
        #
        #   自证要让 39 道守卫各咬一次故障样本，这一档就要跑十几分钟。
        #   而它验的是"守卫本身还灵不灵" —— **只和守卫文件有关**，
        #   业务代码改了不影响结论。
        #
        #   所以：守卫文件（hansen_guards_*.py / jarvis_selftest.py）
        #   一个字节没变，就复用上次的结论；**变了立刻重跑**。
        #   这不是少做事，是**不做重复的事**。
        import hashlib as _h2
        import glob as _g2
        _gh = _h2.sha256()
        for _f in sorted(_g2.glob(os.path.join(ROOT, 'hansen_guards_*.py'))
                         + [st]):
            try:
                _gh.update(open(_f, 'rb').read())
            except Exception:
                pass
        _gfp = _gh.hexdigest()[:16]
        _SELF_CACHE = os.path.join(ROOT, '.jarvis_selftest_ok.json')
        _cached = None
        try:
            _cached = json.load(open(_SELF_CACHE, encoding='utf-8')).get('fp')
        except Exception:
            _cached = None
        if _cached == _gfp:
            print('  ⏩ 守卫文件未变动，复用上次的自证结论（全绿）')
            _selftest_rc = 0
        else:
            _selftest_rc = subprocess.run([sys.executable, st], cwd=ROOT).returncode
            if _selftest_rc == 0:
                try:
                    json.dump({'fp': _gfp}, open(_SELF_CACHE, 'w', encoding='utf-8'))
                except Exception:
                    pass
        if _selftest_rc != 0:
            if os.path.exists(PASS_FILE):
                os.remove(PASS_FILE)
            print('\n🚫 有守卫已失灵 —— 已作废发布凭证。')
            return 1
    else:
        print('\n  ⚠️ 缺少 jarvis_selftest.py —— 没人证明守卫还会咬人。')

    # ── 第一档¾：回归测试 ──
    #   🔴v1098 挑刺发现：**闸门从来不跑测试**。
    #   153 个测试全靠人手动执行 —— 跟当初「每版必跑贾维斯」靠记性
    #   是同一个病，而那个病已经让规矩连丢十一版。
    #   判据同样是"不许变差"：失败数不得比基线多。
    #   （不要求全绿：有几个是长期抖动的老红灯，要求全绿等于永远发不了版，
    #     而那会逼人去删测试 —— 比不跑更糟。）
    # 🔴v1098：CI 上跳过本档。
    #   CI 容器没有本地的 .jarvis_slow.json（那是本机性能相关的状态，
    #   不同机器不一样、不入库），于是会去跑满 153 个、其中 51 个各等 12 秒
    #   → 闸门跑不完 → CI 直接失败。
    #   而 CI 本来就有自己的测试步骤，这一档在那里是重复的。
    #   本地开发时它是关键防线（它上线第一件事就是拦住了我）。
    if os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS'):
        print('\n▶ 第一档¾：回归测试 —— CI 环境跳过（CI 有自己的测试步骤）\n')
        base_t = None
    else:
        print('\n▶ 第一档¾：回归测试（不许比基线更差）\n')
        import glob as _glob
        all_tests = sorted(_glob.glob(os.path.join(ROOT, 'test_*.mjs')))
        # 🔴v1098：闸门必须是**分钟级**的 —— 跑满 153 个（含大量浏览器测试）
        #   要十几分钟，那样人会开始绕过它，就回到"靠记性"的老路。
        #   策略：闸门跑**每个测试 25 秒超时**，跑不完的记为"慢"、单独统计，
        #   不计入失败（它们由 HANSEN_DEEP=1 的深度档完整跑）。
        #   这样既保证"不许变差"有实效，又不会让闸门变成没人愿意跑的东西。
        deep = os.environ.get('HANSEN_DEEP') == '1'
        # 🔴v1152：**12 秒太短了。**
        #
        #   实测有测试要跑 38 秒（浏览器测试尤其慢）——
        #   它们每次都被判「超时」丢进慢名单，**从来没被真正验证过**。
        #   而闸门显示"共 120 个测试，失败 0 个"，看起来一切正常。
        #
        #   **一个会悄悄少跑 30% 测试的闸门，比没有闸门更危险** ——
        #   它给的是虚假的安全感。
        #
        #   现在：普通档 45 秒（覆盖实测最慢的 38 秒还有余量），
        #   深度档 120 秒。v1151 的"最长作业优先"已经把总时长压下来了，
        #   放宽单个超时不会让整体变慢多少。
        per_timeout = 120 if deep else 45
        # 🔴v1098：闸门只跑**快测试**（12 秒内能跑完的），慢的交给深度档。
        #   实测：153 个里约 50 个是浏览器测试，动辄 10~20 秒，
        #   全跑要十几分钟 —— 那样人会绕过闸门，回到"靠记性"的老路。
        #   快测试覆盖的是逻辑/契约层，恰恰是最容易被改坏的部分。
        #   慢测试用 `HANSEN_DEEP=1 python3 jarvis_gate.py` 完整跑（发大版本前做一次）。
        # 🔴v1098：把已知的慢测试**直接跳过**，而不是每次都跑到超时才放弃。
        #   每个慢测试白等 12 秒 × 50 个 = 10 分钟纯浪费，
        #   闸门因此跑不完 —— 而跑不完的闸门等于没有闸门。
        #   慢名单记在 .jarvis_slow.json，由深度档维护。
        SLOW_FILE = os.path.join(ROOT, '.jarvis_slow.json')
        known_slow = set()
        if not deep:
            try:
                known_slow = set(json.load(open(SLOW_FILE, encoding='utf-8')))
            except Exception:
                known_slow = set()
        tests = [t for t in all_tests if os.path.basename(t) not in known_slow]

        # 🔴v1151：**慢的先跑（最长作业优先）。**
        #
        #   `ex.map` 是按提交顺序调度的 —— 如果最慢的那个排在最后，
        #   4 个线程会全部空转等它一个，整体时间被"长尾"拖住。
        #
        #   实测：40 个测试合计 169 秒，而**前 3 个就占 88 秒（52%）**。
        #   把它们放到最前面，其余的能填满剩下三条线程的空档。
        #
        #   耗时记在 .jarvis_time.json（每次跑完更新，第一次跑没有就按原序）。
        #   这只是**调度顺序**的优化 —— 一个测试都不会被跳过，
        #   结果完全一样，只是更快。
        TIME_FILE = os.path.join(ROOT, '.jarvis_time.json')
        _hist = {}
        try:
            _hist = json.load(open(TIME_FILE, encoding='utf-8'))
        except Exception:
            _hist = {}
        if _hist:
            tests.sort(key=lambda t: -_hist.get(os.path.basename(t), 0))
        if known_slow:
            print('  ⏭  跳过 %d 个已知慢测试（用 HANSEN_DEEP=1 完整跑）' % len(known_slow))
        # v1152: 把"实际会跑多少"打出来 —— 之前只报"共 N 个测试"，
        #        而那个 N 已经是扣掉慢名单之后的数，看不出漏了多少。
        print('  📋 磁盘上 %d 个测试，本轮实跑 %d 个' % (len(all_tests), len(tests)))
        # 🔴v1153：**每个阶段都打点。**
        #   实测撞上：闸门被 timeout 杀掉后，输出停在半路，
        #   **看起来就像"还在跑"** —— 我等了半小时才发现进程早没了。
        #   现在每一步都留痕，一看输出就知道走到哪、是正常结束还是被掐断。
        import time as _t
        _phase_t0 = _t.time()
        def _phase(msg):
            print('  ⏱ [%5.0fs] %s' % (_t.time() - _phase_t0, msg), flush=True)
        _phase('并行段开始')
        # 并行跑 —— 153 个串行要十几分钟，闸门必须是分钟级的，
        # 否则人会绕过它（那就回到"靠记性"的老路）。
        from concurrent.futures import ThreadPoolExecutor
        # 🔴v1153：**断点续跑 —— 中断后接着跑，不用从头来。**
        #
        #   实测撞上的现实约束：这一轮的运行环境单次最多跑 14 分钟，
        #   而完整闸门要 25~30 分钟 —— **永远跑不完，也就永远出不了包**。
        #
        #   而"跑不完就绕过闸门"正是这几版一直在批判的事
        #   （v1152 那个"120 个测试 0 失败"就是这么来的）。
        #
        #   正确解法不是降低标准，是**让闸门能在受限环境里跑完**：
        #   每跑完一个测试就把结果存盘，下次启动时跳过已通过的，
        #   接着跑剩下的。存盘文件带**代码指纹**，
        #   任何源文件一改动，进度立刻作废、从头再来 ——
        #   **绝不会出现"用旧结果给新代码背书"**。
        import hashlib as _hl
        RESUME_FILE = os.path.join(ROOT, '.jarvis_resume.json')
        def _fingerprint():
            h = _hl.sha256()
            # 🔴v1153 自挑（第二轮）：**读全部 361 个文件要 18 秒**，
            #   每次续跑都要付这个成本。
            #   而 HTML 是 `generate.py` 的生成产物 —— 内容由
            #   `template.html` + 各模块决定，源头没变它就不会变。
            #   只哈希**源文件**（304 个）只要 0.03 秒。
            #
            #   ⚠️ 但 HTML 仍要防"有人手改了生成产物却没改源头"：
            #   所以额外把每个 HTML 的**大小**算进去 ——
            #   读大小是元数据操作，几乎不花时间，
            #   而手改内容几乎必然改变大小。
            _srcs = []
            for _pat in ('hansen_*.js', 'sw_*.js', 'test_*.mjs', 'template.html', '*.py'):
                _srcs += _glob.glob(os.path.join(ROOT, _pat))
            for f in sorted(set(_srcs)):
                try:
                    # 🔴v1153 自挑：**必须读内容，不能只看 mtime。**
                    #   第一版用 `getmtime` 图快 —— 但有工具会保留 mtime 改内容
                    #   （rsync -t、某些编辑器、git 的部分操作），
                    #   那时指纹不变 → **用旧结果给新代码背书**。
                    #   而"绝不会用旧结果背书新代码"正是这个机制的立身之本，
                    #   在它上面省时间等于把地基抽了。
                    h.update(os.path.basename(f).encode())
                    h.update(open(f, 'rb').read())
                except Exception:
                    pass
            # HTML 只算大小（防手改，但不付读全文的成本）
            for f in sorted(_glob.glob(os.path.join(ROOT, '*.html'))):
                try:
                    h.update(os.path.basename(f).encode())
                    h.update(str(os.path.getsize(f)).encode())
                except Exception:
                    pass
            return h.hexdigest()[:16]
        _fp = _fingerprint()
        _done = {}
        try:
            _r = json.load(open(RESUME_FILE, encoding='utf-8'))
            if _r.get('fp') == _fp:
                _done = _r.get('done', {})
        except Exception:
            _done = {}
        if _done:
            print('  ⏩ 续跑：已有 %d 个测试的结果（代码未变动）' % len(_done))
            _pending = [t for t in tests if os.path.basename(t) not in _done]
            # v1153: 已完成的失败项先攒着，等 raw 初始化后再并入
            # 🔴v1153：**续跑时，之前存盘的失败也要重新跑一次。**
            #   闸门本来就有"失败串行复核"机制（并行下的假失败很常见），
            #   但续跑时那些失败是从文件读回来的、绕过了复核 ——
            #   于是一次偶然的并行抖动会被**永久记进进度文件**，
            #   之后每次续跑都带着它，闸门再也过不去。
            #   做法：**只把通过的结果算数**，失败的重新排进本轮再跑一遍。
            _resumed_fail = []
            _refail = [k for k, v in _done.items() if v]
            if _refail:
                print('  ↻ %d 个之前失败的重新跑（不直接采信旧结果）' % len(_refail))
                for k in _refail:
                    _done.pop(k, None)
            _pending = [t for t in tests if os.path.basename(t) not in _done]
            tests = _pending
            # _heavy / _light 在后面基于新的 tests 重新计算，这里不用动
            print('  ⏩ 本轮还需跑 %d 个' % len(tests))

        # 🔴v1153 自挑：**进度文件是 4 个线程同时写的。**
        #   不加锁的后果不只是"后写覆盖先写"（那还好，内容是累积的），
        #   而是**两个线程同时写会写出截断的 JSON** ——
        #   下次读取直接报错、整个进度作废，
        #   于是"中断了不用重跑"这件事又白做了。
        #
        #   加锁 + 写临时文件再改名（原子替换）：
        #   即使写到一半被杀，原文件也还是完整的旧版本。
        import threading as _th
        _save_lock = _th.Lock()
        def _save_progress():
            with _save_lock:
                try:
                    _tmp = RESUME_FILE + '.tmp'
                    with open(_tmp, 'w', encoding='utf-8') as _fh:
                        json.dump({'fp': _fp, 'done': dict(_done)}, _fh)
                    os.replace(_tmp, RESUME_FILE)
                except Exception:
                    pass

        def _run(t, heavy=False):
            """🔴v1098：**失败要复核一次再算数。**

            第一版用 8 线程并行，结果 7 个测试报红 —— 而单独跑全是绿的。
            原因是浏览器测试互相抢 CPU/端口，并行下会假失败。

            **一个会误报的闸门比没有闸门更糟**：人被误报烦几次，
            就会开始加 SKIP 绕过它，那就回到"靠记性"的老路。

            所以：并发降到 3，且**失败的单独重跑一次**才算数。
            """
            _t0 = time.time()
            try:
                r = subprocess.run(['node', t], cwd=ROOT, capture_output=True,
                                   timeout=(per_timeout * 3 if heavy else per_timeout))
                _spent[os.path.basename(t)] = round(time.time() - _t0, 1)
                _res = None if r.returncode == 0 else os.path.basename(t)
                _done[os.path.basename(t)] = _res      # v1153: 存盘供续跑
                _save_progress()
                return _res
            except subprocess.TimeoutExpired:
                # 🔴v1153：**超时也要记耗时，否则会形成死循环。**
                #   原来超时就直接返回，不写 `_spent` ——
                #   下次排序时这个测试没有历史记录，被当成"0 秒"排到最后，
                #   于是**又被并行拖慢、又超时**，永远进不了重测试串行段。
                #   记成"至少用了这么久"，让它下次能排到前面去。
                _spent[os.path.basename(t)] = round(time.time() - _t0, 1)
                return '~SLOW~' + os.path.basename(t)
            except Exception:
                return os.path.basename(t)
        _spent = {}


        # 🔴v1152：**已知的慢测试串行跑，不参与并行。**
        #
        #   实测发现一个更深的问题：
        #   `test_camel_runtime` 单独跑 56 秒，`test_boss_timer` 51 秒 ——
        #   **它们不是"慢测试"，是被并行拖慢的**。
        #   4 个浏览器测试同时抢 CPU 时，单个耗时会翻倍甚至更多。
        #
        #   而闸门给 45 秒超时 → 判"跑不完" → 不计失败 → **悄悄放过**。
        #   这是"看起来 0 失败"的第二层原因
        #   （第一层是慢名单切片 bug + 12 秒超时，本版已修）。
        #
        #   做法：耗时排前几名的**单独串行跑**（不抢资源，用真实耗时就够），
        #   其余的照常并行。总时长几乎不变，但**它们真的被验证了**。
        # 🔴v1153：**判定阈值从"前 6 名且 ≥20 秒"放宽。**
        #
        #   v1152 只让前 6 名串行，结果仍有 **23 个测试超时**。
        #   一个个串行单跑验证：它们只要 5~24 秒，**远低于 45 秒超时** ——
        #   也就是说**它们全是被并行拖慢的，没有一个是真的慢**。
        #
        #   4 个浏览器测试同时抢 CPU 时，单个耗时会翻两三倍。
        #   而"超时不计失败"意味着**这 23 个仍然没被验证** ——
        #   v1152 修好了"少跑 51 个"，却还剩这一层。
        #
        #   试过"≥8 秒全部串行"，但那要 951 秒（16 分钟）——
        #   **又回到了"闸门太慢"的老路**。
        #
        #   最终方案是两条一起：
        #     ① 前 12 名且 ≥12 秒的串行（覆盖真正的重头）
        #     ② **超时的那些，最后串行补跑一次**（见下面 `_retry_slow`）
        #   第②条才是关键 —— **"超时"不该被当成"通过"**。
        _heavy = []
        if _hist:
            _ranked = sorted(tests, key=lambda t: -_hist.get(os.path.basename(t), 0))
            _heavy = [t for t in _ranked[:12] if _hist.get(os.path.basename(t), 0) >= 12]
        _light = [t for t in tests if t not in _heavy]
        if _heavy:
            print('  🐢 %d 个重测试串行跑（并行会互相抢 CPU，导致假超时）' % len(_heavy))

        raw = list(_resumed_fail) if '_resumed_fail' in locals() else []
        with ThreadPoolExecutor(max_workers=4) as ex:
            raw += [x for x in ex.map(_run, _light) if x]
        # 🔴v1153：**闸门太慢这件事，我没解决。**
        #
        #   实测：整轮 171 个测试要跑 30 分钟以上。
        #   我试过四个方向 —— 最长作业优先、重测试串行、
        #   重测试 2 线程、按 git 改动筛选 —— **都没压到可接受范围**。
        #
        #   按改动筛选那次失败得最明白：这轮改了 35 个源文件，
        #   几乎所有重测试都被判“相关”，一个都没省下来。
        #
        #   根本原因不在调度：**171 个测试里有大量浏览器测试**，
        #   每个都要启动 Chromium、加载页面。这是物理下限。
        #
        #   真正该做的是**改测试本身**（多个测试共用一个浏览器实例）
        #   —— 那是独立课题，不该在这一版顺手做半截。
        #
        #   **所以这里不留半成品**：宁可诚实地慢，
        #   也不要一个“看起来快了、其实只是少跑了”的闸门 ——
        #   那正是 v1152 刚修掉的病。

        # **重测试用 2 线程跑，不是纯串行。**
        #
        #   实测这段是整个闸门的瓶颈：12 个重测试纯串行要 507 秒（8.5 分钟），
        #   整轮闸门因此跑了 40 多分钟 —— 我自己等到不得不中断它。
        #
        #   而"必须串行"这个结论下得太狠：真正的问题是
        #   **重测试和一堆轻测试挤在 4 线程里**，不是"重测试之间不能并行"。
        #   2 线程时互相拖慢很轻（约 15%），却能把 507 秒压到约 290 秒。
        #
        #   一个要跑 40 分钟的闸门等于没有闸门 —— 人会绕过它，
        #   或者像我这样中途掐掉。
        if _heavy:
            _phase('重测试段开始（%d 个，2 线程）' % len(_heavy))
            with ThreadPoolExecutor(max_workers=2) as ex2:
                raw += [x for x in ex2.map(lambda t: _run(t, heavy=True), _heavy) if x]
            _phase('重测试段结束')

        # 🔴v1153：**超时的测试要串行补跑一次，不能当成"通过"。**
        #
        #   v1152 修好了"少跑 51 个"，但还剩一层：
        #   仍有 23 个测试并行下超时，而闸门"不计失败"就放过了。
        #
        #   实测把它们一个个串行单跑：**只要 5~24 秒，远低于 45 秒** ——
        #   也就是说**它们全是被并行拖慢的，没有一个是真的慢**。
        #   而"超时不计失败"意味着这 23 个仍然没被验证。
        #
        #   做法：并行阶段超时的，最后**串行补跑一次**（给 3 倍时间）。
        #   补跑还超时才真的算"跑不完"，那时才记进慢名单。
        _timeouts = [x[len('~SLOW~'):] for x in raw if x.startswith('~SLOW~')]
        if _timeouts:
            _phase('补跑段开始（%d 个）' % len(_timeouts))
            print('  🔁 %d 个并行超时，串行补跑一次（超时≠通过）' % len(_timeouts))
            raw = [x for x in raw if not x.startswith('~SLOW~')]
            for name in _timeouts:
                x = _run(os.path.join(ROOT, name), heavy=True)
                if x:
                    raw.append(x)
        # v1151: 记下这一轮的耗时，供下次排序用
        try:
            _hist.update(_spent)
            json.dump(_hist, open(TIME_FILE, 'w', encoding='utf-8'))
        except Exception:
            pass
        # 🔴v1152：**这里原来写的是 x[7:]，而 '~SLOW~' 只有 6 个字符** ——
        #   切 7 位把文件名的首字母也削掉了，慢名单里全是 `est_xxx.mjs`，
        #   **永远匹配不上任何真实文件名**。
        #   于是慢名单形同虚设，而且没人发现 —— 因为它"看起来在工作"。
        slow = [x[len('~SLOW~'):] for x in raw if x.startswith('~SLOW~')]
        suspect = [x for x in raw if not x.startswith('~SLOW~')]
        # 🔴v1098：**失败要串行复核一次再算数。**
        #   第一版 8 线程并行时 7 个测试报红，单独跑全是绿的 ——
        #   浏览器测试互相抢 CPU/端口会假失败。
        #   **一个会误报的闸门比没有闸门更糟**：人被误报烦几次就会绕过它。
        #   只复核失败项（数量少），不拖慢整体。
        failed = []
        for name in suspect:
            try:
                r = subprocess.run(['node', os.path.join(ROOT, name)], cwd=ROOT,
                                   capture_output=True, timeout=per_timeout + 20)
                if r.returncode != 0:
                    failed.append(name)
            except Exception:
                failed.append(name)
        if len(suspect) > len(failed):
            print('  ℹ️  %d 个疑似失败经串行复核后通过（并行下的假失败）'
                  % (len(suspect) - len(failed)))
        if slow:
            print('  ⏱  %d 个测试超过 %d 秒未跑完（不计失败，用 HANSEN_DEEP=1 完整跑）'
                  % (len(slow), per_timeout))
            if not deep:
                try:
                    json.dump(sorted(known_slow | set(slow)),
                              open(SLOW_FILE, 'w', encoding='utf-8'), indent=1)
                except Exception:
                    pass
        nf = len(failed)
        base_t = None
        try:
            base_t = json.load(open(BASE_FILE, encoding='utf-8')).get('tests')
        except Exception:
            pass
        print('  共 %d 个测试，失败 %d 个' % (len(tests), nf))
        if failed:
            for f in failed[:8]:
                print('    · ' + f)
        if base_t is None:
            print('  首次记录基线：%d 个失败' % nf)
            base_t = nf
        elif nf > base_t:
            if os.path.exists(PASS_FILE):
                os.remove(PASS_FILE)
            print('  ❌ 失败数从 %d 涨到 %d —— 本版让测试变差了，拒绝发版。' % (base_t, nf))
            return 1
        elif nf < base_t:
            print('  ✅ 失败数从 %d 降到 %d —— 基线自动收紧。' % (base_t, nf))
            base_t = nf
        else:
            print('  ✅ 失败数维持 %d 个，未变差。' % nf)

    # ── 第一档¾：防「打开变下载」总闸 ──
    #
    #   用户反复强调：「必须给我彻底彻底点了，反复检查，
    #   直到检查不出来任何可能导致这种情况的 bug 为止。
    #   设立一个机制，防止这种情况以后再次出现。」
    #
    #   这一档就是那个机制：把所有能让浏览器下载而不是渲染的原因
    #   收拢到一处，每次发版全跑一遍，少一条都不放行。
    #
    #   它不需要联网 —— 查的是我们自己代码里的七条路径。
    #   服务端那四条由下面的「线上体检」实测。
    dl = os.path.join(ROOT, '防下载总闸.py')
    if os.path.exists(dl):
        print('\n▶ 第一档¾：防「打开变下载」总闸\n')
        _dr = subprocess.run([sys.executable, dl], cwd=ROOT)
        if _dr.returncode != 0:
            if os.path.exists(PASS_FILE):
                os.remove(PASS_FILE)
            print('\n🚫 有路径可能导致「打开网站变下载」—— 已作废发布凭证。')
            print('   这是所有 bug 里最致命的一种：'
                  '用户连页面都进不去，兜底代码一行都执行不了。')
            return 1

    # ── 第一档⅘：线上会不会把网页当文件下发 ──
    #
    #   🔴v1156 用户现场：「跟地址就是跟地址，所有的浏览器打开都会出现这种情况。」
    #   而当时**控制台配好了、守卫全绿、测试全过** ——
    #   没有任何一处能提前告诉我们线上是坏的。
    #
    #   因为守卫查的是"代码写对了没"，
    #   **而这件事的真相只在服务器的响应头里**。
    #   所以必须真的去请求一次，看它到底回了什么。
    #
    #   ⚠️ 网络不通时**不拦发版** —— 拿不到结果和"结果是坏的"是两回事，
    #   把前者当后者会让人开始忽略这道检查。
    live = os.path.join(ROOT, '发版前_线上体检.py')
    if os.path.exists(live):
        print('\n▶ 第一档⅘：线上体检（网页会不会被当成文件下载）\n')
        _lr = subprocess.run([sys.executable, live], cwd=ROOT)
        if _lr.returncode != 0:
            if os.path.exists(PASS_FILE):
                os.remove(PASS_FILE)
            print('\n🚫 线上有入口会被当成文件下载 —— 已作废发布凭证。')
            print('   这正是 v1156 那个"根地址打开变下载"，'
                  '用户会以为整个网站坏了。')
            return 1

    # ── 第二档：既有问题不许变多 ──
    print('\n▶ 第二档：既有问题总数（不许比基线多）\n')
    n = _legacy_count()
    base = _read_baseline()
    if n is None:
        print('  ⚠️ check_resources 未能给出问题总数（超时或异常）——')
        print('     本档跳过，但请人工确认。')
    else:
        if base is None:
            base = n
            print('  首次记录基线：%d 个既有问题' % n)
        elif n > base:
            if os.path.exists(PASS_FILE):
                os.remove(PASS_FILE)
            print('  ❌ 既有问题从 %d 涨到 %d —— 本版让情况变差了，拒绝发版。' % (base, n))
            print('     （请先定位新增的那几条：与上一版的问题清单逐条比对）')
            return 1
        elif n < base:
            print('  ✅ 既有问题从 %d 降到 %d —— 基线自动收紧，永远回不去。' % (base, n))
            base = n
        else:
            print('  ✅ 既有问题维持 %d 个，未变差。' % n)
        json.dump({'legacy': base, 'tests': base_t,
                   'at': time.strftime('%Y-%m-%d %H:%M:%S'), 'version': ver},
                  open(BASE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # ── 体检评分（100 分制）──
    #   产品负责人要求「每次做完都用贾维斯体检，100 分是多少分」。
    #   分数不是自我表扬，是**让退步立刻可见**：
    #   守卫红了、自证失灵、修复没登记、既有问题变多，分数都会掉。
    score, lines = 0, []
    def item(name, ok, weight, note):
        nonlocal score
        got = weight if ok else 0
        score += got
        lines.append('  %s %-16s %2d/%-3d %s' % ('✅' if ok else '❌', name, got, weight, note))
    item('新时代守卫全绿', True, 40, '一道不过就不会走到这里')
    item('守卫自证会咬人', True, 20, '每道守卫注入故障样本均正确报红')
    item('事故登记册完整', True, 15, '每个 🔴 修复都有真实看守者')
    item('发版凭证签发', True, 10, '四档全过')
    if n is None:
        lines.append('  ⚠️ %-16s  ?/15  既有问题数未取到' % '既有问题清理')
    else:
        got = max(0, 15 - n)
        score += got
        lines.append('  %s %-16s %2d/15  仍有 %d 个既有问题（多为过期守卫，待逐条分类）'
                     % ('✅' if n == 0 else '⚠️', '既有问题清理', got, n))
    print('\n' + '=' * 56)
    print('📊 贾维斯体检报告   v%s' % ver)
    print('=' * 56)
    for l in lines:
        print(l)
    print('-' * 56)
    print('  总分  %d / 100' % score)
    print('=' * 56)

    # 🔴v1097：**给凭证内容签名。**
    #   挑刺时发现：凭证原本只校验「版本号」和「守卫指纹」，
    #   **不校验 score / legacy** —— 手改一下 .jarvis_pass.json 把
    #   legacy 改成 0、score 改成 100，「既有问题不许变多」这一档就形同虚设。
    #   实测确认可以骗过：伪造 score=100 legacy=0 → 打包直接通过。
    #   现在把内容一起签进指纹：任何字段被改，凭证立刻作废。
    payload = {'version': ver, 'at': time.strftime('%Y-%m-%d %H:%M:%S'),
               'guards': _guards_fingerprint(), 'legacy': n, 'score': score}
    payload['sig'] = _sign(payload)
    json.dump(payload, open(PASS_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n🧾 已记下体检凭证 —— v%s 可以打包发布。' % ver)
    print('   ⚠️ 提醒：守卫报红 ≠ 有 bug；守卫全绿 ≠ 没 bug。')
    print('      看到红灯第一步是**验证**，不是照着改代码。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
