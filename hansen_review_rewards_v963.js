/* ============================================================
 * hansen_review_rewards_v963.js — 「错词猎人」复习奖励系统 (v963 样机)
 * ============================================================
 * 设计原则（用户 2026-07-21 确认）：
 *   1. 奖励只挂"真实答题证据"（markAnswer 中错词真实变化），自评"记住了"零奖励。
 *   2. 毕业金采用"隔天规则"防刷：错词建档日 < 今天才发 +15；
 *      当天造的错词当天清零只有纠错 +2（与普通答题同价，刷无可刷）。
 *   3. 全部发放走 HansenCoins.award / HansenGems.award 幂等收据，
 *      刷新、断网、双击都不会重复发；失败自动回滚可重试。
 *   4. 不新建钱包、不新造题目、不改 markAnswer 原语义（纯包装观察）。
 *
 * 样机范围：仅在美食岛 (wordIslandFood) 激活；其它岛加载后立即 no-op。
 * 收据格式：
 *   rvrw:<日期>:<canonical槽>:c<1-3>   纠错 +2 金币（每词每天3次）
 *   rvrw:<日期>:<canonical槽>:grad     毕业 +15 金币（隔天规则）
 *   rvrw:<日期>:clearall               当日清空错题本 +30（需≥3词毕业）
 *   rvrw:<日期>:todaydone              完成今日复习 +20
 *   rvrw:streak:<起始日>:m<N>          连击里程碑金币
 *   rvrwg:streak:<起始日>:m<N>         连击里程碑钻石
 * 存储键（v963 新增，仅本模块读写）：
 *   hansen_review_wrong_since_v963     {槽: 'YYYY-MM-DD'} 错词建档日
 *   hansen_review_streak_v963          {start,last,count} 连续复习状态
 *   hansen_review_day_v963             {day,grads,coins} 当日统计（UI用）
 * ============================================================ */
(function(){
  'use strict';

  /* ---------- 样机门禁：只在美食岛激活 ---------- */
  var ISLAND_GATE = 'wordIslandFood';
  if ((window.__hsnSaveKey || '') !== ISLAND_GATE) return;

  var K_SINCE  = 'hansen_review_wrong_since_v963';
  var K_STREAK = 'hansen_review_streak_v963';
  var K_DAY    = 'hansen_review_day_v963';
  var SINCE_MAX = 600; // since 表安全上限，防无限膨胀

  /* ---------- 小工具 ---------- */
  function ymd(d){
    d = d || new Date();
    var m = d.getMonth()+1, dd = d.getDate();
    return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;
  }
  function yesterdayYmd(){ var d=new Date(); d.setDate(d.getDate()-1); return ymd(d); }
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
    return ISLAND_GATE + ':' + idx;
  }
  function safeWrong(v){
    try{
      if(typeof window.__hsnSafeWrongCount === 'function') return window.__hsnSafeWrongCount(v);
    }catch(e){}
    v = Number(v); return (isFinite(v) && v > 0) ? Math.floor(v) : 0;
  }
  function coins(){ return (window.HansenCoins && typeof HansenCoins.award === 'function') ? HansenCoins : null; }
  function gems(){ return (window.HansenGems && typeof HansenGems.award === 'function') ? HansenGems : null; }

  /* 幂等发币：只有"本次新发放"才返回 true（用于 UI 与计数） */
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

  /* ---------- 当日统计（仅供状态卡展示） ---------- */
  function dayState(){
    var t = ymd(), s = readJson(K_DAY);
    if(!s || s.day !== t) s = { day:t, grads:0, coins:0 };
    if(typeof s.grads !== 'number' || s.grads < 0) s.grads = 0;
    if(typeof s.coins !== 'number' || s.coins < 0) s.coins = 0;
    return s;
  }
  function bumpDay(grads, coinAmt){
    var s = dayState();
    s.grads += (grads|0); s.coins += (coinAmt|0);
    writeJson(K_DAY, s);
    return s;
  }

  /* ---------- UI 反馈（全部 try/catch，坏了也不影响游戏） ---------- */
  function floatCoin(text){
    try{
      if(typeof window.floatText === 'function')
        floatText(window.innerWidth/2, 245, text, '#fbbf24');
    }catch(e){}
    try{ if(typeof window.playCoin === 'function') playCoin(); }catch(e){}
  }
  function toast(msg){
    try{
      if(typeof window.showComboToast === 'function'){ showComboToast(msg, 'pet-evolve', 2600); return; }
    }catch(e){}
    try{ if(typeof window.showToast === 'function') showToast(msg); }catch(e){}
  }

  /* ---------- 错词建档日（隔天毕业规则的核心） ---------- */
  function sinceMap(){ var m = readJson(K_SINCE); return m || {}; }
  function stampSince(slot){
    var m = sinceMap();
    m[slot] = ymd();
    var keys = Object.keys(m);
    if(keys.length > SINCE_MAX){            // 超限时按日期剪最老的
      keys.sort(function(a,b){ return String(m[a]).localeCompare(String(m[b])); });
      for(var i=0; i<keys.length-SINCE_MAX; i++) delete m[keys[i]];
    }
    writeJson(K_SINCE, m);
  }
  function clearSince(slot){
    var m = sinceMap();
    if(Object.prototype.hasOwnProperty.call(m, slot)){ delete m[slot]; writeJson(K_SINCE, m); }
  }
  /* 毕业金资格：无建档记录（老玩家历史错词）或建档日 < 今天 */
  function gradEligible(slot){
    var m = sinceMap(), rec = m[slot];
    if(typeof rec !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec)) return true;
    return rec < ymd();
  }

  /* ---------- 岛内错题本是否已清空（样机：本岛口径） ---------- */
  function islandWrongsEmpty(){
    try{
      var w = window.S && S.wrongs;
      if(!w || typeof w !== 'object') return true;
      for(var k in w){ if(safeWrong(w[k]) > 0) return false; }
      return true;
    }catch(e){ return false; }
  }

  /* ---------- 核心：包装 markAnswer（观察真实错词变化） ---------- */
  function onWrongDecreased(idx, slot, nowZero){
    var day = ymd(), paidAny = 0;
    // 纠错 +2，每词每天 3 次（沿用救援队 ordinal 收据模式）
    for(var ord = 1; ord <= 3; ord++){
      var cid = 'rvrw:'+day+':'+slot+':c'+ord;
      var w = coins();
      if(w && typeof w.hasAward === 'function' && w.hasAward(cid)) continue;
      if(payCoinOnce(cid, 2)){ paidAny = 2; floatCoin('+2 复习金币 💰'); }
      break;
    }
    if(paidAny) bumpDay(0, paidAny);

    if(nowZero){
      if(gradEligible(slot)){
        var gid = 'rvrw:'+day+':'+slot+':grad';
        if(payCoinOnce(gid, 15)){
          var st = bumpDay(1, 15);
          floatCoin('+15 毕业金 🎓');
          // 当日清空错题本：今天已毕业 ≥3 词 且 本岛错题空
          if(st.grads >= 3 && islandWrongsEmpty()){
            if(payCoinOnce('rvrw:'+day+':clearall', 30)){
              bumpDay(0, 30);
              toast('🏆 今日错题全部清空！<b>+30 金币</b>');
            }
          }
        }
      }
      clearSince(slot);   // 词已清零，撤销建档（下次再错重新计日）
    }
    refreshCard();
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
        if(w1 > w0 && w0 === 0) stampSince(slotOf(idx));           // 新错词建档=今天
        else if(w1 < w0) onWrongDecreased(idx, slotOf(idx), w1 === 0); // 真实纠错
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
    if(s.last === t) return s;                     // 今天已计
    if(s.last === y && s.start){ s.count += 1; s.last = t; }
    else { s.start = t; s.last = t; s.count = 1; } // 断签重新开始（无惩罚）
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

  /* 到期词为 0 且昨天有记录 → 自动保护连击（免作业日不断签） */
  function dueCountToday(){
    try{
      var t = ymd(), n = 0, srs = window.S && S.srs, wr = window.S && S.wrongs;
      if(!srs || typeof srs !== 'object') return 0;
      for(var k in srs){
        var e = srs[k]; if(!e || typeof e !== 'object') continue;
        var i = +k, box = (typeof e.box === 'number') ? e.box : -1;
        var due = (typeof e.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.due)) ? e.due : '';
        if(Number.isSafeInteger(i) && i >= 0 && box >= 0 && box < 5 && due && due <= t
           && safeWrong(wr ? wr[i] : 0) > 0 && window.allW && allW[i]) n++;
      }
      return n;
    }catch(e){ return 0; }
  }
  function autoMaintain(){
    try{
      var s = streak();
      if(s.last === yesterdayYmd() && dueCountToday() === 0) tickStreak();
    }catch(e){}
  }

  /* ---------- 今日复习完成回调（hansen_review.js 调用） ---------- */
  function onTodayComplete(info){
    try{
      info = info || {};
      var total = (typeof info.total === 'number') ? info.total : 0;
      if(total >= 1){
        if(payCoinOnce('rvrw:'+ymd()+':todaydone', 20)){
          bumpDay(0, 20);
          toast('✅ 完成今日复习！<b>+20 金币</b>');
        }
      }
      tickStreak();     // 有到期完成、或主动打开确认无到期，都维持连击
      refreshCard();
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
    return '<div id="hr_rvrw_card" style="background:linear-gradient(135deg,#78350f22,#92400e18);border:1px solid #f59e0b55;border-radius:14px;padding:12px 14px;margin:2px 0 14px;font-size:13px;color:#e2e8f0;line-height:1.9">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
      +   '<span>'+fire+'</span>'
      +   '<span style="color:#94a3b8;font-size:12px">下个里程碑 '+next+' 天</span>'
      + '</div>'
      + '<div style="color:#94a3b8;font-size:12px">今日复习已赚 <b style="color:#fde047">'+d.coins+'</b> 金币 · 毕业 <b style="color:#34d399">'+d.grads+'</b> 词</div>'
      + '<div style="color:#64748b;font-size:11px">纠错 +2 · 隔天毕业 +15 · 清空错题 +30 · 完成今日复习 +20</div>'
      + '</div>';
  }
  function fillCenterSlot(){
    try{
      var slot = document.getElementById('hr_rewards_slot');
      if(slot) slot.innerHTML = cardHtml();
    }catch(e){}
  }
  function refreshCard(){ fillCenterSlot(); }

  /* ---------- 启动 ---------- */
  function boot(){
    if(!installWrapper()){
      var tries = 0, timer = setInterval(function(){
        if(installWrapper() || ++tries > 40) clearInterval(timer);
      }, 250);
    }
    autoMaintain();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenReviewRewardsV963 = {
    onTodayComplete: onTodayComplete,
    fillCenterSlot: fillCenterSlot,
    _debug: { ymd: ymd, streak: streak, dayState: dayState, sinceMap: sinceMap,
              gradEligible: gradEligible, dueCountToday: dueCountToday, tickStreak: tickStreak }
  };
})();
