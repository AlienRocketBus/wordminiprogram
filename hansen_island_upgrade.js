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
      if(window.__hsnSaveKey){ _islandKeyCache=window.__hsnSaveKey; return _islandKeyCache; }
    }catch(e){}
    try{
      // 方法1: 从 save 源码提取(有的岛save直接写key)
      if(typeof window.save === 'function'){
        var m = window.save.toString().match(/setItem\(['"](wordIsland[A-Za-z0-9]+)['"]/);
        if(m){ _islandKeyCache = m[1]; return _islandKeyCache; }
      }
    }catch(e){}
    try{
      // 方法2(可靠): 扫描 localStorage, 找当前岛在用的 wordIsland* key。
      //   当前岛的存档对象里有 learned 字段且和内存 S 的特征一致。优先匹配 learned 长度一致的。
      var candidates=[];
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(/^wordIsland[A-Za-z0-9]+$/.test(k)){ candidates.push(k); }  // 排除 _bak 后缀
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

    // v942 首次启用 first-win 幂等奖励账本时，把本岛历史 bossWon 记为已发，
    // 避免升级/重置后给老通关记录再发一次首胜奖。
    try{
      if(HansenCoins.seedAwards){
        var pm=(location.pathname||'').match(/island_([a-z0-9]+)\.html/i),physical=pm?pm[1].toLowerCase():'unknown',seed=[];
        var seedKey='hansen_boss_awards_seeded_v942_'+physical;
        if(localStorage.getItem(seedKey)!=='1'){
          (Array.isArray(S.bossWon)?S.bossWon:[]).forEach(function(v){var m=String(v).match(/b(\d+)$/i),lv=m?Number(m[1]):Number(v);if(isFinite(lv)&&lv>0)seed.push('boss:first:'+physical+':'+Math.floor(lv));});
          if(HansenCoins.seedAwards(seed)){localStorage.setItem(seedKey,'1');}
        }
      }
    }catch(e){}

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

    // (d) 答对金币：每题 1 金币、每个 canonical 词位每天 3 次、全游戏每天 2000。
    //     v941 不能再把次数只记在当前物理页 S.coinWordCount：Land1~8 与 Season 是
    //     同一批 240 词的不同入口，换入口不应重置同一词的 3 次额度。
    var ANSWER_LEDGER_KEY='hansen_answer_coin_words_v942',ANSWER_PENDING_KEY='hansen_answer_coin_pending_v942';
    function answerCoinMirror(ledger){
      // v941/旧 UI 只做镜像，任何失败都不影响 v942 单文件权威提交；下一次读取会自动修复。
      try{localStorage.setItem('hansen_answer_coin_words_v941',JSON.stringify({version:941,day:ledger.day,words:ledger.words}));}catch(e){}
      try{localStorage.setItem('hsn_ans_coin_day',ledger.day);localStorage.setItem('hsn_ans_coin_today',String(ledger.total));}catch(e){}
    }
    function writeAnswerCoinLedger(ledger){
      try{var raw=JSON.stringify(ledger);localStorage.setItem(ANSWER_LEDGER_KEY,raw);if(localStorage.getItem(ANSWER_LEDGER_KEY)!==raw)return false;answerCoinMirror(ledger);return true;}catch(e){return false;}
    }
    function answerCoinLedger(t){
      var ledger=null,raw=null;
      try{raw=localStorage.getItem(ANSWER_LEDGER_KEY);ledger=raw?JSON.parse(raw):null;}catch(e){return null;}
      if(ledger&&ledger.version===942&&ledger.day===t&&ledger.words&&typeof ledger.words==='object'&&!Array.isArray(ledger.words)){
        var clean={},sum=0;Object.keys(ledger.words).forEach(function(k){var n=Math.max(0,Math.min(3,Math.floor(Number(ledger.words[k])||0)));if(n){clean[k]=n;sum+=n;}});ledger.words=clean;
        var oldTotal=0;try{if(localStorage.getItem('hsn_ans_coin_day')===t)oldTotal=Math.max(0,Math.min(2000,Math.floor(Number(localStorage.getItem('hsn_ans_coin_today'))||0)));}catch(e){}
        ledger.total=Math.max(Math.max(0,Math.min(2000,Math.floor(Number(ledger.total)||0))),Math.min(2000,sum),oldTotal);
        // 旧 v942 账本没有 total，立即升级为“每词+日总量”同一原子 JSON。
        if(raw!==JSON.stringify(ledger)&&!writeAnswerCoinLedger(ledger))return null;answerCoinMirror(ledger);return ledger;
      }
      ledger={version:942,day:t,total:0,words:{}};
      // 接住 v941 当天已经记入的 canonical 额度。
      try{var old=JSON.parse(localStorage.getItem('hansen_answer_coin_words_v941')||'null');if(old&&old.day===t&&old.words)Object.keys(old.words).forEach(function(k){ledger.words[k]=Math.max(+ledger.words[k]||0,+old.words[k]||0);});}catch(e){}
      // 升级当天扫描所有旧物理页，按 canonical slot 取 max，换 Season/Land 入口也不能再领 3 次。
      try{
        for(var i=0;i<localStorage.length;i++){
          var key=localStorage.key(i);if(!key||!/^wordIsland/.test(key)||/_bak$|_backup$|_tmp$/i.test(key))continue;
          var s;try{s=JSON.parse(localStorage.getItem(key)||'null');}catch(e){continue;}
          if(!s||s.coinDay!==t||!s.coinWordCount||typeof s.coinWordCount!=='object')continue;
          Object.keys(s.coinWordCount).forEach(function(idx){
            var slot='';try{if(window.HansenCanonical)slot=HansenCanonical.slotId(key,idx);}catch(e){}
            if(!slot)slot=key+':'+String(idx|0);
            ledger.words[slot]=Math.max(+ledger.words[slot]||0,+s.coinWordCount[idx]||0);
          });
        }
        var oldDaily=0;if(localStorage.getItem('hsn_ans_coin_day')===t)oldDaily=Math.max(0,Math.min(2000,Math.floor(Number(localStorage.getItem('hsn_ans_coin_today'))||0)));
        var sum=0;Object.keys(ledger.words).forEach(function(k){var n=Math.max(0,Math.min(3,Math.floor(Number(ledger.words[k])||0)));ledger.words[k]=n;sum+=n;});ledger.total=Math.max(oldDaily,Math.min(2000,sum));
      }catch(e){return null;}
      return writeAnswerCoinLedger(ledger)?ledger:null;
    }
    function readAnswerPending(){try{var raw=localStorage.getItem(ANSWER_PENDING_KEY);if(raw===null)return null;var p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:{invalid:1};}catch(e){return {invalid:1};}}
    function validAnswerPending(p){return !!(p&&!p.invalid&&p.version===942&&typeof p.day==='string'&&p.day.length<=24&&typeof p.slot==='string'&&p.slot.length>0&&p.slot.length<=100&&!/[\u0000-\u001f\u007f]/.test(p.slot)&&Number.isInteger(p.ordinal)&&p.ordinal>=1&&p.ordinal<=3&&Number.isInteger(p.beforeTotal)&&p.beforeTotal>=0&&p.beforeTotal<2000&&p.targetTotal===p.beforeTotal+1&&p.id==='answer:'+p.day+':'+p.slot+':'+p.ordinal);}
    function clearAnswerPending(){try{localStorage.removeItem(ANSWER_PENDING_KEY);return localStorage.getItem(ANSWER_PENDING_KEY)===null;}catch(e){return false;}}
    function awardAnswer(p){
      if(HansenCoins.award)return HansenCoins.award(p.id,1)===true;
      var before=HansenCoins.get();HansenCoins.add(1);return HansenCoins.get()===before+1;
    }
    function recoverAnswerCoin(){
      var p=readAnswerPending();if(!p)return {ok:true,pending:false};
      if(!validAnswerPending(p)){clearAnswerPending();return {ok:false,pending:true,invalid:true};}
      if(!awardAnswer(p))return {ok:false,pending:true};
      var now=(typeof today==='function')?today():new Date().toDateString();
      if(p.day===now){
        var ledger=answerCoinLedger(now);if(!ledger)return {ok:false,pending:true};
        ledger.words[p.slot]=Math.max(Math.floor(Number(ledger.words[p.slot])||0),p.ordinal);
        ledger.total=Math.max(Math.floor(Number(ledger.total)||0),p.targetTotal);
        if(ledger.total>2000||!writeAnswerCoinLedger(ledger))return {ok:false,pending:true};
      }
      var cleaned=clearAnswerPending();return {ok:true,pending:!cleaned,recovered:true,id:p.id};
    }
    window.earnCoinOnCorrect = function(wordIdx){
      try{
        var DAILY_CAP=2000, PER_WORD_CAP=3;
        var t=(typeof today==='function')?today():new Date().toDateString();
        // 先续做上一笔中断奖励；sourceId 使金币重放 no-op，权威 JSON 同时提交每词次数+全局日上限。
        var recovered=recoverAnswerCoin();if(!recovered.ok)return false;
        if(S.coinDay!==t){ S.coinDay=t; S.coinWordCount={}; }
        if(typeof window.__hsnNormalizeCoinWordCount==='function')S.coinWordCount=window.__hsnNormalizeCoinWordCount(S.coinWordCount);
        else if(!S.coinWordCount||typeof S.coinWordCount!=='object'||Array.isArray(S.coinWordCount))S.coinWordCount={};
        var ledger=answerCoinLedger(t);if(!ledger)return false;
        var ga=Math.max(0,Math.floor(Number(ledger.total)||0));if(ga>=DAILY_CAP)return false;
        var slot='';
        try{
          if(window.HansenCanonical&&typeof HansenCanonical.slotId==='function'){
            slot=HansenCanonical.slotId(HansenCanonical.currentRef(),wordIdx);
          }
        }catch(_canonicalErr){}
        if(!slot) slot=String(detectIslandKey()||'unknown')+':'+String(wordIdx|0);
        // 老版本当前页当天已经计过的次数取 max，升级当天也不能凭空重置额度。
        var localCount=typeof window.__hsnSafeCoinWordCount==='function'?window.__hsnSafeCoinWordCount(S.coinWordCount[wordIdx]):0;
        var ledgerCount=Number(ledger.words[slot]);if(!Number.isInteger(ledgerCount)||ledgerCount<0||ledgerCount>3)ledgerCount=0;
        var wc=Math.max(ledgerCount,localCount);
        if(wc>=PER_WORD_CAP) return false;
        // v942 先用稳定 sourceId 幂等发币，再提交次数账本。若次数账本写失败，
        // 重试同一 ordinal 的 award 只会 no-op，不会丢币、重复币或白耗额度。
        var answerAwardId='answer:'+t+':'+slot+':'+String(wc+1),pending={version:942,day:t,slot:slot,ordinal:wc+1,beforeTotal:ga,targetTotal:ga+1,id:answerAwardId};
        try{var pendingRaw=JSON.stringify(pending);localStorage.setItem(ANSWER_PENDING_KEY,pendingRaw);if(localStorage.getItem(ANSWER_PENDING_KEY)!==pendingRaw)return false;}catch(_prepare){return false;}
        if(!awardAnswer(pending))return false;
        ledger.words[slot]=wc+1;ledger.total=ga+1;if(!writeAnswerCoinLedger(ledger))return false;
        clearAnswerPending();
        S.coinWordCount[wordIdx]=wc+1; // 兼容旧 UI/备份；权威次数是上面的 canonical 账本。
        if(typeof updateTopBar==='function') updateTopBar();
        if(typeof save==='function') save();
        return true;
      }catch(e){ return false; }
    };
    // 页面重载时不等下一道题，直接续做已有 pending。
    try{recoverAnswerCoin();}catch(e){}

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

    // (f) 新手开局送300：只复用钱包的永久 sourceId，绝不再走 add(300)。
    // 钱包奖励已提交但 flag 写失败时，这里重放 starter:global 只会 no-op，再补 flag。
    try{
      var STARTER_FLAG='hansen_starter_coins_given';
      if(localStorage.getItem(STARTER_FLAG)!=='1'){
        if(HansenCoins.award&&HansenCoins.award('starter:global',300)===true){
          localStorage.setItem(STARTER_FLAG,'1');
          try{ S.gotStarterCoins = true; }catch(e){}
          if(typeof updateTopBar==='function') updateTopBar();
          if(typeof save==='function') save();
        }
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
      {id:'w1',cat:'背单词',name:'启程',desc:'认识并加入第 1 个单词，万里长征第一步！',icon:'🌱',tier:'bronze',reward:{gems:5}},
      {id:'w10',cat:'背单词',name:'十词成军',desc:'累计认识 10 个单词',icon:'📚',tier:'bronze',reward:{gems:15}},
      {id:'w50',cat:'背单词',name:'小有积累',desc:'累计认识 50 个单词',icon:'📗',tier:'bronze',reward:{gems:20}},
      {id:'w100',cat:'背单词',name:'词汇新星',desc:'累计认识 100 个单词',icon:'📘',tier:'silver',reward:{gems:40}},
      {id:'w300',cat:'背单词',name:'词汇达人',desc:'累计认识 300 个单词',icon:'📙',tier:'gold',reward:{gems:80}},
      {id:'wAll',cat:'背单词',name:'全岛已认识',desc:'把这个岛的全部单词加入学习！',icon:'🎓',tier:'diamond',reward:{gems:200}},
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
      {id:'modeHigh',cat:'游戏模式',name:'游戏高手',desc:'任意一种小游戏累计完成 10 局',icon:'🏆',tier:'silver',reward:{gems:30}},
      {id:'coin1000',cat:'里程碑',name:'小富翁',desc:'累计获得 1000 金币（花掉也计入）',icon:'💰',tier:'bronze',reward:{gems:20}},
      {id:'gem1',cat:'里程碑',name:'钻石新贵',desc:'获得人生第 1 颗钻石',icon:'💎',tier:'bronze',reward:{gems:20}},
      {id:'lv5',cat:'里程碑',name:'小有所成',desc:'冒险等级达到 Lv.5',icon:'⭐',tier:'bronze',reward:{gems:10}},
      {id:'lv10',cat:'里程碑',name:'老将',desc:'冒险等级达到 Lv.10',icon:'🌟',tier:'silver',reward:{gems:25}},
      // HF2: 保留旧 id 是为了不让已解锁/待领取的老存档变成孤儿；规则已从“深夜学习”改为健康时段学习。
      {id:'hidNight',cat:'隐藏',name:'健康学习家',desc:'在合适的时间专心学习，也记得按时休息',icon:'☀️',tier:'silver',reward:{gems:30},hidden:true},
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
    '.ach-new{position:absolute;top:-6px;right:-6px;background:#b91c1c;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px;box-shadow:0 2px 6px rgba(127,29,29,.45);z-index:2}'+
    // 🔴v645 挑战Boss 标签彩虹霓虹渐变(贴合街机柜风格·静态防晕·暗描边保证黄底可读·只用 drop-shadow 不用 text-shadow)
    '.boss-card-label{background:linear-gradient(96deg,#ff2e63 0%,#ff8a00 17%,#ffd60a 31%,#39e75f 49%,#16d6e6 65%,#4d7cff 82%,#b14dff 100%) !important;-webkit-background-clip:text !important;background-clip:text !important;-webkit-text-fill-color:transparent !important;color:transparent !important;text-shadow:none !important;font-weight:900 !important;letter-spacing:1.2px !important;filter:drop-shadow(0 0 2px rgba(0,0,0,.92)) drop-shadow(0 1px 2px rgba(0,0,0,.6)) drop-shadow(0 0 9px rgba(96,170,255,.5))}';
    try{ var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); }catch(e){}

    // v942 成就信号总账：隐藏成就不能只写配置，必须有可验证、跨岛统一的触发事实。
    function achToday(){try{return typeof today==='function'?today():new Date().toDateString();}catch(e){return new Date().toDateString();}}
    function readDaily(){
      var day=achToday(),o=null;try{o=JSON.parse(localStorage.getItem('hansen_ach_daily_v942')||'null');}catch(e){}
      if(!o||o.day!==day)o={day:day,learned:false,boss:false,healthy:false};return o;
    }
    function noteDaily(field){var o=readDaily();o[field]=true;try{localStorage.setItem('hansen_ach_daily_v942',JSON.stringify(o));}catch(e){}return o;}
    function globalModes(){
      var played={},counts={},current=detectIslandKey();
      function take(s){if(!s||typeof s!=='object')return;var st=s.stats||{};(Array.isArray(st.modesPlayed)?st.modesPlayed:[]).forEach(function(x){if(typeof x==='string')played[x]=1;});var gc=st.gameCounts||{};Object.keys(gc).forEach(function(k){var n=Number(gc[k]);if(isFinite(n)&&n>0)counts[k]=(counts[k]||0)+Math.floor(n);});}
      try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k||!/^wordIsland/.test(k)||/_bak$|_backup$|_tmp$/i.test(k)||k===current)continue;try{take(JSON.parse(localStorage.getItem(k)||'null'));}catch(e){}}}catch(e){}
      take(S);var max=0;Object.keys(counts).forEach(function(k){max=Math.max(max,counts[k]);});return {played:Object.keys(played),counts:counts,max:max};
    }
    function wrongTotal(HC){var n=0;try{if(HC){var st=HC.read();HC.islands.forEach(function(i){var w=st.islands[i.id].wrongs||{};Object.keys(w).forEach(function(k){n+=Math.max(0,Number(w[k])||0);});});}else n=Object.keys(S.wrongs||{}).length;}catch(e){}if(n>0)try{localStorage.setItem('hansen_wrong_seen_v942','1');}catch(e){}return n;}
    function maxGameCount(){return globalModes().max;}

    // --- 成就判定(累计型) ---
    window.checkAch = function(){
      try{
        try{ reportTotals(); }catch(e){}  // 先上报当前岛学习数据到全局汇总
        // 跨岛汇总: 学词数/连胜/等级 用全局汇总值(18岛加起来), 没有则回退单岛
        var HT=window.HansenTotals, HC=window.HansenCanonical;
        try{if(HC)HC.absorbCurrent();}catch(e){}
        var lw = HC ? HC.totalLearned() : (HT ? Math.max(HT.totalLearned(), (S.learned||[]).length) : (S.learned||[]).length);
        var mc = HT ? Math.max(HT.maxCombo(), (S.stats&&S.stats.maxCombo)||0) : ((S.stats&&S.stats.maxCombo)||0);
        var lvl = HT ? Math.max(HT.maxLevel(), S.level||1) : (S.level||1);
        if(lw>=1)unlockAch('w1'); if(lw>=10)unlockAch('w10'); if(lw>=50)unlockAch('w50');
        if(lw>=100)unlockAch('w100'); if(lw>=300)unlockAch('w300');
        if(typeof allW!=='undefined'&&allW.length&&(S.learned||[]).length>=allW.length)unlockAch('wAll');
        if(lw>0&&wrongTotal(HC)===0&&localStorage.getItem('hansen_wrong_seen_v942')==='1')unlockAch('wrongClear');
        if(mc>=10)unlockAch('combo10'); if(mc>=30)unlockAch('combo30'); if(mc>=50)unlockAch('combo50'); if(mc>=100)unlockAch('combo100');
        if(lvl>=5)unlockAch('lv5'); if(lvl>=10)unlockAch('lv10');
        var bw=Array.isArray(S.bossWon)?S.bossWon:[];
        if(bw.length>=1)unlockAch('boss1');
        if(bw.indexOf(1)>=0&&bw.indexOf(2)>=0&&bw.indexOf(3)>=0&&bw.indexOf(4)>=0)unlockAch('bossCh1');
        var ch3=true;for(var i=1;i<=12;i++){if(bw.indexOf(i)<0){ch3=false;break;}}if(ch3)unlockAch('bossCh3');
        var a20=true;for(var j=1;j<=20;j++){if(bw.indexOf(j)<0){a20=false;break;}}if(a20)unlockAch('boss20');
        if(S.streak>=3)unlockAch('s3'); if(S.streak>=7)unlockAch('s7'); if(S.streak>=14)unlockAch('s14'); if(S.streak>=100)unlockAch('s100');
        var coinEarned=(window.HansenCoins&&HansenCoins.getEarned)?HansenCoins.getEarned():((window.HansenCoins&&HansenCoins.get())||S.coins||0); if(coinEarned>=1000)unlockAch('coin1000');
        var gemNow=(window.HansenGems&&HansenGems.get())||0; if(gemNow>=1)unlockAch('gem1');
        if(S.pet&&S.pet.picked)unlockAch('petHatch');
        var gm=globalModes(),mp=gm.played;if(mp.length>=1)unlockAch('mode1'); if(mp.length>=11)unlockAch('allModes');
        if(maxGameCount()>=10)unlockAch('modeHigh');
        try{if(typeof getPetStage==='function'&&window.PET_STAGES&&getPetStage()>=PET_STAGES.length-1)unlockAch('petFinal');}catch(e){}
        if(window.HansenCardbook){
          var ownedC=HansenCardbook.ownedCount();
          if(ownedC>=1)unlockAch('card1');
          if(HansenCardbook.has(1)&&HansenCardbook.has(2)&&HansenCardbook.has(3)&&HansenCardbook.has(4))unlockAch('cardCh1');
          if(HansenCardbook.ownedCountByRarity('legendary')>=1)unlockAch('cardUlt');
          if(ownedC>=20)unlockAch('cardAll');
          if(HansenCardbook.getTotalDraws&&HansenCardbook.getTotalDraws()===1&&HansenCardbook.ownedCountByRarity('legendary')>=1)unlockAch('hidLucky');
        }
        var daily=readDaily();
        if(daily.healthy)unlockAch('hidNight');
        var checked=false;try{checked=!!(window.HansenCheckin&&HansenCheckin.claimedToday&&HansenCheckin.claimedToday());}catch(e){}
        if(daily.learned&&daily.boss&&checked)unlockAch('hidPerfectDay');
      }catch(e){}
    };

    // --- 成就进度 ---
    window.getAchProgress = function(id){
      try{
        var HT=window.HansenTotals, HC=window.HansenCanonical;
        try{if(HC)HC.absorbCurrent();}catch(e){}
        var lw = HC ? HC.totalLearned() : (HT ? Math.max(HT.totalLearned(), (S.learned||[]).length) : (S.learned||[]).length);
        var mc = HT ? Math.max(HT.maxCombo(), (S.stats&&S.stats.maxCombo)||0) : ((S.stats&&S.stats.maxCombo)||0);
        var lvl = HT ? Math.max(HT.maxLevel(), S.level||1) : (S.level||1);
        var bw=Array.isArray(S.bossWon)?S.bossWon:[];
        var bwc=function(m){var n=0;for(var i=1;i<=m;i++)if(bw.indexOf(i)>=0)n++;return n;};
        var aw=(typeof allW!=='undefined'&&allW.length)?allW.length:712;
        var coinNow=(window.HansenCoins&&HansenCoins.getEarned)?HansenCoins.getEarned():((window.HansenCoins&&HansenCoins.get())||S.coins||0);
        var gm=globalModes(),mp=gm.played;
        var m={w1:{cur:lw,need:1},w10:{cur:lw,need:10},w50:{cur:lw,need:50},w100:{cur:lw,need:100},w300:{cur:lw,need:300},wAll:{cur:(S.learned||[]).length,need:aw},
          combo10:{cur:mc,need:10},combo30:{cur:mc,need:30},combo50:{cur:mc,need:50},combo100:{cur:mc,need:100},
          boss1:{cur:bw.length,need:1},bossCh1:{cur:bwc(4),need:4},bossCh3:{cur:bwc(12),need:12},boss20:{cur:bwc(20),need:20},
          s3:{cur:S.streak||0,need:3},s7:{cur:S.streak||0,need:7},s14:{cur:S.streak||0,need:14},s100:{cur:S.streak||0,need:100},
          lv5:{cur:lvl,need:5},lv10:{cur:lvl,need:10},coin1000:{cur:coinNow,need:1000},allModes:{cur:mp.length,need:11},modeHigh:{cur:gm.max,need:10}}[id];
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
      if(!window.HansenAch||!HansenAch.isPending(id))return;
      var amount=Math.max(0,Math.floor(Number(ach.reward&&ach.reward.gems)||0));
      var paid=id==='gem1'?(window.HansenGems&&HansenGems.award&&HansenGems.award('achievement:'+id,amount)):(window.HansenCoins&&HansenCoins.award&&HansenCoins.award('achievement:'+id,amount));
      if(!paid){try{showToast('⚠️ 奖励暂未安全入账，成就仍保留待领取，请稍后重试')}catch(e){}return;}
      if(!HansenAch.claim(id)){try{showToast('⚠️ 奖励已安全记账，领取状态保存失败；再次点击不会重复发奖')}catch(e){}return;}
      try{playLevelUp()}catch(e){}
      try{floatText(window.innerWidth/2,250,(id==='gem1'?'💎 ':'🪙 ')+'+'+amount,id==='gem1'?'#60a5fa':'#fbbf24')}catch(e){}
      if(typeof save==='function')save();
      if(typeof renderAch==='function')renderAch();
    };

    function installAchievementSignals(){
      // 学会新词（包括错词毕业）由 learned 长度增加确定；只在增加时排队判定，避免 save→checkAch→save 递归。
      if(typeof window.save==='function'&&!window.save.__hsnAchSignals){
        var origSave=window.save,lastLearned=(S.learned||[]).length;
        window.save=function(){
          var n=(S.learned||[]).length,grew=n>lastLearned;if(n!==lastLearned)lastLearned=n;
          if(grew){noteDaily('learned');var hr=new Date().getHours();if(hr>=6&&hr<21)noteDaily('healthy');}
          var r=origSave.apply(this,arguments);if(grew)setTimeout(function(){try{checkAch();}catch(e){}},0);return r;
        };
        window.save.__hsnAchSignals=true;if(origSave.__perfBoosted)window.save.__perfBoosted=true;
      }
      if(typeof window.markAnswer==='function'&&!window.markAnswer.__hsnAchSignals){
        var origAnswer=window.markAnswer;
        window.markAnswer=function(idx,correct){var r=origAnswer.apply(this,arguments);if(correct){var hr=new Date().getHours();if(hr>=6&&hr<21)noteDaily('healthy');try{checkAch();}catch(e){}}return r;};
        window.markAnswer.__hsnAchSignals=true;
      }
      var failedAt=0;
      if(typeof window.bossDefeat==='function'&&!window.bossDefeat.__hsnAchSignals){var origDefeat=window.bossDefeat;window.bossDefeat=function(){var r=origDefeat.apply(this,arguments);failedAt=Date.now();return r;};window.bossDefeat.__hsnAchSignals=true;}
      if(typeof window.bossVictory==='function'&&!window.bossVictory.__hsnAchSignals){var origVictory=window.bossVictory;window.bossVictory=function(){var comeback=failedAt&&Date.now()-failedAt<=30*60*1000;var r=origVictory.apply(this,arguments);noteDaily('boss');if(comeback)unlockAch('hidComeback');failedAt=0;try{checkAch();}catch(e){}return r;};window.bossVictory.__hsnAchSignals=true;}
      if(typeof window.doOpenChest==='function'&&!window.doOpenChest.__hsnAchSignals){var origChest=window.doOpenChest;window.doOpenChest=function(){var r=origChest.apply(this,arguments);/* 全局签到包装器会在本函数返回后才 markClaimed，下一任务再判定才能可靠触发“完美一天”。 */setTimeout(function(){try{checkAch();}catch(e){}},0);return r;};window.doOpenChest.__hsnAchSignals=true;}
      if(typeof window.bumpGameCount==='function'&&!window.bumpGameCount.__hsnAchSignals){var origBump=window.bumpGameCount;window.bumpGameCount=function(){var r=origBump.apply(this,arguments);try{checkAch();}catch(e){}return r;};window.bumpGameCount.__hsnAchSignals=true;}
    }
    installAchievementSignals();

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

    // (e) v941: 旧版金币说明注入已删除；设置页统一由 hansen_econ_guide.js
    // 注入三张可折叠说明卡，避免两个版本同时出现且规则互相矛盾。
  }

  // 启动: 等 DOM + 游戏脚本就绪
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(applyUpgrade, 300);
  }else{
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(applyUpgrade, 300); });
  }
})();
