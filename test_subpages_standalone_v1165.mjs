/* test_subpages_standalone_v1165.mjs —— 单独打开的 Boss 殿堂 / 神秘殿堂 / 拼写蜂：标题正常、有回首页的路、不比手机宽
 *
 * 事故（v1163 审计 INT-14 / PH-07 / P2-10）：这几个页面平时在岛里的弹层（iframe）里打开；
 *   被单独打开时（分享出去的链接、浏览器历史）：标题写着「BOSS 殿堂 · 演示」「拼写对战 Spelling Bee · 原型」；
 *   Boss 殿堂和神秘殿堂没有回首页的路；背景光圈写死 420/430px 宽，360/375 宽的手机上页面能左右拖、右上角的 × 露一半。
 *
 * 合同：
 *   1. 360 / 375 宽单独打开 Boss 殿堂、神秘殿堂：页面不比屏幕宽；神秘殿堂的 × 完整露出来；左上有「‹ 回地图」，点了回到首页
 *   2. 在岛里的弹层（iframe）里打开：没有「‹ 回地图」（弹层自己有关闭）
 *   3. 三个页面的标题都不写「演示 / 原型」，拼写蜂叫「拼写蜂」
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
  if (p === '/__host.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0"><iframe id=f style="border:0;width:100vw;height:100vh"></iframe>'); }
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
const newPage = async (W) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  return { ctx, page };
};
try {
  for (const W of [360, 375]) {
    for (const file of ['boss_hall.html', 'season_showcase.html']) {
      console.log(`\n▶ 1. ${W} 宽单独打开 ${file}`);
      const { ctx, page } = await newPage(W);
      await page.goto(BASE + file, { waitUntil: 'load' });
      await sleep(1200);
      const r = await page.evaluate(() => {
        const x = document.getElementById('closePg'), b = document.getElementById('hsnBackHome');
        const xr = x && x.getBoundingClientRect(), br = b && b.getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, iw: innerWidth, vv: window.visualViewport ? Math.round(visualViewport.width) : innerWidth,
          x: xr ? { l: xr.left, r: xr.right } : null, back: br && br.width ? { t: b.textContent, l: br.left, r: br.right, h: br.height, x: br.left + br.width / 2, y: br.top + br.height / 2 } : null };
      });
      /* 内容比屏幕宽时手机浏览器会把整页缩小（布局宽度变成内容宽度），所以要看布局宽度是不是还等于手机宽 */
      ok(r.iw === W && r.sw <= W, `页面不比屏幕宽（手机 ${W}px，布局 ${r.iw}px，内容 ${r.sw}px）`);
      if (file === 'season_showcase.html') ok(r.x && r.x.l >= 0 && r.x.r <= W, `× 完整露出来（${r.x && Math.round(r.x.l)}~${r.x && Math.round(r.x.r)}）`);
      ok(r.back && /回地图/.test(r.back.t) && r.back.l >= 0 && r.back.r <= W && r.back.h >= 40, `左上有「‹ 回地图」（${r.back && r.back.t}）`);
      if (r.back) {
        await page.touchscreen.tap(r.back.x, r.back.y);
        await page.waitForURL(/index\.html/, { timeout: 8000 }).catch(() => {});
        ok(/index\.html/.test(page.url()), `点了回到首页（${page.url().replace(BASE, '')}）`);
      }
      await ctx.close();
    }
  }

  console.log('\n▶ 2. 在弹层（iframe）里打开');
  for (const file of ['boss_hall.html', 'season_showcase.html']) {
    const { ctx, page } = await newPage(375);
    await page.goto(BASE + '__host.html', { waitUntil: 'load' });
    await page.evaluate(f => { document.getElementById('f').src = f; }, file);
    await page.waitForFunction(() => { try { return document.getElementById('f').contentDocument.readyState === 'complete' && /\.html$/.test(document.getElementById('f').contentWindow.location.pathname); } catch (e) { return false; } }, null, { timeout: 20000 });
    await sleep(1000);
    const has = await page.evaluate(() => !!document.getElementById('f').contentDocument.getElementById('hsnBackHome'));
    ok(!has, `${file} 在弹层里：没有「‹ 回地图」`);
    await ctx.close();
  }

  console.log('\n▶ 3. 标题');
  const titles = {};
  for (const file of ['boss_hall.html', 'season_showcase.html', 'spelling_bee.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    titles[file] = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  }
  ok(Object.values(titles).every(t => t && !/演示|原型/.test(t)), `标题不写「演示 / 原型」（${Object.values(titles).join(' | ')}）`);
  ok(/拼写蜂/.test(titles['spelling_bee.html']), `拼写蜂的标题叫拼写蜂（${titles['spelling_bee.html']}）`);
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 单独打开的子页面：标题正常、有回首页的路、不比手机宽');
process.exit(fails ? 1 : 0);
