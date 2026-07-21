// hansen_round_reward.js v946 HF6 — Boss 逐轮大满贯与星海女帝终战结算
// 正片/Land: 只记录“本奖励轮实际打赢”的 Boss；每关每轮最多记一次。
// 本轮全部 Boss 各胜一次，才结算 300 金币 +120 分钟 +88 钻，并进入下一轮。
// 永久卡牌通关记录和 landN_prog 只负责解锁，绝不再参与大满贯发奖判定。
// 女帝: 必须有 8 枚真实 Land 通关旗，且实际打赢 Lv6 赛尔娅，一次性结算
//        300 金币 +120 分钟 +100 钻。freepass 只放行试玩，不会伪造 8 枚旗。
(function(){
  'use strict';
  if(window.__hansenRoundRewardLoaded) return;
  window.__hansenRoundRewardLoaded = true;

  var REWARD_COIN = 300;
  var REWARD_BOOST = 120;
  var SEASON_GEMS = 100;
  var SEASON_FINAL_KEY = 'hansen_season_final_reward_v941';
  var STATE_PREFIX = 'hansen_boss_round_state_v946_';
  // 沿用旧 pending 键名以便识别并隔离 HF5 遗留事务；新普通/Land事务 schema=946。
  var TX_PREFIX = 'hansen_round_reward_pending_v942_';
  // 只用于老玩家补差迁移；新逻辑绝不再按旧分段发奖。
  var SEASON_LEGACY_KEY = 'hansen_season_pillar_gems';

  function islandKey(){
    try{
      var p=(location.pathname||'').split('/').pop()||'';
      var m=p.match(/^island_([a-z0-9]+)\.html?$/i);
      if(m) return m[1].toLowerCase();
    }catch(e){}
    return 'unknown';
  }
  function isSeason(k){ return k==='season'; }
  function isLand(k){ return /^land[1-8]$/.test(k||''); }
  function isRegular(k){ return /^(action|adjective|animal|body|city|clothes|color|family|food|home|job|nature|question|school|sports|time|traffic|treasure)$/.test(k||''); }
  function countKey(){ return 'hansen_boss_round_count_'+islandKey(); }
  function stateKey(){ return STATE_PREFIX+islandKey(); }
  function total(){
    var k=islandKey();
    if(isSeason(k)) return 8;
    if(isLand(k)){
      try{ if(window.BOSSES&&window.BOSSES.length) return window.BOSSES.length; }catch(e){}
      return 5;
    }
    return 20;
  }
  function gemAmount(){ return isSeason(islandKey()) ? SEASON_GEMS : 88; }
  function legacyCount(){
    try{ return Math.max(0,parseInt(localStorage.getItem(countKey())||'0',10)||0); }catch(e){ return 0; }
  }
  function mirrorCount(n){
    try{var v=String(Math.max(0,n|0));localStorage.setItem(countKey(),v);return localStorage.getItem(countKey())===v;}catch(e){return false;}
  }
  function readJson(key,fallback){
    try{ var v=JSON.parse(localStorage.getItem(key)||'null'); return v==null?fallback:v; }catch(e){ return fallback; }
  }
  function writeJson(key,value){
    try{var raw=JSON.stringify(value);localStorage.setItem(key,raw);return localStorage.getItem(key)===raw;}catch(e){return false;}
  }
  function removeVerified(key){try{localStorage.removeItem(key);return localStorage.getItem(key)===null;}catch(e){return false;}}
  function notice(msg,e){try{if(typeof window.__hsnSaveNotice==='function')window.__hsnSaveNotice(msg,e);else window.dispatchEvent(new CustomEvent('hansen-save-error',{detail:{message:msg,error:String(e&&e.message||e||msg)}}));}catch(_e){}}
  function txKey(){return TX_PREFIX+islandKey();}
  function storedJson(key){
    try{
      var raw=localStorage.getItem(key);
      if(raw===null)return {ok:true,absent:true,value:null,raw:null};
      try{return {ok:true,absent:false,value:JSON.parse(raw),raw:raw};}
      catch(e){return {ok:false,absent:false,value:null,raw:raw};}
    }catch(e2){return {ok:false,absent:false,value:null,raw:null};}
  }

  function seasonLandClears(){
    var out=[];
    for(var i=1;i<=8;i++){
      try{ if(localStorage.getItem('hsn_landmap_cleared_'+i)==='1') out.push(i); }catch(e){}
    }
    return out;
  }
  function modeFor(k){return isLand(k)?'land':'regular';}
  function exactInt(v,min,max){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>=min&&v<=max;}
  function validReceipt(x,completed){
    if(x===null)return true; // HF5 迁移只继承已领奖次数，不伪造旧 receipt。
    return !!(x&&typeof x==='object'&&!Array.isArray(x)&&
      typeof x.id==='string'&&/^round:v946:(regular|land):[a-z0-9]+:r[1-9][0-9]*$/i.test(x.id)&&
      exactInt(x.roundNo,1,Number.MAX_SAFE_INTEGER)&&x.roundNo===completed&&
      exactInt(x.paidAt,1,Number.MAX_SAFE_INTEGER));
  }
  function freshState(){
    var k=islandKey(),done=legacyCount();
    return {schema:1,version:946,island:k,mode:modeFor(k),total:total(),roundNo:done+1,completedCount:done,cleared:[],updatedAt:Date.now(),lastReceipt:null};
  }
  function validState(x){
    var k=islandKey(),n=total();
    if(!x||typeof x!=='object'||Array.isArray(x)||x.schema!==1||x.version!==946||
       x.island!==k||x.mode!==modeFor(k)||x.total!==n||
       !exactInt(x.completedCount,0,Number.MAX_SAFE_INTEGER)||
       !exactInt(x.roundNo,1,Number.MAX_SAFE_INTEGER)||x.roundNo!==x.completedCount+1||
       !exactInt(x.updatedAt,1,Number.MAX_SAFE_INTEGER)||!Array.isArray(x.cleared)||x.cleared.length>n||
       !validReceipt(x.lastReceipt,x.completedCount))return false;
    if(x.lastReceipt&&x.lastReceipt.id!=='round:v946:'+x.mode+':'+x.island+':r'+x.completedCount)return false;
    var prev=0;
    for(var i=0;i<x.cleared.length;i++){
      if(!exactInt(x.cleared[i],1,n)||x.cleared[i]<=prev)return false;
      prev=x.cleared[i];
    }
    return true;
  }
  var stateNoticeShown=false;
  function stateResult(){
    if(isSeason(islandKey()))return {ok:true,absent:false,state:null};
    if(!isLand(islandKey())&&!isRegular(islandKey()))return {ok:false,absent:false,state:null};
    var r=storedJson(stateKey());
    if(r.ok&&r.absent)return {ok:true,absent:true,state:freshState()};
    if(r.ok&&validState(r.value))return {ok:true,absent:false,state:r.value};
    if(!stateNoticeShown){stateNoticeShown=true;notice('Boss 本轮进度存档异常，奖励已暂停；原始数据已保留',new Error('invalid boss round state'));}
    return {ok:false,absent:false,state:null};
  }
  function saveState(state){
    if(!validState(state)||!writeJson(stateKey(),state))return false;
    var check=storedJson(stateKey());
    return !!(check.ok&&!check.absent&&validState(check.value)&&JSON.stringify(check.value)===JSON.stringify(state));
  }
  function getCount(){
    if(isSeason(islandKey()))return legacyCount();
    var r=stateResult();return r.ok?r.state.completedCount:legacyCount();
  }
  function readRound(){
    if(isSeason(islandKey()))return seasonLandClears();
    var r=stateResult();return r.ok?r.state.cleared.slice():[];
  }
  function isFull(arr,n){
    if(!Array.isArray(arr)||arr.length<n) return false;
    for(var i=1;i<=n;i++) if(arr.indexOf(i)<0) return false;
    return true;
  }
  // 常规岛的脚本加载顺序是：round_reward 先包装原 bossVictory，defer 的 cards
  // 随后再包装 round_reward。因此一次胜利的真实调用链为
  // season -> cards -> round -> 原 bossVictory；round 返回后 cards 才把本关写入
  // islandClears。若这里只读取 cards 旧账，打赢最后一关会被迫再打一场才能领奖。
  //
  // 只接受与 cards 相同的权威关号来源，绝不拿 S.level（玩家 XP 段位）冒充 Boss：
  // 重战标记 -> 当前 boss 对象在 BOSSES 中的位置 -> S.bossCurrentLv。
  function actualRegularWinLv(){
    var n,max=20;
    try{ if(window.BOSSES&&window.BOSSES.length) max=window.BOSSES.length; }catch(e){}
    try{
      n=Number(window._hansenRebattleLv);
      if(window._hansenRebattleLv!=null&&isFinite(n)&&n>=1&&n<=max) return Math.floor(n);
      if(typeof BOSSES!=='undefined'&&typeof bossCurrent!=='undefined'&&bossCurrent){
        for(var i=0;i<BOSSES.length;i++) if(BOSSES[i]===bossCurrent) return i+1;
      }
      n=window.S&&Number(window.S.bossCurrentLv);
      if(isFinite(n)&&n>=1&&n<=max) return Math.floor(n);
    }catch(e){}
    return 0;
  }
  function currentLv(){
    var k=islandKey(),n=0,max=total();
    try{
      n=Number(window._hansenRebattleLv);
      if(window._hansenRebattleLv!=null&&isFinite(n)&&n>=1&&n<=max)return Math.floor(n);
      if((isLand(k)||isSeason(k))&&window._s1Idx!=null){
        n=Number(window._s1Idx)+1;
        if(isFinite(n)&&n>=1&&n<=max)return Math.floor(n);
      }
      if(!isLand(k)&&!isSeason(k))return actualRegularWinLv();
      if(typeof BOSSES!=='undefined'&&typeof bossCurrent!=='undefined'&&bossCurrent){
        for(var i=0;i<BOSSES.length;i++)if(BOSSES[i]===bossCurrent)return i+1;
      }
    }catch(e){}
    return 0;
  }
  function recordRoundWin(lv){
    var n=total();lv=Math.floor(Number(lv)||0);
    if(lv<1||lv>n)return {ok:false,reason:'invalid-level'};
    for(var attempt=0;attempt<4;attempt++){
      var r=stateResult();if(!r.ok)return {ok:false,reason:'invalid-state'};
      var s=r.state,merged=s.cleared.slice();
      if(merged.indexOf(lv)>=0)return {ok:true,duplicate:true,state:s};
      merged.push(lv);merged.sort(function(a,b){return a-b;});
      var next={schema:1,version:946,island:s.island,mode:s.mode,total:s.total,roundNo:s.roundNo,completedCount:s.completedCount,cleared:merged,updatedAt:Date.now(),lastReceipt:s.lastReceipt};
      if(!saveState(next))continue;
      var verify=stateResult();
      if(verify.ok&&verify.state.roundNo===next.roundNo&&verify.state.cleared.indexOf(lv)>=0)return {ok:true,duplicate:false,state:verify.state};
    }
    notice('Boss 本轮进度未能安全保存，本场不会提前发奖',new Error('round state write failed'));
    return {ok:false,reason:'write-failed'};
  }
  function seasonLedger(){
    var x=readJson(SEASON_FINAL_KEY,null);
    if(!x||typeof x!=='object'||Array.isArray(x))return null;
    if((x.version!==941&&x.version!==942)||!isFinite(+x.gems)||!isFinite(+x.coins)||!isFinite(+x.boostMinutes))return null;
    if(+x.gems<0||+x.gems>SEASON_GEMS||(+x.coins!==0&&+x.coins!==REWARD_COIN)||(+x.boostMinutes!==0&&+x.boostMinutes!==REWARD_BOOST))return null;
    return x;
  }
  // 兼容 HF5 旧进度条的只读 API。HF6 普通/Land 奖励按完整轮次结算，不再使用“每日任意首胜”闸门。
  function gemPaidToday(){ return isSeason(islandKey())&&!!seasonLedger(); }
  function addCoins(n){ try{ if(n>0&&window.HansenCoins&&HansenCoins.add) HansenCoins.add(n); }catch(e){} }
  function addBoost(n){ try{ if(n>0&&window.HansenCrystal&&HansenCrystal.grantBoost) HansenCrystal.grantBoost(n,true); }catch(e){} }
  function addGems(n){ try{ if(n>0&&window.HansenGems&&HansenGems.add) HansenGems.add(n); }catch(e){} }

  /* 记忆强化不是钱包，给它补一个可恢复的幂等账本；Quest 模块会在此对象上补 XP 能力。 */
  function effects(){
    if(window.HansenRewardEffectsV942&&typeof window.HansenRewardEffectsV942.boostAward==='function')return window.HansenRewardEffectsV942;
    var LEDGER_KEY='hansen_reward_boost_awards_v942',PENDING_KEY='hansen_reward_boost_pending_v942';
    function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
    function exactInt(v,min,max){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>=min&&v<=max;}
    function validId(id){return typeof id==='string'&&id.length>0&&id.length<=180&&/^[a-z0-9:_-]+$/i.test(id)&&id!=='__proto__'&&id!=='prototype'&&id!=='constructor';}
    function storedJson(key){try{var raw=localStorage.getItem(key);if(raw===null)return {ok:true,absent:true,value:null};try{return {ok:true,absent:false,value:JSON.parse(raw)};}catch(e){return {ok:false};}}catch(e2){return {ok:false};}}
    function map(){var r=storedJson(LEDGER_KEY);if(!r.ok)return null;if(r.absent)return {};var x=r.value;if(!x||typeof x!=='object'||Array.isArray(x))return null;var ids=Object.keys(x);for(var i=0;i<ids.length;i++){var id=ids[i],e=x[id];if(!validId(id)||!e||typeof e!=='object'||Array.isArray(e)||!exactInt(e.minutes,1,1440)||!exactInt(e.target,0,Number.MAX_SAFE_INTEGER)||!exactInt(e.at,1,Number.MAX_SAFE_INTEGER))return null;}return x;}
    function pending(){var r=storedJson(PENDING_KEY);if(!r.ok)return {invalid:true};if(r.absent)return null;return r.value&&typeof r.value==='object'&&!Array.isArray(r.value)?r.value:{invalid:true};}
    function boostUntil(){try{var raw=localStorage.getItem('hsn_crystal_boost_until');if(raw===null)return 0;var n=Number(raw);return exactInt(n,0,Number.MAX_SAFE_INTEGER)&&String(n)===raw?n:null;}catch(e){return null;}}
    function rawSet(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);return value===null?localStorage.getItem(key)===null:localStorage.getItem(key)===value;}catch(e){return false;}}
    function recoverBoost(){
      var p=pending(),ledger=map();if(!ledger){notice('记忆强化奖励账本已损坏；已停止发奖且保留原始数据',new Error('invalid boost ledger'));return false;}if(!p)return true;
      if(p.invalid||!validId(p.id)||!exactInt(p.minutes,1,1440)||!exactInt(p.before,0,Number.MAX_SAFE_INTEGER)||!exactInt(p.target,1,Number.MAX_SAFE_INTEGER)||!exactInt(p.createdAt,1,Number.MAX_SAFE_INTEGER)||p.target!==Math.max(p.createdAt,p.before)+p.minutes*60000){notice('记忆强化恢复凭据已损坏；已停止恢复且保留原始数据',new Error('invalid boost pending'));return false;}
      if(own(ledger,p.id))return removeVerified(PENDING_KEY);
      var cur=boostUntil();if(cur===null||cur!==p.before&&cur!==p.target)return false;
      if(cur===p.before&&!rawSet('hsn_crystal_boost_until',String(p.target)))return false;
      ledger[p.id]={minutes:p.minutes,target:p.target,at:p.createdAt};
      if(!writeJson(LEDGER_KEY,ledger))return false;
      return removeVerified(PENDING_KEY);
    }
    function boostAward(id,minutes){
      id=String(id||'');minutes=Math.floor(Number(minutes)||0);
      if(!validId(id)||minutes<1||minutes>1440||!recoverBoost())return false;
      var ledger=map();if(!ledger)return false;if(own(ledger,id))return true;
      var now=Date.now(),before=boostUntil();if(before===null)return false;
      var p={id:id,minutes:minutes,before:before,target:Math.max(now,before)+minutes*60000,createdAt:now};
      if(!writeJson(PENDING_KEY,p))return false;
      if(!recoverBoost()){notice('记忆强化奖励尚未保存，稍后会自动重试',new Error('boost award pending'));return false;}
      return true;
    }
    var api=window.HansenRewardEffectsV942||{};api.boostAward=boostAward;api.recoverBoost=recoverBoost;window.HansenRewardEffectsV942=api;return api;
  }

  function modernWallets(){
    return !!(window.HansenCoins&&typeof window.HansenCoins.award==='function'&&window.HansenGems&&typeof window.HansenGems.award==='function');
  }
  function walletAward(wallet,id,n){
    if(n<=0)return true;
    try{return !!(wallet&&typeof wallet.award==='function'&&wallet.award(id,n));}catch(e){return false;}
  }

  function legacySeasonState(){
    var raw=readJson(SEASON_LEGACY_KEY,{});
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) raw={};
    var valid={},count=0;
    for(var i=1;i<=6;i++) if(raw[i]===true||raw[String(i)]===true){ valid[i]=true; count++; }
    return {
      paid:valid,
      credited:count===6?100:count*15,
      finalBenefitsAlreadyPaid:!!valid[6]
    };
  }
  function onWinSeasonLegacy(lv){
    // 必须是实际终战 + 8 枚持久化 Land 旗。卡牌/freepass/旧表现层状态都不能代替。
    if((lv|0)!==6 || seasonLandClears().length!==8) return false;
    if(seasonLedger()) return false;
    var legacy=legacySeasonState();
    var gems=Math.max(0,SEASON_GEMS-legacy.credited);
    var coins=legacy.finalBenefitsAlreadyPaid?0:REWARD_COIN;
    var boost=legacy.finalBenefitsAlreadyPaid?0:REWARD_BOOST;
    var ledger={version:941,paidAt:new Date().toISOString(),legacyCredit:legacy.credited,gems:gems,coins:coins,boostMinutes:boost};
    // 先落幂等凭再发奖，快速连点/刷新不会重复入账。
    try{
      localStorage.setItem(SEASON_FINAL_KEY,JSON.stringify(ledger));
      if(!seasonLedger()) return false;
    }catch(e){ return false; }
    addCoins(coins); addBoost(boost); addGems(gems);
    if(getCount()<1) mirrorCount(1);
    if(coins||boost||gems) showReward({mode:'season',roundNo:1,gems:gems,coins:coins,boost:boost,total:8});
    return true;
  }

  function onWinLegacy(lv){
    var k=islandKey();
    if(isSeason(k)) return onWinSeasonLegacy(lv);
    var win=recordRoundWin(lv),n=total();
    if(!win.ok||!isFull(win.state.cleared,n)){try{if(window.HansenRoundBar)HansenRoundBar.refresh();}catch(e){}return false;}
    var receipt='round:v946:'+win.state.mode+':'+win.state.island+':r'+win.state.roundNo;
    var paidKey='hansen_boss_round_legacy_paid_v946_'+win.state.island+'_r'+win.state.roundNo;
    try{localStorage.setItem(paidKey,receipt);if(localStorage.getItem(paidKey)!==receipt)return false;}catch(e){return false;}
    var next={schema:1,version:946,island:win.state.island,mode:win.state.mode,total:n,roundNo:win.state.roundNo+1,completedCount:win.state.roundNo,cleared:[],updatedAt:Date.now(),lastReceipt:{id:receipt,roundNo:win.state.roundNo,paidAt:Date.now()}};
    if(!saveState(next))return false;
    mirrorCount(next.completedCount);
    addCoins(REWARD_COIN);addBoost(REWARD_BOOST);addGems(88);
    showReward({mode:win.state.mode,roundNo:win.state.roundNo,gems:88,coins:REWARD_COIN,boost:REWARD_BOOST,total:n});
    try{ if(window.HansenRoundBar) HansenRoundBar.refresh(); }catch(e){}
    return true;
  }

  /* HF6 正式结算：pending 绑定本轮完整快照和稳定 receipt；金额始终由内部常量重建。 */
  function fullLevels(n){var out=[];for(var i=1;i<=n;i++)out.push(i);return out;}
  function txStatus(){
    var r=storedJson(txKey()),k=islandKey(),n=total();
    if(r.ok&&r.absent)return {ok:true,absent:true,tx:null};
    if(!r.ok||!r.value||typeof r.value!=='object'||Array.isArray(r.value))return {ok:false,absent:false,tx:null};
    var x=r.value;
    if(isSeason(k)){
      if(x.version!==942||x.island!==k||x.mode!=='season'||x.day!=='final'||x.winLv!==6||!exactInt(x.roundNo,1,1))return {ok:false,absent:false,tx:null};
      return {ok:true,absent:false,tx:{version:942,island:k,day:'final',mode:'season',roundNo:1,winLv:6}};
    }
    // HF5 普通/Land pending 是按历史永久进度建立的，不能恢复发奖；只隔离清理。
    if(x.version===942)return {ok:true,absent:false,legacy:true,tx:null};
    var mode=modeFor(k),roundNo=Math.floor(Number(x.roundNo)||0),winLv=Math.floor(Number(x.winLv)||0);
    var receipt='round:v946:'+mode+':'+k+':r'+roundNo;
    if(x.version!==946||x.island!==k||x.mode!==mode||x.total!==n||roundNo<1||winLv<1||winLv>n||x.receiptId!==receipt||
       !Array.isArray(x.cleared)||x.cleared.length!==n)return {ok:false,absent:false,tx:null};
    for(var i=0;i<n;i++)if(x.cleared[i]!==i+1)return {ok:false,absent:false,tx:null};
    var state=stateResult();
    if(!state.ok||roundNo!==state.state.roundNo&&roundNo!==state.state.completedCount)return {ok:false,absent:false,tx:null};
    return {ok:true,absent:false,tx:{version:946,island:k,mode:mode,roundNo:roundNo,total:n,winLv:winLv,receiptId:receipt,cleared:x.cleared.slice()}};
  }
  function readTx(){var s=txStatus();return s.ok&&!s.absent&&!s.legacy?s.tx:null;}
  function makeTx(winLv,state){
    var k=islandKey();
    if(isSeason(k))return {version:942,island:k,day:'final',mode:'season',roundNo:1,winLv:6};
    return {version:946,island:k,mode:state.mode,roundNo:state.roundNo,total:state.total,winLv:Math.floor(Number(winLv)||0),receiptId:'round:v946:'+state.mode+':'+k+':r'+state.roundNo,cleared:fullLevels(state.total)};
  }
  function txEligible(tx){
    if(tx.mode==='season')return seasonLandClears().length===8;
    var r=stateResult();if(!r.ok)return false;
    if(r.state.lastReceipt&&r.state.lastReceipt.id===tx.receiptId&&r.state.completedCount===tx.roundNo)return true;
    return r.state.roundNo===tx.roundNo&&isFull(r.state.cleared,r.state.total);
  }
  function txAmounts(tx){
    if(tx.mode!=='season')return {coins:REWARD_COIN,gems:88,boost:REWARD_BOOST,legacyCredit:0};
    var legacy=legacySeasonState();
    return {
      coins:legacy.finalBenefitsAlreadyPaid?0:REWARD_COIN,
      gems:Math.max(0,SEASON_GEMS-legacy.credited),
      boost:legacy.finalBenefitsAlreadyPaid?0:REWARD_BOOST,
      legacyCredit:legacy.credited
    };
  }
  function sourceBase(tx){return tx.mode==='season'?'round:v942:season:'+tx.island+':final':tx.receiptId;}
  function finalizePaid(tx,a){
    if(tx.mode==='season'){
      var ledger={version:942,paidAt:new Date().toISOString(),legacyCredit:a.legacyCredit,gems:a.gems,coins:a.coins,boostMinutes:a.boost};
      if(!writeJson(SEASON_FINAL_KEY,ledger))return false;
      mirrorCount(1);
      return !!seasonLedger();
    }
    var r=stateResult();if(!r.ok)return false;
    if(r.state.lastReceipt&&r.state.lastReceipt.id===tx.receiptId&&r.state.completedCount===tx.roundNo)return true;
    if(r.state.roundNo!==tx.roundNo||!isFull(r.state.cleared,r.state.total))return false;
    var next={schema:1,version:946,island:r.state.island,mode:r.state.mode,total:r.state.total,roundNo:tx.roundNo+1,completedCount:tx.roundNo,cleared:[],updatedAt:Date.now(),lastReceipt:{id:tx.receiptId,roundNo:tx.roundNo,paidAt:Date.now()}};
    if(!saveState(next))return false;
    mirrorCount(next.completedCount); // 仅给 HF5 老代码展示；HF6 eligibility/UI 只读 state。
    return true;
  }
  function settleTx(tx,show){
    if(tx.mode==='season'&&seasonLedger()){removeVerified(txKey());return true;}
    if(tx.mode!=='season'){
      var done=stateResult();
      if(done.ok&&done.state.lastReceipt&&done.state.lastReceipt.id===tx.receiptId&&done.state.completedCount===tx.roundNo){removeVerified(txKey());return true;}
    }
    if(!txEligible(tx))return false;
    var a=txAmounts(tx),base=sourceBase(tx);
    if(!walletAward(window.HansenCoins,base+':coins',a.coins))return false;
    if(!walletAward(window.HansenGems,base+':gems',a.gems))return false;
    if(a.boost>0&&!effects().boostAward(base+':boost',a.boost))return false;
    if(!finalizePaid(tx,a))return false;
    removeVerified(txKey());
    if(show&&(a.coins||a.gems||a.boost))showReward({mode:tx.mode,roundNo:tx.roundNo,gems:a.gems,coins:a.coins,boost:a.boost,total:total()});
    try{if(window.HansenRoundBar)HansenRoundBar.refresh();}catch(e){}
    return true;
  }
  /*
   * 最后一关胜利先把 20/20 state 落盘，再建立 pending。若页面恰好在两步之间
   * 崩溃，重载时不能把“没有 pending”误当成“没有待结算奖励”。有效且已满的
   * 本轮 state 本身就是可恢复证明：用同一 roundNo 重建确定性事务，再走统一的
   * 幂等奖励链。损坏 state 仍由 stateResult() fail-closed，绝不自动改写。
   */
  function recoverFullStateWithoutTx(show){
    var k=islandKey();
    if(isSeason(k))return true;
    var r=stateResult();
    if(!r.ok)return false;
    if(!isFull(r.state.cleared,r.state.total))return true;
    var tx=makeTx(r.state.total,r.state);
    if(!writeJson(txKey(),tx)){
      notice('Boss 满轮奖励事务未能恢复，进度已保留且重置已暂停',new Error('full round tx rebuild failed'));
      return false;
    }
    var rebuilt=txStatus();
    if(!rebuilt.ok||rebuilt.absent||rebuilt.legacy||!rebuilt.tx){
      notice('Boss 满轮奖励恢复凭据校验失败，进度与凭据均已保留',new Error('rebuilt round tx invalid'));
      return false;
    }
    return settleTx(rebuilt.tx,show===true);
  }
  function recoverPending(show){
    var status=txStatus();
    if(!status.ok){notice('Boss 奖励恢复凭据异常，奖励已暂停；原始数据已保留',new Error('invalid boss round pending'));return false;}
    if(status.absent)return recoverFullStateWithoutTx(show);
    if(status.legacy){
      if(!removeVerified(txKey()))return false;
      return recoverFullStateWithoutTx(show);
    }
    return settleTx(status.tx,show===true);
  }
  function onWinModern(lv){
    var k=islandKey();
    if(!recoverPending(false))return false;
    if(isSeason(k)){
      if((lv|0)!==6||seasonLandClears().length!==8||seasonLedger())return false;
      var seasonTx=makeTx(6,null);
      if(!writeJson(txKey(),seasonTx)){notice('女帝终战奖励事务未能建立，本次不会提前标记已领取',new Error('season tx write failed'));return false;}
      return settleTx(seasonTx,true);
    }
    var win=recordRoundWin(lv);
    try{if(window.HansenRoundBar)HansenRoundBar.refresh();}catch(e){}
    if(!win.ok||!isFull(win.state.cleared,win.state.total))return false;
    var tx=makeTx(lv,win.state);
    if(!writeJson(txKey(),tx)){notice('大满贯奖励事务未能建立，本次不会提前标记已领取',new Error('round tx write failed'));return false;}
    return settleTx(tx,true);
  }
  function onWin(lv){return modernWallets()?onWinModern(lv):onWinLegacy(lv);}

  function showReward(meta){
    try{
      var mode=meta.mode||'regular';
      var title=mode==='season'?'星海女帝终战完成！':(mode==='land'?'通关本 Land '+meta.total+' 关 Boss！':'通关本岛 20 关 Boss！');
      var gemScope=mode==='season'?'一次性终战奖励':'本岛第 '+meta.roundNo+' 轮完整奖励';
      var reward=[];
      if(meta.gems>0) reward.push('💎 +<b>'+meta.gems+'</b> 钻石');
      if(meta.coins>0) reward.push('🪙 +<b>'+meta.coins+'</b> 金币');
      if(meta.boost>0) reward.push('⚡ 记忆强化 <b>'+meta.boost+'</b> 分钟');
      var foot=mode==='season'?'8 个 Land 真实通关 + Lv6 赛尔娅胜利已核验':('本轮 '+meta.total+' 个 Boss 各胜 1 次，已全部核验');
      var mask=document.createElement('div');
      mask.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:30px;animation:hrrFade .3s ease';
      mask.innerHTML='<div style="background:linear-gradient(135deg,#1e3a8a,#0b1437);border:3px solid #fbbf24;border-radius:20px;padding:30px 26px;text-align:center;color:#fff;max-width:350px;box-shadow:0 0 60px rgba(251,191,36,.55);animation:hrrPop .32s ease">'
        +'<div style="font-size:72px;line-height:1;margin-bottom:12px">🏆</div>'
        +'<div style="font-size:21px;font-weight:900;color:#fbbf24;margin-bottom:8px">'+title+'</div>'
        +'<div style="font-size:12px;color:#93c5fd;margin-bottom:8px">'+gemScope+'</div>'
        +'<div style="font-size:15px;color:#fde047;margin-bottom:8px;line-height:1.8">'+reward.join('<br>')+'</div>'
        +'<div style="font-size:12.5px;color:#cbd5e1;margin-bottom:20px;line-height:1.6">'+foot+'</div>'
        +'<button id="hrrOk" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;border:0;padding:12px 34px;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer">收下！</button></div>';
      document.body.appendChild(mask);
      var btn=mask.querySelector('#hrrOk'); if(btn) btn.addEventListener('click',function(){ try{mask.remove();}catch(e){} });
      setTimeout(function(){ mask.addEventListener('click',function(e){ if(e.target===mask){try{mask.remove();}catch(x){}} }); },500);
      var esc=function(e){ if(e.key==='Escape'||e.keyCode===27){try{mask.remove();}catch(x){} document.removeEventListener('keydown',esc);} };
      document.addEventListener('keydown',esc);
      try{ if(window.playLevelUp) window.playLevelUp(); }catch(e){}
    }catch(e){}
  }

  function hookVictory(){
    if(typeof window.bossVictory!=='function') return false;
    if(window.__hrrVictoryHooked) return true;
    var original=window.bossVictory;
    window.bossVictory=function(){
      var lv=currentLv();
      var shouldRecord=true;
      try{if(typeof bossActive!=='undefined'&&bossActive===false)shouldRecord=false;}catch(e){}
      var result=original.apply(this,arguments);
      try{if(shouldRecord)onWin(lv);}catch(e){}
      return result;
    };
    window.__hrrVictoryHooked=true;
    return true;
  }
  if(typeof document!=='undefined'){
    var style=document.createElement('style');
    style.textContent='@keyframes hrrFade{from{opacity:0}to{opacity:1}}@keyframes hrrPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}';
    if(document.head) document.head.appendChild(style);
  }
  hookVictory();
  var tries=0,timer=setInterval(function(){ tries++; if(hookVictory()||tries>40) clearInterval(timer); },150);

  window.HansenRoundReward={
    progress:function(){ return readRound().slice().sort(function(a,b){return a-b;}); },
    remain:function(){ var a=readRound(),r=[],n=total(); for(var i=1;i<=n;i++) if(a.indexOf(i)<0) r.push(i); return r; },
    count:getCount,
    islandKey:islandKey,
    isSeason:function(){return isSeason(islandKey());},
    isLand:function(){return isLand(islandKey());},
    gemAmount:gemAmount,
    gemPaidToday:gemPaidToday,
    total:total,
    roundNo:function(){var r=stateResult();return r.ok&&r.state?r.state.roundNo:Math.max(1,legacyCount()+1);},
    status:function(){
      if(isSeason(islandKey()))return {valid:true,season:true,roundNo:1,completed:getCount(),total:8,cleared:seasonLandClears(),remain:[]};
      var r=stateResult(),n=total();
      if(!r.ok)return {valid:false,season:false,roundNo:Math.max(1,legacyCount()+1),completed:legacyCount(),total:n,cleared:[],remain:fullLevels(n)};
      var missing=[];for(var i=1;i<=n;i++)if(r.state.cleared.indexOf(i)<0)missing.push(i);
      return {valid:true,season:false,roundNo:r.state.roundNo,completed:r.state.completedCount,total:n,cleared:r.state.cleared.slice(),remain:missing,lastReceipt:r.state.lastReceipt};
    },
    seasonStatus:function(){return {landClears:seasonLandClears(),ledger:seasonLedger(),legacy:legacySeasonState()};},
    recover:function(){return modernWallets()?recoverPending(false):true;},
    _currentLv:currentLv,
    _win:onWin,
    _reset:function(){
      try{
        if(modernWallets()&&!recoverPending(false))return false;
        localStorage.removeItem(stateKey());
        localStorage.removeItem('hansen_boss_round_gemday_'+islandKey());
        localStorage.removeItem(SEASON_FINAL_KEY);
        localStorage.removeItem(txKey());
        return true;
      }catch(e){return false;}
    }
  };
  /* 钱包与页面状态就绪后自动续结算；失败会保留 pending，下一次进页/胜利继续。 */
  try{setTimeout(function(){try{if(modernWallets())recoverPending(false);}catch(e){}},0);}catch(e){}
})();
