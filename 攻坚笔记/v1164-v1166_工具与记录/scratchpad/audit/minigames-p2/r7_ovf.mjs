import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
for(const W of [360,390]){
  const {ctx} = await newCtx(browser, port, {width:W});
  const page = await ctx.newPage();
  for(const url of ['boss_hall.html?v=1163&lv=1&own=1,2,5','season_showcase.html?v=1163&boss=S1','boss_hall.html?v=1163&land=1&card=L12&lown=L11,L12,L13']){
    await page.goto(`http://127.0.0.1:${port}/${url}`, {waitUntil:'load'}); await sleep(1500);
    const r = await page.evaluate((W)=>{ const out=[]; document.querySelectorAll('body *').forEach(el=>{ const s=getComputedStyle(el); if(s.display==='none') return; const b=el.getBoundingClientRect(); if(b.width>0 && b.right>W+1){ let p=el.parentElement, depthOk=true; out.push({tag:el.tagName, id:el.id, cls:String(el.className).slice(0,40), left:Math.round(b.left), right:Math.round(b.right), w:Math.round(b.width), pos:s.position}); } });
      const meta=(document.querySelector('meta[name=viewport]')||{}).content; return {iw:innerWidth, vvw:visualViewport?Math.round(visualViewport.width):null, scale:visualViewport?visualViewport.scale:null, meta, out:out.slice(0,12)}; }, W);
    console.log(W, url, JSON.stringify(r));
    if(url.includes('land=1')) console.log('  quote:', await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && /undefined/.test(e.textContent)).map(e=>e.tagName+'#'+e.id+'.'+e.className+' '+e.textContent.slice(0,40))));
    await page.screenshot({path:`${OUT}/shots/ovf_${W}_${url.split('.')[0]}${url.includes('land=1')?'_land':''}.png`});
  }
  await ctx.close();
}
await browser.close(); srv.close();
