// hansen_mute.js v1 — 一键静音 (零侵入)
// ============================================================================
// 作用:
//   在设置页加一个"一键静音"总开关。打开后, 手机上游戏的所有【自动/陪伴类】声音
//   全部关闭: 单词自动朗读、答对/答错音效、金币/升级/连击音、泡泡音等。
//   状态存 localStorage.hansen_muted, 跨页面(各岛)保持。
//
//   ⚠️ 关键例外 (Hansen 要求): 听力题必须靠"听发音"辨单词。所以——
//   玩家【主动点击】发音按钮 (听力题喇叭🔊、慢速、正常、打字题"听发音"、卡片"发音"等)时,
//   发音照常播放。只有"自动播放"被静音拦截。这样静音状态下听力题依然能做。
//
// 实现原理 (为什么这样做):
//   游戏所有声音最终都走两个底层函数: speak()(朗读) 和 playBeep()(音效)。
//   只要在这两个函数外面包一层"静音判断", 就能拦住全部声音, 不必改几十处调用点。
//   区分"自动" vs "手动": 监听用户的真实点击事件, 点击后开一个很短(120ms)的"放行窗口",
//   窗口内的 speak() 视为"玩家主动要听"→ 放行; 窗口外的 speak()/playBeep() 视为自动 → 静音拦截。
//
// 设计原则:
//   - 不修改任何原游戏代码 (各岛 html / 其他 js 一行都不动)
//   - 幂等: 重复加载不会重复包裹 (用 __hansenMuteHooked 标记)
//   - 各岛通用: 18 个岛的 speak/playBeep 结构一致, 同一套逻辑全适用
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenMuteLoaded) return; window.__hansenMuteLoaded = true;

  var MUTE_KEY = 'hansen_muted';

  // ---- 读/写静音状态 ----
  function isMuted(){
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch(e){ return false; }
  }
  function setMuted(on){
    try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch(e){}
  }

  // ---- "手动点击放行窗口" ----
  // 玩家真实点击后的 120ms 内, 认为后续 speak() 是"玩家主动要听" → 放行。
  // 这样静音时, 听力题点喇叭、打字题点"听发音"、卡片点"发音"都能正常响。
  var allowUntil = 0;
  function openAllowWindow(){ allowUntil = Date.now() + 120; }
  function inAllowWindow(){ return Date.now() < allowUntil; }

  // 捕获阶段监听真实点击 (capture=true 保证在 onclick 之前先开窗口)
  // 只有"看起来是发音相关"的点击才开窗口, 避免点别的按钮也放行(其实放行也无害, 但精准些更好)
  document.addEventListener('click', function(e){
    // 玩家任何点击都可能触发发音(喇叭/慢速/正常/听发音/发音/例句), 统一开窗口最稳妥。
    // 自动播放不来自 click 事件, 所以不会误开。
    openAllowWindow();
  }, true);
  // 触摸设备: touchstart 也开窗口 (有些按钮用 touch)
  document.addEventListener('touchstart', function(e){
    openAllowWindow();
  }, true);

  // ---- 包裹 speak() 和 playBeep() ----
  // 这两个函数在每个岛的页面里是全局函数(window.speak / window.playBeep)。
  // 页面加载后它们才存在, 所以轮询等待, 等到了再包裹。
  function hookSoundFns(){
    var hookedAny = false;

    // 包裹 speak: 单词/句子朗读
    if(typeof window.speak === 'function' && !window.speak.__hansenMuteHooked){
      var origSpeak = window.speak;
      window.speak = function(){
        // 静音时: 只有在"手动点击放行窗口"内才发音; 否则(自动朗读)直接吞掉
        if(isMuted() && !inAllowWindow()){
          // 被静音拦截的自动朗读: 如果有回调(cb), 仍要调用它, 否则有些题会卡住等朗读结束
          var cb = arguments[2];
          if(typeof cb === 'function'){ try { cb(); } catch(e){} }
          return;
        }
        return origSpeak.apply(this, arguments);
      };
      window.speak.__hansenMuteHooked = true;
      hookedAny = true;
    }

    // 包裹 playBeep: 所有音效(答对/答错/金币/升级/泡泡/连击…都走它)
    if(typeof window.playBeep === 'function' && !window.playBeep.__hansenMuteHooked){
      var origBeep = window.playBeep;
      window.playBeep = function(){
        // 音效永远是"自动/陪伴类", 静音时一律拦截 (音效不影响做题)
        if(isMuted()) return;
        return origBeep.apply(this, arguments);
      };
      window.playBeep.__hansenMuteHooked = true;
      hookedAny = true;
    }

    return hookedAny;
  }

  // 轮询等待 speak/playBeep 出现 (页面脚本加载顺序不定), 最多试 100 次(~10秒)
  var tries = 0;
  var hookTimer = setInterval(function(){
    tries++;
    hookSoundFns();
    // speak 和 playBeep 都包好了, 或试够了, 就停止轮询
    var speakDone = (typeof window.speak !== 'function') || window.speak.__hansenMuteHooked;
    var beepDone = (typeof window.playBeep !== 'function') || window.playBeep.__hansenMuteHooked;
    if((speakDone && beepDone && (window.speak || window.playBeep)) || tries >= 100){
      clearInterval(hookTimer);
    }
  }, 100);

  // ---- 在设置页注入"一键静音"开关 ----
  // 监听设置页内容出现, 渲染后注入开关 (与 click_setting.js 同样的零侵入手法)
  function injectToggle(){
    var container = document.getElementById('settingsContent');
    if(!container) return;
    if(document.getElementById('__hansen_mute_toggle')) return; // 已注入, 幂等

    var wrap = document.createElement('div');
    wrap.id = '__hansen_mute_toggle';
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #334155;border-radius:14px;padding:14px 16px;margin:10px 8px;font-family:"Microsoft YaHei",sans-serif';

    var left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0';
    left.innerHTML = '<div style="font-size:16px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px"><span id="__hm_icon" style="font-size:20px">🔊</span><span>一键静音</span></div>' +
      '<div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.5">开启后关闭所有自动声音(朗读/音效)。听力题点喇叭🔊仍可手动听发音。</div>';

    // 开关按钮 (滑块样式)
    var sw = document.createElement('div');
    sw.id = '__hm_switch';
    sw.style.cssText = 'flex-shrink:0;width:52px;height:30px;border-radius:15px;cursor:pointer;position:relative;transition:background .2s';
    var knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 2px 4px rgba(0,0,0,.3)';
    sw.appendChild(knob);

    function render(){
      var muted = isMuted();
      sw.style.background = muted ? '#22c55e' : '#475569';
      knob.style.left = muted ? '25px' : '3px';
      var icon = document.getElementById('__hm_icon');
      if(icon) icon.textContent = muted ? '🔇' : '🔊';
    }
    sw.addEventListener('click', function(){
      var next = !isMuted();
      setMuted(next);
      render();
      // 即时反馈: 关静音时响一下提示音(此时未静音), 开静音时不响
      if(!next && typeof window.playBeep === 'function'){
        // 临时绕过(刚关静音, isMuted 已是 false, 直接响)
        try { window.playBeep(880, .08); } catch(e){}
      }
      if(typeof window.showToast === 'function'){
        window.showToast(next ? '🔇 已静音 (听力题点喇叭仍可听)' : '🔊 已恢复声音');
      }
    });

    wrap.appendChild(left);
    wrap.appendChild(sw);
    // 插到设置页最前面 (显眼)
    container.insertBefore(wrap, container.firstChild);
    render();
  }

  // 用 MutationObserver 监听设置页渲染
  function watchSettings(){
    var target = document.getElementById('settingsContent');
    if(target){
      injectToggle();
      try {
        var obs = new MutationObserver(function(){ injectToggle(); });
        obs.observe(target, { childList: true, subtree: false });
      } catch(e){}
    }
    // 设置页可能还没创建, 也监听 body 等它出现
    try {
      var bodyObs = new MutationObserver(function(){
        if(document.getElementById('settingsContent')) injectToggle();
      });
      bodyObs.observe(document.body, { childList: true, subtree: true });
    } catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', watchSettings);
  } else {
    watchSettings();
  }
})();
