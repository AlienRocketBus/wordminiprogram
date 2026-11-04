// P2-05/P2-06: spelling bee embedded on island_season (and land3 for comparison): which audio files are requested
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame } from './nav.mjs';
const islands = (process.argv[2]||'season,land3,sports').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const out = {};
try{
  for(const key of islands){
    const {ctx} = await newCtx(browser, port, {width:390});
    const page = await ctx.newPage();
    const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
    const audioReq = [];
    page.on('response', r=>{ const u=r.url(); if(/\/words\/.*\.mp3/.test(u)) audioReq.push({s:r.status(), u:u.replace(/^.*\/words\//,'words/').replace(/\?.*$/,'')}); });
    await homeReady(page, port);
    await page.evaluate(k=>openIsland('island_'+k+'.html'), key);
    const F = await getFrame(page, new RegExp('/island_'+key+'\\.html'), ()=>typeof allW!=='undefined', 20000);
    await sleep(2500);
    // close any welcome / story overlays by tapping known buttons
    for(let i=0;i<8;i++){
      let b = await byText(F, '#hsnStoryModal button, #hsnStoryModal [onclick]', /迈出|继续|下一|开始|关闭|进入|好的|知道/);
      if(!b) b = await byText(F, '#alertModal.show button', /^(开始冒险)/);
      if(!b) break; const txt = await b.evaluate(e=>e.innerText.trim().slice(0,20)); const r = await tap(page, F, b); console.log('tapped', txt, r.ok, r.hit); await sleep(1100);
    }
    console.log('screen', await F.evaluate(()=>{const a=document.querySelector('.screen.active');return a&&a.id;}), 'overlays', await F.evaluate(()=>[...document.querySelectorAll('body > div')].filter(d=>{const cs=getComputedStyle(d);return cs.position==='fixed'&&cs.display!=='none'&&+cs.opacity>0.1&&d.getBoundingClientRect().height>300;}).map(d=>d.id||d.className).slice(0,6)));
    await page.screenshot({path:`${OUT}/shots/p05_${key}_landing.png`});
    await F.evaluate(()=>{ try{ showScreen('home'); }catch(e){} });
    await sleep(600);
    tag='sb';
    const card = await F.$(`#homeScreen .mode-card[onclick*="HansenSpellBee.open"]`);
    const t1 = await tap(page, F, card, {force:true});
    const SB = await getFrame(page, /spelling_bee\.html/, ()=>document.readyState==='complete' && !!document.getElementById('startBtn'), 15000).catch(()=>null)
      || await waitFor(async()=>page.frames().find(f=>/spelling_bee\.html/.test(f.url())), {timeout:10000});
    await sleep(1200);
    const info = SB ? await SB.evaluate(()=>({sub:(document.querySelector('.sub')||{}).textContent, tip:(document.querySelector('.sec-t .tip')||{}).textContent, words:typeof WORDS!=='undefined'?WORDS.length:null, isl:(typeof WORDS!=='undefined'&&WORDS[0])?WORDS[0].isl:null, mode:(document.querySelector('#modeBox .sel')||{}).dataset?document.querySelector('#modeBox .sel').dataset.mode:null, hasTTS:'speechSynthesis' in window})) : null;
    // start race
    let started=null; const a0 = audioReq.length;
    if(SB){
      const sb = await SB.$('#startBtn');
      // the overlay iframe is inside the island iframe: compute offset manually
      const fe = await SB.frameElement(); const fb = await fe.boundingBox();
      await sb.evaluate(e=>e.scrollIntoView({block:'center'})); await sleep(200);
      const bb = await sb.boundingBox();
      await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
      started = true;
      await sleep(6000);
    }
    const ttsCalls = SB ? await SB.evaluate(()=>window.__ttsCount||null) : null;
    out[key] = {cardTap:t1.ok, info, audioAfterStart: audioReq.slice(a0, a0+12), audio404: audioReq.filter(x=>x.s>=400).map(x=>x.u), errors: ev.filter(x=>/pageerror/.test(x.kind)).map(x=>x.text.split('\n')[0]).slice(0,5)};
    console.log(key, JSON.stringify(out[key], null, 1));
    await page.screenshot({path:`${OUT}/shots/p05_${key}_sb.png`});
    await page.close(); await ctx.close();
  }
}finally{
  fs.writeFileSync(`${OUT}/p05_sb.json`, JSON.stringify(out,null,1));
  await browser.close(); srv.close();
}
