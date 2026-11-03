// Standalone checks: boss_hall (3 modes), season_showcase, spelling_bee standalone; 390 & 360
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} }); };
const out = {};
async function common(page, W){
  return page.evaluate(()=>{ const de=document.documentElement; const y0=scrollX; scrollTo(200, scrollY); const sx=scrollX; scrollTo(y0, scrollY);
    const broken=[...document.images].filter(i=>i.complete && i.naturalWidth===0 && i.getAttribute('src')).map(i=>i.getAttribute('src')).slice(0,5);
    const offs=[]; document.querySelectorAll('body *').forEach(el=>{ const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden') return; const r=el.getBoundingClientRect(); if(r.width&&r.height&&(r.right>innerWidth+2||r.left<-2) && (el.innerText||'').trim() && el.children.length===0) offs.push((el.innerText||'').trim().slice(0,25)+' ['+Math.round(r.left)+','+Math.round(r.right)+']'); });
    return {scrollW: de.scrollWidth, vw: innerWidth, canScrollX: sx>0, broken, offscreenText: offs.slice(0,8)}; });
}
for(const W of [390, 360]){
  const {ctx} = await newCtx(browser, port, {init: INIT, width:W});
  const page = await ctx.newPage(); const ev=[]; let tag=''; attach(page, ev, ()=>tag);
  const shot = async n=>{ try{ await page.screenshot({path:`${OUT}/shots/pg_${n}_${W}.png`}); }catch(e){} };
  const res = {};
  // ---- boss hall normal
  for(const [name, url] of [['hall_lv','boss_hall.html?v=1163&lv=1&own=1,2,5'], ['hall_season','boss_hall.html?v=1163&season=1&lv=2'], ['hall_land','boss_hall.html?v=1163&land=1&card=L12&lown=L11,L12,L13']]){
    tag=name; const r={};
    await page.goto(`http://127.0.0.1:${port}/${url}`, {waitUntil:'load'}); await sleep(1800);
    r.title = await page.evaluate(()=>{ const t=document.querySelector('.plate,.nameplate,#bname,.bname,h1'); return document.body.innerText.replace(/\s+/g,' ').slice(0,160); });
    r.common = await common(page, W); await shot(name);
    // next/prev
    const n0 = await page.evaluate(()=>document.body.innerText.match(/Lv\.\s*\d+[^\n]{0,14}/)?.[0]||'');
    let t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('bossNext'), null, {scroll:false}); await sleep(900);
    const n1 = await page.evaluate(()=>document.body.innerText.match(/Lv\.\s*\d+[^\n]{0,14}/)?.[0]||'');
    r.next = {tap:t.ok, before:n0, after:n1};
    // zoom
    t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('hallwrap'), null, {scroll:false}); await sleep(900);
    r.zoom = await page.evaluate(()=>document.getElementById('zoom').classList.contains('show'));
    await shot(name+'_zoom');
    // tap the zoomed card center (should it close?) then top-left corner backdrop
    await page.touchscreen.tap(W/2, 422); await sleep(500);
    r.zoomAfterCenterTap = await page.evaluate(()=>document.getElementById('zoom').classList.contains('show'));
    const hitCorner = await page.evaluate(()=>{ const h=document.elementFromPoint(20, 120); return h?(h.id||h.className||h.tagName):null; });
    await page.touchscreen.tap(20, 120); await sleep(500);
    r.zoomAfterCornerTap = {hit:hitCorner, shown: await page.evaluate(()=>document.getElementById('zoom').classList.contains('show'))};
    // view button cycles
    const views=[]; for(let i=0;i<3;i++){ t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('viewBtn'), null, {scroll:false}); await sleep(500); views.push(await page.evaluate(()=>{ const h=document.querySelector('header'); return (h?getComputedStyle(h).display:'?')+'/'+(document.getElementById('viewBtn')?getComputedStyle(document.getElementById('viewBtn')).display:'?'); })); }
    r.views = views;
    // light toggle & swatch
    t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('lightBtn')); await sleep(300);
    r.light = await page.evaluate(()=>document.getElementById('lightBtn').textContent.trim());
    const sw = await page.evaluate(()=>document.querySelectorAll('.sw').length);
    t = await tapIn(page, page.mainFrame(), ()=>document.querySelectorAll('.sw')[3]); await sleep(500);
    r.swatch = {n:sw, tap:t.ok, pref: await page.evaluate(()=>Object.keys(localStorage).filter(k=>/^bs_hall_/.test(k)).map(k=>k+'='+localStorage.getItem(k)))};
    r.events = ev.filter(e=>e.tag===name && !/__rt=/.test(e.text)).slice(0,10);
    res[name]=r;
  }
  // ---- season showcase
  for(const sid of ['S1','S1B3']){
    const name='showcase_'+sid; tag=name; const r={};
    await page.goto(`http://127.0.0.1:${port}/season_showcase.html?v=1163&boss=${sid}`, {waitUntil:'load'}); await sleep(1800);
    r.text = await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,200));
    r.common = await common(page, W); await shot(name);
    let t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('hallwrap'), null, {scroll:false}); await sleep(800);
    r.zoom = await page.evaluate(()=>document.getElementById('zoom').classList.contains('show'));
    const cp = await page.evaluate(()=>{ const c=document.getElementById('closePg'); if(!c) return null; const s=getComputedStyle(c); const b=c.getBoundingClientRect(); return {disp:s.display, vis:s.visibility, x:b.left+b.width/2, y:b.top+b.height/2, hit:(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)||{}).id}; });
    r.closePg = cp; await shot(name+'_zoom');
    if(cp && cp.disp!=='none'){ await page.touchscreen.tap(cp.x, cp.y); await sleep(500); }
    r.zoomClosed = await page.evaluate(()=>!document.getElementById('zoom').classList.contains('show'));
    // toggles (owned/locked/expired)
    r.toggles = await page.evaluate(()=>[...document.querySelectorAll('.toggle button')].map(b=>b.innerText.trim()));
    r.events = ev.filter(e=>e.tag===name && !/__rt=/.test(e.text)).slice(0,10);
    res[name]=r;
  }
  // ---- spelling bee standalone (no island) and ?island=land3 (not embedded)
  for(const [name,url] of [['bee_standalone','spelling_bee.html?v=1163'], ['bee_land3','spelling_bee.html?v=1163&island=land3']]){
    tag=name; const r={};
    await page.goto(`http://127.0.0.1:${port}/${url}`, {waitUntil:'load'}); await sleep(1500);
    r.setup = await page.evaluate(()=>({tip:(document.querySelector('.sec-t .tip')||{}).textContent, sub:(document.querySelector('.sub')||{}).textContent, words:WORDS.length, chips:[...document.querySelectorAll('#diffBox .chip')].map(c=>c.innerText.replace(/\s+/g,' ')), backEls:[...document.querySelectorAll('.sb-back,#backBtn,[onclick*="history.back"],[onclick*="index.html"]')].map(e=>(e.innerText||'').trim().slice(0,16)+'|'+(e.getAttribute('onclick')||'').slice(0,60))}));
    r.common = await common(page, W); await shot(name);
    let t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('startBtn'));
    const on = await waitIn(page.mainFrame(), ()=>document.getElementById('game').classList.contains('on'), null, 4000);
    r.started = !!on;
    if(on){ await sleep(2500); await shot(name+'_game'); r.game = await page.evaluate(()=>({stt:(document.getElementById('sttYou')||{}).textContent, target: typeof target!=='undefined'?target:null, kb: document.querySelectorAll('#kb .key').length}));
      // exit
      await tapIn(page, page.mainFrame(), ()=>document.getElementById('exitBtn')); await sleep(400); await tapIn(page, page.mainFrame(), ()=>document.getElementById('exitYes')); await sleep(600);
      r.backToSetup = await page.evaluate(()=>document.getElementById('setup').classList.contains('on'));
      // sb-back from standalone: where does it go?
      const b = await page.evaluate(()=>{ const e=document.querySelector('.sb-back'); return e?{txt:e.innerText.trim(), oc:e.getAttribute('onclick'), href:e.getAttribute('href'), vis:!!e.offsetParent}:null; });
      r.sbBack = b;
    }
    r.events = ev.filter(e=>e.tag===name && !/__rt=/.test(e.text)).slice(0,10);
    res[name]=r;
  }
  out[W]=res;
  await ctx.close();
}
console.log(JSON.stringify(out,null,1));
await browser.close(); srv.close();
