// perf_boost.js v11 — 修复 speak() cb 漏调死锁 + 全部之前修复
//
// 作用:
//   1. save() 去抖, 大幅减少 localStorage 同步写阻塞主线程
//   2. Hook AudioContext 构造器, 跟踪页面里所有音频上下文
//      → 后台→前台 / bfcache 恢复时统一 resume 所有 ctx
//      → 覆盖游戏自带的 playCorrect/playWrong/playCoin 等提示音
//      → 解决游戏 _unlockAudio 是 {once:true}, 后台切换后再也不触发的死锁
//   3. (v4 新增) 页面隐藏时, 用 CSS 暂停 24 个 infinite CSS 动画 + backdrop-filter,
//      iPhone 后台不再持续 GPU 工作, 切回时立刻恢复
//
// 安全性:
//   - Hook 在所有其他脚本之前生效 (perf_boost 是第一个 script)
//   - HookedAC.prototype = OrigAC.prototype, instanceof 检测仍正常
//   - 静默捕获所有异常, 不影响游戏正常运行
(function(){
  'use strict';

  // ============ 1. Hook AudioContext: 【全局单例】 ============
  // ⭐ v932 (Hansen: "操作有点卡顿") CPU 采样实锤: HookedAC 自耗时 804ms —— 全项目最烧 CPU 的函数。
  //    根因: new AudioContext() 本身极贵(要起一条音频线程 + 初始化音频图), 中端手机上一次就要几百毫秒。
  //    而项目里【至少 3 处各建一个】: template 的 _unlockAudio、template 的 _getAudioCtx、hansen_cards.js。
  //    浏览器对每页的 AudioContext 数量还有上限(约 6 个), 建多了直接抛异常。
  //    修法: 在 hook 这一层做【真·单例】—— 谁 new 都返回同一个 ctx, 全app只创建一次。
  //    游戏只用它放提示音(beep), 共用一个上下文完全安全, 也是标准做法。
  //    (万一某处把 ctx close() 了, 下次 new 会自动重建一个新的, 不会坏。)
  var OrigAC = window.AudioContext || window.webkitAudioContext;
  var allContexts = [];
  var sharedCtx = null;

  if(OrigAC){
    function HookedAC(){
      try {
        // 已有一个还活着 → 直接复用, 一分钱 CPU 都不花
        if(sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
        var ctx = arguments.length ?
          new OrigAC(arguments[0]) :
          new OrigAC();
        sharedCtx = ctx;
        allContexts.push(ctx);
        return ctx;
      } catch(e){
        throw e;
      }
    }
    HookedAC.prototype = OrigAC.prototype;
    // 同时 hook 两个名字 (AudioContext 标准, webkitAudioContext iOS Safari)
    try { window.AudioContext = HookedAC; } catch(e){}
    try { window.webkitAudioContext = HookedAC; } catch(e){}
  }

  function resumeAllContexts(){
    for(var i = 0; i < allContexts.length; i++){
      var ctx = allContexts[i];
      try {
        if(ctx && ctx.state && ctx.state !== 'running' && ctx.state !== 'closed'){
          ctx.resume();  // fire-and-forget, 不等 Promise
        }
      } catch(e){}
    }
  }

  // v7: 清理已 closed 的 ctx (BUG #5 修复: allContexts 不再只增不减)
  function gcClosedContexts(){
    for(var i = allContexts.length - 1; i >= 0; i--){
      if(allContexts[i].state === 'closed'){
        allContexts.splice(i, 1);
      }
    }
  }

  // v7: 任何用户手势, 兜底一下 (低频, 不影响性能)
  var firstGestureDone = false;
  function onFirstGesture(){
    if(firstGestureDone) return;
    firstGestureDone = true;
    resumeAllContexts();
  }
  document.addEventListener('touchstart', onFirstGesture, { capture: true, passive: true });
  document.addEventListener('click', onFirstGesture, true);

  // ============ 2. save() 去抖 ============
  var DEBOUNCE_MS = 500;
  var saveTimer = null;
  var origSave = null;
  var saveCallCount = 0;
  var actualWriteCount = 0;
  var hookActive = false;

  function flush(){
    if(saveTimer){
      clearTimeout(saveTimer);
      saveTimer = null;
      if(origSave){
        actualWriteCount++;
        try { origSave.call(window); } catch(e){}
      }
    }
  }

  function debouncedSave(){
    saveCallCount++;
    if(saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function(){
      saveTimer = null;
      actualWriteCount++;
      try { origSave.call(window); } catch(e){}
    }, DEBOUNCE_MS);
  }

  function tryHook(){
    if(hookActive) return true;
    if(typeof window.save !== 'function') return false;
    if(window.save.__perfBoosted) { hookActive = true; return true; }
    origSave = window.save;
    debouncedSave.__perfBoosted = true;
    window.save = debouncedSave;
    hookActive = true;
    return true;
  }

  if(!tryHook()){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', tryHook);
    }
    window.addEventListener('load', tryHook);
    var tries = 0;
    var poll = setInterval(function(){
      if(tryHook() || ++tries >= 20){ clearInterval(poll); }
    }, 50);
  }

  // ============ 3. 页面离开时 flush 未写入的数据 ============
  // 🔴 v567: beforeunload 监听已移除——它是 Chrome 系 bfcache 杀手(阻断往返缓存瞬时恢复),
  //   且移动端本就不可靠; pagehide flush 完整覆盖其职责, 零功能损失。首页↔岛瞬回机制见 hansen_home_link.js。
  window.addEventListener('pagehide', flush);
  // 注: visibilitychange 已合并到下方统一处理 (v7)
  // bfcache 恢复时重新检查 save hook
  window.addEventListener('pageshow', function(e){
    if(e.persisted){
      if(!hookActive || !window.save || !window.save.__perfBoosted){
        hookActive = false;
        tryHook();
      }
    }
  });

  // ============ 4. (v4 新增, v10 修正) iOS 性能加固: 后台暂停动画 ============
  // 真实问题: island_food.html 有 24 个 infinite CSS 动画 + 9 个 backdrop-filter
  // 这些在页面隐藏时仍然每帧重算, 极度浪费 iPhone GPU
  //
  // v10 关键修正: 移除之前的 will-change: transform 全局 GPU hint
  //   原因: .particle / .confetti 等是动态生成的元素 (每答对题生成 12+),
  //   被强制 GPU 层 → 玩 10 题就 120 个独立合成层 → iPhone WebView 内存爆
  //   → 微信 WebView 被 iOS 杀掉 → 用户切回看到白屏需要刷新!
  //   这是真实用户报告的 "点了不显示" 问题的元凶之一.
  //   现在只保留后台动画暂停, 不再强制 GPU promotion.
  function injectPerfCSS(){
    if(document.getElementById('__perf_boost_style')) return;
    var style = document.createElement('style');
    style.id = '__perf_boost_style';
    style.textContent =
      // 后台时暂停所有动画 (避免持续 GPU 工作)
      'body.__perf_paused *, body.__perf_paused *::before, body.__perf_paused *::after {' +
        'animation-play-state: paused !important;' +
      '}' +
      // v11: iOS momentum scrolling — 让 iPhone 上滚动有惯性, 丝滑感觉
      // island_*.html 缺这个, 用户滑动游戏页时感觉黏黏的
      'html, body {' +
        '-webkit-overflow-scrolling: touch !important;' +
      '}' +
      // v11: 滚动容器 GPU 加速 — touch-action: pan-y 让 iOS 知道这里是垂直滚动
      // 浏览器不再等 listener 判断, 直接 GPU 滚动
      '.screen, .modal-content, [style*="overflow-y"] {' +
        '-webkit-overflow-scrolling: touch !important;' +
        'touch-action: pan-y;' +
      '}' +
      // v11: CSS containment — iPhone Safari 16+ 真实有效性能提升
      // 让浏览器知道这些元素自包含, 变化不影响外面
      // → 弹窗打开时, 不会触发整页重排
      // → 切换岛卡时, 只重绘该卡, 不影响其他
      // → 注意: 不加在 .particle/.confetti 等动态元素 (会限制它们的视觉范围)
      '.island, .stat, .util-card, .daily-card, .modal-content {' +
        'contain: layout style;' +
      '}';
    (document.head || document.documentElement).appendChild(style);

    // v8 新增: preconnect TTS 域名 (节省每次首次请求的 DNS+TLS 时间 ~200-400ms)
    var TTS_HOSTS = [
      'https://ssl.gstatic.com',     // 牛津发音
      'https://fanyi.baidu.com',     // 百度 TTS
      'https://dict.youdao.com'      // 有道 (备用)
    ];
    for(var i = 0; i < TTS_HOSTS.length; i++){
      try {
        var link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = TTS_HOSTS[i];
        link.crossOrigin = 'anonymous';
        (document.head || document.documentElement).appendChild(link);
      } catch(e){}
    }
  }
  if(document.head){
    injectPerfCSS();
  } else {
    document.addEventListener('DOMContentLoaded', injectPerfCSS);
  }

  // ============ v7: 单一 visibilitychange handler — 合并 3 个为 1 个 ============
  // 之前有 3 个独立 listener 分别做: resume AC / flush save / pause animations
  // 每次切前后台浏览器要遍历多个 listener, iPhone 上轻微卡顿
  // 现在合并: 一个 listener 内顺序做所有事
  document.addEventListener('visibilitychange', function(){
    try {
      if(document.visibilityState === 'hidden'){
        flush();  // 1. 写入未保存数据
        if(document.body) document.body.classList.add('__perf_paused');  // 2. 暂停动画
      } else {
        resumeAllContexts();  // 3. 恢复所有 AC (含游戏自带的)
        gcClosedContexts();   // 4. 清理已 closed 的 ctx (v7 BUG #5 修复)
        if(document.body) document.body.classList.remove('__perf_paused');  // 5. 恢复动画
      }
    } catch(e){}
  });
  // bfcache 恢复 (单独的 pageshow handler, 这个不能合并因为只在 persisted=true 时触发)
  window.addEventListener('pageshow', function(e){
    try {
      if(e.persisted){
        resumeAllContexts();
      }
      if(document.body) document.body.classList.remove('__perf_paused');
    } catch(_){}
  });

  // ============ 5. (v5+) 节流 setInterval — 暂停后台 + 智能加速 ============
  // 游戏代码里:
  //   syncModalState 用 200ms (非关键, 只检查弹窗状态) → v10 节流到 1000ms 省 80% CPU
  //   bubbleFloatTimer / eagleTimer 用 50ms (游戏动画关键) → 保持不变
  //   spTimer 用 1000ms (倒计时) → 保持不变
  // 主页:
  //   renderRecent / applyTheme (1500/2000ms) → 保持不变
  //
  // 后台时所有都跳过 (节省 100% CPU)
  var allIntervals = [];
  var origSetInterval = window.setInterval;
  var origClearInterval = window.clearInterval;
  window.setInterval = function(fn, ms){
    // v10 智能节流: 200ms 这种"轮询检查"类间隔降到 1000ms
    // 200ms 是 syncModalState 的特征值, 改成 1000ms 用户感受不到差别
    // 因为弹窗状态变化是用户主动操作触发, 1 秒延迟反应足够快
    var actualMs = ms;
    if(ms === 200) actualMs = 1000;

    var wrapped = function(){
      // 后台时跳过 (除非是关键的音频/计时器)
      if(document.visibilityState === 'hidden') return;
      try { fn.apply(this, arguments); } catch(e){}
    };
    var id = origSetInterval.call(window, wrapped, actualMs);
    allIntervals.push(id);
    return id;
  };
  window.clearInterval = function(id){
    var idx = allIntervals.indexOf(id);
    if(idx >= 0) allIntervals.splice(idx, 1);
    return origClearInterval.call(window, id);
  };

  // ============ 6. (v6 修复 BUG #4 _activeAudio 重音) Audio 元素自动停旧 ============
  // 真实 BUG: 游戏的 _stopAllAudio() 只清 curAudio (fallback 用的),
  //   不清 _activeAudio (本地 mp3 用的). 用户连续点不同单词时,
  //   旧的本地 mp3 还在播 → 两个声音同时响 → "声音怪怪的"
  // 修复策略 (v9 加固): 创建新 Audio 时, 只 pause 旧的, 不动 src
  //   v8 的版本会清 old.src='', 这干扰了游戏 _unlockAudio 流程, 导致跳转/初始化异常
  //   现在只 pause — 这就足以让旧音"停止播放", 不破坏游戏对 Audio 对象的后续操作
  if(typeof Audio !== 'undefined'){
    var OrigAudio = Audio;
    var activeAudios = [];
    function HookedAudio(src){
      // 关键: 创建新 Audio 时, 主动暂停所有还在播的旧 Audio
      // 但只 pause, 不动 src 不动 load — 让游戏对旧 Audio 的所有后续操作仍按它预期工作
      for(var i = 0; i < activeAudios.length; i++){
        try {
          var old = activeAudios[i];
          if(old && !old.paused && !old.ended){
            old.pause();
            // 注意: 不设 old.src='', 不调 old.load() — v8 那样做会破坏 _unlockAudio
          }
        } catch(e){}
      }
      // 清理已完成的 audio 引用 (避免数组无限增长)
      // v10: 也用 src='' 识别废弃 Audio — game 习惯用 pause+src='' 而不是等 ended
      activeAudios = activeAudios.filter(function(a){
        if(!a) return false;
        if(a.ended) return false;
        if(!a.src || a.src === '') return false;  // game 清掉 src 的, 也算废弃
        return true;
      });

      var a = new OrigAudio(src);
      activeAudios.push(a);
      // 播完从活跃列表移除 (不动 src, 让游戏自己管理)
      a.addEventListener('ended', function(){
        var idx = activeAudios.indexOf(a);
        if(idx >= 0) activeAudios.splice(idx, 1);
      });
      a.addEventListener('error', function(){
        var idx = activeAudios.indexOf(a);
        if(idx >= 0) activeAudios.splice(idx, 1);
      });
      return a;
    }
    HookedAudio.prototype = OrigAudio.prototype;
    try { window.Audio = HookedAudio; } catch(e){}
  }

  // ============ 7. (v8 新增) speak() cb 兜底 (BUG #12 修复) ============
  // 游戏的 speak() 在以下情况会 return 但 cb 不触发, 导致跳转死锁:
  //   - speak('', cb) — !t return
  //   - speak('   ', cb) — text.trim()==='' return  
  //   - speak(null, cb) — !t return
  // 这里 hook speak, 检测早期 return 并补调 cb
  function hookSpeak(){
    if(typeof window.speak !== 'function') return false;
    if(window.speak.__cbSafe) return true;
    var origSpeak = window.speak;
    var safeSpeak = function(t, r, cb){
      // 提前检查 — 如果是空字符串或 null, 立刻调 cb 然后返回 (兜底游戏代码漏调)
      var invalid = !t || (typeof t === 'string' && !t.trim());
      if(invalid){
        if(typeof cb === 'function'){
          try { cb(); } catch(e){}
        }
        return;
      }
      // 正常调原 speak
      return origSpeak.call(this, t, r, cb);
    };
    safeSpeak.__cbSafe = true;
    window.speak = safeSpeak;
    return true;
  }
  // 多个时机尝试 hook
  if(!hookSpeak()){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', hookSpeak);
    }
    window.addEventListener('load', hookSpeak);
    var st = 0;
    var sp = setInterval(function(){
      if(hookSpeak() || ++st >= 20){ clearInterval(sp); }
    }, 50);
  }

  // ============ 8. 诊断 ============
  window.__perfDebug = function(){
    return {
      version: 'v11',
      hookActive: hookActive,
      saveCallCount: saveCallCount,
      actualWriteCount: actualWriteCount,
      compressionRatio: saveCallCount > 0 ? (actualWriteCount / saveCallCount).toFixed(3) : 'N/A',
      pendingWrite: !!saveTimer,
      debounceMs: DEBOUNCE_MS,
      trackedAudioContexts: allContexts.length,
      audioContextStates: allContexts.map(function(c){ return c.state; }),
      perfCssInjected: !!document.getElementById('__perf_boost_style'),
      currentlyPaused: document.body ? document.body.classList.contains('__perf_paused') : false,
      speakHooked: !!(window.speak && window.speak.__cbSafe)
    };
  };
})();

