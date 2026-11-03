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
    /* 🔴v1164：z-index 要在「拼写大PK」屏（2147483400）之上、对战屏（2147483600）之下。
       原来是 2147482000 —— 岛屿页里天梯开在大PK屏**后面**，孩子点了「天梯排位」什么都看不见，
       「开始排位」也点不到（真机上天梯从来没用起来，这是第一道墙）。和好友页同一层。 */
    st.textContent = THEME_VARS +
      '#' + ID + '{position:fixed;inset:0;z-index:2147483500;background:var(--hpk-bg);display:none;' +
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
    /* 🔴v1164：关天梯**不上哨**。原来这里 arm —— 于是点 × 关掉天梯、
       或者打开好友页（它会先关天梯），6 秒后都会冒出「这一步没能打开」；
       救援屏的「回到大PK首页」又会调 close() 再上哨，没完没了。
       上哨挪到真正开始匹配的地方（startMatching）。
       而且要**撤哨**：刚点「开始排位」、看门狗还没来得及看一眼屏幕就点了 ×，
       哨还架着 —— 6 秒后它看见「什么都没画」就会冒出救援屏。自己点的关，不用救。 */
    try { if (window.HansenPkWatchdog && HansenPkWatchdog.disarm) HansenPkWatchdog.disarm(); } catch (e) {}
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
  var _lastReason = '';   /* v1156: 失败原因，显示在断网屏上供排查 */
  /* 🔴审查 UI-5：「开始排位」和「取消，回天梯」在同一个位置 —— 孩子手快点两下，
     第二下正好点在新冒出来的那个按钮上：开始了又马上取消 / 取消了又马上重新开始。
     上一个按钮点下去 0.6 秒内，这一屏的按钮不认。 */
  var _lastTapAt = 0;
  function tapOk() {
    var now = Date.now();
    if (now - _lastTapAt < 600) return false;
    _lastTapAt = now;
    return true;
  }

  /* opts（可选）：{ note: 顶上一行提示, autoStart: 打开就开始匹配 }。
     ⚠️ 也会被当 onclick 直接调 —— 那时传进来的是事件对象，要认得出来、不当 opts 用。 */
  function open(opts) {
    opts = (opts && typeof opts === 'object' && !('type' in opts && 'target' in opts)) ? opts : {};
    /* 回到首页 = 这一次匹配到此为止（否则后台的循环会自己去开房） */
    if (_cancel) { try { _cancel(); } catch (e) {} _cancel = null; }
    stopRun();
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
    var need = (L() && L().PLACEMENT_GAMES) || 3;

    paint(
      '<div class="ld_top"><div class="ld_h">🏆 天梯排位</div>'
      + '<button aria-label="关闭天梯排位" class="ld_x" id="ldX">×</button></div>'

      /* v1164：从对战那边回来时带一句话（比如「暂时没有对手」）—— 说清楚刚才发生了什么 */
      + (opts.note
          ? '<div class="ld_card" id="ldNoteHome" role="status" style="text-align:center;font-size:14px;'
            + 'line-height:1.7;color:var(--hpk-txt)">' + esc(opts.note) + '</div>'
          : '')

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
    if (q('ldGo')) q('ldGo').onclick = function () { if (tapOk()) startMatching(); };
    if (opts.autoStart) startMatching();
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
      /* 🔴v1156：**"没人上榜"和"拿不到榜"是两回事。**

         原来这两种情况共用一个分支，于是榜确实拉到了、
         但一个人都还没上（新服务、或者大家都没打满定级赛）时，
         界面说的是「暂时看不到排行榜 / 可能是网络不太顺」——
         **让人以为是坏了，其实一切正常。**

         > 空和错要分开说。
         > 把"什么都没有"说成"出问题了"，
         > 用户会去修一个根本不存在的问题（重启、换网、卸载重装）。 */
      if (r && r.ok && r.list && r.list.length === 0) {
        box2.innerHTML =
          '<div style="padding:6px 0">🌱 还没有人上榜</div>'
          + '<div style="font-size:12px;margin-top:5px;opacity:.75">'
          + '打满 3 局定级赛就能上榜，你可能是第一个</div>';
        return;
      }
      if (!r || !r.ok || !r.list || !r.list.length) {
        /* 🔴v1164：按出错的种类说清楚 —— 云端设置不对时说「网络不太顺」，老师会去查一个没坏的网 */
        var bk = (r && r.kind) || 'other';
        var raw = String((r && r.reason) || '');
        var tech = (raw.indexOf('⟨') >= 0) ? raw.slice(raw.indexOf('⟨') + 1).replace(/⟩\s*$/, '') : '';
        var why = (r && r.reason === 'not-signed-in') ? '登录之后就能看到大家的排名'
          : bk === 'config' ? ((r && r.text) || '云端设置还差一步') + '。这不是你的问题，截个图发给老师就好'
          : (bk === 'network' || bk === 'slow') ? '连不上网络，检查一下 Wi-Fi 或数据，等会儿再看看'
          : bk === 'session' ? '云端还没连上，等一会儿再打开看看'
          : bk === 'expired' ? '云端登录过期了，重新登录一次就能看到排名'
          : ((r && r.text) || '可能是网络不太顺，等会儿再看看');
        box2.innerHTML = '<div>暂时看不到排行榜</div>'
          + '<div style="font-size:12px;margin-top:5px;opacity:.75">' + esc(why) + '</div>'
          + (tech && bk !== 'expired' && r.reason !== 'not-signed-in'
              ? '<div style="font-size:11px;margin-top:4px;opacity:.6;word-break:break-all">技术信息：' + esc(tech) + '</div>' : '');
        return;
      }

      var me = '';
      try { me = (JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}') || {}).uid || ''; }
      catch (e) {}

      /* 🔴v1156：**同分要并列，不能假装有高下。**
         三个人都 1200 分时，谁前谁后其实是数据库返回顺序决定的 ——
         给他们分 🥇🥈🥉 是在编造一个不存在的差距。
         按分数重算名次：同分同名次，下一个跳号（1,1,1,4）。 */
      /* 🔴v1156：**UI 层也要截断，不能信数据层一定给 20 条。**

         模块里写着 TOP_N = 20，但那是**请求时的意图**，
         不是渲染时的保证 —— 数据层换个实现、云端多返回一批、
         或者别的地方直接调 fetchTop，UI 就会老老实实画 200 行。

         实测：塞 200 条进去，界面真画了 200 行，渲染耗时 1.6 秒。
         手机上滚不到底，而且**一屏塞两百个人对用户毫无意义** ——
         他只关心前几名和自己在哪。

         > 每一层都该对自己画出来的东西负责，
         > 而不是假设上一层已经把关了。 */
      var MAX_ROWS = 20;
      var list = (r.list || []).slice(0, MAX_ROWS);

      var ranked = [], lastRating = null, lastRank = 0;
      list.forEach(function (x, i) {
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
          /* 🔴v1156：**高亮那行反而更看不清。**
             实测对比度 3.8（需 4.5）—— 半透明紫底把背景提亮了，
             而文字颜色没跟着变，结果自己那行成了整个榜上最难读的一行。
             **恰恰是最该看清的那一行。**
             底色加深、文字改成接近纯白。 */
          + (mine ? 'background:rgba(79,70,229,.42);font-weight:800;color:#f5f7ff' : '') + '">'
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
    var cancel = function () { if (!tapOk()) return; stopRun(); open(); };
    if (q('ldCancel')) q('ldCancel').onclick = cancel;
    if (q('ldCancel2')) q('ldCancel2').onclick = cancel;
    if (run.note) setLine('ldNote', run.note);
  }

  /* 每秒刷一次「已等 N 秒」和分数范围 —— 只改文字，不重画（重画会丢焦点、闪屏） */
  function updateClock(run) {
    if (run.stop) return;
    var waited = Math.max(0, Math.floor((Date.now() - run.t0) / 1000));   /* 和等人那一屏同一个算法，交接时数字不跳 */
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
    /* 🔴审查 UI-10：页面在后台时不找房、不开房 —— 以前切到微信 20 秒后，后台照样自己开了一间排位房，
       别的孩子被配进来，对着一个不在的人打。回到前台再接着找；离开太久就先停下。 */
    if (document.visibilityState === 'hidden') {
      if (!run.hidAt) run.hidAt = Date.now();
      later(run, 1000);
      return;
    }
    if (run.hidAt) {
      var away = Date.now() - run.hidAt;
      run.hidAt = 0;
      if (away > 30000) { stopRun(); open({ note: '你切出去太久，先停下了。回来点「开始排位」再找对手。' }); return; }
    }
    var waited = Math.round((Date.now() - run.t0) / 1000);
    S().listRooms().then(function (lr) {
      if (run.stop || run.busy) return;
      /* 🔴v1154：**listRooms 失败时不抛异常，而是返回 `{ok:false}`** —— 判据要落在返回值上 */
      if (lr && lr.ok === false) { onFail(run, lr); return; }
      if (!lr) { onFail(run, { ok: false, reason: '没有拿到房间列表' }); return; }
      run.netFail = 0; _netFail = 0; run.sessT0 = 0; _sessShown = 0;
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
          if (roomProblem(r)) {
            note(run, failNote(r));
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
    if (!(window.HansenPkRoomUI && HansenPkRoomUI._createForLadder)) { later(run, 2500); return; }
    run.busy = true;
    setLine('ldStatus', '暂时没找到，正在开一间房等对手…');
    var done = false;
    try {
      HansenPkRoomUI._createForLadder(run.sm.rating, {
        t0: run.t0,
        band: function () { return bandOf(Math.round((Date.now() - run.t0) / 1000)); },
        onOk: function () { done = true; stopRun(); hideQuiet(); },
        onFail: function (r) {
          if (done) return;
          done = true;
          run.busy = false;
          if (run.stop) return;
          setLine('ldStatus', '');
          var k = kindOf(r);
          if (k === 'expired' || k === 'config' || k === 'session') { onFail(run, r); return; }
          /* 开房失败单独数：找房成功会把断网次数清零，只靠那个数会无限重试开房，
             真实原因（比如「词库还没加载好，刷新一下页面」）永远到不了孩子眼前 */
          run.createFail = (run.createFail || 0) + 1;
          _lastReason = rawOf(r);
          if (run.createFail >= 3) {
            if (k === 'network' || k === 'slow') showOffline(); else showProblem('other', r);
            return;
          }
          note(run, '房没开成，正在重试…');
          later(run, 2500);
        }
      });
    } catch (e) { run.busy = false; later(run, 2500); }
  }

  /* 🔴v1164：**按失败原因分流**（原来按字面找「登录 / 会话」，
     已经登录、只是云端会话还没好的孩子被告知「排位要先登录」）。 */
  var _probeSeq = 0;
  function onFail(run, r) {
    if (run.stop) return;
    var k = kindOf(r);
    _lastReason = rawOf(r);
    /* 审查 AUTH-3：SDK 文件上次没下载完整，浏览器把失败记住了 —— 重试多少次都一样，只有刷新页面有用 */
    if (r && r.reload) { showProblem('reload', r); return; }
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
    if (run.netFail >= 4) {
      if (k === 'other') { showProblem('other', r); return; }
      /* 🔴审查 TI-4：数据库回了个非 200（集合没建 / 权限 / 安全域名），SDK 只会说 network request error ——
         看着像断网。问一下登录服务：它能通，网就是通的，问题在数据库那边，别让老师去查 Wi-Fi。 */
      stopRun();
      var tok = ++_probeSeq;
      setLine('ldStatus', '正在看看是哪里不通…');
      probeCloud().then(function (reach) {
        if (tok !== _probeSeq) return;
        if (reach) showProblem('dbblocked', r); else showOffline();
      });
      return;
    }
    setLine('ldStatus', k === 'other' ? '刚才没成功，正在重试…' : '网络不太顺，正在重试…');
    later(run, 3000);
  }

  /* 这间房本身的问题（被抢 / 关了 / 房主没回应 / 自己的房）—— 换一间就行；
     其余（断网、登录、云端设置）换哪间都一样，要按原因说 */
  function roomProblem(r) {
    var k = kindOf(r);
    return k === 'taken' || k === 'gone' || k === 'other' || k === 'self';
  }
  function failNote(r) {
    var k = kindOf(r);
    return k === 'taken' ? '那间房刚被别人抢走了，接着帮你找…'
         : k === 'gone' ? '那间房刚关了，接着帮你找…'
         : k === 'self' ? '那是你自己账号开的房，接着找别人的…'
         : ((humanOf(r).replace(/[，,。！!]?\s*换一间吧$/, '') || '那间房没进去') + '，接着帮你找…');
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
    dbblocked: { icon: '🛠️', title: '云端连得上，但数据库拒绝了',
               body: '登录服务是通的，网没有断；是数据库那边不让读写 ——<br>多半是集合没建、权限不对，或者这个网址还没加进「安全域名」。'
                   + '<br><br>这不是你的问题，把这一屏截图发给负责的老师就好。', btn: '再试一次' },
    reload:  { icon: '🔄', title: '云端组件没下载完整',
               body: '刚才网络不好，有个文件没下载完整，浏览器记住了那次失败。<br>刷新一下页面就好（进度不会丢）。', btn: '刷新页面' },
    other:   { icon: '⚠️', title: '这次没成功',
               body: '', btn: '再试一次' }
  };
  /* 登录服务通不通（同一个云端域名）：通 = 网没断。6 秒没回应就当不通 */
  function probeCloud() {
    var A = window.HansenAuth;
    if (!A || typeof A.probeCloud !== 'function') return Promise.resolve(false);
    return Promise.race([
      Promise.resolve().then(function () { return A.probeCloud(); })['catch'](function () { return false; }),
      new Promise(function (r) { setTimeout(function () { r(false); }, 6000); })
    ]).then(function (v) { return !!v; });
  }
  var _sessShown = 0;   /* 审查 TI-5：「云端还没连上」出现第几次了 —— 第二次起给「重新登录」这条出路 */
  function showProblem(kind, r) {
    stopRun();
    _probeSeq++;
    if (kind === 'session') _sessShown++;
    var P = PROBLEM[kind] || PROBLEM.other;
    var human = humanOf(r);
    var body = P.body;
    if (kind === 'config') {
      /* 这不是孩子能修的 —— 告诉他把这一屏给老师看；数据层的话里写着该去控制台改什么 */
      body = esc(human.replace(/^云端设置还差一步：?/, '') || '云端数据库还没设置好。')
           + '<br><br>这不是你的问题，把这一屏截图发给负责的老师就好。';
    } else if (kind === 'other') {
      /* 话里已经说了怎么办（比如「刷新一下页面」）就别再加一句矛盾的「等一会儿」 */
      body = esc(human || '出了点小问题。') + (/刷新/.test(human) ? '' : '<br>等一会儿再点「再试一次」。');
    }
    try {
      paint('<div class="ld_top"><button aria-label="关闭" class="ld_x" id="ldCancel">×</button>'
        + '<div class="ld_h">🏆 天梯排位</div></div>'
        + '<div style="text-align:center;padding:24px 12px">'
        + '<div style="font-size:40px">' + P.icon + '</div>'
        + '<div style="font-size:16px;font-weight:800;margin-top:10px">' + P.title + '</div>'
        + '<div style="font-size:13px;color:var(--hpk-dim);margin-top:8px;line-height:1.8">' + body + '</div>'
        + '<button class="ld_btn" id="ldRetry" style="margin-top:16px">' + P.btn + '</button>'
        + ((kind === 'session' && _sessShown >= 2)
            ? '<button class="ld_btn ld_btn2" id="ldRelogin" style="margin-top:2px">🔑 还是不行？重新登录一次</button>' : '')
        /* 🔴v1156（真机报的）：**把真实原因显示出来** —— 小字、灰色、不吓人，截个图就知道是哪一类 */
        + (_lastReason
            ? '<div style="margin-top:14px;font-size:11px;color:var(--hpk-faint);'
              + 'line-height:1.6;word-break:break-all;opacity:.85">'
              + '技术信息：' + esc(String(_lastReason).slice(0, 130)) + '</div>'
            : '')
        + '</div>');
      var rb = q('ldRetry');
      if (rb) rb.onclick = (kind === 'reload')
        ? function () { try { location.reload(); } catch (e) {} }
        : function () { startMatching(); };
      var lb = q('ldRelogin');
      if (lb) lb.onclick = function () {
        /* 凭证还在、却一直换不到会话（云端不认这张凭证了）：退出再登一次是唯一的出路 */
        var A = window.HansenAuth;
        Promise.resolve(A && A.signOut ? A.signOut() : null)['catch'](function () {}).then(function () {
          close();
          try { if (window.HansenAuthUI && HansenAuthUI.open) HansenAuthUI.open(); } catch (e) {}
        });
      };
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
      if (how === 'home' || (r && r.cancelled)) { stopRun(); open({ note: text || '' }); return; }
      open();
      startMatching();
      var run = _run;
      if (!run) return;
      if (r && r.ok === false && !roomProblem(r)) {
        /* 断网 / 登录过期 / 云端设置：按原因分流（不先去列房，免得先闪一下「正在找」） */
        onFail(run, r);
        return;
      }
      var t = text || ((r && r.ok === false) ? failNote(r) : '');
      if (t) note(run, t);
    } catch (e) {}
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

  window.HansenLadderUI = { open: open, close: close, _refreshEntryForTest: refreshEntry,
    /* v1164：对战界面把排位流程交回来（接着找 / 回首页 / 按原因说清楚） */
    _fromRoom: fromRoom,
    _runForTest: function () { return _run ? { t0: _run.t0, netFail: _run.netFail, busy: _run.busy } : null; } };
})();
