import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { start } from './server.mjs';
export async function setup(opts={}){
  const {server,port}=await start();
  const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await browser.newContext({viewport:{width:opts.w||390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',locale:'zh-CN'});
  const external=new Set();
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://127.0.0.1:'+port)){return r.continue();}external.add(u.slice(0,120));return r.abort();});
  const base='http://127.0.0.1:'+port+'/';
  return {server,port,browser,ctx,base,external,async close(){await browser.close();server.close();}};
}
export function attach(page,log){
  page.on('dialog',d=>{log.push('DIALOG '+d.type()+': '+d.message().slice(0,200));d.accept().catch(()=>{});});
  page.on('pageerror',e=>log.push('PAGEERR '+String(e.message).slice(0,300)));
  page.on('console',m=>{if(m.type()==='error')log.push('CONSOLE '+m.text().slice(0,300));});
}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
