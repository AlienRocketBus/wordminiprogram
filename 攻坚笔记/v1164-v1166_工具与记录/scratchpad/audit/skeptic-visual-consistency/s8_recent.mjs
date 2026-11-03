// Does the hidden warm-up of island_season (hansen_room_warm_v1023.js) hijack home "最近探险的岛屿" and 我的学习 "已点亮"?
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, OUT, saveJson } from './lib.mjs';
const out = {}; const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
try {
  const ctx = await newCtx(browser, { dsf: 2, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } } });
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  await page.goto(base + '/index.html', { waitUntil: 'load' }); await sleep(2500);
  out.recentBefore = await page.evaluate(() => (document.getElementById('recentNum') || {}).textContent);
  await tapSel(page, page, 'a.island[href="island_animal.html"]');
  await waitFor(async () => { const f = page.frames().find(f => f.url().includes('island_animal.html')); if (!f) return null; return await f.evaluate(() => document.readyState === 'complete').catch(() => false); }, 15000);
  await sleep(2500);
  const frame = page.frames().find(f => f.url().includes('island_animal.html'));
  const shown = await frame.evaluate(() => { const m = document.getElementById('alertModal'); return !!(m && m.classList.contains('show')); });
  if (shown) { await tapText(page, frame, '#alertModal button', '开始冒险'); await sleep(700); }
  await sleep(9000); // child looks around for ~10 s, then goes home
  out.saveTimes = await page.evaluate(() => { const g = k => { try { const d = JSON.parse(localStorage.getItem(k) || 'null'); return d ? d.lastSaveTime || null : null; } catch (e) { return 'err'; } }; return { animal: g('wordIslandAnimal'), season: g('wordIslandSeason'), lastIslandKey: localStorage.getItem('lastIslandKey'), lastIslandTime: localStorage.getItem('lastIslandTime') }; });
  await tapSel(page, frame, '.world-map-btn'); await sleep(1500);
  out.recentAfter = await page.evaluate(() => (document.getElementById('recentNum') || {}).textContent);
  const r = await page.evaluate(() => { const e = document.getElementById('recentLearnStat'); e && e.scrollIntoView({ block: 'center' }); return !!e; });
  await sleep(400);
  await page.screenshot({ path: OUT + '/shots/s8_home_recent_after_animal.png' });
  await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 10);
saveJson('s8_recent.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1));
