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
      '#' + ID + '{position:fixed;inset:0;z-index:2147483600;background:#0f172a;color:#e2e8f0;'
      + 'overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;font-family:system-ui,-apple-system,sans-serif}'
      + '#' + ID + '.on{display:block}'
      + '#' + ID + ' .pr_wrap{max-width:520px;margin:0 auto;padding:14px 14px 40px}'
      + '#' + ID + ' .pr_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}'
      + '#' + ID + ' .pr_back{background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:10px;'
      + 'padding:8px 14px;font-size:15px;cursor:pointer}'
      + '#' + ID + ' .pr_h{font-size:19px;font-weight:700}'
      + '#' + ID + ' .pr_btn{width:100%;border:0;border-radius:14px;padding:14px;font-size:16px;font-weight:700;'
      + 'color:#fff;background:linear-gradient(135deg,#4f46e5,#6366f1);cursor:pointer;margin-bottom:12px}'
      + '#' + ID + ' .pr_btn2{background:linear-gradient(135deg,#0ea5e9,#38bdf8)}'
      + '#' + ID + ' .pr_room{display:flex;align-items:center;gap:10px;background:#1e293b;border:1px solid #334155;'
      + 'border-radius:12px;padding:12px;margin-bottom:10px}'
      + '#' + ID + ' .pr_room .n{flex:1;min-width:0}'
      + '#' + ID + ' .pr_room .n b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#' + ID + ' .pr_room .n span{font-size:12px;color:#94a3b8}'
      + '#' + ID + ' .pr_room button{background:#4f46e5;border:0;color:#fff;border-radius:10px;padding:9px 16px;'
      + 'font-size:14px;font-weight:700;cursor:pointer}'
      + '#' + ID + ' .pr_empty{color:#94a3b8;text-align:center;padding:26px 10px;font-size:14px;line-height:1.7}'
      + '#' + ID + ' .pr_err{background:#7f1d1d;border:1px solid #b91c1c;color:#fecaca;border-radius:12px;'
      + 'padding:12px;font-size:14px;line-height:1.6;margin-bottom:12px;word-break:break-all}'
      + '#' + ID + ' .pr_word{font-size:34px;font-weight:800;text-align:center;letter-spacing:2px;margin:22px 0 6px}'
      + '#' + ID + ' .pr_cn{text-align:center;color:#94a3b8;margin-bottom:18px}'
      + '#' + ID + ' .pr_in{width:100%;box-sizing:border-box;padding:14px;font-size:19px;border-radius:12px;'
      + 'border:2px solid #334155;background:#0b1220;color:#e2e8f0;text-align:center;letter-spacing:2px}'
      + '#' + ID + ' .pr_pg{text-align:center;color:#94a3b8;font-size:13px;margin-top:12px}'
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
      + '<button class="pr_btn" id="prNew">➕ 自己开一间，等人来打</button>'
      + '<button class="pr_btn pr_btn2" id="prRef">🔄 刷新房间列表</button>'
      + '<div id="prList"><div class="pr_empty">正在找房间…</div></div>');
    wireErr();
    if (q('prBack')) q('prBack').onclick = close;
    /* v1100：先选玩法再开房 —— 三种规则差别很大，不能默默替房主决定 */
    if (q('prNew')) q('prNew').onclick = function () {
      chooseMode(function (mode) { _pickedMode = mode; doCreate(); });
    };
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
  function chooseMode(onPick) {
    var MODES = (S() && S().MODES) || {};
    var cards = ['A', 'B', 'C'].map(function (k) {
      var m = MODES[k];
      if (!m) return '';
      return '<div class="pr_mode" data-mode="' + k + '" style="border:1px solid #334155;'
        + 'border-radius:14px;padding:12px 14px;margin:10px 0;cursor:pointer;background:#111827">'
        + '<div style="font-size:17px;font-weight:800;color:#e2e8f0">'
        + m.emoji + ' ' + esc(m.name)
        + (m.ranked ? '<span style="font-size:12px;color:#fbbf24;margin-left:8px">⭐ 计天梯</span>' : '')
        + '</div>'
        + '<div style="font-size:13px;color:#94a3b8;margin:4px 0 8px">' + esc(m.tagline) + '</div>'
        + '<ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.75;color:#cbd5e1">'
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
        + 'border:1px solid ' + (on ? '#6366f1' : '#334155') + ';border-radius:12px;'
        + 'padding:10px 6px;cursor:pointer;background:' + (on ? '#1e1b4b' : '#111827') + '">'
        + '<div style="font-size:22px">' + a.emoji + '</div>'
        + '<div style="font-size:14px;font-weight:700;color:#e2e8f0">' + esc(a.name) + '</div>'
        + '<div style="font-size:11.5px;color:#94a3b8;margin-top:2px">' + esc(a.tip) + '</div></div>';
    }).join('');

    paint('<div class="pr_top"><div class="pr_h">选个玩法</div>'
      + '<div class="pr_sub">三种规则差别很大，选你喜欢的</div></div>'
      + '<div style="font-size:13px;color:#94a3b8;margin:6px 0 4px">怎么出题</div>'
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
    S().createRoom({ tier: tier, mode: _pickedMode, askMode: _askMode }).then(function (r) {
      if (!r.ok) { lobby(r); return; }
      _state = { roomId: r.roomId, words: r.words, isHost: true };
      waiting(r.roomId);
    });
  }

  function waiting(roomId) {
    paint('<div class="pr_top"><button class="pr_back" id="prBack">← 关掉房间</button>'
      + '<div class="pr_h">⏳ 等对手进来</div></div>'
      + '<div class="pr_empty">房间已经开好了，别人在列表里就能看到你。<br>'
      + '等人进来就自动开打。<br><br>（关掉这一页，房间也会一起关掉）</div>');
    if (q('prBack')) q('prBack').onclick = close;
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
  var _rt = null;          /* 本回合的运行时状态 */
  var _pollTimer = null;

  function stopPoll() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
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
      +   '<span style="font-size:13px;color:#94a3b8">' + esc(M.emoji || '') + esc(M.name || '') + '</span>'
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
            + '<div style="font-size:13px;color:#94a3b8;margin-top:6px">点喇叭再听一次</div></div>'
          : '<div class="pr_cn" style="font-size:26px;margin:18px 0 6px">' + esc(w.cn || '') + '</div>'
            + '<div class="pr_word" style="letter-spacing:6px;font-size:22px;color:#93c5fd">'
            + esc(en.charAt(0)) + ' ' + '_ '.repeat(Math.max(0, en.length - 1)) + '</div>')
      + '<input class="pr_in" id="prIn" autocomplete="off" autocapitalize="off" '
      +   'autocorrect="off" spellcheck="false" placeholder="拼出这个词" '
      +   'style="font-size:20px;letter-spacing:2px;text-align:center">'
      + '<div id="prHint" style="min-height:24px;margin-top:10px;font-size:14px;color:#94a3b8">'
      +   '对手：<span id="prOppSt">正在拼…</span></div>');

    /* 听发音模式：一进来就读一遍，点喇叭可重听 */
    if (askIsTts) {
      setTimeout(function () { speak(en); }, 220);
      var spk = q('prSpk');
      if (spk) spk.onclick = function () { speak(en); };
    }

    var input = q('prIn');
    if (input) {
      try { input.focus(); } catch (e) {}
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
          if (h) { h.style.color = '#f87171'; h.textContent = '不对，再试试'; 
                   setTimeout(function () { if (h) { h.style.color = '#94a3b8';
                     h.innerHTML = '对手：<span id="prOppSt">正在拼…</span>'; } }, 900); }
        }
      };
    }

    /* 倒计时 + 轮询对手 */
    _pollTimer = setInterval(function () {
      if (!_rt || _rt.idx !== idx) return;
      var left = Math.max(0, Math.ceil((_rt.deadline - Date.now()) / 1000));
      var c = q('prClock');
      if (c) c.textContent = '⏱ ' + left + 's';
      if (left <= 0 && !_rt.answered) { submitRound(idx, false); return; }
      pollOpponent(idx);
    }, 1000);
  }

  /* 看对手抢到没有 —— 这是"对战感"的来源 */
  function pollOpponent(idx) {
    var st = _state;
    if (!st) return;
    S().roundState(st.roomId).then(function (r) {
      if (!r || !r.ok || !_rt || _rt.idx !== idx) return;
      var w = (r.winners || [])[idx];
      if (!w) return;
      var mySide = st.isHost ? 'host' : 'guest';
      var oppGot = (w !== mySide);
      var el = q('prOppSt');
      if (oppGot && el) { el.textContent = '⚡ 抢先拼对了！'; el.style.color = '#fbbf24'; }
      var M = (S() && S().modeOf) ? S().modeOf(st.mode) : { waitAll: true };
      /* A 模式：对手抢到就立刻翻篇，不等我 */
      if (oppGot && !M.waitAll && !_rt.answered) { submitRound(idx, false, true); }
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
      var my = q('prMy'); if (my) my.textContent = st.myScore;
      /* 本回合小结：让人看见"我快了多少" —— 这是正反馈 */
      var secs = ((Date.now() - _rt.t0) / 1000).toFixed(1);
      var h = q('prHint');
      if (h) {
        h.style.color = gain ? (first ? '#fbbf24' : '#34d399') : '#94a3b8';
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
    var secs = Math.max(1, Math.round((Date.now() - st.startAt) / 1000));
    /* 得分：答对数为主，用时做小幅加权，避免"慢慢磨"也拿满分 */
    var score = st.correct * 100 + Math.max(0, 300 - secs);
    paint('<div class="pr_top"><div class="pr_h">📨 交卷了</div></div>'
      + '<div class="pr_empty">你答对 ' + st.correct + ' / ' + st.words.length + ' 个，用时 ' + secs + ' 秒。<br>'
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
    var txt = r.result === 'win' ? '🎉 你赢了！' : (r.result === 'lose' ? '💪 这局输了' : '🤝 打平');

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
          myScore: r.mine, oppScore: r.theirs
        });
      }
    } catch (e) {}

    var extra = '';
    if (rec) {
      var sm = window.HansenPkRecord.summary();
      var dTxt = '';
      if (rec.ranked && rec.delta) {
        dTxt = '<div style="font-size:20px;font-weight:800;margin:6px 0;color:'
             + (rec.delta > 0 ? '#34d399' : '#f87171') + '">'
             + (rec.delta > 0 ? '+' : '') + rec.delta + ' 天梯分</div>';
      } else if (!rec.ranked) {
        dTxt = '<div style="font-size:12.5px;color:#94a3b8;margin:4px 0">'
             + '本局不计天梯（只有 ⚡ 抢答赛计分）</div>';
      }
      extra = dTxt
        + '<div style="font-size:13px;color:#cbd5e1;margin-top:8px">'
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

  window.HansenPkRoomUI = {
    /* 🔴v1099 测试注入口：直接进对战屏，不必真的匹配一个对手。
       没有这个口子，"对战屏到底能不能用"就只能靠两台真机去试 ——
       而那正是本项目最贵的教训（看不见现场就只能猜）。 */
    _startMatchForTest: function (words, oppName, askMode, mode) {
      if (askMode) _askMode = askMode;
      if (mode) _pickedMode = mode;
      _state = { roomId: 'test', words: words || [], oppName: oppName || '测试对手',
                 askMode: askMode || _askMode, mode: mode || _pickedMode,
                 idx: 0, correct: 0, startAt: Date.now() };
      startMatch();
      return true;
    }, open: function () { lobby(); }, close: close };
})();
