import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
const W=['hansen_wallet_coins','hansen_wallet_charxp','hansen_quest_claim_pending_v942'];
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(3000);
await frame.evaluate(()=>progressQuest('learn',10));
const qi=await frame.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941'));return s.list.findIndex(q=>q.id==='learn10');});
const b0=await ls(page,W);
// simulate quota failure on XP write during the claim (coin leg succeeds, XP leg fails)
const r=await frame.evaluate((qi)=>{const own=Object.prototype.hasOwnProperty.call(localStorage,'setItem');const ps=localStorage.setItem;const pp=Storage.prototype.setItem;const bad=function(k,v){if(k==='hansen_wallet_charxp')throw new Error('QuotaExceededError (simulated)');return pp.call(localStorage,k,v);};localStorage.setItem=bad;Storage.prototype.setItem=function(k,v){if(k==='hansen_wallet_charxp')throw new Error('QuotaExceededError (simulated)');return pp.apply(this,arguments);};let out;try{out=claimQuest(qi);}finally{if(own)localStorage.setItem=ps;else delete localStorage.setItem;Storage.prototype.setItem=pp;}return {out,own,pend:localStorage.getItem('hansen_quest_claim_pending_v942')};},qi);
const b1=await ls(page,W);
console.log('claim returned',r,'\n before',JSON.stringify(b0),'\n after failed claim',JSON.stringify(b1),'\n topbar',JSON.stringify(await topbar(frame)));
// "reload mid-transaction": user reloads WeChat page
await page.reload({waitUntil:'load'});await sleep(4000);
let fr2;for(let i=0;i<40;i++){await sleep(250);fr2=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().includes('island_food'));if(fr2){try{if(await fr2.evaluate(()=>!!window.S&&document.readyState==='complete'))break;}catch(e){}}}
await sleep(3000);
const b2=await ls(page,W);
const q=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941'));return s.list.find(q=>q.id==='learn10');});
console.log('after reload',JSON.stringify(b2),'quest',JSON.stringify(q),'island reopened',!!fr2, fr2?JSON.stringify(await topbar(fr2)):'');
// user taps claim again
if(fr2){const rr=await fr2.evaluate((qi)=>claimQuest(qi),qi);await sleep(800);console.log('re-claim',rr,JSON.stringify(await ls(page,W)),JSON.stringify(await topbar(fr2)));
const rr2=await fr2.evaluate((qi)=>claimQuest(qi),qi);console.log('third claim',rr2,JSON.stringify(await ls(page,W)));}
console.log(log.filter(l=>/DIALOG|PAGEERR/.test(l)).slice(0,8).join('\n'));
await s.close();
