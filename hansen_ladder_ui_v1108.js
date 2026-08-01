/* hansen_ladder_ui_v1108.js —— 天梯排位：实力匹配 + 战绩页
 *
 * ═══ 两件事 ═══
 *
 * ① **点一下就匹配实力差不多的对手**
 *    不用挑房间、不用等人开房 —— 排位就该是"点击 → 开打"。
 *    匹配用 `HansenSbLadder.matchBand(等待秒数)`：
 *    刚开始只找 ±100 分内的，每等 5 秒放宽 50 分，最多 ±400。
 *    **越等越宽，而不是一上来就随便配** —— 前者保证公平，后者保证不空等。
 *
 * ② **战绩页回答"我到底强在哪"**
 *    只给胜负是不够的。真正有用的是：
 *      · 抢先率 —— 手速的直接指标（答对的词里有多少抢在对手前面）
 *      · 平均用时 / 最快一次 —— 熟练度
 *      · 正确率 —— 准度
 *      · 历史最高分 —— 掉下来了也看得见自己曾经到过哪
 *
 * ═══ 只有 A 抢答赛计天梯 ═══
 * 这是 v1100 定下的：排位就该是纯竞技，慢的一方 0 分。
 * 所以这里开的房**强制 mode='A'**，玩家不能选。
 */
(function () {
  'use strict';
  if (window.HansenLadderUI) return;

  var ID = 'hsn_ladder_screen';
  var _cancel = null;

  function R() { return window.HansenPkRecord; }
  function L() { return window.HansenSbLadder; }
  function S() { return window.HansenPkRoom; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function q(id) { return document.getElementById(id); }

  function css() {
    if (q('hsn_ld_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_ld_css';
    st.textContent =
      '#' + ID + '{position:fixed;inset:0;z-index:2147482000;background:#0b1020;display:none;' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}' +
      '#' + ID + '.on{display:block}' +
      '.ld_wrap{max-width:520px;margin:0 auto;padding:16px 14px 40px}' +
      '.ld_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}' +
      '.ld_h{font-size:20px;font-weight:900;color:#e2e8f0;flex:1}' +
      '.ld_x{background:none;border:0;color:#94a3b8;font-size:26px;cursor:pointer;padding:0 6px}' +
      '.ld_card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:16px 14px;margin-bottom:12px}' +
      '.ld_tier{text-align:center;padding:22px 14px}' +
      '.ld_te{font-size:52px;line-height:1}' +
      '.ld_tn{font-size:24px;font-weight:900;color:#e2e8f0;margin-top:6px}' +
      '.ld_ts{font-size:14px;color:#94a3b8;margin-top:4px}' +
      '.ld_grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.ld_kv{background:#0b1020;border:1px solid #1f2937;border-radius:12px;padding:11px 12px}' +
      '.ld_k{font-size:11.5px;color:#94a3b8}' +
      '.ld_v{font-size:20px;font-weight:800;color:#e2e8f0;margin-top:3px}' +
      '.ld_vs{font-size:12px;color:#64748b;font-weight:400;margin-left:3px}' +
      '.ld_btn{width:100%;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border:0;' +
        'border-radius:14px;padding:15px;font-size:17px;font-weight:800;cursor:pointer;margin-bottom:10px}' +
      '.ld_btn2{background:#1f2937;color:#cbd5e1;font-size:15px;padding:12px}' +
      '.ld_lbl{font-size:12.5px;color:#94a3b8;margin-bottom:9px}' +
      '.ld_hi{display:flex;justify-content:space-between;align-items:center;padding:9px 2px;' +
        'border-bottom:1px solid #1f2937;font-size:13.5px}' +
      '.ld_hi:last-child{border-bottom:0}' +
      '.ld_w{color:#34d399;font-weight:700}.ld_l{color:#f87171;font-weight:700}' +
      '.ld_bar{height:7px;background:#1f2937;border-radius:99px;overflow:hidden;margin-top:6px}' +
      '.ld_bar i{display:block;height:100%;background:linear-gradient(90deg,#6366f1,#22d3ee)}';
    document.head.appendChild(st);
  }

  function host() {
    var el = q(ID);
    if (el) return el;
    css();
    el = document.createElement('div');
    el.id = ID; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '天梯排位');
    document.body.appendChild(el);
    return el;
  }
  function paint(inner) {
    var el = host();
    el.innerHTML = '<div class="ld_wrap">' + inner + '</div>';
    el.classList.add('on');
  }
  function close() {
    if (_cancel) { try { _cancel(); } catch (e) {} _cancel = null; }
    var el = q(ID); if (el) el.classList.remove('on');
  }

  /* ── 主屏 ─────────────────────────────────────────────── */
  function open() {
    var sm = R() ? R().summary() : null;
    if (!sm) { alert('战绩模块还没就绪，稍等一下'); return; }

    var t = sm.tier;
    var need = (L() && L().PLACEMENT_GAMES) || 5;

    paint(
      '<div class="ld_top"><div class="ld_h">🏆 天梯排位</div>'
      + '<button class="ld_x" id="ldX">×</button></div>'

      /* 段位 */
      + '<div class="ld_card ld_tier">'
      +   '<div class="ld_te">' + t.emoji + '</div>'
      +   '<div class="ld_tn">' + esc(t.name) + '</div>'
      +   '<div class="ld_ts">' + esc(t.sub) + '</div>'
      +   (sm.placed && sm.peakRating > sm.rating
            ? '<div style="font-size:12px;color:#64748b;margin-top:6px">'
              + '历史最高 ' + sm.peakRating + ' 分</div>' : '')
      +   (!sm.placed
            ? '<div class="ld_bar" style="margin:12px 20px 0"><i style="width:'
              + Math.min(100, Math.round(sm.placementGames * 100 / need)) + '%"></i></div>'
              + '<div style="font-size:12px;color:#94a3b8;margin-top:6px">'
              + '定级赛 ' + sm.placementGames + ' / ' + need + '</div>' : '')
      + '</div>'

      + '<button class="ld_btn" id="ldGo">⚡ 开始排位（找实力差不多的对手）</button>'
      + '<div style="font-size:11.5px;color:#64748b;text-align:center;margin:-4px 0 14px;line-height:1.6">'
      +   '排位固定用「抢答赛」：谁先拼对谁得分<br>只有这个模式会加减天梯分'
      + '</div>'

      /* 🔴v1109 实力画像：**一局都没打过时不显示一屏 0%**。
         全新用户看到"胜率 0% · 抢先率 0% · 正确率 0%"是很打击人的，
         而且那不是他的实力，只是"还没开始"。
         改成一句鼓励 + 说明这些指标是干嘛的，让他知道打完能看到什么。 */
      + (sm.total === 0
          ? '<div class="ld_card">'
            + '<div class="ld_lbl">我的实力</div>'
            + '<div style="text-align:center;padding:16px 8px">'
            +   '<div style="font-size:34px">🎯</div>'
            +   '<div style="font-size:15px;color:#e2e8f0;margin-top:8px">还没打过排位</div>'
            +   '<div style="font-size:12.5px;color:#94a3b8;margin-top:8px;line-height:1.9">'
            +     '打完第一局就能看到：<br>'
            +     '⚡ 抢先率 —— 你有多少次抢在对手前面<br>'
            +     '⏱ 平均用时 —— 每个词你要想多久<br>'
            +     '🎯 正确率 —— 拼对了多少<br>'
            +     '🏅 最快一次 —— 你的巅峰手速'
            +   '</div>'
            + '</div></div>'
          : '<div class="ld_card">'
            + '<div class="ld_lbl">我的实力</div>'
            + '<div class="ld_grid">'
      +     kv('胜率', sm.winRate + '<span class="ld_vs">%</span>',
                sm.wins + ' 胜 ' + sm.losses + ' 负' + (sm.draws ? ' ' + sm.draws + ' 平' : ''))
      +     kv('抢先率', sm.firstRate + '<span class="ld_vs">%</span>',
                '答对的词里抢在前面 ' + sm.firstWins + ' 次')
      +     kv('平均用时', sm.avgSecs + '<span class="ld_vs">秒</span>', '每拼对一个词')
      +     kv('最快一次', sm.fastestSecs + '<span class="ld_vs">秒</span>', '你的巅峰手速')
      +     kv('正确率', sm.accuracy + '<span class="ld_vs">%</span>',
                sm.correct + ' / ' + sm.words + ' 个词')
      +     kv('最高连胜', sm.bestStreak + '<span class="ld_vs">连</span>',
                sm.streak >= 2 ? ('当前 🔥 ' + sm.streak + ' 连胜') : '当前无连胜')
      +   '</div></div>')

      /* 最近对局 */
      + '<div class="ld_card">'
      +   '<div class="ld_lbl">最近对局</div>'
      +   (sm.history.length ? sm.history.slice(0, 8).map(hiRow).join('')
           : '<div style="color:#94a3b8;font-size:13.5px;text-align:center;padding:14px">'
             + '还没打过。点上面的按钮开始第一局。</div>')
      + '</div>'
    );

    if (q('ldX')) q('ldX').onclick = close;
    if (q('ldGo')) q('ldGo').onclick = startMatching;
  }

  function kv(k, v, sub) {
    return '<div class="ld_kv"><div class="ld_k">' + esc(k) + '</div>'
      + '<div class="ld_v">' + v + '</div>'
      + (sub ? '<div style="font-size:11px;color:#64748b;margin-top:2px">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function hiRow(h) {
    var w = h.result === 'win', d = h.result === 'draw';
    var ago = timeAgo(Date.now() - (h.at || 0));
    return '<div class="ld_hi">'
      + '<span class="' + (w ? 'ld_w' : (d ? '' : 'ld_l')) + '">'
      +   (w ? '胜' : (d ? '平' : '负')) + '</span>'
      + '<span style="flex:1;margin:0 10px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      +   esc(h.opp || '对手') + '</span>'
      + '<span style="color:#64748b;font-size:12px;margin-right:8px">' + h.my + ':' + h.oc + '</span>'
      + (h.ranked && h.delta
          ? '<span style="color:' + (h.delta > 0 ? '#34d399' : '#f87171') + ';font-size:12.5px;width:42px;text-align:right">'
            + (h.delta > 0 ? '+' : '') + h.delta + '</span>'
          : '<span style="color:#475569;font-size:11.5px;width:42px;text-align:right">不计分</span>')
      + '<span style="color:#475569;font-size:11px;width:52px;text-align:right">' + ago + '</span>'
      + '</div>';
  }

  function timeAgo(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return m + '分前';
    var h = Math.floor(m / 60);
    if (h < 24) return h + '小时前';
    return Math.floor(h / 24) + '天前';
  }

  /* ── 实力匹配 ─────────────────────────────────────────────
     先找分数接近的现成房；找不到就自己开一间等 ——
     等的过程中**逐步放宽分差**（matchBand），
     既保证一开始尽量公平，又保证不会永远空等。 */
  function startMatching() {
    if (!S()) { alert('对战模块还没就绪'); return; }
    /* 🔴v1109：**没登录就先拦住。**
       原来会一路走到"请先登录再开房"才报错 —— 用户已经白等了 20 秒。
       在排队之前就检查，是对时间的尊重。 */
    var A = window.HansenAuth;
    var signed = false;
    try { signed = !!(A && A.isSignedIn && A.isSignedIn()); } catch (e) {}
    if (!signed) {
      if (window.confirm('排位要先登录（进度和段位才能跟着账号走）。现在去登录吗？')) {
        close();
        try { if (window.HansenAuthUI) HansenAuthUI.open(); } catch (e) {}
      }
      return;
    }
    var sm = R().summary();
    var t0 = Date.now();
    var stop = false;
    _cancel = function () { stop = true; };

    var tick = function () {
      if (stop) return;
      var waited = Math.round((Date.now() - t0) / 1000);
      var band = (L() && L().matchBand) ? L().matchBand(waited) : 200;

      paint('<div class="ld_top"><button class="ld_x" id="ldCancel">×</button>'
        + '<div class="ld_h">⚡ 正在找对手…</div></div>'
        + '<div class="ld_card" style="text-align:center;padding:30px 14px">'
        +   '<div style="font-size:44px">🔍</div>'
        +   '<div style="font-size:16px;color:#e2e8f0;margin-top:10px">'
        +     '正在找 ' + Math.max(0, sm.rating - band) + ' ~ ' + (sm.rating + band) + ' 分的对手</div>'
        +   '<div style="font-size:13px;color:#94a3b8;margin-top:8px">'
        +     '已等 ' + waited + ' 秒 · 等得越久范围放得越宽</div>'
        +   '<div style="font-size:11.5px;color:#64748b;margin-top:14px;line-height:1.7">'
        +     '没人的时候会自动开一间等着<br>有人进来就立刻开打</div>'
        + '</div>'
        + '<button class="ld_btn ld_btn2" id="ldCancel2">取消，回天梯</button>');

      var cancel = function () { stop = true; open(); };
      if (q('ldCancel')) q('ldCancel').onclick = cancel;
      if (q('ldCancel2')) q('ldCancel2').onclick = cancel;

      /* 找现成的排位房：模式必须是 A，且分数在带宽内 */
      S().listRooms().then(function (lr) {
        if (stop) return;
        var rooms = (lr && lr.rooms) || lr || [];
        var fit = rooms.filter(function (r) {
          if (r.mode !== 'A') return false;
          var rr = Number(r.hostRating) || 1000;
          return Math.abs(rr - sm.rating) <= band;
        });
        if (fit.length) {
          stop = true;
          close();
          try {
            if (window.HansenPkRoomUI && HansenPkRoomUI._joinForLadder) {
              HansenPkRoomUI._joinForLadder(fit[0]._id);
            } else if (window.HansenPkRoomUI) { HansenPkRoomUI.open(); }
          } catch (e) {}
          return;
        }
        /* 等满 20 秒还没找到 → 自己开一间排位房等人 */
        if (waited >= 20) {
          stop = true;
          close();
          try {
            if (window.HansenPkRoomUI && HansenPkRoomUI._createForLadder) {
              HansenPkRoomUI._createForLadder(sm.rating);
            } else if (window.HansenPkRoomUI) { HansenPkRoomUI.open(); }
          } catch (e) {}
          return;
        }
        setTimeout(tick, 2500);
      })['catch'](function () { if (!stop) setTimeout(tick, 3000); });
    };
    tick();
  }

  window.HansenLadderUI = { open: open, close: close };
})();
