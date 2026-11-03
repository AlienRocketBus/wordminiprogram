/* test_review2_ui_v1166.mjs —— 复习 2.0 真浏览器全流程（真岛页、真模块、真手指点按；页面一行没改）
 *
 * 做法：本地起服务开真的岛页（食物岛 → 色彩岛 → 单词大陆③ → 动物岛），开机前往 localStorage 放
 *   「孩子玩过好几个岛」的真实存档（各岛自己的存档、结晶、v963 错词建档日），让账本自己开机合并；
 *   然后用 page.addScriptTag 把复习 2.0 的三个文件装进页面（测试专用，不改任何页面），
 *   用 page.tap 一题一题点完（第一题故意答错），最后到别的岛核对。
 *
 * 合同：
 *   A 跨岛合并：orange（色彩岛+食物岛）只出一次；4 个到期词按「最该复习」排好
 *   B 点按目标都 ≥44px；答错有小课卡并读一遍；再考一次排在最后
 *   C 账本：答对升盒、错题减、毕业删计划立墓碑；答错降盒、今天还到期；同一个词两个槽位状态一致
 *   D 各岛一致：食物岛内存 S 当场同步；去色彩岛 / 单词大陆③ / 动物岛，开岛合并后错题没被加回来、计划没退回
 *   E 金币：只发这几张收据（纠错 +2、隔天毕业 +15、清零 +20），钱包涨的正好是它们之和；再复习、再刷新都不多给
 *   F 巡检：毕业的词交给 v963 排 30 天巡检；连击打卡
 *   G 亮色 / 暗色主题下文字对比度都够；家长面板和报告图能出
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d);
  });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
// 外网一律不许（不能依赖腾讯云 / 发音网站）
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());

/* 开机前放好「孩子玩过好几个岛」的存档（只放一次） */
await ctx.addInitScript(() => {
  try {
    if (localStorage.getItem('__r2seed')) return;   // 每个新标签页都会跑：只在第一次放存档
    localStorage.clear();
    localStorage.setItem('__r2seed', '1');
    const ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const T = ymd(0), Y = ymd(-1), old = Date.now() - 86400000;
    // _hsnMasteryV942：v942 以后的存档都带这个标记（否则宠物模块会把「我认识了」的词一次性记成 3 个爪）
    const save = (k, o) => localStorage.setItem(k, JSON.stringify(Object.assign({ learned: [], wrongs: {}, srs: {}, mc: {}, stats: {}, totalAnswers: 10, totalCorrect: 8, lastSaveTime: old, _hsnMasteryV942: 1 }, o)));
    localStorage.setItem('hansen_onboarded', '1');
    save('wordIslandFood', { learned: [0, 1, 2, 3, 4, 31], wrongs: { 0: 1, 2: 1 }, srs: { 0: { box: 1, due: T, last: ymd(-2) }, 2: { box: 0, due: ymd(-2), last: '' } }, mc: { 1: 3 }, totalAnswers: 30 });
    save('wordIslandColorNum', { learned: [5], wrongs: { 5: 2 }, srs: { 5: { box: 2, due: T, last: ymd(-4) } } });
    save('wordIslandAnimal', { learned: [4], srs: { 4: { box: 4, due: T, last: ymd(-15) } }, mc: { 4: 2 } });
    save('wordIslandLand3', { learned: [0], wrongs: { 0: 1 } });
    localStorage.setItem('hsn_crystal_food', JSON.stringify({ 1: { lv: 5, p: 0, d: ymd(-3), done: 1 } }));
    localStorage.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:0': Y, 'food:2': Y, 'color:5': Y, 'season:60': Y }));
  } catch (e) {}
});

const pageErrors = [];
const shot = async (page, name) => { if (process.env.REVIEW2_SHOTS) await page.screenshot({ path: path.join(process.env.REVIEW2_SHOTS, name + '.png') }); };
async function openIsland(file) {
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(file + ': ' + String(e.stack || e.message).slice(0, 300)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenCanonical && window.HansenReview && window.HansenReviewRewardsV963 && window.HansenCoins
    && typeof window.markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { const m = document.getElementById('alertModal'); if (m && m.classList.contains('show') && typeof closeAlert === 'function') closeAlert(); } catch (e) {} });
  // 测试专用：把复习 2.0 装进页面（页面本身一行没改）
  for (const f of ['hansen_review2_words_v1166.js', 'hansen_review2_v1166.js', 'hansen_review2_ui_v1166.js']) await page.addScriptTag({ url: BASE + f + '?v=' + VERSION });
  await page.waitForFunction(() => window.HansenReview2 && window.HansenReview2UI);
  // 只记录不拦截：看看复习 2.0 都读了哪些词
  await page.evaluate(() => { const o = window.speak; window.__spoken = []; window.speak = function (t) { window.__spoken.push(String(t)); try { return o && o.apply(this, arguments); } catch (e) {} }; });
  return page;
}
const H = {
  today: () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
};
const ledgerSlot = (page, id, ci) => page.evaluate(([id, ci]) => { const p = HansenCanonical.read().islands[id]; const e = p.srs[ci]; return { wrongs: p.wrongs[ci] || 0, srs: e ? { box: e.box, due: e.due, last: e.last } : null, tombSrs: p.cleared.srs[ci] || 0 }; }, [id, ci]);
const receipts = page => page.evaluate(() => { const o = JSON.parse(localStorage.getItem('hansen_coin_awards_v942') || '{}'); const out = {}; Object.keys(o).filter(k => /^rvrw/.test(k)).forEach(k => out[k] = o[k].amount); return out; });
const qNow = page => page.evaluate(() => { const s = HansenReview2UI._state(); const q = s.session && HansenReview2.current(s.session); return q ? { id: q.id, key: q.key, mode: q.mode, en: q.en, retry: q.retry, answerIndex: q.answerIndex, tiles: q.tiles, slots: q.slots, kind: q.kind } : null; });

async function checkTargets(page, label) {
  const small = await page.evaluate(() => [...document.querySelectorAll('#hr2_root button')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 12), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44));
  ok(small.length === 0, label + '：所有按钮 ≥44px ' + (small.length ? JSON.stringify(small) : ''));
}
async function contrast(page, label) {
  const worst = await page.evaluate(() => {
    function rgb(s) { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    function lum(c) { return [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
    function bgOf(el) { while (el) { const c = rgb(getComputedStyle(el).backgroundColor); if (c && c.a > 0.5) return c; el = el.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; }
    const out = [];
    document.querySelectorAll('#hr2_root .hr2-title, #hr2_root .hr2-ask, #hr2_root .hr2-cn, #hr2_root .hr2-opt, #hr2_root .hr2-btn, #hr2_root .hr2-tiny, #hr2_root .hr2-prog, #hr2_root .hr2-tile, #hr2_root .hr2-stat span, #hr2_root .hr2-list .w').forEach(el => {
      if (!el.offsetParent || !el.textContent.trim()) return;
      const f = rgb(getComputedStyle(el).color), b = bgOf(el); if (!f) return;
      const L1 = lum(f), L2 = lum(b), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      out.push({ t: el.className + ':' + el.textContent.trim().slice(0, 10), cr: Math.round(cr * 100) / 100 });
    });
    out.sort((a, b) => a.cr - b.cr); return out.slice(0, 3);
  });
  ok(worst.length > 0 && worst[0].cr >= 4.5, label + '：文字对比度最低 ' + (worst[0] ? worst[0].cr + '（' + worst[0].t + '）' : '无') + ' ≥ 4.5');
}
/* 一道题：correct=true 点对的，false 点错的（都是真手指 tap） */
async function tapAnswer(page, q, correct) {
  if (q.mode === 'spell') {
    const letters = q.en.toLowerCase().replace(/[^a-z]/g, '').split('');
    const seq = correct ? letters : letters.slice().reverse();
    if (!correct && seq.join('') === letters.join('')) seq.push(seq.shift());
    const used = new Set();
    for (const c of seq) { const i = q.tiles.findIndex((t, k) => t === c && !used.has(k)); used.add(i); await page.tap(`#hr2_root .hr2-tile[data-i="${i}"]`); }
  } else {
    const i = correct ? q.answerIndex : (q.answerIndex + 1) % 4;
    await page.tap(`#hr2_root .hr2-opt[data-i="${i}"]`);
  }
}
async function waitNext(page, prevId) {
  await page.waitForFunction(prev => {
    if (document.querySelector('#hr2_main .hr2-stats')) return true;
    if (document.querySelector('#hr2_main [data-act="next"]')) return true;
    const s = HansenReview2UI._state(); const q = s.session && HansenReview2.current(s.session);
    return !!(q && q.id !== prev && !s.busy && document.querySelector('#hr2_main .hr2-opt, #hr2_main .hr2-tile'));
  }, prevId, { timeout: 8000 });
}

// ════════════════════════════════════════════════════════════════════
console.log('\n▶ 食物岛：今天复习（第一题故意答错）');
const T = H.today();
let page = await openIsland('island_food.html');
const before = await page.evaluate(() => ({ wallet: HansenCoins.get(), ov: HansenReview2.overview() }));
ok(before.ov.ok && before.ov.dueCount === 4 && before.ov.sessionSize === 4, 'A 账本开机合并了各岛存档：4 个到期词 ' + JSON.stringify(before.ov));
const r0 = await receipts(page);
ok(Object.keys(r0).length === 0, '开始前没有任何复习收据');
await page.evaluate(() => HansenReview2UI.open());
await page.waitForSelector('#hr2_root .hr2-opt, #hr2_root .hr2-tile');
const order = await page.evaluate(() => HansenReview2UI._state().session.queue.map(q => q.key));
const land3first = await page.evaluate(() => HansenReview2._debug.catalog().items.find(i => i.members.some(m => m.slot === 'season:60')).key);
ok(JSON.stringify(order) === JSON.stringify(['orange', land3first, 'apple', 'fish']), 'A 一轮 4 个词、orange 只出现一次、错得多的排前面：' + order.join(','));
await contrast(page, 'G 暗色（默认深空蓝）');

const seen = [];
let q = await qNow(page), first = true, guard = 0;
while (q && guard++ < 12) {
  await checkTargets(page, 'B 第 ' + guard + ' 题（' + q.mode + '）');
  await shot(page, '1_q' + guard + '_' + q.mode);
  const wrong = first; first = false;
  const spokenBefore = await page.evaluate(() => window.__spoken.length);
  await tapAnswer(page, q, !wrong);
  seen.push(q.key + ':' + q.mode + (q.retry ? ':retry' : '') + (wrong ? ':wrong' : ''));
  await waitNext(page, q.id);
  if (wrong) {
    const lesson = await page.evaluate(() => ({ card: !!document.querySelector('#hr2_main .hr2-lesson'), en: (document.querySelector('#hr2_main .hr2-lesson .hr2-en') || {}).textContent, spoken: window.__spoken.slice() }));
    await shot(page, '2_lesson');
    ok(lesson.card && lesson.en === q.en, 'B 答错：出小课卡，写着正确的词 ' + lesson.en);
    ok(lesson.spoken.slice(spokenBefore).includes(q.en), 'B 答错：小课卡读了一遍 ' + q.en);
    await checkTargets(page, 'B 小课卡');
    await page.tap('#hr2_main [data-act="next"]');
    await page.waitForFunction(() => document.querySelector('#hr2_main .hr2-opt, #hr2_main .hr2-tile'));
    const s1 = await page.evaluate(() => { const s = HansenReview2UI._state().session; return { total: s.total, last: s.queue[s.queue.length - 1] }; });
    ok(s1.total === 5 && s1.last.key === 'orange' && s1.last.retry === true, 'B 本轮最后再考一次 orange');
    // 答错当场就写进账本，而且食物岛内存里的 S 也同步了
    const o = await ledgerSlot(page, 'food', 2), c = await ledgerSlot(page, 'color', 5);
    const s = await page.evaluate(() => ({ w: S.wrongs[2], srs: S.srs[2] ? { box: S.srs[2].box, due: S.srs[2].due } : null }));
    ok(o.wrongs === 2 && o.srs && o.srs.box === 0 && o.srs.due === T && c.srs && c.srs.box === 0 && c.srs.due === T, 'C 答错：两个槽位都降到盒0、今天还到期；错题记在 food:2 ' + JSON.stringify({ o, c }));
    ok(s.w === 2 && s.srs && s.srs.box === 0, 'D 食物岛内存 S 当场同步 ' + JSON.stringify(s));
  }
  q = await qNow(page);
}
await page.waitForSelector('#hr2_main .hr2-stats');
ok(seen.length === 5 && seen[4].startsWith('orange:') && seen[4].includes(':retry'), 'B 做了 5 题（4 个词 + 1 题再考）：' + seen.join(' '));
const result = await page.evaluate(() => ({ text: document.getElementById('hr2_main').innerText, wallet: HansenCoins.get() }));
ok(/今天的复习完成/.test(result.text) && /答错的 1 个词今天要再试一次/.test(result.text), '结果页出来了，告诉孩子答错的词今天还要再试一次');
await checkTargets(page, 'B 结果页');
await shot(page, '3_result');
const r1 = await receipts(page);
const expect1 = { [`rvrw:${T}:season:60:c1`]: 2, [`rvrw:${T}:season:60:grad`]: 15, [`rvrw:${T}:food:0:c1`]: 2, [`rvrw:${T}:food:0:grad`]: 15 };
ok(JSON.stringify(Object.keys(r1).sort()) === JSON.stringify(Object.keys(expect1).sort()) && Object.keys(expect1).every(k => r1[k] === expect1[k]), 'E 只发了这 4 张收据 ' + JSON.stringify(r1));
ok(result.wallet - before.wallet === 34, 'E 钱包正好涨 34（2+15+2+15） 实际 ' + (result.wallet - before.wallet));
ok(/\+34/.test(result.text), 'E 结果页写着 +34 金币');
const apple = await ledgerSlot(page, 'food', 0), fish = await ledgerSlot(page, 'animal', 4), sea = await ledgerSlot(page, 'season', 60);
ok(apple.wrongs === 0 && apple.srs && apple.srs.box === 2 && apple.srs.last === T, 'C apple：错题清零、升到盒2 ' + JSON.stringify(apple));
ok(!fish.srs && fish.tombSrs > 0 && fish.wrongs === 0, 'C fish：盒4 到期答对 → 毕业，计划删掉、立墓碑 ' + JSON.stringify(fish));
ok(sea.wrongs === 0 && sea.srs && sea.srs.box === 1, 'C 星海词（单词大陆③第 1 个）：错题清零、进计划盒1 ' + JSON.stringify(sea));
const patrol = await page.evaluate(() => JSON.parse(localStorage.getItem('hansen_review_patrol_v963') || '{}'));
ok(patrol['animal:4'] && patrol['animal:4'].stage === 1, 'F fish 交给 v963 排了 30 天巡检 ' + JSON.stringify(patrol['animal:4']));
const fishStars = await page.evaluate(() => HansenReview2.wordStars('fish'));
ok(fishStars.stars === 4, 'fish 毕业 + 宠物爪 2 → 4 星「记得牢」 (' + fishStars.stars + ')');
const ov1 = await page.evaluate(() => HansenReview2.overview());
ok(ov1.dueCount === 1, '答错的 orange 今天还要再试一次 (dueCount=' + ov1.dueCount + ')');
// 关掉再开一次：只剩 orange
await page.tap('#hr2_main [data-act="close"]');
ok(await page.evaluate(() => !document.getElementById('hr2_root')), '完成 → 浮层关掉');

// 刷新食物岛：内存 S 是从账本来的，和复习结果一致
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.HansenCanonical && window.S && document.readyState !== 'loading', null, { timeout: 30000 });
await page.waitForTimeout(1200);
const sFood = await page.evaluate(() => ({ w0: S.wrongs[0], w2: S.wrongs[2], b0: S.srs[0] && S.srs[0].box, b2: S.srs[2] && S.srs[2].box }));
ok(sFood.w0 === undefined && sFood.w2 === 2 && sFood.b0 === 2 && sFood.b2 === 0, 'D 刷新食物岛：错题和计划都是复习后的样子 ' + JSON.stringify(sFood));
await page.close();

// ════════════════════════════════════════════════════════════════════
console.log('\n▶ 色彩岛：开岛合并不把错题加回来；再复习 orange');
page = await openIsland('island_color.html');
const col = await ledgerSlot(page, 'color', 5);
const sCol = await page.evaluate(() => ({ w: S.wrongs[5], srs: S.srs[5] ? { box: S.srs[5].box, due: S.srs[5].due } : null }));
ok(col.wrongs === 2 && col.srs && col.srs.box === 0 && sCol.w === 2 && sCol.srs && sCol.srs.box === 0, 'D 色彩岛开岛后：orange 还是盒0、错题 2（旧存档的盒2 没回来）' + JSON.stringify({ col, sCol }));
const wallet2 = await page.evaluate(() => HansenCoins.get());
await page.evaluate(() => HansenReview2UI.open());
await page.waitForSelector('#hr2_root .hr2-opt, #hr2_root .hr2-tile');
q = await qNow(page);
ok(q && q.key === 'orange' && (await page.evaluate(() => HansenReview2UI._state().session.total)) === 1, '只剩 orange 一个');
await tapAnswer(page, q, true);
await waitNext(page, q.id);
await page.waitForSelector('#hr2_main .hr2-stats');
const r2 = await receipts(page), wallet3 = await page.evaluate(() => HansenCoins.get());
ok(r2[`rvrw:${T}:todaydone`] === 20 && Object.keys(r2).length === 5, 'E 今天的词都答对过一次：v963 发了 +20 清零奖励（收据 5 张）' + JSON.stringify(Object.keys(r2)));
ok(wallet3 - wallet2 === 20, 'E 重新记住 orange 不给钱，只有 +20 (' + (wallet3 - wallet2) + ')');
const col2 = await ledgerSlot(page, 'color', 5), fo2 = await ledgerSlot(page, 'food', 2);
ok(col2.srs && fo2.srs && col2.srs.box === 0 && JSON.stringify(col2.srs) === JSON.stringify(fo2.srs) && col2.srs.due > T, 'C 重新记住：盒子不动、明天再见，两个槽位一致 ' + JSON.stringify(col2.srs));
const streak = await page.evaluate(() => JSON.parse(localStorage.getItem('hansen_review_streak_v963') || '{}'));
ok(streak.last === T && streak.count >= 1, 'F v963 连击打卡 ' + JSON.stringify(streak));
await page.tap('#hr2_main [data-act="close"]');
// 再开：今天没有了；再刷 v963 也不会多给
await page.evaluate(() => HansenReview2UI.open());
await page.waitForSelector('#hr2_root [data-act="practice"]');
ok(/今天没有要复习的词/.test(await page.evaluate(() => document.getElementById('hr2_main').innerText)), '再开：今天没有要复习的词（可以练一练）');
await checkTargets(page, 'B 空状态页');
await shot(page, '5_empty');
// 练一练：真点完，一分钱都不给
await page.tap('#hr2_root [data-act="practice"]');
await page.waitForSelector('#hr2_root .hr2-opt, #hr2_root .hr2-tile');
const wallet4 = await page.evaluate(() => HansenCoins.get());
q = await qNow(page); guard = 0;
while (q && guard++ < 10) { await tapAnswer(page, q, true); await waitNext(page, q.id); q = await qNow(page); }
await page.waitForSelector('#hr2_main .hr2-stats');
await page.evaluate(() => { HansenReviewRewardsV963.refresh(); });
const wallet5 = await page.evaluate(() => HansenCoins.get()), r3 = await receipts(page);
ok(wallet5 === wallet4 && Object.keys(r3).length === 5, 'E 练一练 + 再刷新 v963：一分钱都没多给 (' + (wallet5 - wallet4) + ')');
// 家长面板 + 报告图
await page.tap('#hr2_main [data-act="parent"]');
await page.waitForSelector('#hr2_root .hr2-dist');
const par = await page.evaluate(() => document.getElementById('hr2_main').innerText);
ok(/掌握了/.test(par) && /最需要练的词/.test(par) && /orange/.test(par) && /936/.test(par), 'G 家长面板：掌握数、最弱的词（orange）、总数 936');
await checkTargets(page, 'G 家长面板');
await page.fill('#hr2_name', '小明');
await page.tap('#hr2_root [data-act="report"]');
await page.waitForSelector('#hr2_reportimg');
const img = await page.evaluate(() => { const i = document.getElementById('hr2_reportimg'); return { len: i.src.length, png: i.src.startsWith('data:image/png') }; });
ok(img.png && img.len > 20000, 'G 学习报告图生成了（本机 canvas，' + Math.round(img.len / 1024) + ' KB）');
await shot(page, '6_parent');
if (process.env.REVIEW2_SHOTS) { const b64 = await page.evaluate(() => document.getElementById('hr2_reportimg').src.split(',')[1]); fs.writeFileSync(path.join(process.env.REVIEW2_SHOTS, '7_report.png'), Buffer.from(b64, 'base64')); }
await page.close();

// ════════════════════════════════════════════════════════════════════
console.log('\n▶ 单词大陆③（亮色主题）/ 动物岛：别的入口看到的也是复习后的样子');
await ctx.addInitScript(() => { try { localStorage.setItem('hansen_palette_global', 'cloud'); } catch (e) {} });
page = await openIsland('island_land3.html');
const l3 = await page.evaluate(() => ({ w: S.wrongs[0], srs: S.srs[0] ? S.srs[0].box : null, light: document.documentElement.classList.contains('hsn-pal-light') }));
ok(l3.w === undefined && l3.srs === 1, 'D 单词大陆③：星海词错题没回来、计划盒1 ' + JSON.stringify(l3));
ok(l3.light, '这一页是亮色主题（云端白）');
// 在岛里的真玩法接口答错一个词 → 复习 2.0 马上数到它（岛 → 复习这条路也通）
const fromIsland = await page.evaluate(() => { markAnswer(1, false); return HansenReview2.overview(); });
ok(fromIsland.ok && fromIsland.dueCount === 1, '岛里刚答错的词，复习 2.0 马上数到 (dueCount=' + fromIsland.dueCount + ')');
await page.evaluate(() => HansenReview2UI.open());
await page.waitForSelector('#hr2_root .hr2-opt, #hr2_root .hr2-tile');
await contrast(page, 'G 亮色（云端白）出题页');
await shot(page, '4_light_question');
q = await qNow(page);
await tapAnswer(page, q, false);
await waitNext(page, q.id);
await contrast(page, 'G 亮色小课卡');
await page.tap('#hr2_root .hr2-x');
await page.evaluate(() => HansenReview2UI.openParent());
await page.waitForSelector('#hr2_root .hr2-dist');
await contrast(page, 'G 亮色家长面板');
// 8 套配色逐个换（用页面自己的 hansenApplyPalette），出题页和家长面板都要看得清
for (const pal of ['cosmos', 'violet', 'aurora', 'woods', 'cloud', 'sakura', 'cream', 'mint']) {
  await page.evaluate(p => { window.hansenApplyPalette(p, true); HansenReview2UI.openParent(); }, pal);
  await page.waitForSelector('#hr2_root .hr2-dist');
  await contrast(page, 'G 配色 ' + pal + ' 家长面板');
  await page.evaluate(() => HansenReview2UI.open());
  await page.waitForSelector('#hr2_root .hr2-opt, #hr2_root .hr2-tile');
  await contrast(page, 'G 配色 ' + pal + ' 出题页');
}
await page.evaluate(() => HansenReview2UI.close());
await page.close();
page = await openIsland('island_animal.html');
const an = await page.evaluate(() => ({ srs: S.srs[4] || null, ledger: HansenCanonical.read().islands.animal.srs[4] || null }));
ok(!an.srs && !an.ledger, 'D 动物岛：毕业的 fish 不在计划里了（旧存档里的盒4 没复活）');
await page.close();

const mine = pageErrors.filter(e => /review2/i.test(e));
ok(mine.length === 0, '复习 2.0 没有任何页面报错' + (mine.length ? '：' + mine.join(' | ') : ''));
if (pageErrors.length) console.log('  ℹ️  页面其它报错（与本模块无关）：' + pageErrors.length + ' 条，例：' + pageErrors[0].slice(0, 160));

await browser.close(); srv.close();
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 全部通过');
process.exit(fails ? 1 : 0);
