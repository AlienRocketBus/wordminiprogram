/* 🔴v903 桌面端选手机版/电脑版(彻底修 v902 的"两版重叠"): v902 用 document.write 从 <head> 脚本整页替换, 但解析进行中 document.open() 是无效操作 → 手机框被"插进"原页面、原电脑版<body>继续渲染 → 两版重叠(用户实拍确认)。改用【干净的独立包裹页 _frame.html】: 电脑浏览器打开游戏页时——选了"电脑版"就照常全屏(+右上角"切手机版"小钮); 否则(没选过 或 选了手机版)直接 location.replace 跳到 _frame.html(一张干净空白页, 只负责显示"选择器"或"手机框 iframe") → 原游戏只在手机框 iframe 里跑一份、结构上绝无重叠可能。仅【顶层窗口+宽屏(>520px)】触发; iframe 内实例 window.top!==window.self 跳过=不套娃; 全 try/catch 失败原样正常显示、绝不影响手机端与游戏。 */
(function(){
  try {
    if (window.top !== window.self) return;                       // 已在 iframe 里(游戏内容实例)→ 照常渲染, 跳过
    if (!window.innerWidth || window.innerWidth <= 520) return;   // 手机/窄窗 → 本就是手机尺寸, 跳过
    var KEY = 'hsnViewMode', mode = null;
    try { mode = localStorage.getItem(KEY); } catch(e){}
    if (mode === 'desktop') { injectSwitch(); return; }           // 电脑版: 照常全屏 + 右上角"切手机版"小钮
    // 没选过 或 选了手机版 → 跳到干净包裹页(它读 localStorage 决定弹选择器 还是 手机框)
    var target = '_frame.html?u=' + encodeURIComponent(location.href);
    try { location.replace(target); } catch(e){ try { location.href = target; } catch(e2){} }
    return;

    function injectSwitch(){
      function go(){
        try {
          if (document.getElementById('hsnSwitchBtn')) return;
          var b = document.createElement('button');
          b.id = 'hsnSwitchBtn'; b.textContent = '📱 切手机版';
          b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;padding:7px 13px;'
            + 'border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,.94);color:#333;border-radius:18px;'
            + 'font-size:13px;font-family:"Microsoft YaHei",sans-serif;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.28)';
          b.onclick = function(){ try { localStorage.setItem('hsnViewMode','mobile'); } catch(e){} try { location.reload(); } catch(e){} };
          document.body.appendChild(b);
        } catch(e){}
      }
      if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
    }
  } catch(e){}
})();

// hansen_perf.js v1 —— 🔴v858 性能引擎 (Hansen: "上下滑动卡顿·图片加载慢·彻底优化到极致")
//
// 三板斧(全部零视觉损失):
//   ① 滚动时暂停全部 CSS 动画 —— index 星空 82 颗星 twinkle + 岛内 27 处 infinite 动画,
//      滚动每帧都在参与合成 = 滑动卡顿主因之一。手指一动 → html.hsn-scrolling 全暂停,
//      停手 180ms 自动恢复。滚动中人眼根本不看星星闪不闪 = 无感。
//      注: 攻击特效走 Web Animations API(element.animate), 不受 animation-play-state 影响, 战斗打击感分毫不损。
//   ② 图片卫生 —— 所有 <img> 补 decoding=async(杜绝滚动中同步解码掉帧);
//      同一容器 ≥6 张图(boss选关20张/头像墙66张/卡册/宠物进化墙)除前4张外补 loading=lazy
//      (首屏秒出·屏外的滚到再下·省流量省解码)。旧内核不认识该属性=自动忽略, 100%安全。
//   ③ 配合 v858 图片总攻(67.7MB→27.6MB·-59%)+ perf_boost 已有的后台暂停/惯性滚动, 形成完整性能闭环。
//
// 铁律自查: 无任何视觉改动·无新增动画·无 backdrop-filter·纯减负。
(function(){
  'use strict';
  // ═══ ① 滚动动画闸门 ═══
  try {
    var st = document.createElement('style');
    st.id = 'hsn-perf-css';
    st.textContent = 'html.hsn-scrolling *,html.hsn-scrolling *::before,html.hsn-scrolling *::after{animation-play-state:paused!important}';
    (document.head || document.documentElement).appendChild(st);
    var idleT = null, on = false, root = document.documentElement;
    function kick(){
      if(!on){ on = true; root.classList.add('hsn-scrolling'); }
      if(idleT) clearTimeout(idleT);
      idleT = setTimeout(function(){ on = false; root.classList.remove('hsn-scrolling'); }, 180);
    }
    // capture=true: 连内部滚动容器(overflow:auto 的列表)也能捕到
    window.addEventListener('scroll', kick, { passive:true, capture:true });
    window.addEventListener('touchmove', kick, { passive:true });
  } catch(e){}

  // ═══ ② 图片卫生 ═══
  function hygiene(){
    try {
      var imgs = document.getElementsByTagName('img');
      var groups = new Map(); // 容器 → [该容器下的新img们]
      var i, im;
      for(i = 0; i < imgs.length; i++){
        im = imgs[i];
        if(im.__hsnp) continue;
        im.__hsnp = 1;
        if(!im.getAttribute('decoding')) im.setAttribute('decoding','async');
        // 向上4层全部登记为候选容器(boss卡/头像/卡册的img常嵌套2-3层深)
        var up = im.parentElement, d = 0;
        while(up && d < 4){
          if(!groups.has(up)) groups.set(up,[]);
          groups.get(up).push(im);
          up = up.parentElement; d++;
        }
      }
      groups.forEach(function(list, host){
        // 该容器当前总图数≥6 → 视为"图片墙", 已有前4张之后的补 lazy
        var total = host.getElementsByTagName('img').length;
        if(total < 6) return;
        var all = host.getElementsByTagName('img');
        for(var k = 4; k < all.length; k++){
          var t = all[k];
          if(!t.getAttribute('loading') && !t.complete) t.setAttribute('loading','lazy');
        }
      });
    } catch(e){}
  }
  var pend = false;
  function schedule(){
    if(pend) return; pend = true;
    (window.requestAnimationFrame || setTimeout)(function(){ pend = false; hygiene(); }, 16);
  }
  try {
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  } catch(e){}
  if(document.readyState !== 'loading') schedule();
  else document.addEventListener('DOMContentLoaded', schedule);
})();
