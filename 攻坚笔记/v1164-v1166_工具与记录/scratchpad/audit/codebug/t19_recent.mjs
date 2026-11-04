import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(2500);
await p.evaluate(()=>openIsland('island_action.html')); await p.waitForTimeout(4000);
const fr=p.frames().find(f=>/island_action/.test(f.url()));
await fr.evaluate(()=>{ document.querySelectorAll('button').forEach(x=>{ if(/开始冒险/.test(x.textContent)) x.click(); }); });
// kid plays a bit: learn a word
await fr.evaluate(()=>{ try{ markAnswer(0,true); save(); }catch(e){} });
await p.waitForTimeout(9000); // stay in island (warm iframes load in idle)
const frames=p.frames().map(f=>f.url().replace(base,'').split('?')[0]);
await p.evaluate(()=>history.back()); await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{ const ks={}; for(const k of Object.keys(localStorage)) if(/^wordIsland[A-Za-z0-9]+$/.test(k)){ try{ks[k]=JSON.parse(localStorage.getItem(k)).lastSaveTime;}catch(e){} }
  return {recent:document.getElementById('recentNum')&&document.getElementById('recentNum').textContent, lastIslandKey:localStorage.getItem('lastIslandKey'), lastIslandTime:+localStorage.getItem('lastIslandTime'), saves:ks}; });
console.log(JSON.stringify({frames,r},null,1));
await b.close(); srv.close();
