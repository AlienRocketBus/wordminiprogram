import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(800);
await page.evaluate(() => { startListen(); startListenLevel('easy'); }); await sleep(1000);
for (let q = 0; q < 3; q++) { await page.evaluate(() => { const i = listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn); document.querySelectorAll('#listenScreen .boss-opt')[i].click(); }); await sleep(2000); }
await page.evaluate(() => showScreen('home')); await sleep(800);
const api = await page.evaluate(() => Object.keys(window.HansenReview || {}));
console.log('api', api);
await page.evaluate(() => { const n = [...document.querySelectorAll('.bottom-nav *, nav *, [class*=nav] *')].find(e => (e.innerText || '').trim() === '复习'); (n.closest('[onclick],button,a') || n).click(); }); await sleep(1500);
await page.screenshot({ path: `${O}/shots/s17_review_center.png` });
const t = await page.evaluate(() => { const c = document.getElementById('hr_center'); return c ? c.innerText.replace(/\s+/g, ' ') : 'no hr_center'; });
console.log(t.slice(0, 1200));
// open today review
await page.evaluate(() => { const b = [...document.querySelectorAll('#hr_center *')].find(e => /今日复习|今天有/.test(e.innerText || '') && e.onclick); if (b) b.click(); else if (HansenReview.openTodayReview) HansenReview.openTodayReview(); }); await sleep(1200);
await page.screenshot({ path: `${O}/shots/s17_today_review.png` });
await browser.close();
