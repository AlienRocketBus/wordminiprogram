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

  var _localMemory = null;
  var _storageWarning = '';
  function readLocal() {
    try {
      var raw = localStorage.getItem(LKEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          _localMemory = o;
          return o;
        }
      }
    } catch (e) { _storageWarning = 'localStorage-unavailable'; }
    return (_localMemory && typeof _localMemory === 'object') ? _localMemory : {};
  }
  function writeLocal(patch) {
    var base = readLocal(), o = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) o[k] = base[k];
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) o[k] = patch[k];
    _localMemory = o;
    try {
      var encoded = JSON.stringify(o);
      localStorage.setItem(LKEY, encoded);
      if (localStorage.getItem(LKEY) !== encoded) _storageWarning = 'localStorage-write-not-persistent';
      else _storageWarning = '';
    } catch (e) { _storageWarning = 'localStorage-write-failed'; }
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

  /* ── 登录态：SDK session 是唯一真源，本地 marker 只做显示缓存 ── */
  function currentUserAsync() {
    return auth().then(function (a) {
      if (typeof a.getCurrentUser !== 'function') return null;
      return Promise.resolve(a.getCurrentUser()).then(unwrapAuthResult);
    }).catch(function () { return null; });
  }

  var _sessionTruth = { state: 'checking', uid: '', reason: '', checkedAt: 0 };
  var _authEpoch = 0;
  var _authGeneration = 0;   /* 每次认证/退出递增：旧异步结果绝不能跨代落地 */
  var _probeId = 0;          /* 只读 session 探测序号：后发探测拥有写状态权 */
  var _cloudBusy = false;

  function emitSessionState() {
    try {
      document.dispatchEvent(new CustomEvent('hsn-auth-session', {
        detail: sessionStatus()
      }));
    } catch (e) {}
  }
  function setSessionTruth(state, uid, reason) {
    _sessionTruth = {
      state: state || 'unknown',
      uid: String(uid || ''),
      reason: String(reason || ''),
      checkedAt: Date.now()
    };
    emitSessionState();
    return sessionStatus();
  }
  function sessionStatus() {
    return {
      state: _sessionTruth.state,
      uid: _sessionTruth.uid,
      reason: _sessionTruth.reason,
      checkedAt: _sessionTruth.checkedAt,
      storageWarning: _storageWarning
    };
  }
  function isSignedIn() {
    var lc = readLocal();
    return !!(_sessionTruth.state === 'confirmed' && _sessionTruth.uid &&
              !readFence().kind && lc.uid &&
              String(lc.uid) === String(_sessionTruth.uid));
  }
  function currentUser() {
    return isSignedIn() ? { uid: _sessionTruth.uid } : null;
  }
  function needsReauth() {
    var lc = readLocal();
    return !!(readFence().kind ||
              (lc.method && lc.signedAt && !lc.uid) ||
              _sessionTruth.state === 'mismatch' ||
              _sessionTruth.state === 'legacy_reauth');
  }

  /* 验证码事务可在同一标签页刷新后恢复；敏感字段永不写入。 */
  var PKEY = 'hansen_auth_pending_v1076';
  var _pendingMemory = null;
  var _attemptId = 0;
  var _submitBusy = false;
  var _submitToken = 0;
  var _activeMutationTasks = 0;
  var _activeSessionMutations = 0;
  var _mutationWaiters = [];
  var _operation = { state: 'idle', slow: false, reason: '' };
  var _outcomeRecovery = null;
  var FKEY = 'hansen_auth_fence_v1076';
  var _fenceMemory = null;
  var _fenceRevision = 0;

  /* mismatch / outcome_unknown 只保存非敏感身份边界；密码、短信码、token 永不落盘。 */
  function readFence() {
    var o = null;
    try {
      var raw = sessionStorage.getItem(FKEY);
      if (raw) o = JSON.parse(raw);
    } catch (e) {}
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = _fenceMemory;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    _fenceRevision = Math.max(_fenceRevision, Number(o.revision || 0));
    _fenceMemory = o;
    return o;
  }
  function writeFence(kind, expectedUid, observedUid, reason) {
    _fenceRevision++;
    _probeId++;  /* fence 一旦出现，所有尚未落地的只读探测立即失去写状态权 */
    var o = {
      schema: 1076,
      kind: String(kind || 'outcome_unknown'),
      expectedUid: String(expectedUid || ''),
      observedUid: String(observedUid || ''),
      reason: String(reason || ''),
      generation: _authGeneration,
      revision: _fenceRevision,
      at: Date.now()
    };
    _fenceMemory = o;
    try { sessionStorage.setItem(FKEY, JSON.stringify(o)); } catch (e) {}
    return o;
  }
  function clearFence() {
    _fenceRevision++;
    _fenceMemory = null;
    try { sessionStorage.removeItem(FKEY); } catch (e) {}
  }
  function staleError(reason) {
    var e = new Error(reason || '这次认证结果已经过期，已拒绝写入');
    e.code = 'AUTH_STALE_OPERATION';
    return e;
  }
  function isStaleError(e) {
    return !!(e && e.code === 'AUTH_STALE_OPERATION');
  }
  function invalidateAuthWork(reason) {
    _authGeneration++;
    _probeId++;
    _attemptId++;
    var waiters = _mutationWaiters.slice();
    _mutationWaiters.length = 0;
    for (var i = 0; i < waiters.length; i++) {
      try { waiters[i](reason || '认证状态已经变化'); } catch (e) {}
    }
    return _authGeneration;
  }
  function assertAuthToken(token) {
    if (token !== _authGeneration) throw staleError();
  }
  function probeCurrent(probe, generation) {
    return probe === _probeId && generation === _authGeneration;
  }

  function setOperation(state, reason) {
    _operation = { state: state, slow: false, reason: String(reason || '') };
    try {
      document.dispatchEvent(new CustomEvent('hsn-auth-operation', {
        detail: operationStatus()
      }));
    } catch (e) {}
  }
  function operationStatus() {
    var fence = readFence();
    return {
      state: _operation.state,
      slow: !!_operation.slow,
      reason: _operation.reason,
      busy: !!(_submitBusy || _operation.state === 'requesting' ||
                _operation.state === 'verifying' ||
                _operation.state === 'confirming' ||
                _operation.state === 'signing_out'),
      requiresCleanup: !!fence.kind,
      fence: String(fence.kind || '')
    };
  }

  function readPending() {
    var o = null;
    try {
      var raw = sessionStorage.getItem(PKEY);
      if (raw) o = JSON.parse(raw);
    } catch (e) {}
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = _pendingMemory;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    if (!o.issuedAt || Date.now() - o.issuedAt > 15 * 60 * 1000) {
      _pendingMemory = null;
      try { sessionStorage.removeItem(PKEY); } catch (e2) {}
      if (!_submitBusy) setOperation('idle');
      return {};
    }
    _pendingMemory = o;
    return o;
  }
  function writePending(o) {
    _pendingMemory = o || {};
    try {
      var encoded = JSON.stringify(_pendingMemory);
      sessionStorage.setItem(PKEY, encoded);
    } catch (e) {}
    return _pendingMemory;
  }
  function clearPending() {
    if (_submitBusy) return false;
    invalidateAuthWork('验证码事务已清理');
    _pendingMemory = null;
    try { sessionStorage.removeItem(PKEY); } catch (e) {}
    if (readFence().kind) setOperation('outcome_unknown', readFence().reason || '请先安全清理未知会话');
    else setOperation('idle');
    return true;
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* 底层认证 Promise 无法真正取消：20 秒只提示慢；60 秒后释放提交锁，
     但写入持久 fence 并禁止重试。旧 Promise 若稍后返回，只能加固 fence，
     永远没有资格提交 marker。安全退出会递增 generation 并立即作废等待者。 */
  function awaitAuthMutation(task, label, token, mayChangeSession) {
    token = token == null ? _authGeneration : token;
    var sessionMutation = mayChangeSession !== false;
    var slowMs = Number(window.__HANSEN_AUTH_SLOW_MS__ || 20000);
    var hardMs = Number(window.__HANSEN_AUTH_MUTATION_TIMEOUT_MS__ || 60000);
    _activeMutationTasks++;
    if (sessionMutation) _activeSessionMutations++;

    return new Promise(function (resolve, reject) {
      var wrapperDone = false, underlyingDone = false;
      function finishUnderlying() {
        if (underlyingDone) return;
        underlyingDone = true;
        _activeMutationTasks = Math.max(0, _activeMutationTasks - 1);
        if (sessionMutation) _activeSessionMutations = Math.max(0, _activeSessionMutations - 1);
      }
      function removeWaiter(cancel) {
        var i = _mutationWaiters.indexOf(cancel);
        if (i >= 0) _mutationWaiters.splice(i, 1);
      }
      function quarantine(reason) {
        if (!sessionMutation) return;
        writeFence('stale_mutation', '', '', reason || '旧认证请求在状态变化后才返回');
      }
      var slowTimer = setTimeout(function () {
        if (wrapperDone || token !== _authGeneration) return;
        _operation.slow = true;
        _operation.reason = label || '服务器仍在处理';
        try {
          document.dispatchEvent(new CustomEvent('hsn-auth-operation', {
            detail: operationStatus()
          }));
        } catch (e) {}
      }, Math.max(1, slowMs));
      var hardTimer = setTimeout(function () {
        if (wrapperDone) return;
        wrapperDone = true;
        removeWaiter(cancel);
        clearTimeout(slowTimer);
        if (sessionMutation) {
          writeFence('outcome_unknown', '', '', label || '认证请求超时，结果未知');
        }
        var e = new Error('服务器长时间没有返回；本次结果未知，禁止重复提交，请先安全退出并清理会话');
        e.code = 'AUTH_MUTATION_INDETERMINATE';
        reject(e);
      }, Math.max(slowMs + 1, hardMs));
      var cancel = function (reason) {
        if (wrapperDone) return;
        wrapperDone = true;
        clearTimeout(slowTimer);
        clearTimeout(hardTimer);
        quarantine(reason || '旧认证请求已被退出操作作废');
        reject(staleError(reason));
      };
      _mutationWaiters.push(cancel);

      Promise.resolve(task).then(function (v) {
        finishUnderlying();
        clearTimeout(slowTimer);
        clearTimeout(hardTimer);
        removeWaiter(cancel);
        if (wrapperDone) {
          quarantine('旧认证请求在界面停止等待后才成功返回');
          return;
        }
        wrapperDone = true;
        if (token !== _authGeneration) {
          quarantine('旧认证请求跨代返回');
          reject(staleError());
          return;
        }
        try { resolve(unwrapAuthResult(v)); }
        catch (e) { reject(e); }
      }, function (e) {
        finishUnderlying();
        clearTimeout(slowTimer);
        clearTimeout(hardTimer);
        removeWaiter(cancel);
        if (wrapperDone) return;
        wrapperDone = true;
        if (token !== _authGeneration) {
          reject(staleError());
          return;
        }
        reject(e);
      });
    });
  }

  

  /* 只读 session 探测可以超时；超时代表 unknown，不能清 marker 或宣布退出。 */
  function withTimeout(task, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        var e = new Error(label || '操作超时');
        e.code = 'AUTH_SESSION_CHECK_TIMEOUT';
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
  function unwrapAuthResult(res) {
    if (res && res.error) throw res.error;
    return (res && Object.prototype.hasOwnProperty.call(res, 'data')) ? res.data : res;
  }
  function uidOf(o) {
    if (!o || typeof o !== 'object') return '';
    return String(o.uid || o.id || o.user_id || o.sub || '');
  }
  function identityOf(value) {
    var d = value || {};
    var session = d.session || (d.loginState && d.loginState.session) || null;
    var user = d.user || (session && session.user) ||
               (d.loginState && d.loginState.user) || null;
    if (!user && d.uid) user = d;
    var uid = uidOf(user) || uidOf(session) || uidOf(d);
    var providers = (user && (user.providers || user.identities)) || [];
    var createdFrom = String((user && (user.createdFrom || user.created_from)) || '');
    var anonymous = !!(user && (user.is_anonymous || user.isAnonymous ||
                    user.provider === 'anonymous' || user.provider_id === 'anonymous' ||
                    String(user.name || '').toLowerCase() === 'anonymous' ||
                    createdFrom.toLowerCase() === 'anonymous'));
    if (!anonymous && Array.isArray(providers)) {
      anonymous = providers.some(function (p0) {
        p0 = p0 || {};
        return /anonymous/i.test(String(
          p0.id || p0.provider || p0.provider_id || p0.type || ''
        ));
      });
    }
    var metadata = (user && (user.user_metadata || user.userMetadata)) || {};
    return {
      uid: uid,
      user: user,
      session: session,
      anonymous: anonymous,
      phone: String((user && (user.phone_number || user.phone || user.phoneNumber)) ||
                    metadata.phone_number || metadata.phone || ''),
      username: String((user && (user.username || user.user_name)) ||
                       metadata.username || metadata.user_name || '')
    };
  }
  function requireOperationIdentity(result) {
    var id = identityOf(result);
    if (!id.uid) {
      var e = new Error('认证服务器没有返回本次操作的用户 UID，不能确认登录账号');
      e.code = 'AUTH_OPERATION_UID_MISSING';
      throw e;
    }
    if (id.anonymous) {
      var e2 = new Error('本次结果仍是匿名会话，不能当作正式账号登录成功');
      e2.code = 'AUTH_ANONYMOUS_RESULT';
      throw e2;
    }
    return id;
  }
  function sessionSnapshot(a) {
    if (!a || typeof a.getSession !== 'function') {
      var noApi = new Error('当前 SDK 不支持真实 session 查询');
      noApi.code = 'AUTH_SESSION_API_MISSING';
      return Promise.reject(noApi);
    }
    function build(d, userError) {
      d = d || {};
      var id = identityOf(d);
      var snap = {
        session: d.session || id.session || null,
        user: id.user,
        uid: id.uid,
        anonymous: id.anonymous,
        indeterminate: false,
        reason: userError || ''
      };
      if (snap.session && (!snap.user || !snap.uid)) {
        snap.indeterminate = true;
        if (!snap.reason) snap.reason = '云端凭证仍存在，但用户身份暂时不可用';
      }
      return snap;
    }
    return withTimeout(Promise.resolve(a.getSession()), 4000, '确认云端登录会话超时')
      .then(unwrapAuthResult)
      .then(function (d) {
        var snap = build(d);
        if (!snap.indeterminate || typeof a.getCurrentUser !== 'function') return snap;
        /* 锁定 SDK 的 getSession 会吞掉 getUser(false).error，可能返回
           session 非空但 user:null。此时必须远程刷新用户，不能当成已退出。 */
        return withTimeout(Promise.resolve(a.getCurrentUser(true)), 4000, '刷新云端用户身份超时')
          .then(unwrapAuthResult)
          .then(function (fresh) {
            var user = fresh && fresh.user ? fresh.user : fresh;
            if (!user) return snap;
            var merged = {
              session: snap.session,
              user: user
            };
            return build(merged);
          }, function (e) {
            snap.indeterminate = true;
            snap.reason = errText(e);
            return snap;
          });
      });
  }
  function confirmSession(a, expectedUid, token, n, lastReason) {
    n = n || 0;
    assertAuthToken(token);
    return sessionSnapshot(a).then(function (snap) {
      assertAuthToken(token);
      if (snap && snap.session && snap.user &&
          String(snap.uid) === String(expectedUid) &&
          !snap.anonymous && !snap.indeterminate) return snap;
      var why = snap && snap.indeterminate
        ? (snap.reason || '云端凭证存在，但用户身份尚未刷新')
        : (snap && snap.uid
          ? ('云端当前 UID 与本次认证 UID 不一致：' + snap.uid)
          : '云端会话尚未建立');
      if (n >= 7) {
        var mismatch = !!(snap && snap.uid && String(snap.uid) !== String(expectedUid));
        writeFence(mismatch ? 'mismatch' : 'outcome_unknown',
                   expectedUid, snap && snap.uid, why);
        var e = new Error(why + '；结果仍在确认，不能重复登录');
        e.code = mismatch ? 'AUTH_SESSION_UID_MISMATCH' : 'AUTH_OUTCOME_UNKNOWN';
        e.expectedUid = String(expectedUid || '');
        e.observedUid = String((snap && snap.uid) || '');
        throw e;
      }
      var wait = window.__HANSEN_AUTH_TEST_FAST__ ? 0 : 350 * (n + 1);
      return delay(wait).then(function () {
        assertAuthToken(token);
        return confirmSession(a, expectedUid, token, n + 1, why);
      });
    }, function (err) {
      assertAuthToken(token);
      if (n >= 7) {
        var why = '暂时无法确认云端会话：' + errText(err);
        writeFence('outcome_unknown', expectedUid, '', why);
        var e = new Error(why);
        e.code = 'AUTH_OUTCOME_UNKNOWN';
        e.expectedUid = String(expectedUid || '');
        throw e;
      }
      var wait = window.__HANSEN_AUTH_TEST_FAST__ ? 0 : 350 * (n + 1);
      return delay(wait).then(function () {
        assertAuthToken(token);
        return confirmSession(a, expectedUid, token, n + 1, errText(err));
      });
    });
  }

  function refreshSessionTruth() {
    var marker = readLocal();
    var generation = _authGeneration;
    var probe = ++_probeId;
    var startingFence = readFence();
    setSessionTruth(startingFence.kind === 'mismatch' ? 'mismatch' : 'checking',
                    startingFence.observedUid || '',
                    startingFence.reason || '');
    return auth().then(function (a) {
      return sessionSnapshot(a);
    }).then(function (snap) {
      if (!probeCurrent(probe, generation)) return sessionStatus();
      marker = readLocal();
      var fence = readFence();
      if (fence.kind) {
        /* 只读 refresh 永远无权清 fence。即使这一刻 session=null，也可能有旧
           mutation 随后建立 session；只有显式 signOut 的屏障可以解除隔离。 */
        return setSessionTruth(fence.kind === 'mismatch' ? 'mismatch' : 'unknown',
                               snap.uid || fence.observedUid || '',
                               fence.reason || '存在未清理的认证结果，请先安全退出');
      }
      if (snap.indeterminate || (snap.session && (!snap.user || !snap.uid))) {
        return setSessionTruth('unknown', '', snap.reason || '凭证存在但用户身份无法确认');
      }
      if (!snap.session || snap.anonymous) {
        if (marker.method && marker.signedAt && !marker.uid)
          return setSessionTruth('legacy_reauth', '', '旧 marker 没有真实 UID');
        if (marker.uid) {
          writeLocal({ method: '', signedAt: 0, uid: '', phone: '', username: '' });
        }
        return setSessionTruth('signed_out', '', snap.anonymous ? 'anonymous-session' : 'no-session');
      }
      if (marker.method && marker.signedAt && !marker.uid)
        return setSessionTruth('legacy_reauth', '', '旧 marker 不能绑定现有会话');
      if (marker.uid && String(marker.uid) !== String(snap.uid)) {
        writeFence('mismatch', marker.uid, snap.uid, '本地账号与 SDK 会话不一致');
        return setSessionTruth('mismatch', snap.uid, '本地账号与 SDK 会话不一致');
      }
      if (!marker.uid) {
        writeLocal({
          schema: 1076,
          method: 'session',
          uid: snap.uid,
          phone: identityOf({ user: snap.user }).phone,
          username: identityOf({ user: snap.user }).username,
          signedAt: Date.now()
        });
      }
      return setSessionTruth('confirmed', snap.uid, '');
    }).catch(function (e) {
      if (!probeCurrent(probe, generation) || isStaleError(e)) return sessionStatus();
      return setSessionTruth('unknown', '', errText(e));
    });
  }

  /* 友好错误文案：把云端英文错误翻成人话 */
  function friendly(err) {
    var m = errText(err);
    if (/((domain|origin|referer).*(not.*allow|forbid|invalid)|安全域名|ORIGIN_NOT_ALLOWED|DOMAIN_NOT_ALLOWED)/i.test(m))
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
    if (/invalid.*password|wrong.*password|password.*incorrect|INVALID_CREDENTIALS|凭据验证失败|密码不正确/i.test(m))
      return '用户名或密码不正确';
    if (/user.*not.*found|no.*such.*user|USER_NOT_FOUND|not_found|用户不存在/i.test(m))
      return '没有找到这个账号；新用户请先用手机号注册';
    if (/AUTH_SESSION_UID_MISMATCH|AUTH_STALE_MUTATION|本次认证账号与云端会话不一致|不是同一用户/i.test(m))
      return '检测到两个不同账号或旧请求晚到，已隔离；请点“安全退出并清理会话”后再登录';
    if (/AUTH_FENCED_SESSION|AUTH_OUTCOME_UNKNOWN|AUTH_MUTATION_INDETERMINATE|AUTH_LATE_MUTATION_PENDING|暂时无法确认云端会话|结果仍在确认/i.test(m))
      return '服务器可能已处理本次请求，不能重复提交；请点“安全退出并清理会话”';
    if (/AUTH_OPERATION_UID_MISSING|没有返回本次操作的用户 UID/i.test(m))
      return '服务器没有返回可核对的账号 UID，本次不能算登录成功';
    if (/AUTH_SIGNOUT_INCOMPLETE|退出没有完成|云端会话仍然存在/i.test(m))
      return '云端会话仍然存在，退出没有完成，请检查网络后重试';
    if (/AUTH_SESSION_NOT_ESTABLISHED|没有建立有效登录会话/i.test(m))
      return '登录请求已完成，但云端没有建立有效会话，请重新登录';
    if (/network|fetch|ERR_|unreachable|timeout|AUTH_SESSION_CHECK_TIMEOUT/i.test(m))
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
    if (!pw) throw new Error('请输入密码');
    if (pw.length > 128) throw new Error('密码过长');
    if (password2 !== undefined && String(password2) !== pw)
      throw new Error('两次输入的密码不一样');
    return pw;
  }

  /* 发码成功后才原子替换旧事务；发码失败保留仍有效的旧事务。 */
  function sendPhoneCode(phoneRaw) {
    var phone = normPhone(phoneRaw);
    if (!phone) return Promise.reject(new Error('手机号格式不对，请填写 11 位手机号'));
    if (readFence().kind)
      return Promise.reject(new Error('存在未清理的认证结果，请先安全退出并清理会话'));
    if (_submitBusy || operationStatus().busy || _operation.state === 'outcome_unknown')
      return Promise.reject(new Error('上一项认证操作仍在进行或结果未知，请先处理'));
    var previous = readPending();
    if (previous.verificationId && previous.phone !== phone)
      return Promise.reject(new Error('请先点“更换手机号”结束当前验证码事务'));
    if (previous.verificationId && previous.resendAt && Date.now() < previous.resendAt)
      return Promise.reject(new Error('请等待倒计时结束后再重新获取验证码'));

    var token = invalidateAuthWork('开始新的短信事务');
    var attempt = _attemptId;
    setOperation('requesting');
    return auth().then(function (a) {
      assertAuthToken(token);
      if (typeof a.getVerification !== 'function') throw new Error('当前环境不支持短信验证码');
      return awaitAuthMutation(a.getVerification({ phone_number: phone }),
                               '短信正在发送，请勿重复点击', token, false);
    }).then(function (res) {
      assertAuthToken(token);
      if (attempt !== _attemptId) throw staleError('这次发码已被新的操作替代');
      if (!res || !res.verification_id) throw new Error('服务器没有返回验证码事务，请重试');
      var pending = {
        attemptId: attempt,
        phone: phone,
        verificationId: res.verification_id,
        isUser: !!res.is_user,
        issuedAt: Date.now(),
        resendAt: Date.now() + 60000,
        mode: res.is_user ? 'login' : 'signup'
      };
      writePending(pending);
      writeLocal({ pendingPhone: '', verificationId: '', isUser: false });
      setOperation('code_sent');
      return { ok: true, isUser: pending.isUser, phone: phone, resendAt: pending.resendAt };
    }).catch(function (e) {
      if (isStaleError(e) || token !== _authGeneration) throw e;
      if (previous && previous.verificationId) {
        writePending(previous);
        setOperation('code_sent', errText(e));
      } else {
        setOperation('idle', errText(e));
      }
      throw e;
    });
  }

  function beginSubmit(state) {
    var fence = readFence();
    if (fence.kind)
      throw new Error('存在未清理的认证结果，请先安全退出并清理会话');
    if (_cloudBusy) throw new Error('云存档操作正在进行，请完成后再登录');
    if (_submitBusy || _operation.state === 'requesting' ||
        _operation.state === 'verifying' || _operation.state === 'confirming' ||
        _operation.state === 'outcome_unknown' || _operation.state === 'signing_out')
      throw new Error(_operation.state === 'outcome_unknown'
        ? '上一次登录结果未知，请先安全退出并清理会话'
        : '操作正在进行，请不要重复提交');
    var token = invalidateAuthWork('开始新的认证操作');
    _submitBusy = true;
    _submitToken = token;
    setOperation(state || 'verifying');
    setSessionTruth('checking', '', '正在核对本次认证');
    return token;
  }

  function beginRecovery() {
    if (_submitBusy || _operation.state === 'signing_out')
      throw new Error('会话确认正在进行');
    var token = invalidateAuthWork('重新确认认证结果');
    _submitBusy = true;
    _submitToken = token;
    setOperation('confirming');
    setSessionTruth('checking', '', '正在重新核对本次认证');
    return token;
  }

  function finishSubmit(token) {
    if (token === _submitToken) {
      _submitBusy = false;
      _submitToken = 0;
    }
  }

  

  /* 同一验证码事务完成真实登录/注册；operation UID 与 session UID 必须一致。 */
  function loginByPhoneCode(code, username, password, password2) {
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

    var token;
    try { token = beginSubmit('verifying'); }
    catch (e0) { return Promise.reject(e0); }
    var verificationConsumed = false;
    var aRef = null, opIdentity = null;
    var sessionMutationResolved = false;
    var identity = { method: 'phone', phone: st.phone, username: uname };
    var work = auth().then(function (a) {
      assertAuthToken(token);
      aRef = a;
      if (typeof a.verify !== 'function') throw new Error('当前环境不支持验证码校验');
      return awaitAuthMutation(a.verify({
        verification_id: st.verificationId,
        verification_code: c
      }), '验证码正在核验，请勿重复提交', token, false).then(function (verified) {
        assertAuthToken(token);
        var verificationToken = verified && verified.verification_token;
        if (!verificationToken) throw new Error('验证码没有换到有效凭证，请重新获取');
        verificationConsumed = true;
        var req;
        if (st.isUser) {
          if (typeof a.signIn !== 'function') throw new Error('当前环境不支持短信登录');
          req = a.signIn({ username: st.phone, verification_token: verificationToken });
        } else {
          if (typeof a.signUp !== 'function') throw new Error('当前环境不支持手机号注册');
          req = a.signUp({
            phone_number: st.phone,
            verification_code: c,
            verification_token: verificationToken,
            username: uname,
            password: pw
          });
        }
        setOperation('confirming');
        return awaitAuthMutation(req,
          st.isUser ? '短信登录仍在处理，请勿重试' : '账号正在创建，请勿重试',
          token, true);
      }).then(function (result) {
        assertAuthToken(token);
        sessionMutationResolved = true;
        opIdentity = requireOperationIdentity(result);
        return confirmSession(a, opIdentity.uid, token);
      }).then(function (snap) {
        assertAuthToken(token);
        return commitSignedIn(identity, opIdentity, snap, token);
      });
    });
    return work.then(function (r) {
      finishSubmit(token);
      return r;
    }, function (e) {
      finishSubmit(token);
      if (isStaleError(e) || token !== _authGeneration) throw e;
      if (verificationConsumed) {
        _pendingMemory = null;
        try { sessionStorage.removeItem(PKEY); } catch (_) {}
      }
      var code = String(e && e.code || '');
      if (code === 'AUTH_FENCED_SESSION') {
        _outcomeRecovery = null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth(readFence().kind === 'mismatch' ? 'mismatch' : 'unknown',
                        readFence().observedUid || '', errText(e));
      } else if (sessionMutationResolved &&
                 !/AUTH_OUTCOME_UNKNOWN|AUTH_SESSION_UID_MISMATCH|AUTH_MUTATION_INDETERMINATE/.test(code)) {
        writeFence('outcome_unknown', opIdentity && opIdentity.uid, '',
                   '认证请求已经返回，但结果身份无法安全提交：' + errText(e));
        _outcomeRecovery = null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth('unknown', '', errText(e));
      } else if (code === 'AUTH_SESSION_UID_MISMATCH') {
        _outcomeRecovery = null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth('mismatch', e.observedUid || '', errText(e));
      } else if (/AUTH_OUTCOME_UNKNOWN|AUTH_MUTATION_INDETERMINATE/.test(code)) {
        _outcomeRecovery = opIdentity
          ? { auth: aRef, identity: identity, operation: opIdentity }
          : null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth('unknown', '', errText(e));
      } else {
        setOperation(readPending().verificationId ? 'code_sent' : 'idle', errText(e));
        refreshSessionTruth();
      }
      throw e;
    });
  }

  /* 用户名密码只登录已有账号。CloudBase 的密码策略由服务端返回，不在前端伪造。 */
  function loginByPassword(username, password) {
    var u = String(username == null ? '' : username).trim();
    var p;
    if (!u) return Promise.reject(new Error('请输入用户名'));
    try { p = passwordInput(password); } catch (e) { return Promise.reject(e); }
    var token;
    try { token = beginSubmit('verifying'); }
    catch (e0) { return Promise.reject(e0); }

    var aRef = null, opIdentity = null;
    var sessionMutationResolved = false;
    var identity = { method: 'password', phone: '', username: u };
    var work = auth().then(function (a) {
      assertAuthToken(token);
      aRef = a;
      var req;
      if (typeof a.signInWithPassword === 'function')
        req = a.signInWithPassword({ username: u, password: p });
      else if (typeof a.signIn === 'function')
        req = a.signIn({ username: u, password: p });
      else
        throw new Error('当前环境不支持用户名密码登录');
      setOperation('confirming');
      return awaitAuthMutation(req, '用户名密码登录仍在处理，请勿重试', token, true);
    }).then(function (result) {
      assertAuthToken(token);
      sessionMutationResolved = true;
      opIdentity = requireOperationIdentity(result);
      return confirmSession(aRef, opIdentity.uid, token);
    }).then(function (snap) {
      assertAuthToken(token);
      return commitSignedIn(identity, opIdentity, snap, token);
    });
    return work.then(function (r) {
      finishSubmit(token);
      return r;
    }, function (e) {
      finishSubmit(token);
      if (isStaleError(e) || token !== _authGeneration) throw e;
      var code = String(e && e.code || '');
      if (code === 'AUTH_FENCED_SESSION') {
        _outcomeRecovery = null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth(readFence().kind === 'mismatch' ? 'mismatch' : 'unknown',
                        readFence().observedUid || '', errText(e));
      } else if (sessionMutationResolved &&
                 !/AUTH_OUTCOME_UNKNOWN|AUTH_SESSION_UID_MISMATCH|AUTH_MUTATION_INDETERMINATE/.test(code)) {
        writeFence('outcome_unknown', opIdentity && opIdentity.uid, '',
                   '认证请求已经返回，但结果身份无法安全提交：' + errText(e));
        _outcomeRecovery = null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth('unknown', '', errText(e));
      } else if (code === 'AUTH_SESSION_UID_MISMATCH') {
        _outcomeRecovery = null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth('mismatch', e.observedUid || '', errText(e));
      } else if (/AUTH_OUTCOME_UNKNOWN|AUTH_MUTATION_INDETERMINATE/.test(code)) {
        _outcomeRecovery = opIdentity
          ? { auth: aRef, identity: identity, operation: opIdentity }
          : null;
        setOperation('outcome_unknown', errText(e));
        setSessionTruth('unknown', '', errText(e));
      } else {
        setOperation('idle', errText(e));
        refreshSessionTruth();
      }
      throw e;
    });
  }

  function registerByPassword() {
    return Promise.reject(new Error('CloudBase 不支持直接用用户名注册；请先在手机号页完成真实注册'));
  }

  function recoverAuthOutcome() {
    var r = _outcomeRecovery;
    var fence = readFence();
    if (fence.kind === 'mismatch' || fence.kind === 'stale_mutation')
      return Promise.reject(new Error('账号边界不一致，不能自动接管；请安全退出并清理会话'));
    if (!r || !r.auth || !r.operation || !r.operation.uid)
      return Promise.reject(new Error('没有可安全重新确认的登录结果；请安全退出并清理会话'));
    var ownedFenceRevision = Number(fence.revision || 0);
    var token;
    try { token = beginRecovery(); }
    catch (e0) { return Promise.reject(e0); }
    return confirmSession(r.auth, r.operation.uid, token).then(function (snap) {
      assertAuthToken(token);
      return commitSignedIn(r.identity, r.operation, snap, token, ownedFenceRevision);
    }).then(function (v) {
      _outcomeRecovery = null;
      finishSubmit(token);
      return v;
    }, function (e) {
      finishSubmit(token);
      if (isStaleError(e) || token !== _authGeneration) throw e;
      if (e && e.code === 'AUTH_SESSION_UID_MISMATCH') {
        _outcomeRecovery = null;
        setSessionTruth('mismatch', e.observedUid || '', errText(e));
      }
      setOperation('outcome_unknown', errText(e));
      throw e;
    });
  }

  function signOut() {
    if (_cloudBusy) return Promise.reject(new Error('云存档操作正在进行，请完成后再退出'));
    _authEpoch++;
    var hadPriorSessionMutation = _activeSessionMutations > 0;
    var token = invalidateAuthWork('用户已请求安全退出');
    var signOutFenceRevision = _fenceRevision;
    _submitBusy = false;
    _submitToken = 0;
    _outcomeRecovery = null;
    setOperation('signing_out');
    setSessionTruth('checking', '', '正在退出');
    return auth().then(function (a) {
      assertAuthToken(token);
      if (typeof a.signOut !== 'function') throw new Error('当前 SDK 不支持退出登录');
      var revokeError = null;
      return awaitAuthMutation(a.signOut(), '正在安全退出，请勿关闭页面', token, true)
        .catch(function (e0) {
          if (isStaleError(e0) || token !== _authGeneration) throw e0;
          revokeError = e0;
        }).then(function () {
          assertAuthToken(token);
          return sessionSnapshot(a);
        }).then(function (snap) {
          assertAuthToken(token);
          if (snap.session) {
            var e = revokeError ||
              new Error('云端会话或凭证仍然存在，退出没有完成');
            if (!e.code) e.code = 'AUTH_SIGNOUT_INCOMPLETE';
            throw e;
          }
          /* SDK signOut 即使报错，只要随后已确认 session=null，退出仍可安全完成。 */
        });
    }).then(function () {
      _pendingMemory = null;
      try { sessionStorage.removeItem(PKEY); } catch (_) {}
      writeLocal({
        schema: 1076, method: '', signedAt: 0, uid: '', phone: '', username: '',
        pendingPhone: '', verificationId: '', isUser: false
      });
      try {
        if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp();
      } catch (e0) {}
      if (hadPriorSessionMutation || _activeSessionMutations > 0 ||
          _fenceRevision !== signOutFenceRevision) {
        writeFence('stale_mutation', '', '',
          '旧登录请求仍可能晚到；本机已退出，请刷新页面后再次核对');
        setOperation('idle', '本机已退出；旧请求仍在收尾，请刷新页面后再次核对');
        setSessionTruth('unknown', '', '旧登录请求仍可能晚到，已禁止自动接管');
        return {
          ok: true,
          serverRevoked: true,
          cleanupPending: true,
          requiresReload: true
        };
      }
      clearFence();
      setOperation('idle');
      setSessionTruth('signed_out', '', '');
      return { ok: true, serverRevoked: true, cleanupPending: false };
    }).catch(function (e) {
      if (isStaleError(e) || token !== _authGeneration) throw e;
      _submitBusy = false;
      _submitToken = 0;
      if (!readFence().kind)
        writeFence('outcome_unknown', '', '', '退出结果未确认：' + errText(e));
      setOperation('idle', errText(e));
      setSessionTruth('unknown', '', '退出结果未确认：' + errText(e));
      throw e;
    });
  }

  function commitSignedIn(inputIdentity, opIdentity, snap, token, ownedFenceRevision) {
    assertAuthToken(token);
    var existingFence = readFence();
    if (existingFence.kind &&
        !(existingFence.kind === 'outcome_unknown' &&
          Number(existingFence.revision || 0) === Number(ownedFenceRevision || -1))) {
      var blocked = new Error('认证期间出现了更高优先级的账号隔离，拒绝提交登录结果');
      blocked.code = 'AUTH_FENCED_SESSION';
      blocked.observedUid = String(existingFence.observedUid || '');
      throw blocked;
    }
    if (!opIdentity || !opIdentity.uid || !snap || !snap.uid ||
        String(opIdentity.uid) !== String(snap.uid)) {
      writeFence('mismatch', opIdentity && opIdentity.uid, snap && snap.uid,
                 '本次认证账号与云端会话不一致');
      var e = new Error('本次认证账号与云端会话不一致');
      e.code = 'AUTH_SESSION_UID_MISMATCH';
      e.expectedUid = String((opIdentity && opIdentity.uid) || '');
      e.observedUid = String((snap && snap.uid) || '');
      throw e;
    }
    var uid = String(snap.uid);
    var serverIdentity = identityOf({ user: snap.user });
    var phone = serverIdentity.phone || opIdentity.phone || inputIdentity.phone || '';
    var username = serverIdentity.username || opIdentity.username || inputIdentity.username || '';
    assertAuthToken(token);
    if (existingFence.kind) clearFence();  /* 只清本次 recovery 精确拥有的 outcome fence */
    writeLocal({
      schema: 1076,
      method: inputIdentity.method,
      phone: phone,
      username: username,
      uid: uid,
      signedAt: Date.now(),
      pendingPhone: '',
      verificationId: '',
      isUser: false
    });
    _pendingMemory = null;
    try { sessionStorage.removeItem(PKEY); } catch (_) {}
    _outcomeRecovery = null;
    _probeId++;
    var epoch = ++_authEpoch;
    setOperation('idle');
    setSessionTruth('confirmed', uid, '');
    try {
      if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp();
    } catch (e0) {}

    /* 登录成功先立即返回。竞赛档案可能写 sb_profile；进度对账只读。
       两项并行且各自有上限，任何一项失败/悬挂都不能卡住另一项或认证结果。 */
    var profileJob = withTimeout(ensureProfile(uid), 8000, '竞赛档案处理超时')
      .catch(function () { return null; });
    var syncJob = withTimeout(syncOnLogin(uid, epoch), 8000, '云存档检查超时')
      .catch(function (e1) {
        return { ok: false, action: 'deferred', reason: errText(e1) };
      });
    var job = Promise.all([profileJob, syncJob]).then(function (items) {
      var prof = items[0], sync = items[1];
      if (epoch !== _authEpoch || !isSignedIn() || readLocal().uid !== uid)
        return { stale: true };
      return {
        cid: (prof && prof.cid) || 0,
        pendingId: !(prof && prof.cid),
        sync: sync,
        uid: uid,
        epoch: epoch
      };
    }).catch(function (e1) {
      return {
        cid: 0,
        pendingId: true,
        uid: uid,
        epoch: epoch,
        sync: { ok: false, action: 'deferred', reason: errText(e1) }
      };
    });
    return { ok: true, uid: uid, cid: 0, pendingId: true, epoch: epoch, postLogin: job };
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
      if (prof && prof.cid > 0 && isSignedIn() && String(readLocal().uid || '') === String(uid)) {
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

  function syncOnLogin(expectedUid, epoch) {
    var CS = window.HansenCloudSave;
    if (!CS || typeof CS.accountCloudInfo !== 'function')
      return Promise.resolve({ ok: false, action: 'deferred', reason: 'cloudsave-unavailable' });
    return ensureSession(expectedUid).then(function (truth) {
      if (!truth.ok || truth.uid !== expectedUid || epoch !== _authEpoch)
        return { ok: false, action: 'deferred', reason: 'session-changed' };
      return CS.accountCloudInfo();
    }).then(function (info) {
      if (info && info.action === 'deferred') return info;
      if (epoch !== _authEpoch || !isSignedIn() || readLocal().uid !== expectedUid)
        return { ok: false, action: 'deferred', reason: 'session-changed' };
      var hasLocal = localHasProgress();
      var local = localProgressSize();
      if (info && info.exists === null)
        return { ok: false, action: 'cloud-unreachable', reason: info.reason || '' };
      var hasCloud = !!(info && info.exists);
      if (!hasCloud && !hasLocal) return { ok: true, action: 'nothing-to-sync' };
      if (hasCloud && !hasLocal)
        return { ok: true, action: 'restore-available', cloudUpdatedAt: info.updatedAt || 0 };
      if (hasCloud && hasLocal)
        return { ok: true, action: 'conflict', local: local, cloudUpdatedAt: info.updatedAt || 0 };
      return { ok: true, action: 'upload-available', local: local };
    }).catch(function (e) {
      return { ok: false, action: 'deferred', reason: errText(e) };
    });
  }

  function guardedCloudAction(choice, expectedUid) {
    expectedUid = String(expectedUid || readLocal().uid || '');
    if (!expectedUid) return Promise.reject(new Error('没有可验证的登录账号'));
    if (_cloudBusy) return Promise.reject(new Error('另一个云存档操作正在进行'));
    if (choice === 'later') return Promise.resolve({ ok: true, action: 'deferred-by-user' });
    var CS = window.HansenCloudSave;
    if (!CS) return Promise.reject(new Error('云存档模块不可用'));
    _cloudBusy = true;
    var epoch = _authEpoch;
    return ensureSession(expectedUid).then(function (truth) {
      if (!truth.ok || truth.uid !== expectedUid || epoch !== _authEpoch)
        throw new Error('账号会话已经变化，已停止本次存档操作');
      if (choice === 'cloud') {
        if (typeof CS.restoreWithKey !== 'function' || typeof CS.ensureKey !== 'function')
          throw new Error('云端恢复功能不可用');
        return CS.restoreWithKey(CS.ensureKey(), { expectedUid: expectedUid }).then(function (r) {
          return { result: r, action: 'restored' };
        });
      }
      if (choice === 'local') {
        if (typeof CS.syncNow !== 'function') throw new Error('云端上传功能不可用');
        return CS.syncNow({ force: true }).then(function (r) {
          return { result: r, action: 'uploaded' };
        });
      }
      throw new Error('未知的云存档选择');
    }).then(function (wrapped) {
      return ensureSession(expectedUid).then(function (truth2) {
        if (!truth2.ok || truth2.uid !== expectedUid || epoch !== _authEpoch)
          return { ok: false, stale: true, action: wrapped.action };
        var r = wrapped.result;
        return {
          ok: !!(r && r.ok),
          action: wrapped.action,
          needReload: wrapped.action === 'restored' && !!(r && r.ok),
          reason: r && r.reason
        };
      });
    }).then(function (r) {
      _cloudBusy = false;
      return r;
    }, function (e) {
      _cloudBusy = false;
      throw e;
    });
  }

  function pushSave() {
    return guardedCloudAction('local', readLocal().uid);
  }
  function pullSave(key) {
    var CS = window.HansenCloudSave;
    if (!CS || typeof CS.restoreWithKey !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    var expectedUid = String(readLocal().uid || '');
    return ensureSession(expectedUid).then(function (truth) {
      if (!truth.ok || String(truth.uid || '') !== expectedUid)
        throw new Error('账号会话不可用，不能恢复');
      return CS.restoreWithKey(key, { expectedUid: expectedUid });
    });
  }

  /* SDK session 与 marker UID 必须完全一致；unknown 时只拒绝云操作，不清数据。 */
  function verifySession() {
    return refreshSessionTruth().then(function (st) {
      return { ok: st.state === 'confirmed', uid: st.uid, reason: st.reason, state: st.state };
    });
  }

  function ensureSession(expectedUid) {
    var marker = readLocal();
    var wanted = String(expectedUid || marker.uid || '');
    if (!wanted) return Promise.resolve({ ok: false, reason: 'not-signed-in', definite: true });
    var generation = _authGeneration;
    var probe = ++_probeId;
    return auth().then(function (a) {
      return sessionSnapshot(a);
    }).then(function (snap) {
      if (!probeCurrent(probe, generation))
        return { ok: false, stale: true, definite: false, reason: 'session-probe-stale' };
      marker = readLocal();
      var fence = readFence();
      if (fence.kind) {
        /* ensureSession 是只读门卫，只能拒绝；任何 fence 都必须由显式 signOut 清。 */
        setSessionTruth(fence.kind === 'mismatch' ? 'mismatch' : 'unknown',
                        snap.uid || fence.observedUid || '',
                        fence.reason || '存在未清理的认证结果');
        return { ok: false, fenced: true, definite: false, uid: snap.uid || '',
                 reason: fence.reason || '存在未清理的认证结果' };
      }
      if (snap.indeterminate || (snap.session && (!snap.user || !snap.uid))) {
        setSessionTruth('unknown', '', snap.reason || '凭证存在但用户身份无法确认');
        return { ok: false, expired: false, definite: false,
                 reason: snap.reason || '云端用户身份暂时无法确认' };
      }
      if (!snap.session || snap.anonymous) {
        setSessionTruth('signed_out', '', snap.anonymous ? 'anonymous-session' : 'no-session');
        return { ok: false, expired: true, definite: true, reason: '云端没有正式账号会话' };
      }
      if (String(snap.uid) !== wanted ||
          (marker.uid && String(marker.uid) !== String(snap.uid))) {
        writeFence('mismatch', wanted, snap.uid, 'marker/session UID mismatch');
        setSessionTruth('mismatch', snap.uid, 'marker/session UID mismatch');
        return { ok: false, mismatch: true, definite: true, uid: snap.uid,
                 reason: '本地账号与云端会话不是同一用户' };
      }
      setSessionTruth('confirmed', snap.uid, '');
      return { ok: true, uid: snap.uid, definite: true };
    }).catch(function (e) {
      if (!probeCurrent(probe, generation) || isStaleError(e))
        return { ok: false, stale: true, definite: false, reason: 'session-probe-stale' };
      setSessionTruth('unknown', '', errText(e));
      return { ok: false, definite: false, reason: errText(e) };
    });
  }

  window.HansenAuth = {
    ready: ready,
    isSignedIn: isSignedIn,
    ensureSession: ensureSession,
    refreshSession: refreshSessionTruth,
    sessionStatus: sessionStatus,
    operationStatus: operationStatus,
    recoverAuthOutcome: recoverAuthOutcome,
    resolveCloudChoice: guardedCloudAction,
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
    _setSessionForTest: function (state, uid) { setSessionTruth(state, uid || '', 'test'); },
    _readFenceForTest: readFence,
    _app: app
  };
  if (!window.__HANSEN_AUTH_NO_BOOT__) {
    setTimeout(function () { refreshSessionTruth(); }, 0);
  }
})();
