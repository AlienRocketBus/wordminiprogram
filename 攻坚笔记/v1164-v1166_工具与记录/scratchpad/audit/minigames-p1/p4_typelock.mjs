// Repro: leaving 打字大师 right after finishing a word re-locks the island home (body.type-lock)
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
for(const variant of (process.argv[2]||'wrong,correct').split(',')){
  const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>variant);
  const F = await openIsland(page, port, 'food');
  await F.evaluate(()=>{ window.__spoken=[]; const s=window.speak; window.speak=function(t){ window.__spoken.push({t:String(t), at:Math.round(performance.now()), screen:document.querySelector('.screen.active').id}); return s.apply(this, arguments); }; });
  await sleep(800);
  const t1 = await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/showTypingMenu/.test(e.getAttribute('onclick'))));
  await waitIn(F, ()=>document.querySelector('#typingContent [onclick="startTyping(1)"]'));
  await sleep(300);
  const t2 = await tapIn(page, F, ()=>document.querySelector('#typingContent [onclick="startTyping(1)"]'));
  console.log('taps', JSON.stringify(t1), JSON.stringify(t2), await F.evaluate(()=>document.querySelector('.screen.active').id+' alert='+!!document.querySelector('#alertModal.show')));
  const word = (await waitIn(F, ()=>(typeActive && typeWord && document.querySelector('.keyboard .key')) ? typeWord.en : null)).toLowerCase();
  const keys = await F.evaluate(()=>{ const m={}; document.querySelectorAll('.keyboard .key').forEach(k=>{ const mm=(k.getAttribute('onclick')||'').match(/typeKey\('(.)'\)/); const r=k.getBoundingClientRect(); if(mm) m[mm[1]]={x:r.left+r.width/2,y:r.top+r.height/2}; }); return m; });
  const seq = variant!=='correct' ? word.split('').map(c=>c==='z'?'x':'z') : word.split('');
  for(const c of seq){ await page.touchscreen.tap(keys[c].x, keys[c].y); await sleep(70); }
  // kid immediately taps "← 返回"
  await sleep(250);
  const back = variant==='menu' ? await tapIn(page, F, ()=>[...document.querySelectorAll('#typingContent span')].find(s=>s.innerText==='换难度'), null, {scroll:false}) : await tapIn(page, F, ()=>document.querySelector('#typingScreen .back-btn'), null, {scroll:false});
  await sleep(150);
  const s1 = await F.evaluate(()=>({screen:document.querySelector('.screen.active').id, lock:document.body.classList.contains('type-lock'), typeActive, menu:!!document.querySelector('#typingContent [onclick^="startTyping"]')}));
  await sleep(2600);
  const s2 = await F.evaluate(()=>{ const y0=scrollY; scrollTo(0,800); const can=scrollY>0; scrollTo(0,y0); return {menuShown:!!document.querySelector('#typingContent [onclick^="startTyping"]'), wordShown: !!document.querySelector('#typingContent .keyboard'), timer:(document.getElementById('typeTimer')||{}).textContent, screen:document.querySelector('.screen.active').id, lock:document.body.classList.contains('type-lock'), bodyPos:getComputedStyle(document.body).position, typeActive, canScroll:can, spoken:window.__spoken, bottomNav:(document.querySelector('.bottom-nav')||{}).style?.display}; });
  await page.screenshot({path:`${OUT}/shots/typelock_${variant}.png`});
  // try to scroll the island home like a user (wheel over the iframe)
  await page.mouse.move(195, 500); await page.mouse.wheel(0, 900); await sleep(600);
  s2.afterWheelScrollY = await F.evaluate(()=>scrollY);
  console.log(variant, 'word=',word, 'back tap', JSON.stringify(back), '\n  right after back:', JSON.stringify(s1), '\n  2.6s later:', JSON.stringify(s2));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
