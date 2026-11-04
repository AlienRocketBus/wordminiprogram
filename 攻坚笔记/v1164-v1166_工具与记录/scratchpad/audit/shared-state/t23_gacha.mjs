import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);await sleep(2500);
await frame.evaluate(()=>{localStorage.setItem('hansen_wallet_coins','2000');updateTopBar();});
await frame.evaluate(()=>HansenGacha.open());await sleep(800);
const btns=await frame.evaluate(()=>[...document.querySelectorAll('#gachaBody button, #gachaBody [onclick]')].map(b=>(b.getAttribute('onclick')||'')+'|'+b.innerText.replace(/\s+/g,' ').slice(0,30)));
console.log('gacha buttons',JSON.stringify(btns));
// tap the first draw button twice quickly (real touch)
const box=await frame.evaluate(()=>{const b=[...document.querySelectorAll('#gachaBody button, #gachaBody [onclick]')].find(x=>/抽/.test(x.innerText));if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:t===b||b.contains(t),txt:b.innerText.slice(0,20)};});
console.log('draw btn',JSON.stringify(box));
const c0=await ls(page,['hansen_wallet_coins']);
if(box&&box.hit){await page.touchscreen.tap(box.x,box.y);await sleep(40);await page.touchscreen.tap(box.x,box.y);}
await sleep(5000);
const cb=await frame.evaluate(()=>({owned:HansenCardbook.ownedList(),draws:JSON.parse(localStorage.getItem('hansen_wallet_cardbook')).totalDraws}));
console.log('coins',c0,'->',await ls(page,['hansen_wallet_coins']),'cardbook',JSON.stringify(cb),'topbar coin',(await topbar(frame)).coin);
await frame.evaluate(()=>{try{showScreen('home')}catch(e){};goHome();});await sleep(1000);
const r=await openIslandByTap(page,'island_animal.html');await dismissWelcome(r.frame);await sleep(2500);
console.log('animal sees owned',JSON.stringify(await r.frame.evaluate(()=>HansenCardbook.ownedList())),'topbar coin',(await topbar(r.frame)).coin);
await s.close();
