// P2-01: 听音辨义 on land islands — real path from home, real taps
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, openLandMapFromHome, enterLandFromMap, closeWelcome, activeScreen, tapModeCard, getFrame } from './nav.mjs';

const lands = (process.argv[2]||'3,2,5,8').split(',').map(Number);
const width = +(process.argv[3]||390);
const {srv, port} = await startServer();
const browser = await launch();
const results = {};
try{
  for(const n of lands){
    const {ctx, ext} = await newCtx(browser, port, {width});
    const page = await ctx.newPage();
    const ev = []; let tag='boot';
    attach(page, ev, ()=>tag);
    const R = {n};
    R.home = await homeReady(page, port);
    tag='landmap';
    const lm = await openLandMapFromHome(page);
    R.landmap = {ok:lm.ok, tap:lm.tap && lm.tap.ok};
    tag='enter';
    const e = await enterLandFromMap(page, lm.M, n);
    R.enter = {spot:e.r1&&e.r1.ok, btn:e.r2&&e.r2.ok, frame:!!e.F};
    const F = e.F;
    R.welcome = await closeWelcome(page, F);
    R.screen0 = await activeScreen(F);
    tag='listen-card';
    R.cardTap = await tapModeCard(page, F, /听音辨义/);
    await sleep(700);
    R.screen1 = await activeScreen(F);
    R.levelTexts = await F.evaluate(()=>[...document.querySelectorAll('#listenContent [onclick^="startListenLevel"]')].map(d=>d.innerText.replace(/\s+/g,' ').trim()));
    R.counts = await F.evaluate(()=>Object.fromEntries(Object.keys(LISTEN_LEVEL_IDX).map(k=>[k,LISTEN_LEVEL_IDX[k].length])));
    const levels = await F.$$('#listenContent [onclick^="startListenLevel"]');
    tag='listen-easy';
    const before = ev.length;
    R.easyTap = levels[0] ? await tap(page, F, levels[0], {label:'初级'}) : null;
    await sleep(1500);
    R.afterEasy = await F.evaluate(()=>({screen:document.querySelector('.screen.active').id, listenActive:typeof listenActive!=='undefined'?listenActive:null, hasSpeaker:!!document.getElementById('listenSpeaker'), content:(document.getElementById('listenContent').innerText||'').replace(/\s+/g,' ').slice(0,200)}));
    R.errorsAfterEasy = ev.slice(before).filter(x=>/pageerror|console.error/.test(x.kind)).map(x=>x.text.split('\n').slice(0,3).join(' | '));
    await page.screenshot({path:`${OUT}/shots/p01_land${n}_${width}_after_easy.png`});
    // try hard too
    tag='listen-hard';
    const b2 = ev.length;
    const levels2 = await F.$$('#listenContent [onclick^="startListenLevel"]');
    if(levels2[2]){ R.hardTap = await tap(page, F, levels2[2], {label:'高级'}); await sleep(1500); }
    R.afterHard = await F.evaluate(()=>({screen:document.querySelector('.screen.active').id, listenActive:typeof listenActive!=='undefined'?listenActive:null, hasSpeaker:!!document.getElementById('listenSpeaker'), content:(document.getElementById('listenContent').innerText||'').replace(/\s+/g,' ').slice(0,200)}));
    R.errorsAfterHard = ev.slice(b2).filter(x=>/pageerror|console.error/.test(x.kind)).map(x=>x.text.split('\n').slice(0,2).join(' | '));
    R.allErrors = ev.filter(x=>/pageerror/.test(x.kind)).map(x=>x.tag+': '+x.text.split('\n')[0]);
    R.http4xx = ev.filter(x=>/^http4/.test(x.kind)).map(x=>x.text.replace(/^http:\/\/127\.0\.0\.1:\d+\//,''));
    R.externalAborted = [...new Set(ext.map(u=>u.replace(/\?.*$/,'').slice(0,90)))].slice(0,10);
    results['land'+n] = R;
    console.log(JSON.stringify(R, null, 1).slice(0,3500));
    await page.close(); await ctx.close();
  }
}finally{
  fs.writeFileSync(`${OUT}/p01_listen_${width}.json`, JSON.stringify(results,null,1));
  await browser.close(); srv.close();
}
