import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
for (const isl of ['island_animal.html']){
  const c=await ctx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
  await p.goto(base+'/'+isl,{waitUntil:'load'}); await p.waitForTimeout(2500);
  const r=await p.evaluate(async()=>{
    const src=String(window.checkAch);
    const isOverride=/reportTotals/.test(src);
    const mentions={clz50:/clz50/.test(src), cpm40:/cpm40/.test(src), clozeS10:/clozeS10/.test(src)};
    // Give stats that should unlock clozeS10 (cloze right>=10) & clz50 & listenS10 & typingS20
    S.stats.clozeRight=60; S.stats.listenRight=15; S.stats.typeCount=25; S.stats.speedBest=250; S.stats.bubbleBest=60;
    localStorage.setItem('sb_best_cpm','45');
    checkAch();
    const ids=['clozeS10','clz50','listenS10','typingS20','speedS200','bubbleS50','cpm40','cpmS30'];
    const st={}; ids.forEach(i=>st[i]=HansenAch.isPending(i)||HansenAch.isClaimed(i));
    // How many achievement ids does the active checkAch even reference?
    const refd=ACHIEVEMENTS.filter(a=>src.indexOf("'"+a.id+"'")>=0).length;
    return {isOverride,mentions,st,refd,total:ACHIEVEMENTS.length};
  });
  out[isl]={...r,log:log.slice(0,8)};
  await c.close();
}
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
