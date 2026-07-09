import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:420,height:760} });
const errs=[];
page.on('pageerror', e=>errs.push('PAGEERR: '+e.message));
await page.goto('http://localhost:8864/_vgprev.html');
await page.waitForTimeout(300);
await page.evaluate(()=>window.__playVG());
const shots=[[360,'a_lock'],[1010,'b_fire1'],[1430,'c_fire2'],[1960,'d_slash'],[2640,'e_charge'],[3070,'f_beam']];
let prev=0;
for(const [ms,name] of shots){
  await page.waitForTimeout(ms-prev); prev=ms;
  const durl=await page.evaluate(()=>{ var cs=document.querySelectorAll('canvas'); var c=cs[cs.length-1]; return c?c.toDataURL('image/png'):null; });
  if(durl){ fs.writeFileSync('/home/claude/v846/dev/_cvgraw_'+name+'.png', Buffer.from(durl.split(',')[1],'base64')); }
  else console.log('no canvas at '+name);
}
await browser.close();
console.log('ERRS='+errs.length); if(errs.length) console.log(errs.slice(0,6).join('\n'));
