#!/usr/bin/env python3
"""分批跑测试.py —— 在「单次命令最多跑约 10 分钟」的环境里把 179 个测试跑完

═══ 为什么要有这个文件 ═══

Claude 的沙盒里，一条命令超过约 10~11 分钟就会被强行掐断。
而 jarvis_gate.py 要跑完 179 个测试 + 自证，总共要 25 分钟左右，
一次是跑不完的。

以前用的是一个没提交进仓库的临时脚本（_fill.py），
换一个对话它就没了 —— 下一个 Claude 只能从头摸索。
现在把它正式放进仓库。

═══ 它做什么 ═══

  · 读 .jarvis_resume.json（jarvis_gate.py 的续跑存档）
  · 只跑**还没有结果**的测试，跑一个存一个
  · 到了预算时间就停（默认 540 秒），下次接着跑
  · 指纹算法和 jarvis_gate.py **一模一样** ——
    代码一改，旧结果自动作废，绝不会用旧结果给新代码背书

全部跑完（179/179、0 失败）之后，再跑
    JARVIS_RELEASING=1 python3 jarvis_gate.py
闸门会直接认这份存档，很快就出凭证。

═══ 用法 ═══

    python3 分批跑测试.py            # 跑一批（默认 540 秒预算）
    python3 分批跑测试.py 400        # 自定义预算（秒）
    python3 分批跑测试.py --recheck  # 把记成失败的测试一个个串行重跑

⚠️ 关于「并行假失败」：
    并行跑时 CPU 会被抢，有些重测试会假超时。
    看到失败先用 --recheck 串行重跑一次 —— 实测十次里九次是假的。
    串行仍然失败的，才是真失败，要去看那个测试的输出。
"""
import glob
import hashlib
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.abspath(__file__))
RESUME_FILE = os.path.join(ROOT, '.jarvis_resume.json')
PARALLEL = 3          # 再多 CPU 就抢不过来，假失败会变多
PER_TEST = 300        # 单个测试最多 5 分钟
# 🔴v1164：真 SDK 端到端（*_cloud_v1164.mjs）用的是产品真实时长（天梯 20 秒自己开房、掉线 60 秒判负），
#   单跑就要 1~4 分钟，三个并行时会被挤过 5 分钟 —— 给它们 10 分钟，超时仍算失败。
LONG_TEST = 600


def _limit(name):
    # 🔴v1164（第一轮修复）：test_cloud_errors_v1164 也是真 SDK 端到端（名字里 cloud 在前面），单跑就要 2~3 分钟
    return LONG_TEST if ('cloud' in name and '_v1164' in name) else PER_TEST


def fingerprint():
    """必须和 jarvis_gate.py 里的 _fingerprint() 完全一致，否则闸门不认这份存档。"""
    h = hashlib.sha256()
    srcs = []
    # 🔴v1164（审查 TI-6）：模拟云端（cloudbase_*.mjs）、测试公共件（*.mjs）、发给手机的 SDK（vendor_*.js）
    #   以前都不算进指纹 —— 模拟云端放宽了 / SDK 换了，旧的「全绿」照样作数。现在 *.js / *.mjs 全算。
    for pat in ('*.js', '*.mjs', 'template.html', '*.py'):
        srcs += glob.glob(os.path.join(ROOT, pat))
    for f in sorted(set(srcs)):
        try:
            h.update(os.path.basename(f).encode())
            h.update(open(f, 'rb').read())
        except Exception:
            pass
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        try:
            h.update(os.path.basename(f).encode())
            h.update(str(os.path.getsize(f)).encode())
        except Exception:
            pass
    return h.hexdigest()[:16]


def load(fp):
    try:
        r = json.load(open(RESUME_FILE, encoding='utf-8'))
        if r.get('fp') == fp:
            return r.get('done', {})
    except Exception:
        pass
    return {}


def save(fp, done):
    tmp = RESUME_FILE + '.tmp'
    json.dump({'fp': fp, 'done': done}, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(tmp, RESUME_FILE)


def run_one(name):
    """返回 None 表示通过；否则返回一小段失败原因。"""
    try:
        r = subprocess.run(['node', os.path.join(ROOT, name)], cwd=ROOT,
                           capture_output=True, timeout=_limit(name))
        if r.returncode == 0:
            return None
        out = (r.stdout or b'').decode('utf-8', 'replace') + (r.stderr or b'').decode('utf-8', 'replace')
        bad = [ln.strip() for ln in out.split('\n') if 'XX' in ln or 'Error' in ln]
        return (bad[0] if bad else 'exit %d' % r.returncode)[:160]
    except subprocess.TimeoutExpired:
        return 'timeout'
    except Exception as e:
        return 'crash: %s' % str(e)[:120]


def main():
    args = sys.argv[1:]
    fp = fingerprint()
    done = load(fp)
    tests = sorted(os.path.basename(t) for t in glob.glob(os.path.join(ROOT, 'test_*.mjs')))

    if '--recheck' in args:
        fails = [k for k, v in done.items() if v]
        print('串行重跑 %d 个失败项（并行假失败很常见）' % len(fails))
        for t in fails:
            res = run_one(t)
            done[t] = res
            save(fp, done)
            print('  %s %s' % ('OK' if res is None else 'XX', t + ('' if res is None else '  ' + res)))
    else:
        budget = 540
        for a in args:
            if a.isdigit():
                budget = int(a)
        t0 = time.time()
        pending = [t for t in tests if t not in done]
        print('已有 %d 个结果，本批最多跑 %d 秒，待跑 %d 个' % (len(done), budget, len(pending)))
        with ThreadPoolExecutor(max_workers=PARALLEL) as ex:
            futs = {}
            it = iter(pending)
            # 预算快用完时就不再派新活，已派出去的等它跑完
            for _ in range(PARALLEL):
                t = next(it, None)
                if t:
                    futs[ex.submit(run_one, t)] = t
            while futs:
                for f in as_completed(list(futs)):
                    t = futs.pop(f)
                    done[t] = f.result()
                    save(fp, done)
                    if time.time() - t0 < budget - PER_TEST / 3:
                        nt = next(it, None)
                        if nt:
                            futs[ex.submit(run_one, nt)] = nt
                    break

    fails = [k for k, v in done.items() if v]
    left = [t for t in tests if t not in done]
    print('\n进度 %d/%d · 失败 %d · 剩余 %d' % (len(done), len(tests), len(fails), len(left)))
    for k in fails[:8]:
        print('  失败: %s  %s' % (k, done[k]))
    if not left and not fails:
        print('✅ 全部通过 —— 现在可以跑：JARVIS_RELEASING=1 python3 jarvis_gate.py')
    elif fails:
        print('→ 先跑 python3 分批跑测试.py --recheck 排除并行假失败')
    else:
        print('→ 再跑一次 python3 分批跑测试.py 继续')


if __name__ == '__main__':
    main()
