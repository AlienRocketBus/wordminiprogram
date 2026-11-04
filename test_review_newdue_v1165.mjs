/* test_review_newdue_v1165.mjs —— 今天刚答错的词当场进「今日复习」：复习完照样给「完成今日复习 +20」、连续复习 +1 天
 *
 * 复查（v1165 第 2 轮 R2-RW1 / R2-05 / R2-ACH1）：
 *   · R2-RW1：新孩子一开始什么都没到期，听音辨义答错 5 个 → 它们今天到期 → 复习中心「今日复习」5 个都「记住了」→
 *     「🎉 今日复习完成」，可复习奖励模块从没记下「今天有过到期」：不给 +20、连续复习天数不开始、「第一次回头」成就不亮
 *     （复习中心卡片上明写「完成今日复习 +20」）。只有开机 / 切回前台恰好在答错之后时才给 —— 看运气。
 *   · R2-05：今天本来就没有到期的词，打开「今日复习」只说「今天没有要复习的单词」，每日任务「清空今日复习」永远完不成。
 *   · R2-ACH1：成就「复习次数达到 20 次」「累计复习 100 个单词」数的是终身毕业词数 —— 刚复习完 5 个词还是 0。
 *
 * 合同（真点，新孩子，今天的任务里放着「清空今日复习」）：
 *   A ① 什么都没到期：打开「今日复习」→「今天没有要复习的单词」，「清空今日复习」1/1
 *   B ② 听音辨义答错 5 个 → 今日复习 5 个「记住了」→ 有「完成今日复习 +20」收据、连续复习 1 天、弹「全部到期清零」
 *     ③「第一次回头」成就解锁；「复习次数」「累计复习」的进度是 5（复习了 5 个词）
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

async function freshKid() {
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
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { try { const t = (n.textContent || '').trim(); if (/清零|连击已保住/.test(t) && t.length < 120) window.__toasts.push(t); } catch (e) {} }))).observe(document.body, { childList: true, subtree: true, characterData: true }); });
  }, QKEY);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startListen === 'function' && window.HansenReview && window.HansenReviewRewardsV963 && typeof getAchProgress === 'function', null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); }; showScreen('home'); });
  await sleep(400);
  return { ctx, page, errs };
}
const quest = (page, id) => page.evaluate(([k, id]) => { const q = (JSON.parse(localStorage.getItem(k) || '{"list":[]}').list || []).find(x => x.id === id); return q ? q.progress : null; }, [QKEY, id]);

try {
  console.log('\n▶ A. 今天什么都没到期');
  {
    const { ctx, page, errs } = await freshKid();
    const due = await page.evaluate(() => HansenReview._dueCount());
    await page.locator('#navReview').tap(); await sleep(900);
    await page.locator('#hr_center .hr_card[onclick*="_openToday"]').first().tap(); await sleep(800);
    const txt = await page.evaluate(() => (document.getElementById('hr_today') || {}).innerText || '');
    const q = await quest(page, 'reviewClear');
    ok(due === 0 && /今天没有要复习的单词/.test(txt), `① 打开今日复习：「今天没有要复习的单词」（到期 ${due} 个）`);
    ok(q === 1, `① 「清空今日复习」${q} / 1`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n▶ B. 答错 5 个 → 今日复习都「记住了」');
  {
    const { ctx, page, errs } = await freshKid();
    const due0 = await page.evaluate(() => HansenReview._dueCount());
    const lc = page.locator('#homeScreen .mode-card[onclick="startListen()"]').first();
    await lc.scrollIntoViewIfNeeded(); await lc.tap(); await sleep(400);
    await page.locator('#listenContent [onclick^="startListenLevel"]').first().tap();
    for (let n = 0; n < 5; n++) {
      await page.waitForFunction(() => listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4 && !document.getElementById('hml_lesson'), null, { timeout: 20000 });
      await sleep(250);
      const i = await page.evaluate(() => listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn));
      await page.locator('#listenScreen .listen-opts .boss-opt').nth(i).tap();
      await page.waitForFunction(() => document.getElementById('hml_lesson'), null, { timeout: 8000 }).catch(() => {});
      await sleep(300); await page.locator('#hml_lesson').tap({ position: { x: 20, y: 140 } }).catch(() => {}); await sleep(500);
    }
    await page.evaluate(() => showScreen('home')); await sleep(500);
    const due1 = await page.evaluate(() => HansenReview._dueCount());
    await page.locator('#navReview').tap(); await sleep(900);
    await page.locator('#hr_center .hr_card[onclick*="_openToday"]').first().tap(); await sleep(700);
    let got = 0;
    for (let k = 0; k < 60; k++) {
      const st = await page.evaluate(() => ({ show: !!document.getElementById('ht_b_show'), got: !!document.getElementById('ht_b_got'), done: !!document.getElementById('hr_today_back2') }));
      if (st.done) break;
      if (st.show) { await page.locator('#ht_b_show').tap(); await sleep(300); continue; }
      if (st.got) { await page.locator('#ht_b_got').tap(); got++; await sleep(300); continue; }
      await sleep(200);
    }
    await sleep(800);
    const r = await page.evaluate(() => {
      try { checkAch(); } catch (e) {}
      const awards = Object.keys(JSON.parse(localStorage.getItem('hansen_coin_awards_v942') || '{}'));
      const pr = id => { const p = getAchProgress(id); return p ? p.cur + '/' + p.need : 'none'; };
      return { fin: ((document.getElementById('hr_today') || {}).innerText || '').replace(/\n+/g, ' | ').slice(0, 80),
        todaydone: awards.filter(k => /todaydone/.test(k)), streak: JSON.parse(localStorage.getItem('hansen_review_streak_v963') || 'null'),
        toasts: [...new Set(window.__toasts)], rv1: HansenAch.isPending('rv1') || HansenAch.isClaimed('rv1'),
        reviewS20: pr('reviewS20'), rv100: pr('rv100') };
    });
    console.log(`    开局到期 ${due0} 个 → 答错 5 个后到期 ${due1} 个 → 今日复习点了 ${got} 次「记住了」：${r.fin}`);
    ok(due0 === 0 && due1 === 5 && got === 5 && /今日复习完成/.test(r.fin), '② 今日复习做完了（5 个都「记住了」）');
    ok(r.todaydone.length === 1, `② 有「完成今日复习 +20」收据（${r.todaydone.join(',') || '没有'}）`);
    ok(r.streak && r.streak.count === 1, `② 连续复习 1 天（${JSON.stringify(r.streak)}）`);
    ok(r.toasts.some(t => /全部到期清零/.test(t)), `② 弹了「全部到期清零」（${JSON.stringify(r.toasts)}）`);
    ok(r.rv1, '③ 「第一次回头」成就解锁了');
    ok(r.reviewS20 === '5/20' && r.rv100 === '5/100', `③ 「复习次数」${r.reviewS20}、「累计复习」${r.rv100}（复习了 5 个词）`);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 今天刚答错的词复习完照样给今日复习奖励');
