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
    try { if (window.HBErrText) return window.HBErrText(e); } catch (_) {}
    return (e && (e.reason || e.message)) ? String(e.reason || e.message) : String(e || '');
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
      + 'padding:8px 14px;font-size:15px;cursor:pointer}'
      + '#' + ID + ' .pr_h{font-size:19px;font-weight:700}'
      + '#' + ID + ' .pr_btn{width:100%;border:0;border-radius:14px;padding:14px;font-size:16px;font-weight:700;'
      + 'color:#fff;background:linear-gradient(135deg,#4f46e5,#6366f1);cursor:pointer;margin-bottom:12px}'
      + '#' + ID + ' .pr_btn2{background:linear-gradient(135deg,#0ea5e9,#38bdf8)}'
      + '#' + ID + ' .pr_room{display:flex;align-items:center;gap:10px;background:#1e293b;border:1px solid var(--pk-in-line);'
      + 'border-radius:12px;padding:12px;margin-bottom:10px}'
      + '#' + ID + ' .pr_room .n{flex:1;min-width:0}'
      + '#' + ID + ' .pr_room .n b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#' + ID + ' .pr_room .n span{font-size:12px;color:var(--pk-dim)}'
      + '#' + ID + ' .pr_room button{background:#4f46e5;border:0;color:#fff;border-radius:10px;padding:9px 16px;'
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
    if (_cancelWait) { try { _cancelWait(); } catch (e) {} _cancelWait = null; }
    try { if (S()) S().stopHeartbeat(); } catch (e) {}
    if (_state && _state.roomId) { try { S().leaveRoom(_state.roomId); } catch (e) {} }
    _state = null;
    var el = q(ID);
    if (el) { el.classList.remove('on'); el.innerHTML = ''; }
  }

  /* 错误块：会话过期时给出「重新登录」这条出路，而不是让人干瞪眼 */
  function errBlock(r) {
    var expired = !!(r && r.expired) || /过期|unauthenticated|credentials|登录/i.test(E(r));
    return '<div class="pr_err">' + esc(E(r) || '未知错误')
      + (expired ? '<br><br>云端登录已过期，重新登录一次就能继续。' : '') + '</div>'
      + (expired ? '<button class="pr_btn pr_btn2" id="prLogin">🔑 重新登录</button>' : '');
  }
  function wireErr() {
    if (q('prLogin')) q('prLogin').onclick = function () {
      try { if (window.HansenAuthUI) HansenAuthUI.open(); } catch (e) {}
    };
  }

  /* ── 屏 1：房间列表 ── */
  /* v1156: 房主水平怎么显示 —— 先看段位名，再看分数，都没有才说未定级 */
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

  function lobby(err) {
    paint(
      '<div class="pr_top"><button class="pr_back" id="prBack">← 返回</button>'
      + '<div class="pr_h">🏠 大PK · 公开房间</div></div>'
      + (err ? errBlock(err) : '')
      /* 🔴v1105 邀请朋友：房间码。
         没做「加好友」那一套（列表/申请/通过）—— 对现在的用户量太重，
         而且解决不了核心问题：你想跟谁打通常是身边的人，
         微信发一句话比在 App 里加好友快得多。 */
      + '<div style="display:flex;gap:8px;margin:10px 0">'
      +   '<input id="prCode" maxlength="4" placeholder="输入好友的房间码"'
      +     ' aria-label="输入好友给你的四位房间码"'
      +     ' autocapitalize="characters" autocomplete="off"'
      +     ' style="flex:1;min-width:0;text-align:center;letter-spacing:6px;font-size:20px;'
      +     'text-transform:uppercase;background:var(--pk-card);border:1px solid var(--pk-in-line);'
      +     'border-radius:12px;color:var(--pk-txt);padding:10px">'
      +   '<button class="pr_btn" id="prJoinCode" style="flex:0 0 92px;margin:0">进房</button>'
      + '</div>'
      + '<button class="pr_btn" id="prNew">➕ 开一间公开房，等人来打</button>'
      + '<button class="pr_btn pr_btn2" id="prPriv">🔒 开私密房，邀请好友来打</button>'
      + '<button class="pr_btn pr_btn2" id="prRef">🔄 刷新房间列表</button>'
      + '<div id="prList"><div class="pr_empty">正在找房间…</div></div>');
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
    if (q('prRef')) q('prRef').onclick = refresh;
    refresh();
  }

  function refresh() {
    if (!S()) return;
    S().listRooms().then(function (r) {
      var box = q('prList');
      if (!box) return;
      if (!r.ok) { box.innerHTML = errBlock(r); wireErr(); return; }
      var rooms = (r.rooms || []).filter(function (x) { return !x.mine; });
      if (!rooms.length) {
        box.innerHTML = '<div class="pr_empty">现在还没有人开房。<br>点上面的「➕ 开一间公开房」，等别人来打。</div>';
        return;
      }
      box.innerHTML = rooms.map(function (x) {
        return '<div class="pr_room"><div class="n"><b>' + esc(x.hostName) + '</b>'
          /* 🔴v1156：**排位房全显示「未定级」是错的。**
             列表读的是 `hostTier`（开房时手填的），
             而天梯自动开的房传的是 `hostRating`（一个分数）——
             于是所有排位房都掉进 `|| '未定级'` 那个兜底里。

             用户在列表里看到一排「未定级」，**判断不出该进谁的房** ——
             而"对手大概什么水平"正是他点进去之前最想知道的。

             有分数就按分数算段位；两个都没有才说未定级。 */
          + '<span>' + esc(tierText(x)) + ' · ' + x.wordCount + ' 个词 · '
          + (x.ageSec < 60 ? x.ageSec + ' 秒前开' : Math.round(x.ageSec / 60) + ' 分钟前开') + '</span></div>'
          + '<button data-rid="' + esc(x.id) + '">进去打</button></div>';
      }).join('');
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
  var _ladderRating = 0;   /* v1108: 开排位房时把自己的分写进房间，供匹配用 */

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
    S().findByCode(code).then(function (r) {
      if (!r.ok) {
        restore();
        say(r.reason || '没找到这间房 —— 房间码可能过期了，让朋友再发一次');
        if (ci) { ci.focus(); try { ci.select(); } catch (e) {} }
        return;
      }
      doJoin(r.roomId, btn);
    })['catch'](function (e) {
      restore();
      say(String((e && e.message) || e) || '网络不太顺，再试一次');
    });
  }

  function chooseMode(onPick) {
    var MODES = (S() && S().MODES) || {};
    var cards = ['A', 'B', 'C'].map(function (k) {
      var m = MODES[k];
      if (!m) return '';
      return '<div class="pr_mode" data-mode="' + k + '" style="border:1px solid var(--pk-in-line);'
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
        el.onclick = function () { onPick(el.getAttribute('data-mode')); };
      });
    }
    var b = q('prBack');
    if (b) b.onclick = function () { lobby(); };
  }

function doCreate() {
    var btn = q('prNew');
    if (btn) { btn.disabled = true; btn.textContent = '正在开房…'; }
    var tier = '';
    try { var L = window.HansenSbLadder, P = window.HansenSbProfile;
          if (L && P) tier = L.tierOf(P.status().rating || 0).name; } catch (e) {}
    S().createRoom({ tier: tier, mode: _pickedMode, askMode: _askMode, private: _wantPrivate,
                     hostRating: _ladderRating }).then(function (r) {
      if (!r.ok) { lobby(r); return; }
      _state = { roomId: r.roomId, words: r.words, isHost: true };
      waiting(r.roomId, (r.room && r.room.code) || '');
    });
  }

  function waiting(roomId, code) {
    /* 🔴v1105：私密房把**房间码大大地显示出来**，并给一键复制。
       邀请朋友的整个流程就靠这四个字符：
         开房 → 看到码 → 复制 → 微信发过去 → 朋友输码进来
       所以它必须是这一屏最显眼的东西，而不是藏在角落的小字。 */
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
      : '<div class="pr_empty">房间已经开好了，别人在列表里就能看到你。<br>'
        + '等人进来就自动开打。</div>';

    paint('<div class="pr_top"><button class="pr_back" id="prBack">← 关掉房间</button>'
      + '<div class="pr_h">⏳ 等对手进来</div></div>'
      + codeBox
      + '<div class="pr_empty" style="font-size:12.5px;margin-top:10px">'
      + '（关掉这一页，房间也会一起关掉）</div>');
    if (q('prBack')) q('prBack').onclick = close;

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
          /* 微信内置浏览器有时拿不到 clipboard 权限 —— 退回选中文本让用户长按复制，
             而不是弹一句"复制失败"就没了。 */
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
    _cancelWait = S().waitForOpponent(roomId, function (ev) {
      if (ev.joined) { startMatch(); return; }
      if (ev.gone) { lobby({ reason: '房间已经不在了' }); return; }
      if (ev.timeout) { lobby({ reason: '等了两分钟没人来，先散了吧' }); return; }
      if (ev.error) { lobby({ reason: ev.error }); }
    });
  }

  /* ── 进房 ── */
  function doJoin(rid, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '进入中…'; }
    S().joinRoom(rid).then(function (r) {
      if (!r.ok) {
        /* 🔴v1154：**排位进不去房要说人话，不能默默甩回列表。**

           实测（"进房那一刻被别人抢走"场景）：抢不到时直接 `lobby(r)`，
           用户从"正在找对手"一下子跳到「🏠 大PK · 公开房间」列表，
           **完全不知道刚才发生了什么** —— 以为天梯坏了。

           而"房刚好被别人抢走"在排位里很常见：
           大家都在抢同一批空房，慢一步就没了。这不是故障，是正常竞争。 */
        if (_fromLadder) {
          _fromLadder = false;
          paint('<div class="pr_top"><button class="pr_back" id="prBack">← 返回</button>'
            + '<div class="pr_h">⚡ 排位</div></div>'
            + '<div style="text-align:center;padding:26px 12px">'
            + '<div style="font-size:40px">\ud83d\udca8</div>'
            + '<div style="font-size:16px;font-weight:800;margin-top:10px">这间房刚被别人抢走了</div>'
            + '<div style="font-size:13px;color:var(--pk-dim);margin-top:8px;line-height:1.8">'
            +   '排位时大家都在抢空房，慢一步就没了。<br>再找一次就好。</div>'
            + '<button class="pr_btn" id="prReMatch" style="margin-top:16px">\u26a1 再找一次对手</button>'
            + '</div>');
          var _rb = document.getElementById('prReMatch');
          if (_rb) _rb.onclick = function () {
            try { close(); if (window.HansenLadderUI) HansenLadderUI.open(); } catch (e) {}
          };
          var _bk = document.getElementById('prBack');
          if (_bk) _bk.onclick = close;
          return;
        }
        if (r.taken) { refresh(); alert(E(r)); if (btn) { btn.disabled = false; btn.textContent = '进去打'; } return; }
        lobby(r); return;
      }
      _state = { roomId: r.roomId, words: r.words, isHost: false };
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
    st.startAt = Date.now();
    st.myScore = 0; st.oppScore = 0;
    st.mode = st.mode || _pickedMode || 'C';
    /* 报到 —— 双方都进屏了才开打，避免一方还在加载就被抢完。
       🔴v1126：**先把房间的 roundAt 拿到手再开第一回合。**
       否则首回合各按各的本地时间起算 —— 实测两人开局差 6 秒，
       后进来的那个凭空多出半个回合的时间。 */
    /* 🔴v1127：**取共享时间不能拖慢开局。**
       实测网络慢 3 秒时，开局要等 7.5 秒 —— 用户会以为卡死了。
       改为：**最多等 1.2 秒**，超过就先开局（首回合用本地计时，
       差个一两秒可以接受），拿到 roundAt 后下一回合自然就同步了。 */
    var started = false;
    var go = function () { if (started) return; started = true; askRound(0); };
    try {
      S().markReady(st.roomId);
      if (st.roomId && st.roomId !== 'test' && S().roundState) {
        setTimeout(go, 1200);            /* 兜底：等太久就先开 */
        S().roundState(st.roomId).then(function (r) {
          if (r && r.ok && r.roundAt) { st.roundAt = r.roundAt; st.roundIdxOfRoundAt = r.round; }
          go();
        })['catch'](go);
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

    var M = (S() && S().modeOf) ? S().modeOf(st.mode) : { perWordSecs: 15, name: '' };
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
    var shared = (st.roundAt && idx === st.roundIdxOfRoundAt) ? st.roundAt : 0;
    var fresh = shared && (Date.now() - shared) < span;
    var base = fresh ? shared : Date.now();
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
      +   '<span style="flex:0 1 auto;min-width:0;overflow:hidden;font-size:11.5px;'
      +     'color:var(--pk-dim);background:rgba(255,255,255,.07);'
      +     'padding:3px 9px;border-radius:99px;white-space:nowrap;'
      +     'text-overflow:ellipsis">' + esc(M.emoji || '') + esc(M.name || '') + '</span>'
      +   '<span style="flex:1 0 auto;min-width:0;display:flex;align-items:baseline;'
      +     'gap:5px;justify-content:flex-end">'
      +     '<b id="prOpp" style="font-size:22px;font-variant-numeric:tabular-nums;'
      +       'display:inline-block">' + st.oppScore + '</b>'
      +     '<span style="font-size:12.5px;color:var(--pk-dim);overflow:hidden;'
      +       'text-overflow:ellipsis;white-space:nowrap">'
      +       esc(st.oppName || '对手') + '</span>'
      +   '</span>'
      + '</div>'
      + '<div class="pr_sub">第 ' + (idx + 1) + ' / ' + words.length + ' 词'
      +   ' · <span id="prClock">⏱ ' + (M.perWordSecs || 15) + 's</span></div></div>'

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
      if (document.visibilityState === 'hidden') {
        if (_rt && _rt.idx === idx && !_rt.bgLeft) {
          _rt.bgLeft = Math.max(0, _rt.deadline - Date.now());
        }
        return;
      }
      if (_rt && _rt.idx === idx && _rt.bgLeft) {
        _rt.deadline = Date.now() + _rt.bgLeft;   /* 回来了：把时间还回去 */
        _rt.bgLeft = 0;
      }
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

  function checkOpponentAlive(idx) {
    var st = _state;
    if (!st || !st.roomId || st.roomId === 'test') return;
    if (Date.now() - _goneChecked < 4000) return;    /* 4 秒查一次，别刷爆数据库 */
    _goneChecked = Date.now();
    S().opponentGone(st.roomId).then(function (g) {
      if (!g || !g.ok || !_rt || _rt.idx !== idx) return;
      var el = q('prOppSt');
      if (g.gone) {
        if (el) { el.textContent = '🏆 对手已离场，本局你胜'; el.style.color = 'var(--pk-ok)'; }
        stopPoll();
        S().claimAbandonWin(st.roomId).then(function () {
          showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true });
        })['catch'](function () {
          showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true });
        });
        return;
      }
      /* 快到阈值了就提醒 —— 让人知道"不是卡住了，是对手没动" */
      var left = (g.limitSecs || 60) - (g.idleSecs || 0);
      if (el && g.idleSecs > 12 && left > 0) {
        el.textContent = '对手掉线了…' + left + 's 后判他负';
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
          else if (st._oppId && r.oppId && r.oppId !== st._oppId && !st._oppSwapped) {
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
        var _mm = (S() && S().modeOf) ? S().modeOf(st.mode)
                                      : { firstScore: 100, secondScore: 60 };
        var _ws = (r.room && r.room.winners) || r.winners || [];
        var _meIsHost = !!(r.mySide ? r.mySide === "host" : st.isHost);
        var _opp = 0;
        for (var _i = 0; _i < _ws.length; _i++) {
          var _who = _ws[_i];
          if (!_who) continue;
          var _oppWon = _meIsHost ? (_who === 'guest') : (_who === 'host');
          if (_oppWon) _opp += (_mm.firstScore || 100);
        }
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
                  try { _ob.style.transform = 'scale(1)'; _ob.style.color = ''; } catch (e) {}
                }, 260);
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
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
      if (oppGot && el) { el.textContent = '⚡ 抢先拼对了！'; el.style.color = 'var(--pk-warn)'; }
      var M = (S() && S().modeOf) ? S().modeOf(st.mode) : { waitAll: true };
      /* A 模式：对手抢到就立刻翻篇，不等我 */
      if (oppGot && !M.waitAll && !_rt.answered) { submitRound(idx, false, true); return; }

      /* 🔴v1123：**对手已经跑到下一词了，我不能还停在上一词。**

         实测两人对战：A 抢到第 1 词后推进到第 2 词，
         B 那边只显示"对手抢先拼对了"，**却一直卡在第 1 词** ——
         因为 C 模式是"等两人都答完"，而 B 没答就只能干等 15 秒超时。
         结果 B 全程慢一拍，后面每一词都对不上，分数永远是 0。

         判据：房间的 `round` 已经超过我当前这一词 ——
         说明这一词的胜负已定、对手也走了，我该跟上。
         仍按 `secondScore` 记分（B/C 模式下"慢了但还是拼对了"有分），
         没拼对就是 0 分。 */
      /* ⚠️ 判据要看**这一词有没有人抢到**，不是看 round 跑多远。
         第一版写成 `r.round > idx + 1` —— 而第 0 词被抢后 round 正好是 1，
         条件不成立，B 永远跟不上（实测卡在第 1 词、分数一直 0）。
         正确判据：`winners[idx]` 已经有人 = 这一词已定胜负，我该跟上。 */
      if (oppGot && !_rt.answered) {
        /* 🔴v1125：**立刻标记本回合已结束，再走结算。**

           实测 A 模式：A 抢到后 B 那边输入框被清空、
           却只显示「对手：正在拼…」—— B 完全不知道刚才发生了什么。

           原因是这里等了 0.7 秒才调 submitRound，
           而那 0.7 秒里 B 可能还在敲键盘、轮询也可能再次触发，
           结果"对手抢先了"这句话没机会显示出来就被下一回合盖掉。

           改为**马上结算**（submitRound 内部本来就有 1.4 秒的小结停留，
           足够看清"对手抢先了 〔apple 苹果〕"）——
           不需要在外面再加一层延迟。 */
        submitRound(idx, false, true);
      }
    })['catch'](function () {});
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
    var M = (S() && S().modeOf) ? S().modeOf(st.mode) : { firstScore: 100, secondScore: 60, waitAll: true };

    var after = function (gain, first) {
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
            try { _mb.style.transform = 'scale(1)'; _mb.style.color = ''; } catch (e) {}
          }, 260);
        }
      } catch (e) {}
      /* 🔴v1108 累计本局明细，结算时一起报给战绩 ——
         光有胜负说明不了"我强在哪"，得有速度和正确率。 */
      st.st = st.st || { words: 0, correct: 0, totalMs: 0, firstWins: 0, fastestMs: 0 };
      st.st.words++;
      if (gain > 0) {
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
        h.textContent = (gain
          ? ((first ? '🔥 你抢先拼对！' : '✅ 拼对了') + ' +' + gain + ' 分 · ' + secs + 's')
          : (forced ? '对手抢先了' : '⏱ 超时了')) + answer;
      }
      setTimeout(function () { askRound(idx + 1); }, 1400);
    };

    if (!correct) {
      /* 🔴v1124：**没拼对也要推进房间的 round**，否则下一词写不进去。
         实测：两人都超时 → 房间还停在上一回合 → 下一词的 claim 条件不成立
         → 白拼一次、对手也看不到、双方脱节。
         "谁都没抢到"同样是一个回合的结束，房间状态要跟上。 */
      try {
        if (st && st.roomId && st.roomId !== 'test' && S().skipRound) {
          S().skipRound(st.roomId, idx)['catch'](function () {});
        }
      } catch (e) {}
      after(0, false); return;
    }

    S().claimRound(st.roomId, idx).then(function (r) {
      if (!r || !r.ok) { after(0, false); return; }
      after(Number(r.score) || 0, !!r.first);
    })['catch'](function () { after(0, false); });
  }

  function finish() {
    var st = _state;
    if (!st) return;
    stopPoll(); stopKb();
    var secs = Math.max(1, Math.round((Date.now() - st.startAt) / 1000));

    /* 🔴v1122：**改用回合制的实际得分。**

       这里一直沿用 v1099 的算法 `st.correct * 100 + ...` ——
       而 `st.correct` 是"一次给全套题"那版留下的字段，
       **回合制下从来没被赋过值**（现在记分记在 `st.myScore` 和 `st.st` 里）。

       后果：打完 3 局，战绩记了 **0 局**、答题数 **0 个** ——
       整局白打，天梯分也不会动。实测才发现。

       教训：**改了计分方式，就要顺着链条查到最后一环。**
       v1101 改对战屏时只顾着回合逻辑，忘了结算这一头还在读旧字段。 */
    var stat = st.st || { words: 0, correct: 0 };
    var score = Number(st.myScore) || 0;

    paint('<div class="pr_top"><div class="pr_h">📨 交卷了</div></div>'
      + '<div class="pr_empty">你答对 ' + stat.correct + ' / ' + (st.words || []).length
      + ' 个，得 ' + score + ' 分，用时 ' + secs + ' 秒。<br>'
      + '正在等对手交卷…</div>');
    S().reportResult(st.roomId, score).then(function (r) {
      if (!r.ok) { lobby(r); return; }
      if (r.waiting) { setTimeout(function () { pollResult(st.roomId, score); }, 2000); return; }
      showResult(r);
    });
  }

  function pollResult(roomId, score) {
    S().reportResult(roomId, score).then(function (r) {
      if (!r.ok) { lobby(r); return; }
      if (r.waiting) {
        /* 🔴v1154：**等对手交卷不能没有上限。**

           两人真机对打实测抓到：A 已经看到"🤝 打平"的结算屏了，
           **B 还卡在"正在等对手交卷…"** —— 而且会一直卡下去。

           原来这里只是每 2 秒重试一次，**没有任何超时**：
           对手中途关掉页面、网断了、或者结算写入丢了一次，
           这一边就**永远停在等待屏**，只能自己退出去 ——
           而退出去这一局的战绩和天梯分就都没了。

           给 45 秒上限：正常情况下对手交卷只要几秒，
           45 秒还没等到，多半是他不会再交了。
           超时按"对手离场"结算 —— 和 v1104 对手掉线的处理一致，
           **让这一局有个交代，而不是把人吊在那儿**。 */
        _waitResult = (_waitResult || 0) + 1;
        if (_waitResult > 22) {                 /* 22 次 × 2 秒 ≈ 45 秒 */
          _waitResult = 0;
          showResult({ ok: true, result: 'win', byAbandon: true,
                       mine: score, theirs: 0 });
          return;
        }
        setTimeout(function () { pollResult(roomId, score); }, 2000);
        return;
      }
      _waitResult = 0;
      showResult(r);
    })['catch'](function () {
      /* 网络抖动也算一次等待，别让异常把这条链断掉 */
      _waitResult = (_waitResult || 0) + 1;
      if (_waitResult > 22) { _waitResult = 0;
        showResult({ ok: true, result: 'win', byAbandon: true, mine: score, theirs: 0 }); return; }
      setTimeout(function () { pollResult(roomId, score); }, 2500);
    });
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
      return '<div style="text-align:center;font-size:12.5px;color:var(--pk-dim);'
        + 'margin:2px 0 10px">距离 ' + nx.icon + ' ' + esc(nx.name)
        + ' 还差 <b style="color:inherit">' + nx.need + '</b> 分'
        + '（大约 ' + Math.max(1, Math.ceil(nx.need / 18)) + ' 局）</div>';
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

  function showResult(r) {
    /* v1104：对手离场赢的要说清楚 —— 不能让人以为自己实打实赢了 */
    var txt = r.byAbandon ? '🏆 对手离场，本局你胜'
            : (r.result === 'win' ? '🎉 你赢了！' : (r.result === 'lose' ? '💪 这局输了' : '🤝 打平'));

    /* 🔴v1103：**打完必须留下痕迹** —— 赢了没记录，那为什么要打？
       只有 A 抢答赛动天梯分（v1100 定的规矩：排位就该纯竞技），
       B/C 只记战绩。 */
    var rec = null;
    try {
      var R = window.HansenPkRecord;
      if (R) {
        /* v1156: 打完排位把分数传上榜。
           只在这里传，不主动轮询 —— 没必要给云端加负担。
           传失败不影响任何事：榜上暂时是旧分而已。 */
        try {
          setTimeout(function () {
            try {
              if (window.HansenLadderBoard && HansenLadderBoard.push) HansenLadderBoard.push();
            } catch (e) {}
          }, 300);
        } catch (e) {}

        try { _lastStats = Object.assign({}, (_state && _state.st) || {}); } catch (e) {}
        rec = R.record({
          result: r.result,
          mode: (_state && _state.mode) || _pickedMode,
          oppName: (_state && _state.oppName) || '对手',
          myScore: r.mine, oppScore: r.theirs,
          words: ((_state && _state.st) || {}).words || 0,
          correct: ((_state && _state.st) || {}).correct || 0,
          totalMs: ((_state && _state.st) || {}).totalMs || 0,
          firstWins: ((_state && _state.st) || {}).firstWins || 0,
          fastestMs: ((_state && _state.st) || {}).fastestMs || 0
        });
      }
    } catch (e) {}

    var extra = '';
    if (rec) {
      var sm = window.HansenPkRecord.summary();
      var dTxt = '';
      if (rec.ranked && rec.delta) {
        dTxt = '<div style="font-size:20px;font-weight:800;margin:6px 0;color:'
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
      + '<button class="pr_btn pr_btn2" id="prBack2">← 回到房间列表</button>');
    var rid = _state && _state.roomId;
    _state = null;
    if (rid) { try { S().leaveRoom(rid); } catch (e) {} }
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
    if (q('prBack2')) q('prBack2').onclick = function () { lobby(); };
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

  function _createForLadder(rating) {
    _cameFromLadder = true;
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('开排位房'); } catch (e) {}
    _pickedMode = 'A'; _askMode = _askMode || 'cn'; _wantPrivate = false;
    _ladderRating = Number(rating) || 1000;
    /* 🔴v1156：**只让容器可见，不画房间列表。**

       v1155 为了修"自动开房后白屏"，这里调了 `lobby()` ——
       白屏是治好了，但引入了新毛病：
       **lobby() 会去拉房间列表，而那一刻我们的房还没建好，
       于是它先画出一个「房间已经不在了」的错误列表**，
       几百毫秒后才被等待屏盖掉。

       用户在等满 20 秒之后看到的第一眼是一句报错 ——
       比白屏好不了多少。

       真正需要的只是"把容器打开"，让后面 doCreate 画的
       等待屏有地方可画。 */
    try {
      var _h = host();
      if (_h) {
        _h.classList.add('on');
        if (!_h.querySelector('.pr_wrap')) {
          _h.innerHTML = '<div class="pr_wrap">'
            + '<div class="pr_empty" style="padding:30px 12px">正在开房间…</div></div>';
        }
      }
    } catch (e) {}
    doCreate();
  }
  function _joinForLadder(roomId) {
    _cameFromLadder = true;
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('进排位房'); } catch (e) {}
    _pickedMode = 'A';
    _fromLadder = true;      /* v1154: 记住这次是排位来的，进不去时好说人话 */
    /* 🔴v1156：**只让容器可见，不画房间列表。**

       v1155 为了修"自动开房后白屏"，这里调了 `lobby()` ——
       白屏是治好了，但引入了新毛病：
       **lobby() 会去拉房间列表，而那一刻我们的房还没建好，
       于是它先画出一个「房间已经不在了」的错误列表**，
       几百毫秒后才被等待屏盖掉。

       用户在等满 20 秒之后看到的第一眼是一句报错 ——
       比白屏好不了多少。

       真正需要的只是"把容器打开"，让后面 doCreate 画的
       等待屏有地方可画。 */
    try {
      var _h = host();
      if (_h) {
        _h.classList.add('on');
        if (!_h.querySelector('.pr_wrap')) {
          _h.innerHTML = '<div class="pr_wrap">'
            + '<div class="pr_empty" style="padding:30px 12px">正在开房间…</div></div>';
        }
      }
    } catch (e) {}
    doJoin(roomId, null);
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
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'hidden') return;
        setTimeout(function () {
          /* 30 秒后还没回来才收房 —— 只是切出去看一眼不该把房关了 */
          if (document.visibilityState === 'hidden') bye();
        }, 30000);
      });
    } catch (e) {}
  }

  bindUnloadCleanup();

  window.HansenPkRoomUI = {
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
