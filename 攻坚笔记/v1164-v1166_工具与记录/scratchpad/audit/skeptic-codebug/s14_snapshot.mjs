import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const cases=[
  {now:'2026-10-25T12:00:00+08:00', seed:['2025-1-5','2026-9-1','2026-10-18','2026-10-24','2026-11-20']},
  {now:'2026-11-03T12:00:00+08:00', seed:['2026-10-27','2026-10-20','2026-10-9','2026-9-1']},
  {now:'2026-12-05T12:00:00+08:00', seed:['2026-11-28','2026-11-20','2026-11-6','2026-10-1']},
  {now:'2026-12-15T12:00:00+08:00', seed:['2026-12-8','2026-12-1','2026-11-20']},
];
const out=[];
for(const cs of cases){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.clock.install({time:new Date(cs.now)});
  await c.addInitScript((seed)=>{ if(!sessionStorage.getItem('__s')){ seed.forEach(d=>localStorage.setItem('hansen_snapshot_'+d, JSON.stringify({date:d,power:100,xp:50,streak:1,learned:3}))); sessionStorage.setItem('__s','1'); } }, cs.seed);
  await p.goto(base+'/island_animal.html',{waitUntil:'load'});
  await p.clock.runFor(4000); await sleep(1500);
  const r=await p.evaluate(()=>({keys:Object.keys(localStorage).filter(k=>k.startsWith('hansen_snapshot_')).map(k=>k.slice(16)).sort(), compare:!!(window.HansenAddiction&&HansenAddiction.getCompareData()), today:(()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})()}));
  out.push({now:cs.now, seeded:cs.seed, ...r, errors:log.slice(0,3)});
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
