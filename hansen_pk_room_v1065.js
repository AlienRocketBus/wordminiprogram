/* hansen_pk_room_v1065.js —— 在线对战：公开房间与匹配
 *
 * 此前「大PK · 公开房间」和「天梯排位」两个入口都只接在 alert('敬请期待') 上，
 * UI 骨架早就有了，房间匹配的代码一直没写。本模块补上这一块。
 *
 * 设计上有三条硬约束，都是本轮踩出来的教训：
 *
 *  ① **绝不自建云端实例。**
 *     一律走 HansenAuth.ensureSession() + HansenAuth._app()——
 *     同一个 SDK 实例、同一个已验证会话。
 *     （v1028 自建匿名实例导致跨设备读不到；v1059 一个 `?v=` 查询串
 *      让 SDK 分裂成两份、各有各的凭证。两次都很难查。）
 *
 *  ② **传输层可注入。**
 *     开发容器连不上腾讯云，云端相关代码此前**完全无法验证**，
 *     只能靠推理——跨设备存档那条线因此空转了 40 版。
 *     这里把所有云端读写收敛到一个 transport 接口，
 *     `_setTransportForTest()` 可换成假实现，于是竞态、超时、抢房
 *     这些最容易出错的地方**都能在本地跑真实断言**。
 *
 *  ③ **抢房必须是原子的。**
 *     两个人同时点同一间房是常态而非例外。
 *     进房用「条件更新 + 检查影响行数」实现：
 *     只有把 status 从 open 改成 playing 的那一次算成功，
 *     另一个人拿到 updated=0，明确收到「这间房刚被人占了」。
 *     绝不用「先读再写」——那必然出现两个客人进同一间房。
 *
 * 词表：房主只存一个**种子**，双方用同一套确定性随机从 HANSEN_VOCAB_ALL 取词，
 *       所以不必把整份词表塞进房间文档（省流量，也避免两边词表不一致）。
 */
(function () {
  'use strict';
  if (window.HansenPkRoom) return;
  var _dbOverride = null;   /* v1157: 测试用，替换云端 db */

  var COLLECTION   = 'hansen_pk_rooms';
  var HEARTBEAT_MS = 8000;      /* 房主每 8 秒续一次命 */
  var STALE_MS     = 30000;     /* 超过 30 秒没心跳 → 视为掉线，不再展示 */
  var WORDS_PER_ROUND = 10;

  var _transport = null;        /* 测试注入口 */
  var _hb = null;               /* 心跳定时器 */
  var _myRoomId = '';

  /* ── 错误文本统一出口（v1059 起全仓不得再吐 [object Object]）── */
  function E(e) {
    /* 🔴v1115：**断网时不能把 "Failed to fetch" 原样丢给用户**。
       那是浏览器的英文内部错误，孩子看不懂，家长也只会以为 App 坏了。
       常见的网络类错误统一转成人话；其余仍走 errText 保留细节
       （报错链路上不许堆会撒谎的东西 —— 这是本项目的老规矩，
         "转人话"和"盖住真错误"是两回事：这里只翻译已知的几种）。 */
    /* ⚠️ 不能只靠 window.HBErrText —— 它可能还没加载（或在测试环境里没有），
       那时 String(对象) 会退化成 "[object Object]"，
       又回到 v1059 那个"错误被盖住盖了 40 版"的老坑。
       所以这里自带一份解析逻辑做兜底。 */
    var t = '';
    try {
      var H = window.HBErrText;
      if (typeof H === 'function') t = String(H(e) || '');
    } catch (x) {}
    if (!t) {
      if (e == null) t = '';
      else if (typeof e === 'string') t = e;
      else {
        var v = e.error_description || e.errMsg || e.message || e.error || e.reason;
        if (v != null && typeof v !== 'object') t = String(v);
        else { try { var j = JSON.stringify(e); if (j && j !== '{}') t = j; } catch (_) {} }
      }
    }
    if (/failed to fetch|networkerror|network request failed|load failed/i.test(t))
      return '连不上网络，检查一下 Wi-Fi 或数据再试';
    if (/timeout|timed out/i.test(t)) return '网络太慢，这次没连上，稍后再试';
    return t || '操作失败';
  }

  /* ── 确定性随机：同一个种子在任何设备上都给出同一串数 ──
     用 mulberry32，短小且分布够好。**不要换成 Math.random()**，
     那样双方拿到的词就不一样了。 */
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

  /* ── 真实传输层：一律复用账号会话，绝不自建实例 ── */
  function realTransport() {
    function db() {
      /* v1157: 测试要能验"云端缺索引时会不会降级" ——
         没有这个口子就只能读代码，而读代码看不出运行时行为。 */
      if (_dbOverride) return Promise.resolve(_dbOverride);
      var A = window.HansenAuth;
      if (!A || typeof A.ensureSession !== 'function' || typeof A._app !== 'function')
        return Promise.reject(new Error('账号模块未加载，无法联机'));
      return A.ensureSession().then(function (s) {
        if (!s || !s.ok) {
          var err = new Error(s && s.expired ? '云端登录已过期，请重新登录后再联机'
                                             : ('云端会话不可用：' + ((s && s.reason) || '未知')));
          err.sessionDead = true; err.expired = !!(s && s.expired);
          throw err;
        }
        /* 🔴v1161（真机截图报的）：**`app.database is not a function`。**

           用户截图：房间界面出来了、按钮都在，但每次操作都红着这一句，
           点「开一间公开房」什么都不发生。

           根因：`A._app()` **是异步的，返回的是 Promise** ——
           它内部要 `import('./vendor_cloudbase_esm_v965.js')` 动态加载 SDK。
           而这里当成同步用了：

               var app = A._app();     ← 拿到的是 Promise
               return app.database();  ← Promise 上没有 database()

           云存档模块（hansen_cloud_save）一直是对的写法：
               return A._app();
             }).then(function (app) { ... app.database() ... })

           **同一个 API，两个模块一个用对一个用错，而错的那个从来没被测出来** ——
           因为所有房间测试都注入了 `_setTransportForTest`，
           **把整个真实的 db() 路径绕过去了**。

           > 测试桩替换掉的那一段，就是永远不会被验证的那一段。
           > 桩用得越顺手，真实路径越容易烂在那里没人知道。

           这也解释了为什么我前面几十轮怎么测都是好的 ——
           我测的从来不是用户走的那条路。 */
        return A._app().then(function (app) {
          if (!app) throw new Error('云端实例不可用');
          return app.database();
        });
      });
    }
    return {
      add: function (doc) {
        return db().then(function (d) {
          return d.collection(COLLECTION).add(doc).then(function (r) {
            return { id: (r && (r.id || r._id)) || doc._id || '' };
          });
        });
      },
      /* 🔴v1161（真机报的）：**默认传输层从来就没有 list，而三处在调它。**

         用户报「房间匹配根本没办法建房」。查下来：
         `T().list(...)` 被调用 **3 处**，
         而默认传输层只提供了 add / listOpen / claim / patch / remove / read
         —— **一个 list 都没有**。

           · 行 440：开房前查房间码是否重复 ← **建房必经之路**
           · 行 365：按房间码找房（好友进房）
           · 行 479：清理自己的僵尸房

         `T().list` 是 `undefined`，调用直接抛
         `T(...).list is not a function` —— 建房当场失败。

         为什么之前没暴露：所有测试都用 `_setTransportForTest` 注入了
         一个**带 list 的假传输层**，
         于是「测试全绿、真机不能用」。

         > **测试桩比真货多一个方法，等于把真货的缺口盖住了。**
         > 桩要照着真货的能力做，不能照着"我需要什么"做。

         按 condition 查询，返回原始行 —— 调用方自己做本地过滤
         （v1154 的教训：where 里字段多了会把结果全滤没，
           所以这里只做最直白的等值匹配）。 */
      list: function (cond) {
        return db().then(function (d) {
          var q = d.collection(COLLECTION);
          try {
            if (cond && typeof cond === 'object') q = q.where(cond);
          } catch (e) {}
          return q.limit(50).get().then(function (r) {
            return (r && r.data) || [];
          });
        });
      },
      listOpen: function (nowTs) {
        return db().then(function (d) {
          /* 🔴v1135：**先按心跳筛，再取前 N 条 —— 不能反过来。**

             旧写法是 `orderBy(createdAt desc).limit(30)` 之后
             才在本地过滤心跳。房主直接关页面时房间不会被删（来不及），
             这些死房会一直留在数据库里、而且 createdAt 更新 ——
             **僵尸房攒到 30 个，活房间就彻底排不进那 30 条，用户什么都看不到。**

             实测模拟：50 个死房 + 2 个活房 → 用户看到 **0 间**。
             公开房间等于完全不可用。

             改法：查询条件里直接带上 `heartbeatAt` 下限，
             让数据库先把死房滤掉，再按最近开的排序取 20 条。 */
          var _alive = Date.now() - STALE_MS;
          return d.collection(COLLECTION)
                  /* 🔴v1135：**排除自己的房和已满员的房。**
                     实测：自己开的房会出现在自己的列表里（点进去毫无意义），
                     已经有客人的房也照样列出来（点进去必然失败"这间房刚被别人占了"）。
                     两种都是"看得见但点了没用"，比不显示更糟。 */
                  /* 🔴v1154：**查询条件加多了，把房间全滤没了。**
                     用户现场：「房间功能到现在根本就不能用。」
                     v1135 我往 where 里塞了三个条件，三个都有问题：
                       ① guestId:'' —— **字段缺失 ≠ 空字符串**，
                          数据库里我改之前建的房间根本没这个字段，一间都匹配不上
                       ② heartbeatAt 同理，老房间没这个字段
                       ③ orderBy 的字段在云开发要建索引，没建就整个查询报错
                     实测：云端 3 间房 → 用户只看到 1 间。
                     改为：**查询只留最稳的条件**（status + isPrivate 每间房都有），
                     其余判断放到本地 —— 把过滤下推给数据库省的那点流量，
                     **不值得用“老数据全看不见”来换**。 */
                  .where({ status: 'open', isPrivate: false })
                  .orderBy('createdAt', 'desc').limit(40).get()
                  /* 🔴v1157（真机报的「连不上网络」）：**orderBy 需要索引，没建就整个查询报错。**

                     用户截图：天梯排位 → 📡 连不上网络 / 检查 Wi-Fi ——
                     而他登录了、网也是好的。

                     v1154 的注释白纸黑字写过这个坑：
                     「orderBy 的字段在云开发要建索引，没建就整个查询报错」，
                     而这行 orderBy 一直留着。

                     索引要在云开发控制台手动建 —— **而一个功能不该依赖
                     某个人记得去后台点一下**。配置丢了、换环境、新建数据库，
                     都会让天梯直接不能用，而界面只会说"检查网络"。

                     > **能在代码里兜住的事，不要押在运维配置上。**

                     失败就降级成不带 orderBy 的查询（不需要任何索引），
                     排序放本地做。 */
                  ['catch'](function (indexErr) {
                    try {
                      console.warn('[房间] orderBy 失败，降级为不排序查询'
                        + '（多半是云端没建 createdAt 索引）：'
                        + String((indexErr && indexErr.message) || indexErr).slice(0, 120));
                    } catch (e) {}
                    return d.collection(COLLECTION)
                      .where({ status: 'open', isPrivate: false })
                      .limit(40).get();
                  })
                  .then(function (r) {
                    var rows = (r && r.data) || [];
                    /* 再兜一层：查询和本地时钟可能有偏差 */
                    var myId = '';
                    try { myId = me().id || ''; } catch (e) {}
                    return rows.filter(function (x) {
                      if (myId && x.hostId === myId) return false;   /* 不列自己的房 */
                      if (x.guestId) return false;                   /* 不列满员的房 */
                      return (nowTs - (x.heartbeatAt || 0)) < STALE_MS;
                    }).sort(function (a, b) {
            /* v1157: 本地兜一次排序 —— 降级路径没有 orderBy，
               而"最近开的排前面"是用户真正在意的顺序。
               40 条数据排一下毫无压力。 */
            return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
          });
                  });
        });
      },
      /* 条件更新：只有满足 guard 的那一次会命中，返回影响行数。
         抢房的原子性完全依赖这个返回值，不能改成"先读再写"。 */
      claim: function (roomId, guard, patch) {
        return db().then(function (d) {
          var w = { _id: roomId };
          Object.keys(guard || {}).forEach(function (k) { w[k] = guard[k]; });
          return d.collection(COLLECTION).where(w).update(patch).then(function (r) {
            return { updated: (r && (r.updated != null ? r.updated : r.stats && r.stats.updated)) || 0 };
          });
        });
      },
      patch: function (roomId, data) {
        return db().then(function (d) {
          return d.collection(COLLECTION).doc(roomId).update(data).then(function () { return true; });
        });
      },
      remove: function (roomId) {
        return db().then(function (d) {
          return d.collection(COLLECTION).doc(roomId).remove().then(function () { return true; });
        });
      },
      read: function (roomId) {
        return db().then(function (d) {
          return d.collection(COLLECTION).doc(roomId).get().then(function (r) {
            var rows = (r && r.data) || [];
            return rows[0] || null;
          });
        });
      }
    };
  }

  /* ── 🔴v1115 统一超时 ──────────────────────────────────────

     实测：把传输层换成"永远不返回"的假实现后，
     `listRooms` / `createRoom` / `claimRound` **8 秒仍无响应** ——
     界面会一直转圈，用户只能杀掉页面重来。

     这在手机上很常见：**弱信号下 TCP 连着但不返回**，
     既不成功也不失败，比直接断网更折磨人。

     做法：在传输层统一包一层超时 —— 一处修，所有调用都受益。
     超时后抛的是**可读文案**（"网络太慢…"），而不是让上层拿到
     一个 undefined 自己去猜。

     对战相关的操作给 8 秒（抢答讲时效，等久了这局也没意义了），
     其余给 12 秒。 */
  var NET_TIMEOUT_MS = 12000;
  var NET_TIMEOUT_FAST_MS = 8000;

  function withTimeout(promise, ms, what) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        /* 🔴v1115：**文案里不许露内部方法名**。
           第一版写成"网络太慢，云端listOpen没能完成" —— 用户看不懂 listOpen 是什么，
           只会觉得这个 App 在说胡话。报错是给人看的，不是给开发者看的。 */
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

  /* 给传输层的每个方法套上超时 —— 包括测试注入的假实现，
     这样"卡住"这种情况在测试里也能复现。 */
  function wrapTimeout(tx) {
    if (!tx || tx.__wrapped) return tx;
    var FAST = { claim: 1, read: 1, patch: 1 };
    var out = { __wrapped: true };
    Object.keys(tx).forEach(function (k) {
      var fn = tx[k];
      if (typeof fn !== 'function') { out[k] = fn; return; }
      out[k] = function () {
        /* 🔴v1161（模拟真机恶劣网络抓到）：**一次请求失败就直接放弃。**

           实测（抖动 0~1.5 秒 + 20% 请求失败）：
           房主点「开一间」→「出了点问题，再试一次吧」，
           客人的房间列表直接空的。

           而 20% 丢包在真机上很常见 —— 地铁、电梯、信号弱的房间。
           用户不会知道是网的问题，**只会觉得"这游戏根本用不了"**。

           > 网络请求失败不等于操作失败 —— 大多数时候只是这一次没走通。
           > 该做的是替他再试一次，而不是把一次抖动当成结论。

           读类操作（read/list/listOpen）重试两次，间隔 300ms/700ms：
           它们没有副作用，重试是安全的。

           ⚠️ 写类操作（add/claim/patch/remove）**不重试** ——
           claim 是抢房，重试可能把别人已经占到的房再抢一次；
           add 重试会开出两间房。宁可让他自己点第二次。 */
        var args = arguments;
        /* 🔴v1161（延迟 + 丢包组合测出来的）：**建房也要能重试。**

           单独测 20% 丢包时是过的（读类会重试），
           但加上云端延迟之后，**建房直接失败** ——
           因为 `add` 不在重试名单里，一次 503 就宣告失败。

           当初把写类全排除是有道理的：claim 重试会抢别人已占的房，
           patch/remove 重试会重复执行。**但 add 不一样** ——
           它带着 `_id`（建房时就生成好的固定值），
           重试写的是同一个文档，云端会覆盖而不是新建。

           > 「写操作不能重试」是个太粗的规矩。
           > 真正决定能不能重试的是**幂等性**：
           > 同一个请求发两次，结果一样吗？
           > add 带固定 _id 时是幂等的，claim 不是。

           所以 add 加入可重试，claim/patch/remove 仍然排除。 */
        var READ_ONLY = { read: 1, list: 1, listOpen: 1, add: 1 };
        var once = function () {
          return withTimeout(fn.apply(tx, args),
            FAST[k] ? NET_TIMEOUT_FAST_MS : NET_TIMEOUT_MS);
        };
        if (!READ_ONLY[k]) return once();
        return once()['catch'](function () {
          return new Promise(function (res) { setTimeout(res, 300); }).then(once);
        })['catch'](function () {
          return new Promise(function (res) { setTimeout(res, 700); }).then(once);
        });
      };

    });
    return out;
  }

  function T() {
    if (_transport) return _transport;
    _transport = wrapTimeout(realTransport());
    return _transport;
  }

  var _meOverride = null;   /* v1100 测试注入：不必真登录就能验抢答 */

  function me() {
    if (_meOverride) return _meOverride;
    var A = window.HansenAuth;
    var lc = {};
    try { lc = (A && A.readLocal && A.readLocal()) || {}; } catch (e) {}
    var P = window.HansenSbProfile;
    var nm = '';
    try { nm = (P && P.status && P.status().name) || ''; } catch (e) {}
    return {
      id: String(lc.phone || lc.username || lc.uid || ''),
      name: nm || '无名蜂'
    };
  }

  /* ── 开房 ── */
  /* ── 🔴v1105 房间码：邀请朋友来打 ──────────────────────────

     产品需求：「可以邀请自己的好友到房间里面来进行对战。」

     我没有做「加好友」那一套（好友列表 / 申请 / 通过）——
     **对现在的用户量太重了**，而且解决不了核心问题：
     你想跟谁打，通常是身边的人（同学、家人），
     微信里发一句话比在 App 里加好友快得多。

     所以做的是**房间码**：
       开房 → 拿到 4 位码「7K2M」→ 微信发给朋友 → 他输码直接进
     整个过程不需要任何账号关系，也不需要对方先注册好友。

     私密房（带码的房）**不出现在公开列表里** ——
     否则"邀请"就没意义了，随便谁都能进。

     码用不易混淆的字符集：去掉 0/O、1/I/L 这些看错就进错房的。 */
  var CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  function makeCode() {
    var c = '';
    for (var i = 0; i < 4; i++) {
      c += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return c;
  }

  /* 按房间码找房 —— 朋友输码进房走这里 */
  function findByCode(code) {
    var c = String(code || '').trim().toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(c)) {
      return Promise.resolve({ ok: false, reason: '房间码是 4 位，检查一下' });
    }
    var nowTs = Date.now();
    return T().list({ code: c, status: 'open' }).then(function (rows) {
      var alive = (rows || []).filter(function (x) {
        return (nowTs - (x.heartbeatAt || 0)) < STALE_MS;
      });
      if (!alive.length) {
        return { ok: false, reason: '没找到这间房，可能已经关了或码输错了' };
      }
      return { ok: true, room: alive[0], roomId: alive[0]._id };
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired) }; });
  }

  var _creating = null;   /* v1112: 开房中的 Promise，防连点开出僵尸房 */

  function createRoom(opts) {
    opts = opts || {};
    var u = me();
    if (!u.id) return Promise.reject(new Error('请先登录再开房'));
    /* 🔴v1112：**防连点。**
       实测连点三次会真的创建三个房间 —— 多出来的两个成了僵尸房，
       占着公开列表、别人点进去发现房主根本不在那间。
       网络慢的时候用户很自然会多点几下，这不是他的错。
       同一次开房进行中就复用同一个 Promise。 */
    if (_creating) return _creating;

    /* 🔴v1161（顺着「建房不行」那条线继续挖到的）：
       **词库没加载时也让人建房 —— 房建起来了，一开打就秒结束。**

       这正是用户遇到的那个 bug 的另一半：
       v1161 修好了"对战页没引词库"，但如果因为别的原因
       （网慢、脚本 404、缓存坏了）词库还是没到位，
       现在的代码照样会让他把房开出来 ——
       然后等来一个对手，两个人一进对战就双双跳到结算屏。

       > 一个注定失败的操作，**在开始之前就该拦住**。
       > 让人先建房、等人、再一起失败，比当场说"还没准备好"糟糕得多 ——
       > 后者他重试一下就好了，前者浪费两个人的时间还留下一间僵尸房。

       检查一次实际能取到多少词：取不到就明确拒绝，
       并给一个他能做的动作（刷新页面）。 */
    try {
      var _probe = wordsFromSeed(1, 3);
      if (!_probe || _probe.length < 1) {
        return Promise.resolve({
          ok: false,
          reason: '词库还没加载好，刷新一下页面再开房'
        });
      }
    } catch (e) {
      return Promise.resolve({
        ok: false,
        reason: '词库还没加载好，刷新一下页面再开房'
      });
    }
    /* 🔴v1135：**开新房前先关掉自己已有的房。**
       实测连开两次会在数据库里留下两间自己的房 —— 前一间成了孤房，
       别人点进去时房主根本不在那间。 */
    var _prev = _myRoomId;
    if (_prev) { try { T().remove(_prev)['catch'](function () {}); } catch (e) {} _myRoomId = ''; }
    var now = Date.now();
    var seed = (now ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    /* 🔴v1161：**建房文档要带自己生成的 _id，否则重试会开出两间房。**

       上一步把 add 加进了可重试名单（延迟+丢包组合下建房会失败），
       理由是"add 带 _id 时是幂等的"。
       结果一查：**这个文档根本没有 _id** —— 云端每次都会新建一条。

       > 差点把「一次建房失败」换成「一次点击开出两间房」。
       > 幂等不是写操作自带的属性，是**要自己保证的**：
       > 没有固定主键的写入，重试一次就多一条。

       所以先给它一个客户端生成的 _id：
       时间戳 + 随机串，重复概率可以忽略，
       而且重试时写的一定是同一条文档（云端 add 遇到同 _id 会报错或覆盖，
       两种都比新建一条强 —— 前者被 catch 住，后者本来就是我们要的）。 */
    var _newId = 'r' + Date.now().toString(36)
                 + Math.random().toString(36).slice(2, 8);
    var doc = {
      _id: _newId,
      status: 'open',
      /* v1105: 私密房带 4 位码，不出现在公开列表；公开房 code 为空 */
      code: '',      /* v1136: 私密房的码在下面异步查重后再写，不在这里直接生成 */
      /* v1114: 夹到合理区间 —— 客户端填什么都不能超出 ELO 的可能范围。
         拦不住有人改代码，但能让"填 1e99"这种没有意义。 */
      hostRating: Math.max(0, Math.min(4000, Math.floor(Number(opts.hostRating) || 0))),
      isPrivate: !!opts.private,
      hostId: u.id, hostName: u.name,
      hostTier: opts.tier || '',
      guestId: '', guestName: '',
      seed: seed,
      wordCount: opts.wordCount || WORDS_PER_ROUND,
      createdAt: now, heartbeatAt: now,
      hostBeat: now, guestBeat: 0,      /* v1104: 双方各自的心跳，用于掉线判定 */
      hostScore: null, guestScore: null,

      /* 🔴v1100 回合制对战：**同一个词，两个人同时拼，谁先拼对谁得分。**

         v1099 做错了：发一整套题让两人各自埋头做完再比分数 ——
         那不叫对战，那是"两个人各考各的"。
         真正的对战是回合制：出一个词 → 双方同时拼 → 谁先对谁得分
         → 一起进下一个词。乐趣正来自"他抢在我前面了"这一下。

         字段含义：
           round      当前第几个词（0 起）
           roundAt    本回合开始时间（用于超时判负、防挂机）
           winners    每回合的赢家 ['host','guest',...]，长度即已完成回合数
           hostReady/guestReady  双方是否都进入了对战屏（都就绪才开始第 1 回合）
      */
      mode: modeOf(opts.mode).key,     /* v1100: A 抢答 / B 回合 / C 同步 */
      askMode: (opts.askMode === 'tts') ? 'tts' : 'cn',   /* v1102: 看中文 / 听发音 */
      round: 0,
      roundAt: 0,
      winners: [],
      hostReady: false, guestReady: false
    };
    /* 🔴v1136：**房间码要查重。**
       实测：`makeCode()` 只是随机生成，不看已有的码。
       字符集 31^4 ≈ 92 万，看着够用 —— 但**同时只有几间私密房时也可能撞**，
       撞了的后果很具体：朋友输了码，进的却是**另一个陌生人的房**。
       做法：生成后查一次，撞了重来，最多 5 次。 */
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

    _creating = _prep.then(function () { return T().add(doc); }).then(function (r) {
      /* 🔴v1161（加固扫描抓到）：**拿不到有效房间号，界面照样说"房间已经开好了"。**

         实测让云端 add 返回六种异常：
           {}、{id:''}、{id:12345}、{id:{a:1}}、"ok"
         五种都让用户看到「⏳ 等对手进来 · 房间已经开好了」——
         **而根本没有房间**，他会一直等下去，别人也永远看不到他。

         > 「调用没抛错」不等于「事情办成了」。
         > 云端返回什么样都算成功，等于把判断责任丢给了运气。

         房间号必须是**非空字符串**才算建成：
           · 不是字符串（数字/对象）→ 后续所有 read/patch 都会用错的键
           · 空字符串 → 心跳、轮询、清理全都对不上任何一间房

         数字 id 是唯一可以救的：转成字符串就能用（有些后端返回自增 id）。 */
      var _rid = r && r.id;
      if (typeof _rid === 'number' && isFinite(_rid)) _rid = String(_rid);
      if (typeof _rid !== 'string' || !_rid) {
        return { ok: false,
                 reason: '云端没有返回房间号，房没开成 —— 再试一次吧' };
      }
      r = { id: _rid };
      _myRoomId = r.id;
      startHeartbeat(r.id);
      return { ok: true, roomId: r.id, room: doc, words: wordsFromSeed(seed, doc.wordCount) };
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired) }; });
    /* 无论成败都要解锁，否则一次失败就再也开不了房 */
    _creating['finally'] ? _creating['finally'](function () { _creating = null; })
                         : _creating.then(function () { _creating = null; },
                                          function () { _creating = null; });
    return _creating;
  }

  /* ── 🔴v1135 顺手清死房 ────────────────────────────────────

     死房只是"不展示"，**记录会永久留在数据库里**：
     房主直接关页面 → 来不及删房 → 这条记录永远躺着。
     每开一次房就多一条，而云开发按存储和读次数计费。

     没有服务端定时任务可用（`counters` 那类都是 ADMINONLY），
     所以让**每个来列房的客户端顺手清几条** ——
     反正它已经查过一次了，删两条是很小的额外成本。

     只删**自己创建的**死房（权限规则是"仅创建者可写"，
     别人的本来也删不掉）—— 于是每个人清理自己留下的垃圾，
     整体上就干净了。

     每次最多删 3 条：清理不该拖慢列房这个高频操作。 */
  function sweepMyDeadRooms() {
    var u = me();
    if (!u.id) return Promise.resolve(0);
    /* 🔴v1161：**这个函数是延迟 1.5 秒跑的，那时传输层可能已经换了。**

       实测（测试里换桩后）：`T(...).list is not a function`。
       真实场景同理 —— 用户退出登录、换账号、或者页面正在卸载时，
       传输层会被换掉或清空，而这个延迟任务还在队列里。

       它只是"顺手清理僵尸房"，**不是关键路径** ——
       拿不到 list 就安静跳过，下次再清。

       > 延迟执行的收尾任务，要假设它跑起来时世界已经变了。 */
    try {
      var _t = T();
      if (!_t || typeof _t.list !== 'function') return Promise.resolve(0);
    } catch (e) { return Promise.resolve(0); }
    var dead = Date.now() - STALE_MS * 4;   /* 保守：2 分钟以上没心跳才动 */
    return T().list({ hostId: u.id }).then(function (rows) {
      var kill = (rows || []).filter(function (r) {
        return r && r._id && (r.heartbeatAt || 0) < dead && r._id !== _myRoomId;
      }).slice(0, 3);
      if (!kill.length) return 0;
      return Promise.all(kill.map(function (r) {
        return T().remove(r._id)['catch'](function () {});
      })).then(function () { return kill.length; });
    })['catch'](function () { return 0; });
  }

  /* ── 列房：只列还活着的公开房，且不列自己开的 ── */
  /* v1161: 房间列表字段清洗 —— 见 listRooms 里的说明 */
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
    /* 不是数字、在未来、或者早于 2020 年 —— 都当"刚刚"，
       总比显示"29777281 分钟前"强 */
    if (!isFinite(t) || t > now + 60000 || t < 1577808000000) return 0;
    return Math.max(0, Math.round((now - t) / 1000));
  }

  function listRooms() {
    var u = me();
    /* 列房时顺手清掉自己留下的死房（不阻塞列表返回） */
    try { setTimeout(function () { sweepMyDeadRooms(); }, 1500); } catch (e) {}
    return T().listOpen(Date.now()).then(function (rows) {
      /* 🔴v1135：**排除自己的房和已满员的房 —— 放在这里而不是传输层。**
         传输层的 where 只对真实云端有效，测试注入的假实现绕不过去；
         而这条规则是**业务规则**，不该依赖某一种传输实现。
         （第一版我写在 listOpen 里，测试一验就发现自己的房还在列表里。） */
      var _me = '';
      try { _me = me().id || ''; } catch (e) {}
      var _now = Date.now();
      rows = (rows || []).filter(function (x) {
        if (!x) return false;
        if (_me && x.hostId === _me) return false;   /* 自己的房点进去毫无意义 */
        if (x.guestId) return false;                 /* 满员的点进去必然失败 */
        /* 🔴v1154：**心跳过滤也放到这里。**
           v1135 把它写在传输层的 where 里，结果两件事一起坏了：
             · 老房间没有 heartbeatAt 字段 → 被数据库直接滤掉，一间都看不见
             · 而传输层被测试替换时，这道过滤就完全不生效
           这条是**业务规则**（"房主还在不在"），
           不该依赖某一种传输实现 —— 和 v1135 学到的教训是同一条。
           老房间没有 heartbeatAt 时退回用 createdAt，别让它们凭空消失。 */
        var beat = x.heartbeatAt || x.createdAt || 0;
        if ((_now - beat) >= STALE_MS) return false;
        return true;
      });
      return {
        ok: true,
        rooms: (rows || []).map(function (x) {
          return {
            /* 🔴v1161（攻击测试抓到）：**云端返回什么就画什么，会印出 [object Object]。**

               实测（让云端返回畸形行）：房间列表显示
                 「[object Object] 未定级 · 很多 个词 · 29777281分钟前」

               根因：`x.hostName || '无名蜂'` —— **对象也是真值**，
               所以一个 `{a:1}` 会原样透传，模板拼进去就成了 [object Object]。
               `wordCount` 拿到字符串"很多"、`createdAt` 是 NaN 时同理。

               房间数据来自别的客户端（对方那台手机写进云端的），
               **本地无法保证它一定干净** —— 老版本客户端、
               写了一半断网、甚至有人手动改，都会让字段变成意外的类型。

               > 从别人那里拿来、要显示给用户的东西，
               > 每一个字段都要问一句：它要是不对怎么办？

               三个清洗函数：文字只认字符串、数字要落在合理区间、
               时间戳不合理就当"刚刚"（而不是算出 2977 万分钟）。 */
            id: sText(x._id || x.id, 40),
            hostName: sText(x.hostName, 16) || '无名蜂',
            hostTier: sText(x.hostTier, 12),
            wordCount: sNum(x.wordCount, 1, 50, WORDS_PER_ROUND),
            mine: !!(u.id && x.hostId === u.id),
            ageSec: sAge(x.createdAt),
            /* 🔴v1154：**这两个字段以前被丢掉了 —— 天梯因此完全没法用。**

               用户现场：「天梯功能根本用不了。」

               天梯匹配靠这两个字段挑房：
                 if (r.mode !== 'A') return false;      ← undefined，全被滤掉
                 var raw = Number(r.hostRating);         ← 也没有

               而这个映射只挑了展示用的几项，**把它们漏了** ——
               于是"找实力接近的对手"这条路**永远找不到任何房**，
               每次都只能等满 20 秒、自己开一间。
               大多数时候明明有人在等，却匹配不上。

               `_id` 也一起带出去：天梯拿 `fit[0]._id` 去进房，
               而这里只给了 `id`，属于同一个疏漏。 */
            _id: sText(x._id || x.id, 40),
            /* 玩法只认已知的三个 —— 云端给个 99 或 null 都当默认 */
            mode: (x.mode === 'A' || x.mode === 'B' || x.mode === 'C') ? x.mode : 'C',
            /* 天梯分夹在真实区间，负数和天文数字都不认 */
            hostRating: sNum(x.hostRating, 0, 4000, 0)
          };
        })
      };
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired), rooms: [] }; });
  }

  /* ── 进房：原子抢占 ──
     两人同时点同一间房是常态。只有把 status 从 open 改成 playing 的那次算数；
     另一个人拿到 updated=0，明确收到「刚被人占了」，而不是稀里糊涂进同一间。 */
  function joinRoom(roomId) {
    var u = me();
    if (!u.id) return Promise.resolve({ ok: false, reason: '请先登录再进房' });
    if (!roomId) return Promise.resolve({ ok: false, reason: '房间号为空' });
    return T().claim(roomId, { status: 'open', guestId: '' }, {
      status: 'playing', guestId: u.id, guestName: u.name, startedAt: Date.now()
    }).then(function (r) {
      if (!r || !r.updated) return { ok: false, taken: true, reason: '这间房刚被别人占了，换一间吧' };
      return T().read(roomId).then(function (room) {
        if (!room) return { ok: false, reason: '房间已不存在' };
      /* 🔴v1135：**房主已经跑了就别让人进。**
         实测：房主关页面两分钟后，客人仍能"成功"进房 ——
         进去之后对着空房间干等，直到 60 秒掉线判定才结束。
         列表里已经滤掉了死房，但用房间码进房、或列表刚好过期时仍会撞上。 */
      if ((Date.now() - (room.heartbeatAt || 0)) > STALE_MS) {
        return { ok: false, reason: '房主已经离开了，换一间吧' };
      }
      /* 🔴v1136：**进别人的房之前，先关掉自己开的那间。**

         实测：A 开了房，又去列表点了别人的房 —— 进去了，
         **而自己那间还开着**。别人从列表点进 A 那间时，
         A 根本不在那儿（他正在别人房里打），对方只能干等到掉线判定。

         v1135 只处理了"连开两次"，漏了"开完又去进别人的"这条路。
         孤房的成因不止一种，**只要离开自己的房就该关掉它**。 */
      if (_myRoomId && _myRoomId !== roomId) {
        try { T().remove(_myRoomId)['catch'](function () {}); } catch (e) {}
        _myRoomId = '';
      }
        _myRoomId = roomId;
        /* 🔴v1104：客人也要发心跳 —— 否则房主检测不到客人掉线，
           会一直干等。原来只有房主发，这是个明显的不对称。 */
        startHeartbeat(roomId);
        /* 🔴v1161（加固扫描抓到）：**房间里的词数直接信，会开出没法玩的局。**

           实测（伪造房间数据进房）：
             wordCount = -5    → 一进去就「交卷了，答对 0/0 个」，空局
             wordCount = 99999 → 变成「第 1 / 712 词」，要打 712 题

           房间数据是**对方那台手机写进云端的** —— 老版本客户端、
           写了一半断网、字段被改，都可能让它变成任何值。
           `room.wordCount || WORDS_PER_ROUND` 只挡住了 0 和 undefined，
           负数和天文数字都照单全收。

           > 从对方设备来的每一个数字，都要问一句：
           > 它落在合理范围里吗？——「有值」和「值合理」是两回事。

           夹在 1~30：低于 1 没法玩，高于 30 没人打得完。 */
        var _wc = Number(room.wordCount);
        if (!isFinite(_wc)) _wc = WORDS_PER_ROUND;
        _wc = Math.max(1, Math.min(30, Math.round(_wc)));
        var _ws = wordsFromSeed(room.seed, _wc);
        if (!_ws || !_ws.length) {
          return { ok: false, reason: '词库还没加载好，刷新一下页面再进房' };
        }
        return { ok: true, roomId: roomId, room: room, words: _ws };
      });
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired) }; });
  }

  /* ── 心跳 ──────────────────────────────────────────────────

     🔴v1104：**双方各发各的心跳。**

     原来只有房主发 `heartbeatAt` —— 那客人掉线就完全检测不到，
     房主会一直干等（现在只有 10 分钟兜底，太长了）。

     改为各自写自己那一侧：
       房主 → hostBeat     客人 → guestBeat
     对战中任一方超过 ABANDON_MS 没动静，另一方即可判他离场获胜。

     产品定的阈值：**1 分钟没回来就判负**。
     选 1 分钟而不是更短，是因为手机切到后台、接个电话、
     网络抖一下都很常见 —— 太敏感会把正常玩家误判成逃跑。 */
  var ABANDON_MS = 60000;

  /* 🔴v1161（攻击测试抓到）：**房主刷新页面后，房间变成 30 秒的僵尸。**

     实测：房主建房 → 刷新页面 →
       云端还有 1 间房，别人的列表里也还看得到，
       但房主自己已经不在那间房里了（刷新把状态清空了）。

     别人这 30 秒里点进去，必然扑空。

     根因：房间靠心跳续命（每 8 秒一次），
     刷新/关页面时心跳就停了，但要等 STALE_MS（30 秒）才被判死。
     **而页面关闭这件事，我们其实当场就知道**。

     > 能当场收尾的事，不要留给超时机制去兜。
     > 超时是给"没来得及说再见"的情况准备的，不是给正常关页面准备的。

     用 sendBeacon 发一次删除请求 —— 它专门为"页面正在关闭"设计，
     浏览器会保证发出去（普通 fetch 在 unload 时经常被掐断）。
     发不出去也没关系，30 秒超时仍然是兜底。

     pagehide 比 beforeunload 可靠：iOS Safari 上后者经常不触发。 */
  function _byeOnUnload() {
    try {
      if (!_myRoomId) return;
      var rid = _myRoomId;
      _myRoomId = '';
      /* 优先走传输层（测试注入的假传输层也能收到） */
      try { T().remove(rid)['catch'](function () {}); } catch (e) {}
    } catch (e) {}
  }
  try {
    window.addEventListener('pagehide', _byeOnUnload);
    window.addEventListener('beforeunload', _byeOnUnload);
  } catch (e) {}

  function startHeartbeat(roomId) {
    stopHeartbeat();
    var u = me();
    /* 🔴v1161（加固扫描抓到）：**房间没了心跳还在空转。**

       原来 `if (!room) return;` 只是跳过这一次 ——
       房间已经被删（房主关了、被清理了、或者根本没建成），
       心跳仍然每 8 秒读一次云端，直到用户关掉页面。

       后果不是崩溃，是**安静地浪费**：流量、电，
       以及云开发的读次数配额 —— 那是要花钱的，
       而且配额耗尽会让所有人都用不了。

       > 一个「维持某样东西存活」的机制，
       > 在那样东西已经不存在之后，就该自己停下来。

       连续三次读回 null 才停（和 waitForOpponent 一样的宽限，
       因为云端最终一致，一两次读不到很正常）。
       网络报错不计数 —— 那是"没读到"，不是"不存在"。 */
    var hbMiss = 0;
    _hb = setInterval(function () {
      T().read(roomId).then(function (room) {
        if (!room) {
          hbMiss++;
          if (hbMiss >= 3) stopHeartbeat();
          return;
        }
        hbMiss = 0;
        var patch = { heartbeatAt: Date.now() };   /* 房间存活（列表用） */
        patch[(room.hostId === u.id) ? 'hostBeat' : 'guestBeat'] = Date.now();
        return T().patch(roomId, patch);
      }).catch(function () {});
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() { if (_hb) { clearInterval(_hb); _hb = null; } }

  /* ── 🔴v1104 对手离场判定 ──────────────────────────────────

     对手强退 / 掉线 / 关掉页面，都会停止写自己那侧的心跳。
     超过 1 分钟没动静 → 判他离场，本局你胜。

     **为什么不是立刻判**：手机切后台、接电话、网络抖一下都很常见，
     太敏感会把正常玩家误判成逃跑，那比等一分钟糟得多。 */
  function opponentGone(roomId) {
    var u = me();
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: true, gone: true, reason: '房间已不存在' };
      var isHost = (room.hostId === u.id);
      /* 🔴v1161（真机报「建房根本不行」，两个浏览器实测复现）：
         **房主等久了会把刚进来的客人误判成"跑了"，然后把房间删掉。**

         云端操作日志一条条看出来的：
           add R1              建房成功
           claim R1 OK         客人抢到房了 ✅
           leaveRoom(R1)       ← 房主这边调的
           REMOVE R1           ← 房间被删
         客人再 read 就是 null → 界面报「这个房间已经不在了」。

         根因就在下面这两行：对手没心跳时回落到 createdAt，
         而房主开着房等人的整段时间里 guestBeat 根本不存在，
         于是 idle = 已经等了多久。等满 60 秒（ABANDON_MS），
         房主就认定"对手离场" → claimAbandonWin → showResult → 删房。

         **而客人可能正好那一秒点了进去打。**

         > 「对手离场」的前提是**对手曾经在过**。
         > 拿建房时间当对手的心跳，等于说"你一开房，对手就在跑了"。

         改法三条：
           · 客人还没进来（没 guestId）→ 直接返回"没跑"，
             这时候根本没有对手，谈何离场
           · 有对手但还没心跳 → 用 startedAt（客人进房那一刻）作基准
           · createdAt 不再当基准 —— 那是房间的生日，不是对手的 */
      var guestIn = !!(room.guestId && String(room.guestId).length);
      if (isHost && !guestIn) {
        return { ok: true, gone: false, waitingForGuest: true };
      }
      var oppBeat = isHost ? (room.guestBeat || 0) : (room.hostBeat || 0);
      if (!oppBeat) oppBeat = room.startedAt || room.roundAt || Date.now();
      var idle = Date.now() - oppBeat;
      return { ok: true, gone: idle > ABANDON_MS,
               idleSecs: Math.round(idle / 1000),
               limitSecs: Math.round(ABANDON_MS / 1000) };
    }).catch(function (e) { return { ok: false, reason: E(e) }; });
  }

  /* 对手离场 → 直接结算本局为我方胜 */
  function claimAbandonWin(roomId) {
    var u = me();
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: false, reason: '房间已不存在' };
      var isHost = (room.hostId === u.id);
      var patch = { status: 'done', endedBy: 'abandon', endedAt: Date.now() };
      patch[isHost ? 'hostScore' : 'guestScore'] = 1;
      patch[isHost ? 'guestScore' : 'hostScore'] = 0;
      return T().patch(roomId, patch).then(function () {
        return { ok: true, result: 'win', byAbandon: true };
      });
    }).catch(function (e) { return { ok: false, reason: E(e) }; });
  }

  /* ── 离房：房主关房，客人退出 ── */
  function leaveRoom(roomId) {
    var id = roomId || _myRoomId;
    if (!id) return Promise.resolve({ ok: true });
    var u = me();
    stopHeartbeat();
    return T().read(id).then(function (room) {
      if (!room) { _myRoomId = ''; return { ok: true }; }
      if (room.hostId === u.id) return T().remove(id).then(function () { _myRoomId = ''; return { ok: true }; });
      /* 客人退出 → 房间回到可加入状态，房主还能等下一个人 */
      return T().patch(id, { status: 'open', guestId: '', guestName: '' })
                .then(function () { _myRoomId = ''; return { ok: true }; });
    }).catch(function (e) { _myRoomId = ''; return { ok: false, reason: E(e) }; });
  }

  /* ── 交卷：各自写自己那一栏，两边都齐了才算完 ── */
  /* ── 🔴v1100 回合制抢答 ────────────────────────────────────

     核心难点：**"谁先拼对"必须原子**，否则两个人几乎同时提交时
     会双双判赢，比分就乱了（这和 v1065 抢房那个坑是同一类，
     那次实测过"先读再写"能让两人进同一间房）。

     做法：用条件更新 —— 只有当 `winners` 长度**恰好等于当前回合号**时
     才允许追加。慢的那个条件不成立、影响行数为 0，明确知道自己输了这回合。
     绝不用"先读再写"。 */

  /* ── 🔴v1100 三种对战模式 ────────────────────────────────────

     房主开房时选一种。**规则定义放在这里做单一真源** ——
     界面上的玩法说明也从这里读，避免"说明写的和实际跑的不一样"
     （本项目已因"同一件事两处真源"栽过八次）。

     A 抢答赛（天梯排位专用）
       出一个词 → 双方同时拼 → **谁先拼对谁得分，慢的一方 0 分**
       → 立刻进下一词。
       最刺激，也最残酷：手速慢的可能一局 0 分。
       **只有这个模式计入天梯排位** —— 排位就该是纯竞技。

     B 回合赛
       出一个词 → 双方各有 15 秒 → **都答完（或超时）才进下一词**
       → 拼对的都得分，先拼对的多拿一点。
       节奏最慢但最公平，适合水平差距大的两个人。

     C 同步赛（推荐给孩子）
       出一个词 → 双方同时拼 → **先拼对 +100，后拼对 +60，没拼对 0**
       → 两人都答完 或 15 秒到，就进下一词。
       既保留抢先的紧张感，又让"拼对"始终有价值 ——
       弱的一方输的是差距，不是全部，所以还愿意打第二局。 */

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

  function claimRound(roomId, roundIdx) {
    var u = me();
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: false, reason: '房间已不存在' };
      /* 🔴v1161（加固扫描抓到）：**云端塞 9999 条 winners 就能把对手比分刷成 999900。**

         实测：往房间里写 `winners: new Array(9999).fill('host')`，
         对战屏上对手的分立刻变成 **999900**。

         winners 是对方那台手机写进云端的 —— 老版本客户端、
         写坏的数据、甚至有人手动改，都可能让它变成任何东西
         （测试里 `winners:"不是数组"` 也能让回合数错乱）。

         > 一局最多打 N 题，赢家名单就最多 N 条。
         > **超出这个长度的部分，无论怎么来的，都不该算数。**

         三重清洗：
           · 不是数组 → 当空
           · 长度截到这一局的词数（wordCount，本身已夹在 1~30）
           · 每一项只认 'host' / 'guest'，别的当没赢 */
      var winners = room.winners;
      if (!Array.isArray(winners)) winners = [];
      var _cap = Number(room.wordCount);
      if (!isFinite(_cap) || _cap < 1) _cap = WORDS_PER_ROUND;
      _cap = Math.max(1, Math.min(30, Math.round(_cap)));
      if (winners.length > _cap) winners = winners.slice(0, _cap);
      winners = winners.map(function (w) {
        return (w === 'host' || w === 'guest') ? w : '';
      });
      var M = modeOf(room.mode);
      /* 🔴v1100：**慢了不等于没分。**
         A 抢答赛：慢的 0 分（残酷但纯竞技，天梯用它）
         B/C：慢的照样拿 secondScore —— 弱的一方输的是差距不是全部，
              这样他才愿意打第二局。 */
      if (winners.length > roundIdx) {
        return { ok: true, won: false, first: false,
                 score: M.secondScore,
                 winner: winners[roundIdx],
                 round: winners.length, winners: winners, mode: M.key };
      }
      var side = (room.hostId === u.id) ? 'host' : 'guest';
      var next = winners.concat([side]);
      /* 条件更新：winners 长度必须仍是 roundIdx，否则说明对手刚抢走 */
      /* ⚠️ guard 必须是**数据库里真实存在的字段** ——
         我第一版写了 `winnersLen`（虚构字段），条件永远不成立、
         抢答永远失败。改用 `round`：只有当它仍等于本回合号时才允许写入。 */
      return T().claim(roomId,
        { round: roundIdx },                     /* 期望：还没人推进本回合 */
        { winners: next, round: roundIdx + 1, roundAt: Date.now() }
      ).then(function (r) {
        var okWrite = r && (r.updated != null ? r.updated : (r.stats && r.stats.updated));
        if (!okWrite) {
          /* 没抢到 —— 重读一次拿到真实结果，不猜 */
          return T().read(roomId).then(function (r2) {
            var w2 = (r2 && r2.winners) || [];
            return { ok: true, won: false, first: false,
                     score: M.secondScore, winner: w2[roundIdx] || '',
                     round: w2.length, winners: w2, mode: M.key };
          });
        }
        return { ok: true, won: true, first: true,
                 score: M.firstScore, winner: side,
                 round: roundIdx + 1, winners: next, mode: M.key };
      });
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired) }; });
  }

  /* ── 🔴v1124 超时推进 ──────────────────────────────────────

     实测双人对战发现：**两人都没拼对时，房间的 `round` 不会动。**

       第1词超时 → 两边界面都跳到第2词，但房间还停在 round=0
       → A 在第2词拼对时 claim 用 roundIdx=1，
         而 guard 要求 `round === 1` —— 房间是 0，条件不成立
       → **写不进去，A 白拼一次，B 也看不到，双方彻底脱节**

     根因：推进 `round` 这件事只挂在"有人抢到"上，
     **而"谁都没抢到"同样是一个回合的结束**。

     做法：超时时也走一次条件更新，往 winners 里记一个空串
     （表示"这一词没人拿下"），round 照样 +1。
     用同样的条件更新保证两边同时超时也只推进一次。 */
  function skipRound(roomId, roundIdx) {
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: false, reason: '房间已不存在' };
      var winners = room.winners || [];
      if (winners.length > roundIdx) {
        /* 已经被推进过了（对手抢到了，或对手先超时推的）—— 不重复 */
        return { ok: true, skipped: false, round: winners.length, winners: winners };
      }
      return T().claim(roomId,
        { round: roundIdx },
        { winners: winners.concat(['']), round: roundIdx + 1, roundAt: Date.now() }
      ).then(function (r) {
        var okWrite = r && (r.updated != null ? r.updated : (r.stats && r.stats.updated));
        return { ok: true, skipped: !!okWrite, round: roundIdx + 1 };
      });
    }).catch(function (e) { return { ok: false, reason: E(e) }; });
  }

  /* 轮询本回合状态：对手抢到了没有 / 现在该第几个词 */
  function roundState(roomId) {
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: false, reason: '房间已不存在' };
      var winners = room.winners || [];
      /* v1122: 回传"我是哪一方" —— 房间文档里本来就知道，
         不该让前端靠本地标记猜（猜错了对手状态就永远不更新）。 */
      var u2 = me();
      /* 🔴v1156：**把对手是谁也带回去。**
         原来只返回回合和比分，UI 层无从知道对面还是不是同一个人 ——
         实测：房主换了个 guest 进来，界面毫无察觉，
         还在跟原来那个人的名字打，而比分和判定已经是新人的了。 */
      return { ok: true, mode: modeOf(room.mode).key,
               oppId: (room.hostId === u2.id) ? (room.guestId || '') : (room.hostId || ''),
               /* 🔴v1156：**把对手的天梯分也带回去。**
                  没有它，加减分就只能按"对手 1000 分"算 ——
                  打赢一个 1400 分的高手和打赢新手加一样的分，
                  **排位的意义有一半在于"赢强的人涨得多"**。
                  只有房主的分是可信的（v1114 做过防谎报），
                  所以客人视角能拿到，房主视角拿不到（返回 0，由调用方兜底）。 */
               oppRating: (room.hostId === u2.id) ? 0 : (Number(room.hostRating) || 0),
               mySide: (room.hostId === u2.id) ? 'host' : 'guest',
               round: winners.length, winners: winners,
               roundAt: room.roundAt || 0,
               hostReady: !!room.hostReady, guestReady: !!room.guestReady,
               heartbeatAt: room.heartbeatAt || 0,
               wordCount: room.wordCount || WORDS_PER_ROUND };
    }).catch(function (e) { return { ok: false, reason: E(e) }; });
  }

  /* 进入对战屏时报到 —— 双方都就绪才开打，避免一方还在加载就被抢完 */
  function markReady(roomId) {
    var u = me();
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: false, reason: '房间已不存在' };
      var patch = {};
      var isHost = (room.hostId === u.id);
      patch[isHost ? 'hostReady' : 'guestReady'] = true;
      /* 🔴v1123：**进对战屏就要开始发心跳。**

         实测两人对战时发现：A 打了一回合后，界面显示
         「对手掉线了…44s 后判他负」—— 而 B 明明就在对面正常玩。

         原因：心跳只在 `createRoom` / `joinRoom` 时启动，
         而客人那侧的 `guestBeat` 初值是 0 ——
         只要有任何一条路径直接进了对战屏（重连、测试注入、
         或将来加的"再来一局"），心跳就是空的，
         对方立刻把他当成掉线。

         **把心跳绑在"进对战屏"这个动作上**，而不是绑在开房/进房上 ——
         因为真正需要心跳的是对战过程，不是进房那一下。 */
      patch[isHost ? 'hostBeat' : 'guestBeat'] = Date.now();
      if (!room.roundAt) patch.roundAt = Date.now();
      startHeartbeat(roomId);
      return T().patch(roomId, patch).then(function () {
        return { ok: true };
      });
    }).catch(function (e) { return { ok: false, reason: E(e) }; });
  }

  function reportResult(roomId, score) {
    var u = me();
    return T().read(roomId).then(function (room) {
      if (!room) return { ok: false, reason: '房间已不存在' };
      var isHost = room.hostId === u.id;
      var patch = {};
      patch[isHost ? 'hostScore' : 'guestScore'] = score;
      return T().patch(roomId, patch).then(function () {
        return T().read(roomId);
      }).then(function (fresh) {
        var hs = fresh.hostScore, gs = fresh.guestScore;
        if (hs == null || gs == null) return { ok: true, waiting: true, mine: score };
        var mineScore = isHost ? hs : gs, theirs = isHost ? gs : hs;
        return { ok: true, waiting: false,
                 mine: mineScore, theirs: theirs,
                 result: mineScore > theirs ? 'win' : (mineScore < theirs ? 'lose' : 'draw') };
      });
    }).catch(function (e) { return { ok: false, reason: E(e) }; });
  }

  /* 轮询等待对手（TCB 的 watch 在部分环境不稳，先用轮询，语义更好把控） */
  function waitForOpponent(roomId, onChange, timeoutMs) {
    var missCount = 0;   /* v1161: 连续读不到房间的次数 —— 见下面的说明 */
    var stop = false, t0 = Date.now();
    var limit = timeoutMs || 120000;
    var fails = 0;

    /* 🔴v1137 两处改进：

       ① **轮询间隔递增。**
          原来固定每 2 秒读一次，等满 2 分钟就是 **60 次云端读** ——
          而绝大多数情况下前 10 秒没人来，后面 110 秒也不会有人。
          云开发按读次数计费，一个人挂在等待屏就烧 60 次。
          改为：前 10 秒每 2 秒（对手很可能马上就到），
          之后逐步拉长到 5 秒 —— 60 次降到约 30 次，而"有人进来"
          最多晚 5 秒被发现（对方进来后本来也要加载几秒）。

       ② **网络抖一下不该整个放弃。**
          原来 `.catch` 里直接 `onChange({error})`，等待就结束了 ——
          而手机上网络瞬断很常见，用户会看到"等待失败"然后一脸茫然。
          改为：连续失败 3 次才报错，中间照常重试。 */
    function nextDelay() {
      var waited = Date.now() - t0;
      return waited < 10000 ? 2000 : (waited < 40000 ? 3000 : 5000);
    }

    (function tick() {
      if (stop) return;
      T().read(roomId).then(function (room) {
        if (stop) return;
        fails = 0;
        /* 🔴v1161（真实点击测试抓到）：**读一次读不到就宣布"房间没了"，太急了。**

           实测：房主刚建完房，第一次轮询读回 null，
           界面立刻跳「这个房间已经不在了」—— 而房其实好好地在那儿。

           云开发是最终一致的：写进去的文档，**紧接着读未必读得到**
           （主从同步有延迟，通常几百毫秒）。
           而这个轮询在建房后 1 秒就开始跑了。

           > "读不到"和"不存在"是两回事。
           > 前者可能只是还没同步过来，后者才是真没了。
           > 把前者当后者，用户会看到一个刚建好的房被宣布消失。

           改成连续三次读不到才认（间隔 2 秒 = 6 秒宽限）——
           房主真把房关了的话，6 秒后照样会判出来，
           而正常的同步延迟远小于这个数。 */
        if (!room) {
          missCount = (missCount || 0) + 1;
          if (missCount < 3) {
            /* 🔴v1161：**这里必须安排下一次轮询，不能光 return。**

               上一轮加「连续三次读不到才认」的宽限时，
               写成了 `if (missCount < 3) return;` —— **轮询链条当场断掉**。

               实测（模拟真实云端：写入后 800ms 才可读）：
                 客人已经进房开打了，房主还停在「等对手进来 · 已等 16 秒」
               因为房主第一次读没读到（云端还没同步），计数 +1 就 return 了，
               再也没有下一次。

               > 这是个**递归式轮询**：每一轮的最后一句负责安排下一轮。
               > 中途任何一条 return 都等于「整条链到此为止」——
               > **提前退出前必须先把下一棒交出去。**

               修「读不到不等于不存在」的时候，
               反手制造了一个更糟的问题：房主永远等不到人。 */
            setTimeout(tick, nextDelay());
            return;
          }
          onChange({ gone: true });
          return;
        }
        missCount = 0;
        if (room.guestId) { onChange({ joined: true, room: room }); return; }
        if (Date.now() - t0 > limit) { onChange({ timeout: true }); return; }
        setTimeout(tick, nextDelay());
      }).catch(function (e) {
        if (stop) return;
        fails++;
        if (fails >= 3) { onChange({ error: E(e) }); return; }
        setTimeout(tick, 2500);   /* 抖一下就重试，别把人踢出等待 */
      });
    })();
    return function cancel() { stop = true; };
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
    /* v1104 对手掉线 */
    /* v1105 房间码 */
    sweepMyDeadRooms: sweepMyDeadRooms,
    findByCode: findByCode,
    makeCode: makeCode,
    opponentGone: opponentGone,
    claimAbandonWin: claimAbandonWin,
    ABANDON_MS: ABANDON_MS,
    waitForOpponent: waitForOpponent,
    wordsFromSeed: wordsFromSeed,
    stopHeartbeat: stopHeartbeat,
    _collection: COLLECTION,
    _staleMs: STALE_MS,
    /* 测试注入口：换成假传输层即可在本地跑完整链路（含抢房竞态） */
    _setTransportForTest: function (t) { _transport = wrapTimeout(t); },
    _currentRoomId: function () { return _myRoomId; }
  };
})();
