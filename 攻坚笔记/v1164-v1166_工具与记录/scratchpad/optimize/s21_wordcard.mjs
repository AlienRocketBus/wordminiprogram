import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(500);
await page.evaluate(() => showScreen('explore')); await sleep(1000);
const p = await page.evaluate(() => { const el = [...document.querySelectorAll('#exploreScreen *')].find(e => /^🐶\s*dog/.test((e.innerText || '').trim()) && e.children.length < 6 && e.getBoundingClientRect().height < 60); const t = el.closest('[onclick]') || el; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await sleep(300); await page.touchscreen.tap(p.x, p.y); await sleep(1500);
await page.screenshot({ path: `${O}/shots/s21_wordcard.png` });
const t = await page.evaluate(() => { const els = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return s.position === 'fixed' && e.offsetHeight > 300 && e.offsetWidth > 300; }); return els.map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 800)).join(' || '); });
console.log(t);
// scroll the explore page to bottom to see list
await browser.close();
