/* hansen_selfrescue_v1141.js —— 被当成文件下载后的自救
 *
 * ═══ 🔒 第二道锁 ═══
 *
 * 前提：万一服务端又把 HTML 当附件下发，用户手上会多出一个
 * `index.html` 文件。他八成会**双击打开它** —— 那时页面跑在 `file://` 下。
 *
 * `file://` 下这个 App 是废的：没有 localStorage 域、没有 Service Worker、
 * 所有相对路径的脚本都加载不了、云端也连不上。
 * 用户看到的是一个白屏或残破页面，**只会以为"这 App 坏了"**。
 *
 * 所以这里做一件事：**认出自己被下载了，然后把人送回线上**。
 *
 * 判据是 `location.protocol === 'file:'` —— 极其确定，不会误判：
 * 正常访问永远是 http/https，只有"下载后双击打开"才是 file:。
 *
 * 做法不是直接跳转（有些浏览器会拦截 file: 页面的自动跳转），
 * 而是**盖一层说明 + 一个大按钮**，让用户点一下回去。
 * 同时把线上地址显示出来，方便他直接复制。
 *
 * ⚠️ 必须内联在页面里，不能靠外部脚本 ——
 * file:// 下相对路径的脚本根本加载不出来，那正是要救的场景。
 */
(function () {
  'use strict';
  if (location.protocol !== 'file:') return;

  var SITE = 'https://superwords-ambitious-d0g1d26xm740dc3d6.webapps.tcloudbase.com/';

  function show() {
    try {
      var d = document.createElement('div');
      d.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483647;background:#0b1020;color:#e8eefc;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'padding:24px;text-align:center;font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
      d.innerHTML =
        '<div style="font-size:46px">📄</div>' +
        '<div style="font-size:19px;font-weight:800;margin-top:12px">这是下载下来的文件</div>' +
        '<div style="font-size:14px;color:#a9b4c7;margin-top:10px;line-height:1.8;max-width:340px">' +
          '你现在打开的是一个存在手机里的文件，<br>不是网站本身 —— 所以进度、登录都用不了。<br>' +
          '点下面的按钮回到真正的网站。' +
        '</div>' +
        '<a href="' + SITE + '" style="margin-top:20px;display:inline-block;' +
          'background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;text-decoration:none;' +
          'padding:14px 26px;border-radius:14px;font-size:16px;font-weight:800">🌐 打开真正的网站</a>' +
        '<div style="font-size:11.5px;color:#7c879b;margin-top:16px;word-break:break-all;max-width:340px">' +
          SITE +
        '</div>' +
        '<div style="font-size:11.5px;color:#7c879b;margin-top:14px;line-height:1.7;max-width:340px">' +
          '（进去之后可以把这个下载的文件删掉）' +
        '</div>';
      (document.body || document.documentElement).appendChild(d);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else { show(); }
})();
