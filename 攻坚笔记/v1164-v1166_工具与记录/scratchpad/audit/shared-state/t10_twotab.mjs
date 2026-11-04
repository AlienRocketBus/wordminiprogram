import {setup,attach,sleep} from './lib.mjs';
const s=await setup();const log=[];
async function openStandalone(file){const p=await s.ctx.newPage();attach(p,log);await p.goto(s.base+file,{waitUntil:'load'});await sleep(2500);await p.evaluate(()=>{const b=[...document.querySelectorAll('#alertModal button')].find(x=>/开始冒险/.test(x.textContent));b&&b.click();});return p;}
// first visit index once so starter coins etc exist
const h=await s.ctx.newPage();await h.goto(s.base+'index.html',{waitUntil:'load'});await sleep(1500);await h.close();
const A=await openStandalone('island_food.html');
const B=await openStandalone('island_animal.html');
const g=async()=>A.evaluate(()=>({charxp:localStorage.getItem('hansen_wallet_charxp'),coins:localStorage.getItem('hansen_wallet_coins')}));
console.log('start',JSON.stringify(await g()));
// A: answer correctly 4x in listen game path => addXP(5) each + coin per answer (same calls as listenAnswer)
await A.evaluate(()=>{for(let i=0;i<4;i++){addXP(5);}});
console.log('after A +20xp',JSON.stringify(await g()),'A topbar xp',await A.evaluate(()=>document.getElementById('xpText').textContent));
await B.evaluate(()=>{addXP(5);});
console.log('after B +5xp',JSON.stringify(await g()),'B topbar xp',await B.evaluate(()=>document.getElementById('xpText').textContent),'expected charxp 25');
// coins same pattern
await A.evaluate(()=>HansenCoins.add(7));await B.evaluate(()=>HansenCoins.add(3));
console.log('coins after A+7,B+3',JSON.stringify(await g()),'B topbar coin',await B.evaluate(()=>document.getElementById('coinCount').textContent));
await s.close();
