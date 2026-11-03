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

  /* v1165：这份页面自己的版本戳（本脚本 src 的 ?v=）—— 岛框和外壳比版本用 */
  var STAMP = (function () {
    try {
      var s = (document.currentScript && document.currentScript.src) || '';
      if (!s) { var t = document.querySelector('script[src*="hansen_version_watch"]'); s = t ? t.getAttribute('src') : ''; }
      var m = String(s).match(/[?&]v=(\d+)/);
      return m ? Number(m[1]) : 0;
    } catch (e) { return 0; }
  })();

  /* 记录「为哪个服务器版本自动修过、最近一次什么时候、修了几次」：{v, at, n}
     v1165：以前同一版本只修一次 —— 发版头几分钟 CDN 新旧混着，这一次常常刷到的还是旧文件，之后再也不自动修。
     现在隔 3 分钟可以再试，最多 3 次；存储写不进去时，地址里刚加的 _fresh 也能挡住循环刷新。 */
  var FIXED_KEY = 'hansen_vw_autofixed';
  var GAP = 3 * 60 * 1000, MAX_TRIES = 3, RECHECK = 60 * 1000;
  var state = { local: LOCAL, server: 0, stale: false, checkedAt: 0, note: '' };
  var inflight = null;   /* 正在问服务器的那一次（同时来的检查共用它） */
  var deferred = 0;      /* 孩子在岛里时攒着、等回首页再做的那次自动更新（服务器版本号） */

  function log(s) { state.note = s; try { console.info('[版本守望] ' + s); } catch (e) {} }

  /* 去服务器问最新版本 —— 必须绕开所有缓存层 */
  function fetchServerVersion() {
    /* 🔴v1084 两处加固：
       ① **用绝对路径**。原来写相对的 'VERSION?...'，在 iframe 或子路径下
          会相对于当前文档解析，可能取到不存在的地址 → 永远返回 0 → 守望者形同虚设。
          改为按站点根目录拼绝对地址。
       ② **补 XHR 兜底**。微信内置浏览器版本参差，个别老内核没有 fetch；
          没有兜底就等于在那些设备上守望者根本不工作，而这恰恰是用户所在的环境。 */
    var base;
    try { base = location.origin + '/'; } catch (e) { base = '/'; }
    var url = base + 'VERSION?_vw=' + Date.now();

    function viaXhr() {
      return new Promise(function (res) {
        try {
          var x = new XMLHttpRequest();
          x.open('GET', url, true);
          try { x.setRequestHeader('Cache-Control', 'no-cache'); } catch (e) {}
          x.onreadystatechange = function () {
            if (x.readyState !== 4) return;
            res(x.status >= 200 && x.status < 300 ? String(x.responseText || '') : '');
          };
          x.onerror = function () { res(''); };
          x.send();
        } catch (e) { res(''); }
      });
    }

    var got;
    if (typeof fetch === 'function') {
      got = fetch(url, { cache: 'no-store', credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .catch(function () { return viaXhr(); });   /* fetch 失败也退回 XHR */
    } else {
      got = viaXhr();
    }
    return got.then(function (t) { return Number(String(t || '').trim()) || 0; })
              .catch(function () { return 0; });    /* 取不到 → "无法判断"，绝不误报 */
  }

  function parseFix(raw) {
    try {
      var o = JSON.parse(raw);
      if (o && typeof o === 'object' && Number(o.v)) return { v: Number(o.v), at: Number(o.at) || 0, n: Number(o.n) || 1 };
    } catch (e) {}
    return null;
  }
  /* 本机和本次会话各存一份，取更保守的（次数多、时间新） */
  function readFix() {
    var a = null, b = null;
    try { a = parseFix(localStorage.getItem(FIXED_KEY)); } catch (e) {}
    try { b = parseFix(sessionStorage.getItem(FIXED_KEY)); } catch (e) {}
    if (!a || !b) return a || b;
    if (a.v !== b.v) return a.at >= b.at ? a : b;
    return { v: a.v, at: Math.max(a.at, b.at), n: Math.max(a.n, b.n) };
  }
  function writeFix(rec) {
    var t = JSON.stringify(rec);
    try { localStorage.setItem(FIXED_KEY, t); } catch (e) {}
    try { sessionStorage.setItem(FIXED_KEY, t); } catch (e) {}
  }
  /* 地址里的 _fresh 是多久以前加的（没有就是 -1） */
  function freshAge() {
    try {
      var m = String(location.search || '').match(/[?&]_fresh=(\d+)/);
      if (m) return Math.abs(Date.now() - Number(m[1]));
    } catch (e) {}
    return -1;
  }
  /* 这次还能不能自动更新到 sv：3 分钟内修过、修满 3 次、刚刷新过，都不再动 */
  function mayAuto(sv) {
    var rec = readFix();
    if (rec && rec.v === sv) {
      if (rec.n >= MAX_TRIES) { log('已为 v' + sv + ' 自动修过 ' + rec.n + ' 次仍未生效 —— 不再自动重载，请手动点「强制更新」'); return false; }
      if (Date.now() - rec.at < GAP) { log('刚为 v' + sv + ' 自动修过，3 分钟后再试'); return false; }
    }
    var age = freshAge();
    if (age >= 0 && age < GAP) { log('刚刷新过（地址带 _fresh），这次不再自动重载'); return false; }
    return true;
  }
  /* 刷新用的地址：原来的参数和 # 都留着，只换 _fresh（以前只留路径，?u=… 和 #… 全丢） */
  function freshUrl(extra) {
    var now = String(Date.now());
    try {
      var u = new URL(location.href);
      if (extra) for (var k in extra) u.searchParams.set(k, extra[k]);
      u.searchParams.set('_fresh', now);
      return u.toString();
    } catch (e) {}
    var q = String(location.search || '').replace(/^\?/, '').split('&').filter(function (x) { return x && !/^_fresh=/.test(x) && !(extra && extra[x.split('=')[0]] !== undefined); });
    if (extra) for (var k2 in extra) q.push(k2 + '=' + encodeURIComponent(extra[k2]));
    q.push('_fresh=' + now);
    return location.pathname + '?' + q.join('&') + (location.hash || '');
  }

  /* 🔴v1084：**只有顶层窗口才做检查与重载。**

     实测确认：本应用的子页（岛屿、单词大陆、赛季岛）都在 index.html 的
     iframe 壳里跑（`openIsland` 换装、v1023 还常驻两个预热 iframe）。
     在 iframe 里：
       · `location.replace` 只重载 iframe 自己，**外壳仍是旧版** ——
         而外壳才是注册 SW、决定整体版本的那个，等于白修；
       · 三四个 iframe 各查一次、各弹一次横幅、各重载一次，互相打架；
       · 预热 iframe 是隐藏的，用户什么都看不到却在反复重载。

     所以：iframe 内**只上报、不动手**，把重载交给顶层窗口。
     同源时直接调顶层的方法；跨源拿不到就安静跳过（绝不误伤）。 */
  function isTop() {
    try { return window.top === window.self; } catch (e) { return false; }
  }
  function delegateToTop() {
    try {
      if (window.top && window.top !== window.self &&
          window.top.HansenVersionWatch &&
          typeof window.top.HansenVersionWatch.check === 'function') {
        log('在 iframe 内 → 交由顶层窗口处理');
        return window.top.HansenVersionWatch.check();
      }
    } catch (e) {}
    log('在 iframe 内且拿不到顶层 → 跳过（不在子框里重载）');
    return Promise.resolve(state);
  }

  /* 清缓存并硬重载 */
  function forceRefresh() {
    if (!isTop()) return delegateToTop();
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
      try { location.replace(freshUrl()); }
      catch (e) { try { location.reload(); } catch (e2) {} }
    });
  }

  var barTimer = 0;
  function banner(text, ms) {
    try {
      var d = document.getElementById('hsn_vw_bar');
      if (!d) {
        d = document.createElement('div');
        d.id = 'hsn_vw_bar';
        d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;pointer-events:none;'
          + 'background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;'
          + 'padding:10px 12px;font-size:14px;text-align:center;font-family:system-ui,-apple-system,sans-serif';
        (document.body || document.documentElement).appendChild(d);
      }
      d.textContent = text;
      clearTimeout(barTimer);
      if (ms) barTimer = setTimeout(function () { try { if (d.parentNode) d.parentNode.removeChild(d); } catch (e) {} }, ms);
    } catch (e) {}
  }

  /* v1165：孩子正在岛里玩（首页外壳的岛框开着，手机框模式下在框里的首页上）就先不刷新 ——
     刷新会把他踢回首页、这一局就没了。等他回首页（外壳调 __hsnAfterIslandClose）或切到后台再更新。 */
  function islandOpen() {
    var docs = [document];
    try { var fs = document.querySelectorAll('iframe'); for (var i = 0; i < fs.length; i++) { try { if (fs[i].contentDocument) docs.push(fs[i].contentDocument); } catch (e) {} } } catch (e) {}
    for (var j = 0; j < docs.length; j++) {
      try {
        var w = docs[j].getElementById('islandFrameWrap');
        if (w && w.style.display !== 'none' && (docs[j].defaultView || window).getComputedStyle(w).display !== 'none') return true;
      } catch (e) {}
    }
    return false;
  }
  function autoRefresh(sv) {
    writeFix({ v: sv, at: Date.now(), n: (function (r) { return r && r.v === sv ? r.n + 1 : 1; })(readFix()) });
    banner('发现新版本 v' + sv + '（当前 v' + state.local + '），正在更新…');
    return new Promise(function (res) { setTimeout(res, 900); })
      .then(function () { return forceRefresh(); }).then(function () { return state; });
  }
  function runDeferred() {
    if (!deferred) return;
    var sv = deferred; deferred = 0;
    if (mayAuto(sv)) autoRefresh(sv);
  }

  function check(opts) {
    opts = opts || {};
    /* iframe 内不自行检查 —— 交给顶层，避免多框各查各的、各重载各的 */
    if (!isTop() && !(opts && opts.fromTop)) return delegateToTop();
    /* v1165：每开一个岛（岛页自己也装着守望者，会来问顶层）都去问一次 /VERSION —— 现在同时来的共用一次，1 分钟内不重复问 */
    if (!opts.manual) {
      if (inflight) return inflight;
      if (state.checkedAt && Date.now() - state.checkedAt < RECHECK) return Promise.resolve(state);
    }
    var p = fetchServerVersion().then(function (sv) {
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

      /* 自动修复：同一个服务器版本 3 分钟内只修一次、最多 3 次，避免万一判断有误就陷入重载循环。
         这条保守性比"修得快"重要得多 —— 卡在重载循环里比跑旧版本更糟。 */
      if (!mayAuto(sv)) return state;
      if (islandOpen()) {
        if (deferred !== sv) { deferred = sv; banner('有新版本，回到首页时自动更新', 6000); }
        log('孩子正在岛里玩 → 回到首页时再更新到 v' + sv);
        return state;
      }
      return autoRefresh(sv);
    });
    if (!opts.manual) {
      inflight = p;
      p.then(function () { inflight = null; }, function () { inflight = null; });
    }
    return p;
  }

  /* v1165：岛框里的页面和外壳不是同一版（发版后网慢：外壳是新的、岛页还是缓存里的旧页，引用的全是旧脚本）
     → 岛框自己带上外壳的版本号重新载一次。每个页面每个版本只试一次（会话里记着），刚刷新过的也不再动。 */
  function fixStaleFrame() {
    if (isTop() || !STAMP) return false;
    var topV = 0;
    try { topV = Number(window.top.HansenVersionWatch && window.top.HansenVersionWatch.stamp) || 0; } catch (e) { return false; }
    if (!topV || STAMP >= topV) return false;
    var key = 'hansen_vw_frame_fix', mark = location.pathname + '@' + topV, done = '';
    try { done = sessionStorage.getItem(key) || ''; } catch (e) {}
    if (done === mark) { log('岛页 v' + STAMP + ' 比外壳 v' + topV + ' 旧，已重载过一次 → 不再重载'); return false; }
    var age = freshAge();
    if (age >= 0 && age < GAP) return false;
    try { sessionStorage.setItem(key, mark); } catch (e) {}
    log('岛页 v' + STAMP + ' 比外壳 v' + topV + ' 旧 → 重新载一次');
    try { location.replace(freshUrl({ v: String(topV) })); return true; } catch (e) { return false; }
  }

  /* 开机后空闲时查一次；不阻塞首屏 */
  function boot() {
    if (fixStaleFrame()) return;
    var run = function () { check().catch(function () {}); };
    if (typeof window.requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 8000 });
    else setTimeout(run, 4000);
    /* 从后台切回前台时再查一次 —— 用户挂着页面过夜的场景；已知落后（上次没修成）就 3 分钟后再查 */
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { runDeferred(); return; }
        var since = Date.now() - state.checkedAt;
        if (document.visibilityState === 'visible' && (since > 10 * 60 * 1000 || (state.stale && since > GAP))) run();
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenVersionWatch = {
    check: check,
    forceRefresh: forceRefresh,
    stamp: STAMP,
    islandClosed: runDeferred,
    status: function () { return { local: state.local, server: state.server,
                                   stale: state.stale, note: state.note }; }
  };
  /* 外壳关岛时调它（index.html 的 _closeIslandNow）：手机框模式下这里不是顶层，转给顶层 */
  window.__hsnAfterIslandClose = function () {
    try {
      var w = isTop() ? window.HansenVersionWatch : window.top.HansenVersionWatch;
      if (w && typeof w.islandClosed === 'function') setTimeout(w.islandClosed, 0);
    } catch (e) {}
  };
})();
