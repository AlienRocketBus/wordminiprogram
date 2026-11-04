// MG-09: perfect 记忆翻牌 game → what amount reaches the 'match' quest?
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'food';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, island);
await F.evaluate(()=>{ window.__pq=[]; const o=window.progressQuest; window.progressQuest=function(k,n){ window.__pq.push([k,n]); return o.apply(this, arguments); }; });
const qBefore = await F.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')).list.map(q=>q.id+':'+q.progress); }catch(e){ return String(e); } });
await tapCard(page, F, /^startMatch\(/);
await waitIn(F, ()=>document.querySelector('#mc0'));
await sleep(500);
const pairs = await F.evaluate(()=>{ const m={}; matchPairs.forEach((c,i)=>{ (m[c.idx]=m[c.idx]||[]).push(i); }); return Object.values(m); });
for(const [a,b] of pairs){
  await tap(page, F, (i)=>document.getElementById('mc'+i), a); await sleep(250);
  await tap(page, F, (i)=>document.getElementById('mc'+i), b); await sleep(800);
}
await waitIn(F, ()=>/完美通关|完成/.test(document.getElementById('matchContent').innerText), null, 5000);
const res = await F.evaluate(()=>({txt:document.getElementById('matchContent').innerText.replace(/\s+/g,' ').slice(0,160), matched:matchMatched, mistakes:matchMistakes, pq:window.__pq.filter(x=>x[0]!=='correct'), ledger:(()=>{ try{ return JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')).list.map(q=>q.id+':'+q.progress); }catch(e){ return String(e); } })()}));
console.log(JSON.stringify({island, qBefore, ...res, errors:ev.filter(e=>!/tencent|tcb|signin/i.test(e.t))}));
fs.writeFileSync(`${OUT}/s5_match_${island}.json`, JSON.stringify({island, qBefore, ...res},null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
