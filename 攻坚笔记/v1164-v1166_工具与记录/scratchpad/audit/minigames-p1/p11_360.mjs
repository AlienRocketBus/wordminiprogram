// 360px layout checks of game screens (long words) — family + clothes islands
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const W = +(process.argv[3]||360), H = +(process.argv[4]||640);
const ISL = (process.argv[2]||'family').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const overflow = (scope)=>{ const root=document.querySelector(scope)||document.body; const vw=innerWidth, vh=innerHeight; const out=[]; root.querySelectorAll('*').forEach(el=>{ const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden') return; const r=el.getBoundingClientRect(); if(!r.width||!r.height) return; const txt=(el.innerText||'').trim(); if(!txt) return; if(r.right>vw+1||r.left<-1){ let p=el.parentElement, clip=false; while(p&&p!==document.body){ const ps=getComputedStyle(p); if(/hidden|clip/.test(ps.overflowX)){ const pr=p.getBoundingClientRect(); if(pr.right<=vw+1&&pr.left>=-1){clip=true;break;} } p=p.parentElement; } if(!clip) out.push('OUT '+txt.slice(0,30)+' ['+Math.round(r.left)+','+Math.round(r.right)+']'); } if(el.children.length===0 && el.scrollWidth>el.clientWidth+2 && /hidden|clip/.test(s.overflowX)) out.push('CLIP '+txt.slice(0,30)+' sw='+el.scrollWidth+' cw='+el.clientWidth); }); return {doc: document.documentElement.scrollWidth>document.documentElement.clientWidth+1, items:[...new Set(out)].slice(0,10)}; };
for(const key of ISL){
  const {ctx} = await newCtx(browser, port, {width:W, height:H, init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>key);
  const F = await openIsland(page, port, key);
  await sleep(1000);
  const res = {};
  const ov = async (scope)=>F.evaluate((src)=>(0,eval)('('+src+')')(...[]), `()=>(${overflow.toString()})('${scope}')`);
  res.home = await ov('#homeScreen');
  await page.screenshot({path:`${OUT}/shots/w${W}_${key}_home.png`});
  const go = async (code)=>{ await F.evaluate((c)=>{ showScreen('home'); (0,eval)(c); }, code); await sleep(700); };
  // typing hard (longest words)
  await go('showTypingMenu()'); res.typingMenu = await ov('#typingScreen'); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_typing_menu.png`});
  await go('startTyping(3)');
  // jump to the longest word in the pool to check slot fitting
  await F.evaluate(()=>{ let best=0; typePool.forEach((p,i)=>{ if(allW[p].en.length>allW[typePool[best]].en.length) best=i; }); typeIdx=best; nextTypeQ(); });
  await sleep(500);
  res.typingLong = await F.evaluate(()=>{ const ks=[...document.querySelectorAll('.keyboard .key')].map(k=>k.getBoundingClientRect()); const sl=[...document.querySelectorAll('.typing-slot')].map(s=>s.getBoundingClientRect()); return {word:typeWord.en, kbBottom:Math.round(Math.max(...ks.map(r=>r.bottom))), minKeyW:Math.round(Math.min(...ks.map(r=>r.width))), minKeyH:Math.round(Math.min(...ks.map(r=>r.height))), slotsRight:Math.round(Math.max(...sl.map(r=>r.right))), slotsLeft:Math.round(Math.min(...sl.map(r=>r.left))), minSlotW:Math.round(Math.min(...sl.map(r=>r.width))), vw:innerWidth, vh:innerHeight}; });
  res.typingOv = await ov('#typingScreen');
  await page.screenshot({path:`${OUT}/shots/w${W}_${key}_typing_long.png`});
  await F.evaluate(()=>{ stopTyping(); });
  // eagle hard
  await go('startEagle()'); res.eagleMenu = await ov('#eagleScreen'); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_eagle_menu.png`});
  const hasHard = await F.evaluate(()=>!!document.querySelector('#eagleContent [onclick="startEagleLevel(\'hard\')"]'));
  if(hasHard){ await F.evaluate(()=>startEagleLevel('hard')); await sleep(1200); res.eagleHard = await ov('#eagleScreen'); res.eagleCells = await F.evaluate(()=>[...document.querySelectorAll('#eagleGrid .eagle-cell')].map(c=>c.textContent+'@'+c.style.fontSize+(c.scrollWidth>c.clientWidth+1?' OVERFLOW':''))); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_eagle_hard.png`}); }
  await F.evaluate(()=>stopEagle());
  // moles medium
  await go('startMoles()'); await F.evaluate(()=>startMolesLevel('hard')); await sleep(1500); res.moles = await ov('#molesScreen'); res.molesCn = await F.evaluate(()=>[...document.querySelectorAll('.mole-cn')].filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.textContent)); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_moles.png`}); await F.evaluate(()=>stopMoles());
  // fish & bubble hard
  await go('startFish()'); await F.evaluate(()=>startFishLevel('hard')); await sleep(2500); res.fish = await ov('#fishScreen'); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_fish.png`}); await F.evaluate(()=>stopFish());
  await go('startBubble()'); await F.evaluate(()=>startBubbleLevel('hard')); await sleep(1500); res.bubble = await ov('#bubbleScreen'); res.bubbleText = await F.evaluate(()=>[...document.querySelectorAll('#bbArea .bubble')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent+' sw='+b.scrollWidth+' cw='+b.clientWidth)); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_bubble.png`}); await F.evaluate(()=>stopBubble());
  // cloze hard + listen hard
  await go('startCloze()'); await F.evaluate(()=>startClozeLevel('hard')); await sleep(800); res.cloze = await ov('#clozeScreen'); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_cloze.png`}); await F.evaluate(()=>stopCloze());
  await go('startSpeed()'); await F.evaluate(()=>startSpeedLevel('hard')); await sleep(800); res.speed = await ov('#speedScreen'); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_speed.png`}); await F.evaluate(()=>stopSpeed());
  await go("showScreen('explore')"); res.explore = await ov('#exploreScreen');
  await F.evaluate(()=>{ let b=0; allW.forEach((w,i)=>{ if(w.en.length>allW[b].en.length) b=i; }); showWord(b); }); await sleep(900); res.modal = await ov('#wordModal'); await page.screenshot({path:`${OUT}/shots/w${W}_${key}_modal.png`}); await F.evaluate(()=>closeModal());
  // spelling bee keyboard
  await F.evaluate(()=>{ showScreen('home'); HansenSpellBee.open(location.pathname.match(/island_(\w+)/)[1]); });
  let B=null; for(let i=0;i<60;i++){ B=page.frames().find(f=>/spelling_bee\.html/.test(f.url())); if(B){ try{ if(await B.evaluate(()=>!!document.getElementById('startBtn'))) break; }catch(e){} } await sleep(100); }
  await sleep(800);
  res.beeSetup = await B.evaluate((src)=>(0,eval)('('+src+')')('#setup'), overflow.toString());
  await page.screenshot({path:`${OUT}/shots/w${W}_${key}_bee_setup.png`});
  await B.evaluate(()=>document.getElementById('startBtn').click());
  await sleep(2500);
  res.beeGame = await B.evaluate(()=>{ const ks=[...document.querySelectorAll('#kb .key')].map(k=>k.getBoundingClientRect()); return {kbBottom:Math.round(Math.max(...ks.map(r=>r.bottom))), kbTop:Math.round(Math.min(...ks.map(r=>r.top))), minKeyW:Math.round(Math.min(...ks.map(r=>r.width))), vh:innerHeight, docOverflow: document.documentElement.scrollWidth>innerWidth+1}; });
  await page.screenshot({path:`${OUT}/shots/w${W}_${key}_bee_game.png`});
  console.log(key, W+'x'+H, JSON.stringify(res, null, 1));
  console.log('events', JSON.stringify(ev.filter(e=>!/tencentcloudapi|ERR_ABORTED/.test(e.text+(e.loc||'')))).slice(0,800));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
