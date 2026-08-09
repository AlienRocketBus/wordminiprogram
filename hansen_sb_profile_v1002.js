/* hansen_sb_profile_v1002.js —— 拼写蜂个人资料页（炫耀面板）
 *
 * 设计依据：《拼写蜂在线对战_社交层设计书_v1003》§1–§2
 * 本模块**纯本地**：所有数据来自 localStorage，不需要 envId、不联网即可完整使用。
 * 联网后只需在 §战绩 区多渲染几行天梯数据，其余不动。
 *
 * 数据源：
 *   身份      hansen_sb_profile_v1002        （天梯名 / #标签 / 展柜 / 隐私）
 *   最佳 CPM  sb_best_cpm                    （拼写蜂现有）
 *   学习战绩  wordIsland*                    （各岛存档，跨岛聚合）
 *   成就      window.HansenAch               （已解锁成就钱包）
 */
(function () {
  'use strict';
  if (window.HansenSbProfile) return;

  var PKEY = 'hansen_sb_profile_v1002';
  var NAME_MIN = 2, NAME_MAX = 12;
  var RENAME_COOLDOWN_DAYS = 30;
  var SHOWCASE_MAX = 6;

  /* 显示名过滤：公开展示内容的标准配置 */
  var BANNED = ['admin', '管理员', '官方', '客服', '系统', 'null', 'undefined'];

  /* ── 存储 ─────────────────────────────────────────────── */
  function readProfile() {
    var d = { name: '', cid: 0, cidLocked: false, showcase: [], privacy: 'public', nameChangedAt: 0, avatar: '' };
    try {
      var raw = localStorage.getItem(PKEY);
      if (!raw) return d;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return d;
      if (typeof o.name === 'string') d.name = o.name.slice(0, NAME_MAX);
      if (typeof o.cid === 'number' && isFinite(o.cid) && o.cid > 0) d.cid = Math.floor(o.cid);
      d.cidLocked = !!o.cidLocked;
      if (Array.isArray(o.showcase)) d.showcase = o.showcase.filter(function (x) { return typeof x === 'string'; }).slice(0, SHOWCASE_MAX);
      if (o.privacy === 'public' || o.privacy === 'friends' || o.privacy === 'private') d.privacy = o.privacy;
      if (typeof o.nameChangedAt === 'number' && isFinite(o.nameChangedAt)) d.nameChangedAt = o.nameChangedAt;
      if (typeof o.avatar === 'string') d.avatar = o.avatar.slice(0, 40);
    } catch (e) {}
    return d;
  }
  function writeProfile(p) {
    try { localStorage.setItem(PKEY, JSON.stringify(p)); return true; } catch (e) { return false; }
  }

  /* ── 天梯名 ───────────────────────────────────────────── */
  /* ── 竞赛 ID：按注册先后顺序发号，终身不变 ────────────────
   * 001 002 003 … 超过 999 自动扩到 4 位。这是身份证式标志：
   * 名字可以随便改，**号码永远不变**。
   *
   * ⚠️ 发号权归云端：真正的"注册顺序"必须由云端原子计数器裁决，
   *    否则每台设备都会认为自己是 001。当前 envId 未开通，
   *    先发**临时号**（本地计数），联网后调 claimCloudId() 认领正式号；
   *    一旦认领成功即写入 cidLocked，此后永不改动。 */
  var CID_LOCAL_KEY = 'hansen_sb_cid_counter_v1002';

  function nextLocalCid() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(CID_LOCAL_KEY), 10) || 0; } catch (e) {}
    n = n + 1;
    try { localStorage.setItem(CID_LOCAL_KEY, String(n)); } catch (e) {}
    return n;
  }
  /* 号码格式化：不足 3 位补零 */
  function fmtCid(n) {
    var v = Math.max(0, Math.floor(+n || 0));
    if (!v) return '---';
    var s = String(v);
    while (s.length < 3) s = '0' + s;
    return s;
  }
  /* 取得（必要时分配）本人竞赛 ID —— 幂等，已有则原样返回 */
  /* 🔴v1130：**不再发本地临时号。**

     产品定义：竞赛 ID **完全按注册人数的顺序分配** ——
     那是个**全局**的东西，本机自己编不出来。

     旧做法用 `nextLocalCid()` 从 1 开始本地计数，
     结果**每台设备的第一个用户都是 No.001** ——
     两个人一对号才发现"我们怎么都是 001"。
     而好友功能正是靠竞赛 ID 互加的，撞号会直接加错人。

     现在：没登录就是没有号（界面显示"登录后自动分配"，v1129 已改），
     登录时由云端按 `createdAt` 排序发正式号。
     **宁可没有，也不能给一个假的。** */
  function ensureCid() {
    var p = readProfile();
    return p.cid > 0 ? p.cid : 0;
  }
  /* 云端认领正式号（envId 到位后调用；当前为预留接口）
   * 约定：云端 counters/sb_cid 文档做原子自增，返回全局唯一序号。 */
  function claimCloudId(assignedNumber) {
    var p = readProfile();
    var n = Math.floor(+assignedNumber || 0);
    if (n <= 0) return { ok: false, reason: '云端未返回有效号码' };

    /* 🔴v1142：**云端说的号和本地锁着的号不一样 → 以云端为准。**

       原来只要 `cidLocked` 为真就直接返回，云端说什么都不听。
       用户现场：退出 A 号（No.002）登 B 号（No.003），
       云端明明回了 003，本地却因为锁着而一直显示 002。

       "锁死终身不变"这条规矩没错 —— 但它的意思是
       **同一个账号的号不变**，不是"这台手机上第一次拿到的号不变"。
       换了账号，号当然要换。

       云端的 cid 是按注册顺序算出来的，**它才是唯一权威**。
       本地这份只是缓存。缓存和权威不一致时，永远以权威为准。 */
    if (p.cidLocked && p.cid === n) return { ok: true, cid: n, already: true };
    var changed = (p.cidLocked && p.cid !== n);

    p.cid = n;
    p.cidLocked = true;
    if (changed) {
      /* 换账号了 —— 名字和改名冷却也是上一个账号的，一并清掉。
         否则新账号会顶着旧名字，而且点改名被告知"冷却中"。 */
      p.name = '';
      p.nameChangedAt = 0;
    }
    writeProfile(p);
    if (changed) {
      try { document.dispatchEvent(new CustomEvent('hsn-profile-reset')); } catch (e) {}
    }
    return { ok: true, cid: n, switched: changed };
  }
  function validateName(name) {
    var n = String(name == null ? '' : name).trim();
    if (n.length < NAME_MIN) return { ok: false, reason: '名字至少 ' + NAME_MIN + ' 个字' };
    if (n.length > NAME_MAX) return { ok: false, reason: '名字最多 ' + NAME_MAX + ' 个字' };
    if (/[<>"'`\\\/\u0000-\u001f]/.test(n)) return { ok: false, reason: '名字里不能有特殊符号' };
    var low = n.toLowerCase();
    for (var i = 0; i < BANNED.length; i++) {
      if (low.indexOf(BANNED[i]) >= 0) return { ok: false, reason: '这个名字不能用，换一个吧' };
    }
    return { ok: true, name: n };
  }
  function renameCooldownLeft(p) {
    if (!p.nameChangedAt) return 0;
    var passed = Date.now() - p.nameChangedAt;
    var need = RENAME_COOLDOWN_DAYS * 86400000;
    return passed >= need ? 0 : Math.ceil((need - passed) / 86400000);
  }
  function setName(name) {
    var p = readProfile();
    var v = validateName(name);
    if (!v.ok) return v;
    if (p.name) {
      var left = renameCooldownLeft(p);
      if (left > 0) return { ok: false, reason: '改名冷却中，还有 ' + left + ' 天' };
    }
    p.name = v.name;
    p.nameChangedAt = Date.now();
    writeProfile(p);
    var cid = ensureCid();   /* v1130: 只读现有号；没有就是 0，等登录时云端发 */
    return { ok: true, name: p.name, cid: cid };
  }
  function fullName(p) {
    p = p || readProfile();
    return p.name ? (p.name + ' · No.' + fmtCid(p.cid)) : '';
  }

  /* ── 跨岛战绩聚合 ─────────────────────────────────────── */
  function eachIslandSave(fn) {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('wordIsland') === 0 && k.indexOf('_bak') < 0) keys.push(k);
      }
    } catch (e) {}
    for (var j = 0; j < keys.length; j++) {
      try {
        var o = JSON.parse(localStorage.getItem(keys[j]));
        if (o && typeof o === 'object' && !Array.isArray(o)) fn(o, keys[j]);
      } catch (e) {}
    }
  }

  function collectStats() {
    var out = {
      islands: 0, learned: 0, days: 0, boss: 0,
      speedBest: 0, bubbleBest: 0, molesBest: 0, fishBest: 0, eagleBest: 0,
      maxCombo: 0, typeCount: 0, listenRight: 0, clozeRight: 0,
      bestCpm: 0, cpm: { easy: 0, mid: 0, hard: 0 }
    };
    eachIslandSave(function (S) {
      var learned = (S.learned && S.learned.length) || 0;
      if (learned > 0) out.islands++;
      out.learned += learned;
      var st = S.stats || {};
      out.days = Math.max(out.days, +st.daysPlayed || 0);
      out.boss += (+st.bossBeaten || 0);
      out.speedBest = Math.max(out.speedBest, +st.speedBest || 0);
      out.bubbleBest = Math.max(out.bubbleBest, +st.bubbleBest || 0);
      out.molesBest = Math.max(out.molesBest, +st.molesBest || 0);
      out.fishBest = Math.max(out.fishBest, +st.fishBest || 0);
      out.eagleBest = Math.max(out.eagleBest, +st.eagleBest || 0);
      out.maxCombo = Math.max(out.maxCombo, +st.maxCombo || 0);
      out.typeCount += (+st.typeCount || 0);
      out.listenRight += (+st.listenRight || 0);
      out.clozeRight += (+st.clozeRight || 0);
    });
    /* 拼写蜂最佳 CPM */
    try {
      var b = JSON.parse(localStorage.getItem('sb_best_cpm'));
      if (typeof b === 'number' && isFinite(b)) out.bestCpm = Math.max(0, Math.round(b));
      else if (b && typeof b === 'object') {
        ['easy', 'mid', 'hard'].forEach(function (k) {
          var v = +b[k] || 0; out.cpm[k] = Math.round(v);
          out.bestCpm = Math.max(out.bestCpm, Math.round(v));
        });
      }
    } catch (e) {
      var n = +localStorage.getItem('sb_best_cpm');
      if (isFinite(n) && n > 0) out.bestCpm = Math.round(n);
    }
    return out;
  }

  /* ── 天梯战绩（P0：本地记录；联网后由云端同步）─────────── */
  function readLadder() {
    var d = { rating: 0, placed: false, games: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, bestRating: 0 };
    try {
      var o = JSON.parse(localStorage.getItem('hansen_sb_ladder_v1002'));
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        ['rating', 'games', 'wins', 'losses', 'streak', 'bestStreak', 'bestRating'].forEach(function (k) {
          var v = +o[k]; if (isFinite(v) && v >= 0) d[k] = Math.floor(v);
        });
        d.placed = !!o.placed;
      }
    } catch (e) {}
    return d;
  }

  /* ── 成就展柜 ─────────────────────────────────────────── */
  function claimedAch() {
    try {
      if (window.HansenAch && typeof HansenAch.getClaimed === 'function') {
        var c = HansenAch.getClaimed();
        if (Array.isArray(c)) return c.slice();
        if (c && typeof c === 'object') return Object.keys(c).filter(function (k) { return c[k]; });
      }
    } catch (e) {}
    return [];
  }

  /* ── 渲染 ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function ensureStyle() {
    if (document.getElementById('hsp_prof_css')) return;
    var css = [
      '#hsb_prof{position:fixed;inset:0;z-index:70;display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      '  background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 55%,#312e81 100%);color:#e8eefc;padding:14px 12px 30px}',
      '#hsb_prof.on{display:block}',
      '#hsb_prof .pf_top{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
      '#hsb_prof .pf_back{background:rgba(255,255,255,.12);color:#e8eefc;border:0;border-radius:11px;padding:9px 13px;font:inherit;font-weight:800;cursor:pointer}',
      '#hsb_prof .pf_ttl{font-size:17px;font-weight:900;letter-spacing:.3px}',
      '#hsb_prof .pf_card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px;margin-bottom:11px}',
      '#hsb_prof .pf_id{display:flex;align-items:center;gap:12px}',
      '#hsb_prof .pf_ava{width:62px;height:62px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:38px;background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.22),rgba(255,255,255,.05) 65%,transparent 74%)}',
      '#hsb_prof .pf_name{font-size:19px;font-weight:900;line-height:1.25;word-break:break-all}',
      '#hsb_prof .pf_cid{margin-top:4px;font-size:12.5px;font-weight:800;letter-spacing:.4px;opacity:.9}',
      '#hsb_prof .pf_cid b{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:1px}',
      '#hsb_prof .pf_prov{margin-left:6px;font-size:10.5px;font-weight:800;opacity:.7;background:rgba(255,255,255,.14);padding:2px 6px;border-radius:99px}',
      '#hsb_prof .pf_tier{margin-top:5px;font-size:13.5px;font-weight:800;color:#fde68a}',
      '#hsb_prof .pf_sec{font-size:13px;font-weight:900;opacity:.82;margin:0 0 9px;letter-spacing:.4px}',
      '#hsb_prof .pf_grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
      '#hsb_prof .pf_it{background:rgba(255,255,255,.07);border-radius:12px;padding:10px 11px}',
      '#hsb_prof .pf_v{font-size:19px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.15}',
      '#hsb_prof .pf_l{font-size:11.5px;opacity:.72;margin-top:2px;font-weight:700}',
      '#hsb_prof .pf_hero{text-align:center;padding:4px 0 2px}',
      '#hsb_prof .pf_hero .pf_v{font-size:36px;color:#fde68a}',
      '#hsb_prof .pf_bar{height:8px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:9px}',
      '#hsb_prof .pf_bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#f59e0b)}',
      '#hsb_prof .pf_show{display:flex;flex-wrap:wrap;gap:8px}',
      '#hsb_prof .pf_slot{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.09);border:1px dashed rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer}',
      '#hsb_prof .pf_slot.has{border-style:solid;border-color:rgba(253,224,138,.55);background:rgba(253,224,138,.14)}',
      '#hsb_prof .pf_btn{width:100%;min-height:46px;border:0;border-radius:13px;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;font:inherit;font-weight:900;font-size:14.5px;cursor:pointer;margin-top:4px}',
      '#hsb_prof .pf_hint{font-size:11.5px;opacity:.66;margin-top:7px;line-height:1.5}',
      '#hsb_prof .pf_empty{opacity:.66;font-size:12.5px;padding:6px 0;line-height:1.6}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'hsp_prof_css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function render() {
    var host = document.getElementById('hsb_prof');
    if (!host) return;
    var p = readProfile();
    var s = collectStats();
    var L = readLadder();
    var tier = (window.HansenSbLadder && HansenSbLadder.tierOf) ? HansenSbLadder.tierOf(L.rating || 1000) : null;
    var named = !!p.name;
    var winRate = L.games > 0 ? Math.round(L.wins / L.games * 100) : 0;
    var ach = claimedAch();

    var h = '';
    h += '<div class="pf_top"><button class="pf_back" id="pfBack">← 返回</button>'
      + '<span class="pf_ttl">👤 我的资料</span></div>';

    /* 身份卡 */
    h += '<div class="pf_card"><div class="pf_id">'
      + '<span class="pf_ava">' + (p.avatar || '🐝') + '</span><div style="min-width:0;flex:1">'
      + (named
        ? '<div class="pf_name">' + esc(p.name) + '</div><div class="pf_cid">🎫 竞赛 ID <b>No.' + fmtCid(p.cid) + '</b>'
          + '</div>'
        : '<div class="pf_name" style="opacity:.7">还没起名字</div>')
      + (tier ? '<div class="pf_tier">' + tier.icon + ' ' + tier.name
          + (L.placed ? ' · ' + fmt(L.rating) + ' 分' : ' · 未定级') + '</div>' : '')
      + '</div></div>';
    if (tier && L.placed && !tier.isTop) {
      h += '<div class="pf_bar"><i style="width:' + Math.round(tier.progress * 100) + '%"></i></div>'
        + '<div class="pf_hint">距离 ' + tier.nextName + ' 还差 ' + fmt(Math.max(0, tier.nextAt - L.rating)) + ' 分</div>';
    }
    h += '<button class="pf_btn" id="pfName">' + (named ? '修改天梯名' : '设置天梯名') + '</button>';
    if (named) {
      var left = renameCooldownLeft(p);
      h += '<div class="pf_hint">' + (left > 0 ? '改名冷却中，还有 ' + left + ' 天' : '可以改名（改后 ' + RENAME_COOLDOWN_DAYS + ' 天内不能再改）') + '</div>';
    }
    h += '</div>';

    /* 速度纪录 —— 拼写蜂核心炫耀点 */
    h += '<div class="pf_card"><div class="pf_sec">⚡ 速度纪录</div>'
      + '<div class="pf_hero"><div class="pf_v">' + fmt(s.bestCpm) + '</div>'
      + '<div class="pf_l">最快拼写速度（字符 / 分钟）</div></div>';
    if (s.cpm.easy || s.cpm.mid || s.cpm.hard) {
      h += '<div class="pf_grid" style="margin-top:10px;grid-template-columns:1fr 1fr 1fr">'
        + '<div class="pf_it"><div class="pf_v">' + fmt(s.cpm.easy) + '</div><div class="pf_l">初级</div></div>'
        + '<div class="pf_it"><div class="pf_v">' + fmt(s.cpm.mid) + '</div><div class="pf_l">中级</div></div>'
        + '<div class="pf_it"><div class="pf_v">' + fmt(s.cpm.hard) + '</div><div class="pf_l">高级</div></div></div>';
    }
    h += '</div>';

    /* 天梯战绩 */
    h += '<div class="pf_card"><div class="pf_sec">🏆 天梯战绩</div>';
    if (L.games > 0) {
      h += '<div class="pf_grid">'
        + '<div class="pf_it"><div class="pf_v">' + fmt(L.games) + '</div><div class="pf_l">总场次</div></div>'
        + '<div class="pf_it"><div class="pf_v">' + winRate + '%</div><div class="pf_l">胜率</div></div>'
        + '<div class="pf_it"><div class="pf_v">' + fmt(L.wins) + ' 胜</div><div class="pf_l">' + fmt(L.losses) + ' 负</div></div>'
        + '<div class="pf_it"><div class="pf_v">' + fmt(L.bestStreak) + '</div><div class="pf_l">最长连胜</div></div>'
        + '</div>';
    } else {
      h += '<div class="pf_empty">还没打过天梯。在线对战开通后，你的段位、胜率和连胜纪录都会显示在这里。</div>';
    }
    h += '</div>';

    /* 学习成就 */
    h += '<div class="pf_card"><div class="pf_sec">📚 学习成就</div><div class="pf_grid">'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.learned) + '</div><div class="pf_l">已掌握单词</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.days) + '</div><div class="pf_l">连续学习(天)</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.boss) + '</div><div class="pf_l">击败 Boss</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.islands) + '</div><div class="pf_l">已探索岛屿</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.maxCombo) + '</div><div class="pf_l">最高连击</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.typeCount) + '</div><div class="pf_l">打字大师完成词</div></div>'
      + '</div></div>';

    /* 各玩法最佳 */
    h += '<div class="pf_card"><div class="pf_sec">🎮 各玩法最佳</div><div class="pf_grid">'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.speedBest) + '</div><div class="pf_l">极速60秒</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.bubbleBest) + '</div><div class="pf_l">泡泡大作战</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.eagleBest) + '</div><div class="pf_l">火眼金睛</div></div>'
      + '<div class="pf_it"><div class="pf_v">' + fmt(s.molesBest) + '</div><div class="pf_l">打地鼠</div></div>'
      + '</div></div>';

    /* 奖杯展柜 */
    h += '<div class="pf_card"><div class="pf_sec">🏅 奖杯展柜（最多 ' + SHOWCASE_MAX + ' 个）</div><div class="pf_show">';
    for (var i = 0; i < SHOWCASE_MAX; i++) {
      var got = p.showcase[i];
      h += '<span class="pf_slot' + (got ? ' has' : '') + '" data-slot="' + i + '">' + (got ? '🏆' : '＋') + '</span>';
    }
    h += '</div><div class="pf_hint">已解锁 ' + ach.length + ' 个成就，点空位挑选想展示的。</div></div>';

    host.innerHTML = h;

    var back = document.getElementById('pfBack');
    if (back) back.onclick = function () { close(); };
    var nm = document.getElementById('pfName');
    if (nm) nm.onclick = function () { promptName(); };
    var slots = host.querySelectorAll('.pf_slot');
    for (var k = 0; k < slots.length; k++) {
      slots[k].onclick = (function (idx) {
        return function () { pickShowcase(idx); };
      })(k);
    }
  }

  function promptName() {
    var p = readProfile();
    if (p.name) {
      var left = renameCooldownLeft(p);
      if (left > 0) { toast('改名冷却中，还有 ' + left + ' 天'); return; }
    }
    var v = window.prompt('给自己起个天梯名（' + NAME_MIN + '–' + NAME_MAX + ' 个字）', p.name || '');
    if (v == null) return;
    var r = setName(v);
    if (!r.ok) { toast(r.reason); return; }
    toast('天梯名已设为 ' + r.name + ' · No.' + fmtCid(r.cid));
    render();
  }

  function pickShowcase(idx) {
    var p = readProfile();
    var ach = claimedAch();
    if (!ach.length) { toast('还没有已解锁的成就，先去挑战吧'); return; }
    if (p.showcase[idx]) {
      p.showcase[idx] = '';
      p.showcase = p.showcase.filter(function (x) { return !!x; });
      writeProfile(p); render(); return;
    }
    var used = {};
    p.showcase.forEach(function (x) { used[x] = 1; });
    var avail = ach.filter(function (a) { return !used[a]; });
    if (!avail.length) { toast('可展示的成就都已放进展柜了'); return; }
    p.showcase = p.showcase.filter(function (x) { return !!x; });
    p.showcase.push(avail[0]);
    p.showcase = p.showcase.slice(0, SHOWCASE_MAX);
    writeProfile(p); render();
  }

  function toast(msg) {
    /* 🔴v1156：**先交给统一的提示，拿不到再用本地这份。**

       全站有 9 个模块各写了一份 `toast()`，共 49 处调用。
       实测它们长得并不一样：
         · land_cards / sb_profile —— 从**底部**弹，底色 rgba(15,23,42,.95)
         · theme_lock / theme_shop —— 从**顶部**弹，底色 rgba(26,38,96,.95)

       于是用户在同一个 App 里会看到两种完全不同的提示样式，
       **同一件事在不同页面上长得不一样，人会以为是两回事**。

       把 49 处调用全改掉风险太大（都在各自模块的逻辑里），
       所以改成**转发**：有统一实现就用它，没有才走本地这份。
       这样样式立刻统一，而每个模块的调用一行都不用动。 */
    try {
      if (window.HansenToast && HansenToast.say) { HansenToast.say(msg); return; }
    } catch (e) {}

    try {
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    } catch (e) {}
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:99;'
      + 'background:rgba(15,23,42,.94);color:#fff;padding:10px 16px;border-radius:12px;font-weight:800;font-size:13px;max-width:82vw;text-align:center';
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (e) {} }, 2000);
  }

  function ensureHost() {
    var el = document.getElementById('hsb_prof');
    if (el) return el;
    ensureStyle();
    el = document.createElement('div');
    el.id = 'hsb_prof';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '我的资料');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function open() {
    var el = ensureHost();
    render();
    el.classList.add('on');
    try { el.scrollTop = 0; } catch (e) {}
  }
  function close() {
    var el = document.getElementById('hsb_prof');
    if (el) el.classList.remove('on');
  }

  /* ── 🔴v1142 换账号时清掉上一个人的资料 ──────────────────

     用户现场：手机上退出 A 号、登了 B 号（B 的竞赛 ID 是 003），
     **页面上还显示 A 的名字和 No.002**，而且点了也改不了名字。

     两个症状，一个根子：**退出登录时完全不动本地资料。**
       · 名字和 cid 还是上一个账号的
       · `cidLocked` 是锁死的 → B 的 003 写不进去
       · `nameChangedAt` 是 A 留下的 → B 点改名被告知"冷却中"

     这违反了本项目最核心的一条：**所有数据必须跟着账号走。**
     资料（名字、竞赛 ID、头像）当然也是数据。

     做法：退出登录时把资料重置为空白。
     不是"删掉这个键"——那样别的模块读到 null 可能出别的问题；
     而是**写回一份干净的初始资料**，语义明确、行为可预期。 */
  function resetForAccountSwitch() {
    try {
      var blank = {
        name: '', cid: 0, cidLocked: false,
        avatar: '\ud83d\udc1d', showcase: [], privacy: 'public',
        nameChangedAt: 0    /* 冷却也要清 —— 那是上一个账号的记录 */
      };
      localStorage.setItem(PKEY, JSON.stringify(blank));
      try { document.dispatchEvent(new CustomEvent('hsn-profile-reset')); } catch (e) {}
      return { ok: true };
    } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  }

  /* ── 🔴v1154 账号一变就清资料 —— 不管走哪条路 ──────────────

     用户现场：「我用相同的设备换账号，换不了。注册了新账号登录，
     那个 ID 依然还是原来那个，而且点击也没法编辑。」

     v1142 我做过一次修复，但**只挂在"点退出登录"那条路上** ——
     而换账号根本不一定走那条路：
       · 直接在登录页登另一个账号（不先退出）
       · 注册新账号后自动登录
       · 换设备后云端把登录态同步过来
     这几条路上 `signOut` 都不会被调用，于是资料原封不动。

     真浏览器复现确认：换 uid 后名字还是「小明」、ID 还是 No.002、
     点改名被告知「冷却中，还有 30 天」—— 和用户描述一字不差。

     正确的做法是**盯住"当前账号是谁"这件事本身**：
     记下资料属于哪个 uid，一旦对不上就清。
     这样不管从哪条路换的账号，都会被抓到。 */
  var OWNER_UID_KEY = 'hansen_sb_profile_owner_v1154';

  function currentUid() {
    try {
      var raw = localStorage.getItem('hansen_auth_v1004');
      return (JSON.parse(raw || '{}') || {}).uid || '';
    } catch (e) { return ''; }
  }

  function syncOwner() {
    try {
      var uid = currentUid();
      var was = localStorage.getItem(OWNER_UID_KEY) || '';
      if (!uid) return;                    /* 没登录时不动 —— 匿名玩的资料是他自己的 */
      if (was === uid) return;             /* 还是同一个人 */
      if (was && was !== uid) {
        /* 换人了 —— 上一个账号的名字、竞赛 ID、改名冷却全部作废 */
        resetForAccountSwitch();
      }
      localStorage.setItem(OWNER_UID_KEY, uid);
    } catch (e) {}
  }

  /* 三条触发路径，覆盖所有换账号的方式 */
  try {
    document.addEventListener('hsn-auth-changed', function () {
      setTimeout(syncOwner, 60);
    });
    /* v1154: 登录态的唯一出口发出的信号 —— 不管走哪条路换的账号都会到这儿 */
    document.addEventListener('hsn-account-uid-changed', function () {
      syncOwner();
    });
    /* 别的标签页换了账号（v1147 已有跨标签页提示，这里同步资料） */
    window.addEventListener('storage', function (ev) {
      if (ev && ev.key === 'hansen_auth_v1004') setTimeout(syncOwner, 60);
    });
    /* 🔴v1154：**立刻同步一次，不能等。**

       第一版写的是 `setTimeout(syncOwner, 1200)`，想着"等账号模块就绪"。
       实测（路径②：换账号后直接刷新页面）**没通** ——
       因为身份条早在那 1.2 秒之前就画完了，界面还是旧名字旧 ID；
       而且 `setName` 的冷却检查读的是当时的资料，照样被挡。

       而 `currentUid()` 只是读 localStorage，**根本不需要等任何模块** ——
       第一版那个延迟是我想当然加的。

       改为：模块加载时立刻同步，再补一次延迟的（防某些页面加载顺序特殊）。 */
    syncOwner();
    setTimeout(syncOwner, 1200);
  } catch (e) {}

  window.HansenSbProfile = {
    resetForAccountSwitch: resetForAccountSwitch,
    _syncOwner: syncOwner,
    _open: open,
    _close: close,
    readProfile: readProfile,
    setName: setName,
    validateName: validateName,
    fullName: fullName,
    ensureCid: ensureCid,
    claimCloudId: claimCloudId,
    fmtCid: fmtCid,
    collectStats: collectStats,
    renameCooldownLeft: renameCooldownLeft,
    RENAME_COOLDOWN_DAYS: RENAME_COOLDOWN_DAYS,
    SHOWCASE_MAX: SHOWCASE_MAX
  };
})();
