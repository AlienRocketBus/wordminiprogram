/* hansen_sb_ladder_v1002.js —— 拼写蜂天梯：分数算法 + 段位映射（纯函数，零依赖）
 *
 * 设计依据：《拼写蜂在线对战_社交层设计书_v1003》§5
 * 为全年龄玩家调过的 ELO 变体，三处改动：
 *   ① 输分阻尼 0.6  —— 赢 +20 的对局，输只 -12，长期仍收敛真实水平
 *   ② 段位地板     —— 升上某段后不再掉回下一段，保护成就感
 *   ③ K 值递减     —— 定级 40 → 前 20 局 32 → 之后 24
 * 全部为纯函数：同样输入必得同样输出，可完整单测，不碰 DOM 与存储。 */
(function () {
  'use strict';
  if (window.HansenSbLadder) return;

  /* ── 段位阶梯（蜂群主题，与游戏世界观一致）───────────────────── */
  var TIERS = [
    { key: 'egg',     name: '幼蜂',     icon: '🥚',   min: 0,    floor: 0    },
    { key: 'worker',  name: '工蜂',     icon: '🐝',   min: 1000, floor: 1000 },
    { key: 'scout',   name: '侦察蜂',   icon: '🔍',   min: 1200, floor: 1200 },
    { key: 'guard',   name: '守卫蜂',   icon: '🛡️',   min: 1400, floor: 1400 },
    { key: 'queen',   name: '蜂王',     icon: '👑',   min: 1600, floor: 1600 },
    { key: 'legend',  name: '传奇蜂王', icon: '🌟',   min: 1800, floor: 1800 }
  ];

  var RATING_MIN = 0;
  var RATING_MAX = 4000;
  var LOSS_DAMPING = 0.6;   /* 输分阻尼 */
  var PLACEMENT_GAMES = 3;  /* 定级赛局数 */

  function num(v, dflt) {
    var n = +v;
    return (typeof n === 'number' && isFinite(n)) ? n : dflt;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* 段位查询：返回段位对象 + 段内进度 */
  /* 🔴v1156：**下一段还差多少。**

     天梯页原来只显示"工蜂 1062 分" —— 一个孤零零的数字，
     **不知道离下一段还差多远，也就没有"再打两局就能升"的推力**。

     段位的意义不只是给你贴个标签，是给你一个**看得见的下一步**。

     返回 null 表示已经是最高段（那时候不该再画进度条 ——
     一个永远填不满的条只会让人困惑）。 */
  function nextTierOf(rating) {
    var r = Number(rating) || 0;
    for (var i = 0; i < TIERS.length; i++) {
      if (r < TIERS[i].min) {
        var prev = TIERS[i - 1] || TIERS[0];
        var span = TIERS[i].min - prev.min;
        return {
          name: TIERS[i].name,
          icon: TIERS[i].icon,
          need: TIERS[i].min - r,                     /* 还差多少分 */
          from: prev.min,
          to: TIERS[i].min,
          /* 这一段走了多少 —— 0~1，给进度条用 */
          progress: span > 0 ? Math.max(0, Math.min(1, (r - prev.min) / span)) : 0
        };
      }
    }
    return null;                                       /* 已经是最高段 */
  }

  function tierOf(rating) {
    var r = clamp(num(rating, 1000), RATING_MIN, RATING_MAX);
    var idx = 0;
    for (var i = 0; i < TIERS.length; i++) if (r >= TIERS[i].min) idx = i;
    var t = TIERS[idx];
    var next = TIERS[idx + 1] || null;
    var span = next ? (next.min - t.min) : 200;
    var into = r - t.min;
    return {
      key: t.key, name: t.name, icon: t.icon, index: idx,
      min: t.min, floor: t.floor,
      nextAt: next ? next.min : null,
      nextName: next ? next.name : null,
      progress: next ? clamp(into / span, 0, 1) : 1,
      isTop: !next
    };
  }

  /* 期望胜率（标准 ELO） */
  function expectedScore(myRating, oppRating) {
    var a = num(myRating, 1000), b = num(oppRating, 1000);
    return 1 / (1 + Math.pow(10, (b - a) / 400));
  }

  /* K 值：定级期最大，随场次递减 */
  function kFactor(gamesPlayed, placed) {
    var g = Math.max(0, Math.floor(num(gamesPlayed, 0)));
    if (!placed || g < PLACEMENT_GAMES) return 40;
    if (g < 20) return 32;
    return 24;
  }

  /* 核心：算一局之后的新分
   * 返回 { rating, delta, tier, tierChanged, promoted, floorSaved } */
  function nextRating(opts) {
    opts = opts || {};
    var my = clamp(num(opts.myRating, 1000), RATING_MIN, RATING_MAX);
    var opp = clamp(num(opts.oppRating, 1000), RATING_MIN, RATING_MAX);
    var won = !!opts.won;
    var K = kFactor(opts.gamesPlayed, opts.placed !== false);
    var E = expectedScore(my, opp);

    var raw = won ? (K * (1 - E)) : (K * (0 - E) * LOSS_DAMPING);
    /* 至少变动 1 分，避免"打了一局什么都没发生"的空虚感 */
    var delta = raw >= 0 ? Math.max(1, Math.round(raw)) : Math.min(-1, Math.round(raw));

    var beforeTier = tierOf(my);
    var target = clamp(my + delta, RATING_MIN, RATING_MAX);

    /* ② 段位地板：输分不得跌破当前段位下限 */
    var floorSaved = false;
    if (!won && target < beforeTier.floor) {
      target = beforeTier.floor;
      floorSaved = true;
    }
    var actualDelta = target - my;
    var afterTier = tierOf(target);

    return {
      rating: target,
      delta: actualDelta,
      tier: afterTier,
      tierChanged: afterTier.key !== beforeTier.key,
      promoted: afterTier.index > beforeTier.index,
      floorSaved: floorSaved,
      k: K,
      expected: E
    };
  }

  /* 定级起点：用历史最佳 CPM 预估，不让老玩家从零苦爬
   * 预估分 = 1000 + (最佳CPM - 30) × 10，夹在 800~1600 */
  function placementEstimate(bestCpm) {
    var c = num(bestCpm, 0);
    if (c <= 0) return 1000;                 /* 无记录 → 工蜂起步 */
    return clamp(Math.round(1000 + (c - 30) * 10), 800, 1600);
  }

  /* 赛季软重置：高分回落但保留优势 */
  function seasonReset(rating) {
    var r = clamp(num(rating, 1000), RATING_MIN, RATING_MAX);
    return clamp(Math.round(1000 + (r - 1000) * 0.5), RATING_MIN, RATING_MAX);
  }

  /* 匹配分数带：入队时长越久放得越宽 */
  function matchBand(waitedSeconds) {
    var s = Math.max(0, num(waitedSeconds, 0));
    return clamp(100 + Math.floor(s / 5) * 50, 100, 400);
  }

  window.HansenSbLadder = {
    nextTierOf: nextTierOf,
    TIERS: TIERS.slice(),
    PLACEMENT_GAMES: PLACEMENT_GAMES,
    LOSS_DAMPING: LOSS_DAMPING,
    tierOf: tierOf,
    expectedScore: expectedScore,
    kFactor: kFactor,
    nextRating: nextRating,
    placementEstimate: placementEstimate,
    seasonReset: seasonReset,
    matchBand: matchBand
  };
})();
