// Repro: spelling bee - tapping ✕ then 继续比赛 while the word is still being read starts a 2nd robot timer
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'bee');
const F = await openIsland(page, port, 'animal');
await sleep(1000);
await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/HansenSpellBee/.test(e.getAttribute('onclick'))));
let B=null; for(let i=0;i<80;i++){ B=page.frames().find(f=>/spelling_bee\.html/.test(f.url())); if(B){ try{ if(await B.evaluate(()=>!!document.getElementById('startBtn'))) break; }catch(e){} } await sleep(100); }
await sleep(800);
console.log('setup tip/sub:', await B.evaluate(()=>[document.querySelector('.sec-t .tip').textContent, document.querySelector('.sub').textContent]));
// make the bot steps observable
await B.evaluate(()=>{ window.__steps=[]; const o=window.botStep; window.botStep=function(ms){ window.__steps.push(Date.now()); return o.apply(this, arguments); }; });
await tapIn(page, B, ()=>document.getElementById('startBtn'));
async function measure(label, interrupt){
  // wait until the word is being read
  await waitIn(B, ()=>/听单词/.test(document.getElementById('sttYou').textContent) && !raceOver, null, 8000);
  if(interrupt){
    await tapIn(page, B, ()=>document.getElementById('exitBtn'), null, {scroll:false});
    await sleep(150);
    await tapIn(page, B, ()=>document.getElementById('exitNo'), null, {scroll:false});
  }
  const t0=Date.now(); await B.evaluate(()=>{ window.__steps.length=0; });
  const len = await B.evaluate(()=>target.length);
  const done = await waitIn(B, ()=>raceOver ? Date.now() : null, null, 20000);
  const steps = await B.evaluate(()=>window.__steps.slice());
  const gaps = steps.slice(1).map((t,i)=>t-steps[i]);
  console.log(label, 'word len', len, 'bot finished after', done? (done-t0)+'ms':'(not in 20s)', 'botStep calls', steps.length, 'gaps', JSON.stringify(gaps));
  await waitIn(B, ()=>document.getElementById('laneRes').classList.contains('on'), null, 4000);
  await tapIn(page, B, ()=>document.getElementById('contBtn'), null, {scroll:false});
}
await measure('normal word (no interruption):', false);
await measure('after ✕ → 继续比赛 during reading:', true);
await measure('normal word again:', false);
await browser.close(); srv.close(); process.exit(0);
