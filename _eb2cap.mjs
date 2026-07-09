import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:840}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///mnt/user-data/outputs/流亡之刃_真立绘预览.html');await p.waitForTimeout(200);
await p.evaluate(()=>window.play());
const shots=[[500,'ignite'],[1100,'eightway'],[2000,'flurry'],[2750,'iaicharge'],[3050,'iaistrike']];let prev=0,cc=0;
for(const [ms,nm] of shots){await p.waitForTimeout(ms-prev);prev=ms;
  const r=await p.evaluate(()=>{var cs=document.querySelectorAll('canvas');return{n:cs.length,d:cs.length?cs[cs.length-1].toDataURL('image/png'):null};});cc=Math.max(cc,r.n);
  if(r.d)fs.writeFileSync('/home/claude/v846/dev/_eb2_'+nm+'.png',Buffer.from(r.d.split(',')[1],'base64'));}
await b.close();console.log('ERRS='+errs.length+' canvas='+cc);
