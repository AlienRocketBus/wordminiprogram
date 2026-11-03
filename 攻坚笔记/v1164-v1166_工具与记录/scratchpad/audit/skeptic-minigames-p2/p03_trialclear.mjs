// P2-03: fresh user (72h freepass auto-on) beats the land3 guardian directly -> clear flag vs prog
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, openLandMapFromHome, enterLandFromMap, closeWelcome, activeScreen, getFrame } from './nav.mjs';

const N = +(process.argv[2]||3);
const PICK = +(process.argv[3]||4); // zone index to fight (4 = guardian)
const {srv, port} = await startServer();
const browser = await launch();
const R = {N, PICK, log:[]};
const log = (...a)=>{ const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); R.log.push(s); console.log(s); };
try{
  const {ctx} = await newCtx(browser, port, {width:390});
  const page = await ctx.newPage();
  const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
  await homeReady(page, port);
  const lm = await openLandMapFromHome(page);
  const e = await enterLandFromMap(page, lm.M, N);
  const F = e.F;
  await closeWelcome(page, F);
  R.freepass = await F.evaluate(()=>({until:localStorage.getItem('hansen_freepass_until'), active: !!(window.HansenFreepass&&HansenFreepass.active())}));
  log('freepass', R.freepass);
  tag='bosscard';
  const bc = await F.$('#homeScreen .boss-card');
  log('boss card tap', await tap(page, F, bc));
  await sleep(1200);
  log('screen', await activeScreen(F));
  R.picker = await F.evaluate(()=>(document.getElementById('bossContent')||{}).innerText.replace(/\s+/g,' ').slice(0,400));
  log('picker', R.picker);
  const cell = await F.$(`#bossContent [onclick="window.__hsnZoneFight(${PICK})"]`);
  log('cell tap', await tap(page, F, cell));
  await sleep(1500);
  // answer loop
  tag='fight';
  let q=0;
  for(; q<80; q++){
    const s = await waitFor(()=>F.evaluate(()=>{
      if(typeof bossActive!=='undefined' && !bossActive) return {end:true};
      const o=document.getElementById('bossOpts'); if(!o || o.dataset.done) return null;
      if(window._bossQType==='typing' && document.querySelector('#btsKbd')) return {typing:true, en:(window._bossWord||{}).en};
      const opts=[...o.querySelectorAll('.boss-opt')].filter(e=>e.offsetParent);
      if(opts.length<2) return null;
      return {n:opts.length, ci:window._bossCorrectIdx, qt:window._bossQType, en:(window._bossWord||{}).en};
    }), {timeout:70000, step:250});
    if(!s){ log('no question at q',q); break; }
    if(s.end){ log('fight ended at q', q); break; }
    if(s.typing){
      for(const ch of s.en.toLowerCase().replace(/[^a-z]/g,'')){
        const k = await F.$(`#btsKbd .key[data-k="${ch}"]`);
        if(!k){ log('missing key', ch); break; }
        const box = await k.boundingBox();
        await page.touchscreen.tap(box.x+box.width/2, box.y+box.height/2);
        await sleep(90);
      }
    } else {
      const opts = await F.$$('#bossOpts .boss-opt');
      const vis = [];
      for(const o of opts){ if(await o.evaluate(e=>!!e.offsetParent)) vis.push(o); }
      const r = await tap(page, F, vis[s.ci], {force:true});
      if(!r.ok) log('tap fail', r);
    }
    await sleep(1400);
  }
  await sleep(2500);
  R.endScreen = await F.evaluate(()=>(document.getElementById('bossContent')||{}).innerText.replace(/\s+/g,' ').slice(0,300));
  log('end', R.endScreen);
  R.after = await F.evaluate((N)=>({cleared:localStorage.getItem('hsn_landmap_cleared_'+N), prog:localStorage.getItem('land'+N+'_prog'), freepassActive: !!(window.HansenFreepass&&HansenFreepass.active())}), N);
  log('after', R.after);
  await page.screenshot({path:`${OUT}/shots/p03_victory.png`});
  // dismiss any modal buttons
  for(let k=0;k<6;k++){
    const b = await byText(F, 'button, [onclick]', /^(收下|知道了|好的|确定|继续|太棒了|领取)/);
    if(!b) break; await tap(page, F, b, {force:true}); await sleep(700);
  }
  // back to home screen of the island then world-map button -> land_map
  tag='back';
  await F.evaluate(()=>{ try{ showScreen('home'); }catch(e){} });
  await sleep(500);
  const wm = await F.$('.world-map-btn');
  log('world-map tap', wm ? await tap(page, F, wm, {force:true}) : 'no btn');
  const M2 = await getFrame(page, /\/land_map\.html/, ()=>document.querySelectorAll('.spot').length>=9);
  await sleep(800);
  if(M2){
    R.map = await M2.evaluate((N)=>{ const s=[...document.querySelectorAll('.spot')][N-1]; return {cls:s.className, label:s.getAttribute('aria-label'), sub:s.innerText.replace(/\s+/g,' '), ptext:document.getElementById('ptext').textContent}; }, N);
    const spots = await M2.$$('.spot');
    await tap(page, M2, spots[N-1]);
    await sleep(700);
    R.panel = await M2.evaluate(()=>document.getElementById('pboss').innerText.replace(/\s+/g,' ')+' | '+document.getElementById('pfoot').innerText);
    log('map', R.map); log('panel', R.panel);
    await page.screenshot({path:`${OUT}/shots/p03_map_panel.png`});
  }
  // now simulate trial expiry and look again (does the cleared flag persist?)
  await page.evaluate(()=>{ localStorage.setItem('hansen_freepass_until', String(Date.now()-1000)); localStorage.removeItem('hansen_card_temp_unlock_until'); });
  R.afterExpiry = await page.evaluate((N)=>({cleared:localStorage.getItem('hsn_landmap_cleared_'+N), prog:localStorage.getItem('land'+N+'_prog')}), N);
  log('after expiry', R.afterExpiry);
  R.errors = ev.filter(x=>/pageerror/.test(x.kind)).map(x=>x.tag+': '+x.text.split('\n')[0]);
  log('errors', R.errors);
}finally{
  fs.writeFileSync(`${OUT}/p03_trialclear_land${N}.json`, JSON.stringify(R,null,1));
  await browser.close(); srv.close();
}
