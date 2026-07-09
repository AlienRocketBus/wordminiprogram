// hansen_preload.js v1 — 进入小程序即在后台预加载所有内容 (图片 + 声音)
//
// 目的:
//   后台预载资源进浏览器缓存, 让玩的时候图片/发音立刻就在。
//   v401 起改为"礼让式预载": 绝不和用户的点击抢带宽 —— 用户一碰屏幕,
//   预载立刻让路 1.5 秒, 把网速全让给"点击发音", 点了就马上响。
//   · boss 图 (20 张, 轻): 进页面就预载, 保证 boss 战秒出图。
//   · 单词发音 (小): 温柔预载 (并发仅 2) 且随时给用户让路, 很快全进缓存。
//   · 句子例句 (709 个 / 14M, 曾是首屏卡顿元凶): 开头【不】预载,
//     改"用到哪句下哪句" (island 的 speak 现下现播; 一个小文件, 那时路是空的, 眨眼就好)。
//
// 关键: 预加载的 URL 必须和游戏真正请求的 URL 完全一致 (含 ?v 后缀),
//   否则浏览器当成两个不同 URL, 缓存不命中 = 白下载。
//   - boss 图:  bosses/lvNN.png?v=<当前版本>   (?v= 随 build 同步, 这里从自己的 script 标签动态读, 永远匹配)
//   - 单词 mp3: words/XXX.mp3?v215             (游戏里写死 ?v215, 见 island 的 speak)
//   - 句子 mp3: sentences/sentence_NNNN.mp3?v91 (游戏里写死 ?v91, 见 island 的 speak)
//
// 安全: 全程静默 try/catch, 后台跑 (requestIdleCallback/延迟), 不阻塞首屏渲染;
//   只读不写游戏状态; 失败的文件自动跳过, 绝不影响游戏正常运行。
(function(){
  'use strict';

  // ───────── 礼让机制 (v401): 用户一碰屏幕就暂停预载, 把网速全让给"点击发音" ─────────
  var PAUSE_MS = 1500;            // 用户每次触屏后, 预载让路这么久 (毫秒)
  var pausedUntil = 0;
  var _batches = [];              // 活跃预载批次的"立刻让路"回调 (碰屏即中止在途下载)
  function userActive(){
    pausedUntil = Date.now() + PAUSE_MS;
    try { window.__hansenUserActiveUntil = pausedUntil; } catch(e){}   // hansen_cards.js 的预载也读它一起让路
    for(var i = _batches.length - 1; i >= 0; i--){ try { _batches[i](); } catch(e){} }  // 立刻中止在途下载, 把整条带宽瞬间让给点击
  }

  // ───────── 音频播放优先 (v433): 任何 words/sentences 音频正在播 → 后台预载彻底停, 整条带宽全让给它, 直到播完 ─────────
  //   解决"点例句读一半卡住": 例句是较大 mp3, 边下边播时若被 boss 图/单词预载抢带宽, 缓冲会断 → 卡住(不报错也不结束)。
  //   做法: 包装 window.Audio —— 凡 new Audio(url) 播 words/sentences 的, 挂【被动】监听其 play/playing/waiting → 进"音频忙",
  //   ended/pause/error → 退出。音频忙期间 pump 与 boss 预载都停 + 立刻中止在途。30s 封顶自动解除(防 ended 没触发卡死)。
  //   ★只加被动监听、原样返回原生 Audio, 不改任何播放行为 = 零 gameplay 风险(预热没覆盖也只是稍慢, 绝不会不响)。
  var audioBusyUntil = 0;
  function enterAudioBusy(){
    audioBusyUntil = Date.now() + 30000;
    try { window.__hansenAudioBusyUntil = audioBusyUntil; } catch(e){}   // hansen_cards.js 的预载也读它一起停
    for(var i = _batches.length - 1; i >= 0; i--){ try { _batches[i](); } catch(e){} }  // 立刻中止在途, 把带宽瞬间全留给这段音频
  }
  function exitAudioBusy(){
    audioBusyUntil = 0;
    try { window.__hansenAudioBusyUntil = 0; } catch(e){}
  }
  (function(){   // 包装 Audio: 只给 words/sentences 的播放挂被动监听(读 url 判定, 不碰播放)
    try {
      var OrigAudio = window.Audio;
      if(!OrigAudio) return;
      var MEDIA = /(?:^|\/)(?:words|sentences)\/[^?]+\.mp3/i;
      function W(src){
        var a = (arguments.length && src !== undefined) ? new OrigAudio(src) : new OrigAudio();
        try {
          if(src && MEDIA.test(String(src))){
            enterAudioBusy();   // ★创建即进忙: 不等 loadstart/playing(可能在挂监听前已触发), 立刻把整条带宽腾给它(堵住开头 ~400ms 仍被预载抢的缺口)
            a.addEventListener('loadstart', enterAudioBusy);
            a.addEventListener('play',      enterAudioBusy);
            a.addEventListener('playing',   enterAudioBusy);
            a.addEventListener('waiting',   enterAudioBusy);   // 缓冲不足 → 继续把带宽全留给它直到它恢复
            a.addEventListener('ended',     exitAudioBusy);
            a.addEventListener('pause',     exitAudioBusy);
            a.addEventListener('error',     exitAudioBusy);
          }
        } catch(e){}
        return a;
      }
      try { W.prototype = OrigAudio.prototype; } catch(e){}
      window.Audio = W;
    } catch(e){}
  })();

  try {
    // 捕获阶段 + passive: 只记一个时间戳, 绝不干扰游戏自身的任何点击/触摸处理
    document.addEventListener('pointerdown', userActive, { capture: true, passive: true });
    document.addEventListener('touchstart',  userActive, { capture: true, passive: true });
  } catch(e){}

  // ───────── 读当前版本号 (boss 图 ?v= 用, 和页面其他 ?v= 一致) ─────────
  var V = '';
  try {
    var mySrc = (document.currentScript && document.currentScript.src) || '';
    var m = mySrc.match(/[?&]v=(\d+)/);
    if(m) V = m[1];
  } catch(e){}
  if(!V){
    // 兜底: 从任意带 ?v= 的 script 标签取
    try {
      var ss = document.getElementsByTagName('script');
      for(var i=0;i<ss.length;i++){
        var mm = (ss[i].src||'').match(/[?&]v=(\d+)/);
        if(mm){ V = mm[1]; break; }
      }
    } catch(e){}
  }
  var BOSS_VER = V ? ('?v=' + V) : '';
  var WORD_VER = '?v215';   // 必须和游戏 island 里 speak 的单词 mp3 后缀一致
  var SENT_VER = '?v91';    // 必须和游戏 island 里 speak 的句子 mp3 后缀一致

  // ───────── 1. boss 图 (最高优先级, 修复 boss 战先显示文字) ─────────
  var _imgRefs = [];
  // 扫所有岛存档, 取已解锁的最高 boss 等级 (只读, 绝不写; 任何异常都回退默认值 1)
  function maxBossUnlocked(){
    var mx = 1;
    try {
      for(var j = 0; j < localStorage.length; j++){
        var k = localStorage.key(j);
        if(!k || k.indexOf('wordIsland') !== 0) continue;   // 只看岛存档键 wordIsland<Name>
        try {
          var st = JSON.parse(localStorage.getItem(k) || 'null');
          if(st && typeof st.bossUnlocked === 'number' && st.bossUnlocked > mx) mx = st.bossUnlocked;
        } catch(e){}
      }
    } catch(e){}
    if(mx < 1) mx = 1; if(mx > 20) mx = 20;
    return mx;
  }
  // ───────── 🔴BUG#88 进岛专用让路: openIsland 设 window.__hsnIslandBusyUntil → 预载(boss图+单词音频)一起暂停, 把整条带宽全留给 iframe 下 HTML/44JS/图标, 揭岛后再过2.5s才恢复 (根治"进岛黑屏/图标半天刷不出来": 持久首页外壳的16MB预载会和进岛资源抢带宽) ─────────
  function _holdUntil(){
    var u = (pausedUntil > audioBusyUntil ? pausedUntil : audioBusyUntil);
    try { var iu = window.__hsnIslandBusyUntil || 0; if(iu > u) u = iu; } catch(e){}
    return u;
  }
  function preloadBossImages(){
    var i = 1;
    // 按章预载: 只预载到"当前进度 + 1 章(+4 关)", 上限 20.
    // 新玩家只预载 lv01-05 (~1MB), 不再一上来就拉全部 17-20 张 (~3.5MB).
    // 没预载到的高级 boss 仍会在进入那场 boss 战时按需加载 (无害, 不影响可玩性).
    var CAP = 20;
    try { CAP = Math.min(20, maxBossUnlocked() + 4); } catch(e){ CAP = 20; }
    function loadNextImg(){
      if(i > CAP) return;
      // 用户正在操作 或 有音频在播 → 让路 (boss 图较大, 更不能和"点击发音/例句"抢带宽)
      var now = Date.now();
      var until = _holdUntil();
      if(now < until){ var d = (until - now) + 80; if(d > 500) d = 500; setTimeout(loadNextImg, d); return; }
      var num = i; i++;
      var n = (num < 10 ? '0' : '') + num;
      var img = new Image();
      _imgRefs.push(img);                   // 持有引用, 防下载中途被 GC 中断
      var go = function(){ setTimeout(loadNextImg, 90); };   // 错开 ~90ms, 一张一张来, 不一次性挤爆
      var rel = function(){                 // 下载完/失败 → 释放 (文件已进 HTTP 缓存)
        var k = _imgRefs.indexOf(img);
        if(k >= 0) _imgRefs[k] = null;
        go();
      };
      img.onload = rel;
      img.onerror = rel;
      try { img.src = 'bosses/lv' + n + '.png' + BOSS_VER; } catch(e){ go(); }
    }
    loadNextImg();
  }

  // ───────── 2. 音频 batched 预加载 (有并发上限) ─────────
  //   礼让升级 (v402): 用户一碰屏幕 → 立刻【中止在途下载】+ 不开新的, 把整条带宽瞬间让给"点发音";
  //   被中止的 URL 放回队首, 等用户停手再优先补下 (绝不丢失, 最终全部进缓存)。
  function preloadAudioBatch(urls, concurrency, onAllDone){
    var queue = urls.slice();      // 待下载
    var active = [];               // 在途 [{a,url}] (持有引用防 GC)
    var pumpTimer = null, finished = false;
    if(!queue.length){ if(onAllDone) onAllDone(); return; }
    function unregister(){
      var ix = _batches.indexOf(yieldNow); if(ix >= 0) _batches.splice(ix, 1);
    }
    function maybeDone(){
      if(!finished && queue.length === 0 && active.length === 0){
        finished = true; unregister(); if(onAllDone) onAllDone();
      }
    }
    function abortActive(){        // 中止在途: 取消请求, URL 放回队首稍后优先补下
      for(var i=0;i<active.length;i++){
        var it = active[i];
        try { it.a.oncanplaythrough = null; it.a.onloadeddata = null; it.a.onerror = null; } catch(e){}
        try { it.a.src = ''; it.a.removeAttribute('src'); it.a.load(); } catch(e){}
        queue.unshift(it.url);
      }
      active = [];
    }
    function yieldNow(){           // 被 userActive 调用 (碰屏): 立刻中止在途 + 安排稍后恢复
      abortActive();
      if(!pumpTimer){ pumpTimer = setTimeout(function(){ pumpTimer = null; pump(); }, PAUSE_MS + 60); }
    }
    function pump(){
      var now = Date.now();
      var until = _holdUntil();   // 触屏让路 或 音频忙 → 取较晚者
      if(now < until){       // 用户正在操作 或 有音频在播 → 把带宽彻底让出来
        if(active.length) abortActive();
        var d = (until - now) + 60; if(d > 500) d = 500;   // 至多 500ms 回查一次: 音频/触屏一结束就尽快恢复预载
        if(!pumpTimer){ pumpTimer = setTimeout(function(){ pumpTimer = null; pump(); }, d); }
        return;
      }
      while(active.length < concurrency && queue.length){
        var url = queue.shift();
        (function(u){
          var a;
          try { a = new Audio(); } catch(e){ setTimeout(pump, 0); return; }
          a.preload = 'auto';
          var rec = { a: a, url: u };
          active.push(rec);
          var done = false;
          var fin = function(){
            if(done) return; done = true;
            var k = active.indexOf(rec); if(k >= 0) active.splice(k, 1);
            maybeDone(); pump();
          };
          a.addEventListener('canplaythrough', fin);
          a.addEventListener('loadeddata', fin);   // 有些浏览器不触发 canplaythrough
          a.addEventListener('error', fin);
          try { a.src = u; a.load(); } catch(e){ fin(); }
        })(url);
      }
      maybeDone();
    }
    _batches.push(yieldNow);
    pump();
  }

  // ───────── 3. 收集音频 URL (自给自足, 不依赖 map; 有 map 则用 map 更准) ─────────
  function getWordUrls(){
    var seen = {}, urls = [];
    function add(rel){
      if(rel && !seen[rel]){ seen[rel] = 1; urls.push(rel + WORD_VER); }
    }
    // 优先: 运行时 WORD_MAP (island 页有)
    try {
      if(window.WORD_MAP){
        for(var k in window.WORD_MAP){
          if(Object.prototype.hasOwnProperty.call(window.WORD_MAP, k)) add(window.WORD_MAP[k]);
        }
      }
    } catch(e){}
    // 兜底/补全: 写死的 29 个单词 mp3 (index.html 没加载 word_map.js)
    var fallback = [
      'words/word_01.mp3','words/word_02.mp3','words/word_03.mp3','words/word_04.mp3','words/word_05.mp3',
      'words/word_06.mp3','words/word_07.mp3','words/word_08.mp3','words/word_09.mp3','words/word_10.mp3',
      'words/word_11.mp3','words/word_12.mp3','words/word_13.mp3','words/word_14.mp3','words/word_15.mp3',
      'words/word_16.mp3','words/word_17.mp3','words/word_18.mp3','words/word_19.mp3','words/word_20.mp3',
      'words/word_21.mp3','words/word_23.mp3','words/word_24.mp3','words/word_25.mp3',
      'words/bed.mp3','words/have.mp3','words/do.mp3','words/cap.mp3','words/gloves.mp3'
    ];
    for(var j=0;j<fallback.length;j++) add(fallback[j]);
    return urls;
  }

  // 本岛单词 (window.allW) 对应的 mp3 — 最高优先级 (玩家真正会点的就这些)
  //   解析口径和各岛 speak() 完全一致: 本地真人表(收官岛, 经 window.__ISLAND_LOCAL_AUDIO 暴露)优先, 再 WORD_MAP。
  //   取到的就是真正会播放的那个文件(收官岛=真人录音; 其余=WORD_MAP), 预热的和播放的 URL 一字不差。
  function getIslandWordUrls(){
    var seen = {}, urls = [];
    try {
      var tbl = window.__ISLAND_LOCAL_AUDIO || null;   // 收官岛暴露的本地真人发音表(和 speak 同一份对象)
      var wm  = window.WORD_MAP || null;
      if(window.allW){
        for(var i=0;i<window.allW.length;i++){
          var w = window.allW[i];
          if(!w || !w.en) continue;
          var lower = String(w.en).toLowerCase();
          var mp3 = (tbl && (tbl[lower] || tbl[w.en])) || (wm && (wm[lower] || wm[w.en]));
          if(mp3 && !seen[mp3]){ seen[mp3] = 1; urls.push(mp3 + WORD_VER); }
        }
      }
    } catch(e){}
    return urls;
  }

  function getSentenceUrls(){
    var urls = [];
    var max = 709;   // 当前句子 mp3 数量 (sentence_0001 ~ sentence_0709)
    // 有 SENTENCE_MAP 则用里面的最大编号 (以后加句子也能自动覆盖)
    try {
      if(window.SENTENCE_MAP){
        var mx = 0;
        for(var k in window.SENTENCE_MAP){
          if(Object.prototype.hasOwnProperty.call(window.SENTENCE_MAP, k)){
            var v = window.SENTENCE_MAP[k];
            if(typeof v === 'number' && v > mx) mx = v;
          }
        }
        if(mx > 0) max = mx;
      }
    } catch(e){}
    for(var i=1;i<=max;i++){
      var s = '' + i;
      while(s.length < 4) s = '0' + s;
      urls.push('sentences/sentence_' + s + '.mp3' + SENT_VER);
    }
    return urls;
  }

  // ───────── 🔴BUG#90 首页外壳预热"进任何岛必下"的资源(秒进根治) ─────────
  //   根因(承接 BUG#87/#88): 每次首次进岛要现下【44个共享脚本 1.9MB(最大 hansen_boss_attack.js 705KB·首页根本没加载) + 首屏~20个图标 + 岛HTML 480KB】→ 这才是进岛黑屏/等待的头号原因。
  //     而旧预载在首页【只】预热 boss图+音频(共~16MB·打boss/背单词才用得到), 偏偏不预热"进任何岛都必须先下"的脚本/图标 = 优先级反了。
  //   做法(仅首页外壳跑·靠 islandFrameWrap 判定; 岛内此函数不跑·脚本本就已加载): 首页空闲时用 fetch 把【44脚本 + 首屏图标 + 19岛HTML】悄悄下进 HTTP 缓存,
  //     URL 与岛真正 <script src>/<img src> 一字不差(含 ?v=) → 用户点岛时 iframe 引用同 URL 直接命中缓存 → readyState 秒到 interactive + 图标已就绪 → 瞬间完整揭开(配合 index.html 揭岛改"图片就绪即瞬时揭开")。
  //   自维护: 脚本/图标清单【从真实岛HTML DOMParse 抽取】(不写死·岛改引用自动跟随), 绝不与岛漂移。
  //   安全: 全程 fetch 只读不放(读 body 确保下全进缓存)·复用同一套礼让(_holdUntil: 碰屏/音频忙立刻让路并中止在途)·失败静默·绝不影响首页与游戏。优先级: 脚本+图标(进岛必须·含705KB) → 19岛HTML(低优先) → boss图(最低·boss战才用)。
  function preheatUrlBatch(urls, concurrency, onAllDone){
    var queue = urls.slice();
    var active = [];               // 在途 [{ctrl}] (AbortController)
    var pumpTimer = null, finished = false;
    if(!queue.length){ if(onAllDone) onAllDone(); return; }
    function unregister(){ var ix = _batches.indexOf(yieldNow); if(ix >= 0) _batches.splice(ix, 1); }
    function maybeDone(){ if(!finished && queue.length === 0 && active.length === 0){ finished = true; unregister(); if(onAllDone) onAllDone(); } }
    function abortActive(){        // 碰屏/音频忙: 中止在途, URL 放回队首稍后补下(绝不丢)
      for(var i=0;i<active.length;i++){ var it = active[i]; try { if(it.ctrl) it.ctrl.abort(); } catch(e){} if(it.url) queue.unshift(it.url); }
      active = [];
    }
    function yieldNow(){ abortActive(); if(!pumpTimer){ pumpTimer = setTimeout(function(){ pumpTimer = null; pump(); }, PAUSE_MS + 60); } }
    function pump(){
      var now = Date.now();
      var until = _holdUntil();   // 触屏让路 或 音频忙 → 取较晚者
      if(now < until){ if(active.length) abortActive(); var d = (until - now) + 60; if(d > 500) d = 500; if(!pumpTimer){ pumpTimer = setTimeout(function(){ pumpTimer = null; pump(); }, d); } return; }
      while(active.length < concurrency && queue.length){
        var url = queue.shift();
        (function(u){
          var ctrl = null; try { ctrl = ('AbortController' in window) ? new AbortController() : null; } catch(e){ ctrl = null; }
          var rec = { ctrl: ctrl, url: u };
          active.push(rec);
          var done = false;
          var fin = function(){ if(done) return; done = true; var k = active.indexOf(rec); if(k >= 0) active.splice(k, 1); maybeDone(); pump(); };
          try {
            fetch(u, ctrl ? { signal: ctrl.signal, credentials: 'same-origin' } : { credentials: 'same-origin' })
              .then(function(r){ return r.blob(); })   // 读完 body → 确保整文件进 HTTP 缓存
              .then(function(){ fin(); })
              .catch(function(){ fin(); });            // 失败/被 abort → 静默(被 abort 的已放回队首)
          } catch(e){ fin(); }
        })(url);
      }
      maybeDone();
    }
    _batches.push(yieldNow);
    pump();
  }

  function preheatIslandEntryResources(onAllDone){
    // 仅首页外壳跑(岛内无 #islandFrameWrap·脚本已加载, 不需也不该重热)
    try { if(!document.getElementById('islandFrameWrap')){ if(onAllDone) onAllDone(); return; } } catch(e){ if(onAllDone) onAllDone(); return; }
    // 🔴BUG#92 宠物图首帧极速:读上次显示的宠物图URL【最高优先·最先】预热(宠物图~300KB是updateHero的JS注入·非静态<img>·下方DOMParse的icons/抽取抽不到→必须单独显式预热)·进岛前已进缓存→岛内早期脚本读同URL填heroPet=首帧瞬时不空白
    try { var _petImg = localStorage.getItem('hansen_pet_hero_img'); if(_petImg){ var _pim = new Image(); try{ _pim.fetchPriority = 'high'; }catch(e){} _pim.src = _petImg; } } catch(e){}
    // 枚举岛文件: 读首页真实链接(openIsland('island_xxx.html'))→ 永远跟随首页实际有的岛
    var islFiles = [];
    try {
      var seen = {}, html = document.body ? document.body.innerHTML : '';
      var re = /island_[a-z]+\.html/g, m;
      while((m = re.exec(html))){ if(!seen[m[0]]){ seen[m[0]] = 1; islFiles.push(m[0]); } }
    } catch(e){}
    if(!islFiles.length){ if(onAllDone) onAllDone(); return; }
    var vq = V ? ('?v=' + V) : '';
    // 抓第一个岛HTML(顺带预热它)→ DOMParse 抽出它引用的全部脚本与首屏图标(自维护·和岛真实引用一字不差)
    fetch(islFiles[0] + vq, { credentials: 'same-origin' }).then(function(r){ return r.text(); }).then(function(htmlText){
      var scripts = [], icons = [];
      try {
        var doc = new DOMParser().parseFromString(htmlText, 'text/html');
        var ss = doc.querySelectorAll('script[src]');
        for(var i=0;i<ss.length;i++){ var s = ss[i].getAttribute('src'); if(s && s.indexOf('.js') !== -1) scripts.push(s); }
        var ims = doc.querySelectorAll('img[src]'); var iseen = {};
        for(var j=0;j<ims.length;j++){ var im = ims[j].getAttribute('src'); if(im && im.indexOf('icons/') === 0 && !iseen[im]){ iseen[im] = 1; icons.push(im); } }
      } catch(e){}
      // 优先: 脚本(进岛必须·含705KB boss_attack) 与 首屏图标(小·消除"图标逐个蹦") 【并行】预热(图标小先下完·用户快速点击时图标也已就绪) → 两者都完了再低优先预热其余岛HTML
      var _pending = 2;
      function _entryDone(){
        if(--_pending !== 0) return;
        var rest = [];
        for(var k = 1; k < islFiles.length; k++){ rest.push(islFiles[k] + vq); }   // 第0个已抓
        preheatUrlBatch(rest, 2, function(){ if(onAllDone) onAllDone(); });
      }
      preheatUrlBatch(scripts, 4, _entryDone);   // 44脚本(1.9MB) 并发4
      preheatUrlBatch(icons, 3, _entryDone);     // 首屏图标 并发3 (与脚本同时跑·小文件很快进缓存)
    }).catch(function(){ if(onAllDone) onAllDone(); });
  }

  // ───────── 启动 ─────────
  var AUDIO_DONE_KEY = 'hansen_audio_preload_done';
  function audioAlreadyDone(){
    try { return sessionStorage.getItem(AUDIO_DONE_KEY) === '1'; } catch(e){ return false; }
  }
  function markAudioDone(){
    try { sessionStorage.setItem(AUDIO_DONE_KEY, '1'); } catch(e){}
  }

  function start(){
    // v432 最优策略: 只预热【本岛真正会播的词】(getIslandWordUrls, 按 speak 同一口径: 本地真人表 ?? WORD_MAP)。
    //   不再后台下载全部 154 词(含你根本没去的岛); 其余单词/句子一律【用到再下】(点哪个下哪个 —— 文件小 + 碰屏即让路, 眨眼就好)。
    //   boss 图仍预热(boss 战每个岛都会用到), 但放在本岛词【之后】、最低优先; HTTP 缓存后续岛命中、不会重下。
    //   全程"碰屏即中止在途 + 让路 1.5s", 点发音永远走空路、最快。
    var run = function(){
      try {
        var inHomeShell = false;
        try { inHomeShell = !!document.getElementById('islandFrameWrap'); } catch(e){}
        if(inHomeShell){
          // 🔴BUG#90 首页外壳: 最高优先预热"进任何岛必下"的44脚本+首屏图标+19岛HTML(秒进根治) → 全部完了再 boss图(最低优先·boss战才用)
          preheatIslandEntryResources(function(){ try { preloadBossImages(); } catch(e){} });
          return;
        }
        // 岛内(原逻辑·零改动): 只预热本岛真正会播的词 → 再 boss图
        var islandWords = getIslandWordUrls();              // 本岛真正会播的词(收官岛=真人文件; 其余=WORD_MAP)
        var afterIsland = function(){ try { preloadBossImages(); } catch(e){} };   // boss 图放最后
        if(islandWords.length){
          preloadAudioBatch(islandWords, 3, afterIsland);   // 先把本岛词喂进缓存, 好了再 boss 图
        } else {
          afterIsland();
        }
      } catch(e){ try { preloadBossImages(); } catch(e2){} }
    };
    if('requestIdleCallback' in window){
      try { requestIdleCallback(run, {timeout: 2500}); } catch(e){ setTimeout(run, 1200); }
    } else {
      setTimeout(run, 1200);
    }
  }

  // 不阻塞首屏: 等页面 load 后稍延迟再开始
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(start, 300);
  } else {
    window.addEventListener('load', function(){ setTimeout(start, 300); });
  }
})();

// ══════════════════════════════════════════════════════════════
// 例句随卡预下载 (v450): 播单词时提前把它的例句 mp3 下进缓存 → 点"例句"秒响
//   根因: 句子是"用到哪句下哪句"(点了才下载) → 点例句有网络延迟。
//   做法: 包裹全局 speak() —— 播一个【单词】(能在 allW 里查到它的 ex)时, 延迟 ~300ms
//         (避让单词本身播放的带宽)后, 用 fetch 把它的例句 sentences/sentence_NNNN.mp3?v91
//         下进浏览器缓存(只下不放)。用 fetch 不用 new Audio → 不触发上面"音频忙"包装,
//         零干扰播放/响度/兜底。单词本身已批量预载+显示时自动播放, 故点单词本就秒响,
//         此处只补"例句"这一环。包裹 window.speak 与 hansen_season.js 包裹 markAnswer 同套做法。
//   只读不写游戏状态; 全程 try/catch; 失败静默, 绝不影响播放。
(function(){
  'use strict';
  if(window.__hsnExPrefetch) return; window.__hsnExPrefetch = true;
  var W2S = null;                          // 单词(小写) → 例句文本
  function buildMap(){
    if(W2S) return W2S;
    var src = null;
    try { src = allW; } catch(e){ try { src = window.allW; } catch(e2){} }
    if(!src || !src.length) return null;   // allW 还没就绪, 下次再建
    var m = {};
    try { for(var i=0;i<src.length;i++){ var w=src[i]; if(w && w.en && w.ex){ m[String(w.en).toLowerCase()] = w.ex; } } } catch(e){}
    W2S = m; return W2S;
  }
  var _warmed = {};                        // 已预取 url 去重
  function warmSentence(ex){
    try{
      if(!ex || !window.SENTENCE_MAP) return;
      var idx = window.SENTENCE_MAP[ex];
      if(idx == null) return;
      var url = 'sentences/sentence_' + String(idx).padStart(4,'0') + '.mp3?v91';
      if(_warmed[url]) return; _warmed[url] = 1;
      fetch(url).then(function(r){ return r.blob(); }).catch(function(){});   // 读完 body 确保下全进缓存
    }catch(e){}
  }
  function tryHook(){
    if(typeof window.speak !== 'function' || window.speak.__hsnExWrapped) return false;
    var orig = window.speak;
    window.speak = function(t, r, cb){
      var ret = orig.apply(this, arguments);   // 先原样播放, 不延迟
      try{
        var text = (t==null) ? '' : String(t).trim().toLowerCase();
        if(text){
          var map = buildMap();
          var ex = map && map[text];           // 只有"单词"能命中(句子文本不在此表)
          if(ex){ setTimeout(function(){ warmSentence(ex); }, 300); }
        }
      }catch(e){}
      return ret;
    };
    window.speak.__hsnExWrapped = true;
    return true;
  }
  if(!tryHook()){
    var n=0, iv=setInterval(function(){ if(tryHook() || ++n>60) clearInterval(iv); }, 100);
  }
})();
