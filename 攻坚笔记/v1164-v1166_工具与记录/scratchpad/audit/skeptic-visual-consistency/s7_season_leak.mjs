import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, served, OUT, saveJson } from './lib.mjs';
const out = {}; const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
try {
  const ctx = await newCtx(browser, { dsf: 1, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } } });
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  const frames = []; page.on('frameattached', f => frames.push('attached')); page.on('framenavigated', f => frames.push(f.url().replace(base, '')));
  const keys = () => page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^hsn_progress:|^wordIsland/.test(k)) o.push(k); } return o.sort(); });
  await page.goto(base + '/index.html', { waitUntil: 'load' }); await sleep(6000);
  out.homeOnly = await keys();
  out.servedSeasonHome = served.filter(s => /island_season/.test(s.p)).length;
  const t = await tapSel(page, page, 'a.island[href="island_animal.html"]');
  await waitFor(async () => { const f = page.frames().find(f => f.url().includes('island_animal.html')); if (!f) return null; return await f.evaluate(() => document.readyState === 'complete').catch(() => false); }, 15000);
  await sleep(6000);
  out.afterAnimal = await keys();
  out.servedSeason = served.filter(s => /island_season/.test(s.p)).map(s => s.code + ' ' + s.p);
  out.frames = frames.slice(0, 30);
  await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 10);
saveJson('s7_season_leak.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1));
