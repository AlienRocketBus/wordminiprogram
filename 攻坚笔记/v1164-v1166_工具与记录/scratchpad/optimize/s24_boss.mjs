import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message().slice(0, 200)); d.dismiss().catch(()=>{}); });
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(600);
const p = await page.evaluate(() => { const el = [...document.querySelectorAll('[onclick]')].find(e => e.offsetParent && /挑战BOSS/.test(e.innerText || '')); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(p.x, p.y); await sleep(4000);
await page.screenshot({ path: `${O}/shots/s24_boss_entry.png` });
const t = await page.evaluate(() => { const s = [...document.querySelectorAll('[id$=Screen]')].find(e => e.offsetParent); return (s ? s.id + ': ' + s.innerText : document.body.innerText).replace(/\s+/g, ' ').slice(0, 700); });
console.log(t, dialogs);
// try start first boss
const q = await page.evaluate(() => { const el = [...document.querySelectorAll('#bossScreen [onclick], #bossScreen button')].find(e => e.offsetParent && /开始|挑战|第 ?1|Lv\.?1|出战/.test(e.innerText || '')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: el.innerText.slice(0, 40) }; });
console.log('start btn', q);
if (q) { await page.touchscreen.tap(q.x, q.y); await sleep(4000); await page.screenshot({ path: `${O}/shots/s24_boss_fight.png` }); console.log(await page.evaluate(() => document.getElementById('bossScreen').innerText.replace(/\s+/g, ' ').slice(0, 500))); }
await browser.close();
