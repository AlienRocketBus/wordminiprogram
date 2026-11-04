import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
const ovr = {'/index.html': D+'/patched/index_F9.html', '/hansen_room_warm_v1023.js': D+'/patched/room_warm_noframe.js'};
const {srv, browser, ctx, base, external} = await setup({override: ovr, initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
const tree = ()=>page.frames().map(f=>f.url().replace(base,'')).join(' / ');
const recent = ()=>page.evaluate(()=>(document.getElementById('recentNum')||{}).textContent);
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
let o = await openCard(page, 'island_animal.html'); let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
await sleep(8000);
console.log('animal open 8s frames:', tree());
await tapEl(page, fr, '.world-map-btn'); await waitFor(page, s=>s.wrap==='none'); await sleep(600);
console.log('recent card after animal:', await recent());
o = await openCard(page, 'island_food.html'); fr = islandFrame(page,'island_food.html'); await dismissWelcome(page, fr);
await sleep(3000);
await tapEl(page, fr, '.world-map-btn'); await waitFor(page, s=>s.wrap==='none'); await sleep(1500);
console.log('after closing food: iframe=', (await st(page)).u, 'recent card:', await recent(), 'frames:', tree());
// forward restores food instantly
await page.evaluate(()=>history.forward()); let w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1', 3000); console.log('forward ->', w.ms, w.s.u);
// reload while inside
await page.reload({waitUntil:'load'}); w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&s.rs==='complete', 8000); console.log('reload ->', w.ms, w.s.u, w.s.hst);
await sleep(800);
// land flow
await page.evaluate(()=>history.back()); await waitFor(page, s=>s.wrap==='none'); await sleep(500);
await tapEl(page, page, '#hsnSeasonBar'); w = await waitFor(page, s=>s.u==='land_map.html'&&s.op==='1'&&s.rs==='complete', 8000); console.log('land_map', w.ms);
await sleep(600); fr = islandFrame(page,'land_map.html');
await tapEl(page, fr, '.spot'); await sleep(500); await tapEl(page, fr, '#pfoot .pbtn.enter');
w = await waitFor(page, s=>/island_land/.test(s.u)&&s.op==='1'&&s.rs==='complete', 8000); console.log('land1', w.ms, w.s.u, w.s.hst);
await sleep(800); fr = islandFrame(page, w.s.u); await dismissWelcome(page, fr);
await tapEl(page, fr, '.world-map-btn'); w = await waitFor(page, s=>s.u==='land_map.html'&&s.op==='1', 8000); console.log('land1 -> map btn ->', w.ms, w.s.u);
await sleep(800); fr = islandFrame(page,'land_map.html');
await tapEl(page, fr, '#backBtn'); w = await waitFor(page, s=>s.wrap==='none', 3000); await sleep(1500); console.log('land_map back ->', w.ms, 'iframe now', (await st(page)).u, 'hst', (await st(page)).hst);
console.log('errors', errs);
await browser.close(); srv.close();
