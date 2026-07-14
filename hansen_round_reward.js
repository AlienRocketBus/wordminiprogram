/* hansen_round_reward.js v941 — 普通岛/Land 大满贯与女帝真实终战奖励 */
(function(){
  'use strict';
  if(window.__hansenRoundRewardV941)return;
  window.__hansenRoundRewardV941=true;
  var REWARD_COIN=300,REWARD_BOOST=120,SEASON_TOTAL_GEMS=100;
  var SEASON_LEDGER='hansen_season_final_reward_v941';
  var LEGACY_PILLARS='hansen_season_pillar_gems';

  function key(){
    try{var p=(location.pathname||'').split('/').pop()||'';var m=p.match(/^island_([a-z0-9]+)\.html?$/i);return m?m[1].toLowerCase():'unknown';}catch(e){return'unknown';}
  }
  function isLand(k){return/^land[1-8]$/.test(k||'');}
  function isSeason(k){return k==='season';}
  function today(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
  function countKey(){return'hansen_boss_round_count_'+key();}
  function dayKey(){return'hansen_boss_round_gemday_'+key();}
  function count(){try{return parseInt(localStorage.getItem(countKey())||'0',10)||0;}catch(e){return 0;}}
  function setCount(n){try{localStorage.setItem(countKey(),String(Math.max(0,n|0)));}catch(e){}}
  function seasonLedger(){try{return JSON.parse(localStorage.getItem(SEASON_LEDGER)||'null');}catch(e){return null;}}
  function paidToday(){try{return isSeason(key())?!!seasonLedger():localStorage.getItem(dayKey())===today();}catch(e){return false;}}
  function total(){
    if(isSeason(key()))return 8;
    if(isLand(key())){try{return window.BOSSES&&BOSSES.length?BOSSES.length:5;}catch(e){return 5;}}
    return 20;
  }
  function gemAmount(){return isSeason(key())?SEASON_TOTAL_GEMS:88;}
  function stateNow(){try{return new Function('return typeof S!=="undefined"?S:null')();}catch(e){return window.S||null;}}
  function currentLv(){
    try{
      if((isLand(key())||isSeason(key()))&&window._s1Idx!=null)return Math.max(1,Math.min(20,(window._s1Idx|0)+1));
      if(window._hansenRebattleLv!=null)return Math.max(1,Math.min(20,window._hansenRebattleLv|0));
      var s=stateNow();return Math.max(1,Math.min(20,((s&&(s.bossCurrentLv||s.level))||1)|0));
    }catch(e){return 1;}
  }
  function landFlags(){
    var a=[];for(var i=1;i<=8;i++){try{if(localStorage.getItem('hsn_landmap_cleared_'+i)==='1')a.push(i);}catch(e){}}
    return a;
  }
  function progress(){
    var k=key();
    if(isSeason(k))return landFlags();
    if(isLand(k)){
      var n=0;try{n=parseInt(localStorage.getItem(k+'_prog')||'0',10)||0;}catch(e){}
      var a=[];for(var i=1;i<=Math.min(n,total());i++)a.push(i);return a;
    }
    try{if(typeof window.getIslandClearedLevels==='function'){var x=window.getIslandClearedLevels();if(Array.isArray(x))return x;}}catch(e){}
    try{var a2=JSON.parse(localStorage.getItem('hansen_boss_round_cleared_'+k)||'[]');return Array.isArray(a2)?a2:[];}catch(e){return[];}
  }
  function fullStandard(){
    var a=progress(),n=total();if(a.length<n)return false;
    for(var i=1;i<=n;i++)if(a.indexOf(i)<0)return false;
    return true;
  }
  function addCoin(n){try{if(n&&window.HansenCoins&&HansenCoins.add)HansenCoins.add(n);else if(n&&typeof window.addCoin==='function')window.addCoin(n);}catch(e){}}
  function addGem(n){try{if(n&&window.HansenGems&&HansenGems.add)HansenGems.add(n);}catch(e){}}
  function addBoost(n){try{if(n&&window.HansenCrystal&&HansenCrystal.grantBoost)HansenCrystal.grantBoost(n,true);}catch(e){}}

  function legacyCredit(){
    var p={};try{p=JSON.parse(localStorage.getItem(LEGACY_PILLARS)||'{}')||{};}catch(e){}
    var valid=[],all=true;for(var i=1;i<=6;i++){if(p[i]||p[String(i)])valid.push(i);else all=false;}
    return{paid:p,valid:valid,gems:all?100:valid.length*15,paidFinal:!!(p[6]||p['6'])};
  }
  function onSeasonFinal(lv){
    if(lv!==6)return{paid:false,reason:'not_final_boss'};
    var flags=landFlags();if(flags.length!==8)return{paid:false,reason:'need_8_real_land_flags',flags:flags};
    var old=seasonLedger();if(old)return{paid:false,reason:'already_paid',ledger:old};
    var legacy=legacyCredit(),gems=Math.max(0,SEASON_TOTAL_GEMS-legacy.gems);
    var coins=legacy.paidFinal?0:REWARD_COIN,boost=legacy.paidFinal?0:REWARD_BOOST;
    var ledger={version:941,paidAt:new Date().toISOString(),landFlags:flags.slice(),bossLv:lv,legacyGemCredit:legacy.gems,gemsPaid:gems,coinsPaid:coins,boostMinutes:boost};
    try{localStorage.setItem(SEASON_LEDGER,JSON.stringify(ledger));if(!seasonLedger())return{paid:false,reason:'storage_failed'};}catch(e){return{paid:false,reason:'storage_failed'};}
    addCoin(coins);addBoost(boost);addGem(gems);setCount(Math.max(1,count()));
    if(coins||boost||gems)showReward({mode:'season',title:'星海女帝终战完成！',gems:gems,coins:coins,boost:boost,sub:'8 个真实 Land 岛全部通关 + 实际击败 Lv6 女帝 · 一次性正式奖励'});
    return{paid:true,ledger:ledger};
  }
  function onStandard(){
    if(!fullStandard()||paidToday())return false;
    var ledger={date:today(),mode:isLand(key())?'land':'regular',total:total()};
    try{localStorage.setItem(dayKey(),today());localStorage.setItem(dayKey()+'_ledger',JSON.stringify(ledger));if(localStorage.getItem(dayKey())!==today())return false;}catch(e){return false;}
    addCoin(REWARD_COIN);addBoost(REWARD_BOOST);addGem(88);setCount(count()+1);
    showReward({mode:isLand(key())?'land':'regular',title:isLand(key())?('通关本岛全部 '+total()+' 关 Boss！'):'通关一轮 20 关 Boss！',gems:88,coins:REWARD_COIN,boost:REWARD_BOOST,sub:'本岛今日大满贯 · 第 '+count()+' 次结算'});
    return true;
  }
  function onWin(lv){var r=isSeason(key())?onSeasonFinal(lv):onStandard();try{if(window.HansenRoundBar)HansenRoundBar.refresh();}catch(e){}return r;}

  function showReward(o){
    try{
      var lines='';
      if(o.gems)lines+='<div style="font-size:17px;color:#e9d5ff;margin:6px">💎 <b style="font-size:24px">+'+o.gems+'</b> 钻石</div>';
      if(o.coins)lines+='<div style="font-size:15px;color:#fde047;margin:5px">🪙 +'+o.coins+' 金币</div>';
      if(o.boost)lines+='<div style="font-size:15px;color:#fde68a;margin:5px">⚡ 记忆强化 +'+o.boost+' 分钟</div>';
      var m=document.createElement('div');m.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;padding:24px';
      m.innerHTML='<div lang="zh-CN" style="background:linear-gradient(135deg,#1e3a8a,#0b1437);border:3px solid #fbbf24;border-radius:20px;padding:28px 24px;text-align:center;color:#fff;max-width:350px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 0 50px rgba(251,191,36,.45)">'
        +'<div style="font-size:66px">🏆</div><div style="font-size:21px;font-weight:900;color:#fbbf24;margin:8px">'+o.title+'</div>'+lines
        +'<div style="font-size:12.5px;color:#bfdbfe;line-height:1.6;margin:10px 0 18px">'+o.sub+'</div>'
        +'<button id="hrr941Ok" style="border:0;border-radius:12px;padding:11px 32px;background:#fbbf24;color:#111827;font-weight:900;font-size:16px">收下</button></div>';
      document.body.appendChild(m);m.querySelector('#hrr941Ok').onclick=function(){m.remove();};m.onclick=function(e){if(e.target===m)m.remove();};
    }catch(e){}
  }
  function hook(){
    if(typeof window.bossVictory!=='function'||window.bossVictory.__hrr941)return false;
    var orig=window.bossVictory;
    window.bossVictory=function(){var lv=currentLv(),r=orig.apply(this,arguments);try{onWin(lv);}catch(e){}return r;};
    window.bossVictory.__hrr941=true;return true;
  }
  hook();var tries=0,t=setInterval(function(){tries++;if(hook()||tries>50)clearInterval(t);},120);
  window.HansenRoundReward={
    progress:progress,remain:function(){var a=progress(),r=[];for(var i=1;i<=total();i++)if(a.indexOf(i)<0)r.push(i);return r;},
    count:count,islandKey:key,isSeason:function(){return isSeason(key());},gemAmount:gemAmount,gemPaidToday:paidToday,total:total,
    _win:onWin,_seasonStatus:function(){return{flags:landFlags(),ledger:seasonLedger(),legacy:legacyCredit()};},
    _reset:function(){try{localStorage.removeItem(dayKey());localStorage.removeItem(dayKey()+'_ledger');}catch(e){}}
  };
})();