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

  /* ---- 双端: 跨文档平滑过渡(②) ---- */
  try{
    var st = document.createElement('style');
    st.textContent = '@view-transition{navigation:auto}'
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
        if(window.parent.closeIsland){
          window.parent.closeIsland();
          return false;
        }
      }
    }catch(e){}
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
})();
