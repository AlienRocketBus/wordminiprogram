import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer } from './server.mjs';
const { srv, port } = await startServer(); const O = `http://127.0.0.1:${port}`;
const b = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.route('**/*', r => r.request().url().startsWith(O) ? r.continue() : r.abort());
await ctx.addInitScript(() => { addEventListener('unhandledrejection', e => { try { console.log('REJ in ' + location.pathname + ': ' + String(e.reason && (e.reason.stack || e.reason)).slice(0, 200)); } catch (_) {} }); });
const p = await ctx.newPage();
let step = 'load'; const errs = [];
p.on('pageerror', e => errs.push(step + ' :: ' + String(e.message || e).slice(0, 160)));
p.on('console', m => { if (m.text().startsWith('REJ')) errs.push(step + ' :: ' + m.text()); });
await p.goto(`${O}/index.html`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
const sk = p.locator('#__hsOnbSkip'); if (await sk.count()) await sk.click();
const seq = ['island_food.html', 'island_animal.html', 'island_food.html', 'island_sports.html', 'island_job.html', 'island_color.html'];
for (let i = 0; i < seq.length; i++) {
  step = 'open ' + seq[i];
  await p.evaluate(f => openIsland(f), seq[i]); await p.waitForTimeout(4000);
  step = 'close after ' + seq[i];
  await p.evaluate(() => closeIsland()); await p.waitForTimeout(1500);
}
// in-island home button (goHome) path
step = 'goHome from island';
await p.evaluate(() => openIsland('island_food.html')); await p.waitForTimeout(4000);
const fr = p.frames().find(f => f.url().endsWith('/island_food.html'));
if (fr) await fr.evaluate(() => window.goHome && window.goHome());
await p.waitForTimeout(2000);
console.log(JSON.stringify(errs, null, 1));
await b.close(); srv.close();
