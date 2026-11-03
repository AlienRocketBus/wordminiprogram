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


/* ── 🔒 v1141 四道锁 ─────────────────────────────────────
 *
 * 「打开变下载」这个问题必须**从四个方向同时锁死**，缺一处都可能复发：
 *   ① 部署配置里声明 indexPath —— 不依赖有没有人记得去控制台点那一项
 *   ② Service Worker 兜底 —— 对已装好 SW 的用户
 *   ③ 页面内联自救 —— 万一还是被下载了，用户双击打开时能被送回线上
 *   ④ 自查模块 —— 一键看出是哪一项配错
 */

/* 🔒① 部署配置 */
{
  const cb = JSON.parse(fs.readFileSync('/home/claude/work/repo/cloudbaserc.json', 'utf8'));
  const site = ((cb.framework || {}).plugins || {}).site || {};
  ok((site.inputs || {}).indexPath === 'index.html',
     '★🔒 cloudbaserc.json 里 indexPath = index.html —— ' +
     '部署时就把索引文档带上去，不靠人记得去控制台点');
}

/* 🔒③ 页面内联自救（必须内联，不能是外部脚本） */
{
  const pages = fs.readdirSync('/home/claude/work/repo')
    /* 排除开发用的演示页（与守卫的规则一致）——
       它们不是用户入口，不会被当成网站首页下发。 */
    .filter(f => f.endsWith('.html') && !f.startsWith('_') && !f.startsWith('武器'));
  let missing = [], external = [];
  for (const f of pages) {
    const html = fs.readFileSync('/home/claude/work/repo/' + f, 'utf8');
    if (!/hsnSelfRescue/.test(html)) { missing.push(f); continue; }
    let inline = false;
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) {
      if (/hsnSelfRescue/.test(m[1])) { inline = true; break; }
    }
    if (!inline) external.push(f);
  }
  ok(missing.length === 0,
     `★🔒 所有页面都有 file:// 自救代码（缺 ${missing.length} 个${missing.length?': '+missing.slice(0,3):''}）`);
  ok(external.length === 0,
     `★🔒 自救代码是**内联**的（${external.length} 个写成了外部脚本）—— ` +
     `file:// 下外部脚本根本加载不出来，写成外部等于没写`);
}

/* 🔒③ 自救只在 file:// 下触发，不能误伤正常访问 */
{
  const idx = fs.readFileSync('/home/claude/work/repo/index.html', 'utf8');
  ok(/location\.protocol!=='file:'/.test(idx.replace(/\s/g, '')),
     "★🔒 判据是 location.protocol === 'file:' —— 极其确定，正常访问永远是 http/https");
  ok(/setTimeout\(function\(\)\{shown=false;show\(\);\}/.test(idx.replace(/\s/g, '')) ||
     /shown=false;show\(\)/.test(idx.replace(/\s/g, '')),
     '★🔒 主逻辑可能重绘整个 body，所以补一次 —— 第一版就是被重绘冲掉了');
}

/* 🔒 守卫在守着 */
{
  const g = fs.readFileSync('/home/claude/work/repo/hansen_guards_v1068.py', 'utf8');
  ok(/guard_html_never_downloads/.test(g), '★🔒 有守卫盯死这四处');
  ok(/indexPath/.test(g) && /fixHtmlType/.test(g) && /file:/.test(g),
     '★🔒 守卫同时检查：部署配置 + SW 兜底 + 页面内联自救');
}


/* ── 🔴v1156 追加：别让服务端的一次抽风被我们永久固化 ──────
 *
 * 用户现场：「跟地址就是跟地址，所有的浏览器打开都会出现这种情况。」
 * 而控制台里索引文档已经配好了。
 *
 * 查代码时发现 SW 这边有两个洞，**它们会让问题从"偶尔"变成"永远"**：
 */
{
  const sw = fs.readFileSync('/home/claude/work/repo/sw_v944.js', 'utf8');
  const code = sw.replace(/\/\*[\s\S]*?\*\//g, '');

  /* ① text/plain 以前直接放过去了 */
  ok(/ct\.startsWith\('text\/plain'\)/.test(code),
     '★🔒 **`text/plain` 也算"会被下载"** —— ' +
     '线上探测到的响应正是 text/plain，' +
     '而之前的判据只认 octet-stream / binary / attachment，' +
     '**这道兜底形同虚设**。' +
     '（浏览器对 text/plain 的处理不统一：有的显示成纯文本、有的直接下载，' +
     '无论哪种对一个网页来说都是坏的。）');

  /* ② 坏响应会被原样存进缓存 */
  const iPut = code.indexOf('async function putIfReasonable');
  const segPut = code.slice(iPut, iPut + 700);
  /* 🔴v1156 更新：**改成只修副本了。**
     第一版写成 `response = fixHtmlType(response)` —— 把整个变量换掉，
     而调用方后面还要用这个 response 返回给浏览器，
     于是缓存写失败时导航直接落到离线兜底页（503），
     **那时候网络明明是通的、页面明明已经拿到了。**
     现在只克隆一份、在副本上修、只把副本存进去。 */
  ok(/fixHtmlType\(response\.clone\(\)\)/.test(segPut),
     '★🔒 **进缓存之前就修 Content-Type** —— ' +
     '原来是"缓存时原样存、取出时才修"，这留了个大洞：' +
     '服务端某次回了坏响应就被**原样存进 Cache Storage**，' +
     '之后即使服务端修好了、CDN 缓存也刷了，' +
     '**这个用户的浏览器里还留着那份坏的**，怎么刷新都没用（SW 缓存不吃刷新）。' +
     '也就是说：**服务端的一次抽风，会被我们自己永久固化下来。**');
  ok(/_isPage/.test(segPut),
     '★🔒 只对页面类请求做这个修正 —— 图片/音频的 Content-Type 不能乱改');
  ok(/if \(!_toStore\) _toStore = response\.clone\(\);/.test(segPut),
     '★🔒 **修不成就存原样** —— ' +
     '存一份 Content-Type 不对的，也好过因为修的过程出错而整个存不进去：' +
     '取出时还有 fixHtmlType 兜底，而存不进去就彻底没有缓存了');

  /* ③ 取出时的兜底要保留 —— 老用户缓存里可能已经有坏数据
     （v1165 F065：fixHtmlType 多了第二个参数「这个请求的地址」，好按文件类型给对 MIME；仍然必须经过它） */
  ok(/fixHtmlType\(result\.response(?:\s*,\s*\w+)?\)/.test(code),
     '★🔒 取出时的 fixHtmlType 保留 —— ' +
     '给"缓存里已经存了坏数据"的老用户兜底');
}

/* 判据本身：坏的都要修，好的一个都不能碰 */
{
  const sw = fs.readFileSync('/home/claude/work/repo/sw_v944.js', 'utf8');
  const m = sw.match(/const looksDownload =[\s\S]*?;/);
  const body = m ? m[0] : '';
  for (const bad of ['octet-stream', 'binary/', 'text/plain', 'attachment']) {
    ok(body.includes(bad), `★ 判据里含「${bad}」`);
  }
  ok(/if \(!looksDownload\) return response;/.test(sw),
     '★ **正常响应一律不碰** —— ' +
     '一个"修 Content-Type"的兜底如果乱改正常响应，害处比它挡住的更大');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
