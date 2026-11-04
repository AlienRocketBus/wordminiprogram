  /* ══ 🔴v1164 实力匹配（重写）══════════════════════════════════════
     真机上天梯从来没成功过一次。这一版把匹配这一段整个重做，几条要点：

       · **计时和找房分开**：「已等 N 秒」每秒自己跳；找房请求慢的时候屏幕也不会定住
       · **每次开始都从零算**：等待时间、失败次数都跟着这一次匹配，不会被上一次带过来
       · **先开的房先配**：从等得最久的那间开始试，被抢了就自动试下一间，不让孩子再点
       · **等 20 秒还没有就自己开一间**，等的时候数据层会去看有没有更早开的房（两人同时
         开始时按「先开的赢」收到同一间房里）
       · **失败按原因分开说**：断网 / 云端还没连上 / 登录过期 / 云端设置还差一步 ——
         说法不一样、给的出路也不一样（原来全混成「排位要先登录」或「连不上网络」） */
  var SESSION_WAIT_MS = 20000;   /* 云端会话还没好：最多悄悄重试 20 秒 */
  var _run = null;               /* 当前这一次匹配 */

  function kindOf(r) {
    try {
      if (r && typeof r.kind === 'string' && r.kind) return r.kind;
      if (S() && S().kindOf) return S().kindOf(r);
    } catch (e) {}
    return 'other';
  }
  /* `人话 ⟨原话⟩` → 原话（技术信息那一行显示它）；切不出来就用整句 */
  function rawOf(r) {
    var t = String((r && (r.reason || r.error || r.message)) || r || '');
    var m = /⟨([^⟩]+)⟩/.exec(t);
    return m ? m[1] : t;
  }
  function humanOf(r) {
    var t = String((r && (r.reason || r.error)) || '');
    var i = t.indexOf('⟨');
    return (i >= 0 ? t.slice(0, i) : t).trim();
  }
  function bandOf(waited) {
    return (L() && L().matchBand) ? L().matchBand(waited) : 200;
  }
  function stopRun() {
    var run = _run;
    _run = null;
    if (!run) return;
    run.stop = true;
    if (run.timer) { clearTimeout(run.timer); run.timer = null; }
    if (run.clock) { clearInterval(run.clock); run.clock = null; }
  }
  function later(run, ms) {
    if (run.stop) return;
    if (run.timer) clearTimeout(run.timer);
    run.timer = setTimeout(function () { run.timer = null; tick(run); }, ms);
  }
  function setLine(id, text, color) {
    var el = q(id);
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? '' : 'none';
    if (color) el.style.color = color;
  }
  /* 「刚才发生了什么」那一行：至少留 4 秒，别一闪而过 */
  function note(run, text) {
    run.note = text; run.noteAt = Date.now();
    setLine('ldNote', text);
  }

  function paintMatching(run) {
    var sm = run.sm, band = bandOf(0);
    /* v1156: 标题和关闭键之间给点距离 —— 原来贴在一起像挤住了 */
    paint('<div class="ld_top" style="gap:12px">'
      + '<button aria-label="取消匹配" class="ld_x" id="ldCancel">×</button>'
      + '<div class="ld_h">⚡ 正在找对手…</div></div>'
      + '<div class="ld_card" style="text-align:center;padding:30px 14px">'
      /* 🔴v1156：**等待屏最需要的信号是"它还活着"。**
         轻微的左右摆动（像在四处找人），不用动画帧、不耗电，但一眼能看出系统在动。 */
      +   '<style>@keyframes hsnLdSeek{0%,100%{transform:rotate(-14deg) translateX(-6px)}'
      +     '50%{transform:rotate(14deg) translateX(6px)}}</style>'
      +   '<div style="font-size:44px;display:inline-block;'
      +     'animation:hsnLdSeek 1.8s ease-in-out infinite">🔍</div>'
      +   '<div style="font-size:16px;color:var(--hpk-txt);margin-top:10px">'
      +     '正在找 <span id="ldBand">' + Math.max(0, sm.rating - band) + ' ~ ' + (sm.rating + band)
      +     '</span> 分的对手</div>'
      +   '<div id="ldWaited" style="font-size:13px;color:var(--hpk-dim);margin-top:8px">'
      +     '已等 0 秒 · 等得越久范围放得越宽</div>'
      +   '<div id="ldStatus" role="status" style="display:none;font-size:13px;color:var(--hpk-txt);'
      +     'margin-top:10px;line-height:1.7"></div>'
      +   '<div id="ldNote" style="display:none;font-size:13px;color:var(--hpk-dim);margin-top:8px;'
      +     'line-height:1.7"></div>'
      +   '<div id="ldSame" style="display:none;font-size:12.5px;color:var(--hpk-bad);margin-top:10px;'
      +     'line-height:1.7"></div>'
      +   '<div style="font-size:11.5px;color:var(--hpk-faint);margin-top:14px;line-height:1.7">'
      +     '没人的时候会自动开一间等着<br>有人进来就立刻开打</div>'
      + '</div>'
      + '<button class="ld_btn ld_btn2" id="ldCancel2">取消，回天梯</button>');
    var cancel = function () { stopRun(); open(); };
    if (q('ldCancel')) q('ldCancel').onclick = cancel;
    if (q('ldCancel2')) q('ldCancel2').onclick = cancel;
    if (run.note) setLine('ldNote', run.note);
  }

  /* 每秒刷一次「已等 N 秒」和分数范围 —— 只改文字，不重画（重画会丢焦点、闪屏） */
  function updateClock(run) {
    if (run.stop) return;
    var waited = Math.round((Date.now() - run.t0) / 1000);
    var band = bandOf(waited), sm = run.sm;
    setLine('ldWaited', '已等 ' + waited + ' 秒 · 等得越久范围放得越宽');
    var b = q('ldBand');
    if (b) b.textContent = Math.max(0, sm.rating - band) + ' ~ ' + (sm.rating + band);
    if (run.note && Date.now() - run.noteAt > 8000) { run.note = ''; setLine('ldNote', ''); }
  }

  function startMatching() {
    /* v1156: 同上 —— 说清楚 + 给个能点的，比弹窗强 */
    if (!S()) {
      var _b = q('ldGo');
      if (_b) {
        _b.disabled = true;
        _b.textContent = '对战模块还在加载…';
        setTimeout(function () {
          try { _b.disabled = false; _b.textContent = '⚡ 开始排位（找实力差不多的对手）'; }
          catch (e) {}
        }, 2500);
      }
      return;
    }

    /* 🔴v1154：**防重入 —— 手快点两下会把排位彻底废掉。**
       进来先把上一次的循环停掉，再开新的。 */
    if (_cancel) { try { _cancel(); } catch (e) {} _cancel = null; }
    stopRun();

    /* 🔴v1109：**没登录就先拦住。** 在排队之前就检查，是对时间的尊重。
       v1164：不再用 confirm 弹窗（手机上常被顺手划掉），直接给一屏「排位要先登录」。 */
    var A = window.HansenAuth;
    var signed = false;
    try { signed = !!(A && A.isSignedIn && A.isSignedIn()); } catch (e) {}
    if (!signed) { showNeedLogin(false); return; }

    var sm = R().summary();
    /* 🔴v1164：失败次数、开始时间都跟着「这一次」匹配 —— 原来是模块级的，
       上一次断网攒下的 3 次失败会让这一次第一下就跳「连不上网络」。 */
    _netFail = 0; _lastReason = '';
    var run = _run = { stop: false, t0: Date.now(), netFail: 0, sessT0: 0, busy: false,
                       sm: sm, note: '', noteAt: 0, timer: null, clock: null, tried: {} };
    _cancel = function () { stopRun(); };
    /* v1155: 上哨 —— 接下来这一串如果哪一步废了，看门狗会把人救出来 */
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('排位'); } catch (e) {}
    paintMatching(run);
    run.clock = setInterval(function () { updateClock(run); }, 1000);
    tick(run);
  }

  function tick(run) {
    if (run.stop || run.busy) return;
    var waited = Math.round((Date.now() - run.t0) / 1000);
    S().listRooms().then(function (lr) {
      if (run.stop || run.busy) return;
      /* 🔴v1154：**listRooms 失败时不抛异常，而是返回 `{ok:false}`** —— 判据要落在返回值上 */
      if (!lr || lr.ok === false) { onFail(run, lr || { ok: false, reason: '没有拿到房间列表' }); return; }
      run.netFail = 0; _netFail = 0; run.sessT0 = 0;
      setLine('ldStatus', '');
      /* 同一个账号在另一台手机上开着房：永远配不上（自己不能打自己），要说出来 */
      setLine('ldSame', (lr.sameAccount > 0)
        ? '同一个账号在另一台设备上开着房，要用另一个账号才能对战' : '');

      var rooms = (lr && lr.rooms) || [];
      var sm = run.sm;
      waited = Math.round((Date.now() - run.t0) / 1000);
      var band = bandOf(waited);
      /* 🔴v1114：**hostRating 是客户端填的，不能全信。**
           · 分数夹到合理区间（0~4000），填 1e99 没用
           · **超出自己带宽两倍的房间直接跳过** —— 谎报得越离谱，越会被自动过滤掉 */
      var fit = rooms.filter(function (r) {
        if (r.mode !== 'A') return false;
        if (run.tried[r._id]) return false;               /* 这一次匹配里已经试过、没进去的 */
        var raw = Number(r.hostRating);
        if (!isFinite(raw)) raw = 1000;
        var rr = Math.max(0, Math.min(4000, raw));      /* 夹到合理区间 */
        var gap = Math.abs(rr - sm.rating);
        if (gap > band * 2) return false;               /* 差太远：谎报也没用 */
        return gap <= band;
      });
      /* 🔴v1164：**先开的房先配**（等得最久的人先有对手）。列表本身是新的在前，
         原来只试 fit[0] —— 也就是最新开的那间，等得最久的人反而永远轮不到。 */
      fit.sort(function (a, b) {
        var ca = Number(a.createdAt) || 0, cb = Number(b.createdAt) || 0;
        if (ca !== cb) return ca - cb;
        return String(a._id) < String(b._id) ? -1 : 1;
      });
      if (fit.length) { tryRooms(run, fit, 0); return; }
      /* 等满 20 秒还没找到 → 自己开一间排位房等人
         v1155: 门槛可调 —— 测试里调到 2 秒；产品默认仍是 20 秒 */
      if (waited >= (window.__hsnLadderWaitSec || 20)) { selfHost(run); return; }
      later(run, 2500);
    })['catch'](function (e) {
      if (run.stop) return;
      onFail(run, { ok: false, reason: String((e && e.message) || e || '出错了') });
    });
  }

  /* 一间一间试：被抢了 / 房没了 / 房主没回应 → 自动试下一间，孩子不用再点 */
  function tryRooms(run, fit, i) {
    if (run.stop) return;
    var RU = window.HansenPkRoomUI;
    if (i >= fit.length || !RU || !RU._joinForLadder) { run.busy = false; later(run, 1500); return; }
    var x = fit[i];
    run.busy = true;
    run.tried[x._id] = 1;
    setLine('ldStatus', '找到对手「' + (x.hostName || '对手') + '」，正在进房…');
    var done = false;
    try {
      RU._joinForLadder(x._id, {
        rating: run.sm.rating,
        onOk: function () { done = true; stopRun(); hideQuiet(); },
        onFail: function (r) {
          if (done) return;
          done = true;
          run.busy = false;
          if (run.stop) return;
          setLine('ldStatus', '');
          if (r && r.cancelled) { stopRun(); open(); return; }   /* 孩子自己点了取消 */
          var k = kindOf(r);
          if (k === 'taken' || k === 'gone' || k === 'other' || k === 'self') {
            note(run, k === 'taken' ? '那间房刚被别人抢走了，接着帮你找…'
                    : k === 'gone' ? '那间房刚关了，接着帮你找…'
                    : k === 'self' ? '那是你自己账号开的房，接着找别人的…'
                    : ((humanOf(r) || '那间房没进去') + '，接着帮你找…'));
            tryRooms(run, fit, i + 1);
            return;
          }
          onFail(run, r);
        }
      });
    } catch (e) { run.busy = false; later(run, 2500); }
  }

  /* 等满 20 秒：自己开一间排位房等人（由对战界面接手显示「等对手进来」） */
  function selfHost(run) {
    var RU = window.HansenPkRoomUI;
    if (!RU || !RU._createForLadder) { later(run, 2500); return; }
    run.busy = true;
    setLine('ldStatus', '暂时没找到，正在开一间房等对手…');
    var done = false;
    try {
      RU._createForLadder(run.sm.rating, {
        t0: run.t0,
        band: function () { return bandOf(Math.round((Date.now() - run.t0) / 1000)); },
        onOk: function () { done = true; stopRun(); hideQuiet(); },
        onFail: function (r) {
          if (done) return;
          done = true;
          run.busy = false;
          if (run.stop) return;
          setLine('ldStatus', '');
          onFail(run, r);
        }
      });
    } catch (e) { run.busy = false; later(run, 2500); }
  }

  /* 🔴v1164：**按失败原因分流**（原来按字面找「登录 / 会话」，
     已经登录、只是云端会话还没好的孩子被告知「排位要先登录」）。 */
  function onFail(run, r) {
    if (run.stop) return;
    var k = kindOf(r);
    _lastReason = rawOf(r);
    if (k === 'expired') { showNeedLogin(true); return; }
    if (k === 'config') { showProblem('config', r); return; }
    if (k === 'session') {
      /* 账号是登录着的，只是云端会话还在准备 —— 悄悄多等一会儿，别吓人 */
      if (!run.sessT0) run.sessT0 = Date.now();
      if (Date.now() - run.sessT0 < SESSION_WAIT_MS) {
        setLine('ldStatus', '正在连接云端…');
        later(run, 2000);
        return;
      }
      showProblem('session', r);
      return;
    }
    run.netFail++;
    _netFail = run.netFail;
    if (run.netFail >= 4) { if (k === 'other') showProblem('other', r); else showOffline(); return; }
    setLine('ldStatus', k === 'other' ? '刚才没成功，正在重试…' : '网络不太顺，正在重试…');
    later(run, 3000);
  }

  /* 交给对战界面以后，天梯这一屏悄悄收起（不开别的屏、不上哨） */
  function hideQuiet() {
    a11yOff();
    var el = q(ID); if (el) el.classList.remove('on');
  }

  /* 🔴v1156：**登录问题要说登录问题，不能混进"连不上网络"。** */
  function showNeedLogin(expired) {
    stopRun();
    try {
      paint('<div class="ld_top"><button aria-label="关闭" class="ld_x" id="ldCancel">×</button>'
        + '<div class="ld_h">🏆 天梯排位</div></div>'
        + '<div style="text-align:center;padding:24px 12px">'
        +   '<div style="font-size:40px">🔑</div>'
        +   '<div style="font-size:16px;font-weight:800;margin-top:10px">'
        +     (expired ? '云端登录过期了' : '排位要先登录') + '</div>'
        +   '<div style="font-size:13px;color:var(--hpk-dim);margin-top:8px;line-height:1.8">'
        +     (expired
                ? '重新登录一次就能继续，<br>你的段位和战绩都还在。'
                : '排位要跟别人比，<br>所以得先有个账号记住你的分数。')
        +   '</div>'
        +   '<button class="ld_btn" id="ldGoLogin" style="margin-top:16px">'
        +     (expired ? '重新登录' : '去登录') + '</button>'
        +   '<button class="ld_btn ld_btn2" id="ldLater" style="margin-top:2px">先不弄</button>'
        +   (expired && _lastReason
              ? '<div style="margin-top:14px;font-size:11px;color:var(--hpk-faint);'
                + 'line-height:1.6;word-break:break-all">技术信息：'
                + esc(String(_lastReason).slice(0, 130)) + '</div>'
              : '')
        + '</div>');
      var gb = q('ldGoLogin');
      if (gb) gb.onclick = function () {
        try {
          close();
          if (window.HansenAuthUI && HansenAuthUI.open) HansenAuthUI.open();
        } catch (e) {}
      };
      var lb = q('ldLater');
      if (lb) lb.onclick = function () { open(); };
      var cx2 = q('ldCancel');
      if (cx2) cx2.onclick = close;
    } catch (e) {}
  }

  /* 断网、云端没连上、云端设置不对、别的问题 —— 各说各的，都给「技术信息」和一个出路 */
  var PROBLEM = {
    network: { icon: '📡', title: '连不上网络',
               body: '排位需要联网找对手。<br>检查一下 Wi-Fi 或数据再试。', btn: '重新找对手' },
    session: { icon: '☁️', title: '云端还没连上',
               body: '你已经登录了，只是云端这会儿还没准备好。<br>等几秒再点「再试一次」。', btn: '再试一次' },
    config:  { icon: '🛠️', title: '云端设置还差一步',
               body: '', btn: '再试一次' },
    other:   { icon: '⚠️', title: '这次没成功',
               body: '', btn: '再试一次' }
  };
  function showProblem(kind, r) {
    stopRun();
    var P = PROBLEM[kind] || PROBLEM.other;
    var human = humanOf(r);
    var body = P.body;
    if (kind === 'config') {
      /* 这不是孩子能修的 —— 告诉他把这一屏给老师看；数据层的话里写着该去控制台改什么 */
      body = esc(human.replace(/^云端设置还差一步：?/, '') || '云端数据库还没设置好。')
           + '<br><br>这不是你的问题，把这一屏截图发给负责的老师就好。';
    } else if (kind === 'other') {
      body = esc(human || '出了点小问题。') + '<br>等一会儿再点「再试一次」。';
    }
    try {
      paint('<div class="ld_top"><button aria-label="关闭" class="ld_x" id="ldCancel">×</button>'
        + '<div class="ld_h">🏆 天梯排位</div></div>'
        + '<div style="text-align:center;padding:24px 12px">'
        + '<div style="font-size:40px">' + P.icon + '</div>'
        + '<div style="font-size:16px;font-weight:800;margin-top:10px">' + P.title + '</div>'
        + '<div style="font-size:13px;color:var(--hpk-dim);margin-top:8px;line-height:1.8">' + body + '</div>'
        + '<button class="ld_btn" id="ldRetry" style="margin-top:16px">' + P.btn + '</button>'
        /* 🔴v1156（真机报的）：**把真实原因显示出来** —— 小字、灰色、不吓人，截个图就知道是哪一类 */
        + (_lastReason
            ? '<div style="margin-top:14px;font-size:11px;color:var(--hpk-faint);'
              + 'line-height:1.6;word-break:break-all;opacity:.85">'
              + '技术信息：' + esc(String(_lastReason).slice(0, 130)) + '</div>'
            : '')
        + '</div>');
      var rb = q('ldRetry');
      if (rb) rb.onclick = function () { startMatching(); };
      var cx = q('ldCancel');
      if (cx) cx.onclick = close;
    } catch (e2) {}
  }

  /* v1154: 连不上时的那一屏 —— 让人知道发生了什么、下一步做什么 */
  function showOffline() { showProblem('network', { reason: _lastReason }); }

  /* 🔴v1164：对战界面那边的排位流程走不下去时，回到天梯接着来。
       how = 'rematch'：接着找对手（不用孩子再点）
       how = 'home'：回天梯首页，带一句话（比如「暂时没有对手，等会儿再来」）
       r 是失败结果：按原因分流（断网 / 登录过期 / 云端设置……） */
  function fromRoom(how, text, r) {
    try {
      if (how === 'home') { stopRun(); open({ note: text || '' }); return; }
      open();
      startMatching();
      var run = _run;
      if (!run) return;
      if (text) note(run, text);
      if (r && r.ok === false) {
        var k = kindOf(r);
        if (k !== 'taken' && k !== 'gone' && k !== 'self' && k !== 'other') {
          if (run.timer) { clearTimeout(run.timer); run.timer = null; }
          onFail(run, r);
        }
      }
    } catch (e) {}
  }
