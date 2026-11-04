import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
page.on('framenavigated', f=>{ if(f.parentFrame()===page.mainFrame()) console.log('   [islandFrame navigated]', f.url().replace(base,'')); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
const center = async(f)=>{ await page.evaluate((f)=>{ document.querySelector('a.island[href="'+f+'"]').scrollIntoView({block:'center'}); }, f); await sleep(250); const b=await (await page.$(`a.island[href="${f}"]`)).boundingBox(); return [b.x+b.width/2, b.y+b.height/2]; };
// G1 double tap
let [x,y] = await center('island_sports.html');
const h0 = await page.evaluate(()=>history.length);
await page.touchscreen.tap(x,y); await sleep(80); await page.touchscreen.tap(x,y);
let w = await waitFor(page, s=>s.op==='1'&&s.u==='island_sports.html'&&s.rs==='complete', 8000);
console.log('G1 double tap ->', w.ms, w.s.u, 'hlen', h0, '->', w.s.hlen, w.s.hst);
await sleep(800);
await page.evaluate(()=>history.back()); w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('G1 back ->', w.ms, w.s.wrap, w.s.hst, 'top', w.s.top);
await sleep(800);
// G2: open A, back during load, then the home tap of B at once
[x,y] = await center('island_job.html');
await page.touchscreen.tap(x,y);
await sleep(250);
await page.evaluate(()=>history.back());
w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('G2 back during load ->', w.ms, w.s);
await sleep(2500);
console.log('G2 2.5s later', await st(page));
// G3: tap card A, then 300ms later card B via JS openIsland (simulating double entry e.g. recent card + other)
[x,y] = await center('island_color.html');
await page.touchscreen.tap(x,y); await sleep(300);
await page.evaluate(()=>openIsland('island_nature.html'));
w = await waitFor(page, s=>s.op==='1'&&s.rs==='complete'&&s.wrap==='block', 8000); await sleep(1500);
console.log('G3 A then B ->', w.ms, await st(page));
await page.evaluate(()=>history.back()); w = await waitFor(page, s=>s.wrap==='none', 3000); console.log('G3 back ->', w.ms, w.s.hst, 'top', w.s.top);
await sleep(1500); console.log('G3 after', await st(page));
console.log('errors', errs);
await browser.close(); srv.close();
