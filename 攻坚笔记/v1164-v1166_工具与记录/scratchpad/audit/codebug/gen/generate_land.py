#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_land.py —— 「印章」架构 · 单词大陆 8 岛生成器（v1073 治本）

为什么要有这个
==============
`island_land1~8.html` 一直是**手工维护**的，不由 `generate.py` 从 template 分发。
结果是同一件事被漏了整整六次：

  v1021 账号接线 / v1030 Lv.3 门槛 / v1034 成就 36→144 /
  v1038 全站音量 / v1048 开机云端恢复 / v1072 拼写大PK

每一次都是「改了 template → 19 个常规岛跟上了 → 8 个 Land 页原地不动」。
v1063~v1072 靠 `guard_land_content_parity` 做**事后拦截**，有效，
但那只是"漏了会被抓到"，不是"不会漏"。

**治本 = 让 Land 页也从母版盖章生成。** 改一次母版，27 个岛全部跟上。

可行性是量出来的，不是拍脑袋
============================
逐行比对 8 个 Land 页：**8276 行里只有 49 行是每页专属的（0.6%）**，
合并成 13 个连续段 —— 标题 / 星域名 / 拼写蜂入口 / 两块词表 /
存档 key ×3 / BOSS 列表 / 闯关进度 ×2 / 底部提示 / 首次引导。

其余 8227 行（99.4%）**八页完全一致**，正是母版该管的部分。
Land 独有逻辑（返回 land_map 的导航、`__landRetryBoss`、`bossDefeat` 覆写、
`_s1Idx` 闯关推进、STAR SEA 标题块）在八页中**逐字相同**，
因此天然属于母版而非数据。

无损契约（与 generate.py 同规矩）
================================
生成结果必须与现有 8 个页面**逐字一致**。本脚本自带 `--verify`：
不一致就报错退出，绝不允许"生成器把页面改了但没人发现"。
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

TPL = 'land_template.html'
DATA = 'land_data.json'
SLOT = '⟦⟦LAND_SLOT_%02d⟧⟧'


def generate(tpl: str, slots: list) -> str:
    """把 13 段专属内容盖回母版。顺序即槽位号，不做任何额外加工。"""
    out = tpl
    for k, seg in enumerate(slots):
        ph = SLOT % k
        if ph not in out:
            raise RuntimeError('母版缺占位符 %s' % ph)
        out = out.replace(ph, seg, 1)
    return out


def main():
    verify_only = '--verify' in sys.argv
    tpl = open(TPL, encoding='utf-8').read()
    data = json.load(open(DATA, encoding='utf-8'))

    n_slot = tpl.count('⟦⟦LAND_SLOT_')
    print('母版 %s · 占位符 %d 个' % (TPL, n_slot))

    bad = 0
    for i in range(1, 9):
        name = 'land%d' % i
        fn = 'island_%s.html' % name
        if name not in data:
            print('  ❌ %s 缺数据' % fn); bad += 1; continue
        slots = data[name]['slots']
        if len(slots) != n_slot:
            print('  ❌ %s 槽位数不符：数据 %d / 母版 %d' % (fn, len(slots), n_slot))
            bad += 1; continue
        html = generate(tpl, slots)

        old = open(fn, encoding='utf-8').read() if os.path.exists(fn) else None
        if verify_only:
            if old is None:
                print('  ❌ %s 不存在' % fn); bad += 1
            elif html != old:
                # 给出第一处差异，便于定位
                import difflib
                a, b = old.split('\n'), html.split('\n')
                d = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), None)
                print('  ❌ %s 生成结果与现有文件不一致（首处差异在第 %s 行）'
                      % (fn, (d + 1) if d is not None else '?'))
                bad += 1
            else:
                print('  ✅ %s 逐字一致' % fn)
        else:
            if old == html:
                print('  ·  %s 无变化' % fn)
            else:
                open(fn, 'w', encoding='utf-8').write(html)
                print('  ✅ %s 已重新盖章' % fn)

    if bad:
        print('\n❌ %d 个页面未通过 —— 生成器与现有页面不一致，拒绝继续。' % bad)
        print('   （这条无损契约的意义：绝不允许"生成器悄悄改了页面而没人发现"）')
        return 1
    print('\n✅ 单词大陆 8 岛%s完成 —— 改一次母版，8 岛全部跟上，不会再漏第七次。'
          % ('校验' if verify_only else '盖章'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
