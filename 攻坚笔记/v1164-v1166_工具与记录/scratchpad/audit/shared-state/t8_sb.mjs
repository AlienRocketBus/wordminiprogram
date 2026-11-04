import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
async function tapIn(frame,sel,idx=0){
  const b=await frame.evaluate(([sel,idx])=>{const el=document.querySelectorAll(sel)[idx];if(!el)return null;el.scrollIntoView({block:'center',behavior:'auto'});return 1;},[sel,idx]);
  if(!b)return {err:'noel '+sel};
  await sleep(150);
  const box=await frame.evaluate(([sel,idx])=>{const el=document.querySelectorAll(sel)[idx];const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:!!(t&&(t===el||el.contains(t))),top:t&&(t.id||String(t.className).slice(0,40)||t.tagName)};},[sel,idx]);
  if(box.hit)await page.touchscreen.tap(box.x,box.y);
  return box;
}
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(3000);
console.log('before',JSON.stringify(await topbar(frame)));
console.log('tap bee card',JSON.stringify(await tapIn(frame,'.mode-card[onclick^="HansenSpellBee.open"]')));
let bee=null;for(let i=0;i<60;i++){await sleep(200);bee=page.frames().find(f=>f.url().includes('spelling_bee.html')&&f.url().includes('embed=1'));if(bee){try{if(await bee.evaluate(()=>document.readyState==='complete'&&typeof sbQueueCappedReward==='function'))break;}catch(e){}}}
await sleep(1500);
console.log('bee frame',!!bee);
// a bot-match win queues the match bonus exactly like this (spelling_bee.html:2247)
const r=await bee.evaluate(()=>{const x=sbQueueCappedReward(10,0,'match');try{sbFlushRewardPending();}catch(e){}return x;});
console.log('queued',JSON.stringify(r));
await sleep(1500);
console.log('wallet',JSON.stringify(await ls(page,['hansen_wallet_coins'])),'island topbar while overlay open',JSON.stringify(await topbar(frame)));
// close overlay via in-game return path
try{await bee.evaluate(()=>{setTimeout(()=>{try{parent.HansenSpellBee.close();}catch(e){}},50);});}catch(e){}
await sleep(1200);
console.log('after close: wallet',JSON.stringify(await ls(page,['hansen_wallet_coins'])),'topbar',JSON.stringify(await topbar(frame)));
await sleep(5000);
console.log('5s later topbar',JSON.stringify(await topbar(frame)));
await page.screenshot({path:'sb_after_close.png'});
console.log(log.slice(0,10).join('\n'));
console.log("EXT",[...s.external]);await s.close();
