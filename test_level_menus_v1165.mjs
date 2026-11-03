/* test_level_menus_v1165.mjs —— 难度菜单说真话：没词的档画成 🔒、单词大陆每档都有词、例词和题数是真的
 *
 * v1163：
 *   · 只有火眼金睛会把 0 个词的难度画成灰色 🔒；打地鼠/钓鱼/泡泡/字母拼拼乐/完形/打字的 0 词档看着能玩，点了只弹提示。
 *   · 单词大陆的词都偏长，打地鼠/钓鱼/泡泡/字母拼拼乐/火眼金睛按「≤4 / 5–6 / ≥7 个字母」分档 → 初级只有 0–2 个词。
 *   · 泡泡菜单写死「每档大约 20 词左右」；字母拼拼乐的例词写死「man · cat · cow」（大多数岛根本没有这些词）。
 *
 * 合同：
 *   ① 27 个岛、8 个有难度菜单的玩法：0 个词的档是灰色 🔒、没有点击；有词的档能点
 *   ② 单词大陆 8 个岛：打地鼠/钓鱼/泡泡/字母拼拼乐/火眼金睛每档至少 5 个词，三档合起来正好是本岛 30 个词
 *   ③ 页面上没有「大约 20 词」；字母拼拼乐的例词都是本岛、本档的词
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
const files = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f)).sort();

// ③ 静态：生成出来的页面里没有写死的「大约 20 词」
const stale = files.filter(f => /大约\s*20\s*词/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
ok(stale.length === 0, `③ 27 个岛页里没有「大约 20 词」（还有的：${stale.join(',') || '无'}）`);

const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });

try {
  const lockProblems = [], landProblems = [], exProblems = [];
  let lockedSeen = 0;
  for (const f of files) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + f, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState !== 'loading' && typeof startEagle === 'function' && typeof showTypingMenu === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      try { closeAlert(); } catch (e) {}
      const idx = [...Array(allW.length).keys()];
      const games = [
        { g: 'listen', open: () => startListen(), box: 'listenContent', fn: 'startListenLevel', counts: () => Object.keys(LISTEN_LEVELS).map(k => [LISTEN_LEVELS[k].name, LISTEN_LEVEL_IDX[k].length]) },
        { g: 'cloze', open: () => startCloze(), box: 'clozeContent', fn: 'startClozeLevel', counts: () => ['easy', 'medium', 'hard'].map(k => [CLOZE_LEVELS[k].name, CLOZE_LEVEL_IDX[k].length]) },
        { g: 'typing', open: () => showTypingMenu(), box: 'typingContent', fn: 'startTyping', counts: () => [1, 2, 3].map(k => [TYPING_LEVELS[k].name, idx.filter(TYPING_LEVELS[k].filter).length]) },
        { g: 'moles', open: () => startMoles(), box: 'molesContent', fn: 'startMolesLevel', counts: () => ['easy', 'medium', 'hard'].map(k => [MOLES_LEVELS[k].name, idx.filter(MOLES_LEVELS[k].filter).length]) },
        { g: 'fish', open: () => startFish(), box: 'fishContent', fn: 'startFishLevel', counts: () => ['easy', 'medium', 'hard'].map(k => [FISH_LEVELS[k].name, idx.filter(FISH_LEVELS[k].filter).length]) },
        { g: 'bubble', open: () => startBubble(), box: 'bubbleContent', fn: 'startBubbleLevel', counts: () => ['easy', 'medium', 'hard'].map(k => [BUBBLE_LEVELS[k].name, idx.filter(BUBBLE_LEVELS[k].filter).length]) },
        { g: 'scramble', open: () => startScramble(), box: 'scrambleContent', fn: 'startScrambleLevel', counts: () => ['easy', 'medium', 'hard'].map(k => [SCRAMBLE_LEVELS[k].name, idx.filter(SCRAMBLE_LEVELS[k].filter).length]) },
        { g: 'eagle', open: () => startEagle(), box: 'eagleContent', fn: 'startEagleLevel', counts: () => ['easy', 'medium', 'hard'].map(k => [EAGLE_LEVELS[k].name, idx.filter(EAGLE_LEVELS[k].filter).length]) },
      ];
      const out = [];
      for (const G of games) {
        G.open();
        const box = document.getElementById(G.box);
        const tappable = [...box.querySelectorAll('[onclick^="' + G.fn + '("]')];
        const cards = [...box.querySelectorAll('div')].filter(d => d.parentElement && /^(初级|中级|高级)/.test((d.querySelector('div > div') || {}).textContent || '') === false);
        for (const [name, n] of G.counts()) {
          const tap = tappable.find(d => (d.textContent || '').includes(name));
          // 灰卡：同一层里带「本岛暂时没有这个难度的单词」和 🔒、本身没有 onclick
          const locked = [...box.querySelectorAll('div')].find(d => !d.getAttribute('onclick') && /🔒/.test(d.textContent) && /本岛暂时没有这个难度的单词/.test(d.textContent) && (d.textContent || '').includes(name) && d.querySelectorAll('div').length <= 6);
          out.push({ g: G.g, name, n, tap: !!tap, locked: !!locked });
        }
        showScreen('home');
      }
      // 单词大陆：五个玩法每档的词
      const land = /island_land\d\.html/.test(location.pathname) ? ['MOLES_LEVELS', 'FISH_LEVELS', 'BUBBLE_LEVELS', 'SCRAMBLE_LEVELS', 'EAGLE_LEVELS'].map(nm => {
        const LV = window.eval(nm); const per = ['easy', 'medium', 'hard'].map(k => idx.filter(LV[k].filter));
        return { nm, sizes: per.map(p => p.length), union: new Set(per.flat()).size, n: allW.length };
      }) : null;
      // 字母拼拼乐的例词
      startScramble();
      const ex = [...document.querySelectorAll('#scrambleContent [onclick^="startScrambleLevel("]')].map(c => {
        const k = (c.getAttribute('onclick').match(/'(\w+)'/) || [])[1];
        const it = [...c.querySelectorAll('div')].find(d => /font-style:\s*italic/.test(d.getAttribute('style') || ''));
        const words = it ? it.textContent.split('·').map(s => s.trim()).filter(Boolean) : [];
        const pool = idx.filter(SCRAMBLE_LEVELS[k].filter).map(i => allW[i].en);
        return { k, words, bad: words.filter(w => !pool.includes(w)) };
      });
      showScreen('home');
      return { out, land, ex };
    });
    for (const x of r.out) {
      if (x.n === 0) { lockedSeen++; if (!x.locked || x.tap) lockProblems.push(`${f} ${x.g}·${x.name}(0 词): 🔒${x.locked} 能点${x.tap}`); }
      else if (!x.tap || x.locked) lockProblems.push(`${f} ${x.g}·${x.name}(${x.n} 词): 能点${x.tap} 🔒${x.locked}`);
    }
    if (r.land) for (const L of r.land) if (L.sizes.some(s => s < 5) || L.union !== L.n || L.sizes.reduce((a, b) => a + b, 0) !== L.n) landProblems.push(`${f} ${L.nm} ${L.sizes.join('/')} 合计覆盖 ${L.union}/${L.n}`);
    for (const e of r.ex) if (!e.words.length || e.bad.length) exProblems.push(`${f} ${e.k}: 「${e.words.join(' · ')}」 不是本档的词：${e.bad.join(',') || '（没有例词）'}`);
    if (errs.length) lockProblems.push(`${f} 页面报错 ${errs.join(' | ')}`);
    await page.close();
  }
  ok(lockedSeen > 0, `① 一共检查到 ${lockedSeen} 个 0 词的难度档`);
  ok(lockProblems.length === 0, '① 0 词的档都是灰色 🔒、点不了；有词的档都能点' + (lockProblems.length ? '\n     ' + lockProblems.slice(0, 25).join('\n     ') : ''));
  ok(landProblems.length === 0, '② 单词大陆 5 个玩法每档至少 5 个词、三档正好覆盖本岛的词' + (landProblems.length ? '\n     ' + landProblems.slice(0, 25).join('\n     ') : ''));
  ok(exProblems.length === 0, '③ 字母拼拼乐的例词都是本岛本档的词' + (exProblems.length ? '\n     ' + exProblems.slice(0, 12).join('\n     ') : ''));
} finally { await ctx.close(); await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 难度菜单：0 词档画成 🔒、单词大陆每档都有词、例词是本岛的词');
