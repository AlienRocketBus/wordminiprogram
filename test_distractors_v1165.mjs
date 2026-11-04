/* test_distractors_v1165.mjs —— 完形填空 / 听音辨义的选项里不会同时出现两个意思一样的词
 *
 * v1163：同档里抽干扰项只按英文去重。星海里有几组近义词（however/nevertheless、therefore/consequently、
 *        besides/moreover/furthermore、rarely/seldom、immediately/instantly、finally/eventually、huge/enormous），
 *        一抽到就会出现两个都对的选项（完形）或两个一样的中文（听音），孩子选了另一个也被判错。
 * 合同：
 *   ① island_season：以这 15 个词为答案，各出 20 道完形 + 20 道听音（共 600 道），选项里从不出现同组近义词、
 *      也没有中文义项相同的两个选项
 *   ② 常规岛（动物）完形、听音照样每题 4 个选项
 *   ③ 常规岛里意思挨得太近的一对（dress/skirt、cook/do、fly/ride）也不同时当选项（复查 C3 / C5）
 *   ④ Boss 完形（从全岛 67 个动作词里抽干扰项）：金色提示写着「做」的「My dad ___ dinner」不出 make（做/制作）、do；
 *      提示「坐过」的「Have you ever ___ on a plane?」不出 sit（坐）、be（been on a plane）、ride（复查第 2 轮 C-R2-3）
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
async function newCtx(vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true });
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  return ctx;
}
async function open(ctx, file, ready = "typeof showScreen === 'function'") {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(new Function("return document.readyState !== 'loading' && " + ready), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} });
  return { page, errs };
}

const GROUPS = [['however', 'nevertheless'], ['therefore', 'consequently'], ['besides', 'moreover', 'furthermore'], ['rarely', 'seldom'], ['immediately', 'instantly'], ['finally', 'eventually'], ['huge', 'enormous']];
try {
  const ctx = await newCtx();
  const { page, errs } = await open(ctx, 'island_season.html', "typeof startCloze === 'function' && typeof nextListenQ === 'function'");
  const r = await page.evaluate(GROUPS => {
    window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
    const grp = {}; GROUPS.forEach((g, n) => g.forEach(w => { grp[w] = n + 1; }));
    const senses = w => String(w.cn || '').split(/[\/;；]/).map(s => s.trim()).filter(Boolean);
    const clash = (a, b) => a.en !== b.en && ((grp[a.en] && grp[a.en] === grp[b.en]) || a.cn === b.cn || senses(a).some(s => senses(b).includes(s)));
    const bad = []; let n = 0, missing = [];
    const check = (kind, opts) => { n++; for (let x = 0; x < opts.length; x++) for (let y = x + 1; y < opts.length; y++) if (clash(opts[x], opts[y])) bad.push(kind + ': ' + opts[x].en + ' / ' + opts[y].en); if (opts.length !== 4) bad.push(kind + ': ' + opts.length + ' 个选项'); };
    for (const w of GROUPS.flat()) {
      const i = allW.findIndex(x => x.en === w);
      if (i < 0) { missing.push(w); continue; }
      const cl = Object.keys(CLOZE_LEVEL_IDX).find(k => CLOZE_LEVEL_IDX[k].includes(i));
      const ll = Object.keys(LISTEN_LEVEL_IDX).find(k => LISTEN_LEVEL_IDX[k].includes(i));
      for (let t = 0; t < 20; t++) {
        if (cl) { startCloze(); startClozeLevel(cl); clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ(); if (clozeQ && clozeQ.word.en === w) check('完形 ' + w, clozeQ.opts); }
        if (ll) { startListen(); startListenLevel(ll); _shuffledPools['listen_' + ll] = [i]; listenActive = true; nextListenQ(); if (listenQ && listenQ.word.en === w) check('听音 ' + w, listenQ.opts); }
      }
    }
    showScreen('home');
    return { bad, n, missing };
  }, GROUPS);
  ok(r.missing.length === 0 && r.n >= 580, `① 出了 ${r.n} 道（找不到的词：${r.missing.join(',') || '无'}）`);
  ok(r.bad.length === 0, '① 选项里没有同组近义词、没有中文意思相同的两个选项' + (r.bad.length ? '（' + r.bad.length + ' 次）\n     ' + [...new Set(r.bad)].slice(0, 12).join('\n     ') : ''));
  ok(errs.length === 0, '① 页面无报错 ' + errs.join(' | '));
  await page.close();

  const B = await open(ctx, 'island_animal.html', "typeof startCloze === 'function'");
  const c = await B.page.evaluate(() => {
    window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
    const counts = [];
    for (let t = 0; t < 40; t++) {
      startCloze(); startClozeLevel(['easy', 'medium', 'hard'][t % 3]); counts.push(clozeQ ? clozeQ.opts.length : 0);
      startListen(); startListenLevel(['easy', 'medium', 'hard'][t % 3]); counts.push(listenQ ? listenQ.opts.length : 0);
    }
    showScreen('home');
    return counts;
  });
  ok(c.every(x => x === 4), '② 动物岛完形、听音每题都是 4 个选项 ' + JSON.stringify([...new Set(c)]));
  ok(B.errs.length === 0, '② 页面无报错 ' + B.errs.join(' | '));
  await B.page.close();

  /* ③ v1165 复查（C3 / C5）：常规岛上也有「意思挨得太近」的一对，中文义项不一样，以前的去重拦不住：
       服装岛 dress（连衣裙，例句译成「红裙子」）和 skirt（裙子）；
       动作岛完形 cook（金色提示「做」）和 do（做）、fly（「坐过」飞机）和 ride（骑/乘坐）。
     以这几个词为答案各出 150 道完形 + 150 道听音，选项里从不同时出现这一对。 */
  const PAIRS = [['island_clothes.html', 'dress', 'skirt'], ['island_clothes.html', 'skirt', 'dress'],
                 ['island_action.html', 'cook', 'do'], ['island_action.html', 'fly', 'ride']];
  for (const file of [...new Set(PAIRS.map(p => p[0]))]) {
    const P = await open(ctx, file, "typeof startCloze === 'function' && typeof nextListenQ === 'function'");
    const pairs = PAIRS.filter(p => p[0] === file).map(p => p.slice(1));
    const out = await P.page.evaluate(pairs => {
      window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
      const res = [];
      for (const [ans, other] of pairs) {
        const i = allW.findIndex(x => x.en === ans);
        const cl = Object.keys(CLOZE_LEVEL_IDX).find(k => CLOZE_LEVEL_IDX[k].includes(i));
        const ll = Object.keys(LISTEN_LEVEL_IDX).find(k => LISTEN_LEVEL_IDX[k].includes(i));
        let n = 0, both = 0;
        for (let t = 0; t < 150; t++) {
          if (cl) { startCloze(); startClozeLevel(cl); clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ(); if (clozeQ && clozeQ.word.en === ans) { n++; if (clozeQ.opts.some(o => o.en === other)) both++; } }
          if (ll) { startListen(); startListenLevel(ll); _shuffledPools['listen_' + ll] = [i]; listenActive = true; nextListenQ(); if (listenQ && listenQ.word.en === ans) { n++; if (listenQ.opts.some(o => o.en === other)) both++; } }
        }
        res.push({ ans, other, cl: cl || '', ll: ll || '', n, both });
      }
      showScreen('home');
      return res;
    }, pairs);
    for (const x of out) ok(x.n >= 150 && x.both === 0, `③ ${file.replace('.html', '')}：以 ${x.ans} 为答案出了 ${x.n} 道（完形 ${x.cl || '无'} / 听音 ${x.ll || '无'}），选项里同时出现 ${x.other} ${x.both} 次`);
    ok(P.errs.length === 0, `③ ${file} 页面无报错 ` + P.errs.join(' | '));
    await P.page.close();
  }
  /* ④ v1165 复查第 2 轮（C-R2-3）：Boss 完形的干扰项从全岛抽（不分档），上一轮只管了同档的完形 / 听音。
       金色提示亮着的那几个字就是空里要填的意思：别的词的义项整个落在里面（make=做、sit=坐），填进去也说得通。
       真开一场 Boss、用真的 nextBossQ 出 200 道完形（第一下随机数固定成「完形」，题池里只放这个词）。 */
  const BOSS = [['cook', ['make', 'do']], ['fly', ['sit', 'be', 'ride']]];
  {
    const P = await open(ctx, 'island_action.html', "typeof startBoss === 'function' && typeof nextBossQ === 'function'");
    const out = await P.page.evaluate(async BOSS => {
      window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      showScreen('boss'); startBoss();
      for (let k = 0; k < 100 && !window._bossQType; k++) await sleep(100);
      await sleep(1200);
      try { const am = document.getElementById('alertModal'); if (am) am.classList.remove('show'); closeAlert(); } catch (e) {}
      const res = [];
      for (const [en, traps] of BOSS) {
        const idx = allW.findIndex(w => w.en === en); let n = 0, bad = 0; const c = {}; traps.forEach(t => c[t] = 0); let ex = null;
        for (let s = 0; s < 200; s++) {
          bossHP = bossMaxHP; heroHP = heroMaxHP; bossRageMode = true;
          const R = Math.random; let q = 0; Math.random = function () { return q++ === 0 ? 0.05 : R(); };
          bossPool.length = 0; bossPool.push(idx); window._bossQType = null;
          const bo = document.getElementById('bossOpts'); if (bo) { bo.innerHTML = ''; bo.dataset.done = '1'; }
          try { nextBossQ(); } catch (e) {} finally { Math.random = R; }
          if (window._bossQType !== 'cloze' || !window._bossWord || window._bossWord.en !== en) continue;
          n++; const o = window._bossOpts.map(x => x.en); let hit = false;
          traps.forEach(t => { if (o.includes(t)) { c[t]++; hit = true; } });
          if (hit) { bad++; if (!ex) ex = document.getElementById('bossQ').textContent.replace(/\s+/g, ' ').trim() + ' → ' + o.join('/'); }
        }
        res.push({ en, n, bad, c, ex });
      }
      try { stopBoss(); } catch (e) {}
      showScreen('home');
      return res;
    }, BOSS);
    for (const x of out) ok(x.n >= 150 && x.bad === 0, `④ Boss 完形 ${x.en}：出了 ${x.n} 道，选项里出现 ${Object.keys(x.c).join(' / ')} ${x.bad} 次 ${JSON.stringify(x.c)}${x.ex ? '（例：' + x.ex + '）' : ''}`);
    ok(P.errs.length === 0, '④ 页面无报错 ' + P.errs.join(' | '));
    await P.page.close();
  }
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 选项里不再同时出现近义词');
