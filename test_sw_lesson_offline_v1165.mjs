/* test_sw_lesson_offline_v1165.mjs —— 离线时「答错小课」照样出现（模块在 SW 外壳预缓存里）
 *
 * 事故（v1165 优化批次自己记下的遗留 OD-L6 / OD-R4）：hansen_mistake_lesson_v1165.js 是新加的运行时文件，
 *   不在 sw_v944.js 的 SHELL 预缓存里。运行时资源缓存只留 72 个、会被挤掉 —— 挤掉后离线进岛，这个模块 504，
 *   答错时的小课卡就悄悄没了，退回旧的定时推进。
 *
 * 合同：
 *   静态：SHELL 里有岛页加载它用的精确地址（./hansen_mistake_lesson_v1165.js?v=<版本>），文件存在
 *   运行时：联网打开首页 + 食物岛（SW 接管）→ 把这个模块从运行时缓存里删掉（模拟被挤掉）→ 断网 → 再开食物岛 →
 *     听音辨义答错一题：小课卡出现；这个模块没有 504
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('\n▶ 静态：SHELL 预缓存');
const sw = fs.readFileSync(path.join(ROOT, 'sw_v944.js'), 'utf8');
const shellBlock = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
const want = `'./hansen_mistake_lesson_v1165.js?v=${VERSION}'`;
ok(shellBlock.includes(want), `SHELL 里有 ${want}`);
ok(fs.existsSync(path.join(ROOT, 'hansen_mistake_lesson_v1165.js')), '文件存在');
for (const t of ['template.html', 'land_template.html']) {
  const src = fs.readFileSync(path.join(ROOT, t), 'utf8');
  ok(src.includes(`src="hansen_mistake_lesson_v1165.js?v=${VERSION}"`), `${t} 用的正是这个地址`);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  console.log('\n▶ 运行时：断网再开食物岛，答错一题');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('__seeded', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const bad = [];
  page.on('response', r => { if (/hansen_mistake_lesson_v1165/.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(BASE, '')); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const controlled = await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).then(() => true).catch(() => false);
  ok(controlled, 'SW 接管了首页');
  await page.goto(BASE + 'island_food.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.HansenMistakeLesson && typeof startListen === 'function', null, { timeout: 30000 });
  await sleep(2500);   // 让运行时缓存写完
  const removed = await page.evaluate(async () => {
    let n = 0;
    for (const name of await caches.keys()) {
      if (/shell/.test(name)) continue;   // 只删运行时缓存（模拟被 72 条上限挤掉）
      const c = await caches.open(name);
      for (const req of await c.keys()) if (/hansen_mistake_lesson_v1165/.test(req.url)) { await c.delete(req); n++; }
    }
    return n;
  });
  console.log(`    从运行时缓存删掉 ${removed} 条`);
  await ctx.setOffline(true);
  await page.goto(BASE + 'island_food.html', { waitUntil: 'load' }).catch(() => {});
  await page.waitForFunction(() => typeof startListen === 'function', null, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  const hasModule = await page.evaluate(() => !!window.HansenMistakeLesson).catch(() => false);
  ok(hasModule, '断网再进岛：答错小课模块加载上了');
  await page.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
  await page.evaluate(() => { startListen(); const lv = document.querySelector('#listenContent [onclick^="startListenLevel"]'); if (lv) lv.click(); });
  await page.waitForFunction(() => typeof listenQ !== 'undefined' && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .boss-opt').length === 4, null, { timeout: 10000 });
  const wrongIdx = await page.evaluate(() => listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn));
  await page.evaluate(i => listenAnswer(i), wrongIdx);
  const card = await page.waitForSelector('#hml_lesson', { timeout: 6000 }).then(() => true).catch(() => false);
  ok(card, '答错一题：小课卡出现');
  ok(bad.length === 0, `这个模块没有出错响应（${bad.join(', ') || '无'}）`);
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 离线时答错小课照样出现');
process.exit(fails ? 1 : 0);
