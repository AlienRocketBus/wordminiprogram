// copy_protect.js v2 — 全平台彻底禁止文字复制和选中 (加固版)
//
// vs v1 改动:
//   ✓ @media print CSS — 打印 / 保存为 PDF 时页面变空白 (堵打印漏洞)
//   ✓ Ctrl/Cmd + S (保存) 和 Ctrl/Cmd + U (查看源码) 全平台拦截
//   ✓ Mac metaKey (Cmd) 修饰键完整支持
//
// 覆盖:
//   ✓ CSS: 所有元素 user-select: none + iOS 长按菜单 callout
//   ✓ CSS: @media print 打印时整页隐藏
//   ✓ JS: copy / cut / contextmenu / selectstart / dragstart 事件拦截
//   ✓ JS: Ctrl+C / X / A / P / S / U 键盘拦截 (Mac Cmd 同支持)
//   ✓ 兜底: selectionchange 周期清空非输入框选区
//
// 例外 (保留功能):
//   - <input> / <textarea> / [contenteditable] — 仍可输入和选中
(function(){
  'use strict';

  // ============ 1. CSS 注入: 禁止选中 + 禁止打印 ============
  function injectCSS(){
    if(document.getElementById('__copy_protect_style')) return;
    var style = document.createElement('style');
    style.id = '__copy_protect_style';
    style.textContent =
      // 屏幕显示: 全局禁选, 输入框例外
      '*:not(input):not(textarea):not([contenteditable="true"]):not([contenteditable=""]) {' +
        '-webkit-user-select: none !important;' +
        '-moz-user-select: none !important;' +
        '-ms-user-select: none !important;' +
        'user-select: none !important;' +
        '-webkit-touch-callout: none !important;' +
        '-khtml-user-select: none !important;' +
      '}' +
      'input, textarea, [contenteditable="true"], [contenteditable=""] {' +
        '-webkit-user-select: text !important;' +
        '-moz-user-select: text !important;' +
        'user-select: text !important;' +
        '-webkit-touch-callout: default !important;' +
      '}' +
      // 打印 / 存为 PDF: 整页空白
      '@media print {' +
        'html, body {' +
          'display: none !important;' +
          'visibility: hidden !important;' +
          'background: white !important;' +
        '}' +
      '}';
    (document.head || document.documentElement).appendChild(style);
  }

  if(document.head){
    injectCSS();
  } else {
    var observer = new MutationObserver(function(){
      if(document.head){
        observer.disconnect();
        injectCSS();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }

  // ============ 2. 工具 ============
  function isInput(el){
    if(!el) return false;
    var tag = el.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if(el.isContentEditable) return true;
    return false;
  }

  // ============ 3. 事件拦截 (capture 阶段) ============
  function block(eventName){
    document.addEventListener(eventName, function(e){
      if(isInput(e.target)) return;
      e.preventDefault();
      return false;
    }, true);
  }

  block('copy');
  block('cut');
  block('contextmenu');
  block('selectstart');
  block('dragstart');

  // ============ 4. 键盘快捷键拦截 ============
  // 拦: Ctrl/Cmd + C(复制) X(剪切) A(全选) P(打印) S(保存) U(查看源码)
  document.addEventListener('keydown', function(e){
    if(isInput(e.target)) return;
    if(e.ctrlKey || e.metaKey){
      var k = e.keyCode;
      // C=67 X=88 A=65 P=80 S=83 U=85
      if(k === 67 || k === 88 || k === 65 || k === 80 || k === 83 || k === 85){
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, true);

  // ============ 5. 兜底: 清空非输入框选区 ============
  document.addEventListener('selectionchange', function(){
    try {
      var active = document.activeElement;
      if(active && isInput(active)) return;
      var sel = window.getSelection && window.getSelection();
      if(sel && sel.removeAllRanges && sel.toString().length > 0){
        sel.removeAllRanges();
      }
    } catch(e){}
  });

  // ============ 6. 诊断 API ============
  window.__copyProtectDebug = function(){
    return {
      version: 'v2',
      cssInjected: !!document.getElementById('__copy_protect_style'),
      currentSelection: (window.getSelection && window.getSelection().toString()) || ''
    };
  };
})();
