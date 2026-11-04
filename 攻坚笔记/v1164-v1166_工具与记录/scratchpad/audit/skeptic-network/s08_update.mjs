// NET-08 / NET-09 / NET-10 / NET-11 / NET-16 re-checks (update flows, version watcher, nav error fallback).
import { launch, ctxOf, watch, waitSw, tapIsland, waitIsland, frameState, start, SNAP, V1164, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
function navRec(page, t0) { const a = []; page.on('framenavigated', f => { if (f === page.mainFrame()) a.push({ dt: Date.now() - t0, u: f.url().replace(O, '') }); }); return a; }
const reset = () => { srv.cfg.roots = [SNAP]; srv.cfg.version = null; srv.cfg.rules = []; };

// NET-08: deploy while the app is open, kid taps an island
async function u08() {
  reset();
  const ctx = await ctxOf(browser, { sw: true });
  const page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSw(page); await sleep(2000);
  await page.reload({ waitUntil: 'load' }); await sleep(9000);   // boot check done on 1163
  const vw0 = await page.evaluate(() => HansenVersionWatch.status());
  srv.cfg.roots = [V1164, SNAP];            // deploy
  const t0 = Date.now(); const navs = navRec(page, t0);
  await tapIsland(page, 'island_animal.html');
  const samples = [];
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const s = await page.evaluate(() => ({ bar: (document.getElementById('hsnVwBar') || document.getElementById('hsn_vw_bar') || {}).textContent || null, url: location.pathname + location.search, state: history.state, wrap: (document.getElementById('islandFrameWrap') || {}).style && document.getElementById('islandFrameWrap').style.display })).catch(e => ({ err: String(e).slice(0, 60) }));
    const last = samples[samples.length - 1];
    if (!last || JSON.stringify(last.s) !== JSON.stringify(s)) samples.push({ dt: Date.now() - t0, s });
  }
  await sleep(8000);
  const end = await page.evaluate(() => ({ url: location.pathname + location.search, wrap: document.getElementById('islandFrameWrap').style.display, fixed: localStorage.getItem('hansen_vw_autofixed'), vw: HansenVersionWatch.status(), gate: __hansenSwUpgradeGateV944.version }));
  R.u08 = { vwBeforeDeploy: vw0.note, samples, navs, end };
  await ctx.close();
}

// NET-09: CDN window (VERSION already 1164, files still 1163), then CDN catches up while page stays open
async function u09() {
  reset();
  srv.cfg.version = 1164;
  const ctx = await ctxOf(browser, { sw: true });
  const page = await ctx.newPage();
  const t0 = Date.now(); const navs = navRec(page, t0);
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(20000);
  const a = await page.evaluate(() => ({ url: location.pathname + location.search, vw: HansenVersionWatch.status(), fixed: localStorage.getItem('hansen_vw_autofixed') }));
  // CDN catches up
  srv.cfg.roots = [V1164, SNAP]; srv.cfg.version = null;
  const b = await page.evaluate(() => HansenVersionWatch.check().then(s => ({ local: s.local, server: s.server, note: s.note })));   // what the visibilitychange re-check would do
  await sleep(3000);
  const c = await page.evaluate(() => ({ url: location.pathname + location.search, gate: __hansenSwUpgradeGateV944.version }));
  // kid reopens the app (plain reload) -> does it self-heal?
  await page.reload({ waitUntil: 'load' }); await sleep(9000);
  const d = await page.evaluate(() => ({ gate: __hansenSwUpgradeGateV944.version, vw: HansenVersionWatch.status().note }));
  R.u09 = { navs, duringCdnWindow: a, recheckAfterCdnCaughtUp: b, pageStillOn: c, afterManualReopen: d };
  await ctx.close();
}

// NET-16: localStorage throws -> reload loop while VERSION > files
async function u16() {
  reset();
  srv.cfg.version = 1164;
  const ctx = await ctxOf(browser, { sw: true });
  await ctx.addInitScript(() => {
    const G = Storage.prototype.getItem, S = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { if (k === 'hansen_vw_autofixed') throw new Error('SecurityError'); return G.apply(this, arguments); };
    Storage.prototype.setItem = function (k, v) { if (k === 'hansen_vw_autofixed') throw new Error('QuotaExceededError'); return S.apply(this, arguments); };
  });
  const page = await ctx.newPage();
  let loads = 0; page.on('load', () => loads++);
  await page.goto(O + '/', { waitUntil: 'load' }).catch(() => {});
  await sleep(45000);
  R.u16 = { mainFrameLoadsIn45s: loads, url: page.url().replace(O, '') };
  await ctx.close();
}

// NET-10: server answers '/' with 404 / 502 although a complete cached home exists
async function u10() {
  reset();
  const ctx = await ctxOf(browser, { sw: true });
  const page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSw(page); await sleep(2000);
  await page.reload({ waitUntil: 'load' }); await sleep(3000);
  const has = await page.evaluate(async () => !!(await caches.match('/', { ignoreSearch: true })) || !!(await caches.match('/index.html', { ignoreSearch: true })));
  const out = { cachedHomeExists: has };
  for (const st of [404, 502]) {
    srv.cfg.rules = [{ re: '^/(\\?.*)?$', status: st }];
    await page.reload({ waitUntil: 'load' }).catch(() => {});
    await sleep(1500);
    out['root_' + st] = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 60) }));
  }
  srv.cfg.rules = [];
  R.u10 = out;
  await ctx.close();
}

// NET-11: desktop phone-frame mode (_frame.html) -> version watcher in the game frame
async function u11() {
  reset();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', locale: 'zh-CN' });
  await ctx.addInitScript(() => { try { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsnViewMode', 'mobile'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(4000);
  const topUrl = page.url().replace(O, '');
  const game = page.frames().find(f => f !== page.mainFrame() && /\/(index\.html)?(\?|$)/.test(new URL(f.url()).pathname + '?'));
  srv.cfg.version = 1164;
  const res = game ? await game.evaluate(() => HansenVersionWatch.check().then(s => ({ local: s.local, server: s.server, note: s.note }))) : null;
  const vwReqs = srv.peek().filter(x => x.path.startsWith('/VERSION')).length;
  R.u11 = { topUrl, gameFrame: game && game.url().replace(O, ''), topHasWatcher: await page.evaluate(() => !!window.HansenVersionWatch), check: res, versionRequestsSeenByServer: vwReqs };
  await ctx.close();
}

for (const [k, f] of Object.entries({ u08, u09, u10, u11, u16 })) {
  try { await f(); } catch (e) { R[k + '_fatal'] = String(e.stack || e).slice(0, 500); }
  save('s08_result.json', R);
}
await browser.close(); await srv.close();
console.log(JSON.stringify(R, null, 1).slice(0, 12000));
