import fs from 'fs';
import {boot,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const init=fs.readFileSync('instr.js','utf8');
const {s,page,log}=await boot({init});
const W=['hansen_wallet_coins','hansen_wallet_charxp','hansen_quest_claim_pending_v942','hansen_quest_xp_pending_v942'];
await page.evaluate(()=>openIsland('island_food.html'));
let frame;for(let i=0;i<60;i++){await sleep(100);frame=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().includes('island_food'));if(frame){try{if(await frame.evaluate(()=>!!window.S&&typeof claimQuest==='function'&&document.readyState==='complete'))break;}catch(e){}}}
await dismissWelcome(frame);
const t0=Date.now();
await frame.evaluate(()=>progressQuest('learn',10));
const qi=await frame.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941'));return s.list.findIndex(q=>q.id==='learn10');});
const r=await frame.evaluate((qi)=>{const own=Object.prototype.hasOwnProperty.call(localStorage,'setItem');const ps=localStorage.setItem;const pp=Storage.prototype.setItem;localStorage.setItem=function(k,v){if(k==='hansen_wallet_charxp')throw new Error('Quota (simulated)');return ps.call(localStorage,k,v);};let out;try{out=claimQuest(qi);}finally{if(own)localStorage.setItem=ps;else delete localStorage.setItem;}return out;},qi);
console.log('t+'+(Date.now()-t0)+'ms failed claim ->',r,JSON.stringify(await ls(page,W)),'food S.charXP',await frame.evaluate(()=>S.charXP));
console.log('frames now',page.frames().map(f=>f.url().replace(s.base,'')).join(' , '));
await sleep(12000);
console.log('after hidden frames booted',JSON.stringify(await ls(page,W)),'food S.charXP',await frame.evaluate(()=>S.charXP),'food topbar xp',await frame.evaluate(()=>document.getElementById('xpText').textContent));
const xpw=(await page.evaluate(()=>window.__W)).filter(w=>w.t>=t0&&/charxp|quest_xp|claim_pending/.test(w.k));
for(const w of xpw)console.log('  ',((w.t-t0)/1000).toFixed(2),w.f,w.op,w.k,(w.v||'').slice(0,70));
// the child keeps playing in food: one correct listen answer = addXP(5)
await frame.evaluate(()=>addXP(5));
console.log('after food addXP(5)',JSON.stringify(await ls(page,W)),'(expected charxp 65)');
await s.close();
