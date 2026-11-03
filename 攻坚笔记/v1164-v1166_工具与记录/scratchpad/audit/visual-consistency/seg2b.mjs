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
  const order = await fr.evaluate(()=>[...document.querySelectorAll('.util-card')].map(e=>e.innerText.trim()).join('|'));
  notes.push('utilorder '+order);
  return fr;
}
async function tapIn(selOrText, isText){
  const loc = isText ? fr.locator('.mode-card, .util-card, .daily-card, .nav-item', { hasText: selOrText }).first() : fr.locator(selOrText).first();
  await loc.evaluate(el=>el.scrollIntoView({block:'center'})); await sleep(300);
  const bb = await loc.boundingBox(); await page.touchscreen.tap(bb.x+bb.width/2, bb.y+bb.height/2);
}
const targets = {
  mylearning: async()=>{ await tapIn('我的学习',true); await sleep(1500); await shot(page,PFX+'47_mylearning'); await page.mouse.wheel(0,600); await sleep(500); await shot(page,PFX+'47_mylearning_b'); },
  gear: async()=>{ await tapIn('装备',true); await sleep(1500); await shot(page,PFX+'46_gear'); },
  pet: async()=>{ await tapIn('.hero'); await sleep(1500); await shot(page,PFX+'48_pet'); await fr.evaluate(()=>window.scrollTo(0,600)); await sleep(500); await shot(page,PFX+'48_pet_b'); },
  avatar: async()=>{ await tapIn('#avatarIcon'); await sleep(1500); await shot(page,PFX+'49_avatar'); },
  wrong: async()=>{ await tapIn('#navWrong, .nav-item:has-text("错题")'); await sleep(1500); await shot(page,PFX+'50_nav_wrong'); },
  review: async()=>{ await tapIn('#navReview'); await sleep(1500); await shot(page,PFX+'51_nav_review'); },
  cards: async()=>{ await tapIn('#navCards'); await sleep(1500); await shot(page,PFX+'52_nav_cards'); await fr.evaluate(()=>window.scrollTo(0,700)); await sleep(500); await shot(page,PFX+'52_nav_cards_b'); },
  boss: async()=>{ await tapIn('挑战BOSS',true); await sleep(2000); await shot(page,PFX+'53_boss'); await sleep(2500); await shot(page,PFX+'53_boss_b'); },
  spellbee: async()=>{ await tapIn('spelling bee',true); await sleep(4000); await shot(page,PFX+'54_spellbee'); },
};
for(const [k,fn] of Object.entries(targets)){
  if(ONLY && !ONLY.includes(k)) continue;
  try{ await fresh(); await fn(); }catch(e){ notes.push('ERR '+k+' '+e.message.slice(0,200)); }
}
fs.writeFileSync(OUT+`/seg2b_${THEME}_notes.json`, JSON.stringify({notes,errs,external:[...new Set(external)],r404:reqLog},null,1));
console.log(notes.join('\n')); console.log('errs',errs.slice(0,20)); console.log('ext',[...new Set(external)]); console.log('404',reqLog);
await browser.close(); srv.close();
