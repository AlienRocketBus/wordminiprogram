/* hansen_version_watch_v1083.js —— 版本守望者：彻底解决「做出来的东西不显示」
 *
 * 事故（产品负责人多次反馈，且明确说"之前出现过，给我带来很大困扰"）：
 *   「你做出来的东西有可能根本就没显示出来，你做完了但可能还是上个版本。」
 *
 * 查证属实。机制是这样的：
 *   Service Worker 对导航请求是网络优先，**但有缓存时只等 3 秒**
 *   （v1082 已放宽到 8 秒）。用户在微信内置浏览器、信号一波动就超时，
 *   于是拿到**缓存里的旧 HTML**；而 HTML 文件名不带版本戳
 *   （`island_animal.html`，不像 JS 有 `?v=`），旧页面会被一直复用，
 *   里面引用的又全是旧版 JS。
 *
 *   结果：开发端连改六版，用户手机上跑的仍是旧代码，**而双方都看不出来**。
 *   据此做的每一次诊断都建立在过期证据上 —— 云端登录那条线因此空转了二十多版。
 *
 * 为什么「面板显示模块版本 vs 页面版本」不够：
 *   SW 给的是**整套**旧文件，两个数字会**一致地都是旧的**，看不出任何异常。
 *   唯一可靠的判据是**去服务器问一句"最新是哪一版"** —— 那是缓存管不着的地方。
 *
 * 做法：
 *   ① 开机后（空闲时）用 `no-store` + 时间戳去取 /VERSION，绕开一切缓存；
 *   ② 服务器版本 > 本机版本 → 说明缓存卡住了；
 *   ③ 自动清理：注销 SW、清空 Cache Storage、带时间戳硬重载；
 *   ④ 同一版本只自动修一次（写标记），避免万一判断有误时陷入无限重载。
 *
 * 这条链路必须**极其保守**：宁可少修一次，也绝不能把人卡在重载循环里。
 */
(function () {
  'use strict';
  if (window.HansenVersionWatch) return;

  var LOCAL = (function () {
    try {
      if (window.HansenBackup && typeof HansenBackup.appVersion === 'function')
        return Number(HansenBackup.appVersion()) || 0;
    } catch (e) {}
    /* 兜底：从页面自己的资源戳里读 */
    try {
      var m = String(document.documentElement.innerHTML).match(/\?v=(\d+)/);
      return m ? Number(m[1]) : 0;
    } catch (e) {}
    return 0;
  })();

  var FIXED_KEY = 'hansen_vw_autofixed';   /* 记录"已为某个服务器版本自动修过一次" */
  var state = { local: LOCAL, server: 0, stale: false, checkedAt: 0, note: '' };

  function log(s) { state.note = s; try { console.info('[版本守望] ' + s); } catch (e) {} }

  /* 去服务器问最新版本 —— 必须绕开所有缓存层 */
  function fetchServerVersion() {
    var url = 'VERSION?_vw=' + Date.now();
    return fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { return Number(String(t || '').trim()) || 0; })
      .catch(function () { return 0; });   /* 断网/取不到 → 当作"无法判断"，绝不误报 */
  }

  /* 清缓存并硬重载 */
  function forceRefresh() {
    var jobs = [];
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister(); }));
        }));
    } catch (e) {}
    try {
      if (window.caches && caches.keys)
        jobs.push(caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k); }));
        }));
    } catch (e) {}
    return Promise.all(jobs)['catch'](function () {}).then(function () {
      try { location.replace(location.pathname + '?_fresh=' + Date.now()); }
      catch (e) { try { location.reload(); } catch (e2) {} }
    });
  }

  function banner(serverV) {
    try {
      if (document.getElementById('hsn_vw_bar')) return;
      var d = document.createElement('div');
      d.id = 'hsn_vw_bar';
      d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;'
        + 'background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;'
        + 'padding:10px 12px;font-size:14px;text-align:center;font-family:system-ui,-apple-system,sans-serif';
      d.textContent = '发现新版本 v' + serverV + '（当前 v' + state.local + '），正在更新…';
      document.body.appendChild(d);
    } catch (e) {}
  }

  function check(opts) {
    opts = opts || {};
    return fetchServerVersion().then(function (sv) {
      state.server = sv;
      state.checkedAt = Date.now();
      /* 无法判断时必须把 stale 复位 —— 否则会残留上一次的结论，
         让面板显示"落后"而实际只是这次没查成。报错链路上不许有会撒谎的东西。 */
      if (!sv) { state.stale = false; log('取不到服务器版本（断网或文件缺失），跳过'); return state; }
      if (!state.local) { state.stale = false; log('读不到本机版本，跳过'); return state; }
      if (sv <= state.local) { log('已是最新 v' + state.local); state.stale = false; return state; }

      state.stale = true;
      log('❗本机 v' + state.local + '，服务器 v' + sv + ' —— 缓存卡住了旧版本');

      if (opts.manual) return forceRefresh().then(function () { return state; });

      /* 自动修复：同一个服务器版本只修一次，避免万一判断有误就陷入重载循环。
         这条保守性比"修得快"重要得多 —— 卡在重载循环里比跑旧版本更糟。 */
      var already = 0;
      try { already = Number(localStorage.getItem(FIXED_KEY) || 0); } catch (e) {}
      if (already === sv) {
        log('已为 v' + sv + ' 自动修过一次仍未生效 —— 不再自动重载，请手动点「强制更新」');
        return state;
      }
      try { localStorage.setItem(FIXED_KEY, String(sv)); } catch (e) {}
      banner(sv);
      return new Promise(function (res) { setTimeout(res, 900); })
        .then(forceRefresh).then(function () { return state; });
    });
  }

  /* 开机后空闲时查一次；不阻塞首屏 */
  function boot() {
    var run = function () { check().catch(function () {}); };
    if (typeof window.requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 8000 });
    else setTimeout(run, 4000);
    /* 从后台切回前台时再查一次 —— 用户挂着页面过夜的场景 */
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' &&
            Date.now() - state.checkedAt > 10 * 60 * 1000) run();
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenVersionWatch = {
    check: check,
    forceRefresh: forceRefresh,
    status: function () { return { local: state.local, server: state.server,
                                   stale: state.stale, note: state.note }; }
  };
})();
