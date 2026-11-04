/* hansen_cred_guard_v1092.js —— 凭证守护：刷新失败时把凭证救回来
 *
 * ═══ 为什么必须有这个 ═══
 *
 * 读 CloudBase SDK 源码确认的完整链条（不是推测）：
 *
 *   1) 过期判据：
 *        function qe(t){ var e = true;                      // ← **默认就算过期**
 *          if (t?.expires_at && t?.access_token) e = (t.expires_at < new Date);
 *          return e; }
 *      凭证只要缺 expires_at 或 access_token，就被当成过期 → 立刻发起刷新。
 *
 *   2) 刷新失败后的分支：
 *        if (刷新失败) {
 *          if (scope === "anonymous") → anonymousLogin() 重新登录兜底 ✅
 *          else                        → reject + onCredentialsError → **凭证被删** ❌
 *        }
 *      **手机号登录的会话，刷新一旦失败就没有任何兜底，直接完蛋。**
 *
 *   3) 而刷新为什么会失败 —— 用户真机日志写得很清楚：
 *        HTTP 400 /auth/v1/token
 *        invalid_grant | invalid refresh token. for it may be has been refreshed by
 *      **refresh_token 已经被"别人"刷新过了。**
 *
 * v1088~v1091 已经把「同一页面内多实例」压到 1 个。
 * 但还有一类并发管不到：**多个标签页 / 多次打开小程序**，
 * 它们是各自独立的 JS 环境，却共用同一个 localStorage 凭证槽位。
 * A 页刷新成功写入新 token，B 页手里还是旧的 → 下一次刷新必然 invalid_grant。
 *
 * ═══ 做法 ═══
 *
 * SDK 内部的刷新逻辑我们改不了，但可以在外面兜住：
 *   ① **持续备份**：凭证每次变化就存一份影子副本（带时间戳）
 *   ② **失败即救回**：一旦发现凭证被删（而本地登录记录还在、且刚登录不久），
 *      把影子副本写回去 —— 让用户不至于因为一次刷新失败就被踢出登录
 *   ③ **跨页面刷新锁**：用 localStorage 做一把带超时的锁，
 *      同一时刻只允许一个页面去刷新，从源头减少并发
 *
 * ⚠️ 极其克制：
 *   · 只在「本地明确记着已登录」时才救，绝不凭空造凭证
 *   · 影子副本超过 12 小时不再使用（避免拿一个真过期的凭证反复送死）
 *   · 每次登录会话最多救 3 次，之后不再干预（防止死循环）
 *
 * 🔴v1164：「每次登录会话最多 3 次」以前**从没重置过** —— reset() 没人调用，
 *   计数一辈子只增不减，一台设备救满 3 次之后守护就永久失效了。
 *   现在：SDK 拿到**新的 refresh_token**（新登录或刷新成功）就说明会话是活的，计数清零；
 *   账号模块在登录成功时 reset()+backup()，退出时 reset()。
 *   救回来的还是同一个 refresh_token，所以死掉的会话最多仍只救 3 次，不会转圈。
 */
(function () {
  'use strict';
  if (window.HansenCredGuard) return;

  var SHADOW = 'hansen_cred_shadow';
  var RESCUE_COUNT = 'hansen_cred_rescue_n';
  var LOCK = 'hansen_cred_refresh_lock';
  var MAX_RESCUE = 3;
  var SHADOW_TTL = 12 * 3600 * 1000;   /* 影子副本最多信 12 小时 */
  var LOCK_TTL = 8000;                 /* 刷新锁 8 秒自动释放，防止卡死 */

  var rawSet = null, rawGet = null, rawRemove = null;
  try {
    var proto = Object.getPrototypeOf(localStorage) ||
                (typeof Storage !== 'undefined' ? Storage.prototype : null);
    rawSet = (proto && proto.setItem) || localStorage.setItem;
    rawGet = (proto && proto.getItem) || localStorage.getItem;
    rawRemove = (proto && proto.removeItem) || localStorage.removeItem;
  } catch (e) {}

  function ls(fn, a, b) {
    try { return fn.call(localStorage, a, b); } catch (e) { return null; }
  }

  function credKey() {
    try {
      /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk1=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk1.length;i++){
        var k = _lsk1[i] || '';
        if (/^credentials/i.test(k)) return k;
      }
    } catch (e) {}
    /* 没有现成的键：按 envId 拼一个（SDK 的命名规则是 credentials_<envId>）*/
    try {
      var c = window.HANSEN_CLOUD_CONFIG;
      if (c && c.envId) return 'credentials_' + c.envId;
    } catch (e) {}
    return '';
  }

  function signedInLocally() {
    try {
      var lc = JSON.parse(ls(rawGet, 'hansen_auth_v1004') || 'null');
      return !!(lc && lc.method && lc.signedAt);
    } catch (e) { return false; }
  }

  function rtOf(v) {
    try { var o = JSON.parse(v); return (o && o.refresh_token) ? String(o.refresh_token) : ''; } catch (e) { return ''; }
  }

  /* ── ① 持续备份 ───────────────────────────────────────── */
  function backup() {
    if (holdFresh()) return;      /* 刚刷新成功的几秒里，先保住新票（见 holdFresh） */
    var k = credKey();
    if (!k) return;
    var v = ls(rawGet, k);
    if (!v || String(v).length < 50) return;      /* 太短的不像真凭证 */
    try {
      var old = null;
      try { old = JSON.parse(ls(rawGet, SHADOW) || 'null'); } catch (e) {}
      /* v1164：refresh_token 换了 = 新登录或刷新成功 → 会话是活的，救援次数重新计 */
      if (!old || !old.val || rtOf(old.val) !== rtOf(String(v))) ls(rawRemove, RESCUE_COUNT);
      ls(rawSet, SHADOW, JSON.stringify({ key: k, val: String(v), at: Date.now() }));
    } catch (e) {}
  }

  /* 🔴v1164（审查 AUTH-5）：刷新成功的那一刻，直接从回复里把新凭证存进影子副本 ——
     不能等 SDK 写进存储再去抄：另一个页面拿旧票刷新被拒时，它的 SDK 会把存储里的凭证删掉，
     连这个页面刚写进去的新票一起删（实测：两个页面同一毫秒刷新，30 毫秒后去抄已经抄不到了）。
     存储里这时要是没有凭证，就把这张新票写回去 —— 这正是这个页面的 SDK 手里正在用的那一张。
     格式和 SDK 自己存的一样：回复原样 + expires_at（SDK 的算法：expires_in 减 30 秒）。 */
  var _fresh = null;   /* 这个页面最近一次刷新成功换到的票：{ rt, val, key, at, dead }（dead = 刷新时交出去、已作废的那张） */
  function keepFresh(j, dead) {
    try {
      if (!j || !j.access_token || !j.refresh_token || !j.expires_in) return;
      var k = credKey();
      if (!k) return;
      var o = {};
      for (var x in j) if (Object.prototype.hasOwnProperty.call(j, x)) o[x] = j[x];
      if (!o.expires_at) o.expires_at = new Date(Date.now() + 1000 * (Number(o.expires_in) - 30));
      var v = JSON.stringify(o);
      _fresh = { rt: String(j.refresh_token), val: v, key: k, at: Date.now(), dead: String(dead || '') };
      ls(rawSet, SHADOW, JSON.stringify({ key: k, val: v, at: Date.now() }));
      ls(rawRemove, RESCUE_COUNT);
      holdFresh();
    } catch (e) {}
  }
  /* 刷新成功后的几秒里，存储里的凭证要是被删了、或者被另一个页面救回了一张作废的旧票（它的影子副本还是旧的），
     就把这张新票写回去 —— 这是这个页面的 SDK 手里正在用的票，也是唯一还活着的那张。
     只管 8 秒：再往后就是正常的「谁刷新谁写」。 */
  function holdFresh() {
    try {
      if (!_fresh || (Date.now() - _fresh.at) > 8000) return false;
      if (!signedInLocally()) return false;          /* 退出登录了：绝不把凭证写回去 */
      var cur = ls(rawGet, _fresh.key);
      /* 只在「没有凭证」或「存的正是那张已作废的旧票」时写回 —— 别的票（刚换了账号、别的页面后来又刷新过）一律不碰 */
      var gone = !cur || String(cur).length < 50;
      if (gone || (_fresh.dead && rtOf(String(cur)) === _fresh.dead)) {
        ls(rawSet, _fresh.key, _fresh.val);
        ls(rawSet, SHADOW, JSON.stringify({ key: _fresh.key, val: _fresh.val, at: Date.now() }));
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ── ② 失败即救回 ─────────────────────────────────────── */
  /* newerThan（v1164 审查 AUTH-5）：「再看一眼」时只救**别的票** —— 影子副本是这个时刻之后备份的，
     或者里面的 refresh_token 和上一次救回去的那张不一样（别的页面刚换到的）。同一张作废的票不救第二次。 */
  var _lastRt = '';
  function rescue(why, newerThan) {
    if (!signedInLocally()) return false;          /* 本地都没登录，不救 */
    var k = credKey();
    if (k && String(ls(rawGet, k) || '').length > 50) return false;   /* 凭证还在，不用救 */

    var n = 0;
    try { n = Number(ls(rawGet, RESCUE_COUNT) || 0); } catch (e) {}
    if (n >= MAX_RESCUE) return false;             /* 救太多次说明真的坏了，别再折腾 */

    var shadow = null;
    try { shadow = JSON.parse(ls(rawGet, SHADOW) || 'null'); } catch (e) {}
    if (!shadow || !shadow.key || !shadow.val) return false;
    if (Date.now() - (shadow.at || 0) > SHADOW_TTL) return false;     /* 太老了，不信 */
    if (newerThan && (shadow.at || 0) <= newerThan && rtOf(shadow.val) === _lastRt) return false;   /* 还是那张作废的票 */

    try {
      ls(rawSet, shadow.key, shadow.val);
      _lastRt = rtOf(shadow.val);
      ls(rawSet, RESCUE_COUNT, String(n + 1));
      try {
        if (window.HansenCredTrap && HansenCredTrap.mark)
          HansenCredTrap.mark('🛟 凭证已救回', (why || '') + '（第 ' + (n + 1) + ' 次）');
      } catch (e) {}
      try { console.warn('[凭证守护] 凭证被删，已用影子副本救回：' + (why || '')); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  /* ── ③ 跨页面刷新锁 ───────────────────────────────────── */
  function acquireLock() {
    try {
      var cur = Number(ls(rawGet, LOCK) || 0);
      if (cur && (Date.now() - cur) < LOCK_TTL) return false;   /* 别的页面正在刷新 */
      ls(rawSet, LOCK, String(Date.now()));
      return true;
    } catch (e) { return true; }
  }
  function releaseLock() { try { ls(rawRemove, LOCK); } catch (e) {} }

  /* 劫持刷新请求：同一时刻只放一个页面出去 */
  try {
    if (typeof fetch === 'function') {
      var rawFetch = window.fetch;
      window.fetch = function (input) {
        var u = (typeof input === 'string') ? input : ((input && input.url) || '');
        var isRefresh = /\/auth\/v1\/token/i.test(String(u));
        if (isRefresh) {
          if (!acquireLock()) {
            /* 别的页面正在刷新 —— 等它一下，然后用它刷出来的结果，
               而不是自己也发一次（那正是 invalid_grant 的来源）。 */
            return new Promise(function (res) { setTimeout(res, 1200); })
              .then(function () { return rawFetch.apply(window, arguments); }.bind(this, input));
          }
        }
        var arguments0 = arguments;
        var p = rawFetch.apply(this, arguments);
        if (isRefresh) {
          p.then(function (r) {
            releaseLock();
            try {
              if (r && r.status >= 400) {
                /* 刷新失败 → SDK 马上就会删凭证，抢在它前面备份、随后救回 */
                setTimeout(function () { rescue('刷新失败 HTTP ' + r.status); }, 300);
                setTimeout(function () { rescue('刷新失败 HTTP ' + r.status); }, 1500);
              } else if (r && r.status >= 200 && r.status < 300) {
                /* 🔴v1164（审查 AUTH-5）：刷新成功 = 换到了新的 refresh_token，旧的那张从此作废。
                   马上备份（以前要等 3 秒一次的巡查）—— 影子里留的要是旧的那张，另一个页面同时刷新失败、
                   SDK 把凭证删掉时，救回来的就是一张作废的票，两个页面一起被判「登录过期」。 */
                var dead = '';
                try { var b0 = arguments0[1] && arguments0[1].body; dead = (b0 && JSON.parse(String(b0)).refresh_token) || ''; } catch (e4) {}
                try { r.clone().json().then(function (j) { keepFresh(j, dead); }, function () {}); } catch (e3) {}
                [30, 120, 300, 800, 1600, 3000].forEach(function (ms) { setTimeout(backup, ms); });
              }
            } catch (e) {}
            return r;
          })['catch'](function () { releaseLock(); });
        }
        return p;
      };
    }
  } catch (e) {}

  /* 定期备份 + 定期巡查是否被删 */
  function tick() {
    try {
      var k = credKey();
      var has = k && String(ls(rawGet, k) || '').length > 50;
      if (has) backup();
      else rescue('巡查发现凭证不在');
    } catch (e) {}
  }
  try {
    backup();
    setInterval(tick, 3000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') tick();
    });
    /* 登录成功后立刻备份一份 */
    document.addEventListener('hsn-auth-changed', function () {
      setTimeout(backup, 600); setTimeout(backup, 2500);
    });
  } catch (e) {}

  window.HansenCredGuard = {
    backup: backup,
    rescue: rescue,
    status: function () {
      var sh = null;
      try { sh = JSON.parse(ls(rawGet, SHADOW) || 'null'); } catch (e) {}
      return {
        credKey: credKey(),
        hasCred: !!(credKey() && String(ls(rawGet, credKey()) || '').length > 50),
        hasShadow: !!(sh && sh.val),
        shadowAge: sh ? Math.round((Date.now() - (sh.at || 0)) / 1000) : -1,
        rescued: Number(ls(rawGet, RESCUE_COUNT) || 0),
        maxRescue: MAX_RESCUE
      };
    },
    reset: function () { try { ls(rawRemove, RESCUE_COUNT); ls(rawRemove, SHADOW); } catch (e) {} }
  };
})();
