import fs from 'node:fs';
import { startServer, launch, newCtx, sleep, tap, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome } from './nav.mjs';
const block = process.argv[2]==='block';
const {srv, port} = await startServer();
const browser = await launch();
const R={block};
try{
  const {ctx} = await newCtx(browser, port, {width:390});
  if(block) await ctx.route('**/hansen_room_warm_v1023.js*', r=>r.fulfill({status:200, contentType:'text/javascript', body:'/*blocked*/'}));
  const page = await ctx.newPage();
  const rows=[];
  page.on('requestfinished', async r=>{ try{ const f=r.frame(); let d=0,p=f.parentFrame(); while(p){d++;p=p.parentFrame();} const s=await r.sizes(); const u=r.url(); const ext=(u.split('?')[0].match(/\.([a-z0-9]+)$/i)||[,'(none)'])[1]; rows.push({d, fr:(f.url().split('/').pop()||'').split('?')[0], ext, b:s.responseBodySize, rt:r.resourceType()}); }catch(e){} });
  await homeReady(page, port);
  const n0 = rows.length;
  const card = await page.$('a[href="island_time.html"]');
  await tap(page, page.mainFrame(), card);
  const F = await getFrame(page, /\/island_time\.html/, ()=>typeof allW!=='undefined', 20000);
  await sleep(1500); await closeWelcome(page, F);
  await sleep(15000);
  const after = rows.slice(n0);
  const agg = {};
  for(const r of after){ const k=r.d+':'+r.fr+':'+r.ext+':'+r.rt; agg[k]=agg[k]||{n:0,MB:0}; agg[k].n++; agg[k].MB+=r.b/1048576; }
  R.total = {n:after.length, MB:+(after.reduce((a,r)=>a+r.b,0)/1048576).toFixed(2)};
  R.top = Object.entries(agg).sort((a,b)=>b[1].MB-a[1].MB).slice(0,14).map(([k,v])=>k+' n='+v.n+' MB='+v.MB.toFixed(2));
  try{ const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable'); const m = await cdp.send('Performance.getMetrics'); const g=k=>(m.metrics.find(x=>x.name===k)||{}).value; R.perf = {JSHeapUsedMB:+(g('JSHeapUsedSize')/1048576).toFixed(1), Documents:g('Documents'), Frames:g('Frames'), Nodes:g('Nodes'), TaskDurationS:+g('TaskDuration').toFixed(1), ScriptDurationS:+g('ScriptDuration').toFixed(1)}; }catch(e){ R.perfErr=String(e); }
  console.log(JSON.stringify(R,null,1));
}finally{ fs.writeFileSync(`${OUT}/m_net_${block?'block':'normal'}.json`, JSON.stringify(R,null,1)); await browser.close(); srv.close(); }
