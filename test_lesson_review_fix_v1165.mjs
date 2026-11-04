/* test_lesson_review_fix_v1165.mjs —— 答错小课 + 间隔复习：复查时找出的问题（真浏览器、真模块）
 *
 * 复查实测（修之前）：
 *   R 本轮末「再考一次」走的是完整答对：错题本 1→0、复习计划盒0→1、还发 +2 纠错金。
 *     刚看过答案马上再答一遍就算「纠错」→ 故意答错再答对拿 3 金币，一次答对只拿 1；错题本每轮结束都被清空。
 *   S 极速 60 秒：一个词错过一次，题池洗回来再出现时也被当成「再考题」，答对 0 分（白丢分）。
 *   P 听音辨义：再考题没加答对数，却又记了一次宠物练习（gameCounts.listen 多 1）。
 *   C 完形填空：以前答错会把整句例句读一遍；小课卡片把句子整个挡住，只读一个单词。
 *   V 小课卡片还在时孩子离开游戏（换屏）：卡片还挂着，2.5 秒后又替游戏出下一题、读下一个词，
 *     打字大师还会被重新打开（typeActive=true）。
 *   Q 完形填空：池里剩下的词例句对不上（动物岛 pig/eagle/cow 的例句是复数 Pigs…）时，
 *     nextClozeQ 直接结算，错词根本没再考（v1165 自己的测试因此时过时不过）。
 *   M 一键静音开着时点小课卡片继续：下一题立刻出、立刻自动读词，正好落在 hansen_mute「点了就算想听」的
 *     120ms 放行窗口里 → 静音漏声。
 *   A 单词大陆③和星海是同一批词的两个入口：在星海清掉的错词、升过的复习盒，回到单词大陆③又被它自己的旧存档
 *     冲回来（错题本 1、盒0）。原因：开机先 save() 一次、hansen_upgrade 又把存档时间改成「现在」，账本把旧数据当新的；
 *     宠物模块还在账本开机同步之前就「以本页为准」并入了一次。
 *   G 同一个词发两次 +15 毕业金：错题本隔天清零那天发一次；复习计划后来在「今日复习」自评毕业又发一次。
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

/* 新孩子；sessionStorage.__dayOff = 「过了几天」（只给 G 用：整页的 Date 一起往后拨，所有模块看到同一天） */
async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); }
      const off = Number(sessionStorage.getItem('__dayOff') || 0) * 86400000;
      if (off) {
        const RD = Date;
        class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
        window.Date = D;
      }
    } catch (e) {}
  });
  return ctx;
}
async function openIsland(ctx, file, page) {
  page = page || await ctx.newPage();
  const errs = page.__errs || (page.__errs = []);
  if (!page.__hooked) { page.__hooked = 1; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140))); page.on('dialog', d => d.dismiss().catch(() => {})); }
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenReviewRewardsV963 && window.HansenCanonical && window.HansenMistakeLesson &&
    typeof window.markAnswer === 'function' && typeof startListen === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click();
    window.__w = (fn, ms = 9000) => new Promise((res) => { const t0 = Date.now(); (function loop() { let v = false; try { v = fn(); } catch (e) {} if (v) return res(v); if (Date.now() - t0 > ms) return res(false); setTimeout(loop, 60); })(); });
    window.__card = () => { const el = document.getElementById('hml_lesson'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
    window.__tapCard = () => { const el = document.getElementById('hml_lesson'); if (el) el.click(); return !!el; };
    window.__ymd = (n) => { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    /* 记下每一次答题：是不是再考题、金币变了多少、错题本和复习计划变成什么样 */
    window.__mlog = [];
    const om = window.markAnswer;
    window.markAnswer = function (i, c) {
      const b = (window.HansenCoins && HansenCoins.get) ? HansenCoins.get() : 0, retry = !!window.__hmlRetryAns;
      const r = om.apply(this, arguments);
      const e = S.srs && S.srs[i];
      window.__mlog.push({ i, c: c === true, retry, delta: ((window.HansenCoins && HansenCoins.get) ? HansenCoins.get() : 0) - b, wrong: S.wrongs[i] || 0, box: e ? e.box : null, due: e ? e.due : null });
      return r;
    };
    Object.keys(om).forEach(k => { try { window.markAnswer[k] = om[k]; } catch (e) {} });
  });
  return { page, errs };
}

/* ── R：再考题是练习，不是纠错（常规岛 + 单词大陆） ── */
async function retryScenario(file) {
  console.log(`\n▶ R 本轮末再考一次（${file} · 听音辨义）`);
  const ctx = await newCtx();
  const { page, errs } = await openIsland(ctx, file);
  const r = await page.evaluate(async () => {
    startListen(); startListenLevel('easy');
    _shuffledPools['listen_easy'] = _shuffledPools['listen_easy'].slice(-1);   // 本轮：第 1 题 + 另 1 题
    const miss = listenQ.idx, slot = window.__hsnReviewSlot ? __hsnReviewSlot(miss) : '';
    document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn)].click();
    await __w(__card, 3000); __tapCard();
    for (let k = 0; k < 4 && listenActive; k++) {
      await __w(() => listenQ && !listenQ.answered, 6000);
      if (!listenActive) break;
      document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)].click();
      await __w(() => !listenActive || (listenQ && !listenQ.answered), 7000);
    }
    const log = window.__mlog.filter(x => x.c);
    const W = window.HansenCoins;
    return { miss, log, wrongNow: S.wrongs[miss] || 0, plan: S.srs && S.srs[miss] ? S.srs[miss] : null, today: __ymd(0),
      corrCoin: !!(W && W.hasAward && W.hasAward('rvrw:' + __ymd(0) + ':' + slot + ':c1')) };
  });
  const retry = r.log.find(x => x.i === r.miss && x.retry), first = r.log.find(x => x.i !== r.miss && !x.retry);
  ok(!!retry, 'R 错词在本轮末被再考了一次，而且那一次被标成「再考题」 ' + JSON.stringify(r.log));
  ok(retry && retry.wrong === 1 && r.wrongNow === 1, `R 再考答对后错题本里还有这个词（${retry ? retry.wrong : '?'} / 现在 ${r.wrongNow}）`);
  ok(r.plan && r.plan.box === 0 && r.plan.due === r.today, 'R 复习计划不升盒：还是盒0、今天到期 ' + JSON.stringify(r.plan));
  ok(!r.corrCoin, 'R 再考答对不发 +2 纠错金（没有 c1 收据）');
  ok(retry && first && retry.delta <= first.delta, `R 故意答错再答对，拿的金币不比一次答对多（再考 +${retry ? retry.delta : '?'}，一次答对 +${first ? first.delta : '?'}）`);
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();
}

try {
  await retryScenario('island_animal.html');
  await retryScenario('island_land2.html');

  /* ── S / P / C / V：同一个常规岛页 ── */
  const ctx = await newCtx();
  const { page, errs } = await openIsland(ctx, 'island_land1.html');

  console.log('\n▶ S 极速 60 秒：只有插回来的那一次算再考');
  const s = await page.evaluate(async () => {
    startSpeed(); startSpeedLevel('easy'); spTime = 9999;
    const miss = window._spIdx;
    spAnswer(window._spOpts.findIndex(o => o.en !== window._spCorrect));
    await __w(__card, 3000); __tapCard();
    const seen = [];
    for (let k = 0; k < 2 * allW.length + 8 && spActive; k++) {
      await __w(() => { const o = document.getElementById('spOpts'); return o && !o.dataset.done && !HansenMistakeLesson.busy(); }, 4000);
      const idx = window._spIdx, s0 = spScore;
      spAnswer(window._spOpts.findIndex(o => o.en === window._spCorrect));
      if (idx === miss) seen.push({ k, gained: spScore - s0, wrongAfter: S.wrongs[miss] || 0 });
      await new Promise(r => setTimeout(r, 380));
      if (seen.length >= 2) break;
    }
    stopSpeed(); showScreen('home');
    return { seen, n: allW.length };
  });
  ok(s.seen.length >= 2 && s.seen[0].k <= 4 && s.seen[0].gained === 0, '极速：错词过几题再考一次，那一次不算分 ' + JSON.stringify(s.seen));
  ok(s.seen.length >= 2 && s.seen[1].gained > 0, '极速：题池洗回来这个词再出现，答对照常得分（以前白丢分） ' + JSON.stringify(s.seen[1] || null));
  ok(s.seen.length >= 2 && s.seen[0].wrongAfter === 1 && s.seen[1].wrongAfter === 0, '极速：再考不扣错题本；后来真的答对才扣 ' + JSON.stringify(s.seen.map(x => x.wrongAfter)));

  console.log('\n▶ P 听音辨义：再考题不再多记一次宠物练习');
  const p = await page.evaluate(async () => {
    startListen(); startListenLevel('easy');
    _shuffledPools['listen_easy'] = _shuffledPools['listen_easy'].slice(-1);
    S.stats.listenRight = 9;
    const gc0 = (S.stats.gameCounts && S.stats.gameCounts.listen) || 0;
    document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn)].click();
    await __w(__card, 3000); __tapCard();
    for (let k = 0; k < 4 && listenActive; k++) {
      await __w(() => listenQ && !listenQ.answered, 6000);
      if (!listenActive) break;
      document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)].click();
      await __w(() => !listenActive || (listenQ && !listenQ.answered), 7000);
    }
    const gc1 = (S.stats.gameCounts && S.stats.gameCounts.listen) || 0;
    showScreen('home');
    return { gc0, gc1, right: S.stats.listenRight };
  });
  // 第 10 个答对记 1 次 + 一轮听完记 1 次 = 2；再考题不能再加
  ok(p.right === 10 && p.gc1 - p.gc0 === 2, `听音：宠物练习次数 +${p.gc1 - p.gc0}（应为 2：第 10 个答对 1 次 + 一轮听完 1 次）`);

  console.log('\n▶ C 完形填空：答错照旧把整句例句读一遍，卡片上看得到这句话');
  const c = await page.evaluate(async () => {
    startCloze(); startClozeLevel('easy');
    window.__said = [];
    const sp = window.speak;
    window.speak = function (t) { window.__said.push(String(t)); return sp.apply(this, arguments); };
    Object.keys(sp).forEach(k => { try { window.speak[k] = sp[k]; } catch (e) {} });
    const w = clozeQ.word;
    document.querySelectorAll('#clozeScreen .cloze-opt')[clozeQ.opts.findIndex(o => o.en !== w.en)].click();
    const card = await __w(__card, 3000);
    await new Promise(r => setTimeout(r, 500));
    const said = window.__said.slice();
    __tapCard();
    const moved = await __w(() => !document.getElementById('hml_lesson') && clozeQ && clozeQ.word !== w, 4000);
    window.speak = sp;
    stopCloze(); showScreen('home');
    return { ex: w.ex, exCn: w.exCn, en: w.en, card, said, moved: !!moved };
  });
  ok(c.card.indexOf(c.ex) >= 0 && (!c.exCn || c.card.indexOf(c.exCn) >= 0), '完形：揭晓卡上有这句例句（和中文）: ' + c.card);
  ok(c.said[0] === c.ex, `完形：读的是整句例句「${c.ex}」（实读 ${JSON.stringify(c.said)}）`);
  ok(c.moved, '完形：点一下卡片就进下一题');

  console.log('\n▶ V 小课卡片还在时离开游戏：卡片马上收起，不再替游戏出题、读词');
  const v = await page.evaluate(async () => {
    startTyping(1);
    const w0 = typeWord;
    for (const ch of w0.en.toLowerCase()) typeKey(ch === 'z' ? 'q' : 'z');   // 拼错
    const card = await __w(__card, 3000);
    window.__said = [];
    const sp = window.speak;
    window.speak = function (t) { window.__said.push(String(t)); return sp.apply(this, arguments); };
    showScreen('home');                                     // 孩子离开了（返回 / 换屏）
    await new Promise(r => setTimeout(r, 150));
    const goneFast = !document.getElementById('hml_lesson');
    await new Promise(r => setTimeout(r, 3200));            // 等过原来 2.5 秒的小课时间
    const res = { card: !!card, goneFast, typeActive: !!typeActive, said: window.__said.slice(), home: document.getElementById('homeScreen').classList.contains('active') };
    window.speak = sp;
    return res;
  });
  ok(v.card && v.goneFast, '换屏后小课卡片马上收起（不留在主页上）');
  ok(v.home && !v.typeActive, `打字大师没有被小课的定时器重新打开（typeActive=${v.typeActive}）`);
  ok(v.said.length === 0, '离开后没有再替游戏读下一个词 ' + JSON.stringify(v.said));

  console.log('\n▶ M 一键静音开着：点小课卡片继续，下一题的自动朗读不能漏声');
  const m = await page.evaluate(async () => {
    localStorage.setItem('hansen_muted', '1');
    startSpeed(); startSpeedLevel('easy'); spTime = 9999;
    await new Promise(r => setTimeout(r, 400));
    /* 只数真正发出去的声音：mp3 播放 + 系统朗读 */
    window.__plays = [];
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push(String(this.currentSrc || this.src).split('/').pop()); return P.apply(this, arguments); };
    let S0 = null; try { S0 = speechSynthesis.speak; speechSynthesis.speak = function (u) { window.__plays.push('tts:' + (u && u.text)); return S0.call(speechSynthesis, u); }; } catch (e) {}
    spAnswer(window._spOpts.findIndex(o => o.en !== window._spCorrect));
    await __w(__card, 3000);
    await new Promise(r => setTimeout(r, 400));
    const during = window.__plays.splice(0);
    const before = window._spIdx;
    __tapCard();                                        // 点卡片：hansen_mute 会开 120ms「点了就算想听」的窗口
    await new Promise(r => setTimeout(r, 700));
    const res = { during, after: window.__plays.splice(0), moved: window._spIdx !== before };
    HTMLMediaElement.prototype.play = P; if (S0) speechSynthesis.speak = S0;
    localStorage.setItem('hansen_muted', '0');
    stopSpeed(); showScreen('home');
    return res;
  });
  ok(m.moved, '静音：点卡片照样进下一题');
  ok(m.during.length === 0, '静音：小课自己的重读没有出声 ' + JSON.stringify(m.during));
  ok(m.after.length === 0, '静音：点卡片后下一题的自动朗读没有出声（以前在放行窗口里读，漏声） ' + JSON.stringify(m.after));
  ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
  await ctx.close();

  /* ── Q：完形池里剩下的词例句对不上（动物岛 pig/eagle/cow 的例句写的是复数）时，错词照样再考一次 ── */
  console.log('\n▶ Q 完形：池里剩下的都是例句对不上的词，也要先再考错词，不能直接结算');
  {
    const ctx3 = await newCtx();
    const { page: p3, errs: e3 } = await openIsland(ctx3, 'island_animal.html');
    const q = await p3.evaluate(async () => {
      startCloze(); startClozeLevel('easy');
      /* v1165：完形现在也会挖例句里的变形（Pigs / Cows），「出不了题」以页面自己的找空函数为准 */
      const fits = i => { const w = allW[i]; if (typeof window.__hsnClozeMatch === 'function') return !!window.__hsnClozeMatch(w); return !!(w && w.ex && new RegExp('\\b' + w.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(w.ex)); };
      let bad = CLOZE_LEVEL_IDX.easy.filter(i => i !== clozeQ.idx && !fits(i));
      let real = bad.length > 0;
      if (!real) { const j = CLOZE_LEVEL_IDX.easy.find(i => i !== clozeQ.idx); allW[j].ex = ''; bad = [j]; }   // 数据哪天改好了：造一个同样的情况
      clozePool.length = 0; clozePool.push(bad[0]);
      const miss = clozeQ.word;
      document.querySelectorAll('#clozeScreen .cloze-opt')[clozeQ.opts.findIndex(o => o.en !== miss.en)].click();
      await __w(__card, 3000); __tapCard();
      await new Promise(r => setTimeout(r, 300));
      const res = { real, badWord: allW[bad[0]].en, miss: miss.en, active: !!clozeActive, q: clozeQ && clozeQ.word.en, retry: !!(clozeQ && HansenMistakeLesson.isRetry('cloze', clozeQ.idx)) };
      stopCloze(); showScreen('home');
      return res;
    });
    ok(q.active && q.q === q.miss && q.retry, `完形：剩下的「${q.badWord}」出不了题时，先把错词「${q.miss}」再考一次（${q.real ? '真实数据' : '造的数据'}）` + JSON.stringify(q));
    ok(e3.length === 0, '页面无报错 ' + e3.join(' | '));
    await ctx3.close();
  }

  /* ── A：同一批词的两个入口（单词大陆③ = 星海第 61~90 词）：一边改了，另一边回来看到同一个状态 ── */
  console.log('\n▶ A 单词大陆③答错 → 星海答对 → 回到单词大陆③：错题本和复习计划都跟星海一致');
  {
    const ctx4 = await newCtx();
    const page4 = await ctx4.newPage();
    const k = 5;
    await openIsland(ctx4, 'island_land3.html', page4);
    const a = await page4.evaluate(k => { markAnswer(k, false); return { ci: HansenCanonical.toCanonicalIndex(HansenCanonical.currentRef(), k), en: allW[k].en }; }, k);
    await openIsland(ctx4, 'island_season.html', page4);
    const b = await page4.evaluate(({ ci, en }) => {
      const li = HansenCanonical.fromCanonicalIndex(HansenCanonical.currentRef(), ci);
      const seen = { same: !!allW[li] && allW[li].en === en, wrong: S.wrongs[li] || 0, box: S.srs[li] ? S.srs[li].box : null };
      markAnswer(li, true);
      return { li, seen, after: { wrong: S.wrongs[li] || 0, box: S.srs[li] ? S.srs[li].box : null } };
    }, a);
    await page4.waitForTimeout(1200);
    await openIsland(ctx4, 'island_land3.html', page4);
    const c = await page4.evaluate(k => ({ wrong: S.wrongs[k] || 0, box: S.srs[k] ? S.srs[k].box : null }), k);
    await openIsland(ctx4, 'island_season.html', page4);
    const d = await page4.evaluate(li => ({ wrong: S.wrongs[li] || 0, box: S.srs[li] ? S.srs[li].box : null }), b.li);
    ok(b.seen.same && b.seen.wrong === 1 && b.seen.box === 0, '星海看得到在单词大陆③答错的词（错题本 1、计划盒0） ' + JSON.stringify(b.seen));
    ok(b.after.wrong === 0 && b.after.box === 1, '星海答对：错题本清零、计划升到盒1 ' + JSON.stringify(b.after));
    ok(c.wrong === 0 && c.box === 1, '回到单词大陆③：错词没被它自己的旧存档冲回来，计划还是盒1（以前错题 1、盒0） ' + JSON.stringify(c));
    ok(d.wrong === 0 && d.box === 1, '再回星海：仍是错题本 0、盒1（没被单词大陆③带坏） ' + JSON.stringify(d));
    ok(page4.__errs.length === 0, '页面无报错 ' + page4.__errs.join(' | '));
    await ctx4.close();
  }

  /* ── G：一个词只发一次毕业金（时间真的往后走：整页 Date 一起拨） ── */
  console.log('\n▶ G 错题本早就清零的词，到「今日复习」自评毕业时不再发第二份 +15');
  {
    const ctx2 = await newCtx();
    const page2 = await ctx2.newPage();
    const I = 4, J = 6;
    const day = async (n) => { await page2.evaluate(n => sessionStorage.setItem('__dayOff', String(n)), n).catch(() => {}); return openIsland(ctx2, 'island_animal.html', page2); };
    await page2.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
    await day(0);
    await page2.evaluate(([i, j]) => { markAnswer(i, false); markAnswer(j, false); }, [I, J]);
    await day(1);
    const d1 = await page2.evaluate(i => { markAnswer(i, true); return { wrong: S.wrongs[i] || 0, plan: S.srs[i] || null }; }, I);
    ok(d1.wrong === 0 && d1.plan && d1.plan.box === 1, '第 1 天：隔天答对 → 错题本清零（发 +15），词还在复习计划里 ' + JSON.stringify(d1));
    await day(2);
    const g = await page2.evaluate(async ([i, j]) => {
      // 直接把两个词拨到「盒4、今天到期、在玩法里真答对过(rp)」——等于又过了 28 天
      [i, j].forEach(k => { const e = { box: 4, due: __ymd(0), last: __ymd(-1), rp: 1 }; HansenCanonical.setCurrentSrs(k, e); S.srs[k] = e; });
      save();
      HansenReview._openToday();
      for (let step = 0; step < 12; step++) {
        const el = document.getElementById('hr_today'); if (!el || /今日复习完成/.test(el.textContent || '')) break;
        const got = el.querySelector('#ht_b_got'), show = el.querySelector('#ht_b_show');
        if (got) got.click(); else if (show) show.click(); else break;
        await new Promise(r => setTimeout(r, 120));
      }
      const W = HansenCoins, slot = k => __hsnReviewSlot(k), grads = k => {
        const out = []; for (let n = -3; n <= 0; n++) { const id = 'rvrw:' + __ymd(n) + ':' + slot(k) + ':grad'; if (W.hasAward(id)) out.push(__ymd(n)); } return out;
      };
      const patrol = JSON.parse(localStorage.getItem('hansen_review_patrol_v963') || '{}');
      return { gi: grads(i), gj: grads(j), today: __ymd(0), d1: __ymd(-1), planI: S.srs[i] || null, planJ: S.srs[j] || null,
        patrolI: patrol[slot(i)] || null, patrolJ: patrol[slot(j)] || null, in30: __ymd(30) };
    }, [I, J]);
    ok(g.planI === null && g.planJ === null, '第 2 天：两个词都在今日复习里自评毕业了');
    ok(g.gi.length === 1 && g.gi[0] === g.d1, `早就清零的词：毕业金只在清零那天发过一次（收据日期 ${JSON.stringify(g.gi)}）`);
    ok(g.gj.length === 1 && g.gj[0] === g.today, `毕业时还在错题本里的词：照常发 +15（收据日期 ${JSON.stringify(g.gj)}）`);
    ok(g.patrolI && g.patrolI.stage === 1 && g.patrolI.due === g.in30, '早就清零的词：没发毕业金也照样进 30 天巡检 ' + JSON.stringify(g.patrolI));
    ok(g.patrolJ && g.patrolJ.stage === 1 && g.patrolJ.due === g.in30, '还在错题本里的词：发毕业金 + 进 30 天巡检 ' + JSON.stringify(g.patrolJ));
    ok(page2.__errs.length === 0, '页面无报错 ' + page2.__errs.join(' | '));
    await ctx2.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 复查修复：再考不算纠错 / 极速不白丢分 / 听音不多记 / 完形读整句 / 离开就收卡 / 毕业金只发一次 全过');
