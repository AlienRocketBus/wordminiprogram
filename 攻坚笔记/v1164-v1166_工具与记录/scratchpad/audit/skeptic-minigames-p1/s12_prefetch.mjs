// Missed-check: returning user — hansen_island_prefetch_v1025.js maps storage keys to island file names that don't exist (404s on every home load)
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT, served} from './lib.mjs';
import fs from 'node:fs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
// visit two islands like a kid (job, action), answer one listen question each so they save
for(const k of ['job']){
  const F = await openIsland(page, port, k);
  await tapCard(page, F, /^startListen\(/);
  await waitIn(F, ()=>document.querySelector(`[onclick="startListenLevel('easy')"]`)); await sleep(300);
  await tap(page, F, ()=>document.querySelector(`[onclick="startListenLevel('easy')"]`));
  await waitIn(F, ()=>listenQ&&document.querySelector('#listenScreen .boss-opt')); await sleep(600);
  await tap(page, F, ()=>[...document.querySelectorAll('#listenScreen .boss-opt')][0]);
  await sleep(1500);
}
const keys = await page.evaluate(()=>{ const o=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/^wordIsland|^lastIsland/.test(k)) o.push(k+(k==='lastIslandKey'?('='+localStorage.getItem(k)):'')); } return o; });
// returning user opens the app again
await page.close();
const page2 = await ctx.newPage(); const ev2=[]; watch(page2, ev2);
served.length = 0;
await page2.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
await sleep(9000);
const links = await page2.evaluate(()=>[...document.querySelectorAll('link[rel=prefetch]')].map(l=>l.getAttribute('href')+' ['+l.dataset.why+']'));
const out = {storageKeys:keys, prefetchLinks:links, notFound: served.filter(s=>s.s===404).map(s=>s.u)};
console.log(JSON.stringify(out,null,1));
fs.writeFileSync(`${OUT}/s12_prefetch.json`, JSON.stringify(out,null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
