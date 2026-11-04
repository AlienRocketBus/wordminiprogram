import {setup,attach,sleep} from './lib.mjs';
const s=await setup();const log=[];
async function open(file){const p=await s.ctx.newPage();attach(p,log);await p.goto(s.base+file,{waitUntil:'load'});await sleep(2500);await p.evaluate(()=>{const m=document.getElementById('alertModal');const b=m&&[...m.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent));b&&b.click();});return p;}
const h=await s.ctx.newPage();await h.goto(s.base+'index.html');await sleep(1500);await h.close();
const A=await open('island_food.html'), B=await open('island_animal.html');
const g=p=>p.evaluate(()=>({charxp:localStorage.getItem('hansen_wallet_charxp'),S:S.charXP,top:document.getElementById('xpText')?.textContent,lvl:document.getElementById('lvl')?.textContent}));
console.log('allW food',await A.evaluate(()=>allW.length));
console.log('start',JSON.stringify(await g(A)));
await A.evaluate(()=>{for(let i=0;i<4;i++)addXP(5);});
console.log('A +20',JSON.stringify(await g(A)));
await B.evaluate(()=>addXP(5));
console.log('B +5',JSON.stringify(await g(B)),'expected 25');
// storage event delivered to A? A's top bar after B write
console.log('A view after B write',JSON.stringify(await g(A)));
await A.close();await B.close();
// heal on next boot?
const C=await open('island_body.html');await sleep(500);
console.log('after next island boot (body)',JSON.stringify(await g(C)));
await s.close();
