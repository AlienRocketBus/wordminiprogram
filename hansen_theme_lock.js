// hansen_theme_lock.js — 主题锁门禁 (岛内设置页) — 修复"设置里不解锁也能换主题"重大bug (v438)
// ============================================================================
// 背景(重大bug, v438): 主题分免费/付费, 付费主题要在首页【主题商店】花金币解锁(扣全局钱包
//   hansen_wallet_coins, 已解锁记 hansen_unlocked_themes)。但【岛内设置页】的主题选择直接调
//   window.applyTheme(key) 切换, 完全【不校验是否已解锁】; 而且 19 个岛【都没加载】
//   hansen_theme_shop.js(商店只钩了首页的 pickTheme)。结果: 在岛内设置里点任意主题(含没买的)
//   就直接换了 → 花金币买主题彻底失去意义 = 重大bug。
// 本文件(19 岛都加载): 钩住 window.applyTheme, 让"没解锁的付费主题"无法直接切换, 而是弹购买框
//   (用同一个全局钱包买、解锁记同一个 hansen_unlocked_themes —— 与商店完全同一套真相);
//   给设置页主题网格 #themeBox 的锁定项叠加 🔒+价格; 启动时若存档主题是没买的付费主题, 重置为免费 cosmos
//   (清掉之前 bug 留下的非法主题)。
// ⚠️ 配置(免费主题/价格)必须与 hansen_theme_shop.js 完全一致! 改价格两个文件一起改。
//    监察官 [E] 会动态校验"没解锁的付费主题无法经 applyTheme 生效", 防此 bug 复发。
// 设计: 零侵入、独立文件、幂等、各岛通用。
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenThemeLockLoaded) return; window.__hansenThemeLockLoaded = true;

  // ⚠️ 必须与 hansen_theme_shop.js 同步
  var FREE_THEMES = ['cosmos', 'pink'];                              // 免费: 星空夜 + 樱花粉
  var THEME_PRICE = { ocean:300, forest:1000, rainbow:2000, peach:3000 };  // 付费(金币)(v454再平衡:首个海洋蓝便宜试水,其余大幅提价=高级主题真成就;须与theme_shop同步)
  var THEME_NAME  = { cosmos:'星空夜', pink:'樱花粉', ocean:'海洋蓝', forest:'森林绿', rainbow:'彩虹云朵', peach:'桃子糖果' };
  var THEME_EMOJI = { cosmos:'🌌', pink:'🌸', ocean:'🌊', forest:'🌳', rainbow:'🌈', peach:'🍑' };
  var THEME_ORDER = ['cosmos','pink','ocean','forest','rainbow','peach'];
  var UNLOCK_KEY  = 'hansen_unlocked_themes';
  var WALLET_KEY  = 'hansen_wallet_coins';
  var FREE_DEFAULT = 'cosmos';

  function getWallet(){ try{ var v=parseInt(localStorage.getItem(WALLET_KEY),10); return (isFinite(v)&&v>=0)?v:0; }catch(e){ return 0; } }
  function setWallet(n){ try{ localStorage.setItem(WALLET_KEY,String(Math.max(0,Math.floor(n)))); }catch(e){} }
  function getUnlocked(){
    var base = FREE_THEMES.slice();
    try{ var raw=localStorage.getItem(UNLOCK_KEY); if(raw){ var a=JSON.parse(raw); if(Array.isArray(a)) a.forEach(function(k){ if(base.indexOf(k)<0) base.push(k); }); } }catch(e){}
    return base;
  }
  function isUnlocked(key){
    if(!key) return true;
    if(FREE_THEMES.indexOf(key) >= 0) return true;     // 免费主题永远解锁
    if(!(key in THEME_PRICE)) return true;             // 未知主题不拦(安全)
    return getUnlocked().indexOf(key) >= 0;
  }
  function unlock(key){
    try{
      var arr=[]; var raw=localStorage.getItem(UNLOCK_KEY);
      if(raw){ var p=JSON.parse(raw); if(Array.isArray(p)) arr=p; }
      if(arr.indexOf(key)<0) arr.push(key);
      localStorage.setItem(UNLOCK_KEY, JSON.stringify(arr));
    }catch(e){}
  }

  // 对外暴露(监察官 / 其它消费方)
  window.HansenThemeLock = {
    isUnlocked: isUnlocked,
    isLocked: function(k){ return !isUnlocked(k); },
    prices: THEME_PRICE,
    free: FREE_THEMES.slice(),
    freeDefault: FREE_DEFAULT
  };

  function toast(msg){
    var t=document.createElement('div'); t.textContent=msg;
    t.style.cssText='position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:2147483560;background:rgba(26,38,96,.95);border:1px solid rgba(251,191,36,.5);color:#fff;padding:12px 20px;border-radius:14px;font-size:15px;font-weight:700;font-family:-apple-system,"Microsoft YaHei",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },400); },1800);
  }

  // 购买框(与商店同款; 用全局钱包买)
  function showBuyDialog(key){
    if(!(key in THEME_PRICE)) return;
    var price=THEME_PRICE[key], coins=getWallet(), enough=coins>=price;
    var mask=document.createElement('div');
    mask.style.cssText='position:fixed;inset:0;z-index:2147483550;background:rgba(12,21,56,.86);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    var box=document.createElement('div');
    box.style.cssText='width:100%;max-width:320px;background:linear-gradient(160deg,#1a2660,#0c1538);border:2px solid rgba(251,191,36,.5);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:28px 22px;text-align:center';
    box.innerHTML=
      '<div style="font-size:60px;margin-bottom:10px">'+(THEME_EMOJI[key]||'🎨')+'</div>'+
      '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px">'+(THEME_NAME[key]||'主题')+'</div>'+
      '<div style="font-size:14px;color:#cbd5e1;margin-bottom:18px">解锁这个主题</div>'+
      '<div style="background:rgba(251,191,36,.12);border-radius:12px;padding:12px;margin-bottom:8px"><div style="font-size:15px;color:#fbbf24;font-weight:800">💰 '+price+' 金币</div></div>'+
      '<div style="font-size:13px;color:'+(enough?'#94a3b8':'#f87171')+';margin-bottom:18px">你有 💰 '+coins+(enough?'':'（还差 '+(price-coins)+'）')+'</div>'+
      '<div style="display:flex;gap:10px">'+
        '<div id="__tl_cancel" style="flex:1;padding:12px;border-radius:12px;background:#334155;color:#cbd5e1;font-weight:700;cursor:pointer">取消</div>'+
        '<div id="__tl_buy" style="flex:1.4;padding:12px;border-radius:12px;font-weight:900;cursor:pointer;'+(enough?'background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a2660':'background:#475569;color:#94a3b8')+'">'+(enough?'✅ 解锁':'金币不足')+'</div>'+
      '</div>';
    mask.appendChild(box); document.body.appendChild(mask);
    function close(){ if(mask.parentNode) mask.parentNode.removeChild(mask); }
    var c=document.getElementById('__tl_cancel'); if(c) c.addEventListener('click',close);
    mask.addEventListener('click',function(e){ if(e.target===mask) close(); });
    if(enough){
      var bbtn=document.getElementById('__tl_buy');
      if(bbtn) bbtn.addEventListener('click',function(){
        var w=getWallet();
        if(w>=price){
          setWallet(w-price); unlock(key); close();
          rawApply(key);  // 已解锁, 直接裸切换(不经包装器链, 防递归)
          try{ if(typeof window.renderThemeBox==='function') window.renderThemeBox(); }catch(e){}
          try{ decorateThemeBox(); }catch(e){}
          toast('🎉 已解锁「'+(THEME_NAME[key]||'主题')+'」！');
        }
      });
    }
  }

  // 裸切换: 直接写 dataset+存档, 不经任何包装器链 → 防递归
  function rawApply(name){
    var nm=name; if(!nm){ try{ nm=localStorage.getItem('theme'); }catch(e){} nm=nm||FREE_DEFAULT; }
    try{ if(document.body) document.body.dataset.theme = nm; }catch(e){}
    try{ localStorage.setItem('theme', nm); }catch(e){}
  }
  // 钩 applyTheme: 锁定的付费主题不放行(弹购买)
  function hookApplyTheme(){
    if(typeof window.applyTheme!=='function') return false;
    if(window.applyTheme.__hansenLockHooked) return true;
    window.__orig_applyTheme = window.applyTheme;
    window.applyTheme = function(name){
      // 锁定的付费主题: 拦截, 弹购买框, 不切换
      if(name && !isUnlocked(name)){ showBuyDialog(name); return; }
      // 放行(免费/已购/无参): 走原链(岛内 applyTheme 已被"音效包装器" wrapDepth/play 包过)。
      // ⚠️ 那个音效包装器会回调回全局 applyTheme(=本包装器), 直接再调会【无限递归】(已实测栈溢出)。
      //    用重入标志兜底: 二次进入时直接裸切换, 打破环、同时保留首层音效。
      if(window.__hsnInApplyTheme){ rawApply(name); return; }
      window.__hsnInApplyTheme = true;
      try { return window.__orig_applyTheme.apply(this, arguments); }
      catch(e){ rawApply(name); }
      finally { window.__hsnInApplyTheme = false; }
    };
    window.applyTheme.__hansenLockHooked = true;
    return true;
  }

  // 给设置页 #themeBox 锁定项叠加 🔒+价格
  function cardKey(card, idx){
    try{ var oc=card.getAttribute('onclick')||''; var m=oc.match(/applyTheme\(['"]([a-z]+)['"]\)/i); if(m) return m[1]; }catch(e){}
    return THEME_ORDER[idx] || null;
  }
  function decorateThemeBox(){
    try{
      var boxEl=document.getElementById('themeBox'); if(!boxEl) return;
      var cards=boxEl.children;
      for(var i=0;i<cards.length;i++){
        var card=cards[i]; var key=cardKey(card,i); if(!key) continue;
        var locked = !isUnlocked(key) && (key in THEME_PRICE);
        var existing = card.querySelector('.__tl_lock');
        if(locked){
          card.style.position='relative';
          if(!existing){
            var lk=document.createElement('div'); lk.className='__tl_lock';
            lk.style.cssText='position:absolute;inset:0;background:rgba(12,21,56,.6);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;z-index:2';
            lk.innerHTML='<div style="font-size:24px">🔒</div><div style="font-size:11px;color:#fbbf24;font-weight:800">💰'+THEME_PRICE[key]+'</div>';
            card.appendChild(lk);
          }
        } else if(existing){ existing.parentNode.removeChild(existing); }
      }
    }catch(e){}
  }
  // 钩 renderThemeBox: 每次重渲后补锁(精准, 不用全局 observer)
  function hookRenderThemeBox(){
    if(typeof window.renderThemeBox!=='function') return false;
    if(window.renderThemeBox.__hansenLockHooked) return true;
    var orig=window.renderThemeBox;
    window.renderThemeBox=function(){ var r=orig.apply(this,arguments); try{ decorateThemeBox(); }catch(e){} return r; };
    window.renderThemeBox.__hansenLockHooked=true;
    return true;
  }

  // 启动: 若存档主题是没买的付费主题, 重置为免费默认(清掉之前 bug 留下的非法主题)
  function fixStolenTheme(){
    try{
      var saved=localStorage.getItem('theme');
      if(saved && !isUnlocked(saved)){
        localStorage.setItem('theme', FREE_DEFAULT);
        try{ if(document.body) document.body.dataset.theme = FREE_DEFAULT; }catch(e){}
      }
    }catch(e){}
  }

  // 立即尝试 + 轮询(applyTheme/renderThemeBox 通常在内联脚本里已定义)
  fixStolenTheme();
  hookApplyTheme();
  hookRenderThemeBox();
  decorateThemeBox();
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    var a=hookApplyTheme(); var b=hookRenderThemeBox();
    decorateThemeBox();
    if((a && b) || tries>=60){ clearInterval(timer); fixStolenTheme(); }
  },100);

})();
