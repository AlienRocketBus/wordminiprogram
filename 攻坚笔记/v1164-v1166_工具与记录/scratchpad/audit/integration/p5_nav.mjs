import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message)); page.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,200)); });
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(2500);
console.log('T0 home', await st(page));
// A: open animal, Android back
let o = await openCard(page,'island_animal.html'); console.log('A open', o.ms, o.s);
let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
// set a marker in island to detect reload
await fr.evaluate(()=>window.__marker=42);
await page.evaluate(()=>history.back());
let w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('A back ->', w.ms, w.s);
// B: forward
await page.evaluate(()=>history.forward());
w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1', 3000); console.log('B forward ->', w.ms, w.s);
fr = islandFrame(page,'island_animal.html'); console.log('B keepalive marker', fr && await fr.evaluate(()=>window.__marker));
// C: refresh while inside island
await page.reload({waitUntil:'load'});
w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&s.rs==='complete', 8000); console.log('C reload ->', w.ms, w.s);
await sleep(1000);
fr = islandFrame(page,'island_animal.html');
console.log('C frame', !!fr, fr && await fr.evaluate(()=>({marker:window.__marker, scr:(document.querySelector('.screen.active')||{}).id})));
// C2: back after reload
await page.evaluate(()=>history.back());
w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('C2 back after reload ->', w.ms, w.s);
// C3: go into a mini game (speed), then hardware back, then wait on home, reopen same island
o = await openCard(page,'island_animal.html'); console.log('C3 reopen', o.ms, o.s);
fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
const gameInfo = await fr.evaluate(()=>{ try{ startSpeed(); }catch(e){ return 'err '+e.message; } return (document.querySelector('.screen.active')||{}).id; });
await sleep(500);
console.log('C3 in game', gameInfo, await fr.evaluate(()=>document.querySelector('.screen.active').innerText.slice(0,200).replace(/\n/g,' | ')));
await page.screenshot({path:'/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration/c3_speed.png'});
await page.evaluate(()=>history.back());
w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('C3 back from game ->', w.ms, w.s);
console.log('errors', errs);
await browser.close(); srv.close();
