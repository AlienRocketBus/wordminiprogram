// hansen_onboarding.js v2 — 新手引导（HF2 无障碍与减少动态效果）
// ============================================================================
// 作用:
//   玩家【第一次】打开首页(index.html)时, 弹出一个轻量的 3 屏欢迎引导, 告诉新孩子:
//     1) 这是个"打boss背单词"的游戏
//     2) 每个岛是一个单词主题, 先玩游戏认词再挑战boss
//     3) 答错的词会自动进复习
//   看完(或点跳过)后, 用 localStorage 记住"已看过", 之后永不再弹。
//
// 为什么做这个 (最重要):
//   新玩家第一次进来, 面对18个岛+12种玩法+boss, 很容易懵→不知道干嘛→退出→再不回来。
//   头30秒决定留存。这个引导用3句话讲清"怎么玩", 是性价比最高的留存手段。
//
// 设计原则:
//   - 不修改任何原游戏代码 (index.html 一行不动, 纯叠加)
//   - 只在【首页】弹 (检测 location, 岛页/其他页不弹)
//   - 只弹【一次】 (localStorage.hansen_onboarded='1' 后永不再弹)
//   - 有"跳过", 不烦人; 配色字体跟首页一致(深蓝宇宙+金色)
//   - 幂等: 重复加载不会重复弹
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenOnboardingLoaded) return; window.__hansenOnboardingLoaded = true;

  var DONE_KEY = 'hansen_onboarded';

  // ---- 只在首页弹 ----
  // 首页是 index.html 或 单词大冒险.html (部署后可能改名), 或路径以 / 结尾。
  // 岛页文件名是 island_xxx.html, 明确排除。
  function isHomePage(){
    var path = (location.pathname || '').toLowerCase();
    if(/island_\w+\.html/.test(path)) return false;  // 岛页, 不弹
    // 其余视为首页 (index.html / 单词大冒险.html / 根路径 /)
    return true;
  }

  // ---- 已看过就不再弹 ----
  function alreadyDone(){
    try { return localStorage.getItem(DONE_KEY) === '1'; } catch(e){ return false; }
  }
  function markDone(){
    try { localStorage.setItem(DONE_KEY, '1'); } catch(e){}
  }

  // ---- 3 屏引导内容 ----
  var SLIDES = [
    {
      emoji: '🎯',
      title: '欢迎来到单词大冒险！',
      body: '这里用<b style="color:#fbbf24">打 Boss</b> 的方式背单词——<br>答对题目就能击败怪兽，越打越强！'
    },
    {
      emoji: '🗺️',
      title: '18 个主题岛屿等你探索',
      body: '每个岛是一个单词主题<br>（动物、食物、学校…）。<br>先在岛上玩游戏认识单词，<br>再去挑战守关的 Boss 💪'
    },
    {
      emoji: '⭐',
      title: '答错也没关系！',
      body: '答错的单词会<b style="color:#fbbf24">自动进入复习</b>，<br>下次帮你重点再练一遍。<br>坚持每天来，单词越背越牢！'
    }
  ];

  var current = 0;
  var overlay = null;
  var restoreFocus = null;
  var finishing = false;

  function reducedMotion(){
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch(e){ return false; }
  }

  function focusables(){
    if(!overlay) return [];
    return Array.prototype.filter.call(
      overlay.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])'),
      function(el){ return !el.disabled && el.getAttribute('aria-hidden') !== 'true'; }
    );
  }

  function onDialogKeydown(event){
    if(event.key === 'Escape'){
      event.preventDefault();
      finish();
      return;
    }
    if(event.key !== 'Tab') return;
    var items = focusables();
    if(!items.length){ event.preventDefault(); overlay.focus(); return; }
    var first = items[0], last = items[items.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  }

  function buildUI(){
    restoreFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : null;
    finishing = false;
    // 遮罩层 (深蓝宇宙渐变, 跟首页一致)
    overlay = document.createElement('div');
    overlay.id = '__hansen_onboarding';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', '__hsOnbTitle');
    overlay.setAttribute('aria-describedby', '__hsOnbBody');
    overlay.tabIndex = -1;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483600',
      'background:radial-gradient(circle at 50% 30%, rgba(30,58,138,.55), rgba(12,21,56,.96))',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:max(24px,env(safe-area-inset-top,0px)) max(24px,env(safe-area-inset-right,0px)) max(24px,env(safe-area-inset-bottom,0px)) max(24px,env(safe-area-inset-left,0px))',
      'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
      'animation:hsOnbFadeIn .35s ease-out'
    ].join(';');
    overlay.addEventListener('keydown', onDialogKeydown);

    // 卡片
    var card = document.createElement('div');
    card.setAttribute('role', 'document');
    card.style.cssText = [
      'width:100%', 'max-width:340px', 'box-sizing:border-box',
      'background:linear-gradient(160deg,#1a2660,#0c1538)',
      'border:2px solid rgba(251,191,36,.5)', 'border-radius:24px',
      'box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(251,191,36,.15)',
      'padding:32px 24px 24px', 'text-align:center', 'position:relative'
    ].join(';');

    // 跳过按钮 (右上角)
    var skip = document.createElement('button');
    skip.type = 'button';
    skip.id = '__hsOnbSkip';
    skip.textContent = '跳过';
    skip.setAttribute('aria-label', '跳过新手引导');
    skip.style.cssText = 'position:absolute;top:8px;right:10px;min-width:56px;min-height:44px;border:0;background:transparent;font-size:13px;color:#cbd5e1;cursor:pointer;padding:8px;font-weight:700;border-radius:10px';
    skip.addEventListener('click', finish);

    // emoji
    var emojiEl = document.createElement('div');
    emojiEl.id = '__hsOnbEmoji';
    emojiEl.style.cssText = 'font-size:72px;line-height:1;margin-bottom:16px;animation:hsOnbPop .4s cubic-bezier(.34,1.56,.64,1)';

    // 标题
    var titleEl = document.createElement('h2');
    titleEl.id = '__hsOnbTitle';
    titleEl.style.cssText = 'font-size:22px;font-weight:900;color:#fff;margin:0 0 14px;line-height:1.3';

    // 正文
    var bodyEl = document.createElement('div');
    bodyEl.id = '__hsOnbBody';
    bodyEl.setAttribute('aria-live', 'polite');
    bodyEl.setAttribute('aria-atomic', 'true');
    bodyEl.style.cssText = 'font-size:15px;color:#cbd5e1;line-height:1.7;margin-bottom:24px;min-height:90px';

    // 圆点指示器
    var dots = document.createElement('div');
    dots.id = '__hsOnbDots';
    dots.setAttribute('aria-hidden', 'true');
    dots.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-bottom:22px';
    for(var i=0;i<SLIDES.length;i++){
      var dot = document.createElement('span');
      dot.className = '__hsOnbDot';
      dot.style.cssText = 'width:9px;height:9px;border-radius:50%;background:#475569;transition:all .25s';
      dots.appendChild(dot);
    }

    // 下一步 / 开始按钮
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = '__hsOnbBtn';
    btn.style.cssText = [
      'background:linear-gradient(135deg,#fbbf24,#f59e0b)', 'color:#1a2660',
      'font-size:17px', 'font-weight:900', 'padding:14px', 'border-radius:14px',
      'border:0', 'width:100%', 'min-height:48px',
      'cursor:pointer', 'box-shadow:0 6px 18px rgba(251,191,36,.4)',
      'transition:transform .15s', 'user-select:none'
    ].join(';');
    btn.addEventListener('click', next);
    btn.addEventListener('touchstart', function(){ btn.style.transform='scale(.97)'; });
    btn.addEventListener('touchend', function(){ btn.style.transform=''; });

    card.appendChild(skip);
    card.appendChild(emojiEl);
    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    card.appendChild(dots);
    card.appendChild(btn);
    overlay.appendChild(card);

    // 注入动画 keyframes (一次)
    if(!document.getElementById('__hsOnbStyle')){
      var st = document.createElement('style');
      st.id = '__hsOnbStyle';
      st.textContent = '@keyframes hsOnbFadeIn{from{opacity:0}to{opacity:1}}' +
        '@keyframes hsOnbPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}' +
        '#__hansen_onboarding button:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}' +
        '@media(prefers-reduced-motion:reduce){#__hansen_onboarding,#__hsOnbEmoji,' +
        '#__hansen_onboarding button,#__hsOnbDots .__hsOnbDot{animation:none!important;transition:none!important}}';
      document.head.appendChild(st);
    }

    document.body.appendChild(overlay);
    render();
    window.setTimeout(function(){
      var primary = document.getElementById('__hsOnbBtn');
      try{ (primary || overlay).focus({preventScroll:true}); }catch(e){ try{ (primary || overlay).focus(); }catch(_e){} }
    }, 0);
  }

  function render(){
    var s = SLIDES[current];
    var emojiEl = document.getElementById('__hsOnbEmoji');
    var titleEl = document.getElementById('__hsOnbTitle');
    var bodyEl = document.getElementById('__hsOnbBody');
    var btn = document.getElementById('__hsOnbBtn');
    if(emojiEl){
      emojiEl.textContent = s.emoji;
      if(reducedMotion()) emojiEl.style.animation='none';
      else { emojiEl.style.animation='none'; void emojiEl.offsetWidth; emojiEl.style.animation='hsOnbPop .4s cubic-bezier(.34,1.56,.64,1)'; }
    }
    if(titleEl) titleEl.textContent = s.title;
    if(bodyEl) bodyEl.innerHTML = s.body;
    if(btn){
      btn.textContent = (current === SLIDES.length - 1) ? '🚀 开始冒险！' : '下一步 →';
      btn.setAttribute('aria-label', (current === SLIDES.length - 1) ? '完成引导，开始冒险' : '下一步，第 '+(current+2)+' 页，共 '+SLIDES.length+' 页');
    }
    // 更新圆点
    var dotEls = document.querySelectorAll('.__hsOnbDot');
    for(var i=0;i<dotEls.length;i++){
      if(i === current){ dotEls[i].style.background = '#fbbf24'; dotEls[i].style.width='22px'; dotEls[i].style.borderRadius='5px'; }
      else { dotEls[i].style.background = '#475569'; dotEls[i].style.width='9px'; dotEls[i].style.borderRadius='50%'; }
    }
  }

  function next(){
    if(current < SLIDES.length - 1){
      current++;
      render();
    } else {
      finish();
    }
  }

  function finish(){
    if(finishing) return;
    finishing = true;
    markDone();
    if(overlay){
      var closing = overlay;
      function remove(){
        if(closing && closing.parentNode) closing.parentNode.removeChild(closing);
        if(overlay === closing) overlay = null;
        if(restoreFocus && document.contains(restoreFocus)){
          try{ restoreFocus.focus({preventScroll:true}); }catch(e){ try{ restoreFocus.focus(); }catch(_e){} }
        }
        restoreFocus = null;
      }
      if(reducedMotion()) remove();
      else {
        closing.style.transition = 'opacity .3s';
        closing.style.opacity = '0';
        setTimeout(remove, 320);
      }
    }
  }

  // ---- 启动 ----
  function start(){
    if(!isHomePage()) return;      // 只首页弹
    if(alreadyDone()) return;      // 看过就不弹
    if(!document.body) return;
    buildUI();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
