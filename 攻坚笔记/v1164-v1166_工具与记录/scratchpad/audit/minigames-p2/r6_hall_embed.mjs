// Card book → 神秘殿堂 panel → season legend card → season_showcase iframe → close; and season boss card → boss_hall?season
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const key = process.argv[2]||'time'; const W=+(process.argv[3]||390);
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} }); };
const {ctx} = await newCtx(browser, port, {init: INIT, width:W});
const page = await ctx.newPage(); const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
const shot = async n=>{ try{ await page.screenshot({path:`${OUT}/shots/he_${key}_${W}_${n}.png`}); }catch(e){} };
const log=(...a)=>console.log(...a);
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
let F=null; for(let i=0;i<120;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 3000)){ await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
tag='cards';
let t = await tapIn(page, F, ()=>document.getElementById('navCards'), null, {scroll:false}); await sleep(1000);
log('cards screen', await F.evaluate(()=>document.querySelector('.screen.active').id));
await shot('cards');
const ovf = await F.evaluate(()=>{ const out=[]; document.querySelectorAll('#cardsScreen *').forEach(el=>{ const r=el.getBoundingClientRect(); if(r.width&&(r.right>innerWidth+2||r.left<-2)&&(el.innerText||'').trim()&&el.children.length===0) out.push((el.innerText||'').trim().slice(0,20)+'['+Math.round(r.left)+','+Math.round(r.right)+']'); }); return {docW:document.documentElement.scrollWidth, vw:innerWidth, out:out.slice(0,8)}; });
log('cards overflow', JSON.stringify(ovf));
t = await tapIn(page, F, ()=>document.querySelector('#cardsScreen [onclick*="__hsnOpenHall"]'));
log('hall entry tap', JSON.stringify(t)); await sleep(900);
const panel = await F.evaluate(()=>{ const p=document.getElementById('__hs_hall_panel'); return p? p.innerText.replace(/\s+/g,' ').slice(0,400) : null; });
log('hall panel', panel); await shot('hallpanel');
tag='showcase';
t = await tapIn(page, F, ()=>document.querySelector('#__hs_hall_panel .__hs_gcard'));
log('legend card tap', JSON.stringify(t));
let S=null; for(let i=0;i<80;i++){ S=page.frames().find(f=>/season_showcase\.html/.test(f.url())); if(S){ try{ if(await S.evaluate(()=>document.readyState==='complete')) break; }catch(e){} } await sleep(100); }
log('showcase frame', S&&S.url());
if(S){ await sleep(1500); await shot('showcase'); log('showcase text', await S.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,200)));
  // close via parent ×
  t = await tapIn(page, F, ()=>{ const m=document.getElementById('__hs_showcase'); return m && [...m.children].find(c=>c.tagName!=='IFRAME'); }, null, {scroll:false});
  await sleep(500); log('showcase closed', await F.evaluate(()=>!document.getElementById('__hs_showcase')), JSON.stringify(t));
}
tag='seasonboss';
const bc = await F.evaluate(()=>document.querySelectorAll('#__hs_hall_panel .__hs_bcard').length);
log('season boss cards', bc);
if(bc){ t = await tapIn(page, F, ()=>document.querySelector('#__hs_hall_panel .__hs_bcard')); await sleep(400);
  let B=null; for(let i=0;i<80;i++){ B=page.frames().find(f=>/boss_hall\.html/.test(f.url())); if(B){ try{ if(await B.evaluate(()=>document.readyState==='complete')) break; }catch(e){} } await sleep(100); }
  log('season boss hall', B&&B.url()); if(B){ await sleep(1200); await shot('seasonhall'); log('text', await B.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,160)));
    t = await tapIn(page, F, ()=>{ const m=document.getElementById('__hs_showcase'); return m && [...m.children].find(c=>c.tagName!=='IFRAME'); }, null, {scroll:false}); await sleep(400);
    log('closed', await F.evaluate(()=>!document.getElementById('__hs_showcase'))); }
}
// close hall panel
t = await tapIn(page, F, ()=>document.getElementById('__hs_hall_close'), null, {scroll:false}); await sleep(400);
log('hall panel closed', await F.evaluate(()=>!document.getElementById('__hs_hall_panel')));
// land cardbook entry from regular island cards screen
tag='landbook';
const lb = await F.evaluate(()=>[...document.querySelectorAll('#cardsScreen [onclick]')].map(e=>(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,30)+' :: '+(e.getAttribute('onclick')||'').slice(0,70)).filter(s=>/大陆/.test(s)));
log('land entries on cards screen', JSON.stringify(lb));
log('EVENTS', JSON.stringify(ev.filter(e=>!/__rt=/.test(e.text)).slice(0,30)));
await browser.close(); srv.close();
