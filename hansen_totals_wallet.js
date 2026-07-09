// hansen_totals_wallet.js — 全局学习汇总钱包
// ============================================================
// 背景: 每个岛把"学会的词"存在自己的 S.learned(各岛存档key不同)。
//   成就判定(学会100词等)只读当前岛, 导致跨岛累计型成就进度偏慢/到不了。
//   本钱包让每个岛【上报】自己的学习数据, 汇总时把18个岛加起来。
//
// 存什么(全局, key=hansen_wallet_totals):
//   perIsland: { 岛key: {learned:N, maxCombo:N, level:N} }  — 每个岛上报自己的最新数据
//   汇总时: learned = 各岛learned之和(各岛单词不同, 直接相加无重复);
//           maxCombo = 各岛最高连胜的最大值; level = 各岛最高等级。
//
// 零侵入独立文件。各岛在 markAnswer / 加载时调 HansenTotals.report(岛key, {...})。
// ============================================================
(function(){
  if(window.__hansenTotalsLoaded){ return; } window.__hansenTotalsLoaded = true;

  var KEY = 'hansen_wallet_totals';

  function _read(){
    try{
      var raw=localStorage.getItem(KEY);
      if(!raw) return {perIsland:{}};
      var o=JSON.parse(raw);
      if(!o.perIsland||typeof o.perIsland!=='object') o.perIsland={};
      return o;
    }catch(e){ return {perIsland:{}}; }
  }
  function _write(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }

  window.HansenTotals = {
    // 某个岛上报自己的最新数据
    report: function(islandKey, data){
      if(!islandKey) return;
      var o=_read();
      var prev=o.perIsland[islandKey]||{};
      o.perIsland[islandKey]={
        learned: Math.max(prev.learned||0, (data&&data.learned)||0),  // 学会词数(取最大, 防回退)
        maxCombo: Math.max(prev.maxCombo||0, (data&&data.maxCombo)||0),
        level: Math.max(prev.level||0, (data&&data.level)||0)
      };
      _write(o);
    },
    // 汇总: 18岛学会的词加起来
    totalLearned: function(){
      var o=_read(), sum=0;
      Object.keys(o.perIsland).forEach(function(k){ sum += (o.perIsland[k].learned||0); });
      return sum;
    },
    // 汇总: 最高连胜(各岛最大值)
    maxCombo: function(){
      var o=_read(), mx=0;
      Object.keys(o.perIsland).forEach(function(k){ if((o.perIsland[k].maxCombo||0)>mx) mx=o.perIsland[k].maxCombo; });
      return mx;
    },
    // 汇总: 最高等级(各岛最大值)
    maxLevel: function(){
      var o=_read(), mx=0;
      Object.keys(o.perIsland).forEach(function(k){ if((o.perIsland[k].level||0)>mx) mx=o.perIsland[k].level; });
      return mx;
    },
    // 玩过的岛数量(上报过的)
    islandCount: function(){ return Object.keys(_read().perIsland).length; },
    // 调试: 看各岛数据
    _dump: function(){ return _read().perIsland; }
  };
})();
