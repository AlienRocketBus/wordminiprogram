import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_land1.html','island_land8.html','island_animal.html']){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await sleep(3800);
  await p.evaluate(()=>showScreen('settings')); await sleep(800);
  out[isl]=await p.evaluate(()=>({slider:!!document.getElementById('ttsVolSlider'), h3s:[...document.querySelectorAll('#settingsScreen h3, .screen.active h3')].map(h=>h.textContent.trim()).slice(0,20), ADV:Array.isArray(window.ADVENTURE_LEVELS)?window.ADVENTURE_LEVELS.length:typeof window.ADVENTURE_LEVELS, ttsVolModule: typeof window.HansenTtsVolume}));
  out[isl].errors=log.slice(0,4);
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
