// MG-04 (result text) + MG-10 (quest progress on game over): moles & fish with real taps
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'city';
const modes = (process.argv[3]||'moles1miss,fish1miss,molesover,fishover').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const out={};
for(const mode of modes){
  const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; watch(page, ev);
  const F = await openIsland(page, port, island);
  await F.evaluate(()=>{ window.__pq=[]; const o=window.progressQuest; window.progressQuest=function(k,n){ window.__pq.push([k,n]); return o.apply(this, arguments); }; });
  const isM = mode.startsWith('moles');
  await tapCard(page, F, isM? /^startMoles\(/ : /^startFish\(/);
  const lvlSel = isM? `[onclick="startMolesLevel('easy')"]` : `[onclick="startFishLevel('easy')"]`;
  await waitIn(F, (s)=>document.querySelector(s), lvlSel); await sleep(400);
  const lvlTxt = await F.evaluate((s)=>document.querySelector(s).innerText.replace(/\s+/g,' '), lvlSel);
  await tap(page, F, (s)=>document.querySelector(s), lvlSel);
  let right=0, wrong=0, lastT=null, n=0, lastTapAt=0; const over = /over/.test(mode);
  const total = await waitIn(F, (m)=> m? (molesActive&&molesTotal) : (fishActive&&fishTotal), isM);
  while(n++<200){
    const st = await waitIn(F, ([m,lt])=>{
      const c = document.querySelector(m?'#molesContent':'#fishContent');
      if(c && /完成！|游戏结束/.test(c.innerText)) return {done:true, txt:c.innerText.replace(/\s+/g,' ').slice(0,260)};
      if(m){ if(!molesActive||!molesTarget) return null; const slots=[...document.querySelectorAll('[id^="moleSlot"]')]; if(slots.some(s=>s.dataset.locked)) return null; if(!slots.some(s=>s.dataset.en===molesTarget.en && s.querySelector('.mole-card'))) return null; return {t:molesTarget.en, k: molesTarget.en+'#'+molesHit+'#'+molesLives}; }
      if(!fishActive||!fishTarget||window.fishLocked) return null; const f=[...document.querySelectorAll('#fishPond [data-en]')].find(x=>x.dataset.en===fishTarget.en && !x.dataset.done && x.getBoundingClientRect().left>10 && x.getBoundingClientRect().right<innerWidth-10); if(!f) return null; return {t:fishTarget.en, k:fishTarget.en+'#'+fishCaught+'#'+fishLives};
    }, [isM, lastT], 20000);
    if(!st) { out[mode]={err:'timeout'}; break; }
    if(st.done){ out[mode] = {island, lvlTxt, total, right, wrong, result: st.txt}; break; }
    if(st.k===lastT && Date.now()-lastTapAt<1500){ await sleep(150); continue; }
    lastT = st.k; lastTapAt = Date.now();
    const doWrong = over ? (right>=3) : (right+wrong===0);
    const t = await tap(page, F, ([m,w])=>{
      if(m){ const s=[...document.querySelectorAll('[id^="moleSlot"]')]; return w? s.find(x=>x.dataset.en && x.dataset.en!==molesTarget.en && x.querySelector('.mole-card')) : s.find(x=>x.dataset.en===molesTarget.en); }
      const fs=[...document.querySelectorAll('#fishPond [data-en]')].filter(x=>!x.dataset.done && x.getBoundingClientRect().left>10 && x.getBoundingClientRect().right<innerWidth-10);
      return w? fs.find(x=>x.dataset.en!==fishTarget.en) : fs.find(x=>x.dataset.en===fishTarget.en);
    }, [isM, doWrong], {scroll:false, force:true});
    if(!t.found){ lastT=null; await sleep(200); continue; }
    await sleep(250);
    const changed = await F.evaluate(([m,k])=>{ const kk = m? (molesTarget&&molesTarget.en+'#'+molesHit+'#'+molesLives) : (fishTarget&&fishTarget.en+'#'+fishCaught+'#'+fishLives); return kk!==k || (m? molesLives : fishLives)<=0 || !(m?molesActive:fishActive); }, [isM, st.k]);
    if(changed){ if(doWrong) wrong++; else right++; }
  }
  if(!out[mode]) out[mode]={err:'loop exhausted', right, wrong};
  out[mode].pq = await F.evaluate(()=>window.__pq.filter(x=>x[0]!=='correct'));
  out[mode].errors = ev.filter(e=>!/tencent|tcb|signin/i.test(e.t));
  await page.screenshot({path:`${OUT}/shots_s4_${island}_${mode}.png`});
  console.log(mode, JSON.stringify(out[mode]));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/s4_${island}.json`, JSON.stringify(out,null,1));
await browser.close(); srv.close(); process.exit(0);
