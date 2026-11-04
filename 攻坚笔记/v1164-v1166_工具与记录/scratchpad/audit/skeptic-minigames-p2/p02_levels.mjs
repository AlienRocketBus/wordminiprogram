// P2-02: easy levels on land islands for moles/fish/bubble/scramble/eagle
import fs from 'node:fs';
import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome, tapModeCard } from './nav.mjs';
const lands = (process.argv[2]||'1,2').split(',');
const {srv, port} = await startServer();
const browser = await launch();
const out = {};
const games = [
  {name:'打地鼠', re:/打地鼠/, menu:'#molesScreen', lvl:'[onclick^="startMolesLevel"]', screen:'molesScreen'},
  {name:'钓鱼', re:/钓鱼/, menu:'#fishScreen', lvl:'[onclick^="startFishLevel"]', screen:'fishScreen'},
  {name:'泡泡', re:/泡泡/, menu:'#bubbleScreen', lvl:'[onclick^="startBubbleLevel"]', screen:'bubbleScreen'},
  {name:'拼拼乐', re:/拼拼乐/, menu:'#scrambleScreen', lvl:'[onclick^="startScrambleLevel"]', screen:'scrambleScreen'},
  {name:'火眼金睛', re:/火眼金睛/, menu:'#eagleScreen', lvl:'[onclick^="startEagleLevel"]', screen:'eagleScreen'},
];
try{
  for(const n of lands){
    const key = /^\d$/.test(n) ? 'land'+n : n;
    const {ctx} = await newCtx(browser, port, {width:390});
    const page = await ctx.newPage();
    const ev=[]; attach(page, ev, 'x');
    await homeReady(page, port);
    await page.evaluate(k=>openIsland('island_'+k+'.html'), key);
    const F = await getFrame(page, new RegExp('/island_'+key+'\\.html'), ()=>typeof allW!=='undefined', 20000);
    await sleep(1500);
    await closeWelcome(page, F);
    const R = {};
    await F.evaluate(()=>{ window.__toasts=[]; const o=window.showToast; window.showToast=function(m){ try{ window.__toasts.push(String(m)); }catch(e){} return o.apply(this, arguments); }; });
    for(const g of games){
      const t = await tapModeCard(page, F, g.re);
      await sleep(800);
      const menuTexts = await F.evaluate((g)=>{ const s=document.querySelector(g.menu); if(!s) return null; return [...s.querySelectorAll('div[style*="border-radius:18px"]')].filter(d=>/初级|中级|高级/.test(d.innerText)&&d.children.length>1).slice(0,3).map(d=>({t:d.innerText.replace(/\s+/g,' ').slice(0,120), clickable: !!d.getAttribute('onclick'), opacity:getComputedStyle(d).opacity})); }, g);
      // tap easy
      const easy = await F.$(`${g.menu} ${g.lvl}`);
      let tapRes=null, toast=null, after=null;
      if(easy){
        const txt = await easy.evaluate(e=>e.getAttribute('onclick'));
        if(/easy|'1'|\(1\)/.test(txt)){
          tapRes = await tap(page, F, easy);
          await sleep(600);
          toast = await F.evaluate(()=>{ const t=window.__toasts.slice(); window.__toasts.length=0; return t; });
          await sleep(1600);
          after = await F.evaluate((g)=>{ const s=document.querySelector(g.menu); return (s.innerText||'').replace(/\s+/g,' ').slice(0,160); }, g);
        }
      }
      R[g.name] = {card:t.ok, menuTexts, easyTap: tapRes&&tapRes.ok, toast, after};
      // stop game and return home
      await F.evaluate(()=>{ try{ ['stopMoles','stopFish','stopBubble','stopScramble','stopEagle'].forEach(f=>{ if(typeof window[f]==='function') window[f](); }); }catch(e){} try{ showScreen('home'); }catch(e){} });
      await sleep(500);
    }
    out[key]=R;
    console.log(key, JSON.stringify(R,null,1).slice(0,4000));
    await page.close(); await ctx.close();
  }
}finally{
  fs.writeFileSync(`${OUT}/p02_levels.json`, JSON.stringify(out,null,1));
  await browser.close(); srv.close();
}
