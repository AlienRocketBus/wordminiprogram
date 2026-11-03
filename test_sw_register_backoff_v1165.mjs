/* test_sw_register_backoff_v1165.mjs —— SW 装不上时不再每个页面框都重试注册（一次进岛十几次、每次约 1MB）
 *
 * 事故（v1163 审计 NET-12）：hansen_sw_upgrade_gate_v944.js 在每个还没被 SW 接管的文档里都 register()（首页、岛框、
 *   预热框……），外壳里某个文件下载失败时 install 一直失败，每次都重下整份外壳。
 *
 * 合同：外壳某个文件 503 → 首页 + 外壳里进两个岛 + 刷新首页：一共最多注册 1 次，岛框里 0 次；
 *   正常情况下照样装上、接管页面。
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
let BREAK = false, shellHits = 0;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p === '/manifest.webmanifest') { shellHits++; if (BREAK) { res.writeHead(503); return res.end(); } }
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
async function ctxWithCounter() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {}
    try { const sw = navigator.serviceWorker, reg = sw.register.bind(sw); let top = true; try { top = window.top === window; } catch (e) { top = false; }
      sw.register = function () { try { const k = top ? '__reg_top' : '__reg_frame'; localStorage.setItem(k, String(Number(localStorage.getItem(k) || 0) + 1)); } catch (e) {} return reg.apply(this, arguments); }; } catch (e) {}
  });
  return ctx;
}
try {
  console.log('\n▶ 外壳有个文件 503（SW 装不上）');
  {
    BREAK = true;
    const ctx = await ctxWithCounter(); const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
    await sleep(4000);   // 让第一次安装失败
    for (const f of ['island_food.html', 'island_animal.html']) {
      await page.evaluate(f => openIsland(f), f);
      await page.waitForFunction(f => { const fr = document.getElementById('islandFrame'); try { return fr.contentWindow.location.pathname.endsWith(f) && fr.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, f, { timeout: 30000 });
      await sleep(2500);
      await page.evaluate(() => closeIsland()); await sleep(600);
    }
    await page.reload({ waitUntil: 'load' }); await sleep(3000);
    const r = await page.evaluate(() => ({ top: Number(localStorage.getItem('__reg_top') || 0), frame: Number(localStorage.getItem('__reg_frame') || 0), ctrl: !!navigator.serviceWorker.controller }));
    console.log('    ' + JSON.stringify(r) + `，外壳文件被下载 ${shellHits} 次`);
    ok(r.frame === 0, `岛框里一次都没注册（${r.frame}）`);
    ok(r.top + r.frame <= 1, `这个标签页一共只注册 ${r.top + r.frame} 次（最多 1 次）`);
    ok(!r.ctrl, '确实没装上（证明这一段测的是失败情况）');
    await ctx.close();
  }
  console.log('\n▶ 正常情况');
  {
    BREAK = false;
    const ctx = await ctxWithCounter(); const page = await ctx.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const ctrl = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
    ok(ctrl, '正常时照样装上、接管首页');
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ SW 装不上时不再反复注册');
process.exit(fails ? 1 : 0);
