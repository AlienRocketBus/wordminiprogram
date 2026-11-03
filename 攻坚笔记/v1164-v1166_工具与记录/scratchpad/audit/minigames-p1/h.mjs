// small helpers for targeted repro scripts
import {sleep} from './lib.mjs';
export async function openIsland(page, port, key){
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await sleep(1200);
  const sk = await page.$('#__hsOnbSkip'); if(sk){ await sk.tap().catch(()=>{}); await sleep(400); }
  await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
  let F=null;
  for(let i=0;i<100;i++){ F = page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>document.readyState!=='loading' && typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
  for(let i=0;i<30;i++){ if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))) break; await sleep(100); }
  if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))){ await sleep(900); await tapIn(page, F, ()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(400); }
  return F;
}
export async function tapIn(page, fr, fn, arg, {scroll=true}={}){
  const b = await fr.evaluate(([src,arg,scroll])=>{ const el=(0,eval)('('+src+')')(arg); if(!el) return null; if(scroll) el.scrollIntoView({block:'center',behavior:'instant'}); const r=el.getBoundingClientRect(); const x=r.left+r.width/2,y=r.top+r.height/2; const h=document.elementFromPoint(x,y); return {x,y, ok: !!h&&(h===el||el.contains(h)), hit:h?(h.tagName+'.'+String(h.className).slice(0,40)):null}; }, [fn.toString(), arg, scroll]);
  if(!b) return {found:false};
  let ox=0, oy=0, f=fr; while(f.parentFrame()){ const el=await f.frameElement(); const bb=await el.boundingBox(); ox+=bb.x; oy+=bb.y; f=f.parentFrame(); }
  await page.touchscreen.tap(ox+b.x, oy+b.y);
  return b;
}
export async function waitIn(fr, fn, arg, timeout=8000){ const t=Date.now(); while(Date.now()-t<timeout){ let v=null; try{ v=await fr.evaluate(fn,arg); }catch(e){} if(v) return v; await sleep(100);} return null; }
