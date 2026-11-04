import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(500);
await page.evaluate(() => { startListen(); startListenLevel('easy'); }); await sleep(800);
for (let q = 0; q < 6; q++) { await page.evaluate(q => { const i = q % 3 ? listenQ.opts.findIndex(o => o.cn === listenQ.word.cn) : listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn); document.querySelectorAll('#listenScreen .boss-opt')[i].click(); }, q); await sleep(q % 3 ? 3500 : 2000); }
await page.evaluate(() => showScreen('home')); await sleep(600);
const p = await page.evaluate(() => { const el = [...document.querySelectorAll('[onclick], .util-card')].find(e => e.offsetParent && /我的学习/.test(e.innerText || '')); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await sleep(300); await page.touchscreen.tap(p.x, p.y); await sleep(1500);
await page.screenshot({ path: `${O}/shots/s22_mylearning.png` });
console.log(await page.evaluate(() => { const els = [...document.querySelectorAll('body > *')].filter(e => getComputedStyle(e).position === 'fixed' && e.offsetHeight > 400); return els.map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 1200)).join(' || '); }));
await browser.close();
