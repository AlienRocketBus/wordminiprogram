/* ============================================================
 * hansen_review_rewards_v963.js — 「错词猎人」复习奖励系统 (v963)
 * ============================================================
 * 设计原则（用户 2026-07-21 确认）：
 *   1. 奖励只挂"真实答题证据"（markAnswer 中错词真实变化），自评"记住了"零奖励。
 *   2. 毕业金采用"隔天规则"防刷：错词建档日 < 今天才发 +15；
 *      当天造的错词当天清零只有纠错 +2（与普通答题同价，刷无可刷）。
 *   3. 全部发放走 HansenCoins.award / HansenGems.award 幂等收据，
 *      刷新、断网、双击都不会重复发；失败自动回滚可重试。
 *   4. 不新建钱包、不新造题目、不改 markAnswer 原语义（纯包装观察）。
 *
 * 🔴 迭代3（用户批准"按最优方式做到完美"）：
 *   - 试点门禁移除：27 岛全量生效（横幅显示全局到期数，奖励闭环必须全岛一致）。
 *   - 新增首页"今日复习"触发横幅：daily-row 三卡下方整宽注入，不触碰 v954 三卡视觉基线。
 *   - 到期数按 canonical 全局汇总（HansenCanonical.read()）：Land/Season 同词不重复计数。
 *   - 连击"免作业日"自动保护改用全局到期==0 判定。
 *
 * 收据格式（不变）：
 *   rvrw:<日期>:<canonical槽>:c<1-3>   纠错 +2 金币（每词每天3次）
 *   rvrw:<日期>:<canonical槽>:grad     毕业 +15 金币（隔天规则）
 *   rvrw:<日期>:clearall               当日清空错题本 +30（需≥3词毕业）
 *   rvrw:<日期>:todaydone              完成今日复习 +20
 *   rvrw:streak:<起始日>:m<N>          连击里程碑金币
 *   rvrwg:streak:<起始日>:m<N>         连击里程碑钻石
 * 存储键（v963，仅本模块读写）：
 *   hansen_review_wrong_since_v963 / hansen_review_streak_v963 / hansen_review_day_v963
 * ============================================================ */
(function(){
  'use strict';

  var K_SINCE  = 'hansen_review_wrong_since_v963';
  var K_STREAK = 'hansen_review_streak_v963';
  var K_DAY    = 'hansen_review_day_v963';
  var SINCE_MAX = 600;

  /* ---------- 小工具 ---------- */
  function ymd(d){
    d = d || new Date();
    var m = d.getMonth()+1, dd = d.getDate();
    return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;
  }
  function yesterdayYmd(){ var d=new Date(); d.setDate(d.getDate()-1); return ymd(d); }
  /* 统一日期比较：兼容补零(2026-07-05)与不补零(2026-7-5)两种历史格式 */
  function dayNum(s){
    var m=String(s||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? (+m[1]*10000 + +m[2]*100 + +m[3]) : 0;
  }
  function readJson(key){
    try{
      var raw = localStorage.getItem(key);
      if(raw === null) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null;
    }catch(e){ return null; }
  }
  function writeJson(key, obj){
    try{
      var raw = JSON.stringify(obj);
      localStorage.setItem(key, raw);
      return localStorage.getItem(key) === raw;
    }catch(e){ return false; }
  }
  function slotOf(idx){
    try{
      if(typeof window.__hsnReviewSlot === 'function'){
        var s = window.__hsnReviewSlot(idx);
        if(s) return String(s);
      }
    }catch(e){}
    return String(window.__hsnSaveKey||'island') + ':' + idx;
  }
  function safeWrong(v){
    try{
      if(typeof window.__hsnSafeWrongCount === 'function') return window.__hsnSafeWrongCount(v);
    }catch(e){}
    v = Number(v); return (isFinite(v) && v > 0) ? Math.floor(v) : 0;
  }
  function coins(){ return (window.HansenCoins && typeof HansenCoins.award === 'function') ? HansenCoins : null; }
  function gems(){ return (window.HansenGems && typeof HansenGems.award === 'function') ? HansenGems : null; }

  function payCoinOnce(id, amount){
    var w = coins(); if(!w) return false;
    try{
      if(typeof w.hasAward === 'function' && w.hasAward(id)) return false;
      return w.award(id, amount) === true && (typeof w.hasAward !== 'function' || w.hasAward(id));
    }catch(e){ return false; }
  }
  function payGemOnce(id, amount){
    var g = gems(); if(!g) return false;
    try{
      if(typeof g.hasAward === 'function' && g.hasAward(id)) return false;
      return g.award(id, amount) === true;
    }catch(e){ return false; }
  }

  /* ---------- 当日统计（状态卡/横幅展示 + 🔴刺三全局清零追踪） ---------- */
  function dayState(){
    var t = ymd(), s = readJson(K_DAY);
    if(!s || s.day !== t) s = { day:t, grads:0, coins:0, hadDue:0, cleared:0 };
    if(typeof s.grads !== 'number' || s.grads < 0) s.grads = 0;
    if(typeof s.coins !== 'number' || s.coins < 0) s.coins = 0;
    if(s.hadDue !== 1) s.hadDue = 0;
    if(s.cleared !== 1) s.cleared = 0;
    return s;
  }
  /* 🔴刺三口径统一：连击打卡 = +20到账 = 横幅变绿 = "全局到期清零"同一时刻。
   * 今天出现过到期(hadDue) 且 全局归零 且 今天未清 → 发+20、打卡连击、庆祝一次。
   * 全天本就无到期 → autoMaintain 静默保连击(不发+20)。 */
  function checkGlobalClear(info){
    try{
      info = info || globalDueInfo();
      if(!info.ok) return false;
      var s = dayState();
      if(info.globalDue > 0){
        if(!s.hadDue){ s.hadDue = 1; writeJson(K_DAY, s); }
        return false;
      }
      if(!s.hadDue || s.cleared) return false;
      s.cleared = 1; writeJson(K_DAY, s);
      if(payCoinOnce('rvrw:'+ymd()+':todaydone', 20)) bumpDay(0, 20);
      tickStreak();
      toast('✅ 全部到期清零！<b>+20 金币</b> · 连击已保住 🔥');
      return true;
    }catch(e){ return false; }
  }
  function bumpDay(grads, coinAmt){
    var s = dayState();
    s.grads += (grads|0); s.coins += (coinAmt|0);
    writeJson(K_DAY, s);
    return s;
  }

  /* ---------- 🔴刺五：错词猎人身份系统 ----------
   * 数字奖励留不住人,身份留得住。终身战绩(毕业数/巡检通过数)驱动称号阶梯,
   * 纯荣誉零金币(无刷面);跨级时庆祝一次(终身收据式防重)。 */
  var K_LIFE = 'hansen_review_lifetime_v963';
  var HUNTER_TIERS = [
    { n: 10,  t: '见习猎人 🐣' },
    { n: 50,  t: '正式猎人 🗡️' },
    { n: 150, t: '资深猎人 ⚔️' },
    { n: 400, t: '传说猎人 🏆' },
    { n: 952, t: '错词歼灭者 👑' }
  ];
  function lifeState(){
    var s = readJson(K_LIFE);
    if(!s || typeof s !== 'object') s = {};
    if(typeof s.grads !== 'number' || s.grads < 0) s.grads = 0;
    if(typeof s.patrols !== 'number' || s.patrols < 0) s.patrols = 0;
    if(typeof s.tier !== 'number' || s.tier < 0) s.tier = 0;
    return s;
  }
  function hunterTitle(grads){
    var t = '新手猎人 🌱', next = HUNTER_TIERS[0].n;
    for(var i = 0; i < HUNTER_TIERS.length; i++){
      if(grads >= HUNTER_TIERS[i].n){ t = HUNTER_TIERS[i].t; next = (HUNTER_TIERS[i+1] ? HUNTER_TIERS[i+1].n : null); }
    }
    return { title: t, next: next };
  }
  function bumpLife(field){
    try{
      var s = lifeState();
      s[field] = (s[field]|0) + 1;
      var reached = 0;
      for(var i = 0; i < HUNTER_TIERS.length; i++){ if(s.grads >= HUNTER_TIERS[i].n) reached = i + 1; }
      var promoted = reached > s.tier;
      if(promoted) s.tier = reached;
      writeJson(K_LIFE, s);
      if(promoted){
        toast('🏅 称号晋升：<b>'+HUNTER_TIERS[reached-1].t+'</b> · 终身歼灭 '+s.grads+' 词');
      }
      return s;
    }catch(e){ return lifeState(); }
  }

  /* ---------- 🔴刺二：幽灵巡检（长程防遗忘） ----------
   * 毕业不是永别：毕业后 +30 天进入第一道巡检窗，通过后 +90 天第二道，两关全过即长期信任。
   * 验证零新题型：任何现有玩法里"偶遇"该词——答对=巡检通过(+3金币回访礼)，
   * 答错=错词机制自然接管(温柔归队重学)，巡检档案即销。
   * 巡检"到窗"不设截止、不计入清零/连击口径(不制造焦虑)；横幅与复习中心仅做告知。
   * 存储：hansen_review_patrol_v963 = { slot: {due:'Y-M-D', stage:1|2} } */
  var K_PATROL = 'hansen_review_patrol_v963';
  var PATROL_GAPS = { 1: 30, 2: 90 };
  var PATROL_MAX = 400;
  function addDaysYmd(n){ var d = new Date(); d.setDate(d.getDate() + (n|0)); return ymd(d); }
  function patrolMap(){ var m = readJson(K_PATROL); return m || {}; }
  function schedulePatrol(slot, stage){
    try{
      stage = (stage === 2) ? 2 : 1;
      var m = patrolMap();
      m[slot] = { due: addDaysYmd(PATROL_GAPS[stage]), stage: stage };
      var keys = Object.keys(m);
      if(keys.length > PATROL_MAX){
        keys.sort(function(x,y){ return dayNum(m[x] && m[x].due) - dayNum(m[y] && m[y].due); });
        for(var i=0; i<keys.length-PATROL_MAX; i++) delete m[keys[i]];
      }
      writeJson(K_PATROL, m);
    }catch(e){}
  }
  function dropPatrol(slot){
    var m = patrolMap();
    if(Object.prototype.hasOwnProperty.call(m, slot)){ delete m[slot]; writeJson(K_PATROL, m); }
  }
  function patrolEntryDue(rec){
    return !!(rec && typeof rec === 'object' && dayNum(rec.due) > 0 && dayNum(rec.due) <= dayNum(ymd()));
  }
  /* 玩法偶遇巡检词：答对=通过(升段或结业+3金币)；答错=归队(错词机制已自然接管,销档+温柔提示) */
  function patrolOnAnswer(slot, correct, wordEn){
    try{
      var m = patrolMap(), rec = m[slot];
      if(!rec || typeof rec !== 'object') return;
      if(!patrolEntryDue(rec)) return;                 // 未到窗：不动(间隔科学)
      if(correct === true){
        if(payCoinOnce('rvrw:'+ymd()+':'+slot+':patrol', 3)){ bumpDay(0, 3); bumpLife('patrols'); }
        if((rec.stage|0) >= 2){
          dropPatrol(slot);
          floatCoin('👻 巡检全通过 · 记忆封存 🏅 +3');
        }else{
          schedulePatrol(slot, 2);
          floatCoin('👻 30天巡检通过 +3 · 90天后再会');
        }
      }else{
        dropPatrol(slot);
        toast('👻 「'+(wordEn||'这个词')+'」有点模糊了 · 已温柔归队重新复习');
      }
      refreshUI();
    }catch(e){}
  }
  function patrolDueList(){
    var m = patrolMap(), out = [];
    Object.keys(m).forEach(function(slot){ if(patrolEntryDue(m[slot])) out.push({ slot: slot, stage: (m[slot].stage|0)||1 }); });
    return out;
  }
  /* 巡检词的本岛可读名：slot='岛id:canonical序' → 当前岛可反解出 en，其它岛计数 */
  function patrolLocalName(slot){
    try{
      var HC = window.HansenCanonical;
      if(!HC || typeof HC.fromCanonicalIndex !== 'function') return null;
      var p = String(slot).split(':');
      if(p.length !== 2) return null;
      var ref = (typeof HC.currentRef === 'function') ? HC.currentRef() : '';
      var a = (typeof HC.resolve === 'function') ? HC.resolve(ref) : null;
      if(!a || a.id !== p[0]) return null;
      var li = HC.fromCanonicalIndex(ref, Number(p[1]));
      if(!(li >= 0) || !window.allW || !allW[li]) return null;
      return String(allW[li].en || '');
    }catch(e){ return null; }
  }

  /* ---------- UI 反馈 ----------
   * 🔴飘字密度打磨：一次答对可能连发多条(+2/毕业/盒子/巡检)。同一爆发窗(1.2s)内
   * 逐条向下级联错位显示(245/293/341px,最多3档后并档)，金币音效每爆发只响一次——
   * 奖励瀑布可读又不吵。纯同步时间戳判断,零定时器,行为可测。 */
  var _fcLastAt = 0, _fcBurst = 0;
  function floatCoin(text){
    try{
      var now = Date.now();
      if(now - _fcLastAt > 1200) _fcBurst = 0;
      var slot = Math.min(_fcBurst, 2);
      var first = (_fcBurst === 0);
      _fcBurst++; _fcLastAt = now;
      if(typeof window.floatText === 'function')
        floatText(window.innerWidth/2, 245 + slot*48, text, '#fbbf24');
      if(first){ try{ if(typeof window.playCoin === 'function') playCoin(); }catch(e2){} }
    }catch(e){}
  }
  function toast(msg){
    try{
      if(typeof window.showComboToast === 'function'){ showComboToast(msg, 'pet-evolve', 2600); return; }
    }catch(e){}
    try{ if(typeof window.showToast === 'function') showToast(msg); }catch(e){}
  }

  /* ---------- 错词建档日（隔天毕业规则核心） ---------- */
  function sinceMap(){ var m = readJson(K_SINCE); return m || {}; }
  function stampSince(slot){
    var m = sinceMap();
    m[slot] = ymd();
    var keys = Object.keys(m);
    if(keys.length > SINCE_MAX){
      keys.sort(function(a,b){ return String(m[a]).localeCompare(String(m[b])); });
      for(var i=0; i<keys.length-SINCE_MAX; i++) delete m[keys[i]];
    }
    writeJson(K_SINCE, m);
  }
  function clearSince(slot){
    var m = sinceMap();
    if(Object.prototype.hasOwnProperty.call(m, slot)){ delete m[slot]; writeJson(K_SINCE, m); }
  }
  function gradEligible(slot){
    var m = sinceMap(), rec = m[slot];
    if(typeof rec !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(rec)) return true;
    return dayNum(rec) < dayNum(ymd());
  }

  function islandWrongsEmpty(){
    try{
      var w = window.S && S.wrongs;
      if(!w || typeof w !== 'object') return true;
      for(var k in w){ if(safeWrong(w[k]) > 0) return false; }
      return true;
    }catch(e){ return false; }
  }

  /* ---------- 🔴迭代3：canonical 全局/本岛到期统计 ----------
   * 规则与今日复习一致：有错词 且 (尚无SRS计划 → 视为今天到期 / 有计划 → box<5 且 due<=今天)。
   * Land/Season 别名共用 canonical 槽位，天然不重复计数。 */
  function globalDueInfo(){
    /* 🔴v969真机修复：canonical 真实形态为 {islands:{岛id:{wrongs,srs}}} 嵌套结构。
     * 到期定义 = 有错词 且 (未建档 或 盒期已到)——新答错立即计入,横幅马上喊人。 */
    var out = { ok:false, globalDue:0, localDue:0, islandsWithDue:0, patrolDue:0 };
    try{
      var HC = window.HansenCanonical;
      if(!HC || typeof HC.read !== 'function') return out;
      var st = HC.read();
      var islands = (st && st.islands && typeof st.islands === 'object') ? st.islands : {};
      var today = dayNum(ymd());
      var curId = '';
      try{
        var ref = (typeof HC.currentRef === 'function') ? HC.currentRef() : '';
        var a0 = (typeof HC.resolve === 'function') ? HC.resolve(ref) : null;
        if(a0 && a0.id) curId = a0.id;
      }catch(eC){}
      Object.keys(islands).forEach(function(iid){
        var isle = islands[iid] || {};
        var wr = isle.wrongs || {}, sr = isle.srs || {};
        var due = 0;
        Object.keys(wr).forEach(function(k){
          var wc = Number(wr[k]);
          if(!(wc > 0)) return;
          var e = sr[k];
          if(!e || typeof e !== 'object'){ due++; return; }        // 新错未建档=到期
          if((e.box|0) >= 5) return;
          if(dayNum(e.due) <= today) due++;
        });
        if(due > 0){
          out.globalDue += due;
          out.islandsWithDue++;
          if(iid === curId) out.localDue = due;
        }
      });
      out.ok = true;
    }catch(e){}
    try{ out.patrolDue = patrolDueList().length; }catch(e2){ out.patrolDue = 0; }
    return out;
  }

  function payGraduation(slot){
    if(!gradEligible(slot)){ clearSince(slot); return false; }
    var gid = 'rvrw:'+ymd()+':'+slot+':grad';
    if(!payCoinOnce(gid, 15)){ clearSince(slot); return false; }
    var st = bumpDay(1, 15);
    /* 🔴刺四：旧词重逢——建档≥30天的老大难被歼灭 → 追加+15(毕业金×2)。
     * 难度定价而非运气定价(不碰赌博红线);30天龄无法人为速成,零刷面。
     * 历史无建档的老错词(豁免毕业者)不追加:只奖有据可查的坚持。 */
    var _since = sinceMap()[slot], _old = false;
    if(typeof _since === 'string' && dayNum(_since) > 0 && (dayNum(ymd()) - 0) >= 0){
      var _d = new Date(); _d.setDate(_d.getDate() - 30);
      _old = dayNum(_since) <= dayNum(ymd(_d));
    }
    if(_old && payCoinOnce('rvrw:'+ymd()+':'+slot+':oldgrad', 15)){
      bumpDay(0, 15);
      floatCoin('🏆 旧词重逢 · 30天老大难歼灭 · 毕业金×2!');
    }else{
      floatCoin('+15 毕业金 🎓');
    }
    bumpLife('grads');
    schedulePatrol(slot, 1);
    if(st.grads >= 3 && islandWrongsEmpty()){
      if(payCoinOnce('rvrw:'+ymd()+':clearall', 30)){
        bumpDay(0, 30);
        toast('🏆 今日错题全部清空！<b>+30 金币</b>');
      }
    }
    clearSince(slot);
    return true;
  }
  function onWrongDecreased(idx, slot, nowZero){
    var day = ymd(), paidAny = 0;
    for(var ord = 1; ord <= 3; ord++){
      var cid = 'rvrw:'+day+':'+slot+':c'+ord;
      var w = coins();
      if(w && typeof w.hasAward === 'function' && w.hasAward(cid)) continue;
      if(payCoinOnce(cid, 2)){ paidAny = 2; floatCoin('+2 复习金币 💰'); }
      break;
    }
    if(paidAny) bumpDay(0, paidAny);
    if(nowZero) payGraduation(slot);
    refreshUI();
  }

  function installWrapper(){
    if(typeof window.markAnswer !== 'function') return false;
    if(window.markAnswer.__rvrwWrapped) return true;
    var orig = window.markAnswer;
    function wrapped(idx, correct){
      var w0 = 0;
      try{ w0 = safeWrong(window.S && S.wrongs ? S.wrongs[idx] : 0); }catch(e){}
      var r = orig.apply(this, arguments);
      try{
        var w1 = safeWrong(window.S && S.wrongs ? S.wrongs[idx] : 0);
        if(w1 > w0 && w0 === 0) stampSince(slotOf(idx));
        else if(w1 < w0) onWrongDecreased(idx, slotOf(idx), w1 === 0);
      }catch(e){}
      /* 🔴刺二：巡检偶遇检测(在纠错/吸收之前后皆安全,账本独立) */
      try{
        var _pw = (window.allW && allW[idx] && allW[idx].en) ? String(allW[idx].en) : '';
        patrolOnAnswer(slotOf(idx), correct === true, _pw);
      }catch(e){}
      /* 🔴刺一：真实答题喂给 SRS 吸收器(复习模块拥有语义)。到期答对→盒子前进；
       * 升满5盒→毕业(吸收器已删SRS+错词并走canonical链路)，此处补发毕业金并反馈。 */
      try{
        var HR = window.HansenReview;
        if(HR && typeof HR.absorbRealAnswer === 'function'){
          var ab = HR.absorbRealAnswer(idx, correct === true);
          if(ab && ab.advanced){
            if(ab.graduated){
              floatCoin('🎓 复习毕业！');
              if(ab.hadWrong) payGraduation(slotOf(idx));
              else schedulePatrol(slotOf(idx), 1);   /* 🔴刺二：纯SRS收尾毕业同样入巡检 */
              refreshUI();
            }else{
              floatCoin('📦 记忆盒 +1 · '+(ab.gapDays||'?')+'天后再见');
              refreshUI();
            }
          }
        }
      }catch(e){}
      return r;
    }
    wrapped.__rvrwWrapped = true;
    window.markAnswer = wrapped;
    return true;
  }

  /* ---------- 连续复习 Streak ---------- */
  var MILESTONES = { 3:{c:20,g:0}, 7:{c:50,g:5}, 14:{c:100,g:10}, 30:{c:200,g:20} };
  function streak(){
    var s = readJson(K_STREAK);
    if(!s || typeof s.count !== 'number' || s.count < 0) s = { start:'', last:'', count:0 };
    return s;
  }
  function milestoneFor(count){
    if(MILESTONES[count]) return MILESTONES[count];
    if(count > 30 && count % 30 === 0) return { c:200, g:20 };
    return null;
  }
  function tickStreak(){
    var t = ymd(), y = yesterdayYmd(), s = streak();
    if(s.last === t) return s;
    if(s.last === y && s.start){ s.count += 1; s.last = t; }
    else { s.start = t; s.last = t; s.count = 1; }
    writeJson(K_STREAK, s);
    var m = milestoneFor(s.count);
    if(m){
      var paidC = m.c > 0 && payCoinOnce('rvrw:streak:'+s.start+':m'+s.count, m.c);
      var paidG = m.g > 0 && payGemOnce('rvrwg:streak:'+s.start+':m'+s.count, m.g);
      if(paidC || paidG){
        if(paidC) bumpDay(0, m.c);
        toast('🔥 连续复习 <b>'+s.count+'</b> 天！奖励 '
          + (m.c>0 ? '+'+m.c+' 金币' : '')
          + (m.c>0 && m.g>0 ? ' · ' : '')
          + (m.g>0 ? '+'+m.g+' 💎' : ''));
      }
    }
    return s;
  }
  /* 免作业日自动保护：改用全局到期==0（迭代3） */
  function autoMaintain(){
    try{
      var s = streak();
      if(s.last !== yesterdayYmd()) return;
      var info = globalDueInfo();
      if(info.ok && info.globalDue === 0) tickStreak();
    }catch(e){}
  }

  /* 🔴刺二：毕业统一事件(hansen_review自评毕业分支调用)——毕业金+巡检调度一站式 */
  function onGraduated(idx){
    try{
      var slot = slotOf(idx);
      payGraduation(slot);          /* 内部自带隔天资格+幂等收据+巡检调度 */
      refreshUI();
    }catch(e){}
  }

  /* ---------- 今日复习完成回调（🔴刺三：改走全局口径） ---------- */
  function onTodayComplete(info){
    try{
      info = info || {};
      var g = globalDueInfo();
      if(!checkGlobalClear(g) && g.ok && g.globalDue > 0 && (info.total|0) >= 1){
        toast('👍 本岛清完 · 其它岛还有 <b>'+g.globalDue+'</b> 个到期 → 点首页横幅跨岛清理');
      }
      refreshUI();
    }catch(e){}
  }

  /* ---------- 🔴迭代3：首页"今日复习"触发横幅 ----------
   * 位置：daily-row 三卡正下方整宽注入；不改动 v954 三卡 HTML/几何基线。
   * 状态：本岛有到期 / 仅其它岛有 / 今日已清 / 无到期（安心态）。 */
  var HR_URGENT_TH = 30; /* 🔴v985 紧急态阈值(可调): 全局到期≥此数触发红色警报 */
  function bannerState(info, s){
    var t = ymd();
    if(info.globalDue >= HR_URGENT_TH) return 'urgent';
    if(info.globalDue > 0 && info.localDue > 0) return 'local';
    if(info.globalDue > 0) return 'cross';
    return (s.last === t && s.count > 0) ? 'done' : 'calm';
  }
  function bannerModel(){
    var info = globalDueInfo(), s = streak(), st = bannerState(info, s);
    var fire = s.count > 0 ? ('🔥 '+s.count+' 天') : '';
    if(st === 'urgent'){
      /* 🔴v985 紧急态: 提醒不施压——呆萌拉警报, 口吻鼓励 */
      return { st:st, img:'ui/brain_alarm.webp', icon:'⏰', bg:'linear-gradient(135deg,#ef4444,#b91c1c)',
        title:'积压 '+info.globalDue+' 个词在排队啦',
        sub:'一起冲一把 · '+(info.localDue>0?'点我从本岛开打':'点我去错题总览'), fire:fire };
    }
    if(st === 'local'){
      var extra = info.globalDue - info.localDue;
      return { st:st, img:'ui/brain_mail.webp', icon:'📬', bg:'linear-gradient(135deg,#f59e0b,#d97706)',
        title:'今日复习 · 本岛 '+info.localDue+' 个词到期'+(extra>0?(' · 全部 '+info.globalDue):''),
        sub:'点我开始 · 完成 +20 金币', fire:fire };
    }
    if(st === 'cross'){
      return { st:st, img:'ui/brain_explorer.webp', icon:'🧭', bg:'linear-gradient(135deg,#8b5cf6,#6d28d9)',
        title:'其它岛还有 '+info.globalDue+' 个词到期',
        sub:'点我去错题总览 · 跨岛清完不断签', fire:fire };
    }
    var pd = info.patrolDue|0;
    var pTail = pd > 0 ? (' · 👻巡检 '+pd) : '';
    if(st === 'done'){
      return { st:st, img:'ui/brain_champion.webp', icon:'✅', bg:'linear-gradient(135deg,#10b981,#059669)',
        title:'今日复习已清空',
        sub:'连击保住了 · 明天见'+pTail, fire:fire };
    }
    return { st:'calm', img:'ui/brain_rest.webp', icon:'🧠', bg:'linear-gradient(135deg,#334155,#1e293b)',
      title:'今天没有要复习的单词',
      sub: pd > 0 ? ('👻 '+pd+' 个毕业词到了巡检期 · 玩任意游戏偶遇即测') : '大脑正在悄悄记牢它们', fire:fire };
  }
  function bannerClick(){
    var m = bannerModel();
    try{
      if(m.st === 'urgent'){
        var gi = globalDueInfo();
        if(gi.localDue > 0 && window.HansenReview && typeof HansenReview._openToday === 'function'){ HansenReview._openToday(); return; }
        var UO = window.HansenWrongOverview;
        if(UO){ if(typeof UO.open === 'function'){ UO.open(); return; } if(typeof UO._open === 'function'){ UO._open(); return; } }
      }
      if(m.st === 'local' && window.HansenReview && typeof HansenReview._openToday === 'function'){ HansenReview._openToday(); return; }
      if(m.st === 'cross'){
        var O = window.HansenWrongOverview;
        if(O){ if(typeof O.open === 'function'){ O.open(); return; } if(typeof O._open === 'function'){ O._open(); return; } }
      }
      if(window.HansenReview && typeof HansenReview._open === 'function'){ HansenReview._open(); return; }
    }catch(e){}
  }
  function renderBanner(){
    try{
      if(!document || typeof document.querySelector !== 'function') return;
      var row = document.querySelector('.daily-row');
      if(!row || !row.parentNode) return;
      var el = document.getElementById('hr_review_banner');
      if(!el){
        el = document.createElement('div');
        el.id = 'hr_review_banner';
        el.setAttribute('role','button');
        el.setAttribute('tabindex','0');
        el.style.cssText = 'display:flex;align-items:center;gap:13px;margin:10px 0 4px;padding:7px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.18);cursor:pointer;min-height:74px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.16);transition:transform .15s,box-shadow .2s';
        el.addEventListener('click', bannerClick);
        el.addEventListener('keydown', function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); bannerClick(); } });
        el.addEventListener('touchstart', function(){ el.style.transform='scale(.985)'; }, {passive:true});
        el.addEventListener('touchend', function(){ el.style.transform=''; }, {passive:true});
        row.insertAdjacentElement('afterend', el);
      }
      var m = bannerModel();
      el.style.background = m.bg;
      el.setAttribute('aria-label', m.title+'。'+m.sub);
      /* 🔴v985 大脑五态真图标: img优先, 加载失败回退emoji */
      var iconHtml;
      if(m.img){
        /* \U0001f534v999 (Hansen): \u56fe\u6807\u653e\u5927\u5230\u63a5\u8fd1\u6a2a\u6761\u9ad8\u5ea6 + \u5782\u76f4\u5c45\u4e2d\u7ad9 C \u4f4d
           62px \u65b9\u5f62\u5bb9\u5668 + \u67d4\u5149\u5706\u6258, \u4e0a\u4e0b\u5404\u7559 6px \u547c\u5438\u4f59\u91cf(74-62=12) */
        iconHtml = '<span style="flex:none;width:74px;height:74px;display:flex;align-items:center;justify-content:center;'
          + 'background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.22),rgba(255,255,255,.06) 62%,transparent 72%);'
          + 'border-radius:50%" aria-hidden="true">'
          + '<img src="'+m.img+'?v=1001" alt="" style="width:70px;height:70px;object-fit:contain;display:block;'
          + 'filter:drop-shadow(0 3px 7px rgba(0,0,0,.32))" '
          + 'onerror="var s=document.createElement(\'span\');s.style.cssText=\'font-size:46px;line-height:1\';s.textContent=\''+m.icon+'\';this.replaceWith(s)"></span>';
      } else {
        iconHtml = '<span style="flex:none;width:74px;height:74px;display:flex;align-items:center;justify-content:center;font-size:56px;line-height:1;filter:drop-shadow(0 3px 7px rgba(0,0,0,.32))" aria-hidden="true">'+m.icon+'</span>';
      }
      el.innerHTML =
        iconHtml+
        '<span style="flex:1;min-width:0">'+
          '<span style="display:block;font-size:15.5px;font-weight:800;line-height:1.35;letter-spacing:.2px">'+m.title+'</span>'+
          '<span style="display:block;font-size:12px;opacity:.9;line-height:1.5;margin-top:2px">'+m.sub+'</span>'+
        '</span>'+
        (m.fire ? '<span style="flex:none;font-size:12.5px;font-weight:800;background:rgba(0,0,0,.26);padding:7px 12px;border-radius:999px;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)">'+m.fire+'</span>' : '');
    }catch(e){}
  }

  /* ---------- 复习中心状态卡 ---------- */
  function cardHtml(){
    var s = streak(), d = dayState();
    var fire = s.count > 0 ? ('🔥 连续复习 <b style="color:#fbbf24">'+s.count+'</b> 天')
                           : '🔥 今天开始你的复习连击吧';
    var next = null;
    var order = [3,7,14,30];
    for(var i=0;i<order.length;i++){ if(s.count < order[i]){ next = order[i]; break; } }
    if(next === null) next = (Math.floor(s.count/30)+1)*30;
    var lf = lifeState(), ht = hunterTitle(lf.grads);
    return '<div id="hr_rvrw_card" style="background:linear-gradient(135deg,#78350f22,#92400e18);border:1px solid #f59e0b55;border-radius:14px;padding:12px 14px;margin:2px 0 14px;font-size:13px;color:#e2e8f0;line-height:1.9">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
      +   '<span>🏅 <b style="color:#fbbf24">'+ht.title+'</b> · 终身歼灭 <b style="color:#34d399">'+lf.grads+'</b> 词'
      +     (ht.next !== null ? ' <span style="color:#64748b;font-size:11px">(下一级 '+ht.next+')</span>' : '')
      +     (lf.patrols > 0 ? ' · 巡检 '+lf.patrols : '') + '</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
      +   '<span>'+fire+'</span>'
      +   '<span style="color:#94a3b8;font-size:12px">下个里程碑 '+next+' 天</span>'
      + '</div>'
      + '<div style="color:#94a3b8;font-size:12px">今日复习已赚 <b style="color:#fde047">'+d.coins+'</b> 金币 · 毕业 <b style="color:#34d399">'+d.grads+'</b> 词</div>'
      + '<div style="color:#64748b;font-size:11px">纠错 +2 · 隔天毕业 +15 · 清空错题 +30 · 完成今日复习 +20 · 巡检 +3</div>'
      + patrolCardHtml()
      + '</div>';
  }
  function patrolCardHtml(){
    try{
      var list = patrolDueList();
      if(!list.length) return '';
      var names = [], others = 0;
      for(var i=0;i<list.length;i++){
        var n = patrolLocalName(list[i].slot);
        if(n && names.length < 6) names.push(n + (list[i].stage>=2?'²':''));
        else others++;
      }
      var body = names.length ? names.join(' · ') : '';
      var tail = others > 0 ? ((body?' · ':'')+'另有 '+others+' 个在其它岛') : '';
      return '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #f59e0b44;color:#c4b5fd;font-size:12px;line-height:1.8">'
        + '👻 <b>毕业巡检期</b>（玩任意游戏答对即通过 +3）<br>'
        + '<span style="color:#a5b4fc">'+body+tail+'</span></div>';
    }catch(e){ return ''; }
  }
  function fillCenterSlot(){
    try{
      var slot = document.getElementById('hr_rewards_slot');
      if(slot) slot.innerHTML = cardHtml();
    }catch(e){}
  }
  function refreshUI(){ try{ checkGlobalClear(); }catch(e){} fillCenterSlot(); renderBanner(); }

  /* ---------- 启动 ---------- */
  function boot(){
    if(!installWrapper()){
      var tries = 0, timer = setInterval(function(){
        if(installWrapper() || ++tries > 40) clearInterval(timer);
      }, 250);
    }
    autoMaintain();
    refreshUI();   /* 🔴v966修复：boot必须过checkGlobalClear记录hadDue，否则"开局直进今日复习清完"拿不到+20/连击 */
    try{
      window.addEventListener('pageshow', function(){ autoMaintain(); refreshUI(); });
      document.addEventListener('visibilitychange', function(){ if(!document.hidden) refreshUI(); });
    }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenReviewRewardsV963 = {
    onTodayComplete: onTodayComplete,
    onGraduated: onGraduated,
    fillCenterSlot: fillCenterSlot,
    refresh: refreshUI,
    _debug: { ymd: ymd, dayNum: dayNum, streak: streak, dayState: dayState, sinceMap: sinceMap,
              gradEligible: gradEligible, tickStreak: tickStreak,
              globalDueInfo: globalDueInfo, bannerState: bannerState, bannerModel: bannerModel,
              checkGlobalClear: checkGlobalClear,
              patrolMap: patrolMap, schedulePatrol: schedulePatrol, patrolDueList: patrolDueList,
              patrolOnAnswer: patrolOnAnswer, addDaysYmd: addDaysYmd,
              lifeState: lifeState, hunterTitle: hunterTitle }
  };
})();
