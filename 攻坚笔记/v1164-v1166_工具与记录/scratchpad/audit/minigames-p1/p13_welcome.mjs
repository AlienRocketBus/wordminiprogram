// Why does the island welcome popup come back after the kid taps 「开始冒险！」? record every .show on #alertModal with a stack
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn} from './h.mjs';
const ISL = (process.argv[2]||'adjective,animal,body,food').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => {
  try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  if(!/island_/.test(location.pathname)) return;
  window.__shows = [];
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function(...a){
    try{ if(a.includes('show')){ const el = this.__el || null; }
    }catch(e){}
    return add.apply(this, a);
  };
  // observe the modal once it exists
  const iv = setInterval(()=>{ const m=document.getElementById('alertModal'); if(!m) return; clearInterval(iv);
    let was = m.classList.contains('show');
    new MutationObserver(()=>{ const now=m.classList.contains('show'); if(now!==was){ window.__shows.push({t:Math.round(performance.now()), show:now, txt:(document.getElementById('alertInner')||{}).innerText?.slice(0,30), stack:new Error().stack.split('\n').slice(2,5).join(' | ')}); was=now; } }).observe(m,{attributes:true,attributeFilter:['class']});
    const ca = window.closeAlert; window.closeAlert = function(){ window.__shows.push({t:Math.round(performance.now()), call:'closeAlert'}); return ca.apply(this, arguments); };
  }, 20);
  // capture who calls classList.add('show') on alertModal
  const oadd = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function(...a){ try{ if(a.includes('show') && this === (document.getElementById('alertModal')||{}).classList){ (window.__adds=window.__adds||[]).push({t:Math.round(performance.now()), stack:new Error().stack.split('\n').slice(2,7).map(s=>s.trim()).join(' | ')}); } }catch(e){} return oadd.apply(this, a); };
};
for(const key of ISL){
  const {ctx} = await newCtx(browser, port, {init: INIT});
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await sleep(1200);
  await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
  let F=null; for(let i=0;i<100;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>document.readyState!=='loading' && typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
  // same as the sweep: wait for welcome, tap the button with a finger
  for(let i=0;i<30;i++){ if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))) break; await sleep(100); }
  const t1 = await tapIn(page, F, ()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText)));
  await sleep(4000);
  const st = await F.evaluate(()=>({shownNow: !!document.querySelector('#alertModal.show'), shows: window.__shows, adds: window.__adds, totalAnswers:S.totalAnswers, learned:S.learned.length}));
  console.log(key, 'tap', JSON.stringify(t1), '\n', JSON.stringify(st, null, 1).slice(0,2500));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
