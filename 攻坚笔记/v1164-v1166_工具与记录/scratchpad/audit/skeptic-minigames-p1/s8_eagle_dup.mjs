// MG-06: in the real 火眼金睛 UI, do two cells ever *look* identical (rendered innerText) for phrase words?
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'question', level = process.argv[3]||'hard', rounds = +(process.argv[4]||3);
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, island);
const found=[]; let phraseRounds=0, allRounds=0;
for(let r=0;r<rounds;r++){
  await tapCard(page, F, /^startEagle\(/);
  await waitIn(F, (lv)=>document.querySelector(`[onclick="startEagleLevel('${lv}')"]`), level); await sleep(300);
  await tap(page, F, (lv)=>document.querySelector(`[onclick="startEagleLevel('${lv}')"]`), level);
  let last=null;
  for(let n=0;n<40;n++){
    const st = await waitIn(F, (lr)=>{ const c=document.getElementById('eagleContent'); if(c && /完成！/.test(c.innerText)) return {done:true}; const cells=[...document.querySelectorAll('#eagleGrid .eagle-cell')]; if(!cells.length||!eagleTarget||eagleRound===lr||cells.some(x=>x.dataset.done)) return null; return {round:eagleRound, target:eagleTarget.en, cells:cells.map(x=>({shown:x.innerText, raw:x.textContent, t:/,1\)$/.test(x.getAttribute('onclick'))}))}; }, last, 15000);
    if(!st||st.done) break;
    last=st.round; allRounds++;
    if(/ /.test(st.target)){ phraseRounds++; const tgtShown = st.cells.find(c=>c.t).shown; const twins = st.cells.filter(c=>!c.t && c.shown===tgtShown); if(twins.length) found.push({target:st.target, twinRaw:JSON.stringify(twins[0].raw), cells:st.cells.map(c=>c.shown)}); }
    await tap(page, F, ()=>[...document.querySelectorAll('#eagleGrid .eagle-cell')].find(x=>/,1\)$/.test(x.getAttribute('onclick'))), null, {scroll:false});
    await sleep(300);
  }
  for(let k=0;k<3;k++){ if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))){ await sleep(700); await tap(page,F,()=>document.querySelector('#alertModal.show button')); await sleep(400);} }
  if(found.length) { await page.screenshot({path:`${OUT}/shots_s8_eagle_${island}.png`}); }
  await F.evaluate(()=>showScreen('home'));
}
console.log(JSON.stringify({island, level, allRounds, phraseRounds, lookalikeRounds:found.length, found:found.slice(0,5), errors:ev.filter(e=>!/tencent|tcb|signin/i.test(e.t))}));
fs.writeFileSync(`${OUT}/s8_eagle_${island}_${level}.json`, JSON.stringify({allRounds, phraseRounds, found},null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
