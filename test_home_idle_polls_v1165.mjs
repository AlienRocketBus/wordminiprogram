/* test_home_idle_polls_v1165.mjs —— 孩子在岛里玩时，藏在后面的首页不再每 2 秒 / 1.5 秒轮询
 *
 * 事故（v1163 审计 SS-6）：首页外壳一直开着 setInterval(renderRecent, 2000) 和 setInterval(applyTheme, 1500)，
 *   岛里每存一次档（storage 事件）还要再跑一遍 —— 岛开着时首页根本看不见，这些全是白跑；同源 iframe 和首页共用一个主线程，
 *   岛里就会周期性地卡一下。（旧注释说「iframe 里改 localStorage 首页收不到 storage 事件」，其实收得到。）
 *
 * 合同（不用 SW）：
 *   1. 进动物岛待 20 秒，岛里每 2 秒存一次档：首页的「最近探险」卡片和主题一次都不重算
 *      （用首页自己读 lastIslandKey / theme 的次数来数）
 *   2. 岛里换了主题（theme=ocean），点 🗺️ 回首页：1 秒内首页就是新主题，「最近探险」写的是动物岛
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
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('theme', 'forest'); localStorage.setItem('__seeded', '1'); } } catch (e) {}
    if (window.top !== window) return;
    /* 只数首页自己的读取（每个窗口有自己的 Storage.prototype，岛里的读不算进来） */
    window.__gets = {};
    const g = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { if (this === window.localStorage) window.__gets[k] = (window.__gets[k] || 0) + 1; return g.apply(this, arguments); };
  });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1500);

  console.log('\n▶ 1. 进动物岛待 20 秒，岛里每 2 秒存一次档');
  await page.evaluate(() => openIsland('island_animal.html'));
  await page.waitForFunction(() => { const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame'); try { return w.style.display === 'block' && f.style.opacity === '1' && /island_animal\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  await sleep(1000);
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && /island_animal\.html/.test(f.url()));
  const g0 = await page.evaluate(() => ({ ...window.__gets }));
  await fr.evaluate(() => { let n = 0; window.__saver = setInterval(() => { try { localStorage.setItem('wordIslandAnimal_testprobe', String(++n)); const k = 'wordIslandAnimal'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.lastSaveTime = Date.now(); localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }, 2000); });
  await sleep(20000);
  const g1 = await page.evaluate(() => ({ ...window.__gets }));
  const d = k => (g1[k] || 0) - (g0[k] || 0);
  ok(d('lastIslandKey') === 0, `20 秒里首页没重算「最近探险」（读 lastIslandKey ${d('lastIslandKey')} 次）`);
  ok(d('theme') === 0 && d('hansen_diamond_shop') === 0, `20 秒里首页没重算主题（读 theme ${d('theme')} 次、hansen_diamond_shop ${d('hansen_diamond_shop')} 次）`);

  console.log('\n▶ 2. 岛里换主题，回首页');
  await fr.evaluate(() => { clearInterval(window.__saver); localStorage.removeItem('wordIslandAnimal_testprobe'); localStorage.setItem('theme', 'ocean'); });
  await sleep(500);
  await fr.evaluate(() => goHome()).catch(() => {});
  await sleep(1000);
  const home = await page.evaluate(() => ({ wrap: document.getElementById('islandFrameWrap').style.display, theme: document.body.dataset.theme, recent: (document.getElementById('recentNum') || {}).textContent || '' }));
  ok(home.wrap === 'none', '回到了首页');
  ok(home.theme === 'ocean', `首页 1 秒内换成岛里选的主题（${home.theme}）`);
  ok(/动物/.test(home.recent), `「最近探险」写的是动物岛（${home.recent}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 岛开着时首页不轮询，回首页时卡片和主题马上对');
process.exit(fails ? 1 : 0);
