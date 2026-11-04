import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const out = {};
for (const [label, url, block] of [['home', 'index.html', false], ['island', 'island_food.html', false], ['island-noWarm', 'island_food.html', true]]) {
  const { browser, ctx } = await launch({ init: () => {
    try { localStorage.setItem('hansen_onboarded','1'); } catch(e){}
    window.__raf = 0; const _r = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { window.__raf++; return _r.call(window, cb); };
    window.__timers = 0; const _si = window.setInterval; window.setInterval = function (f, ms) { window.__timers++; return _si.call(window, f, ms); };
  }});
  if (block) await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
  const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
  const cdp = await throttle(page, { net: false, cpu: 4 });
  await cdp.send('Performance.enable');
  await page.goto(BASE + url); await sleep(15000);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  await sleep(3000);
  const g = async () => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
  const r0 = await page.evaluate(() => window.__raf); const m0 = await g();
  await sleep(10000);
  const r1 = await page.evaluate(() => window.__raf); const m1 = await g();
  const anims = await page.evaluate(() => { const a = document.getAnimations(); const running = a.filter(x => x.playState === 'running'); const names = {}; for (const x of running) { const n = x.animationName || (x.effect && x.effect.target && (x.effect.target.className || x.effect.target.id)) || 'js'; names[n] = (names[n] || 0) + 1; } return { total: a.length, running: running.length, top: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 12) }; });
  const canv = await page.evaluate(() => document.querySelectorAll('canvas').length);
  out[label] = { busyPct: Math.round((m1.TaskDuration - m0.TaskDuration) / 10 * 100), scriptPct: Math.round((m1.ScriptDuration - m0.ScriptDuration) / 10 * 100), layoutPct: Math.round((m1.LayoutDuration - m0.LayoutDuration) / 10 * 100), recalcPct: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) / 10 * 100), rafPerSec: (r1 - r0) / 10, canvases: canv, anims };
  console.log(label, JSON.stringify(out[label]));
  await browser.close();
}
fs.writeFileSync(`${O}/out/s30_idle.json`, JSON.stringify(out, null, 1));
