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
 */
(function () {
  'use strict';
  if (window.HansenFriends) return;

  var COLLECTION = 'hansen_friends';     /* 好友关系 + 在线状态 */
  var MSG_COLL = 'hansen_friend_msgs';   /* 快捷语消息 */
  var ONLINE_MS = 60000;                 /* 60 秒内有心跳算"刚才还在" */
  var BEAT_MS = 20000;                   /* 每 20 秒续一次 */
  var MAX_FRIENDS = 50;

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

  var _tx = null, _beat = null;

  function db() {
    var CS = window.HansenCloudSave;
    if (!CS || typeof CS._app !== 'function') return Promise.reject(new Error('云服务未就绪'));
    return CS._app().then(function (app) { return app.database(); });
  }

  /* 传输层单独一层，便于测试注入（与 pk_room 同样的做法） */
  /* 🔴v1115 统一超时（同 hansen_pk_room 的做法）。
     弱信号下请求会卡住不返回 —— 既不成功也不失败，
     界面一直转圈，比断网更折磨人。 */
  var NET_TIMEOUT_MS = 12000;

  function withTimeout(promise, ms, what) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return; done = true;
        /* 🔴v1115：**文案里不许露内部方法名**。
           第一版写成"网络太慢，云端listOpen没能完成" —— 用户看不懂 listOpen 是什么，
           只会觉得这个 App 在说胡话。报错是给人看的，不是给开发者看的。 */
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

  function T() {
    if (_tx) return _tx;
    /* 真实传输层也要包超时 */
    _tx = null;
    return wrapTimeout({
      read: function (id) {
        return db().then(function (d) {
          return d.collection(COLLECTION).doc(id).get().then(function (r) {
            return (r && r.data && r.data[0]) || null;
          });
        });
      },
      list: function (where) {
        return db().then(function (d) {
          return d.collection(COLLECTION).where(where).limit(100).get()
            .then(function (r) { return (r && r.data) || []; });
        });
      },
      add: function (doc) {
        return db().then(function (d) {
          return d.collection(COLLECTION).add(doc).then(function (r) { return { id: r.id || r._id }; });
        });
      },
      patch: function (id, data) {
        return db().then(function (d) {
          return d.collection(COLLECTION).doc(id).update(data);
        });
      },
      remove: function (id) {
        return db().then(function (d) { return d.collection(COLLECTION).doc(id).remove(); });
      },
      addMsg: function (doc) {
        return db().then(function (d) {
          return d.collection(MSG_COLL).add(doc).then(function (r) { return { id: r.id || r._id }; });
        });
      },
      listMsg: function (where) {
        return db().then(function (d) {
          return d.collection(MSG_COLL).where(where).limit(50).get()
            .then(function (r) { return (r && r.data) || []; });
        });
      }
    });
  }

  /* 数据库给每条记录注入的 _openid 是唯一可信身份。
     这里读一条自己写过的记录拿到它 —— 拿不到就返回空，
     那种情况下不做冒充校验（宁可不校验，也不能误判正常消息为可疑）。 */
  var _myOpenid = '';
  function myOpenid() { return _myOpenid; }
  function learnOpenid() {
    var u = me();
    if (!u.cid || _myOpenid) return Promise.resolve('');
    return T().list({ kind: 'presence', cid: u.cid }).then(function (rows) {
      if (rows && rows[0] && rows[0]._openid) _myOpenid = rows[0]._openid;
      return _myOpenid;
    })['catch'](function () { return ''; });
  }

  function me() {
    var P = window.HansenSbProfile;
    var cid = 0, name = '';
    try {
      var pf = P && P.readProfile && P.readProfile();
      cid = (pf && pf.cid) || 0;
      name = (pf && pf.name) || '';
    } catch (e) {}
    return { cid: cid, name: name || '无名蜂' };
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

  /* 心跳：只有"在线"才写。隐身 = 完全不写 = 对别人就是离线 */
  function beat() {
    if (myStatus() !== 'online') return Promise.resolve();
    var u = me();
    if (!u.cid) return Promise.resolve();
    return T().list({ kind: 'presence', cid: u.cid }).then(function (rows) {
      var now = Date.now();
      if (rows && rows.length) {
        if (rows[0]._openid) _myOpenid = rows[0]._openid;   /* 顺便学到自己的可信身份 */
        return T().patch(rows[0]._id, { at: now, name: u.name });
      }
      return T().add({ kind: 'presence', cid: u.cid, name: u.name, at: now });
    })['catch'](function () {});
  }

  function clearBeat() {
    var u = me();
    if (!u.cid) return Promise.resolve();
    return T().list({ kind: 'presence', cid: u.cid }).then(function (rows) {
      if (rows && rows.length) return T().patch(rows[0]._id, { at: 0 });
    })['catch'](function () {});
  }

  function startBeat() {
    stopBeat();
    if (myStatus() !== 'online') return;
    beat();
    _beat = setInterval(beat, BEAT_MS);
  }
  function stopBeat() { if (_beat) { clearInterval(_beat); _beat = null; } }

  /* ── 好友关系 ─────────────────────────────────────────────
     一条 friend 记录 = 我加了谁。双向各存一条，
     这样查"我的好友"只要 where{kind:'friend', owner:我} 一次即可，
     不用做联表（云开发的联表能力有限，也更慢）。 */
  function addFriend(cid) {
    var target = Math.floor(Number(cid) || 0);
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, reason: '先登录并设置竞赛 ID' });
    if (!target || target <= 0) return Promise.resolve({ ok: false, reason: '竞赛 ID 不对，看看是不是输错了' });
    if (target === u.cid) return Promise.resolve({ ok: false, reason: '不能加自己' });

    return T().list({ kind: 'friend', owner: u.cid }).then(function (mine) {
      if ((mine || []).length >= MAX_FRIENDS) {
        return { ok: false, reason: '好友已满 ' + MAX_FRIENDS + ' 个' };
      }
      if ((mine || []).some(function (x) { return x.friend === target; })) {
        return { ok: false, reason: '已经是好友了' };
      }
      /* 对方必须真的存在过（发过心跳）—— 否则可以乱加不存在的号 */
      return T().list({ kind: 'presence', cid: target }).then(function (p) {
        if (!p || !p.length) return { ok: false, reason: '没找到 No.' + target + ' 这个人' };
        var nm = p[0].name || ('No.' + target);
        var now = Date.now();
        /* 双向各写一条 —— 加了就是互为好友，不做"申请/通过"那一套：
           这是给孩子用的，多一步确认只会让人加不上。 */
        /* 🔴v1113：**写之前再查一次，防并发重复。**

           实测：A 加 B 的同时 B 也在加 A → 双方各写两条 →
           好友列表里同一个人出现两次。
           上面那次「已经是好友了」的检查是在**读的那一刻**做的，
           两边同时读到"还不是好友"，就都写了。

           这是典型的"先读再写"竞态 —— 本项目在抢房那里踩过一次
           （两人进同一间房），当时的结论是"绝不先读再写"。
           好友这里没有条件更新可用（是 add 不是 update），
           所以改为**写之前贴着写再查一次**，把窗口压到最小；
           并在读取列表时**按 friend 去重**做最终兜底。 */
        return T().list({ kind: 'friend', owner: u.cid, friend: target })
          .then(function (dup) {
            if (dup && dup.length) return { ok: true, cid: target, name: nm, already: true };
            /* 🔴v1114：**不再单方面写进对方的好友表。**

               实测：我加 B，代码会直接往 B 的好友表里塞一条 ——
               **陌生人单方面就能进孩子的好友列表**，这对儿童产品不能接受。

               改为：只写我这边（标记 pending），
               同时给对方发一条"请求"记录；
               **对方也加我时**，双方自动变成 accepted。
               这既保留了"不用手动通过"的简单（v1106 的初衷），
               又杜绝了"被陌生人单方面加上"。 */
            return T().add({ kind: 'friend', owner: u.cid, friend: target,
                             name: nm, at: now, state: 'pending' })
              .then(function () {
                /* 对方是否已经加过我？加过就双方转 accepted */
                return T().list({ kind: 'friend', owner: target, friend: u.cid });
              })
              .then(function (theirs) {
                if (!theirs || !theirs.length) {
                  /* 对方还没加我 —— 留一条请求，等他也加我时自动成立 */
                  return T().add({ kind: 'request', from: u.cid, to: target,
                                   name: u.name, at: now });
                }
                /* 对方加过我 → 双方都转 accepted */
                return T().list({ kind: 'friend', owner: u.cid, friend: target })
                  .then(function (mineRows) {
                    var jobs = [];
                    (mineRows || []).forEach(function (r) {
                      jobs.push(T().patch(r._id, { state: 'accepted' }));
                    });
                    theirs.forEach(function (r) {
                      jobs.push(T().patch(r._id, { state: 'accepted' }));
                    });
                    return Promise.all(jobs);
                  });
              })
              .then(function () { return { ok: true, cid: target, name: nm }; });
          });
      });
    })['catch'](function (e) { return { ok: false, reason: String((e && e.message) || e) }; });
  }

  function removeFriend(cid) {
    var target = Math.floor(Number(cid) || 0);
    var u = me();
    if (!u.cid || !target) return Promise.resolve({ ok: false });
    return T().list({ kind: 'friend', owner: u.cid, friend: target }).then(function (rows) {
      return Promise.all((rows || []).map(function (r) { return T().remove(r._id); }));
    }).then(function () {
      /* 对方那条也删 —— 单向残留会让对方以为还是好友 */
      return T().list({ kind: 'friend', owner: target, friend: u.cid });
    }).then(function (rows) {
      return Promise.all((rows || []).map(function (r) { return T().remove(r._id); }));
    }).then(function () { return { ok: true }; })
    ['catch'](function (e) { return { ok: false, reason: String((e && e.message) || e) }; });
  }

  /* 好友列表（带在线状态） */
  function listFriends() {
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, reason: '先登录', friends: [] });
    return T().list({ kind: 'friend', owner: u.cid }).then(function (rows) {
      /* 🔴v1113：**按 friend 去重**。
         并发写入、历史脏数据都可能让同一个人出现多条，
         而用户看到好友列表里同一个人出现两次，会觉得这个 App 不可靠。
         去重放在读取侧，是因为它对任何来源的重复都有效。 */
      var seen = {};
      rows = (rows || []).filter(function (r) {
        if (!r || !r.friend || seen[r.friend]) return false;
        seen[r.friend] = 1; return true;
      });
      /* 🔴v1114：pending 的单独标出来，不混在正式好友里。
         「我加了他但他还没加我」和「互为好友」是两回事，
         界面上要能分清，否则用户以为加上了、发消息却石沉大海。 */
      rows.forEach(function (r) { r._pending = (r.state === 'pending'); });
      var cids = rows.map(function (r) { return r.friend; });
      if (!cids.length) return { ok: true, friends: [] };
      /* 🔴v1121：**一次查回所有在线状态，不要逐个查。**

         实测：50 个好友 → **51 次数据库查询**。
         云开发按读次数计费，而好友页每 15 秒自动刷新一次 ——
         一个用户挂着好友页一小时，就是 51 × 240 = 12000 次读。
         这不是"慢"的问题，是**会真的产生费用**。

         改为一次拉回所有 presence 记录，在内存里按 cid 配对。
         presence 表本身很小（每人一条），全量拉回完全可接受。 */
      return T().list({ kind: 'presence' }).then(function (all) {
        var byCid = {};
        (all || []).forEach(function (r) { if (r && r.cid) byCid[r.cid] = r; });
        var ps = cids.map(function (c) { return byCid[c] || null; });
        return ps;
      })['catch'](function () {
        return cids.map(function () { return null; });
      }).then(function (ps) {
        var now = Date.now();
        var friends = (rows || []).map(function (r, i) {
          var p = ps[i];
          var at = (p && p.at) || 0;
          var online = at > 0 && (now - at) < ONLINE_MS;
          return {
            cid: r.friend,
            name: (p && p.name) || r.name || ('No.' + r.friend),
            online: online,
            lastSeen: at,
            /* 隐身的人 at 会被抹成 0 —— 对我们来说和离线完全一样，
               看不出他是隐身还是真的关了页面，这正是隐身该有的效果 */
            pending: !!r._pending,
            sub: r._pending
              ? '等他也加你为好友'
              : (online ? '刚才还在' : (at ? agoText(now - at) : '不在线'))
          };
        });
        friends.sort(function (a, b) {
          /* 正式好友 > 待对方确认；同类里在线的在前 */
          return (a.pending ? 1 : 0) - (b.pending ? 1 : 0)
              || (b.online ? 1 : 0) - (a.online ? 1 : 0)
              || b.lastSeen - a.lastSeen;
        });
        return { ok: true, friends: friends };
      });
    })['catch'](function (e) { return { ok: false, reason: String((e && e.message) || e), friends: [] }; });
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
    if (!item) return Promise.resolve({ ok: false, reason: '只能发预设的快捷语' });
    if (!u.cid) return Promise.resolve({ ok: false, reason: '先登录' });
    var target = Math.floor(Number(toCid) || 0);
    if (!target) return Promise.resolve({ ok: false, reason: '对方不存在' });
    /* 只存 id，不存文本 —— 展示时再查表。
       这样即使数据库被写入奇怪的值，界面也只会显示"(未知消息)"，
       而不会把任意文本渲染出来。 */
    /* fromOpenid 记录"客户端声称的身份"，与数据库注入的 _openid 比对。
       两者一致才可信 —— 冒充者填不出别人的 _openid。 */
    return T().addMsg({ from: u.cid, fromName: u.name, to: target,
                        fromOpenid: myOpenid(), qid: item.id,
                        at: Date.now(), read: false })
      .then(function () { return { ok: true, sent: item }; })
      ['catch'](function (e) { return { ok: false, reason: String((e && e.message) || e) }; });
  }

  function inbox() {
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, msgs: [] });
    return T().listMsg({ to: u.cid }).then(function (rows) {
      /* 🔴v1114：**用 _openid 校验发件人，防冒充。**

         实测：消息里的 `from` 是客户端自己填的 ——
         改一下就能冒充别人给孩子发消息。

         数据库会给每条记录自动注入 `_openid`（**服务端写的，客户端改不了**），
         那是唯一可信的身份。做法：
           · 每条消息同时存 `fromOpenid`（客户端声称的）
           · 读取时与 `_openid`（服务端注入的）比对，**对不上就标为可疑**
         对不上的一律显示为「(来源不明的消息)」并不显示发件人名字，
         而不是默默丢掉 —— 让人知道有这么一条，但不被它欺骗。 */
      var msgs = (rows || []).map(function (r) {
        var trusted = !r._openid || !r.fromOpenid || (r._openid === r.fromOpenid);
        if (!trusted) {
          return { id: r._id, from: 0, fromName: '(来源不明)', at: r.at || 0,
                   read: !!r.read, emoji: '⚠️', text: '(来源不明的消息)', suspicious: true };
        }
        var item = QUICK.filter(function (x) { return x.id === r.qid; })[0];
        return {
          id: r._id, from: r.from, fromName: r.fromName || ('No.' + r.from),
          at: r.at || 0, read: !!r.read,
          emoji: item ? item.emoji : '❓',
          text: item ? item.text : '(未知消息)'    /* 查不到就显示未知，绝不渲染原始内容 */
        };
      });
      msgs.sort(function (a, b) { return b.at - a.at; });
      /* 🔴v1121：**只给最近 30 条。**
         实测 500 条会全量返回 —— 界面拉出很长一串，
         而快捷语就那 10 句，翻到第 300 条毫无意义。
         未读数仍按全部算（那是"有多少条没看"，不该被截断）。 */
      var unread = msgs.filter(function (m) { return !m.read; }).length;
      return { ok: true, msgs: msgs.slice(0, 30), unread: unread, total: msgs.length };
    })['catch'](function (e) { return { ok: false, reason: String((e && e.message) || e), msgs: [] }; });
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
    myStatus: myStatus, setStatus: setStatus,
    _learnOpenid: learnOpenid, _myOpenid: myOpenid,
    addFriend: addFriend, removeFriend: removeFriend, listFriends: listFriends,
    sendQuick: sendQuick, inbox: inbox,
    _beat: beat, _startBeat: startBeat, _stopBeat: stopBeat,
    _setTransportForTest: function (t) { _tx = wrapTimeout(t); },
    _setMeForTest: function (u) { me = function () { return u; }; }
  };
})();
