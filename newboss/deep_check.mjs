import { chromium } from '../playwright_loader.mjs';
const br=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
/* 1) UI完整性: 29格+图片全加载 */
const ui=await pg.evaluate(()=>{
  const cells=document.querySelectorAll('.cell').length;
  const imgs=[...document.querySelectorAll('.cell img')];
  const bad=imgs.filter(im=>!im.complete||im.naturalWidth===0).length;
  const bs=document.getElementById('bossSprite');
  return {cells:cells, badImgs:bad, bossOk:bs.complete&&bs.naturalWidth>0};
});
console.log('UI: 网格数',ui.cells,'坏图',ui.badImgs,'舞台立绘',ui.bossOk?'OK':'FAIL');
/* 2) 答题区侵入检查: 抽4个重特效boss, 高峰时刻检查heroCard底以下像素 */
for(const idx of [1,18,21,28]){
  await pg.evaluate(i=>{ select(i); },idx);
  await pg.waitForTimeout(450);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  await pg.waitForTimeout(3100); /* 大招高峰 */
  const r=await pg.evaluate(()=>{
    const cv=document.querySelector('canvas'); if(!cv)return {cv:0};
    const hc=document.getElementById('heroCard').getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const yFrom=Math.ceil((hc.bottom+19)*dpr);
    const ctx=cv.getContext('2d');
    let lit=0;
    try{ const h=cv.height-yFrom; if(h>2){ const d=ctx.getImageData(0,yFrom,cv.width,h).data;
      for(let k=3;k<d.length;k+=53*4){ if(d[k]>10)lit++; } } }catch(e){ return {err:''+e}; }
    return {cv:1, below:lit};
  });
  console.log(`侵入检查 #${idx+1}: heroCard底+19以下亮点=${r.below===undefined?('cv:'+r.cv):r.below} ${r.below===0?'✅':(r.below===undefined?'(播完无canvas也算过)':'❌侵入!')}`);
  await pg.waitForTimeout(2600);
}
/* 3) 连点保护 */
await pg.evaluate(()=>{ select(4); });
await pg.waitForTimeout(400);
await pg.evaluate(()=>{ const b=document.getElementById('playBtn'); b.click(); b.click(); b.click(); });
await pg.waitForTimeout(1200);
const cvN=await pg.evaluate(()=>document.querySelectorAll('canvas').length);
console.log('连点3次→canvas数:',cvN, cvN===1?'✅单实例':'❌叠加');
await pg.waitForTimeout(4800);
console.log('pageerrors:',errs.length?errs.join(' | '):'0 ✅');
await br.close();
