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
    ('v1075', 'v1057 真凶类别：import 了不存在的文件，静态可查却要用户点下去才暴露',
     'guard_refs_exist'),
    ('v1075', '整份 JS 语法错误不该等用户发现',
     'guard_js_syntax'),
    ('v1075', '写玩家数据的页面若缺账号/云存档/备份，数据不会跟着账号走',
     'guard_data_writer_has_cloud'),
    ('v1075', 'hansen_island_upgrade 内嵌 36 条成就旧副本（第八次两处真源），已彻底拆除',
     'guard_no_divergent_config'),
    ('v1076', '已登录时仍无条件发起匿名登录，冲掉账号凭证 → 刚登录成功一转眼就失效',
     'test_no_anon_clobber_v1076.mjs'),
    ('v1077', '空登录态问一次就判"已过期"且无重试 → 用户陷入"登录成功→被告知过期→重登"死循环',
     'test_session_retry_v1077.mjs'),
    ('v1078', '云端链路只能靠用户截图观察，此前几版都在猜哪一步坏了；改为面板输出完整探测轨迹',
     'test_session_retry_v1077.mjs'),
    ('v1079', '登录成功后不校验 SDK 返回值就写本地标记 → 界面说已登录、云端其实没会话',
     'test_session_retry_v1077.mjs'),
    ('v1080', 'SDK 的 setCredentials 在响应缺 expires_in 时会删掉已存凭证且仍 resolve → 登录"成功"但会话不存在',
     'test_phone_signup_v1057.mjs'),
    ('v1081', '面板不显示版本号 → 连改五版都无法确认用户手机上跑的是哪一版，修了等于白修',
     'test_cloud_diag_v1027.mjs'),
    ('v1082', 'SW 导航超时仅 3 秒，手机网络稍慢就退回旧缓存；HTML 无版本戳被一直复用 → 用户连着几版跑旧代码而双方不知情',
     'test_sw_upgrade_v944.mjs'),
    ('v1083', '「做出来的东西不显示」治本：全站装版本守望者，去服务器比对版本，落后即自动清缓存硬重载',
     'guard_version_watch_everywhere'),
    ('v1084', '守望者在 iframe 里重载只重载子框、外壳仍旧版；相对路径解析错；老内核无 fetch 则完全不工作',
     'guard_version_watch_everywhere'),
    ('v1085', '云端凭证登录后约 2 秒被删且不知是谁删的，已连猜三次未果 → 装凭证生死簿抓现行',
     'test_cred_trap_v1085.mjs'),
    ('v1086', 'SDK 拦截器：任何带凭证的请求回一次 UNAUTHENTICATED 就删掉整个凭证；而开机恢复在登录后 1.2 秒就读库',
     'guard_no_rush_after_login'),
    ('v1087', '生死簿只记本次会话，页面一重载记录全丢 → 用户截图显示"没人动过凭证"，实为工具漏了',
     'test_cred_trap_v1085.mjs'),
    ('v1088', '多个 CloudBase 实例并发刷新同一 refresh_token → invalid_grant → SDK 删掉整个凭证',
     'guard_single_instance_when_signed_in'),
    ('v1089', 'v1088 只堵了云存档，账号模块在子框里照样建实例 —— 口子没堵死',
     'guard_single_instance_when_signed_in'),
    ('v1090', '🎯真凶：备份恢复把旧凭证快照盖回 localStorage → 过期 refresh_token → invalid_grant → SDK 删掉整个凭证',
     'guard_backup_excludes_credentials'),
    ('v1090', 'v1088 只堵云存档没堵账号模块；子框内 hansen_auth 照样建实例',
     'guard_single_instance_when_signed_in'),
    ('v1091', '🔴我造成的事故：v1090 把子框一律拦死，拼写大PK 在 iframe 里跑，用户连登录都点不了',
     'test_iframe_login_v1091.mjs'),
    ('v1092', 'SDK 源码确认：手机号会话刷新失败无兜底直接删凭证（匿名会话才有 anonymousLogin）→ 加影子备份+跨页刷新锁+失败救回',
     'test_cred_guard_v1092.mjs'),
    ('v1093', '🔴v1091 只改了 app() 没改 auth()，子框里 _auth 仍为 null → 报「鉴权不可用」，登录照样点不动',
     'test_iframe_login_v1091.mjs'),
    ('v1094', '🔴我加的诊断/守护键以 hansen_ 开头被备份收录 → 「备份含非法键或非字符串值」，存云端失败',
     'test_backup_v942.mjs'),
    ('v1095', '🎯真凶：hsn_progress:<中文岛名> 键名含中文，备份字符集只许英数 → 「备份含非法键」，存云端永远失败',
     'test_cjk_key_backup_v1095.mjs'),
    ('v1096', '攻坚笔记入库并转化为 7 道守卫，防止六个真凶任何一个重演',
     'guard_campaign_notes_present'),
    ('v1097', '🔴挑刺发现三处漏洞：凭证分数可伪造/笔记写死数字会过时/7 道守卫无人验证',
     'guard_every_guard_has_selftest'),
    ('v1098', '🔴挑刺：闸门从不跑测试(153 个全靠人手动)；4 处恒真断言 ok(true,…) 等于没测',
     'guard_no_always_true_assert'),
    ('v1099', '🔴拼写大PK 的对战屏是自制简陋版(纯输入框)，不是用户熟悉的拼写蜂玩法',
     'test_pk_battle_ui_v1101.mjs'),
    ('v1100', '🔴对战做成了"各自做完一整套题再比分"，而真正的对战是同一个词两人同时拼',
     'test_pk_modes_v1100.mjs'),
    ('v1101', '🔴v1100 只改了底层，对战屏仍是"一次给全部词"；重写为回合制一次一个词',
     'test_pk_battle_ui_v1101.mjs'),
    ('v1102', '🔴拼写对战没有发音——而听音拼词正是拼写比赛的本质；补两种出题形式',
     'test_pk_ask_mode_v1102.mjs'),
    ('v1103', '🔴对战打完什么都不留下——赢了没痕迹，天梯一直"敬请期待"；ELO 算法早写好只缺存状态层',
     'test_pk_record_v1103.mjs'),
    ('v1104', '🔴对手强退/掉线会把人晾到 10 分钟兜底；且只有房主发心跳，客人掉线根本检测不到',
     'test_pk_abandon_v1104.mjs'),
    ('v1105', '🔴没有邀请好友的办法——只能等陌生人开房；补房间码（私密房不进公开列表）',
     'test_pk_room_code_v1105.mjs'),
    ('v1106', '🔴没有好友系统——只能靠房间码；补好友/在线状态/隐身/固定快捷语（禁止自由打字）',
     'test_friends_v1106.mjs'),
    ('v1107', '🔴v1106 只做了好友底层没有界面——功能调不到等于没做',
     'test_friends_ui_v1107.mjs'),
    ('v1108', '🔴天梯功能 v1103 就做好了，按钮却一直是「敬请期待」——做了功能没入口等于没做'
              '（新增 hansen_ladder_ui_v1108.js：实力匹配 + 战绩页）',
     'test_ladder_v1108.mjs'),
    ('v1109', '🔴自查发现三处：新用户看到一屏 0% 很打击人；未登录点排位白等 20 秒才报错；未登录点好友假装"还没有好友"',
     'test_ladder_v1108.mjs'),
    ('v1110', '🔴v1107/v1108 新界面全是写死深色，亮色模式下是一块突兀的黑；且批量替换把变量定义也换了导致自我引用',
     'test_theme_v1110.mjs'),
    ('v1111', '🔴只把背景变量化了、前景写死 #fff —— 亮色下"🟢 在线"选中态白底白字，对比度 1.0',
     'guard_theme_fg_follows_bg'),
    ('v1112', '🔴挑刺三处：关闭按钮 27px 手指点不准；连点开三个僵尸房；战绩存档被写坏会显示"胜 很多"',
     'test_pk_record_v1103.mjs'),
    ('v1113', '🔴并发挑刺两处：两人同时互加好友会各写两条造成重复；天梯页与好友页能同时开着且 z-index 相同',
     'test_friends_v1106.mjs'),
    ('v1114', '🔴安全挑刺三处：能冒充别人发消息、陌生人单方面进孩子好友列表、匹配分数客户端说了算',
     'test_friends_v1106.mjs'),
    ('v1115', '🔴弱网挑刺：请求卡住永不超时界面一直转圈；断网显示 Failed to fetch；超时文案露出内部方法名',
     'test_pk_room_v1065.mjs'),
    ('v1116', '🔴无障碍挑刺五处：图标按钮无文字说明、Esc 关不掉、Tab 跑到浮层后面、背景能滚、焦点不进浮层',
     'test_friends_ui_v1107.mjs'),
    ('v1117', '🔴性能挑刺：favicon.ico 是 384×384 的 PNG 共 215KB，被每页自动请求两次 = 白费 430KB',
     'guard_favicon_small'),
    ('v1118', '🔴对战用系统输入法：中文输入法要先切英文、键盘占半屏挡住对手状态、联想会替玩家拼好单词',
     'test_pk_keyboard_v1118.mjs'),
    ('v1119', '🔴320px 老手机上键盘最窄的键只有 24px，手指点不准（v1112 刚为关闭按钮改过同类问题）',
     'test_pk_keyboard_v1118.mjs'),
    ('v1120', '🔴切后台时倒计时照跑——接个微信消息回来发现这词已超时，而他根本没机会答',
     'test_tap_targets_v1120.mjs'),
    ('v1121', '🔴好友列表逐个查在线：50 个好友 = 51 次数据库读，每 15 秒刷一次，挂一小时烧 12000 次',
     'test_friends_v1106.mjs'),
    ('v1122', '🔴结算还在读 v1099 的旧字段 st.correct（回合制下从没赋值）→ 打完 3 局战绩记 0 局',
     'test_pk_record_v1103.mjs'),
    ('v1123', '🔴两人真实对战根本跑不通：对手被误判掉线、落后一方永远卡在上一词分数恒为 0',
     'test_pk_battle_ui_v1101.mjs'),
    ('v1124', '🔴两人都超时时房间 round 不推进 → 下一词 claim 条件不成立 → 白拼一次、双方彻底脱节',
     'test_pk_modes_v1100.mjs'),
    ('v1125', '🔴被抢走时只显示"对手：正在拼…"，输入框莫名清空——用户不知道发生了什么，也看不到答案',
     'test_pk_modes_v1100.mjs'),
    ('v1126', '🔴切后台暂停倒计时对对手不公平（A 回来还有 9 秒，B 早超时）；且两人开局计时差 6 秒',
     'test_pk_modes_v1100.mjs'),
    ('v1127', '🔴v1126 的共享计时用了陈旧的 roundAt——房间等 2 分钟后一进对战倒计时直接 0 秒',
     'test_pk_battle_ui_v1101.mjs'),
    ('v1128', '🔴输家看不到任何天梯分说明——段位保护住了他但界面一声不吭，用户以为记分坏了',
     'test_pk_record_v1103.mjs'),
    ('v1129', '🔴未登录时竞赛 ID 显示「No.---」，而好友页却让人去那里找 ID——两头都卡住',
     'test_friends_ui_v1107.mjs'),
    ('v1130', '🔴竞赛 ID 本地发号——每台设备第一个用户都是 No.001；云端发号也会并发撞号',
     'test_cid_order_v1130.mjs'),
    ('v1131', '⚠️test_phone_signup 随机失败(测试自身竞态)——改四轮未根治，已如实登记不再耗',
     'test_cid_order_v1130.mjs'),
    ('v1131', '🔴同一个身份条有两套并存实现（29 个岛屿页用模块、PK 页用内联），改一处会漏另一处',
     'guard_no_parallel_pk_panel'),
    ('v1132', '🔴边遍历边读 localStorage：集合被别的模块改动时索引错位，登录成功却扫不到凭证',
     'test_cred_scan_v1132.mjs'),
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
