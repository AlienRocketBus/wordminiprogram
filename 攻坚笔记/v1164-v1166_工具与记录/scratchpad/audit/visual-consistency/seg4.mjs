import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome, islandFrame } from './lib2.mjs';
import fs from 'node:fs';
const THEME = process.argv[2] || 'dark';
const PFX = THEME==='dark' ? 'd' : 'l';
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const notes=[];
const ctx = await newCtx(browser,{dsf:2});
const extra = {'hansen_wallet_coins':'300'};
if(THEME==='light'){ extra['hansen_palette_global']='cloud'; }
await seed(ctx, extra);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
let fr;
async function fresh(file='island_animal.html'){
  await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(1500);
  fr = await openIsland(page,file); await dismissWelcome(page,fr); await sleep(300);
}
async function frameOff(){ return page.evaluate(()=>{const f=document.getElementById('islandFrame'); const r=f.getBoundingClientRect(); return {x:r.left,y:r.top};}); }
async function tapFrameEl(handleJs){ // handleJs returns rect in frame
  const r = await fr.evaluate(handleJs); if(!r) return false; const o=await frameOff(); await page.touchscreen.tap(r.x+o.x, r.y+o.y); return true;
}
async function tapCard(text){
  const loc = fr.locator('.mode-card, .util-card, .daily-card, .nav-item', { hasText: text }).first();
  await loc.evaluate(el=>el.scrollIntoView({block:'center'})); await sleep(300);
  const bb = await loc.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
}
const T = {
  listen: async()=>{
    await fresh(); await tapCard('听音辨义'); await sleep(1500);
    await tapFrameEl(()=>{ const b=[...document.querySelectorAll('#listenScreen [onclick]')].find(e=>/初级/.test(e.innerText)); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    await sleep(1200);
    let shotCorrect=false, shotWrong=false, popups=0;
    for(let q=0;q<24;q++){
      const want = (q===1) ? 'wrong' : 'right';
      const ok = await tapFrameEl((want)=>{ if(typeof listenQ==='undefined'||!listenQ||!listenQ.opts) return null; const idx=listenQ.opts.findIndex(o=>o.cn===listenQ.word.cn); const opts=document.querySelectorAll('#listenScreen .boss-opt'); const i = want==='right'? idx : (idx+1)%opts.length; const e=opts[i]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
      if(!ok){ await sleep(800); continue; }
      await sleep(350);
      if(want==='right' && !shotCorrect){ await shot(page, PFX+'70_feedback_correct'); shotCorrect=true; }
      if(want==='wrong' && !shotWrong){ await shot(page, PFX+'71_feedback_wrong'); shotWrong=true; }
      await sleep(900);
      const m = await fr.evaluate(()=>{ const m=document.querySelector('#alertModal.show,.modal-bg.show'); if(m) return 'modal:'+m.innerText.slice(0,60); const f=[...document.querySelectorAll('body > div')].find(d=>{const c=getComputedStyle(d); return c.position==='fixed' && +c.zIndex>900 && d.getBoundingClientRect().height>200 && d.innerText.trim().length>2;}); return f? ('fixed:'+(f.id||f.className)+':'+f.innerText.slice(0,60)) : null; });
      const tm = await page.evaluate(()=>{ const f=[...document.querySelectorAll('body > div')].find(d=>{const c=getComputedStyle(d); return c.position==='fixed' && +c.zIndex>900 && d.getBoundingClientRect().height>200 && d.innerText.trim().length>2 && d.id!=='islandFrameWrap';}); return f? ('TOPfixed:'+(f.id||f.className)+':'+f.innerText.slice(0,60)) : null; });
      if(m || tm){ popups++; await shot(page, PFX+'72_popup_'+popups); notes.push('popup '+popups+' q'+q+' '+(m||'')+' '+(tm||'')); 
        await fr.evaluate(()=>{ const m=document.querySelector('#alertModal.show,.modal-bg.show'); const b=m&&m.querySelector('button'); if(b) b.click(); });
        await sleep(600);
        if(popups>=4) break; }
    }
    const xp = await fr.evaluate(()=>document.querySelector('.top-bar,#topBar,header')?.innerText?.slice(0,80) || document.body.innerText.slice(0,80));
    notes.push('after listen header: '+xp.replace(/\s+/g,' '));
  },
  chest: async()=>{
    await fresh(); await tapCard('每日宝箱'); await sleep(1500);
    await tapFrameEl(()=>{ const s=document.getElementById('chestScreen'); const c=[...s.querySelectorAll('[onclick], img, .chest')].filter(e=>!e.closest('.back-btn')).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height - a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0]; if(!c) return null; c.scrollIntoView({block:'center'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    await sleep(1200); await shot(page, PFX+'73_chest_open'); await sleep(1500); await shot(page, PFX+'73_chest_open_b');
  },
  showcase: async()=>{
    await fresh(); await tapCard('卡册'); await sleep(1500);
    await tapFrameEl(()=>{ const e=[...document.querySelectorAll('#cardsScreen [onclick], #cardsScreen div')].find(d=>/神秘殿堂/.test(d.innerText)&&d.getAttribute('onclick')); if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    await sleep(4000); await shot(page, PFX+'80_season_showcase');
  },
  bosshall: async()=>{
    await fresh(); await tapCard('卡册'); await sleep(1500);
    const ok = await tapFrameEl(()=>{ const s=document.getElementById('cardsScreen')||document.querySelector('.screen.active'); const c=document.querySelector('[onclick*="hansenShowCardDetail"]'); if(!c) return null; c.scrollIntoView({block:'center'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    notes.push('bosshall card tapped '+ok);
    await sleep(4000); await shot(page, PFX+'81_boss_hall'); await sleep(1500); await shot(page, PFX+'81_boss_hall_b');
  },
  landdetail: async()=>{
    await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(1500);
    await page.evaluate(()=>window.openIsland('land_map.html')); await sleep(5000);
    fr = islandFrame(page,'land_map');
    const b = fr.locator('button.spot').first(); const bb=await b.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2); await sleep(1500);
    await shot(page, PFX+'82_land_detail');
  },
  check: async()=>{
    await page.goto(base+'/check.html',{waitUntil:'load'}); await sleep(2500); await shot(page, PFX+'83_check_page');
    await page.goto(base+'/_frame.html',{waitUntil:'load'}); await sleep(2500); await shot(page, PFX+'84_frame_page');
  },
};
for(const [k,fn] of Object.entries(T)){
  if(ONLY && !ONLY.includes(k)) continue;
  try{ await fn(); }catch(e){ notes.push('ERR '+k+' '+e.message.slice(0,200)); }
}
fs.writeFileSync(OUT+`/seg4_${THEME}_notes.json`, JSON.stringify({notes,errs,external:[...new Set(external)],r404:reqLog},null,1));
console.log(notes.join('\n')); console.log('errs',errs.slice(0,30)); console.log('ext',[...new Set(external)]); console.log('404',[...new Set(reqLog)]);
await browser.close(); srv.close();
