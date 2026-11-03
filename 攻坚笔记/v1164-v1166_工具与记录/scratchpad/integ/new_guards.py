

# ═════════════════════════════════════════════════════════════
# 🔴v1164 —— 天梯 / 房间对战在真机上从来没成功过的那一批教训
#   根因：云端集合是「读取全部数据，修改本人数据」，客人去改房主的文档永远静默失败；
#   SDK 遇到业务错误是 resolve 一个 {code}，没人查 → 权限被拒看起来像「成功 / 空」。
#   假传输层什么都让写，所以测试一直是绿的。下面每一道都对应一个真实的坑。
# ═════════════════════════════════════════════════════════════

def _fn_body(src, name, span=6000):
    """取出 `function name(` 的函数体（按花括号配对；找不到返回空串）。"""
    i = src.find('function ' + name + '(')
    if i < 0:
        return ''
    j = src.find('{', i)
    if j < 0:
        return ''
    depth = 0
    for k in range(j, min(len(src), j + span * 4)):
        c = src[k]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return src[i:k + 1]
    return src[i:j + span]


def guard_room_transport_checks_code():
    """对战传输层：每个云端操作都要查回包里的 code。

    事故（v1164）：SDK 遇到「没权限 / 集合没建 / 参数不对」不是 reject，
    而是 **resolve 一个 {code, message}**。传输层从来不查 ——
    权限被拒的 add 看起来像成功、查询像空列表、update 像 updated:0。
    孩子看到「房间已经不在了」「匹配不到」，没人知道其实是云端在拒绝。

    判据：realTransport 里 add/read/patch/remove/list/listOpen 每个都要过 chk()，
    而 chk 必须在 r.code 存在时抛错。
    """
    src = _code_only(_read('hansen_pk_room_v1065.js') or '')
    if not src:
        return
    rt = _fn_body(src, 'realTransport')
    ck = _fn_body(src, 'chk', 600)
    if not rt:
        bad('对战回包查 code', 'hansen_pk_room_v1065.js 里找不到 realTransport')
        return
    if not ck or 'r.code' not in ck or 'throw' not in ck:
        bad('对战回包查 code', 'chk() 没有在 r.code 存在时抛错 —— 云端拒绝会被当成成功')
    n = len(re.findall(r'\bchk\(', rt))
    if n < 6:
        bad('对战回包查 code',
            'realTransport 里只有 %d 处 chk()（add/read/patch/remove/list/listOpen 至少 6 处）—— '
            '漏查的那个操作，权限被拒时会安安静静地「成功」' % n)


def _sdk_ops_outside_call(src):
    """找出不在 call(...) 括号里的 SDK 终端操作（.get() / .count() / .update( …）。"""
    outs = []
    for m in re.finditer(r'\.(get|count|remove)\(\s*\)|\.(update|add|set)\(', src):
        i = m.start()
        # 接收者：往回吃标识符、点、成对括号，看这条链是不是从 collection / doc 来的
        j, depth = i, 0
        while j > 0:
            c = src[j - 1]
            if c == ')':
                depth += 1
            elif c == '(':
                if depth == 0:
                    break
                depth -= 1
            elif depth == 0 and not (c.isalnum() or c in '_.$\n\t '):
                break
            j -= 1
        chain = src[j:i]
        if not re.search(r'collection\(|\bdoc\(|\b(col|ref|base|docRef)\b', chain):
            continue
        if re.search(r'\bT\(\)\s*$', chain):
            continue
        # 往外找包着它的未配对 '('，看是不是 call(
        k, depth, inside = i - 1, 0, False
        while k >= 0:
            c = src[k]
            if c == ')':
                depth += 1
            elif c == '(':
                if depth == 0:
                    if src[max(0, k - 4):k] == 'call':
                        inside = True
                        break
                else:
                    depth -= 1
            k -= 1
        if not inside:
            ln = src.count('\n', 0, i) + 1
            outs.append('%d 行 %s' % (ln, src[i:i + 12].strip()))
    return outs


def guard_board_friends_check_code():
    """排行榜、好友：每个云端操作都要套在会查 code 的 call() 里。

    事故（v1164）：排行榜第一次打开永远显示「没登录」、权限被拒显示成「还没有人上榜」、
    好友永远「云服务未就绪」—— 都是回包里的 {code} 没人看。
    """
    for f in ('hansen_ladder_board_v1156.js', 'hansen_friends_v1106.js'):
        src = _code_only(_read(f) or '')
        if not src:
            continue
        cb = _fn_body(src, 'call', 800)
        if not cb or 'r.code' not in cb or 'throw' not in cb:
            bad('榜单好友查 code', '%s 的 call() 没有在 r.code 存在时抛错 —— 云端拒绝会被当成空结果' % f)
        outs = _sdk_ops_outside_call(src)
        if outs:
            bad('榜单好友查 code',
                '%s 有 %d 处云端操作没有过 call()（%s）—— 权限被拒 / 集合没建时会被当成「成功」或「空」'
                % (f, len(outs), '；'.join(outs[:3])))


def guard_room_no_multi_write():
    """房间、好友代码里不许 where().update() / where().remove()。

    事故（v1164）：客户端的批量写在「修改本人数据」权限下会被整个拒掉，
    而且一次能改到别人的文档 —— 新协议里每个人只改自己建的那一条（按 _id）。
    """
    for f in ('hansen_pk_room_v1065.js', 'hansen_friends_v1106.js'):
        src = _code_only(_read(f) or '')
        if not src:
            continue
        for m in re.finditer(r'\.where\(', src):
            # 跳过 where(...) 的括号，看紧跟着的是不是 .update( / .remove(
            k, depth = m.end(), 1
            while k < len(src) and depth:
                if src[k] == '(':
                    depth += 1
                elif src[k] == ')':
                    depth -= 1
                k += 1
            tail = src[k:k + 40]
            if re.match(r'\s*\.(update|remove)\(', tail):
                ln = src.count('\n', 0, m.start()) + 1
                bad('房间不批量改',
                    '%s 第 %d 行用了 where(...)%s —— 批量写在「修改本人数据」权限下会被拒，'
                    '还可能改到别人的文档；只按 _id 改自己建的那一条' % (f, ln, tail.strip()[:10]))
                break


def guard_room_no_phone():
    """房间文档里不许出现手机号 / 用户名。

    事故（v1164）：hostId / guestId 以前直接用手机号 —— 写进「所有人都能读」的集合，
    等于把孩子家长的手机号公开给每一个打开对战的人。身份键改成 'u' + 云端 uid。
    """
    src = _code_only(_read('hansen_pk_room_v1065.js') or '')
    if not src:
        return
    hit = re.search(r'\.(phone|username|phone_number|pendingPhone)\b', src)
    if hit:
        ln = src.count('\n', 0, hit.start()) + 1
        bad('房间不放手机号',
            'hansen_pk_room_v1065.js 第 %d 行读了 %s —— 房间集合所有人都能读，'
            '手机号 / 用户名不能拿来当身份或名字（用 \'u\' + uid）' % (ln, hit.group(0)))
    if "'u' + uid" not in src and "'u' + String(" not in src:
        bad('房间不放手机号', '房间身份键不是 \'u\' + uid —— 找不到这个写法，身份从哪来的说不清')


def _zindex(src, idexpr):
    m = re.search(re.escape(idexpr) + r"[^{]*\{[^}]*?z-index:\s*(\d+)", src)
    return int(m.group(1)) if m else None


def guard_overlays_above_pk():
    """天梯、好友的界面要盖在「拼写大PK」屏之上、对战屏之下。

    事故（v1164）：岛上点「天梯排位」，天梯页其实开了 —— 但 z-index 2147482000，
    被「拼写大PK」屏（2147483400）整个盖住，孩子看到的是「点了没反应」。
    """
    pk = _zindex(_read('hansen_sb_pk_v1022.js') or '', "'#' + ID + '")
    room = _zindex(_read('hansen_pk_room_ui_v1065.js') or '', "'#' + ID + '")
    if pk is None or room is None:
        bad('天梯好友在大PK之上', '读不出拼写大PK屏 / 对战屏的 z-index（写法变了？守卫要跟着改）')
        return
    for f, label in (('hansen_ladder_ui_v1108.js', '天梯'), ('hansen_friends_ui_v1107.js', '好友')):
        z = _zindex(_read(f) or '', "'#' + ID + '")
        if z is None:
            bad('天梯好友在大PK之上', '%s 界面读不出 z-index' % label)
        elif not (pk < z < room):
            bad('天梯好友在大PK之上',
                '%s 界面 z-index=%d，要在拼写大PK屏（%d）之上、对战屏（%d）之下 —— '
                '否则从岛上点进去会被大PK屏盖住，看起来就是「点了没反应」' % (label, z, pk, room))


def guard_session_has_timeout():
    """ensureSession 整个调用要有总时限。

    事故（v1164）：SDK 刷新令牌的请求没有超时 —— 网卡住时 ensureSession 永远不返回，
    天梯一直转圈「正在连接云端…」，连「连不上网络」都说不出来。
    """
    src = _code_only(_read('hansen_auth_v1004.js') or '')
    if not src:
        return
    body = _fn_body(src, 'ensureSessionOnce', 9000) or _fn_body(src, 'ensureSession', 9000)
    if 'SESSION_TIMEOUT_MS' not in body or 'timeoutAfter(' not in body:
        bad('会话总超时', 'ensureSession 没有整体时限（SESSION_TIMEOUT_MS + timeoutAfter）—— 网卡住时会永远转圈')
    m = re.search(r'SESSION_TIMEOUT_MS\s*=\s*(\d+)', src)
    if not m or not (3000 <= int(m.group(1)) <= 15000):
        bad('会话总超时', 'SESSION_TIMEOUT_MS 没定义或不在 3~15 秒之间（%s）' % (m.group(1) if m else '无'))


def guard_no_marker_without_creds():
    """没拿到云端凭证，不许写「已登录」。

    事故（v1164）：用户名「注册」其实只让 SDK 往一个内部邮箱发验证码，从没建出账号，
    却照样写下「已登录」→ 界面说登录了，云端永远「会话尚未就绪」，天梯永远进不去。
    用户名登录也一样从不查凭证。
    """
    src = _code_only(_read('hansen_auth_v1004.js') or '')
    if not src:
        return
    reg = _fn_body(src, 'registerByPassword', 3000)
    if reg and ('writeLocal(' in reg or re.search(r'\.signUp\w*\(', reg)):
        bad('没凭证不写登录',
            'registerByPassword 又在调 SDK 注册 / 写本地登录记录 —— '
            'SDK 不能建用户名账号，写了「已登录」就是假的')
    lg = _fn_body(src, 'loginByPassword', 4000)
    if lg:
        w = lg.find('writeLocal(')
        c = lg.find('credentialsCheck(')
        if w >= 0 and (c < 0 or c > w):
            bad('没凭证不写登录', 'loginByPassword 写「已登录」之前没有 credentialsCheck —— 云端没给凭证也会说登录成功')


def guard_join_waits_for_host():
    """进房要等房主确认，房主确认后也要等客人回话。

    事故（v1164）：客人只能写自己的座位，进没进房要由房主在自己的房间文档里点头。
    真 SDK 端到端还抓到：房主读到的座位是旧快照（客人其实已经点了返回），
    写了确认就开打 → 房主跟空气打、房间再也开不了门。
    判据：joinRoom 走 waitAck；客人看到确认后写 acked；房主确认后有「等回话 / 撤回」那一步。
    """
    src = _code_only(_read('hansen_pk_room_v1065.js') or '')
    if not src:
        return
    jr = _fn_body(src, 'joinRoom', 9000)
    if 'waitAck(' not in jr:
        bad('进房要等确认', 'joinRoom 抢到座位后没有等房主确认（waitAck）—— 房主还不知道你来了你就进了对战屏')
    wa = _fn_body(src, 'waitAck', 5000)
    if 'acked' not in wa:
        bad('进房要等确认', '客人看到房主确认后没有在自己的座位上回话（acked）—— 房主分不清座位是不是旧快照')
    wf = _fn_body(src, 'waitForOpponent', 16000)
    if 'function unack' not in wf or 'function confirm' not in wf:
        bad('进房要等确认', '房主写了确认之后没有「等客人回话、不回就撤回」那一步 —— 会跟已经走了的人开打')
    elif re.search(r'if\s*\(\s*R\.guestId\s*\)\s*\{\s*joined\(', wf):
        bad('进房要等确认', '房主读到房间里有客人就直接开打 —— 要先等客人回话（confirm）')


def guard_watchdog_not_false_alarm():
    """看门狗只在真正开始匹配时上哨；关界面不许上哨，救援的出口不许再上哨。

    事故（v1164）：天梯 close() 里上哨 —— 点 × 关掉天梯、或打开好友页（它会先关天梯），
    6 秒后都冒出「这一步没能打开」；救援屏的「回到大PK首页」又调 close() 再上哨，没完没了。
    """
    ld = _code_only(_read('hansen_ladder_ui_v1108.js') or '')
    if ld:
        cl = _fn_body(ld, 'close', 2000)
        if 'HansenPkWatchdog.arm' in cl:
            bad('看门狗不乱咬', '天梯 close() 里上了哨 —— 关掉天梯 6 秒后会冒出假的「这一步没能打开」')
        sm = _fn_body(ld, 'startMatching', 4000)
        if 'HansenPkWatchdog.arm' not in sm:
            bad('看门狗不乱咬', '天梯开始匹配时没上哨 —— 真卡住了也没人救')
    fr = _code_only(_read('hansen_friends_ui_v1107.js') or '')
    if fr:
        cp = _fn_body(fr, 'closePeers', 1500)
        if 'disarm' not in cp:
            bad('看门狗不乱咬', '好友页关掉别的界面后没撤哨 —— 打开好友页会冒出假的救援屏')
    wd = _code_only(_read('hansen_pk_watchdog_v1155.js') or '')
    if wd:
        m = re.search(r'var quit = function \(\) \{([\s\S]*?)\n      \};', wd)
        qb = m.group(1) if m else ''
        last_close = qb.rfind('.close()')
        if not m or last_close < 0 or '_armed = null' not in qb[last_close:]:
            bad('看门狗不乱咬', '救援屏的出口（quit）关完界面后没有再清一次哨 —— 哪个 close() 顺手上了哨，就会救了又救，没完没了')


def guard_ladder_routes_by_kind():
    """天梯失败要按 kind 分流，不许猜 reason 里的字；岛上的天梯入口要和公开房间同一道门。

    事故（v1164）：「云端会话尚未就绪」里有「会话」两个字，被 /登录|会话/ 当成没登录，
    已经登录的孩子被一次次推去「排位要先登录」。岛上的「天梯排位」又不查登录，进去一片空白。
    """
    ld = _code_only(_read('hansen_ladder_ui_v1108.js') or '')
    if ld:
        if 'kindOf(' not in ld:
            bad('排位按种类分流', '天梯界面没有按 kind（kindOf）分流失败')
        hit = re.search(r'/[^/\n]*(登录\|会话|会话\|登录)[^/\n]*/[gimy]*\.test\(', ld)
        if hit:
            bad('排位按种类分流', '天梯界面还在用正则猜 reason（%s）—— 「会话尚未就绪」会被当成没登录' % hit.group(0)[:30])
        if not re.search(r'\.sort\(\s*function\s*\(a,\s*b\)\s*\{[^}]*createdAt', ld):
            bad('排位按种类分流', '天梯候选房没有按 createdAt 先开先配 —— 等得最久的人永远轮不到')
    pk = _code_only(_read('hansen_sb_pk_v1022.js') or '')
    if pk:
        m = re.search(r'var openLadder = function \(\) \{([\s\S]*?)\};', pk)
        if not m or 'needOnline()' not in m.group(1):
            bad('排位按种类分流', '岛上的「天梯排位」入口没有过 needOnline()（云端 + 登录）那道门')


def guard_pk_words_typeable():
    """对战抽的词必须是键盘打得出来的。

    事故（v1164，真 SDK 端到端抓到）：对战键盘只有 26 个字母，
    ice cream / T-shirt / fire station 这种词抽到就只能白白超时 —— 约五分之一的对局会碰上。
    """
    src = _code_only(_read('hansen_pk_room_v1065.js') or '')
    if not src:
        return
    body = _fn_body(src, 'wordsFromSeed', 3000)
    if '/^[a-zA-Z]+$/' not in body:
        bad('对战键盘打得出', 'wordsFromSeed 没有只挑纯字母的词 —— 带空格 / 连字符的词在对战键盘上打不出来')


def guard_waitall_no_force_skip():
    """同步赛 / 回合赛：对手先拼对，不许把我也强行翻到下一词；我答完了要等对手。

    事故（v1164）：对手一拼对就把慢的孩子推走，「后拼对 60 / 80 分」从来没兑现；
    反过来各翻各的，快的那位先跑去下一词，下一词的「抢先」就成了谁领先谁拿。
    """
    src = _code_only(_read('hansen_pk_room_ui_v1065.js') or '')
    if not src:
        return
    po = _fn_body(src, 'pollOpponent', 16000)
    for m in re.finditer(r'submitRound\(\s*idx\s*,\s*false\s*,\s*true\s*\)', po):
        line_start = po.rfind('\n', 0, m.start())
        line = po[line_start:m.end()]
        if '!M.waitAll' not in line:
            bad('同步赛不强翻', '对手先拼对时强行翻篇没有限定在抢答赛（!M.waitAll）—— 同步赛 / 回合赛慢的一方永远拿不到分')
            break
    nw = _fn_body(src, 'nextWord', 4000)
    if not nw or 'oppAns' not in nw:
        bad('同步赛不强翻', '同步赛 / 回合赛答完一词后没有等对手（nextWord / oppAns）—— 快的那位会先跑去下一词')


def guard_backup_skips_sdk_keys():
    """完整备份不许收 SDK 自己的键（user_info / lang / device_id / x-tcb / 环境号）。

    事故（v1164）：备份把 SDK 的 user_info_<env> 也存了，恢复到另一台设备 / 另一个账号上，
    SDK 读到的是别人的 uid 缓存 —— 对战身份错乱，查起来极难。
    """
    for f in ('hansen_backup_v944.js', 'hansen_backup_bootstrap_v944.js'):
        src = _code_only(_read(f) or '')
        if not src:
            continue
        if 'function sdkKey' not in src:
            bad('备份不收 SDK 键', '%s 没有 sdkKey() —— 分不出哪些键是 SDK 自己的' % f)
            continue
        m = re.search(r'SDK_KEY_RE\s*=\s*(/.*?/[gimy]*)\s*;', src)
        pat = m.group(1) if m else ''
        for need in ('user_info', 'lang', 'device_id', 'credentials', 'tcb'):
            if need not in pat:
                bad('备份不收 SDK 键', '%s 的 SDK_KEY_RE 没盖住 %s' % (f, need))
    bk = _code_only(_read('hansen_backup_v944.js') or '')
    if bk and 'sdkKey(' not in _fn_body(bk, 'credentialKey', 1500):
        bad('备份不收 SDK 键', 'hansen_backup_v944.js 的 credentialKey() 没有调 sdkKey() —— SDK 的键会被当成普通数据备份')


def guard_cloud_tests_no_stubs():
    """真 SDK 端到端测试里不许出现测试钩子。

    事故（v1164）：以前所有对战测试都换了假传输层 / 假身份 —— 假的什么都让写，
    测试一直绿、真机上天梯从来没成功过一次。*_cloud_*_v1164 这批测试只许模拟网络。
    """
    hooks = ('_setTransportForTest', '_setMeForTest', '_setDbForTest', '_setTimingForTest',
             '__hsnLadderWaitSec', '_setWaitMsForTest', '_setAuthForTest', '_setCloudForTest')
    files = sorted(glob.glob(os.path.join(ROOT, 'test_*cloud*_v1164.mjs')))
    if not files:
        bad('真 SDK 测试无桩', '找不到 test_*cloud*_v1164.mjs —— 真 SDK 端到端测试不见了')
        return
    for p in files + [os.path.join(ROOT, 'cloudbase_e2e_harness.mjs')]:
        src = _code_only(_read(os.path.basename(p)) or '')
        for h in hooks:
            if h in src:
                bad('真 SDK 测试无桩', '%s 用了测试钩子 %s —— 真 SDK 测试只许模拟网络' % (os.path.basename(p), h))
                break


def guard_friendly_tells_truth():
    """「云端没给凭证」不许翻成「用户名不存在 / 密码不对」。

    事故（v1164，真 SDK 端到端抓到）：登录响应缺 expires_in 时 SDK 报 credentials not found，
    friendly() 把它翻成「没找到这个用户名」—— 账号密码明明都对，孩子会去改一个没错的东西。
    """
    src = _code_only(_read('hansen_auth_v1004.js') or '')
    if not src:
        return
    fb = _fn_body(src, 'friendly', 4000)
    c = fb.find('credentials not found')
    u = fb.find('没找到这个用户名')
    if c < 0 or (u >= 0 and c > u):
        bad('friendly 说实话', 'friendly() 没有在「用户名不存在」之前单独处理 credentials not found —— 会把「登录没完成」说成「用户名不对」')
