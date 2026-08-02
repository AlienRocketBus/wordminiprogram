// hansen_season.js v941 — 星海赛季展示框架（旧积分账本只读）
// ============================================================================
// 【这是什么】
//   月度赛季系统。每个赛季(1个月)有: 1 张全新限定 boss 卡 + 1 个新游戏机制(由你团队每月填)。
//   赛季结束 → 限定卡绝版(进历史殿堂展示, 不可再得) → 新赛季开始。
//   v941 起，限定卡按星海副本的正式通关链路获得；旧赛季积分不再增长，也不再结算任何奖励。
//
// 【为什么这样设计】
//   - 赛季制是留存天花板最高的机制: "每月新卡会绝版" → 永远集不齐 → 月月回来。
//   - "一张卡+一个新机制"让美术/开发可持续, 且单张卡更稀有、更有收藏价值。
//
// 【框架 vs 每月内容】(关键!)
//   本文件是【框架】, 一次搭好长期不改。每个赛季的【内容】(那张卡的图、那个新机制)
//   由你团队每月填入下面的 SEASONS 配置 + 上传卡图。新机制是真实开发, 不能自动生成。
//
// 【v941 经济边界】
//   - markAnswer 不再包裹、不写积分/防刷副账；bossVictory 只保留 3 秒重复结算锁。
//   - hansen_season_data.points / claimedMilestones 仅用于兼容读取旧存档和历史展示。
//   - 本文件不得调用金币、经验、钻石或强化发奖；正式奖励统一由正式 Boss / round 链路发放。
//
// 【全局共享】
//   赛季数据是一个总账(不能每岛各算)。所以存在全局 key: hansen_season_data。
//
// 【时间局限】(诚实说明)
//   纯静态 H5 无服务器, 只能用手机本地时间判断赛季周期。极少数孩子改手机时间会影响倒计时,
//   这是客观局限。换赛季靠 SEASONS 配置里写死的日期 + 你团队每月更新部署。
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenSeasonLoaded) return; window.__hansenSeasonLoaded = true;

  // ==========================================================================
  // 【赛季配置 — 你团队每月填这里】
  // 每个赛季一个对象。id 唯一; start/end 是赛季起止(本地日期, YYYY-MM-DD);
  // card 是当季限定卡(name 名字, img 卡图路径, rarity 稀有度, desc 描述);
  // mechanic 是当季新机制(name 名字, desc 描述, 真实玩法由开发接入, 这里只登记展示);
  // pointMilestones 仅保留旧版里程碑的历史展示资料；v941 不再累加或结算。
  // ==========================================================================
  var SEASONS = [
    {
      id: 'S1',
      name: '第一赛季 · 星海觉醒',
      start: '2026-05-01',
      end:   '2026-12-31',   // 演示期放长一点, 方便你测试; 正式上线改成当月
      card: {
        name: '星海女帝·赛尔娅',
        img:  'bosses/saelya_hd.webp',   // 高清卡图(神秘殿堂/陈列馆缩略图用); 岛内 boss 立绘由 island_season.html 单独引用 bosses/saelya.webp
        rarity: 'legend',             // legend 传说 / epic 史诗 / rare 稀有
        desc: '星海创世之初降临的女帝，只在第一赛季出现，绝版后不再获得。'
      },
      mechanic: {
        name: '星海连击',
        desc: '本赛季新玩法（示范版：连续答对触发星海加成）。正式机制由开发接入。',
        key: 'star_combo'
      },
      pointMilestones: [
        { points: 200,  reward: '🪙 +80 金币 · ⚡加速30分钟', type:'coinboost', coin:80,  boost:30 },
        { points: 500,  reward: '🪙 +150 金币 · ⚡加速60分钟', type:'coinboost', coin:150, boost:60 },
        { points: 1000, reward: '🎴 赛季限定卡',     type:'card',  value:'S1' },
        { points: 1500, reward: '👑 赛季称号',       type:'title', value:'星海征服者' }
      ],
      // 🔴v805(Hansen): 赛季守关 boss 卡组(和限定卡赛尔娅一起凑成完整赛季 boss 卡组·全传说·密码面板/一键通关解锁)。
      //   立绘已有(starmaker/lightangel/abysslord/timelord/observer.webp)。🔴v843(Hansen发图): 5张本命背景图已填入 bgImg(bosses_bg/xxx.webp·原918x1714 PNG转webp q82·138-388KB)·覆盖占位渐变·boss卡全屏观赏时立绘落在各自专属背景上(铸星者→starmaker熔炉/天使→lightangel圣光/暗噬君主→abysslord渊狱/时之君主→timelord钟楼/边界守夜人→observer星界)。
      bossCards: [
        { id:'S1B1', name:'铸星者·原初匠人',       img:'bosses/starmaker.webp',  rarity:'legend', bg:'radial-gradient(circle at 50% 30%,#3a2a16,#0d0a05)', bgImg:'bosses_bg/starmaker.webp', desc:'星海创世的第一锤。万千星辰皆出自他的熔炉，原初的造物之力从未止息。' },
        { id:'S1B2', name:'统御天使·圣光之翼',     img:'bosses/lightangel.webp', rarity:'legend', bg:'radial-gradient(circle at 50% 30%,#3a3420,#0d0c06)', bgImg:'bosses_bg/lightangel.webp', desc:'展开圣光之翼降下裁决。万道光柱即是他的旨意，无人能在审判之光下隐藏。' },
        { id:'S1B3', name:'无光之渊·暗噬君主',     img:'bosses/abysslord.webp',  rarity:'legend', bg:'radial-gradient(circle at 50% 30%,#281a3a,#08060d)', bgImg:'bosses_bg/abysslord.webp', desc:'渊狱深处的吞噬者。被暗链拖入的灵魂，永坠无光之渊再难回返。' },
        { id:'S1B4', name:'时之君主·克罗诺斯之影', img:'bosses/timelord.webp',   rarity:'legend', bg:'radial-gradient(circle at 50% 30%,#16332e,#06100d)', bgImg:'bosses_bg/timelord.webp', desc:'十二时钟为他疯转。时间在他面前停滞、倒流、又终结，是为终焉时刻。' },
        { id:'S1B5', name:'终末观测者·边界守夜人', img:'bosses/observer.webp',   rarity:'legend', bg:'radial-gradient(circle at 50% 30%,#16333e,#060e10)', bgImg:'bosses_bg/observer.webp', desc:'守望宇宙边界的观测者。星图烙印连起命运的回响，终末的目光从不闭合。' }
      ]
    }
    // 第二赛季起, 你团队往这里继续加 { id:'S2', ... }
  ];

  var DATA_KEY = 'hansen_season_data';

  // ---- v946 存档安全边界 ----
  // 赛季配置和展示资源都是随版本发布的静态数据；本地存档只能保存“选择了第几个”，
  // 绝不能把备份里的图片路径/CSS/HTML 当成可信展示内容。
  var MAX_SEASON_POINTS = 1000000;
  var FORMS = {
    S1: [
      'bosses/saelya.webp',
      'bosses/saelya2.webp',
      'bosses/saelya3.webp'
    ]
  };
  var BGS = [
    'radial-gradient(circle at 50% 26%,#3a2c66,#150f2c 72%)',
    'radial-gradient(circle at 50% 26%,#1c2140,#06060f 72%)',
    'radial-gradient(circle at 50% 24%,#5c3d18,#241405 74%)',
    'linear-gradient(165deg,#0c423c,#0a2740 55%,#1a0d3a)',
    'radial-gradient(circle at 50% 26%,#4a1f74,#1a0a30 72%)',
    'radial-gradient(circle at 50% 26%,#163a6e,#08152f 72%)',
    'radial-gradient(circle at 50% 26%,#5e1d2c,#250a13 72%)',
    'radial-gradient(circle at 50% 26%,#dcd8ec,#9a96bc 74%)'
  ];
  var SEASON_BY_ID = Object.create(null);
  var CARD_ID_OK = Object.create(null);
  var MILESTONE_OK = Object.create(null);
  for(var _si=0;_si<SEASONS.length;_si++){
    var _season = SEASONS[_si];
    SEASON_BY_ID[_season.id] = _season;
    CARD_ID_OK[_season.id] = true;
    MILESTONE_OK[_season.id] = Object.create(null);
    var _milestones = Array.isArray(_season.pointMilestones) ? _season.pointMilestones : [];
    for(var _mi=0;_mi<_milestones.length;_mi++) MILESTONE_OK[_season.id][_milestones[_mi].points] = true;
    var _bossCards = Array.isArray(_season.bossCards) ? _season.bossCards : [];
    for(var _bi=0;_bi<_bossCards.length;_bi++) CARD_ID_OK[_bossCards[_bi].id] = true;
  }

  function isExactIntInRange(v, min, max){
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min && v <= max;
  }
  function safeStoredIndex(v, length){
    return isExactIntInRange(v, 0, length - 1) ? v : 0;
  }

  // ---- 全局赛季存档 ----
  // 结构: { points: {S1: 120, S2: ...}, unlockedCards: ['S1'], claimedMilestones: {S1:[100,300]} }
  function loadData(){
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if(raw){ var d = JSON.parse(raw); if(d && typeof d==='object') return normalize(d); }
    } catch(e){}
    return normalize({});
  }
  function normalize(d){
    d = (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
    var out = { points:{}, unlockedCards:[], claimedMilestones:{} };
    var rawPoints = (d.points && typeof d.points === 'object' && !Array.isArray(d.points)) ? d.points : {};
    var rawClaimed = (d.claimedMilestones && typeof d.claimedMilestones === 'object' && !Array.isArray(d.claimedMilestones)) ? d.claimedMilestones : {};

    // 只复制 SEASONS 中真实存在的 id；字符串数字、小数、负数和超大值全部按 0 处理。
    for(var i=0;i<SEASONS.length;i++){
      var sid = SEASONS[i].id;
      var pointValue = rawPoints[sid];
      out.points[sid] = isExactIntInRange(pointValue, 0, MAX_SEASON_POINTS) ? pointValue : 0;

      var srcMilestones = Array.isArray(rawClaimed[sid]) ? rawClaimed[sid] : [];
      var seenMilestones = Object.create(null);
      var allowedMilestones = MILESTONE_OK[sid];
      out.claimedMilestones[sid] = [];
      for(var m=0;m<srcMilestones.length;m++){
        var milestone = srcMilestones[m];
        if(isExactIntInRange(milestone, 0, MAX_SEASON_POINTS) && allowedMilestones[milestone] && !seenMilestones[milestone]){
          seenMilestones[milestone] = true;
          out.claimedMilestones[sid].push(milestone);
        }
      }
    }

    var rawCards = Array.isArray(d.unlockedCards) ? d.unlockedCards : [];
    var seenCards = Object.create(null);
    for(var c=0;c<rawCards.length;c++){
      var cardId = rawCards[c];
      if(typeof cardId === 'string' && CARD_ID_OK[cardId] && !seenCards[cardId]){
        seenCards[cardId] = true;
        out.unlockedCards.push(cardId);
      }
    }
    return out;
  }
  function saveData(d){
    try { localStorage.setItem(DATA_KEY, JSON.stringify(normalize(d))); } catch(e){}
  }

  // ---- 当前赛季判定 (按本地日期) ----
  function todayStr(){
    var d = new Date();
    var m = (d.getMonth()+1), day = d.getDate();
    return d.getFullYear() + '-' + (m<10?'0':'')+m + '-' + (day<10?'0':'')+day;
  }
  function getCurrentSeason(){
    var t = todayStr();
    for(var i=0;i<SEASONS.length;i++){
      if(t >= SEASONS[i].start && t <= SEASONS[i].end) return SEASONS[i];
    }
    return null;  // 当前没有进行中的赛季(空窗期)
  }
  function getSeasonById(id){
    return (typeof id === 'string' && SEASON_BY_ID[id]) ? SEASON_BY_ID[id] : null;
  }
  // ---- 历史殿堂: 找出所有"已结束"的赛季(限定卡已绝版) ----
  // 返回每个已结束赛季 + 当时是否解锁了限定卡。已结束 = end < 今天。
  // owned=true → 已收藏的绝版卡(高亮); owned=false → 永久错过(灰显, 制造FOMO)。
  function getPastSeasons(){
    var t = todayStr();
    var d = loadData();
    var out = [];
    for(var i=0;i<SEASONS.length;i++){
      var s = SEASONS[i];
      if(t > s.end){   // 赛季已结束
        out.push({
          id: s.id,
          name: s.name,
          card: s.card,
          owned: d.unlockedCards.indexOf(s.id) >= 0
        });
      }
    }
    return out;
  }
  // 赛季剩余天数
  function daysLeft(season){
    if(!season) return 0;
    try {
      var end = new Date(season.end + 'T23:59:59');
      var now = new Date();
      var diff = Math.ceil((end - now) / 86400000);
      return diff > 0 ? diff : 0;
    } catch(e){ return 0; }
  }

  // ---- 旧赛季积分入口（v941 永久只读）----
  // 保留同名 API 是为了让旧调用方不报错；无论日期、传入值或历史积分多少，都不写存档、不触发里程碑。
  function addSeasonPoints(){ return false; }

  // ---- 解锁限定卡 ----
  // 在给定 data 对象上解锁(不自己保存, 避免和外层 saveData 互相覆盖)
  function unlockCardInData(d, seasonId){
    if(typeof seasonId !== 'string' || !CARD_ID_OK[seasonId]) return false;
    if(d.unlockedCards.indexOf(seasonId) < 0){
      d.unlockedCards.push(seasonId);
      return true;
    }
    return false;
  }
  // 独立解锁(外部调用, 自己读写) — 供抽卡系统等外部使用
  function unlockCard(seasonId){
    var d = loadData();
    unlockCardInData(d, seasonId);
    saveData(d);
  }
  function hasCard(seasonId){
    return typeof seasonId === 'string' && !!CARD_ID_OK[seasonId] && loadData().unlockedCards.indexOf(seasonId) >= 0;
  }
  // 🔴v800(Hansen): 管理员密码「卡牌入口」临时全解锁(hansen_card_temp_unlock_until·与卡册收藏页同款标记)也点亮【神秘殿堂】的历代赛季限定卡。只影响显示·不污染真实存档(与 hansenTempUnlock 一致)。
  // 🔴v805(Hansen): 管理员「一键通关所有 Boss」开关(hansen_admin_clearall_on·v804 boss_attack 面板)也点亮神秘殿堂全部卡(含新增的赛季守关 boss 卡组)。两个管理员入口任一开启即全亮。
  function tempUnlockAll(){
    try{
      if(parseInt(localStorage.getItem('hansen_card_temp_unlock_until')||'0',10) > Date.now()) return true;
      if(localStorage.getItem('hansen_admin_clearall_on')==='1') return true;
      return false;
    }catch(e){ return false; }
  }
  // 🔴v805: 神秘殿堂总卡数 = 各赛季「限定卡 1 张 + 守关 boss 卡组」之和; 已收藏数同理(tempUnlockAll 时全算已收藏)
  function totalCardCount(){ var n=0; for(var i=0;i<SEASONS.length;i++){ n += 1 + (Array.isArray(SEASONS[i].bossCards)?SEASONS[i].bossCards.length:0); } return n; }
  function ownedCardCount(){ if(tempUnlockAll()) return totalCardCount(); var d=loadData(),n=0; for(var i=0;i<SEASONS.length;i++){ var s=SEASONS[i]; if(d.unlockedCards.indexOf(s.id)>=0)n++; if(Array.isArray(s.bossCards)){ for(var j=0;j<s.bossCards.length;j++){ if(d.unlockedCards.indexOf(s.bossCards[j].id)>=0)n++; } } } return n; }
  function findBossCard(id){ for(var i=0;i<SEASONS.length;i++){ var bc=SEASONS[i].bossCards; if(Array.isArray(bc)){ for(var j=0;j<bc.length;j++){ if(bc[j].id===id) return bc[j]; } } } return null; }

  // ---- Boss 重复结算锁 ----
  // v941 不再包裹 markAnswer；bossVictory 只负责拦同一局 3 秒内的重复调用，不接触旧积分账本。
  function hookScoreEvents(){
    var done = true;
    // 打赢 boss → 仅防重复执行；正式 Boss/round 结算仍由原函数及其正式 hook 完成。
    // 【根治翻倍】游戏有两条boss胜利路径(岛页nextBossQ + boss_lock暴击秒杀)可能让 bossVictory
    // 被调2次, 导致金币/钻石/成就翻倍。这里在最外层加锁: 同一局3秒内的重复调用全部挡掉。
    if(typeof window.bossVictory === 'function' && !window.bossVictory.__seasonHooked){
      var origBV = window.bossVictory;
      var lastVictoryAt = 0;
      window.bossVictory = function(){
        var now = Date.now();
        // 距上次胜利结算 <3秒 → 判定为同一局的重复触发, 整个挡掉
        if(now - lastVictoryAt < 3000){
          return;  // 重复调用: 不执行原函数, 不加积分
        }
        lastVictoryAt = now;
        return origBV.apply(this, arguments);   // 第一次正常结算；此 wrapper 不做任何赛季积分/里程碑操作。
      };
      window.bossVictory.__seasonHooked = true;
    } else if(typeof window.bossVictory !== 'function'){ done = false; }

    return done;
  }

  // ---- 对外接口 (供赛季面板 UI / 抽卡系统调用) ----
  window.HansenSeason = {
    current: getCurrentSeason,
    daysLeft: function(){ return daysLeft(getCurrentSeason()); },
    getPoints: function(){ var s=getCurrentSeason(); return s ? (loadData().points[s.id]||0) : 0; },
    hasCard: hasCard,
    unlockCard: unlockCard,
    allSeasons: function(){ return SEASONS.slice(); },
    pastSeasons: getPastSeasons,
    addPoints: addSeasonPoints,
    pointsReadOnly: true,
    nextMilestone: function(){ return null; }, // 旧里程碑已停用，不能再向调用方宣传“下一笔可领取奖励”。
    data: loadData
  };

  // ==========================================================================
  // 【赛季面板 UI】只在首页显示一个悬浮「🏆赛季」按钮, 点开看面板。
  // 全部用 JS 创建, 不改 index.html 结构。
  // ==========================================================================
  function isHomePage(){
    try {
      var path = (location.pathname || '').toLowerCase();
      return !/island_\w+\.html/.test(path);  // 岛页不显示赛季入口
    } catch(e){ return false; }  // location 不可用时, 不挂入口(安全)
  }
  var RARITY_STYLE = {
    legend: { name:'传说', color:'#fbbf24', glow:'rgba(251,191,36,.6)' },
    epic:   { name:'史诗', color:'#c084fc', glow:'rgba(192,132,252,.5)' },
    rare:   { name:'稀有', color:'#60a5fa', glow:'rgba(96,165,250,.5)' }
  };

  function buildEntryButton(){
    try{
      if(document.getElementById('hsnSeasonEntry')) return;
      var anyCard=document.querySelector('.util-card'); if(!anyCard||!anyCard.parentElement) return;
      var entry=document.createElement('div');
      entry.className='util-card'; entry.id='hsnSeasonEntry';
      entry.setAttribute('onclick','__hsnOpenSeason()');
      entry.innerHTML='<span class="u-icon">🏆</span><div class="u-label">赛季</div>';
      anyCard.parentElement.insertBefore(entry, anyCard);
    }catch(e){}
  }
  // 🔴 v715(Hansen): 「神秘殿堂」入口已从首页/赛季页【移动到「收藏卡册」底部】(见 hansen_cards.js·重新设计为更精美的入口卡)。
  //   此处不再在首页生成入口卡; 顺手清掉可能残留的旧 #hsnHallCard。openHall/__hsnOpenHall 逻辑不动(卡册入口直接调它)。
  function buildHallEntry(){
    try{ var old=document.getElementById('hsnHallCard'); if(old&&old.parentNode) old.parentNode.removeChild(old); }catch(e){}
  }

  // HF2: land_map 预热必须是全页单例。旧版 buildProgressBar 在 150ms 轮询中
  // 每次命中已存在的横幅都再排一个 idle fetch，30 秒内可重复请求近 100 次。
  // 现在只在“用户已经将要进入”或“浏览器明确报告快速 4G、非省流量、页面可见”
  // 时最多请求一次。网络信息缺失一律当作 unknown，不做后台下载。
  function canAutoWarmLandMap(){
    try{
      if(window.HansenPreloadPolicy && typeof window.HansenPreloadPolicy.canBackgroundDownload==='function'){
        return !!window.HansenPreloadPolicy.canBackgroundDownload();
      }
      var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      return !!c && !c.saveData && c.effectiveType==='4g' && navigator.onLine!==false &&
        (!document.visibilityState || document.visibilityState==='visible') && !document.hidden;
    }catch(e){ return false; }
  }
  function warmLandMap(userIntent){
    try{
      if(window.__hansenLandMapWarmAttempted) return window.__hansenLandMapWarmPromise||null;
      if(!userIntent && !canAutoWarmLandMap()) return null;
      if(navigator.onLine===false || document.visibilityState==='hidden' || document.visibilityState==='prerender' || document.hidden) return null;
      window.__hansenLandMapWarmAttempted=true;  // 发请求前先上锁：失败也不在轮询中狂重试
      var p=fetch('land_map.html',{cache:'force-cache',credentials:'same-origin'}).catch(function(){ return null; });
      window.__hansenLandMapWarmPromise=p;
      return p;
    }catch(e){ return null; }
  }
  function armLandMapWarm(bar){
    if(!bar || bar.__hansenLandMapWarmArmed) return;
    bar.__hansenLandMapWarmArmed=true;
    var intent=function(){ warmLandMap(true); };
    try{ bar.addEventListener('pointerdown',intent,{passive:true,once:true}); }catch(e){}
    try{ bar.addEventListener('touchstart',intent,{passive:true,once:true}); }catch(e){}
    try{ bar.addEventListener('focus',intent,{once:true}); }catch(e){}
    if(!window.__hansenLandMapWarmScheduled){
      window.__hansenLandMapWarmScheduled=true;
      var auto=function(){ warmLandMap(false); };
      try{
        if(window.requestIdleCallback) window.requestIdleCallback(auto,{timeout:5000});
        else setTimeout(auto,2500);
      }catch(e){ setTimeout(auto,2500); }
    }
  }
  // 首页赛季进度条(钩子2 目标梯度: 让孩子一进首页就看到"限定卡还差N分")
  // 首页(index.html)锚点是 .islands(岛屿区), 插在其上方最显眼处; 点击进度条即开面板。
  function buildProgressBar(){
    try{
      var season=getCurrentSeason(); if(!season) return;
      var anchor=document.querySelector('.islands'); if(!anchor||!anchor.parentElement) return;
      var d=loadData();
      var hasCard=(d.unlockedCards||[]).indexOf(season.id)>=0;
      // 🔴v865(Hansen): 从"赛季进度条"彻底改为【番外篇·副本入口卡】——去倒计时/去积分条, 纯酷炫入口, 内容点进去看。
      //   定位: 正片18岛之外的第19个岛·额外副本(魔兽副本气质)·认真通关拿收藏卡·无时间限制。
      var statusLine = hasCard
        ? '<span style="color:#fcd34d">👑 已征服 · 星海限定卡已收入卡册</span>'
        : '<span style="color:#c4b5fd">通关副本 · 赢取星海限定收藏卡 →</span>';
      var inner=
        '<div class="hsn-ex-glow"></div>'+
        '<div style="position:relative;z-index:2;display:flex;align-items:center;gap:14px">'+
          '<div class="hsn-ex-orb">🌌</div>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
              '<span class="hsn-ex-tag">✦ 番外篇 EXTRA</span>'+
              '<span style="font-size:11px;color:#94a3b8">第 19 座秘境</span>'+
            '</div>'+
            '<div style="font-size:19px;font-weight:900;color:#fff;margin:5px 0 3px;letter-spacing:.5px;text-shadow:0 2px 10px rgba(124,58,237,.6)">星海觉醒</div>'+
            '<div style="font-size:12.5px;line-height:1.4">'+statusLine+'</div>'+
          '</div>'+
          '<div class="hsn-ex-enter">进入<div style="font-size:9px;margin-top:1px;opacity:.85">副本</div></div>'+
        '</div>';
      var bar=document.getElementById('hsnSeasonBar');
      if(bar){ bar.innerHTML=inner; armLandMapWarm(bar); return; }
      // 一次性注入CSS(星海副本卡专属·无旋转/闪烁/震动/透明度循环, 遵守动效禁令)
      if(!document.getElementById('hsnExtraCss')){
        var st=document.createElement('style'); st.id='hsnExtraCss';
        st.textContent=
          '#hsnSeasonBar{position:relative;max-width:640px;margin:22px auto 16px;'+
            'background:linear-gradient(135deg,#1e1b4b 0%,#3b0764 45%,#0c1538 100%);'+
            'border:1.5px solid rgba(196,181,253,.45);border-radius:18px;padding:16px 18px;cursor:pointer;'+
            'font-family:-apple-system,"Microsoft YaHei",sans-serif;overflow:hidden;'+
            'box-shadow:0 8px 30px rgba(59,7,100,.5),inset 0 1px 0 rgba(255,255,255,.08);'+
            'transition:transform .18s,box-shadow .18s}'+
          '#hsnSeasonBar:active{transform:scale(.985)}'+
          '.hsn-ex-glow{position:absolute;top:-40%;right:-10%;width:220px;height:220px;'+
            'background:radial-gradient(circle,rgba(168,85,247,.45),transparent 65%);pointer-events:none;z-index:1}'+
          '.hsn-ex-orb{flex-shrink:0;width:52px;height:52px;border-radius:14px;'+
            'background:radial-gradient(circle at 40% 30%,#7c3aed,#2e1065);'+
            'display:flex;align-items:center;justify-content:center;font-size:28px;'+
            'box-shadow:0 4px 16px rgba(124,58,237,.55),inset 0 2px 6px rgba(255,255,255,.2)}'+
          '.hsn-ex-tag{font-size:11px;font-weight:900;color:#0c1538;background:linear-gradient(90deg,#fcd34d,#f59e0b);'+
            'padding:2px 9px;border-radius:8px;letter-spacing:1px}'+
          '.hsn-ex-enter{flex-shrink:0;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#3b0764;'+
            'font-weight:900;font-size:14px;text-align:center;padding:9px 14px;border-radius:12px;'+
            'box-shadow:0 4px 12px rgba(251,191,36,.4);line-height:1.1}';
        (document.head||document.documentElement).appendChild(st);
      }
      bar=document.createElement('div');
      bar.id='hsnSeasonBar';
      /* 🔴v1069 修复"星海觉醒点了进不去"：原字符串是
         …:(window.(function(){ … })())
       `window.` 后面直接跟 `(` 是**非法语法**——多半是当年把
       `window.location.href=…` 换成 IIFE 时忘了删掉前面的 `window.`。
       点击时整句抛 SyntaxError，于是"点了没反应"。
       写成 onclick 字符串的坏处正在于此：语法错误不会在加载时暴露，
       只在用户真的点下去那一刻才炸，且大多数人不会开控制台看。
       这里改成直接绑函数，语法错误会在加载阶段就被发现。 */
      bar.onclick = function () {
        try {
          if (typeof openIsland === 'function') { openIsland('land_map.html'); return; }
          if (window.HansenRoom && typeof HansenRoom.open === 'function') { HansenRoom.open('land'); return; }
          location.href = 'land_map.html';
        } catch (e) {
          try { location.href = 'land_map.html'; } catch (_e) {}
        }
      };
      bar.removeAttribute('onclick');  //🔴v874(Hansen定稿): 番外篇星海觉醒=单词大陆冒险地图 //🔴v875(Hansen·彻底打通): 横幅在index上直接走壳(openIsland·iframe换装零白屏零历史污染)·无壳环境才整页跳(保留 window.(function(){ if(window.HansenRoom){ HansenRoom.open('land'); return; } location.href='land_map.html'; })() 兜底)
      bar.innerHTML=inner;
      anchor.parentElement.insertBefore(bar, anchor);
      armLandMapWarm(bar);
    }catch(e){}
  }
  window.__hsnOpenSeason = openPanel;
  window.__hsnOpenHall = openHall;

  function openPanel(){
    var season = getCurrentSeason();
    var d = loadData();

    // 星海学习岛入口(进赛季后才出现, 不在18岛列表里)
    var islandBtn =
      '<div id="__hs_island_entry" style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);border:2px solid #fbbf24;border-radius:16px;padding:15px 16px;margin-bottom:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;box-shadow:0 0 20px rgba(124,58,237,.35)">'+
        '<div style="display:flex;align-items:center;gap:12px">'+
          '<div style="font-size:32px">📖</div>'+
          '<div><div style="font-size:16px;font-weight:900;color:#fff">星海学习岛</div>'+
          '<div style="font-size:12px;color:#c4b5fd;margin-top:2px">学会星海单词 · 挑战女帝赛尔娅</div></div>'+
        '</div>'+
        '<div style="font-size:20px;color:#fbbf24">›</div>'+
      '</div>';

    var mask = document.createElement('div');
    mask.id = '__hs_season_panel';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483520;background:rgba(12,21,56,.85);display:flex;align-items:center;justify-content:center;padding:18px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow-y:auto';

    var html;
    if(!season){
      html = '<div style="text-align:center;color:#cbd5e1;padding:40px 20px">'+
        '<div style="font-size:54px;margin-bottom:14px">🏁</div>'+
        '<div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">星海秘境</div>'+
        '<div style="font-size:14px">秘境即将开启，敬请期待！</div>'+islandBtn+'</div>';
    } else {
      var pts = d.points[season.id] || 0;
      var dl = daysLeft(season);
      var r = RARITY_STYLE[season.card.rarity] || RARITY_STYLE.rare;
      var hasThisCard = d.unlockedCards.indexOf(season.id) >= 0;
      var pPref = readCardPref(season.id);
      // 🔴v847(Hansen): 赛季面板当季卡缩略图同样用【透明立绘 formPng】, 全局规格统一
      var pImg = (pPref&&pPref.formPng)?pPref.formPng:'bosses/saelya.webp';
      var pBg  = (pPref&&pPref.bgCss)?pPref.bgCss:'radial-gradient(circle at 50% 30%,#2a2350,#0d0a22)';

      var milestonesHtml = '';
      (season.pointMilestones||[]).forEach(function(m){
        var claimed = (d.claimedMilestones[season.id]||[]).indexOf(m.points) >= 0;
        var reached = pts >= m.points;
        var pct = Math.min(100, Math.round(pts/m.points*100));
        milestonesHtml +=
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
            '<div style="flex-shrink:0;width:54px;font-size:12px;color:'+(reached?'#fbbf24':'#64748b')+';font-weight:800">'+m.points+'分</div>'+
            '<div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden">'+
              '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:4px"></div>'+
            '</div>'+
            '<div style="flex-shrink:0;font-size:12px;color:'+(claimed?'#22c55e':'#64748b')+';font-weight:700;min-width:70px;text-align:right">'+(claimed?'✅ 旧版已领取':'旧版已停用')+'</div>'+
          '</div>';
      });

      html =
        '<div style="width:100%;max-width:360px;background:linear-gradient(160deg,#1a2660,#0c1538);border:2px solid rgba(251,191,36,.4);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:22px 20px;max-height:86vh;overflow-y:auto">'+
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'+
            '<div style="font-size:19px;font-weight:900;color:#fff">'+season.name+'</div>'+
            '<div id="__hs_close" style="font-size:22px;color:#64748b;cursor:pointer;line-height:1;padding:0 4px">×</div>'+
          '</div>'+
          '<div style="font-size:13px;color:#fbbf24;font-weight:700;margin-bottom:16px">⏳ 本赛季还剩 '+dl+' 天</div>'+
          islandBtn+
          '<div'+(hasThisCard?' id="__hs_curcard" data-season="'+season.id+'"':'')+' style="background:linear-gradient(135deg,'+r.glow+',rgba(12,21,56,.3));border:2px solid '+r.color+';border-radius:16px;padding:16px;text-align:center;margin-bottom:14px;box-shadow:0 0 20px '+r.glow+';'+(hasThisCard?'cursor:pointer':'')+'">'+
            '<div style="font-size:11px;color:'+r.color+';font-weight:800;letter-spacing:1px;margin-bottom:6px">★ '+r.name+'限定卡 ★</div>'+
            (hasThisCard
              ? '<div class="__hs_panel_thumb" style="width:96px;height:128px;margin:0 auto 8px;border-radius:10px;overflow:hidden;background:'+pBg+'"><img src="'+pImg+'?v=1135" onerror="this.onerror=null;this.src=\'bosses/saelya.webp?v=1135\'" style="width:100%;height:100%;object-fit:contain;object-position:center bottom" alt=""></div>'/* 🔴v847: 立绘底对齐 */
              : '<div style="font-size:46px;margin-bottom:6px">❓</div>')+
            '<div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:4px">'+(hasThisCard?season.card.name:'？？？')+'</div>'+
            '<div style="font-size:12px;color:#cbd5e1;line-height:1.5">'+(hasThisCard?'✨ 已收入囊中 · 点击进入全屏观赏':season.card.desc)+'</div>'+
          '</div>'+
          '<div style="background:rgba(96,165,250,.1);border-radius:12px;padding:12px;margin-bottom:16px">'+
            '<div style="font-size:13px;font-weight:800;color:#60a5fa;margin-bottom:4px">🎮 本赛季新玩法：'+season.mechanic.name+'</div>'+
            '<div style="font-size:12px;color:#cbd5e1;line-height:1.5">'+season.mechanic.desc+'</div>'+
          '</div>'+
          '<div style="text-align:center;margin-bottom:16px">'+
            '<div style="font-size:12px;color:#94a3b8;margin-bottom:2px">历史赛季积分（只读）</div>'+
            '<div style="font-size:30px;font-weight:900;color:#fbbf24">'+pts+'</div>'+
            '<div style="font-size:11px;color:#64748b">v941 起不再累加，也不再发放旧里程碑奖励</div>'+
          '</div>'+
          '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:10px">📜 旧版里程碑（历史记录）</div>'+
          milestonesHtml +
          (function(){
            var allCount = totalCardCount();
            var ownedCount = ownedCardCount();
            return '<div id="__hs_hall_entry" style="margin-top:16px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:13px 15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">'+
              '<div><div style="font-size:13px;font-weight:800;color:#fbbf24">🏛️ 神秘殿堂</div>'+
              '<div style="font-size:11px;color:#94a3b8;margin-top:2px">历代赛季限定卡 · 已收藏 '+ownedCount+'/'+allCount+'</div></div>'+
              '<div style="font-size:18px;color:#fbbf24">›</div>'+
            '</div>';
          })() +
        '</div>';
    }

    mask.innerHTML = html;
    document.body.appendChild(mask);

    function close(){ if(mask.parentNode) mask.parentNode.removeChild(mask); }
    var closeBtn = document.getElementById('__hs_close');
    if(closeBtn) closeBtn.addEventListener('click', close);
    mask.addEventListener('click', function(e){ if(e.target===mask) close(); });
    var islandEntry = document.getElementById('__hs_island_entry');
    if(islandEntry) islandEntry.addEventListener('click', function(e){ e.stopPropagation();
      /* 🔴 v684: 在首页外壳里就地打开星海岛(不走网页); 兼容首页直接调 / 岛内 iframe 调 parent / 直开兜底 */
      var op = null;
      try{ op = window.openIsland || (window.parent && window.parent !== window && window.parent.openIsland) || null; }catch(_e){}
      if(op){ op('island_season.html'); } else { location.href='island_season.html'; }
    });
    var hallEntry = document.getElementById('__hs_hall_entry');
    if(hallEntry) hallEntry.addEventListener('click', function(e){ e.stopPropagation(); openHall(); });
    var curCard = document.getElementById('__hs_curcard');
    if(curCard) curCard.addEventListener('click', function(e){ e.stopPropagation(); openShowcase(curCard.getAttribute('data-season')); });
  }

  // ---- 神秘殿堂: 历代赛季限定卡的总陈列馆 ----
  // ---- 读取玩家在展示页设定的「主形象 + 背景」(localStorage, 与 season_showcase.html 同源共享) ----
  function readCardPref(id){
    var season = getSeasonById(id);
    if(!season) return null;
    var forms = FORMS[id] || [season.card.img];
    var p = null;
    try { p = JSON.parse(localStorage.getItem('hs_showcase_'+id)||'null'); } catch(e){}
    if(!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    var formIdx = safeStoredIndex(p.formIdx, forms.length);
    var bgIdx = safeStoredIndex(p.bgIdx, BGS.length);
    // formPng/bgCss 永远从随版本发布的静态表重建，忽略存档中的同名派生字符串。
    return { formIdx:formIdx, bgIdx:bgIdx, formPng:forms[formIdx], bgCss:BGS[bgIdx] };
  }
  // 关闭全屏展示后, 把陈列馆里该卡的缩略图(形象+背景)刷新成最新设定
  // 关闭全屏展示后, 把【陈列馆缩略图】+【赛季面板当季卡】的形象+背景就地刷成最新设定
  function refreshHallCard(id){
    var pref = readCardPref(id); if(!pref) return;
    function apply(img, box){
      // 🔴v847(Hansen): 换形象后缩略图保持【透明立绘+底对齐】(用 formPng·不回退 HD 卡面图), 与神秘殿堂初始渲染统一
      if(img){ var _sp=(pref.formPng||'bosses/saelya.webp'); img.onerror=function(){this.onerror=null;this.src='bosses/saelya.webp?v=1135';}; img.src = _sp + '?v=1135'; img.style.objectFit='contain'; img.style.objectPosition='center bottom'; }
      if(box && pref.bgCss){ box.style.background = pref.bgCss; }
    }
    var hall = document.getElementById('__hs_hall_panel');
    if(hall){ var gc = hall.querySelector('.__hs_gcard[data-season="'+id+'"]'); if(gc) apply(gc.querySelector('img'), gc.querySelector('.__hs_thumb_box')); }
    var panel = document.getElementById('__hs_season_panel');
    if(panel){ var cc = panel.querySelector('#__hs_curcard[data-season="'+id+'"]'); if(cc) apply(cc.querySelector('img'), cc.querySelector('.__hs_panel_thumb')); }
  }

  // 已拥有 → 显真卡缩略图(点击进全屏星系展示) / 当季未解锁 → 神秘 / 往期错过 → 灰显绝版锁 / 未开启 → 即将开启
  function openHall(){
    var t = todayStr();
    var d = loadData();
    var mask = document.createElement('div');
    mask.id = '__hs_hall_panel';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483530;background:rgba(12,21,56,.88);display:flex;align-items:center;justify-content:center;padding:18px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow-y:auto';

    var ownedTotal = 0, grandTotal = totalCardCount();
    var cardsHtml = '', _saelyaH = ''; /* 🔴v845(Hansen): 赛尔娅限定卡存_saelyaH·5个守关boss在前·赛尔娅排最后 */
    SEASONS.forEach(function(s){
      var r = RARITY_STYLE[s.card.rarity] || RARITY_STYLE.rare;
      var owned = tempUnlockAll() || d.unlockedCards.indexOf(s.id) >= 0;
      var ended = t > s.end;
      var notStarted = t < s.start;
      if(owned){
        ownedTotal++;
        var pref = readCardPref(s.id);
        // 🔴v847(Hansen): 神秘殿堂缩略图改用【透明立绘 formPng】(不再用 HD 卡面图 saelya_hd), 与5个守关boss同款渲染·规格统一
        var tImg = (pref&&pref.formPng)?pref.formPng:'bosses/saelya.webp';
        var tBg  = (pref&&pref.bgCss)?pref.bgCss:'radial-gradient(circle at 50% 30%,#2a2350,#0d0a22)';
        _saelyaH +=
          '<div class="__hs_gcard" data-season="'+s.id+'" style="background:linear-gradient(160deg,'+r.glow+',rgba(12,21,56,.35));border:2px solid '+r.color+';border-radius:14px;padding:10px 10px 12px;text-align:center;box-shadow:0 0 16px '+r.glow+';cursor:pointer">'+
            '<div class="__hs_thumb_box" style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:'+tBg+';margin-bottom:8px">'+/* 🔴v847: 框改正方形·立绘底对齐 */
              '<img src="'+tImg+'?v=1135" onerror="this.onerror=null;this.src=\'bosses/saelya.webp?v=1135\'" style="width:100%;height:100%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5))" alt="">'+
            '</div>'+
            '<div style="font-size:13px;font-weight:900;color:#fff;line-height:1.2">'+s.card.name+'</div>'+
            '<div style="font-size:10px;color:'+r.color+';font-weight:800;margin-top:3px">★ '+r.name+'限定</div>'+
            '<div style="font-size:10px;color:#22c55e;font-weight:800;margin-top:4px">✓ 已收藏 · 点击观赏</div>'+
          '</div>';
      } else if(notStarted){
        _saelyaH +=
          '<div style="background:rgba(30,41,59,.5);border:1.5px dashed #334155;border-radius:14px;padding:14px;text-align:center;opacity:.7">'+
            '<div style="font-size:40px;margin-bottom:6px">🗓️</div>'+
            '<div style="font-size:13px;font-weight:900;color:#94a3b8">即将开启</div>'+
            '<div style="font-size:10px;color:#64748b;margin-top:4px">'+s.name+'</div>'+
          '</div>';
      } else if(ended){
        _saelyaH +=
          '<div style="background:rgba(30,41,59,.5);border:1.5px solid #334155;border-radius:14px;padding:14px;text-align:center;opacity:.78">'+
            '<div style="font-size:40px;margin-bottom:6px;filter:grayscale(1)">🎴</div>'+
            '<div style="font-size:13px;font-weight:900;color:#64748b">'+s.card.name+'</div>'+
            '<div style="font-size:10px;color:#475569;font-weight:800;margin-top:3px">'+s.name+'</div>'+
            '<div style="font-size:10px;color:#ef4444;font-weight:800;margin-top:4px">🔒 已绝版 · 错过</div>'+
          '</div>';
      } else {
        // 当季进行中, 尚未解锁 → 神秘
        _saelyaH +=
          '<div style="background:rgba(30,41,59,.45);border:1.5px solid '+r.color+';border-radius:14px;padding:14px;text-align:center">'+
            '<div style="font-size:40px;margin-bottom:6px">❓</div>'+
            '<div style="font-size:13px;font-weight:900;color:#cbd5e1">？？？</div>'+
            '<div style="font-size:10px;color:'+r.color+';font-weight:800;margin-top:3px">★ '+r.name+'限定 · 进行中</div>'+
            '<div style="font-size:10px;color:#94a3b8;font-weight:700;margin-top:4px">通关星海副本后解锁</div>'+
          '</div>';
      }
      // 🔴v805: 赛季守关 boss 卡组(和限定卡一起·全传说·密码面板/一键通关解锁; bgImg 有则用背景图否则占位渐变)
      if(Array.isArray(s.bossCards)){
        s.bossCards.forEach(function(bc){
          var br2 = RARITY_STYLE[bc.rarity] || RARITY_STYLE.legend;
          var bcOwned = tempUnlockAll() || d.unlockedCards.indexOf(bc.id) >= 0;
          if(bcOwned){
            ownedTotal++;
            var bcBg = bc.bgImg ? ('url("'+bc.bgImg+'?v=1135") center/cover') : bc.bg;
            cardsHtml +=
              '<div class="__hs_bcard" data-bc="'+bc.id+'" style="background:linear-gradient(160deg,'+br2.glow+',rgba(12,21,56,.35));border:2px solid '+br2.color+';border-radius:14px;padding:10px 10px 12px;text-align:center;box-shadow:0 0 16px '+br2.glow+';cursor:pointer">'+
                '<div style="width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:'+bcBg+';margin-bottom:8px">'+/* 🔴v847(Hansen): 1200x1200正方形立绘配正方形框·零顶部留白·人物最大化·零裁切 */
                  '<img src="'+bc.img+'?v=1135" onerror="this.onerror=null;this.style.visibility=\'hidden\'" style="width:100%;height:100%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5))" alt="">'+
                '</div>'+
                '<div style="font-size:13px;font-weight:900;color:#fff;line-height:1.2">'+bc.name+'</div>'+
                '<div style="font-size:10px;color:'+br2.color+';font-weight:800;margin-top:3px">★ '+br2.name+'限定</div>'+
                '<div style="font-size:10px;color:#22c55e;font-weight:800;margin-top:4px">✓ 已收藏 · 点击观赏</div>'+
              '</div>';
          } else {
            cardsHtml +=
              '<div style="background:rgba(30,41,59,.45);border:1.5px solid '+br2.color+';border-radius:14px;padding:14px;text-align:center">'+
                '<div style="font-size:40px;margin-bottom:6px">❓</div>'+
                '<div style="font-size:13px;font-weight:900;color:#cbd5e1">？？？</div>'+
                '<div style="font-size:10px;color:'+br2.color+';font-weight:800;margin-top:3px">★ '+br2.name+'限定 · 赛季 Boss</div>'+
                '<div style="font-size:10px;color:#94a3b8;font-weight:700;margin-top:4px">通关密码面板解锁</div>'+
              '</div>';
          }
        });
      }
    });
    cardsHtml += _saelyaH; // 🔴v845(Hansen): 5个守关boss已在cardsHtml最前·赛尔娅限定卡(_saelyaH)追加到最后展示

    var html =
      '<div style="width:100%;max-width:380px;background:linear-gradient(160deg,#1a2660,#0c1538);border:2px solid rgba(251,191,36,.4);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:22px 20px;max-height:88vh;overflow-y:auto">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
          '<div style="font-size:18px;font-weight:900;color:#fff">🏛️ 神秘殿堂</div>'+
          '<div id="__hs_hall_close" style="font-size:22px;color:#64748b;cursor:pointer;line-height:1;padding:0 4px">×</div>'+
        '</div>'+
        '<div style="font-size:12px;color:#cbd5e1;margin-bottom:4px;line-height:1.5">历代赛季限定卡的殿堂 · <span style="color:#fbbf24">已收藏 '+ownedTotal+'/'+grandTotal+'</span>。点亮的卡可点击进入全屏观赏。</div>'+
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:16px;line-height:1.5">限定卡绝版后无法再获得，把握每个赛季！</div>'+
        '<div onclick="if(window.hansenStoryArchive){window.hansenStoryArchive();}" style="margin-bottom:16px;background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:1.5px;border-radius:14px;cursor:pointer;box-shadow:0 6px 20px rgba(124,58,237,.35)"><div style="border-radius:12.5px;padding:13px 14px;display:flex;align-items:center;gap:12px;background:radial-gradient(120% 120% at 0% 0%,rgba(167,139,250,.22),transparent 55%),linear-gradient(135deg,#2a1f55,#191338)"><div style="flex:none;width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:25px;background:radial-gradient(circle at 35% 28%,rgba(167,139,250,.3),rgba(124,58,237,.18));border:1px solid rgba(167,139,250,.5)">📖</div><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:900;color:#f3e8ff">星海纪事</div><div style="font-size:11px;color:#c4b5fd;margin-top:2px">《星海的回响》· 拿到守关卡回看每章全文</div></div><div style="flex:none;color:#c4b5fd;font-size:13px;font-weight:800">翻阅<span style="font-size:18px;line-height:1">›</span></div></div></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+cardsHtml+'</div>'+
      '</div>';

    mask.innerHTML = html;
    document.body.appendChild(mask);
    function close(){ if(mask.parentNode) mask.parentNode.removeChild(mask); }
    var cb = document.getElementById('__hs_hall_close');
    if(cb) cb.addEventListener('click', close);
    mask.addEventListener('click', function(e){ if(e.target===mask) close(); });
    // 点击已拥有的卡 → 全屏星系展示
    Array.prototype.forEach.call(mask.querySelectorAll('.__hs_gcard'), function(el){
      el.addEventListener('click', function(e){ e.stopPropagation(); openShowcase(el.getAttribute('data-season')); });
    });
    // 🔴v845(Hansen·再重做): 点击已拥有的赛季 boss 卡 → 复用「BOSS 殿堂」(boss_hall.html?season=1)·和1~20关boss【完全同款规格】(全屏本命背景Ken Burns+角色立绘+5档稀有度卡框+背景13选+点击放大+左右滑切换·【无星系】·星系只给赛尔娅)。不再走星系展示。
    Array.prototype.forEach.call(mask.querySelectorAll('.__hs_bcard'), function(el){
      el.addEventListener('click', function(e){ e.stopPropagation(); openSeasonBossHall(el.getAttribute('data-bc')); });
    });
  }

  // ---- 全屏「传说卡」星系展示 (隔离 iframe 加载 season_showcase.html, 不与游戏样式/脚本冲突) ----
  function openShowcase(seasonId){
    if(document.getElementById('__hs_showcase')) return;
    var mask = document.createElement('div');
    mask.id = '__hs_showcase';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#0a0a14';
    var iframe = document.createElement('iframe');
    iframe.src = 'season_showcase.html?v=1135&boss=' + encodeURIComponent(seasonId || '');
    iframe.setAttribute('title', '神秘殿堂');
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0a0a14';
    mask.appendChild(iframe);
    var closeBtn = document.createElement('div');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;z-index:5;width:40px;height:40px;border-radius:50%;background:rgba(10,12,24,.82);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:24px;line-height:38px;text-align:center;cursor:pointer';
    closeBtn.addEventListener('click', function(){ if(mask.parentNode) mask.parentNode.removeChild(mask); refreshHallCard(seasonId); });
    mask.appendChild(closeBtn);
    document.body.appendChild(mask);
  }

  // 🔴v845(Hansen·再重做): 赛季守关boss → 复用「BOSS 殿堂」(boss_hall.html?season=1)·和1~20关boss完全同款规格(全屏本命背景+角色立绘+5档稀有度卡框+背景13选+点击放大·无星系)。boss id(S1B1~S1B5)映射到 season lv(1~5·即在bossCards的位置+1)。
  function openSeasonBossHall(bossId){
    if(document.getElementById('__hs_showcase')) return;
    var lv=1, bcs=(SEASONS[0]&&SEASONS[0].bossCards)||[];
    for(var i=0;i<bcs.length;i++){ if(bcs[i].id===bossId){ lv=i+1; break; } }
    var mask = document.createElement('div');
    mask.id = '__hs_showcase';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#0a0a14';
    var iframe = document.createElement('iframe');
    iframe.src = 'boss_hall.html?v=1135&season=1&lv=' + lv;
    iframe.setAttribute('title', 'BOSS 殿堂');
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0a0a14';
    mask.appendChild(iframe);
    var closeBtn = document.createElement('div');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;z-index:5;width:40px;height:40px;border-radius:50%;background:rgba(10,12,24,.82);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:24px;line-height:38px;text-align:center;cursor:pointer';
    closeBtn.addEventListener('click', function(){ if(mask.parentNode) mask.parentNode.removeChild(mask); });
    mask.appendChild(closeBtn);
    document.body.appendChild(mask);
  }

  // 🔴v805: 赛季守关 boss 卡 → 轻量全屏观赏(立绘落在本命背景上·传说边框·名字+典藏台词)。纯静态·零动画(守禁旋转/闪烁铁律)。bgImg 有则用背景图·否则占位渐变(待 Hansen 发图填 bgImg)。
  function openBossCardView(card){
    if(!card || document.getElementById('__hs_bcv')) return;
    var r = RARITY_STYLE[card.rarity] || RARITY_STYLE.legend;
    var bgStyle = card.bgImg ? ('url("'+card.bgImg+'?v=1135") center/cover') : card.bg;
    var mask = document.createElement('div');
    mask.id = '__hs_bcv';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:rgba(8,8,18,.92);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    mask.innerHTML =
      '<div style="width:100%;max-width:330px">'+
        '<div style="position:relative;width:100%;aspect-ratio:3/4;border-radius:20px;overflow:hidden;border:3px solid '+r.color+';box-shadow:0 0 34px '+r.glow+',0 18px 50px rgba(0,0,0,.6);background:'+bgStyle+'">'+
          '<img src="'+card.img+'?v=1135" onerror="this.onerror=null;this.style.visibility=\'hidden\'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 8px 18px rgba(0,0,0,.6))" alt="">'+
          '<div style="position:absolute;top:11px;left:11px;background:'+r.color+';color:#1a1226;font-size:11px;font-weight:900;padding:3px 11px;border-radius:8px">★ '+r.name+'</div>'+
          '<div style="position:absolute;left:0;right:0;bottom:0;padding:16px 15px 17px;background:linear-gradient(to top,rgba(8,8,18,.94),rgba(8,8,18,.55),transparent)">'+
            '<div style="font-size:18px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.8)">'+card.name+'</div>'+
            '<div style="font-size:12px;color:#cbd5e1;margin-top:6px;line-height:1.55">'+card.desc+'</div>'+
            '<div style="font-size:10px;color:'+r.color+';font-weight:800;margin-top:8px;letter-spacing:.5px">赛季限定 · 神秘殿堂典藏</div>'+
          '</div>'+
        '</div>'+
        '<div id="__hs_bcv_close" style="margin:18px auto 0;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:24px;line-height:44px;text-align:center;cursor:pointer">×</div>'+
      '</div>';
    document.body.appendChild(mask);
    function close(){ if(mask.parentNode) mask.parentNode.removeChild(mask); }
    mask.addEventListener('click', function(e){ if(e.target===mask) close(); });
    var cb = document.getElementById('__hs_bcv_close'); if(cb) cb.addEventListener('click', close);
  }

  function mountUI(){
    if(!isHomePage()) return;       // 只首页显示赛季入口
    buildEntryButton();
    buildHallEntry();
  }

  // ---- 挂载: 轮询包裹埋点 + 首页挂赛季进度条 ----
  var tries = 0;
  var timer = setInterval(function(){
    tries++;
    var done = hookScoreEvents();
    if(document.body && isHomePage()){ buildProgressBar(); buildEntryButton(); buildHallEntry(); }  // 首页挂进度条+神秘殿堂入口(.islands锚点); 入口卡片若有util-card也挂
    var barMounted = !!document.getElementById('hsnSeasonBar');
    if((done && (barMounted || !isHomePage())) || tries >= 100){ clearInterval(timer); }
  }, 150);

})();
