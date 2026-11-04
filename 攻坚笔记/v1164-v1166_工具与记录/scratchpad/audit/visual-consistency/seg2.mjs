import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome, islandFrame, tapEl } from './lib2.mjs';
import fs from 'node:fs';
const THEME = process.argv[2] || 'dark';  // dark | light
const PFX = THEME==='dark' ? 'd' : 'l';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const notes=[]; const metrics={};
const ctx = await newCtx(browser,{dsf:2});
const extra = {'hansen_wallet_coins':'300'};
if(THEME==='light'){ extra['hansen_palette_global']='cloud'; }
await seed(ctx, extra);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2000);
if(THEME==='light'){ await shot(page, PFX+'10_home_top'); await page.evaluate(()=>window.scrollTo(0,760)); await sleep(600); await shot(page,PFX+'11_home_islands'); await page.evaluate(()=>window.scrollTo(0,0)); }
let fr = await openIsland(page,'island_animal.html');
await dismissWelcome(page,fr); await sleep(400);
if(THEME==='light'){ await shot(page,PFX+'21_island_animal_top'); await fr.evaluate(()=>window.scrollTo(0,480)); await sleep(500); await shot(page,PFX+'22_island_animal_modes'); await fr.evaluate(()=>window.scrollTo(0,0)); }
async function activeInfo(){
  return fr.evaluate(()=>{
    const a=document.querySelector('.screen.active'); if(!a) return null;
    const vis=e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0;};
    const bb=a.querySelector('.back-btn'); let back=null;
    if(bb&&vis(bb)){const r=bb.getBoundingClientRect();const c=getComputedStyle(bb);back={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),bg:c.backgroundColor,br:c.borderRadius,fs:c.fontSize,color:c.color,txt:bb.innerText.trim()};}
    const btns=[...a.querySelectorAll('button')].filter(vis).slice(0,8).map(b=>{const c=getComputedStyle(b);return {t:b.innerText.trim().slice(0,12),br:c.borderRadius,bg:(c.backgroundImage!=='none'?c.backgroundImage.slice(0,60):c.backgroundColor),fs:c.fontSize,fw:c.fontWeight,ff:c.fontFamily.split(',')[0]};});
    const h=[...a.querySelectorAll('h1,h2,h3,.screen-title,.title')].filter(vis).slice(0,3).map(e=>{const c=getComputedStyle(e);return {t:e.innerText.trim().slice(0,16),fs:c.fontSize,ff:c.fontFamily.split(',')[0],color:c.color};});
    return {id:a.id, back, btns, h};
  });
}
async function modalShot(name){
  const m = await fr.evaluate(()=>{const m=document.querySelector('#alertModal.show,.modal-bg.show'); if(!m) return null; const inner=m.querySelector('.modal,.alert-inner,#alertInner')||m.firstElementChild; const c=inner?getComputedStyle(inner):null; return {id:m.id, cls:m.className, br:c&&c.borderRadius, bg:c&&(c.backgroundImage!=='none'?c.backgroundImage.slice(0,70):c.backgroundColor), txt:m.innerText.slice(0,80)};});
  if(m){ await shot(page,name); notes.push(name+' MODAL '+JSON.stringify(m)); return m; }
  return null;
}
async function closeModals(){
  for(let i=0;i<4;i++){
    const has = await fr.evaluate(()=>!!document.querySelector('#alertModal.show,.modal-bg.show'));
    if(!has) break;
    await fr.evaluate(()=>{ const m=document.querySelector('#alertModal.show,.modal-bg.show'); const b=m&&m.querySelector('button'); if(b) b.click(); else m&&m.classList.remove('show'); });
    await sleep(400);
  }
}
async function back(){
  await closeModals();
  const ok = await fr.evaluate(()=>{const a=document.querySelector('.screen.active'); const b=a&&a.querySelector('.back-btn'); if(b){ b.click(); return true;} return false;});
  if(!ok) await fr.evaluate(()=>window.showScreen&&showScreen('home'));
  await sleep(600);
  // also remove any full-screen overlays added by modules
}
async function openByCard(text, name, after){
  try{
    await fr.evaluate(()=>window.scrollTo(0,0));
    const loc = fr.locator('.mode-card, .util-card, .daily-card, .nav-item', { hasText: text }).first();
    await loc.evaluate(el=>el.scrollIntoView({block:'center'})); await sleep(300);
    const bb = await loc.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
    await sleep(1600);
    await shot(page, name);
    const ai = await activeInfo(); metrics[name]=ai;
    const m = await modalShot(name+'_modal');
    if(after) await after(name);
  }catch(e){ notes.push('ERR '+name+' '+e.message.slice(0,200)); }
}
async function answerFirst(name, sels){
  for(const s of sels){
    const loc = fr.locator(s); const n = await loc.count();
    if(n){ for(let i=0;i<n;i++){ const bb = await loc.nth(i).boundingBox(); if(bb && bb.width>20 && bb.y>0 && bb.y<844){ await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2); await sleep(500); await shot(page, name+'_answered'); await sleep(900); await modalShot(name+'_answered_modal'); return s; } } }
  }
  notes.push('no answer target '+name); return null;
}
// ---- utility screens ----
await openByCard('每日宝箱', PFX+'40_chest', async n=>{ await answerFirst(n, ['#chestScreen button','#chestScreen .chest, #chestScreen [onclick]']); }); await back();
await openByCard('每日任务', PFX+'41_quests'); await back();
await openByCard('成就', PFX+'42_achievements'); await back();
await openByCard('统计', PFX+'43_stats'); await back();
await openByCard('设置', PFX+'44_settings', async n=>{ await fr.evaluate(()=>window.scrollTo(0,700)); await sleep(500); await shot(page,n+'_b'); await fr.evaluate(()=>window.scrollTo(0,1500)); await sleep(500); await shot(page,n+'_c'); }); await back();
await openByCard('主题商店', PFX+'45_themeshop', async n=>{ await fr.evaluate(()=>window.scrollTo(0,700)); await sleep(500); await shot(page,n+'_b'); }); await back();
await openByCard('装备', PFX+'46_gear'); await back();
await openByCard('我的学习', PFX+'47_mylearning'); await back();
// pet: tap hero
try{ const loc=fr.locator('.hero').first(); const bb=await loc.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2); await sleep(1500); await shot(page,PFX+'48_pet'); metrics[PFX+'48_pet']=await activeInfo(); await back(); }catch(e){notes.push('pet err '+e.message);}
// avatar
try{ const loc=fr.locator('#avatarIcon'); const bb=await loc.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2); await sleep(1500); await shot(page,PFX+'49_avatar'); await page.keyboard.press('Escape'); await sleep(300);}catch(e){notes.push('avatar err '+e.message);}
await fr.evaluate(()=>{ document.querySelectorAll('[id^=hsnAv],[id*=avatar][style*=fixed]').forEach(e=>{}); });
await back();
// nav
await openByCard('错题', PFX+'50_nav_wrong'); await back();
await openByCard('复习', PFX+'51_nav_review'); await fr.evaluate(()=>{ try{ window.HansenReview && HansenReview._close && HansenReview._close(); }catch(e){} }); await back();
await openByCard('卡册', PFX+'52_nav_cards'); await back();
fs.writeFileSync(OUT+`/seg2_${THEME}_notes.json`, JSON.stringify({notes,metrics,errs,external:[...new Set(external)],r404:reqLog},null,1));
console.log(notes.join('\n')); console.log('errs',errs.slice(0,20)); console.log('ext',[...new Set(external)]); console.log('404',reqLog);
await browser.close(); srv.close();
