# 一个班 30 人、每人每天 5 局排位 + 平常用，每天/每月要多少次云端调用（读+写），按实测速率算
KIDS, GAMES_PER_KID, DAYS = 30, 5, 20            # 20 个上课日；周末在家玩没算进去（保守）
games = KIDS * GAMES_PER_KID / 2                  # 一局两个人
# —— 实测（v1164 真 SDK + 模拟云端，60ms 延迟）——
BATTLE_RPS = 3.1        # 对战中每部手机每秒读（A 3.01 / B 3.19 / C 3.20）
BATTLE_WPS = 0.30       # 对战中每部手机每秒写（A 0.25 / B 0.33 / C 0.33）
MATCH_RPS = 1.64        # 排位找人时每秒读（21 秒里 35 读）
HOSTWAIT_RPS = 0.80     # 排位房主一个人等时每秒读（45 秒里 36 读）
JOIN_CALLS = 24 + 16    # 客人进房+等确认 + 房主那 8 秒（实测 24 + 16 次）
RESULT_CALLS = 15       # 结算后两人合计
# —— 假设 ——
BATTLE_S = 100          # 孩子一局 10 个词约 100 秒（实测脚本 5 秒/词是 77~94 秒）
MATCH_S, WAIT_S = 20, 20 # 一半的人要自己开房等 20 秒
ISLAND_MIN, PK_MIN, ACTIVE_MIN = 30, 10, 20   # 每天开着岛屿页 30 分钟（其中 20 分钟在答题），在大PK页 10 分钟
PRESENCE_ISLAND_WPM, PRESENCE_PK_WPM = 9, 3   # 实测：岛屿页 3 层页面各写一次在线心跳 / 20 秒
SAVE_UPM = 8            # 答题时云存档上传（实测连续改数据 16.5 次/分；这里按一半算）
HIDE_UPLOADS, HIDES = 9, 4    # 切后台一次 9 次上传（实测），一天 4 次
PAGELOAD_READS, LOADS = 10, 5 # 打开一次岛屿页约 10 次读（实测），一天 5 次

def per_game(battle_rps, battle_wps, match_rps, wait_rps, join, result):
    two = 2 * BATTLE_S * (battle_rps + battle_wps)
    return two + MATCH_S * match_rps + 0.5 * WAIT_S * wait_rps + join + result
def per_kid_idle(pres_isl, pres_pk, save_upm, hide_up, pageload):
    return ISLAND_MIN * pres_isl + PK_MIN * pres_pk + ACTIVE_MIN * save_upm + HIDES * hide_up + LOADS * pageload

now_game = per_game(BATTLE_RPS, BATTLE_WPS, MATCH_RPS, HOSTWAIT_RPS, JOIN_CALLS, RESULT_CALLS)
now_idle = per_kid_idle(PRESENCE_ISLAND_WPM, PRESENCE_PK_WPM, SAVE_UPM, HIDE_UPLOADS, PAGELOAD_READS)
# 改完以后（见报告里的减量方案）：对战一轮一次合并读 + 掉线判定复用 + 清理只跑一次 + 在线心跳一层页面 60 秒 + 云存档没变不传、一层页面传
aft_game = per_game(1.05, BATTLE_WPS, 0.45, 0.42, 30, 8)
aft_idle = per_kid_idle(1, 1, 4, 1, 4)
for name, g, i in [('现在 v1164', now_game, now_idle), ('按方案改完', aft_game, aft_idle)]:
    day = games * g + KIDS * i
    print(f'{name}: 每局 {g:.0f} 次 · 每人每天平常用 {i:.0f} 次 · 全班每天 {day:,.0f} 次 · 每月 {day*DAYS:,.0f} 次')
    print(f'    旧「个人版」套餐 20 万次/月 → {200000/day:.1f} 个上课日用完；资源点 40000 点（数据库 200 点/万次）→ 数据库就占 {day*DAYS/10000*200/40000*100:.0f}%')
