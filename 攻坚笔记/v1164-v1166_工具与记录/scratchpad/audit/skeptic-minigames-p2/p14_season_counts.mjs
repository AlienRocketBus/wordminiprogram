import { startServer, launch, newCtx, sleep, OUT } from './lib.mjs';
import fs from 'node:fs';
const {srv, port} = await startServer();
const browser = await launch();
const out={};
try{
  for(const key of ['season','sports','land1','land3','time','treasure']){
    const {ctx} = await newCtx(browser, port, {width:390, init:()=>{try{localStorage.setItem('hansen_onboarded','1')}catch(e){}}});
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/island_${key}.html`, {waitUntil:'load'}); await sleep(1500);
    out[key] = await page.evaluate(()=>{
      const idx=[...Array(allW.length).keys()];
      const c=(L)=>Object.fromEntries(Object.keys(L).map(k=>[k, L[k].filter? idx.filter(L[k].filter).length : (L[k].words? L[k].words.length : null)]));
      return {allW:allW.length,
        listen:Object.fromEntries(Object.keys(LISTEN_LEVEL_IDX).map(k=>[k,LISTEN_LEVEL_IDX[k].length])),
        typing:c(TYPING_LEVELS), cloze:c(CLOZE_LEVELS), moles:c(MOLES_LEVELS), fish:c(FISH_LEVELS), bubble:c(BUBBLE_LEVELS), scramble:c(SCRAMBLE_LEVELS), eagle:c(EAGLE_LEVELS)};
    });
    console.log(key, JSON.stringify(out[key]));
    await page.close(); await ctx.close();
  }
}finally{ fs.writeFileSync(`${OUT}/p14_counts.json`, JSON.stringify(out,null,1)); await browser.close(); srv.close(); }
