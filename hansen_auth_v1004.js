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
  /* 🔴v1012: SDK 的 getCurrentUser() 与 getLoginState() **都返回 Promise**，
     v1004 当同步用 → 拿到 Promise 对象、.uid 为 undefined → 误报「登录状态异常」，
     而实际上注册/登录已经成功。此处改为异步解析，并做多路兜底。 */
  function currentUserAsync() {
    return auth().then(function (a) {
      if (typeof a.getCurrentUser === 'function') {
        return Promise.resolve(a.getCurrentUser()).catch(function () { return null; });
      }
      return null;
    }).then(function (u) {
      if (u && u.uid) return u;
      /* 兜底：从登录态里取 */
      return auth().then(function (a) {
        if (typeof a.getLoginState !== 'function') return null;
        return Promise.resolve(a.getLoginState()).catch(function () { return null; });
      }).then(function (st) {
        if (!st) return null;
        return st.user || (st.uid ? st : null);
      });
    }).catch(function () { return null; });
  }
  /* 同步版仅用于 UI 判定：以本地缓存的登录态为准（登录成功时会写入 uid） */
  function isSignedIn() {
    try {
      var lc = readLocal();
      /* uid 可能因 SDK 异步而暂时读不到, 但只要签入成功(有登录方式+时间戳)就是已登录 */
      return !!(lc.method && lc.signedAt);
    } catch (e) { return false; }
  }
  function currentUser() {
    var lc = readLocal();
    return lc.uid ? { uid: lc.uid } : null;
  }

  /* 友好错误文案：把云端英文错误翻成人话 */
  function friendly(err) {
    var m = String((err && (err.message || err.error_description || err.code)) || err || '');
    if (/domain|origin|not.*allow|403/i.test(m)) return '这个网址还没加进安全域名白名单（控制台改完要等约 10 分钟生效）';
    /* 🔴v1009: 原正则过宽, 把注册参数错误也误报成"验证码不对", 误导排查。
       只认真正的验证码错误, 其余保留原文 + 提示可反馈。 */
    if (/invalid.*(verification[_ ]?code|verify[_ ]?code|sms[_ ]?code)|verification[_ ]?code.*(invalid|expired|incorrect|wrong)|code.*(expired|incorrect)|验证码(错误|不正确|已过期)/i.test(m))
      return '验证码不对或已过期，重新获取一次';
    if (/frequent|too many|限频|频繁/i.test(m)) return '发得太频繁了，等一会儿再试';
    if (/password/i.test(m)) return '密码不对';
    if (/exist/i.test(m)) return '这个账号已经注册过了，直接登录就行';
    if (/network|fetch|ERR_/i.test(m)) return '连不上服务器，检查一下网络';
    if (/sms|短信/i.test(m)) return '短信服务还没开通或余额不足（控制台看一下）';
    /* 未识别的错误保留原文——宁可显示英文, 也别用错误的中文误导排查 */
    return m ? ('登录没成功：' + m.slice(0, 90)) : '操作失败，再试一次';
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
    /* 🔴v1009 关键修正：注册与登录走**不同**的参数形状，此前混用导致
       "验证码明明输对却报错"——
         · 新用户注册：signUp({phone_number, verification_code}) 收**原始短信码**，
           绝不能先调 verify()，否则验证码在那一步已被消耗；
         · 老用户登录：先 verify() 换 verification_token，再 signIn({username, verification_token})。 */
    return auth().then(function (a) {
      if (!st.isUser) {
        return a.signUp({ phone_number: st.pendingPhone, verification_code: c })
          .catch(function (e1) {
            /* 兜底：若该环境的 signUp 走 token 形状，则补做 verify 再试一次 */
            return a.verify({ verification_id: st.verificationId, verification_code: c })
              .then(function (v) {
                var tk = v && v.verification_token;
                if (!tk) throw e1;
                return a.signUp({ phone_number: st.pendingPhone, verification_token: tk });
              })
              .catch(function () { throw e1; });   /* 报出第一手错误，别被兜底掩盖 */
          });
      }
      return a.verify({ verification_id: st.verificationId, verification_code: c })
        .then(function (v) {
          var token = v && v.verification_token;
          if (!token) throw new Error('验证失败，重新获取验证码');
          return a.signIn({ username: st.pendingPhone, verification_token: token });
        });
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
    return currentUserAsync().then(function (u) {
      var uid = u && u.uid;
      if (!uid) {
        /* 🔴v1012: 读不到 uid **不等于登录失败**——签入这一步已经成功了。
           以前在这里直接判失败，用户看到「登录状态异常」，实际账号已注册好。
           这里标记为已登录，竞赛 ID 留待下次进入时补发。 */
        writeLocal({ signedAt: Date.now() });
        return { ok: true, uid: '', cid: 0, pendingId: true };
      }
      writeLocal({ uid: uid });
      /* 🔴v1028: 登录成功后作废云存档已缓存的实例, 让它按账号身份重建, 
         否则它可能仍拿着登录前的匿名身份读写。 */
      try { if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp(); } catch (e) {}
      return ensureProfile(uid)
        .catch(function () { return null; })
        .then(function (prof) {
          return syncOnLogin().then(function (s) {
            return { ok: true, uid: uid, cid: (prof && prof.cid) || 0,
                     pendingId: !(prof && prof.cid), sync: s };
          });
        });
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
  /* 🔴v1017 登录后自动对账：让「登录 = 找回全部进度」真正成立
     · 云端有档 + 本机没进度 → 直接恢复（换新设备的典型场景）
     · 云端有档 + 本机也有进度 → 交给用户选，绝不静默覆盖任何一边
     · 云端没档 → 把本机进度传上去，这个账号从此有档 */
  function localHasProgress() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k));
          if (o && ((o.learned && o.learned.length) || (o.stats && Object.keys(o.stats).length))) return true;
        }
      }
    } catch (e) {}
    return false;
  }
  /* 本机进度的规模，用于冲突时给用户看真实数字 */
  function localProgressSize() {
    var islands = 0, learned = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          if (o && o.learned && o.learned.length) { islands++; learned += o.learned.length; }
        }
      }
    } catch (e) {}
    return { islands: islands, learned: learned };
  }

  function syncOnLogin() {
    var CS = window.HansenCloudSave;
    if (!CS || typeof CS.accountCloudInfo !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return CS.accountCloudInfo().then(function (info) {
      var hasLocal = localHasProgress();
      var local = localProgressSize();
      /* 🔴v1029 安全红线一：**查不到 ≠ 没有**。
         网络抖动或权限问题都会让查询失败，此时若当成"云端没有"就去上传，
         可能用本机(甚至是空的)覆盖掉云端的真实存档。查不到就什么都不做。 */
      if (info && info.exists === null) {
        return { ok: false, action: 'cloud-unreachable', reason: info.reason || '' };
      }
      var hasCloud = !!(info && info.exists);
      /* 🔴v1029 安全红线二：**本机是空的就绝不上传**。
         设备B(全新、无进度)先登录时若上传空档，
         设备A 之后登录就会看到"云端有档"，一旦选错就全丢了。 */
      if (!hasCloud && !hasLocal) {
        return { ok: true, action: 'nothing-to-sync' };
      }
      if (hasCloud && !hasLocal) {
        return CS.restoreWithKey(CS.ensureKey())
          .then(function (r) {
            /* 🔴v1026 关键：恢复只是把数据写回 localStorage，
               而页面内存里的 S 仍是登录前那份空数据 —— 不刷新的话
               ① 用户看到"等级没变、什么都没变"；
               ② 页面下一次存档会用内存里的空数据**覆盖掉刚恢复的进度**。
               所以恢复成功必须重新加载页面，让新数据真正生效。 */
            if (r && r.ok) return { ok: true, action: 'restored', needReload: true };
            return { ok: false, action: 'restore-failed' };
          })
          .catch(function () { return { ok: false, action: 'restore-failed' }; });
      }
      if (hasCloud && hasLocal) {
        /* 冲突：把双方的真实规模一并带出去，让用户看着数字选，而不是盲选 */
        return { ok: true, action: 'conflict',
                 local: local,
                 cloudUpdatedAt: (info && info.updatedAt) || 0 };
      }
      return CS.syncNow({ force: true })
        .then(function (r) { return { ok: !!(r && r.ok), action: 'uploaded' }; })
        .catch(function () { return { ok: false, action: 'upload-failed' }; });
    }).catch(function () { return { ok: false, reason: 'sync-error' }; });
  }


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
    currentUserAsync: currentUserAsync,
    readLocal: readLocal,
    normPhone: normPhone,
    friendly: friendly,
    sendPhoneCode: sendPhoneCode,
    loginByPhoneCode: loginByPhoneCode,
    loginByPassword: loginByPassword,
    signOut: signOut,
    ensureProfile: ensureProfile,
    pushSave: pushSave,
    syncOnLogin: syncOnLogin,
    localHasProgress: localHasProgress,
    localProgressSize: localProgressSize,
    pullSave: pullSave,
    _app: app
  };
})();
