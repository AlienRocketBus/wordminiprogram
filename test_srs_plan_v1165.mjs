/* test_srs_plan_v1165.mjs —— 错词留在间隔复习计划里，直到真正毕业
 *
 * 事故（v1163 实测）：错一次 → 当天任意玩法答对一次 → 错题数归零 → 复习计划被删 → 再也不会复习。
 *   ① markAnswer 把 S.wrongs 扣到 0；② hansen_review._ensureSrs 删掉 wrongs==0 的计划；
 *   ③ 权威账本 absorbAnswer 也在归零时删计划；④ 真实答题吸收器只认字符串下标，
 *   玩法传数字 → 永远返回 null（测试里它被桩替换了，所以从没人发现）。
 *   SRS_GAP=[1,2,4,7,15] 实际上跑不起来。
 *
 * 合同（真浏览器、真模块、零桩；常规岛 + 单词大陆各跑一遍）：
 *   A 答错 → 立刻进计划（盒0，今天到期）
 *   B 当天答对 → 错题本清掉，但计划还在：盒1，2 天后到期；刷新页面后仍在
 *   C 到期那天（错题本已空）仍算「到期」：今日复习 + 首页横幅口径都要数到它
 *   D 到期答对 → 盒2，4 天后；没到期答对 → 不升盒（间隔不被打破）
 *   E 盒4 到期答对 → 毕业：计划删除 + 进 30 天巡检
 *   F v963 证据闸门：盒4 没真答对过，自评「记住了」不能毕业；先在玩法里真答对过（rp）才行，
 *     而且这条证据要经得起账本同步
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

async function openIsland(ctx, file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenCanonical && window.HansenReviewRewardsV963
    && typeof window.markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return { page, errs };
}

/* 页面内工具：日期、读计划、改计划（模拟「过了几天」只改 due/last，不碰 Date） */
const HELPERS = () => {
  window.__t = {
    ymd(n) { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    plan(i) { const e = S.srs && S.srs[i]; return e ? JSON.parse(JSON.stringify(e)) : null; },
    canonPlan(i) {
      const ref = HansenCanonical.currentRef(), a = HansenCanonical.resolve(ref), ci = HansenCanonical.toCanonicalIndex(ref, i);
      const p = HansenCanonical.read().islands[a.id]; return p.srs[ci] ? { box: p.srs[ci].box, due: p.srs[ci].due } : null;
    },
    setPlan(i, e) { HansenCanonical.setCurrentSrs(i, e); S.srs[i] = e; if (typeof save === 'function') save(); },
    dueIdx() { HansenReview._dueCount(); return Object.keys(S.srs || {}).filter(k => { const e = S.srs[k]; return e.box < 5 && e.due <= this.ymd(0); }).map(Number); },
  };
};

async function scenario(file, label) {
  console.log(`\n▶ ${label}（${file}）`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__seeded', '1'); } } catch (e) {} });
  let { page, errs } = await openIsland(ctx, file);
  await page.evaluate(HELPERS);

  const I = 3, J = 5, K = 7, L = 9, M = 11;
  // A
  const a = await page.evaluate(i => { markAnswer(i, false); return { wrong: S.wrongs[i], plan: __t.plan(i), canon: __t.canonPlan(i), today: __t.ymd(0), due: HansenReview._dueCount() }; }, I);
  ok(a.wrong === 1, 'A 答错 → 错题本 +1');
  ok(a.plan && a.plan.box === 0 && a.plan.due === a.today, 'A 答错当场进计划：盒0、今天到期 ' + JSON.stringify(a.plan));
  ok(a.canon && a.canon.box === 0, 'A 计划同时写进权威账本 ' + JSON.stringify(a.canon));
  ok(a.due >= 1, 'A 今日复习数到它 (due=' + a.due + ')');

  // B
  const b = await page.evaluate(i => { markAnswer(i, true); const r = { wrong: S.wrongs[i], plan: __t.plan(i), canon: __t.canonPlan(i), in2: __t.ymd(2), dueToday: __t.dueIdx().includes(i) }; return r; }, I);
  ok(b.wrong === undefined, 'B 当天答对 → 错题本清掉（允许）');
  ok(b.plan && b.plan.box === 1 && b.plan.due === b.in2, 'B 计划还在：盒1、2 天后再见 ' + JSON.stringify(b.plan));
  ok(b.canon && b.canon.box === 1 && b.canon.due === b.in2, 'B 权威账本也是盒1 ' + JSON.stringify(b.canon));
  ok(!b.dueToday, 'B 今天不再到期（间隔开始生效）');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenReviewRewardsV963 && document.readyState !== 'loading', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(HELPERS);
  const b2 = await page.evaluate(i => ({ wrong: S.wrongs[i], plan: __t.plan(i) }), I);
  ok(b2.wrong === undefined && b2.plan && b2.plan.box === 1, 'B 刷新后计划仍在（错题本仍空）' + JSON.stringify(b2.plan));

  // C：两天后（只把 due 拨到今天、last 拨到前天）
  const c = await page.evaluate(i => {
    __t.setPlan(i, { box: 1, due: __t.ymd(0), last: __t.ymd(-2) });
    const local = HansenReviewRewardsV963._debug.globalDueInfo();
    return { dueToday: __t.dueIdx().includes(i), count: HansenReview._dueCount(), localDue: local.localDue, wrong: S.wrongs[i] };
  }, I);
  ok(c.wrong === undefined, 'C 错题本是空的');
  ok(c.dueToday && c.count >= 1, 'C 到期那天今日复习照样数到它 (count=' + c.count + ')');
  ok(c.localDue >= 1, 'C 首页横幅口径（canonical 全局到期）也数到它 (localDue=' + c.localDue + ')');
  // C2：横幅点过去的「错题总览」也要看得到这个岛（否则横幅说有、总览说没有）
  const c2 = await page.evaluate(async () => {
    /* 总览靠 hansen_upgrade 开机 1.5 秒后写的本岛词表缓存(hansen_vocab_*)认词；刚刷新完就打开会看不到这个岛
       （复查实测：修改前后的代码都在单词大陆这一场时过时不过）。等缓存写好再开，断言不变 */
    for (let t = 0; t < 40 && !localStorage.getItem('hansen_vocab_' + window.__hsnSaveKey); t++) await new Promise(r => setTimeout(r, 100));
    if (window.__hsnSaveNow) __hsnSaveNow();
    HansenWrongOverview.open ? HansenWrongOverview.open() : HansenWrongOverview._open();
    const el = document.getElementById('hwo_overlay');
    const cards = el ? [...el.querySelectorAll('.hwo_island_card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()) : [];
    const total = el && el.querySelector('.hwo_total_n') ? el.querySelector('.hwo_total_n').textContent.trim() : '';
    if (el) el.remove();
    return { cards, total };
  });
  ok(c2.cards.length === 1 && /1 个该复习/.test(c2.cards[0]), 'C2 错题总览列出这个岛：1 个该复习 ' + JSON.stringify(c2.cards));
  ok(c2.total === '1', 'C2 总览「待复习单词」= 1（与横幅同口径）total=' + c2.total);

  // D：到期答对 → 盒2/4 天；同一天再答对不再升（日锁）；未到期答对不升
  const d = await page.evaluate(i => {
    markAnswer(i, true); const p1 = __t.plan(i);
    markAnswer(i, true); const p2 = __t.plan(i);
    return { p1, p2, in4: __t.ymd(4) };
  }, I);
  ok(d.p1 && d.p1.box === 2 && d.p1.due === d.in4, 'D 到期答对 → 盒2、4 天后 ' + JSON.stringify(d.p1));
  ok(d.p2 && d.p2.box === 2, 'D 同一天再答对不再升盒 ' + JSON.stringify(d.p2));
  const d3 = await page.evaluate(i => { __t.setPlan(i, { box: 2, due: __t.ymd(3), last: __t.ymd(-1) }); markAnswer(i, true); return __t.plan(i); }, I);
  ok(d3 && d3.box === 2, 'D 没到期答对不升盒（间隔不被打破）' + JSON.stringify(d3));

  // E：盒4 到期答对 → 毕业 + 巡检
  const e = await page.evaluate(i => {
    __t.setPlan(i, { box: 4, due: __t.ymd(0), last: __t.ymd(-15) });
    markAnswer(i, true);
    const patrol = JSON.parse(localStorage.getItem('hansen_review_patrol_v963') || '{}');
    const slot = window.__hsnReviewSlot ? __hsnReviewSlot(i) : '';
    return { plan: __t.plan(i), canon: __t.canonPlan(i), patrol: patrol[slot] || null, in30: __t.ymd(30), dueToday: __t.dueIdx().includes(i) };
  }, I);
  ok(e.plan === null && e.canon === null, 'E 盒4 到期答对 → 毕业，计划删除（本岛+账本）');
  ok(e.patrol && e.patrol.stage === 1 && e.patrol.due === e.in30, 'E 毕业后进 30 天巡检 ' + JSON.stringify(e.patrol));

  // E2：错题本清零那一刻（还在计划里）不排巡检，只有真正毕业才排 —— 不会给同一个词排两轮巡检
  const e2 = await page.evaluate(j => {
    const slot = window.__hsnReviewSlot ? __hsnReviewSlot(j) : '';
    const since = JSON.parse(localStorage.getItem('hansen_review_wrong_since_v963') || '{}'); since[slot] = __t.ymd(-3);
    localStorage.setItem('hansen_review_wrong_since_v963', JSON.stringify(since));
    S.wrongs[j] = 1; save(); HansenReview._dueCount();        // 昨天以前的错词（已在计划里）
    markAnswer(j, true);                                        // 隔天清零 → 照旧 +15，但词还在计划里
    const patrol = JSON.parse(localStorage.getItem('hansen_review_patrol_v963') || '{}');
    return { plan: __t.plan(j), patrol: patrol[slot] || null };
  }, J);
  ok(e2.plan && e2.plan.box === 1, 'E2 隔天清零后词仍在计划里 ' + JSON.stringify(e2.plan));
  ok(e2.patrol === null, 'E2 还没毕业就不排巡检');

  // F：v963 证据闸门（自评「记住了」）
  const f = await page.evaluate(([k, l]) => {
    __t.setPlan(k, { box: 4, due: __t.ymd(1), last: __t.ymd(-14) });   // 明天才到期
    markAnswer(k, true);                                                // 没到期真答对 → 只记证据
    const proof = __t.plan(k);
    HansenReview._dueCount(); HansenReview._dueCount();                 // 经过两次账本同步
    const proofAfterSync = __t.plan(k);
    __t.setPlan(k, Object.assign({}, __t.plan(k), { due: __t.ymd(0) })); // 到期了（证据还在）
    __t.setPlan(l, { box: 4, due: __t.ymd(0), last: __t.ymd(-15) });   // 另一个词：没有任何真答对证据
    return { proof, proofAfterSync };
  }, [K, L]);
  ok(f.proof && f.proof.box === 4 && f.proof.rp === 1, 'F 没到期的真答对记下证据 rp=1 ' + JSON.stringify(f.proof));
  ok(f.proofAfterSync && f.proofAfterSync.rp === 1, 'F 证据经得起账本同步（以前每次同步都被冲掉）');
  // 走真的今日复习界面：两个词都点「看答案 → 记住了」
  await page.evaluate(() => HansenReview._openToday());
  await page.waitForTimeout(300);
  for (let step = 0; step < 12; step++) {
    const st = await page.evaluate(() => {
      const el = document.getElementById('hr_today'); if (!el) return 'gone';
      if (/今日复习完成/.test(el.textContent || '')) return 'done';
      const got = el.querySelector('#ht_b_got'); if (got) { got.click(); return 'got'; }
      const show = el.querySelector('#ht_b_show'); if (show) { show.click(); return 'show'; }
      return 'stuck';
    });
    if (st === 'done' || st === 'gone' || st === 'stuck') break;
    await page.waitForTimeout(120);
  }
  const f2 = await page.evaluate(([k, l]) => ({ k: __t.plan(k), l: __t.plan(l) }), [K, L]);
  ok(f2.k === null, 'F 有真答对证据的词：自评「记住了」→ 毕业');
  ok(f2.l && f2.l.box === 4, 'F 没有证据的词：自评不能毕业，留在盒4 ' + JSON.stringify(f2.l));
  await page.evaluate(() => { const el = document.getElementById('hr_today'); if (el) el.remove(); const c = document.getElementById('hr_center'); if (c) c.remove(); });

  // G：老存档里的错词（还没进过计划）——开岛就进计划，第一次答对也不会漏
  await page.evaluate(m => { S.wrongs[m] = 1; delete S.srs[m]; HansenCanonical.setCurrentSrs(m, null); save(); if (window.__hsnSaveNow) __hsnSaveNow(); }, M);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenReviewRewardsV963 && document.readyState !== 'loading', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(HELPERS);
  const g = await page.evaluate(m => { const before = __t.plan(m); markAnswer(m, true); return { before, after: __t.plan(m), wrong: S.wrongs[m] }; }, M);
  ok(g.before && g.before.box === 0, 'G 老错词开岛即进计划 ' + JSON.stringify(g.before));
  ok(g.wrong === undefined && g.after && g.after.box === 1, 'G 第一次答对：错题本清掉、计划升到盒1 ' + JSON.stringify(g.after));

  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
}

try {
  await scenario('island_animal.html', '常规岛');
  await scenario('island_land3.html', '单词大陆');
} finally {
  await browser.close();
  srv.close();
}
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 错词留在间隔复习计划里直到真正毕业：常规岛 + 单词大陆全过');
