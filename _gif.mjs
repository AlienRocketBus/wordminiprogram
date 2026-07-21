import { chromium } from './playwright_loader.mjs';
const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:420,height:840}, deviceScaleFactor:1 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///mnt/user-data/outputs/破阵者_实体武器预览.html');
await p.waitForTimeout(200);
const st = await p.$('#stage');
await p.evaluate(()=>window.HansenBossAttack({name:'暗影先锋·破阵者'},20,80,100));
const N=52, gap=72;
for(let k=0;k<N;k++){ await st.screenshot({path:'/home/claude/v846/dev/_gf_'+String(k).padStart(3,'0')+'.png'}); await p.waitForTimeout(gap); }
await b.close();
console.log('frames done ERRS='+errs.length);
