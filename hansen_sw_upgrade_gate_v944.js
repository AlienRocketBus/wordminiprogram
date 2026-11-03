// v960 当前应用沿用 v944 独立 pathname 的早期 Service Worker 升级门。
// 必须是每个运行入口 <head> 的第一支同步脚本，早于存档和所有业务代码。
(function(){
  'use strict';
  var state = window.__hansenSwUpgradeGateV944 = {
    /* v1163: 这个号只是给排查用的标记（不参与任何比较），
       但仍然要跟着 VERSION 走 —— 一个记录着旧版本号的字段
       会在排查时把人带偏，而它本身没有存在的代价。 */
    version: 1163,
    ready: false,
    controller: 'checking'
  };
  try {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      state.ready = true;
      state.controller = 'unsupported';
      return;
    }

    var current = navigator.serviceWorker.controller;
    if (!current) {
      // 没有旧 controller 时，当前文档和随后脚本都直接来自网络，不存在混版窗口。
      state.ready = true;
      state.controller = 'none';
      /* v1165：只在顶层页面注册（首页外壳里的岛框不再各注册一次）；装失败了这个标签页 10 分钟内不再试 ——
         以前装一次要下约 1MB 外壳，某个文件出错时每个页面框都重试，进一次岛就重下十几次。 */
      var FAIL_KEY = 'hsn_sw_fail_at', FAIL_HOLD = 10 * 60 * 1000;
      var isTop = true;
      try { isTop = window.top === window.self; } catch (_) { isTop = false; }
      var failedAt = 0;
      try { failedAt = Number(sessionStorage.getItem(FAIL_KEY)) || 0; } catch (_) {}
      var markFailed = function(){ try { sessionStorage.setItem(FAIL_KEY, String(Date.now())); } catch (_) {} };
      if (!isTop || (failedAt && Date.now() - failedAt < FAIL_HOLD)) {
        state.controller = isTop ? 'none-backoff' : 'none-frame';
        return;
      }
      state.registered = true;   // 首页 load 时不必再注册一遍
      navigator.serviceWorker.register('./sw_v944.js', {
        scope: './',
        updateViaCache: 'none'
      }).then(function(reg){
        var w = reg && (reg.installing || reg.waiting);
        if (!w) return;
        w.addEventListener('statechange', function(){
          if (w.state === 'redundant' && !reg.active) markFailed();   // 外壳没装上（某个文件下载失败）
          else if (w.state === 'activated') { try { sessionStorage.removeItem(FAIL_KEY); } catch (_) {} }
        });
      }).catch(function(error){
        markFailed();
        try { console.warn('[v960升级门] Service Worker 注册失败:', error && error.message); } catch (_) {}
      });
      return;
    }

    var controllerPath = '';
    try { controllerPath = new URL(current.scriptURL, location.href).pathname; } catch (_) {}
    if (/\/sw_v944\.js$/.test(controllerPath)) {
      state.ready = true;
      state.controller = 'sw_v944.js';
      return;
    }

    // 仍由 v943 /sw.js 控制。旧 Worker 会忽略 ?v= 查询参数，继续解析本页会把
    // 旧版本与 v960 同名脚本混在一起。立即终止当前文档，先完成 Worker 升级。
    state.controller = 'legacy';
    var gate = new URL('_sw_upgrade_v944.html', location.href);
    gate.searchParams.set('return', location.href);
    try { window.stop(); } catch (_) {}
    try { location.replace(gate.href); } catch (_) { location.href = gate.href; }
    // 阻止解析器在导航真正提交前继续执行后续旧业务脚本。
    try {
      document.open();
      var safeRoot = document.createElement('html');
      safeRoot.innerHTML = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正在安全升级</title><style>html,body{height:100%;margin:0;background:#0c1538;color:#fff;font:16px system-ui,sans-serif}body{display:grid;place-items:center;text-align:center;padding:24px;box-sizing:border-box}</style></head><body><main>正在安全升级到 v960，请稍候…</main></body>';
      if (document.documentElement) document.replaceChild(safeRoot, document.documentElement);
      else document.appendChild(safeRoot);
      document.close();
    } catch (_) {}
  } catch (error) {
    // 有旧 controller 时绝不静默放行混版。导航到独立升级页重试；无旧 controller
    // 的异常则保持普通网络加载，避免不支持 SW 的浏览器白屏。
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        var fallback = new URL('_sw_upgrade_v944.html', location.href);
        fallback.searchParams.set('return', location.href);
        location.replace(fallback.href);
      } else {
        state.ready = true;
        state.controller = 'unavailable';
      }
    } catch (_) {
      state.ready = !navigator.serviceWorker || !navigator.serviceWorker.controller;
      state.controller = state.ready ? 'unavailable' : 'blocked';
    }
  }
})();
