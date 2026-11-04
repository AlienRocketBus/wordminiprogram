import fs from 'fs';
import {boot,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const init=fs.readFileSync('instr.js','utf8');
const {s,page,log}=await boot({init});
function tree(f,d=0){let out='  '.repeat(d)+(f.url().replace(s.base,'')||'(about:blank)')+'\n';for(const c of f.childFrames())out+=tree(c,d+1);return out;}
// open via 星海觉醒 banner (index) -> land_map, then season via the same API land_map uses
await page.evaluate(()=>openIsland('land_map.html'));await sleep(3000);
await page.evaluate(()=>openIsland('island_season.html'));await sleep(2500);
let fr=page.frames().find(f=>f.parentFrame()===page.mainFrame()&&f.url().includes('island_season'));
await dismissWelcome(fr);
await sleep(12000);
console.log(tree(page.mainFrame()));
const inst=await page.evaluate(()=>{const out=[];function walk(w,d){try{if(w.S&&w.addXP)out.push({d,path:w.location.pathname+w.location.search,key:w.__hsnSaveKey,learned:w.S.learned.length,charXP:w.S.charXP});}catch(e){}for(let i=0;i<w.frames.length;i++)walk(w.frames[i],d+1);}walk(window,0);return out;});
console.log('template instances',JSON.stringify(inst));
// user learns words in active season: mark learned via markAnswer (same as games)
const t0=Date.now();
await fr.evaluate(()=>{for(let i=0;i<12;i++){try{markAnswer(i,true);}catch(e){}}addXP(30);save();});
await sleep(1200);
console.log('active S learned',await fr.evaluate(()=>S.learned.length));
// watch hsn_progress writes for 20s
await sleep(20000);
const W=(await page.evaluate(()=>window.__W)).filter(w=>w.t>=t0&&/^hsn_progress:/.test(w.k));
for(const w of W)console.log(((w.t-t0)/1000).toFixed(1),w.f,w.k,w.v);
// leave: go home then open food (unloads season tree)
await page.evaluate(()=>closeIsland());await sleep(800);
await page.evaluate(()=>openIsland('island_food.html'));await sleep(4000);
const W2=(await page.evaluate(()=>window.__W)).filter(w=>w.t>=t0+21000&&/^hsn_progress:/.test(w.k));
for(const w of W2)console.log('after-leave',((w.t-t0)/1000).toFixed(1),w.f,w.k,w.v);
const snapKeys=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('hsn_progress:'))o[k]=localStorage.getItem(k);}return o;});
console.log('final snapshots',JSON.stringify(snapKeys,null,1));
await s.close();
