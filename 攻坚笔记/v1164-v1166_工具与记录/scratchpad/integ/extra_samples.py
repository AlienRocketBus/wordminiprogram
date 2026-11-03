def a(s):
    m="call(col.orderBy('ladderRating', 'desc').limit(TOP_N * 3).get(), '读取排行榜')"
    return s.replace(m,"col.orderBy('ladderRating', 'desc').limit(TOP_N * 3).get()",1) if m in s else None
def b(s):
    return s.replace('z-index:2147483500','z-index:2147482000',1) if 'z-index:2147483500' in s else None
def c(s):
    m="T('用户名注册', '❗云端不支持用户名注册 → 如实拒绝，不写登录态');"
    return s.replace(m, m+"\n    writeLocal({ method: 'password' });",1) if m in s else None
def d(s):
    m="6 秒后这一屏又会冒出来，点了又来，没完没了（实测死循环）。 */\n        _armed = null;"
    return s.replace(m,"6 秒后这一屏又会冒出来，点了又来，没完没了（实测死循环）。 */",1) if m in s else None
def e(s):
    m="function onFail(run, r) {"
    return s.replace(m, m+"\n    if (/登录|会话/.test(String(r.reason))) return;",1) if m in s else None
def f(s):
    m='|refresh_token|login_type|anonymous_uuid|token_type)_|^device_id$|'
    return s.replace(m,'|refresh_token|login_type|anonymous_uuid|token_type)_|',1) if m in s else None
def h(s):
    m="var GRACE_MS = 3000;"
    return None
NEW_CASES=[
 ('榜单好友查 code','hansen_ladder_board_v1156.js',a,'guard_board_friends_check_code'),
 ('天梯好友在大PK之上','hansen_friends_ui_v1107.js',b,'guard_overlays_above_pk'),
 ('没凭证不写登录','hansen_auth_v1004.js',c,'guard_no_marker_without_creds'),
 ('看门狗不乱咬','hansen_pk_watchdog_v1155.js',d,'guard_watchdog_not_false_alarm'),
 ('排位按种类分流','hansen_ladder_ui_v1108.js',e,'guard_ladder_routes_by_kind'),
 ('备份不收 SDK 键','hansen_backup_bootstrap_v944.js',f,'guard_backup_skips_sdk_keys'),
]
