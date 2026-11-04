import {serve,launch,newCtx,attach,sleep} from './kit.mjs';
const {srv,base}=await serve();
const b=await launch();
async function run(blockWarm){
  const c=await newCtx(b,base);
  if(blockWarm) await c.route(/hansen_room_warm_v1023\.js/, r=>r.fulfill({status:200,contentType:'text/javascript',body:'/*blocked*/'}));
  const p=await c.newPage(); const log=[]; attach(p,log);
  const cdp=await c.newCDPSession(p); await cdp.send('Performance.enable');
  await p.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
  await p.evaluate(()=>{ const e=[...document.querySelectorAll('button,div,span,a')].find(x=>x.textContent.trim()==='跳过'&&x.offsetParent&&x.children.length===0); if(e) e.click(); });
  const m0=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  await p.evaluate(()=>openIsland('island_food.html')); await sleep(16000);
  const m1=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const frames=p.frames().length;
  await c.close();
  return {blockWarm, frames, documents:m1.Documents, jsHeapMB:+(m1.JSHeapUsedSize/1048576).toFixed(1), scriptSec:+(m1.ScriptDuration-m0.ScriptDuration).toFixed(2), taskSec:+(m1.TaskDuration-m0.TaskDuration).toFixed(2), nodes:m1.Nodes, errors:log.length};
}
const out=[await run(false), await run(true)];
console.log(JSON.stringify(out,null,1));
await b.close(); srv.close();
