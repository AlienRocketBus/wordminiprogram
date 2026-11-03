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
 *
 * **② 至少打满定级赛才上榜。**
 * **③ 三十天没打过就不上榜。**
 * **④ 拿不到榜就安静降级** —— 天梯页照常能用，只是榜那一块说清楚为什么看不到。
 *
 * ═══ v1164：以前为什么"从来没好过" ═══
 *
 *   · db() 第一次调用必然返回 null（后台才开始预热）→ 页面刚打开拉榜永远是
 *     「登录之后才能看到」，上传也静默丢掉。
 *   · 云端出错时 SDK **不抛错**，而是照常返回 {code, message}；这里从不查 code，
 *     于是「权限不对」显示成「还没有人上榜」，上传被拒也报 ok:true。
 *   现在：每次都先等账号模块的云端实例和会话（ensureSession）就绪，
 *   每个结果都查 code；失败统一返回 {ok:false, kind, reason:'人话 ⟨原话⟩', text:人话}。
 */
(function () {
  'use strict';
  if (window.HansenLadderBoard) return;

  var COL = 'sb_profile';
  var TOP_N = 20;              /* 榜单显示前多少名 */
  var RATING_CAP = 4000;       /* 天梯分的上限（hansen_sb_ladder 的 RATING_MAX） */
  function boardName(v) {
    var P = window.HansenSbProfile;
    try { if (P && typeof P.safeName === 'function') return P.safeName(v, '无名蜂'); } catch (e) {}
    var s = (typeof v === 'string') ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';
    if (/微信|vx|wx|qq|加我|扫码|http|www|@|\d{5,}/i.test(s)) return '小蜜蜂';
    return s || '无名蜂';
  }
  var STALE_DAYS = 30;         /* 多久没打过就不上榜 */
  var MIN_GAMES = 3;           /* 至少打满定级赛 */
  var NET_TIMEOUT_MS = 12000;  /* 单次云端请求的上限：弱信号下请求会挂住不返回 */
  var PERM_TEXT = '读取全部数据，修改本人数据';

  var _cache = null;           /* { at, list, myRank } */
  var CACHE_MS = 60000;        /* 一分钟内不重复拉 —— 榜单不需要实时 */
  var _needPush = true;        /* 这次打开页面后还没成功传过分：上次传失败的分，拉榜前补传一次 */
  var _lastPushErr = null;
  var _cloudForTest = null;

  /* ── 错误分类（和对战房间同一套 kind；见设计规格 §2）──────────── */
  var KINDS = { network: 1, slow: 1, session: 1, expired: 1, config: 1, gone: 1, taken: 1, self: 1, other: 1 };
  var HUMAN = {
    network: '连不上网络，排行榜暂时看不到，检查一下 Wi-Fi 或数据再试',
    slow: '网络太慢，排行榜这次没拉下来，等会儿再看看',
    session: '云端还没连上，排行榜等一会儿再看',
    expired: '云端登录过期了，重新登录一次就能看到排名',
    other: '排行榜暂时看不到'
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
    var code = String((e && e.code) || (/[A-Z][A-Z_]{6,}/.exec(t) || [])[0] || '');
    if (/NOT_EXIST/.test(code) || /not exist/i.test(t))
      return '云端设置还差一步：还没有建数据库集合「' + COL + '」，请在云开发控制台新建它（权限选「' + PERM_TEXT + '」）';
    if (/PERMISSION/.test(code + t))
      return '云端设置还差一步：数据库集合「' + COL + '」的权限不对，请在云开发控制台把它设成「' + PERM_TEXT + '」';
    return '云端设置还差一步：云端拒绝了排行榜的读写（' + (code || '未知错误') + '），请把技术信息发给负责的老师';
  }
  function fail(e) {
    var k = kindOf(e);
    var t = rawText(e);
    var human = (e && typeof e.human === 'string' && e.human) ||
                (k === 'config' ? configHuman(e, t) : (HUMAN[k] || HUMAN.other));
    var r = { ok: false, kind: k, expired: k === 'expired', text: human,
              reason: (t && t !== human) ? human + ' ⟨' + t.slice(0, 160) + '⟩' : human };
    if (e && typeof e.code === 'string' && e.code) r.code = e.code;
    /* 没登录：保留老的 reason 值 —— 天梯页按它显示「登录之后就能看到大家的排名」 */
    if (e && e.notSignedIn) r.reason = 'not-signed-in';
    return r;
  }

  function withTimeout(p, ms, what) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return; done = true;
        var e = new Error((what || '云端请求') + '超时（' + Math.round((ms || NET_TIMEOUT_MS) / 1000) + ' 秒没有回应）');
        e.timeout = true;
        reject(e);
      }, ms || NET_TIMEOUT_MS);
      Promise.resolve(p).then(function (v) {
        if (done) return; done = true; clearTimeout(t); resolve(v);
      }, function (err) { if (done) return; done = true; clearTimeout(t); reject(err); });
    });
  }

  /* 云端出错 SDK 不抛，而是返回 {code}：在这里统一变成异常 */
  function call(p, what) {
    return withTimeout(p, NET_TIMEOUT_MS, what).then(function (r) {
      if (r && r.code) {
        var e = new Error(what + '：' + String(r.message || '云端拒绝').slice(0, 100));
        e.code = String(r.code); e.cloud = true; e.collection = COL;
        throw e;
      }
      return r;
    });
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* 会话：交给账号模块的 ensureSession（它带重试、能分清"还没好"和"确定过期"） */
  function session(A, tries) {
    return Promise.resolve().then(function () { return A.ensureSession(); }).then(function (s) {
      if (s && s.ok && s.uid) return s;
      if (s && s.notSignedIn) {
        var e0 = kErr('expired', '登录之后就能看到大家的排名', 'not-signed-in');
        e0.notSignedIn = true;
        throw e0;
      }
      var k = (s && KINDS[s.kind]) ? s.kind : (s && s.expired ? 'expired' : (s && (s.slow || s.timeout) ? 'slow' : 'session'));
      /* 会话"还没好"多半是页面刚打开、凭证还在刷新：稍等再问，别一上来就说看不到 */
      if (k === 'session' && (tries || 0) < 2) return wait(1500).then(function () { return session(A, (tries || 0) + 1); });
      throw kErr(k, HUMAN[k] || HUMAN.other, (s && s.reason) || '会话不可用');
    });
  }

  /* 🔴v1164：db 必须"第一次就能用"——等账号模块的实例和会话，而不是同步返回 null 赌预热。
     用账号模块那一个云端实例（不另建：多实例会并发刷新 token，把凭证撞没）。 */
  function cloud() {
    if (_cloudForTest) return Promise.resolve(_cloudForTest);
    var A = window.HansenAuth;
    if (!A || typeof A._app !== 'function' || typeof A.ensureSession !== 'function') {
      return Promise.reject(kErr('other', '账号模块还没加载好，刷新一下页面再试', 'HansenAuth 未加载'));
    }
    if (typeof A.isSignedIn === 'function' && !A.isSignedIn()) {
      var e = kErr('expired', '登录之后就能看到大家的排名', 'not-signed-in');
      e.notSignedIn = true;
      return Promise.reject(e);
    }
    return session(A, 0).then(function (s) {
      return withTimeout(Promise.resolve().then(function () { return A._app(); }), NET_TIMEOUT_MS, '连接云端')
        .then(function (app) {
          if (!app || typeof app.database !== 'function') {
            throw kErr('other', '云端模块没加载好，刷新一下页面再试', 'app.database 不可用');
          }
          return { db: app.database(), uid: String(s.uid) };
        });
    });
  }

  function myName() {
    try {
      var P = window.HansenSbProfile;
      if (P && typeof P.displayName === 'function') return P.displayName() || '';
      return (P && P.readProfile && (P.readProfile() || {}).name) || '';
    } catch (e) { return ''; }
  }

  function summary() {
    try {
      var R = window.HansenPkRecord;
      return (R && typeof R.summary === 'function') ? R.summary() : null;
    } catch (e) { return null; }
  }

  /* ── 把我的分数写上去 ────────────────────────────────
     打完一局排位后调；拉榜前如果这次还没传成功过，也补传一次。
     只写自己那条 sb_profile（_id = 自己的 uid），从不碰别人的。 */
  function push() {
    var s = summary();
    if (!s) return Promise.resolve({ ok: false, reason: 'no-record', kind: 'other', skipped: true });
    /* 定级赛没打完不上榜 —— 那时候的分数没有参考价值 */
    if (!s.placed) return Promise.resolve({ ok: false, reason: 'not-placed', kind: 'other', skipped: true });

    return cloud().then(function (c) {
      var data = {
        ladderRating: Number(s.rating) || 0,
        ladderGames: Number(s.total) || 0,
        ladderAt: Date.now()
      };
      var nm = myName();
      if (nm) data.name = nm;      /* 榜上显示的名字跟着资料走，别一直是登录那天的空名字 */
      var ref = c.db.collection(COL).doc(c.uid);
      return call(ref.update(data), '上传天梯分').then(function (r) {
        if (r && r.updated > 0) return r;
        /* updated:0 = 云端还没有我这条资料（登录时建档没成功）→ 先建档再写一次 */
        var A = window.HansenAuth;
        if (!A || typeof A.ensureProfile !== 'function') throw kErr('config', configHuman({ code: 'NO_PROFILE' }, ''), 'updated:0');
        return Promise.resolve(A.ensureProfile(c.uid)).then(function () {
          data.ladderAt = Date.now();
          return call(ref.update(data), '上传天梯分');
        }).then(function (r2) {
          if (r2 && r2.updated > 0) return r2;
          throw kErr('config', '云端设置还差一步：天梯分没写进「' + COL + '」（你的资料那条不在或不是你建的），'
            + '请确认这个集合的权限是「' + PERM_TEXT + '」', 'updated:0');
        });
      });
    }).then(function () {
      _needPush = false; _lastPushErr = null;
      _cache = null;                 /* 自己的分变了，榜要重拉 */
      return { ok: true };
    })['catch'](function (e) {
      var r = fail(e);
      _lastPushErr = r;
      try { if (window.console && console.warn) console.warn('[排行榜] 上传天梯分没成功：' + r.reason); } catch (x) {}
      return r;
    });
  }

  /* ── 把榜拉下来 ──────────────────────────────────── */
  function fetchTop() {
    if (_cache && (Date.now() - _cache.at) < CACHE_MS) {
      return Promise.resolve(Object.assign({ ok: true, cached: true }, _cache));
    }
    var alive = Date.now() - STALE_DAYS * 24 * 3600 * 1000;
    return cloud().then(function (c) {
      var s = summary();
      /* 上次没传上的分先补传（失败不挡拉榜，原因记在 lastPushError） */
      var pre = (_needPush && s && s.placed) ? push() : Promise.resolve(null);
      return pre.then(function () { return c; });
    }).then(function (c) {
      /* ⚠️ where 里只放**每条记录都有**的字段。
         v1135 的教训：字段缺失 ≠ 值不匹配 ——
         把 ladderGames 之类放进 where，老记录（没这个字段）会整批查不出来。
         所以只按 ladderRating 排序取一批，其余条件在本地过滤。 */
      var col = c.db.collection(COL);
      return call(col.orderBy('ladderRating', 'desc').limit(TOP_N * 3).get(), '读取排行榜')
        ['catch'](function (indexErr) {
          /* 云端没建排序索引时 orderBy 会被拒：退回不排序的查询，本地排 */
          if (kindOf(indexErr) !== 'config') throw indexErr;
          return call(col.where({ ladderRating: c.db.command.gt(0) }).limit(1000).get(), '读取排行榜');
        })
        .then(function (res) { return { c: c, res: res }; });
    }).then(function (o) {
      var rows = (o.res && o.res.data) || [];
      var list = rows.filter(function (x) {
        if (!x || !Number(x.ladderRating)) return false;
        if ((Number(x.ladderGames) || 0) < MIN_GAMES) return false;
        if ((Number(x.ladderAt) || 0) < alive) return false;
        /* 🔴v1164（审查 SEC-4）：分数是各人手机自己算、自己写的 —— 明显不可能的不上榜：
           超过天梯上限 4000，或者涨得比「每局最多涨四十来分」快得多（打 3 局就 9999 分）。留足余量，正常打的绝不会被滤掉 */
        var rt = Number(x.ladderRating) || 0, gm = Number(x.ladderGames) || 0;
        if (rt < 0 || rt > RATING_CAP || rt - 1000 > 60 * gm + 100) return false;
        return true;
      }).sort(function (a, b) {
        return (Number(b.ladderRating) || 0) - (Number(a.ladderRating) || 0);
      }).slice(0, TOP_N).map(function (x, i) {
        return {
          rank: i + 1,
          uid: x.uid || x._id,
          /* 名字是各人自己写的：广告 / 联系方式换成「小蜜蜂」（审查 SEC-4） */
          name: boardName(x.name),
          cid: Number(x.cid) || 0,
          rating: Number(x.ladderRating) || 0,
          games: Number(x.ladderGames) || 0
        };
      });
      var mine = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].uid === o.c.uid) { mine = list[i].rank; break; }
      }
      /* 空榜是 ok:true + 空列表 —— 和"拿不到榜"分开（界面要说不同的话） */
      _cache = { at: Date.now(), list: list, myRank: mine };
      return { ok: true, list: list, myRank: mine };
    })['catch'](function (e) { return fail(e); });
  }

  /* ── 我大概排第几（不在前 20 时用）────────────────
     只数"比我分高的有几个" —— 一次 count，比拉全表便宜得多。 */
  function myRoughRank() {
    var s = summary();
    if (!s) return Promise.resolve({ ok: false, kind: 'other', reason: 'no-record' });
    if (!s.placed) return Promise.resolve({ ok: false, kind: 'other', reason: 'not-placed' });
    return cloud().then(function (c) {
      return call(c.db.collection(COL)
        .where({ ladderRating: c.db.command.gt(Number(s.rating) || 0) })
        .count(), '数排名');
    }).then(function (r) {
      /* count 出错时没有 total —— 不能当成"0 个人比我高" */
      if (!r || typeof r.total !== 'number') throw kErr('other', HUMAN.other, 'count 没有返回 total');
      return { ok: true, rank: r.total + 1 };
    })['catch'](function (e) { return fail(e); });
  }

  window.HansenLadderBoard = {
    push: push,
    fetchTop: fetchTop,
    myRoughRank: myRoughRank,
    /* 最近一次上传失败的结果（{ok:false,kind,reason,text}）；成功后清空 */
    lastPushError: function () { return _lastPushErr; },
    kindOf: kindOf,
    _clearCacheForTest: function () { _cache = null; },
    _setCloudForTest: function (c) { _cloudForTest = c || null; _cache = null; },
    _configForTest: { TOP_N: TOP_N, STALE_DAYS: STALE_DAYS, MIN_GAMES: MIN_GAMES }
  };
})();
