// hansen_backup_v944.js — 版本化全局备份 / 原子恢复
(function(root){
  'use strict';
  if(!root||root.__hansenBackupLoaded)return;root.__hansenBackupLoaded=true;

  var SCHEMA='hansen.wordminiprogram.backup',SCHEMA_VERSION=1,CURRENT_APP_VERSION=1136;
  var FORENSIC_SCHEMA='hansen.wordminiprogram.reset-forensic',forensicExported={};
  var MAX_ITEMS=1200,MAX_VALUE=2*1024*1024,MAX_TOTAL=12*1024*1024;
  var MAX_WORD_INDEX=1000000,MAX_WORD_ENTRIES=100000,MAX_WORD_COUNT=1000000;
  var MAX_SAFE_INT=Number.MAX_SAFE_INTEGER||9007199254740991;
  // The v942 key is a persistent schema identity and must never be renamed.
  // v963 accepts compatible journals v942-v946 and the formal v950-v960 + v963 line.
  // 🔴 v961/v962 已被用户永久淘汰(见交接墓碑)：其备份/日志必须继续失败关闭，绝不接受。
  // Skipped v947-v949 and future journals fail closed; the v942 key remains the schema identity.
  var RESTORE_JOURNAL='hansen_backup_restore_journal_v942',JOURNAL_SCHEMA=1,MIN_JOURNAL_APP_VERSION=942;
  var EXACT={ttsProvider:1,voiceName:1,theme:1,themeName:1,clickSoundEnabled:1,lastIslandKey:1,lastIslandTime:1,sb_best_cpm:1,hsnViewMode:1};
  var DIAG_KEY_RE=/^hansen_(?:credtrap_|cred_shadow|cred_rescue|cred_refresh|vw_autofixed)/i;
  var PREFIXES=['wordIsland','hansen_','hsn_','bs_hall_','hs_showcase_'];
  var DENY=/^(?:hansen_admin_|hansen_(?:land_)?card_temp_unlock_until$|hansen_autoOpen|hansen_bossfx_override$|hansen_snapshot_|hansen_freepass|hansen_blackbox|hsn_debug|hsn_test|hansen_auth_|hansen_cloud_state_)|(?:password|passcode|token|secret|authorization|session)/i;
  var TRANSIENT_KEY=/(?:^|[_:\-.])(?:pending|journal|transaction|txn)(?:[_:\-.]|$)|(?:^|_)tmp(?:_|$)/i;
  var NESTED_TX={hansen_wallet_cardbook:1,hansen_diamond_shop:1,hansen_share_draw:1};
  function transientKey(k){return typeof k==='string'&&/^(?:wordIsland|hansen_|hsn_|bs_hall_|hs_showcase_)/.test(k)&&TRANSIENT_KEY.test(k);}
  function supportedJournalAppVersion(v){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v!==961&&v!==962&&((v>=MIN_JOURNAL_APP_VERSION&&v<=946)||(v>=950&&v<=CURRENT_APP_VERSION));}

  // hansen_vocab_* 是从页面自带词库重建出来的派生缓存，不是玩家存档。
  // 它不能进入可移植备份，但恢复/回滚必须认识它：成功恢复时清除旧缓存，
  // 写入失败时则随 raw snapshot 原样回滚，避免把用户留在半恢复状态。
  /* 🔴v1095 真凶：**键名允许中文**。

     用户现场：登录成功后点「立即把进度存到云端」，一直报
         「备份含非法键或非字符串值」
     v1094 我以为是自己加的诊断键污染了备份 —— **那只对了一半**。

     实测扫描用户真实键名后找到真凶：
         hsn_progress:动物大冒险        ← 键名里有中文！
     这是 hansen_mylearning.js 写的「我的学习」跨岛聚合数据，
     键名格式是 `hsn_progress:<岛标题>`，而岛标题本来就是中文。

     而备份的键名校验是 /^[A-Za-z0-9_:\-.]+$/ —— **只允许英文数字**，
     中文一律判为非法 → 整个备份失败 → 用户永远存不上云端。

     这是**真实的玩家学习数据**，必须能备份，所以修的是校验规则而不是排除它。
     放行中日韩字符（\u4e00-\u9fff 汉字、\u3040-\u30ff 日文假名、
     \uac00-\ud7af 韩文），键名长度上限仍受 ownedKey 的 160 字符限制。 */
  var KEY_CHARSET = /^[A-Za-z0-9_:\-.\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+$/;

  function derivedKey(k){return typeof k==='string'&&k.length<=160&&/^hansen_vocab_[A-Za-z0-9_:\-.]*$/.test(k);}

  /* 🔴v1090 决定性修复：**云端凭证绝不是玩家存档，绝不能进备份、更不能被恢复盖回去。**

     用户真机凭证生死簿抓到的完整现场（确凿证据，不是推测）：

         1:05:59  🔑 登录成功  凭证已就位              ← SDK 写入新凭证 1340 字节
         1:06:04  写入 credentials_ambitious-…  1314 字节
                  hansen_backup_v944.js:410        ← **是我们自己的备份恢复写的**
                  applyTarget / replaceAll
         1:06:06  ❗删除 credentials_ambitious-…  原有 1314 字节
                  → HTTP 400 invalid_grant | invalid refresh token.
                              for it may be has been refreshed by

     链条：备份恢复把一份**旧的**凭证快照盖回 localStorage
        → SDK 拿着这个**过期的 refresh_token** 去刷新
        → 服务端说"这个 token 已经被刷新过了"(invalid_grant)
        → SDK 拦截器判鉴权失败 → **把整个凭证删掉**
        → 此后 getLoginState() 永远 null，用户彻底登不上

     为什么会被收进备份：v1019 把白名单改成了**兜底收录**
     （凡是合法键名且没被 DENY 挡下的一律纳入），
     初衷是"所有东西都跟着账号走、以后新增数据不用记得改这里" —— 方向是对的，
     但**没想到 SDK 自己的凭证也躺在同一个 localStorage 里**。

     凭证是**会话态**，不是玩家数据：
       · 它跟设备、跟这次登录绑定，跨设备搬过去毫无意义
       · 更糟的是**搬回来会把当前有效会话打掉**（就是本次事故）
     所以必须显式排除，且这条排除要放在最前面，先于一切收录规则。 */
  function credentialKey(k){
    /* 🔴v1094：诊断/守护类的内部键一律不进备份。
       用户现场：登录成功后点「立即把进度存到云端」，报「备份含非法键或非字符串值」。
       原因是 v1085/v1092 新增的内部键都以 hansen_ 开头，正好落进备份收录前缀 ——
       它们是本机诊断状态，既非玩家进度、也不该跨设备同步，
       更不该因为格式不符就让整个备份失败。**我加的工具污染了用户的备份。** */
    if (typeof k === 'string' && DIAG_KEY_RE.test(k)) return true;
    return typeof k === 'string' &&
      /^(?:credentials|access_token|refresh_token)|^tcb[_-]|cloudbase.*(?:token|cred)/i.test(k);
  }

  function ownedKey(k){
    if(typeof k!=='string'||!k||k.length>160)return false;
    if(credentialKey(k))return false;      /* v1090: 云端凭证一律不进备份 */
    if(derivedKey(k))return false;
    if(DENY.test(k)||transientKey(k))return false;
    if(EXACT[k])return true;
    if(/^(?:season1_prog|season_boss_perfect|season_word_mastery|season_wrong_words|land[1-8]_prog)$/.test(k))return true;
    for(var i=0;i<PREFIXES.length;i++)if(k.indexOf(PREFIXES[i])===0)return KEY_CHARSET.test(k);
    /* 🔴v1019「所有东西都跟着账号走」：
       原先是**白名单**——只有列在前缀/名单里的键才进备份，
       结果每加一个新功能就可能漏一个键（sb_best_cpm、主题、语音设置等都曾在外）。
       改为**兜底收录**：凡是合法键名、且没被上面的 DENY/临时/派生规则挡下的，
       一律纳入备份。以后新增任何数据都自动跟着账号走，不用再记得改这里。 */
    return KEY_CHARSET.test(k);
  }
  // 值只来自 JSON.parse；这里用 tag 而不是原型恒等，兼容 iframe/测试 VM 的跨 realm JSON。
  function plainObject(o){return !!o&&typeof o==='object'&&!Array.isArray(o)&&Object.prototype.toString.call(o)==='[object Object]';}
  function exactInt(n,min,max){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n&&n>=min&&n<=max;}
  function canonicalIndex(k){return /^(?:0|[1-9][0-9]*)$/.test(k)&&Number(k)<=MAX_WORD_INDEX;}
  function validateIndexMap(o,label,min,max){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    var ks=Object.keys(o);if(ks.length>MAX_WORD_ENTRIES)throw new Error(label+'条目数量超限');
    ks.forEach(function(ix){
      if(!canonicalIndex(ix))throw new Error(label+'含非法单词索引：'+ix);
      if(!exactInt(o[ix],min,max))throw new Error(label+'次数必须是 '+min+'..'+max+' 的整数数字');
    });
  }
  function validateSrs(o,label){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    var ks=Object.keys(o);if(ks.length>MAX_WORD_ENTRIES)throw new Error(label+'条目数量超限');
    ks.forEach(function(ix){
      if(!canonicalIndex(ix))throw new Error(label+'含非法单词索引：'+ix);
      var e=o[ix];if(!plainObject(e))throw new Error(label+'条目必须是普通对象');
      if(Object.prototype.hasOwnProperty.call(e,'box')&&!exactInt(e.box,0,100))throw new Error(label+'的 box 必须是 0..100 的整数数字');
      // due/last 是日期文本而非次数；只限制类型、长度和 HTML 控制字符，
      // 未识别的其它业务字段保留，避免破坏将来的合法扩展。
      ['due','last'].forEach(function(f){if(Object.prototype.hasOwnProperty.call(e,f)&&(typeof e[f]!=='string'||e[f].length>64||/[<>]/.test(e[f])))throw new Error(label+'的 '+f+' 字段无效');});
    });
  }
  function validateNamedCountMap(o,label,maxEntries){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    var ks=Object.keys(o);if(ks.length>maxEntries)throw new Error(label+'条目数量超限');
    ks.forEach(function(name){
      if(!/^[A-Za-z0-9_-]{1,64}$/.test(name))throw new Error(label+'含非法统计名称');
      if(!exactInt(o[name],0,MAX_WORD_COUNT))throw new Error(label+'次数必须是 0..'+MAX_WORD_COUNT+' 的整数数字');
    });
  }
  function validDayText(v){
    if(v==='')return true;
    if(typeof v!=='string'||v.length>16||/[<>]/.test(v))return false;
    var m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);if(!m)return false;
    var y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
    if(y<2000||y>9999||mo<1||mo>12||d<1||d>31)return false;
    var dt=new Date(y,mo-1,d);return dt.getFullYear()===y&&dt.getMonth()===mo-1&&dt.getDate()===d;
  }
  function validateStats(o,label){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    var numeric=['bossBeaten','scrambleCleared','matchPerfect','typeCount','clozeRight','listenRight','maxCombo','chestClaimed','daysPlayed','molesCleared','fishCleared','eagleCleared','reviewToday','scrDayCount','scrHardCount','scrPerfectTotal'];
    numeric.forEach(function(f){if(Object.prototype.hasOwnProperty.call(o,f)&&!exactInt(o[f],0,MAX_WORD_COUNT))throw new Error(label+f+' 必须是 0..'+MAX_WORD_COUNT+' 的整数数字');});
    ['bubbleBest','molesBest','fishBest','eagleBest','speedBest'].forEach(function(f){
      if(!Object.prototype.hasOwnProperty.call(o,f))return;
      if(typeof o[f]==='number'){if(!exactInt(o[f],0,MAX_WORD_COUNT))throw new Error(label+f+' 必须是合理的整数数字');}
      else validateNamedCountMap(o[f],label+f,100);
    });
    if(Object.prototype.hasOwnProperty.call(o,'gameCounts'))validateNamedCountMap(o.gameCounts,label+'gameCounts',500);
    ['reviewDay','scrDayKey'].forEach(function(f){if(Object.prototype.hasOwnProperty.call(o,f)&&!validDayText(o[f]))throw new Error(label+f+' 必须是有效的 YYYY-M-D 日期');});
    if(Object.prototype.hasOwnProperty.call(o,'modesPlayed')){
      if(!Array.isArray(o.modesPlayed)||o.modesPlayed.length>100)throw new Error(label+'modesPlayed 必须是合理长度的数组');
      o.modesPlayed.forEach(function(v){if(typeof v!=='string'||v.length>64||/[<>]/.test(v))throw new Error(label+'modesPlayed 含非法模式名称');});
    }
  }
  function validatePet(o,label){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    Object.keys(o).forEach(function(k){if(!/^(?:name|stage|xp|picked)$/.test(k))throw new Error(label+'含未知字段：'+k);});
    if(typeof o.name!=='string'||!o.name.trim()||Array.from(o.name.trim()).length>8||/[<>\u0000-\u001f\u007f]/.test(o.name))throw new Error(label+'name 必须是 1..8 个安全字符');
    if(!exactInt(o.stage,0,35))throw new Error(label+'stage 必须是 0..35 的整数数字');
    if(!exactInt(o.xp,0,1000000000))throw new Error(label+'xp 必须是合理的非负整数数字');
    if(typeof o.picked!=='boolean')throw new Error(label+'picked 必须是布尔值');
  }
  var ROUND_REGULAR=/^(?:action|adjective|animal|body|city|clothes|color|family|food|home|job|nature|question|school|sports|time|traffic|treasure)$/;
  function roundStateValue(k,v,mode){
    var m=/^hansen_boss_round_state_v946_([a-z0-9]+)$/.exec(k);if(!m)return v;
    var island=m[1],land=/^land[1-8]$/.test(island),regular=ROUND_REGULAR.test(island);
    if(!land&&!regular)throw new Error((mode==='import'?'备份含':'当前存档含')+'未知 Boss 轮次岛屿：'+island);
    var o;try{o=JSON.parse(v);}catch(e){throw new Error((mode==='import'?'备份含':'当前存档含')+'无效 Boss 轮次 JSON：'+k);}
    var label=(mode==='import'?'备份含':'当前存档含')+'非法 '+k+'.';
    if(!plainObject(o))throw new Error(label+'根值必须是普通对象');
    Object.keys(o).forEach(function(f){if(!/^(?:schema|version|island|mode|total|roundNo|completedCount|cleared|updatedAt|lastReceipt)$/.test(f))throw new Error(label+'含未知字段：'+f);});
    if(o.schema!==1||o.version!==946||o.island!==island||o.mode!==(land?'land':'regular'))throw new Error(label+'版本、岛屿或模式不匹配');
    if(!exactInt(o.total,1,20)||(regular&&o.total!==20))throw new Error(label+'total 无效');
    if(!exactInt(o.completedCount,0,MAX_SAFE_INT)||!exactInt(o.roundNo,1,MAX_SAFE_INT)||o.roundNo!==o.completedCount+1)throw new Error(label+'轮次编号不连续');
    if(!exactInt(o.updatedAt,1,MAX_SAFE_INT))throw new Error(label+'更新时间无效');
    if(!Array.isArray(o.cleared)||o.cleared.length>=o.total)throw new Error(label+'只能携带尚未完成的本轮进度；满轮必须先完成安全结算');
    var prev=0;o.cleared.forEach(function(lv){if(!exactInt(lv,1,o.total)||lv<=prev)throw new Error(label+'cleared 必须是升序且不重复的有效关号');prev=lv;});
    if(o.lastReceipt!==null){
      var r=o.lastReceipt,id='round:v946:'+o.mode+':'+o.island+':r'+o.completedCount;
      if(!plainObject(r)||r.id!==id||!exactInt(r.roundNo,1,MAX_SAFE_INT)||r.roundNo!==o.completedCount||!exactInt(r.paidAt,1,MAX_SAFE_INT))throw new Error(label+'最近结算凭据无效');
    }
    return v;
  }
  // 当前 v946 的全局任务池 + 同页旧任务池的权威机械参数。
  // 展示文字仍需是安全文本；goal/type/reward 必须与 id 对应，不能由备份自定义奖励。
  var QUEST_RULES={
    learn3:['learn',3,20,2],learn5:['learn',5,30,3],learn10:['learn',10,60,6],
    boss1:['boss',1,25,3],boss3:['boss',3,70,8],correct20:['correct',20,30,3],correct50:['correct',50,80,8],
    listen10:['listen',10,25,3],listen20:['listen',20,60,6],listen40:['listen',40,130,14],
    cloze5:['cloze',5,25,3],cloze10:['cloze',10,55,6],cloze20:['cloze',20,120,13],
    scramble1:['scramble',1,50,6,1],scramble2:['scramble',2,90,11,1],scramble3:['scramble',3,120,15,1],scramble5:['scramble',5,200,25,1],scramble7:['scramble',7,300,38,1],scramble10:['scramble',10,450,55,1],scramble15:['scramble',15,700,90,1],
    type5:['type',5,30,3,1],type15:['type',15,80,9,1],type30:['type',30,160,20,1],type50:['type',50,280,36,1],
    match1:['match',1,20,2],match3:['match',3,65,7],
    moles1:['moles',1,30,4],moles3:['moles',3,80,10],moles5:['moles',5,150,18],
    fish1:['fish',1,30,4],fish3:['fish',3,80,10],fish5:['fish',5,150,18],
    eagle1:['eagle',1,30,4],eagle3:['eagle',3,80,10],eagle5:['eagle',5,150,18],
    bubble30:['bubble',30,20,2],bubble60:['bubble',60,60,7],bubble100:['bubble',100,120,14],
    speed200:['speed',200,35,4],speed500:['speed',500,100,12]
  };
  function safeQuestText(v,max){return typeof v==='string'&&v.length>0&&v.length<=max&&!/[<>]/.test(v);}
  function validateQuests(o,label){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    Object.keys(o).forEach(function(k){if(!/^(?:version|day|allDay|list)$/.test(k))throw new Error(label+'含未知字段：'+k);});
    if(Object.prototype.hasOwnProperty.call(o,'version')&&o.version!==941&&o.version!==942)throw new Error(label+'version 无效');
    if(!Object.prototype.hasOwnProperty.call(o,'day')||!validDayText(o.day))throw new Error(label+'day 必须为空或有效 YYYY-M-D 日期');
    if(Object.prototype.hasOwnProperty.call(o,'allDay')&&!validDayText(o.allDay))throw new Error(label+'allDay 必须为空或有效 YYYY-M-D 日期');
    if(!Array.isArray(o.list)||o.list.length>12)throw new Error(label+'list 必须是最多 12 项的数组');/*🔴v1019: 每日任务 v1000 起为 12 条, 此处仍写死 7 → build() 抛错 → 云备份自 v1000 起一直是坏的*/
    var ids={},types={};
    o.list.forEach(function(q){
      if(!plainObject(q))throw new Error(label+'任务必须是普通对象');
      Object.keys(q).forEach(function(k){if(!/^(?:id|icon|title|goal|type|reward|isSpelling|progress|claimed)$/.test(k))throw new Error(label+'任务含未知字段：'+k);});
      /* 🔴v1019: 这里原本内嵌了一份**任务权威配置**(QUEST_RULES)并逐条比对 type/goal。
         但任务定义的真源在 hansen_quest_global.js，两处一旦走散备份就整个抛错——
         v1000 把每日任务从 7 条改到 12 条、v1001 又调了各任务 goal，
         这份副本没跟上，导致 build() 直接抛异常，**云备份自 v1000 起一直是坏的**。
         备份的职责是保全数据，不该校验游戏逻辑细节；改为只做结构性校验。 */
      if(typeof q.id!=='string'||!q.id)throw new Error(label+'任务 id 非法');
      if(ids[q.id])throw new Error(label+'含重复任务 id');
      ids[q.id]=1;
      if(typeof q.type!=='string'||!q.type)throw new Error(label+'任务 '+q.id+' 缺少 type');
      /* v1060: 结构性上限——与任务配置无关，只挡离谱值 */
      var REWARD_MAX = 100000, GOAL_MAX = 100000;
      /* 🔴v1060 收紧：原判据是「是数字 && 有限 && >=0」，太松——
         `goal:0` 能通过，而 progress 0 >= goal 0 就是**立即可领取**，
         与 progress 越界那个漏洞同类；`goal:3.5` 这种小数也放行。
         v1019 删掉「与内嵌任务配置逐条比对」是对的（副本走散把云备份整个搞坏过），
         但结构性边界不该跟着一起删。这里只加与配置无关的约束：正整数 + 上限。 */
      if(!exactInt(q.goal,1,GOAL_MAX))throw new Error(label+'任务 '+q.id+' 的 goal 非法');
      if(!safeQuestText(q.icon,32)||!safeQuestText(q.title,160))throw new Error(label+'任务 '+q.id+' 的 icon/title 含非法文本');
      if(!plainObject(q.reward))throw new Error(label+'任务 '+q.id+' 的 reward 无效');
      Object.keys(q.reward).forEach(function(k){if(k!=='xp'&&k!=='gems')throw new Error(label+'任务 reward 含未知字段');});
      /* 🔴v1019: reward/isSpelling 不再比对内嵌副本(版本间必然走散), 只保留结构性校验
         🔴v1060 补齐 v1019 漏下的一半：当时只校验了 reward 的**字段名**，
         没校验**值**。于是伪造备份可以塞 {xp:'<img onerror=1>'} 或 {xp:1000001}，
         `test_backup_v942` 一直红着在报这件事。
         这里**不重新内嵌任务配置**（那正是 v1019 要摆脱的"两处真源"），
         只加与配置无关的结构性边界：必须是非负整数且不得离谱。 */
      ['xp','gems'].forEach(function(k){
        if(!(k in q.reward))return;
        if(!exactInt(q.reward[k],0,REWARD_MAX))
          throw new Error(label+'任务 '+q.id+' 的 reward.'+k+' 超出合法范围');
      });
      /* 🔴v1019: 进度上限以**存档自身的 goal** 为准, 不再比对内嵌副本 */
      if(!exactInt(q.progress,0,q.goal)||typeof q.claimed!=='boolean')throw new Error(label+'任务 '+q.id+' 的 progress/claimed 非法');
      /* 「已领取必须满进度」不再强制: 任务目标会随版本调整, 旧存档已领奖条目本就可能进度小于新目标(v1018 已在任务侧宽容), 备份不该因此拒绝保存用户数据。 */
    });
    if(o.allDay&&(!o.list.length||!o.list.every(function(q){return q.claimed&&q.progress===q.goal;})))throw new Error(label+'allDay 与任务领取状态不一致');
  }
  function globalQuestValue(k,v,mode){
    if(k!=='hansen_global_daily_quests_v941')return v;
    var o;try{o=JSON.parse(v);}catch(e){throw new Error((mode==='import'?'备份含':'当前存档含')+'无效全局任务 JSON');}
    var label=(mode==='import'?'备份含':'当前存档含')+'非法全局任务.';
    validateQuests(o,label);
    if(o.list.length>12)throw new Error(label+'list 必须最多 12 项');
    return v;
  }
  var CARD_ISLANDS={action:1,adjective:1,animal:1,body:1,city:1,clothes:1,color:1,family:1,food:1,home:1,job:1,nature:1,question:1,school:1,sports:1,time:1,traffic:1,treasure:1};
  function cardDataValue(k,v,mode){
    if(!/^hansen_card_data_[a-z0-9]+(?:_bak)?$/.test(k))return v;
    var o;try{o=JSON.parse(v);}catch(e){throw new Error((mode==='import'?'备份含':'当前存档含')+'无效 Boss 卡牌 JSON：'+k);}
    var label=(mode==='import'?'备份含':'当前存档含')+'非法 '+k+'.';
    if(!plainObject(o))throw new Error(label+'根对象必须是普通对象');
    Object.keys(o).forEach(function(f){if(!/^(?:islandClears|collected|masterUnlocked)$/.test(f))throw new Error(label+'含未知字段：'+f);});
    if(!plainObject(o.islandClears))throw new Error(label+'islandClears 必须是普通对象');
    Object.keys(o.islandClears).forEach(function(lv){
      if(!/^(?:[1-9]|1[0-9]|20)$/.test(lv))throw new Error(label+'islandClears 含非法关卡：'+lv);
      var list=o.islandClears[lv];if(!Array.isArray(list)||list.length>18)throw new Error(label+'islandClears['+lv+'] 必须是合理岛屿数组');
      var seen={};list.forEach(function(id){if(typeof id!=='string'||!CARD_ISLANDS[id]||seen[id])throw new Error(label+'islandClears['+lv+'] 含非法/重复岛屿');seen[id]=1;});
    });
    if(!Array.isArray(o.collected)||o.collected.length>20)throw new Error(label+'collected 必须是合理卡牌数组');
    var cards={};o.collected.forEach(function(lv){if(!exactInt(lv,1,20)||cards[lv])throw new Error(label+'collected 含非法/重复卡牌');cards[lv]=1;});
    if(typeof o.masterUnlocked!=='boolean'||(o.masterUnlocked&&o.collected.length!==20))throw new Error(label+'masterUnlocked 与收藏进度不一致');
    return v;
  }
  var CANONICAL_WORDS={action:67,adjective:51,animal:42,body:35,city:30,clothes:30,color:35,family:31,food:56,home:35,job:30,nature:40,question:32,school:38,sports:30,time:40,traffic:30,treasure:60,season:240};
  function validateCanonicalIndexMap(o,label,words,min,max){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    Object.keys(o).forEach(function(ix){
      if(!/^(?:0|[1-9][0-9]*)$/.test(ix)||Number(ix)>=words)throw new Error(label+'含非法 canonical 索引：'+ix);
      if(!exactInt(o[ix],min,max))throw new Error(label+'值必须是 '+min+'..'+max+' 的整数数字');
    });
  }
  function validateCanonicalSrs(o,label,words){
    if(!plainObject(o))throw new Error(label+'必须是普通对象');
    Object.keys(o).forEach(function(ix){
      if(!/^(?:0|[1-9][0-9]*)$/.test(ix)||Number(ix)>=words)throw new Error(label+'含非法 canonical 索引：'+ix);
      var e=o[ix];if(!plainObject(e))throw new Error(label+'['+ix+'] 必须是普通对象');
      Object.keys(e).forEach(function(f){if(!/^(?:box|due|last|updatedAt)$/.test(f))throw new Error(label+'['+ix+'] 含未知字段：'+f);});
      if(!exactInt(e.box,0,4)||!validDayText(e.due)||(e.last!==''&&!validDayText(e.last))||
          (Object.prototype.hasOwnProperty.call(e,'updatedAt')&&!exactInt(e.updatedAt,1,MAX_SAFE_INT)))throw new Error(label+'['+ix+'] 的复习计划无效');
    });
  }
  function canonicalValue(k,v,mode){
    if(k!=='hansen_canonical_progress_v941'&&k!=='hansen_canonical_progress_v941_bak')return v;
    var o;try{o=JSON.parse(v);}catch(e){throw new Error((mode==='import'?'备份含':'当前存档含')+'无效 canonical JSON：'+k);}
    var lead=(mode==='import'?'备份含':'当前存档含')+'非法 '+k+'.';
    if(!plainObject(o))throw new Error(lead+'根对象无效');
    Object.keys(o).forEach(function(f){if(f!=='version'&&f!=='islands')throw new Error(lead+'含未知根字段：'+f);});
    if(o.version!==941||!plainObject(o.islands))throw new Error(lead+'version/islands 无效');
    Object.keys(o.islands).forEach(function(id){
      if(!Object.prototype.hasOwnProperty.call(CANONICAL_WORDS,id))throw new Error(lead+'含未知岛屿：'+id);
      var p=o.islands[id],words=CANONICAL_WORDS[id];if(!plainObject(p))throw new Error(lead+id+' 必须是普通对象');
      Object.keys(p).forEach(function(f){if(!/^(?:learned|mc|wrongs|srs|cleared)$/.test(f))throw new Error(lead+id+' 含未知字段：'+f);});
      if(Object.prototype.hasOwnProperty.call(p,'learned')){
        if(!Array.isArray(p.learned)||p.learned.length>words)throw new Error(lead+id+'.learned 必须是合理长度的数组');
        var seen={};p.learned.forEach(function(ix){if(!exactInt(ix,0,words-1)||seen[ix])throw new Error(lead+id+'.learned 含非法/重复 canonical 索引');seen[ix]=1;});
      }
      if(Object.prototype.hasOwnProperty.call(p,'mc'))validateCanonicalIndexMap(p.mc,lead+id+'.mc',words,0,MAX_WORD_COUNT);
      if(Object.prototype.hasOwnProperty.call(p,'wrongs'))validateCanonicalIndexMap(p.wrongs,lead+id+'.wrongs',words,1,MAX_WORD_COUNT);
      if(Object.prototype.hasOwnProperty.call(p,'srs'))validateCanonicalSrs(p.srs,lead+id+'.srs',words);
      if(Object.prototype.hasOwnProperty.call(p,'cleared')){
        if(!plainObject(p.cleared))throw new Error(lead+id+'.cleared 必须是普通对象');
        Object.keys(p.cleared).forEach(function(f){if(!/^(?:learned|mc|wrongs|srs)$/.test(f))throw new Error(lead+id+'.cleared 含未知字段：'+f);validateCanonicalIndexMap(p.cleared[f],lead+id+'.cleared.'+f,words,1,MAX_SAFE_INT);});
      }
    });
    return v;
  }
  function wordIslandValue(k,v,mode){
    if(!/^wordIsland[A-Za-z0-9_:\-.]*$/.test(k))return v;
    var o;try{o=JSON.parse(v);}catch(e){throw new Error((mode==='import'?'备份含':'当前存档含')+'无效岛屿 JSON：'+k);}
    if(!plainObject(o))throw new Error((mode==='import'?'备份含':'当前存档含')+'无效岛屿根对象：'+k);
    var prefix=(mode==='import'?'备份含':'当前存档含')+'非法 '+k+'.';
    if(Object.prototype.hasOwnProperty.call(o,'wrongs'))validateIndexMap(o.wrongs,prefix+'wrongs',1,MAX_WORD_COUNT);
    if(Object.prototype.hasOwnProperty.call(o,'learned')){
      if(!Array.isArray(o.learned)||o.learned.length>MAX_WORD_ENTRIES)throw new Error(prefix+'learned 必须是合理长度的数组');
      o.learned.forEach(function(ix){if(!exactInt(ix,0,MAX_WORD_INDEX))throw new Error(prefix+'learned 只能包含非负整数单词索引');});
    }
    if(Object.prototype.hasOwnProperty.call(o,'mc'))validateIndexMap(o.mc,prefix+'mc',0,MAX_WORD_COUNT);
    if(Object.prototype.hasOwnProperty.call(o,'coinWordCount'))validateIndexMap(o.coinWordCount,prefix+'coinWordCount',0,3);
    if(Object.prototype.hasOwnProperty.call(o,'charXP')&&!exactInt(o.charXP,0,1000000000))throw new Error(prefix+'charXP 必须是合理的非负整数数字');
    if(Object.prototype.hasOwnProperty.call(o,'srs'))validateSrs(o.srs,prefix+'srs');
    if(Object.prototype.hasOwnProperty.call(o,'stats'))validateStats(o.stats,prefix+'stats.');
    if(Object.prototype.hasOwnProperty.call(o,'quests'))validateQuests(o.quests,prefix+'quests.');
    if(Object.prototype.hasOwnProperty.call(o,'pet'))validatePet(o.pet,prefix+'pet.');
    return v;
  }
  function committedValue(k,v,mode){
    if(!NESTED_TX[k])return v;
    var o;try{o=JSON.parse(v);}catch(e){throw new Error(k+'不是有效 JSON');}
    if(!o||typeof o!=='object'||Array.isArray(o))throw new Error(k+'的交易状态无效');
    // spent/prepared pending 都是运行期证明，绝不能被备份携带到另一次恢复中。
    // 导出只复制已提交资产/收据，不修改本机 pending；导入遇到伪造 pending 则严格拒绝。
    if(Object.prototype.hasOwnProperty.call(o,'pending')&&o.pending!==null&&o.pending!==undefined)throw new Error((mode==='import'?'备份含':'当前存档含')+'未完成交易：'+k);
    delete o.pending;return JSON.stringify(o);
  }
  function hasTransientWork(k,v){
    if(!transientKey(k))return false;
    if(typeof v!=='string'||!v.trim())return false;
    try{
      var o=JSON.parse(v);if(o===null)return false;
      if(Array.isArray(o))return o.length>0;
      if(typeof o==='object')return Object.keys(o).length>0;
      return !!o;
    }catch(e){return true;}
  }
  function collect(){
    var items=[];
    // 任何非空 pending/journal/transaction 都可能是扣款与交付之间唯一的续做证据。
    // 导出时绝不静默剥离；先让所属模块恢复/回滚完整，再生成 committed 备份。
    /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk1=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var ti=0;ti<_lsk1.length;ti++){
      var tk=_lsk1[ti];if(!transientKey(tk))continue;
      var tv=localStorage.getItem(tk);if(hasTransientWork(tk,tv))throw new Error('存在未完成事务 '+tk+'；请重新打开相关页完成安全恢复后再备份');
    }
    /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk2=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk2.length;i++){
      var k=_lsk2[i];if(!ownedKey(k))continue;
      var v=localStorage.getItem(k);if(typeof v==='string'){
        // 免费试用只存在运行期，不能随完整备份复制；真实装备等级/皮肤仍保留。
        if(k==='hansen_gear'){try{var g=JSON.parse(v);if(g&&typeof g==='object'){delete g.trialUntil;delete g.trialWeapon;v=JSON.stringify(g);}}catch(e){continue;}}
        v=committedValue(k,v,'export');
        v=wordIslandValue(k,v,'export');
        v=canonicalValue(k,v,'export');
        v=globalQuestValue(k,v,'export');
        v=cardDataValue(k,v,'export');
        v=roundStateValue(k,v,'export');
        items.push({key:k,value:v});
      }
    }
    items.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
    return items;
  }
  function stableItems(items){return items.map(function(x){return x.key+'\u0000'+x.value;}).join('\u0001');}
  function checksum(s){var h=2166136261;s=String(s||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv1a32-'+(h>>>0).toString(16).padStart(8,'0');}
  function build(){
    var items=collect();
    // 生成器和导入器必须共用同一合同：绝不返回一份自己都拒绝恢复的备份。
    var payload={kind:'full-player-data',schema:SCHEMA,schemaVersion:SCHEMA_VERSION,appVersion:CURRENT_APP_VERSION,createdAt:new Date().toISOString(),items:items,checksum:checksum(stableItems(items))};
    return validate(payload);
  }
  function toText(payload){return JSON.stringify(payload,null,2);}
  function toCode(payload){return btoa(unescape(encodeURIComponent(toText(payload))));}
  function parseInput(input){
    var s=String(input||'').trim();if(!s)throw new Error('备份内容为空');
    var o=null;
    try{o=JSON.parse(s);}catch(e){
      try{o=JSON.parse(decodeURIComponent(escape(atob(s))));}catch(e2){throw new Error('不是有效的 JSON 或备份代码');}
    }
    return validate(o);
  }
  function validate(o){
    if(!o||typeof o!=='object'||Array.isArray(o))throw new Error('备份根对象无效');
    if(o.kind!=='full-player-data'||o.schema!==SCHEMA||o.schemaVersion!==SCHEMA_VERSION)throw new Error('备份类型或 schema 不受支持');
    var appVersion=Number(o.appVersion);if(!isFinite(appVersion)||appVersion<=0||Math.floor(appVersion)!==appVersion)throw new Error('备份缺少有效的应用版本');
    if(!supportedJournalAppVersion(appVersion))throw new Error('备份版本 v'+appVersion+' 不受当前 v'+CURRENT_APP_VERSION+' 支持');
    if(!Array.isArray(o.items)||o.items.length>MAX_ITEMS)throw new Error('备份条目数量超限');
    var seen={},total=0,items=[];
    o.items.forEach(function(x){
      if(!x||typeof x!=='object'||!ownedKey(x.key)||typeof x.value!=='string')throw new Error('备份含非法键或非字符串值');
      var committed=committedValue(x.key,x.value,'import');if(committed!==x.value)throw new Error('备份含运行期 pending 字段：'+x.key);
      wordIslandValue(x.key,x.value,'import');
      canonicalValue(x.key,x.value,'import');
      globalQuestValue(x.key,x.value,'import');
      cardDataValue(x.key,x.value,'import');
      roundStateValue(x.key,x.value,'import');
      if(x.key==='hansen_pet_hero_img'&&!/^pets\/pet_\d{2}\.webp(?:\?v=\d+)?$/.test(x.value))throw new Error('宠物首帧图片路径非法');
      if(x.key==='hansen_gear'){try{var gear=JSON.parse(x.value);if(!gear||typeof gear!=='object'||Object.prototype.hasOwnProperty.call(gear,'trialUntil')||Object.prototype.hasOwnProperty.call(gear,'trialWeapon'))throw new Error('装备备份含试用字段');}catch(ge){throw new Error('装备备份无效或含试用字段');}}
      if(seen[x.key])throw new Error('备份含重复键：'+x.key);seen[x.key]=1;
      var bytes=x.value.length*2;if(bytes>MAX_VALUE)throw new Error('单项数据过大：'+x.key);total+=bytes;
      if(total>MAX_TOTAL)throw new Error('备份总体积超过 12MB');
      items.push({key:x.key,value:x.value});
    });
    items.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
    if(o.checksum!==checksum(stableItems(items)))throw new Error('校验和不匹配，备份可能不完整或被改动');
    return {kind:'full-player-data',schema:SCHEMA,schemaVersion:SCHEMA_VERSION,appVersion:appVersion,createdAt:String(o.createdAt||''),items:items,checksum:o.checksum};
  }
  /* 🔴v1090 双保险：恢复/回滚同样不许碰凭证。
     ownedKey 已经排除了，但 transientKey/derivedKey 是另外两条通路，
     而**旧备份里可能已经存着凭证**（v1019~v1089 期间产生的都可能有）。
     一旦被写回去，就会重演本次事故：旧 refresh_token → invalid_grant → 凭证被删。
     所以在最外层再拦一次，任何路径都别想把凭证写回去。 */
  function rawEntryAllowed(k){
    if(credentialKey(k))return false;
    return k!==RESTORE_JOURNAL&&(ownedKey(k)||transientKey(k)||derivedKey(k));
  }
  function validateRawSnapshot(list){
    if(!Array.isArray(list)||list.length>MAX_ITEMS*2)throw new Error('恢复日志快照数量无效');
    var seen={},total=0,out=[];
    list.forEach(function(x){
      if(!x||typeof x!=='object'||!rawEntryAllowed(x.key)||typeof x.value!=='string')throw new Error('恢复日志含非法玩家键');
      if(seen[x.key])throw new Error('恢复日志含重复键：'+x.key);seen[x.key]=1;
      var bytes=x.value.length*2;if(bytes>MAX_VALUE)throw new Error('恢复日志单项过大：'+x.key);total+=bytes;
      if(total>MAX_TOTAL*2)throw new Error('恢复日志快照总体积过大');
      out.push({key:x.key,value:x.value});
    });
    return out;
  }
  function snapshotRaw(){
    var out=[];
    /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk3=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk3.length;i++){
      var k=_lsk3[i];if(!rawEntryAllowed(k))continue;
      var v=localStorage.getItem(k);if(typeof v!=='string')throw new Error('无法读取恢复前快照：'+k);
      out.push({key:k,value:v});
    }
    out.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
    return validateRawSnapshot(out);
  }
  function removeJournal(){
    localStorage.removeItem(RESTORE_JOURNAL);
    if(localStorage.getItem(RESTORE_JOURNAL)!==null)throw new Error('恢复日志清理失败');
  }
  function writeJournal(phase,beforeRaw){
    beforeRaw=validateRawSnapshot(beforeRaw);
    var raw=JSON.stringify({schema:JOURNAL_SCHEMA,appVersion:CURRENT_APP_VERSION,phase:phase,beforeRaw:beforeRaw,checksum:checksum(stableItems(beforeRaw))});
    localStorage.setItem(RESTORE_JOURNAL,raw);
    if(localStorage.getItem(RESTORE_JOURNAL)!==raw)throw new Error('恢复日志写入校验失败');
  }
  function restoreRaw(list){
    list=validateRawSnapshot(list);
    var remove=[];
    /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk4=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk4.length;i++){var k=_lsk4[i];if(rawEntryAllowed(k))remove.push(k);}
    remove.forEach(function(k){localStorage.removeItem(k);if(localStorage.getItem(k)!==null)throw new Error('原始玩家快照清理失败：'+k);});
    list.forEach(function(x){localStorage.setItem(x.key,x.value);if(localStorage.getItem(x.key)!==x.value)throw new Error('原始玩家快照回滚失败：'+x.key);});
  }
  function readJournal(){
    var raw=localStorage.getItem(RESTORE_JOURNAL);if(raw===null)return null;
    var o;try{o=JSON.parse(raw);}catch(e){throw new Error('恢复日志 JSON 损坏');}
    if(!o||typeof o!=='object'||Array.isArray(o)||o.schema!==JOURNAL_SCHEMA||!supportedJournalAppVersion(o.appVersion)||(o.phase!=='prepared'&&o.phase!=='committed'))throw new Error('恢复日志结构无效');
    var beforeRaw=validateRawSnapshot(o.beforeRaw);
    if(o.checksum!==checksum(stableItems(beforeRaw)))throw new Error('恢复日志校验和不匹配');
    return {phase:o.phase,beforeRaw:beforeRaw};
  }
  function recoverRestoreJournal(){
    var j;
    try{j=readJournal();}
    catch(invalid){
      // 无法验证的日志永远不得驱动玩家数据写入，也不能静默删除唯一的恢复证据。
      throw invalid;
    }
    if(!j)return {recovered:false};
    if(j.phase==='prepared')restoreRaw(j.beforeRaw);
    removeJournal();
    return {recovered:true,rolledBack:j.phase==='prepared',committed:j.phase==='committed'};
  }
  function applyTarget(list){
    var keep={};list.forEach(function(x){keep[x.key]=1;});
    var remove=[];
    /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk5=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk5.length;i++){
      var k=_lsk5[i];if(k===RESTORE_JOURNAL)continue;
      if((ownedKey(k)&&!keep[k])||transientKey(k)||derivedKey(k))remove.push(k);
    }
    remove.forEach(function(k){localStorage.removeItem(k);if(localStorage.getItem(k)!==null)throw new Error('删除校验失败：'+k);});
    list.forEach(function(x){localStorage.setItem(x.key,x.value);if(localStorage.getItem(x.key)!==x.value)throw new Error('写入校验失败：'+x.key);});
  }
  function replaceAll(items){
    recoverRestoreJournal();
    var beforeRaw=snapshotRaw(),committed=false;
    // 日志必须在第一次删除/写入之前严格落盘；空间不足则零变更失败。
    writeJournal('prepared',beforeRaw);
    try{
      applyTarget(items);
      writeJournal('committed',beforeRaw);committed=true;
      try{removeJournal();}catch(cleanupErr){/* 已提交；下次启动只清日志，不回滚目标。 */}
    }catch(err){
      if(!committed){
        try{restoreRaw(beforeRaw);}catch(rollbackErr){throw new Error('恢复失败，且自动回滚未完整成功：'+rollbackErr.message);}
        try{removeJournal();}catch(cleanupErr){}
        throw new Error('恢复失败，已自动回滚到操作前：'+err.message);
      }
      throw err;
    }
    return items.length;
  }
  function status(msg,ok){var el=document.getElementById('hsnBackupStatus');if(el){el.textContent=msg;el.style.color=ok===false?'#fca5a5':'#86efac';}}
  function exportToArea(){
    try{
      var code=toCode(build()),ta=document.getElementById('hsnBackupArea');if(ta){ta.value=code;ta.select();}
      try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).catch(function(){});}catch(e){}
      status('✅ 完整备份已生成（'+code.length+' 字符），可复制保存。',true);return code;
    }catch(e){status('❌ 备份未生成：'+e.message,false);return '';} 
  }
  function download(){
    try{
      var payload=build(),blob=new Blob([toText(payload)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download='单词大冒险_完整备份_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);status('✅ 完整备份文件已生成。',true);return true;
    }catch(e){status('❌ 备份未生成：'+e.message,false);return false;}
  }
  function currentResetKeys(){
    var saveKey=String(root.__hsnSaveKey||'');if(!saveKey)throw new Error('当前页面尚未提供存档键');
    var journalKey='';try{if(typeof root.__hsnResetJournalKey==='function')journalKey=String(root.__hsnResetJournalKey()||'');}catch(e){}
    if(!journalKey)journalKey='hansen_reset_pending_v942:'+saveKey;
    return {saveKey:saveKey,journalKey:journalKey,bakKey:saveKey+'_bak'};
  }
  function buildResetForensic(){
    var keys=currentResetKeys(),journal=localStorage.getItem(keys.journalKey);
    if(journal===null)throw new Error('当前岛没有可导出的重置日志');
    var items=[{role:'reset-journal',key:keys.journalKey,value:journal}];
    [{role:'current-main',key:keys.saveKey},{role:'previous-good',key:keys.bakKey}].forEach(function(x){
      var v=localStorage.getItem(x.key);if(v!==null)items.push({role:x.role,key:x.key,value:v});
    });
    var total=0;items.forEach(function(x){if(typeof x.value!=='string'||x.value.length*2>MAX_VALUE)throw new Error('取证项过大：'+x.key);total+=x.value.length*2;});
    if(total>MAX_TOTAL)throw new Error('重置取证包超过 12MB');
    var sumItems=items.map(function(x){return {key:x.role+':'+x.key,value:x.value};});
    return {kind:'diagnostic-only-not-restorable',schema:FORENSIC_SCHEMA,schemaVersion:1,appVersion:CURRENT_APP_VERSION,createdAt:new Date().toISOString(),warning:'只读取证包；不能直接导入或恢复。请保留原文件供人工判断。',items:items,checksum:checksum(stableItems(sumItems))};
  }
  function downloadResetForensic(){
    try{
      var keys=currentResetKeys(),payload=buildResetForensic(),blob=new Blob([toText(payload)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download='单词大冒险_v1136_重置故障取证_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
      forensicExported[keys.journalKey]=true;status('✅ 只读重置取证包已生成；它不会修改存档，也不能直接导入。',true);return true;
    }catch(e){status('❌ 取证包未生成：'+e.message,false);return false;}
  }
  function discardInvalidResetJournal(){
    try{
      var keys=currentResetKeys(),j=typeof root.__hsnReadResetPending==='function'?root.__hsnReadResetPending():null;
      if(!j||!j.__invalid)throw new Error('只允许放弃已被严格校验判定为损坏的当前岛日志');
      if(!forensicExported[keys.journalKey])throw new Error('请先下载只读重置取证包');
      if(typeof root.confirm!=='function'||!root.confirm('放弃损坏日志后，系统将无法自动判断重置进行到哪一步。确定已保存取证包并继续？'))return false;
      if(!root.confirm('最后确认：只删除当前岛的损坏重置日志并重新加载？主存档和备份不会在此步骤改动。'))return false;
      localStorage.removeItem(keys.journalKey);if(localStorage.getItem(keys.journalKey)!==null)throw new Error('损坏日志删除失败');
      if(root.location&&typeof root.location.reload==='function')root.location.reload();return true;
    }catch(e){status('❌ '+e.message,false);return false;}
  }
  function restore(input){var p=parseInput(input),n=replaceAll(p.items);return {items:n,appVersion:p.appVersion,createdAt:p.createdAt};}
  function restoreFromArea(){
    var ta=document.getElementById('hsnBackupArea'),text=ta?ta.value:'';
    function go(){try{var r=restore(text);status('✅ 已恢复 '+r.items+' 项数据，正在刷新…',true);setTimeout(function(){location.reload();},500);}catch(e){status('❌ '+e.message,false);}}
    if(typeof root.showConfirmMsg==='function')root.showConfirmMsg('确定恢复这份完整备份吗？\n当前游戏数据会被备份内容整体替换；失败会自动回滚。',go);else go();
  }
  function loadFile(ev){
    var file=ev&&ev.target&&ev.target.files&&ev.target.files[0];if(!file)return;
    if(file.size>MAX_TOTAL) {status('❌ 文件超过 12MB 上限',false);return;}
    var rd=new FileReader();rd.onload=function(){var ta=document.getElementById('hsnBackupArea');if(ta)ta.value=String(rd.result||'');status('✅ 文件已读取，请点击“校验并恢复”。',true);};
    rd.onerror=function(){status('❌ 文件读取失败',false);};rd.readAsText(file);ev.target.value='';
  }
  function inject(){
    var box=document.getElementById('settingsContent');if(!box||document.getElementById('hsnBackupSection'))return;
    var sec=document.createElement('div');sec.className='settings-section';sec.id='hsnBackupSection';
    sec.innerHTML='<h3>💾 完整备份与恢复</h3><div class="desc">备份覆盖所有岛屿进度、金币、钻石、宠物、成就、签到和设置。恢复前会校验版本、白名单、体积与校验和；写入失败会自动回滚，中途关页也会在下次启动恢复到操作前，不会执行备份中的任何代码。</div><textarea id="hsnBackupArea" spellcheck="false" style="width:100%;min-height:96px;margin-top:10px;border-radius:10px;padding:9px;background:#0f172a;color:#cbd5e1;border:1px solid #475569;font-size:11px" placeholder="点击生成备份，或粘贴完整备份代码 / JSON"></textarea><div class="btn-row" style="flex-wrap:wrap;gap:7px;margin-top:9px"><button class="small-btn gold" id="hsnBackupCopy">📋 生成并复制</button><button class="small-btn purple" id="hsnBackupDownload">⬇️ 下载 JSON</button><label class="small-btn purple" style="cursor:pointer">📂 选择备份文件<input id="hsnBackupFile" type="file" accept="application/json,.json,.txt" style="display:none"></label><button class="small-btn" id="hsnBackupRestore">♻️ 校验并恢复</button></div><div class="desc" style="margin-top:12px">若页面提示“重置安全日志已损坏”，普通完整备份会拒绝携带未完成事务。请先下载只读取证包（当前日志 + 主档 + 上一份安全快照）；只有接受人工判断风险时，才双重确认放弃损坏日志。</div><div class="btn-row" style="flex-wrap:wrap;gap:7px;margin-top:7px"><button class="small-btn purple" id="hsnResetForensic">🧾 下载重置取证包</button><button class="small-btn" id="hsnResetDiscard" style="font-family:system-ui,-apple-system,sans-serif">⚠️ 放弃损坏重置日志</button></div><div id="hsnBackupStatus" aria-live="polite" style="min-height:18px;margin-top:8px;font-size:12px"></div>';
    box.appendChild(sec);
    var discardButton=document.getElementById('hsnResetDiscard');
    if(discardButton)discardButton.style.setProperty('font-family','system-ui,-apple-system,sans-serif','important');
    document.getElementById('hsnBackupCopy').onclick=exportToArea;document.getElementById('hsnBackupDownload').onclick=download;
    document.getElementById('hsnBackupRestore').onclick=restoreFromArea;document.getElementById('hsnBackupFile').onchange=loadFile;
    document.getElementById('hsnResetForensic').onclick=downloadResetForensic;document.getElementById('hsnResetDiscard').onclick=discardInvalidResetJournal;
  }
  function hookSettings(){
    if(typeof root.renderSettings!=='function')return setTimeout(hookSettings,200);
    if(root.renderSettings.__hansenBackup)return;var orig=root.renderSettings;
    root.renderSettings=function(){var r=orig.apply(this,arguments);inject();return r;};root.renderSettings.__hansenBackup=true;
    try{var s=document.getElementById('settingsScreen');if(s&&(s.classList.contains('active')||s.classList.contains('show')))inject();}catch(e){}
  }

  var startupRecovery=null;try{startupRecovery=recoverRestoreJournal();}catch(recoveryErr){startupRecovery={recovered:false,error:recoveryErr.message};root.__hansenBackupRecoveryError=recoveryErr.message;}
  root.HansenBackup={schema:SCHEMA,schemaVersion:SCHEMA_VERSION,/* v1081: 面板要显示版本号——此前无法确认用户手机上跑的是哪一版，改了五版都不知有没有生效 */appVersion:function(){return CURRENT_APP_VERSION;},build:build,exportCode:function(){return toCode(build());},parse:parseInput,restore:restore,exportToArea:exportToArea,download:download,restoreFromArea:restoreFromArea,loadFile:loadFile,isOwnedKey:ownedKey,recoverRestoreJournal:recoverRestoreJournal,startupRecovery:startupRecovery,buildResetForensic:buildResetForensic,downloadResetForensic:downloadResetForensic,discardInvalidResetJournal:discardInvalidResetJournal,_replaceAll:replaceAll,_journalKey:RESTORE_JOURNAL};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hookSettings);else hookSettings();
})(typeof window!=='undefined'?window:this);
