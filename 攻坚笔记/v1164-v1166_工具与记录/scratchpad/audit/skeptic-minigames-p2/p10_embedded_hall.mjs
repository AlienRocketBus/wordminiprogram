// P2-10: boss_hall embedded via 卡册 (real path) — overflow / pan / right edge
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome } from './nav.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const out = {};
try{
  for(const [w,h] of [[390,844],[360,800]]){
    const {ctx} = await newCtx(browser, port, {width:w, height:h, init:()=>{ try{ if(!localStorage.getItem('hansen_wallet_cardbook')) localStorage.setItem('hansen_wallet_cardbook', JSON.stringify({owned:{'1':true,'2':true,'5':true}})); }catch(e){} }});
    const page = await ctx.newPage(); const ev=[]; attach(page, ev, 'e');
    await homeReady(page, port);
    await page.evaluate(()=>openIsland('island_time.html'));
    const F = await getFrame(page, /\/island_time\.html/, ()=>typeof allW!=='undefined', 20000);
    await sleep(1500); await closeWelcome(page, F);
    const nav = await F.$('#navCards'); await tap(page, F, nav, {force:true}); await waitFor(()=>F.$('#cardsScreen [onclick*="hansenShowCardDetail"]'), {timeout:8000}); await sleep(600);
    // tap first card that opens detail
    const card = await F.$('#cardsScreen [onclick*="hansenShowCardDetail"]');
    const r = card ? await tap(page, F, card) : {ok:false, why:'no card', html: await F.evaluate(()=>{const s=document.getElementById('cardsScreen'); return s? s.innerText.replace(/\s+/g,' ').slice(0,200): 'no screen';})}; await sleep(800); console.log('mask?', await F.evaluate(()=>!!document.getElementById('__hsn_bosshall')), await F.evaluate(()=>[...document.querySelectorAll('iframe')].map(i=>i.src.replace(/^.*\//,'').slice(0,60))));
    await sleep(1500); console.log('frames', page.frames().map(f=>f.url().replace(/^http:\/\/127\.0\.0\.1:\d+\//,'').slice(0,80)+' parent='+(f.parentFrame()?f.parentFrame().url().replace(/^.*\//,'').slice(0,30):'-'))); const H = await waitFor(async()=>page.frames().find(f=>/boss_hall\.html\?v=1163&lv=/.test(f.url())), {timeout:10000});
    await sleep(2000);
    const m = H ? await H.evaluate(()=>{ const vis=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0 && cs.visibility!=='hidden' && cs.display!=='none' && (r.right>innerWidth+1||r.left<-1);}).map(e=>(e.id||e.className||e.tagName).toString().slice(0,30)+'['+Math.round(e.getBoundingClientRect().left)+','+Math.round(e.getBoundingClientRect().right)+']').slice(0,12); return {iw:innerWidth, sw:document.documentElement.scrollWidth, offscreen:vis}; }) : null;
    // try to scroll the iframe document horizontally
    if(H){
      m.scrollX0 = await H.evaluate(()=>window.scrollX);
      const cdp = await ctx.newCDPSession(page);
      const y = Math.round(h*0.62);
      // swipe on a non-interactive area (between card and controls): horizontal drag
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:40,y}]});
      for(let i=1;i<=10;i++){ await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:40+i*25,y}]}); await sleep(16); }
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await sleep(600);
      m.scrollXafterRightSwipe = await H.evaluate(()=>window.scrollX);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:w-40,y}]});
      for(let i=1;i<=10;i++){ await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:w-40-i*25,y}]}); await sleep(16); }
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await sleep(600);
      m.scrollXafterLeftSwipe = await H.evaluate(()=>window.scrollX);
      m.bossNameAfterSwipes = await H.evaluate(()=>document.getElementById('pname').textContent);
      m.panel = await H.evaluate(()=>{ const c=[...document.querySelectorAll('body *')].filter(e=>/光\s*效/.test(e.textContent||'') && e.children.length>2).sort((a,b)=>a.getBoundingClientRect().width-b.getBoundingClientRect().width)[0]; if(!c) return null; const r=c.getBoundingClientRect(); return {cls:c.className||c.id, l:Math.round(r.left), r:Math.round(r.right)}; });
    }
    out[w+"x"+h] = {cardTap:r, hall:!!H, m, screen: await F.evaluate(()=>document.querySelector(".screen.active").id)};
    await page.screenshot({path:`${OUT}/shots/p10_embedded_${w}.png`});
    console.log(w, JSON.stringify(out[w+'x'+h], null, 1));
    await page.close(); await ctx.close();
  }
}finally{
  fs.writeFileSync(`${OUT}/p10_embedded_hall.json`, JSON.stringify(out,null,1));
  await browser.close(); srv.close();
}
