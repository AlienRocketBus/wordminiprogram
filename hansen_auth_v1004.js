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

  /* 🔴v1059 关键修复：把云端错误变成人能读的字。
     整整 40 个版本里，每一条诊断都只显示 `[object Object]`——
     因为 CloudBase 抛出的是一个**普通对象**：
       {"error":"unauthenticated","error_description":"credentials not found"}
     它既不是 Error 实例、也没有 .message，于是 String(e) 退化成 '[object Object]'。
     真正的错因（credentials not found）被这层遮罩挡了 40 版，
     导致每一轮排查都只能靠推理，改对了六七个真 bug 却始终没碰到真凶。
     本函数按优先级逐层挖字段，最后兜底 JSON.stringify，
     **保证今后任何地方都不会再吐出 [object Object]**。 */
  function errText(e) {
    if (e == null) return '';
    if (typeof e === 'string') return e;
    var parts = [];
    var pick = ['error_description', 'errMsg', 'message', 'error', 'code', 'errCode', 'reason'];
    for (var i = 0; i < pick.length; i++) {
      var v = e[pick[i]];
      if (v != null && typeof v !== 'object') {
        var s = String(v);
        if (s && parts.indexOf(s) < 0) parts.push(s);
      }
    }
    if (parts.length) return parts.join(' | ');
    try { var j = JSON.stringify(e); if (j && j !== '{}' && j !== 'null') return j; } catch (_) {}
    try {
      var t = Object.prototype.toString.call(e);
      if (t !== '[object Object]') return t;
    } catch (_) {}
    return '(无法解析的错误对象)';
  }
  /* 立刻挂全局：云存档/恢复/诊断都可能先于本模块用到，取不到时各自有兜底 */
  try { window.HBErrText = errText; } catch (e) {}

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
    /* 🔴v1057 关键修复：这里原本先 import 一个**根本不存在的文件**
       `vendor_cloudbase_esm_v1004.js`（仓库里只有 v965 那一个），
       指望 404 时靠 .catch 退回。但动态 import 的 404 在部分浏览器
       （含微信内置浏览器）不会走 catch 分支，于是整个 SDK 加载失败，
       用户点「获取验证码」只看到"连不上服务器"——手机注册从 v1004
       起就一直是坏的，而这只是一个写错的文件名。
       现在直接 import 真实存在的文件，不再赌 fallback。 */
    return import('./vendor_cloudbase_esm_v965.js').then(function (mod) {
      var cb = mod && (mod.default || mod);
      var init = cb && (cb.init || (cb.default && cb.default.init));
      if (typeof init !== 'function') throw new Error('云 SDK 加载失败');
      _app = init.call(cb, c.region ? { env: c.envId, region: c.region } : { env: c.envId });
      /* 🔴v1031 关键修复：必须显式声明 persistence:'local'。
         默认持久化只在当前会话内有效——页面一刷新/新开标签，
         CloudBase 的登录会话就没了，而本地标记仍写着"已登录"。
         于是云存档拿着一个**未认证**的实例去读账号名下的文档，
         永远读不到，报「云端没有这把密钥对应的存档」。
         云存档模块本来就用的是 {persistence:'local'}，两处必须一致。 */
      _auth = _app.auth ? _app.auth({ persistence: 'local' }) : null;
      return _app;
    });
  }
  /* 🔴v1057: 允许注入替身鉴权对象。
     此前这条"发码→验码→注册→写登录态"的链路**无法在没有真实云端时验证**，
     导致 v1004 那个写错的 SDK 文件名一直没被任何测试发现。
     有了注入口，回归测试就能用假 SDK 跑完整条链，不必依赖网络。 */
  var _authOverride = null;
  function auth() {
    if (_authOverride) return Promise.resolve(_authOverride);
    return app().then(function () { if (!_auth) throw new Error('鉴权不可用'); return _auth; });
  }

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
    if (/exist|already/i.test(m)) return '这个用户名已经有人用了，换一个吧（或点下面切到登录）';
    if (/weak|password.*(short|length)/i.test(m)) return '密码太简单了，换一个长一点的';
    if (/user.*not.*found|no.*such.*user/i.test(m)) return '没找到这个用户名，检查一下拼写，或点下面去注册';
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
      /* 🔴v1058: 先用用户名登录；失败再用"用户名映射出的内部邮箱"重试。
         这样无论账号是用哪种方式建的，用户都只需记住用户名。 */
      return Promise.resolve(a.signIn({ username: u, password: p }))
        .catch(function (e1) {
          var mail = mailOfUsername(u);
          return Promise.resolve(a.signIn({ username: mail, password: p }))
            .catch(function () { throw e1; });
        });
    }).then(function () {
      writeLocal({ method: 'password', username: u, signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ②b 用户名 + 密码「注册」 ────────────────────────
     背景：CloudBase 的注册只支持 email+password 或 phone+验证码，
     **没有"纯用户名+密码"这种注册方式**。
     做法：把用户名确定性地映射成一个内部邮箱（用户完全看不到），
     用它完成注册，随后再把真正的用户名设上去。
     这样用户体验上就是"用户名+密码注册"，而底层走的是官方支持的路径。 */
  var INNER_MAIL_DOMAIN = 'u.wordadventure.local';

  function normUsername(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s.length < 3) return { ok: false, reason: '用户名至少 3 个字' };
    if (s.length > 20) return { ok: false, reason: '用户名最多 20 个字' };
    if (/[\s<>"'`\\/@]/.test(s)) return { ok: false, reason: '用户名不能有空格或 @ < > / 等符号' };
    return { ok: true, name: s };
  }
  /* 用户名 → 内部邮箱：只用 [a-z0-9_] 与十六进制哈希，保证任何字符集都能落到合法邮箱 */
  function mailOfUsername(name) {
    var key = String(name).toLowerCase();
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < key.length; i++) {
      h1 = ((h1 ^ key.charCodeAt(i)) >>> 0) * 16777619 >>> 0;
      h2 = ((h2 + key.charCodeAt(i) * (i + 7)) >>> 0) * 2654435761 >>> 0;
    }
    var safe = key.replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'u';
    return safe + '_' + ((h1 >>> 0).toString(16)) + ((h2 >>> 0).toString(16)) + '@' + INNER_MAIL_DOMAIN;
  }

  function registerByPassword(username, password, password2) {
    var v = normUsername(username);
    if (!v.ok) return Promise.reject(new Error(v.reason));
    var pw = String(password == null ? '' : password);
    if (pw.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    if (password2 !== undefined && String(password2) !== pw)
      return Promise.reject(new Error('两次输入的密码不一样'));
    var mail = mailOfUsername(v.name);
    return auth().then(function (a) {
      var fn = a.signUpWithEmailAndPassword || a.signUp;
      if (typeof fn !== 'function') throw new Error('当前环境不支持用户名注册');
      /* 两种调用签名都兼容：新版是 (email, password)，旧版是 ({email, password}) */
      var p1;
      try { p1 = a.signUpWithEmailAndPassword ? a.signUpWithEmailAndPassword(mail, pw)
                                              : a.signUp({ email: mail, password: pw }); }
      catch (e) { p1 = Promise.reject(e); }
      return Promise.resolve(p1).then(function () {
        /* 注册成功后把真正的用户名设上，便于以后直接用它登录 */
        return Promise.resolve(
          (typeof a.updateUsername === 'function') ? a.updateUsername(v.name) : null
        ).catch(function () { return null; });
      });
    }).then(function () {
      writeLocal({ method: 'password', username: v.name, signedAt: Date.now() });
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

  /* 🔴v1031: 本地标记 ≠ 云端会话仍在。提供真实探测，避免"以为登录着其实没有"。 */
  function verifySession() {
    return auth().then(function (a) {
      if (typeof a.getLoginState !== 'function') return { ok: false, reason: 'no-api' };
      return Promise.resolve(a.getLoginState()).then(function (st) {
        var uid = st && (st.uid || (st.user && st.user.uid)) || '';
        return { ok: !!uid, uid: uid };
      });
    }).catch(function (e) { return { ok: false, reason: String(e && e.message || e) }; });
  }

  /* 🔴v1059 核心修复：云端读写的**唯一通行证**。

     此前所有云端路径（云存档 8 处调用）都拿 isSignedIn() 放行，而它长这样：
         return !!(lc.method && lc.signedAt);     // 只翻 localStorage
     ——「我登录过」被当成了「我现在还登录着」。

     verifySession()（真正去问云端的那个）v1031 就写好了，
     却**只接在诊断面板上显示给用户看，从没被任何一处决定采用**。
     于是会话过期后：面板正确地打出「❌ 云端会话已失效」，
     而同一个页面的 isSignedIn() 照样返回 true，
     界面继续显示「已登录 +86 186xxxx」，云存档拿着一个没有凭证的
     实例去读数据库，只拿回 credentials not found。
     这是本项目第四次「同一件事两处真源，而关键路径用了假的那个」。

     ensureSession() 把真源收敛成一处，并在**确认**会话已死时
     清掉那个撒谎的本地标记，让界面立刻说实话、让用户能重新登录。

     ⚠️ 只在「确定」时才清标记：getLoginState() 正常返回但无 uid（SDK 自己
     说没会话），或错误明确是鉴权类。断网等不确定情况**绝不动本地标记**，
     否则一次地铁进隧道就把用户登出了。 */
  function ensureSession() {
    if (!isSignedIn()) return Promise.resolve({ ok: false, reason: 'not-signed-in' });
    return auth().then(function (a) {
      if (typeof a.getLoginState !== 'function')
        return { ok: false, definite: false, reason: 'no-api' };
      return Promise.resolve(a.getLoginState()).then(function (st) {
        var uid = (st && (st.uid || (st.user && st.user.uid))) || '';
        if (uid) return { ok: true, uid: uid };
        /* ⚠️ 拿到空的登录态 → **拦住云端操作，但不动本地标记**。
           理由：SDK 恢复持久化会话是异步的，问得太早也会得到空；
           网络不通时某些版本同样返回空而不是抛错。
           据此就把人登出，等于「进一次隧道 / 开机快一点」就退出登录——
           那比原来的 bug 更糟。所以这里只拒绝操作、提示重新登录，
           清标记留给下面那条**确凿的鉴权错误**。 */
        return { ok: false, expired: true, definite: false, reason: '云端会话已失效或尚未就绪' };
      }, function (e) {
        var t = errText(e);
        /* 只有云端明确说「你没通过鉴权」才算确凿 —— 用户截图里
           那句 credentials not found 正属此类。 */
        var authErr = /unauthenticated|credentials|token|expired|unauthorized|40[13]/i.test(t);
        return { ok: false, expired: authErr, definite: authErr, reason: t };
      });
    }).catch(function (e) {
      return { ok: false, definite: false, reason: errText(e) };
    }).then(function (r) {
      if (!r.ok && r.definite) {
        writeLocal({ method: '', signedAt: 0, uid: '' });
        /* 清了标记还必须广播出去，否则界面上那句「已登录 +86 186xxxx」
           会一直挂到下次刷新——这正是本轮 bug 最刺眼的表象：
           界面说登录着，每一次读写却都失败。 */
        try { document.dispatchEvent(new CustomEvent('hsn-auth-changed', { detail: { expired: true } })); } catch (e) {}
      }
      return r;
    });
  }

  window.HansenAuth = {
    ready: ready,
    isSignedIn: isSignedIn,
    ensureSession: ensureSession,
    errText: errText,
    currentUser: currentUser,
    currentUserAsync: currentUserAsync,
    verifySession: verifySession,
    readLocal: readLocal,
    normPhone: normPhone,
    friendly: friendly,
    sendPhoneCode: sendPhoneCode,
    loginByPhoneCode: loginByPhoneCode,
    loginByPassword: loginByPassword,
    registerByPassword: registerByPassword,
    normUsername: normUsername,
    mailOfUsername: mailOfUsername,
    signOut: signOut,
    ensureProfile: ensureProfile,
    pushSave: pushSave,
    syncOnLogin: syncOnLogin,
    localHasProgress: localHasProgress,
    localProgressSize: localProgressSize,
    pullSave: pullSave,
    _setAuthForTest: function (a) { _authOverride = a; },
    _app: app
  };
})();
