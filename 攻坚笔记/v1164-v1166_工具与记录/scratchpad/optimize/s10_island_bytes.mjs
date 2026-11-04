import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const isl = process.argv[2] || 'food';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
const cdp = await throttle(page);
const reqs = new Map(); let phase = 'home';
cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url.replace(BASE, ''), phase, t: e.timestamp }));
cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
await page.goto(BASE + 'index.html'); await sleep(10000);
phase = 'island';
const t0 = Date.now();
await page.evaluate(f => window.openIsland(f), `island_${isl}.html`);
const marks = {};
for (const ms of [2000, 5000, 15000]) { await sleep(ms - (Date.now() - t0)); marks[ms] = [...reqs.values()].filter(r => r.phase === 'island' && r.bytes).reduce((a, r) => a + r.bytes, 0); }
const arr = [...reqs.values()].filter(r => r.phase === 'island' && r.bytes);
const cat = {};
for (const r of arr) { const u = r.url.split('?')[0]; const k = u.includes('/') ? u.split('/')[0] + '/' : (u.match(/\.(\w+)$/) || [, 'x'])[1]; cat[k] = cat[k] || { n: 0, kb: 0 }; cat[k].n++; cat[k].kb += r.bytes / 1024; }
for (const k in cat) cat[k].kb = Math.round(cat[k].kb);
console.log('cumulative KB at', Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Math.round(v / 1024)])));
console.log(JSON.stringify(cat));
console.log(arr.sort((a, b) => b.bytes - a.bytes).slice(0, 25).map(r => Math.round(r.bytes / 1024) + 'KB ' + r.url).join('\n'));
fs.writeFileSync(`${O}/out/s10_${isl}_bytes.json`, JSON.stringify({ marks, cat, arr }, null, 1));
await browser.close();
