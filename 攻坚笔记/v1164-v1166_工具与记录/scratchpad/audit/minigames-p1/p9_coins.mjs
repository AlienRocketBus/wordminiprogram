// Where do coins come from during one game, vs the "🪙 金币 +N" on the result screen?
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {openIsland, tapIn, waitIn} from './h.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; attach(page, ev, ()=>'c');
const F = await openIsland(page, port, 'nature');
await sleep(1000);
await F.evaluate(()=>{
  window.__coin=[];
  const C=window.HansenCoins;
  for(const m of ['add','award']){ const o=C[m].bind(C); C[m]=function(a,b){ const n = m==='add'?a:b; const st=new Error().stack.split('\n').slice(2,6).map(s=>s.trim().replace(/\(http[^)]*\/([^/]+?)(\?[^:]*)?:(\d+):\d+\)/,'($1:$3)')).join(' < '); window.__coin.push({m, n, id: m==='award'?a:undefined, st}); return o(a,b); }; }
  window.__wallet0 = C.get();
});
await tapIn(page, F, ()=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>/startEagle/.test(e.getAttribute('onclick'))));
await waitIn(F, ()=>document.querySelector('#eagleContent [onclick="startEagleLevel(\'easy\')"]'));
await sleep(300);
await tapIn(page, F, ()=>document.querySelector('#eagleContent [onclick="startEagleLevel(\'easy\')"]'));
for(let q=0;q<40;q++){
  const st = await waitIn(F, ()=> (eagleActive && eagleTarget && document.querySelector('#eagleGrid .eagle-cell') && !document.querySelector('#eagleGrid .eagle-cell[data-done]')) ? {en:eagleTarget.en, r:eagleRound} : (!eagleActive?'DONE':null), null, 6000);
  if(!st||st==='DONE') break;
  await tapIn(page, F, (en)=>[...document.querySelectorAll('#eagleGrid .eagle-cell')].find(c=>c.textContent===en), st.en, {scroll:q===0});
  await waitIn(F, (r)=>eagleRound!==r||!eagleActive, st.r, 4000);
}
await sleep(1200);
const out = await F.evaluate(()=>{ const sum={}; window.__coin.forEach(c=>{ const k=c.m+' '+(c.id?String(c.id).replace(/[:_-]\d.*$/,''):'')+' @ '+c.st.split(' < ')[0]; sum[k]=(sum[k]||0)+(+c.n||0); }); return {result:(document.getElementById('eagleContent').innerText.match(/金币 \+\d+/)||[''])[0], walletDelta: HansenCoins.get()-window.__wallet0, sessionCoins: window._sessionCoins, bySource: sum, sample: window.__coin.slice(0,3)}; });
console.log(JSON.stringify(out,null,1));
await browser.close(); srv.close(); process.exit(0);
