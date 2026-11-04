/* test_sw_nav_error_v1165.mjs —— 服务器对首页/岛页回 404/502 时，孩子看到的是手机里已缓存的游戏，不是错误页
 *
 * 事故（v1163 审计 NET-10）：sw_v944.js 只在 fetch 抛错（断网）时才用缓存；服务器回 502（网关坏了）或首页 404
 *   （托管的索引文档配错）时，原样把错误页交给孩子 —— 手机里明明有能玩的缓存。
 *
 * 合同（SW 接管、首页和食物岛都打开过一次）：
 *   '/' 回 404、index.html 回 502 → 显示缓存的首页；island_food.html 回 502 → 显示缓存的食物岛；
 *   服务器恢复正常后照常拿新页面
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
const FAIL = {};   // 路径 → 状态码
const HITS = {};   // 出错期间服务器真的收到了几次（证明真的回了错误码，不是根本没来问）
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (FAIL[p]) { HITS[p] = (HITS[p] || 0) + 1; res.writeHead(FAIL[p], { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end('<!doctype html><title>SERVER-ERROR-' + FAIL[p] + '</title><h1>server error ' + FAIL[p] + '</h1>'); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  await page.goto(BASE, { waitUntil: 'load' }); await sleep(800);                 // '/' 进页面缓存
  await page.goto(BASE + 'island_food.html', { waitUntil: 'load' }); await sleep(1500);   // 食物岛进页面缓存
  const look = async (url) => {
    const r = await page.goto(url, { waitUntil: 'load' }).catch(e => null);
    await sleep(400);
    return { status: r && r.status(), title: await page.title().catch(() => '') };
  };
  console.log('\n▶ 服务器出错');
  FAIL['/'] = 404;
  let r = await look(BASE);
  ok(!/SERVER-ERROR/.test(r.title) && /单词大冒险/.test(r.title), `'/' 回 404：显示缓存的首页（${r.status} ${r.title}）`);
  FAIL['/index.html'] = 502;
  r = await look(BASE + 'index.html');
  ok(!/SERVER-ERROR/.test(r.title) && /单词大冒险/.test(r.title), `index.html 回 502：显示缓存的首页（${r.status} ${r.title}）`);
  FAIL['/island_food.html'] = 502;
  r = await look(BASE + 'island_food.html');
  ok(!/SERVER-ERROR/.test(r.title) && /食物/.test(r.title), `食物岛回 502：显示缓存的食物岛（${r.status} ${r.title}）`);
  ok((HITS['/'] || 0) > 0 && (HITS['/index.html'] || 0) > 0 && (HITS['/island_food.html'] || 0) > 0, `服务器确实回了错误码（${JSON.stringify(HITS)}）`);
  console.log('\n▶ 服务器恢复');
  delete FAIL['/']; delete FAIL['/index.html']; delete FAIL['/island_food.html'];
  r = await look(BASE + 'island_food.html');
  ok(r.status === 200 && /食物/.test(r.title), `恢复后照常拿新页面（${r.status} ${r.title}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 服务器 404/502 时用手机里的缓存');
process.exit(fails ? 1 : 0);
