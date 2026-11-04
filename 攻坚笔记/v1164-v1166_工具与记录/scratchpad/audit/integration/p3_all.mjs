import { setup, sleep, log, tapEl } from './lib.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message)); page.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,200)); });
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
const cards = await page.evaluate(()=>[...document.querySelectorAll('a.island')].map(a=>a.getAttribute('href')));
const results=[];
const state = ()=>page.evaluate(()=>{const w=document.getElementById('islandFrameWrap'),f=document.getElementById('islandFrame'),l=document.getElementById('islandLoading');
    let u='',rs='';try{u=f.contentWindow.location.pathname.split('/').pop();rs=f.contentDocument.readyState}catch(e){}
    return {wrap:w.style.display, op:f.style.opacity, u, rs, load:l?getComputedStyle(l).display:'none', hist:history.length, st:history.state&&history.state.hsnIsland, sy:Math.round(scrollY), bodyOv:document.body.style.overflow}});
for(const file of cards){
  const rec={file};
  const sy0 = await page.evaluate((f)=>{ const a=document.querySelector('a.island[href="'+f+'"]'); a.scrollIntoView({block:'center'}); return Math.round(scrollY); }, file);
  await sleep(400);
  const sy1 = await page.evaluate(()=>Math.round(scrollY));
  rec.syBefore=sy1; rec.hist0 = await page.evaluate(()=>history.length);
  const t0=Date.now();
  rec.tap = (await tapEl(page, page, `a.island[href="${file}"]`)).hit;
  let loadingSeen=false, tReveal=null, tInter=null;
  for(let i=0;i<120;i++){
    const s=await state();
    if(s.load==='flex') loadingSeen=true;
    if(!tReveal && s.op==='1' && s.wrap==='block'){ tReveal=Date.now()-t0; rec.revealUrl=s.u; rec.revealRs=s.rs; }
    if(!tInter && s.u===file && (s.rs==='interactive'||s.rs==='complete')) tInter=Date.now()-t0;
    if(tReveal && s.u===file && s.rs==='complete') break;
    await sleep(40);
  }
  rec.tReveal=tReveal; rec.tInteractive=tInter; rec.loadingSeen=loadingSeen;
  const fr = page.frames().find(f=>f.parentFrame()===page.mainFrame() && f.url().endsWith('/'+file));
  await sleep(1200);
  // dismiss welcome
  try{
    const w = await fr.$('#alertModal.show .game-btn.gold');
    if(w){ rec.welcome=true; await tapEl(page, fr, '#alertModal.show .game-btn.gold'); await sleep(500); }
  }catch(e){ rec.welErr=e.message; }
  // modal state
  rec.modalOpen = await fr.evaluate(()=>document.body.classList.contains('modal-open') || [...document.querySelectorAll('.modal-bg.show,.show')].map(e=>e.id||e.className).slice(0,5).join(','));
  // header values
  rec.hdr = await fr.evaluate(()=>({lvl:(document.getElementById('lvl')||{}).textContent, coin:(document.getElementById('coinCount')||{}).textContent, btn: (()=>{const b=document.querySelector('.world-map-btn'); if(!b) return null; const r=b.getBoundingClientRect(); const cs=getComputedStyle(b); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),cs.opacity,cs.pointerEvents, cs.display].join(',');})()}));
  rec.homeHdr = await page.evaluate(()=>{ const q=s=>{const e=document.querySelector(s); return e?e.textContent.trim().slice(0,20):null}; return {coins:q('#coinCount')||q('#hsnCoins')||q('[id*=oin]'), }; });
  // tap home button
  const t1=Date.now();
  const tb = await tapEl(page, fr, '.world-map-btn');
  rec.homeTapHit = tb.hit;
  let tClose=null;
  for(let i=0;i<60;i++){ const s=await state(); if(s.wrap==='none'){ tClose=Date.now()-t1; break;} await sleep(40); }
  rec.tClose=tClose;
  await sleep(500);
  const s2=await state();
  rec.syAfter=s2.sy; rec.hist1=s2.hist; rec.stAfter=s2.st; rec.bodyOv=s2.bodyOv;
  rec.frames = page.frames().length;
  results.push(rec);
  console.log(JSON.stringify(rec));
}
console.log('errors', errs.slice(0,30));
console.log('external', [...external]);
await browser.close(); srv.close();
