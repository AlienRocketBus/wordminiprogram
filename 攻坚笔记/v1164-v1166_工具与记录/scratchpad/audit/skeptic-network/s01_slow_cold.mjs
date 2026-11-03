// NET-01 re-check: cold (never opened) island over a slow-but-working gzip link, with vs without SW.
import { launch, ctxOf, watch, waitSw, tapIsland, frameState, start, SNAP, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
async function run(label, sw, rateBps, file = 'island_animal.html') {
  const ctx = await ctxOf(browser, { sw });
  const page = await ctx.newPage();
  const ev = []; watch(page, ev, label);
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  if (sw) { R[label + '_swActiveMs'] = await waitSw(page); await sleep(1500); await page.reload({ waitUntil: 'load' }); }
  await sleep(2500);
  const ctl = await page.evaluate(() => !!navigator.serviceWorker.controller);
  const re = '^/' + file.replace('.', '\\.') + '$';
  srv.cfg.rules = [{ re, rateBps }];
  srv.take();
  const t0 = Date.now();
  const tap = await tapIsland(page, file);
  const seen = [];
  for (let i = 0; i < 130; i++) {
    const s = await frameState(page);
    const last = seen[seen.length - 1];
    const key = JSON.stringify([s.p, s.rs, s.title, s.op, s.loading]);
    if (!last || last.key !== key) seen.push({ dt: Date.now() - t0, key, p: s.p, rs: s.rs, title: s.title, op: s.op, loading: s.loading });
    if (s.rs === 'complete' && s.p.endsWith(file) ) break;
    await sleep(300);
  }
  await sleep(500);
  const offlineText = await page.evaluate(() => { try { return document.getElementById('islandFrame').contentDocument.body.innerText.slice(0, 120); } catch (e) { return null; } });
  const navLog = srv.take().filter(x => x.path === '/' + file).map(x => ({ dest: x.dest, sw: x.sw, status: x.status, size: x.size, aborted: x.aborted, abortedMs: x.abortedMs, doneMs: x.doneMs }));
  R[label] = { controlled: ctl, tap, rateBps, seen: seen.map(({ key, ...r }) => r), offlineText, navLog, downloads: ev.filter(e => e.k === 'download') };
  await page.screenshot({ path: OUT + `/s01_${label}.png` });
  await ctx.close();
}
try {
  await run('sw_10KBps', true, 10000);
  await run('nosw_10KBps', false, 10000);
  await run('sw_16KBps', true, 16000);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 600); }
await browser.close(); await srv.close();
save('s01_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 6000));
