import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[];
const ctx = await newCtx(browser,{dsf:1});
await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} });
const page = await ctx.newPage(); attachLogs(page,'home',errs);
await page.goto(base+'/index.html',{waitUntil:'load'});
await sleep(3000);
await page.screenshot({path:OUT+'/shots/probe_home_full.png', fullPage:true});
const info = await page.evaluate(()=>{
  const vis = el=>{const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';};
  const clickable=[...document.querySelectorAll('a,button,[onclick],.util-card,.island-card,[role=button]')].filter(vis).map(el=>{const r=el.getBoundingClientRect(); return {tag:el.tagName,id:el.id,cls:String(el.className).slice(0,50),y:Math.round(r.top+scrollY),h:Math.round(r.height),w:Math.round(r.width),href:el.getAttribute('href'),txt:el.innerText.replace(/\s+/g,' ').trim().slice(0,40)};});
  return {h:document.documentElement.scrollHeight, clickable};
});
console.log(info.h); info.clickable.forEach(c=>console.log(JSON.stringify(c)));
console.log('errs',errs); console.log('ext',[...new Set(external)].slice(0,20)); console.log('404',reqLog.slice(0,20));
await browser.close(); srv.close();
