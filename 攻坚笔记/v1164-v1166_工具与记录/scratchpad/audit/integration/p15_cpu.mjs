import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const M = async()=>{ const m=(await cdp.send('Performance.getMetrics')).metrics; const o={}; for(const x of m) o[x.name]=x.value; return o; };
async function idle(label, ms=10000){ const a=await M(); const n0=log.length; await sleep(ms); const b=await M(); const reqs=log.slice(n0);
  console.log(label, 'script ms', Math.round((b.ScriptDuration-a.ScriptDuration)*1000), 'task ms', Math.round((b.TaskDuration-a.TaskDuration)*1000), 'layout', b.LayoutCount-a.LayoutCount, 'recalc', b.RecalcStyleCount-a.RecalcStyleCount, 'frames', page.frames().length, 'heapMB', Math.round(b.JSHeapUsedSize/1048576), 'reqs', reqs.length); }
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(8000);
await idle('A fresh home idle 10s');
await openCard(page, 'island_animal.html'); let fr=islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
await sleep(12000);
await idle('B island open (settled) idle 10s');
await tapEl(page, fr, '.world-map-btn'); await waitFor(page, s=>s.wrap==='none');
await sleep(2000);
await idle('C home after closing island idle 10s');
await browser.close(); srv.close();
