import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:420,height:760} });
const errs=[];
page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
page.on('pageerror', e=>errs.push('PAGEERR: '+e.message));
await page.goto('http://localhost:8864/_vgprev.html');
await page.waitForTimeout(300);
await page.evaluate(()=>window.__playVG());
const shots=[[350,'a_lock'],[1000,'b_fire1'],[1400,'c_fire2'],[1960,'d_slash'],[2620,'e_charge'],[3060,'f_beam']];
let prev=0;
for(const [ms,name] of shots){ await page.waitForTimeout(ms-prev); prev=ms; await page.screenshot({path:'/home/claude/v846/dev/_vg_'+name+'.png'}); }
await browser.close();
console.log('ERRS='+errs.length);
if(errs.length) console.log(errs.slice(0,6).join('\n'));
