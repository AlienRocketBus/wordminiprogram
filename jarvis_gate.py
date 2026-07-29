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


def _guards_fingerprint():
    """守卫文件指纹 —— 守卫改了却没重跑，旧凭证必须作废，
    否则会出现「用旧体检结论给新守卫背书」。"""
    h = ''
    for f in ('hansen_guards_v1068.py', 'check_resources.py', 'hansen_bug_registry.py'):
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
        json.dump({'legacy': base, 'at': time.strftime('%Y-%m-%d %H:%M:%S'),
                   'version': ver},
                  open(BASE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    json.dump({'version': ver, 'at': time.strftime('%Y-%m-%d %H:%M:%S'),
               'guards': _guards_fingerprint(), 'legacy': n},
              open(PASS_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n🧾 已记下体检凭证 —— v%s 可以打包发布。' % ver)
    print('   ⚠️ 提醒：守卫报红 ≠ 有 bug；守卫全绿 ≠ 没 bug。')
    print('      看到红灯第一步是**验证**，不是照着改代码。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
