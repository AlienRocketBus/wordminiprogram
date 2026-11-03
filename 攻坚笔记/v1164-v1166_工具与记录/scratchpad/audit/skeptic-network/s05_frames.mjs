// NET-05 re-check: frames/documents created by opening ONE island (room-warm recursion?).
import { launch, ctxOf, watch, tapIsland, waitIsland, start, SNAP, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
const ctx = await ctxOf(browser, { sw: false });
const page = await ctx.newPage();
const ev = []; watch(page, ev, 'f');
await page.goto(O + '/', { waitUntil: 'load' });
await sleep(4000);
function depth(f) { let d = 0; while (f.parentFrame()) { d++; f = f.parentFrame(); } return d; }
R.framesHome = page.frames().map(f => '  '.repeat(depth(f)) + f.url().replace(O, ''));
const homeLog = srv.take();
R.homeReqs = homeLog.length;
await tapIsland(page, 'island_food.html');
R.wait = await waitIsland(page, 'island_food.html', 30000);
const snaps = [];
for (const t of [5, 10, 15, 25]) {
  await sleep((t - (snaps.length ? [5, 10, 15, 25][snaps.length - 1] : 0)) * 1000);
  snaps.push({ t, frames: page.frames().map(f => '  '.repeat(depth(f)) + f.url().replace(O, '')) });
}
R.snaps = snaps;
const log = srv.take();
R.reqAfterTap = log.length;
R.htmlDocs = log.filter(x => /\.html/.test(x.path) && (x.dest === 'iframe' || x.dest === 'document')).map(x => x.path + ' [' + x.dest + ']');
R.bytesAfterTap = log.reduce((s, x) => s + (x.size || 0), 0);
// which island_season docs run room warm, and what is their parent
R.seasonFrames = [];
for (const f of page.frames()) {
  if (!/island_season/.test(f.url())) continue;
  R.seasonFrames.push(await f.evaluate(() => ({ url: location.pathname + location.search, depthTopDiff: (() => { let d = 0, w = window; while (w !== w.parent) { d++; w = w.parent; } return d; })(), rooms: window.HansenRoom ? window.HansenRoom._rooms() : null, prefetched: window.HansenRoom ? window.HansenRoom.prefetched() : null, hidden: (() => { try { const fe = window.frameElement; return fe ? getComputedStyle(fe.parentElement).display : null; } catch (e) { return 'x'; } })() })).catch(e => String(e).slice(0, 100)));
}
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const m = await cdp.send('Performance.getMetrics');
R.metrics = Object.fromEntries(m.metrics.filter(x => /JSHeapUsedSize|Documents|Frames|Nodes|JSEventListeners/.test(x.name)).map(x => [x.name, x.name.includes('Heap') ? Math.round(x.value / 1048576) + 'MB' : x.value]));
R.errs = ev.filter(e => e.k === 'pageerror').slice(0, 8);
await browser.close(); await srv.close();
save('s05_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 7000));
