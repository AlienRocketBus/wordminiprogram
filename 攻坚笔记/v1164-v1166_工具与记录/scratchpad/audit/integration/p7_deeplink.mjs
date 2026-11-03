import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('response', r=>{ if(r.status()>=400) errs.push('HTTP '+r.status()+' '+r.url()); });
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
const loc = ()=>page.evaluate(()=>({p:location.pathname.split('/').pop()+location.search, hl:history.length, hs:JSON.stringify(history.state)}));
// D1: deep link island
await page.goto(base+'island_food.html', {waitUntil:'load'});
await sleep(2000);
await dismissWelcome(page, page.mainFrame());
console.log('D1 at', await loc(), 'frames', page.frames().map(f=>f.url().replace(base,'')));
let r = await tapEl(page, page, '.world-map-btn'); console.log('tap home', r.hit);
await page.waitForLoadState('load'); await sleep(1500);
console.log('D1 after home', await loc());
await page.goBack().catch(e=>console.log('goBack err', e.message)); await sleep(1000);
console.log('D1 after back', await loc());
// D2: deep link land_map
await page.goto(base+'land_map.html', {waitUntil:'load'}); await sleep(1500);
console.log('D2 land_map', await loc());
const back = await page.$('#backBtn'); console.log('backBtn exists', !!back);
r = await tapEl(page, page, '#backBtn'); console.log('tap back', r.hit); await sleep(1500);
console.log('D2 after back', await loc());
// D3: deep link island_land3 -> home btn
await page.goto(base+'island_land3.html', {waitUntil:'load'}); await sleep(2000);
await dismissWelcome(page, page.mainFrame());
r = await tapEl(page, page, '.world-map-btn'); console.log('D3 tap home', r.hit); await sleep(2000);
console.log('D3 after home', await loc());
// D4: deep link boss_hall, season_showcase, spelling_bee, check, _frame
for(const p of ['boss_hall.html','season_showcase.html','spelling_bee.html','check.html','_frame.html']){
  await page.goto(base+p, {waitUntil:'load'}); await sleep(1500);
  const info = await page.evaluate(()=>{ const b=[...document.querySelectorAll('a,button,[onclick]')].filter(e=>{const t=(e.innerText||e.getAttribute('aria-label')||e.title||'').trim(); return /返回|首页|关闭|✕|×|home|back|地图/i.test(t)&&e.offsetParent!==null;}).map(e=>(e.tagName+'#'+e.id+':'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,15))); return {title:document.title, back:b.slice(0,6), bodyText:document.body.innerText.slice(0,120).replace(/\n/g,' | ')}; });
  console.log('D4', p, JSON.stringify(info));
  await page.screenshot({path:`/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration/deep_${p}.png`});
}
console.log('errors', errs);
console.log('external', [...external]);
await browser.close(); srv.close();
