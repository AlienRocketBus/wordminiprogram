import { startServer, launch, newCtx, attachLogs, sleep, OUT, external, reqLog } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome, islandFrame } from './lib2.mjs';
import { measure } from './contrastlib.mjs';
import fs from 'node:fs';
const MODE = process.argv[2] || 'dark'; // dark | cloud | pink
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const results=[]; const notes=[];
const ctx = await newCtx(browser,{dsf:1});
const extra = {'hansen_wallet_coins':'300'};
if(MODE==='cloud') extra['hansen_palette_global']='cloud';
if(MODE==='pink') extra['theme']='pink';
await seed(ctx, extra);
const page = await ctx.newPage(); attachLogs(page,'top',errs);
await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(2500);
const main = page.mainFrame();
const homeSel = [['.tagline','home tagline'],['.subtitle','home subtitle'],['.intro','home intro'],['.stat-lbl','home stat label'],['.stat-num','home stat number'],['#recentLbl','home recent label']];
for(const [s,l] of homeSel) results.push(...await measure(page, main, s, l, 2));
await page.evaluate(()=>window.scrollTo(0,760)); await sleep(600);
for(const [s,l] of [['.island-en','home island EN label'],['.island-name','home island name'],['.island .enter','home island enter btn']]) results.push(...await measure(page, main, s, l, 2));
await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await sleep(600);
for(const [s,l] of [['.how-step .desc','home how-step desc'],['.how-step .title','home how-step title'],['.foot-tip','home footer tip'],['.feedback-sub, #feedbackBtn + div','home feedback sub']]) results.push(...await measure(page, main, s, l, 2));
await page.evaluate(()=>window.scrollTo(0,0)); await sleep(300);
let fr = await openIsland(page,'island_animal.html'); await dismissWelcome(page,fr); await sleep(500);
await shot(page, 'c_'+MODE+'_island_top', {});
const islSel = [['.top-name','island header level'],['.xp-text','island header xp'],['.hsn-streak-inline','island header streak'],['#homeScreen>div:first-child>div:last-child','island EN subtitle'],['.pet-text','island pet desc'],['#hr_review_banner div div:last-child','review banner subtitle'],['.section-label','island section label'],['.mode-card .m-name, .mode-card .mode-name, .mode-card div:last-child','mode card label'],['.nav-item .ni-label','bottom nav label'],['.daily-card .d-label, .daily-card div:last-child','daily card label']];
for(const [s,l] of islSel) results.push(...await measure(page, fr, s, l, 2));
await fr.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await sleep(500);
results.push(...await measure(page, fr, '.util-card .u-label', 'util card label', 2));
// subscreens
async function sub(fn, sels, name){
  await fr.evaluate(fn); await sleep(1200);
  await shot(page, 'c_'+MODE+'_'+name);
  for(const [s,l] of sels) results.push(...await measure(page, fr, s, l, 2));
  await fr.evaluate(()=>{ try{showScreen('home')}catch(e){} }); await sleep(500);
}
await sub(()=>showScreen('quests'), [['#questsScreen .screen-title + div','quests subtitle'],['#questsScreen [class*=quest] [class*=prog], #questsScreen [class*=quest] div:last-child','quest progress text'],['.back-btn','back button']], 'quests');
await sub(()=>showScreen('ach'), [['#achScreen .screen-title + div','ach subtitle'],['#achScreen [class*=desc]','ach desc (locked)']], 'ach');
await sub(()=>showScreen('settings'), [['#settingsScreen [class*=desc], #settingsScreen .set-desc','settings desc']], 'settings');
await sub(()=>showTypingMenu(), [['#typingScreen [class*=medal] div:last-child, #typingScreen [class*=best] div:last-child','typing medal empty text']], 'typing');
await sub(()=>showScreen('explore'), [['#exploreScreen .screen-title + div','explore subtitle']], 'explore');
await sub(()=>showScreen('chest'), [['#chestScreen [class*=rule], #chestScreen p','chest rules']], 'chest');
// wrong overview footnote
try{ await fr.evaluate(()=>document.getElementById('navExplore').click()); await sleep(1200); await shot(page,'c_'+MODE+'_wrong'); results.push(...await measure(page, fr, '[id^=hwo] div', 'wrong overview text', 12)); }catch(e){ notes.push('wrong err '+e.message); }
fs.writeFileSync(OUT+`/contrast_${MODE}.json`, JSON.stringify({results,notes,errs},null,1));
for(const r of results){ console.log([r.label, JSON.stringify(r.txt), r.fs, r.textColor, r.bgMean, 'mean='+r.crMean, 'p10='+r.crP10, r.note||''].join(' | ')); }
console.log(notes, errs.slice(0,10));
await browser.close(); srv.close();
