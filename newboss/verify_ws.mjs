import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const FROM=parseInt(process.argv[2]||'0'), TO=parseInt(process.argv[3]||'9');
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:430,height:900}});
const errs=[];
pg.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
pg.on('console',m=>{ if(m.type()==='error')errs.push('CONSOLE: '+m.text()); });
await pg.goto('http://localhost:8864/新Boss特效工坊.html',{waitUntil:'load'});
await pg.waitForTimeout(800);
const total=await pg.evaluate(()=>REG.length);
console.log('boss总数:',total,' 验证区间:',FROM,'~',TO);
let pass=0, fail=0;
for(let i=FROM;i<=TO&&i<total;i++){
  const nm=await pg.evaluate(idx=>REG[idx].nm,i);
  await pg.evaluate(idx=>{ select(idx); },i);
  await pg.waitForTimeout(500);
  const hp0=await pg.evaluate(()=>HP);
  await pg.evaluate(()=>{ document.getElementById('playBtn').click(); });
  await pg.waitForTimeout(1300);
  const mid=await pg.evaluate(()=>{
    const cvs=[...document.querySelectorAll('canvas')];
    if(!cvs.length)return {cv:0};
    const c=cvs[0], ctx=c.getContext('2d');
    let lit=0; try{ const d=ctx.getImageData(0,0,c.width,c.height).data;
      for(let k=3;k<d.length;k+=97*4){ if(d[k]>8)lit++; } }catch(e){}
    return {cv:cvs.length, lit:lit};
  });
  await pg.waitForTimeout(4300);
  const end=await pg.evaluate(()=>({cv:document.querySelectorAll('canvas').length, hp:HP}));
  const ok = mid.cv===1 && mid.lit>0 && end.cv===0 && end.hp<hp0 && errs.length===0;
  console.log((ok?'✅':'❌')+` #${i+1} ${nm} | 播放中canvas:${mid.cv} 亮点:${mid.lit} | 结束canvas:${end.cv} HP:${hp0}→${end.hp}` + (errs.length?' ERRS:'+errs.join(';'):''));
  if(ok)pass++; else fail++;
  errs.length=0;
}
console.log(`=== 段完成: ✅${pass} ❌${fail} ===`);
await br.close();
