// click_setting.js v1 — 点击音开关 UI (零侵入)
//
// 作用:
//   在游戏设置页面 (settings screen) 自动插入一个开关,
//   让用户能关掉点击音. 选择保存在 localStorage.clickSoundEnabled.
//
// 设计原则:
//   - 不修改原游戏代码
//   - 用 MutationObserver 监听 settingsContent 内容变化, 渲染完后注入开关
//   - 如果已经有开关就不重复插入 (幂等)
//   - 开关切换会立即生效, 不需刷新页面
(function(){
  'use strict';

  var TOGGLE_ID = '__click_sound_toggle';
  var STORAGE_KEY = 'clickSoundEnabled';

  function isSoundOn(){
    try {
      // 默认是开 (没设过 = 开)
      return localStorage.getItem(STORAGE_KEY) !== '0';
    } catch(e){ return true; }
  }

  function setSoundOn(on){
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch(e){}
  }

  // 渲染开关 HTML (用游戏现有的 settings-section 样式, 保持视觉一致)
  function buildToggleHTML(){
    var on = isSoundOn();
    return (
      '<div class="settings-section" id="' + TOGGLE_ID + '">' +
        '<h3>🔊 点击音效</h3>' +
        '<div class="desc">点击按钮时是否播放"咔嗒"声效。关闭后整个 app 都不会有点击音。</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px">' +
          '<div style="flex:1;font-size:14px;color:#cbd5e1;font-weight:600">' +
            (on ? '当前: <span style="color:#22c55e;font-weight:900">已开启</span>' 
                : '当前: <span style="color:#94a3b8;font-weight:900">已关闭</span>') +
          '</div>' +
          '<div id="' + TOGGLE_ID + '_switch" ' +
               'style="cursor:pointer;user-select:none;-webkit-user-select:none;' +
                      'width:60px;height:32px;border-radius:16px;position:relative;' +
                      'transition:background .25s;' +
                      'background:' + (on ? '#22c55e' : '#475569') + '">' +
            '<div style="position:absolute;top:3px;left:' + (on ? '31px' : '3px') + ';' +
                        'width:26px;height:26px;border-radius:50%;background:#fff;' +
                        'box-shadow:0 2px 6px rgba(0,0,0,.3);transition:left .25s"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function attachHandler(){
    var sw = document.getElementById(TOGGLE_ID + '_switch');
    if(!sw || sw.__clickSoundToggleBound) return;
    sw.__clickSoundToggleBound = true;
    // 用 click 事件 (PC + 手机都支持). 不用 onclick attribute 避免被点击音脚本包装.
    sw.addEventListener('click', function(e){
      e.stopPropagation();
      var newState = !isSoundOn();
      setSoundOn(newState);
      // 重新渲染当前开关 (不重新渲染整个 settings)
      var section = document.getElementById(TOGGLE_ID);
      if(section){
        section.outerHTML = buildToggleHTML();
        // 重新挂载 handler (因为 outerHTML 替换会丢监听)
        setTimeout(attachHandler, 0);
      }
    });
  }

  function inject(){
    var container = document.getElementById('settingsContent');
    if(!container) return false;
    if(document.getElementById(TOGGLE_ID)) {
      // 已存在, 只重挂 handler (防止 settings 重渲染丢失)
      attachHandler();
      return true;
    }
    // 插到最前面 (h3 进度概览之前), 让用户最容易看到
    container.insertAdjacentHTML('afterbegin', buildToggleHTML());
    attachHandler();
    return true;
  }

  // 监听 settingsContent 变化 — 当游戏重新渲染 settings 时, 重新注入
  function observeSettings(){
    var container = document.getElementById('settingsContent');
    if(!container) return;
    var observer = new MutationObserver(function(){
      // 防止递归: 我自己注入也会触发 mutation, 但 inject() 是幂等的
      inject();
    });
    observer.observe(container, { childList: true });
  }

  function init(){
    inject();        // 立即尝试 (settings 可能已显示)
    observeSettings();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // 兜底: 页面 load 后再试一次 (有的页面 settingsContent 是后建的)
  window.addEventListener('load', function(){ setTimeout(init, 100); });

  // 诊断
  window.__clickSettingDebug = function(){
    return {
      version: 'v1',
      soundOn: isSoundOn(),
      toggleInjected: !!document.getElementById(TOGGLE_ID),
      storedValue: (function(){ try { return localStorage.getItem(STORAGE_KEY); } catch(e){ return 'error'; } })()
    };
  };
})();
