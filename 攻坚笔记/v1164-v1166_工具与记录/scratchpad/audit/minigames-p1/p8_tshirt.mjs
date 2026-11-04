// Check: clothes island 打字大师 高级 contains "T-shirt" — can a kid type it with the on-screen keys?
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'t');
const F = await openIsland(page, port, 'clothes');
await sleep(1000);
await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/showTypingMenu/.test(e.getAttribute('onclick'))));
await waitIn(F, ()=>document.querySelector('#typingContent [onclick="startTyping(3)"]'));
await tapIn(page, F, ()=>document.querySelector('#typingContent [onclick="startTyping(3)"]'));
let seen=[];
for(let q=0;q<12;q++){
  const w = await waitIn(F, ()=> (typeActive && typeWord && document.querySelector('.keyboard .key') && !document.getElementById('typeCompare')) ? {en:typeWord.en, idx:typeIdx, n:typePool.length} : (!document.querySelector('#typingContent .keyboard')?'DONE':null), null, 6000);
  if(!w||w==='DONE') break;
  const keys = await F.evaluate(()=>{ const m={}; document.querySelectorAll('.keyboard .key').forEach(k=>{ const mm=(k.getAttribute('onclick')||'').match(/typeKey\('(.)'\)/); const r=k.getBoundingClientRect(); if(mm) m[mm[1]]={x:r.left+r.width/2,y:r.top+r.height/2}; }); return m; });
  const tgt = w.en.toLowerCase();
  let missing=[];
  for(const c of tgt){ if(c===' ') continue; const k=keys[c]; if(!k){ missing.push(c); continue; } await page.touchscreen.tap(k.x,k.y); await sleep(70); }
  await sleep(300);
  const st = await F.evaluate(()=>({cmp:(document.getElementById('typeCompare')||{}).innerText||'', slots:[...document.querySelectorAll('.typing-slot')].map(s=>s.textContent+(s.classList.contains('wrong')?'!':'')).join('')}));
  seen.push({en:w.en, missing, result: st.cmp ? 'WRONG '+st.cmp.replace(/\s+/g,' ') : 'ok', slots: st.slots});
  if(w.en==='T-shirt') await page.screenshot({path:`${OUT}/shots/clothes_tshirt.png`});
  await waitIn(F, (i)=>typeIdx!==i || !document.querySelector('#typingContent .keyboard'), w.idx, 5000);
}
console.log(JSON.stringify(seen,null,1));
const res = await F.evaluate(()=>document.getElementById('typingContent').innerText.replace(/\s+/g,' ').slice(0,400));
console.log('result:', res);
await browser.close(); srv.close(); process.exit(0);
