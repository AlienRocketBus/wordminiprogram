import { sleep, tapEl } from './lib.mjs';
export const st = (page)=>page.evaluate(()=>{const w=document.getElementById('islandFrameWrap'),f=document.getElementById('islandFrame'),l=document.getElementById('islandLoading');
    let u='',rs='';try{u=f.contentWindow.location.pathname.split('/').pop()+f.contentWindow.location.search;rs=f.contentDocument.readyState}catch(e){}
    return {top:location.pathname.split('/').pop(), wrap:w?w.style.display:'(none)', op:f?f.style.opacity:'', u, rs, load:l?getComputedStyle(l).display:'none', hlen:history.length, hst:JSON.stringify(history.state), sy:Math.round(scrollY)}});
export async function waitFor(page, pred, ms=8000, step=40){ const t0=Date.now(); let s; while(Date.now()-t0<ms){ s=await st(page); if(pred(s)) return {ms:Date.now()-t0, s}; await sleep(step);} return {ms:null, s}; }
export function islandFrame(page, file){ return page.frames().find(f=>f.parentFrame()===page.mainFrame() && f.url().split('?')[0].endsWith('/'+file)); }
export async function openCard(page, file){
  await page.evaluate((f)=>{ const a=document.querySelector('a.island[href="'+f+'"]'); a.scrollIntoView({block:'center'}); }, file);
  await sleep(300);
  const r = await tapEl(page, page, `a.island[href="${file}"]`);
  const w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&s.u===file&&s.rs==='complete', 10000);
  await sleep(800);
  return {tap:r.hit, ...w};
}
export async function dismissWelcome(page, fr){
  try{ const w = await fr.$('#alertModal.show .game-btn.gold'); if(w){ await tapEl(page, fr, '#alertModal.show .game-btn.gold'); await sleep(400); return true;} }catch(e){}
  return false;
}
