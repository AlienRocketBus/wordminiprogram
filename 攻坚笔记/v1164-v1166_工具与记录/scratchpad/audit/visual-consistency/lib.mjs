import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
export const ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/visual-consistency';
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'};
export const reqLog = [];
export async function startServer(){
  const srv = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/index.html';
    if(p==='/VERSION'){ res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'}); res.end('1163'); return; }
    const fp = path.join(ROOT,p);
    if(!fp.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }
    fs.readFile(fp,(e,d)=>{
      if(e){ reqLog.push('404 '+p); res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(d);
    });
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}
export async function launch(){
  return chromium.launch({ args:['--disable-gpu','--no-sandbox'] });
}
export const external = [];
export async function newCtx(browser, opts={}){
  const ctx = await browser.newContext({ viewport:{width:opts.width||390,height:opts.height||844}, deviceScaleFactor: opts.dsf||2, isMobile:true, hasTouch:true, serviceWorkers:'block', locale:'zh-CN' });
  await ctx.route('**/*', (route)=>{
    const u = route.request().url();
    if(u.startsWith('http://127.0.0.1')) return route.continue();
    if(u.startsWith('data:')||u.startsWith('blob:')) return route.continue();
    external.push(u.slice(0,140));
    return route.abort();
  });
  return ctx;
}
export function attachLogs(page, tag, errs){
  page.on('pageerror', e=>errs.push(`[${tag}] PAGE ${String(e.message).slice(0,200)}`));
  page.on('console', m=>{ if(m.type()==='error') errs.push(`[${tag}] CONSOLE ${m.text().slice(0,200)}`); });
  page.on('dialog', async d=>{ errs.push(`[${tag}] DIALOG(${d.type()}) ${d.message().slice(0,200)}`); try{ await d.dismiss(); }catch(e){} });
}
export const sleep = ms=>new Promise(r=>setTimeout(r,ms));
