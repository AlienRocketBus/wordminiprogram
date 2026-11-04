import { startServer, launch, newCtx, attachLogs, sleep, OUT } from './lib.mjs';
import { seed, shot } from './lib2.mjs';
import fs from 'node:fs';
const PAL = process.argv[2] || 'cloud';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const samples=[];
const ctx = await newCtx(browser,{dsf:1});
const extra = {}; if(PAL!=='none') extra['hansen_palette_global']=PAL;
await seed(ctx, extra);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(3000);
const card = page.locator('a.island.food');
await card.evaluate(el=>el.scrollIntoView({block:'center'})); await sleep(500);
const bb = await card.boundingBox();
const t0 = Date.now();
await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
for(const ms of [60,200,400,700,1100,1600,2200,3000]){
  const wait = ms - (Date.now()-t0); if(wait>0) await sleep(wait);
  const p = OUT+`/shots/door_${PAL}_${ms}ms.png`;
  await page.screenshot({path:p});
  const st = await page.evaluate(()=>{ const w=document.getElementById('islandFrameWrap'); const f=document.getElementById('islandFrame'); return {wrap:w.style.display, wrapBg:getComputedStyle(w).backgroundColor, frameOpacity:f.style.opacity, loading:getComputedStyle(document.getElementById('islandLoading')).display}; });
  samples.push({ms, real: Date.now()-t0, ...st});
}
fs.writeFileSync(OUT+`/door_${PAL}.json`, JSON.stringify({samples,errs},null,1));
console.log(JSON.stringify(samples,null,0));
await browser.close(); srv.close();
