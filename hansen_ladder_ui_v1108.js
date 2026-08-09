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


  /* ── 🔴v1110 亮色/暗色主题 ──────────────────────────────────

     全站早就有配色系统（`hansen_palette.js`）：选亮色系时
     `<html>` 会加上 `hsn-pal-light` 类。
     但我 v1107/v1108 新做的界面**全是写死的深色十六进制**，
     在亮色模式下会是一块突兀的黑 —— 用户切了主题却有几屏不跟着变。

     ⚠️ 变量名必须带独有前缀：第一版我用了 `--fr-txt`，
        而**全站 palette 已经在用这个名字**（亮色下它是 #ffffff），
        于是我的标题在亮色模式下变成白底白字、对比度 1.0 完全看不见。
        改用 `--hpk-*` 前缀，与任何既有变量都不重名。

     改法：把颜色收进一组变量，亮色系下整组换掉。
     **不是给每个元素单独写 !important 覆盖**（那会越堆越乱），
     而是让所有样式都只引用变量，主题只负责改变量。 */
  var THEME_VARS =
    'html:root{' +
      '--hpk-bg:#0b1020;--hpk-card:#111827;--hpk-line:#1f2937;' +
      '--hpk-txt:#e8eefc;--hpk-dim:#a9b4c7;--hpk-faint:#7c879b;' +
      '--hpk-in-bg:#0b1020;--hpk-in-line:#334155;' +
      '--hpk-btn2:#1f2937;--hpk-btn2-txt:#cbd5e1;' +
      '--hpk-av:#1e293b;--hpk-av-on:#312e81;--hpk-accent:#4f46e5;' +
      '--hpk-sel-bg:#1e1b4b;--hpk-ok:#34d399;--hpk-bad:#f87171' +
    '}' +
    'html.hsn-pal-light:root, html.hsn-pal-light{' +
      '--hpk-bg:#f4f6fb;--hpk-card:#ffffff;--hpk-line:#e3e7ee;' +
      '--hpk-txt:#0f172a;--hpk-dim:#4b5563;--hpk-faint:#6b7280;' +
      '--hpk-in-bg:#f9fafb;--hpk-in-line:#cbd5e1;' +
      '--hpk-btn2:#eef1f6;--hpk-btn2-txt:#1f2937;' +
      '--hpk-av:#e8ecf5;--hpk-av-on:#dbe1ff;--hpk-accent:#4338ca;' +
      '--hpk-sel-bg:#e8ecff;--hpk-ok:#047857;--hpk-bad:#b91c1c' +
    '}';

      /* 🔴v1110：这几条必须 !important。
         全站 palette 在亮色系下有一批 `color:#fff!important` 的规则
         （为了让深色卡片上的白字在任何配色下都可读）。
         我们这几屏是**自己的深/浅底**，被那批规则波及会变成白底白字。
         只给"标题/数值"这类关键文字加，不滥用 —— 其余仍走变量级联。 */
  function css() {
    if (q('hsn_ld_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_ld_css';
    st.textContent = THEME_VARS +
      '#' + ID + '{position:fixed;inset:0;z-index:2147482000;background:var(--hpk-bg);display:none;' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}' +
      '#' + ID + '.on{display:block}' +
      'html .ld_wrap{max-width:520px;margin:0 auto;padding:16px 14px 40px}' +
      'html .ld_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}' +
      'html .ld_h{font-size:20px;font-weight:900;color:var(--hpk-txt)!important;flex:1}' +
      'html .ld_x{background:none;border:0;color:var(--hpk-dim);font-size:26px;cursor:pointer;padding:0 6px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center}' +
      'html .ld_card{background:var(--hpk-card);border:1px solid var(--hpk-line);border-radius:16px;padding:16px 14px;margin-bottom:12px}' +
      'html .ld_tier{text-align:center;padding:22px 14px}' +
      'html .ld_te{font-size:52px;line-height:1}' +
      'html .ld_tn{font-size:24px;font-weight:900;color:var(--hpk-txt)!important;margin-top:6px}' +
      'html .ld_ts{font-size:14px;color:var(--hpk-dim)!important;margin-top:4px}' +
      'html .ld_grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      'html .ld_kv{background:var(--hpk-bg);border:1px solid var(--hpk-line);border-radius:12px;padding:11px 12px}' +
      'html .ld_k{font-size:11.5px;color:var(--hpk-dim)!important}' +
      'html .ld_v{font-size:20px;font-weight:800;color:var(--hpk-txt)!important;margin-top:3px}' +
      'html .ld_vs{font-size:12px;color:var(--hpk-faint);font-weight:400;margin-left:3px}' +
      'html .ld_btn{width:100%;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border:0;' +
        'border-radius:14px;padding:15px;font-size:17px;font-weight:800;cursor:pointer;margin-bottom:10px}' +
      'html .ld_btn2{background:var(--hpk-line);color:var(--hpk-btn2-txt);font-size:15px;padding:12px}' +
      'html .ld_lbl{font-size:12.5px;color:var(--hpk-dim)!important;margin-bottom:9px}' +
      'html .ld_hi{display:flex;justify-content:space-between;align-items:center;padding:9px 2px;' +
        'border-bottom:1px solid var(--hpk-line);font-size:13.5px}' +
      'html .ld_hi:last-child{border-bottom:0}' +
      'html .ld_w{color:var(--hpk-ok);font-weight:700}.ld_l{color:var(--hpk-bad);font-weight:700}' +
      'html .ld_bar{height:7px;background:var(--hpk-line);border-radius:99px;overflow:hidden;margin-top:6px}' +
      'html .ld_bar i{display:block;height:100%;background:linear-gradient(90deg,#6366f1,#22d3ee)}';
    document.head.appendChild(st);
  }


  /* ── 🔴v1116 浮层无障碍：Esc 关闭 / 焦点收拢 / 锁背景滚动 ──

     实测挑出四处：
       · **Esc 关不掉** —— 键盘用户只能用鼠标去点那个「×」
       · **Tab 会跑到浮层后面** —— 焦点逃到被遮住的按钮上，
         读屏用户会完全迷路（他看不见浮层，只听到在念背景里的东西）
       · **背景能跟着滚** —— 手指滑动时底下的页面也在动
       · **打开时焦点还在原来的按钮上** —— 读屏不会播报"弹出了新界面"

     这四条对看得见的人只是"有点别扭"，
     **对视障用户是"根本用不了"**。 */
  var _a11y = null;

  function a11yOn(rootEl, onEsc) {
    a11yOff();
    if (!rootEl) return;
    var prevFocus = document.activeElement;
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';          /* 锁背景滚动 */
    rootEl.setAttribute('aria-modal', 'true');

    function focusables() {
      return [].slice.call(rootEl.querySelectorAll(
        'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      )).filter(function (e) { return e.offsetParent !== null && !e.disabled; });
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); if (onEsc) onEsc(); return; }
      if (ev.key !== 'Tab') return;
      var list = focusables();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      /* 焦点收拢：Tab 到尾就回到头，Shift+Tab 到头就回到尾 —— 出不去 */
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      else if (!rootEl.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);

    /* 打开后把焦点放进来 —— 读屏才会播报这是个新界面 */
    setTimeout(function () {
      var list = focusables();
      if (list.length) { try { list[0].focus(); } catch (e) {} }
    }, 60);

    _a11y = function () {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      try { rootEl.removeAttribute('aria-modal'); } catch (e) {}
      /* 关掉后焦点还给原来那个按钮 —— 否则读屏用户会"掉"到页面开头 */
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
    };
  }

  function a11yOff() { if (_a11y) { try { _a11y(); } catch (e) {} _a11y = null; } }

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
    a11yOn(el, close);
  }
  function close() {
    try { setTimeout(refreshEntry, 60); } catch (e) {}
    a11yOff();
    if (_cancel) { try { _cancel(); } catch (e) {} _cancel = null; }
    /* v1155: 上哨 —— 接下来这一串如果哪一步废了，看门狗会把人救出来 */
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('排位'); } catch (e) {}
    var el = q(ID); if (el) el.classList.remove('on');
  }

  /* ── 主屏 ─────────────────────────────────────────────── */

  /* 🔴v1113：**打开自己之前先关掉同级的另一屏。**

     实测：天梯页和好友页能同时开着，而且 z-index 一模一样
     （都是 2147482000）—— 谁盖在上面全看 DOM 插入顺序，
     用户会看到两屏叠在一起、点击穿透到下面那屏。

     这类"全屏浮层"必须互斥：打开一个就关掉另一个。
     不靠调 z-index 谁高谁低 —— 那只是把问题藏起来，
     下面那屏仍然存在、仍在跑它的轮询定时器。 */
  function closePeers() {
    var peers = ['HansenFriendsUI', 'HansenLadderUI', 'HansenPkRoomUI'];
    peers.forEach(function (n) {
      try {
        var m = window[n];
        if (m && m !== window.HansenLadderUI && typeof m.close === 'function') m.close();
      } catch (e) {}
    });
  }

  var _netFail = 0;

  function open() {
    closePeers();
    var sm = R() ? R().summary() : null;
    /* 🔴v1156：**"模块还没就绪"用 alert 报最没道理。**
       这种情况用户什么也做不了，弹个窗让他点"确定"毫无意义 ——
       他只会更困惑："确定什么？"
       改成在页面上说清楚，并给一个真能解决问题的动作。 */
    if (!sm) {
      paint('<div class="ld_top"><button aria-label="关闭" class="ld_x" id="ldX">×</button>'
        + '<div class="ld_h">🏆 天梯排位</div></div>'
        + '<div style="text-align:center;padding:26px 12px">'
        +   '<div style="font-size:40px">⏳</div>'
        +   '<div style="font-size:15px;font-weight:800;margin-top:10px">还在准备中</div>'
        +   '<div style="font-size:13px;color:var(--hpk-dim);margin-top:8px;line-height:1.8">'
        +     '战绩还没读出来，多半是刚打开页面。<br>等一两秒再点一次就好。</div>'
        +   '<button class="ld_btn" id="ldRetryOpen" style="margin-top:16px">再试一次</button>'
        + '</div>');
      var _rb = q('ldRetryOpen');
      if (_rb) _rb.onclick = function () { setTimeout(open, 300); };
      var _cx = q('ldX');
      if (_cx) _cx.onclick = close;
      return;
    }

    var t = sm.tier;
    var need = (L() && L().PLACEMENT_GAMES) || 5;

    paint(
      '<div class="ld_top"><div class="ld_h">🏆 天梯排位</div>'
      + '<button aria-label="关闭天梯排位" class="ld_x" id="ldX">×</button></div>'

      /* 段位 */
      + '<div class="ld_card ld_tier">'
      +   '<div class="ld_te">' + t.emoji + '</div>'
      +   '<div class="ld_tn">' + esc(t.name) + '</div>'
      +   '<div class="ld_ts">' + esc(t.sub) + '</div>'
      +   (sm.placed && sm.peakRating > sm.rating
            ? '<div style="font-size:12px;color:var(--hpk-faint);margin-top:6px">'
              + '历史最高 ' + sm.peakRating + ' 分</div>' : '')
      +   (!sm.placed
            ? '<div class="ld_bar" style="margin:12px 20px 0"><i style="width:'
              + Math.min(100, Math.round(sm.placementGames * 100 / need)) + '%"></i></div>'
              + '<div style="font-size:12px;color:var(--hpk-dim);margin-top:6px">'
              + '定级赛 ' + sm.placementGames + ' / ' + need + '</div>' : '')
      + '</div>'

      + '<button class="ld_btn" id="ldGo">⚡ 开始排位（找实力差不多的对手）</button>'
      + '<div style="font-size:11.5px;color:var(--hpk-faint);text-align:center;margin:-4px 0 14px;line-height:1.6">'
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
            +   '<div style="font-size:15px;color:var(--hpk-txt);margin-top:8px">还没打过排位</div>'
            +   '<div style="font-size:12.5px;color:var(--hpk-dim);margin-top:8px;line-height:1.9">'
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
      /* 🔴v1156：这一格原来把"最高连胜"和"当前连胜"两个数字挤在一起，
         同一件事说了两遍，占一整格却没多给信息。
         改为：**正在连胜时就报当前的**（那是此刻最有意思的数字），
         没在连胜时才退回报历史最高。 */
      +     (sm.streak >= 2
              ? kv('当前连胜', '🔥 ' + sm.streak + '<span class="ld_vs">连</span>',
                   '历史最高 ' + sm.bestStreak + ' 连')
              : kv('最高连胜', sm.bestStreak + '<span class="ld_vs">连</span>',
                   sm.bestStreak > 0 ? '再赢 2 局重新点燃 🔥' : '还没连胜过'))
      +   '</div></div>')

      /* 🔴v1156 升段进度。
         原来只显示"工蜂 1062 分" —— 一个孤零零的数字，
         **不知道离下一段还差多远，也就没有"再打两局就能升"的推力**。
         段位的意义不只是贴个标签，是给一个**看得见的下一步**。

         已经是最高段就不画 —— 一个永远填不满的条只会让人困惑。 */
      + nextTierBlock(sm)

      /* 🔴v1156 排行榜。
         原来天梯页只显示"我 1062 分"，**看不到自己排第几** ——
         而天梯的核心动力恰恰是"我比别人强多少"。

         先画一个占位，数据异步拉回来再填 ——
         **不让榜单拖慢天梯页的打开**：
         用户点进来是要打排位的，不是来等榜的。 */
      + '<div class="ld_card" id="ldBoardCard">'
      +   '<div class="ld_lbl">🏅 排行榜</div>'
      +   '<div id="ldBoard" style="color:var(--hpk-dim);font-size:13px;'
      +     'text-align:center;padding:14px">正在看看大家打得怎么样…</div>'
      + '</div>'

      /* 最近对局 */
      + '<div class="ld_card">'
      +   '<div class="ld_lbl">最近对局</div>'
      +   (sm.history.length ? sm.history.slice(0, 8).map(hiRow).join('')
           : '<div style="color:var(--hpk-dim);font-size:13.5px;text-align:center;padding:14px">'
             + '还没打过。点上面的按钮开始第一局。</div>')
      + '</div>'
    );

    /* v1156: 异步把榜填上 —— 拿不到就安静降级，天梯照常能用 */
    renderBoard();

    if (q('ldX')) q('ldX').onclick = close;
    if (q('ldGo')) q('ldGo').onclick = startMatching;
  }

  function kv(k, v, sub) {
    return '<div class="ld_kv"><div class="ld_k">' + esc(k) + '</div>'
      + '<div class="ld_v">' + v + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--hpk-faint);margin-top:2px">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function hiRow(h) {
    var w = h.result === 'win', d = h.result === 'draw';
    var ago = timeAgo(Date.now() - (h.at || 0));
    return '<div class="ld_hi">'
      + '<span class="' + (w ? 'ld_w' : (d ? '' : 'ld_l')) + '">'
      +   (w ? '胜' : (d ? '平' : '负')) + '</span>'
      + '<span style="flex:1;margin:0 10px;color:var(--hpk-btn2-txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      +   esc(h.opp || '对手') + '</span>'
      + '<span style="color:var(--hpk-faint);font-size:12px;margin-right:8px">' + h.my + ':' + h.oc + '</span>'
      + (h.ranked && h.delta
          ? '<span style="color:' + (h.delta > 0 ? 'var(--hpk-ok)' : 'var(--hpk-bad)') + ';font-size:12.5px;width:42px;text-align:right">'
            + (h.delta > 0 ? '+' : '') + h.delta + '</span>'
          : '<span style="color:var(--hpk-faint);font-size:11.5px;width:42px;text-align:right">不计分</span>')
      + '<span style="color:var(--hpk-faint);font-size:11px;width:52px;text-align:right">' + ago + '</span>'
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
  /* ── 🔴v1156 排行榜渲染 ────────────────────────────────

     几条刻意的克制：

     · **异步填，不挡住天梯页**
       用户点进来是要打排位的，不是来等榜的。

     · **拿不到就安静降级**
       没网 / 没登录 / 云端抽风时，只是这一块显示"暂时看不到"，
       其余功能照常。**排行榜是锦上添花，
       不能因为它拿不到就让人打不了排位。**

     · **自己那一行高亮**
       榜的意义是"我在哪儿"，一眼找不到自己就白做了。

     · **不在前 20 时，单独去数一次名次**
       只数"比我分高的有几个"，一次 count 比拉全表便宜得多。
       没有这一步的话，第 21 名看到的就是一个和自己无关的榜。 */
  /* ── 🔴v1156 升段进度条 ──────────────────────────── */
  function nextTierBlock(sm) {
    try {
      if (!sm || !sm.placed) return '';          /* 没定级不谈升段 */
      var L = window.HansenSbLadder;
      if (!L || !L.nextTierOf) return '';
      var nx = L.nextTierOf(sm.rating);
      if (!nx) {
        /* 已经封顶 —— 说句实话，别画一个永远满不了的条 */
        return '<div class="ld_card" style="text-align:center;padding:13px">'
          + '<div style="font-size:14px;font-weight:800">🌟 已经是最高段位</div>'
          + '<div style="font-size:12.5px;color:var(--hpk-dim);margin-top:4px">'
          + '接下来就是守住它了</div></div>';
      }
      var pct = Math.round(nx.progress * 100);
      return '<div class="ld_card" style="padding:13px">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;'
        +   'font-size:13.5px;margin-bottom:8px">'
        +   '<span>距离 <b>' + nx.icon + ' ' + esc(nx.name) + '</b></span>'
        +   '<span style="font-weight:800">还差 ' + nx.need + ' 分</span>'
        + '</div>'
        /* 🔴v1156：**进度条要看得清。**
           原来 9px 高、纯色 —— 而它是这一页最重要的行动指引
           （"还差多少就能升段"是继续打下去最直接的理由）。
           加到 13px，并在进度末端点一个圆点标出"我在这儿"。 */
        + '<div style="position:relative;height:13px;border-radius:99px;'
        +   'background:rgba(255,255,255,.12);box-shadow:inset 0 1px 3px rgba(0,0,0,.35)">'
        +   '<div style="position:absolute;inset:0;width:' + pct + '%;border-radius:99px;'
        +     'background:linear-gradient(90deg,#6366f1,#a855f7);'
        +     'box-shadow:0 0 10px rgba(139,92,246,.5);transition:width .5s ease"></div>'
        +   (pct > 3 && pct < 97
              ? '<div style="position:absolute;top:50%;left:' + pct + '%;'
                + 'width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;'
                + 'background:#fff;box-shadow:0 0 0 2px #a855f7,0 1px 4px rgba(0,0,0,.5)">'
                + '</div>'
              : '')
        + '</div>'
        /* 给一句"还要打几局" —— 比"还差 138 分"更好懂。
           一局赢大约 +18 分，取整往上算，不夸大。 */
        + '<div style="font-size:12.5px;color:var(--hpk-dim);margin-top:7px;text-align:center">'
        +   '大约再赢 ' + Math.max(1, Math.ceil(nx.need / 18)) + ' 局'
        + '</div>'
        + '</div>';
    } catch (e) { return ''; }
  }

  function renderBoard() {
    var box = q('ldBoard');
    if (!box) return;
    var B = window.HansenLadderBoard;
    if (!B) { box.textContent = '排行榜还没就绪'; return; }

    B.fetchTop().then(function (r) {
      var box2 = q('ldBoard');
      if (!box2) return;                     /* 用户已经关掉了 */
      if (!r || !r.ok || !r.list || !r.list.length) {
        box2.innerHTML = '<div>暂时看不到排行榜</div>'
          + '<div style="font-size:12px;margin-top:5px;opacity:.75">'
          + (r && r.reason === 'not-signed-in' ? '登录之后就能看到大家的排名'
                                               : '可能是网络不太顺，等会儿再看看')
          + '</div>';
        return;
      }

      var me = '';
      try { me = (JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}') || {}).uid || ''; }
      catch (e) {}

      /* 🔴v1156：**同分要并列，不能假装有高下。**
         三个人都 1200 分时，谁前谁后其实是数据库返回顺序决定的 ——
         给他们分 🥇🥈🥉 是在编造一个不存在的差距。
         按分数重算名次：同分同名次，下一个跳号（1,1,1,4）。 */
      var ranked = [], lastRating = null, lastRank = 0;
      r.list.forEach(function (x, i) {
        if (x.rating === lastRating) x.rank = lastRank;      /* 同分同名次 */
        else { x.rank = i + 1; lastRating = x.rating; lastRank = x.rank; }
        ranked.push(x);
      });

      var rows = ranked.map(function (x) {
        var mine = (x.uid === me);
        /* 前三名给个牌子 —— 纯数字的榜看着没劲。
           但**同分并列时不发牌子**：三个"第一名"戴三块金牌很怪，
           改成显示名次数字，一眼能看出是并列。 */
        var tied = ranked.filter(function (y) { return y.rank === x.rank; }).length > 1;
        var badge = tied ? ('<span style="opacity:.7">' + x.rank + '</span>')
                  : x.rank === 1 ? '🥇' : x.rank === 2 ? '🥈' : x.rank === 3 ? '🥉'
                  : ('<span style="opacity:.6">' + x.rank + '</span>');
        /* 🔴v1156：**奖牌和名次数字要对齐。**
           奖牌是 emoji（字宽），名次是数字（字窄），
           左边缘对不齐时整列看着是歪的 ——
           一个 24px 的等宽格子 + 居中，两种内容都落在同一条线上。 */
        return '<div style="display:flex;align-items:center;gap:9px;padding:7px 9px;'
          + 'border-radius:10px;font-size:13.5px;'
          + (mine ? 'background:rgba(99,102,241,.18);font-weight:800' : '') + '">'
          +   '<span style="width:26px;flex:none;text-align:center;'
          +     'font-variant-numeric:tabular-nums;font-size:15px;line-height:1">'
          +     badge + '</span>'
          +   '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          +     esc(x.name) + (mine ? ' <span style="opacity:.8">(你)</span>' : '')
          +   '</span>'
          +   '<span style="flex:none;font-variant-numeric:tabular-nums">' + x.rating + '</span>'
          + '</div>';
      }).join('');

      box2.style.color = '';
      box2.style.padding = '2px';
      box2.style.textAlign = 'left';
      /* 🔴v1156：**榜上只有自己时，"第一名"没有意义。**
         给一个人发金牌有点尴尬 —— 说实话更好，
         而且"你是第一个"本身就是个不错的说法。 */
      box2.innerHTML = rows
        + (ranked.length === 1
            ? '<div style="font-size:12px;color:var(--hpk-dim);text-align:center;'
              + 'padding:8px 4px 4px">还没什么人上榜，你是第一个 🎈</div>'
            : '');

      /* 不在前 20 → 单独数一次自己的名次，
         否则第 21 名看到的是一个和自己无关的榜 */
      if (!r.myRank && B.myRoughRank) {
        B.myRoughRank().then(function (m) {
          var box3 = q('ldBoard');
          if (!box3 || !m || !m.ok) return;
          /* 🔴v1156：**和上面的榜之间要有分隔。**
             不然「第 2 名」紧接着「第 88 名」，
             看着像是名次连着的，而中间其实隔了八十几个人。 */
          var gap = document.createElement('div');
          gap.setAttribute('style',
            'text-align:center;color:var(--hpk-dim);font-size:15px;'
            + 'letter-spacing:3px;padding:3px 0 1px;opacity:.55');
          gap.textContent = '···';
          box3.appendChild(gap);

          var tip = document.createElement('div');
          tip.setAttribute('style',
            'margin-top:2px;padding:8px 9px;border-radius:10px;'
            + 'background:rgba(99,102,241,.18);font-size:13.5px;font-weight:800;'
            + 'display:flex;align-items:center;gap:9px');
          tip.innerHTML = '<span style="width:26px;text-align:center;flex:none;opacity:.6">'
            + m.rank + '</span><span style="flex:1">你</span>';
          box3.appendChild(tip);
        })['catch'](function () {});
      }
    })['catch'](function () {
      var box4 = q('ldBoard');
      if (box4) box4.textContent = '暂时看不到排行榜';
    });
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

       实测（连点三次「开始排位」）：**匹配根本没启动**，
       界面一直停在天梯首页，24 秒内一间房都没开。

       原因：`stop` 是每次调用的局部变量，而 `_cancel` 是模块级的共享变量。
       第二次点击时 `_cancel` 被覆盖成新的那份，
       **但第一次的循环还在跑**；接着第三次点击又覆盖一遍……
       几个循环互相踩，最后谁都没跑起来。

       用户手快点两下是极正常的事（尤其按钮没有即时反馈时），
       **不该因此整个功能失灵**。

       修法：进来先把上一次的循环停掉，再开新的。 */
    if (_cancel) { try { _cancel(); } catch (e) {} _cancel = null; }

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

      /* v1156: 标题和关闭键之间给点距离 —— 原来贴在一起像挤住了 */
      paint('<div class="ld_top" style="gap:12px">'
        + '<button aria-label="取消匹配" class="ld_x" id="ldCancel">×</button>'
        + '<div class="ld_h">⚡ 正在找对手…</div></div>'
        + '<div class="ld_card" style="text-align:center;padding:30px 14px">'
        /* 🔴v1156：**等待屏最需要的信号是"它还活着"。**
           原来放大镜是静止的 emoji ——
           用户等了十几秒看到画面一动不动，
           第一反应是"卡了吧"，然后就退出去了。

           轻微的左右摆动（像在四处找人），
           不用动画帧、不耗电，但一眼能看出系统在动。 */
        +   '<style>@keyframes hsnLdSeek{0%,100%{transform:rotate(-14deg) translateX(-6px)}'
        +     '50%{transform:rotate(14deg) translateX(6px)}}</style>'
        +   '<div style="font-size:44px;display:inline-block;'
        +     'animation:hsnLdSeek 1.8s ease-in-out infinite">🔍</div>'
        +   '<div style="font-size:16px;color:var(--hpk-txt);margin-top:10px">'
        +     '正在找 ' + Math.max(0, sm.rating - band) + ' ~ ' + (sm.rating + band) + ' 分的对手</div>'
        +   '<div style="font-size:13px;color:var(--hpk-dim);margin-top:8px">'
        +     '已等 ' + waited + ' 秒 · 等得越久范围放得越宽</div>'
        +   '<div style="font-size:11.5px;color:var(--hpk-faint);margin-top:14px;line-height:1.7">'
        +     '没人的时候会自动开一间等着<br>有人进来就立刻开打</div>'
        + '</div>'
        + '<button class="ld_btn ld_btn2" id="ldCancel2">取消，回天梯</button>');

      var cancel = function () { stop = true; open(); };
      if (q('ldCancel')) q('ldCancel').onclick = cancel;
      if (q('ldCancel2')) q('ldCancel2').onclick = cancel;

      /* 找现成的排位房：模式必须是 A，且分数在带宽内 */
      S().listRooms().then(function (lr) {
        if (stop) return;

        /* 🔴v1154：**listRooms 失败时不抛异常，而是返回 `{ok:false, rooms:[]}`。**

           所以下面那个 `.catch()` 永远进不去 —— **连不上网被当成"没有房间"**，
           于是界面永远停在"⚡ 正在找对手…"，用户一直等下去，
           **不知道是网断了**。实测断网 16 秒仍在转圈就是这么来的。

           判据要落在返回值上，不能只指望异常。 */
        if (lr && lr.ok === false) {
          _netFail = (_netFail || 0) + 1;
          if (_netFail >= 4) { showOffline(); return; }
          setTimeout(tick, 3000);
          return;
        }
        _netFail = 0;                       /* 通了就清零 */

        var rooms = (lr && lr.rooms) || lr || [];
        /* 🔴v1114：**hostRating 是客户端填的，不能全信。**

           实测：`createRoom({hostRating: 3999})` 传什么就存什么 ——
           改一下前端，新手就能把自己标成 3999 分的高手，
           别的新手匹配过来会被吊打。

           纯前端应用拦不住"有人改代码"，但可以让**收益变得很小**：
             · 分数被夹到合理区间（0~4000），填 1e99 没用
             · **超出自己带宽两倍的房间直接跳过** ——
               一个 1000 分的新手看到"3999 分"的房，本来也不该匹配上；
               谎报得越离谱，越会被自动过滤掉
           而谎报一个"接近真实"的分数，对匹配结果几乎没影响，也就没有作弊动机。 */
        var fit = rooms.filter(function (r) {
          if (r.mode !== 'A') return false;
          var raw = Number(r.hostRating);
          if (!isFinite(raw)) raw = 1000;
          var rr = Math.max(0, Math.min(4000, raw));      /* 夹到合理区间 */
          var gap = Math.abs(rr - sm.rating);
          if (gap > band * 2) return false;               /* 差太远：谎报也没用 */
          return gap <= band;
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
        /* v1155: 这个门槛做成可调 —— 测试里调到 2 秒，
           整条 E2E 从 135 秒降到十几秒。
           **跑得慢的测试等于没有测试**：它会被排到"重测试"里，
           在受限环境下反复超时、反复补跑，最后谁都不愿意跑全量。
           产品默认仍是 20 秒，只有测试会去改它。 */
        if (waited >= (window.__hsnLadderWaitSec || 20)) {
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
      })['catch'](function (e) {
        /* 🔴v1154：**一直连不上时要说出来，不能永远转圈。**

           实测（断网场景）：网一直不通时，界面永远停在
           "⚡ 正在找对手…"，用户会一直等下去，**不知道是网断了**。
           而排位是个"等着就好"的界面，本来就没有别的信号提示他。

           改为：连续失败 4 次（约 12 秒）就明说连不上，
           并给一个"再试一次"的按钮 —— 让人知道发生了什么、下一步做什么。 */
        if (stop) return;
        _netFail = (_netFail || 0) + 1;
        if (_netFail >= 4) {
          showOffline();
          return;
        }
        setTimeout(tick, 3000);
      });
    };

    /* v1154: 连不上时的那一屏 —— 让人知道发生了什么、下一步做什么 */
    function showOffline() {
      stop = true;
      try {
            paint('<div class="ld_top"><button aria-label="关闭" class="ld_x" id="ldCancel">×</button>'
              + '<div class="ld_h">🏆 天梯排位</div></div>'
              + '<div style="text-align:center;padding:24px 12px">'
              + '<div style="font-size:40px">📡</div>'
              + '<div style="font-size:16px;font-weight:800;margin-top:10px">连不上网络</div>'
              + '<div style="font-size:13px;color:var(--hpk-dim);margin-top:8px;line-height:1.8">'
              +   '排位需要联网找对手。<br>检查一下 Wi-Fi 或数据再试。</div>'
              + '<button class="ld_btn" id="ldRetry" style="margin-top:16px">重新找对手</button>'
              + '</div>');
            var rb = document.getElementById('ldRetry');
            if (rb) rb.onclick = function () { _netFail = 0; stop = false; tick(); };
        var cx = document.getElementById('ldCancel');
        if (cx) cx.onclick = close;
      } catch (e2) {}
    }

    tick();
  }

  /* ── 🔴v1156 入口卡片显示"我现在什么水平" ──────────────

     天梯入口原来是一段写死的 HTML：
     「系统按分数匹配对手，赢了涨分升段。
       幼蜂 → 工蜂 → 侦察蜂 → 守卫蜂 → 蜂王 → 传奇蜂王。」

     第一次看有用，**第二次之后就是一堆占位的字** ——
     而一个已经打过的人站在入口前，最想知道的是
     **"我现在什么水平"**，不是"这个玩法怎么算分"。

     所以：没打过 → 留着规则；打过了 → 换成成绩。
     只改描述那一行，标题和图标不动（那是入口的身份）。 */
  function refreshEntry() {
    try {
      var card = document.getElementById('pkLadder');
      if (!card) return;
      var d = card.querySelector('.pk_d');
      if (!d) return;
      var R = window.HansenPkRecord;
      if (!R || !R.summary) return;
      var sm = R.summary();
      if (!sm || !sm.total) return;            /* 没打过：规则原样留着 */

      if (!sm.placed) {
        var left = Math.max(1, 3 - (sm.placementGames || 0));
        d.textContent = '定级赛还差 ' + left + ' 局，打完就知道你在什么段位。';
        return;
      }
      var t = sm.tier || {};
      var line = (t.emoji || '🐝') + ' ' + (t.name || '工蜂') + ' · ' + sm.rating + ' 分';
      if (sm.streak >= 2) line += ' · 🔥 ' + sm.streak + ' 连胜';
      d.textContent = line + '　已打 ' + sm.total + ' 局 · 胜率 ' + sm.winRate + '%';
    } catch (e) {}
  }

  try {
    /* 页面稳定后刷一次；关掉天梯页回来时再刷一次（分数可能变了） */
    if (document.readyState === 'complete') setTimeout(refreshEntry, 800);
    else window.addEventListener('load', function () { setTimeout(refreshEntry, 800); });
  } catch (e) {}

  window.HansenLadderUI = { open: open, close: close, _refreshEntryForTest: refreshEntry };
})();
