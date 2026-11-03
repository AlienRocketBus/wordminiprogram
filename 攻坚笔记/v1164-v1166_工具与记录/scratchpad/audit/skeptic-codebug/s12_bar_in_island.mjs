import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/island_animal.html',{waitUntil:'load'}); await sleep(4000);
const r=await p.evaluate(()=>({seasonBar:!!document.getElementById('hsnSeasonBar'), openIsland:typeof window.openIsland, rooms:window.HansenRoom?HansenRoom._rooms():null}));
console.log(JSON.stringify(r));
// index: what wallet-changing actions exist on the home page
await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(3000);
const h=await p.evaluate(()=>({checkin:typeof window.HansenCheckin, checkinUI:[...document.querySelectorAll('button,div,a')].filter(x=>/签到|领取|宝箱/.test(x.textContent)&&x.children.length===0&&x.offsetParent).map(x=>x.textContent.trim()).slice(0,10)}));
console.log(JSON.stringify(h));
await c.close(); await b.close(); srv.close();
