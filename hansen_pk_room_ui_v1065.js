/* hansen_pk_room_ui_v1065.js —— 在线对战「公开房间」界面
 *
 * 配合 hansen_pk_room_v1065.js（房间服务）使用。
 * 三个屏：房间列表 → 等待对手 → 对战 → 结算。
 *
 * 界面上的两条原则：
 *  ① 任何失败都必须给出**人话**和**下一步**。
 *     本项目吃过大亏：云端报错一律显示成 `[object Object]`，
 *     整整 40 个版本没人知道真正发生了什么。
 *     所以这里所有错误都经 HBErrText，会话过期还直接给「重新登录」按钮。
 *  ② 房间是有主的。开房的人一走，房就得消失，不留幽灵房；
 *     客人中途退出，房要能回到可加入状态让房主继续等。
 */
(function () {
  'use strict';
  if (window.HansenPkRoomUI) return;

  var ID = 'hsn_pkroom_screen';
  var _cancelWait = null;
  var _state = null;      /* { roomId, words, isHost, idx, correct, startAt } */

  function E(e) {
    /* v1164：数据层的失败结果自带 `人话 ⟨原话⟩`，直接用 ——
       交给 HBErrText 会把 code 拼到人话前面（「DATABASE_… | 云端设置…」），人话就脏了 */
    if (e && typeof e === 'object' && e.ok === false && typeof e.reason === 'string') return e.reason;
    try { if (window.HBErrText) return window.HBErrText(e); } catch (_) {}
    return (e && (e.reason || e.message)) ? String(e.reason || e.message) : String(e || '');
  }
  /* v1164：失败的种类（network/slow/session/expired/config/gone/taken/self/other）——
     界面按种类分流，不再按字面猜「有没有登录两个字」 */
  function kindOf(r) {
    try {
      if (r && typeof r.kind === 'string' && r.kind) return r.kind;
      if (S() && S().kindOf) return S().kindOf(r);
    } catch (e) {}
    return 'other';
  }
  function rawOf(t) {
    var m = /⟨([^⟩]+)⟩/.exec(String(t || ''));
    return m ? m[1] : '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function S() { return window.HansenPkRoom; }
  function q(id) { return document.getElementById(id); }

  function style() {
    if (q('hsn_pkroom_css')) return;
    var s = document.createElement('style');
    s.id = 'hsn_pkroom_css';
    s.textContent =
      /* 🔴v1110 亮色/暗色：与好友页、天梯页用同一组变量。
         全站选亮色系时 <html> 会加 hsn-pal-light —— 这里整组换掉，
         而不是给每个元素单独写覆盖（那会越堆越乱）。 */
      'html:root{--pk-bg:#0f172a;--pk-card:#111827;--pk-line:#1f2937;' +
        '--pk-txt:#e8eefc;--pk-dim:#a9b4c7;--pk-faint:#7c879b;' +
        /* 🔴v1156 语义色 —— 别在代码里写死颜色：
           换主题时写死的那几个会突兀地留在原地。 */
        '--pk-good:#4ade80;--pk-warn:#fb923c;--pk-bad:#f87171;' +
        /* v1156: 升段提示用的强调紫 —— 别写死在代码里 */
        '--pk-accent:#c4b5fd;--pk-chip:#3730a3;--pk-chip-txt:#e8eefc;' +
        '--pk-in-bg:#0b1020;--pk-in-line:#334155;--pk-btn2:#1f2937;' +
        '--pk-ok:#34d399;--pk-bad:#f87171;--pk-warn:#fbbf24;--pk-hint:#93c5fd;' +
        '--pk-kb-bg:#1e293b;--pk-key-bg:#334155;--pk-key-fg:#f1f5f9;' +
        '--pk-key-act:#475569;--pk-key-alt:#1e293b}' +
      'html.hsn-pal-light:root, html.hsn-pal-light{--pk-bg:#f4f6fb;--pk-card:#ffffff;--pk-line:#e3e7ee;' +
        '--pk-txt:#0f172a;--pk-dim:#4b5563;--pk-faint:#6b7280;' +
        '--pk-in-bg:#f9fafb;--pk-in-line:#cbd5e1;--pk-btn2:#eef1f6;' +
        '--pk-ok:#047857;--pk-bad:#b91c1c;--pk-warn:#b45309;--pk-hint:#1d4ed8;' +
        '--pk-kb-bg:#d1d5db;--pk-key-bg:#ffffff;--pk-key-fg:#111827;' +
        '--pk-key-act:#e5e7eb;--pk-key-alt:#aeb3bd}' +
      '#' + ID + '{position:fixed;inset:0;z-index:2147483600;background:var(--pk-bg);color:var(--pk-txt);'
      + 'overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;font-family:system-ui,-apple-system,sans-serif}'
      /* 🔴v1118 内置键盘样式 —— 与拼写蜂同一手感，颜色跟主题走 */
      + 'html .pr_kb{margin-top:14px;padding:8px 4px 10px;background:var(--pk-kb-bg);'
      +   'border-radius:12px;user-select:none;-webkit-user-select:none}'
      /* 🔴v1119：**小屏上键不能太窄**。
         实测 320px 老手机上最窄的键只有 24px —— 手指点不准，
         而苹果/谷歌的可点击标准都是 44px（我 v1112 刚为关闭按钮改过这个）。
         原因：`gap:5px` + `.pr_indent` 左右各留 16px，
         10 个键要挤进 320-32-45=243px。

         改法：小屏下收紧间距与缩进、去掉 max-width 让键自然占满，
         并给 min-width 兜底。**宁可键盘略宽，也不能点不准** ——
         抢答时点错一个字母就输了。 */
      + 'html .pr_kbrow{display:flex;gap:4px;justify-content:center;margin-bottom:6px}'
      + 'html .pr_kbrow.pr_indent{padding:0 14px}'
      + '@media (max-width:360px){'
      +   'html .pr_kbrow{gap:3px}'
      +   'html .pr_kbrow.pr_indent{padding:0 8px}'
      +   'html .pr_key{max-width:none!important;font-size:17px}'
      +   'html .pr_kb{padding:8px 2px 10px}'
      + '}'
      + 'html .pr_key{flex:1 1 0;min-width:27px;max-width:38px;height:46px;border:0;border-radius:6px;'
      +   'background:var(--pk-key-bg);color:var(--pk-key-fg)!important;font-size:19px;'
      +   'font-weight:600;cursor:pointer;box-shadow:0 1px 0 rgba(0,0,0,.25)}'
      + 'html .pr_key:active{transform:scale(.94);background:var(--pk-key-act)}'
      + 'html .pr_key.pr_del{flex:0 0 auto;max-width:none;width:56px;'
      +   'background:var(--pk-key-alt);font-size:20px}'
      + '#' + ID + '.on{display:block}'
      + '#' + ID + ' .pr_wrap{max-width:520px;margin:0 auto;padding:14px 14px 40px}'
      + '#' + ID + ' .pr_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}'
      + '#' + ID + ' .pr_back{background:#1e293b;border:1px solid var(--pk-in-line);color:var(--pk-txt);border-radius:10px;'
      + 'padding:11px 14px;min-height:44px;font-size:15px;cursor:pointer}'
      + '#' + ID + ' .pr_h{font-size:19px;font-weight:700}'
      + '#' + ID + ' .pr_btn{width:100%;border:0;border-radius:14px;padding:14px;font-size:16px;font-weight:700;'
      + 'color:#fff;background:linear-gradient(135deg,#4f46e5,#6366f1);cursor:pointer;margin-bottom:12px}'
      + '#' + ID + ' .pr_btn2{background:transparent;border:1px solid rgba(255,255,255,.22);color:var(--pk-dim);font-weight:600}/* v1156: 次要动作不该比主要动作更亮 —— 原来是亮蓝渐变，比「再来一局」还抢眼，用户一眼先看到的是「离开」而不是「再玩一局」 */'
      + '#' + ID + ' .pr_room{display:flex;align-items:center;gap:10px;background:#1e293b;border:1px solid var(--pk-in-line);'
      + 'border-radius:12px;padding:12px;margin-bottom:10px}'
      + '#' + ID + ' .pr_room .n{flex:1;min-width:0}'
      + '#' + ID + ' .pr_room .n b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#' + ID + ' .pr_room .n span{font-size:12px;color:var(--pk-dim)}'
      + '#' + ID + ' .pr_room button{background:#4f46e5;border:0;color:#fff;border-radius:10px;'
      /* 🔴v1156：**触控目标要够 44px。**
         实测「进去打」只有 74x38 —— 苹果和谷歌都建议触控目标至少 44x44。
         小按钮在手机上最容易点偏，尤其孩子的手指定位没那么准，
         而这个按钮点偏了就是"点了没反应"。 */
      + 'padding:12px 16px;min-height:44px;'
      + 'font-size:14px;font-weight:700;cursor:pointer}'
      + '#' + ID + ' .pr_empty{color:var(--pk-dim);text-align:center;padding:26px 10px;font-size:14px;line-height:1.7}'
      + '#' + ID + ' .pr_err{background:#7f1d1d;border:1px solid #b91c1c;color:#fecaca;border-radius:12px;'
      + 'padding:12px;font-size:14px;line-height:1.6;margin-bottom:12px;word-break:break-all}'
      + '#' + ID + ' .pr_word{font-size:34px;font-weight:800;text-align:center;letter-spacing:2px;margin:22px 0 18px}'
      + '#' + ID + ' .pr_cn{text-align:center;color:var(--pk-dim);margin-bottom:18px}'
      + '#' + ID + ' .pr_in{width:100%;box-sizing:border-box;padding:14px;font-size:19px;border-radius:12px;'
      + 'border:2px solid var(--pk-in-line);background:#0b1220;color:var(--pk-txt);text-align:center;letter-spacing:2px}'
      + '#' + ID + ' .pr_pg{text-align:center;color:var(--pk-dim);font-size:13px;margin-top:12px}'
      + '#' + ID + ' .pr_res{text-align:center;font-size:26px;font-weight:800;margin:26px 0 10px}';
    document.head.appendChild(s);
  }

  function host() {
    var el = q(ID);
    if (el) return el;
    style();
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '公开房间');
    document.body.appendChild(el);
    return el;
  }

  function paint(inner) {
    var el = host();
    el.innerHTML = '<div class="pr_wrap">' + inner + '</div>';
    el.classList.add('on');
  }

  function close() {
    stopKb();
    stopPoll();
    _lobbySeq++;
    /* 🔴审查 R2-UI-1 / T1：正在开房时离开（返回键、关掉、回首页）—— 开房那一下回来时不许再画「等对手进来」，
       开出来的房也要马上收掉（以前藏起来的岛里照样开了一间房、发着心跳，别的孩子被配进来跟空气打） */
    cancelCreating();
    hideQuit();
    /* v1163: 等待屏的「已等 N 秒」计时器 —— 离开这屏必须停掉。
       不停的话它会一直每秒查一次 DOM，
       而且下次进等待屏会有两个计时器同时刷同一个元素。 */
    try {
      if (_state && _state._waitTimer) {
        clearInterval(_state._waitTimer);
        _state._waitTimer = null;
      }
    } catch (e) {}
    stopTicker();
    if (_cancelWait) { try { _cancelWait(); } catch (e) {} _cancelWait = null; }
    /* v1164：正在等房主确认的那次进房也要撤掉（数据层会收回座位） */
    cancelJoin();
    try { if (S()) S().stopHeartbeat(); } catch (e) {}
    if (_state && _state.roomId) { try { S().leaveRoom(_state.roomId); } catch (e) {} }
    _state = null;
    /* v1164：天梯带进来的那些「这一次」的设定，关掉就清，别带到下一次 */
    _fromLadder = false; _ladderCfg = null; _pickedMode = 'C'; _wantPrivate = false;
    /* 自己关的不用救：开排位房时上的哨，看门狗还没看到屏幕就被关掉了，6 秒后会误报「没能打开」 */
    try { if (window.HansenPkWatchdog && HansenPkWatchdog.disarm) HansenPkWatchdog.disarm(); } catch (e) {}
    var el = q(ID);
    if (el) { el.classList.remove('on'); el.innerHTML = ''; }
  }

  /* v1164：排位那边要接着找对手时，只把这一层收起来（这一次没进成房，没有东西要退） */
  function hideShell() {
    stopTicker();
    var el = q(ID);
    if (el) { el.classList.remove('on'); el.innerHTML = ''; }
  }

  /* 「已等 N 秒」这类每秒跳一次的小计时器 —— 同一时刻只留一个 */
  var _ticker = null;
  function startTicker(id, t0, fmt) {
    stopTicker();
    _ticker = setInterval(function () {
      var el = q(id);
      if (!el) { stopTicker(); return; }
      el.textContent = fmt(Math.round((Date.now() - t0) / 1000));
    }, 1000);
  }
  function stopTicker() { if (_ticker) { clearInterval(_ticker); _ticker = null; } }

  /* 进房要等房主确认（最多 15 秒）—— 这段时间里随时能取消 */
  var _joinSeq = 0, _joiningRid = '';
  function cancelJoin() {
    _joinSeq++;
    var rid = _joiningRid;
    _joiningRid = '';
    if (rid) { try { S().leaveRoom(rid); } catch (e) {} }
  }

  /* 「重新登录」：直接打开登录表单（审查 R2-UI-7：以前打开的是「👤 已登录」面板，没有表单，孩子卡死在那儿）；
     旧版本用户名注册的账号（R2-5）：云端从来没有这个账号，去手机号注册那一页 */
  function openRelogin(legacy) {
    try {
      if (!window.HansenAuthUI) return;
      var A = window.HansenAuth, signed = !!(A && A.isSignedIn && A.isSignedIn());
      HansenAuthUI.open(legacy ? { mode: 'phone', relogin: true, legacy: true } : (signed ? { relogin: true } : undefined));
    } catch (e) {}
  }

  /* 错误块：会话过期时给出「重新登录」这条出路，而不是让人干瞪眼 */
  /* 🔴v1156：**技术错误不能原样印给孩子看。**

     实测四种真实的云端错误，全部原样出现在屏幕上：

       [ResourceUnauthorized] permission denied for collection sb_profile
       net::ERR_CONNECTION_TIMED_OUT
       [QuotaExceeded] daily read limit reached: 50000/50000
       Cannot read properties of undefined (reading 'collection')

     孩子看到这些**完全不知道发生了什么**，
     也不知道该怎么办 —— 只会觉得"坏了"然后关掉。

     > **错误提示要回答两件事：出了什么事、我能做什么。**
     > 原始错误信息一件都答不了。

     翻译成人话，并且尽量给一个能做的动作。
     实在认不出的，说"出了点问题"总比说一串英文强 ——
     而原文仍然会进悄悄报错观察者，排查时查得到。 */
  function sayHuman(raw) {
    var t = String(raw || '');
    /* v1163: E() 现在返回 `人话 ⟨原话⟩`。
       给用户看的只要人话那半截，原话进 console 供排查。 */
    var _m = /^([^⟨]*)⟨([^⟩]*)⟩\s*$/.exec(t);
    if (_m) {
      try { console.warn('[对战] 原始错误：' + _m[2]); } catch (e) {}
      var _h = _m[1].trim();
      if (_h) return _h;
      t = _m[2];
    }
    if (!t) return '出了点问题，再试一次吧';
    /* 🔴v1164：**本来就是写给人看的中文句子，原样给人看。**
       数据层没有原话时只给人话（「房主没有回应，换一间吧」），
       界面自己的提示也是（「等了两分钟还没人来，房间先关掉了」）——
       原来它们全被下面这串规则兜成「出了点问题，再试一次吧」，信息丢光了。 */
    var _plain = t.replace(/「[^」]*」/g, '');      /* 「hansen_pk_rooms」这种是写给老师看的名字 */
    if (/[一-龥]/.test(_plain) && !/[A-Za-z_]{4,}|\{|\[/.test(_plain)) return t;
    if (/没人来|暂时没有对手|房间先关掉/.test(t)) return t;
    /* ⚠️ 原文不能丢 —— 翻译是给用户看的，排查时要的是原话。
       走 console.warn：真机上连电脑调试时看得到，
       而且不会像 console.error 那样被当成新故障统计。
       （第一版写的是 HansenSilentWatch.note()，
         而那个模块只导出了 recent —— 又一次凭印象调接口。） */
    try { console.warn('[对战] 原始错误：' + t.slice(0, 160)); } catch (e) {}
    if (/unauthorized|permission|denied|unauthenticated|credential|登录/i.test(t)) {
      return '云端登录过期了，重新登录一次就能继续';
    }
    if (/timed?[_ ]?out|ERR_|network|offline|failed to fetch|断网/i.test(t)) {
      return '网络好像不太顺，检查一下再试试';
    }
    if (/quota|limit|too many|rate/i.test(t)) {
      return '现在用的人有点多，等一小会儿再试';
    }
    if (/undefined|null|not a function|properties of/i.test(t)) {
      return '有个部件没加载好，刷新一下页面就好了';
    }
    if (/not found|不存在|已经不在/i.test(t)) {
      return '这个房间已经不在了，回列表再挑一间吧';
    }
    /* v1163: 词库没加载好 —— 这条要原样透出去，
       因为它已经写成人话了，而且带着"刷新一下页面"这个能做的动作。
       被 sayHuman 兜成"出了点问题"反而丢了信息。 */
    if (/词库/.test(t)) return t;
    return '出了点问题，再试一次吧';
  }

  function errBlock(r) {
    var t = E(r);
    var k = (r && r.kind) ? r.kind : '';
    /* v1164：有 kind 就按 kind 判；老的 {reason} 才退回按字面猜 */
    var expired = !!(r && r.expired) || k === 'expired'
                  || (!k && /过期|unauthenticated|credentials|登录/i.test(t));
    var human = sayHuman(t);
    /* 断网 / 云端设置 / 说不清的问题：把原话小字放出来，截个图就知道是哪一类（v1156 教训） */
    var raw = rawOf(t);
    /* 🔴审查 R2-UI-13：从没登录过的孩子不是「登录过期」—— 按钮叫「去登录」，也不放一行看不懂的 not-signed-in */
    var never = expired && /not-signed-in|还没登录/.test(t);
    var legacy = !!(r && r.legacy);
    var tech = (raw && k && k !== 'taken' && k !== 'gone' && k !== 'self' && !never && !legacy)
      ? '<div style="margin-top:8px;font-size:11px;opacity:.75;word-break:break-all">技术信息：'
        + esc(raw.slice(0, 130)) + '</div>'
      : '';
    var tip = (k === 'config' && !(r && r.dbblocked)) ? '<br>这不是你的问题，把这一屏截图发给负责的老师就好。' : '';
    var btn = !expired ? ''
      : legacy ? '<button class="pr_btn pr_btn2" id="prLogin" data-legacy="1">📱 用手机号注册</button>'
      : never ? '<button class="pr_btn pr_btn2" id="prLogin">🔐 去登录</button>'
      : '<button class="pr_btn pr_btn2" id="prLogin">🔑 重新登录</button>';
    return '<div class="pr_err">' + esc(human) + tip
      + ((expired && !never && !legacy && !/登录/.test(human)) ? '<br><br>云端登录已过期，重新登录一次就能继续。' : '')
      + tech + '</div>' + btn;
  }
  function wireErr() {
    var b = q('prLogin');
    if (b) b.onclick = function () { openRelogin(b.getAttribute('data-legacy') === '1'); };
  }

  /* ── 屏 1：房间列表 ── */
  /* v1156: 房主水平怎么显示 —— 先看段位名，再看分数，都没有才说未定级 */
  /* v1156: 玩法徽章 —— 用模式表里的 emoji + 名字，和对战屏一致 */
  /* 🔴v1163（压力测试抓到）：**房间关掉后轮询回调还在跑，st 已经是 null。**

     实测报错：`Cannot read properties of null (reading 'mode')`
     场景：客人中途退出 / 房主关房时，`_state` 被清空，
     而正在飞的那次轮询回调还会读 `st.mode`。

     单次报错不影响这一局（回调本来就该结束了），
     但**错误会进"悄悄报错观察者"，把真问题淹掉** ——
     而且下一版有人顺着这个错去查，会浪费一轮。

     > 拿到的东西可能已经过期了 —— 异步回调里的每一个引用都要当"可能没了"来写。

     三处 `modeOf(st.mode)` 统一改成 `modeOf(st && st.mode)`。 */
  function modeBadge(m) {
    try {
      var MODES = (S() && S().MODES) || {};
      var d = MODES[m || 'A'];
      if (!d) return '';
      /* 🔴v1156：**房间列表这个徽章也要够对比度。**
         对战屏那个改了，这个漏了 —— 实测 2.1（需 4.5）。
         **同一种视觉元素出现在两处，改一处很容易漏另一处。**
         这次是自动化的对比度测试当场抓到的。 */
      return '<span style="display:inline-block;background:var(--pk-chip);'
        + 'color:var(--pk-chip-txt);'
        + 'padding:1px 7px;border-radius:99px;margin-right:6px;font-size:11.5px">'
        + esc(d.emoji || '') + esc(d.name || '') + '</span>';
    } catch (e) { return ''; }
  }

  function tierText(x) {
    try {
      if (x && x.hostTier) return x.hostTier;
      var r = Number(x && x.hostRating);
      if (isFinite(r) && r > 0) {
        var L = window.HansenSbLadder;
        if (L && L.tierOf) {
          var t = L.tierOf(r);
          if (t && t.name) return (t.icon || '') + ' ' + t.name + ' · ' + Math.round(r) + ' 分';
        }
        return Math.round(r) + ' 分';
      }
    } catch (e) {}
    return '未定级';
  }

  /* 🔴v1164（审查 F8）：列表每 8 秒自己刷一次 —— 房主手机钟慢的话，要多看一眼「心跳在动」才认得出他的房活着；
     页面切到后台就不刷（省配额），离开列表这一屏就停 */
  var _lobbySeq = 0;
  var _lobbyErrKind = '';   /* 顶上已经画了哪一种错误（列表那块就不再画一遍同样的 —— 审查 R2-UI-13） */
  var _rowOrder = [];       /* 列表里房间的显示顺序：自动刷新时已有的房不挪位置（审查 FX-9） */
  var _listTouchAt = 0;     /* 孩子手指刚碰过列表：先别刷（防止正要点的那一行被挤走） */
  function lobby(err) {
    /* v1164：到了房间列表就是自由房这条路了 —— 天梯带来的设定清掉，别串到下一局 */
    _fromLadder = false; _ladderCfg = null; _cameFromLadder = false;
    stopTicker();
    cancelCreating();
    var seq = ++_lobbySeq;
    _rowOrder = [];
    /* 点事件对象不是错误（v1156 教训：onclick = lobby 会把事件当 err 画出来） */
    if (err && typeof err === 'object' && 'isTrusted' in err && !('reason' in err)) err = null;
    _lobbyErrKind = err ? (kindOf(err) || 'other') : '';
    paint(
      '<div class="pr_top"><button class="pr_back" id="prBack">← 返回</button>'
      + '<div class="pr_h">🏠 大PK · 公开房间</div></div>'
      + (err ? errBlock(err) : '')
      /* 🔴v1105 邀请朋友：房间码。
         没做「加好友」那一套（列表/申请/通过）—— 对现在的用户量太重，
         而且解决不了核心问题：你想跟谁打通常是身边的人，
         微信发一句话比在 App 里加好友快得多。 */
      /* 🔴v1156：**这一屏原来的顺序反了。**

         改前从上到下是：
           输入房间码 + 进房
           开一间公开房（整行）
           开私密房（整行）
           刷新房间列表（整行）
           ── 房间列表 ──   ← 挤到半屏以下

         而绝大多数人点进这一屏是来**找房打**的，
         输房间码是少数人（约好了的）才做的事。
         最主要的内容（有谁在等着打）被三行按钮压到了下面。

         > 一屏的顺序应该按"多少人要用"排，不是按"实现的先后"排。

         改后：
           [➕ 开一间] [🔒 私密] [🔄 刷新]   ← 一行三个，紧凑
           ── 房间列表 ──                    ← 直接可见
           有朋友的房间码？（折叠）           ← 需要的人自己点开 */
      + '<div style="display:flex;gap:8px;margin:10px 0">'
      +   '<button class="pr_btn" id="prNew" style="flex:1;margin:0;font-size:14px;'
      +     'padding:11px 6px">➕ 开一间</button>'
      +   '<button class="pr_btn pr_btn2" id="prPriv" style="flex:1;margin:0;font-size:14px;'
      +     'padding:11px 6px">🔒 私密房</button>'
      +   '<button class="pr_btn pr_btn2" id="prRef" style="flex:0 0 82px;margin:0;'
      +     'font-size:14px;padding:11px 6px">🔄 刷新</button>'
      + '</div>'

      + '<div id="prList"><div class="pr_empty">正在找房间…</div></div>'

      /* 房间码收到最下面：约好了的人自己点开，不占首屏。
         v1105 当初把它放在最上是因为"邀请朋友"是新功能想让人看见 ——
         但新功能不等于高频功能。 */
      + '<details style="margin-top:16px">'
      +   '<summary style="cursor:pointer;color:var(--pk-dim);font-size:13.5px;'
      +     'padding:8px 2px;list-style:none">🔑 有朋友给的房间码？点这里输入</summary>'
      +   '<div style="display:flex;gap:8px;margin:8px 0 0">'
      +     '<input id="prCode" maxlength="4" placeholder="四位房间码"'
      +       ' aria-label="输入好友给你的四位房间码"'
      +       ' autocapitalize="characters" autocomplete="off"'
      +       ' style="flex:1;min-width:0;text-align:center;letter-spacing:6px;font-size:20px;'
      +       'text-transform:uppercase;background:var(--pk-card);border:1px solid var(--pk-in-line);'
      +       'border-radius:12px;color:var(--pk-txt);padding:10px">'
      +     '<button class="pr_btn" id="prJoinCode" style="flex:0 0 92px;margin:0">进房</button>'
      +   '</div>'
      + '</details>');
    wireErr();
    if (q('prBack')) q('prBack').onclick = close;
    /* v1100：先选玩法再开房 —— 三种规则差别很大，不能默默替房主决定 */
    if (q('prNew')) q('prNew').onclick = function () {
      chooseMode(function (mode) { _pickedMode = mode; _wantPrivate = false; doCreate(); });
    };
    if (q('prPriv')) q('prPriv').onclick = function () {
      chooseMode(function (mode) { _pickedMode = mode; _wantPrivate = true; doCreate(); });
    };
    var ci = q('prCode');
    if (ci) {
      ci.oninput = function () { ci.value = String(ci.value || '').toUpperCase(); };
      ci.onkeydown = function (ev) { if (ev.key === 'Enter') joinByCode(); };
    }
    if (q('prJoinCode')) q('prJoinCode').onclick = joinByCode;
    if (q('prRef')) q('prRef').onclick = function () { _rowOrder = []; refresh(); };
    try {
      var pl = q('prList');
      if (pl) ['pointerdown', 'touchstart'].forEach(function (t) {
        pl.addEventListener(t, function () { _listTouchAt = Date.now(); }, { passive: true });
      });
    } catch (e) {}
    refresh();
    var autoRef = function () {
      if (seq !== _lobbySeq || !q('prList')) return;
      if (document.visibilityState !== 'hidden' && Date.now() - _listTouchAt > 2500) refresh(true);
      setTimeout(autoRef, 8000);
    };
    setTimeout(autoRef, 8000);
  }

  /* 列表刷不出来是「断网」还是「数据库那边不让读」？（审查 R2-UI-8：以前一律说「连不上网络，检查一下 Wi-Fi」，
     老师去查一个好好的 Wi-Fi）—— 交给账号模块看一眼登录服务，再试一次列表，按结论换说法 */
  function diagnoseList(r, seq) {
    var A = window.HansenAuth;
    if (!A || typeof A.diagnose !== 'function' || kindOf(r) !== 'network') return Promise.resolve(r);
    return A.diagnose([kindOf(r)], function () { return S().listRooms(); }).then(function (d) {
      if (seq !== _lobbySeq) return null;
      if (d.verdict === 'ok' && d.result && d.result.ok) return d.result;
      if (d.verdict === 'expired') return { ok: false, kind: 'expired', expired: true, reason: '云端登录过期了，重新登录一次就能继续 ⟨' + (d.raw || 'unauthenticated') + '⟩' };
      if (d.verdict === 'dbblocked') return dbBlocked(d, r);
      return r;
    }, function () { return r; });
  }

  /* 开房 / 进房失败、说的是「网络」：同样先弄清楚是不是真断网（审查 R2-UI-8：数据库那边不让读写时，
     开一间失败也说「连不上网络」）。这里只换说法 —— 开房 / 进房要孩子自己再点一次 */
  function explainNet(r) {
    var A = window.HansenAuth;
    if (!A || typeof A.diagnose !== 'function' || kindOf(r) !== 'network') return Promise.resolve(r);
    var d0 = Promise.resolve().then(function () { return A.diagnose([kindOf(r)], function () { return S().listRooms(); }); });
    /* 最多看 15 秒：看不出来就照原话说，别让「正在开房…」一直挂着 */
    var cap = new Promise(function (z) { setTimeout(function () { z(null); }, 15000); });
    return Promise.race([d0, cap]).then(function (d) {
      if (d && d.verdict === 'expired') return { ok: false, kind: 'expired', expired: true, reason: '云端登录过期了，重新登录一次就能继续 ⟨' + (d.raw || 'unauthenticated') + '⟩' };
      if (d && d.verdict === 'dbblocked') return dbBlocked(d, r);
      return r;
    }, function () { return r; });
  }
  /* 「云端连得上，但数据库这次没让读写」：话里自己说了「截图发给老师」，列表这一屏的重试按钮叫「🔄 刷新」 */
  function dbBlocked(d, r) {
    return { ok: false, kind: 'config', dbblocked: true,
             reason: String(d.text || '').replace(/「再试一次」/g, '「🔄 刷新」') + ' ⟨' + rawOf(E(r)) + '⟩' };
  }

  function refresh(auto) {
    if (!S()) return;
    var seq = _lobbySeq;
    S().listRooms().then(function (r) {
      return (r && !r.ok) ? diagnoseList(r, seq) : r;
    }).then(function (r) {
      var box = q('prList');
      if (!box || !r || seq !== _lobbySeq) return;
      if (!r.ok) {
        /* 顶上（开房 / 进房失败）已经说了同一种错误：列表这块只说一句短的，别把同一个大红框画两遍 */
        if (_lobbyErrKind && kindOf(r) === _lobbyErrKind) {
          box.innerHTML = '<div class="pr_empty" style="padding:12px 8px">房间列表这会儿也刷不出来，好了以后点「🔄 刷新」</div>';
          return;
        }
        box.innerHTML = errBlock(r); wireErr(); return;
      }
      var rooms = (r.rooms || []).filter(function (x) { return !x.mine; });
      /* 🔴审查 FX-9：自动刷新时，已经在列表里的房不挪位置（新开的房接在最后）——
         以前新房插到最上面，孩子正要点的那一行被挤下去，「进去打」点进了别人的房 */
      var byId = {};
      rooms.forEach(function (x) { byId[x.id] = x; });
      var order = _rowOrder.filter(function (id) { return !!byId[id]; });
      rooms.forEach(function (x) { if (order.indexOf(x.id) < 0) order.push(x.id); });
      _rowOrder = order;
      rooms = order.map(function (id) { return byId[id]; });
      /* v1164：同一个账号在另一台设备开的房，自己看不到也进不去 —— 说出来，别让人干等 */
      var same = (r.sameAccount > 0)
        ? '<div class="pr_empty" style="padding:8px 6px;font-size:12.5px;color:var(--pk-warn)">'
          + '同一个账号在另一台设备上开着房，要用另一个账号才能对战</div>'
        : '';
      if (!rooms.length) {
        box.innerHTML = same + '<div class="pr_empty">现在还没有人开房。<br>点上面的「➕ 开一间」，等别人来打。</div>';
        return;
      }
      /* 🔴v1156：**房间列表也要截断。**

         和排行榜同一个问题：这里直接画 listRooms 返回的全部房间。
         热门时段真的可能有几百间房 ——
         界面会卡、手机滚不到底，而**用户只会点前几间**：
         列表是按新旧排的，第 80 间房和第 3 间房对他没区别。

         > 每一层都该对自己画出来的东西负责。

         画前 30 间，多的告诉他"还有很多"并给刷新的理由。 */
      var MAX_ROOMS = 30;
      var more = Math.max(0, rooms.length - MAX_ROOMS);
      box.innerHTML = rooms.slice(0, MAX_ROOMS).map(function (x) {
        return '<div class="pr_room"><div class="n"><b>' + esc(x.hostName) + '</b>'
          /* 🔴v1156：**排位房全显示「未定级」是错的。**
             列表读的是 `hostTier`（开房时手填的），
             而天梯自动开的房传的是 `hostRating`（一个分数）——
             于是所有排位房都掉进 `|| '未定级'` 那个兜底里。

             用户在列表里看到一排「未定级」，**判断不出该进谁的房** ——
             而"对手大概什么水平"正是他点进去之前最想知道的。

             有分数就按分数算段位；两个都没有才说未定级。 */
          /* 🔴v1156：**房间卡片不说这是什么玩法。**

             三种玩法（抢答赛/一起答/接力赛）规则差别很大，
             而列表里一个字都没提 —— 用户点进去才知道。
             **"进去之前想知道什么"里，玩法排第一位**：
             他可能就是不想打抢答赛。

             加一个玩法徽章放在最前面，和段位、词数并列。 */
          + '<span>' + modeBadge(x.mode) + esc(tierText(x)) + ' · ' + x.wordCount + ' 个词 · '
          /* v1156: 文案缩短 —— 有段位分时这一行会挤到换行，
             而「秒前开/分钟前开」里的"开"字并不增加信息。 */
          + (x.ageSec < 60 ? x.ageSec + '秒前' : Math.round(x.ageSec / 60) + '分钟前') + '</span></div>'
          + '<button data-rid="' + esc(x.id) + '">进去打</button></div>';
      }).join('');
      if (same) box.innerHTML = same + box.innerHTML;
      if (more > 0) {
        box.innerHTML += '<div class="pr_empty" style="padding:12px 8px;font-size:13px">'
          + '还有 ' + more + ' 间房没显示 —— 先从上面这些挑一间打吧</div>';
      }
      [].slice.call(box.querySelectorAll('button[data-rid]')).forEach(function (b) {
        b.onclick = function () { doJoin(b.getAttribute('data-rid'), b); };
      });
    });
  }

  /* ── 开房 → 屏 2：等待对手 ── */
    /* 🔴v1100 开房前先选模式 —— 三种玩法规则差别很大，必须让房主明白选的是什么。
     说明文案直接读 HansenPkRoom.MODES，**不在这里另抄一份** ——
     本项目已因"同一件事两处真源"栽过八次。 */
  var _wantPrivate = false;
  /* v1164：排位这一次的设定（分数、匹配范围、成功/失败回调）。
     原来是散落的全局变量（_ladderRating / _askMode…），排完一局会串到下一次自由房里 ——
     比如自由房选过「听发音」，排位房也跟着变成听发音。现在每次显式传、用完就清。 */
  var _ladderCfg = null;
  var _waitMs = 120000;      /* 开房后等人的上限（测试可调短，产品默认 2 分钟） */

  /* 输房间码进房 */
  function joinByCode() {
    var ci = q('prCode');
    var btn = q('prJoinCode');
    var code = String((ci && ci.value) || '').trim().toUpperCase();

    /* 🔴v1156：**房间码输错了不该用 alert 报。**

       原来三处都是 `alert(...)`，在手机上有几个实在的毛病：
         · 微信/Safari 里样式各不相同，和 App 完全脱节
         · 会打断输入焦点 —— 用户关掉弹窗还得再点一次输入框重输
         · 连续弹几次后，有些浏览器会给"阻止此页面再弹窗"的选项，
           **用户一旦勾了，之后所有错误提示他都看不到了**

       而这个提示恰恰该紧贴着输入框 —— 那才是他要改的地方。
       改为在输入框下面显示一行红字，重新输入时自动消失。 */
    var say = function (msg) {
      try {
        var box = q('prCodeTip');
        if (!box) {
          box = document.createElement('div');
          box.id = 'prCodeTip';
          box.setAttribute('style',
            'color:var(--pk-bad,#f87171);font-size:12.5px;margin:6px 2px 0;line-height:1.6');
          if (ci && ci.parentNode) ci.parentNode.parentNode.insertBefore(
            box, ci.parentNode.nextSibling);
        }
        box.textContent = msg;
        /* 一改就把提示撤掉 —— 留着旧错误会让人以为改了也没用 */
        if (ci && !ci._tipBound) {
          ci._tipBound = 1;
          ci.addEventListener('input', function () {
            var t = q('prCodeTip'); if (t) t.textContent = '';
          });
        }
      } catch (e) {}
    };

    if (!code) { say('先输入好友给你的 4 位房间码'); if (ci) ci.focus(); return; }
    if (btn) { btn.disabled = true; btn.textContent = '找房中…'; }
    var restore = function () { if (btn) { btn.disabled = false; btn.textContent = '进房'; } };
    /* 🔴审查 R2-UI-2：查码要一两秒 —— 这期间孩子点了「← 返回」（或岛上按了返回键），查到了也不许再进房
       （以前照样进了朋友的房：岛藏起来了还在后台打，朋友对着「无名蜂」打完一局） */
    var seq0 = _lobbySeq;
    var stale = function () { return seq0 !== _lobbySeq || !q('prCode'); };
    /* v1164：刚开的房，别的手机要过一两秒才查得到（云数据库主从同步有延迟）——
       「没找到」先悄悄再查两次，别让朋友以为码给错了 */
    var find = function (left) {
      return S().findByCode(code).then(function (r) {
        if (r && !r.ok && r.kind === 'gone' && left > 0 && !stale()) {
          return new Promise(function (z) { setTimeout(z, 1200); }).then(function () { return find(left - 1); });
        }
        return r;
      });
    };
    find(2).then(function (r) {
      if (stale()) return;
      if (!r.ok) {
        restore();
        say(r.reason ? sayHuman(E(r)) : '没找到这间房 —— 房间码可能过期了，让朋友再发一次');
        if (ci) { ci.focus(); try { ci.select(); } catch (e) {} }
        return;
      }
      doJoin(r.roomId, btn, null, code);
    })['catch'](function (e) {
      if (stale()) return;
      restore();
      say(String((e && e.message) || e) || '网络不太顺，再试一次');
    });
  }

  function chooseMode(onPick) {
    var MODES = (S() && S().MODES) || {};
    var cards = ['A', 'B', 'C'].map(function (k) {
      var m = MODES[k];
      if (!m) return '';
      /* 🔴v1163：**选玩法的卡片必须是真正可聚焦、可读的控件。**

         原来是纯 `<div>` —— 没有 role、没有 tabindex、
         屏幕阅读器读不出这是能点的东西，键盘也 Tab 不到。

         而这一屏是**建房的必经之路**：不选玩法就开不了房。
         也就是说，只用键盘或用读屏软件的孩子，**根本建不了房**。

         > 看起来能点 ≠ 真的能操作。
         > 一个必经步骤上的控件，比装饰性元素更不能省这一步。

         加 role="button" + tabindex="0" + aria-label，
         并在下面补键盘事件（回车/空格触发）。 */
      return '<div class="pr_mode" role="button" tabindex="0"'
        + ' aria-label="选择玩法：' + esc(m.name || k) + '"'
        + ' data-mode="' + k + '" style="border:1px solid var(--pk-in-line);'
        + 'border-radius:14px;padding:12px 14px;margin:10px 0;cursor:pointer;background:var(--pk-card)">'
        + '<div style="font-size:17px;font-weight:800;color:var(--pk-txt)">'
        + m.emoji + ' ' + esc(m.name)
        + (m.ranked ? '<span style="font-size:12px;color:var(--pk-warn);margin-left:8px">⭐ 计天梯</span>' : '')
        + '</div>'
        + '<div style="font-size:13px;color:var(--pk-dim);margin:4px 0 8px">' + esc(m.tagline) + '</div>'
        + '<ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.75;color:var(--pk-txt)">'
        + (m.rules || []).map(function (r) {
            return '<li>' + esc(r).replace(/\*\*(.+?)\*\*/g,
                     '<b style="color:#fff">$1</b>') + '</li>';
          }).join('')
        + '</ul></div>';
    }).join('');

    /* v1102：出题形式也让房主选 —— 听发音才是拼写比赛的本来面目，
       但刚入门的孩子看中文更容易上手，所以两种都留着。 */
    var askCards = ['cn', 'tts'].map(function (k) {
      var a = ASK_MODES[k];
      var on = (_askMode === k);
      return '<div class="pr_ask" data-ask="' + k + '" style="flex:1;text-align:center;'
        + 'border:1px solid ' + (on ? '#6366f1' : 'var(--pk-in-line)') + ';border-radius:12px;'
        + 'padding:10px 6px;cursor:pointer;background:' + (on ? '#1e1b4b' : 'var(--pk-card)') + '">'
        + '<div style="font-size:22px">' + a.emoji + '</div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--pk-txt)">' + esc(a.name) + '</div>'
        + '<div style="font-size:11.5px;color:var(--pk-dim);margin-top:2px">' + esc(a.tip) + '</div></div>';
    }).join('');

    paint('<div class="pr_top"><div class="pr_h">选个玩法</div>'
      + '<div class="pr_sub">三种规则差别很大，选你喜欢的</div></div>'
      + '<div style="font-size:13px;color:var(--pk-dim);margin:6px 0 4px">怎么出题</div>'
      + '<div style="display:flex;gap:10px;margin-bottom:6px">' + askCards + '</div>'
      + cards
      + '<button class="pr_btn pr_ghost" id="prBack">← 返回</button>');

    var host = document.getElementById('hsn_pkroom_screen');
    if (host) {
      host.querySelectorAll('.pr_ask').forEach(function (el) {
        el.onclick = function () { _askMode = el.getAttribute('data-ask'); chooseMode(onPick); };
      });
      host.querySelectorAll('.pr_mode').forEach(function (el) {
        var pick = function () { onPick(el.getAttribute('data-mode')); };
        el.onclick = pick;
        /* v1163: 键盘也要能选 —— 回车和空格，和原生 button 的行为一致。
           空格要 preventDefault，否则页面会往下滚一屏。 */
        el.onkeydown = function (ev) {
          if (!ev) return;
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            try { ev.preventDefault(); } catch (e) {}
            pick();
          }
        };
      });
    }
    var b = q('prBack');
    if (b) b.onclick = function () { lobby(); };
  }

  /* cfg（v1164）：这一次开房的全部设定，显式传进来 ——
       自由房：{ mode, askMode, private }（来自选玩法那一屏）
       排位房：{ ladder:true, mode:'A', askMode:'cn', private:false, rating, t0, band, onOk, onFail } */
  var _createBusy = false;   /* 🔴审查 UI-6：连点两下「选个玩法」会开出两条等人的轮询 */
  /* 🔴审查 R2-UI-1 / R2-UI-6 / T1：开房要几秒（慢网下更久）。这一次开房的编号 —— 离开了（取消、返回、关掉、
     回列表）就作废：开房回来时不许再画「等对手进来」，开出来的房马上收掉。 */
  var _createSeq = 0, _createCap = null;
  var CREATE_CAP_MS = 25000;   /* 开房最多等这么久（以前请求卡住时要等 77 秒） */
  function cancelCreating() {
    if (_createCap) { clearTimeout(_createCap); _createCap = null; }
    if (!_createBusy) return;
    _createSeq++; _createBusy = false;
    try { if (S() && S().cancelCreate) S().cancelCreate(); } catch (e) {}
  }
  /* 「正在开房…」要看得见，还要能取消（审查 R2-UI-6：以前点了玩法屏幕一动不动，孩子只好狂点、按返回） */
  function showCreating(lad, cfg) {
    var cancel = function () {
      cancelCreating();
      if (lad) { ladderBack('home', ''); return; }
      lobby();
    };
    if (lad) {
      if (q('prCreateCancel')) q('prCreateCancel').onclick = cancel;
      return;
    }
    var host0 = q(ID);
    var cards = host0 ? host0.querySelectorAll('.pr_mode') : [];
    if (!cards.length) return;
    [].slice.call(cards).forEach(function (el) {
      var mine = el.getAttribute('data-mode') === cfg.mode;
      el.style.opacity = mine ? '1' : '.45';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-disabled', 'true');
      if (mine) el.style.borderColor = '#6366f1';
    });
    if (!q('prCreating')) {
      var box = document.createElement('div');
      box.id = 'prCreating';
      box.setAttribute('role', 'status');
      box.setAttribute('style', 'text-align:center;margin:12px 0;font-size:14px;color:var(--pk-txt)');
      box.innerHTML = '⏳ 正在开房…（网慢的时候要等几秒）'
        + '<button class="pr_btn pr_btn2" id="prCreateCancel" style="margin-top:10px">取消</button>';
      var back = q('prBack');
      if (back && back.parentNode) back.parentNode.insertBefore(box, back);
      else host0.querySelector('.pr_wrap').appendChild(box);
    }
    if (q('prCreateCancel')) q('prCreateCancel').onclick = cancel;
  }
  function doCreate(cfg) {
    cfg = cfg || { mode: _pickedMode, askMode: _askMode, private: _wantPrivate };
    var lad = !!cfg.ladder;
    if (_createBusy) return;
    _createBusy = true;
    var seq = ++_createSeq;
    showCreating(lad, cfg);
    if (_createCap) clearTimeout(_createCap);
    _createCap = setTimeout(function () {
      _createCap = null;
      if (seq !== _createSeq) return;
      cancelCreating();
      var slow = { ok: false, kind: 'slow', reason: '网络太慢，房没开成，再点一次开房 ⟨开房 ' + (CREATE_CAP_MS / 1000) + ' 秒没有回应⟩' };
      if (lad) { ladderFail(cfg, slow); return; }
      lobby(slow);
    }, CREATE_CAP_MS);
    var tier = '', rating = 0;
    /* v1164：分数从战绩模块读（资料模块没有 status()，原来这里永远取不到段位） */
    try { var L = window.HansenSbLadder, R = window.HansenPkRecord;
          rating = (R && R.summary) ? Number(R.summary().rating) || 0 : 0;
          if (L && L.tierOf && rating) tier = L.tierOf(rating).name; } catch (e) {}
    S().createRoom({ tier: tier, mode: cfg.mode, askMode: cfg.askMode, private: !!cfg.private,
                     /* 排位房写上自己的分供别人匹配；自由房不写（免得被排位的人当成排位房配进来）。
                        elo：真实天梯分，客人算 ELO 用（审查 UI-12：自由房的抢答赛也计天梯） */
                     hostRating: lad ? (Number(cfg.rating) || rating || 1000) : 0,
                     elo: Number(cfg.rating) || rating || 0 }).then(function (r) {
      if (seq !== _createSeq) {
        /* 这一次已经作废（取消 / 返回键 / 关掉 / 超时）：数据层会把开出来的房收掉，这里再收一次保险；不画任何东西 */
        if (r && r.ok) { try { S().leaveRoom(r.roomId); } catch (e) {} }
        return;
      }
      if (_createCap) { clearTimeout(_createCap); _createCap = null; }
      if (r && r.cancelled) { _createBusy = false; return; }
      if (!r || !r.ok) {
        if (lad) { _createBusy = false; ladderFail(cfg, r || { ok: false, reason: '房没开成' }); return; }
        /* 先弄清是不是真断网再说（「正在开房…」和「取消」留着，取消照样作废这一次） */
        explainNet(r).then(function (x) {
          if (seq !== _createSeq) return;
          _createBusy = false;
          lobby(x);
        });
        return;
      }
      _createBusy = false;
      /* v1163: 把玩法一起存下来 —— 等待屏要显示「你开的是什么房」 */
      _state = { roomId: r.roomId, words: r.words, isHost: true, ladder: lad,
                 mode: (r.room && r.room.mode) || cfg.mode || 'C',
                 askMode: (r.room && r.room.askMode) || cfg.askMode || 'cn',
                 isPrivate: !!cfg.private };
      if (lad && typeof cfg.onOk === 'function') { try { cfg.onOk(); } catch (e) {} }
      waiting(r.roomId, (r.room && r.room.code) || '', cfg);
    })['catch'](function () { if (seq === _createSeq) { _createBusy = false; if (_createCap) { clearTimeout(_createCap); _createCap = null; } } });
  }

  /* 排位流程在这边走不下去了：交回天梯，由天梯决定接着找还是说清楚原因 */
  function ladderFail(cfg, r) {
    _fromLadder = false;
    hideShell();
    _state = null;
    if (cfg && typeof cfg.onFail === 'function') { try { cfg.onFail(r); } catch (e) {} return; }
    try {
      if (window.HansenLadderUI && HansenLadderUI._fromRoom) HansenLadderUI._fromRoom('rematch', '', r);
      else if (window.HansenLadderUI) HansenLadderUI.open();
    } catch (e) {}
  }
  /* 排位：回天梯（接着找 / 回首页）。先把这一层彻底关掉（停计时、退房），再交过去 */
  function ladderBack(how, text, r) {
    close();
    try {
      if (window.HansenLadderUI && HansenLadderUI._fromRoom) HansenLadderUI._fromRoom(how, text, r);
      else if (window.HansenLadderUI) HansenLadderUI.open();
    } catch (e) {}
  }

  function waiting(roomId, code, cfg) {
    cfg = cfg || null;
    var lad = !!(cfg && cfg.ladder);
    /* 🔴v1105：私密房把**房间码大大地显示出来**，并给一键复制。 */
    var codeBox = code
      ? '<div style="margin:18px 0;text-align:center">'
        + '<div style="font-size:13px;color:var(--pk-dim);margin-bottom:6px">把这个码发给好友</div>'
        + '<div id="prCodeBig" style="font-size:44px;font-weight:900;letter-spacing:12px;'
        +   'color:#a5b4fc;background:var(--pk-card);border:1px dashed #4f46e5;border-radius:16px;'
        +   'padding:14px 10px;cursor:pointer">' + esc(code) + '</div>'
        + '<button class="pr_btn" id="prCopy" style="margin-top:10px">📋 复制房间码</button>'
        + '<div style="font-size:12px;color:var(--pk-faint);margin-top:6px">'
        +   '私密房不出现在公开列表，只有拿到码的人能进</div>'
        + '</div>'
      : (lad
          ? '<div class="pr_empty">暂时没找到对手，已经开好一间排位房。<br>'
            + '有人来就自动开打；先开好的房也会自动配给你。</div>'
          : '<div class="pr_empty">房间已经开好了，别人在列表里就能看到你。<br>'
            + '等人进来就自动开打。</div>');

    /* 🔴v1163：**等待屏原来一动不动，也不说等了多久。** 让人等，就得让他看见时间在走。 */
    var _modeName = '';
    var _wc = 0;
    try {
      var _pd = _state || {};
      _wc = (_pd.words && _pd.words.length) || 0;
      var _mk = _pd.mode || (_pd.room && _pd.room.mode) || '';
      var _M = (_mk && S() && S().modeOf) ? S().modeOf(_mk) : null;
      if (_M) _modeName = (_M.emoji || '') + (_M.name || '');
    } catch (e) {}
    var _roomInfo = (_modeName || _wc)
      ? '<div style="text-align:center;font-size:12.5px;color:var(--pk-dim);margin-top:6px">'
        + '你开的是 ' + (_modeName ? esc(_modeName) + ' · ' : '')
        + (_wc || 5) + ' 个词</div>'
      : '';

    paint('<style>@keyframes hsnWaitSpin{0%,100%{transform:rotate(0deg)}'
      + '45%{transform:rotate(175deg)}50%{transform:rotate(180deg)}'
      + '95%{transform:rotate(355deg)}}</style>'
      + '<div class="pr_top"><button class="pr_back" id="prBack">' + (lad ? '← 不等了' : '← 关掉房间') + '</button>'
      + '<div class="pr_h">' + (lad ? '⚡ 排位 · 等对手进来' : '⏳ 等对手进来') + '</div></div>'
      + '<div style="text-align:center;font-size:38px;margin:14px 0 4px;'
      +   'display:inline-block;width:100%">'
      +   '<span style="display:inline-block;'
      +     'animation:hsnWaitSpin 2.4s ease-in-out infinite">⏳</span></div>'
      + '<div id="prWaited" style="text-align:center;font-size:13px;'
      +   'color:var(--pk-dim);margin-bottom:10px">已等 0 秒</div>'
      + codeBox
      + _roomInfo
      + '<div class="pr_empty" style="font-size:12.5px;margin-top:10px">'
      + '（关掉这一页，房间也会一起关掉）</div>');

    /* 每秒把「已等多久」刷一次 —— 排位从点「开始排位」那一刻算起，接得上前面的等待。
       🔴审查 UI-7：第一笔就按同一个公式画（以前先写死「已等 0 秒」，排位过来时数字 20 → 0 → 22 乱跳） */
    try {
      var _t0 = (lad && cfg.t0) || Date.now();
      var waitedText = function () {
        var sec = Math.max(0, Math.floor((Date.now() - _t0) / 1000));
        return sec < 60
          ? ('已等 ' + sec + ' 秒')
          : ('已等 ' + Math.floor(sec / 60) + ' 分 ' + (sec % 60) + ' 秒');
      };
      if (q('prWaited')) q('prWaited').textContent = waitedText();
      if (_state && _state._waitTimer) clearInterval(_state._waitTimer);
      var _wt = setInterval(function () {
        var el = q('prWaited');
        if (!el) { clearInterval(_wt); return; }
        el.textContent = waitedText();
      }, 1000);
      if (_state) _state._waitTimer = _wt;
    } catch (e) {}
    if (q('prBack')) q('prBack').onclick = function () {
      if (lad) { ladderBack('home', ''); return; }
      close();
    };

    if (code) {
      var doCopy = function () {
        var okMsg = function () {
          var b = q('prCopy');
          if (b) { b.textContent = '✅ 已复制，去微信发给好友';
                   setTimeout(function () { if (b) b.textContent = '📋 复制房间码'; }, 2200); }
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(okMsg)['catch'](function () { fallback(); });
            return;
          }
        } catch (e) {}
        fallback();
        function fallback() {
          /* 微信内置浏览器有时拿不到 clipboard 权限 —— 退回选中文本让用户长按复制 */
          try {
            var el = q('prCodeBig');
            if (el && window.getSelection && document.createRange) {
              var r = document.createRange(); r.selectNodeContents(el);
              var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
            }
            var b = q('prCopy');
            if (b) b.textContent = '长按上面的码复制';
          } catch (e) {}
        }
      };
      if (q('prCopy')) q('prCopy').onclick = doCopy;
      if (q('prCodeBig')) q('prCodeBig').onclick = doCopy;
    }

    /* 等多久：默认 2 分钟；排位里从「先开的房」那儿退回来接着等时，用剩下的时间 */
    var WAIT_MS = _waitMs;
    if (_state && !_state._waitStart) _state._waitStart = Date.now();
    var left = WAIT_MS - (Date.now() - ((_state && _state._waitStart) || Date.now()));
    var st = _state;
    /* 🔴审查 UI-6：同一时刻只能有一条「等人」的轮询 —— 先把上一条停掉 */
    if (_cancelWait) { try { _cancelWait(); } catch (e) {} _cancelWait = null; }
    var wopts = lad ? { ladder: {
      rating: Number(cfg.rating) || 0,
      /* 匹配范围按「这一次排位一共等了多久」放宽，接得上前面 20 秒 */
      band: function () { return (typeof cfg.band === 'function') ? cfg.band() : 400; }
    } } : undefined;
    _cancelWait = S().waitForOpponent(roomId, function (ev) {
      if (st !== _state) return;              /* 这一屏已经换掉了 */
      if (ev.joined) {
        /* v1164：对手是谁、多少分 —— 房主这边原来从来不知道（结算按 1000 分算 ELO） */
        try {
          var rm = ev.room || {};
          if (rm.guestName) st.oppName = rm.guestName;
          if (Number(rm.guestRating) > 0) st._oppRating = Number(rm.guestRating);
        } catch (e) {}
        startMatch(); return;
      }
      if (ev.switchTo && lad) {
        /* 🔴v1164：两个人差不多同时开始排位 → 各自开了一间房、互相干等两分钟（真机现象）。
           数据层发现有**更早开的**合适的房：去进那间（进成了自己这间会被收掉）。 */
        clearWait(st);
        switchRoom(roomId, code, cfg, ev.switchTo);
        return;
      }
      if (ev.gone) {
        clearWait(st);
        if (lad) { ladderBack('rematch', '刚才那间房没了，接着帮你找…'); return; }
        endWait(st); lobby({ reason: '房间已经不在了' }); return;
      }
      if (ev.timeout) {
        /* 数据层已经把房收掉了（不留「看得见、进去没人」的幽灵房）—— 这边只停心跳、清状态 */
        endWait(st);
        if (lad) { ladderBack('home', '暂时没有对手，等会儿再来'); return; }
        lobby({ reason: '等了两分钟还没人来，房间先关掉了。想玩就再开一间吧。' });
        return;
      }
      if (ev.error) {
        var fr = { ok: false, reason: ev.error, kind: ev.kind || kindOf({ reason: ev.error }), expired: !!ev.expired };
        clearWait(st);
        if (lad) { ladderBack('rematch', '', fr); return; }
        endWait(st, true); lobby(fr);
      }
    }, Math.max(Math.min(15000, WAIT_MS), left), wopts);
  }

  /* 停掉等待屏自己的东西（计时器、轮询） */
  function clearWait(st) {
    try { if (st && st._waitTimer) { clearInterval(st._waitTimer); st._waitTimer = null; } } catch (e) {}
    if (_cancelWait) { try { _cancelWait(); } catch (e) {} _cancelWait = null; }
  }
  /* 等待结束、回列表：心跳停掉；还开着的房（报错退出时）收掉 */
  function endWait(st, leave) {
    clearWait(st);
    try { S().stopHeartbeat(); } catch (e) {}
    if (leave && st && st.roomId) { try { S().leaveRoom(st.roomId); } catch (e) {} }
    if (_state === st) _state = null;
  }

  /* 排位：换到更早开的那间房。进不去时 ——
       自己这间还在（座位都没抢到）→ 回自己这间接着等
       自己这间已经收了（抢到座位、但房主没确认）→ 回天梯接着找 */
  function switchRoom(myRid, myCode, cfg, target) {
    var mine = _state;
    paint('<div class="pr_top"><div class="pr_h">⚡ 排位</div></div>'
      + '<div class="pr_empty" style="padding:30px 12px">找到一间先开好的房，正在进去…</div>');
    var join = {};
    for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) join[k] = cfg[k];
    join.onOk = null;
    join.onFail = function (r) {
      var stillMine = false;
      try { stillMine = (S()._currentRoomId() === myRid && S()._currentRole() === 'host'); } catch (e) {}
      if (r && r.cancelled) { ladderBack('home', ''); return; }
      if (stillMine && mine) {
        _state = mine;
        _fromLadder = true;
        var el = host(); el.classList.add('on');
        waiting(myRid, myCode, cfg);
        return;
      }
      ladderBack('rematch', '那间房没进去，接着帮你找…', r);
    };
    _state = null;
    doJoin(target, null, join);
  }

  /* ── 进房 ──
     🔴v1164：进别人的房要**等房主确认**（客人不能改房主的文档，只能占个座位等他点头）——
     最多 15 秒。这段时间给一屏「正在进房」和一个取消键，别让人对着按钮发呆。
     进不去要说**真实原因**：被别人抢了 / 房没了 / 断网 / 云端设置… 原来一律说「被抢走了」。 */
  function doJoin(rid, btn, cfg, code) {
    cfg = cfg || null;
    var lad = !!(cfg && cfg.ladder);
    if (btn) { btn.disabled = true; btn.textContent = '进入中…'; }
    cancelJoin();
    var my = _joinSeq;
    _joiningRid = rid;
    paint('<div class="pr_top"><button class="pr_back" id="prBack">← 返回</button>'
      + '<div class="pr_h">' + (lad ? '⚡ 排位 · 进房中' : '🚪 进房中') + '</div></div>'
      + '<div style="text-align:center;padding:26px 12px">'
      +   '<div style="font-size:40px">🚪</div>'
      +   '<div style="font-size:16px;font-weight:800;margin-top:10px">正在进房，等房主确认…</div>'
      +   '<div id="prJoinWait" style="font-size:13px;color:var(--pk-dim);margin-top:8px">已等 0 秒</div>'
      +   '<div id="prJoinWhy" style="font-size:12px;color:var(--pk-faint);margin-top:8px;line-height:1.7">'
      +     '房主那边点头了就开打，一般几秒钟</div>'
      +   '<button class="pr_btn pr_btn2" id="prJoinCancel" style="margin-top:18px">取消</button>'
      + '</div>');
    startTicker('prJoinWait', Date.now(), function (s) { return '已等 ' + s + ' 秒'; });
    /* 取消：退座位，数据层会让这次进房以「已经退出」结束。
       ⚠️ 座位还没抢到时点的取消，数据层那边可能接着抢到 —— 记下来，进成了也马上退。
       🔴审查 UI-3：点了取消就**马上离开这一屏**（以前要等 15 秒确认超时，按钮看着像坏了）；
       收尾交给数据层在后台做。 */
    var userCancel = false;
    var onCancel = function () {
      if (userCancel) return;
      userCancel = true;
      _joinSeq++; _joiningRid = '';
      stopTicker();
      try { S().leaveRoom(rid); } catch (e) {}
      if (lad) { ladderFail(cfg, { ok: false, cancelled: true, kind: 'other', reason: '已经退出这间房了' }); return; }
      _fromLadder = false;
      lobby();
    };
    if (q('prJoinCancel')) q('prJoinCancel').onclick = onCancel;
    if (q('prBack')) q('prBack').onclick = onCancel;
    var myRating = 0;
    try { myRating = Number(cfg && cfg.rating) || Number(window.HansenPkRecord.summary().rating) || 0; } catch (e) {}
    /* 房主暂时切出去了（私密房的房主多半在微信里发码）：说一声，让孩子知道为什么还没开打（审查 R2-UI-3） */
    var onWait = function (info) {
      if (my !== _joinSeq || !info || !info.hostAway) return;
      var el = q('prJoinWhy');
      if (el) el.textContent = '房主刚切出去了一下（可能在发房间码），他回来就开打，再等一会儿…';
    };
    S().joinRoom(rid, { rating: myRating, code: code || '', onWait: onWait }).then(function (r) {
      /* 已经取消 / 换了一次进房：界面不再管它；万一数据层那边还是进成了，马上退出来（别留一个房主在等的空座位） */
      if (my !== _joinSeq) { if (r && r.ok) { try { S().leaveRoom(r.roomId); } catch (e) {} } return; }
      _joiningRid = '';
      stopTicker();
      if (userCancel) {
        if (r && r.ok) { try { S().leaveRoom(r.roomId); } catch (e) {} }
        r = { ok: false, cancelled: true, kind: 'other', reason: '已经退出这间房了' };
      }
      if (!r || !r.ok) {
        r = r || { ok: false, reason: '没进去' };
        if (lad) { ladderFail(cfg, r); return; }
        _fromLadder = false;
        if (r.cancelled) { lobby(); return; }
        /* 🔴v1154：进不去要说人话，不能默默甩回列表 —— 列表顶上说原因，下面是刷新过的房间
           （说「网络」之前先弄清是不是真断网，审查 R2-UI-8） */
        explainNet(r).then(function (x) {
          if (my !== _joinSeq) return;
          lobby(x);
        });
        return;
      }
      _fromLadder = false;
      if (lad && typeof cfg.onOk === 'function') { try { cfg.onOk(); } catch (e) {} }
      /* 🔴v1163：**客人也要拿到房主选的玩法。** 玩法是这间房的属性，不是各人的偏好。
         v1164：对手名字和分数也从房间里拿（结算算 ELO 要用真实分数） */
      var rm = r.room || {};
      _state = { roomId: r.roomId, words: r.words, isHost: false, ladder: lad,
                 mode: rm.mode || r.mode || '',
                 askMode: rm.askMode || 'cn',
                 oppName: rm.hostName || '',
                 /* 审查 UI-12：自由房写的 hostRating 是 0（不让天梯配进来），真实分数在 hostElo */
                 _oppRating: Number(rm.hostElo) || Number(rm.hostRating) || 0 };
      startMatch();
    });
  }

  /* ── 屏 3：对战（v1101 回合制）──────────────────────────────

     🔴v1101 把对战屏重写成**一次一个词**。

     v1099 的做法是把整套词交给拼写蜂，两人各自做完再比分 ——
     用户点破："对战肯定是两个人同时拼一个单词，一个单词一个单词地拼，
     不可能给他所有单词大家在那儿各拼各的。"

     现在的一回合长这样：
       ┌──────────────────────────────┐
       │  你 320          对手 260     │   ← 实时比分
       │  第 3 / 12 词      ⏱ 12s      │
       │                              │
       │        🍎  苹果               │
       │      a _ _ _ _               │   ← 首字母提示，和拼写蜂一致
       │      [ 输入框 ]               │
       │                              │
       │  对手：正在拼…                 │   ← 实时状态，这是对战感的来源
       └──────────────────────────────┘

     判分完全交给 claimRound()（已验证过抢答原子性），
     这里只负责显示和推进。 */

  /* ── 🔴v1102 发音 + 两种出题形式 ────────────────────────────

     用户点破："拼写对战本来不就是发音吗？听发音之后再拼单词。"
     —— 说得对。拼写比赛（spelling bee）的本质就是**听音拼词**，
     我 v1101 只显示中文，等于把这个功能的核心丢了。

     两种出题形式，玩家自己选：
       看中文 —— 屏幕显示「苹果」，看着拼（简单，适合刚入门）
       听发音 —— **只放读音，屏幕上不给词**，听着拼（这才是真正的拼写比赛）

     发音参数与拼写蜂完全一致（en-US / rate .82 / 优先英文音色），
     并走全站统一音量（HansenTTSVolume），
     否则同一个 App 里两处发音一大一小 —— v1038 修过这个毛病。 */

  var ASK_MODES = {
    cn:  { key: 'cn',  name: '看中文', emoji: '📖', tip: '屏幕显示中文，看着拼' },
    tts: { key: 'tts', name: '听发音', emoji: '🔊', tip: '只放读音，不给词，听着拼' }
  };
  var _askMode = 'cn';        /* 默认看中文；房主开房时可改 */

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/[^a-zA-Z \-]/g, ''));
      u.lang = 'en-US'; u.rate = 0.82; u.pitch = 1;
      /* 走全站音量归一 —— 不然 PK 的发音会比岛屿里大一截 */
      try {
        var V = window.HansenTTSVolume;
        if (V && typeof V.gain === 'function') u.volume = V.gain();
      } catch (e) {}
      var vs = speechSynthesis.getVoices();
      var ev = vs.filter(function (v) { return /^en(-|_)/i.test(v.lang); })[0];
      if (ev) u.voice = ev;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  var _pickedMode = 'C';   /* v1100: 房主选的玩法，默认同步赛 */
  var _rt = null;
  var _kbKeyHandler = null;          /* 本回合的运行时状态 */
  var _pollTimer = null;
  var _lastStats = null;   /* v1156: 结算屏要用的本局统计 —— _state 那时已被清空 */
  var _netMiss = 0;   /* v1154: 连续拿不到房间状态的次数 */
  var _waitResult = 0; /* v1154: 等对手交卷的轮询次数，防止无限等待 */
  var _resultFail = 0; /* v1164: 交卷连续失败的次数（失败先重试，不立刻把人踢走） */

  function stopKb() {
    if (_kbKeyHandler) { try { document.removeEventListener('keydown', _kbKeyHandler); } catch (e) {} _kbKeyHandler = null; }
  }

  function stopPoll() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    if (_rt && _rt.offVis) { try { _rt.offVis(); } catch (e) {} _rt.offVis = null; }
  }

  function startMatch() {
    if (_cancelWait) { try { _cancelWait(); } catch (e) {} _cancelWait = null; }
    var st = _state;
    if (!st) return;
    stopTicker();
    try { if (st._waitTimer) { clearInterval(st._waitTimer); st._waitTimer = null; } } catch (e) {}
    st.startAt = Date.now();
    st.myScore = 0; st.oppScore = 0; st.oppAns = -1;
    st.mode = st.mode || _pickedMode || 'C';
    st.oppName = st.oppName || '';
    /* 🔴v1164：**每一局的计数器从零开始。** 原来是模块级的、从不清零 ——
       上一局断网攒下的 4 次失败，会让这一局第一次读不到就挂「网络不稳」；
       上一局等交卷数到 20 次，这一局等两次就被判「对手离场」。 */
    _netMiss = 0; _waitResult = 0; _goneChecked = 0; _resultFail = 0;
    st.pendingR = {};
    /* 报到 —— 双方都进屏了才开打，避免一方还在加载就被抢完。
       🔴v1164（审查 F7）：**第一词也按本机时间起算**，不再拿对方手机写的时间戳当起点 ——
       对方钟快 10 分钟时我这边倒计时是 617 秒，慢 15 秒时一进来只剩 2 秒。
       做法：看到对手也报到了（读到他的「就绪」）就开第一词；最多等 2 秒（对手断网也不会把人卡住，
       v1127 的教训：开局不能拖）。两边各自「看到对方报到」的时刻只差一次轮询，比拿两台手机的钟去比准得多。 */
    var started = false;
    var go = function () { if (started) return; started = true; askRound(0); };
    try {
      S().markReady(st.roomId);
      if (st.roomId && st.roomId !== 'test' && S().roundState) {
        paint('<div class="pr_top"><div class="pr_h">⚡ 对手到了</div></div>'
          + '<div class="pr_empty" style="padding:34px 12px;font-size:16px">准备好，马上开始…</div>');
        var t0 = Date.now(), CAP = 2000;
        var poll = function () {
          if (started || !stillLive(st)) return;
          S().roundState(st.roomId).then(function (r) {
            if (started || !stillLive(st)) return;
            var oppReady = r && r.ok && (r.mySide === 'host' ? r.guestReady : r.hostReady);
            /* 审查 R2-UI-5：看到对手报到 = 他真的进了对战屏（之后他走了算「离场」，不是「没进来」） */
            if (oppReady) st._oppSeen = true;
            if (oppReady || Date.now() - t0 >= CAP) { go(); return; }
            setTimeout(poll, 400);
          }, function () { if (Date.now() - t0 >= CAP) go(); else setTimeout(poll, 400); });
        };
        setTimeout(function () { if (stillLive(st)) go(); }, CAP + 500);   /* 兜底：轮询卡住也照样开打 */
        poll();
        return;
      }
    } catch (e) {}
    go();
  }

  /* 🔴v1118 内置 QWERTY 键盘 —— 与拼写蜂同一套布局与手感 */
  function pkKeyboard() {
    var rows = [['q','w','e','r','t','y','u','i','o','p'],
                ['a','s','d','f','g','h','j','k','l'],
                ['z','x','c','v','b','n','m']];
    var h = '<div class="pr_kb" id="prKb">';
    h += '<div class="pr_kbrow">' + rows[0].map(kbBtn).join('') + '</div>';
    h += '<div class="pr_kbrow pr_indent">' + rows[1].map(kbBtn).join('') + '</div>';
    h += '<div class="pr_kbrow">' + rows[2].map(kbBtn).join('')
       + '<button class="pr_key pr_del" data-k="\u232b" aria-label="删除一个字母">\u232b</button>'
       + '</div>';
    return h + '</div>';
  }
  function kbBtn(l) {
    return '<button class="pr_key" data-k="' + l + '" aria-label="字母 ' + l + '">' + l + '</button>';
  }

  function bindKeyboard(en, idx) {
    var kb = q('prKb'), input = q('prIn');
    if (!kb || !input) return;
    kb.querySelectorAll('.pr_key').forEach(function (b) {
      b.onclick = function (ev) {
        ev.preventDefault();
        if (!_rt || _rt.idx !== idx || _rt.answered) return;
        var k = b.getAttribute('data-k');
        if (k === '\u232b') input.value = String(input.value || '').slice(0, -1);
        else if (String(input.value || '').length < 24) input.value += k;
        /* 拼对即提交 —— 和输入框的 oninput 走同一条路 */
        if (String(input.value || '').trim().toLowerCase() === en.toLowerCase())
          submitRound(idx, true);
      };
    });
    /* 电脑上仍可用实体键盘 —— 手机没有实体键盘，这条不影响它 */
    _kbKeyHandler = function (ev) {
      if (!_rt || _rt.idx !== idx || _rt.answered) return;
      if (ev.key === 'Backspace') { ev.preventDefault(); input.value = String(input.value||'').slice(0,-1); return; }
      if (!/^[a-zA-Z]$/.test(ev.key)) return;
      ev.preventDefault();
      if (String(input.value || '').length < 24) input.value += ev.key.toLowerCase();
      if (String(input.value || '').trim().toLowerCase() === en.toLowerCase())
        submitRound(idx, true);
    };
    try { document.addEventListener('keydown', _kbKeyHandler); } catch (e) {}
  }

  function askRound(idx) {
    /* v1156: 上一题提交时把输入框禁用、键盘调暗了，这里要恢复 ——
       **禁用状态如果留下来，下一题就打不了字了**，
       而那种"看着能玩但敲不进去"的坏法最难被发现。 */
    try {
      var _in1 = q('prIn');
      if (_in1) _in1.disabled = false;
      var _kb1 = q('prKb');
      if (_kb1) _kb1.style.opacity = '';
    } catch (e) {}

    stopPoll();
    var st = _state;
    if (!st) return;
    var words = st.words || [];
    if (idx >= words.length) { finish(); return; }

    var M = (S() && S().modeOf) ? S().modeOf(st && st.mode) : { perWordSecs: 15, name: '' };
    var w = words[idx];
    var en = String(w.en || '');
    var askIsTts = (st.askMode || _askMode) === 'tts';
    /* 截止时间以房间共享的 roundAt 为准 —— 两边算出来一样，才谈得上公平。
       拿不到 roundAt（首回合、或读取失败）时退回本地计时。 */
    var span = (M.perWordSecs || 15) * 1000;
    /* 🔴v1127：**过期的 roundAt 不能用。**

       实测：房间开着等对手来，等了 2 分钟 —— 房间的 `roundAt` 还是
       "刚开房那一刻"，于是一进对战屏倒计时直接是 **0 秒**，
       用户**根本没机会答第一个词**。

       v1126 为了公平改用共享 roundAt，但漏了这一条：
       它只有在"这一回合刚刚开始"时才代表本回合的起点。
       超出一个回合时长就说明它是陈旧的（对手还没来、或刚推进还没同步到），
       这时退回本地计时 —— **宁可两边差一两秒，也不能让人一进来就 0 秒**。 */
    /* 🔴v1164：B/C 模式里两人各拼各的（慢的那位拼完上一词才来到这一词），
       共享的 roundAt 记的是「先拼对的那一刻」—— 拿它当起点，慢的孩子一进新词就只剩几秒。
       所以 B/C 从第 2 词起按自己看到这一词的时刻算 15 秒；第 1 词和 A 抢答赛仍用共享起点。 */
    /* 🔴v1164（审查 F7）：**每一词都从「本机看到这一词开始」起算**。
       以前抢答赛第 2 词起拿「上一词谁拼对的那一刻」当起点 —— 那是对方手机的钟：
       对方快 10 分钟，我这边倒计时 617 秒；慢 15 秒，我每词只剩 2 秒。
       两边看到「上一词结束」的时刻只差一次轮询（约 1 秒），各按各的本机钟算就是公平的。 */
    var base = Date.now();
    _rt = { idx: idx, answered: false, t0: Date.now(), deadline: base + span };

    paint('<div class="pr_top">'
      /* 🔴v1156：**比分行原来挤成一坨。**

         截图看到的是：「你 0⚡抢答赛0 小明」——
         我的分和模式名贴在一起，对手的分和名字也贴着，
         **完全看不出"谁 vs 谁、多少比多少"**。

         而这一行是对战屏最该一眼看懂的东西。

         改法：
           · 我方左、对手右，中间放模式徽章，三段之间给足间距
           · 比分数字放大到 22px 并用等宽数字（跳动时不会左右晃）
           · 名字压小压淡 —— 重点是分数不是名字
           · 名字过长时省略，不许把比分挤走 */
      /* ⚠️ 这一行不能继承 .pr_h 的 19px —— 那会把三段撑开，
         对手名字被挤成「小...」。这里字号由各段自己定。 */
      + '<div class="pr_h" style="display:flex;justify-content:space-between;'
      +   'align-items:center;gap:8px;font-size:14px;font-weight:600">'
      +   '<span style="flex:1;min-width:0;display:flex;align-items:baseline;gap:5px">'
      +     '<span style="font-size:12.5px;color:var(--pk-dim);flex:none">你</span>'
      +     '<b id="prMy" style="font-size:22px;font-variant-numeric:tabular-nums;'
      +       'display:inline-block">' + st.myScore + '</b>'
      +   '</span>'
      /* ⚠️ 模式徽章要能被挤掉，名字不能。
         宽度不够时优先保证「和谁打、多少分」——
         模式名是次要信息，用户点进来之前就选过了。 */
      /* 🔴v1156：**这个徽章太淡了。** 实测对比度 2.1（需 4.5）——
         灰字配几乎透明的底，等于没写。
         底色加深、字改回正常文字色。 */
      +   '<span style="flex:0 1 auto;min-width:0;overflow:hidden;font-size:11.5px;'
      +     'color:var(--pk-chip-txt);background:var(--pk-chip);'
      +     'padding:3px 9px;border-radius:99px;white-space:nowrap;'
      +     'text-overflow:ellipsis">' + esc(M.emoji || '') + esc(M.name || '') + '</span>'
      +   '<span style="flex:1 0 auto;min-width:0;display:flex;align-items:baseline;'
      +     'gap:5px;justify-content:flex-end">'
      +     '<b id="prOpp" style="font-size:22px;font-variant-numeric:tabular-nums;'
      +       'display:inline-block">' + st.oppScore + '</b>'
      +     '<span id="prOppName" style="font-size:12.5px;color:var(--pk-dim);overflow:hidden;'
      +       'text-overflow:ellipsis;white-space:nowrap">'
      +       esc(st.oppName || '对手') + '</span>'
      +   '</span>'
      + '</div>'
      + '<div class="pr_sub" style="display:flex;align-items:center;gap:8px">'
      +   '<span style="flex:1">第 ' + (idx + 1) + ' / ' + words.length + ' 词'
      +   ' · <span id="prClock">⏱ ' + (M.perWordSecs || 15) + 's</span></span>'
      /* 🔴审查 UI-1：对战屏要有一个看得见的「退出」—— 以前只能按手机的返回键，而那在首页外壳里什么都没结束 */
      +   '<button id="prQuit" class="pr_back" style="padding:6px 10px;min-height:36px;font-size:13px">退出</button>'
      + '</div></div>'

      /* 🔴v1102 两种出题形式：
           看中文 —— 显示中文 + 首字母提示
           听发音 —— **只给喇叭，屏幕上不出现这个词的任何线索**
                     （连首字母都不给，否则"听音拼词"就名存实亡） */
      + (askIsTts
          ? '<div style="margin:26px 0 10px;text-align:center">'
            + '<button id="prSpk" style="font-size:44px;background:none;border:0;cursor:pointer">🔊</button>'
            + '<div style="font-size:13px;color:var(--pk-dim);margin-top:6px">点喇叭再听一次</div></div>'
          : '<div class="pr_cn" style="font-size:34px;font-weight:800;color:var(--pk-txt);margin:22px 0 14px;line-height:1.25">' + esc(txtOf(w.cn)) + '</div>'
            + '<div class="pr_word" style="letter-spacing:6px;font-size:22px;color:var(--pk-hint)">'
            + esc(en.charAt(0)) + ' ' + '_ '.repeat(Math.max(0, en.length - 1)) + '</div>')
      /* 🔴v1118：**不弹系统输入法。**

         这是拼写游戏 —— 用系统键盘有三个问题：
           · 中文输入法要先切英文，慢一拍，抢答就输了
           · 键盘占掉半屏，对手状态和倒计时都看不见
           · 各家输入法的联想/自动纠错会替玩家"拼好"单词，那还练什么

         拼写蜂本来就用自己的 QWERTY 键盘（`.keyboard`/`.key` 那套），
         PK 照做 —— 玩法一致，手感也一致。

         `readonly` + `inputmode=none` 是让系统键盘不弹的可靠组合：
         单靠 readonly 在部分安卓输入法上仍会弹。 */
      + '<input class="pr_in" id="prIn" aria-label="在这里拼出这个单词" '
      +   'readonly inputmode="none" '
      +   'autocomplete="off" autocapitalize="off" '
      +   'autocorrect="off" spellcheck="false" placeholder="拼出这个词" '
      +   'style="font-size:20px;letter-spacing:2px;text-align:center">'
      + '<div id="prHint" style="min-height:24px;margin-top:10px;font-size:14px;color:var(--pk-dim)">'
      +   '对手：<span id="prOppSt">正在拼…</span></div>'
      + pkKeyboard());

    if (_kbKeyHandler) { try { document.removeEventListener('keydown', _kbKeyHandler); } catch (e) {} _kbKeyHandler = null; }
    bindKeyboard(en, idx);
    if (q('prQuit')) q('prQuit').onclick = function () { askQuit(); };

    /* 听发音模式：一进来就读一遍，点喇叭可重听 */
    if (askIsTts) {
      setTimeout(function () { speak(en); }, 220);
      var spk = q('prSpk');
      if (spk) spk.onclick = function () { speak(en); };
    }

    var input = q('prIn');
    if (input) {
      try { input.focus(); } catch (e) {}
      /* 🔴v1109：手机上软键盘弹出会占掉半屏，输入框可能被顶到看不见。
         聚焦后滚到可见位置 —— 对战是分秒必争的，看不见自己打了什么很致命。 */
      try {
        input.addEventListener('focus', function () {
          setTimeout(function () {
            try { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
          }, 260);
        });
      } catch (e) {}
      input.oninput = function () {
        /* 拼对即提交 —— 不用按回车，抢答讲的就是这一下 */
        var v = String(input.value || '').trim().toLowerCase();
        if (!_rt.answered && v === en.toLowerCase()) submitRound(idx, true);
      };
      input.onkeydown = function (ev) {
        if (ev.key !== 'Enter' || _rt.answered) return;
        var v = String(input.value || '').trim().toLowerCase();
        if (v === en.toLowerCase()) submitRound(idx, true);
        else {
          input.value = '';
          var h = q('prHint');
          if (h) { h.style.color = 'var(--pk-bad)'; h.textContent = '不对，再试试'; 
                   setTimeout(function () { if (h) { h.style.color = 'var(--pk-dim)';
                     h.innerHTML = '对手：<span id="prOppSt">正在拼…</span>'; } }, 900); }
        }
      };
    }

    /* 🔴v1120：**切后台时暂停倒计时。**

       实测：切到后台 2.5 秒再回来，倒计时从 14s 变成 11s ——
       **后台那段时间照样在扣。**
       用户接个微信消息回来，可能发现这词已经超时了，
       而他根本没机会答 —— 这不是他的错。

       手机上"打到一半被打断"是常态：来电话、微信消息、切出去查个词。
       做法：隐藏时记下剩余时间，回来时按剩余时间重设截止点。
       （对手那边的心跳照常，所以不影响掉线判定的公平性。） */
    /* 🔴v1126：**暂停只能给"宽限"，不能真的把时间还回去。**

       v1120 为了"切后台不该白扣时间"，做成了回来时按剩余时间续上。
       双人环境一验就发现问题：**A 切出去 30 秒回来还有 9 秒可答，
       而 B 那边早就超时了** —— 等于给切后台的人加时间，对手吃亏。

       改法：截止时间以**房间共享的 roundAt** 为准（两边一致），
       本地暂停只给一次**有限的宽限**（最多 3 秒），
       用来吸收"切回来那一下的操作延迟"，而不是补偿整段离开时间。

       这样：接个消息马上回来 → 几乎不吃亏；
             切出去很久 → 该超时还是超时，对手不吃亏。 */
    var GRACE_MS = 3000;
    var onVis = function () {
      if (!_rt || _rt.idx !== idx || _rt.answered) return;
      if (document.visibilityState === 'hidden') {
        _rt.hidAt = Date.now();
      } else if (_rt.hidAt) {
        var away = Date.now() - _rt.hidAt;
        _rt.hidAt = null;
        if (!_rt.graced) {
          _rt.graced = true;
          _rt.deadline += Math.min(away, GRACE_MS);   /* 宽限封顶 3 秒，且只给一次 */
        }
      }
    };
    try { document.addEventListener('visibilitychange', onVis); } catch (e) {}
    _rt.offVis = function () {
      try { document.removeEventListener('visibilitychange', onVis); } catch (e) {}
    };

    /* 倒计时 + 轮询对手 */
    _pollTimer = setInterval(function () {
      /* 🔴v1156：**注释说"时间不该白扣"，而实际是白扣了、只是不给你看。**

         原来只是 `return` 掉不更新显示，
         而 `_rt.deadline` 是一个绝对时刻 —— 它照样在走。
         实测：切走 8 秒再回来，倒计时从 19s 变成 13s，
         **实实在在少了 6 秒**。

         手机上切出去太常见了（来个消息、看一眼时间），
         回来发现时间被吃掉一大截，人是会恼的 ——
         尤其抢答赛本来就只有 20 秒。

         做法：切走时记下"还剩多少"，回来时把 deadline 顺延回去。
         对手那边不受影响（他的时间照常走），
         但至少我们不惩罚一个只是切出去看了眼消息的人。 */
      /* 🔴v1164（审查 UI-11）：**切后台的时间不整段还回去。** v1156 在这里把离开的时间全补上，
         把上面 v1126 定的「宽限最多 3 秒、只给一次」整个推翻了 —— 切出去 8 秒回来还剩满满的时间，
         对手那边早就超时了，他拼对的那一词就被我这边当成「后拼对」。现在只有 onVis 那 3 秒宽限。
         后台时不判超时（等回来那一下再判），也不刷显示。 */
      if (document.visibilityState === 'hidden') return;
      if (!_rt || _rt.idx !== idx) return;
      var left = Math.max(0, Math.ceil((_rt.deadline - Date.now()) / 1000));
      var c = q('prClock');
      if (c) {
        c.textContent = '⏱ ' + left + 's';
        /* 🔴v1156：**最后 5 秒要看得出来。**
           原来 19 秒和 2 秒长得一模一样，只有数字在变 ——
           而抢答赛里"还剩几秒"恰恰是最该让人有感觉的东西。
           红 + 轻微放大，不加动画帧（省电，也不抢注意力）。 */
        if (left <= 5 && left > 0) {
          c.style.color = 'var(--pk-bad)';
          c.style.fontWeight = '900';
          c.style.transform = 'scale(1.12)';
          c.style.display = 'inline-block';
          c.style.transition = 'transform .18s ease';
        } else {
          c.style.color = '';
          c.style.fontWeight = '';
          c.style.transform = '';
        }
      }
      if (left <= 0 && !_rt.answered) { submitRound(idx, false); return; }
      /* 🔴审查 R2-5（配额）：同步赛 / 回合赛这一词前 6 秒每秒看一次对手，之后两秒一次 ——
         这两种玩法翻篇看的是「两人都答完」，晚一秒看到对手没关系；抢答赛照旧每秒（谁先拼对要马上看到）。
         对战轮询占了一个班每天云端调用的八成。 */
      _rt.pn = (_rt.pn || 0) + 1;
      if (M.waitAll && Date.now() - _rt.t0 > 6000 && (_rt.pn % 2)) return;
      pollOpponent(idx);
    }, 1000);
  }

  /* 🔴v1104 对手掉线：**1 分钟没动静就判他负。**

     强退、掉线、关页面都会停掉他那侧的心跳。
     不立刻判，是因为手机切后台、接电话、网络抖一下都很常见 ——
     太敏感会把正常玩家误判成逃跑，那比等一分钟糟得多。

     用户看得见倒计时：「对手掉线了…45s 后判他负」，
     而不是干等着不知道发生了什么。 */
  var _goneChecked = 0;

  function checkOpponentAlive(idx, force) {
    var st = _state;
    if (!st || !st.roomId || st.roomId === 'test') return;
    if (!force && Date.now() - _goneChecked < 4000) return;    /* 4 秒查一次，别刷爆数据库 */
    _goneChecked = Date.now();
    S().opponentGone(st.roomId).then(function (g) {
      if (!stillLive(st)) return;
      if (!g) return;
      /* 🔴v1164（审查 F3）：对战中房间没了（房主那边已经收了）—— 以前这里直接 return，
         孩子看到的是一整局「网络不稳」、一个人拼完，最后「结果没拿到」 */
      if (!g.ok && g.gone) g = { ok: true, gone: true, left: true, roomGone: true };
      if (!g.ok) return;
      var el = q('prOppSt');
      /* 两边都判了对方离场（多半是两边一起断过网）→ 这局不算（审查 F4） */
      if (g.ended && g.void) {
        stopPoll();
        showResult({ result: 'void', byAbandon: true, mine: st.myScore, theirs: st.oppScore });
        return;
      }
      /* 🔴v1164（审查 F2）：对手已经判了「我离场」（我切后台太久）—— 两边按同一个结论收尾，
         不能让我回来接着一词一个「+100」，最后才说「判给了对手」 */
      if (g.ended && g.endedBy === 'abandon' && g.abandonWin && g.abandonWin !== (st.isHost ? 'host' : 'guest')) {
        stopPoll();
        showResult({ result: 'lose', byAbandon: true, mine: st.myScore, theirs: st.oppScore });
        return;
      }
      /* 🔴v1164（审查 F11）：房主撤回了我、换了别人 —— 这不是我的这一局，没有输赢，回去接着找 */
      if (g.kicked) {
        stopPoll(); stopKb();
        var ladK = !!st.ladder, ridK = st.roomId;
        _state = null;
        try { S().leaveRoom(ridK); } catch (e) {}
        if (ladK) { ladderBack('rematch', '房主那边没收到你的回应，这局没开成，接着帮你找…'); return; }
        lobby({ reason: '房主那边没收到你的回应，这一局没开成。换一间吧。' });
        return;
      }
      if (g.gone && !st._oppSeen && !g.oppSeen) {
        /* 🔴v1164：**对手根本没进来（一次都没报到）就不算赢。**
           客人刚抢到座位就退了、房主那边恰好已经点了头 —— 房主进了对战屏，对面是空的。
           原来 12 秒后判「对手已离场，本局你胜」：白送一局胜、排位还加分。
           现在：说清楚，房收掉，回去重新找（排位）/ 回列表（自由房）。 */
        stopPoll(); stopKb();
        var lad0 = !!st.ladder, rid0 = st.roomId;
        _state = null;
        try { S().leaveRoom(rid0); } catch (e) {}
        if (lad0) { ladderBack('rematch', '对手刚才没进来，接着帮你找…'); return; }
        lobby({ reason: '对手刚才没进来，这间房先关掉了。再开一间吧。' });
        return;
      }
      if (g.gone && g.mine) {
        /* 我这边已经判过了（对手离场）—— 直接按那个结论收尾 */
        stopPoll();
        showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true });
        return;
      }
      if (g.gone) {
        stopPoll();
        /* 🔴联机压力测试 R3：判离场那一条还没写上 —— 先别说「本局你胜」（写不上的话两边都会是「你赢了」） */
        if (!g.roomGone && el) { el.textContent = '📶 对手好像掉线了，正在确认这一局的结果…'; el.style.color = 'var(--pk-dim)'; }
        if (g.roomGone) {
          /* 房间已经没了（房主那边早就收了 —— 多半是我离开太久，结论已经出过了）：
             没地方读结论，也不能凭空算谁赢 → 这局不记分，说清楚 */
          showResult({ result: 'void', roomGone: true, mine: st.myScore, theirs: st.oppScore });
          return;
        }
        /* 🔴审查 F4：写完再读一次 —— 对手同时也判了我（两边都断过网）= 这局不算。
           🔴联机压力测试 R3：判离场的那一条**写上了**才算赢（claimAbandonSure）—— 以前写失败（又断网了）也显示「你赢了」，
           对手那边回来后照样判我离场，两部手机都是「你赢了」 */
        claimAbandonSure(st, function (w) {
          var res = (w.result === 'void' || w.result === 'lose') ? w.result : 'win';
          showResult({ result: res, mine: st.myScore, theirs: st.oppScore, byAbandon: true });
        });
        return;
      }
      if (!_rt || _rt.idx !== idx) return;
      /* 快到阈值了就提醒 —— 让人知道"不是卡住了，是对手没动" */
      var left = (g.limitSecs || 60) - (g.idleSecs || 0);
      if (el && g.idleSecs > 12 && left > 0) {
        el.textContent = '对手掉线了…' + left + ' 秒后判他负';
        el.style.color = 'var(--pk-warn)';
      }
    })['catch'](function () {});
  }

  /* 看对手抢到没有 —— 这是"对战感"的来源 */
  function pollOpponent(idx) {
    var st = _state;
    if (!st) return;
    checkOpponentAlive(idx);
    S().roundState(st.roomId).then(function (r) {
      if (!stillLive(st)) return;

      /* 🔴v1156：**对面换人了要说一声。**

         实测：房主把原来的 guest 踢掉、换另一个人进来，
         界面**毫无察觉** —— 还显示着原来那人的名字，
         而比分和输赢判定已经是新人的了。

         对战里"我在跟谁打"是最基本的信息，
         悄悄换掉比什么都不显示更糟：
         用户会以为是自己看错了，或者以为对手在作弊。

         记下第一次看到的对手 id，之后一变就明说。 */
      try {
        if (r && r.ok && typeof r.oppId === 'string') {
          if (!st._oppId && r.oppId) st._oppId = r.oppId;
          /* v1156: 记下对手分数，结算时算加减分要用。
             v1164：名字和分数都以房间合并视图为准（两边都给了），拿到就更新 ——
             原来 `if … else if` 写法让「对手换人」那条在拿到分数后永远进不去。 */
          if (Number(r.oppRating) > 0) st._oppRating = Number(r.oppRating);
          if (r.oppName && r.oppName !== st.oppName) {
            st.oppName = String(r.oppName);
            var _on = q('prOppName');
            if (_on) _on.textContent = st.oppName;
          }
          /* 对手真的进了对战屏（报过到 / 拼过词）—— 之后他不见了才算「离场」 */
          if ((r.mySide === 'host' ? r.guestReady : r.hostReady) || (r.winners || []).some(function (x) { return x && x !== r.mySide; })
              || Number(r.oppAns) >= 0 || Number(r.oppPts) > 0) st._oppSeen = true;
          if (st._oppId && r.oppId && r.oppId !== st._oppId && !st._oppSwapped) {
            st._oppSwapped = true;
            try {
              var _h = q('prHint');
              if (_h) _h.textContent = '👥 对手换人了 —— 这一局的比分是和新对手算的';
              if (window.HansenToast) HansenToast.say('👥 对手换人了');
            } catch (e2) {}
          }
        }
      } catch (e) {}
      /* 🔴v1154：**打到一半断网时，要让人知道。**

         实测：对战中断网，界面就一直停在"第 1/2 词 · ⏱ 10s"，
         倒计时照走、答了没反应，**用户完全不知道是网断了** ——
         这正是"突然就卡住"那种体验。

         而这里原来只是 `if (!r.ok) return;` 静静跳过，
         连续失败多少次都没人管。

         改为：连续 5 次拿不到房间状态（约 5 秒）就在顶上挂一条提醒，
         恢复了自动撤掉。**不打断对局** —— 网可能马上就回来，
         这时候把人踢出去比卡着更糟。 */
      /* 🔴审查 F3：房间读不到了（房主那边收了）—— 不是网的问题，别挂「网络不稳」，马上去判 */
      if (r && !r.ok && (r.gone || r.kind === 'gone')) { checkOpponentAlive(idx, true); return; }
      if (!r || !r.ok) {
        _netMiss = (_netMiss || 0) + 1;
        if (_netMiss === 5) {
          try {
            var bar = document.getElementById('prNetWarn');
            if (!bar) {
              bar = document.createElement('div');
              bar.id = 'prNetWarn';
              bar.setAttribute('style',
                'position:absolute;left:0;right:0;top:0;z-index:9;padding:7px 10px;'
                + 'background:#b45309;color:#fff;font-size:12.5px;text-align:center;'
                + 'font-weight:700');
              bar.textContent = '\ud83d\udcf6 网络不稳，正在重连…（进度不会丢）';
              var wrap = document.querySelector('.pr_wrap');
              if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(bar); }
            }
          } catch (e) {}
        }
        return;
      }
      /* 🔴v1154：**读到过期数据时，进度不能往回跳。**

         实测（云端返回旧文档：round 从 1 倒退回 0、winners 变空）：
         界面**倒回第 1 词**，已经答过的词又出现一遍。

         这在真网络下很常见：请求重传、CDN 缓存、多节点还没同步完，
         都会让某一次读取拿到旧快照。用户看到的是"打着打着退回去了"，
         比卡住还让人恼火 —— 因为他会以为刚才的分白拿了。

         做法：记下见过的最大回合号，**比它旧的整份丢弃**。
         对局进度天然只增不减，这条守得住。 */
      try {
        var _rd = Number((r.room && r.room.round) != null ? r.room.round : r.round);
        if (isFinite(_rd)) {
          if (_rd < (st.maxRound || 0)) return;      /* 旧快照：直接忽略 */
          st.maxRound = _rd;
        }
      } catch (e) {}

      if (_netMiss) {                       /* 通了：撤掉提醒 */
        _netMiss = 0;
        try { var ok0 = document.getElementById('prNetWarn'); if (ok0) ok0.remove(); } catch (e) {}
      }

      /* 🔴v1154：**对手的分从来没更新过 —— 永远显示 0。**

         两人真机对打实测抓到：
           A 答对第一词 → A 看到"你 100 | 0 对手" ✅
                        → B 看到"你 0 | 0 对手"  ❌（应该是对手 100）
         而房间里 `winners: ["host"]` 已经写对了，**只是没人拿它去算分**。

         查下来 `st.oppScore` 只在开局时被设成 0，**之后一次都没被赋值** ——
         也就是说"实时比分"这个功能从来只有一半：自己的分对，对手的永远是 0。

         比分是对战最核心的反馈，看不到对手分等于不知道自己是赢是输。

         修法：每次轮询时根据房间的 `winners` 重算对手得分 ——
         `winners[i]` 记的是第 i 词谁先拼对（'host'/'guest'），
         按当前模式的首答分/次答分折算。 */
      try {
        var _mm = (S() && S().modeOf) ? S().modeOf(st && st.mode)
                                      : { firstScore: 100, secondScore: 60 };
        /* 🔴v1163（加固扫描抓到，第二处）：**这里绕过了传输层的清洗。**

           上一轮我在 `roundState` 入口给 winners 加了三重清洗
           （不是数组当空、截到本局词数、每项只认 host/guest），
           但实测往云端写 `winners: new Array(9999).fill('host')` 之后，
           对手比分**仍然是 999900**。

           原因就在这一行：UI 层直接读 `r.room.winners` ——
           那是**原始房间数据**，根本没经过 roundState 的清洗。
           一个数据有两条路进来，我只堵了其中一条。

           > **在一个地方做了校验，不等于这个值是干净的。**
           > 要问的是：这个值还有没有别的入口？
           > 而最容易漏的入口，是"顺手直接读原始对象"那一条。

           这里重做一遍同样的清洗 —— 宁可重复，也不能有一条路是敞开的。 */
        var _ws = (r.room && r.room.winners) || r.winners || [];
        if (!Array.isArray(_ws)) _ws = [];
        var _wcap = (st && st.words && st.words.length) || 30;
        _wcap = Math.max(1, Math.min(30, _wcap));
        if (_ws.length > _wcap) _ws = _ws.slice(0, _wcap);
        var _meIsHost = !!(r.mySide ? r.mySide === "host" : st.isHost);
        var _opp = 0;
        for (var _i = 0; _i < _ws.length; _i++) {
          var _who = _ws[_i];
          if (!_who) continue;
          var _oppWon = _meIsHost ? (_who === 'guest') : (_who === 'host');
          if (_oppWon) _opp += (_mm.firstScore || 100);
        }
        /* v1164：B/C 后拼对的分只在对手自己记的总分里；比分只增不减。
           抢答赛也看（审查 F-R2-7：回合号被陌生人占满的那一词不分先后、拼对都算分，分只记在对手自己的文档上） */
        if (isFinite(Number(r.oppPts)) && Number(r.oppPts) > _opp) _opp = Number(r.oppPts);
        if (_opp < (st.oppScore || 0)) _opp = st.oppScore || 0;
        if (_opp !== st.oppScore) {
          var _gained = _opp > st.oppScore;
          st.oppScore = _opp;
          var _ob = q('prOpp');
          if (_ob) {
            _ob.textContent = String(_opp);
            /* 🔴v1156：**对手得分也要跳一下。**
               不然被反超了都没感觉 —— 而"对手追上来了"
               恰恰是最该让人紧张的信号。
               用橙色（不是绿色）：那是对手的分，不是好消息。 */
            if (_gained) {
              try {
                _ob.style.display = 'inline-block';
                _ob.style.transition = 'transform .16s ease, color .16s ease';
                _ob.style.transform = 'scale(1.35)';
                _ob.style.color = 'var(--pk-warn)';
                setTimeout(function () {
      if (!stillLive(st)) return;
                  try { _ob.style.transform = 'scale(1)'; _ob.style.color = ''; } catch (e) {}
                }, 260);
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
      /* 回合「结果待定」的那几词：现在知道是谁拿下了 → 把我的分补上（审查 F1） */
      settlePending(st, r);
      /* v1164 B/C：对手答到第几词、自己记的总分（含后拼对的 60/80） */
      if (r.oppAns != null && isFinite(Number(r.oppAns))) st.oppAns = Math.max(st.oppAns == null ? -1 : st.oppAns, Number(r.oppAns));
      oppPtsShow(st, r);
      if (!_rt || _rt.idx !== idx) return;
      /* v1126: 记下房间共享的回合开始时间，供下一回合算截止点 */
      if (r.roundAt) { st.roundAt = r.roundAt; st.roundIdxOfRoundAt = r.round; }
      var w = (r.winners || [])[idx];
      /* v1124: 空串表示"这一词谁都没拿下"(超时推进写的)，
         不能当成对手抢到 —— 否则会误报"⚡ 抢先拼对了！" */
      if (!w) return;
      /* 🔴v1122：`isHost` 可能没设（测试注入、或将来某条路径漏传）。
         那时按 host 判会把"对手抢到"误认成"我抢到"，界面就一直显示"正在拼…" ——
         用户完全看不出对手已经赢了这一回合。
         改为**优先用房间数据判断**，本地标记只做兜底。 */
      /* 房间数据里的 mySide 是服务端按 hostId 判的，最可信；
         本地 isHost 只做兜底（老版本的房间文档可能没这个字段）。 */
      var mySide = r.mySide || (st.isHost ? 'host' : 'guest');
      var oppGot = (w !== mySide);
      var el = q('prOppSt');
      var M = (S() && S().modeOf) ? S().modeOf(st && st.mode) : { waitAll: true };
      /* v1164：这一行前面是「对手：」—— 原来写的是「🔥 你抢先拼对！」，读出来成了「对手：你抢先拼对」 */
      if (oppGot && el && !_rt.answered) {
        el.textContent = M.waitAll && M.secondScore
          ? '⚡ 先拼对了 —— 你拼对还能得 ' + M.secondScore + ' 分'
          : '⚡ 先拼对了';
        el.style.color = 'var(--pk-warn)';
      }
      /* A 模式：对手抢到就立刻翻篇，不等我 */
      if (oppGot && !M.waitAll && !_rt.answered) { submitRound(idx, false, true); return; }

      /* 🔴v1164：**B/C 模式（waitAll）里对手先拼对，我还能接着拼 —— 不再被强行翻篇。**

         v1123 为了「B 卡在第 1 词、后面每一词都对不上、分数永远是 0」，
         改成了对手一拼对就把我也推到下一词。那个「对不上」是旧协议的毛病
         （抢答要求房间的回合号正好等于这一词，慢一拍就永远写不进去）。
         v1164 起每一词是一个独立的回合文档，慢几秒也照样记得上 ——
         而强行翻篇反倒让「后拼对 60 / 80 分」这条规则从来没兑现过：
         慢的那个孩子还在拼，词就被收走了，记 0 分。
         现在：对手先拼对，我这边提示一句、接着拼，到自己的截止时间为止（每词 15 秒）。 */
    })['catch'](function () {});
  }

  /* 🔴v1163（压力测试抓到，彻底修）：**这一局还在不在？**

     实测两条报错：
       Cannot read properties of null (reading 'mode')
       Cannot read properties of null (reading 'myScore')

     场景：客人中途退出、房主关房时 `_state` 被置空，
     而**已经飞出去的异步回调还会读它** ——
     `.then()` 和 `setTimeout()` 里捕获的 `st` 是那一刻的引用，
     等回调真正执行时，这一局可能早就结束了。

     全文扫下来这类地方有二十多处，逐个加 `if (!st)` 风险大（容易漏、容易改错）。
     所以给一个统一的判断：**回调开头问一句"这一局还是那一局吗"**。

     它比单纯的 `if (!st)` 严格一点 —— 还会比对 roomId：
     如果用户已经退出又开了新的一局，旧回调也不该再往界面上写东西
     （否则会出现"上一局的分数跳到这一局"这种鬼影）。

     > 拿到的东西可能已经过期了 ——
     > 异步回调里的每一个引用都要当"可能没了"来写。 */
  /* 抢写结果待定的词（回包丢了、读不回来）：之后的轮询看到这一词是谁拿下的，再补算我的分。
     🔴审查 F-R2-6：8 秒还是不知道 → 再写一次（同一个 _id、同一个 nonce：上一次其实写进去了就认得出是我的；
     真没写进去就这次写上 —— 没有别人先拼对的话，这一词就是我的）。以前就一直干等，一分钟后这一词白白作废。 */
  function pendGain(st, i, sc, first) {
    if (!sc) return;
    st.myScore += sc;
    st.st = st.st || { words: 0, correct: 0, totalMs: 0, firstWins: 0, fastestMs: 0 };
    if (first) st.st.firstWins++;     /* 拼对的那一次在提交时已经记过了 */
    var my = q('prMy'); if (my) my.textContent = st.myScore;
  }
  function retryPending(st, i) {
    st.pendTry = st.pendTry || {};
    /* 🔴联机压力测试 R12：以前只补写一次 —— 那一次碰上还没恢复的网，这一词就再也不补了。隔 8 秒可以再补 */
    if (st.pendTry[i] && Date.now() - st.pendTry[i] < 8000) return Promise.resolve(null);
    st.pendTry[i] = Date.now();
    st._retrying = (st._retrying || 0) + 1;
    var doneTry = function (x) { st._retrying = Math.max(0, (st._retrying || 1) - 1); return x; };
    return Promise.resolve().then(function () { return S().claimRound(st.roomId, i); }).then(doneTry, function (e) { doneTry(); throw e; }).then(function (r) {
      if (!st.pendingR || !(i in st.pendingR)) return null;      /* 轮询那边已经补过了 */
      if (!r || !r.ok || r.pending) return null;
      delete st.pendingR[i];
      pendGain(st, i, Number(r.score) || 0, !!r.first);
      return r;
    }, function () { return null; });
  }
  function settlePending(st, r) {
    try {
      var pend = st.pendingR || {}, ws = (r && r.winners) || [];
      var M = (S() && S().modeOf) ? S().modeOf(st && st.mode) : { firstScore: 100, secondScore: 0 };
      var mySide = r.mySide || (st.isHost ? 'host' : 'guest');
      Object.keys(pend).forEach(function (k) {
        var i = Number(k), w = ws[i];
        if (!w) {
          if (Date.now() - pend[k] > 8000) retryPending(st, i);
          /* 🔴联机压力测试 R12：不再一分钟就扔掉 —— 交卷前 resolvePending 还会再核对、再补写一次 */
          return;
        }
        delete pend[k];
        var gain = (w === mySide) ? (M.firstScore || 100) : (M.waitAll ? (M.secondScore || 0) : 0);
        try { S().settleRound(st.roomId, i, 0); } catch (e) {}
        pendGain(st, i, gain, w === mySide);
      });
    } catch (e) {}
  }
  /* 交卷前把还没定下来的词定下来（审查 FX-10：最后一词结果待定时，以前交上去的分里没有它 ——
     对手那边却给我记了这一词，结果可能翻过来）。最多等 capMs，等不到就按现有的分交 */
  function resolvePending(st, capMs) {
    var keys = Object.keys(st.pendingR || {});
    st._settleOffline = false;
    if (!keys.length) return Promise.resolve();
    var t0 = Date.now();
    var one = function (i) {
      return Promise.resolve().then(function () { return S().settleRound(st.roomId, i, 2500); }).then(function (r) {
        if (!st.pendingR || !(i in st.pendingR)) return null;
        var rk = r && !r.ok ? kindOf(r) : '';
        if (rk === 'network' || rk === 'slow') st._settleOffline = true;   /* 读不到：断网中 */
        if (r && r.ok && r.settled) { delete st.pendingR[i]; pendGain(st, i, Number(r.score) || 0, !!r.first); return null; }
        if (Date.now() - t0 > capMs) return null;
        if (st.pendTry) delete st.pendTry[i];   /* 联机压力测试 R12：交卷前一定再补写一次 */
        return retryPending(st, i);
      }, function () { return null; });
    };
    var all = Promise.all(keys.map(function (k) { return one(Number(k)); }));
    return Promise.race([all, new Promise(function (z) { setTimeout(z, capMs); })]);
  }

  function stillLive(st) {
    if (!st || !_state) return false;
    if (st !== _state) {
      /* 不是同一个对象了：只有房间号也一致才认（换过局就不认） */
      if (!st.roomId || st.roomId !== _state.roomId) return false;
    }
    return true;
  }

  function submitRound(idx, correct, forced) {
    if (!_rt || _rt.answered) return;
    _rt.answered = true;

    /* 🔴v1156：**提交之后要立刻给个反馈，别干等网络。**

       实测（每次请求延迟 3 秒的慢网络）：
       拼对了点提交，**6 秒里屏幕一点变化都没有** ——
       倒计时还停在 18s、提示还是"对手：正在拼…"。

       用户会以为按钮坏了，然后反复点。
       而抢答赛里这几秒恰恰是最紧张的时候。

       > 一个动作的反馈时间，不该取决于网络有多快。
       > 先告诉他"收到了"，结果慢慢来。 */
    try {
      var _h0 = q('prHint');
      if (_h0) _h0.textContent = '📨 已提交，正在和对手比…';
      var _in0 = q('prIn');
      if (_in0) _in0.disabled = true;
      var _kb0 = q('prKb');
      if (_kb0) _kb0.style.opacity = '.45';
    } catch (e) {}
    stopPoll();
    var st = _state;
    /* 🔴v1163（压力测试抓到）：**房间关了 _state 就没了，而这个回调还在飞。**

       实测报错：`Cannot read properties of null (reading 'myScore')`
       场景：客人中途退出、房主关房时，`_state` 被清空，
       但正在进行的提交/轮询回调还会读它。

       > 拿到的东西可能已经过期了 ——
       > 异步回调里的每一个引用都要当"可能没了"来写。

       这一局已经结束了，回调什么都不用做，直接退出。 */
    if (!st) return;
    var M = (S() && S().modeOf) ? S().modeOf(st && st.mode) : { firstScore: 100, secondScore: 60, waitAll: true };

    var after = function (gain, first, how) {
      st.myScore += gain;
      /* 🔴v1156：**得分要跳一下。**
         原来 +100 分是悄悄换个数字，抢答赛里手快抢到那一下
         是最有成就感的瞬间，不该一点动静都没有。
         只放大再回弹，不飘字 —— 飘字会挡住下一题。 */
      try {
        var _mb = q('prMy');
        if (_mb && gain > 0) {
          _mb.style.display = 'inline-block';
          _mb.style.transition = 'transform .16s ease, color .16s ease';
          _mb.style.transform = 'scale(1.45)';
          _mb.style.color = 'var(--pk-good)';
          setTimeout(function () {
      if (!stillLive(st)) return;
            try { _mb.style.transform = 'scale(1)'; _mb.style.color = ''; } catch (e) {}
          }, 260);
        }
      } catch (e) {}
      /* 🔴v1108 累计本局明细，结算时一起报给战绩 ——
         光有胜负说明不了"我强在哪"，得有速度和正确率。 */
      st.st = st.st || { words: 0, correct: 0, totalMs: 0, firstWins: 0, fastestMs: 0 };
      st.st.words++;
      if (gain > 0 || how === 'pending' || how === 'second') {
        var ms = Date.now() - _rt.t0;
        st.st.correct++;
        st.st.totalMs += ms;
        if (first) st.st.firstWins++;
        if (!st.st.fastestMs || ms < st.st.fastestMs) st.st.fastestMs = ms;
      }
      var my = q('prMy'); if (my) my.textContent = st.myScore;
      /* 本回合小结：让人看见"我快了多少" —— 这是正反馈 */
      var secs = ((Date.now() - _rt.t0) / 1000).toFixed(1);
      var h = q('prHint');
      if (h) {
        h.style.color = gain ? (first ? 'var(--pk-warn)' : 'var(--pk-ok)') : 'var(--pk-dim)';
        var word = ((_state.words || [])[idx] || {});
        /* 🔴v1102：本回合结束一定把答案亮出来 ——
           听发音模式下如果不显示，孩子拼错了都不知道正确答案是什么，
           那就失去了学习意义（这个 App 首先是用来学英语的）。 */
        var answer = ' 〔' + (word.en || '') + (word.cn ? ' ' + word.cn : '') + '〕';
        /* 🔴v1164（审查 UI-2）：拼对了就不会再显示「⏱ 超时了」—— 以前对手先超时写的那条，
           会让我钟上还剩 2 秒的正确答案被当成超时 0 分 */
        h.textContent = (gain
          ? ((first ? '🔥 你抢先拼对！' : '✅ 拼对了') + ' +' + gain + ' 分 · ' + secs + 's')
          : (how === 'second' ? '✅ 拼对了，可惜对手先拼对 · ' + secs + 's'
            : how === 'pending' ? '📨 拼对了，网络有点慢，分数马上补上'
            /* 审查安全 R2-1：拼对了却没记上分，只有真断网才说「网络不稳」（以前回合号被人占满也这么说） */
            : how === 'failed' ? '📶 网络不稳，这一词没记上'
            : how === 'failed-other' ? '这一词没记上，接着拼下一词吧'
            : how === 'ended' ? '这一局已经结束了'
            : (forced ? '对手抢先了' : '⏱ 超时了'))) + answer;
      }
      /* 抢答赛里拼对的那一方多停 0.7 秒再进下一词：对手要过一次轮询才看到这一词结束了，
         不补这一下，赢的人每一词都比对手早开拼（审查 F5） */
      var extra = (how === 'won' && !M.waitAll) ? 700 : 0;
      setTimeout(function () {
      if (!stillLive(st)) return; nextWord(st, idx, how); }, 1400 + extra);
    };

    if (!correct) {
      /* 🔴v1124：**没拼对也是这一词的结束**，对手要知道我答完了。
         🔴v1164：只在自己的文档上记「我答完第 i 词了」（skipRound），**不写回合文档** ——
         超时写的那条以前会抢走对手的「先拼对」（审查 F5/UI-2）。 */
      try {
        if (st && st.roomId && st.roomId !== 'test' && S().skipRound) {
          S().skipRound(st.roomId, idx)['catch'](function () {});
        }
      } catch (e) {}
      after(0, false, forced ? 'lost' : 'timeout'); return;
    }

    /* 🔴审查 FX-10：网慢时确认要几秒 —— 2.5 秒还没结果就先说一声，别让孩子对着「已提交」干等 */
    var slowT = setTimeout(function () {
      if (!stillLive(st) || !_rt || _rt.idx !== idx) return;
      var h1 = q('prHint');
      if (h1 && /已提交/.test(h1.textContent || '')) h1.textContent = '📨 网络有点慢，正在确认这一词…';
    }, 2500);
    S().claimRound(st.roomId, idx).then(function (r) {
      clearTimeout(slowT);
      if (!stillLive(st)) return;
      if (r && r.ok && r.pending) {
        /* 网断在半路：这一词是不是我先拼对还不知道 —— 先往下走，知道了再补分（审查 F1：以前直接记 0 分「超时了」） */
        st.pendingR = st.pendingR || {}; st.pendingR[idx] = Date.now();
        after(0, false, 'pending'); return;
      }
      if (r && !r.ok && r.ended) { after(0, false, 'ended'); checkOpponentAlive(idx, true); return; }
      if (!r || !r.ok) {
        /* 🔴联机压力测试 R5：没确认上不等于没写上（会话一时没好、回包丢了）—— 记成待定，轮询 / 交卷前再核对、再补写一次 */
        var fk = kindOf(r);
        if (fk === 'network' || fk === 'slow' || fk === 'session') { st.pendingR = st.pendingR || {}; st.pendingR[idx] = Date.now(); }
        after(0, false, (r && r.kind !== 'network' && r.kind !== 'slow') ? 'failed-other' : 'failed'); return;
      }
      var sc = Number(r.score) || 0;
      /* 回合号被人占满的那一词（审查 F-R2-7）：不分先后，拼对就算分；抢答赛要等对手也答完这一词再一起翻篇 */
      if (r.squatted) { after(sc, false, 'squat'); return; }
      after(sc, !!r.first, r.first ? 'won' : (sc ? 'second-scored' : 'second'));
    })['catch'](function () { clearTimeout(slowT); after(0, false, 'failed'); });
  }

  /* 🔴v1164 B/C「两人都答完才翻篇」：我答完了、对手还在拼这一词 → 等他。
     原来各翻各的：快的那位先跑到下一词，下一词的「抢先 100 分」就成了谁领先谁拿。
     最多等到这一词的截止时间再加 3 秒（对手断网也不会把我卡住）；最后一词不等，交卷屏会等。 */
  /* 🔴v1164（审查 F5/UI-2）：抢答赛里**超时**之后也要等对手答完这一词再翻篇 ——
     超时不再写回合文档，对手钟上可能还剩一两秒、还能拼对；我先跑去下一词的话，下一词我就先开拼了。
     有人拼对了（won / lost）= 这一词对两边都结束了，不用等。 */
  function nextWord(st, idx, how) {
    var M = (S() && S().modeOf) ? S().modeOf(st && st.mode) : { waitAll: false };
    var last = idx + 1 >= (st.words || []).length;
    var mustWait = M.waitAll || (how === 'timeout' || how === 'failed' || how === 'failed-other' || how === 'squat');
    if (!mustWait || last || !st.roomId || st.roomId === 'test' || (st.oppAns != null && st.oppAns >= idx)) {
      askRound(idx + 1); return;
    }
    var rt = _rt;
    var cap = Math.max((rt && rt.deadline) || 0, Date.now()) + 3000;
    var go = function () { if (stillLive(st) && _rt === rt) askRound(idx + 1); };
    var poll = function () {
      if (!stillLive(st) || _rt !== rt) return;
      if (Date.now() >= cap) { go(); return; }
      /* 秒数在走：孩子知道是在等对手，不是卡住了（提示行放在本词结果下面，下一词重画时自然消失） */
      try {
        var el = q('prWaitOpp'), h = q('prHint');
        if (!el && h && h.parentNode) {
          el = document.createElement('div');
          el.id = 'prWaitOpp';
          el.setAttribute('style', 'font-size:12.5px;color:var(--pk-dim);margin-top:4px;text-align:center');
          h.parentNode.insertBefore(el, h.nextSibling);
        }
        if (el) el.textContent = '⏳ 对手还在拼这一词，等他一下（最多 ' + Math.max(1, Math.ceil((cap - Date.now()) / 1000)) + ' 秒）';
      } catch (e) {}
      S().roundState(st.roomId).then(function (r) {
        if (!stillLive(st) || _rt !== rt) return;
        if (r && r.ok) {
          oppPtsShow(st, r);
          settlePending(st, r);
          /* 对手答完了这一词，或者这一词已经有人拼对了（抢答赛：对手在我超时后拼对的） */
          var oa = Number(r.oppAns);
          if (isFinite(oa)) st.oppAns = Math.max(st.oppAns == null ? -1 : st.oppAns, oa);
          if (!M.waitAll && (r.winners || [])[idx]) {
            /* 🔴审查 R2-UI-10：我超时以后对手拼对了这一词 —— 他那边要停 2.1 秒才进下一词；
               我以前一看到就马上开下一词，每次都比他早开拼 1 秒多。和「对手抢先了」那条路一样停 1.4 秒。
               ⚠️ 要先看这一条：对手拼对时也记了「我答完第 i 词」，先看「答完了」就又马上翻篇了 */
            if (!rt._oppWonAt) { rt._oppWonAt = Date.now(); setTimeout(go, 1400); }
            return;
          }
          if (oa >= idx) { go(); return; }
        }
        setTimeout(poll, 900);
      }, function () { setTimeout(poll, 900); });
    };
    poll();
  }
  /* B/C 里对手后拼对的 60/80 分不写进回合文档 —— 用对手自己记的总分（只增不减） */
  function oppPtsShow(st, r) {
    var n = Number(r && r.oppPts);
    if (!isFinite(n) || n <= (st.oppScore || 0)) return;
    st.oppScore = n;
    var ob = q('prOpp');
    if (ob) ob.textContent = String(n);
  }

  function finish() {
    var st = _state;
    if (!st) return;
    stopPoll(); stopKb();
    var secs = Math.max(1, Math.round((Date.now() - st.startAt) / 1000));
    var pendN = Object.keys(st.pendingR || {}).length;

    /* 🔴v1122：**改用回合制的实际得分。** 改了计分方式，就要顺着链条查到最后一环。 */
    var stat = st.st || { words: 0, correct: 0 };
    var line = function () {
      return '你答对 ' + stat.correct + ' / ' + (st.words || []).length
        + ' 个，得 ' + (Number(st.myScore) || 0) + ' 分，用时 ' + secs + ' 秒。';
    };
    st.finished = true;
    paint('<div class="pr_top"><div class="pr_h">📨 交卷了</div></div>'
      + '<div class="pr_empty"><span id="prResLine">' + line() + '</span><br>'
      + '<span id="prResWho">' + (pendN ? '正在确认最后一词的分…' : '正在等对手交卷…') + '</span></div>'
      /* v1164：同步赛 / 回合赛里两人各有每词 15 秒，快的那位可能要等慢的一两分钟 ——
         让他看见时间在走、知道对面还在拼（不动的等待屏和死掉的界面没区别，看门狗也会当成卡住） */
      + '<div id="prResWait" style="text-align:center;font-size:12.5px;color:var(--pk-dim);margin-top:6px">'
      +   '已等 0 秒</div>'
      /* 审查 UI-1：等交卷这一屏也要能走。🔴审查 R2-UI-4/FX-5：已经交了卷，走了**不算认输** ——
         结果在后台接着等，出来了照样记进战绩（以前点了它，赢了的一局就没了，对话框还说「就算对手赢」） */
      + '<button class="pr_btn pr_btn2" id="prQuit" style="margin-top:16px">先离开，结果出来会自动记上</button>');
    if (q('prQuit')) q('prQuit').onclick = function () { askQuit(); };
    startTicker('prResWait', Date.now(), function (sec) {
      return '已等 ' + sec + ' 秒' + (sec >= 8 ? ' · 对手可能还在拼后面几个词' : '');
    });
    _waitResult = 0; _resultFail = 0;
    /* 🔴v1164：第一次交卷失败也走同一条重试路（原来 `!r.ok` 直接回列表，这一局就白打了）。
       🔴审查 FX-10：最后一词「结果待定」的，先定下来再交（最多 8 秒）—— 不然交上去的分里没有它 */
    /* 🔴联机压力测试 R4：交卷时还有没定下来的词（正好断网 / 补写还在路上）—— 接着核对、补写（每 2 秒，最多 60 秒），
       定下来再交；以前 8 秒一到就按少了这几词的分交，分后来才补上（交上去的还是少的那个分） */
    var tFin = Date.now();
    var settle = function () { return resolvePending(st, 8000).then(function () {
      if (!stillLive(st)) return 'gone';
      /* 断网时等网通；网通了也要等补写的结果回来（不然交上去的分里还是没有它）—— 都以 60 秒为限 */
      if (Object.keys(st.pendingR || {}).length && (st._settleOffline || st._retrying > 0) && Date.now() - tFin < 60000) {
        return new Promise(function (z) { setTimeout(z, 2000); }).then(settle);
      }
    }); };
    settle().then(function (gone) {
      if (gone === 'gone' || !stillLive(st)) return;
      var el = q('prResLine'); if (el) el.textContent = line();
      var who = q('prResWho'); if (who) who.textContent = '正在等对手交卷…';
      st.finalScore = Number(st.myScore) || 0;
      st._resWaitT0 = Date.now();   /* 联机压力测试 D2：等交卷 5 分钟封顶从这里算 */
      pollResult(st, st.finalScore);
    });
  }

  /* 交卷 + 等对手交卷。st 是这一局的状态 ——
     🔴v1164：原来这里用了一个没定义的 `st`（只传了 roomId），一断网就 ReferenceError，
     等交卷这条链当场断掉，人卡在「正在等对手交卷…」。 */
  function pollResult(st, score) {
    if (!stillLive(st)) return;
    S().reportResult(st.roomId, score).then(function (r) {
      if (!stillLive(st)) return;
      if (!r || !r.ok) {
        /* 🔴v1164：**交卷失败先重试，不立刻放弃。** 网抖一下就把人甩回列表，
           这一局的战绩和天梯分就都没了。登录过期、云端设置不对这种重试也没用 —— 直接说。 */
        _resultFail = (_resultFail || 0) + 1;
        var k = kindOf(r);
        if (_resultFail < 5 && k !== 'expired' && k !== 'config') {
          setTimeout(function () { pollResult(st, score); }, 2000);
          return;
        }
        resultFailed(st, r || { ok: false, reason: '交卷没成功' });
        return;
      }
      _resultFail = 0;
      if (r.waiting) {
        /* 🔴v1154：**等对手交卷不能没有上限。**
           给 45 秒：正常情况下对手交卷只要几秒。
           v1164：到点先问一句对手还在不在 —— 还在（心跳在跳，只是慢）就再多等一会儿，
           真不在了才判离场，并且把「离场」写进自己的文档，两边看到同一个结论。 */
        _waitResult = (_waitResult || 0) + 1;
        if (_waitResult > 22) {                 /* 22 次 × 2 秒 ≈ 45 秒 */
          checkStillThere(st, score);
          return;
        }
        setTimeout(function () { pollResult(st, score); }, 2000);
        return;
      }
      _waitResult = 0;
      /* 对手离场判的胜负：比分显示这一局实际拿到的分（数据层那边是 1:0 的记号）；两边都判了 = 这局不算 */
      /* 🔴联机压力测试 R10：交卷时数据层说「对手走了，你赢」—— 可他一次都没进过对战屏：这局不算 */
      if (r.byAbandon && r.oppLeft && !st._oppSeen) { neverCame(st); return; }
      if (r.byAbandon) r = { ok: true, result: r.result, byAbandon: true,
                             mine: st.myScore, theirs: st.oppScore };
      showResult(r);
    })['catch'](function () {
      /* 网络抖动也算一次等待，别让异常把这条链断掉 */
      _waitResult = (_waitResult || 0) + 1;
      if (_waitResult > 22) { checkStillThere(st, score); return; }
      setTimeout(function () { pollResult(st, score); }, 2500);
    });
  }

  /* 等了 45 秒还没交卷：对手还在就再等（最多约 2 分钟），不在了就判他离场 */
  function checkStillThere(st, score) {
    var give = function (g) {
      _waitResult = 0;
      /* 🔴联机压力测试 R10：对手根本没进过对战屏（没报到、没答过词）—— 他走了不算「离场」，这局不算，别白送一局胜 */
      if (!st._oppSeen && !(g && g.oppSeen)) { neverCame(st); return; }
      /* 🔴联机压力测试 R3：判离场写上了才算赢 */
      claimAbandonSure(st, function (w) {
        var res = (w.result === 'void' || w.result === 'lose') ? w.result : 'win';
        showResult({ ok: true, result: res, byAbandon: true, mine: score, theirs: 0 });
      });
    };
    S().opponentGone(st.roomId).then(function (g) {
      if (!stillLive(st)) return;
      var alive = g && g.ok && !g.gone && (g.idleSecs || 0) < 30;
      /* B/C 模式两人各拼各的，慢的那位最多可能晚 10 词 × 15 秒 —— 心跳还在跳就等够它（5 分钟封顶）。
         🔴联机压力测试 D2：按交卷以后过了多久封顶（以前数的是轮询次数：网慢时一次要 6 秒多，150 次 = 16 分钟） */
      if (alive && Date.now() - (st._resWaitT0 || Date.now()) < 300000) { setTimeout(function () { pollResult(st, score); }, 2000); return; }
      give(g);
    }, function () { give(null); });
  }
  /* 联机压力测试 R10：对手一次都没进过对战屏 —— 不判输赢，说清楚，回列表 / 天梯 */
  function neverCame(st) {
    var lad0 = !!(st && st.ladder), rid0 = st && st.roomId;
    stopPoll(); stopTicker();
    _state = null;
    if (rid0) { try { S().leaveRoom(rid0); } catch (e) {} }
    if (lad0) { ladderBack('rematch', '对手刚才没进来，接着帮你找…'); return; }
    lobby({ reason: '对手刚才没进来，这间房先关掉了。再开一间吧。' });
  }
  /* 联机压力测试 R3：判对手离场 —— 写上了才算数；写不上（网又断了）每 3 秒再试，6 次还不行就说「结果没拿到」 */
  function claimAbandonSure(st, onOk) {
    var n = 0;
    var again = function (w) {
      if (!stillLive(st)) return;
      var k = kindOf(w);
      if (++n < 6 && k !== 'expired' && k !== 'config') { setTimeout(go, 3000); return; }
      resultFailed(st, (w && w.ok === false) ? w : { ok: false, reason: '网络不稳，这一局的结果没记上' });
    };
    var go = function () {
      if (!stillLive(st)) return;
      Promise.resolve().then(function () { return S().claimAbandonWin(st.roomId); }).then(function (w) {
        if (!stillLive(st)) return;
        /* 对手其实交了卷（数据层按两边真分数算出的结论）：照真分数显示，不是「对手离场」 */
        if (w && w.ok && w.real) { showResult({ ok: true, result: w.result, mine: w.mine, theirs: w.theirs }); return; }
        if (w && w.ok) { onOk(w); return; }
        again(w);
      }, function (e) { again({ ok: false, reason: String((e && e.message) || e || '') }); });
    };
    go();
  }

  /* 结果实在拿不到：说清楚，并给回去的路（排位回天梯，自由房回列表） */
  function resultFailed(st, r) {
    var lad = !!(st && st.ladder);
    var rid = st && st.roomId;
    _state = null;
    if (rid) { try { S().leaveRoom(rid); } catch (e) {} }
    paint('<div class="pr_top"><div class="pr_h">📨 这一局的结果没拿到</div></div>'
      + errBlock(r)
      + '<div class="pr_empty" style="font-size:13px">网好了以后，下一局会照常记分。</div>'
      + '<button class="pr_btn" id="prResBack">' + (lad ? '← 回天梯' : '← 回到房间列表') + '</button>');
    wireErr();
    if (q('prResBack')) q('prResBack').onclick = function () {
      if (lad) { ladderBack('home', ''); return; }
      lobby();
    };
  }

  /* ── 🔴v1156 结算屏：本局打得怎么样 ────────────────

     原来结算屏只说"你赢了 / 200 : 100 / +15 天梯分"，
     **对刚才那一局本身一个字都没有** ——
     答对几个、多快、抢先几次，数据全在 `st` 里躺着，就是不给人看。

     而"刚打完那一刻"恰恰是最想知道自己表现的时候：
     赢了想知道赢在哪，输了想知道差在哪。
     等回到天梯页看的是"总战绩"，那已经把这一局稀释掉了。 */
  function thisGameBlock() {
    try {
      var st = (_lastStats || {});
      var w = Number(st.words) || 0;
      if (!w) return '';                       /* 没数据就不画空壳 */
      var c = Number(st.correct) || 0;
      var ms = Number(st.totalMs) || 0;
      var fw = Number(st.firstWins) || 0;
      var fast = Number(st.fastestMs) || 0;
      var avg = c > 0 ? (ms / c / 1000) : 0;

      var cell = function (label, val, tip) {
        return '<div style="flex:1;min-width:0;text-align:center;padding:7px 4px">'
          + '<div style="font-size:11px;color:var(--pk-dim);white-space:nowrap">' + label + '</div>'
          + '<div style="font-size:17px;font-weight:900;margin-top:2px">' + val + '</div>'
          + (tip ? '<div style="font-size:10.5px;color:var(--pk-dim);margin-top:1px;'
                   + 'white-space:nowrap">' + tip + '</div>' : '')
          + '</div>';
      };
      return '<div style="margin:10px 0;padding:4px;border-radius:13px;'
        +   'background:rgba(255,255,255,.06)">'
        +   '<div style="font-size:11.5px;color:var(--pk-dim);text-align:center;'
        +     'padding:5px 0 1px">这一局</div>'
        +   '<div style="display:flex">'
        +     cell('答对', c + '<span style="font-size:12px;opacity:.7">/' + w + '</span>',
                   Math.round(c / w * 100) + '%')
        +     cell('抢先', fw + '<span style="font-size:12px;opacity:.7">次</span>',
                   c > 0 ? Math.round(fw / c * 100) + '%' : '—')
        +     cell('平均', avg > 0 ? avg.toFixed(1) + '<span style="font-size:12px;opacity:.7">秒</span>' : '—',
                   '每个词')
        +     cell('最快', fast > 0 ? (fast / 1000).toFixed(1) + '<span style="font-size:12px;opacity:.7">秒</span>' : '—',
                   '这局最快')
        +   '</div>'
        + '</div>';
    } catch (e) { return ''; }
  }

  /* 🔴v1156：结算屏也给一句"离升段还差多少"。
     天梯页有，这里没有 —— 而**刚赢完恰恰是最想知道这个的时刻**，
     那是"再来一局"最强的理由。 */
  function nextTierLine() {
    try {
      var R = window.HansenPkRecord, L = window.HansenSbLadder;
      if (!R || !L || !L.nextTierOf) return '';
      var sm = R.summary();
      if (!sm || !sm.placed) return '';
      var nx = L.nextTierOf(sm.rating);
      if (!nx) return '';
      /* 🔴v1156：**「下一步」要和「结果」分层。**

         原来这行和上面的"总战绩"字号一样、颜色一样，
         用户分不出哪个是"刚才发生了什么"、哪个是"接下来能做什么"。

         而"还差 95 分就升段"是这一屏最有行动力的一句话 ——
         它该被看见，而不是混在战绩里。

         给它一个浅色胶囊底，和上面的灰字拉开层次。 */
      return '<div style="text-align:center;margin:10px 0 12px">'
        + '<span style="display:inline-block;font-size:13px;'
        +   'background:rgba(99,102,241,.16);border:1px solid rgba(139,92,246,.3);'
        +   'padding:7px 14px;border-radius:99px;line-height:1.5">'
        +   '距离 ' + nx.icon + ' ' + esc(nx.name)
        +   ' 还差 <b style="color:var(--pk-accent)">' + nx.need + '</b> 分'
        +   ' <span style="opacity:.75">· 约 ' + Math.max(1, Math.ceil(nx.need / 18))
        +   ' 局</span>'
        + '</span></div>';
    } catch (e) { return ''; }
  }

  /* v1156: 把可能不是数字的东西变成一个能看的数字 */
  /* 🔴v1156：**题目文字也要防非字符串。**

     实测（词表里 cn 是一个对象、en 是数字）：
     题目直接显示成 `[object Object]`。

     词表来自云端和本地缓存，两边都可能因为版本不一致、
     迁移写坏而带进奇怪的值 —— **界面不该假设它一定是字符串**。

     对象/数组一律当空（显示不出来总好过显示 [object Object]），
     数字转成字符串（那至少还是个能看的东西）。 */
  function txtOf(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' && isFinite(v)) return String(v);
    return '';
  }

  function numOr0(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n);
  }

  /* 把一局记进战绩 + 传榜（结算屏、中途退出、交了卷先离开后补记都走这里 —— 审查 R2-UI-4/FX-6）。
     一局只记一次。传榜只在这里传、不主动轮询；传失败不影响任何事（下次打开天梯页会补传）。 */
  function recordGame(st, r) {
    var R = window.HansenPkRecord;
    if (!R || !st || !r || r.result === 'void' || st._recorded) return null;
    st._recorded = true;
    try {
      setTimeout(function () {
        try {
          if (window.HansenLadderBoard && HansenLadderBoard.push) Promise.resolve(HansenLadderBoard.push()).then(function (pr) {
            if (pr && pr.ok === false && !pr.skipped) console.warn('[天梯榜] 这局的分没传上榜，下次打开天梯页会补传：' + String(pr.reason || '').slice(0, 120));
          })['catch'](function () {});
        } catch (e) {}
      }, 300);
    } catch (e) {}
    var s2 = st.st || {};
    return R.record({
      result: r.result,
      mode: st.mode || _pickedMode,
      oppName: st.oppName || '对手',
      /* 🔴v1156：**把对手分数传给战绩，别让它默认成 1000** —— 排位的意义有一半在于「赢强的人涨得多」 */
      oppRating: st._oppRating || 0,
      myScore: r.mine, oppScore: r.theirs,
      words: s2.words || 0, correct: s2.correct || 0, totalMs: s2.totalMs || 0,
      firstWins: s2.firstWins || 0, fastestMs: s2.fastestMs || 0
    });
  }

  /* 已经交了卷、不想干等的孩子点了「先离开」：结果在后台接着等，出来了照样记进战绩（审查 R2-UI-4/FX-5）。
     最多等 6 分钟（同步赛 / 回合赛对手最多还要 10 词 × 15 秒）；对手的心跳停了一分钟 → 和结算屏同一条规则判离场。
     页面关掉了就没法记了（那一局只在对手那边有结论）。 */
  function bgSettle(st) {
    if (!st || !st.roomId || st.roomId === 'test' || st._bg) return;
    st._bg = true;
    /* 每次都按这一刻的分交（最后一词「结果待定」后来补上了的话，交的就是补上以后的分） */
    var scoreNow = function () { return Number(st.finalScore != null ? st.finalScore : st.myScore) || 0; };
    var score = scoreNow();
    var t0 = Date.now(), n = 0, fin = false;
    var done = function (r) {
      if (fin || !r) return;
      fin = true;
      var rr = r.byAbandon ? { result: r.result, mine: score, theirs: (r.result === 'win') ? 0 : (Number(st.oppScore) || 0) } : r;
      if (rr.result === 'void') return;
      try { recordGame(st, rr); } catch (e) {}
      try {
        var txt = rr.result === 'win' ? '你赢了 🎉' : (rr.result === 'lose' ? '这局输了' : '打平');
        if (window.HansenToast && HansenToast.say) HansenToast.say('刚才那一局：' + txt + '（' + numOr0(rr.mine) + ' : ' + numOr0(rr.theirs) + '），已经记进战绩');
      } catch (e) {}
    };
    var next = function (ms) { if (!fin) setTimeout(step, ms); };
    var step = function () {
      if (fin || Date.now() - t0 > 6 * 60000) return;
      n++;
      score = scoreNow();
      S().reportResult(st.roomId, score).then(function (r) {
        if (r && r.ok && !r.waiting) { done(r); return; }
        if (!(r && r.ok && r.waiting) || n % 8 !== 0) { next(4000); return; }
        S().opponentGone(st.roomId).then(function (g) {
          if (!(g && g.ok && g.gone && !g.oppFinished)) { next(4000); return; }
          /* 🔴联机压力测试 R3：写上了才算赢；写不上接着等（以前直接记一场「赢」） */
          S().claimAbandonWin(st.roomId).then(function (w) {
            if (!(w && w.ok)) { next(4000); return; }
            if (w.real) { done({ ok: true, result: w.result, mine: w.mine, theirs: w.theirs }); return; }
            done({ result: (w.result === 'void' || w.result === 'lose') ? w.result : 'win', byAbandon: true });
          }, function () { next(4000); });
        }, function () { next(4000); });
      }, function () { next(6000); });
    };
    step();
  }

  function showResult(r) {
    stopTicker();
    /* v1104：对手离场赢的要说清楚 —— 不能让人以为自己实打实赢了 */
    /* v1164：「离场」也可能是我这边 —— 切后台太久被判了负，不能说成「本局你胜」 */
    /* 🔴v1164（审查 F4）：两边都判了对方离场（一起断过网）→ 这局不算，谁都不记胜负 */
    var isVoid = r.result === 'void';
    var txt = (isVoid && r.roomGone) ? '⌛ 这一局已经结束了（房间已经关了），不记分'
            : isVoid ? '🤝 这局不算（两边都断过网），不记分'
            : (r.byAbandon && r.result === 'lose') ? '⌛ 你离开太久，这局判给了对手'
            : r.byAbandon ? '🏆 对手已离场，本局你胜'
            : (r.result === 'win' ? '🎉 你赢了！' : (r.result === 'lose' ? '💪 这局输了' : '🤝 打平'));
    /* 这一局是不是排位来的 —— 决定「再来一局」和「返回」去哪 */
    var wasLadder = _state ? !!_state.ladder : _cameFromLadder;

    /* 🔴v1103：**打完必须留下痕迹** —— 赢了没记录，那为什么要打？
       只有 A 抢答赛动天梯分（v1100 定的规矩：排位就该纯竞技），B/C 只记战绩。 */
    var rec = null;
    try { _lastStats = Object.assign({}, (_state && _state.st) || {}); } catch (e) {}
    try { if (!isVoid) rec = recordGame(_state, r); } catch (e) {}
    hideQuit();

    var extra = '';
    if (rec) {
      var sm = window.HansenPkRecord.summary();
      var dTxt = '';
      if (rec.ranked && rec.delta) {
        dTxt = '<div style="font-size:20px;font-weight:800;margin:8px 0 2px;text-align:center;color:'
             + (rec.delta > 0 ? 'var(--pk-ok)' : 'var(--pk-bad)') + '">'
             + (rec.delta > 0 ? '+' : '') + rec.delta + ' 天梯分</div>';
      } else if (rec.ranked && rec.floorSaved) {
        /* 🔴v1128：**输了但没掉分，要说明白为什么。**
           段位地板保护住了他 —— 那是好事，
           但界面一声不吭的话，用户只会以为记分坏了。 */
        dTxt = '<div style="font-size:15px;font-weight:700;margin:6px 0;color:var(--pk-warn)">'
             + '🛡 段位保护：这局没掉分</div>';
      } else if (rec.ranked) {
        dTxt = '<div style="font-size:13px;color:var(--pk-dim);margin:4px 0">天梯分没有变化</div>';
      } else if (!rec.ranked) {
        dTxt = '<div style="font-size:12.5px;color:var(--pk-dim);margin:4px 0">'
             + '本局不计天梯（只有 ⚡ 抢答赛计分）</div>';
      }
      extra = dTxt
        + '<div style="font-size:13px;color:var(--pk-txt);margin-top:8px">'
        +   rec.tier.emoji + ' ' + esc(rec.tier.name) + ' · ' + esc(rec.tier.sub) + '<br>'
        +   '总战绩 ' + sm.wins + ' 胜 ' + sm.losses + ' 负'
        +   (sm.total ? ' · 胜率 ' + sm.winRate + '%' : '')
        +   (sm.streak >= 2 ? ' · 🔥 ' + sm.streak + ' 连胜' : '')
        + '</div>';
    }

    paint('<div class="pr_res">' + txt + '</div>'
      /* 🔴v1156：**云端来的比分要清洗，不能直接拼进页面。**

         实测（云端返回畸形数据：hostScore 是 undefined、guestScore 是字符串"一百"）：
         结算屏显示成「你 分 · 对手 一百 分」——
         我方那个数字位置**整个空掉**，而对方把字符串原样印了出来。

         用户看到这种东西只会觉得"这游戏坏了"。
         而云端数据本来就可能因为版本不一致、迁移中断、别人写坏而畸形 ——
         **界面不该假设它一定是数字。**

         > 凡是从别处拿来、要直接显示给用户的数字，
         > 都要问一句：它要是不是数字怎么办？ */
      + '<div class="pr_empty">你 ' + numOr0(r.mine) + ' 分 · 对手 '
      +   numOr0(r.theirs) + ' 分</div>'
      + thisGameBlock()
      + extra
      + nextTierLine()
      + '<button class="pr_btn" id="prAgain">再来一局</button>'
      + '<button class="pr_btn pr_btn2" id="prBack2">' + (wasLadder ? '← 回天梯' : '← 回到房间列表') + '</button>');
    var rid = _state && _state.roomId;
    _state = null;
    stopPoll(); stopKb();
    /* v1164：离开 = 房主把房标成「打完了」、客人把座位标成「走了」——都只改自己的文档；
       房间留 2 分钟再清，晚交卷的那一方还读得到结果 */
    if (rid) { try { S().leaveRoom(rid); } catch (e) {} }
    _cameFromLadder = wasLadder;
    /* 🔴v1156：**两个 bug 一起修。**

       ① `onclick = lobby` 会把**点击事件对象**当成 `err` 传进去，
          于是 `errBlock(event)` 把 `{"isTrusted":false}` 画到屏上 ——
          用户打完一局，看到的是一串乱码。
          这类"把处理函数直接当 onclick"的写法，只要那个函数有参数，
          就一定会中招。**必须包一层。**

       ② 排位打完点「再来一局」，跳到的是「公开房间列表」——
          而他刚才是从天梯来的，想要的是**再排一局**，
          不是自己去房间列表里挑。
          排位和自由房是两条路，回哪条该看他是从哪来的。 */
    if (q('prAgain')) {
      q('prAgain').onclick = function () {
        if (_cameFromLadder) {
          _cameFromLadder = false;
          try {
            close();
            if (window.HansenLadderUI && HansenLadderUI.open) {
              HansenLadderUI.open();
              /* 直接开始找下一个对手 —— 他点「再来一局」就是这个意思 */
              setTimeout(function () {
                try {
                  var go = document.getElementById('ldGo');
                  if (go) go.click();
                } catch (e) {}
              }, 260);
            }
            return;
          } catch (e) {}
        }
        lobby();                       /* 自由房来的：回房间列表 */
      };
    }
    if (q('prBack2')) q('prBack2').onclick = function () {
      if (_cameFromLadder) { _cameFromLadder = false; ladderBack('home', ''); return; }
      lobby();
    };
  }

  /* 🔴v1108 天梯专用入口：排位固定用 A 抢答赛，玩家不能选模式。
     这是 v1100 定下的规矩 —— 排位就该是纯竞技。 */
  /* 🔴v1154：**先把对战界面打开，再建房。**

     用户现场：「天梯功能根本用不了。」

     真跑一遍抓到的：点「开始排位」→ 等 20 秒没找到对手 →
     天梯层 `close()` 掉、`_createForLadder` 建了房（数据库里确实多了一间），
     **但屏幕一片空白** —— 因为 `doCreate()` 只负责建房，
     渲染「正在等对手」那一屏依赖 UI 已经打开，
     而这条路上从来没人调用过 `open()`。

     更糟的是外层包着 `try/catch`，**报错被吞掉了** ——
     所以控制台干干净净，只有用户看到白屏。
     （这也是为什么它能一直坏着没被发现。）

     `_joinForLadder` 同理：直接 `doJoin` 而界面没开，
     进去了也看不见。

     修法：两条路都先 `open()` 再动作。 */
  var _fromLadder = false;
  var _cameFromLadder = false;   /* v1156: 打完后「再来一局」该回哪 */

  function _createForLadder(rating, opts) {
    opts = opts || {};
    _cameFromLadder = true;
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('开排位房'); } catch (e) {}
    _pickedMode = 'A'; _wantPrivate = false; _fromLadder = true;
    try {
      var _h = host();
      if (_h) {
        _h.classList.add('on');
        /* 审查 R2-UI-6：网慢时这一屏要停好几秒 —— 给一个「取消」，别让孩子只能按手机的返回键 */
        _h.innerHTML = '<div class="pr_wrap">'
          + '<div class="pr_empty" style="padding:30px 12px">⏳ 正在开房间…<br>'
          + '<span style="font-size:12.5px">网慢的时候要等几秒</span></div>'
          + '<button class="pr_btn pr_btn2" id="prCreateCancel">取消，回天梯</button></div>';
      }
    } catch (e) {}
    /* 🔴v1156：**只让容器可见，不画房间列表**（lobby() 会先画出「房间已经不在了」）。
       🔴v1164：排位房的设定全部显式传 —— 固定抢答赛、固定看中文（不沿用自由房选过的「听发音」）、
       写上自己的分；等人时让数据层顺便看看有没有更早开的房（两人同时开始时能配到一起）。 */
    _ladderCfg = { ladder: true, mode: 'A', askMode: 'cn', private: false,
                   rating: Number(rating) || 1000,
                   t0: Number(opts.t0) || Date.now(), band: opts.band,
                   onOk: opts.onOk, onFail: opts.onFail };
    doCreate(_ladderCfg);
  }
  function _joinForLadder(roomId, opts) {
    opts = opts || {};
    _cameFromLadder = true;
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('进排位房'); } catch (e) {}
    _pickedMode = 'A';
    _fromLadder = true;      /* v1154: 记住这次是排位来的，进不去时好说人话 */
    try { var _h = host(); if (_h) { _h.classList.add('on'); } } catch (e) {}
    /* 🔴v1156：**只让容器可见，不画房间列表。**
       🔴v1164：进不去时不再停在「被抢走了 / 再找一次」那一屏 —— 原因交回天梯，
       天梯自动试下一间（孩子不用再点）；没有天梯回调时（老调用方）也自动回去接着找。 */
    _ladderCfg = { ladder: true, rating: Number(opts.rating) || 0,
                   onOk: opts.onOk, onFail: opts.onFail };
    doJoin(roomId, null, _ladderCfg);
  }

  /* ── 🔴v1138 关页面时尽量把房间收掉 ────────────────────────

     点「关掉房间」按钮会走 `leaveRoom`，房间被删得干干净净。
     **但直接关标签页、切走、或手机上划掉微信就不会** ——
     房间留在数据库里，靠心跳过期（30 秒）才不再展示，
     记录则永远躺着。这正是僵尸房的源头。

     浏览器在页面关闭时只给很短的时间，普通异步请求来不及发出去。
     `sendBeacon` 是专门为这种场景设计的：**浏览器保证把它发出去**，
     不管页面是不是已经关了。

     ⚠️ 但 TCB 的删除接口不是一个能用 sendBeacon 直接打的 URL，
     所以这里退而求其次：**在 pagehide 时同步发一次 leaveRoom**，
     能发出去就赚到（切走时通常能成功），发不出去也没损失 ——
     v1135 的"列房时顺手清死房"是这条路的兜底。

     两条路合起来：**大多数情况下当场就清掉，剩下的下次列房时清。** */
  function bindUnloadCleanup() {
    if (window.__hsnPkUnloadBound) return;
    window.__hsnPkUnloadBound = 1;
    var bye = function () {
      try {
        var rid = _state && _state.roomId;
        if (rid && rid !== 'test' && S() && S().leaveRoom) S().leaveRoom(rid);
      } catch (e) {}
    };
    try {
      /* pagehide 比 beforeunload 可靠：iOS Safari 上 beforeunload 常常不触发 */
      window.addEventListener('pagehide', bye);
      /* 切到后台超过一会儿也算离开 —— 手机上"划掉 App"往往只触发 visibilitychange */
      var hidSeq = 0, hidAt = 0;
      document.addEventListener('visibilitychange', function () {
        var hid = document.visibilityState === 'hidden';
        /* 🔴审查 R2-UI-3：等人的时候切到别的 App → **马上**停止收人（公开房 / 排位房先下架，私密房不点头）；
           以前要等 30 秒才收房，这期间照样把人确认进来、在后台开打，进来的孩子对着空气打完一局。回来接着等。 */
        try {
          if (_cancelWait && _state && !_state.startAt) {
            if (hid && typeof _cancelWait.pause === 'function') _cancelWait.pause();
            if (!hid && typeof _cancelWait.resume === 'function') _cancelWait.resume();
          }
        } catch (e) {}
        /* 🔴联机压力测试 D5：打到一半切回来 —— 马上看一眼对手（判了离场的话当场说，别让孩子接着打完才知道） */
        try { if (!hid && _state && _state.startAt && !_state.finished && _rt) checkOpponentAlive(_rt.idx, true); } catch (e) {}
        if (!hid) { hidSeq++; return; }
        var my = ++hidSeq;
        hidAt = Date.now();
        var later = function () {
          if (my !== hidSeq || document.visibilityState !== 'hidden') return;
          /* 私密房：房主多半是切到微信发房间码去了 —— 等人期间不会开打（上面已经停止收人），多留一会儿（3 分钟） */
          if (_state && _state.isPrivate && !_state.startAt && Date.now() - hidAt < 180000) { setTimeout(later, 15000); return; }
          bye30();
        };
        var bye30 = function () {
          /* 30 秒后还没回来才收房 —— 只是切出去看一眼不该把房关了。
             🔴v1164：**只收「还在等人」的房。** 打到一半切出去，交给对手那边的 60 秒离场判定；
             原来这里一视同仁，切出去 30 秒就把正在打的这局退掉了，回来界面还停在对战屏。
             收了房也要把界面带回去，并说清楚为什么（回来看到的不能是一个已经没了的等待屏）。
             🔴审查 UI-10：看的是**这时候**的那间房（以前看的是切出去那一刻的 —— 那时还在「找对手」，
             之后天梯在后台自己开了房，这里就认不出来了） */
          if (my !== hidSeq || document.visibilityState !== 'hidden') return;
          if (!_state || _state.startAt || _state.roomId === 'test') return;
          var lad = !!_state.ladder;
          endWait(_state, true);
          if (lad) { ladderBack('home', '你切出去太久，房间先关掉了。回来点「开始排位」再找对手。'); return; }
          lobby({ reason: '你切出去太久，房间先关掉了。想玩就再开一间吧。' });
        };
        setTimeout(later, 30000);
      });
    } catch (e) {}
  }

  bindUnloadCleanup();

  /* ── 🔴v1164（审查 UI-1）退出这一局 ──
     首页外壳里按手机返回键，岛只是被藏起来、不会卸载 —— 以前房还挂在列表里、对局还在后台跑，
     别的孩子会被配进来跟一个不在的人打。现在：
       · 对战屏、等交卷屏有看得见的「退出」；
       · 外壳收起岛之前问一句 isBusy()，对战中先弹这一层确认（防手滑），等人 / 进房中直接收掉。 */
  function hideQuit() { var d = q('prQuitAsk'); if (d && d.parentNode) d.parentNode.removeChild(d); }
  function askQuit(onLeave) {
    hideQuit();
    host();
    var d = document.createElement('div');
    d.id = 'prQuitAsk';
    d.setAttribute('role', 'alertdialog');
    d.setAttribute('style', 'position:fixed;inset:0;z-index:2147483601;background:rgba(11,16,32,.86);'
      + 'display:flex;align-items:center;justify-content:center;padding:20px');
    var st0 = _state;
    var battle = !!(st0 && st0.startAt);
    var handedIn = battle && !!st0.finished;
    /* 🔴审查 R2-UI-4/FX-6：对话框说什么、就记什么 ——
         对战中退出 = 这一局记一场输（以前什么都不记：落后的孩子点「退出」就能保住天梯分，对手却 +20）；
         已经交了卷 = 走了也不影响结果，结果出来自动记上（以前赢下来的一局就这么没了） */
    var title = handedIn ? '先离开吗？' : (battle ? '要退出这一局吗？' : '要退出吗？');
    var body = handedIn ? '你已经交卷了，现在离开不影响这一局 ——<br>对手交卷以后，结果会自动记进战绩。'
             : battle ? '现在退出，这一局就算对手赢（记一场输）。' : '房间会关掉。';
    d.innerHTML = '<div style="background:var(--pk-card);border:1px solid var(--pk-in-line);border-radius:16px;'
      + 'padding:18px 16px;max-width:340px;width:100%;text-align:center;color:var(--pk-txt)">'
      + '<div style="font-size:30px">🚪</div>'
      + '<div style="font-size:16px;font-weight:800;margin-top:8px">' + title + '</div>'
      + '<div style="font-size:13px;color:var(--pk-dim);margin-top:8px;line-height:1.7">' + body + '</div>'
      + '<button class="pr_btn" id="prQuitNo" style="margin-top:14px">' + (handedIn ? '接着等' : '继续打') + '</button>'
      + '<button class="pr_btn pr_btn2" id="prQuitYes" style="margin-bottom:0">' + (handedIn ? '先离开' : '退出') + '</button></div>';
    /* 🔴审查 R2-UI-9：挂在页面最外层 —— 以前挂在对战屏里，下一词一画屏它就没了，孩子点的「退出」悄悄丢了 */
    (document.body || document.documentElement).appendChild(d);
    if (q('prQuitNo')) q('prQuitNo').onclick = function () { hideQuit(); };
    if (q('prQuitYes')) q('prQuitYes').onclick = function () {
      hideQuit();
      var st = _state;
      var lad = !!(st && st.ladder);
      if (st && st.startAt && st.roomId !== 'test') {
        if (st.finished) bgSettle(st);
        else {
          try { recordGame(st, { result: 'lose', mine: Number(st.myScore) || 0, theirs: Number(st.oppScore) || 0 }); } catch (e) {}
          try { if (window.HansenToast && HansenToast.say) HansenToast.say('这一局记了一场输'); } catch (e) {}
        }
      }
      close();
      if (typeof onLeave === 'function') { try { onLeave(); } catch (e) {} return; }
      if (lad) { try { if (window.HansenLadderUI) HansenLadderUI.open(); } catch (e) {} return; }
      lobby();
    };
  }
  /* 外壳用：现在是不是在一个联机流程里（对战 / 等人 / 进房）—— 是的话收起岛之前要先收掉 */
  function isBusy() {
    var el = q(ID);
    var on = !!(el && el.classList.contains('on'));
    return { on: on, battle: !!(_state && _state.startAt && on), waiting: !!(_state && !_state.startAt && on),
             joining: !!_joiningRid, creating: !!_createBusy };
  }

  window.HansenPkRoomUI = {
    isBusy: isBusy,
    askQuit: askQuit,
    /* 🔴v1163：**端到端测试要能拿到当前题目的答案。**

       之前验"建房能不能真打完一局"时，只能从屏幕上抠中文再反查词库 ——
       遇到「和/并且」这种带斜杠的词就抠不出来，
       于是测试以为"已经进结算了"，实际上第 1 题都没答完。

       > 测试抠屏幕等于用户的眼睛，能验"显示对不对"；
       > 但要验"流程能不能走完"，得能拿到内部状态。
       > 两者都要有，缺了后者就只能靠猜。 */
    _stateForTest: function () { return _state; },
    /* v1164：测试把「等人两分钟」调短，才验得到等不到人时的收尾（产品默认不变） */
    _setWaitMsForTest: function (ms) { _waitMs = Number(ms) || 120000; },
    _rtForTest: function () { return _rt; },
    _createForLadder: _createForLadder,
    _joinForLadder: _joinForLadder,
    /* 🔴v1099 测试注入口：直接进对战屏，不必真的匹配一个对手。
       没有这个口子，"对战屏到底能不能用"就只能靠两台真机去试 ——
       而那正是本项目最贵的教训（看不见现场就只能猜）。 */
    _startMatchForTest: function (words, oppName, askMode, mode) {
      if (askMode) _askMode = askMode;
      if (mode) _pickedMode = mode;
      /* v1104: roomId 可指定 —— 'test' 会跳过掉线检查，
         要验掉线就得传一个真实 id */
      _state = { roomId: (arguments[4] || 'test'), words: words || [], oppName: oppName || '测试对手',
                 askMode: askMode || _askMode, mode: mode || _pickedMode, isHost: true,
                 idx: 0, correct: 0, startAt: Date.now() };
      startMatch();
      return true;
    }, open: function () { lobby(); }, close: close };
})();
