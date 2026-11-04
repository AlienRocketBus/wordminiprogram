/* test_sw_mime_v1165.mjs —— SW 只把网页改标成 text/html；JS、字体被发错类型时改成它们自己的类型
 *
 * 事故（v1163 审计 NET-15）：fixHtmlType 不看地址，服务器把 JS / 字体发成 octet-stream 时也一律改成 text/html ——
 *   JS 被当成网页（脚本不执行），字体失效。
 *
 * 合同（SW 接管）：octet-stream 的 .js → application/javascript、能执行；octet-stream 的 .woff2 → font/woff2；
 *   text/plain 的网页打开时 → text/html；正常类型的响应一个字都不改。
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
let BAD = false;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p === '/__probe.js') { res.writeHead(200, { 'content-type': BAD ? 'application/octet-stream' : 'text/javascript', 'cache-control': 'no-store' }); return res.end('window.__probeRan=(window.__probeRan||0)+1;'); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    let type = MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream';
    if (BAD && u.searchParams.get('bad') === '1') type = /\.html$/.test(fp) ? 'text/plain' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(d);
  });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  BAD = true;
  const r = await page.evaluate(async () => {
    const t = async u => { const x = await fetch(u, { cache: 'no-store' }); return (x.headers.get('content-type') || '').toLowerCase(); };
    const js = await t('perf_boost.js?bad=1&v=' + Date.now());
    const font = await t('baloo2.woff2?bad=1&v=' + Date.now());
    // 网页要真的「打开」（导航）才走 SW 的网页路径：开一个 iframe，看浏览器把它当成什么
    const html = await new Promise(res => { const f = document.createElement('iframe'); f.style.cssText = 'width:10px;height:10px'; f.onload = () => { let ct = ''; try { ct = f.contentDocument.contentType; } catch (e) { ct = 'cross'; } res(ct); }; f.src = '_frame.html?bad=1&n=' + Date.now(); document.body.appendChild(f); });
    const good = await t('click_sound.js?v=' + Date.now());
    const ran = await new Promise(res => { const s = document.createElement('script'); s.src = '__probe.js?v=' + Date.now(); s.onload = () => res(window.__probeRan || 0); s.onerror = () => res(-1); document.head.appendChild(s); });
    return { js, font, html, good, ran };
  });
  console.log('    ' + JSON.stringify(r));
  ok(/javascript/.test(r.js), `octet-stream 的 .js → ${r.js}`);
  ok(/font\/woff2/.test(r.font), `octet-stream 的 .woff2 → ${r.font}`);
  ok(/text\/html/.test(r.html), `text/plain 的网页（_frame.html）打开后是 ${r.html}`);
  ok(/javascript/.test(r.good), `正常的 .js 不改（${r.good}）`);
  ok(r.ran === 1, `发错类型的脚本照样能执行（执行 ${r.ran} 次）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ SW 只把网页改成 text/html，别的类型各归其位');
process.exit(fails ? 1 : 0);
