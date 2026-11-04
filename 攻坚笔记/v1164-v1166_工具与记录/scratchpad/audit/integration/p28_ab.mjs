import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
const variants = {orig: undefined, fixed: {'/index.html': D+'/patched/index_F9.html', '/hansen_room_warm_v1023.js': D+'/patched/room_warm_noframe.js'}};
for(const [name, ovr] of Object.entries(variants)){
  const {srv, browser, ctx, base} = await setup({override: ovr, initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
  const page = await ctx.newPage();
  await page.goto(base+'index.html', {waitUntil:'load'}); await sleep(3000);
  const res=[];
  for(const f of ['island_animal.html','island_food.html','island_sports.html','island_job.html','island_color.html','island_nature.html','island_land2.html']){
    if(f.startsWith('island_land')){ const t0=Date.now(); await page.evaluate((f)=>openIsland(f), f); const w=await waitFor(page, s=>s.op==='1'&&s.u===f, 9000, 20); res.push(f.replace('island_','').replace('.html','')+':'+(Date.now()-t0)); }
    else {
      await page.evaluate((f)=>{ document.querySelector('a.island[href="'+f+'"]').scrollIntoView({block:'center'}); }, f); await sleep(250);
      const b = await (await page.$(`a.island[href="${f}"]`)).boundingBox();
      const t0=Date.now(); await page.touchscreen.tap(b.x+b.width/2, b.y+b.height/2);
      const w=await waitFor(page, s=>s.op==='1'&&s.u===f&&s.wrap==='block', 9000, 20); res.push(f.replace('island_','').replace('.html','')+':'+(Date.now()-t0));
    }
    await sleep(3500);
    await page.evaluate(()=>history.back()); await waitFor(page, s=>s.wrap==='none', 3000); await sleep(1200);
  }
  console.log(name, 'tap->reveal ms', res.join(' '));
  await browser.close(); srv.close();
}
