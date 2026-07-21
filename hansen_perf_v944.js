/* 🔴v946 HF2 桌面端选手机版/电脑版。
   宽度不能代表输入设备：844×390 的横屏手机也会超过 520px。旧判断会把
   正在学习的手机误送去 _frame.html。现在必须同时满足“宽屏”与“桌面型
   精细指针+悬停”，旧浏览器才使用“无触摸且非粗指针”的保守兜底。
   iframe 内实例仍跳过，绝不套娃。 */
(function(){
  try {
    if (window.top !== window.self) return;                       // 已在 iframe 里(游戏内容实例)→ 照常渲染, 跳过
    if (!window.innerWidth || window.innerWidth <= 520) return;   // 窄窗 → 本就是手机尺寸, 跳过
    var mm = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
    var fineHover = !!(mm && mm('(hover: hover) and (pointer: fine)').matches);
    var coarsePrimary = !!(mm && mm('(pointer: coarse)').matches);
    var hasTouch = !!((window.navigator && Number(window.navigator.maxTouchPoints) > 0) || ('ontouchstart' in window));
    var desktopLike = fineHover || (!hasTouch && !coarsePrimary);
    if (!desktopLike) return;                                    // 横屏手机/平板仍留在当前游戏页
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

// hansen_perf_v944.js —— 图片卫生 + 滚动主题连续性
//
// v944 修复: v858 曾在 scroll/touchmove 时给根节点加滚动态类, 再用根级
// 通配符暂停全部 CSS animation。免费主题的飞行动物/图标正是 CSS animation,
// 所以手指拖动和惯性滚动期间必然静止, 停手 180ms 后才恢复。这个视觉损失不是
// 合法的性能优化。v944 完整移除滚动动画闸门及两个监听, 让当前与未来主题、装饰
// 和伪元素在滚动中保持连续；离屏岛屿和页面后台仍由既有独立机制暂停。
//
// 保留的无损优化:
//   ① 图片卫生 —— 所有 <img> 补 decoding=async(杜绝滚动中同步解码掉帧);
//      同一容器 ≥6 张图(boss选关20张/头像墙66张/卡册/宠物进化墙)除前4张外补 loading=lazy
//      (首屏秒出·屏外的滚到再下·省流量省解码)。旧内核不认识该属性=自动忽略, 100%安全。
//   ② 配合图片压缩、perf_boost 后台暂停/惯性滚动和首页离屏岛屿暂停, 形成性能闭环。
//
// 铁律: 永远禁止恢复任何“滚动时暂停全页动画”的根级通配规则。
(function(){
  'use strict';
  // ═══ 图片卫生 ═══
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
