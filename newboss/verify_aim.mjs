import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(800);
await pg.evaluate(()=>{ select(25); });
await pg.waitForTimeout(500);
await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
/* 采样函数: 取(x,y)周围5px内最大RGBA */
const sample=(x,y)=>pg.evaluate(([x,y])=>{
  const cv=document.querySelector('canvas'); if(!cv)return null;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const d=cv.getContext('2d').getImageData(Math.round((x-4)*dpr),Math.round((y-4)*dpr),Math.round(8*dpr),Math.round(8*dpr)).data;
  let r=0,g=0,b=0,a=0;
  for(let k=0;k<d.length;k+=4){ if(d[k+3]>a){a=d[k+3];r=d[k];g=d[k+1];b=d[k+2];} }
  return {r,g,b,a};
},[x,y]);
const pos=await pg.evaluate(()=>{
  const r=document.getElementById('bossSprite').getBoundingClientRect();
  return { chest:{x:r.left+r.width*0.500,y:r.top+r.height*0.365},
           eyeL:{x:r.left+r.width*0.465,y:r.top+r.height*0.138},
           eyeR:{x:r.left+r.width*0.535,y:r.top+r.height*0.138},
           offbeam:{x:r.left+r.width*0.50+40,y:r.top+r.height*0.20} };
});
/* T=800ms 充能阶段 */
await pg.waitForTimeout(800);
const beamOnChestLine=await sample(pos.chest.x,pos.chest.y-30); /* chest正上方30px应有光束 */
const chestCore=await sample(pos.chest.x,pos.chest.y);
const offBeam=await sample(pos.offbeam.x,pos.offbeam.y); /* 光束右侧40px应基本无 */
console.log('充能@0.8s  光束柱(胸口正上方):',JSON.stringify(beamOnChestLine));
console.log('充能@0.8s  胸口能量核:',JSON.stringify(chestCore));
console.log('充能@0.8s  偏离40px处(应弱):',JSON.stringify(offBeam));
/* T=2700ms 热视线阶段 */
await pg.waitForTimeout(1900);
const eL=await sample(pos.eyeL.x,pos.eyeL.y);
const eR=await sample(pos.eyeR.x,pos.eyeR.y);
console.log('热视线@2.7s 左眼:',JSON.stringify(eL));
console.log('热视线@2.7s 右眼:',JSON.stringify(eR));
const beamAligned=beamOnChestLine&&beamOnChestLine.a>60;
const coreLit=chestCore&&chestCore.a>60;
const offWeak=!offBeam||offBeam.a<beamOnChestLine.a*0.6;
const eyesRed=eL&&eL.a>60&&eL.r>eL.b&&eR&&eR.a>60&&eR.r>eR.b;
console.log('判定: 光束对准胸口='+(beamAligned&&coreLit?'✅':'❌')+'  聚焦(旁侧弱)='+(offWeak?'✅':'❌')+'  热视线出自双眼='+(eyesRed?'✅':'❌'));
await pg.waitForTimeout(4000);
await br.close();
