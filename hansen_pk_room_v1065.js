/* hansen_pk_room_v1065.js —— 在线对战：房间、天梯匹配的数据层
 *
 * 🔴v1164 存储整个换了（天梯在真机上从来没成功过一次的根因）：
 *   云端集合权限是「读取全部数据，修改本人数据」——**谁建的文档只有谁能改**。
 *   旧协议让客人去改房主的房间文档（抢座、心跳、抢答、交卷），
 *   在真机上要么 updated:0、要么 PERMISSION_DENIED，**全部静默失败**；
 *   假传输层什么都让写，所以测试一直是绿的。
 *
 * 新规矩：**每个人只写自己建的文档。**
 *   房间 R  r…           房主建、房主写（status、心跳、确认客人、房主分）
 *   座位 S  R_s<轮次>     客人建、客人写（心跳、就绪、客人分、离开）
 *   回合 W  R_w<i>        谁先建算谁的（这一词谁先拼对 / 超时没人拿下）
 * 「抢」靠的是固定 _id 的 add：数据库保证 _id 唯一，几个人同时 add 只有一个成功。
 * add 失败的报错文本没人在真机上见过，所以失败后一律按 _id 读回来再下结论。
 *
 * 两条老规矩不变：
 *   ① 绝不自建云端实例 —— 一律 HansenAuth.ensureSession() + HansenAuth._app()
 *      （v1028 自建匿名实例、v1059 一个 ?v= 让 SDK 分裂成两份，都很难查）
 *   ② 传输层可注入 —— _setTransportForTest() 换成假实现即可本地跑竞态；
 *      但假实现必须照真数据库的能力做（_id 唯一、只能改自己的文档）。
 *
 * 词表：房主只存一个种子，双方用同一套确定性随机从 HANSEN_VOCAB_ALL 取词。
 */
(function () {
  'use strict';
  if (window.HansenPkRoom) return;
  var _dbOverride = null;   /* v1157: 测试用，替换云端 db */

  var COLLECTION   = 'hansen_pk_rooms';
  var PROTO        = 2;         /* v1164 新存储；没有它的是旧版本的房，协议不通 */
  var HEARTBEAT_MS = 8000;      /* 每 8 秒续一次命 */
  var STALE_MS     = 30000;     /* 房间 30 秒没心跳 → 不再展示 */
  var WORDS_PER_ROUND = 10;
  var ABANDON_MS   = 60000;     /* 对手 1 分钟没动静判离场（切后台、接电话都常见，不能更短） */

  /* 时间参数集中放（测试可以调短） */
  var TM = {
    ackMs: 15000,        /* 客人抢到座位后等房主确认多久 */
    ackPollMs: 1000,
    ackBeatMs: 3000,     /* 等确认时客人心跳更勤，房主才分得清座位是不是活的 */
    seatStaleMs: 20000,  /* 座位心跳 20 秒没变（按本机时钟看）→ 当死座位 */
    firstSightMs: 15000, /* 第一次看到座位时心跳在 15 秒内 → 直接确认；更旧的要先看到心跳在动（时钟差大的活人 3 秒内就会动） */
    doneGraceMs: 120000, /* 打完/离开后留 2 分钟再删，对方才读得到结果 */
    winTtlMs: 1200000,   /* 回合文档 20 分钟后清掉 */
    lagMs: 600,          /* 最终一致：读不到时隔多久再读 */
    lagTries: 5,
    waitPollMs: 2000     /* 房主等人时的轮询间隔（之后逐步拉长） */
  };

  var _transport = null;        /* 测试注入口 */
  var _hb = null, _hbRoom = ''; /* 心跳定时器 */
  /* 本机正在用的那间房：房主还是客人、座位号、是否已开打 —— 离开时按身份收尾 */
  var _myRoomId = '', _myRole = '', _mySeatId = '', _myStarted = false;
  var _joining = {};            /* roomId → 正在等房主确认 */
  var _rc = {};                 /* roomId → 只增不减的合并缓存 */
  var _seq = 0;
  var _dev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ══ 错误：一律「人话 ⟨原话⟩」，并给出 kind 让界面分流 ══════════════
     kind: network 断网 / slow 太慢 / session 会话还没好（稍后重试）/ expired 确定没登录
           config 云端设置不对（集合权限、没建集合）/ gone 房没了 / taken 被人占了
           self 自己账号的房 / other
     「技术信息」那行显示 ⟨⟩ 里的原话 —— 翻译可以友好，原话不能丢（v1163 教训）。 */
  var KINDS = { network: 1, slow: 1, session: 1, expired: 1, config: 1, gone: 1, taken: 1, self: 1, other: 1 };
  var HUMAN = {
    network: '连不上网络，检查一下 Wi-Fi 或数据再试',
    slow: '网络太慢，这次没连上，稍后再试',
    session: '云端还在准备中，等一两秒再点一次',
    expired: '云端登录过期了，重新登录一次就能继续',
    gone: '这个房间已经没有了，换一间吧',
    taken: '这间房刚被别人占了，换一间吧',
    self: '这是你自己账号开的房，要用另一个账号才能对战',
    other: '操作失败'
  };

  function kErr(kind, human, raw) {
    var e = new Error(raw || human);
    e.kind = kind; e.human = human;
    return e;
  }

  /* 原话：CloudBase 抛的常是普通对象，String() 会变成 [object Object]（v1059） */
  function rawText(e) {
    if (e == null) return '';
    if (typeof e === 'string') return e;
    var parts = [];
    ['code', 'error', 'error_description', 'errMsg', 'message', 'reason'].forEach(function (k) {
      var v = e[k];
      if (v != null && typeof v !== 'object') {
        var s = String(v);
        if (s && parts.indexOf(s) < 0) parts.push(s);
      }
    });
    if (e.requestId && e.cloud) parts.push('req ' + String(e.requestId).slice(0, 24));
    if (parts.length) return parts.join(' | ');
    try { var j = JSON.stringify(e); if (j && j !== '{}') return j; } catch (x) {}
    return '';
  }

  function codeKind(code) {
    /* 令牌被云端拒 = SDK 已经续不上了，只能重新登录 */
    if (/TOKEN|UNAUTH|CREDENTIAL|LOGIN/i.test(code)) return 'expired';
    return 'config';
  }
  function textKind(t) {
    if (!t) return 'other';
    if (/自己账号开的房/.test(t)) return 'self';
    if (/DATABASE_[A-Z_]+|PERMISSION_DENIED|COLLECTION_NOT_EXIST|INVALID_PARAM|云端设置还差一步/.test(t)) return 'config';
    if (/not-signed-in|unauthenticated|credentials not found|invalid_grant|refresh token|请先登录|还没登录|登录已过期|登录过期/i.test(t)) return 'expired';
    if (/尚未就绪|not ?ready|会话|session|云端还在准备/i.test(t)) return 'session';
    if (/网络太慢|timeout|timed out|内未完成|超时/i.test(t)) return 'slow';
    if (/network request error|failed to fetch|networkerror|network request failed|load failed|unreachable|net::|连不上网络/i.test(t)) return 'network';
    if (/被别人占了|抢走/.test(t)) return 'taken';
    if (/已经没有了|不存在|不在了|已经离开|已经结束/.test(t)) return 'gone';
    return 'other';
  }
  /* 给界面用：传错误对象、失败结果或 reason 字符串都行 */
  function kindOf(e) {
    if (e == null) return 'other';
    if (typeof e === 'object') {
      if (typeof e.kind === 'string' && KINDS[e.kind]) return e.kind;
      if (e.timeout) return 'slow';
      if (typeof e.code === 'string' && (e.cloud || /^[A-Z][A-Z0-9_.]{3,}$/.test(e.code))) return codeKind(e.code);
      if (e.ok === false && typeof e.reason === 'string') return textKind(e.reason);
    }
    return textKind(rawText(e));
  }
  function configHuman(e, t) {
    var code = String((e && typeof e.code === 'string' && e.code) || (/[A-Z][A-Z_]{6,}/.exec(t) || [])[0] || '');
    var col = '「' + COLLECTION + '」';
    if (/PERMISSION/.test(code + t))
      return '云端设置还差一步：数据库集合' + col + '的权限不允许这样读写，'
           + '请在云开发控制台把它设成「读取全部数据，修改本人数据」';
    if (/NOT_EXIST/.test(code + t) || /not exist/i.test(t))
      return '云端设置还差一步：还没有建数据库集合' + col + '，'
           + '请在云开发控制台新建它（权限选「读取全部数据，修改本人数据」）';
    return '云端设置还差一步：云端拒绝了这次操作（' + (code || '未知错误') + '），请把技术信息发给负责的老师';
  }
  function E(e) {
    if (e && typeof e === 'object' && e.ok === false && typeof e.reason === 'string') return e.reason;
    if (typeof e === 'string' && e.indexOf('⟨') >= 0) return e;
    var t = rawText(e);
    var k = kindOf(e);
    var human = (e && typeof e === 'object' && typeof e.human === 'string') ? e.human : '';
    if (!human) {
      if (k === 'config') human = configHuman(e, t);
      else if (k === 'other') human = t || HUMAN.other;
      else human = HUMAN[k];
    }
    /* 格式：`人话 ⟨原话⟩` —— 调用方按 ⟨⟩ 切开（不能换成 String 对象，有人做 typeof 判断） */
    if (t && t !== human) return human + ' ⟨' + t.slice(0, 160) + '⟩';
    return human;
  }
  function fail(e, extra) {
    var k = kindOf(e);
    var r = { ok: false, reason: E(e), kind: k, expired: k === 'expired' };
    if (e && typeof e === 'object' && typeof e.code === 'string' && e.code) r.code = e.code;
    if (k === 'taken') r.taken = true;
    if (k === 'gone') r.gone = true;
    if (k === 'self') r.self = true;
    if (extra) for (var x in extra) if (Object.prototype.hasOwnProperty.call(extra, x)) r[x] = extra[x];
    return r;
  }
  function failK(kind, human, raw, extra) { return fail(kErr(kind, human, raw), extra); }

  /* ── 确定性随机：同一个种子在任何设备上都给出同一串数（mulberry32）。
     **不要换成 Math.random()**，那样双方拿到的词就不一样了。 */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 从全岛词表里按种子取一组词。双方必然一致。 */
  function wordsFromSeed(seed, n) {
    var pool = [];
    try {
      var all = window.HANSEN_VOCAB_ALL || {};
      Object.keys(all).sort().forEach(function (k) {          /* sort 保证顺序稳定 */
        (all[k] || []).forEach(function (w) {
          if (w && w.en) pool.push({ en: w.en, cn: w.cn || '', pn: w.pn || '' });
        });
      });
    } catch (e) {}
    if (!pool.length) return [];
    var r = rng(seed), out = [], used = {};
    var want = Math.min(n || WORDS_PER_ROUND, pool.length);
    var guard = 0;
    while (out.length < want && guard++ < want * 50) {
      var i = Math.floor(r() * pool.length);
      if (used[i]) continue;
      used[i] = 1; out.push(pool[i]);
    }
    return out;
  }

  /* ══ 真实传输层：一律复用账号会话，绝不自建实例 ══════════════════════
     🔴v1164：SDK 遇到业务错误（权限不够、集合不存在、参数错）是 **resolve 一个 {code}**，
     不是 reject。以前没人查 r.code —— 权限被拒看起来像「成功」「空列表」「updated:0」。
     现在每个操作都查，查到就抛带 code 的错误，交给 E() 说清是哪个集合、哪里不对。 */
  function cloudErr(r, what) {
    var e = new Error(String(r.message || r.msg || r.code));
    e.code = String(r.code); e.cloud = true; e.what = what || '';
    e.requestId = r.requestId || '';
    return e;
  }
  function chk(what) {
    return function (r) { if (r && r.code) throw cloudErr(r, what); return r; };
  }
  function sessionErr(s) {
    var why = (s && s.reason) || '未知';
    var k = (s && (s.expired || s.reason === 'not-signed-in')) ? 'expired' : ((s && s.slow) ? 'slow' : 'session');
    var human = (k === 'expired' && s.reason === 'not-signed-in') ? '还没登录，先登录再来对战' : HUMAN[k];
    var e = kErr(k, human, '云端会话不可用：' + why);
    e.sessionDead = true; e.expired = (k === 'expired');
    return e;
  }

  function realTransport() {
    function db() {
      /* v1157: 测试要能验"云端缺索引时会不会降级"，留一个换 db 的口子 */
      if (_dbOverride) return Promise.resolve(_dbOverride);
      var A = window.HansenAuth;
      if (!A || typeof A.ensureSession !== 'function' || typeof A._app !== 'function')
        return Promise.reject(kErr('other', '账号模块没加载好，刷新一下页面再试', '账号模块未加载'));
      return A.ensureSession().then(function (s) {
        if (!s || !s.ok) throw sessionErr(s);
        if (s.uid) noteUid(String(s.uid));
        /* 🔴v1163：_app() 是异步的（内部 import SDK），必须 .then —— 当同步用会报
           `app.database is not a function`，而测试桩把这一段绕过去了，从没被测到。 */
        return A._app().then(function (app) {
          if (!app || typeof app.database !== 'function')
            throw kErr('other', '云端没准备好，刷新一下页面再试', '云端实例不可用');
          return app.database();
        });
      });
    }
    function C(d) { return d.collection(COLLECTION); }
    function sortNewest(rows) {
      /* v1157: 降级路径没有 orderBy，本地排一次（40 条毫无压力） */
      return (rows || []).slice().sort(function (a, b) {
        return (Number(b && b.createdAt) || 0) - (Number(a && a.createdAt) || 0);
      });
    }
    return {
      /* 固定 _id 的 add：重复 _id 会被数据库拒绝 —— 这就是「抢」的原子性来源 */
      add: function (doc) {
        return db().then(function (d) {
          return C(d).add(doc).then(chk('add')).then(function (r) {
            return { id: (r && (r.id || r._id)) || doc._id || '' };
          });
        });
      },
      read: function (id) {
        return db().then(function (d) {
          return C(d).doc(id).get().then(chk('read')).then(function (r) {
            var rows = r && r.data;
            if (Array.isArray(rows)) return rows[0] || null;
            return (rows && typeof rows === 'object' && rows._id) ? rows : null;
          });
        });
      },
      /* 只用来改自己的文档；updated:0 = 文档不在了（每次都带心跳时间戳，值一定会变） */
      patch: function (id, data) {
        return db().then(function (d) {
          return C(d).doc(id).update(data).then(chk('patch')).then(function (r) {
            var n = r && (r.updated != null ? r.updated : (r.stats && r.stats.updated));
            return { updated: (n == null) ? undefined : Number(n) };
          });
        });
      },
      remove: function (id) {
        return db().then(function (d) {
          return C(d).doc(id).remove().then(chk('remove')).then(function (r) {
            return { deleted: r && r.deleted };
          });
        });
      },
      /* 🔴v1163：默认传输层以前没有 list，而三处在调它 —— 桩比真货多一个方法，
         等于把真货的缺口盖住了。按等值条件查，返回原始行，调用方自己过滤。 */
      list: function (cond) {
        return db().then(function (d) {
          var q = C(d);
          if (cond && typeof cond === 'object') q = q.where(cond);
          return q.limit(50).get().then(chk('list')).then(function (r) {
            return (r && r.data) || [];
          });
        });
      },
      listOpen: function (nowTs) {
        return db().then(function (d) {
          /* 🔴v1154：查询只留每间房都有的字段（status + isPrivate），其余放本地判 ——
             字段缺失 ≠ 空字符串，where 里多一个条件就可能整批查不出来。 */
          function plain() {
            return C(d).where({ status: 'open', isPrivate: false }).limit(40).get();
          }
          /* 🔴v1157：orderBy 要建索引，没建就整个查询报错 —— 失败就降级成不排序的查询。
             报错可能是 reject，也可能是 resolve 一个 {code}，两种都要降级。 */
          return C(d)
            .where({ status: 'open', isPrivate: false })
            .orderBy('createdAt', 'desc').limit(40).get()
            .then(function (r) {
              if (r && r.code) throw cloudErr(r, 'listOpen');
              return r;
            })
            ['catch'](function (indexErr) {
              try {
                console.warn('[房间] orderBy 失败，降级为不排序查询（多半是云端没建 createdAt 索引）：'
                  + rawText(indexErr).slice(0, 120));
              } catch (e) {}
              return plain();
            })
            .then(chk('listOpen'))
            .then(function (r) { return sortNewest((r && r.data) || []); });
        });
      }
    };
  }

  /* ── 🔴v1115 统一超时 ── 弱信号下 TCP 连着但不返回，比断网更折磨人。
     对战相关的读写给 8 秒，其余 12 秒。会话门（ensureSession）也在这个时限里。 */
  var NET_TIMEOUT_MS = 12000;
  var NET_TIMEOUT_FAST_MS = 8000;

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        /* 文案里不许露内部方法名（v1115） */
        var e = new Error('网络太慢，这次没连上，检查一下网络再试');
        e.friendly = true; e.timeout = true;
        reject(e);
      }, ms || NET_TIMEOUT_MS);
      Promise.resolve(promise).then(function (v) {
        if (done) return; done = true; clearTimeout(t); resolve(v);
      }, function (err) {
        if (done) return; done = true; clearTimeout(t); reject(err);
      });
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* 只有「这次没走通」才值得再试；云端明确拒绝、没登录、等超时了都不重试 */
  function retryable(e) { return kindOf(e) === 'network'; }

  /* 给传输层的每个方法套上超时 + 断网重试 —— 包括测试注入的假实现 */
  function wrapTimeout(tx) {
    if (!tx || tx.__wrapped) return tx;
    var FAST = { read: 1, patch: 1 };
    var out = { __wrapped: true };
    Object.keys(tx).forEach(function (k) {
      var fn = tx[k];
      if (typeof fn !== 'function') { out[k] = fn; return; }
      out[k] = function () {
        var args = arguments;
        /* 🔴v1163：20% 丢包在真机上很常见，一次失败不等于操作失败。
           能重试的标准是**幂等**：读天然幂等；add 带固定 _id（重复会被拒，
           再由调用方读回判定）、patch 是 $set、remove 删两次也一样 ——
           v1164 起不再有「条件更新」这种重试会出事的写法。 */
        var READ_ONLY = { read: 1, list: 1, listOpen: 1, add: 1, patch: 1, remove: 1 };
        var once = function () {
          return withTimeout(fn.apply(tx, args), FAST[k] ? NET_TIMEOUT_FAST_MS : NET_TIMEOUT_MS);
        };
        if (!READ_ONLY[k]) return once();
        var again = function (ms) {
          return function (e) { if (!retryable(e)) throw e; return sleep(ms).then(once); };
        };
        return once()['catch'](again(300))['catch'](again(700));
      };
    });
    return out;
  }

  function T() {
    if (_transport) return _transport;
    _transport = wrapTimeout(realTransport());
    return _transport;
  }

  /* ══ 身份 ══════════════════════════════════════════════════════════
     🔴v1164：房间里的身份键 = 'u' + 云端 uid。
     以前用的是手机号/用户名 —— 写进所有人都能读的集合，等于把孩子的手机号公开了。
     名字从资料模块取（以前调了个不存在的 status()，所以人人都叫「无名蜂」）。 */
  var _meOverride = null;   /* v1100 测试注入：不必真登录就能验抢答 */
  var _me = null, _mePending = null;

  function profName() {
    var P = window.HansenSbProfile, nm = '';
    try {
      if (P && typeof P.displayName === 'function') nm = P.displayName() || '';
      if (!nm && P && typeof P.readProfile === 'function') nm = (P.readProfile() || {}).name || '';
      if (!nm && P && typeof P.status === 'function') nm = (P.status() || {}).name || '';
    } catch (e) {}
    return sText(nm, 16) || '无名蜂';
  }
  function noteUid(uid) {
    if (uid && (!_me || _me.uid !== uid)) _me = { id: 'u' + uid, uid: uid, name: profName() };
  }
  function meSync() {
    if (_meOverride) return _meOverride;
    if (_me) return _me;
    return { id: '', name: profName() };
  }
  function ident() {
    if (_meOverride) return Promise.resolve(_meOverride);
    var A = window.HansenAuth, lcUid = '';
    try { lcUid = String((A && A.readLocal && A.readLocal() || {}).uid || ''); } catch (e) {}
    if (_me && (!lcUid || lcUid === _me.uid)) { _me.name = profName(); return Promise.resolve(_me); }
    if (_mePending) return _mePending;
    if (!A || typeof A.ensureSession !== 'function')
      return Promise.reject(kErr('other', '账号模块没加载好，刷新一下页面再试', '账号模块未加载'));
    var p = withTimeout(Promise.resolve().then(function () { return A.ensureSession(); }), NET_TIMEOUT_MS)
      .then(function (s) {
        if (!s || !s.ok) throw sessionErr(s);
        var uid = String(s.uid || lcUid || '');
        if (!uid) throw kErr('session', HUMAN.session, '会话里还没有账号编号');
        _me = { id: 'u' + uid, uid: uid, name: profName() };
        return _me;
      });
    _mePending = p;
    var clear = function () { if (_mePending === p) _mePending = null; };
    p.then(clear, clear);
    return p;
  }
  try {
    var _forget = function () { _me = null; _mePending = null; };
    document.addEventListener('hsn-auth-changed', _forget);
    document.addEventListener('hsn-account-uid-changed', _forget);
  } catch (e) {}

  /* 我的天梯分：调用方没给就从战绩模块读（房主拿它算 ELO） */
  function myRating(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) {
      try { n = Number(window.HansenPkRecord && window.HansenPkRecord.summary().rating); } catch (e) { n = 0; }
    }
    return sNum(n, 0, 4000, 0);
  }

  /* ══ 小工具 ═════════════════════════════════════════════════════════ */
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function nonce() { return _dev + '.' + (++_seq); }
  function seatIdOf(rid, ep) { return rid + '_s' + (ep || 0); }
  function winIdOf(rid, i) { return rid + '_w' + i; }
  function capOf(R) {
    var n = Number(R && R.wordCount);
    if (!isFinite(n) || n < 1) n = WORDS_PER_ROUND;
    return Math.max(1, Math.min(30, Math.round(n)));
  }
  function scoreOf(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? Math.max(0, Math.min(100000, Math.round(n))) : null;
  }
  /* 房间文档：新房带 kind:'room'；对局中也认没有 kind 的（只要像个房间） */
  function isRoomDoc(d, id) {
    return !!(d && typeof d === 'object' && (!id || !d._id || d._id === id)
              && (d.kind === 'room' || (!d.kind && 'hostId' in d)));
  }
  function isSeatDoc(d, rid, ep) {
    return !!(d && d.kind === 'seat' && d.roomId === rid && num(d.epoch) === ep && d.guestId);
  }
  function isWinDoc(d, rid, i) {
    return !!(d && d.kind === 'win' && d.roomId === rid && num(d.i) === i);
  }
  function setMine(id, role, sid, started) {
    _myRoomId = id || ''; _myRole = role || ''; _mySeatId = sid || ''; _myStarted = !!started;
  }
  function mySeatId(rid, R) {
    if (_myRoomId === rid && _mySeatId) return _mySeatId;
    return seatIdOf(rid, num(R && R.seat));
  }

  /* ══ 合并视图：把 R + S + W 拼回界面熟悉的旧字段名 ═══════════════════
     🔴最终一致：某一次读可能拿到旧快照。合并必须**只进不退** ——
     状态 open→playing→done 不回退、已定的回合只增不减、见过的比分不丢。 */
  var RANK = { open: 0, playing: 1, done: 2 };
  var RANK_NAME = ['open', 'playing', 'done'];
  function rc(id) {
    return _rc[id] || (_rc[id] = { rank: 0, guestId: '', hs: null, gs: null, wins: [],
                                   seat: null, meta: null, calls: 0, opp: {}, missR: 0, missS: 0 });
  }
  function setWin(rid, i, d) {
    var c = rc(rid);
    if (c.wins[i] || !d) return;
    c.wins[i] = { winner: (d.winner === 'host' || d.winner === 'guest') ? d.winner : '',
                  at: num(d.at), by: String(d.by || '') };
  }
  function decided(rid) { var c = rc(rid), n = 0; while (c.wins[n]) n++; return n; }
  function winnersOf(rid) {
    var c = rc(rid), cap = capOf(c.meta), out = [];
    /* v1163：赢家名单最多 N 条、每项只认 host/guest —— 别人写的数据不可信 */
    for (var i = 0; i < cap && c.wins[i]; i++) out.push(c.wins[i].winner);
    return out;
  }

  function view(rid, R, S) {
    var c = rc(rid);
    if (R) c.meta = R; else R = c.meta || {};
    var rank = Math.max(c.rank, RANK[R.status] || 0, R.guestId ? 1 : 0);
    c.rank = rank;
    if (R.guestId && !c.guestId) c.guestId = String(R.guestId);
    var gid = c.guestId;
    var s = (S && S.kind === 'seat' && gid && S.guestId === gid) ? S : null;
    if (s) c.seat = s; else if (c.seat && c.seat.guestId === gid) s = c.seat;
    s = s || {};
    var hs = scoreOf(R.hostScore), gs = scoreOf(s.guestScore);
    if (hs == null && R.abandonWin === 'host') hs = 1;
    if (gs == null && s.abandonWin === 'guest') gs = 1;
    if (gs == null && R.abandonWin === 'host') gs = 0;
    if (hs == null && s.abandonWin === 'guest') hs = 0;
    if (hs != null) c.hs = hs;
    if (gs != null) c.gs = gs;
    var winners = winnersOf(rid);
    var n = winners.length, roundAt = 0;
    if (n === 0) roundAt = (R.hostReady && s.guestReady) ? Math.max(num(R.hostReadyAt), num(s.guestReadyAt)) : 0;
    else roundAt = c.wins[n - 1].at;
    return {
      _id: rid, id: rid, proto: num(R.proto), kind: 'room',
      status: RANK_NAME[rank], isPrivate: !!R.isPrivate, code: sText(R.code, 8),
      mode: modeOf(R.mode).key, askMode: (R.askMode === 'tts') ? 'tts' : 'cn',
      seed: R.seed, wordCount: capOf(R),
      hostId: String(R.hostId || ''), hostName: sText(R.hostName, 16) || '无名蜂',
      hostRating: sNum(R.hostRating, 0, 4000, 0), hostTier: sText(R.hostTier, 12),
      createdAt: num(R.createdAt), heartbeatAt: num(R.heartbeatAt), hostBeat: num(R.hostBeat),
      hostReady: !!R.hostReady, hostReadyAt: num(R.hostReadyAt), seat: num(R.seat),
      guestId: gid, guestName: sText(s.guestName || R.guestName, 16) || (gid ? '无名蜂' : ''),
      guestRating: sNum(s.guestRating || R.guestRating, 0, 4000, 0),
      guestBeat: num(s.guestBeat), guestReady: !!s.guestReady, guestReadyAt: num(s.guestReadyAt),
      guestLeft: !!s.left,
      hostScore: c.hs, guestScore: c.gs,
      startedAt: num(R.startedAt), endedAt: num(R.endedAt), endedBy: sText(R.endedBy, 12),
      abandonWin: R.abandonWin === 'host' ? 'host' : (s.abandonWin === 'guest' ? 'guest' : ''),
      winners: winners, round: n, roundAt: roundAt
    };
  }

  function readRoom(rid) {
    return T().read(rid).then(function (d) { return isRoomDoc(d, rid) ? d : null; });
  }
  /* 刚建好的房，紧接着读未必读得到（主从同步有延迟）—— 读不到就隔一会儿再读 */
  function readRoomLag(rid, tries) {
    tries = tries || 3;
    return readRoom(rid).then(function (R) {
      if (R || tries <= 1) return R;
      return sleep(TM.lagMs).then(function () { return readRoomLag(rid, tries - 1); });
    });
  }
  /* 房间 + 当前座位；房间读不到先用缓存，连续 3 次读不到才算没了 */
  function loadView(rid) {
    var c = rc(rid);
    var ERR = {};   /* 座位读失败（网络）和「座位不在」要分开：前者不能算对手走了 */
    var rdS = function (ep) { return T().read(seatIdOf(rid, ep))['catch'](function () { return ERR; }); };
    var ep0 = c.meta ? num(c.meta.seat) : -1;
    var pS = ep0 >= 0 ? rdS(ep0) : null;
    return readRoom(rid).then(function (R) {
      if (!R) {
        c.missR++;
        if (c.missR >= 3 || !c.meta) throw kErr('gone', HUMAN.gone, '房间已不存在');
      } else c.missR = 0;
      var RR = R || c.meta;
      var ep = num(RR.seat);
      return ((pS && ep === ep0) ? pS : rdS(ep)).then(function (S) {
        var seat = (S && S !== ERR && S.kind === 'seat' && S.roomId === rid) ? S : null;
        return { R: RR, S: seat, sErr: S === ERR, fresh: !!R, v: view(rid, R, seat) };
      });
    });
  }
  function metaOf(rid) {
    var c = rc(rid);
    if (c.meta) return Promise.resolve(c.meta);
    return readRoomLag(rid).then(function (R) {
      if (!R) throw kErr('gone', HUMAN.gone, '房间已不存在');
      c.meta = R;
      return R;
    });
  }
  /* 改自己的文档；updated:0 时读一下确认（真没了才算 gone） */
  function patchOwn(id, data) {
    return T().patch(id, data).then(function (r) {
      if (!r || r.updated !== 0) return r;
      return T().read(id).then(function (d) {
        if (!d) throw kErr('gone', HUMAN.gone, '文档不存在：' + id);
        return r;
      });
    });
  }
  function retry3(fn) {
    var n = 0;
    function go() {
      n++;
      return fn()['catch'](function (e) {
        var k = kindOf(e);
        if (n >= 3 || (k !== 'network' && k !== 'slow' && k !== 'session')) throw e;
        return sleep(800).then(go);
      });
    }
    return go();
  }

  /* ══ 原子抢占：固定 _id 的 add ════════════════════════════════════════
     几个人同时 add 同一个 _id，数据库只让一个成功。
     ⚠️ 不能只信 add 的结果：重复 _id 的报错文本没人见过、网络断在半路时
        也可能「其实写进去了」—— 所以失败后按 _id 读回来（隔一会儿多读几次，
        最终一致），看 nonce 是不是我这一次的：是 → 我的；不是 → 被别人抢了；
        读不到 → 真的写失败了，按原错误分类。 */
  function claim(doc) {
    var id = doc._id;
    function same(d) { return !!(d && d.kind === doc.kind && d.roomId === doc.roomId); }
    function readBack(tries) {
      return T().read(id).then(function (d) {
        if (same(d) || tries <= 1) return same(d) ? d : null;
        return sleep(TM.lagMs).then(function () { return readBack(tries - 1); });
      });
    }
    return T().add(doc).then(function (r) {
      /* 成功也读一次做保险（万一后端是覆盖写）；读不到就信 add */
      return readBack(1)['catch'](function () { return null; }).then(function (d) {
        if (d && d.nonce && doc.nonce && d.nonce !== doc.nonce) return { mine: false, doc: d, id: id };
        return { mine: true, doc: doc, id: (r && r.id) || id };
      });
    }, function (addErr) {
      var k = kindOf(addErr);
      if (k === 'expired' || k === 'session' || k === 'slow') throw addErr;
      return readBack(TM.lagTries)['catch'](function () { return null; }).then(function (d) {
        if (!d) throw addErr;
        return { mine: !!(d.nonce && d.nonce === doc.nonce), doc: d, id: id };
      });
    });
  }

  /* ── 🔴v1105 房间码：邀请朋友来打 ── 4 位码，微信发给朋友，输码直接进。
     私密房不出现在公开列表。字符集去掉 0/O、1/I/L（看错就进错房）。 */
  var CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  function makeCode() {
    var c = '';
    for (var i = 0; i < 4; i++) {
      c += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return c;
  }

  function fresh(x, t) {
    var beat = num(x.heartbeatAt) || num(x.createdAt);
    return (t - beat) < STALE_MS;
  }
  /* 能进的新版房：新协议、开着、没客人、房主还在 */
  function joinable(x, t) {
    return !!(x && x.proto === PROTO && x.kind === 'room' && x.status === 'open'
              && !x.guestId && fresh(x, t));
  }

  /* 按房间码找房 —— 朋友输码进房走这里 */
  function findByCode(code) {
    var c = String(code || '').trim().toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(c)) {
      return Promise.resolve(failK('other', '房间码是 4 位，检查一下'));
    }
    return ident().then(function (u) {
      return T().list({ code: c, status: 'open' }).then(function (rows) {
        var t = Date.now(), mine = false;
        var alive = (rows || []).filter(function (x) {
          if (!joinable(x, t)) return false;
          if (u.id && x.hostId === u.id) { mine = true; return false; }
          return true;
        });
        if (!alive.length) {
          return mine ? failK('self', HUMAN.self)
                      : failK('gone', '没找到这间房，可能已经关了或码输错了');
        }
        return { ok: true, room: listItem(alive[0]), roomId: String(alive[0]._id) };
      });
    })['catch'](function (e) { return fail(e); });
  }

  var _creating = null;   /* v1112: 开房中的 Promise，防连点开出僵尸房 */

  function createRoom(opts) {
    opts = opts || {};
    if (_creating) return _creating;
    /* 🔴v1163：词库没加载就别让人建房 —— 否则等来对手，两人一进对战就双双跳结算屏 */
    try {
      var _probe = wordsFromSeed(1, 3);
      if (!_probe || _probe.length < 1) {
        return Promise.resolve(failK('other', '词库还没加载好，刷新一下页面再开房'));
      }
    } catch (e) {
      return Promise.resolve(failK('other', '词库还没加载好，刷新一下页面再开房'));
    }
    _creating = ident().then(function (u) {
      /* 🔴v1135：开新房前先收掉自己手上那间（按身份：房主关房 / 客人退座） */
      if (_myRoomId) leaveMine();
      var now = Date.now();
      var seed = (now ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      /* 🔴v1163：客户端定好 _id —— add 重试写的一定是同一条，不会一次点击开出两间房 */
      var _newId = 'r' + now.toString(36) + Math.random().toString(36).slice(2, 8);
      var doc = {
        _id: _newId, proto: PROTO, kind: 'room', nonce: nonce(),
        status: 'open',
        code: '',      /* v1136: 私密房的码在下面查重后再写 */
        isPrivate: !!opts.private,
        mode: modeOf(opts.mode).key,
        askMode: (opts.askMode === 'tts') ? 'tts' : 'cn',   /* v1102: 看中文 / 听发音 */
        seed: seed,
        wordCount: capOf({ wordCount: opts.wordCount || WORDS_PER_ROUND }),
        hostId: u.id, hostName: u.name,
        /* v1114: 夹到 ELO 的合理区间 */
        hostRating: Math.max(0, Math.min(4000, Math.floor(Number(opts.hostRating) || 0))),
        hostTier: sText(opts.tier || '', 12),
        guestId: '', guestName: '', guestRating: 0,
        seat: 0,                         /* 座位轮次：死座位删不掉（不是我的文档），就换下一号 */
        createdAt: now, heartbeatAt: now, hostBeat: now,
        hostReady: false, hostReadyAt: 0, hostScore: null,
        startedAt: 0, endedAt: 0, endedBy: '', abandonWin: ''
      };
      /* 🔴v1136：房间码要查重 —— 撞了的后果是朋友输了码进的却是陌生人的房 */
      var _prep = opts.private
        ? (function pickCode(tries) {
            var c = makeCode();
            return T().list({ code: c, status: 'open' }).then(function (rows) {
              if (rows && rows.length && tries < 5) return pickCode(tries + 1);
              doc.code = c;
              return doc;
            })['catch'](function () { doc.code = c; return doc; });
          })(0)
        : Promise.resolve(doc);
      return _prep.then(function () { return claim(doc); }).then(function (r) {
        if (!r.mine) return failK('other', '房号撞车了，再点一次开房就好');
        /* 🔴v1163：拿不到有效房间号就不算建成（否则界面说"开好了"，其实没有房） */
        var _rid = r && r.id;
        if (typeof _rid === 'number' && isFinite(_rid)) _rid = String(_rid);
        if (typeof _rid !== 'string' || !_rid) {
          return failK('other', '云端没有返回房间号，房没开成 —— 再试一次吧');
        }
        doc._id = _rid;
        setMine(_rid, 'host', '', false);
        rc(_rid).meta = doc;
        startHeartbeat(_rid);
        return { ok: true, roomId: _rid, room: view(_rid, doc, null), mySide: 'host',
                 words: wordsFromSeed(seed, doc.wordCount) };
      });
    })['catch'](function (e) { return fail(e); });
    /* 无论成败都要解锁，否则一次失败就再也开不了房 */
    var _c = _creating;
    _c.then(function () { if (_creating === _c) _creating = null; },
            function () { if (_creating === _c) _creating = null; });
    return _c;
  }

  /* ── 🔴v1135 顺手清死房 ── 没有服务端定时任务，所以每个人顺手清**自己的**剩余文档：
     打完/离开超过宽限期的房间和座位、过期的回合文档。别人的本来也删不掉。
     每次最多删 10 条，不拖慢列房。 */
  function sweepMyDeadRooms() {
    /* v1163：这个函数是延迟跑的，那时传输层可能已经换了 —— 拿不到就安静跳过 */
    try {
      var _t = T();
      if (!_t || typeof _t.list !== 'function') return Promise.resolve(0);
    } catch (e) { return Promise.resolve(0); }
    var none = function () { return []; };
    return ident().then(function (u) {
      if (!u.id) return 0;
      var t = Date.now(), kill = [];
      return Promise.all([
        T().list({ hostId: u.id })['catch'](none),
        T().list({ guestId: u.id, kind: 'seat' })['catch'](none),
        T().list({ by: u.id, kind: 'win' })['catch'](none)
      ]).then(function (L) {
        (L[0] || []).forEach(function (r) {
          if (!r || !r._id || r._id === _myRoomId || (r.kind && r.kind !== 'room')) return;
          var beat = num(r.heartbeatAt) || num(r.createdAt);
          var done = r.status === 'done' && (t - (num(r.endedAt) || beat)) > TM.doneGraceMs;
          if (done || (t - beat) > STALE_MS * 4) kill.push(r._id);   /* 2 分钟以上没心跳 */
        });
        (L[1] || []).forEach(function (s) {
          if (!s || !s._id || s._id === _mySeatId || s.guestId !== u.id) return;
          var beat = num(s.guestBeat) || num(s.createdAt);
          if ((t - beat) > Math.max(TM.doneGraceMs, STALE_MS * 4)) kill.push(s._id);
        });
        (L[2] || []).forEach(function (w) {
          if (w && w._id && w.by === u.id && (t - num(w.at)) > TM.winTtlMs) kill.push(w._id);
        });
        kill = kill.slice(0, 10);
        if (!kill.length) return 0;
        return Promise.all(kill.map(function (id) {
          return T().remove(id)['catch'](function () {});
        })).then(function () { return kill.length; });
      });
    })['catch'](function () { return 0; });
  }

  /* ── 列房：清洗工具（房间数据来自别的手机，字段可能是任何类型 —— v1163） ── */
  function sText(v, max) {
    if (typeof v !== 'string') {
      if (typeof v === 'number' && isFinite(v)) v = String(v);
      else return '';
    }
    v = v.replace(/[\u0000-\u001f]/g, '');      /* 控制字符去掉 */
    return v.length > max ? v.slice(0, max) : v;
  }
  function sNum(v, lo, hi, dflt) {
    var n = Number(v);
    if (!isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }
  function sAge(ts) {
    var t = Number(ts);
    var now = Date.now();
    /* 不是数字、在未来、或者早于 2020 年 —— 都当"刚刚" */
    if (!isFinite(t) || t > now + 60000 || t < 1577808000000) return 0;
    return Math.max(0, Math.round((now - t) / 1000));
  }

  /* 列出别人开着的公开房（新版协议、没满、房主还在）。
     另外数一下「同账号在别的设备开着的房」—— 一个账号两台设备永远匹配不上，界面要提醒。 */
  function listRooms() {
    return ident().then(function (u) {
      /* 列房时顺手清掉自己留下的死房（不阻塞列表返回） */
      try { setTimeout(function () { sweepMyDeadRooms(); }, 1500); } catch (e) {}
      return T().listOpen(Date.now()).then(function (rows) {
        var _now = Date.now(), same = 0;
        rows = (rows || []).filter(function (x) {
          if (!x || x.proto !== PROTO || x.kind !== 'room') return false;   /* 旧版本的房：协议不通 */
          if (x.status !== 'open' || x.isPrivate === true) return false;
          if (x.guestId) return false;                 /* 满员的点进去必然失败 */
          /* 🔴v1154：心跳过滤放本地；没有 heartbeatAt 时退回 createdAt */
          var beat = x.heartbeatAt || x.createdAt || 0;
          if ((_now - beat) >= STALE_MS) return false;
          if (u.id && x.hostId === u.id) {             /* 自己的房点进去毫无意义 */
            if (x._id !== _myRoomId) same++;
            return false;
          }
          return true;
        });
        return { ok: true, sameAccount: same, rooms: (rows || []).map(listItem) };
      });
    })['catch'](function (e) { return fail(e, { rooms: [], sameAccount: 0 }); });
  }
  /* 🔴v1163：显示给人看的每个字段都过清洗（对象也是真值，会印出 [object Object]） */
  function listItem(x) {
    return {
      id: sText(x._id || x.id, 40),
      hostName: sText(x.hostName, 16) || '无名蜂',
      hostTier: sText(x.hostTier, 12),
      wordCount: sNum(x.wordCount, 1, 50, WORDS_PER_ROUND),
      mine: false,
      ageSec: sAge(x.createdAt),
      /* 🔴v1154：天梯靠 _id / mode / hostRating 挑房，漏了它们天梯就永远匹配不到 */
      _id: sText(x._id || x.id, 40),
      mode: (x.mode === 'A' || x.mode === 'B' || x.mode === 'C') ? x.mode : 'C',
      hostRating: sNum(x.hostRating, 0, 4000, 0),
      askMode: (x.askMode === 'tts') ? 'tts' : 'cn',
      createdAt: sNum(x.createdAt, 0, 9e15, 0),    /* 天梯按它「先开的先配」 */
      isPrivate: !!x.isPrivate
    };
  }

  /* ── 进房：抢座位 + 等房主确认 ────────────────────────────────────────
     客人不能写房主的文档，所以「进房」分两步：
       ① add 一个固定 _id 的座位文档 R_s<轮次> —— 只有一个人抢得到
       ② 等房主读到座位、在自己的房间文档里写上「客人是谁」（确认）
     房主确认了才算进房；房没了 / 换了别人 / 轮次变了 → 收回座位、说清原因。 */
  function joinRoom(roomId, opts) {
    opts = opts || {};
    if (!roomId) return Promise.resolve(failK('other', '房间号为空'));
    return ident().then(function (u) {
      return readRoomLag(roomId).then(function (R) {
        if (!R) return failK('gone', HUMAN.gone, '房间已不存在');
        if (R.proto !== PROTO || R.kind !== 'room') return failK('gone', '这间房是旧版本开的，换一间吧');
        if (u.id && R.hostId === u.id) return failK('self', HUMAN.self);
        if (R.status === 'done') return failK('gone', '这一局已经结束了，换一间吧');
        if (R.guestId || R.status !== 'open') return failK('taken', HUMAN.taken);
        /* 🔴v1135：房主已经跑了就别让人进（进去只能对着空房干等） */
        if ((Date.now() - (R.heartbeatAt || 0)) > STALE_MS) {
          return failK('gone', '房主已经离开了，换一间吧');
        }
        /* 🔴v1163：房间里的词数夹在 1~30；取不到词就先别占座 */
        var _ws = wordsFromSeed(R.seed, capOf(R));
        if (!_ws || !_ws.length) return failK('other', '词库还没加载好，刷新一下页面再进房');
        var ep = num(R.seat), t = Date.now();
        var seat = {
          _id: seatIdOf(roomId, ep), proto: PROTO, kind: 'seat', nonce: nonce(),
          roomId: roomId, epoch: ep,
          guestId: u.id, guestName: u.name, guestRating: myRating(opts.rating),
          createdAt: t, guestBeat: t,
          guestReady: false, guestReadyAt: 0, guestScore: null, left: false, abandonWin: ''
        };
        return claim(seat).then(function (c) {
          if (!c.mine) return failK('taken', HUMAN.taken);
          /* 🔴v1136：进别人的房之前，先收掉自己开着的那间（否则别人进去房主不在） */
          if (_myRoomId && _myRoomId !== roomId) leaveMine();
          setMine(roomId, 'guest', seat._id, false);
          rc(roomId).meta = R;
          /* v1104：客人也发心跳（写自己的座位），房主才知道客人还在 */
          startHeartbeat(roomId);
          return waitAck(roomId, u, ep, seat).then(function (res) {
            if (!res.ok) return res;
            if (_myRoomId === roomId) _myStarted = true;
            return { ok: true, roomId: roomId, room: view(roomId, res.R, seat),
                     words: _ws, mySide: 'guest' };
          });
        });
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 心跳：各写各的文档 ──
     房主 → 房间 {heartbeatAt, hostBeat}；客人 → 座位 {guestBeat}。
     🔴v1163：文档连续 3 次不在了就自己停（否则每 8 秒白写一次，烧配额）；网络报错不计数。 */
  function startHeartbeat(roomId) {
    stopHeartbeat();
    var hbMiss = 0;
    _hbRoom = roomId;
    _hb = setInterval(function () {
      if (_myRoomId !== roomId || !_myRole) { stopHeartbeat(); return; }
      var t = Date.now();
      var guest = (_myRole === 'guest');
      var id = guest ? _mySeatId : roomId;
      var patch = guest ? { guestBeat: t } : { heartbeatAt: t, hostBeat: t };
      T().patch(id, patch).then(function (r) {
        if (r && r.updated === 0) { hbMiss++; if (hbMiss >= 3) stopHeartbeat(); return; }
        hbMiss = 0;
      })['catch'](function () {});
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() { if (_hb) { clearInterval(_hb); _hb = null; } _hbRoom = ''; }

  /* 客人等房主确认（读房主的房间文档，看「客人」那一栏是不是我） */
  function waitAck(rid, u, ep, seat) {
    var t0 = Date.now(), lastBeat = t0, miss = 0, lastErr = null;
    _joining[rid] = 1;
    function giveUp(res, removed) {
      delete _joining[rid];
      if (_myRoomId === rid && _myRole === 'guest') { stopHeartbeat(); setMine('', '', '', false); }
      /* 🔴L14：失败后一定收回座位，不留孤儿文档（退出时 leaveMine 已经删过就不再删） */
      if (!removed) T().remove(seat._id)['catch'](function () {});
      return res;
    }
    function cancelled() { return giveUp(failK('other', '已经退出这间房了', '', { cancelled: true }), true); }
    function tick() {
      if (_joining[rid] === 'cancel') return Promise.resolve(cancelled());
      return readRoom(rid).then(function (R) {
        lastErr = null;
        if (!R) { miss++; return miss >= 3 ? giveUp(failK('gone', '房主已经离开了，换一间吧')) : null; }
        miss = 0;
        rc(rid).meta = R;
        if (R.guestId === u.id && num(R.seat) === ep) { delete _joining[rid]; return { ok: true, R: R }; }
        if (R.status === 'done') return giveUp(failK('gone', '这一局已经结束了，换一间吧'));
        if ((R.guestId && R.guestId !== u.id) || num(R.seat) > ep) return giveUp(failK('taken', HUMAN.taken));
        return null;
      }, function (e) { lastErr = e; return null; }).then(function (res) {
        if (_joining[rid] === 'cancel') return cancelled();
        if (res) return res;
        var t = Date.now();
        if (t - t0 > TM.ackMs) {
          return giveUp(lastErr ? fail(lastErr) : failK('other', '房主没有回应，换一间吧'));
        }
        if (t - lastBeat >= TM.ackBeatMs) {
          lastBeat = t;
          T().patch(seat._id, { guestBeat: t })['catch'](function () {});
        }
        return sleep(TM.ackPollMs).then(tick);
      });
    }
    return tick();
  }

  /* ══ 离开 ══════════════════════════════════════════════════════════
     只动自己的文档：
       房主 · 还没人进  → 删房
       房主 · 已开打    → 房间标 done（留着，客人还要读结果；过了宽限期由清理删）
       客人 · 还没确认  → 删自己的座位
       客人 · 已开打    → 座位标 left（同样留着给房主读） */
  function leaveMine() {
    var id = _myRoomId, role = _myRole, sid = _mySeatId, started = _myStarted;
    if (!id) return Promise.resolve({ ok: true });
    if (_hbRoom === id) stopHeartbeat();
    setMine('', '', '', false);
    if (_joining[id]) _joining[id] = 'cancel';
    var t = Date.now(), c = rc(id), p;
    if (role === 'host') {
      if (!started) p = T().remove(id);
      else if (c.rank >= 2) p = T().patch(id, { endedAt: t, heartbeatAt: t });
      else p = T().patch(id, { status: 'done', endedAt: t, heartbeatAt: t,
                               endedBy: (c.hs != null) ? 'finished' : 'leave' });
    } else {
      p = started ? T().patch(sid, { left: true, leftAt: t, guestBeat: t }) : T().remove(sid);
    }
    return p.then(function () { return { ok: true }; }, function (e) { return fail(e); });
  }

  function leaveRoom(roomId) {
    var id = roomId || _myRoomId;
    if (!id) return Promise.resolve({ ok: true });
    if (id === _myRoomId && _myRole) return leaveMine();
    if (_joining[id]) _joining[id] = 'cancel';
    /* 不是本机记着的那间：读一下，按身份只收自己的文档 */
    return ident().then(function (u) {
      return readRoom(id).then(function (R) {
        if (!R) return { ok: true };
        var t = Date.now();
        if (R.hostId === u.id) {
          if (!R.guestId && R.status === 'open') return T().remove(id);
          if (R.status === 'done') return null;
          return T().patch(id, { status: 'done', endedAt: t, heartbeatAt: t,
                                 endedBy: (R.hostScore != null) ? 'finished' : 'leave' });
        }
        var sid = seatIdOf(id, num(R.seat));
        return T().read(sid).then(function (S) {
          if (!S || S.kind !== 'seat' || S.guestId !== u.id) return null;
          if (R.guestId === u.id) return T().patch(sid, { left: true, leftAt: t, guestBeat: t });
          return T().remove(sid);
        });
      });
    }).then(function () { return { ok: true }; }, function (e) { return fail(e); });
  }

  /* 🔴v1163：关页面时当场收尾（pagehide 比 beforeunload 可靠：iOS 上后者常不触发）。
     🔴v1164：按身份收尾 —— 客人刷新页面时以前会去删**房主的房**。 */
  function _byeOnUnload() {
    try { if (_myRoomId) leaveMine(); } catch (e) {}
  }
  try {
    window.addEventListener('pagehide', _byeOnUnload);
    window.addEventListener('beforeunload', _byeOnUnload);
  } catch (e) {}

  /* ── 房主等人（TCB 的 watch 在部分环境不稳，用轮询） ─────────────────
     每一轮：读自己的房间 + 当前轮次的座位。
       座位在、人还在 → 在房间里写上客人（确认）→ {joined}
       座位标了离开 / 心跳 20 秒不动 → 轮次 +1（别人的座位删不掉，就换一个号）
     天梯（opts.ladder）：每 3 轮扫一次列表，发现**更早开的**合适的房 → {switchTo}，
       由界面退出自己的房去进那间。两个人同时开房时，按「先开的赢」收敛到同一间。
     🔴v1137：轮询间隔递增（省读次数）；网络抖一下不放弃，连续失败 3 次才报错。 */
  function waitForOpponent(roomId, onChange, timeoutMs, opts) {
    opts = opts || {};
    var missCount = 0;   /* v1163: 连续读不到房间的次数（最终一致：读不到 ≠ 不存在） */
    var stop = false, t0 = Date.now();
    var limit = timeoutMs || 120000;
    var fails = 0, ticks = 0, epoch = -1, seen = null;
    var lad = opts.ladder || null;

    function nextDelay() {
      var waited = Date.now() - t0, b = TM.waitPollMs;
      return waited < 10000 ? b : (waited < 40000 ? Math.round(b * 1.5) : Math.round(b * 2.5));
    }
    function emit(ev) {
      if (stop) return;
      stop = true;
      try { onChange(ev); } catch (e) {}
    }
    /* 🔴v1163：递归式轮询 —— 每条提前 return 之前都要先把下一棒交出去 */
    function again(ms) { if (!stop) setTimeout(tick, ms == null ? nextDelay() : ms); }

    function judgeSeat(S) {
      var t = Date.now(), beat = num(S.guestBeat), key = S._id + '|' + (S.nonce || '');
      if (S.left) return 'stale';
      if (!seen || seen.key !== key) {
        seen = { key: key, beat: beat, at: t };
        return (Math.abs(t - beat) < TM.firstSightMs) ? 'ack' : 'wait';
      }
      if (beat !== seen.beat) return 'ack';                 /* 心跳在动 = 人还在 */
      return (t - seen.at > TM.seatStaleMs) ? 'stale' : 'wait';   /* 按本机时钟看，不怕两台手机时间不一样 */
    }
    function joined(R, S) {
      setMine(roomId, 'host', '', true);
      emit({ joined: true, room: view(roomId, R, S) });
    }
    function ack(R, S) {
      var t = Date.now();
      var p = { status: 'playing', guestId: String(S.guestId), guestName: sText(S.guestName, 16),
                guestRating: sNum(S.guestRating, 0, 4000, 0), seat: epoch,
                startedAt: t, heartbeatAt: t, hostBeat: t };
      return T().patch(roomId, p).then(function (r) {
        if (stop) return;
        if (r && r.updated === 0) { again(); return; }
        var R2 = {}; for (var k in R) R2[k] = R[k]; for (var k2 in p) R2[k2] = p[k2];
        joined(R2, S);
      });
    }
    function bump() {
      var nx = epoch + 1, t = Date.now();
      return T().patch(roomId, { seat: nx, heartbeatAt: t, hostBeat: t }).then(function () {
        epoch = nx; seen = null; again();
      });
    }
    function older(a, b) {
      var ca = num(a.createdAt), cb = num(b.createdAt);
      return ca < cb || (ca === cb && String(a._id) < String(b._id));
    }
    function rescan(u, R) {
      return T().listOpen(Date.now()).then(function (rows) {
        if (stop) return;
        var t = Date.now(), waited = Math.round((t - t0) / 1000), band = Infinity;
        try { if (typeof lad.band === 'function') band = Number(lad.band(waited)); } catch (e) {}
        if (isNaN(band)) band = Infinity;
        var rating = Number(lad.rating) || 0, best = null;
        (rows || []).forEach(function (x) {
          if (!joinable(x, t) || x.isPrivate || x.mode !== 'A') return;
          if (x._id === roomId || (u.id && x.hostId === u.id)) return;
          if (Math.abs(sNum(x.hostRating, 0, 4000, 0) - rating) > band) return;
          if (!older(x, R)) return;
          if (!best || older(x, best)) best = x;
        });
        if (best) { emit({ switchTo: String(best._id), room: listItem(best) }); return; }
        again();
      }, function () { again(); });
    }

    function tick() {
      if (stop) return;
      ticks++;
      ident().then(function (u) {
        return readRoom(roomId).then(function (R) {
          if (stop) return;
          fails = 0;
          if (!R) {
            missCount++;
            if (missCount >= 3) { emit({ gone: true }); return; }
            again(); return;
          }
          missCount = 0;
          rc(roomId).meta = R;
          if (R.status === 'done') { emit({ gone: true }); return; }
          epoch = Math.max(epoch, num(R.seat));
          return T().read(seatIdOf(roomId, epoch)).then(function (S) {
            if (stop) return;
            var ok = isSeatDoc(S, roomId, epoch);
            /* 确认已经写进去了（上一轮回包丢了）→ 直接算进来了；guestId 只有我自己会写 */
            if (R.guestId) { joined(R, (ok && S.guestId === R.guestId) ? S : null); return; }
            if (ok && S.guestId !== u.id) {
              var d = judgeSeat(S);
              if (d === 'ack') return ack(R, S);
              if (d === 'stale') return bump();
              again(); return;
            }
            if (ok) return bump();   /* 同账号别的设备占的座：不能自己打自己 */
            if (Date.now() - t0 > limit) {
              /* 等不到人就收房 —— 否则留下一间「看得见、进去没人」的幽灵房 */
              emit({ timeout: true });
              leaveRoom(roomId);
              return;
            }
            if (lad && ticks % 3 === 0) return rescan(u, R);
            again();
          });
        });
      })['catch'](function (e) {
        if (stop) return;
        fails++;
        var k = kindOf(e);
        if (fails >= 3 || k === 'config' || k === 'expired') {
          emit({ error: E(e), kind: k, expired: k === 'expired' });
          return;
        }
        setTimeout(tick, 2500);   /* 抖一下就重试，别把人踢出等待 */
      });
    }
    tick();
    return function cancel() { stop = true; };
  }

  /* ── 🔴v1104 对手离场判定 ─────────────────────────────────────────────
     🔴v1164：**不拿对方手机的时间和本机比**（两台手机差几分钟很常见）。
     记住对手心跳的「值」和本机看到它变化的时刻：本机时钟上超过 1 分钟没变 → 离场。
     对手已交卷 = 正常打完，不算逃跑；对手明确离开（座位 left / 房主中途退出）→ 立刻算。 */
  function opponentGone(roomId) {
    return ident().then(function (u) {
      return loadView(roomId).then(function (L) {
        var v = L.v, host = (v.hostId === u.id), c = rc(roomId), t = Date.now();
        var lim = Math.round(ABANDON_MS / 1000);
        /* v1163：「对手离场」的前提是对手曾经在过 —— 还没人进来就谈不上 */
        if (host && !v.guestId) return { ok: true, gone: false, waitingForGuest: true };
        if (host ? v.guestScore != null : v.hostScore != null)
          return { ok: true, gone: false, oppFinished: true, idleSecs: 0, limitSecs: lim };
        if (!host && v.endedBy === 'abandon')
          return { ok: true, gone: false, ended: true, endedBy: 'abandon', abandonWin: v.abandonWin, idleSecs: 0, limitSecs: lim };
        if (host) {
          if (L.S && L.S.guestId === v.guestId) c.missS = 0; else if (!L.sErr) c.missS++;
          if (v.guestLeft || c.missS >= 3) return { ok: true, gone: true, left: true, idleSecs: 0, limitSecs: lim };
        } else if (v.status === 'done' && v.endedBy === 'leave') {
          return { ok: true, gone: true, left: true, idleSecs: 0, limitSecs: lim };
        }
        var side = host ? 'g' : 'h', beat = host ? v.guestBeat : v.hostBeat;
        var o = c.opp[side];
        if (!o || o.val !== beat) o = c.opp[side] = { val: beat, at: t };
        var idle = t - o.at;
        return { ok: true, gone: idle > ABANDON_MS, idleSecs: Math.round(idle / 1000), limitSecs: lim };
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* 对手离场 → 本局记为我方胜（只写自己的文档；对方得 0 分由合并视图推出来） */
  function claimAbandonWin(roomId) {
    return ident().then(function (u) {
      return loadView(roomId).then(function (L) {
        var t = Date.now(), c = rc(roomId);
        if (L.v.hostId === u.id) {
          c.hs = 1; c.gs = (c.gs == null) ? 0 : c.gs; c.rank = 2;
          return patchOwn(roomId, { status: 'done', endedBy: 'abandon', abandonWin: 'host',
                                    hostScore: 1, endedAt: t, heartbeatAt: t, hostBeat: t });
        }
        c.gs = 1; c.hs = (c.hs == null) ? 0 : c.hs;
        return patchOwn(mySeatId(roomId, L.R), { abandonWin: 'guest', guestScore: 1, guestBeat: t });
      }).then(function () { return { ok: true, result: 'win', byAbandon: true }; });
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 🔴v1100 三种对战模式 ── 规则定义放这里做单一真源，界面也从这里读说明。
     A 抢答赛（天梯专用）：谁先拼对谁得分，慢的 0 分，有人对就进下一词
     B 回合赛：各 15 秒，都答完才翻篇，先对 100 后对 80
     C 同步赛（推荐给孩子）：先对 100 后对 60，弱的一方输的是差距不是全部 */
  var MODES = {
    A: {
      key: 'A', name: '抢答赛', emoji: '⚡',
      tagline: '谁先拼对谁得分',
      rules: [
        '同一个词，两个人同时拼',
        '**先拼对的拿 100 分，慢的一方 0 分**',
        '有人拼对就立刻进下一个词，不等',
        '⭐ 只有这个模式计入天梯排位'
      ],
      firstScore: 100, secondScore: 0,
      waitAll: false,          /* 有人答对就推进，不等另一个 */
      perWordSecs: 20,
      ranked: true
    },
    B: {
      key: 'B', name: '回合赛', emoji: '🎯',
      tagline: '各拼各的，都答完再翻篇',
      rules: [
        '同一个词，两个人各有 15 秒',
        '**两个人都答完（或超时）才进下一个词**',
        '拼对的都得分：先拼对 100 分，后拼对 80 分',
        '节奏最稳，适合水平差得多的两个人'
      ],
      firstScore: 100, secondScore: 80,
      waitAll: true,           /* 必须两人都结束才推进 */
      perWordSecs: 15,
      ranked: false
    },
    C: {
      key: 'C', name: '同步赛', emoji: '🔥',
      tagline: '抢先有加成，拼对就有分',
      rules: [
        '同一个词，两个人同时拼',
        '**先拼对 100 分，后拼对 60 分，没拼对 0 分**',
        '两人都答完、或 15 秒到，就进下一个词',
        '既有抢先的紧张感，拼对又始终有价值'
      ],
      firstScore: 100, secondScore: 60,
      waitAll: true,
      perWordSecs: 15,
      ranked: false
    }
  };
  var DEFAULT_MODE = 'C';

  function modeOf(k) { return MODES[String(k || '').toUpperCase()] || MODES[DEFAULT_MODE]; }

  /* ── 🔴v1100 回合判定：「谁先拼对」必须原子 ──
     🔴v1164：以前是在房间文档上做条件更新 —— 客人写不了房主的文档，客人永远「慢一步」。
     现在每一词一个固定 _id 的回合文档 R_w<i>，谁先 add 成功谁拿下这一词。 */
  function claimRound(roomId, roundIdx) {
    var i = Math.floor(Number(roundIdx));
    return ident().then(function (u) {
      return metaOf(roomId).then(function (R) {
        var M = modeOf(R.mode), side = (R.hostId === u.id) ? 'host' : 'guest';
        if (!(i >= 0 && i < capOf(R))) return failK('other', '这一局的词已经打完了', 'round ' + roundIdx);
        var res = function (won, winner) {
          /* 🔴v1100：慢了不等于没分 —— A 慢的 0 分，B/C 慢的照样拿 secondScore */
          return { ok: true, won: won, first: won, score: won ? M.firstScore : M.secondScore,
                   winner: winner, round: decided(roomId), winners: winnersOf(roomId), mode: M.key };
        };
        var known = rc(roomId).wins[i];
        if (known) return res(known.winner === side && known.by === u.id, known.winner);
        var w = { _id: winIdOf(roomId, i), proto: PROTO, kind: 'win', nonce: nonce(),
                  roomId: roomId, i: i, winner: side, by: u.id, at: Date.now() };
        return claim(w).then(function (r) {
          setWin(roomId, i, r.doc);
          return res(r.mine, rc(roomId).wins[i].winner);
        });
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 🔴v1124 超时推进 ── 两人都没拼对也是一个回合的结束：写一个 winner:'' 的回合文档。
     同样靠 _id 唯一保证两边同时超时也只推进一次。 */
  function skipRound(roomId, roundIdx) {
    var i = Math.floor(Number(roundIdx));
    return ident().then(function (u) {
      return metaOf(roomId).then(function (R) {
        var done = function (sk) { return { ok: true, skipped: sk, round: decided(roomId), winners: winnersOf(roomId) }; };
        if (!(i >= 0 && i < capOf(R)) || rc(roomId).wins[i]) return done(false);
        var w = { _id: winIdOf(roomId, i), proto: PROTO, kind: 'win', nonce: nonce(),
                  roomId: roomId, i: i, winner: '', by: u.id, at: Date.now() };
        return claim(w).then(function (r) { setWin(roomId, i, r.doc); return done(r.mine); });
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* 已定回合：从缓存的数目往后探（每次最多 3 个）；偶尔整批查一次补漏 */
  function probeWins(rid, max) {
    var k = decided(rid), cap = capOf(rc(rid).meta);
    function step(n) {
      if (n >= max || k >= cap) return null;
      return T().read(winIdOf(rid, k)).then(function (d) {
        if (!isWinDoc(d, rid, k)) return null;
        setWin(rid, k, d); k++;
        return step(n + 1);
      });
    }
    return Promise.resolve().then(function () { return step(0); })['catch'](function () {});
  }
  function backfill(rid) {
    return T().list({ roomId: rid, kind: 'win' }).then(function (rows) {
      (rows || []).forEach(function (d) {
        var i = num(d && d.i);
        if (i >= 0 && i < 30 && isWinDoc(d, rid, i)) setWin(rid, i, d);
      });
    })['catch'](function () {});
  }

  /* 轮询本回合状态：第几词、谁拿下了、对手是谁 */
  function roundState(roomId) {
    return ident().then(function (u) {
      var c = rc(roomId); c.calls++;
      return Promise.all([loadView(roomId), probeWins(roomId, 3),
                          (c.calls % 6 === 0) ? backfill(roomId) : null]).then(function (a) {
        var L = a[0], v = view(roomId, L.fresh ? L.R : null, L.S), host = (v.hostId === u.id);
        /* v1122/v1156：我是哪一方、对手是谁、对手几分（算 ELO 用）—— 两边都给 */
        return { ok: true, mode: v.mode, mySide: host ? 'host' : 'guest',
                 oppId: host ? v.guestId : v.hostId,
                 oppName: host ? v.guestName : v.hostName,
                 oppRating: host ? v.guestRating : v.hostRating,
                 round: v.round, winners: v.winners, roundAt: v.roundAt,
                 hostReady: v.hostReady, guestReady: v.guestReady,
                 heartbeatAt: v.heartbeatAt, wordCount: v.wordCount,
                 status: v.status, hostScore: v.hostScore, guestScore: v.guestScore,
                 endedBy: v.endedBy, room: v };
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* 进入对战屏时报到 —— 双方都就绪才开打。
     🔴v1123：心跳绑在「进对战屏」上（任何进屏路径都会发心跳）。 */
  function markReady(roomId) {
    return ident().then(function (u) {
      return loadView(roomId).then(function (L) {
        var t = Date.now(), host = (L.v.hostId === u.id);
        if (host) setMine(roomId, 'host', '', true);
        else setMine(roomId, 'guest', mySeatId(roomId, L.R), true);
        startHeartbeat(roomId);
        if (host) return patchOwn(roomId, { hostReady: true, hostReadyAt: t, hostBeat: t, heartbeatAt: t });
        return patchOwn(_mySeatId, { guestReady: true, guestReadyAt: t, guestBeat: t });
      }).then(function () { return { ok: true }; });
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 交卷：各写各的文档，两边都齐了才判胜负 ──
     写入重试 3 次；同一个分已经写成功就不再重复写，只读。 */
  function reportResult(roomId, score) {
    var sc = scoreOf(score) || 0;
    return ident().then(function (u) {
      var c = rc(roomId);
      return loadView(roomId).then(function (L) {
        var host = (L.v.hostId === u.id);
        var write = (c.reported === sc) ? Promise.resolve() : retry3(function () {
          var t = Date.now();
          return host ? patchOwn(roomId, { hostScore: sc, hostBeat: t, heartbeatAt: t })
                      : patchOwn(mySeatId(roomId, L.R), { guestScore: sc, guestBeat: t });
        }).then(function () { c.reported = sc; if (host) c.hs = sc; else c.gs = sc; });
        return write.then(function () { return loadView(roomId); }).then(function (L2) {
          var v = L2.v;
          var mine = host ? v.hostScore : v.guestScore, theirs = host ? v.guestScore : v.hostScore;
          if (mine == null) mine = sc;
          if (theirs == null) {
            /* 对手中途走了、不会再交卷 → 别让人干等 45 秒 */
            var left = host ? v.guestLeft : (v.status === 'done' && v.endedBy === 'leave');
            if (left) return { ok: true, waiting: false, mine: mine, theirs: 0, result: 'win', byAbandon: true, oppLeft: true };
            return { ok: true, waiting: true, mine: sc };
          }
          return { ok: true, waiting: false, mine: mine, theirs: theirs,
                   result: mine > theirs ? 'win' : (mine < theirs ? 'lose' : 'draw') };
        });
      });
    })['catch'](function (e) { return fail(e); });
  }

  window.HansenPkRoom = {
    _setDbForTest: function (d) { _dbOverride = d; },
    createRoom: createRoom,
    listRooms: listRooms,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    reportResult: reportResult,
    /* v1100 回合制对战 */
    MODES: MODES,
    /* v1100: 测试注入身份 —— 抢答原子性是本功能命门，必须能自动验 */
    _setMeForTest: function (u) { _meOverride = u; },
    modeOf: modeOf,
    claimRound: claimRound,
    skipRound: skipRound,
    roundState: roundState,
    markReady: markReady,
    /* v1104 对手掉线 / v1105 房间码 */
    sweepMyDeadRooms: sweepMyDeadRooms,
    findByCode: findByCode,
    makeCode: makeCode,
    opponentGone: opponentGone,
    claimAbandonWin: claimAbandonWin,
    ABANDON_MS: ABANDON_MS,
    waitForOpponent: waitForOpponent,
    wordsFromSeed: wordsFromSeed,
    stopHeartbeat: stopHeartbeat,
    /* v1164：错误分类（network/slow/session/expired/config/gone/taken/self/other） */
    kindOf: kindOf,
    errorText: E,
    PROTO: PROTO,
    _collection: COLLECTION,
    _staleMs: STALE_MS,
    /* 测试注入口：换成假传输层即可在本地跑完整链路（含抢座竞态） */
    _setTransportForTest: function (t) { _transport = wrapTimeout(t); },
    _setTimingForTest: function (o) {
      for (var k in (o || {})) if (Object.prototype.hasOwnProperty.call(TM, k)) TM[k] = Number(o[k]);
    },
    _currentRoomId: function () { return _myRoomId; },
    _currentRole: function () { return _myRole; },
    _me: meSync
  };
})();
