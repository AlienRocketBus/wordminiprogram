import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(2500);
const badge=()=>frame.evaluate(()=>{const c=document.getElementById('questCard');const d=document.getElementById('questDot');return (c?c.innerText.replace(/\s+/g,' ').trim():null)+' | dot='+(d?getComputedStyle(d).display:'none?');});
console.log('badge before',await badge());
await frame.evaluate(()=>HansenSpellBee.open('food'));
let bee=null;for(let i=0;i<60;i++){await sleep(200);bee=page.frames().find(f=>f.url().includes('embed=1'));if(bee){try{if(await bee.evaluate(()=>typeof window.progressQuest==='function'&&document.readyState==='complete'))break;}catch(e){}}}
await sleep(800);
// exactly what spelling_bee.html:2266 runs on a win
await bee.evaluate(()=>window.progressQuest('sbwin',1));
await sleep(500);
try{await bee.evaluate(()=>{setTimeout(()=>parent.HansenSpellBee.close(),30);});}catch(e){}
await sleep(1500);
const fresh=await frame.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941'));const done=s.list.filter(q=>{const d=HansenQuestGlobal.definition(q.id);return d&&q.progress>=d.goal;}).length;return {done,total:s.list.length,sb:s.list.find(q=>/^sbWin/.test(q.id))};});
console.log('store after bee win',JSON.stringify(fresh));
console.log('badge after close',await badge());
await frame.evaluate(()=>updateTopBar());
console.log('badge after manual updateTopBar',await badge());
await s.close();
