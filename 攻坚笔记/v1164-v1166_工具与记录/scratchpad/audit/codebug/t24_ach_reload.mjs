import {serve,launch,ctx,attach} from './harness.mjs';
const {srv,base}=await serve();
const b=await launch();
const c=await ctx(b,base);
const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/island_animal.html',{waitUntil:'load'}); await p.waitForTimeout(3000);
await p.evaluate(()=>{ S.stats.clozeRight=60; S.stats.listenRight=15; S.stats.typeCount=25; S.stats.speedBest=250; S.stats.bubbleBest=60; S.stats.daysPlayed=5; localStorage.setItem('sb_best_cpm','45'); save(); });
await p.waitForTimeout(500);
await p.reload({waitUntil:'load'}); await p.waitForTimeout(4000);
const r=await p.evaluate(()=>{ const ids=['clozeS10','clz50','listenS10','typingS20','speedS200','bubbleS50','cpm40','cpmS30','dayNS3']; const o={}; ids.forEach(i=>o[i]=HansenAch.isPending(i)||HansenAch.isClaimed(i)); return {o,statsKept:S.stats.clozeRight, pendingCount:HansenAch.pendingCount()}; });
// also play real modes? trigger bumpGameCount which calls checkAch via signals
await p.evaluate(()=>{ try{ bumpGameCount('cloze'); }catch(e){} });
const r2=await p.evaluate(()=>({clozeS10:HansenAch.isPending('clozeS10'), pending:HansenAch.pendingCount()}));
console.log(JSON.stringify({afterReload:r,afterBump:r2,log:log.slice(0,5)},null,1));
await b.close(); srv.close();
