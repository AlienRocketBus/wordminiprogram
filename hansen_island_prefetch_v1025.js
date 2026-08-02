/* hansen_island_prefetch_v1025.js —— 主页 → 岛屿页「触碰即预取」
 *
 * 缺口：主页到 18 个岛屿页一直是**整页跳转**，每次都要完整加载 600KB 左右的岛屿页。
 *       此前几轮打通的都是「岛屿页 → 子页面」，从没碰过「主页 → 岛屿页」这一段，
 *       而这恰恰是玩家每天走得最多的一条路。
 *
 * 为什么不全部预热常驻：18 个岛屿页加起来 10MB+，全预载会吃光流量与内存。
 *
 * 本方案三层，从省到快：
 *   ① 空闲预取「最近玩过的岛」—— 大多数人每天就在固定那一两个岛，命中率最高；
 *   ② **触碰即预取** —— 手指刚按下/鼠标刚移上卡片就开始加载，
 *      等抬手跳转时页面通常已在缓存里（人的按下到抬起约 100–200ms，够抢跑）；
 *   ③ 视口内的卡片在浏览器空闲时逐个低优先级预取，上限受控。
 */
(function () {
  'use strict';
  if (window.HansenIslandPrefetch) return;

  var done = {};        /* url → 1 */
  var MAX = 6;          /* 空闲阶段最多预取几个，避免吃流量 */
  var idleCount = 0;

  function ver() {
    try {
      var s = document.querySelector('script[src*="hansen_island_prefetch"]');
      var m = s && s.getAttribute('src').match(/[?&]v=(\d+)/);
      return m ? m[1] : '';
    } catch (e) { return ''; }
  }

  function normalize(href) {
    if (!href) return '';
    var u = String(href).split('#')[0];
    if (!/island_[a-z0-9]+\.html/i.test(u)) return '';
    return u.split('?')[0];
  }

  /* 用 <link rel=prefetch> 让浏览器以最低优先级预取，不与当前页抢带宽 */
  function prefetch(url, why) {
    var u = normalize(url);
    if (!u || done[u]) return false;
    done[u] = 1;
    try {
      var v = ver();
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = u + (v ? ('?v=' + v) : '');
      link.setAttribute('data-why', why || '');
      (document.head || document.documentElement).appendChild(link);
      return true;
    } catch (e) { return false; }
  }

  /* ② 触碰即预取：按下/移入的瞬间就开始，抬手时通常已就绪 */
  function bindEager() {
    var links = document.querySelectorAll('a[href*="island_"]');
    for (var i = 0; i < links.length; i++) {
      (function (a) {
        var go = function () { prefetch(a.getAttribute('href'), 'touch'); };
        a.addEventListener('pointerenter', go, { passive: true });
        a.addEventListener('touchstart', go, { passive: true });
        a.addEventListener('pointerdown', go, { passive: true });
      })(links[i]);
    }
    return links.length;
  }

  /* ① 最近玩过的岛：命中率最高，优先预取 */
  function prefetchRecent() {
    var picked = [];
    try {
      var last = localStorage.getItem('lastIslandKey');
      if (last) picked.push('island_' + String(last).replace(/[^a-z0-9]/gi, '') + '.html');
    } catch (e) {}
    try {
      /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk1=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk1.length;i++){
        var k = _lsk1[i];
        if (k && k.indexOf('wordIsland') === 0) {
          var name = k.slice('wordIsland'.length).toLowerCase();
          if (name) picked.push('island_' + name + '.html');
        }
      }
    } catch (e) {}
    var n = 0;
    for (var j = 0; j < picked.length && idleCount < MAX; j++) {
      if (prefetch(picked[j], 'recent')) { n++; idleCount++; }
    }
    return n;
  }

  /* ③ 空闲时把页面上其余岛屿卡片也逐个低优先级预取（受 MAX 限制） */
  function prefetchVisible() {
    var links = document.querySelectorAll('a[href*="island_"]');
    var i = 0;
    (function step() {
      if (i >= links.length || idleCount >= MAX) return;
      var href = links[i++].getAttribute('href');
      if (prefetch(href, 'idle')) idleCount++;
      setTimeout(step, 900);   /* 拉开间隔，绝不与用户操作抢带宽 */
    })();
  }

  function boot() {
    bindEager();                       /* 触碰预取立刻生效 */
    var run = function () { prefetchRecent(); setTimeout(prefetchVisible, 1500); };
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(function () { run(); }, { timeout: 4000 });
    } else {
      setTimeout(run, 2500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenIslandPrefetch = {
    prefetch: prefetch,
    prefetched: function () { return Object.keys(done); },
    _bind: bindEager
  };
})();
