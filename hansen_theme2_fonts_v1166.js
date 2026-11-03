/* hansen_theme2_fonts — 主题 2.0 字体计划（不新下载任何字体，只用仓库里已有的两个）
 * ------------------------------------------------------------------
 * 三种字体角色（CSS 变量在 theme2_tokens.css 里）：
 *   --t2-font-display  标题      CartoonBlack（cartoon_font.woff2，398 KB）
 *   --t2-font-latin    英文和数字 Baloo2（baloo2.woff2，18 KB，theme2_base.css 直接声明）
 *   --t2-font-body     正文      系统字体
 * 'Bowlby One' 从来没打包过（手机上退成衬线体），2.0 一律不用；也不许 serif 兜底。
 * 这个文件只做一件事：CartoonBlack 太大，不放进首屏 CSS；等 DOMContentLoaded 之后
 *   注入一次 @font-face（以前要等 window.load，晚约 9 秒，TV-10）。已经有人声明过就不重复。
 * 只跑一次，没有循环、没有轮询；文件里不写版本号字面量。
 * ------------------------------------------------------------------ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.HansenT2Fonts = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';
  var ID = 't2-font-display';
  /* 字体地址按“本脚本所在目录”算，不按页面地址算（页面在子路径时也找得到字体） */
  var DIR = '';
  try { var cs = typeof document !== 'undefined' && document.currentScript; if (cs && cs.src) DIR = cs.src.replace(/[?#].*$/, '').replace(/[^\/]*$/, ''); } catch (e) {}
  var FACE = "@font-face{font-family:'CartoonBlack';src:url('" + DIR + "cartoon_font.woff2') format('woff2');font-weight:900;font-style:normal;font-display:swap}";
  var done = false;
  /* 页面里是不是已经有 CartoonBlack 的声明（老模板的 __hsnLateFont 也会注入一份） */
  function declared() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(ID)) return true;
    try {
      if (document.fonts && document.fonts.forEach) {
        var hit = false; document.fonts.forEach(function (f) { if (/CartoonBlack/.test(f.family)) hit = true; }); if (hit) return true;
      }
    } catch (e) {}
    var st = document.getElementsByTagName('style');
    for (var i = 0; i < st.length; i++) if (/font-family:\s*['"]?CartoonBlack/.test(st[i].textContent || '') && /@font-face/.test(st[i].textContent || '')) return true;
    return false;
  }
  function inject() {
    if (done) return false; done = true;
    if (declared()) return false;
    var s = document.createElement('style'); s.id = ID; s.textContent = FACE;
    (document.head || document.documentElement).appendChild(s);
    return true;
  }
  function ensure() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });
    else inject();
  }
  ensure();
  return { ensure: ensure, inject: inject, declared: declared, FACE: FACE,
           ROLES: { display: 'CartoonBlack', latin: 'Baloo2', body: 'system' } };
});
