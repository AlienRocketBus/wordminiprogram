import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(9000);
// earn 41 XP via real addXP calls (same function games call)
await frame.evaluate(()=>{for(let i=0;i<8;i++)addXP(5);});
await sleep(1500);
const dump=async(tag)=>{const o=await page.evaluate(()=>{const r={charxp:localStorage.getItem('hansen_wallet_charxp')};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^wordIsland[A-Za-z0-9]+$/.test(k)){try{const j=JSON.parse(localStorage.getItem(k));r[k]={totalXP:j.totalXP,xp:j.xp,charXP:j.charXP,level:j.level};}catch(e){}}}return r;});console.log(tag,JSON.stringify(o));};
await dump('after food play');
for(const isl of ['island_animal.html','island_body.html','island_city.html']){
  await page.evaluate(()=>closeIsland());await sleep(800);
  const r=await openIslandByTap(page,isl);await dismissWelcome(r.frame);await sleep(9000);
  await dump('after open '+isl);
  console.log(' topbar',JSON.stringify(await topbar(r.frame)));
}
await s.close();
