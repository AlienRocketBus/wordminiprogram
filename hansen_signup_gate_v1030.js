/* hansen_signup_gate_v1030.js —— 升到 Lv.3 强制注册
 *
 * 产品决策（用户定）：前两级自由玩，让人先看到价值；
 * 升到 **Lv.3（250 XP）** 后必须注册才能继续——注册即把本机全部进度存到云端，
 * 此后任何设备登录同一账号都能恢复。
 *
 * 为什么卡在 Lv.3 而不是一进来就卡：
 *   在用户看到价值之前要求注册会损失一批只是想试试的人，而这个损失不可逆；
 *   到了 Lv.3 他已经有实实在在的进度可丢，注册意愿完全不同，
 *   同时也正是"进度值得保护"的时点。
 */
(function () {
  'use strict';
  if (window.HansenSignupGate) return;

  var GATE_LV = 3;
  var GATE_XP = 250;      /* 与 ADVENTURE_LEVELS 的 Lv.3 门槛一致 */
  var ID = 'hsn_gate';
  var timer = null;

  function xp() {
    try {
      var v = +localStorage.getItem('hansen_wallet_charxp');
      if (isFinite(v) && v >= 0) return v;
    } catch (e) {}
    try { if (typeof window.S !== 'undefined' && S && +S.charXP >= 0) return +S.charXP; } catch (e) {}
    return 0;
  }
  function level() { return xp() >= GATE_XP ? GATE_LV : 1; }

  function signedIn() {
    try {
      var A = window.HansenAuth;
      return !!(A && typeof A.isSignedIn === 'function' && A.isSignedIn());
    } catch (e) { return false; }
  }
  function cloudReady() {
    try { var c = window.HANSEN_CLOUD_CONFIG; return !!(c && c.envId); } catch (e) { return false; }
  }
  /* 🔴v1069：**强制注册门槛已按产品决定关闭。**
     原设计：升到 Lv.3 就弹出不可关闭的硬门槛，必须注册才能继续玩。
     关闭原因：它把"先玩后注册"的体验切断在最有兴致的那一刻，
     而账号的真正价值（跨设备找回进度）应该靠**提示**去吸引，不该靠**堵路**去逼迫。

     代码整套保留、模块照常加载，只是不再触发——
     想恢复只需把下面这行改成 true，其余逻辑（面板、z-index 修正、
     登录后放行、云未开通不堵人）都还在，且回归测试仍在守着它们。
     直接删模块的话，未来想开回来要重写一遍，还会连带破坏
     test_page_wiring 的"有云存档的页面都要带门槛模块"这条接线合同。 */
  var GATE_ENABLED = false;

  /* 需要拦截：门槛开启 + 达到等级 + 未登录 + 云服务可用（云没开通就别把人堵死） */
  function shouldGate() { return GATE_ENABLED && xp() >= GATE_XP && !signedIn() && cloudReady(); }

  function progressLine() {
    var islands = 0, learned = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          if (o && o.learned && o.learned.length) { islands++; learned += o.learned.length; }
        }
      }
    } catch (e) {}
    return { islands: islands, learned: learned };
  }

  function style() {
    if (document.getElementById('hsn_gate_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_gate_css';
    st.textContent = [
      '#' + ID + '{position:fixed;inset:0;z-index:2147483640;display:none;align-items:center;justify-content:center;',
      '  background:rgba(2,6,23,.88);padding:20px}',
      '#' + ID + '.on{display:flex}',
      '#' + ID + ' .g_card{width:100%;max-width:400px;background:linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%);',
      '  color:#e8eefc;border-radius:20px;padding:24px 20px;box-shadow:0 12px 40px rgba(0,0,0,.5);text-align:center}',
      '#' + ID + ' .g_ic{font-size:52px;line-height:1}',
      '#' + ID + ' .g_t{font-size:20px;font-weight:900;margin-top:10px;letter-spacing:.4px}',
      '#' + ID + ' .g_p{font-size:13.5px;line-height:1.75;opacity:.9;margin-top:10px;font-weight:600}',
      '#' + ID + ' .g_box{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:14px;',
      '  padding:12px 14px;margin-top:14px;font-size:13px;font-weight:800;line-height:1.7}',
      '#' + ID + ' .g_go{width:100%;min-height:52px;border:0;border-radius:14px;margin-top:18px;cursor:pointer;',
      '  background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;font:inherit;font-weight:900;font-size:16px}',
      '#' + ID + ' .g_tip{font-size:11.5px;opacity:.62;line-height:1.6;margin-top:12px;font-weight:600}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  function host() {
    var el = document.getElementById(ID);
    if (el) return el;
    style();
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '需要注册');
    /* 刻意不做点击遮罩关闭、不做 ✕ ——这是硬门槛 */
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function render() {
    var el = host();
    var p = progressLine();
    el.innerHTML = '<div class="g_card">'
      + '<div class="g_ic">🎉</div>'
      + '<div class="g_t">恭喜升到 Lv.' + GATE_LV + '！</div>'
      + '<div class="g_p">你已经玩出真东西了。<br>现在注册一个账号，把进度存到云端——'
      + '换手机、清缓存都不会丢。</div>'
      + '<div class="g_box">📦 待保存的进度<br>'
      + '已探索 ' + p.islands + ' 个岛 · 已学 ' + p.learned + ' 个单词</div>'
      + '<button class="g_go" id="gGo">🔐 手机号注册 / 登录</button>'
      + '<div class="g_tip">注册后本机进度会自动上传，之后在任何设备登录同一账号即可恢复。<br>'
      + '这一步是必须的，完成后就能继续玩了。</div>'
      + '</div>';
    var b = document.getElementById('gGo');
    if (b) b.onclick = function () {
      /* 🔴v1054 修复"点注册没反应"：
         登录面板 z-index 原为 2147483500，而本门槛是 2147483640 ——
         面板确实打开了，却被门槛整个盖住；而门槛刻意不可关闭，
         于是用户彻底卡死在这一屏。
         除了把面板层级提到门槛之上（已在 auth_ui 侧修正），
         这里再加一层保险：打开登录面板时先把门槛隐藏，
         登录成功或用户关掉面板后由巡检自动决定是否重新拦截。 */
      try {
        if (!window.HansenAuthUI) { alert('登录模块未加载，请刷新页面重试。'); return; }
        hide();
        HansenAuthUI.open();
      } catch (e) {
        try { alert('打开登录界面失败，请刷新页面重试。'); } catch (e2) {}
      }
    };
  }

  function show() {
    var el = host();
    if (el.classList.contains('on')) return;
    render();
    el.classList.add('on');
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
  }
  function hide() {
    var el = document.getElementById(ID);
    if (el) el.classList.remove('on');
    try { document.documentElement.style.overflow = ''; } catch (e) {}
  }

  /* 持续巡检：升级、登录、登出都会即时反映 */
  function check() {
    /* 🔴v1054: 登录面板开着的时候绝不重新弹出门槛 ——
       巡检每 1.5s 跑一次，若不让路就会把刚隐藏的门槛又弹回来盖住面板，
       用户依旧填不了手机号。面板关闭后本巡检会自然恢复拦截。 */
    try {
      var panel = document.getElementById('hsn_auth_panel');
      if (panel && panel.classList.contains('on')) { hide(); return; }
    } catch (e) {}
    if (shouldGate()) show(); else hide();
  }
  function start() {
    check();
    if (timer) clearInterval(timer);
    timer = setInterval(check, 1500);
    try { document.addEventListener('hsn-auth-changed', check); } catch (e) {}
    try { window.addEventListener('focus', check); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.HansenSignupGate = {
    _enabled: function () { return GATE_ENABLED; },
    /* v1069 测试注入口：门槛虽已关闭，但面板逻辑（硬门槛不可关、文案、
       进度明细、z-index 高于登录面板）必须继续被回归守着——
       否则将来想开回来时，这些早就悄悄坏掉了。 */
    _setEnabledForTest: function (v) { GATE_ENABLED = !!v; },
    GATE_LV: GATE_LV, GATE_XP: GATE_XP,
    shouldGate: shouldGate, check: check, show: show, hide: hide,
    _xp: xp, _level: level
  };
})();
