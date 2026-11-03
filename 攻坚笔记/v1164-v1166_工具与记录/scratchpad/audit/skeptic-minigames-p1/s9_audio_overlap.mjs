// Missed-check: does a new speak() / leaving a screen stop the previous local mp3? (template.html speak sets _activeAudio, _stopAllAudio only stops curAudio)
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{
  try{localStorage.setItem('hansen_onboarded','1')}catch(e){}
  const A = window.Audio; window.__aud=[];
  window.Audio = function(src){ const a = new A(src); window.__aud.push(a); return a; }; window.Audio.prototype = A.prototype;
}});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, 'food');
const st = ()=>F.evaluate(()=>window.__aud.map(a=>({src:String(a.src).split('/').pop().slice(0,40), paused:a.paused, ended:a.ended, t:+a.currentTime.toFixed(2), dur:+(a.duration||0).toFixed(2)})));
// 1) explore modal: tap 📝 例句 then 🔊 发音 quickly (real taps)
await tapCard(page, F, /^showScreen\('explore'\)/);
await waitIn(F, ()=>document.querySelector('#exploreContent .exp-card'));
await sleep(500);
await tap(page, F, ()=>document.querySelector('#exploreContent .exp-card'));
await waitIn(F, ()=>document.querySelector('#wordModal.show .m-btn.sentence'));
await sleep(1200);
await F.evaluate(()=>{ window.__aud.length=0; });
await tap(page, F, ()=>document.querySelector('#wordModal.show .m-btn.sentence'));
await sleep(700);
await tap(page, F, ()=>document.querySelector('#wordModal.show .m-btn.listen'));
await sleep(300);
console.log('after 例句 then 发音 (0.7s apart):', JSON.stringify(await st()));
// 2) close modal and leave explore while sentence plays
await F.evaluate(()=>{ window.__aud.length=0; });
await tap(page, F, ()=>document.querySelector('#wordModal.show .m-btn.sentence'));
await sleep(500);
await tap(page, F, ()=>document.querySelector('#wordModal.show .close'));
await sleep(200);
await F.evaluate(()=>showScreen('home'));
await sleep(600);
console.log('sentence started, modal closed, back to home 0.8s later:', JSON.stringify(await st()), 'screen', await F.evaluate(()=>document.querySelector('.screen.active').id));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
