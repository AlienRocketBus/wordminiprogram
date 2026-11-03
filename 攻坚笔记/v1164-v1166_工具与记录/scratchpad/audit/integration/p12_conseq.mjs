import { setup, sleep, log, tapEl } from './lib.mjs';
import { st, waitFor, islandFrame, openCard, dismissWelcome } from './nav.mjs';
const {srv, browser, ctx, base, external} = await setup({initScript: ()=>{ try{ if(!localStorage.getItem('__seeded')){ localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('__seeded','1'); } }catch(e){} }});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('dialog', d=>{ errs.push('dialog: '+d.message().slice(0,100)); d.dismiss(); });
page.on('framenavigated', f=>{ if(f.parentFrame()===page.mainFrame()) console.log('   [islandFrame navigated]', f.url().replace(base,'')); });
const recent = ()=>page.evaluate(()=>({card:(document.getElementById('recentNum')||{}).textContent, lastKey:localStorage.getItem('lastIslandKey'), animalSave:(()=>{try{return JSON.parse(localStorage.getItem('wordIslandAnimal')||'{}').lastSaveTime||null}catch(e){return 'x'}})(), foodSave:(()=>{try{return JSON.parse(localStorage.getItem('wordIslandFood')||'{}').lastSaveTime||null}catch(e){return 'x'}})()}));
await page.goto(base+'index.html', {waitUntil:'load'});
await sleep(3000);
// island 1: animal, play: learn a word
let o = await openCard(page, 'island_animal.html'); let fr = islandFrame(page,'island_animal.html'); await dismissWelcome(page, fr);
await sleep(1000);
await tapEl(page, fr, '.world-map-btn'); await waitFor(page, s=>s.wrap==='none'); await sleep(1500);
console.log('after animal', await recent());
// island 2: food, do something that saves (learn a word)
o = await openCard(page, 'island_food.html'); fr = islandFrame(page,'island_food.html'); await dismissWelcome(page, fr);
await fr.evaluate(()=>{ try{ learnWord(0); }catch(e){} try{ if(typeof save==='function') save(); }catch(e){} });
await sleep(1500);
console.log('food played', await recent());
log.length=0;
const tc=Date.now();
await tapEl(page, fr, '.world-map-btn'); await waitFor(page, s=>s.wrap==='none');
await sleep(6000);
console.log('after closing food (+6s)', await recent());
const reqs = log.filter(l=>l.t>=tc);
const bytes = reqs.length;
console.log('requests while sitting on home after closing food:', reqs.length, 'html:', reqs.filter(r=>/\.html/.test(r.p)).map(r=>r.url));
// reopen food: keep-alive?
const t0=Date.now();
await page.evaluate(()=>{ const a=document.querySelector('a.island[href="island_food.html"]'); a.scrollIntoView({block:'center'}); });
await sleep(300);
await tapEl(page, page, 'a.island[href="island_food.html"]');
const w = await waitFor(page, s=>s.wrap==='block'&&s.op==='1'&&s.u==='island_food.html', 8000);
console.log('reopen food reveal ms', w.ms, '(keep-alive would be ~0-50ms)');
console.log('errors', errs);
await browser.close(); srv.close();
