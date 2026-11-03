// Missed-check: 字母拼拼乐 setTimeout(nextScramble,1200) has no active/screen guard → leaving/换难度 right after a correct word
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'school';
const {srv, port} = await startServer();
const browser = await launch();
const out={};
for(const v of ['back','menu']){
  const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; watch(page, ev);
  const F = await openIsland(page, port, island);
  await F.evaluate(()=>{ window.__sp=[]; const s=window.speak; window.speak=function(t){ window.__sp.push({t:String(t).slice(0,30), ms:Math.round(performance.now()), scr:(document.querySelector('.screen.active')||{}).id}); return s.apply(this, arguments); }; });
  await tapCard(page, F, /^startScramble\(/);
  await waitIn(F, ()=>document.querySelector(`[onclick="startScrambleLevel('easy')"]`)); await sleep(300);
  await tap(page, F, ()=>document.querySelector(`[onclick="startScrambleLevel('easy')"]`));
  const w = await waitIn(F, ()=>scrWord && document.querySelector('#scrLetters .scramble-letter') ? scrWord.en : null);
  await sleep(500);
  for(const ch of w.replace(/ /g,'').split('')){ await tap(page, F, (c)=>[...document.querySelectorAll('#scrLetters .scramble-letter')].find(x=>!x.classList.contains('used')&&x.textContent===c), ch, {scroll:false}); await sleep(110); }
  await sleep(250);
  const b = v==='back' ? await tap(page, F, ()=>document.querySelector('#scrambleScreen .back-btn'), null, {scroll:false})
                       : await tap(page, F, ()=>[...document.querySelectorAll('#scrambleContent span')].find(s=>s.textContent==='换难度'), null, {scroll:false});
  await sleep(150);
  const s1 = await F.evaluate(()=>({scr:document.querySelector('.screen.active').id, menu:!!document.querySelector(`#scrambleContent [onclick^="startScrambleLevel"]`), word:scrWord&&scrWord.en}));
  await sleep(1800);
  const s2 = await F.evaluate(()=>({scr:document.querySelector('.screen.active').id, menu:!!document.querySelector(`#scrambleContent [onclick^="startScrambleLevel"]`), tiles:!!document.querySelector('#scrLetters .scramble-letter'), word:scrWord&&scrWord.en, sp:window.__sp.slice(-3)}));
  await page.screenshot({path:`${OUT}/shots_s13_scramble_${v}.png`});
  out[v]={island, firstWord:w, tapped:b.tapped, right_after:s1, after_1_8s:s2, errors:ev.filter(e=>!/tencent|tcb|signin/i.test(e.t))};
  console.log(v, JSON.stringify(out[v]));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/s13_scramble_leave_${island}.json`, JSON.stringify(out,null,1));
await browser.close(); srv.close(); process.exit(0);
