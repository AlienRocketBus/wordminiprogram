// MG-12: are 打地鼠 Chinese labels truncated (ellipsis) so similar meanings become indistinguishable?
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'question', level=process.argv[3]||'hard';
const {srv, port} = await startServer();
const browser = await launch();
const res={};
for(const [w,h] of [[390,844],[360,640]]){
  const {ctx} = await phoneCtx(browser, port, {w,h,init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; watch(page, ev);
  const F = await openIsland(page, port, island);
  await tapCard(page, F, /^startMoles\(/);
  await waitIn(F, (lv)=>document.querySelector(`[onclick="startMolesLevel('${lv}')"]`), level); await sleep(300);
  await tap(page, F, (lv)=>document.querySelector(`[onclick="startMolesLevel('${lv}')"]`), level);
  await waitIn(F, ()=>document.querySelectorAll('#molesGrid .mole-cn').length===9, null, 6000); await sleep(1200);
  const clip = new Map();
  for(let k=0;k<4;k++){ // sample several reshuffles
    const r = await F.evaluate(()=>[...document.querySelectorAll('#molesGrid .mole-cn')].map(e=>({full:e.textContent, sw:e.scrollWidth, cw:e.clientWidth})).filter(x=>x.sw>x.cw+1));
    r.forEach(x=>clip.set(x.full, x));
    await sleep(2600);
  }
  await page.screenshot({path:`${OUT}/shots_s11_moles_${island}_${w}.png`});
  res[w] = {target: await F.evaluate(()=>molesTarget&&molesTarget.en), clipped:[...clip.values()]};
  console.log(w, JSON.stringify(res[w]));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/s11_moles_${island}.json`, JSON.stringify(res,null,1));
await browser.close(); srv.close(); process.exit(0);
