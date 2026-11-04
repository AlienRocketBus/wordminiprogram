/* test_review_context_v1165.mjs —— 结算页「练这 N 个词」只管这一次：之后底栏「复习」打开的是正常的复习中心
 *
 * 复查（v1165 第 2 轮 R2-RV1）：结算页「练这 2 个词」→ 复习中心「🎯 练这 2 个词」→「看汉意拼单词」→ ✕ 回来 → ← 关掉；
 *   过一会儿点底栏「复习」，打开的还是「🎯 练这 2 个词」、只有那 2 个词，「今日复习」卡也不见了（明明今天有 2 个词到期）。
 *   原因：拼写页回来时打了「保留复习范围」的标记，← 关复习中心时这个标记还在 → 范围没清。
 *
 * 合同（动物岛听音辨义初级，前两题故意答错、其余答对，真点）：
 *   ① 结算页「练这 2 个词」→ 复习中心标题是「练这 2 个词」、没有今日复习卡（这一次本来就该这样）
 *   ② 看汉意拼单词 → ✕：回到同一个复习中心（还是「练这 2 个词」）
 *   ③ ← 关掉，回主页，点底栏「复习」：标题不是「练这 N 个词」，有「今日复习」卡（今天到期 2 个）
 *   ④ 一起复习全部 / 别的打开方式也一样：用过一次就清掉（再从结算页「练这 N 个词」进，← 关掉，底栏「复习」还是正常的）
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startListen === 'function' && window.HansenReview && window.HansenMistakeLesson, null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await sleep(400);
  const center = () => page.evaluate(() => ({ on: !!document.getElementById('hr_center'), title: ((document.querySelector('#hr_center .hr_title') || {}).textContent || '').trim(), today: !!document.querySelector('#hr_center [onclick*="_openToday"]'), ctx: window._huReviewContext ? window._huReviewContext.title : null }));
  async function playRound(nWrong) {
    const lc = page.locator('#homeScreen .mode-card[onclick="startListen()"]').first();
    await lc.scrollIntoViewIfNeeded(); await lc.tap(); await sleep(400);
    await page.locator('#listenContent [onclick^="startListenLevel"]').first().tap();
    let n = 0;
    for (let k = 0; k < 400; k++) {
      const st = await page.evaluate(() => ({ les: !!document.getElementById('hml_lesson'), q: listenActive && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4, done: !listenActive && !!document.querySelector('#listenContent .hml-r-go') }));
      if (st.done) break;
      if (st.les) { await page.locator('#hml_lesson').tap({ position: { x: 20, y: 140 } }).catch(() => {}); await sleep(400); continue; }
      if (!st.q) { await sleep(150); continue; }
      const retry = await page.evaluate(() => HansenMistakeLesson.isRetry('listen', listenQ.idx));
      const right = retry || n >= nWrong;
      const i = await page.evaluate(r => listenQ.opts.findIndex(o => r ? o.cn === listenQ.word.cn : o.cn !== listenQ.word.cn), right);
      await page.locator('#listenScreen .listen-opts .boss-opt').nth(i).tap(); n++;
      await sleep(right ? 350 : 650);
    }
    await sleep(800);
  }

  await playRound(2);
  const go = page.locator('#listenContent .hml-r-go');
  ok(await go.count() > 0, `结算页有「${await go.count() ? (await go.textContent()).trim() : '练这 N 个词'}」`);
  await go.tap(); await sleep(900);
  const c1 = await center();
  ok(c1.on && /练这 2 个词/.test(c1.title) && !c1.today, `① 复习中心「${c1.title}」，没有今日复习卡（这一次该这样）`);
  await page.locator('#hr_center .hr_card[onclick*="_openSpellByCn"]').first().tap();
  await page.waitForFunction(() => document.getElementById('hspCloseBtn'), null, { timeout: 8000 });
  await sleep(500);
  await page.locator('#hspCloseBtn').tap(); await sleep(900);
  const c2 = await center();
  ok(c2.on && /练这 2 个词/.test(c2.title), `② 拼写页 ✕ 回到同一个复习中心（「${c2.title}」）`);
  await page.locator('#hr_center [onclick*="HansenReview._close()"]').first().tap(); await sleep(700);
  await page.evaluate(() => showScreen('home')); await sleep(500);
  const due = await page.evaluate(() => HansenReview._dueCount());
  await page.locator('#navReview').tap(); await sleep(900);
  const c3 = await center();
  ok(c3.on && !/练这/.test(c3.title) && c3.today && !c3.ctx, `③ 底栏「复习」打开正常的复习中心（标题「${c3.title}」、今日复习卡 ${c3.today}、范围 ${c3.ctx}；今天到期 ${due} 个）`);
  ok(due === 2, `③ 今天到期 2 个（${due}）`);
  await page.locator('#hr_center [onclick*="HansenReview._close()"]').first().tap(); await sleep(600);

  /* ④ 再来一次：这回不进子界面，「练这 N 个词」→ 直接 ← 关掉 → 底栏「复习」 */
  await page.evaluate(() => showScreen('home')); await sleep(400);
  await playRound(1);
  await page.locator('#listenContent .hml-r-go').tap(); await sleep(900);
  const c4a = await center();
  await page.locator('#hr_center [onclick*="HansenReview._close()"]').first().tap(); await sleep(600);
  await page.evaluate(() => showScreen('home')); await sleep(400);
  await page.locator('#navReview').tap(); await sleep(900);
  const c4 = await center();
  ok(/练这 1 个词/.test(c4a.title) && c4.on && !/练这/.test(c4.title) && c4.today, `④ 「${c4a.title}」← 关掉以后，底栏「复习」照样是正常的（「${c4.title}」、今日复习卡 ${c4.today}）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165「练这 N 个词」只管这一次');
