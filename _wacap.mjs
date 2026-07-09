import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:840}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///mnt/user-data/outputs/战争铁砧_实体武器预览.html');
await p.waitForTimeout(200);
await p.evaluate(()=>document.getElementById('btn').click());
const shots=[[770,'gun'],[1870,'missile'],[2320,'saber'],[3060,'overload']];
let prev=0;
for(const [ms,nm] of shots){ await p.waitForTimeout(ms-prev); prev=ms;
  const d=await p.evaluate(()=>{var cs=document.querySelectorAll('canvas');var c=cs[cs.length-1];return c?c.toDataURL('image/png'):null;});
  if(d)fs.writeFileSync('/home/claude/v846/dev/_wacv_'+nm+'.png',Buffer.from(d.split(',')[1],'base64'));
}
await b.close();console.log('ERRS='+errs.length);
