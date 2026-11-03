import { launch, ctx, BASE, OUT, visibleClickables } from './lib.mjs';
import fs from 'node:fs';
const b = await launch(); const c = await ctx(b); const p = await c.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e).slice(0,200)));
const t0=Date.now(); await p.goto(BASE+'/index.html',{waitUntil:'load'}); const tl=Date.now()-t0;
const log={tLoad:tl, steps:[]};
for (const ms of [500,1500,3000,6000]) { await p.waitForTimeout(ms - (Date.now()-t0-tl) > 0 ? ms-(Date.now()-t0-tl) : 0);
  await p.screenshot({path:`${OUT}/shots/01_first_${ms}ms.png`}); }
const txt = await p.evaluate(()=>document.body.innerText.slice(0,3000));
log.bodyText = txt;
log.clickables = await visibleClickables(p);
log.ls = await p.evaluate(()=>Object.keys(localStorage));
log.errs=errs; log.ext=c.__ext.slice(0,30);
fs.writeFileSync(`${OUT}/data/01_firstrun.json`, JSON.stringify(log,null,1));
await b.close();
console.log(JSON.stringify({tLoad:tl, errs, nClick: log.clickables.length, ext:log.ext.length}));
console.log(txt.slice(0,1500));
