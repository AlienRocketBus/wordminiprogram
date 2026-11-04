// MG-05 in browser: how often are scramble tiles already in answer order? (skip through 2 rounds on question island)
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'question';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
page.on('dialog', d=>d.accept().catch(()=>{}));
const F = await openIsland(page, port, island);
const seen=[];
for(let round=0; round<2; round++){
  await tapCard(page, F, /^startScramble\(/);
  await waitIn(F, ()=>document.querySelector(`[onclick="startScrambleLevel('easy')"]`)); await sleep(300);
  await tap(page, F, ()=>document.querySelector(`[onclick="startScrambleLevel('easy')"]`));
  let last=null;
  for(let n=0;n<60;n++){
    const st = await waitIn(F, (lw)=>{ const c=document.getElementById('scrambleContent'); if(/完成！/.test(c.innerText)) return {done:true}; const L=[...document.querySelectorAll('#scrLetters .scramble-letter')]; if(!L.length||!scrWord||scrWord.en===lw) return null; return {w:scrWord.en, tiles:L.map(x=>x.textContent).join('')}; }, last, 8000);
    if(!st||st.done) break;
    last = st.w; seen.push({w:st.w, tiles:st.tiles, inOrder: st.tiles===st.w.replace(/ /g,''), uniq: new Set(st.w.replace(/ /g,'')).size>1});
    for(const ch of st.w.replace(/ /g,'').split('')){
      await tap(page, F, (c)=>[...document.querySelectorAll('#scrLetters .scramble-letter')].find(x=>!x.classList.contains('used')&&x.textContent===c), ch, {scroll:false});
      await sleep(120);
    }
    await sleep(600);
    for(let k=0;k<2;k++){ if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))){ await sleep(700); await tap(page,F,()=>document.querySelector('#alertModal.show button')); await sleep(400);} }
  }
  await F.evaluate(()=>showScreen('home'));
}
const inOrder = seen.filter(s=>s.inOrder && s.uniq);
console.log(JSON.stringify({island, asked:seen.length, inOrder:inOrder.length, inOrderWords:inOrder.map(s=>s.w)}));
await page.screenshot({path:`${OUT}/shots_s7_scramble.png`});
fs.writeFileSync(`${OUT}/s7_scramble_${island}.json`, JSON.stringify(seen,null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
