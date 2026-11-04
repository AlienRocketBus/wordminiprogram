import {boot,dismissWelcome,sleep} from './harness.mjs';
const {s,page,log}=await boot();
await page.evaluate(()=>openIsland('island_food.html'));
let frame;for(let i=0;i<60;i++){await sleep(100);frame=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().includes('island_food'));if(frame){try{if(await frame.evaluate(()=>!!window.S&&document.readyState==='complete'))break;}catch(e){}}}
await frame.evaluate(()=>{window.__ev=[];addEventListener('storage',e=>{if(/charxp|wallet_coins/.test(e.key))__ev.push(e.key+'='+e.newValue);});});
await page.evaluate(()=>{window.__evTop=[];addEventListener('storage',e=>{if(/charxp|wallet_coins/.test(e.key))__evTop.push(e.key+'='+e.newValue);});});
await sleep(9000);
// a write from a hidden nested frame:
const hidden=page.frames().find(f=>f.url().includes('island_season'));
await hidden.evaluate(()=>localStorage.setItem('hansen_wallet_charxp','777'));
await sleep(300);
console.log('food iframe received:',await frame.evaluate(()=>__ev),'| top received:',await page.evaluate(()=>__evTop));
await s.close();
