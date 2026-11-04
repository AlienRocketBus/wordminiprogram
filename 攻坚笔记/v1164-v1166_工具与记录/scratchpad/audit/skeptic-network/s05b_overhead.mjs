// NET-05 quantification: cost of the nested warm-up vs the same flow with room-warm disabled only inside island_season.
import { launch, ctxOf, tapIsland, waitIsland, start, SNAP, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
async function run(label, rules) {
  const ctx = await ctxOf(browser, { sw: false });
  const page = await ctx.newPage();
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(4000);
  srv.cfg.rules = rules;
  srv.take();
  await tapIsland(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(25000);
  const log = srv.take();
  const docs = log.filter(x => (x.dest === 'iframe' || x.dest === 'document')).map(x => x.path + ' ' + x.status + ' ' + (x.size || 0));
  const byType = {};
  for (const x of log) { const ext = (x.path.split('?')[0].match(/\.([a-z0-9]+)$/i) || [, 'other'])[1]; byType[ext] = byType[ext] || { n: 0, kb: 0 }; byType[ext].n++; byType[ext].kb += Math.round((x.size || 0) / 1024); }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const m = await cdp.send('Performance.getMetrics');
  const met = Object.fromEntries(m.metrics.filter(x => /^(Documents|Frames|Nodes|JSEventListeners)$/.test(x.name)).map(x => [x.name, x.value]));
  R[label] = { reqs: log.length, kb: Math.round(log.reduce((s, x) => s + (x.size || 0), 0) / 1024), docs, byType, met, frames: page.frames().length };
  await ctx.close();
}
try {
  await run('as_shipped', []);
  await run('warm_only_in_direct_island', [{ re: '^/hansen_room_warm_v1023\\.js', ref: 'island_season\\.html', status: 200, ctype: 'text/javascript', body: '/* disabled inside warm room */' }]);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); await srv.close();
save('s05b_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 6000));
