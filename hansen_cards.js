// hansen_cards.js v153 — boss 卡牌收藏系统
// v330 起: 【每个岛 boss 进度完全独立】数据存 'hansen_card_data_<岛名>' (如 hansen_card_data_animal),
//   各岛各存一份, 互不影响。Hansen 明确要求: 每个岛的 boss 闯关进度独立, 在一个岛打通不影响其它岛。
//   (旧版用单一全局 'hansen_card_data' 18 岛共享, 导致一个岛打通后其它岛 boss 全部解锁 = bug, 已修。)
(function(){
  if(window.__hansenCardsLoaded){return} window.__hansenCardsLoaded=true;

  var ALL_ISLANDS = ['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school','sports','time','traffic','treasure'];
  var TOTAL_ISLANDS = ALL_ISLANDS.length; // 18

  // v330: 当前岛专属的卡牌存档 key (按岛名隔离, 实现每岛 boss 进度独立)
  //   getCurrentIslandKey() 从 URL island_<name>.html 提取岛名; 取不到时回退 'unknown'(单独一桶, 不污染任何真实岛)。
  function getStorageKey(){
    var ik = getCurrentIslandKey();
    return 'hansen_card_data_' + (ik && ik.length ? ik : 'unknown');
  }

  // 20 个 boss 卡牌数据
  var BOSS_CARDS = [
    {lv:1,  name:'淘气小幽灵', img:'bosses/lv01.webp?v=1161', frame:'#e2e8f0', rarity:'common',    desc:'飘忽不定的初见之敌, 总在云雾间嬉戏。'},
    {lv:2,  name:'暗影忍者',   img:'bosses/lv02.webp?v=1161', frame:'#94a3b8', rarity:'common',    desc:'潜行于阴影, 一击必杀的影舞者。'},
    {lv:3,  name:'百战兽人',   img:'bosses/lv03.webp?v=1161', frame:'#84cc16', rarity:'common',    desc:'身经百战的兽人勇士, 战锤所向披靡。'},
    {lv:4,  name:'史前霸王龙', img:'bosses/lv04.webp?v=1161', frame:'#ef4444', rarity:'common',    desc:'远古时代的顶级掠食者, 巨齿撕裂万物。'},
    {lv:5,  name:'千年僵尸',   img:'bosses/lv05.webp?v=1161', frame:'#65a30d', rarity:'uncommon',  desc:'沉睡千年的古老亡灵, 咒语唤醒之时。'},
    {lv:6,  name:'暗夜吸血鬼', img:'bosses/lv06.webp?v=1161', frame:'#dc2626', rarity:'uncommon',  desc:'城堡之主, 永生于黑夜的伯爵。'},
    {lv:7,  name:'蒙面大魔王', img:'bosses/lv07.webp?v=1161', frame:'#a855f7', rarity:'uncommon',  desc:'面具下是谁? 黑暗之力的化身。'},
    {lv:8,  name:'地狱犬王',   img:'bosses/lv08.webp?v=1161', frame:'#b91c1c', rarity:'uncommon',  desc:'三头看门犬, 守护地狱之门。'},
    {lv:9,  name:'黑森林巫婆', img:'bosses/lv09.webp?v=1161', frame:'#7c3aed', rarity:'rare',      desc:'盘踞黑森林深处的老巫婆, 毒苹果与魔药的主人。'},
    {lv:10, name:'异次元巫师', img:'bosses/lv10.webp?v=1161', frame:'#c084fc', rarity:'rare',      desc:'撕裂空间, 改写时空法则。'},
    {lv:11, name:'龙骑士统帅', img:'bosses/lv11.webp?v=1161', frame:'#ea580c', rarity:'rare',      desc:'巨龙之翼遮天蔽日, 千年荣耀传承。'},
    {lv:12, name:'暗黑灯神',   img:'bosses/lv12.webp?v=1161', frame:'#4f46e5', rarity:'rare',      desc:'瓶中蛰伏太久的金色烟雾, 自由是代价。'},
    {lv:13, name:'海底巨怪',   img:'bosses/lv13.webp?v=1161', frame:'#0891b2', rarity:'epic',      desc:'深渊之触, 八爪缠绕无处可逃。'},
    {lv:14, name:'寒冰女王',   img:'bosses/lv14.webp?v=1161', frame:'#22d3ee', rarity:'epic',      desc:'冰封万古之力, 一切在她面前都将冻结。'},
    {lv:15, name:'烈焰魔神',   img:'bosses/lv15.webp?v=1161', frame:'#f97316', rarity:'epic',      desc:'焚尽世间的烈火, 化为灰烬是唯一结局。'},
    {lv:16, name:'雷电之主',   img:'bosses/lv16.webp?v=1161', frame:'#facc15', rarity:'epic',      desc:'天雷轰顶, 闪电之力无可匹敌。'},
    {lv:17, name:'机械泰坦',   img:'bosses/lv17.webp?v=1161', frame:'#64748b', rarity:'legendary', desc:'钢铁之躯, 系统在线, 目标锁定。'},
    {lv:18, name:'外星霸主',   img:'bosses/lv18.webp?v=1161', frame:'#10b981', rarity:'legendary', desc:'征服宇宙的至高生物, 地球只是下一站。'},
    {lv:19, name:'混沌魔尊',   img:'bosses/lv19.webp?v=1161', frame:'#6b21a8', rarity:'legendary', desc:'深渊审判, 地狱之门的守护者。'},
    {lv:20, name:'上古太阳神',   img:'bosses/lv20.webp?v=1161', frame:'#fbbf24', rarity:'legendary', desc:'万物之始, 宇宙在掌中, 凡人终须臣服。'}
  ];

  // 稀有度配色 (frame + 标签)

  // 🔴v649 图片加载失败: 先自动重试(网慢瞬时失败大多重试即成功) → 仍失败才用【干净中性占位】(绝不再用那个红鬼头像·Hansen明确要求彻底删除丑占位)
  window.hansenImgErr = function(img){
    if(!img) return;
    /* 🔴v787 防重入: 全局捕获器(capture阶段)与img自带onerror(target阶段)在同一次error派发里会都调到本函数·用__heBusy去重(本tick内只处理一次·下次真失败时已清除可再处理)·避免重试计数翻倍/双重reload */
    if(img.__heBusy) return; img.__heBusy=true; setTimeout(function(){ try{img.__heBusy=false;}catch(e){} },0);
    var tries = +(img.dataset.imgTries || 0);
    if(tries < 3){
      img.dataset.imgTries = tries + 1;
      var base = (img.src || '').split('#')[0].replace(/([?&])__rt=\d+/, '$1').replace(/[?&]$/, '');
      var sep = base.indexOf('?') >= 0 ? '&' : '?';
      setTimeout(function(){ try{ img.src = base + sep + '__rt=' + (tries + 1); }catch(e){} }, 450 * (tries + 1));
      return;
    }
    if(!img.dataset.errored){
      img.dataset.errored = '1';
      img.style.display = 'none';
      var parent = img.parentNode;
      if(parent){
        var ph = document.createElement('div');
        ph.style.cssText = 'width:100%;height:100%;min-height:60px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;color:#334155;font-size:30px;font-weight:800;border-radius:inherit';
        ph.textContent = '?';
        parent.appendChild(ph);
      }
    }
  };
  /* 🔴v787 全局图片错误捕获器(彻底解决"图片偶尔加载不出来一直空白"): img 的 error 事件不冒泡·但在捕获阶段会经过 document→挂 capture 监听拦下【全 app 所有 <img>】的加载失败·自动走 hansenImgErr 的3次重试(带缓存破坏__rt·递增延迟)。这样无论哪个模块/页面的图(头像/宠物/boss/装备/抽卡/拼写…)·哪怕没单独写 onerror·一次网络抖动(微信WebView慢网)失败也会自动重试恢复·而非永久空白。已自带 onerror 的图靠上面的 __heBusy 去重不会双触发。 */
  try{ if(!window.__hsnGlobalImgErr){ window.__hsnGlobalImgErr=1; document.addEventListener('error', function(e){ var t=e&&e.target; if(t&&t.tagName==='IMG'&&!t.dataset.noRetry){ try{ window.hansenImgErr(t); }catch(_e){} } }, true); } }catch(e){}
  
  var RARITY_COLORS = {
    common:    {bg:'#475569', name:'普通',   border:'#94a3b8'},
    uncommon:  {bg:'#16a34a', name:'优良',   border:'#4ade80'},
    rare:      {bg:'#2563eb', name:'稀有',   border:'#60a5fa'},
    epic:      {bg:'#9333ea', name:'史诗',   border:'#c084fc'},
    legendary: {bg:'#ea580c', name:'传说',   border:'#fb923c'}
  };

  var TEMP_KEY = 'hansen_card_temp_unlock_until';

  // ────────────────────────────────────────────────────
  // v208: 卡牌底色 8 个预设 (用户可自定义)
  // ────────────────────────────────────────────────────
  var BG_KEY = 'hansen_card_bg';
  var BG_PRESETS = [
    {id:'dark',   emoji:'🌑', name:'经典暗夜', bg:'#0f172a',                                                 dark:true},
    {id:'white',  emoji:'⚪', name:'纯净白',   bg:'#ffffff',                                                 dark:false},
    {id:'navy',   emoji:'🌊', name:'深海蓝',   bg:'linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%)',         dark:true},
    {id:'sky',    emoji:'☁️', name:'晴空蓝',   bg:'linear-gradient(135deg,#bae6fd 0%,#7dd3fc 100%)',         dark:false},
    {id:'sunset', emoji:'🌅', name:'暖夕阳',   bg:'linear-gradient(135deg,#fde68a 0%,#fdba74 100%)',         dark:false},
    {id:'purple', emoji:'🔮', name:'神秘紫',   bg:'linear-gradient(135deg,#581c87 0%,#1e1b4b 100%)',         dark:true},
    {id:'pink',   emoji:'🌸', name:'樱花粉',   bg:'linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%)',         dark:false},
    {id:'mint',   emoji:'🌿', name:'薄荷绿',   bg:'linear-gradient(135deg,#a7f3d0 0%,#6ee7b7 100%)',         dark:false},
    // 透明 thumb 用棋盘格暗示
    {id:'trans',  emoji:'🫧', name:'透明',     bg:'transparent', thumb:'repeating-conic-gradient(#475569 0% 25%,#1e293b 0% 50%) 50% / 14px 14px', dark:true, transparent:true}
  ];

  function getCurrentBg(){
    try {
      var id = localStorage.getItem(BG_KEY) || 'dark';
      for(var i = 0; i < BG_PRESETS.length; i++){
        if(BG_PRESETS[i].id === id) return BG_PRESETS[i];
      }
    } catch(e){}
    return BG_PRESETS[0];
  }

  window.hansenSetCardBg = function(id){
    try { localStorage.setItem(BG_KEY, id); } catch(e){}
    if(typeof window.hansenRenderCards === 'function') window.hansenRenderCards();
  };

  // ────────────────────────────────────────────────────
  // 数据存取
  // ────────────────────────────────────────────────────
  function isTempActive(){
    try{
      var until = parseInt(localStorage.getItem(TEMP_KEY) || '0');
      return until > Date.now();
    } catch(e){ return false; }
  }
  
  // loadData(rawOnly): 读取卡牌/皮肤/通关存档
  //   🛡️ v219 存档防护: 主存档读出来是坏的/空的, 自动从备份 key 恢复 (防"进度突然没了")
  //   rawOnly=true 时返回真实数据 (不应用临时全解锁覆盖)
  function cleanCardData(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    var clears={},source=raw.islandClears;
    if(source&&typeof source==='object'&&!Array.isArray(source)){
      for(var lv=1;lv<=20;lv++){
        var saved=source[lv];if(!Array.isArray(saved))continue;
        var seen={},list=[];
        for(var i=0;i<saved.length;i++){
          var island=saved[i];
          if(typeof island==='string'&&ALL_ISLANDS.indexOf(island)>=0&&!seen[island]){seen[island]=1;list.push(island);}
        }
        if(list.length)clears[lv]=list;
      }
    }
    var collected=[],collectedSeen={};
    if(Array.isArray(raw.collected))for(var j=0;j<raw.collected.length;j++){
      var card=raw.collected[j];
      if(typeof card==='number'&&isFinite(card)&&Math.floor(card)===card&&card>=1&&card<=20&&!collectedSeen[card]){
        collectedSeen[card]=1;collected.push(card);
      }
    }
    collected.sort(function(a,b){return a-b;});
    return {islandClears:clears,collected:collected,masterUnlocked:raw.masterUnlocked===true&&collected.length===20};
  }
  function loadData(rawOnly){
    var SK = getStorageKey();   // v330: 当前岛专属 key (各岛独立)
    var raw = '';
    try { raw = localStorage.getItem(SK) || ''; } catch(e){}
    var d = null;
    // 先试主存档
    try { if(raw) d = cleanCardData(JSON.parse(raw)); } catch(e){ d = null; }
    // 🛡️ 主存档坏了或为空 → 从备份恢复
    if(!d || typeof d !== 'object'){
      try {
        var bak = localStorage.getItem(SK + '_bak');
        if(bak){
          var bd = cleanCardData(JSON.parse(bak));
          if(bd){
            d = bd;
            // 备份比主存档好, 顺手把主存档修回来
            try { localStorage.setItem(SK, bak); } catch(e){}
            console.warn('[存档防护] 主存档损坏, 已从备份恢复');
          }
        }
      } catch(e){}
    }
    try {
      if(!d)d = {islandClears:{},collected:[],masterUnlocked:false};

      // v166: rawOnly = true 时不应用临时覆盖 (markBossWin 用这个去更新真实数据)
      if(rawOnly) return d;

      // v156: 临时全解锁覆盖 (24 小时, 看效果用; 不污染真实数据)
      if(isTempActive()){
        var allLvs = [];
        for(var i = 1; i <= 20; i++) allLvs.push(i);
        d = Object.assign({}, d, {collected: allLvs, masterUnlocked: true, __isTemp: true});
      }
      return d;
    } catch(e){
      return {islandClears:{}, collected:[], masterUnlocked:false};
    }
  }
  // saveData(d, force): 保存存档
  //   🛡️ v219 存档防护 (防"进度/皮肤突然没了"):
  //     1) 先写备份 key, 再写主 key (双备份: 任一份坏了还有另一份)
  //     2) 写完读回来校验, 确认真的存进去了
  //   ⚠️ 注意: 本机存档只是"过渡保护". 真正防丢/防纠纷(尤其充值皮肤)必须靠云端账号系统,
  //      见 README「云端账号与支付架构」。本机数据用户可清除/可篡改, 不能作为充值凭据。
  function saveData(d, force){
    // 临时态时不写回 (避免污染真实数据); force=true 时强制写 (markBossWin 用)
    if(d && d.__isTemp && !force) return;
    var SK = getStorageKey();   // v330: 当前岛专属 key (各岛独立)
    var json;
    try { json = JSON.stringify(d); } catch(e){ return; }  // 序列化失败直接放弃, 不破坏已有存档
    try {
      // 1) 先写备份 (主存档若写到一半崩, 备份仍是上一份完好数据)
      localStorage.setItem(SK + '_bak', json);
      // 2) 再写主存档
      localStorage.setItem(SK, json);
      // 3) 写入校验: 读回来比对, 不一致说明没存成功 (存储满等), 再补写一次备份
      var check = localStorage.getItem(SK);
      if(check !== json){
        console.warn('[存档防护] 主存档写入校验未通过, 已保留备份');
      }
    } catch(e){
      console.warn('[存档防护] 存档写入失败 (可能存储已满或隐私模式):', e && e.message);
    }
  }
  function getCurrentIslandKey(){
    var m = (location.pathname || '').match(/island_(\w+)\.html/);
    return m ? m[1] : 'unknown';
  }
  
  // 临时解锁 API (Hansen 在 console 或 UI 按钮调)
  window.hansenTempUnlock = function(hours){
    if(hours === undefined || isNaN(hours)) hours = 24;
    var until = Date.now() + hours * 3600 * 1000;
    try{ localStorage.setItem(TEMP_KEY, String(until)); } catch(e){}
    console.log('%c🎁 卡牌临时全解锁 ' + hours + ' 小时, 至 ' + new Date(until).toLocaleString(),
                'background:#fbbf24;color:#1e293b;padding:4px 10px;font-weight:bold');
    if(typeof window.hansenRenderCards === 'function') window.hansenRenderCards();
    return '已临时解锁 ' + hours + ' 小时';
  };
  
  window.hansenTempLock = function(){
    try{ localStorage.removeItem(TEMP_KEY); } catch(e){}
    console.log('%c🔒 卡牌临时解锁已取消, 回到真实进度',
                'background:#64748b;color:#fff;padding:4px 10px;font-weight:bold');
    if(typeof window.hansenRenderCards === 'function') window.hansenRenderCards();
    return '已取消临时解锁';
  };

  // ────────────────────────────────────────────────────
  // 核心: 记录战胜 boss
  // ────────────────────────────────────────────────────
  function markBossWin(lv){
    if(!lv || lv < 1 || lv > 20) return;
    var island = getCurrentIslandKey();
    if(ALL_ISLANDS.indexOf(island) < 0) return;  // 非合法岛, 不记录

    // v166: 用 rawOnly 直接读真实数据 (绕过临时覆盖)
    var d = loadData(true);
    if(!d.islandClears[lv]) d.islandClears[lv] = [];
    
    var alreadyDone = d.islandClears[lv].indexOf(island) >= 0;
    if(alreadyDone) return;  // 该岛该 lv 已记过
    
    d.islandClears[lv].push(island);
    
    // v330: 每岛独立 — 在【当前岛】打通第 lv 关, 即解锁第 lv 关卡牌。
    //   (旧版要求在全部 18 个岛都打过第 lv 关才解锁, 是跨岛共享模式; 现在每岛独立存档,
    //    islandClears[lv] 在单岛里只会有自己一个岛名, 故改为单岛打通即解锁。)
    if(d.collected.indexOf(lv) < 0){
      d.collected.push(lv);
      d.collected.sort(function(a,b){return a-b});
    }

    // 🔴 BUG#48 修复 (v469): 打 boss 胜利【绝不】再往全局卡册 HansenCardbook 填卡!
    //   规则(我们之前在 myword 那次定的): 卡牌只能靠【抽卡 hansen_gacha.js】获得(花金币抽), 打 boss 不直接送卡
    //   —— 否则抽卡经济失去意义、卡牌等于白嫖。打 boss 只记 d.collected(boss 通关进度, 每关独立、不串联),
    //   绝不碰卡册、金币、经验或强化。正式 Boss 奖励只由岛页 + hansen_round_reward.js 结算。
    //   全局卡册(收藏)由【抽卡】唯一填充。⚠️ 别把 HansenCardbook.obtain 或任何经济发奖加回这里!
    //   (check_resources 检查14 会守卫: markBossWin 里一旦出现 HansenCardbook.obtain → 直接拒绝打包。)
    
    // 检查是否集齐 20 张 → 卡牌大师
    var masterNowUnlocked = false;
    if(d.collected.length >= 20 && !d.masterUnlocked){
      d.masterUnlocked = true;
      masterNowUnlocked = true;
    }
    
    // v166: force=true 强制写真实数据 (即使有 __isTemp 也写)
    saveData(d, true);
    
    // v166: 临时态下不弹完成展示 (用户视觉上 20 张全已亮, 再弹完成很突兀)。
    // v941: 卡牌模块是只记录/展示消费者，绝不在这里暗发金币、经验、钻石或强化。
    var inTemp = isTempActive();

    if(masterNowUnlocked){
      if(!inTemp) setTimeout(showMasterUnlocked, 1800);
    }
  }
  window.hansenCardsMarkBoss = markBossWin;

  // v941: 只解析【这一场实际正在打的本地 Boss 序号】。
  // 严禁回退 S.level：它是玩家 XP 段位，不是 Boss 关号，曾造成高段位玩家把错误关卡写进卡牌进度。
  function resolveActualBossLv(){
    var n, max = 20;
    try { if(typeof BOSSES !== 'undefined' && BOSSES && BOSSES.length) max = BOSSES.length; } catch(e){}
    try {
      n = Number(window._hansenRebattleLv);
      if(window._hansenRebattleLv != null && isFinite(n) && n >= 1 && n <= max) return Math.floor(n);
      n = Number(window._s1Idx);
      if(window._s1Idx != null && isFinite(n) && n >= 0 && n < max) return Math.floor(n) + 1;
      if(typeof BOSSES !== 'undefined' && typeof bossCurrent !== 'undefined' && bossCurrent){
        for(var i = 0; i < BOSSES.length; i++) if(BOSSES[i] === bossCurrent) return i + 1;
      }
      n = window.S && Number(window.S.bossCurrentLv);
      if(isFinite(n) && n >= 1 && n <= max) return Math.floor(n);
    } catch(e){}
    return 0; // 没有权威关号就不记，宁可漏一条展示记录，也绝不把 XP 段位冒充 Boss 关号。
  }

  // 🔴v866(Hansen: 大满贯进度器统计不准的根修): 暴露【本岛真实已通关关号】只读接口=islandClears权威数据(与卡册"已击败 boss X/20"同源)。进度器改读它, 不再自己靠 S.level(冒险等级·跨岛共享)瞎猜。
  window.getIslandClearedLevels = function(){
    try{
      var d = loadData(true);           // rawOnly=真实数据·绕过临时覆盖
      var island = getCurrentIslandKey();
      var out = [];
      for(var lv = 1; lv <= 20; lv++){
        var cl = (d.islandClears && d.islandClears[lv]) || [];
        if(cl.indexOf(island) >= 0) out.push(lv);   // 本岛在这关的通关名单里=这关真打赢过
      }
      return out;
    }catch(e){ return []; }
  };  // 暴露给 hansen_boss_lock.js 调用

  // ────────────────────────────────────────────────────
  // UI: 解锁 toast (右上飞入)
  // ────────────────────────────────────────────────────
  function showCardUnlockedToast(lv){
    var b = BOSS_CARDS[lv-1];
    if(!b) return;
    var r = RARITY_COLORS[b.rarity];
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,'+r.bg+','+r.border+');border:3px solid '+r.border+';border-radius:16px;padding:14px 18px;z-index:99998;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 40px '+r.border+';max-width:90vw;animation:hansenCardToastIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;font-family:"Microsoft YaHei",sans-serif';
    t.innerHTML = '<img src="'+b.img+'" onerror="hansenImgErr(this)" style="width:64px;height:64px;border-radius:10px;background:#1e293b;border:2px solid '+r.border+'"/>' +
      '<div style="color:#fff"><div style="font-size:11px;color:#fef3c7;font-weight:700">🎴 新卡牌解锁!</div>' +
      '<div style="font-size:18px;font-weight:900;margin:2px 0">'+b.name+'</div>' +
      '<div style="font-size:11px;opacity:0.9">'+r.name+' · Lv.'+b.lv+' · 通关记录已点亮</div></div>';
    document.body.appendChild(t);
    setTimeout(function(){
      t.style.transition = 'all 0.5s ease-in';
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(-30px)';
    }, 3500);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, 4100);
  }

  function showMasterUnlocked(){
    // 🔴 BUG #11 同款修复 (v231): 不用 closest('div').parentNode.remove() 这种依赖 DOM 结构的写法
    // 改用闭包持有外层 t 引用直接 remove + 点空白关闭 + ESC 关闭 三重保险
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle at center,rgba(251,191,36,0.4),rgba(0,0,0,0.85));z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Microsoft YaHei",sans-serif';
    t.innerHTML = '<div style="text-align:center;color:#fff;animation:hansenMasterIn 0.8s ease-out forwards">' +
      '<div style="font-size:120px;line-height:1">✨</div>' +
      '<div style="font-size:36px;font-weight:900;background:linear-gradient(90deg,#fbbf24,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:8px 0">卡牌大师!</div>' +
      '<div style="font-size:18px;font-weight:700;color:#fef3c7">收集全部 20 张 boss 卡牌</div>' +
      '<div style="font-size:14px;color:#fde68a;margin-top:8px">20 关通关记录已全部点亮</div>' +
      '<button id="hanMasterUnlockOk" style="margin-top:20px;background:#fbbf24;color:#1e293b;border:none;padding:12px 32px;font-size:16px;font-weight:900;border-radius:12px;cursor:pointer">太棒了!</button>' +
      '</div>';
    document.body.appendChild(t);
    // 三重保险
    var btn = t.querySelector('#hanMasterUnlockOk');
    if(btn) btn.addEventListener('click', function(){ try{ t.remove(); }catch(e){} });
    setTimeout(function(){
      t.addEventListener('click', function(e){ if(e.target===t){ try{ t.remove(); }catch(e){} } });
    }, 500);
    var esc = function(e){ if(e.key==='Escape'||e.keyCode===27){ try{ t.remove(); }catch(e2){} document.removeEventListener('keydown',esc); } };
    document.addEventListener('keydown', esc);
  }

  // v161: 确保独立的 #cardsScreen 存在 (不再污染 #achScreen)
  function ensureCardsScreen(){
    var s = document.getElementById('cardsScreen');
    if(s) return s;
    s = document.createElement('div');
    s.className = 'screen';
    s.id = 'cardsScreen';
    (document.getElementById('app')||document.body).appendChild(s);   // ★放进 #app(像 home/boss 等正常页面一样紧贴顶栏), 不再挂 body 之外导致顶部大空隙
    return s;
  }
  
  // ────────────────────────────────────────────────────
  // v208: Boss 选择器 — 每个岛 boss 战进入即看到选择网格
  // ────────────────────────────────────────────────────
  function getMaxChallengeLv(){
    // v319: 严格逐关 — 可挑战上限 = 已解锁的最高 boss 关 (bossUnlocked), 必须打赢上一关才解锁下一关.
    //   旧代码用 window.S.level(玩家XP等级)做上限, 导致高等级玩家(如Lv26)直接解锁全部20关 = 跳关!
    //   优先用 hansen_boss_progress 的 getUnlockedBossLv(); 读不到时回退到 S.bossUnlocked.
    try {
      if(typeof window.getUnlockedBossLv === 'function'){
        return Math.max(1, Math.min(20, window.getUnlockedBossLv()));
      }
      if(window.HansenBossProgress && typeof window.HansenBossProgress.getUnlockedBossLv === 'function'){
        return Math.max(1, Math.min(20, window.HansenBossProgress.getUnlockedBossLv()));
      }
    } catch(e){}
    var bu = (window.S && typeof window.S.bossUnlocked === 'number') ? window.S.bossUnlocked : 1;
    return Math.max(1, Math.min(20, bu));
  }
  
  /* 🔴 v537(Hansen 定稿): boss 攻击特效开关组件——用户有权自选是否播放 boss 攻击特效。
     状态: localStorage 'hansen_bossfx_on'(缺省='1'开)。开=绿色渐变+白字ON+辉光, 关=红色渐变+白字OFF+辉光;
     白字配深色 text-shadow 与底色分明; 滑块白色圆钮带回弹过渡。点击=机械咔哒+双音滑奏(开升调/关降调, WebAudio 合成, try/catch 全包不可能抛错)。
     消费方: hansen_boss_attack.js 调度入口读同一键, '0' 时跳过全部特效直接 deal()(掉血反馈照常, 游戏逻辑零改变)。
     渲染: 整个 picker 每次 innerHTML 重渲染, hansenFxSwitchHTML() 渲染时读最新状态; 切换只就地更新按钮 DOM(不重渲染列表不丢滚动位)。 */
  function hansenFxOn(){ try{ return localStorage.getItem('hansen_bossfx_on')!=='0'; }catch(e){ return true; } }
  function hansenFxSwStyle(on){
    return 'position:relative;width:66px;height:28px;border-radius:14px;cursor:pointer;flex-shrink:0;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:background .25s,box-shadow .25s;border:1.5px solid rgba(255,255,255,.5);' +
      (on ? 'background:linear-gradient(135deg,#22c55e,#15803d);box-shadow:0 0 11px rgba(34,197,94,.7),inset 0 1px 2px rgba(255,255,255,.35);'
          : 'background:linear-gradient(135deg,#ef4444,#b91c1c);box-shadow:0 0 11px rgba(239,68,68,.65),inset 0 1px 2px rgba(255,255,255,.3);');
  }
  function hansenFxSwInner(on){
    var knob = '<span style="position:absolute;top:2px;' + (on ? 'left:40px' : 'left:2px') + ';width:21px;height:21px;border-radius:50%;background:linear-gradient(180deg,#ffffff,#e2e8f0);box-shadow:0 1px 3px rgba(0,0,0,.45);transition:left .25s cubic-bezier(.4,1.4,.6,1);pointer-events:none"></span>';
    var txt = '<span style="position:absolute;top:0;line-height:25px;' + (on ? 'left:9px' : 'right:8px') + ';font-size:11px;font-weight:900;color:#fff;letter-spacing:.5px;text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:none">' + (on ? 'ON' : 'OFF') + '</span>';
    return knob + txt;
  }
  function hansenFxSwitchHTML(){
    var on = hansenFxOn();
    return '<div id="hsnFxSw" role="button" aria-label="boss攻击特效开关" title="boss 攻击特效 开/关" onclick="hansenFxSwitchToggle()" style="' + hansenFxSwStyle(on) + '">' + hansenFxSwInner(on) + '</div>';
  }
  function hansenFxSwSound(on){
    try{
      var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
      if(!window.__hsnFxAC) window.__hsnFxAC = new AC();
      var c = window.__hsnFxAC;
      if(c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
      var t = c.currentTime;
      var clk = c.createOscillator(), cg = c.createGain();          // 机械咔哒
      clk.type = 'square'; clk.frequency.setValueAtTime(on ? 1500 : 900, t);
      cg.gain.setValueAtTime(.11, t); cg.gain.exponentialRampToValueAtTime(.0001, t + .05);
      clk.connect(cg); cg.connect(c.destination); clk.start(t); clk.stop(t + .06);
      var o = c.createOscillator(), g = c.createGain();             // 双音滑奏: 开升调/关降调
      o.type = 'sine';
      if(on){ o.frequency.setValueAtTime(520, t + .03); o.frequency.exponentialRampToValueAtTime(880, t + .16); }
      else  { o.frequency.setValueAtTime(660, t + .03); o.frequency.exponentialRampToValueAtTime(330, t + .16); }
      g.gain.setValueAtTime(.0001, t + .03); g.gain.exponentialRampToValueAtTime(.15, t + .06); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g); g.connect(c.destination); o.start(t + .03); o.stop(t + .24);
    }catch(e){}
  }
  function hansenFxSwitchToggle(){
    var on = !hansenFxOn();
    try{ localStorage.setItem('hansen_bossfx_on', on ? '1' : '0'); }catch(e){}
    var el = document.getElementById('hsnFxSw');
    if(el){ el.style.cssText = hansenFxSwStyle(on); el.innerHTML = hansenFxSwInner(on); }
    hansenFxSwSound(on);
  }
  window.hansenFxSwitchToggle = hansenFxSwitchToggle;

  // ════════════════════════════════════════════════════════════════════════
  //🔴v810 🌌 赛季岛(星海词汇大冒险)专属 6-boss 选关 —— 完全隔离, 18 个常规岛不受影响。
  //   赛季是 6 个守关 boss(不是 20 关), 各自高清立绘 + 按序解锁。
  //   路由: renderBossPicker 顶部检测 getCurrentIslandKey()==='season' → 走这里 return。
  //   常规岛(BOSSES.length=20)走原 renderBossPicker, 一行不动。
  // ════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════
  // 🔴 v815: 星海剧情系统 —— 故事阅读器 + 序章(《星海的回响》典藏版原文)
  //   仅赛季岛(renderSeasonBossPicker 内触发)。序章首次进赛季 boss 区自动放·之后"📖 重读序章"按钮可重看。
  //   v816+ 续加: 各 boss 战前相遇 / 战后和解+信物 / 神秘殿堂「星海纪事」。无震屏无屏闪无循环动画。
  // ════════════════════════════════════════════════════════════
  window.HANSEN_STORY = window.HANSEN_STORY || {};
  window.HANSEN_STORY.prologue = {"key": "prologue", "title": "序章 · 那一夜，最远的星亮了一下", "blocks": [{"t": "p", "text": "那是一个再普通不过的夜晚。"}, {"t": "p", "text": "你做完了一天该做的事，趴在窗台上，望着外面的天。城市的灯太亮了，天上只剩下零零散散的几颗星，淡得几乎要看不见。你也说不清自己那一刻在想什么——只是忽然觉得有点孤单。是那种很安静、很轻、却又压在心口的孤单：好像整个世界都已经睡熟了，只剩下你一个人，还醒着，还在看着这片没有人陪你一起看的夜空。"}, {"t": "p", "text": "就在那一刻——"}, {"t": "p", "text": "最远的、最暗的那一颗星，亮了一下。"}, {"t": "p", "text": "不是流星划过的那种亮。流星是擦着夜空跑过去的，而它，是冲着你，一个人，亮的。那道光很慢，很稳，它穿过窗玻璃，穿过夜色，穿过你的眼睛，一直、一直，落进你心里最深、最深的地方。然后，在那里，它停下来，变成了一句话。"}, {"t": "p", "text": "一句不是用耳朵听见、而是直接在你心里响起来的话："}, {"t": "quote", "text": "\"来吧，远行者。\n　星海，太久没有听到新的声音了。\n　学会星辰的语言吧——一步，一步地，走到我这里来。\n　沿途，那些古老的守护者……替我，去看看它们，好吗？\n　它们在等一个，能听懂它们的人。\n　已经等了，太久，太久了。\""}, {"t": "p", "text": "你想问\"你是谁\"，可话还没出口——"}, {"t": "p", "text": "窗户不见了。墙不见了。城市的灯火，全都不见了。"}, {"t": "p", "text": "你站在了一片，无边无际的、缓缓流动的星河之中。"}, {"t": "p", "text": "脚下没有地面，头顶没有天空。上下左右、四面八方，全是深不见底的、温柔得让人想哭的——星辰的海洋。一颗颗星从你身边静静地漂过，有的像萤火虫那么小，有的像一整轮月亮那么大，它们流淌着、旋转着，像有生命一样，轻轻地呼吸。"}, {"t": "p", "text": "这就是星海。"}, {"t": "p", "text": "后来，你慢慢知道了关于它的事。星海，是比\"天空\"和\"宇宙\"都更古老的东西。它是所有星辰的故乡，是光与暗、生与灭、开始与结束，最初诞生的地方。在它的深处，住着许多古老的存在——它们见证了第一颗恒星的点燃，也终将，见证最后一颗恒星的熄灭。"}, {"t": "p", "text": "它们强大。它们永恒。"}, {"t": "p", "text": "它们，也孤独。"}, {"t": "p", "text": "它们孤独，是因为它们太老了。老到，再没有任何一个存在，能听懂它们说话；老到，它们说出口的每一个词，都落进虚空里，再没有一丝、一毫的回音。它们守着星海的每一个角落，日复一日，纪元复纪元，却从来，没有谁，对它们说过一句——\"我懂你\"。"}, {"t": "p", "text": "你站在星河里，渐渐发现了一件事：远处的那些星，正在一颗、一颗地，悄悄地，熄灭。"}, {"t": "p", "text": "它们不是炸开的，不是坠落的。它们只是，像一盏盏被人遗忘了太久的灯，光，越来越弱，越来越淡，然后，无声无息地，灭了。"}, {"t": "p", "text": "你不懂为什么。你回头想找来时的路，可身后，只有更多的星河。"}, {"t": "p", "text": "你什么都没有。你不会星辰的语言。你认得的字，一只手就数得过来。你连，自己为什么会站在这里，都说不清楚。"}, {"t": "p", "text": "你只带着两样东西：一颗，想要听懂这片星海的心；和一本，空白的，词典。"}, {"t": "p", "text": "但你还是，迈出了第一步。"}, {"t": "p", "text": "你那时还不知道——你即将听懂的星辰的话语，会变成一把钥匙。一把，打开一颗，亿万年来，无人能懂的、孤独的心的，钥匙。"}]};
  //🔴v816 各 boss 战前相遇(meetN) + 战后和解+信物(recoN)·从典藏版精确切分
  Object.assign(window.HANSEN_STORY, {"meet1": {"key": "meet1", "title": "第一章 · 创世之炉 —— 铸星者 · 原初匠人", "boss": "铸星者·原初匠人", "blocks": [{"t": "p", "text": "你顺着星河往里走。"}, {"t": "p", "text": "走着走着，你看见漂过身边的一颗小星上，浮着一个淡淡的、发光的符号。你伸手碰了碰它——那符号，忽然在你脑子里，变成了一个意思，一个声音，一个，词。"}, {"t": "p", "text": "你翻开那本空白的词典。那个词，自己，落在了第一页上。"}, {"t": "p", "text": "原来，这就是\"学会星辰的语言\"。星海里，到处都飘着这样的词。你每碰懂一个，词典上就多一行；你心里那片混沌的、说不出话的地方，就亮起，一点点光。"}, {"t": "p", "text": "你一个、一个地，把它们收进词典。你不知道它们有什么用。"}, {"t": "p", "text": "直到，前方的虚空里，浮现出了一扇门。"}, {"t": "hr"}, {"t": "p", "text": "那是一扇，毫不起眼的，木门。"}, {"t": "p", "text": "它孤零零地，悬在星河之间，没有墙，没有屋子，就那么一扇门，立在那里。门框被烟火熏得发黑，上面挂着一块铜牌，用一种粗粗笨笨、却很有力气的笔迹，刻着一行字："}, {"t": "quote", "text": "\"正在工作中，请勿打扰。除非你带了茶。\""}, {"t": "p", "text": "门，虚掩着。门缝里，透出温暖的、橘红色的火光，还飘出一股，你从没闻过的、像是金属和阳光混在一起的香味。"}, {"t": "p", "text": "你站在门口，犹豫了很久。然后，你轻轻地，把门，推开了。"}, {"t": "p", "text": "——你愣住了。"}, {"t": "p", "text": "门后，不是一个房间。门后，是一座，没有尽头的，工坊。"}, {"t": "p", "text": "无数颗还没有完工的恒星，悬浮在一个个的锻造台上。有的，还只是一团朦朦胧胧的光；有的，已经能看出大概的样子，但光芒还在忽明忽暗地，试着燃烧。炉火，把整片虚空都映成了温暖的暗红色。墙角——如果那也算墙角的话——整整齐齐地码着半成品的行星，一颗颗按大小分好了类：岩石的、气体的、海洋的，还有一颗，通体闪着钻石般的光。更远处，一条流水线上，彗星被一颗颗地生产出来，每一条彗尾，都还包着一层防尘的薄膜。"}, {"t": "p", "text": "而在工坊的最深处，一个宽肩、厚背的老匠人，正背对着你，蹲在一颗忽明忽暗的恒星前面，专心地，拧着什么。"}, {"t": "p", "text": "他穿着一身，被高温烧了无数次、已经呈现出暗铜和铁灰交织色泽的工装，工装上，挂满了你叫不出名字的、各式各样的工具——有的像锤子，有的像凿子，有的，根本不知道是干什么用的。"}, {"t": "p", "text": "他听见了你的脚步声。"}, {"t": "p", "text": "他停下了手里的活，慢慢地，回过头来。"}, {"t": "p", "text": "你的心，提到了嗓子眼。你想象过这位\"铸造星辰的存在\"应该长什么样子——应该有着神祇一样威严的脸，或者，判官一样冷酷的眼神吧？"}, {"t": "p", "text": "可，都不是。"}, {"t": "p", "text": "他的那张脸，就是一张，你会在任何一个铁匠铺里，看到的，普普通通的、老师傅的脸。皮肤被炉火和岁月，一起打磨成了粗糙的古铜色，皱纹从眼角，深深地，向两边蔓延，沟壑深得，仿佛能夹住一粒星尘。他的鼻梁，宽宽的，还有点歪——后来你才知道，那是有一次星核爆炸，被崩飞的门框，砸歪的，他嫌麻烦，懒得修，就一直，这么歪着了。"}, {"t": "p", "text": "但是，当他那双眼睛，看见你的那一刻——"}, {"t": "p", "text": "那张被沟壑刻满的、沧桑的脸上，竟然，绽开了一个，毫不掩饰的、像个孩子一样的、惊喜的，笑容。"}, {"t": "p", "text": "\"哎呀，来得好！\"他的声音，浑厚而沙哑，像一口被人敲了亿万年的，古钟，\"我这儿，正缺个人手呢。\""}, {"t": "p", "text": "他没有问你是谁。没有问你从哪里来。没有问你，到这里，要干什么。"}, {"t": "p", "text": "他只是，撑着膝盖，慢慢地站起身，从腰间的工具带上，解下一把，看起来沉甸甸的，陨铁锤，然后，反手，抛给了你。"}, {"t": "p", "text": "\"接住！\""}, {"t": "p", "text": "你手忙脚乱地，把它抱在了怀里。"}, {"t": "p", "text": "——好重。"}, {"t": "p", "text": "那锤子，比你想象的，要重得多。那根本，不是一把适合打斗的、轻巧的武器。那是一把，真正的、每天都被用来，敲打恒星的、工匠的，锤。锤头，是用一颗已经熄灭了的白矮星的核心锻造的，表面布满了密密麻麻的、环形的撞击坑——那是他在亿万年里，砸了无数颗星，留下的，痕迹。"}, {"t": "p", "text": "\"喏，\"他朝你面前那颗，忽明忽暗的恒星，努了努下巴，\"这颗星，引力核心，还差最后一下校准。你来，砸。\""}, {"t": "p", "text": "他顿了顿，眼里带着一丝，老师傅特有的，狡黠的笑："}, {"t": "p", "text": "\"砸准了，我就当你，是我助手。砸偏了，也没事——旁边那颗行星，我本来，就打算报废。砸坏了，不心疼。\""}]}, "reco1": {"key": "reco1", "title": "第一章 · 创世之炉 —— 铸星者 · 原初匠人", "boss": "铸星者·原初匠人", "blocks": [{"t": "p", "text": "你深吸一口气，双手举起那把沉重的锤子，对准那颗星的中心，然后，用尽，全身的力气，狠狠地，砸了下去！"}, {"t": "p", "text": "\"——哐。\""}, {"t": "p", "text": "一声闷响。"}, {"t": "p", "text": "锤子，非但没有砸中核心，反而，像撞在了一团棉花上，软绵绵地、毫无着力点地，弹了回来。震得你的虎口，又麻又疼。"}, {"t": "p", "text": "而那颗恒星，在你这一击之下，光芒，猛地一暗——像一支被风吹得快要熄灭的蜡烛，颤巍巍地，眼看，就要灭了。"}, {"t": "p", "text": "你慌了。"}, {"t": "p", "text": "你赶紧，又举起锤子，想再砸一次，把它救回来——"}, {"t": "p", "text": "可是这一次，那锤子，重得，你几乎，举不起来了。"}, {"t": "p", "text": "它像是，在跟你赌气。你越是用力，它，就变得越重。你憋红了脸，双臂发抖，那锤头，却纹丝不动，沉得，像是要把你整个人，都拽到地上去。"}, {"t": "p", "text": "老匠人，没有说话。"}, {"t": "p", "text": "他只是，抱着双臂，靠在一旁，微微歪着脑袋，看着你。嘴角，挂着一丝，若有若无的、属于老师傅的，耐心。"}, {"t": "p", "text": "他不告诉你，应该用多大的力。不告诉你，应该从哪个角度。不告诉你，应该在哪一个节点，落锤。"}, {"t": "p", "text": "那，不是他的，教法。"}, {"t": "p", "text": "他的教法，是让你，自己去试。自己，去错。自己，在一次又一次的失败里，去找到，那个对的，节奏。"}, {"t": "p", "text": "你不甘心。你放下锤子，喘了几口气，又一次举起来，再砸——"}, {"t": "p", "text": "又偏了。"}, {"t": "p", "text": "那颗星，更暗了。暗到，几乎只剩下一丝，微弱的红线。"}, {"t": "p", "text": "你的额头，开始冒汗。你的心跳，越来越快，越来越乱。一种你从来，没有过的慌乱，像潮水一样，淹没了你——你做不到。你救不了它。你连，一颗星都点不亮，你还谈什么，走到星海的尽头？"}, {"t": "p", "text": "就在你，几乎要放弃的时候——"}, {"t": "p", "text": "你的指尖，碰到了，怀里那本，词典。"}, {"t": "p", "text": "你忽然，停住了。"}, {"t": "p", "text": "你低下头，看着那本词典，看着你这一路上，磕磕绊绊收集来的、那几个词。然后，你忽然，明白了一件事："}, {"t": "p", "text": "你砸不准，不是因为，你力气不够。"}, {"t": "p", "text": "你砸不准，是因为，你，太慌了。"}, {"t": "p", "text": "你需要的，不是更大的力气。你需要的，是先让自己——冷静下来。"}, {"t": "p", "text": "你闭上眼睛，深深地，吸了一口气。"}, {"t": "p", "text": "奇妙的事情，发生了。"}, {"t": "p", "text": "你那颗狂跳的心，一下、一下，慢了下来，平复了下来。你那双因为紧张而僵硬的手，一点、一点，松弛了下来。你脑子里，那个一直在喊\"我必须砸中、我必须砸中\"的声音，安静了。"}, {"t": "p", "text": "你睁开眼。"}, {"t": "p", "text": "这一次，你不再，盯着\"我要砸中\"这件事。你只是，安安静静地，看着那颗星的核心。看着它，那一丝微弱的红光，是怎样，一缩，一胀，一缩，一胀——你看见了，它，脉动的，节奏。"}, {"t": "p", "text": "然后，你举起锤子。"}, {"t": "p", "text": "你不再用蛮力。你只是，跟着它脉动的节奏，在它，胀到最满的那一个间隙，不轻，不重，刚刚好地——落下了，锤。"}, {"t": "p", "text": "\"——叮。\""}, {"t": "p", "text": "这一次，不是闷响。"}, {"t": "p", "text": "是一声，清亮的、像风铃一样的，回响。"}, {"t": "p", "text": "锤头，精准地，敲在了核心上。"}, {"t": "p", "text": "那颗奄奄一息的恒星，猛地，一震。然后，从最里面，到最外面，\"轰\"地一下，绽放出了，耀眼的、稳定的、温暖的光芒——把整座工坊，把你的脸，把老匠人那张沟壑纵横的脸，都，照亮了。"}, {"t": "p", "text": "老匠人，愣住了。"}, {"t": "p", "text": "他看着那颗，被你重新点亮的星。又，回过头来，看看你。"}, {"t": "p", "text": "他那双，被炉火淬炼了亿万年、像熔化的金属溶液一样的、暗金色的眼睛里，慢慢地，浮起了一种东西。"}, {"t": "p", "text": "那不是惊讶。也不是赞赏。"}, {"t": "p", "text": "那是一种……太久、太久没有出现过，几乎，都要被他自己，忘记了的——"}, {"t": "p", "text": "有人陪着的，暖意。"}, {"t": "p", "text": "\"我铸了亿万年的星，\"他轻声说，像是在对你说，又像是，在对他自己说，\"见过，数不清的星，亮起来。可是……从来，没有一个'材料'，会先让自己，静下来，再，动手。\""}, {"t": "p", "text": "他走过来，在你身边的一块星石上，坐了下来。然后，拍了拍他旁边的位置，示意你，也坐下。"}, {"t": "p", "text": "他从工装里，摸出一个粗陶的小壶，给你倒了一杯，淡淡的、银色的茶。"}, {"t": "p", "text": "\"陨石碎片泡的，\"他把杯子塞到你手里，\"小心烫。\""}, {"t": "p", "text": "茶，是暖的。带着一点点，金属的、和星辰的味道。"}, {"t": "p", "text": "你陪他，坐了很久。"}, {"t": "p", "text": "他指着工坊里那些，没完工的星辰，一颗一颗地，讲给你听：这颗，他打算做成蓝色的；那颗，核心不太稳，得返工；角落里那颗钻石行星，是他一时兴起做着玩的，没什么用，但好看。他讲那把陨铁锤，是怎么打出来的；讲那个会拧黑洞的扳手，有一次差点把他自己，也拧进去了。"}, {"t": "p", "text": "他讲得，眉飞色舞。"}, {"t": "p", "text": "像一个，憋了太久、太久，终于，等到了一个肯听他说话的人的，老人。"}, {"t": "p", "text": "你用你那几个，刚学会的词，磕磕绊绊地，回应着他，问着他。每问一句，他的眼睛，就亮一分。"}, {"t": "p", "text": "天色——如果星海里也算有天色的话——不知不觉，深了。"}, {"t": "p", "text": "你站起身，准备，继续上路。"}, {"t": "p", "text": "老匠人，也站了起来。"}, {"t": "p", "text": "你把那把陨铁锤，递还给他。"}, {"t": "p", "text": "可是，他没有接。"}, {"t": "p", "text": "他只是，用那只被高温烫得发红的、粗粝的大手，把那把锤子，重新，塞回了你的，手里。然后，重重地，拍了拍你的肩膀。"}, {"t": "p", "text": "\"拿着。\"他说。"}, {"t": "p", "text": "\"这把锤子，是我年轻的时候，亲手，给我自己，打的第一件家伙。用了，大半辈子了。\""}, {"t": "p", "text": "\"我一直，没舍得，传给谁。\""}, {"t": "p", "text": "他看着你，那张沧桑的脸上，是一种，温柔得，不像话的，认真。"}, {"t": "p", "text": "\"因为我，一直在等。等一个，值得，传的，人。\""}, {"t": "p", "text": "他转过身，走到那扇木门前，把门，为你，推得，大大地，开了。门外，是那片浩瀚的、还在缓缓流淌的，星海。"}, {"t": "p", "text": "\"以后啊，\"他朝你，挥了挥那只发红的手，笑得，满脸的沟壑，都挤在了一起，\"不用，敲门了。\""}, {"t": "p", "text": "\"这间工坊的钥匙，你，已经有了。\""}, {"t": "p", "text": "\"无论你，走到多远——回头，这扇门，都，为你，开着。\""}, {"t": "quote", "text": "🎁 【信物 · 一】创世匠人的陨铁锤\n它，已经认得，你掌心的力道了。\n从今往后，你上路，不再是，一个人了。"}, {"t": "p", "text": "你抱着那把，还带着炉火余温的锤子，走出了门。"}, {"t": "p", "text": "你回头看了一眼。那位老匠人，正站在门口，朝你挥手。他身后，整座工坊的星光，温暖，明亮。"}, {"t": "p", "text": "那是你在这片星海里，第一次，回头的时候，有人，在朝你，挥手。"}]}, "meet2": {"key": "meet2", "title": "第二章 · 圣光穹顶 —— 统御天使 · 圣光之翼", "boss": "统御天使·圣光之翼", "blocks": [{"t": "p", "text": "你带着锤子，继续往星海深处走。"}, {"t": "p", "text": "你发现，路，好走了一些。心里那个学会了\"冷静\"的角落，像一块压舱石，让你在面对漂浮、面对未知的时候，没有那么慌了。"}, {"t": "p", "text": "你一路，又碰懂了好些新的词。有些，是关于\"心情\"的——开心、难过、紧张、安心；有些，是关于一个人\"性格\"的——勇敢、善良、诚实、固执。你把它们，一个个，收进词典。你渐渐感觉到，自己心里那片，原本说不出话的混沌，正在被这些词，一点一点地，照亮、分清。你开始，能更准确地，知道自己，在感觉着什么了。"}, {"t": "p", "text": "走着走着，前方的星河，越来越亮。"}, {"t": "p", "text": "亮到，刺眼。"}, {"t": "hr"}, {"t": "p", "text": "光，越来越盛。"}, {"t": "p", "text": "先是远处，泛起一片，柔和的金色。然后，那金色，越来越浓，越来越烈，像潮水一样，向你涌来，直到你，不得不抬起手，挡在眼前。"}, {"t": "p", "text": "你眯着眼，深一脚浅一脚地，朝那片光的源头，走过去。"}, {"t": "p", "text": "当你，终于适应了那片光，慢慢放下手臂的时候——"}, {"t": "p", "text": "你看见了。"}, {"t": "p", "text": "一座，由纯粹的圣光，铸成的，穹顶。它悬浮在星海之上，宏伟得，像一整片，倒扣下来的天空。穹顶的边缘，铭刻着发光的、古老的文字，每一个字，都在自行散发着，庄严的光。"}, {"t": "p", "text": "而在那穹顶的，正中央——"}, {"t": "p", "text": "祂，在等你。"}, {"t": "p", "text": "六对，巨大的、洁白的羽翼，在你面前，依次，展开。"}, {"t": "p", "text": "那不是鸟的羽毛。那是由，纯粹的、神圣的意志，凝结成的，介于实体与圣光之间的，圣羽。每一根羽毛，都在自行发光，那光的边缘，不是尖锐的，而是温柔的——像，被拉长了的、晨祷的钟声，在空气里，留下了，久久不散的，暖意。当祂的双翼完全展开时，翼展，足以，覆盖一整座，大教堂的，穹顶。"}, {"t": "p", "text": "祂的头顶，悬着，三层，缓缓旋转的，金色光环。光环上，铭刻的古老文字，每一个字符，都像，一颗微小的恒星。"}, {"t": "p", "text": "祂的右手，握着，一柄，比祂身躯，还要长的，金色权杖。杖顶，嵌着一颗，拳头大的白水晶，水晶里，一枚十二芒星，在缓缓旋转，每转一圈，就向外，辐射出一圈，温暖的，金色光波。"}, {"t": "p", "text": "祂是，天使军团的，最高统帅。是，光明的意志，在人间行走的，终极，形态。"}, {"t": "p", "text": "整片星海的黑暗，都在祂的面前，噤声。"}, {"t": "p", "text": "而你，站在祂的脚下，渺小得，像一粒，尘埃。"}, {"t": "p", "text": "祂，没有，攻击你。"}, {"t": "p", "text": "祂只是，用那双，像两团被约束在眼眶里的、微型太阳一样的眼睛，静静地，俯视着你。"}, {"t": "p", "text": "可就在你，与祂对视的那一瞬间——"}, {"t": "p", "text": "一股，庞大得令人窒息的力量，压了下来。"}, {"t": "p", "text": "那不是恶意。那是——光，本身的，重量。"}, {"t": "p", "text": "你这才，明白过来：祂周身的圣光，并不只是，温暖的。它，也是，沉重的。沉重到，足以，把一个不够坚定的灵魂，直接，压垮。"}, {"t": "p", "text": "\"你的心里，有黑暗，\"祂，开口了。声音，庄严，而温和，像，清晨的，第一声，钟，\"每一个，能走到这里的存在，心里，都有黑暗。恐惧，软弱，自我怀疑……这些东西，在我的光下，无处，遁形。\""}, {"t": "p", "text": "祂将权杖，轻轻，一抬。"}, {"t": "p", "text": "一道，柱状的光，从天而降，笼罩住了你。"}, {"t": "p", "text": "那一刻，你心里，所有，悄悄藏起来的东西，都被，照得，清清楚楚——"}, {"t": "p", "text": "你看见了，你对前路的，害怕。你看见了，你对\"自己到底能不能走到终点\"的，怀疑。你看见了，你一个人，在这片陌生的星海里，那份，藏得很深的，不安。"}, {"t": "p", "text": "这些念头，被那道光，放大，照亮，悬在你的面前，像一面面，镜子。它们几乎，要把你，淹没。"}, {"t": "p", "text": "你感到，一阵，强烈的，想要逃开的，冲动。"}, {"t": "p", "text": "但是，你，没有逃。"}, {"t": "p", "text": "因为，你想起了。"}, {"t": "p", "text": "你想起了，创世之炉里，那位老匠人。在你，一次次失败的时候，他那双，依然，温和的，眼睛。你想起了，他塞回你手里的，那把锤子的，重量。"}, {"t": "p", "text": "你也想起了，在创世之炉里，你学会的那件事——先让自己，冷静下来。"}, {"t": "p", "text": "可此刻，光的重量，压着你。你需要的，是另一样东西。"}, {"t": "p", "text": "你忽然，懂了一件事："}, {"t": "p", "text": "勇敢，不是，没有害怕。"}, {"t": "p", "text": "勇敢，是，心里，明明，害怕着，却，依然，向前，走，一步。"}]}, "reco2": {"key": "reco2", "title": "第二章 · 圣光穹顶 —— 统御天使 · 圣光之翼", "boss": "统御天使·圣光之翼", "blocks": [{"t": "p", "text": "你，迎着那道，几乎要把你压垮的光，一步。"}, {"t": "p", "text": "又，一步。"}, {"t": "p", "text": "你没有，低头。你，抬起头，迎着那刺目的光，望进了，祂，那双，疲惫的，眼睛。"}, {"t": "p", "text": "然后，你，做了一件，亿万年来，从来，没有任何一个存在，对祂，做过的事。"}, {"t": "p", "text": "你，问祂——"}, {"t": "p", "text": "\"你……累，不累？\""}, {"t": "p", "text": "那三层，金色的光环，旋转的速度——"}, {"t": "p", "text": "第一次，停了下来。"}, {"t": "p", "text": "祂，怔怔地，看着你。"}, {"t": "p", "text": "在祂，统御光明的，漫长岁月里，所有的存在，见到祂，要么是，敬畏；要么是，臣服；要么是，跪在祂面前，祈求。"}, {"t": "p", "text": "从来，没有人——从来，没有，任何，一个，人——问过祂，这样，一句话。"}, {"t": "p", "text": "举着光的人，是，不能放下的。"}, {"t": "p", "text": "哪怕，祂的手臂，已经，举了，亿万年。哪怕，从来，没有人，来替祂，分担过，哪怕，一刻，的，重量。"}, {"t": "p", "text": "祂守护着，所有人的，光明。可祂自己，却站在，那光的，最中心，独自，承受着，那份，谁也，看不见的、灼烧般的，孤独。"}, {"t": "p", "text": "\"我已经……忘了，'累'，是什么，感觉了，\"祂，极轻，极轻地，说。那庄严的声音里，第一次，有了，一丝，细微的，裂痕，\"久到，我以为，我，生来，就是为了，举着它的。\""}, {"t": "p", "text": "祂，沉默了，很久，很久。"}, {"t": "p", "text": "然后，祂，缓缓地，将那柄，沉重的，权杖，向你，倾斜了，一寸。"}, {"t": "p", "text": "那，不是，要你，接过，这份，重担。"}, {"t": "p", "text": "那是——终于，有一个人，愿意，走到祂的，身边，和祂，并肩，站在一起。陪祂，一起，看着，这片，祂守护了，亿万年的，光。"}, {"t": "p", "text": "祂，以权杖，轻轻地，点了，你的，额头。"}, {"t": "p", "text": "一缕，温暖而坚定的，圣光，融进了，你的，身体，在你的，心口，点亮了，一盏，小小的、永远，不会，熄灭的，灯。"}, {"t": "p", "text": "\"带着，这盏灯，走吧，\"祂说。六对羽翼，缓缓，收拢，如，六层，圣洁的，披风，垂落，在祂的，身后，\"前方，你将，走进，一片，连我，都不敢，涉足的，黑暗。\""}, {"t": "p", "text": "\"但是，记住——\""}, {"t": "p", "text": "\"只要，你心里，这盏灯，还亮着，再深的，黑暗，也，吞，不掉，你。\""}, {"t": "quote", "text": "🎁 【信物 · 二】圣光之翼的祝福\n往后，纵然，踏入，最深的，深渊，你的，心里，也会，有一盏，永不熄灭的，灯。"}]}, "meet3": {"key": "meet3", "title": "第三章 · 无光之渊 —— 暗噬君主", "boss": "无光之渊·暗噬君主", "blocks": [{"t": "p", "text": "你的心口，揣着那盏灯，重新上路。"}, {"t": "p", "text": "你能感觉到它——一团小小的、温温的暖意，无论你走到哪里，它都在。它不亮，亮不过那座圣光穹顶，但它，是你的。"}, {"t": "p", "text": "你一路，又学了好些新词。这一回，是关于\"思考\"和\"表达\"的——明白、怀疑、解释、相信、同意、拒绝。你发现，学会了这些词以后，你不再只是\"感觉\"到什么，你开始，能\"想清楚\"什么，能把心里的东西，\"说出来\"了。"}, {"t": "p", "text": "而前方的路，越走，越暗。"}, {"t": "p", "text": "光，一点一点，被吞没。直到，四周，陷入了，一片，绝对的，黑暗。"}, {"t": "p", "text": "那座圣光穹顶，远远地，被你，落在了，身后。"}, {"t": "p", "text": "只剩下，你心口，那一盏，小小的，灯。"}, {"t": "hr"}, {"t": "p", "text": "天使说的黑暗，比你想象的，还要，深。"}, {"t": "p", "text": "你顺着星河，一路，向下。光，一寸一寸地，被吞掉。先是，星星不见了；然后，连星河的微光，也不见了；最后，你陷入了，一片，绝对的、伸手，不见五指的，黑暗。"}, {"t": "p", "text": "这黑暗，不是，空的。"}, {"t": "p", "text": "它，像一头，活物。在你的四周，缓缓地，翻涌，呼吸。厚重得，几乎，让你，喘不过气。它压在你的肩上，缠在你的脚上，像，一片，有重量的，海。"}, {"t": "p", "text": "若不是，你心口那盏，圣光的灯，还，亮着——哪怕，只是，照亮，你脚下，一小圈地方——你，早就，在这，无边的黑里，迷失了，方向。"}, {"t": "p", "text": "就在，这片黑暗的，正中央——"}, {"t": "p", "text": "祂，从深渊里，缓缓地，升了，起来。"}, {"t": "p", "text": "祂升起的时候，整片深渊，都在，震颤。"}, {"t": "p", "text": "祂的上半身，是人形的，但那，不是血肉，而是由，凝固的暗影，和深渊的结晶，交织而成的，某种，介于固态与液态之间的，物质。祂的皮肤，是深沉的，暗紫黑，在祂呼吸的时候，皮肤表面，会浮现出，无数道，极细的、暗紫色的光纹，从胸口，向四肢，蔓延，像，一张，刻在身体上的，古老的，魔网。"}, {"t": "p", "text": "祂的双眼，没有眼白，没有瞳孔。只有，两片，不断地，向外，逸散着，暗紫色光雾的，深洞。"}, {"t": "p", "text": "而在祂的，背后——"}, {"t": "p", "text": "翻涌着，一片，巨大的，暗影之幕。"}, {"t": "p", "text": "那幕里，浮现出，无数张，模糊的、没有五官的，面孔。每一张，都，朝着，祂。"}, {"t": "p", "text": "你的心，\"咯噔\"一下，揪紧了。"}, {"t": "p", "text": "那些面孔，开始，低语。"}, {"t": "p", "text": "那低语，不是从耳朵进来的，它们，直接，钻进你的，脑子里，让你，忍不住地，开始，想——"}, {"t": "p", "text": "*你是谁？* *你为什么，在这里？* *你来这里，又，有什么，意义？* *你，会不会，也，被丢在这里……？*"}, {"t": "p", "text": "黑暗，在试图，让你，忘记，你，自己。你感到，你的名字，你来的目的，你心里那些重要的东西，正在，一点一点地，变得，模糊。"}, {"t": "p", "text": "祂，用那双，逸散着暗紫光雾的，深洞，注视着你。然后，沉默地，提出了，一个问题。"}, {"t": "p", "text": "那问题，没有声音，却，直接，压在了，你的，心上："}, {"t": "p", "text": "*你，为什么，要来，这里？* *这里，没有光。没有，胜利。没有，荣耀。* *这里，只有，我。和那些，被我，收留的、被，全世界，抛弃了的，碎片。* *你——是来，把它们，也，夺走的，吗？*"}, {"t": "p", "text": "你，握紧了，手里，那把，陨铁锤。"}, {"t": "p", "text": "那一瞬间，恐惧，攫住了，你。"}, {"t": "p", "text": "那些低语，那片黑暗，那双悲哀的深洞……你害怕。你几乎，就要，举起锤子，冲上去——"}, {"t": "p", "text": "因为，在害怕的时候，\"攻击\"，似乎，是最，简单的，选择。"}, {"t": "p", "text": "你的手臂，举起来了一半——"}, {"t": "p", "text": "但是，你，停住了。"}, {"t": "p", "text": "你看着祂。你忽然意识到，从你进来，到现在，祂，从头到尾，没有，向你，出过，一次手。"}, {"t": "p", "text": "祂只是，挡在，你，和深渊，之间。用那双，盛满了悲哀的眼睛，看着你。"}, {"t": "p", "text": "你的目光，越过祂，落在了，祂背后，那片，翻涌的，暗幕上。落在了，那一张张，模糊的，面孔上。"}, {"t": "p", "text": "然后，你，懂了。"}, {"t": "p", "text": "那些面孔，不是，被祂，囚禁的，俘虏。"}, {"t": "p", "text": "它们，是被祂，收留的。"}, {"t": "p", "text": "你看着它们，心里，莫名地，浮现出，它们的，故事——这一张，曾是，一个见习天使，因为，\"不够完美\"，被逐出了，天堂；那一张，曾是，一个人类，祈祷了，一生，却，从来，没有，得到过，一句，回应；还有那一张，是，一个，在深渊边缘，徘徊了，太久、太久，最后，连，自己是谁，都，忘记了的，迷失的，灵魂。"}, {"t": "p", "text": "祂，把它们，收进暗幕，不让它们，彻底，消散。"}, {"t": "p", "text": "不是，因为，慈悲。"}, {"t": "p", "text": "而是，因为——祂，自己，也曾经，差一点，就，那样，消失了。"}, {"t": "p", "text": "在光明，诞生的时候，一切，不被需要的东西——被否定的念头，被压抑的愤怒，被隐藏的恐惧，被遗忘的罪恶——都被，从光明的领域里，剥离出来，扔进了，这片，深渊。"}, {"t": "p", "text": "祂，就是，所有那些，被丢掉的东西的，总和。"}, {"t": "p", "text": "祂，比谁，都，懂，\"被抛弃\"，是什么，滋味。所以，祂，无法，眼睁睁地，看着，另一个，被抛弃的存在，彻底，消失。"}, {"t": "p", "text": "你，慢慢地，松开了，握着锤子的，手。"}, {"t": "p", "text": "你，把那把锤子，轻轻地，放到了，一边。"}, {"t": "p", "text": "然后——"}, {"t": "p", "text": "在这位，深渊君主的，面前，你，安安静静地，坐了，下来。"}, {"t": "p", "text": "祂周身，那片，亿万年来，从未平息过的、翻涌的，暗影之幕——"}]}, "reco3": {"key": "reco3", "title": "第三章 · 无光之渊 —— 暗噬君主", "boss": "无光之渊·暗噬君主", "blocks": [{"t": "p", "text": "停滞了，一瞬。"}, {"t": "p", "text": "你，抬起头。"}, {"t": "p", "text": "你用，你这一路，学会的、越来越多的词——尤其是，你刚刚，在旅途上，学会的，那些，关于，\"思考\"和\"表达\"的词——缓慢地，清晰地，第一次，完整地，对祂，说出了，一句，你，真正，想对祂，说的，话："}, {"t": "p", "text": "\"你，不是，被遗弃的。\""}, {"t": "p", "text": "\"你——是，它们的，家。\""}, {"t": "p", "text": "死，一般的，寂静。"}, {"t": "p", "text": "然后——"}, {"t": "p", "text": "那片，亿万年来，从未停止过翻涌的，暗影之幕，第一次，缓缓地，安静了，下来。"}, {"t": "p", "text": "它，不再，张牙舞爪。它，凝聚，收拢，变成了，一层，像，旧披风一样的、温柔的，暗色，安静地，垂落，在祂的，身后。"}, {"t": "p", "text": "祂胸口，那道，永远，不会愈合的，裂缝里，那片，旋转的，暗紫色，漩涡，也，慢了，下来。"}, {"t": "p", "text": "祂，用那只，枯瘦的、布满了划痕的，右手，伸进，自己的，胸口。"}, {"t": "p", "text": "从那道，永不愈合的，裂缝里——"}, {"t": "p", "text": "取出了，一小块，暗紫色的，晶体，碎片。"}, {"t": "p", "text": "那是，亿万年来，祂，第一次，从，自己的，身上，取下，一部分。"}, {"t": "p", "text": "愿意——分给，别人。"}, {"t": "p", "text": "\"你……不是，来攻击的，\"祂，开口了。那声音，是从胸口的裂缝里，震出来的，没有声带，没有口腔——只有，那漩涡里的，暗影，在震动，\"你，是来……寻找，什么的，吧。\""}, {"t": "p", "text": "祂，把那块，还带着祂体温的，晶体，放进了，你的，掌心。"}, {"t": "p", "text": "它，一接触到你，就，发出了，一道，极细微的、如同，心跳一般的，脉动——和你的，呼吸，同步了，起来。"}, {"t": "p", "text": "你，站起身，准备，继续，上路。"}, {"t": "p", "text": "在你，转身，要离开的时候——"}, {"t": "p", "text": "祂，在你的，身后，用，极轻、几乎，听不见的，声音，说了，最后，一句话。"}, {"t": "p", "text": "那不是命令。不是请求。不是，任何，需要你，去执行的，话。"}, {"t": "p", "text": "那只是，一个，在最孤独的角落里，独自，守护了，亿万年的存在，对一个，愿意，在祂面前，放下武器的人，说的——"}, {"t": "p", "text": "\"如果，有一天，你，在外面，也，被拒绝了……\""}, {"t": "p", "text": "\"记住——\""}, {"t": "p", "text": "\"这里，永远，有，你的，一个，位置。\""}, {"t": "p", "text": "\"我，没有，光。\""}, {"t": "p", "text": "\"但，我有，黑暗。\""}, {"t": "p", "text": "\"而，黑暗，有时候……比光，更，安静。也，更，温柔。\""}, {"t": "quote", "text": "🎁 【信物 · 三】暗渊之心的晶片\n它，随着，你的，呼吸，轻轻，搏动。\n提醒你：那些，曾被，世界，拒绝过的人，从来，都，不孤单。"}]}, "meet4": {"key": "meet4", "title": "第四章 · 永恒钟楼 —— 时之君主 · 克罗诺斯之影", "boss": "时之君主·克罗诺斯之影", "blocks": [{"t": "p", "text": "你，带着那块，会随呼吸搏动的晶片，从深渊里，走了，出来。"}, {"t": "p", "text": "重新，看见，星光的那一刻，你，长长地，舒了一口气。心口的灯，还亮着；怀里的晶片，在轻轻地，跳。你忽然明白了天使那句话的意思——你带着光，走进了最深的黑暗，可黑暗，没有，吞掉你。"}, {"t": "p", "text": "你一路，又收集了，新的词。这一回，是关于，\"数量\"和\"程度\"的——很多、一些、几乎、足够、超过；还有，一些，把句子，连起来的，小词——因为、所以、但是、而且、虽然。学会了它们，你发现，你看世界的眼睛，变得，更\"细\"了。以前，你只能看见，\"很多星\"；现在，你能看见，\"几乎所有的星，都在，慢慢变暗，但是，还有，一些，亮着\"。"}, {"t": "p", "text": "而前方，星河，被，一团，永恒的，迷雾，笼罩着。"}, {"t": "p", "text": "雾里，隐隐约约，传来，无数，时钟，滴答，滴答的，声音。"}, {"t": "hr"}, {"t": "p", "text": "你，走进了，那团，永恒的，迷雾。"}, {"t": "p", "text": "雾，很浓，浓到，你看不清，三步以外的东西。但，那滴答声，越来越近，越来越清晰——不是，一个钟，是，很多很多个钟，每一个，都在，用，不一样的，节奏，走着。"}, {"t": "p", "text": "雾，渐渐，散开。"}, {"t": "p", "text": "一座，高耸入云的，钟楼，出现在了，你的，面前。"}, {"t": "p", "text": "它，没有门，没有窗。只有，一座，直插云霄的，尖塔。"}, {"t": "p", "text": "而在，塔下——"}, {"t": "p", "text": "十二面，大小不一、形态各异的，时钟，正绕着，一个，兜帽的，身影，无声地，旋转。"}, {"t": "p", "text": "每一面钟的，指针，都，以，完全不同的，速度，奔流——有的，顺时针，狂奔；有的，逆时针，倒流；有的，死死地，停在，某一个，刻骨铭心的，时刻，再，不肯，走，一步。"}, {"t": "p", "text": "那个，兜帽的，身影，没有，脸。"}, {"t": "p", "text": "兜帽的，阴影，深处，是，一片，不断，变幻的，星图。"}, {"t": "p", "text": "祂的，右手，握着，一柄，修长的，镰刀。那刀刃，不是金属，而是，由，纯粹的，金色时之沙，凝结成的，半透明的，晶体。沙粒，从刀刃上，不断地，脱落、下坠，却，又在，半空中，倒流，回到，刀刃，里去。"}, {"t": "p", "text": "祂，缓缓地，抬起了，那片，星图般的，脸，\"看\"向，你。"}, {"t": "p", "text": "然后，一个，不像声音的声音，直接，出现在了，你的，记忆里："}, {"t": "p", "text": "\"你的，时间线，在，三千年前，就，该，结束了。\""}, {"t": "p", "text": "\"我来，只是，为了，让，钟声，准时，敲响。\""}, {"t": "p", "text": "话音，未落——"}, {"t": "p", "text": "祂手中的，镰刀，已经，划下！"}, {"t": "p", "text": "你，想躲。"}, {"t": "p", "text": "可是，你，发现，你，根本，躲，不开。"}, {"t": "p", "text": "祂的镰刀，总是，提前，出现在，你，最，不可能，闪避的，位置。不是，因为，祂，比你，快——而是，因为，祂，已经，在，你，出手，之前，就，看到了，你，出手，之后的，结果。"}, {"t": "p", "text": "镰刃，从你身边，掠过，在你的，手臂上，划开，一道，极浅的、几乎，不流血的，伤口。"}, {"t": "p", "text": "但是，那伤口上，残留的，时之沙，开始，倒流——"}, {"t": "p", "text": "你的身体，被，强行，拉回到了，几秒钟，之前。"}, {"t": "p", "text": "你，回到了，刚才，站立的，位置。回到了，刚才，做出的，动作。回到了，刚才，那一瞬间，露出的，破绽。"}, {"t": "p", "text": "而祂——已经，在那个破绽处，等着，你了。"}, {"t": "p", "text": "你，又，出手。又，被，拉回。"}, {"t": "p", "text": "你，再，出手。又，被，拉回，到，那，同一个，最，脆弱的，瞬间。"}, {"t": "p", "text": "你，被，困住了。"}, {"t": "p", "text": "困在了，短短，几秒钟的，循环里。像，一只，一次次，撞在玻璃上、却，怎么，也，飞不出去的，飞虫。"}, {"t": "p", "text": "你越，挣扎，那循环，就，收得，越，紧。"}, {"t": "p", "text": "一种，深深的，无力感，淹没了，你——"}, {"t": "p", "text": "你，打不过，时间。"}, {"t": "p", "text": "没有人，打得过，时间。"}, {"t": "p", "text": "你，挥出的，每一剑，每一拳，都，被，提前，看穿，被，拉回，原点。你，开始，怀疑，你，到底，还，能不能，走，出，这座，钟楼。"}, {"t": "p", "text": "就在你，快要，绝望的，时候——"}, {"t": "p", "text": "你，停了，下来。"}, {"t": "p", "text": "你，不再，挣扎。不再，试图，去，躲避，那柄，镰刀。"}, {"t": "p", "text": "你想起了——天使，教你的：有时候，向前冲，不是，答案。你想起了——深渊君主，教你的：有时候，放下，武器，安静地，坐下来，去，\"看\"，才是，答案。"}, {"t": "p", "text": "于是，你，只是，静静地，观察，祂。"}, {"t": "p", "text": "你，调动起，你这一路，学会的，所有的词——尤其是，你刚刚，学会的，那些，关于，\"数量\"和，\"细微差别\"的，词。它们，让你的，眼睛，变得，前所未有的，敏锐。你，开始，注意到，那些，以前，会被你，匆匆忽略掉的，细节。"}, {"t": "p", "text": "你，看着，祂背后，那十二面，旋转的，时钟。"}, {"t": "p", "text": "你，看着，那一颗颗，向上，飞升的，金色，沙粒。"}, {"t": "p", "text": "然后——"}, {"t": "p", "text": "你，看见了。"}, {"t": "p", "text": "在，祂背后，那面，最大的、记载着，无数，灭绝文明符号的，象牙白的，大钟里——"}, {"t": "p", "text": "在，所有，向上，飞升的，金色沙粒，之中——"}, {"t": "p", "text": "有，一颗。"}, {"t": "p", "text": "唯一的，一颗，逆向，坠落的，黑色，沙粒。"}, {"t": "p", "text": "它，在，那一片，金沙里，显得，那样，刺眼，那样，格格不入。"}, {"t": "p", "text": "你，盯着，那颗，黑沙。"}, {"t": "p", "text": "忽然之间——"}, {"t": "p", "text": "你，懂了。"}, {"t": "p", "text": "那颗黑沙，是，祂，亿万年里，唯一，一次，\"错剪\"的，时间线。"}, {"t": "p", "text": "那条，时间线上，住着，一个，渺小的、从未，犯过，任何错误的，文明。只因为，被，更高层级的存在，判定为，\"不符合，宇宙，演化的，方向\"，就，该，被，抹除。"}, {"t": "p", "text": "而祂——在，接到，那道，收割指令的，时候——"}, {"t": "p", "text": "第一次，违抗了，命令。"}, {"t": "p", "text": "祂，没有，毁掉，那条，时间线。"}, {"t": "p", "text": "祂，把它，偷偷地，藏进了，那面大钟的，沙漏里，藏进了，星图，最深、最深的，角落，藏在了，所有，其他的星星，都，找不到的，地方。"}, {"t": "p", "text": "祂，是，规则，最，铁面无私的，执行者。"}, {"t": "p", "text": "可祂，却，为了，一份，不该有的，温柔，保留了，自己，唯一的，一个，\"错误\"。"}, {"t": "p", "text": "并且，为此，惩罚了，自己——整整，亿万年。"}, {"t": "p", "text": "你，看着，祂。"}]}, "reco4": {"key": "reco4", "title": "第四章 · 永恒钟楼 —— 时之君主 · 克罗诺斯之影", "boss": "时之君主·克罗诺斯之影", "blocks": [{"t": "p", "text": "你，用你，学会的词，轻轻地，慢慢地，说出了，那份，温柔的，名字。"}, {"t": "p", "text": "你，告诉，祂——"}, {"t": "p", "text": "\"那，不是，错误。\""}, {"t": "p", "text": "\"那是……整个，宇宙里，最，珍贵的，一点，善良。\""}, {"t": "p", "text": "十二面，时钟——"}, {"t": "p", "text": "在，同一个，瞬间——"}, {"t": "p", "text": "全部，停止了，转动。"}, {"t": "p", "text": "兜帽，阴影，深处，那片，星图的，最，核心——"}, {"t": "p", "text": "一颗，细小的、明亮的，蓝色，恒星，骤然，亮起。"}, {"t": "p", "text": "那，正是，祂，偷偷，放过的，那条，时间线——最后的，光芒。"}, {"t": "p", "text": "祂，沉默了，很久。"}, {"t": "p", "text": "然后，祂，用，自己的，意志，将那颗，蓝色的，恒星，从，星图中，剥离，出来，托，在，掌心，缓缓地，向，你的，方向，轻轻，送出。"}, {"t": "p", "text": "\"去，找到它，\"这，是祂，第一次，用，近乎，温柔的，语气，对你，说话，\"去，保护，那个，文明。\""}, {"t": "p", "text": "\"去，做……我，没能，亲手，做完的，事。\""}, {"t": "p", "text": "在你，伸手，接过，那颗，蓝星的，时候——"}, {"t": "p", "text": "你，瞥见了，祂，那柄，镰刀的，镰柄。"}, {"t": "p", "text": "那，是用，一截，时间的，化石，削成的。最，内层的，年轮上，刻着，一行，字。"}, {"t": "p", "text": "那，不是，收割的，指令。不是，时间的，法则。不是，任何，神谕。"}, {"t": "p", "text": "那，是祂，还是，一个，普通，凡人的，时候，为，自己，写下的，墓志铭："}, {"t": "quote", "text": "*\"我，曾以为，时间，是，永恒的，刑罚。*\n*　现在，我，才，明白——*\n*　时间，只是，永恒的，一次，呼吸。\"*"}, {"t": "quote", "text": "🎁 【信物 · 四】被守护的蓝色恒星\n一个，本该，消失、却，因为，一份，温柔，而，活了下来的，小小的，文明。\n它，提醒你：有时候，违背，规则的，善良，比，规则，本身，更，重要。"}]}, "meet5": {"key": "meet5", "title": "第五章 · 宇宙之边 —— 终末观测者 · 边界守夜人", "boss": "终末观测者·边界守夜人", "blocks": [{"t": "p", "text": "你，捧着，那颗，温暖的，蓝星，走出了，钟楼。"}, {"t": "p", "text": "那颗蓝星，在你怀里，一闪，一闪。你能感觉到，里面，住着，一整个，鲜活的、还，不知道，自己，曾经，差点，消失的，小小文明。你把它，小心地，揣好。"}, {"t": "p", "text": "你，走过了，星海里，最后，也是，最长的，一段路。"}, {"t": "p", "text": "这一路，已经，很少，再有，新的星，飘过来了。星海，比你，刚来的时候，暗了，太多。你一路，又收集了，最后的，一批词——它们，更难，更深了：关于，\"学习\"和，\"知识\"的，关于，\"社会\"和，\"世界\"的。你发现，你，已经，不再是，那个，连，一句完整的话，都，说不出来的，孩子了。你，能，读懂，复杂的，意思，能，说出，完整的，想法。"}, {"t": "p", "text": "而你，也，终于，走到了——"}, {"t": "p", "text": "星海的，最，边缘。"}, {"t": "p", "text": "再，往前，一步。"}, {"t": "p", "text": "就是，宇宙，之外了。"}, {"t": "hr"}, {"t": "p", "text": "你，走到了，宇宙的，最，边缘。"}, {"t": "p", "text": "一个，连，光，都要，走上，百亿年，才能，抵达的，地方。"}, {"t": "p", "text": "这里，没有，星河了。只有，你身后，那一片，浩瀚的、正在，慢慢，黯淡下去的，星海；和，你身前，那一片，什么都，没有的、绝对的，虚无。"}, {"t": "p", "text": "而，在，这，虚无，与，星海的，交界线上——"}, {"t": "p", "text": "站着，一位，老兵。"}, {"t": "p", "text": "祂，穿着，一套，早已，风化成了，碎片的，深灰色，军大衣。大衣上，布满了，烧灼，和，修补的，痕迹。左边的袖子，从肘部，以下，完全，碎裂了，露出，里面，早已，和金属支架，融为一体的，前臂。"}, {"t": "p", "text": "祂的，肩膀，和，后背，嵌满了，各种各样的，观测，设备——有的，像天线，有的，像雷达盘，有的，是，你，从未，见过的，仪器。它们，不再是，外接的，设备，而是，直接，从，祂的，骨骼，和，皮肤里，生长，出来，导线，和，血管，交织，在一起，金属，和，血肉，模糊了，彼此的，边界。"}, {"t": "p", "text": "祂的，胸口，正中央，嵌着，一颗，仍在，运转的、暗红色的，能量，核心。核心，表面，布满了，细密的，裂纹，每一道，裂纹，都在，向外，泄出，极，细微的，暗红，光芒。"}, {"t": "p", "text": "祂的，右眼，已经，不在，眼眶里了。取而代之的，是，一只，被，直接，植入，眼窝的、伸缩式的，望远镜，筒。"}, {"t": "p", "text": "而，祂的，左眼——是，祂，全身，唯一，还，保留着，人类，特征的，部分。眼眶，深陷，眼白，布满，血丝，虹膜，是，褪了色的，灰蓝，像，被，暴晒，过度的，一面，军旗。"}, {"t": "p", "text": "祂，被，某个，早已，消亡的，文明，派驻，在，这里。"}, {"t": "p", "text": "祂的，任务，亿万年来，只有，一个："}, {"t": "p", "text": "站，在，宇宙的，最，边缘。观测，一切。记录，一切。但——绝不，干涉。"}, {"t": "p", "text": "无论，星系，碰撞，文明，灭绝，还是，恒星，在，祂的，眼前，坍缩，成，黑洞——祂，都，只是，沉默地，记录。从，不，出手。"}, {"t": "p", "text": "祂，已经，在，这里，站了，太久。"}, {"t": "p", "text": "久到，祂的，制服，化成了，碎片。久到，祂的，设备，长进了，祂的，血肉。久到，祂，记不起，自己，上一次，眨眼，是，什么，时候。"}, {"t": "p", "text": "此刻，祂，正，用，那只，望远镜，筒，注视着，远方，一颗，垂死的，红巨星。"}, {"t": "p", "text": "听见，你的，脚步声——"}, {"t": "p", "text": "祂的，动作，停住了。"}, {"t": "p", "text": "不是，因为，你，强大。不是，因为，你，特殊。"}, {"t": "p", "text": "而是，因为——你，走到了，这里。"}, {"t": "p", "text": "走到了，连，光，都要，走，百亿年，才能，抵达的，宇宙的，尽头。"}, {"t": "p", "text": "你，是，亿万年来，第一个。"}, {"t": "p", "text": "也是，唯一，一个。"}, {"t": "p", "text": "祂，缓缓地，转过身。"}, {"t": "p", "text": "破旧的，军大衣，在，虚空中，无声地，飘动。祂那张脸，被，各种设备，遮住了，大半，只，露出，那只，疲惫而，沧桑的，灰蓝色的，左眼。"}, {"t": "p", "text": "那只眼睛，注视着你，沉默了，许久。"}, {"t": "p", "text": "然后，祂，用，一种，沙哑到，几乎，失声的，嗓音，对你，说："}, {"t": "p", "text": "\"你，不该，在，这里。\""}, {"t": "p", "text": "祂，顿了顿。"}, {"t": "p", "text": "仿佛，在，犹豫，下面的，那句话，到底，该不该，说。"}, {"t": "p", "text": "在，祂，漫长的，守夜，生涯里，祂，从未，对，任何，一个，观测对象，说过，一句，职责，之外的，话。"}, {"t": "p", "text": "但是，今天——"}, {"t": "p", "text": "祂，破例了。"}, {"t": "p", "text": "\"……但，既然，来了，\"祂，缓缓地，说，\"坐吧。\""}, {"t": "p", "text": "\"陪，我。\""}, {"t": "p", "text": "\"看，最后，一次，日出。\""}, {"t": "p", "text": "你，在，祂的，身边，坐了，下来。"}, {"t": "p", "text": "你们，一起，看，那颗，遥远的，红巨星，在，亿万年的，尽头，缓缓地、壮丽地，走向，自己的，终结。"}, {"t": "p", "text": "那，不是，行星上的，日出。那，是，恒星的，日出。是，整个，宇宙，在，膨胀中，每一次，边界，被，推远时的——\"日出\"。"}, {"t": "p", "text": "祂，一边，看，一边，喃喃，自语。"}, {"t": "p", "text": "那，不是，对你，说的。那，是，祂，亿万年来，养成的，工作，习惯——每日，例行的，观测，报告。"}, {"t": "p", "text": "祂，报告，这颗，红巨星，今天的，状态。报告，那条，遥远星系的，运行，轨迹。报告，某个，文明的，兴衰，周期。"}, {"t": "p", "text": "每，一句话，都，那样，认真。那样，一丝，不苟。"}, {"t": "p", "text": "你，静静地，听着。"}, {"t": "p", "text": "听着，听着——"}, {"t": "p", "text": "你，忽然，发现了，一件事。"}, {"t": "p", "text": "一件，让你，心头，猛地，一颤的，事。"}, {"t": "p", "text": "祂，报告过，银河系的，每一条，旋臂。祂，报告过，仙女座，与，银河的，未来，碰撞。祂，报告过，数万个，文明的，起始，与，终结。"}, {"t": "p", "text": "可是——在，祂，亿万年的，报告里，从来，从来，没有，出现过——"}, {"t": "p", "text": "哪怕，一个，关于，祂，自己的，句子。"}, {"t": "p", "text": "祂，是，记录者，却，从未，被，记录。"}, {"t": "p", "text": "祂，是，观测者，却，从未，被，观测。"}, {"t": "p", "text": "祂，在，这，宇宙的，边缘，看了，亿万年的，星辰、文明、恒星，把，它们，一一，写进，日志。却，从，不曾，把，自己，也，写，进去。"}, {"t": "p", "text": "因为，祂，从，不认为，自己，也，属于，这个，宇宙。"}, {"t": "p", "text": "你，慢慢地，站起身。"}, {"t": "p", "text": "你，走到，祂的，面前。"}, {"t": "p", "text": "你，伸出手，翻开了，祂，左手里，那本，厚重的、封皮，已经，磨得，看不出，原来颜色的，皮质，日志。"}, {"t": "p", "text": "你，一页，一页地，翻。"}, {"t": "p", "text": "翻过，那些，密密麻麻的、记录着，亿万年，宇宙，历史的，符号。"}, {"t": "p", "text": "一直，翻到——"}, {"t": "p", "text": "最后，一页，空白。"}, {"t": "p", "text": "然后——"}, {"t": "p", "text": "你，用，你，这一整段，旅程，学会的，那些，星辰的，文字。"}, {"t": "p", "text": "一笔，一画，郑重地，在，那，最后一页，空白上——"}]}, "reco5": {"key": "reco5", "title": "第五章 · 宇宙之边 —— 终末观测者 · 边界守夜人", "boss": "终末观测者·边界守夜人", "blocks": [{"t": "p", "text": "写下了——"}, {"t": "p", "text": "祂的，名字。"}, {"t": "p", "text": "祂，那只，疲惫的，左眼——"}, {"t": "p", "text": "骤然，睁，大了。"}, {"t": "p", "text": "祂，以，一种，你，从未，在，任何人，脸上，见过的，表情，注视着，那页纸，注视着，你。"}, {"t": "p", "text": "那个，表情，不是，被，击败的，屈辱。不是，被，拯救的，感恩。"}, {"t": "p", "text": "那是，更，简单、更，根本的——"}, {"t": "p", "text": "被，看见。"}, {"t": "p", "text": "亿万年来，这，是，祂，第一次，被，写进，一份，记录。"}, {"t": "p", "text": "第一次，祂的，名字，和，那些，星系、文明、恒星，并列，在了，同一张，纸上。"}, {"t": "p", "text": "第一次，有，一个，存在，告诉，祂："}, {"t": "p", "text": "你，也是，这个，宇宙的，一部分。你，值得，被，记录。值得，被，记住。值得，在，亿万年的，守夜，之后，被，一个，愿意，走到，宇宙边缘，来，找你的人——"}, {"t": "p", "text": "写进，历史。"}, {"t": "p", "text": "祂，沉默了，很久，很久。"}, {"t": "p", "text": "然后——"}, {"t": "p", "text": "祂，从，你的，手里，接过了，那支，笔。"}, {"t": "p", "text": "你，用来，写，祂名字的，那支，笔。"}, {"t": "p", "text": "祂，在，纸上，你，写下的，祂的，名字，旁边，一笔，一画地，也，写下了——"}, {"t": "p", "text": "你的，名字。"}, {"t": "p", "text": "然后，祂，把，日志，合上，递给了，你。"}, {"t": "p", "text": "\"拿着，\"祂说。声音，沙哑，却，前所未有的，轻松，\"这个，本子，我，用完了。\""}, {"t": "p", "text": "\"剩下的，空白页，你，接着，写。\""}, {"t": "p", "text": "\"你的，世界。你，自己。你，之后，会，遇见的，所有的人。\""}, {"t": "p", "text": "\"都，记下来。\""}, {"t": "p", "text": "\"不要……\""}, {"t": "p", "text": "祂，停顿了，一下。"}, {"t": "p", "text": "\"不要，像，我，一样。等了，一辈子，才，等到，一个，会，帮，我，写，名字的，人。\""}, {"t": "p", "text": "祂，从，怀里，掏出，那顶，早已，褪成了，灰白色的、破损的，军帽。"}, {"t": "p", "text": "郑重地，戴，正。"}, {"t": "p", "text": "然后，祂，向，你——"}, {"t": "p", "text": "敬了，最后，一个，标准，而，缓慢的，军礼。"}, {"t": "p", "text": "祂，转过身。"}, {"t": "p", "text": "自己，走，入了，宇宙，之外。"}, {"t": "p", "text": "这一次，祂，不再是，亿万年来，那样，被，困在，岗位上，动弹，不得。"}, {"t": "p", "text": "这一次——"}, {"t": "p", "text": "祂，带着，一个，被，记录过的，名字。一个，被，写进了，历史的，存在。一个，终于，可以，下班的，老兵的，自豪——"}, {"t": "p", "text": "走，了，进去。"}, {"t": "p", "text": "虚空，缓缓，愈合。"}, {"t": "p", "text": "你，独自，一人，站，在，宇宙的，边界上，怀里，抱着，那本，沉甸甸的，日志。"}, {"t": "p", "text": "封面上，被，祂，用，沙哑的，手指，划下了，一行，字："}, {"t": "quote", "text": "*\"观测者：你。*\n*　工号：∞。*\n*　状态：在岗。\"*"}, {"t": "quote", "text": "🎁 【信物 · 五】观测者的日志\n从，今往后——\n记录，这片，星海的，是，你，了。"}]}, "meet6": {"key": "meet6", "title": "星海之心 · 星海女帝 · 赛尔娅", "boss": "星海女帝·赛尔娅", "blocks": [{"t": "p", "text": "你，抱着，那本，沉甸甸的，日志，转过身。"}, {"t": "p", "text": "你，望向，你，一路，走来的，方向。"}, {"t": "p", "text": "整片星海，铺，在，你的，眼前。它，暗了，很多。可是，你，怀里，揣着，五件，东西：创世匠人的，陨铁锤；圣光之翼的，祝福；暗渊之心的，晶片；被守护的，蓝色，恒星；和，观测者的，日志。"}, {"t": "p", "text": "你，低头，看了看，你的，那本，词典。"}, {"t": "p", "text": "它，已经，不再，空白了。"}, {"t": "p", "text": "它，写满了。一个，一个，又，一个的，词。从，最简单的，\"冷静\"\"勇敢\"，到，最后，那些，又长、又难的，词。"}, {"t": "p", "text": "你，忽然，明白了，一件，一直，没有想通的事："}, {"t": "p", "text": "你，这一路，学会的——"}, {"t": "p", "text": "从来，就，不只是，词。"}, {"t": "p", "text": "你，朝着，星海的，最，深处，最初，那道光，落下来的，方向——"}, {"t": "p", "text": "走，了，回去。"}, {"t": "hr"}, {"t": "p", "text": "你回到了，星海最深的地方。"}, {"t": "p", "text": "七颗星核，绕着她，缓缓旋转，像七个宇宙的心跳。她转过身，看着你，看了很久。"}, {"t": "p", "text": "\"我见证过亿万星辰亮起，\"她轻声说，\"也送走过它们熄灭。可这亿万年里，我和它们一样——一直在等一个人。\""}, {"t": "p", "text": "\"等一个，听得懂我的人。\""}]}, "reco6": {"key": "reco6", "title": "星海之心 · 星海女帝 · 赛尔娅", "boss": "星海女帝·赛尔娅", "blocks": [{"t": "p", "text": "她的目光，落在你怀里——那把锤，那道光，那块晶，那颗蓝星，那本日志。"}, {"t": "p", "text": "\"它们不是战利品。\"她说。"}, {"t": "p", "text": "\"是你，来过的，证明。\""}, {"t": "p", "text": "她抬起手，指向身后。"}, {"t": "p", "text": "你回头——"}, {"t": "p", "text": "那片你一路走来、正在一颗颗熄灭的星海，亮了起来。"}, {"t": "p", "text": "一颗。又一颗。越来越多。"}, {"t": "p", "text": "像一场，迟到了亿万年的，黎明。"}, {"t": "p", "text": "\"星海不是老死的，\"她说，\"是太久，没人听它说话了。\""}, {"t": "p", "text": "\"你来了。它就亮了。\""}, {"t": "p", "text": "她向你伸出手。掌心里，一点星光，缓缓凝起，化成一枚小小的、温润的星辰——里面流转着你一路走来，所有的光：创世的炉火，圣光的穹顶，无光之渊的静，那颗被守护的蓝星，和宇宙边上，那最后一次日出。"}, {"t": "p", "text": "\"我在亿万光年外，看见你眼里有光，\"她把那枚星辰，轻轻放进你的掌心，\"现在我知道，我没看错。\""}, {"t": "p", "text": "\"带着它。\""}, {"t": "p", "text": "\"无论你走多远——星海，都会记得你。\""}, {"t": "p", "text": "宇宙，浩瀚，而寂静。"}, {"t": "p", "text": "但从今往后，它，不再沉默了。"}, {"t": "p", "text": "因为它，终于有了，你的声音——"}, {"t": "p", "text": "作为，回响。"}, {"t": "p", "text": "——《星海的回响》· 全文完——"}]}});

  window.hansenStoryReader = function(key, opts){
      opts = opts || {};
    try{
      var data;
      if(Array.isArray(key)){
        var _parts=[], _ttl='';
        for(var _ki=0;_ki<key.length;_ki++){ var _d=window.HANSEN_STORY&&window.HANSEN_STORY[key[_ki]]; if(_d){ if(!_ttl)_ttl=_d.title; _parts=_parts.concat(_d.blocks); } }
        data={title:_ttl, blocks:_parts};
      } else {
        data = (window.HANSEN_STORY && window.HANSEN_STORY[key]);
      }
      if(!data) return;
      if(document.getElementById('hsnStoryModal')) return;
      var esc = function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
      var ov = document.createElement('div');
      ov.id = 'hsnStoryModal';
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:radial-gradient(ellipse at 50% 18%,#1a1340 0%,#0d0a22 55%,#070512 100%);display:flex;flex-direction:column;opacity:0;transition:opacity .3s ease;font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';
      var stars='';
      for(var i=0;i<26;i++){ var x=(i*37+13)%100, y=(i*53+7)%100, s=(i%3)+1; stars+='<div style="position:absolute;left:'+x+'%;top:'+y+'%;width:'+s+'px;height:'+s+'px;border-radius:50%;background:rgba(255,255,255,'+(0.22+(i%4)*0.12).toFixed(2)+')"></div>'; }
      var blocksHtml='';
      for(var b=0;b<data.blocks.length;b++){
        var blk=data.blocks[b];
        if(blk.t==='hr'){ blocksHtml+='<div style="margin:22px auto;width:55%;height:1px;background:linear-gradient(90deg,transparent,rgba(167,139,250,.45),transparent)"></div>'; continue; }
        var t=esc(blk.text).replace(/\n/g,'<br>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
        if(blk.t==='quote'){
          blocksHtml+='<div style="margin:18px 4px;padding:14px 16px;border-left:3px solid #fbbf24;background:rgba(124,58,237,.16);border-radius:0 10px 10px 0;color:#fde68a;font-size:15.5px;line-height:2;font-style:italic">'+t+'</div>';
        } else {
          blocksHtml+='<p style="margin:14px 2px;color:#e8e3f5;font-size:15.5px;line-height:2;text-align:justify">'+t+'</p>';
        }
      }
      ov.innerHTML =
        '<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">'+stars+'</div>'+
        '<div style="position:relative;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:max(30px,env(safe-area-inset-top)) 18px 12px">'+
          '<div style="max-width:640px;margin:0 auto">'+
            '<div style="text-align:center;color:#c4b5fd;font-size:12.5px;letter-spacing:4px;margin-bottom:6px">星 海 的 回 响</div>'+
            '<h2 style="text-align:center;color:#f3e8ff;font-size:20px;font-weight:800;line-height:1.5;margin:0 0 22px;padding-bottom:16px;border-bottom:1px solid rgba(167,139,250,.3)">'+esc(data.title)+'</h2>'+
            blocksHtml+
            '<div style="height:8px"></div>'+
          '</div>'+
        '</div>'+
        '<div style="position:relative;padding:12px 18px max(16px,env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(13,10,34,0),#0d0a22 35%)">'+
          '<button id="hsnStoryClose" style="display:block;width:100%;max-width:640px;margin:0 auto;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-family:system-ui,-apple-system,&quot;Segoe UI&quot;,&quot;Microsoft YaHei&quot;,sans-serif!important;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(124,58,237,.5)">'+esc(opts.btnLabel||'迈出第一步 →')+'</button>'+
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function(){ ov.style.opacity='1'; });
      var close=function(){ var _cb=opts.onClose; try{ ov.style.opacity='0'; setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); if(typeof _cb==='function'){ try{_cb();}catch(e){} } },300); }catch(e){ if(ov.parentNode) ov.parentNode.removeChild(ov); if(typeof _cb==='function'){ try{_cb();}catch(e){} } } };
      var btn=document.getElementById('hsnStoryClose'); if(btn) btn.onclick=close;
    }catch(e){ try{ var m=document.getElementById('hsnStoryModal'); if(m&&m.parentNode) m.parentNode.removeChild(m); }catch(_e){} }
  };

  //🔴v820 赛季「已打通该 boss / 已得信物 N」统一判断(信物栏+星海纪事+赛尔娅解锁共用):
  //  认 ①管理员临时全解锁/一键通关(与神秘殿堂 tempUnlockAll 同款标记) ②已得信物 hsn_season_gift_N(v817起打通即设)
  //  ③已收该卡 hasCard(S1B(N)/S1) ④赛季岛上老存档打通记录 S.bossWon(覆盖剧情系统上线前就打通的 boss)
  window.__hsnSeasonGot = function(n){
    try{
      if(parseInt(localStorage.getItem('hansen_card_temp_unlock_until')||'0',10) > Date.now()) return true;
      if(localStorage.getItem('hansen_admin_clearall_on')==='1') return true;
      if(localStorage.getItem('hsn_season_gift_'+n)) return true;
      //🔴v874: 星域已废·纪事1-5章随单词大陆进度解锁(通关2/4/5/7/8岛)·第6章=8岛全通
      var _lcg=0; for(var _gi=1;_gi<=8;_gi++){ try{ if(localStorage.getItem('hsn_landmap_cleared_'+_gi)==='1') _lcg++; }catch(_ge){} }
      var _need=(n>=6)?8:([2,4,5,7,8][n-1]||8);
      if(_lcg>=_need) return true;
      var _c = (n>=6) ? 'S1' : ('S1B'+n);
      if(window.HansenSeason && HansenSeason.hasCard && HansenSeason.hasCard(_c)) return true;
      if(/island_season\.html/.test(location.pathname||'') && window.S && Array.isArray(window.S.bossWon) && window.S.bossWon.indexOf(n)>=0) return true;
    }catch(e){}
    return false;
  };

  //🔴v818 星海纪事: 神秘殿堂剧情回看·拿到对应守关卡解锁该章全文(序章随时可读)
  window.__hsnReadCh = function(idx){
    var M = {0:['prologue'],1:['meet1','reco1'],2:['meet2','reco2'],3:['meet3','reco3'],4:['meet4','reco4'],5:['meet5','reco5'],6:['meet6','reco6']};
    if(M[idx] && window.hansenStoryReader) window.hansenStoryReader(M[idx], {btnLabel:'读完了 →'});
  };
  window.hansenStoryArchive = function(){
    try{
      if(document.getElementById('hsnArchiveModal')) return;
      var got = function(n){ return !!(window.__hsnSeasonGot && window.__hsnSeasonGot(n)); };
      var CH = [
        {l:'序章 · 那一夜', s:'最远的星亮了一下', u:true, idx:0, boss:''},
        {l:'第一章 · 铸星者', s:'创世之炉的老匠人', u:got(1), idx:1, boss:'打通铸星者解锁'},
        {l:'第二章 · 统御天使', s:'举着光的孤独', u:got(2), idx:2, boss:'打通统御天使解锁'},
        {l:'第三章 · 暗噬君主', s:'无光之渊的温柔', u:got(3), idx:3, boss:'打通暗噬君主解锁'},
        {l:'第四章 · 时之君主', s:'被时间惩罚的人', u:got(4), idx:4, boss:'打通时之君主解锁'},
        {l:'第五章 · 终末观测者', s:'宇宙边界的守夜人', u:got(5), idx:5, boss:'打通终末观测者解锁'},
        {l:'终章 · 星海女帝赛尔娅', s:'星海的回响', u:got(6), idx:6, boss:'打通赛尔娅解锁'}
      ];
      var ov=document.createElement('div'); ov.id='hsnArchiveModal';
      ov.style.cssText='position:fixed;inset:0;z-index:2147483640;background:radial-gradient(ellipse at 50% 18%,#1a1340 0%,#0d0a22 55%,#070512 100%);display:flex;flex-direction:column;opacity:0;transition:opacity .3s ease';
      var stars=''; for(var i=0;i<22;i++){ var x=(i*41+11)%100, y=(i*59+7)%100, s=(i%3)+1; stars+='<div style="position:absolute;left:'+x+'%;top:'+y+'%;width:'+s+'px;height:'+s+'px;border-radius:50%;background:rgba(255,255,255,'+(0.2+(i%4)*0.1).toFixed(2)+')"></div>'; }
      var rows='';
      for(var c=0;c<CH.length;c++){
        var ch=CH[c];
        if(ch.u){
          rows += '<div onclick="window.__hsnReadCh('+ch.idx+')" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:13px 14px;margin-bottom:10px;background:linear-gradient(135deg,#1c1226,#241733);border:1.5px solid #a855f7;border-radius:13px"><div style="flex:1;min-width:0"><div style="font-size:15px;color:#f3e8ff;font-weight:800">'+ch.l+'</div><div style="font-size:11.5px;color:#a78bca;margin-top:3px">'+ch.s+'</div></div><div style="font-size:18px;color:#c4b5fd">📖</div></div>';
        } else {
          rows += '<div style="display:flex;align-items:center;gap:12px;padding:13px 14px;margin-bottom:10px;background:rgba(30,27,45,.6);border:1.5px solid #3a2752;border-radius:13px;opacity:.6"><div style="flex:1;min-width:0"><div style="font-size:15px;color:#9b8bb5;font-weight:800">???</div><div style="font-size:11px;color:#6d5f87;margin-top:3px">🔒 '+(ch.boss||'')+'</div></div><div style="font-size:18px">🔒</div></div>';
        }
      }
      ov.innerHTML='<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">'+stars+'</div>'+
        '<div style="position:relative;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:max(30px,env(safe-area-inset-top)) 18px 12px"><div style="max-width:560px;margin:0 auto">'+
        '<div style="text-align:center;color:#c4b5fd;font-size:12.5px;letter-spacing:4px;margin-bottom:4px">星 海 纪 事</div>'+
        '<h2 style="text-align:center;color:#f3e8ff;font-size:19px;font-weight:800;margin:0 0 6px">《星海的回响》</h2>'+
        '<div style="text-align:center;color:#8b7daa;font-size:11.5px;margin-bottom:20px">拿到守关卡的章节 · 可随时回看全文</div>'+
        rows+'<div style="height:8px"></div></div></div>'+
        '<div style="position:relative;padding:12px 18px max(16px,env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(13,10,34,0),#0d0a22 35%)"><button id="hsnArchiveClose" style="display:block;width:100%;max-width:560px;margin:0 auto;padding:13px;border:none;border-radius:14px;background:rgba(124,58,237,.3);color:#e9d5ff;font-size:15px;font-weight:800;cursor:pointer">关闭</button></div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function(){ ov.style.opacity='1'; });
      var cl=function(){ try{ ov.style.opacity='0'; setTimeout(function(){ if(ov.parentNode)ov.parentNode.removeChild(ov); },300); }catch(e){ if(ov.parentNode)ov.parentNode.removeChild(ov); } };
      var b=document.getElementById('hsnArchiveClose'); if(b)b.onclick=cl;
    }catch(e){ try{ var m=document.getElementById('hsnArchiveModal'); if(m&&m.parentNode)m.parentNode.removeChild(m); }catch(_e){} }
  };

  function renderSeasonBossPicker(){
    //🔴v874(Hansen定稿): 星海觉醒旧内容(宇宙地图/5星域子岛/信物/星轨)整套废除——番外篇=单词大陆8岛(land_map.html)。
    //  本hub只保留【女帝终战竞技场】: 单词大陆8岛全通(hsn_landmap_cleared_1..8)→决战赛尔娅(240词·hansenStartRebattle(6)·限定卡S1照旧发); 未全通→锁提示+回大陆地图。
    var box=document.getElementById('bossContent'); if(!box) return;
    var _lc=0; for(var _li=1;_li<=8;_li++){ try{ if(localStorage.getItem('hsn_landmap_cleared_'+_li)==='1') _lc++; }catch(_le){} }
    var curBg=getCurrentBg();
    var html='<div style="padding:14px 10px 40px;text-align:center">';
    html+='<div style="font-size:19px;font-weight:900;background:linear-gradient(90deg,#c4b5fd,#fde047,#f0abfc);-webkit-background-clip:text;background-clip:text;color:transparent">\ud83d\udc51 星海女帝 · 终战</div>';
    html+='<div style="font-size:11.5px;color:#a78bca;margin:4px 0 10px">单词大陆 8 岛全通后 · 决战赛尔娅 · 考全部 240 词</div>';
    html+='<div style="display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:12px"><span style="font-size:12px;color:#e9d5ff;font-weight:700">特效</span>'+hansenFxSwitchHTML()+'</div>';
    html+='<div style="width:150px;height:150px;margin:0 auto;border-radius:20px;border:2px solid #fde047;overflow:hidden;background:'+curBg.bg+';box-shadow:0 0 22px rgba(251,191,36,.45)"><img src="bosses/saelya.webp?v=1161" style="width:100%;height:100%;object-fit:contain;display:block" onerror="hansenImgErr(this)" alt=""></div>';
    var _fp76h=false; try{ _fp76h=!!(window.HansenFreepass&&window.HansenFreepass.active()); }catch(_fe){}
    if(_lc>=8 || _fp76h){  //🔴v876: 72小时试用期女帝也可试打(限定卡/纪事解锁仍按真实进度)
      try{ if(window.S){ window.S.bossUnlocked=6; if(typeof window.save==="function") window.save(); } }catch(_se){}
      html+='<div style="margin:14px auto 0;max-width:300px"><div style="font-size:13px;color:#fde047;font-weight:800">\u2705 8 座岛屿全部征服 · 终战开启!</div>'
        +'<div onclick="hansenStartRebattle(6)" style="margin-top:12px;cursor:pointer;display:inline-block;padding:13px 34px;border-radius:16px;border:2px solid #fbbf24;background:radial-gradient(circle at 50% 0%,rgba(251,191,36,.2),rgba(20,15,40,.75));box-shadow:0 0 18px rgba(251,191,36,.4);font-size:15px;font-weight:900;color:#fde047">\u2694\ufe0f 决战星海女帝</div>'+((_fp76h&&_lc<8)?'<div style="font-size:10.5px;color:#c4b5fd;margin-top:7px">\ud83c\udd93 72小时试用开放 · 正式通关仍需真实集齐 8 岛</div>':'')+'</div>';
    } else {
      html+='<div style="margin:14px auto 0;max-width:300px"><div style="font-size:13px;color:#9b8bb5;font-weight:800">\ud83d\udd12 还需通关 '+(8-_lc)+' 座岛屿 ('+_lc+'/8)</div>'
        +'<div onclick="((window.parent&&window.parent!==window&&window.parent.openIsland)||function(f){window.location.href=f})(\'land_map.html\')" style="margin-top:12px;cursor:pointer;display:inline-block;padding:12px 30px;border-radius:16px;border:2px solid rgba(167,139,250,.55);background:rgba(124,58,237,.18);font-size:14px;font-weight:800;color:#e9d5ff">\ud83d\uddfa\ufe0f 前往单词大陆</div></div>';
    }

    // 🎨 🔴v874(Hansen): 选关网格底部配色牌(与正片选关器同款·选boss背景色·hansenSetBossBg 存 BG_KEY 后重渲染)
    html += '<div style="margin:16px 0 0;padding:9px 10px 7px;background:rgba(15,23,42,0.6);border:1px solid rgba(251,191,36,0.25);border-radius:10px">' +
      '<div style="font-size:11px;color:#fbbf24;font-weight:800;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between">' +
        '<span>🎨 boss 背景 (点击切换)</span>' +
        '<span style="color:#cbd5e1;font-weight:600">' + curBg.emoji + ' ' + curBg.name + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:4px">';
    for(var _bgi = 0; _bgi < BG_PRESETS.length; _bgi++){
      var _bgp = BG_PRESETS[_bgi];
      var _bgc = _bgp.id === curBg.id;
      var _bgt = _bgp.thumb || _bgp.bg;
      html += '<div onclick="hansenSetBossBg(\'' + _bgp.id + '\')" title="' + _bgp.name + '" ' +
        'style="flex:1;aspect-ratio:1;background:' + _bgt + ';border:2.5px solid ' + (_bgc ? '#fbbf24' : 'rgba(148,163,184,0.4)') + ';border-radius:50%;cursor:pointer;position:relative;box-shadow:' + (_bgc ? '0 0 12px rgba(251,191,36,0.7),inset 0 0 0 2px #0f172a' : '0 2px 4px rgba(0,0,0,0.3)') + ';transition:transform 0.15s" ' +
        'onmousedown="this.style.transform=\'scale(0.9)\'" onmouseup="this.style.transform=\'\'" ontouchstart="this.style.transform=\'scale(0.9)\'" ontouchend="this.style.transform=\'\'">' +
        (_bgc ? '<div style="position:absolute;top:-7px;right:-4px;background:#fbbf24;color:#1e293b;font-size:10px;font-weight:900;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #0f172a">✓</div>' : '') +
      '</div>';
    }
    html += '</div></div>';
    html+='</div>';
    box.innerHTML=html;
    //🔴v852(v874续): hub落地即boss屏(inline _hsBoss防闪)·女帝立绘方块object-fit:contain完整形象。
    //🔴v815(v874续): 序章首次自动放(标记 hsn_season_prologue_seen)——星海纪事=女帝终战世界观·保留可读。
    try{ if(!localStorage.getItem('hsn_season_prologue_seen')){ localStorage.setItem('hsn_season_prologue_seen','1'); setTimeout(function(){ try{ if(window.hansenStoryReader) window.hansenStoryReader('prologue'); }catch(_pe){} },450); } }catch(_pe2){}
  }

  /* 🔴v871(Hansen): 星域子岛(island_season1-5)选关网格——渲染【子岛自己的 BOSSES】(全局可读)而非 20 个通用 BOSS_CARDS。
     修复"外壳20通用/里子6新boss"错位。season1=6关按 season1_prog 顺序解锁; season2-5=各自1守护者全解锁。点某关→临时指定打它。 */
  function renderSeasonZoneBossPicker(ik){
    var box=document.getElementById('bossContent'); if(!box) return;
    var zb=(typeof BOSSES!=='undefined' && BOSSES && BOSSES.length)?BOSSES:[];
    var n=zb.length;
    if(!n){ if(typeof renderSeasonBossPicker==='function'){renderSeasonBossPicker();} return; }
    var prog;
    if(ik==='season1'){ prog=0; try{ prog=parseInt(localStorage.getItem('season1_prog')||'0',10)||0; }catch(e){} }
    else if(/^land[1-8]$/.test(ik)){ prog=0; try{ prog=parseInt(localStorage.getItem(ik+'_prog')||'0',10)||0; }catch(e){} }  //🔴v873 大陆岛按 landN_prog 顺序解锁
    else { prog=n; }
    var beaten=Math.min(prog,n);
    var curBg=getCurrentBg();
    var html='<div style="padding:10px 6px 40px">';
    html+='<div style="margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,rgba(34,197,94,0.18),rgba(124,58,237,0.18));border:1.5px solid rgba(251,191,36,0.5);border-radius:12px;display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:nowrap">'
        +'<span style="font-size:14px;color:#fff;font-weight:800;white-space:nowrap">已击败 boss '+beaten+'/'+n+'</span>'
        +'<span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap"><span style="font-size:13px;color:#fef3c7;font-weight:800;letter-spacing:.5px">特效</span>'+hansenFxSwitchHTML()+'</span>'
        +'</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">';
    /* \U0001f534v982 \u540c\u5c4f\u540e\u7f00\u649e\u540d\u53bb\u91cd(\u7528\u6237\u88c1\u5b9a): \u9996\u4f4d\u4fdd\u7559\u540e\u7f00, \u540e\u6765\u8005\u6539\u7528\u524d\u7f00 \u2014\u2014 Lv.2 \u5929\u542f\u5f81\u670d\u8005 */
    var _sfxSeen={};
    for(var i=0;i<n;i++){
      var bo=zb[i]||{};
      var m=(bo.emoji||'').match(/href="([^"]+)"/); var img=m?m[1]:'';
      var nm=bo.name||('Boss'+(i+1)); var shortNm=(nm.indexOf('\u00b7')>=0)?nm.split('\u00b7').pop():nm;
      if(nm.indexOf('\u00b7')>=0){ if(_sfxSeen[shortNm]){ shortNm=nm.split('\u00b7')[0]; } else { _sfxSeen[shortNm]=1; } }
      var col=bo.color||'#fbbf24';
      var _fp76=false; try{ _fp76=!!(window.HansenFreepass&&window.HansenFreepass.active()); }catch(_fe){}
      var _clrAll=false; try{ _clrAll=(localStorage.getItem('hansen_admin_clearall_on')==='1'); }catch(_ce){}  //🔴v884(Hansen: 密码/一键通关后land岛还进不去关卡): land选关网格也认【一键通关】标记→全关卡解锁
      var unlocked=(i<=prog)||_fp76||_clrAll;  //🔴v876(Hansen): 72小时试用——全部关卡可挑战·真实前沿prog/通关旗零污染(advance仍只认_s1Idx===prog)
      if(unlocked){
        var tag=(i<prog)?'\u2713':((i===prog)?'\u25b6':'\ud83c\udd93');  //🔴v876 试用格=🆓
        html+='<div onclick="window.__hsnZoneFight('+i+')" style="position:relative;background:linear-gradient(135deg,'+col+'33,#1e293b);border:2.5px solid '+col+';border-radius:13px;padding:4px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4),0 0 10px '+col+'40;transition:transform 0.2s" ontouchstart="this.style.transform=\'scale(0.95)\'" ontouchend="this.style.transform=\'\'">'
          +'<div style="background:'+curBg.bg+';border-radius:9px;overflow:hidden;position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center">'
          +(img?'<img src="'+img+'" onerror="hansenImgErr(this)" style="width:100%;height:100%;object-fit:contain;display:block">':'')
          +'<span style="position:absolute;top:3px;right:5px;font-size:13px;text-shadow:0 1px 3px #000">'+tag+'</span>'
          +'</div>'
          +'<div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:4px">'
          +'<span style="flex-shrink:0;background:#fef3c7;color:#1e293b;font-size:9px;font-weight:900;padding:2px 5px;border-radius:4px">Lv.'+(i+1)+'</span>'
          +'<span style="font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.6);line-height:1.2">'+shortNm+'</span>'
          +'</div>'
          +'</div>';
      } else {
        html+='<div style="position:relative;background:#1e293b;border:2px dashed #334155;border-radius:13px;padding:4px;opacity:0.45;cursor:default">'
          +'<div style="background:#0f172a;border-radius:9px;overflow:hidden;position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#475569;font-size:38px">\ud83d\udd12</div>'
          +'<div style="text-align:center;font-size:10px;font-weight:700;color:#475569;margin-top:4px;line-height:1.2">Lv.'+(i+1)+' \u672a\u89e3\u9501</div>'
          +'</div>';
      }
    }
    html+='</div>'; /* 关网格 */

    // 🎨 🔴v874(Hansen): 选关网格底部配色牌(与正片选关器同款·选boss背景色·hansenSetBossBg 存 BG_KEY 后重渲染)
    html += '<div style="margin:16px 0 0;padding:9px 10px 7px;background:rgba(15,23,42,0.6);border:1px solid rgba(251,191,36,0.25);border-radius:10px">' +
      '<div style="font-size:11px;color:#fbbf24;font-weight:800;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between">' +
        '<span>🎨 boss 背景 (点击切换)</span>' +
        '<span style="color:#cbd5e1;font-weight:600">' + curBg.emoji + ' ' + curBg.name + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:4px">';
    for(var _bgi = 0; _bgi < BG_PRESETS.length; _bgi++){
      var _bgp = BG_PRESETS[_bgi];
      var _bgc = _bgp.id === curBg.id;
      var _bgt = _bgp.thumb || _bgp.bg;
      html += '<div onclick="hansenSetBossBg(\'' + _bgp.id + '\')" title="' + _bgp.name + '" ' +
        'style="flex:1;aspect-ratio:1;background:' + _bgt + ';border:2.5px solid ' + (_bgc ? '#fbbf24' : 'rgba(148,163,184,0.4)') + ';border-radius:50%;cursor:pointer;position:relative;box-shadow:' + (_bgc ? '0 0 12px rgba(251,191,36,0.7),inset 0 0 0 2px #0f172a' : '0 2px 4px rgba(0,0,0,0.3)') + ';transition:transform 0.15s" ' +
        'onmousedown="this.style.transform=\'scale(0.9)\'" onmouseup="this.style.transform=\'\'" ontouchstart="this.style.transform=\'scale(0.9)\'" ontouchend="this.style.transform=\'\'">' +
        (_bgc ? '<div style="position:absolute;top:-7px;right:-4px;background:#fbbf24;color:#1e293b;font-size:10px;font-weight:900;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #0f172a">✓</div>' : '') +
      '</div>';
    }
    html += '</div></div>';
    html+='</div>'; /* 关外层padding */
    box.innerHTML=html;
  }
  function renderBossPicker(){
    var __ik=getCurrentIslandKey();
    if(__ik==='season'){ renderSeasonBossPicker(); return; }
    if(/^season[1-5]$/.test(__ik)){ renderSeasonZoneBossPicker(__ik); return; }
    if(/^land[1-8]$/.test(__ik)){ renderSeasonZoneBossPicker(__ik); return; }  //🔴v873 单词大陆8岛(land1-8)同用星域选关网格(各岛自己的5 boss·landN_prog顺序解锁)  //🔴v871 星域子岛(season1-5)显示自己的BOSSES(非20通用卡)
    var box = document.getElementById('bossContent');
    if(!box) return;
    var d = loadData(true);
    var maxLv = getMaxChallengeLv();
    
    // 统计可挑战 boss 数
    // v327: 严格逐关 — 只看 maxLv(已解锁最高关), 不再 || beaten.
    //   旧代码用 (lv<=maxLv || beat), 而 beat 来自卡牌收集系统的 islandClears(历史打过的所有关都记着),
    //   导致"历史中途打过 Lv15/16"等关全被当成解锁 → 彻底绕过逐关限制 → 一打开后面一堆全解锁.
    var canCount = 0;
    for(var lv0 = 1; lv0 <= 20; lv0++){
      if(lv0 <= maxLv) canCount++;
    }
    // 🔴 v580: 统计【已击败】boss 数(islandClears 有通关记录的关) — 顶部"已击败 boss X/20"用
    var beatenCount = 0;
    for(var lv1 = 1; lv1 <= 20; lv1++){
      var cl = d.islandClears[lv1] || [];
      if(cl.length > 0) beatenCount++;
    }
    
    var curBg = getCurrentBg();
    var html = '<div style="padding:10px 6px 40px">';
    
    // 🔴 v537(Hansen 定稿): 横条只留「⚔️ 选择 boss 挑战」+ boss 攻击特效开关(开=绿底白ON/关=红底白OFF·滑块开关·点击带机械咔哒+双音滑奏音效·OFF 时 HansenBossAttack 零特效但掉血照常)。原副标题一行(可挑战计数/loot 说明/进度说明)按要求整体删除, 全库不得再出现。
    // 🔴 v581(Hansen): 删"选择boss挑战"行; "已击败 boss X/20"(白字) 与 "特效[开关]" 同一排横向显示, 中间拉开距离
    html += '<div style="margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,rgba(34,197,94,0.18),rgba(124,58,237,0.18));border:1.5px solid rgba(251,191,36,0.5);border-radius:12px;display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:nowrap">' +
      '<span style="font-size:14px;color:#fff;font-weight:800;white-space:nowrap">已击败 boss ' + beatenCount + '/20</span>' +
      '<span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap">' +
        '<span style="font-size:13px;color:#fef3c7;font-weight:800;letter-spacing:.5px">特效</span>' +
        hansenFxSwitchHTML() +
      '</span>' +
      '</div>';
    
    // 3 列 grid
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">';
    for(var lv = 1; lv <= 20; lv++){
      var b = BOSS_CARDS[lv - 1];
      var clears = d.islandClears[lv] || [];
      var beaten = clears.length > 0;
      var inRange = (lv <= maxLv);
      // v327: 严格逐关 — 解锁只看 inRange(是否在已解锁范围内), 不再 || beaten.
      //   beaten 来自卡牌收集系统(islandClears 记录历史打过的所有关), 用它判解锁会让历史打过的关全解锁 = 跳关.
      var unlocked = inRange;
      var r = RARITY_COLORS[b.rarity];
      
      if(unlocked){
        // v263: 按 Hansen 要求删除右下角角标 (🔴⚔️ 已通关 / 🟢🆕 未通关).
        //   理由: 解锁逻辑是"打通一关解锁下一关", 未解锁的本来就锁着 (显示 🔒),
        //   已解锁的角标对用户没有实际意义, 删掉更清爽.
        html += '<div onclick="hansenStartRebattle(' + lv + ')" style="position:relative;background:linear-gradient(135deg,' + r.bg + ',#1e293b);border:2.5px solid ' + r.border + ';border-radius:13px;padding:4px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4),0 0 10px ' + r.border + '40;transition:transform 0.2s" ' +
          'onmousedown="this.style.transform=\'scale(0.95)\'" onmouseup="this.style.transform=\'\'" ontouchstart="this.style.transform=\'scale(0.95)\'" ontouchend="this.style.transform=\'\'">' +
          '<div style="background:' + curBg.bg + ';border-radius:9px;overflow:hidden;position:relative">' +
          '<img src="' + b.img + '" loading="lazy" decoding="async" onerror="hansenImgErr(this)" style="width:100%;display:block">' +   /* ⭐v929: 选关墙一进去把整面墙(含屏幕外的)boss图全下了(实测26~41张·2.5MB) → 加 loading=lazy, 只下看得见的那几张 */
          '</div>' +
          // v265: Lv.N 标签移出图片, 和名字放在同一水平线 (不占图片任何空间)
          '<div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:4px">' +
          '<span style="flex-shrink:0;background:#fef3c7;color:#1e293b;font-size:9px;font-weight:900;padding:2px 5px;border-radius:4px">Lv.' + lv + '</span>' +
          '<span style="font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.6);line-height:1.2">' + b.name + '</span>' +
          '</div>' +
          '</div>';
      } else {
        // 未达等级且未通关 → 锁住
        html += '<div style="position:relative;background:#1e293b;border:2px dashed #334155;border-radius:13px;padding:4px;opacity:0.45;cursor:default">' +
          '<div style="background:#0f172a;border-radius:9px;overflow:hidden;position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#475569;font-size:38px">🔒</div>' +
          '<div style="text-align:center;font-size:10px;font-weight:700;color:#475569;margin-top:4px;line-height:1.2">Lv.' + lv + ' 未解锁</div>' +
          '</div>';
      }
    }
    html += '</div>';  // 关闭 grid
    
    // 🎨 v580: boss 背景选择器移到所有 boss 卡【最下面】(滑到底才出现)
    html += '<div style="margin:16px 0 0;padding:9px 10px 7px;background:rgba(15,23,42,0.6);border:1px solid rgba(251,191,36,0.25);border-radius:10px">' +
      '<div style="font-size:11px;color:#fbbf24;font-weight:800;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between">' +
        '<span>🎨 boss 背景 (点击切换)</span>' +
        '<span style="color:#cbd5e1;font-weight:600">' + curBg.emoji + ' ' + curBg.name + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:4px">';
    for(var bi = 0; bi < BG_PRESETS.length; bi++){
      var p = BG_PRESETS[bi];
      var isCur = p.id === curBg.id;
      var thumbStyle = p.thumb || p.bg;
      html += '<div onclick="hansenSetBossBg(\'' + p.id + '\')" title="' + p.name + '" ' +
        'style="flex:1;aspect-ratio:1;background:' + thumbStyle + ';border:2.5px solid ' + (isCur ? '#fbbf24' : 'rgba(148,163,184,0.4)') + ';border-radius:50%;cursor:pointer;position:relative;box-shadow:' + (isCur ? '0 0 12px rgba(251,191,36,0.7),inset 0 0 0 2px #0f172a' : '0 2px 4px rgba(0,0,0,0.3)') + ';transition:transform 0.15s" ' +
        'onmousedown="this.style.transform=\'scale(0.9)\'" onmouseup="this.style.transform=\'\'" ontouchstart="this.style.transform=\'scale(0.9)\'" ontouchend="this.style.transform=\'\'">' +
        (isCur ? '<div style="position:absolute;top:-7px;right:-4px;background:#fbbf24;color:#1e293b;font-size:10px;font-weight:900;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #0f172a">✓</div>' : '') +
      '</div>';
    }
    html += '</div></div>';
    
    html += '</div>';  // 关闭最外层 padding 容器
    
    box.innerHTML = html;
  }
  window.hansenRenderBossPicker = renderBossPicker;
  window.__hsnZoneFight = function(i){ try{ window._s1FightIdx=i; if(typeof window.startBoss==="function") window.startBoss(); }catch(e){} };  //🔴v871 星域子岛点选关卡开打
  window.hansenSetBossBg = function(id){ try { localStorage.setItem(BG_KEY, id); } catch(e){} renderBossPicker(); };
  
  // 🔴v796 已删除死函数 ensureRebattleScreen()/renderRebattleScreen()——v208起就不用独立rebattleScreen·从无调用(live入口是下方 window.hansenShowRebattle)。
  
  // 进入 boss 选择页 (从卡牌页"复仇厅"按钮触发) - v208: 直接跳 boss screen
  window.hansenShowRebattle = function(){
    if(typeof window.showScreen === 'function') window.showScreen('boss');
  };
  
  // v210 修复: boss screen 返回按钮智能跳转
  //   bossActive 是 island html 里的 let 局部变量, 外部无法访问
  //   改用 DOM 检测: 有 .boss-arena 元素 = 战斗中, 没有 = 已在 picker
  //   - 战斗中 → 停战 + 回 boss 选择网格
  //   - 已在 boss 选择网格 → 回主菜单
  window.hansenBossBackBtn = function(){
    var inBattle = !!document.querySelector('#bossContent .boss-arena');
    if(inBattle){
      // 停战 (清 bossActive 让 nextBossQ 等不再触发)
      if(typeof window.stopBoss === 'function') window.stopBoss();
      window._hansenRebattleLv = null;
      // 渲染 boss picker (覆盖 bossContent 的"挑战来啦"页)
      if(typeof renderBossPicker === 'function') {
        setTimeout(function(){ renderBossPicker(); }, 50);
      }
    } else {
      // 已在 picker, 回主菜单
      if(typeof window.showScreen === 'function') window.showScreen('home');
    }
  };
  
  // 返回 boss 选择 (从 victory/defeat 按钮触发) - 不切 screen, 直接重渲染
  window.hansenBackToBossPicker = function(){
    window._hansenRebattleLv = null;
    renderBossPicker();
  };
  
  // 重战指定 boss
  //🔴v816 真正进战斗的逻辑(供 hansenStartRebattle 放完战前相遇剧情后调用)
  window.__hsnDoRebattle = function(lv){
    var S = window.S;
    if(!S || typeof window.startBoss !== 'function' || typeof window.showScreen !== 'function') return;
    window._hansenRebattleLv = lv;       // 供 bossVictory hook 识别
    window.showScreen('boss');
    var origLevel = S.level; S.level = lv;
    try { window.startBoss(); } catch(e){}
    S.level = origLevel;
  };
  window.hansenStartRebattle = function(lv){
    if(!lv || lv < 1 || lv > 20) return;
    // 🔴 BUG#61 (v489): 600ms 内同一关重复点击防护
    var _now61 = Date.now();
    if(window.__hsnRebStamp61 && window.__hsnRebStamp61.lv === lv && (_now61 - window.__hsnRebStamp61.t) < 600){ return; }
    window.__hsnRebStamp61 = { lv: lv, t: _now61 };
    var S = window.S;
    if(!S || typeof window.startBoss !== 'function' || typeof window.showScreen !== 'function') return;
    // v327: 逻辑级解锁硬校验·彻底防跳关
    var maxAllowed = (typeof getMaxChallengeLv === 'function') ? getMaxChallengeLv() : 1;
    if(lv > maxAllowed){
      try { console.warn('[HansenCards] 拒绝挑战未解锁的 Lv' + lv + ' (当前解锁到 Lv' + maxAllowed + ')'); } catch(e){}
      return;
    }
    //🔴v816 赛季: 首次打该 boss 前先放"相遇"剧情·读完点"开始挑战"才真正进战斗(常规岛不放·直接打)
    if(/island_season\.html/.test(location.pathname||'')){
      var _mKey = 'meet' + lv;
      if(window.HANSEN_STORY && window.HANSEN_STORY[_mKey] && window.hansenStoryReader){
        var _seen = false; try { _seen = !!localStorage.getItem('hsn_season_meet_' + lv); } catch(e){}
        if(!_seen){
          try { localStorage.setItem('hsn_season_meet_' + lv, '1'); } catch(e){}
          window.hansenStoryReader(_mKey, { btnLabel: '⚔️ 开始挑战', onClose: function(){ window.__hsnDoRebattle(lv); } });
          return;  // 先看相遇剧情·点开始挑战才进战斗
        }
      }
    }
    window.__hsnDoRebattle(lv);
  };
  
  
  // ────────────────────────────────────────────────────
  // UI: 渲染卡牌收藏页面
  // ────────────────────────────────────────────────────
  function renderCardScreen(){
    var screen = ensureCardsScreen();
    if(!screen) return;
    // v360: 读【全局卡册】HansenCardbook(打boss+抽卡都填); 没有则回退各岛d.collected。
    var CB = window.HansenCardbook;
    // 🔴 v539: 临时全解锁(hansenTempUnlock·管理员卡牌入口触发)必须对收藏页生效——v360 引入全局卡册后 CB.has 优先, 绕过了 loadData 的临时覆盖, 导致临时解锁名存实亡。此处显式 OR 临时标记(只影响显示, 不污染真实数据)。
    var __tmpAll=(function(){try{return parseInt(localStorage.getItem('hansen_card_temp_unlock_until')||'0',10)>Date.now();}catch(e){return false;}})();
    var hasCard = function(lv){ if(__tmpAll) return true; return CB ? CB.has(lv) : (loadData().collected.indexOf(lv)>=0); };
    var owned = 0;
    for(var lv0=1; lv0<=20; lv0++){ if(hasCard(lv0)) owned++; }
    var pct = Math.round(owned / 20 * 100);
    var allDone = owned >= 20;

    // 5档分组(对应章节), 每组横排4张
    var GROUPS = [
      {rar:'common',    cn:'普通卡', color:'#cbd5e1', lvs:[1,2,3,4]},
      {rar:'uncommon',  cn:'稀有卡', color:'#60a5fa', lvs:[5,6,7,8]},
      {rar:'rare',      cn:'史诗卡', color:'#a78bfa', lvs:[9,10,11,12]},
      {rar:'epic',      cn:'传说卡', color:'#fbbf24', lvs:[13,14,15,16]},
      {rar:'legendary', cn:'至尊卡', color:'#f472b6', lvs:[17,18,19,20], note:'仅限抽中'}
    ];

    var html = '<button class="back-btn" onclick="showScreen(\'home\')">← 返回</button>';
    html += '<div class="screen-title"><span style="-webkit-text-fill-color:initial;-webkit-background-clip:border-box;background:none;text-shadow:none">🎴</span> 收藏卡册</div>';
    // 顶部: 收集进度 + 大师标记
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 4px 6px">'+
      '<div style="font-size:13px;color:#cbd5e1">📚 已收集 <b style="color:#fbbf24;font-size:18px">'+owned+'</b> / 20 张</div>'+
      '<div style="font-size:13px;font-weight:900;color:#fbbf24;background:rgba(251,191,36,.15);padding:4px 11px;border-radius:13px">'+owned+' / 20</div></div>';
    if(allDone){
      html += '<div style="font-size:12px;color:#86efac;margin:0 4px 14px">✨ 全部集齐 · 卡牌大师</div>';
    }else{
      html += '<div style="height:8px;background:rgba(15,23,42,.7);border-radius:5px;margin:0 4px 14px;overflow:hidden;border:1px solid rgba(251,191,36,.2)">'+
        '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:5px"></div></div>';
    }

    // 复仇厅入口(保留)
    var d3 = loadData(true);
    var rbCount = 0;
    for(var lvX=1; lvX<=20; lvX++){ if((d3.islandClears[lvX]||[]).length > 0) rbCount++; }
    if(rbCount > 0){
      html += '<div onclick="hansenShowRebattle()" style="margin:0 4px 16px;padding:12px 14px;background:linear-gradient(135deg,#dc2626,#7f1d1d);border:2px solid #fbbf24;border-radius:12px;text-align:center;cursor:pointer">'+
        '<div style="font-size:16px;font-weight:900;color:#fff">⚔️ Boss 挑战厅</div>'+
        '<div style="font-size:11px;color:#fef3c7;margin-top:3px">可重新挑战 '+rbCount+' 个已通关 boss</div></div>';
    }

    // 5档分组横排
    GROUPS.forEach(function(g){
      var got = 0; g.lvs.forEach(function(lv){ if(hasCard(lv)) got++; });
      html += '<div style="margin-bottom:18px">';
      // 分组标题
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'+
        '<div style="width:4px;height:15px;border-radius:2px;background:'+g.color+'"></div>'+
        '<div style="font-size:14px;font-weight:800;color:#e2e8f0">'+g.cn+'</div>'+
        '<div style="font-size:11px;color:#94a3b8">'+got+'/4'+(g.note?' · '+g.note:'')+'</div></div>';
      // 横排4张
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px">';
      g.lvs.forEach(function(lv){
        var b = BOSS_CARDS[lv-1];
        var unlocked = hasCard(lv);
        html += renderCardThumb(b, unlocked, g.color);
      });
      html += '</div></div>';
    });

    // 🔴 v715(Hansen): 底部「神秘殿堂」入口(从首页/赛季页移来 + 重新设计为精美入口卡, 替代原"卡牌大师"暗色横幅)。
    //   金紫渐变描边 + 双层径向高光底(不再黑沉沉) + 发光图标徽章 + 金色渐变标题 + 进入提示; 点击 __hsnOpenHall() 打开历代赛季限定卡陈列馆。
    //   注: 集卡进度/"卡牌大师"达成状态仍在本页顶部(已收集 N/20 + 全部集齐提示)展示, 故此处换成神秘殿堂入口不丢信息。
    var hallOwned=0, hallTotal=0;
    try{ if(window.HansenSeason){ hallTotal=(window.HansenSeason.allSeasons()||[]).length; hallOwned=__tmpAll?hallTotal:((window.HansenSeason.data()||{}).unlockedCards||[]).length; } }catch(e){}
    html += '<div style="margin:14px 4px 80px;background:linear-gradient(135deg,#fbbf24,#c084fc 50%,#fbbf24);padding:1.6px;border-radius:18px;box-shadow:0 12px 32px rgba(124,58,237,.32),0 4px 16px rgba(251,191,36,.20)">'+
      '<div onclick="if(window.__hsnOpenHall)__hsnOpenHall()" style="position:relative;border-radius:16.4px;padding:16px 15px;cursor:pointer;overflow:hidden;display:flex;align-items:center;gap:13px;'+
        'background:radial-gradient(130% 120% at 0% 0%,rgba(251,191,36,.17),transparent 52%),radial-gradient(130% 120% at 100% 100%,rgba(167,139,250,.22),transparent 52%),linear-gradient(135deg,#2a1f55,#191338 55%,#2e2417)">'+
        '<div style="flex:none;width:54px;height:54px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:30px;background:radial-gradient(circle at 35% 28%,rgba(251,191,36,.34),rgba(124,58,237,.20));border:1px solid rgba(251,191,36,.5);box-shadow:0 0 18px rgba(251,191,36,.30),inset 0 1px 2px rgba(255,255,255,.20)">🏛️</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:7px">'+
            '<div style="font-size:18px;font-weight:900;letter-spacing:.5px;background:linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">神秘殿堂</div>'+
            '<div style="font-size:9px;font-weight:800;color:#2a1f05;background:linear-gradient(90deg,#fde68a,#f59e0b);padding:2px 7px;border-radius:8px;letter-spacing:.5px">限定</div>'+
          '</div>'+
          '<div style="font-size:12px;color:#cbd5e1;margin-top:3px">历代赛季限定卡 · 已收藏 <b style="color:#fbbf24">'+hallOwned+'</b>/'+hallTotal+'</div>'+
        '</div>'+
        '<div style="flex:none;display:flex;align-items:center;gap:2px;color:#fbbf24;font-size:13px;font-weight:800">进入<span style="font-size:19px;line-height:1">›</span></div>'+
      '</div></div>';

    // 🔴v955: 卡册页底部追加【单词大陆图鉴】分区(40张 Land Boss 卡·独立卡池·独立存档)·不影响正片20张卡区。
    try{ if(window.hansenRenderLandCardSection){ html += window.hansenRenderLandCardSection(); } }catch(e){}
    screen.innerHTML = html;
  }
  window.hansenRenderCards = renderCardScreen;

  // 横排卡片缩略(groupColor=该档颜色)
  function renderCardThumb(b, unlocked, groupColor){
    if(unlocked){
      return '<div onclick="hansenShowCardDetail('+b.lv+')" style="cursor:pointer;border:2px solid '+groupColor+';background-color:rgba(30,41,59,.4);border-radius:9px;padding:4px;text-align:center">'+
        '<div style="background:#0f172a;border-radius:6px;overflow:hidden">'+
        '<img src="'+b.img+'" onerror="hansenImgErr(this)" style="width:100%;display:block">'+
        '</div>'+
        '<div style="font-size:10px;font-weight:700;color:#fff;margin-top:4px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+b.name+'</div>'+
        '</div>';
    } else {
      return '<div style="border:2px dashed #334155;background-color:rgba(15,23,42,.4);border-radius:9px;padding:4px;text-align:center;opacity:.8">'+
        '<div style="background:#0f172a;border-radius:6px;overflow:hidden;position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center">'+
        '<img src="'+b.img+'" onerror="hansenImgErr(this)" style="width:100%;display:block;filter:grayscale(1) brightness(.25) blur(2px);position:absolute;inset:0">'+
        '<div style="position:relative;font-size:28px;color:#475569">🔒</div>'+
        '</div>'+
        '<div style="font-size:10px;font-weight:700;color:#475569;margin-top:4px">???</div>'+
        '</div>';
    }
  }


  // ────────────────────────────────────────────────────
  // UI: 高清大图 modal
  // ────────────────────────────────────────────────────
  /* 🔴 v539(Hansen 定稿): 已收藏卡点击 → 打开「BOSS 殿堂」全屏展示(隔离 iframe 加载 boss_hall.html, 与神秘殿堂同模式)。
     星海女帝全规格: 本命背景图全屏 + 眼睛三段切换(完整/仅角色/仅背景壁纸) + 3D 倾斜全息卡 + 放大 + 光效 + 13 卡面背景(0=本命场景★) + 持久化。
     稀有度专属卡框(白银/翠玉/蔚蓝/紫晶/鎏金); 四角白色角标已按要求移除。
     own= 传当前可看列表(含临时全解锁), 殿堂内左右切换只在已拥有之间循环。旧详情模态整体退役。 */
  window.hansenShowCardDetail = function(lv){
    if(document.getElementById('__hsn_bosshall')) return;
    var CB = window.HansenCardbook;
    var tmpAll=(function(){try{return parseInt(localStorage.getItem('hansen_card_temp_unlock_until')||'0',10)>Date.now();}catch(e){return false;}})();
    var own=[];
    for(var i=1;i<=20;i++){
      var got = tmpAll ? true : (CB ? CB.has(i) : (loadData().collected.indexOf(i)>=0));
      if(got) own.push(i);
    }
    if(own.indexOf(lv)<0) return;   // 未拥有不开(调用点本就只挂已解锁卡, 双保险)
    var mask = document.createElement('div');
    mask.id='__hsn_bosshall';
    mask.style.cssText='position:fixed;inset:0;z-index:2147483600;background:#0a0a14';
    var iframe=document.createElement('iframe');
    iframe.src='boss_hall.html?v=1161&lv='+lv+'&own='+own.join(',');
    iframe.setAttribute('title','BOSS 殿堂');
    iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0a0a14';
    mask.appendChild(iframe);
    var closeBtn=document.createElement('div');
    closeBtn.textContent='\u00d7';
    closeBtn.setAttribute('aria-label','\u5173\u95ed');
    closeBtn.style.cssText='position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;z-index:5;width:40px;height:40px;border-radius:50%;background:rgba(10,12,24,.82);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:24px;line-height:38px;text-align:center;cursor:pointer';
    closeBtn.addEventListener('click',function(){ if(mask.parentNode) mask.parentNode.removeChild(mask); });
    mask.appendChild(closeBtn);
    document.body.appendChild(mask);
  };

  // ────────────────────────────────────────────────────
  // 入口替换: 仅修改主页 util-card "成就" → "卡牌", 底部 nav 保持原"成就"
  // ────────────────────────────────────────────────────
  function patchUtilCards(){
    /* 🔴 v594: 卡册入口仅保留右下角底栏(navCards), 不再注入 util-card(Hansen: 去掉主题商店那排重复卡册, 右下角已有; showScreen('cards') 渲染 hook 不受影响) */
    
    // 🔴 v576: 移除 v161 的"底栏成就还原"逻辑 — Hansen 主动把底栏成就位换成卡册(navCards),
    //   旧逻辑(检测到'卡牌'就改回成就)会与新设计冲突。底栏卡册入口现由 island HTML 直接承载(navCards),
    //   showScreen('cards') 仍由本文件 hook 渲染, 无需此处干预。
  }

  // ────────────────────────────────────────────────────
  // 注入必要的 CSS keyframes
  // ────────────────────────────────────────────────────
  function injectCss(){
    if(document.getElementById('hansenCardsCss')) return;
    var s = document.createElement('style');
    s.id = 'hansenCardsCss';
    s.textContent =
      '@keyframes hansenCardToastIn{0%{opacity:0;transform:translateX(-50%) translateY(-40px) scale(0.85)}60%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.04)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}' +
      '@keyframes hansenMasterIn{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:1}}';
    document.head.appendChild(s);
  }

  // ────────────────────────────────────────────────────
  // 初始化
  // ────────────────────────────────────────────────────
  function init(){
    injectCss();
    patchUtilCards();
    
    // v161+185+186: hook showScreen 让 'cards' 切换时自动创建 + render 卡牌; 切到 'boss' 时显示选择网格; 切到非 boss 时清重战标记
    if(typeof window.showScreen === 'function' && !window.__hansenCardsScreenHooked){
      window.__hansenCardsScreenHooked = true;
      var origShowScreen = window.showScreen;
      window.showScreen = function(name){
        // v208: 切到非 boss 时清重战标记
        if(name !== 'boss' && window._hansenRebattleLv != null){
          window._hansenRebattleLv = null;
        }
        // 先确保 cardsScreen 存在
        if(name === 'cards') ensureCardsScreen();
        var ret = origShowScreen.apply(this, arguments);
        if(name === 'cards'){
          renderCardScreen();
        }
        // v208: 切到 boss screen 且不在战斗中 → 渲染 picker 替换"挑战来啦"页 (同步, 避免覆盖战斗 UI)
        if(name === 'boss' && !window.bossActive){
          if(typeof renderBossPicker === 'function') renderBossPicker();
        }
        return ret;
      };
    }
    //🔴v852 星海觉醒(hub)落地页=宇宙地图(Hansen·"点进星海学习岛第一眼就是宇宙地图·先选星域·不是先进岛主页再点挑战BOSS"): showScreen已包装完(切boss会渲染picker=宇宙地图)→此处对hub切到boss屏当落地页(inline已直接切类防闪·这里补真正渲染)。仅hub(island_season.html)·子岛season1-5正则不匹配→照常停岛主页。
    try{ if(/island_season\.html/.test(location.pathname||'') && !window.bossActive){ if(typeof window.showScreen==='function') window.showScreen('boss'); } }catch(e){}
    
    // hook bossVictory 自动记录通关
    if(typeof window.bossVictory === 'function' && !window.__hansenCardsBossHooked){
      window.__hansenCardsBossHooked = true;
      var origBossVictory = window.bossVictory;
      window.bossVictory = function(){
        // v941: 重战取 _hansenRebattleLv；普通战取实际 boss 对象/权威 bossCurrentLv。
        // 不得读取 S.level（玩家 XP 段位），无法确认真实关号时 resolveActualBossLv 返回 0 并安全跳过记录。
        var lv = resolveActualBossLv();
        var isRebattle = (window._hansenRebattleLv != null);
        var ret = origBossVictory.apply(this, arguments);
        try{ markBossWin(lv); } catch(e){}
        
        // v208: 重战胜利后改造原 victory 弹窗按钮
        if(isRebattle){
          // 🔴 BUG#61 修复 (v489): 同步立即改写按钮, 彻底消除 50ms 改写窗口。
          //   origBossVictory 是同步渲染的, 它返回时按钮已在 DOM, 紧接着(同步、用户无法插入点击)立即改写,
          //   就不存在"原生 onclick=startBoss() 在被改写前被点中 → 跳到未解锁 boss"的时间窗。
          //   再保留一次 50ms 兜底(幂等: 文案已改则查不到"再来一局", 重复改写无副作用)。
          var _rewriteWin61 = function(){
            var box = document.getElementById('bossContent');
            if(!box) return;
            var btns = box.querySelectorAll('button');
            btns.forEach(function(btn){
              var t = btn.textContent || '';
              if(t.indexOf('再来一局') >= 0){
                btn.setAttribute('onclick', 'hansenStartRebattle(' + lv + ')');
                btn.innerHTML = '⚔️ 再次挑战';
              } else if(t.indexOf('回主页') >= 0){
                btn.setAttribute('onclick', "hansenBackToBossPicker()");
                btn.innerHTML = '← 选其他 boss';  /* 🔴v1014: 🔙 是天生深灰的 emoji, 压在蓝按钮上看不清; 改用文字箭头, 会随按钮文字色自动变白 */
              }
            });
          };
          _rewriteWin61();                 // 立即(同步)改写 → 零时间窗
          setTimeout(_rewriteWin61, 50);   // 50ms 兜底(幂等)
        }
        
        return ret;
      };
    }
    
    // v208: hook bossDefeat 处理重战战败
    if(typeof window.bossDefeat === 'function' && !window.__hansenCardsBossDefeatHooked){
      window.__hansenCardsBossDefeatHooked = true;
      var origBossDefeat = window.bossDefeat;
      window.bossDefeat = function(){
        var isRebattle = (window._hansenRebattleLv != null);
        var lv = window._hansenRebattleLv;
        var ret = origBossDefeat.apply(this, arguments);
        if(isRebattle){
          // 🔴 BUG#61 修复 (v489): 同步立即改写战败页按钮, 消除 50ms 窗口(同 victory hook, 详见那里注释)。
          var _rewriteLose61 = function(){
            var box = document.getElementById('bossContent');
            if(!box) return;
            var btns = box.querySelectorAll('button');
            btns.forEach(function(btn){
              var t = btn.textContent || '';
              if(t.indexOf('再次挑战') >= 0 || t.indexOf('重新挑战') >= 0){ /* 🔴v881: 战败按钮文案已统一'再次挑战'·hook识别同步(兼容旧'重新挑战') */
                btn.setAttribute('onclick', 'hansenStartRebattle(' + lv + ')');
                btn.innerHTML = '⚔️ 再次挑战';
              } else if(t.indexOf('去背单词') >= 0){
                btn.setAttribute('onclick', "hansenBackToBossPicker()");
                btn.innerHTML = '← 选其他 boss';  /* 🔴v1014: 🔙 是天生深灰的 emoji, 压在蓝按钮上看不清; 改用文字箭头, 会随按钮文字色自动变白 */
              }
            });
          };
          _rewriteLose61();                 // 立即(同步)改写 → 零时间窗
          setTimeout(_rewriteLose61, 50);   // 50ms 兜底(幂等)
        }
        return ret;
      };
    }
    
    // v208+186 showScreen hook 已合并到上面 v161 的 hook 中
    
    // 如果还没拿到 showScreen / bossVictory, 重试 (等其他脚本加载)
    if(typeof window.showScreen !== 'function' || typeof window.bossVictory !== 'function'){
      (function(){ /* ⭐v929 卡册 boss 图(19张·数MB)原本进岛 200ms 就开抢带宽 → 挪到【首屏画完+空闲】之后, 绝不和首屏抢 */
    var go=function(){ if(window.requestIdleCallback) requestIdleCallback(function(){ setTimeout(init, 1500); }, {timeout:5000}); else setTimeout(init, 2500); };
    if(document.readyState==='complete') go(); else window.addEventListener('load', go);
  })();
    }
  }
  
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // ────────────────────────────────────────────────────
  // 🚀 v261: Boss 图预加载 — 进游戏后台悄悄下载所有 20 张 boss 图
  //   目的: 玩家点进 boss 选关界面时, 图片已在浏览器缓存里, 瞬间显示, 零等待.
  //   
  //   做法: 游戏加载完成后, 延迟 1.2 秒 (让首屏关键内容先渲染), 然后用 new Image()
  //   在后台逐张预加载. 错开 120ms 加载 (不让 20 张同时挤爆网络, 平滑利用网速).
  //   
  //   注意 (诚实说明): 这【不能】抢占玩家手机的网速优先级 (那是操作系统管的, 网页无权干预),
  //   但能做到"趁玩家在玩别的时, 图早就在后台下载好了", 等点选关界面时直接从缓存读, 不走网络.
  //   这是网页能做到的最好效果.
  // HF2 统一后台媒体门禁：只有浏览器明确报告 4G、非省流量、在线且页面
  // 可见时才可以预载。Network Information API 缺失就是 unknown，必须保守禁止。
  // 真正点进 Boss/例句时仍会正常按需加载，所以该门禁只节省可选的后台流量。
  function canBackgroundMedia(){
    try{
      var p=window.HansenPreloadPolicy;
      if(p && typeof p.canBackgroundDownload==='function') return !!p.canBackgroundDownload();
      var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      return !!c && !c.saveData && c.effectiveType==='4g' && navigator.onLine!==false &&
        (!document.visibilityState || document.visibilityState==='visible') && !document.hidden;
    }catch(e){ return false; }
  }
  function shouldYieldBackgroundMedia(){
    try{
      var p=window.HansenPreloadPolicy;
      if(p && typeof p.shouldYield==='function') return !!p.shouldYield();
      if(!canBackgroundMedia()) return true;
      return Date.now()<Math.max(window.__hansenUserActiveUntil||0,window.__hansenAudioBusyUntil||0);
    }catch(e){ return true; }
  }
  var _mediaWaiters=[];
  function waitForBackgroundMedia(fn){
    if(typeof fn!=='function')return;
    if(canBackgroundMedia()){setTimeout(fn,0);return;}
    if(_mediaWaiters.indexOf(fn)<0)_mediaWaiters.push(fn);
  }
  function wakeBackgroundMedia(){
    if(!canBackgroundMedia()||!_mediaWaiters.length)return;
    var list=_mediaWaiters.slice();_mediaWaiters=[];
    list.forEach(function(fn){setTimeout(function(){try{fn();}catch(e){}},0);});
  }
  try{
    document.addEventListener('visibilitychange',wakeBackgroundMedia,{passive:true});
    window.addEventListener('online',wakeBackgroundMedia,{passive:true});
    var _mediaConn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(_mediaConn&&typeof _mediaConn.addEventListener==='function')_mediaConn.addEventListener('change',wakeBackgroundMedia);
    window.addEventListener('pagehide',function(){_mediaWaiters=[];},{once:true});
  }catch(e){}

  function preloadBossImages(){
    if(!canBackgroundMedia()){waitForBackgroundMedia(preloadBossImages);return;}
    if(window.__hansenBossImgPreloaded) return;
    window.__hansenBossImgPreloaded = true;
    
    var imgs = [];
    try {
      imgs = BOSS_CARDS.map(function(b){ return b.img; }).filter(Boolean);
    } catch(e){ return; }
    if(!imgs.length) return;
    
    var i = 0;
    function loadNext(){
      if(i >= imgs.length) return;
      if(!canBackgroundMedia()){waitForBackgroundMedia(loadNext);return;}  // 条件改善后事件驱动续传
      // 用户正在操作 → 让路 (不和点击抢带宽)
      var ua = Math.max(window.__hansenUserActiveUntil || 0, window.__hansenAudioBusyUntil || 0);
      if(shouldYieldBackgroundMedia() || Date.now() < ua){ var d=(ua-Date.now())+80; if(d<120)d=120;if(d>500)d=500; setTimeout(loadNext, d); return; }
      var src = imgs[i];
      i++;
      try {
        var img = new Image();
        try{ img.fetchPriority='low'; }catch(_fp){}
        try{ img.decoding='async'; }catch(_dc){}
        // 加载完(成功或失败)都继续下一张, 不卡住
        img.onload = function(){ setTimeout(loadNext, 120); };
        img.onerror = function(){ setTimeout(loadNext, 120); };
        img.src = src;  // 触发浏览器下载 → 进缓存
      } catch(e){
        setTimeout(loadNext, 120);
      }
    }
    loadNext();
  }
  
  // 延迟启动预加载 (让首屏关键内容先加载, 不抢首屏资源)
  if(typeof window !== 'undefined'){
    if(document.readyState === 'complete'){
      setTimeout(preloadBossImages, 1200);
    } else {
      window.addEventListener('load', function(){
        setTimeout(preloadBossImages, 1200);
      });
    }
  }
  
  // ────────────────────────────────────────────────────
  // 🚀 v262: 句子音频智能预加载 — 只预加载【本岛】单词例句的音频
  //   
  //   背景: 句子翻译/听力题播放句子音频时, 是 new Audio('sentences/sentence_XXXX.mp3') 临时下载,
  //   没预加载的话玩家点播放要等下载. 这就是"加载等待".
  //   
  //   关键判断: 全部句子音频有 709 条 (14MB), 但【每个岛只用自己的 ~42 条例句】.
  //   所以【不全量预加载 709 条】(会狂占 14MB 流量), 只预加载【本岛单词例句对应的音频】(~42 条, ~0.8MB).
  //   这样: 本岛做句子题时音频已就绪瞬间播放, 又不浪费流量.
  //   
  //   做法: 从 window.allW 读本岛单词的 ex (例句), 查 SENTENCE_MAP 得到 mp3 编号, 后台预加载.
  function preloadSentenceAudio(){
    if(!canBackgroundMedia()){waitForBackgroundMedia(preloadSentenceAudio);return;}
    if(window.__hansenSentAudioPreloaded) return;
    if(!window.SENTENCE_MAP || !window.allW) return;  // 数据还没加载, 等下次
    window.__hansenSentAudioPreloaded = true;
    
    // 收集本岛所有例句对应的 mp3 编号 (去重)
    var idxSet = {};
    try {
      window.allW.forEach(function(w){
        if(w && w.ex && window.SENTENCE_MAP[w.ex]){
          idxSet[window.SENTENCE_MAP[w.ex]] = true;
        }
      });
    } catch(e){ return; }
    
    var idxList = Object.keys(idxSet);
    if(!idxList.length) return;
    
    // 错开预加载 (用 Audio preload, 不自动播放)
    var i = 0;
    function loadNextAudio(){
      if(i >= idxList.length) return;
      if(!canBackgroundMedia()){waitForBackgroundMedia(loadNextAudio);return;}  // 条件改善后事件驱动续传
      // 用户正在操作 → 让路 (不和"点击发音"抢带宽; 本岛例句温柔后台备好)
      var ua = Math.max(window.__hansenUserActiveUntil || 0, window.__hansenAudioBusyUntil || 0);
      if(shouldYieldBackgroundMedia() || Date.now() < ua){ var d=(ua-Date.now())+80; if(d<120)d=120;if(d>500)d=500; setTimeout(loadNextAudio, d); return; }
      var idx = idxList[i];
      i++;
      try {
        var url = 'sentences/sentence_' + String(Number(idx)).padStart(4, '0') + '.mp3?v91';
        var a = new Audio();
        a.preload = 'auto';
        // load 完(成功或失败)继续下一条, 错开 200ms (音频比图大, 留多点间隔)
        a.oncanplaythrough = function(){ setTimeout(loadNextAudio, 200); };
        a.onerror = function(){ setTimeout(loadNextAudio, 200); };
        a.src = url;
        a.load();  // 触发下载进缓存 (不 play, 不出声)
      } catch(e){
        setTimeout(loadNextAudio, 200);
      }
    }
    loadNextAudio();
  }
  
  // 句子音频预加载延迟更久启动 (3 秒, 排在 boss 图后面, 优先级更低)
  //   且要等 SENTENCE_MAP 和 allW 都加载好, 加重试
  function trySentencePreload(tries){
    tries = tries || 0;
    if(!canBackgroundMedia()){waitForBackgroundMedia(function(){trySentencePreload(tries);});return;}
    if(window.SENTENCE_MAP && window.allW){
      preloadSentenceAudio();
    } else if(tries < 20){
      setTimeout(function(){ trySentencePreload(tries + 1); }, 500);
    }
  }
  if(typeof window !== 'undefined'){
    if(document.readyState === 'complete'){
      setTimeout(function(){ trySentencePreload(0); }, 3000);
    } else {
      window.addEventListener('load', function(){
        setTimeout(function(){ trySentencePreload(0); }, 3000);
      });
    }
  }
  
  // console banner
  console.log('%c🎴 Hansen Cards v172 已加载', 'background:linear-gradient(135deg,#fbbf24,#ea580c);color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold');
})();
