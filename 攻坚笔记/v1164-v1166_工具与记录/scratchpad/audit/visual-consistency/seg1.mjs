import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome, islandFrame, tapEl, goHomeFromIsland } from './lib2.mjs';
import fs from 'node:fs';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const notes=[];
const ctx = await newCtx(browser,{dsf:2});
await seed(ctx);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
await shot(page,'d10_home_top');
await page.evaluate(()=>window.scrollTo(0,760)); await sleep(700); await shot(page,'d11_home_islands');
await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await sleep(700); await shot(page,'d12_home_bottom');
await page.evaluate(()=>window.scrollTo(0,0)); await sleep(400);
// eye button
try{ const bb=await page.locator('#hsnThemeEye').boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2); await sleep(1200); await shot(page,'d13_home_eye'); notes.push('eye tapped'); await page.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2); await sleep(800);}catch(e){notes.push('eye err '+e.message);}
const islands=['island_animal.html','island_food.html','island_sports.html','island_job.html','island_color.html','island_school.html','island_time.html','island_question.html'];
let first=true;
for(const f of islands){
  const fr = await openIsland(page,f);
  if(!fr){ notes.push('no frame '+f); continue; }
  attachLogs(page,'x',[]);
  if(first) await shot(page,'d20_'+f.replace('.html','')+'_welcome');
  await dismissWelcome(page,fr);
  await sleep(500);
  await shot(page,'d21_'+f.replace('.html','')+'_top');
  if(first){
    await fr.evaluate(()=>window.scrollTo(0,480)); await sleep(600); await shot(page,'d22_'+f.replace('.html','')+'_modes');
    await fr.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await sleep(600); await shot(page,'d23_'+f.replace('.html','')+'_bottom');
    await fr.evaluate(()=>window.scrollTo(0,0)); await sleep(300);
  }
  const hdr = await fr.evaluate(()=>{ const q=s=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); const c=getComputedStyle(e); return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),bg:c.backgroundImage.slice(0,80)||c.backgroundColor}}; return {home:q('.world-map-btn'), avatar:q('#avatarIcon'), nav:q('.bottom-nav, nav, #navHome')} });
  notes.push(f+' '+JSON.stringify(hdr));
  first=false;
}
// land islands via land map path
await page.evaluate(()=>window.openIsland('land_map.html')); await sleep(5000);
await shot(page,'d30_land_map');
const lm = islandFrame(page,'land_map');
if(lm){ const info = await lm.evaluate(()=>[...document.querySelectorAll('a,button,[onclick]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>{const r=e.getBoundingClientRect(); return (e.tagName+' '+String(e.className).slice(0,30)+' '+(e.getAttribute('onclick')||e.getAttribute('href')||'').slice(0,60)+' @'+Math.round(r.left)+','+Math.round(r.top)+' '+e.innerText.replace(/\s+/g,' ').slice(0,20))}).slice(0,40)); notes.push('LANDMAP '+JSON.stringify(info,null,1)); }
for(const f of ['island_land1.html','island_land4.html','island_land8.html']){
  const fr = await openIsland(page,f);
  if(!fr){ notes.push('no frame '+f); continue; }
  await dismissWelcome(page,fr); await sleep(500);
  await shot(page,'d31_'+f.replace('.html','')+'_top');
  await fr.evaluate(()=>window.scrollTo(0,480)); await sleep(600); await shot(page,'d32_'+f.replace('.html','')+'_modes');
  await fr.evaluate(()=>window.scrollTo(0,0));
}
fs.writeFileSync(OUT+'/seg1_notes.json', JSON.stringify({notes,errs,external:[...new Set(external)],r404:reqLog},null,1));
console.log(notes.join('\n')); console.log('errs',errs); console.log('ext',[...new Set(external)]); console.log('404',reqLog);
await browser.close(); srv.close();
