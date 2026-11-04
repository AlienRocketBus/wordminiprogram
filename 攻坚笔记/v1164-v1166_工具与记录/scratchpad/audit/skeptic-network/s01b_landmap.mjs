// NET-01 extension: land_map.html (509 KB gzipped) opened cold from home at ~240 kbps (30 KB/s gzipped), with vs without SW.
import { launch, ctxOf, waitSw, frameState, start, SNAP, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
async function run(label, sw) {
  const ctx = await ctxOf(browser, { sw });
  // report a 3g connection to page code so the 4g-only background warm-ups stay off (as on a weak phone link)
  await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get() { return { effectiveType: '3g', saveData: false, downlink: 0.3, rtt: 400, addEventListener() {}, removeEventListener() {} }; } }); } catch (e) {} });
  const page = await ctx.newPage();
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  if (sw) { await waitSw(page); await sleep(1500); await page.reload({ waitUntil: 'load' }); }
  await sleep(3000);
  srv.cfg.rules = [{ re: '^/land_map\\.html', rateBps: 30000 }];
  srv.take();
  const t0 = Date.now();
  await page.evaluate(() => window.openIsland('land_map.html'));   // what the 星海觉醒/单词大陆 banner on home does (hansen_season.js:438)
  const seen = [];
  for (let i = 0; i < 90; i++) {
    const s = await frameState(page);
    const k = JSON.stringify([s.p, s.rs, s.title, s.op, s.loading]);
    if (!seen.length || seen[seen.length - 1].k !== k) seen.push({ dt: Date.now() - t0, k, p: s.p, rs: s.rs, title: s.title, op: s.op, loading: s.loading });
    if (s.p.endsWith('land_map.html') && s.rs === 'complete') break;
    await sleep(300);
  }
  const nav = srv.take().filter(x => x.path.startsWith('/land_map.html')).map(x => ({ path: x.path, dest: x.dest, size: x.size, aborted: x.aborted, abortedMs: x.abortedMs, doneMs: x.doneMs }));
  R[label] = { seen: seen.map(({ k, ...r }) => r), nav };
  await page.screenshot({ path: OUT + `/s01b_${label}.png` });
  await ctx.close();
}
try { await run('sw', true); await run('nosw', false); } catch (e) { R.fatal = String(e.stack || e).slice(0, 600); }
await browser.close(); await srv.close();
save('s01b_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 6000));
