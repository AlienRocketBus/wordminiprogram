import {setup,bootHome,tapSel,waitIsland,dismissWelcome,sleep} from './lib.mjs';
const s=await setup();const log=[];
const page=await bootHome(s,log);
await tapSel(page,'a.island[href="island_food.html"]');
const fr=await waitIsland(page,'island_food.html');await dismissWelcome(fr);await sleep(2500);
const view=()=>fr.evaluate(()=>({wallet:localStorage.getItem('hansen_wallet_coins'),charxp:localStorage.getItem('hansen_wallet_charxp'),coinTop:document.getElementById('coinCount')?.textContent,xpTop:document.getElementById('xpText')?.textContent,dot:(()=>{const d=document.getElementById('questDot');return d?getComputedStyle(d).display:'nodot';})()}));
console.log('before',JSON.stringify(await view()));
// real tap on the spelling bee mode card inside the island frame
const box=await fr.evaluate(()=>{const el=document.querySelector('.mode-card[onclick^="HansenSpellBee.open"]');if(!el)return null;el.scrollIntoView({block:'center'});return 1;});
await sleep(300);
const b=await fr.evaluate(()=>{const el=document.querySelector('.mode-card[onclick^="HansenSpellBee.open"]');const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:!!(t&&(t===el||el.contains(t)))};});
console.log('bee card',JSON.stringify(b));if(b.hit)await page.touchscreen.tap(b.x,b.y);
let bee=null;for(let i=0;i<80;i++){await sleep(200);bee=page.frames().find(f=>f.url().includes('spelling_bee.html')&&f.url().includes('embed=1'));if(bee){try{if(await bee.evaluate(()=>document.readyState==='complete'&&typeof sbQueueCappedReward==='function'))break;}catch(e){}}}
await sleep(1200);
console.log('bee open',!!bee);
// one correct word reward (coins+xp) then the match-win bonus (coins only) and sbwin quest, as endMatch does
const w=await bee.evaluate(()=>JSON.stringify(sbQueueCappedReward(3,2,'word')));await sleep(800);
console.log('after word reward',w,JSON.stringify(await view()));
const m=await bee.evaluate(()=>{const r=sbQueueCappedReward(10,0,'match');try{window.progressQuest('sbwin',1);}catch(e){}return JSON.stringify(r);});await sleep(1000);
console.log('after match bonus+sbwin',m,JSON.stringify(await view()));
await bee.evaluate(()=>{setTimeout(()=>{try{parent.HansenSpellBee.close();}catch(e){}},30);}).catch(()=>{});
await sleep(1500);
console.log('after close',JSON.stringify(await view()),'overlay?',await fr.evaluate(()=>!!document.getElementById('hsnSbOverlay')));
await fr.evaluate(()=>goHome());await sleep(1200);
await tapSel(page,'a.island[href="island_food.html"]');await sleep(1500);
console.log('after home→re-enter',JSON.stringify(await view()));
await fr.evaluate(()=>updateTopBar());
console.log('after manual updateTopBar',JSON.stringify(await view()));
console.log(log.slice(0,5));
await s.close();
