/* test_ach_series_v1165.mjs —— 「阶梯系列」成就真的能解锁；成就墙不显示 undefined
 *
 * 事故（v1163 审计 CB-02 / MISSED#24、v1165 优化批次遗留 OD-L3、CB-08）：
 *   144 个成就里 107 个永远解锁不了 —— 它们的规则只写在模板那份 checkAch 里，而它被 hansen_island_upgrade.js
 *   整个替换掉了（真正在跑的只判 36 个）。模板那份还带两个潜伏 bug（错词清零第一个词就解锁；各玩法最高分是
 *   {easy,medium,hard} 对象却当数字比）。成就墙「复习/精通/速度/对决」四栏图标显示 undefined。
 *
 * 合同：
 *   1. 动物岛存档里 clozeRight 60、listenRight 15、typeCount 25、speedBest {easy:250}、bubbleBest {easy:60}、daysPlayed 5、
 *      matchPerfect 6、chestClaimed 6，sb_best_cpm 45 → clozeS10 clz50 listenS10 typingS20 speedS200 bubbleS50 cpm40 cpmS30
 *      dayNS3 matchpS5 chestS5 perfMatch 都进「待领取」；这一批最多弹 1 个提示
 *   2. 只学了 1 个词、从没错过的孩子：既不解锁错词清零，也不解锁攻克错词
 *   3. 静态扫描：ACHIEVEMENTS 里每个 id 在 hansen_island_upgrade.js 里都有活的解锁路径
 *   4. 食物岛、单词大陆②号岛的成就墙：分类栏里没有 undefined
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('\n▶ 3. 静态扫描：每个成就都有活的解锁路径');
{
  const tpl = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
  const i = tpl.indexOf('const ACHIEVEMENTS=[');
  let d = 0, j = i + 'const ACHIEVEMENTS='.length;
  for (; j < tpl.length; j++) { if (tpl[j] === '[') d++; else if (tpl[j] === ']') { d--; if (!d) break; } }
  const ids = [...tpl.slice(i, j + 1).matchAll(/\bid\s*:\s*'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
  const up = fs.readFileSync(path.join(ROOT, 'hansen_island_upgrade.js'), 'utf8');
  const live = new Set([...up.matchAll(/unlockAch\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]));
  const series = up.match(/var SERIES=\[([\s\S]*?)\n\s*\];/);
  if (series) for (const m of series[1].matchAll(/\['([A-Za-z0-9_]+)',/g)) live.add(m[1]);
  const dead = ids.filter(x => !live.has(x));
  ok(ids.length === 144, `成就清单 ${ids.length} 个`);
  ok(dead.length === 0, `没有永远解锁不了的成就（${dead.length} 个：${dead.slice(0, 12).join(', ')}）`);
}

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
async function open(file, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(seed => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, seed || {});
  /* 数一数「成就解锁」弹了几次 */
  await ctx.addInitScript(() => {
    window.__popups = [];
    const watch = () => new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList && n.classList.contains('ach-popup')) window.__popups.push(n.textContent); }))).observe(document.documentElement || document, { childList: true, subtree: true });
    try { watch(); } catch (e) { document.addEventListener('DOMContentLoaded', () => { try { watch(); } catch (e2) {} }); }
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'load' });
  await page.waitForFunction(() => window.S && window.HansenAch && typeof checkAch === 'function' && window.__hsnAchUpgraded, null, { timeout: 30000 });
  await sleep(1500);
  return { ctx, page, errs };
}

try {
  console.log('\n▶ 1. 有真实记录的孩子：这些成就都进待领取，只弹 1 个提示');
  {
    // 先打开一次拿到合法存档，再改 stats 写回、刷新（和真实孩子的存档同一个形状）
    let { ctx, page } = await open('island_animal.html');
    await page.evaluate(() => {
      const s = JSON.parse(JSON.stringify(window.S));
      Object.assign(s.stats, { clozeRight: 60, listenRight: 15, typeCount: 25, speedBest: { easy: 250, medium: 0, hard: 0 }, bubbleBest: { easy: 60, medium: 0, hard: 0 },
        daysPlayed: 5, matchPerfect: 6, chestClaimed: 6 });
      s.lastSaveTime = Date.now();
      localStorage.setItem('wordIslandAnimal', JSON.stringify(s));
      localStorage.setItem('sb_best_cpm', '45');
      // 新版第一次判定前：钱包里一个都没有
      localStorage.removeItem('hansen_wallet_ach');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.S && window.HansenAch && typeof checkAch === 'function' && window.__hsnAchUpgraded, null, { timeout: 30000 });
    await sleep(1500);
    const r = await page.evaluate(() => {
      checkAch();   // 开岛时自己已经判定过一次；这里再判定一次也不该多弹
      const ids = ['clozeS10', 'clz50', 'listenS10', 'typingS20', 'speedS200', 'bubbleS50', 'cpm40', 'cpmS30', 'dayNS3', 'matchpS5', 'chestS5', 'perfMatch'];
      return { got: ids.filter(id => HansenAch.isPending(id) || HansenAch.isClaimed(id)), miss: ids.filter(id => !(HansenAch.isPending(id) || HansenAch.isClaimed(id))),
        wrongS10: HansenAch.isPending('wrongS10'), clz200: HansenAch.isPending('clz200'), popups: window.__popups.slice(), pending: HansenAch.pendingCount(),
        prog: window.getAchProgress('clozeS800') };
    });
    ok(r.miss.length === 0, `该解锁的都进了待领取（缺 ${r.miss.join(', ') || '无'}）`);
    ok(!r.clz200 && !r.wrongS10, '没到目标的不解锁（clz200 / wrongS10）');
    ok(r.popups.length <= 1, `打开岛到现在一共只弹了 ${r.popups.length} 个提示（${r.popups.join(' | ').slice(0, 80)}）`);
    ok(r.popups.length === 1 && /一下子解锁了 \d+ 个成就/.test(r.popups[0]), '提示写「一下子解锁了 N 个成就」');
    ok(r.prog && r.prog.cur === 60 && r.prog.need === 800, `阶梯成就有进度条（clozeS800：${JSON.stringify(r.prog)}）`);
    const again = await page.evaluate(() => { window.__popups = []; checkAch(); return window.__popups.length; });
    ok(again === 0, `再判定一次不重复弹（${again}）`);
    await ctx.close();
  }

  console.log('\n▶ 2. 只学了 1 个词、从没错过：不解锁错词清零 / 攻克错词');
  {
    const { ctx, page } = await open('island_animal.html');
    const r = await page.evaluate(() => {
      if (S.learned.indexOf(0) < 0) S.learned.push(0); S.wrongs = {}; save(); checkAch();
      return { wrongClear: HansenAch.isPending('wrongClear') || HansenAch.isClaimed('wrongClear'), wrongS10: HansenAch.isPending('wrongS10') || HansenAch.isClaimed('wrongS10'), w1: HansenAch.isPending('w1') || HansenAch.isClaimed('w1') };
    });
    ok(r.w1, '学会第 1 个词照常解锁（对照）');
    ok(!r.wrongClear && !r.wrongS10, `没错过就没有「错词清零 / 攻克错词」（${JSON.stringify(r)}）`);
    await ctx.close();
  }

  console.log('\n▶ 4. 成就墙分类栏没有 undefined');
  for (const file of ['island_food.html', 'island_land2.html']) {
    const { ctx, page, errs } = await open(file);
    const txt = await page.evaluate(() => { window._achOpen = {}; if (typeof showScreen === 'function') showScreen('ach'); renderAch(); return [...document.querySelectorAll('#achList .ach-bar')].map(b => b.textContent).join(' | '); });
    ok(txt.length > 0 && !/undefined/.test(txt), `${file}：${txt.slice(0, 90)}…`);
    ok(errs.length === 0, `${file} 零脚本错误` + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 阶梯系列成就能解锁、成就墙无 undefined');
process.exit(fails ? 1 : 0);
