// Targeted repros: (a) cloze totals vs real questions, (b) match quest progress, (c) moles game-over quest progress
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const which = (process.argv[2]||'a,b,c').split(',');
const {srv, port} = await startServer();
const browser = await launch();
async function fresh(key){
  const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>key);
  const F = await openIsland(page, port, key);
  await sleep(900);
  await F.evaluate(()=>{ window.__pq=[]; const p=window.progressQuest, s=window.setQuest; window.progressQuest=function(t,a){ window.__pq.push(['progress',t,a]); return p.apply(this,arguments); }; window.setQuest=function(t,a){ window.__pq.push(['set',t,a]); return s.apply(this,arguments); }; });
  return {ctx, page, F, ev};
}
if(which.includes('a')){
  for(const [key, level] of (process.argv[3]?JSON.parse(process.argv[3]):[['body','easy'],['action','easy'],['food','easy']])){
    const {ctx, page, F} = await fresh(key);
    await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/startCloze/.test(e.getAttribute('onclick'))));
    await waitIn(F, ()=>document.querySelector('#clozeContent [onclick^="startClozeLevel"]'));
    const card = await F.evaluate((l)=>document.querySelector('#clozeContent [onclick="startClozeLevel(\''+l+'\')"]').innerText.replace(/\s+/g,' '), level);
    await tapIn(page, F, (l)=>document.querySelector('#clozeContent [onclick="startClozeLevel(\''+l+'\')"]'), level);
    let n=0; const ctrs=[]; const words=[];
    while(n<60){
      const st = await waitIn(F, ()=> (clozeActive && clozeQ && document.querySelectorAll('#clozeScreen .cloze-opt').length===4 && !document.querySelector('#clozeScreen .cloze-opt[data-done]')) ? {en:clozeQ.word.en, ctr:(document.getElementById('clozeContent').innerText.match(/(\d+)\s*\/\s*(\d+)/)||[]).slice(1,3).join('/')} : (!clozeActive ? 'DONE':null), null, 12000);
      if(!st || st==='DONE') break;
      ctrs.push(st.ctr); words.push(st.en);
      await F.evaluate(()=>{ window.__pv=clozeQ; });
      const i = await F.evaluate(()=>clozeQ.opts.findIndex(o=>o.en===clozeQ.word.en));
      await tapIn(page, F, (i)=>document.querySelectorAll('#clozeScreen .cloze-opt')[i], i);
      await waitIn(F, ()=>clozeQ!==window.__pv || !clozeActive, null, 12000);
      n++;
    }
    await sleep(500);
    const res = await F.evaluate(()=>document.getElementById('clozeContent').innerText.replace(/\s+/g,' '));
    const skipped = await F.evaluate((l)=>CLOZE_LEVEL_IDX[l].map(i=>allW[i]).filter(w=>!new RegExp('\\b'+w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(w.ex||'')).map(w=>w.en+' ("'+w.ex+'")'), level);
    await page.screenshot({path:`${OUT}/shots/cloze_total_${key}.png`});
    console.log(`[a] ${key} ${level}: level card "${card}"\n    questions actually asked=${n} (all answered correctly)\n    counter sequence=${ctrs.join(' ')}\n    result="${res.slice(0,160)}"\n    words skipped by the game=${JSON.stringify(skipped)}`);
    await ctx.close();
  }
}
if(which.includes('b')){
  const {ctx, page, F} = await fresh('animal');
  await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/startMatch/.test(e.getAttribute('onclick'))));
  await waitIn(F, ()=>document.querySelectorAll('#matchBoard .match-card').length===16);
  const pairs = await F.evaluate(()=>matchPairs.map(p=>p.idx));
  const done=new Set();
  for(let k=0;k<pairs.length;k++){ if(done.has(pairs[k])) continue; done.add(pairs[k]); const j=pairs.findIndex((p,jj)=>jj!==k&&p===pairs[k]); await tapIn(page,F,(i)=>document.getElementById('mc'+i),k); await sleep(120); await tapIn(page,F,(i)=>document.getElementById('mc'+i),j); await sleep(600); }
  await sleep(1200);
  const res = await F.evaluate(()=>({txt:document.getElementById('matchContent').innerText.replace(/\s+/g,' ').slice(0,120), pq:window.__pq, matchQuestDefs: (function(){ try{ return JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')).list.map(q=>q.id+':'+q.progress+'/'+q.goal); }catch(e){ return 'n/a'; } })()}));
  console.log('[b] match result', JSON.stringify(res));
  await ctx.close();
}
if(which.includes('c')){
  const {ctx, page, F} = await fresh('animal');
  await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/startMoles/.test(e.getAttribute('onclick'))));
  await waitIn(F, ()=>document.querySelector('#molesContent [onclick="startMolesLevel(\'easy\')"]'));
  await tapIn(page, F, ()=>document.querySelector('#molesContent [onclick="startMolesLevel(\'easy\')"]'));
  let hits=0, misses=0;
  for(let q=0;q<12;q++){
    const st = await waitIn(F, ()=> (molesActive && molesTarget && document.querySelector('#moleSlot0 .mole-card') && !document.querySelector('[id^="moleSlot"][data-locked]')) ? molesTarget.en : (!molesActive?'DONE':null), null, 6000);
    if(!st||st==='DONE') break;
    const wrong = q>=4; // 4 hits then miss until game over
    const i = await F.evaluate((w)=>{ const sl=[...document.querySelectorAll('[id^="moleSlot"]')]; return w? sl.findIndex(s=>s.dataset.en&&s.dataset.en!==molesTarget.en) : sl.findIndex(s=>s.dataset.en===molesTarget.en); }, wrong);
    await tapIn(page, F, (i)=>document.getElementById('moleSlot'+i), i, {scroll:q===0});
    wrong?misses++:hits++;
    await waitIn(F, (e)=>!molesActive || (molesTarget&&molesTarget.en!==e), st, 4000);
  }
  await sleep(600);
  const res = await F.evaluate(()=>({txt:document.getElementById('molesContent').innerText.replace(/\s+/g,' ').slice(0,200), pq:window.__pq, score:molesScore, quests:(function(){ try{ return JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')).list.map(q=>q.id+':'+q.progress+'/'+q.goal); }catch(e){ return 'n/a'; } })()}));
  console.log('[c] moles hits',hits,'misses',misses, JSON.stringify(res));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
