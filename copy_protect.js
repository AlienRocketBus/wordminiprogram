/* copy_protect.js v3 — 学习与辅助功能友好版权提示
 *
 * 客户端代码无法靠禁用右键、复制、打印或开发者工具得到真正保护。旧版本的
 * 全局拦截反而会妨碍查词、摘录、键盘操作、读屏软件和打印学习资料。
 * v3 只保留非侵入式版权元数据，不拦截任何浏览器原生能力。
 */
(function () {
  'use strict';

  var NOTICE = '单词大冒险 © 2026 Hansen。请尊重作者版权；学习摘录与辅助功能保持可用。';

  try {
    document.documentElement.setAttribute('data-hansen-copyright', '2026 Hansen');
  } catch (e) {}

  /* 给“关于/隐私”界面和自动化检查提供稳定、只读的状态接口。 */
  window.HansenCopyright = Object.freeze({
    version: 'v3',
    notice: NOTICE,
    blocksCopy: false,
    blocksSelection: false,
    blocksContextMenu: false,
    blocksPrint: false
  });

  window.__copyProtectDebug = function () {
    return {
      version: 'v3',
      accessibleMode: true,
      blocksNativeBrowserFeatures: false
    };
  };
})();
