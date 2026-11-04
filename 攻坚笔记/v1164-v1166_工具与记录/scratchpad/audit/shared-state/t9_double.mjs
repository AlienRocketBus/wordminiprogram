import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
async function boxOf(frame,sel,idx=0){
  const b=await frame.evaluate(([sel,idx])=>{const el=document.querySelectorAll(sel)[idx];if(!el)return null;el.scrollIntoView({block:'center',behavior:'auto'});return 1;},[sel,idx]);
  if(!b)return null;await sleep(150);
  return frame.evaluate(([sel,idx])=>{const el=document.querySelectorAll(sel)[idx];const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:!!(t&&(t===el||el.contains(t))),top:t&&(t.id||String(t.className).slice(0,40)||t.tagName)};},[sel,idx]);
}
const W=['hansen_wallet_coins','hansen_wallet_charxp','hansen_wallet_gems'];
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(3000);
// ---- Daily chest double tap ----
let b=await boxOf(frame,'#chestCard');await page.touchscreen.tap(b.x,b.y);await sleep(700);
const before=await ls(page,W);
b=await boxOf(frame,'#chestBox');console.log('chestBox',JSON.stringify(b));
if(b&&b.hit){await page.touchscreen.tap(b.x,b.y);await sleep(40);await page.touchscreen.tap(b.x,b.y);await sleep(60);await page.touchscreen.tap(b.x,b.y);}
await sleep(3500);
const after=await ls(page,W);
console.log('chest before',JSON.stringify(before),'after',JSON.stringify(after));
console.log('receipt',await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/checkin/.test(k))o[k]=localStorage.getItem(k).slice(0,200);}return o;}));
console.log('topbar',JSON.stringify(await topbar(frame)));
// ---- Quest claim double tap ----
await frame.evaluate(()=>{try{showScreen('home');}catch(e){}});await sleep(500);
const qs=await frame.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941'));return s.list.map(q=>({id:q.id,progress:q.progress,claimed:q.claimed}));});
console.log('quests',JSON.stringify(qs));
const def=await frame.evaluate((qs)=>{const d=qs.map(q=>HansenQuestGlobal.definition(q.id));return d;},qs);
// complete first quest whose type is 'correct' or 'listen' or any by calling progressQuest(type,goal) (what games call)
const pick=def.find(d=>d&&d.type!=='reviewClear')||def[0];
await frame.evaluate((d)=>progressQuest(d.type,d.goal),pick);
console.log('completed via progressQuest',pick.id,pick.type,pick.goal);
b=await boxOf(frame,'#questCard');await page.touchscreen.tap(b.x,b.y);await sleep(800);
const qb=await ls(page,W);
const idx=await frame.evaluate(()=>{const btns=[...document.querySelectorAll('#questsScreen button.quest-reward, button.quest-reward')];return btns.length;});
console.log('claim buttons',idx);
b=await boxOf(frame,'button.quest-reward');console.log('claim btn',JSON.stringify(b));
if(b&&b.hit){await page.touchscreen.tap(b.x,b.y);await sleep(30);await page.touchscreen.tap(b.x,b.y);await sleep(30);await page.touchscreen.tap(b.x,b.y);}
await sleep(2000);
const qa=await ls(page,W);
console.log('quest before',JSON.stringify(qb),'after',JSON.stringify(qa),'expected reward',JSON.stringify(pick.reward));
console.log('topbar',JSON.stringify(await topbar(frame)));
console.log(log.filter(l=>!/google|favicon/.test(l)).slice(0,10).join('\n'));
await s.close();
