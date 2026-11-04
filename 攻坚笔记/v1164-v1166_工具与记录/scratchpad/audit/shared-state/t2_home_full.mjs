import {setup,attach,sleep} from './lib.mjs';
const s=await setup();const log=[];
const page=await s.ctx.newPage();attach(page,log);
await page.goto(s.base+'index.html',{waitUntil:'load'});
await sleep(1500);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button,a,div,span')].find(e=>e.textContent.trim()==='跳过'&&e.offsetParent);b&&b.click();});
await sleep(1000);
await page.screenshot({path:'home_full.png',fullPage:true});
// list fixed elements with numbers
const fixed=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const cs=getComputedStyle(e);return (cs.position==='fixed'||cs.position==='sticky')&&e.offsetWidth>0&&e.offsetHeight>0;}).map(e=>({id:e.id,cls:String(e.className).slice(0,60),txt:e.innerText.slice(0,80)})));
console.log(JSON.stringify(fixed,null,1));
console.log(log.join('\n'));
await s.close();
