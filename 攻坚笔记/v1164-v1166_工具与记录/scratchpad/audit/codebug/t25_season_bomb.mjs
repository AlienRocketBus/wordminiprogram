import {serve,launch,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for(const day of ['2026-11-03T12:00:00+08:00','2026-12-31T23:00:00+08:00','2027-01-01T09:00:00+08:00']){
  const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Shanghai'});
  await c.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const p=await c.newPage(); const log=[]; attach(p,log);
  await p.clock.setFixedTime(new Date(day));
  await p.goto(base+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(3500);
  out[day]=await p.evaluate(()=>{ const t=document.body.innerText; return {current:window.HansenSeason&&HansenSeason.current()?HansenSeason.current().id:null, hasFanwai:/番外/.test(t), snippet:(t.match(/.{0,20}番外.{0,30}/)||[''])[0].replace(/\s+/g,' '), seasonEntries:[...document.querySelectorAll('[id^="hsnSeason"],[id^="__hs_"]')].map(e=>e.id)}; });
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
