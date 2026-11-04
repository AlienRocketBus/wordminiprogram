import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const out = {};
for (const [label, url, noAnim] of [['home', 'index.html', false], ['home-noAnim', 'index.html', true], ['island', 'island_food.html', false], ['island-noAnim', 'island_food.html', true]]) {
  const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
  await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
  const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
  const cdp = await throttle(page, { net: false, cpu: 4 });
  await cdp.send('Performance.enable');
  await page.goto(BASE + url); await sleep(12000);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  if (noAnim) await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await sleep(3000);
  const g = async () => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
  const m0 = await g(); await sleep(10000); const m1 = await g();
  out[label] = { busyPct: Math.round((m1.TaskDuration - m0.TaskDuration) / 10 * 100), scriptPct: Math.round((m1.ScriptDuration - m0.ScriptDuration) / 10 * 100) };
  console.log(label, JSON.stringify(out[label]));
  await browser.close();
}
fs.writeFileSync(`${O}/out/s31_anim_ab.json`, JSON.stringify(out, null, 1));
