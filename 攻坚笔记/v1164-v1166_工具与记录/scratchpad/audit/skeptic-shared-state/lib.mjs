import http from 'http'; import fs from 'fs'; import path from 'path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const M={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon'};
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function setup(opts={}){
  const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/VERSION'){res.writeHead(200,{'content-type':'text/plain'});res.end('1163');return;}if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)){res.writeHead(403);res.end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':M[path.extname(f).toLowerCase()]||'application/octet-stream'});res.end(d);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:opts.w||390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',locale:'zh-CN'});
  const ext=new Set();
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://127.0.0.1:'+port))return r.continue();ext.add(u.slice(0,100));return r.abort();});
  if(opts.init) await ctx.addInitScript(opts.init);
  const base='http://127.0.0.1:'+port+'/';
  return {browser,ctx,base,ext,server,async close(){await browser.close();server.close();}};
}
export function attach(page,log){page.on('dialog',d=>{log.push('DIALOG '+d.message().slice(0,120));d.accept().catch(()=>{});});page.on('pageerror',e=>log.push('PAGEERR '+String(e.message).slice(0,200)));}
export async function bootHome(s,log){const page=await s.ctx.newPage();attach(page,log);await page.goto(s.base+'index.html',{waitUntil:'load'});await sleep(1500);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button,a,div,span')].find(e=>e.textContent.trim()==='跳过'&&e.offsetParent);b&&b.click();});await sleep(500);return page;}
export async function tapSel(page,sel){
  const ok=await page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return false;el.scrollIntoView({block:'center'});return true;},sel);if(!ok)return {hit:false,missing:true};
  await sleep(200);
  const b=await page.evaluate(sel=>{const el=document.querySelector(sel);const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:!!(t&&(t===el||el.contains(t))),top:t&&(t.id||t.className||t.tagName)};},sel);
  if(b.hit) await page.touchscreen.tap(b.x,b.y);return b;}
export async function waitIsland(page,file){let fr;for(let i=0;i<120;i++){await sleep(100);fr=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().includes(file));if(fr){try{if(await fr.evaluate(()=>document.readyState==='complete'&&!!window.S&&typeof addXP==='function'))break;}catch(e){}}}await sleep(600);return fr;}
export async function dismissWelcome(fr){await sleep(500);return fr.evaluate(()=>{const m=document.getElementById('alertModal');const b=m&&[...m.querySelectorAll('button')].find(x=>/开始冒险/.test(x.textContent));if(b&&m.classList.contains('show')){b.click();return true;}return false;});}
export function tree(f,base,d=0){let o='  '.repeat(d)+(f.url().replace(base,'')||'(blank)')+'\n';for(const c of f.childFrames())o+=tree(c,base,d+1);return o;}
