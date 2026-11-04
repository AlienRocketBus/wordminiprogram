import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { if (location.pathname.endsWith('index.html')) localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
const dialogs = []; page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message().slice(0,200)); d.dismiss().catch(()=>{}); });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(BASE + 'index.html'); await sleep(3000);
const cdp = await throttle(page);
const reqs = new Map();
cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp }));
cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t1 = e.timestamp; } });
// tap the animal card
const box = await page.evaluate(() => { const el = [...document.querySelectorAll('[onclick], a, button')].find(e => /动物大冒险/.test(e.innerText)); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await sleep(500);
const t0 = Date.now();
await page.touchscreen.tap(box.x, box.y);
const tl = [];
for (const ms of [500, 1000, 2000, 3000, 5000, 8000]) {
  await sleep(ms - (Date.now() - t0));
  await page.screenshot({ path: `${O}/shots/s03_island_${ms}ms.png` });
  const f = page.frames().find(f => /island_animal/.test(f.url()));
  const st = f ? await f.evaluate(() => ({ rs: document.readyState, txt: document.body ? document.body.innerText.slice(0, 200).replace(/\s+/g, ' ') : '' })).catch(e => ({ e: String(e).slice(0, 80) })) : null;
  tl.push({ ms, st });
}
const arr = [...reqs.values()];
let tot = 0; for (const r of arr) tot += r.bytes || 0;
const top = arr.filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 30).map(r => [r.url.replace(BASE, ''), r.bytes]);
const f = page.frames().find(f => /island_animal/.test(f.url()));
const welcome = await f.evaluate(() => document.body.innerText.slice(0, 3000));
fs.writeFileSync(`${O}/out/s03_island.json`, JSON.stringify({ tl, nreq: arr.length, tot, top, welcome, dialogs, errs }, null, 1));
console.log(JSON.stringify({ tl, nreq: arr.length, tot, top: top.slice(0, 30), dialogs, errs }, null, 1));
console.log(welcome.slice(0, 1500));
await browser.close();
