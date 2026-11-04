/* test_review_quest_v1165.mjs —— 每日必有的「复习单词」任务能从复习中心真的做完
 *
 * 复查（v1165 第 1 轮 G1）：每天 12 个任务里必有一条复习任务（巩固 3 个 / 巩固 6 个 / 清空今日复习）。
 *   进度只在模板自带的旧复习屏里上报，可底栏「复习」、首页复习卡、错题总览、结算页「练这 N 个词」全都打开复习中心 ——
 *   复习中心里的今日复习、拼写练习都不报任务 → 这条任务永远是 0，「12 个任务全部完成」的每日大奖每天都拿不到
 *   （单词大陆岛也一样）。
 *
 * 合同（新孩子；今天的任务里放着「巩固 6 个」和「清空今日复习」；全程真点）：
 *   ① 听音辨义答错 3 个词 → 点底栏「复习」→ 打开的是复习中心
 *   ② 今日复习：3 张卡都「看答案 → ✅ 记住了」→「今日复习完成」；「巩固 6 个」变成 3/6，「清空今日复习」完成 1/1
 *   ③ 回复习中心点「看汉意拼单词」，不用提示自己拼对 1 个 →「巩固 6 个」变成 4/6
 *   island_animal（常规岛）做 ①②③，island_land1（单词大陆）做 ①②
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const QKEY = 'hansen_global_daily_quests_v941';

async function run(file, spell) {
  console.log(`\n▶ ${file}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(QKEY => {
    try {
      if (!sessionStorage.getItem('__s')) {
        localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1');
        const d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        const q = id => ({ id, progress: 0, claimed: false });
        localStorage.setItem(QKEY, JSON.stringify({ version: 942, day, list: [q('review6'), q('reviewClear'), q('learn3'), q('boss1')], allDay: '' }));
        sessionStorage.setItem('__s', '1');
      }
    } catch (e) {}
  }, QKEY);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startListen === 'function' && !!window.HansenReview && !!window.HansenQuestGlobal, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await page.waitForTimeout(400);
  const quests = () => page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k) || '{"list":[]}'); const o = {}; (s.list || []).forEach(q => { o[q.id] = q.progress; }); return o; }, QKEY);
  const q0 = await quests();
  ok(q0.review6 === 0 && q0.reviewClear === 0, `今天的任务里有「巩固 6 个」和「清空今日复习」，都是 0（${JSON.stringify(q0)}）`);

  // ① 听音辨义答错 3 个词
  const lc = page.locator('#homeScreen .mode-card[onclick="startListen()"]').first();
  await lc.scrollIntoViewIfNeeded(); await lc.tap();
  await sleep(400);
  await page.locator('#listenContent [onclick^="startListenLevel"]').first().tap();
  for (let n = 0; n < 3; n++) {
    await page.waitForFunction(() => listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4 && !document.getElementById('hml_lesson'), null, { timeout: 20000 });
    await sleep(300);
    const i = await page.evaluate(() => listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn));
    await page.locator('#listenScreen .listen-opts .boss-opt').nth(i).tap();
    await page.waitForFunction(() => document.getElementById('hml_lesson'), null, { timeout: 8000 }).catch(() => {});
    await sleep(400);
    await page.locator('#hml_lesson').tap().catch(() => {});
    await sleep(600);
  }
  await page.evaluate(() => showScreen('home'));
  await sleep(500);
  const due = await page.evaluate(() => HansenReview._dueCount ? HansenReview._dueCount() : -1);
  await page.locator('#navReview').tap();
  await sleep(900);
  const center = await page.evaluate(() => !!document.getElementById('hr_center'));
  ok(center && due >= 3, `① 答错 3 个词后点底栏「复习」，打开复习中心（今天到期 ${due} 个）`);

  // ② 今日复习：看答案 → 记住了
  await page.locator('#hr_center .hr_card[onclick*="_openToday"]').first().tap();
  await sleep(700);
  let shown = 0;
  for (let k = 0; k < 40; k++) {
    const st = await page.evaluate(() => ({ show: !!document.getElementById('ht_b_show'), got: !!document.getElementById('ht_b_got'), done: !!document.getElementById('hr_today_back2') }));
    if (st.done) break;
    if (st.show) { await page.locator('#ht_b_show').tap(); await sleep(350); continue; }
    if (st.got) { await page.locator('#ht_b_got').tap(); shown++; await sleep(350); continue; }
    await sleep(250);
  }
  const fin = await page.evaluate(() => (document.getElementById('hr_today') || {}).innerText || '');
  const q1 = await quests();
  ok(/今日复习完成/.test(fin) && shown >= 3, `② 今日复习做完了（点了 ${shown} 次「记住了」）`);
  ok(q1.review6 === Math.min(6, shown), `② 「巩固 6 个」：${q1.review6} / 6（应为 ${Math.min(6, shown)}）`);
  ok(q1.reviewClear === 1, `② 「清空今日复习」：${q1.reviewClear} / 1`);

  // ③ 看汉意拼单词：自己拼对 1 个
  if (spell) {
    await page.locator('#hr_today_back2').tap().catch(() => {});
    await sleep(700);
    await page.locator('#hr_center .hr_card[onclick*="_openSpellByCn"]').first().tap();
    await page.waitForFunction(() => document.querySelector('#hsp_mask .typing-cn') && document.getElementById('hspKbd'), null, { timeout: 8000 });
    await sleep(400);
    const en = await page.evaluate(() => { const cn = document.querySelector('#hsp_mask .typing-cn').textContent; const w = allW.find(x => x.cn === cn); return w ? w.en : ''; });
    for (const ch of en.toLowerCase()) { if (ch === ' ') continue; await page.locator(`#hspKbd .key[data-k="${ch}"]`).tap(); await sleep(60); }
    await sleep(600);
    const hint = await page.evaluate(() => (document.getElementById('hspHint') || {}).textContent || '');
    const q2 = await quests();
    ok(/独立正确/.test(hint), `③ 看汉意拼单词：自己拼对「${en}」（${hint}）`);
    ok(q2.review6 === Math.min(6, shown + 1), `③ 「巩固 6 个」：${q2.review6} / 6（应为 ${Math.min(6, shown + 1)}）`);
  }
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
}

try {
  await run('island_animal.html', true);
  await run('island_land1.html', false);
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 复习任务能从复习中心真的做完');
