/* test_land_quests_v1165.mjs —— 单词大陆的每日任务和常规岛一样：能看见 12 个任务、能领一次奖、进度单位一致
 *
 * v1163：单词大陆母版自带一份旧任务代码——最多只认 7 个任务、遇到不认识的任务就把整份清空。
 *        全站共用的任务表每天发 12 个（含「复习单词」等新任务），于是 8 个大陆岛的任务页永远「暂无任务」，徽章却显示 0/12。
 *        另外大陆岛的打地鼠/钓鱼/火眼金睛不管得多少分都只 +1、复习完成从来不报复习任务；
 *        两边的记忆翻牌都只 +1（matchPairs 是牌的数组，不是组数）、打地鼠/钓鱼命用完那一局的得分不算。
 *
 * 合同：
 *   ① 静态：两个母版的任务定义 / 规整 / 抽取代码逐字一样；生成出来的 27 个岛页也一样
 *   ② 外壳里打开 island_land1：任务页 12 张卡；做满一个任务，真点「领取」只给一次奖励
 *   ③ island_land1 和 island_animal 上报的进度一样：打地鼠得 25 分 → +25；复习 3/3 → 复习 +3、清空今日复习；
 *      记忆翻牌 8 对全对 → +8（真点翻牌）；钓鱼 / 打地鼠命用完时得了分 → 按分数上报
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

// ───────────── ① 静态对照 ─────────────
console.log('\n▶ ① 两个母版的任务代码逐字一样');
const T = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
const L = fs.readFileSync(path.join(ROOT, 'land_template.html'), 'utf8');
function questBlock(src) {
  const a = src.indexOf('const DAILY_QUEST_POOL=['), b = src.indexOf('function progressQuest(');
  if (a < 0 || b < 0) return '';
  let s = src.slice(a, b);
  // 拼写大PK 入口只在常规岛（单词大陆没有这张卡），对照时去掉
  const p = s.indexOf('/*🔴v1002: 拼写大PK 入口'), q = s.indexOf('function rollDailyQuests(');
  if (p >= 0 && q > p) s = s.slice(0, p) + s.slice(q);
  return s;
}
function fnSrc(src, name) {
  const a = src.indexOf('function ' + name + '(');
  if (a < 0) return '';
  const b = src.indexOf('\n', src.indexOf('{', a));
  return src.slice(a, b);
}
const tq = questBlock(T), lq = questBlock(L);
ok(tq.length > 1000 && tq === lq, `① 任务定义 + __hsnQuestDefinition + __hsnNormalizeQuests + rollDailyQuests 两边一样（${tq.length} / ${lq.length} 字）`);
for (const f of ['progressQuest', 'setQuest', 'claimQuest', 'updateQuestBadge']) {
  const a = fnSrc(T, f), b = fnSrc(L, f);
  ok(a && a === b, `① ${f} 两边一样`);
}
const units = src => ['moles', 'fish', 'eagle', 'match'].map(k => (src.match(new RegExp("progressQuest\\('" + k + "',[^;]*;", 'g')) || []).join(' | '));
ok(JSON.stringify(units(T)) === JSON.stringify(units(L)), '① 打地鼠/钓鱼/火眼金睛/翻牌的上报写法两边一样 ' + JSON.stringify(units(L)).slice(0, 160));
ok(/progressQuest\('review',correctCount\)/.test(L) && /setQuest\('reviewClear',1\)/.test(L), '① 单词大陆复习完成也上报「复习单词」「清空今日复习」');
const pages = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f));
const badPages = pages.filter(f => questBlock(fs.readFileSync(path.join(ROOT, f), 'utf8')) !== tq);
ok(pages.length === 27 && badPages.length === 0, `① 27 个岛页的任务代码都一样（不一样的：${badPages.join(',') || '无'}）`);

// ───────────── 浏览器 ─────────────
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  return ctx;
}

try {
  // ───────────── ② 外壳里打开 island_land1 ─────────────
  console.log('\n▶ ② 外壳（index.html）里打开 island_land1 的任务页');
  {
    const ctx = await newCtx();
    try {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.openIsland('island_land1.html'));
    await page.waitForFunction(() => { try { const w = document.getElementById('islandFrame').contentWindow; return /island_land1\.html$/.test(w.location.pathname) && typeof w.renderQuests === 'function' && w.document.readyState !== 'loading'; } catch (e) { return false; } }, null, { timeout: 30000 });
    const fr = page.frames().find(f => /island_land1\.html/.test(f.url()) && f.parentFrame() === page.mainFrame());
    await page.waitForTimeout(2000);
    await fr.evaluate(() => { try { closeAlert(); } catch (e) {} showScreen('quests'); });
    await page.waitForTimeout(400);
    const q = await fr.evaluate(() => ({ cards: document.querySelectorAll('#questsScreen .quest-card').length, empty: /暂无任务/.test(document.getElementById('questsScreen').textContent), sub: (document.getElementById('questSub') || {}).textContent }));
    ok(q.cards === 12 && !q.empty, '② 任务页 12 张任务卡（不是「暂无任务」） ' + JSON.stringify(q));
    // 做满第一张卡的任务，真点「领取」
    const goal = await fr.evaluate(() => { const it = S.quests.list[0]; if (it.type === 'reviewClear' || it.type === 'speed' || it.type === 'bubble') setQuest(it.type, it.goal); else progressQuest(it.type, it.goal); renderQuests(); return { type: it.type, goal: it.goal, coins: +(localStorage.getItem('hansen_wallet_coins') || 0) }; });
    await page.waitForTimeout(300);
    const btn = fr.locator('#questsScreen .quest-card').first().locator('.quest-reward');
    const canClaim = await fr.evaluate(() => { const b = document.querySelector('#questsScreen .quest-card .quest-reward'); return !!b && !b.classList.contains('claimed'); });
    if (canClaim) await btn.tap();
    await page.waitForTimeout(600);
    const c1 = await fr.evaluate(() => +(localStorage.getItem('hansen_wallet_coins') || 0));
    await fr.locator('#questsScreen .quest-card').first().locator('.quest-reward').tap().catch(() => {});
    await page.waitForTimeout(600);
    const c2 = await fr.evaluate(() => ({ coins: +(localStorage.getItem('hansen_wallet_coins') || 0), claimed: S.quests.list[0].claimed }));
    ok(canClaim && c1 > goal.coins, `② 做满「${goal.type}」任务后真点领取：金币 ${goal.coins} → ${c1}`);
    ok(c2.coins === c1 && c2.claimed === true, `② 再点一次不再给（${c1} → ${c2.coins}），显示已领取`);
    ok(errs.length === 0, '② 页面无报错 ' + errs.join(' | '));
    } catch (e) { ok(false, '② 这一段没能走完：' + String(e.message).split('\n')[0]); }
    await ctx.close();
  }

  // ───────────── ③ 上报的进度：大陆岛 = 常规岛 ─────────────
  const results = {};
  for (const file of ['island_land1.html', 'island_animal.html']) {
    console.log(`\n▶ ③ ${file} 上报的任务进度`);
    const ctx = await newCtx();
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof startMatch === 'function' && window.HansenQuestGlobal, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      try { closeAlert(); } catch (e) {}
      window.__qcalls = [];
      const P = window.progressQuest, Q = window.setQuest;
      window.progressQuest = function (t, a) { window.__qcalls.push(t + ':' + a); return P.apply(this, arguments); };
      window.setQuest = function (t, v) { window.__qcalls.push('set ' + t + ':' + v); return Q.apply(this, arguments); };
    });
    const take = () => page.evaluate(() => { const c = window.__qcalls.slice(); window.__qcalls.length = 0; return c; });
    const r = {};
    // 打地鼠打完整档、得 25 分
    await page.evaluate(() => { showScreen('home'); startMoles(); startMolesLevel(Object.keys(MOLES_LEVELS).find(k => [...Array(allW.length).keys()].some(MOLES_LEVELS[k].filter))); molesScore = 25; molesPool.length = 0; molesComplete(); });
    r.molesDone = (await take()).filter(c => /^moles:/.test(c));
    // 复习 3 个、3 个全对
    await page.evaluate(() => { S.wrongs = { 0: 1, 1: 1, 2: 1 }; startReview('emergency'); reviewState.correct = 3; reviewState.idx = 3; reviewState.rescued = []; reviewComplete(); });
    r.review = (await take()).filter(c => /review/.test(c));
    // 记忆翻牌：真点，8 对全对
    await page.evaluate(() => showScreen('home'));
    await page.locator('#homeScreen .mode-card[onclick="startMatch()"]').first().tap();
    await page.waitForTimeout(400);
    const pairs = await page.evaluate(() => { const m = {}; matchPairs.forEach((c, i) => { (m[c.idx] = m[c.idx] || []).push(i); }); return Object.values(m); });
    for (const [a, b] of pairs) { await page.locator('#mc' + a).tap(); await page.locator('#mc' + b).tap(); await page.waitForTimeout(520); }
    await page.waitForTimeout(1200);
    r.match = (await take()).filter(c => /^match:/.test(c));
    // 钓鱼：得了 40 分、命用完
    await page.evaluate(() => { showScreen('home'); startFish(); startFishLevel(Object.keys(FISH_LEVELS).find(k => [...Array(allW.length).keys()].some(FISH_LEVELS[k].filter))); fishScore = 40; fishLives = 0; fishGameOver(); });
    r.fishOver = (await take()).filter(c => /^fish:/.test(c));
    // 打地鼠：得了 30 分、最后一条命真点错一个
    await page.evaluate(() => { showScreen('home'); startMoles(); startMolesLevel(Object.keys(MOLES_LEVELS).find(k => [...Array(allW.length).keys()].some(MOLES_LEVELS[k].filter))); });
    await page.waitForFunction(() => molesTarget && document.querySelector('#molesGrid .mole-card'), null, { timeout: 8000 });
    const wrongSlot = await page.evaluate(() => { molesScore = 30; molesLives = 1; return [...document.querySelectorAll('[id^="moleSlot"]')].findIndex(s => s.dataset.en && s.dataset.en !== molesTarget.en); });
    await page.locator('#moleSlot' + wrongSlot).tap();
    await page.waitForTimeout(500);
    r.molesOver = (await take()).filter(c => /^moles:/.test(c));
    console.log('     ' + JSON.stringify(r));
    ok(r.molesDone.join() === 'moles:25', `③ 打地鼠打完整档得 25 分 → 任务 +25（${r.molesDone.join() || '没报'}）`);
    ok(r.review.includes('review:3') && r.review.includes('set reviewClear:1'), `③ 复习 3/3 → 复习 +3、清空今日复习（${r.review.join() || '没报'}）`);
    ok(r.match.join() === 'match:8', `③ 记忆翻牌 8 对全对 → +8（${r.match.join() || '没报'}）`);
    ok(r.fishOver.join() === 'fish:40', `③ 钓鱼命用完时得了 40 分 → +40（${r.fishOver.join() || '没报'}）`);
    ok(r.molesOver.join() === 'moles:30', `③ 打地鼠命用完时得了 30 分 → +30（${r.molesOver.join() || '没报'}）`);
    ok(errs.length === 0, '③ 页面无报错 ' + errs.join(' | '));
    results[file] = r;
    await ctx.close();
  }
  ok(JSON.stringify(results['island_land1.html']) === JSON.stringify(results['island_animal.html']), '③ 单词大陆和常规岛上报的一模一样');
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 单词大陆每日任务：12 个任务能看能领、进度单位和常规岛一致');
