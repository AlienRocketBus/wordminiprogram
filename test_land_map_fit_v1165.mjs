/* test_land_map_fit_v1165.mjs —— 窄屏手机上单词大陆地图的 8 个岛（连名字）都在屏幕里
 *
 * 事故（v1163 审计 PH-06 / P2-09）：地图按高度铺满（844 高时舞台约 475px 宽），比 320/360/375 宽的手机宽，
 *   左右各切掉一截；④ 铸剑锻炉山（82%）、⑧ 星火火山口（18%）两个岛连名字被切到屏幕外。
 *
 * 合同（首页外壳里打开大陆地图，和孩子平时一样在 iframe 里）：
 *   320/360/375 × 844：每个岛按钮、每个名字标签都完整在屏幕里
 *   390/414 × 844：本来就放得下，每个岛的位置和原来一模一样
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
  for (const W of [320, 360, 375, 390, 414]) {
    console.log(`\n▶ ${W} × 844`);
    const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
    await page.evaluate(() => openIsland('land_map.html'));
    await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /land_map\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete' && f.style.opacity === '1'; } catch (e) { return false; } }, null, { timeout: 30000 });
    await sleep(800);
    const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && /land_map\.html/.test(f.url()));
    const r = await fr.evaluate(() => {
      const vw = innerWidth, st = document.getElementById('stage').getBoundingClientRect();
      return [...document.querySelectorAll('#stage .spot')].map(s => {
        const b = s.getBoundingClientRect(), n = s.querySelector('.name').getBoundingClientRect();
        const m = /^(.)\s/.exec(s.getAttribute('aria-label') || '');
        const id = s.id === 'empress' ? 'E' : String('①②③④⑤⑥⑦⑧'.indexOf((s.querySelector('.num') || {}).textContent) + 1);
        const x0 = id === 'E' ? 50 : POS[id][0];
        return { id, name: s.querySelector('.name').textContent, vw, l: b.left, r: b.right, nl: n.left, nr: n.right, center: (b.left + b.right) / 2, want: st.left + x0 / 100 * st.width };
      });
    });
    const out = r.filter(x => x.l < 0 || x.r > x.vw || x.nl < 0 || x.nr > x.vw);
    if (W < 390) {
      ok(r.length === 9 && out.length === 0, `9 个按钮（8 岛 + 女帝）连名字都在屏幕里` + (out.length ? '：被切掉 ' + out.map(x => `${x.name}[${Math.round(x.nl)}~${Math.round(x.nr)}]`).join('、') : ''));
    } else {
      const moved = r.filter(x => Math.abs(x.center - x.want) > 0.5);
      ok(r.length === 9 && out.length === 0 && moved.length === 0, `本来就放得下：每个岛都在原位（挪动了 ${moved.map(x => x.name).join('、') || '0 个'}）`);
    }
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 窄屏手机上单词大陆 8 个岛都在屏幕里，宽屏原样不动');
process.exit(fails ? 1 : 0);
