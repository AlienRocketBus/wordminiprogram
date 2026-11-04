// Skeptic harness (independent of the auditor's lib): static server + phone ctx + touch helpers
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/skeptic-minigames-p1';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export const served = [];
export function startServer(){
  return new Promise(res=>{
    const srv = http.createServer((req,resp)=>{
      const u = new URL(req.url,'http://h');
      let p = decodeURIComponent(u.pathname);
      if(p==='/VERSION'){ resp.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}); resp.end('1163'); return; }
      if(p.endsWith('/')) p+='index.html';
      const fp = path.join(ROOT, path.normalize(p));
      if(!fp.startsWith(ROOT)){ resp.writeHead(403); resp.end(); return; }
      fs.stat(fp,(e,st)=>{
        if(e||!st.isFile()){ served.push({s:404,u:req.url}); resp.writeHead(404,{'Content-Type':'text/plain'}); resp.end('404'); return; }
        resp.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream','Content-Length':st.size});
        fs.createReadStream(fp).pipe(resp);
      });
    });
    srv.listen(0,'127.0.0.1',()=>res({srv,port:srv.address().port}));
  });
}
export const sleep = ms=>new Promise(r=>setTimeout(r,ms));
export async function launch(){ return chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--mute-audio','--disable-gpu']}); }
export async function phoneCtx(browser, port, {w=390,h=844,init=null}={}){
  const ctx = await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',
    userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 MicroMessenger/8.0.47.2560 NetType/WIFI Language/zh_CN'});
  const ext=[];
  await ctx.route('**/*', r=>{ const u=r.request().url(); if(u.startsWith('http://127.0.0.1:'+port)||u.startsWith('data:')||u.startsWith('blob:')) return r.continue(); ext.push(u); return r.abort(); });
  if(init) await ctx.addInitScript(init);
  return {ctx, ext};
}
export function watch(page, ev){
  page.on('pageerror', e=>ev.push({k:'pageerror', t:String(e&&(e.stack||e.message)||e).slice(0,400)}));
  page.on('console', m=>{ if(m.type()==='error') ev.push({k:'console.error', t:m.text().slice(0,300)}); });
  page.on('dialog', d=>{ ev.push({k:'dialog', t:d.message().slice(0,200)}); d.dismiss().catch(()=>{}); });
  page.on('response', r=>{ if(r.status()>=400) ev.push({k:'http'+r.status(), t:r.url()}); });
}
// real finger tap on an element chosen by fn(arg) inside frame fr
export async function tap(page, fr, fn, arg, {scroll=true, force=false}={}){
  const b = await fr.evaluate(async ([src,arg,scroll])=>{
    const el=(0,eval)('('+src+')')(arg); if(!el) return null;
    if(scroll){ el.scrollIntoView({block:'center',behavior:'instant'}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); }
    const r=el.getBoundingClientRect(); const x=r.left+r.width/2,y=r.top+r.height/2; const h=document.elementFromPoint(x,y);
    return {x,y,ok:!!h&&(h===el||el.contains(h)),hit:h?(h.tagName+'#'+h.id+'.'+String(h.className).slice(0,40)):null};
  },[fn.toString(),arg,scroll]);
  if(!b) return {found:false};
  if(!b.ok && !force) return {found:true, ...b, tapped:false};
  let ox=0,oy=0,f=fr; while(f.parentFrame()){ const el=await f.frameElement(); const bb=await el.boundingBox(); ox+=bb.x; oy+=bb.y; f=f.parentFrame(); }
  await page.touchscreen.tap(ox+b.x, oy+b.y);
  return {found:true, ...b, tapped:true};
}
export async function waitIn(fr, fn, arg, timeout=8000){ const t=Date.now(); while(Date.now()-t<timeout){ let v=null; try{ v=await fr.evaluate(fn,arg); }catch(e){} if(v) return v; await sleep(100);} return null; }
// open island from index.html as onboarded user, dismiss welcome with a real tap
export async function openIsland(page, port, key){
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await sleep(1500);
  const sk = await page.$('#__hsOnbSkip'); if(sk){ await sk.tap().catch(()=>{}); await sleep(500); }
  const t = await tap(page, page.mainFrame(), k=>document.querySelector('a[href="island_'+k+'.html"]'), key);
  if(!t.tapped) throw new Error('island card not tappable '+JSON.stringify(t));
  let F=null;
  for(let i=0;i<150;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>document.readyState==='complete' && typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
  if(!F) throw new Error('island frame not found');
  // wait for welcome popup and let its zoom-in animation finish before tapping
  const shown = await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 4000);
  if(shown){ await sleep(1200); const r = await tap(page, F, ()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(600);
    if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))){ await sleep(800); await tap(page, F, ()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(600); }
  }
  return F;
}
export async function tapCard(page, F, re){
  await F.evaluate(()=>{ if(document.querySelector('.screen.active').id!=='homeScreen') showScreen('home'); });
  return tap(page, F, (src)=>{ const rx=new RegExp(src); return [...document.querySelectorAll('#homeScreen .mode-card')].find(e=>rx.test(e.getAttribute('onclick')||'')); }, re.source);
}
