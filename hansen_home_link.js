/* 🔴 v567+v568: 首页↔岛 一体化返回机制(v568: 零延迟点击+预渲染瞬开)(Hansen: 点右上角像重新进网站, 首页和大冒险完全割裂——要返回键级瞬回, 融为一体)。
   三层机制(单文件双端, 挂全部 19 岛 + index):
   ① bfcache 瞬时快照恢复: 首页直链/续玩进岛时打 sessionStorage 标记 hsn_from_home; 岛内 goHome 检测到标记 → history.back()
      —— 浏览器往返缓存直接恢复首页快照(0ms 重建, 滚动位置/状态全保留 = 真·返回键), 600ms 可见性兜底防 back 失效。
      配套: perf_boost.js 移除 beforeunload 监听(Chrome 系 bfcache 杀手; pagehide flush 已有, 零功能损失)。
   ② 跨文档 View Transition: JS 动态注入 @view-transition{navigation:auto} 到双端 —— 支持的浏览器(iOS 18+/Chrome 126+)
      整页跳转变平滑淡变过渡, 兜底硬跳路径也无白屏割裂; 不支持的浏览器自动降级无害。
   ③ 直开岛(栈里无首页)→ location.replace 跳首页(replace 不把岛压栈, 首页再 back 不会鬼打墙)。
   数据互通: localStorage 同域天然共享; 首页 renderRecent 已有 pageshow/visibilitychange/storage/轮询四件套, bfcache 恢复即刷。
   iframe SPA 历史兼容分支保留。 */
(function(){
  'use strict';

  /* ---- 双端: 跨文档平滑过渡(②) ----
     🔴v1165 只在顶层页面开：首页外壳的岛框（iframe）里开了它，每次换岛/回首页浏览器都会抛一个没人接的
     「ViewTransition opt-in disabled」错误（iframe 里的跨文档过渡本来就不生效）。 */
  var _vtTop = true;
  try{ _vtTop = (window.top === window); }catch(e){ _vtTop = false; }
  try{
    var st = document.createElement('style');
    st.textContent = (_vtTop ? '@view-transition{navigation:auto}' : '')
      /* v568: 过渡更利落(默认 .25s → .16s), 杜绝"飘"感 */
      + '::view-transition-old(root),::view-transition-new(root){animation-duration:.16s}'
      /* v568: 返回按钮触控即时(消除任何 tap 合成延迟) + 按压立显 */
      + '.world-map-btn{touch-action:manipulation;-webkit-tap-highlight-color:transparent}';
    document.head.appendChild(st);
  }catch(e){}

  /* 🔴 v629(Hansen): 亮主题(如梦境云端)下, 直接压在影院主题背景上的文字发虚看不清 → 加可读性增强。
     纯色文字: 柔和深色描影(text-shadow 光晕); 渐变标题: 用 drop-shadow 滤镜加暗边(★铁律: 渐变文字
     绝不能用 text-shadow——会把透明字面压成黑色, 见 v629 教训)。岛规则锚 #homeScreen、index 规则锚 .page,
     两容器互斥(岛无.page / index无#homeScreen), 不跨页误伤; 卡片上的字在实色卡上、不加。 */
  try{
    var _rd = document.createElement('style');
    _rd.id = 'hsn-text-readability';
    var _halo = 'text-shadow:0 0 1px rgba(0,0,0,.6),0 1px 2px rgba(0,0,0,.85),0 0 6px rgba(0,0,0,.55)!important';
    _rd.textContent =
      /* —— 岛首页: 纯色字(副标题/彩蛋名/彩蛋描述/栏目标题)描影 —— */
      '#homeScreen>div:first-child>div:last-child,.pet-name,.pet-text,.section-label{'+_halo+'}'
      /* —— 岛首页: 渐变主标题(X大冒险) 用 drop-shadow, 禁 text-shadow —— */
      + '#homeScreen>div:first-child>div:first-child{filter:drop-shadow(0 0 18px rgba(251,191,36,.30)) drop-shadow(0 1px 2px rgba(0,0,0,.55))!important;text-shadow:none!important}'
      /* —— index 介绍页: 纯色字(tagline/副标题/介绍段)描影 —— */
      + '.page .tagline,.page .subtitle,.page .intro{'+_halo+'}'
      /* —— index 介绍页: 渐变大标题(单词大冒险) 用 drop-shadow —— */
      + '.page h1.main{filter:drop-shadow(0 0 30px rgba(251,191,36,.30)) drop-shadow(0 1px 2px rgba(0,0,0,.55))!important}';
    document.head.appendChild(_rd);
  }catch(e){}

  var isHome = /(?:^|\/)index\.html?$/.test(location.pathname) || /\/$/.test(location.pathname);

  if(isHome){
    /* ---- 首页端: 进岛打标记(capture 委托, 动态节点也覆盖) ---- */
    document.addEventListener('click', function(e){
      var t = e.target;
      var a = (t && t.closest) ? t.closest('a[href^="island_"]') : null;
      if(a){ try{ sessionStorage.setItem('hsn_from_home','1'); }catch(err){} }
    }, true);
    /* 续玩等非 <a> 跳转路径由岛端 document.referrer 原生信号覆盖(见下), 无需包装函数
       (click_sound.js 会对全局 onclick 函数再包异步音效层, 函数包装顺序不可控——v567 实测教训)。 */
    return;
  }

  /* ---- 岛端: goHome 覆盖为返回键级瞬回(①③) ---- */
  window.goHome = function(){
    /* v568: 音效与导航同帧并行(playNavClick 由 click_sound 暴露; fire-and-forget 零等待) */
    try{ if(window.playNavClick) window.playNavClick(); }catch(e){}
    /* iframe SPA 历史兼容 */
    try{
      if(window.parent && window.parent !== window){
        /* 🔴v860: v851壳内延伸——星海子岛(season1-5)返回=回星海宇宙地图hub, 不跳过hub直落大地图 */
        if(/island_season[1-5]\.html/.test(location.pathname||'') && typeof window.parent.openIsland === 'function'){
          window.parent.openIsland('island_season.html');
          return false;
        }
        /* 🔴v875(Hansen·彻底打通·一间房门全开): 大陆子岛(land1-8)返回=回大陆地图·壳内iframe换装零延迟(不跳过地图直落index) */
        if(/island_land[1-8]\.html/.test(location.pathname||'') && typeof window.parent.openIsland === 'function'){
          window.parent.openIsland('land_map.html');
          return false;
        }
        if(window.parent.closeIsland){
          window.parent.closeIsland();
          return false;
        }
      }
    }catch(e){}
    /* 🔴v875(Hansen·彻底打通): 大陆子岛独立打开(非壳内)时·返回同样回大陆地图·不回index */
    if(/island_land[1-8]\.html/.test(location.pathname||'')){
      try{ location.replace('land_map.html'); }catch(e){ try{ (function(){ if(window.HansenRoom){ HansenRoom.open('land'); return; } location.href='land_map.html'; })(); }catch(e2){} }
      return false;
    }
    var fromHome = false;
    try{ fromHome = sessionStorage.getItem('hsn_from_home') === '1'; }catch(e){}
    if(!fromHome){
      /* 浏览器原生信号兜底: 从首页来的任何跳转方式(直链/续玩/location.href)referrer 都是 index */
      try{
        var ref = document.referrer || '';
        if(ref){
          var u = new URL(ref);
          if(u.origin === location.origin && /(?:^|\/)(?:index\.html?)?$/.test(u.pathname)){ fromHome = true; }
        }
      }catch(e){}
    }
    if(fromHome && window.history.length > 1){
      try{ window.history.back(); }
      catch(e){ try{ location.replace('index.html'); }catch(e2){} return false; }
      /* 兜底: back 后 600ms 本页仍可见 = back 未生效(栈被清等), 硬跳。
         back 成功 → 文档 pagehide/卸载, 此定时器自然不会执行。 */
      setTimeout(function(){
        try{
          if(document.visibilityState === 'visible'){ location.replace('index.html'); }
        }catch(e){}
      }, 600);
    } else {
      try{ location.replace('index.html'); }
      catch(e){ try{ location.href = 'index.html'; }catch(e2){} }
    }
    return false;
  };
  /* v568 双保险: 标记已含音效, click_sound 的 DOMContentLoaded/load 双次 bind 都会跳过包装,
     350ms 串行等待永不回潮(根因: bind 晚于本脚本, 曾把 v567 的 goHome 包进 wrapAsync)。 */
  try{ window.goHome.__navSoundHooked = true; }catch(e){}

  /* ---- v568 ④: 预渲染/预取 首页——bfcache 未命中环境(部分内核)硬加载也瞬开 ----
     Speculation Rules(Chrome/Edge): 后台完整预渲染 index, 跳转=瞬时激活;
     不支持则 <link rel=prefetch> 进 HTTP 缓存。延迟 1.5s 注入, 不抢岛首屏带宽。 */
  setTimeout(function(){
    /* 🔴v1165 在首页外壳的岛框（iframe）里不预取首页：首页就是外壳自己（回首页是收起岛框、不跳页），
       以前每进一个岛都让微信在后台再下载一份 index.html（约 210 KB），一点用都没有。单独打开的岛（顶层页）照旧预取 */
    if(!_vtTop) return;
    try{
      /* v570: 低内存防护——prerender 会在后台多养一个完整 index 实例(内存翻倍压力)。
         低内存设备(deviceMemory<4)或微信内置浏览器(X5 内存紧张, "玩着玩着崩"高发区)
         降级为 prefetch(只进 HTTP 缓存, 零额外内存), 防止预渲染反而压崩游戏本体。 */
      var lowMem = false;
      try{
        lowMem = (navigator.deviceMemory && navigator.deviceMemory < 4) ||
                 /MicroMessenger/i.test(navigator.userAgent || '');
      }catch(e){}
      if(!lowMem && window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')){
        var sp = document.createElement('script');
        sp.type = 'speculationrules';
        sp.textContent = JSON.stringify({ prerender:[{ urls:['index.html'] }], prefetch:[{ urls:['index.html'] }] });
        document.head.appendChild(sp);
      } else {
        var lk = document.createElement('link');
        lk.rel = 'prefetch';
        lk.href = 'index.html';
        document.head.appendChild(lk);
      }
    }catch(e){}
  }, 1500);

  /* ---- 🔴v1165 手机「返回」只退一步：先关岛里最上面那个浮层 ----
     首页外壳（index.html）收到返回键时先问岛页 __hsnIslandBack()（模板提供：先调 __hsnBackStack 里登记的关闭函数，
     再关弹窗，再从游戏回本岛主页）。这里负责「登记」：错题总览、复习中心、我的学习、答错小课、星海面板/神秘殿堂、
     抽卡揭晓、装备/主题商店……这些浮层都是各模块临时挂在 <body> 上的全屏层，一出现就登记一个关闭函数，消失就撤销。
     关闭时点它自己的关闭按钮（和孩子亲手点一样，各模块的收尾照常做）；找不到按钮才点空白处。
     🔴v1165 复查：点空白处还关不掉的，**绝不直接拿掉**（以前会 el.remove()）—— 拿掉的只是画面，模块自己的收尾一步没做：
     拼写大PK 对战中按返回，对战屏被删了，心跳照跳、房间没退、对手干等，下一回合对战屏又冒出来。
     现在这种浮层返回 false，让返回键去走下一步（关弹窗 → 回本岛主页 → 退出岛）；对战/登录这些屏单独写了怎么关。 */
  (function backOverlays(){
    /* 已知浮层：id → 它自己的关闭按钮（null = 点浮层本身，答错小课就是「点一下继续」） */
    var KNOWN = {
      hml_lesson: null,
      hwo_overlay: '[onclick*="HansenWrongOverview._close"]',
      hr_center: '[onclick*="HansenReview._close()"]',
      hr_flashcard: '[onclick*="_closeAndBack"]',
      hr_wrongbook: '[onclick*="_closeAndBack"]',
      'hsn-ml': '[onclick*="HansenMyLearning._close"]',
      __hs_season_panel: '#__hs_close',
      __hs_hall_panel: '#__hs_hall_close',
      __hs_showcase: '[aria-label="关闭"]',
      __hs_bcv: '#__hs_bcv_close',
      hsnGearMask: '#hgClose',
      /* 🔴v1165 复查：对战 / 登录这几屏（对战组的文件，这里只调它们自己公开的关闭方法，和孩子点「← 返回 / ✕」一样） */
      hsn_pkroom_screen: pkRoomBack,
      hsn_pk_screen: function(el){ return clickOr(el, '#kBack', function(){ return callClose(window.HansenSbPK, 'close'); }); },
      hsb_prof: function(el){ return clickOr(el, '#pfBack', function(){ return callClose(window.HansenSbProfile, '_close'); }); },
      hsn_ladder_screen: function(el){ return clickOr(el, '#ldX', function(){ return callClose(window.HansenLadderUI, 'close'); }); },
      hsn_friends_screen: function(el){ return clickOr(el, '#frBack, #frX', function(){ return callClose(window.HansenFriendsUI, 'close'); }); },
      hsn_auth_panel: function(el){ return clickOr(el, '#auX', function(){ return callClose(window.HansenAuthUI, 'close'); }); },
      hsn_gate: function(){ return false; }   /* 注册门槛是硬门槛：返回键不关它、也不拿掉它 */
    };
    function visibleIn(el, sel){ try{ var b = el.querySelector(sel); return b && b.getClientRects().length ? b : null; }catch(e){ return null; } }
    function clickOr(el, sel, fallback){ var b = visibleIn(el, sel); if(b){ try{ b.click(); }catch(e){} return true; } return fallback(); }
    function callClose(mod, name){ try{ if(mod && typeof mod[name] === 'function'){ mod[name](); return true; } }catch(e){} return false; }
    /* 拼写大PK 公开房间屏：大厅/等人/结算页上有「← 返回 / ← 关掉房间 / ← 回到房间列表」，就点它；
       对战正在进行：按一次只提醒，3 秒内再按一次才退出这一局 —— 走 HansenPkRoomUI.close()（停心跳、退出房间、清计时器），
       不会一碰返回手势就把对战丢了，也不会只删掉画面留着房间。 */
    var _pkAskAt = 0;
    function pkRoomBack(el){
      if(clickOr(el, '#prBack, #prBack2', function(){ return false; })) return true;
      var now = Date.now();
      if(now - _pkAskAt < 3000){
        _pkAskAt = 0;
        if(callClose(window.HansenPkRoomUI, 'close')) return true;
        return false;
      }
      _pkAskAt = now;
      hint('对战还在进行哦～ 再按一次「返回」就退出这一局');
      return true;
    }
    function hint(text){
      try{ if(window.HansenToast && typeof HansenToast.say === 'function'){ HansenToast.say(text); return; } }catch(e){}
      try{
        var old = document.getElementById('hsnBackHint'); if(old) old.remove();
        var d = document.createElement('div');
        d.id = 'hsnBackHint'; d.setAttribute('role', 'status'); d.textContent = text;
        d.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);transform:translateX(-50%);z-index:2147483646;max-width:86vw;background:rgba(15,23,42,.94);color:#fff;font-size:15px;font-weight:700;line-height:1.5;padding:10px 16px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none;text-align:center';
        document.body.appendChild(d);
        setTimeout(function(){ try{ d.remove(); }catch(e){} }, 2600);
      }catch(e){}
    }
    /* 模板自己管的（弹窗、游戏界面），这里不碰 */
    var SKIP = /^(?:alertModal|wordModal|islandLoading|hansenFxLayer|hsnBootBad)$/;
    var CLOSE_TEXT = /^(?:✕|×|✖|╳|关闭|取消|返回|知道了|我知道了|好的)$/;
    function shown(el){
      try{
        if(!el || !el.isConnected || el.nodeType !== 1) return false;
        if(SKIP.test(el.id || '') || (el.classList && el.classList.contains('screen'))) return false;
        var cs = getComputedStyle(el);
        if(cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
        if(parseFloat(cs.opacity) < 0.05) return false;
        var r = el.getBoundingClientRect();
        return r.width >= (window.innerWidth || 1) * 0.85 && r.height >= (window.innerHeight || 1) * 0.85;
      }catch(e){ return false; }
    }
    function topOverlay(){
      var kids = document.body ? document.body.children : [], best = null, bestZ = -Infinity;
      for(var i = 0; i < kids.length; i++){
        var el = kids[i]; if(!shown(el)) continue;
        var z = parseInt(getComputedStyle(el).zIndex, 10); if(!isFinite(z)) z = 0;
        if(z >= bestZ){ best = el; bestZ = z; }   /* 同层取后挂上去的（在上面） */
      }
      return best;
    }
    function closeButton(el){
      var sel = Object.prototype.hasOwnProperty.call(KNOWN, el.id) ? KNOWN[el.id] : undefined;
      if(sel === null) return el;
      if(typeof sel === 'function') return null;
      if(sel){ var k = el.querySelector(sel); if(k) return k; }
      var c = el.querySelectorAll('button,[role="button"],[aria-label],[onclick],div,span,a');
      for(var i = 0; i < c.length && i < 400; i++){
        var b = c[i], lab = b.getAttribute('aria-label') || '', oc = b.getAttribute('onclick') || '', id = b.id || '';
        var txt = (b.children.length ? '' : (b.textContent || '').trim());
        if(/^(?:关闭|返回|close)$/i.test(lab) || /(?:^|_)close/i.test(id) || /Close$/.test(id) || /_close\w*\(|\bclose\w*\(/i.test(oc) || CLOSE_TEXT.test(txt)) {
          if(b.getClientRects().length) return b;
        }
      }
      return null;
    }
    function closeEl(el){
      if(!shown(el)) return false;   /* 它已经关了：让返回键去管下一层 */
      var own = Object.prototype.hasOwnProperty.call(KNOWN, el.id) ? KNOWN[el.id] : undefined;
      if(typeof own === 'function'){ try{ return own(el) === true; }catch(e){ return false; } }
      var b = closeButton(el);
      try{ (b || el).click(); }catch(e){}
      /* 没有关闭按钮、点空白处也关不掉：不拿掉（拿掉不等于关掉，模块的收尾没做），这一下交给返回键的下一步 */
      if(!b && shown(el)) return false;
      return true;
    }
    function closeTop(){ var el = topOverlay(); return el ? closeEl(el) : false; }
    function pushBack(fn){
      if(typeof window.__hsnPushBack === 'function') return window.__hsnPushBack(fn);
      var st = window.__hsnBackStack = window.__hsnBackStack || [];
      st.push(fn);
      return function(){ var i = st.lastIndexOf(fn); if(i >= 0) st.splice(i, 1); };
    }
    var tracked = [];   /* {el, unreg} —— 每个开着的浮层在栈里占一格（后开的在上面），按一次返回关一个 */
    function track(el){
      for(var i = 0; i < tracked.length; i++) if(tracked[i].el === el) return;
      var t = { el: el, unreg: null };
      var fn = function(){
        var r = closeEl(el);
        /* 返回键用掉了这一下、浮层却还开着（比如对战中先提醒「再按一次」）：重新登记，下一次返回还先问它。
           返回 false 的不重新登记（岛页 __hsnIslandBack 会接着问下一个，重新登记会原地打转） */
        if(r === true && shown(el)) t.unreg = pushBack(fn);
        else tracked = tracked.filter(function(x){ return x !== t; });
        return r;
      };
      t.unreg = pushBack(fn);
      tracked.push(t);
    }
    function untrack(el){
      tracked = tracked.filter(function(t){ if(t.el !== el) return true; try{ t.unreg(); }catch(e){} return false; });
    }
    var toggles = typeof WeakSet === 'function' ? new WeakSet() : null;
    function check(el){
      if(shown(el)) track(el); else untrack(el);
      /* 用 class/style 开关的浮层（比如装备商店）：盯住它自己的开关 */
      if(toggles && shown(el) && !toggles.has(el)){
        toggles.add(el);
        try{ new MutationObserver(function(){ check(el); }).observe(el, { attributes: true, attributeFilter: ['class', 'style'] }); }catch(e){}
      }
    }
    function start(){
      if(!document.body || typeof MutationObserver !== 'function') return;
      new MutationObserver(function(muts){
        muts.forEach(function(m){
          Array.prototype.forEach.call(m.removedNodes, function(n){ if(n.nodeType === 1) untrack(n); });
          Array.prototype.forEach.call(m.addedNodes, function(n){ if(n.nodeType === 1) setTimeout(function(){ check(n); }, 0); });
        });
      }).observe(document.body, { childList: true });
    }
    window.__hsnBackOverlays = { top: topOverlay, closeTop: closeTop, _tracked: function(){ return tracked.map(function(t){ return t.el.id || t.el.className || t.el.tagName; }); } };
    if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  })();
})();
