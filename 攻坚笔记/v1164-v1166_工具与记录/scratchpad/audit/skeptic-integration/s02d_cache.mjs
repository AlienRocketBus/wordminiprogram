import fs from 'node:fs';
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { waitVisible, dismissWelcome, freshHome, tapMap, waitHidden } from './nav.mjs';
const SRC = fs.readFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/hansen_room_warm_v1023.js', 'utf8');
const variant = process.argv[2] || 'A';
const K = await boot2({ cache: 'public, max-age=3600' });
if (variant === 'B') {
  // serve patched room warm through the server by overriding via init: easier to route only this one file
  const src = SRC.replace("if (document.readyState === 'complete') scheduleWarm();", "if (window.parent !== window) {} else if (document.readyState === 'complete') scheduleWarm();");
  await K.ctx.route(/hansen_room_warm_v1023\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: src, headers: { 'Cache-Control': 'max-age=3600' } }));
}
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
await freshHome(K, page);
await sleep(10000);
const out = (...a) => console.log(variant, ...a);
for (const file of ['island_animal.html', 'island_food.html']) {
  const mark = K.reqs.length;
  const t0 = Date.now();
  await tap(page, page, `a.island[href="${file}"]`);
  const v = await waitVisible(page, file, t0);
  await dismissWelcome(page);
  await sleep(20000 - (Date.now() - t0));
  const rq = K.reqs.slice(mark);
  const bytes = rq.reduce((a, r) => a + (r.bytes || 0), 0);
  const html = rq.filter(r => /\.html/.test(r.path));
  out(file, 'visibleMs', v.ms, '| 20s: server requests', rq.length, 'MB', (bytes / 1e6).toFixed(2), 'html', html.length, html.map(r => r.url).join(' '));
  out('frames()', page.frames().length, page.frames().map(f => f.url().replace(K.base, '')).join(' | '));
  await tapMap(page); await waitHidden(page, Date.now()); await sleep(1500);
}
out('external requests', K.external.length);
await K.done();
