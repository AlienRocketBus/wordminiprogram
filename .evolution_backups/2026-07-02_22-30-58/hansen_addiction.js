// hansen_addiction.js v143i (王者段位弹窗叉号修复)
// 上瘾度升级 5 件套:
// 1. 战力分系统 (主页顶部显示总积分, 进岛刷新)
// 2. 连续登录里程碑 (3/7/14/30/100 天 buff + 弹窗)
// 3. 每周主题挑战 (周一刷新, 主题岛 XP 翻倍)
// 4. 对比自己 (7 天前 vs 今天的成长报告)
// 5. 宝箱稀有度 (普通/稀有/史诗/传说 + 限定宠物碎片)
(function(){
  'use strict';
  
  // ─── 工具: 跨闭包读取 island.html 的 let 全局 ────
  function _r(name){ 
    try { 
      var v = new Function('return typeof '+name+' !== "undefined" ? '+name+' : undefined')();
      if(v !== undefined) return v;
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
    if(power < 100) return {name:'青铜', color:'#a16207', emoji:'🥉'};
    if(power < 500) return {name:'白银', color:'#94a3b8', emoji:'🥈'};
    if(power < 1500) return {name:'黄金', color:'#fbbf24', emoji:'🥇'};
    if(power < 3500) return {name:'铂金', color:'#06b6d4', emoji:'💠'};
    if(power < 7000) return {name:'钻石', color:'#a855f7', emoji:'💎'};
    if(power < 15000) return {name:'大师', color:'#ec4899', emoji:'👑'};
    return {name:'王者', color:'#fbbf24', emoji:'🌟'};
  }
  
  // ─── 里程碑配置 ───────────────────────────
  // 🔴 已按新设计调整: 去掉"连签3天/7天发金币(200/500)"的金币里程碑(与每日宝箱三档冲突、会乱爆金币)。
  //   只保留钻石里程碑(连签14/30/100天 = 5/10/30颗), 这正是新设计的钻石获取方式。
  // 🔴v829 钻石已改为只从"知识结晶"获得(见 hansen_crystal.js)。连签里程碑改发: 金币 + 记忆强化buff(复习涨星翻倍) + 原有特典(头像框/双倍XP/宠物皮肤)。
  var MILESTONES = [
    {days:14,  reward:'🪙 +120 金币 · ⚡加速2小时 · 限定头像框', coin:120, boost:120, buff:'frame'},
    {days:30,  reward:'🪙 +250 金币 · ⚡加速4小时 · 双倍 XP 3 天', coin:250, boost:240, buff:'xp2x', buffDays:3},
    {days:100, reward:'🪙 +600 金币 · ⚡加速8小时 · 传说宠物皮肤', coin:600, boost:480, buff:'legendary_pet'},
  ];
  
  function checkMilestones(){
    try {
      var S = _r('S');
      if(!S) return;
      var streak = S.streak || 0;
      var claimed = JSON.parse(localStorage.getItem('hansen_milestones_claimed') || '[]');
      
      MILESTONES.forEach(function(m){
        if(streak >= m.days && claimed.indexOf(m.days) < 0){
          // 解锁
          claimed.push(m.days);
          // 🔴v829 发奖改为: 金币 + 记忆强化buff(钻石已改为只从"知识结晶"获得·见 hansen_crystal.js)
          if(window.HansenCoins && typeof window.HansenCoins.add === 'function'){
            window.HansenCoins.add(m.coin || 0);
          } else if(typeof window.addCoin === 'function'){ window.addCoin(m.coin || 0); }
          if(m.boost && window.HansenCrystal && typeof window.HansenCrystal.grantBoost === 'function'){
            window.HansenCrystal.grantBoost(m.boost, true);   // 记忆强化(静默·弹窗里已写明)
          }
          if(m.buff === 'xp2x'){
            var until = new Date(); until.setDate(until.getDate() + (m.buffDays || 1));
            localStorage.setItem('hansen_xp2x_until', until.toISOString());
          }
          // 弹窗
          showMilestoneDialog(m);
        }
      });
      localStorage.setItem('hansen_milestones_claimed', JSON.stringify(claimed));
    } catch(e){ console.error(e); }
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
    {key:'wordIslandPeople', name:'人物周', emoji:'👥', short:'people'},
    {key:'wordIslandSports', name:'运动周', emoji:'🏆', short:'sports'},
    {key:'wordIslandFamily', name:'家庭周', emoji:'👨‍👩‍👧', short:'family'},
    {key:'wordIslandSchool', name:'学校周', emoji:'🎒', short:'school'},
    {key:'wordIslandHome', name:'家居周', emoji:'🏠', short:'home'},
    {key:'wordIslandClothes', name:'衣物周', emoji:'👕', short:'clothes'},
    {key:'wordIslandNature', name:'自然周', emoji:'🌳', short:'nature'},
    {key:'wordIslandTransport', name:'交通周', emoji:'🚗', short:'transport'},
    {key:'wordIslandTime', name:'时间周', emoji:'⏰', short:'time'},
    {key:'wordIslandJob', name:'职业周', emoji:'💼', short:'job'},
    {key:'wordIslandBody', name:'身体周', emoji:'💪', short:'body'},
    {key:'wordIslandQuestion', name:'疑问词周', emoji:'❓', short:'question'},
    {key:'wordIslandAction', name:'动作周', emoji:'🏃', short:'action'},
    {key:'wordIslandAdjective', name:'形容词周', emoji:'✨', short:'adjective'},
    {key:'wordIslandCity', name:'城市周', emoji:'🏙️', short:'city'},
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
  // 用 monkey patch 包装原 doOpenChest
  function patchChest(){
    if(typeof window.doOpenChest === 'undefined') return false;
    if(window.__hansenChestPatched) return true;
    window.__hansenChestPatched = true;
    
    var origDoOpenChest = window.doOpenChest;
    
    window.doOpenChest = function(){
      // 全局每日签到闸门: 今天已在任意岛领过 → 连"稀有度额外金币"也不再发(修复跨岛重复发币)
      if(window.HansenCheckin && typeof window.HansenCheckin.claimedToday === 'function' && window.HansenCheckin.claimedToday()) return;
      // 在原版执行前判断稀有度
      var rand = Math.random();
      var rarity;
      if(rand < 0.02){ rarity = 'legendary'; }      // 2% 传说
      else if(rand < 0.10){ rarity = 'epic'; }      // 8% 史诗
      else if(rand < 0.30){ rarity = 'rare'; }      // 20% 稀有
      else { rarity = 'common'; }                    // 70% 普通
      
      window._hansenChestRarity = rarity;
      
      // 调原版
      origDoOpenChest.apply(this, arguments);
      
      // 在原版后追加稀有度标签
      setTimeout(function(){
        try {
          var c = document.getElementById('chestContent');
          if(!c) return;
          
          var rarityConfig = {
            common: {name:'普通', color:'#94a3b8', emoji:'⚪', glow:'rgba(148,163,184,.3)'},
            rare: {name:'稀有', color:'#3b82f6', emoji:'🔵', glow:'rgba(59,130,246,.5)', extraGem: 5},
            epic: {name:'史诗', color:'#a855f7', emoji:'🟣', glow:'rgba(168,85,247,.6)', extraGem: 15},
            legendary: {name:'传说', color:'#fbbf24', emoji:'🟡', glow:'rgba(251,191,36,.8)', extraGem: 50, petPiece: true},
          };
          var rc = rarityConfig[rarity];
          
          // 额外奖励给【金币】(方案B: 签到不给钻石, 钻石只连签里程碑给)
          if(rc.extraGem && typeof window.addCoin === 'function'){
            window.addCoin(rc.extraGem);
          }else if(rc.extraGem && typeof window.addGem === 'function'){
            window.addGem(rc.extraGem);  // 兜底(addGem已并入金币)
          }
          
          // 传说: 给宠物碎片
          if(rc.petPiece){
            var pieces = parseInt(localStorage.getItem('hansen_pet_pieces') || '0');
            pieces += 1;
            localStorage.setItem('hansen_pet_pieces', String(pieces));
          }
          
          // 在 chestContent 顶部插入稀有度横幅
          var banner = document.createElement('div');
          banner.style.cssText = 'background:linear-gradient(135deg,' + rc.color + ',rgba(0,0,0,.3));border:2px solid ' + rc.color + ';border-radius:12px;padding:10px;margin-bottom:14px;text-align:center;box-shadow:0 0 30px ' + rc.glow + ';animation:hanPulse 1.5s ease-in-out infinite';
          var pieceText = rc.petPiece ? '<div style="font-size:11px;color:#fde047;margin-top:4px">🐾 +1 限定宠物碎片!</div>' : '';
          var extraText = rc.extraGem ? '<div style="font-size:11px;color:#fff;margin-top:2px">额外 +' + rc.extraGem + ' 🪙</div>' : '';
          banner.innerHTML = '<div style="font-size:30px;margin-bottom:4px">' + rc.emoji + '</div>' +
            '<div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:2px">' + rc.name + ' 宝箱!</div>' +
            extraText + pieceText;
          c.insertBefore(banner, c.firstChild);
        } catch(e){ console.error(e); }
      }, 800);
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
    
    // 主页 UI 注入
    injectHomeUI();
    
    // 各种 patch
    setTimeout(function(){
      patchChest();
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
    };
    
    console.log('%c[HansenAddiction]%c v142ao 加载: 战力分 + 里程碑 + 每周主题 + 对比自己 + 宝箱稀有度',
                'color:#ec4899;font-weight:bold', 'color:#94a3b8');
  }
  
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
