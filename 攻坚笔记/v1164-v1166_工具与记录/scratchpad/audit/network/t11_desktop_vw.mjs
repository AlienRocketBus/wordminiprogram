import { launch, save, startServer, SNAP, OUT, sleep } from './lib.mjs';
// Desktop browser (phone-frame wrapper _frame.html): does the version watcher still work?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsnViewMode', 'mobile'); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(O + '/', { waitUntil: 'load' });
await sleep(3000);
srv.cfg.version = 1164; // server says a newer version exists
await sleep(1000);
R.topUrl = page.url().replace(O, '');
R.frames = page.frames().map(f => f.url().replace(O, ''));
const game = page.frames().find(f => /index\.html|\/$|\/\?/.test(f.url()) && f !== page.mainFrame());
R.check = game ? await game.evaluate(() => HansenVersionWatch.check().then(s => ({ local: s.local, server: s.server, stale: s.stale, note: s.note }))) : 'no game frame';
await sleep(3000);
R.navigatedAway = page.url().replace(O, '');
R.topHasWatcher = await page.evaluate(() => typeof window.HansenVersionWatch);
await browser.close(); srv.server.close();
save('t11_result.json', R);
console.log(JSON.stringify(R, null, 1));
