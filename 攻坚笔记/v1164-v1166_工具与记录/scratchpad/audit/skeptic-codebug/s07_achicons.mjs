import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_food.html','island_land2.html']){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await sleep(3800);
  // close welcome if present via real tap
  const w=await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(!b) return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};});
  if(w){ await p.touchscreen.tap(w.x,w.y); await sleep(600); }
  await p.evaluate(()=>showScreen('ach')); await sleep(800);
  out[isl]=await p.evaluate(()=>[...document.querySelectorAll('.ach-bar')].map(x=>x.innerText.replace(/\s+/g,' ').trim()));
  if(isl==='island_food.html') await p.screenshot({path:'s07_ach_icons.png'});
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
