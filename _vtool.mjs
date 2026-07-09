import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///mnt/user-data/outputs/星海Boss特效调参台.html');
await p.waitForTimeout(400);
const init=await p.evaluate(()=>({hasAttack:typeof window.HansenBossAttack, nBtns:document.querySelectorAll('.bbtn').length, curName:document.getElementById('curname').textContent, imgSet:!!document.getElementById('bossSprite').src}));
// 调大小滑块到1.4, 切到第3个boss(流亡之刃), 放特效
await p.evaluate(()=>{document.getElementById('sz').value='1.4';document.getElementById('sz').dispatchEvent(new Event('input'));document.querySelectorAll('.bbtn')[2].click();});
await p.waitForTimeout(100);
await p.evaluate(()=>window.play());
await p.waitForTimeout(700);
const mid=await p.evaluate(()=>({nCanvas:document.querySelectorAll('#fxlayer canvas').length, override:JSON.stringify(window.__fxOverride), cur:document.getElementById('curname').textContent, hp:document.getElementById('heroHPText').textContent}));
// 切到组装者放一次
await p.evaluate(()=>{document.querySelectorAll('.bbtn')[3].click();window.play();});
await p.waitForTimeout(600);
const mid2=await p.evaluate(()=>({nCanvas:document.querySelectorAll('#fxlayer canvas').length, cur:document.getElementById('curname').textContent}));
await b.close();
console.log('加载:',JSON.stringify(init));
console.log('放特效(流亡之刃·sz1.4):',JSON.stringify(mid));
console.log('切组装者再放:',JSON.stringify(mid2));
console.log('报错数:',errs.length); if(errs.length)console.log(errs.slice(0,5).join('\n'));
