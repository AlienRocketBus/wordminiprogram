import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer } from './server.mjs';
const { srv, port } = await startServer(); const O = `http://127.0.0.1:${port}`;
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (const W of [320, 360, 375, 390, 414]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(O) ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const meas = () => { const out = []; document.querySelectorAll('button.spot').forEach(s => { const r = s.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth) out.push([s.innerText.replace(/\n/g, ' ').slice(0, 14), Math.round(r.left), Math.round(r.right)]); }); return { innerW: innerWidth, cut: out }; };
  await p.goto(`${O}/land_map.html?v=1163`, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  const top = await p.evaluate(meas);
  await p.goto(`${O}/_sw_upgrade_v944.html`, { waitUntil: 'load' });
  await p.evaluate(() => { document.body.innerHTML = ''; const f = document.createElement('iframe'); f.src = 'land_map.html?v=1163'; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; document.body.appendChild(f); });
  await p.waitForTimeout(2000);
  const fr = p.frames().find(f => f.url().includes('land_map'));
  const inf = await fr.evaluate(meas);
  if (W === 360) await p.screenshot({ path: 'shots/land_map_iframe_360.png' });
  console.log(W, 'TOP', JSON.stringify(top), 'IFRAME', JSON.stringify(inf));
  await ctx.close();
}
await b.close(); srv.close();
