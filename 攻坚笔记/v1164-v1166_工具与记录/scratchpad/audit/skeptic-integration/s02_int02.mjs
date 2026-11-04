// INT-02: hidden warm frames inside every island; request/bytes cost; persistence on home
import fs from 'node:fs';
import { boot, sleep, tap } from './kit.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const variant = process.argv[2] || 'A'; // A = as shipped, B = room warm disabled inside frames
const K = await boot();
if (variant === 'B') {
  const src = fs.readFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/hansen_room_warm_v1023.js', 'utf8')
    .replace("if (document.readyState === 'complete') scheduleWarm();", "if (window.parent !== window) {} else if (document.readyState === 'complete') scheduleWarm();");
  await K.ctx.route(/hansen_room_warm_v1023\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: src }));
}
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(variant, ...a);
function tree(f, d = 0) { let s = '  '.repeat(d) + f.url().replace(K.base, '') + '\n'; for (const c of f.childFrames()) s += tree(c, d + 1); return s; }
await freshHome(K, page);
await sleep(8000); // let home settle its own preloads
const mark = K.reqs.length;
const t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
const v = await waitVisible(page, 'island_animal.html', t0);
out('visibleMs', v.ms);
await dismissWelcome(page);
await sleep(15000 - (Date.now() - t0));
const rq = K.reqs.slice(mark);
const html = rq.filter(r => /\.html/.test(r.path));
const bytes = rq.reduce((a, r) => a + (r.bytes || 0), 0);
const byExt = {};
for (const r of rq) { const e = (r.path.match(/\.([a-z0-9]+)$/) || [, 'other'])[1]; byExt[e] = (byExt[e] || 0) + (r.bytes || 0); }
out('15s after tap: requests', rq.length, 'MB', (bytes / 1e6).toFixed(1), 'html pages', html.length);
out('html list:', html.map(r => r.url).join(' '));
out('MB by ext:', JSON.stringify(Object.fromEntries(Object.entries(byExt).map(([k, v]) => [k, +(v / 1e6).toFixed(2)]))));
out('frame tree while in island:\n' + tree(page.mainFrame()));
out('frame count', page.frames().length);
// close and look at what stays alive on home
await tapMap(page);
await waitHidden(page, Date.now());
await sleep(3000);
out('frame tree on home after close:\n' + tree(page.mainFrame()));
out('frame count on home', page.frames().length);
// is the season warm frame's document running JS? check a timer counter
const seasonFrames = page.frames().filter(f => /island_season/.test(f.url()));
for (const f of seasonFrames) {
  const info = await f.evaluate(() => ({ rs: document.readyState, hasS: typeof S !== 'undefined', vis: document.visibilityState })).catch(e => 'ERR ' + e.message.slice(0, 80));
  out('season frame', f.url().replace(K.base, ''), JSON.stringify(info));
}
await K.done();
