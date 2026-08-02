// v960 当前应用沿用 v944 独立 pathname 的早期 Service Worker 升级门。
// 必须是每个运行入口 <head> 的第一支同步脚本，早于存档和所有业务代码。
(function(){
  'use strict';
  var state = window.__hansenSwUpgradeGateV944 = {
    version: 1122,
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
      navigator.serviceWorker.register('./sw_v944.js', {
        scope: './',
        updateViaCache: 'none'
      }).catch(function(error){
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
