import { chromium } from './playwright_loader.mjs';
const b=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
// ---- season1 选关 ----
const p=await b.newPage({viewport:{width:420,height:760}});const e1=[];p.on('pageerror',e=>e1.push(e.message));
await p.goto('http://localhost:8864/island_season1.html');await p.waitForTimeout(1300);
const s1=await p.evaluate(()=>{
  var out={};
  localStorage.setItem('season1_prog','2'); // 打过2个: 破阵者✓战争铁砧✓, 当前流亡之刃▶, 组装者/古老意志/铸星者🔒
  window.hansenRenderBossPicker();
  var box=document.getElementById('bossContent');
  var h=box?box.innerHTML:'';
  out.has6=['破阵者','战争铁砧','流亡之刃','组装者','古老意志'].map(function(n){return h.indexOf(n)>=0;});
  out.hasGhost=h.indexOf('淘气小幽灵')>=0;
  out.title=(h.match(/已击败 boss \d+\/\d+/)||['?'])[0];
  out.locks=(h.match(/未解锁/g)||[]).length;
  out.zoneImgs=(h.match(/s1_\w+\.png/g)||[]).length;
  out.clickBtns=(h.match(/__hsnZoneFight/g)||[]).length;
  return out;
});
await p.close();
// ---- 主岛(动物)选关: 应仍是20通用卡 ----
const p2=await b.newPage({viewport:{width:420,height:760}});const e2=[];p2.on('pageerror',e=>e2.push(e.message));
await p2.goto('http://localhost:8864/island_animal.html');await p2.waitForTimeout(1300);
const an=await p2.evaluate(()=>{
  if(window.S)window.S.charXP=99999999; // 解锁全部20关看全
  window.hansenRenderBossPicker();
  var h=(document.getElementById('bossContent')||{}).innerHTML||'';
  return {hasGhost:h.indexOf('淘气小幽灵')>=0, title:(h.match(/已击败 boss \d+\/\d+/)||['?'])[0], hasZoneImg:/s1_\w+\.png/.test(h)};
});
await b.close();
console.log('=== season1 选关 ===');
console.log('  显示5小boss[破/战/流/组/古]:', JSON.stringify(s1.has6), ' 出现淘气小幽灵:', s1.hasGhost);
console.log('  标题:', s1.title, ' 锁的关数:', s1.locks, ' 星域立绘图数:', s1.zoneImgs, ' 可点关卡数:', s1.clickBtns);
console.log('=== 主岛(动物)选关 ===');
console.log('  ', JSON.stringify(an));
console.log('报错 season1:', e1.length, ' 动物:', e2.length);
