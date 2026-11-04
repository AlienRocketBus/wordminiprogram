import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export const reqLog=[];
export function serve(){
  return new Promise(res=>{
    const srv=http.createServer((req,resp)=>{
      let u=decodeURIComponent(req.url.split('?')[0]);
      if(u==='/VERSION'){resp.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});resp.end('1163');return;}
      if(u==='/')u='/index.html';
      const p=path.normalize(path.join(ROOT,u));
      if(!p.startsWith(ROOT)){resp.writeHead(403);resp.end();return;}
      fs.readFile(p,(e,b)=>{ if(e){reqLog.push('404 '+u);resp.writeHead(404);resp.end('nf');return;}
        reqLog.push('200 '+u);
        resp.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});resp.end(b);});
    });
    srv.listen(0,'127.0.0.1',()=>res({srv,base:'http://127.0.0.1:'+srv.address().port}));
  });
}
export async function launch(){ return chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']}); }
export async function newCtx(browser,base,opts={}){
  const c=await browser.newContext({viewport:{width:opts.w||390,height:opts.h||844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Shanghai',locale:'zh-CN',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40'});
  const ext=[];
  await c.route('**/*',r=>{const u=r.request().url(); if(u.startsWith(base)) return r.continue(); ext.push(u); return r.abort();});
  c._ext=ext;
  return c;
}
export function attach(page,log){
  page.on('pageerror',e=>log.push('PAGEERROR '+(page.url().split('/').pop())+': '+e.message));
  page.on('dialog',d=>{ log.push('DIALOG '+d.type()+': '+d.message().slice(0,200)); d.dismiss().catch(()=>{}); });
}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// real tap helper: scrollIntoView, check elementFromPoint, tap
export async function realTap(frameOrPage, page, selector){
  const info = await frameOrPage.evaluate(async (sel)=>{
    const el = typeof sel==='string' ? document.querySelector(sel) : null;
    if(!el) return {ok:false, why:'no element '+sel};
    el.scrollIntoView({block:'center',behavior:'auto'});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    const hit = document.elementFromPoint(x,y);
    return {ok: !!hit && (hit===el || el.contains(hit)), x, y, hit: hit? (hit.id||hit.className||hit.tagName):null};
  }, selector);
  return info;
}
