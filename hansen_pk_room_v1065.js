/* hansen_pk_room_v1065.js —— 在线对战：房间、天梯匹配的数据层
 *
 * 🔴v1164 存储整个换了（天梯在真机上从来没成功过一次的根因）：
 *   云端集合权限是「读取全部数据，修改本人数据」——**谁建的文档只有谁能改**。
 *   旧协议让客人去改房主的房间文档（抢座、心跳、抢答、交卷），
 *   在真机上要么 updated:0、要么 PERMISSION_DENIED，**全部静默失败**；
 *   假传输层什么都让写，所以测试一直是绿的。
 *
 * 新规矩：**每个人只写自己建的文档。**
 *   房间 R  r…                 房主建、房主写（status、心跳、确认客人、房主分）
 *   座位 S  R_s<轮次>           客人建、客人写（心跳、就绪、客人分、离开）
 *   回合 W  R_w<i> / R_w<轮次>_<i>  谁先拼对谁建（只记「谁先拼对」；超时不建）
 * 「抢」靠的是固定 _id 的 add：数据库保证 _id 唯一，几个人同时 add 只有一个成功。
 * add 失败的报错文本没人在真机上见过，所以失败后一律按 _id 读回来再下结论；
 * 读不回来（主从延迟大、读也失败）就说「没抢到 / 结果待定」，**绝不说成「云端设置不对」**。
 *
 * 🔴v1164（第一轮审查后）几条新原则：
 *   · **不拿别人手机的时间和本机比**：房间是不是活的，看「本机亲眼看到心跳在动」；
 *     时间戳只在两边钟差不多时用，未来时间（对方钟快 / 伪造）一律不信
 *   · **回合文档只认这局两个人建的**（看数据库盖的 _openid），陌生人抢先建的不算数
 *   · 一次轮询一个请求：房间 + 座位 + 这一局所有回合，用 _id in [...] 一起读（省配额）
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
  var FUTURE_MS    = 60000;     /* 心跳时间比本机还快 1 分钟以上：对方钟不准或是伪造的 → 不信时间戳，只信亲眼看到它在动 */
  var LIST_WINDOW_MS = 1800000; /* 列房只查心跳在 ±30 分钟以内的（容得下手机钟差半小时；几天前的死房、「一年以后」的假房都不占名额）
                                   实测：±10 分钟时，钟快 10 分钟的孩子和钟准的孩子互相查不到，天梯各开一间房等到超时 */
  var LIST_LIMIT   = 100;
  var WORDS_PER_ROUND = 10;
  var ABANDON_MS   = 60000;     /* 对手 1 分钟没动静判离场（切后台、接电话都常见，不能更短） */

  /* 时间参数集中放（测试可以调短） */
  var TM = {
    ackMs: 25000,        /* 客人抢到座位后等房主确认多久（主从延迟几秒时 15 秒不够） */
    ackExtraMs: 10000,   /* 等的时候看到房主心跳在动 = 房主还在，再多给 10 秒 */
    ackPollMs: 1000,
    ackBeatMs: 3000,     /* 等确认时客人心跳更勤，房主才分得清座位是不是活的 */
    seatStaleMs: 20000,  /* 座位心跳 20 秒没变（按本机时钟看）→ 当死座位 */
    firstSightMs: 15000, /* 第一次看到座位时心跳在 15 秒内 → 直接确认；更旧的要先看到心跳在动（时钟差大的活人 3 秒内就会动） */
    doneGraceMs: 600000, /* 打完/离开后留 10 分钟再删 —— 切出去很久才回来的那一方还读得到结论 */
    winTtlMs: 1200000,   /* 回合文档 20 分钟后清掉 */
    lagMs: 600,          /* 最终一致：读不到时隔多久再读 */
    lagTries: 5,
    waitPollMs: 2000,    /* 房主等人时的轮询间隔（之后拉长到 2.5、3 秒） */
    ownGraceMs: 20000,   /* 自己刚建的房 20 秒内读不到不算没了（主从延迟大时头几次常读不到） */
    outageMs: 16000,     /* 我这边连续读失败超过 16 秒 = 我断网了：这段时间不算在对手头上 */
    observeMs: 9000,     /* 时间戳看着过期的房：多看几秒，心跳在动就是活的（对方手机钟慢） */
    otherDevMs: 1800000, /* 同账号、不是这台设备建的剩余文档：30 分钟没动才清（另一台手机钟慢时不误删活房） */
    sweepRecheckMs: 25000, /* 联机压力测试 R8：别的设备的旧文档要隔这么久再看一眼、一点没变才删（≥ 3 个心跳周期 8 秒） */
    verdictMs: 1500,     /* 判了「对手离场」后隔一会儿再读一次：两边同时判 = 这局不算 */
    settleMs: 3000,      /* 回合抢写结果待定时，再等多久（之后交给对战屏的轮询补分，审查 FX-10：以前 6 秒 + 9 秒读回，孩子对着「已提交」干等 15 秒） */
    awayAckMs: 60000     /* 房主暂时切出去了（多半是去微信发房间码）：客人占着座位多等一分钟 */
  };

  var _transport = null;        /* 测试注入口 */
  var _ses = { db: null, at: 0 };   /* 最近一次确认过的会话（换账号、登录过期就作废） */
  var _hb = null, _hbRoom = ''; /* 心跳定时器 */
  /* 本机正在用的那间房：房主还是客人、座位号、是否已开打 —— 离开时按身份收尾 */
  var _myRoomId = '', _myRole = '', _mySeatId = '', _myStarted = false;
  var _myAcked = {};            /* roomId → 房主已经写了确认（客人可能已经进了对战屏） */
  var _myCodes = {};            /* roomId → 我开的私密房的码（码不上云，只有房主本机知道） */
  var _rc = {};                 /* roomId → 只增不减的合并缓存 */
  var _obs = {};                /* roomId → 本机看到的心跳值和它最后一次变化的时刻 */
  var _noOrder = false;         /* 云端拒绝过 orderBy（没建索引）→ 这次打开页面不再试 */
  var _seq = 0;
  var _dev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function noop() {}

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
    busy: '云端这次没处理成功，再试一次',
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

  /* 🔴v1164（审查 F1）：只有「权限 / 集合没建 / 环境 / 配额 / 参数」才是云端设置问题。
     DATABASE_REQUEST_FAILED 是数据库「这一次没办成」的统称 —— 重复 _id 抢座失败也是它。
     以前一律当成「云端设置还差一步」，抢座慢了一步的孩子被叫去截图找老师。 */
  var CONFIG_CODE = /PERMISSION|DENIED|NOT_?EXIST|INVALID_PARAM|INVALID_ENV|ENV_NOT|QUOTA|LIMIT_EXCEED|ARREAR|SUSPEND|FORBIDDEN/i;
  function codeKind(code) {
    /* 令牌被云端拒 = SDK 已经续不上了，只能重新登录 */
    if (/TOKEN|UNAUTH|CREDENTIAL|LOGIN/i.test(code)) return 'expired';
    if (CONFIG_CODE.test(code)) return 'config';
    return 'other';
  }
  function textKind(t) {
    if (!t) return 'other';
    if (/自己账号开的房/.test(t)) return 'self';
    if (/PERMISSION_DENIED|COLLECTION_NOT_EXIST|INVALID_PARAM|云端设置还差一步/.test(t)) return 'config';
    if (/not-signed-in|unauthenticated|credentials not found|invalid_grant|refresh token|请先登录|还没登录|登录已过期|登录过期/i.test(t)) return 'expired';
    if (/尚未就绪|not ?ready|会话|session|云端还在准备/i.test(t)) return 'session';
    if (/网络太慢|timeout|timed out|内未完成|超时/i.test(t)) return 'slow';
    if (/network request error|failed to fetch|networkerror|network request failed|load failed|unreachable|net::|连不上网络/i.test(t)) return 'network';
    if (/被别人占了|抢走/.test(t)) return 'taken';
    if (/已经没有了|不存在|不在了|已经离开|已经结束|没找到这间房/.test(t)) return 'gone';
    if (/DATABASE_[A-Z_]+/.test(t) && CONFIG_CODE.test(t)) return 'config';
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
  /* 重复 _id 的 add 报错（文本没人在真机上见过 —— 按 MongoDB / SDK 常见写法认）。
     🔴审查 F-R2-3：DATABASE_REQUEST_FAILED 本身只是「这一次没办成」的统称（写超时、限流也是它），
     不能单凭这个码就当成「重复 _id」—— 以前开房碰上一次写超时，就说「开好了」，其实库里没有这间房。
     只信报错原文里真写着 duplicate / E11000 的；其余一律按 _id 读回来再下结论。 */
  function dupLike(e) {
    return /E11000|duplicate|DUPLICATE/.test(rawText(e));
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
      else if (k === 'other') human = (e && e.cloud) ? HUMAN.busy : (t || HUMAN.other);
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
    if (e && typeof e === 'object' && e.reload) r.reload = true;
    if (e && typeof e === 'object' && e.legacy) r.legacy = true;
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
          /* 🔴v1164：对战键盘只有 26 个字母 —— ice cream / T-shirt 这种带空格、连字符的词
             根本打不出来，抽到就白白超时（约 1/5 的对局会碰上）。两边用同一条规则，词表照样一致。 */
          if (w && w.en && /^[a-zA-Z]+$/.test(String(w.en)))
            pool.push({ en: w.en, cn: w.cn || '', pn: w.pn || '' });
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
  /* 会话不可用：按账号模块给的 kind 分流（不靠猜 reason 里的字 —— 「会话尚未就绪」里也有「会话」） */
  function sessionErr(s) {
    s = s || {};
    var why = s.reason || '未知';
    var sk = String(s.kind || '');
    var signin = (sk === 'signin' || s.notSignedIn || s.reason === 'not-signed-in');
    var k = signin || sk === 'expired' || s.expired ? 'expired'
          : (sk === 'slow' || s.slow) ? 'slow'
          : sk === 'network' ? 'network'
          : sk === 'config' ? 'config'
          : sk === 'other' ? 'other' : 'session';
    var human = signin ? '还没登录，先登录再来对战'
              : k === 'config' ? '云端设置还差一步：这个版本还没配好云开发环境，请把技术信息发给负责的老师'
              : k === 'other' ? '云端没准备好，刷新一下页面再试' : HUMAN[k];
    /* 审查 AUTH-3：SDK 文件没下载完整（浏览器会记住那次失败）—— 说「刷新一下页面」，别说「检查 Wi-Fi」 */
    if (s.reload) human = '云端组件没下载完整，刷新一下页面就好';
    /* 🔴审查 R2-5：旧版本「用户名注册」留下的登录记录 —— 云端从来没有这个账号，「重新登录」是登不回去的。
       把账号模块说的那句实话（去用手机号注册）带给界面，别再说「云端登录过期了 · 你的段位和战绩都还在」 */
    if (s.legacy) { human = String(s.reason || '').slice(0, 140) || human; why = '旧版本用户名注册的账号，云端没有这个账号'; }
    var e = kErr(k, human, '云端会话不可用：' + why);
    e.sessionDead = true; e.expired = (k === 'expired');
    if (s.reload) e.reload = true;
    if (s.legacy) e.legacy = true;
    return e;
  }

  function realTransport() {
    function db() {
      /* v1157: 测试要能验"云端缺索引时会不会降级"，留一个换 db 的口子 */
      if (_dbOverride) return Promise.resolve(_dbOverride);
      var A = window.HansenAuth;
      if (!A || typeof A.ensureSession !== 'function' || typeof A._app !== 'function')
        return Promise.reject(kErr('other', '账号模块没加载好，刷新一下页面再试', '账号模块未加载'));
      /* 🔴v1164：会话 20 秒内刚确认过就不再问 —— 对战时每秒都在读写，
         每次都问一遍会把手机上的诊断轨迹（只留 60 行）刷满，真出错时那几行就被挤掉了 */
      if (_ses.db && Date.now() - _ses.at < 20000) return Promise.resolve(_ses.db);
      return A.ensureSession().then(function (s) {
        if (!s || !s.ok) { _ses.db = null; throw sessionErr(s); }
        if (s.uid) noteUid(String(s.uid));
        /* 🔴v1163：_app() 是异步的（内部 import SDK），必须 .then —— 当同步用会报
           `app.database is not a function`，而测试桩把这一段绕过去了，从没被测到。 */
        return A._app().then(function (app) {
          if (!app || typeof app.database !== 'function')
            throw kErr('other', '云端没准备好，刷新一下页面再试', '云端实例不可用');
          _ses.db = app.database(); _ses.at = Date.now();
          return _ses.db;
        });
      });
    }
    function C(d) { return d.collection(COLLECTION); }
    function sortNewest(rows) {
      /* v1157: 降级路径没有 orderBy，本地排一次 */
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
      /* 🔴v1164（审查 SE-1）：一次请求取回好几条（房间 + 座位 + 这一局的回合）。
         云开发按「调用次数」计费 —— 对战时每秒读三四次，一个班一天就把套餐用完了。 */
      getMany: function (ids) {
        return db().then(function (d) {
          var list = (ids || []).filter(Boolean);
          if (!list.length) return [];
          return C(d).where({ _id: d.command['in'](list) }).limit(Math.min(100, list.length)).get()
            .then(chk('getMany')).then(function (r) { return (r && r.data) || []; });
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
      /* 🔴v1164（审查 TI-1）：查询里就只要「新协议、最近 10 分钟有心跳」的房 ——
         以前只按 status/isPrivate 查、取 40 条，orderBy 没索引时退成「不排序取 40 条」，
         攒够 40 间死房（房主手机没电的、旧版本的）以后，**活房一间都排不进来**，天梯永远配不到人。
         proto:2 的房从建房那一刻就带 heartbeatAt，不存在「字段缺失查不出来」的问题。 */
      listOpen: function (nowTs, o) {
        return db().then(function (d) {
          var _ = d.command || {};
          var t0 = Number(nowTs) || Date.now();
          var since = t0 - LIST_WINDOW_MS, until = t0 + LIST_WINDOW_MS;
          /* 🔴审查 F10：心跳时间两头都卡在服务端 —— 陌生人建 40 间「心跳在一年以后」的假房，
             以前能把查询名额全占满、真房一间都列不出来。±30 分钟容得下手机钟不准。 */
          var beat = _.gt ? (_.lt && _.gt(since).and ? _.gt(since).and(_.lt(until)) : _.gt(since)) : undefined;
          /* 🔴审查 F-R2-5：排序用的是建房时间 —— 它以前不设上限，「建于 9e15 年」的假房永远排在最前、占满名额。
             建房时间也卡同一个窗口（等人的房最多开两分钟，多留 10 分钟余量）。 */
          var born = (_.gt && _.lt && _.gt(since - 600000).and) ? _.gt(since - 600000).and(_.lt(until)) : undefined;
          /* 名额被几个账号占了一大片时，排除掉它们再查一次（调用方 listOpenRows 决定排除谁） */
          var skip = (o && o.notOwners && o.notOwners.length && typeof _.nin === 'function') ? o.notOwners : null;
          function base() {
            return skip
              ? C(d).where({ status: 'open', isPrivate: false, proto: PROTO, heartbeatAt: beat, createdAt: born, _openid: _.nin(skip) })
              : C(d).where({ status: 'open', isPrivate: false, proto: PROTO, heartbeatAt: beat, createdAt: born });
          }
          function plain() {
            return base().limit(LIST_LIMIT).get();
          }
          /* 🔴v1157：orderBy 要建索引，没建就整个查询报错 —— 失败就降级成不排序的查询（本地排）。
             报错可能是 reject，也可能是 resolve 一个 {code}，两种都要降级；云端明确拒过一次就记住，别每次都白问。 */
          var first = _noOrder ? plain() : base()
            .orderBy('createdAt', 'desc').limit(LIST_LIMIT).get()
            .then(function (r) {
              if (r && r.code) throw cloudErr(r, 'listOpen');
              return r;
            })
            ['catch'](function (indexErr) {
              if (indexErr && indexErr.cloud) _noOrder = true;
              try {
                console.warn('[房间] orderBy 失败，降级为不排序查询（多半是云端没建 createdAt 索引）：'
                  + rawText(indexErr).slice(0, 120));
              } catch (e) {}
              return plain();
            });
          return first.then(chk('listOpen'))
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
    var FAST = { read: 1, patch: 1, getMany: 1 };
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
        var READ_ONLY = { read: 1, list: 1, listOpen: 1, getMany: 1, add: 1, patch: 1, remove: 1 };
        var once = function () {
          return withTimeout(fn.apply(tx, args), FAST[k] ? NET_TIMEOUT_FAST_MS : NET_TIMEOUT_MS)['catch'](function (e) {
            var ek = kindOf(e);
            if (ek === 'expired' || ek === 'session') _ses.db = null;   /* 会话出问题了：下次重新确认 */
            throw e;
          });
        };
        var again = function (ms) {
          return function (e) { if (!retryable(e)) throw e; return sleep(ms).then(once); };
        };
        var run = READ_ONLY[k] ? once()['catch'](again(300))['catch'](again(700)) : once();
        /* 🔴审查 R2-UI-7：数据库说「令牌过期 / 不对」，SDK 自己却还觉得令牌没过期（手机钟被调过、云端撤了这张令牌）——
           以前直接当「登录过期」，「重新登录」又打开一个「已登录」的面板，孩子卡死在那儿。
           先让 SDK 用 refresh_token 换一张新令牌、再试一次；换不到才是真的过期
           （账号模块会清掉本机「已登录」记录，界面上的「重新登录」就会出现登录表单）。 */
        return run['catch'](function (e) {
          if (!(e && e.cloud && kindOf(e) === 'expired')) throw e;
          return recoverOnce(e).then(function (ok) {
            if (!ok) throw e;
            _ses.db = null;
            return once();
          });
        });
      };
    });
    return out;
  }
  function recoverOnce(e) {
    var A = window.HansenAuth;
    if (!A || typeof A.recoverSession !== 'function') return Promise.resolve(false);
    return Promise.resolve().then(function () { return A.recoverSession(rawText(e)); })
      .then(function (r) { return !!(r && r.ok); }, function () { return false; });
  }

  function T() {
    if (_transport) return _transport;
    _transport = wrapTimeout(realTransport());
    return _transport;
  }

  /* 一次取回好几条。假传输层没有 getMany 时逐条读（测试注入的旧桩照样能跑）；
     返回 {map: id → 文档|null, err: id → 读失败的错误} */
  function fetchMany(ids) {
    var list = [];
    (ids || []).forEach(function (id) { if (id && list.indexOf(id) < 0) list.push(id); });
    var t = T();
    if (typeof t.getMany === 'function') {
      return t.getMany(list).then(function (rows) {
        var map = {};
        list.forEach(function (id) { map[id] = null; });
        (rows || []).forEach(function (d) { if (d && d._id && Object.prototype.hasOwnProperty.call(map, d._id)) map[d._id] = d; });
        return { map: map, err: {} };
      });
    }
    var map = {}, err = {};
    return Promise.all(list.map(function (id, n) {
      return t.read(id).then(function (d) { map[id] = d || null; }, function (e) {
        if (n === 0) throw e;          /* 第一条（房间）读不到：整次失败，和以前一样 */
        err[id] = e; map[id] = null;
      });
    })).then(function () { return { map: map, err: err }; });
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
    var _forget = function () { _me = null; _mePending = null; _ses.db = null; };
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
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function nonce() { return _dev + '.' + (++_seq); }
  function seatIdOf(rid, ep) { return rid + '_s' + (ep || 0); }
  /* 回合文档按轮次分开（R_w<轮次>_<i>）：房主换过客人，上一个客人留下的回合文档不会算进新的一局。
     第 0 轮沿用 R_w<i>。同一个 _id 被陌生人抢先建了（伪造的）→ 换备用号 b、c。 */
  var ALT = ['', 'b', 'c'];
  function winIdOf(rid, ep, i, k) {
    return (ep ? (rid + '_w' + ep + '_' + i) : (rid + '_w' + i)) + (ALT[k || 0] || '');
  }
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
  function setMine(id, role, sid, started) {
    _myRoomId = id || ''; _myRole = role || ''; _mySeatId = sid || ''; _myStarted = !!started;
  }
  function mySeatId(rid, R) {
    if (_myRoomId === rid && _mySeatId) return _mySeatId;
    var c = _rc[rid];
    if (c && c.mySeat) return c.mySeat;
    return seatIdOf(rid, num(R && R.seat));
  }
  /* 这一局是第几轮的座位（房主确认时 / 客人抢到时定下来；之前按房间当前的轮次） */
  function matchEp(c) { return (c && c.ep != null) ? c.ep : num(c && c.meta && c.meta.seat); }

  /* ── 本机建过的文档（只记在这一页的会话里，不进备份、不跨设备）──
     清理死房时，本机建的按正常宽限期清；同账号**别的设备**建的要 30 分钟没动才清 ——
     那台手机的钟要是慢了，按它写的时间戳看「两分钟没心跳」，其实它正开着房等人（审查 F8）。 */
  var MINE_KEY = 'hsnPkDevDocs_v1164';
  var _mineMem = {};
  function mineMap() {
    try { var o = JSON.parse(sessionStorage.getItem(MINE_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function noteMine(id) {
    if (!id) return;
    _mineMem[id] = Date.now();
    try {
      var o = mineMap(); o[id] = Date.now();
      var ks = Object.keys(o);
      if (ks.length > 80) ks.sort(function (a, b) { return o[a] - o[b]; }).slice(0, ks.length - 80).forEach(function (k) { delete o[k]; });
      sessionStorage.setItem(MINE_KEY, JSON.stringify(o));
    } catch (e) {}
  }
  function isMineDev(id) {
    if (_mineMem[id]) return true;
    try { return !!mineMap()[id]; } catch (e) { return false; }
  }

  /* ── 私密房的码：码本身不上云（集合所有人都能读），只放一个摘要供输码查房；
     进房的客人还要在座位上交一个只有知道码才算得出来的凭证，房主核对了才放行（审查 SEC-7）。
     ⚠️ 4 位码一共 92 万种，懂编程的人照样能硬算 —— 这只防「顺手绕过」，挡不住专门来捣乱的。 */
  function h53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function codeHash(code) { return 'c' + h53('hansen-pk-code:' + String(code || '').toUpperCase()); }
  function codeProof(code, seatId) { return 'p' + h53('hansen-pk-proof:' + String(code || '').toUpperCase() + ':' + seatId); }

  /* ── 房间还活着吗（审查 F8/F10/TI-3）─────────────────────────────
     以前：本机时间 − 房主写的心跳时间 < 30 秒。房主手机慢 1 分钟 → 他的房谁都看不见、码也找不到；
     快 10 分钟 → 他关了 App，房还「活」10 分钟。现在两条路，任一条成立就算活：
       ① 本机亲眼看到它的心跳值在变（最近 30 秒内变过）—— 不看对方的钟，钟差多少都对；
       ② 时间戳在 30 秒内、且不在未来 1 分钟以外 —— 两边钟差不多时，第一眼就能判。
     未来很远的时间戳（伪造的 / 钟快的）只认 ①：不动的假房永远不展示。 */
  function observe(x, t) {
    var id = String((x && x._id) || '');
    var b = num(x && x.heartbeatAt) || num(x && x.createdAt);
    var o = _obs[id];
    if (!o) o = _obs[id] = { v: b, at: t, chg: 0 };
    else if (b > o.v) { o.v = b; o.at = t; o.chg = t; }   /* 心跳只会往后走：变大了才算「在动」 */
    else if (b !== o.v) { o.v = b; o.at = t; }            /* 变小了（旧快照 / 改了钟）不算 */
    return o;
  }
  function roomAlive(x, t) {
    if (!x) return false;
    var b = num(x.heartbeatAt) || num(x.createdAt);
    var o = observe(x, t);
    if (o.chg && (t - o.chg) < STALE_MS) return true;
    return (t - b) < STALE_MS && (b - t) < FUTURE_MS;
  }
  function pruneObs(t) {
    for (var k in _obs) if (has(_obs, k) && (t - _obs[k].at) > LIST_WINDOW_MS) delete _obs[k];
  }

  /* ══ 合并视图：把 R + S + W 拼回界面熟悉的旧字段名 ═══════════════════
     🔴最终一致：某一次读可能拿到旧快照。合并必须**只进不退** ——
     状态 open→playing→done 不回退、已定的回合只增不减、见过的比分不丢、
     见过的「判离场」结论不丢（审查 F12：一次旧快照会把「判负」读回成正常的 500:1「胜」）。 */
  var RANK = { open: 0, playing: 1, done: 2 };
  var RANK_NAME = ['open', 'playing', 'done'];
  function rc(id) {
    return _rc[id] || (_rc[id] = { rank: 0, guestId: '', hs: null, gs: null, fin: null, wins: [],
                                   seat: null, meta: null, calls: 0, opp: {}, missR: 0, missS: 0,
                                   awH: false, awG: false, eb: '', ep: null, sq: {}, mySeat: '',
                                   lastOk: 0, failSince: 0, outageAt: 0, lastL: null, createdLocal: 0 });
  }
  function setWin(rid, i, d) {
    var c = rc(rid);
    if (c.wins[i] || !d) return;
    if (d.winner !== 'host' && d.winner !== 'guest') return;
    c.wins[i] = { winner: d.winner, at: num(d.at), by: String(d.by || '') };
  }
  /* 已定的最大一词 +1（中间没人拼对的词是空着的 ''） */
  function decided(rid) { return winnersOf(rid).length; }
  function winnersOf(rid) {
    var c = rc(rid), cap = capOf(c.meta), out = [], last = -1;
    /* v1163：赢家名单最多 N 条、每项只认 host/guest —— 别人写的数据不可信 */
    for (var i = 0; i < cap; i++) if (c.wins[i]) last = i;
    for (var j = 0; j <= last; j++) out.push(c.wins[j] ? c.wins[j].winner : '');
    return out;
  }
  /* 回合文档是不是这一局两个人自己建的（审查 F9）：
     · winner 只能是 host / guest，by 必须是那一方的身份键；
     · 数据库盖的 _openid 必须是那一方的（房主 = 房间文档的创建者，客人 = 当前座位的创建者）。
     陌生人抢先建的同 _id 文档 → 不算数（再换备用号写）。云端读不回 _openid 时只能退回看 by。 */
  function validWin(d, rid, ep, i) {
    if (!d || d.kind !== 'win' || d.roomId !== rid || num(d.i) !== i || num(d.ep) !== ep) return false;
    var c = rc(rid), R = c.meta || {}, S = c.seat || {};
    var w = d.winner;
    if (w !== 'host' && w !== 'guest') return false;
    var key = (w === 'host') ? String(R.hostId || '') : String(S.guestId || c.guestId || '');
    if (!key || String(d.by || '') !== key) return false;
    var maker = (w === 'host') ? R._openid : S._openid;
    if (d._openid && maker && d._openid !== maker) return false;
    if (d._openid && !maker && w === 'guest') return false;   /* 客人座位还没读到：先不认，下次再看 */
    return true;
  }
  function winIdsAll(rid) {
    var c = rc(rid), ep = matchEp(c), cap = capOf(c.meta), ids = [];
    for (var i = 0; i < cap; i++) {
      if (c.wins[i]) continue;
      for (var k = 0; k <= Math.min(ALT.length - 1, c.sq[i] || 0); k++) ids.push(winIdOf(rid, ep, i, k));
    }
    return ids;
  }
  function absorbWins(rid, map) {
    var c = rc(rid), ep = matchEp(c), cap = capOf(c.meta);
    for (var i = 0; i < cap; i++) {
      if (c.wins[i]) continue;
      for (var k = 0; k < ALT.length; k++) {
        var d = map[winIdOf(rid, ep, i, k)];
        if (!d) continue;
        if (validWin(d, rid, ep, i)) { setWin(rid, i, d); break; }
        /* 被别人占了（陌生人建的，或者根本不是回合文档 —— 审查 F-R2-6：以前只认「长得像回合文档」的，
           塞一条空文档就能让这一词永远判不出来）：下次连备用号一起读 */
        c.sq[i] = Math.max(c.sq[i] || 0, Math.min(ALT.length - 1, k + 1));
      }
    }
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
    if (R.abandonWin === 'host') c.awH = true;
    if (s.abandonWin === 'guest') c.awG = true;
    if (!c.eb && R.endedBy) c.eb = sText(R.endedBy, 12);
    var aw = (c.awH && c.awG) ? 'both' : (c.awH ? 'host' : (c.awG ? 'guest' : ''));
    var hs = scoreOf(R.hostScore), gs = scoreOf(s.guestScore);
    if (hs == null && c.awH) hs = 1;
    if (gs == null && c.awG) gs = 1;
    if (gs == null && c.awH && !c.awG) gs = 0;
    if (hs == null && c.awG && !c.awH) hs = 0;
    if (hs != null) c.hs = hs;
    if (gs != null) c.gs = gs;
    /* 「答完第几词 / 当前几分」只增不减（旧快照不许把进度拉回去） */
    c.ans = c.ans || { h: -1, g: -1, hp: 0, gp: 0 };
    if (R.hostAns != null) c.ans.h = Math.max(c.ans.h, num(R.hostAns));
    if (s.guestAns != null) c.ans.g = Math.max(c.ans.g, num(s.guestAns));
    c.ans.hp = Math.max(c.ans.hp, sNum(R.hostPts, 0, 100000, 0));
    c.ans.gp = Math.max(c.ans.gp, sNum(s.guestPts, 0, 100000, 0));
    var winners = winnersOf(rid);
    var n = winners.length, roundAt = 0;
    if (n === 0) roundAt = (R.hostReady && s.guestReady) ? Math.max(num(R.hostReadyAt), num(s.guestReadyAt)) : 0;
    else roundAt = c.wins[n - 1] ? c.wins[n - 1].at : 0;
    /* 「房主报到了」只算这一局的：房主换了别的客人（我被撤回了），他的报到跟我无关（审查 F11） */
    var hostReady = !!R.hostReady && (!gid || !R.guestId || String(R.guestId) === gid);
    return {
      _id: rid, id: rid, proto: num(R.proto), kind: 'room',
      status: RANK_NAME[rank], isPrivate: !!R.isPrivate, code: sText(_myCodes[rid] || '', 8),
      mode: modeOf(R.mode).key, askMode: (R.askMode === 'tts') ? 'tts' : 'cn',
      seed: R.seed, wordCount: capOf(R),
      hostId: String(R.hostId || ''), hostName: cloudName(R.hostName),
      hostRating: sNum(R.hostRating, 0, 4000, 0), hostElo: sNum(R.hostElo, 0, 4000, 0),
      hostTier: sText(R.hostTier, 12),
      createdAt: num(R.createdAt), heartbeatAt: num(R.heartbeatAt), hostBeat: num(R.hostBeat),
      hostReady: hostReady, hostReadyAt: num(R.hostReadyAt), seat: num(R.seat),
      guestId: gid, guestName: gid ? cloudName(s.guestName || R.guestName) : '',
      guestRating: sNum(s.guestRating || R.guestRating, 0, 4000, 0),
      guestBeat: num(s.guestBeat), guestReady: !!s.guestReady, guestReadyAt: num(s.guestReadyAt),
      guestLeft: !!s.left,
      hostScore: c.hs, guestScore: c.gs,
      startedAt: num(R.startedAt), endedAt: num(R.endedAt), endedBy: c.eb,
      abandonWin: aw,
      winners: winners, round: n, roundAt: roundAt,
      hostAns: c.ans.h, guestAns: c.ans.g, hostPts: c.ans.hp, guestPts: c.ans.gp
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
  /* 房间 + 当前座位（+ 这一局所有回合）一次读回来；房间读不到先用缓存，连续 3 次读不到才算没了。
     🔴审查 F4：记下「我这边从什么时候开始读不到」—— 恢复时如果断了很久，那段时间不能算在对手头上。 */
  function loadView(rid, o) {
    var c = rc(rid);
    var ep0 = c.meta ? num(c.meta.seat) : 0;
    var sid0 = mySeatId(rid, c.meta);
    var ids = [rid, sid0].concat((o && o.wins) ? winIdsAll(rid) : []);
    return fetchMany(ids).then(function (got) {
      var t = Date.now();
      var R = isRoomDoc(got.map[rid], rid) ? got.map[rid] : null;
      if (!R) {
        var young = c.createdLocal && (t - c.createdLocal) < TM.ownGraceMs;
        if (!young) c.missR++;
        if (c.missR >= 3 || !c.meta) throw kErr('gone', HUMAN.gone, '房间已不存在');
      } else c.missR = 0;
      if (c.failSince && (t - c.failSince) > TM.outageMs) c.outageAt = t;
      c.failSince = 0; c.lastOk = t;
      var RR = R || c.meta;
      var sid = mySeatId(rid, RR);
      var more = (sid !== sid0 && !(_myRoomId === rid && _mySeatId)) ? fetchMany([sid]) : null;
      return Promise.resolve(more).then(function (g2) {
        var src = g2 || got;
        var S = src.map[sid];
        var sErr = !!src.err[sid];
        var seat = (!sErr && S && S.kind === 'seat' && S.roomId === rid) ? S : null;
        view(rid, R, seat);
        if (o && o.wins) absorbWins(rid, got.map);
        var L = { R: RR, S: seat, sErr: sErr, fresh: !!R, v: view(rid, null, null), at: t, ep0: ep0 };
        c.lastL = L;
        return L;
      });
    }, function (e) {
      if (!c.failSince) c.failSince = Date.now();
      throw e;
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
     几个人同时 add 同一个 _id，数据库只让一个成功。不能只信 add 的结果 ——
       · add 成功：读回来看 nonce（万一后端是覆盖写 / 悄悄吞掉重复，两个人都会以为自己赢了，审查 F13）。
         读不到（主从延迟）就多读几次，读到为止（有上限）；一直读不到才信 add。
       · add 失败：重复 _id 的报错文本没人见过、网络断在半路时也可能「其实写进去了」——
         按 _id 隔一会儿多读几次（读失败就再读，**一次读失败不能当成「没有」**，审查 F1）：
           读到、nonce 是我的 → 我的（我刚才那次重试写进去了）；不是我的 → 被别人抢了；
           一直读不到 → **结果待定**（unknown）：多半是别人的还没同步过来，也可能是我的。
           调用方自己决定怎么说（座位 = 被占了、房间 = 网不稳再试、回合 = 等下一次读）。
           绝不把它说成「云端设置还差一步」。
     🔴审查第二轮（F-R2-2/F-R2-3/F-R2-4/T6）：
       · **add 成功 = 这条就是我建的**（数据库保证 _id 唯一）。紧接着的读可能来自旧副本 ——
         读到上一个坐这个座位、刚刚删掉的那条，以前就会说「这间房刚被别人占了」，其实座位是我的。
         所以座位 / 房间 add 成功就算数；只有回合文档（opts.verify）还读一眼（万一后端悄悄吞掉重复 _id，
         两个人不能都「先拼对」—— 回合文档一局里只建一次、从不删，旧副本不会冒出「上一个人的」）。
       · add 失败、报错长得像「权限 / 参数」也照样读回来（重复 _id 的原文没人见过，可能就长那样）；
         读得到 → 按 nonce 判；读本身被拒才是真的「云端设置不对」。
       · 读到的是一条「根本不是这种文档」的东西（陌生人塞的）→ junk：调用方换号，不当成「被人占了」。
     opts：fresh 我随机生成的 _id（开房，撞不上别人）；verify 成功后也读一眼；fast 失败后少读几次；
           stop() 返回 true 就别再读了（进房已经取消）。 */
  function rbDelays(failPath, fast) {
    var f = failPath ? (fast ? [0.5, 0.8, 1.3, 2] : [0.5, 0.8, 1.3, 2, 2.7, 3.3, 4.3]) : [0, 0.4, 0.8, 1.5, 2.3];
    return f.map(function (x) { return Math.round(x * TM.lagMs); });
  }
  function claim(doc, opts) {
    opts = opts || {};
    var id = doc._id;
    function same(d) { return !!(d && d.kind === doc.kind && d.roomId === doc.roomId && (!d._id || d._id === id)); }
    /* 隔一会儿读一次，读到这条就停；每一次读失败都接着读（不让一次失败结束整个判定） */
    function readBack(delays) {
      var lastErr = null, i = 0;
      function step() {
        if (i >= delays.length || (opts.stop && opts.stop())) return Promise.resolve({ doc: null, err: lastErr });
        var wait = delays[i++];
        return sleep(wait).then(function () {
          return T().read(id).then(function (d) {
            if (same(d)) return { doc: d, err: null };
            if (d) return { doc: null, junk: d, err: null };   /* 占着这个 _id 的根本不是这种文档：不会变，不用再读 */
            return step();
          }, function (e) {
            lastErr = e;
            var k = kindOf(e);
            if (k === 'expired' || k === 'session' || k === 'config') return { doc: null, err: e, stop: true };
            return step();
          });
        });
      }
      return step();
    }
    return T().add(doc).then(function (r) {
      if (!opts.verify) return { mine: true, doc: doc, id: (r && r.id) || id };
      return readBack(rbDelays(false)).then(function (rb) {
        if (rb.doc && rb.doc.nonce && doc.nonce && rb.doc.nonce !== doc.nonce) return { mine: false, doc: rb.doc, id: id };
        return { mine: true, doc: doc, id: (r && r.id) || id };
      });
    }, function (addErr) {
      var k = kindOf(addErr);
      if (k === 'expired') throw addErr;   /* 没登录：读也读不了 */
      /* 🔴联机压力测试 R5：会话一时没好 —— 可能是第一次 add 已经写进去了、重试时才碰上 —— 结果待定，不能当成「没写上」
         （以前回合抢写这一词记 0 分、再也不补，接近的比分会翻盘） */
      if (k === 'session') return { mine: false, unknown: true, id: id, err: addErr, dup: false };
      return readBack(rbDelays(true, opts.fast || opts.fresh)).then(function (rb) {
        if (rb.stop) throw rb.err;
        if (rb.doc) return { mine: !!(rb.doc.nonce && rb.doc.nonce === doc.nonce), doc: rb.doc, id: id };
        if (rb.junk) return { mine: false, junk: rb.junk, id: id };
        /* 一直读不回来：结果待定。读本身失败的话，报读的那个原因（断网 / 太慢）；
           读都通、就是没有这条 → 报 add 的原话（权限不对这类真问题就从这里如实说出来） */
        return { mine: false, unknown: true, id: id, err: rb.err || addErr, dup: dupLike(addErr) };
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

  /* 能进的新版房：新协议、开着、没客人、房主还在 */
  function joinable(x, t) {
    return !!(x && x.proto === PROTO && x.kind === 'room' && x.status === 'open'
              && !x.guestId && roomAlive(x, t));
  }

  /* 按房间码找房 —— 朋友输码进房走这里。
     🔴v1164（审查 F8）：码对上了但时间戳看着过期 → 多看几秒（房主手机钟慢的话，心跳照样在动） */
  function findByCode(code) {
    var c = String(code || '').trim().toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(c)) {
      return Promise.resolve(failK('other', '房间码是 4 位，检查一下'));
    }
    return ident().then(function (u) {
      var H = codeHash(c);
      function look(n) {
        return T().list({ codeH: H, status: 'open' }).then(function (rows) {
          var t = Date.now(), mine = false, cand = 0;
          var ok = (rows || []).filter(function (x) {
            if (!(x && x.proto === PROTO && x.kind === 'room' && x.status === 'open' && !x.guestId)) return false;
            if (u.id && x.hostId === u.id) { mine = true; return false; }
            cand++;
            return roomAlive(x, t);
          });
          if (ok.length) return { ok: true, room: listItem(ok[0]), roomId: String(ok[0]._id) };
          if (cand && n > 0) return sleep(Math.round(TM.observeMs / 3)).then(function () { return look(n - 1); });
          if (mine) return failK('self', HUMAN.self);
          /* 🔴联机压力测试 D4：码没错、房也在，只是已经开打了（满了）或房主暂时切出去了 —— 以前一律说「码输错了」 */
          return T().list({ codeH: H }).then(function (all) {
            var t2 = Date.now(), busy = false, away = false;
            (all || []).forEach(function (x) {
              if (!(x && x.proto === PROTO && x.kind === 'room') || (u.id && x.hostId === u.id)) return;
              var fresh = (t2 - (num(x.heartbeatAt) || num(x.createdAt))) < STALE_MS * 4;
              if (fresh && x.status === 'playing') busy = true;
              if (fresh && (x.status === 'away' || x.away)) away = true;
            });
            if (busy) return failK('taken', '这间房已经开打了（两个人都到齐了），让朋友再开一间、发新的码');
            if (away) return failK('gone', '房主刚切出去了一下，等一会儿再输一次码');
            return failK('gone', '没找到这间房，可能已经关了或码输错了');
          }, function () { return failK('gone', '没找到这间房，可能已经关了或码输错了'); });
        });
      }
      return look(3);
    })['catch'](function (e) { return fail(e); });
  }

  /* v1112: 开房中的那一次，防连点开出僵尸房。
     🔴审查第二轮（R2-UI-1）：记下这一次的设定 —— 以前第二次开房（选的是别的玩法）直接拿到第一次的结果，
     孩子点的是「抢答赛」开出来的却是「同步赛」。设定一样才共用；不一样就等上一次收完再开。
     界面离开了（关掉 / 回列表 / 返回键）就 cancelCreate()：房开出来了也马上收掉，不发心跳、不挂在列表里。 */
  var _creating = null;   /* { p, key, cancelled } */
  function createKey(o) {
    return [modeOf(o.mode).key, o.askMode === 'tts' ? 'tts' : 'cn', !!o.private,
            Math.floor(Number(o.hostRating) || 0), Number(o.wordCount) || 0].join('|');
  }
  function cancelCreate() { if (_creating) _creating.cancelled = true; }
  /* 开房的 add：_id 是我随机生成的，撞不上别人。写失败 → 读一眼（回包丢了的话那条其实在）→
     没有就再写一次（审查 F-R2-3：一次写超时不等于开不了房）→ 还不行如实说 */
  function claimFresh(doc) {
    return claim(doc, { fresh: true }).then(function (r) {
      if (r.mine || !r.unknown) return r;
      var k = kindOf(r.err);
      if (k !== 'other' && k !== 'network' && k !== 'slow') return r;   /* 权限 / 没登录：再写也一样 */
      return sleep(TM.lagMs).then(function () { return claim(doc, { fresh: true }); });
    });
  }

  function createRoom(opts) {
    opts = opts || {};
    var key = createKey(opts);
    if (_creating && !_creating.cancelled) {
      if (_creating.key === key) return _creating.p;
      var prevP = _creating.p;
      return prevP.then(function () { return createRoom(opts); }, function () { return createRoom(opts); });
    }
    /* 🔴v1163：词库没加载就别让人建房 —— 否则等来对手，两人一进对战就双双跳结算屏 */
    try {
      var _probe = wordsFromSeed(1, 3);
      if (!_probe || _probe.length < 1) {
        return Promise.resolve(failK('other', '词库还没加载好，刷新一下页面再开房'));
      }
    } catch (e) {
      return Promise.resolve(failK('other', '词库还没加载好，刷新一下页面再开房'));
    }
    var job = { key: key, cancelled: false, p: null };
    var cancelledRes = function () { return failK('other', '已经不开这间房了', '', { cancelled: true }); };
    job.p = ident().then(function (u) {
      if (job.cancelled) return cancelledRes();
      /* 🔴v1135：开新房前先收掉自己手上那间（按身份：房主关房 / 客人退座） */
      if (_myRoomId) leaveMine();
      var now = Date.now();
      var seed = (now ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      /* 🔴v1163：客户端定好 _id —— add 重试写的一定是同一条，不会一次点击开出两间房 */
      var _newId = 'r' + now.toString(36) + Math.random().toString(36).slice(2, 8);
      var code = '';
      var doc = {
        _id: _newId, proto: PROTO, kind: 'room', nonce: nonce(),
        status: 'open',
        codeH: '',     /* 私密房的码只存摘要（码本身不上云）；下面查重后再写 */
        isPrivate: !!opts.private,
        mode: modeOf(opts.mode).key,
        askMode: (opts.askMode === 'tts') ? 'tts' : 'cn',   /* v1102: 看中文 / 听发音 */
        seed: seed,
        wordCount: capOf({ wordCount: opts.wordCount || WORDS_PER_ROUND }),
        hostId: u.id, hostName: u.name,
        /* v1114: 夹到 ELO 的合理区间。hostRating 只给天梯匹配用（自由房写 0，免得被排位配进来）；
           hostElo 是房主真实的天梯分，算 ELO 用（审查 UI-12：自由房的抢答赛客人以前按 1000 分算） */
        hostRating: Math.max(0, Math.min(4000, Math.floor(Number(opts.hostRating) || 0))),
        hostElo: myRating(opts.elo),
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
            return T().list({ codeH: codeHash(c), status: 'open' }).then(function (rows) {
              if (rows && rows.length && tries < 5) return pickCode(tries + 1);
              code = c; doc.codeH = codeHash(c);
              return doc;
            })['catch'](function () { code = c; doc.codeH = codeHash(c); return doc; });
          })(0)
        : Promise.resolve(doc);
      return _prep.then(function () { return job.cancelled ? { cancelled: true } : claimFresh(doc); }).then(function (r) {
        if (r.cancelled) return cancelledRes();
        if (job.cancelled) {
          /* 界面已经离开了（返回键 / 关掉 / 回列表）：开出来的房马上收掉，不发心跳 —— 不留「看得见、进去没人」的房 */
          if (r.mine || r.unknown) T().remove(doc._id)['catch'](noop);
          return cancelledRes();
        }
        if (!r.mine) {
          /* 🔴审查 F1：读不回来 = 不知道开没开成 → 顺手删一下（真写进去了就删掉，没写进去删了也无妨），
             按读的原因说（断网 / 太慢），绝不说成「云端设置还差一步」 */
          if (r.unknown) {
            T().remove(doc._id)['catch'](noop);
            var ue = r.err && kindOf(r.err) !== 'other' ? r.err
                   : kErr('slow', '网络不太稳，房没开成，再点一次开房', rawText(r.err) || '开房后读不回房间');
            return fail(ue);
          }
          return failK('other', '房号撞车了，再点一次开房就好');
        }
        /* 🔴v1163：拿不到有效房间号就不算建成（否则界面说"开好了"，其实没有房） */
        var _rid = r && r.id;
        if (typeof _rid === 'number' && isFinite(_rid)) _rid = String(_rid);
        if (typeof _rid !== 'string' || !_rid) {
          return failK('other', '云端没有返回房间号，房没开成 —— 再试一次吧');
        }
        doc._id = _rid;
        setMine(_rid, 'host', '', false);
        if (code) _myCodes[_rid] = code;
        noteMine(_rid);
        var c0 = rc(_rid);
        c0.meta = doc; c0.createdLocal = Date.now();
        startHeartbeat(_rid);
        return { ok: true, roomId: _rid, room: view(_rid, doc, null), mySide: 'host',
                 words: wordsFromSeed(seed, doc.wordCount) };
      });
    })['catch'](function (e) { return fail(e); });
    _creating = job;
    /* 无论成败都要解锁，否则一次失败就再也开不了房 */
    var unlock = function () { if (_creating === job) _creating = null; };
    job.p.then(unlock, unlock);
    return job.p;
  }

  /* ── 🔴v1135 顺手清死房 ── 没有服务端定时任务，所以每个人顺手清**自己的**剩余文档：
     打完/离开超过宽限期的房间和座位、过期的回合文档。别人的本来也删不掉。每次最多删 10 条。
     🔴v1164（审查 SE-3）：以前每次列房都跑三次查询（天梯找人时每 2.5 秒一次，占了找人读次数的四分之三）——
       现在打开页面后跑一次，之后 10 分钟内不再跑；同一时间只跑一个。
     🔴v1164（审查 F8）：同账号**别的设备**建的（不在本机记录里），30 分钟没动才清 ——
       那台手机钟慢的话，「两分钟没心跳」其实是它正开着房在等人。 */
  var _sweepAt = 0, _sweeping = null;
  /* 🔴联机压力测试 R8：同账号**别的设备**的文档，光看本机钟算的「30 分钟没动」不够 —— 那台手机钟慢 / 本机钟快 30 分钟以上时，
     它正在打的房、座位、回合文档在本机看来都「30 分钟没动」，以前当场就删了（那一局两边都「房间已经关了，不记分」）。
     现在：本机钟看着过期的先记下来（候选），隔 sweepRecheckMs（25 秒，三个心跳周期）再看一眼，**一点没变**才删。
     活的房 / 座位每 8 秒写一次心跳，一定会变；回合文档自己不变，就看它那一局的房间 / 我的座位变没变。
     第一次清理只记候选、不删；25 秒后自动复查一次（不受「10 分钟一次」的限制），到时还没变的才删（每次最多 10 条）。 */
  var _swCand = {}, _swRecheck = null;
  function swSeen(id, sig, t) {
    var o = _swCand[id];
    if (o && o.sig === sig) return (t - o.at) >= TM.sweepRecheckMs;
    _swCand[id] = { sig: sig, at: t };
    return false;
  }
  function swRecheckLater() {
    if (_swRecheck) return;
    try {
      _swRecheck = setTimeout(function () { _swRecheck = null; sweepMyDeadRooms(); }, TM.sweepRecheckMs + 1000);
    } catch (e) { _swRecheck = null; }
  }
  function maybeSweep() {
    if (_sweeping || (_sweepAt && Date.now() - _sweepAt < 600000)) return;
    _sweepAt = Date.now();
    try { setTimeout(function () { sweepMyDeadRooms(); }, 1500); } catch (e) {}
  }
  function sweepMyDeadRooms() {
    if (_sweeping) return _sweeping;
    /* v1163：这个函数是延迟跑的，那时传输层可能已经换了 —— 拿不到就安静跳过 */
    try {
      var _t = T();
      if (!_t || typeof _t.list !== 'function') return Promise.resolve(0);
    } catch (e) { return Promise.resolve(0); }
    var none = function () { return []; };
    var p = ident().then(function (u) {
      if (!u.id) return 0;
      var t = Date.now(), kill = [];
      return Promise.all([
        T().list({ hostId: u.id })['catch'](none),
        T().list({ guestId: u.id, kind: 'seat' })['catch'](none),
        T().list({ by: u.id, kind: 'win' })['catch'](none)
      ]).then(function (L) {
        var later = false, live = {};
        var sigR = function (r) { return 'r|' + num(r.heartbeatAt) + '|' + num(r.hostBeat) + '|' + r.status + '|' + (r.guestId || '') + '|' + num(r.seat); };
        var sigS = function (x) { return 's|' + num(x.guestBeat) + '|' + (x.left ? 1 : 0) + '|' + (x.acked ? 1 : 0) + '|' + (x.guestScore == null ? '' : x.guestScore); };
        (L[0] || []).forEach(function (r) { if (r && r._id) live[r._id] = sigR(r); });
        (L[1] || []).forEach(function (x) { if (x && x.roomId) live[x.roomId] = (live[x.roomId] || '') + sigS(x); });
        (L[0] || []).forEach(function (r) {
          if (!r || !r._id || r._id === _myRoomId || (r.kind && r.kind !== 'room')) return;
          var beat = num(r.heartbeatAt) || num(r.createdAt);
          if (!isMineDev(r._id)) {
            if ((t - beat) > TM.otherDevMs) { if (swSeen(r._id, sigR(r), t)) kill.push(r._id); else later = true; }
            return;
          }
          var done = r.status === 'done' && (t - (num(r.endedAt) || beat)) > TM.doneGraceMs;
          if (done || (r.status !== 'done' && (t - beat) > STALE_MS * 4)) kill.push(r._id);   /* 2 分钟以上没心跳 */
        });
        (L[1] || []).forEach(function (s) {
          if (!s || !s._id || s._id === _mySeatId || s.guestId !== u.id) return;
          var beat = num(s.guestBeat) || num(s.createdAt);
          if (!isMineDev(s._id)) {
            if ((t - beat) > TM.otherDevMs) { if (swSeen(s._id, sigS(s), t)) kill.push(s._id); else later = true; }
            return;
          }
          if ((t - beat) > Math.max(TM.doneGraceMs, STALE_MS * 4)) kill.push(s._id);
        });
        (L[2] || []).forEach(function (w) {
          if (!w || !w._id || w.by !== u.id) return;
          if (!isMineDev(w._id)) {
            /* 回合文档自己不会变：连同它那一局的房间 / 我的座位一起看（那一局还在打，心跳就在变） */
            if ((t - num(w.at)) > Math.max(TM.winTtlMs, TM.otherDevMs)) {
              if (swSeen(w._id, 'w|' + num(w.at) + '|' + (live[w.roomId] || 'gone'), t)) kill.push(w._id); else later = true;
            }
            return;
          }
          if ((t - num(w.at)) > TM.winTtlMs) kill.push(w._id);
        });
        for (var ck in _swCand) if (has(_swCand, ck) && (t - _swCand[ck].at) > 3600000) delete _swCand[ck];
        if (later || kill.length > 10) swRecheckLater();
        kill = kill.slice(0, 10);
        if (!kill.length) return 0;
        return Promise.all(kill.map(function (id) {
          return T().remove(id)['catch'](function () {});
        })).then(function () { return kill.length; });
      });
    })['catch'](function () { return 0; });
    _sweeping = p;
    var clear = function () { if (_sweeping === p) _sweeping = null; };
    p.then(clear, clear);
    return p;
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
  /* 🔴v1164（审查 SEC-4）：云端来的名字是别人自己写的 —— 可能是广告、联系方式。
     资料模块有一份统一的过滤（safeName）；它没加载时用这里的同一条规则兜底。 */
  var AD_NAME = /微信|威信|薇信|v信|vx|wx|qq|扣扣|公众号|加我|加群|进群|扫码|二维码|领皮肤|免费领|福利|红包|代练|http|www|\.com|@|\d{5,}|admin|管理员|官方|客服|系统/i;
  function cloudName(v) {
    var P = window.HansenSbProfile;
    try { if (P && typeof P.safeName === 'function') return P.safeName(v, '无名蜂'); } catch (e) {}
    var s = sText(v, 16).trim();
    if (!s) return '无名蜂';
    return AD_NAME.test(s.replace(/\s+/g, '')) ? '小蜜蜂' : s;
  }

  /* 🔴审查 F-R2-5：查询一次最多回 100 条。一个账号（同一个数据库盖的 _openid）在名额里占了好几条 =
     有人在刷房（正常孩子一个账号最多一两间）—— 把这些账号排除掉再查一次（最多补两次），真房才排得进来。
     列表本来就一个账号只显示一间，排除掉的账号在第一次查到的结果里已经有了，不会少显示谁。 */
  function listOpenRows(t0) {
    var all = [], seen = {}, skip = [];
    function keep(rows) {
      (rows || []).forEach(function (x) { if (x && x._id && !seen[x._id]) { seen[x._id] = 1; all.push(x); } });
    }
    function heavy(rows) {
      var n = {}, out = [];
      (rows || []).forEach(function (x) { var o = x && x._openid; if (typeof o === 'string' && o) n[o] = (n[o] || 0) + 1; });
      for (var k in n) if (has(n, k) && n[k] >= 2 && skip.indexOf(k) < 0) out.push(k);
      return out;
    }
    function round(n) {
      return T().listOpen(t0, skip.length ? { notOwners: skip.slice() } : undefined).then(function (rows) {
        keep(rows);
        if (n >= 2 || (rows || []).length < LIST_LIMIT) return all;
        var more = heavy(rows);
        if (!more.length) return all;
        skip = skip.concat(more).slice(0, 60);
        return round(n + 1)['catch'](function () { return all; });
      });
    }
    return round(0).then(function (rows) {
      return rows.slice().sort(function (a, b) { return (num(b && b.createdAt)) - (num(a && a.createdAt)); });
    });
  }

  /* 列出别人开着的公开房（新版协议、没满、房主还在）。
     另外数一下「同账号在别的设备开着的房」—— 一个账号两台设备永远匹配不上，界面要提醒。
     🔴审查 UI-4：这台设备自己刚关掉的房（删除还在路上 / 读有延迟）不算「别的设备」。
     🔴审查 F10：一个账号只列一间（最新的）—— 陌生人一个号开 40 间假房，也只占一格。 */
  function listRooms() {
    return ident().then(function (u) {
      /* 列房时顺手清掉自己留下的死房（不阻塞列表返回；10 分钟最多一次） */
      maybeSweep();
      return listOpenRows(Date.now()).then(function (rows) {
        var _now = Date.now(), same = 0, seenBy = {};
        pruneObs(_now);
        rows = (rows || []).filter(function (x) {
          if (!x || x.proto !== PROTO || x.kind !== 'room') return false;   /* 旧版本的房：协议不通 */
          if (x.status !== 'open' || x.isPrivate === true) return false;
          if (x.guestId) return false;                 /* 满员的点进去必然失败 */
          /* 🔴v1154：心跳过滤放本地；🔴v1164：看心跳在不在动，不拿对方的钟和本机比 */
          if (!roomAlive(x, _now)) return false;
          if (u.id && x.hostId === u.id) {             /* 自己的房点进去毫无意义 */
            if (x._id !== _myRoomId && !isMineDev(x._id)) same++;
            return false;
          }
          var by = String(x._openid || x.hostId || x._id);
          if (seenBy[by]) return false;
          seenBy[by] = 1;
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
      hostName: cloudName(x.hostName),
      hostTier: sText(x.hostTier, 12),
      wordCount: sNum(x.wordCount, 1, 50, WORDS_PER_ROUND),
      mine: false,
      ageSec: sAge(x.createdAt),
      /* 🔴v1154：天梯靠 _id / mode / hostRating 挑房，漏了它们天梯就永远匹配不到 */
      _id: sText(x._id || x.id, 40),
      mode: (x.mode === 'A' || x.mode === 'B' || x.mode === 'C') ? x.mode : 'C',
      hostRating: sNum(x.hostRating, 0, 4000, 0),
      hostElo: sNum(x.hostElo, 0, 4000, 0),
      askMode: (x.askMode === 'tts') ? 'tts' : 'cn',
      createdAt: sNum(x.createdAt, 0, 9e15, 0),    /* 天梯按它「先开的先配」 */
      isPrivate: !!x.isPrivate
    };
  }

  /* 时间戳看着过期的房：多读几次，看心跳动不动（房主手机钟慢的情况）。动了 = 活的 */
  function ensureAlive(rid, R) {
    if (roomAlive(R, Date.now())) return Promise.resolve(R);
    var n = 0, step = Math.max(10, Math.round(TM.observeMs / 3));
    function again() {
      if (n++ >= 3) return Promise.resolve(null);
      return sleep(step).then(function () { return readRoom(rid); }).then(function (R2) {
        if (!R2) return null;
        if (roomAlive(R2, Date.now())) return R2;
        return again();
      });
    }
    return again();
  }

  /* ── 进房：抢座位 + 等房主确认 ────────────────────────────────────────
     客人不能写房主的文档，所以「进房」分两步：
       ① add 一个固定 _id 的座位文档 R_s<轮次> —— 只有一个人抢得到
       ② 等房主读到座位、在自己的房间文档里写上「客人是谁」（确认）
     房主确认了才算进房；房没了 / 换了别人 / 轮次变了 → 收回座位、说清原因。
     opts.code：私密房的房间码（审查 SEC-7：以前知道房号就能绕过码直接进私密房）。
     opts.onWait(info)：等房主确认时的进展（{hostAway:true} 房主暂时切出去了），界面拿去换一句话。
     🔴审查第二轮（F-R2-2）：
       · 每一次进房各有自己的取消标记 —— 以前按房号记一个，点了取消再马上点同一间房，
         新的那次把「已取消」改回了「进房中」，取消掉的那次接着跑、在座位上写了「回话」「离开」；
       · 同一间房的两次进房一个接一个来：上一次（含收回座位）收完了，下一次才去占座 ——
         两次用的是同一个座位号，收尾那一下不能删掉新的那一次刚占到的座位。 */
  var _joinToks = {};    /* roomId → [这间房正在进行的每一次进房的取消标记] */
  var _joinTail = {};    /* roomId → 上一次进房（含收尾）结束的 Promise */
  var _seatGone = {};    /* roomId → 最近一次收回我在这间房的座位（删除）的 Promise */
  function cancelJoins(rid) { (_joinToks[rid] || []).forEach(function (t) { t.cancel = true; }); }
  function joiningAny(rid) { return !!(_joinToks[rid] && _joinToks[rid].length); }
  /* 🔴联机压力测试 R9b：先读一眼、nonce 是我那一份才删 —— 以前按 _id 直接删：结果待定 / 已取消时，这个座位号上
     常常已经是别人的座位（数据库会拒，可这正是「只写自己的文档」要杜绝的写法；权限一旦配错就真把别人的座位删了）。
     读到是我的，就一直是我的（别人删不掉），所以「读完再删」没有空档。 */
  function removeSeat(rid, sid, nonce0) {
    /* 读不到（主从延迟：刚写的我自己那份还没同步过来）就隔一会儿再读，最多三次 */
    var tryRead = function (n) {
      return T().read(sid).then(function (d) {
        if (d && d.nonce === nonce0) return T().remove(sid);
        if (!d && n > 0) return sleep(TM.lagMs * (4 - n)).then(function () { return tryRead(n - 1); });
      });
    };
    var p = (nonce0 ? tryRead(3) : T().remove(sid)).then(noop, noop);
    _seatGone[rid] = p;
    return p;
  }
  function hiddenNow() { try { return document.visibilityState === 'hidden'; } catch (e) { return false; } }

  function joinRoom(roomId, opts) {
    opts = opts || {};
    if (!roomId) return Promise.resolve(failK('other', '房间号为空'));
    /* 从这一刻起就能取消（审查 UI-3：以前抢座还在路上时点取消没用） */
    var tok = { cancel: false };
    (_joinToks[roomId] = _joinToks[roomId] || []).push(tok);
    var prev = Promise.all([_joinTail[roomId] || null, _seatGone[roomId] || null]);
    var run = prev.then(function () { return joinOnce(roomId, opts, tok); })
      .then(null, function (e) { return fail(e); });
    var tail = run.then(noop, noop);
    _joinTail[roomId] = tail;
    var finish = function () {
      var L = _joinToks[roomId] || [], i = L.indexOf(tok);
      if (i >= 0) L.splice(i, 1);
      if (!L.length) delete _joinToks[roomId];
      if (_joinTail[roomId] === tail) delete _joinTail[roomId];
    };
    run.then(finish, finish);
    return run;
  }
  function joinOnce(roomId, opts, tok) {
    var cancelled = function () { return failK('other', '已经退出这间房了', '', { cancelled: true }); };
    if (tok.cancel) return Promise.resolve(cancelled());
    return ident().then(function (u) {
      return readRoomLag(roomId).then(function (R) {
        if (tok.cancel) return cancelled();
        if (!R) return failK('gone', HUMAN.gone, '房间已不存在');
        if (R.proto !== PROTO || R.kind !== 'room') return failK('gone', '这间房是旧版本开的，换一间吧');
        if (u.id && R.hostId === u.id) return failK('self', HUMAN.self);
        if (R.status === 'done') return failK('gone', '这一局已经结束了，换一间吧');
        if (R.status === 'away') return failK('gone', '房主暂时离开了，换一间吧');
        if (R.guestId || R.status !== 'open') return failK('taken', HUMAN.taken);
        var code = String(opts.code || '').trim().toUpperCase();
        if (R.isPrivate && (!code || codeHash(code) !== R.codeH)) {
          return failK('gone', '这是私密房，要输对朋友给的房间码才能进');
        }
        /* 🔴v1163：房间里的词数夹在 1~30；取不到词就先别占座 */
        var _ws = wordsFromSeed(R.seed, capOf(R));
        if (!_ws || !_ws.length) return failK('other', '词库还没加载好，刷新一下页面再进房');
        /* 🔴v1135：房主已经跑了就别让人进；🔴v1164：时间戳看着过期时先看看心跳动不动（钟慢的房主） */
        return ensureAlive(roomId, R).then(function (RA) {
          if (tok.cancel) return cancelled();
          if (!RA) return failK('gone', '房主已经离开了，换一间吧');
          return grabSeat(roomId, RA, u, opts, code, _ws, tok);
        });
      });
    });
  }

  /* 抢座位 → 等房主确认（「进房」的后半段） */
  function grabSeat(roomId, R, u, opts, code, _ws, tok) {
    var ep = num(R.seat), seat = null;
    var cancelled = function () { return failK('other', '已经退出这间房了', '', { cancelled: true }); };
    function mkSeat() {
      var t = Date.now(), sid = seatIdOf(roomId, ep);
      return {
        _id: sid, proto: PROTO, kind: 'seat', nonce: nonce(),
        roomId: roomId, epoch: ep,
        guestId: u.id, guestName: u.name, guestRating: myRating(opts.rating),
        proof: code ? codeProof(code, sid) : '',
        createdAt: t, guestBeat: t,
        guestReady: false, guestReadyAt: 0, guestScore: null, left: false, abandonWin: ''
      };
    }
    /* 座位被占时再读几次房间：读到的可能是旧快照，房主其实已经换了新轮次（死座位）。
       🔴审查 F-R2-4：占着座位号的是一条「不是座位」的东西（陌生人塞的）→ 房主下一轮（2~3 秒）就会换号，多等一会儿 */
    function grab(retries) {
      seat = mkSeat();
      return claim(seat, { stop: function () { return tok.cancel; } }).then(function (c) {
        if (c.mine || (c.unknown && !c.junk) || retries <= 0 || tok.cancel) return c;
        var look = function (n) {
          return sleep(TM.lagMs).then(function () { return tok.cancel ? null : readRoom(roomId); }).then(function (R2) {
            if (tok.cancel || !R2) return c;
            if (!R2.guestId && R2.status === 'open' && num(R2.seat) > ep) { ep = num(R2.seat); return grab(retries - 1); }
            return (n > 1 && !R2.guestId) ? look(n - 1) : c;
          });
        };
        return look(c.junk ? 10 : 2);
      });
    }
    return grab(2).then(function (c) {
      if (!c.mine) {
        /* 🔴审查 F1 / F-R2-2：结果待定（多半是别人的还没同步过来，也可能回包丢了其实是我的）、或者已经取消了 →
           顺手收回 —— 别人的座位删不掉，删了也无妨；**等它删完**再往下走，下一次进房才不会被它挡住 */
        var rm = (c.unknown || tok.cancel) ? removeSeat(roomId, seat._id, seat.nonce) : Promise.resolve();
        return rm.then(function () {
          if (tok.cancel) return cancelled();
          if (c.unknown) {
            var ek = kindOf(c.err);
            if (ek === 'network' || ek === 'slow' || ek === 'config' || ek === 'session') return fail(c.err);
            return failK('taken', HUMAN.taken, rawText(c.err).slice(0, 120));
          }
          return failK('taken', HUMAN.taken);
        });
      }
      noteMine(seat._id);
      if (tok.cancel) return removeSeat(roomId, seat._id).then(cancelled);   /* 刚 add 成功的就是我的：直接删 */
      /* 🔴v1136：进别人的房之前，先收掉自己开着的那间（否则别人进去房主不在） */
      if (_myRoomId && _myRoomId !== roomId) leaveMine();
      setMine(roomId, 'guest', seat._id, false);
      /* 🔴联机压力测试 R1：同一间房换了轮次再进（对手没来、又被配回这间）—— 上一局合并缓存里的回合、比分、离场判定
         不能带进这一局（以前直接沿用：上一局「我拼对的词」这一局不写文档就算赢，两部手机比分对不上） */
      delete _rc[roomId];
      var c0 = rc(roomId);
      c0.meta = R; c0.ep = ep; c0.mySeat = seat._id;
      /* v1104：客人也发心跳（写自己的座位），房主才知道客人还在 */
      startHeartbeat(roomId);
      return waitAck(roomId, u, ep, seat, tok, opts).then(function (res) {
        if (!res.ok) return res;
        if (_myRoomId === roomId) _myStarted = true;
        return { ok: true, roomId: roomId, room: view(roomId, res.R, seat),
                 words: _ws, mySide: 'guest' };
      });
    });
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
      if (guest && _myStarted) patch.acked = true;   /* 回话没写上的话，心跳顺手再说一次 */
      T().patch(id, patch).then(function (r) {
        if (r && r.updated === 0) { hbMiss++; if (hbMiss >= 3) stopHeartbeat(); return; }
        hbMiss = 0;
      })['catch'](function () {});
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() { if (_hb) { clearInterval(_hb); _hb = null; } _hbRoom = ''; }

  /* 客人等房主确认（读房主的房间文档，看「客人」那一栏是不是我）。
     🔴审查 F6：主从延迟大时 15 秒不够（房主读到座位要几秒、我读到确认又要几秒）——
       给 25 秒；等的时候看到房主心跳在动（他还在），再多给 10 秒。
     🔴审查第二轮：
       · 房主确认的是**上一个坐这个座位的人**（他刚走、我刚坐下，F-R2-2）：房主下一次读到座位就会改成我，
         或者换号 —— 等一会儿；一直是别人（20 秒）才算被占了；换了号 = 被占了。
       · 房主暂时切出去了（away，R2-UI-3）：私密房的朋友多半是在等他发完码回来 —— 多等一分钟，并告诉界面。
       · 我自己切到后台了：先别「回话」（回话 = 开打），回来再说 —— 不然一局在后台开打，对面一个人打。 */
  function waitAck(rid, u, ep, seat, tok, opts) {
    var t0 = Date.now(), lastBeat = t0, miss = 0, lastErr = null;
    var budget = TM.ackMs, hb0 = null, extended = false, awaySeen = false, otherAt = 0;
    function giveUp(res, removed) {
      if (_myRoomId === rid && _myRole === 'guest') { stopHeartbeat(); setMine('', '', '', false); }
      /* 🔴L14：失败后一定收回座位，不留孤儿文档（退出时 leaveMine 已经删过就不再删）；等它删完再返回 */
      return (removed ? Promise.resolve() : removeSeat(rid, seat._id)).then(function () { return res; });   /* 我 add 成功的那份 */
    }
    function cancelled() { return giveUp(failK('other', '已经退出这间房了', '', { cancelled: true }), true); }
    function tick() {
      if (tok.cancel) return cancelled();
      return readRoom(rid).then(function (R) {
        lastErr = null;
        if (!R) { miss++; return miss >= 3 ? giveUp(failK('gone', '房主已经离开了，换一间吧')) : null; }
        miss = 0;
        rc(rid).meta = R;
        var hb = num(R.heartbeatAt) || num(R.hostBeat);
        if (hb0 == null) hb0 = hb;
        else if (!extended && hb !== hb0) { extended = true; budget = Math.max(budget, TM.ackMs + TM.ackExtraMs); }
        if (tok.cancel) return null;   /* 已经点了退出：确认来了也不进 */
        if ((R.away || R.status === 'away') && !awaySeen) {
          awaySeen = true;
          budget = Math.max(budget, (Date.now() - t0) + TM.awayAckMs);
          try { if (typeof opts.onWait === 'function') opts.onWait({ hostAway: true }); } catch (e) {}
        }
        if (R.guestId === u.id && num(R.seat) === ep) {
          if (hiddenNow()) return null;   /* 我在后台：先不回话，回来再说 */
          /* 回个话：房主看到 acked 才开打（它读到的座位可能是旧的） */
          var ta = Date.now();
          retry3(function () { return T().patch(seat._id, { acked: true, ackedAt: ta, guestBeat: ta }); })['catch'](function () {});
          return { ok: true, R: R };
        }
        if (R.status === 'done') return giveUp(failK('gone', '这一局已经结束了，换一间吧'));
        if (num(R.seat) > ep) return giveUp(failK('taken', HUMAN.taken));
        if (R.guestId && R.guestId !== u.id) {
          if (!otherAt) otherAt = Date.now();
          if (Date.now() - otherAt > TM.seatStaleMs) return giveUp(failK('taken', HUMAN.taken));
        } else otherAt = 0;
        return null;
      }, function (e) { lastErr = e; return null; }).then(function (res) {
        if (tok.cancel) return cancelled();
        if (res) return res;
        var t = Date.now();
        if (t - t0 > budget) {
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
       房主 · 还没人进        → 删房
       房主 · 已写确认 / 已开打 → 房间标 done（留着，客人可能已经进了对战屏，要读到「房主走了」；
                                 过了宽限期由清理删）—— 审查 F3：以前确认写了、客人回话还没到时点「关掉房间」
                                 会直接删房，客人那边一整局都只看到「网络不稳」
       客人 · 还没确认        → 删自己的座位
       客人 · 已开打          → 座位标 left（同样留着给房主读） */
  /* 🔴联机压力测试 R11：每次离开一间房记一笔 —— 还在路上的 markReady 回来时，看到这间房已经离开过就不再「复活」它 */
  var _leftGen = {};
  function noteLeft(id) { if (id) _leftGen[id] = (_leftGen[id] || 0) + 1; }
  function leaveMine() {
    var id = _myRoomId, role = _myRole, sid = _mySeatId, started = _myStarted;
    if (!id) return Promise.resolve({ ok: true });
    noteLeft(id);
    if (_hbRoom === id) stopHeartbeat();
    setMine('', '', '', false);
    cancelJoins(id);
    var t = Date.now(), c = rc(id), p, acked = !!_myAcked[id];
    delete _myAcked[id];
    /* 🔴审查 F-R2-1 / FX-5：交了卷马上点「先离开」—— 交卷那一下（reportResult）可能还在路上。
       以前这里只看「交卷写成功了没有」（c.hs），没写完就记成「中途走了」（endedBy:'leave'），
       对手最后一词拼对了也被拒收、这一局判成对手「对方离场」。现在：交了卷的分（c.fin，交卷时当场记下）
       和「走了」**写在同一次里** —— 要么都写上、要么都没写上，不会出现「走了、却没交卷」 */
    var fin = (role === 'host') ? (c.hs != null ? c.hs : c.fin) : (c.gs != null ? c.gs : c.fin);
    var withFin = function (o, field, have) { if (fin != null && have == null) o[field] = fin; return o; };
    if (role === 'host') {
      if (!started && !acked) p = T().remove(id);
      else if (c.rank >= 2) p = T().patch(id, withFin({ endedAt: t, heartbeatAt: t }, 'hostScore', c.hs));
      else p = T().patch(id, withFin({ status: 'done', endedAt: t, heartbeatAt: t,
                                       endedBy: (fin != null) ? 'finished' : 'leave' }, 'hostScore', c.hs));
    } else {
      if (started) p = T().patch(sid, withFin({ left: true, leftAt: t, guestBeat: t }, 'guestScore', c.gs));
      else { p = T().remove(sid); _seatGone[id] = p.then(noop, noop); }   /* 下一次进这间房要等它删完 */
    }
    return p.then(function () { return { ok: true }; }, function (e) { return fail(e); });
  }

  function leaveRoom(roomId) {
    var id = roomId || _myRoomId;
    if (!id) return Promise.resolve({ ok: true });
    noteLeft(id);
    if (id === _myRoomId && _myRole) return leaveMine();
    cancelJoins(id);
    /* 不是本机记着的那间：读一下，按身份只收自己的文档 */
    return ident().then(function (u) {
      return readRoom(id).then(function (R) {
        if (!R) return { ok: true };
        var t = Date.now();
        if (R.hostId === u.id) {
          if (!R.guestId && (R.status === 'open' || R.status === 'away')) return T().remove(id);
          if (R.status === 'done') return null;
          return T().patch(id, { status: 'done', endedAt: t, heartbeatAt: t,
                                 endedBy: (R.hostScore != null) ? 'finished' : 'leave' });
        }
        var sid = seatIdOf(id, num(R.seat));
        return T().read(sid).then(function (S) {
          if (!S || S.kind !== 'seat' || S.guestId !== u.id) return null;
          if (R.guestId === u.id) return T().patch(sid, { left: true, leftAt: t, guestBeat: t });
          return removeSeat(id, sid, S.nonce);
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
     每一轮：一次读回自己的房间 + 当前轮次的座位。
       座位在、人还在 → 在房间里写上客人（确认）→ 等客人回话 → {joined}
       座位标了离开 / 心跳 20 秒不动 / 私密房凭证不对 → 换一个轮次号（别人的座位删不掉）
     天梯（opts.ladder）：每 3 轮扫一次列表，发现**更早开的**合适的房 → {switchTo}，
       由界面退出自己的房去进那间。两个人同时开房时，按「先开的赢」收敛到同一间。
     🔴v1137：轮询间隔递增（省读次数）；网络抖一下不放弃，连续失败 3 次才报错。
     🔴v1164（审查 F6）：自己刚建的房 20 秒内读不到不算没了；间隔最长 3 秒（以前 5 秒，客人等确认会超时）。
     🔴v1164（审查 F10）：换轮次号时随机跳一段 —— 陌生人预先占好一串座位号也堵不住门。 */
  function waitForOpponent(roomId, onChange, timeoutMs, opts) {
    opts = opts || {};
    var missCount = 0;   /* v1163: 连续读不到房间的次数（最终一致：读不到 ≠ 不存在） */
    var stop = false, t0 = Date.now();
    var limit = timeoutMs || 120000;
    var fails = 0, ticks = 0, epoch = -1, seen = null;
    var pend = null;     /* 已经写了确认、还在等客人「回个话」 */
    var dropped = {};    /* 刚撤回确认的客人 → 时刻（旧快照里还挂着他，别又当成「确认过的」） */
    var lad = opts.ladder || null;
    var c0 = rc(roomId);
    /* 🔴审查 R2-UI-3：房主切到别的 App 时**不收人** —— 以前照样确认、在后台开打，进来的孩子对着空气打完一局，
       还要再干等 5 分钟交卷。暂停时：公开房 / 排位房先下架（status:'away'，列表里看不到、进不来）；
       私密房还能按码找到（房主多半是切到微信发码去了），朋友先占着座位等，房主回来再点头。 */
    var paused = false, pausedAt = 0;

    function nextDelay() {
      var waited = Date.now() - t0, b = TM.waitPollMs;
      return waited < 10000 ? b : (waited < 40000 ? Math.round(b * 1.25) : Math.round(b * 1.5));
    }
    function emit(ev) {
      if (stop) return;
      stop = true;
      try { onChange(ev); } catch (e) {}
    }
    /* 🔴v1163：递归式轮询 —— 每条提前 return 之前都要先把下一棒交出去 */
    function again(ms) { if (!stop) setTimeout(tick, ms == null ? nextDelay() : ms); }
    function jump() { return epoch + 1 + Math.floor(Math.random() * 1000); }

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
    /* 私密房：客人得交出只有知道房间码才算得出来的凭证 */
    function proofOk(R, S) {
      if (!R || !R.isPrivate) return true;
      var code = _myCodes[roomId];
      if (!code) return true;
      return S.proof === codeProof(code, S._id);
    }
    function joined(R, S) {
      setMine(roomId, 'host', '', true);
      rc(roomId).ep = epoch;
      emit({ joined: true, room: view(roomId, R, S) });
    }
    function merged(R, p) {
      var R2 = {}, k;
      for (k in R) R2[k] = R[k];
      for (k in (p || {})) R2[k] = p[k];
      return R2;
    }
    function ack(R, S) {
      var t = Date.now();
      var p = { status: 'playing', guestId: String(S.guestId), guestName: sText(S.guestName, 16),
                guestRating: sNum(S.guestRating, 0, 4000, 0), seat: epoch,
                startedAt: t, heartbeatAt: t, hostBeat: t };
      return T().patch(roomId, p).then(function (r) {
        if (stop) return;
        if (r && r.updated === 0) { again(); return; }
        _myAcked[roomId] = 1;
        /* 🔴v1164：确认写进去了还不算数 —— 我读到的座位可能是旧快照（客人其实已经点了返回）。
           等客人回个话（座位上写 acked / 就绪）才开打；座位没了、一直不回话就撤回确认、重新开门。
           「心跳在动」不算回话：读有延迟时，旧快照里的心跳也会「动」。 */
        pend = { gid: String(S.guestId), at: Date.now(), miss: 0, R: merged(R, p) };
        again(TM.ackPollMs);
      });
    }
    function bump() {
      var nx = jump(), t = Date.now();
      return T().patch(roomId, { seat: nx, heartbeatAt: t, hostBeat: t }).then(function () {
        epoch = nx; seen = null; again();
      });
    }
    function forget() {
      if (pend) dropped[pend.gid] = Date.now();
      seen = null; pend = null;
      delete _myAcked[roomId];
      var c = rc(roomId); c.guestId = ''; c.seat = null; c.rank = 0;
    }
    /* 撤回确认：房间重新开门，换一个座位号（走掉的人的座位删不掉）。extra：暂停时顺手下架 */
    function unack(extra) {
      var nx = jump(), t = Date.now();
      var p = { status: 'open', guestId: '', guestName: '', guestRating: 0, seat: nx,
                startedAt: 0, heartbeatAt: t, hostBeat: t };
      for (var k in (extra || {})) if (has(extra, k)) p[k] = extra[k];
      return T().patch(roomId, p).then(function () {
        epoch = nx; forget();
        again();
      });
    }
    /* 🔴审查 F-R2-2：我确认的那个人走了（他的座位删了），另一个孩子马上坐上了同一个座位 ——
       撤回对上一个人的确认，但**不换座位号**（这个座位现在是新来的人的），下一轮按新来的人重新判。
       以前一律换号：新来的孩子明明坐着空座位，却被告知「这间房刚被别人占了」。 */
    function reopen() {
      var t = Date.now();
      return T().patch(roomId, { status: 'open', guestId: '', guestName: '', guestRating: 0,
                                 startedAt: 0, heartbeatAt: t, hostBeat: t }).then(function () {
        forget();
        again(TM.ackPollMs);
      });
    }
    function confirm(R, S, u) {
      var ok = isSeatDoc(S, roomId, epoch) && S.guestId === pend.gid;
      if (ok && S.left) return unack();
      if (ok) {
        pend.miss = 0;
        if (S.acked || S.guestReady) { joined(R.guestId ? R : pend.R, S); return; }
        if (Date.now() - pend.at > TM.seatStaleMs) return unack();   /* 一直不回话 = 人不在了 */
        again(TM.ackPollMs); return;
      }
      if (isSeatDoc(S, roomId, epoch) && !S.left && S.guestId !== pend.gid && !(u && u.id && S.guestId === u.id)) return reopen();
      if (++pend.miss >= 3) return unack();   /* 座位读不到 3 次 = 客人已经走了 */
      again(TM.ackPollMs);
    }
    function older(a, b) {
      var ca = num(a.createdAt), cb = num(b.createdAt);
      return ca < cb || (ca === cb && String(a._id) < String(b._id));
    }
    function rescan(u, R) {
      return listOpenRows(Date.now()).then(function (rows) {
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
    /* 房间 + 当前轮次的座位，一次读回来（轮次刚变过时再补读一次座位） */
    function readBoth() {
      var e0 = Math.max(epoch, 0);
      return fetchMany([roomId, seatIdOf(roomId, e0)]).then(function (g) {
        var R = isRoomDoc(g.map[roomId], roomId) ? g.map[roomId] : null;
        if (!R) return { R: null };
        var ep = Math.max(epoch, num(R.seat));
        if (ep === e0) return { R: R, S: g.map[seatIdOf(roomId, e0)], ep: ep };
        return T().read(seatIdOf(roomId, ep)).then(function (S) { return { R: R, S: S, ep: ep }; });
      });
    }

    function tick() {
      if (stop) return;
      if (paused) { setTimeout(tick, 1000); return; }   /* 房主在别的 App：不读、不收人，回来接着来 */
      ticks++;
      ident().then(function (u) {
        return readBoth().then(function (P) {
          if (stop) return;
          if (paused) { again(1000); return; }
          fails = 0;
          var R = P.R;
          if (!R) {
            if (c0.createdLocal && Date.now() - c0.createdLocal < TM.ownGraceMs) { again(); return; }
            missCount++;
            if (missCount >= 3) { emit({ gone: true }); return; }
            again(); return;
          }
          missCount = 0;
          rc(roomId).meta = R;
          if (R.status === 'done') { emit({ gone: true }); return; }
          epoch = P.ep;
          var S = P.S;
          var ok = isSeatDoc(S, roomId, epoch);
          /* 确认已经写进去了（可能是上一轮回包丢了）→ 同样等客人回话；guestId 只有我自己会写
             （刚撤回的那个人除外 —— 旧快照里还挂着他） */
          var gd = String(R.guestId || '');
          if (!pend && gd && num(R.seat) === epoch && !(dropped[gd] && Date.now() - dropped[gd] < 15000)) {
            pend = { gid: gd, at: Date.now(), miss: 0, R: R };
            _myAcked[roomId] = 1;
          }
          if (pend) return confirm(R, S, u);
          /* 🔴联机压力测试 R6：两分钟的等人上限在「有座位冒出来」时也要算 —— 以前只在「没有座位」那条路上判，
             一直有不回话的座位冒出来（有人反复占新轮次的座位）时房主永远等下去（实测 13 分钟以上）。
             正在等客人回话的（上一行）不受影响；房主切出去暂停的那段时间不算（见 resume）。 */
          if (Date.now() - t0 > limit) { emit({ timeout: true }); leaveRoom(roomId); return; }
          if (ok && S.guestId !== u.id) {
            if (!proofOk(R, S)) return bump();   /* 私密房：没拿码就想进来的 */
            var d = judgeSeat(S);
            if (d === 'ack') return ack(R, S);
            if (d === 'stale') return bump();
            again(); return;
          }
          if (ok) return bump();   /* 同账号别的设备占的座：不能自己打自己 */
          /* 🔴审查 F-R2-4：这个座位号被一条「根本不是座位」的东西占了（陌生人塞的，只要一次写入）——
             以前房主从来不换号，客人个个被告知「被别人占了」，这间房就再也进不来。换个号接着等 */
          if (S) return bump();
          if (Date.now() - t0 > limit) {
            /* 等不到人就收房 —— 否则留下一间「看得见、进去没人」的幽灵房 */
            emit({ timeout: true });
            leaveRoom(roomId);
            return;
          }
          if (lad && ticks % 3 === 0) return rescan(u, R);
          again();
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
    var cancel = function () { stop = true; };
    /* 界面在页面切到后台 / 回到前台时调（审查 R2-UI-3） */
    cancel.pause = function () {
      if (stop || paused) return;
      paused = true; pausedAt = Date.now();
      var t = Date.now(), priv = !!(c0.meta && c0.meta.isPrivate);
      var away = priv ? { away: true, awayAt: t, heartbeatAt: t, hostBeat: t }
                      : { status: 'away', away: true, awayAt: t, heartbeatAt: t, hostBeat: t };
      /* 已经点了头、还在等客人回话：撤回（客人那边会自己再找）；没点头：只下架 */
      var p = pend ? unack(away) : T().patch(roomId, away);
      Promise.resolve(p)['catch'](noop);
    };
    cancel.resume = function () {
      if (stop || !paused) return;
      paused = false;
      if (pausedAt) { t0 += Date.now() - pausedAt; pausedAt = 0; }   /* 切出去的那段时间不算进两分钟 */
      seen = null;     /* 回来以后重新看座位：心跳在动的才收 */
      var t = Date.now();
      T().patch(roomId, { status: 'open', away: false, awayAt: 0, heartbeatAt: t, hostBeat: t })['catch'](noop);
    };
    cancel.paused = function () { return paused; };
    return cancel;
  }

  /* ── 🔴v1104 对手离场判定 ─────────────────────────────────────────────
     🔴v1164：**不拿对方手机的时间和本机比**（两台手机差几分钟很常见）。
     记住对手心跳的「值」和本机看到它变化的时刻：本机时钟上超过 1 分钟没变 → 离场。
     判定顺序（审查 F2/F3/F4/F11）：
       ① 已经有人判了「离场」→ 按那个结论（我被判了负就是负；两边都判了 = 这局不算）
       ② 我被房主撤回了（他换了别的客人）→ 不是我的这一局，没有输赢
       ③ 对手已交卷 = 正常打完；④ 对手明确离开 → 立刻算
       ⑤ 心跳 1 分钟没动 → 离场。**我自己断网的那段时间不算在对手头上**（两边同时断网 70 秒，以前两边都判自己赢）
     对战中房间被删了（房主那边已经收了）→ 客人这边说清楚「房主走了」，不再一整局挂「网络不稳」。 */
  function opponentGone(roomId) {
    return ident().then(function (u) {
      var c = rc(roomId);
      var L0 = c.lastL;
      var p = (L0 && Date.now() - L0.at < 2500) ? Promise.resolve(L0) : loadView(roomId);
      return p.then(function (L) {
        var v = view(roomId, null, null), host = (v.hostId === u.id), t = Date.now();
        var my = host ? 'host' : 'guest';
        var lim = Math.round(ABANDON_MS / 1000);
        /* 审查 R2-UI-5：顺便说一声「对手进没进过对战屏」（报过到 / 答过词）—— 界面据此分清「对手没进来」和「对手中途走了」 */
        var seenOpp = !!(host ? (v.guestReady || v.guestAns >= 0 || v.guestPts > 0) : (v.hostReady || v.hostAns >= 0 || v.hostPts > 0));
        for (var wi = 0; !seenOpp && wi < v.winners.length; wi++) if (v.winners[wi] && v.winners[wi] !== my) seenOpp = true;
        var out = function (o) { o.ok = true; o.idleSecs = o.idleSecs || 0; o.limitSecs = lim; o.oppSeen = seenOpp; return o; };
        if (v.abandonWin === 'both') return out({ gone: false, ended: true, endedBy: 'abandon', abandonWin: 'both', void: true });
        if (v.abandonWin && v.abandonWin !== my) return out({ gone: false, ended: true, endedBy: 'abandon', abandonWin: v.abandonWin });
        if (v.abandonWin === my) return out({ gone: true, mine: true, abandonWin: my });
        /* v1163：「对手离场」的前提是对手曾经在过 —— 还没人进来就谈不上 */
        if (host && !v.guestId) return out({ gone: false, waitingForGuest: true });
        if (!host && L.fresh && c._kickL !== L) {
          /* 房主撤回了确认（他读不到我的座位、以为我走了）或换了别人：连续 3 次新鲜读到才算 */
          c._kickL = L;
          var rS = num(L.R.seat), rG = String(L.R.guestId || ''), me = matchEp(c);
          c.kick = ((rS > me) || (rS === me && rG && rG !== u.id)) ? (c.kick || 0) + 1 : 0;
        }
        if (!host && c.kick >= 3) return out({ gone: false, kicked: true });
        if (host ? v.guestScore != null : v.hostScore != null) return out({ gone: false, oppFinished: true });
        if (host) {
          if (c._missL !== L) { c._missL = L; if (L.S && L.S.guestId === v.guestId) c.missS = 0; else if (!L.sErr) c.missS++; }
          if (v.guestLeft || c.missS >= 3) return out({ gone: true, left: true });
        } else if (v.status === 'done' && v.endedBy !== 'finished' && v.endedBy !== 'abandon') {
          return out({ gone: true, left: true });
        }
        var side = host ? 'g' : 'h', beat = host ? v.guestBeat : v.hostBeat;
        var o = c.opp[side];
        if (!o || o.val !== beat) o = c.opp[side] = { val: beat, at: t };
        if (c.outageAt && o.at < c.outageAt) o.at = c.outageAt;   /* 我断网的那段时间不算 */
        var idle = t - o.at;
        return out({ gone: idle > ABANDON_MS, idleSecs: Math.round(idle / 1000) });
      });
    }).then(null, function (e) {
      var c = rc(roomId), u = meSync();
      if (kindOf(e) === 'gone' && c.meta && (!u.id || c.meta.hostId !== u.id)) {
        return { ok: true, gone: true, left: true, roomGone: true, idleSecs: 0, limitSecs: Math.round(ABANDON_MS / 1000) };
      }
      return fail(e);
    });
  }

  /* 对手离场 → 本局记为我方胜（只写自己的文档；对方得 0 分由合并视图推出来）。
     🔴审查 F4：写完隔一会儿再读一次 —— 对手同时也判了我离场（两边都断过网）→ 这局不算（void），
     两边看到同一个结论，不会两个人都拿一场胜。 */
  /* 两边都交了真分数（不是判离场写的那个 1）：{mine, theirs}；否则 null —— 看原始文档（缓存里判离场时补过 0） */
  function realScores(L, host) {
    if (!L || !L.R) return null;
    var R = L.R, S = L.S;
    var hs = (R.hostScore != null && R.endedBy !== 'abandon' && !R.abandonWin) ? Number(R.hostScore) || 0 : null;
    var gs = (S && S.guestScore != null && !S.abandonWin) ? Number(S.guestScore) || 0 : null;
    if (hs == null || gs == null) return null;
    return host ? { mine: hs, theirs: gs } : { mine: gs, theirs: hs };
  }
  function claimAbandonWin(roomId, opt) {
    return ident().then(function (u) {
      return loadView(roomId).then(function (L) {
        var t = Date.now(), c = rc(roomId), host = (L.v.hostId === u.id), my = host ? 'host' : 'guest';
        if (L.v.abandonWin && L.v.abandonWin !== my) return { pre: L.v.abandonWin };
        /* 🔴联机压力测试（R3 续）：对手其实已经交了卷（真分数）—— 他是交完卷才不见的（或者刚回来交上）：
           按两边的真分数算，不判他离场（以前照判：对手那边按真分数已经是「你赢了」，两边都赢） */
        /* 判离场之前先看清楚：两边其实都交了卷（真分数都在）—— 那就按真分数算（两边都会算出同一个结论），不判离场。
           主从延迟下刚交的卷可能读不到：读到为止，最多再读三次（1.5 秒、3 秒、3 秒）。
           以前直接判：对手那边已经按真分数「你赢了」，我这边「对手离场，你赢了」—— 两边都赢 */
        var real0 = realScores(L, host);
        if (real0) return { real: real0 };
        /* 我自己还没交卷（对战中判的离场）：不会有「两边都交了卷」这回事，不用多等 */
        var mineIn = host ? (L.R && L.R.hostScore != null && L.R.endedBy !== 'abandon') : (L.S && L.S.guestScore != null && !L.S.abandonWin);
        var looks = mineIn ? [TM.verdictMs, 3000, 3000] : [];
        /* 🔴联机压力测试（R3 再续）：等交卷时判离场，判之前对手又回来了（冻住 / 切后台一分多钟以后，心跳又变了）——
           他正要交卷：先不判，告诉界面接着等（opt.allowBack：界面会接着等的才这么问；不问的照旧）。
           以前照判：他回来马上交了卷、按真分数是「你赢了」，我这边读得晚（主从延迟）、判他离场也是「你赢了」—— 两边都赢。
           「变了」= 和 opponentGone 上次看到的心跳不一样（不比两台手机的钟） */
        var oSide = host ? 'g' : 'h', o0 = (c.opp && c.opp[oSide]) ? c.opp[oSide].val : undefined;
        var canBack = !!(mineIn && opt && opt.allowBack && o0 !== undefined);
        var isBack = function (Lx) {
          var b = (Lx && Lx.v) ? (host ? Lx.v.guestBeat : Lx.v.hostBeat) : undefined;
          return canBack && b != null && b !== o0;
        };
        if (isBack(L)) return { back: true };
        var peek = function (k) {
          if (k >= looks.length) return Promise.resolve(null);
          return sleep(looks[k]).then(function () { return loadView(roomId)['catch'](function () { return null; }); }).then(function (L2) {
            var r2 = realScores(L2, host);
            if (r2) return r2;
            if (L2 && L2.v.abandonWin && L2.v.abandonWin !== my) return { pre: L2.v.abandonWin };
            if (isBack(L2)) return { back: true };
            return peek(k + 1);
          });
        };
        return peek(0).then(function (seen) {
          if (seen && seen.back) return { back: true };
          if (seen && seen.pre) return { pre: seen.pre };
          if (seen) return { real: seen };
          return doClaim();
        });
        function doClaim() {
        var w; t = Date.now();
        if (host) {
          c.hs = 1; c.gs = (c.gs == null) ? 0 : c.gs; c.rank = 2; c.awH = true;
          w = patchOwn(roomId, { status: 'done', endedBy: 'abandon', abandonWin: 'host',
                                 hostScore: 1, endedAt: t, heartbeatAt: t, hostBeat: t });
        } else {
          c.gs = 1; c.hs = (c.hs == null) ? 0 : c.hs; c.awG = true;
          w = patchOwn(mySeatId(roomId, L.R), { abandonWin: 'guest', guestScore: 1, guestBeat: t });
        }
        return w.then(function () { return sleep(TM.verdictMs); })
          .then(function () { return loadView(roomId)['catch'](function () { return null; }); })
          .then(function () { return { my: my }; });
        }
      }).then(function (o) {
        var aw = view(roomId, null, null).abandonWin;
        /* 对手又回来了：没判，接着等他交卷（只有 opt.allowBack 才会这样） */
        if (o.back) return { ok: true, back: true };
        /* 写完再读那一下看到对手的真分数（他先交的卷、我读得晚）：同样按真分数算 —— 两边结论一致 */
        if (o.real) return { ok: true, real: true, mine: o.real.mine, theirs: o.real.theirs,
                             result: o.real.mine > o.real.theirs ? 'win' : (o.real.mine < o.real.theirs ? 'lose' : 'draw') };
        if (o.pre) return o.pre === 'both' ? { ok: true, result: 'void', byAbandon: true, void: true }
                                           : { ok: true, result: 'lose', byAbandon: true };
        if (aw === 'both') return { ok: true, result: 'void', byAbandon: true, void: true };
        return { ok: true, result: 'win', byAbandon: true };
      });
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
     现在每一词一个固定 _id 的回合文档，谁先 add 成功谁拿下这一词。
     🔴v1164（审查 F5/UI-2）：**只有拼对才建回合文档。** 以前超时也建一个 winner:'' 的 ——
     两边计时差一两秒，先超时的那边一写，另一个孩子钟上还剩 2 秒、拼对了却只拿 60/80，抢答赛干脆「⏱ 超时了」0 分。 */
  /* 🔴v1164 「两人都答完才翻篇」：各自在自己的文档上记「我答完了第 i 词、现在共几分」。
     回合文档只记「谁先拼对」—— 后拼对的、超时的，对手原来根本看不到。
     抢答赛只在超时时记（有人拼对就翻篇，用不着）；同步赛 / 回合赛拼对、超时都记。 */
  function noteAns(rid, i, R, u, pts, o) {
    o = o || {};
    var c = rc(rid);
    c.pts = c.pts || {};
    var prev = c.pts[i];
    if (prev == null || o.fix) c.pts[i] = num(pts);
    if (!modeOf(R.mode).waitAll && !o.any) return;
    var cur = (c.myAns == null ? -1 : c.myAns);
    if (i < cur || (i === cur && !(o.fix && prev !== c.pts[i]))) return;
    c.myAns = Math.max(cur, i);
    var sum = 0;
    for (var k in c.pts) if (has(c.pts, k)) sum += num(c.pts[k]);
    var t = Date.now(), host = (R.hostId === u.id), at = c.myAns;
    var p = host ? T().patch(rid, { hostAns: at, hostPts: sum, hostBeat: t, heartbeatAt: t })
                 : T().patch(mySeatId(rid, R), { guestAns: at, guestPts: sum, guestBeat: t });
    p['catch'](function () { if (c.myAns === at) c.myAns = at - 1; });   /* 没写上：下一词再补 */
  }
  /* 这一局已经结束了吗（不再受理抢答）：有人判了离场 / 房间连续 3 次读不到（已被删）/ 房主中途走了
     （审查 F2：以前回来的那一方照样一词一个 +100）。
     🔴审查 F-R2-1/FX-5：**「对手交了卷才走的」不算结束。** 同步赛 / 回合赛两人各拼各的，
     快的那位交了卷、点了退出，慢的那位还在自己的 15 秒里 —— 他拼对的照样算分，最后按两边真实的分判胜负。
     以前一律拒收：本来赢的一局被算成平局、输，界面上还刚说过「这一局就算对手赢」。 */
  function ended(c) {
    if (c.awH || c.awG || c.missR >= 3) return true;
    return c.rank >= 2 && c.eb !== 'finished';
  }

  function claimRound(roomId, roundIdx) {
    var i = Math.floor(Number(roundIdx));
    return ident().then(function (u) {
      return metaOf(roomId).then(function (R) {
        var c = rc(roomId), M = modeOf(R.mode), side = (R.hostId === u.id) ? 'host' : 'guest';
        if (!(i >= 0 && i < capOf(R))) return failK('other', '这一局的词已经打完了', 'round ' + roundIdx);
        if (ended(c)) return failK('gone', '这一局已经结束了', 'room done', { ended: true });
        var ep = matchEp(c);
        var nn = c.wn || (c.wn = {});
        var res = function (won, winner) {
          /* 🔴v1100：慢了不等于没分 —— A 慢的 0 分，B/C 慢的照样拿 secondScore */
          var sc = won ? M.firstScore : M.secondScore;
          noteAns(roomId, i, R, u, sc);
          return { ok: true, won: won, first: won, score: sc,
                   winner: winner, round: decided(roomId), winners: winnersOf(roomId), mode: M.key };
        };
        var known = c.wins[i];
        if (known) return res(known.winner === side && known.by === u.id, known.winner);
        if (c.sqd && c.sqd[i]) return squatted();
        function attempt(k) {
          var wid = winIdOf(roomId, ep, i, k);
          /* 同一词再试（结果待定之后补一次）用同一个 nonce —— 上一次其实写进去了的话，读回来认得出是我的 */
          var w = { _id: wid, proto: PROTO, kind: 'win', nonce: nn[wid] || (nn[wid] = nonce()),
                    roomId: roomId, ep: ep, i: i, winner: side, by: u.id, at: Date.now() };
          return claim(w, { verify: true, fast: true }).then(function (r) {
            if (r.mine) { setWin(roomId, i, w); noteMine(w._id); return res(true, side); }
            /* 判断「是不是这局两个人写的」要先知道两个人是谁（房间 + 座位至少读过一次） */
            var need = r.doc && !validWin(r.doc, roomId, ep, i) && !(c.seat && c.meta && c.guestId);
            return Promise.resolve(need ? loadView(roomId)['catch'](noop) : null).then(function () { return decide(r, k); });
          });
        }
        function pendingRound() {
          /* 🔴审查 F1：读不回来 → 结果待定，不能当成「输了 0 分」。再看几秒；还不知道就让界面之后补算 */
          return settleRound(roomId, i).then(function (st) {
            if (st && st.settled) return st;
            noteAns(roomId, i, R, u, M.secondScore);
            return { ok: true, pending: true, won: false, first: false, score: 0, winner: '',
                     round: decided(roomId), winners: winnersOf(roomId), mode: M.key };
          });
        }
        /* 🔴审查 F-R2-7 / 安全 R2-1：这一词的三个回合号全被别人抢先占了（陌生人改过的客户端，一词三次写入就够）——
           「谁先拼对」这一词判不出来了。以前：「这一词没记上」，两个孩子拼对了都是 0 分，界面还说「网络不稳」。
           现在：**拼对的照样拿分**（这一词不分先后，都按先拼对算），记在自己的文档上（对手读得到、算得进比分）。
           陌生人最多让这一词不分先后，拿不走任何一个孩子的分；真要防住得靠云端的安全规则。 */
        function squatted() {
          c.sqd = c.sqd || {};
          c.sqd[i] = 1;
          var sc = M.firstScore;
          noteAns(roomId, i, R, u, sc, { any: true });
          return { ok: true, won: false, first: false, squatted: true, score: sc, winner: '',
                   round: decided(roomId), winners: winnersOf(roomId), mode: M.key };
        }
        function decide(r, k) {
          if (r.doc && validWin(r.doc, roomId, ep, i)) {
            setWin(roomId, i, r.doc);
            var w0 = c.wins[i];
            return res(w0.winner === side && w0.by === u.id, w0.winner);   /* 也可能是我自己上一次写进去的 */
          }
          if (r.doc && !(c.meta && c.seat && c.guestId)) {
            /* 🔴v1164（审查 F13 · 实测）：这一词已经有人写了，可我还不知道这局的客人是谁（座位没读到 / 那一下读失败了）——
               认不出是不是陌生人写的。**这时不能换备用号**：真是对手写的话，两个人各写一份，都成了「先拼对」
               （压力下实测出现过：4 个词里 1 个两边都 +100）。按「结果待定」走：再读几次，读到座位就认得出 */
            return pendingRound();
          }
          if ((r.doc || r.junk) && k < ALT.length - 1) {
            /* 🔴审查 F9 / F-R2-6：这个 _id 被别人抢先建了（不是这局两个人写的，或者根本不是回合文档）→ 换备用号写 */
            c.sq[i] = Math.max(c.sq[i] || 0, k + 1);
            return attempt(k + 1);
          }
          if (r.doc || r.junk) return squatted();
          if (r.unknown && kindOf(r.err) === 'config') return fail(r.err);
          return pendingRound();
        }
        return attempt(Math.min(c.sq[i] || 0, ALT.length - 1));
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* 回合结果待定时：再读几次，看第 i 词到底是谁拿下的（审查 F1：网断在半路时我的那条可能其实写进去了） */
  function settleRound(roomId, roundIdx, waitMs) {
    var i = Math.floor(Number(roundIdx));
    return ident().then(function (u) {
      var c = rc(roomId), R = c.meta || {}, M = modeOf(R.mode), side = (R.hostId === u.id) ? 'host' : 'guest';
      var t0 = Date.now(), limit = (waitMs == null) ? TM.settleMs : waitMs;
      function look() {
        if (c.wins[i]) {
          var won = c.wins[i].winner === side && c.wins[i].by === u.id;
          var sc = won ? M.firstScore : M.secondScore;
          noteAns(roomId, i, R, u, sc, { fix: true });
          return { ok: true, settled: true, won: won, first: won, score: sc, winner: c.wins[i].winner,
                   round: decided(roomId), winners: winnersOf(roomId), mode: M.key };
        }
        if (Date.now() - t0 >= limit) return { ok: true, settled: false };
        return sleep(Math.max(10, TM.lagMs)).then(function () {
          return loadView(roomId, { wins: true })['catch'](function () {});
        }).then(look);
      }
      return loadView(roomId, { wins: true })['catch'](function () {}).then(look);
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 🔴v1124 超时：这一词我答完了（0 分）。
     🔴v1164：只记在自己的文档上（「我答完第 i 词了」），**不再写回合文档** ——
     超时不能抢走对手的「先拼对」（审查 F5/UI-2）。两人都答完 / 超时，各自在本机翻篇。 */
  function skipRound(roomId, roundIdx) {
    var i = Math.floor(Number(roundIdx));
    return ident().then(function (u) {
      return metaOf(roomId).then(function (R) {
        var done = function () { return { ok: true, skipped: false, round: decided(roomId), winners: winnersOf(roomId) }; };
        if (!(i >= 0 && i < capOf(R))) return done();
        if (!ended(rc(roomId))) noteAns(roomId, i, R, u, 0, { any: true });
        return done();
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* 轮询本回合状态：第几词、谁拿下了、对手是谁 —— 一次请求读回房间 + 座位 + 这一局所有回合 */
  function roundState(roomId) {
    return ident().then(function (u) {
      var c = rc(roomId); c.calls++;
      return loadView(roomId, { wins: true }).then(function (L) {
        var v = L.v, host = (v.hostId === u.id);
        /* 对手答完到第几词：他自己记的，或者某一词的回合文档是他写的（拼对了 = 答完了） */
        var oppKey = host ? v.guestId : v.hostId, oa = host ? v.guestAns : v.hostAns, ws = c.wins;
        for (var wi = 0; wi < ws.length; wi++) if (ws[wi] && oppKey && ws[wi].by === oppKey && wi > oa) oa = wi;
        /* v1122/v1156：我是哪一方、对手是谁、对手几分（算 ELO 用）—— 两边都给 */
        return { ok: true, mode: v.mode, mySide: host ? 'host' : 'guest',
                 oppId: host ? v.guestId : v.hostId,
                 oppName: host ? v.guestName : v.hostName,
                 oppRating: host ? v.guestRating : (v.hostElo || v.hostRating),
                 round: v.round, winners: v.winners, roundAt: v.roundAt,
                 hostReady: v.hostReady, guestReady: v.guestReady,
                 heartbeatAt: v.heartbeatAt, wordCount: v.wordCount,
                 status: v.status, hostScore: v.hostScore, guestScore: v.guestScore,
                 endedBy: v.endedBy, abandonWin: v.abandonWin, room: v,
                 oppAns: oa, oppPts: host ? v.guestPts : v.hostPts };
      });
    })['catch'](function (e) { return fail(e); });
  }

  /* 进入对战屏时报到 —— 双方都就绪才开打。
     🔴v1123：心跳绑在「进对战屏」上（任何进屏路径都会发心跳）。 */
  function markReady(roomId) {
    var lg = _leftGen[roomId] || 0;
    return ident().then(function (u) {
      return loadView(roomId).then(function (L) {
        /* 读房间的这一会儿孩子已经退出了（界面停了心跳、标了离开）：不能再把这间房设回「我的」、重开心跳 */
        if ((_leftGen[roomId] || 0) !== lg) return { cancelled: true };
        var t = Date.now(), host = (L.v.hostId === u.id), c = rc(roomId);
        if (c.ep == null) c.ep = num(L.R.seat);
        if (host) setMine(roomId, 'host', '', true);
        else setMine(roomId, 'guest', mySeatId(roomId, L.R), true);
        startHeartbeat(roomId);
        if (host) return patchOwn(roomId, { hostReady: true, hostReadyAt: t, hostBeat: t, heartbeatAt: t });
        return patchOwn(_mySeatId, { guestReady: true, guestReadyAt: t, guestBeat: t, acked: true });
      }).then(function () { return { ok: true }; });
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 交卷：各写各的文档，两边都齐了才判胜负 ──
     写入重试 3 次；同一个分已经写成功就不再重复写，只读（一次请求读回房间 + 座位）。 */
  function reportResult(roomId, score) {
    var sc = scoreOf(score) || 0;
    /* 交卷这一刻就记下（同步记，不等写完）：马上离开时 leaveMine 要把它和「走了」一起写上（审查 F-R2-1/FX-5） */
    try { if (roomId) rc(roomId).fin = sc; } catch (e) {}
    return ident().then(function (u) {
      var c = rc(roomId);
      return metaOf(roomId).then(function (R) {
        var host = (R.hostId === u.id);
        var write = (c.reported === sc) ? Promise.resolve() : retry3(function () {
          var t = Date.now();
          return host ? patchOwn(roomId, { hostScore: sc, hostBeat: t, heartbeatAt: t })
                      : patchOwn(mySeatId(roomId, R), { guestScore: sc, guestBeat: t });
        }).then(function () { c.reported = sc; if (host) c.hs = sc; else c.gs = sc; });
        return write.then(function () { return loadView(roomId); }).then(function (L2) {
          var v = L2.v, my = host ? 'host' : 'guest';
          /* 已经有一方判了「对手离场」→ 两边都按这个结论，不再拿 1 分去和真实得分比；两边都判了 = 这局不算 */
          if (v.abandonWin === 'both') return { ok: true, waiting: false, result: 'void', byAbandon: true, void: true, mine: sc, theirs: 0 };
          if (v.abandonWin) {
            var iWin = (v.abandonWin === my);
            return { ok: true, waiting: false, mine: iWin ? 1 : 0, theirs: iWin ? 0 : 1,
                     result: iWin ? 'win' : 'lose', byAbandon: true };
          }
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
    /* 审查 R2-UI-1：界面离开「正在开房」那一屏时调 —— 开出来的房马上收掉 */
    cancelCreate: cancelCreate,
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
    settleRound: settleRound,
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
    cloudName: cloudName,
    PROTO: PROTO,
    _collection: COLLECTION,
    _staleMs: STALE_MS,
    _codeHash: codeHash,
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
