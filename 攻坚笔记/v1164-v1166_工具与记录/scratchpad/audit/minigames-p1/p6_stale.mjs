// Repro: stale "next question" timers from the previous run fire after the kid switches difficulty
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const GAMES = (process.argv[2]||'listen,cloze,bubble').split(',');
for(const g of GAMES){
  const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>g);
  const F = await openIsland(page, port, 'animal');
  await sleep(900);
  const cfg = {
    listen:{card:'startListen()', lvl:'startListenLevel', q:()=>listenQ&&!listenQ.answered&&document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length===4 ? listenQ.word.en : null, ans:()=>{ const i=listenQ.opts.findIndex(o=>o.cn===listenQ.word.cn); return document.querySelectorAll('#listenScreen .listen-opts .boss-opt')[i]; }, sw:()=>[...document.querySelectorAll('#listenContent span')].find(s=>s.innerText==='换难度'), cur:()=>listenQ&&listenQ.word.en, prog:()=>(document.getElementById('listenContent').innerText.match(/(\d+)\s*\/\s*(\d+)/)||[]).slice(1,3).join('/')},
    cloze:{card:'startCloze()', lvl:'startClozeLevel', q:()=>clozeActive&&clozeQ&&!document.querySelector('#clozeScreen .cloze-opt[data-done]') ? clozeQ.word.en : null, ans:()=>{ const i=clozeQ.opts.findIndex(o=>o.en===clozeQ.word.en); return document.querySelectorAll('#clozeScreen .cloze-opt')[i]; }, sw:()=>[...document.querySelectorAll('#clozeContent span')].find(s=>s.innerText==='换难度'), cur:()=>clozeQ&&clozeQ.word.en, prog:()=>(document.getElementById('clozeContent').innerText.match(/(\d+)\s*\/\s*(\d+)/)||[]).slice(1,3).join('/')},
    bubble:{card:'startBubble()', lvl:'startBubbleLevel', q:()=>bubbleActive&&bubbleTarget&&!window.bubbleLocked&&document.querySelectorAll('#bbArea .bubble').length>=5 ? bubbleTarget.en : null, ans:()=>[...document.querySelectorAll('#bbArea .bubble')].find(b=>b.dataset.en===bubbleTarget.en), sw:()=>[...document.querySelectorAll('#bubbleContent button')].find(b=>/换难度/.test(b.innerText)), cur:()=>bubbleTarget&&bubbleTarget.en, prog:()=>(document.getElementById('bbPrompt')||{}).innerText},
  }[g];
  let ta; for(let a=0;a<4;a++){ ta = await tapIn(page, F, (oc)=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>e.getAttribute('onclick')===oc), cfg.card); if(ta.ok) break; console.log('retry card, hit', ta.hit, await F.evaluate(([x,y])=>{const h=document.elementFromPoint(x,y); return h? h.outerHTML.slice(0,200)+' parent='+(h.parentElement&&h.parentElement.outerHTML.slice(0,120)):null}, [ta.x, ta.y])); await sleep(800); }
  await waitIn(F, (l)=>document.querySelector('[onclick="'+l+'(\'easy\')"]'), cfg.lvl);
  await sleep(400);
  const tb = await tapIn(page, F, (l)=>document.querySelector('[onclick="'+l+'(\'easy\')"]'), cfg.lvl);
  const q0 = await waitIn(F, cfg.q);
  console.log(g, 'card', JSON.stringify(ta), 'level', JSON.stringify(tb), 'q0', q0);
  if(!q0){ await ctx.close(); continue; }
  await sleep(300);
  await tapIn(page, F, cfg.ans, null, {scroll:false});         // answer correctly
  await sleep(250);
  const sw = await tapIn(page, F, cfg.sw);                       // kid taps 换难度 right away
  await waitIn(F, (l)=>document.querySelector('[onclick="'+l+'(\'easy\')"]'), cfg.lvl, 3000);
  await tapIn(page, F, (l)=>document.querySelector('[onclick="'+l+'(\'easy\')"]'), cfg.lvl);  // and restarts 初级
  const first = await waitIn(F, cfg.q, null, 4000);
  const p0 = await F.evaluate(cfg.prog);
  const log=[]; const t0=Date.now();
  while(Date.now()-t0<9000){ const c = await F.evaluate(cfg.cur); const p = await F.evaluate(cfg.prog); if(!log.length || log[log.length-1].c!==c) log.push({ms:Date.now()-t0, c, p:String(p).replace(/\s+/g,' ').slice(0,40)}); await sleep(100); }
  console.log(g, 'switch tap', JSON.stringify(sw), '\n  new run first question', first, 'progress', p0, '\n  question timeline with NO taps:', JSON.stringify(log));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
