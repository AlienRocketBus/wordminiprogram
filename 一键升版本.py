#!/usr/bin/env python3
"""一键升版本号：只改「版本号该在的 9 类地方」，别的一个字都不碰，改完自己核对。

用法：
    python3 一键升版本.py --check     # 只看会改哪些地方，什么都不改（先跑这个）
    python3 一键升版本.py             # 新版本 = VERSION + 1
    python3 一键升版本.py 1170        # 指定新版本号

为什么不再用交接文件 §8 那段「全站批量替换」：
    批量替换只认字符串、不认意思。2026-11-04 在 v1163 上实测，它会顺手改坏：
      · index.html 里一条弧线的坐标「1163,730」（首页图形会变形）；
      · package_release.py 的发布登记表（把 v1163 那行改名，而不是新加一行）；
      · test_auth_session_v1164.mjs 里故意写成「旧版本写的」恢复日志（测试意思变了）；
      · 几十条「🔴v1163：……」历史注释（记录被改成假的）；
    更早还改坏过音频哈希清单（v1161）和事故登记册（v1162）。
    所以这里改成「按位置改」：每一类位置一条规则，每条规则都要对上预期的个数，对不上就整个不改。

9 类地方（交接文件 §8 列的）：
    ① 资源戳 ?v=####（网页、脚本、数据文件，六千多处；.py 不在内）
    ② CURRENT_APP_VERSION=####（备份两个文件 + 自证样本 1 处）
    ③ __HBU_VERSION__ / HBU_RUNTIME_VERSION = 'v####'
    ④ 升级门 hansen_sw_upgrade_gate_v944.js 的 version: ####,
    ⑤ 下载文件名 wordminiprogram_v####_restore_journal
    ⑥ 中文文件名 单词大冒险_v####_重置故障取证_
    ⑦ package.json / package-lock.json 的 "version"
    ⑧ VERSION 文件
    ⑨ 发布登记表（package_release.py）新加一行 + sw_v944.js 缓存代际各 +1（图标缓存不动）
       —— 以前每个版本都是这么做的：1155→1156→1163 都是 shell/pages/assets 各 +1、icons 不变。
最后照交接文件跑 generate.py（岛屿页由模板生成）。
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
# 绝对不能动的文件：哈希清单、事故登记册（历史）
SKIP = {'hansen_audio_lock.json', 'hansen_bug_registry.py'}
STAMP_GLOBS = ['*.html', '*.js', '*.mjs', '*.json', '*.webmanifest']


def rd(f):
    return open(os.path.join(ROOT, f), encoding='utf-8').read()


def wr(f, s):
    p = os.path.join(ROOT, f)
    tmp = p + '.bumptmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as fh:
        fh.write(s)
    os.replace(tmp, p)


def files(globs):
    out = []
    for g in globs:
        out += [os.path.basename(x) for x in glob.glob(os.path.join(ROOT, g))]
    return sorted(set(out) - SKIP)


def plan(old, new):
    """返回 (改动表 {文件: 新内容}, 报告行, 错误行)。一处对不上就报错，不改任何文件。"""
    changes, report, errors = {}, [], []

    def get(f):
        return changes.get(f, None) if f in changes else rd(f)

    def sub(name, fset, pattern, repl, want):
        """want: ('eq', n) 正好 n 处 / ('ge', n) 至少 n 处"""
        total = 0
        for f in fset:
            src = get(f)
            dst, n = re.subn(pattern, repl, src, flags=re.M)
            if n:
                changes[f] = dst
                total += n
        kind, n = want
        ok = total == n if kind == 'eq' else total >= n
        report.append('%s %-34s %5d 处' % ('✓' if ok else '✗', name, total))
        if not ok:
            errors.append('%s：找到 %d 处，预期%s %d 处' % (name, total, '正好' if kind == 'eq' else '至少', n))

    O, N = re.escape(old), new
    stamp_files = files(STAMP_GLOBS)
    sub('① 资源戳 ?v=', stamp_files, r'([?&]v=)' + O + r'(?![0-9])', r'\g<1>' + N, ('ge', 1000))
    # 检查工具（check_resources / economy_guard / 自证样本）里写死了「模板里必须有 xxx.js?v=####」，要跟着换；
    # 反引号里的是说明文字里的历史（比如守卫注释「我批量替换 `?v=1157` → `?v=1163`」），不动。
    sub('① 检查工具里的资源戳', files(['*.py']), r'(?<!`)([?&]v=)' + O + r'(?![0-9])', r'\g<1>' + N, ('ge', 10))
    sub('② CURRENT_APP_VERSION（备份）', ['hansen_backup_v944.js', 'hansen_backup_bootstrap_v944.js'],
        r'(CURRENT_APP_VERSION\s*=\s*)' + O + r'(?![0-9])', r'\g<1>' + N, ('eq', 2))
    sub('② CURRENT_APP_VERSION（自证样本）', ['jarvis_selftest.py'],
        r'("CURRENT_APP_VERSION=)' + O + r'(")', r'\g<1>' + N + r'\g<2>', ('eq', 1))
    sub('③ __HBU_VERSION__ / RUNTIME', ['hansen_boss_lock.js'],
        r"((?:__HBU_VERSION__|HBU_RUNTIME_VERSION)\s*=\s*'v)" + O + r"(')", r'\g<1>' + N + r'\g<2>', ('eq', 2))
    sub('④ 升级门 version:', ['hansen_sw_upgrade_gate_v944.js'],
        r'^(\s*version:\s*)' + O + r'(\s*,)', r'\g<1>' + N + r'\g<2>', ('eq', 1))
    sub('⑤ 恢复日志下载名', stamp_files,
        r'(wordminiprogram_v)' + O + r'(_restore_journal)', r'\g<1>' + N + r'\g<2>', ('ge', 1))
    sub('⑥ 故障取证下载名', stamp_files,
        r'(单词大冒险_v)' + O + r'(_重置故障取证_)', r'\g<1>' + N + r'\g<2>', ('ge', 1))

    # ⑦ package.json / package-lock.json：按 JSON 改，不按字符串改
    for f in ('package.json', 'package-lock.json'):
        d = json.loads(get(f))
        hit = 0
        if d.get('version') == old + '.0.0':
            d['version'] = new + '.0.0'
            hit += 1
        if '' in d.get('packages', {}) and d['packages'][''].get('version') == old + '.0.0':
            d['packages']['']['version'] = new + '.0.0'
            hit += 1
        want = 1 if f == 'package.json' else 2
        ok = hit == want
        report.append('%s %-34s %5d 处' % ('✓' if ok else '✗', '⑦ ' + f, hit))
        if not ok:
            errors.append('⑦ %s：改到 %d 处，预期 %d 处' % (f, hit, want))
        changes[f] = json.dumps(d, ensure_ascii=False, indent=2) + '\n'

    # ⑧ VERSION
    if rd('VERSION').strip() != old:
        errors.append('⑧ VERSION 不是 %s' % old)
    changes['VERSION'] = new + '\n'
    report.append('✓ %-34s %5d 处' % ('⑧ VERSION', 1))

    # ⑨ 缓存代际 +1，登记表新加一行
    sw = get('sw_v944.js')
    gens = {}
    for k, var in (('shell', 'SHELL_CACHE'), ('pages', 'PAGE_CACHE'), ('assets', 'ASSET_CACHE'), ('icons', 'ICON_CACHE')):
        m = re.search(r"^const %s = CACHE_PREFIX \+ '%s-(\d+)';$" % (var, k), sw, flags=re.M)
        if not m:
            errors.append('⑨ sw_v944.js 里找不到 %s' % var)
            continue
        gens[k] = int(m.group(1))
    pr = get('package_release.py')
    m_old = re.search(r'^(\s*)"%s": \(\("shell-(\d+)", "pages-(\d+)", "assets-(\d+)", "icons-(\d+)"\), "v=%s"\),$' % (O, O), pr, flags=re.M)
    if '"%s": ((' % new in pr:
        errors.append('⑨ 发布登记表里已经有 %s 了（升过一次了？）' % new)
    elif not m_old:
        errors.append('⑨ 发布登记表里没有 %s 这一行（上一版没登记？）' % old)
    elif len(gens) == 4:
        reg = tuple(int(x) for x in m_old.group(2, 3, 4, 5))
        cur = (gens['shell'], gens['pages'], gens['assets'], gens['icons'])
        if reg != cur:
            errors.append('⑨ 登记表 %s 的缓存代际 %s 和 sw_v944.js 现在的 %s 对不上' % (old, reg, cur))
        else:
            ng = (cur[0] + 1, cur[1] + 1, cur[2] + 1, cur[3])
            for k, var, val in (('shell', 'SHELL_CACHE', ng[0]), ('pages', 'PAGE_CACHE', ng[1]), ('assets', 'ASSET_CACHE', ng[2])):
                sw = re.sub(r"^(const %s = CACHE_PREFIX \+ '%s-)\d+(';)$" % (var, k), r'\g<1>%d\g<2>' % val, sw, flags=re.M)
            changes['sw_v944.js'] = sw
            line = '%s"%s": (("shell-%d", "pages-%d", "assets-%d", "icons-%d"), "v=%s"),' % (m_old.group(1), new, ng[0], ng[1], ng[2], ng[3], new)
            changes['package_release.py'] = pr[:m_old.end()] + '\n' + line + pr[m_old.end():]
            report.append('✓ %-34s shell %d→%d · pages %d→%d · assets %d→%d · icons %d 不变' % (
                '⑨ 缓存代际 + 发布登记', cur[0], ng[0], cur[1], ng[1], cur[2], ng[2], cur[3]))
    return changes, report, errors


def leftovers(old):
    """改完以后，还剩下的旧版本号逐条归类；不认识的列出来给人看。"""
    known = []
    unknown = []
    for f in files(STAMP_GLOBS + ['*.py']):
        for i, l in enumerate(rd(f).split('\n'), 1):
            for m in re.finditer(re.escape(old), l):
                pre = l[:m.start()]
                if re.search(r'[0-9]$', pre) or re.match(r'[0-9]', l[m.end():m.end() + 1]):
                    continue  # 更长数字的一部分（比如 11630）
                why = None
                if re.search(r'(//|/\*|#|<!--|^\s*\*|═|「|（|——|~v)', pre) or not re.search(r'[=:(\[,{]\s*[\'"]?v?$', pre):
                    why = '注释/说明文字里的历史版本'
                if re.search(r'`[?&]v=$', pre):
                    why = '说明文字里引用的旧资源戳'
                if f == 'package_release.py' and re.match(r'\s*"%s": \(\(' % old, l):
                    why = '发布登记表的上一版（保留）'
                if f == 'index.html' and 'A 560,560' in l:
                    why = '首页弧线坐标（不是版本号）'
                if f == 'test_auth_session_v1164.mjs' and 'appVersion: %s' % old in l:
                    why = '测试故意用「上一版写的恢复日志」'
                (known if why else unknown).append('%s:%d  %s' % (f, i, l.strip()[:120]))
    return known, unknown


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check_only = '--check' in sys.argv
    old = rd('VERSION').strip()
    new = args[0] if args else str(int(old) + 1)
    if not (old.isdigit() and new.isdigit() and int(new) > int(old)):
        print('✗ 版本号不对：现在 %s，新的 %s（新版本必须是更大的数字）' % (old, new))
        return 2
    print('升版本号 %s → %s%s' % (old, new, '（只检查，不改文件）' if check_only else ''))
    changes, report, errors = plan(old, new)
    for r in report:
        print('  ' + r)
    if errors:
        print('\n✗ 有对不上的地方，一个文件都没改：')
        for e in errors:
            print('  - ' + e)
        return 1
    print('  共改 %d 个文件' % len(changes))
    if check_only:
        return 0
    for f, s in changes.items():
        wr(f, s)
    g = subprocess.run([sys.executable, 'generate.py'], cwd=ROOT, capture_output=True, text=True)
    if g.returncode != 0:
        print('✗ generate.py 失败（版本号已改）：\n' + (g.stdout + g.stderr)[-800:])
        return 1
    print('  generate.py 跑完')
    known, unknown = leftovers(old)
    print('  剩下的 %s：%d 处是历史/该留的' % (old, len(known)))
    stale = []
    for f in files(STAMP_GLOBS + ['*.py']):
        if re.search(r'(?<!`)[?&]v=' + re.escape(old) + r'(?![0-9])', rd(f)):
            stale.append(f)
    if stale:
        print('✗ 还有旧资源戳没换：' + '、'.join(stale[:8]))
        return 1
    if unknown:
        print('⚠ 下面 %d 处不认识，请人看一眼是不是漏改的版本号：' % len(unknown))
        for u in unknown[:20]:
            print('    ' + u)
        return 3
    print('✓ 升版完成。下一步：python3 一键体检.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
