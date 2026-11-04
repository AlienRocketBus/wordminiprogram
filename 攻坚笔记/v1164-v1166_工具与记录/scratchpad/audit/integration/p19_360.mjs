import { setup, sleep, log, tapEl } from './lib.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
for(const W of [390,360]){
const {srv, browser, ctx, base, external} = await setup({width:W, height: W===360?740:844, initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(2500);
// loading overlay screenshot: tap and capture at ~600ms
await page.evaluate(()=>{ document.querySelector('a.island[href="island_body.html"]').scrollIntoView({block:'center'}); }); await sleep(300);
const b = await (await page.$('a.island[href="island_body.html"]')).boundingBox();
await page.touchscreen.tap(b.x+b.width/2, b.y+b.height/2);
await sleep(650);
await page.screenshot({path:`${D}/loading_${W}.png`});
await waitFor(page, s=>s.op==='1'&&s.rs==='complete', 8000); await sleep(1200);
const fr = islandFrame(page,'island_body.html'); await dismissWelcome(page, fr); await sleep(600);
await page.screenshot({path:`${D}/island_${W}.png`});
const hdr = await fr.evaluate(()=>{ const r=e=>{ if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.right),Math.round(b.bottom)]; }; return {btn:r(document.querySelector('.world-map-btn')), stats:r(document.querySelector('.top-stats')), coin:r(document.querySelector('.stat-badge.coin')), streak:r(document.querySelector('.hsn-streak-inline')), name:r(document.querySelector('.top-name')), sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}; });
console.log(W, JSON.stringify(hdr));
const homeOv = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
console.log(W, 'home overflow', JSON.stringify(homeOv));
await browser.close(); srv.close();
}
