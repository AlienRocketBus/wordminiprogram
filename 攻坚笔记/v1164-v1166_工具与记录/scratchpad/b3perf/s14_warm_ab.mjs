import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
async function run(label, blocks) {
  const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){}
    window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch(e){} } });
  for (const b of blocks) await ctx.route(b, r => r.abort());
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(()=>{}));
  const cdp = await throttle(page);
  await cdp.send('Performance.enable');
  let bytes = 0, n = 0, phase = 0; const urls = new Set();
  cdp.on('Network.loadingFinished', e => { if (phase) { bytes += e.encodedDataLength; n++; } });
  await page.goto(BASE + 'index.html'); await sleep(10000);
  phase = 1;
  const t0 = Date.now();
  await page.evaluate(() => window.openIsland('island_food.html'));
  let ready = -1;
  for (let k = 0; k < 150; k++) { const f = page.frames().find(f => f.url().includes('island_food.html')); if (f) { const ok = await f.evaluate(() => document.querySelectorAll('.mode-card').length >= 14 && document.readyState !== 'loading').catch(() => false); if (ok) { ready = Date.now() - t0; break; } } await sleep(100); }
  const b5 = bytes;
  await sleep(20000 - (Date.now() - t0));
  const f = page.frames().find(f => f.url().includes('island_food.html'));
  const lt = f ? await f.evaluate(() => window.__lt || []).catch(() => []) : [];
  const ltTop = await page.evaluate(() => window.__lt);
  const tbt = [...lt, ...ltTop].filter(([s]) => true).reduce((a, [s, d]) => a + Math.max(0, d - 50), 0);
  const m = await cdp.send('Performance.getMetrics'); const g = k => (m.metrics.find(x => x.name === k) || {}).value;
  const res = { label, readyMs: ready, KB_20s: Math.round(bytes / 1024), req: n, tbt_ms: tbt, frames: g('Frames'), docs: g('Documents'), heapMB: +(g('JSHeapUsedSize') / 1048576).toFixed(1), nodes: g('Nodes') };
  await browser.close();
  return res;
}
const out = [];
out.push(await run('as-is', [])); console.log(JSON.stringify(out.at(-1)));
out.push(await run('no-room-warm', [/hansen_room_warm_v1023\.js/])); console.log(JSON.stringify(out.at(-1)));
out.push(await run('no-room-warm+no-eager-boss-engine', [/hansen_room_warm_v1023\.js/, /hansen_boss_attack\.js/])); console.log(JSON.stringify(out.at(-1)));
fs.writeFileSync(`${O}/out/s14_warm_ab_${process.env.TAG||"x"}.json`, JSON.stringify(out, null, 1));
