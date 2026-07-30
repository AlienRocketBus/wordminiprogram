/* hansen_auth_v1004.js —— 账号系统：注册 / 登录 / 跨设备存档 / 竞赛 ID 发号
 *
 * 登录方式（对应控制台已开通的三种）：
 *   ① 手机号 + 短信验证码   —— 主力，注册与登录合一（is_user 判断走 signUp 还是 signIn）
 *   ② 用户名 + 密码         —— 只登录已由手机号真实创建并绑定凭据的账号
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
  /* 🔴v1075：本地 marker 只有在真实 CloudBase 会话已给出 uid 后才算已登录。
     v1074 以前的 method+signedAt 只代表“曾发起过登录”，不能再充当认证证据。 */
  function isSignedIn() {
    try {
      var lc = readLocal();
      return !!(lc.method && lc.signedAt && lc.uid);
    } catch (e) { return false; }
  }
  function currentUser() {
    var lc = readLocal();
    return lc.uid ? { uid: lc.uid } : null;
  }

  /* 🔴v1075：验证码事务只放 sessionStorage；密码、短信码、token 永不落盘。 */
  var PKEY = 'hansen_auth_pending_v1075';
  var _attemptId = 0;
  var _submitBusy = false;
  var _authEpoch = 0;

  function readPending() {
    try {
      var o = JSON.parse(sessionStorage.getItem(PKEY));
      if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
      if (!o.issuedAt || Date.now() - o.issuedAt > 15 * 60 * 1000) {
        sessionStorage.removeItem(PKEY);
        return {};
      }
      return o;
    } catch (e) { return {}; }
  }
  function writePending(o) {
    try { sessionStorage.setItem(PKEY, JSON.stringify(o || {})); } catch (e) {}
    return o || {};
  }
  function clearPending() {
    _attemptId++;
    try { sessionStorage.removeItem(PKEY); } catch (e) {}
  }
  function needsReauth() {
    var lc = readLocal();
    return !!(lc.method && lc.signedAt && !lc.uid);
  }
  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function withTimeout(task, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        var e = new Error(label || '操作超时，请检查网络后重试');
        e.code = 'AUTH_TIMEOUT';
        reject(e);
      }, ms);
      Promise.resolve(task).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }, function (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }
  function resolveWithin(task, ms, fallback) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(fallback);
      }, ms);
      Promise.resolve(task).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }, function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      });
    });
  }
  function unwrapAuthResult(res) {
    if (res && res.error) throw res.error;
    return (res && Object.prototype.hasOwnProperty.call(res, 'data')) ? res.data : res;
  }
  function uidOf(o) {
    if (!o || typeof o !== 'object') return '';
    return String(o.uid || o.id || o.user_id || o.sub || '');
  }
  function sessionSnapshot(a) {
    if (a && typeof a.getSession === 'function') {
      return withTimeout(Promise.resolve(a.getSession()), 2500, '确认云端登录会话超时')
        .then(unwrapAuthResult)
        .then(function (d) {
          d = d || {};
          var session = d.session || null;
          var user = d.user || (session && session.user) || null;
          var uid = uidOf(user) || uidOf(session);
          return { session: session, user: user, uid: uid };
        });
    }
    return currentUserAsync().then(function (u) {
      return { session: u ? { user: u } : null, user: u, uid: uidOf(u) };
    });
  }
  function confirmSession(a, n) {
    n = n || 0;
    return sessionSnapshot(a).then(function (snap) {
      if (snap && snap.session && snap.uid) return snap;
      if (n >= 3) {
        var e = new Error('云端没有建立有效登录会话，请重新登录');
        e.code = 'AUTH_SESSION_NOT_ESTABLISHED';
        throw e;
      }
      return delay(250 * (n + 1)).then(function () { return confirmSession(a, n + 1); });
    });
  }

  /* 友好错误文案：把云端英文错误翻成人话 */
  function friendly(err) {
    var m = errText(err);
    if (/domain|origin|not.*allow|安全域名|403/i.test(m))
      return '当前网址还没加入 CloudBase 安全域名，请管理员检查控制台配置';
    if (/provider.*not.*enabled|登录方式未开启|PROVIDER_NOT_ENABLED/i.test(m))
      return '当前登录方式尚未开通，请管理员在 CloudBase 控制台开启';
    if (/invalid.*(verification[_ ]?code|verify[_ ]?code|sms[_ ]?code)|verification[_ ]?code.*(invalid|expired|incorrect|wrong)|VERIFICATION_FAILED|验证码(错误|不正确|已过期)/i.test(m))
      return '验证码不正确或已过期，请重新获取';
    if (/frequent|too many|resource_exhausted|RATE_LIMITED|限频|频繁/i.test(m))
      return '验证码发送太频繁，请稍后再试';
    if (/password_not_set|PASSWORD_NOT_SET/i.test(m))
      return '这个账号还没有设置密码，请改用短信验证码登录';
    if (/weak|password.*(short|length)|密码.*(短|简单)/i.test(m))
      return '密码太简单了，请至少输入 6 位';
    if (/already.*exist|already.*registered|username.*exist|ALREADY_EXISTS|用户名.*占用/i.test(m))
      return '这个用户名已经有人用了，请更换用户名并重新获取验证码';
    if (/invalid.*password|wrong.*password|INVALID_CREDENTIALS|凭据验证失败|密码不正确/i.test(m))
      return '用户名或密码不正确';
    if (/user.*not.*found|no.*such.*user|USER_NOT_FOUND|用户不存在/i.test(m))
      return '没有找到这个账号；新用户请先用手机号注册';
    if (/AUTH_SESSION_NOT_ESTABLISHED|没有建立有效登录会话/i.test(m))
      return '登录请求已完成，但云端没有建立有效会话，请重新登录';
    if (/network|fetch|ERR_|unreachable|timeout|AUTH_TIMEOUT/i.test(m))
      return '网络连接失败，本次操作尚未完成，请重试';
    if (/sms|短信/i.test(m))
      return '短信登录暂不可用，请管理员检查短信服务、额度和地域配置';
    return m ? ('操作没成功：' + m.slice(0, 140)) : '操作失败，请重试';
  }

  /* ── ① 手机号验证码：发码 ───────────────────────── */
  function normUsername(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s.length < 1 || s.length > 32)
      return { ok: false, reason: '用户名长度需要 1-32 位' };
    if (/^\d+$/.test(s))
      return { ok: false, reason: '用户名不能全是数字' };
    var legal = (s.length === 1)
      ? /^[A-Za-z]$/.test(s)
      : /^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/.test(s);
    if (!legal)
      return { ok: false, reason: '用户名只允许字母、数字、-、_，且符号不能放在开头或结尾' };
    return { ok: true, name: s };
  }
  function passwordInput(password, password2) {
    var pw = String(password == null ? '' : password);
    if (pw.length < 6) throw new Error('密码至少 6 位');
    if (pw.length > 64) throw new Error('密码最多 64 位');
    if (password2 !== undefined && String(password2) !== pw)
      throw new Error('两次输入的密码不一样');
    return pw;
  }

  /* ── ① 手机号验证码：只发一次，并保存可恢复的 verification_id ── */
  function sendPhoneCode(phoneRaw) {
    var phone = normPhone(phoneRaw);
    if (!phone) return Promise.reject(new Error('手机号格式不对，请填写 11 位手机号'));
    var attempt = ++_attemptId;
    try { sessionStorage.removeItem(PKEY); } catch (e) {}
    return auth().then(function (a) {
      if (typeof a.getVerification !== 'function') throw new Error('当前环境不支持短信验证码');
      return withTimeout(a.getVerification({ phone_number: phone }), 20000, '发送验证码超时');
    }).then(unwrapAuthResult).then(function (res) {
      if (attempt !== _attemptId) throw new Error('这次发码已被新的操作替代');
      if (!res || !res.verification_id) throw new Error('服务器没有返回验证码事务，请重试');
      var pending = {
        attemptId: attempt,
        phone: phone,
        verificationId: res.verification_id,
        isUser: !!res.is_user,
        issuedAt: Date.now(),
        mode: res.is_user ? 'login' : 'signup'
      };
      writePending(pending);
      writeLocal({ pendingPhone: '', verificationId: '', isUser: false });
      return { ok: true, isUser: pending.isUser, phone: phone };
    });
  }

  /* ── ① 手机号验证码：同一验证码事务内完成真实登录或注册 ── */
  function loginByPhoneCode(code, username, password, password2) {
    if (_submitBusy) return Promise.reject(new Error('操作正在进行，请不要重复提交'));
    var st = readPending();
    if (!st.verificationId || !st.phone)
      return Promise.reject(new Error('请先获取验证码'));
    var c = String(code == null ? '' : code).trim();
    if (!/^\d{4,8}$/.test(c))
      return Promise.reject(new Error('验证码格式不对，请检查后重试'));

    var uname = '', pw = '';
    if (!st.isUser) {
      var nu = normUsername(username);
      if (!nu.ok) return Promise.reject(new Error(nu.reason));
      try { pw = passwordInput(password, password2); }
      catch (e) { return Promise.reject(e); }
      uname = nu.name;
    }

    var verificationConsumed = false;
    _submitBusy = true;
    var work = auth().then(function (a) {
      if (typeof a.verify !== 'function') throw new Error('当前环境不支持验证码校验');
      return withTimeout(a.verify({
        verification_id: st.verificationId,
        verification_code: c
      }), 20000, '验证验证码超时').then(unwrapAuthResult).then(function (verified) {
        var token = verified && verified.verification_token;
        if (!token) throw new Error('验证码没有换到有效凭证，请重新获取');
        verificationConsumed = true;
        if (st.isUser) {
          if (typeof a.signIn !== 'function') throw new Error('当前环境不支持短信登录');
          return withTimeout(a.signIn({
            username: st.phone,
            verification_token: token
          }), 20000, '短信登录超时').then(unwrapAuthResult).then(function () {
            return afterSignIn({ method: 'phone', phone: st.phone, username: '' }, a);
          });
        }
        if (typeof a.signUp !== 'function') throw new Error('当前环境不支持手机号注册');
        return withTimeout(a.signUp({
          phone_number: st.phone,
          verification_code: c,
          verification_token: token,
          username: uname,
          password: pw
        }), 20000, '手机号注册超时').then(unwrapAuthResult).then(function () {
          return afterSignIn({ method: 'phone', phone: st.phone, username: uname }, a);
        });
      });
    });
    return work.then(function (r) {
      _submitBusy = false;
      return r;
    }, function (e) {
      _submitBusy = false;
      if (verificationConsumed) clearPending();
      throw e;
    });
  }

  /* ── ② 用户名 + 密码：只登录已经真实创建并绑定的账号 ── */
  function loginByPassword(username, password) {
    if (_submitBusy) return Promise.reject(new Error('操作正在进行，请不要重复提交'));
    var u = String(username == null ? '' : username).trim();
    var p = String(password == null ? '' : password);
    if (!u) return Promise.reject(new Error('请输入用户名'));
    if (p.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    _submitBusy = true;
    var work = auth().then(function (a) {
      var req;
      if (typeof a.signInWithPassword === 'function') {
        req = a.signInWithPassword({ username: u, password: p });
      } else if (typeof a.signIn === 'function') {
        req = a.signIn({ username: u, password: p });
      } else {
        throw new Error('当前环境不支持用户名密码登录');
      }
      return withTimeout(req, 20000, '用户名密码登录超时')
        .then(unwrapAuthResult)
        .then(function () {
          return afterSignIn({ method: 'password', phone: '', username: u }, a);
        });
    });
    return work.then(function (r) {
      _submitBusy = false;
      return r;
    }, function (e) {
      _submitBusy = false;
      throw e;
    });
  }

  /* v1058 的虚拟邮箱直接注册从未完成真实验证，v1075 永久停用。
     保留函数名只为让旧调用得到清晰错误，不再产生任何伪账号请求。 */
  function registerByPassword() {
    return Promise.reject(new Error('CloudBase 不支持直接用用户名注册；请先在手机号页完成真实注册'));
  }

  /* ── ③ 登出 ─────────────────────────────────────── */
  function signOut() {
    _authEpoch++;
    clearPending();
    return auth().then(function (a) {
      return a.signOut ? Promise.resolve(a.signOut()).then(unwrapAuthResult) : null;
    }).catch(function () { return null; }).then(function () {
      writeLocal({
        schema: 1075,
        method: '',
        signedAt: 0,
        uid: '',
        phone: '',
        username: '',
        pendingPhone: '',
        verificationId: '',
        isUser: false
      });
      return { ok: true };
    });
  }

  /* ── 登录之后：建档 + 发号 ──────────────────────── */
  function afterSignIn(identity, a) {
    return confirmSession(a).then(function (snap) {
      var uid = snap && snap.uid;
      if (!uid) {
        var e = new Error('云端没有建立有效登录会话，请重新登录');
        e.code = 'AUTH_SESSION_NOT_ESTABLISHED';
        throw e;
      }
      writeLocal({
        schema: 1075,
        method: identity.method,
        phone: identity.phone || '',
        username: identity.username || '',
        uid: uid,
        signedAt: Date.now(),
        pendingPhone: '',
        verificationId: '',
        isUser: false
      });
      clearPending();
      var epoch = ++_authEpoch;
      try {
        if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp();
      } catch (e0) {}

      var job = ensureProfile(uid).catch(function () { return null; }).then(function (prof) {
        if (epoch !== _authEpoch || readLocal().uid !== uid)
          return { stale: true };
        return syncOnLogin().then(function (s) {
          if (epoch !== _authEpoch || readLocal().uid !== uid)
            return { stale: true };
          return {
            cid: (prof && prof.cid) || 0,
            pendingId: !(prof && prof.cid),
            sync: s
          };
        });
      }).catch(function (e1) {
        return {
          cid: 0,
          pendingId: true,
          sync: { ok: false, action: 'deferred', reason: errText(e1) }
        };
      });
      var fallback = {
        cid: 0,
        pendingId: true,
        sync: { ok: false, action: 'deferred', reason: 'timeout' }
      };
      return {
        ok: true,
        uid: uid,
        cid: 0,
        pendingId: true,
        postLogin: resolveWithin(job, 10000, fallback)
      };
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
        /* 🔴v1063 竞态防线：刚登录完的一小段时间内**绝不清本地标记**。
           场景：登录成功写下 signedAt → 后台的开机恢复几乎同时调 ensureSession()
           → 此刻 SDK 会话可能还没落定，getLoginState() 给出鉴权类错误
           → 按"确凿失效"处理就会把**刚刚建立的登录态**抹掉，
              用户看到的是"明明刚登录成功，一转眼又退出了"。
           test_phone_signup_v1057 三跑一红的抖动，正是撞上这条竞态。
           60 秒新鲜期内只拒绝本次操作、不动标记；真过期了下次自然会再判。 */
        var fresh = false;
        try {
          var lc0 = readLocal();
          fresh = !!(lc0 && lc0.signedAt && (Date.now() - lc0.signedAt) < 60000);
        } catch (e0) {}
        if (fresh) return r;
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
    readPending: readPending,
    clearPending: clearPending,
    needsReauth: needsReauth,
    normPhone: normPhone,
    friendly: friendly,
    sendPhoneCode: sendPhoneCode,
    loginByPhoneCode: loginByPhoneCode,
    loginByPassword: loginByPassword,
    registerByPassword: registerByPassword,
    normUsername: normUsername,
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
