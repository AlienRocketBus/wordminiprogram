/**
 * 单词大冒险 v140 升级模块 (彻底升级版)
 * 1. 主页"继续上次" 金色发光卡片
 * 2. 每日宝箱暴击 (10% ×5, 20% ×2)
 * 3. 错题红点徽章 (强迫症提醒)
 * 4. XP 升级近临界闪烁 (>80% 时提示)
 * 5. 连击音效层次 (3/5/10 不同震撼)
 * 6. 升级满屏特效 (level up 时整屏闪光)
 * 7. 答题成就感增强 (+XP 浮动动画)
 */
(function(){
  'use strict';

  function safeGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function safeSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function safeJSON(k){
    const v = safeGet(k);
    if(!v) return null;
    try { return JSON.parse(v); } catch(e){ return null; }
  }
  function getCurrentIsland(){
    const m = location.pathname.match(/island_([a-z0-9]+)\.html/i);  //🔴v875(Hansen·彻底打通): 岛名正则纳入数字·land1-8/season同门而入·复习STORAGE_KEY与错题总览在大陆岛正常点火
    return m ? m[1] : null;
  }
  const islandKey = getCurrentIsland();

  // 全局动画 CSS (一次注入)
  function injectCss(){
    if(document.getElementById('hu_css')) return;
    const css = document.createElement('style');
    css.id = 'hu_css';
    css.textContent = `
      /* 暴击 */
      @keyframes hu_critFlash{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}
      @keyframes hu_critScale{0%{transform:scale(.5);opacity:0}40%{transform:scale(1.1);opacity:1}100%{transform:scale(1.05);opacity:1}}
      @keyframes hu_greatPulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.05)}}
      /* 红点 */
      @keyframes hu_badgeBlink{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{transform:scale(1.08);box-shadow:0 0 0 4px rgba(239,68,68,0)}}
      /* 继续卡片 */
      @keyframes hu_continuePulse{
        0%,100%{box-shadow:0 0 12px rgba(251,191,36,.3),0 0 24px rgba(251,191,36,.15)}
        50%{box-shadow:0 0 18px rgba(251,191,36,.45),0 0 32px rgba(251,191,36,.25)}
      }
      /* XP 临界闪烁 */
      @keyframes hu_xpNearBlink{
        0%,100%{filter:brightness(1)}
        50%{filter:brightness(1.15) drop-shadow(0 0 4px rgba(251,191,36,.5))}
      }
      .hu_xpNear{animation:hu_xpNearBlink 3s ease-in-out infinite}
      /* 升级满屏特效 — v155: 删掉所有 rotate, 纯淡入保持不旋转 (Hansen 反复反馈头晕) */
      @keyframes hu_lvlUpFlash{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
      @keyframes hu_lvlUpScale{0%{transform:scale(1);opacity:0}15%{transform:scale(1);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
      /* XP 浮动动画 (答对时 +XP) */
      @keyframes hu_xpFloat{
        0%{opacity:0;transform:translate(-50%,0) scale(.5)}
        20%{opacity:1;transform:translate(-50%,-20px) scale(1.2)}
        80%{opacity:1;transform:translate(-50%,-60px) scale(1)}
        100%{opacity:0;transform:translate(-50%,-100px) scale(.8)}
      }
      .hu_xpFloat{
        position:fixed;left:50%;top:35%;z-index:99999;pointer-events:none;
        color:#fbbf24;font-size:32px;font-weight:900;
        text-shadow:0 0 10px rgba(251,191,36,.8),0 2px 6px rgba(0,0,0,.6);
        animation:hu_xpFloat 1.4s ease-out forwards;
      }
      /* 连击 3 / 5 / 10 — v155: 删掉所有 rotate, 改成纯 scale 弹出而不歪 */
      @keyframes hu_comboFlash3{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}
      @keyframes hu_comboFlash5{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}40%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}80%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
      @keyframes hu_comboFlash10{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}50%{transform:translate(-50%,-50%) scale(1.2)}75%{transform:translate(-50%,-50%) scale(1.25)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
    `;
    document.head.appendChild(css);
  }
  if(document.head) injectCss();
  else document.addEventListener('DOMContentLoaded', injectCss);

  window.HansenUpgrade = window.HansenUpgrade || {};

  // ─────────────────────────────────────────────
  // 改进 1: 记录上次玩 (兜底机制, 用独立 key 不破坏 v138 原逻辑)
  // ─────────────────────────────────────────────
  // 文件名 → v138 ISLAND_META key 映射 (避开 v138 短名/长名冲突)
  const ISLAND_FILE_MAP = {
    'food': 'wordIslandFood',
    'animal': 'wordIslandAnimal',
    'sports': 'wordIslandSports',
    'job': 'wordIslandPeople',
    'color': 'wordIslandColorNum',
    'nature': 'wordIslandNature',
    'action': 'wordIslandVerbs',
    'traffic': 'wordIslandTransport',
    'body': 'wordIslandBody',
    'city': 'wordIslandCity',
    'clothes': 'wordIslandClothes',
    'home': 'wordIslandHouse',
    'family': 'wordIslandFamily',
    'school': 'wordIslandSchool',
    'time': 'wordIslandTime',
    'adjective': 'wordIslandAdj',
    'treasure': 'wordIslandMisc',
    'question': 'wordIslandPronouns',
    //🔴v875(Hansen·彻底打通): 星海终战hub+单词大陆8岛入册·错题/复习/最近记录与正片共用一套
    'season': 'wordIslandSeason',
    'land1': 'wordIslandLand1',
    'land2': 'wordIslandLand2',
    'land3': 'wordIslandLand3',
    'land4': 'wordIslandLand4',
    'land5': 'wordIslandLand5',
    'land6': 'wordIslandLand6',
    'land7': 'wordIslandLand7',
    'land8': 'wordIslandLand8'
  };
  
  // 暴露当前岛的 storage key 给 hansen_review.js 等使用
  if(islandKey){
    const metaKey = ISLAND_FILE_MAP[islandKey];
    if(metaKey) window.STORAGE_KEY = metaKey;
  }
  
  if(islandKey){
    const metaKey = ISLAND_FILE_MAP[islandKey];
    if(metaKey){
      safeSet('hansen_lastIslandMeta', metaKey);
      safeSet('hansen_lastIslandTime', String(Date.now()));
      // 同时主动给该岛标记 lastSaveTime - 保证 findRecentIsland 能找到
      try {
        let data = safeJSON(metaKey);
        if(!data) data = {};
        data.lastSaveTime = Date.now();
        localStorage.setItem(metaKey, JSON.stringify(data));
      } catch(e){}
      
      // v142l: 缓存当前岛的 allW 到 localStorage, 供跨岛复习使用
      // 延迟等 allW 加载
      setTimeout(function(){
        try {
          if(window.allW && Array.isArray(window.allW) && window.allW.length > 0){
            // 只存必要字段, 节省空间
            const minimal = window.allW.map(function(w){
              return {
                en: w.en, cn: w.cn, pn: w.pn || '',
                emoji: w.emoji || '', ex: w.ex || '', exCn: w.exCn || ''
              };
            });
            localStorage.setItem('hansen_vocab_' + metaKey, JSON.stringify(minimal));
          }
        } catch(e){}
      }, 1500);
    }
  }

  // ─────────────────────────────────────────────
  // 改进 2: 宝箱暴击
  // ─────────────────────────────────────────────
  window.HansenUpgrade.rollChestReward = function(){
    const r = Math.random();
    if(r < 0.10) return { multiplier: 5, tag: 'critical' };
    if(r < 0.30) return { multiplier: 2, tag: 'great' };
    return { multiplier: 1, tag: 'normal' };
  };
  window.HansenUpgrade.showCritical = function(text){
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;pointer-events:none;
      display:flex;align-items:center;justify-content:center;
      background:radial-gradient(circle,rgba(251,191,36,.3) 0%,transparent 60%);
      animation:hu_critFlash 1.5s ease-out forwards;
    `;
    overlay.innerHTML = `<div style="font-size:48px;font-weight:900;color:#fbbf24;text-shadow:0 0 30px #fbbf24,0 0 60px #f59e0b;animation:hu_critScale 1.5s ease-out forwards;text-align:center;line-height:1.2">💥 暴击!<br>${text || '×5 奖励!'}</div>`;
    document.body.appendChild(overlay);
    try { if(navigator.vibrate) navigator.vibrate([0,50,30,50,30,100]); } catch(e){}
    setTimeout(() => overlay.remove(), 1500);
  };
  window.HansenUpgrade.showGreat = function(text){
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:35%;left:50%;transform:translateX(-50%);z-index:99998;
      pointer-events:none;background:linear-gradient(135deg,#10b981,#059669);
      color:#fff;padding:18px 32px;border-radius:18px;font-size:24px;font-weight:900;
      box-shadow:0 8px 28px rgba(16,185,129,.55);animation:hu_greatPulse .6s ease 2;
    `;
    overlay.textContent = '🎁 ' + (text || '×2 奖励!');
    document.body.appendChild(overlay);
    try { if(navigator.vibrate) navigator.vibrate(40); } catch(e){}
    setTimeout(() => overlay.remove(), 1500);
  };

  // ─────────────────────────────────────────────
  // 改进 3: 错题红点徽章
  // ─────────────────────────────────────────────
  function getWrongCount(){
    let total = 0;
    try {
      Object.keys(localStorage).forEach(k => {
        if(k.startsWith('wordIsland')){
          const d = safeJSON(k);
          if(d && d.wrongs && typeof d.wrongs === 'object'){
            total += Object.keys(d.wrongs).length;
          }
        }
      });
    } catch(e){}
    return total;
  }
  function updateWrongBadge(){
    const count = getWrongCount();
    const navItems = document.querySelectorAll('.nav-item, .tab-item, [class*="nav"] [class*="item"]');
    let target = null;
    navItems.forEach(item => { if(/单词/.test(item.innerText)) target = item; });
    document.querySelectorAll('.hu_wrongBadge').forEach(b => b.remove());
    if(count > 0 && target){
      target.style.position = 'relative';
      const badge = document.createElement('span');
      badge.className = 'hu_wrongBadge';
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.cssText = `
        position:absolute;top:0;right:8px;
        background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;
        font-size:11px;font-weight:800;padding:2px 6px;border-radius:10px;
        min-width:18px;text-align:center;z-index:10;
        box-shadow:0 2px 6px rgba(239,68,68,.5);
        animation:hu_badgeBlink 2s infinite;border:1.5px solid #0f172a;
      `;
      target.appendChild(badge);
    }
  }
  if(document.body) updateWrongBadge();
  else document.addEventListener('DOMContentLoaded', updateWrongBadge);
  setInterval(updateWrongBadge, 3000);

  // ─────────────────────────────────────────────
  // 改进 4: XP 升级近临界闪烁
  // ─────────────────────────────────────────────
  function checkXpNear(){
    // 找 XP 进度条 (各种可能 selector)
    const xpBars = document.querySelectorAll('.xp-bar, .xp-fill, [class*="xp-bar"], [class*="xpBar"]');
    if(!xpBars.length) return;

    // 计算当前 XP 进度
    let ratio = 0;
    try {
      if(typeof window.S === 'object' && window.S){
        const xp = window.S.xp || 0;
        // 从代码看 升级公式: lvUp= Math.floor(100*Math.pow(1.15,level-1))
        const level = window.S.level || 1;
        const need = Math.floor(100 * Math.pow(1.15, level - 1));
        ratio = need > 0 ? xp / need : 0;
      }
    } catch(e){}

    xpBars.forEach(bar => {
      if(ratio > 0.80){
        bar.classList.add('hu_xpNear');
      } else {
        bar.classList.remove('hu_xpNear');
      }
    });
  }
  setInterval(checkXpNear, 1500);

  // ─────────────────────────────────────────────
  // 改进 5/6: 升级满屏特效 + 连击层次
  // ─────────────────────────────────────────────
  window.HansenUpgrade.showLevelUp = function(newLevel){
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;pointer-events:none;
      display:flex;align-items:center;justify-content:center;
      background:radial-gradient(circle,rgba(168,85,247,.4) 0%,rgba(99,102,241,.2) 40%,transparent 70%);
      animation:hu_lvlUpFlash 1.8s ease-out forwards;
    `;
    overlay.innerHTML = `<div style="text-align:center;animation:hu_lvlUpScale 1.8s cubic-bezier(.34,1.56,.64,1) forwards">
      <div style="font-size:72px;line-height:1">🎉</div>
      <div style="font-size:32px;font-weight:900;color:#fbbf24;text-shadow:0 0 20px #fbbf24,0 4px 10px rgba(0,0,0,.5);margin-top:8px">Lv. ${newLevel}</div>
      <div style="font-size:18px;font-weight:700;color:#fff;margin-top:4px;text-shadow:0 2px 6px rgba(0,0,0,.5)">恭喜升级!</div>
    </div>`;
    document.body.appendChild(overlay);
    try { if(navigator.vibrate) navigator.vibrate([0,100,50,100,50,200]); } catch(e){}
    setTimeout(() => overlay.remove(), 1800);
  };

  window.HansenUpgrade.showCombo = function(combo){
    if(!combo || combo < 3) return;
    let tier, color, size, text;
    if(combo >= 10){
      tier = 10; color = 'linear-gradient(135deg,#a855f7,#ec4899,#fbbf24)'; size = 56; text = '🔥🔥🔥 ' + combo + ' 连击!!!';
    } else if(combo >= 5){
      tier = 5; color = 'linear-gradient(135deg,#fbbf24,#f59e0b)'; size = 44; text = '⚡ ' + combo + ' 连击!';
    } else if(combo >= 3){
      tier = 3; color = 'linear-gradient(135deg,#22c55e,#10b981)'; size = 36; text = '✨ ' + combo + ' 连击';
    } else return;

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:38%;left:50%;z-index:99999;pointer-events:none;
      font-size:${size}px;font-weight:900;color:#fff;
      background:${color};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
      text-shadow:0 4px 12px rgba(0,0,0,.4);
      animation:hu_comboFlash${tier} 1.2s ease-out forwards;
    `;
    el.textContent = text;
    document.body.appendChild(el);
    try { 
      if(navigator.vibrate) {
        if(tier === 10) navigator.vibrate([0,60,30,60,30,60,30,100]);
        else if(tier === 5) navigator.vibrate([0,50,30,80]);
        else navigator.vibrate(30);
      }
    } catch(e){}
    setTimeout(() => el.remove(), 1200);
  };

  // 改进 7: +XP 浮动动画
  window.HansenUpgrade.showXpGain = function(amount){
    if(!amount || amount <= 0) return;
    const el = document.createElement('div');
    el.className = 'hu_xpFloat';
    el.textContent = '+' + amount + ' XP';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  };

  // ─────────────────────────────────────────────
  // 自动 patch: 监听岛代码的关键函数
  // ─────────────────────────────────────────────
  function patchHooks(){
    // 1. 监听 addXP - 显示浮动 +XP (但要避免每个小 +XP 都显示, 只显示 >= 5 XP)
    if(typeof window.addXP === 'function' && !window.__hu_addXP_patched){
      const orig = window.addXP;
      const prevLevel = window.S && window.S.level || 1;
      window.addXP = function(n){
        const beforeLevel = window.S && window.S.level || 1;
        const r = orig.apply(this, arguments);
        if(n >= 5){
          try { window.HansenUpgrade.showXpGain(n); } catch(e){}
        }
        // 检测升级
        const afterLevel = window.S && window.S.level || 1;
        if(afterLevel > beforeLevel){
          try { window.HansenUpgrade.showLevelUp(afterLevel); } catch(e){}
        }
        return r;
      };
      window.__hu_addXP_patched = true;
    }

    // 2. 监听 comboHit - 显示连击层次
    if(typeof window.comboHit === 'function' && !window.__hu_combo_patched){
      const orig = window.comboHit;
      window.comboHit = function(){
        const r = orig.apply(this, arguments);
        try {
          // 实际 combo 在 window._comboCount
          const cur = window._comboCount || 0;
          if(cur >= 3) window.HansenUpgrade.showCombo(cur);
        } catch(e){}
        return r;
      };
      window.__hu_combo_patched = true;
    }
  }
  // 多次尝试 patch (岛代码可能延迟加载)
  let patchTries = 0;
  const patchTimer = setInterval(() => {
    patchHooks();
    patchTries++;
    if(patchTries >= 10) clearInterval(patchTimer);
  }, 500);
  setTimeout(patchHooks, 200);

  // ─────────────────────────────────────────────
  // 改进 1 (主页): 继续卡片发光
  // ─────────────────────────────────────────────
  function enhanceContinueCard(){
    if(islandKey) return;
    const recentEl = document.getElementById('recentLearnStat');
    if(!recentEl) return;
    if(!recentEl._target) return;

    recentEl.style.boxShadow = '0 0 12px rgba(251,191,36,.3), 0 0 24px rgba(251,191,36,.15)';
    recentEl.style.border = '2px solid rgba(251,191,36,.7)';
    recentEl.style.transition = 'all .3s';
    recentEl.style.animation = 'hu_continuePulse 4s ease-in-out infinite';
  }
  function tryEnhance(retries){
    enhanceContinueCard();
    const recentEl = document.getElementById('recentLearnStat');
    if(recentEl && recentEl._target && recentEl.style.animation) return;
    if(retries > 0) setTimeout(() => tryEnhance(retries - 1), 500);
  }
  if(document.body) setTimeout(() => tryEnhance(8), 300);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(() => tryEnhance(8), 300));

  console.log('%c[HansenUpgrade v140]%c 已加载: 7 项上瘾度升级',
              'color:#22c55e;font-weight:bold', 'color:#fbbf24');
})();
