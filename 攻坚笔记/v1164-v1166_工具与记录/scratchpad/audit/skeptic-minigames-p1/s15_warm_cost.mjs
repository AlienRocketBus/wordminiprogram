// Cost of the hidden 'warm room' cascade after opening one island: main-thread task time + JS heap, with vs without hansen_room_warm_v1023.js
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT, served} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'food';
const {srv, port} = await startServer();
const browser = await launch();
const out={};
for(const v of ['normal','warm_blocked']){
  const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  if(v==='warm_blocked') await ctx.route(/hansen_room_warm_v1023\.js/, r=>r.fulfill({status:200, contentType:'text/javascript', body:'/* blocked for measurement */'}));
  const page = await ctx.newPage(); const ev=[]; watch(page, ev);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const m = async()=>{ const r=await cdp.send('Performance.getMetrics'); const o={}; r.metrics.forEach(x=>o[x.name]=x.value); return o; };
  const F = await openIsland(page, port, island);
  const a = await m(); const reqA = served.length;
  await sleep(25000);
  const b = await m();
  const docs = await page.evaluate(()=>performance.getEntriesByType('resource').length);
  out[v] = {taskSec_25s:+(b.TaskDuration-a.TaskDuration).toFixed(2), scriptSec_25s:+(b.ScriptDuration-a.ScriptDuration).toFixed(2), layoutSec_25s:+(b.LayoutDuration-a.LayoutDuration).toFixed(2), heapMB_after:+(b.JSHeapUsedSize/1048576).toFixed(1), frames:page.frames().length, documents:b.Documents, nodes:b.Nodes};
  console.log(v, JSON.stringify(out[v]));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/s15_warm_cost_${island}.json`, JSON.stringify(out,null,1));
await browser.close(); srv.close(); process.exit(0);
