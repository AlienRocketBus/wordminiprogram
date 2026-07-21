import { chromium } from '../playwright_loader.mjs';
const br=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(800);
const ok2=await pg.evaluate(()=>({m:fxMingwang.toString().includes('BuddhaPalm'),a:fxAnubis.toString().includes('drawGate'),d:fxDajisi.toString().includes('drawHeart'),s:fxSuolaris.toString().includes('meteors'),x:fxSphinx.toString().includes('WingedSun')}));
console.log('v4覆盖:',JSON.stringify(ok2));
for(const idx of [1,2,3,17,5]){
  const nm=await pg.evaluate(i=>REG[i].nm,idx);
  await pg.evaluate(i=>{ select(i); },idx); await pg.waitForTimeout(450);
  const hp0=await pg.evaluate(()=>HP);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  const lits=[];
  for(const w of [1000,1300,1400,1100]){ await pg.waitForTimeout(w);
    lits.push(await pg.evaluate(()=>{ const c=document.querySelector('canvas'); if(!c)return -1;
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let lit=0; for(let k=3;k<d.length;k+=89*4){ if(d[k]>8)lit++; } return lit; })); }
  await pg.waitForTimeout(3200);
  const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length,hp:HP}));
  const ok=lits.every(l=>l>0)&&end.cv===0&&end.hp<hp0&&errs.length===0;
  console.log((ok?'✅':'❌')+` #${idx+1} ${nm} 亮点[1/2.3/3.7/4.8s]=${lits.join('/')} 结束cv:${end.cv} HP:${hp0}→${end.hp}`+(errs.length?' ERR:'+errs.join(';'):''));
  errs.length=0;
}
/* 侵入抽查: 明王神掌拍击 + 大祭司冥火 */
for(const [idx,wait] of [[1,3900],[3,3400]]){
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
  await pg.waitForTimeout(3400);
}
console.log('errors:',errs.length?errs.join('|'):'0 ✅');
await br.close();
