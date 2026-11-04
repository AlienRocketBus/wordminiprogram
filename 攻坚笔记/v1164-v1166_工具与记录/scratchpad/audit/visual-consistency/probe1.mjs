import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[];
const ctx = await newCtx(browser);
const page = await ctx.newPage(); attachLogs(page,'home',errs);
await page.goto(base+'/index.html',{waitUntil:'load'});
await sleep(2500);
await page.screenshot({path:OUT+'/shots/01_home_newuser_onboarding.png'});
const info = await page.evaluate(()=>{
  const vis = el=>{const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';};
  const fixed=[...document.querySelectorAll('body *')].filter(el=>{const cs=getComputedStyle(el); return (cs.position==='fixed')&&vis(el)&&+cs.zIndex>10;}).map(el=>({tag:el.tagName,id:el.id,cls:String(el.className).slice(0,60),z:getComputedStyle(el).zIndex,txt:el.innerText.slice(0,80)}));
  const btns=[...document.querySelectorAll('button')].filter(vis).map(b=>b.innerText.trim().slice(0,20)).slice(0,40);
  return {theme:document.body.dataset.theme, fixed, btns, title:document.title};
});
console.log(JSON.stringify(info,null,1));
console.log('errs',errs); console.log('ext',[...new Set(external)].slice(0,20)); console.log('404',reqLog.slice(0,20));
await browser.close(); srv.close();
