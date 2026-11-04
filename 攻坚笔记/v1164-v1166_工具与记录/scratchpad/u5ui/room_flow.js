  /* cfg（v1164）：这一次开房的全部设定，显式传进来 ——
       自由房：{ mode, askMode, private }（来自选玩法那一屏）
       排位房：{ ladder:true, mode:'A', askMode:'cn', private:false, rating, t0, band, onOk, onFail } */
  function doCreate(cfg) {
    cfg = cfg || { mode: _pickedMode, askMode: _askMode, private: _wantPrivate };
    var lad = !!cfg.ladder;
    var btn = q('prNew');
    if (btn) { btn.disabled = true; btn.textContent = '正在开房…'; }
    var tier = '', rating = 0;
    /* v1164：分数从战绩模块读（资料模块没有 status()，原来这里永远取不到段位） */
    try { var L = window.HansenSbLadder, R = window.HansenPkRecord;
          rating = (R && R.summary) ? Number(R.summary().rating) || 0 : 0;
          if (L && L.tierOf && rating) tier = L.tierOf(rating).name; } catch (e) {}
    S().createRoom({ tier: tier, mode: cfg.mode, askMode: cfg.askMode, private: !!cfg.private,
                     /* 排位房写上自己的分供别人匹配；自由房不写（免得被排位的人当成排位房配进来） */
                     hostRating: lad ? (Number(cfg.rating) || rating || 1000) : 0 }).then(function (r) {
      if (!r || !r.ok) {
        if (lad) { ladderFail(cfg, r || { ok: false, reason: '房没开成' }); return; }
        lobby(r); return;
      }
      /* v1163: 把玩法一起存下来 —— 等待屏要显示「你开的是什么房」 */
      _state = { roomId: r.roomId, words: r.words, isHost: true, ladder: lad,
                 mode: (r.room && r.room.mode) || cfg.mode || 'C',
                 askMode: (r.room && r.room.askMode) || cfg.askMode || 'cn' };
      if (lad && typeof cfg.onOk === 'function') { try { cfg.onOk(); } catch (e) {} }
      waiting(r.roomId, (r.room && r.room.code) || '', cfg);
    });
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

    /* 每秒把「已等多久」刷一次 —— 排位从点「开始排位」那一刻算起，接得上前面的等待 */
    try {
      var _t0 = (lad && cfg.t0) || Date.now();
      if (_state && _state._waitTimer) clearInterval(_state._waitTimer);
      var _wt = setInterval(function () {
        var el = q('prWaited');
        if (!el) { clearInterval(_wt); return; }
        var sec = Math.round((Date.now() - _t0) / 1000);
        el.textContent = sec < 60
          ? ('已等 ' + sec + ' 秒')
          : ('已等 ' + Math.floor(sec / 60) + ' 分 ' + (sec % 60) + ' 秒');
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
    var WAIT_MS = 120000;
    if (_state && !_state._waitStart) _state._waitStart = Date.now();
    var left = WAIT_MS - (Date.now() - ((_state && _state._waitStart) || Date.now()));
    var st = _state;
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
        /* 数据层已经把房收掉了（不留「看得见、进去没人」的幽灵房） */
        clearWait(st);
        if (lad) { ladderBack('home', '暂时没有对手，等会儿再来'); return; }
        endWait(st);
        lobby({ reason: '等了两分钟还没人来，房间先关掉了。想玩就再开一间吧。' });
        return;
      }
      if (ev.error) {
        var fr = { ok: false, reason: ev.error, kind: ev.kind || kindOf({ reason: ev.error }), expired: !!ev.expired };
        clearWait(st);
        if (lad) { ladderBack('rematch', '', fr); return; }
        endWait(st, true); lobby(fr);
      }
    }, Math.max(15000, left), wopts);
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
  function doJoin(rid, btn, cfg) {
    cfg = cfg || null;
    var lad = !!(cfg && cfg.ladder);
    if (btn) { btn.disabled = true; btn.textContent = '进入中…'; }
    cancelJoin();
    var my = _joinSeq;
    _joiningRid = rid;
    paint('<div class="pr_top"><div class="pr_h">' + (lad ? '⚡ 排位 · 进房中' : '🚪 进房中') + '</div></div>'
      + '<div style="text-align:center;padding:26px 12px">'
      +   '<div style="font-size:40px">🚪</div>'
      +   '<div style="font-size:16px;font-weight:800;margin-top:10px">正在进房，等房主确认…</div>'
      +   '<div id="prJoinWait" style="font-size:13px;color:var(--pk-dim);margin-top:8px">已等 0 秒</div>'
      +   '<div style="font-size:12px;color:var(--pk-faint);margin-top:8px;line-height:1.7">'
      +     '房主那边点头了就开打，一般几秒钟</div>'
      +   '<button class="pr_btn pr_btn2" id="prJoinCancel" style="margin-top:18px">取消</button>'
      + '</div>');
    startTicker('prJoinWait', Date.now(), function (s) { return '已等 ' + s + ' 秒'; });
    if (q('prJoinCancel')) q('prJoinCancel').onclick = function () {
      /* 退座位：数据层会让这次进房以「已经退出」结束 */
      try { S().leaveRoom(rid); } catch (e) {}
    };
    var myRating = 0;
    try { myRating = Number(cfg && cfg.rating) || Number(window.HansenPkRecord.summary().rating) || 0; } catch (e) {}
    S().joinRoom(rid, { rating: myRating }).then(function (r) {
      if (my !== _joinSeq) return;            /* 已经取消 / 换了一次进房 */
      _joiningRid = '';
      stopTicker();
      if (!r || !r.ok) {
        r = r || { ok: false, reason: '没进去' };
        if (lad) { ladderFail(cfg, r); return; }
        _fromLadder = false;
        if (r.cancelled) { lobby(); return; }
        /* 🔴v1154：进不去要说人话，不能默默甩回列表 —— 列表顶上说原因，下面是刷新过的房间 */
        lobby(r);
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
                 _oppRating: Number(rm.hostRating) || 0 };
      startMatch();
    });
  }

