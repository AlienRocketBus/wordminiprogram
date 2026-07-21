import { chromium } from '../playwright_loader.mjs';
const br=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
const ok2=await pg.evaluate(()=>({liu:fxLiuwang.toString().includes('drawSwingArc'),tie:fxTiezhan.toString().includes('phase'),zu:fxZuzhuang.toString().includes('drawGear'),gu:fxGuyi.toString().includes('embers')}));
console.log('v6覆盖:',JSON.stringify(ok2));
for(const idx of [31,30,32,33]){
  const nm=await pg.evaluate(i=>REG[i].nm,idx);
  await pg.evaluate(i=>{ select(i); },idx); await pg.waitForTimeout(450);
  const hp0=await pg.evaluate(()=>HP);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  const lits=[];
  for(const w of [900,1100,1400,1300]){ await pg.waitForTimeout(w);
    lits.push(await pg.evaluate(()=>{ const c=document.querySelector('canvas'); if(!c)return -1;
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let lit=0; for(let k=3;k<d.length;k+=89*4){ if(d[k]>8)lit++; } return lit; })); }
  await pg.waitForTimeout(3600);
  const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length,hp:HP}));
  const litOk=lits.filter(l=>l>0).length>=3&&lits[0]>0;
  const ok=litOk&&end.cv===0&&end.hp<hp0&&errs.length===0;
  console.log((ok?'✅':'❌')+` #${idx+1} ${nm} 亮点[0.9/2/3.4/4.7s]=${lits.join('/')} 结束cv:${end.cv} HP:${hp0}→${end.hp}`+(errs.length?' ERR:'+errs.join(';'):''));
  errs.length=0;
}
/* 侵入抽查: 流亡之刃下劈 + 古老意志超新星 */
for(const [idx,wait] of [[31,3700],[33,4100]]){
  await pg.evaluate(i=>{ select(i); },idx); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  await pg.waitForTimeout(wait);
  const inv=await pg.evaluate(()=>{ const cv=document.querySelector('canvas'); if(!cv)return {none:1};
    const hc=document.getElementById('heroCard').getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2); const yFrom=Math.ceil((hc.bottom+19)*dpr);
    let lit=0; const h=cv.height-yFrom;
    if(h>2){ const d=cv.getContext('2d').getImageData(0,yFrom,cv.width,h).data;
      for(let k=3;k<d.length;k+=53*4){ if(d[k]>10)lit++; } } return {below:lit}; });
  console.log(`侵入 #${idx+1}: `+(inv.none?'(播完)':inv.below+(inv.below===0?' ✅':' ❌')));
  await pg.waitForTimeout(3800);
}
console.log('errors:',errs.length?errs.join('|'):'0 ✅');
await br.close();
