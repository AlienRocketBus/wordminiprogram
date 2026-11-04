import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[];
const ctx = await newCtx(browser,{dsf:1});
await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} });
const page = await ctx.newPage(); attachLogs(page,'home',errs);
await page.goto(base+'/index.html',{waitUntil:'load'});
await sleep(2500);
for(const y of [2400, 2900, 3300]){
  await page.evaluate(y=>window.scrollTo(0,y), y); await sleep(900);
  await page.screenshot({path:OUT+`/shots/probe_home_scroll${y}.png`});
}
const st = await page.evaluate(()=>{
  const q=s=>document.querySelector(s);
  const cs=el=>{const c=getComputedStyle(el); return {bg:c.backgroundColor,bgi:c.backgroundImage.slice(0,120),att:c.backgroundAttachment,color:c.color,ff:c.fontFamily.slice(0,80)};};
  const en=document.querySelector('.island .en, .island-en, .island [class*=en]');
  const islandEls=[...document.querySelector('a.island').querySelectorAll('*')].map(e=>({cls:String(e.className).slice(0,30),ff:getComputedStyle(e).fontFamily.slice(0,60),txt:(e.childNodes[0]&&e.childNodes[0].nodeType===3?e.childNodes[0].textContent:'').trim().slice(0,20)})).filter(x=>x.txt);
  const how=document.querySelector('.how-title');
  return {html:cs(document.documentElement), body:cs(document.body), islandEls, how: how&&cs(how), howStep: q('.how-step')&&cs(q('.how-step'))};
});
console.log(JSON.stringify(st,null,1));
console.log('errs',errs);
await browser.close(); srv.close();
