import { launch, ctx, BASE, OUT, visibleClickables } from './lib.mjs';
import fs from 'node:fs';
const b = await launch(); const c = await ctx(b, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }}); const p = await c.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,200)));
await p.goto(BASE+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(1500);
const t0=Date.now();
await p.locator('a[href="island_animal.html"]').first().scrollIntoViewIfNeeded();
await p.locator('a[href="island_animal.html"]').first().click();
let i=0; async function snap(name, pg=p){ await pg.screenshot({path:`${OUT}/shots/03_${String(i++).padStart(2,'0')}_${name}.png`}); }
await p.waitForTimeout(800); await snap('loading');
// wait for iframe ready
const fr = await (await p.waitForSelector('#islandFrame')).contentFrame();
await fr.waitForLoadState('load'); const tIsl = Date.now()-t0;
await p.waitForTimeout(2500); await snap('island_landing');
const txt = await fr.evaluate(()=>document.body.innerText.slice(0,4000));
const cl = await fr.evaluate(()=>{const out=[];for(const e of document.querySelectorAll('button,a,[onclick],[role=button]')){const r=e.getBoundingClientRect();if(r.width<2||r.height<2||r.bottom<0||r.top>innerHeight)continue;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)continue;out.push({t:(e.innerText||e.getAttribute('aria-label')||e.title||'').trim().replace(/\s+/g,' ').slice(0,30),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),id:e.id});}return out;});
const dims = await fr.evaluate(()=>({sh:document.documentElement.scrollHeight}));
fs.writeFileSync(`${OUT}/data/03_island.json`, JSON.stringify({tIsl, txt, cl, dims, errs},null,1));
// full screenshot of iframe page by scrolling
for (let y=0, k=0; y<dims.sh && k<8; y+=800, k++){ await fr.evaluate(yy=>scrollTo(0,yy), y); await p.waitForTimeout(500); await snap('island_scroll'+k); }
await b.close(); console.log(tIsl, dims, errs); console.log(txt.slice(0,3000)); console.log(JSON.stringify(cl));
