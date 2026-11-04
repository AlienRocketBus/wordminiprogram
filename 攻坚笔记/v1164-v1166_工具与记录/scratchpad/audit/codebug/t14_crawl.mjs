import fs from 'node:fs';
import {serve,launch,ctx,attach,ROOT} from './harness.mjs';
const pages=fs.readdirSync(ROOT).filter(f=>/^island_.*\.html$/.test(f)).concat(['index.html','boss_hall.html','land_map.html','season_showcase.html','spelling_bee.html','check.html','_frame.html']);
const {srv,base}=await serve();
const b=await launch();
const res={};
const c=await ctx(b,base,{w:360,h:780});
for(const pg of pages){
  const p=await c.newPage(); const log=[]; attach(p,log); const bad=[];
  p.on('response',r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url().replace(base,'')); });
  await p.goto(base+'/'+pg,{waitUntil:'load'}).catch(e=>log.push('GOTO '+e.message));
  await p.waitForTimeout(2200);
  const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, badTxt:(document.body.innerText.match(/.{0,30}(NaN|undefined|\[object Object\]|Infinity).{0,30}/g)||[]).slice(0,3)})).catch(e=>({err:e.message}));
  res[pg]={errs:[...new Set(log)].slice(0,6),bad:bad.slice(0,6),hscroll:m.sw>m.cw?m.sw+'>'+m.cw:'',badTxt:m.badTxt};
  await p.close();
}
const ext=[...new Set(c._ext.map(u=>u.split('?')[0]))];
fs.writeFileSync('crawl.json',JSON.stringify({res,ext},null,1));
for(const [k,v] of Object.entries(res)){ if(v.errs.length||v.bad.length||v.hscroll||(v.badTxt&&v.badTxt.length)) console.log(k,JSON.stringify(v)); }
console.log('external:',ext);
await b.close(); srv.close();
