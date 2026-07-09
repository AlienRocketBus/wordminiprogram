import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:420,height:760} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///mnt/user-data/outputs/破阵者_实体武器预览.html');
await p.waitForTimeout(1600); // 触发在700ms·此刻在扫射
const info=await p.evaluate(()=>{ var cs=document.querySelectorAll('canvas'); var c=cs[cs.length-1];
  var hp=document.getElementById('heroHPText').textContent; return {canvas:!!c, hp:hp}; });
await b.close();
console.log('canvas存在:'+info.canvas, '| HP:'+info.hp, '| 报错:'+errs.length);
if(errs.length)console.log(errs.slice(0,4).join('\n'));
