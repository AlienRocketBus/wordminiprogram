import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer, hits } from './server.mjs';
const { srv, port } = await startServer(); const O = `http://127.0.0.1:${port}`;
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.route('**/*', r => r.request().url().startsWith(O) ? r.continue() : r.abort());
const p = await ctx.newPage();
await p.goto(`${O}/index.html`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
await p.waitForTimeout(1500);
const sk = p.locator('#__hsOnbSkip'); console.log('skip count', await sk.count()); if (await sk.count()) { const bb = await sk.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
await p.waitForTimeout(800);
const state = () => p.evaluate(() => { const fr = document.getElementById('islandFrame'); let path = ''; try { path = fr.contentWindow.location.pathname; } catch (e) {} return { iframe: path, wrap: document.getElementById('islandFrameWrap').style.display, histLen: history.length, state: JSON.stringify(history.state) }; });
const navHits = () => hits.filter(h => /^\/island_[a-z0-9]+\.html( |$)/.test(h[0] + ' ') && !h[0].includes('?')).map(h => h.join(' '));
const log = [];
async function tapCard(file) {
  const card = p.locator(`a.island[href="${file}"]`).first();
  await card.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const bx = await card.boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
}
async function homeBtn() { // the island's own 🏠 button path = goHome()
  const fr = await (await p.$('#islandFrame')).contentFrame();
  log.push({ goHomeFrom: fr.url().replace(O, ''), st: await state() });
  if (!/island_/.test(fr.url())) { console.log(JSON.stringify(log, null, 1)); process.exit(2); }
  await fr.evaluate(() => goHome());
}
for (const f of ['island_food.html', 'island_animal.html', 'island_sports.html']) {
  await tapCard(f); await p.waitForTimeout(5000);
  log.push({ after: 'open ' + f, ...(await state()), navHits: navHits() });
  await homeBtn(); await p.waitForTimeout(5000);
  log.push({ after: 'goHome from ' + f, ...(await state()), navHits: navHits() });
}
// reopen animal: is it instant (kept alive) or reloaded?
const before = navHits().length;
await tapCard('island_animal.html'); await p.waitForTimeout(3000);
log.push({ after: 'reopen island_animal', ...(await state()), newNavHits: navHits().slice(before) });
console.log(JSON.stringify(log, null, 1));
await b.close(); srv.close();
