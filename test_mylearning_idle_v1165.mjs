/* test_mylearning_idle_v1165.mjs —— 孩子什么都没做时，「我的学习」不再每 8 秒重写一次快照
 *
 * 复查（v1165 第 2 轮 R2-SH-02）：hansen_mylearning.js 每 8 秒写一次 hsn_progress:<岛>，只有 ts 变 ——
 *   每写一次就是一次「数据变了」（hsn-data-changed），云存档跟着每 16 秒左右整份导出一次备份：
 *   进度多的孩子什么都没点，岛也一阵一阵地卡（4 倍慢 CPU 300~800ms）。回首页后，藏起来的岛（visibilityState 还是 visible）照样写。
 *
 * 合同（有一点进度的孩子；数 hsn_progress:* 被写了几次、hsn-data-changed 发了几次）：
 *   ① 动物岛单独打开、放着不动 20 秒：0 次快照写入、0 次「数据变了」（开机那一下不算）
 *   ② 学会一个词：马上（≤ 8 秒）记下新快照（learned +1），只写一次
 *   ③ 首页外壳里进动物岛再点 🗺️ 回首页，放 20 秒：藏起来的岛 0 次快照写入
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const COUNT = () => {
  window.__ml = { w: 0, ch: 0 };
  try { const S0 = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { if (typeof k === 'string' && k.indexOf('hsn_progress:') === 0) window.__ml.w++; return S0.apply(this, arguments); }; } catch (e) {}
  try { document.addEventListener('hsn-data-changed', () => { window.__ml.ch++; }); } catch (e) {}   // hansen_change_notify 派发在 document 上
};
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seed')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); localStorage.setItem('__seed', '1'); } } catch (e) {} });
  await ctx.addInitScript(COUNT);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));

  console.log('\n▶ ① 动物岛单独打开、放着不动 20 秒');
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hsnMyLearning && window.S && typeof learnWord === 'function', null, { timeout: 30000 });
  await sleep(3000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function () {}; });
  await sleep(1000);
  const a0 = await page.evaluate(() => ({ ...window.__ml }));
  await sleep(20000);
  const a1 = await page.evaluate(() => ({ ...window.__ml }));
  ok(a1.w - a0.w === 0, `放着不动 20 秒：快照写了 ${a1.w - a0.w} 次（应为 0）`);
  ok(a1.ch - a0.ch === 0, `「数据变了」发了 ${a1.ch - a0.ch} 次（应为 0；以前每次都让云存档整份导出备份）`);

  console.log('\n▶ ② 学会一个词');
  await page.evaluate(() => { showScreen('explore'); });
  await sleep(500);
  await page.locator('#exploreContent .exp-card').first().tap(); await sleep(400);
  await page.locator('#modalInner .m-btn.got-it').tap();
  const t0 = Date.now(); let snap = null;
  while (Date.now() - t0 < 9000) { snap = await page.evaluate(() => { const k = Object.keys(localStorage).find(k => /^hsn_progress:动物/.test(k)); return k ? JSON.parse(localStorage.getItem(k)) : null; }); if (snap && snap.learned === 1) break; await sleep(300); }
  const a2 = await page.evaluate(() => ({ ...window.__ml }));
  ok(snap && snap.learned === 1, `${((Date.now() - t0) / 1000).toFixed(1)} 秒内记下了新快照（learned ${snap ? snap.learned : '-'}）`);
  await sleep(9000);
  const a3 = await page.evaluate(() => ({ ...window.__ml }));
  ok(a3.w - a1.w === 1, `学会一个词只写了一次快照（${a3.w - a1.w} 次）`);

  console.log('\n▶ ③ 首页外壳：进动物岛再回首页，放 20 秒');
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => openIsland('island_animal.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_animal\.html$/.test(f.contentWindow.location.pathname) && f.contentWindow.__hsnMyLearning && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  await sleep(3000);
  await page.evaluate(() => closeIsland());
  await sleep(1000);
  const F = page.frames().find(f => /island_animal\.html/.test(f.url()) && f.parentFrame() === page.mainFrame());
  const h0 = await F.evaluate(() => ({ ...window.__ml, vis: document.visibilityState }));
  await sleep(20000);
  const h1 = await F.evaluate(() => ({ ...window.__ml }));
  const shown = await page.evaluate(() => window.__hsnIslandShown());
  ok(!shown && h0.vis === 'visible', `岛藏起来了（岛框露着 ${shown}；它自己的 visibilityState 还是 ${h0.vis}）`);
  ok(h1.w - h0.w === 0, `藏起来的岛 20 秒里写了 ${h1.w - h0.w} 次快照（应为 0）`);
  ok(h1.ch - h0.ch === 0, `藏起来的岛 20 秒里「数据变了」发了 ${h1.ch - h0.ch} 次（应为 0）`);
  ok(errs.length === 0, '页面无报错 ' + errs.slice(0, 3).join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165「我的学习」只在真学到东西时才写快照');
