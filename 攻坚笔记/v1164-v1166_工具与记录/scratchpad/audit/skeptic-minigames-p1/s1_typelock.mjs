// MG-01 independent repro: leave 打字大师 right after completing a word
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const variants = (process.argv[2]||'correct,wrong,menu,control').split(',');
const island = process.argv[3]||'school';
const out = {};
for(const v of variants){
  const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; watch(page, ev);
  const F = await openIsland(page, port, island);
  await F.evaluate(()=>{ window.__sp=[]; const s=window.speak; window.speak=function(t){ window.__sp.push({t:String(t).slice(0,30), ms:Math.round(performance.now()), scr:(document.querySelector('.screen.active')||{}).id}); return s.apply(this, arguments); }; });
  const c1 = await tapCard(page, F, /^showTypingMenu/);
  await waitIn(F, ()=>document.querySelector('#typingContent [onclick="startTyping(1)"]'));
  await sleep(400);
  const c2 = await tap(page, F, ()=>document.querySelector('#typingContent [onclick="startTyping(1)"]'));
  const word = await waitIn(F, ()=>(typeActive&&typeWord&&document.querySelector('.keyboard .key'))?typeWord.en.toLowerCase():null);
  const keys = await F.evaluate(()=>{ const m={}; document.querySelectorAll('.keyboard .key').forEach(k=>{ const mm=(k.getAttribute('onclick')||'').match(/typeKey\('(.)'\)/); const r=k.getBoundingClientRect(); if(mm) m[mm[1]]={x:r.left+r.width/2,y:r.top+r.height/2}; }); return m; });
  const fe = await F.frameElement(); const fb = await fe.boundingBox();
  let seq = word.replace(/ /g,'').split('');
  if(v==='wrong') seq = seq.map(c=>c==='q'?'w':'q');
  if(v!=='control'){
    for(const c of seq){ await page.touchscreen.tap(fb.x+keys[c].x, fb.y+keys[c].y); await sleep(90); }
    await sleep(200); // kid taps back 0.2 s after the last letter
  }
  const tBack = Date.now();
  const b = v==='menu'
    ? await tap(page, F, ()=>[...document.querySelectorAll('#typingContent span')].find(s=>s.textContent==='换难度'), null, {scroll:false})
    : await tap(page, F, ()=>document.querySelector('#typingScreen .back-btn'), null, {scroll:false});
  await sleep(150);
  const s1 = await F.evaluate(()=>({scr:document.querySelector('.screen.active').id, lock:document.body.classList.contains('type-lock'), typeActive, menu:!!document.querySelector('#typingContent [onclick^="startTyping"]')}));
  await sleep(2800);
  const s2 = await F.evaluate(()=>({scr:document.querySelector('.screen.active').id, lock:document.body.classList.contains('type-lock'), pos:getComputedStyle(document.body).position, typeActive, menu:!!document.querySelector('#typingContent [onclick^="startTyping"]'), kb:!!document.querySelector('#typingContent .keyboard'), bottomNav:(document.querySelector('.bottom-nav')||{style:{}}).style.display, sp:window.__sp.slice(-4), scrollY}));
  // real touch swipe up over the island page (CDP synthesized touch scroll)
  const cdp = await ctx.newCDPSession(page);
  if(v==='control') await F.evaluate(()=>scrollTo(0,0));
  const y0 = await F.evaluate(()=>scrollY);
  const pts=[700,650,600,550,500,450,400,350,300,250];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:pts[0]}]});
  for(const y of pts.slice(1)){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y}]}); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(900);
  const y1 = await F.evaluate(()=>scrollY);
  await page.screenshot({path:`${OUT}/shots_s1_${v}.png`});
  // can the kid recover? open explore tab then come back home
  out[v] = {island, word, typedBackAfterMs: 200, c1:c1.tapped, c2:c2.tapped, backTapped:b.tapped, right_after_back:s1, after_2_8s:s2, swipeScroll:{before:y0, after:y1}, errors:ev.filter(e=>e.k!=='console.error'||!/tencent|tcb|signin/i.test(e.t))};
  console.log(v, JSON.stringify(out[v]));
  await ctx.close();
}
const fs = await import('node:fs'); fs.writeFileSync(`${OUT}/s1_typelock_${island}.json`, JSON.stringify(out,null,1));
await browser.close(); srv.close(); process.exit(0);
