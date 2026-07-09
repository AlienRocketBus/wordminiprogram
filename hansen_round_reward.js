// hansen_round_reward.js — 打通整轮 20 关 Boss 奖励钻石(Hansen)
// ════════════════════════════════════════════════════════════════════════════
//  Hansen 需求: 必须把全部 20 关 Boss(Lv1→Lv20)全部打赢, 才算「通关一轮」, 奖励 88 钻石。
//    Boss 可反复打 → 可反复通关 → 反复赚钻(不限每天轮数)。
//    ✅ 防刷天然成立: 要拿钻石就必须打赢最强的 Lv20, 光刷第一关一文不值。
//
//  机制:
//    - 记录「本轮已打赢的 boss 等级」集合(localStorage)。🔴v862起【按岛独立】: 每岛自己的一轮/轮数/每日钻石防刷(键带岛名), 星海100其余88。
//    - 每打赢一个 boss(bossVictory)→ 把该关等级加入集合(已在集合内则不重复)。
//    - 集齐全部 20 个(1~20)→ HansenGems.add(88) + 奖励弹窗 + 清空集合 + 轮数 +1, 进入下一轮。
//    - 打输不影响(不加不扣)。重复打同一关只算一个(集合去重)。
//    - 不限每天轮数。
//
//  钻石数额依据(v862注: 护甲已删·武器+血量全满约2560钻): 每轮88钻(星海100)·每岛每日一次,
//    正好接住成就领完后的空档, 成为中后期可持续主力来源。
//
//  全程零旋转/闪烁/震动(防晕铁律): 弹窗仅淡入 + 轻微放大。
// ════════════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  if(window.__hansenRoundRewardLoaded){ return; } window.__hansenRoundRewardLoaded = true;

  var ROUND_KEY_LEGACY = 'hansen_boss_round_cleared';
  var COUNT_KEY_LEGACY = 'hansen_boss_round_count';
  // 🔴v862 按岛存储(Hansen: 每天一个岛只能刷一次88钻·想多刷得去别的岛)
  function _iKey(){
    try{
      var p = (location.pathname || '').split('/').pop() || '';
      var m = p.match(/^island_([a-z0-9]+)\.html?$/i);
      if(m) return m[1].toLowerCase();
    }catch(e){}
    return 'unknown';
  }
  function _isSeason(k){ return typeof k==='string' && k.indexOf('season')===0; }
  function _isLand(k){ return typeof k==='string' && /^land[1-8]$/.test(k); }  //🔴v875(Hansen·彻底打通): 单词大陆8岛=正片同款大满贯(本岛boss数为一轮·通一轮88钻/日·进度=landN_prog)
  function ROUND_KEY(){ return 'hansen_boss_round_cleared_' + _iKey(); }
  function COUNT_KEY(){ return 'hansen_boss_round_count_' + _iKey(); }
  function GEMDAY_KEY(){ return 'hansen_boss_round_gemday_' + _iKey(); }
  function GEM_AMOUNT(){ return _isSeason(_iKey()) ? 100 : 88; }
  var REWARD_COIN = 300;
  var REWARD_BOOST = 120;
  function TOTAL_FN(){ if(_isLand(_iKey())){ try{ if(window.BOSSES && window.BOSSES.length) return window.BOSSES.length; }catch(_e){} return 5; } return _isSeason(_iKey()) ? 6 : 20; }  // 🔴v867 星海6柱·正片20关 //🔴v875 大陆岛=本岛BOSSES数(5或4)
  var TOTAL  = 20;  // 兼容旧引用(内部改用TOTAL_FN)
  function _today(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

  function readRound(){
    // 🔴v866 正片: 读cards.islandClears权威通关记录(与卡册"已击败X/20"同源·按岛独立)。
    // 🔴v867 星海独立: 星海是番外篇6关制(六柱)·进度=已点亮的柱(=已拿守关卡的关号)·与正片20关彻底分开。
    //🔴v875(Hansen·彻底打通): 大陆岛进度=landN_prog(顺序闯关前沿)·已通关号=[1..prog]·与正片islandClears/星海六柱三轨并行互不污染。
    if(_isLand(_iKey())){ try{ var _lp875=parseInt(localStorage.getItem(_iKey()+'_prog')||'0',10)||0; var _la875=[]; for(var _li875=1; _li875<=_lp875; _li875++){ _la875.push(_li875); } return _la875; }catch(_le875){} return []; }
    if(_isSeason(_iKey())){
      try{
        if(typeof window.__seasonPillarsLit === 'function'){
          var lit = window.__seasonPillarsLit();      // 返回已点亮柱号数组 [1,2,...]
          if(Array.isArray(lit)) return lit;
        }
      }catch(e){}
      return [];
    }
    try{
      if(typeof window.getIslandClearedLevels === 'function'){
        var real = window.getIslandClearedLevels();
        if(Array.isArray(real)) return real;
      }
    }catch(e){}
    try{
      var a = JSON.parse(localStorage.getItem(ROUND_KEY()) || '[]');
      return Array.isArray(a) ? a : [];
    }catch(e){ return []; }
  }
  function writeRound(a){
    // 🔴v866: 通关集合权威数据现由 cards.islandClears 管理(打赢boss时markBossWin写)·进度器不再自己维护。
    //   仅保留"清空一轮"语义: 集齐20关发钻后要开新一轮 → 但islandClears是永久通关记录不能清!
    //   新方案: 用"已结算轮数基线"记录已经发过钻的通关数, readRound减去基线=本轮进度。见 onWin。
  }
  function getCount(){ try{ return parseInt(localStorage.getItem(COUNT_KEY()) || '0', 10) || 0; }catch(e){ return 0; } }
  function setCount(n){ try{ localStorage.setItem(COUNT_KEY(), String(Math.max(0, n|0))); }catch(e){} }
  function gemPaidToday(){ try{ return localStorage.getItem(GEMDAY_KEY()) === _today(); }catch(e){ return false; } }
  function markGemPaidToday(){ try{ localStorage.setItem(GEMDAY_KEY(), _today()); }catch(e){} }

  // 当前打赢的关卡(与 hansen_boss_progress.js 判定完全一致: 优先 _hansenRebattleLv)
  function currentLv(){
    try{
      if(window._hansenRebattleLv != null) return Math.max(1, Math.min(20, window._hansenRebattleLv | 0));
      var S = window.S; if(S) return Math.max(1, Math.min(20, (S.bossCurrentLv || S.level || 1) | 0));
    }catch(e){}
    return 1;
  }

  // 记一次打赢; 集齐 20 关发钻
  // 🔴v867 星海番外篇专属结算: 每点亮一柱+15💎(防重·按柱记), 6柱全通补足到100💎整+限定卡。每天一次防刷。
  var SEASON_PER_PILLAR = 15, SEASON_FULL_TOTAL = 100, SEASON_PILLAR_KEY = 'hansen_season_pillar_gems'; // {已发钻的柱号:true}
  function seasonPillarPaid(){ try{ return JSON.parse(localStorage.getItem(SEASON_PILLAR_KEY)||'{}')||{}; }catch(e){ return {}; } }
  function onWinSeason(){
    var lit = readRound();                     // 已点亮柱号数组(=已拿守关卡)
    var paid = seasonPillarPaid();
    var newlyLit = [];
    for(var i=0;i<lit.length;i++){ if(!paid[lit[i]]){ newlyLit.push(lit[i]); } }
    if(newlyLit.length===0){ try{ if(window.HansenRoundBar) HansenRoundBar.refresh(); }catch(e){} return; }
    // 本次新点亮的柱: 每柱先给15金币加速照给
    var full = lit.length >= 6;
    for(var j=0;j<6;j++){ if(lit.indexOf(j+1)<0){ full=false; break; } }
    var gemToPay;
    if(full){
      // 全通: 补足到100(已发的柱数×15已入袋, 补差额)
      var alreadyPaidCount = Object.keys(paid).length;
      var alreadyGems = alreadyPaidCount * SEASON_PER_PILLAR;
      gemToPay = Math.max(0, SEASON_FULL_TOTAL - alreadyGems);   // 补足到100
    } else {
      gemToPay = newlyLit.length * SEASON_PER_PILLAR;            // 每新柱15
    }
    // 记录这些柱已发钻
    for(var k=0;k<newlyLit.length;k++){ paid[newlyLit[k]] = true; }
    try{ localStorage.setItem(SEASON_PILLAR_KEY, JSON.stringify(paid)); }catch(e){}
    if(gemToPay>0){ try{ if(window.HansenGems && HansenGems.add) HansenGems.add(gemToPay); }catch(e){} }
    // 金币+加速(点亮就给)
    try{ if(window.HansenCoins && HansenCoins.add) HansenCoins.add(REWARD_COIN); }catch(e){}
    try{ if(window.HansenCrystal && HansenCrystal.grantBoost) HansenCrystal.grantBoost(REWARD_BOOST, true); }catch(e){}
    if(full){ setCount(getCount()+1); }
    showSeasonReward(lit.length, gemToPay, full);
    try{ if(window.HansenRoundBar) HansenRoundBar.refresh(); }catch(e){}
  }
  function showSeasonReward(litCount, gemAmt, full){
    try{ showRoundReward(getCount(), gemAmt, false, {season:true, lit:litCount, full:full}); }catch(e){}
  }

  function onWin(lv){
    // 🔴v867 星海走独立结算(六柱)
    if(_isSeason(_iKey())){ try{ onWinSeason(); }catch(e){} return; }
    // 🔴v866(Hansen 根修): 进度以【islandClears权威通关记录】为准(readRound直读它)。
    //   注意: markBossWin(cards)已在打赢时把本关记入islandClears, 所以这里readRound()已包含刚打赢的lv, 无需再push。
    var arr = readRound();

    // 本岛 1~20 是否全部真实打通?
    var _tot = TOTAL_FN();
    var full = arr.length >= _tot;
    if(full){ for(var i = 1; i <= _tot; i++){ if(arr.indexOf(i) < 0){ full = false; break; } } }

    if(full){
      // 全通 + 今日本岛还没发过钻 → 发钻(每日防刷)。金币/加速在"今天首次达成全通"时给一次。
      var paidBefore = gemPaidToday();
      if(!paidBefore){
        var gemAmt = GEM_AMOUNT();
        try{ if(window.HansenCoins && HansenCoins.add) HansenCoins.add(REWARD_COIN); }catch(e){}
        try{ if(window.HansenCrystal && HansenCrystal.grantBoost) HansenCrystal.grantBoost(REWARD_BOOST, true); }catch(e){}
        try{ if(window.HansenGems && HansenGems.add) HansenGems.add(gemAmt); }catch(e){}
        markGemPaidToday();
        setCount(getCount() + 1);
        showRoundReward(getCount(), gemAmt, false);
      }
      // 已通关状态下重复打赢(paidBefore=true): 不再弹奖不再发钻(避免每打一关都弹)
    }
    try{ if(window.HansenRoundBar) HansenRoundBar.refresh(); }catch(e){}
  }

  // 奖励弹窗(淡入 + 轻微放大; 无旋转/闪烁/震动; 三重保险关闭)
  function showRoundReward(roundNo, gemAmt, alreadyPaidToday){
    var gemLine = gemAmt>0
      ? '<div style="font-size:15px;color:#c4b5fd;margin-bottom:4px">💎 <b style="font-size:22px;color:#e9d5ff">+' + gemAmt + '</b> 钻石(' + (_isSeason(_iKey())?'星海':'本岛') + '今日大满贯奖励)</div>'
      : '<div style="font-size:13px;color:#fca5a5;margin-bottom:4px">💎 本岛今日已领过钻石·明天可再拿</div>';
    try{
      var mask = document.createElement('div');
      mask.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:30px;animation:hrrFade .3s ease';
      mask.innerHTML =
        '<div style="background:linear-gradient(135deg,#1e3a8a,#0b1437);border:3px solid #fbbf24;border-radius:20px;padding:30px 26px;text-align:center;color:#fff;max-width:330px;box-shadow:0 0 60px rgba(251,191,36,.55);animation:hrrPop .32s ease">' +
          '<div style="font-size:72px;line-height:1;margin-bottom:12px">🏆</div>' +
          '<div style="font-size:21px;font-weight:900;color:#fbbf24;margin-bottom:8px">通关一轮 20 关 Boss！</div>' +
          gemLine + '<div style="font-size:15px;color:#fde047;margin-bottom:6px;line-height:1.6">🪙 +<b>' + REWARD_COIN + '</b> 金币　⚡ 加速 ' + REWARD_BOOST + ' 分钟(复习涨星更快)</div>' +
          '<div style="font-size:13px;color:#93c5fd;margin-bottom:20px">第 ' + roundNo + ' 次通关 · 趁加速快去答，把单词变成 💎 钻石！</div>' +
          '<button id="hrrOk" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;border:0;padding:12px 34px;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer">收下！</button>' +
        '</div>';
      document.body.appendChild(mask);
      var btn = mask.querySelector('#hrrOk');
      if(btn) btn.addEventListener('click', function(){ try{ mask.remove(); }catch(e){} });
      setTimeout(function(){ mask.addEventListener('click', function(e){ if(e.target === mask){ try{ mask.remove(); }catch(e2){} } }); }, 500);
      var esc = function(e){ if(e.key === 'Escape' || e.keyCode === 27){ try{ mask.remove(); }catch(e2){} document.removeEventListener('keydown', esc); } };
      document.addEventListener('keydown', esc);
      try{ if(window.playLevelUp) window.playLevelUp(); }catch(e){}
    }catch(e){}
  }

  // hook bossVictory(等它出现; 重试; 防重复)。先存关卡再调原版(原版可能清 _hansenRebattleLv)。
  function hookVictory(){
    if(typeof window.bossVictory !== 'function') return false;
    if(window.__hrrVictoryHooked) return true;
    var orig = window.bossVictory;
    window.bossVictory = function(){
      var lv; try{ lv = currentLv(); }catch(e){ lv = 1; }
      var r = orig.apply(this, arguments);
      try{ onWin(lv); }catch(e){}
      return r;
    };
    window.__hrrVictoryHooked = true;
    return true;
  }

  // 动画 CSS(淡入 + 轻微放大, 无旋转无闪烁)
  if(typeof document !== 'undefined'){
    var st = document.createElement('style');
    st.textContent = '@keyframes hrrFade{from{opacity:0}to{opacity:1}}@keyframes hrrPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}';
    if(document.head) document.head.appendChild(st);
  }

  hookVictory();
  var tries = 0;
  var timer = setInterval(function(){ tries++; if(hookVictory() || tries > 40) clearInterval(timer); }, 150);

  // 调试/查询接口
  window.HansenRoundReward = {
    progress: function(){ return readRound().slice().sort(function(a,b){ return a-b; }); },
    remain: function(){ var a=readRound(), r=[], _t=TOTAL_FN(); for(var i=1;i<=_t;i++){ if(a.indexOf(i)<0) r.push(i); } return r; },
    count: getCount,
    islandKey: _iKey,
    isSeason: function(){ return _isSeason(_iKey()); },
    gemAmount: GEM_AMOUNT,
    gemPaidToday: gemPaidToday,
    total: TOTAL_FN,
    _win: onWin,
    _reset: function(){ writeRound([]); try{localStorage.removeItem(GEMDAY_KEY())}catch(e){} }
  };
})();
