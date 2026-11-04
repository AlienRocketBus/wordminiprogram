/* test_sw_deploy_window_v1165.mjs —— 发版上传那几分钟里缓存进去的旧脚本，过后会自己换成新的
 *
 * 复查（v1165 第 2 轮 R2-SH-01）：发版上传时（CDN 新旧混着），新页面配着还没传上去的旧脚本。新 SW 这时把
 *   「?v=新版本号 + 旧内容」存进缓存，以后命中就不再联网 —— 这个孩子整个版本都在跑旧脚本，刷新也没用，
 *   只有自检「强制更新」或下一次发版才好（老师说过的「做出来的东西不显示」）。origin/main 下一次打开就好了（每次都后台重下）。
 *
 * 合同（真 SW；测试服务器先给两个带 ?v= 的脚本发「旧内容」（上传窗口），然后换成「新内容」）：
 *   · 一个是 SW 装的时候外壳一起下的（hansen_mistake_lesson_v1165.js?v=…，在外壳缓存里），
 *   · 一个是页面用到时才存的（hansen_version_watch_v1083.js?v=…，在代码缓存里）。
 *   ① 上传窗口里打开：两个都是旧内容（这是对的 —— 服务器当时就给的旧的）
 *   ② 上传完了，过了一阵（这里把缓存里记的时间往前拨：SW 两小时前装好、5 分钟后存的这份）：
 *      打开第 1 次照旧用缓存（不卡），后台问一次服务器；打开第 2 次两个都是新内容
 *   ③ 之后再打开：这两个脚本一个请求都不发（问过一次就定下来了，带版本号的脚本照旧不重下）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const PROBES = { '/hansen_mistake_lesson_v1165.js': 'lesson', '/hansen_version_watch_v1083.js': 'watch' };
let STALE = true;
const HITS = [];
const PAGE = `<!doctype html><meta charset="utf-8"><title>sw probe</title><body>
<script>window.__reg=(async()=>{try{await navigator.serviceWorker.register('sw_v944.js');await navigator.serviceWorker.ready;return navigator.serviceWorker.controller?'controlled':'registered';}catch(e){return 'err '+e.message;}})();</script>
<script src="hansen_mistake_lesson_v1165.js?v=${VERSION}"></script>
<script src="hansen_version_watch_v1083.js?v=${VERSION}"></script>
</body>`;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (PROBES[p]) {
    HITS.push(req.url);
    const tag = PROBES[p];
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
    return res.end(`window.__M_${tag}=${JSON.stringify(STALE ? 'old' : 'new')};`);
  }
  if (p === '/__r2_probe.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(PAGE); }
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UD = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn_swdw_'));
let ctx = null;
try {
  ctx = await chromium.launchPersistentContext(UD, { executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'], viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const marks = () => page.evaluate(() => ({ lesson: window.__M_lesson || null, watch: window.__M_watch || null, ctrl: !!navigator.serviceWorker.controller }));
  const launch = async () => { await page.goto(BASE + '__r2_probe.html', { waitUntil: 'load' }); await sleep(1500); return marks(); };

  console.log('\n▶ ① 上传窗口里打开（服务器给的是旧内容）');
  await page.goto(BASE + '__r2_probe.html', { waitUntil: 'load' });
  const reg = await page.evaluate(() => window.__reg);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(() => {});
  const m0 = await launch();   // 这一次由 SW 接管，页面用到的脚本存进缓存
  ok(m0.ctrl && m0.lesson === 'old' && m0.watch === 'old', `SW 接管（${reg}），两个都是旧内容（${JSON.stringify(m0)}）`);
  const caches0 = await page.evaluate(async () => { const out = {}; for (const n of await caches.keys()) { const c = await caches.open(n); for (const r of await c.keys()) if (/hansen_mistake_lesson|hansen_version_watch/.test(r.url)) out[r.url.replace(location.origin, '')] = n; } return out; });
  console.log('    缓存里：' + JSON.stringify(caches0));

  console.log('\n▶ ② 上传完了，过了一阵');
  STALE = false;
  /* 把缓存里记的时间往前拨：SW 两小时前装好，这份脚本是装好 5 分钟后存的（都在发版窗口里），现在已经过了 5 分钟 */
  await page.evaluate(async () => {
    const now = Date.now(), names = await caches.keys();
    const shell = names.find(n => /hansen-v944-shell-/.test(n)), assets = names.find(n => /hansen-v944-assets-/.test(n));
    await (await caches.open(shell)).put(new Request(location.origin + '/__hsn_sw_installed'), new Response(String(now - 2 * 3600e3), { headers: { 'content-type': 'text/plain' } }));
    const ac = await caches.open(assets);
    for (const key of await ac.keys()) {
      if (!/hansen_version_watch/.test(key.url)) continue;
      const r = await ac.match(key), body = await r.text(), h = new Headers(r.headers);
      h.set('x-hsn-at', String(now - 2 * 3600e3 + 5 * 60e3));
      await ac.put(key, new Response(body, { status: 200, headers: h }));
    }
  });
  const cdp = await ctx.newCDPSession(page);
  try { await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers'); } catch (e) { console.log('    （停 SW 失败：' + e.message + '）'); }
  await sleep(500);
  const h0 = HITS.length;
  const m1 = await launch();
  await sleep(1500);   // 后台问服务器那一下
  const asked = HITS.slice(h0);
  ok(m1.lesson === 'old' && m1.watch === 'old', `打开第 1 次照旧先用缓存（${JSON.stringify(m1)}）`);
  ok(asked.some(u => /mistake_lesson/.test(u)) && asked.some(u => /version_watch/.test(u)), `后台各问了一次服务器（${asked.join('、') || '一个都没问'}）`);
  const m2 = await launch();
  ok(m2.lesson === 'new' && m2.watch === 'new', `打开第 2 次两个都是新内容（${JSON.stringify(m2)}）`);

  console.log('\n▶ ③ 之后再打开');
  await sleep(1500);
  const h2 = HITS.length;
  const m3 = await launch();
  await sleep(1500);
  ok(m3.lesson === 'new' && m3.watch === 'new' && HITS.length === h2, `还是新内容（${JSON.stringify(m3)}），这两个脚本一个请求都没发（${HITS.slice(h2).join('、') || '0 个'}）`);
} finally {
  if (ctx) await ctx.close().catch(() => {});
  srv.close();
  try { fs.rmSync(UD, { recursive: true, force: true }); } catch (e) {}
}
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 发版窗口里存进去的旧脚本过后会自己换成新的');
