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
    if (q('prNew')) q('prNew').onclick = doCreate;
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
  function doCreate() {
    var btn = q('prNew');
    if (btn) { btn.disabled = true; btn.textContent = '正在开房…'; }
    var tier = '';
    try { var L = window.HansenSbLadder, P = window.HansenSbProfile;
          if (L && P) tier = L.tierOf(P.status().rating || 0).name; } catch (e) {}
    S().createRoom({ tier: tier }).then(function (r) {
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

  /* ── 屏 3：对战（v1099 起改用真正的拼写蜂）── */

  /* 🔴v1099：**对战玩法 = 拼写蜂，只是对手换成真人。**

     v1065 的对战屏是个自制的简陋版：一个纯文本输入框，
     没有发音、没有字母块、没有提示、没有连击、没有动画 ——
     而拼写蜂那套玩法用户已经玩熟了，凭空再造一个既不好玩也不一致。

     复用路径（读 spelling_bee.html 源码确认，**不改动那个文件**）：
       · 它在 embed 模式下从 `parent.allW` 读词表
       · 于是这里把房间的确定性词表挂到 window.allW，
         再用 iframe 打开 spelling_bee.html?embed=1&from=pk
       · 双方拿到的是同一颗种子生成的同一批词（wordsFromSeed），
         所以比的是"同一套题谁答得好"，公平

     结果回传：拼写蜂结束时会往 localStorage 写本局战果，
     这里轮询读取；同时留一条 postMessage 通道做快路径。 */

  var PK_RESULT_KEY = 'hansen_pk_bee_result';
  var _beeGiveUp = null;

  function startMatch() {
    if (_cancelWait) { try { _cancelWait(); } catch (e) {} _cancelWait = null; }
    var st = _state;
    if (!st) return;
    st.startAt = Date.now();

    /* 把本局词表交给拼写蜂 —— 它在 embed 模式下正是从 parent.allW 取词 */
    try {
      window.allW = (st.words || []).map(function (w) {
        return { en: w.en, cn: w.cn || '', pn: w.pn || '', emoji: '⚔️', isl: 'pk' };
      });
    } catch (e) {}

    /* 清掉上一局可能残留的战果，避免读到旧数据当成本局 */
    try { localStorage.removeItem(PK_RESULT_KEY); } catch (e) {}

    paint('<div class="pr_top"><div class="pr_h">⚔️ 对战中</div>'
      + '<div class="pr_sub">和 ' + esc(st.oppName || '对手') + ' 比同一套题 · '
      + '<span id="prBeeProg">已掌握 0 / ' + (st.words || []).length + '</span></div></div>'
      + '<div id="prBeeBox" style="position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483000;background:#0b1020"></div>');

    var box = q('prBeeBox');
    if (!box) { finishWith(0, 0); return; }
    var ifr = document.createElement('iframe');
    ifr.id = 'prBeeFrame';
    ifr.src = 'spelling_bee.html?embed=1&from=pk&island=pk&v=' + (window.__HSN_V || Date.now());
    ifr.style.cssText = 'width:100%;height:100%;border:0;display:block';
    ifr.setAttribute('allow', 'autoplay');
    box.appendChild(ifr);

    watchBeeResult();
  }

  /* 轮询拼写蜂写下的战果；同时接受 postMessage 快路径 */
  function watchBeeResult() {
    var done = false;
    function take(r) {
      if (done || !r) return;
      done = true;
      try { window.removeEventListener('message', onMsg); } catch (e) {}
      clearInterval(timer);
      var box = q('prBeeBox');
      if (box) box.innerHTML = '';
      finishWith(Number(r.correct) || 0, Number(r.total) || (_state ? _state.words.length : 0));
    }
    /* 🔴v1099：**不改 spelling_bee.html**（那是铁律），改为监听它已有的消息。

       实测源码确认它每掌握一个词就往父页发：
           postMessage({ type:'hsn_sb_mastery', word, index, ... })
       所以这里按 word 去重计数即可 —— 既拿到实时进度，
       又完全不需要动那个文件。 */
    var got = {};
    function onMsg(ev) {
      var d = ev && ev.data;
      if (!d) return;
      if (d.type === 'hsn-pk-bee-done') { take(d); return; }
      if (d.type === 'hsn_sb_mastery' && d.word && !got[d.word]) {
        got[d.word] = 1;
        var n = Object.keys(got).length;
        var total = (_state && _state.words) ? _state.words.length : 0;
        var bar = q('prBeeProg');
        if (bar) bar.textContent = '已掌握 ' + n + ' / ' + total;
        /* 全部掌握 → 本局结束 */
        if (total && n >= total) take({ correct: n, total: total });
      }
    }
    /* 用户中途退出也要交卷，否则对手会一直等 */
    _beeGiveUp = function () { take({ correct: Object.keys(got).length,
                                      total: (_state && _state.words) ? _state.words.length : 0 }); };
    try { window.addEventListener('message', onMsg); } catch (e) {}
    var timer = setInterval(function () {
      try {
        var raw = localStorage.getItem(PK_RESULT_KEY);
        if (raw) take(JSON.parse(raw));
      } catch (e) {}
    }, 700);
    /* 兜底：拼写蜂若因任何原因没回报，10 分钟后按 0 分交卷，不把人卡死 */
    setTimeout(function () { if (!done) take({ correct: 0, total: 0 }); }, 10 * 60 * 1000);
  }

  function finishWith(correct, total) {
    var st = _state;
    if (!st) return;
    st.correct = correct;
    if (total) st.total = total;
    finish();
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
    paint('<div class="pr_res">' + txt + '</div>'
      + '<div class="pr_empty">你 ' + r.mine + ' 分 · 对手 ' + r.theirs + ' 分</div>'
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
    _startMatchForTest: function (words, oppName) {
      _state = { roomId: 'test', words: words || [], oppName: oppName || '测试对手',
                 idx: 0, correct: 0, startAt: Date.now() };
      startMatch();
      return true;
    }, open: function () { lobby(); }, close: close };
})();
