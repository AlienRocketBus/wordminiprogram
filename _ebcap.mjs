import { chromium } from './playwright_loader.mjs';
import fs from 'fs';
const b=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:840}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///mnt/user-data/outputs/流亡之刃_实体武器预览.html');await p.waitForTimeout(200);
await p.evaluate(()=>window.play());
const shots=[[400,'ignite'],[950,'slash1'],[2000,'flurry'],[2780,'charge'],[3050,'bigslash']];let prev=0;
let cc=0;
for(const [ms,nm] of shots){await p.waitForTimeout(ms-prev);prev=ms;
  const r=await p.evaluate(()=>{var cs=document.querySelectorAll('canvas');return {n:cs.length, d:cs.length?cs[cs.length-1].toDataURL('image/png'):null};});
  cc=Math.max(cc,r.n);
  if(r.d)fs.writeFileSync('/home/claude/v846/dev/_ebcv_'+nm+'.png',Buffer.from(r.d.split(',')[1],'base64'));}
await b.close();console.log('ERRS='+errs.length+' 最大canvas数='+cc);
