import {setup,attach,sleep} from './lib.mjs';
async function run(noWarm){
  const s=await setup();const log=[];
  if(noWarm) await s.ctx.route(/hansen_room_warm_v1023\.js/,r=>r.fulfill({status:200,contentType:'text/javascript',body:'window.HansenRoom={open:function(){},close:function(){},warm:function(){},prefetch:function(){},isReady:function(){return false},isOpen:function(){return false}};'}));
  const page=await s.ctx.newPage();attach(page,log);
  const cdp=await s.ctx.newCDPSession(page);await cdp.send('Performance.enable');
  await page.goto(s.base+'index.html',{waitUntil:'load'});await sleep(1200);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button,a,div,span')].find(e=>e.textContent.trim()==='跳过'&&e.offsetParent);b&&b.click();});
  await page.evaluate(()=>openIsland('island_food.html'));await sleep(20000);
  const m1=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  await sleep(10000);
  const m2=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const frames=page.frames().length;
  await s.close();
  return {noWarm,frames,Documents:m2.Documents,Nodes:m2.Nodes,JSEventListeners:m2.JSEventListeners,heapMB:(m2.JSHeapUsedSize/1e6).toFixed(1),idleTaskSecPer10s:(m2.TaskDuration-m1.TaskDuration).toFixed(2),scriptSecPer10s:(m2.ScriptDuration-m1.ScriptDuration).toFixed(2)};
}
console.log(JSON.stringify(await run(false)));
console.log(JSON.stringify(await run(true)));
