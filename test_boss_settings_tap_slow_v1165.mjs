/* test_boss_settings_tap_slow_v1165.mjs —— 网真的慢（约 1.5Mbps）时，设置页「Boss 特效调节」点一下也能打开
 *
 * 复查（v1165 第 2 轮 R2-04）：慢网 / 网络不明（iOS 微信）时设置页先画一个轻量行，孩子点了才下 1.23MB 的引擎。
 *   可点了以后只等 6 秒：约 1.5Mbps 时引擎要下约 7 秒 —— 6 秒一到轻量行就恢复成「通关全部 boss 解锁 0/360」、
 *   什么都没打开，引擎半秒后才到，孩子只能猜着再点一次。test_boss_settings_slow_v1165 只是假装 3G、按本机速度传，看不出来。
 *
 * 合同（不用 SW（让 CDP 限速真的生效）；真把网限到 1.5Mbps、延迟 150ms；navigator.connection 报 3G；动物岛设置页）：
 *   ① 打开设置页：先画轻量行，没有下引擎
 *   ② 点一下：一直显示「正在打开…」直到引擎到，然后弹出「尚未解锁」提示（不用再点第二下）
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
  if (/\.mp3$/.test(p)) { res.writeHead(404); return res.end(); }   // 不让单词录音挤占限速的带宽
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
const KBPS = 1500;
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    const c = { effectiveType: '3g', saveData: false, downlink: 1.2, rtt: 300, addEventListener() {}, removeEventListener() {} };
    try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch (e) {}
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const engine = []; page.on('request', r => { if (/hansen_boss_attack/.test(r.url())) engine.push(Date.now()); });
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__hansenBossFXReady === 'function' && document.readyState === 'complete' && window.S, null, { timeout: 60000 });
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  await sleep(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: KBPS * 1000 / 8, uploadThroughput: 750 * 1000 / 8 });

  console.log('\n▶ ① 打开设置页');
  const e0 = engine.length;
  await page.evaluate(() => showScreen('settings'));
  await page.waitForFunction(() => !!document.getElementById('hbafxEntry'), null, { timeout: 20000 }).catch(() => {});
  await sleep(800);
  const row = await page.evaluate(() => { const e = document.getElementById('hbafxEntry'); return e ? { stub: e.hasAttribute('data-hsn-stub'), txt: e.textContent.replace(/\s+/g, ' ').trim() } : null; });
  ok(row && row.stub && engine.length === e0, `先画轻量行（${row ? row.txt : '没有'}），没有下引擎（引擎请求 ${engine.length - e0} 个）`);

  console.log(`\n▶ ② 网速 ${KBPS / 1000}Mbps，点一下`);
  await page.evaluate(() => document.getElementById('hbafxEntry').scrollIntoView({ block: 'center' }));
  await sleep(200);
  const box = await page.evaluate(() => { const r = document.getElementById('hbafxEntry').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const t0 = Date.now();
  await page.touchscreen.tap(box.x, box.y);
  /* 先确认这一下真的点到了（轻量行变成「正在打开…」）；手机上偶尔一下没点上，孩子会再点 —— 只有这时才补点一次 */
  const hit = await page.waitForFunction(() => { const e = document.getElementById('hbafxEntry'); return !!e && /正在打开/.test(e.textContent); }, null, { timeout: 2000 }).then(() => true).catch(() => false);
  if (!hit) { console.log('    （第一下没点上，补点一次）'); await page.touchscreen.tap(box.x, box.y); }
  const timeline = []; let last = '', tipAt = null, revertedAt = null;
  for (let i = 0; i < 90; i++) {
    await sleep(400);
    const s = await page.evaluate(() => { const e = document.getElementById('hbafxEntry'); return { txt: e ? e.textContent.replace(/\s+/g, ' ').trim() : '', stub: !!(e && e.hasAttribute('data-hsn-stub')), tip: !!document.getElementById('hbafx-ovl'), gate: typeof window.__hsnOpenBossAdminGate === 'function' }; });
    const k = JSON.stringify(s);
    if (k !== last) { timeline.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + k); last = k; }
    if (s.stub && !/正在打开/.test(s.txt) && revertedAt === null && tipAt === null) revertedAt = (Date.now() - t0) / 1000;
    if (s.tip) { tipAt = (Date.now() - t0) / 1000; break; }
  }
  timeline.forEach(x => console.log('    ' + x));
  ok(revertedAt === null, `等引擎的时候一直写「正在打开…」，没有半路恢复成原来那一行（${revertedAt === null ? '没有' : revertedAt + ' 秒时恢复了'}）`);
  ok(tipAt !== null, `点一下就弹出「尚未解锁」提示（${tipAt === null ? '36 秒都没打开' : tipAt.toFixed(1) + ' 秒'}；引擎请求 ${engine.length - e0} 个）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 网慢时「Boss 特效调节」点一下也能打开');
