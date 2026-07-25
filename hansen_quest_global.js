/* hansen_quest_global.js — v942 全游戏统一每日任务账本
   27 个冒险页共享同一组任务、进度与领取状态。

   v942 安全/一致性约束：
   - 存档只信任已知任务 id、progress、claimed；所有展示字段均从内部 POOL 重建，
     因而导入备份中的 title/icon/type/goal/reward 字符串永远不会进入 UI。
   - 领取先写可恢复事务，各奖励使用稳定 sourceId；所有奖励确认后才写 claimed。
     任一存储/钱包断点失败均可安全重试，不会重复发币，也不会把未发成的任务标为已领。 */
(function () {
  'use strict';

  var KEY = 'hansen_global_daily_quests_v941'; /* 保留 v941 key，原有进度无损升级。 */
  var TX_KEY = 'hansen_quest_claim_pending_v942';
  var VERSION = 942;

  var POOL = [
    {id:'learn3',icon:'📚',title:'学会 3 个新单词',goal:3,type:'learn',reward:{xp:20}},
    {id:'learn5',icon:'📖',title:'学会 5 个新单词',goal:5,type:'learn',reward:{xp:30}},
    {id:'learn10',icon:'🎓',title:'学会 10 个新单词',goal:10,type:'learn',reward:{xp:60}},
    {id:'review3',icon:'🔄',title:'复习单词 · 巩固 3 个',goal:3,type:'review',reward:{xp:25}},
    {id:'review6',icon:'🧠',title:'复习单词 · 巩固 6 个',goal:6,type:'review',reward:{xp:50}},
    {id:'reviewClear',icon:'✨',title:'复习单词 · 清空今日复习',goal:1,type:'reviewClear',reward:{xp:70}},
    /* 🔴v1001(Hansen): 拼写蜂对决 —— 每日必做基石, 且必须【打赢】才算完成 */
    {id:'sbWin1',icon:'🐝',title:'拼写蜂对决 · 打赢 1 场',goal:1,type:'sbwin',reward:{xp:80}},
    {id:'sbWin2',icon:'🏆',title:'拼写蜂对决 · 打赢 2 场',goal:2,type:'sbwin',reward:{xp:150}},
    {id:'boss1',icon:'🗡️',title:'击败 1 次挑战',goal:1,type:'boss',reward:{xp:25}},
    {id:'boss3',icon:'🐉',title:'击败 3 次 Boss',goal:3,type:'boss',reward:{xp:70}},
    {id:'correct20',icon:'✅',title:'累计答对 20 题',goal:20,type:'correct',reward:{xp:30}},
    {id:'correct50',icon:'💯',title:'累计答对 50 题',goal:50,type:'correct',reward:{xp:80}},
    {id:'listen10',icon:'🔊',title:'听音辨义 · 答对 10 次',goal:10,type:'listen',reward:{xp:25}},
    {id:'listen20',icon:'🎧',title:'听音辨义 · 答对 20 次',goal:20,type:'listen',reward:{xp:60}},
    {id:'cloze5',icon:'📝',title:'完形填空 · 答对 5 题',goal:5,type:'cloze',reward:{xp:25}},
    {id:'cloze10',icon:'✍️',title:'完形填空 · 答对 10 题',goal:10,type:'cloze',reward:{xp:55}},
    {id:'scramble1',icon:'🔤',title:'字母拼拼乐 · 完成 1 轮',goal:1,type:'scramble',reward:{xp:50}},
    {id:'scramble3',icon:'⭐',title:'字母拼拼乐 · 完成 3 轮',goal:3,type:'scramble',reward:{xp:120}},
    {id:'scramble5',icon:'🏆',title:'字母拼拼乐 · 完成 5 轮',goal:5,type:'scramble',reward:{xp:200}},
    {id:'type5',icon:'⌨️',title:'打字大师 · 完成 5 词',goal:5,type:'type',reward:{xp:30}},
    {id:'type15',icon:'⚡',title:'打字大师 · 完成 15 词',goal:15,type:'type',reward:{xp:80}},
    {id:'type30',icon:'🔥',title:'打字大师 · 完成 30 词',goal:30,type:'type',reward:{xp:160}},
    {id:'match1',icon:'🃏',title:'记忆翻牌 · 配对成功 8 组',goal:8,type:'match',reward:{xp:20}},
    {id:'match3',icon:'🎴',title:'记忆翻牌 · 配对成功 16 组',goal:16,type:'match',reward:{xp:65}},
    {id:'moles1',icon:'🎯',title:'打地鼠 · 累计得 30 分',goal:30,type:'moles',reward:{xp:30}},
    {id:'moles3',icon:'🎪',title:'打地鼠 · 累计得 60 分',goal:60,type:'moles',reward:{xp:80}},
    {id:'fish1',icon:'🎣',title:'钓鱼大师 · 累计得 30 分',goal:30,type:'fish',reward:{xp:30}},
    {id:'fish3',icon:'🐟',title:'钓鱼大师 · 累计得 60 分',goal:60,type:'fish',reward:{xp:80}},
    {id:'eagle1',icon:'👀',title:'火眼金睛 · 累计得 30 分',goal:30,type:'eagle',reward:{xp:30}},
    {id:'eagle3',icon:'🦅',title:'火眼金睛 · 累计得 60 分',goal:60,type:'eagle',reward:{xp:80}},
    {id:'bubble30',icon:'🫧',title:'泡泡大作战 · 得 30 分',goal:30,type:'bubble',reward:{xp:20}},
    {id:'bubble60',icon:'💧',title:'泡泡大作战 · 得 60 分',goal:60,type:'bubble',reward:{xp:60}},
    {id:'speed200',icon:'⚡',title:'极速60秒 · 得 200 分',goal:200,type:'speed',reward:{xp:35}},
    {id:'speed500',icon:'⚡⚡',title:'极速60秒 · 得 500 分',goal:500,type:'speed',reward:{xp:100}}
  ];
  var BY_ID = {};
  for (var pi = 0; pi < POOL.length; pi++) BY_ID[POOL[pi].id] = POOL[pi];

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function notice(msg, e) {
    try {
      if (typeof window.__hsnSaveNotice === 'function') window.__hsnSaveNotice(msg, e);
      else window.dispatchEvent(new CustomEvent('hansen-save-error', {detail:{message:msg,error:String(e && e.message || e || msg)}}));
    } catch (_e) {}
  }
  function readJson(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try {
      var raw = JSON.stringify(value);
      localStorage.setItem(key, raw);
      return localStorage.getItem(key) === raw;
    } catch (e) { return false; }
  }
  function removeVerified(key) {
    try { localStorage.removeItem(key); return localStorage.getItem(key) === null; }
    catch (e) { return false; }
  }
  function readRaw() { return readJson(KEY, null); }
  function writeRaw(s) { return writeJson(KEY, s); }
  function hash(text) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function rng(seed) {
    var x = seed >>> 0;
    return function () {
      x += 0x6D2B79F5;
      var t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, random) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function makeDay(day) {
    var random = rng(hash('hansen-v941-quests:' + day)); /* 保持 v941 每日题组不变。 */
    var byType = {};
    for (var i = 0; i < POOL.length; i++) {
      var q = POOL[i];
      if (!byType[q.type]) byType[q.type] = [];
      byType[q.type].push(q);
    }
    /* 🔴v1001 科学重设: 每天 12 个 = 4 固定基石(学新词+复习+打Boss+拼写蜂打赢) + 8 随机, 类型不重复 */
    var pickType = function(t){ var arr=byType[t]; if(!arr||!arr.length) return null;
      return clone(arr[Math.floor(random()*arr.length)]); };
    var used = {}, list = [];
    var addByType = function(t){ if(used[t]) return false; var it=pickType(t); if(!it) return false;
      used[t]=1; it.progress=0; it.claimed=false; list.push(it); return true; };
    var addReview = function(){ if(used['review']||used['reviewClear']) return false;
      var pool=(byType['review']||[]).concat(byType['reviewClear']||[]); if(!pool.length) return false;
      var it=clone(pool[Math.floor(random()*pool.length)]); used[it.type]=1;
      it.progress=0; it.claimed=false; list.push(it); return true; };
    /* ★ 基石: 学新词 / 复习单词 / 打Boss / 拼写蜂对决打赢 —— 用户明确要求每天必有 */
    var _noNew=false; try{ _noNew=(typeof S!=='undefined'&&S.learned&&typeof allW!=='undefined'&&allW&&S.learned.length>=allW.length);}catch(e){}
    if(!_noNew) addByType('learn');
    addReview();
    addByType('boss');
    addByType('sbwin');   /* 🔴v1001: 拼写蜂对决(必须打赢) —— 用户明确要求每天必做 */
    /* 拼写重头戏优先各抽 1 */
    addByType('scramble'); addByType('type');
    /* 其余按类型不重复随机补至 12 */
    var rest = Object.keys(byType).filter(function(t){
      /* 🔴v1001修: review 与 reviewClear 同属复习基石, 补位阶段两者都要排除(否则同日重复出现复习任务) */
      return !used[t] && t!=='review' && t!=='reviewClear' && !(_noNew && t==='learn'); });
    shuffle(rest, random);
    for(var r=0; r<rest.length && list.length<12; r++) addByType(rest[r]);
    shuffle(list, random);
    return {version:VERSION, day:day, list:list, allDay:''};
  }

  /* 返回纯净副本；绝不修改、也绝不把不可信对象直接镜像给 UI。 */
  function sanitizeState(raw, expectedDay) {
    if (!raw || (raw.version !== 941 && raw.version !== VERSION) || raw.day !== expectedDay ||
        !Array.isArray(raw.list) || raw.list.length < 1 || raw.list.length > 12) return null;/*🔴v1000: 7→≤12*/
    var ids = {}, types = {}, list = [];
    for (var i = 0; i < raw.list.length; i++) {
      var saved = raw.list[i];
      if (!saved || typeof saved !== 'object' || Array.isArray(saved) || typeof saved.id !== 'string') return null;
      var def = BY_ID[saved.id];
      if (!def || ids[def.id] || types[def.type]) return null;
      ids[def.id] = 1; types[def.type] = 1;
      var item = clone(def);
      if (typeof saved.progress !== 'number' || !isFinite(saved.progress) ||
          Math.floor(saved.progress) !== saved.progress || saved.progress < 0 || saved.progress > item.goal ||
          typeof saved.claimed !== 'boolean' || (saved.claimed && saved.progress !== item.goal)) return null;
      item.progress = saved.progress;
      item.claimed = saved.claimed === true;
      list.push(item);
    }
    var allDone = list.every(function (item) { return item.claimed && item.progress === item.goal; });
    if (raw.allDay === expectedDay && !allDone) return null;
    return {
      version:VERSION,
      day:expectedDay,
      list:list,
      allDay:raw.allDay === expectedDay ? expectedDay : ''
    };
  }
  function validState(s, day) { return !!sanitizeState(s, day); }
  function mirror(s) {
    try { if (window.S) window.S.quests = clone(s); } catch (e) {}
  }
  var ensureRecovering = false;
  function ensure() {
    var day = today(), raw = readRaw(), pending = readTx();
    /* 同一标签跨过午夜时，必须先把昨天已落盘的领取事务续做完，再创建今天的任务。
       否则直接用 makeDay(day) 覆盖旧日状态，会让 settleTx 找不到昨天的任务并丢失应得奖励。 */
    if (pending && pending.day !== day) {
      var recovered = false;
      if (!ensureRecovering) {
        ensureRecovering = true;
        try { recovered = recoverPending(); } catch (e) { recovered = false; }
        ensureRecovering = false;
      }
      if (!recovered) {
        var held = sanitizeState(raw, pending.day) || makeDay(pending.day);
        notice('昨日任务奖励仍在恢复；为防丢奖，今日任务暂未覆盖旧账本', new Error('cross-day quest transaction pending'));
        mirror(held);
        return held;
      }
      raw = readRaw();
    }
    var s = sanitizeState(raw, day);
    if (!s) s = makeDay(day);
    /* 每次都覆写纯净 schema；写失败也只把纯净内存对象交给 UI。 */
    if (!writeRaw(s)) notice('每日任务存档未能保存，本次进度将不会冒险覆盖旧数据', new Error('quest state write failed'));
    mirror(s);
    return s;
  }
  function persist(s) {
    s.version = VERSION;
    var clean = sanitizeState(s, s.day);
    if (!clean || !writeRaw(clean)) {
      notice('每日任务进度未能保存，请释放浏览器存储空间后重试', new Error('quest persist failed'));
      return false;
    }
    mirror(clean);
    try { if (typeof window.save === 'function') window.save(); } catch (e) {}
    return true;
  }
  function refresh() {
    try { if (typeof window.updateQuestBadge === 'function') window.updateQuestBadge(); } catch (e) {}
  }
  function progress(type, amount, absolute) {
    var s = ensure(), n = Math.max(0, Math.floor(+amount || 0)), changed = false;
    for (var i = 0; i < s.list.length; i++) {
      var q = s.list[i];
      if (q.type !== type || q.claimed) continue;
      var next = absolute ? Math.max(q.progress, Math.min(q.goal, n)) : Math.min(q.goal, q.progress + (n || 1));
      if (next !== q.progress) { q.progress = next; changed = true; }
    }
    var ok = !changed || persist(s);
    if (!changed) mirror(s);
    refresh();
    return changed && ok;
  }
  function streak() {
    try {
      if (window.HansenCheckin && typeof window.HansenCheckin.getStreak === 'function')
        return Math.max(0, Math.floor(+window.HansenCheckin.getStreak() || 0));
    } catch (e) {}
    try { return Math.max(0, Math.floor(+(window.S && window.S.streak) || 0)); } catch (e2) { return 0; }
  }
  function questCoins(q) { return Math.max(20, Math.round((+q.reward.xp || 0) * 0.6 / 5) * 5); }

  /* 两个奖励模块共用的“非钱包效果”幂等层。钱包币本身使用其 award(sourceId,n)。 */
  function effects() {
    if (window.HansenRewardEffectsV942 &&
        typeof window.HansenRewardEffectsV942.boostAward === 'function' &&
        typeof window.HansenRewardEffectsV942.xpAward === 'function') return window.HansenRewardEffectsV942;
    var BOOST_LEDGER = 'hansen_reward_boost_awards_v942';
    var BOOST_PENDING = 'hansen_reward_boost_pending_v942';
    var XP_LEDGER = 'hansen_reward_xp_awards_v942';
    var XP_PENDING = 'hansen_reward_xp_pending_v942';
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function exactInt(v, min, max) {
      return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min && v <= max;
    }
    function storedJson(key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) return {ok:true, absent:true, value:null};
        try { return {ok:true, absent:false, value:JSON.parse(raw)}; }
        catch (e) { return {ok:false, absent:false, value:null}; }
      } catch (e2) { return {ok:false, absent:false, value:null}; }
    }
    function rawSet(key, value) {
      try {
        if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        return value === null ? localStorage.getItem(key) === null : localStorage.getItem(key) === value;
      } catch (e) { return false; }
    }
    function validId(id) {
      return typeof id === 'string' && id.length > 0 && id.length <= 180 &&
        /^[a-z0-9:_-]+$/i.test(id) && id !== '__proto__' && id !== 'prototype' && id !== 'constructor';
    }
    function validOriginKey(key) { return typeof key === 'string' && /^wordIsland[A-Za-z0-9]{1,80}$/.test(key); }
    function ledgerMap(key, kind) {
      var r = storedJson(key);
      if (!r.ok) return null;
      if (r.absent) return {};
      var x = r.value;
      if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
      var keys = Object.keys(x);
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i], e = x[id];
        if (!validId(id) || !e || typeof e !== 'object' || Array.isArray(e)) return null;
        if (kind === 'boost') {
          if (!exactInt(e.minutes, 1, 1440) || !exactInt(e.target, 0, Number.MAX_SAFE_INTEGER) ||
              !exactInt(e.at, 1, Number.MAX_SAFE_INTEGER)) return null;
        } else {
          if (!exactInt(e.amount, 1, 100000) || !exactInt(e.at, 1, Number.MAX_SAFE_INTEGER)) return null;
          if (own(e, 'originKey')) {
            if (!validOriginKey(e.originKey) || !exactInt(e.targetIsland, 1, 1000000000) ||
                !exactInt(e.targetGlobal, 1, 1000000000)) return null;
          } else if (!exactInt(e.actual, 1, 1000000000)) return null; /* 兼容已提交的早期 v942 收据。 */
        }
      }
      return x;
    }
    function pendingObject(key) {
      var r = storedJson(key);
      if (!r.ok) return {invalid:true};
      if (r.absent) return null;
      return r.value && typeof r.value === 'object' && !Array.isArray(r.value) ? r.value : {invalid:true};
    }
    function readBoostUntil() {
      try {
        var raw = localStorage.getItem('hsn_crystal_boost_until');
        if (raw === null) return 0;
        var n = Number(raw);
        return exactInt(n, 0, Number.MAX_SAFE_INTEGER) && String(n) === raw ? n : null;
      } catch (e) { return null; }
    }
    function recoverBoost() {
      var p = pendingObject(BOOST_PENDING), ledger = ledgerMap(BOOST_LEDGER, 'boost');
      if (!ledger) { notice('记忆强化奖励账本已损坏；已停止发奖且保留原始数据', new Error('invalid boost ledger')); return false; }
      if (!p) return true;
      if (p.invalid || !validId(p.id) || !exactInt(p.minutes, 1, 1440) ||
          !exactInt(p.before, 0, Number.MAX_SAFE_INTEGER) || !exactInt(p.target, 1, Number.MAX_SAFE_INTEGER) ||
          !exactInt(p.createdAt, 1, Number.MAX_SAFE_INTEGER) ||
          p.target !== Math.max(p.createdAt, p.before) + p.minutes * 60000) {
        notice('记忆强化恢复凭据已损坏；已停止恢复且保留原始数据', new Error('invalid boost pending')); return false;
      }
      if (own(ledger, p.id)) { return removeVerified(BOOST_PENDING); }
      var cur = readBoostUntil();
      if (cur === null || (cur !== p.before && cur !== p.target)) return false;
      if (cur === p.before && !rawSet('hsn_crystal_boost_until', String(p.target))) return false;
      ledger[p.id] = {minutes:p.minutes, target:p.target, at:p.createdAt};
      if (!writeJson(BOOST_LEDGER, ledger)) return false;
      return removeVerified(BOOST_PENDING);
    }
    function boostAward(id, minutes) {
      id = String(id || ''); minutes = Math.floor(Number(minutes) || 0);
      if (!validId(id) || minutes < 1 || minutes > 1440 || !recoverBoost()) return false;
      var ledger = ledgerMap(BOOST_LEDGER, 'boost'); if (!ledger) return false; if (own(ledger, id)) return true;
      var now = Date.now(), before = readBoostUntil(); if (before === null) return false;
      var p = {id:id, minutes:minutes, before:before, target:Math.max(now, before) + minutes * 60000, createdAt:now};
      if (!writeJson(BOOST_PENDING, p)) return false;
      if (!recoverBoost()) { notice('记忆强化奖励尚未保存，稍后会自动重试', new Error('boost award pending')); return false; }
      return true;
    }
    function saveCurrentIsland() {
      try {
        if (typeof window.__hsnSaveNow === 'function') return window.__hsnSaveNow() === true;
        return false; /* v942 正式页必须提供可验证 save；不把 undefined 当成功。 */
      } catch (e) { return false; }
    }
    function currentTotalXP() {
      var n = Number(window.S && window.S.totalXP);
      return isFinite(n) && n >= 0 ? n : 0;
    }
    function currentOriginKey() {
      var k = String(window.__hsnSaveKey || '');
      return validOriginKey(k) ? k : '';
    }
    function readGlobalXP() {
      try {
        var raw = localStorage.getItem('hansen_wallet_charxp');
        if (raw === null) return 0;
        var n = Number(raw);
        return exactInt(n, 0, 1000000000) && String(n) === raw ? n : null;
      } catch (e) { return null; }
    }
    function parseIsland(raw) {
      try {
        var s = JSON.parse(raw);
        if (!s || typeof s !== 'object' || Array.isArray(s) || !exactInt(Number(s.totalXP), 0, 1000000000)) return null;
        s.totalXP = Number(s.totalXP);
        return s;
      } catch (e) { return null; }
    }
    var XP_PROOFS = 'hansenRewardXpProofsV942';
    function validXPProof(proof, p) {
      return proof && typeof proof === 'object' && !Array.isArray(proof) &&
        proof.amount === p.amount && proof.targetIsland === p.targetIsland && proof.targetGlobal === p.targetGlobal;
    }
    function patchIslandRaw(raw, p, backup) {
      var s = parseIsland(raw), proofs, proof;
      if (!s) return null;
      if (own(s, XP_PROOFS)) {
        proofs = s[XP_PROOFS];
        if (!proofs || typeof proofs !== 'object' || Array.isArray(proofs)) return null;
      } else proofs = {};
      proof = own(proofs, p.id) ? proofs[p.id] : null;
      if (proof) {
        if (!validXPProof(proof, p) || s.totalXP < p.targetIsland) return null;
      } else {
        /* 主档必须精确等于 before；安全快照允许更旧，但绝不猜测一个更大的未知状态。 */
        if ((!backup && s.totalXP !== p.beforeIsland) || (backup && s.totalXP > p.beforeIsland)) return null;
        s.totalXP = p.targetIsland;
        var clean = {}; Object.keys(proofs).forEach(function (id) { if (validId(id)) clean[id] = proofs[id]; });
        clean[p.id] = {amount:p.amount, targetIsland:p.targetIsland, targetGlobal:p.targetGlobal, at:p.createdAt};
        s[XP_PROOFS] = clean;
      }
      var cx = Number(s.charXP);
      s.charXP = Math.max(isFinite(cx) && cx >= 0 ? Math.floor(cx) : 0, p.targetGlobal);
      try { return JSON.stringify(s); } catch (e) { return null; }
    }
    function applyOriginXP(p) {
      var mainRaw, bakRaw;
      try { mainRaw = localStorage.getItem(p.originKey); bakRaw = localStorage.getItem(p.originKey + '_bak'); }
      catch (e) { return false; }
      if (mainRaw === null || !parseIsland(mainRaw)) return false;
      var nextMain = patchIslandRaw(mainRaw, p, false); if (nextMain === null) return false;
      var nextBak = bakRaw === null ? nextMain : patchIslandRaw(bakRaw, p, true); if (nextBak === null) return false;
      try {
        if (nextMain !== mainRaw) localStorage.setItem(p.originKey, nextMain);
        if (localStorage.getItem(p.originKey) !== nextMain) return false;
        if (nextBak !== bakRaw) localStorage.setItem(p.originKey + '_bak', nextBak);
        if (localStorage.getItem(p.originKey + '_bak') !== nextBak) return false;
      } catch (e2) { return false; }
      if (currentOriginKey() === p.originKey && window.S) {
        var oldLevel = Math.max(1, Math.floor(Number(window.S.level) || 1));
        window.S.totalXP = p.targetIsland; window.S.charXP = p.targetGlobal;
        try {
          if (typeof window.getAdvLevel === 'function') window.S.level = window.getAdvLevel().lv;
          if (typeof window.getXpInCurrentLevel === 'function') window.S.xp = window.getXpInCurrentLevel();
          else window.S.xp = Math.max(0, Number(window.S.xp) || 0) + p.amount;
          if (window.S.level > oldLevel && typeof window.showLevelUpBanner === 'function') window.showLevelUpBanner(window.S.level);
          if (typeof window.updateTopBar === 'function') window.updateTopBar();
          if (typeof window.checkAllAlmost === 'function') window.checkAllAlmost();
        } catch (e3) {}
      }
      return true;
    }
    function clearOriginProof(p) {
      var keys = [p.originKey, p.originKey + '_bak'];
      for (var i = 0; i < keys.length; i++) {
        try {
          var raw = localStorage.getItem(keys[i]), s = parseIsland(raw);
          if (!s) return false;
          var proofs = s[XP_PROOFS];
          if (!proofs || typeof proofs !== 'object' || Array.isArray(proofs) || !own(proofs, p.id)) continue;
          var clean = {}; Object.keys(proofs).forEach(function (id) { if (id !== p.id && validId(id)) clean[id] = proofs[id]; });
          if (Object.keys(clean).length) s[XP_PROOFS] = clean; else delete s[XP_PROOFS];
          var next = JSON.stringify(s); localStorage.setItem(keys[i], next); if (localStorage.getItem(keys[i]) !== next) return false;
        } catch (e) { return false; }
      }
      return true;
    }
    function validModernXPPending(p) {
      return p && !p.invalid && p.version === 942 && validId(p.id) && validOriginKey(p.originKey) &&
        exactInt(p.amount, 1, 100000) && exactInt(p.beforeIsland, 0, 1000000000) &&
        exactInt(p.targetIsland, 1, 1000000000) && p.targetIsland === p.beforeIsland + p.amount &&
        exactInt(p.beforeGlobal, 0, 1000000000) && exactInt(p.targetGlobal, 1, 1000000000) &&
        p.targetGlobal === p.beforeGlobal + p.amount && exactInt(p.createdAt, 1, Number.MAX_SAFE_INTEGER);
    }
    function recoverLegacyXP(p, ledger) {
      if (!p || !validId(p.id) || !exactInt(Number(p.amount), 1, 100000) ||
          !exactInt(Number(p.before), 0, 1000000000)) return false;
      if (own(ledger, p.id)) return removeVerified(XP_PENDING);
      var cur = currentTotalXP();
      if (cur <= Number(p.before) || !saveCurrentIsland()) return false;
      ledger[p.id] = {amount:Number(p.amount), actual:cur - Number(p.before), at:exactInt(Number(p.createdAt),1,Number.MAX_SAFE_INTEGER)?Number(p.createdAt):Date.now()};
      if (!writeJson(XP_LEDGER, ledger)) return false;
      return removeVerified(XP_PENDING);
    }
    function recoverXP() {
      var p = pendingObject(XP_PENDING), ledger = ledgerMap(XP_LEDGER, 'xp');
      if (!ledger) { notice('任务经验奖励账本已损坏；已停止发奖且保留原始数据', new Error('invalid xp ledger')); return false; }
      if (!p) return true;
      if (!currentOriginKey()) return recoverLegacyXP(p, ledger); /* 仅供旧缓存页/独立测试；正式岛页必须走来源绑定。 */
      if (!validModernXPPending(p)) {
        notice('任务经验恢复凭据缺少可信来源岛；已停止恢复且保留原始数据', new Error('invalid xp pending origin'));
        return false;
      }
      if (own(ledger, p.id)) {
        if (!clearOriginProof(p)) return false;
        return removeVerified(XP_PENDING);
      }
      var globalNow = readGlobalXP();
      if (globalNow === null || globalNow < p.beforeGlobal || (globalNow > p.beforeGlobal && globalNow < p.targetGlobal)) return false;
      if (globalNow === p.beforeGlobal && !rawSet('hansen_wallet_charxp', String(p.targetGlobal))) return false;
      if (!applyOriginXP(p)) return false;
      ledger[p.id] = {amount:p.amount, originKey:p.originKey, targetIsland:p.targetIsland, targetGlobal:p.targetGlobal, at:p.createdAt};
      if (!writeJson(XP_LEDGER, ledger)) return false;
      if (!clearOriginProof(p)) return false;
      return removeVerified(XP_PENDING);
    }
    function xpAward(id, amount) {
      id = String(id || ''); amount = Math.floor(Number(amount) || 0);
      if (!validId(id) || amount <= 0 || amount > 100000) return false;
      var ledger = ledgerMap(XP_LEDGER, 'xp');
      if (!ledger) { notice('任务经验奖励账本已损坏；本次不会重发', new Error('invalid xp ledger')); return false; }
      if (own(ledger, id)) return true;
      var pending = pendingObject(XP_PENDING), origin = currentOriginKey();
      if (pending) {
        if (!recoverXP()) {
          /* 只有没有公开 saveKey 的旧缓存页，才可在“尚未执行”的精确 before 上重试。
             正式页的来源绑定事务由 recoverXP 自己续做，绝不在当前页重放 addXP。 */
          if (origin || pending.invalid || pending.id !== id || currentTotalXP() !== Number(pending.before)) return false;
        } else {
          ledger = ledgerMap(XP_LEDGER, 'xp'); if (!ledger) return false; if (own(ledger, id)) return true;
        }
      }
      if (origin) {
        if (!saveCurrentIsland()) return false;
        var mainRaw; try { mainRaw = localStorage.getItem(origin); } catch (e) { return false; }
        var state = parseIsland(mainRaw), globalBefore = readGlobalXP();
        if (!state || globalBefore === null || state.totalXP > 1000000000 - amount || globalBefore > 1000000000 - amount) return false;
        var modern = {version:942,id:id,amount:amount,originKey:origin,beforeIsland:state.totalXP,
          targetIsland:state.totalXP+amount,beforeGlobal:globalBefore,targetGlobal:globalBefore+amount,createdAt:Date.now()};
        if (!writeJson(XP_PENDING, modern)) return false;
        if (!recoverXP()) { notice('任务经验奖励正在恢复，请再次点击领取', new Error('xp origin transaction pending')); return false; }
        return true;
      }
      /* 旧缓存页没有公开存档键时保持原协议；发布页不会进入此分支。 */
      var before = currentTotalXP();
      var p = {id:id, amount:amount, before:before, createdAt:Date.now()};
      if (!writeJson(XP_PENDING, p)) return false;
      try {
        if (typeof window.addXP !== 'function') throw new Error('addXP unavailable');
        window.addXP(amount);
      } catch (e) {
        removeVerified(XP_PENDING); notice('任务经验奖励未能执行，本任务仍可重试', e); return false;
      }
      if (currentTotalXP() <= before || !saveCurrentIsland()) {
        notice('任务经验奖励尚未持久化，本任务不会提前标记已领', new Error('xp save failed'));
        return false;
      }
      if (!recoverXP()) { notice('任务经验奖励正在恢复，请再次点击领取', new Error('xp ledger pending')); return false; }
      return true;
    }
    window.HansenRewardEffectsV942 = {boostAward:boostAward, xpAward:xpAward, recoverBoost:recoverBoost, recoverXP:recoverXP};
    return window.HansenRewardEffectsV942;
  }

  function readTx() {
    var tx = readJson(TX_KEY, null);
    if (!tx || tx.version !== VERSION || typeof tx.day !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(tx.day) ||
        typeof tx.id !== 'string' || !BY_ID[tx.id]) return null;
    return {version:VERSION, day:tx.day, id:tx.id};
  }
  function writeTx(tx) { return writeJson(TX_KEY, tx); }
  function awardCoin(id, n) {
    try { return !!(window.HansenCoins && typeof window.HansenCoins.award === 'function' && window.HansenCoins.award(id, n)); }
    catch (e) { return false; }
  }
  function settleTx(tx) {
    var raw = readRaw(), s = sanitizeState(raw, tx.day);
    if (!s) { removeVerified(TX_KEY); return false; }
    var q = null;
    for (var i = 0; i < s.list.length; i++) if (s.list[i].id === tx.id) { q = s.list[i]; break; }
    if (!q) { removeVerified(TX_KEY); return false; }
    if (q.claimed) { removeVerified(TX_KEY); mirror(s); return true; }
    if (q.progress < q.goal) { removeVerified(TX_KEY); return false; }

    var base = 'quest:' + tx.day + ':' + q.id;
    var allNow = s.allDay !== s.day && s.list.every(function (item) { return item.claimed || item.id === q.id; });
    if (!awardCoin(base + ':coins', questCoins(q))) return false;
    if (!effects().xpAward(base + ':xp', +q.reward.xp || 0)) return false;
    if (allNow) {
      var bonus = 100 + Math.min(streak(), 7) * 20;
      if (!awardCoin('quest:' + tx.day + ':all:coins', bonus)) return false;
      if (!effects().boostAward('quest:' + tx.day + ':all:boost', 90)) return false;
    }

    /* 奖励全部由幂等账本确认后，才把任务标记为已领。 */
    var latest = sanitizeState(readRaw(), tx.day);
    if (!latest) return false;
    for (var j = 0; j < latest.list.length; j++) if (latest.list[j].id === q.id) latest.list[j].claimed = true;
    if (allNow && latest.list.every(function (item) { return item.claimed; })) latest.allDay = latest.day;
    if (!persist(latest)) return false;
    removeVerified(TX_KEY);

    try { if (typeof window.showToast === 'function') window.showToast('🎉 任务完成！ +' + questCoins(q) + '🪙 +' + q.reward.xp + ' XP'); } catch (e) {}
    try { if (typeof window.playOpenChest === 'function') window.playOpenChest(); } catch (e2) {}
    if (allNow) {
      var allBonus = 100 + Math.min(streak(), 7) * 20;
      setTimeout(function () {
        try { if (typeof window.showToast === 'function') window.showToast('🏆 今日任务全部完成！+' + allBonus + '🪙 + ⚡ 记忆强化90分'); } catch (e3) {}
        try { if (typeof window.bigConfetti === 'function') window.bigConfetti(); } catch (e4) {}
      }, 800);
    }
    try { if (typeof window.renderQuests === 'function') window.renderQuests(); } catch (e5) {}
    return true;
  }
  function recoverPending() { var tx = readTx(); return !tx || settleTx(tx); }

  /* 仅为旧独立测试/旧缓存页兼容；v942 正式页始终有 HansenCoins.award。 */
  function legacyClaim(s, q) {
    q.claimed = true;
    var allNow = s.list.every(function (item) { return item.claimed; }) && s.allDay !== s.day;
    if (allNow) s.allDay = s.day;
    if (!persist(s)) return false;
    var coins = questCoins(q);
    try { if (typeof window.addCoin === 'function') window.addCoin(coins); } catch (e) {}
    try { if (typeof window.addXP === 'function') window.addXP(+q.reward.xp || 0); } catch (e2) {}
    if (allNow) {
      var bonus = 100 + Math.min(streak(), 7) * 20;
      try { if (typeof window.addCoin === 'function') window.addCoin(bonus); } catch (e3) {}
      try { if (window.HansenCrystal && typeof window.HansenCrystal.grantBoost === 'function') window.HansenCrystal.grantBoost(90, true); } catch (e4) {}
    }
    return true;
  }
  function claim(index) {
    if (!recoverPending()) return false;
    var s = ensure(); index = Math.floor(+index); var q = s.list[index];
    if (!q || q.claimed || q.progress < q.goal) return false;
    if (!(window.HansenCoins && typeof window.HansenCoins.award === 'function')) return legacyClaim(s, q);
    var tx = {version:VERSION, day:s.day, id:q.id};
    if (!writeTx(tx)) { notice('任务领取事务未能建立，本任务仍保持未领取', new Error('quest tx write failed')); return false; }
    return settleTx(tx);
  }

  var oldRender = typeof window.renderQuests === 'function' ? window.renderQuests : null;
  var oldBadge = typeof window.updateQuestBadge === 'function' ? window.updateQuestBadge : null;
  window.rollDailyQuests = function () { return ensure(); };
  window.progressQuest = function (type, amount) { return progress(type, amount, false); };
  window.setQuest = function (type, value) { return progress(type, value, true); };
  window.claimQuest = claim;
  if (oldBadge) window.updateQuestBadge = function () { ensure(); return oldBadge.apply(this, arguments); };
  if (oldRender) window.renderQuests = function () { ensure(); return oldRender.apply(this, arguments); };

  window.HansenQuestGlobal = {
    ensure:ensure,
    progress:function (type, amount) { return progress(type, amount, false); },
    set:function (type, value) { return progress(type, value, true); },
    claim:claim,
    recover:recoverPending,
    status:function () { return clone(ensure()); },
    key:KEY,
    _test:{makeDay:makeDay, validState:validState, sanitizeState:sanitizeState, questCoins:questCoins, today:today, txKey:TX_KEY}
  };

  /* 页面可能在 A 岛写完全局人物 XP 后硬崩，并从 B 岛重新打开。
     必须在任何新领取前按 pending.originKey 把岛内 XP 归还 A 岛，而不是落到当前 B 岛。 */
  try { effects().recoverBoost(); effects().recoverXP(); } catch (e) {}
  /* 先恢复昨夜/刷新中断的领取，再滚动到今天，避免跨午夜丢奖。 */
  try { recoverPending(); } catch (e) {}
  ensure();
  refresh();
})();
