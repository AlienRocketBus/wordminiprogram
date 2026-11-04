import fs from 'fs';
import {setup,bootHome,tapSel,waitIsland,dismissWelcome,tree,sleep} from './lib.mjs';
const s=await setup({init:fs.readFileSync(new URL('./instr.js',import.meta.url),'utf8')});const log=[];
const page=await bootHome(s,log);
const recent=()=>page.evaluate(()=>({num:document.getElementById('recentNum')?.textContent,target:document.getElementById('recentLearnStat')?._target,lastIslandKey:localStorage.getItem('lastIslandKey'),food:(JSON.parse(localStorage.getItem('wordIslandFood')||'{}').lastSaveTime||0),season:(JSON.parse(localStorage.getItem('wordIslandSeason')||'{}').lastSaveTime||0)}));
console.log('home before',JSON.stringify(await recent()));
const t0=Date.now();
await tapSel(page,'a.island[href="island_food.html"]');
const fr=await waitIsland(page,'island_food.html');await dismissWelcome(fr);
// play: tap the 听音辨义 card? use addXP-like real answers: simulate a little activity via save
await sleep(1500);
await fr.evaluate(()=>{addXP(5);});
console.log('food activity at +'+(Date.now()-t0));
await sleep(15000);
// go home via the island's own home button function
await fr.evaluate(()=>goHome());
await sleep(2500);
const r=await recent();
console.log('home after food visit',JSON.stringify({...r,food:r.food-t0,season:r.season-t0}));
const W=(await page.evaluate(()=>window.__W||[])).filter(w=>w.t>=t0&&/^(wordIslandSeason|wordIslandFood|theme|hansen_lastIslandMeta|lastIslandKey|hansen_wallet_charxp|hansen_global_daily_quests_v941)$/.test(w.k));
for(const w of W)console.log('  +'+((w.t-t0)/1000).toFixed(1),w.f,w.op,w.k,w.k.startsWith('wordIsland')?('lastSaveTime+'+(((JSON.parse(w.v.length<160?w.v:'{}').lastSaveTime)||0)-t0)):(w.v||'').slice(0,90));
await page.screenshot({path:'e2_home_after.png'});
await s.close();
