import { launch, ctx, BASE, OUT } from './lib.mjs';
import fs from 'node:fs';
const b = await launch(); const c = await ctx(b, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }}); const p = await c.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,200)));
await p.goto(BASE+'/island_animal.html',{waitUntil:'load'}); await p.waitForTimeout(2500);
let i=0; async function snap(name){ await p.screenshot({path:`${OUT}/shots/04_${String(i++).padStart(2,'0')}_${name}.png`}); }
const log=[]; const t0=Date.now(); let taps=0;
async function tap(loc, label){ await loc.first().click({timeout:5000}); taps++; await p.waitForTimeout(1200); await snap(label); log.push({taps,label,t:Date.now()-t0, txt:(await p.evaluate(()=>{const m=[...document.querySelectorAll('.modal.show,.overlay.show,[class*=modal].show,[id*=Modal].show,[id*=game]:not([style*="display: none"])')].map(e=>e.innerText.slice(0,300));return m.join('\n---\n')}))}); }
await tap(p.locator('button:visible',{hasText:'开始冒险'}), 'close_welcome');
await tap(p.getByText('探索单词',{exact:true}), 'explore');
fs.writeFileSync(`${OUT}/data/04_explore.json`, JSON.stringify({log,errs},null,1));
console.log(JSON.stringify(log,null,1).slice(0,4000));
// dump whole visible text
console.log((await p.evaluate(()=>document.body.innerText)).slice(0,1500));
await b.close();
