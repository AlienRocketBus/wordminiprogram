import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
const ui=await pg.evaluate(()=>({total:REG.length,cells:document.querySelectorAll('.cell').length,
  bad:[...document.querySelectorAll('.cell img')].filter(im=>!im.complete||im.naturalWidth===0).length,
  g3:document.getElementById('grid3').children.length}));
console.log('UI: 注册',ui.total,'格子',ui.cells,'坏图',ui.bad,'第三组',ui.g3);
for(const idx of [29,30,31,32,33]){
  const nm=await pg.evaluate(i=>REG[i].nm,idx);
  await pg.evaluate(i=>{ select(i); },idx); await pg.waitForTimeout(450);
  const hp0=await pg.evaluate(()=>HP);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  const lits=[];
  for(const w of [1000,1300,1400,1100]){ await pg.waitForTimeout(w);
    lits.push(await pg.evaluate(()=>{ const c=document.querySelector('canvas'); if(!c)return -1;
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let lit=0; for(let k=3;k<d.length;k+=89*4){ if(d[k]>8)lit++; } return lit; })); }
  await pg.waitForTimeout(3300);
  const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length,hp:HP}));
  const ok=lits.every(l=>l>0)&&end.cv===0&&end.hp<hp0&&errs.length===0;
  console.log((ok?'✅':'❌')+` #${idx+1} ${nm} 亮点=${lits.join('/')} 结束cv:${end.cv} HP:${hp0}→${end.hp}`+(errs.length?' ERR:'+errs.join(';'):''));
  errs.length=0;
}
/* 侵入抽查: 战争铁砧殉爆 + 古老意志超新星 */
for(const [idx,wait] of [[30,3900],[33,3900]]){
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
  await pg.waitForTimeout(3300);
}
console.log('errors:',errs.length?errs.join('|'):'0 ✅');
await br.close();
