/* test_mylearning_land_v1165.mjs —— 「我的学习」把单词大陆的 8 个岛各记各的
 *
 * 事故（v1163 审计 MISSED#16）：hansen_mylearning.js 用 document.title.split('·')[0] 当岛名，单词大陆 8 个岛的标题都是
 *   「单词大陆·①迷雾心湖 · …」，全切成「单词大陆」—— 8 个岛记成同一行、「已点亮」也只算 1 座。
 *
 * 合同：依次打开 ①迷雾心湖、④铸剑锻炉山、动物岛（各学一个词）→「我的学习」有 3 行不同的岛、写「已点亮 3 / 27」；
 *   旧版留下的「单词大陆」合并行不显示。
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
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('__seeded', '1'); localStorage.setItem('hansen_onboarded', '1');
    // 旧版本留下的合并行
    localStorage.setItem('hsn_progress:单词大陆', JSON.stringify({ name: '单词大陆', totalWords: 30, learned: 9, ans: 20, cor: 15, boss: 0, level: 1, maxCombo: 0, ts: Date.now() - 86400000 })); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  for (const f of ['island_land1.html', 'island_land4.html', 'island_animal.html']) {
    await page.goto(BASE + f, { waitUntil: 'load' });
    await page.waitForFunction(() => window.S && window.HansenMyLearning && typeof save === 'function', null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { if (S.learned.indexOf(0) < 0) S.learned.push(0); save(); HansenMyLearning._open(); HansenMyLearning._close(); });
  }
  const r = await page.evaluate(() => { HansenMyLearning._open(); const el = document.getElementById('hsn-ml');
    return { rows: [...el.querySelectorAll('.hsn-ml-isl .nm')].map(x => x.textContent), cnt: (el.querySelector('.hsn-ml-sec .cnt') || {}).textContent || '' }; });
  console.log('    ' + JSON.stringify(r));
  ok(r.rows.length === 3 && new Set(r.rows).size === 3, `3 行不同的岛（${r.rows.join(' / ')}）`);
  ok(r.rows.some(x => /迷雾心湖/.test(x)) && r.rows.some(x => /铸剑锻炉山/.test(x)), '单词大陆两个岛各有一行');
  ok(!r.rows.includes('单词大陆'), '旧版的「单词大陆」合并行不再显示');
  ok(/已点亮 3 \/ 27/.test(r.cnt), `「${r.cnt}」`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 「我的学习」单词大陆各岛各记各的');
process.exit(fails ? 1 : 0);
