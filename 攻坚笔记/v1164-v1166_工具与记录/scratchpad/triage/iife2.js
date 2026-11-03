(function(){
'use strict';
var PW_SHA='603496ea13d3aa14a70ad2a79b7d6d138b3dfb0448441ac7cd14e0ef9358ecd6';
var PW_DJB=346366539;
var LSK='hansen_bossfx_override', SSK='hansen_bossfx_auth';
/* 🔴 v538(Hansen 定稿): 双入口重构。
   ① 用户入口(设置行): 不再提密码——通关全部 18 个常规岛的所有 boss(每岛 Lv1~20, 共360关)解锁, 解锁前🔒+进度提示, 解锁后免密直接进面板(用户模式)。
   ② 管理员入口(伪装): 底部「…进度自动保存到本设备」一行外观零变化, 点击弹「输入密码」极简框(可粘贴·copy_protect 对 input 豁免);
      连续输错 3 次(跨会话累计·无时限·输对一次清零重计)→永久锁定: 点击毫无反应。计数与锁双存 localStorage+IndexedDB(清档也难抹), 键名隐蔽不含 pw/boss 字样。
      密码只存 SHA-256(PW_SHA)+djb2 双指纹, 明文不在任何代码/存储中出现——爬走的只能是乱码。 */
var L_N='__hsn_sys_a', L_LK='__hsn_sys_b';
/* 🔴 v539(Hansen 定稿): 管理员面板「卡牌入口」二级密码门——SHA-256+djb2 双指纹(明文不出现在任何代码), 10 秒倒计时(超时未提交=记一次错), 连续错 3 次该入口永久关闭(点击零反应), 输对清零重计; 计数/锁双存 localStorage(__hsn_sys_c/d)+IndexedDB('c'/'d'), 开机 idbReconcile 校正抗清档。成功=hansenTempUnlock(24h 临时全解锁, 只影响显示不污染真实存档)。 */
var C_N='__hsn_sys_c', C_LK='__hsn_sys_d';
var CARD_SHA='bb00f979cb70044ae85e54906d2b96f24b7211714ef57c88b0596231540d2713';
var CARD_DJB=3674270565;
var ISLES=['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school','sports','time','traffic','treasure'];
function islandKey(isle){ return 'wordIsland'+isle.charAt(0).toUpperCase()+isle.slice(1); }
var CLEARALL_ON='hansen_admin_clearall_on', CLEARALL_BAK='hansen_admin_clearall_bak';
function isAllBossClearOn(){ try{ return localStorage.getItem(CLEARALL_ON)==='1'; }catch(e){ return false; } }
function bossClearProgress(){
  var total=ISLES.length*20;
  if(isAllBossClearOn()){ return {done:total,total:total,all:true}; } /* 🔴 v804: 管理员"一键通关"开关 ON → 直接视为全通关 */
  var done=0;
  for(var i=0;i<ISLES.length;i++){
    var k=islandKey(ISLES[i]), s=null;
    try{ s=JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ s=null; }
    if(!s||typeof s!=='object') continue;
    for(var lv=1;lv<=20;lv++){
      if((s.bossWins&&s.bossWins[lv]>=1)||(Array.isArray(s.bossWon)&&s.bossWon.indexOf(lv)>=0)) done++;
    }
  }
  return {done:done,total:total,all:done>=total};
}
/* 🔴 v804: 管理员"一键通关所有 Boss"——ON: 先把各岛真实进度备份, 再给 18 岛全部 20 关写满 bossWon/bossWins(=游戏读到全通关); OFF: 从备份精确还原。只动 boss 通关两个字段, 其余存档一律不碰。reversible。 */
function setAllBossClear(on){
  try{
    var CISLES=ISLES.concat(['season']);  //🔴v806: 一键通关也覆盖赛季岛(wordIslandSeason·islandKey('season')·同 lv1-20+bossWon 结构)→ 赛季6守关boss全算进去全通关。ISLES(18)仍供 bossClearProgress 的360计数用·不破坏入口闸
    if(on){
      if(!localStorage.getItem(CLEARALL_BAK)){
        var bak={};
        for(var i=0;i<CISLES.length;i++){ var k=islandKey(CISLES[i]); var s=null; try{s=JSON.parse(localStorage.getItem(k)||'null');}catch(e){}
          if(s&&typeof s==='object'){ bak[k]={ex:1, bw:(s.bossWins&&typeof s.bossWins==='object')?s.bossWins:null, bn:Array.isArray(s.bossWon)?s.bossWon.slice():null, bu:(typeof s.bossUnlocked==='number'&&isFinite(s.bossUnlocked))?s.bossUnlocked:null}; }
          else { bak[k]={ex:0}; } }
        try{localStorage.setItem(CLEARALL_BAK,JSON.stringify(bak));}catch(e){}
      }
      for(var j=0;j<CISLES.length;j++){ var k2=islandKey(CISLES[j]); var s2=null; try{s2=JSON.parse(localStorage.getItem(k2)||'null');}catch(e){} if(!s2||typeof s2!=='object')s2={};
        var bw=(s2.bossWins&&typeof s2.bossWins==='object')?s2.bossWins:{}; var won=[];
        for(var lv=1;lv<=20;lv++){ if(!(bw[lv]>=3))bw[lv]=3; won.push(lv); }  //🔴v807: 每关 bossWins 写满3次(≥getRequiredWins: lv1需1/lv2需2/lv3-19需3)→ 即使 hansen_boss_progress.js 的 v319 迁移按 bossWins 重算 bossUnlocked 也会算出20·不会把我们写的解锁覆盖回低关
        s2.bossWins=bw; s2.bossWon=won; s2.bossUnlocked=20;  //🔴v807: boss 的「锁」由 bossUnlocked(解锁到第几关·getUnlockedBossLv/选关界面读它·非 bossWon)控制 → 一键通关必须把 bossUnlocked 也写满20, 否则 boss 仍是加锁状态(v804/v806 只写 bossWon 是不够的·赛季岛/常规岛同此机制)
        try{localStorage.setItem(k2,JSON.stringify(s2));}catch(e){} }
      /* 🔴v884(Hansen: 密码/一键通关要能进单词大陆关卡): 一键通关也写满8个单词大陆岛的 landN_prog(land岛关卡解锁靠landN_prog·非bossUnlocked)。备份原值→关闭时还原。 */
      try{ var _lbak={}; for(var _li=1;_li<=8;_li++){ var _lk='land'+_li+'_prog'; _lbak[_lk]=localStorage.getItem(_lk); localStorage.setItem(_lk,'8'); } localStorage.setItem('hansen_admin_landprog_bak',JSON.stringify(_lbak)); }catch(e){}
      try{localStorage.setItem(CLEARALL_ON,'1');}catch(e){}
    } else {
      /* 🔴v884: 关闭一键通关→还原8个landN_prog真实值 */
      try{ var _lbs=localStorage.getItem('hansen_admin_landprog_bak'); if(_lbs){ var _lb=JSON.parse(_lbs); for(var _lk in _lb){ if(_lb[_lk]==null){ localStorage.removeItem(_lk); } else { localStorage.setItem(_lk,_lb[_lk]); } } localStorage.removeItem('hansen_admin_landprog_bak'); } }catch(e){}
      var bakStr=null; try{bakStr=localStorage.getItem(CLEARALL_BAK);}catch(e){}
      var b=bakStr?JSON.parse(bakStr):null;
      if(b){ for(var m=0;m<CISLES.length;m++){ var k3=islandKey(CISLES[m]); var rec=b[k3]; if(!rec)continue;
        var s3=null; try{s3=JSON.parse(localStorage.getItem(k3)||'null');}catch(e){}
        if(!rec.ex){ /* 开启前本无此岛存档 → 删我们写入的三个字段, 若整条空了就移除 */
          if(s3&&typeof s3==='object'){ delete s3.bossWins; delete s3.bossWon; delete s3.bossUnlocked;
            try{ if(Object.keys(s3).length===0){localStorage.removeItem(k3);}else{localStorage.setItem(k3,JSON.stringify(s3));} }catch(e){} } }
        else if(s3&&typeof s3==='object'){
          if(rec.bw!=null){s3.bossWins=rec.bw;}else{delete s3.bossWins;}
          if(rec.bn!=null){s3.bossWon=rec.bn;}else{delete s3.bossWon;}
          if(rec.bu!=null){s3.bossUnlocked=rec.bu;}else{delete s3.bossUnlocked;}
          try{localStorage.setItem(k3,JSON.stringify(s3));}catch(e){} } } }
      try{localStorage.removeItem(CLEARALL_BAK);}catch(e){}
      try{localStorage.removeItem(CLEARALL_ON);}catch(e){}
    }
  }catch(e){}
}
function idbKV(mode,fn){ try{ if(!window.indexedDB)return; var q=indexedDB.open('hsn_sys',1);
  q.onupgradeneeded=function(){ try{ q.result.createObjectStore('kv'); }catch(e){} };
  q.onsuccess=function(){ try{ fn(q.result.transaction('kv',mode).objectStore('kv')); }catch(e){} };
  q.onerror=function(){};
}catch(e){} }
function isLocked(){ try{ return localStorage.getItem(L_LK)==='1'; }catch(e){ return false; } }
function cardLocked(){ try{ return localStorage.getItem(C_LK)==='1'; }catch(e){ return false; } }
function cardLockNow(){ try{ localStorage.setItem(C_LK,'1'); }catch(e){} idbKV('readwrite',function(st){ try{ st.put('1','d'); }catch(e){} }); }
function getCardFails(){ try{ return parseInt(localStorage.getItem(C_N)||'0',10)||0; }catch(e){ return 0; } }
function setCardFails(n){ try{ localStorage.setItem(C_N,String(n)); }catch(e){} idbKV('readwrite',function(st){ try{ st.put(String(n),'c'); }catch(e){} }); }
function checkCardPw(pw,cb){
  if(window.crypto&&crypto.subtle&&crypto.subtle.digest){
    try{
      crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw)).then(function(buf){
        var hex=Array.prototype.map.call(new Uint8Array(buf),function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
        cb(hex===CARD_SHA);
      }).catch(function(){cb(djb2(pw)===CARD_DJB&&pw.length===6);});
      return;
    }catch(e){}
  }
  cb(djb2(pw)===CARD_DJB&&pw.length===6);
}
function lockNow(){ try{ localStorage.setItem(L_LK,'1'); }catch(e){} idbKV('readwrite',function(st){ try{ st.put('1','b'); }catch(e){} }); }
function getFails(){ try{ return parseInt(localStorage.getItem(L_N)||'0',10)||0; }catch(e){ return 0; } }
function setFails(n){ try{ localStorage.setItem(L_N,String(n)); }catch(e){} idbKV('readwrite',function(st){ try{ st.put(String(n),'a'); }catch(e){} }); }
function idbReconcile(){ idbKV('readonly',function(st){ try{
  var ga=st.get('a'); ga.onsuccess=function(){ try{ var v=parseInt(ga.result||'0',10)||0; if(v>getFails()){ localStorage.setItem(L_N,String(v)); } if(v>=3){ try{localStorage.setItem(L_LK,'1');}catch(e){} } }catch(e){} };
  var gb=st.get('b'); gb.onsuccess=function(){ try{ if(gb.result==='1'){ localStorage.setItem(L_LK,'1'); } }catch(e){} };
  var gc=st.get('c'); gc.onsuccess=function(){ try{ var v=parseInt(gc.result||'0',10)||0; if(v>getCardFails()){ localStorage.setItem(C_N,String(v)); } if(v>=3){ try{localStorage.setItem(C_LK,'1');}catch(e){} } }catch(e){} };
  var gd=st.get('d'); gd.onsuccess=function(){ try{ if(gd.result==='1'){ localStorage.setItem(C_LK,'1'); } }catch(e){} };
}catch(e){} }); }
var BOSSES=[
 {n:'淘气小幽灵',lv:'Lv1',mv:'淘气捉迷藏',pal:'灵蓝',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'暗影忍者',lv:'Lv2',mv:'影舞三连杀',pal:'暗影紫',ps:['sz','sp','fxi'],df:{sz:86,sp:100,fxi:100}},
 {n:'百战兽人',lv:'Lv3',mv:'百战连锤',pal:'熔岩',ps:['sz','sp','fxi'],df:{sz:70,sp:100,fxi:100}},
 {n:'史前霸王龙',lv:'Lv4',mv:'远古之怒·灭绝之颚',pal:'琥珀',ps:['sz','sp','fxi'],df:{sz:50,sp:100,fxi:100}},
 {n:'千年僵尸',lv:'Lv5',mv:'定身符咒·万拳齐发',pal:'剧毒',ps:['sz','sp','fxi'],df:{sz:50,sp:100,fxi:200}},
 {n:'暗夜吸血鬼',lv:'Lv6',mv:'血月蝠群',pal:'猩红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:130}},
 {n:'蒙面大魔王',lv:'Lv7',mv:'魅影假面',pal:'王者',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'地狱犬王',lv:'Lv8',mv:'地狱之门(经典)',pal:'烈焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'黑森林巫婆',lv:'Lv9',mv:'魔釜诅咒',pal:'巫毒',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'异次元巫师',lv:'Lv10',mv:'次元裂隙',pal:'异界',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'龙骑士统帅',lv:'Lv11',mv:'龙焰天降',pal:'烈焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'暗黑灯神',lv:'Lv12',mv:'灯神诅咒',pal:'暗黑',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'海底巨怪',lv:'Lv13',mv:'深渊海啸',pal:'深渊',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'寒冰女王',lv:'Lv14',mv:'极寒风暴',pal:'寒冰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'烈焰魔神',lv:'Lv15',mv:'末日陨星',pal:'烈焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'雷电之主',lv:'Lv16',mv:'雷霆审判',pal:'苍雷蓝',ps:['sz','sp','fxi'],df:{sz:140,sp:100,fxi:160}},
 {n:'机械泰坦',lv:'Lv17',mv:'歼灭协议·泰坦终结斩',pal:'猩红警戒',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'外星霸主',lv:'Lv18',mv:'歼星协议·轨道湮灭',pal:'异星翠绿',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'混沌魔尊',lv:'Lv19',mv:'深渊审判·地狱之门',pal:'深渊魔紫',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:160}},
 {n:'上古太阳神',lv:'Lv20',mv:'创世神谕·天降太阳',pal:'鎏金圣阳',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'铸星者·原初匠人',lv:'赛季',mv:'创世锻造',pal:'熔金星核',ps:['sz','sp','fxi'],df:{sz:55,sp:100,fxi:100}},
 {n:'统御天使·圣光之翼',lv:'赛季',mv:'圣光裁决',pal:'纯白圣光',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'无光之渊·暗噬君主',lv:'赛季',mv:'锁魂囚渊',pal:'渊狱紫',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'时之君主·克罗诺斯之影',lv:'赛季',mv:'终焉时刻',pal:'时空金青',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'终末观测者·边界守夜人',lv:'赛季',mv:'星图烙印',pal:'观测青·末日红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'暗影先锋·破阵者',lv:'岛②',mv:'猎手处决',pal:'猎手全息红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'武器大师·战争铁砧',lv:'岛②',mv:'全武库压制',pal:'焦土火橙',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'星陨武士·流亡之刃',lv:'岛⑦',mv:'星陨连斩',pal:'银蓝孤星',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'机械主教·组装者',lv:'岛④',mv:'全功率复产',pal:'工业机红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'活体行星·古老意志',lv:'岛⑧',mv:'引力坍塌',pal:'深蓝金环',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'星核帝皇·弗沙欧',lv:'岛⑧',mv:'三皇归一·终焉白光',pal:'终焉白金',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'万典之灵·未被写下的故事',lv:'岛③',mv:'删除线终结',pal:'典籍金蓝',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'不动明王·焚天镇狱尊',lv:'岛⑤',mv:'焚天镇狱',pal:'烈阳金焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'亡灵咒术师·阿努比斯之影',lv:'岛⑥',mv:'灵魂剥离',pal:'银蓝冷焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'古埃及大祭司·真理之口的裁决者',lv:'岛⑥',mv:'有罪判决',pal:'审判金光',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'夜罗刹·红莲战鬼',lv:'岛⑤',mv:'红莲圣域·万瓣天葬',pal:'红莲圣域',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'天界守护者·黄金斯芬克斯',lv:'岛⑥',mv:'日轮审判',pal:'圣金翼日',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'未成形之神·万形之胚',lv:'岛①',mv:'万形归一',pal:'虹彩胚光',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'法老王·不朽金身',lv:'岛⑥',mv:'诅咒爆',pal:'不朽鎏金',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'破坏神·终焉之相',lv:'岛⑤',mv:'终焉湮灭',pal:'终焉紫电',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'虫群先锋·刃翼领主',lv:'岛①',mv:'虫群涌来',pal:'毒紫虫光',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'诅咒之躯·绷带亡骸',lv:'岛⑥',mv:'巨手擒抱',pal:'诅咒幽绿',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'逆相之影·镜渊领主',lv:'岛①',mv:'万镜归渊',pal:'碎镜冷银',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'万械之神·奥米伽',lv:'岛④',mv:'核心巨激光',pal:'机神蓝核',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'丛林幽灵·兵王',lv:'岛②',mv:'齐爆',pal:'丛林夜袭',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'决斗大师·千招之约',lv:'岛②',mv:'正拳',pal:'落日武魂',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'凋零与新生之龙·四季轮转',lv:'岛③',mv:'春樱→夏炎→秋叶→冬雪 四季轮转',pal:'四季轮转',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'剑神·万剑归一',lv:'岛⑤',mv:'万剑归一',pal:'万剑银青',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'天启征服者·索拉里斯',lv:'岛⑧',mv:'天启重置',pal:'六色创世',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'影守·永夜之壁',lv:'岛③',mv:'永夜千手',pal:'永夜深蓝',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'星核泰坦·虚空造物主',lv:'岛⑦',mv:'过载',pal:'星核金橙',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'月之引航者·寂静潮汐',lv:'岛⑦',mv:'满月引潮',pal:'月银潮汐',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'混沌之种·万象侵蚀者',lv:'岛①',mv:'吞噬漩涡',pal:'混沌腐绿',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'火柴人·原初线条',lv:'岛③',mv:'橡皮擦除',pal:'原初墨线',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'画壁判官·墨渊',lv:'岛⑤',mv:'判决落笔',pal:'水墨朱砂',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'破晓仲裁者·索拉里斯',lv:'岛⑧',mv:'宝珠收押',pal:'破晓圣光',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'苍穹守卫·阿尔基昂',lv:'岛④',mv:'脉冲星爆',pal:'苍穹热视',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'量子观测者·阿尔戈',lv:'岛④',mv:'概率抹除',pal:'量子蓝青',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'银翼·麻烦终结者',lv:'岛②',mv:'银色风暴',pal:'银翼战术',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'魔皇·小丑至尊',lv:'岛①',mv:'死亡之网',pal:'小丑紫红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'星海女帝·赛尔娅',alias:'星海女帝',lv:'传说',mv:'星海圣典·超新星挽歌',pal:'虹彩星海',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}}
];
var PLBL={sz:'规模',sp:'速度',fxi:'强度(弹幕/火花)'};
/* 配色预设(新五招): 定稿=无 filter; 变体=hue-rotate/saturate/brightness 组合, 与预览页三配色同观感 */
var PALSETS={
 '史前霸王龙':[{n:'🟡 远古琥珀'},{n:'🔴 血怒',hue:-38},{n:'🟢 丛林',hue:46}],
 '千年僵尸':[{n:'🟢 尸毒'},{n:'🟣 怨灵',hue:-173,bri:1.4},{n:'🔵 阴火',hue:104}],
 '暗夜吸血鬼':[{n:'🔴 血月'},{n:'🟣 魅影',hue:-89},{n:'🔵 幽蓝',hue:-162}],
 '蒙面大魔王':[{n:'🟣 魔王紫'},{n:'🔴 炼狱',hue:89},{n:'🟢 鬼焰',hue:173,bri:.7}],
 '地狱犬王':[{n:'🔥 炼狱橙'},{n:'🟢 幽冥',hue:59},{n:'🔵 鬼火',hue:163}],
 '黑森林巫婆':[{n:'🟣 巫毒紫'},{n:'🟢 沼泽',hue:173,bri:.7},{n:'🔴 血咒',hue:89}],
 '异次元巫师':[{n:'🟣 异次元紫'},{n:'🔵 星空',hue:-54},{n:'🟢 翡翠',hue:-111,bri:.7}],
 '龙骑士统帅':[{n:'🔥 龙焰'},{n:'🟡 圣金',hue:23},{n:'🔵 苍蓝',hue:-167}],
 '暗黑灯神':[{n:'🟣 暗黑靛'},{n:'🟢 魂绿',hue:-81,sat:.77,bri:.77},{n:'🔴 血咒',hue:121}],
 '海底巨怪':[{n:'🌊 深渊青'},{n:'🟣 幽紫',hue:70,bri:1.24},{n:'🟢 毒绿',hue:-104}],
 '寒冰女王':[{n:'❄️ 寒冰蓝'},{n:'🟣 极光紫',hue:67,bri:1.4},{n:'⚪ 霜白',hue:27,bri:1.22}],
 '烈焰魔神':[{n:'🔥 炽焰橙'},{n:'🔵 幽蓝魔焰',hue:174},{n:'🟣 炼狱紫',hue:-114,bri:1.23}],
 '雷电之主':[{n:'⚡ 苍雷蓝'},{n:'🟣 紫电狱雷',hue:70,sat:1.05},{n:'🟢 翡翠神雷',hue:-60,sat:1.05}],
 '机械泰坦':[{n:'🔴 猩红警戒'},{n:'🔵 量子冷光',hue:200},{n:'🟡 战术鎏金',hue:45,sat:1.1}],
 '外星霸主':[{n:'👽 异星翠绿'},{n:'🔵 深空幽蓝',hue:70},{n:'🟣 星云魔紫',hue:130}],
 '混沌魔尊':[{n:'🟣 深渊魔紫'},{n:'🔴 血狱赤焰',hue:90,sat:1.05},{n:'🟠 熔狱业火',hue:115,sat:1.08}],
 '上古太阳神':[{n:'☀️ 鎏金圣阳'},{n:'🔥 炽核熔阳',hue:-18,sat:1.18},{n:'⚪ 白炽圣辉',hue:7,sat:.6,bri:1.15}]
};
function palMatch(bo,ps){ return (bo.hue||0)===(ps.hue||0)&&(bo.sat||0)===(ps.sat||0)&&(bo.bri||0)===(ps.bri||0); }
function lsGet(){try{return JSON.parse(localStorage.getItem(LSK)||'{}');}catch(e){return {};}}
function lsSet(o){try{localStorage.setItem(LSK,JSON.stringify(o));}catch(e){}}
function syncAlias(all,b){ if(!b||!b.alias)return; if(all[b.n]){all[b.alias]=JSON.parse(JSON.stringify(all[b.n]));}else{delete all[b.alias];} }
function djb2(s){var h=5381;for(var i=0;i<s.length;i++){h=((h*33)^s.charCodeAt(i))>>>0;}return h;}
function checkPw(pw,cb){
  if(window.crypto&&crypto.subtle&&crypto.subtle.digest){
    try{
      crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw)).then(function(buf){
        var hex=Array.prototype.map.call(new Uint8Array(buf),function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
        cb(hex===PW_SHA);
      }).catch(function(){cb(djb2(pw)===PW_DJB&&pw.length===50);});
      return;
    }catch(e){}
  }
  cb(djb2(pw)===PW_DJB&&pw.length===50);
}
var CSS='.hbafx-ovl{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(8,5,14,.88);z-index:10500;display:flex;align-items:center;justify-content:center;padding:14px}'+
'.hbafx-box{background:#1c1226;border:2px solid #4c3268;border-radius:18px;width:100%;max-width:420px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 44px rgba(0,0,0,.6)}'+
'.hbafx-hd{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid #3a2752;flex:0 0 auto}'+
'.hbafx-hd b{color:#e9d5ff;font-size:15px;letter-spacing:1px}'+
'.hbafx-x{width:30px;height:30px;border-radius:9px;border:1px solid #4c3268;background:#241733;color:#c4b5fd;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer}'+
'.hbafx-body{overflow-y:auto;padding:12px 14px;flex:1 1 auto;-webkit-overflow-scrolling:touch}'+
'.hbafx-tip{font-size:11px;color:#a78bca;background:#241733;border:1px solid #3a2752;border-radius:10px;padding:8px 10px;line-height:1.55;margin-bottom:11px}'+
'.hbafx-card{background:#221531;border:1.5px solid #3a2752;border-radius:13px;padding:11px 12px;margin-bottom:10px}'+
'.hbafx-card.hbafx-mod{border-color:#fbbf24}'+
'.hbafx-bn{display:flex;align-items:center;gap:7px;flex-wrap:wrap}'+
'.hbafx-bn b{color:#f3e8ff;font-size:13.5px}'+
'.hbafx-lv{font-size:10px;color:#1c1226;background:#c4b5fd;border-radius:7px;padding:1.5px 7px;font-weight:800}'+
'.hbafx-pal{font-size:10px;color:#fde68a;border:1px solid #6b5224;border-radius:7px;padding:1.5px 7px}'+
'.hbafx-mv{font-size:11px;color:#a78bca;margin-top:2.5px}'+
'.hbafx-row{display:flex;align-items:center;gap:9px;margin-top:8px}'+
'.hbafx-row label{font-size:11.5px;color:#d8cbe8;width:96px;flex:0 0 auto}'+
'.hbafx-row input[type=range]{flex:1;accent-color:#a855f7}'+
'.hbafx-val{font-size:11.5px;color:#fde68a;width:46px;text-align:right;flex:0 0 auto;font-weight:700}'+
'.hbafx-palrow{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}'+
'.hbafx-palbtn{font-size:10.5px;color:#e9d5ff;border:1.5px solid #4c3268;border-radius:9px;padding:5px 9px;background:#1a1024;cursor:pointer}'+
'.hbafx-palbtn.on{border-color:#fde047;color:#fde68a;box-shadow:0 0 8px rgba(253,224,71,.35)}'+
'.hbafx-rst{margin-top:9px;font-size:11px;color:#c4b5fd;border:1px solid #4c3268;border-radius:8px;padding:4px 10px;background:none;cursor:pointer}'+
'.hbafx-none{font-size:11px;color:#7c6a96;margin-top:6px}'+
'.hbafx-ft{padding:11px 14px;border-top:1px solid #3a2752;display:flex;gap:9px;flex:0 0 auto}'+
'.hbafx-btn{flex:1;padding:10px 0;border-radius:11px;border:none;font-size:13px;font-weight:800;cursor:pointer}'+
'.hbafx-btn.pri{background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff}'+
'.hbafx-btn.sec{background:#241733;color:#c4b5fd;border:1px solid #4c3268}'+
'.hbafx-pwbox{padding:20px 18px;display:flex;flex-direction:column;gap:12px}'+
'.hbafx-pwbox p{font-size:12.5px;color:#c4b5fd;line-height:1.6}'+
'.hbafx-pw{width:100%;padding:11px 12px;border-radius:11px;border:1.5px solid #4c3268;background:#140c1e;color:#f3e8ff;font-size:14px;outline:none}'+
'.hbafx-pw:focus{border-color:#a855f7}'+
'.hbafx-err{font-size:11.5px;color:#f87171;min-height:15px}'+
'.hbafx-entry{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:#221531;border:1.5px solid #4c3268;border-radius:12px;margin-top:10px;cursor:pointer}'+
'.hbafx-entry b{color:#e9d5ff;font-size:13.5px}'+
'.hbafx-entry span{color:#a78bca;font-size:11px}';
function injectCSS(){
  if(document.getElementById('hbafx-style'))return;
  var st=document.createElement('style');st.id='hbafx-style';st.textContent=CSS;document.head.appendChild(st);
}
function closeOvl(){var o=document.getElementById('hbafx-ovl');if(o&&o.parentNode)o.parentNode.removeChild(o);}
/* 🔴 v538: 伪装管理员门——只显示「输入密码」四个字+输入框(可粘贴); 永久锁定后点击毫无反应; 连续3次错锁死, 输对清零重计。 */
function openHiddenGate(){
  if(isLocked()) return;
  injectCSS();closeOvl();
  if(sessionStorage.getItem(SSK)==='1'){openPanel(false);return;}
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-ovl';
  o.innerHTML='<div class="hbafx-box" style="max-width:300px"><div class="hbafx-pwbox">'+
    '<p style="font-size:14.5px;color:#e9d5ff;font-weight:800;text-align:center;letter-spacing:2px">输入密码</p>'+
    '<input class="hbafx-pw" id="hbafxPw" type="password" autocomplete="off">'+
    '<div class="hbafx-err" id="hbafxErr"></div>'+
    '<button class="hbafx-btn pri" id="hbafxGo">确 定</button></div></div>';
  document.body.appendChild(o);
  o.addEventListener('click',function(e){if(e.target===o)closeOvl();});
  var ip=document.getElementById('hbafxPw');
  function go(){
    if(isLocked()){closeOvl();return;}
    var v=ip.value||'';
    checkPw(v,function(ok){
      if(ok){ setFails(0); try{sessionStorage.setItem(SSK,'1');}catch(e){} openPanel(false); }
      else{
        var n=getFails()+1; setFails(n);
        if(n>=3){ lockNow(); closeOvl(); return; }   /* 第3次错: 永久锁死, 静默关闭 */
        var er=document.getElementById('hbafxErr');if(er)er.textContent='密码错误';
        ip.value='';try{ip.focus();}catch(e){}
      }
    });
  }
  document.getElementById('hbafxGo').onclick=go;
  ip.addEventListener('keydown',function(e){if(e.key==='Enter')go();});
  setTimeout(function(){try{ip.focus();}catch(e){}},80);
}
/* 🔴 v538: 用户未解锁提示框 */
function openUserLockTip(p){
  injectCSS();closeOvl();
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-ovl';
  o.innerHTML='<div class="hbafx-box" style="max-width:330px"><div class="hbafx-pwbox" style="text-align:center">'+
    '<div style="font-size:46px;line-height:1">🔒</div>'+
    '<p style="text-align:center"><b style="color:#fde68a;font-size:14px">Boss 特效调节 · 尚未解锁</b><br><br>通关全部 <b style="color:#fde68a">18 个岛</b>的所有 boss(每岛 Lv1~Lv20), 即可亲自调节每个 boss 的攻击特效!</p>'+
    '<div style="font-size:12px;color:#a78bca">当前进度: <b style="color:#fde68a">'+p.done+'</b> / '+p.total+'</div>'+
    '<button class="hbafx-btn pri" id="hbafxOk">继续闯关!</button></div></div>';
  document.body.appendChild(o);
  o.addEventListener('click',function(e){if(e.target===o)closeOvl();});
  var okb=document.getElementById('hbafxOk');if(okb)okb.onclick=closeOvl;
}
/* 🔴 v539: 卡牌入口密码门——只显示「输入密码」+输入框(可粘贴)+10 秒倒计时。
   倒计时归零未提交=记一次错并静默关窗; 提交错误=记一次错(未满3次→提示并重置10秒); 累计连续3次错→入口永久关闭(cardLockNow, 此后点击毫无反应); 输对→清零计数+临时解锁全部卡牌(24h)+轻提示。 */
function openCardGate(){
  if(cardLocked()) return;
  injectCSS();
  var old=document.getElementById('hbafx-cardovl'); if(old&&old.parentNode)old.parentNode.removeChild(old);
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-cardovl';o.style.zIndex='10600';
  o.innerHTML='<div class="hbafx-box" style="max-width:300px"><div class="hbafx-pwbox">'+
    '<p style="font-size:14.5px;color:#e9d5ff;font-weight:800;text-align:center;letter-spacing:2px">输入密码</p>'+
    '<div style="text-align:center;font-size:12px;color:#fcd34d;font-weight:800;letter-spacing:1px" id="hbafxCardCd">10.0 s</div>'+
    '<input class="hbafx-pw" id="hbafxCardPw" type="password" autocomplete="off" inputmode="numeric">'+
    '<div class="hbafx-err" id="hbafxCardErr"></div>'+
    '<button class="hbafx-btn pri" id="hbafxCardGo">确 定</button></div></div>';
  document.body.appendChild(o);
  var ip=document.getElementById('hbafxCardPw'), cd=document.getElementById('hbafxCardCd'), er=document.getElementById('hbafxCardErr');
  var deadline=Date.now()+10000, tick=null, settled=false;
  function killTimer(){ if(tick){clearInterval(tick);tick=null;} }
  function closeGate(){ killTimer(); if(o.parentNode)o.parentNode.removeChild(o); }
  function oneFail(silent){
    var n=getCardFails()+1; setCardFails(n);
    if(n>=3){ cardLockNow(); closeGate(); var row=document.getElementById('hbafxCardEntry'); if(row)row.onclick=function(){}; return true; }
    if(silent){ closeGate(); return false; }
    if(er)er.textContent='密码错误';
    ip.value=''; try{ip.focus();}catch(e){}
    deadline=Date.now()+10000;          // 每次尝试各给 10 秒
    return false;
  }
  tick=setInterval(function(){
    var left=deadline-Date.now();
    if(left<=0){ if(settled)return; settled=true; killTimer(); oneFail(true); /* 🔴 超时未提交=记一次错, 静默关窗 */ return; }
    if(cd)cd.textContent=(left/1000).toFixed(1)+' s';
  },100);
  function go(){
    if(settled)return;
    if(cardLocked()){ closeGate(); return; }
    var v=ip.value||'';
    checkCardPw(v,function(ok){
      if(settled)return;
      if(ok){
        settled=true; killTimer(); setCardFails(0); closeGate();
        try{ if(typeof window.hansenTempUnlock==='function'){ window.hansenTempUnlock(24); } else { localStorage.setItem('hansen_card_temp_unlock_until',String(Date.now()+24*3600*1000)); } }catch(e){ try{localStorage.setItem('hansen_card_temp_unlock_until',String(Date.now()+24*3600*1000));}catch(e2){} }
        /* 🔴v884(Hansen: 密码要解锁所有关卡·"点了之后还是进不去关卡"): 密码成功=一键通关全部Boss(正片19岛+season写满bossUnlocked·单词大陆8岛靠isAllBossClearOn标记全解锁)。之前密码只调hansenTempUnlock(仅解锁卡牌显示)·没触发setAllBossClear·所以关卡还是锁的。 */
        try{ if(typeof setAllBossClear==='function'){ setAllBossClear(true); } }catch(e){}
        /* 🔴v884: 单词大陆卡也临时全解锁(land卡响应同款temp标记·显示层) */
        try{ if(window.HansenLandCardbook && typeof window.HansenLandCardbook.setTempUnlock==='function'){ window.HansenLandCardbook.setTempUnlock(24); } }catch(e){}
        try{
          var t=document.createElement('div');
          t.style.cssText='position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:10700;background:rgba(16,12,30,.92);border:1px solid rgba(74,222,128,.55);color:#bbf7d0;font-size:12.5px;font-weight:800;letter-spacing:1px;padding:10px 18px;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.5)';
          t.textContent='✅ 已解锁全部 boss 卡牌(预览 24 小时)';
          document.body.appendChild(t);
          setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },2300);
        }catch(e){}
        try{ if(typeof window.hansenRenderCards==='function')window.hansenRenderCards(); }catch(e){}
      }else{
        var locked=oneFail(false); if(locked){settled=true;}
      }
    });
  }
  document.getElementById('hbafxCardGo').onclick=go;
  ip.addEventListener('keydown',function(e){if(e.key==='Enter')go();});
  o.addEventListener('click',function(e){ if(e.target===o){ if(settled)return; settled=true; killTimer(); oneFail(true); /* 🔴 弹出后中途放弃=未在窗口内输对, 同样记一次错 */ } });
  setTimeout(function(){try{ip.focus();}catch(e){}},80);
}
var CUR_USER=false; /* 🔴 v538: 面板当前模式(用户/管理员), 内部重开沿用 */
/* 🔴 v870(Hansen): 后台密码解锁全部 Boss 关卡——管理员面板内(已被密码门锁·仅管理员模式显示)提供一键解锁。
   ①解锁全部星海星域(hsn_seasonmap_cleared_1..5=5星域+女帝全可进) ②直达第一星域6关任意一关(设 season1_prog) ③解锁全主岛Boss(角色经验升满→全岛Lv1~20可打)。只影响进度键·不碰特效。 */
window.__hsnUnlockStarSea=function(){
  /* 🔴v874: 旧=hsn_seasonmap_cleared_1..5(星域已废) → 新=hsn_landmap_cleared_1..8(单词大陆8岛全通·女帝终战解锁) */
  try{ for(var i=1;i<=8;i++){ localStorage.setItem('hsn_landmap_cleared_'+i,'1'); }
    alert('✅ 已解锁：单词大陆全部 8 岛 + 女帝终战全部可进。刷新后生效。');
    location.reload();
  }catch(e){ try{alert('解锁失败: '+e.message);}catch(e2){} }
};
window.__hsnJumpS1=function(){ /* 🔴v874: 星域直达已废·统一去大陆地图 */ try{ (function(){ if(window.HansenRoom){ HansenRoom.open('land'); return; } location.href='land_map.html'; })(); }catch(e){} };
window.__hsnUnlockMain=function(){
  try{ if(!confirm('\u8fd9\u4f1a\u628a\u89d2\u8272\u7ecf\u9a8c\u8bbe\u4e3a\u6ee1\u7ea7(\u89e3\u9501\u5168\u90e8\u4e3b\u5c9b Lv1~20 Boss)\uff0c\u4f60\u7684\u7b49\u7ea7\u4f1a\u663e\u793a\u4e3a\u6ee1\u7ea7\u3002\u7ee7\u7eed\uff1f')) return;
    localStorage.setItem('hansen_wallet_charxp','99999999');
    alert('\u2705 \u89d2\u8272\u5df2\u5347\u6ee1\u7ea7\uff0c\u5168\u90e8\u4e3b\u5c9b Boss \u89e3\u9501\u3002\u5237\u65b0\u540e\u751f\u6548\u3002');
    location.reload();
  }catch(e){ try{alert(e.message);}catch(e2){} }
};
/* 🔴v889(Hansen): 后台随意设置金币/钻石数量——输多少就是多少。直接写钱包(HansenCoins/HansenGems·全局余额)·刷新后全岛生效。 */
window.__hsnSetCoins=function(){
  try{
    var inp=document.getElementById('__hsnCoinInput');
    var n=inp?parseInt(inp.value,10):NaN;
    if(!isFinite(n)||n<0){ alert('请输入有效的金币数量（0 或正整数）'); return; }
    n=Math.floor(n);
    /* 直接写金币钱包 key(HansenCoins.setCoins 是内部函数·此处直接写同一 key 最稳) */
    localStorage.setItem('hansen_wallet_coins', String(n));
    try{ if(window.HansenCoins && HansenCoins.get) HansenCoins.get(); }catch(e){}
    alert('✅ 金币已设为 '+n+'。刷新后各页显示生效。');
    try{ location.reload(); }catch(e){}
  }catch(e){ try{alert('设置失败: '+e.message);}catch(e2){} }
};
window.__hsnSetGems=function(){
  try{
    var inp=document.getElementById('__hsnGemInput');
    var n=inp?parseInt(inp.value,10):NaN;
    if(!isFinite(n)||n<0){ alert('请输入有效的钻石数量（0 或正整数）'); return; }
    n=Math.floor(n);
    /* 直接写钻石钱包 key */
    localStorage.setItem('hansen_wallet_gems', String(n));
    try{ if(window.HansenGems && HansenGems.get) HansenGems.get(); }catch(e){}
    alert('✅ 钻石已设为 '+n+'。刷新后各页显示生效。');
    try{ location.reload(); }catch(e){}
  }catch(e){ try{alert('设置失败: '+e.message);}catch(e2){} }
};
function openPanel(userMode){
  if(userMode!==undefined)CUR_USER=!!userMode;
  injectCSS();closeOvl();
  var ov=lsGet();
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-ovl';
  var h='<div class="hbafx-box"><div class="hbafx-hd"><b>⚔️ Boss 特效调参'+(CUR_USER?'':'(管理员)')+'</b><div class="hbafx-x" id="hbafxX">✕</div></div><div class="hbafx-body">'+
    '<div class="hbafx-tip">⚠️ 所有调整<b style="color:#fde68a">实时生效并永久保存</b>。配色=整体换色(新五招有预设配色, 全员可用色相滑杆自定义); 速度调慢时伤害判定自动顺延; 改动过的 boss 亮金边。</div>';
   if(!CUR_USER){
/* 🔴v874(Hansen定稿): 星海旧5星域整套废除→开发者解锁改为单词大陆语义 */
     h+='<div class="hbafx-tip" style="border-color:#f0a830;background:rgba(240,168,48,.10)">\ud83d\udd13 <b style="color:#fde68a">开发者·解锁全部 Boss 关卡</b></div>';
     h+='<button class="hbafx-btn pri" style="width:100%;margin:4px 0" onclick="window.__hsnUnlockStarSea()">\ud83d\uddfa\ufe0f 解锁单词大陆全部 8 岛（含女帝终战）</button>';
     h+='<button class="hbafx-btn" style="width:100%;margin:2px 0 6px;font-size:12px" onclick="window.location.href=\'land_map.html\'">\ud83e\udded 打开大陆地图</button>';
     h+='<button class="hbafx-btn" style="width:100%;margin:2px 0 8px;font-size:12px" onclick="window.__hsnUnlockMain()">\u2b50 \u89e3\u9501\u5168\u90e8\u4e3b\u5c9b Boss\uff08\u89d2\u8272\u5347\u6ee1\u7ea7\u00b7\u4f1a\u6539\u4f60\u7684\u7b49\u7ea7\uff09</button>';
     /* 🔴v889(Hansen): 后台随意设置金币/钻石数量 */
     var __curCoins=0, __curGems=0;
     try{ __curCoins=(window.HansenCoins&&HansenCoins.get)?HansenCoins.get():(parseInt(localStorage.getItem('hansen_wallet_coins'),10)||0); }catch(e){}
     try{ __curGems=(window.HansenGems&&HansenGems.get)?HansenGems.get():(parseInt(localStorage.getItem('hansen_wallet_gems'),10)||0); }catch(e){}
     h+='<div style="margin:6px 0 8px;padding:12px 13px;background:rgba(240,168,48,.10);border:1.5px solid #f0a830;border-radius:12px">'+
        '<div style="font-size:13px;font-weight:800;color:#fde68a;margin-bottom:8px">\ud83d\udcb0 \u91d1\u5e01 / \ud83d\udc8e \u94bb\u77f3\uff08\u8f93\u591a\u5c11\u5c31\u662f\u591a\u5c11\uff09</div>'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">'+
          '<span style="font-size:20px">\ud83e\ude99</span>'+
          '<input id="__hsnCoinInput" type="number" min="0" inputmode="numeric" placeholder="\u91d1\u5e01\u6570\u91cf" value="'+__curCoins+'" style="flex:1;min-width:0;padding:9px 10px;border-radius:9px;border:1.5px solid #4c3268;background:#1c1230;color:#fff;font-size:15px;font-weight:700">'+
          '<button class="hbafx-btn pri" style="padding:9px 16px;white-space:nowrap" onclick="window.__hsnSetCoins()">\u8bbe\u7f6e</button>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<span style="font-size:20px">\ud83d\udc8e</span>'+
          '<input id="__hsnGemInput" type="number" min="0" inputmode="numeric" placeholder="\u94bb\u77f3\u6570\u91cf" value="'+__curGems+'" style="flex:1;min-width:0;padding:9px 10px;border-radius:9px;border:1.5px solid #4c3268;background:#1c1230;color:#fff;font-size:15px;font-weight:700">'+
          '<button class="hbafx-btn pri" style="padding:9px 16px;white-space:nowrap" onclick="window.__hsnSetGems()">\u8bbe\u7f6e</button>'+
        '</div>'+
      '</div>';
   }
  BOSSES.forEach(function(b,bi){
    var bo=ov[b.n]||{};
    var mod=Object.keys(bo).length>0;
    h+='<div class="hbafx-card'+(mod?' hbafx-mod':'')+'" data-bi="'+bi+'"><div class="hbafx-bn"><span class="hbafx-lv">'+b.lv+'</span><b>'+b.n+'</b><span class="hbafx-pal">🎨 '+b.pal+'</span></div><div class="hbafx-mv">'+b.mv+'</div>';
    var pset=PALSETS[b.n];
    if(pset){
      h+='<div class="hbafx-palrow">';
      pset.forEach(function(ps,pi){
        var on=(pi===0)?(!bo.hue&&!bo.sat&&!bo.bri):palMatch(bo,ps);
        h+='<button class="hbafx-palbtn'+(on?' on':'')+'" data-pb="'+bi+'" data-pi="'+pi+'">'+ps.n+'</button>';
      });
      h+='</div>';
    }
    var hv=Math.round((bo.hue||0));
    h+='<div class="hbafx-row"><label>🎨 色相偏移</label><input type="range" min="-180" max="180" value="'+hv+'" data-b="'+bi+'" data-p="hue"><span class="hbafx-val" data-v="'+bi+'_hue">'+(hv>0?'+':'')+hv+'°</span></div>';
    if(b.ps.length===0){
      h+='<div class="hbafx-none">基础特效 · 标准参数不可调(配色可调)</div>';
      h+='<button class="hbafx-rst" data-r="'+bi+'">↺ 恢复默认</button>';
    }else{
      b.ps.forEach(function(pk){
        var dv=b.df[pk], cur=(bo[pk]!=null)?Math.round(bo[pk]*100):dv;
        h+='<div class="hbafx-row"><label>'+PLBL[pk]+'</label><input type="range" min="50" max="200" value="'+cur+'" data-b="'+bi+'" data-p="'+pk+'"><span class="hbafx-val" data-v="'+bi+'_'+pk+'">'+(pk==='sp'?(cur/100).toFixed(2)+'x':cur+'%')+'</span></div>';
      });
      h+='<button class="hbafx-rst" data-r="'+bi+'">↺ 恢复默认</button>';
    }
    h+='</div>';
  });
  /* 🔴 v539: 卡牌入口——仅管理员面板可见(用户模式绝不渲染); 永久关闭后点击零反应(openCardGate 开头拦截)。 */
  if(!CUR_USER){
    h+='<div class="hbafx-entry" id="hbafxCardEntry" style="margin-top:4px"><b>🎴 卡牌入口</b><span>解锁全部 boss 卡牌 ›</span></div>';
    /* 🔴v766 难度图标调节器(藏管理员·卡牌入口下方·Hansen不让放公开「更多设置」): 拖动写 localStorage·拼写对战开机读取生效 */
    h+='<div style="margin-top:10px;padding:12px 13px;background:#1c1230;border:1.5px solid #4c3268;border-radius:12px">'+
       '<div class="hbafx-bn"><b>🐢 拼写对战 · 难度图标</b></div>'+
       '<div class="hbafx-mv">容易/中等/困难三个图标的大小和上下位置 · 拖动实时保存 · 进拼写对战即生效</div>'+
       '<div class="hbafx-row"><label>📏 大小</label><input type="range" min="30" max="120" value="69" id="diffIcSizeRange"><span class="hbafx-val" id="diffIcSizeVal">69px</span></div>'+
       '<div class="hbafx-row"><label>↕️ 上下</label><input type="range" min="-30" max="30" value="0" id="diffIcDyRange"><span class="hbafx-val" id="diffIcDyVal">0px</span></div>'+
       '<div class="hbafx-row"><label>📦 框大小</label><input type="range" min="48" max="150" value="60" id="diffIcHRange"><span class="hbafx-val" id="diffIcHVal">60px</span></div>'+
       '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:9px;padding:12px;background:rgba(255,255,255,.04);border-radius:10px"><div id="diffIcPvB0" style="background:#fbfcfe;border:1.5px solid #e3e9f2;border-radius:12px;height:60px;padding:0 13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><img id="diffIcPv0" src="speed/slow.webp?v=1163" alt="" style="width:69px;height:69px;object-fit:contain"></div><div id="diffIcPvB1" style="background:#fbfcfe;border:1.5px solid #e3e9f2;border-radius:12px;height:60px;padding:0 13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><img id="diffIcPv1" src="speed/medium.webp?v=1163" alt="" style="width:69px;height:69px;object-fit:contain"></div><div id="diffIcPvB2" style="background:#fbfcfe;border:1.5px solid #e3e9f2;border-radius:12px;height:60px;padding:0 13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><img id="diffIcPv2" src="speed/fast.webp?v=1163" alt="" style="width:69px;height:69px;object-fit:contain"></div></div>'+
       '</div>';
    /* 🔴v775 左上角头像大小调节器(藏管理员·难度图标下方·Hansen嫌头像太小): 框大小+形象大小各自独立·拖动写localStorage·各岛开机读取生效 */
    h+='<div style="margin-top:10px;padding:12px 13px;background:#1c1230;border:1.5px solid #4c3268;border-radius:12px">'+
       '<div class="hbafx-bn"><b>🦊 左上角头像 · 大小</b></div>'+
       '<div class="hbafx-mv">调的是头像那个彩色方框 + 里面形象的大小 · 顶栏高度锁死永不变 · 方框最大填满顶栏不溢出 · 两者各自独立 · 实时保存各岛生效</div>'+
       '<div class="hbafx-row"><label>📦 方框大小</label><input type="range" min="32" max="60" value="60" id="avFrameRange"><span class="hbafx-val" id="avFrameVal">60px</span></div>'+
       '<div class="hbafx-row"><label>🧍 形象大小</label><input type="range" min="55" max="115" value="95" id="avImgRange"><span class="hbafx-val" id="avImgVal">95%</span></div>'+
       '<div style="display:flex;align-items:center;justify-content:center;margin-top:9px;padding:18px;background:rgba(255,255,255,.04);border-radius:10px">'+
         '<div id="avPvBox" style="width:var(--hsnAvSize,60px);height:var(--hsnAvSize,60px);border-radius:13px;background:#34c3e0;overflow:hidden;position:relative;flex:none"><img id="avPvImg" src="avatars/01.webp?v=1163" alt="" style="position:absolute;inset:0;margin:auto;max-width:var(--hsnAvImg,95%);max-height:var(--hsnAvImg,95%);width:auto;height:auto;object-fit:contain"></div>'+
       '</div>'+
       '</div>';
    /* 🔴 v804: 一键通关所有 Boss 开关(藏管理员·头像调节器下方·Hansen): ON=18岛360关全标记通关, OFF=精确还原真实进度 */
    var _allClr=isAllBossClearOn();
    h+='<div style="margin-top:10px;padding:12px 13px;background:#241533;border:1.5px solid #7c3aed;border-radius:12px">'+
       '<div class="hbafx-bn"><b>🗝️ 一键通关所有 Boss</b></div>'+
       '<div class="hbafx-mv">打开 = 18 个岛全部 360 个 boss 关立刻标记为已通关(解锁全部关卡/进度);关闭 = 精确恢复到打开前的真实进度。仅本机管理员可见。</div>'+
       '<button id="hbafxClearAll" style="width:100%;margin-top:10px;padding:11px;border-radius:11px;border:none;font-size:13px;font-weight:800;cursor:pointer;'+(_allClr?'background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff':'background:#1a1024;color:#c4b5fd;border:1.5px solid #7c3aed')+'">'+(_allClr?'✅ 已全部通关 · 点击关闭还原':'🗝️ 点击一键通关全部 Boss')+'</button>'+
       '<div id="hbafxClearAllNote" style="font-size:11px;color:#a78bca;margin-top:7px;text-align:center">'+(_allClr?'当前:全部 360 关已通关':'当前:按真实进度')+'</div>'+
       /* 🔴v1055 新增：宠物等级 / 角色等级 直接调节（管理员用）。
          宠物按 PET_STAGES 分 36 阶（xp 阈值 0→7000），角色等级由 charXP 决定。
          两者都只改数据不改规则，改完刷新即生效。 */
       +'<div class="hbafx-card" style="margin-top:14px">'+
       '<div class="hbafx-bn"><b>🐾 宠物等级调节</b></div>'+
       '<div class="hbafx-mv">直接设定宠物阶段（1-36）。改完自动补足对应经验并刷新。</div>'+
       '<div class="hbafx-row" style="margin-top:9px">'+
       '<label>目标阶段</label>'+
       '<input id="hbafxPetLv" type="number" min="1" max="36" step="1" placeholder="1-36" '+
       'style="flex:1;padding:9px;border-radius:9px;border:1.5px solid #7c3aed;background:#1a1024;color:#e9d5ff;font-size:13px">'+
       '<button id="hbafxPetGo" style="padding:9px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-size:12.5px;font-weight:800;cursor:pointer">设定</button>'+
       '</div><div id="hbafxPetNote" style="font-size:11px;color:#c4b5fd;margin-top:6px"></div>'+
       '</div>'+

       '<div class="hbafx-card" style="margin-top:12px">'+
       '<div class="hbafx-bn"><b>\u2b50 角色等级调节</b></div>'+
       '<div class="hbafx-mv">直接设定冒险者等级。改完自动补足对应 XP 并刷新。</div>'+
       '<div class="hbafx-row" style="margin-top:9px">'+
       '<label>目标等级</label>'+
       '<input id="hbafxLvlIn" type="number" min="1" max="99" step="1" placeholder="1-99" '+
       'style="flex:1;padding:9px;border-radius:9px;border:1.5px solid #7c3aed;background:#1a1024;color:#e9d5ff;font-size:13px">'+
       '<button id="hbafxLvlGo" style="padding:9px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#38bdf8,#0284c7);color:#fff;font-size:12.5px;font-weight:800;cursor:pointer">设定</button>'+
       '</div><div id="hbafxLvlNote" style="font-size:11px;color:#c4b5fd;margin-top:6px"></div>'+
       '</div>'
       '</div>';
  }
  h+='</div><div class="hbafx-ft"><button class="hbafx-btn sec" id="hbafxRstAll">全部恢复默认</button><button class="hbafx-btn pri" id="hbafxDone">完 成</button></div></div>';
  o.innerHTML=h;
  (function(){var ce=o.querySelector('#hbafxCardEntry');if(ce)ce.onclick=function(){openCardGate();};})(); /* 🔴 v539: 必须 o.querySelector——此刻 o 尚未 appendChild 进文档, document.getElementById 找不到会静默漏绑(开发期真机抓获的时序bug) */
  /* 🔴v766/v768 难度图标调节器接线(管理员模式才有这些元素·用户模式querySelector=null自动跳过): 图标大小/图标上下/框大小3档·框大小=独立固定高度·与图标大小彻底解耦·写localStorage(size/dy/h)·拼写对战开机读取生效 */
  (function(){var KS='hansen_sb_diffic_size',KD='hansen_sb_diffic_dy',KH='hansen_sb_diffic_h';
    var sz=parseInt(localStorage.getItem(KS),10); if(isNaN(sz))sz=69;
    var dy=parseInt(localStorage.getItem(KD),10); if(isNaN(dy))dy=0;
    var fh=parseInt(localStorage.getItem(KH),10); if(isNaN(fh))fh=60;
    var rS=o.querySelector('#diffIcSizeRange'),rD=o.querySelector('#diffIcDyRange'),rH=o.querySelector('#diffIcHRange');
    var pv=[o.querySelector('#diffIcPv0'),o.querySelector('#diffIcPv1'),o.querySelector('#diffIcPv2')];
    var pvb=[o.querySelector('#diffIcPvB0'),o.querySelector('#diffIcPvB1'),o.querySelector('#diffIcPvB2')];
    /* 🔴v768 框大小=预览框独立高度(与图标解耦): 改图标只动图标·改框大小只动框高 */
    function paint(){pv.forEach(function(im){if(im){im.style.width=sz+'px';im.style.height=sz+'px';im.style.transform='translateY('+dy+'px)';}});
      pvb.forEach(function(bx){if(bx){bx.style.height=fh+'px';}});}
    if(rS){rS.value=sz; var sV=o.querySelector('#diffIcSizeVal'); if(sV)sV.textContent=sz+'px';
      rS.addEventListener('input',function(){sz=+this.value; var l=o.querySelector('#diffIcSizeVal'); if(l)l.textContent=sz+'px'; try{localStorage.setItem(KS,String(sz));}catch(e){} paint();});}
    if(rD){rD.value=dy; var dV=o.querySelector('#diffIcDyVal'); if(dV)dV.textContent=dy+'px';
      rD.addEventListener('input',function(){dy=+this.value; var l=o.querySelector('#diffIcDyVal'); if(l)l.textContent=dy+'px'; try{localStorage.setItem(KD,String(dy));}catch(e){} paint();});}
    if(rH){rH.value=fh; var hV=o.querySelector('#diffIcHVal'); if(hV)hV.textContent=fh+'px';
      rH.addEventListener('input',function(){fh=+this.value; var l=o.querySelector('#diffIcHVal'); if(l)l.textContent=fh+'px'; try{localStorage.setItem(KH,String(fh));}catch(e){} paint();});}
    paint();})();
  /* 🔴v775 左上角头像大小调节器接线(管理员才有这些元素·用户模式querySelector=null自动跳过): 框大小--hsnAvSize+形象大小--hsnAvImg各自独立·写localStorage(hansen_av_frame/img)·各岛hansen_avatar.js开机读取·顶栏头像+预览当场变 */
  (function(){var KF='hansen_av_frame',KI='hansen_av_img';
    var fr=parseInt(localStorage.getItem(KF),10); if(isNaN(fr))fr=60; if(fr>60)fr=60; if(fr<32)fr=32;
    var ig=parseInt(localStorage.getItem(KI),10); if(isNaN(ig))ig=95;
    var de=document.documentElement;
    de.style.setProperty('--hsnAvSize',fr+'px'); de.style.setProperty('--hsnAvImg',ig+'%');
    /* 预览显示当前头像角色立绘(只换src·尺寸靠CSS变量自动随动) */
    try{var av=JSON.parse(localStorage.getItem('hsn_avatar')||'{}');var cur=parseInt(av.cur,10)||1;var pi=o.querySelector('#avPvImg');if(pi)pi.src='avatars/'+(cur<10?'0'+cur:cur)+'.webp?v=1163';}catch(e){}
    var rF=o.querySelector('#avFrameRange'),rI=o.querySelector('#avImgRange');
    if(rF){rF.value=fr; var fV=o.querySelector('#avFrameVal'); if(fV)fV.textContent=fr+'px';
      rF.addEventListener('input',function(){fr=+this.value; var l=o.querySelector('#avFrameVal'); if(l)l.textContent=fr+'px'; try{localStorage.setItem(KF,String(fr));}catch(e){} de.style.setProperty('--hsnAvSize',fr+'px');});}
    if(rI){rI.value=ig; var iV=o.querySelector('#avImgVal'); if(iV)iV.textContent=ig+'%';
      rI.addEventListener('input',function(){ig=+this.value; var l=o.querySelector('#avImgVal'); if(l)l.textContent=ig+'%'; try{localStorage.setItem(KI,String(ig));}catch(e){} de.style.setProperty('--hsnAvImg',ig+'%');});}
  })();
  document.body.appendChild(o);
  document.getElementById('hbafxX').onclick=closeOvl;
  document.getElementById('hbafxDone').onclick=closeOvl;
  o.addEventListener('input',function(e){
    var t=e.target;if(!t||t.type!=='range')return;
    if(!t.hasAttribute('data-b'))return;/*🔴v766 跳过非boss滑块(难度图标调节器diffIcSize/DyRange)·避免误判为boss参数*/
    var bi=+t.getAttribute('data-b'), pk=t.getAttribute('data-p'), b=BOSSES[bi];
    var v=+t.value;
    var vEl=o.querySelector('[data-v="'+bi+'_'+pk+'"]');
    var all=lsGet(); var cur=all[b.n]||{};
    if(pk==='hue'){
      if(vEl)vEl.textContent=(v>0?'+':'')+v+'°';
      if(v===0){delete cur.hue;}else{cur.hue=v;}
      var pr=o.querySelector('.hbafx-card[data-bi="'+bi+'"] .hbafx-palrow');
      if(pr){Array.prototype.forEach.call(pr.children,function(x,pi){
        var ps=(PALSETS[b.n]||[])[pi]||{};
        x.classList.toggle('on', pi===0?(!cur.hue&&!cur.sat&&!cur.bri):palMatch(cur,ps));
      });}
    }else{
      if(vEl)vEl.textContent=(pk==='sp'?(v/100).toFixed(2)+'x':v+'%');
      if(v===b.df[pk]){delete cur[pk];}else{cur[pk]=v/100;}
    }
    if(Object.keys(cur).length===0){delete all[b.n];}else{all[b.n]=cur;}
    syncAlias(all,b);
    lsSet(all);
    var card=o.querySelector('.hbafx-card[data-bi="'+bi+'"]');
    if(card)card.classList.toggle('hbafx-mod',!!all[b.n]);
  });
  o.addEventListener('click',function(e){
    var t=e.target;
    if(t===o){closeOvl();return;}
    if(t.classList&&t.classList.contains('hbafx-palbtn')){
      var pbi=+t.getAttribute('data-pb'), ppi=+t.getAttribute('data-pi');
      var pb=BOSSES[pbi], pps=(PALSETS[pb.n]||[])[ppi]||{};
      var pall=lsGet(); var pcur=pall[pb.n]||{};
      delete pcur.hue; delete pcur.sat; delete pcur.bri;
      if(pps.hue)pcur.hue=pps.hue; if(pps.sat)pcur.sat=pps.sat; if(pps.bri)pcur.bri=pps.bri;
      if(Object.keys(pcur).length===0){delete pall[pb.n];}else{pall[pb.n]=pcur;}
      syncAlias(pall,pb);
      lsSet(pall);
      var pcard=o.querySelector('.hbafx-card[data-bi="'+pbi+'"]');
      if(pcard){
        pcard.classList.toggle('hbafx-mod',!!pall[pb.n]);
        Array.prototype.forEach.call(pcard.querySelectorAll('.hbafx-palbtn'),function(x,pi){x.classList.toggle('on',pi===ppi);});
        var hrg=pcard.querySelector('input[data-p="hue"]'); if(hrg)hrg.value=pps.hue||0;
        var hvl=pcard.querySelector('[data-v="'+pbi+'_hue"]'); if(hvl)hvl.textContent=((pps.hue||0)>0?'+':'')+(pps.hue||0)+'°';
      }
      return;
    }
    if(t.classList&&t.classList.contains('hbafx-rst')){
      var bi=+t.getAttribute('data-r'), b=BOSSES[bi];
      var all=lsGet(); delete all[b.n]; syncAlias(all,b); lsSet(all);
      var card=o.querySelector('.hbafx-card[data-bi="'+bi+'"]');
      if(card){card.classList.remove('hbafx-mod');
        b.ps.forEach(function(pk){
          var rg=card.querySelector('input[data-p="'+pk+'"]'); if(rg)rg.value=b.df[pk];
          var vEl=card.querySelector('[data-v="'+bi+'_'+pk+'"]'); if(vEl)vEl.textContent=(pk==='sp'?(b.df[pk]/100).toFixed(2)+'x':b.df[pk]+'%');
        });
        var hrg=card.querySelector('input[data-p="hue"]'); if(hrg)hrg.value=0;
        var hvl=card.querySelector('[data-v="'+bi+'_hue"]'); if(hvl)hvl.textContent='0°';
        Array.prototype.forEach.call(card.querySelectorAll('.hbafx-palbtn'),function(x,pi){x.classList.toggle('on',pi===0);});
      }
    }
    if(t.id==='hbafxClearAll'){
      setAllBossClear(!isAllBossClearOn());
      var _on=isAllBossClearOn();
      t.style.background=_on?'linear-gradient(135deg,#22c55e,#16a34a)':'#1a1024';
      t.style.color=_on?'#fff':'#c4b5fd';
      t.style.border=_on?'none':'1.5px solid #7c3aed';
      t.textContent=_on?'✅ 已全部通关 · 点击关闭还原':'🗝️ 点击一键通关全部 Boss';
      var _nt=o.querySelector('#hbafxClearAllNote'); if(_nt)_nt.textContent=_on?'当前:全部 360 关已通关':'当前:按真实进度';
      return;
    }
    if(t.id==='hbafxRstAll'){
      lsSet({});
      closeOvl();openPanel();
    }
    /* 🔴v1055 宠物等级调节：直接设定阶段，自动补足对应经验 */
    if(t.id==='hbafxPetGo'){
      var pin=document.getElementById('hbafxPetLv');
      var pn=document.getElementById('hbafxPetNote');
      var lv=parseInt(pin&&pin.value,10);
      var STAGE_XP=[0,25,70,135,220,310,415,535,660,795,945,1100,1265,1435,1615,1805,
        2000,2205,2415,2635,2860,3090,3330,3575,3830,4085,4350,4620,4900,5180,5470,
        5765,6065,6370,6685,7000];
      if(!(lv>=1&&lv<=36)){ if(pn){pn.textContent='请填 1-36 之间的阶段';pn.style.color='#fca5a5';} return; }
      try{
        var S=window.S;
        if(!S){ if(pn){pn.textContent='当前页面没有存档对象，请在岛屿页内使用';pn.style.color='#fca5a5';} return; }
        S.pet=S.pet||{name:'星灵',stage:0,xp:0,picked:false};
        S.pet.stage=lv-1;
        S.pet.xp=STAGE_XP[lv-1];
        S.pet.picked=true;
        if(typeof window.save==='function') window.save();
        if(pn){pn.textContent='已设为第 '+lv+' 阶（经验 '+STAGE_XP[lv-1]+'），页面即将刷新';pn.style.color='#86efac';}
        setTimeout(function(){ try{location.reload();}catch(e){} },900);
      }catch(e){ if(pn){pn.textContent='设置失败：'+String(e.message||e).slice(0,60);pn.style.color='#fca5a5';} }
      return;
    }
    /* 🔴v1055 角色等级调节：直接设定等级，自动补足对应 XP */
    if(t.id==='hbafxLvlGo'){
      var lin=document.getElementById('hbafxLvlIn');
      var ln=document.getElementById('hbafxLvlNote');
      var want=parseInt(lin&&lin.value,10);
      if(!(want>=1&&want<=99)){ if(ln){ln.textContent='请填 1-99 之间的等级';ln.style.color='#fca5a5';} return; }
      try{
        var LV=window.ADVENTURE_LEVELS;
        if(!LV||!LV.length){ if(ln){ln.textContent='当前页面没有等级表，请在岛屿页内使用';ln.style.color='#fca5a5';} return; }
        var idx=Math.min(want,LV.length)-1;
        var xp=LV[idx]&&LV[idx].xp||0;
        localStorage.setItem('hansen_wallet_charxp',String(xp));
        try{ if(window.S) window.S.charXP=xp; if(typeof window.save==='function') window.save(); }catch(e2){}
        if(ln){ln.textContent='已设为 Lv.'+(idx+1)+'（'+(LV[idx].name||'')+'，XP '+xp+'），页面即将刷新';ln.style.color='#86efac';}
        setTimeout(function(){ try{location.reload();}catch(e){} },900);
      }catch(e){ if(ln){ln.textContent='设置失败：'+String(e.message||e).slice(0,60);ln.style.color='#fca5a5';} }
      return;
    }
  });
}
/* 设置入口: MutationObserver 幂等注入 */
function ensureEntry(){
  /* 🔴 v538: 用户入口——不再提密码。锁态实时计算: 未解锁=🔒+进度, 点击弹解锁条件提示; 解锁=免密直接进面板(用户模式)。
     MutationObserver 触发即重算(只改 entry 自身 innerHTML, 不触发 sc childList → 无循环)。 */
  var sc=document.getElementById('settingsContent');
  if(!sc||!sc.firstChild)return;
  var d=document.getElementById('hbafxEntry');
  if(!d){
    d=document.createElement('div');
    d.className='hbafx-entry';d.id='hbafxEntry';
    d.onclick=function(){ var p=bossClearProgress(); if(p.all){ openPanel(true); } else { openUserLockTip(p); } };
    sc.appendChild(d);
  }
  var p=bossClearProgress();
  d.innerHTML = p.all ? '<b>🎚️ Boss 特效调节</b><span>已解锁 ›</span>'
                      : '<b>🔒 Boss 特效调节</b><span>通关全部 boss 解锁 '+p.done+'/'+p.total+'</span>';
}
/* v953: 管理面板继续随攻击引擎按需加载，但把两个窄入口显式交给常驻轻量桥。
   只导出“打开已存在的密码门”和“刷新公开入口”，绝不导出密码、哈希校验或越权开关。 */
window.__hsnOpenBossAdminGate=openHiddenGate;
window.__hsnEnsureBossFxSettingsEntry=ensureEntry;
function boot(){
  injectCSS();
  idbReconcile(); /* 🔴 v538: 开机用 IndexedDB 镜像校正锁/计数(清档难抹) */
  /* 🔴 v538: 伪装管理员入口——捕获级委托, 只命中"叶子节点+短文本+含『进度自动保存到本设备』"; 元素本身零改动零样式零提示。锁定后 openHiddenGate 内部直接 return = 毫无反应。 */
  try{
    document.addEventListener('click',function(e){
      try{
        var t=e.target;
        if(!t||t.nodeType!==1)return;
        if(t.children&&t.children.length>0)return;
        var tx=t.textContent||'';
        if(tx.length<40&&tx.indexOf('进度自动保存到本设备')>=0){ openHiddenGate(); }
      }catch(e2){}
    },true);
  }catch(e){}
  var sc=document.getElementById('settingsContent');
  if(sc){
    ensureEntry();
    try{ new MutationObserver(function(){ensureEntry();}).observe(sc,{childList:true}); }catch(e){ setInterval(ensureEntry,1500); }
  }else{ setInterval(ensureEntry,1500); }
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot);}else{boot();}
})();
