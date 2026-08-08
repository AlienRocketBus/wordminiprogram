/* hansen_toast_v1156.js —— 页内提示，替代 alert
 *
 * ═══ 为什么做这个 ═══
 *
 * 全站有 39 处 `alert`。它在手机上有几个实实在在的毛病：
 *
 *   · **会打断输入焦点** —— 关掉弹窗还得再点一次输入框重输
 *   · 微信 / Safari 里样式各不相同，和 App 完全脱节
 *   · 连续弹几次后，有些浏览器会给"阻止此页面再弹窗"的选项，
 *     **用户一旦勾了，之后所有错误提示他都看不到了**
 *
 * 而且里头有 5 处是同一句话的变体：
 *
 *     「XX 模块未加载，请刷新页面」
 *
 * **这句话对一个孩子毫无意义** —— 他不知道什么是"模块"，
 * 也不知道为什么刷新能解决问题，更不知道怎么刷新。
 *
 * ═══ 这个模块提供什么 ═══
 *
 *   HansenToast.say('文字')            普通提示
 *   HansenToast.bad('文字')            出错了（红）
 *   HansenToast.good('文字')           成功了（绿）
 *   HansenToast.notReady('天梯')       "还没准备好"专用 —— 说人话 + 给按钮
 *
 * ═══ 几条刻意的设计 ═══
 *
 * **① 不挡住操作。** 从底部浮上来，几秒后自己走，
 *    不需要用户点"确定" —— 一个必须点掉的提示，本身就是个负担。
 *
 * **② 同一条不重复堆。** 连点三次按钮不该看到三条一样的提示。
 *
 * **③ "还没准备好"要给出路。** 光说"没准备好"等于没说，
 *    得告诉他等一下就行，并给一个能点的重试。
 */
(function () {
  'use strict';
  if (window.HansenToast) return;

  var HOST_ID = 'hsnToastHost';
  /* ⚠️ 不能只记"最后一条" —— 被别的消息一冲就失效。
     实测：bad(A) → good(B) → bad(A)，第三条照样显示，
     因为 _last 已经被 B 冲成了 B。
     改成每条消息各记各的时间。 */
  var _seen = {};

  function host() {
    var el = document.getElementById(HOST_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = HOST_ID;
    el.setAttribute('style',
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483646;' +
      'display:flex;flex-direction:column;align-items:center;gap:7px;' +
      'padding:0 14px 22px;pointer-events:none');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function show(msg, kind, ms) {
    try {
      msg = String(msg || '').trim();
      if (!msg) return;

      /* ② 同一条 2 秒内不重复 —— 连点三次不该看到三条一样的 */
      var now = Date.now();
      if (_seen[msg] && (now - _seen[msg]) < 2000) return;
      _seen[msg] = now;
      /* 顺手清掉过期的，别让这个对象无限长大 */
      try {
        var ks = Object.keys(_seen);
        if (ks.length > 40) {
          for (var i = 0; i < ks.length; i++) {
            if (now - _seen[ks[i]] > 8000) delete _seen[ks[i]];
          }
        }
      } catch (e) {}

      var bg = kind === 'bad' ? 'rgba(153,27,27,.96)'
             : kind === 'good' ? 'rgba(22,101,52,.96)'
             : 'rgba(30,41,59,.96)';
      var d = document.createElement('div');
      d.setAttribute('style',
        'max-width:340px;background:' + bg + ';color:#fff;' +
        'padding:11px 16px;border-radius:13px;font-size:14px;line-height:1.65;' +
        'box-shadow:0 6px 22px rgba(0,0,0,.32);text-align:center;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif;' +
        'opacity:0;transform:translateY(12px);transition:opacity .2s,transform .2s');
      d.textContent = msg;
      host().appendChild(d);
      /* 下一帧再显形，才有淡入效果 */
      setTimeout(function () {
        try { d.style.opacity = '1'; d.style.transform = 'translateY(0)'; } catch (e) {}
      }, 16);
      setTimeout(function () {
        try {
          d.style.opacity = '0';
          d.style.transform = 'translateY(12px)';
          setTimeout(function () { try { d.remove(); } catch (e) {} }, 260);
        } catch (e) {}
      }, ms || 2600);
    } catch (e) {}
  }

  /* ③ "还没准备好"：说人话 + 给一个能点的 */
  function notReady(what, onRetry) {
    try {
      if (document.getElementById('hsnNotReady')) return;
      var d = document.createElement('div');
      d.id = 'hsnNotReady';
      d.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483645;background:rgba(11,16,32,.94);' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'padding:24px;text-align:center;color:#e8eefc;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
      d.innerHTML =
        '<div style="font-size:42px">\u23f3</div>' +
        '<div style="font-size:17px;font-weight:800;margin-top:11px">' +
          (what ? what + '还在准备中' : '还在准备中') + '</div>' +
        '<div style="font-size:13.5px;color:#a9b4c7;margin-top:9px;line-height:1.8;max-width:300px">' +
          '刚打开页面时偶尔会这样。<br>等一两秒再点一次就好。</div>' +
        '<button id="hsnNotReadyGo" style="margin-top:18px;background:linear-gradient(135deg,#4f46e5,#4338ca);' +
          'color:#fff;border:0;padding:12px 26px;border-radius:13px;font-size:15px;' +
          'font-weight:800;cursor:pointer">再试一次</button>' +
        '<button id="hsnNotReadyX" style="margin-top:9px;background:transparent;color:#a9b4c7;' +
          'border:1px solid #3a4560;padding:9px 20px;border-radius:11px;font-size:13.5px;' +
          'cursor:pointer">先不弄了</button>';
      (document.body || document.documentElement).appendChild(d);
      var go = document.getElementById('hsnNotReadyGo');
      if (go) go.onclick = function () {
        try { d.remove(); } catch (e) {}
        if (typeof onRetry === 'function') setTimeout(onRetry, 260);
      };
      var x = document.getElementById('hsnNotReadyX');
      if (x) x.onclick = function () { try { d.remove(); } catch (e) {} };
    } catch (e) {}
  }

  /* 🔴v1156 说清楚后果的确认框 —— 替代 confirm。
     `confirm` 的两个按钮永远叫"确定/取消"，
     **而用户真正需要知道的是"点了之后会怎样"**。
     这里让每个按钮自己说明白要干什么。

     ask({ title, body, yes, no, danger, onYes })
       yes/no  按钮上写什么（不是"确定/取消"）
       danger  确认键标红（不可逆的操作用）
     不选任何默认 —— 破坏性的事不该有默认答案。 */
  function ask(o) {
    o = o || {};
    var done = false;
    var esc = function (t) {
      return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
    };
    var d = document.createElement('div');
    d.setAttribute('style',
      'position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,24,.94);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'padding:22px;color:#e8eefc;overflow:auto;' +
      'font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
    d.innerHTML =
      '<div style="font-size:18px;font-weight:900;text-align:center">'
        + esc(o.title || '确认一下') + '</div>' +
      (o.body ? '<div style="font-size:13.5px;color:#a9b4c7;margin-top:10px;'
        + 'text-align:center;max-width:320px;line-height:1.85">' + o.body + '</div>' : '') +
      '<button id="hsnAskYes" style="margin-top:18px;width:100%;max-width:300px;'
        + 'background:' + (o.danger ? '#991b1b' : 'linear-gradient(135deg,#4f46e5,#4338ca)')
        + ';color:#fff;border:0;padding:13px 20px;border-radius:13px;'
        + 'font-size:15px;font-weight:800;cursor:pointer">'
        + esc(o.yes || '继续') + '</button>' +
      '<button id="hsnAskNo" style="margin-top:10px;width:100%;max-width:300px;'
        + 'background:transparent;color:#cbd5e1;border:1px solid #3a4560;'
        + 'padding:12px 20px;border-radius:13px;font-size:14.5px;cursor:pointer">'
        + esc(o.no || '先不了') + '</button>';
    (document.body || document.documentElement).appendChild(d);
    var fin = function (v) {
      if (done) return;
      done = true;
      try { d.remove(); } catch (e) {}
      if (v && typeof o.onYes === 'function') { try { o.onYes(); } catch (e) {} }
      if (!v && typeof o.onNo === 'function') { try { o.onNo(); } catch (e) {} }
    };
    var y = document.getElementById('hsnAskYes');
    var n2 = document.getElementById('hsnAskNo');
    if (y) y.onclick = function () { fin(true); };
    if (n2) n2.onclick = function () { fin(false); };
  }

  window.HansenToast = {
    ask: ask,
    say: function (m, ms) { show(m, '', ms); },
    bad: function (m, ms) { show(m, 'bad', ms); },
    good: function (m, ms) { show(m, 'good', ms); },
    notReady: notReady,
    _hostIdForTest: HOST_ID
  };
})();
