// Real path: home → 星海觉醒 banner → land_map → spot N → 进入学习 → island_landN → 听音辨义; back flows; empress.
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const N = +(process.argv[2]||3); const W = +(process.argv[3]||390);
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} }); };
const {ctx} = await newCtx(browser, port, {init: INIT, width:W});
const page = await ctx.newPage(); const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
const shot = async n=>{ try{ await page.screenshot({path:`${OUT}/shots/lm_${N}_${W}_${n}.png`}); }catch(e){} };
const log=(...a)=>console.log(...a);
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1800);
tag='banner';
const bar = await waitIn(page.mainFrame(), ()=>!!document.getElementById('hsnSeasonBar'), null, 5000);
log('banner present', bar);
let t = await tapIn(page, page.mainFrame(), ()=>document.getElementById('hsnSeasonBar'));
log('banner tap', JSON.stringify(t));
let M=null; for(let i=0;i<100;i++){ M=page.frames().find(f=>/\/land_map\.html/.test(f.url()) && f.parentFrame()===page.mainFrame()); if(M){ try{ if(await M.evaluate(()=>document.querySelectorAll('.spot').length>0)) break; }catch(e){} } await sleep(100); }
log('land_map frame', !!M, M&&M.url());
const frameInfo = await page.evaluate(()=>{ const f=document.getElementById('islandFrame'); const r=f.getBoundingClientRect(); return {src:f.getAttribute('src'), w:r.width, h:r.height, wrap:getComputedStyle(document.getElementById('islandFrameWrap')).display}; });
log('islandFrame', JSON.stringify(frameInfo));
await sleep(800); await shot('map');
// spot geometry: overlap & offscreen checks
const geo = await M.evaluate(()=>{ const out=[]; const sp=[...document.querySelectorAll('.spot')]; const rs=sp.map(s=>{ const n=s.querySelector('.name'); const r=(n||s).getBoundingClientRect(); return {id:s.id||s.getAttribute('aria-label').slice(0,8), l:Math.round(r.left), r:Math.round(r.right), t:Math.round(r.top), b:Math.round(r.bottom)}; });
  for(let i=0;i<rs.length;i++) for(let j=i+1;j<rs.length;j++){ const a=rs[i], b=rs[j]; if(a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b) out.push('overlap '+a.id+' / '+b.id); }
  rs.forEach(r=>{ if(r.l<0||r.r>innerWidth||r.t<0||r.b>innerHeight) out.push('offscreen '+r.id+' '+JSON.stringify(r)); });
  return {vw:innerWidth, vh:innerHeight, n:sp.length, out, ptext:(document.getElementById('ptext')||{}).textContent, docW:document.documentElement.scrollWidth}; });
log('map geo', JSON.stringify(geo));
tag='spot';
t = await tapIn(page, M, (n)=>[...document.querySelectorAll('.spot')].find(s=>s.querySelector('.num') && s.getAttribute('aria-label').indexOf('，30个单词')>0 && [...document.querySelectorAll('.spot')].indexOf(s)===n-1), N, {scroll:false});
log('spot tap', JSON.stringify(t));
const panel = await waitIn(M, ()=>document.getElementById('overlay').classList.contains('show') ? document.getElementById('panel').innerText.replace(/\s+/g,' ').slice(0,500) : null, null, 3000);
log('panel', panel); await shot('panel');
tag='enter';
t = await tapIn(page, M, ()=>document.querySelector('#pfoot .pbtn.enter'));
log('enter tap', JSON.stringify(t));
let F=null; for(let i=0;i<150;i++){ F=page.frames().find(f=>f.url().includes('/island_land'+N+'.html') && f.parentFrame()===page.mainFrame()); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
log('land island frame', !!F, F&&F.url());
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 3000)){ const w=await F.evaluate(()=>document.getElementById('alertInner').innerText.replace(/\s+/g,' ')); log('welcome', w); await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
const head = await F.evaluate(()=>{ const h=document.querySelector('#homeScreen'); return h.innerText.replace(/\s+/g,' ').slice(0,300); });
log('island home head', head); await shot('island');
tag='listen';
t = await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>(e.getAttribute('onclick')||'')==='startListen()'));
log('listen card tap', JSON.stringify(t));
await sleep(600);
const lv = await F.evaluate(()=>[...document.querySelectorAll('#listenContent [onclick^="startListenLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
log('listen levels', JSON.stringify(lv)); await shot('listen_levels');
t = await tapIn(page, F, ()=>document.querySelector('#listenContent [onclick="startListenLevel(\'easy\')"]'));
await sleep(1500);
const ls = await F.evaluate(()=>({active:listenActive, q: listenQ && listenQ.word && listenQ.word.en, content:(document.getElementById('listenContent')||{}).innerText.replace(/\s+/g,' ').slice(0,200), screen:document.querySelector('.screen.active').id}));
log('after easy tap', JSON.stringify(ls)); await shot('listen_easy');
// back to island home, then island back (goHome) -> should go to land_map
tag='back';
await tapIn(page, F, ()=>document.querySelector('#listenScreen .back-btn'));
await sleep(500);
t = await tapIn(page, F, ()=>document.querySelector('.world-map-btn'));
log('world-map-btn tap', JSON.stringify(t));
await sleep(2500);
const fr2 = await page.evaluate(()=>{ const f=document.getElementById('islandFrame'); let p=''; try{ p=f.contentWindow.location.pathname; }catch(e){} return {path:p, wrap:getComputedStyle(document.getElementById('islandFrameWrap')).display}; });
log('after island back', JSON.stringify(fr2));
M=page.frames().find(f=>/\/land_map\.html/.test(f.url()) && f.parentFrame()===page.mainFrame());
if(M){ await sleep(500); const pt = await M.evaluate(()=>{ const sp=[...document.querySelectorAll('.spot')]; return {ptext:document.getElementById('ptext').textContent}; }); log('map after back', JSON.stringify(pt));
  // empress
  t = await tapIn(page, M, ()=>document.getElementById('empress'), null, {scroll:false}); await sleep(500);
  log('empress panel', await M.evaluate(()=>document.getElementById('overlay').classList.contains('show')?document.getElementById('panel').innerText.replace(/\s+/g,' ').slice(0,300):'NOT SHOWN'));
  await shot('empress');
  await tapIn(page, M, ()=>document.querySelector('#pfoot .pbtn'), null, {scroll:false}); await sleep(400);
  log('panel closed', await M.evaluate(()=>!document.getElementById('overlay').classList.contains('show')));
  // map back to home
  const backEl = await M.evaluate(()=>{ const b=[...document.querySelectorAll('button,a,[onclick]')].find(e=>/goBack/.test(e.getAttribute('onclick')||'')||/返回/.test(e.innerText||'')); return b?(b.outerHTML.slice(0,160)):null; });
  log('map back el', backEl);
  t = await tapIn(page, M, ()=>[...document.querySelectorAll('button,a,[onclick]')].find(e=>/goBack/.test(e.getAttribute('onclick')||'')||/返回/.test(e.innerText||'')), null, {scroll:false});
  log('map back tap', JSON.stringify(t)); await sleep(1200);
  const fr3 = await page.evaluate(()=>({wrap:getComputedStyle(document.getElementById('islandFrameWrap')).display, y:scrollY, url:location.pathname+location.search+location.hash}));
  log('after map back', JSON.stringify(fr3)); await shot('home_after');
}
log('EVENTS', JSON.stringify(ev.filter(e=>!/__rt=/.test(e.text)).slice(0,40), null, 0));
await browser.close(); srv.close();
