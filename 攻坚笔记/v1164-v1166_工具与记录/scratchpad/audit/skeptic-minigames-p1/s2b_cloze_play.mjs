// MG-02 play-through: answer every cloze question correctly with real taps; read the result
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'body', level = process.argv[3]||'easy';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, island);
await tapCard(page, F, /^startCloze/);
await waitIn(F, (lv)=>document.querySelector(`#clozeContent [onclick="startClozeLevel('${lv}')"]`), level);
const cardText = await F.evaluate((lv)=>document.querySelector(`#clozeContent [onclick="startClozeLevel('${lv}')"]`).innerText.replace(/\s+/g,' '), level);
await sleep(300);
await tap(page, F, (lv)=>document.querySelector(`#clozeContent [onclick="startClozeLevel('${lv}')"]`), level);
const log=[]; let res=null; let lastWord=null;
for(let n=0;n<40;n++){
  const st = await waitIn(F, (lw)=>{
    const r = document.querySelector('#clozeContent');
    if(/完成！/.test(r.innerText)) return {done:true, txt:r.innerText.replace(/\s+/g,' ').slice(0,200)};
    const o = document.querySelectorAll('#clozeScreen .cloze-opt');
    if(o.length && !o[0].dataset.done && clozeQ && clozeQ.word.en!==lw){ const hb=[...document.querySelectorAll('#clozeContent span')].find(s=>/^\d+ \/ \d+$/.test(s.textContent)); return {word:clozeQ.word.en, counter: hb&&hb.textContent}; }
    return null;
  }, lastWord, 15000);
  if(!st){ log.push('timeout'); break; }
  if(st.done){ res=st.txt; break; }
  log.push(st.counter+' '+st.word); lastWord=st.word;
  const t = await tap(page, F, (w)=>{ const cap = document.getElementById('clozeBlank').dataset.cap==='1'; const disp = cap? w.charAt(0).toUpperCase()+w.slice(1) : w; return [...document.querySelectorAll('#clozeScreen .cloze-opt')].find(o=>o.textContent===disp); }, st.word);
  if(!t.tapped) log.push('TAP FAIL '+JSON.stringify(t));
}
await page.screenshot({path:`${OUT}/shots_s2b_${island}_${level}.png`});
const out = {island, level, cardText, asked: log.filter(l=>!/TAP|timeout/.test(l)).length, log, result: res, errors: ev};
console.log(JSON.stringify(out,null,1));
fs.writeFileSync(`${OUT}/s2b_${island}_${level}.json`, JSON.stringify(out,null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
