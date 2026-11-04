import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { start, log } from './server.mjs';
export { log };
export async function setup({width=390,height=844,cache, initScript, override}={}){
  const {srv, port} = await start({cache, override});
  const browser = await chromium.launch({args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
  const ctx = await browser.newContext({viewport:{width,height}, deviceScaleFactor:1, isMobile:true, hasTouch:true, serviceWorkers:'block',
    userAgent:'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const external = new Set();
  await ctx.route('**/*', route=>{
    const u = route.request().url();
    if(u.startsWith('http://127.0.0.1:'+port)) return route.continue();
    if(u.startsWith('data:')||u.startsWith('blob:')) return route.continue();
    external.add(u.split('?')[0]); return route.abort();
  });
  if(initScript) await ctx.addInitScript(initScript);
  const base = 'http://127.0.0.1:'+port+'/';
  return {srv, port, browser, ctx, base, external};
}
export const sleep = ms=>new Promise(r=>setTimeout(r,ms));
export async function tapEl(page, frameOrPage, selector){
  // scroll into view, check elementFromPoint, tap via touchscreen (top-level coords)
  const h = await frameOrPage.$(selector);
  if(!h) return {ok:false, why:'nf'};
  await h.evaluate(e=>e.scrollIntoView({block:'center',behavior:'auto'}));
  await frameOrPage.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const box = await h.boundingBox();
  if(!box) return {ok:false, why:'nobox'};
  const x = box.x+box.width/2, y = box.y+box.height/2;
  const hit = await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y); return e? (e.tagName+'#'+e.id+'.'+String(e.className).slice(0,40)):null;},[x,y]);
  await page.touchscreen.tap(x,y);
  return {ok:true, x, y, hit};
}
