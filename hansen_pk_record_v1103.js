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
      placementGames: 0,      /* 定级赛已打局数（只算 A 模式） */
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
      Object.keys(b).forEach(function (k) { if (d[k] != null) b[k] = d[k]; });
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
  function placed(d) {
    var need = (L() && L().PLACEMENT_GAMES) || 5;
    return (d || read()).placementGames >= need;
  }

  /* 段位（未定级时明确说"未定级"，不给一个假段位） */
  function tier(d) {
    d = d || read();
    if (!placed(d)) {
      var need = (L() && L().PLACEMENT_GAMES) || 5;
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

    var delta = 0;
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
      d.rating = Math.round(newRating);
    }

    d.history.unshift({
      at: Date.now(), result: res, mode: opts.mode || 'C',
      opp: String(opts.oppName || '对手').slice(0, 16),
      my: Number(opts.myScore) || 0, oc: Number(opts.oppScore) || 0,
      delta: delta, ranked: isRanked
    });
    while (d.history.length > MAX_HISTORY) d.history.pop();

    write(d);
    return { ok: true, record: d, delta: delta, ranked: isRanked, tier: tier(d) };
  }

  function summary() {
    var d = read();
    var total = d.wins + d.losses + d.draws;
    return {
      wins: d.wins, losses: d.losses, draws: d.draws, total: total,
      winRate: total ? Math.round(d.wins * 100 / total) : 0,
      streak: d.streak, bestStreak: d.bestStreak,
      rating: d.rating, placed: placed(d),
      placementGames: d.placementGames,
      tier: tier(d),
      history: d.history.slice()
    };
  }

  window.HansenPkRecord = {
    read: read, record: record, summary: summary, tier: tier, placed: placed,
    _reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
