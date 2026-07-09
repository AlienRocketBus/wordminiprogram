// hansen_island_upgrade.js — 各岛统一升级外挂(总）
// ============================================================
// 目的: 把动物岛做好的新功能, 通过"函数包装+运行时挂钩"的方式, 加到任何一个岛,
//   而【完全不修改各岛的HTML主体代码】。各岛只需引用这个JS即可全部升级、保持一致。
//
// 安全原则:
//   - 只"包装"已有函数(保留原函数, 在外面包一层), 不删改原代码。
//   - 依赖全局钱包 HansenCoins / HansenAch / HansenGems(它们各自是独立文件)。
//   - 所有操作 try/catch 容错, 任何一处失败不影响游戏运行。
//   - 用标记防止重复包装。
//
// 本文件分块构建, 每块独立可测。第①块: 金币全局化。
// ============================================================
(function(){
  if(window.__hansenIslandUpgradeLoaded){ return; } window.__hansenIslandUpgradeLoaded = true;

  // 等待页面的游戏脚本都定义完(DOMContentLoaded后再包装, 确保原函数已存在)
  // ========== 跨岛学习汇总: 探测当前岛key + 上报 ==========
  var _islandKeyCache = null;
  function detectIslandKey(){
    if(_islandKeyCache) return _islandKeyCache;
    try{
      // 方法1: 从 save 源码提取(有的岛save直接写key)
      if(typeof window.save === 'function'){
        var m = window.save.toString().match(/setItem\(['"](wordIsland[A-Za-z]+)['"]/);
        if(m){ _islandKeyCache = m[1]; return _islandKeyCache; }
      }
    }catch(e){}
    try{
      // 方法2(可靠): 扫描 localStorage, 找当前岛在用的 wordIsland* key。
      //   当前岛的存档对象里有 learned 字段且和内存 S 的特征一致。优先匹配 learned 长度一致的。
      var candidates=[];
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(/^wordIsland[A-Za-z]+$/.test(k)){ candidates.push(k); }  // 排除 _bak 后缀
      }
      if(candidates.length===1){ _islandKeyCache=candidates[0]; return _islandKeyCache; }
      // 多个候选: 选存档内容和当前S最接近的(learned长度一致 + totalAnswers一致)
      var best=null, bestScore=-1;
      candidates.forEach(function(k){
        try{
          var o=JSON.parse(localStorage.getItem(k));
          var score=0;
          if(o && Array.isArray(o.learned) && o.learned.length===(S.learned||[]).length) score+=2;
          if(o && o.totalAnswers===S.totalAnswers) score+=1;
          if(score>bestScore){ bestScore=score; best=k; }
        }catch(e){}
      });
      if(best){ _islandKeyCache=best; return _islandKeyCache; }
    }catch(e){}
    return null;
  }
  function reportTotals(){
    if(!window.HansenTotals) return;
    var key = detectIslandKey();
    if(!key) return;
    try{
      HansenTotals.report(key, {
        learned: (S.learned||[]).length,
        maxCombo: (S.stats&&S.stats.maxCombo)||0,
        level: S.level||1
      });
    }catch(e){}
  }

  function applyUpgrade(){
    try{ upgradeCoins(); }catch(e){ console.warn('[HansenUpgrade] coins err', e); }
    try{ upgradeAchievements(); }catch(e){ console.warn('[HansenUpgrade] ach err', e); }
    try{ upgradeMisc(); }catch(e){ console.warn('[HansenUpgrade] misc err', e); }
    try{ reportTotals(); }catch(e){}  // 进岛上报一次当前学习进度
  }

  // ========== ① 金币全局化 ==========
  // 把 addCoin/addGem(写金币)、updateTopBar(显示金币)、答对给币 都改成走全局钱包 HansenCoins。
  function upgradeCoins(){
    if(!window.HansenCoins){ return; }  // 没有全局钱包就不动(安全)
    if(window.__hsnCoinsUpgraded){ return; } window.__hsnCoinsUpgraded = true;

    // (a) 包装 addCoin: 原本 S.coins+=n, 改成 HansenCoins.add(n)
    if(typeof window.addCoin === 'function'){
      var _origAddCoin = window.addCoin;
      window.addCoin = function(n){
        n = Number(n); if(!isFinite(n)) return;
        HansenCoins.add(n);
        try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(e){}
        try{ if(typeof save==='function') save(); }catch(e){}
      };
    }
    // (b) 包装 addGem(本游戏 addGem 已并入金币): 同样走全局钱包
    if(typeof window.addGem === 'function'){
      window.addGem = function(n){
        n = Number(n); if(!isFinite(n)) return;
        HansenCoins.add(n);
        try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(e){}
        try{ if(typeof save==='function') save(); }catch(e){}
        try{ if(typeof playCoin==='function') playCoin(); }catch(e){}
      };
    }
    // (c) 包装 updateTopBar: 跑完原版后, 把顶栏金币数强制改成全局钱包的值
    if(typeof window.updateTopBar === 'function'){
      var _origUTB = window.updateTopBar;
      window.updateTopBar = function(){
        try{ _origUTB.apply(this, arguments); }catch(e){}
        try{
          var el = document.getElementById('coinCount');
          if(el) el.textContent = HansenCoins.get();
        }catch(e){}
      };
    }

    // (d) 新增 earnCoinOnCorrect(旧岛没有): 答对1题给1金币, 每词每天3次 + 每日2000上限。
    //     并挂到 markAnswer 上(答对时调用)。
    window.earnCoinOnCorrect = function(wordIdx){
      try{
        var DAILY_CAP=2000, PER_WORD_CAP=3;
        var t=(typeof today==='function')?today():new Date().toDateString();
        // 🔴 v727: 每日答题金币上限改为【全局】(整个系统跨所有岛累计·而非每岛各自2000)。超过2000只能玩拼写对战额外赚。
        var ga;
        try{ if(localStorage.getItem('hsn_ans_coin_day')!==t){ localStorage.setItem('hsn_ans_coin_day',t); localStorage.setItem('hsn_ans_coin_today','0'); ga=0; } else { ga=parseInt(localStorage.getItem('hsn_ans_coin_today'),10)||0; } }catch(e){ ga=0; }
        if(ga>=DAILY_CAP) return false;
        if(S.coinDay!==t){ S.coinDay=t; S.coinWordCount={}; }   // 每词每天次数仍按岛存档(防刷同一个词)
        if(!S.coinWordCount||typeof S.coinWordCount!=='object') S.coinWordCount={};
        var wc=S.coinWordCount[wordIdx]||0;
        if(wc>=PER_WORD_CAP) return false;
        HansenCoins.add(1);
        try{ localStorage.setItem('hsn_ans_coin_today', String(ga+1)); }catch(e){}
        S.coinWordCount[wordIdx]=wc+1;
        if(typeof updateTopBar==='function') updateTopBar();
        if(typeof save==='function') save();
        return true;
      }catch(e){ return false; }
    };

    // (e) 包装 markAnswer: 仅追加"上报学习数据到全局汇总(跨岛累计)"。
    //     🔴BUG#100 (v727): 金币/本局金币(_lastCoinGain/_sessionCoins)已由各岛自己的 markAnswer→earnCoinOnCorrect 处理
    //     (印章统一·所有19岛都有)·此处【不再重复发币】——原先此处也调 earnCoinOnCorrect → 答对双倍发金币的bug·已修。
    if(typeof window.markAnswer === 'function'){
      var _origMark = window.markAnswer;
      window.markAnswer = function(idx, correct){
        var ret = _origMark.apply(this, arguments);
        try{ reportTotals(); }catch(e){}
        return ret;
      };
    }

    // (e2) 包装 markMode: 每局游戏开始时(boss/moles/fish/bubble/scramble/speed/listen/match/typing/cloze/eagle 都调它)
    //      把本局金币累加器清零, 这样结算页显示的是"这一局"真正到手的金币。18岛自动生效。
    if(typeof window.markMode === 'function'){
      var _origMarkMode = window.markMode;
      window.markMode = function(m){
        window._sessionCoins = 0;  // 本局金币清零
        return _origMarkMode.apply(this, arguments);
      };
    }

    // (f) 新手开局送300(全局只一次 — 用全局标记, 防止每个岛各送一次)
    try{
      var STARTER_FLAG='hansen_starter_coins_given';
      if(localStorage.getItem(STARTER_FLAG)!=='1'){
        HansenCoins.add(300);
        localStorage.setItem(STARTER_FLAG,'1');
        try{ S.gotStarterCoins = true; }catch(e){}
        if(typeof updateTopBar==='function') updateTopBar();
        if(typeof save==='function') save();
      }
    }catch(e){}

    // 立刻刷新一次顶栏
    try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(e){}
  }

  // ========== ② 成就全局化 + 新成就体系 ==========
  // 覆盖旧的 ACHIEVEMENTS(43个)为新的36个(带稀有度); 覆盖 renderAch 为折叠式UI;
  // 包装 unlockAch/claimAch 走全局钱包 HansenAch; 新增 checkAch/getAchProgress/toggleAchCat。
  function upgradeAchievements(){
    if(window.__hsnAchUpgraded){ return; } window.__hsnAchUpgraded = true;

    // --- 新成就配置(替换旧的) ---
    var TIERS={bronze:{name:'铜',color:'#cd7f32',bg:'rgba(205,127,50,.15)'},silver:{name:'银',color:'#cbd5e1',bg:'rgba(203,213,225,.15)'},gold:{name:'金',color:'#fbbf24',bg:'rgba(251,191,36,.15)'},diamond:{name:'钻',color:'#22d3ee',bg:'rgba(34,211,238,.18)'}};
    var ACH=[
      {id:'w1',cat:'背单词',name:'启程',desc:'学会第 1 个单词，万里长征第一步！',icon:'🌱',tier:'bronze',reward:{gems:5}},
      {id:'w10',cat:'背单词',name:'十词成军',desc:'累计学会 10 个单词',icon:'📚',tier:'bronze',reward:{gems:15}},
      {id:'w50',cat:'背单词',name:'小有积累',desc:'累计学会 50 个单词',icon:'📗',tier:'bronze',reward:{gems:20}},
      {id:'w100',cat:'背单词',name:'词汇新星',desc:'累计学会 100 个单词',icon:'📘',tier:'silver',reward:{gems:40}},
      {id:'w300',cat:'背单词',name:'词汇达人',desc:'累计学会 300 个单词',icon:'📙',tier:'gold',reward:{gems:80}},
      {id:'wAll',cat:'背单词',name:'全部掌握',desc:'学会这个岛的全部单词！词汇王者',icon:'🎓',tier:'diamond',reward:{gems:200}},
      {id:'wrongClear',cat:'背单词',name:'错词清零',desc:'把错题本里的错词全部攻克',icon:'✅',tier:'silver',reward:{gems:50}},
      {id:'boss1',cat:'打Boss',name:'初战告捷',desc:'第一次打赢 Boss',icon:'⚔️',tier:'bronze',reward:{gems:10}},
      {id:'bossCh1',cat:'打Boss',name:'过五关',desc:'打通第 1 章（前 4 个 Boss）',icon:'🗡️',tier:'bronze',reward:{gems:30}},
      {id:'bossCh3',cat:'打Boss',name:'斩将',desc:'打通到第 3 章（累计 12 个 Boss）',icon:'🛡️',tier:'silver',reward:{gems:60}},
      {id:'boss20',cat:'打Boss',name:'屠龙勇者',desc:'通关全部 20 个 Boss！传奇征服者',icon:'👑',tier:'gold',reward:{gems:150}},
      {id:'card1',cat:'卡牌收藏',name:'初识收藏',desc:'获得第 1 张 Boss 收藏卡',icon:'🎴',tier:'bronze',reward:{gems:10}},
      {id:'cardCh1',cat:'卡牌收藏',name:'小有收藏',desc:'集齐第 1 章的 4 张卡',icon:'🃏',tier:'silver',reward:{gems:30}},
      {id:'cardUlt',cat:'卡牌收藏',name:'稀世珍藏',desc:'集齐 1 张至尊卡（0.5% 超稀有）',icon:'💎',tier:'gold',reward:{gems:50}},
      {id:'cardAll',cat:'卡牌收藏',name:'卡牌大师',desc:'集齐全部 20 张卡！收藏家的荣耀',icon:'👑',tier:'diamond',reward:{gems:300}},
      {id:'combo10',cat:'连胜',name:'小试牛刀',desc:'答题连续答对 10 次不出错',icon:'🔥',tier:'bronze',reward:{gems:10}},
      {id:'combo30',cat:'连胜',name:'势不可挡',desc:'答题连续答对 30 次不出错',icon:'🔥',tier:'silver',reward:{gems:30}},
      {id:'combo50',cat:'连胜',name:'神乎其技',desc:'答题连续答对 50 次不出错',icon:'🔥',tier:'gold',reward:{gems:60}},
      {id:'combo100',cat:'连胜',name:'百战不殆',desc:'答题连续答对 100 次不出错！',icon:'⚡',tier:'gold',reward:{gems:120}},
      {id:'s3',cat:'签到',name:'三天打卡',desc:'连续签到 3 天',icon:'📅',tier:'bronze',reward:{gems:10}},
      {id:'s7',cat:'签到',name:'一周不断',desc:'连续签到 7 天',icon:'📅',tier:'bronze',reward:{gems:20}},
      {id:'s14',cat:'签到',name:'半月坚持',desc:'连续签到 14 天',icon:'💎',tier:'silver',reward:{gems:50}},
      {id:'s100',cat:'签到',name:'百日传奇',desc:'连续签到 100 天！毅力惊人',icon:'👑',tier:'diamond',reward:{gems:200}},
      {id:'petHatch',cat:'宠物',name:'新生命',desc:'孵化你的第一只宠物',icon:'🐣',tier:'bronze',reward:{gems:10}},
      {id:'petFinal',cat:'宠物',name:'宠物大师',desc:'把宠物养到最终进化形态',icon:'🐲',tier:'gold',reward:{gems:88}},
      {id:'mode1',cat:'游戏模式',name:'初露锋芒',desc:'玩过任意一个小游戏模式',icon:'🎮',tier:'bronze',reward:{gems:10}},
      {id:'allModes',cat:'游戏模式',name:'样样精通',desc:'玩过全部小游戏模式',icon:'🎮',tier:'silver',reward:{gems:30}},
      {id:'modeHigh',cat:'游戏模式',name:'游戏高手',desc:'任意一个小游戏达到高分',icon:'🏆',tier:'silver',reward:{gems:30}},
      {id:'coin1000',cat:'里程碑',name:'小富翁',desc:'累计赚到 1000 金币',icon:'💰',tier:'bronze',reward:{gems:20}},
      {id:'gem1',cat:'里程碑',name:'钻石新贵',desc:'获得人生第 1 颗钻石',icon:'💎',tier:'bronze',reward:{gems:20}},
      {id:'lv5',cat:'里程碑',name:'小有所成',desc:'冒险等级达到 Lv.5',icon:'⭐',tier:'bronze',reward:{gems:10}},
      {id:'lv10',cat:'里程碑',name:'老将',desc:'冒险等级达到 Lv.10',icon:'🌟',tier:'silver',reward:{gems:25}},
      {id:'hidNight',cat:'隐藏',name:'夜猫子',desc:'深夜还在偷偷学习的努力孩子',icon:'🌙',tier:'silver',reward:{gems:30},hidden:true},
      {id:'hidPerfectDay',cat:'隐藏',name:'完美的一天',desc:'一天内打Boss、背新词、签到都做到了',icon:'🎂',tier:'silver',reward:{gems:40},hidden:true},
      {id:'hidLucky',cat:'隐藏',name:'欧皇附体',desc:'抽卡第一发就抽到至尊卡！天选之子',icon:'🍀',tier:'diamond',reward:{gems:200},hidden:true},
      {id:'hidComeback',cat:'隐藏',name:'卷土重来',desc:'一个Boss失败后立刻再战并打赢',icon:'🔁',tier:'bronze',reward:{gems:15},hidden:true}
    ];
    // 覆盖全局 ACHIEVEMENTS(旧岛用 const 定义, 无法直接改; 用 window 赋值, 新 renderAch 读 window.ACHIEVEMENTS)
    try{ window.ACHIEVEMENTS = ACH; }catch(e){}
    window.__hsnACH = ACH; window.__hsnTIERS = TIERS;

    // --- 注入新成就页CSS ---
    var css = ''+
    '.ach-total{background:linear-gradient(135deg,#1e1b4b,#0f172a);border:1.5px solid #4c1d95;border-radius:14px;padding:14px 16px;margin-bottom:14px}'+
    '.ach-total-row{display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:#e2e8f0;margin-bottom:8px}'+
    '.ach-total-bar{height:10px;background:rgba(148,163,184,.2);border-radius:6px;overflow:hidden}'+
    '.ach-total-fill{height:100%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:6px;transition:width .4s}'+
    '.ach-pending-tip{margin-top:10px;font-size:12px;font-weight:700;color:#fbbf24;text-align:center;background:rgba(251,191,36,.12);padding:6px;border-radius:8px}'+
    '.ach-bar{display:flex;align-items:center;gap:10px;background:linear-gradient(90deg,#1e293b,#0f172a);border:1.5px solid #334155;border-radius:12px;padding:12px 16px;margin:8px 0;cursor:pointer;user-select:none}'+
    '.ach-bar:hover{border-color:#fbbf24}.ach-bar-icon{font-size:24px}.ach-bar-name{font-size:16px;font-weight:800;color:#e2e8f0;flex:1}'+
    '.ach-bar-count{font-size:13px;font-weight:700;color:#fbbf24;background:rgba(251,191,36,.12);padding:3px 12px;border-radius:20px}'+
    '.ach-bar-arrow{font-size:12px;color:#94a3b8;width:16px;text-align:center}.ach-bar-dot{font-size:14px}'+
    '.ach-panel{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:0 0 14px;padding:2px}'+
    '.ach-card2{position:relative;background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #334155;border-radius:14px;padding:12px;opacity:.65;display:flex;flex-direction:column;min-height:130px}'+
    '.ach-card2.unlocked{opacity:1;box-shadow:0 0 14px rgba(251,191,36,.2)}'+
    '.ach-card2.pending{opacity:1;box-shadow:0 0 18px rgba(251,191,36,.4);animation:achPulse 1.6s ease-in-out infinite}'+
    '@keyframes achPulse{0%,100%{box-shadow:0 0 12px rgba(251,191,36,.3)}50%{box-shadow:0 0 22px rgba(251,191,36,.55)}}'+
    '.ach-card2-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}'+
    '.ach-icon2{font-size:34px}.ach-card2:not(.unlocked):not(.pending) .ach-icon2{filter:grayscale(.7)}'+
    '.ach-tier{font-size:11px;font-weight:800;border:1.5px solid;border-radius:8px;padding:1px 8px}'+
    '.ach-name2{font-size:15px;font-weight:800;color:#e2e8f0;margin-bottom:4px;line-height:1.25}'+
    '.ach-desc2{font-size:13px;color:#cbd5e1;line-height:1.5;flex:1}'+
    '.ach-foot2{margin-top:8px;font-size:12px;font-weight:700}'+
    '.ach-done{color:#22c55e}.ach-reward{color:#fbbf24;background:rgba(251,191,36,.12);padding:2px 10px;border-radius:8px}'+
    '.ach-claim-btn{width:100%;background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#3a2800;font-weight:800;font-size:13px;border:none;border-radius:10px;padding:7px;cursor:pointer}'+
    '.ach-prog{display:flex;align-items:center;gap:6px;margin-bottom:5px}'+
    '.ach-prog-bar{flex:1;height:7px;background:rgba(148,163,184,.2);border-radius:5px;overflow:hidden}'+
    '.ach-prog-fill{height:100%;background:linear-gradient(90deg,#60a5fa,#3b82f6);border-radius:5px}'+
    '.ach-prog-txt{font-size:11px;font-weight:700;color:#93c5fd}'+
    '.ach-new{position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px;z-index:2}'+
    // 🔴v645 挑战Boss 标签彩虹霓虹渐变(贴合街机柜风格·静态防晕·暗描边保证黄底可读·只用 drop-shadow 不用 text-shadow)
    '.boss-card-label{background:linear-gradient(96deg,#ff2e63 0%,#ff8a00 17%,#ffd60a 31%,#39e75f 49%,#16d6e6 65%,#4d7cff 82%,#b14dff 100%) !important;-webkit-background-clip:text !important;background-clip:text !important;-webkit-text-fill-color:transparent !important;color:transparent !important;text-shadow:none !important;font-weight:900 !important;letter-spacing:1.2px !important;filter:drop-shadow(0 0 2px rgba(0,0,0,.92)) drop-shadow(0 1px 2px rgba(0,0,0,.6)) drop-shadow(0 0 9px rgba(96,170,255,.5))}';
    try{ var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); }catch(e){}

    // --- 成就判定(累计型) ---
    window.checkAch = function(){
      try{
        try{ reportTotals(); }catch(e){}  // 先上报当前岛学习数据到全局汇总
        // 跨岛汇总: 学词数/连胜/等级 用全局汇总值(18岛加起来), 没有则回退单岛
        var HT=window.HansenTotals;
        var lw = HT ? Math.max(HT.totalLearned(), (S.learned||[]).length) : (S.learned||[]).length;
        var mc = HT ? Math.max(HT.maxCombo(), (S.stats&&S.stats.maxCombo)||0) : ((S.stats&&S.stats.maxCombo)||0);
        var lvl = HT ? Math.max(HT.maxLevel(), S.level||1) : (S.level||1);
        if(lw>=1)unlockAch('w1'); if(lw>=10)unlockAch('w10'); if(lw>=50)unlockAch('w50');
        if(lw>=100)unlockAch('w100'); if(lw>=300)unlockAch('w300');
        if(typeof allW!=='undefined'&&allW.length&&(S.learned||[]).length>=allW.length)unlockAch('wAll');
        if((S.learned||[]).length>0&&S.wrongs&&Object.keys(S.wrongs).length===0)unlockAch('wrongClear');
        if(mc>=10)unlockAch('combo10'); if(mc>=30)unlockAch('combo30'); if(mc>=50)unlockAch('combo50'); if(mc>=100)unlockAch('combo100');
        if(lvl>=5)unlockAch('lv5'); if(lvl>=10)unlockAch('lv10');
        var bw=Array.isArray(S.bossWon)?S.bossWon:[];
        if(bw.length>=1)unlockAch('boss1');
        if(bw.indexOf(1)>=0&&bw.indexOf(2)>=0&&bw.indexOf(3)>=0&&bw.indexOf(4)>=0)unlockAch('bossCh1');
        var ch3=true;for(var i=1;i<=12;i++){if(bw.indexOf(i)<0){ch3=false;break;}}if(ch3)unlockAch('bossCh3');
        var a20=true;for(var j=1;j<=20;j++){if(bw.indexOf(j)<0){a20=false;break;}}if(a20)unlockAch('boss20');
        if(S.streak>=3)unlockAch('s3'); if(S.streak>=7)unlockAch('s7'); if(S.streak>=14)unlockAch('s14'); if(S.streak>=100)unlockAch('s100');
        var coinNow=(window.HansenCoins&&HansenCoins.get())||S.coins||0; if(coinNow>=1000)unlockAch('coin1000');
        var gemNow=(window.HansenGems&&HansenGems.get())||0; if(gemNow>=1)unlockAch('gem1');
        if(S.pet&&S.pet.picked)unlockAch('petHatch');
        var mp=(S.stats&&S.stats.modesPlayed)||[]; if(mp.length>=1)unlockAch('mode1'); if(mp.length>=11)unlockAch('allModes');
        if(window.HansenCardbook){
          var ownedC=HansenCardbook.ownedCount();
          if(ownedC>=1)unlockAch('card1');
          if(HansenCardbook.has(1)&&HansenCardbook.has(2)&&HansenCardbook.has(3)&&HansenCardbook.has(4))unlockAch('cardCh1');
          if(HansenCardbook.ownedCountByRarity('legendary')>=1)unlockAch('cardUlt');
          if(ownedC>=20)unlockAch('cardAll');
        }
      }catch(e){}
    };

    // --- 成就进度 ---
    window.getAchProgress = function(id){
      try{
        var HT=window.HansenTotals;
        var lw = HT ? Math.max(HT.totalLearned(), (S.learned||[]).length) : (S.learned||[]).length;
        var mc = HT ? Math.max(HT.maxCombo(), (S.stats&&S.stats.maxCombo)||0) : ((S.stats&&S.stats.maxCombo)||0);
        var lvl = HT ? Math.max(HT.maxLevel(), S.level||1) : (S.level||1);
        var bw=Array.isArray(S.bossWon)?S.bossWon:[];
        var bwc=function(m){var n=0;for(var i=1;i<=m;i++)if(bw.indexOf(i)>=0)n++;return n;};
        var aw=(typeof allW!=='undefined'&&allW.length)?allW.length:712;
        var coinNow=(window.HansenCoins&&HansenCoins.get())||S.coins||0;
        var mp=(S.stats&&S.stats.modesPlayed)||[];
        var m={w1:{cur:lw,need:1},w10:{cur:lw,need:10},w50:{cur:lw,need:50},w100:{cur:lw,need:100},w300:{cur:lw,need:300},wAll:{cur:(S.learned||[]).length,need:aw},
          combo10:{cur:mc,need:10},combo30:{cur:mc,need:30},combo50:{cur:mc,need:50},combo100:{cur:mc,need:100},
          boss1:{cur:bw.length,need:1},bossCh1:{cur:bwc(4),need:4},bossCh3:{cur:bwc(12),need:12},boss20:{cur:bwc(20),need:20},
          s3:{cur:S.streak||0,need:3},s7:{cur:S.streak||0,need:7},s14:{cur:S.streak||0,need:14},s100:{cur:S.streak||0,need:100},
          lv5:{cur:lvl,need:5},lv10:{cur:lvl,need:10},coin1000:{cur:coinNow,need:1000},allModes:{cur:mp.length,need:11}}[id];
        if(!m)return null; return {cur:Math.min(m.cur,m.need),need:m.need};
      }catch(e){return null;}
    };

    // --- 包装 unlockAch: 走全局成就钱包 ---
    window.unlockAch = function(id){
      var ach=(window.ACHIEVEMENTS||[]).find(function(a){return a.id===id;}); if(!ach)return;
      if(window.HansenAch){
        if(HansenAch.unlock(id)){ if(typeof showAchPopup==='function')showAchPopup(ach); if(typeof save==='function')save(); }
      }
    };
    // --- claimAch: 领取 ---
    window.claimAch = function(id){
      var ach=(window.ACHIEVEMENTS||[]).find(function(a){return a.id===id;}); if(!ach)return;
      var ok=window.HansenAch?HansenAch.claim(id):false;
      if(!ok)return;
      // gem1「钻石新贵」名副其实发真钻石(💎); 其余成就维持原样发金币(🪙)。不动公共经济。
      if(id==='gem1' && window.HansenGems){
        if(ach.reward.gems) HansenGems.add(ach.reward.gems);
        try{playLevelUp()}catch(e){}
        try{floatText(window.innerWidth/2,250,'💎 +'+ach.reward.gems,'#60a5fa')}catch(e){}
      } else {
        if(ach.reward.gems&&typeof addGem==='function')addGem(ach.reward.gems);
        try{playLevelUp()}catch(e){}
        try{floatText(window.innerWidth/2,250,'🪙 +'+ach.reward.gems,'#fbbf24')}catch(e){}
      }
      if(typeof save==='function')save();
      if(typeof renderAch==='function')renderAch();
    };

    // --- 覆盖 renderAch: 折叠式 + 全局钱包 ---
    window.toggleAchCat = function(cat){ if(!window._achOpen)window._achOpen={}; window._achOpen[cat]=!window._achOpen[cat]; renderAch(); };
    window.renderAch = function(){
      try{checkAch();}catch(e){}
      var HA=window.HansenAch;
      var isClaimed=function(id){return HA?HA.isClaimed(id):(S.achievements||[]).includes(id);};
      var isPending=function(id){return HA?HA.isPending(id):false;};
      var isNew=function(id){return HA?HA.isNew(id):false;};
      var claimedAll=function(){return HA?HA.getClaimed():(S.achievements||[]);};
      var pendCount=function(){return HA?HA.pendingCount():0;};
      if(!window._achOpen)window._achOpen={'背单词':true};
      var cats=['背单词','打Boss','卡牌收藏','连胜','签到','宠物','游戏模式','里程碑','隐藏'];
      var ci={'背单词':'📖','打Boss':'⚔️','卡牌收藏':'🎴','连胜':'🔥','签到':'📅','宠物':'🐾','游戏模式':'🎮','里程碑':'💰','隐藏':'🎭'};
      var ACHL=window.ACHIEVEMENTS||[], T=window.__hsnTIERS;
      var cc=claimedAll().length, tot=ACHL.length, pct=Math.round(cc/tot*100), pc=pendCount();
      var h='<div class="ach-total"><div class="ach-total-row"><span>🏆 成就总进度（全部岛屿汇总）</span><span>'+cc+' / '+tot+'（'+pct+'%）</span></div>'+
            '<div class="ach-total-bar"><div class="ach-total-fill" style="width:'+pct+'%"></div></div>'+
            (pc>0?'<div class="ach-pending-tip">🎁 有 '+pc+' 个成就可以领取奖励！</div>':'')+'</div>';
      cats.forEach(function(cat){
        var list=ACHL.filter(function(a){return a.cat===cat;}); if(!list.length)return;
        var cin=list.filter(function(a){return isClaimed(a.id);}).length;
        var pin=list.filter(function(a){return isPending(a.id);}).length;
        var open=!!window._achOpen[cat];
        h+='<div class="ach-bar" onclick="toggleAchCat(\''+cat+'\')"><span class="ach-bar-icon">'+ci[cat]+'</span>'+
           '<span class="ach-bar-name">'+cat+(pin>0?' <span class="ach-bar-dot">🎁</span>':'')+'</span>'+
           '<span class="ach-bar-count">'+cin+'/'+list.length+'</span><span class="ach-bar-arrow">'+(open?'▼':'▶')+'</span></div>';
        if(open){
          h+='<div class="ach-panel">';
          list.forEach(function(a){
            var cl=isClaimed(a.id), pd=isPending(a.id), nw=isNew(a.id), t=T[a.tier]||T.bronze;
            var hid=a.hidden&&!cl&&!pd;
            var icon=(cl||pd)?a.icon:(hid?'❓':'🔒'), name=hid?'？？？':a.name, desc=hid?'达成隐藏条件即可解锁，等你来发现！':a.desc;
            var cls='ach-card2'+(cl?' unlocked':'')+(pd?' pending':''), stl=(cl||pd)?'border-color:'+t.color+';background:'+t.bg:'';
            var foot;
            if(pd){foot='<button class="ach-claim-btn" onclick="event.stopPropagation();claimAch(\''+a.id+'\')">🎁 领取 +'+a.reward.gems+'</button>';}
            else if(cl){foot='<span class="ach-done">✅ 已领取</span>';}
            else{var pr=hid?null:getAchProgress(a.id);
              if(pr&&pr.need>1){var pp=Math.round(pr.cur/pr.need*100);
                foot='<div class="ach-prog"><div class="ach-prog-bar"><div class="ach-prog-fill" style="width:'+pp+'%"></div></div><span class="ach-prog-txt">'+pr.cur+'/'+pr.need+'</span></div><span class="ach-reward">'+((a.id==='gem1')?'💎':'🪙')+a.reward.gems+'</span>';}
              else{foot='<span class="ach-reward">'+((a.id==='gem1')?'💎':'🪙')+a.reward.gems+'</span>';}}
            h+='<div class="'+cls+'" style="'+stl+'">'+(nw?'<span class="ach-new">NEW</span>':'')+
               '<div class="ach-card2-top"><span class="ach-icon2">'+icon+'</span><span class="ach-tier" style="color:'+t.color+';border-color:'+t.color+'">'+t.name+'</span></div>'+
               '<div class="ach-name2"'+((cl||pd)?' style="color:'+t.color+'"':'')+'>'+name+'</div><div class="ach-desc2">'+desc+'</div><div class="ach-foot2">'+foot+'</div></div>';
          });
          h+='</div>';
        }
      });
      var al=document.getElementById('achList'); if(al)al.innerHTML=h;
      var ec=document.getElementById('achCount'); if(ec)ec.textContent=cc;
      var et=document.getElementById('achTotal'); if(et)et.textContent=tot;
    };

    // 如果当前正在成就页, 立刻重渲染
    try{ if(typeof renderAch==='function') renderAch(); }catch(e){}
  }

  // ========== ③ 其他改善: 去顶栏星星 / 去宝箱 / 连胜给金币 / 金币说明书 ==========
  function upgradeMisc(){
    if(window.__hsnMiscUpgraded){ return; } window.__hsnMiscUpgraded = true;

    // (a) 去掉顶栏星星徽章(CSS隐藏 #starCount 所在的徽章; 学单词亮⭐的功能不动)
    try{
      var st=document.createElement('style');
      st.textContent='.stat-badge.gold{display:none !important}';
      document.head.appendChild(st);
      // 同时把星星徽章元素直接隐藏(双保险)
      var sc=document.getElementById('starCount');
      if(sc && sc.parentElement) sc.parentElement.style.display='none';
    }catch(e){}

    // (b) 去宝箱: 三个宝箱函数包装成空转(不再弹银/金/钻石/传说宝箱)
    ['openRandomChest','grantChestSilent','openSpecificChest'].forEach(function(fn){
      if(typeof window[fn]==='function'){ window[fn]=function(){ return; }; }
    });

    // (c) 连胜里程碑给金币(包装 triggerMilestone): 原版可能给钻石/星星, 统一改成给金币+不给星星不给宝箱。
    //     连胜数值: 5连2/10连5/20连10/30连15/50连25/100连50。
    if(typeof window.triggerMilestone==='function'){
      var COINMAP={5:2,10:5,20:10,30:15,50:25,100:50};
      window.triggerMilestone=function(m){
        try{
          if(!m)return;
          var coin = COINMAP[m.at] || Math.min(3+Math.floor((m.at||0)/20),30);
          if(typeof addGem==='function') addGem(coin);  // addGem已被包装成走全局金币钱包
          // 顶部连胜框显示
          var rt=' 🪙<b>+'+coin+'</b>';
          if(window._newShieldThisHit) rt+=' 🛡️<b>护盾+1</b>';
          var emoji=m.emoji||'🔥';
          if(typeof flashComboBadge==='function'){
            flashComboBadge('<span class="combo-num">'+emoji+' '+m.at+' 连胜</span><span class="combo-mul">'+rt+'</span>',
              'linear-gradient(90deg,#f59e0b,#dc2626)', 2600);
          }
          try{ if(typeof flashTopBar==='function') flashTopBar(); }catch(e){}
          try{ if(typeof playLevelUp==='function') playLevelUp(); }catch(e){}
          if(m.at>=50){ try{ if(typeof bigConfetti==='function') bigConfetti(); }catch(e){} }
        }catch(e){}
      };
    }

    // (d) 连胜框显示金币(包装 showComboUI): 显示 "🔥 N · 🪙+1" 或 "🪙满"
    if(typeof window.showComboUI==='function'){
      window.showComboUI=function(){
        try{
          var c=window._comboCount; if(c<2)return;
          var ui=document.getElementById('comboBadge');
          if(!ui){ ui=document.createElement('div'); ui.id='comboBadge'; ui.className='combo-badge'; document.body.appendChild(ui); }
          var label=(typeof getComboLabel==='function')?getComboLabel():'🔥';
          var colors=(typeof getComboColor==='function')?getComboColor():['#f59e0b','#dc2626'];
          var bg=colors.length===3?'linear-gradient(90deg,'+colors[0]+','+colors[1]+','+colors[2]+')':'linear-gradient(90deg,'+colors[0]+','+colors[1]+')';
          // 🔒 HSN_COMBO_POS 铁律v608: 连胜框基准=经验进度条(稳定不随金币位漂移), 顶部贴进度条下方2px不碰经验条, 落在进度条→黑框底部之间; 改这里务必同步19岛island showComboUI/flashComboBadge + check_resources守卫
          var _xpb=document.querySelector('.top-bar .xp-bar'); var _tbar=document.querySelector('.top-bar');
          if(_xpb){ ui.style.top=(_xpb.getBoundingClientRect().bottom+2)+'px'; } else if(_tbar){ ui.style.top=(_tbar.getBoundingClientRect().bottom-26)+'px'; }
          ui.style.background=bg;
          var sh=''; if(window._comboShields>0){ sh=' · '; for(var i=0;i<window._comboShields;i++) sh+='🛡️'; }
          var le=(label&&label.length>0)?label.split(' ')[0]:'🔥';
          var coinHtml=(window._lastCoinGain===1)?'· 🪙+1':'· 🪙满';
          ui.innerHTML='<span class="combo-num">'+le+' '+c+'</span><span class="combo-mul">'+coinHtml+'</span>'+(sh?'<span class="combo-shields">'+sh+'</span>':'');
          ui.classList.remove('combo-pop'); void ui.offsetWidth; ui.classList.add('combo-pop'); ui.classList.add('show');
        }catch(e){}
      };
    }

    // (e) 金币说明书(包装 renderSettings): 跑完原版后, 在设置内容里插入金币说明section
    if(typeof window.renderSettings==='function'){
      var _origRS=window.renderSettings;
      window.renderSettings=function(){
        try{ _origRS.apply(this, arguments); }catch(e){}
        try{
          var box=document.getElementById('settingsContent'); if(!box)return;
          if(document.getElementById('hsnCoinGuide'))return; // 防重复插入
          var guide=document.createElement('div');
          guide.id='hsnCoinGuide';
          guide.className='settings-section';
          guide.style.borderColor='rgba(251,191,36,.35)';
          guide.innerHTML=''+
            '<h3 style="color:#fbbf24">💰 金币说明书</h3>'+
            '<div class="desc" style="line-height:1.7">金币用来抽卡、买主题、复活。下面是怎么赚金币：</div>'+
            '<div class="settings-stat" style="display:block;padding:10px 12px;line-height:1.9"><div><b style="color:#fbbf24">📖 答对单词</b> — 每答对 1 题给 <b style="color:#fbbf24">1 金币</b>。</div>'+
            '<div style="color:#fca5a5">⚠️ 同一个单词，每天最多给 <b>3 次</b>金币！超过 3 次就不给了（但可以继续练）。<br>💡 想多赚就答更多<b>不同的</b>单词 —— 鼓励你多背单词。</div>'+
            '<div style="color:#94a3b8">（每天答题最多 2000 金币，次日重置）</div></div>'+
            '<div class="settings-stat" style="display:block;padding:10px 12px;line-height:1.9"><div><b style="color:#fbbf24">⚔️ 打赢 Boss</b> — 每打赢新 Boss：第1章20/第2章30/第3章40/第4-5章50，重复打给5。</div></div>'+
            '<div class="settings-stat" style="display:block;padding:10px 12px;line-height:1.9"><div><b style="color:#fbbf24">📅 每日签到</b> — 每天第一次开宝箱给 10~300 金币。</div></div>'+
            '<div class="settings-stat" style="display:block;padding:10px 12px;line-height:1.9"><div><b style="color:#fbbf24">🔥 连胜奖励</b> — 5/10/20/30/50/100 连胜给额外金币，答错清零。</div></div>'+
            '<div class="settings-stat" style="display:block;padding:10px 12px;line-height:1.9"><div><b style="color:#fbbf24">🎯 任务 / 成就</b> — 完成给金币。</div></div>'+
            '<div class="desc" style="margin-top:8px;color:#94a3b8">🪙 金币全游戏通用：在任何岛赚的，所有岛都能用。</div>';
          box.appendChild(guide);
        }catch(e){}
      };
    }
  }

  // 启动: 等 DOM + 游戏脚本就绪
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(applyUpgrade, 300);
  }else{
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(applyUpgrade, 300); });
  }
})();
