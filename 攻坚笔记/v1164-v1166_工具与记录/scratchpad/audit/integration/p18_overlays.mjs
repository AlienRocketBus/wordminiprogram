import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
await openCard(page, 'island_animal.html'); let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
await sleep(1500);
const ov = ()=>fr.evaluate(()=>{ const ids=['hsnSbOverlay','hsnPkOverlay']; const o={}; ids.forEach(i=>o[i]=!!document.getElementById(i)); o.fixedTop=[...document.querySelectorAll('body > *')].filter(e=>{const s=getComputedStyle(e); return s.position==='fixed' && s.display!=='none' && +s.zIndex>100000 && e.getBoundingClientRect().height>300;}).map(e=>(e.id||e.className).toString().slice(0,30)); o.active=(document.querySelector('.screen.active')||{}).id; o.modal=document.body.classList.contains('modal-open'); return o; });
// list mode cards
const cards = await fr.evaluate(()=>[...document.querySelectorAll('#homeScreen .mode-card')].map((c,i)=>i+':'+(c.innerText||'').replace(/\s+/g,' ').slice(0,12)+' => '+c.getAttribute('onclick')));
console.log(cards.join('\n'));
for(let i=0;i<cards.length;i++){
  const label = cards[i];
  await fr.evaluate(()=>{ try{ showScreen('home'); }catch(e){} window.scrollTo(0,0); });
  await sleep(400);
  await fr.evaluate((i)=>{ document.querySelectorAll('#homeScreen .mode-card').forEach((c,j)=>c.setAttribute('data-audit',String(j))); }, i);
  const r = await tapEl(page, fr, `#homeScreen .mode-card[data-audit="${i}"]`).catch(e=>({hit:'ERR '+e.message}));
  // nth-of-type may not match; fallback evaluate-based selection
  await sleep(1800);
  const before = await ov();
  const s0 = await st(page);
  await page.evaluate(()=>history.back());
  await sleep(1200);
  const s1 = await st(page);
  let after = null; try{ after = await ov(); }catch(e){ after = 'ERR '+e.message; }
  console.log(`[${label.slice(0,30)}] tapHit=${r.hit} opened=${JSON.stringify(before)} | back -> wrap=${s1.wrap} island=${s1.u} hst=${s1.hst} after=${JSON.stringify(after)}`);
  if(s1.wrap==='none'){ // reopen island for next card
    await page.evaluate(()=>history.forward()); await waitFor(page, s=>s.wrap==='block'&&s.op==='1', 4000); await sleep(600);
    fr = islandFrame(page,'island_animal.html');
    if(!fr){ fr = page.frames().find(f=>f.parentFrame()===page.mainFrame()); }
    const cur = await st(page); if(cur.u!=='island_animal.html'){ console.log('   (iframe now', cur.u, ') reopening animal'); await page.evaluate(()=>openIsland('island_animal.html')); await waitFor(page, s=>s.u==='island_animal.html'&&s.op==='1'&&s.rs==='complete', 8000); await sleep(1000); fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr); }
  }
  // close any leftover overlays
  await fr.evaluate(()=>{ try{ if(window.HansenSpellBee) HansenSpellBee.close(); }catch(e){} try{ var p=document.getElementById('hsnPkOverlay'); if(p) p.remove(); }catch(e){} try{ document.querySelectorAll('.modal-bg.show,.show').forEach(m=>m.classList.remove('show')); document.body.classList.remove('modal-open'); }catch(e){} });
  await sleep(300);
}
console.log('errors', errs);
await browser.close(); srv.close();
