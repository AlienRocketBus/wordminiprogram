import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => {
  window.__perf = { lcp: 0, fcp: 0, longtasks: [] };
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
}});
const page = await ctx.newPage();
const dialogs = []; page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message()); d.dismiss().catch(()=>{}); });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const cdp = await throttle(page);
const reqs = new Map();
cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp, type: e.type }));
cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t1 = e.timestamp; } });
cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; } });
const t0 = Date.now();
page.goto(BASE + 'index.html').catch(() => {});
const shots = [1000, 2000, 3000, 5000, 8000, 12000];
let i = 0; const timeline = [];
for (const ms of shots) {
  await sleep(ms - (Date.now() - t0));
  await page.screenshot({ path: `${O}/shots/s01gz_home_${ms}ms.png` }).catch(()=>{});
  const st = await page.evaluate(() => ({ rs: document.readyState, onb: !!document.getElementById('__hsOnbTitle'), onbTxt: (document.getElementById('__hsOnbTitle')||{}).textContent || '', perf: window.__perf })).catch(e => ({ err: String(e) }));
  timeline.push({ ms, ...st });
}
const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
// net breakdown
const arr = [...reqs.values()];
const byType = {}; let tot = 0;
for (const r of arr) { const k = (r.url.split('?')[0].match(/\.(\w+)$/) || [, 'other'])[1]; byType[k] = byType[k] || { n: 0, bytes: 0 }; byType[k].n++; byType[k].bytes += r.bytes || 0; tot += r.bytes || 0; }
const top = arr.filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 25).map(r => [r.url.replace(BASE, ''), r.bytes]);
// onboarding slides
const slides = [];
for (let k = 0; k < 4; k++) {
  const t = await page.evaluate(() => { const o = document.getElementById('__hsOnbTitle'); if (!o) return null; const b = document.getElementById('__hsOnbBody'); const btns = [...o.closest('[role=dialog]')?.querySelectorAll('button') || []].map(b => b.textContent.trim() + '|' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)); return { title: o.textContent, body: b && b.innerText, btns }; });
  if (!t) break; slides.push(t);
  await page.screenshot({ path: `${O}/shots/s01gz_onb_${k}.png` });
  const clicked = await page.evaluate(() => { const o = document.getElementById('__hsOnbTitle').closest('[role=dialog]'); const btns = [...o.querySelectorAll('button')]; const nx = btns.find(b => /下一步|开始|出发|好的|知道/.test(b.textContent)) || btns[btns.length - 1]; nx.click(); return nx.textContent; });
  slides[slides.length - 1].clicked = clicked;
  await sleep(800);
}
await sleep(1500);
await page.screenshot({ path: `${O}/shots/s01gz_home_after_onb.png` });
await page.screenshot({ path: `${O}/shots/s01gz_home_after_onb_full.png`, fullPage: true });
const after = await page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const overlays = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); return (s.position === 'fixed') && vis(el) && el.getBoundingClientRect().width > 200 && el.getBoundingClientRect().height > 200; }).map(el => (el.id || el.className || el.tagName) + ': ' + el.innerText.slice(0, 120).replace(/\s+/g, ' '));
  return { overlays, scrollH: document.documentElement.scrollHeight, text: document.body.innerText.slice(0, 1500) };
});
fs.writeFileSync(`${O}/out/s01gz_firstrun.json`, JSON.stringify({ timeline, nav, totReqs: arr.length, totBytes: tot, byType, top, slides, after, dialogs, errs }, null, 1));
console.log(JSON.stringify({ nav, totReqs: arr.length, totBytes: tot, byType, timeline: timeline.map(t => [t.ms, t.rs, t.onb, t.perf && Math.round(t.perf.fcp), t.perf && Math.round(t.perf.lcp)]), slides, dialogs, errs: errs.slice(0, 5), overlays: after.overlays }, null, 1));
await browser.close();
