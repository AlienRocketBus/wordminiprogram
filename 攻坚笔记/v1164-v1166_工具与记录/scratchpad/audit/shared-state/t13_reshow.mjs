import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(2500);
await frame.evaluate(()=>HansenSpellBee.open('food'));
let bee=null;for(let i=0;i<60;i++){await sleep(200);bee=page.frames().find(f=>f.url().includes('embed=1'));if(bee){try{if(await bee.evaluate(()=>typeof sbQueueCappedReward==='function'&&document.readyState==='complete'))break;}catch(e){}}}
await sleep(1000);
await bee.evaluate(()=>{sbQueueCappedReward(10,0,'match');sbFlushRewardPending();});await sleep(1200);
try{await bee.evaluate(()=>{setTimeout(()=>parent.HansenSpellBee.close(),30);});}catch(e){}
await sleep(1200);
console.log('after bee close: wallet',(await ls(page,['hansen_wallet_coins'])).hansen_wallet_coins,'topbar coin',(await topbar(frame)).coin);
// go home with the map button, then re-enter the same island card (kept-alive path)
await frame.evaluate(()=>goHome());await sleep(1200);
console.log('at home, wrap',await page.evaluate(()=>document.getElementById('islandFrameWrap').style.display));
const r=await openIslandByTap(page,'island_food.html');
console.log('same frame object reused',r.frame===frame);
await sleep(1500);
console.log('re-entered: wallet',(await ls(page,['hansen_wallet_coins'])).hansen_wallet_coins,'topbar coin',(await topbar(r.frame)).coin);
await page.screenshot({path:'reshow_stale.png'});
await s.close();
