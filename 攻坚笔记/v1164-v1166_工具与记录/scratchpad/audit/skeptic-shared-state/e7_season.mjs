import fs from 'fs';
import {setup,bootHome,waitIsland,dismissWelcome,sleep,tree} from './lib.mjs';
const s=await setup({init:fs.readFileSync(new URL('./instr.js',import.meta.url),'utf8')});const log=[];
const page=await bootHome(s,log);
await page.evaluate(()=>openIsland('island_season.html'));
const fr=await waitIsland(page,'island_season.html');await dismissWelcome(fr);
const t0=Date.now();
// continuous play from t0 for 15 s: learn a new word + answer every 300 ms
await fr.evaluate(()=>{let i=0;window.__iv=setInterval(()=>{if(i>=50){clearInterval(window.__iv);return;}learnWord(i);markAnswer(i,true);i++;},300);});
await sleep(16000);
await sleep(3000);
const st=()=>fr.evaluate(()=>{const w=JSON.parse(localStorage.getItem('wordIslandSeason'));const p=JSON.parse(localStorage.getItem('hsn_progress:'+document.title)||localStorage.getItem('hsn_progress:星海词汇大冒险')||'null');return {title:document.title,mem_learned:S.learned.length,mem_ans:S.totalAnswers,stored_learned:w.learned.length,stored_ans:w.totalAnswers,progress:p&&{ans:p.ans,cor:p.cor,learned:p.learned}};});
console.log('+19s',JSON.stringify(await st()));
const P=[];for(let k=0;k<5;k++){await sleep(4000);const v=await page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('hsn_progress:')&&/星海/.test(k));return k+'='+localStorage.getItem(k).slice(0,80);});P.push(v);}
console.log('progress snapshot samples every 4s:\n  '+P.join('\n  '));
const pk=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('hsn_progress:')&&/星海/.test(k)));
const W=(await page.evaluate(()=>window.__W)).filter(w=>w.t>=t0&&(w.k===pk||w.k==='wordIslandSeason'));
const agg={};for(const w of W){const k=w.f+' '+w.k;agg[k]=(agg[k]||0)+1;}console.log('writers',JSON.stringify(agg));
// leave: home, then open food (unloads season tree)
await fr.evaluate(()=>goHome());await sleep(1000);
const tl=Date.now();
await page.evaluate(()=>openIsland('island_food.html'));const ff=await waitIsland(page,'island_food.html');await sleep(1500);
const fin=await page.evaluate((pk)=>{const w=JSON.parse(localStorage.getItem('wordIslandSeason'));return {stored_learned:w.learned.length,stored_ans:w.totalAnswers,progress:localStorage.getItem(pk).slice(0,90)};},pk);
console.log('after leaving season',JSON.stringify(fin));
const W2=(await page.evaluate(()=>window.__W)).filter(w=>w.t>=tl-200&&(w.k===pk||w.k==='wordIslandSeason'));for(const w of W2)console.log('  +'+((w.t-tl)/1000).toFixed(2),w.f,w.k,(w.v||'').slice(0,70));
// what does the 我的学习 aggregate show?
await s.close();
