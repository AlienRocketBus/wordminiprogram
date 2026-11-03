import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
const out={};
const c=await newCtx(b,base); const p=await c.newPage(); const log=[]; attach(p,log);
await p.goto(base+'/island_animal.html',{waitUntil:'load'}); await sleep(4000);
out.liveCheck = await p.evaluate(()=>{ const s=String(window.checkAch); return {hasReportTotals:s.includes('reportTotals'), hasV1020:s.includes('v1020')||s.includes('clozeS10'), len:s.length, ids:(s.match(/unlockAch\('([A-Za-z0-9_]+)'\)/g)||[]).length, totalAch:(window.ACHIEVEMENTS||[]).length}; });
out.round1 = await p.evaluate(async ()=>{
  S.stats.clozeRight=60; S.stats.listenRight=15; S.stats.typeCount=25; S.stats.speedBest=250; S.stats.bubbleBest=60; S.stats.daysPlayed=5; S.stats.matchPerfect=6; S.stats.chestClaimed=6;
  localStorage.setItem('sb_best_cpm','45');
  save();
  checkAch();
  try{ bumpGameCount('cloze'); }catch(e){}
  await new Promise(r=>setTimeout(r,500));
  const ids=['clozeS10','clz50','listenS10','typingS20','speedS200','bubbleS50','cpm40','cpmS30','dayNS3','matchpS5','chestS5','perfMatch'];
  return {state:Object.fromEntries(ids.map(id=>[id, HansenAch.isPending(id)||HansenAch.isClaimed(id)])), pending:HansenAch.pendingCount(), pendingIds:HansenAch.getPending()};
});
// control: an id handled by the override (w1 via learned). learn a word
out.control = await p.evaluate(async ()=>{
  try{ learnWord(0); }catch(e){ return {err:String(e)}; }
  await new Promise(r=>setTimeout(r,800));
  try{ checkAch(); }catch(e){}
  return {w1:HansenAch.isPending('w1')||HansenAch.isClaimed('w1'), mode1:HansenAch.isPending('mode1'), pendingIds:HansenAch.getPending()};
});
// reload and re-check (stats persisted)
await p.reload({waitUntil:'load'}); await sleep(4000);
out.afterReload = await p.evaluate(async ()=>{
  const st={clozeRight:S.stats.clozeRight,listenRight:S.stats.listenRight,typeCount:S.stats.typeCount,speedBest:S.stats.speedBest};
  checkAch();
  await new Promise(r=>setTimeout(r,500));
  const ids=['clozeS10','clz50','listenS10','typingS20','speedS200','bubbleS50','cpm40','cpmS30','dayNS3','matchpS5','chestS5','perfMatch'];
  return {st, state:Object.fromEntries(ids.map(id=>[id, HansenAch.isPending(id)||HansenAch.isClaimed(id)])), pendingIds:HansenAch.getPending()};
});
// Does any other path unlock perfMatch? matchComplete with 0 mistakes calls unlockAch('match0') directly; check what ids exist in ACHIEVEMENTS that are directly unlocked
out.errors=log.slice(0,8);
console.log(JSON.stringify(out,null,1));
await c.close(); await b.close(); srv.close();
