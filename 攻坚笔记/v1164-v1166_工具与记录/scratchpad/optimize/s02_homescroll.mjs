import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const theme = process.argv[2] || 'light';
const { browser, ctx } = await launch({ colorScheme: theme==='dark'?'dark':'light', init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'index.html'); await sleep(4000);
const H = await page.evaluate(() => document.documentElement.scrollHeight);
let k = 0;
for (let y = 0; y < H; y += 800) { await page.evaluate(y => window.scrollTo(0, y), y); await sleep(600); await page.screenshot({ path: `${O}/shots/s02_${theme}_scroll${k++}.png` }); }
// list all fixed/floating controls and their sizes
const ctrls = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, a, [onclick], [role=button]')) {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
    let fixed = false; for (let p = el; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).position === 'fixed') { fixed = true; break; } }
    out.push({ t: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), fixed, id: el.id });
  }
  return out;
});
fs.writeFileSync(`${O}/out/s02_${theme}_ctrls.json`, JSON.stringify({ H, ctrls }, null, 1));
console.log(H, ctrls.length, ctrls.filter(c => c.fixed).map(c => `${c.t}|${c.w}x${c.h}|${c.id}`).join('\n'));
await browser.close();
