import fs from 'fs';
import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const init=fs.readFileSync('instr_audio.js','utf8');
const {s,page,log}=await boot({init});
let {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);
await sleep(20000);
const A=await page.evaluate(()=>window.__A||[]);
const agg={};for(const a of A){const k=a.f+' '+a.what;agg[k]=(agg[k]||0)+1;}
console.log(JSON.stringify(agg,null,1));
console.log(A.filter(a=>!/^1:island_food/.test(a.f)).slice(0,20));
await s.close();
