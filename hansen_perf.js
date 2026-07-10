/* 🔴v901 桌面端=手机端: 电脑浏览器直接打开小程序时, 把整页塞进一个"手机尺寸的 iframe"居中显示 → iframe 的视口宽度就是手机宽(414px), 页面里所有 vw/vh/position:fixed 都按手机算, 于是电脑端和手机端显示【完全一致】。仅【顶层窗口 + 宽屏(>520px, 即真电脑)】才触发; iframe 内的实例 window.top!==window.self 会自动跳过 = 绝不无限套娃。全程 try/catch, 万一出错就原样正常显示、绝不影响手机端与游戏。 */
(function(){
  try {
    if (window.top !== window.self) return;                       // 已在 iframe 里(被包裹的内容实例)→ 不再包
    if (!window.innerWidth || window.innerWidth <= 520) return;   // 手机/窄窗(<=520px)→ 本就是手机尺寸, 无需包
    var src = String(location.href).replace(/"/g, '%22');
    var shell = '<!doctype html><html lang="zh"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>单词大冒险</title>'
      + '<style>*{margin:0;padding:0;box-sizing:border-box}'
      + 'html,body{height:100%;width:100%;overflow:hidden;'
      + 'background:radial-gradient(circle at 50% 24%,#1e1e42,#0a0a16 72%)}'
      + '#hsnDev{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;'
      + 'align-items:center;justify-content:center}'
      + '#hsnPhone{width:414px;height:96vh;max-height:900px;border:0;border-radius:26px;'
      + 'box-shadow:0 18px 70px rgba(0,0,0,.6),0 0 0 8px #14142a;background:#000;display:block}'
      + '</style></head><body><div id="hsnDev">'
      + '<iframe id="hsnPhone" src="' + src + '" allow="autoplay; fullscreen"></iframe>'
      + '</div></body></html>';
    document.open(); document.write(shell); document.close();
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
