/* test_board_synonyms_v1165.mjs —— 打地鼠 / 钓鱼：同一屏不会有两个意思一样的词
 *
 * 复查（v1165 第 2 轮 C-R2-2）：87e48fc「选项里不再同时出现意思一样的两个词」改了完形、听音、泡泡、Boss、极速，
 *   漏了打地鼠和钓鱼：
 *   · 打地鼠（题目英文、地鼠中文）：题目 rarely，九只地鼠里两只都写「很少」，孩子点了 seldom 那只扣一颗 ❤️（单词大陆③初级 80% 的盘面）；
 *   · 钓鱼（题目中文、鱼身上英文）：「钓出 很少」，池里同时游着 seldom。
 *
 * 合同（27 个岛 × 每一档；只看「同档里有别的词和它意思一样」的题目，用页面自己的 __hsnClash 判断）：
 *   ① 打地鼠：每个这样的题目用真的 pickNineAnimals 摆 100 盘，没有一盘出现和题目意思一样的地鼠
 *   ② 钓鱼：每个这样的题目用真的 spawnOneFish 放 60 条鱼，没有一条干扰鱼和题目意思一样
 *   ③ 换题时池里还游着的鱼，和新题意思一样的先收走（上一题的 seldom 不留给「钓出 很少」）
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
  if (/\.mp3$/.test(p)) { res.writeHead(404); return res.end(); }   // 这里不听声音
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
const FILES = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f)).sort();
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
let molesTargets = 0, fishTargets = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  for (const file of FILES) {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof pickNineAnimals === 'function' && typeof spawnOneFish === 'function' && typeof __hsnClash === 'function', null, { timeout: 30000 });
    await sleep(600);
    const r = await page.evaluate(async () => {
      try { closeAlert(); } catch (e) {}
      window.speak = function () {};
      const keys = [...Array(allW.length).keys()], out = { moles: [], fish: [], stale: null };
      const clashIn = (lvIdx, t) => lvIdx.some(i => allW[i].en !== t.en && __hsnClash(t, allW[i]));
      /* ① 打地鼠 */
      for (const lv of Object.keys(MOLES_LEVELS)) {
        const idx = keys.filter(MOLES_LEVELS[lv].filter);
        molesLevel = lv;
        for (const ti of idx) {
          const t = allW[ti]; if (!clashIn(idx, t)) continue;
          let bad = 0, ex = null;
          for (let n = 0; n < 100; n++) { const b = pickNineAnimals(t); const hit = b.find(a => a.en !== t.en && __hsnClash(t, a)); if (hit) { bad++; if (!ex) ex = hit.en + '=' + hit.cn; } }
          out.moles.push({ lv, en: t.en, cn: t.cn, bad, ex });
        }
      }
      /* ② 钓鱼：开一局，停掉自动放鱼，题目换成这个词，真调 spawnOneFish */
      for (const lv of Object.keys(FISH_LEVELS)) {
        const idx = keys.filter(FISH_LEVELS[lv].filter); if (!idx.length) continue;
        const tg = idx.filter(i => clashIn(idx, allW[i])); if (!tg.length) continue;
        startFishLevel(lv); clearTimeout(fishSpawnTimer); fishSpawnTimer = null;
        const pond = document.getElementById('fishPond');
        for (const ti of tg) {
          const t = allW[ti]; fishTarget = t; if (pond) pond.querySelectorAll('[data-en]').forEach(f => f.remove()); fishOnscreen = 0;
          let bad = 0, decoys = 0, ex = null;
          for (let n = 0; n < 60; n++) {
            spawnOneFish(); clearTimeout(fishSpawnTimer);
            const fs = pond ? [...pond.querySelectorAll('[data-en]')] : [];
            const f = fs[fs.length - 1]; if (!f) continue;
            if (f.dataset.en !== t.en) { decoys++; const w = allW.find(x => x.en === f.dataset.en); if (w && __hsnClash(t, w)) { bad++; if (!ex) ex = w.en + '=' + w.cn; } }
            if (fs.length > 6) fs.slice(0, fs.length - 3).forEach(x => { x.dataset.done = '1'; x.remove(); });
          }
          out.fish.push({ lv, en: t.en, cn: t.cn, bad, decoys, ex });
        }
        /* ③ 换题：池里放一条和下一题意思一样的鱼，再换题 */
        if (!out.stale && tg.length) {
          const t = allW[tg[0]], twin = idx.map(i => allW[i]).find(w => w.en !== t.en && __hsnClash(t, w));
          if (twin) {
            pond.querySelectorAll('[data-en]').forEach(f => f.remove()); fishOnscreen = 0;
            fishTarget = twin; spawnOneFish(); clearTimeout(fishSpawnTimer);   // 现在池里游着 twin（当前题目）
            fishPool.length = 0; fishPool.push(allW.indexOf(t)); pickFishTarget(); clearTimeout(fishSpawnTimer);
            await new Promise(r => setTimeout(r, 30));
            const left = [...pond.querySelectorAll('[data-en]')].filter(f => !f.dataset.done).map(f => f.dataset.en);
            out.stale = { from: twin.en, to: t.en, left };
          }
        }
        try { stopFish(); } catch (e) { fishActive = false; }
        showScreen('home');
      }
      return out;
    });
    const mb = r.moles.filter(x => x.bad > 0), fb = r.fish.filter(x => x.bad > 0);
    molesTargets += r.moles.length; fishTargets += r.fish.length;
    if (r.moles.length || r.fish.length)
      console.log(`    ${file}: 打地鼠 ${r.moles.length} 个题目、钓鱼 ${r.fish.length} 个题目有同档近义词` + (mb.length || fb.length ? ` → 撞车 ${[...mb.map(x => `地鼠 ${x.lv}:${x.en} ${x.bad}/100（${x.ex}）`), ...fb.map(x => `鱼 ${x.lv}:${x.en} ${x.bad}/${x.decoys}（${x.ex}）`)].slice(0, 4).join('；')}` : ''));
    ok(mb.length === 0, `① ${file} 打地鼠：同屏没有和题目意思一样的地鼠（${mb.length} 个题目撞车）`);
    ok(fb.length === 0, `② ${file} 钓鱼：干扰鱼里没有和题目意思一样的（${fb.length} 个题目撞车）`);
    if (r.stale) ok(!r.stale.left.includes(r.stale.from), `③ ${file} 换题「${r.stale.from}」→「${r.stale.to}」：池里的 ${r.stale.from} 先收走（还剩 ${JSON.stringify(r.stale.left)}）`);
    ok(errs.length === 0, `${file} 页面无报错 ` + errs.slice(0, 2).join(' | '));
    await page.close();
  }
  ok(molesTargets >= 20 && fishTargets >= 20, `真的查到了有近义词的题目（打地鼠 ${molesTargets} 个、钓鱼 ${fishTargets} 个）`);
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 打地鼠 / 钓鱼同一屏不放意思一样的两个词');
