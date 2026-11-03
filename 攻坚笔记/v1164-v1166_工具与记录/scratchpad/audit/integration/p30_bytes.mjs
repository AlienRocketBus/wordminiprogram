import fs from 'node:fs';
import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
const ROOT='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const size = p=>{ try{ return fs.statSync(ROOT+decodeURIComponent(p)).size; }catch(e){ return 0; } };
for(const [name, ovr] of [['orig', undefined], ['no-room-warm-in-frame', {'/hansen_room_warm_v1023.js': D+'/patched/room_warm_noframe.js'}]]){
  log.length = 0;
  const {srv, browser, ctx, base} = await setup({cache:'public, max-age=3600', override: ovr, initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
  const page = await ctx.newPage();
  await page.goto(base+'index.html', {waitUntil:'load'}); await sleep(12000);
  const n0 = log.length;
  await openCard(page, 'island_animal.html'); const fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
  await sleep(15000);
  const reqs = log.slice(n0);
  const bytes = reqs.reduce((a,r)=>a+size(r.p),0);
  const html = reqs.filter(r=>/\.html/.test(r.p)).map(r=>r.url);
  const by={}; for(const r of reqs){ const ext=(r.p.match(/\.([a-z0-9]+)$/i)||[,'?'])[1]; by[ext]=by[ext]||[0,0]; by[ext][0]++; by[ext][1]+=size(r.p); }
  const dup = reqs.length - new Set(reqs.map(r=>r.url)).size;
  console.log(name, 'by type', Object.entries(by).map(([k,v])=>k+':'+v[0]+'/'+(v[1]/1048576).toFixed(1)+'MB').join(' '), 'duplicate URLs:', dup);
  console.log(name, 'requests during island open (15s):', reqs.length, 'bytes MB:', (bytes/1048576).toFixed(2), 'html docs:', html.length, html.join(' '));
  await browser.close(); srv.close();
}
