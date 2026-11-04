import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const out = {};
const names = ['none', 'twinkle', 'worldMapFloat', 'wmbGlowD', 'hsnPetFloatSlow', 'chestSlowGlow'];
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
const cdp = await throttle(page, { net: false, cpu: 4 });
await cdp.send('Performance.enable');
await page.goto(BASE + 'island_food.html'); await sleep(12000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
await sleep(2000);
const g = async () => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
for (const n of names) {
  await page.evaluate(n => { document.getAnimations().forEach(a => { if (a.animationName === n) a.pause(); else a.play(); }); }, n);
  await sleep(1500);
  const m0 = await g(); await sleep(6000); const m1 = await g();
  out[n] = Math.round((m1.TaskDuration - m0.TaskDuration) / 6 * 100);
  const tgt = await page.evaluate(n => { const a = document.getAnimations().find(a => a.animationName === n); if (!a) return ''; const t = a.effect.target; const r = t.getBoundingClientRect(); return (t.id || t.className || t.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }, n);
  console.log('paused', n, 'busy%', out[n], tgt);
}
fs.writeFileSync(`${O}/out/s32_anim_each.json`, JSON.stringify(out, null, 1));
await browser.close();
