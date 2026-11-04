// Missed-issue probes: (M1) hidden warm island_season consumes the prologue; (M2) who removes the trial temp key; (M3) hidden frame cost
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome } from './nav.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const R = {};
const INIT = () => {
  try{
    const orig = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(k){
      try{ if(k==='hansen_card_temp_unlock_until'){ const st=(new Error().stack||'').split('\n').slice(2,5).map(s=>s.trim().replace(/http:\/\/127\.0\.0\.1:\d+\//g,'')).join(' <- ');
        const log = JSON.parse(orig.call(this,'__x')||'null'); // no-op
        const L = JSON.parse(localStorage.getItem('__rmlog')||'[]'); L.push({t:Date.now(), page:location.pathname.split('/').pop()+location.search, inFrameDepth:(function(){let d=0,w=window;try{while(w!==w.parent){d++;w=w.parent;}}catch(e){}return d;})(), st}); localStorage.setItem('__rmlog', JSON.stringify(L.slice(-30))); } }catch(e){}
      return orig.call(this,k);
    };
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k,v){
      try{ if(k==='hsn_season_prologue_seen'){ const L = JSON.parse(localStorage.getItem('__prolog')||'[]'); L.push({t:Date.now(), page:location.pathname.split('/').pop()+location.search, depth:(function(){let d=0,w=window;try{while(w!==w.parent){d++;w=w.parent;}}catch(e){}return d;})(), hidden: (function(){ try{ return !!(window.frameElement && (getComputedStyle(window.frameElement.parentElement||window.frameElement).display==='none' || window.frameElement.getBoundingClientRect().width<5)); }catch(e){ return null; } })()}); origSet.call(this,'__prolog', JSON.stringify(L)); } }catch(e){}
      return origSet.call(this,k,v);
    };
  }catch(e){}
};
try{
  const {ctx} = await newCtx(browser, port, {width:390, init:INIT});
  const page = await ctx.newPage();
  const ev=[]; attach(page, ev, 'm');
  let bytes=0, reqs=0; const perFrame={};
  page.on('requestfinished', async r=>{ try{ reqs++; const f=r.frame(); const k=(f.url().split('/').pop()||'').split('?')[0]; perFrame[k]=(perFrame[k]||0)+1; const s=await r.sizes(); bytes+=s.responseBodySize; }catch(e){} });
  await homeReady(page, port);
  const b0 = {bytes, reqs};
  // real tap on the 时间 island card on home
  const card = await page.$('a[href="island_time.html"]');
  const t = await tap(page, page.mainFrame(), card);
  const F = await getFrame(page, /\/island_time\.html/, ()=>typeof allW!=='undefined', 20000);
  await sleep(1500); await closeWelcome(page, F);
  await sleep(14000);
  R.tapTime = t.ok;
  R.frames = page.frames().map(f=>{ let d=0,p=f.parentFrame(); while(p){d++;p=p.parentFrame();} return d+':'+(f.url().replace(/^http:\/\/127\.0\.0\.1:\d+\//,'')||'(blank)').slice(0,50); });
  R.netAfterIslandOpen = {reqs: reqs-b0.reqs, MB: +((bytes-b0.bytes)/1048576).toFixed(2), perFrame};
  R.prologueSeen = await page.evaluate(()=>localStorage.getItem('hsn_season_prologue_seen'));
  R.prologLog = await page.evaluate(()=>JSON.parse(localStorage.getItem('__prolog')||'[]'));
  R.rmLog = await page.evaluate(()=>JSON.parse(localStorage.getItem('__rmlog')||'[]'));
  R.tempNow = await page.evaluate(()=>localStorage.getItem('hansen_card_temp_unlock_until'));
  try{ const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable'); const m = await cdp.send('Performance.getMetrics'); const g=k=>(m.metrics.find(x=>x.name===k)||{}).value; R.perf = {JSHeapUsedMB:+(g('JSHeapUsedSize')/1048576).toFixed(1), Documents:g('Documents'), Frames:g('Frames'), Nodes:g('Nodes'), JSEventListeners:g('JSEventListeners')}; }catch(e){ R.perfErr=String(e); }
  // now go to the season island the way the app would (in the shell)
  await page.evaluate(()=>openIsland('island_season.html'));
  const S = await getFrame(page, /\/island_season\.html$/, ()=>typeof allW!=='undefined', 20000);
  await sleep(3000);
  R.seasonStoryShown = S ? await S.evaluate(()=>!!document.getElementById('hsnStoryModal')) : 'no season frame';
  await page.screenshot({path:`${OUT}/shots/m_season_after_time.png`});
  console.log(JSON.stringify(R,null,1));
}finally{
  fs.writeFileSync(`${OUT}/m_hidden.json`, JSON.stringify(R,null,1));
  await browser.close(); srv.close();
}
