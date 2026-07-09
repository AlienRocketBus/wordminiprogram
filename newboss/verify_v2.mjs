import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(800);
/* 确认v2覆盖生效: 源码中 fxFalao 应出现两次定义, 运行时函数体应含 v2 关键词 */
const v2ok=await pg.evaluate(()=>({
  falao: window.fxFalao.toString().includes('foils'), 
  bing: window.fxBingwang.toString().includes('Claymore')||window.fxBingwang.toString().includes('drawClaymore'),
  jd: window.fxJuedou.toString().includes('drawFighter'),
  cq: window.fxCangqiong.toString().includes('chest')
}));
console.log('v2覆盖检测:',JSON.stringify(v2ok));
for(const idx of [7,13,14,25]){
  const nm=await pg.evaluate(i=>REG[i].nm,idx);
  await pg.evaluate(i=>{ select(i); },idx);
  await pg.waitForTimeout(500);
  const hp0=await pg.evaluate(()=>HP);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  /* 三个时间点采样亮点(早/中/晚) */
  const lits=[];
  for(const w of [1100,1700,1400]){ await pg.waitForTimeout(w);
    lits.push(await pg.evaluate(()=>{
      const c=document.querySelector('canvas'); if(!c)return -1;
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let lit=0; for(let k=3;k<d.length;k+=89*4){ if(d[k]>8)lit++; } return lit;
    })); }
  await pg.waitForTimeout(3000);
  const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length, hp:HP}));
  const ok=lits.every(l=>l>0)&&end.cv===0&&end.hp<hp0&&errs.length===0;
  console.log((ok?'✅':'❌')+` #${idx+1} ${nm} | 亮点[1.1s/2.8s/4.2s]=${lits.join('/')} | 结束cv:${end.cv} HP:${hp0}→${end.hp}`+(errs.length?' '+errs.join(';'):''));
  errs.length=0;
}
/* 侵入检查: 4个v2在大招高峰 */
for(const idx of [7,13,14,25]){
  await pg.evaluate(i=>{ select(i); },idx);
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  await pg.waitForTimeout(3300);
  const r=await pg.evaluate(()=>{
    const cv=document.querySelector('canvas'); if(!cv)return {none:1};
    const hc=document.getElementById('heroCard').getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const yFrom=Math.ceil((hc.bottom+19)*dpr);
    let lit=0; const h=cv.height-yFrom;
    if(h>2){ const d=cv.getContext('2d').getImageData(0,yFrom,cv.width,h).data;
      for(let k=3;k<d.length;k+=53*4){ if(d[k]>10)lit++; } }
    return {below:lit};
  });
  console.log(`侵入 #${idx+1}: ${r.none?'(已播完)':'底下亮点='+r.below+(r.below===0?' ✅':' ❌')}`);
  await pg.waitForTimeout(3400);
}
console.log('errors:',errs.length||'0 ✅');
await br.close();
