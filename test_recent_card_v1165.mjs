/* test_recent_card_v1165.mjs —— 首页「最近探险的岛屿 · 点击继续」指向孩子真点过的岛
 *
 * 事故（v1163 审计 INT-03 / CB-04 / MISSED#2/#5/#13/#15）：卡片拿「各岛存档里最新的 lastSaveTime」盖过孩子真点岛时
 *   记下的 lastIslandKey；后台也会写存档（星海预热、云端恢复、升级盖时间戳……），于是卡片常常指向孩子没玩的岛
 *   （多半是 👑星海终战）。
 *
 * 合同（首页外壳，真点）：
 *   1. 真点「动物」→ 🗺️，再往 wordIslandSeason / wordIslandMisc 里写更新的 lastSaveTime：卡片仍是 🐯 动物，点卡片进 island_animal.html
 *   2. 动物 → 食物 → 疑问（代词岛）依次真点：卡片跟着最后一个（island_question.html）
 *   3. 从没真点过岛（没有 lastIslandKey）的老孩子：照旧扫存档，挑 lastSaveTime 最新的那个岛
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });

async function newPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(seed => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); for (const k in seed) localStorage.setItem(k, seed[k]); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, seed);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function' && typeof window.renderRecent === 'function', null, { timeout: 30000 });
  await sleep(1200);
  return { ctx, page, errs };
}
const frameOf = page => page.frames().find(f => f.parentFrame() === page.mainFrame());
async function tapAt(page, frame, sel) {
  const pt = await frame.evaluate(async s => {
    const el = document.querySelector(s); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y);
    return { x, y, hit: !!h && (h === el || el.contains(h)) };
  }, sel).catch(() => null);
  if (!pt || !pt.hit) return false;
  await page.touchscreen.tap(pt.x, pt.y);
  return true;
}
const shell = page => page.evaluate(() => {
  const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame'), el = document.getElementById('recentLearnStat');
  let u = '', rs = ''; try { u = f.contentWindow.location.pathname.split('/').pop(); rs = f.contentDocument.readyState; } catch (e) {}
  return { wrap: w.style.display, op: f.style.opacity, u, rs, target: el && el._target, num: (document.getElementById('recentNum') || {}).textContent || '' };
});
async function waitShell(page, pred, ms = 15000) { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await shell(page); if (pred(s)) return s; await sleep(60); } return null; }
async function visit(page, file) {
  const t = await tapAt(page, page.mainFrame(), `a.island[href="${file}"]`);
  const s = await waitShell(page, s => s.wrap === 'block' && s.op === '1' && s.u === file && s.rs === 'complete');
  await sleep(500);
  const fr = frameOf(page); if (fr) await fr.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); }).catch(() => {});
  await sleep(300);
  const m = fr ? await tapAt(page, fr, '.world-map-btn') : false;
  const h = await waitShell(page, s => s.wrap === 'none', 4000);
  return t && !!s && m && !!h;
}

try {
  console.log('\n▶ 1. 真点动物 → 🗺️；后台把星海、常用词岛存档的 lastSaveTime 写得更新');
  {
    const { ctx, page, errs } = await newPage({ hansen_onboarded: '1' });
    ok(await visit(page, 'island_animal.html'), '真点「动物」进岛再 🗺️ 回首页');
    await page.evaluate(() => {
      const now = Date.now() + 60000;
      localStorage.setItem('wordIslandSeason', JSON.stringify({ learned: [1], mc: {}, wrongs: {}, lastSaveTime: now }));
      localStorage.setItem('wordIslandMisc', JSON.stringify({ learned: [2], mc: {}, wrongs: {}, lastSaveTime: now + 1000 }));
      renderRecent();
    });
    await sleep(2300);   // 首页每 2 秒还会自己重画一次
    const s = await shell(page);
    ok(s.target === 'island_animal.html' && /🐯/.test(s.num), `卡片仍是动物岛（${s.num} → ${s.target}）`);
    ok(await tapAt(page, page.mainFrame(), '#recentLearnStat'), '真点卡片');
    await sleep(2500);   // 等换岛（如果真要换）落定
    const s2 = await shell(page);
    ok(s2.wrap === 'block' && s2.op === '1' && s2.u === 'island_animal.html', `「点击继续」进的是动物岛（${s2.u}）`);
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 2. 动物 → 食物 → 疑问 依次真点：卡片跟着最后一个');
  {
    const { ctx, page, errs } = await newPage({ hansen_onboarded: '1' });
    for (const f of ['island_animal.html', 'island_food.html', 'island_question.html']) {
      ok(await visit(page, f), `真点 ${f} 再回首页`);
      const s = await shell(page);
      ok(s.target === f, `卡片指向 ${f}（${s.num} → ${s.target}）`);
    }
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 3. 从没真点过岛的老孩子：照旧扫存档');
  {
    const now = Date.now();
    const { ctx, page, errs } = await newPage({ hansen_onboarded: '1',
      wordIslandFood: JSON.stringify({ learned: [1], mc: {}, wrongs: {}, lastSaveTime: now - 3600000 }),
      wordIslandSports: JSON.stringify({ learned: [1], mc: {}, wrongs: {}, lastSaveTime: now - 60000 }) });
    const s = await shell(page);
    ok(s.target === 'island_sports.html', `没有 lastIslandKey：挑存档最新的运动岛（${s.num} → ${s.target}）`);
    ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 「最近探险」卡片指向孩子真点过的岛');
process.exit(fails ? 1 : 0);
