import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('response', r=>{ if(r.status()>=400) errs.push('HTTP '+r.status()+' '+r.url()); });
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(2500);
const t0=Date.now();
let r = await tapEl(page, page, '#hsnSeasonBar'); console.log('tap season bar', r.hit);
let w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&s.u==='land_map.html'&&s.rs==='complete', 8000); console.log('land_map shown', w.ms, w.s);
await sleep(800);
let fr = islandFrame(page,'land_map.html');
await page.screenshot({path:'/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration/land_map_shell.png'});
// tap spot 1
r = await tapEl(page, fr, '.spot'); console.log('tap spot', r.hit); await sleep(600);
r = await tapEl(page, fr, '#pfoot .pbtn.enter'); console.log('tap enter', r.hit);
w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&/island_land/.test(s.u)&&s.rs==='complete', 8000); console.log('land island', w.ms, w.s);
await sleep(1000);
const landFile = w.s.u;
fr = islandFrame(page, landFile); await dismissWelcome(page, fr);
// in-app home button
r = await tapEl(page, fr, '.world-map-btn'); console.log('tap map btn', r.hit);
w = await waitFor(page, s=>s.u==='land_map.html'&&s.op==='1'&&s.rs==='complete', 8000); console.log('after map btn', w.ms, w.s);
await sleep(800);
// open land island again then hardware back
fr = islandFrame(page,'land_map.html');
r = await tapEl(page, fr, '.spot'); await sleep(500); r = await tapEl(page, fr, '#pfoot .pbtn.enter');
w = await waitFor(page, s=>/island_land/.test(s.u)&&s.op==='1'&&s.rs==='complete', 8000); console.log('land island again', w.ms, w.s.u);
await sleep(800);
await page.evaluate(()=>history.back());
w = await waitFor(page, s=>s.wrap==='none' || s.u==='land_map.html', 3000); console.log('hardware back from land island ->', w.ms, w.s);
// from home: land_map then its back button
await sleep(500);
r = await tapEl(page, page, '#hsnSeasonBar');
w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&s.u==='land_map.html', 8000); console.log('land_map again', w.ms, w.s.u, w.s.rs);
await sleep(800); fr = islandFrame(page,'land_map.html');
r = await tapEl(page, fr, '#backBtn'); console.log('tap land back', r.hit);
w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('land_map back ->', w.ms, w.s);
// empress -> island_season? only when unlocked; check season card in island 
console.log('errors', errs);
await browser.close(); srv.close();
