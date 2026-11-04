// INT-01 cost with a realistic HTTP cache: what does the background reload of the first island cost while the child sits on home?
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const cdp = await K.ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await sleep(1500);
for (const file of ['island_animal.html', 'island_food.html']) {
  const t0 = Date.now();
  await tap(page, page, `a.island[href="${file}"]`);
  await waitVisible(page, file, t0);
  await dismissWelcome(page, 3000);
  await sleep(9000);
  const m0 = await met(); const mark = K.reqs.length;
  await tapMap(page); await waitHidden(page, Date.now());
  await sleep(8000);
  const m1 = await met();
  const rq = K.reqs.slice(mark);
  out(`8 s on home after closing ${file}: iframe=${(await islandState(page)).path} server requests=${rq.length} (${(rq.reduce((a, r) => a + r.bytes, 0) / 1e6).toFixed(2)} MB; html: ${rq.filter(r => /\.html/.test(r.path)).map(r => r.url).join(' ')}) ScriptDuration=${(m1.ScriptDuration - m0.ScriptDuration).toFixed(2)}s TaskDuration=${(m1.TaskDuration - m0.TaskDuration).toFixed(2)}s live docs ${m0.Documents}->${m1.Documents} frames=${page.frames().length}`);
}
await K.done();
