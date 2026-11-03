/* 🐾 hansen_pet_showcase.js —— 宠物奇幻进化展示系统（36阶·全岛共享）
   接管: renderPetScreen(宠物屏→卡牌式展示器+六境路线图) / updatePetHero(首页宠物→图片) / showPetEvolve(进化toast→图片)
   依赖(全局·内联脚本提供): window.PET_STAGES(36项·含img/name/text/emoji/req) · getPetStage() · getPetProgress() · S · save · showComboToast · bigConfetti · playLevelUp
   新增: 卡牌式放大展示器 + 每只宠物可选背景色(本地记忆·默认暗色调) + 六境分段路线图 + 未解锁剪影
   规则: 动效只用轻微呼吸/淡入(无抖动) */
(function(){
  'use strict';
  if(window.__hsnPetShowcase) return; window.__hsnPetShowcase=true;

  // 六大境界(每境6阶)——决定路线图分段标题色 + 卡牌左上角境标签
  var REALMS=[
    {num:'一',name:'混沌孕育',sub:'神秘起源',c1:'#a5b4fc',c2:'#c4b5fd'},
    {num:'二',name:'元素觉醒',sub:'初具锋芒',c1:'#34d399',c2:'#22d3ee'},
    {num:'三',name:'幻兽成形',sub:'开始帅气',c1:'#fbbf24',c2:'#fb923c'},
    {num:'四',name:'神兽降世',sub:'气场全开',c1:'#f87171',c2:'#fb7185'},
    {num:'五',name:'上古神兽',sub:'传说之力',c1:'#c084fc',c2:'#a78bfa'},
    {num:'六',name:'星界至尊',sub:'终焉形态',c1:'#fcd34d',c2:'#ec4899'}
  ];
  // 卡牌背景色选项 —— a:顶部聚光色 b:底部色; lt:1=亮底(文字自动转深色); g:自定义渐变(彩虹等), hl:光晕基色
  // ⚠️0-9为历史色号·顺序绝不可改(hansen_pet_bg存的是色号索引·改顺序会让老用户选中错位)·新色一律往后追加
  //🔴v637 名字小蛋→星灵 + 缩略图背景随所选色(capCss) + 色板10→24(亮彩/纯白/彩虹) + 亮底文字转深色(lt)
  var BG=[
    /* —— 暗调系(0-9·历史·勿动顺序) —— */
    {n:'暗夜',a:'#2a3656',b:'#0b1120'},
    {n:'墨蓝',a:'#1e3a6b',b:'#0a1226'},
    {n:'靛夜',a:'#2a3a8a',b:'#0a0e26'},
    {n:'暗紫',a:'#3a2363',b:'#140a26'},
    {n:'玫紫',a:'#7a2363',b:'#260a20'},
    {n:'绯红',a:'#7a2230',b:'#220a10'},
    {n:'鎏金',a:'#8f6320',b:'#241803'},
    {n:'森绿',a:'#1f6b3a',b:'#08210f'},
    {n:'青潭',a:'#155e63',b:'#06201f'},
    {n:'墨黑',a:'#39414f',b:'#070a12'},
    /* —— 亮彩系(10-17·亮底·深色字) —— */
    {n:'晴空',a:'#c3e6ff',b:'#79b6ef',lt:1},
    {n:'薄荷',a:'#cdf6e4',b:'#76d6ad',lt:1},
    {n:'樱粉',a:'#ffdcea',b:'#f6a3c4',lt:1},
    {n:'鹅黄',a:'#fff1c4',b:'#f3d264',lt:1},
    {n:'藕荷',a:'#e8dfff',b:'#b6a3ef',lt:1},
    {n:'蜜桃',a:'#ffe0d1',b:'#f5ad8d',lt:1},
    {n:'嫩绿',a:'#e0f6c6',b:'#a7dc6f',lt:1},
    {n:'天青',a:'#d2f5f8',b:'#80d6df',lt:1},
    /* —— 纯净系(18-19·亮底·深色字) —— */
    {n:'纯白',a:'#ffffff',b:'#e7edf6',lt:1},
    {n:'奶白',a:'#fffaf2',b:'#efe2d0',lt:1},
    /* —— 梦幻/彩虹系(20-23·自定义渐变) —— */
    {n:'彩虹',g:'linear-gradient(135deg,#ff9ec7 0%,#ffc79a 24%,#ffec88 46%,#9bf2c4 65%,#9ad6ff 84%,#cdaaff 100%)',hl:'#ffec88',lt:1},
    {n:'极光',g:'radial-gradient(125% 105% at 50% 0%,#33dcae 0%,#1b7e91 44%,#241a54 100%)',hl:'#3ce6bc'},
    {n:'霓虹',g:'radial-gradient(125% 105% at 50% 0%,#ff3d9a 0%,#7a239a 44%,#140a2e 100%)',hl:'#ff5fb2'},
    {n:'晚霞',g:'linear-gradient(165deg,#ffd96e 0%,#ff8e5e 34%,#c8417c 68%,#3a1640 100%)',hl:'#ff9a6e'}
  ];

  function realmOf(i){return REALMS[Math.floor(i/6)]||REALMS[REALMS.length-1];}
  function hexA(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';}
  // 背景渲染: 有 g 用自定义渐变(彩虹/极光等), 否则用双色 radial
  function bgCss(b){return b&&b.g?b.g:('radial-gradient(135% 100% at 50% 0%,'+((b&&b.a)||'#2a3656')+','+((b&&b.b)||'#0b1120')+' 78%)');}
  function capCss(b){return b&&b.g?b.g:('radial-gradient(circle at 50% 35%,'+((b&&b.a)||'#2a3656')+','+((b&&b.b)||'#0b1120')+' 90%)');}
  function swCss(b){return b&&b.g?b.g:('linear-gradient(135deg,'+((b&&b.a)||'#2a3656')+','+((b&&b.b)||'#0b1120')+')');}
  function haloHex(b){return (b&&(b.hl||b.a))||'#2a3656';}
  function stages(){return window.PET_STAGES||[];}
  function N(){return stages().length;}
  function curStage(){try{return (typeof getPetStage==='function')?getPetStage():((window.S&&S.pet&&S.pet.stage)||0);}catch(e){return 0;}}
  function progress(){try{return (typeof getPetProgress==='function')?Math.round(getPetProgress()):0;}catch(e){return 0;}}
  function petName(){try{return globalPetName();}catch(e){return '星灵';}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function imgOf(i){var s=stages()[i];return s&&s.img?s.img:'';}
  function emOf(i){var s=stages()[i];return s&&s.emoji?s.emoji:'❓';}
  function nameOf(i){var s=stages()[i];return s&&s.name?s.name:('第'+(i+1)+'阶');}
  function descOf(i){var s=stages()[i];return s&&s.text?s.text:'';}
  /* 🔴v651 宠物彻底只用图: vis/updateHero/进化徽章 的图都加 onerror→hansenImgErr(重试3次+中性?)·删emoji兜底 */
  function vis(i,cls){var src=imgOf(i);if(!src)return '<span class="'+cls+'" style="display:flex;align-items:center;justify-content:center;color:#334155;font-weight:800;font-size:30px">?</span>';return '<img class="'+cls+'" src="'+src+'" alt="" onerror="window.hansenImgErr&&window.hansenImgErr(this)">';}

  // 每只宠物背景色记忆
  var BGKEY='hansen_pet_bg';
  function bgMap(){try{return JSON.parse(localStorage.getItem(BGKEY)||'{}')||{};}catch(e){return {};}}
  function getBgIdx(lvl){var v=bgMap()[lvl];return (typeof v==='number'&&v>=0&&v<BG.length)?v:0;}
  function setBgIdx(lvl,idx){var m=bgMap();m[lvl]=idx;try{localStorage.setItem(BGKEY,JSON.stringify(m));}catch(e){}}
  /* 🔴v672 主页展示宠物可自选:存已解锁某阶index·默认=当前阶·只在已解锁范围内有效(>当前阶则回落当前阶) */
  var HOMEKEY='hansen_pet_home_idx';
  function getHomeIdx(){try{var v=localStorage.getItem(HOMEKEY);if(v===null)return curStage();var i=parseInt(v,10);if(isNaN(i)||i<0)return curStage();return Math.min(i,curStage());}catch(e){return curStage();}}
  function setHomeIdx(i){try{localStorage.setItem(HOMEKEY,String(i));}catch(e){}}
  /* 🔴v675 主页展示锁: 锁住=固定展示homeIdx(钉死·升级不变); 解锁=自动跟随当前最高阶curStage(升级自动更新). 卡牌器/宠物页两处小锁头共用此状态. */
  var HOMELOCKKEY='hansen_pet_home_lock';
  function getHomeLock(){try{return localStorage.getItem(HOMELOCKKEY)==='1';}catch(e){return false;}}
  function setHomeLock(v){try{localStorage.setItem(HOMELOCKKEY,v?'1':'0');}catch(e){}}
  function showcaseStage(){try{var i=getHomeIdx();var cs=curStage();if(isNaN(i)||i<0)i=cs;if(i>cs)i=cs;return i;}catch(e){return curStage();}}/*🔴v786 主页展示阶=用户选定homeIdx(默认未设=当前最高阶·getHomeIdx在null时返回curStage)。解锁态升级时由updateHero把homeIdx推进到最新阶(实现"跟随升级")·锁定态homeIdx钉死不动。★原"getHomeLock()?getHomeIdx():curStage()"的解锁分支直接返回curStage·完全忽略用户选的homeIdx→点"设为主页展示"选某只·主页却永远显示最新阶=功能失效。现统一返回homeIdx·跟随由updateHero的新进化推进负责*/
  function _refreshShowcase(){try{var pc=document.getElementById('petContent');if(pc&&pc.querySelector('.psw'))renderShowcase();}catch(e){} try{updateHero();}catch(e){}}
  function toggleHomeLock(){ if(getHomeLock()){setHomeLock(false);try{if(typeof showToast==='function')showToast('🔓 已解锁 · 升级自动跟随当前宠物');}catch(e){}} else {var _lk=(typeof viewIdx==='number'&&viewIdx>=0&&viewIdx<=curStage())?viewIdx:showcaseStage();setHomeIdx(_lk);setHomeLock(true);try{if(typeof showToast==='function')showToast('🔒 已锁定 · 此宠物升级也不变');}catch(e){}} _refreshShowcase(); try{paintLock();}catch(e){} try{paintHomeBtn();}catch(e){} }/*🔴v786 锁=钉死【你正在卡牌器里看的那只 viewIdx】(升级不变)·解锁=跟随当前最高阶(升级跟随)。★原 setHomeIdx(showcaseStage()) 锁的是当前展示阶(解锁时=curStage)·不是你正在看的 viewIdx→看老阶点锁却锁住了最新阶=锁错宠物。现锁 viewIdx。🔴BUG#95 加toast明确反馈*/
  /* 🔴v745(Hansen): 宠物屏左右箭头【只浏览·绝不锁定/固定展示】。scBrowse=临时浏览阶(null=跟随home展示)·_scKeepBrowse=本次渲染保留浏览态(仅箭头触发为true·其它渲染[导航/升级/锁变化]默认重置回home展示→返回后回到"设为主页/锁头"的宠物)。绝不写 homeIdx/homeLock。 */
  var scBrowse=null, _scKeepBrowse=false;
  function scStep(d){ var base=(scBrowse!==null)?scBrowse:showcaseStage(); var cs=curStage(); var i=base+d; if(i<0)i=0; if(i>cs)i=cs; scBrowse=i; _scKeepBrowse=true; renderShowcase(); }/*🔴BUG#101 v745 箭头只浏览不锁定: 原 homeStep 一翻就 setHomeIdx+setHomeLock(true) 把展示固定锁死·Hansen明确左右箭头只能浏览宠物·无任何锁定功能·锁定只能靠锁头(toggleHomeLock·最高优先)或设为主页(setHomeIdx不锁·跟随升级)。scStep 只改临时浏览阶·绝不碰 home/lock */

  // ===== 🔴v643/v644 全局统一宠物系统 + 掌握制升级 =====
  // Hansen要求: 所有19岛共用一只宠物; 满级=把全部单词都"掌握"(学会+练熟)+一定练习; 强留存。
  // 🔴v644/v946 双门槛(取较低者·缺一不可): ①掌握单词数(每词在打字大师中无提示、整词精确拼写≥MASTER_HITS次；其它题型不写 mc；满级=掌握全部TOTAL_WORDS词) ②累计经验(各玩法仍可正常累计)。
  var HSN_ISLAND_KEYS=(window.HansenCanonical&&HansenCanonical.allSaveAliases)?HansenCanonical.allSaveAliases():['wordIslandVerbs','wordIslandAdj','wordIslandAnimal','wordIslandBody','wordIslandCity','wordIslandClothes','wordIslandColorNum','wordIslandFamily','wordIslandFood','wordIslandHouse','wordIslandPeople','wordIslandNature','wordIslandPronouns','wordIslandSchool','wordIslandSeason','wordIslandSports','wordIslandTime','wordIslandTransport','wordIslandMisc','wordIslandLand1','wordIslandLand2','wordIslandLand3','wordIslandLand4','wordIslandLand5','wordIslandLand6','wordIslandLand7','wordIslandLand8'];
  var PET_XP_CAP=15000; // 旋钮①: 满级所需累计经验(练习量·想留存更久调大如20000~25000)
  var MASTER_HITS=3;    // 掌握门槛: 同词在打字大师中无提示、整词精确拼写 3 次
  var TOTAL_WORDS=(window.HansenCanonical&&HansenCanonical.TOTAL_WORDS)||952;  // 712 常规 + 240 星海；Land 是星海切片，不重复算
  /* 🔴🔴 v938 根因修复 (Hansen: "为什么宠物不进化? 感觉宠物好像没有得到经验和进化")
   ★ 原来这两个函数只累加【手写死的 HSN_ISLAND_KEYS 名单】里的 19 个岛。
     但全库现在有 27 个岛 —— 后加的 8 个星域岛(island_land1~8, 存档键 wordIslandLand1~8)
     【从来没被加进这份名单】。结果:
       你在【星海觉醒】(= 主力新内容)里打的每一点经验, 宠物系统【根本看不见】,
       globalXP() 永远算成 0 → 宠物永远卡在第 1 阶 → 永不进化。
     (真机实测: 打 5 把火眼金睛拿到 305 经验, getPetStage() 依然返回 0。)
   ★ 又是同一个病: 加了新东西(8个岛), 却没更新它的【使用方名单】。
   ★ 所以这次不修名单 —— 改成【动态扫描 localStorage 里所有岛存档】,
     以后再加多少个岛都自动算进去, 这个 bug 不可能再犯。
     (排除 _bak 备份键和非岛存档, 避免重复计数。) */
/* 🔴 v938 (Hansen: "为什么宠物不进化?")
   ★ 原来 globalXP/globalMastered 只累加【手写死的 HSN_ISLAND_KEYS 名单】里的 19 个岛,
     而全库有 27 个 —— 后加的 8 个星域岛(island_land1~8 = 星海觉醒)从来没进过名单。
     结果: 在星海觉醒里打的每一点经验, 宠物系统根本看不见 → globalXP() 永远算 0 → 宠物永不进化。
     (真机: 打5把火眼金睛拿到305经验, getPetStage() 依然返回 0。)
     → 改成【动态扫描全部 wordIsland* 存档】, 以后再加多少岛都自动算进去。

   ★★ 但第一版动态扫描【把加载拖慢了 350ms】(perf_guard 当场拦下, 不是我自己发现的):
      一次渲染里 gStageFromXP/gProgress/curStage/progress 会反复调 globalXP+globalMastered 六七次,
      每次都把 27 个岛的存档【全部 JSON.parse 一遍】—— 存档里有 learned/wrongs/stats, 一点都不小。
      island_season 首屏从 2506ms 涨到 2853ms。
   ★★ 修法(既对又快): 【别的岛的存档在本页打开期间根本不会变】—— 只扫一次, 把两个总和缓存起来;
      当前岛永远读内存里的 S(零解析、永远最新)。之后每次调用都是 O(1)。
      (另开标签页改了别的岛 → storage 事件把缓存作废, 不会读到脏数据。) */
var _hsnOtherXP = null, _hsnOtherM = null;
function _hsnScanOthers(){
  var xp=0, m=0, cur=null;
  try{ cur = window.__hsnSaveKey || null; }catch(e){}
  try{
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(!k || k.indexOf('wordIsland')!==0) continue;
      if(/_bak$|_backup$|_tmp$/i.test(k)) continue;   /* 备份键不算, 否则重复计数 */
      if(cur && k===cur) continue;                    /* 当前岛不读盘, 用内存 S */
      var raw=localStorage.getItem(k);
      if(!raw) continue;
      var o=null;
      try{ o=JSON.parse(raw); }catch(e){ continue; }
      if(!o || typeof o!=='object' || Array.isArray(o)) continue;
      if(o.totalXP===undefined && o.xp===undefined && o.learned===undefined) continue;
      var ox=Number(o.xp),ot=Number(o.totalXP);ox=isFinite(ox)&&ox>0?ox:0;ot=isFinite(ot)&&ot>0?ot:0;
      xp=Math.min(1000000000,xp+Math.min(1000000000,Math.floor(Math.max(ox,ot))));
      if(o.mc&&typeof o.mc==='object')Object.keys(o.mc).forEach(function(ix){if((+o.mc[ix]||0)>=MASTER_HITS)m++;});
    }
  }catch(e){}
  _hsnOtherXP = xp; _hsnOtherM = m;
}
try{ window.addEventListener('storage', function(){ _hsnOtherXP=null; _hsnOtherM=null; }); }catch(e){}
function globalXP(){
  // v942 人物与宠物共读同一个全局累计经验钱包。岛 totalXP 只作旧版迁移来源，
  // 不再作为运行时权威；这样岛 save quota 失败也不会出现“人物涨了、宠物没涨”。
  try{var n=Number(localStorage.getItem('hansen_wallet_charxp'));if(isFinite(n)&&n>=0)return Math.min(1000000000,Math.floor(n));}catch(e){}
  if(_hsnOtherXP===null)_hsnScanOthers();var mine=0;
  try{if(window.S){var a=Number(window.S.xp),b=Number(window.S.totalXP);mine=Math.max(isFinite(a)?a:0,isFinite(b)?b:0);}}catch(e){}
  return Math.min(1000000000,_hsnOtherXP+mine);
}
function globalMastered(){
  // v941 权威槽位：Land1~8 与 Season 共用 240 个 slot，掌握度按 mc>=3 去重。
  try{
    if(window.HansenCanonical){
      HansenCanonical.absorbCurrent();
      return HansenCanonical.totalMastered(MASTER_HITS);
    }
  }catch(e){}
  if(_hsnOtherM===null) _hsnScanOthers();
  var mine=0;
  try{ if(window.S&&window.S.mc)Object.keys(window.S.mc).forEach(function(k){if((+window.S.mc[k]||0)>=MASTER_HITS)mine++;}); }catch(e){}
  return _hsnOtherM + mine;
}
  // 全局已掌握单词数 = 各岛 mc[idx]>=MASTER_HITS 的词数之和；mc 只由一次性 pet proof 认可的打字大师精确拼写累加。
  
  // 经验门槛(较缓^1.8·前期驱动·秒孵化) + 掌握门槛(后置^2.5·中后期卡关·满级=全部词)
  function xpReq(i){var n=N()-1;if(i<=0)return 0;if(i>=n)return PET_XP_CAP;return Math.round(PET_XP_CAP*Math.pow(i/n,1.8)/5)*5;}
  function masterReq(i){var n=N()-1;if(i<=0)return 0;if(i>=n)return TOTAL_WORDS;return Math.round(TOTAL_WORDS*Math.pow(i/n,2.5));}
  // 阶段=两门槛都满足的最高阶(取较低者=瓶颈卡关)
  function gStageFromXP(){var m=globalMastered(),x=globalXP(),n=N(),st=0;for(var i=1;i<n;i++){if(x>=xpReq(i)&&m>=masterReq(i))st=i;else break;}return st;}
  function gProgress(){var st=gStageFromXP(),n=N();if(st>=n-1)return 100;var m=globalMastered(),x=globalXP();var mLo=masterReq(st),mHi=masterReq(st+1),xLo=xpReq(st),xHi=xpReq(st+1);var mp=mHi>mLo?(m-mLo)/(mHi-mLo):1,xp2=xHi>xLo?(x-xLo)/(xHi-xLo):1;return Math.max(0,Math.min(100,Math.round(Math.min(mp,xp2)*100)));}
  // v945 给探索页一个统一、只读的进化说明源。UI 不再复制门槛公式，避免以后
  // 调平衡参数后“还差几个词”的提示与宠物实际升级条件分叉。
  function progressSnapshot(){
    var count=N(),mastered=globalMastered(),xp=globalXP(),stage=0;
    for(var i=1;i<count;i++){if(xp>=xpReq(i)&&mastered>=masterReq(i))stage=i;else break;}
    var maxed=count>0&&stage>=count-1;
    var next= maxed ? stage : stage+1;
    var needWords=masterReq(next),needXP=xpReq(next);
    var pct=100;
    if(!maxed&&count>0){
      var mLo=masterReq(stage),xLo=xpReq(stage),mp=needWords>mLo?(mastered-mLo)/(needWords-mLo):1,xp2=needXP>xLo?(xp-xLo)/(needXP-xLo):1;
      pct=Math.max(0,Math.min(100,Math.round(Math.min(mp,xp2)*100)));
    }
    return {
      ok:count>0,stageIndex:stage,stageNumber:stage+1,totalStages:count,
      stageName:nameOf(stage),nextStageIndex:maxed?null:next,nextStageName:maxed?null:nameOf(next),maxed:maxed,
      mastered:mastered,masterHits:MASTER_HITS,nextMasterReq:needWords,remainingWords:Math.max(0,needWords-mastered),
      xp:xp,nextXpReq:needXP,remainingXP:Math.max(0,needXP-xp),progress:pct,totalWords:TOTAL_WORDS
    };
  }
  // 覆盖全局阶段/进度→模块渲染(curStage/progress)与各岛据此·全岛同一只宠物
  try{ window.getPetStage=gStageFromXP; window.getPetProgress=gProgress; }catch(e){}

/* 🔴 v938 (Hansen: "我玩完一个火眼金睛得到的宠物经验, 然后我们看宠物的时候, 能及时看到宠物增加的经验")
   原来: 得到经验后【没有任何东西去刷新宠物页】。宠物页如果开着, 数字纹丝不动;
         就算退出去重进, 首页的宠物条也不一定更新 —— 用户完全感觉不到"宠物在长"。
   现在: 把 addXP 包一层 —— 只要经验有变化, 就【立刻】重画首页宠物条 + (若宠物页开着)重画宠物页,
         并在宠物页顶上飘一个 "+N 经验" 的提示, 让人一眼看到涨了多少。 */
(function(){
  function petScreenOpen(){
    var el=document.getElementById('petScreen');
    return !!(el && (el.classList.contains('active') || getComputedStyle(el).display!=='none'));
  }
  function refreshPetUI(gain){
    try{ if(typeof window.updatePetHero==='function') window.updatePetHero(); }catch(e){}
    if(!petScreenOpen()) return;
    try{ if(typeof window.renderPetScreen==='function') window.renderPetScreen(); }catch(e){}
    if(gain>0){
      try{
        var t=document.createElement('div');
        t.className='psw-gain';
        t.textContent='\ud83d\udc3e \u5ba0\u7269\u7ecf\u9a8c +'+gain;
        var host=document.getElementById('petScreen')||document.body;
        host.appendChild(t);
        setTimeout(function(){ try{ t.parentNode && t.parentNode.removeChild(t); }catch(e){} }, 1800);
      }catch(e){}
    }
  }
  window.__hsnRefreshPetUI = refreshPetUI;

  /* v938: 原来这里还 hook 了 window.addXP —— 多余而且有害:
     游戏里的 addXP 是同一脚本内的函数声明, 改 window.addXP 根本拦不住它(实测拦不到),
     反而把外部对 window.addXP 的调用包坏了。刷新改成在 petTaskComplete 里【直接调】, 确定性最高。 */
})();
  // 🔴v946 掌握度统计: mc 不再接受通用选择题的 markAnswer。
  // 只有打字大师对一个词完成“无提示、整词精确拼写”后，由
  // HansenSpellingProgressV946.run('pet', ...) 在同一个同步调用链中签发一次性证明。
  // 历史 mc 原样保留；普通模式的金币、错题、统计仍由原 markAnswer 正常处理。
  var _hsnMarkWrapped=false; // 模块级·保证只包裹一次(可靠·不依赖函数属性)
  function hsnTrackMastery(){
    try{
      if(!_hsnMarkWrapped && typeof window.markAnswer==='function'){
        var _orig=window.markAnswer;
        window.markAnswer=function(idx,correct){
          var proof=null;
          try{
            if(correct && (+idx)>=0 && window.HansenSpellingProgressV946 &&
               typeof HansenSpellingProgressV946.consume==='function'){
              proof=HansenSpellingProgressV946.consume('pet',+idx);
            }
          }catch(e){proof=null;}
          var masteryResult=null;
          try{
            if(proof && window.S){
              if(!S.mc||typeof S.mc!=='object')S.mc={};
              S.mc[idx]=(+S.mc[idx]||0)+1;
              masteryResult={ok:true,changed:true,mastery:S.mc[idx]};
            }
          }catch(e){}
          var result=_orig.apply(this,arguments);
          try{
            if(proof && window.HansenSpellingProgressV946 && typeof HansenSpellingProgressV946.settle==='function'){
              HansenSpellingProgressV946.settle(proof,masteryResult||{ok:false,changed:false,reason:'mastery-write-failed'});
            }
          }catch(e){}
          return result;
        };
        window.markAnswer.__hsnMc=true;
        _hsnMarkWrapped=true;
      }
    }catch(e){}
    // 迁移(逐存档一次): 已学会(learned)且当前无错账(wrongs)的词→视为已掌握。
    // v941 只有一个全局 flag，flag 写入后才恢复的老备份永远漏迁；v942 把标记写进每份存档。
    try{
      var keys=[];for(var i=0;i<localStorage.length;i++){var kk=localStorage.key(i);if(kk&&/^wordIsland/.test(kk)&&!/_tmp$|_backup$/i.test(kk))keys.push(kk);}
      for(var i=0;i<keys.length;i++){
        try{
          var k=keys[i],raw=localStorage.getItem(k);if(!raw)continue;
          var s=JSON.parse(raw);if(!s||typeof s!=='object'||s._hsnMasteryV942===1)continue;
          if(!s.mc||typeof s.mc!=='object')s.mc={};
          var learned=Array.isArray(s.learned)?s.learned:[],wrongs=(s.wrongs&&typeof s.wrongs==='object')?s.wrongs:{};
          for(var j=0;j<learned.length;j++){var idx=learned[j],w=(+wrongs[idx]||0),seed=Math.max(0,MASTER_HITS-w);if((+s.mc[idx]||0)<seed)s.mc[idx]=seed;}
          s._hsnMasteryV942=1;localStorage.setItem(k,JSON.stringify(s));
        }catch(e){}
      }
      // 当前岛内存也要带标记，否则下一次 save 会覆盖刚迁移的主存档。
      try{
        if(window.S&&S._hsnMasteryV942!==1){
          if(!S.mc||typeof S.mc!=='object')S.mc={};
          var Lw=Array.isArray(S.learned)?S.learned:[],Ww=(S.wrongs&&typeof S.wrongs==='object')?S.wrongs:{};
          for(var a=0;a<Lw.length;a++){var ix=Lw[a],ww=(+Ww[ix]||0),sd=Math.max(0,MASTER_HITS-ww);if((+S.mc[ix]||0)<sd)S.mc[ix]=sd;}
          S._hsnMasteryV942=1;if(typeof save==='function')save();
        }
      }catch(e){}
      try{if(window.HansenCanonical){HansenCanonical.migrate();HansenCanonical.syncCurrent();}}catch(e){}
      localStorage.setItem('hansen_mastery_migrated_v942','1');
    }catch(e){}
  }
  // 全局宠物名(原各岛独立 S.pet.name→统一到一个key·全岛同名)
  var PETNAMEKEY='hansen_pet_name';
  function safePetName(value){
    if(typeof value!=='string')return '';
    var name=value.trim();if(!name||/[<>\u0000-\u001f\u007f]/.test(name)||name==='[object Object]')return '';
    return Array.from(name).slice(0,8).join('');
  }
  function globalPetName(){
    try{var g=safePetName(localStorage.getItem(PETNAMEKEY));if(g)return g;}catch(e){}
    var nm='';try{nm=safePetName(window.S&&S.pet&&S.pet.name);}catch(e){}
    if(nm==='小蛋'||!nm)nm='星灵';
    try{localStorage.setItem(PETNAMEKEY,nm);}catch(e){}
    return nm;
  }
  function setGlobalPetName(nn){nn=safePetName(nn)||'星灵';try{localStorage.setItem(PETNAMEKEY,nn);}catch(e){} try{if(window.S&&S.pet){S.pet.name=nn;if(typeof save==='function')save();}}catch(e){}}

  // ---------- CSS ----------
  function injectCSS(){
    if(document.getElementById('hsn-pet-css'))return;
    var st=document.createElement('style'); st.id='hsn-pet-css';
    st.textContent=[
'#petContent .psw{--g1:#fbbf24;--g2:#f59e0b;--ink:#eef2f7;--ink2:#b3bed4;--ink3:#7e8aa6;--lock:#3a4665;padding:2px 0 18px;margin-top:-20px;font-family:"PingFang SC","Microsoft YaHei","HarmonyOS Sans SC","MiSans","Source Han Sans SC","Noto Sans SC","Heiti SC",sans-serif}',
'#petContent .psw,#petContent .psw *{text-shadow:none}',
'.psw-hero .nm,.psw-hero .sg,.psw-hero .qt{text-shadow:0 1px 5px rgba(0,0,0,.6)}',
'.psw-node .lb .nm,.psw-node .lb .st{text-shadow:0 1px 3px rgba(0,0,0,.55)}',
'#petContent .psw-sub{font-size:12.5px;color:var(--ink2);margin:0 2px 8px;line-height:1.5;text-align:center}',
'#petContent .psw-sub b{color:var(--g1)}',
'.psw-hero{position:relative;border-radius:22px;padding:16px 16px 16px;margin:0 2px 8px;text-align:center;overflow:hidden;border:1px solid rgba(255,255,255,.13);box-shadow:0 12px 30px rgba(0,0,0,.5)}',
'.psw-hero .nb{position:absolute;top:11px;left:11px;font-size:11px;font-weight:800;letter-spacing:1px;color:#0b1020;background:linear-gradient(95deg,var(--g1),var(--g2));padding:3px 10px;border-radius:999px}',
'.psw-hero .rt{position:absolute;top:11px;right:11px;font-size:10.5px;font-weight:800;color:#fff;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.2);padding:3px 10px;border-radius:999px}',
'.psw-petbox{position:relative;width:100%;height:262px;margin:4px auto 0;display:grid;place-items:center}',
'.psw-pethalo{position:absolute;width:300px;height:232px;top:8px;left:50%;transform:translateX(-50%);border-radius:50%;filter:blur(5px);z-index:0}',
'.psw-petbox img{width:252px;height:252px;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(0 16px 24px rgba(0,0,0,.5))}',
'.psw-petbox .em{font-size:182px;position:relative;z-index:2;filter:drop-shadow(0 14px 22px rgba(0,0,0,.5))}',
'.psw-ped{position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:190px;height:26px;border-radius:50%;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.26),transparent 70%);filter:blur(1px);z-index:1}',
'.psw-hero .nm{font-size:21px;font-weight:900;color:#fff;margin-top:6px}',
'.psw-hero .sg{font-size:13px;color:var(--g1);font-weight:700;margin-top:2px}',
'.psw-hero .qt{font-size:12.5px;color:var(--ink2);font-style:italic;margin:9px 8px 13px;line-height:1.55}',
'.psw-bar{height:9px;border-radius:6px;background:rgba(8,12,24,.7);overflow:hidden;margin:0 2px;border:1px solid rgba(96,118,170,.25)}.psw-req{margin:10px 0 4px;display:flex;flex-direction:column;gap:6px}.psw-req-row{display:flex;align-items:center;gap:8px;font-size:13px;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}.psw-req-row>span{flex:0 0 auto;opacity:.9}.psw-req-row>b{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:800}.psw-req-row>i{flex:0 0 auto;font-style:normal;font-size:12px;opacity:.85;min-width:62px;text-align:right}.psw-req-slow{background:rgba(251,191,36,.14);border-color:rgba(251,191,36,.45)}.psw-req-tip{font-size:12px;opacity:.85;padding:2px 2px 0;line-height:1.5}.psw-gain{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:99999;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a1206;font-weight:900;font-size:16px;padding:10px 18px;border-radius:999px;box-shadow:0 8px 24px rgba(251,191,36,.45);animation:pswGain 1.8s ease forwards;pointer-events:none}@keyframes pswGain{0%{opacity:0;transform:translate(-50%,10px) scale(.9)}15%{opacity:1;transform:translate(-50%,0) scale(1.06)}30%{transform:translate(-50%,0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px)}}',
'.psw-bar > i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--g1),var(--g2));box-shadow:0 0 11px rgba(251,191,36,.5)}',
'.psw-barlab{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink2);margin:0 2px 6px}',
'.psw-barlab b{color:#fff}',
'.psw-th{display:flex;align-items:center;gap:8px;margin:22px 2px 2px}',
'.psw-th .ln{flex:1;height:1px;background:linear-gradient(90deg,rgba(251,191,36,0),rgba(251,191,36,.5),rgba(251,191,36,0))}',
'.psw-th span{font-size:13px;font-weight:800;color:var(--g1);letter-spacing:1px;white-space:nowrap}',
'.psw-trail{position:relative;padding:6px 0 4px}',
'.psw-trail::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:3px;transform:translateX(-50%);background:linear-gradient(180deg,rgba(96,118,170,.18),rgba(96,118,170,.3));border-radius:2px}',
'.psw-lit{position:absolute;top:0;left:50%;width:3px;transform:translateX(-50%);background:linear-gradient(180deg,var(--g1),var(--g2));border-radius:2px;box-shadow:0 0 11px rgba(251,191,36,.5);transition:height .6s ease;z-index:1}',
'.psw-rd{position:relative;z-index:4;display:flex;align-items:center;gap:11px;margin:22px 2px 12px;padding:9px 14px;border-radius:14px;border:1px solid;box-shadow:0 4px 14px rgba(0,0,0,.3)}',
'.psw-rd .rn{flex:none;font-size:12px;font-weight:900;color:#0b1020;padding:4px 10px;border-radius:999px;white-space:nowrap}',
'.psw-rd .rnm{font-size:15px;font-weight:900;color:#fff}',
'.psw-rd .rsb{font-size:10.5px;color:var(--ink2);margin-top:1px}',
'.psw-node{position:relative;display:flex;align-items:center;min-height:84px;z-index:2}',
'.psw-node .sd{width:50%;display:flex;align-items:center;gap:10px}',
'.psw-node.l .sd{justify-content:flex-end;padding-right:26px}',
'.psw-node.r{flex-direction:row-reverse}',
'.psw-node.r .sd{justify-content:flex-end;padding-right:26px}',
'.psw-node .dot{position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);background:var(--lock);border:2px solid #0d1426;z-index:3}',
'.psw-node.on .dot{background:linear-gradient(95deg,var(--g1),var(--g2));box-shadow:0 0 10px rgba(251,191,36,.7)}',
'.psw-node .lb{font-size:12px;line-height:1.25;max-width:116px}',
'.psw-node.l .lb{text-align:right}',
'.psw-node .lb .nm{font-weight:800;color:var(--ink)}',
'.psw-node .lb .st{color:var(--ink3);font-size:10.5px}',
'.psw-cap{width:62px;height:62px;border-radius:50%;flex:none;display:grid;place-items:center;cursor:pointer;position:relative;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.08),rgba(255,255,255,0) 60%),rgba(18,26,46,.9);border:2px solid rgba(96,118,170,.28);transition:transform .18s ease,box-shadow .25s,border-color .25s}',
'.psw-cap img{width:46px;height:46px;object-fit:contain}',
'.psw-cap .em{font-size:31px}',
'.psw-cap:active{transform:scale(.93)}',
'.psw-node.uk .psw-cap{border-color:rgba(251,191,36,.55);box-shadow:0 4px 15px rgba(0,0,0,.4),0 0 13px rgba(251,191,36,.18)}',
'.psw-node.cur .psw-cap{border-color:var(--g1);box-shadow:0 0 0 3px rgba(251,191,36,.28),0 0 24px rgba(251,191,36,.5);animation:pswPulse 2.6s ease-in-out infinite}',
'@keyframes pswPulse{0%,100%{box-shadow:0 0 0 3px rgba(251,191,36,.22),0 0 18px rgba(251,191,36,.4)}50%{box-shadow:0 0 0 5px rgba(251,191,36,.3),0 0 30px rgba(251,191,36,.6)}}',
'.psw-node.lk .psw-cap{cursor:default;border-color:rgba(96,118,170,.16)}',
'.psw-node.lk .psw-cap:active{transform:none}',
'.psw-cap .qm{font-size:25px;font-weight:900;color:#39435f}',
'.psw-node.lk .lb .nm{color:var(--ink3)}',
'.psw-cap .now{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:800;color:#0b1020;background:linear-gradient(95deg,var(--g1),var(--g2));padding:1px 7px;border-radius:999px;white-space:nowrap}',
'.psw-cap .lkk{position:absolute;right:-3px;bottom:-3px;font-size:13px;filter:drop-shadow(0 1px 2px #000)}',
/* ---------- 卡牌式展示器 overlay ---------- */
'.pcv{position:fixed;inset:0;z-index:9000;display:none;flex-direction:column;background:rgba(4,6,12,.84);opacity:0;transition:opacity .26s ease;font-family:"PingFang SC","Microsoft YaHei","HarmonyOS Sans SC","MiSans","Source Han Sans SC","Noto Sans SC","Heiti SC",sans-serif}',
'.pcv.open{display:flex;opacity:1}',
'.pcv-top{display:flex;justify-content:flex-end;padding:14px 16px 6px}',
'.pcv-x{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:18px;color:#fff;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);cursor:pointer}',
'.pcv-wrap{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:0 16px 16px}',
'.pcv-card{flex-shrink:0;width:100%;max-width:376px;border-radius:24px;padding:18px 16px 22px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 46px rgba(0,0,0,.55);transition:background .45s ease}',/*🔴BUG#82 v674 卡片flex-shrink:0(矮屏不被压缩):卡牌器卡片是pcv-wrap的flex子项·默认flex-shrink:1·矮屏(腾讯webapp顶栏吃高度)下卡片被压缩到比内容矮+overflow:hidden→裁掉底部宠物名/描述/状态(v672放大宠物后内容更高·该裁切暴露=Hansen截图星雾之卵被裁)。修:flex-shrink:0令卡片恒为内容满高·改由pcv-wrap滚动·文字永不被裁。铁律#0.3:改尺寸/位置必跑hansen_overflow_audit.py验文字不被挤出框/裁切*/
'.pcv-card::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.3px 1.3px at 18% 16%,#fff,transparent),radial-gradient(1.1px 1.1px at 74% 12%,#fff9,transparent),radial-gradient(1.4px 1.4px at 40% 64%,#fff6,transparent),radial-gradient(1.1px 1.1px at 86% 56%,#fffa,transparent),radial-gradient(1.2px 1.2px at 62% 86%,#fff7,transparent);opacity:.45}',
'.pcv-realm{position:absolute;top:14px;left:14px;z-index:2;font-size:11.5px;font-weight:800;letter-spacing:1px;color:#fff;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.22);padding:4px 11px;border-radius:999px}',
'.pcv-pos{position:absolute;top:14px;right:14px;z-index:2;font-size:11.5px;font-weight:700;color:rgba(255,255,255,.85)}',
'.pcv-pet{position:relative;z-index:2;width:min(344px,100%);aspect-ratio:1;margin:6px auto 0;display:grid;place-items:center}',/*🔴v641 🔴v642 卡牌器宠物放大填框(对全部36只统一·共享类·PNG均512²归一化93%长边→长边渲染一致):框→min(322px,84vw)接近卡片宽极限+图100%+顶距6px*/
'.pcv-halo{position:absolute;inset:0;border-radius:50%;filter:blur(2px);transition:background .45s}',
'.pcv-pet img{width:100%;height:100%;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(0 15px 24px rgba(0,0,0,.5))}',
'.pcv-pet .em{font-size:170px;position:relative;z-index:2;filter:drop-shadow(0 15px 24px rgba(0,0,0,.5))}',
'.pcv-pet.lk img,.pcv-pet.lk .em{filter:grayscale(1) brightness(.3) drop-shadow(0 15px 20px rgba(0,0,0,.6))}',
'.pcv-ped{position:relative;z-index:1;width:246px;height:30px;margin:-16px auto 0;border-radius:50%;background:radial-gradient(ellipse at 50% 35%,rgba(255,255,255,.3),rgba(255,255,255,0) 70%);filter:blur(1px)}',
'.pcv-name{position:relative;z-index:2;text-align:center;font-size:27px;font-weight:900;color:#fff;margin-top:8px;text-shadow:0 2px 10px rgba(0,0,0,.55)}',
'.pcv-name.lk{color:rgba(255,255,255,.55)}',
'.pcv-desc{position:relative;z-index:2;text-align:center;font-size:13.5px;color:rgba(255,255,255,.9);margin:9px 10px 0;line-height:1.55;text-shadow:0 1px 5px rgba(0,0,0,.6);min-height:40px}',
'.pcv-status{position:relative;z-index:2;text-align:center;margin:12px auto 0;font-size:12.5px;color:#fff;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.2);border-radius:11px;padding:8px 13px;max-width:280px;line-height:1.5}',
'.pcv-status .k{color:#fde68a;font-weight:800}',
'.pcv-home{flex-shrink:0;margin:15px auto 0;display:block;min-width:200px;height:44px;border-radius:13px;cursor:pointer;font-size:14px;font-weight:800;color:#0b1020;background:linear-gradient(95deg,#fbbf24,#f59e0b);border:none;box-shadow:0 4px 14px rgba(251,191,36,.35)}',
'.pcv-home:active{transform:scale(.96)}',
'.pcv-home.on{color:#cbd5e1;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);box-shadow:none;cursor:default}',
'.pcv-bglab{margin:16px 0 7px;font-size:12px;color:#cbd5e1;font-weight:700;text-align:center}',
'.pcv-sw{flex-shrink:0;display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:340px}',
'.pcv-sw .s{width:32px;height:32px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,.25);box-shadow:0 2px 8px rgba(0,0,0,.4);transition:transform .15s,border-color .2s}',
'.pcv-sw .s:active{transform:scale(.9)}',
'.pcv-sw .s.sel{border-color:#fff;box-shadow:0 0 0 2px rgba(251,191,36,.7),0 2px 8px rgba(0,0,0,.4)}',
'.pcv-nav{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:13px;width:100%;max-width:360px;margin:18px auto 4px}',
'.pcv-nav button{flex:1;height:46px;border-radius:13px;cursor:pointer;font-size:15px;font-weight:800;color:#fff;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.24)}',
'.pcv-nav button:active{transform:scale(.96)}',
'.pcv-nav button:disabled{opacity:.32}',
'.pcv-nav .md{flex:none;font-size:12px;color:rgba(255,255,255,.75);font-weight:700;min-width:54px;text-align:center}',
/* 🔴v675 宠物页 hero: 名字左侧锁 + 给宠物改名两侧左右切换箭头 + 非当前阶状态行 */
'.psw-nmrow{position:relative;display:flex;align-items:center;justify-content:center;margin-top:6px;min-height:34px}',
'.psw-nmrow .nm{margin-top:0}',
'.psw-dispst{margin:8px auto 2px;font-size:14px;color:#cfe3ff;font-weight:600}',
'.psw-actions{margin-top:13px;display:flex;align-items:center;justify-content:center;gap:10px}',
'.psw-arw{flex-shrink:0;width:46px;height:46px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:22px;font-weight:800;cursor:pointer;display:grid;place-items:center;padding:0;line-height:1}',
'.psw-arw:active{transform:scale(.94)}',
'.psw-arw:disabled{opacity:.32;cursor:default}',
'.psw-hero.lt .psw-arw{background:rgba(0,0,0,.08);border-color:rgba(0,0,0,.22);color:#1b2440}',
'.psw-hero.lt .psw-dispst{color:#46506e}',
/* 🔴v675 卡牌器: 设为主页展示 + 锁 一行(锁在右边) */
'.pcv-homerow{display:flex;align-items:center;justify-content:center;gap:10px;flex-shrink:0;margin:15px auto 0}',
'.pcv-homerow .pcv-home{margin:0}',
'.pcv-lk{flex-shrink:0;width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);color:#fff;font-size:19px;cursor:pointer;display:grid;place-items:center;padding:0;line-height:1}',
'.pcv-lk:active{transform:scale(.95)}',
'.pcv-lk.on{background:linear-gradient(135deg,#fbbf24,#f59e0b);border-color:#fbbf24;color:#0b1020}',
'#heroPet img{width:100%;height:100%;object-fit:contain;display:block}',
/* —— 🔴v882(Hansen: 新岛宠物图网速慢时加载不出来·空白框): 宠物图加载占位骨架屏。图未到/加载中→显示脉动圆(shimmer)·不再是空白框; 图 onload 盖住骨架·onerror 走 hansenImgErr 换中性图也盖住。#heroPet:empty(没img)或 img 未加载完(用.pet-slot状态) 时显示。 —— */
'.pet-slot{position:relative}',
/* 骨架: heroPet 为空(还没注入img)时·pet-slot 显示脉动圆占位 */
/* pet-slot 默认显脉动圆骨架(::after)·图片onload/onerror后加.pet-ready隐藏骨架。覆盖"img已注入但网速慢未下完"的空白期。 */
'.pet-slot::after{content:"";position:absolute;left:50%;top:50%;width:62px;height:62px;transform:translate(-50%,-50%);border-radius:50%;background:linear-gradient(110deg,rgba(148,163,184,.14) 30%,rgba(203,213,225,.34) 50%,rgba(148,163,184,.14) 70%);background-size:200% 100%;animation:hsnPetSkeleton 1.15s ease-in-out infinite;pointer-events:none;z-index:0}',
'.pet-slot.pet-ready::after{display:none}',
'.pet-slot #heroPet{position:relative;z-index:1}',
'@keyframes hsnPetSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}',
/* —— 🔴v639 首页宠物图标: ①去掉背后圆形半透明背景(各岛 .pet-slot 的金色radial圆) ②上下晃动放到非常慢(2.5s→14s·约5.6倍慢)且幅度减小(-6px→-4px)·仅translateY不旋转(守防晕红线) —— */
'.pet-slot{background:none !important}',
'@keyframes hsnPetFloatSlow{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
/* v1165 待机预算：宠物轻轻上下晃 3 下就停（14 秒一下，约 42 秒），不再整晚一直动 */
'#heroPet{animation:hsnPetFloatSlow 14s ease-in-out 3 !important}',
/* —— 🔴v638 首页宠物卡名/阶/描述: 强制纯中文字体栈(覆盖各岛 --font-cartoon=CartoonBlack日系装饰字体·缺尊/寰等生僻汉字→那些字逐字回退到别的字体致大小参差)·全字符同一中文字体=统一 —— */
'#heroPetName,#heroPetStage,#heroPetText{font-family:"PingFang SC","Microsoft YaHei","HarmonyOS Sans SC","MiSans","Source Han Sans SC","Noto Sans SC","Heiti SC",sans-serif !important}',
/* —— 亮底/彩虹背景(BG lt:1): 浮在卡面上的纯色文字自动转深色保可读(自带深色衬底的境标/状态/徽章不动) —— */
'.pcv-card.lt .pcv-name{color:#1b2440;text-shadow:0 1px 2px rgba(255,255,255,.55)}',
'.pcv-card.lt .pcv-desc{color:#36405e;text-shadow:0 1px 2px rgba(255,255,255,.5)}',
'.pcv-card.lt .pcv-pos{color:#36405e}',
'.pcv-card.lt::after{opacity:.16}',
'.psw-hero.lt .nm{color:#1b2440}',
'.psw-hero.lt .sg{color:#9a6a12}',
'.psw-hero.lt .qt{color:#46506e}',
'.psw-hero.lt .nm,.psw-hero.lt .sg,.psw-hero.lt .qt{text-shadow:0 1px 2px rgba(255,255,255,.5)}',
'.psw-hero.lt .psw-barlab{color:#46506e}',
'.psw-hero.lt .psw-barlab b{color:#1b2440}',
'@media (prefers-reduced-motion:reduce){#petContent .psw *,.pcv *{animation:none !important;transition:none !important}}'
].join('\n');
    (document.head||document.documentElement).appendChild(st);
  }

  // ---------- 宠物屏: Hero + 六境路线图 ----------
  function renderShowcase(){
    injectCSS();
    var box=document.getElementById('petContent'); if(!box)return;
    if(_scKeepBrowse){ _scKeepBrowse=false; } else { scBrowse=null; }   /*🔴v745 非箭头触发的渲染(导航进宠物屏/刷新/升级/锁变化)→重置浏览态·回到home展示(showcaseStage);仅箭头 scStep 设 _scKeepBrowse=true 保留浏览·实现"返回后回到设为主页/锁头的宠物" */
    var cur=curStage(), n=N(), prog=progress(), R=realmOf(cur);
    var nx=cur<n-1?nameOf(cur+1):null;
    var h='<div class="psw" lang="zh-CN">';
    h+='<div class="psw-sub">六大境界 · 共 <b>'+n+'</b> 个奇幻形态 · 已解锁 <b>'+(cur+1)+'</b> 个</div>';
    // Hero
    var disp=(scBrowse!==null)?Math.max(0,Math.min(scBrowse,cur)):showcaseStage(), isCur=(disp===cur), locked=getHomeLock();   /*🔴v745 浏览态显示 scBrowse·否则显示 home展示(showcaseStage)。外部头像 updateHero 始终用 showcaseStage·浏览不影响外部头像 */
    var Rd=realmOf(disp), dnx=disp<n-1?nameOf(disp+1):null;
    var hk=getBgIdx(disp), hb=BG[hk]||BG[0];
    var heroBg=bgCss(hb);
    var _hh=haloHex(hb);
    var heroHalo='radial-gradient(circle at 50% 46%,'+hexA(_hh,.6)+','+hexA(_hh,.14)+' 50%,transparent 72%)';
    h+='<div class="psw-hero'+(hb.lt?' lt':'')+'" style="background:'+heroBg+'">'+(isCur?'<div class="nb">现在</div>':'')+'<div class="rt">境'+Rd.num+' · '+Rd.name+'</div>';
    h+='<div class="psw-petbox"><div class="psw-pethalo" style="background:'+heroHalo+'"></div>'+vis(disp,'em')+'<div class="psw-ped"></div></div>';
    h+='<div class="psw-nmrow"><div class="nm">'+esc(petName())+'</div></div>';/* v942: 用户宠物名必须转义，禁止把名字当 HTML 执行。 */
    h+='<div class="sg">第 '+(disp+1)+' / '+n+' 阶 · '+nameOf(disp)+'</div>';
    h+='<div class="qt">“'+descOf(disp)+'”</div>';
    if(isCur){
      /* v938 (Hansen: "希望宠物进化相关的经验可以及时显示, 玩完火眼金睛能及时看到宠物增加的经验")
   原来这里【只给一个百分比】, 用户根本看不出:
     · 现在多少经验? 还差多少?
     · 为什么卡在 0%? (进化要【经验】和【已掌握单词数】两个条件同时满足,
       min(两者) 决定进度 —— 只要有一项没到, 百分比就被它按死, 而界面什么都不说)
   现在: 两个条件各自把【当前值 / 需要值】明明白白写出来, 并标出是哪一项在拖后腿。 */
(function(){
  var _m=globalMastered(), _x=globalXP(), _st=gStageFromXP(), _n=N();
  var _xLo=xpReq(_st), _xHi=xpReq(_st+1), _mLo=masterReq(_st), _mHi=masterReq(_st+1);
  var _xp2=(_xHi>_xLo)?Math.max(0,Math.min(100,Math.round((_x-_xLo)/(_xHi-_xLo)*100))):100;
  var _mp =(_mHi>_mLo)?Math.max(0,Math.min(100,Math.round((_m-_mLo)/(_mHi-_mLo)*100))):100;
  var _slow=(_st>=_n-1)?'':(_mp<_xp2?'words':(_xp2<_mp?'xp':''));
  h+='<div class="psw-barlab"><span>'+(dnx?('\u8ddd\u79bb\u8fdb\u5316\u4e3a '+dnx):'\ud83c\udfc6 \u5df2\u8fbe\u7ec8\u7109\u5f62\u6001!')+'</span><span><b>'+prog+'%</b></span></div>';
  if(_st<_n-1){
    h+='<div class="psw-req">'
      +'<div class="psw-req-row'+(_slow==='xp'?' psw-req-slow':'')+'">'
        +'<span>\u26a1 \u7ecf\u9a8c</span>'
        +'<b id="pswXpNum">'+_x+' / '+_xHi+'</b>'
        +'<i>'+(_x>=_xHi?'\u2705 \u5df2\u591f':('\u8fd8\u5dee '+Math.max(0,_xHi-_x)))+'</i>'
      +'</div>'
      +((_mHi>_mLo)?('<div class="psw-req-row'+(_slow==='words'?' psw-req-slow':'')+'">'
        +'<span>\ud83d\udcda \u5df2\u638c\u63e1\u5355\u8bcd</span>'
        +'<b id="pswWdNum">'+_m+' / '+_mHi+'</b>'
        +'<i>'+(_m>=_mHi?'\u2705 \u5df2\u591f':('\u8fd8\u5dee '+Math.max(0,_mHi-_m)+' \u4e2a'))+'</i>'
      +'</div>'):'')
      +(_slow?'<div class="psw-req-tip">'+(_slow==='words'
          ? '\ud83d\udca1 \u7ecf\u9a8c\u591f\u4e86\uff0c\u5361\u5728\u3010\u5df2\u638c\u63e1\u5355\u8bcd\u3011\u2014\u2014 \u53bb\u63a2\u7d22\u5355\u8bcd\u7684\u300c\ud83d\udc3e \u5ba0\u7269\u51b2\u523a\u300d\uff0c\u628a\u5217\u51fa\u7684\u8bcd\u7d2f\u8ba1\u7b54\u5bf9 3 \u6b21\u5c31\u80fd\u8ba1\u5165\u8fdb\u5316'
          : '\ud83d\udca1 \u5355\u8bcd\u591f\u4e86\uff0c\u5361\u5728\u3010\u7ecf\u9a8c\u3011\u2014\u2014 \u591a\u73a9\u51e0\u5c40\u5c31\u80fd\u8fdb\u5316')+'</div>':'')
    +'</div>';
  }
})();
      h+='<div class="psw-bar"><i style="width:'+prog+'%"></i></div>';
    }else{
      h+='<div class="psw-dispst">'+(disp===0?'✦ 你的起点形态':('✦ 已进化获得 · 境'+Rd.num+' '+Rd.name))+'</div>';/*🔴BUG#93 去掉" · 🔒 已锁定"锁状态后缀(锁已删)*/
    }
    h+='<div class="psw-actions"><button class="psw-arw" id="pswPrev" onclick="HsnPet.homePrev()"'+(disp<=0?' disabled':'')+'>←</button><button class="game-btn purple" onclick="renamePet&&renamePet()">✏️ 给宠物改名</button><button class="psw-arw" id="pswNext" onclick="HsnPet.homeNext()"'+(disp>=cur?' disabled':'')+'>→</button></div>';
    h+='</div>';
    // 路线图
    h+='<div class="psw-th"><div class="ln"></div><span>🗺️ 进化全程 · 六境'+n+'阶</span><div class="ln"></div></div>';
    h+='<div class="psw-trail" id="pswTrail"><div class="psw-lit" id="pswLit" style="height:0"></div>';
    for(var i=0;i<n;i++){
      if(i%6===0){var Rr=REALMS[Math.floor(i/6)]||R;
        h+='<div class="psw-rd" style="background:linear-gradient(90deg,'+hexA(Rr.c1,.15)+','+hexA(Rr.c2,.1)+');border-color:'+hexA(Rr.c1,.36)+'"><span class="rn" style="background:linear-gradient(135deg,'+Rr.c1+','+Rr.c2+')">境'+Rr.num+'</span><div><div class="rnm">'+Rr.name+'</div><div class="rsb">'+Rr.sub+'</div></div></div>';
      }
      var uk=i<=cur, cls=i===cur?'cur':(uk?'uk':'lk'), side=i%2===0?'l':'r';
      var badge=i===cur?'<span class="now">现在</span>':'', lk=!uk?'<span class="lkk">🔒</span>':'';
      var _cb=BG[getBgIdx(i)]||BG[0];
      /* 🔴v672 未解锁纯黑封存:不渲染宠物图·只显"?"·不可点击·完全看不到样子 */
      var capBg=uk?capCss(_cb):'radial-gradient(circle at 50% 40%,#161d30,#070b14 92%)';
      var capInner=uk?vis(i,'em'):'<span class="qm">?</span>';
      var clickA=uk?(' onclick="HsnPet.openCard('+i+')"'):'';
      h+='<div class="psw-node '+side+' '+cls+(uk?' on':'')+'"><div class="sd"><div class="psw-cap" style="background:'+capBg+'"'+clickA+'>'+capInner+badge+lk+'</div><div class="lb"><div class="nm">'+(uk?nameOf(i):'？？？')+'</div><div class="st">第 '+(i+1)+' 阶</div></div></div><div class="dot"></div></div>';
    }
    h+='</div></div>';
    box.innerHTML=h;
    requestAnimationFrame(function(){
      var lit=document.getElementById('pswLit'), t=document.getElementById('pswTrail');
      var c=t&&t.querySelector('.psw-node.cur');
      if(lit&&c)lit.style.height=(c.offsetTop+c.offsetHeight/2)+'px';
    });
  }

  // ---------- 卡牌式展示器 ----------
  var viewIdx=0;
  function ensureViewer(){
    if(document.getElementById('petCardViewer'))return;
    var d=document.createElement('div'); d.id='petCardViewer'; d.className='pcv'; d.setAttribute('lang','zh-CN');
    d.innerHTML='<div class="pcv-top"><div class="pcv-x" id="pcvX">✕</div></div>'+
      '<div class="pcv-wrap">'+
        '<div class="pcv-card" id="pcvCard"><div class="pcv-realm" id="pcvRealm"></div><div class="pcv-pos" id="pcvPos"></div>'+
          '<div class="pcv-pet" id="pcvPet"><div class="pcv-halo" id="pcvHalo"></div></div><div class="pcv-ped"></div>'+
          '<div class="pcv-name" id="pcvName"></div><div class="pcv-desc" id="pcvDesc"></div><div class="pcv-status" id="pcvStatus"></div></div>'+
        '<div class="pcv-homerow"><button class="pcv-home" id="pcvHome">🏠 设为主页展示</button><button class="pcv-lk" id="pcvLock" title="锁定主页展示">🔓</button></div>'+
        '<div class="pcv-nav"><button id="pcvPrev">← 上一只</button><span class="md" id="pcvMid"></span><button id="pcvNext">下一只 →</button></div>'+
        '<div class="pcv-bglab">🎨 选择卡牌背景色</div><div class="pcv-sw" id="pcvSw"></div>'+
      '</div>';
    document.body.appendChild(d);
    document.getElementById('pcvX').onclick=closeCard;
    d.addEventListener('click',function(e){if(e.target===d)closeCard();});
    document.getElementById('pcvPrev').onclick=function(){if(viewIdx>0){viewIdx--;paintCard();}};
    document.getElementById('pcvNext').onclick=function(){if(viewIdx<curStage()){viewIdx++;paintCard();}};
    document.getElementById('pcvHome').onclick=function(){if(viewIdx<=curStage()){setHomeIdx(viewIdx);setHomeLock(false);/*🔴BUG#95 设为主页展示不再自动锁:仅展示·解锁态下升级自动跟随当前最高阶(showcaseStage解锁=curStage)·要钉死某阶需再点旁边的锁(toggleHomeLock)·原setHomeLock(true)会一点设为主页展示就锁死不跟随升级·Hansen要求改*/try{updateHero();}catch(e){}try{var _pc=document.getElementById('petContent');if(_pc&&_pc.querySelector('.psw'))renderShowcase();}catch(e){}paintHomeBtn();paintLock();try{if(typeof showToast==='function')showToast('🏠 已设为主页展示 · 升级自动跟随');}catch(e){}}};
    document.getElementById('pcvLock').onclick=toggleHomeLock;
    // 背景色按钮
    var sw=document.getElementById('pcvSw'), sh='';
    for(var k=0;k<BG.length;k++){sh+='<div class="s" data-k="'+k+'" style="background:'+swCss(BG[k])+'" title="'+BG[k].n+'"></div>';}
    sw.innerHTML=sh;
    sw.addEventListener('click',function(e){var s=e.target.closest('.s');if(!s)return;var k=+s.getAttribute('data-k');setBgIdx(viewIdx,k);applyBg(k);markSw(k);updateCapBg(viewIdx,k);if(viewIdx===curStage())updateHeroBg(k);});
  }
  function applyBg(k){
    var b=BG[k]||BG[0];
    var card=document.getElementById('pcvCard');
    if(card){card.style.background=bgCss(b);card.classList.toggle('lt',!!b.lt);}
    var halo=document.getElementById('pcvHalo'); var _hh=haloHex(b);
    if(halo)halo.style.background='radial-gradient(circle at 50% 46%,'+hexA(_hh,.6)+','+hexA(_hh,.12)+' 48%,transparent 70%)';
  }
  function markSw(k){var sw=document.getElementById('pcvSw');if(!sw)return;[].forEach.call(sw.children,function(c){c.classList.toggle('sel',+c.getAttribute('data-k')===k);});}
  /* 🔴v672 主页展示按钮态:未解锁隐藏·已是主页展示置灰·否则可点 */
  function paintHomeBtn(){var b=document.getElementById('pcvHome');if(!b)return;var i=viewIdx,uk=i<=curStage();if(!uk){b.style.display='none';return;}b.style.display='';if(getHomeIdx()===i){b.className='pcv-home on';b.textContent=getHomeLock()?'🔒 主页展示中(已锁)':'🏠 已在主页展示';}else{b.className='pcv-home';b.textContent='🏠 设为主页展示';}}/*🔴v786 当前看的这只==主页展示阶(homeIdx)时标"已在主页展示"(锁定时标"已锁")·否则可点设为主页展示。原仅"锁定且homeIdx===i"才标已展示·解锁态设为主页后标签不变易误判失效*/
  function paintLock(){var b=document.getElementById('pcvLock');if(!b)return;var lk=getHomeLock();b.textContent=lk?'🔒':'🔓';b.className='pcv-lk'+(lk?' on':'');b.title=lk?'已锁定 · 点此解锁(主页将自动显示当前最高阶)':'未锁定 · 点此锁定(主页固定显示此形态)';}
  function paintCard(){
    var i=viewIdx, uk=i<=curStage(), R=realmOf(i), n=N();
    var pet=document.getElementById('pcvPet');
    pet.className='pcv-pet'+(uk?'':' lk');
    pet.innerHTML='<div class="pcv-halo" id="pcvHalo"></div>'+vis(i,'em');
    document.getElementById('pcvRealm').textContent='境'+R.num+' · '+R.name;
    document.getElementById('pcvPos').textContent='第 '+(i+1)+' / '+n;
    document.getElementById('pcvMid').textContent=(i+1)+' / '+n;
    var nm=document.getElementById('pcvName'); nm.textContent=uk?nameOf(i):'神秘形态'; nm.className='pcv-name'+(uk?'':' lk');
    document.getElementById('pcvDesc').textContent=uk?('“'+descOf(i)+'”'):'继续冒险，揭开它的样子……';
    var stt=document.getElementById('pcvStatus');
    if(uk){stt.innerHTML=i===0?'✦ 你的起点形态':'✦ 已进化获得 · 境'+R.num+' '+R.name;}
    else{var nw=masterReq(i), nx=xpReq(i); stt.innerHTML='🔒 未解锁 · 需掌握 <span class="k">'+nw+'</span> 词 且累计 <span class="k">'+nx+'</span> 经验';}
    document.getElementById('pcvPrev').disabled=(i<=0);
    document.getElementById('pcvNext').disabled=(i>=curStage());
    var k=getBgIdx(i); applyBg(k); markSw(k);
    paintHomeBtn();paintLock();
  }
  function openCard(i){if(i>curStage())return;ensureViewer();viewIdx=i;paintCard();var v=document.getElementById('petCardViewer');v.classList.add('open');}
  function updateHeroBg(k){var b=BG[k]||BG[0];var hero=document.querySelector('#petContent .psw-hero');if(hero){hero.style.background=bgCss(b);hero.classList.toggle('lt',!!b.lt);}var hl=document.querySelector('#petContent .psw-pethalo');var _hh=haloHex(b);if(hl)hl.style.background='radial-gradient(circle at 50% 46%,'+hexA(_hh,.6)+','+hexA(_hh,.14)+' 50%,transparent 72%)';}
  // 🔴v640 换色时实时更新该宠物在路线图的缩略图背景(caps 按宠物 0..N-1 顺序排列·caps[i]=第i只)·避免要退出重进才刷新
  function updateCapBg(i,k){try{var b=BG[k]||BG[0];var caps=document.querySelectorAll('#petContent .psw-cap');if(caps&&caps[i])caps[i].style.background=capCss(b);}catch(e){}}
  function closeCard(){var v=document.getElementById('petCardViewer');if(v)v.classList.remove('open');}

  // ---------- 覆盖首页 Hero(图片化) ----------
  function updateHero(){
    try{
      var st=curStage();
      /* 🔴v786 进化检测 + 解锁态主页跟随最新阶: 必须在算 hi/src 之前(否则本次 heroPet 仍显旧阶·下次才更新)。
         🔴v643 进化检测用全局 seen-stage(全岛共一只·进化提示只弹一次·首次静默对齐当前阶不弹历史) */
      try{
        var _seenK='hansen_pet_seen_stage', _raw=localStorage.getItem(_seenK);
        if(_raw===null){ try{localStorage.setItem(_seenK,String(st));}catch(e){} }
        else { var _seen=+_raw||0;
          if(_seen>st){ /* 🔴v665 清旧残留:存的已见阶高于当前真实阶→静默重置·绝不弹历史进化 */ try{localStorage.setItem(_seenK,String(st));}catch(e){} }
          else if(st>_seen){ /* 新进化 */ try{localStorage.setItem(_seenK,String(st));}catch(e){} try{if(st===1)unlockAch('petHatch');if(st===N()-1)unlockAch('petFinal');}catch(e){}
            /* 🔴v786 新进化时:解锁态→主页展示跟随推进到最新阶(setHomeIdx=st)·锁定态→不动(钉死homeIdx不跟随)。这就是"升级后外面图标自动变最新·但锁了就怎么都不变"的实现 */ try{if(!getHomeLock())setHomeIdx(st);}catch(e){}
            try{showEvolve(st);}catch(e){} } }
        /* 🔴v665 始终同步 S.pet.stage=当前真实阶(清旧岛内残留错误最高阶) */
        try{if(window.S&&S.pet&&S.pet.stage!==st){S.pet.stage=st;save();}}catch(e){}
      }catch(e){}
      var hi=showcaseStage(), src=imgOf(hi);
      /*🔴BUG#92 宠物图首帧即显:存"当前显示的宠物图URL"→外壳hansen_preload.js进岛前预热它(缓存)+每岛早期内联脚本首帧立即读它填heroPet(在1.9MB模块JS前) */
      try{ if(src) localStorage.setItem('hansen_pet_hero_img', src); }catch(e){}
      var el=document.getElementById('heroPet');
      if(el){ el.innerHTML = src?('<img src="'+src+'" alt="" onload="var p=this.closest(&quot;.pet-slot&quot;);if(p)p.classList.add(&quot;pet-ready&quot;)" onerror="var p=this.closest(&quot;.pet-slot&quot;);if(p)p.classList.add(&quot;pet-ready&quot;);window.hansenImgErr&&window.hansenImgErr(this)">'):''; }
      var nmE=document.getElementById('heroPetName'); if(nmE){nmE.textContent=petName();nmE.setAttribute('lang','zh-CN');}
      var sgE=document.getElementById('heroPetStage'); if(sgE){sgE.textContent=nameOf(hi);sgE.setAttribute('lang','zh-CN');}
      var txE=document.getElementById('heroPetText'); if(txE){txE.textContent=descOf(hi);txE.setAttribute('lang','zh-CN');}
      var xpE=document.getElementById('heroPetXP'); if(xpE)xpE.style.width=progress()+'%';
    }catch(e){}
  }

  // ---------- 覆盖进化 toast(图片化) ----------
  function showEvolve(st){
    try{
      var src=imgOf(st), badge=src?('<img src="'+src+'" style="height:1.5em;vertical-align:middle;margin:0 2px" onerror="window.hansenImgErr&&window.hansenImgErr(this)">'):'';
      if(typeof showComboToast==='function')showComboToast('🎉 宠物进化! '+badge+' <b>'+nameOf(st)+'</b>','pet-evolve',3500);
    }catch(e){}
    try{bigConfetti();}catch(e){}
    try{playLevelUp();}catch(e){}
  }

  // 暴露 + 覆盖全局
  window.HsnPet={openCard:openCard,closeCard:closeCard,render:renderShowcase,toggleHomeLock:toggleHomeLock,homePrev:function(){scStep(-1);},homeNext:function(){scStep(1);},progressSnapshot:progressSnapshot};/*🔴v745 箭头→scStep只浏览(原homeStep设+锁已删)*/
  window.renderPetScreen=renderShowcase;
  window.updatePetHero=updateHero;
  window.showPetEvolve=function(stage){ // 兼容旧签名(传stage对象): 找其index
    try{var idx=stages().indexOf(stage); if(idx<0&&stage&&stage.name){for(var i=0;i<N();i++){if(nameOf(i)===stage.name){idx=i;break;}}} showEvolve(idx<0?curStage():idx);}catch(e){showEvolve(curStage());}
  };
  // 🔴v643 覆盖改名→写全局名(全岛同名)·原各岛 renamePet 只改本岛 S.pet.name
  window.renamePet=function(){
    try{
      if(typeof showPromptMsg!=='function')return;
      showPromptMsg('给你的宠物起个名字（最多8个字符）：', globalPetName(), function(name){
        if(name&&name.trim()){
          setGlobalPetName(name.trim().slice(0,8));
          try{if(typeof updateTopBar==='function')updateTopBar();}catch(e){}
          try{updateHero();}catch(e){}
          try{var ps=document.getElementById('petScreen');if(ps&&(ps.classList.contains('active')||ps.classList.contains('show')))renderShowcase();}catch(e){}
          try{if(typeof showToast==='function')showToast('✅ 名字改好了！');}catch(e){}
        }
      });
    }catch(e){}
  };

  // 加载后立即用图片刷新 Hero;若正停在宠物屏则重渲染
  function boot(){ injectCSS(); try{hsnTrackMastery();}catch(e){} try{updateHero();}catch(e){} try{var ps=document.getElementById('petScreen');if(ps&&(ps.classList.contains('active')||ps.classList.contains('show')||getComputedStyle(ps).display!=='none'))renderShowcase();}catch(e){} }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
