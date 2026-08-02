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
      + '#' + ID + ' .pr_word{font-size:34px;font-weight:800;text-align:center;letter-spacing:2px;margin:22px 0 6px}'
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
        box.innerHTML = '<div class="pr_empty">现在还没有人开房。<br>点上面的「自己开一间」，等别人来打。</div>';
        return;
      }
      box.innerHTML = rooms.map(function (x) {
        return '<div class="pr_room"><div class="n"><b>' + esc(x.hostName) + '</b>'
          + '<span>' + esc(x.hostTier || '未定级') + ' · ' + x.wordCount + ' 个词 · '
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
    if (!code) { alert('先输入好友给你的 4 位房间码'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '找房中…'; }
    var restore = function () { if (btn) { btn.disabled = false; btn.textContent = '进房'; } };
    S().findByCode(code).then(function (r) {
      if (!r.ok) { restore(); alert(r.reason || '没找到这间房'); return; }
      doJoin(r.roomId, btn);
    })['catch'](function (e) { restore(); alert(String((e && e.message) || e)); });
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
    /* 报到 —— 双方都进屏了才开打，避免一方还在加载就被抢完 */
    try { S().markReady(st.roomId); } catch (e) {}
    askRound(0);
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
    stopPoll();
    var st = _state;
    if (!st) return;
    var words = st.words || [];
    if (idx >= words.length) { finish(); return; }

    var M = (S() && S().modeOf) ? S().modeOf(st.mode) : { perWordSecs: 15, name: '' };
    var w = words[idx];
    var en = String(w.en || '');
    var askIsTts = (st.askMode || _askMode) === 'tts';
    _rt = { idx: idx, answered: false, t0: Date.now(),
            deadline: Date.now() + (M.perWordSecs || 15) * 1000 };

    paint('<div class="pr_top">'
      + '<div class="pr_h" style="display:flex;justify-content:space-between;align-items:center">'
      +   '<span>你 <b id="prMy">' + st.myScore + '</b></span>'
      +   '<span style="font-size:13px;color:var(--pk-dim)">' + esc(M.emoji || '') + esc(M.name || '') + '</span>'
      +   '<span><b id="prOpp">' + st.oppScore + '</b> ' + esc(st.oppName || '对手') + '</span>'
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
          : '<div class="pr_cn" style="font-size:26px;margin:18px 0 6px">' + esc(w.cn || '') + '</div>'
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
    var onVis = function () {
      if (!_rt || _rt.idx !== idx || _rt.answered) return;
      if (document.visibilityState === 'hidden') {
        _rt.pausedLeft = Math.max(0, _rt.deadline - Date.now());
      } else if (_rt.pausedLeft != null) {
        _rt.deadline = Date.now() + _rt.pausedLeft;
        _rt.pausedLeft = null;
      }
    };
    try { document.addEventListener('visibilitychange', onVis); } catch (e) {}
    _rt.offVis = function () {
      try { document.removeEventListener('visibilitychange', onVis); } catch (e) {}
    };

    /* 倒计时 + 轮询对手 */
    _pollTimer = setInterval(function () {
      /* 后台期间不推进倒计时也不轮询 —— 省电，且时间不该白扣 */
      if (document.visibilityState === 'hidden') return;
      if (!_rt || _rt.idx !== idx) return;
      var left = Math.max(0, Math.ceil((_rt.deadline - Date.now()) / 1000));
      var c = q('prClock');
      if (c) c.textContent = '⏱ ' + left + 's';
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
      if (!r || !r.ok || !_rt || _rt.idx !== idx) return;
      var w = (r.winners || [])[idx];
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
        /* 给一点时间让人看到"对手抢先了"，再翻篇 */
        setTimeout(function () {
          if (_rt && _rt.idx === idx && !_rt.answered) submitRound(idx, false, true);
        }, 700);
      }
    })['catch'](function () {});
  }

  function submitRound(idx, correct, forced) {
    if (!_rt || _rt.answered) return;
    _rt.answered = true;
    stopPoll();
    var st = _state;
    var M = (S() && S().modeOf) ? S().modeOf(st.mode) : { firstScore: 100, secondScore: 60, waitAll: true };

    var after = function (gain, first) {
      st.myScore += gain;
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

    if (!correct) { after(0, false); return; }

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
      if (r.waiting) { setTimeout(function () { pollResult(roomId, score); }, 2000); return; }
      showResult(r);
    });
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
      + '<div class="pr_empty">你 ' + r.mine + ' 分 · 对手 ' + r.theirs + ' 分</div>'
      + extra
      + '<button class="pr_btn" id="prAgain">再来一局</button>'
      + '<button class="pr_btn pr_btn2" id="prBack2">← 回到房间列表</button>');
    var rid = _state && _state.roomId;
    _state = null;
    if (rid) { try { S().leaveRoom(rid); } catch (e) {} }
    if (q('prAgain')) q('prAgain').onclick = lobby;
    if (q('prBack2')) q('prBack2').onclick = lobby;
  }

  /* 🔴v1108 天梯专用入口：排位固定用 A 抢答赛，玩家不能选模式。
     这是 v1100 定下的规矩 —— 排位就该是纯竞技。 */
  function _createForLadder(rating) {
    _pickedMode = 'A'; _askMode = _askMode || 'cn'; _wantPrivate = false;
    _ladderRating = Number(rating) || 1000;
    doCreate();
  }
  function _joinForLadder(roomId) {
    _pickedMode = 'A';
    doJoin(roomId, null);
  }

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
