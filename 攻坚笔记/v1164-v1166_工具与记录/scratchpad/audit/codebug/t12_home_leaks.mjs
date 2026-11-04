import fs from 'node:fs';
import {serve,launch,ctx,attach} from './harness.mjs';
const INSTR=fs.readFileSync('instr.js','utf8');
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
await c.addInitScript(INSTR);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(3500);
const top=async()=>p.evaluate(()=>__snap());
const s0=await top();
const isl=['island_animal.html','island_food.html','island_land1.html','boss_hall.html','land_map.html'];
for(let r=0;r<2;r++) for(const f of isl){ await p.evaluate(f=>openIsland(f),f); await p.waitForTimeout(2600); await p.evaluate(()=>history.back()); await p.waitForTimeout(500); }
const s1=await top();
for(let r=0;r<2;r++) for(const f of isl){ await p.evaluate(f=>openIsland(f),f); await p.waitForTimeout(2600); await p.evaluate(()=>history.back()); await p.waitForTimeout(500); }
const s2=await top();
const diff={}; for(const k of new Set([...Object.keys(s1.listeners),...Object.keys(s2.listeners)])){ const d=(s2.listeners[k]||0)-(s1.listeners[k]||0); if(d) diff[k]=d; }
const hist=await p.evaluate(()=>({len:history.length,state:history.state,wrap:document.getElementById('islandFrameWrap').style.display, loc:location.pathname}));
console.log(JSON.stringify({iv:[s0.intervals,s1.intervals,s2.intervals],growth:diff,hist,errs:[...new Set(log)].slice(0,10)},null,1));
await b.close(); srv.close();
