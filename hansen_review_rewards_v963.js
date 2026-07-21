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

  /* ---------- 当日统计（状态卡/横幅展示） ---------- */
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

  /* ---------- UI 反馈 ---------- */
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
    var out = { globalDue:0, localDue:0, ok:false };
    try{
      var HC = window.HansenCanonical;
      if(!HC || typeof HC.read !== 'function') return out;
      var store = HC.read();
      if(!store || typeof store !== 'object') return out;
      var wrongs = (store.wrongs && typeof store.wrongs === 'object') ? store.wrongs : {};
      var srs = (store.srs && typeof store.srs === 'object') ? store.srs : {};
      var total = (typeof HC.TOTAL_WORDS === 'number' && HC.TOTAL_WORDS > 0) ? HC.TOTAL_WORDS : 952;
      var tNum = dayNum(ymd());
      var lo = -1, hi = -1;
      try{
        var ref = (typeof HC.currentRef === 'function') ? HC.currentRef() : (window.__hsnSaveKey||'');
        var a = (typeof HC.resolve === 'function') ? HC.resolve(ref) : null;
        if(a && HC.islands && HC.islands.length){
          for(var ii=0; ii<HC.islands.length; ii++){
            if(HC.islands[ii] && HC.islands[ii].id === a.id){
              lo = Number(HC.islands[ii].start)|0;
              hi = lo + (Number(HC.islands[ii].words)|0);
              break;
            }
          }
          /* Land 切片：resolve 可能带自己的 offset/length（星海子段） */
          if(a && typeof a.offset === 'number' && typeof a.length === 'number' && a.length > 0 && a.length < (hi-lo)){
            lo = lo + a.offset; hi = lo + a.length;
          }
        }
      }catch(e){ lo = -1; hi = -1; }
      Object.keys(wrongs).forEach(function(k){
        var i = Number(k);
        if(!Number.isInteger(i) || i < 0 || i >= total) return;
        if(safeWrong(wrongs[k]) <= 0) return;
        var e = srs[k] || srs[i];
        var due;
        if(!e || typeof e !== 'object'){ due = true; }
        else{
          var box = (typeof e.box === 'number') ? e.box : 0;
          var dn = dayNum(e.due);
          due = box >= 0 && box < 5 && (dn === 0 || dn <= tNum);
        }
        if(due){
          out.globalDue++;
          if(lo >= 0 && i >= lo && i < hi) out.localDue++;
        }
      });
      out.ok = true;
    }catch(e){}
    return out;
  }

  /* ---------- 包装 markAnswer（真实纠错/毕业奖励） ---------- */
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

    if(nowZero){
      if(gradEligible(slot)){
        var gid = 'rvrw:'+day+':'+slot+':grad';
        if(payCoinOnce(gid, 15)){
          var st = bumpDay(1, 15);
          floatCoin('+15 毕业金 🎓');
          if(st.grads >= 3 && islandWrongsEmpty()){
            if(payCoinOnce('rvrw:'+day+':clearall', 30)){
              bumpDay(0, 30);
              toast('🏆 今日错题全部清空！<b>+30 金币</b>');
            }
          }
        }
      }
      clearSince(slot);
    }
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

  /* ---------- 今日复习完成回调 ---------- */
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
      tickStreak();
      refreshUI();
    }catch(e){}
  }

  /* ---------- 🔴迭代3：首页"今日复习"触发横幅 ----------
   * 位置：daily-row 三卡正下方整宽注入；不改动 v954 三卡 HTML/几何基线。
   * 状态：本岛有到期 / 仅其它岛有 / 今日已清 / 无到期（安心态）。 */
  function bannerState(info, s){
    var t = ymd();
    if(info.globalDue > 0 && info.localDue > 0) return 'local';
    if(info.globalDue > 0) return 'cross';
    return (s.last === t && s.count > 0) ? 'done' : 'calm';
  }
  function bannerModel(){
    var info = globalDueInfo(), s = streak(), st = bannerState(info, s);
    var fire = s.count > 0 ? ('🔥 '+s.count+' 天') : '';
    if(st === 'local'){
      var extra = info.globalDue - info.localDue;
      return { st:st, icon:'📬', bg:'linear-gradient(135deg,#f59e0b,#d97706)',
        title:'今日复习 · 本岛 '+info.localDue+' 个词到期'+(extra>0?(' · 全部 '+info.globalDue):''),
        sub:'点我开始 · 完成 +20 金币', fire:fire };
    }
    if(st === 'cross'){
      return { st:st, icon:'🧭', bg:'linear-gradient(135deg,#8b5cf6,#6d28d9)',
        title:'其它岛还有 '+info.globalDue+' 个词到期',
        sub:'点我去错题总览 · 跨岛清完不断签', fire:fire };
    }
    if(st === 'done'){
      return { st:st, icon:'✅', bg:'linear-gradient(135deg,#10b981,#059669)',
        title:'今日复习已清空',
        sub:'连击保住了 · 明天见', fire:fire };
    }
    return { st:'calm', icon:'🧠', bg:'linear-gradient(135deg,#334155,#1e293b)',
      title:'今天没有要复习的单词',
      sub:'大脑正在悄悄记牢它们', fire:fire };
  }
  function bannerClick(){
    var m = bannerModel();
    try{
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
        el.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0 2px;padding:11px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);cursor:pointer;min-height:48px;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:transform .15s';
        el.addEventListener('click', bannerClick);
        el.addEventListener('keydown', function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); bannerClick(); } });
        el.addEventListener('touchstart', function(){ el.style.transform='scale(.985)'; }, {passive:true});
        el.addEventListener('touchend', function(){ el.style.transform=''; }, {passive:true});
        row.insertAdjacentElement('afterend', el);
      }
      var m = bannerModel();
      el.style.background = m.bg;
      el.setAttribute('aria-label', m.title+'。'+m.sub);
      el.innerHTML =
        '<span style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))" aria-hidden="true">'+m.icon+'</span>'+
        '<span style="flex:1;min-width:0">'+
          '<span style="display:block;font-size:14.5px;font-weight:800;line-height:1.35">'+m.title+'</span>'+
          '<span style="display:block;font-size:11.5px;opacity:.92;line-height:1.4">'+m.sub+'</span>'+
        '</span>'+
        (m.fire ? '<span style="flex:none;font-size:12px;font-weight:800;background:rgba(0,0,0,.28);padding:5px 9px;border-radius:999px;white-space:nowrap">'+m.fire+'</span>' : '');
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
  function refreshUI(){ fillCenterSlot(); renderBanner(); }

  /* ---------- 启动 ---------- */
  function boot(){
    if(!installWrapper()){
      var tries = 0, timer = setInterval(function(){
        if(installWrapper() || ++tries > 40) clearInterval(timer);
      }, 250);
    }
    autoMaintain();
    renderBanner();
    try{
      window.addEventListener('pageshow', function(){ autoMaintain(); refreshUI(); });
      document.addEventListener('visibilitychange', function(){ if(!document.hidden) refreshUI(); });
    }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HansenReviewRewardsV963 = {
    onTodayComplete: onTodayComplete,
    fillCenterSlot: fillCenterSlot,
    refresh: refreshUI,
    _debug: { ymd: ymd, dayNum: dayNum, streak: streak, dayState: dayState, sinceMap: sinceMap,
              gradEligible: gradEligible, tickStreak: tickStreak,
              globalDueInfo: globalDueInfo, bannerState: bannerState, bannerModel: bannerModel }
  };
})();
