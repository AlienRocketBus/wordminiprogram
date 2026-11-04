/* test_nav_active_v1165.mjs —— 点「探索单词」时底栏不再亮「错题」
 *
 * v1163：showScreen 的底栏高亮表里还写着 explore → navExplore，可那一格早被错题总览改成了「📕 错题」。
 *        孩子点首页的「探索单词」，底栏亮的却是「错题」。
 * 合同（island_animal、island_land2，真点）：进探索单词后底栏没有任何一格亮着；回主页亮「主页」；进复习亮「复习」照旧。
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
async function newCtx(vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  return ctx;
}
async function open(ctx, file, ready = "typeof showScreen === 'function'") {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(new Function("return document.readyState !== 'loading' && " + ready), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}

try {
  for (const file of ['island_animal.html', 'island_land2.html']) {
    console.log('\n▶ ' + file);
    const ctx = await newCtx();
    const { page, errs } = await open(ctx, file, "typeof renderExplore === 'function'");
    await page.waitForTimeout(800);
    const navs = () => page.evaluate(() => ({ active: [...document.querySelectorAll('.bottom-nav .nav-item.active')].map(n => n.id), exploreLabel: ((document.getElementById('navExplore') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12) }));
    await page.evaluate(() => showScreen('home'));
    await page.locator('#homeScreen .mode-card[onclick="showScreen(\'explore\')"]').first().tap();
    await page.waitForTimeout(300);
    const a = await navs();
    ok(await page.evaluate(() => document.getElementById('exploreScreen').classList.contains('active')) && !a.active.includes('navExplore'), `点「探索单词」后底栏没有亮「${a.exploreLabel}」格 ` + JSON.stringify(a.active));
    await page.evaluate(() => showScreen('home'));
    const b = await navs();
    ok(b.active.join() === 'navHome', '回主页：亮「主页」 ' + JSON.stringify(b.active));
    await page.evaluate(() => showScreen('review'));
    const c = await navs();
    ok(c.active.join() === 'navReview', '进复习：亮「复习」 ' + JSON.stringify(c.active));
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 底栏高亮：探索单词不再亮「错题」');
