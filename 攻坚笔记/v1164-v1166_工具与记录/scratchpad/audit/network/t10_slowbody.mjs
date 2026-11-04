import { launch, newCtx, attach, waitSwActive, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Weak network where bytes DO arrive, just slowly (30 KB/s raw ≈ 70 kbps gzipped): can an unvisited island open?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
async function scenario(label, sw) {
  const ctx = await newCtx(browser, { sw });
  const page = await ctx.newPage();
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  if (sw) { await waitSwActive(page); await sleep(2000); await page.reload({ waitUntil: 'load' }); }
  await sleep(2000);
  srv.cfg.rules = [{ re: '^/island_animal\\.html$', rateBps: 30000 }];
  srv.getLog();
  const t0 = Date.now();
  await openIslandTap(page, 'island_animal.html');
  const seen = [];
  for (let i = 0; i < 100; i++) {
    const s = await page.evaluate(() => { let t = '', p = '', rs = ''; const f = document.getElementById('islandFrame'); try { t = f.contentDocument.title; p = f.contentWindow.location.pathname; rs = f.contentDocument.readyState; } catch (e) {} return { t, p, rs, op: f.style.opacity }; });
    const last = seen[seen.length - 1];
    if (!last || last.t !== s.t || last.p !== s.p || last.op !== s.op || last.rs !== s.rs) seen.push({ dt: Date.now() - t0, ...s });
    if (s.rs === 'complete' && s.p.includes('animal')) break;
    await sleep(300);
  }
  const log = srv.getLog().filter(x => /island_animal\.html$/.test(x.path.split('?')[0]) && !/\?/.test(x.path));
  R[label] = { seen, serverAttempts: log.map(x => ({ status: x.status, abortedAtBytes: x.aborted, doneMs: x.doneMs })) };
  await page.screenshot({ path: OUT + `/t10_${label}.png` });
  await ctx.close();
}
try {
  await scenario('withSW', true);
  await scenario('noSW', false);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); srv.server.close();
save('t10_result.json', R);
console.log(JSON.stringify(R, null, 1));
