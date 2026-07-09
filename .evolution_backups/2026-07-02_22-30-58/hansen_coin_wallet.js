// hansen_coin_wallet.js — 全局金币钱包
// ============================================================
// 背景: 金币原本各岛独立(存各岛存档的 S.coins)。为了让抽卡/卡册做成"全局一套"
//   (金币汇总才抽得起、卡片就20个boss一套即可、不肝不重复), 把金币改成全局统一。
//   做法仿照已有的全局钻石钱包 HansenGems(hansen_gem_system.js)。
//
// 设计要点:
//   1) 全局金币钱包 key = 'hansen_wallet_coins'(18个岛共享一个金币数)。
//   2) 对外提供 window.HansenCoins.{get,add,spend}, 所有岛的金币赚/花都走它。
//   3) 首次启用时, 把各岛旧的 S.coins 余额【合并迁移】到全局钱包(不丢钱), 只迁移一次(用标记)。
//      —— 与钻石不同: 钻石当时是"清零重来", 金币这里是"合并保留"(玩家辛苦赚的金币不该没收)。
//   4) 零侵入独立文件。岛页里 addCoin/earnCoinOnCorrect 等改成调用 HansenCoins(后续接入)。
// ============================================================
(function(){
  if(window.__hansenCoinWalletLoaded){ return; } window.__hansenCoinWalletLoaded = true;

  var COIN_WALLET_KEY  = 'hansen_wallet_coins';        // 全局金币钱包
  var MIGRATE_FLAG_KEY = 'hansen_coins_migrated_v1';   // 一次性迁移标记

  // ---- 全局金币钱包读写 ----
  function getCoins(){
    try {
      var v = parseInt(localStorage.getItem(COIN_WALLET_KEY), 10);
      return (isFinite(v) && v >= 0) ? v : 0;
    } catch(e){ return 0; }
  }
  function setCoins(n){
    try { localStorage.setItem(COIN_WALLET_KEY, String(Math.max(0, Math.floor(n)))); } catch(e){}
  }

  // 对外接口(供 答题/打boss/签到/任务成就 发金币, 商店/抽卡 扣金币 使用)
  window.HansenCoins = {
    get: getCoins,
    add: function(n){ n = Number(n); if(!isFinite(n) || n <= 0) return getCoins(); var w = getCoins() + Math.floor(n); setCoins(w); return w; },
    spend: function(n){ n = Number(n); if(!isFinite(n) || n < 0) return false; var w = getCoins(); if(w < n) return false; setCoins(w - n); return true; }
  };

  // ---- 一次性迁移: 把各岛旧 S.coins 合并进全局钱包(只做一次, 不丢钱) ----
  function migrateOldCoinsOnce(){
    try {
      if(localStorage.getItem(MIGRATE_FLAG_KEY) === '1') return;  // 已迁移, 不再动
    } catch(e){ return; }

    var merged = 0;
    try {
      for(var i = 0; i < localStorage.length; i++){
        var key = localStorage.key(i);
        if(!key) continue;
        // 只看岛主存档(wordIsland 开头), 跳过 _bak 备份避免重复计数
        if(/^wordIsland/.test(key) && !/_bak$/.test(key)){
          try {
            var raw = localStorage.getItem(key);
            if(!raw) continue;
            var obj = JSON.parse(raw);
            if(obj && typeof obj === 'object' && typeof obj.coins === 'number' && isFinite(obj.coins) && obj.coins > 0){
              merged += Math.floor(obj.coins);
              // 旧存档里的金币清零(避免以后又被算一遍); 全局钱包成为唯一真相
              obj.coins = 0;
              localStorage.setItem(key, JSON.stringify(obj));
            }
          } catch(e){ /* 单个存档坏了跳过 */ }
        }
      }
    } catch(e){}

    // 合并进全局钱包(加到已有全局余额上, 稳妥)
    if(merged > 0){
      setCoins(getCoins() + merged);
    }

    // 打标记, 保证只迁移这一次
    try { localStorage.setItem(MIGRATE_FLAG_KEY, '1'); } catch(e){}
  }

  // 启动时执行迁移
  migrateOldCoinsOnce();
})();
