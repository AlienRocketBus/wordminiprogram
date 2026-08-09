// hansen_theme_lock.js v942 — 主题锁门禁 + 严格购买事务
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
  var PENDING_KEY = 'hansen_theme_purchase_pending_v942';
  var PROOF_KEY = 'hansen_theme_purchase_transaction_v942';
  var FREE_DEFAULT = 'cosmos';

  function walletState(){try{var raw=localStorage.getItem(WALLET_KEY),v=raw===null?0:Number(raw);if(!isFinite(v)||Math.floor(v)!==v||v<0)return {ok:false,value:NaN};var api=window.HansenCoins&&typeof HansenCoins.get==='function'?Number(HansenCoins.get()):v;return isFinite(api)&&api===v?{ok:true,value:v}:{ok:false,value:NaN};}catch(e){return {ok:false,value:NaN};}}
  function getWallet(){var r=walletState();return r.ok?r.value:NaN;}
  function setWallet(n){ try{var v=String(Math.max(0,Math.floor(n)));localStorage.setItem(WALLET_KEY,v);return localStorage.getItem(WALLET_KEY)===v;}catch(e){return false;} }
  function spendCoins(n){
    try{if(window.HansenCoins&&typeof window.HansenCoins.spend==='function')return window.HansenCoins.spend(n)===true;}catch(e){return false;}
    var w=getWallet();return w>=n&&setWallet(w-n);
  }
  function unlockedState(){
    var base = FREE_THEMES.slice();
    try{ var raw=localStorage.getItem(UNLOCK_KEY); if(raw!==null){ var a=JSON.parse(raw);if(!Array.isArray(a)||a.some(function(k){return typeof k!=='string';}))return {ok:false,value:base};a.forEach(function(k){ if(Object.prototype.hasOwnProperty.call(THEME_PRICE,k)&&base.indexOf(k)<0) base.push(k); }); }return {ok:true,value:base};}catch(e){return {ok:false,value:base};}
  }
  function sanitizeUnlockedState(){
    try{var raw=localStorage.getItem(UNLOCK_KEY);if(raw===null)return true;var state=unlockedState();if(!state.ok)return false;var paid=state.value.filter(function(k){return Object.prototype.hasOwnProperty.call(THEME_PRICE,k);}).sort();var next=JSON.stringify(paid);if(raw!==next)localStorage.setItem(UNLOCK_KEY,next);return localStorage.getItem(UNLOCK_KEY)===next;}catch(e){return false;}
  }
  function getUnlocked(){return unlockedState().value;}
  function isUnlocked(key){
    if(!key) return true;
    if(FREE_THEMES.indexOf(key) >= 0) return true;     // 免费主题永远解锁
    if(!Object.prototype.hasOwnProperty.call(THEME_PRICE,key)) return true; /* 非六款基础主题不由本门禁收费。 */
    var r=unlockedState();return r.ok&&r.value.indexOf(key) >= 0;
  }
  function unlock(key){
    try{
      if(!Object.prototype.hasOwnProperty.call(THEME_PRICE,key))return false;
      var state=unlockedState();if(!state.ok)return false;var arr=state.value.filter(function(k){return Object.prototype.hasOwnProperty.call(THEME_PRICE,k);});
      if(arr.indexOf(key)<0) arr.push(key);
      arr.sort();var next=JSON.stringify(arr);localStorage.setItem(UNLOCK_KEY,next);
      return localStorage.getItem(UNLOCK_KEY)===next&&isUnlocked(key);
    }catch(e){return false;}
  }

  function readPending(){
    try{var raw=localStorage.getItem(PENDING_KEY);if(raw===null)return {ok:true,value:null};var p=JSON.parse(raw);if(!p||p.version!==942||typeof p.theme!=='string')return {ok:false,value:null};
      var price=THEME_PRICE[p.theme],before=Math.floor(Number(p.before));
      if(!price||p.price!==price||!isFinite(before)||before<price||p.target!==before-price||(p.stage!=='prepared'&&p.stage!=='spent')||!/^theme-[a-z0-9-]{8,160}$/i.test(String(p.txid||'')))return {ok:false,value:null};
      return {ok:true,value:{version:942,txid:String(p.txid),theme:p.theme,price:price,before:before,target:before-price,stage:p.stage}};
    }catch(e){return {ok:false,value:null};}
  }
  function writePending(p){try{var raw=JSON.stringify(p);localStorage.setItem(PENDING_KEY,raw);return localStorage.getItem(PENDING_KEY)===raw;}catch(e){return false;}}
  function clearPending(){try{localStorage.removeItem(PENDING_KEY);return localStorage.getItem(PENDING_KEY)===null;}catch(e){return false;}}
  function proofFor(p,state){return {version:942,txid:p.txid,theme:p.theme,price:p.price,before:p.before,target:p.target,state:state};}
  function readProof(p){try{var raw=localStorage.getItem(PROOF_KEY);if(raw===null)return {ok:true,value:null};var x=JSON.parse(raw);if(!x||x.version!==942||x.txid!==p.txid||x.theme!==p.theme||x.price!==p.price||x.before!==p.before||x.target!==p.target||(x.state!=='prepared'&&x.state!=='paid'))return {ok:false,value:null};return {ok:true,value:x};}catch(e){return {ok:false,value:null};}}
  function writeProof(p,state){try{var raw=JSON.stringify(proofFor(p,state));localStorage.setItem(PROOF_KEY,raw);return localStorage.getItem(PROOF_KEY)===raw;}catch(e){return false;}}
  function confirmProof(p,balance){var r=readProof(p);if(!r.ok||!r.value||balance!==p.target)return false;return r.value.state==='paid'||writeProof(p,'paid');}
  function clearProof(p){try{var r=readProof(p);if(!r.ok)return false;if(!r.value)return true;localStorage.removeItem(PROOF_KEY);return localStorage.getItem(PROOF_KEY)===null;}catch(e){return false;}}
  function cleanup(p){return clearProof(p)&&clearPending();}
  function clearOrphanProof(){try{var raw=localStorage.getItem(PROOF_KEY);if(raw===null)return true;var x=JSON.parse(raw),price=x&&THEME_PRICE[x.theme],before=Number(x&&x.before);if(!x||x.version!==942||!price||x.price!==price||!isFinite(before)||Math.floor(before)!==before||before<price||x.target!==before-price||(x.state!=='prepared'&&x.state!=='paid')||!/^theme-[a-z0-9-]{8,160}$/i.test(String(x.txid||'')))return false;localStorage.removeItem(PROOF_KEY);return localStorage.getItem(PROOF_KEY)===null;}catch(e){return false;}}
  function recoverPurchase(){
    var pr=readPending();if(!pr.ok)return {status:'pending',reason:'storage'};var p=pr.value;if(!p)return {status:clearOrphanProof()?'none':'pending',reason:'proof'};
    var us=unlockedState();if(!us.ok)return {status:'pending',theme:p.theme};if(us.value.indexOf(p.theme)>=0){if(!cleanup(p))return {status:'pending',theme:p.theme};return {status:'committed',theme:p.theme};}
    var ws=walletState();if(!ws.ok)return {status:'pending',theme:p.theme};var balance=ws.value,pf=readProof(p);if(!pf.ok)return {status:'pending',theme:p.theme};
    if(balance===p.before){if(pf.value&&pf.value.state==='paid')return {status:'pending',theme:p.theme};return {status:cleanup(p)?'cancelled':'pending',theme:p.theme};}
    if(balance!==p.target||!pf.value||!confirmProof(p,balance))return {status:'pending',theme:p.theme};
    if(!unlock(p.theme))return {status:'pending',theme:p.theme};
    if(!cleanup(p))return {status:'pending',theme:p.theme};return {status:'committed',theme:p.theme};
  }
  function purchaseTheme(key){
    var prior=recoverPurchase();if(prior.status==='pending')return false;var us=unlockedState();if(!us.ok)return false;if(us.value.indexOf(key)>=0)return true;
    var price=THEME_PRICE[key],ws=walletState(),before=ws.value;if(!price||!ws.ok||before<price)return false;
    var p={version:942,txid:'theme-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),theme:key,price:price,before:before,target:before-price,stage:'prepared'};
    if(!writePending(p))return false;
    if(!writeProof(p,'prepared')){cleanup(p);return false;}spendCoins(price);var as=walletState();if(!as.ok)return false;var after=as.value;
    if(after===p.before){cleanup(p);return false;}if(after!==p.target||!confirmProof(p,after))return false;
    p.stage='spent';writePending(p);
    if(!unlock(key))return false;return cleanup(p);
  }

  // 对外暴露(监察官 / 其它消费方)
  window.HansenThemeLock = {
    isUnlocked: isUnlocked,
    isLocked: function(k){ return !isUnlocked(k); },
    prices: THEME_PRICE,
    free: FREE_THEMES.slice(),
    freeDefault: FREE_DEFAULT,
    purchase:purchaseTheme,
    recover:recoverPurchase,
    pendingKey:PENDING_KEY
  };

  function toast(msg){
    /* 🔴v1156：**先交给统一的提示，拿不到再用本地这份。**

       全站有 9 个模块各写了一份 `toast()`，共 49 处调用。
       实测它们长得并不一样：
         · land_cards / sb_profile —— 从**底部**弹，底色 rgba(15,23,42,.95)
         · theme_lock / theme_shop —— 从**顶部**弹，底色 rgba(26,38,96,.95)

       于是用户在同一个 App 里会看到两种完全不同的提示样式，
       **同一件事在不同页面上长得不一样，人会以为是两回事**。

       把 49 处调用全改掉风险太大（都在各自模块的逻辑里），
       所以改成**转发**：有统一实现就用它，没有才走本地这份。
       这样样式立刻统一，而每个模块的调用一行都不用动。 */
    try {
      if (window.HansenToast && HansenToast.say) { HansenToast.say(msg); return; }
    } catch (e) {}

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
        if(purchaseTheme(key)){
          close();
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
  try{sanitizeUnlockedState();recoverPurchase();}catch(e){}
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
