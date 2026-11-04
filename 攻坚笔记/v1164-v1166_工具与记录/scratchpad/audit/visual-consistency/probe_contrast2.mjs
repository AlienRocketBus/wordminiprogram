import { startServer, launch, newCtx, attachLogs, sleep, OUT } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome } from './lib2.mjs';
import { measure } from './contrastlib.mjs';
import fs from 'node:fs';
const PAL = process.argv[2] || 'cloud';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const results=[];
const ctx = await newCtx(browser,{dsf:1});
const extra = {}; if(PAL!=='none') extra['hansen_palette_global']=PAL;
await seed(ctx, extra);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(1500);
const fr = await openIsland(page,'island_animal.html'); await dismissWelcome(page,fr); await sleep(500);
// wrong overview
await fr.evaluate(()=>document.getElementById('navExplore').click()); await sleep(1200);
results.push(...await measure(page, fr, 'div[style*="所有"], [class^=hwo] div[style*="font-size:14px"]', 'wrong overview empty text', 2));
results.push(...await measure(page, fr, '.hwo_btm', 'wrong overview footnote', 1));
results.push(...await measure(page, fr, '.hwo_sub', 'wrong overview subtitle', 1));
await fr.evaluate(()=>window.HansenWrongOverview && HansenWrongOverview._close()); await sleep(600);
// boss header
await fr.evaluate(()=>{ const c=[...document.querySelectorAll('.daily-card')].find(e=>/BOSS/i.test(e.innerText)); c&&c.click(); }); await sleep(1800);
results.push(...await measure(page, fr, 'span[style*="已击败"], .screen.active span', 'boss header text', 3));
await fr.evaluate(()=>{ try{showScreen('home')}catch(e){} }); await sleep(600);
// cards
await fr.evaluate(()=>showScreen('cards')); await sleep(1200);
results.push(...await measure(page, fr, '#cardsScreen div[style*="86efac"]', 'cards all-collected line', 1));
results.push(...await measure(page, fr, '#cardsScreen div[style*="font-size:13px;color:#cbd5e1"]', 'cards collected count', 1));
await fr.evaluate(()=>showScreen('home')); await sleep(500);
// my learning
await fr.evaluate(()=>{ const c=[...document.querySelectorAll('.util-card')].find(e=>/我的学习/.test(e.innerText)); c&&c.click(); }); await sleep(1500);
results.push(...await measure(page, fr, '.row2 b', 'mylearning mastered numbers', 2));
results.push(...await measure(page, fr, '.hsn-ml-top div div:last-child, .hsn-ml-sub', 'mylearning subtitle', 1));

// listen round bar
await fr.evaluate(()=>{ try{showScreen('home')}catch(e){} try{ HansenMyLearning && HansenMyLearning._close && HansenMyLearning._close(); }catch(e){} }); await sleep(600);
await fr.evaluate(()=>startListen()); await sleep(1200);
results.push(...await measure(page, fr, '#listenScreen [onclick] div', 'listen difficulty card text', 3));
await fr.evaluate(()=>{ const b=[...document.querySelectorAll('#listenScreen [onclick]')].find(e=>/初级/.test(e.innerText)); b&&b.click(); }); await sleep(1500);
results.push(...await measure(page, fr, '#listenScreen span', 'listen round bar text', 6));
await fr.evaluate(()=>{ try{stopListen()}catch(e){} showScreen('home'); }); await sleep(500);
await fr.evaluate(()=>showTypingMenu()); await sleep(1200);
results.push(...await measure(page, fr, '#typingScreen [onclick] div div', 'typing difficulty card text', 6));
results.push(...await measure(page, fr, '#typingScreen span[style*="64748b"]', 'typing medal 尚无记录', 1));

await fr.evaluate(()=>{ showScreen('home'); }); await sleep(500);
await fr.evaluate(()=>HansenContextGacha.open()); await sleep(1500);
results.push(...await measure(page, fr, '.gacha-owned', 'gacha collected count', 1));
results.push(...await measure(page, fr, '#gachaScreen div[style*="font-size"] , .gacha-rate-row span, .gacha-rates span', 'gacha rate rows', 4));
fs.writeFileSync(OUT+`/contrast2_${PAL}.json`, JSON.stringify({results,errs},null,1));
for(const r of results){ console.log([r.label, JSON.stringify(r.txt), r.fs, r.textColor, r.bgMean, 'mean='+r.crMean, 'p10='+r.crP10, r.note||''].join(' | ')); }
await browser.close(); srv.close();
