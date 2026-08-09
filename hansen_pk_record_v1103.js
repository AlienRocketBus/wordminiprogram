/* hansen_pk_record_v1103.js —— 对战战绩与天梯分
 *
 * ═══ 为什么需要这个 ═══
 *
 * v1100~v1102 把对战玩法做好了，但**打完什么都不留下**：
 *   · 赢了没有痕迹，输了也没有损失 —— 那为什么要打？
 *   · 天梯一直是「敬请期待」
 *
 * 而 `hansen_sb_ladder_v1002.js` 里 ELO 算法**早就写好了**
 * （expectedScore / kFactor / nextRating / tierOf / placementEstimate），
 * 只是**没有任何地方存状态、也没人调用它** —— 缺的一直是这一层。
 *
 * ═══ 设计 ═══
 *
 * 本地记录（localStorage）：
 *   总战绩：wins / losses / draws / streak（连胜）/ bestStreak
 *   天梯：rating / placed（是否打完定级赛）/ placementGames
 *   历史：最近 20 局（对手、模式、比分、时间）
 *
 * **只有 A 抢答赛计入天梯** —— B/C 只记战绩不动分。
 * 这是 v1100 定下的规矩：排位就该是纯竞技。
 *
 * ⚠️ 这些键都以 `hansen_` 开头，会被备份收录、跟着账号走 ——
 *    那正是想要的：换设备登录，战绩和段位都在。
 *    （对比 v1094 那次：诊断类的内部键必须排除出备份，
 *      而战绩是**真实玩家数据**，就该同步。）
 */
(function () {
  'use strict';
  if (window.HansenPkRecord) return;

  var KEY = 'hansen_pk_record_v1';
  var MAX_HISTORY = 20;

  function L() { return window.HansenSbLadder; }

  function blank() {
    return {
      wins: 0, losses: 0, draws: 0,
      streak: 0, bestStreak: 0,
      rating: 1000,
      peakRating: 1000,       /* v1108: 历史最高分 —— 掉下来了也看得见自己曾经到过哪 */
      placementGames: 0,      /* 定级赛已打局数（只算 A 模式） */

      /* 🔴v1108 实力数据：光有胜负说明不了问题，
         要能回答"我到底强在哪、弱在哪"。 */
      words: 0,               /* 累计答过多少个词 */
      correct: 0,             /* 答对多少个 */
      totalMs: 0,             /* 答对那些词一共花了多少毫秒 */
      fastestMs: 0,           /* 最快一次拼对用了多久 */
      firstWins: 0,           /* 抢先拼对多少次 —— 这才是"手速"的真实体现 */

      bestCpm: 0,
      history: [],
      updatedAt: 0
    };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var d = JSON.parse(raw);
      var b = blank();
      /* 🔴v1112：**数值字段必须强制转数字。**
         原来是 `if (d[k] != null) b[k] = d[k]` —— 存档被写坏时
         （比如 `{"wins":"很多"}`）会原样吃进来，
         界面上就变成「胜 很多 负 0」，胜率计算也跟着崩。
         实测确认过这个问题。存档是用户数据、会跨设备同步，
         **必须假设它可能是任何东西**。 */
      Object.keys(b).forEach(function (k) {
        if (d[k] == null) return;
        if (k === 'history') { b[k] = Array.isArray(d[k]) ? d[k] : []; return; }
        if (typeof b[k] === 'number') {
          var n = Number(d[k]);
          if (!isFinite(n) || n < 0) return;                 /* 非数/负数 → 保留默认 */
          /* 🔴v1112：**还要封顶。** 实测 `{"rating":1e99}` 能通过 isFinite 检查，
             界面上会显示「1e+99 分」，段位计算也会失控。
             天梯分按 ELO 的合理区间封顶，其余计数类给个够大但有限的上限。 */
          var CAP = (k === 'rating' || k === 'peakRating') ? 4000 : 1e7;
          b[k] = Math.min(Math.floor(n), CAP);
          return;
        }
        b[k] = d[k];
      });
      if (!Array.isArray(b.history)) b.history = [];
      return b;
    } catch (e) { return blank(); }
  }

  function write(d) {
    try {
      d.updatedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(d));
      /* 战绩变了要让云存档知道 —— 否则换设备就丢了 */
      try { document.dispatchEvent(new CustomEvent('hsn-pk-record-changed')); } catch (e) {}
    } catch (e) {}
    return d;
  }

  /* 是否已完成定级赛 */
  /* 🔴v1156：**兜底值要和真值一样。**

     `(L() && L().PLACEMENT_GAMES) || 5` —— 兜底写的是 5，
     而段位表里真实值是 3。

     实测（让段位表脚本 404）：界面显示「再打 5 局定级赛 / 定级赛 0 / 5」，
     而正常时是 3 局。**同一个 App 在两种情况下告诉用户不同的规则。**

     兜底值存在的意义是"依赖没加载时也能大致工作"，
     **但它一旦和真值不同，就成了另一套规则** ——
     用户不会知道自己碰上的是降级模式，只会觉得这游戏说话不算数。

     > 兜底值不是随便填的默认数，它是"依赖挂了的时候的真相"。
     > 填错了，就等于准备了一个假的真相。 */
  function placed(d) {
    var need = (L() && L().PLACEMENT_GAMES) || 3;
    return (d || read()).placementGames >= need;
  }

  /* 段位（未定级时明确说"未定级"，不给一个假段位） */
  function tier(d) {
    d = d || read();
    if (!placed(d)) {
      var need = (L() && L().PLACEMENT_GAMES) || 3;
      return { name: '未定级', emoji: '🐝',
               sub: '再打 ' + Math.max(0, need - d.placementGames) + ' 局定级赛',
               placed: false };
    }
    var t = (L() && L().tierOf) ? L().tierOf(d.rating) : null;
    return { name: (t && t.name) || '工蜂', emoji: (t && t.emoji) || '🐝',
             sub: d.rating + ' 分', placed: true };
  }

  /* ── 记一局 ───────────────────────────────────────────────
     opts: { result:'win'|'lose'|'draw', mode:'A'|'B'|'C',
             oppName, myScore, oppScore, oppRating, cpm } */
  function record(opts) {
    opts = opts || {};
    var d = read();
    var res = opts.result;
    var isRanked = String(opts.mode || '').toUpperCase() === 'A';

    if (res === 'win') { d.wins++; d.streak = Math.max(0, d.streak) + 1; }
    else if (res === 'lose') { d.losses++; d.streak = 0; }
    else { d.draws++; }
    if (d.streak > d.bestStreak) d.bestStreak = d.streak;
    if (opts.cpm && opts.cpm > d.bestCpm) d.bestCpm = opts.cpm;

    /* v1108 累计实力数据 */
    d.words += Math.max(0, Number(opts.words) || 0);
    d.correct += Math.max(0, Number(opts.correct) || 0);
    d.totalMs += Math.max(0, Number(opts.totalMs) || 0);
    d.firstWins += Math.max(0, Number(opts.firstWins) || 0);
    var fm = Number(opts.fastestMs) || 0;
    if (fm > 0 && (!d.fastestMs || fm < d.fastestMs)) d.fastestMs = fm;

    var delta = 0;
    var floorSaved = false;
    if (isRanked && res !== 'draw' && L() && L().nextRating) {
      /* 定级赛期间也照常算分，只是段位先不显示 —— 打满局数才亮出来 */
      d.placementGames++;
      var r = L().nextRating({
        myRating: d.rating,
        oppRating: opts.oppRating || 1000,
        won: res === 'win',
        games: d.placementGames
      });
      var newRating = (r && (r.rating != null ? r.rating : r)) || d.rating;
      delta = Math.round(newRating - d.rating);
      /* 🔴v1128：把"段位地板保住了"这个信息带出去。
         实测：B 在 1000 分输了一局，分数纹丝不动、界面也什么都不显示 ——
         用户会以为记分坏了。而实际上是**段位地板保护**（输分不得跌破段位下限），
         那是好事，但**必须说出来**，不然好意变成了 bug。 */
      floorSaved = !!(r && r.floorSaved);
      d.rating = Math.round(newRating);
      if (d.rating > d.peakRating) d.peakRating = d.rating;
    }

    d.history.unshift({
      /* 🔴v1156：**没传模式就别猜一个。**

         原来默认成 'C'（接力赛）—— 而这条记录可能是任何模式的，
         历史里就会显示成"接力赛"，那是编出来的信息。

         判"算不算排位"用的是 `opts.mode || ''`（空串，不会误判成 A），
         这里也该一致：不知道就留空，界面上不显示模式，
         **比显示一个错的模式诚实**。 */
      at: Date.now(), result: res, mode: String(opts.mode || ''),
      opp: String(opts.oppName || '对手').slice(0, 16),
      my: Number(opts.myScore) || 0, oc: Number(opts.oppScore) || 0,
      delta: delta, ranked: isRanked
    });
    while (d.history.length > MAX_HISTORY) d.history.pop();

    write(d);
    return { ok: true, record: d, delta: delta, floorSaved: floorSaved,
             ranked: isRanked, tier: tier(d) };
  }

  /* v1156: 毫秒转秒 —— 太离谱的一律显示「—」 */
  /* v1156: 算百分比 —— 一律夹在 0~100，分母为 0 就是 0 */
  function pct(part, whole) {
    var a = Number(part), b = Number(whole);
    if (!isFinite(a) || !isFinite(b) || b <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(a * 100 / b)));
  }

  var SANE_MAX_MS = 5 * 60 * 1000;     /* 一个词想超过 5 分钟就不是真的了 */
  function secsOrDash(ms) {
    var n = Number(ms);
    if (!isFinite(n) || n <= 0 || n > SANE_MAX_MS) return '—';
    return (n / 1000).toFixed(1);
  }

  function summary() {
    var d = read();
    var total = d.wins + d.losses + d.draws;
    return {
      wins: d.wins, losses: d.losses, draws: d.draws, total: total,
      winRate: pct(d.wins, total),
      streak: d.streak, bestStreak: d.bestStreak,
      rating: d.rating, placed: placed(d),
      placementGames: d.placementGames,
      tier: tier(d),
      history: d.history.slice(),

      /* 🔴v1108 实力画像 —— 这些才是"我强在哪"的答案 */
      peakRating: d.peakRating,
      words: d.words,
      correct: d.correct,
      /* 🔴v1156：**百分比必须夹在 0~100。**

         实测（存档被写坏时：firstWins=1e12、correct=99999）：
         抢先率算出 **10000%**。

         而百分比超过 100 是自相矛盾的 ——
         「答对的词里抢在前面 10000%」这句话本身就不成立，
         用户看到只会觉得这个统计是坏的。

         存档会被写坏的原因很多：迁移中断、版本不一致、
         别的模块误写、用户手动改。
         **统计不该假设输入一定是干净的。** */
      accuracy: pct(d.correct, d.words),
      avgMs: d.correct ? Math.round(d.totalMs / d.correct) : 0,
      /* 🔴v1156：**大到没意义的秒数就别报数字了。**

         实测（totalMs 是个超大值时）：
         界面显示「平均 2000.0 秒」「最快 10000.0 秒」——
         一个词想 33 分钟显然不是真的，
         多半是切到后台很久、或者存档被写坏了。

         **报一个荒谬的精确数字，比报"—"更糟** ——
         用户会当真，然后觉得这个统计是坏的。

         超过 5 分钟一律当作"没法统计"，显示「—」。 */
      avgSecs: secsOrDash(d.correct ? d.totalMs / d.correct : 0),
      fastestSecs: secsOrDash(d.fastestMs),
      firstWins: d.firstWins,
      /* 抢先率：答对的词里有多少是抢在对手前面的 —— 手速的直接指标 */
      firstRate: pct(d.firstWins, d.correct),
    };
  }

  /* 🔴v1156：**换账号要把天梯战绩清掉。**

     实测：用 U1 打了 6 局到「工蜂 1105 分」，换成 U2 之后
     战绩**原封不动还在** —— 新账号一进来就看到别人的段位和分数。

     家里两个孩子共用一台手机时，这个问题很实在：
     **弟弟登录后看到的是哥哥的段位**，
     打第一局就发现"我怎么已经工蜂了"。
     而天梯分是要跟人走的，不是跟设备走的。

     v1142 修「换账号」时清了资料（名字/竞赛 ID），
     但天梯战绩是 v1103 之后才有的，那次没覆盖到 ——
     **又一次"新加的东西没接进已有的清理链路"**。

     做法：听 `hsn-account-uid-changed`（v1154 建立的唯一信号），
     记下战绩属于哪个 uid，一变就清空重来。 */
  var OWNER_KEY = 'hansen_pk_record_owner_v1156';

  function currentUid() {
    try {
      return (JSON.parse(localStorage.getItem('hansen_auth_v1004') || '{}') || {}).uid || '';
    } catch (e) { return ''; }
  }

  function syncOwner() {
    try {
      var now = currentUid();
      var was = localStorage.getItem(OWNER_KEY);
      if (was === null) {                     /* 第一次：认领当前战绩 */
        localStorage.setItem(OWNER_KEY, now);
        return;
      }
      if (was === now) return;                /* 同一个人，什么都不做 */
      /* 换人了：清空战绩，别让新账号看到别人的段位 */
      localStorage.removeItem(KEY);
      localStorage.setItem(OWNER_KEY, now);
      try { document.dispatchEvent(new CustomEvent('hsn-pk-record-changed')); } catch (e) {}
    } catch (e) {}
  }

  try {
    syncOwner();
    document.addEventListener('hsn-account-uid-changed', syncOwner);
    /* 别的标签页换了账号也要跟上 */
    window.addEventListener('storage', function (ev) {
      if (ev && ev.key === 'hansen_auth_v1004') setTimeout(syncOwner, 60);
    });
  } catch (e) {}

  window.HansenPkRecord = {
    _syncOwnerForTest: syncOwner,
    read: read, record: record, summary: summary, tier: tier, placed: placed,
    _reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
