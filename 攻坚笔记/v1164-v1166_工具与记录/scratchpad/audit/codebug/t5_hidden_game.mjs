import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
await c.addInitScript(()=>{
  window.__audioLog=[];
  const op=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){ try{ window.__audioLog.push({t:Date.now(),src:String(this.currentSrc||this.src||'').split('/').pop().slice(0,40)}); }catch(e){} return op.apply(this,arguments); };
  try{ const ss=window.speechSynthesis; if(ss){ const sp=ss.speak.bind(ss); ss.speak=function(u){ window.__audioLog.push({t:Date.now(),tts:u&&u.text}); try{return sp(u);}catch(e){} }; } }catch(e){}
  try{ localStorage.setItem('hansen_onboarding_done','1'); }catch(e){}
});
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(2500);
await p.evaluate(()=>openIsland('island_animal.html'));
await p.waitForTimeout(3500);
const fr=p.frames().find(f=>/island_animal/.test(f.url()));
await fr.evaluate(()=>{ try{ document.querySelectorAll('button').forEach(x=>{ if(/开始冒险/.test(x.textContent)) x.click(); }); }catch(e){} });
await fr.evaluate(()=>{ startMoles(); });
await p.waitForTimeout(800);
const st1=await fr.evaluate(()=>({screen:(document.querySelector('.screen.active')||{}).id, btns:[...document.querySelectorAll('.screen.active button')].map(b=>b.textContent.trim()).slice(0,6)}));
// start easy level if there's a level picker
await fr.evaluate(()=>{ try{ startMolesLevel("easy"); }catch(e){} });
await p.waitForTimeout(1500);
const before=await fr.evaluate(()=>({n:window.__audioLog.length, active:(document.querySelector('.screen.active')||{}).id, timerTxt:(document.getElementById('molesTimer')||document.querySelector('#speedScreen [id*=ime]')||{}).textContent}));
// Press phone back button (top-level history back)
await p.evaluate(()=>history.back());
await p.waitForTimeout(500);
const wrapHidden=await p.evaluate(()=>document.getElementById('islandFrameWrap').style.display);
const n0=await fr.evaluate(()=>window.__audioLog.length);
await p.waitForTimeout(12000);
const after=await fr.evaluate(()=>({n:window.__audioLog.length, last:window.__audioLog.slice(-5), active:(document.querySelector('.screen.active')||{}).id}));
console.log(JSON.stringify({st1,before,wrapHidden,audioAtHide:n0,after,log:log.slice(0,10)},null,1));
await b.close(); srv.close();
