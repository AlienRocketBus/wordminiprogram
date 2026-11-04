import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_animal.html','island_land1.html']){
  const c=await ctx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await p.waitForTimeout(2500);
  const r=await p.evaluate(async()=>{
    showScreen('settings'); await new Promise(r=>setTimeout(r,600));
    const sc=document.getElementById('settingsScreen');
    const h3=[...sc.querySelectorAll('h3')].map(x=>x.textContent.trim());
    return {slider:!!document.getElementById('ttsVolSlider'), sections:h3, advLevels: typeof window.ADVENTURE_LEVELS};
  });
  out[isl]={...r,log:log.slice(0,8)};
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
