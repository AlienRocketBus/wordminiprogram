// hansen_accessibility.js v942 — 为遗留点击卡片与模态框补齐键盘/读屏语义
(function(){
  'use strict';
  if(window.__hansenAccessibilityLoaded) return;
  window.__hansenAccessibilityLoaded = true;

  var NATIVE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
  var enhanced = new WeakSet();
  var dialogState = new WeakMap();

  function isDisabled(el){
    return !!(el.disabled || el.getAttribute('aria-disabled') === 'true');
  }

  function enhanceClickable(el){
    if(!el || enhanced.has(el) || NATIVE.test(el.tagName)) return;
    if(!el.hasAttribute('onclick') && el.getAttribute('role') !== 'button') return;
    enhanced.add(el);
    if(!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if(!el.hasAttribute('tabindex')) el.tabIndex = 0;
    el.addEventListener('keydown', function(event){
      if(event.target !== el || isDisabled(el)) return;
      if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
        event.preventDefault();
        el.click();
      }
    });
  }

  function enhanceTree(root){
    if(!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if(root.nodeType === 1) enhanceClickable(root);
    var nodes = root.querySelectorAll ? root.querySelectorAll('[onclick],[role="button"]') : [];
    for(var i=0;i<nodes.length;i++) enhanceClickable(nodes[i]);
  }

  function focusable(dialog){
    var list = dialog.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),' +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.filter.call(list, function(el){
      return el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null;
    });
  }

  function isDialogRoot(node){
    return !!(node && (
      node.tagName === 'DIALOG' ||
      node.classList && node.classList.contains('modal-bg')
    ));
  }

  function dialogIsOpen(dialog){
    if(dialog.tagName === 'DIALOG') return !!dialog.open;
    return dialog.classList.contains('show') || dialog.classList.contains('open');
  }

  function syncDialog(dialog){
    /* class 变化会发生在 screen、按钮等大量普通节点上。只有真正的
       dialog 根节点才能进入这里，避免把普通内容误标为 aria-modal。 */
    if(!isDialogRoot(dialog)) return;
    var open = dialogIsOpen(dialog);
    var old = dialogState.get(dialog) || {open:false,returnTo:null};
    if(!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-hidden', open ? 'false' : 'true');

    if(open && !old.open){
      old.returnTo = document.activeElement && document.activeElement !== document.body
        ? document.activeElement : null;
      window.setTimeout(function(){
        var items = focusable(dialog);
        if(items.length) items[0].focus({preventScroll:true});
        else{
          if(!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
          dialog.focus({preventScroll:true});
        }
      }, 0);
    }else if(!open && old.open && old.returnTo && document.contains(old.returnTo)){
      window.setTimeout(function(){
        try{ old.returnTo.focus({preventScroll:true}); }catch(_focusError){}
      }, 0);
    }
    old.open = open;
    dialogState.set(dialog, old);
  }

  function scanDialogs(root){
    var dialogs = [];
    if(root && root.nodeType === 1 && isDialogRoot(root)) dialogs.push(root);
    if(root && root.querySelectorAll){
      dialogs = dialogs.concat(Array.prototype.slice.call(root.querySelectorAll('.modal-bg,dialog')));
    }
    dialogs.forEach(syncDialog);
  }

  function currentDialog(){
    var all = document.querySelectorAll('.modal-bg.show,.modal-bg.open,dialog[open]');
    return all.length ? all[all.length-1] : null;
  }

  document.addEventListener('keydown', function(event){
    if(event.key !== 'Tab') return;
    var dialog = currentDialog();
    if(!dialog) return;
    var items = focusable(dialog);
    if(!items.length){ event.preventDefault(); dialog.focus(); return; }
    var first = items[0], last = items[items.length-1];
    if(event.shiftKey && document.activeElement === first){
      event.preventDefault(); last.focus();
    }else if(!event.shiftKey && document.activeElement === last){
      event.preventDefault(); first.focus();
    }
  }, true);

  function install(){
    if(!document.documentElement.lang) document.documentElement.lang = 'zh-CN';
    enhanceTree(document);
    scanDialogs(document);
    var style = document.createElement('style');
    style.id = 'hansen-a11y-style';
    style.textContent =
      '[role="button"]:focus-visible,button:focus-visible,a:focus-visible,input:focus-visible,' +
      'select:focus-visible,textarea:focus-visible{outline:3px solid #60a5fa!important;' +
      'outline-offset:3px!important}' +
      /* v943: 禁止再次对所有 animation 做 0.001ms/单次钳制。岛内许多元素把
         transform/left/top 放在 keyframes 里；动画结束回退会造成左上角堆叠、
         消失或布局错位。全局只压缩 transition；仅关闭基准位置完整、不会依赖
         keyframes 布局的已审计组件。主题演员绝不使用通配符暂停。 */
      '@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}' +
      '*,*::before,*::after{transition-duration:.001ms!important}' +
      'body::after,.world-map-btn,.wmb-img,.pet-emoji,.pet-big,.streak-fire,' +
      '.daily-card.chest-pending,.ach-card2.pending,.type-timer-warn,' +
      '.shake-screen,.boss-rage,[class*="hit-anim"]{' +
      'animation:none!important;transform:none!important}}';
    (document.head || document.documentElement).appendChild(style);

    new MutationObserver(function(records){
      records.forEach(function(record){
        if(record.type === 'attributes' && isDialogRoot(record.target)) syncDialog(record.target);
        for(var i=0;i<record.addedNodes.length;i++){
          var node = record.addedNodes[i];
          enhanceTree(node);
          scanDialogs(node);
        }
      });
    }).observe(document.documentElement, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:['class','open','hidden']
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
