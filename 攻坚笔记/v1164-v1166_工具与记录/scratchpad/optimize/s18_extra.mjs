import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'index.html'); await sleep(3500);
const box = await page.evaluate(() => { const el = document.getElementById('hsnSeasonBar'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await sleep(400);
await page.touchscreen.tap(box.x, box.y); await sleep(5000);
await page.screenshot({ path: `${O}/shots/s18_extra_1.png` });
const frames = page.frames().map(f => f.url().replace(BASE, ''));
const f = page.frames().find(f => /land_map|island_season/.test(f.url()));
const txt = f ? await f.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 1500)) : await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log(frames); console.log(txt);
if (f) { await f.evaluate(() => window.scrollTo(0, 700)); await sleep(800); await page.screenshot({ path: `${O}/shots/s18_extra_2.png` }); }
await browser.close();
