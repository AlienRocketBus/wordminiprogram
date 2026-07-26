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

  /* 空闲时预热（不与首屏抢资源） */
  function scheduleWarm() {
    var keys = Object.keys({ land: 1, season: 1 }).filter(function (k) {
      var c = cfgOf(k); return c && c.warm;
    });
    var i = 0;
    function next() {
      if (i >= keys.length) return;
      warm(keys[i++]);
      /* 逐个预热，间隔开，避免同时抢带宽 */
      setTimeout(next, 1200);
    }
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(function () { next(); }, { timeout: 4000 });
    } else {
      setTimeout(next, 2500);
    }
  }

  if (document.readyState === 'complete') scheduleWarm();
  else window.addEventListener('load', scheduleWarm);

  window.HansenRoom = {
    open: open, close: close, warm: warm,
    isReady: isReady, isOpen: isOpen,
    _rooms: function () { return Object.keys(rooms); }
  };
})();
