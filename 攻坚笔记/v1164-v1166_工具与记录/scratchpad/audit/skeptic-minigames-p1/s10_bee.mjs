// MG-07 (word-bank label) + MG-08 (✕ → 继续比赛 during '听单词…' doubles robot speed) — spelling bee opened from an island card
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||"food"; const RESUME = +(process.argv[3]||4000);
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, island);
await tapCard(page, F, /^HansenSpellBee\.open/);
let B=null; for(let i=0;i<80;i++){ B=page.frames().find(f=>/spelling_bee\.html/.test(f.url())); if(B){ try{ if(await B.evaluate(()=>!!document.getElementById('startBtn')&&document.readyState==='complete')) break; }catch(e){} } await sleep(150); }
await sleep(800);
const setup = await B.evaluate(()=>({sub:(document.querySelector('.sub')||{}).textContent, tip:(document.querySelector('#diffBox')?.previousElementSibling?.querySelector('.tip')||{}).textContent, mode:S.mode, bot:S.bot}));
console.log('setup', JSON.stringify(setup));
// instrument botStep timing
await B.evaluate(()=>{ window.__bs=[]; const o=window.botStep; window.botStep=function(ms){ window.__bs.push({t:Math.round(performance.now()), prog:botProg, q:qIdx}); return o.apply(this, arguments); }; });
const st = await tap(page, B, ()=>document.getElementById('startBtn'));
// --- word 1: normal, measure bot (do nothing)
const w1 = await waitIn(B, ()=>/听单词/.test(document.getElementById('sttBot').textContent)? {q:qIdx, len:target.length, t:Math.round(performance.now())} : null, null, 8000);
const end1 = await waitIn(B, (q)=> (raceOver && qIdx===q)? {t:Math.round(performance.now())} : null, w1&&w1.q, 30000);
const steps1 = await B.evaluate((q)=>window.__bs.filter(s=>s.q===q).map(s=>s.t), w1.q);
// advance to next word (the app auto-advances after a result)
const w2 = await waitIn(B, (q)=>(qIdx!==q && /听单词/.test(document.getElementById('sttBot').textContent))? {q:qIdx, len:target.length, t:Math.round(performance.now())} : null, w1.q, 15000);
// --- word 2: ✕ then 继续比赛 while '听单词…'
const x = await tap(page, B, ()=>document.getElementById('exitBtn'), null, {scroll:false});
await sleep(250);
const confirmShown = await B.evaluate(()=>document.getElementById('exitConfirm').classList.contains('on'));
// stay on the confirm for 4 s (kid hesitates) and see whether the robot types meanwhile
await sleep(RESUME);
const duringConfirm = await B.evaluate(()=>({botProg, paused, bs:window.__bs.filter(s=>s.q===qIdx).length}));
const y = await tap(page, B, ()=>document.getElementById('exitNo'), null, {scroll:false});
const tResume = await B.evaluate(()=>Math.round(performance.now()));
const end2 = await waitIn(B, (q)=> (raceOver && qIdx===q)? {t:Math.round(performance.now())} : null, w2.q, 30000);
const steps2 = await B.evaluate((q)=>window.__bs.filter(s=>s.q===q).map(s=>s.t), w2.q);
const gaps = a=>a.slice(1).map((t,i)=>t-a[i]);
const out = {island, setup, word1:{len:w1.len, botCalls:steps1.length, firstStepAfterShownMs: steps1[0]-w1.t, gaps:gaps(steps1), finishedAfterMs: end1.t-w1.t},
  word2:{len:w2.len, confirmShown, duringConfirm, botCalls:steps2.length, stepsAfterResume: steps2.map(t=>t-tResume), gaps:gaps(steps2), finishedAfterResumeMs: end2? end2.t-tResume : null}, errors:ev.filter(e=>!/tencent|tcb|signin/i.test(e.t))};
console.log(JSON.stringify(out,null,1));
fs.writeFileSync(`${OUT}/s10_bee_${island}_${RESUME}.json`, JSON.stringify(out,null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
