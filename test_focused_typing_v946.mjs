#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const pages=['template.html',...fs.readdirSync(ROOT).filter(n=>/^island_[a-z0-9]+\.html$/.test(n)).sort()];
assert.equal(pages.length,28,'template + 27 playable pages must be covered');
for(const name of pages){
  const html=read(name),refs=[...html.matchAll(/<script\b[^>]*src=["']hansen_focused_typing_v946\.js\?v=\d+["'][^>]*>/g)];
  assert.equal(refs.length,1,`${name}: focused typing module must load exactly once`);
  const pet=html.indexOf('src="hansen_pet_showcase.js'),typing=refs[0].index,explore=html.indexOf('src="hansen_explore_progress_v945.js');
  assert(pet>=0&&pet<typing&&typing<explore,`${name}: pet -> focused typing -> explore order required`);
}
assert.match(read('sw_v944.js'),/\.\/hansen_focused_typing_v946\.js/,'focused runtime must be available offline');

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
let server,browser;
const listen=s=>new Promise((ok,fail)=>{s.once('error',fail);s.listen(0,'127.0.0.1',ok);});
const closeServer=s=>new Promise(ok=>{if(!s||!s.listening)return ok();s.close(()=>ok());try{s.closeAllConnections?.();}catch(_){}});

async function run(){
  server=http.createServer((req,res)=>{
    try{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(ROOT,rel);if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw 0;res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);}catch(e){res.writeHead(404).end('not found');}
  });
  await listen(server);const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{if(!sessionStorage.getItem('__htmReload')){localStorage.clear();sessionStorage.setItem('__htmReload','1');}localStorage.setItem('hansen_onboarded','1');localStorage.setItem('hsnViewMode','desktop');});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(origin+'/island_action.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenTypingMasterV946&&window.HansenSpellingProgressV946&&window.HansenCanonical&&window.HsnPet);

  // Direct quiz bookkeeping remains legal, but without a one-use typing proof it cannot move pet mc.
  const bypass=await page.evaluate(()=>{const before=+(S.mc[0]||0);markAnswer(0,true);return {before,after:+(S.mc[0]||0),canonical:HansenCanonical.sliceSnapshot().items[0].mastery};});
  assert.equal(bypass.after,bypass.before,'plain markAnswer(true) must not move local pet mastery');
  assert.equal(bypass.canonical,bypass.before,'plain markAnswer(true) must not move canonical pet mastery');

  const target=1; // come; short and entirely supported by the real game keyboard
  assert.equal(await page.evaluate(i=>HansenTypingMasterV946.openFocus(i),target),true);
  assert.deepEqual(await page.evaluate(()=>{const s=HansenTypingMasterV946.state();return {needed:s.needed,streak:s.streak};}),{needed:3,streak:0});

  async function spell(idx){
    await page.evaluate(i=>{const w=allW[i].en.toLowerCase();for(const ch of w)typeKey(ch);},idx);
  }
  await spell(target);
  await page.waitForFunction(()=>HansenTypingMasterV946.state()?.streak===1);
  let partial=await page.evaluate(i=>({state:HansenTypingMasterV946.state(),mc:+(S.mc[i]||0),canonical:HansenCanonical.sliceSnapshot().items[i].mastery,saved:HansenTypingMasterV946.saved(i)}),target);
  assert.equal(partial.mc,0,'partial streak must not award local mc');assert.equal(partial.canonical,0,'partial streak must not award canonical mc');assert.equal(partial.saved.streak,1,'each exact spelling must persist immediately');

  // Exit and a real reload retain the completed spelling without settling mastery early.
  await page.evaluate(()=>HansenTypingMasterV946.exit());await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenTypingMasterV946&&window.HansenSpellingProgressV946&&window.HansenCanonical);
  assert.equal(await page.evaluate(i=>HansenTypingMasterV946.openFocus(i),target),true);
  assert.equal(await page.evaluate(()=>HansenTypingMasterV946.state().streak),1,'reload must restore the exact-spelling streak');
  assert.equal(await page.evaluate(i=>+(S.mc[i]||0),target),0,'reload must not turn an incomplete streak into mastery');

  // Looking at the answer makes that attempt ineligible and clears the whole consecutive streak.
  await page.evaluate(()=>{typeHint();document.getElementById('typeHintOverlay')?.remove();});
  await spell(target);
  await page.waitForFunction(()=>HansenTypingMasterV946.state()?.eligible===true&&HansenTypingMasterV946.state()?.streak===0&&typeActive===true);
  assert.equal((await page.evaluate(i=>HansenTypingMasterV946.saved(i),target)).streak,0,'hinted attempt must persist as zero streak');

  // A later spelling error also clears a legitimate streak and never awards mc.
  await spell(target);await page.waitForFunction(()=>HansenTypingMasterV946.state()?.streak===1&&typeActive===true);
  await page.evaluate(i=>{const w=allW[i].en.toLowerCase(),bad=w[0]==='z'?'x':'z';typeKey(bad);for(const ch of w.slice(1))typeKey(ch);},target);
  await page.waitForFunction(()=>HansenTypingMasterV946.state()?.eligible===true&&HansenTypingMasterV946.state()?.streak===0&&typeActive===true);
  assert.equal(await page.evaluate(i=>+(S.mc[i]||0),target),0,'wrong spelling must not award mc');

  // Three new consecutive exact spellings settle atomically at the existing mc=3 authority threshold.
  const xpBefore=await page.evaluate(()=>+(localStorage.getItem('hansen_wallet_charxp')||0));
  for(let n=1;n<=3;n++){
    await spell(target);
    if(n<3)await page.waitForFunction(expected=>HansenTypingMasterV946.state()?.streak===expected&&typeActive===true,n);
  }
  await page.waitForFunction(i=>+(S.mc[i]||0)>=3,target);
  const done=await page.evaluate(i=>({state:HansenTypingMasterV946.state(),mc:+(S.mc[i]||0),canonical:HansenCanonical.sliceSnapshot().items[i].mastery,saved:HansenTypingMasterV946.saved(i),xp:+(localStorage.getItem('hansen_wallet_charxp')||0),text:document.getElementById('typingContent').textContent}),target);
  assert.equal(done.mc,3);assert.equal(done.canonical,3);assert.equal(done.saved,null,'settled challenge must remove its resumable record');assert.equal(done.state.done,true);assert(done.xp>=xpBefore+15,'focused completion must award ordinary per-spelling XP');assert.match(done.text,/没有发放整局钻石加成或整局宠物任务奖/);

  // The ordinary Typing Master remains a valid pet path, but only for an exact, no-hint word.
  await page.evaluate(()=>{HansenTypingMasterV946.exit();startTyping(1);});
  await page.waitForFunction(()=>typeof typeWord==='object'&&typeActive===true);
  const normal=await page.evaluate(()=>({idx:typePool[typeIdx],before:+(S.mc[typePool[typeIdx]]||0),word:typeWord.en.toLowerCase()}));
  await page.evaluate(word=>{for(const ch of word)typeKey(ch);},normal.word);
  await page.waitForFunction(({idx,before})=>+(S.mc[idx]||0)===before+1,normal);
  assert.equal(await page.evaluate(i=>HansenCanonical.sliceSnapshot().items[i].mastery,normal.idx),normal.before+1,'ordinary exact Typing Master must sync canonical mc');
  await page.evaluate(()=>stopTyping());

  // Focus mode must also support every spelling shape present in the real word bank.
  // T-shirt is the only hyphenated entry; multi-word entries use the existing space key.
  await page.goto(origin+'/island_clothes.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenTypingMasterV946&&window.HansenSpellingProgressV946&&window.HansenCanonical);
  assert.equal(await page.evaluate(()=>HansenTypingMasterV946.openFocus(2)),true);
  assert.equal(await page.locator('[data-htm-hyphen="1"]').count(),1,'focused keyboard must expose one hyphen key');
  await page.evaluate(()=>{for(const ch of allW[2].en.toLowerCase())typeKey(ch);});
  await page.waitForFunction(()=>HansenTypingMasterV946.state()?.streak===1);
  assert.equal(await page.evaluate(()=>HansenTypingMasterV946.saved(2)?.streak),1,'hyphenated exact spelling must persist');
  await page.evaluate(()=>HansenTypingMasterV946.exit());

  await page.goto(origin+'/island_city.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenTypingMasterV946&&window.HansenSpellingProgressV946&&window.HansenCanonical);
  assert.equal(await page.evaluate(()=>HansenTypingMasterV946.openFocus(7)),true);
  assert.equal(await page.locator('#typingScreen .key.space').count(),1,'focused keyboard must retain the space key');
  await page.evaluate(()=>{for(const ch of allW[7].en.toLowerCase())typeKey(ch);});
  await page.waitForFunction(()=>HansenTypingMasterV946.state()?.streak===1);
  assert.equal(await page.evaluate(()=>HansenTypingMasterV946.saved(7)?.streak),1,'multi-word exact spelling must persist');

  assert.deepEqual(pageErrors,[],'no browser exceptions allowed');
  await context.close();
}

try{await run();console.log('focused typing v946: proof gate + exact streak + hint/wrong reset + reload persistence + canonical settlement ✅');}
finally{if(browser)await browser.close().catch(()=>{});await closeServer(server);}
