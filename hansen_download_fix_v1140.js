/* hansen_download_fix_v1140.js —— 「网页变成下载 HTML」的自查与修复
 *
 * ═══ 问题 ═══
 *
 * 从浏览器打开网站，不是显示页面，而是**弹出下载一个 .html 文件**。
 *
 * ═══ 根因（只有一个）═══
 *
 * **服务端把 HTML 当成了附件/未知类型下发。** 具体是这两种响应头之一：
 *     Content-Type: application/octet-stream   （或者干脆没有）
 *     Content-Disposition: attachment
 *
 * 浏览器看到这两种，就认为"这是个文件"，于是下载而不是渲染。
 * **文件本身没问题** —— 同一个文件用 index.html 路径能正常打开、
 * 用根路径就下载，说明是托管配置的事。
 *
 * ═══ 为什么 Service Worker 兜不住 ═══
 *
 * `sw_v944.js` 里的 `fixHtmlType()` 会把这类响应头改回 text/html，
 * 对**已经装好 SW 的访问**是有效的。
 *
 * 但 **SW 要先有一次成功的页面加载才能装上** ——
 * 而"第一次访问就被下载"恰恰发生在 SW 装上之前。
 * 这是个先有鸡还是先有蛋的问题，**客户端无法自己解开**。
 *
 * ═══ 所以本模块做两件客户端能做的事 ═══
 *
 *   ① **自查**：主动探测各个入口路径，把真实的响应头显示出来 ——
 *      不必再靠猜"是不是又下载了"。
 *   ② **给准确的操作指引**：告诉用户去控制台改哪一项，
 *      而不是笼统地说"服务端配置问题"。
 *
 * 挂在 `window.HansenDownloadFix.check()`，云端自检面板里可以直接调。
 */
(function () {
  'use strict';
  if (window.HansenDownloadFix) return;

  /* 会让浏览器"下载而不是打开"的响应特征 */
  function judge(ct, dispo) {
    var c = String(ct || '').toLowerCase();
    var d = String(dispo || '').toLowerCase();
    if (d.indexOf('attachment') >= 0) return { bad: true, why: 'Content-Disposition 是 attachment' };
    if (c === '') return { bad: true, why: '没有 Content-Type' };
    if (c.indexOf('application/octet-stream') === 0) return { bad: true, why: 'Content-Type 是 octet-stream' };
    if (c.indexOf('binary/') === 0) return { bad: true, why: 'Content-Type 是 binary/*' };
    if (c.indexOf('text/html') === 0) return { bad: false, why: 'text/html —— 正常' };
    return { bad: true, why: 'Content-Type 是 ' + c + '（不是 text/html）' };
  }

  function probe(path) {
    /* 加时间戳绕开一切缓存 —— 要看的是**服务器现在给什么**，
       不是 SW 或浏览器缓存里那份改好的。 */
    var url = location.origin + path + (path.indexOf('?') >= 0 ? '&' : '?') + '_dl=' + Date.now();
    return fetch(url, { method: 'GET', cache: 'no-store' }).then(function (r) {
      var ct = r.headers.get('content-type');
      var dispo = r.headers.get('content-disposition');
      var v = judge(ct, dispo);
      return { path: path, status: r.status, ct: ct || '(无)',
               dispo: dispo || '(无)', bad: v.bad, why: v.why };
    })['catch'](function (e) {
      return { path: path, status: 0, ct: '-', dispo: '-', bad: null,
               why: '探测失败：' + String((e && e.message) || e).slice(0, 40) };
    });
  }

  function check() {
    var paths = ['/', '/index.html', '/spelling_pk.html'];
    return Promise.all(paths.map(probe)).then(function (rows) {
      var broken = rows.filter(function (r) { return r.bad === true; });
      return {
        ok: broken.length === 0,
        rows: rows,
        broken: broken,
        /* 关键判断：如果只有 `/` 坏、`/index.html` 正常，
           那就百分之百是**索引文档没配** —— 这是最常见的一种。 */
        rootOnly: broken.length === 1 && broken[0].path === '/',
        advice: adviceFor(rows, broken)
      };
    });
  }

  function adviceFor(rows, broken) {
    if (!broken.length) return '三个入口都是 text/html —— 服务端配置正常。';
    var rootBad = broken.some(function (b) { return b.path === '/'; });
    var indexOk = rows.some(function (r) { return r.path === '/index.html' && r.bad === false; });
    if (rootBad && indexOk) {
      return '只有根路径「/」会下载，而「/index.html」正常 —— '
           + '这是**索引文档没配**。到腾讯云控制台 → 静态网站托管 → 基础配置，'
           + '把「索引文档」设为 index.html（不要带斜杠），保存后等一两分钟生效。';
    }
    return '多个入口都被当成文件下发。到腾讯云控制台 → 静态网站托管，'
         + '检查「索引文档」是否为 index.html；'
         + '若仍不行，检查是否给 .html 配了错误的 MIME 或强制下载规则。';
  }

  /* 给面板用的一段可读文本 */
  function report() {
    return check().then(function (r) {
      var lines = ['── 网页是否会被当成文件下载 ──'];
      r.rows.forEach(function (x) {
        lines.push((x.bad === true ? '❌ ' : (x.bad === false ? '✅ ' : '⚠️ ')) +
          x.path + '  [' + x.status + ']  ' + x.why);
      });
      lines.push('');
      lines.push(r.ok ? '✅ 配置正常，不会出现"打开变下载"。' : ('👉 ' + r.advice));
      if (!r.ok) {
        lines.push('');
        lines.push('（说明：已装好的手机上 Service Worker 会自动把它改回正常，'
                 + '所以老用户可能感觉不到；但**第一次访问的人会直接被下载**，'
                 + '因为那时 SW 还没装上 —— 这一步只能在控制台修。）');
      }
      return lines.join('\n');
    });
  }

  window.HansenDownloadFix = { check: check, report: report, _judge: judge };
})();
