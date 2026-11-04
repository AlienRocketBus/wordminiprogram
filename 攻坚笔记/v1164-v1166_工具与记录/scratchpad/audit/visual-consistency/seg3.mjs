import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome } from './lib2.mjs';
import fs from 'node:fs';
const THEME = process.argv[2] || 'dark';
const PFX = THEME==='dark' ? 'd' : 'l';
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const ISL = process.argv[4] || 'island_animal.html';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const notes=[]; const metrics={};
const ctx = await newCtx(browser,{dsf:2});
const extra = {'hansen_wallet_coins':'300'};
if(THEME==='light'){ extra['hansen_palette_global']='cloud'; }
await seed(ctx, extra);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
let fr;
async function fresh(){
  await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(1500);
  fr = await openIsland(page,ISL); await dismissWelcome(page,fr); await sleep(300);
}
async function tapCard(text){
  const loc = fr.locator('.mode-card', { hasText: text }).first();
  await loc.evaluate(el=>el.scrollIntoView({block:'center'})); await sleep(300);
  const bb = await loc.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
}
async function tapCandidate(extraSel=''){
  const pt = await fr.evaluate((extraSel)=>{
    const a=document.querySelector('.screen.active'); if(!a) return null;
    const sel='.boss-opt,.cloze-opt,.exp-card,.match-card,.mole-slot,.scramble-letter,.key,.eagle-opt,.speed-opt,.fish-item,.bubble,.typing-opt,.type-mode,[onclick]'+(extraSel?','+extraSel:'');
    const els=[...a.querySelectorAll(sel)].filter(e=>!e.closest('.back-btn')&&!e.classList.contains('back-btn')).filter(e=>{const r=e.getBoundingClientRect(); const c=getComputedStyle(e); return r.width>24&&r.height>24&&r.top>90&&r.bottom<window.innerHeight-10&&c.visibility!=='hidden'&&c.display!=='none';});
    if(!els.length) return null; const e=els[0]; const r=e.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2,d:e.tagName+'.'+String(e.className).slice(0,30)+' '+(e.innerText||'').slice(0,15)};
  }, extraSel);
  if(!pt) return null;
  const off = await page.evaluate(()=>{const r=document.getElementById('islandFrame').getBoundingClientRect(); return {x:r.left,y:r.top};});
  await page.touchscreen.tap(pt.x+off.x, pt.y+off.y);
  return pt.d;
}
async function info(){
  return fr.evaluate(()=>{
    const a=document.querySelector('.screen.active'); if(!a) return null;
    const vis=e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden';};
    const bb=a.querySelector('.back-btn'); let back=null;
    if(bb&&vis(bb)){const r=bb.getBoundingClientRect();back={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};}
    const t=a.querySelector('.screen-title'); const tc=t&&getComputedStyle(t);
    const topbar=document.querySelector('.top-bar,.topbar,#topBar,header'); const tb=topbar&&topbar.getBoundingClientRect();
    return {id:a.id, back, title:t&&{txt:t.innerText.trim().slice(0,20),fs:tc.fontSize,ff:tc.fontFamily.split(',')[0],vis:vis(t)}, topbarVisible: !!(topbar&&vis(topbar)), modal: !!document.querySelector('#alertModal.show,.modal-bg.show')};
  });
}
const games = [
  ['explore','探索单词'],['listen','听音辨义'],['match','记忆翻牌'],['typing','打字大师'],['cloze','完形填空'],['scramble','字母拼拼乐'],
  ['moles','打地鼠'],['fish','钓鱼大师'],['bubble','泡泡大作战'],['speed','极速60秒'],['eagle','火眼金睛'],['gacha','抽卡'],['pk','拼写大PK']
];
let i=60;
for(const [k,txt] of games){
  i++;
  if(ONLY && !ONLY.includes(k)) continue;
  try{
    await fresh();
    await tapCard(txt); await sleep(1800);
    await shot(page, `${PFX}${i}_game_${k}_start`);
    metrics[k+'_start']=await info();
    const d1 = await tapCandidate(); notes.push(k+' tap1 '+d1);
    await sleep(700); await shot(page, `${PFX}${i}_game_${k}_play`);
    const d2 = await tapCandidate(); notes.push(k+' tap2 '+d2);
    await sleep(1500); await shot(page, `${PFX}${i}_game_${k}_play2`);
    metrics[k+'_play']=await info();
  }catch(e){ notes.push('ERR '+k+' '+e.message.slice(0,200)); }
}
fs.writeFileSync(OUT+`/seg3_${THEME}_notes.json`, JSON.stringify({notes,metrics,errs,external:[...new Set(external)],r404:reqLog},null,1));
console.log(notes.join('\n')); console.log(JSON.stringify(metrics)); console.log('errs',errs.slice(0,30)); console.log('ext',[...new Set(external)]); console.log('404',reqLog);
await browser.close(); srv.close();
