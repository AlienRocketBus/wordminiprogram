// hansen_freepass.js — 72 小时全开放(🔴v876·原24h)(boss 挑战关卡 / 卡册图鉴 / 武器自由选)·到期自动关闭·零提醒(Hansen)
// ════════════════════════════════════════════════════════════════════════════
//  Hansen 需求: 进游戏后所有 boss 关卡可挑战、卡册/图鉴展示全部 boss、武器可自由选择,
//    全部开放 24 小时; 24 小时倒计时结束后自动关闭恢复真实进度, 不要任何提醒/弹窗。
//
//  机制(全部复用游戏自带的"临时全解锁/试玩"通道, 不污染真实存档):
//    ① 首次进入设 freepass_until = now + 24h(已过期则不再开·保持关闭)。
//    ② 期内 hook HansenBossProgress.getUnlockedBossLv() → 20(所有 boss 可挑战;
//       但 recordBossWin 仍用真实 S.bossUnlocked 防跳关, 不污染真实解锁进度)。
//    ③ 期内设 hansen_card_temp_unlock_until = until(游戏自带: loadData isTempActive
//       → collected = 全部 20 boss; 卡册 + 图鉴殿堂 own 全展示; rawOnly 写真实, 不污染)。
//    ④ 期内设 gear.trialUntil = until(游戏自带: 全武器试玩, 武器商店点任意武器切换试用)。
//    ⑤ 到期: 三个标记自然过期 → 自动恢复真实进度, 无任何弹窗/toast/banner。
//
//  全程零旋转/闪烁/震动; 零提醒(开启/关闭都不弹任何东西)。
// ════════════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  if(window.__hansenFreepassLoaded){ return; } window.__hansenFreepassLoaded = true;
  //🔴v876: 暴露只读API——大陆8岛zone选关/hub女帝门按此放行试用(display层放行·真实进度prog/旗零污染)

  var FP_KEY   = 'hansen_freepass_until';            // 全开放到期时间戳
  var TEMP_KEY = 'hansen_card_temp_unlock_until';    // 卡册/图鉴临时全解锁(游戏自带机制)
  var GEAR_KEY = 'hansen_gear';                      // 武器(trialUntil/trialWeapon)
  var DAY      = 86400000;                           // 24 小时(毫秒)

  function now(){ return Date.now(); }
  function getUntil(){ try{ return parseInt(localStorage.getItem(FP_KEY) || '0', 10) || 0; }catch(e){ return 0; } }
  function active(){ return getUntil() > now(); }

  // 首次进入开启 24h。只有 ==0(从未开过)才开; 已开过并过期(>0 且 <now)则不再重开, 保持关闭。
  var TRIAL = 3 * DAY;                               //🔴v876(Hansen): 试用开放 72 小时
  var VER_KEY = 'hansen_freepass_ver';               //🔴v876: 政策版本——升级到72h时所有玩家(含已用完24h的)重开一轮, 此后到期不再重开
  function ensureStarted(){
    var u = getUntil();
    var ver = ''; try{ ver = localStorage.getItem(VER_KEY) || ''; }catch(e){}
    if(ver !== '72'){
      u = now() + TRIAL;
      try{ localStorage.setItem(FP_KEY, String(u)); localStorage.setItem(VER_KEY, '72'); }catch(e){}
    } else if(u === 0){
      u = now() + TRIAL;
      try{ localStorage.setItem(FP_KEY, String(u)); }catch(e){}
    }
    return u;
  }

  // 开启同步: 卡册临时全解锁 + 武器全试玩, 到期时间都对齐 freepass(零提醒, 不调商店的 toast 入口)
  function syncOn(until){
    // (1) 卡册 + 图鉴: 设临时全解锁到期 = until(loadData isTempActive → collected 全部 20)
    try{
      if(parseInt(localStorage.getItem(TEMP_KEY) || '0', 10) !== until){
        localStorage.setItem(TEMP_KEY, String(until));
      }
    }catch(e){}
    // (2) 武器: trialUntil = until; trialWeapon 缺省 = 当前真实武器(用户在商店点任意武器自由切换)
    try{
      var g = JSON.parse(localStorage.getItem(GEAR_KEY) || '{}') || {};
      if(g.trialUntil !== until){
        g.trialUntil = until;
        if(g.trialWeapon == null) g.trialWeapon = (g.weaponLvl | 0) || 0;
        localStorage.setItem(GEAR_KEY, JSON.stringify(g));
      }
    }catch(e){}
  }

  // 到期清理(无提醒·自动恢复真实进度): 卡册临时标记移除 · 武器试玩归零回真实武器
  function syncOff(){
    try{
      if(parseInt(localStorage.getItem(TEMP_KEY) || '0', 10) <= now()){
        localStorage.removeItem(TEMP_KEY);
      }
    }catch(e){}
    try{
      var g = JSON.parse(localStorage.getItem(GEAR_KEY) || '{}') || {};
      if(g.trialUntil && g.trialUntil <= now()){
        g.trialUntil = 0; g.trialWeapon = null;
        localStorage.setItem(GEAR_KEY, JSON.stringify(g));
      }
    }catch(e){}
  }

  // hook boss 解锁等级: freepass 期内 → 20(所有 boss 可挑战); 过期 → 原真实值
  function hookBoss(){
    var P = window.HansenBossProgress;
    if(P && typeof P.getUnlockedBossLv === 'function' && !P.__fpHooked){
      var orig = P.getUnlockedBossLv;
      P.getUnlockedBossLv = function(){ if(active()) return 20; return orig.apply(this, arguments); };
      P.__fpHooked = true;
    }
    return !!(P && P.__fpHooked);
  }

  function apply(){
    var until = ensureStarted();
    if(active()){ syncOn(until); hookBoss(); }
    else { syncOff(); }
  }

  apply();
  // HansenBossProgress 可能比本模块晚加载, 重试 hook(最多约 6 秒)
  var tries = 0;
  var timer = setInterval(function(){ tries++; if(hookBoss() || tries > 40) clearInterval(timer); }, 150);
  // 回到前台重新应用(确保久置/跨页一致, 24h 到点后自动关闭)
  if(typeof document !== 'undefined'){
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) apply(); });
  }

  // 调试用: 查看剩余 / 立即结束(上线可留, 无 UI)
  window.HansenFreepass = {
    active: active,
    remainMs: function(){ return Math.max(0, getUntil() - now()); },
    _end: function(){ try{ localStorage.setItem(FP_KEY, '1'); }catch(e){} syncOff(); }
  };

  window.HansenFreepass = { active: active, until: getUntil };  //🔴v876 只读API
})();
