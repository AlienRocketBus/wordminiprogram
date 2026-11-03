import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
const cdp = await throttle(page);
await cdp.send('Performance.enable');
let bytes = 0, nreq = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; nreq++; });
async function heap() { const m = await cdp.send('Performance.getMetrics'); const g = k => (m.metrics.find(x => x.name === k) || {}).value; return { heapMB: +(g('JSHeapUsedSize') / 1048576).toFixed(1), nodes: g('Nodes'), docs: g('Documents'), frames: g('Frames'), listeners: g('JSEventListeners') }; }
const t0 = Date.now();
await page.goto(BASE + 'index.html', { waitUntil: 'load' });
const homeLoad = Date.now() - t0;
await sleep(10000);
const res = { homeLoad, afterHomeIdle: { bytes, nreq, ...(await heap()) }, islands: [] };
const list = ['animal', 'food', 'sports', 'job', 'color', 'nature', 'action', 'traffic', 'body', 'city', 'clothes', 'home', 'family', 'school', 'time'];
for (const isl of list) {
  bytes = 0; nreq = 0;
  const t1 = Date.now();
  await page.evaluate(f => window.openIsland(f), `island_${isl}.html`);
  // wait until iframe doc has mode cards rendered & visible
  let ready = -1;
  for (let k = 0; k < 200; k++) {
    const f = page.frames().find(f => f.url().includes(`island_${isl}.html`));
    if (f) { const ok = await f.evaluate(() => { const c = document.querySelectorAll('.mode-card'); return c.length >= 14 && document.readyState !== 'loading' && !!document.querySelector('.mode-card img') && document.querySelector('.mode-card img').complete; }).catch(() => false); if (ok) { ready = Date.now() - t1; break; } }
    await sleep(100);
  }
  await sleep(3000);
  const h = await heap();
  res.islands.push({ isl, readyMs: ready, bytes, nreq, ...h });
  console.log(isl, 'ready', ready, 'ms', 'bytes', Math.round(bytes / 1024) + 'KB', 'req', nreq, JSON.stringify(h));
  await page.evaluate(() => window.closeIsland());
  await sleep(1200);
}
try { await cdp.send('HeapProfiler.collectGarbage'); } catch (e) {}
await sleep(1000);
res.final = await heap();
console.log('final after GC', JSON.stringify(res.final));
fs.writeFileSync(`${O}/out/s09_perf_islands.json`, JSON.stringify(res, null, 1));
await browser.close();
