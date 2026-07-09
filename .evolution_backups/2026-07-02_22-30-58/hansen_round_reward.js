// hansen_round_reward.js — 打通整轮 20 关 Boss 奖励钻石(Hansen)
// ════════════════════════════════════════════════════════════════════════════
//  Hansen 需求: 必须把全部 20 关 Boss(Lv1→Lv20)全部打赢, 才算「通关一轮」, 奖励 88 钻石。
//    Boss 可反复打 → 可反复通关 → 反复赚钻(不限每天轮数)。
//    ✅ 防刷天然成立: 要拿钻石就必须打赢最强的 Lv20, 光刷第一关一文不值。
//
//  机制:
//    - 记录「本轮已打赢的 boss 等级」集合(localStorage, 跨岛共用同一轮 — boss 是同一套 20 个)。
//    - 每打赢一个 boss(bossVictory)→ 把该关等级加入集合(已在集合内则不重复)。
//    - 集齐全部 20 个(1~20)→ HansenGems.add(88) + 奖励弹窗 + 清空集合 + 轮数 +1, 进入下一轮。
//    - 打输不影响(不加不扣)。重复打同一关只算一个(集合去重)。
//    - 不限每天轮数。
//
//  钻石数额依据: 战斗装备(武器/血量/护甲)全满约 3195 钻, 每轮 88 钻 → 认真打约 36 轮(天)攒齐,
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
  function ROUND_KEY(){ return 'hansen_boss_round_cleared_' + _iKey(); }
  function COUNT_KEY(){ return 'hansen_boss_round_count_' + _iKey(); }
  function GEMDAY_KEY(){ return 'hansen_boss_round_gemday_' + _iKey(); }
  function GEM_AMOUNT(){ return _isSeason(_iKey()) ? 100 : 88; }
  var REWARD_COIN = 300;
  var REWARD_BOOST = 120;
  var TOTAL  = 20;
  function _today(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

  function readRound(){
    try{
      var k = ROUND_KEY(), raw = localStorage.getItem(k);
      if(raw === null){ // 🔴v862 老全局key一次性基线迁移(老用户已打过Lv20不会一夜清零)
        var legacy = localStorage.getItem(ROUND_KEY_LEGACY);
        if(legacy){ localStorage.setItem(k, legacy); return JSON.parse(legacy)||[]; }
        return [];
      }
      var a = JSON.parse(raw); return Array.isArray(a) ? a : [];
    }catch(e){ return []; }
  }
  function writeRound(a){ try{ localStorage.setItem(ROUND_KEY(), JSON.stringify(a)); }catch(e){} }
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
  function onWin(lv){
    lv = Math.max(1, Math.min(20, lv | 0)) || 1;
    var arr = readRound();
    if(arr.indexOf(lv) < 0) arr.push(lv);

    // 是否 1~20 全部集齐?
    var full = arr.length >= TOTAL;
    if(full){ for(var i = 1; i <= TOTAL; i++){ if(arr.indexOf(i) < 0){ full = false; break; } } }

    if(full){
      // 🔴v862 (Hansen): 钻石按岛+每日一次防刷; 金币+记忆强化不受防刷限制照发
      var paidBefore = gemPaidToday();
      var gemAmt = paidBefore ? 0 : GEM_AMOUNT();
      try{ if(window.HansenCoins && HansenCoins.add) HansenCoins.add(REWARD_COIN); }catch(e){}
      try{ if(window.HansenCrystal && HansenCrystal.grantBoost) HansenCrystal.grantBoost(REWARD_BOOST, true); }catch(e){}
      if(gemAmt > 0){
        try{ if(window.HansenGems && HansenGems.add) HansenGems.add(gemAmt); }catch(e){}
        markGemPaidToday();
      }
      setCount(getCount() + 1);
      writeRound([]);
      showRoundReward(getCount(), gemAmt, paidBefore);
      try{ if(window.HansenRoundBar) HansenRoundBar.refresh(); }catch(e){}
    } else {
      writeRound(arr);
      try{ if(window.HansenRoundBar) HansenRoundBar.refresh(); }catch(e){}
    }
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
    remain: function(){ var a=readRound(), r=[]; for(var i=1;i<=TOTAL;i++){ if(a.indexOf(i)<0) r.push(i); } return r; },
    count: getCount,
    islandKey: _iKey,
    isSeason: function(){ return _isSeason(_iKey()); },
    gemAmount: GEM_AMOUNT,
    gemPaidToday: gemPaidToday,
    total: function(){ return TOTAL; },
    _win: onWin,
    _reset: function(){ writeRound([]); try{localStorage.removeItem(GEMDAY_KEY())}catch(e){} }
  };
})();
