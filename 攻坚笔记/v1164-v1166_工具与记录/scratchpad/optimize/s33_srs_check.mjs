import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(500);
// Step 1: answer one listen question wrong (real UI)
await page.evaluate(() => { startListen(); startListenLevel('easy'); }); await sleep(800);
const w = await page.evaluate(() => { const idx = listenQ.idx, en = listenQ.word.en; const i = listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn); document.querySelectorAll('#listenScreen .boss-opt')[i].click(); return { idx, en }; });
await sleep(2200);
const after1 = await page.evaluate(i => ({ wrongs: S.wrongs[i], srs: S.srs && S.srs[i], due: HansenReview._dueCount() }), w.idx);
// Step 2: later, the same word comes up in another game and is answered correctly once (simulate via the same primitive every mode calls)
await page.evaluate(() => showScreen('home')); await sleep(300);
await page.evaluate(i => markAnswer(i, true), w.idx); await sleep(500);
const after2 = await page.evaluate(i => ({ wrongs: S.wrongs[i], srs: S.srs && S.srs[i], due: HansenReview._dueCount() }), w.idx);
console.log('word', w.en, '\n after 1 wrong:', JSON.stringify(after1), '\n after 1 correct (same day):', JSON.stringify(after2));
fs.writeFileSync(`${O}/out/s33_srs_check.json`, JSON.stringify({ w, after1, after2 }, null, 1));
await browser.close();
