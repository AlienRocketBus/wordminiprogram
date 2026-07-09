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
  function getGems(){
    try {
      var v = parseInt(localStorage.getItem(GEM_WALLET_KEY), 10);
      return (isFinite(v) && v >= 0) ? v : 0;
    } catch(e){ return 0; }
  }
  function setGems(n){
    try { localStorage.setItem(GEM_WALLET_KEY, String(Math.max(0, Math.floor(n)))); } catch(e){}
  }

  // 对外接口(供"重大成就发钻石"、"主题商店扣钻石"使用)
  window.HansenGems = {
    get: getGems,
    add: function(n){ n=Number(n); if(!isFinite(n)||n<=0) return getGems(); var w=getGems()+Math.floor(n); setGems(w); return w; },
    spend: function(n){ n=Number(n); if(!isFinite(n)||n<0) return false; var w=getGems(); if(w<n) return false; setGems(w-n); return true; }
  };

  // ---- 一次性清零所有旧钻石余额 ----
  // 遍历18个岛存档, 把每个存档里的 gems 字段清成 0。只执行一次(用标记)。
  function clearOldGemsOnce(){
    try {
      if(localStorage.getItem(CLEAR_FLAG_KEY) === '1') return;  // 已清过, 不再动
    } catch(e){ return; }

    // 遍历所有 localStorage 的 key, 找形如 wordIsland* 的存档, 清其 gems
    var clearedCount = 0;
    try {
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
              localStorage.setItem(key, JSON.stringify(obj));
              clearedCount++;
            }
          } catch(e){ /* 单个存档坏了跳过, 不影响其他 */ }
        }
      }
    } catch(e){}

    // 新全局钻石钱包也确保从 0 开始
    setGems(0);

    // 打上"已清零"标记, 保证只清这一次
    try { localStorage.setItem(CLEAR_FLAG_KEY, '1'); } catch(e){}

    // (静默执行, 不打扰玩家。若需提示可在此 toast)
  }

  // ---- 启动: 立即执行一次性清零 ----
  // 不依赖任何 DOM, 越早执行越好, 直接跑。
  clearOldGemsOnce();

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
