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
        var app = A._app();
        if (!app) throw new Error('云端实例不可用');
        return app.database();
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
      listOpen: function (nowTs) {
        return db().then(function (d) {
          return d.collection(COLLECTION)
                  .where({ status: 'open', isPrivate: false })   /* v1105: 私密房不进公开列表 */
                  .orderBy('createdAt', 'desc').limit(30).get()
                  .then(function (r) {
                    var rows = (r && r.data) || [];
                    /* 心跳过期的房间不展示——房主可能直接关了页面，来不及删房 */
                    return rows.filter(function (x) { return (nowTs - (x.heartbeatAt || 0)) < STALE_MS; });
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
        return withTimeout(fn.apply(tx, arguments),
          FAST[k] ? NET_TIMEOUT_FAST_MS : NET_TIMEOUT_MS);
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
    var now = Date.now();
    var seed = (now ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    var doc = {
      status: 'open',
      /* v1105: 私密房带 4 位码，不出现在公开列表；公开房 code 为空 */
      code: opts.private ? makeCode() : '',
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
    _creating = T().add(doc).then(function (r) {
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

  /* ── 列房：只列还活着的公开房，且不列自己开的 ── */
  function listRooms() {
    var u = me();
    return T().listOpen(Date.now()).then(function (rows) {
      return {
        ok: true,
        rooms: (rows || []).map(function (x) {
          return {
            id: x._id || x.id, hostName: x.hostName || '无名蜂', hostTier: x.hostTier || '',
            wordCount: x.wordCount || WORDS_PER_ROUND,
            mine: !!(u.id && x.hostId === u.id),
            ageSec: Math.max(0, Math.round((Date.now() - (x.createdAt || 0)) / 1000))
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
        _myRoomId = roomId;
        /* 🔴v1104：客人也要发心跳 —— 否则房主检测不到客人掉线，
           会一直干等。原来只有房主发，这是个明显的不对称。 */
        startHeartbeat(roomId);
        return { ok: true, roomId: roomId, room: room,
                 words: wordsFromSeed(room.seed, room.wordCount || WORDS_PER_ROUND) };
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

  function startHeartbeat(roomId) {
    stopHeartbeat();
    var u = me();
    _hb = setInterval(function () {
      T().read(roomId).then(function (room) {
        if (!room) return;
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
      var oppBeat = isHost ? (room.guestBeat || 0) : (room.hostBeat || 0);
      /* 对手还没发过任何心跳 —— 用房间创建/加入时间兜底，
         否则刚开局那几秒会被误判成"对手从没来过" */
      if (!oppBeat) oppBeat = room.roundAt || room.createdAt || Date.now();
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
      var winners = room.winners || [];
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
      return { ok: true, mode: modeOf(room.mode).key,
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
    var stop = false, t0 = Date.now();
    var limit = timeoutMs || 120000;
    (function tick() {
      if (stop) return;
      T().read(roomId).then(function (room) {
        if (stop) return;
        if (!room) { onChange({ gone: true }); return; }
        if (room.guestId) { onChange({ joined: true, room: room }); return; }
        if (Date.now() - t0 > limit) { onChange({ timeout: true }); return; }
        setTimeout(tick, 2000);
      }).catch(function (e) {
        if (!stop) { onChange({ error: E(e) }); }
      });
    })();
    return function cancel() { stop = true; };
  }

  window.HansenPkRoom = {
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
