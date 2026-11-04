// shared navigation helpers: home -> skip onboarding -> season bar -> land_map -> island landN
import { tap, byText, waitFor, sleep } from './lib.mjs';

export async function homeReady(page, port){
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'domcontentloaded'});
  await waitFor(()=>page.evaluate(()=>document.readyState==='complete'), {timeout:20000});
  await sleep(1500);
  // onboarding skip
  const skip = await waitFor(async()=>{ const h = await byText(page.mainFrame(), '#__hansen_onboarding button', /^跳过$/); return h; }, {timeout:6000});
  let r = null;
  if(skip){ r = await tap(page, page.mainFrame(), skip, {label:'跳过'}); await sleep(700); }
  return {skipTap:r};
}
export async function getFrame(page, re, ready, timeout=15000){
  return waitFor(async()=>{
    const f = page.frames().find(f=>re.test(f.url()) && f.parentFrame()===page.mainFrame());
    if(!f) return null;
    try{ if(ready && !(await f.evaluate(ready))) return null; }catch(e){ return null; }
    return f;
  }, {timeout});
}
export async function openLandMapFromHome(page){
  const bar = await waitFor(()=>page.$('#hsnSeasonBar'), {timeout:8000});
  if(!bar) return {ok:false, why:'no #hsnSeasonBar'};
  const r = await tap(page, page.mainFrame(), bar, {label:'season bar'});
  const M = await getFrame(page, /\/land_map\.html/, ()=>document.querySelectorAll('.spot').length>=9);
  await sleep(600);
  return {ok:!!M, tap:r, M};
}
export async function enterLandFromMap(page, M, n){
  const spots = await M.$$('.spot');
  const r1 = await tap(page, M, spots[n-1], {label:'spot '+n});
  await sleep(500);
  const enter = await M.$('#pfoot .pbtn.enter');
  const r2 = await tap(page, M, enter, {label:'进入学习'});
  const F = await getFrame(page, new RegExp('/island_land'+n+'\\.html'), ()=>typeof allW!=='undefined' && document.readyState!=='loading', 20000);
  await sleep(1200);
  return {F, r1, r2};
}
export async function closeWelcome(page, F){
  // island welcome: alertModal with 开始冒险！
  const b = await waitFor(async()=>{ const m = await F.$('#alertModal.show'); if(!m) return null; return byText(F, '#alertModal button', /开始冒险/); }, {timeout:5000});
  let r=null;
  if(b){ r = await tap(page, F, b, {label:'开始冒险'}); await sleep(600); }
  // story / other overlays: try generic close
  return r;
}
export async function activeScreen(F){
  return F.evaluate(()=>{ const a=document.querySelector('.screen.active'); return a?a.id:null; });
}
export async function tapModeCard(page, F, re){
  await F.evaluate(()=>{ try{ if(document.querySelector('.screen.active').id!=='homeScreen') showScreen('home'); }catch(e){} });
  await sleep(300);
  const h = await byText(F, '#homeScreen .mode-card', re);
  if(!h) return {ok:false, why:'no card '+re};
  return tap(page, F, h, {label:String(re)});
}
