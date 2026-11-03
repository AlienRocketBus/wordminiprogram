import { setup, sleep, log, tapEl } from './lib.mjs';
const D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/integration';
const {srv, browser, ctx, base, external} = await setup();
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message)); page.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,200)); });
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(1500);
console.log('skip', await tapEl(page, page, '#__hansen_onboarding button[aria-label="跳过新手引导"]'));
await sleep(800);
console.log('onb gone', await page.evaluate(()=>!document.getElementById('__hansen_onboarding')||getComputedStyle(document.getElementById('__hansen_onboarding')).display));
await page.evaluate(()=>window.scrollTo(0,0));
const scrollBefore = await page.evaluate(()=>{ const a=document.querySelector('a.island[href="island_food.html"]'); a.scrollIntoView({block:'center'}); return scrollY; });
await sleep(300);
log.length=0;
const t0=Date.now();
const r = await tapEl(page, page, 'a.island[href="island_food.html"]');
console.log('tap', r);
// poll
let tl=[];
for(let i=0;i<80;i++){
  const s = await page.evaluate(()=>{const w=document.getElementById('islandFrameWrap'),f=document.getElementById('islandFrame'),l=document.getElementById('islandLoading');
    let u='',rs='';try{u=f.contentWindow.location.pathname;rs=f.contentDocument.readyState}catch(e){}
    return {wrap:w.style.display, op:f.style.opacity, u, rs, load:l?l.style.display:'none', hist:history.length, st:JSON.stringify(history.state)}});
  tl.push([Date.now()-t0, JSON.stringify(s)]);
  if(s.op==='1' && s.rs==='complete') break;
  await sleep(50);
}
const seen = new Set(); for(const [t,s] of tl){ if(!seen.has(s)){ seen.add(s); console.log(t, s);} }
await sleep(1500);
await page.screenshot({path:D+'/island_food_open.png'});
const fr = page.frames().map(f=>f.url().replace(base,''));
console.log('frames', fr);
console.log('island html requests', log.filter(l=>/island_|land_map|boss_hall|season_showcase|spelling_bee/.test(l.p)).map(l=>l.url));
console.log('errors', errs.slice(0,20));
await browser.close(); srv.close();
