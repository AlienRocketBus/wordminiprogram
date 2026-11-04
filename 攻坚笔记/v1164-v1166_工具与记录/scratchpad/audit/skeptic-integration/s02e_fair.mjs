import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { waitVisible, dismissWelcome, freshHome, tapMap, waitHidden } from './nav.mjs';
const variant = process.argv[2] || 'A';
const override = variant === 'B' ? { '/hansen_room_warm_v1023.js': '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/skeptic-integration/room_warm_noframe.js' } : undefined;
const K = await boot2({ cache: 'public, max-age=3600', override });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const cdp = await K.ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
await freshHome(K, page);
await sleep(10000);
const out = (...a) => console.log(variant, ...a);
for (const file of ['island_animal.html', 'island_food.html', 'island_sports.html']) {
  const mark = K.reqs.length; const m0 = await met();
  const t0 = Date.now();
  await tap(page, page, `a.island[href="${file}"]`);
  const v = await waitVisible(page, file, t0);
  await dismissWelcome(page);
  await sleep(20000 - (Date.now() - t0));
  const m1 = await met();
  const rq = K.reqs.slice(mark);
  const bytes = rq.reduce((a, r) => a + (r.bytes || 0), 0);
  const html = rq.filter(r => /\.html/.test(r.path));
  out(file, 'visibleMs', v.ms, '| 20s: server requests', rq.length, 'MB', (bytes / 1e6).toFixed(2), 'html', html.length, '| ScriptDur s', (m1.ScriptDuration - m0.ScriptDuration).toFixed(2), 'TaskDur s', (m1.TaskDuration - m0.TaskDuration).toFixed(2), 'heapMB', (m1.JSHeapUsedSize / 1e6).toFixed(1), 'docs', m1.Documents, 'frames', page.frames().length);
  await tapMap(page); await waitHidden(page, Date.now()); await sleep(1500);
}
await K.done();
