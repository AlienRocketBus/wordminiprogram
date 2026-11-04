import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_animal.html','island_land1.html']){
  const c=await ctx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await p.waitForTimeout(2500);
  const r=await p.evaluate(async()=>{
    // unlock a 复习-category achievement (pending, claimable)
    const rv=ACHIEVEMENTS.find(a=>a.cat==='复习'); const sp=ACHIEVEMENTS.find(a=>a.cat==='对决');
    HansenAch.unlock(rv.id); HansenAch.unlock(sp.id);
    window._achOpen={}; ['背单词','复习','精通','速度','打Boss','对决','游戏模式','连胜','里程碑','签到','卡牌收藏','宠物','隐藏'].forEach(k=>window._achOpen[k]=true);
    showScreen('ach'); await new Promise(r=>setTimeout(r,400));
    const L=document.getElementById('achList');
    const bars=[...L.querySelectorAll('.ach-bar .ach-bar-name')].map(x=>x.textContent.trim());
    const shownIds=ACHIEVEMENTS.filter(a=>L.innerHTML.indexOf(a.name)>=0).length;
    return {total:ACHIEVEMENTS.length, bars, tip:(L.querySelector('.ach-pending-tip')||{}).textContent||'', rvShown:L.innerHTML.indexOf(rv.name)>=0, spShown:L.innerHTML.indexOf(sp.name)>=0, rvName:rv.name, header:document.getElementById('achTotal').textContent};
  });
  out[isl]={...r,log:log.slice(0,8)};
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
