import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(800);
// make 3 wrong answers via listen
await page.evaluate(() => { startListen(); startListenLevel('easy'); }); await sleep(1000);
for (let q = 0; q < 3; q++) { await page.evaluate(() => { const i = listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn); document.querySelectorAll('#listenScreen .boss-opt')[i].click(); }); await sleep(2000); }
await page.evaluate(() => showScreen('home')); await sleep(800);
await page.screenshot({ path: `${O}/shots/s16_island_after_wrong.png` });
// tap bottom nav 错题
const nav = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => /^(错题|复习|卡册|主页)$/.test((e.innerText || '').trim()) && e.offsetParent).map(e => { const r = e.closest('[onclick],button,a') || e; const b = r.getBoundingClientRect(); return { t: e.innerText.trim(), x: b.x + b.width / 2, y: b.y + b.height / 2 }; }));
const wrongBtn = nav.find(n => n.t === '错题'); const revBtn = nav.find(n => n.t === '复习');
await page.touchscreen.tap(wrongBtn.x, wrongBtn.y); await sleep(1500);
await page.screenshot({ path: `${O}/shots/s16_wrongbook.png` });
const t1 = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(-1500));
// close overlay: find a close button
await page.evaluate(() => { const c = [...document.querySelectorAll('button, [onclick]')].filter(e => e.offsetParent && /^(✕|×|关闭|返回|← 返回)$/.test(e.innerText.trim())); if (c.length) c[c.length - 1].click(); }); await sleep(800);
await page.touchscreen.tap(revBtn.x, revBtn.y); await sleep(1500);
await page.screenshot({ path: `${O}/shots/s16_review.png` });
const t2 = await page.evaluate(() => (document.getElementById('hr_center') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 1500));
fs.writeFileSync(`${O}/out/s16_review.json`, JSON.stringify({ nav, t1, t2 }, null, 1));
console.log('WRONGBOOK:', t1.slice(-700)); console.log('REVIEW:', t2.slice(0, 900));
await browser.close();
