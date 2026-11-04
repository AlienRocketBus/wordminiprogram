import { launch, newCtx, attach, cacheSummary, swState, waitSwActive, save, startServer, SNAP, COPY, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Probe: after deploy, does the home page reload by itself? Who triggers it?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
try {
  const ctx = await newCtx(browser);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    const orig = { reload: location.reload.bind(location) };
    window.__navTrace = [];
    const log = (k) => { try { const s = JSON.parse(sessionStorage.getItem('__navTrace') || '[]'); s.push({ k, t: Date.now(), stack: (new Error().stack || '').split('\n').slice(2, 6).join(' | ') }); sessionStorage.setItem('__navTrace', JSON.stringify(s)); } catch (e) {} };
    try { const pr = Location.prototype; } catch (e) {}
    window.addEventListener('beforeunload', () => log('beforeunload'));
    window.addEventListener('pagehide', () => log('pagehide'));
    try { navigator.serviceWorker.addEventListener('controllerchange', () => log('controllerchange')); } catch (e) {}
    const hp = History.prototype;
    for (const m of ['pushState', 'replaceState']) { const o = hp[m]; hp[m] = function () { log(m + ' ' + String(arguments[2] || '')); return o.apply(this, arguments); }; }
  });
  const p0 = await ctx.newPage();
  await p0.goto(O + '/', { waitUntil: 'load' });
  await waitSwActive(p0);
  await sleep(6000);
  await p0.close();
  srv.cfg.root = COPY;
  srv.getLog();
  const page = await ctx.newPage();
  const ev = []; attach(page, 'P', ev);
  const navs = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push({ t: Date.now(), url: f.url().replace(O, '') }); });
  const t0 = Date.now();
  await page.goto(O + '/', { waitUntil: 'load' });
  await page.evaluate(() => { window.__alive = 1; });
  await sleep(25000);
  R.navs = navs.map(n => ({ dt: n.t - t0, url: n.url }));
  R.alive = await page.evaluate(() => window.__alive || 0);
  R.trace = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__navTrace') || '[]').map(x => ({ ...x, t: x.t })));
  R.trace = R.trace.map(x => ({ ...x, dt: x.t - t0 }));
  R.serverNavs = srv.getLog().filter(x => x.dest === 'document' || x.mode === 'navigate' || x.path === '/sw_v944.js').map(x => ({ dt: x.t - t0, path: x.path, dest: x.dest, mode: x.mode, sw: x.sw, st: x.status }));
  R.sw = await swState(page);
  R.ev = ev.filter(e => !/VERSION/.test(e.text)).slice(0, 30);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 1000); }
await browser.close(); srv.server.close();
save('t3_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 12000));
