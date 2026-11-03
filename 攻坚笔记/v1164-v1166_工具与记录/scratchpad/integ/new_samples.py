def _inj_room_code(s):
    """对战回包查 code：把 read 的 chk 拿掉 —— realTransport 里只剩 5 处。"""
    m = "C(d).doc(id).get().then(chk('read'))"
    return s.replace(m, "C(d).doc(id).get()", 1) if m in s else None

def _inj_board_code(s):
    """榜单好友查 code：读好友记录不过 call() —— 权限被拒会被当成「没有这条」。"""
    m = "call(d.collection(COLLECTION).doc(id).get(), '读取好友记录', COLLECTION)"
    return s.replace(m, "d.collection(COLLECTION).doc(id).get()", 1) if m in s else None

def _inj_multi_write(s):
    """房间不批量改：把按 _id 改换成 where().update()。"""
    m = "C(d).doc(id).update(data)"
    return s.replace(m, "C(d).where({ _id: id }).update(data)", 1) if m in s else None

def _inj_room_phone(s):
    """房间不放手机号：身份从本地登录记录的手机号来。"""
    m = "var uid = String(s.uid || lcUid || '');"
    return s.replace(m, "var uid = String((A.readLocal() || {}).phone || s.uid || lcUid || '');", 1) if m in s else None

def _inj_overlay_z(s):
    """天梯好友在大PK之上：天梯界面的 z-index 改回 v1163 的 2147482000。"""
    m = 'z-index:2147483500'
    return s.replace(m, 'z-index:2147482000', 1) if m in s else None

def _inj_session_timeout(s):
    """会话总超时：去掉 ensureSession 的整体时限。"""
    m = 'var cancel = timeoutAfter(SESSION_TIMEOUT_MS,'
    return s.replace(m, 'var cancel = noLimit(SESSION_TIMEOUT_MS,', 1) if m in s else None

def _inj_marker_no_creds(s):
    """没凭证不写登录：用户名登录不查凭证就写「已登录」。"""
    m = "credentialsCheck(res, '用户名登录');"
    return s.replace(m, '', 1) if m in s else None

def _inj_join_no_confirm(s):
    """进房要等确认：房主读到房间里有客人就直接开打（不等客人回话）。"""
    m = 'if (pend) return confirm(R, S);'
    return s.replace(m, 'if (R.guestId) { joined(R, S); return; }', 1) if m in s else None

def _inj_watchdog_close(s):
    """看门狗不乱咬：天梯 close() 里又上哨。"""
    m = 'function close() {\n    try { setTimeout(refreshEntry, 60); } catch (e) {}'
    return s.replace(m, "function close() {\n    try { HansenPkWatchdog.arm('排位'); } catch (e) {}\n    try { setTimeout(refreshEntry, 60); } catch (e) {}", 1) if m in s else None

def _inj_ladder_gate(s):
    """排位按种类分流：岛上的天梯入口不过登录那道门。"""
    m = "if (!needOnline()) return;\n      HansenLadderUI.open();"
    return s.replace(m, "HansenLadderUI.open();", 1) if m in s else None

def _inj_untypeable(s):
    """对战键盘打得出：取词不再跳过带空格 / 连字符的词。"""
    m = 'if (w && w.en && /^[a-zA-Z]+$/.test(String(w.en)))'
    return s.replace(m, 'if (w && w.en)', 1) if m in s else None

def _inj_force_skip(s):
    """同步赛不强翻：对手一拼对就把我也翻到下一词（不分模式）。"""
    m = 'if (oppGot && !M.waitAll && !_rt.answered) { submitRound(idx, false, true); return; }'
    return s.replace(m, 'if (oppGot && !_rt.answered) { submitRound(idx, false, true); return; }', 1) if m in s else None

def _inj_backup_sdk(s):
    """备份不收 SDK 键：SDK_KEY_RE 漏掉 user_info。"""
    m = 'var SDK_KEY_RE=/^(?:credentials|user_info|lang|'
    return s.replace(m, 'var SDK_KEY_RE=/^(?:credentials|lang|', 1) if m in s else None

def _inj_cloud_stub(s):
    """真 SDK 测试无桩：端到端测试里偷偷调短了数据层的时间。"""
    return s + "\nawait H.sleep(1); globalThis.__x = 'HansenPkRoom._setTimingForTest({ waitPollMs: 1 })';\n"

def _inj_friendly_lie(s):
    """friendly 说实话：去掉「云端没给凭证」那一条 —— credentials not found 又会被说成用户名不对。"""
    m = "if (/unauthenticated|credentials not found|invalid_grant/i.test(m))"
    return s.replace(m, "if (/unauthenticated|invalid_grant/i.test(m))", 1) if m in s else None

NEW_CASES = [
    ('对战回包查 code', 'hansen_pk_room_v1065.js',      _inj_room_code,       'guard_room_transport_checks_code'),
    ('榜单好友查 code', 'hansen_friends_v1106.js',      _inj_board_code,      'guard_board_friends_check_code'),
    ('房间不批量改',    'hansen_pk_room_v1065.js',      _inj_multi_write,     'guard_room_no_multi_write'),
    ('房间不放手机号',  'hansen_pk_room_v1065.js',      _inj_room_phone,      'guard_room_no_phone'),
    ('天梯好友在大PK之上', 'hansen_ladder_ui_v1108.js', _inj_overlay_z,       'guard_overlays_above_pk'),
    ('会话总超时',      'hansen_auth_v1004.js',         _inj_session_timeout, 'guard_session_has_timeout'),
    ('没凭证不写登录',  'hansen_auth_v1004.js',         _inj_marker_no_creds, 'guard_no_marker_without_creds'),
    ('进房要等确认',    'hansen_pk_room_v1065.js',      _inj_join_no_confirm, 'guard_join_waits_for_host'),
    ('看门狗不乱咬',    'hansen_ladder_ui_v1108.js',    _inj_watchdog_close,  'guard_watchdog_not_false_alarm'),
    ('排位按种类分流',  'hansen_sb_pk_v1022.js',        _inj_ladder_gate,     'guard_ladder_routes_by_kind'),
    ('对战键盘打得出',  'hansen_pk_room_v1065.js',      _inj_untypeable,      'guard_pk_words_typeable'),
    ('同步赛不强翻',    'hansen_pk_room_ui_v1065.js',   _inj_force_skip,      'guard_waitall_no_force_skip'),
    ('备份不收 SDK 键', 'hansen_backup_v944.js',        _inj_backup_sdk,      'guard_backup_skips_sdk_keys'),
    ('真 SDK 测试无桩', 'test_ladder_cloud_v1164.mjs',  _inj_cloud_stub,      'guard_cloud_tests_no_stubs'),
    ('friendly 说实话', 'hansen_auth_v1004.js',         _inj_friendly_lie,    'guard_friendly_tells_truth'),
]
