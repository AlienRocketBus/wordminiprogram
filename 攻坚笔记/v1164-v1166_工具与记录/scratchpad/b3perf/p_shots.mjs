import { launch, sleep, BASE, O } from './lib.mjs';
const tag = process.env.TAG || 'x';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_food.html'); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
// 呼吸到最亮的时刻附近
await sleep(1000);
await page.screenshot({ path: `${O}/shots/${tag}_island_t3.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
const info = await page.evaluate(() => { const s = document.querySelector('.wmb-socket'); const i = document.querySelector('.wmb-img'); const a = getComputedStyle(s, '::after'); const c = document.getElementById('chestCard'); const ca = c ? getComputedStyle(c, '::after') : null; return { img: i && i.getBoundingClientRect().toJSON(), sock: s.getBoundingClientRect().toJSON(), afterBg: a.backgroundImage.slice(0, 80), afterOp: a.opacity, afterAnim: a.animationName + ' ' + a.animationIterationCount, chestCls: c && c.className, chestAfter: ca && (ca.content + ' ' + ca.opacity + ' ' + ca.animationName), anims: document.getAnimations().filter(x => x.playState === 'running').map(x => x.animationName) }; });
console.log(JSON.stringify(info, null, 1));
await sleep(42000);
await page.screenshot({ path: `${O}/shots/${tag}_island_t45.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
console.log('running after 45s:', await page.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').map(x => x.animationName)));
await browser.close();
