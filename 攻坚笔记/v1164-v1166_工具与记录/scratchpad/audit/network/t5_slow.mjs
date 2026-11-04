import { launch, newCtx, attach, cacheSummary, swState, waitSwActive, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Slow network: island navigation delays, home navigation delay with cached copy.
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const only = process.argv[2] || 'S1,S2,S3';
const browser = await launch();
async function primed() {
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  const ev = []; attach(page, 'S', ev);
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSwActive(page);
  await sleep(3000);
  await page.reload({ waitUntil: 'load' });
  await sleep(1500);
  return { ctx, page, ev };
}
async function observeIsland(page, file, ms) {
  const t0 = Date.now();
  const tap = await openIslandTap(page, file);
  const samples = [];
  let shots = 0;
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate((file) => {
      const f = document.getElementById('islandFrame'); const w = document.getElementById('islandFrameWrap');
      const L = document.getElementById('islandLoading');
      let p = '', title = '';
      try { p = f.contentWindow.location.pathname.split('/').pop(); title = f.contentDocument.title; } catch (e) {}
      return { p, title, frameOpacity: f.style.opacity, loading: L && L.style.display, loadingText: L && L.style.display !== 'none' ? (document.getElementById('islandLoadingText') || {}).textContent : '' };
    }, file);
    s.dt = Date.now() - t0;
    const last = samples[samples.length - 1];
    if (!last || last.p !== s.p || last.title !== s.title || last.frameOpacity !== s.frameOpacity || last.loading !== s.loading) samples.push(s);
    await sleep(250);
  }
  return { tap, samples };
}
try {
  if (only.includes('S1')) {
    // S1: island HTML takes 5s (online, never visited)
    const { ctx, page } = await primed();
    srv.cfg.rules = [{ re: '^/island_animal\\.html$', delayMs: 5000 }];
    R.S1 = await observeIsland(page, 'island_animal.html', 9000);
    await page.screenshot({ path: OUT + '/t5_S1_end.png' });
    await ctx.close();
  }
  if (only.includes('S2')) {
    // S2: island HTML takes 14s (> SW cold timeout 12s), online
    const { ctx, page } = await primed();
    srv.cfg.rules = [{ re: '^/island_animal\\.html$', delayMs: 14000 }];
    R.S2 = await observeIsland(page, 'island_animal.html', 17000);
    await page.screenshot({ path: OUT + '/t5_S2_end.png' });
    // and: open previously visited island (food) after it's cached, with 10s delay (> 8s warm timeout)
    await page.evaluate(() => window.closeIsland());
    await sleep(800);
    await ctx.close();
  }
  if (only.includes('S3')) {
    // S3: home navigation slow (10s) with cached copy: what is on screen and when?
    const { ctx, page } = await primed();
    srv.cfg.rules = [{ re: '^/(\\?.*)?$', delayMs: 10000 }];
    const t0 = Date.now();
    const navP = page.reload({ waitUntil: 'commit', timeout: 30000 }).then(() => Date.now() - t0).catch(e => 'err ' + e.message);
    const R3 = { commitMs: await navP };
    await page.waitForLoadState('load').catch(() => {});
    R3.loadMs = Date.now() - t0;
    R3.servedVersion = await page.evaluate(() => (document.querySelector('script[src*="?v="]') || {}).src);
    R.S3 = R3;
    // S3b: slow home with NO cached page for '/', e.g. first visit via /?from=wechat query: ignoreSearch fallback
    await ctx.close();
  }
  if (only.includes('S4')) {
    // S4: all JS slow (3s each) on a cold first visit (no SW yet) -> boot check false alarm?
    const ctx = await newCtx(browser, { sw: false });
    const page = await ctx.newPage();
    const ev = []; attach(page, 'S4', ev);
    srv.cfg.rules = [{ re: 'hansen_auth_v1004\\.js', delayMs: 9000 }];
    await page.goto(O + '/', { waitUntil: 'load', timeout: 60000 });
    await sleep(7500);
    R.S4 = await page.evaluate(() => ({ banner: !!document.getElementById('hsnBootBad'), text: (document.getElementById('hsnBootBad') || {}).innerText, auth: typeof window.HansenAuth }));
    await sleep(4000);
    R.S4.after = await page.evaluate(() => ({ banner: !!document.getElementById('hsnBootBad'), auth: typeof window.HansenAuth }));
    await page.screenshot({ path: OUT + '/t5_S4.png' });
    await ctx.close();
  }
} catch (e) { R.fatal = String(e.stack || e).slice(0, 1000); }
await browser.close(); srv.server.close();
save('t5_result_' + only.replace(/,/g, '') + '.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 12000));
