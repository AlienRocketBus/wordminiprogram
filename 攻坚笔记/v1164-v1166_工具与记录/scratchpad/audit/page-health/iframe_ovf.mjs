import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer } from './server.mjs';
const { srv, port } = await startServer(); const O = `http://127.0.0.1:${port}`;
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (const W of [360, 375, 390]) for (const pg of ['season_showcase.html?v=1163&boss=s1', 'boss_hall.html?v=1163&lv=1&own=1']) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(O) ? r.continue() : r.abort());
  const p = await ctx.newPage();
  // top-level
  await p.goto(`${O}/${pg}`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const top = await p.evaluate(() => { const c = document.getElementById('closePg'); const r = c && c.getBoundingClientRect(); return { innerW: innerWidth, close: r ? [Math.round(r.left), Math.round(r.right), getComputedStyle(c).display] : null }; });
  // inside iframe like the app does
  await p.goto(`${O}/_sw_upgrade_v944.html`, { waitUntil: 'load' });
  await p.evaluate(u => { document.body.innerHTML = ''; const f = document.createElement('iframe'); f.id = 'x'; f.src = u; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; document.body.appendChild(f); }, pg);
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f.url().includes(pg.split('?')[0]));
  const inf = fr ? await fr.evaluate(() => { const c = document.getElementById('closePg'); const r = c && c.getBoundingClientRect(); return { innerW: innerWidth, sw: document.scrollingElement.scrollWidth, close: r ? [Math.round(r.left), Math.round(r.right), getComputedStyle(c).display] : null }; }) : 'no frame';
  console.log(W, pg.split('?')[0], 'TOP', JSON.stringify(top), 'IFRAME', JSON.stringify(inf));
  await ctx.close();
}
await b.close(); srv.close();
