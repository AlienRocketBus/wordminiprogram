import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_question.html'); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(400);
const r = await page.evaluate(() => { const out = []; for (const w of allW) { const e = w.emoji || ''; const t = [...e.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(' '); if (/<svg/.test(e)) out.push([w.en, t.slice(0, 40)]); } return { n: allW.length, svg: out.length, sample: out.slice(0, 8) }; });
console.log(JSON.stringify(r));
// render scramble with a forced svg word
await page.evaluate(() => { startScramble(); }); await sleep(500);
await page.evaluate(() => startScrambleLevel('easy')); await sleep(1200);
const shown = await page.evaluate(() => { const el = document.querySelector('#scrambleScreen svg text, #scrambleContent svg text'); return el ? el.textContent : null; });
console.log('scramble prompt svg text:', shown, 'answer:', await page.evaluate(() => { try { return scrWord.en; } catch (e) { return '?'; } }));
await page.screenshot({ path: `${O}/shots/s35_scramble_svg.png` });
await browser.close();
