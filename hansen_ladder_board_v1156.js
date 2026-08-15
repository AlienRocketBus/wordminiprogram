/* hansen_ladder_board_v1156.js —— 天梯排行榜
 *
 * ═══ 为什么加这个 ═══
 *
 * 天梯页原来只显示"我 1062 分"，**看不到自己排第几**。
 * 而天梯的核心动力恰恰是"我比别人强多少" ——
 * 一个只告诉你分数、不告诉你位置的排位系统，少了一半意思。
 *
 * ═══ 数据放哪 ═══
 *
 * 复用已有的 `sb_profile` 集合（每个账号一条，已经存着 name 和 cid）。
 * **不新建集合** —— 新建一个就要多维护一套权限、索引、清理逻辑，
 * 而这里要存的只是一个数字。
 *
 * 每条记录加三个字段：
 *   ladderRating  天梯分
 *   ladderGames   打过多少局（用来过滤"打一局就走"的）
 *   ladderAt      最后更新时间（用来过滤僵尸号）
 *
 * ═══ 几条刻意的设计 ═══
 *
 * **① 只上传，不信任别人的。**
 *    分数是客户端算的，改本地存档就能伪造。
 *    所以榜单只用来"看个热闹"，**不用它做任何匹配或奖励判断**。
 *    真正的匹配用的是房间里的 hostRating，那条路 v1114 已经做过防谎报。
 *
 * **② 至少打满定级赛才上榜。**
 *    定级赛没打完的分数没有参考价值，上榜只会稀释榜单。
 *
 * **③ 三十天没打过就不上榜。**
 *    榜首挂着一个半年前的号，对现在还在打的人不公平。
 *
 * **④ 拿不到榜就安静降级。**
 *    没网、没登录、云端抽风 —— 天梯页照常能用，
 *    只是榜那一块显示"暂时看不到"。
 *    **排行榜是锦上添花，不能因为它拿不到就让人打不了排位。**
 */
(function () {
  'use strict';

  var COL = 'sb_profile';
  var TOP_N = 20;              /* 榜单显示前多少名 */
  var STALE_DAYS = 30;         /* 多久没打过就不上榜 */
  var MIN_GAMES = 3;           /* 至少打满定级赛 */

  var _cache = null;           /* { at, list, myRank } */
  var CACHE_MS = 60000;        /* 一分钟内不重复拉 —— 榜单不需要实时 */

  function db() {
    try {
      var A = window.HansenAuth;
      if (!A || typeof A._app !== 'function') return null;
      /* 🔴v1160：**`A._app()` 是异步的，返回 Promise。**

         原来 `app.database ? ... : null` —— Promise 上没有 database，
         于是**静默返回 null**，天梯什么都读不到。
         用户的说法是「天梯根本匹配不到对方」——
         不是匹配算法的问题，是**根本没连上云端**。

         比对战房那处更隐蔽：那边至少抛出
         `app.database is not a function` 显示在屏上，
         这里连报错都没有，只是安静地什么都没有。

         > 「拿不到就返回 null」看起来稳妥，其实是把故障藏起来。
         > 而藏起来的故障，表现出来就是「这功能好像用不了」。 */
      return A._app().then(function (app) {
        return (app && app.database) ? app.database() : null;
      })['catch'](function () { return null; });
    } catch (e) { return null; }
  }

  function myUid() {
    try {
      var raw = localStorage.getItem('hansen_auth_v1004');
      return (JSON.parse(raw || '{}') || {}).uid || '';
    } catch (e) { return ''; }
  }

  /* ── 把我的分数写上去 ────────────────────────────────
     只在"打完一局排位"之后调，不主动轮询 —— 没必要给云端加负担。 */
  function push() {
    try {
      var R = window.HansenPkRecord;
      if (!R || !R.summary) return Promise.resolve({ ok: false, reason: 'no-record' });
      var s = R.summary();
      /* 定级赛没打完不上榜 —— 那时候的分数没有参考价值 */
      if (!s.placed) return Promise.resolve({ ok: false, reason: 'not-placed' });

      var d = db(), uid = myUid();
      if (!d || !uid) return Promise.resolve({ ok: false, reason: 'not-signed-in' });

      return d.collection(COL).doc(uid).update({
        ladderRating: Number(s.rating) || 0,
        ladderGames: Number(s.total) || 0,
        ladderAt: Date.now()
      }).then(function () {
        _cache = null;                 /* 自己的分变了，榜要重拉 */
        return { ok: true };
      })['catch'](function (e) {
        return { ok: false, reason: String((e && e.message) || e).slice(0, 60) };
      });
    } catch (e) {
      return Promise.resolve({ ok: false, reason: 'push-failed' });
    }
  }

  /* ── 把榜拉下来 ──────────────────────────────────── */
  function fetchTop() {
    if (_cache && (Date.now() - _cache.at) < CACHE_MS) {
      return Promise.resolve(Object.assign({ ok: true, cached: true }, _cache));
    }
    var d = db();
    if (!d) return Promise.resolve({ ok: false, reason: 'not-signed-in' });

    var alive = Date.now() - STALE_DAYS * 24 * 3600 * 1000;
    /* ⚠️ where 里只放**每条记录都有**的字段。
       v1135 的教训：字段缺失 ≠ 值不匹配 ——
       把 ladderGames 之类放进 where，老记录（没这个字段）会整批查不出来。
       所以只按 ladderRating 排序取一批，其余条件在本地过滤。 */
    return d.collection(COL)
      .orderBy('ladderRating', 'desc')
      .limit(TOP_N * 3)              /* 多取一些，本地滤完还够 TOP_N */
      .get()
      .then(function (res) {
        var rows = (res && res.data) || [];
        var list = rows.filter(function (x) {
          if (!x || !Number(x.ladderRating)) return false;
          if ((Number(x.ladderGames) || 0) < MIN_GAMES) return false;
          if ((Number(x.ladderAt) || 0) < alive) return false;
          return true;
        }).slice(0, TOP_N).map(function (x, i) {
          return {
            rank: i + 1,
            uid: x.uid || x._id,
            name: x.name || '无名蜂',
            cid: Number(x.cid) || 0,
            rating: Number(x.ladderRating) || 0,
            games: Number(x.ladderGames) || 0
          };
        });
        var uid = myUid();
        var mine = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].uid === uid) { mine = list[i].rank; break; }
        }
        _cache = { at: Date.now(), list: list, myRank: mine };
        return { ok: true, list: list, myRank: mine };
      })['catch'](function (e) {
        return { ok: false, reason: String((e && e.message) || e).slice(0, 60) };
      });
  }

  /* ── 我大概排第几（不在前 20 时用）────────────────
     只数"比我分高的有几个" —— 一次 count，比拉全表便宜得多。 */
  function myRoughRank() {
    try {
      var R = window.HansenPkRecord;
      var d = db();
      if (!R || !d) return Promise.resolve({ ok: false });
      var s = R.summary();
      if (!s.placed) return Promise.resolve({ ok: false, reason: 'not-placed' });
      return d.collection(COL)
        .where({ ladderRating: d.command.gt(Number(s.rating) || 0) })
        .count()
        .then(function (c) {
          return { ok: true, rank: (Number(c && c.total) || 0) + 1 };
        })['catch'](function () { return { ok: false }; });
    } catch (e) {
      return Promise.resolve({ ok: false });
    }
  }

  window.HansenLadderBoard = {
    push: push,
    fetchTop: fetchTop,
    myRoughRank: myRoughRank,
    _clearCacheForTest: function () { _cache = null; },
    _configForTest: { TOP_N: TOP_N, STALE_DAYS: STALE_DAYS, MIN_GAMES: MIN_GAMES }
  };
})();
