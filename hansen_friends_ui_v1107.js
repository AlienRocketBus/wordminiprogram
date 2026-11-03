/* hansen_friends_ui_v1107.js —— 好友界面
 *
 * 一屏搞定四件事：
 *   ① 我的状态（在线 / 隐身）—— 一眼能切
 *   ② 加好友（输竞赛 ID）
 *   ③ 好友列表 —— **在线的头像是亮的 + 绿点，离线的整个变灰**
 *   ④ 点好友 → 发快捷语 / 约战
 *
 * 设计上刻意做的几件事：
 *   · 在线的人**排在最前面** —— 你想找的就是能马上打的那个
 *   · 离线的人整体降到 45% 不透明度，不是只把绿点去掉 ——
 *     一眼扫过去就知道谁能约
 *   · 措辞用「刚才还在」而不是「在线中」——
 *     网页没有真正的长连接，页面一关就没心跳，
 *     手机切到微信后台页面还会被冻结。**不想让这个功能骗人。**
 *   · 快捷语面板里**没有输入框** —— 这是产品硬约束的视觉体现
 */
(function () {
  'use strict';
  if (window.HansenFriendsUI) return;

  var ID = 'hsn_friends_screen';
  var _timer = null;

  function F() { return window.HansenFriends; }
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

      /* 🔴v1111：**背景用主题变量，文字就不能写死。**
         `.fr_st div.sel` 原来是 `background:var(--hpk-sel-bg);color:#fff` ——
         暗色下选中态是深紫底白字没问题，亮色下背景变成 #e8ecff（很浅），
         白字就完全看不见了（实测对比度 1.0）。
         凡是背景跟主题走的元素，前景色必须一起跟。

      /* 🔴v1110：这几条必须 !important。
         全站 palette 在亮色系下有一批 `color:#fff!important` 的规则
         （为了让深色卡片上的白字在任何配色下都可读）。
         我们这几屏是**自己的深/浅底**，被那批规则波及会变成白底白字。
         只给"标题/数值"这类关键文字加，不滥用 —— 其余仍走变量级联。 */
  function css() {
    if (q('hsn_fr_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_fr_css';
    st.textContent = THEME_VARS +
      /* 🔴v1164：z-index 要在「拼写大PK」屏（2147483400）之上、对战屏（2147483600）之下 ——
         原来是 2147482000，从岛屿的大PK屏点进来时好友页开在它**后面**，看起来像没反应。 */
      '#' + ID + '{position:fixed;inset:0;z-index:2147483500;background:var(--hpk-bg);' +
        'display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif}' +
      '#' + ID + '.on{display:block}' +
      'html .fr_wrap{max-width:520px;margin:0 auto;padding:16px 14px 40px}' +
      'html .fr_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}' +
      'html .fr_h{font-size:20px;font-weight:900;color:var(--hpk-txt)!important;flex:1}' +
      'html .fr_x{background:none;border:0;color:var(--hpk-dim);font-size:26px;cursor:pointer;padding:0 6px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center}' +
      'html .fr_card{background:var(--hpk-card);border:1px solid var(--hpk-line);border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
      'html .fr_lbl{font-size:12.5px;color:var(--hpk-dim)!important;margin-bottom:8px}' +
      'html .fr_row{display:flex;gap:8px}' +
      'html .fr_in{flex:1;min-width:0;background:var(--hpk-bg);border:1px solid var(--hpk-in-line);border-radius:10px;' +
        'color:var(--hpk-txt);padding:10px;font-size:16px;text-align:center;letter-spacing:2px}' +
      'html .fr_btn{background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border:0;' +
        'border-radius:10px;padding:10px 14px;font-size:15px;font-weight:700;cursor:pointer}' +
      'html .fr_btn2{background:var(--hpk-line);color:var(--hpk-btn2-txt)}' +
      'html .fr_item{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--hpk-line);cursor:pointer}' +
      'html .fr_item:last-child{border-bottom:0}' +
      /* 🔴 离线整体变灰 —— 不是只去掉绿点，要一眼扫出谁能约 */
      'html .fr_item.off{opacity:.45}' +
      'html .fr_av{position:relative;width:44px;height:44px;border-radius:50%;background:var(--hpk-av);' +
        'display:flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 44px}' +
      'html .fr_item.on2 .fr_av{background:var(--hpk-av-on);box-shadow:0 0 0 2px #4f46e5}' +
      'html .fr_dot{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;' +
        'background:#22c55e;border:2px solid var(--hpk-bg)}' +
      'html .fr_nm{font-size:16px;font-weight:700;color:var(--hpk-txt)!important}' +
      'html .fr_sub{font-size:12px;color:var(--hpk-dim);margin-top:2px}' +
      'html .fr_q{display:inline-block;background:var(--hpk-line);border:1px solid var(--hpk-in-line);border-radius:999px;' +
        'padding:9px 13px;margin:5px 5px 0 0;font-size:14px;color:var(--hpk-txt);cursor:pointer}' +
      'html .fr_empty{color:var(--hpk-dim);font-size:14px;text-align:center;padding:22px 8px;line-height:1.8}' +
      'html .fr_st{display:flex;gap:8px}' +
      'html .fr_st div{flex:1;text-align:center;border:1px solid var(--hpk-in-line);border-radius:10px;' +
        'padding:9px 4px;cursor:pointer;font-size:14px;color:var(--hpk-btn2-txt)}' +
      'html .fr_st div.sel{border-color:var(--hpk-accent);background:var(--hpk-sel-bg);color:var(--hpk-txt)!important;font-weight:700}' +
      /* v1164：想加我的人 / 收到的招呼 / 出错说明 */
      'html .fr_mini{border:0;border-radius:9px;padding:8px 12px;min-height:36px;min-width:52px;font-size:14px;font-weight:700;cursor:pointer;' +
        'background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff}' +
      'html .fr_mini.no{background:var(--hpk-btn2);color:var(--hpk-btn2-txt)}' +
      'html .fr_msg{display:flex;gap:10px;align-items:center;padding:8px 2px;border-bottom:1px solid var(--hpk-line)}' +
      'html .fr_msg:last-child{border-bottom:0}' +
      'html .fr_msg .t{flex:1;min-width:0;font-size:14.5px;color:var(--hpk-txt)}' +
      'html .fr_msg .w{font-size:11.5px;color:var(--hpk-faint);margin-top:2px}' +
      'html .fr_new{display:inline-block;font-size:11px;font-weight:800;padding:1px 6px;border-radius:99px;margin-left:6px;' +
        'background:var(--hpk-accent);color:#fff}' +
      'html .fr_err{text-align:center;padding:18px 12px}' +
      'html .fr_err .h{font-size:16px;font-weight:800;color:var(--hpk-txt)!important;margin-top:8px}' +
      'html .fr_err .p{font-size:13px;color:var(--hpk-dim);margin-top:8px;line-height:1.8;text-align:left}' +
      'html .fr_tech{font-size:11px;color:var(--hpk-faint);margin-top:10px;word-break:break-all;text-align:left}' +
      'html .fr_q.off{opacity:.45;cursor:not-allowed}';
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
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '好友');
    document.body.appendChild(el);
    return el;
  }

  function paint(inner) {
    var el = host();
    /* v1164：每 15 秒刷新会整屏重画 —— 正在输的竞赛 ID 和光标不能被冲掉，
       焦点收拢也只在第一次打开时装（重装会把焦点抢到「×」上） */
    var ci = q('frCid'), typed = ci ? ci.value : '', had = !!(ci && document.activeElement === ci);
    var wasOn = el.classList.contains('on');
    el.innerHTML = '<div class="fr_wrap">' + inner + '</div>';
    el.classList.add('on');
    if (!wasOn || !_a11y) a11yOn(el, close);
    var ci2 = q('frCid');
    if (ci2 && typed && !ci2.disabled) ci2.value = typed;
    if (ci2 && had && !ci2.disabled) { try { ci2.focus(); } catch (e) {} }
  }

  function close() {
    a11yOff();
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_retryT) { clearTimeout(_retryT); _retryT = null; }
    var el = q(ID);
    if (el) el.classList.remove('on');
  }

  /* ── 主屏 ─────────────────────────────────────────────── */

  /* 🔴v1113：**打开自己之前先关掉同级的另一屏。**

     实测：天梯页和好友页能同时开着，而且 z-index 一模一样
     （都是 2147482000）—— 谁盖在上面全看 DOM 插入顺序，
     用户会看到两屏叠在一起、点击穿透到下面那屏。

     这类"全屏浮层"必须互斥：打开一个就关掉另一个。
     不靠调 z-index 谁高谁低 —— 那只是把问题藏起来，
     下面那屏仍然存在、仍在跑它的轮询定时器。

     🔴v1164：**只关真开着的那几屏，关完把看门狗的哨撤掉。**
     天梯页的 close() 会给看门狗上哨（"接下来要开对战屏了"），
     而好友页不是对战屏 —— 看门狗 6 秒后看不到对战屏，就把「这一步没能打开」盖在好友页上。 */
  var PEERS = [['HansenLadderUI', 'hsn_ladder_screen'], ['HansenPkRoomUI', 'hsn_pkroom_screen']];
  function closePeers() {
    PEERS.forEach(function (pr) {
      try {
        var m = window[pr[0]], el = q(pr[1]);
        if (m && typeof m.close === 'function' && el && el.classList.contains('on')) m.close();
      } catch (e) {}
    });
    try { if (window.HansenPkWatchdog && HansenPkWatchdog.disarm) HansenPkWatchdog.disarm(); } catch (e) {}
  }

  var _view = null;      /* 上一次拿到的数据：刷新失败时不把已经显示的好友清空 */
  var _sessTries = 0, SESS_MAX = 6;   /* 会话没好时自动重试的次数（约 20 秒） */
  var _tip = null;       /* 加好友结果的提示：整屏重画后还要留着 */
  var _retryT = null;

  function open() {
    closePeers();
    _view = null; _sessTries = 0;
    render({ loading: true });
    refresh();
    /* 每 15 秒刷新在线状态 —— 太频繁会烧云开发的读次数 */
    if (_timer) clearInterval(_timer);
    _timer = setInterval(refresh, 15000);
  }

  /* 「人话 ⟨原话⟩」拆开：人话给人看，原话放进「技术信息」那行 */
  function splitReason(r) {
    var t = String((r && (r.reason || r.text)) || '');
    var m = /^([\s\S]*?)\s*⟨([\s\S]*)⟩\s*$/.exec(t);
    return { human: (r && r.text) || (m ? m[1] : t), raw: m ? m[2] : '' };
  }

  /* 出错时的说明块：按 kind 说清楚发生了什么、该怎么办 */
  function errBlock(r) {
    var k = (r && r.kind) || 'other';
    var sp = splitReason(r);
    var tech = sp.raw ? '<div class="fr_tech">技术信息：' + esc(sp.raw) + '</div>' : '';
    if (k === 'config') {
      return '<div class="fr_err"><div style="font-size:34px">🛠️</div>'
        + '<div class="h">云端设置还差一步</div>'
        + '<div class="p">' + esc(sp.human.replace(/^云端设置还差一步[：:]\s*/, '')) + '</div>'
        + '<div class="p" style="font-size:12px">这不是你的问题，也不是网络问题。'
        +   '把这一屏拍给负责的老师或家长，按上面说的在腾讯云开发控制台改好就能用了。</div>'
        + tech + '</div>';
    }
    if (k === 'network' || k === 'slow') {
      return '<div class="fr_err"><div style="font-size:34px">📡</div>'
        + '<div class="h">' + (k === 'slow' ? '网络太慢了' : '连不上网络') + '</div>'
        + '<div class="p" style="text-align:center">' + esc(sp.human) + '</div>'
        + '<button class="fr_btn" id="frRetry" style="margin-top:12px">再试一次</button>' + tech + '</div>';
    }
    if (k === 'session' && _sessTries <= SESS_MAX) {
      return '<div class="fr_err"><div style="font-size:30px">⏳</div>'
        + '<div class="h">正在连接云端…</div>'
        + '<div class="p" style="text-align:center">刚打开页面时要等几秒，马上自动再试。</div>' + tech + '</div>';
    }
    if (k === 'session') {
      /* 自动等了 20 秒还没连上：别再转圈，说清楚并给个按钮 */
      return '<div class="fr_err"><div style="font-size:30px">☁️</div>'
        + '<div class="h">云端还没连上</div>'
        + '<div class="p" style="text-align:center">已经等了 20 秒。检查一下网络，再点「再试一次」；'
        +   '还不行就退出登录再登一次。</div>'
        + '<button class="fr_btn" id="frRetry" style="margin-top:12px">再试一次</button>' + tech + '</div>';
    }
    return '<div class="fr_err"><div class="p" style="text-align:center">' + esc(sp.human || '没读到，等会儿再试') + '</div>'
      + '<button class="fr_btn fr_btn2" id="frRetry" style="margin-top:12px">再试一次</button>' + tech + '</div>';
  }

  function render(v) {
    v = v || {};
    var friends = v.friends || [], incoming = v.incoming || [];
    var st = F() ? F().myStatus() : 'online';
    /* 🔴v1129：**没登录就把整屏说清楚，别让人白填。**
       没登录时顶部直接给一句话 + 一个去登录的按钮，下面的输入框禁用。
       **不要让人做注定失败的操作。** */
    var err = v.err || null;
    var noLogin = !!(err && (err.kind === 'expired' || /登录/.test(err.reason || '')));
    var expired = noLogin && /过期/.test((err && err.reason) || '');
    var on = friends.filter(function (f) { return f.online && !f.pending; }).length;

    var tipHtml = (_tip && Date.now() - _tip.at < 9000)
      ? '<div id="frCidTip" style="font-size:12.5px;margin:6px 2px 0;line-height:1.6;color:'
        + (_tip.good ? 'var(--hpk-ok)' : 'var(--hpk-bad)') + '">' + esc(_tip.msg) + '</div>'
      : '';

    paint(
      '<div class="fr_top"><div class="fr_h">👥 我的好友</div>'
      + '<button aria-label="关闭好友" class="fr_x" id="frX">×</button></div>'

      + (noLogin
          ? '<div class="fr_card" style="text-align:center;padding:20px 14px">'
            + '<div style="font-size:34px">🔐</div>'
            + '<div style="font-size:15px;color:var(--hpk-txt)!important;margin-top:8px">'
            +   (expired ? '云端登录过期了，重新登录一次就好' : '登录后才能加好友') + '</div>'
            + '<div style="font-size:12.5px;color:var(--hpk-dim);margin-top:8px;line-height:1.8">'
            +   '好友要靠「竞赛 ID」互加，<br>而竞赛 ID 是登录时自动分配的。</div>'
            + '<button class="fr_btn" id="frGoLogin" style="margin-top:14px">去登录</button>'
            + '</div>'
          : '')

      /* 我的状态 */
      + '<div class="fr_card">'
      +   '<div class="fr_lbl">我的状态</div>'
      +   '<div class="fr_st">'
      +     '<div id="frOn" class="' + (st === 'online' ? 'sel' : '') + '">🟢 在线</div>'
      +     '<div id="frHide" class="' + (st === 'hidden' ? 'sel' : '') + '">🌙 隐身</div>'
      +   '</div>'
      +   '<div style="font-size:11.5px;color:var(--hpk-faint);margin-top:7px;line-height:1.6">'
      +     (st === 'hidden'
          ? '隐身时好友看到的你和「不在线」一模一样，看不出差别。'
          : '好友能看到你「刚才还在」。<br>'
            + '（网页不能像 App 那样一直挂着，所以这只表示你最近开着页面）')
      +   '</div>'
      + '</div>'

      /* 加好友 */
      + '<div class="fr_card">'
      +   '<div class="fr_lbl">加好友（输对方的竞赛 ID 数字）</div>'
      +   '<div class="fr_row">'
      +     '<input class="fr_in" id="frCid" inputmode="numeric" placeholder="例如 2"'
      +     (noLogin ? ' disabled style="opacity:.5"' : '')
      +     ' aria-label="输入好友的竞赛 ID 数字" autocomplete="off">'
      +     '<button class="fr_btn" id="frAdd"' + (noLogin ? ' disabled style="opacity:.5"' : '')
      +     '>加好友</button>'
      +   '</div>'
      +   tipHtml
      +   '<div style="font-size:11.5px;color:var(--hpk-faint);margin-top:7px">'
      +     '竞赛 ID 在「拼写大PK」页面顶部，长这样：No.001。<br>你加他、他也加你，就成为好友了。'
      +   '</div>'
      + '</div>'

      /* 想加我的人 */
      + (incoming.length ? (
          '<div class="fr_card">'
        +   '<div class="fr_lbl">🙋 想加你为好友（' + incoming.length + '）</div>'
        +   '<div id="frInc">' + incomingHtml(incoming) + '</div>'
        + '</div>') : '')

      /* 收到的招呼 */
      + inboxHtml(v)

      /* 好友列表 */
      + '<div class="fr_card">'
      +   '<div class="fr_lbl">好友 ' + (friends.length ? '· ' + on + ' 人刚才还在' : '') + '</div>'
      +   '<div id="frList">'
      +     (v.loading ? '<div class="fr_empty">正在读取…</div>'
              : (err && !noLogin ? errBlock(err)
                : (noLogin ? '<div class="fr_empty">先登录才能加好友</div>' : listHtml(friends))))
      +   '</div>'
      + '</div>'
    );

    if (q('frX')) q('frX').onclick = close;
    if (q('frOn')) q('frOn').onclick = function () { F().setStatus('online'); refresh(); };
    if (q('frHide')) q('frHide').onclick = function () { F().setStatus('hidden'); refresh(); };
    if (q('frAdd')) q('frAdd').onclick = function () { doAdd(); };
    if (q('frRetry')) q('frRetry').onclick = function () { _sessTries = 0; render({ loading: true }); refresh(); };
    if (q('frGoLogin')) q('frGoLogin').onclick = function () {
      close();
      try { if (window.HansenAuthUI) HansenAuthUI.open(); } catch (e) {}
    };
    var ci = q('frCid');
    if (ci) ci.onkeydown = function (ev) { if (ev.key === 'Enter') doAdd(); };
    if (ci) ci.oninput = function () { _tip = null; var t = q('frCidTip'); if (t) t.textContent = ''; };
    bindList(friends);
    bindIncoming(incoming);
  }

  function incomingHtml(list) {
    return list.slice(0, 20).map(function (f, i) {
      return '<div class="fr_item ' + (f.online ? 'on2' : 'off') + '" data-n="' + i + '" style="cursor:default">'
        + '<div class="fr_av">🐝' + (f.online ? '<span class="fr_dot"></span>' : '') + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div class="fr_nm">' + esc(f.name) + '</div>'
        +   '<div class="fr_sub">No.' + f.cid + ' · ' + esc(f.sub) + '</div>'
        + '</div>'
        + '<button class="fr_mini" data-acc="' + i + '">加他</button>'
        + '<button class="fr_mini no" data-ign="' + i + '">不加</button>'
        + '</div>';
    }).join('');
  }
  function bindIncoming(list) {
    var box = q('frInc');
    if (!box) return;
    box.querySelectorAll('[data-acc]').forEach(function (b) {
      b.onclick = function () {
        var f = list[Number(b.getAttribute('data-acc'))];
        if (!f) return;
        b.disabled = true; b.textContent = '…';
        F().addFriend(f.cid).then(function (r) {
          _tip = r.ok ? { msg: r.mutual ? ('✅ 你和 ' + r.name + ' 已经互为好友了') : ('✅ 已加 ' + r.name), good: true, at: Date.now() }
                      : { msg: splitReason(r).human || '没加上，等会儿再试', good: false, at: Date.now() };
          refresh();
        });
      };
    });
    box.querySelectorAll('[data-ign]').forEach(function (b) {
      b.onclick = function () {
        var f = list[Number(b.getAttribute('data-ign'))];
        if (f) F().ignoreRequest(f.cid);
        refresh();
      };
    });
  }

  /* 收到的招呼：只显示互为好友的人发来的（陌生人的不给孩子看） */
  function inboxHtml(v) {
    var ib = v.inbox;
    if (!ib) return '';
    if (!ib.ok) {
      if (ib.kind !== 'config') return '';      /* 网络问题列表那块已经说了，这里不重复 */
      return '<div class="fr_card"><div class="fr_lbl">📨 收到的招呼</div>' + errBlock(ib) + '</div>';
    }
    if (!ib.msgs || !ib.msgs.length) return '';
    var now = Date.now();
    return '<div class="fr_card"><div class="fr_lbl">📨 收到的招呼'
      + (ib.unread ? '<span class="fr_new">' + ib.unread + ' 条新的</span>' : '') + '</div>'
      + ib.msgs.slice(0, 10).map(function (m) {
          var ago = Math.max(0, Math.floor((now - (m.at || 0)) / 60000));
          return '<div class="fr_msg"><div style="font-size:22px">' + esc(m.emoji) + '</div>'
            + '<div class="t">' + esc(m.text) + (m.isNew ? '<span class="fr_new">新</span>' : '')
            +   '<div class="w">' + esc(m.fromName) + (m.from ? ' · No.' + m.from : '') + ' · '
            +   (ago < 1 ? '刚刚' : ago < 60 ? ago + ' 分钟前' : Math.floor(ago / 60) + ' 小时前') + '</div></div>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  function listHtml(friends) {
    if (!friends.length) {
      return '<div class="fr_empty">还没有好友。<br>'
        + '让同学告诉你他的竞赛 ID，输在上面就能加。</div>';
    }
    /* 🔴v1156：**好友列表也要截断**（和房间列表、排行榜同一个问题）。
       班里几十个同学互相加，列表会很长，
       而**用户找的是"谁刚才还在"，不是把所有人看一遍**。
       画前 50 个，多的给一句说明。 */
    var MAX_FRIENDS = 50;
    var moreN = Math.max(0, friends.length - MAX_FRIENDS);
    var tail = moreN > 0
      ? '<div class="fr_empty" style="padding:10px 8px;font-size:13px">'
        + '还有 ' + moreN + ' 个好友没显示</div>'
      : '';
    return friends.slice(0, MAX_FRIENDS).map(function (f, i) {
      return '<div class="fr_item ' + (f.online ? 'on2' : 'off') + '" data-i="' + i + '">'
        + '<div class="fr_av">🐝' + (f.online ? '<span class="fr_dot"></span>' : '') + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div class="fr_nm">' + esc(f.name) + (f.pending ? ' <span style="font-size:12px;font-weight:600;color:var(--hpk-faint)">（待确认）</span>' : '') + '</div>'
        +   '<div class="fr_sub">No.' + f.cid + ' · ' + esc(f.sub) + '</div>'
        + '</div>'
        + '<div style="font-size:18px;color:var(--hpk-faint)">›</div>'
        + '</div>';
    }).join('') + tail;
  }

  function bindList(friends) {
    var box = q('frList');
    if (!box) return;
    box.querySelectorAll('.fr_item').forEach(function (el) {
      el.onclick = function () {
        var f = friends[Number(el.getAttribute('data-i'))];
        if (f) detail(f);
      };
    });
  }

  function refresh() {
    if (!F()) return;
    if (_retryT) { clearTimeout(_retryT); _retryT = null; }
    F().listFriends().then(function (r) {
      if (!q(ID) || !q(ID).classList.contains('on') || _inDetail) return null;
      if (!r || !r.ok) {
        if (r && r.kind === 'session') _sessTries++;
        /* 🔴v1109：**没登录要明说**，别让人以为功能坏了。
           刷新失败但之前读到过：保留已经显示的好友，只在下面说明原因 */
        render({ friends: _view ? _view.friends : [], incoming: _view ? _view.incoming : [],
                 inbox: _view ? _view.inbox : null, err: r || { kind: 'other' } });
        /* 会话还没好（页面刚打开）：几秒后自动再试，不用孩子去点；最多约 20 秒 */
        if (r && r.kind === 'session' && _sessTries <= SESS_MAX) _retryT = setTimeout(refresh, 3000);
        return null;
      }
      _sessTries = 0;
      var mutual = (r.friends || []).filter(function (f) { return !f.pending; }).map(function (f) { return f.cid; });
      return F().inbox({ onlyFrom: mutual }).then(function (ib) {
        if (!q(ID) || !q(ID).classList.contains('on') || _inDetail) return;
        _view = { friends: r.friends || [], incoming: r.incoming || [], inbox: ib };
        render(_view);
        /* 招呼显示出来了就算看过（"新"标记下次刷新时去掉） */
        if (ib && ib.ok && ib.unread) setTimeout(function () { try { F().markSeen(); } catch (e) {} }, 1500);
      });
    })['catch'](function (e) {
      if (!q(ID) || !q(ID).classList.contains('on') || _inDetail) return;
      render({ err: { kind: 'other', reason: '没读到好友 ⟨' + String((e && e.message) || e).slice(0, 80) + '⟩' } });
    });
  }

  function doAdd() {
    var ci = q('frCid');
    var btn = q('frAdd');
    var cid = String((ci && ci.value) || '').trim();

    /* 🔴v1156：**加好友失败不该用 alert 报** —— 提示紧贴着输入框，那才是他要改的地方。
       v1164：提示记在 _tip 里，整屏刷新后还在（以前一刷新就没了）。 */
    var say = function (msg, good) {
      _tip = { msg: msg, good: !!good, at: Date.now() };
      try {
        var box = q('frCidTip');
        if (!box) {
          box = document.createElement('div');
          box.id = 'frCidTip';
          box.setAttribute('style', 'font-size:12.5px;margin:6px 2px 0;line-height:1.6');
          if (ci && ci.parentNode) ci.parentNode.parentNode.insertBefore(
            box, ci.parentNode.nextSibling);
        }
        box.style.color = good ? 'var(--hpk-ok)' : 'var(--hpk-bad)';
        box.textContent = msg;
      } catch (e) {}
    };

    if (!cid) { say('先输入对方的竞赛 ID 数字'); if (ci) ci.focus(); return; }
    if (btn) { btn.disabled = true; btn.textContent = '添加中…'; }
    F().addFriend(cid).then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = '加好友'; }
      if (!r.ok) {
        var sp = splitReason(r);
        say((sp.human || '加不上 —— 检查一下竞赛 ID 对不对') + (sp.raw ? '（' + sp.raw.slice(0, 60) + '）' : ''));
        if (ci) { ci.focus(); try { ci.select(); } catch (e) {} }
        return;
      }
      if (ci) ci.value = '';
      say(r.mutual ? ('✅ 你和 ' + r.name + ' 已经互为好友了')
                   : ('✅ 已发出好友请求。等 ' + r.name + ' 也加你，就成为好友了'), true);
      refresh();
    })['catch'](function (e) {
      if (btn) { btn.disabled = false; btn.textContent = '加好友'; }
      say(String((e && e.message) || e) || '网络不太顺，再试一次');
    });
  }

  /* ── 好友详情：发快捷语 / 约战 ───────────────────────────
     🔴 这一屏**没有输入框** —— 这是"不能打字聊天"这条产品约束
        在界面上的直接体现，不是靠禁用某个功能藏起来的。 */
  var _inDetail = false;
  function detail(f) {
    var QUICK = (F() && F().QUICK) || [];
    _inDetail = true;
    /* 只有互为好友才能互发招呼 —— 他没加你时发了他也看不到 */
    var can = !f.pending;
    paint(
      '<div class="fr_top"><button aria-label="返回好友列表" class="fr_x" id="frBack">←</button>'
      + '<div class="fr_h">' + esc(f.name) + '</div></div>'

      + '<div class="fr_card" style="text-align:center">'
      +   '<div class="fr_av" style="margin:0 auto 10px;width:64px;height:64px;font-size:32px;'
      +     (f.online ? 'background:var(--hpk-av-on);box-shadow:0 0 0 3px #4f46e5' : 'opacity:.5') + '">🐝'
      +     (f.online ? '<span class="fr_dot" style="width:16px;height:16px"></span>' : '')
      +   '</div>'
      +   '<div style="font-size:18px;font-weight:800;color:var(--hpk-txt)">' + esc(f.name) + '</div>'
      +   '<div style="font-size:13px;color:' + (f.online ? 'var(--hpk-ok)' : 'var(--hpk-faint)') + ';margin-top:4px">'
      +     'No.' + f.cid + ' · ' + esc(f.sub) + '</div>'
      + '</div>'

      + '<div class="fr_card">'
      +   '<div class="fr_lbl">发个招呼（只能发这些，不能打字）</div>'
      +   (can ? '' : '<div style="font-size:12.5px;color:var(--hpk-dim);margin-bottom:6px;line-height:1.7">'
                    + '他还没加你。等他也加你为好友，你们就能互发招呼了。</div>')
      +   '<div>' + QUICK.map(function (x) {
              return '<span class="fr_q' + (can ? '' : ' off') + '" data-q="' + esc(x.id) + '">'
                + x.emoji + ' ' + esc(x.text) + '</span>';
            }).join('') + '</div>'
      +   '<div id="frSent" style="font-size:13px;color:var(--hpk-ok);min-height:20px;margin-top:10px"></div>'
      + '</div>'

      + '<button class="fr_btn" id="frPk" style="width:100%;margin-bottom:10px">'
      +   '⚔️ 开个房间叫他来打</button>'
      + '<button class="fr_btn fr_btn2" id="frDel" style="width:100%">'
      +   (f.pending ? '不加了（撤回好友请求）' : '删除好友') + '</button>'
    );

    if (q('frBack')) q('frBack').onclick = function () { _inDetail = false; open(); };
    host().querySelectorAll('.fr_q').forEach(function (el) {
      el.onclick = function () {
        var box0 = q('frSent');
        if (!can) {
          if (box0) { box0.textContent = '他还没加你，现在发不了'; box0.style.color = 'var(--hpk-bad)'; }
          return;
        }
        var qid = el.getAttribute('data-q');
        F().sendQuick(f.cid, qid).then(function (r) {
          var box = q('frSent');
          if (!box) return;
          var sp = splitReason(r);
          box.textContent = r.ok
            ? ('已发出：' + r.sent.emoji + ' ' + r.sent.text)
            : ('没发出去：' + (sp.human || '未知') + (sp.raw ? '（' + sp.raw.slice(0, 80) + '）' : ''));
          box.style.color = r.ok ? 'var(--hpk-ok)' : 'var(--hpk-bad)';
        });
      };
    });
    if (q('frPk')) q('frPk').onclick = function () {
      close();
      /* 开私密房 —— 拿到码发给他，这是 v1105 做好的路径 */
      try {
        if (window.HansenPkRoomUI && HansenPkRoomUI.open) HansenPkRoomUI.open();
      } catch (e) {}
    };
    if (q('frDel')) q('frDel').onclick = function () {
      if (!window.confirm((f.pending ? '撤回给 ' : '确定删除好友 ') + f.name + (f.pending ? ' 的好友请求？' : '？'))) return;
      F().removeFriend(f.cid).then(function (r) {
        _inDetail = false;
        if (r && !r.ok) _tip = { msg: '没删掉：' + (splitReason(r).human || '等会儿再试'), good: false, at: Date.now() };
        open();
      });
    };
  }

  function closeAll() { _inDetail = false; _view = null; if (_retryT) { clearTimeout(_retryT); _retryT = null; } close(); }

  window.HansenFriendsUI = { open: function () { _inDetail = false; open(); }, close: closeAll, _detail: detail };
})();
