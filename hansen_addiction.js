// hansen_addiction.js v942 (里程碑奖励可恢复事务)
// 上瘾度升级 5 件套:
// 1. 战力分系统 (主页顶部显示总积分, 进岛刷新)
// 2. 连续登录里程碑 (3/7/14/30/100 天 buff + 弹窗)
// 3. 每周主题挑战 (周一刷新, 主题岛 XP 翻倍)
// 4. 对比自己 (7 天前 vs 今天的成长报告)
// 5. 宝箱稀有度 (普通/稀有/史诗/传说 + 限定宠物碎片)
(function(){
  'use strict';
  
  // ─── 工具: 读取 island.html 的已知全局 ────
  // 显式访问全局词法绑定，避免 new Function/eval，便于部署严格 CSP。
  function _r(name){
    try {
      if(name === 'S') return typeof S !== 'undefined' ? S : window.S;
      if(name === 'STORAGE_KEY') return typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : window.STORAGE_KEY;
    } catch(e){}
    return window[name];
  }
  
  function today(){ var d = new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function getISOWeek(d){
    d = d || new Date();
    d = new Date(d.getTime());
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    var yearStart = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + '-W' + Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function daysAgo(n){
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  }
  
  // ─── 战力分计算 ─────────────────────────────
  // 战力分 = combo*10 + boss*50 + (各 game best 求和)*5 + streak*20 + xp 总和*0.5
  function calcPower(){
    var totalPower = 0;
    var detail = {combo:0, boss:0, gameBest:0, streak:0, xp:0};
    
    try {
      Object.keys(localStorage).forEach(function(k){
        if(!k.startsWith('wordIsland')) return;
        var s = JSON.parse(localStorage.getItem(k) || '{}');
        if(!s) return;
        
        // combo
        var maxCombo = (s.stats && s.stats.maxCombo) || 0;
        detail.combo += maxCombo * 10;
        
        // boss 击败次数
        var bossBeaten = (s.stats && s.stats.bossBeaten) || 0;
        detail.boss += bossBeaten * 50;
        
        // 各游戏 best
        var stats = s.stats || {};
        ['bubbleBest','molesBest','fishBest','speedBest','eagleBest'].forEach(function(k){
          detail.gameBest += (stats[k] || 0) * 5;
        });
        
        // streak 取最大
        if((s.streak || 0) > 0) detail.streak = Math.max(detail.streak, s.streak * 20);
        
        // xp
        detail.xp += Math.floor((s.totalXP || s.xp || 0) * 0.5);
      });
    } catch(e){}
    
    totalPower = detail.combo + detail.boss + detail.gameBest + detail.streak + detail.xp;
    return { total: totalPower, detail: detail };
  }
  
  // 战力等级
  function getPowerRank(power){
    if(power < 100) return {name:'青铜', color:'#60a5fa', emoji:'🥉'};
    if(power < 500) return {name:'白银', color:'#94a3b8', emoji:'🥈'};
    if(power < 1500) return {name:'黄金', color:'#fbbf24', emoji:'🥇'};
    if(power < 3500) return {name:'铂金', color:'#06b6d4', emoji:'💠'};
    if(power < 7000) return {name:'钻石', color:'#a855f7', emoji:'💎'};
    if(power < 15000) return {name:'大师', color:'#ec4899', emoji:'👑'};
    return {name:'王者', color:'#fbbf24', emoji:'🌟'};
  }
  
  // ─── 里程碑配置 ───────────────────────────
  // 🔴 已按新设计调整: 去掉"连签3天/7天发金币(200/500)"的金币里程碑(与每日宝箱三档冲突、会乱爆金币)。
  //   保留 14/30/100 天的真实金币、强化与 XP 权益；连签不发钻石。
  // v941 只展示并发放真实存在的权益。旧文案里的头像框/宠物皮肤没有装备实现，已删除。
  var MILESTONES = [
    {days:14,  reward:'🪙 +120 金币 · ⚡加速2小时', coin:120, boost:120},
    {days:30,  reward:'🪙 +250 金币 · ⚡加速4小时 · 双倍 XP 3 天', coin:250, boost:240, buff:'xp2x', buffDays:3},
    {days:100, reward:'🪙 +600 金币 · ⚡加速8小时', coin:600, boost:480},
  ];
  var MILESTONE_CLAIM_KEY='hansen_milestones_claimed';
  var MILESTONE_EFFECT_KEY='hansen_milestone_effects_v942';
  var MILESTONE_SEED_KEY='hansen_milestone_awards_seeded_v942';

  function readStrict(key,parser,fallback){
    try{var raw=localStorage.getItem(key);return {ok:true,value:raw===null?fallback:parser(raw)};}
    catch(e){return {ok:false,value:fallback};}
  }
  function readJsonStrict(key,fallback){return readStrict(key,function(raw){return JSON.parse(raw);},fallback);}
  function writeJsonStrict(key,value){try{var raw=JSON.stringify(value);localStorage.setItem(key,raw);return localStorage.getItem(key)===raw;}catch(e){return false;}}
  function writeTextStrict(key,value){try{value=String(value);localStorage.setItem(key,value);return localStorage.getItem(key)===value;}catch(e){return false;}}
  function milestoneByDay(days){for(var i=0;i<MILESTONES.length;i++)if(MILESTONES[i].days===days)return MILESTONES[i];return null;}
  function normalizedClaimed(value){
    if(!Array.isArray(value))return [];
    var out=[];value.forEach(function(x){x=Math.floor(+x);if(milestoneByDay(x)&&out.indexOf(x)<0)out.push(x);});return out;
  }
  function effectMap(){
    var r=readStrict(MILESTONE_EFFECT_KEY,function(raw){var o=JSON.parse(raw);if(!o||typeof o!=='object'||Array.isArray(o))throw new Error('里程碑账本结构损坏');return o;},{});
    if(!r.ok)return {ok:false,value:{}};
    return {ok:true,value:r.value};
  }
  function coinSource(m){return 'streak-milestone:'+m.days;}
  var MAX_EFFECT_TIME=8640000000000000;
  function validEffectTime(v){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>=0&&v<=MAX_EFFECT_TIME;}
  function effectTarget(createdAt,base,duration){var t=Math.max(createdAt,base)+duration;return validEffectTime(t)?t:null;}
  function currentBoost(){return readStrict('hsn_crystal_boost_until',function(v){var n=Number(v);if(!validEffectTime(n))throw new Error('加速权益损坏');return n;},0);}
  function currentXP2X(){return readStrict('hansen_xp2x_until',function(v){var n=Date.parse(v);if(!validEffectTime(n))throw new Error('双倍经验权益损坏');return n;},0);}

  function normalizeMilestoneTx(raw,m){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    if(raw.migrated===true)return {version:942,days:m.days,source:coinSource(m),migrated:true,coin:true,boost:{confirmed:true},xp2x:{confirmed:true},complete:true};
    if(raw.version!==942||+raw.days!==m.days||raw.source!==coinSource(m))return null;
    var b=raw.boost&&typeof raw.boost==='object'?raw.boost:{};
    var x=raw.xp2x&&typeof raw.xp2x==='object'?raw.xp2x:{};
    var createdAt=raw.createdAt,boostMinutes=m.boost||0,xpDays=m.buff==='xp2x'?(m.buffDays||1):0;
    if(!validEffectTime(createdAt)||createdAt<=0||!validEffectTime(b.base)||!validEffectTime(x.base))return null;
    var bt=boostMinutes?effectTarget(createdAt,b.base,boostMinutes*60000):0,xt=xpDays?effectTarget(createdAt,x.base,xpDays*86400000):0;
    if(b.minutes!==boostMinutes||x.days!==xpDays||b.target!==bt||x.target!==xt||bt===null||xt===null)return null;
    return {version:942,days:m.days,source:coinSource(m),createdAt:createdAt,coin:raw.coin===true,
      boost:{minutes:boostMinutes,base:b.base,target:b.target,confirmed:b.confirmed===true},
      xp2x:{days:xpDays,base:x.base,target:x.target,confirmed:x.confirmed===true},complete:raw.complete===true};
  }
  function milestoneCarry(raw,m){
    var out={coin:false,boostConfirmed:!m.boost,xpConfirmed:m.buff!=='xp2x',complete:false};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
    var current=raw.version===942&&+raw.days===m.days&&raw.source===coinSource(m),legacy=Object.prototype.hasOwnProperty.call(raw,'boostUntil')||Object.prototype.hasOwnProperty.call(raw,'xpUntil');
    if(!current&&!legacy)return out;
    out.coin=raw.coin===true;out.boostConfirmed=out.boostConfirmed||(current&&raw.boost&&raw.boost.confirmed===true)||(legacy&&raw.boostConfirmed===true);
    out.xpConfirmed=out.xpConfirmed||(current&&raw.xp2x&&raw.xp2x.confirmed===true)||(legacy&&raw.xpConfirmed===true);
    out.complete=raw.complete===true&&out.boostConfirmed&&out.xpConfirmed;return out;
  }

  function ensureMilestoneTx(map,m){
    var raw=map[m.days],existing=normalizeMilestoneTx(raw,m);
    if(existing){map[m.days]=existing;return existing;}
    var b=currentBoost(),x=currentXP2X();if(!b.ok||!x.ok)return null;
    var now=Date.now(),boostMinutes=m.boost||0,xpDays=m.buff==='xp2x'?(m.buffDays||1):0,bt=boostMinutes?effectTarget(now,b.value,boostMinutes*60000):0,xt=xpDays?effectTarget(now,x.value,xpDays*86400000):0,carry=milestoneCarry(raw,m);
    if(!validEffectTime(now)||now<=0||bt===null||xt===null)return null;
    var tx={version:942,days:m.days,source:coinSource(m),createdAt:now,coin:carry.coin,
      boost:{minutes:boostMinutes,base:b.value,target:bt,confirmed:carry.boostConfirmed},
      xp2x:{days:xpDays,base:x.value,target:xt,confirmed:carry.xpConfirmed},complete:carry.complete};
    map[m.days]=tx;
    if(!writeJsonStrict(MILESTONE_EFFECT_KEY,map)){if(raw===undefined)delete map[m.days];else map[m.days]=raw;return null;}
    return tx;
  }
  function saveMilestoneTx(map,tx){map[tx.days]=tx;return writeJsonStrict(MILESTONE_EFFECT_KEY,map);}
  function confirmBoost(map,tx){
    if(tx.boost.confirmed)return true;
    var cur=currentBoost();if(!cur.ok)return false;
    if(cur.value===tx.boost.base){if(!writeTextStrict('hsn_crystal_boost_until',tx.boost.target))return false;}
    else if(cur.value!==tx.boost.target)return false;
    cur=currentBoost();if(!cur.ok||cur.value!==tx.boost.target)return false;
    tx.boost.confirmed=true;return saveMilestoneTx(map,tx);
  }
  function confirmXP2X(map,tx){
    if(tx.xp2x.confirmed)return true;
    var cur=currentXP2X();if(!cur.ok)return false;
    var iso=new Date(tx.xp2x.target).toISOString();
    if(cur.value===tx.xp2x.base){if(!writeTextStrict('hansen_xp2x_until',iso))return false;}
    else if(cur.value!==tx.xp2x.target)return false;
    cur=currentXP2X();if(!cur.ok||cur.value!==tx.xp2x.target)return false;
    tx.xp2x.confirmed=true;return saveMilestoneTx(map,tx);
  }
  function seedClaimedMilestones(claimed,map){
    var ids=claimed.map(function(d){return coinSource(milestoneByDay(d));});
    try{
      if(ids.length&&window.HansenCoins&&typeof HansenCoins.seedAwards==='function'&&HansenCoins.seedAwards(ids)!==true)return false;
    }catch(e){return false;}
    var changed=false;claimed.forEach(function(d){if(!map[d]){map[d]={version:942,days:d,source:coinSource(milestoneByDay(d)),migrated:true,coin:true,boost:{confirmed:true},xp2x:{confirmed:true},complete:true};changed=true;}});
    if(changed&&!writeJsonStrict(MILESTONE_EFFECT_KEY,map))return false;
    return writeTextStrict(MILESTONE_SEED_KEY,'1');
  }

  function currentGlobalStreak(){
    try{ if(window.HansenCheckin&&HansenCheckin.getStreak) return HansenCheckin.getStreak(); }catch(e){}
    try{ var n=parseInt(localStorage.getItem('hansen_checkin_streak')||'0',10); if(isFinite(n)&&n>0)return n; }catch(e){}
    var s=_r('S'); return s&&isFinite(s.streak)?Math.max(0,s.streak|0):0;
  }
  
  function checkMilestones(){
    try {
      var S = _r('S');
      if(!S) return false;
      var streak = currentGlobalStreak();
      var cr=readJsonStrict(MILESTONE_CLAIM_KEY,[]),er=effectMap();if(!cr.ok||!er.ok)return false;
      var claimed=normalizedClaimed(cr.value),map=er.value;
      var seeded=readStrict(MILESTONE_SEED_KEY,function(v){return v;},'');if(!seeded.ok)return false;
      if(seeded.value!=='1'&&!seedClaimedMilestones(claimed,map))return false;
      for(var i=0;i<MILESTONES.length;i++){
        var m=MILESTONES[i];if(streak<m.days||claimed.indexOf(m.days)>=0)continue;
        var tx=ensureMilestoneTx(map,m);if(!tx)return false;
        if(!tx.coin){
          if(!window.HansenCoins||typeof HansenCoins.award!=='function'||HansenCoins.award(tx.source,m.coin||0)!==true)return false;
          tx.coin=true;if(!saveMilestoneTx(map,tx))return false;
        }
        if(!confirmBoost(map,tx)||!confirmXP2X(map,tx))return false;
        if(!tx.complete){tx.complete=true;if(!saveMilestoneTx(map,tx))return false;}
        var next=claimed.concat([m.days]);if(!writeJsonStrict(MILESTONE_CLAIM_KEY,next))return false;
        claimed=next;showMilestoneDialog(m);
      }
      return true;
    } catch(e){ try{console.error(e);}catch(_e){} return false; }
  }
  
  function showMilestoneDialog(m){
    // 🔴 BUG #11 修复 (v231): 原 onclick="this.closest('div[style*=inset\\:0\\;]').remove()" 用 CSS 属性选择器
    // 字符串匹配父元素 style. 浏览器会自动重写 inline style (inset:0 → inset: 0px), 选择器失配, null.remove()
    // 静默报错, "收下" 按钮点了没反应, 玩家被卡死. 修复方式: 用闭包持有 mask 引用直接 remove, 不靠任何字符串匹配.
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:30px;animation:hanFade .3s';
    mask.innerHTML = '<div style="background:linear-gradient(135deg,#7c3aed,#1e1b4b);border:3px solid #fbbf24;border-radius:20px;padding:30px;text-align:center;color:#fff;max-width:320px;box-shadow:0 0 60px rgba(251,191,36,.6)">' +
      '<div style="font-size:80px;margin-bottom:14px;animation:hanBounce 1s ease infinite">🎉</div>' +
      '<div style="font-size:20px;font-weight:900;color:#fbbf24;margin-bottom:10px">连续 ' + m.days + ' 天里程碑!</div>' +
      '<div style="font-size:16px;color:#fde047;margin-bottom:20px;line-height:1.6">' + m.reward + '</div>' +
      '<button id="hanMilestoneClaim" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;border:0;padding:12px 32px;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer">收下!</button>' +
    '</div>';
    document.body.appendChild(mask);

    // 🛡️ 三重保险, 永远关得掉
    // 1) 主关法: 闭包持有 mask 引用, 直接 remove (最稳)
    var btn = mask.querySelector('#hanMilestoneClaim');
    if(btn){
      btn.addEventListener('click', function(){
        try { mask.remove(); } catch(e){}
      });
    }
    // 2) 兜底 1: 点击遮罩空白也能关 (0.5s 后才生效, 避免误触)
    setTimeout(function(){
      mask.addEventListener('click', function(e){
        if(e.target === mask){ try { mask.remove(); } catch(e2){} }
      });
    }, 500);
    // 3) 兜底 2: ESC 键关闭 (PC 用户)
    var escHandler = function(e){
      if(e.key === 'Escape' || e.keyCode === 27){
        try { mask.remove(); } catch(e2){}
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // 动画 + 音效
    try { if(window.playLevelUp) window.playLevelUp(); } catch(e){}
  }
  
  function getXP2XActive(){
    try {
      var until = localStorage.getItem('hansen_xp2x_until');
      if(!until) return false;
      return new Date(until) > new Date();
    } catch(e){ return false; }
  }
  
  // ─── 每周主题 ─────────────────────────────
  // 18 岛轮流当主题岛
  var WEEKLY_THEMES = [
    {key:'wordIslandFood', name:'美食周', emoji:'🍔', short:'food'},
    {key:'wordIslandAnimal', name:'动物周', emoji:'🐾', short:'animal'},
    {key:'wordIslandColorNum', name:'颜色数字周', emoji:'🎨', short:'colornum'},
    {key:'wordIslandPeople', name:'职业周', emoji:'💼', short:'job'},
    {key:'wordIslandSports', name:'运动周', emoji:'🏆', short:'sports'},
    {key:'wordIslandFamily', name:'家庭周', emoji:'👨‍👩‍👧', short:'family'},
    {key:'wordIslandSchool', name:'学校周', emoji:'🎒', short:'school'},
    {key:'wordIslandHouse', name:'家居周', emoji:'🏠', short:'home'},
    {key:'wordIslandClothes', name:'衣物周', emoji:'👕', short:'clothes'},
    {key:'wordIslandNature', name:'自然周', emoji:'🌳', short:'nature'},
    {key:'wordIslandTransport', name:'交通周', emoji:'🚗', short:'transport'},
    {key:'wordIslandTime', name:'时间周', emoji:'⏰', short:'time'},
    {key:'wordIslandBody', name:'身体周', emoji:'💪', short:'body'},
    {key:'wordIslandPronouns', name:'疑问词周', emoji:'❓', short:'question'},
    {key:'wordIslandVerbs', name:'动作周', emoji:'🏃', short:'action'},
    {key:'wordIslandAdj', name:'形容词周', emoji:'✨', short:'adjective'},
    {key:'wordIslandCity', name:'城市周', emoji:'🏙️', short:'city'},
    {key:'wordIslandMisc', name:'宝藏周', emoji:'🗺️', short:'treasure'},
  ];
  
  function getCurrentTheme(){
    // 按 ISO 周数取模, 保证全球同步
    var d = new Date();
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNo = Math.floor((d - yearStart) / (7 * 86400000));
    return WEEKLY_THEMES[weekNo % WEEKLY_THEMES.length];
  }
  
  function isCurrentThemeIsland(){
    try {
      var theme = getCurrentTheme();
      var sk = _r('STORAGE_KEY');
      return sk === theme.key;
    } catch(e){ return false; }
  }
  
  function getWeeklyProgress(){
    try {
      var weekKey = getISOWeek();
      var k = 'hansen_weekly_' + weekKey;
      return JSON.parse(localStorage.getItem(k) || '{"correct":0,"goal":50}');
    } catch(e){ return {correct:0, goal:50}; }
  }
  
  function recordWeeklyProgress(){
    try {
      var weekKey = getISOWeek();
      var k = 'hansen_weekly_' + weekKey;
      var p = JSON.parse(localStorage.getItem(k) || '{"correct":0,"goal":50}');
      p.correct = (p.correct || 0) + 1;
      localStorage.setItem(k, JSON.stringify(p));
      // 🔴 已停用: 旧"每周挑战完成+100金币"(与新设计不符、且文字误写成💎钻石、会乱给金币)。
      //   新设计中"每周挑战"不发金币。只保留进度记录(供展示用), 不再发奖、不再弹提示。
    } catch(e){}
  }
  
  // ─── 历史快照 (用于对比自己) ─────────────────
  function snapshotToday(){
    try {
      var P = calcPower();
      var d = today();
      var key = 'hansen_snapshot_' + d;
      if(!localStorage.getItem(key)){
        var S = _r('S') || {};
        var snap = {
          date: d,
          power: P.total,
          xp: S.totalXP || S.xp || 0,
          streak: S.streak || 0,
          learned: (S.learned || []).length,
        };
        localStorage.setItem(key, JSON.stringify(snap));
      }
    } catch(e){}
    // 清理 30 天前的快照
    try {
      var thirtyAgo = daysAgo(30);
      Object.keys(localStorage).forEach(function(k){
        if(k.startsWith('hansen_snapshot_') && k.slice(-10) < thirtyAgo){
          localStorage.removeItem(k);
        }
      });
    } catch(e){}
  }
  
  function getCompareData(){
    var sevenAgo = daysAgo(7);
    try {
      var oldSnap = JSON.parse(localStorage.getItem('hansen_snapshot_' + sevenAgo) || 'null');
      if(!oldSnap){
        // 找最早的可用快照
        var earliest = null;
        for(var i = 7; i < 30; i++){
          var d = daysAgo(i);
          var s = localStorage.getItem('hansen_snapshot_' + d);
          if(s){
            try {
              earliest = JSON.parse(s);
              break;
            } catch(e){}
          }
        }
        if(!earliest) return null;
        oldSnap = earliest;
      }
      var nowP = calcPower();
      var S = _r('S') || {};
      return {
        old: oldSnap,
        now: {
          power: nowP.total,
          xp: S.totalXP || S.xp || 0,
          streak: S.streak || 0,
          learned: (S.learned || []).length,
        },
      };
    } catch(e){ return null; }
  }
  
  // ─── UI: 主页注入战力分 ─────────────────────
  function injectHomeUI(){
    // 🔴 v574: Hansen 验收反馈"总战力/王者段位/里程碑/本周挑战这块没用, 全砍掉"。
    //   战力卡(#hanPowerCard)不再注入; 同时清除可能由旧版本残留在页面/缓存渲染中的卡片。
    //   注意: 仅停止"显示", 不删除 calcPower/getCurrentTheme/getXP2XActive 等函数——
    //   XP 翻倍 buff(addXP ×2)、每周主题加成、签到里程碑弹窗仍在别处正常工作, 删函数会连环断裂。
    try {
      var stale = document.getElementById('hanPowerCard');
      if(stale && stale.parentNode) stale.parentNode.removeChild(stale);
    } catch(e){}
    return;
  }

  // ─── 战力详情弹窗 ────────────────────────
  function showDetail(){
    var P = calcPower();
    var rank = getPowerRank(P.total);
    var cd = getCompareData();
    var streak = (_r('S') || {}).streak || 0;
    
    var compareSection = '';
    if(cd){
      compareSection = 
        '<div style="background:rgba(34,197,94,.15);border:1px solid #22c55e;border-radius:10px;padding:12px;margin-top:14px">' +
          '<div style="font-size:13px;font-weight:900;color:#22c55e;margin-bottom:8px">📈 与 7 天前对比</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">' +
            '<div style="color:#94a3b8">总战力: <b style="color:#fff">' + cd.old.power + '</b> → <b style="color:#22c55e">' + cd.now.power + '</b> <span style="color:#22c55e">+' + (cd.now.power - cd.old.power) + '</span></div>' +
            '<div style="color:#94a3b8">XP: <b style="color:#fff">' + cd.old.xp + '</b> → <b style="color:#22c55e">' + cd.now.xp + '</b></div>' +
            '<div style="color:#94a3b8">学过词: <b style="color:#fff">' + cd.old.learned + '</b> → <b style="color:#22c55e">' + cd.now.learned + '</b></div>' +
            '<div style="color:#94a3b8">连续: <b style="color:#fff">' + cd.old.streak + '</b> → <b style="color:#22c55e">' + cd.now.streak + ' 天</b></div>' +
          '</div>' +
        '</div>';
    } else {
      compareSection = '<div style="background:rgba(99,102,241,.15);border:1px solid #6366f1;border-radius:10px;padding:12px;margin-top:14px;font-size:12px;color:#a5b4fc;text-align:center">📊 持续学习 7 天后, 这里会显示你的成长对比</div>';
    }
    
    var milestoneRows = MILESTONES.map(function(m){
      var ok = streak >= m.days;
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">' +
        '<div style="font-size:18px;width:32px">' + (ok ? '✅' : '🔒') + '</div>' +
        '<div style="flex:1">' +
          '<div style="font-size:13px;font-weight:700;color:' + (ok ? '#22c55e' : '#94a3b8') + '">连续 ' + m.days + ' 天</div>' +
          '<div style="font-size:11px;color:#94a3b8">' + m.reward + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    
    var mask = document.createElement('div');
    mask.className = 'hansen-rank-modal';
    mask.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
    mask.onclick = function(e){ if(e.target === mask) mask.remove(); };
    
    mask.innerHTML = 
      '<div style="background:linear-gradient(135deg,#1e1b4b,#0f172a);border:2px solid ' + rank.color + ';border-radius:18px;padding:24px;max-width:340px;width:100%;color:#fff;max-height:90vh;overflow-y:auto">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<div style="font-size:18px;font-weight:900;color:' + rank.color + '">' + rank.emoji + ' ' + rank.name + ' 段位</div>' +
          '<button id="hanRankClose" style="background:rgba(255,255,255,.1);border:0;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>' +
        '</div>' +
        '<div style="font-size:34px;font-weight:900;color:' + rank.color + ';text-align:center;margin-bottom:14px;font-family:Arial Black,sans-serif">' + P.total.toLocaleString() + '</div>' +
        '<div style="background:rgba(255,255,255,.05);border-radius:10px;padding:12px;font-size:12px;line-height:1.8">' +
          '<div style="color:#fbbf24;font-weight:900;margin-bottom:6px">战力构成</div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">⚡ 连击 ×10</span><b>' + P.detail.combo + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">⚔️ Boss ×50</span><b>' + P.detail.boss + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">🎮 各游戏 best ×5</span><b>' + P.detail.gameBest + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">🔥 连续天数 ×20</span><b>' + P.detail.streak + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">⭐ XP 总和 ÷2</span><b>' + P.detail.xp + '</b></div>' +
        '</div>' +
        compareSection +
        '<div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.4);border-radius:10px;padding:12px;margin-top:14px">' +
          '<div style="font-size:13px;font-weight:900;color:#a5b4fc;margin-bottom:8px">🏆 里程碑 (连续登录)</div>' +
          milestoneRows +
        '</div>' +
      '</div>';
    
    document.body.appendChild(mask);
    // 🛡️ v235: 排行榜✕按钮改用闭包绑定, 不靠 closest 字符串选择器 (BUG #11 同款防护)
    var rankCloseBtn = mask.querySelector('#hanRankClose');
    if(rankCloseBtn){
      rankCloseBtn.addEventListener('click', function(){ try{ mask.remove(); }catch(e){} });
    }
    // ESC 兜底
    var rankEsc = function(e){
      if(e.key === 'Escape' || e.keyCode === 27){
        try{ mask.remove(); }catch(e2){}
        document.removeEventListener('keydown', rankEsc);
      }
    };
    document.addEventListener('keydown', rankEsc);
  }
  
  // ─── 宝箱稀有度增强 ──────────────────────
  var CHEST_EXTRA_KEY='hansen_addiction_chest_effects_v942';
  var CHEST_RARITY={
    common:{name:'普通',color:'#94a3b8',emoji:'⚪',glow:'rgba(148,163,184,.3)',extraCoin:0,petPiece:0},
    rare:{name:'稀有',color:'#3b82f6',emoji:'🔵',glow:'rgba(59,130,246,.5)',extraCoin:5,petPiece:0},
    epic:{name:'史诗',color:'#a855f7',emoji:'🟣',glow:'rgba(168,85,247,.6)',extraCoin:15,petPiece:0},
    legendary:{name:'传说',color:'#fbbf24',emoji:'🟡',glow:'rgba(251,191,36,.8)',extraCoin:50,petPiece:1}
  };
  function legacyRarityRoll(txid){
    var h=2166136261,s=String(txid||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;
  }
  function validRarityRoll(v){return typeof v==='number'&&isFinite(v)&&v>=0&&v<1;}
  function checkinReceipt(value){
    if(value&&value.receipt)value=value.receipt;
    if(!value||typeof value!=='object'||(value.ok!==true&&value.committed!==true))return null;
    var day=String(value.day||''),txid=String(value.txid||'');
    if(!/^\d{4}-\d{1,2}-\d{1,2}$/.test(day)||txid!=='checkin:'+day)return null;
    var hasRoll=Object.prototype.hasOwnProperty.call(value,'rarityRoll');
    // 有字段就必须严格是 [0,1) 有限数，绝不把伪造/NaN/越界值降级成 fallback。
    if(hasRoll&&!validRarityRoll(value.rarityRoll))return null;
    return {ok:true,day:day,txid:txid,rarityRoll:hasRoll?value.rarityRoll:legacyRarityRoll(txid),legacyRarityRoll:!hasRoll};
  }
  function officialCheckinReceipt(value){
    var requested=checkinReceipt(value);if(!requested||!window.HansenCheckin||typeof HansenCheckin.getReceipt!=='function')return null;
    try{
      var official=checkinReceipt(HansenCheckin.getReceipt(requested.day));
      if(!official||official.day!==requested.day||official.txid!==requested.txid||official.rarityRoll!==requested.rarityRoll)return null;
      return official;
    }catch(e){return null;}
  }
  /* 稀有度只读首次签到 receipt 已持久的 rarityRoll：70% 普通 / 20% 稀有 /
     8% 史诗 / 2% 传说。传入旧 txid 字符串仅用于兼容旧无 roll receipt。 */
  function chestRarity(value){
    var r=typeof value==='number'?value:(value&&typeof value==='object'?value.rarityRoll:legacyRarityRoll(value));
    if(!validRarityRoll(r))return null;
    return r<0.02?'legendary':(r<0.10?'epic':(r<0.30?'rare':'common'));
  }
  function chestLedger(){var r=readJsonStrict(CHEST_EXTRA_KEY,{});return r.ok&&r.value&&typeof r.value==='object'&&!Array.isArray(r.value)?{ok:true,value:r.value}:{ok:false,value:{}};}
  function readPieces(){return readStrict('hansen_pet_pieces',function(v){if(!/^(0|[1-9]\d*)$/.test(String(v)))throw new Error('宠物碎片余额损坏');var n=Number(v);if(!isFinite(n)||Math.floor(n)!==n||n<0||n>1000000000)throw new Error('宠物碎片余额越界');return n;},0);}
  function chestSource(txid,suffix){return 'addiction:rare:'+txid+':'+suffix;}
  function normalizeChestTx(raw,receipt){
    if(!raw||typeof raw!=='object'||raw.version!==942||raw.txid!==receipt.txid||raw.day!==receipt.day)return null;
    if(Object.prototype.hasOwnProperty.call(raw,'rarityRoll')&&(!validRarityRoll(raw.rarityRoll)||raw.rarityRoll!==receipt.rarityRoll))return null;
    var rarity=chestRarity(receipt.rarityRoll),rc=CHEST_RARITY[rarity],pet=raw.pet&&typeof raw.pet==='object'?raw.pet:{};if(!rc)return null;
    var amount=rc.petPiece,base,target=pet.target;
    if(typeof target!=='number'||!isFinite(target)||Math.floor(target)!==target||target<amount||target>1000000000||pet.amount!==amount||pet.source!==chestSource(receipt.txid,'pet'))return null;
    if(Object.prototype.hasOwnProperty.call(pet,'base'))base=pet.base;else base=target-amount; // 兼容已有 v942 tx；恢复仍要求当前余额精确命中 base/target。
    if(typeof base!=='number'||!isFinite(base)||Math.floor(base)!==base||base<0||base>1000000000-amount||target!==base+amount)return null;
    return {version:942,txid:receipt.txid,day:receipt.day,rarityRoll:receipt.rarityRoll,rarity:rarity,coinConfirmed:raw.coinConfirmed===true,
      pet:{source:chestSource(receipt.txid,'pet'),amount:amount,base:base,target:target,confirmed:pet.confirmed===true},complete:raw.complete===true};
  }
  function ensureChestTx(map,receipt){
    var has=Object.prototype.hasOwnProperty.call(map,receipt.txid),tx=normalizeChestTx(map[receipt.txid],receipt);if(tx){map[receipt.txid]=tx;return tx;}if(has)return null;
    var rarity=chestRarity(receipt.rarityRoll),rc=CHEST_RARITY[rarity],pieces=readPieces();if(!rc||!pieces.ok)return null;
    if(pieces.value>1000000000-rc.petPiece)return null;
    tx={version:942,txid:receipt.txid,day:receipt.day,rarityRoll:receipt.rarityRoll,rarity:rarity,coinConfirmed:rc.extraCoin===0,
      pet:{source:chestSource(receipt.txid,'pet'),amount:rc.petPiece,base:pieces.value,target:pieces.value+rc.petPiece,confirmed:rc.petPiece===0},complete:false};
    map[receipt.txid]=tx;if(!writeJsonStrict(CHEST_EXTRA_KEY,map)){delete map[receipt.txid];return null;}return tx;
  }
  function saveChestTx(map,tx){map[tx.txid]=tx;return writeJsonStrict(CHEST_EXTRA_KEY,map);}
  function settleChestReceipt(value){
    var receipt=officialCheckinReceipt(value);if(!receipt)return false;
    var lr=chestLedger();if(!lr.ok)return false;var map=lr.value,tx=ensureChestTx(map,receipt);if(!tx)return false;
    var rc=CHEST_RARITY[tx.rarity];
    if(!tx.coinConfirmed){
      try{if(!window.HansenCoins||typeof HansenCoins.award!=='function'||HansenCoins.award(chestSource(tx.txid,'coins'),rc.extraCoin)!==true)return false;}catch(e){return false;}
      tx.coinConfirmed=true;if(!saveChestTx(map,tx))return false;
    }
    if(!tx.pet.confirmed){
      var p=readPieces();if(!p.ok)return false;
      if(p.value===tx.pet.base){if(!writeTextStrict('hansen_pet_pieces',tx.pet.target))return false;}
      else if(p.value!==tx.pet.target)return false;
      p=readPieces();if(!p.ok||p.value!==tx.pet.target)return false;
      tx.pet.confirmed=true;if(!saveChestTx(map,tx))return false;
    }
    if(!tx.complete){tx.complete=true;if(!saveChestTx(map,tx))return false;}
    return true;
  }
  function recoverChestExtras(){
    var ok=true,lr=chestLedger();if(!lr.ok)return false;
    Object.keys(lr.value).forEach(function(k){
      var raw=lr.value[k];if(!raw||raw.complete===true)return;
      var probe={ok:true,day:raw.day,txid:raw.txid};if(Object.prototype.hasOwnProperty.call(raw,'rarityRoll'))probe.rarityRoll=raw.rarityRoll;
      var receipt=officialCheckinReceipt(probe);if(!receipt||receipt.txid!==k||settleChestReceipt(receipt)!==true)ok=false;
    });
    /* 覆盖“签到已提交，但 addiction ledger 第一次写入就失败”的断点。 */
    try{
      if(window.HansenCheckin&&typeof HansenCheckin.getReceipt==='function'){
        var receipt=checkinReceipt(HansenCheckin.getReceipt());if(receipt&&settleChestReceipt(receipt)!==true)ok=false;
      }
    }catch(e){ok=false;}
    return ok;
  }
  function showChestRarityBanner(rc){
    setTimeout(function(){
      try {
        var c=document.getElementById('chestContent');if(!c)return;
        var banner=document.createElement('div');
        banner.style.cssText='background:linear-gradient(135deg,'+rc.color+',rgba(0,0,0,.3));border:2px solid '+rc.color+';border-radius:12px;padding:10px;margin-bottom:14px;text-align:center;box-shadow:0 0 30px '+rc.glow+';animation:hanPulse 1.5s ease-in-out infinite';
        var pieceText=rc.petPiece?'<div style="font-size:11px;color:#fde047;margin-top:4px">🐾 +1 限定宠物碎片!</div>':'';
        var extraText=rc.extraCoin?'<div style="font-size:11px;color:#fff;margin-top:2px">额外 +'+rc.extraCoin+' 🪙</div>':'';
        banner.innerHTML='<div style="font-size:30px;margin-bottom:4px">'+rc.emoji+'</div><div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:2px">'+rc.name+' 宝箱!</div>'+extraText+pieceText;
        c.insertBefore(banner,c.firstChild);
      }catch(e){try{console.error(e);}catch(_e){}}
    },800);
  }
  // 用 monkey patch 包装原 doOpenChest
  function patchChest(){
    if(typeof window.doOpenChest === 'undefined') return false;
    if(window.__hansenChestPatched) return true;
    window.__hansenChestPatched = true;
    
    var origDoOpenChest = window.doOpenChest;
    
    window.doOpenChest = function(){
      // 是否可领完全服从正式签到事务的 receipt；不能在调用前自行猜测成功。
      var result=origDoOpenChest.apply(this,arguments);
      var receipt=result&&result.ok===true?officialCheckinReceipt(result):null;
      if(!receipt){
        /* 重复调用可携带历史 receipt 供 cleanup，但 ok:false 绝不触发本次 UI/新奖励。 */
        try{if(result&&result.receipt)settleChestReceipt(result.receipt);}catch(e){}
        return result;
      }
      var rarity=chestRarity(receipt.rarityRoll),rc=CHEST_RARITY[rarity];window._hansenChestRarity=rarity;
      if(settleChestReceipt(receipt))showChestRarityBanner(rc);
      return result;
    };
    return true;
  }
  
  // ─── 追加 addXP 翻倍 (本周主题 + xp2x buff) ──
  function patchAddXP(){
    if(typeof window.addXP === 'undefined') return false;
    if(window.__hansenAddXPPatched) return true;
    window.__hansenAddXPPatched = true;
    
    var origAddXP = window.addXP;
    window.addXP = function(amount){
      var mult = 1;
      if(isCurrentThemeIsland()) mult *= 2;
      if(getXP2XActive()) mult *= 2;
      // 上限 4x (避免叠太多)
      if(mult > 4) mult = 4;
      return origAddXP(Math.floor(amount * mult));
    };
    return true;
  }
  
  // ─── 主动记录每周进度 (通过包装 markAnswer) ──
  function patchMarkAnswer(){
    if(typeof window.markAnswer === 'undefined') return false;
    if(window.__hansenMarkAnswerPatched) return true;
    window.__hansenMarkAnswerPatched = true;
    
    var origMarkAnswer = window.markAnswer;
    window.markAnswer = function(idx, correct){
      var result = origMarkAnswer.apply(this, arguments);
      if(correct && isCurrentThemeIsland()){
        recordWeeklyProgress();
      }
      return result;
    };
    return true;
  }
  
  // ─── 注入 CSS 动画 ────────────────────────
  function injectCSS(){
    if(document.getElementById('hanAddictCSS')) return;
    var s = document.createElement('style');
    s.id = 'hanAddictCSS';
    s.textContent = '@keyframes hanFade{from{opacity:0}to{opacity:1}}' +
      '@keyframes hanBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
      '@keyframes hanGlow{0%,100%{box-shadow:0 0 8px rgba(245,158,11,.6)}50%{box-shadow:0 0 16px rgba(245,158,11,1)}}' +
      '@keyframes hanPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}';
    document.head.appendChild(s);
  }
  
  // ─── 主初始化 ────────────────────────────
  function init(){
    var S = _r('S');
    if(typeof S === 'undefined' || S === null){
      setTimeout(init, 100);
      return;
    }
    
    injectCSS();
    snapshotToday();
    checkMilestones();
    // 全局签到模块在本脚本之后加载；再对账一次，避免读到某岛旧 streak。
    setTimeout(checkMilestones, 700);
    
    // 主页 UI 注入
    injectHomeUI();
    
    // 各种 patch
    setTimeout(function(){
      patchChest();
      recoverChestExtras();
      patchAddXP();
      patchMarkAnswer();
    }, 300);
    
    // 暴露 API
    window.HansenAddiction = {
      showDetail: showDetail,
      calcPower: calcPower,
      getCurrentTheme: getCurrentTheme,
      getCompareData: getCompareData,
      MILESTONES: MILESTONES,
      checkMilestones: checkMilestones,
      _test:{effectMap:effectMap,ensureMilestoneTx:ensureMilestoneTx,normalizedClaimed:normalizedClaimed,
        patchChest:patchChest,checkinReceipt:checkinReceipt,chestRarity:chestRarity,settleChestReceipt:settleChestReceipt,recoverChestExtras:recoverChestExtras}
    };
    
    console.log('%c[HansenAddiction]%c v942 加载: 战力分 + 可恢复里程碑 + 每周主题 + 对比自己 + 宝箱稀有度',
                'color:#ec4899;font-weight:bold', 'color:#94a3b8');
  }
  
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
