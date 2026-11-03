/* hansen_room_warm_v1023.js —— 「房间预热常驻」：让子页面切换零延迟
 *
 * 背景：星海觉醒(land_map)、赛季岛(island_season)、Boss殿堂、赛季展柜、拼写蜂
 *       都是独立页面，每次点开都要完整加载一次 → 有明显等待，像"走网页"而不是"进隔壁房间"。
 *
 * 为什么不直接把代码合并进岛屿页：
 *   land_map 与 island_season 各 600+ KB，含各自完整的 showScreen/S/CSS 体系，
 *   硬合并会撞变量、撞样式，且岛屿页首屏要多背 1.2MB——
 *   为了消灭切换延迟反而拖慢每次打开，得不偿失。
 *
 * 本方案：**预热 + 常驻**
 *   ① 岛屿页加载完毕并空闲后，在后台把子页面悄悄载入隐藏容器（不抢首屏资源）；
 *   ② 用户点击时只做 display 切换 —— 已经加载好了，所以是瞬开；
 *   ③ 关闭时只隐藏、不销毁，之后再进依然瞬开。
 * 效果上等同于"同一间屋子里的房间"，且完全没有代码合并的撞车风险。
 */
(function () {
  'use strict';
  if (window.HansenRoom) return;

  var rooms = {};          /* key → {wrap, iframe, ready, loading} */
  var Z = 2147483500;

  function cfgOf(key) {
    var MAP = {
      land:    { url: 'land_map.html',        title: '单词大陆', warm: true  },
      season:  { url: 'island_season.html',   title: '赛季岛',   warm: true  },
      hall:    { url: 'boss_hall.html',       title: 'Boss 殿堂', warm: false },
      showcase:{ url: 'season_showcase.html', title: '赛季展柜', warm: false },
      bee:     { url: 'spelling_bee.html',    title: '拼写蜂',   warm: false }
    };
    return MAP[key] || null;
  }

  function ver() {
    try {
      var s = document.querySelector('script[src*="hansen_room_warm"]');
      var m = s && s.getAttribute('src').match(/[?&]v=(\d+)/);
      return m ? m[1] : '';
    } catch (e) { return ''; }
  }

  function build(key) {
    if (rooms[key]) return rooms[key];
    var cfg = cfgOf(key);
    if (!cfg) return null;

    var wrap = document.createElement('div');
    wrap.id = 'hsn_room_' + key;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', cfg.title);
    wrap.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';background:#0f172a;'
      + 'display:none;overflow:hidden';

    var ifr = document.createElement('iframe');
    ifr.title = cfg.title;
    ifr.setAttribute('allow', 'autoplay');
    ifr.style.cssText = 'display:block;width:100%;height:100%;border:0;margin:0;padding:0;background:#0f172a';
    var v = ver();
    ifr.src = cfg.url + (v ? ('?v=' + v) : '');
    ifr.addEventListener('load', function () {
      var r = rooms[key]; if (r) { r.ready = true; r.loading = false; }
    });

    var back = document.createElement('button');
    back.type = 'button';
    back.setAttribute('aria-label', '返回');
    back.textContent = '✕';
    back.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;z-index:2;'
      + 'width:38px;height:38px;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;'
      + 'font-size:18px;font-weight:900;cursor:pointer';
    back.onclick = function () { close(key); };

    wrap.appendChild(ifr);
    wrap.appendChild(back);
    (document.body || document.documentElement).appendChild(wrap);

    rooms[key] = { wrap: wrap, iframe: ifr, ready: false, loading: true };
    return rooms[key];
  }

  /* 后台预热：不显示，只把内容加载好 */
  function warm(key) {
    var r = rooms[key];
    if (r) return r;
    return build(key);
  }

  function open(key) {
    var r = rooms[key] || build(key);
    if (!r) return false;
    markOpened(key);   /* v1165：孩子真的打开过 → 以后才值得后台预热它 */
    r.wrap.style.display = 'block';
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
    return true;
  }

  function close(key) {
    var r = rooms[key];
    if (r) r.wrap.style.display = 'none';   /* 只隐藏, 不销毁 → 下次仍瞬开 */
    try { document.documentElement.style.overflow = ''; } catch (e) {}
  }

  function isReady(key) { var r = rooms[key]; return !!(r && r.ready); }
  function isOpen(key) {
    var r = rooms[key];
    return !!(r && r.wrap && r.wrap.style.display === 'block');
  }

  /* ── 资源预热：给「带参数打开」的页面用 ──────────────────
     Boss 殿堂 / 赛季展柜 / 拼写蜂 每次打开的地址都带不同参数
     （lv= / card= / boss= / island=），无法像固定房间那样预开一扇门。
     但它们的**脚本与样式是同一批**，所以空闲时先用基础地址加载一次，
     把 HTML 与全部子资源灌进浏览器缓存；之后无论带什么参数打开，
     子资源全部命中缓存，加载时间大幅缩短。 */
  var prefetched = {};
  function prefetch(url) {
    if (!url || prefetched[url]) return;
    prefetched[url] = 1;
    try {
      var v = ver();
      var full = url + (v ? ('?v=' + v + '&warm=1') : '?warm=1');
      var ifr = document.createElement('iframe');
      ifr.setAttribute('aria-hidden', 'true');
      ifr.tabIndex = -1;
      ifr.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px';
      ifr.src = full;
      /* 🔴v1154：**清理不能只挂在 load 上。**

         原来只在 `load` 成功时才移除 —— 而 iframe 有三种收不到 load 的情况：
           · 加载失败（404 / 网络断了）
           · 加载卡住（弱网下永远转圈）
           · 被浏览器策略拦下
         这几种下**隐藏 iframe 就永久留在 DOM 里**，一次预热多个页面
         就是多个常驻 iframe —— 每个都持有一份完整的页面上下文，很吃内存。

         而这个模块的用途是"提前把资源灌进缓存"，
         **灌没灌进去都不该让 iframe 留着**。

         改为三条腿：load 成功后移除 / error 也移除 /
         **兜底一个硬超时**（8 秒，不管发生什么都清掉）。 */
      var _gone = false;
      var _kill = function () {
        if (_gone) return;
        _gone = true;
        try { ifr.remove(); } catch (e) {}
      };
      ifr.addEventListener('load', function () { setTimeout(_kill, 600); });
      ifr.addEventListener('error', _kill);
      setTimeout(_kill, 8000);        /* 兜底：卡住/被拦也一定清掉 */
      (document.body || document.documentElement).appendChild(ifr);
    } catch (e) {}
  }

  /* ── v1165：预热要守三条规矩 ─────────────────────────────
     实测（4G + 4 倍慢 CPU）：旧版每开一个岛，后台多下约 6MB、多跑约 1 秒脚本、多 4~5 个页面，
     而岛本身并没有更快可用。原因有三：
       ① 套娃：星海岛自己也是岛页，也装着本模块 → 在预热框里又去预热星海地图和星海岛……
       ② 不看网络：弱网 / 省流量 / 网络未知（iOS）也照下不误，和 Boss 预取用的 HansenPreloadPolicy 不一致；
       ③ 不看孩子：从没去过星海的孩子也每次都被预热，而且被预热的星海页会写存档 ——
          「我的学习」因此说他去过星海，星海的开场故事也被标成「已看过」。
     现在：在预热框里绝不再预热；网络策略不允许就不预热；星海页只给真的打开过它的孩子预热
     （没打开过的，首页手指碰到星海入口时 hansen_season.js 会抢先预取）。
     三个「带参数页」的资源预热也一样：不套娃、看网络，而且要孩子至少玩过一局。 */
  function policy() { return window.HansenPreloadPolicy || null; }
  function inWarmContext() {
    try { if (/[?&]warm=1(?:&|$)/.test(location.search || '')) return true; } catch (e) {}
    try {
      var fe = window.frameElement;
      if (!fe) return false;
      if (fe.getAttribute && fe.getAttribute('aria-hidden') === 'true') return true;   /* prefetch() 的隐藏框 */
      if (fe.closest && fe.closest('[id^="hsn_room_"]')) return true;                 /* 常驻房间里 */
      return false;
    } catch (e) {
      return window.top !== window.self;   /* 读不到父页面就当作在别人的框里，宁可不预热 */
    }
  }
  function canBackground() {
    try {
      var p = policy();
      if (p && typeof p.canBackgroundDownload === 'function') return !!p.canBackgroundDownload();
    } catch (e) {}
    return false;
  }
  function mustYield() {
    try { var p = policy(); return !!(p && typeof p.shouldYield === 'function' && p.shouldYield()); }
    catch (e) { return true; }
  }
  function wasOpened(key) {
    try { var p = policy(); return !!(p && typeof p.roomOpened === 'function' && p.roomOpened(key)); }
    catch (e) { return false; }
  }
  function markOpened(key) {
    try { var p = policy(); if (p && typeof p.markRoomOpened === 'function') p.markRoomOpened(key); } catch (e) {}
  }
  function kidHasPlayed() {
    try { var p = policy(); return !!(p && typeof p.kidHasPlayed === 'function' && p.kidHasPlayed()); }
    catch (e) { return false; }
  }
  /* 本页自己就是星海页、而且不是藏在预热框里 → 孩子正在看它，记下来 */
  function markSelfIfStarSea() {
    if (inWarmContext()) return;
    var path = '';
    try { path = location.pathname || ''; } catch (e) {}
    if (/island_season\.html$/i.test(path)) markOpened('season');
    else if (/island_land\d+\.html$/i.test(path)) markOpened('land');   /* 单词大陆的岛只能从地图进 */
  }
  markSelfIfStarSea();

  /* v1165：本页在任何页面框里（首页外壳的 #islandFrame、预热框、房间）都不预热。
     首页外壳里从来不会打开这些房间（换岛走 openIsland），预热只会多开隐藏页面、多下载、
     还让藏着的星海岛照常存档（首页「最近探险」因此指错岛）。按需 open()/warm() 照旧能用。 */
  function inAnyFrame() {
    try { return !!(window.parent && window.parent !== window); } catch (e) { return true; }
  }
  function ownFile() {
    try { return String(location.pathname || '').split('/').pop().toLowerCase(); } catch (e) { return ''; }
  }

  /* 空闲时预热（不与首屏抢资源） */
  function scheduleWarm() {
    if (inWarmContext()) return;   /* ① 绝不套娃 */
    if (inAnyFrame()) return;      /* ④ 页面框里不预热（见上） */
    var self = ownFile();
    var keys = Object.keys({ land: 1, season: 1 }).filter(function (k) {
      var c = cfgOf(k);
      if (c && c.url.toLowerCase() === self) return false;    /* 星海岛自己不再在里面预热一个星海岛 */
      return c && c.warm && wasOpened(k);   /* ③ 只预热孩子真的打开过的房间 */
    });
    var assetsOk = kidHasPlayed();
    var i = 0;
    function next() {
      if (i >= keys.length) return;
      if (!canBackground()) return;                          /* ② 网络变差 / 页面转后台：这轮不再预热 */
      if (mustYield()) { setTimeout(next, 600); return; }    /* 孩子正在点 / 正在放音：先让路 */
      warm(keys[i++]);
      /* 逐个预热，间隔开，避免同时抢带宽 */
      setTimeout(next, 1200);
    }
    /* 常驻房间预热完后, 再顺带把三个「带参数页」的资源灌进缓存 */
    var PREFETCH = ['boss_hall.html', 'season_showcase.html', 'spelling_bee.html'];
    function warmAssets() {
      if (!assetsOk) return;
      var j = 0;
      (function step() {
        if (j >= PREFETCH.length) return;
        if (!canBackground()) return;
        if (mustYield()) { setTimeout(step, 600); return; }
        prefetch(PREFETCH[j++]);
        setTimeout(step, 1500);
      })();
    }
    function chain() {
      if (!canBackground()) return;   /* ② 与 Boss 预取同一个网络策略：明确 4G、非省流量、页面可见 */
      next(); setTimeout(warmAssets, keys.length * 1300 + 800);
    }
    if (!keys.length && !assetsOk) return;
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(function () { chain(); }, { timeout: 4000 });
    } else {
      setTimeout(chain, 2500);
    }
  }

  if (document.readyState === 'complete') scheduleWarm();
  else window.addEventListener('load', scheduleWarm);

  window.HansenRoom = {
    open: open, close: close, warm: warm, prefetch: prefetch,
    prefetched: function(){ return Object.keys(prefetched); },
    isReady: isReady, isOpen: isOpen,
    _rooms: function () { return Object.keys(rooms); }
  };
})();
