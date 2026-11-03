// MG-02 data check: for every PART-1 island and cloze level, how many words are actually askable by nextClozeQ's regex
import {startServer, launch, phoneCtx, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const ISL = ['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school'];
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const res = {};
for(const k of ISL){
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/island_${k}.html`, {waitUntil:'load'});
  await sleep(800);
  res[k] = await page.evaluate(()=>{
    const o={};
    for(const lv in CLOZE_LEVELS){
      const idx = CLOZE_LEVEL_IDX[lv];
      const shown = idx.length;
      const skipped = [];
      idx.forEach(i=>{ const w=allW[i]; const re=new RegExp('\\b'+w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i'); if(!w.ex || !re.test(w.ex)) skipped.push(w.en+' :: '+w.ex); });
      const missing = CLOZE_LEVELS[lv].words.filter(en=>allW.findIndex(w=>w.en===en)<0);
      o[lv] = {shown, askable: shown-skipped.length, maxPct: shown? Math.round((shown-skipped.length)*100/shown):null, skipped, missingFromAllW: missing};
    }
    return o;
  });
  await page.close();
}
fs.writeFileSync(`${OUT}/s2_cloze_data.json`, JSON.stringify(res,null,1));
for(const [k,v] of Object.entries(res)) for(const [lv,d] of Object.entries(v)) if(d.skipped.length||d.missingFromAllW.length) console.log(k, lv, d.shown,'->',d.askable, 'max', d.maxPct+'%', d.skipped.map(s=>s.split(' :: ')[0]).join(','), d.missingFromAllW.length?('MISSING '+d.missingFromAllW.join(',')):'');
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
