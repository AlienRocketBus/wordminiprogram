import {boot,openIslandByTap,dismissWelcome,topbar,ls,sleep} from './harness.mjs';
const {s,page,log}=await boot();
function tree(f,d=0){let out='  '.repeat(d)+(f.url().replace(s.base,'')||'(about:blank)')+(f.isDetached()?' [detached]':'')+'\n';for(const c of f.childFrames())out+=tree(c,d+1);return out;}
console.log('HOME tree after 6s:');await sleep(6000);console.log(tree(page.mainFrame()));
const {frame}=await openIslandByTap(page,'island_food.html');
await dismissWelcome(frame);
for(const t of [3000,6000,12000]){await sleep(t);console.log('--- tree +'+t);console.log(tree(page.mainFrame()));}
// count island template instances
const n=await page.evaluate(()=>{let c=0;function walk(w){try{if(w.S&&w.addXP)c++;}catch(e){}for(let i=0;i<w.frames.length;i++)walk(w.frames[i]);}walk(window);return c;});
console.log('live island-template instances (have S & addXP):',n);
const m=await page.evaluate(()=>performance.memory?performance.memory.usedJSHeapSize/1e6:null);console.log('heapMB',m);
await s.close();
