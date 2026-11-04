// MG-11: result-screen 金币 +N vs real wallet delta during one 听音辨义 初级 round (all correct, real taps)
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const island = process.argv[2]||'job';
const rounds = +(process.argv[3]||2);
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, island);
await F.evaluate(()=>{ window.__adds=[]; const o=HansenCoins.add; HansenCoins.add=function(n){ const st=(new Error().stack||'').split('\n').slice(2,5).map(s=>s.trim().replace(/\(?http:\/\/127\.0\.0\.1:\d+\//,'').replace(/\?v=\d+/,'')).join(' < '); window.__adds.push({n, st}); return o.apply(this, arguments); }; });
const out=[];
for(let r=0;r<rounds;r++){
  await tapCard(page, F, /^startListen\(/);
  await waitIn(F, ()=>document.querySelector(`[onclick="startListenLevel('easy')"]`)); await sleep(300);
  const lvl = await F.evaluate(()=>document.querySelector(`[onclick="startListenLevel('easy')"]`).innerText.replace(/\s+/g,' '));
  await F.evaluate(()=>{ window.__adds.length=0; window.__w0=HansenCoins.get(); });
  await tap(page, F, ()=>document.querySelector(`[onclick="startListenLevel('easy')"]`));
  let last=null, n=0;
  for(;n<60;n++){
    const st = await waitIn(F, (lw)=>{ const c=document.getElementById('listenContent'); if(/完成！/.test(c.innerText)) return {done:true, txt:c.innerText.replace(/\s+/g,' ').slice(0,220)}; if(listenActive&&listenQ&&!listenQ.answered&&listenQ.word.en!==lw&&document.querySelector('#listenScreen .boss-opt')) return {w:listenQ.word.en}; return null; }, last, 15000);
    if(!st||st.done){ const res = await F.evaluate(()=>({walletDelta:HansenCoins.get()-window.__w0, adds:window.__adds})); out.push({round:r+1, lvl, result:st&&st.txt, ...res}); break; }
    last=st.w;
    await tap(page, F, ()=>[...document.querySelectorAll('#listenScreen .boss-opt')].find(x=>x.textContent.includes(listenQ.word.cn)));
  }
  // dismiss any popup (level up / achievement) like a kid would
  for(let k=0;k<3;k++){ if(await F.evaluate(()=>!!document.querySelector('#alertModal.show'))){ await sleep(800); await tap(page, F, ()=>document.querySelector('#alertModal.show button')); await sleep(500);} }
  await F.evaluate(()=>showScreen('home'));
}
for(const o of out){ const by={}; o.adds.forEach(a=>{ const k=a.st.split(' < ').slice(0,2).join(' < '); by[k]=(by[k]||0)+a.n; }); o.bySource=by; delete o.adds; }
console.log(JSON.stringify({island, out, errors:ev.filter(e=>!/tencent|tcb|signin/i.test(e.t))},null,1));
fs.writeFileSync(`${OUT}/s6_coins_${island}.json`, JSON.stringify(out,null,1));
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
