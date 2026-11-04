import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){}
  if(window.top===window){ window.__iv=0; window.__ivLive=new Set(); const si=window.setInterval, ci=window.clearInterval; window.setInterval=function(){ const id=si.apply(this,arguments); window.__iv++; window.__ivLive.add(id); return id; }; window.clearInterval=function(id){ window.__ivLive.delete(id); return ci.apply(this,arguments); };
    window.__ael=0; const ael=EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener=function(){ window.__ael++; return ael.apply(this,arguments); }; }
}});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
async function metrics(){
  await cdp.send('HeapProfiler.collectGarbage').catch(()=>{});
  await sleep(300);
  const m = (await cdp.send('Performance.getMetrics')).metrics; const o={}; for(const x of m) o[x.name]=x.value;
  const top = await page.evaluate(()=>({ivCreated:window.__iv, ivLive:window.__ivLive.size, ael:window.__ael, prefetchLinks:document.querySelectorAll('link[rel=prefetch]').length, nodes:document.getElementsByTagName('*').length, heap: performance.memory? Math.round(performance.memory.usedJSHeapSize/1048576):null}));
  return {heapMB: Math.round(o.JSHeapUsedSize/1048576), totalHeapMB: Math.round(o.JSHeapTotalSize/1048576), docs:o.Documents, frames:o.Frames, nodes:o.Nodes, listeners:o.JSEventListeners, pwFrames: page.frames().length, ...top};
}
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(4000);
console.log('baseline', JSON.stringify(await metrics()));
const cards = await page.evaluate(()=>[...document.querySelectorAll('a.island')].map(a=>a.getAttribute('href')));
const seq = [...cards, 'island_animal.html', 'island_food.html'];
for(let i=0;i<seq.length;i++){
  const f=seq[i];
  const o = await openCard(page, f);
  const fr = islandFrame(page, f); if(fr) await dismissWelcome(page, fr);
  await sleep(4500); // dwell so idle warmers kick in
  const mOpen = await metrics();
  // close via home button
  await tapEl(page, fr, '.world-map-btn');
  await waitFor(page, s=>s.wrap==='none', 3000);
  await sleep(500);
  const mClosed = await metrics();
  console.log(i+1, f, 'reveal', o.ms, 'OPEN', JSON.stringify(mOpen), '\n   CLOSED', JSON.stringify(mClosed));
}
console.log('errors', errs.slice(0,10), errs.length);
await browser.close(); srv.close();
