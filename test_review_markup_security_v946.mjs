#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const reviewSource=fs.readFileSync(path.join(ROOT,'hansen_review.js'),'utf8');
const overviewSource=fs.readFileSync(path.join(ROOT,'hansen_wrong_overview.js'),'utf8');
const beeSource=fs.readFileSync(path.join(ROOT,'spelling_bee.html'),'utf8');

assert.match(reviewSource,/MAX_SMART_WEIGHT\s*=\s*20/,'review smart-pool weight needs a hard ceiling of 20');
assert.match(overviewSource,/MAX_SMART_WEIGHT\s*=\s*20/,'cross-island context needs the same weight ceiling');
assert.doesNotMatch(reviewSource,/\$\{w(?:\.word)?\.emoji\s*\|\|/,'review HTML must not interpolate a raw word emoji');
assert.doesNotMatch(reviewSource,/\$\{w\.count\}/,'review HTML must not interpolate a raw wrong count');
assert.match(beeSource,/sbEsc\(S\.botName\s*\|\|\s*['"]机器人['"]\)/,'lane result must escape the editable robot name');

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    const file=path.resolve(ROOT,pathname.replace(/^\/+/,''));
    if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw new Error('not found');
    response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(response);
  }catch(error){response.writeHead(404).end('not found');}
});
const listen=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const closeServer=()=>new Promise(resolve=>server.close(()=>resolve()));
let browser=null;

try{
  await listen();
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('hsnViewMode','desktop');
      localStorage.setItem('hansen_onboarded','1');
      if(/island_sports\.html$/i.test(location.pathname)){
        window.__nativeReviewSecuritySentinel=0;
        const realSetItem=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){
          if(key==='hansen_wallet_charxp'||key==='hansen_charxp_reset_v1'||key==='hansen_charxp_migrated_v942')throw new Error('simulated charXP storage failure');
          return realSetItem.call(this,key,value);
        };
        localStorage.setItem('hansen_pet_name','[object Object]');
        localStorage.setItem('hansen_card_data_sports',JSON.stringify({islandClears:{1:{}},collected:['1',1,99],masterUnlocked:true}));
        const now=new Date(),day=now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
        localStorage.setItem('wordIslandSports',JSON.stringify({
        learned:[],stats:{},lastDay:day,charXP:{polluted:true},coinDay:day,coinWordCount:{'0':{},'1':3,'2':'2'},pet:{name:{polluted:true},stage:'12',xp:'49471',picked:'true'},
        quests:{day,allDay:'',list:[
          {id:'learn3',icon:'<img data-quest-evil src=x onerror="window.__questSecuritySentinel++">',title:'<svg onload="window.__questSecuritySentinel++">',type:'boss',goal:999999,progress:3,claimed:false,reward:{xp:999999999,gems:999999999}},
          {id:'boss1',icon:'🗡️',title:'击败 1 次挑战',type:'boss',goal:1,progress:0,claimed:false,reward:{xp:25,gems:3}},
        ]},
        wrongs:{
          '0':2,
          '1':'<img data-native-evil src=x onerror="window.__nativeReviewSecuritySentinel++">',
          '2':1000000,
          '3':1000001,
          '01':3,
          '-1':4,
          '9999':5,
        },
      }));
    }
  });

  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  await page.goto(`${origin}/island_sports.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenWrongOverview&&window.HansenReview&&Array.isArray(window.allW)&&window.allW.length>2);

  const objectPollution=await page.evaluate(()=>{
    let cardError='';try{window.hansenCardsMarkBoss(1);}catch(error){cardError=String(error);}
    const coinResults=[];for(let i=0;i<4;i++)coinResults.push(window.earnCoinOnCorrect(0));
    return {
      pet:JSON.parse(JSON.stringify(S.pet)),
      globalName:localStorage.getItem('hansen_pet_name'),
      objectText:document.body.textContent.includes('[object Object]'),
      cardError,
      card:JSON.parse(localStorage.getItem('hansen_card_data_sports')),
      charXP:S.charXP,
      coinWordCount:JSON.parse(JSON.stringify(S.coinWordCount)),
      coinResults,
    };
  });
  assert.deepEqual(objectPollution.pet,{name:'星灵',stage:0,xp:0,picked:false},'island startup must rebuild malformed pet state instead of stringifying objects');
  assert.equal(objectPollution.globalName,'星灵','pet showcase must replace a previously polluted global name');
  assert.equal(objectPollution.objectText,false,'no repaired pet field may leak [object Object] into the page');
  assert.equal(objectPollution.cardError,'','a Boss victory must not crash on malformed card progress');
  assert.deepEqual(objectPollution.card,{islandClears:{1:['sports']},collected:[1],masterUnlocked:false},'card progress must be normalized before mutation');
  assert.equal(objectPollution.charXP,0,'charXP must stay numeric even when the migration cannot write localStorage');
  assert.equal(objectPollution.coinWordCount['1'],3,'a legitimate per-word cap survives startup normalization');
  assert.equal('2' in objectPollution.coinWordCount,false,'string coin counters must be discarded');
  assert.deepEqual(objectPollution.coinResults,[true,true,true,false],'a malformed legacy counter must never bypass the three-coin per-word cap');

  const nativeState=await page.evaluate(()=>{
    const cleaned=JSON.parse(JSON.stringify(window.S.wrongs));
    renderReviewBrowse();
    const pool=getSmartPool();
    return {
      cleaned,
      poolLength:pool.length,
      words:allW.length,
      zero:pool.filter(index=>index===0).length,
      two:pool.filter(index=>index===2).length,
      sentinel:window.__nativeReviewSecuritySentinel,
      cards:document.querySelectorAll('#reviewContent .exp-card').length,
      evilNodes:document.querySelectorAll('#reviewContent [data-native-evil],#reviewContent script').length,
      text:document.getElementById('reviewContent').textContent,
    };
  });
  assert.deepEqual(nativeState.cleaned,{'0':2,'2':1000000},'Sports startup must purge HTML counts, oversized counts, noncanonical keys, and out-of-range indexes');
  assert.equal(nativeState.poolLength,nativeState.words+24,'native Sports smart pool must cap the million-count word at twenty weighted slots');
  assert.equal(nativeState.zero,5,'count two contributes four weighted slots plus one normal slot');
  assert.equal(nativeState.two,21,'maximum valid count contributes twenty weighted slots plus one normal slot');
  assert.equal(nativeState.sentinel,0,'native review browse must not execute rejected stored count markup');
  assert.equal(nativeState.cards,2,'native review browse keeps the two legitimate wrong entries');
  assert.equal(nativeState.evilNodes,0,'native review browse must not create attacker nodes');
  assert(nativeState.text.includes('×1000000'),'native review browse displays the normalized maximum as digits');

  const questState=await page.evaluate(()=>{
    window.__questSecuritySentinel=0;const paid={coins:0,xp:0};
    const global=window.HansenQuestGlobal,day=global._test.today(),raw=global._test.makeDay(day);
    raw.list[0].progress=raw.list[0].goal;raw.list[0].claimed=false;
    raw.list[0].icon='<img data-quest-evil src=x onerror="window.__questSecuritySentinel++">';
    raw.list[0].title='<svg onload="window.__questSecuritySentinel++">';
    raw.list[0].type='forged';raw.list[0].goal=999999;raw.list[0].reward={xp:999999999,gems:999999999};
    // Keep the progress at the real goal so the trusted task can be claimed.
    const trusted=global._test.makeDay(day).list[0];raw.list[0].progress=trusted.goal;
    localStorage.setItem(global.key,JSON.stringify(raw));
    const clean=global.ensure(),expected={title:clean.list[0].title,icon:clean.list[0].icon,reward:clean.list[0].reward,coins:global._test.questCoins(clean.list[0])};
    window.addCoin=n=>{paid.coins+=n;};window.addXP=n=>{paid.xp+=n;};window.playOpenChest=()=>{};
    renderQuests();
    const before={
      evilNodes:document.querySelectorAll('#questList [data-quest-evil],#questList script,#questList svg').length,
      text:document.getElementById('questList').textContent,
      first:JSON.parse(JSON.stringify(S.quests.list[0])),
    };
    const coins=window.HansenCoins;window.HansenCoins=null;global.claim(0);window.HansenCoins=coins;
    return {before,paid,expected,sentinel:window.__questSecuritySentinel};
  });
  assert.equal(questState.sentinel,0,'stored quest markup must never execute');
  assert.equal(questState.before.evilNodes,0,'stored quest fields must not create HTML/SVG/script nodes');
  assert(questState.before.text.includes(questState.expected.title),'quest UI must rebuild the trusted title');
  assert.equal(questState.before.first.icon,questState.expected.icon,'quest UI must rebuild the trusted icon');
  assert.equal(questState.before.first.reward.xp,questState.expected.reward.xp,'quest UI must rebuild the trusted XP reward');
  assert.notEqual(questState.before.first.reward.xp,999999999,'forged persisted reward must be discarded');
  assert.deepEqual(questState.paid,{coins:questState.expected.coins,xp:questState.expected.reward.xp},'claim must settle the built-in reward, never persisted reward values');

  const crossIsland=await page.evaluate(()=>{
    window.__reviewSecuritySentinel=0;
    window.S.wrongs={};localStorage.removeItem('wordIslandSports');localStorage.removeItem('wordIslandSports_bak');
    const payload='<img data-review-evil src=x onerror="window.__reviewSecuritySentinel++">';
    const vocab=[
      {en:'safe',cn:'安全',pn:'/seɪf/',emoji:'✅',ex:'Safe example.',exCn:'安全例句。'},
      {en:'evil '+payload,cn:'恶意 '+payload,pn:payload,emoji:payload,ex:payload,exCn:payload},
      {en:'million',cn:'百万次',pn:'/m/',emoji:'💎',ex:'Still bounded.',exCn:'仍受限制。'},
      {en:'too-many',cn:'超限',pn:'',emoji:'⚠️',ex:'',exCn:''},
    ];
    localStorage.setItem('hansen_vocab_wordIslandFood',JSON.stringify(vocab));
    localStorage.setItem('wordIslandFood',JSON.stringify({wrongs:{'0':3,'1':4,'2':1000000,'3':1000001,'01':5,'-1':2,'1e0':2}}));
    localStorage.setItem('hansen_vocab_wordIslandAnimal',JSON.stringify([{en:'cat',cn:'猫',emoji:'🐱'}]));
    localStorage.setItem('wordIslandAnimal',JSON.stringify({wrongs:{'0':'5'}}));
    window.HansenWrongOverview._reviewAll();
    return {
      counts:window._huReviewContext.wrongsList.map(item=>item.count),
      weights:window._huReviewContext.wrongsList.map(item=>item.weight),
      emojis:window._huReviewContext.wrongsList.map(item=>item.word.emoji),
      indexes:window._huReviewContext.wrongsList.map(item=>item.idx),
      vocabLength:window._huReviewContext.vocabList.length,
    };
  });
  assert.deepEqual(crossIsland.counts,[3,4,1000000],'only exact numeric counts in 1..1,000,000 may enter cross-island review');
  assert.deepEqual(crossIsland.weights,[6,8,20],'large counts must never create more than twenty weighted slots');
  assert.deepEqual(crossIsland.emojis,['✅','📘','💎'],'markup emoji must become the inert fallback while Unicode remains');
  assert(crossIsland.indexes.every(value=>Number.isInteger(value)&&value>=0&&value<crossIsland.vocabLength),'context indexes must be bounded canonical integers');
  assert.equal(new Set(crossIsland.indexes).size,crossIsland.indexes.length,'each wrong entry must retain one unambiguous normalized index');

  await page.evaluate(()=>window.HansenReview._openWrongOnly());
  await page.waitForSelector('#hr_wrongbook .hr_wb_item');
  const crossDom=await page.evaluate(()=>({
    sentinel:window.__reviewSecuritySentinel,
    items:document.querySelectorAll('#hr_wrongbook .hr_wb_item').length,
    evilNodes:document.querySelectorAll('#hr_wrongbook [data-review-evil],#hr_wrongbook script,#hr_wrongbook svg').length,
    emojis:[...document.querySelectorAll('#hr_wrongbook .hr_wb_emoji')].map(node=>node.textContent),
    counts:[...document.querySelectorAll('#hr_wrongbook .hr_wb_count')].map(node=>node.textContent),
    text:document.getElementById('hr_wrongbook').textContent,
  }));
  assert.equal(crossDom.sentinel,0,'cross-island stored markup must never execute');
  assert.equal(crossDom.items,3,'legitimate cross-island entries must remain usable');
  assert.equal(crossDom.evilNodes,0,'wrongbook must not create attacker-controlled HTML/SVG/script nodes');
  assert(crossDom.emojis.includes('📘')&&crossDom.emojis.includes('✅'),'fallback and legitimate emoji must both render');
  assert(crossDom.counts.some(text=>text.includes('1000000')),'maximum valid count must display as a number');
  assert(crossDom.text.includes('evil <img'),'text fields remain visible as inert text instead of disappearing');

  const directContext=await page.evaluate(()=>{
    document.getElementById('hr_wrongbook')?.remove();document.getElementById('hr_center')?.remove();
    const payload='<img data-review-evil src=x onerror="window.__reviewSecuritySentinel++">';
    const malicious={en:'direct '+payload,cn:'直接 '+payload,pn:payload,emoji:payload,ex:payload,exCn:payload};
    const safe={en:'second',cn:'第二',pn:'/s/',emoji:'🌟',ex:'Example.',exCn:'例句。'};
    window._huReviewContext={
      title:'标题 '+payload,
      vocabList:[malicious,safe],
      wrongsList:[
        {idx:0,count:5,word:malicious},
        {idx:1,count:7,word:safe},
        {idx:'01',count:6,word:safe},
        {idx:1,count:'9',word:safe},
        {idx:2,count:8,word:safe},
      ],
    };
    window.HansenReview._open();window.HansenReview._openWrongOnly();
    return {
      sentinel:window.__reviewSecuritySentinel,
      items:document.querySelectorAll('#hr_wrongbook .hr_wb_item').length,
      evilNodes:document.querySelectorAll('#hr_center [data-review-evil],#hr_wrongbook [data-review-evil],#hr_center script,#hr_wrongbook script,#hr_center svg,#hr_wrongbook svg').length,
      title:document.querySelector('#hr_center .hr_title')?.textContent||'',
      emojis:[...document.querySelectorAll('#hr_wrongbook .hr_wb_emoji')].map(node=>node.textContent),
    };
  });
  assert.deepEqual(directContext,{sentinel:0,items:2,evilNodes:0,title:'🎯 标题 <img data-review-evil src=x onerror="window.__reviewSecuritySentinel++">',emojis:['🌟','📘']},'review must re-normalize even a directly injected window context');

  const spellPractice=await page.evaluate(()=>{
    document.getElementById('hr_wrongbook')?.remove();document.getElementById('hr_center')?.remove();
    const payload='<img data-review-evil src=x onerror="window.__reviewSecuritySentinel++">';
    const malicious={en:'spell',cn:'拼写 '+payload,pn:payload,emoji:payload,ex:payload,exCn:payload};
    window._huReviewContext={title:'spell',vocabList:[malicious],wrongsList:[{idx:0,count:5,word:malicious}]};
    window.HansenReview._openSpellByCn();
    const result={
      sentinel:window.__reviewSecuritySentinel,
      mask:document.querySelectorAll('#hsp_mask').length,
      evilNodes:document.querySelectorAll('#hsp_mask [data-review-evil],#hsp_mask script,#hsp_mask svg').length,
      emoji:document.querySelector('#hsp_mask .typing-emoji')?.textContent||'',
      contextEmoji:window._huReviewContext.wrongsList[0]?.word?.emoji||'',
    };
    window.HansenSpellPractice.close();
    return result;
  });
  assert.deepEqual(spellPractice,{sentinel:0,mask:1,evilNodes:0,emoji:'📘',contextEmoji:'📘'},'review must sanitize shared context before the spelling-practice raw emoji renderer reads it');

  const smartPool=await page.evaluate(()=>{
    window.S.wrongs={'0':1000000,'1':4,'01':5,'2':'7','9999':3};
    const result=window.getSmartPool();
    return {length:result.length,words:window.allW.length,zero:result.filter(index=>index===0).length,one:result.filter(index=>index===1).length};
  });
  assert.equal(smartPool.length,smartPool.words+28,'smart pool must add 20 + 8 bounded slots, never count*2 million slots');
  assert.equal(smartPool.zero,21,'maximum count contributes twenty weighted slots plus the normal slot');
  assert.equal(smartPool.one,9,'count four contributes eight weighted slots plus the normal slot');
  assert.deepEqual(pageErrors,[],'review security probe must not cause page exceptions');

  const bee=await context.newPage(),beeErrors=[];
  bee.on('pageerror',error=>beeErrors.push(String(error)));
  await bee.goto(`${origin}/spelling_bee.html`,{waitUntil:'domcontentloaded'});
  await bee.waitForFunction(()=>window.S&&typeof window.startMatch==='function'&&typeof window.finish==='function');
  const beeResult=await bee.evaluate(()=>{
    window.__beeSecuritySentinel=0;
    S.botName='<img data-bee-evil src=x onerror="window.__beeSecuritySentinel++">';
    S.mode='cn';S.diff='beginner';S.qCount=10;
    startMatch();finish('bot');
    return {
      sentinel:window.__beeSecuritySentinel,
      evilNodes:document.querySelectorAll('#laneRes [data-bee-evil],#laneRes script,#laneRes svg').length,
      text:document.getElementById('laneRes').textContent,
    };
  });
  assert.equal(beeResult.sentinel,0,'editable robot name must never execute in lane results');
  assert.equal(beeResult.evilNodes,0,'robot name must not create markup nodes');
  assert(beeResult.text.includes('<img data-bee-evil'),'robot name remains visible as inert text');
  assert.deepEqual(beeErrors,[],'Spelling Bee security probe must not cause page exceptions');

  await context.close();
  console.log('review markup security v946 HF1: strict counts/indexes + safe context/emoji/bot name + bounded smart pool ✅');
}finally{
  if(browser)await browser.close().catch(()=>{});
  await closeServer().catch(()=>{});
}
