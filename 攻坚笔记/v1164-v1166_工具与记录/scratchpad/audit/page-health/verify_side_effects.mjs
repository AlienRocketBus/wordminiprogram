import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer } from './server.mjs';
const { srv, port } = await startServer(); const O = `http://127.0.0.1:${port}`;
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.route('**/*', r => r.request().url().startsWith(O) ? r.continue() : r.abort());
const p = await ctx.newPage();
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto(`${O}/index.html`, { waitUntil: 'load' }); await p.waitForTimeout(3000);
const sk = p.locator('#__hsOnbSkip'); if (await sk.count()) { const bb = await sk.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
await p.waitForTimeout(800);
const card = p.locator('a.island[href="island_food.html"]').first();
await card.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
let bx = await card.boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
await p.waitForTimeout(15000);
const fr = await (await p.$('#islandFrame')).contentFrame();
const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /^hsn_progress:|^wordIsland[A-Z][a-zA-Z0-9]*$/.test(k)));
console.log('progress keys after opening ONLY the food island:', JSON.stringify(keys));
const panel = await fr.evaluate(async () => { HansenMyLearning._open(); await new Promise(r => setTimeout(r, 600)); const el = document.querySelector('.hsn-ml-wrap'); return el ? [...el.querySelectorAll('.hsn-ml-isl')].map(x => x.innerText.replace(/\n/g, ' | ')) : 'no panel'; });
console.log('我的学习 island rows:', JSON.stringify(panel, null, 1));
await fr.evaluate(() => HansenMyLearning._close());
// switch islands twice, then read blackbox
await p.evaluate(() => openIsland('island_animal.html')); await p.waitForTimeout(5000);
await p.evaluate(() => closeIsland()); await p.waitForTimeout(4000);
const bbx = await p.evaluate(() => JSON.parse(localStorage.getItem('hansen_blackbox') || '[]').map(x => x.p + ' ' + x.k + ': ' + x.m.slice(0, 90)));
console.log('hansen_blackbox:', JSON.stringify(bbx, null, 1));
await b.close(); srv.close();
