/* hansen_auth_v1004.js —— 账号系统：注册 / 登录 / 跨设备存档 / 竞赛 ID 发号
 *
 * 登录方式（对应控制台已开通的三种）：
 *   ① 手机号 + 短信验证码   —— 主力，注册与登录合一（is_user 判断走 signUp 还是 signIn）
 *   ② 用户名 + 密码         —— 只登录已由手机号真实创建并绑定凭据的账号
 *   ③ 匿名                  —— 不注册也能玩，之后可升级为正式账号
 *
 * 竞赛档案安全边界：
 *   v1076 浏览器端不再创建、修改或发放 sb_profile / 全局竞赛 ID。
 *   登录成功只做真实 session 确认与云存档只读检查；本机临时编号不受影响。
 *   全局 ID 只有在仓库具备可部署的 owner 规则、服务端 UID 派生和原子计数后才能恢复。
 */
(function () {
  'use strict';
  if (window.HansenAuth) return;

  var LKEY = 'hansen_auth_v1004';      /* v1075 及更早显示缓存：仅兼容读取/非身份辅助字段 */
  var OKEY_PREFIX = 'hansen_auth_boundary_outcome_v1076:'; /* 每个 boundary 的 write-once 结论 */

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
  function readLegacyLocal() {
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
  function markerFromOutcome(outcome, legacy) {
    var o = {}, k;
    legacy = legacy || {};
    for (k in legacy) if (Object.prototype.hasOwnProperty.call(legacy, k)) o[k] = legacy[k];
    if (!outcome || !outcome.boundaryId) return o;
    var signedIn = String(outcome.state || '') === 'signed_in';
    o.schema = 1076;
    o.method = signedIn ? String(outcome.method || 'session') : '';
    o.phone = signedIn ? String(outcome.phone || '') : '';
    o.username = signedIn ? String(outcome.username || '') : '';
    o.uid = signedIn ? String(outcome.uid || '') : '';
    o.signedAt = signedIn ? Number(outcome.signedAt || 0) : 0;
    o.authCommitId = signedIn ? String(outcome.authCommitId || '') : '';
    o.authBoundaryId = String(outcome.boundaryId || '');
    o.authBoundaryState = String(outcome.state || '');
    o.pendingPhone = '';
    o.verificationId = '';
    o.isUser = false;
    return o;
  }
  function readLocal() {
    var legacy = readLegacyLocal();
    var boundary = readAuthBoundary();
    if (!boundary.boundaryId) return legacy;
    var outcome = readBoundaryOutcome(boundary.boundaryId);
    if (outcome.boundaryId) return markerFromOutcome(outcome, legacy);
    /* 边界正在执行时只把父边界 outcome 当显示缓存；它绝不让 isSignedIn
       绕过当前 pending boundary。 */
    if (boundary.parentBoundaryId) {
      var parent = readBoundaryOutcome(boundary.parentBoundaryId);
      if (parent.boundaryId) return markerFromOutcome(parent, legacy);
    }
    /* 兼容已经写入 LKEY 的早期 v1076 marker；新登录/退出绝不再改它。 */
    if (String(legacy.authBoundaryId || '') === String(boundary.boundaryId) ||
        (boundary.parentBoundaryId &&
         String(legacy.authBoundaryId || '') === String(boundary.parentBoundaryId)))
      return legacy;
    return legacy;
  }
  function writeLocal(patch) {
    /* 仅保留 legacy migration / 非身份辅助字段；认证 commit 与 signOut 必须
       使用 writeBoundaryOutcome，绝不能覆盖另一个标签的共享 LKEY marker。 */
    var base = readLegacyLocal(), o = {}, k;
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
    var source = _authOverride
      ? Promise.resolve(_authOverride)
      : app().then(function () { if (!_auth) throw new Error('鉴权不可用'); return _auth; });
    var ms = Math.max(1, Number(window.__HANSEN_AUTH_INIT_TIMEOUT_MS__ || 12000));
    return withTimeout(source, ms, '认证服务初始化超时').catch(function (e) {
      if (e && e.code === 'AUTH_SESSION_CHECK_TIMEOUT') e.code = 'AUTH_INIT_TIMEOUT';
      throw e;
    });
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
    var fence = readFence();
    var marker = readLocal();
    var boundary = readAuthBoundary();
    var boundaryPending = !!(boundary.boundaryId && !boundarySettled(boundary));
    if (fence.kind || boundaryPending) {
      return {
        state: fence.kind === 'mismatch' ? 'mismatch' : 'unknown',
        uid: String((fence && fence.observedUid) || ''),
        reason: String((fence && fence.reason) ||
          (boundaryPending ? '另一个标签页的认证边界尚未完成，请先安全退出并核对会话' : '') ||
          _sessionTruth.reason || ''),
        checkedAt: _sessionTruth.checkedAt,
        storageWarning: _storageWarning
      };
    }
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
    var boundary = readAuthBoundary();
    var boundaryOk = !boundary.boundaryId ||
      (boundary.kind === 'session_mutation' &&
       String(lc.authBoundaryId || '') === String(boundary.boundaryId) &&
       String(lc.authBoundaryState || '') === 'signed_in');
    return !!(_sessionTruth.state === 'confirmed' && _sessionTruth.uid &&
              !readFence().kind && boundaryOk && lc.uid &&
              String(lc.uid) === String(_sessionTruth.uid));
  }
  function currentUser() {
    return isSignedIn() ? { uid: _sessionTruth.uid } : null;
  }
  function needsReauth() {
    var lc = readLocal();
    return !!(readFence().kind || authBoundaryPending() ||
              activeMutationReceipts().length ||
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
  var FBKEY = 'hansen_auth_fence_backup_v1076';
  var FSTORE_KEYS = [
    FBKEY,
    FBKEY + ':outcome_unknown',
    FBKEY + ':stale_mutation',
    FBKEY + ':mismatch'
  ];
  var BKEY = 'hansen_auth_boundary_v1076';
  var RKEY_PREFIX = 'hansen_auth_boundary_receipt_v1076:';
  var _authBoundaries = {};
  var _fenceMemory = null;
  var _fenceRevision = 0;

  function fenceRank(kind) {
    return ({ outcome_unknown: 1, stale_mutation: 2, mismatch: 3 })[String(kind || '')] || 0;
  }
  function parseFence(raw) {
    if (!raw) return null;
    try {
      var o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return (o && typeof o === 'object' && !Array.isArray(o) && o.kind) ? o : null;
    } catch (e) { return null; }
  }
  function fenceNewer(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    var ar = fenceRank(a.kind), br = fenceRank(b.kind);
    if (ar !== br) return ar > br ? a : b;
    var av = Number(a.revision || 0), bv = Number(b.revision || 0);
    if (av !== bv) return av > bv ? a : b;
    var ag = Number(a.generation || 0), bg = Number(b.generation || 0);
    if (ag !== bg) return ag > bg ? a : b;
    var at = Number(a.at || 0), bt = Number(b.at || 0);
    if (at !== bt) return at > bt ? a : b;
    return String(a.fenceId || '') >= String(b.fenceId || '') ? a : b;
  }
  function newFenceId(kind) {
    var rnd = '';
    try {
      var bytes = new Uint32Array(2);
      crypto.getRandomValues(bytes);
      rnd = bytes[0].toString(36) + bytes[1].toString(36);
    } catch (e) {
      rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    return String(kind || 'fence') + '-' + Date.now().toString(36) + '-' + rnd;
  }
  function parseAuthBoundary(raw) {
    if (!raw) return null;
    try {
      var o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return (o && typeof o === 'object' && !Array.isArray(o) &&
              o.boundaryId && o.kind) ? o : null;
    } catch (e) { return null; }
  }
  function readAuthBoundary() {
    try { return parseAuthBoundary(localStorage.getItem(BKEY)) || {}; }
    catch (e) {
      _storageWarning = 'auth-boundary-read-failed';
      return {};
    }
  }
  function sameAuthBoundary(a, b) {
    return !!(a && b && a.boundaryId && b.boundaryId &&
      String(a.boundaryId) === String(b.boundaryId) &&
      String(a.kind) === String(b.kind));
  }
  function parseBoundaryOutcome(raw) {
    if (!raw) return null;
    try {
      var o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return (o && typeof o === 'object' && !Array.isArray(o) &&
              o.boundaryId && (o.state === 'signed_in' || o.state === 'signed_out'))
        ? o : null;
    } catch (e) { return null; }
  }
  function readBoundaryOutcome(boundaryId) {
    if (!boundaryId) return {};
    try {
      return parseBoundaryOutcome(localStorage.getItem(OKEY_PREFIX + boundaryId)) || {};
    } catch (e) {
      _storageWarning = 'auth-boundary-outcome-read-failed';
      return {};
    }
  }
  function writeBoundaryOutcome(boundary, patch) {
    if (!boundary || !boundary.boundaryId) {
      var missing = new Error('认证结论缺少 boundary 所有权');
      missing.code = 'AUTH_BOUNDARY_MISSING';
      throw missing;
    }
    patch = patch || {};
    var state = String(patch.state || '');
    if (state !== 'signed_in' && state !== 'signed_out') {
      var invalid = new Error('认证结论状态无效');
      invalid.code = 'AUTH_BOUNDARY_OUTCOME_INVALID';
      throw invalid;
    }
    var key = OKEY_PREFIX + boundary.boundaryId;
    var o = {
      schema: 1076,
      boundaryId: String(boundary.boundaryId),
      kind: String(boundary.kind || ''),
      state: state,
      method: state === 'signed_in' ? String(patch.method || 'session') : '',
      phone: state === 'signed_in' ? String(patch.phone || '') : '',
      username: state === 'signed_in' ? String(patch.username || '') : '',
      uid: state === 'signed_in' ? String(patch.uid || '') : '',
      signedAt: state === 'signed_in' ? Number(patch.signedAt || Date.now()) : 0,
      authCommitId: state === 'signed_in' ? String(patch.authCommitId || '') : '',
      writtenAt: Date.now()
    };
    if (state === 'signed_in' && !o.uid) {
      var noUid = new Error('signed_in 结论缺少 UID');
      noUid.code = 'AUTH_BOUNDARY_OUTCOME_INVALID';
      throw noUid;
    }
    var encoded = JSON.stringify(o);
    try {
      var existingRaw = localStorage.getItem(key);
      if (existingRaw) {
        var existing = parseBoundaryOutcome(existingRaw);
        if (existing && String(existing.boundaryId) === o.boundaryId &&
            String(existing.state) === o.state &&
            String(existing.uid || '') === String(o.uid || '') &&
            String(existing.authCommitId || '') === String(o.authCommitId || ''))
          return existing;
        var conflict = new Error('同一认证 boundary 已有不同结论，拒绝覆盖');
        conflict.code = 'AUTH_BOUNDARY_OUTCOME_CONFLICT';
        throw conflict;
      }
      localStorage.setItem(key, encoded);
      if (localStorage.getItem(key) !== encoded)
        throw new Error('认证结论写入后无法原样读回');
    } catch (e) {
      if (e && e.code === 'AUTH_BOUNDARY_OUTCOME_CONFLICT') throw e;
      _storageWarning = 'auth-boundary-outcome-not-persistent';
      var failed = new Error('浏览器无法保存认证结论，已失败关闭');
      failed.code = 'AUTH_BOUNDARY_NOT_PERSISTED';
      throw failed;
    }
    return o;
  }
  function readBoundaryReceipt(boundaryId) {
    if (!boundaryId) return {};
    try {
      var raw = localStorage.getItem(RKEY_PREFIX + boundaryId);
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === 'object' && o.boundaryId) ? o : {};
    } catch (e) { return {}; }
  }
  function boundarySettled(boundary) {
    if (!boundary || !boundary.boundaryId) return true;  /* v1075/旧 marker 兼容 */
    var outcome = readBoundaryOutcome(boundary.boundaryId);
    if (String(outcome.boundaryId || '') === String(boundary.boundaryId)) {
      if (outcome.state === 'signed_in') return !!outcome.uid;
      if (outcome.state === 'signed_out') return !outcome.uid && !Number(outcome.signedAt || 0);
    }
    var legacy = readLegacyLocal();
    if (String(legacy.authBoundaryId || '') === String(boundary.boundaryId)) {
      var legacyState = String(legacy.authBoundaryState || '');
      if (legacyState === 'signed_in') return !!legacy.uid;
      if (legacyState === 'signed_out') return !legacy.uid && !Number(legacy.signedAt || 0);
    }
    var receipt = readBoundaryReceipt(boundary.boundaryId);
    return String(receipt.boundaryId || '') === String(boundary.boundaryId) &&
      String(receipt.state || '') === 'rejected';
  }
  function authBoundaryPending() {
    var boundary = readAuthBoundary();
    return !!(boundary.boundaryId && !boundarySettled(boundary));
  }
  function writeBoundaryReceipt(owned, state) {
    if (!owned || !owned.boundaryId) return null;
    state = String(state || 'active');
    var key = RKEY_PREFIX + owned.boundaryId;
    if (state === 'active' && !owned.receiptExpiresAt) {
      var hardMs = Number(window.__HANSEN_AUTH_MUTATION_TIMEOUT_MS__ || 60000);
      var configuredTtl = Number(window.__HANSEN_AUTH_RECEIPT_TTL_MS__ || 0);
      var ttl = configuredTtl > 0
        ? Math.max(hardMs + 1, configuredTtl)
        : Math.max(120000, hardMs + 60000);
      /* expiresAt 只用于诊断“疑似孤儿请求”；绝不能据此删除 active intent。 */
      owned.receiptExpiresAt = Date.now() + ttl;
    }
    var o = {
      schema: 1076,
      boundaryId: owned.boundaryId,
      kind: owned.kind,
      state: state,
      startedAt: Number(owned.startedAt || Date.now()),
      updatedAt: Date.now(),
      expiresAt: Number(owned.receiptExpiresAt || 0)
    };
    var encoded = JSON.stringify(o);
    try {
      localStorage.setItem(key, encoded);
      if (localStorage.getItem(key) !== encoded)
        throw new Error('认证 mutation 回执无法持久保存');
    } catch (e) {
      _storageWarning = 'auth-boundary-receipt-not-persistent';
      var err = new Error('浏览器无法保存认证安全回执，已在调用登录服务前停止');
      err.code = 'AUTH_BOUNDARY_NOT_PERSISTED';
      throw err;
    }
    owned.receiptKey = key;
    owned.receiptRaw = encoded;
    owned.receiptState = o.state;
    return o;
  }
  function mutationReceiptSnapshot() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(RKEY_PREFIX) !== 0) continue;
        var raw = localStorage.getItem(key), o = null;
        try { o = raw ? JSON.parse(raw) : null; } catch (_) {}
        out.push({ key: key, raw: raw, value: o || { state: 'unknown' } });
      }
    } catch (e) {
      _storageWarning = 'auth-boundary-receipt-read-failed';
      out.push({ key: '', raw: '', value: { state: 'unknown' } });
    }
    return out;
  }
  function activeMutationReceipts(items) {
    items = items || mutationReceiptSnapshot();
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var state = String((items[i].value && items[i].value.state) || 'unknown');
      if (state === 'active' || state === 'unknown') out.push(items[i]);
    }
    return out;
  }
  function overlappingMutationReceipts(signoutBoundary, initialItems) {
    var initial = {}, out = [], i;
    initialItems = initialItems || [];
    for (i = 0; i < initialItems.length; i++) initial[initialItems[i].key] = initialItems[i].raw;
    var finalItems = mutationReceiptSnapshot();
    for (i = 0; i < finalItems.length; i++) {
      var item = finalItems[i], value = item.value || {};
      if (String(value.boundaryId || '') === String(signoutBoundary.boundaryId || '')) continue;
      var state = String(value.state || 'unknown');
      if (state === 'active' || state === 'unknown') {
        out.push(item);
        continue;
      }
      /* 新出现或在 signOut 初扫后发生状态变化的其他 mutation，即使此刻
         已经 returned，也可能刚在 session=null 快照之后复活会话。 */
      if (!Object.prototype.hasOwnProperty.call(initial, item.key) ||
          initial[item.key] !== item.raw)
        out.push(item);
    }
    return out;
  }
  function expiredMutationReceipts() {
    var out = [], now = Date.now(), items = mutationReceiptSnapshot();
    for (var i = 0; i < items.length; i++) {
      var o = items[i].value || {};
      if (o.state === 'active' && Number(o.expiresAt || 0) > 0 &&
          Number(o.expiresAt || 0) <= now) out.push(items[i]);
    }
    return out;
  }
  function clearNonActiveReceipts(snapshot) {
    /* 只能清 signOut 初始快照里已经 terminal 且至今逐字未变的回执。
       绝不能在最终扫描后重新枚举并删除“刚刚 returned”的重叠 mutation。 */
    try {
      var items = snapshot || [], removable = [];
      for (var i = 0; i < items.length; i++) {
        var state = String((items[i].value && items[i].value.state) || 'unknown');
        if (state === 'returned' || state === 'rejected') removable.push(items[i]);
      }
      for (var j = 0; j < removable.length; j++) {
        if (localStorage.getItem(removable[j].key) === removable[j].raw)
          localStorage.removeItem(removable[j].key);
      }
    } catch (e) { _storageWarning = 'auth-boundary-receipt-cleanup-failed'; }
  }
  function claimAuthBoundary(kind, token, allowPending) {
    var current = readAuthBoundary();
    if (!allowPending && current.boundaryId &&
        !boundarySettled(current)) {
      var pending = new Error('另一个标签页的认证或退出操作尚未完成，请先安全退出并核对会话');
      pending.code = 'AUTH_CROSS_TAB_OPERATION_PENDING';
      throw pending;
    }
    var o = {
      schema: 1076,
      boundaryId: newFenceId(kind || 'auth-boundary'),
      kind: String(kind || 'session_mutation'),
      parentBoundaryId: String(current.boundaryId || ''),
      generation: Number(token || 0),
      startedAt: Date.now()
    };
    var encoded = JSON.stringify(o);
    try {
      localStorage.setItem(BKEY, encoded);
      if (localStorage.getItem(BKEY) !== encoded)
        throw new Error('认证边界写入后无法读回');
    } catch (e) {
      _storageWarning = 'auth-boundary-not-persistent';
      var err = new Error('浏览器无法保存跨标签认证边界，已在调用登录服务前停止');
      err.code = 'AUTH_BOUNDARY_NOT_PERSISTED';
      throw err;
    }
    /* returned/rejected receipt 只由一次后续、已复验干净的显式 signOut 清理；
       claim 期间删除会制造“初扫后出现又结算”的 ABA 漏洞。 */
    _authBoundaries[String(token)] = o;
    return o;
  }
  function assertSharedBoundary(token) {
    var owned = _authBoundaries[String(token)];
    if (!owned) return true;
    var current = readAuthBoundary();
    if (sameAuthBoundary(current, owned)) return true;
    writeFence('stale_mutation', '', '',
      '另一个标签页建立了新的认证/退出边界；旧请求已失去提交资格');
    var e = staleError('另一个标签页已经开始新的认证或安全退出，当前结果已作废');
    e.code = 'AUTH_CROSS_TAB_SUPERSEDED';
    e.stale = true;
    throw e;
  }
  function markSessionMutation(token) {
    assertAuthToken(token);
    var owned = _authBoundaries[String(token)];
    if (!owned) {
      var e = new Error('认证请求缺少可验证的共享边界');
      e.code = 'AUTH_BOUNDARY_MISSING';
      throw e;
    }
    writeBoundaryReceipt(owned, 'active');
    try {
      assertSharedBoundary(token);
    } catch (e) {
      /* boundary 在 active receipt 持久化后、SDK 调用前被取代：底层请求尚未
         发出，因此把本 receipt 明确定格为 rejected，不能留下假 active。 */
      finishSessionMutation(token, 'rejected');
      throw e;
    }
  }
  function finishSessionMutation(token, outcome) {
    var owned = _authBoundaries[String(token)];
    if (!owned || !owned.receiptKey) return;
    try {
      writeBoundaryReceipt(owned, outcome || 'returned');
    } catch (e) {
      writeFence('outcome_unknown', '', '', errText(e));
    }
    if (owned.released && owned.receiptState !== 'active')
      delete _authBoundaries[String(token)];
  }
  function releaseAuthBoundaryToken(token) {
    var owned = _authBoundaries[String(token)];
    if (!owned) return;
    owned.released = true;
    if (owned.receiptState !== 'active')
      delete _authBoundaries[String(token)];
  }

  function readFence() {
    var candidates = [], i, raw, item;
    if (_fenceMemory) candidates.push(_fenceMemory);
    try {
      item = parseFence(sessionStorage.getItem(FKEY));
      if (item) candidates.push(item);
    } catch (e) {}
    for (i = 0; i < FSTORE_KEYS.length; i++) {
      try {
        raw = localStorage.getItem(FSTORE_KEYS[i]);
        item = parseFence(raw);
        if (item) candidates.push(item);
      } catch (e2) {}
    }
    var best = null, maxRevision = _fenceRevision;
    for (i = 0; i < candidates.length; i++) {
      maxRevision = Math.max(maxRevision, Number(candidates[i].revision || 0));
      best = fenceNewer(best, candidates[i]);
    }
    _fenceRevision = maxRevision;
    _fenceMemory = best || null;
    return best || {};
  }
  function writeFence(kind, expectedUid, observedUid, reason) {
    kind = String(kind || 'outcome_unknown');
    var current = readFence();
    if (current.kind && fenceRank(current.kind) > fenceRank(kind))
      return current;  /* 迟到的弱结果绝不能冲掉 mismatch/stale 边界 */
    _fenceRevision++;
    _probeId++;  /* fence 一旦出现，所有尚未落地的只读探测立即失去写状态权 */
    var o = {
      schema: 1076,
      fenceId: newFenceId(kind),
      kind: kind,
      expectedUid: String(expectedUid || ''),
      observedUid: String(observedUid || ''),
      reason: String(reason || ''),
      generation: _authGeneration,
      revision: _fenceRevision,
      at: Date.now()
    };
    _fenceMemory = o;
    var encoded = JSON.stringify(o), persisted = false;
    try {
      sessionStorage.setItem(FKEY, encoded);
      persisted = sessionStorage.getItem(FKEY) === encoded;
    } catch (e) {}
    try {
      localStorage.setItem(FBKEY, encoded);  /* 兼容已经发布过的单备份键 */
      localStorage.setItem(FBKEY + ':' + kind, encoded);
      persisted = persisted || localStorage.getItem(FBKEY + ':' + kind) === encoded;
    } catch (e2) {}
    if (!persisted) _storageWarning = 'auth-fence-not-persistent';
    return readFence();  /* 合并其他标签页同时写入的更强记录 */
  }
  function sameFence(a, b) {
    if (!a || !b || !a.kind || !b.kind) return false;
    if (a.fenceId && b.fenceId) return String(a.fenceId) === String(b.fenceId);
    return String(a.kind) === String(b.kind) &&
      Number(a.revision || 0) === Number(b.revision || 0) &&
      Number(a.at || 0) === Number(b.at || 0) &&
      String(a.expectedUid || '') === String(b.expectedUid || '') &&
      String(a.observedUid || '') === String(b.observedUid || '');
  }
  function fenceSourceSnapshot() {
    var out = [], i;
    function take(storage, key) {
      try { out.push({ storage: storage, key: key, raw: storage.getItem(key) }); }
      catch (e) { out.push({ storage: storage, key: key, raw: null, unavailable: true }); }
    }
    take(sessionStorage, FKEY);
    for (i = 0; i < FSTORE_KEYS.length; i++) take(localStorage, FSTORE_KEYS[i]);
    return out;
  }
  function clearFence(owned, snapshot) {
    _fenceRevision++;
    _probeId++;  /* 清理也是身份边界变化：旧 refresh/ensure 立即失去落地资格 */
    function clearOne(storage, key, expectedRaw, unavailable) {
      try {
        if (owned) {
          var current = parseFence(storage.getItem(key));
          if (sameFence(current, owned)) storage.removeItem(key);
          return;
        }
        /* 显式 signOut 只能删除“清理快照里亲眼见过”的原值。
           快照后出现/变化的跨标签 fence 必须保留，让调用方返回 cleanupPending。 */
        if (unavailable || expectedRaw == null) return;
        if (storage.getItem(key) === expectedRaw) storage.removeItem(key);
      } catch (e) {}
    }
    if (owned) {
      clearOne(sessionStorage, FKEY);
      for (var i = 0; i < FSTORE_KEYS.length; i++) clearOne(localStorage, FSTORE_KEYS[i]);
      if (sameFence(_fenceMemory, owned)) _fenceMemory = null;
    } else {
      snapshot = snapshot || fenceSourceSnapshot();
      for (var j = 0; j < snapshot.length; j++)
        clearOne(snapshot[j].storage, snapshot[j].key, snapshot[j].raw, snapshot[j].unavailable);
      _fenceMemory = null;
    }
    return !readFence().kind;
  }
  function staleError(reason) {
    var e = new Error(reason || '这次认证结果已经过期，已拒绝写入');
    e.code = 'AUTH_STALE_OPERATION';
    return e;
  }
  function isStaleError(e) {
    return !!(e && (e.stale || e.code === 'AUTH_STALE_OPERATION' ||
                    e.code === 'AUTH_CROSS_TAB_SUPERSEDED'));
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
    assertSharedBoundary(token);
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
      requiresCleanup: !!(fence.kind || authBoundaryPending() || activeMutationReceipts().length),
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
      function finishUnderlying(outcome) {
        if (underlyingDone) return;
        underlyingDone = true;
        _activeMutationTasks = Math.max(0, _activeMutationTasks - 1);
        if (sessionMutation) {
          _activeSessionMutations = Math.max(0, _activeSessionMutations - 1);
          finishSessionMutation(token, outcome || 'returned');
        }
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
        clearTimeout(slowTimer);
        clearTimeout(hardTimer);
        removeWaiter(cancel);
        var unwrapped;
        try {
          unwrapped = unwrapAuthResult(v);
          finishUnderlying('returned');
        } catch (e0) {
          finishUnderlying('rejected');
          if (!wrapperDone) {
            wrapperDone = true;
            reject(e0);
          }
          return;
        }
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
        try {
          assertSharedBoundary(token);
          resolve(unwrapped);
        } catch (e1) { reject(e1); }
      }, function (e) {
        finishUnderlying('unknown');
        if (sessionMutation)
          writeFence('outcome_unknown', '', '', '认证请求被网络层拒绝，服务端结果无法确认');
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
    if (_operation.state === 'signing_out')
      return Promise.resolve(sessionStatus());
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
      var boundary = readAuthBoundary();
      if (fence.kind) {
        /* 只读 refresh 永远无权清 fence。即使这一刻 session=null，也可能有旧
           mutation 随后建立 session；只有显式 signOut 的屏障可以解除隔离。 */
        return setSessionTruth(fence.kind === 'mismatch' ? 'mismatch' : 'unknown',
                               snap.uid || fence.observedUid || '',
                               fence.reason || '存在未清理的认证结果，请先安全退出');
      }
      if (boundary.boundaryId && !boundarySettled(boundary)) {
        return setSessionTruth('unknown', '',
          '共享认证边界尚未完成；只读刷新无权自动接管或清理');
      }
      if (snap.indeterminate || (snap.session && (!snap.user || !snap.uid))) {
        return setSessionTruth('unknown', '', snap.reason || '凭证存在但用户身份无法确认');
      }
      if (!snap.session || snap.anonymous) {
        if (marker.method && marker.signedAt && !marker.uid)
          return setSessionTruth('legacy_reauth', '', '旧 marker 没有真实 UID');
        writeLocal({
          method: '', signedAt: 0, uid: '', phone: '', username: '', authCommitId: '',
          authBoundaryId: String(boundary.boundaryId || marker.authBoundaryId || ''),
          authBoundaryState: 'signed_out'
        });
        return setSessionTruth('signed_out', '', snap.anonymous ? 'anonymous-session' : 'no-session');
      }
      if (marker.method && marker.signedAt && !marker.uid)
        return setSessionTruth('legacy_reauth', '', '旧 marker 不能绑定现有会话');
      if (marker.uid && String(marker.uid) !== String(snap.uid)) {
        writeFence('mismatch', marker.uid, snap.uid, '本地账号与 SDK 会话不一致');
        return setSessionTruth('mismatch', snap.uid, '本地账号与 SDK 会话不一致');
      }
      if (!marker.uid || (boundary.boundaryId &&
          (String(marker.authBoundaryId || '') !== String(boundary.boundaryId) ||
           String(marker.authBoundaryState || '') !== 'signed_in'))) {
        writeLocal({
          schema: 1076,
          method: marker.method || 'session',
          uid: snap.uid,
          phone: identityOf({ user: snap.user }).phone || marker.phone || '',
          username: identityOf({ user: snap.user }).username || marker.username || '',
          signedAt: marker.signedAt || Date.now(),
          authBoundaryId: String(boundary.boundaryId || marker.authBoundaryId || ''),
          authBoundaryState: 'signed_in'
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
    if (/AUTH_SESSION_UID_MISMATCH|AUTH_STALE_MUTATION|AUTH_CROSS_TAB_SUPERSEDED|本次认证账号与云端会话不一致|不是同一用户/i.test(m))
      return '检测到两个不同账号或旧请求晚到，已隔离；请点“安全退出并清理会话”后再登录';
    if (/AUTH_FENCED_SESSION|AUTH_OUTCOME_UNKNOWN|AUTH_MUTATION_INDETERMINATE|AUTH_CROSS_TAB_OPERATION_PENDING|AUTH_BOUNDARY_NOT_PERSISTED|AUTH_LATE_MUTATION_PENDING|暂时无法确认云端会话|结果仍在确认/i.test(m))
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
    if (readFence().kind || authBoundaryPending() || activeMutationReceipts().length)
      return Promise.reject(new Error('存在未清理的认证结果或跨标签请求，请先安全退出并清理会话'));
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
    try {
      claimAuthBoundary('session_mutation', token, false);
    } catch (e0) {
      setOperation('idle', errText(e0));
      setSessionTruth('unknown', '', errText(e0));
      throw e0;
    }
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
    try {
      /* recoverAuthOutcome 已先验证唯一 fence 所有权，允许它显式取代未完成边界。 */
      claimAuthBoundary('session_mutation', token, true);
    } catch (e0) {
      setOperation('outcome_unknown', errText(e0));
      setSessionTruth('unknown', '', errText(e0));
      throw e0;
    }
    _submitBusy = true;
    _submitToken = token;
    setOperation('confirming');
    setSessionTruth('checking', '', '正在重新核对本次认证');
    return token;
  }

  function finishSubmit(token, succeeded) {
    var owned = _authBoundaries[String(token)];
    /* 非 session 步骤（例如验证码 verify 或 SDK 初始化）确定失败时，
       用本操作唯一 receipt 标记 rejected；不改共享 marker，也不做跨 owner 清理。 */
    if (!succeeded && owned && !owned.receiptKey && !readFence().kind &&
        sameAuthBoundary(readAuthBoundary(), owned)) {
      try { writeBoundaryReceipt(owned, 'rejected'); }
      catch (e0) { writeFence('outcome_unknown', '', '', errText(e0)); }
    }
    if (token === _submitToken) {
      _submitBusy = false;
      _submitToken = 0;
    }
    releaseAuthBoundaryToken(token);
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
        markSessionMutation(token);
        try {
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
        } catch (e0) {
          finishSessionMutation(token, 'rejected');
          throw e0;
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
      finishSubmit(token, true);
      return r;
    }, function (e) {
      finishSubmit(token, false);
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
        var ownedFence = readFence();
        _outcomeRecovery = (opIdentity && ownedFence.kind === 'outcome_unknown' &&
                            ownedFence.fenceId &&
                            String(ownedFence.expectedUid || '') === String(opIdentity.uid))
          ? { auth: aRef, identity: identity, operation: opIdentity,
              fenceId: ownedFence.fenceId, fenceGeneration: ownedFence.generation }
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
      markSessionMutation(token);
      try {
        if (typeof a.signInWithPassword === 'function')
          req = a.signInWithPassword({ username: u, password: p });
        else if (typeof a.signIn === 'function')
          req = a.signIn({ username: u, password: p });
        else
          throw new Error('当前环境不支持用户名密码登录');
      } catch (e0) {
        finishSessionMutation(token, 'rejected');
        throw e0;
      }
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
      finishSubmit(token, true);
      return r;
    }, function (e) {
      finishSubmit(token, false);
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
        var ownedFence = readFence();
        _outcomeRecovery = (opIdentity && ownedFence.kind === 'outcome_unknown' &&
                            ownedFence.fenceId &&
                            String(ownedFence.expectedUid || '') === String(opIdentity.uid))
          ? { auth: aRef, identity: identity, operation: opIdentity,
              fenceId: ownedFence.fenceId, fenceGeneration: ownedFence.generation }
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
    if (!r || !r.auth || !r.operation || !r.operation.uid ||
        fence.kind !== 'outcome_unknown' || !fence.fenceId ||
        String(r.fenceId || '') !== String(fence.fenceId) ||
        String(fence.expectedUid || '') !== String(r.operation.uid)) {
      return Promise.reject(new Error(
        fence.kind === 'mismatch' || fence.kind === 'stale_mutation'
          ? '账号边界不一致，不能自动接管；请安全退出并清理会话'
          : '没有可安全重新确认的登录结果；请安全退出并清理会话'));
    }
    var ownedFence = fence;
    var token;
    try { token = beginRecovery(); }
    catch (e0) { return Promise.reject(e0); }
    return confirmSession(r.auth, r.operation.uid, token).then(function (snap) {
      assertAuthToken(token);
      return commitSignedIn(r.identity, r.operation, snap, token, ownedFence);
    }).then(function (v) {
      _outcomeRecovery = null;
      finishSubmit(token, true);
      return v;
    }, function (e) {
      finishSubmit(token, false);
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
    readFence();
    /* 单次全量快照同时承担初始 active 判断与 ABA 对比。不能先扫 active、
       再靠最终 active 瞬时值推断“期间从未有 mutation”。 */
    var receiptSnapshotBefore = mutationReceiptSnapshot();
    var priorReceipts = activeMutationReceipts(receiptSnapshotBefore);
    var hadPriorSessionMutation = _activeSessionMutations > 0 ||
      priorReceipts.length > 0;

    /* 先把 signout 边界写进共享 localStorage，再作废本标签 waiter。
       另一个标签旧请求只能写自己的 receipt/outcome，不能覆盖本边界结论。 */
    var token = _authGeneration + 1;
    var signoutBoundary;
    try {
      signoutBoundary = claimAuthBoundary('signout', token, true);
    } catch (e0) {
      setOperation('idle', errText(e0));
      setSessionTruth('unknown', '', errText(e0));
      return Promise.reject(e0);
    }

    _authEpoch++;
    token = invalidateAuthWork('用户已请求安全退出');
    var signOutFenceRevision = _fenceRevision;
    _submitBusy = false;
    _submitToken = 0;
    _outcomeRecovery = null;
    setOperation('signing_out');
    setSessionTruth('checking', '', '正在退出');

    function cleanupPending(reason) {
      reason = reason ||
        '旧认证请求仍可能晚到；请关闭本小程序的所有标签页并清除该站点认证数据后重新登录';
      writeFence('stale_mutation', '', '', reason);
      setOperation('idle', reason);
      setSessionTruth('unknown', '', reason);
      releaseAuthBoundaryToken(token);
      return {
        ok: true,
        serverRevoked: true,
        cleanupPending: true,
        requiresReload: true,
        recovery: '关闭所有相关标签页，清除该站点认证/站点数据，重新打开后登录'
      };
    }

    return auth().then(function (a) {
      assertAuthToken(token);
      if (typeof a.signOut !== 'function') throw new Error('当前 SDK 不支持退出登录');
      var revokeError = null, request;
      markSessionMutation(token);
      try { request = a.signOut(); }
      catch (e0) {
        finishSessionMutation(token, 'rejected');
        throw e0;
      }
      return awaitAuthMutation(request, '正在安全退出，请勿关闭页面', token, true)
        .catch(function (e1) {
          if (isStaleError(e1) || token !== _authGeneration) throw e1;
          revokeError = e1;
        }).then(function () {
          assertAuthToken(token);
          return sessionSnapshot(a);
        }).then(function (snap) {
          assertAuthToken(token);
          if (snap.session) {
            var e = revokeError || new Error('云端会话或凭证仍然存在，退出没有完成');
            if (!e.code) e.code = 'AUTH_SIGNOUT_INCOMPLETE';
            throw e;
          }
          /* SDK signOut 即使返回业务错误，也只有复验 session=null 后才能继续。 */
        });
    }).then(function () {
      assertAuthToken(token);
      _probeId++;
      _pendingMemory = null;
      try { sessionStorage.removeItem(PKEY); } catch (_) {}

      /* localStorage 没有 CAS：这里只写 A 自己的 append-only outcome key。
         即使 B 在下一条语句前取得 BKEY，A 也没有任何共享 marker 可覆盖。 */
      assertSharedBoundary(token);
      writeBoundaryOutcome(signoutBoundary, { state: 'signed_out' });

      /* 跨一个 task 边界，让 outcome 写入钩子/其他标签的 BKEY、fence 与 receipt
         变化在宣布 clean 前可见。 */
      return delay(0);
    }).then(function () {
      assertAuthToken(token);
      var finalActive = activeMutationReceipts();
      var overlaps = overlappingMutationReceipts(signoutBoundary, receiptSnapshotBefore);
      readFence();
      if (hadPriorSessionMutation || finalActive.length > 0 || overlaps.length > 0 ||
          _fenceRevision !== signOutFenceRevision) {
        return cleanupPending(
          expiredMutationReceipts().length
            ? '仍有已超过诊断 TTL 但底层未结算的认证请求；TTL 不会删除它。请关闭所有标签并清除该站点认证数据后重新登录'
            : '旧登录请求与本次退出发生重叠；必须再次显式安全退出并复验 session=null');
      }

      var clearSnapshot = fenceSourceSnapshot();
      if (!clearFence(null, clearSnapshot)) {
        return cleanupPending('另一个标签页在清理期间改变了认证隔离；请刷新并再次核对');
      }

      /* 只在已经证明没有重叠 mutation 后回收 returned/rejected。active/unknown
         永不删除。清理本身之后还要重读 BKEY/outcome/fence。 */
      clearNonActiveReceipts(receiptSnapshotBefore);
      var currentBoundary = readAuthBoundary();
      var ownOutcome = readBoundaryOutcome(signoutBoundary.boundaryId);
      if (!sameAuthBoundary(currentBoundary, signoutBoundary) ||
          ownOutcome.state !== 'signed_out' || readFence().kind) {
        return cleanupPending('另一个标签页在退出最终提交期间建立了新边界；当前退出不能宣称 clean');
      }

      try {
        if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp();
      } catch (e0) {}
      setOperation('idle');
      setSessionTruth('signed_out', '', '');
      releaseAuthBoundaryToken(token);
      return { ok: true, serverRevoked: true, cleanupPending: false };
    }).catch(function (e) {
      releaseAuthBoundaryToken(token);
      _submitBusy = false;
      _submitToken = 0;
      if (isStaleError(e) || token !== _authGeneration) {
        setOperation('idle', errText(e));
        setSessionTruth('unknown', '', errText(e));
        throw e;
      }
      if (!readFence().kind)
        writeFence('outcome_unknown', '', '', '退出结果未确认：' + errText(e));
      setOperation('idle', errText(e));
      setSessionTruth('unknown', '', '退出结果未确认：' + errText(e));
      throw e;
    });
  }

  function commitSignedIn(inputIdentity, opIdentity, snap, token, ownedFence) {
    assertAuthToken(token);
    var authBoundary = _authBoundaries[String(token)];
    if (!authBoundary || authBoundary.kind !== 'session_mutation') {
      var noBoundary = new Error('本次认证没有可验证的共享提交边界');
      noBoundary.code = 'AUTH_BOUNDARY_MISSING';
      throw noBoundary;
    }
    var existingFence = readFence();
    if (existingFence.kind &&
        !(existingFence.kind === 'outcome_unknown' && ownedFence &&
          sameFence(existingFence, ownedFence) &&
          String(existingFence.expectedUid || '') === String((opIdentity && opIdentity.uid) || ''))) {
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
    var commitId = newFenceId('commit');
    assertAuthToken(token);
    if (existingFence.kind) {
      if (!clearFence(existingFence) || readFence().kind) {
        var concurrent = new Error('另一个标签页改变了认证隔离，拒绝提交登录结果');
        concurrent.code = 'AUTH_FENCED_SESSION';
        concurrent.observedUid = String((readFence() || {}).observedUid || '');
        throw concurrent;
      }
      assertAuthToken(token);
    }

    /* append-only：A 只写 A 的 outcome。B 若在此窗口取得 BKEY，
       A 的后续复验会失败，但 B 的 outcome 永远不会被 A 覆盖或 compare-delete。 */
    assertSharedBoundary(token);
    writeBoundaryOutcome(authBoundary, {
      state: 'signed_in',
      method: inputIdentity.method,
      phone: phone,
      username: username,
      uid: uid,
      signedAt: Date.now(),
      authCommitId: commitId
    });
    assertSharedBoundary(token);

    function failCommitBoundary(reason) {
      /* outcome 是每 boundary 独立键；失败路径只建立 fence，绝不修改任何
         其他 boundary 的结论。isSignedIn/sessionStatus 必须失败关闭。 */
      var before = readFence();
      var hadFence = !!before.kind;
      var fence = before;
      if (!fence.kind) {
        fence = writeFence('outcome_unknown', uid, '',
          reason || '登录提交边界发生变化');
      }
      setOperation('outcome_unknown', reason || '登录提交边界发生变化');
      setSessionTruth(fence.kind === 'mismatch' ? 'mismatch' : 'unknown',
                      fence.observedUid || '', reason || fence.reason || '登录提交边界发生变化');
      var err = new Error(reason || '登录提交期间账号边界发生变化');
      err.code = hadFence ? 'AUTH_FENCED_SESSION' : 'AUTH_COMMIT_REVALIDATION_FAILED';
      err.observedUid = String(fence.observedUid || '');
      throw err;
    }
    function markerAndFenceCurrent() {
      var fence = readFence(), outcome = readBoundaryOutcome(authBoundary.boundaryId);
      var currentBoundary = readAuthBoundary();
      return !fence.kind && sameAuthBoundary(currentBoundary, authBoundary) &&
        String(outcome.uid || '') === uid &&
        String(outcome.authCommitId || '') === commitId &&
        String(outcome.boundaryId || '') === String(authBoundary.boundaryId) &&
        String(outcome.state || '') === 'signed_in';
    }

    /* 先清本标签验证码事务，再跨一个 task 边界复验。即使清理回调触发了
       另一个标签页的 fence/boundary，A 也只留下自己的孤立 outcome，不能覆盖 B。 */
    _pendingMemory = null;
    try { sessionStorage.removeItem(PKEY); } catch (_) {}
    _outcomeRecovery = null;

    return delay(0).then(function () {
      assertAuthToken(token);
      if (!markerAndFenceCurrent())
        return failCommitBoundary('另一个标签页在登录提交期间改变了账号隔离');
      return ensureSession(uid);
    }).then(function (truth) {
      assertAuthToken(token);
      if (!truth || !truth.ok || String(truth.uid || '') !== uid || !markerAndFenceCurrent())
        return failCommitBoundary((truth && truth.reason) || '最终云端 session 复验失败');

      _probeId++;
      var epoch = ++_authEpoch;
      setOperation('idle');
      setSessionTruth('confirmed', uid, '');
      try {
        if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp();
      } catch (e0) {}

      /* 最终返回前再次主动读共享 boundary、marker 与 fence。
         UI 还会在展示成功前独立调用 isSignedIn() 复核。 */
      assertAuthToken(token);
      if (!markerAndFenceCurrent() || !isSignedIn())
        return failCommitBoundary('登录成功展示前认证边界再次发生变化');

      /* v1076 登录后只执行云存档只读检查。浏览器端不访问 sb_profile，
         不创建档案、不 count、不 set/update，也不会把未获服务端保证的编号锁入本机。 */
      var job = withTimeout(syncOnLogin(uid, epoch), 8000, '云存档检查超时')
        .catch(function (e1) {
          return { ok: false, action: 'deferred', reason: errText(e1) };
        }).then(function (sync) {
          if (epoch !== _authEpoch || !isSignedIn() ||
              String(readLocal().uid || '') !== uid)
            return { stale: true };
          return {
            cid: 0,
            pendingId: false,
            competitionIdUnavailable: true,
            sync: sync,
            uid: uid,
            epoch: epoch
          };
        }).catch(function (e2) {
          return {
            cid: 0,
            pendingId: false,
            competitionIdUnavailable: true,
            uid: uid,
            epoch: epoch,
            sync: { ok: false, action: 'deferred', reason: errText(e2) }
          };
        });

      return {
        ok: true,
        uid: uid,
        cid: 0,
        pendingId: false,
        competitionIdUnavailable: true,
        epoch: epoch,
        postLogin: job
      };
    });
  }

  /* v1076 安全边界：浏览器认证模块不访问 sb_profile。
     全局竞赛 ID 必须由服务端 UID 派生 + 原子事务实现；当前仅保留本机临时编号。 */

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
    if (_operation.state === 'signing_out')
      return Promise.resolve({ ok: false, stale: true, definite: false,
                               reason: 'sign-out-in-progress' });
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
      var boundary = readAuthBoundary();
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
      /* boundary 未结算时仍允许识别“当前 SDK UID 明确不是 wanted”；
         发现不同账号必须升级为 mismatch，不能被一般 pending 状态遮住。 */
      if (snap.session && !snap.anonymous &&
          (String(snap.uid) !== wanted ||
           (marker.uid && String(marker.uid) !== String(snap.uid)))) {
        writeFence('mismatch', wanted, snap.uid, 'marker/session UID mismatch');
        setSessionTruth('mismatch', snap.uid, 'marker/session UID mismatch');
        return { ok: false, mismatch: true, definite: true, uid: snap.uid,
                 reason: '本地账号与云端会话不是同一用户' };
      }
      if (boundary.boundaryId && !boundarySettled(boundary)) {
        setSessionTruth('unknown', '', '共享认证边界尚未完成');
        return { ok: false, fenced: true, definite: false, uid: snap.uid || '',
                 reason: '共享认证边界尚未完成' };
      }
      if (!snap.session || snap.anonymous) {
        setSessionTruth('signed_out', '', snap.anonymous ? 'anonymous-session' : 'no-session');
        return { ok: false, expired: true, definite: true, reason: '云端没有正式账号会话' };
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
    pushSave: pushSave,
    syncOnLogin: syncOnLogin,
    localHasProgress: localHasProgress,
    localProgressSize: localProgressSize,
    pullSave: pullSave,
    _setAuthForTest: function (a) { _authOverride = a; },
    _setSessionForTest: function (state, uid) { setSessionTruth(state, uid || '', 'test'); },
    _readFenceForTest: readFence,
    _readBoundaryForTest: readAuthBoundary,
    _activeReceiptsForTest: activeMutationReceipts,
    _app: app
  };
  if (!window.__HANSEN_AUTH_NO_BOOT__) {
    setTimeout(function () { refreshSessionTruth(); }, 0);
  }
})();
