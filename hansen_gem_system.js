// hansen_gem_system.js v1 — 钻石高级货币系统 (零侵入)
// ============================================================================
// 【这是什么】
//   把钻石重新定义为"高级货币": 极难获得, 只买顶级稀有品(稀有宠物/称号/头像框)。
//   和金币(软货币:天天赚随便花)泾渭分明。
//
// 【本文件第1步做什么】(钻石货币地基)
//   1) 一次性清零所有玩家手里的【旧钻石余额】(18个岛各自存档里的 S.gems → 0)。
//      —— 配合"从零开始"的新体系。每个玩家只清一次(用迁移标记), 之后不再动。
//   2) 建立全新的【全局钻石钱包】 hansen_wallet_gems (18个岛共享一个钻石数)。
//      —— 旧的 S.gems 是每岛独立、且产出随意, 不符合高级货币定位, 故弃用, 改用全局钱包。
//   3) 旧的"成就给钻石"产出: 上一版已把 addGem 并入金币, 所以旧钻石产出【已经断了】,
//      本文件不需要再处理。新体系里钻石只从"重大成就"经由全局钱包发放(后续步骤接入)。
//
// 【为什么全局】
//   钻石是高级货币, 必须是一个总账(不能每岛各算)。所以用全局 key, 和金币钱包同思路。
//
// 【设计原则】不改原游戏代码; 独立文件; 幂等; 清零只做一次。
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenGemSystemLoaded) return; window.__hansenGemSystemLoaded = true;

  var GEM_WALLET_KEY = 'hansen_wallet_gems';        // 全新全局钻石钱包
  var CLEAR_FLAG_KEY = 'hansen_gems_cleared_v1';    // 一次性清零标记
  var AWARD_KEY='hansen_gem_awards_v942',AWARD_PENDING_KEY='hansen_gem_award_pending_v942';
  var MAX_BALANCE=1000000000,MAX_AWARD=100000;

  function saveError(msg,e){try{if(typeof window.__hsnSaveNotice==='function')window.__hsnSaveNotice(msg,e);else window.dispatchEvent(new CustomEvent('hansen-save-error',{detail:{message:msg,error:String(e&&e.message||e||msg)}}));}catch(_e){}}
  function rawRestore(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);return localStorage.getItem(k)===(v===null?null:String(v));}catch(e){return false;}}
  function walletReady(){try{return localStorage.getItem(CLEAR_FLAG_KEY)==='1';}catch(e){return false;}}

  // 18个岛的存档 key (S.gems 就存在这些里面)
  var ISLAND_SAVE_KEYS = [
    'wordIslandAnimal','wordIslandFood','wordIslandColorNum','wordIslandSchool',
    'wordIslandSports','wordIslandBody','wordIslandClothes','wordIslandHouse',
    'wordIslandCity','wordIslandFamily','wordIslandNature','wordIslandPeople',
    'wordIslandPronouns','wordIslandMisc','wordIslandAdj','wordIslandVerbs',
    'wordIslandTime','wordIslandTransport'
    // 注: 岛 key 以实际为准; 多写或少写不会报错(下面用 try 容错)
  ];

  // ---- 全局钻石钱包 ----
  function readGems(){try{var raw=localStorage.getItem(GEM_WALLET_KEY);if(raw===null)return 0;var v=Number(raw);return isFinite(v)&&Math.floor(v)===v&&v>=0&&v<=MAX_BALANCE?v:null;}catch(e){return null;}}
  function getGems(){var n=readGems();return n===null?0:n;}
  function setGems(n){
    try {var v=String(Math.max(0,Math.floor(n)));localStorage.setItem(GEM_WALLET_KEY,v);return localStorage.getItem(GEM_WALLET_KEY)===v;} catch(e){return false;}
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
  function writeAwards(o){try{var raw=JSON.stringify(o);localStorage.setItem(AWARD_KEY,raw);return localStorage.getItem(AWARD_KEY)===raw;}catch(e){return false;}}
  function readPending(){try{var raw=localStorage.getItem(AWARD_PENDING_KEY);if(raw===null)return null;var p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:{__invalid:true};}catch(e){return {__invalid:true};}}
  function validId(id){return typeof id==='string'&&id.length>0&&id.length<=160&&!/[\u0000-\u001f\u007f]/.test(id)&&id!=='__proto__'&&id!=='prototype'&&id!=='constructor';}
  function exactInt(v,min,max){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>=min&&v<=max;}
  function validPending(p){return !!(p&&!p.__invalid&&validId(p.id)&&exactInt(p.amount,1,MAX_AWARD)&&exactInt(p.before,0,MAX_BALANCE)&&exactInt(p.target,0,MAX_BALANCE)&&p.target===p.before+p.amount&&exactInt(p.at,1,Number.MAX_SAFE_INTEGER));}
  function rejectPending(){try{localStorage.removeItem(AWARD_PENDING_KEY);return localStorage.getItem(AWARD_PENDING_KEY)===null;}catch(e){return false;}}
  function recoverAward(){
    var p=readPending();if(!p)return true;if(!validPending(p)){rejectPending();saveError('检测到损坏的钻石奖励事务，已拒绝恢复且未改动余额',new Error('invalid gem pending'));return false;}var ledger=readAwards();
    var current=readGems();if(!ledger||current===null)return false;
    if(Object.prototype.hasOwnProperty.call(ledger,p.id)){
      if(Number(ledger[p.id].amount)!==Number(p.amount))return false;
      try{localStorage.removeItem(AWARD_PENDING_KEY);return localStorage.getItem(AWARD_PENDING_KEY)===null;}catch(e){return false;}
    }
    var old=null;try{old=localStorage.getItem(GEM_WALLET_KEY);}catch(e){}
    try{
      if(current!==Number(p.before)&&current!==Number(p.target))throw new Error('钻石奖励现场与 before/target 均不一致');
      if(current===Number(p.before)&&!setGems(p.target))throw new Error('钻石奖励恢复失败');
      ledger[p.id]={amount:p.amount,at:p.at};if(!writeAwards(ledger))throw new Error('钻石奖励账本恢复失败');
      localStorage.removeItem(AWARD_PENDING_KEY);return localStorage.getItem(AWARD_PENDING_KEY)===null;
    }catch(e){rawRestore(GEM_WALLET_KEY,old);saveError('钻石奖励事务未完成，稍后会自动重试',e);return false;}
  }
  function award(id,n){
    id=String(id||'');n=Number(n);if(!walletReady()||!validId(id)||!isFinite(n)||(n=Math.floor(n))<=0||n>MAX_AWARD||!recoverAward())return false;
    var ledger=readAwards();if(!ledger)return false;if(Object.prototype.hasOwnProperty.call(ledger,id))return true;
    var before=readGems();if(before===null||before>MAX_BALANCE-n)return false;var p={id:id,amount:n,before:before,target:before+n,at:Date.now()};
    var committed=false;
    try{var raw=JSON.stringify(p);localStorage.setItem(AWARD_PENDING_KEY,raw);if(localStorage.getItem(AWARD_PENDING_KEY)!==raw)throw new Error('钻石奖励准备失败');
      if(!setGems(p.target))throw new Error('钻石奖励入账失败');
      ledger[id]={amount:n,at:p.at};if(!writeAwards(ledger))throw new Error('钻石奖励账本写入失败');
      committed=true;try{localStorage.removeItem(AWARD_PENDING_KEY);}catch(_cleanup){}reconcileGemAchievement();return true;
    }catch(e){
      if(committed)return true;
      var rolled=setGems(before);if(rolled)try{localStorage.removeItem(AWARD_PENDING_KEY);}catch(_e){}
      saveError('钻石奖励未能安全入账，稍后重试不会重复发放',e);return false;
    }
  }
  function seedAwards(ids){
    if(!recoverAward())return false;var ledger=readAwards(),changed=false;
    if(!ledger)return false;
    (ids||[]).forEach(function(id){id=String(id||'');if(validId(id)&&!Object.prototype.hasOwnProperty.call(ledger,id)){ledger[id]={amount:0,at:Date.now(),migrated:true};changed=true;}});
    return !changed||writeAwards(ledger);
  }
  // v945 探索页只读查询：以严格奖励账本证明某一知识结晶奖励是否真正到账。
  // 不用当前余额作证（钻石可能已经消费），也不把 done=1 冒充已发奖。
  // 批量接口只解析一次 ledger/pending，避免 240 张单词卡重复 JSON.parse。
  function awardStates(requests){
    var out=Object.create(null),ledger=readAwards(),pending=readPending();
    var pendingValid=!!(pending&&validPending(pending));
    var pendingBroken=!!(pending&&!pendingValid);
    (Array.isArray(requests)?requests:[]).forEach(function(req){
      var id='',expected=null;
      if(typeof req==='string')id=req;
      else if(req&&typeof req==='object'&&!Array.isArray(req)){
        id=String(req.id||'');
        if(Object.prototype.hasOwnProperty.call(req,'amount'))expected=Number(req.amount);
      }
      if(!validId(id)){out[id]={state:'invalid',amount:null,at:null};return;}
      if(!ledger){out[id]={state:'blocked',amount:null,at:null};return;}
      var rec=Object.prototype.hasOwnProperty.call(ledger,id)?ledger[id]:null;
      if(rec){
        if(rec.migrated===true&&Number(rec.amount)===0){
          out[id]={state:'legacy',amount:0,at:Number(rec.at)||null};
        }else if(expected!==null&&(!isFinite(expected)||Math.floor(expected)!==expected||Number(rec.amount)!==expected)){
          out[id]={state:'mismatch',amount:Number(rec.amount),at:Number(rec.at)||null};
        }else{
          out[id]={state:'paid',amount:Number(rec.amount),at:Number(rec.at)||null};
        }
        return;
      }
      if(pendingValid&&pending.id===id){
        out[id]={state:(expected!==null&&Number(pending.amount)!==expected)?'mismatch':'pending',amount:Number(pending.amount),at:Number(pending.at)||null};
      }else if(pendingBroken){
        out[id]={state:'blocked',amount:null,at:null};
      }else{
        out[id]={state:'unpaid',amount:null,at:null};
      }
    });
    return out;
  }
  function awardState(id,amount){
    var key=String(id||''),map=awardStates([{id:key,amount:amount}]);
    return map[key]||{state:'invalid',amount:null,at:null};
  }
  // v941: gem1 必须按真实钱包即时对账。旧逻辑只在以后再次触发 checkAch 时检查，
  // 导致迁移/结晶已经有钻石的玩家仍看不到“钻石新贵”。
  function reconcileGemAchievement(){
    if(!walletReady()||getGems()<1)return false;
    try{ if(typeof window.checkAch==='function'){window.checkAch();return true;} }catch(e){}
    try{ if(window.HansenAch&&HansenAch.unlock){HansenAch.unlock('gem1');return true;} }catch(e){}
    return false;
  }

  // 对外接口(供"重大成就发钻石"、"主题商店扣钻石"使用)
  window.HansenGems = {
    get: getGems,
    add: function(n){n=Number(n);if(!walletReady()||!isFinite(n)||n<=0)return getGems();if(!recoverAward())return getGems();var before=readGems();if(before===null)return getGems();var w=before+Math.floor(n);if(w>MAX_BALANCE||!setGems(w)){saveError('钻石未能保存，本次奖励未入账',new Error('gem wallet write failed'));return before;}reconcileGemAchievement();return w;},
    spend: function(n){n=Number(n);if(!walletReady()||!isFinite(n)||n<0||!recoverAward())return false;var w=readGems();if(w===null||w<n)return false;var old=null;try{old=localStorage.getItem(GEM_WALLET_KEY);}catch(e){return false;}var ok=setGems(w-n);if(!ok){rawRestore(GEM_WALLET_KEY,old);saveError('钻石扣款未保存，交易已取消',new Error('gem spend write failed'));}return ok;},
    award:award,
    seedAwards:seedAwards,
    awardState:awardState,
    awardStates:awardStates,
    recoverAwards:recoverAward,
    isReady:walletReady,
    reconcileAchievement: reconcileGemAchievement
  };
  recoverAward();

  // ---- 一次性清零所有旧钻石余额 ----
  // 遍历18个岛存档, 把每个存档里的 gems 字段清成 0。只执行一次(用标记)。
  function clearOldGemsOnce(){
    try {
      if(localStorage.getItem(CLEAR_FLAG_KEY) === '1') return;  // 已清过, 不再动
    } catch(e){ return; }

    // 遍历所有 localStorage 的 key, 找形如 wordIsland* 的存档, 清其 gems。
    // 主/备份、全局钱包和 flag 按事务处理；任一步失败全部回滚且绝不打标。
    var clearedCount = 0,writes=[],oldWallet=null,oldFlag=null;
    try {
      oldWallet=localStorage.getItem(GEM_WALLET_KEY);oldFlag=localStorage.getItem(CLEAR_FLAG_KEY);
      for(var i = 0; i < localStorage.length; i++){
        var key = localStorage.key(i);
        if(!key) continue;
        // 匹配岛存档(wordIsland 开头), 含主存档和 _bak 备份
        if(/^wordIsland/.test(key)){
          try {
            var raw = localStorage.getItem(key);
            if(!raw) continue;
            var obj = JSON.parse(raw);
            if(obj && typeof obj === 'object' && typeof obj.gems !== 'undefined'){
              obj.gems = 0;                       // 旧钻石余额清零
              writes.push([key,raw,JSON.stringify(obj)]);
              clearedCount++;
            }
          } catch(e){ /* 单个存档坏了跳过, 不影响其他 */ }
        }
      }
      writes.forEach(function(x){localStorage.setItem(x[0],x[2]);if(localStorage.getItem(x[0])!==x[2])throw new Error('旧钻石清零校验失败');});
      if(!setGems(0))throw new Error('全局钻石钱包初始化失败');
      localStorage.setItem(CLEAR_FLAG_KEY,'1');if(localStorage.getItem(CLEAR_FLAG_KEY)!=='1')throw new Error('钻石迁移标记写入失败');
    } catch(e){
      writes.forEach(function(x){try{localStorage.setItem(x[0],x[1]);}catch(_e){}});rawRestore(GEM_WALLET_KEY,oldWallet);rawRestore(CLEAR_FLAG_KEY,oldFlag);
      saveError('旧钻石迁移未完成，已保留原数据并将在下次重试',e);
    }

    // (静默执行, 不打扰玩家。若需提示可在此 toast)
  }

  // ---- 启动: 立即执行一次性清零 ----
  // 不依赖任何 DOM, 越早执行越好, 直接跑。
  clearOldGemsOnce();
  reconcileGemAchievement();

  // ==========================================================================
  // 【顶栏钻石显示】动态注入一个钻石 badge 到顶栏, 读"新全局钻石钱包"。
  // 不改18个岛的 HTML 结构(零侵入), 像赛季按钮那样用 JS 注入。
  // ==========================================================================
  function injectGemBadge(){
    try {
      // 🔴 v573: 🔥徽章已撤到名字行, 锚点改挂金币徽章, 插在它前面 → 💎上 🪙下
      var coinBadge = document.querySelector('.top-bar .stat-badge.coin');
      if(!coinBadge || !coinBadge.parentElement) return false;
      if(document.getElementById('__hs_gem_badge')) return true;  // 已注入, 幂等

      var gemBadge = document.createElement('div');
      gemBadge.className = 'stat-badge gem';
      gemBadge.id = '__hs_gem_badge';
      gemBadge.style.cssText = 'color:#22d3ee;border:1px solid rgba(34,211,238,.4);display:flex;align-items:center;gap:3px';
      gemBadge.innerHTML = '💎<span id="__hs_gem_count">' + getGems() + '</span>';
      // 🔴 v573: 插在金币徽章前面
      coinBadge.parentElement.insertBefore(gemBadge, coinBadge);
      return true;
    } catch(e){ return false; }
  }

  // 刷新顶栏钻石数字 (供加/扣钻石后调用)
  function refreshGemBadge(){
    try {
      var el = document.getElementById('__hs_gem_count');
      if(el) el.textContent = getGems();
    } catch(e){}
  }
  // 把刷新挂到钻石钱包操作上 (加/扣钻石后自动更新顶栏)
  var _origAdd = window.HansenGems.add;
  window.HansenGems.add = function(n){ var r = _origAdd(n); refreshGemBadge(); return r; };
  var _origSpend = window.HansenGems.spend;
  window.HansenGems.spend = function(n){ var r = _origSpend(n); refreshGemBadge(); return r; };
  var _origAward=window.HansenGems.award;
  window.HansenGems.award=function(id,n){var r=_origAward(id,n);refreshGemBadge();return r;};

  // 轮询注入顶栏钻石 badge (顶栏DOM加载后)
  var gemTries = 0;
  var gemTimer = setInterval(function(){
    gemTries++;
    var ok = injectGemBadge();
    if(ok){ /* 🔴v749(Hansen): 顶栏图标"点击弹说明"已彻底删除·点钻石/金币等不显示任何东西·无任何动静 */ }
    if(ok || gemTries >= 100){ clearInterval(gemTimer); }
  }, 100);

  /* 🔴v749(Hansen·"点钻石和金币这个图标不会显示任何东西·不会再显示一堆文字说明·把那堆文字说明彻底删掉·所有冗余全删干净·点这个地方不会有任何动静"): 已删除 attachIconHelp()(原给顶栏 .top-bar .stat-badge 绑 click) + showIconHelp()(原 📖顶部图标说明 弹窗·解释🔥连续签到/💎钻石/⭐星星/🪙金币)。顶栏图标(钻石/金币等)不再绑任何点击·点了毫无动静·零弹窗·零文字说明。 */
})();
