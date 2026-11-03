// P2-04: land8 boss count on land_map vs island_land8
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, openLandMapFromHome, enterLandFromMap, closeWelcome, activeScreen, getFrame } from './nav.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const R = {};
const INIT = () => { try{ if(!sessionStorage.getItem('__seeded')){ sessionStorage.setItem('__seeded','1');
  localStorage.setItem('hansen_freepass_ver','72'); localStorage.setItem('hansen_freepass_until', String(Date.now()-3600e3));
  localStorage.setItem('land8_prog','4'); } }catch(e){} };
try{
  const {ctx} = await newCtx(browser, port, {width:390, init:INIT});
  const page = await ctx.newPage();
  const ev=[]; attach(page, ev, 'x');
  await homeReady(page, port);
  const lm = await openLandMapFromHome(page);
  const M = lm.M;
  R.spot8 = await M.evaluate(()=>{ const s=[...document.querySelectorAll('.spot')][7]; return {cls:s.className, label:s.getAttribute('aria-label'), text:s.innerText.replace(/\s+/g,' ')}; });
  const spots = await M.$$('.spot');
  await tap(page, M, spots[7]); await sleep(600);
  R.panel8 = await M.evaluate(()=>document.getElementById('pboss').innerText.replace(/\s+/g,' '));
  await page.screenshot({path:`${OUT}/shots/p04_land8_panel.png`});
  const enter = await M.$('#pfoot .pbtn.enter');
  await tap(page, M, enter);
  const F = await getFrame(page, /\/island_land8\.html/, ()=>typeof allW!=='undefined', 20000);
  await sleep(1200);
  await closeWelcome(page, F);
  const bc = await F.$('#homeScreen .boss-card');
  await tap(page, F, bc); await sleep(1200);
  R.picker8 = await F.evaluate(()=>(document.getElementById('bossContent')||{}).innerText.replace(/\s+/g,' ').slice(0,300));
  R.island8Bosses = await F.evaluate(()=>BOSSES.map(b=>b.name));
  await page.screenshot({path:`${OUT}/shots/p04_land8_picker.png`});
  console.log(JSON.stringify(R,null,1));
}finally{
  fs.writeFileSync(`${OUT}/p04_land8.json`, JSON.stringify(R,null,1));
  await browser.close(); srv.close();
}
