// hansen_coin_wallet.js v942 — 全局金币钱包
// ============================================================
// 背景: 金币原本各岛独立(存各岛存档的 S.coins)。为了让抽卡/卡册做成"全局一套"
//   (金币汇总才抽得起、卡片就20个boss一套即可、不肝不重复), 把金币改成全局统一。
//   做法仿照已有的全局钻石钱包 HansenGems(hansen_gem_system.js)。
//
// 设计要点:
//   1) 全局金币钱包 key = 'hansen_wallet_coins'(18个岛共享一个金币数)。
//   2) 对外提供 window.HansenCoins.{get,add,spend}, 所有岛的金币赚/花都走它。
//   3) 启动时把后来恢复的旧 S.coins 余额也【合并迁移】到全局钱包，并清理主/备份旧余额。
//      —— 与钻石不同: 钻石当时是"清零重来", 金币这里是"合并保留"(玩家辛苦赚的金币不该没收)。
//   4) 零侵入独立文件。岛页里 addCoin/earnCoinOnCorrect 等改成调用 HansenCoins(后续接入)。
// ============================================================
(function(){
  if(window.__hansenCoinWalletLoaded){ return; } window.__hansenCoinWalletLoaded = true;

  var COIN_WALLET_KEY  = 'hansen_wallet_coins';        // 全局金币钱包
  var COIN_EARNED_KEY  = 'hansen_wallet_coins_earned'; // 历史累计获得（消费不扣）
  var MIGRATE_FLAG_KEY = 'hansen_coins_migrated_v1';   // 一次性迁移标记
  var MIGRATE_JOURNAL_KEY='hansen_coin_migration_journal_v942';
  var MIGRATE_COMMIT_KEY='hansen_coin_migration_commit_v942';
  var AWARD_KEY='hansen_coin_awards_v942',AWARD_PENDING_KEY='hansen_coin_award_pending_v942';
  var MAX_BALANCE=1000000000000,MAX_AWARD=1000000;

  function saveError(msg,e){try{if(typeof window.__hsnSaveNotice==='function')window.__hsnSaveNotice(msg,e);else window.dispatchEvent(new CustomEvent('hansen-save-error',{detail:{message:msg,error:String(e&&e.message||e||msg)}}));}catch(_e){}}
  function rawRestore(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);return localStorage.getItem(k)===(v===null?null:String(v));}catch(e){return false;}}

  // ---- 全局金币钱包读写 ----
  function readCoins(){
    try {
      var raw=localStorage.getItem(COIN_WALLET_KEY);if(raw===null)return 0;var v=Number(raw);
      return (isFinite(v)&&Math.floor(v)===v&&v>=0&&v<=MAX_BALANCE)?v:null;
    } catch(e){ return null; }
  }
  function getCoins(){var n=readCoins();return n===null?0:n;}
  function setCoins(n){
    try {
      var v=String(Math.max(0,Math.floor(n)));
      localStorage.setItem(COIN_WALLET_KEY,v);
      return localStorage.getItem(COIN_WALLET_KEY)===v;
    } catch(e){ return false; }
  }
  function readEarned(){try{var raw=localStorage.getItem(COIN_EARNED_KEY);if(raw===null)return 0;var n=Number(raw);return isFinite(n)&&Math.floor(n)===n&&n>=0&&n<=MAX_BALANCE?n:null;}catch(e){return null;}}
  function getEarned(){var n=readEarned();return n===null?0:n;}
  function setEarned(n){
    try{var v=String(Math.max(0,Math.floor(n)));localStorage.setItem(COIN_EARNED_KEY,v);return localStorage.getItem(COIN_EARNED_KEY)===v;}catch(e){return false;}
  }
  function readAwards(){
    try{
      var raw=localStorage.getItem(AWARD_KEY);if(raw===null)return {};var o=JSON.parse(raw);
      if(!o||typeof o!=='object'||Array.isArray(o))return null;
      var keys=Object.keys(o);for(var i=0;i<keys.length;i++){
        var id=keys[i],r=o[id];if(!validId(id)||!r||typeof r!=='object'||Array.isArray(r)||!exactInt(r.amount,0,MAX_AWARD)||!exactInt(r.at,1,Number.MAX_SAFE_INTEGER))return null;
        if(Object.prototype.hasOwnProperty.call(r,'migrated')&&r.migrated!==true)return null;
      }
      return o;
    }catch(e){return null;}
  }
  function writeAwards(o){if(!o)return false;try{var raw=JSON.stringify(o);localStorage.setItem(AWARD_KEY,raw);return localStorage.getItem(AWARD_KEY)===raw;}catch(e){return false;}}
  function readPending(){try{var raw=localStorage.getItem(AWARD_PENDING_KEY);if(raw===null)return null;var p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:{__invalid:true};}catch(e){return {__invalid:true};}}
  function validId(id){return typeof id==='string'&&id.length>0&&id.length<=160&&!/[\u0000-\u001f\u007f]/.test(id)&&id!=='__proto__'&&id!=='prototype'&&id!=='constructor';}
  function exactInt(v,min,max){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>=min&&v<=max;}
  function validPending(p){return !!(p&&!p.__invalid&&validId(p.id)&&exactInt(p.amount,1,MAX_AWARD)&&exactInt(p.beforeWallet,0,MAX_BALANCE)&&exactInt(p.beforeEarned,0,MAX_BALANCE)&&exactInt(p.targetWallet,0,MAX_BALANCE)&&exactInt(p.targetEarned,0,MAX_BALANCE)&&p.targetWallet===p.beforeWallet+p.amount&&p.targetEarned===p.beforeEarned+p.amount&&exactInt(p.at,1,Number.MAX_SAFE_INTEGER));}
  function rejectPending(){try{localStorage.removeItem(AWARD_PENDING_KEY);return localStorage.getItem(AWARD_PENDING_KEY)===null;}catch(e){return false;}}
  function seedAwards(ids){if(!recoverAward())return false;var ledger=readAwards(),changed=false;if(!ledger)return false;(ids||[]).forEach(function(id){id=String(id||'');if(validId(id)&&!Object.prototype.hasOwnProperty.call(ledger,id)){ledger[id]={amount:0,at:Date.now(),migrated:true};changed=true;}});return !changed||writeAwards(ledger);}
  function recoverAward(){
    var p=readPending();if(!p)return true;if(!validPending(p)){rejectPending();saveError('检测到损坏的金币奖励事务，已拒绝恢复且未改动余额',new Error('invalid coin pending'));return false;}var ledger=readAwards(),wallet=readCoins(),earnedNow=readEarned();if(!ledger||wallet===null||earnedNow===null)return false;
    if(Object.prototype.hasOwnProperty.call(ledger,p.id)){
      // ledger 是唯一提交点；它存在后余额可能已经被合法消费，绝不能再抬回旧 target。
      if(Number(ledger[p.id].amount)!==Number(p.amount))return false;
      try{localStorage.removeItem(AWARD_PENDING_KEY);return localStorage.getItem(AWARD_PENDING_KEY)===null;}catch(e){return false;}
    }
    var oldW=localStorage.getItem(COIN_WALLET_KEY),oldE=localStorage.getItem(COIN_EARNED_KEY);
    try{
      var wBefore=wallet===Number(p.beforeWallet),wTarget=wallet===Number(p.targetWallet),eBefore=earnedNow===Number(p.beforeEarned),eTarget=earnedNow===Number(p.targetEarned);
      if(!(wBefore||wTarget)||!(eBefore||eTarget)||(!wBefore&&eBefore))throw new Error('金币奖励现场与 before/target 均不一致');
      if(wBefore&&!setCoins(p.targetWallet))throw new Error('金币奖励恢复失败');
      if(eBefore&&!setEarned(p.targetEarned))throw new Error('累计金币奖励恢复失败');
      ledger[p.id]={amount:p.amount,at:p.at};if(!writeAwards(ledger))throw new Error('金币奖励账本恢复失败');
      localStorage.removeItem(AWARD_PENDING_KEY);return localStorage.getItem(AWARD_PENDING_KEY)===null;
    }catch(e){rawRestore(COIN_WALLET_KEY,oldW);rawRestore(COIN_EARNED_KEY,oldE);saveError('金币奖励事务未完成，稍后会自动重试',e);return false;}
  }
  // v941 没有累计总账；至少用当前余额作保守下界，已经花掉的历史金币不再凭空猜测。
  var initialCoins=readCoins(),initialEarned=readEarned();if(initialCoins!==null&&initialEarned!==null&&initialEarned<initialCoins)setEarned(initialCoins);

  // 对外接口(供 答题/打boss/签到/任务成就 发金币, 商店/抽卡 扣金币 使用)
  window.HansenCoins = {
    get: getCoins,
    getEarned: getEarned,
    add: function(n){
      n=Number(n); if(!isFinite(n)||n<=0)return getCoins(); n=Math.floor(n);if(!recoverAward())return getCoins();
      var oldW=localStorage.getItem(COIN_WALLET_KEY),oldE=localStorage.getItem(COIN_EARNED_KEY),before=readCoins(),earned=readEarned();if(before===null||earned===null)return getCoins();var w=before+n;
      if(setCoins(w)&&setEarned(earned+n))return w;
      rawRestore(COIN_WALLET_KEY,oldW);rawRestore(COIN_EARNED_KEY,oldE);saveError('金币未能保存，本次奖励未入账',new Error('coin wallet write failed'));return before;
    },
    spend: function(n){ n = Number(n); if(!isFinite(n) || n < 0||!recoverAward()) return false; var w=readCoins();if(w===null||w<n)return false;var old=null;try{old=localStorage.getItem(COIN_WALLET_KEY);}catch(e){return false;}var ok=setCoins(w-n);if(!ok){rawRestore(COIN_WALLET_KEY,old);saveError('金币扣款未保存，交易已取消',new Error('coin spend write failed'));}return ok; },
    award:function(id,n){
      id=String(id||'');n=Number(n);if(!validId(id)||!isFinite(n)||(n=Math.floor(n))<=0||n>MAX_AWARD||!recoverAward())return false;
      var ledger=readAwards();if(!ledger)return false;if(Object.prototype.hasOwnProperty.call(ledger,id))return true;
      var beforeWallet=readCoins(),beforeEarned=readEarned();if(beforeWallet===null||beforeEarned===null||beforeWallet>MAX_BALANCE-n||beforeEarned>MAX_BALANCE-n)return false;var p={id:id,amount:n,beforeWallet:beforeWallet,beforeEarned:beforeEarned,targetWallet:beforeWallet+n,targetEarned:beforeEarned+n,at:Date.now()};
      var committed=false;
      try{var raw=JSON.stringify(p);localStorage.setItem(AWARD_PENDING_KEY,raw);if(localStorage.getItem(AWARD_PENDING_KEY)!==raw)throw new Error('金币奖励准备失败');
        if(!setCoins(p.targetWallet)||!setEarned(p.targetEarned))throw new Error('金币奖励入账失败');
        ledger[id]={amount:n,at:p.at};if(!writeAwards(ledger))throw new Error('金币奖励账本写入失败');
        committed=true;try{localStorage.removeItem(AWARD_PENDING_KEY);}catch(_cleanup){}return true;
      }catch(e){
        if(committed)return true;
        var rolled=setCoins(beforeWallet)&&setEarned(beforeEarned);if(rolled)try{localStorage.removeItem(AWARD_PENDING_KEY);}catch(_e){}
        saveError('金币奖励未能安全入账，稍后重试不会重复发放',e);return false;
      }
    },
    hasAward:function(id){id=String(id||'');var o=readAwards();return !!(o&&Object.prototype.hasOwnProperty.call(o,id));},
    seedAwards:seedAwards,
    recoverAwards:recoverAward
  };
  recoverAward();

  // ---- 崩溃可恢复旧金币迁移 -------------------------------------------------
  // journal 是不可变的 prepared 现场，commit key 是唯一提交点。旧 v1 flag 只作兼容标记，
  // 不再参与是否执行的判断，因此旧版曾“失败也打 flag”不会掩盖尚未迁移的金币。
  function migrationPayload(j){return JSON.stringify([j.schema,j.createdAt,j.beforeWalletRaw,j.beforeEarnedRaw,j.beforeWallet,j.beforeEarned,j.amount,j.targetWallet,j.targetEarned,j.entries]);}
  function migrationChecksum(j){var s=migrationPayload(j),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ('00000000'+(h>>>0).toString(16)).slice(-8);}
  function canonicalBalanceRaw(raw){
    if(raw===null)return {ok:true,value:0};
    if(typeof raw!=='string'||!/^(?:0|[1-9][0-9]{0,12})$/.test(raw))return {ok:false};
    var n=Number(raw);return exactInt(n,0,MAX_BALANCE)&&String(n)===raw?{ok:true,value:n}:{ok:false};
  }
  function migrationSave(raw){
    if(typeof raw!=='string'||raw.length<2||raw.length>2097152)return null;
    try{var o=JSON.parse(raw);if(!o||typeof o!=='object'||Array.isArray(o)||!exactInt(o.coins,0,1000000000))return null;return o;}catch(e){return null;}
  }
  function migrationEntry(key,oldRaw,credit){
    if(oldRaw===null)return {key:key,oldRaw:null,newRaw:null,credit:0};
    var o=migrationSave(oldRaw);if(!o)return null;o.coins=0;
    return {key:key,oldRaw:oldRaw,newRaw:JSON.stringify(o),credit:credit};
  }
  function validateMigration(j){
    if(!j||typeof j!=='object'||Array.isArray(j))return false;
    var allowed={schema:1,createdAt:1,beforeWalletRaw:1,beforeEarnedRaw:1,beforeWallet:1,beforeEarned:1,amount:1,targetWallet:1,targetEarned:1,entries:1,checksum:1};
    var fields=Object.keys(j);for(var fi=0;fi<fields.length;fi++)if(!allowed[fields[fi]])return false;
    if(fields.length!==11||j.schema!==1||!exactInt(j.createdAt,1,Number.MAX_SAFE_INTEGER)||!Array.isArray(j.entries)||j.entries.length<2||j.entries.length>128)return false;
    var bw=canonicalBalanceRaw(j.beforeWalletRaw),be=canonicalBalanceRaw(j.beforeEarnedRaw);
    if(!bw.ok||!be.ok||j.beforeWallet!==bw.value||j.beforeEarned!==be.value||!exactInt(j.amount,1,MAX_BALANCE)||
       !exactInt(j.targetWallet,1,MAX_BALANCE)||!exactInt(j.targetEarned,1,MAX_BALANCE)||
       j.targetWallet!==j.beforeWallet+j.amount||j.targetEarned!==j.beforeEarned+j.amount)return false;
    var seen={},groups={},sum=0,last='';
    for(var i=0;i<j.entries.length;i++){
      var e=j.entries[i];if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).length!==4||
        !Object.prototype.hasOwnProperty.call(e,'key')||!Object.prototype.hasOwnProperty.call(e,'oldRaw')||!Object.prototype.hasOwnProperty.call(e,'newRaw')||!Object.prototype.hasOwnProperty.call(e,'credit'))return false;
      if(typeof e.key!=='string'||!/^wordIsland[A-Za-z0-9]{1,80}(?:_bak)?$/.test(e.key)||seen[e.key]||e.key<last||!exactInt(e.credit,0,1000000000))return false;
      seen[e.key]=1;last=e.key;var base=e.key.replace(/_bak$/,''),g=groups[base]||(groups[base]={main:null,bak:null});
      if(/_bak$/.test(e.key))g.bak=e;else g.main=e;
      if(e.oldRaw===null){if(e.newRaw!==null||e.credit!==0)return false;}
      else{
        var old=migrationSave(e.oldRaw),next=migrationSave(e.newRaw);if(!old||!next)return false;
        old.coins=0;if(JSON.stringify(old)!==e.newRaw||next.coins!==0)return false;
        if(e.credit!==0&&e.credit!==Number(JSON.parse(e.oldRaw).coins))return false;
      }
      sum+=e.credit;if(sum>MAX_BALANCE)return false;
    }
    var bases=Object.keys(groups);for(var bi=0;bi<bases.length;bi++){
      var pair=groups[bases[bi]];if(!pair.main||!pair.bak)return false;
      var authoritative=pair.main.oldRaw!==null?pair.main:pair.bak;
      if(authoritative.oldRaw===null||authoritative.credit!==Number(JSON.parse(authoritative.oldRaw).coins)||authoritative.credit<=0)return false;
      if((authoritative===pair.main?pair.bak:pair.main).credit!==0)return false;
    }
    return sum===j.amount&&typeof j.checksum==='string'&&j.checksum===migrationChecksum(j);
  }
  function readMigrationJournal(){
    try{var raw=localStorage.getItem(MIGRATE_JOURNAL_KEY);if(raw===null)return null;try{return JSON.parse(raw);}catch(e){return {__invalid:true};}}catch(e2){return {__invalid:true};}
  }
  function writeMigrationJournal(j){
    try{j.checksum=migrationChecksum(j);var raw=JSON.stringify(j);localStorage.setItem(MIGRATE_JOURNAL_KEY,raw);return localStorage.getItem(MIGRATE_JOURNAL_KEY)===raw;}catch(e){return false;}
  }
  function buildMigrationJournal(){
    var bases={},entries=[],amount=0;window.__hansenCoinMigrationPrepareFailed=false;
    try{
      /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk1=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk1.length;i++){var k=_lsk1[i];if(k&&/^wordIsland[A-Za-z0-9]{1,80}(?:_bak)?$/.test(k))bases[k.replace(/_bak$/,'')]=1;}
      Object.keys(bases).sort().forEach(function(base){
        var mainRaw=localStorage.getItem(base),bakRaw=localStorage.getItem(base+'_bak');
        var main=mainRaw===null?null:migrationSave(mainRaw),bak=bakRaw===null?null:migrationSave(bakRaw);
        // 损坏岛单独保留取证并跳过；健康岛仍可迁移，但绝不借另一副本猜这个岛的金额。
        if((mainRaw!==null&&!main)||(bakRaw!==null&&!bak)){saveError('旧金币存档结构异常，已跳过该岛且保留原始数据',new Error('invalid legacy coin save: '+base));return;}
        var source=mainRaw!==null?main:bak,credit=source?source.coins:0;if(!exactInt(credit,1,1000000000))return;
        var em=migrationEntry(base,mainRaw,mainRaw!==null?credit:0),eb=migrationEntry(base+'_bak',bakRaw,mainRaw===null?credit:0);
        if(!em||!eb)return;entries.push(em,eb);amount+=credit;
      });
      entries.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
      if(amount<=0)return null;
      var walletRaw=localStorage.getItem(COIN_WALLET_KEY),earnedRaw=localStorage.getItem(COIN_EARNED_KEY),bw=canonicalBalanceRaw(walletRaw),be=canonicalBalanceRaw(earnedRaw);
      if(!bw.ok||!be.ok||amount>MAX_BALANCE-bw.value||amount>MAX_BALANCE-be.value)throw new Error('全局金币余额不是可迁移的规范整数或已超上限');
      var j={schema:1,createdAt:Date.now(),beforeWalletRaw:walletRaw,beforeEarnedRaw:earnedRaw,beforeWallet:bw.value,beforeEarned:be.value,amount:amount,targetWallet:bw.value+amount,targetEarned:be.value+amount,entries:entries};
      j.checksum=migrationChecksum(j);return validateMigration(j)?j:null;
    }catch(e){window.__hansenCoinMigrationPrepareFailed=true;saveError('旧金币迁移准备失败，尚未改动任何余额',e);return null;}
  }
  function resumeMigration(){
    var j=readMigrationJournal();if(!j)return true;
    if(j.__invalid||!validateMigration(j)){window.__hansenCoinMigrationBlocked=true;saveError('旧金币迁移日志已损坏；已停止迁移并保留证据',new Error('invalid coin migration journal'));return false;}
    try{
      var committed=localStorage.getItem(MIGRATE_COMMIT_KEY)===j.checksum;
      if(committed){
        localStorage.setItem(MIGRATE_FLAG_KEY,'1');if(localStorage.getItem(MIGRATE_FLAG_KEY)!=='1')return false;
        localStorage.removeItem(MIGRATE_JOURNAL_KEY);return localStorage.getItem(MIGRATE_JOURNAL_KEY)===null;
      }
      var allNew=true,anyNew=false;
      for(var i=0;i<j.entries.length;i++){
        var e=j.entries[i],cur=localStorage.getItem(e.key),isOld=cur===e.oldRaw,isNew=cur===e.newRaw;
        if(!isOld&&!isNew)throw new Error('旧岛金币现场偏离 journal');allNew=allNew&&isNew;anyNew=anyNew||isNew;
      }
      var wallet=canonicalBalanceRaw(localStorage.getItem(COIN_WALLET_KEY)),earned=canonicalBalanceRaw(localStorage.getItem(COIN_EARNED_KEY));
      if(!wallet.ok||!earned.ok||(wallet.value!==j.beforeWallet&&wallet.value!==j.targetWallet)||(earned.value!==j.beforeEarned&&earned.value!==j.targetEarned))throw new Error('迁移钱包现场偏离 before/target');
      if((wallet.value===j.targetWallet&&!allNew)||(earned.value===j.targetEarned&&(wallet.value!==j.targetWallet||!allNew)))throw new Error('迁移阶段顺序无效');
      for(var wi=0;wi<j.entries.length;wi++){
        var w=j.entries[wi],now=localStorage.getItem(w.key);if(now===w.oldRaw){if(w.newRaw===null)localStorage.removeItem(w.key);else localStorage.setItem(w.key,w.newRaw);}
        if(localStorage.getItem(w.key)!==w.newRaw)throw new Error('旧岛金币清零回读失败');
      }
      if(wallet.value===j.beforeWallet&&!setCoins(j.targetWallet))throw new Error('全局金币迁移写入失败');
      if(earned.value===j.beforeEarned&&!setEarned(j.targetEarned))throw new Error('累计金币迁移写入失败');
      localStorage.setItem(MIGRATE_COMMIT_KEY,j.checksum);if(localStorage.getItem(MIGRATE_COMMIT_KEY)!==j.checksum)throw new Error('迁移提交点写入失败');
      localStorage.setItem(MIGRATE_FLAG_KEY,'1');if(localStorage.getItem(MIGRATE_FLAG_KEY)!=='1')throw new Error('旧迁移兼容标记写入失败');
      localStorage.removeItem(MIGRATE_JOURNAL_KEY);if(localStorage.getItem(MIGRATE_JOURNAL_KEY)!==null)throw new Error('迁移日志清理失败');
      window.__hansenCoinMigrationBlocked=false;return true;
    }catch(e){window.__hansenCoinMigrationBlocked=true;saveError('旧金币迁移尚未完成；下次启动将按安全日志继续',e);return false;}
  }
  function migrateOldCoinsOnce(){
    if(!resumeMigration())return false;
    var existing=readMigrationJournal();if(existing)return false;
    var j=buildMigrationJournal();
    if(!j){if(window.__hansenCoinMigrationPrepareFailed){window.__hansenCoinMigrationBlocked=true;return false;}try{localStorage.setItem(MIGRATE_FLAG_KEY,'1');}catch(e){}return true;}
    if(!writeMigrationJournal(j)){saveError('旧金币迁移安全日志无法建立，未改动旧岛或钱包',new Error('coin migration prepare failed'));return false;}
    return resumeMigration();
  }

  // 启动时执行迁移。未完成/损坏时冻结所有余额写操作，避免用户消费让 before/target
  // 现场漂移；下一次页面启动恢复成功后会自然加载未包装的正常 API。
  var migrationReady=migrateOldCoinsOnce();
  if(!migrationReady){
    window.__hansenCoinMigrationBlocked=true;
    var coinApi=window.HansenCoins;
    function migrationBlocked(){saveError('旧金币迁移尚未安全收口，金币写操作已临时冻结',new Error('coin migration blocked'));}
    coinApi.add=function(){migrationBlocked();return getCoins();};
    coinApi.spend=function(){migrationBlocked();return false;};
    coinApi.award=function(){migrationBlocked();return false;};
    coinApi.recoverAwards=function(){migrationBlocked();return false;};
  }
  // 新手奖励也走永久 sourceId。老版本 flag=1 先种账本，升级不补发；新用户失败可重试且不重复。
  try{
    if(localStorage.getItem('hansen_starter_coins_given')==='1')seedAwards(['starter:global']);
    else if(window.HansenCoins.award('starter:global',300)){localStorage.setItem('hansen_starter_coins_given','1');}
  }catch(e){}
})();
