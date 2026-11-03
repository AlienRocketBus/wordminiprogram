/* test_bee_topbar_v1165.mjs —— 拼写蜂赢了金币、完成了任务，岛顶栏金币和任务红点马上跟着变（外壳/拼写蜂部分）
 *
 * 事故（v1163 审计 SS-3）：hansen_spellbee.js 把拼写蜂的金币记进全局钱包后不刷新岛顶栏，关掉拼写蜂也不刷新；
 *   首页外壳里回首页再进（保活）同样不刷新 —— 孩子看到的金币一直是开拼写蜂之前的数。
 *   （注：任务池里没有「拼写蜂获胜」任务，progressQuest('sbwin') 什么都不做；这里用拼写蜂页面里真实可用的
 *    progressQuest('correct') 完成一个任务，验证红点刷新。）
 *
 * 合同（首页外壳里的食物岛）：拼写蜂里 sbQueueCappedReward(10,0,'match') + progressQuest('correct',20) →
 *   入账后顶栏金币 == 钱包；关掉拼写蜂后任务红点亮；🗺️ 回首页、别处改了钱包、再进岛 → 顶栏金币 == 钱包。
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
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hansen_wallet_coins', '100'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
  await sleep(1000);
  await page.evaluate(() => openIsland('island_food.html'));
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_food/.test(f.contentWindow.location.pathname) && f.contentDocument.readyState === 'complete' && f.contentWindow.HansenSpellBee && f.contentWindow.HansenCoins; } catch (e) { return false; } }, null, { timeout: 30000 });
  await sleep(1200);
  const isl = () => page.frames().find(f => f.parentFrame() === page.mainFrame());
  await isl().evaluate(() => {
    const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click();
    rollDailyQuests(); const KEY = 'hansen_global_daily_quests_v941'; const st = JSON.parse(localStorage.getItem(KEY));
    st.list = [{ id: 'correct20', progress: 0, claimed: false }]; st.allDay = ''; localStorage.setItem(KEY, JSON.stringify(st));
    updateQuestBadge(); updateTopBar();
  });
  const view = () => isl().evaluate(() => ({ shown: Number((document.getElementById('coinCount') || {}).textContent), wallet: HansenCoins.get(), dot: getComputedStyle(document.getElementById('questDot')).display }));
  const v0 = await view();
  console.log('    开拼写蜂前：' + JSON.stringify(v0));
  await isl().evaluate(() => HansenSpellBee.open('food'));
  let bee = null; for (let i = 0; i < 60 && !bee; i++) { bee = page.frames().find(f => /spelling_bee\.html/.test(f.url())); if (!bee) await sleep(200); }
  await bee.waitForFunction(() => typeof sbQueueCappedReward === 'function' && typeof progressQuest === 'function', null, { timeout: 20000 });
  await bee.evaluate(() => { sbQueueCappedReward(10, 0, 'match'); progressQuest('correct', 20); });
  await sleep(1500);
  const v1 = await view();
  console.log('    拼写蜂里赢完：' + JSON.stringify(v1));
  ok(v1.wallet > v0.wallet, `拼写蜂的金币进了钱包（${v0.wallet}→${v1.wallet}）`);
  ok(v1.shown === v1.wallet, `入账后岛顶栏金币马上跟上（显示 ${v1.shown}，钱包 ${v1.wallet}）`);
  await isl().evaluate(() => HansenSpellBee.close());
  await sleep(800);
  const v2 = await view();
  ok(v2.shown === v2.wallet && v2.dot === 'block', `关掉拼写蜂：顶栏 ${v2.shown}=钱包 ${v2.wallet}，任务红点 ${v2.dot}`);
  // 🗺️ 回首页；别的页面框（这里用首页）往钱包里加钱；再进岛（保活）
  await isl().evaluate(() => goHome());
  await page.waitForFunction(() => document.getElementById('islandFrameWrap').style.display === 'none', null, { timeout: 5000 });
  await page.evaluate(() => { if (window.HansenCoins && HansenCoins.award) HansenCoins.award('test:topbar:' + Date.now(), 7); else localStorage.setItem('hansen_wallet_coins', String(Number(localStorage.getItem('hansen_wallet_coins')) + 7)); });
  await page.evaluate(() => openIsland('island_food.html'));
  await sleep(800);
  const v3 = await view();
  ok(v3.shown === v3.wallet && v3.wallet === v2.wallet + 7, `回首页再进：顶栏 ${v3.shown}=钱包 ${v3.wallet}（多了 7）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 拼写蜂赢的金币/任务马上显示在岛顶栏');
process.exit(fails ? 1 : 0);
