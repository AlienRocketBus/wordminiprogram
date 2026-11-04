import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const out=[];
for (const when of ['2026-11-03T10:00:00+08:00','2026-12-31T23:30:00+08:00','2027-01-01T09:00:00+08:00','2027-03-01T09:00:00+08:00']){
  const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.clock.install({time:new Date(when)});
  await p.goto(base+'/index.html',{waitUntil:'load'});
  await p.clock.runFor(6000);
  await sleep(1500);
  const r=await p.evaluate(()=>({
    bar:!!document.getElementById('hsnSeasonBar'), barText:(document.getElementById('hsnSeasonBar')||{innerText:''}).innerText.replace(/\s+/g,' ').slice(0,60),
    cur: window.HansenSeason&&HansenSeason.current? (HansenSeason.current()||{}).id||null : 'n/a',
    landLinks:[...document.querySelectorAll('a[href*="land"],[onclick*="land_map"],[onclick*="island_land"]')].map(x=>x.outerHTML.slice(0,80)),
    seasonEntry:!!document.getElementById('hsnSeasonEntry'),
    now:new Date().toString().slice(0,33)
  }));
  out.push({when, ...r, errors:log.slice(0,3)});
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
