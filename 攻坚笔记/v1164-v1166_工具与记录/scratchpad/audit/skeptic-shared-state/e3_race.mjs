import fs from 'fs';
import {setup,bootHome,tapSel,waitIsland,dismissWelcome,tree,sleep} from './lib.mjs';
const s=await setup({init:fs.readFileSync(new URL('./instr.js',import.meta.url),'utf8')});const log=[];
const page=await bootHome(s,log);
await tapSel(page,'a.island[href="island_food.html"]');
const fr=await waitIsland(page,'island_food.html');await dismissWelcome(fr);
const snap=()=>fr.evaluate(()=>{const c=JSON.parse(localStorage.getItem('hansen_canonical_progress_v941')||'null');const q=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')||'null');const f=JSON.parse(localStorage.getItem('wordIslandFood')||'{}');
  let canonFood=null;try{const key=Object.keys(c||{}).find(k=>/island|slots|data/i.test(k));canonFood=JSON.stringify(c).length;}catch(e){}
  return {coins:localStorage.getItem('hansen_wallet_coins'),charxp:localStorage.getItem('hansen_wallet_charxp'),S_charXP:S.charXP,S_learned:S.learned.length,saved_learned:(f.learned||[]).length,saved_totalXP:f.totalXP,S_totalXP:S.totalXP,quests:q&&q.list.map(x=>x.id+':'+x.progress+'/'+x.target+(x.claimed?'C':'')).join(' '),canonKeys:c&&Object.keys(c).join(','),canonLen:canonFood};});
console.log('before',JSON.stringify(await snap()));
const frames0=page.frames().length;
// start writes immediately, during hidden warm boot
await fr.evaluate(()=>{window.__cnt={learn:0,coin:0};let i=0;window.__iv=setInterval(()=>{if(i>=100){clearInterval(window.__iv);return;}learnWord(i);HansenCoins.add(1);window.__cnt.learn++;window.__cnt.coin++;i++;},150);});
await sleep(16500);
console.log('frames before/after',frames0,page.frames().length);
const cnt=await fr.evaluate(()=>window.__cnt);
console.log('counts',JSON.stringify(cnt));
console.log('after',JSON.stringify(await snap()));
// canonical: count learned in food slots
const canon=await fr.evaluate(()=>{const c=JSON.parse(localStorage.getItem('hansen_canonical_progress_v941')||'null');return JSON.stringify(c).slice(0,600);});
console.log('canon head',canon);
await s.close();
