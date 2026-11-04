import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
await page.goto(BASE + 'index.html'); await sleep(3000);
const r = await page.evaluate(() => [...document.querySelectorAll('a.island')].map(a => { const en = a.querySelector('.island-en'); const nm = a.querySelector('.island-name'); const ar = a.getBoundingClientRect(); const er = en.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(en); const tr = range.getBoundingClientRect(); return { name: nm.innerText, en: en.innerText, cardRight: Math.round(ar.right), textRight: Math.round(tr.right), overflow: tr.right > ar.right - 2, fs: getComputedStyle(en).fontSize, nameFs: getComputedStyle(nm).fontSize, desc: getComputedStyle(a.querySelector('.island-desc')).display }; }));
console.log(r.filter(x => x.overflow).map(x => `${x.name} | ${x.en} | text ${x.textRight} > card ${x.cardRight}`).join('\n'));
console.log('name fs', r[0].nameFs, 'en fs', r[0].fs, 'desc display', r[0].desc);
await browser.close();
