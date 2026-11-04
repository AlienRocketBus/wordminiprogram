import {serve,launch,newCtx,attach,sleep,ROOT} from './kit.mjs';
import fs from 'node:fs';
const {srv,base}=await serve();
const html=fs.readFileSync(ROOT+'/island_animal.html','utf8');
const m=html.indexOf('\nfunction checkAch(){'); let i=html.indexOf('{',m)+1, d=1; while(d&&i<html.length){ if(html[i]==='{')d++; else if(html[i]==='}')d--; i++; }
const fnSrc=html.slice(m,i).replace('function checkAch(){','window.__tplCheckAch=function(){');
const b=await launch();
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/island_animal.html',{waitUntil:'load'}); await sleep(4000);
const r=await p.evaluate(async (src)=>{
  (0,eval)(src);
  // realistic shapes: *Best are per-difficulty objects
  S.stats.speedBest={easy:250,medium:0,hard:0}; S.stats.bubbleBest={easy:60,medium:0,hard:0}; S.stats.molesBest={easy:60,medium:0,hard:0};
  S.stats.clozeRight=60; S.stats.listenRight=15; S.stats.typeCount=25; S.stats.daysPlayed=5; S.stats.matchPerfect=6; S.stats.chestClaimed=6;
  localStorage.setItem('sb_best_cpm','45');
  save();
  window.__tplCheckAch();
  await new Promise(r=>setTimeout(r,300));
  const ids=['clozeS10','clz50','listenS10','typingS20','speedS200','bubbleS50','molesS50','cpm40','cpmS30','dayNS3','matchpS5','chestS5','perfMatch'];
  return Object.fromEntries(ids.map(id=>[id, HansenAch.isPending(id)||HansenAch.isClaimed(id)]));
}, fnSrc);
console.log(JSON.stringify(r,null,1), log.slice(0,5));
await c.close(); await b.close(); srv.close();
