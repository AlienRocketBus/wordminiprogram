import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
async function run(label, blocks) {
  const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
  for (const b of blocks) await ctx.route(b, r => r.abort());
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(()=>{}));
  const cdp = await throttle(page);
  await cdp.send('Performance.enable');
  let bytes = 0, phase = 0; cdp.on('Network.loadingFinished', e => { if (phase) bytes += e.encodedDataLength; });
  await page.goto(BASE + 'index.html'); await sleep(10000);
  const g = async () => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
  const m0 = await g(); phase = 1;
  const t0 = Date.now();
  await page.evaluate(() => window.openIsland('island_food.html'));
  let ready = -1;
  for (let k = 0; k < 150; k++) { const f = page.frames().find(f => f.url().includes('island_food.html')); if (f) { const ok = await f.evaluate(() => document.querySelectorAll('.mode-card').length >= 14 && document.readyState !== 'loading').catch(() => false); if (ok) { ready = Date.now() - t0; break; } } await sleep(100); }
  await sleep(25000 - (Date.now() - t0));
  const m1 = await g();
  const res = { label, readyMs: ready, MB_25s: +(bytes / 1048576).toFixed(1), scriptSec: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(2), taskSec: +(m1.TaskDuration - m0.TaskDuration).toFixed(2), layoutSec: +(m1.LayoutDuration - m0.LayoutDuration).toFixed(2), frames: m1.Frames, heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), nodes: m1.Nodes };
  await browser.close();
  return res;
}
const out = [];
for (let rep = 0; rep < 2; rep++) {
  out.push(await run('as-is', [])); console.log(JSON.stringify(out.at(-1)));
  out.push(await run('no-room-warm', [/hansen_room_warm_v1023\.js/])); console.log(JSON.stringify(out.at(-1)));
}
fs.writeFileSync(`${O}/out/s29_warm_cpu.json`, JSON.stringify(out, null, 1));
