import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await newCtx(b,base); 
await c.addInitScript(()=>{
  const T0=Date.now();
  const log=(k,v)=>{ try{ const top=window.top; (top.__alog=top.__alog||[]).push({t:Date.now(),f:location.pathname.split('/').pop(),k,v:String(v).slice(-40)}); }catch(e){} };
  const op=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){ log('play', this.currentSrc||this.src); try{ return op.apply(this,arguments);}catch(e){ return Promise.resolve(); } };
  try{ const os=speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak=function(u){ log('tts', u&&u.text); try{ return os(u);}catch(e){} }; }catch(e){}
});
const p=await c.newPage(); const log=[]; attach(p,log);
async function tapTop(sel){
  const r=await p.evaluate(async s=>{const e=typeof s==='string'?document.querySelector(s):null; if(!e) return null; e.scrollIntoView({block:'center',behavior:'auto'}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const t=document.elementFromPoint(x,y); return {x,y,ok:!!(t&&(t===e||e.contains(t))),top:t&&(t.id||String(t.className).slice(0,30))};},sel);
  if(r&&r.ok) await p.touchscreen.tap(r.x,r.y); return r;
}
async function tapFrame(fr,sel){
  await fr.evaluate(s=>{const e=document.querySelector(s); e&&e.scrollIntoView({block:'center',behavior:'auto'});},sel); await sleep(300);
  const r=await fr.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); const x=b.left+b.width/2,y=b.top+b.height/2; const t=document.elementFromPoint(x,y); return {x,y,ok:!!(t&&(t===e||e.contains(t))),top:t&&(t.id||String(t.className).slice(0,30))};},sel);
  if(r&&r.ok){ const off=await p.evaluate(()=>{const b=document.getElementById('islandFrame').getBoundingClientRect(); return {x:b.left,y:b.top};}); await p.touchscreen.tap(r.x+off.x,r.y+off.y); }
  return r;
}
await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.id='__skip'; });
const skip=await tapTop('#__skip'); await sleep(800);
await p.evaluate(()=>{ const a=document.querySelector('a.island[href="island_animal.html"]'); if(a) a.id='__animal'; });
const cardTap=await tapTop('#__animal'); await sleep(5000);
const fr=p.frames().find(f=>f.url().includes('island_animal.html'));
await fr.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent)&&x.offsetParent); if(b) b.id='__welc'; });
const welc=await tapFrame(fr,'#__welc'); await sleep(700);
await fr.evaluate(()=>{ const m=[...document.querySelectorAll('#homeScreen .mode-card')].find(x=>/startMoles\(\)/.test(x.getAttribute('onclick')||'')); if(m) m.id='__moles'; });
const molesTap=await tapFrame(fr,'#__moles'); await sleep(800);
await fr.evaluate(()=>{ const d=[...document.querySelectorAll('#molesContent div[onclick]')].find(x=>/startMolesLevel\('easy'\)/.test(x.getAttribute('onclick'))); if(d) d.id='__easy'; });
const easyTap=await tapFrame(fr,'#__easy'); await sleep(3000);
const st1=await fr.evaluate(()=>({active:document.querySelector('.screen.active').id, molesActive}));
const histLen=await p.evaluate(()=>({len:history.length,state:JSON.stringify(history.state)}));
const n0=await p.evaluate(()=>(window.__alog||[]).length);
// phone back = top-level history back
await p.goBack().catch(()=>{}); await sleep(500);
const tBack=Date.now();
const st2=await p.evaluate(()=>({wrap:getComputedStyle(document.getElementById('islandFrameWrap')).display, state:JSON.stringify(history.state)}));
await sleep(12000);
const st3=await fr.evaluate(()=>({active:document.querySelector('.screen.active').id, molesActive, molesScore, prog:(document.getElementById('molesProg')||{}).textContent, lives:(document.getElementById('molesLivesDisp')||{}).textContent, vis:document.visibilityState}));
const alog=await p.evaluate(()=>window.__alog||[]);
const afterBack=alog.filter(x=>x.t>=tBack).map(x=>({dt:x.t-tBack,f:x.f,k:x.k,v:x.v}));
console.log(JSON.stringify({skip,cardTap,welc,molesTap,easyTap,st1,histLen,beforeBackCount:n0,st2,st3,afterBack,errors:log.slice(0,5)},null,1));
await c.close(); await b.close(); srv.close();
