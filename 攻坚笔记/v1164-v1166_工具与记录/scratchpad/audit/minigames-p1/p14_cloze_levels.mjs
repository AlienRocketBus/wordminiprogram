// For every island/level: how many cloze questions can actually be asked vs the total shown on the card
import {startServer, launch, newCtx, sleep} from './lib.mjs';
const ISL = ['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school'];
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
for(const k of ISL){
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/island_${k}.html`, {waitUntil:'load'});
  await sleep(500);
  const r = await page.evaluate(()=>{ const o={}; for(const lv of ['easy','medium','hard']){ const idx=CLOZE_LEVEL_IDX[lv]; const bad=idx.map(i=>allW[i]).filter(w=>!w.ex||!new RegExp('\\b'+w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(w.ex)).map(w=>w.en); o[lv]={shown:idx.length, askable:idx.length-bad.length, maxPct: idx.length?Math.round((idx.length-bad.length)*100/idx.length):100, skipped:bad}; const miss=CLOZE_LEVELS[lv].words.filter(en=>!allW.some(w=>w.en===en)); if(miss.length) o[lv].listedButNotInIsland=miss; } return o; });
  const bad = Object.entries(r).filter(([lv,v])=>v.skipped.length||v.listedButNotInIsland);
  console.log(k.padEnd(10), bad.length? bad.map(([lv,v])=>`${lv}: card says ${v.shown}题, only ${v.askable} askable → max 正确率 ${v.maxPct}% (skips ${v.skipped.join(', ')})${v.listedButNotInIsland?' notInIsland='+v.listedButNotInIsland:''}`).join(' | ') : 'all levels OK');
  await page.close();
}
await browser.close(); srv.close(); process.exit(0);
