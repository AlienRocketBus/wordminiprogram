import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(2500);
const sk=await p.evaluate(()=>{ const e=[...document.querySelectorAll('*')].find(x=>x.children.length===0&&x.textContent.trim()==='跳过'&&x.offsetParent); if(!e) return null; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
if(sk){ await p.touchscreen.tap(sk.x,sk.y); await p.waitForTimeout(800); }
await p.evaluate(()=>openIsland('island_land1.html')); await p.waitForTimeout(4500);
const fr=p.frames().find(f=>/island_land1/.test(f.url()));
async function tapIn(sel){
  await fr.evaluate(s=>{const e=document.querySelector(s); e&&e.scrollIntoView({block:'center',behavior:'auto'});},sel);
  await p.waitForTimeout(300);
  const r=await fr.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const top=document.elementFromPoint(x,y); return {x,y,ok:!!(top&&(top===e||e.contains(top))),top:top&&(top.id||top.className)};},sel);
  if(r&&r.ok) await p.touchscreen.tap(r.x,r.y); // iframe is full-viewport at 0,0
  return r;
}
// dismiss welcome
const btn=await fr.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(b){b.id='__welc';return true;} return false; });
if(btn) await tapIn('#__welc');
await p.waitForTimeout(600);
const badge=await fr.evaluate(()=>document.getElementById('questSub').textContent);
const t=await tapIn('#questCard');
await p.waitForTimeout(800);
const txt=await fr.evaluate(()=>({active:document.querySelector('.screen.active').id, list:document.getElementById('questList').innerText.trim().slice(0,60)}));
await p.screenshot({path:'land_quests.png'});
console.log(JSON.stringify({badge,tap:t,txt,log:log.slice(0,5)},null,1));
await b.close(); srv.close();
