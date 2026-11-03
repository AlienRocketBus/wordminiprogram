/*
 * hansen_boss_progress.js (v247+)
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   ⛔ Hansen 的核心需求 (写在最显眼位置, 永远不要改方向)            ║
 * ║                                                                  ║
 * ║   1. 必须有选关界面 (20 关都能看到, 已解锁/未解锁标记)           ║
 * ║   2. 点 Lv19 → 真的进 Lv19 混沌魔尊                              ║
 * ║   3. 点 Lv20 → 真的进 Lv20 上古太阳神                              ║
 * ║   4. 点任意已解锁的关 → 真的进那一关 (不是任何其他关)            ║
 * ║                                                                  ║
 * ║   ❌ 错误方向 (不要再犯):                                         ║
 * ║      - 删选关界面 (v252 的错误, BUG #22)                          ║
 * ║      - 强制 Lv1 顺序闯关 (v254 的错误)                            ║
 * ║      - 任何"绕开 bug 删功能"的方案                                ║
 * ║                                                                  ║
 * ║   ✅ 正确方向: 保留选关界面 + 修 bug 让点哪关真打哪关             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * ════════════════════════════════════════════════════════════════
 *   🔴 BUG #17 修复模块: Boss 等级跳级 bug
 * ════════════════════════════════════════════════════════════════
 * 
 * 【bug 现象】
 *   Hansen 反馈: 连打 3 次 Lv1 淘气小精灵, 下次 startBoss 直接跳到 Lv3 百战兽人.
 *   反复打低级 boss 也能跨级解锁, 完全没有难度梯度.
 * 
 * 【根因】
 *   原版 startBoss 行 3472:  const lvl = Math.min(Math.max(0, S.level - 1), BOSSES.length - 1);
 *   ↑ boss 等级直接绑 S.level (段位等级, 按 XP 攒够升级).
 *   玩家连打低级 boss → 攒 XP → 段位升级 → boss 跟着升级 → 跳级!
 * 
 *   段位等级是"称号"(钻石领主/王者), 不应该控制 boss 难度.
 *   两个职责被混用了 → bug.
 * 
 * 【Hansen 设计的解锁规则】
 *   - Lv1 淘气小精灵: 打通 1 次 → 解锁 Lv2
 *   - Lv2 暗影忍者:   打通 2 次 → 解锁 Lv3
 *   - Lv3 百战兽人:   打通 3 次 → 解锁 Lv4
 *   - Lv4-Lv19:      每个打通 3 次 → 解锁下一关
 *   - Lv20 上古太阳神:  最终关, 想打几次打几次, 不再解锁
 * 
 *   全部通关共需打 57 次 boss (1 + 2 + 3×18 = 57)
 *   适合中学生 1-2 个月的游戏量
 * 
 * 【实现策略】(零风险加固原则)
 *   - 不改 island_*.html 18 个文件 (风险大), 用 hook 拦截
 *   - 新字段 S.bossWins = {1: 次数, 2: 次数, ...}: 每个 boss 通关次数
 *   - 新字段 S.bossUnlocked: 解锁的最高 boss 等级 (默认 1)
 *   - hook startBoss: 用 S.bossUnlocked 代替 S.level 决定打哪个 boss
 *     (如果 island 已经有 boss 等级选择 UI, 也只影响默认值)
 *   - hook bossVictory: 通关后增加 bossWins[当前等级], 检查是否解锁下一关
 *   - hook stopBoss/bossDefeat: 不增加 bossWins (战败不计)
 * 
 * 【数据结构】
 *   S.bossWins = { 1: 3, 2: 1, 3: 0, ... } 
 *     键: boss 等级 (1-20)
 *     值: 通关次数 (含战败前的胜利)
 *   S.bossUnlocked = 5     // 当前解锁到第 5 关
 *   S.bossSelected = 5     // 当前选择要打哪一关 (可以选已解锁的任何一关)
 * 
 * 【注意事项 - 别改回去!】
 *   - 不要让 startBoss 重新用 S.level 决定 boss 等级
 *   - 不要让升级段位 (S.level++) 自动解锁 boss (这是 bug 的原因)
 *   - 段位 (S.level) 和 boss 解锁 (S.bossUnlocked) 必须严格分离
 */
(function(){
  'use strict';
  
  // 每个 boss 需要打几次才解锁下一关
  // Lv1 打 1 次, Lv2 打 2 次, Lv3-Lv19 每个打 3 次, Lv20 不再解锁
  function getRequiredWins(bossLv){
    if(bossLv <= 0) return 1;
    if(bossLv === 1) return 1;
    if(bossLv === 2) return 2;
    return 3;  // Lv3-Lv19 都需要 3 次
  }
  
  // 工具: 安全读 S
  function getS(){
    return window.S || null;
  }
  
  // 初始化新字段 (兼容老存档)
  // 🔴 BUG #21 修复 (v254): 之前的 bossSelected 字段会被旧版本(v250/v251 的选关界面)
  //   写入 localStorage, 导致 v253 加载后 bossSelected=18, 永远打外星霸主.
  //   彻底方案: 引入新字段 bossCurrentLv (当前打到哪一关), 强制清掉所有旧的 bossSelected.
  //   设计原则: 每次进游戏, bossCurrentLv 永远是"该打的关", 由通关进度决定, 不能被污染.
  function ensureFields(){
    var S = getS();
    if(!S) return false;
    if(!S.bossWins || typeof S.bossWins !== 'object'){
      S.bossWins = {};
    }
    // v319: 一次性修正旧存档 — 旧版迁移公式(1+floor(bossBeaten/3))把 bossUnlocked 按"历史总击败数"
    //   膨胀了(老玩家一上来就解锁到 Lv4 等 = 跳关). 这里按"真实逐关胜利记录(bossWins)"重新推算正确的解锁等级:
    //   从 Lv1 起, 只要某关达到了它要求的胜利次数(getRequiredWins), 才认为解锁了下一关. 只跑一次(打标记).
    if(!S.__bossUnlockFixedV319){
      S.__bossUnlockFixedV319 = true;
      var realUnlocked = 1;
      for(var lv = 1; lv < 20; lv++){
        var winsAtLv = (S.bossWins && S.bossWins[lv]) || 0;
        if(winsAtLv >= getRequiredWins(lv)) realUnlocked = lv + 1;
        else break;   // 这一关没打够 → 后面都没解锁, 停
      }
      S.bossUnlocked = realUnlocked;
      if(typeof S.bossCurrentLv === 'number' && S.bossCurrentLv > realUnlocked){
        S.bossCurrentLv = realUnlocked;
      }
      try { if(typeof window.save === 'function') window.save(); } catch(e){}
    }
    // ═══════════════════════════════════════════════════════════════════
    // 🔴🔴🔴 v330 每岛独立迁移 (Hansen 明确要求: 每个岛 boss 进度完全独立) 🔴🔴🔴
    //   卡牌/选关系统已从"单一全局 hansen_card_data(18岛共享)"改为"每岛各存一份
    //   hansen_card_data_<岛名>"。这里把【旧的全局 key 及其备份彻底删除】, 防止旧脏数据
    //   (记着"某岛打通了所有关")继续污染任何岛, 让所有岛从干净的独立存档重新逐关开始。
    //   用全新强力标记 __PER_ISLAND_RESET_V330 只跑一次。同时 boss 闯关字段(本岛 S)也清零。
    // ═══════════════════════════════════════════════════════════════════
    if(!S.__PER_ISLAND_RESET_V330){
      S.__PER_ISLAND_RESET_V330 = true;
      // (1) 本岛 boss 闯关字段清零
      S.bossUnlocked = 1;
      S.bossCurrentLv = 1;
      S.bossWins = {};
      try { delete S.bossSelected; } catch(e){ S.bossSelected = undefined; }
      try { delete S.bossBeaten; } catch(e){}
      if(S.stats && typeof S.stats === 'object'){ S.stats.bossBeaten = 0; }
      // (2) 彻底铲除【旧的全局卡牌 key】(及备份) — 它是跨岛共享 bug 的根源
      try {
        localStorage.removeItem('hansen_card_data');
        localStorage.removeItem('hansen_card_data_bak');
        /* 🔴v1165 不再删 hansen_card_temp_unlock_until：它现在是 72 小时体验期（hansen_freepass.js）的「卡册全开」标记。
           这段迁移在每个岛第一次打开时都会跑，以前一跑就把它删掉、体验期再写回来 → 卡册/神秘殿堂的数字来回跳。
           过期的标记由 hansen_freepass.js 到期清理。 */
      } catch(e){}
      try { if(typeof window.save === 'function') window.save(); } catch(e){}
      try { console.log('[HBP] 🔴 v330 每岛独立迁移完成: 已删除旧全局卡牌存档, 本岛 boss 进度从第1关独立重新开始'); } catch(e){}
    }
    // v327: 强力一次性修正 — 之前选关界面有 "|| beaten" 旁路, 用卡牌系统的 islandClears(历史打过的所有关)
    //   当解锁判断, 导致历史中途打过 Lv15/16 等关全被解锁 = 严重跳关. 而且这些存档的 bossWins 也可能因为
    //   早期 bossVictory 记错关而是脏数据, 不能信. 所以这里【强制把所有存档的解锁状态彻底重置回 Lv1】,
    //   新老用户一律从第一关真正开始, 必须逐关打通. (bossWins 清空, 重新按真实逐关胜利累积.)
    if(!S.__bossUnlockResetV327){
      S.__bossUnlockResetV327 = true;
      S.bossUnlocked = 1;
      S.bossCurrentLv = 1;
      S.bossWins = {};   // 清空历史胜利计数, 从头逐关累积 (防脏数据把人直接顶到高关)
      try { if(typeof window.save === 'function') window.save(); } catch(e){}
    }
    // S.bossUnlocked: 解锁到第几关 (1-20)
    if(typeof S.bossUnlocked !== 'number' || !isFinite(S.bossUnlocked) || S.bossUnlocked < 1){
      // v319: Hansen 要求严格逐关 — 不再按历史击败数 (S.stats.bossBeaten) 推算解锁等级
      //   (旧公式 1+floor(bossBeaten/3) 会让老玩家一上来就解锁到 Lv4 等, 等于跳关).
      //   所有人从 Lv1 开始, 必须打赢上一关才解锁下一关.
      S.bossUnlocked = 1;
    }
    S.bossUnlocked = Math.max(1, Math.min(20, S.bossUnlocked));
    
    // 🛡️ 关键: 彻底清掉旧的 bossSelected (旧版选关界面写入的, 会污染本版)
    if('bossSelected' in S){
      try { delete S.bossSelected; } catch(e){ S.bossSelected = undefined; }
    }
    
    // 🆕 新字段: bossCurrentLv (当前正在打第几关)
    // 默认从 Lv1 开始. 玩家可以打通推进, 但永远不会"被旧存档卡在某关".
    if(typeof S.bossCurrentLv !== 'number' || !isFinite(S.bossCurrentLv) || S.bossCurrentLv < 1){
      S.bossCurrentLv = 1;  // ★ 永远默认 Lv1, 从头开始
    }
    // 范围限制: 不能超过已解锁 + 1, 不能小于 1, 不能 > 20
    S.bossCurrentLv = Math.max(1, Math.min(20, Math.min(S.bossUnlocked, S.bossCurrentLv)));
    return true;
  }
  
  // 当前解锁的最高 boss 等级
  function getUnlockedBossLv(){
    var S = getS();
    if(!ensureFields()) return 1;
    return Math.min(20, Math.max(1, S.bossUnlocked || 1));
  }
  
  // 🔴v1165 单词大陆 8 个岛（island_landN）的关卡顺序看 landN_prog（5 关，按顺序打赢一关开下一关），不看这里的 20 关数字。
  //   以前这里照着 20 关的数字弹「🔓新 Boss 解锁」（说第 2 关开放了）：72 小时体验期跳着打赢第 5 关也弹，
  //   可大陆的进度一步没动（体验期一过第 2 关还锁着）。现在大陆岛只在「按顺序打赢、真的开了下一关」时弹，写真的关号。
  function landInfo(){
    try{
      var m = (location.pathname || '').match(/island_land([1-8])\.html/);
      if(!m) return null;
      var prog = parseInt(localStorage.getItem('land' + m[1] + '_prog') || '0', 10) || 0;
      var total = (typeof BOSSES !== 'undefined' && BOSSES && BOSSES.length) ? BOSSES.length : 0;
      return { n: m[1], prog: prog, total: total };
    }catch(e){ return null; }
  }

  // 记一次通关, 检查是否解锁下一关
  //   landNext（只有单词大陆岛传）：这一仗真的开了大陆的第几关；0 = 没开新关，不弹解锁提示
  function recordBossWin(bossLv, landNext){
    var S = getS();
    if(!ensureFields()) return;
    bossLv = Math.max(1, Math.min(20, bossLv | 0));
    
    // 🛡️ v328 纵深防御 — 越级校验: 即使调用方(理论上)传来一个"未解锁的高关"(bug/篡改),
    //   也绝不记录、绝不解锁. 只接受 bossLv <= 当前已解锁最高关 的胜利. 这样跳关在数据层就不可能发生.
    var curUnlocked = Math.max(1, Math.min(20, S.bossUnlocked || 1));
    if(bossLv > curUnlocked){
      try { console.warn('[HBP] 拒绝记录未解锁关 Lv' + bossLv + ' 的胜利 (当前只解锁到 Lv' + curUnlocked + '), 防跳关'); } catch(e){}
      return;
    }
    
    S.bossWins[bossLv] = (S.bossWins[bossLv] || 0) + 1;
    
    // 检查能不能解锁下一关 (只可能 +1, 永远不会跳级)
    var needed = getRequiredWins(bossLv);
    if(S.bossWins[bossLv] >= needed && bossLv >= curUnlocked && bossLv < 20){
      S.bossUnlocked = bossLv + 1;   // ★ 严格 +1, 一次只开一关
      // 弹个解锁提示（单词大陆岛按大陆自己的关号；没真开新关就不弹）
      if(landNext === undefined) showUnlockBanner(bossLv + 1);
      else if(landNext > 0) showUnlockBanner(landNext);
    }
    
    // 保存
    try { if(typeof window.save === 'function') window.save(); } catch(e){}
  }
  
  // 解锁动画弹窗
  function showUnlockBanner(newLv){
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:30px;animation:hbpFade 0.3s';
    mask.innerHTML = '<div style="background:linear-gradient(135deg,#7c3aed,#1e1b4b);border:3px solid #fbbf24;border-radius:20px;padding:30px;text-align:center;color:#fff;max-width:340px;box-shadow:0 0 60px rgba(251,191,36,0.6)">' +
      '<div style="font-size:80px;line-height:1;margin-bottom:14px">🔓</div>' +
      '<div style="font-size:22px;font-weight:900;color:#fbbf24;margin-bottom:10px">新 Boss 解锁!</div>' +
      '<div style="font-size:16px;color:#fde047;margin-bottom:20px;line-height:1.6">Lv ' + newLv + ' 已开放, 准备好挑战了吗?</div>' +
      '<button id="hbpUnlockOk" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;border:0;padding:12px 32px;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer">收下!</button>' +
    '</div>';
    document.body.appendChild(mask);
    // 三重保险关闭 (借鉴 BUG #11 教训)
    var btn = mask.querySelector('#hbpUnlockOk');
    if(btn) btn.addEventListener('click', function(){ try{ mask.remove(); }catch(e){} });
    setTimeout(function(){
      mask.addEventListener('click', function(e){
        if(e.target === mask){ try{ mask.remove(); }catch(e2){} }
      });
    }, 500);
    var esc = function(e){
      if(e.key === 'Escape' || e.keyCode === 27){
        try{ mask.remove(); }catch(e2){}
        document.removeEventListener('keydown', esc);
      }
    };
    document.addEventListener('keydown', esc);
    try { if(window.playLevelUp) window.playLevelUp(); } catch(e){}
  }
  
  // 🔴 BUG #23 修复 (v257): 彻底删除 startBoss hook 和我自己加的选关界面
  //   
  //   原因: 游戏【早就有】一个完美的 boss 选关界面 (hansen_cards.js 的 renderBossPicker),
  //   每个 boss 卡片 onclick 调 hansenStartRebattle(lv), 内部用 "临时改 S.level + 调原版 startBoss" 
  //   的方式打对应关. 我之前不知道这个机制, 自己 hook 了 window.startBoss 又加了一个选关界面,
  //   结果用户点原版选关卡片 → hansenStartRebattle 调 startBoss → 触发我的 hook → 弹我的选关界面.
  //   两个选关界面叠在一起, 用户点了一个还要再点一个.
  //   
  //   修复: 完全不 hook startBoss, 不加任何选关 UI, 让游戏自己的 hansenStartRebattle 正常工作.
  //   保留 hookBossVictory 用于记录通关次数 (BUG #17 的有用功能, 但不影响选关).

  // hook bossVictory: 通关后记次数
  function hookBossVictory(){
    if(typeof window.bossVictory !== 'function') return false;
    if(window.__hbpVictoryHooked) return true;
    window.__hbpVictoryHooked = true;
    
    var origVictory = window.bossVictory;
    window.bossVictory = function(){
      // v319: 用可靠的 window._hansenRebattleLv 判断当前打的是哪一关 (选关界面 hansenStartRebattle 设的,
      //   挂在 window 上一定读得到). 旧代码用 new Function 读 bossCurrent — 但 bossCurrent 是 <script> 顶层 let,
      //   不挂 window, 全局作用域读不到 → 回退到 S.level(玩家进度) → 记错关. 现在改用 _hansenRebattleLv 为主.
      try {
        ensureFields();
        var S = getS();
        var curBossLv;
        if(window._hansenRebattleLv != null){
          curBossLv = Math.max(1, Math.min(20, window._hansenRebattleLv | 0));
        } else {
          // 没有复战标记的兜底: 用 S.bossCurrentLv (该打的关), 再不行才 S.level
          curBossLv = Math.max(1, Math.min(20, (S.bossCurrentLv || S.level || 1) | 0));
        }
        var land = landInfo();
        if(land){
          // 先读进度再交给原 bossVictory（它按顺序打赢才把 landN_prog +1）
          var inOrder = (window._s1Idx === land.prog) && (land.prog + 1 < land.total);
          recordBossWin(curBossLv, inOrder ? land.prog + 2 : 0);
        } else {
          recordBossWin(curBossLv);
        }
      } catch(e){ console.warn('[HBP] recordBossWin 失败:', e); }
      
      return origVictory.apply(this, arguments);
    };
    return true;
  }
  
  // 等 bossVictory 加载 (v257: 不再 hook startBoss, 游戏已有选关机制)
  function init(){
    if(!getS()){ setTimeout(init, 200); return; }
    ensureFields();
    var ok2 = hookBossVictory();
    if(!ok2){ setTimeout(init, 200); return; }
    console.log('[HBP] BUG #17 修复模块已挂载 (只 hook bossVictory 记次数, 不动 startBoss). 解锁 Lv:', getS().bossUnlocked);
  }
  
  // CSS for 动画
  if(typeof document !== 'undefined'){
    var st = document.createElement('style');
    st.textContent = '@keyframes hbpFade{from{opacity:0}to{opacity:1}}';
    if(document.head) document.head.appendChild(st);
  }
  
  if(typeof document !== 'undefined' && document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }
  
  // 暴露 API 给前端 UI 用 (如果以后要做 boss 选关界面)
  window.HansenBossProgress = {
    getUnlockedBossLv: getUnlockedBossLv,
    getRequiredWins: getRequiredWins,
    recordBossWin: recordBossWin,
    getWins: function(bossLv){ 
      var S = getS(); 
      return (S && S.bossWins && S.bossWins[bossLv]) || 0; 
    },
    // 调试用: 重置进度 (上线后建议删)
    _reset: function(){
      var S = getS(); 
      if(!S) return;
      S.bossWins = {};
      S.bossUnlocked = 1;
      S.bossSelected = 1;
      try { if(typeof window.save === 'function') window.save(); } catch(e){}
      console.log('[HBP] 已重置 boss 进度');
    }
  };
})();
