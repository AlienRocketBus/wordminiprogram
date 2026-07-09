// hansen_spellbee_gems.js —— 🔴v862 Spelling Bee 钻石里程碑
// Hansen: "Bee也能刷钻·让孩子多玩·防刷". 每天 Bee里首次完整拼对 未永久掌握 的新词:
//   5词 → +1💎   10词 → 再+2💎(累计3)   20词 → 再+5💎(累计8·封顶)
// 防刷双闸: ①"未永久掌握"过滤(问HansenCrystal) → 已结晶的词不算(每岛一份熟练度·bee open(islandKey)传入)
//          ②"今日集合去重" → 同一个词今天算过一次就不再算
// 触发点: 岛侧监听 spelling_bee 上报的 postMessage {type:'hsn_sb_mastery',word:'elephant'} → 同时被 hansen_spellbee.js 走markAnswer(全家桶) + 本模块走里程碑
// 存储: key='hansen_bee_gem_daily' → {date:'2026-7-2', words:{elephant:1,cat:1}, grantedTiers:[1,2]}
(function(){
  'use strict';
  var KEY = 'hansen_bee_gem_daily';
  var TIERS = [ {n:5, gem:1}, {n:10, gem:2}, {n:20, gem:5} ];  // 累加=1/3/8
  function _today(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function load(){
    try{
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!s || s.date !== _today()) return {date:_today(), words:{}, grantedTiers:[]};
      if(!s.words) s.words = {}; if(!s.grantedTiers) s.grantedTiers = [];
      return s;
    }catch(e){ return {date:_today(), words:{}, grantedTiers:[]}; }
  }
  function save(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }
  function isCrystalized(en){
    // 已永久掌握词=不算(逼你挑战新词) — HansenCrystal按岛存储·bee开时是当前岛
    try{
      if(!en || !window.HansenCrystal) return false;
      var st = window.HansenCrystal.stats && window.HansenCrystal.stats();
      if(!st || !st.perWord) return false;
      var rec = st.perWord[en] || st.perWord[String(en).toLowerCase()];
      return !!(rec && rec.mastered);
    }catch(e){ return false; }
  }
  function record(en){
    en = String(en || '').trim().toLowerCase();
    if(!en) return null;
    if(isCrystalized(en)) return {skipped:'crystalized'};
    var s = load();
    if(s.words[en]) return {skipped:'duplicate_today'};
    s.words[en] = 1;
    var newCount = Object.keys(s.words).length;
    var granted = [];
    for(var i=0;i<TIERS.length;i++){
      var t = TIERS[i];
      if(newCount >= t.n && s.grantedTiers.indexOf(t.n) < 0){
        s.grantedTiers.push(t.n);
        try{ if(window.HansenGems && HansenGems.add) HansenGems.add(t.gem); }catch(e){}
        granted.push(t);
      }
    }
    save(s);
    if(granted.length){
      try{ showTierToast(granted, newCount); }catch(e){}
    }
    return {count:newCount, granted:granted};
  }
  function showTierToast(granted, count){
    var total = 0; for(var i=0;i<granted.length;i++) total += granted[i].gem;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:99998;'
      + 'background:linear-gradient(135deg,rgba(88,28,135,.95),rgba(30,58,138,.95));border:1.5px solid #c4b5fd;'
      + 'border-radius:14px;padding:12px 18px;color:#e9d5ff;font-size:14px;font-weight:800;'
      + 'box-shadow:0 6px 24px rgba(139,92,246,.4);animation:hsbgIn .35s ease;text-align:center';
    d.innerHTML = '💎 Bee 里程碑 +<b style="font-size:20px;color:#fff">' + total + '</b> 钻石!'
      + '<div style="font-size:11.5px;font-weight:600;color:#c4b5fd;margin-top:3px">今日已首次拼对 ' + count + ' 个新词</div>';
    if(!document.getElementById('hsbgAnim')){
      var st = document.createElement('style'); st.id='hsbgAnim';
      st.textContent = '@keyframes hsbgIn{from{opacity:0;transform:translate(-50%,-16px)}to{opacity:1;transform:translate(-50%,0)}}'
        + '@keyframes hsbgOut{from{opacity:1}to{opacity:0;transform:translate(-50%,-8px)}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(d);
    setTimeout(function(){ d.style.animation='hsbgOut .4s ease forwards'; setTimeout(function(){ d.remove(); }, 400); }, 2400);
  }
  window.HansenSpellbeeGems = {
    record: record,
    status: function(){ var s=load(); return {count:Object.keys(s.words||{}).length, granted:s.grantedTiers||[], nextTier:TIERS.filter(function(t){return s.grantedTiers.indexOf(t.n)<0;})[0]||null, capReached: (s.grantedTiers||[]).length===TIERS.length}; },
    tiers: function(){ return TIERS.slice(); }
  };
})();
