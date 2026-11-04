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
  const res={};
  learnWord(0); await new Promise(r=>setTimeout(r,500));
  res.afterLearn_override = {wrongClear:HansenAch.isPending('wrongClear'), seenFlag:localStorage.getItem('hansen_wrong_seen_v942'), wrongs:Object.keys(S.wrongs||{}).length};
  window.__tplCheckAch(); await new Promise(r=>setTimeout(r,300));
  res.afterTplCheck = {wrongClear:HansenAch.isPending('wrongClear'), pending:HansenAch.getPending()};
  return res;
}, fnSrc);
console.log(JSON.stringify(r,null,1), log.slice(0,4));
await c.close(); await b.close(); srv.close();
