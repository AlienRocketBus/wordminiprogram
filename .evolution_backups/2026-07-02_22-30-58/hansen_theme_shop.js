// hansen_theme_shop.js v1 — 主题商店 (零侵入, 金币经济第一个出口)
// ============================================================================
// 作用:
//   把 6 个主题分成"免费"和"付费":
//     免费(开局就能用): 星空夜 cosmos 🌌  +  樱花粉 pink 🌸
//     付费(用金币买):   海洋蓝 ocean 300(试水) | 森林绿 forest 1000 | 彩虹云朵 rainbow 2000 | 桃子糖果 peach 3000
//   玩家点锁住的主题 → 弹"花 XXX 金币解锁?" → 金币够则扣币解锁(永久), 不够提示还差多少。
//   已解锁的主题记在 localStorage.hansen_unlocked_themes, 永久保留。
//
//   同时: 把界面上的"钻石💎"隐藏(顶栏/设置页), 让玩家只感知"金币"一种货币。
//   (注: 只隐藏不删底层 gems 代码 → 零风险; 钻石底层代码留待整个经济系统稳定后再清理。)
//
// 接入原理:
//   主题切换走全局函数 pickTheme(key)。本脚本包裹它: 点主题时先查是否解锁,
//   锁住的弹购买框、不放行切换; 已解锁的正常切换。不改任何原代码。
//
// 金币读写:
//   金币存在每个岛存档的 S.coins 里 (key: wordIsland<岛>)。但首页(index.html)没有 S 对象,
//   首页的金币需要从各岛存档里读"全局可用金币"。
//   ⚠️ 关键设计决策: 金币是【全局共享】还是【每岛独立】?
//   —— 经济系统必须【全局共享】(钱包是一个), 否则"在A岛赚的钱B岛不能花"会非常反直觉。
//   所以本脚本维护一个独立的【全局金币钱包】: localStorage.hansen_wallet_coins。
//   第1步先把这个钱包建起来, 主题购买从这个钱包扣。
//   (各岛 S.coins 的"赚币"如何汇入全局钱包, 在第3步'打卡赚币'里统一接通; 第1步先让钱包能用、能花。)
//
// 设计原则: 不改原游戏代码; 独立文件; 幂等; 各页面通用。
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenThemeShopLoaded) return; window.__hansenThemeShopLoaded = true;

  // ---- 主题配置 ----
  var FREE_THEMES = ['cosmos', 'pink'];  // 开局免费: 星空夜 + 樱花粉
  var THEME_PRICE = {                    // 付费主题价格 (阶梯定价)
    ocean:   300,
    forest:  1000,
    rainbow: 2000,
    peach:   3000
  };
  var THEME_NAME = {
    cosmos:'星空夜', pink:'樱花粉', ocean:'海洋蓝',
    forest:'森林绿', rainbow:'彩虹云朵', peach:'桃子糖果'
  };
  var THEME_EMOJI = {
    cosmos:'🌌', pink:'🌸', ocean:'🌊', forest:'🌳', rainbow:'🌈', peach:'🍑'
  };

  var UNLOCK_KEY = 'hansen_unlocked_themes';
  var WALLET_KEY = 'hansen_wallet_coins';

  // ---- 全局金币钱包 ----
  function getWallet(){
    try {
      var v = parseInt(localStorage.getItem(WALLET_KEY), 10);
      return (isFinite(v) && v >= 0) ? v : 0;
    } catch(e){ return 0; }
  }
  function setWallet(n){
    try { localStorage.setItem(WALLET_KEY, String(Math.max(0, Math.floor(n)))); } catch(e){}
  }
  // 对外暴露, 供后续步骤(打卡/赚币)往钱包加币
  window.HansenWallet = {
    get: getWallet,
    add: function(n){ n=Number(n); if(!isFinite(n))return getWallet(); var w=getWallet()+Math.floor(n); setWallet(w); return w; },
    spend: function(n){ n=Number(n); if(!isFinite(n)||n<0)return false; var w=getWallet(); if(w<n)return false; setWallet(w-n); return true; }
  };

  // ---- 已解锁主题 ----
  function getUnlocked(){
    var base = FREE_THEMES.slice();
    try {
      var raw = localStorage.getItem(UNLOCK_KEY);
      if(raw){ var arr = JSON.parse(raw); if(Array.isArray(arr)) arr.forEach(function(k){ if(base.indexOf(k)<0) base.push(k); }); }
    } catch(e){}
    return base;
  }
  function isUnlocked(key){
    if(FREE_THEMES.indexOf(key) >= 0) return true;       // 免费主题永远解锁
    if(!(key in THEME_PRICE)) return true;               // 未知主题不拦(安全)
    return getUnlocked().indexOf(key) >= 0;
  }
  function unlock(key){
    try {
      var arr = [];
      var raw = localStorage.getItem(UNLOCK_KEY);
      if(raw){ var p = JSON.parse(raw); if(Array.isArray(p)) arr = p; }
      if(arr.indexOf(key) < 0) arr.push(key);
      localStorage.setItem(UNLOCK_KEY, JSON.stringify(arr));
    } catch(e){}
  }

  // ---- 简易弹窗 ----
  function showBuyDialog(key){
    var price = THEME_PRICE[key];
    var coins = getWallet();
    var enough = coins >= price;

    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483550;background:rgba(12,21,56,.86);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';

    var box = document.createElement('div');
    box.style.cssText = 'width:100%;max-width:320px;background:linear-gradient(160deg,#1a2660,#0c1538);border:2px solid rgba(251,191,36,.5);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:28px 22px;text-align:center';

    box.innerHTML =
      '<div style="font-size:60px;margin-bottom:10px">'+(THEME_EMOJI[key]||'🎨')+'</div>'+
      '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px">'+(THEME_NAME[key]||'主题')+'</div>'+
      '<div style="font-size:14px;color:#cbd5e1;margin-bottom:18px">解锁这个主题</div>'+
      '<div style="background:rgba(251,191,36,.12);border-radius:12px;padding:12px;margin-bottom:8px">'+
        '<div style="font-size:15px;color:#fbbf24;font-weight:800">💰 '+price+' 金币</div>'+
      '</div>'+
      '<div style="font-size:13px;color:'+(enough?'#94a3b8':'#f87171')+';margin-bottom:18px">'+
        '你有 💰 '+coins+ (enough ? '' : '（还差 '+(price-coins)+'）') +'</div>'+
      '<div style="display:flex;gap:10px">'+
        '<div id="__ts_cancel" style="flex:1;padding:12px;border-radius:12px;background:#334155;color:#cbd5e1;font-weight:700;cursor:pointer">取消</div>'+
        '<div id="__ts_buy" style="flex:1.4;padding:12px;border-radius:12px;font-weight:900;cursor:pointer;'+
          (enough ? 'background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a2660' : 'background:#475569;color:#94a3b8')+'">'+
          (enough ? '✅ 解锁' : '金币不足')+'</div>'+
      '</div>';

    mask.appendChild(box);
    document.body.appendChild(mask);

    function close(){ if(mask.parentNode) mask.parentNode.removeChild(mask); }
    var cancelBtn = document.getElementById('__ts_cancel');
    if(cancelBtn) cancelBtn.addEventListener('click', close);
    mask.addEventListener('click', function(e){ if(e.target===mask) close(); });

    var buyBtn = enough ? document.getElementById('__ts_buy') : null;
    if(enough && buyBtn){
      buyBtn.addEventListener('click', function(){
        // 扣币 + 解锁 + 立即应用
        if(window.HansenWallet.spend(price)){
          unlock(key);
          close();
          // 解锁后立即切换到该主题 (调原始 pickTheme)
          if(typeof window.__origPickTheme === 'function'){
            window.__origPickTheme(key);
          }
          // 刷新主题网格(显示已解锁)
          try{ decorateGrid(); }catch(e){}
          toast('🎉 已解锁「'+(THEME_NAME[key]||'主题')+'」！');
        }
      });
    }
  }

  function toast(msg){
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:2147483560;background:rgba(26,38,96,.95);border:1px solid rgba(251,191,36,.5);color:#fff;padding:12px 20px;border-radius:14px;font-size:15px;font-weight:700;font-family:-apple-system,"Microsoft YaHei",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },400); }, 1800);
  }

  // ---- 包裹 pickTheme: 锁住的主题不放行, 弹购买 ----
  function hookPickTheme(){
    if(typeof window.pickTheme !== 'function') return false;
    if(window.pickTheme.__hansenShopHooked) return true;

    window.__origPickTheme = window.pickTheme;
    window.pickTheme = function(key){
      if(isUnlocked(key)){
        return window.__origPickTheme.apply(this, arguments);  // 已解锁: 正常切换
      } else {
        showBuyDialog(key);                                    // 锁住: 弹购买框
      }
    };
    window.pickTheme.__hansenShopHooked = true;
    return true;
  }

  // ---- 给主题网格的锁住项加 🔒 和价格 ----
  // renderThemeGrid 是 index.html 闭包内的局部函数, 没暴露到 window, hook 不到。
  // 所以改用 MutationObserver 监听 #themeGrid 的内容变化, 每次重渲后自己往锁住的卡上叠加 🔒。
  // 主题卡 DOM 顺序与 THEMES 数组一致: cosmos,pink,ocean,forest,rainbow,peach。
  var THEME_ORDER = ['cosmos','pink','ocean','forest','rainbow','peach'];

  function decorateGrid(){
    try {
      var grid = document.getElementById('themeGrid');
      if(!grid) return;
      var cards = grid.querySelectorAll('.theme-card');
      for(var i=0;i<cards.length;i++){
        var card = cards[i];
        var key = THEME_ORDER[i];
        if(!key) continue;
        var locked = !isUnlocked(key) && (key in THEME_PRICE);
        var existing = card.querySelector('.__ts_lock');
        if(locked){
          card.style.position = 'relative';
          if(!existing){
            var lock = document.createElement('div');
            lock.className = '__ts_lock';
            lock.style.cssText = 'position:absolute;inset:0;background:rgba(12,21,56,.62);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;z-index:2';
            lock.innerHTML = '<div style="font-size:22px">🔒</div><div style="font-size:11px;color:#fbbf24;font-weight:800">💰'+THEME_PRICE[key]+'</div>';
            card.appendChild(lock);
          }
        } else if(existing){
          existing.parentNode.removeChild(existing);  // 已解锁: 移除锁
        }
      }
    } catch(e){}
  }

  function watchGrid(){
    var grid = document.getElementById('themeGrid');
    if(grid){
      decorateGrid();
      try {
        var obs = new MutationObserver(function(){ decorateGrid(); });
        obs.observe(grid, { childList: true });
      } catch(e){}
    }
    // grid 可能还没出现, 也监听 body 等它出现
    try {
      var bodyObs = new MutationObserver(function(){
        if(document.getElementById('themeGrid')) decorateGrid();
      });
      bodyObs.observe(document.body, { childList: true, subtree: true });
    } catch(e){}
  }
  // 对外暴露(购买后刷新用)
  window.renderThemeGrid = window.renderThemeGrid || function(){ decorateGrid(); };

  // ---- 隐藏界面上的钻石💎 ----
  function hideGems(){
    try {
      // 顶栏钻石计数 (gemCount 的父容器)
      var gem = document.getElementById('gemCount');
      if(gem){
        var p = gem.parentElement;
        if(p) p.style.display = 'none';
      }
    } catch(e){}
    // 设置页"钻石/金币/星星"那行——用 CSS 不好精准命中, 留待第3步整理设置页时统一处理
  }

  // ---- 轮询挂载 pickTheme (页面加载后才存在) ----
  var tries = 0;
  var gridWatched = false;
  var timer = setInterval(function(){
    tries++;
    var hooked = hookPickTheme();
    hideGems();
    if(!gridWatched){ watchGrid(); gridWatched = true; }  // 监听主题网格一次
    if(hooked || tries >= 100){ clearInterval(timer); }
  }, 100);

})();
