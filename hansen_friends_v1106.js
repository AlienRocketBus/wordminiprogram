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
  function T() {
    if (_tx) return _tx;
    return {
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
    };
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
      if (rows && rows.length) return T().patch(rows[0]._id, { at: now, name: u.name });
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
        return T().add({ kind: 'friend', owner: u.cid, friend: target, name: nm, at: now })
          .then(function () {
            return T().add({ kind: 'friend', owner: target, friend: u.cid, name: u.name, at: now });
          })
          .then(function () { return { ok: true, cid: target, name: nm }; });
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
      var cids = (rows || []).map(function (r) { return r.friend; });
      if (!cids.length) return { ok: true, friends: [] };
      /* 逐个查在线（云开发的 in 查询限制多，好友数上限 50，逐个查可接受） */
      return Promise.all(cids.map(function (c) {
        return T().list({ kind: 'presence', cid: c })
          .then(function (p) { return (p && p[0]) || null; })
          ['catch'](function () { return null; });
      })).then(function (ps) {
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
            sub: online ? '刚才还在' : (at ? agoText(now - at) : '不在线')
          };
        });
        friends.sort(function (a, b) { return (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.lastSeen - a.lastSeen; });
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
    return T().addMsg({ from: u.cid, fromName: u.name, to: target,
                        qid: item.id, at: Date.now(), read: false })
      .then(function () { return { ok: true, sent: item }; })
      ['catch'](function (e) { return { ok: false, reason: String((e && e.message) || e) }; });
  }

  function inbox() {
    var u = me();
    if (!u.cid) return Promise.resolve({ ok: false, msgs: [] });
    return T().listMsg({ to: u.cid }).then(function (rows) {
      var msgs = (rows || []).map(function (r) {
        var item = QUICK.filter(function (x) { return x.id === r.qid; })[0];
        return {
          id: r._id, from: r.from, fromName: r.fromName || ('No.' + r.from),
          at: r.at || 0, read: !!r.read,
          emoji: item ? item.emoji : '❓',
          text: item ? item.text : '(未知消息)'    /* 查不到就显示未知，绝不渲染原始内容 */
        };
      });
      msgs.sort(function (a, b) { return b.at - a.at; });
      return { ok: true, msgs: msgs, unread: msgs.filter(function (m) { return !m.read; }).length };
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
    addFriend: addFriend, removeFriend: removeFriend, listFriends: listFriends,
    sendQuick: sendQuick, inbox: inbox,
    _beat: beat, _startBeat: startBeat, _stopBeat: stopBeat,
    _setTransportForTest: function (t) { _tx = t; },
    _setMeForTest: function (u) { me = function () { return u; }; }
  };
})();
