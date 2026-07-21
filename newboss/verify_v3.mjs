import { chromium } from '../playwright_loader.mjs';
const br=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(800);
/* — 阿尔基昂: 眼睛坐标复验 — */
await pg.evaluate(()=>{ select(25); }); await pg.waitForTimeout(500);
await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
await pg.waitForTimeout(2700);
const eye=await pg.evaluate(()=>{
  const r=document.getElementById('bossSprite').getBoundingClientRect();
  const cv=document.querySelector('canvas'); if(!cv)return null;
  const dpr=Math.min(window.devicePixelRatio||1,2), ctx=cv.getContext('2d');
  const S=(x,y)=>{ const d=ctx.getImageData(Math.round((x-4)*dpr),Math.round((y-4)*dpr),Math.round(8*dpr),Math.round(8*dpr)).data;
    let rr=0,gg=0,bb=0,aa=0; for(let k=0;k<d.length;k+=4){ if(d[k+3]>aa){aa=d[k+3];rr=d[k];gg=d[k+1];bb=d[k+2];} } return {r:rr,g:gg,b:bb,a:aa}; };
  return { eL:S(r.left+r.width*0.443,r.top+r.height*0.154), eR:S(r.left+r.width*0.531,r.top+r.height*0.154),
           brow:S(r.left+r.width*0.465,r.top+r.height*0.130), forehead:S(r.left+r.width*0.50,r.top+r.height*0.118) };
});
const eyesOK=eye&&eye.eL.a>60&&eye.eL.r>eye.eL.b&&eye.eR.a>60&&eye.eR.r>eye.eR.b;
const browClear=eye&&eye.brow.a<eye.eL.a*0.55&&eye.forehead.a<eye.eL.a*0.4;
console.log('左眼:',JSON.stringify(eye.eL),' 右眼:',JSON.stringify(eye.eR));
console.log('眉毛处:',JSON.stringify(eye.brow),' 额头处:',JSON.stringify(eye.forehead));
console.log('判定: 热视线出自双眼='+(eyesOK?'✅':'❌')+'  眉毛/额头无起点='+(browClear?'✅':'❌'));
await pg.waitForTimeout(4200);
/* — 索拉里斯 v3 全流程 — */
await pg.evaluate(()=>{ select(17); }); await pg.waitForTimeout(500);
const hp0=await pg.evaluate(()=>HP);
await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
const lits=[];
for(const w of [900,900,1550,900,700]){ await pg.waitForTimeout(w);
  lits.push(await pg.evaluate(()=>{ const c=document.querySelector('canvas'); if(!c)return -1;
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let lit=0; for(let k=3;k<d.length;k+=89*4){ if(d[k]>8)lit++; } return lit; })); }
await pg.waitForTimeout(3300);
const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length,hp:HP}));
console.log('索拉里斯 亮点[0.9/1.8/3.3/4.2/4.9s]='+lits.join('/')+' | 结束cv:'+end.cv+' HP:'+hp0+'→'+end.hp);
console.log('判定: '+(lits.every(l=>l>0)&&end.cv===0&&end.hp<hp0?'✅ 全流程通过':'❌'));
/* 侵入 */
await pg.evaluate(()=>{ select(17); }); await pg.waitForTimeout(400);
await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
await pg.waitForTimeout(3600);
const inv=await pg.evaluate(()=>{ const cv=document.querySelector('canvas'); if(!cv)return {none:1};
  const hc=document.getElementById('heroCard').getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2); const yFrom=Math.ceil((hc.bottom+19)*dpr);
  let lit=0; const h=cv.height-yFrom;
  if(h>2){ const d=cv.getContext('2d').getImageData(0,yFrom,cv.width,h).data;
    for(let k=3;k<d.length;k+=53*4){ if(d[k]>10)lit++; } } return {below:lit}; });
console.log('侵入(SNAP灰烬高峰): '+(inv.none?'(播完)':'底下亮点='+inv.below+(inv.below===0?' ✅':' ❌')));
await pg.waitForTimeout(3600);
console.log('errors:',errs.length?errs.join('|'):'0 ✅');
await br.close();
