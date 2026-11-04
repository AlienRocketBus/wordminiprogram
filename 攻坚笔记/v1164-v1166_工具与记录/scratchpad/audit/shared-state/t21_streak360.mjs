import {boot,openIslandByTap,dismissWelcome,topbar,sleep} from './harness.mjs';
for(const w of [360,390]){
const {s,page,log}=await boot({w});
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(2500);
for(const xp of [0,52300]){
  if(xp)await frame.evaluate((xp)=>{addXP(xp);},xp);await sleep(3500);
  const vis=await frame.evaluate(()=>{const e=document.getElementById('streakCount');const r=e.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;const t=document.elementFromPoint(cx,cy);let p=e.parentElement,clipped=false;while(p&&p!==document.body){const pr=p.getBoundingClientRect();const cs=getComputedStyle(p);if(cs.overflow!=='visible'&&(r.right>pr.right+0.5||r.left<pr.left-0.5))clipped=true;p=p.parentElement;}return {rect:[Math.round(r.left),Math.round(r.right)],vw:innerWidth,hitSelf:t===e,top:t&&(t.id||t.className),clipped,lvl:document.getElementById('lvl').textContent};});
  console.log('w',w,'xp',xp,JSON.stringify(vis));
  await page.screenshot({path:`streak_${w}_${xp}.png`,clip:{x:0,y:0,width:w,height:80}});
}
await s.close();}
