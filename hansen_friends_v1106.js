/* hansen_friends_v1106.js —— 好友 · 在线状态 · 隐身 · 快捷语
 *
 * ═══ 产品定义 ═══
 *
 * 用户要的：
 *   · 加好友，加了之后能直接约战
 *   · 登录后可设置状态：在线（头像亮，带绿点）/ 隐身（对别人完全等于离线）
 *   · **只能发固定快捷语，不能打字聊天**
 *
 * ═══ 为什么不做自由聊天（用户拍板，我完全同意）═══
 *
 * 这是给孩子用的产品。自由输入意味着：
 *   陌生人能给孩子发任意内容 → 需要敏感词过滤、举报、拉黑、人工审核
 *   → 合规上是另一个量级的事，而**孩子想聊天本来就有微信**。
 *
 * 固定快捷语既保留了互动感，又完全避开内容安全 —— 发出去的每一句
 * 都是我们预先写好的，不存在"用户发了什么"这个问题。
 *
 * ═══ 关于"在线"这件事，我要说实话 ═══
 *
 * 网页应用没有真正的长连接在线：
 *   · 页面一关就不再发心跳
 *   · 手机切到微信聊天，后台页面会被冻结
 * 所以绿点的真实含义是「**最近一分钟还开着页面**」，不是"此刻正盯着屏幕"。
 * 界面上因此用「刚才还在」这类措辞，而不是斩钉截铁的"在线中"。
 *
 * ═══ 用竞赛 ID 互加，不用手机号 ═══
 *
 * 手机号是隐私，绝不能作为加好友的凭据。
 * 竞赛 ID（No.001 那个）终身不变、本来就公开显示，正合适。
 *
 * ═══ 🔴v1164：每个人只写自己的记录 ═══
 *
 * 集合权限是「读取全部数据，修改本人数据」：谁都能读，**只有创建者能改、能删**。
 * 以前加好友时去改对方那条（转 accepted）、删好友时去删对方那条 ——
 * 这在云端**一律静默失败**，所以"互为好友"从来没成立过，删了对方那边也还在。
 *
 * 现在的规矩：
 *   · 「我加了他」= 我自己写的一条 friend 记录（owner=我）
 *   · **互为好友 = 两边各自那条都在**（读出来比对，不靠谁去改谁）
 *   · 删好友 = 删我自己那条；对方那边自然就变回「等他也加你」
 *   · 对方加了我、我还没加他 → 列表里显示「想加你为好友」，点一下就加回去
 *   · 哪条记录是我写的，看数据库自动盖的 `_openid`（客户端改不了）：
 *     我第一次写在线记录后读回来，就知道了自己的 `_openid`
 *
 * 用的是账号模块（HansenAuth）那一个云端实例，不另建 —— 多实例会并发刷新登录凭证。
 */
(function () {
  'use strict';
  if (window.HansenFriends) return;

  var COLLECTION = 'hansen_friends';     /* 好友关系 + 在线状态 */
  var MSG_COLL = 'hansen_friend_msgs';   /* 快捷语消息 */
  var PERM_TEXT = '读取全部数据，修改本人数据';
  var ONLINE_MS = 60000;                 /* 60 秒内有心跳算"刚才还在" */
  var BEAT_MS = 20000;                   /* 每 20 秒续一次 */
  var MAX_FRIENDS = 50;
  var STALE_ROW_MS = 10 * 60000;         /* 自己留下的旧在线记录，10 分钟没动就清掉 */
  var MSG_KEEP_MS = 7 * 86400000;        /* 自己发出的招呼留 7 天，之后发件人自己删 */
  var NET_TIMEOUT_MS = 12000;

  /* ── 🔴 快捷语：全部预先写死，用户只能从这里选 ──────────────
     不允许自由输入 = 不存在内容安全问题。
     分三类，覆盖对战场景里真正会想说的话。 */
  var QUICK = [
    { id: 'pk',    text: '来一局？',        emoji: '⚔️' },
    { id: 'wait',  text: '等我五分钟',      emoji: '⏳' },
    { id: 'gg',    text: '打得好！',        emoji: '👏' },
    { id: 'again', text: '再来一把',        emoji: '🔁' },
    { id: 'win',   text: '我赢啦～',        emoji: '🎉' },
    { id: 'lose',  text: '这局我认输',      emoji: '😅' },
    { id: 'hi',    text: '嗨',              emoji: '👋' },
    { id: 'bye',   text: '我先下了，拜拜',  emoji: '🌙' },
    { id: 'busy',  text: '我在忙，晚点找你', emoji: '📚' },
    { id: 'nice',  text: '你好厉害',        emoji: '🐝' }
  ];

  var _tx = null, _real = null, _beat = null;

  /* ── 错误分类（和对战房间同一套 kind；见设计规格 §2）──────────────
     失败统一返回 { ok:false, kind, reason:'人话 ⟨原话⟩', text:人话, expired, code? } */
  var KINDS = { network: 1, slow: 1, session: 1, expired: 1, config: 1, gone: 1, taken: 1, self: 1, other: 1 };
  var HUMAN = {
    network: '连不上网络，检查一下 Wi-Fi 或数据再试',
    slow: '网络太慢，这次没连上，等会儿再试',
    session: '云端还没连上，等几秒再试',
    expired: '云端登录过期了，重新登录一次就好',
    other: '没成功，等会儿再试'
  };

  function kErr(kind, human, raw) {
    var e = new Error(raw || human);
    e.kind = kind; e.human = human;
    return e;
  }
  /* 原话：SDK 抛的常是普通对象，String() 会变成 [object Object] */
  function rawText(e) {
    if (e == null) return '';
    if (typeof e === 'string') return e;
    var parts = [];
    ['code', 'error', 'error_description', 'message', 'reason'].forEach(function (k) {
      var v = e[k];
      if (v != null && typeof v !== 'object') {
        var s = String(v);
        if (s && parts.indexOf(s) < 0) parts.push(s);
      }
    });
    if (parts.length) return parts.join(' | ');
    try { var j = JSON.stringify(e); if (j && j !== '{}') return j; } catch (x) {}
    return '';
  }
  function kindOf(e) {
    if (e && typeof e === 'object') {
      if (typeof e.kind === 'string' && KINDS[e.kind]) return e.kind;
      if (e.timeout) return 'slow';
      if (typeof e.code === 'string' && e.code) {
        return /TOKEN|UNAUTH|CREDENTIAL|LOGIN/i.test(e.code) ? 'expired' : 'config';
      }
    }
    var t = rawText(e);
    if (/DATABASE_[A-Z_]+|PERMISSION_DENIED|COLLECTION_NOT_EXIST|INVALID_PARAM/.test(t)) return 'config';
    if (/unauthenticated|credentials not found|invalid_grant|refresh token/i.test(t)) return 'expired';
    if (/timeout|timed out|超时|太慢/i.test(t)) return 'slow';
    if (/network request error|failed to fetch|networkerror|load failed|unreachable|net::/i.test(t)) return 'network';
    return 'other';
  }
  function configHuman(e, t) {
    var col = '「' + ((e && e.collection) || COLLECTION) + '」';
    var code = String((e && e.code) || (/[A-Z][A-Z_]{6,}/.exec(t) || [])[0] || '');
    if (/NOT_EXIST/.test(code) || /not exist/i.test(t))
      return '云端设置还差一步：还没有建数据库集合' + col + '。请老师在云开发控制台 → 数据库里新建它，'
           + '权限选「' + PERM_TEXT + '」';
    if (/PERMISSION/.test(code + t))
      return '云端设置还差一步：数据库集合' + col + '的权限不对，请在云开发控制台把它改成「' + PERM_TEXT + '」';
    return '云端设置还差一步：云端拒绝了好友功能的读写（' + (code || '未知错误') + '），请把技术信息发给负责的老师';
  }
  function fail(e) {
    var k = kindOf(e);
    var t = rawText(e);
    var human = (e && typeof e.human === 'string' && e.human) ||
                (k === 'config' ? configHuman(e, t) : (HUMAN[k] || HUMAN.other));
    var r = { ok: false, kind: k, expired: k === 'expired', text: human,
              reason: (t && t !== human) ? human + ' ⟨' + t.slice(0, 160) + '⟩' : human };
    if (e && typeof e.code === 'string' && e.code) r.code = e.code;
    return r;
  }

  /* 🔴v1115 统一超时：弱信号下请求会卡住不返回 —— 既不成功也不失败，
     界面一直转圈，比断网更折磨人。 */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return; done = true;
        /* 🔴v1115：**文案里不许露内部方法名** —— 报错是给人看的。 */
        var e = new Error('网络太慢，这次没连上，检查一下网络再试');
        e.friendly = true; e.timeout = true;
        reject(e);
      }, ms || NET_TIMEOUT_MS);
      Promise.resolve(promise).then(function (v) {
        if (done) return; done = true; clearTimeout(t); resolve(v);
      }, function (err) { if (done) return; done = true; clearTimeout(t); reject(err); });
    });
  }

  function wrapTimeout(tx) {
    if (!tx || tx.__wrapped) return tx;
    var out = { __wrapped: true };
    Object.keys(tx).forEach(function (k) {
      var fn = tx[k];
      if (typeof fn !== 'function') { out[k] = fn; return; }
      out[k] = function () { return withTimeout(fn.apply(tx, arguments), NET_TIMEOUT_MS); };
    });
    return out;
  }

  /* ── 云端：账号模块的实例 + 会话 ───────────────────────── */
  var _sessOkAt = 0;
  function db() {
    var A = window.HansenAuth;
    if (!A || typeof A._app !== 'function' || typeof A.ensureSession !== 'function') {
      return Promise.reject(kErr('other', '账号模块还没加载好，刷新一下页面再试', 'HansenAuth 未加载'));
    }
    if (typeof A.isSignedIn === 'function' && !A.isSignedIn()) {
      return Promise.reject(kErr('expired', '先登录才能用好友功能', 'not-signed-in'));
    }
    /* 15 秒内刚确认过会话就不再问：一屏好友要查三四次库 */
    var sess = (Date.now() - _sessOkAt < 15000) ? Promise.resolve({ ok: true })
      : Promise.resolve().then(function () { return A.ensureSession(); });
    return sess.then(function (s) {
      if (!s || !s.ok) {
        if (s && s.notSignedIn) throw kErr('expired', '先登录才能用好友功能', 'not-signed-in');
        var k = (s && KINDS[s.kind]) ? s.kind : (s && s.expired ? 'expired' : (s && (s.slow || s.timeout) ? 'slow' : 'session'));
        throw kErr(k, HUMAN[k] || HUMAN.other, (s && s.reason) || '会话不可用');
      }
      _sessOkAt = Date.now();
      return withTimeout(Promise.resolve().then(function () { return A._app(); }), NET_TIMEOUT_MS);
    }).then(function (app) {
      if (!app || typeof app.database !== 'function') {
        throw kErr('other', '云端模块没加载好，刷新一下页面再试', 'app.database 不可用');
      }
      return app.database();
    });
  }

  /* SDK 出错时不抛，而是照常返回 {code, message}（权限不够、集合没建都是这样）——
     这里统一变成异常，并带上是哪个集合，界面才能说清楚去控制台改哪里。 */
  function call(p, what, coll) {
    return withTimeout(p, NET_TIMEOUT_MS).then(function (r) {
      if (r && r.code) {
        var e = new Error(what + '：' + String(r.message || '云端拒绝').slice(0, 100));
        e.code = String(r.code); e.cloud = true; e.collection = coll;
        throw e;
      }
      return r;
    });
  }

  /* 查询条件里允许 {$in:[…]} / {$lt:n}，在这里换成 SDK 的 command */
  function conv(d, where) {
    var out = {};
    Object.keys(where || {}).forEach(function (k) {
      var v = where[k];
      if (v && typeof v === 'object' && Array.isArray(v.$in)) out[k] = d.command['in'](v.$in);
      else if (v && typeof v === 'object' && typeof v.$lt === 'number') out[k] = d.command.lt(v.$lt);
      else out[k] = v;
    });
    return out;
  }

  /* 传输层单独一层，便于测试注入（与 pk_room 同样的做法） */
  function realTransport() {
    function listIn(coll, what, where, opts) {
      return db().then(function (d) {
        var lim = (opts && opts.limit) || 100;
        var base = d.collection(coll).where(conv(d, where));
        if (!(opts && opts.newestFirst)) {
          return call(base.limit(lim).get(), what, coll).then(function (r) { return (r && r.data) || []; });
        }
        /* 按时间倒序：云端没建排序索引时 orderBy 会被拒 → 退回不排序的查询，本地排 */
        return call(base.orderBy('at', 'desc').limit(lim).get(), what, coll)['catch'](function (indexErr) {
          if (kindOf(indexErr) !== 'config') throw indexErr;
          return call(d.collection(coll).where(conv(d, where)).limit(Math.max(lim, 100)).get(), what, coll);
        }).then(function (r) { return (r && r.data) || []; });
      });
    }
    function addIn(coll, what, doc) {
      return db().then(function (d) {
        return call(d.collection(coll).add(doc), what, coll).then(function (r) {
          return { id: (r && (r.id || r._id)) || '' };
        });
      });
    }
    function removeIn(coll, what, id) {
      return db().then(function (d) {
        return call(d.collection(coll).doc(id).remove(), what, coll).then(function (r) {
          return { deleted: (r && typeof r.deleted === 'number') ? r.deleted : 0 };
        });
      });
    }
    return {
      read: function (id) {
        return db().then(function (d) {
          return call(d.collection(COLLECTION).doc(id).get(), '读取好友记录', COLLECTION).then(function (r) {
            return (r && r.data && r.data[0]) || null;
          });
        });
      },
      list: function (where, opts) { return listIn(COLLECTION, '读取好友记录', where, opts); },
      add: function (doc) { return addIn(COLLECTION, '写好友记录', doc); },
      patch: function (id, data) {
        return db().then(function (d) {
          return call(d.collection(COLLECTION).doc(id).update(data), '更新好友记录', COLLECTION).then(function (r) {
            return { updated: (r && typeof r.updated === 'number') ? r.updated : 0 };
          });
        });
      },
      remove: function (id) { return removeIn(COLLECTION, '删除好友记录', id); },
      addMsg: function (doc) { return addIn(MSG_COLL, '发招呼', doc); },
      listMsg: function (where, opts) { return listIn(MSG_COLL, '读取招呼', where, opts); },
      removeMsg: function (id) { return removeIn(MSG_COLL, '清理旧招呼', id); }
    };
  }

  function T() {
    if (_tx) return _tx;
    if (!_real) _real = realTransport();
    return _real;
  }

  function noop() {}
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function me() {
    var P = window.HansenSbProfile;
    var cid = 0, name = '';
    try {
      var pf = P && P.readProfile && P.readProfile();
      cid = (pf && pf.cid) || 0;
      name = (P && typeof P.displayName === 'function') ? P.displayName() : ((pf && pf.name) || '');
    } catch (e) {}
    return { cid: cid, name: name || '无名蜂' };
  }

  /* ── 我是谁（数据库眼里）────────────────────────────────
     数据库给每条记录注入的 _openid 是唯一可信身份（服务端写的，客户端改不了）。
     我第一次写在线记录后读回来就知道了；记在本机（按竞赛 ID 分开），下次直接用。 */
  var ME_KEY = 'hansen_friend_me_v1164';
  var _id = { cid: 0, openid: '', pid: '', presenceId: '' };
  var _ensuring = null;

  function idFor(u) {
    if (_id.cid !== u.cid) {
      var c = lsGet(ME_KEY);
      _id = { cid: u.cid, openid: '', pid: '', presenceId: '' };
      if (c && c.cid === u.cid) { _id.openid = String(c.openid || ''); _id.pid = String(c.pid || ''); }
    }
    return _id;
  }
  function saveId(m) { lsSet(ME_KEY, { cid: m.cid, openid: m.openid, pid: m.presenceId }); }
  function isMine(m, r) {
    if (!r) return false;
    if (m.openid) return r._openid === m.openid;
    return true;     /* 云端不盖 _openid 的环境：只能信 owner 字段 */
  }
  function myOpenid() { return _id.openid; }

  /* 刚写的记录读回来：拿到 _openid（读不到就多等一下，云端偶尔慢半拍） */
  function readBack(id, tries) {
    return T().read(id).then(function (doc) {
      if (doc || tries <= 0) return doc;
      return wait(500).then(function () { return readBack(id, tries - 1); });
    });
  }

  /* 保证我有一条自己的在线记录，并知道自己的 _openid */
  function ensureMe(u) {
    var m = idFor(u);
    if (m.presenceId) return Promise.resolve(m);
    if (_ensuring && _ensuring.cid === u.cid) return _ensuring.p;
    var p = T().list({ kind: 'presence', cid: u.cid }).then(function (rows) {
      var own = (rows || []).filter(function (r) {
        return m.openid ? r._openid === m.openid : (!!m.pid && r._id === m.pid);
      }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      if (own.length) {
        m.presenceId = own[0]._id;
        if (!m.openid && own[0]._openid) m.openid = own[0]._openid;
        saveId(m);
        sweepPresence(m, own.slice(1));
        return m;
      }
      /* 没有自己的在线记录 → 写一条（隐身时 at=0，对别人就是不在线） */
      var at = myStatus() === 'online' ? Date.now() : 0;
      return T().add({ kind: 'presence', cid: u.cid, name: u.name, at: at }).then(function (r) {
        var id = r && r.id;
        if (!id) throw kErr('other', '在线状态没写上，等会儿再试', 'add 没有返回 _id');
        return readBack(id, 4).then(function (doc) {
          m.presenceId = id;
          if (doc && doc._openid) m.openid = doc._openid;
          m.fresh = true;
          saveId(m);
          /* 以前留下的、确认是我自己的旧记录顺手清掉 */
          if (m.openid) {
            sweepPresence(m, (rows || []).filter(function (x) { return x._openid === m.openid && x._id !== id; }));
          }
          return m;
        });
      });
    });
    _ensuring = { cid: u.cid, p: p };
    var clear = function () { if (_ensuring && _ensuring.p === p) _ensuring = null; };
    p.then(clear, clear);
    return p;
  }

  /* 只删自己的、而且 10 分钟没动过的（另一台设备正开着的那条不能删） */
  function sweepPresence(m, rows) {
    var now = Date.now();
    var old = (rows || []).filter(function (r) {
      return r && r._id !== m.presenceId && isMine(m, r) && m.openid && ((r.at || 0) < now - STALE_ROW_MS);
    }).slice(0, 5);
    old.forEach(function (r) { T().remove(r._id)['catch'](noop); });
  }

  /* ── 我的状态：在线 / 隐身 ───────────────────────────────── */
  var STATUS_KEY = 'hansen_friend_status';

  function myStatus() {
    try { return localStorage.getItem(STATUS_KEY) === 'hidden' ? 'hidden' : 'online'; }
    catch (e) { return 'online'; }
  }

  function setStatus(s) {
    var v = (s === 'hidden') ? 'hidden' : 'online';
    try { localStorage.setItem(STATUS_KEY, v); } catch (e) {}
    /* 切成隐身要立刻把心跳抹掉，否则对方还能看到 60 秒的绿点 */
    if (v === 'hidden') { stopBeat(); clearBeat(); }
    else startBeat();
    return v;
  }

  /* 心跳：只有"在线"才写，而且只写我自己那条。隐身 = 完全不写 = 对别人就是离线 */
  function beat() {
    if (myStatus() !== 'online') return Promise.resolve({ ok: true, hidden: true });
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, kind: 'expired', reason: '先登录' });
    return ensureMe(u).then(function (m) {
      if (m.fresh) { m.fresh = false; return { updated: 1 }; }     /* 刚写的那条已经带着现在的时间 */
      return T().patch(m.presenceId, { at: Date.now(), name: u.name }).then(function (r) {
        if (r && r.updated > 0) return r;
        /* 改了 0 条 = 那条没了（被清理过）→ 重新写一条 */
        m.presenceId = '';
        return ensureMe(u);
      });
    }).then(function () { return { ok: true }; })['catch'](function (e) { return fail(e); });
  }

  function clearBeat() {
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false });
    return ensureMe(u).then(function (m) {
      m.fresh = false;
      return T().patch(m.presenceId, { at: 0 });
    }).then(function () { return { ok: true }; })['catch'](function (e) { return fail(e); });
  }

  function startBeat() {
    stopBeat();
    if (myStatus() !== 'online') return;
    beat();
    _beat = setInterval(beat, BEAT_MS);
  }
  function stopBeat() { if (_beat) { clearInterval(_beat); _beat = null; } }

  /* ── 不想加的人（本机记，按我的竞赛 ID 分开）──────────────
     删了好友以后，对方那条「我加了你」还在（那是他的记录，我删不了）。
     记下"什么时候不想看了"：他之后重新加我（记录时间更新）才再提示。 */
  var IGN_KEY = 'hansen_friend_ignore_v1164';
  function ignMap(myCid) {
    var all = lsGet(IGN_KEY) || {};
    return (all && typeof all === 'object' && all[myCid]) || {};
  }
  function setIgnore(myCid, cid, at) {
    var all = lsGet(IGN_KEY);
    if (!all || typeof all !== 'object') all = {};
    var m = all[myCid] || {};
    if (at) m[cid] = at; else delete m[cid];
    all[myCid] = m;
    lsSet(IGN_KEY, all);
  }
  function ignoreRequest(cid) {
    var u = me();
    var c = Math.floor(Number(cid) || 0);
    if (!u.cid || !c) return { ok: false };
    setIgnore(u.cid, c, Date.now());
    return { ok: true };
  }

  /* 在线记录按竞赛 ID 分组；同一个号有好几条时，优先认和他好友记录同一个 _openid 的那条 */
  function groupPresence(rows) {
    var by = {};
    (rows || []).forEach(function (r) {
      if (!r || !r.cid) return;
      (by[r.cid] = by[r.cid] || []).push(r);
    });
    return by;
  }
  function pickPresence(list, openid) {
    var cand = list || [];
    if (openid) {
      var same = cand.filter(function (r) { return r._openid === openid; });
      if (same.length) cand = same;
    }
    var best = null;
    cand.forEach(function (r) { if (!best || (r.at || 0) > (best.at || 0)) best = r; });
    return best;
  }
  /* 别人的记录是不是真是那个号本人写的：他有在线记录、而且没有一条和这条同一个 _openid → 冒充的 */
  function ownerTrusted(row, presList) {
    if (!row || !row._openid || !presList || !presList.length) return true;
    var withId = presList.filter(function (p) { return !!p._openid; });
    if (!withId.length) return true;
    return withId.some(function (p) { return p._openid === row._openid; });
  }

  /* ── 好友关系 ─────────────────────────────────────────────
     一条 friend 记录 = 我加了谁（owner=我，friend=他），只有我自己能改能删。 */
  function addFriend(cid) {
    var target = Math.floor(Number(cid) || 0);
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, kind: 'expired', reason: '先登录并设置竞赛 ID' });
    if (!target || target <= 0) return Promise.resolve({ ok: false, kind: 'other', reason: '竞赛 ID 不对，看看是不是输错了' });
    if (target === u.cid) return Promise.resolve({ ok: false, kind: 'other', reason: '不能加自己' });

    var m = null, nm = '', theirs = [];
    function mutualNow() {
      return T().list({ kind: 'friend', owner: target, friend: u.cid }).then(function (rows) {
        theirs = rows || [];
        return theirs.length > 0;
      });
    }
    return ensureMe(u).then(function (mm) {
      m = mm;
      return T().list({ kind: 'friend', owner: u.cid });
    }).then(function (rows) {
      var mine = (rows || []).filter(function (r) { return isMine(m, r); });
      if (mine.some(function (x) { return x.friend === target; })) {
        return mutualNow().then(function (mu) {
          return mu ? { ok: false, kind: 'other', reason: '已经是好友了', already: true, mutual: true }
                    : { ok: false, kind: 'other', reason: '已经加过他了，等他也加你就成为好友', already: true, mutual: false };
        });
      }
      if (mine.length >= MAX_FRIENDS) {
        return { ok: false, kind: 'other', reason: '好友已满 ' + MAX_FRIENDS + ' 个' };
      }
      /* 对方必须真的存在过（写过在线记录）—— 否则可以乱加不存在的号 */
      return T().list({ kind: 'presence', cid: target }).then(function (p) {
        if (!p || !p.length) return { ok: false, kind: 'other', reason: '没找到 No.' + target + ' 这个人，看看号码对不对' };
        var best = pickPresence(p, '');
        nm = String((best && best.name) || '').slice(0, 16) || ('No.' + target);
        /* 🔴v1113：**写之前贴着写再查一次，防并发重复。**
           两边同时点、或连点两下，都可能写出两条；读取时也按 friend 去重做最终兜底。 */
        return T().list({ kind: 'friend', owner: u.cid, friend: target }).then(function (dup) {
          var mineDup = (dup || []).filter(function (r) { return isMine(m, r); });
          if (mineDup.length) return null;
          /* 🔴v1114：**只写我这边**，绝不往对方的好友表里塞 ——
             陌生人不能单方面进孩子的好友列表。对方也加我时，两条都在 = 互为好友。 */
          return T().add({ kind: 'friend', owner: u.cid, friend: target, name: nm, at: Date.now() });
        }).then(function () {
          setIgnore(u.cid, target, 0);     /* 我主动加了他，之前的"不加"作废 */
          return mutualNow();
        }).then(function (mu) {
          return { ok: true, cid: target, name: nm, mutual: mu, pending: !mu };
        });
      });
    })['catch'](function (e) { return fail(e); });
  }

  function removeFriend(cid) {
    var target = Math.floor(Number(cid) || 0);
    var u = me();
    if (!u.cid || !target) return Promise.resolve({ ok: false, kind: 'other', reason: '先登录' });
    var m = null;
    return ensureMe(u).then(function (mm) {
      m = mm;
      return T().list({ kind: 'friend', owner: u.cid, friend: target });
    }).then(function (rows) {
      /* 只删我自己那条 —— 对方那条是他的，删不了也不该删；
         它还在，对方那边就会显示「等他也加你」，不会以为还是好友 */
      var mine = (rows || []).filter(function (r) { return isMine(m, r); });
      return Promise.all(mine.map(function (r) { return T().remove(r._id); }));
    }).then(function (res) {
      setIgnore(u.cid, target, Date.now());
      var n = 0;
      (res || []).forEach(function (x) { n += (x && x.deleted) || 0; });
      return { ok: true, removed: n };
    })['catch'](function (e) { return fail(e); });
  }

  /* 好友列表（带在线状态）+ 想加我的人 */
  function listFriends() {
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, kind: 'expired', reason: '先登录', friends: [], incoming: [] });
    var m = null, mine = [], toMe = [];
    return ensureMe(u).then(function (mm) {
      m = mm;
      /* 两次查询：我加的人、加了我的人（都是读，谁都能读） */
      return Promise.all([
        T().list({ kind: 'friend', owner: u.cid }),
        T().list({ kind: 'friend', friend: u.cid })
      ]);
    }).then(function (two) {
      /* 🔴v1113：**按 friend 去重** —— 并发写入、历史脏数据都可能让同一个人出现多条 */
      var seen = {};
      mine = (two[0] || []).filter(function (r) {
        if (!r || !r.friend || seen[r.friend] || !isMine(m, r)) return false;
        seen[r.friend] = 1; return true;
      });
      toMe = (two[1] || []).filter(function (r) {
        return r && r.owner && r.owner !== u.cid && !(m.openid && r._openid === m.openid);
      });
      var cids = {};
      mine.forEach(function (r) { cids[r.friend] = 1; });
      toMe.forEach(function (r) { cids[r.owner] = 1; });
      var list = Object.keys(cids).map(Number);
      if (!list.length) return [];
      /* 🔴v1121：**一次查回所有在线状态，不要逐个查**（50 个好友 = 51 次读，会真的产生费用） */
      return T().list({ kind: 'presence', cid: { $in: list } }, { limit: 300 })['catch'](function () { return []; });
    }).then(function (pres) {
      var byCid = groupPresence(pres);
      var now = Date.now();
      /* 对方加我的那条（同一个人多条取最新的；冒充的不算） */
      var theirBy = {};
      toMe.forEach(function (r) {
        if (!ownerTrusted(r, byCid[r.owner])) return;
        var cur = theirBy[r.owner];
        if (!cur || (r.at || 0) > (cur.at || 0)) theirBy[r.owner] = r;
      });
      function card(cid, fallbackName, openid) {
        var p = pickPresence(byCid[cid], openid);
        var at = (p && p.at) || 0;
        /* 隐身的人 at 会被抹成 0 —— 对我们来说和离线完全一样，这正是隐身该有的效果 */
        return {
          cid: cid,
          name: String((p && p.name) || fallbackName || ('No.' + cid)).slice(0, 16),
          online: at > 0 && (now - at) < ONLINE_MS,
          lastSeen: at
        };
      }
      var friends = mine.map(function (r) {
        var theirs = theirBy[r.friend];
        var c = card(r.friend, r.name, theirs && theirs._openid);
        /* 🔴v1114/v1164：两边都加了才算好友；只有我加了 = 待对方确认 */
        c.mutual = !!theirs;
        c.pending = !theirs;
        c.sub = c.pending ? '等他也加你为好友'
          : (c.online ? '刚才还在' : (c.lastSeen ? agoText(now - c.lastSeen) : '不在线'));
        return c;
      });
      var ign = ignMap(u.cid);
      var incoming = Object.keys(theirBy).map(Number).filter(function (cid) {
        if (seenFriend(mine, cid)) return false;
        var r = theirBy[cid];
        return !(ign[cid] && (r.at || 0) <= ign[cid]);
      }).map(function (cid) {
        var r = theirBy[cid];
        var c = card(cid, '', r._openid);
        c.at = r.at || 0;
        c.sub = '想加你为好友';
        return c;
      });
      friends.sort(function (a, b) {
        /* 正式好友 > 待对方确认；同类里在线的在前 */
        return (a.pending ? 1 : 0) - (b.pending ? 1 : 0)
            || (b.online ? 1 : 0) - (a.online ? 1 : 0)
            || b.lastSeen - a.lastSeen;
      });
      incoming.sort(function (a, b) { return b.at - a.at; });
      return { ok: true, friends: friends, incoming: incoming };
    })['catch'](function (e) {
      var r = fail(e); r.friends = []; r.incoming = []; return r;
    });
  }
  function seenFriend(mine, cid) {
    for (var i = 0; i < mine.length; i++) if (mine[i].friend === cid) return true;
    return false;
  }

  function agoText(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 60) return m + ' 分钟前在线';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' 小时前在线';
    return Math.floor(h / 24) + ' 天前在线';
  }

  /* ── 快捷语 ───────────────────────────────────────────────
     只能发 QUICK 里的固定条目。传进来的 id 不在表里就直接拒绝 ——
     这是"不能打字聊天"这条产品约束的**技术兜底**：
     即使有人改前端，也发不出自定义内容。 */
  function sendQuick(toCid, quickId) {
    var u = me();
    var item = QUICK.filter(function (x) { return x.id === quickId; })[0];
    if (!item) return Promise.resolve({ ok: false, kind: 'other', reason: '只能发预设的快捷语' });
    if (!u.cid) return Promise.resolve({ ok: false, kind: 'expired', reason: '先登录' });
    var target = Math.floor(Number(toCid) || 0);
    if (!target) return Promise.resolve({ ok: false, kind: 'other', reason: '对方不存在' });
    /* 只存 id，不存文本 —— 展示时再查表。
       fromOpenid 记"我声称的身份"，收件人拿它和数据库盖的 _openid 比对 —— 冒充者填不出别人的 _openid。 */
    return ensureMe(u).then(function (m) {
      return T().addMsg({ from: u.cid, fromName: u.name, to: target,
                          fromOpenid: m.openid || '', qid: item.id,
                          at: Date.now(), read: false }).then(function () { return m; });
    }).then(function (m) {
      sweepMyMsgs(u, m);
      return { ok: true, sent: item };
    })['catch'](function (e) { return fail(e); });
  }

  /* 自己发出去的旧招呼由自己删（别人删不了我的；不删会越积越多，收件人那边也读得慢） */
  var _swept = 0;
  function sweepMyMsgs(u, m) {
    if (!m.openid || Date.now() - _swept < 600000 || !T().removeMsg) return;
    _swept = Date.now();
    T().listMsg({ from: u.cid, at: { $lt: Date.now() - MSG_KEEP_MS } }, { limit: 20 }).then(function (rows) {
      (rows || []).filter(function (r) { return r._openid === m.openid; }).slice(0, 5)
        .forEach(function (r) { T().removeMsg(r._id)['catch'](noop); });
    })['catch'](noop);
  }

  /* 已读：收件人改不了别人发来的那条记录，所以"看到哪儿了"记在本机 */
  var SEEN_KEY = 'hansen_friend_seen_v1164';
  function seenAt(cid) { var s = lsGet(SEEN_KEY) || {}; return Number(s[cid]) || 0; }
  function markSeen() {
    var u = me();
    if (!u.cid) return;
    var s = lsGet(SEEN_KEY);
    if (!s || typeof s !== 'object') s = {};
    s[u.cid] = Date.now();
    lsSet(SEEN_KEY, s);
  }

  /* opts.onlyFrom：只收这些竞赛 ID 发来的（界面传"互为好友"的人 —— 陌生人的招呼不给孩子看） */
  function inbox(opts) {
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, kind: 'expired', reason: '先登录', msgs: [] });
    var only = (opts && Array.isArray(opts.onlyFrom)) ? opts.onlyFrom : null;
    return T().listMsg({ to: u.cid }, { newestFirst: true, limit: 50 }).then(function (rows) {
      /* 🔴v1114：**用 _openid 校验发件人，防冒充。**
         消息里的 `from` 是客户端自己填的，数据库注入的 `_openid` 才可信：
         两者对不上就显示为「(来源不明的消息)」，不显示发件人名字 ——
         让人知道有这么一条，但不被它欺骗。 */
      var strangers = 0;
      var msgs = (rows || []).map(function (r) {
        var trusted = !r._openid || !r.fromOpenid || (r._openid === r.fromOpenid);
        if (!trusted) {
          return { id: r._id, from: 0, fromName: '(来源不明)', at: r.at || 0,
                   read: !!r.read, emoji: '⚠️', text: '(来源不明的消息)', suspicious: true };
        }
        var item = QUICK.filter(function (x) { return x.id === r.qid; })[0];
        return {
          id: r._id, from: r.from, fromName: String(r.fromName || ('No.' + r.from)).slice(0, 16),
          at: r.at || 0, read: !!r.read,
          emoji: item ? item.emoji : '❓',
          text: item ? item.text : '(未知消息)'    /* 查不到就显示未知，绝不渲染原始内容 */
        };
      }).filter(function (x) {
        if (!only || x.suspicious) return true;
        if (only.indexOf(x.from) >= 0) return true;
        strangers++; return false;
      });
      msgs.sort(function (a, b) { return b.at - a.at; });
      var since = seenAt(u.cid);
      msgs.forEach(function (x) { x.isNew = x.at > since; });
      /* 🔴v1121：**只给最近 30 条**；未读数仍按全部算 */
      var unread = msgs.filter(function (x) { return x.isNew; }).length;
      return { ok: true, msgs: msgs.slice(0, 30), unread: unread, total: msgs.length, strangers: strangers };
    })['catch'](function (e) { var r = fail(e); r.msgs = []; return r; });
  }

  /* 启动：登录状态下开始心跳；页面关掉自然停 */
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(startBeat, 3000); });
    } else { setTimeout(startBeat, 3000); }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') beat();
    });
  } catch (e) {}

  window.HansenFriends = {
    QUICK: QUICK.slice(),
    ONLINE_MS: ONLINE_MS,
    MAX_FRIENDS: MAX_FRIENDS,
    COLLECTION: COLLECTION,
    MSG_COLL: MSG_COLL,
    myStatus: myStatus, setStatus: setStatus,
    addFriend: addFriend, removeFriend: removeFriend, listFriends: listFriends,
    ignoreRequest: ignoreRequest,
    sendQuick: sendQuick, inbox: inbox, markSeen: markSeen,
    kindOf: kindOf,
    _learnOpenid: function () {
      var u = me();
      if (!u.cid) return Promise.resolve('');
      return ensureMe(u).then(function (m) { return m.openid; })['catch'](function () { return ''; });
    },
    _myOpenid: myOpenid,
    _beat: beat, _startBeat: startBeat, _stopBeat: stopBeat,
    _setTransportForTest: function (t) { _tx = wrapTimeout(t); _id = { cid: 0, openid: '', pid: '', presenceId: '' }; },
    _setMeForTest: function (u) { me = function () { return u; }; }
  };
})();
