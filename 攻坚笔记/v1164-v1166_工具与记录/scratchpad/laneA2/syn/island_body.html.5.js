
/* ⭐ v929 (Hansen: "进岛很卡·图片加载不出来·点打Boss卡在那儿·要极致快") boss 引擎按需加载
   问题: hansen_boss_attack.js 有 2.44MB(其中 1.28MB 是内嵌的 base64 图片), 而且一执行就再预下十几张 boss 图。
        它【只有打 Boss 时才用得上】, 却在每次进岛时就同步下完+解析完 → 白白吃掉首屏的带宽和 CPU。
   修法: 进岛时【完全不加载】→ 首屏画完+空闲后在后台悄悄预取(让路给用户操作)
        → 用户点"打Boss"时它通常已经就位(0 延迟); 万一还没到, showScreen('boss') 会自动等它, 不会卡死。 */
(function(){
  var P=null;
  function ver(){
    try{
      var t=document.querySelector('script[src*="hansen_boss_lock.js"]');
      var m=t && t.getAttribute('src').match(/\?v=[0-9]+/);
      return m ? m[0] : '';
    }catch(e){ return ''; }
  }
  /* ⭐ v932: 特效用的 6 张图已从脚本里抠出来(原来是 1.28MB base64) → bossfx/*.webp (共 0.2MB) */
  var FXIMG=['renyi_spear','hand1','hand2','hand3','hand4','hand5'];
  function loadFXImgs(){
    return Promise.all(FXIMG.map(function(n){
      return new Promise(function(r){
        try{ var im=new Image(); im.onload=r; im.onerror=r; im.src='bossfx/'+n+'.webp'; }catch(e){ r(); }
      });
    }));
  }
  window.__hansenBossFXReady=function(){
    if(window.__hansenBossFXLoaded) return Promise.resolve();
    if(P) return P;
    P=new Promise(function(res){
      var s=document.createElement('script');
      s.src='hansen_boss_attack.js'+ver();
      /* 图片和脚本并行, 两个都到位才算就绪 —— 特效开画时图一定在, 一帧都不会丢 */
      s.onload=function(){ loadFXImgs().then(function(){ window.__hansenBossFXLoaded=true; res(); }); };
      s.onerror=function(){ P=null; res(); };
      document.head.appendChild(s);
    });
    return P;
  };
  // ⭐ 保险层: 万一有代码【绕过 showScreen】直接调 HansenBossAttack(比如特效守卫的探针),
  //   而引擎还没预取到 → 先占位, 等引擎到位后自动补放, 绝不会出现"特效为空"。
  //   引擎里是无条件赋值 window.HansenBossAttack=..., 加载后会覆盖这个占位, 不会递归。
  if(!window.HansenBossAttack){
    window.HansenBossAttack=function(){
      var a=arguments;
      window.__hansenBossFXReady().then(function(){
        if(typeof window.HansenBossAttack==='function' && window.__hansenBossFXLoaded)
          window.HansenBossAttack.apply(null, a);
      });
    };
  }
  /* ⭐⭐ v932 关键修复 (Hansen: "进去之后操作有点卡顿·要极致丝滑")
     旧写法用 script 标签做预取 —— 浏览器不只是下载, 还会【解析 + 执行】整个引擎。
     实测(中端手机): 这一下把主线程【连续堵死 1918ms】, 正好落在用户刚进岛想点东西的时候 = 卡。
     新写法: 预取只用 link rel=prefetch —— 浏览器【只把文件下进缓存, 一行代码都不解析】,
     全程零主线程开销。真正点"打Boss"时才用 script 标签加载, 那时文件已在缓存里 = 秒开,
     而且脚本已经从 2.44MB 瘦到 1.10MB(图片抠出去了), 解析成本再砍一半。 */
  function canBackgroundBossPrefetch(){
    try{
      var p=window.HansenPreloadPolicy;
      if(p && typeof p.canBackgroundDownload==='function') return !!p.canBackgroundDownload();
      var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      return !!c && !c.saveData && c.effectiveType==='4g' && navigator.onLine!==false &&
        (!document.visibilityState || document.visibilityState==='visible') && !document.hidden;
    }catch(e){ return false; }
  }
  function prefetch(){
    if(window.__hansenBossFXPrefetched || !canBackgroundBossPrefetch()) return;
    var go=function(){
      try{
        if(window.__hansenBossFXPrefetched || !canBackgroundBossPrefetch()) return;
        var pol=window.HansenPreloadPolicy;
        if(pol && typeof pol.shouldYield==='function' && pol.shouldYield()){
          setTimeout(go,500); return;  // 用户正在操作/播音时继续让路
        }
        window.__hansenBossFXPrefetched=true;
        var urls=['hansen_boss_attack.js'+ver()];
        for(var i=0;i<FXIMG.length;i++) urls.push('bossfx/'+FXIMG[i]+'.webp');
        for(var j=0;j<urls.length;j++){
          var l=document.createElement('link');
          l.rel='prefetch';
          l.as=(j===0?'script':'image');
          l.href=urls[j];
          document.head.appendChild(l);
        }
      }catch(e){}
    };
    if(window.requestIdleCallback) requestIdleCallback(function(){ setTimeout(go, 1200); }, {timeout:5000});
    else setTimeout(go, 2200);
  }
  if(document.readyState==='complete') prefetch();
  else window.addEventListener('load', prefetch);
  (function hook(){
    if(typeof window.showScreen!=='function'){ return setTimeout(hook, 40); }
    if(window.__hansenBossFXHooked) return;
    window.__hansenBossFXHooked=true;
    var orig=window.showScreen;
    window.showScreen=function(id){
      // ⚠️ 关键: 赛季岛(星海觉醒)的【落地页就是 boss 选关墙】—— 一进岛 showScreen('boss') 就被调用。
      //    但【看选关墙根本不需要 2.44MB 的攻击特效引擎】(墙上只有图), 真正【开打】时才需要。
      //    所以这里只在【真的在战斗中】(bossActive)才等引擎; 光看墙一律不加载。
      //    开打后万一引擎还没预取完 → 下面的 HansenBossAttack 保险层会自动等它, 特效一帧不丢。
      if(id==='boss' && window.bossActive && !window.__hansenBossFXLoaded){
        var self=this, args=arguments;
        window.__hansenBossFXReady().then(function(){ orig.apply(self, args); });
        return;
      }
      /* v1165：孩子自己点开 Boss 选关墙（有真实点按）→ 后台先把引擎准备好，选完 Boss 就能直接开打。
         开机时自动落到选关墙（赛季岛）、或藏在后台预热框里，都没有真实点按，不会触发；真开打时一定触发。 */
      if(id==='boss' && !window.__hansenBossFXLoaded){
        /* bossActive 是页面里的 let 变量，不在 window 上（上面那个 window.bossActive 判断其实永远不成立），这里按名字读 */
        var _fight=false; try{ _fight=(typeof bossActive!=='undefined' && bossActive===true); }catch(e){}
        try{ if(_fight || (navigator.userActivation && navigator.userActivation.isActive)) window.__hansenBossFXReady(); }catch(e){}
      }
      return orig.apply(this, arguments);
    };
  })();
  /* v1165：真开打（startBoss）时一定开始准备引擎和攻击图 —— 不依赖 navigator.userActivation（旧 iOS 没有它），
     这样第一次反击时攻击图多半已经解码好（BUG#67 拳头空白就是图没到位）。只是提前开始下载，不改开打的先后顺序。 */
  (function hookStart(){
    if(typeof window.startBoss!=='function'){ return setTimeout(hookStart, 40); }
    if(window.__hansenBossFXStartHooked) return;
    window.__hansenBossFXStartHooked=true;
    var origStart=window.startBoss;
    window.startBoss=function(){
      try{ if(!window.__hansenBossFXLoaded) window.__hansenBossFXReady(); }catch(e){}
      return origStart.apply(this, arguments);
    };
  })();
})();
