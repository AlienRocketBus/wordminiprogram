import { launch, ctx, BASE, OUT, visibleClickables } from './lib.mjs';
import fs from 'node:fs';
const b = await launch(); const c = await ctx(b); const p = await c.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,200)));
const log=[]; const t0=Date.now();
await p.goto(BASE+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(1500);
let i=0;
async function snap(name){ await p.screenshot({path:`${OUT}/shots/02_${String(i++).padStart(2,'0')}_${name}.png`}); }
for(let k=0;k<3;k++){ const btn = p.locator("button:visible", {hasText:/下一步|开始|出发|Go|知道了/}).first(); if(await btn.count()){ await btn.click(); await p.waitForTimeout(700); await snap('onb'+k); log.push({k, t:Date.now()-t0, txt: (await p.evaluate(()=>{const o=[...document.querySelectorAll('div')].filter(d=>{const s=getComputedStyle(d);return (s.position==='fixed')&&d.offsetHeight>200&&s.display!=='none'&&+s.zIndex>100}); return o.map(d=>d.innerText.slice(0,200))}))}); } }
await p.waitForTimeout(1500); await snap('after_onb');
log.push({after: await p.evaluate(()=>{const o=[...document.querySelectorAll('body *')].filter(d=>{const s=getComputedStyle(d);return (s.position==='fixed')&&d.offsetHeight>150&&s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0}); return o.map(d=>({id:d.id,cls:String(d.className).slice(0,40),z:getComputedStyle(d).zIndex,t:d.innerText.slice(0,200)}))})});
// full page
await p.screenshot({path:`${OUT}/shots/02_home_full.png`, fullPage:true});
const dims = await p.evaluate(()=>({sh:document.documentElement.scrollHeight, ih:innerHeight}));
log.push({dims});
log.push({ls: await p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=(localStorage.getItem(k)||'').slice(0,80)}return o})});
fs.writeFileSync(`${OUT}/data/02_onboard.json`, JSON.stringify({log,errs},null,1));
await b.close(); console.log(JSON.stringify({log,errs},null,1).slice(0,5000));
