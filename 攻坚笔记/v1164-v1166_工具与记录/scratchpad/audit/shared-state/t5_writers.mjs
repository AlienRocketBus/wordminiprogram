import fs from 'fs';
import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const init=fs.readFileSync('instr.js','utf8');
const {s,page,log}=await boot({init});
async function tapIn(frame,sel,idx=0){
  const b=await frame.evaluate(([sel,idx])=>{const el=document.querySelectorAll(sel)[idx];if(!el)return null;el.scrollIntoView({block:'center',behavior:'auto'});return 1;},[sel,idx]);
  if(!b)return {err:'noel '+sel};
  await sleep(120);
  const box=await frame.evaluate(([sel,idx])=>{const el=document.querySelectorAll(sel)[idx];const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {x,y,hit:!!(t&&(t===el||el.contains(t))),top:t&&(t.id||String(t.className).slice(0,40)||t.tagName)};},[sel,idx]);
  if(box.hit)await page.touchscreen.tap(box.x,box.y);
  return box;
}
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);
await sleep(8000); // let warm tree boot
const t0=Date.now();
console.log('before',await topbar(frame));
// play listen: tap mode card
console.log('tap listen card',await tapIn(frame,'.mode-card[onclick="startListen()"]'));
await sleep(600);
console.log('tap level',await tapIn(frame,'#listenContent [onclick^="startListenLevel"]'));
await sleep(800);
for(let q=0;q<6;q++){
  const ci=await frame.evaluate(()=>listenQ&&listenQ.opts.findIndex(o=>o.cn===listenQ.word.cn));
  const r=await tapIn(frame,'#listenScreen .boss-opt',ci);
  await sleep(2600);
  if(q==0)console.log('first answer tap',r);
}
console.log('after listen',await topbar(frame));
console.log('LS',await ls(page,['hansen_wallet_charxp','hansen_wallet_coins','hansen_wallet_gems']));
// go home via world-map button
console.log('home btn',await tapIn(frame,'.world-map-btn'));
await sleep(1500);
console.log('wrap display',await page.evaluate(()=>document.getElementById('islandFrameWrap').style.display));
// open animal
const r2=await openIslandByTap(page,'island_animal.html');
await dismissWelcome(r2.frame);
await sleep(3000);
console.log('animal topbar',await topbar(r2.frame));
await sleep(6000);
const W=await page.evaluate(()=>window.__W||[]);
fs.writeFileSync('writers.json',JSON.stringify(W,null,0));
// summarize writes after t0 by frame & key class
const sum={};for(const w of W){const kc=w.k.replace(/[0-9]+/g,'#').replace(/^(wordIsland)[A-Za-z]+/,'$1*').replace(/^(hsn_progress:).*/,'$1*');const k=w.f+' | '+kc;sum[k]=(sum[k]||0)+1;}
console.log(Object.entries(sum).sort().map(([k,v])=>v+'\t'+k).join('\n'));
console.log(log.filter(l=>!/favicon/.test(l)).slice(0,20).join('\n'));
await s.close();
