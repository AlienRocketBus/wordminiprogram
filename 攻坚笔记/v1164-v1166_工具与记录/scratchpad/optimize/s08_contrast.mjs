import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const pal = process.argv[2] || 'cosmos';
const fn = fs.readFileSync(O + '/boxes_fn.js', 'utf8');
const { browser, ctx } = await launch({ init: `try{localStorage.setItem('hansen_onboarded','1');localStorage.setItem('hansen_palette_global','${pal}');}catch(e){}\n` + fn });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
const data = {};
async function cap(name){ const png = `${O}/shots/s08_${pal}_${name}.png`; await page.screenshot({ path: png }); data[name] = { png, boxes: await page.evaluate(() => __textBoxes()) }; }
await page.goto(BASE + 'index.html'); await sleep(3500); await cap('home');
await page.evaluate(() => window.scrollTo(0, 900)); await sleep(600); await cap('home_islands');
await page.evaluate(() => window.scrollTo(0, 2650)); await sleep(600); await cap('home_bottom');
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(900);
await cap('island');
await page.evaluate(() => window.scrollTo(0, 700)); await sleep(500); await cap('island_lower');
await page.evaluate(() => { window.scrollTo(0,0); showScreen('explore'); }); await sleep(1000); await cap('explore');
await page.evaluate(() => showScreen('home')); await sleep(400);
await page.evaluate(() => startListen()); await sleep(900);
await page.evaluate(() => { const c = [...document.querySelectorAll('#listenScreen [onclick]')].find(e => /初级/.test(e.innerText) && e.offsetParent); if (c) c.click(); }); await sleep(1800);
await cap('listen_q');
// settings
await page.evaluate(() => showScreen('home')); await sleep(300);
await page.evaluate(() => { try { showScreen('settings'); } catch (e) {} }); await sleep(900); await cap('settings');
fs.writeFileSync(`${O}/out/s08_boxes_${pal}.json`, JSON.stringify(data));
await browser.close();
