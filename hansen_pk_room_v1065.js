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
    try { if (window.HBErrText) return window.HBErrText(e); } catch (_) {}
    if (e == null) return '';
    if (typeof e === 'string') return e;
    var v = e.error_description || e.errMsg || e.message || e.error || e.reason;
    if (v != null && typeof v !== 'object') return String(v);
    try { var j = JSON.stringify(e); if (j && j !== '{}') return j; } catch (_) {}
    return '(无法解析的错误对象)';
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
                  .where({ status: 'open' })
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

  function T() {
    if (_transport) return _transport;
    _transport = realTransport();
    return _transport;
  }

  function me() {
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
  function createRoom(opts) {
    opts = opts || {};
    var u = me();
    if (!u.id) return Promise.reject(new Error('请先登录再开房'));
    var now = Date.now();
    var seed = (now ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    var doc = {
      status: 'open',
      hostId: u.id, hostName: u.name,
      hostTier: opts.tier || '',
      guestId: '', guestName: '',
      seed: seed,
      wordCount: opts.wordCount || WORDS_PER_ROUND,
      createdAt: now, heartbeatAt: now,
      hostScore: null, guestScore: null
    };
    return T().add(doc).then(function (r) {
      _myRoomId = r.id;
      startHeartbeat(r.id);
      return { ok: true, roomId: r.id, room: doc, words: wordsFromSeed(seed, doc.wordCount) };
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired) }; });
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
        return { ok: true, roomId: roomId, room: room,
                 words: wordsFromSeed(room.seed, room.wordCount || WORDS_PER_ROUND) };
      });
    }).catch(function (e) { return { ok: false, reason: E(e), expired: !!(e && e.expired) }; });
  }

  /* ── 心跳：房主定期续命，30 秒不续就不再被列出 ── */
  function startHeartbeat(roomId) {
    stopHeartbeat();
    _hb = setInterval(function () {
      T().patch(roomId, { heartbeatAt: Date.now() }).catch(function () {});
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() { if (_hb) { clearInterval(_hb); _hb = null; } }

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
    waitForOpponent: waitForOpponent,
    wordsFromSeed: wordsFromSeed,
    stopHeartbeat: stopHeartbeat,
    _collection: COLLECTION,
    _staleMs: STALE_MS,
    /* 测试注入口：换成假传输层即可在本地跑完整链路（含抢房竞态） */
    _setTransportForTest: function (t) { _transport = t; },
    _currentRoomId: function () { return _myRoomId; }
  };
})();
