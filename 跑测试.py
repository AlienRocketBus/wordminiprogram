#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""跑测试之前先确认文件在

═══ 为什么要有这个 ═══

今天我**三次**写了根本不存在的测试文件名去跑：

    test_friends_v1107      （真名是 test_friends_ui_v1107）
    test_auth_ui_v1004      （根本没有这个文件）
    test_land_cards_v944    （真名是别的）

每次 `node` 都以 `MODULE_NOT_FOUND` 退出，返回码非零 ——
而我的循环把返回码非零一律当成"测试失败"，
于是**报出一堆假的失败**，然后我去查一个不存在的问题。

> **一个"文件不存在"和一个"测试没通过"，退出码是一样的。**
> 但它们的含义天差地别：前者是我打错字，后者是产品有问题。
> 把两者混在一起，最坏的结果是**真失败被淹没在假失败里**。

═══ 用法 ═══

    python3 跑测试.py test_ladder_v1108 test_pk_room_v1065 ...

    · 文件不存在 → 立刻指出来，并给出最接近的真名
    · 文件存在   → 跑，并把"通过/失败"分开报
"""
import difflib
import glob
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    names = sys.argv[1:]
    if not names:
        print('用法：python3 跑测试.py test_xxx [test_yyy ...]')
        return 2

    have = sorted(os.path.basename(x) for x in glob.glob(os.path.join(ROOT, 'test_*.mjs')))
    have_stem = [x[:-4] for x in have]

    # ① 先把名字对一遍 —— 不存在的文件不算测试失败
    missing = []
    real = []
    for n in names:
        stem = n[:-4] if n.endswith('.mjs') else n
        if stem in have_stem:
            real.append(stem + '.mjs')
        else:
            near = difflib.get_close_matches(stem, have_stem, n=2, cutoff=0.6)
            missing.append((n, near))

    if missing:
        print('  ⚠️  这些文件不存在（不是测试失败，是名字写错了）：')
        for n, near in missing:
            tip = ('  你是不是想跑：' + ' / '.join(near)) if near else '  （找不到相近的）'
            print('     · %s%s' % (n, tip))
        print()

    if not real:
        return 1

    # ② 真正跑
    passed, failed = [], []
    for name in real:
        t0 = time.time()
        try:
            rc = subprocess.run(['node', name], cwd=ROOT,
                                capture_output=True, timeout=420).returncode
        except Exception:
            rc = 1
        el = time.time() - t0
        (passed if rc == 0 else failed).append((name, el))
        print('  %s %-40s %.0fs' % ('OK' if rc == 0 else 'XX', name, el))

    print('\n  通过 %d · 失败 %d%s'
          % (len(passed), len(failed),
             ('（%d 个文件名写错，不计入）' % len(missing)) if missing else ''))
    if failed:
        print('  失败的：' + '、'.join(n for n, _ in failed))
    return 1 if (failed or missing) else 0


if __name__ == '__main__':
    sys.exit(main())
