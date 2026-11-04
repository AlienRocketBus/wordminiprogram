import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const key = process.argv[2]||'traffic';
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){} window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} }); };
const {ctx} = await newCtx(browser, port, {init: INIT});
const page = await ctx.newPage(); const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
const shot = async n=>{ try{ await page.screenshot({path:`${OUT}/shots/gacha_${key}_${n}.png`}); }catch(e){} };
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
if(/^land|season/.test(key)) await page.evaluate(k=>openIsland('island_'+k+'.html'), key); else await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
let F=null; for(let i=0;i<120;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 3000)){ await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
await F.evaluate(()=>HansenCoins.add(2200)); await sleep(300);
const c0 = await F.evaluate(()=>HansenCoins.get());
tag='open';
await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/HansenContextGacha/.test(e.getAttribute('onclick')||'')));
await sleep(900);
const land = await F.evaluate(()=>{ const e=document.getElementById('landGachaScreen'); return !!e && e.style.display!=='none'; });
const sel = land ? ()=>document.querySelector('#landGachaScreen [onclick="window.HansenLandGachaUI.draw()"]') : ()=>document.querySelector('#gachaScreen .gacha-draw-btn');
const before = await F.evaluate((land)=> land ? document.getElementById('landGachaScreen').innerText.match(/已收集\s*\d+\s*\/\s*\d+/)?.[0] : document.getElementById('gachaScreen').innerText.match(/已收集\s*\d+\s*\/\s*\d+/)?.[0], land);
for(let d=0; d<2; d++){
  tag='draw'+d;
  const t = await tapIn(page, F, sel); 
  await sleep(1200); await shot('reveal'+d);
  // reveal overlays: find fixed full-screen overlays & buttons
  const ov = await F.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el); if(s.position!=='fixed'||s.display==='none'||+s.opacity<0.05||s.pointerEvents==='none') return false; const r=el.getBoundingClientRect(); return r.width*r.height>innerWidth*innerHeight*0.5 && +s.zIndex>=9000;}).map(el=>(el.id||String(el.className).slice(0,30))+' z='+getComputedStyle(el).zIndex+' btns='+[...el.querySelectorAll('button,[onclick]')].filter(b=>b.offsetParent).map(b=>(b.innerText||'').trim().slice(0,10)).slice(0,4).join('/')));
  console.log('draw', d, 'tap', t.ok, 'overlays', JSON.stringify(ov));
  // tap through reveal: tap any visible button matching 收下/继续/确定/好/知道 or tap center
  for(let k=0;k<6;k++){
    const b = await F.evaluate(()=>{ const bs=[...document.querySelectorAll('button,[onclick]')].filter(x=>x.offsetParent && /^(收下|继续|确定|好的|知道|太棒|领取|点击|翻开|收入)/.test((x.innerText||'').trim())); return bs.length? (bs[bs.length-1].innerText||'').trim().slice(0,12) : null; });
    if(!b){ break; }
    await tapIn(page, F, (t)=>{ const bs=[...document.querySelectorAll('button,[onclick]')].filter(x=>x.offsetParent && (x.innerText||'').trim().slice(0,12)===t); return bs[bs.length-1]; }, b, {scroll:false});
    console.log('  tapped', b); await sleep(900);
  }
  await sleep(1500);
}
const after = await F.evaluate((land)=> land ? document.getElementById('landGachaScreen').innerText.match(/已收集\s*\d+\s*\/\s*\d+/)?.[0] : document.getElementById('gachaScreen').innerText.match(/已收集\s*\d+\s*\/\s*\d+/)?.[0], land);
const c1 = await F.evaluate(()=>HansenCoins.get());
console.log('land', land, 'coins', c0, '->', c1, 'collected', before, '->', after);
await shot('after');
const stuck = await F.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el); if(s.position!=='fixed'||s.display==='none'||+s.opacity<0.05||s.pointerEvents==='none') return false; const r=el.getBoundingClientRect(); return r.width*r.height>innerWidth*innerHeight*0.5 && +s.zIndex>=9000;}).map(el=>(el.id||String(el.className).slice(0,30))+' z='+getComputedStyle(el).zIndex));
console.log('overlays after', JSON.stringify(stuck));
console.log('EVENTS', JSON.stringify(ev.filter(e=>!/ERR_FAILED|__rt=/.test(e.text) && e.kind!=='requestfailed').slice(0,10)));
await browser.close(); srv.close();
