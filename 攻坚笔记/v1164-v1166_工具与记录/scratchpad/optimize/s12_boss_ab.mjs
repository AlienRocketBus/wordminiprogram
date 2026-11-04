import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
async function run(blockBoss) {
  const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){}
    window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch(e){} } });
  if (blockBoss) await ctx.route(/hansen_boss_attack\.js/, r => r.abort());
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(()=>{}));
  const cdp = await throttle(page);
  let bytes = 0, n = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; n++; });
  const t0 = Date.now();
  await page.goto(BASE + 'island_food.html', { waitUntil: 'domcontentloaded' });
  const dcl = Date.now() - t0;
  await sleep(12000);
  const lt = await page.evaluate(() => window.__lt);
  const tbt = lt.reduce((a, [s, d]) => a + Math.max(0, d - 50), 0);
  const long = lt.filter(([s, d]) => d > 200);
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: p && Math.round(p.startTime) }; });
  await browser.close();
  return { blockBoss, nav, bytesKB: Math.round(bytes / 1024), n, tbt, nLong: lt.length, longOver200: long };
}
const a = await run(false); console.log(JSON.stringify(a));
const b = await run(true); console.log(JSON.stringify(b));
fs.writeFileSync(`${O}/out/s12_boss_ab.json`, JSON.stringify({ a, b }, null, 1));
