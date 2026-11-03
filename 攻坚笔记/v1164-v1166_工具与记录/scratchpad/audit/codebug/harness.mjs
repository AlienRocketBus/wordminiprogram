import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'};
export function serve(){
  return new Promise(res=>{
    const srv=http.createServer((req,resp)=>{
      let u=decodeURIComponent(req.url.split('?')[0]);
      if(u==='/VERSION'){resp.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});resp.end('1163');return;}
      if(u==='/')u='/index.html';
      const p=path.join(ROOT,u);
      if(!p.startsWith(ROOT)){resp.writeHead(403);resp.end();return;}
      fs.readFile(p,(e,b)=>{ if(e){resp.writeHead(404);resp.end('nf');return;}
        resp.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});resp.end(b);});
    });
    srv.listen(0,'127.0.0.1',()=>res({srv,base:'http://127.0.0.1:'+srv.address().port}));
  });
}
export async function launch(){
  const browser=await chromium.launch({args:['--no-sandbox']});
  return browser;
}
export async function ctx(browser,base,opts={}){
  const c=await browser.newContext({viewport:{width:opts.w||390,height:opts.h||844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40'});
  const ext=[];
  await c.route('**/*',r=>{const u=r.request().url(); if(u.startsWith(base)) return r.continue(); ext.push(u); return r.abort();});
  c._ext=ext;
  return c;
}
export function attach(page,log){
  page.on('pageerror',e=>log.push('PAGEERROR '+page.url().split('/').pop()+': '+e.message));
  page.on('console',m=>{ if(m.type()==='error') log.push('CONSOLE '+m.text().slice(0,300)); });
  page.on('dialog',d=>{ log.push('DIALOG '+d.type()+': '+d.message().slice(0,200)); d.dismiss().catch(()=>{}); });
}
