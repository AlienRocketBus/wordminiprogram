import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({override: process.env.OVR? {'/index.html': process.env.OVR}:undefined, initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
page.on('framenavigated', f=>{ if(f.parentFrame()===page.mainFrame()) console.log('   [islandFrame navigated]', f.url().replace(base,''), new Date().toISOString().slice(17,23)); });
const tree = ()=>page.frames().map(f=>{ let d=0,p=f; while(p.parentFrame()){d++;p=p.parentFrame();} return '  '.repeat(d)+f.url().replace(base,''); }).join(' / ');
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
for(const f of ['island_animal.html','island_food.html','island_sports.html','island_job.html']){
  const o = await openCard(page, f);
  console.log('OPEN', f, 'reveal', o.ms, 'hlen', o.s.hlen);
  const fr = islandFrame(page, f); if(fr) await dismissWelcome(page, fr);
  await sleep(4500);
  console.log('  tree before close:', tree(), 'hlen', await page.evaluate(()=>history.length));
  await tapEl(page, fr, '.world-map-btn');
  const w = await waitFor(page, s=>s.wrap==='none', 3000);
  await sleep(600);
  const s = await st(page);
  console.log('  CLOSE', w.ms, 'islandFrame=', s.u, 'hlen', s.hlen, 'state', s.hst, '\n  tree after close:', tree());
}
console.log('errors', errs);
await browser.close(); srv.close();
