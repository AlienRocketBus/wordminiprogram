// MG-03 independent repro: answer Q1 right, immediately 换难度 → same level; watch for unprompted question changes
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'animal';
const games = (process.argv[3]||'listen,cloze,bubble,listenwrong').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const out={};
for(const g of games){
  const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; watch(page, ev);
  const F = await openIsland(page, port, island);
  const cfg = {
    listen: {card:/^startListen\(/, lvl:`[onclick="startListenLevel('easy')"]`, cur:'listenQ&&listenQ.word.en', counter:'#listenContent', answer: async(wrong)=>tap(page,F,(wrong)=>{ const o=[...document.querySelectorAll('#listenScreen .boss-opt')]; return o.find(x=>wrong? !x.textContent.includes(listenQ.word.cn) : x.textContent.includes(listenQ.word.cn)); }, wrong), change: ()=>tap(page,F,()=>[...document.querySelectorAll('#listenContent span')].find(s=>s.textContent==='换难度'),null,{scroll:false})},
    cloze: {card:/^startCloze\(/, lvl:`[onclick="startClozeLevel('easy')"]`, cur:'clozeQ&&clozeQ.word.en', counter:'#clozeContent', answer: async()=>tap(page,F,()=>{ const cap=document.getElementById('clozeBlank').dataset.cap==='1'; const w=clozeQ.word.en; const d=cap?w[0].toUpperCase()+w.slice(1):w; return [...document.querySelectorAll('#clozeScreen .cloze-opt')].find(o=>o.textContent===d); }), change: ()=>tap(page,F,()=>[...document.querySelectorAll('#clozeContent span')].find(s=>s.textContent==='换难度'),null,{scroll:false})},
    bubble: {card:/^startBubble\(/, lvl:`[onclick="startBubbleLevel('easy')"]`, cur:'bubbleActive&&bubbleTarget&&bubbleTarget.en', counter:'#bubbleContent', answer: async()=>tap(page,F,()=>[...document.querySelectorAll('#bbArea .bubble')].find(b=>b.dataset.en===bubbleTarget.en),null,{scroll:false}), change: ()=>tap(page,F,()=>[...document.querySelectorAll('#bubbleContent button')].find(b=>/换难度/.test(b.textContent)))},
  };
  const base = g.replace('wrong','');
  const C = cfg[base]; const wrong = /wrong/.test(g);
  await tapCard(page, F, C.card);
  await waitIn(F, (s)=>document.querySelector(s), C.lvl); await sleep(400);
  await tap(page, F, (s)=>document.querySelector(s), C.lvl);
  await waitIn(F, (e)=>eval(e), C.cur, 8000); await sleep(base==='bubble'?1200:900);
  const q1 = await F.evaluate((e)=>eval(e), C.cur);
  const a = await C.answer(wrong);
  const tA = Date.now();
  await sleep(350);
  const c = await C.change();
  await waitIn(F, (s)=>document.querySelector(s), C.lvl, 3000); await sleep(300);
  const l2 = await tap(page, F, (s)=>document.querySelector(s), C.lvl);
  const tStart = Date.now();
  const timeline=[]; let last=null;
  while(Date.now()-tStart<9000){
    const s = await F.evaluate(([e,cs])=>{ const r=document.querySelector(cs); const m=(r&&r.innerText||'').match(/(\d+) \/ (\d+)/); return {q:eval(e), p:m&&m[0]}; }, [C.cur, C.counter]);
    if(s.q!==last){ timeline.push({ms:Date.now()-tStart, q:s.q, p:s.p}); last=s.q; }
    await sleep(100);
  }
  out[g] = {island, q1, answeredTapped:a.tapped, changeTapped:c.tapped, levelTapped:l2.tapped, msAnswerToRestart: tStart-tA, timeline_no_taps: timeline, errors: ev.filter(e=>!/tencent|tcb|signin/i.test(e.t))};
  console.log(g, JSON.stringify(out[g]));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/s3_stale_${island}.json`, JSON.stringify(out,null,1));
await browser.close(); srv.close(); process.exit(0);
