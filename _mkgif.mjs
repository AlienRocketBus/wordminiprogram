import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const file=process.argv[2], N=parseInt(process.argv[3]), gap=parseInt(process.argv[4]);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:840},deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+file);
await p.waitForTimeout(200);
const st=await p.$('#stage');
await p.evaluate(()=>window.play());   // 只触发一次
for(let k=0;k<N;k++){ await st.screenshot({path:'/home/claude/v846/dev/_gf_'+String(k).padStart(3,'0')+'.png'}); await p.waitForTimeout(gap); }
await b.close();
console.log('frames='+N+' ERRS='+errs.length);
