import { newCtx, openPage, shot, closeBrowser, sleep, save, tapText } from './lib.mjs';
const log = (...a) => console.log(...a);
const ctx = await newCtx({ palette: 'cosmos' });
// 1 index diamond shop
let pg = await openPage(ctx, 'index.html', 4000);
await pg.evaluate(() => window.HansenDiamondShop && HansenDiamondShop.open());
await sleep(1500);
await shot(pg, 'x03_shop');
log('shop', await pg.evaluate(() => { const o = [...document.querySelectorAll('body > *')].filter(e => getComputedStyle(e).position === 'fixed' && e.offsetHeight > 300 && getComputedStyle(e).display !== 'none'); return o.map(e => (e.id || e.className) + ' :: ' + e.innerText.replace(/\s+/g, ' ').slice(0, 600)); }));
await pg.close();
// 2 island settings
pg = await openPage(ctx, 'island_food.html', 3500);
await tapText(pg, /开始冒险/); await sleep(600);
await pg.evaluate(() => showScreen('settings')); await sleep(1200);
await shot(pg, 'x03_settings');
log('settings', await pg.evaluate(() => document.getElementById('settingsScreen').innerText.replace(/\s+/g, ' ').slice(0, 1500)));
// palette picker location
log('palpicker', await pg.evaluate(() => { const el = [...document.querySelectorAll('#settingsScreen *')].find(e => /深空蓝/.test(e.textContent) && e.children.length > 3); if (!el) return null; const r = el.getBoundingClientRect(); return { y: r.top + scrollY, h: r.height, id: el.id, cls: el.className }; }));
// 3 boss list
await pg.evaluate(() => showScreen('boss')); await sleep(2500);
await shot(pg, 'x03_boss_list');
log('boss', await pg.evaluate(() => document.getElementById('bossScreen').innerText.replace(/\s+/g, ' ').slice(0, 600)));
// 4 chest
await pg.evaluate(() => showScreen('home')); await sleep(500);
await pg.evaluate(() => { try { openChest(); } catch (e) { return String(e); } }); await sleep(2500);
await shot(pg, 'x03_chest');
log('chest', await pg.evaluate(() => [...document.querySelectorAll('[id$=Screen]')].filter(e => e.offsetParent).map(e => e.id + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 300))));
log(pg.__errs);
await closeBrowser();
