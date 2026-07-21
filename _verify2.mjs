import { chromium } from './playwright_loader.mjs';
const b=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
// ---- season1: 6关顺序 ----
const p=await b.newPage({viewport:{width:420,height:760}});const e1=[];p.on('pageerror',e=>e1.push(e.message));
await p.goto('http://localhost:8864/island_season1.html');await p.waitForTimeout(1300);
const s1=await p.evaluate(()=>{var o=[];for(var pr=0;pr<6;pr++){localStorage.setItem('season1_prog',String(pr));try{window.startBoss();}catch(e){o.push('p'+pr+' ERR:'+e.message);continue;}var nm=(document.getElementById('bossName')||{}).textContent||'?';var im=(document.getElementById('bossSprite')||{}).querySelector?document.getElementById('bossSprite').querySelector('image'):null;var hf=im?(im.getAttribute('href')||''):'';var m=hf.match(/bosses\/([a-z0-9_]+)\.png/i);o.push('p'+pr+'→'+nm+' ['+(m?m[1]:'?')+']');}return o;});
await p.close();
// ---- 主岛(动物): boss选择走S.level, 不受影响 ----
const p2=await b.newPage({viewport:{width:420,height:760}});const e2=[];p2.on('pageerror',e=>e2.push(e.message));
await p2.goto('http://localhost:8864/island_animal.html');await p2.waitForTimeout(1300);
const an=await p2.evaluate(()=>{try{if(window.S)window.S.level=3;localStorage.setItem('season1_prog','5');/*故意设脏值*/window.startBoss();var nm=(document.getElementById('bossName')||{}).textContent||'?';return {ok:true,boss:nm,note:'S.level=3时(季值脏值应被忽略)'};}catch(e){return{ok:false,err:e.message};}});
await b.close();
console.log('=== season1 六关 ==='); s1.forEach(x=>console.log('  '+x)); console.log('  报错:',e1.length);
console.log('=== 主岛动物 boss(不受season1_prog影响)==='); console.log('  ',JSON.stringify(an),' 报错:',e2.length);
if(e1.length)console.log('S1错:',e1.slice(0,3).join('|'));
if(e2.length)console.log('主岛错:',e2.slice(0,3).join('|'));
