#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hansen_bug_registry.py —— 贾维斯 · 事故登记册（v1071）

为什么需要这个
==============
产品负责人的要求是：**每一个版本修出来的 bug，都要有贾维斯守着，不许再犯。**

问题在于「记得给每个修复配一道守卫」本身就是一件**靠人记性**的事 ——
而本项目已经证明过六次：**手工维护的东西必然走散**
（任务配置副本 / 成就清单 / 发音音量 / 存档地址算法 / 页面模块接线 / bump 的文件清单），
第七次是流程本身（v1059~v1069 连丢十一版没跑贾维斯）。

所以这里不是再列一张手工清单，而是把它变成**可校验的合同**：

  · 每条事故必须登记：版本 / 一句话症状 / 由谁看守（守卫函数或回归测试）
  · 登记的守卫/测试**必须真实存在** —— 写了名字却没这个文件，立刻报错
  · CHANGELOG 里出现 🔴 标记的版本**必须在册** —— 修了 bug 却没登记，立刻报错

第三条是关键：它让「修了却没加守卫」这件事**在发版闸门处被拦住**，
而不是等下次复发时才发现。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

# ── 事故登记册 ────────────────────────────────────────────────
# (版本, 一句话症状, 看守者)
#   看守者写守卫函数名（hansen_guards_v1068.py 里的 guard_xxx）
#   或回归测试文件名（test_xxx.mjs）。二者都会被校验是否真实存在。
REGISTRY = [
    ('v1059', '登录状态两个真源：isSignedIn 只读本地标记，8 处决定点全用了假的那个',
     'guard_single_session_truth'),
    ('v1059', '[object Object] 盖住真错误，跨设备存档空转 40 版',
     'guard_error_visibility'),
    ('v1059', '一个 ?v= 查询串把 CloudBase SDK 劈成两份、两套凭证互不可见',
     'guard_single_sdk_instance'),
    ('v1059', '会话真假与清标记时机（含误登出防线）',
     'test_session_truth_v1059.mjs'),
    ('v1060', 'Math.min(progress, goal) 把越界值顶满 → 改 localStorage 即可白领奖励',
     'guard_no_free_reward'),
    ('v1060', '备份 reward/goal 只校验字段名不校验值，伪造备份可塞 {xp:1000001} / goal:0',
     'test_backup_v942.mjs'),
    ('v1060', '断言写在 process.exit() 之后 → 报「全过」而根本没跑（假绿）',
     'guard_no_dead_assertions'),
    ('v1063', '8 个 Land 页被连续漏了四次（账号/门槛/音量/云恢复）',
     'guard_page_wiring'),
    ('v1063', 'spelling_pk.html 资源戳停在 v1004，SW 一直供旧文件',
     'guard_stamp_uniform'),
    ('v1063', '刚登录 60 秒内被后台探测误判为失效 → 「刚登录成功一转眼又退出」',
     'test_session_truth_v1059.mjs'),
    ('v1065', '抢房先读再写 → 两个人进同一间房',
     'guard_atomic_room_claim'),
    ('v1065', '对战词表必须由种子确定性生成，两台设备结果一致',
     'test_pk_room_v1065.mjs'),
    ('v1068', 'friendly() 用 /登录/ 两字通配，把准确原文改写成误导结论',
     'guard_no_message_clobber'),
    ('v1068', '报错文案二次改写的完整合同',
     'test_friendly_msg_v1068.mjs'),
    ('v1069', 'onclick 字符串里 window.( 非法语法，只在点下去那一刻才炸',
     'guard_inline_onclick_syntax'),
    ('v1069', '守卫钉死一整条 JS 赋值语句，等价改写即误报',
     'guard_behavior_not_literal'),
    ('v1069', 'Lv.3 强制注册关闭后，面板逻辑仍须被守着（将来可恢复）',
     'test_signup_gate_v1030.mjs'),
    ('v1066', '探索列表被后台预热 iframe 的 storage 事件反复整表重建、焦点丢失',
     'test_explore_ui_v945.mjs'),
    ('v1070', '发版流程本身会被忘记：v1059~v1069 连丢十一版没跑贾维斯',
     'jarvis_gate.py'),
    ('v1071', 'v1034 成就扩到 144 时又漏了 8 个 Land 页 → 同账号两套成就清单',
     'guard_land_content_parity'),
    ('v1072', '星海觉醒 8 岛与外面 19 岛没打通：Land 页整套拼写大PK 缺失，玩法少一个',
     'guard_land_content_parity'),
    ('v1073', '治本：Land 页手工维护导致同一件事被漏六次，改为从母版盖章生成',
     'guard_land_generated'),
    ('v1074', '母版未纳入盖戳清单，generate_land 用旧戳母版把刚盖好的戳冲回去',
     'guard_stamp_uniform'),
    ('v1074', '守卫自己坏了会永远显示绿灯，而它该守的 bug 可大摇大摆复发',
     'jarvis_selftest.py'),
    ('v1074', '贾维斯知识库曾落后近七十版而无人察觉',
     'guard_jarvis_not_stale'),
    ('v1075', '不可收件的 .local 邮箱只发验证却被当成注册成功',
     'test_auth_contract_v1075.mjs'),
    ('v1075', '没有真实 session/uid 仍写 signedAt 并显示登录成功',
     'guard_auth_real_session'),
    ('v1075', '认证 operation UID 与 SDK session UID 未绑定，可能把旧/匿名会话贴到新账号',
     'test_auth_contract_v1075.mjs'),
    ('v1075', '登录后云档冲突取消会覆盖云端，迟到恢复可能覆盖新进度',
     'test_auth_contract_v1075.mjs'),
    ('v1075', '手机号与用户名登录同一 UID 却推导出两把云存档密钥',
     'guard_auth_real_session'),
]

# CHANGELOG 里从这一版起开始要求登记（更早的版本不追溯）
SINCE = 1059


def _read(name):
    p = os.path.join(ROOT, name)
    try:
        return open(p, encoding='utf-8', errors='replace').read()
    except Exception:
        return ''


def check():
    problems = []

    # ① 登记的看守者必须真实存在
    guards_src = _read('hansen_guards_v1068.py')
    for ver, symptom, keeper in REGISTRY:
        if keeper.endswith('.mjs') or keeper.endswith('.py'):
            if not os.path.exists(os.path.join(ROOT, keeper)):
                problems.append('%s 登记的看守文件不存在: %s' % (ver, keeper))
        else:
            if ('def %s(' % keeper) not in guards_src:
                problems.append('%s 登记的守卫函数不存在: %s' % (ver, keeper))

    # ② CHANGELOG 里带 🔴 的版本必须在册
    #    （🔴 是本项目标记「这是个真事故/关键修复」的约定）
    ch = _read('CHANGELOG.md')
    registered = set(v for v, _, _ in REGISTRY)
    for m in re.finditer(r'^## (v(\d+))[^\n]*\n(.*?)(?=\n## v|\Z)', ch, re.S | re.M):
        ver, num, body = m.group(1), int(m.group(2)), m.group(3)
        if num < SINCE:
            continue
        if '🔴' in body and ver not in registered:
            problems.append(
                '%s 的 CHANGELOG 里有 🔴 关键修复，却没在事故登记册里登记看守者' % ver)

    return problems


def main():
    print('=' * 62)
    print('📒 贾维斯 · 事故登记册   共 %d 条' % len(REGISTRY))
    print('=' * 62)
    problems = check()
    if problems:
        print('\n❌ 登记册发现 %d 个问题:' % len(problems))
        for p in problems:
            print('   - ' + p)
        print('\n   规矩：每修一个 bug，就得在 REGISTRY 里登记「谁来看守」，')
        print('        并确保那个守卫/测试真实存在。靠记性的流程一定会丢。')
        return 1
    print('\n✅ 每一条已登记事故都有真实存在的守卫或回归测试看守')
    print('   （v%d 以来带 🔴 的版本均已登记）' % SINCE)
    return 0


if __name__ == '__main__':
    sys.exit(main())
