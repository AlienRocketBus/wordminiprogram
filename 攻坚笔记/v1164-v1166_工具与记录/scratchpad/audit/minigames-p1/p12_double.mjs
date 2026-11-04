// Does the island iframe load twice when a card on the home map is tapped? (welcome popup shown twice)
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn} from './h.mjs';
const ISL = (process.argv[2]||'action,adjective,animal,body,city,clothes,color,family,food,home,job,nature,question,school').split(',');
const {srv, port} = await startServer();
const browser = await launch();
for(const key of ISL){
  const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage();
  const nav=[]; const t0={v:0};
  page.on('framenavigated', f=>{ if(f!==page.mainFrame()) nav.push({ms:Date.now()-t0.v, url:f.url().replace(/^http:\/\/[^/]+\//,'')}); });
  const aborted=[]; page.on('requestfailed', r=>{ if(/ERR_ABORTED/.test(r.failure()&&r.failure().errorText) && !/\.mp3/.test(r.url())) aborted.push(r.url().replace(/^http:\/\/[^/]+\//,'')); });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Page.enable');
  cdp.on('Page.frameRequestedNavigation', e=>nav.push({ms:Date.now()-t0.v, req:e.reason, url:String(e.url).replace(/^http:\/\/[^/]+\//,''), frame:e.frameId.slice(0,6)}));
  cdp.on('Page.frameScheduledNavigation', e=>nav.push({ms:Date.now()-t0.v, sched:e.reason, url:String(e.url).replace(/^http:\/\/[^/]+\//,'')}));
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await sleep(1500);
  nav.length=0; aborted.length=0; t0.v=Date.now();
  await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
  const shows=[]; let F=null;
  for(let i=0;i<60;i++){
    F = page.frames().find(f=>f.url().includes('/island_'+key+'.html'));
    if(F){ try{ const s = await F.evaluate(()=>({shown:!!document.querySelector('#alertModal.show'), ts:performance.timeOrigin})); if(s.shown){ if(!shows.find(x=>x.ts===s.ts)) shows.push({ms:Date.now()-t0.v, ts:s.ts}); await F.evaluate(()=>closeAlert()); } }catch(e){} }
    await sleep(100);
  }
  const iframes = await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(f=>f.id+':'+(f.getAttribute('src')||'')+':'+getComputedStyle(f).display));
  console.log(key, 'iframe navigations:', JSON.stringify(nav), '\n   welcome shown in', shows.length, 'distinct documents', JSON.stringify(shows.map(s=>s.ms)), '\n   aborted:', aborted.slice(0,6).join(' '), '\n   iframes:', iframes.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
