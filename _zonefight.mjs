import { chromium } from './playwright_loader.mjs';
const b=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:760}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8864/island_season1.html');await p.waitForTimeout(1300);
const r=await p.evaluate(()=>{
  localStorage.setItem('season1_prog','3'); // 前沿=组装者(idx3)
  window.__hsnZoneFight(1);  // 点重打第②关战争铁砧(idx1·已通关)
  var nm=(document.getElementById('bossName')||{}).textContent||'?';
  var progAfter=localStorage.getItem('season1_prog'); // 开打阶段不该变
  return {fightBoss:nm, s1Idx:window._s1Idx, progStill:progAfter};
});
await b.close();
console.log('点第②关战争铁砧(前沿是③组装者):打的boss=',r.fightBoss,' _s1Idx=',r.s1Idx,' season1_prog=',r.progStill);
console.log('报错:',errs.length);
