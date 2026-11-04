import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('land8_prog','4'); localStorage.setItem('hansen_freepass_until','1'); localStorage.setItem('hansen_freepass_ver','72'); }catch(e){} };
const {ctx} = await newCtx(browser, port, {init: INIT});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'x');
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
await page.evaluate(()=>openIsland('land_map.html'));
let M=null; for(let i=0;i<100;i++){ M=page.frames().find(f=>/\/land_map\.html/.test(f.url())); if(M){ try{ if(await M.evaluate(()=>document.querySelectorAll('.spot').length>0)) break; }catch(e){} } await sleep(100); }
await sleep(600);
console.log('spot8', await M.evaluate(()=>{ const s=[...document.querySelectorAll('.spot')][7]; return s.className+' | '+s.getAttribute('aria-label')+' | '+s.innerText.replace(/\s+/g,' '); }));
await tapIn(page, M, ()=>[...document.querySelectorAll('.spot')][7], null, {scroll:false}); await sleep(600);
console.log('panel8', await M.evaluate(()=>document.getElementById('pboss').innerText.replace(/\s+/g,' ')+' | foot: '+document.getElementById('pfoot').innerText));
await page.screenshot({path:`${OUT}/shots/land8_prog4_panel.png`});
await tapIn(page, M, ()=>document.querySelector('#pfoot .pbtn.enter')); 
let F=null; for(let i=0;i<150;i++){ F=page.frames().find(f=>f.url().includes('/island_land8.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 3000)){ await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
await tapIn(page, F, ()=>document.querySelector('#homeScreen .daily-card.boss-card')); await sleep(1200);
console.log('island picker', await F.evaluate(()=>document.getElementById('bossContent').innerText.replace(/\s+/g,' ').slice(0,300)));
console.log('freepass active?', await F.evaluate(()=>!!(window.HansenFreepass&&HansenFreepass.active())));
await page.screenshot({path:`${OUT}/shots/land8_prog4_picker.png`});
await browser.close(); srv.close();
