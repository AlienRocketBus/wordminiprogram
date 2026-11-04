// NET-13: offline + never-visited island -> what can the kid do? NET-14: cold start with slow '/' and cached home.
import { launch, ctxOf, waitSw, tapIsland, frameState, start, SNAP, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
try {
  const ctx = await ctxOf(browser, { sw: true });
  const page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSw(page); await sleep(2000);
  await page.reload({ waitUntil: 'load' }); await sleep(3000);
  await ctx.setOffline(true);
  await tapIsland(page, 'island_animal.html');
  await sleep(4000);
  R.frame = await frameState(page);
  R.frameButtons = await page.frames().find(f => f.url().includes('island_animal'))?.evaluate(() => [...document.querySelectorAll('button,a')].map(b => b.textContent.trim())).catch(e => String(e));
  R.parentControlsOverFrame = await page.evaluate(() => { const w = document.getElementById('islandFrameWrap'); return [...w.querySelectorAll('button,a,[onclick]')].map(b => b.textContent.trim() || b.id); });
  await page.screenshot({ path: OUT + '/s13_offline_island_360.png' });
  // system back (Android back key / WeChat back arrow)
  await page.goBack().catch(() => {});
  await sleep(1000);
  R.afterSystemBack = await page.evaluate(() => ({ wrap: document.getElementById('islandFrameWrap').style.display, url: location.pathname }));
  await ctx.setOffline(false);
  // NET-14: cached home, '/' headers delayed 10 s
  srv.cfg.rules = [{ re: '^/(\\?.*)?$', delayMs: 10000 }];
  const t0 = Date.now();
  let commit = 0; page.once('framenavigated', () => { commit = Date.now() - t0; });
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  R.coldStartSlowRoot = { commitMs: commit, dclMs: Date.now() - t0 };
  srv.cfg.rules = [];
  await ctx.close();
} catch (e) { R.fatal = String(e.stack || e).slice(0, 600); }
await browser.close(); await srv.close();
save('s13_result.json', R);
console.log(JSON.stringify(R, null, 1));
