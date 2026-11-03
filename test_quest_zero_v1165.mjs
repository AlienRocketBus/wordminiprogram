/* test_quest_zero_v1165.mjs —— 0 分 / 0 答对的一局不再让每日任务 +1
 *
 * 事故（v1163 审计 CB-07）：hansen_quest_global.js 的 progress() 用 (n || 1)，明明传了 0 也算 1 ——
 *   复习 0 个、打地鼠 0 分、翻牌一对没配上，任务照样 +1；三局全错就能完成「复习 3 个」。
 *
 * 合同（真岛页 island_food，用真实任务池里的任务）：
 *   progressQuest('review',0)、0 分打地鼠（progressQuest('moles',0)）→ 进度不动；
 *   progressQuest('correct')（不给数量）→ +1；progressQuest('review',2) → +2
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
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await page.goto(BASE + 'island_food.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof progressQuest === 'function' && typeof rollDailyQuests === 'function' && window.S, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const KEY = 'hansen_global_daily_quests_v941';
    const s = rollDailyQuests();
    // 今天的任务换成三条已知的（id 来自真实任务池，进度 0）
    const st = JSON.parse(localStorage.getItem(KEY));
    st.list = [{ id: 'review3', progress: 0, claimed: false }, { id: 'moles3', progress: 0, claimed: false }, { id: 'correct20', progress: 0, claimed: false }];
    st.allDay = '';
    localStorage.setItem(KEY, JSON.stringify(st));
    const prog = () => { const q = rollDailyQuests().list; const o = {}; q.forEach(x => { o[x.id] = x.progress; }); return o; };
    const start = prog();
    progressQuest('review', 0); const afterReview0 = prog();
    progressQuest('moles', 0); const afterMoles0 = prog();
    progressQuest('correct'); const afterCorrect = prog();
    progressQuest('review', 2); const afterReview2 = prog();
    return { start, afterReview0, afterMoles0, afterCorrect, afterReview2, day: s && s.day };
  });
  console.log('    ' + JSON.stringify(r));
  ok(r.start.review3 === 0 && r.start.moles3 === 0 && r.start.correct20 === 0, '起点都是 0');
  ok(r.afterReview0.review3 === 0, `复习 0 个：任务不动（${r.afterReview0.review3}）`);
  ok(r.afterMoles0.moles3 === 0, `打地鼠 0 分：任务不动（${r.afterMoles0.moles3}）`);
  ok(r.afterCorrect.correct20 === 1, `答对一题（不给数量）：+1（${r.afterCorrect.correct20}）`);
  ok(r.afterReview2.review3 === 2, `复习 2 个：+2（${r.afterReview2.review3}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 0 分的一局不再让每日任务 +1');
process.exit(fails ? 1 : 0);
