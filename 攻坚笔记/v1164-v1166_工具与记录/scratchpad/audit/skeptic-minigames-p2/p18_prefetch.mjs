import { startServer, launch, newCtx, sleep, OUT, served } from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
try{
  const {ctx} = await newCtx(browser, port, {width:390, init:()=>{ try{ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('lastIslandKey','wordIslandTime'); localStorage.setItem('wordIslandAdj', '{}'); localStorage.setItem('wordIslandPeople','{}'); }catch(e){} }});
  const page = await ctx.newPage();
  const r404=[]; page.on('response', r=>{ if(r.status()===404) r404.push(r.url().replace(/^http:\/\/127\.0\.0\.1:\d+\//,'')); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await sleep(9000);
  console.log('404s', JSON.stringify(r404));
  console.log('prefetched', JSON.stringify(await page.evaluate(()=>window.HansenIslandPrefetch&&HansenIslandPrefetch.prefetched())));
  console.log('server 404', JSON.stringify(served.filter(s=>s.status===404).map(s=>s.url)));
}finally{ await browser.close(); srv.close(); }
