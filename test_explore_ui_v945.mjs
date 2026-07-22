#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';
/* v963 dyn */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
let server=null,browser=null;
const listen=s=>new Promise((ok,fail)=>{s.once('error',fail);s.listen(0,'127.0.0.1',ok);});
const closeServer=s=>new Promise(ok=>{if(!s||!s.listening)return ok();s.close(()=>ok());try{s.closeAllConnections?.();}catch(_){}});

async function run(){
  server=http.createServer((request,response)=>{
    try{
      const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
      const rel=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(ROOT,rel);
      if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw new Error('not found');
      response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(response);
    }catch(e){response.writeHead(404).end('not found');}
  });
  await listen(server);const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('hsnViewMode','desktop');localStorage.setItem('hansen_onboarded','1');});
  const page=await context.newPage();page.setDefaultTimeout(12_000);page.setDefaultNavigationTimeout(20_000);
  const pageErrors=[],consoleErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.goto(origin+'/island_action.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenExploreProgress&&window.HansenCrystal&&window.HsnPet);
  await page.evaluate(()=>showScreen('explore'));await page.waitForSelector('.hxp-overview');
  await page.waitForTimeout(450);await page.evaluate(()=>{try{closeAlert();}catch(e){document.getElementById('alertModal')?.classList.remove('show');}});

  for(const [width,columns] of [[320,2],[375,2],[390,2],[430,2],[500,3]]){
    await page.setViewportSize({width,height:720});await page.waitForTimeout(30);
    const layout=await page.evaluate(()=>({
      columns:getComputedStyle(document.querySelector('#exploreContent .explore-grid')).gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    }));
    assert.equal(layout.columns,columns,`${width}px must use ${columns} columns`);assert.equal(layout.overflow,0,`${width}px must not overflow horizontally`);
  }
  await page.setViewportSize({width:390,height:720});

  // Re-renders and lifecycle refreshes are idempotent.
  await page.evaluate(()=>{renderExplore();renderExplore();window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new StorageEvent('storage',{key:'unrelated'}));});
  await page.waitForTimeout(50);
  let counts=await page.evaluate(()=>({overview:document.querySelectorAll('.hxp-overview').length,cards:document.querySelectorAll('#exploreContent .exp-card').length,badges:document.querySelectorAll('#exploreContent .hxp-badges').length,scripts:[...document.scripts].filter(s=>/hansen_explore_progress_v945/.test(s.src)).length}));
  assert.deepEqual(counts,{overview:1,cards:67,badges:67,scripts:1});

  // v946 hotfix: this island deliberately puts app-owned <span><svg> word
  // illustrations in the first recommendation chips.  They must remain real
  // icons; exposing their markup as text recreates the giant "<svg ...>" card.
  const recIcons=await page.evaluate(()=>[...document.querySelectorAll('.hxp-rec')].map(button=>({
    text:button.textContent||'',label:button.getAttribute('aria-label')||'',svg:!!button.querySelector('.hxp-rec-icon svg'),
    hidden:button.querySelector('.hxp-rec-icon')?.getAttribute('aria-hidden')||''
  })));
  assert(recIcons.some(x=>x.svg),'at least one app-owned SVG recommendation icon must render as SVG');
  assert(recIcons.every(x=>!/<\/?(?:span|svg)\b/i.test(x.text)),'SVG/HTML source must never be visible recommendation text');
  assert(recIcons.every(x=>!/<\/?(?:span|svg)\b/i.test(x.label)),'accessible labels must never expose SVG/HTML source');
  assert(recIcons.filter(x=>x.svg).every(x=>x.hidden==='true'),'decorative SVG clones must be hidden from screen readers');

  // Filters expose pressed state and exact empty/non-empty sets.
  await page.locator('.hxp-filter[data-filter="pet"]').click();
  assert.equal(await page.locator('.hxp-filter[data-filter="pet"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.exp-card:not([hidden])').count(),67);
  await page.locator('.hxp-filter[data-filter="crystal"]').click();
  assert.equal(await page.locator('.exp-card:not([hidden])').count(),0);assert.equal(await page.locator('.hxp-empty.show').count(),1);
  await page.locator('.hxp-filter[data-filter="all"]').click();

  // At maximum scroll the last card can sit fully above the fixed bottom nav.
  const bottom=await page.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);const card=[...document.querySelectorAll('#exploreContent .exp-card')].at(-1).getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();return {cardBottom:card.bottom,navTop:nav.top};});
  assert(bottom.cardBottom<=bottom.navTop+1,`last card (${bottom.cardBottom}) is covered by bottom nav (${bottom.navTop})`);

  // Keyboard opens the only card action; modal scrolls internally and returns focus on Escape.
  const first=page.locator('#exploreContent .exp-card').first();await first.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{const original=window.showWord;window.__hxpOpenCount=0;window.showWord=function(){window.__hxpOpenCount++;return original.apply(this,arguments);};});
  await first.focus();await page.keyboard.press('Enter');await page.waitForSelector('#wordModal.show');
  assert.equal(await page.evaluate(()=>window.__hxpOpenCount),1,'Enter must open one detail, not trigger duplicate accessibility handlers');
  const dialog=await page.evaluate(()=>{const m=document.getElementById('modalInner'),s=m.querySelector('.hxp-modal-scroll'),x=m.querySelector('.close');s.scrollTop=s.scrollHeight;const xr=x.getBoundingClientRect();return {role:m.getAttribute('role'),modal:m.getAttribute('aria-modal'),scrollable:s.scrollHeight>=s.clientHeight,closeVisible:xr.top>=0&&xr.bottom<=innerHeight,active:document.activeElement===x,nestedButtons:document.querySelectorAll('#exploreContent .exp-card button').length};});
  assert.equal(dialog.role,'dialog');assert.equal(dialog.modal,'true');assert.equal(dialog.scrollable,true);assert.equal(dialog.closeVisible,true);assert.equal(dialog.active,true);assert.equal(dialog.nestedButtons,0,'a word card must remain the only tap target');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('wordModal').classList.contains('show'));await page.waitForTimeout(20);
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#exploreContent .exp-card')),true,'closing the modal must return focus to its card');

  // A generic quiz answer still updates ordinary bookkeeping, but can no longer
  // advance either pet mastery or crystal progress.
  const before=await page.evaluate(()=>({answers:S.totalAnswers,mc:+(S.mc[0]||0),canonical:HansenCanonical.sliceSnapshot().items[0].mastery,cr:HansenCrystal.sliceProgress().items[0]}));
  await page.evaluate(()=>markAnswer(0,true));
  const after=await page.evaluate(()=>({answers:S.totalAnswers,mc:+(S.mc[0]||0),canonical:HansenCanonical.sliceSnapshot().items[0].mastery,cr:HansenCrystal.sliceProgress().items[0]}));
  assert.equal(after.answers,before.answers+1);assert.equal(after.mc,before.mc);assert.equal(after.canonical,before.canonical);
  assert.equal(after.cr.p,before.cr.p);assert.equal(after.cr.lv,before.cr.lv);

  // Explore no longer creates its own easy quiz: the pet button enters the real
  // Typing Master focused target, and leaving it returns to Explore.
  await first.click();await page.locator('[data-hxp-launch="pet"]').click();
  await page.waitForSelector('#typingScreen.active .htm-focus-head');
  const typingRoute=await page.evaluate(()=>({state:HansenTypingMasterV946.state(),legacy:!!document.getElementById('hxpPractice'),modal:document.getElementById('wordModal').classList.contains('show')}));
  assert.equal(typingRoute.state.idx,0);assert.equal(typingRoute.legacy,false);assert.equal(typingRoute.modal,false);
  await page.evaluate(()=>HansenTypingMasterV946.exit());await page.waitForSelector('#exploreScreen.active .hxp-overview');

  // The crystal button enters a single-target Spelling Bee iframe; it does not
  // expose an inline choice shortcut.
  await page.locator('#exploreContent .exp-card').first().click();await page.locator('[data-hxp-launch="crystal"]').click();
  await page.waitForSelector('#hsnSbOverlay iframe');
  const beeSrc=await page.locator('#hsnSbOverlay iframe').getAttribute('src');
  assert.match(beeSrc,/focus=crystal/);assert.match(beeSrc,/index=0/);assert.match(beeSrc,/session=/);
  assert.equal(await page.locator('#hxpPractice').count(),0);
  await page.evaluate(()=>HansenSpellBee.close());await page.waitForFunction(()=>!document.getElementById('hsnSbOverlay'));

  assert.deepEqual(pageErrors,[],'no page exceptions allowed');assert.deepEqual(consoleErrors,[],'no console errors allowed');
  await context.close();
}

try{await run();console.log('explore UI v945/v946: responsive layout + dialog a11y + quiz bypass closed + real-game routing ✅');}
finally{if(browser)await browser.close().catch(()=>{});await closeServer(server);}
