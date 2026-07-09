// hansen_ach_wallet.js — 全局成就钱包
// ============================================================
// 背景: 成就原本各岛独立(存各岛存档 S.achievements)。Hansen 要求成就全局统一——
//   所有岛共享同一套成就(在任何岛达成/领取, 所有岛都认), 累计型成就跨岛汇总。
//   做法仿照全局金币钱包 HansenCoins。
//
// 这个钱包存三样(全局共享, 所有岛读写同一份):
//   - claimed : 已领取奖励的成就id数组
//   - pending : 已达成但待领取的成就id数组
//   - newones : 新达成待查看(NEW标记)的成就id数组
//
// 首次启用自动迁移: 把各岛旧的 S.achievements / S.achPending / S.achNew 【合并】进全局(去重)。
// 零侵入独立文件。岛页里 unlockAch/claimAch 改成读写 HansenAch(后续接入)。
// ============================================================
(function(){
  if(window.__hansenAchWalletLoaded){ return; } window.__hansenAchWalletLoaded = true;

  var ACH_KEY        = 'hansen_wallet_ach';          // 全局成就钱包(JSON: {claimed,pending,newones})
  var MIGRATE_FLAG   = 'hansen_ach_migrated_v1';     // 一次性迁移标记

  function _read(){
    try{
      var raw = localStorage.getItem(ACH_KEY);
      if(!raw) return {claimed:[],pending:[],newones:[]};
      var o = JSON.parse(raw);
      return {
        claimed: Array.isArray(o.claimed)?o.claimed:[],
        pending: Array.isArray(o.pending)?o.pending:[],
        newones: Array.isArray(o.newones)?o.newones:[]
      };
    }catch(e){ return {claimed:[],pending:[],newones:[]}; }
  }
  function _write(o){
    try{ localStorage.setItem(ACH_KEY, JSON.stringify({
      claimed: o.claimed||[], pending: o.pending||[], newones: o.newones||[]
    })); }catch(e){}
  }
  function _uniqPush(arr, id){ if(arr.indexOf(id)<0) arr.push(id); }
  function _remove(arr, id){ var i=arr.indexOf(id); if(i>=0) arr.splice(i,1); }

  window.HansenAch = {
    // 查询
    isClaimed: function(id){ return _read().claimed.indexOf(id)>=0; },
    isPending: function(id){ return _read().pending.indexOf(id)>=0; },
    isNew:     function(id){ return _read().newones.indexOf(id)>=0; },
    getClaimed:function(){ return _read().claimed; },
    getPending:function(){ return _read().pending; },
    getNew:    function(){ return _read().newones; },
    claimedCount: function(){ return _read().claimed.length; },
    pendingCount: function(){ return _read().pending.length; },

    // 达成一个成就 → 进 pending + newones(若尚未领取/未在pending)。返回true表示这次是新达成。
    unlock: function(id){
      var o=_read();
      if(o.claimed.indexOf(id)>=0) return false;   // 已领取
      if(o.pending.indexOf(id)>=0) return false;   // 已在待领取
      _uniqPush(o.pending, id);
      _uniqPush(o.newones, id);
      _write(o);
      return true;
    },
    // 领取一个成就 → 从pending移除, 进claimed, 清newones。返回true表示成功领取(可发金币)。
    claim: function(id){
      var o=_read();
      if(o.pending.indexOf(id)<0) return false;    // 不在待领取
      _remove(o.pending, id);
      _uniqPush(o.claimed, id);
      _remove(o.newones, id);
      _write(o);
      return true;
    },
    // 清除某个NEW标记(看过了)
    seen: function(id){ var o=_read(); _remove(o.newones, id); _write(o); }
  };

  // ---- 一次性迁移: 把各岛旧成就合并进全局(去重), 只做一次 ----
  function migrateOnce(){
    try{ if(localStorage.getItem(MIGRATE_FLAG)==='1') return; }catch(e){ return; }
    var o=_read();
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i);
        if(!key) continue;
        if(/^wordIsland/.test(key) && !/_bak$/.test(key)){
          try{
            var s=JSON.parse(localStorage.getItem(key));
            if(s && typeof s==='object'){
              if(Array.isArray(s.achievements)) s.achievements.forEach(function(id){ _uniqPush(o.claimed, id); });
              if(Array.isArray(s.achPending)) s.achPending.forEach(function(id){ if(o.claimed.indexOf(id)<0) _uniqPush(o.pending, id); });
              if(Array.isArray(s.achNew)) s.achNew.forEach(function(id){ if(o.claimed.indexOf(id)<0) _uniqPush(o.newones, id); });
            }
          }catch(e){}
        }
      }
    }catch(e){}
    _write(o);
    try{ localStorage.setItem(MIGRATE_FLAG,'1'); }catch(e){}
  }
  migrateOnce();
})();
