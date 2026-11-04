#!/usr/bin/env python3
"""一键体检：机器把检查全部做完，最后只打印十几行结论（详细日志在 .siphon/ 里）。

用法：
    python3 一键体检.py              # 三道快检 + 全部测试跑完 + 失败的串行重跑一次
    python3 一键体检.py --quick      # 只做三道快检（资源检查、守卫、零测试桩冒烟），几分钟
    python3 一键体检.py --shard 2/6  # 只跑第 2 份（共 6 份）测试 —— 给 GitHub 自动测试用
    python3 一键体检.py --only room  # 只跑名字里带 room 的测试

为什么要有它（「虹吸工作法」，见 攻坚笔记/虹吸工作法.md）：
    以前跑测试是让 AI 一条条敲命令、把几千行日志读进脑子里 —— 最费 token 的就是这一步。
    现在一条命令交给机器跑完，AI 只看最后的结论；有失败才去看那一个测试的日志。
    判定规则和交接文件 §8 一模一样（快检三道 + 分批跑测试.py + --recheck），只是串起来了。

退出码：0 = 全部通过；1 = 有失败（结论里列出来）；2 = 用法错误。
"""
import glob
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.abspath(__file__))
LOGDIR = os.path.join(ROOT, '.siphon')
RESUME_FILE = os.path.join(ROOT, '.jarvis_resume.json')


def ensure_playwright():
    """本机：找到 Playwright 就告诉测试；GitHub 上 npm ci 装好了，测试自己找得到。"""
    if os.environ.get('HANSEN_PLAYWRIGHT_MODULE'):
        return
    cands = [os.path.join(ROOT, 'node_modules', 'playwright', 'index.mjs'),
             '/opt/node-tools/node_modules/playwright/index.mjs']
    try:
        g = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, timeout=20).stdout.strip()
        if g:
            cands.append(os.path.join(g, 'playwright', 'index.mjs'))
    except Exception:
        pass
    for c in cands:
        if os.path.exists(c):
            os.environ['HANSEN_PLAYWRIGHT_MODULE'] = c
            return


def log_path(name):
    os.makedirs(LOGDIR, exist_ok=True)
    return os.path.join(LOGDIR, re.sub(r'[^\w.-]+', '_', name) + '.log')


def run(cmd, name, timeout):
    """跑一条命令，全部输出写进 .siphon/<name>.log，返回 (退出码, 输出)。"""
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, timeout=timeout)
        out = (r.stdout or b'').decode('utf-8', 'replace') + (r.stderr or b'').decode('utf-8', 'replace')
        rc = r.returncode
    except subprocess.TimeoutExpired as e:
        out = ((e.stdout or b'').decode('utf-8', 'replace') if isinstance(e.stdout, bytes) else '') + '\n[超时 %d 秒]' % timeout
        rc = 124
    open(log_path(name), 'w', encoding='utf-8').write(out)
    return rc, out, time.time() - t0


def quick():
    """语法 + 三道快检。返回失败说明的列表（空 = 全过）。"""
    bad = []
    # 语法：2026-11-04 实测，往 sw_v944.js 末尾多写一个字符，三道快检全都看不出来 —— 所以先查语法
    syn = []
    for f in sorted(glob.glob(os.path.join(ROOT, '*.js'))):
        r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
        if r.returncode != 0:
            syn.append(os.path.basename(f))
    for f in sorted(glob.glob(os.path.join(ROOT, '*.py'))):
        r = subprocess.run([sys.executable, '-m', 'py_compile', f], capture_output=True, text=True)
        if r.returncode != 0:
            syn.append(os.path.basename(f))
    if syn:
        bad.append('语法错误 %d 个文件：%s' % (len(syn), '、'.join(syn[:6])))
    # 执行主义：五个主义写在 CLAUDE.md 里，每个新对话会自动读到 —— 谁把它删了、删短了，这里就红
    try:
        rules = open(os.path.join(ROOT, 'CLAUDE.md'), encoding='utf-8').read()
    except Exception:
        rules = ''
    lost = [w for w in ('虹吸主义', '虫洞主义', '执行主义', '完美主义', '丝滑主义') if w not in rules]
    if lost:
        bad.append('CLAUDE.md 里的五个主义不全了（缺：%s）' % '、'.join(lost))
    rc, out, _ = run([sys.executable, 'check_resources.py'], 'check_resources', 900)
    if rc != 0 or '全部通过' not in out:
        tail = [l for l in out.strip().split('\n') if l.strip()][-2:]
        bad.append('资源检查没过：' + ' / '.join(t.strip()[:120] for t in tail))
    rc, out, _ = run([sys.executable, 'hansen_guards_v1068.py'], 'guards', 900)
    hits = [l.strip() for l in out.split('\n') if re.match(r'^\s+- \[', l)]
    if rc != 0 or hits:
        bad.append('守卫报红 %d 条：%s' % (len(hits), '；'.join(h[:100] for h in hits[:3]) or ('退出码 %d' % rc)))
    rc, out, _ = run(['node', 'test_real_path_smoke_v1163.mjs'], 'smoke', 600)
    m = re.search(r'(\d+) 通过 / (\d+) 失败', out)
    if rc != 0 or not m or m.group(2) != '0':
        bad.append('零测试桩冒烟没过：' + (m.group(0) if m else '退出码 %d' % rc))
    return bad


def batch_runner():
    """直接复用 分批跑测试.py 的测试清单、单个测试的时限和失败摘要 —— 规则只有一份。"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('batch', os.path.join(ROOT, '分批跑测试.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def all_tests():
    return sorted(os.path.basename(t) for t in glob.glob(os.path.join(ROOT, 'test_*.mjs')))


def run_list(mod, tests, parallel):
    """并行跑一批，返回 {测试: None 或 失败原因}。每个测试的输出另存一份日志。"""
    res = {}

    def one(t):
        rc, out, sec = run(['node', t], 'test_' + t, mod._limit(t))
        if rc == 0:
            return t, None
        if rc == 124:
            return t, '超时'
        bad = [ln.strip() for ln in out.split('\n') if 'XX' in ln or 'Error' in ln or '✗' in ln]
        return t, (bad[0] if bad else 'exit %d' % rc)[:160]

    with ThreadPoolExecutor(max_workers=parallel) as ex:
        for t, r in ex.map(one, tests):
            res[t] = r
    return res


def main():
    argv = sys.argv[1:]
    ensure_playwright()
    t0 = time.time()
    lines = []
    ok = True

    shard = None
    if '--shard' in argv:
        try:
            i, n = argv[argv.index('--shard') + 1].split('/')
            shard = (int(i), int(n))
            assert 1 <= shard[0] <= shard[1]
        except Exception:
            print('用法：--shard 第几份/一共几份，比如 --shard 2/6')
            return 2
    only = argv[argv.index('--only') + 1] if '--only' in argv else None

    if shard is None and only is None:
        bad = quick()
        lines.append('语法 + 快检三道：' + ('全过' if not bad else '有 %d 道没过' % len(bad)))
        lines += ['  ✗ ' + b for b in bad]
        ok = not bad
        if '--quick' in argv:
            return finish(lines, ok, t0)

    mod = batch_runner()
    tests = all_tests()
    if only:
        tests = [t for t in tests if only in t]
    if shard:
        # 按名字排好后轮流分：每份里重的真 SDK 测试（*_cloud_v1164）也差不多一样多
        heavy = [t for t in tests if mod._limit(t) > mod.PER_TEST]
        light = [t for t in tests if t not in heavy]
        tests = (heavy + light)[shard[0] - 1::shard[1]]

    if shard or only:
        res = run_list(mod, tests, int(os.environ.get('SIPHON_PARALLEL', '2')))
        fails = sorted(t for t, r in res.items() if r)
        if fails:  # 并行假失败很常见：失败的串行再跑一次，两次都失败才算
            again = run_list(mod, fails, 1)
            res.update(again)
            fails = sorted(t for t, r in again.items() if r)
        os.makedirs(LOGDIR, exist_ok=True)
        tag = 'shard_%d_of_%d' % shard if shard else 'only_' + re.sub(r'\W+', '_', only)
        json.dump(res, open(os.path.join(LOGDIR, tag + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        lines.append('测试 %d 个：通过 %d · 失败 %d' % (len(res), len(res) - len(fails), len(fails)))
    else:
        # 全量：照交接文件 §8 —— 分批跑测试.py 跑到没有剩余，再 --recheck 串行重跑失败的
        for _ in range(6):
            rc, out, _ = run([sys.executable, '分批跑测试.py', '100000'], 'batch', 4 * 3600)
            if re.search(r'剩余 0', out):
                break
        run([sys.executable, '分批跑测试.py', '--recheck'], 'recheck', 4 * 3600)
        done = json.load(open(RESUME_FILE, encoding='utf-8')).get('done', {}) if os.path.exists(RESUME_FILE) else {}
        if done and json.load(open(RESUME_FILE, encoding='utf-8')).get('fp') != mod.fingerprint():
            lines.append('⚠ 跑测试期间代码被改过 —— 结果作废，等代码不动了再跑一次')
            ok = False
        res = {t: done.get(t, '没跑到') for t in tests}
        fails = sorted(t for t, r in res.items() if r)
        lines.append('测试 %d 个：通过 %d · 失败 %d' % (len(tests), len(tests) - len(fails), len(fails)))
    for t in fails[:10]:
        lines.append('  ✗ %s  %s' % (t, res[t]))
    if len(fails) > 10:
        lines.append('  …… 还有 %d 个，见 .siphon/' % (len(fails) - 10))
    ok = ok and not fails
    return finish(lines, ok, t0)


def finish(lines, ok, t0):
    lines.append(('✅ 全部通过' if ok else '❌ 没通过') + '（用时 %d 分钟；详细日志在 .siphon/）' % round((time.time() - t0) / 60))
    text = '\n'.join(lines)
    print(text)
    os.makedirs(LOGDIR, exist_ok=True)
    open(os.path.join(LOGDIR, 'SUMMARY.txt'), 'w', encoding='utf-8').write(text + '\n')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
