// (b) match quest progress after one full game; (d) fish game-over vs "钓鱼大师 · 累计得 30 分"
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const quests = ()=>{ try{ return JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')).list.map(q=>q.id+':'+q.progress+'/'+q.goal); }catch(e){ return 'n/a'; } };
async function fresh(key){
  const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>key);
  const F = await openIsland(page, port, key);
  await sleep(1000);
  await F.evaluate(()=>{ window.__pq=[]; const p=window.progressQuest; window.progressQuest=function(t,a){ window.__pq.push([t,a]); return p.apply(this,arguments); }; });
  return {ctx, page, F};
}
{ // match
  const {ctx, page, F} = await fresh('animal');
  const t = await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/startMatch/.test(e.getAttribute('onclick'))));
  await waitIn(F, ()=>document.querySelectorAll('#matchBoard .match-card').length===16);
  await sleep(500);
  const pairs = await F.evaluate(()=>matchPairs.map(p=>p.idx));
  const done=new Set(); let taps=[];
  for(let k=0;k<pairs.length;k++){ if(done.has(pairs[k])) continue; done.add(pairs[k]); const j=pairs.findIndex((p,jj)=>jj!==k&&p===pairs[k]); taps.push(await tapIn(page,F,(i)=>document.getElementById('mc'+i),k)); await sleep(150); taps.push(await tapIn(page,F,(i)=>document.getElementById('mc'+i),j)); await sleep(650); }
  await waitIn(F, ()=>/步数/.test(document.getElementById('matchContent').innerText) && document.querySelector('#matchContent .game-btn'), null, 4000);
  const res = await F.evaluate((q)=>({txt:document.getElementById('matchContent').innerText.replace(/\s+/g,' ').slice(0,120), matched:matchMatched, pq:window.__pq.filter(x=>x[0]==='match'), quests:(0,eval)('('+q+')')()}), quests.toString());
  console.log('[match] card tap', JSON.stringify(t), 'failedTaps', taps.filter(x=>!x.ok).length, '\n ', JSON.stringify(res));
  await ctx.close();
}
{ // fish: score some points then lose all lives
  const {ctx, page, F} = await fresh('animal');
  await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/startFish/.test(e.getAttribute('onclick'))));
  await waitIn(F, ()=>document.querySelector('#fishContent [onclick="startFishLevel(\'easy\')"]'));
  await tapIn(page, F, ()=>document.querySelector('#fishContent [onclick="startFishLevel(\'easy\')"]'));
  await waitIn(F, ()=>!!document.getElementById('fishPond'));
  await F.evaluate(()=>document.getElementById('fishPond').scrollIntoView({block:'center',behavior:'instant'}));
  let q=0;
  while(q<12){
    const st = await waitIn(F, ()=> (fishActive && fishTarget && !window.fishLocked) ? {caught:fishCaught, lives:fishLives} : (!fishActive?'DONE':null), null, 6000);
    if(!st||st==='DONE') break;
    const wrong = q>=4;
    const t1=Date.now(); let ok=false;
    while(Date.now()-t1<15000){ const c = await F.evaluate((w)=>{ const pond=document.getElementById('fishPond'); const pr=pond.getBoundingClientRect(); for(const f of pond.querySelectorAll('[data-en]')){ if(f.dataset.done) continue; if(w ? f.dataset.en===fishTarget.en : f.dataset.en!==fishTarget.en) continue; const r=f.getBoundingClientRect(); const x=r.left+r.width/2,y=r.top+r.height/2; if(x>pr.left+30&&x<pr.right-30&&y>pr.top+10&&y<pr.bottom-10&&+getComputedStyle(f).opacity>0.5){ const h=document.elementFromPoint(x,y); if(h&&(h===f||f.contains(h))) return {x,y}; } } return null; }, wrong); if(c){ await page.touchscreen.tap(c.x,c.y); ok=true; break; } await sleep(150); }
    if(!ok) break;
    await waitIn(F, (s)=>!fishActive || fishCaught!==s.caught || fishLives!==s.lives, st, 3000);
    q++;
  }
  await sleep(800);
  const res = await F.evaluate((q)=>({txt:document.getElementById('fishContent').innerText.replace(/\s+/g,' ').slice(0,160), score:fishScore, pq:window.__pq.filter(x=>x[0]==='fish'), quests:(0,eval)('('+q+')')()}), quests.toString());
  console.log('[fish game over]', JSON.stringify(res));
  await page.screenshot({path:`${OUT}/shots/fish_gameover.png`});
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
