// NET-05 memory: RSS of this browser's renderer processes after one island tap, as shipped vs recursion disabled.
import { launch, ctxOf, tapIsland, waitIsland, start, SNAP, save, sleep } from './lib.mjs';
import fs from 'node:fs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
const bcdp = await browser.newBrowserCDPSession();
async function rendererMem() {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo');
  return processInfo.filter(p => p.type === 'renderer').map(p => {
    let rss = 0, pss = 0;
    try { rss = +(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${p.id}/status`, 'utf8')) || [0, 0])[1]; } catch (e) {}
    try { pss = +(/^Pss:\s+(\d+)/m.exec(fs.readFileSync(`/proc/${p.id}/smaps_rollup`, 'utf8')) || [0, 0])[1]; } catch (e) {}
    return { pid: p.id, rssMB: Math.round(rss / 1024), pssMB: Math.round(pss / 1024) };
  });
}
async function run(label, rules) {
  const ctx = await ctxOf(browser, { sw: false });
  const page = await ctx.newPage();
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(4000);
  const before = await rendererMem();
  srv.cfg.rules = rules;
  await tapIsland(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(25000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
  await sleep(1500);
  const dom = await cdp.send('Memory.getDOMCounters').catch(() => null);
  await cdp.send('Performance.enable');
  const m = await cdp.send('Performance.getMetrics');
  R[label] = { before, after: await rendererMem(), jsHeapUsedMB: Math.round(m.metrics.find(x => x.name === 'JSHeapUsedSize').value / 1048576), jsHeapTotalMB: Math.round(m.metrics.find(x => x.name === 'JSHeapTotalSize').value / 1048576), dom };
  await ctx.close();
  await sleep(3000);
}
try {
  await run('as_shipped', []);
  await run('no_recursion', [{ re: '^/hansen_room_warm_v1023\\.js', ref: 'island_season\\.html', status: 200, ctype: 'text/javascript', body: '/*off*/' }]);
  await run('as_shipped_again', []);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); await srv.close();
save('s05c_result.json', R);
console.log(JSON.stringify(R, null, 1));
