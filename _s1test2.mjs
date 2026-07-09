import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:760}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8864/island_season1.html');
await p.waitForTimeout(1400);
const res=await p.evaluate(()=>{
  var out=[];
  for(var pr=0;pr<6;pr++){
    localStorage.setItem('season1_prog',String(pr));
    try{ window.startBoss(); }catch(e){ out.push('prog'+pr+' ERR:'+e.message); continue; }
    var nm=(document.getElementById('bossName')||{}).textContent||'?';
    var spr=document.getElementById('bossSprite');
    var img=spr?spr.querySelector('image'):null;
    var href=img?(img.getAttribute('href')||''):'';
    var m=href.match(/bosses\/([a-z0-9_]+)\.png/i); var file=m?m[1]:href.slice(0,20);
    out.push('prog'+pr+' → '+nm+'  ['+file+']');
  }
  return out;
});
// 验证HansenBossAttack对每个boss名都能触发(检查FX命中·不看动画只看是否return早退)
const fxok=await p.evaluate(()=>{
  var names=['暗影先锋·破阵者','武器大师·战争铁砧','星陨武士·流亡之刃','机械主教·组装者','活体行星·古老意志','铸星者·原初匠人'];
  // 建个假layer + hero, 触发看有没有canvas
  window.__hansenFxLayer=window.__hansenFxLayer||(function(){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;pointer-events:none';document.body.appendChild(d);return d;})();
  var r=[];
  names.forEach(function(n){ try{ window.__hansenFxLayer.innerHTML=''; window.HansenBossAttack({name:n},10,90,100); var has=window.__hansenFxLayer.querySelector('canvas')?'✓':'✗'; r.push(n.split('·')[1]+':'+has); }catch(e){ r.push(n.split('·')[1]+':ERR'); } });
  return r;
});
await b.close();
console.log('=== 各进度出的boss ==='); res.forEach(x=>console.log('  '+x));
console.log('=== 各boss特效能否触发(canvas) ==='); console.log('  '+fxok.join('  '));
console.log('报错数:',errs.length); if(errs.length)console.log(errs.slice(0,5).join('\n'));
