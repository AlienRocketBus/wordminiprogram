import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_animal.html','island_land1.html']){
  const c=await ctx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await p.waitForTimeout(2500);
  const r=await p.evaluate(async()=>{
    const g=JSON.parse(localStorage.getItem('hansen_global_daily_quests_v941')||'null');
    const badge=document.getElementById('questSub').textContent;
    // dismiss welcome modal if any
    try{ document.querySelectorAll('button').forEach(x=>{ if(/开始冒险/.test(x.textContent)) x.click(); }); }catch(e){}
    showScreen('quests');
    await new Promise(r=>setTimeout(r,500));
    const ql=document.getElementById('questList');
    return {globalLen:g&&g.list&&g.list.length, badgeBefore:badge, badgeAfter:document.getElementById('questSub').textContent,
      cards:ql.querySelectorAll('.quest-card').length, text:ql.innerText.slice(0,120), sQuestsLen:S.quests&&S.quests.list.length};
  });
  out[isl]={...r,log:log.slice(0,8)};
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
