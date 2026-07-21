// hansen_ach_wallet.js v942 — 全局成就钱包
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
  var RESET_AT_KEY   = 'hansen_ach_reset_at_v942';

  function _read(){
    try{
      var raw = localStorage.getItem(ACH_KEY);
      window.__hansenAchReadFailed=false;
      if(!raw) return {claimed:[],pending:[],newones:[]};
      var o = JSON.parse(raw);
      var out={
        claimed: Array.isArray(o.claimed)?o.claimed:[],
        pending: Array.isArray(o.pending)?o.pending:[],
        newones: Array.isArray(o.newones)?o.newones:[]
      };
      out.claimed=out.claimed.filter(function(x,i,a){return typeof x==='string'&&a.indexOf(x)===i;});
      out.pending=out.pending.filter(function(x,i,a){return typeof x==='string'&&out.claimed.indexOf(x)<0&&a.indexOf(x)===i;});
      out.newones=out.newones.filter(function(x,i,a){return typeof x==='string'&&out.claimed.indexOf(x)<0&&out.pending.indexOf(x)>=0&&a.indexOf(x)===i;});
      return out;
    }catch(e){window.__hansenAchReadFailed=true;return null;}
  }
  function _write(o){
    if(!o||window.__hansenAchReadFailed)return false;
    try{var raw=JSON.stringify({claimed:o.claimed||[],pending:o.pending||[],newones:o.newones||[]});localStorage.setItem(ACH_KEY,raw);return localStorage.getItem(ACH_KEY)===raw;}catch(e){return false;}
  }
  function _uniqPush(arr, id){ if(arr.indexOf(id)<0) arr.push(id); }
  function _remove(arr, id){ var i=arr.indexOf(id); if(i>=0) arr.splice(i,1); }

  window.HansenAch = {
    // 查询
    isClaimed: function(id){var o=_read();return !!(o&&o.claimed.indexOf(id)>=0);},
    isPending: function(id){var o=_read();return !!(o&&o.pending.indexOf(id)>=0);},
    isNew:     function(id){var o=_read();return !!(o&&o.newones.indexOf(id)>=0);},
    getClaimed:function(){var o=_read();return o?o.claimed:[];},
    getPending:function(){var o=_read();return o?o.pending:[];},
    getNew:    function(){var o=_read();return o?o.newones:[];},
    claimedCount: function(){var o=_read();return o?o.claimed.length:0;},
    pendingCount: function(){var o=_read();return o?o.pending.length:0;},

    // 达成一个成就 → 进 pending + newones(若尚未领取/未在pending)。返回true表示这次是新达成。
    unlock: function(id){
      var o=_read();
      if(!o)return false;
      if(o.claimed.indexOf(id)>=0) return false;   // 已领取
      if(o.pending.indexOf(id)>=0) return false;   // 已在待领取
      _uniqPush(o.pending, id);
      _uniqPush(o.newones, id);
      return _write(o);
    },
    // 领取一个成就 → 从pending移除, 进claimed, 清newones。返回true表示成功领取(可发金币)。
    claim: function(id){
      var o=_read();
      if(!o)return false;
      if(o.pending.indexOf(id)<0) return false;    // 不在待领取
      _remove(o.pending, id);
      _uniqPush(o.claimed, id);
      _remove(o.newones, id);
      return _write(o);
    },
    // 清除某个NEW标记(看过了)
    seen: function(id){var o=_read();if(!o)return false;_remove(o.newones,id);return _write(o);},
    // 设置页“清成就”：清权威钱包，同时清所有岛主/备份里的旧数组，奖励不回收。
    reset: function(){
      var ts=Date.now(),entries=[],oldWallet=null,oldReset=null;
      try{
        oldWallet=localStorage.getItem(ACH_KEY);oldReset=localStorage.getItem(RESET_AT_KEY);
        var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^wordIsland/.test(k)&&!/_tmp$/i.test(k))keys.push(k);}
        keys.forEach(function(k){
          try{var s=JSON.parse(localStorage.getItem(k)||'null');if(!s||typeof s!=='object')return;
            s.achievements=[];s.achPending=[];s.achNew=[];s.lastSaveTime=Math.max(Number(s.lastSaveTime)||0,ts);
            entries.push([k,localStorage.getItem(k),JSON.stringify(s)]);
          }catch(e){}
        });
        if(!_write({claimed:[],pending:[],newones:[]}))throw new Error('全局成就钱包写入失败');
        localStorage.setItem(RESET_AT_KEY,String(ts));if(localStorage.getItem(RESET_AT_KEY)!==String(ts))throw new Error('成就清除水位写入失败');
        entries.forEach(function(x){localStorage.setItem(x[0],x[2]);if(localStorage.getItem(x[0])!==x[2])throw new Error('岛屿成就清理写入失败');});
        return true;
      }catch(e){
        entries.forEach(function(x){try{localStorage.setItem(x[0],x[1]);}catch(_e){}});
        try{if(oldWallet===null)localStorage.removeItem(ACH_KEY);else localStorage.setItem(ACH_KEY,oldWallet);}catch(_e){}
        try{if(oldReset===null)localStorage.removeItem(RESET_AT_KEY);else localStorage.setItem(RESET_AT_KEY,oldReset);}catch(_e){}
        return false;
      }
    }
  };

  // ---- 可重入迁移：后来恢复的旧备份也能补进权威钱包 ----
  function migrateOnce(){
    var o=_read();
    if(!o)return false;
    var resetAt=0;try{resetAt=Math.max(0,Number(localStorage.getItem(RESET_AT_KEY))||0);}catch(e){}
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i);
        if(!key) continue;
        if(/^wordIsland/.test(key) && !/_tmp$|_backup$/i.test(key)){
          try{
            var s=JSON.parse(localStorage.getItem(key));
            if(s && typeof s==='object'){
              if(resetAt&&(Number(s.lastSaveTime)||0)<=resetAt)continue;
              if(Array.isArray(s.achievements)) s.achievements.forEach(function(id){ _uniqPush(o.claimed, id); });
              if(Array.isArray(s.achPending)) s.achPending.forEach(function(id){ if(o.claimed.indexOf(id)<0) _uniqPush(o.pending, id); });
              if(Array.isArray(s.achNew)) s.achNew.forEach(function(id){ if(o.claimed.indexOf(id)<0) _uniqPush(o.newones, id); });
            }
          }catch(e){}
        }
      }
    }catch(e){}
    if(_write(o)){try{ localStorage.setItem(MIGRATE_FLAG,'1'); }catch(e){}}
  }
  migrateOnce();
})();
