import {serve,launch,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for(const day of ['2026-10-25T12:00:00+08:00','2026-12-05T12:00:00+08:00']){
  const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Shanghai'});
  await c.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const p=await c.newPage(); const log=[]; attach(p,log);
  await p.clock.setFixedTime(new Date(day));
  await p.addInitScript(()=>{ if(sessionStorage.getItem('__s'))return; sessionStorage.setItem('__s','1');
    ['2025-1-5','2026-9-1','2026-11-20','2026-11-28','2026-10-18'].forEach(d=>localStorage.setItem('hansen_snapshot_'+d,JSON.stringify({date:d,power:1,xp:1,streak:0,learned:0}))); });
  await p.goto(base+'/island_animal.html',{waitUntil:'load'}); await p.waitForTimeout(3000);
  out[day]=await p.evaluate(()=>{ const ks=Object.keys(localStorage).filter(k=>k.startsWith('hansen_snapshot_')).sort(); const d=new Date(); const today=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
     return {today, remaining:ks, todaySnapKept: ks.includes('hansen_snapshot_'+today), compare: window.HansenAddiction&&HansenAddiction.getCompareData()?'has compare':'NO compare'}; });
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
