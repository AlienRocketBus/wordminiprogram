/* hansen_boot_check_v1156.js —— 核心模块到底装上没有
 *
 * ═══ 为什么要有这个 ═══
 *
 * 用户要求「彻查还有什么会让小程序运行不了」。
 * 我用本地服务器模拟了三种服务端故障，结果出奇一致：
 *
 *   · 词库 404（单个关键文件丢了）
 *   · JS 全部 504（服务端挂了一半）
 *   · JS 被截断一半（CDN 传输中断）
 *
 * 三种情况下：
 *
 *     页面有内容      ✅  骨架照常渲染
 *     能点的按钮      5~7 个
 *     window.HansenBackup  undefined   ❌
 *     脚本错误        零（前两种）
 *
 * **用户看到的是一个能点、但什么都不工作的界面。**
 * 而且没有任何提示 —— 他不知道是自己网不好、还是这个应用坏了，
 * 只会觉得「这东西不行」然后关掉。
 *
 * > **比白屏更糟的是「看起来正常但其实是空壳」** ——
 * > 白屏至少让人知道出事了。
 *
 * ═══ 这个模块做什么 ═══
 *
 * 页面稳定之后点一次名：**几个核心模块在不在？**
 * 缺了就明说是网络问题，并给一个重新加载的按钮。
 *
 * ═══ 几条刻意的克制 ═══
 *
 *   · **等 6 秒再查** —— 有些模块是 defer/异步加载的，查太早会误报，
 *     而误报会让人开始忽略这个提示
 *   · **只认真正的"少了就没法玩"的模块** —— 装饰性的缺了不该拦人
 *   · **给的是"重新加载"而不是自动刷新** ——
 *     自动刷新遇到持续故障会变成无限重启，比不刷新更糟
 */
(function () {
  'use strict';

  /* 少了这些就真的没法玩 —— 一个都不能少。
     刻意不列装饰性模块（配色、特效、宠物展示…）：
     它们缺了游戏照样能玩，为它们拦住用户是本末倒置。 */
  /* ⚠️ 只能列**这个页面确实会加载**的模块 —— 否则永远误报。
     第一版我把 `HansenBackup` 写进来了，而首页压根不加载它，
     结果**正常情况下也天天报警** —— 那比不报警更糟：
     用户看两次就学会无视，真出事时也不会看了。

     这三个是实测确认首页一定有的（跑真浏览器列过 window 上的全局）：
       HansenCoins   金币（钱没了游戏就没法玩）
       HansenUpgrade 升级（岛屿进度的核心）
       HansenAuth    账号（登录/云存档的入口） */
  /* 🔴v1156 第二次修：**不同页面该守的模块不一样。**

     第一版列了 HansenCoins / HansenUpgrade / HansenAuth 一刀切，
     结果在**对战页**上报「金币、升级 缺失」——
     而对战页本来就不加载这两个，那是首页的模块。

     这是这道自检第二次误报了（第一次是列了首页没有的 HansenBackup）。
     两次都是同一个错：**我按"想当然哪些重要"列清单，
     而不是按"这个页面实际加载了什么"**。

     > 一个天天喊狼来了的警报，等于没有警报。

     改法：**只守"这个页面确实引用了对应脚本"的模块** ——
     页面加载了 hansen_coin_wallet.js 才要求 HansenCoins 在。
     没加载就不该要求，这是常识。 */
  var CORE_MAP = [
    ['HansenCoins',   '金币', 'hansen_coin_wallet'],
    ['HansenUpgrade', '升级', 'hansen_upgrade'],
    ['HansenAuth',    '账号', 'hansen_auth_v1004']
  ];

  /* 这个页面到底加载了哪些脚本 —— 只认它自己引的 */
  function CORE() {
    var out = [];
    try {
      var srcs = '';
      var tags = document.getElementsByTagName('script');
      for (var i = 0; i < tags.length; i++) srcs += (tags[i].getAttribute('src') || '') + ' ';
      for (var j = 0; j < CORE_MAP.length; j++) {
        if (srcs.indexOf(CORE_MAP[j][2]) >= 0) out.push(CORE_MAP[j]);
      }
    } catch (e) {}
    return out;
  }

  var CHECK_AT = 6000;   /* 等页面稳定 —— 查太早会误报 defer 模块 */
  var shown = false;

  function missing() {
    var out = [];
    var list = CORE();
    for (var i = 0; i < list.length; i++) {
      try {
        if (typeof window[list[i][0]] === 'undefined') out.push(list[i][1]);
      } catch (e) {
        out.push(list[i][1]);
      }
    }
    return out;
  }

  function tell(lost) {
    if (shown) return;
    shown = true;
    try {
      if (document.getElementById('hsnBootBad')) return;
      var d = document.createElement('div');
      d.id = 'hsnBootBad';
      d.setAttribute('style',
        'position:fixed;left:0;right:0;bottom:0;z-index:2147483644;' +
        'background:#334155;color:#fff;padding:13px 14px;' +
        'font-size:13.5px;line-height:1.7;text-align:center;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif;' +
        'box-shadow:0 -4px 18px rgba(0,0,0,.35)');
      d.innerHTML =
        '<div style="font-weight:800;margin-bottom:4px">\u26a0\ufe0f 有几块没加载出来</div>' +
        '<div style="opacity:.9">' + lost.join('、') +
        ' 没能加载完 —— 多半是网络不稳。<br>' +
        '你的进度都在，重新加载一下就好。</div>' +
        '<button id="hsnBootReload" style="margin-top:9px;background:#fff;color:#334155;' +
          'border:0;padding:9px 20px;border-radius:11px;font-size:14px;' +
          'font-weight:800;cursor:pointer">重新加载</button>';
      (document.body || document.documentElement).appendChild(d);
      var b = document.getElementById('hsnBootReload');
      if (b) {
        b.onclick = function () {
          /* 不自动刷新 —— 遇到持续故障会变成无限重启，比不刷新更糟。
             这里用户主动点了，才带上时间戳绕过缓存重来一次。 */
          /* v1165：用 replace、而且 _r 只换不加 —— 以前 location.href 追加 _r，在首页外壳的岛里会多出一条历史，
             孩子点 🗺️ 回首页要点两下；连点几次「重新加载」地址后面还会越拖越长。 */
          try {
            var url = new URL(location.href);
            url.searchParams.set('_r', String(Date.now()));
            location.replace(url.href);
          } catch (e) {
            try { location.reload(); } catch (e2) {}
          }
        };
      }
    } catch (e) {}
  }

  function check() {
    var lost = missing();
    if (lost.length) {
      tell(lost);
      /* 同时记进"悄悄报错观察者"，自检面板里能看到 */
      try {
        window.dispatchEvent(new ErrorEvent('error',
          { message: '[启动自检] 核心模块缺失：' + lost.join('、') }));
      } catch (e) {}
    }
  }

  try {
    if (document.readyState === 'complete') setTimeout(check, CHECK_AT);
    else window.addEventListener('load', function () { setTimeout(check, CHECK_AT); });
  } catch (e) {}

  window.HansenBootCheck = {
    missing: missing,
    _checkForTest: check,
    _coreForTest: CORE
  };
})();
