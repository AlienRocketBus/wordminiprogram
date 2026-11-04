import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){} };
const {ctx} = await newCtx(browser, port, {init: INIT});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'x');
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
await tapIn(page, page.mainFrame(), ()=>document.querySelector('a[href="island_traffic.html"]'));
let F=null; for(let i=0;i<120;i++){ F=page.frames().find(f=>f.url().includes('/island_traffic.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 3000)){ await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
await tapIn(page, F, ()=>document.querySelector('#homeScreen .daily-card.boss-card')); await sleep(1200);
await tapIn(page, F, ()=>document.querySelector('[onclick^="hansenStartRebattle(1)"]'));
await waitIn(F, ()=>document.querySelectorAll('#bossOpts .boss-opt').length>=2, null, 8000); await sleep(1500);
const hp0 = await F.evaluate(()=>({hero:(document.getElementById('heroHPText')||{}).innerText, q:(document.getElementById('bossQ')||{}).innerText}));
console.log('in fight', JSON.stringify(hp0));
await tapIn(page, F, ()=>document.querySelector('#bossScreen > .back-btn'), null, {scroll:false}); await sleep(800);
const p0 = await F.evaluate(()=>({arena:!!document.querySelector('#bossContent .boss-arena'), txt:document.getElementById('bossContent').innerText.replace(/\s+/g,' ').slice(0,80), timerEl: (document.getElementById('bossTimerEl')||{}).style ? document.getElementById('bossTimerEl').style.display : null}));
console.log('after back', JSON.stringify(p0));
await sleep(66000);
const p1 = await F.evaluate(()=>({arena:!!document.querySelector('#bossContent .boss-arena'), screen:document.querySelector('.screen.active').id, txt:document.getElementById('bossContent').innerText.replace(/\s+/g,' ').slice(0,120), coins: HansenCoins.get(), answers:S.totalAnswers, overlays:[...document.querySelectorAll('body > div')].filter(d=>{const s=getComputedStyle(d); return s.position==='fixed'&&s.display!=='none'&&+s.opacity>0.05&&s.pointerEvents!=='none'&&d.getBoundingClientRect().height>300;}).map(d=>d.id||String(d.className).slice(0,30))}));
console.log('66s later', JSON.stringify(p1));
// re-enter fight works?
await tapIn(page, F, ()=>document.querySelector('[onclick^="hansenStartRebattle(1)"]'));
const ok = await waitIn(F, ()=>document.querySelectorAll('#bossOpts .boss-opt').length>=2, null, 8000);
console.log('re-enter fight ok', !!ok);
console.log('EVENTS', JSON.stringify(ev.filter(e=>!/ERR_FAILED|__rt=/.test(e.text) && e.kind!=='requestfailed').slice(0,10)));
await browser.close(); srv.close();
