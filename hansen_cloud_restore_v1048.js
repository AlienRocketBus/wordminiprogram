/* hansen_cloud_restore_v1048.js —— 开机检查 + 一键从云端恢复
 *
 * 缺口（用户实测暴露）：两台设备的账号标识、地址、上传下载都已对齐，
 * 云端也确实有存档，但在手机 B 上打开应用**仍然是 Lv.1**。
 *
 * 原因：恢复逻辑只挂在「登录成功」那一刻（syncOnLogin）。
 * 而手机 B 早就处于登录状态 —— 打开应用不算"登录"，那段代码根本没被触发。
 * 于是形成一个死角：**已登录的设备永远等不到恢复。**
 *
 * 本模块把恢复从"登录时一次性事件"改为"每次打开都检查的常态"：
 *   ① 应用启动后（空闲时）若已登录，就去云端看一眼；
 *   ② 云端存档比本机新、或本机根本没有进度 → 弹出明确提示，一键恢复；
 *   ③ 提供 HansenCloudRestore.now() 供按钮直接调用，随时可手动恢复；
 *   ④ 恢复成功后自动重新载入页面，否则内存里仍是旧数据（v1026 的教训）。
 *
 * 绝不静默覆盖：任何会替换本机进度的动作都要用户点头。
 */
(function () {
  'use strict';
  if (window.HansenCloudRestore) return;

  var ASKED_KEY = 'hansen_restore_asked_v1048';   /* 记住"这份云端存档已问过" */

  function signedIn() {
    try {
      var A = window.HansenAuth;
      return !!(A && typeof A.isSignedIn === 'function' && A.isSignedIn());
    } catch (e) { return false; }
  }
  function CS() { return window.HansenCloudSave; }

  function localProgress() {
    var islands = 0, learned = 0, xp = 0;
    try {
      xp = +localStorage.getItem('hansen_wallet_charxp') || 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          if (o && o.learned && o.learned.length) { islands++; learned += o.learned.length; }
        }
      }
    } catch (e) {}
    return { islands: islands, learned: learned, xp: xp };
  }

  /* 本机上次成功上传的时间（用于判断云端是不是更新） */
  function localLastUp() {
    try {
      var st = JSON.parse(localStorage.getItem('hansen_cloud_state_v965') || '{}');
      return +st.lastUpAt || 0;
    } catch (e) { return 0; }
  }

  function alreadyAsked(stamp) {
    try { return localStorage.getItem(ASKED_KEY) === String(stamp); } catch (e) { return false; }
  }
  function markAsked(stamp) {
    try { localStorage.setItem(ASKED_KEY, String(stamp)); } catch (e) {}
  }

  /* 立即从云端恢复（供按钮直接调用） */
  function now(opts) {
    opts = opts || {};
    var cs = CS();
    if (!cs || typeof cs.restoreWithKey !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    if (!signedIn())
      return Promise.resolve({ ok: false, reason: 'not-signed-in' });
    return cs.restoreWithKey(cs.ensureKey()).then(function (r) {
      if (r && r.ok) {
        if (opts.silent !== true) {
          try { alert('已从云端找回你的进度，页面即将重新载入。'); } catch (e) {}
        }
        /* 必须重载：不然内存里还是旧数据，界面看着毫无变化，
           而且下次保存会用旧数据把刚恢复的覆盖掉（v1026 的教训）。 */
        setTimeout(function () { try { location.reload(); } catch (e) {} }, 600);
        return { ok: true };
      }
      return { ok: false, reason: (r && r.reason) || 'restore-failed' };
    }).catch(function (e) {
      return { ok: false, reason: String((e && e.message) || e).slice(0, 160) };
    });
  }

  /* 开机检查：已登录 + 云端有档 + （本机没进度 或 云端更新）→ 主动询问 */
  function check() {
    if (!signedIn()) return Promise.resolve({ skip: 'not-signed-in' });
    var cs = CS();
    if (!cs || typeof cs.accountCloudInfo !== 'function')
      return Promise.resolve({ skip: 'unavailable' });
    return cs.accountCloudInfo().then(function (info) {
      if (!info || info.exists !== true) return { skip: 'no-cloud-save' };
      var lp = localProgress();
      var cloudAt = +info.updatedAt || 0;
      var localAt = localLastUp();
      var localEmpty = (lp.learned === 0 && lp.xp === 0);
      var cloudNewer = cloudAt > 0 && cloudAt > localAt + 60000;   /* 留 1 分钟容差 */
      if (!localEmpty && !cloudNewer) return { skip: 'local-is-current' };
      if (alreadyAsked(cloudAt)) return { skip: 'already-asked' };
      markAsked(cloudAt);
      var when = cloudAt ? new Date(cloudAt).toLocaleString() : '时间未知';
      var msg = localEmpty
        ? ('☁️ 这个账号在云端有一份存档（保存于 ' + when + '）。\n\n'
           + '本机目前没有进度。要现在恢复吗？')
        : ('☁️ 云端有一份更新的存档（保存于 ' + when + '）。\n\n'
           + '本机当前：' + lp.islands + ' 个岛 · 已学 ' + lp.learned + ' 词\n\n'
           + '恢复会用云端进度替换本机当前进度，确定吗？');
      var yes = false;
      try { yes = confirm(msg); } catch (e) {}
      if (!yes) return { skip: 'user-declined' };
      return now({ silent: true }).then(function (r) {
        if (!r.ok) { try { alert('恢复没成功：' + (r.reason || '未知原因')); } catch (e) {} }
        return r;
      });
    }).catch(function (e) { return { skip: 'error', reason: String((e && e.message) || e).slice(0, 120) }; });
  }

  function boot() {
    var run = function () { check(); };
    if (typeof window.requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 6000 });
    else setTimeout(run, 3500);
    /* 登录状态变化后再查一次（刚登录的设备也能立刻收到提示） */
    try { document.addEventListener('hsn-auth-changed', function () { setTimeout(run, 1200); }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenCloudRestore = { check: check, now: now, _localProgress: localProgress };
})();
