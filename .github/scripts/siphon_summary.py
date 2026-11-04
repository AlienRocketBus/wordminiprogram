#!/usr/bin/env python3
"""GitHub 结论表：把各台机器交回的结果汇总成一张中文表（写进运行页 Summary，也打印到日志最后几行）。

为什么单独放一个文件（进化主义）：内嵌在流程里时，GitHub 会把整段脚本先打印进日志，
AI 读一次结论要多读两千多 token 的脚本原文；放成文件以后日志里只剩结论表。

用法：python3 .github/scripts/siphon_summary.py tests   # 自动体检
      python3 .github/scripts/siphon_summary.py repeat  # 反复测试
"""
import collections
import glob
import json
import os
import sys


def emit(out, ok):
    text = '\n'.join(out) + '\n'
    with open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null'), 'a', encoding='utf-8') as fh:
        fh.write(text)
    print(text)
    return 0 if ok else 1


def tests():
    res = {}
    for f in glob.glob('logs/*/shard_*.json'):
        res.update(json.load(open(f, encoding='utf-8')))
    fails = sorted(t for t, r in res.items() if r)
    quick = ''
    for f in glob.glob('logs/siphon-logs-quick/SUMMARY.txt'):
        quick = open(f, encoding='utf-8').read().strip()
    qrc = [open(f).read().strip() for f in glob.glob('logs/siphon-logs-quick/quick_rc')]
    quick_ok = os.environ.get('QUICK') == 'success' and qrc == ['0']
    want = int(os.environ.get('SHARDS', '8'))
    shards = len(glob.glob('logs/*/shard_*.json'))
    ok = quick_ok and os.environ.get('TESTS') == 'success' and not fails and shards == want
    out = ['## ' + ('✅ 全部通过' if ok else '❌ 没通过'), '',
           '| 项目 | 结果 |', '|---|---|',
           '| 语法 + 三道快检 | %s |' % ('通过' if quick_ok else '没过（见附件 siphon-logs-quick）'),
           '| 测试 | %d 个 · 通过 %d · 失败 %d（交回结果的有 %d/%d 份） |' % (len(res), len(res) - len(fails), len(fails), shards, want)]
    if fails:
        out += ['', '### 失败的测试（两次都失败）', '']
        out += ['- `%s` — %s' % (t, str(res[t]).replace('|', '/')) for t in fails[:40]]
    if quick and not quick_ok:
        out += ['', '### 快检输出', '', '```', quick[-1500:], '```']
    return emit(out, ok)


def repeat():
    fail = collections.defaultdict(list)
    seen = collections.Counter()
    rounds = 0
    for f in sorted(glob.glob('logs/*/only_*.json')):
        rounds += 1
        for t, r in json.load(open(f, encoding='utf-8')).items():
            seen[t] += 1
            if r:
                fail[t].append(str(r).replace('|', '/')[:120])
    want = max(1, min(10, int(os.environ.get('ROUNDS') or '10')))
    ok = rounds == want and not fail and bool(seen)
    out = ['## ' + ('✅ %d 轮全部通过' % rounds if ok else '❌ 有问题'), '',
           '测试片段 `%s` · 交回结果的 %d/%d 轮 · %d 个测试' % (os.environ.get('ONLY', ''), rounds, want, len(seen)), '']
    if fail:
        out += ['| 测试 | 失败几轮 | 第一次失败的原因 |', '|---|---|---|']
        out += ['| `%s` | %d / %d | %s |' % (t, len(v), seen[t], v[0])
                for t, v in sorted(fail.items(), key=lambda x: -len(x[1]))]
    return emit(out, ok)


if __name__ == '__main__':
    sys.exit({'tests': tests, 'repeat': repeat}[sys.argv[1]]())
