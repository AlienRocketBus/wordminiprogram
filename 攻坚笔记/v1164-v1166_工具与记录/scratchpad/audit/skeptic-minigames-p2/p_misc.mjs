// P2-08/09/10/11/12 quick runtime checks
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome, openLandMapFromHome } from './nav.mjs';
const which = (process.argv[2]||'map,hall,flavor,counts,welcome').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const out = {};
const base = `http://127.0.0.1:${port}/`;
try{
  if(which.includes('map')){
    out.map = {};
    for(const [w,h] of [[360,780],[360,800],[360,640],[390,844]]){
      const {ctx} = await newCtx(browser, port, {width:w, height:h});
      const page = await ctx.newPage();
      await page.goto(base+'land_map.html', {waitUntil:'load'}); await sleep(800);
      out.map[w+'x'+h] = await page.evaluate(()=>[...document.querySelectorAll('.spot .name')].map(n=>{const r=n.getBoundingClientRect(); return {t:n.textContent, l:Math.round(r.left), r:Math.round(r.right), clipped: r.left<0||r.right>innerWidth};}).filter(x=>x.clipped));
      if(w===360 && h===800) await page.screenshot({path:`${OUT}/shots/pm_landmap_360x800.png`});
      await page.close(); await ctx.close();
    }
    console.log('map', JSON.stringify(out.map));
  }
  if(which.includes('hall')){
    out.hall = {};
    for(const [w,h] of [[390,844],[360,800]]){
      for(const u of ['boss_hall.html?lv=1&own=1,2,5','season_showcase.html?boss=S1','boss_hall.html?season=1']){
        const {ctx} = await newCtx(browser, port, {width:w, height:h});
        const page = await ctx.newPage();
        await page.goto(base+u, {waitUntil:'load'}); await sleep(1500);
        const m = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, iw:innerWidth, bodyOv:getComputedStyle(document.body).overflowX, htmlOv:getComputedStyle(document.documentElement).overflowX}));
        // try horizontal pan with a touch drag
        await page.evaluate(()=>window.scrollTo(60,0)); await sleep(200);
        m.scrollXafterScrollTo = await page.evaluate(()=>window.scrollX);
        await page.evaluate(()=>window.scrollTo(0,0));
        // real swipe left via CDP touch
        const cdp = await ctx.newCDPSession(page);
        const y = Math.round(h*0.85);
        await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:w-40,y}]});
        for(let i=1;i<=8;i++){ await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:w-40-i*20,y}]}); await sleep(16); }
        await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
        await sleep(500);
        m.scrollXafterSwipe = await page.evaluate(()=>window.scrollX);
        m.vvOffset = await page.evaluate(()=>window.visualViewport?Math.round(window.visualViewport.pageLeft):null);
        out.hall[w+'|'+u] = m;
        if(w===360 && /boss_hall\.html\?lv/.test(u)) await page.screenshot({path:`${OUT}/shots/pm_bosshall_360.png`});
        await page.close(); await ctx.close();
      }
    }
    console.log('hall', JSON.stringify(out.hall,null,1));
  }
  if(which.includes('flavor')){
    const {ctx} = await newCtx(browser, port, {width:390});
    const page = await ctx.newPage(); const ev=[]; attach(page, ev, 'f');
    await page.goto(base+'boss_hall.html?land=1&card=L12&lown=L11,L12,L13', {waitUntil:'load'}); await sleep(1500);
    out.flavor = await page.evaluate(()=>{ const f=document.getElementById('flavor'); const cs=getComputedStyle(f); const r=f.getBoundingClientRect(); return {text:f.textContent, display:cs.display, vis:cs.visibility, opacity:cs.opacity, h:r.height, name:(document.getElementById('pname')||{}).textContent}; });
    // cycle the eye button views and record whether flavor visible
    out.flavorErrors = ev.filter(x=>/pageerror/.test(x.kind)).map(x=>x.text.split('\n')[0]);
    await page.screenshot({path:`${OUT}/shots/pm_landhall_flavor.png`});
    console.log('flavor', JSON.stringify(out.flavor), out.flavorErrors);
    await page.close(); await ctx.close();
  }
  if(which.includes('counts')){
    const {ctx} = await newCtx(browser, port, {width:390});
    const page = await ctx.newPage(); const ev=[]; attach(page, ev, 'c');
    await homeReady(page, port);
    await page.evaluate(()=>openIsland('island_time.html'));
    const F = await getFrame(page, /\/island_time\.html/, ()=>typeof allW!=='undefined', 20000);
    await sleep(1500); await closeWelcome(page, F);
    out.counts = {trial: await F.evaluate(()=>({fp:!!(window.HansenFreepass&&HansenFreepass.active()), temp:localStorage.getItem('hansen_card_temp_unlock_until')}))};
    const nav = await F.$('#navCards');
    out.counts.navTap = nav ? (await tap(page, F, nav, {force:true})).ok : 'no navCards';
    await sleep(1200);
    out.counts.header = await F.evaluate(()=>{ const a=document.querySelector('.screen.active'); return a.id+' :: '+a.innerText.replace(/\s+/g,' ').slice(0,160); });
    out.counts.entry = await F.evaluate(()=>{ const e=document.querySelector('[onclick*="__hsnOpenHall"]'); return e? e.innerText.replace(/\s+/g,' ').slice(0,120):null; });
    const ent = await F.$('[onclick*="__hsnOpenHall"]');
    if(ent){ await tap(page, F, ent, {force:true}); await sleep(1000); }
    out.counts.panel = await F.evaluate(()=>{ const p=document.getElementById('__hs_hall_panel'); return p? p.innerText.replace(/\s+/g,' ').slice(0,500):null; });
    await page.screenshot({path:`${OUT}/shots/pm_hall_panel.png`});
    // after trial expiry
    await F.evaluate(()=>{ localStorage.setItem('hansen_freepass_until', String(Date.now()-1000)); localStorage.removeItem('hansen_card_temp_unlock_until'); const p=document.getElementById('__hs_hall_panel'); if(p) p.remove(); });
    await F.evaluate(()=>{ try{ showScreen('home'); }catch(e){} }); await sleep(300);
    const nav2 = await F.$('#navCards'); if(nav2){ await tap(page, F, nav2, {force:true}); await sleep(1200); }
    out.counts.entryExpired = await F.evaluate(()=>{ const e=document.querySelector('[onclick*="__hsnOpenHall"]'); return e? e.innerText.replace(/\s+/g,' ').slice(0,120):null; });
    const ent2 = await F.$('[onclick*="__hsnOpenHall"]');
    if(ent2){ await tap(page, F, ent2, {force:true}); await sleep(1000); }
    out.counts.panelExpired = await F.evaluate(()=>{ const p=document.getElementById('__hs_hall_panel'); return p? p.innerText.replace(/\s+/g,' ').slice(0,260):null; });
    console.log('counts', JSON.stringify(out.counts,null,1));
    await page.close(); await ctx.close();
  }
  if(which.includes('welcome')){
    out.welcome = {};
    for(const key of ['land3','sports','season','time']){
      const {ctx} = await newCtx(browser, port, {width:390});
      const page = await ctx.newPage();
      await homeReady(page, port);
      await page.evaluate(k=>openIsland('island_'+k+'.html'), key);
      const F = await getFrame(page, new RegExp('/island_'+key+'\\.html'), ()=>typeof allW!=='undefined', 20000);
      await waitFor(()=>F.evaluate(()=>!!document.querySelector('#alertModal.show')), {timeout:6000});
      out.welcome[key] = await F.evaluate(()=>({txt:(document.getElementById('alertInner')||{}).innerText.replace(/\s+/g,' ').slice(0,300), cards:document.querySelectorAll('#homeScreen .mode-card').length, data:DATA.length}));
      await page.close(); await ctx.close();
    }
    console.log('welcome', JSON.stringify(out.welcome,null,1));
  }
}finally{
  fs.writeFileSync(`${OUT}/p_misc.json`, JSON.stringify(out,null,1));
  await browser.close(); srv.close();
}
