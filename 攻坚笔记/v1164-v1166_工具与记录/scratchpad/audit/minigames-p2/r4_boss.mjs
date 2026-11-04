// Boss battle flow on a template island and a land island: real taps, some wrong, one timeout.
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
import fs from 'node:fs';
const key = process.argv[2]||'sports';
const DO_TIMEOUT = process.argv[3]==='timeout';
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} }); };
const {ctx} = await newCtx(browser, port, {init: INIT});
const page = await ctx.newPage(); const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
const R = {key, notes:[]}; const note=s=>{R.notes.push(s); console.log('NOTE',s);};
const shot = async n=>{ try{ await page.screenshot({path:`${OUT}/shots/boss_${key}_${n}.png`}); }catch(e){} };
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
if(/^land|season/.test(key)) await page.evaluate(k=>openIsland('island_'+k+'.html'), key);
else await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
let F=null; for(let i=0;i<120;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
const st0 = await waitIn(F, ()=>document.getElementById('hsnStoryClose')?'story':(document.querySelector('#alertModal.show')?'alert':null), null, 3000);
if(st0==='story'){ await sleep(900); await tapIn(page,F,()=>document.getElementById('hsnStoryClose')); await sleep(800); }
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 2000)){ await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
const before = await F.evaluate(()=>({coins: window.HansenCoins?HansenCoins.get():null, xp:S.totalXP, level:S.level, bossBeaten:S.stats.bossBeaten, prog:localStorage.getItem((location.pathname.match(/island_(land\d)/)||[])[1]+'_prog')}));
R.before = before;
tag='open';
await F.evaluate(()=>{ if(document.querySelector('.screen.active').id!=='homeScreen') showScreen('home'); });
let t = await tapIn(page, F, ()=>document.querySelector('#homeScreen .daily-card.boss-card'));
note('boss card tap '+JSON.stringify(t));
const pick = await waitIn(F, ()=>{ const b=document.getElementById('bossContent'); return document.querySelector('#bossScreen.active') && b && b.innerText.trim().length>10 ? b.innerText.replace(/\s+/g,' ').slice(0,400) : null; }, null, 5000);
R.picker = pick; await shot('picker');
const ZI = +(process.argv[4]||0);
const fightSel = /^land/.test(key) ? (()=>document.querySelector('[onclick="window.__hsnZoneFight(__ZI__)"]')).toString().replace('__ZI__',ZI) : ()=>document.querySelector('[onclick^="hansenStartRebattle(1)"]');
t = await tapIn(page, F, typeof fightSel==='string' ? (0,eval)(fightSel) : fightSel); note('fight tap '+JSON.stringify(t));
tag='fight';
let q=0, right=0, wrong=0, tmo=0, waits=[], types={};
const t0=Date.now();
while(Date.now()-t0 < 360000){
  const s = await waitIn(F, ()=>{ const c=document.getElementById('bossContent'); const txt=c?c.innerText:''; if(/VICTORY|胜利|击败了|失败|DEFEAT|再接再厉/.test(txt) && !document.querySelector('#bossOpts .boss-opt')) return {end:txt.replace(/\s+/g,' ').slice(0,500)};
    const o=document.getElementById('bossOpts'); if(!o||o.dataset.done) return null; const opts=[...o.querySelectorAll('.boss-opt')].filter(e=>e.offsetParent); if(opts.length<2) { if(document.querySelector('#bossOpts .bts-row')) return {typing:true, en:(window._bossWord||{}).en, qt:window._bossQType}; return null; }
    return {n:opts.length, ci:window._bossCorrectIdx, qt:window._bossQType, en:(window._bossWord||{}).en, texts:opts.map(e=>e.innerText.trim()).slice(0,4), bhp:(document.getElementById('bossHPText')||{}).innerText, hhp:(document.getElementById('heroHPText')||{}).innerText}; }, null, 70000);
  if(!s){ note('no question/end within 70s at q='+q+' content='+(await F.evaluate(()=>(document.getElementById('bossContent')||{}).innerText||'')).replace(/\s+/g,' ').slice(0,300)); await shot('stuck'); break; }
  if(s.end){ R.end=s.end; break; }
  types[s.qt]=(types[s.qt]||0)+1;
  if(q===0) await shot('q0');
  if(s.typing){ note('typing question '+s.en); const keys = await F.evaluate(()=>{ const m={}; document.querySelectorAll('#btsKbd .key[data-k]').forEach(k=>{ const r=k.getBoundingClientRect(); m[k.getAttribute('data-k')]={x:r.left+r.width/2,y:r.top+r.height/2}; }); return m; }); 
    const fe=await F.frameElement(); const bb=await fe.boundingBox(); for(const c of s.en.toLowerCase().replace(/ /g,'')){ const k=keys[c]; if(k){ await page.touchscreen.tap(bb.x+k.x, bb.y+k.y); await sleep(80);} } q++; right++; await sleep(1500); continue; }
  if(DO_TIMEOUT && q===4){ const tw=Date.now(); const adv = await waitIn(F, (en)=>{ const o=document.getElementById('bossOpts'); return (o && o.dataset.done) || ((window._bossWord||{}).en!==en) ? true : null; }, s.en, 75000); note('timeout test: advanced='+!!adv+' after '+(Date.now()-tw)+'ms hero '+(await F.evaluate(()=>(document.getElementById('heroHPText')||{}).innerText))); tmo++; q++; await sleep(1500); continue; }
  const doWrong = (q===1||q===3);
  const idx = doWrong ? (s.ci+1)%s.n : s.ci;
  // sanity: correct option text should match word
  const tp = await tapIn(page, F, (i)=>[...document.querySelectorAll('#bossOpts .boss-opt')].filter(e=>e.offsetParent)[i], idx, {scroll:false});
  if(!tp.ok){ note('opt tap blocked q='+q+' '+tp.hit); await shot('blocked_'+q); }
  doWrong?wrong++:right++; q++;
  const tq=Date.now();
  await waitIn(F, (en)=>{ const o=document.getElementById('bossOpts'); return (!o||!o.dataset.done||((window._bossWord||{}).en!==en))?true:null; }, s.en, 8000);
  waits.push(Date.now()-tq);
}
R.dismissed=[];
for(let k=0;k<5;k++){ await sleep(900); const d = await F.evaluate(()=>{ const bs=[...document.querySelectorAll('button,[onclick]')].filter(b=>b.offsetParent && /^(收下|知道了|好的|确定|继续|太棒了|领取)/.test((b.innerText||'').trim())); const b=bs.find(x=>{ let p=x; while(p&&p!==document.body){ const s=getComputedStyle(p); if(s.position==='fixed'&&+s.zIndex>=1000) return true; p=p.parentElement; } return false; }); return b?(b.innerText||'').trim().slice(0,20):null; });
  if(!d) break; R.dismissed.push(d); await tapIn(page, F, (t)=>[...document.querySelectorAll('button,[onclick]')].find(b=>b.offsetParent && (b.innerText||'').trim().slice(0,20)===t), d, {scroll:false}); }
R.played={q,right,wrong,tmo,types,secs:Math.round((Date.now()-t0)/1000), maxWait:Math.max(0,...waits)};
await sleep(1500); await shot('end');
R.endScreen = await F.evaluate(()=>(document.getElementById('bossContent')||{}).innerText.replace(/\s+/g,' ').slice(0,600));
R.overlays = await F.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el); if(s.position!=='fixed'||s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05||s.pointerEvents==='none') return false; const r=el.getBoundingClientRect(); return r.width*r.height>innerWidth*innerHeight*0.3;}).map(el=>(el.id||el.className||el.tagName).toString().slice(0,50)+' z='+getComputedStyle(el).zIndex));
const after = await F.evaluate(()=>({coins: window.HansenCoins?HansenCoins.get():null, xp:S.totalXP, level:S.level, bossBeaten:S.stats.bossBeaten, prog:localStorage.getItem((location.pathname.match(/island_(land\d)/)||[])[1]+'_prog'), cleared: (location.pathname.match(/island_land(\d)/)||[])[1] ? localStorage.getItem('hsn_landmap_cleared_'+location.pathname.match(/island_land(\d)/)[1]) : null}));
R.after = after;
console.log(JSON.stringify(R,null,1));
// back to island home
tag='back';
const backBtns = await F.evaluate(()=>[...document.querySelectorAll('#bossContent button, #bossContent [onclick], #bossScreen > .back-btn')].filter(e=>e.offsetParent).map(e=>(e.innerText||'').trim().slice(0,20)+' :: '+(e.getAttribute('onclick')||'').slice(0,80)));
console.log('end buttons', JSON.stringify(backBtns));
// ---- card book -> boss hall (only template islands; land uses land cardbook) ----
tag='hall';
const H = {};
try{
  await F.evaluate(()=>{ if(document.querySelector('.screen.active').id==='bossScreen' && typeof stopBoss==='function'){} });
  let tt = await tapIn(page, F, ()=>document.getElementById('navCards'), null, {scroll:false});
  H.navTap = tt; await sleep(1200);
  H.cardsText = await F.evaluate(()=>{ const a=document.querySelector('.screen.active'); return a.id+' :: '+a.innerText.replace(/\s+/g,' ').slice(0,300); });
  const sel = /^land/.test(key) ? ()=>document.querySelector('[onclick^="window.__hsnOpenLandHall"],[onclick*="__hsnOpenLandHall"]') : ()=>document.querySelector('[onclick^="hansenShowCardDetail("]');
  tt = await tapIn(page, F, sel); H.cardTap = tt;
  let B=null; for(let i=0;i<80;i++){ B=page.frames().find(f=>/boss_hall\.html/.test(f.url())); if(B){ try{ if(await B.evaluate(()=>document.readyState==='complete')) break; }catch(e){} } await sleep(100); }
  H.hallFrame = B ? B.url() : null;
  if(B){ await sleep(1500); await page.screenshot({path:`${OUT}/shots/boss_${key}_hall.png`});
    H.hallText = await B.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,300));
    H.hallOverflow = await B.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    H.imgs = await B.evaluate(()=>[...document.images].filter(i=>i.complete && i.naturalWidth===0 && i.src).map(i=>i.src).slice(0,5));
    // tap the card (zoom) then close
    const z = await tapIn(page, B, ()=>document.getElementById('hallwrap')||document.querySelector('.card'));
    await sleep(800); H.zoomShown = await B.evaluate(()=>{ const z=document.getElementById('zoom'); return z?z.classList.contains('show'):null; });
    await page.screenshot({path:`${OUT}/shots/boss_${key}_hall_zoom.png`});
    if(H.zoomShown){ await tapIn(page, B, ()=>document.getElementById('closePg')||document.getElementById('zbd'), null, {scroll:false}); await sleep(500); H.zoomClosed = await B.evaluate(()=>!document.getElementById('zoom').classList.contains('show')); }
    // close the hall
    const cx = await tapIn(page, F, ()=>{ const m=document.getElementById('__hsn_bosshall')||document.getElementById('__hsn_landhall'); return m && [...m.children].find(c=>c.tagName!=='IFRAME'); }, null, {scroll:false});
    H.closeTap = cx; await sleep(600);
    H.hallGone = await F.evaluate(()=>!document.getElementById('__hsn_bosshall') && !document.getElementById('__hsn_landhall'));
  }
}catch(e){ H.err = String(e.message||e).slice(0,300); }
console.log('HALL', JSON.stringify(H,null,1));
if(/^land(\d)/.test(key)){
  const n = +key.slice(4);
  await page.evaluate(()=>openIsland('land_map.html'));
  let M=null; for(let i=0;i<100;i++){ M=page.frames().find(f=>/\/land_map\.html/.test(f.url()) && f.parentFrame()===page.mainFrame()); if(M){ try{ if(await M.evaluate(()=>document.querySelectorAll('.spot').length>0)) break; }catch(e){} } await sleep(100); }
  await sleep(800);
  const spot = await M.evaluate((n)=>{ const s=[...document.querySelectorAll('.spot')][n-1]; return {cls:s.className, label:s.getAttribute('aria-label'), ptext:document.getElementById('ptext').textContent}; }, n);
  await tapIn(page, M, (n)=>[...document.querySelectorAll('.spot')][n-1], n, {scroll:false}); await sleep(600);
  spot.panel = await M.evaluate(()=>document.getElementById('pboss').innerText.replace(/\s+/g,' ')+' | '+document.getElementById('pfoot').innerText);
  await page.screenshot({path:`${OUT}/shots/boss_${key}_map_after.png`});
  console.log('MAP AFTER', JSON.stringify(spot));
  H.mapAfter = spot;
}
fs.writeFileSync(`${OUT}/boss_${key}.json`, JSON.stringify({R, backBtns, H, ev},null,1));
console.log('EVENTS', JSON.stringify(ev.filter(e=>e.kind!=='http404'||!/__rt=/.test(e.text)).slice(0,30),null,0));
await browser.close(); srv.close();
