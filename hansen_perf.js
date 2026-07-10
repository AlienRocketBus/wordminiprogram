/* 🔴v902 桌面端选择手机版/电脑版(替代 v901 自动套框): 电脑浏览器直接打开时先弹一个选择器——【📱手机版】(套进 414px 手机尺寸 iframe·和真机显示完全一致) 或 【💻电脑版】(铺满浏览器窗口)。选了哪个就【只显示哪个】、干净不重叠(document.write 整页替换·永远只有一个版本在渲染);选择记进 localStorage 记住;两个版本都有一个小按钮可随时切到另一个。仅【顶层窗口+宽屏(>520px)】触发;iframe 内实例 window.top!==window.self 自动跳过=不套娃;全 try/catch 失败原样正常显示、绝不影响手机端与游戏。 */
(function(){
  try {
    if (window.top !== window.self) return;                       // 已在 iframe 里 → 跳过
    if (!window.innerWidth || window.innerWidth <= 520) return;   // 手机/窄窗 → 本就是手机尺寸, 跳过
    var KEY = 'hsnViewMode', mode = null;
    try { mode = localStorage.getItem(KEY); } catch(e){}
    function pick(m){ try { localStorage.setItem(KEY, m); } catch(e){} try { location.reload(); } catch(e){ location.href = location.href; } }

    if (mode === 'desktop') { injectSwitch(); return; }           // 电脑版: 照常全屏 + 右上角"切手机版"小钮
    if (mode === 'mobile')  { wrapPhone();   return; }            // 手机版: 套手机框 + "切电脑版"小钮
    showChooser();                                                // 还没选 → 弹选择器

    function wrapPhone(){
      var src = String(location.href).replace(/"/g, '%22');
      var h = '<!doctype html><html lang="zh"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>单词大冒险</title>'
        + '<style>*{margin:0;padding:0;box-sizing:border-box}'
        + 'html,body{height:100%;width:100%;overflow:hidden;font-family:"Microsoft YaHei",sans-serif;'
        + 'background:radial-gradient(circle at 50% 22%,#1e1e42,#0a0a16 72%)}'
        + '#hsnDev{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}'
        + '#hsnPhone{width:414px;height:88vh;max-height:896px;border:0;border-radius:26px;box-shadow:0 18px 70px rgba(0,0,0,.6),0 0 0 8px #14142a;background:#000;display:block}'
        + '#hsnSw{padding:8px 18px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#cfd2ff;border-radius:20px;font-size:13px;cursor:pointer;transition:.15s}'
        + '#hsnSw:hover{background:rgba(255,255,255,.18)}'
        + '</style></head><body><div id="hsnDev">'
        + '<iframe id="hsnPhone" src="' + src + '" allow="autoplay; fullscreen"></iframe>'
        + '<button id="hsnSw">💻 切换到电脑版</button>'
        + '</div></body></html>';
      document.open(); document.write(h); document.close();
      var sw = document.getElementById('hsnSw'); if (sw) sw.onclick = function(){ pick('desktop'); };
    }

    function showChooser(){
      var h = '<!doctype html><html lang="zh"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>单词大冒险</title>'
        + '<style>*{margin:0;padding:0;box-sizing:border-box}'
        + 'html,body{height:100%;width:100%;overflow:hidden;color:#fff;font-family:"Microsoft YaHei",sans-serif;'
        + 'background:radial-gradient(circle at 50% 30%,#20204a,#0a0a16 72%)}'
        + '#hsnPick{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}'
        + '#hsnPick h1{font-size:30px;letter-spacing:2px;margin-bottom:6px;background:linear-gradient(90deg,#8ab4ff,#c99bff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}'
        + '#hsnPick .sub{color:#9aa0c8;font-size:15px;margin-bottom:28px}'
        + '.hsnRow{display:flex;gap:22px;flex-wrap:wrap;justify-content:center}'
        + '.hsnCard{width:196px;padding:28px 20px;border-radius:18px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14);cursor:pointer;text-align:center;transition:.16s;-webkit-user-select:none;user-select:none}'
        + '.hsnCard:hover{transform:translateY(-5px);background:rgba(255,255,255,.12);border-color:#8ab4ff;box-shadow:0 16px 42px rgba(80,110,255,.32)}'
        + '.hsnCard .ic{font-size:48px;margin-bottom:12px}'
        + '.hsnCard .t{font-size:20px;font-weight:700;margin-bottom:7px}'
        + '.hsnCard .d{font-size:12.5px;color:#9aa0c8;line-height:1.55}'
        + '.hsnCard .rec{display:inline-block;margin-top:8px;font-size:11px;color:#8ab4ff;border:1px solid #8ab4ff;border-radius:10px;padding:1px 8px}'
        + '</style></head><body><div id="hsnPick">'
        + '<h1>单词大冒险</h1><div class="sub">检测到你在电脑上打开，请选择显示方式</div>'
        + '<div class="hsnRow">'
        + '<div class="hsnCard" id="hsnCardM"><div class="ic">📱</div><div class="t">手机版</div><div class="d">和手机上完全一样的样子</div><div class="rec">推荐</div></div>'
        + '<div class="hsnCard" id="hsnCardD"><div class="ic">💻</div><div class="t">电脑版</div><div class="d">铺满整个浏览器窗口</div></div>'
        + '</div></div></body></html>';
      document.open(); document.write(h); document.close();
      var m = document.getElementById('hsnCardM'); if (m) m.onclick = function(){ pick('mobile'); };
      var d = document.getElementById('hsnCardD'); if (d) d.onclick = function(){ pick('desktop'); };
    }

    function injectSwitch(){
      function go(){
        try {
          if (document.getElementById('hsnSwitchBtn')) return;
          var b = document.createElement('button');
          b.id = 'hsnSwitchBtn'; b.textContent = '📱 切手机版';
          b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;padding:7px 13px;'
            + 'border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,.94);color:#333;border-radius:18px;'
            + 'font-size:13px;font-family:"Microsoft YaHei",sans-serif;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.28)';
          b.onclick = function(){ pick('mobile'); };
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
