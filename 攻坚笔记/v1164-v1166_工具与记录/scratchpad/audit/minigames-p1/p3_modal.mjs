import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'x');
await page.goto(`http://127.0.0.1:${port}/island_action.html`, {waitUntil:'load'});
await sleep(1200);
await page.evaluate(()=>closeAlert());
await page.evaluate(()=>showScreen('explore'));
await sleep(500);
await page.evaluate(()=>{
  window.__log=[]; const m=document.getElementById('wordModal');
  new MutationObserver(()=>{ window.__log.push({t:Math.round(performance.now()), show:m.classList.contains('show')}); }).observe(m,{attributes:true, attributeFilter:['class']});
  const oc = window.closeModal; window.closeModal=function(){ window.__log.push({t:Math.round(performance.now()), call:'closeModal'}); return oc.apply(this,arguments); };
  const sw = window.showWord; window.showWord=function(i){ window.__log.push({t:Math.round(performance.now()), call:'showWord '+i, stack:new Error().stack.split('\n').slice(1,4).join(' | ')}); return sw.apply(this,arguments); };
  ['touchstart','touchend','click'].forEach(t=>document.addEventListener(t, e=>window.__log.push({t:Math.round(performance.now()), ev:t, target:String(e.target.className||e.target.tagName).slice(0,40) }), true));
});
async function tryClose(delay, how, cardIdx){
  await page.evaluate(()=>{ window.__log.length=0; });
  const b = await page.evaluate((i)=>{ const c=document.querySelectorAll('#exploreContent .exp-card')[i]; c.scrollIntoView({block:'center'}); const r=c.getBoundingClientRect(); return {x:r.left,y:r.top,width:r.width,height:r.height}; }, cardIdx);
  await sleep(100); await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
  await sleep(delay);
  const x = await page.$('#modalInner .close'); const xb = await x.boundingBox();
  const hit = await page.evaluate(([x,y])=>{const h=document.elementFromPoint(x,y);return h.className+' '+h.tagName}, [xb.x+xb.width/2, xb.y+xb.height/2]);
  if(how==='touch') await page.touchscreen.tap(xb.x+xb.width/2, xb.y+xb.height/2); else await page.mouse.click(xb.x+xb.width/2, xb.y+xb.height/2);
  await sleep(700);
  const st = await page.evaluate(()=>({show: document.getElementById('wordModal').classList.contains('show'), log: window.__log}));
  console.log('card',cardIdx,'delay',delay,how,'hit',hit,'stillShown',st.show, JSON.stringify(st.log));
  if(st.show) await page.evaluate(()=>closeModal());
  await sleep(300);
}
async function tapIn(fn, arg){ const b = await page.evaluate(([src,arg])=>{ const el=(0,eval)('('+src+')')(arg); if(!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return {x:r.left+r.width/2,y:r.top+r.height/2, hit:String(h&&h.className)}; }, [fn.toString(), arg]); if(!b) return null; await sleep(60); await page.touchscreen.tap(b.x,b.y); return b; }
await page.evaluate(()=>{ window.__log.length=0; });
console.log('tap card0', await tapIn(()=>document.querySelector('#exploreContent .exp-card')));
await sleep(500);
for(const lab of ['发音','慢速','例句']){ console.log(lab, await tapIn((lab)=>[...document.querySelectorAll('#modalInner button')].find(b=>b.innerText.indexOf(lab)>=0), lab)); await sleep(lab==='例句'?2500:900); }
console.log('learn', await tapIn(()=>[...document.querySelectorAll('#modalInner button')].find(b=>/加入学习/.test(b.innerText))));
await sleep(600);
console.log('state', await page.evaluate(()=>document.getElementById('wordModal').classList.contains('show')));
console.log('card1', await tapIn(()=>document.querySelectorAll('#exploreContent .exp-card')[1]));
await sleep(400);
console.log('shown?', await page.evaluate(()=>({show:document.getElementById('wordModal').classList.contains('show'), word:(document.querySelector('#modalInner .m-word')||{}).textContent})));
console.log('X', await tapIn(()=>document.querySelector('#modalInner .close')));
await sleep(600);
console.log('after X', await page.evaluate(()=>({show:document.getElementById('wordModal').classList.contains('show'), word:(document.querySelector('#modalInner .m-word')||{}).textContent, log:window.__log.slice(-14)})));
console.log(JSON.stringify(ev).slice(0,500));
await browser.close(); srv.close(); process.exit(0);
