import fs from 'fs';
import {setup,bootHome,tapSel,waitIsland,dismissWelcome,tree,sleep} from './lib.mjs';
const s=await setup({init:fs.readFileSync(new URL('./instr.js',import.meta.url),'utf8')});const log=[];
const page=await bootHome(s,log);
console.log('HOME tree:\n'+tree(page.mainFrame(),s.base));
const t=await tapSel(page,'a.island[href="island_food.html"]');console.log('tap',JSON.stringify(t));
const fr=await waitIsland(page,'island_food.html');console.log('welcome',await dismissWelcome(fr));
const t0=Date.now();
await sleep(14000);
console.log('FOOD tree +14s:\n'+tree(page.mainFrame(),s.base));
const inst=await page.evaluate(()=>{const out=[];function walk(w,d){try{if(w.S&&typeof w.addXP==='function')out.push(d+':'+w.location.pathname.split('/').pop()+' key='+w.__hsnSaveKey+' vis='+w.document.visibilityState);}catch(e){}for(let i=0;i<w.frames.length;i++)walk(w.frames[i],d+1);}walk(window,0);return out;});
console.log('island instances:',inst);
const W=(await page.evaluate(()=>window.__W||[])).filter(w=>w.t>=t0-3000&&!/^0:|^1:island_food/.test(w.f));
const agg={};for(const w of W){const k=w.f+' '+w.op+' '+w.k.replace(/\d{4}-\d+-\d+/,'D');agg[k]=(agg[k]||0)+1;}
console.log('writes by hidden frames (count):');for(const [k,v] of Object.entries(agg).sort())console.log('  ',v,k);
// now season path
await page.evaluate(()=>{try{document.getElementById('islandFrame').contentWindow.goHome();}catch(e){}});await sleep(1000);
await page.evaluate(()=>openIsland('island_season.html'));
const fs2=await waitIsland(page,'island_season.html');await dismissWelcome(fs2);await sleep(14000);
console.log('SEASON tree +14s:\n'+tree(page.mainFrame(),s.base));
const inst2=await page.evaluate(()=>{const out=[];function walk(w,d){try{if(w.S&&typeof w.addXP==='function')out.push(d+':'+w.location.pathname.split('/').pop()+' key='+w.__hsnSaveKey);}catch(e){}for(let i=0;i<w.frames.length;i++)walk(w.frames[i],d+1);}walk(window,0);return out;});
console.log('island instances (season):',inst2);
console.log('ext',[...s.ext]);console.log('log',log.slice(0,10));
await s.close();
