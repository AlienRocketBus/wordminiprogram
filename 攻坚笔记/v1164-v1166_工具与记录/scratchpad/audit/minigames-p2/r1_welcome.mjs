import {startServer, launch, newCtx, attach, sleep} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const key = process.argv[2]||'sports';
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  // log alertModal class changes with stack
  document.addEventListener('DOMContentLoaded', ()=>{ const m=document.getElementById('alertModal'); if(!m) return; window.__alog=[]; new MutationObserver(()=>{ window.__alog.push({t:Math.round(performance.now()), show:m.classList.contains('show'), txt:(document.getElementById('alertInner')||{}).innerText.slice(0,30)}); }).observe(m,{attributes:true, attributeFilter:['class']}); });
};
const {ctx} = await newCtx(browser, port, {init: INIT});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'x');
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
const sk = await page.$('#__hsOnbSkip'); console.log('onb skip present', !!sk);
await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
let F=null; for(let i=0;i<100;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
const shown = await waitIn(F, ()=>document.querySelector('#alertModal.show')?performance.now():null, null, 4000);
console.log('welcome shown at', shown);
for(const delay of [0, 300, 1000]){
  await sleep(delay);
  const r = await tapIn(page, F, ()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText)));
  await sleep(500);
  const st = await F.evaluate(()=>({show:!!document.querySelector('#alertModal.show'), log:window.__alog}));
  console.log('delay',delay,'tap',JSON.stringify(r),'->',JSON.stringify(st));
  if(!st.show) break;
}
await sleep(2000);
console.log('final', JSON.stringify(await F.evaluate(()=>({show:!!document.querySelector('#alertModal.show'), log:window.__alog}))));
console.log(ev.filter(e=>e.kind!=='requestfailed').slice(0,10));
await browser.close(); srv.close();
