/* test_scramble_retry_v1165.mjs —— 字母拼拼乐：拼错一次、看了答案再拼对，不算「纠正」、不算完美通关
 *
 * 复查（v1165 第 2 轮 R2-G1）：拼错后同一题马上回来，孩子照着刚看到的答案拼对 —— 以前被当成真的纠正：
 *   复习计划升盒（明天的复习被跳过）、+2 纠错金、「全部到期清零 +20」、连续复习 +1 天、「清空今日复习」完成，
 *   正确率还是 100%、算「完美通关」解锁成就；结算页同时写「正确率 100%」和「这次答错的词」。故意拼错一次天天能刷。
 *
 * 合同（新孩子，今天的任务里放着「清空今日复习」；家庭岛字母拼拼乐初级，第一个词故意拼错一次、再拼对，其余都拼对，真点字母）：
 *   ① 那个词：复习计划还在第 1 格（box 0、今天到期），错题本里还有它
 *   ② 没有「完成今日复习 +20」收据、连续复习天数没开始、「清空今日复习」还是 0
 *   ③ 不算完美通关（scrPerfectTotal 0，没有「首度完美」待领），结算正确率 < 100%，「这次答错的词」里有它
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
const QKEY = 'hansen_global_daily_quests_v941';
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(QKEY => {
    try {
      if (window.top === window && !sessionStorage.getItem('__s')) {
        localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1');
        const d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        const q = id => ({ id, progress: 0, claimed: false });
        localStorage.setItem(QKEY, JSON.stringify({ version: 942, day, list: [q('reviewClear'), q('learn3'), q('boss1')], allDay: '' }));
        sessionStorage.setItem('__s', '1');
      }
    } catch (e) {}
  }, QKEY);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_family.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startScramble === 'function' && window.HansenReview && window.HansenReviewRewardsV963 && window.HansenMistakeLesson, null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await sleep(400);
  const card = page.locator('#homeScreen .mode-card[onclick="startScramble()"]').first();
  await card.scrollIntoViewIfNeeded(); await card.tap();
  await sleep(500);
  await page.locator('#scrambleContent [onclick^="startScrambleLevel("]').first().tap();
  await sleep(600);
  let missWord = '', wrongDone = false;
  for (let k = 0; k < 500; k++) {
    const st = await page.evaluate(() => ({
      les: !!document.getElementById('hml_lesson'),
      ready: !!document.getElementById('scrLetters') && !document.querySelector('#scrLetters .scramble-letter.used') && !/正确|不对/.test((document.getElementById('scrMsg') || {}).textContent || ''),
      done: !scrActive && !document.getElementById('scrLetters'),
      w: scrWord ? scrWord.en.replace(/ /g, '') : ''
    }));
    if (st.done) break;
    if (st.les) { await page.locator('#hml_lesson').tap({ position: { x: 20, y: 140 } }).catch(() => {}); await sleep(450); continue; }
    if (!st.ready) { await sleep(150); continue; }
    let order = st.w.split('');
    if (!wrongDone) {   // 第一个词：故意拼错一次（字母倒过来；倒过来还一样就转一位）
      const letters = await page.evaluate(() => [...document.querySelectorAll('#scrLetters .scramble-letter')].map(e => e.textContent));
      let alt = letters.slice().reverse();
      if (alt.join('').toLowerCase() === st.w.toLowerCase()) alt.push(alt.shift());
      order = alt; wrongDone = true; missWord = st.w;
    }
    for (const ch of order) {
      const id = await page.evaluate(ch => { const el = [...document.querySelectorAll('#scrLetters .scramble-letter')].find(e => !e.classList.contains('used') && e.textContent === ch); return el ? el.id : null; }, ch);
      if (!id) break;
      await page.locator('#' + id).tap();
    }
    await sleep(500);
  }
  await sleep(900);
  const r = await page.evaluate(w => {
    const i = allW.findIndex(x => x.en.replace(/ /g, '') === w);
    const awards = Object.keys(JSON.parse(localStorage.getItem('hansen_coin_awards_v942') || '{}')).filter(k => /rvrw/.test(k));
    const q = (JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941') || '{"list":[]}').list || []).find(x => x.id === 'reviewClear');
    return {
      srs: S.srs && S.srs[i] ? S.srs[i] : null, wrong: (S.wrongs || {})[i] || 0,
      todaydone: awards.filter(k => /todaydone/.test(k)), streak: localStorage.getItem('hansen_review_streak_v963'),
      reviewClear: q ? q.progress : null, perfect: S.stats.scrPerfectTotal || 0,
      pending: window.HansenAch && HansenAch.isPending ? ['scrperfS1', 'perfScr3'].filter(id => HansenAch.isPending(id) || HansenAch.isClaimed(id)) : [],
      txt: ((document.getElementById('scrambleContent') || {}).innerText || '').replace(/\n+/g, ' | '),
      today: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()
    };
  }, missWord);
  console.log(`    故意拼错的词：${missWord}；复习计划 ${JSON.stringify(r.srs)}，错题本 ${r.wrong}`);
  console.log(`    结算：${r.txt.slice(0, 220)}`);
  ok(missWord && r.srs && (r.srs.box | 0) === 0 && r.srs.due <= r.today, `① 「${missWord}」复习计划还在第 1 格、今天到期（${JSON.stringify(r.srs)}）`);
  ok(r.wrong >= 1, `① 错题本里还有它（${r.wrong}）`);
  ok(r.todaydone.length === 0, `② 没有「完成今日复习 +20」收据（${r.todaydone.join(',') || '无'}）`);
  ok(!r.streak || (JSON.parse(r.streak).count | 0) === 0, `② 连续复习天数没开始（${r.streak}）`);
  ok(r.reviewClear === 0, `② 「清空今日复习」还是 0（${r.reviewClear}）`);
  ok(r.perfect === 0 && r.pending.length === 0, `③ 不算完美通关（scrPerfectTotal ${r.perfect}，完美成就 ${r.pending.join(',') || '无'}）`);
  const acc = (r.txt.match(/正确率\s*(\d+)%/) || [])[1];
  ok(acc !== undefined && +acc < 100, `③ 结算正确率 < 100%（${acc}%）`);
  ok(/这次答错的词/.test(r.txt) && r.txt.includes(missWord), '③ 「这次答错的词」里有它');
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 字母拼拼乐：看过答案再拼对不算纠正');
