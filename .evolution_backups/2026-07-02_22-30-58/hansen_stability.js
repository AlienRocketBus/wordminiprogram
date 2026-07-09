/* 🔴 v570: hansen_stability.js — 全站稳定性黑匣子(Hansen: 玩着玩着突然崩溃/做题加载不出来, 不知道为什么)。
   定位: 真机偶发崩溃无法复现 → 没有现场就永远修不了。本模块 = 飞行记录仪:
   ① 全局 JS 异常 + 未捕获 Promise 拒绝 → localStorage 环形日志(最近 30 条: 时间/页面/消息/位置)。
   ② 内存压力哨兵(Chrome 系 performance.memory): JS 堆 >85% 上限时记录——"玩着玩着崩"最常见真因是低端机内存耗尽被系统杀页, JS 层无法阻止, 但日志能确诊 + 指导减负。
   ③ 对外 window.HansenBlackbox.read()/clear() ——「启动贾维斯」即可读现场, 下次崩溃不再是悬案。
   零侵入: 不改任何游戏逻辑, 只听不动。 */
(function(){
  'use strict';
  if(window.__hsnStab){ return; } window.__hsnStab = true;

  var KEY = 'hansen_blackbox';
  function page(){ try{ return (location.pathname.split('/').pop()||'index.html'); }catch(e){ return '?'; } }
  function log(type, msg){
    try{
      var arr = [];
      try{ arr = JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ arr = []; }
      if(!Array.isArray(arr)) arr = [];
      arr.push({ t: Date.now(), p: page(), k: type, m: String(msg).slice(0, 300) });
      if(arr.length > 30) arr = arr.slice(-30);
      localStorage.setItem(KEY, JSON.stringify(arr));
    }catch(e){}
  }

  /* ① 全局异常黑匣子 */
  window.addEventListener('error', function(e){
    try{
      var f = (e.filename||'').split('/').pop();
      log('error', (e.message||'unknown') + ' @' + f + ':' + (e.lineno||0));
    }catch(err){}
  });
  window.addEventListener('unhandledrejection', function(e){
    try{
      var r = e.reason;
      log('promise', (r && r.message) ? r.message : String(r).slice(0, 200));
    }catch(err){}
  });

  /* ② 内存压力哨兵(20s 周期, 单例; 仅 Chrome 系有 performance.memory, 其余浏览器静默跳过) */
  setInterval(function(){
    try{
      var m = performance.memory;
      if(m && m.jsHeapSizeLimit && m.usedJSHeapSize > m.jsHeapSizeLimit * 0.85){
        log('memory', 'heap ' + Math.round(m.usedJSHeapSize/1048576) + 'MB / ' +
            Math.round(m.jsHeapSizeLimit/1048576) + 'MB (>85%, 内存吃紧)');
      }
    }catch(e){}
  }, 20000);

  /* ③ 对外读口 */
  window.HansenBlackbox = {
    read: function(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } },
    clear: function(){ try{ localStorage.removeItem(KEY); }catch(e){} }
  };
})();
