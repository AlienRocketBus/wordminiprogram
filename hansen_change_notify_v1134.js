/* hansen_change_notify_v1134.js —— 数据一变就通知云存档排队上传
 *
 * 🔴 起因：查"账号登录有没有覆盖所有内容"时发现 ——
 *    备份**内容**是全的（15 个玩法模块 100% 覆盖），
 *    但**同步时机**只有三个：切后台 / 关页面 / 每 5 分钟。
 *
 *    孩子打完一局、拿了奖励、开了张卡，
 *    **这时候直接杀掉微信，这 5 分钟内的进度就丢了。**
 *    而"打完一局就切出去"恰恰是最常见的用法。
 *
 * 做法：在 localStorage.setItem 上挂一层 —— 写的键如果是备份会收的，
 * 就派发 `hsn-data-changed`，云存档收到后延迟 8 秒上传（合并连续改动）。
 *
 * 为什么劫持 setItem 而不是让每个模块自己调：
 *   全站 15 个模块、上百个写入点，**逐个去加必然会漏**，
 *   而且以后新增模块的人也会忘。
 *   挂在唯一的出口上，才是"不会漏"的做法。
 *
 * 必须早于业务模块加载。 */
(function () {
  'use strict';
  if (window.__hsnChangeNotify) return;
  window.__hsnChangeNotify = 1;

  /* 只对"备份会收的键"发信号 —— 诊断键、事务中间态改了不该触发上传 */
  function worthSync(k) {
    if (!k) return false;
    try {
      var B = window.HansenBackup;
      if (B && typeof B.isOwnedKey === 'function') return !!B.isOwnedKey(k);
    } catch (e) {}
    /* 备份模块还没加载时的兜底：认玩家数据的几个前缀 */
    return /^(wordIsland|land\d_prog|season|hansen_wallet|hansen_ach|hansen_pet|hansen_gear|hansen_sb_|hansen_pk_|hansen_checkin|hansen_season|hsn_progress:)/.test(k);
  }

  /* ⚠️ 必须挂在 **localStorage 实例**上，不能只挂原型。

     实测：`hansen_cred_trap_v1085`（凭证生死簿）直接在实例上覆盖了 setItem，
     而**实例属性优先于原型** —— 我改原型，调用时根本走不到。
     （debug 时看到 `hasOwnProperty('setItem') === true` 才发现。）

     挂实例还有个好处：谁先谁后都能串起来 ——
     我们包住的是"当前那一层"，不管它是原生还是别人的包装。 */
  /* 🔴v1154：**必须确保自己是最外面那一层，而且要装两次。**

     实测（真浏览器）踩到：改了 localStorage，`hsn-data-changed` **一次都没触发** ——
     整条"自动存云端"的链条实际上是死的，而代码看起来完全正确。

     抓现场才看清：最外层的 setItem 是 `hansen_cred_trap_v1085`（凭证生死簿）的，
     不是我的。它虽然写在页面很靠前的位置，
     **但真正装钩子是在 DOM 就绪之后** —— 时序上排在我后面，把我这层盖掉了。

     被盖住的后果不是"少一个功能"，是**用户玩的进度根本不会自动上云**。

     做法：把挂载抽成可重复调用的 `install()`，
     **加载时装一次、DOM 就绪后再装一次** ——
     谁后装谁在外面，第二次就把我们重新顶到最外层。
     （`__hsnHooked` 改成记在函数上，允许重装但不会无限套娃。） */
  function install() {
  try {
    var ls = window.localStorage;
    if (!ls) return;
    if (Storage.prototype.setItem && Storage.prototype.setItem.__hsnMine) return;   /* 已经是最外层，不用重装 */
    var rawSet = Storage.prototype.setItem.bind(ls);
    var rawRemove = ls.removeItem.bind(ls);
    var timer = null;

    function ping(k) {
      if (!worthSync(k)) return;
      /* 自己也做一次节流：连答十题不必派发十次事件 */
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        try { document.dispatchEvent(new CustomEvent('hsn-data-changed')); } catch (e) {}
      }, 400);
    }

    ls.setItem = function (k, v) {
      var r = rawSet(k, v);
      try { ping(String(k)); } catch (e) {}
      return r;
    };
    ls.removeItem = function (k) {
      var r = rawRemove(k);
      try { ping(String(k)); } catch (e) {}
      return r;
    };
    try {
      Storage.prototype.setItem.__hsnMine = 1;      /* 标记"这层是我的"，供重装时判断 */
      ls.removeItem.__hsnMine = 1;
      Object.defineProperty(ls, '__hsnHooked', { value: 1, enumerable: false });
    } catch (e) { ls.__hsnHooked = 1; }
  } catch (e) {}
  }

  install();
  /* DOM 就绪后再装一次 —— 那时别人（比如凭证生死簿）已经装完，
     我们重新顶到最外层，事件才真的会发出来。 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    setTimeout(install, 0);
  }
  window.addEventListener('load', install);
})();
