/* test_island_prefetch_hit_v1165.mjs —— 首页预取的岛页真的用得上；「最近玩过的岛」对得上文件名；外壳忙着进岛时不预取
 *
 * 事故（v1163 审计 INT-05 / NET-06 / PH-04 / PH-05 / CB-11 …）：
 *   · 预取（手指一碰岛卡、空闲时）下的是 island_x.html?v=1164，进岛时岛框打开的却是 island_x.html ——
 *     两个地址，预取的那份永远用不上，每次进岛都白多下一份岛页；
 *   · 「最近玩过的岛」按存档名拼文件名：wordIslandColorNum → island_colornum.html …… 8 个岛全是 404；
 *   · 外壳正忙着加载岛（__hsnIslandBusyUntil）时，空闲预取照样在后台抢网。
 *
 * 合同（不用 SW；玩过 8 个岛的孩子，lastIslandKey=wordIslandColorNum）：
 *   1. 外壳忙的那 7 秒里一个都不空闲预取；忙完后预取「最近玩过的岛」：第一个是颜色数字岛，全是这 8 个岛里的，最多 6 个（流量上限），零 404
 *   2. 点已经预取好的颜色数字岛：岛页 HTML 不再从网上下第二次（服务器带 ETag，没变只回 304、不传正文）
 *   3. 手指点美食岛（按下时预取、抬手进岛）：岛页 HTML 只下一次
 *   4. （复查第 2 轮 R2-SH-03）单词大陆地图空闲时预热「下一个没通关的岛」（①）；点进 ①：岛页 HTML 一共只下一次
 *      （以前地图预热的是不带 ?v= 的地址，外壳打开的是带 ?v= 的，进岛又整页下一遍，约 200KB）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
/* 像真的 CDN 一样带 ETag、认 If-None-Match（没变就回 304、不传正文）；HITS 只数真正传了整页正文的（200） */
const HITS = {}, MISSING = [];
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { if (/\.html$/.test(p)) MISSING.push(p); res.writeHead(404); return res.end(); }
    const st = fs.statSync(fp), etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const head = { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'etag': etag, 'last-modified': st.mtime.toUTCString() };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    HITS[p] = (HITS[p] || 0) + 1;
    res.writeHead(200, head); res.end(d);
  });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PLAYED = ['ColorNum', 'Verbs', 'House', 'People', 'Pronouns', 'Transport', 'Misc', 'Adj'];
const WANT = ['island_color.html', 'island_action.html', 'island_home.html', 'island_job.html', 'island_question.html', 'island_traffic.html', 'island_treasure.html', 'island_adjective.html'];
/* 像真手机一样用磁盘缓存（带用户目录的浏览器）：Playwright 的无痕上下文只有一小块内存缓存，600KB 的岛页放进去很快就被挤掉。
   也不用 ctx.route 拦外网：一拦截请求 Playwright 就关掉浏览器的 HTTP 缓存，预取就测不出来了。改用域名解析把外网全挡掉。 */
const UD = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn_pf_'));
let ctx = null;
try {
  ctx = await chromium.launchPersistentContext(UD, { executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([played]) => {
    try {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('hansen_onboarded', '1');
        played.forEach((k, i) => {
          localStorage.setItem('wordIsland' + k, JSON.stringify({ learned: ['a', 'b', 'c'], totalAnswers: 12, lastSaveTime: Date.now() - i * 60000 }));
          localStorage.setItem('wordIsland' + k + '_bak', JSON.stringify({ learned: ['a'] }));
        });
        localStorage.setItem('lastIslandKey', 'wordIslandColorNum'); localStorage.setItem('lastIslandTime', String(Date.now()));
        localStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
    if (window.top !== window) return;
    /* 外壳忙 7 秒（像刚点进一个岛那样）；记下每个预取标签插进来的时间 */
    window.__hsnIslandBusyUntil = Date.now() + 7000;
    window.__pf = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.tagName === 'LINK' && n.rel === 'prefetch') window.__pf.push({ href: n.getAttribute('href'), why: n.getAttribute('data-why') || '', busy: Date.now() < (window.__hsnIslandBusyUntil || 0) }); })
      .observe(document, { childList: true, subtree: true });   // 这时还没有 <html>，盯整个文档
  }, [PLAYED]);
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });

  console.log('\n▶ 1. 外壳忙的时候不预取，忙完预取最近玩过的岛');
  await sleep(15000);
  const pf = await page.evaluate(() => window.__pf);
  const idle = pf.filter(x => x.why === 'recent' || x.why === 'idle');
  ok(idle.length > 0 && !idle.some(x => x.busy), `外壳忙的 7 秒里没有空闲预取（忙时预取 ${idle.filter(x => x.busy).length} 个，一共 ${idle.length} 个）`);
  const recent = pf.filter(x => x.why === 'recent').map(x => x.href.split('?')[0]);
  ok(recent[0] === 'island_color.html', `第一个预取的是上次玩的颜色数字岛（${recent[0]}）`);
  ok(recent.length > 0 && recent.length <= 6 && recent.every(f => WANT.includes(f)), `预取的都是玩过的岛、6 个封顶（${recent.join('、')}）`);
  ok(MISSING.length === 0, `零 404（${MISSING.join('、') || '无'}）`);
  const sameUrl = pf.every(x => new RegExp('\\?v=' + VERSION + '$').test(x.href));
  ok(sameUrl, '预取地址都带同一个版本号');

  console.log('\n▶ 2. 点已经预取好的颜色数字岛');
  const before = HITS['/island_color.html'] || 0;
  await page.evaluate(() => openIsland('island_color.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_color\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  ok(before >= 1 && (HITS['/island_color.html'] || 0) === before, `进岛时岛页不再从网上下第二次（进岛前下过 ${before} 次，进岛后一共 ${HITS['/island_color.html'] || 0} 次）`);
  const fu = await page.evaluate(() => document.getElementById('islandFrame').contentWindow.location.href);
  ok(new RegExp('island_color\\.html\\?v=' + VERSION).test(fu), `岛框打开的就是预取的那个地址（${fu.replace(BASE, '')}）`);
  await page.evaluate(() => closeIsland());
  await sleep(1500);

  console.log('\n▶ 3. 手指点美食岛：按下时预取、抬手进岛');
  const f0 = HITS['/island_food.html'] || 0;
  const pt = await page.evaluate(() => { const a = document.querySelector('a.island[href="island_food.html"]'); a.scrollIntoView({ block: 'center' }); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_food\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  ok((HITS['/island_food.html'] || 0) - f0 === 1, `美食岛岛页只下了一次（${(HITS['/island_food.html'] || 0) - f0} 次）`);
  await page.evaluate(() => closeIsland());
  await sleep(1200);

  console.log('\n▶ 4. 单词大陆地图预热的 ①，点进去用得上');
  const l0 = HITS['/island_land1.html'] || 0;
  await page.evaluate(() => openIsland('land_map.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /land_map\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});
  await sleep(6000);   // 地图空闲时（requestIdleCallback，最迟 2.2 秒）预热
  const l1 = HITS['/island_land1.html'] || 0;
  ok(l1 - l0 === 1, `地图预热了 ①（岛页下了 ${l1 - l0} 次）`);
  await page.evaluate(() => openIsland('island_land1.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_land1\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  const l2 = HITS['/island_land1.html'] || 0;
  ok(l2 - l0 === 1, `点进 ①：岛页一共只下了一次（${l2 - l0} 次；预热的就是进岛的那个地址）`);
} finally {
  if (ctx) await ctx.close().catch(() => {});
  srv.close();
  try { fs.rmSync(UD, { recursive: true, force: true }); } catch (e) {}
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 预取的岛页进岛时用得上、最近玩过的岛对得上、忙时不预取');
process.exit(fails ? 1 : 0);
