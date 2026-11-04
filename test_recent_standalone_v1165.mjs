/* test_recent_standalone_v1165.mjs —— 「最近探险」：直接打开的岛（老师分享的链接）玩过了也算
 *
 * 复查（v1165 第 2 轮 R2-SH-07）：「最近探险」只认首页外壳写的 lastIslandKey（只有首页点岛 / 继续上次会写）。
 *   孩子从首页玩过食物岛，后来点老师分享的链接直接打开动物岛学了词 —— 回到首页，卡片还写「🍔 食物 · 点击继续」。
 *
 * 合同（真浏览器，新孩子）：
 *   ① 首页点进食物岛再回来：卡片是食物（原有行为不变）
 *   ② 直接打开动物岛，只是看一眼什么都不做：卡片还是食物（只打开不算玩）
 *   ③ 直接打开动物岛，真点一个单词「加入学习」：回首页卡片是动物、点它去 island_animal.html
 *   ④ 首页外壳里藏着的岛（回首页后收起来的那个）不会自己改「最近探险」
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
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seed')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); localStorage.setItem('__seed', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const card = () => page.evaluate(() => { const el = document.getElementById('recentLearnStat'); return { txt: el ? el.innerText.replace(/\s+/g, ' ').trim() : '', target: el ? el._target || '' : '', key: localStorage.getItem('lastIslandKey') }; });
  const home = async () => { await page.goto(BASE + 'index.html', { waitUntil: 'load' }); await page.waitForFunction(() => typeof window.openIsland === 'function' && typeof window.renderRecent === 'function', null, { timeout: 30000 }); await sleep(1500); };

  console.log('\n▶ ① 首页点进食物岛再回来');
  await home();
  await page.evaluate(() => openIsland('island_food.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_food\.html$/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => closeIsland()); await sleep(1200);
  const c1 = await card();
  ok(/食物/.test(c1.txt) && /island_food\.html/.test(c1.target), `① 卡片是食物（${c1.txt} → ${c1.target}）`);

  console.log('\n▶ ④ 外壳里藏着的食物岛不会自己改「最近探险」');
  await page.evaluate(() => { localStorage.setItem('lastIslandKey', 'wordIslandSports'); localStorage.setItem('lastIslandTime', String(Date.now() - 3600000)); });
  const hid = await page.evaluate(() => { try { const w = document.getElementById('islandFrame').contentWindow; w.markAnswer(0, true); w.markMode('listen'); return localStorage.getItem('lastIslandKey'); } catch (e) { return 'err ' + e.message; } });
  ok(hid === 'wordIslandSports', `④ 藏着的岛里调 markAnswer / markMode：lastIslandKey 没被改（${hid}）`);
  await page.evaluate(() => { localStorage.setItem('lastIslandKey', 'wordIslandFood'); localStorage.setItem('lastIslandTime', String(Date.now())); });

  console.log('\n▶ ② 直接打开动物岛，只看一眼');
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.learnWord === 'function' && window.S, null, { timeout: 30000 });
  await sleep(2500);
  await home();
  const c2 = await card();
  ok(/食物/.test(c2.txt) && c2.key === 'wordIslandFood', `② 只打开不算玩：卡片还是食物（${c2.txt}，${c2.key}）`);

  console.log('\n▶ ③ 直接打开动物岛，点一个单词「加入学习」');
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.learnWord === 'function' && window.S, null, { timeout: 30000 });
  await sleep(2000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function () {}; showScreen('explore'); });
  await sleep(600);
  await page.locator('#exploreContent .exp-card').first().tap();
  await sleep(500);
  await page.locator('#modalInner .m-btn.got-it').tap();
  await sleep(1500);
  const learned = await page.evaluate(() => (S.learned || []).length);
  ok(learned >= 1, `③ 真学会了一个词（已学 ${learned}）`);
  await home();
  const c3 = await card();
  ok(/动物/.test(c3.txt) && /island_animal\.html/.test(c3.target), `③ 回首页卡片是动物、点它去动物岛（${c3.txt} → ${c3.target}）`);
  ok(errs.length === 0, '页面无报错 ' + errs.slice(0, 3).join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 直接打开的岛玩过了也算「最近探险」');
