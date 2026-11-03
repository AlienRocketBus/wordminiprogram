import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/minigames-p2';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export const reqlog = [];
export function startServer(){
  return new Promise(res=>{
    const srv = http.createServer((req,resp)=>{
      const u = new URL(req.url, 'http://x');
      let p = decodeURIComponent(u.pathname);
      if(p === '/VERSION'){ resp.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}); resp.end('1163'); return; }
      if(p.endsWith('/')) p += 'index.html';
      const fp = path.join(ROOT, path.normalize(p));
      if(!fp.startsWith(ROOT)){ resp.writeHead(403); resp.end(); return; }
      fs.stat(fp,(err,st)=>{
        if(err || !st.isFile()){ reqlog.push({status:404,url:req.url}); resp.writeHead(404,{'Content-Type':'text/plain'}); resp.end('nf'); return; }
        const ext = path.extname(fp).toLowerCase();
        resp.writeHead(200,{'Content-Type': MIME[ext]||'application/octet-stream','Content-Length':st.size});
        fs.createReadStream(fp).pipe(resp);
      });
    });
    srv.listen(0,'127.0.0.1',()=>res({srv, port:srv.address().port}));
  });
}
export async function launch(){
  return chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--disable-gpu','--mute-audio']});
}
export async function newCtx(browser, port, {width=390,height=844, init=null}={}){
  const ctx = await browser.newContext({viewport:{width,height}, deviceScaleFactor:1, isMobile:true, hasTouch:true, serviceWorkers:'block',
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
export function attach(page, events, tag){
  page.on('pageerror', e=>events.push({tag:tag(), kind:'pageerror', text:String(e && (e.stack||e.message)||e).slice(0,600)}));
  page.on('console', m=>{ if(m.type()==='error'||m.type()==='warning'&&/Unhandled|rejection/i.test(m.text())) events.push({tag:tag(), kind:'console.'+m.type(), text:m.text().slice(0,400), loc:(m.location()||{}).url}); });
  page.on('requestfailed', r=>{ const u=r.url(); if(!/^http:\/\/127\.0\.0\.1/.test(u)) return; if(/\.(mp3|m4a|wav)(\?|$)/.test(u) && /ERR_ABORTED/.test((r.failure()||{}).errorText||'')) return; events.push({tag:tag(), kind:'requestfailed', text:u+' '+(r.failure()&&r.failure().errorText)}); });
  page.on('response', r=>{ if(r.status()>=400) events.push({tag:tag(), kind:'http'+r.status(), text:r.url()}); });
  page.on('dialog', d=>{ events.push({tag:tag(), kind:'dialog.'+d.type(), text:d.message().slice(0,300)}); d.dismiss().catch(()=>{}); });
}
export const sleep = ms=>new Promise(r=>setTimeout(r,ms));
// tap an element (in frame) with real touch: scroll into view, verify elementFromPoint
export async function tapEl(page, frame, handle, {label='', force=false}={}){
  await handle.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  await sleep(80);
  const info = await handle.evaluate(e=>{const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,ok:!!hit&&(hit===e||e.contains(hit)), hit: hit?(hit.tagName+'#'+hit.id+'.'+String(hit.className).slice(0,60)):null};});
  let ox=0, oy=0;
  if(frame && frame !== page.mainFrame()){
    const fe = await frame.frameElement();
    const b = await fe.boundingBox();
    ox=b.x; oy=b.y;
  }
  if(!info.ok && !force) return {ok:false, ...info, label};
  await page.touchscreen.tap(ox+info.x, oy+info.y);
  return {ok:true, ...info, label};
}
