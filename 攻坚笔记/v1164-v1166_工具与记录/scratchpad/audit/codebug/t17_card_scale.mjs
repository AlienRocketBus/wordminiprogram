import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(3000);
// skip onboarding if present
await p.evaluate(()=>{ const b=[...document.querySelectorAll('button,a,div')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent); if(b) b.click(); });
await p.waitForTimeout(800);
const sel='a.island[href="island_food.html"]';
await p.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center',behavior:'auto'}),sel);
await p.waitForTimeout(300);
const box=await p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width};},sel);
const hit=await p.evaluate(({x,y,s})=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest(s));},{x:box.x,y:box.y,s:sel});
await p.touchscreen.tap(box.x,box.y);
await p.waitForTimeout(3500);
const opened=await p.evaluate(()=>document.getElementById('islandFrameWrap').style.display);
await p.evaluate(()=>history.back()); await p.waitForTimeout(1500);
const after=await p.evaluate(s=>{const el=document.querySelector(s);const r=el.getBoundingClientRect();return {inlineTransform:el.style.transform, computed:getComputedStyle(el).transform, anim:getComputedStyle(el).animationName, width:r.width};},sel);
// rAF loop check: count style writes to #stars over 1s
const raf=await p.evaluate(()=>new Promise(res=>{ const st=document.getElementById('stars'); let n=0; const mo=new MutationObserver(m=>n+=m.length); mo.observe(st,{attributes:true,attributeFilter:['style']}); setTimeout(()=>{mo.disconnect();res(n);},1000); }));
console.log(JSON.stringify({hit,opened,before:box.w,after,starsStyleMutationsPerSec:raf,log:log.slice(0,5)},null,1));
await b.close(); srv.close();
