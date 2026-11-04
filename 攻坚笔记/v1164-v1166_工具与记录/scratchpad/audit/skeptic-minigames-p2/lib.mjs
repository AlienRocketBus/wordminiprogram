import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/skeptic-minigames-p2';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export const served = [];
export function startServer(){
  return new Promise(res=>{
    const srv = http.createServer((req,resp)=>{
      const u = new URL(req.url, 'http://x');
      let p = decodeURIComponent(u.pathname);
      if(p === '/VERSION'){ resp.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}); resp.end('1163'); return; }
      if(p.endsWith('/')) p += 'index.html';
      const fp = path.join(ROOT, path.normalize(p));
      if(!fp.startsWith(ROOT)){ resp.writeHead(403); resp.end(); return; }
      fs.stat(fp,(err,st)=>{
        if(err || !st.isFile()){ served.push({status:404,url:req.url}); resp.writeHead(404,{'Content-Type':'text/plain'}); resp.end('nf'); return; }
        const ext = path.extname(fp).toLowerCase();
        served.push({status:200,url:req.url});
        resp.writeHead(200,{'Content-Type': MIME[ext]||'application/octet-stream','Content-Length':st.size});
        fs.createReadStream(fp).pipe(resp);
      });
    });
    srv.listen(0,'127.0.0.1',()=>res({srv, port:srv.address().port}));
  });
}
export async function launch(){
  return chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
}
export async function newCtx(browser, port, {width=390,height=844, init=null}={}){
  const ctx = await browser.newContext({viewport:{width,height}, deviceScaleFactor:1, isMobile:true, hasTouch:true, serviceWorkers:'block', locale:'zh-CN',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47 NetType/WIFI Language/zh_CN'});
  const ext = [];
  await ctx.route('**/*', route=>{
    const u = route.request().url();
    if(u.startsWith('http://127.0.0.1:'+port)) return route.continue();
    if(u.startsWith('data:')||u.startsWith('blob:')) return route.continue();
    ext.push(u); return route.abort();
  });
  if(init) await ctx.addInitScript(init);
  return {ctx, ext};
}
export function attach(page, events, tagf){
  const tag = ()=> (typeof tagf==='function'? tagf(): (tagf||''));
  page.on('pageerror', e=>events.push({tag:tag(), kind:'pageerror', text:String(e && (e.stack||e.message)||e).slice(0,700)}));
  page.on('console', m=>{ if(m.type()==='error') events.push({tag:tag(), kind:'console.error', text:m.text().slice(0,400)}); });
  page.on('response', r=>{ if(r.status()>=400) events.push({tag:tag(), kind:'http'+r.status(), text:r.url()}); });
  page.on('dialog', d=>{ events.push({tag:tag(), kind:'dialog.'+d.type(), text:d.message().slice(0,300)}); d.accept().catch(()=>{}); });
}
export const sleep = ms=>new Promise(r=>setTimeout(r,ms));
export async function frameOffset(page, frame){
  if(!frame || frame === page.mainFrame()) return {x:0,y:0};
  const fe = await frame.frameElement();
  const b = await fe.boundingBox();
  return {x:b.x, y:b.y};
}
// real touch tap with hit check. sel can be a selector or an ElementHandle
export async function tap(page, frame, target, {force=false, label=''}={}){
  frame = frame || page.mainFrame();
  const h = typeof target==='string' ? await frame.$(target) : target;
  if(!h) return {ok:false, why:'nohandle', label};
  await h.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  await sleep(120);
  const info = await h.evaluate(e=>{const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,ok:!!hit&&(hit===e||e.contains(hit)), hit: hit?(hit.tagName+'#'+hit.id+'.'+String(hit.className).slice(0,60)):null};});
  const off = await frameOffset(page, frame);
  if(!info.ok && !force) return {ok:false, ...info, label};
  await page.touchscreen.tap(off.x+info.x, off.y+info.y);
  return {ok:true, ...info, label};
}
// find element by visible text in frame
export async function byText(frame, sel, re){
  const hs = await frame.$$(sel);
  for(const h of hs){
    const t = await h.evaluate(e=>{const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return (r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none')? (e.innerText||e.textContent||''):'';});
    if(re.test(t)) return h;
  }
  return null;
}
export async function waitFor(fn, {timeout=8000, step=150}={}){
  const t0=Date.now();
  while(Date.now()-t0<timeout){ try{ const v=await fn(); if(v) return v; }catch(e){} await sleep(step); }
  return null;
}
