import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const pal = process.argv[2] || 'cosmos';
const fn = fs.readFileSync(O + '/a11y_fn.js', 'utf8');
const { browser, ctx } = await launch({ init: `try{localStorage.setItem('hansen_onboarded','1');localStorage.setItem('hansen_palette_global','${pal}');}catch(e){}\n` + fn });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
const out = [];
async function shot(name){ await page.screenshot({ path: `${O}/shots/s07_${pal}_${name}.png` }); }
await page.goto(BASE + 'index.html'); await sleep(3500);
out.push(await page.evaluate(() => __a11yAudit('home-top'))); await shot('home');
await page.evaluate(() => window.scrollTo(0, 900)); await sleep(500);
out.push(await page.evaluate(() => __a11yAudit('home-islands'))); await shot('home_islands');
await page.evaluate(() => window.scrollTo(0, 2700)); await sleep(500);
out.push(await page.evaluate(() => __a11yAudit('home-bottom'))); await shot('home_bottom');
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(800);
out.push(await page.evaluate(() => __a11yAudit('island-main'))); await shot('island');
await page.evaluate(() => showScreen('explore')); await sleep(1000);
out.push(await page.evaluate(() => __a11yAudit('explore'))); await shot('explore');
await page.evaluate(() => showScreen('home')); await sleep(500);
await page.evaluate(() => startListen()); await sleep(1000);
// choose first difficulty
await page.evaluate(() => { const c = [...document.querySelectorAll('#listenScreen [onclick]')].find(e => /初级/.test(e.innerText) && e.offsetParent); if (c) c.click(); }); await sleep(1800);
out.push(await page.evaluate(() => __a11yAudit('listen-q'))); await shot('listen_q');
fs.writeFileSync(`${O}/out/s07_a11y_${pal}.json`, JSON.stringify(out, null, 1));
for (const o of out) console.log(o.label, 'texts', o.nText, JSON.stringify(o.fsBins), 'lowCR', o.nLowContrast + '/' + o.nKnownContrast, 'ctrl small', o.nSmall + '/' + o.nCtrls, '\n   small:', o.smallSamples.slice(0, 8).map(c => `${c.t}:${c.w}x${c.h}`).join(' | '), '\n   lowCR:', o.lowSamples.slice(0, 6).map(t => `${t.t}:${t.cr}@${t.fs}`).join(' | '));
await browser.close();
