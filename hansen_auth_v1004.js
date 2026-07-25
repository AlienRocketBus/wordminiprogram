/* hansen_auth_v1004.js —— 账号系统：注册 / 登录 / 跨设备存档 / 竞赛 ID 发号
 *
 * 登录方式（对应控制台已开通的三种）：
 *   ① 手机号 + 短信验证码   —— 主力，注册与登录合一（is_user 判断走 signUp 还是 signIn）
 *   ② 用户名 + 密码         —— 备用
 *   ③ 匿名                  —— 不注册也能玩，之后可升级为正式账号
 *
 * 竞赛 ID 发号方案（不依赖云函数）：
 *   counters 集合设为 ADMINONLY，客户端写不了，所以**不走计数器**。
 *   改用「注册时间排名」：sb_profile 里 createdAt 由**服务端**写入（客户端伪造不了），
 *   竞赛 ID = 比我早注册的人数 + 1。一次算定后锁死，此后终身不变。
 */
(function () {
  'use strict';
  if (window.HansenAuth) return;

  var COL_PROFILE = 'sb_profile';
  var LKEY = 'hansen_auth_v1004';      /* 本地登录态缓存 */

  /* ── 基础 ─────────────────────────────────────────── */
  function cfg() {
    try {
      var c = window.HANSEN_CLOUD_CONFIG;
      return (c && typeof c === 'object' && c.envId) ? c : null;
    } catch (e) { return null; }
  }
  function ready() { return !!cfg(); }

  function readLocal() {
    try {
      var o = JSON.parse(localStorage.getItem(LKEY));
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function writeLocal(patch) {
    var o = readLocal();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) o[k] = patch[k];
    try { localStorage.setItem(LKEY, JSON.stringify(o)); } catch (e) {}
    return o;
  }

  /* 归一手机号：11 位国内号 → +86 前缀 */
  function normPhone(raw) {
    var s = String(raw == null ? '' : raw).replace(/[\s\-()]/g, '');
    if (/^1\d{10}$/.test(s)) return '+86 ' + s;
    if (/^\+86\d{11}$/.test(s)) return '+86 ' + s.slice(3);
    if (/^\+\d{6,15}$/.test(s)) return s;
    return null;
  }

  /* ── CloudBase 应用与鉴权 ─────────────────────────── */
  var _app = null, _auth = null;
  function app() {
    if (_app) return Promise.resolve(_app);
    var c = cfg();
    if (!c) return Promise.reject(new Error('云服务未配置'));
    return import('./vendor_cloudbase_esm_v1004.js').catch(function () {
      return import('./vendor_cloudbase_esm_v965.js');
    }).then(function (mod) {
      var cb = mod && (mod.default || mod);
      var init = cb && (cb.init || (cb.default && cb.default.init));
      if (typeof init !== 'function') throw new Error('云 SDK 加载失败');
      _app = init.call(cb, c.region ? { env: c.envId, region: c.region } : { env: c.envId });
      _auth = _app.auth ? _app.auth() : null;
      return _app;
    });
  }
  function auth() { return app().then(function () { if (!_auth) throw new Error('鉴权不可用'); return _auth; }); }

  /* ── 登录态 ───────────────────────────────────────── */
  function currentUser() {
    try {
      if (_auth && typeof _auth.getCurrentUser === 'function') return _auth.getCurrentUser();
      if (_auth && _auth.currentUser) return _auth.currentUser;
    } catch (e) {}
    return null;
  }
  function isSignedIn() {
    var u = currentUser();
    return !!(u && u.uid && !u.isAnonymous);
  }

  /* 友好错误文案：把云端英文错误翻成人话 */
  function friendly(err) {
    var m = String((err && (err.message || err.error_description || err.code)) || err || '');
    if (/domain|origin|not.*allow|403/i.test(m)) return '这个网址还没加进安全域名白名单（控制台改完要等约 10 分钟生效）';
    if (/verification.*code|code.*invalid|验证码/i.test(m)) return '验证码不对或已过期，重新获取一次';
    if (/frequent|too many|限频|频繁/i.test(m)) return '发得太频繁了，等一会儿再试';
    if (/password/i.test(m)) return '密码不对';
    if (/exist/i.test(m)) return '这个账号已经注册过了，直接登录就行';
    if (/network|fetch|ERR_/i.test(m)) return '连不上服务器，检查一下网络';
    if (/sms|短信/i.test(m)) return '短信服务还没开通或余额不足（控制台看一下）';
    return m || '操作失败，再试一次';
  }

  /* ── ① 手机号验证码：发码 ───────────────────────── */
  function sendPhoneCode(phoneRaw) {
    var phone = normPhone(phoneRaw);
    if (!phone) return Promise.reject(new Error('手机号格式不对，填 11 位就行'));
    return auth().then(function (a) {
      return a.getVerification({ phone_number: phone });
    }).then(function (res) {
      writeLocal({ pendingPhone: phone, verificationId: res && res.verification_id, isUser: !!(res && res.is_user) });
      return { ok: true, isUser: !!(res && res.is_user), phone: phone };
    });
  }

  /* ── ① 手机号验证码：验码并登录/注册 ────────────── */
  function loginByPhoneCode(code) {
    var st = readLocal();
    if (!st.verificationId) return Promise.reject(new Error('请先获取验证码'));
    var c = String(code == null ? '' : code).trim();
    if (!/^\d{4,8}$/.test(c)) return Promise.reject(new Error('验证码是几位数字，检查一下'));
    var a2 = null;
    return auth().then(function (a) {
      a2 = a;
      return a.verify({ verification_id: st.verificationId, verification_code: c });
    }).then(function (v) {
      var token = v && v.verification_token;
      if (!token) throw new Error('验证失败，重新获取验证码');
      /* 已注册 → 登录；未注册 → 注册（注册后即为登录态） */
      if (st.isUser) return a2.signIn({ username: st.pendingPhone, verification_token: token });
      return a2.signUp({ phone_number: st.pendingPhone, verification_token: token });
    }).then(function () {
      writeLocal({ verificationId: '', method: 'phone', phone: st.pendingPhone, signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ② 用户名 + 密码 ─────────────────────────────── */
  function loginByPassword(username, password) {
    var u = String(username == null ? '' : username).trim();
    var p = String(password == null ? '' : password);
    if (u.length < 2) return Promise.reject(new Error('用户名太短'));
    if (p.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    return auth().then(function (a) {
      return a.signIn({ username: u, password: p });
    }).then(function () {
      writeLocal({ method: 'password', username: u, signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ③ 登出 ─────────────────────────────────────── */
  function signOut() {
    return auth().then(function (a) {
      return a.signOut ? a.signOut() : null;
    }).catch(function () { return null; }).then(function () {
      writeLocal({ method: '', signedAt: 0, uid: '' });
      return { ok: true };
    });
  }

  /* ── 登录之后：建档 + 发号 ──────────────────────── */
  function afterSignIn() {
    var u = currentUser();
    var uid = u && u.uid;
    if (!uid) return Promise.reject(new Error('登录状态异常，重新登录一次'));
    writeLocal({ uid: uid });
    return ensureProfile(uid).then(function (prof) {
      return { ok: true, uid: uid, cid: prof && prof.cid };
    });
  }

  /* 建立/读取云端档案，并分配竞赛 ID */
  function ensureProfile(uid) {
    var db = null, docRef = null;
    return app().then(function (a) {
      db = a.database();
      docRef = db.collection(COL_PROFILE).doc(uid);
      return docRef.get();
    }).then(function (res) {
      var row = res && res.data && res.data[0];
      if (row && row.cid > 0) return row;                 /* 已有号码 → 直接用 */
      if (row) return assignCid(db, docRef, row.createdAt);
      /* 首次：建档，createdAt 用服务端时间（客户端伪造不了 → 排名可信） */
      return docRef.set({
        uid: uid,
        name: (localProfileName() || ''),
        cid: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }).then(function () { return docRef.get(); }).then(function (r2) {
        var row2 = r2 && r2.data && r2.data[0];
        return assignCid(db, docRef, row2 && row2.createdAt);
      });
    }).then(function (prof) {
      if (prof && prof.cid > 0) {
        try {
          if (window.HansenSbProfile && HansenSbProfile.claimCloudId) HansenSbProfile.claimCloudId(prof.cid);
        } catch (e) {}
      }
      return prof;
    });
  }

  /* 竞赛 ID = 比我早注册的人数 + 1，一次算定后写回并锁死 */
  function assignCid(db, docRef, createdAt) {
    if (!createdAt) return Promise.resolve(null);
    return db.collection(COL_PROFILE).where({ createdAt: db.command.lt(createdAt) }).count()
      .then(function (r) {
        var cid = ((r && r.total) || 0) + 1;
        return docRef.update({ cid: cid, updatedAt: db.serverDate() }).then(function () {
          return { cid: cid };
        });
      })
      .catch(function () { return null; });   /* 发号失败不阻断登录，下次登录再补 */
  }

  function localProfileName() {
    try {
      if (window.HansenSbProfile) return (HansenSbProfile.readProfile() || {}).name || '';
    } catch (e) {}
    return '';
  }

  /* ── 跨设备存档 ─────────────────────────────────── */
  /* 登录后把本地进度推上云 */
  function pushSave() {
    if (!window.HansenCloudSave || typeof HansenCloudSave.syncNow !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return HansenCloudSave.syncNow({ force: true });
  }
  /* 换设备登录后把云端进度拉下来（需要 16 位密钥，沿用现有恢复通道） */
  function pullSave(key) {
    if (!window.HansenCloudSave || typeof HansenCloudSave.restoreWithKey !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return HansenCloudSave.restoreWithKey(key);
  }

  window.HansenAuth = {
    ready: ready,
    isSignedIn: isSignedIn,
    currentUser: currentUser,
    readLocal: readLocal,
    normPhone: normPhone,
    friendly: friendly,
    sendPhoneCode: sendPhoneCode,
    loginByPhoneCode: loginByPhoneCode,
    loginByPassword: loginByPassword,
    signOut: signOut,
    ensureProfile: ensureProfile,
    pushSave: pushSave,
    pullSave: pullSave,
    _app: app
  };
})();
