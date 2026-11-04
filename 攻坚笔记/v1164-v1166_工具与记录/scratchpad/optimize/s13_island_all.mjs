import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
const rows = new Map();
cdp.on('Network.requestWillBeSent', e => { const i = e.initiator; let by = i.type; if (i.url) by += ' ' + i.url.replace(BASE, '').split('?')[0] + ':' + (i.lineNumber||''); if (i.stack) { let s = i.stack; const fr = []; while (s) { for (const c of s.callFrames.slice(0, 2)) fr.push(c.url.replace(BASE, '').split('?')[0] + ':' + c.lineNumber); s = s.parent; if (fr.length > 3) break; } by += ' ' + fr.join('<'); } rows.set(e.requestId, { url: e.request.url.replace(BASE, ''), by, t: e.timestamp, frame: e.frameId }); });
cdp.on('Network.loadingFinished', e => { const r = rows.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
await page.goto(BASE + 'island_food.html'); await sleep(12000);
const arr = [...rows.values()].filter(r => r.bytes);
const t0 = Math.min(...arr.map(r => r.t));
// group by initiator script (first file)
const g = {};
for (const r of arr) { const k = r.by.replace(/^(script|parser|other)\s*/, '$1 ').split(/[:<]/)[0].trim(); g[k] = g[k] || { n: 0, kb: 0 }; g[k].n++; g[k].kb += r.bytes / 1024; }
const gs = Object.entries(g).sort((a, b) => b[1].kb - a[1].kb).map(([k, v]) => `${Math.round(v.kb)}KB ${v.n} ${k}`);
console.log(gs.slice(0, 20).join('\n'));
console.log('frames', page.frames().map(f => f.url().replace(BASE, '')));
console.log(arr.filter(r => r.bytes > 60000).sort((a, b) => a.t - b.t).map(r => (r.t - t0).toFixed(1) + 's ' + Math.round(r.bytes / 1024) + 'KB ' + r.url.slice(0, 45) + ' <= ' + r.by.slice(0, 120)).join('\n'));
await browser.close();
