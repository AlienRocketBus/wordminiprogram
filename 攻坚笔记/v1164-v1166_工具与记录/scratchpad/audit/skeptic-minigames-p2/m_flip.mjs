import fs from 'node:fs';
import { startServer, launch, newCtx, sleep, tap, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome } from './nav.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const R={samples:[]};
try{
  const {ctx} = await newCtx(browser, port, {width:390});
  const page = await ctx.newPage();
  await homeReady(page, port);
  const card = await page.$('a[href="island_time.html"]');
  await tap(page, page.mainFrame(), card);
  const F = await getFrame(page, /\/island_time\.html/, ()=>typeof allW!=='undefined', 20000);
  const t0 = Date.now();
  await sleep(1200); await closeWelcome(page, F);
  for(const at of [2500, 6000, 12000, 20000]){
    while(Date.now()-t0 < at) await sleep(100);
    await F.evaluate(()=>{ try{ showScreen('home'); }catch(e){} }); await sleep(250);
    const nav = await F.$('#navCards'); await tap(page, F, nav, {force:true}); await sleep(900);
    const s = await F.evaluate(()=>({hdr:(document.getElementById('cardsScreen').innerText.match(/已收集\s*\d+\s*\/\s*20/)||[''])[0], hall:((document.querySelector('[onclick*="__hsnOpenHall"]')||{}).innerText||'').match(/已收藏\s*\d+\/\d+/)?.[0], trial: !!(window.HansenFreepass&&HansenFreepass.active()), key: localStorage.getItem('hansen_card_temp_unlock_until')?'set':'missing'}));
    s.t = Math.round((Date.now()-t0)/1000)+'s';
    R.samples.push(s); console.log(JSON.stringify(s));
  }
}finally{ fs.writeFileSync(`${OUT}/m_flip.json`, JSON.stringify(R,null,1)); await browser.close(); srv.close(); }
