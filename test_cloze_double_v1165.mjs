/* test_cloze_double_v1165.mjs —— 完形题不会把答案留在句子里（同一个词出现两次就挖两个空）
 *
 * 复查（v1165 第 2 轮 C-R2-4）：找空只认第一处，完形和 Boss 完形都只挖那一个：
 *   动作岛 do：「What do you do?」→「What ___ you do?」（答案还印在句子里，挖掉的还是助动词那个 do）；
 *   百宝岛 hard：「Work hard, play hard.」→「Work ___, play hard.」。
 *
 * 合同（27 个岛的每一道能出的完形题，都用真的 nextClozeQ 出一遍）：
 *   ① 挖空以后，句子里再也找不到答案那个词（原词或句子里的变形，整词、不分大小写）
 *   ② 答对以后每个空都填回句子自己的写法：整句和例句一字不差
 *   ③ Boss 完形（真开一场 Boss、真的 nextBossQ）：同一个词出现两次的那几句，题面里也找不到答案；答完填回的整句和例句一样
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
  if (/\.mp3$/.test(p)) { res.writeHead(404); return res.end(); }
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
let total = 0, doubles = 0;
const seen = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  for (const file of FILES) {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof nextClozeQ === 'function' && typeof nextBossQ === 'function' && typeof __hsnClozeMatch === 'function', null, { timeout: 30000 });
    await sleep(800);
    const r = await page.evaluate(async () => {
      try { closeAlert(); } catch (e) {}
      window.speak = function (t, r, cb) { if (typeof cb === 'function') setTimeout(cb, 0); };
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const has = (txt, f) => new RegExp('\\b' + esc(f) + '\\b', 'i').test(txt);
      const count = (txt, f) => (txt.match(new RegExp('\\b' + esc(f) + '\\b', 'gi')) || []).length;
      const out = { n: 0, leaks: [], refill: [], dbl: [] };
      for (const lv of Object.keys(CLOZE_LEVEL_IDX)) {
        for (const i of CLOZE_LEVEL_IDX[lv]) {
          const w = allW[i], cm = __hsnClozeMatch(w); if (!cm) continue;
          startCloze(); startClozeLevel(lv); clozePool.length = 0; clozePool.push(i); clozeActive = true; nextClozeQ();
          if (!clozeQ || clozeQ.word !== w) continue;
          out.n++;
          const sent = (document.querySelector('#clozeScreen .cloze-sentence') || {}).textContent || '';
          if (count(w.ex, cm.text) > 1) out.dbl.push(w.en + '|' + w.ex);
          if (has(sent, cm.text)) out.leaks.push(w.en + ' 「' + sent.replace(/\s+/g, ' ').trim() + '」');
          const k = clozeQ.opts.findIndex(o => o.en === w.en);
          try { clozeAnswer(k); } catch (e) {}
          const after = ((document.querySelector('#clozeScreen .cloze-sentence') || {}).textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
          if (after !== w.ex.replace(/\s+/g, ' ').trim()) out.refill.push(w.en + ' 「' + after + '」');
          clozeActive = false;
        }
      }
      showScreen('home');
      /* ③ Boss 完形：同一个词出现两次的那几句 */
      out.boss = [];
      if (out.dbl.length) {
        showScreen('boss'); startBoss();
        for (let k = 0; k < 100 && !window._bossQType; k++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 1200));
        try { const am = document.getElementById('alertModal'); if (am) am.classList.remove('show'); closeAlert(); } catch (e) {}
        for (const key of out.dbl) {
          const en = key.split('|')[0], idx = allW.findIndex(w => w.en === en), w = allW[idx], cm = __hsnClozeMatch(w);
          let got = null;
          for (let s = 0; s < 30 && !got; s++) {
            bossHP = bossMaxHP; heroHP = heroMaxHP; bossRageMode = true;
            const R = Math.random; let q = 0; Math.random = function () { return q++ === 0 ? 0.05 : R(); };
            bossPool.length = 0; bossPool.push(idx); window._bossQType = null;
            const bo = document.getElementById('bossOpts'); if (bo) { bo.innerHTML = ''; bo.dataset.done = '1'; }
            try { nextBossQ(); } catch (e) {} finally { Math.random = R; }
            if (window._bossQType === 'cloze' && window._bossWord === w) got = (document.getElementById('bossQ') || {}).textContent || '';
          }
          if (got === null) { out.boss.push({ en, skipped: true }); continue; }
          const leak = has(got, cm.text);
          let refill = '';
          try { const btn = document.querySelectorAll('#bossOpts .boss-opt')[window._bossCorrectIdx]; if (btn) btn.click(); } catch (e) {}
          await new Promise(r => setTimeout(r, 120));
          refill = ((document.getElementById('bossQ') || {}).textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
          out.boss.push({ en, q: got.replace(/\s+/g, ' ').trim(), leak, refill, same: refill === w.ex.replace(/\s+/g, ' ').trim() });
          bossHP = bossMaxHP; heroHP = heroMaxHP;
        }
        try { stopBoss(); } catch (e) {}
        showScreen('home');
      }
      return out;
    });
    total += r.n; doubles += r.dbl.length; r.dbl.forEach(d => seen.push(file.replace(/^island_|\.html$/g, '') + ':' + d.split('|')[0]));
    if (r.dbl.length) console.log(`    ${file}: 同一个词出现两次的完形题 ${r.dbl.join(' ； ')}`);
    ok(r.leaks.length === 0, `① ${file} 完形 ${r.n} 题：挖空后句子里找不到答案（漏了 ${r.leaks.length} 题${r.leaks.length ? '：' + r.leaks.slice(0, 2).join('；') : ''}）`);
    ok(r.refill.length === 0, `② ${file} 答对后整句和例句一字不差（不一样 ${r.refill.length} 题${r.refill.length ? '：' + r.refill.slice(0, 2).join('；') : ''}）`);
    for (const b of r.boss) {
      if (b.skipped) { ok(false, `③ ${file} Boss 完形 ${b.en} 没出成`); continue; }
      ok(!b.leak && b.same, `③ ${file} Boss 完形 ${b.en}：题面「${b.q}」找不到答案（${!b.leak}），答完填回「${b.refill}」（和例句一样 ${b.same}）`);
    }
    ok(errs.length === 0, `${file} 页面无报错 ` + errs.slice(0, 2).join(' | '));
    await page.close();
  }
  ok(total >= 1000 && doubles >= 2, `真的查了 ${total} 道完形题，其中同一个词出现两次的 ${doubles} 道（${seen.join('、')}）`);
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 完形题不会把答案留在句子里');
