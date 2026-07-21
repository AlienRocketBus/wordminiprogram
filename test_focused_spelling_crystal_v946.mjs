#!/usr/bin/env node
// v946 探索聚焦 Spelling Bee：速度门槛、proof 防伪、单通道锁星、ACK 重放与强化回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
let server=null,browser=null;
const listen=s=>new Promise((ok,fail)=>{s.once('error',fail);s.listen(0,'127.0.0.1',ok);});
const closeServer=s=>new Promise(ok=>{if(!s||!s.listening)return ok();s.close(()=>ok());try{s.closeAllConnections?.();}catch(_){}});

async function beeFrame(page){
  await page.waitForSelector('#hsnSbOverlay iframe');
  await page.waitForFunction(()=>document.querySelector('#hsnSbOverlay iframe')?.contentWindow?._sbFocus);
  return page.frames().find(f=>/spelling_bee\.html/.test(f.url()));
}
async function state(page,index){
  return page.evaluate(i=>{
    const crystal=HansenCrystal.sliceProgress().items[i],canonical=HansenCanonical.sliceSnapshot().items[i];
    return {lv:crystal.lv,p:crystal.p,locked:crystal.lockedToday,done:crystal.done,mastery:canonical.mastery,mc:+(S.mc[i]||0)};
  },index);
}
async function focusWin(frame){
  return frame.evaluate(()=>{
    // 用游戏自己的完整拼写结算函数驱动边界；不直接写 storage/progress。
    if(!document.getElementById('game').classList.contains('on')){
      window.speakThen=function(_word,cb){cb();};
      S.manualNext=true;startMatch();
    }
    clearTimeout(botTimer);stopTimer();raceOver=false;curWord=_sbFocus.word;target=letters(curWord);
    yourInput=target;started=Date.now()-500;wKeys=Math.max(2,target.length);wFirst=started;wLast=Date.now();
    finish('you');
    return {wins:_sbFocus.wins,required:_sbFocus.required,attempts:_sbFocus.attempts,pending:_sbFocus.pending,acked:_sbFocus.acked};
  });
}
async function nextFocusRound(frame){
  await frame.evaluate(()=>{if(_sbFocus.pending||_sbFocus.acked)return;qIdx++;nextWord();clearTimeout(botTimer);stopTimer();});
}

async function run(){
  const beeHtml=fs.readFileSync(path.join(ROOT,'spelling_bee.html'),'utf8');
  const finishBlock=beeHtml.slice(beeHtml.indexOf('function finish(who)'),beeHtml.indexOf('function endMatch()'));
  assert.doesNotMatch(finishBlock,/sbQueueMastery\(/,'普通 Bee 不得再生成 mastery receipt');
  assert.match(beeHtml,/function sbFocusRule\(cpm\)/);
  assert.match(beeHtml,/cpm>=80\?\{tier:'advanced',required:5/);
  assert.match(beeHtml,/cpm>=50\?\{tier:'intermediate',required:7/);

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
  await context.addInitScript(()=>{if(window.top===window){localStorage.clear();sessionStorage.clear();localStorage.setItem('hsnViewMode','desktop');localStorage.setItem('hansen_onboarded','1');}});
  const page=await context.newPage();page.setDefaultTimeout(15_000);page.setDefaultNavigationTimeout(25_000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin+'/island_action.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenSpellBee&&window.HansenSpellingProgressV946&&window.HansenCrystal&&window.HansenCanonical);
  await page.evaluate(()=>{try{closeAlert();}catch(e){}window.__focusMessages=[];addEventListener('message',e=>{if(e.data?.type==='hsn_sb_focus_complete')window.__focusMessages.push(JSON.parse(JSON.stringify(e.data)));});});

  // 通用选择题/直接 markAnswer 没有瞬时 proof，不能推进任一成长通道。
  const genericBefore=await state(page,2);await page.evaluate(()=>markAnswer(2,true));const genericAfter=await state(page,2);
  assert.equal(genericAfter.lv,genericBefore.lv);assert.equal(genericAfter.p,genericBefore.p);assert.equal(genericAfter.mastery,genericBefore.mastery);

  // 80 CPM = 高级档，边界必须是 5 次。伪造 postMessage 没有同源 pending proof，必须失败。
  assert.equal(await page.evaluate(()=>HansenSpellBee.openFocused(0)),true);
  let frame=await beeFrame(page);
  assert.equal(await frame.evaluate(()=>sbFocusRule(49).required),10);
  assert.equal(await frame.evaluate(()=>sbFocusRule(50).required),7);
  assert.equal(await frame.evaluate(()=>sbFocusRule(79).required),7);
  assert.equal(await frame.evaluate(()=>sbFocusRule(80).required),5);
  await frame.locator('[data-bot="hard"]').click();
  assert.match(await frame.locator('#sbFocusLive').textContent(),/需要先拼对 5 次/);
  const before=await state(page,0),session=await frame.evaluate(()=>_sbFocus.sessionId);
  await frame.evaluate(()=>parent.postMessage({type:'hsn_sb_focus_complete',schema:1,sessionId:_sbFocus.sessionId,focused:true,channel:'crystal',island:_sbIsland,index:_sbFocus.index,word:_sbFocus.word.en.toLowerCase(),cpm:80,tier:'advanced',required:5,wins:5,attempts:5,createdAt:Date.now()},'*'));
  await page.waitForTimeout(40);assert.deepEqual(await state(page,0),before,'无 pending proof 的伪消息不得锁星');

  for(let i=1;i<=4;i++){
    const progress=await focusWin(frame);assert.equal(progress.wins,i);assert.equal(progress.required,5);
    assert.deepEqual(await state(page,0),before,`第 ${i} 次胜出仍未达到门槛`);
    await nextFocusRound(frame);
  }
  const fifth=await focusWin(frame);assert.equal(fifth.wins,5);await frame.waitForFunction(()=>_sbFocus.acked===true);
  await page.waitForFunction(()=>HansenCrystal.sliceProgress().items[0].lv===1);
  const settled=await state(page,0);assert.equal(settled.lv,1);assert.equal(settled.p,0);assert.equal(settled.locked,true);
  assert.equal(settled.mastery,before.mastery,'结晶通道不能顺带增加宠物 canonical mastery');assert.equal(settled.mc,before.mc);
  assert.equal(await frame.evaluate(()=>Object.hasOwn(JSON.parse(localStorage.getItem('hansen_sb_focus_pending_v946')||'{}'),_sbFocus.sessionId)),false,'ACK 后 child 才清 pending');

  // 重放已完成 proof：同日闸门 + 合约幂等，星级不能二涨；错误 source 也不能结算。
  const proof=await page.evaluate(()=>window.__focusMessages.at(-1));assert.equal(proof.sessionId,session);
  await page.evaluate(p=>{const copy={...p};delete copy.type;localStorage.setItem('hansen_sb_focus_pending_v946',JSON.stringify({[p.sessionId]:copy}));window.postMessage(p,'*');},proof);
  await page.waitForTimeout(40);assert.equal((await state(page,0)).lv,1,'父页面伪造 source 必须拒绝');
  await frame.evaluate(p=>parent.postMessage(p,'*'),proof);await page.waitForTimeout(60);assert.equal((await state(page,0)).lv,1,'重复 proof 不得重复锁星');
  await page.evaluate(()=>HansenSpellBee.close());await page.waitForFunction(()=>!document.getElementById('hsnSbOverlay'));
  assert.equal(await page.evaluate(()=>HansenSpellBee.openFocused(0)),false,'同词当天锁星后不得再次启动');

  // 记忆强化不减少高级档 5 次，但达标后按既有权益锁 2 星。
  await page.evaluate(()=>HansenCrystal.grantBoost(10,true));
  assert.equal(await page.evaluate(()=>HansenCrystal.isBoosted()),true,'测试前记忆强化必须有效');
  assert.equal(await page.evaluate(()=>HansenSpellBee.openFocused(1)),true);frame=await beeFrame(page);await frame.locator('[data-bot="hard"]').click();
  const boostBefore=await state(page,1);
  for(let i=1;i<=5;i++){const p=await focusWin(frame);assert.equal(p.required,5);if(i<5){assert.equal((await state(page,1)).lv,boostBefore.lv);await nextFocusRound(frame);}}
  await frame.waitForFunction(()=>_sbFocus.acked===true);
  await page.waitForFunction(()=>HansenCrystal.sliceProgress().items[1].lv>=1);
  const boosted=await state(page,1);assert.equal(boosted.lv,2);assert.equal(boosted.mastery,boostBefore.mastery);assert.equal(boosted.mc,boostBefore.mc);

  assert.deepEqual(errors,[],'聚焦 Bee 不得出现页面或控制台异常');
  await context.close();
}

try{await run();console.log('focused Spelling Bee v946: 10/7/5 boundary + proof/ACK/replay + channel isolation + boost ✅');}
finally{if(browser)await browser.close().catch(()=>{});await closeServer(server);}
