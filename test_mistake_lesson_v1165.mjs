/* test_mistake_lesson_v1165.mjs —— 答错也变成一节小课（真浏览器、真游戏函数）
 *
 * 以前：答对有大卡片+再读一遍；答错只有 1.6 秒红绿框和「💔 N 连胜被中断」，不显示英文、不读，
 *       结算页也不列错词。泡泡消消乐答错时还把「错」记到了点错的干扰词上，真正的错词进不了错题本。
 *
 * 合同（每个有「答错」的小游戏都要）：
 *   L 答错 → 出揭晓卡（英文+中文+「再听一遍 👂」），点一下就进下一题
 *   Q 本轮题做完 → 错词再考一次（只一次），那一题不算进得分/命数/正确率
 *   R 结算页列出错词（带 🔊）+「练这 N 个词」→ 打开只练这几个词的复习中心
 *   另外：连胜断掉不再说「被中断」；泡泡答错记到目标词上；极速 60 秒小课期间不扣时间
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

async function openIsland(file) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && document.readyState !== 'loading' && typeof startListen === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click();
    // 页内工具：等条件、读小课卡、点掉小课
    window.__w = (fn, ms = 9000) => new Promise((res) => { const t0 = Date.now(); (function loop() { let v = false; try { v = fn(); } catch (e) {} if (v) return res(v); if (Date.now() - t0 > ms) return res(false); setTimeout(loop, 60); })(); });
    window.__card = () => { const el = document.getElementById('hml_lesson'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
    window.__isRetry = (m, i) => !!(window.HansenMistakeLesson && HansenMistakeLesson.isRetry(m, i));
    window.__tapCard = () => { const el = document.getElementById('hml_lesson'); if (el) el.click(); return !!el; };
  });
  return { ctx, page, errs };
}

/* 每个游戏一个「驱动」：开最小的一轮(2 题)，第 1 题故意答错，其余答对；返回检查要用的数据 */
const DRIVERS = {
  listen: async () => {
    startListen(); startListenLevel('easy');
    _shuffledPools['listen_easy'] = _shuffledPools['listen_easy'].slice(-1);
    const miss = listenQ.word; const wrongI = listenQ.opts.findIndex(o => o.cn !== miss.cn);
    document.querySelectorAll('#listenScreen .boss-opt')[wrongI].click();
    const card = await __w(__card, 2000); __tapCard();
    const seen = [];
    for (let k = 0; k < 4 && listenActive; k++) {
      await __w(() => listenQ && !listenQ.answered, 6000);
      seen.push({ en: listenQ.word.en, retry: __isRetry('listen', listenQ.idx) });
      document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o => o.cn === listenQ.word.cn)].click();
      await __w(() => !listenActive || (listenQ && !listenQ.answered), 7000);
    }
    return { miss: miss.en, card, seen, score: { total: listenTotal, right: listenRight }, host: 'listenContent' };
  },
  cloze: async () => {
    startCloze(); startClozeLevel('easy');
    clozePool.splice(0, Math.max(0, clozePool.length - 1));
    const miss = clozeQ.word; const opts = [...document.querySelectorAll('#clozeScreen .cloze-opt')];
    opts[clozeQ.opts.findIndex(o => o.en !== miss.en)].click();
    const card = await __w(__card, 2000); __tapCard();
    const seen = [];
    for (let k = 0; k < 4 && clozeActive; k++) {
      await __w(() => { const o = document.querySelector('#clozeScreen .cloze-opt'); return o && !o.dataset.done; }, 9000);
      if (!clozeActive) break;
      seen.push({ en: clozeQ.word.en, retry: __isRetry('cloze', clozeQ.idx) });
      document.querySelectorAll('#clozeScreen .cloze-opt')[clozeQ.opts.findIndex(o => o.en === clozeQ.word.en)].click();
      await __w(() => !clozeActive || !document.querySelector('#clozeScreen .cloze-opt[data-done]'), 9000);
    }
    return { miss: miss.en, card, seen, score: { done: clozeDone, total: clozeTotal }, host: 'clozeContent' };
  },
  moles: async () => {
    startMoles(); startMolesLevel('easy');
    molesPool.splice(0, Math.max(0, molesPool.length - 2));   // 第一波还没出：留 2 题
    await __w(() => molesTarget && document.querySelector('#molesGrid .mole-card'), 4000);
    const miss = molesTarget, lives0 = molesLives;
    const slots = [...document.querySelectorAll('[id^="moleSlot"]')];
    molesClick(slots.findIndex(s => s.dataset.en && s.dataset.en !== miss.en));
    const card = await __w(__card, 2000); const lives1 = molesLives; __tapCard();
    const seen = [];
    for (let k = 0; k < 4 && molesActive; k++) {
      await __w(() => !molesActive || (molesTarget && [...document.querySelectorAll('[id^="moleSlot"]')].some(s => s.dataset.en === molesTarget.en && !s.dataset.locked)), 5000);
      if (!molesActive) break;
      const retry = __isRetry('moles', allW.indexOf(molesTarget));
      const before = { score: molesScore, lives: molesLives };
      if (retry) {   // 再考题答错也不扣命
        const s2 = [...document.querySelectorAll('[id^="moleSlot"]')];
        molesClick(s2.findIndex(s => s.dataset.en && s.dataset.en !== molesTarget.en));
        await __w(__card, 2000); seen.push({ en: molesTarget.en, retry, livesKept: molesLives === before.lives }); __tapCard();
        continue;
      }
      seen.push({ en: molesTarget.en, retry });
      const s2 = [...document.querySelectorAll('[id^="moleSlot"]')];
      molesClick(s2.findIndex(s => s.dataset.en === molesTarget.en));
      await new Promise(r => setTimeout(r, 1100));
    }
    return { miss: miss.en, card, seen, lives: [lives0, lives1], score: { hit: molesHit, score: molesScore }, host: 'molesContent' };
  },
  bubble: async () => {
    startBubble(); startBubbleLevel('easy');
    bubblePool.splice(0, Math.max(0, bubblePool.length - 1));
    await __w(() => document.querySelector('#bbArea .bubble'), 3000);
    const miss = bubbleTarget, wrongB = [...document.querySelectorAll('#bbArea .bubble')].find(b => b.dataset.en !== miss.en);
    const wrongEn = wrongB.dataset.en, wrongIdx = allW.findIndex(w => w.en === wrongEn);
    /* 只看这一次答错让两个词各多了几次。同一页前面几个游戏答错的词（再考不清错题本）可能正好就是这里的
       目标词或干扰词，直接比绝对数会时过时不过（复查时实测 distractor=2、target=3） */
    const before = { target: S.wrongs[allW.indexOf(miss)] || 0, distractor: S.wrongs[wrongIdx] || 0 };
    wrongB.click();
    const card = await __w(__card, 2000);
    const marks = { target: (S.wrongs[allW.indexOf(miss)] || 0) - before.target, distractor: (S.wrongs[wrongIdx] || 0) - before.distractor };
    __tapCard();
    const seen = [];
    for (let k = 0; k < 4 && bubbleActive; k++) {
      const b = await __w(() => !bubbleActive || [...document.querySelectorAll('#bbArea .bubble')].find(x => bubbleTarget && x.dataset.en === bubbleTarget.en && !x.dataset.done), 6000);
      if (!bubbleActive || !b) break;
      seen.push({ en: bubbleTarget.en, retry: __isRetry('bubble', allW.indexOf(bubbleTarget)) });
      b.click();
      await __w(() => !bubbleActive || !document.querySelector('#bbArea .big-bubble'), 7000);
      await new Promise(r => setTimeout(r, 300));
    }
    return { miss: miss.en, card, seen, marks, score: { done: bubbleDone, score: bubbleScore }, host: 'bubbleContent' };
  },
  scramble: async () => {
    startScramble(); startScrambleLevel('easy');
    scrPool.length = 2; scrTotal = 2;
    const miss = scrWord;
    const letters = [...document.querySelectorAll('.scramble-letter')];
    // 故意拼错：先点一个不是首字母的字母，其余照摆放顺序点。
    // （以前「倒着点」：字母正好倒着摆时反而拼对了 —— dog 摆成 g·o·d，倒着点就是 dog，测试五六次里假红一次）
    const first = miss.en.replace(/ /g, '')[0];
    const wrongFirst = letters.findIndex(l => l.textContent !== first);
    (wrongFirst >= 0 ? [letters[wrongFirst], ...letters.filter((_, i) => i !== wrongFirst)] : letters).forEach(l => l.click());
    const card = await __w(__card, 2000); __tapCard();
    const seen = [];
    for (let k = 0; k < 6 && scrIdx < scrPool.length; k++) {
      await __w(() => document.querySelector('.scramble-letter') && !document.querySelector('.scramble-letter.used'), 4000);
      const w = scrWord; seen.push({ en: w.en, retry: __isRetry('scramble', scrPool[scrIdx]) });
      const target = w.en.replace(/ /g, '').split('');
      for (const ch of target) { const el = [...document.querySelectorAll('.scramble-letter')].find(l => !l.classList.contains('used') && l.textContent === ch); if (el) el.click(); }
      await new Promise(r => setTimeout(r, 1400));
    }
    return { miss: miss.en, card, seen, score: { correct: scrCorrect, total: scrTotal }, host: 'scrambleContent' };
  },
  typing: async () => {
    startTyping(1);
    typePool.length = 2;
    const miss = typeWord;
    for (const ch of miss.en.toLowerCase()) typeKey(ch === 'z' ? 'q' : 'z');
    const card = await __w(__card, 2000); __tapCard();
    const seen = [];
    for (let k = 0; k < 4; k++) {
      await __w(() => typeActive && typeWord && typeInput === '', 4000);
      if (!document.getElementById('typeSlots')) break;
      seen.push({ en: typeWord.en, retry: __isRetry('typing', typePool[typeIdx]) });
      for (const ch of typeWord.en.toLowerCase()) { if (ch !== ' ') typeKey(ch); }
      await new Promise(r => setTimeout(r, 1200));
    }
    return { miss: miss.en, card, seen, score: { done: typeDone, times: typeWordTimes.length }, host: 'typingContent' };
  },
  eagle: async () => {
    startEagle(); startEagleLevel('easy');
    eaglePool.splice(0, Math.max(0, eaglePool.length - 2)); eagleTotal = 2;   // 第一题还没出：留 2 题
    await __w(() => document.querySelector('#eagleGrid .eagle-cell') && eagleTarget, 3000);
    const miss = eagleTarget;
    const cells = [...document.querySelectorAll('#eagleGrid .eagle-cell')];
    eagleClick(cells.findIndex(c => c.textContent !== miss.en), 0);
    const card = await __w(__card, 2000); __tapCard();
    const seen = [];
    for (let k = 0; k < 4 && eagleActive; k++) {
      await __w(() => !eagleActive || [...document.querySelectorAll('#eagleGrid .eagle-cell')].some(c => !c.dataset.done), 4000);
      if (!eagleActive) break;
      seen.push({ en: eagleTarget.en, retry: __isRetry('eagle', allW.indexOf(eagleTarget)), round: eagleRound });
      const cs = [...document.querySelectorAll('#eagleGrid .eagle-cell')];
      eagleClick(cs.findIndex(c => c.textContent === eagleTarget.en), 1);
      await new Promise(r => setTimeout(r, 1000));
    }
    return { miss: miss.en, card, seen, score: { score: eagleScore, round: eagleRound, total: eagleTotal }, host: 'eagleContent' };
  },
};

async function runGame(page, name) {
  const r = await page.evaluate(`(${DRIVERS[name].toString()})()`);
  r.card = String(r.card || '');
  await page.waitForTimeout(500);
  const after = await page.evaluate((host) => {
    const el = document.getElementById(host);
    const res = el && el.querySelector('.hml-result');
    return { result: res ? res.textContent.replace(/\s+/g, ' ').trim() : '', go: !!(res && res.querySelector('[data-hml-practice]')), say: res ? res.querySelectorAll('[data-hml-say]').length : 0 };
  }, r.host);
  console.log(`\n▶ ${name}：错词 ${r.miss}`);
  ok(r.card.includes(r.miss) && /再听一遍 👂/.test(r.card), `L ${name} 答错出揭晓卡（英文+「再听一遍 👂」）: ${r.card}`);
  const retries = r.seen.filter(s => s.retry);
  ok(retries.length === 1 && retries[0].en === r.miss, `Q ${name} 本轮末把错词再考一次（只一次）: ${JSON.stringify(r.seen)}`);
  ok(after.result.includes(r.miss) && after.go && after.say >= 1, `R ${name} 结算页列出错词 + 🔊 + 「练这 N 个词」: ${after.result}`);
  return { r, after };
}

try {
  // ===== 常规岛：全部小游戏 =====
  const A = await openIsland('island_animal.html');
  const res = {};
  for (const g of Object.keys(DRIVERS)) res[g] = await runGame(A.page, g);
  // 再考题不算分 / 不扣命
  ok(res.listen.r.score.total === 2 && res.listen.r.score.right === 1, '听音：再考题不算进正确率 (答对 1/2) ' + JSON.stringify(res.listen.r.score));
  ok(res.cloze.r.score.done === 1, '完形：再考题不算进「答对」 ' + JSON.stringify(res.cloze.r.score));
  ok(res.moles.r.lives[1] === res.moles.r.lives[0] - 1, '地鼠：第一次答错照常扣 1 命');
  ok(res.moles.r.score.hit === 1 && res.moles.r.score.score === 10, '地鼠：再考题不加分 ' + JSON.stringify(res.moles.r.score));
  ok(res.bubble.r.marks.target === 1 && res.bubble.r.marks.distractor === 0, '泡泡：答错记到没认出的目标词上(+1)，干扰词不变(+0) ' + JSON.stringify(res.bubble.r.marks));
  ok(res.bubble.r.score.done === 1, '泡泡：再考题不算进完成数 ' + JSON.stringify(res.bubble.r.score));
  /* 🔴v1165 复查第 2 轮（R2-G1）改了这条的期望：拼错以后同一题马上回来、照着刚看的答案拼对 = 「看过答案再答」，
     和本轮末再考一样不算进答对（以前算 1 个：故意拼错一次再拼对，正确率照样 100%、算完美通关，还白拿复习奖励）。
     现在只有另一题第一次就拼对的那 1 个算数 */
  ok(res.scramble.r.score.correct === 1, '拼词：原地重拼、本轮末再考都不算答对，只有另一题第一次拼对的算 (=1) ' + JSON.stringify(res.scramble.r.score));
  ok(res.typing.r.score.done === 1 && res.typing.r.score.times === 1, '打字：再考题不进速度纪录 ' + JSON.stringify(res.typing.r.score));
  ok(res.eagle.r.score.round === 2 && res.eagle.r.score.total === 2, '火眼金睛：再考题不让题号超过总题数 ' + JSON.stringify(res.eagle.r.score));

  // 「练这 N 个词」→ 复习中心只练这几个词
  const practice = await A.page.evaluate(async () => {
    document.querySelector('#eagleContent [data-hml-practice]').click();
    await new Promise(r => setTimeout(r, 500));
    const c = document.getElementById('hr_center');
    const ctx = window._huReviewContext;
    const out = { open: !!c, title: ctx && ctx.title, n: ctx && ctx.wrongsList.length, text: c ? c.textContent.replace(/\s+/g, ' ').slice(0, 120) : '' };
    if (window.HansenReview && HansenReview._close) HansenReview._close();
    return out;
  });
  ok(practice.open && practice.title === '练这 1 个词' && practice.n === 1, '「练这 1 个词」打开只含这个词的复习中心 ' + JSON.stringify(practice));

  // 连胜断掉的文案
  const combo = await A.page.evaluate(async () => {
    showScreen('home');
    window._comboCount = 4; comboMiss();
    await new Promise(r => setTimeout(r, 120));
    const t = [...document.querySelectorAll('.combo-num')].map(e => e.textContent).join('|');
    return t;
  });
  ok(!/被中断|💔/.test(combo) && /刚才连对 4 个/.test(combo), '连胜断掉不说「💔 被中断」: ' + combo);

  // 极速 60 秒：小课期间不扣时间
  const speed = await A.page.evaluate(async () => {
    startSpeed(); startSpeedLevel('easy');
    await new Promise(r => setTimeout(r, 300));
    const t0 = spTime;
    const wi = window._spOpts.findIndex(o => o.en !== window._spCorrect);
    spAnswer(wi);
    const card = await __w(__card, 2000);
    await new Promise(r => setTimeout(r, 2100));
    const t1 = spTime;
    const res = { card: !!card, t0, t1, queued: spPool2.slice(-3).includes(window._spIdx) || __isRetry('speed', window._spIdx) };
    stopSpeed(); showScreen('home');
    return res;
  });
  ok(speed.card && speed.t1 >= speed.t0 - 1, '极速：答错出小课，小课期间时间不往下扣 ' + JSON.stringify(speed));
  ok(speed.queued, '极速：错词过几题再考一次');
  ok(A.errs.length === 0, '常规岛页面无报错 ' + A.errs.join(' | '));
  await A.ctx.close();

  // ===== 单词大陆：抽两个玩法 =====
  const B = await openIsland('island_land2.html');
  await runGame(B.page, 'listen');
  await runGame(B.page, 'moles');
  ok(B.errs.length === 0, '单词大陆页面无报错 ' + B.errs.join(' | '));
  await B.ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 答错小课：揭晓卡+重读 / 本轮末再考一次 / 结算列错词 / 温和文案 全过');
