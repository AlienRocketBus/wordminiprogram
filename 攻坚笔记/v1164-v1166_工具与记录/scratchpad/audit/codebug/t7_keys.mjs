import fs from 'node:fs';
import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(3000);
await p.evaluate(()=>openIsland('island_animal.html')); await p.waitForTimeout(4000);
const fr=p.frames().find(f=>/island_animal/.test(f.url()));
await fr.evaluate(async()=>{ try{ document.querySelectorAll('button').forEach(x=>{ if(/开始冒险/.test(x.textContent)) x.click(); }); }catch(e){}
  try{ markAnswer(0,true); markAnswer(1,false);}catch(e){}
  try{ addCoin(5);}catch(e){}
  try{ showScreen('quests'); showScreen('ach'); showScreen('settings'); showScreen('home'); }catch(e){}
  try{ doOpenChest&&doOpenChest(); }catch(e){}
  try{ save(); }catch(e){}
});
await p.waitForTimeout(1500);
await p.evaluate(()=>closeIsland()); await p.waitForTimeout(1000);
for(const pg of ['boss_hall.html','land_map.html','season_showcase.html','island_land1.html','spelling_bee.html']){
  const q=await c.newPage(); attach(q,log); await q.goto(base+'/'+pg,{waitUntil:'load'}); await q.waitForTimeout(2500); await q.close();
}
const keys=await p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k).slice(0,200);}return o;});
fs.writeFileSync('keys.json',JSON.stringify(keys,null,1));
console.log(Object.keys(keys).length,'keys'); console.log(log.slice(0,20).join('\n'));
console.log('external requests:',[...new Set(c._ext.map(u=>u.split('?')[0]))].slice(0,20));
await b.close(); srv.close();
