import fs from 'node:fs';
import {serve,launch,ctx,attach} from './harness.mjs';
const keys=Object.keys(JSON.parse(fs.readFileSync('keys.json','utf8')));
const variant=process.argv[2]||'bad';
const VAL={bad:'{"x',num:'123',arr:'[1,2]',str:'"zz"',obj:'{"a":1}',neg:'-5',nan:'NaN',big:'1e308'}[variant];
const {srv,base}=await serve();
const b=await launch();
const res={};
for(const pg of ['index.html','island_animal.html','island_land1.html','boss_hall.html','land_map.html','season_showcase.html','spelling_bee.html']){
  const c=await ctx(b,base);
  await c.addInitScript(([keys,VAL])=>{ if(sessionStorage.getItem('__fz'))return; sessionStorage.setItem('__fz','1'); for(const k of keys){ try{localStorage.setItem(k,VAL);}catch(e){} } },[keys,VAL]);
  const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+pg,{waitUntil:'load'}).catch(e=>log.push('GOTO '+e.message));
  await p.waitForTimeout(3500);
  const vis=await p.evaluate(()=>{ const a=document.querySelector('.screen.active'); return {active:a&&a.id, islands:document.querySelectorAll('a.island').length, bodyTxt:document.body.innerText.slice(0,80).replace(/\s+/g,' '), nanShown:/NaN|undefined|Infinity|\[object Object\]/.test(document.body.innerText)} }).catch(e=>({err:e.message}));
  let nanCtx=null;
  if(vis.nanShown){ nanCtx=await p.evaluate(()=>{ const t=document.body.innerText; const m=t.match(/.{0,40}(NaN|undefined|Infinity|\[object Object\]).{0,40}/g); return m&&m.slice(0,5); }); }
  res[pg]={vis,nanCtx,errs:[...new Set(log)].slice(0,12)};
  await c.close();
}
fs.writeFileSync('fuzz_'+variant+'.json',JSON.stringify(res,null,1));
console.log(JSON.stringify(res,null,1).slice(0,6000));
await b.close(); srv.close();
