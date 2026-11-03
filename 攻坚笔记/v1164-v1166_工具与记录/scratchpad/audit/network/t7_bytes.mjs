import { launch, newCtx, attach, save, startServer, SNAP, OUT, sleep, waitSwActive } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
// How many bytes does a first visit to the HOME page pull (no island tapped), and what is fetched twice?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
function sizeOf(p) { try { return fs.statSync(path.join(SNAP, decodeURIComponent(p.split('?')[0]))).size; } catch (e) { return 0; } }
for (const mode of ['sw', 'nosw']) {
  const ctx = await newCtx(browser, { sw: mode === 'sw' });
  const page = await ctx.newPage();
  srv.getLog();
  await page.goto(O + '/', { waitUntil: 'load' });
  if (mode === 'sw') await waitSwActive(page);
  await sleep(40000);
  const log = srv.getLog().filter(x => !/VERSION/.test(x.path));
  const by = {};
  let total = 0;
  const cats = {};
  for (const x of log) {
    const p = x.path;
    const sz = x.status === 200 ? sizeOf(p) : 0;
    total += sz;
    const key = p.split('?')[0];
    by[key] = by[key] || { n: 0, bytes: 0, dests: [] };
    by[key].n++; by[key].bytes += sz; by[key].dests.push(x.dest + '/' + x.status + (p.includes('?') ? '?' + p.split('?')[1] : ''));
    const cat = /\.html/.test(key) ? 'html' : /\.js$/.test(key) ? 'js' : /\.(webp|png|jpg|gif|svg)$/.test(key) ? 'img' : /\.mp3$/.test(key) ? 'audio' : 'other';
    cats[cat] = (cats[cat] || 0) + sz;
  }
  const dup = Object.entries(by).filter(([k, v]) => v.n > 1 && v.bytes > 0).sort((a, b) => b[1].bytes - a[1].bytes);
  R[mode] = {
    requests: log.length, totalMB: +(total / 1048576).toFixed(2), catsMB: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, +(v / 1048576).toFixed(2)])),
    htmlFetched: Object.entries(by).filter(([k]) => /\.html/.test(k)).map(([k, v]) => k + ' x' + v.n + ' ' + Math.round(v.bytes / 1024) + 'KB ' + v.dests.join(',')),
    dupBytesMB: +(dup.reduce((s, [k, v]) => s + v.bytes - v.bytes / v.n, 0) / 1048576).toFixed(2),
    topDup: dup.slice(0, 12).map(([k, v]) => k + ' x' + v.n + ' ' + Math.round(v.bytes / 1024) + 'KB ' + v.dests.join(','))
  };
  await ctx.close();
}
await browser.close(); srv.server.close();
save('t7_result.json', R);
console.log(JSON.stringify(R, null, 1));
