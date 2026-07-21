/* ============================================================
   hansen_checkin_global.js  —  全局「每日签到」(修复"每个岛各领一次金币"的重大 bug)
   ------------------------------------------------------------
   【bug 背景】
     金币是全局钱包(hansen_coin_wallet.js, 所有岛共享一个余额 hansen_wallet_coins)。
     但原版"今天是否已领签到"的标记 S.chestDay、以及"连续签到"S.streak,
     都是各岛各自存在自己的存档里(wordIslandAnimal / wordIslandFood / ...)。
     于是每个岛都"以为自己今天还没领", 各发一次每日签到, 而币都进同一个总钱包
     → 总金币 = 各岛签到之和(打开 N 个岛就领 N 次)。这显然是 bug —— 每天只该领一次。

   【本文件做什么】(零侵入: 不改各岛 inline 玩法逻辑, 只在末尾包装三个全局函数)
     把"今天已领"和"连续签到"都全局化, 与全局钱包同级:
       · hansen_checkin_last        上次领签到的日期(全局)→ 任意岛领过, 全局锁定当天
       · hansen_checkin_streak      全局连续签到天数(全游戏一份, 不再各岛各算)
       · hansen_checkin_streak_day  连签最后推进的日期
     - 包装 doOpenChest: 全局当天已领 → 任何岛都不再发币; 没领 → 原版正常发, 发完标记全局已领。
       (一天只发一次, 跨岛/连点都防住, 因为标记是同步写入的。)
     - 包装 openChest: 全局当天已领 → 直接显示"今天已领, 明天再来"; 否则正常。
     - 进岛时推进全局连签(一天一次), 并把 S.streak 覆盖成全局值(显示 + 宝箱 bonus 都读它)。
   ============================================================ */
(function () {
  'use strict';

  var LAST_KEY   = 'hansen_checkin_last';        // 上次领签到日期(全局, 与各岛 today() 同格式 YYYY-M-D)
  var STREAK_KEY = 'hansen_checkin_streak';      // 全局连续签到天数
  var SDAY_KEY   = 'hansen_checkin_streak_day';  // 连签最后推进的日期(全局)
  var STREAK_PENDING_KEY='hansen_checkin_streak_pending_v942';
  var RESET_AT_KEY='hansen_checkin_streak_reset_at_v942';
  var RECEIPT_PREFIX='hansen_checkin_receipt_v942:';
  var XP_AWARD_KEY='hansen_charxp_awards_v942';
  var XP_PENDING_KEY='hansen_charxp_award_pending_v942';
  // 模板的正式基础奖励绝对上界：floor(80×2.2)×5=880，round(floor(40×2.2)×5)=440。
  // 贾维斯稀有宝箱的额外金币/碎片使用独立 addiction 事务，绝不能混入基础 receipt。
  var MAX_RECEIPT_COIN=880,MAX_RECEIPT_XP=440;

  // 与各岛 today() 完全一致的日期串: getFullYear()-'(month+1)'-getDate()
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function todayStr() { return ymd(new Date()); }
  function yestStr() { var d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); }
  function gi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function strictRaw(k){try{return {ok:true,value:localStorage.getItem(k)};}catch(e){return {ok:false,value:null};}}
  function si(k, v) { try {v=String(v);localStorage.setItem(k,v);return localStorage.getItem(k)===v;} catch (e) { return false; } }
  function safeObj(raw){try{var o=JSON.parse(raw||'null');return o&&typeof o==='object'&&!Array.isArray(o)?o:null;}catch(e){return null;}}
  function safeInt(v,max){v=Number(v);return isFinite(v)&&v>=0?Math.min(max||1000000000,Math.floor(v)):0;}
  function validPositiveInt(v,max){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>0&&v<=max;}
  function receiptKey(day){return RECEIPT_PREFIX+String(day||'');}
  function validRarityRoll(v){return typeof v==='number'&&isFinite(v)&&v>=0&&v<1;}
  function newRarityRoll(){
    // 每个用户首次准备当日 receipt 时只抽一次。crypto 不可用才回退 Math.random；
    // 抽样值随计划一起持久化，后续故障恢复绝不再抽。
    try{var c=window.crypto;if(c&&typeof c.getRandomValues==='function'&&typeof Uint32Array!=='undefined'){var a=new Uint32Array(1);c.getRandomValues(a);return a[0]/4294967296;}}catch(e){}
    try{var r=Math.random();if(validRarityRoll(r))return r;}catch(e){}return 0.5;
  }
  function validReceipt(r,day){
    if(!r||r.schema!==1||r.day!==day||r.txid!=='checkin:'+day)return false;
    if(!validPositiveInt(r.coin,MAX_RECEIPT_COIN)||!validPositiveInt(r.xp,MAX_RECEIPT_XP)||!/^(normal|great|critical)$/.test(r.tag))return false;
    // 新 receipt 必须是 [0,1) 有限数；旧 v942 receipt 可没有该字段，由消费端按 txid 稳定兼容。
    if(Object.prototype.hasOwnProperty.call(r,'rarityRoll')&&!validRarityRoll(r.rarityRoll))return false;
    return typeof r.committed==='boolean';
  }
  function readReceiptState(day){
    var raw=strictRaw(receiptKey(day));if(!raw.ok)return {ok:false,receipt:null};
    if(raw.value===null)return {ok:true,receipt:null};
    var r=safeObj(raw.value);return validReceipt(r,day)?{ok:true,receipt:r}:{ok:false,receipt:null};
  }
  function readReceipt(day){var state=readReceiptState(day);return state.ok?state.receipt:null;}
  function writeReceipt(r){if(!validReceipt(r,String(r&&r.day||'')))return false;try{var raw=JSON.stringify(r),k=receiptKey(r.day);localStorage.setItem(k,raw);return localStorage.getItem(k)===raw;}catch(e){return false;}}
  function publicReceipt(r){
    if(!r||!r.committed||!validReceipt(r,String(r.day||'')))return null;var out={ok:true,day:r.day,txid:r.txid,coin:r.coin,xp:r.xp,tag:r.tag};
    if(Object.prototype.hasOwnProperty.call(r,'rarityRoll'))out.rarityRoll=r.rarityRoll;return out;
  }

  // 签到 XP 与金币一样使用 sourceId 账本；pending 使任意步骤崩溃后都可按原 target 续做。
  function validXPAwardLedger(o){
    if(!o||typeof o!=='object'||Array.isArray(o))return false;var ids=Object.keys(o);
    for(var i=0;i<ids.length;i++){
      var id=ids[i],x=o[id];
      if(!/^checkin:\d{4}-\d{1,2}-\d{1,2}:xp$/.test(id)||!x||typeof x!=='object'||Array.isArray(x)||!validPositiveInt(x.amount,MAX_RECEIPT_XP)||typeof x.target!=='number'||!isFinite(x.target)||Math.floor(x.target)!==x.target||x.target<x.amount||x.target>1000000000||typeof x.at!=='number'||!isFinite(x.at)||Math.floor(x.at)!==x.at||x.at<=0||x.at>Number.MAX_SAFE_INTEGER)return false;
    }
    return true;
  }
  function readXPAwards(){var raw=strictRaw(XP_AWARD_KEY);if(!raw.ok)return null;if(raw.value===null)return {};var o=safeObj(raw.value);return validXPAwardLedger(o)?o:null;}
  function writeXPAwards(o){if(!validXPAwardLedger(o))return false;try{var raw=JSON.stringify(o);localStorage.setItem(XP_AWARD_KEY,raw);return localStorage.getItem(XP_AWARD_KEY)===raw;}catch(e){return false;}}
  function getXP(){var raw=strictRaw('hansen_wallet_charxp');if(!raw.ok)return null;if(raw.value===null)return 0;var n=Number(raw.value);return isFinite(n)&&Math.floor(n)===n&&n>=0&&n<=1000000000?n:null;}
  function setXP(n){return si('hansen_wallet_charxp',String(safeInt(n,1000000000)));}
  function validXPPending(p){return !!(p&&typeof p.id==='string'&&/^checkin:\d{4}-\d{1,2}-\d{1,2}:xp$/.test(p.id)&&validPositiveInt(p.amount,MAX_RECEIPT_XP)&&typeof p.before==='number'&&isFinite(p.before)&&Math.floor(p.before)===p.before&&p.before>=0&&p.before<=1000000000&&typeof p.target==='number'&&isFinite(p.target)&&Math.floor(p.target)===p.target&&p.target===p.before+p.amount&&p.target<=1000000000&&typeof p.at==='number'&&isFinite(p.at)&&Math.floor(p.at)===p.at&&p.at>0&&p.at<=Number.MAX_SAFE_INTEGER);}
  function recoverXP(){
    // ledger 是去重事实；读取失败/损坏时绝不能把它当空表后覆盖。
    var ledger=readXPAwards();if(!ledger)return false;
    var pendingState=strictRaw(XP_PENDING_KEY);if(!pendingState.ok)return false;var pendingRaw=pendingState.value;if(pendingRaw===null)return true;var p=safeObj(pendingRaw);
    if(!validXPPending(p)){try{localStorage.removeItem(XP_PENDING_KEY);}catch(e){}return false;}
    var target=p.target,before=p.before;
    // ledger 已提交即代表 XP 写入先前已成功；残留 pending 只能清理，不能在玩家消费后抬回旧 target。
    if(Object.prototype.hasOwnProperty.call(ledger,p.id)){
      var committed=ledger[p.id];if(committed.amount!==p.amount||committed.target!==p.target)return false;
      try{localStorage.removeItem(XP_PENDING_KEY);return localStorage.getItem(XP_PENDING_KEY)===null;}catch(e){return false;}
    }
    var oldState=strictRaw('hansen_wallet_charxp');if(!oldState.ok)return false;var old=oldState.value,ledgerCommitted=false;
    try{
      var cur=getXP();if(cur===null)throw new Error('签到经验读取失败');
      if(cur===before){if(!setXP(target))throw new Error('签到经验恢复失败');}
      else if(cur!==target)throw new Error('签到经验与其它事务冲突');
      ledger[p.id]={amount:p.amount,target:target,at:p.at};if(!writeXPAwards(ledger))throw new Error('签到经验账本恢复失败');ledgerCommitted=true;
      localStorage.removeItem(XP_PENDING_KEY);if(localStorage.getItem(XP_PENDING_KEY)!==null)throw new Error('签到经验 pending 清理失败');return true;
    }catch(e){
      if(!ledgerCommitted)try{var now=getXP();if(now===target){if(old===null)localStorage.removeItem('hansen_wallet_charxp');else localStorage.setItem('hansen_wallet_charxp',old);}}catch(_e){}
      return false;
    }
  }
  function awardXP(id,n){
    id=String(id||'');if(!validPositiveInt(n,MAX_RECEIPT_XP)||!/^checkin:\d{4}-\d{1,2}-\d{1,2}:xp$/.test(id)||!recoverXP())return false;
    var ledger=readXPAwards();if(!ledger)return false;if(Object.prototype.hasOwnProperty.call(ledger,id))return ledger[id].amount===n;
    var before=getXP();if(before===null||before>1000000000-n)return false;var oldState=strictRaw('hansen_wallet_charxp');if(!oldState.ok)return false;var target=before+n,old=oldState.value,p={id:id,amount:n,before:before,target:target,at:Date.now()},ledgerCommitted=false;
    try{
      var raw=JSON.stringify(p);localStorage.setItem(XP_PENDING_KEY,raw);if(localStorage.getItem(XP_PENDING_KEY)!==raw)throw new Error('经验事务准备失败');
      if(!setXP(target))throw new Error('经验入账失败');
      ledger[id]={amount:n,target:target,at:p.at};if(!writeXPAwards(ledger))throw new Error('经验账本写入失败');ledgerCommitted=true;
      localStorage.removeItem(XP_PENDING_KEY);if(localStorage.getItem(XP_PENDING_KEY)!==null)throw new Error('经验 pending 清理失败');return true;
    }catch(e){
      if(!ledgerCommitted)try{var now=getXP();if(now===target){if(old===null)localStorage.removeItem('hansen_wallet_charxp');else localStorage.setItem('hansen_wallet_charxp',old);}}catch(_e){}
      if(!ledgerCommitted)try{localStorage.removeItem(XP_PENDING_KEY);}catch(_e){}return false;
    }
  }

  function validDayString(v){
    if(typeof v!=='string')return false;var m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return false;
    try{var d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return ymd(d)===v;}catch(e){return false;}
  }
  function previousDayOf(day){
    if(!validDayString(day))return '';var m=day.match(/^(\d+)-(\d+)-(\d+)$/),d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));d.setDate(d.getDate()-1);return ymd(d);
  }
  function streakFromRaw(raw){
    if(raw===null)return 0;if(typeof raw!=='string'||!/^\d+$/.test(raw))return null;var n=Number(raw);return isFinite(n)&&Math.floor(n)===n&&n>=0&&n<=1000000000?n:null;
  }
  function validStreakPlan(p){
    if(!p||p.schema!==1||typeof p.id!=='string'||p.id!=='streak:'+p.day||!validDayString(p.day))return false;
    var before=streakFromRaw(p.beforeStreak);if(before===null||(p.beforeDay!==null&&!validDayString(p.beforeDay)))return false;
    var expected=p.beforeDay===previousDayOf(p.day)?before+1:1;
    return validPositiveInt(p.targetStreak,1000000000)&&p.targetStreak===expected&&p.targetDay===p.day&&typeof p.at==='number'&&isFinite(p.at)&&Math.floor(p.at)===p.at&&p.at>0&&p.at<=Number.MAX_SAFE_INTEGER;
  }
  function readStreakPlan(){
    var raw=strictRaw(STREAK_PENDING_KEY);if(!raw.ok)return {ok:false,plan:null};if(raw.value===null)return {ok:true,plan:null};var p=safeObj(raw.value);return validStreakPlan(p)?{ok:true,plan:p}:{ok:false,plan:null};
  }
  function writeRawExact(k,value){
    try{if(value===null)localStorage.removeItem(k);else localStorage.setItem(k,String(value));return localStorage.getItem(k)===value;}catch(e){return false;}
  }
  function rollbackStreakPlan(p){
    var targetStreak=String(p.targetStreak),targetDay=p.targetDay,safe=true;
    function one(k,before,target){var cur=strictRaw(k);if(!cur.ok){safe=false;return;}if(cur.value===target){if(!writeRawExact(k,before))safe=false;}else if(cur.value!==before)safe=false;}
    one(STREAK_KEY,p.beforeStreak,targetStreak);one(SDAY_KEY,p.beforeDay,targetDay);
    var s=strictRaw(STREAK_KEY),d=strictRaw(SDAY_KEY);if(!s.ok||!d.ok||s.value!==p.beforeStreak||d.value!==p.beforeDay)safe=false;
    if(safe)try{localStorage.removeItem(STREAK_PENDING_KEY);if(localStorage.getItem(STREAK_PENDING_KEY)!==null)safe=false;}catch(e){safe=false;}
    return safe;
  }
  function applyStreakPlan(p){
    var targetStreak=String(p.targetStreak),targetDay=p.targetDay;
    try{
      var s=strictRaw(STREAK_KEY),d=strictRaw(SDAY_KEY);if(!s.ok||!d.ok)throw new Error('连签存储读取失败');
      if(s.value!==p.beforeStreak&&s.value!==targetStreak)throw new Error('连签数已被并发修改');
      if(d.value!==p.beforeDay&&d.value!==targetDay)throw new Error('连签日期已被并发修改');
      if(s.value!==targetStreak&&!writeRawExact(STREAK_KEY,targetStreak))throw new Error('连签数写入失败');
      if(d.value!==targetDay&&!writeRawExact(SDAY_KEY,targetDay))throw new Error('连签日期写入失败');
      localStorage.removeItem(STREAK_PENDING_KEY);if(localStorage.getItem(STREAK_PENDING_KEY)!==null)throw new Error('连签事务清理失败');return p.targetStreak;
    }catch(e){rollbackStreakPlan(p);return false;}
  }
  function recoverStreakPending(){var state=readStreakPlan();if(!state.ok)return {ok:false,pending:false,value:0,day:''};if(!state.plan)return {ok:true,pending:false,value:0,day:''};var value=applyStreakPlan(state.plan);return {ok:value!==false,pending:true,value:value===false?0:value,day:state.plan.day};}

  function getStreak() { var raw=strictRaw(STREAK_KEY),n=raw.ok?streakFromRaw(raw.value):null;return n!==null&&n>0?n:0; }
  function claimedToday() { return gi(LAST_KEY) === todayStr(); }

  // v942: v941 第一次启用全局签到时会直接从 1 开始，忽略各岛已经积累的 streak。
  // 每次启动都扫描一次（而非只看一次性 flag），这样用户后来恢复的老备份也能补迁移。
  function migrateLegacy(){
    // 未完成的两键事务必须先由 touchLogin 恢复；迁移不能跨过 journal 改写其中任一键。
    var pending=readStreakPlan();if(!pending.ok||pending.plan)return getStreak();
    var t=todayStr(), y=yestStr(), best=0, bestDay='', claimed=false;
    var resetAt=0;try{resetAt=Math.max(0,Number(gi(RESET_AT_KEY))||0);}catch(e){}
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i); if(!key||!/^wordIsland/.test(key)||/_tmp$/i.test(key))continue;
        var s; try{s=JSON.parse(localStorage.getItem(key)||'null');}catch(e){continue;}
        if(!s||typeof s!=='object')continue;
        var day=String(s.lastDay||s.lastSign||'');
        var n=Math.max(0,Math.floor(Number(s.streak)||0)),sourceAt=Math.max(0,Number(s.lastSaveTime)||0);
        // 只有今天/昨天的连续记录仍有效；陈年备份不能恢复成“不断签”。
        if((!resetAt||sourceAt>resetAt)&&(day===t||day===y)&&(n>best||(n===best&&day===t))){best=n;bestDay=day;}
        if(String(s.chestDay||'')===t)claimed=true;
      }
    }catch(e){}
    try{
      var cur=getStreak(),curDay=String(gi(SDAY_KEY)||''),curValid=(curDay===t||curDay===y);
      // 有效的老存档应接管已经过期的全局记录，即使它的 streak 数字更小；
      // 否则“全局曾有 100 天但早已断签”会压住昨天恢复的 7 天，随后又被重置为 1。
      if(best>0&&(!curValid||best>cur||(bestDay===t&&curDay!==t))){
        si(STREAK_KEY,String(best));
        si(SDAY_KEY,bestDay);
      }
      if(claimed&&!claimedToday())si(LAST_KEY,t);
      si('hansen_checkin_migrated_v942','1');
    }catch(e){}
    return getStreak();
  }

  // 全局连签推进: 每个自然日"第一次打开任意岛"时调用, 一天只推进一次, 跨岛不重复。
  function touchLogin() {
    var recovered=recoverStreakPending(),t=todayStr();if(!recovered.ok)return getStreak();
    if(recovered.pending&&recovered.day===t)return recovered.value;
    var rawStreak=strictRaw(STREAK_KEY),rawDay=strictRaw(SDAY_KEY);if(!rawStreak.ok||!rawDay.ok)return getStreak();
    var before=streakFromRaw(rawStreak.value);if(before===null||(rawDay.value!==null&&!validDayString(rawDay.value)))return getStreak();
    if(rawDay.value===t)return before;
    var target=rawDay.value===yestStr()?before+1:1;if(target>1000000000)return before;
    var p={schema:1,id:'streak:'+t,day:t,beforeStreak:rawStreak.value,beforeDay:rawDay.value,targetStreak:target,targetDay:t,at:Date.now()};
    try{var raw=JSON.stringify(p);localStorage.setItem(STREAK_PENDING_KEY,raw);if(localStorage.getItem(STREAK_PENDING_KEY)!==raw)return before;}catch(e){return before;}
    var applied=applyStreakPlan(p);return applied===false?getStreak():applied;
  }

  // 领取当天签到: 标记全局已领(一天只算一次)。
  function markClaimed(day) { day=String(day||todayStr());return day===todayStr()&&si(LAST_KEY,day); }

  function syncReceiptToS(r){
    if(!r||!r.committed||!validReceipt(r,String(r.day||''))||!window.S)return false;
    try{
      if(!S.stats||typeof S.stats!=='object'||Array.isArray(S.stats))S.stats={};
      if(!S.checkinReceipts||typeof S.checkinReceipts!=='object'||Array.isArray(S.checkinReceipts))S.checkinReceipts={};
      if(S.checkinReceipts[r.day]!==r.txid){
        if(String(window.__hsnSaveKey||'')===String(r.saveKey||'')){
          S.totalXP=Math.max(safeInt(S.totalXP,1000000000),safeInt(r.localTargetTotal,1000000000));
          S.stats.chestClaimed=Math.max(safeInt(S.stats.chestClaimed,1000000000),safeInt(r.targetClaims,1000000000));
        }
        S.checkinReceipts[r.day]=r.txid;
      }
      S.chestDay=r.day;var globalXP=getXP();if(globalXP!==null)S.charXP=globalXP;
      try{if(typeof getAdvLevel==='function'){S.level=getAdvLevel().lv;if(typeof getXpInCurrentLevel==='function')S.xp=getXpInCurrentLevel();}}catch(e){}
      var ok=true;if(typeof window.__hsnSaveNow==='function')ok=window.__hsnSaveNow()===true;else if(typeof window.save==='function')ok=window.save()!==false;
      try{if(typeof updateTopBar==='function')updateTopBar();}catch(e){}return ok;
    }catch(e){return false;}
  }

  function getReceipt(day){day=String(day||todayStr());return publicReceipt(readReceipt(day));}
  function claimReward(candidate){
    // 先验证 XP 去重账本和已有 receipt；任何读取失败/损坏都不得创建新 receipt 或发币。
    if(!recoverXP())return {ok:false,error:'xp-ledger-unavailable'};
    var day=todayStr(),receiptState=readReceiptState(day);if(!receiptState.ok)return {ok:false,error:'invalid-receipt'};
    var wasClaimed=claimedToday(),r=receiptState.receipt;
    if(r&&r.committed){
      if(!wasClaimed&&!markClaimed(day))return {ok:false,pending:true,receipt:publicReceipt(r)};
      syncReceiptToS(r);
      return wasClaimed?{ok:false,already:true,receipt:publicReceipt(r)}:publicReceipt(r);
    }
    // 老版本已领过但没有 v942 receipt：只承认历史防刷锁，绝不补抽/补发。
    if(wasClaimed&&!r)return {ok:false,already:true,receipt:null};
    if(!r){
      candidate=candidate&&typeof candidate==='object'?candidate:{};
      var coin=candidate.coin,xp=candidate.xp,tag=candidate.tag;
      if((Object.prototype.hasOwnProperty.call(candidate,'day')&&String(candidate.day)!==day)||!validPositiveInt(coin,MAX_RECEIPT_COIN)||!validPositiveInt(xp,MAX_RECEIPT_XP)||!/^(normal|great|critical)$/.test(tag))return {ok:false,error:'invalid-reward'};
      r={schema:1,day:day,txid:'checkin:'+day,coin:coin,xp:xp,tag:tag,rarityRoll:newRarityRoll(),
        saveKey:String(window.__hsnSaveKey||''),localTargetTotal:Math.min(1000000000,safeInt(window.S&&S.totalXP,1000000000)+xp),targetClaims:safeInt(window.S&&S.stats&&S.stats.chestClaimed,1000000000)+1,createdAt:Date.now(),committed:false};
      if(!writeReceipt(r))return {ok:false,error:'receipt-write'};
    }
    if(!window.HansenCoins||typeof HansenCoins.award!=='function'||!HansenCoins.award(r.txid+':coin',r.coin))return {ok:false,pending:true};
    if(!awardXP(r.txid+':xp',r.xp))return {ok:false,pending:true};
    r.committed=true;r.committedAt=Date.now();if(!writeReceipt(r))return {ok:false,pending:true};
    if(!markClaimed(day))return {ok:false,pending:true,receipt:publicReceipt(r)};
    syncReceiptToS(r);return publicReceipt(r);
  }
  function recoverToday(){
    if(!recoverXP())return false;var state=readReceiptState(todayStr());if(!state.ok)return false;var r=state.receipt;if(!r)return true;
    if(r.committed){if(!claimedToday()&&!markClaimed(r.day))return false;syncReceiptToS(r);return true;}
    var out=claimReward({coin:r.coin,xp:r.xp,tag:r.tag});return !!(out&&out.ok);
  }

  window.HansenCheckin = {
    claimedToday: claimedToday,
    getStreak: getStreak,
    touchLogin: touchLogin,
    markClaimed: markClaimed,
    claimReward: claimReward,
    getReceipt: getReceipt,
    syncReceiptToS: function(receipt){return syncReceiptToS(readReceipt(receipt&&receipt.day||todayStr()));},
    recover: recoverToday,
    migrateLegacy: migrateLegacy,
    reset: function(){
      var ts=Date.now(),oldStreak=null,oldDay=null,oldReset=null,entries=[];
      try{
        oldStreak=localStorage.getItem(STREAK_KEY);oldDay=localStorage.getItem(SDAY_KEY);oldReset=localStorage.getItem(RESET_AT_KEY);
        var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^wordIsland/.test(k)&&!/_tmp$/i.test(k))keys.push(k);}
        keys.forEach(function(k){try{var raw=localStorage.getItem(k),s=JSON.parse(raw||'null');if(!s||typeof s!=='object')return;s.streak=0;s.lastDay='';s.lastSign='';s.lastSaveTime=Math.max(Number(s.lastSaveTime)||0,ts);entries.push([k,raw,JSON.stringify(s)]);}catch(e){}});
        entries.forEach(function(x){localStorage.setItem(x[0],x[2]);if(localStorage.getItem(x[0])!==x[2])throw new Error('岛屿连签清除失败');});
        localStorage.setItem(STREAK_KEY,'0');localStorage.setItem(SDAY_KEY,todayStr());
        if(localStorage.getItem(STREAK_KEY)!=='0'||localStorage.getItem(SDAY_KEY)!==todayStr())throw new Error('全局连签清除失败');
        localStorage.setItem(RESET_AT_KEY,String(ts));if(localStorage.getItem(RESET_AT_KEY)!==String(ts))throw new Error('连签清除水位写入失败');
        // LAST_KEY / chestDay 是“今天奖励已领”的防刷锁，不属于连续天数，必须保留。
        return true;
      }catch(e){
        entries.forEach(function(x){try{localStorage.setItem(x[0],x[1]);}catch(_e){}});
        try{if(oldStreak===null)localStorage.removeItem(STREAK_KEY);else localStorage.setItem(STREAK_KEY,oldStreak);}catch(_e){}
        try{if(oldDay===null)localStorage.removeItem(SDAY_KEY);else localStorage.setItem(SDAY_KEY,oldDay);}catch(_e){}
        try{if(oldReset===null)localStorage.removeItem(RESET_AT_KEY);else localStorage.setItem(RESET_AT_KEY,oldReset);}catch(_e){}
        return false;
      }
    }
  };

  // 把全局连签同步到本岛 S.streak —— 各岛的"连续签到 N 天"显示 & 宝箱奖励 bonus 都读 S.streak,
  // 覆盖成全局值后, 显示和奖励倍率就统一用全游戏一份的连签。
  function syncStreakToS() { try { if (window.S) window.S.streak = getStreak(); } catch (e) {} }

  // 全局 ↔ 本岛 chestDay 双向同步(不依赖包装器, 靠各岛 inline 闸门兜底, 彻底防跨岛刷币):
  //   · 全局今天已领 → 把本岛 S.chestDay 也设成今天。各岛 inline 的 openChest()/doOpenChest()
  //     里本来就有 `if(S.chestDay===today())` 闸门(始终运行, 不依赖任何包装), 于是直接显示
  //     "今天已领"且 doOpenChest 直接 return, 一分钱不发。
  //   · 本岛 inline 刚领过(S.chestDay===今天)但全局还没标 → 立即 markClaimed(), 把"今天已领"
  //     广播给其他岛。即使 doOpenChest 的包装器没生效/没装上(时机/旧部署), 也能把领取广播出去。
  function syncChestBothWays() {
    try {
      if (!window.S) return;
      var t = todayStr();
      if (claimedToday()) {
        if (window.S.chestDay !== t) window.S.chestDay = t;   // 全局已领 → 本岛 inline 闸门即生效
      } else if (window.S.chestDay === t) {
        markClaimed();                                        // 本岛已领 → 广播全局
      }
    } catch (e) {}
  }

  function install() {
    // ① 进岛: 推进全局连签(一天一次)+ 覆盖 S.streak + 同步 chestDay
    try { migrateLegacy(); } catch (e) {}
    try { touchLogin(); } catch (e) {}
    try { recoverToday(); } catch (e) {}
    syncStreakToS();
    syncChestBothWays();
    // 轻量定时双向同步(700ms, 仅 2 次 localStorage 读, 开销可忽略): 不论包装器是否/何时生效,
    // 都保证「全局已领 → 本岛锁住」与「本岛刚领 → 广播全局」始终一致, 彻底杜绝跨岛重复领。
    try { setInterval(function () { syncStreakToS(); syncChestBothWays(); }, 700); } catch (e) {}
    // S 在 DOMContentLoaded 时可能还没 ready, 早期多补几次同步。
    try { setTimeout(syncChestBothWays, 200); setTimeout(syncChestBothWays, 800); setTimeout(syncChestBothWays, 1600); } catch (e) {}

    // ② 包装 doOpenChest: 全局当天已领 → 不再发; 否则原版发奖, 发完标记全局已领
    if (typeof window.doOpenChest === 'function' && !window.doOpenChest.__hbuGlobal) {
      var _do = window.doOpenChest;
      window.doOpenChest = function () {
        if (claimedToday()) {var oldReceipt=getReceipt();try{if(oldReceipt)syncReceiptToS(readReceipt(oldReceipt.day));}catch(e){}return {ok:false,already:true,receipt:oldReceipt};}
        syncStreakToS();                       // 确保奖励 bonus 用全局连签
        var r = _do.apply(this, arguments);
        if(r&&r.ok)markClaimed(r.day);          // 只承认正式事务 receipt，失败/异常调用不得假锁当天
        return r;
      };
      window.doOpenChest.__hbuGlobal = true;
    }

    // ③ 包装 openChest: 全局当天已领 → 直接显示"今天已领"; 否则正常(先把连签同步成全局)
    if (typeof window.openChest === 'function' && !window.openChest.__hbuGlobal) {
      var _open = window.openChest;
      window.openChest = function () {
        syncStreakToS();
        if (claimedToday()) {
          // 🔴 v575: 全局已领 → 仍展示本岛完整打卡页(连续天数+倍率+详表), 由 renderCheckinPage 统一渲染。
          try {
            if (typeof showScreen === 'function') showScreen('chest');
            var c = document.getElementById('chestContent');
            if (c) {
              var __stk = getStreak();
              var __mult = (1 + Math.max(0, Math.min(__stk - 1, 6)) * 0.2).toFixed(1);
              if (typeof window.renderCheckinPage === 'function') {
                c.innerHTML = window.renderCheckinPage(__stk, __mult, true);
              } else {
                c.innerHTML =
                  '<div style="font-size:80px;margin:20px 0">📂</div>' +
                  '<div style="font-size:16px;color:#cbd5e1">今天的签到已经领过啦！<br>明天再来吧～</div>' +
                  '<div style="font-size:13px;color:#cbd5e1;margin-top:12px">连续打卡 <b style="color:#fbbf24">' + __stk + '</b> 天，越久奖励越丰厚！</div>';
              }
            }
          } catch (e) {}
          return;
        }
        return _open.apply(this, arguments);
      };
      window.openChest.__hbuGlobal = true;
    }
  }

  // 🔴v653 每日宝箱「开箱光芒绽放」动画: 宝箱亮度渐增(越来越亮)+金光绽放(光芒四射)+金币飞出, 衔接到奖励卡。
  // 全程仅用 缩放/位移/透明度/亮度滤镜/drop-shadow, 无旋转·无闪烁·无抖动(守防晕红线)。光晕与金币挂到 body 上, 不随内容刷新被截断。
  window.hansenChestFX = function (box) {
    try {
      if (!box) return;
      if (!document.getElementById('hsn-chestfx-css')) {
        var st = document.createElement('style'); st.id = 'hsn-chestfx-css';
        st.textContent =
          '@keyframes hsnChestGlow{0%{filter:brightness(1);transform:scale(1)}50%{filter:brightness(1.6) drop-shadow(0 0 24px rgba(255,216,90,.95));transform:scale(1.05)}100%{filter:brightness(2.7) drop-shadow(0 0 58px rgba(255,238,160,1));transform:scale(1.09)}}'
          + '.hsn-chest-opening{animation:hsnChestGlow .62s ease-in forwards;transform-origin:center center}'
          + '@keyframes hsnBloom{0%{transform:translate(-50%,-50%) scale(.32);opacity:0}45%{opacity:.96}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}'
          + '.hsn-bloom{position:fixed;width:230px;height:230px;border-radius:50%;pointer-events:none;z-index:9998;background:radial-gradient(circle,rgba(255,255,255,.98) 0%,rgba(255,230,130,.9) 26%,rgba(255,196,66,.45) 52%,rgba(255,196,66,0) 74%);animation:hsnBloom .74s ease-out forwards}'
          + '.hsn-coin{position:fixed;font-size:30px;line-height:1;pointer-events:none;z-index:10001;will-change:transform,opacity}';
        document.head.appendChild(st);
      }
      var r = box.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      box.classList.add('hsn-chest-opening');               // 宝箱越来越亮 + 轻微放大
      var bloom = document.createElement('div'); bloom.className = 'hsn-bloom';  // 金光绽放(光芒四射)
      bloom.style.left = (cx - 115) + 'px'; bloom.style.top = (cy - 115) + 'px';
      document.body.appendChild(bloom);
      setTimeout(function () { try { bloom.remove(); } catch (e) {} }, 820);
      var N = 13;                                            // 金币飞出
      for (var k = 0; k < N; k++) {
        (function (k) {
          var c = document.createElement('div'); c.className = 'hsn-coin'; c.textContent = '🪙';
          c.style.left = cx + 'px'; c.style.top = cy + 'px';
          var ang = (-Math.PI / 2) + (((k + .5) / N) - .5) * Math.PI * 1.5;   // 向上扇形喷射
          var dist = 95 + Math.random() * 120;
          var dx = Math.cos(ang) * dist;
          var dy = Math.sin(ang) * dist - (30 + Math.random() * 50);
          var delay = 120 + k * 24;
          document.body.appendChild(c);
          try {
            c.animate([
              { transform: 'translate(-50%,-50%) scale(.35)', opacity: 0, offset: 0 },
              { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: .16 },
              { transform: 'translate(calc(-50% + ' + dx.toFixed(0) + 'px),calc(-50% + ' + dy.toFixed(0) + 'px)) scale(1)', opacity: 1, offset: .68 },
              { transform: 'translate(calc(-50% + ' + dx.toFixed(0) + 'px),calc(-50% + ' + (dy + 80).toFixed(0) + 'px)) scale(.65)', opacity: 0, offset: 1 }
            ], { duration: 980, delay: delay, easing: 'cubic-bezier(.18,.7,.32,1)', fill: 'forwards' });
          } catch (e) {}
          setTimeout(function () { try { c.remove(); } catch (e) {} }, 1100 + delay);
        })(k);
      }
    } catch (e) {}
  };

  if (document.readyState !== 'loading') install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
})();
