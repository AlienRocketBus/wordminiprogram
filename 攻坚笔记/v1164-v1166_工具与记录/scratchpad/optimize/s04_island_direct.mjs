import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const isl = process.argv[2] || 'animal';
const tag = process.argv[3] || 'fresh';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + `island_${isl}.html`); await sleep(4000);
await page.screenshot({ path: `${O}/shots/s04_${isl}_${tag}_welcome.png` });
// click 开始冒险
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent)); if (b) b.click(); });
await sleep(1500);
const H = await page.evaluate(() => document.documentElement.scrollHeight);
let k = 0;
for (let y = 0; y < H; y += 760) { await page.evaluate(y => window.scrollTo(0, y), y); await sleep(500); await page.screenshot({ path: `${O}/shots/s04_${isl}_${tag}_s${k++}.png` }); }
const ctrls = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, a, [onclick], [role=button], .mode-card, [class*=card]')) {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
    out.push({ t: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), cls: String(el.className).slice(0, 40), id: el.id });
  }
  return out;
});
fs.writeFileSync(`${O}/out/s04_${isl}_${tag}.json`, JSON.stringify({ H, ctrls }, null, 1));
console.log(H, k);
await browser.close();
