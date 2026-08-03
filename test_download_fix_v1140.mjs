/* test_download_fix_v1140.mjs —— 「网页变成下载 HTML」的自查
 *
 * 用户反馈：从浏览器打开网站，**不是显示页面，而是弹出下载一个 .html 文件**。
 *
 * ═══ 根因只有一个 ═══
 * 服务端把 HTML 当成了附件/未知类型下发：
 *   Content-Type: application/octet-stream（或缺失）
 *   Content-Disposition: attachment
 * 浏览器看到这两种就认为"这是个文件"，于是下载而不是渲染。
 *
 * ═══ 为什么 Service Worker 兜不住 ═══
 * `sw_v944.js` 的 `fixHtmlType()` 会把响应头改回 text/html ——
 * 但 **SW 要先有一次成功的页面加载才能装上**，
 * 而"第一次访问就被下载"恰恰发生在 SW 装上之前。
 * **先有鸡还是先有蛋，客户端解不开。**
 *
 * 所以本模块做的是客户端能做的两件事：
 *   ① 探测各入口的真实响应头 —— 不必再靠猜
 *   ② 给出**准确到具体一项**的控制台操作指引
 */
import fs from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('打开变下载 自查 v1140');

const ctx = { window: {}, location: { origin: 'https://x' },
  fetch: () => Promise.reject(new Error('n/a')),
  Promise, Date, String, Number, Array, Object, Error, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_download_fix_v1140.js', 'utf8'), ctx);
const D = ctx.window.HansenDownloadFix;

/* ① 判定：哪些响应会让浏览器下载 */
{
  ok(D._judge('application/octet-stream', null).bad === true, '★ octet-stream → 会下载');
  ok(D._judge('', null).bad === true, '★ 没有 Content-Type → 会下载');
  ok(D._judge('binary/octet-stream', null).bad === true, '★ binary/* → 会下载');
  ok(D._judge('text/html', 'attachment; filename=x.html').bad === true,
     '★ 即使 Content-Type 是 html，带 attachment 也会下载');
  ok(D._judge('text/plain', null).bad === true, '★ text/plain → 不渲染');
  ok(D._judge('text/html; charset=utf-8', null).bad === false, '★ 正常的 text/html → 会打开');
}

/* ② 探测要绕开缓存 —— 要看服务器现在给什么，不是 SW 改好的那份 */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_download_fix_v1140.js', 'utf8');
  ok(/cache:\s*'no-store'/.test(src), '★ 探测用 no-store');
  ok(/_dl=.*Date\.now\(\)/.test(src) || /_dl=' \+ Date\.now\(\)/.test(src),
     '★ 加时间戳绕开一切缓存 —— 否则看到的是 SW 改好的那份，查不出真问题');
}

/* ③ SW 的兜底还在（对已装好的用户有效） */
{
  const sw = fs.readFileSync('/home/claude/work/repo/sw_v944.js', 'utf8');
  ok(/function fixHtmlType/.test(sw), '★ SW 里的响应头修正还在');
  ok(/dispo\.includes\('attachment'\)/.test(sw), '★ 认 attachment');
  ok(/headers\.delete\('content-disposition'\)/.test(sw), '★ 会把 attachment 头去掉');
  ok(/if \(!looksDownload\) return response/.test(sw),
     '★ 正常响应一律不碰 —— 早期版本读过 body 结果把好页面弄坏了');
}

/* ④ 指引要说到具体哪一项 */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_download_fix_v1140.js', 'utf8');
  ok(/索引文档/.test(src) && /index\.html/.test(src),
     '★ 指引说到"索引文档设为 index.html"，而不是笼统的"服务端配置问题"');
  ok(/rootOnly/.test(src),
     '★ 能识别"只有根路径坏"这种最常见情况 —— 那就百分之百是索引文档没配');
  ok(/SW 还没装上|Service Worker/.test(src),
     '★ 说明为什么老用户感觉不到而新用户会被下载');
}

/* ⑤ 首页必须有这个自查（被下载的正是首页） */
{
  const idx = fs.readFileSync('/home/claude/work/repo/index.html', 'utf8');
  ok(/hansen_download_fix_v1140/.test(idx), '★ 首页加载了自查模块');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
