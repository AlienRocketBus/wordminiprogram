import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(500);
await page.evaluate(() => { startListen(); startListenLevel('easy'); }); await sleep(800);
for (let q = 0; q < 4; q++) { await page.evaluate(() => { const i = listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn); document.querySelectorAll('#listenScreen .boss-opt')[i].click(); }); await sleep(2000); }
await page.evaluate(() => { HansenReview._dueCount(); }); await sleep(500);
const info = await page.evaluate(() => { const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); const tot = keys.reduce((a, k) => a + (localStorage.getItem(k) || '').length, 0); let s = null; try { s = JSON.parse(localStorage.getItem('wordIslandAnimal')); } catch (e) {} return { nKeys: keys.length, totalChars: tot, keys: keys.sort(), srs: s && s.srs, wrongs: s && s.wrongs, topFields: s && Object.keys(s).length }; });
console.log('keys', info.nKeys, 'chars', info.totalChars, 'island S fields', info.topFields);
console.log('srs', JSON.stringify(info.srs), 'wrongs', JSON.stringify(info.wrongs));
console.log(info.keys.join(' '));
await browser.close();
