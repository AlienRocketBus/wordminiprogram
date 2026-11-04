// INT-02 realistic cost: with Cache-Control max-age (like a CDN), compare as-shipped vs warm-disabled-in-frames
import fs from 'node:fs';
import { boot, sleep, tap } from './kit.mjs';
import { waitVisible, dismissWelcome, freshHome } from './nav.mjs';
const SRC = fs.readFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/hansen_room_warm_v1023.js', 'utf8');
async function run(variant) {
  const K = await boot({ cache: 'public, max-age=3600' });
  if (variant === 'B') {
    const src = SRC.replace("if (document.readyState === 'complete') scheduleWarm();", "if (window.parent !== window) {} else if (document.readyState === 'complete') scheduleWarm();");
    await K.ctx.route(/hansen_room_warm_v1023\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: src }));
  }
  const page = await K.ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const cdp = await K.ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await freshHome(K, page);
  await sleep(10000);
  const m0 = await met();
  const mark = K.reqs.length;
  const t0 = Date.now();
  await tap(page, page, 'a.island[href="island_animal.html"]');
  const v = await waitVisible(page, 'island_animal.html', t0);
  await dismissWelcome(page);
  await sleep(20000 - (Date.now() - t0));
  const m1 = await met();
  const rq = K.reqs.slice(mark);
  const bytes = rq.reduce((a, r) => a + (r.bytes || 0), 0);
  const html = rq.filter(r => /\.html/.test(r.path));
  console.log(variant, 'visibleMs', v.ms, '| 20s after tap: server requests', rq.length, 'MB', (bytes / 1e6).toFixed(2), 'html', html.length, html.map(r => r.url).join(' '));
  console.log(variant, 'renderer TaskDuration s', (m1.TaskDuration - m0.TaskDuration).toFixed(2), 'ScriptDuration s', (m1.ScriptDuration - m0.ScriptDuration).toFixed(2), 'JSHeapUsedMB', (m1.JSHeapUsedSize / 1e6).toFixed(1), 'Documents', m1.Documents, 'Frames', m1.Frames, 'frames()', page.frames().length);
  await K.done();
}
await run('A');
await run('B');
