import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
const ok0=await pg.evaluate(()=>fxLiuwang.toString().includes('drawReplicaSaber'));
console.log('v7覆盖(复刻剑函数):',ok0?'✅':'❌');
await pg.evaluate(()=>{ select(31); }); await pg.waitForTimeout(450);
const hp0=await pg.evaluate(()=>HP);
await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
/* T=700ms idle: 精确采样刃中点/刃尖/柄区/晕外 */
await pg.waitForTimeout(700);
const blade=await pg.evaluate(()=>{
  const cv=document.querySelector('canvas'); if(!cv)return null;
  const stg=document.getElementById('stage').getBoundingClientRect();
  const hc=document.getElementById('heroCard').getBoundingClientRect();
  const hx=hc.left+hc.width/2, hy=hc.top+hc.height/2;
  const sz=1, ax=hx-68*sz, ay=hy-24*sz, ang=-1.3;
  const dpr=Math.min(window.devicePixelRatio||1,2), ctx=cv.getContext('2d');
  const S=(x,y,rad)=>{ const d=ctx.getImageData(Math.round((x-rad)*dpr),Math.round((y-rad)*dpr),Math.round(rad*2*dpr),Math.round(rad*2*dpr)).data;
    let rr=0,gg=0,bb=0,aa=0; for(let k=0;k<d.length;k+=4){ if(d[k+3]>aa){aa=d[k+3];rr=d[k];gg=d[k+1];bb=d[k+2];} } return {r:rr,g:gg,b:bb,a:aa}; };
  const L=54*1.35*sz;
  const tipX=ax+Math.sin(-1.3)*L, tipY=ay-Math.cos(-1.3)*L;
  const midX=ax+Math.sin(-1.3)*L*0.5, midY2=ay-Math.cos(-1.3)*L*0.5;
  const hiltX=ax-Math.sin(-1.3)*14*sz, hiltY=ay+Math.cos(-1.3)*14*sz;
  return { mid:S(midX,midY2,5), tip:S(tipX,tipY,5), hilt:S(hiltX,hiltY,6), far:S(ax+60,ay+50,4) };
});
const midOk=blade&&blade.mid.a>200&&blade.mid.r>200&&blade.mid.b>200;
const tipOk=blade&&blade.tip.a>150;
const hiltOk=blade&&blade.hilt.a>100;
console.log('刃中点(应亮白):',JSON.stringify(blade.mid),midOk?'✅':'❌');
console.log('刃尖:',JSON.stringify(blade.tip),tipOk?'✅':'❌','  柄区:',JSON.stringify(blade.hilt),hiltOk?'✅':'❌');
/* T=1150 斩1挥砍中: 锚点区域高亮计数 */
await pg.waitForTimeout(450);
const swing=await pg.evaluate(()=>{
  const cv=document.querySelector('canvas'); if(!cv)return null;
  const hc=document.getElementById('heroCard').getBoundingClientRect();
  const hx=hc.left+hc.width/2, hy=hc.top+hc.height/2;
  const dpr=Math.min(window.devicePixelRatio||1,2), ctx=cv.getContext('2d');
  const x0=Math.round((hx-64-90)*dpr), y0=Math.round((hy-26-90)*dpr);
  const d=ctx.getImageData(Math.max(0,x0),Math.max(0,y0),Math.round(180*dpr),Math.round(180*dpr)).data;
  let lit=0,bright=0; for(let k=0;k<d.length;k+=4*17){ if(d[k+3]>10)lit++; if(d[k+3]>10&&d[k]>230&&d[k+2]>230)bright++; }
  return {lit,bright};
});
console.log('挥砍区(1.15s) 亮点='+swing.lit+' 白亮='+swing.bright+(swing.lit>60&&swing.bright>4?' ✅ 剑+光弧在挥':' ❌'));
/* 全流程 */
const lits=[];
for(const w of [1000,1400,1300]){ await pg.waitForTimeout(w);
  lits.push(await pg.evaluate(()=>{ const c=document.querySelector('canvas'); if(!c)return -1;
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let lit=0; for(let k=3;k<d.length;k+=89*4){ if(d[k]>8)lit++; } return lit; })); }
await pg.waitForTimeout(3600);
const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length,hp:HP}));
console.log('全流程 亮点[2.2/3.6/4.9s]='+lits.join('/')+' 结束cv:'+end.cv+' HP:'+hp0+'→'+end.hp+' err:'+(errs.length||0));
/* 侵入: 终结下劈(4.25s) */
await pg.evaluate(()=>{ select(31); }); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
await pg.waitForTimeout(4250);
const inv=await pg.evaluate(()=>{ const cv=document.querySelector('canvas'); if(!cv)return {none:1};
  const hc=document.getElementById('heroCard').getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2); const yFrom=Math.ceil((hc.bottom+19)*dpr);
  let lit=0; const h=cv.height-yFrom;
  if(h>2){ const d=cv.getContext('2d').getImageData(0,yFrom,cv.width,h).data;
    for(let k=3;k<d.length;k+=53*4){ if(d[k]>10)lit++; } } return {below:lit}; });
console.log('侵入(终结下劈): '+(inv.none?'(播完)':inv.below+(inv.below===0?' ✅':' ❌')));
await pg.waitForTimeout(3400);
console.log('errors:',errs.length?errs.join('|'):'0 ✅');
await br.close();
