import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:760}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
p.on('dialog',d=>d.accept());  // 自动确认 alert/confirm
await p.goto('http://localhost:8864/island_animal.html');await p.waitForTimeout(1400);
// 1) 函数存在 + 设键(拦截reload)
const r1=await p.evaluate(()=>{
  var out={fns:[typeof window.__hsnUnlockStarSea,typeof window.__hsnJumpS1,typeof window.__hsnUnlockMain], hasOpenPanel:typeof window.openPanel};
  try{ location.reload=function(){}; }catch(e){}
  window.alert=function(){}; window.confirm=function(){return true;};
  // 清一下再测
  for(var i=1;i<=5;i++)localStorage.removeItem('hsn_seasonmap_cleared_'+i);
  window.__hsnUnlockStarSea();
  out.starSea=[1,2,3,4,5].map(function(i){return localStorage.getItem('hsn_seasonmap_cleared_'+i);}).join(',');
  return out;
});
// 2) 面板管理员模式是否含解锁区(若openPanel可调)
const r2=await p.evaluate(()=>{
  try{
    if(typeof window.openPanel!=='function') return 'openPanel不可直接调(内部闭包)';
    // 清掉旧overlay
    var old=document.getElementById('hbafx-ovl'); if(old)old.remove();
    window.openPanel(false); // 管理员模式
    var body=document.querySelector('.hbafx-body');
    if(!body) return '面板未渲染';
    var html=body.innerHTML;
    return {hasUnlockTitle:html.indexOf('解锁全部 Boss 关卡')>=0, hasStarSeaBtn:html.indexOf('__hsnUnlockStarSea')>=0, hasJumpBtns:(html.match(/__hsnJumpS1/g)||[]).length, hasMainBtn:html.indexOf('__hsnUnlockMain')>=0};
  }catch(e){ return 'ERR:'+e.message; }
});
await b.close();
console.log('函数类型[starSea,jump,main]:', JSON.stringify(r1.fns), ' openPanel:', r1.hasOpenPanel);
console.log('解锁星海后 hsn_seasonmap_cleared_1..5 =', r1.starSea);
console.log('面板管理员模式解锁区:', JSON.stringify(r2));
console.log('报错:', errs.length); if(errs.length)console.log(errs.slice(0,4).join('\n'));
