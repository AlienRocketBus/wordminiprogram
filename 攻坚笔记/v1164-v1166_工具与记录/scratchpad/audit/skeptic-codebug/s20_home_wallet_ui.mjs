import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(3000);
await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.click(); });
await sleep(800);
const r=await p.evaluate(()=>{
  const vis=[...document.querySelectorAll('[onclick],button,a')].filter(x=>x.offsetParent||getComputedStyle(x).position==='fixed').map(x=>((x.getAttribute('onclick')||x.getAttribute('href')||'')+' | '+x.textContent.replace(/\s+/g,' ').trim()).slice(0,90));
  return {n:vis.length, items:vis.filter(s=>/商店|主题|shop|Shop|钻石|💎|宝箱|签到|抽|领取|gacha|Gacha/.test(s)).slice(0,20), shopApi:Object.keys(window.HansenThemeShop||{}).slice(0,10), diaApi:Object.keys(window.HansenDiamondShop||{}).slice(0,12)};
});
console.log(JSON.stringify(r,null,1));
await c.close(); await b.close(); srv.close();
