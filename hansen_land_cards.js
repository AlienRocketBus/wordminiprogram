// hansen_land_cards.js v955 — 单词大陆 Boss 卡册 + 可恢复抽卡事务 + 星海命轮揭晓引擎
// 与正片20张卡系统【完全隔离】: 独立数据LAND_CARDS(40张·8岛)·独立存档(localStorage hansen_land_cardbook)·独立抽卡池·独立保底。
// 正片BOSS_CARDS/HansenCardbook/HansenGacha 分毫不动·老卡不贬值。抽卡花金币(共用HansenCoins钱包)保住卡的价值。
(function(){
  if(window.__hansenLandCardsLoaded){ return; } window.__hansenLandCardsLoaded = true;

  var LAND_CARDS = [
    {id:'L11', land:1, name:'虫群先锋·刃翼领主', img:'bosses/land_renyi.webp', frame:'#94a3b8', rarity:'common', desc:'振翅如刃, 虫群之锋所向, 万物退避。'},
    {id:'L12', land:1, name:'未成形之神·万形之胚', img:'bosses/land_wanxing.webp', frame:'#84cc16', rarity:'uncommon', desc:'尚未定形的初生之神, 万般可能皆蛰伏其中。'},
    {id:'L13', land:1, name:'逆相之影·镜渊领主', img:'bosses/land_jingyuan.webp', frame:'#c084fc', rarity:'rare', desc:'镜渊深处的倒影之主, 照见你最恐惧的模样。'},
    {id:'L14', land:1, name:'混沌之种·万象侵蚀者', img:'bosses/land_hundun.webp', frame:'#22d3ee', rarity:'epic', desc:'一粒混沌之种, 悄然吞噬万象的秩序。'},
    {id:'L15', land:1, name:'魔皇·小丑至尊', img:'bosses/land_mohuang.webp', frame:'#fbbf24', rarity:'legendary', desc:'笑面之下是魔皇, 一场好戏才刚刚开场。'},
    {id:'L21', land:2, name:'丛林幽灵·兵王', img:'bosses/land_bingwang.webp', frame:'#94a3b8', rarity:'common', desc:'穿林而过无声无息, 丛林之中他即是王。'},
    {id:'L22', land:2, name:'暗影先锋·破阵者', img:'bosses/s1_vanguard.webp', frame:'#84cc16', rarity:'uncommon', desc:'目镜锁定, 卡宾点射, 千军之阵一击破开。'},
    {id:'L23', land:2, name:'银翼·麻烦终结者', img:'bosses/land_yinyi.webp', frame:'#c084fc', rarity:'rare', desc:'银翼掠过, 三段变形, 所有麻烦就此终结。'},
    {id:'L24', land:2, name:'决斗大师·千招之约', img:'bosses/land_juedou.webp', frame:'#22d3ee', rarity:'epic', desc:'千招在胸, 一诺既出, 唯有决斗见分晓。'},
    {id:'L25', land:2, name:'武器大师·战争铁砧', img:'bosses/s1_waranvil.webp', frame:'#fbbf24', rarity:'legendary', desc:'全副武库为砧, 六联导弹为锤, 战争在此锻造。'},
    {id:'L31', land:3, name:'火柴人·原初线条', img:'bosses/land_huochairen.webp', frame:'#94a3b8', rarity:'common', desc:'最简的线条, 最纯的力量, 万象皆由此起笔。'},
    {id:'L32', land:3, name:'影守·永夜之壁', img:'bosses/land_yingshou.webp', frame:'#84cc16', rarity:'uncommon', desc:'永夜筑成的高墙, 光无法逾越的守望者。'},
    {id:'L33', land:3, name:'万典之灵·未被写下的故事', img:'bosses/land_wandian.webp', frame:'#c084fc', rarity:'rare', desc:'万卷之灵, 一段尚未落笔的传说等你续写。'},
    {id:'L34', land:3, name:'凋零与新生之龙·四季轮转', img:'bosses/land_sijilong.webp', frame:'#22d3ee', rarity:'epic', desc:'一息凋零, 一息新生, 四季在它鳞下轮转。'},
    {id:'L35', land:3, name:'时之君主·克罗诺斯之影', img:'bosses/timelord.webp', frame:'#fbbf24', rarity:'legendary', desc:'时间的君主, 连过去与未来都俯首听命。'},
    {id:'L41', land:4, name:'机械主教·组装者', img:'bosses/s1_assembler.webp', frame:'#94a3b8', rarity:'common', desc:'独眼扫描, 流水线不息, 钢铁之躯源源不绝。'},
    {id:'L42', land:4, name:'苍穹守卫·阿尔基昂', img:'bosses/land_archeon.webp', frame:'#84cc16', rarity:'uncommon', desc:'翱翔于苍穹之巅, 天空的边界由它守卫。'},
    {id:'L43', land:4, name:'万械之神·奥米伽', img:'bosses/land_omiga.webp', frame:'#c084fc', rarity:'rare', desc:'万械归一, 终焉之神, 机械文明的终点。'},
    {id:'L44', land:4, name:'量子观测者·阿尔戈', img:'bosses/land_argo.webp', frame:'#22d3ee', rarity:'epic', desc:'观测即改变, 你的每一步它早已算尽。'},
    {id:'L45', land:4, name:'无光之渊·暗噬君主', img:'bosses/abysslord.webp', frame:'#fbbf24', rarity:'legendary', desc:'深渊无光, 一切坠入其中皆被吞噬殆尽。'},
    {id:'L51', land:5, name:'画壁判官·墨渊', img:'bosses/land_moyuan.webp', frame:'#94a3b8', rarity:'common', desc:'笔落成壁, 墨渊为狱, 善恶皆由他一笔定夺。'},
    {id:'L52', land:5, name:'夜罗刹·红莲战鬼', img:'bosses/land_yecha.webp', frame:'#84cc16', rarity:'uncommon', desc:'红莲燃夜, 罗刹出鞘, 战意如火焚尽苍穹。'},
    {id:'L53', land:5, name:'破坏神·终焉之相', img:'bosses/land_pohuai.webp', frame:'#c084fc', rarity:'rare', desc:'当他显出终焉之相, 世界便走向尽头。'},
    {id:'L54', land:5, name:'不动明王·焚天镇狱尊', img:'bosses/land_mingwang.webp', frame:'#22d3ee', rarity:'epic', desc:'焚天之焰, 镇狱之威, 明王一坐, 群魔不动。'},
    {id:'L55', land:5, name:'剑神·万剑归一', img:'bosses/land_jianshen.webp', frame:'#fbbf24', rarity:'legendary', desc:'万剑归一, 一念既起, 天下剑意尽入其鞘。'},
    {id:'L61', land:6, name:'诅咒之躯·绷带亡骸', img:'bosses/land_bengdai.webp', frame:'#94a3b8', rarity:'common', desc:'层层绷带缠裹千年诅咒, 亡骸不朽亦不安。'},
    {id:'L62', land:6, name:'亡灵咒术师·阿努比斯之影', img:'bosses/land_anubis.webp', frame:'#84cc16', rarity:'uncommon', desc:'死神之影, 亡灵听令, 冥界大门由他执掌。'},
    {id:'L63', land:6, name:'古埃及大祭司·真理之口的裁决者', img:'bosses/land_priest.webp', frame:'#c084fc', rarity:'rare', desc:'真理之口开启时, 谎言者的心将被称量。'},
    {id:'L64', land:6, name:'法老王·不朽金身', img:'bosses/land_pharaoh.webp', frame:'#22d3ee', rarity:'epic', desc:'黄金铸就不朽之躯, 千年王权从未落幕。'},
    {id:'L65', land:6, name:'天界守护者·黄金斯芬克斯', img:'bosses/land_sphinx.webp', frame:'#fbbf24', rarity:'legendary', desc:'谜语无人能解, 黄金之翼镇守天界之门。'},
    {id:'L71', land:7, name:'月之引航者·寂静潮汐', img:'bosses/land_yuezhi.webp', frame:'#94a3b8', rarity:'common', desc:'月光牵引潮汐起落, 寂静之海任其调遣。'},
    {id:'L72', land:7, name:'星陨武士·流亡之刃', img:'bosses/s1_exileblade.webp', frame:'#84cc16', rarity:'uncommon', desc:'银蓝光刃, 斗篷残影, 流亡之星一闪定生死。'},
    {id:'L73', land:7, name:'星核泰坦·虚空造物主', img:'bosses/land_xinghe.webp', frame:'#c084fc', rarity:'rare', desc:'以虚空为炉, 以星核为料, 亲手锻造星系。'},
    {id:'L74', land:7, name:'统御天使·圣光之翼', img:'bosses/lightangel.webp', frame:'#22d3ee', rarity:'epic', desc:'万道圣光自天而降, 圣翼之名即是审判。'},
    {id:'L75', land:7, name:'铸星者·原初匠人', img:'bosses/starmaker.webp', frame:'#fbbf24', rarity:'legendary', desc:'星辰皆出自他手, 创世的第一锤仍在回响。'},
    {id:'L81', land:8, name:'破晓仲裁者·索拉里斯', img:'bosses/land_poxiao.webp', frame:'#94a3b8', rarity:'common', desc:'第一缕破晓之光, 亦是无可违抗的仲裁。'},
    {id:'L82', land:8, name:'天启征服者·索拉里斯', img:'bosses/land_solaris.webp', frame:'#84cc16', rarity:'uncommon', desc:'天启号角吹响, 征服的铁蹄踏平一切。'},
    {id:'L83', land:8, name:'终末观测者·边界守夜人', img:'bosses/observer.webp', frame:'#c084fc', rarity:'rare', desc:'守望世界的边界, 记录终末降临的每一刻。'},
    {id:'L84', land:8, name:'活体行星·古老意志', img:'bosses/s1_ancientwill.webp', frame:'#22d3ee', rarity:'epic', desc:'一颗苏醒的行星, 以引力低语碾碎星海万物。'},
    {id:'L85', land:8, name:'星核帝皇·弗沙欧', img:'bosses/land_fushaou.webp', frame:'#fbbf24', rarity:'legendary', desc:'三皇归一之躯, 以星核为心, 一束终焉白光可焚灭万象。'},
  ];

  // 稀有度中文+配色(与正片一致口径)
  var LRINFO = {
    common:   {cn:'普通', color:'#94a3b8', glow:'rgba(148,163,184,.6)'},
    uncommon: {cn:'稀有', color:'#84cc16', glow:'rgba(132,204,22,.6)'},
    rare:     {cn:'史诗', color:'#c084fc', glow:'rgba(192,132,252,.7)'},
    epic:     {cn:'传说', color:'#22d3ee', glow:'rgba(34,211,238,.75)'},
    legendary:{cn:'至尊', color:'#fbbf24', glow:'rgba(251,191,36,.85)'}
  };
  var LRANK = ['common','uncommon','rare','epic','legendary'];
  // 各稀有度的卡ID列表(抽卡时从对应档随机)
  var BY_RARITY = {common:[],uncommon:[],rare:[],epic:[],legendary:[]};
  LAND_CARDS.forEach(function(c){ if(BY_RARITY[c.rarity]) BY_RARITY[c.rarity].push(c.id); });
  function cardById(id){ for(var i=0;i<LAND_CARDS.length;i++){ if(LAND_CARDS[i].id===id) return LAND_CARDS[i]; } return null; }

  // ═══ 独立存档 (localStorage: hansen_land_cardbook) ═══
  var LSK = 'hansen_land_cardbook';
  var LPENDING_KEY = 'hansen_land_gacha_pending_v942';
  var LPROOF_KEY = 'hansen_land_gacha_transaction_v942';
  var LTEMP_KEY = 'hansen_land_card_temp_unlock_until';  // 🔴v884(Hansen密码解锁): land卡临时全解锁标记(只影响显示·不污染真实owned)
  function _tempOn(){ try{ var u=parseInt(localStorage.getItem(LTEMP_KEY)||'0',10)||0; return Date.now()<u; }catch(e){ return false; } }
  function _readState(){
    var clean={owned:{},frags:{common:0,uncommon:0,rare:0,epic:0,legendary:0},pity:0,totalDraws:0,receipts:{},pendingReveal:null};
    try{
      var raw=localStorage.getItem(LSK),o=raw===null?{}:JSON.parse(raw);if(!o||typeof o!=='object'||Array.isArray(o))return {ok:false,value:clean};
      if(o.owned!=null&&(typeof o.owned!=='object'||Array.isArray(o.owned)||Object.keys(o.owned).some(function(id){return !cardById(id)||(o.owned[id]!==true&&o.owned[id]!==false);})))return {ok:false,value:clean};
      Object.keys(o.owned||{}).forEach(function(id){if(o.owned[id]===true)clean.owned[id]=true;});
      if(o.frags!=null&&(typeof o.frags!=='object'||Array.isArray(o.frags)||Object.keys(o.frags).some(function(r){return LRANK.indexOf(r)<0||!_isNN(o.frags[r]);})))return {ok:false,value:clean};
      LRANK.forEach(function(r){clean.frags[r]=o.frags&&o.frags[r]!=null?Number(o.frags[r]):0;});
      if(o.pity!=null&&(!_isNN(o.pity)||Number(o.pity)>=L_HARD_PITY)||o.totalDraws!=null&&!_isNN(o.totalDraws))return {ok:false,value:clean};
      clean.pity=o.pity==null?0:Number(o.pity);clean.totalDraws=o.totalDraws==null?0:Number(o.totalDraws);
      if(o.receipts!=null&&(typeof o.receipts!=='object'||Array.isArray(o.receipts)))return {ok:false,value:clean};
      var receiptKeys=Object.keys(o.receipts||{});for(var ri=0;ri<receiptKeys.length;ri++){
        var txid=receiptKeys[ri],x=o.receipts[txid],card=x&&cardById(x.id);
        if(!/^landdraw-[a-z0-9-]{8,160}$/i.test(txid)||!x||typeof x!=='object'||!card||typeof x.dup!=='boolean'||x.rarity!==card.rarity||!_isNN(x.frag)||!_isNN(x.at)||(x.dup?x.frag<=0:x.frag!==0)||!clean.owned[x.id])return {ok:false,value:clean};
      }
      receiptKeys.slice(-80).forEach(function(txid){var x=o.receipts[txid];clean.receipts[txid]={id:x.id,dup:x.dup,rarity:x.rarity,frag:Number(x.frag),at:Number(x.at)};});
      if(o.pendingReveal!=null){
        var pr=o.pendingReveal,pc=pr&&cardById(pr.id),ptx=String(pr&&pr.txid||'');
        if(!pr||typeof pr!=='object'||pr.version!==955||!pc||!clean.owned[pc.id]||typeof pr.dup!=='boolean'||!_isNN(pr.frag)||!_isNN(pr.at)||!/^land(?:draw|frag)-[a-z0-9-]{8,160}$/i.test(ptx)||(pr.dup?Number(pr.frag)<=0:Number(pr.frag)!==0))return {ok:false,value:clean};
        clean.pendingReveal={version:955,txid:ptx,id:pc.id,dup:pr.dup,frag:Number(pr.frag),at:Number(pr.at)};
      }
      return {ok:true,value:clean};
    }catch(e){return {ok:false,value:clean};}
  }
  function _isNN(n){n=Number(n);return isFinite(n)&&Math.floor(n)===n&&n>=0;}
  function _read(){return _readState().value;}
  function _write(o){ try{var raw=JSON.stringify(o);localStorage.setItem(LSK,raw);return localStorage.getItem(LSK)===raw;}catch(e){return false;} }
  function _pendingCopy(x){return x?{version:955,txid:x.txid,id:x.id,dup:x.dup,frag:Number(x.frag)||0,at:Number(x.at)||0}:null;}
  function _queueReveal(txid,res){
    var rs=_readState();if(!rs.ok||!res||!cardById(res.id))return false;var o=rs.value;
    if(o.pendingReveal)return o.pendingReveal.txid===txid&&o.pendingReveal.id===res.id;
    o.pendingReveal={version:955,txid:String(txid),id:res.id,dup:!!res.dup,frag:Math.max(0,Number(res.frag)||0),at:Date.now()};
    return _write(o);
  }

  // 🔴v971 星海大陆殿堂: 向 boss_hall 暴露只读卡数据(独立卡组原则不变,仅读不写)
  window.HansenLandCards = { list: LAND_CARDS };

  window.HansenLandCardbook = {
    all: function(){ return LAND_CARDS.slice(); },
    cardById: cardById,
    rinfo: function(r){ return LRINFO[r]||LRINFO.common; },
    has: function(id){ if(_tempOn()) return true; return !!_read().owned[id]; },  // 🔴v884 临时解锁时全部显已拥有
    tempOn: _tempOn,
    ownedCount: function(){ if(_tempOn()) return LAND_CARDS.length; return Object.keys(_read().owned).length; },  // 🔴v884 临时解锁=满值
    total: function(){ return LAND_CARDS.length; },
    ownedCountByRarity: function(r){ if(_tempOn()) return (BY_RARITY[r]||[]).length; var o=_read().owned,n=0; LAND_CARDS.forEach(function(c){ if(c.rarity===r && o[c.id]) n++; }); return n; },  // 🔴v884 临时解锁=该档满值
    totalByRarity: function(r){ return (BY_RARITY[r]||[]).length; },
    getFrags: function(){ return _read().frags; },
    getPity: function(){ return _read().pity; },
    getTotalDraws: function(){ return _read().totalDraws; },
    peekPendingReveal: function(){var rs=_readState();return rs.ok?_pendingCopy(rs.value.pendingReveal):null;},
    ackPendingReveal: function(txid){var rs=_readState();if(!rs.ok)return false;var o=rs.value;if(!o.pendingReveal)return true;if(o.pendingReveal.txid!==String(txid||''))return false;o.pendingReveal=null;return _write(o);},
    // 获得一张卡: 已有→碎片·新卡→收入
    obtain: function(id){
      var rs=_readState();if(!rs.ok)return null;var o=rs.value; var c=cardById(id); if(!c) return null; var r=c.rarity;
      if(o.owned[id]){
        var DUP={common:10,uncommon:20,rare:40,epic:80,legendary:200};
        var add=DUP[r]||10; o.frags[r]=(o.frags[r]||0)+add; if(!_write(o))return null;
        return {dup:true, id:id, rarity:r, frag:add};
      } else { o.owned[id]=true; if(!_write(o))return null; return {dup:false, id:id, rarity:r}; }
    },
    setTempUnlock: function(hours){ if(hours==null||isNaN(hours))hours=24; try{ localStorage.setItem(LTEMP_KEY, String(Date.now()+hours*3600*1000)); }catch(e){} if(window.hansenRenderCards)try{window.hansenRenderCards();}catch(e2){} },
    clearTempUnlock: function(){ try{ localStorage.removeItem(LTEMP_KEY); }catch(e){} if(window.hansenRenderCards)try{window.hansenRenderCards();}catch(e2){} },
    bumpPity: function(gotLeg){ var rs=_readState();if(!rs.ok)return false;var o=rs.value; o.pity = gotLeg?0:(o.pity+1); o.totalDraws=(o.totalDraws||0)+1; return _write(o); },
    // 碎片兑换(至尊不能换·与正片同规则)
    exchangeByFrag: function(rarity){
      if(rarity==='legendary') return null;
      var COST={common:50,uncommon:100,rare:200,epic:400}; var cost=COST[rarity]; if(!cost) return null;
      var rs=_readState();if(!rs.ok)return null;var o=rs.value;if(o.pendingReveal)return null;if((o.frags[rarity]||0)<cost) return null;
      var pool=BY_RARITY[rarity]||[]; var pick=null;
      for(var i=0;i<pool.length;i++){ if(!o.owned[pool[i]]){ pick=pool[i]; break; } }
      if(pick===null) return null;
      o.frags[rarity]-=cost;o.owned[pick]=true;o.pendingReveal={version:955,txid:'landfrag-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),id:pick,dup:false,frag:0,at:Date.now()};return _write(o)?pick:null;
    }
  };

  // ═══ 独立抽卡池 (独立保底·共用金币钱包) ═══
  var L_COST = 1000, L_HARD_PITY = 100, L_SOFT_START = 80;
  var LBASE = {common:55, uncommon:27, rare:12, epic:5.5, legendary:0.5};
  function legRate(pity){ var d=pity+1; if(d>=L_HARD_PITY) return 100; if(d<L_SOFT_START) return LBASE.legendary; var t=(d-L_SOFT_START)/(L_HARD_PITY-L_SOFT_START); return LBASE.legendary+(100-LBASE.legendary)*t; }
  function chooseDraw(pityOverride){
    var CB=window.HansenLandCardbook; var pity=isFinite(pityOverride)?pityOverride:CB.getPity(); var lr=legRate(pity);
    var r=Math.random()*100, rarity, gotLeg=false;
    if(r<lr){ rarity='legendary'; gotLeg=true; }
    else{ var rest=['common','uncommon','rare','epic']; var rt=LBASE.common+LBASE.uncommon+LBASE.rare+LBASE.epic; var r2=Math.random()*rt,acc=0; rarity='common'; for(var i=0;i<rest.length;i++){ acc+=LBASE[rest[i]]; if(r2<acc){rarity=rest[i];break;} } }
    var pool=BY_RARITY[rarity]||BY_RARITY.common; var id=pool[Math.floor(Math.random()*pool.length)];
    return {id:id,gotLeg:gotLeg};
  }
  function readPending(){
    try{var raw=localStorage.getItem(LPENDING_KEY);if(raw===null)return {ok:true,value:null};var p=JSON.parse(raw),c=p&&cardById(p.id),before=Math.floor(Number(p&&p.before));
      if(!p||p.version!==942||!c||p.cost!==L_COST||!isFinite(before)||before<L_COST||p.target!==before-L_COST||(p.stage!=='prepared'&&p.stage!=='spent')||p.gotLeg!==(c.rarity==='legendary')||!/^landdraw-[a-z0-9-]{8,160}$/i.test(String(p.txid||'')))return {ok:false,value:null};
      return {ok:true,value:{version:942,txid:String(p.txid),id:c.id,gotLeg:c.rarity==='legendary',cost:L_COST,before:before,target:before-L_COST,stage:p.stage}};
    }catch(e){return {ok:false,value:null};}
  }
  function writePending(p){try{var raw=JSON.stringify(p);localStorage.setItem(LPENDING_KEY,raw);return localStorage.getItem(LPENDING_KEY)===raw;}catch(e){return false;}}
  function clearPending(){try{localStorage.removeItem(LPENDING_KEY);return localStorage.getItem(LPENDING_KEY)===null;}catch(e){return false;}}
  function coinState(){try{if(!window.HansenCoins||typeof HansenCoins.get!=='function')return {ok:false,value:NaN};var raw=localStorage.getItem('hansen_wallet_coins'),stored=raw===null?0:Number(raw),api=Number(HansenCoins.get());return isFinite(stored)&&Math.floor(stored)===stored&&stored>=0&&api===stored?{ok:true,value:stored}:{ok:false,value:NaN};}catch(e){return {ok:false,value:NaN};}}
  function coinBalance(){var r=coinState();return r.ok?r.value:NaN;}
  function spendCoins(n){try{return !!(window.HansenCoins&&typeof window.HansenCoins.spend==='function'&&window.HansenCoins.spend(n)===true);}catch(e){return false;}}
  function proofFor(p,state){return {version:942,txid:p.txid,id:p.id,cost:p.cost,before:p.before,target:p.target,state:state};}
  function readProof(p){try{var raw=localStorage.getItem(LPROOF_KEY);if(raw===null)return {ok:true,value:null};var x=JSON.parse(raw);if(!x||x.version!==942||x.txid!==p.txid||x.id!==p.id||x.cost!==p.cost||x.before!==p.before||x.target!==p.target||(x.state!=='prepared'&&x.state!=='paid'))return {ok:false,value:null};return {ok:true,value:x};}catch(e){return {ok:false,value:null};}}
  function writeProof(p,state){try{var raw=JSON.stringify(proofFor(p,state));localStorage.setItem(LPROOF_KEY,raw);return localStorage.getItem(LPROOF_KEY)===raw;}catch(e){return false;}}
  function confirmProof(p,balance){var r=readProof(p);if(!r.ok||!r.value||balance!==p.target)return false;return r.value.state==='paid'||writeProof(p,'paid');}
  function clearProof(p){try{var r=readProof(p);if(!r.ok)return false;if(!r.value)return true;localStorage.removeItem(LPROOF_KEY);return localStorage.getItem(LPROOF_KEY)===null;}catch(e){return false;}}
  function cleanup(p){return clearProof(p)&&clearPending();}
  function clearOrphanProof(){try{var raw=localStorage.getItem(LPROOF_KEY);if(raw===null)return true;var x=JSON.parse(raw),c=x&&cardById(x.id),before=Number(x&&x.before);if(!x||x.version!==942||!c||x.cost!==L_COST||!isFinite(before)||Math.floor(before)!==before||before<L_COST||x.target!==before-L_COST||(x.state!=='prepared'&&x.state!=='paid')||!/^landdraw-[a-z0-9-]{8,160}$/i.test(String(x.txid||'')))return false;localStorage.removeItem(LPROOF_KEY);return localStorage.getItem(LPROOF_KEY)===null;}catch(e){return false;}}
  function receipt(txid){var rs=_readState();if(!rs.ok)return {ok:false,value:null};var x=rs.value.receipts[txid];return {ok:true,value:x?{id:x.id,dup:x.dup,rarity:x.rarity,frag:x.frag}:null};}
  function deliverDraw(p){
    var rs=_readState();if(!rs.ok)return null;var o=rs.value,prior=o.receipts[p.txid];if(prior)return {id:prior.id,dup:prior.dup,rarity:prior.rarity,frag:prior.frag};
    var cs=coinState(),pf=readProof(p);if(!cs.ok||cs.value!==p.target||!pf.ok||!pf.value||pf.value.state!=='paid')return null;
    var c=cardById(p.id);if(!c)return null;var res;
    if(o.owned[p.id]){var DUP={common:10,uncommon:20,rare:40,epic:80,legendary:200},add=DUP[c.rarity]||10;o.frags[c.rarity]=(o.frags[c.rarity]||0)+add;res={id:p.id,dup:true,rarity:c.rarity,frag:add};}
    else{o.owned[p.id]=true;res={id:p.id,dup:false,rarity:c.rarity,frag:0};}
    o.pity=p.gotLeg?0:Math.min(L_HARD_PITY-1,o.pity+1);o.totalDraws++;
    o.receipts[p.txid]={id:res.id,dup:res.dup,rarity:res.rarity,frag:res.frag,at:Date.now()};
    var ids=Object.keys(o.receipts);if(ids.length>80)delete o.receipts[ids[0]];
    if(o.pendingReveal&&o.pendingReveal.txid!==p.txid)return null;
    o.pendingReveal={version:955,txid:p.txid,id:res.id,dup:res.dup,frag:res.frag,at:Date.now()};
    return _write(o)?res:null;
  }
  function recoverDraw(){
    var pr=readPending();if(!pr.ok)return {status:'pending',reason:'storage'};var p=pr.value;if(!p)return {status:clearOrphanProof()?'none':'pending',reason:'proof'};var rr=receipt(p.txid);if(!rr.ok)return {status:'pending',id:p.id};var got=rr.value;
    if(got){if(!_queueReveal(p.txid,got))return {status:'pending',id:got.id};return {status:cleanup(p)?'committed':'pending',id:got.id,result:got};}
    var cs=coinState();if(!cs.ok)return {status:'pending',id:p.id};var balance=cs.value,pf=readProof(p);if(!pf.ok)return {status:'pending',id:p.id};
    if(balance===p.before){if(pf.value&&pf.value.state==='paid')return {status:'pending',id:p.id};return {status:cleanup(p)?'cancelled':'pending',id:p.id};}
    if(balance!==p.target||!pf.value||!confirmProof(p,balance))return {status:'pending',id:p.id};
    var res=deliverDraw(p);if(!res)return {status:'pending',id:p.id};return {status:cleanup(p)?'committed':'pending',id:p.id,result:res};
  }
  function purchaseDraw(){
    var prior=recoverDraw();if(prior.status==='pending')return null;if(prior.status==='committed')return prior;
    var cs=coinState(),bs=_readState();if(!cs.ok||!bs.ok)return null;if(bs.value.pendingReveal)return {status:'reveal-pending',id:bs.value.pendingReveal.id,result:_pendingCopy(bs.value.pendingReveal)};var before=cs.value;if(before<L_COST)return null;var chosen=chooseDraw(bs.value.pity);
    var p={version:942,txid:'landdraw-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),id:chosen.id,gotLeg:chosen.gotLeg,cost:L_COST,before:before,target:before-L_COST,stage:'prepared'};
    if(!writePending(p))return null;
    if(!writeProof(p,'prepared')){cleanup(p);return null;}spendCoins(L_COST);var as=coinState();if(!as.ok)return null;var after=as.value;
    if(after===p.before){cleanup(p);return null;}if(after!==p.target||!confirmProof(p,after))return null;
    p.stage='spent';writePending(p);
    var res=deliverDraw(p);if(!res)return null;return {status:cleanup(p)?'committed':'pending',id:p.id,result:res};
  }
  window.HansenLandGacha = { cost:function(){return L_COST;}, setCost:function(n){L_COST=n|0;}, drawOnce:function(){return chooseDraw().id;}, purchase:purchaseDraw, recoverPending:recoverDraw, pendingKey:LPENDING_KEY, legRate:legRate, HARD_PITY:L_HARD_PITY, SOFT_START:L_SOFT_START, BASE:LBASE, RINFO:LRINFO, RANK:LRANK };
  try{setTimeout(function(){try{recoverDraw();}catch(e){}},0);}catch(e){}

  window.__hansenLandCardsData = { LAND_CARDS:LAND_CARDS, LRINFO:LRINFO, LRANK:LRANK, BY_RARITY:BY_RARITY };
})();

// ═══════════════════════════════════════════════════════════════
// UI: 单词大陆卡册分区(挂卡册页底部) + 抽卡界面 + 揭晓动画
// ═══════════════════════════════════════════════════════════════
(function(){
  var ISLAND_NAMES = {1:'①迷雾心湖',2:'②风纹草原',3:'③时之钟谷',4:'④铸剑锻炉山',5:'⑤晶石回廊',6:'⑥智慧藏书林',7:'⑦万邦港城',8:'⑧星火火山口'};
  function CB(){ return window.HansenLandCardbook; }

  // 🔴v971 星海大陆殿堂: 已拥有卡点击 → 全屏 BOSS 殿堂(boss_hall land 模式)
  //   own=已拥有卡id列表(尊重临时全解锁 has()); 背景=立绘程序化场景(殿堂侧模糊双层,零新图)
  window.__hsnOpenLandHall = function(cardId){
    try{
      if(document.getElementById('__hsn_landhall')) return;
      var cb = CB(); if(!cb || !cb.has(cardId)) return;
      var own = [];
      (cb.all()||[]).forEach(function(c){ if(cb.has(c.id)) own.push(c.id); });
      var mask = document.createElement('div');
      mask.id = '__hsn_landhall';
      mask.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#0a0a14';
      var iframe = document.createElement('iframe');
      iframe.src = 'boss_hall.html?v=994&land=1&card=' + encodeURIComponent(cardId) + '&lown=' + encodeURIComponent(own.join(','));
      iframe.setAttribute('title', '星海大陆 BOSS 殿堂');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0a0a14';
      mask.appendChild(iframe);
      var closeBtn = document.createElement('div');
      closeBtn.textContent = '\u00d7';
      closeBtn.setAttribute('role','button');
      closeBtn.setAttribute('aria-label','关闭');
      closeBtn.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;z-index:5;width:40px;height:40px;border-radius:50%;background:rgba(15,23,42,.85);border:1px solid rgba(148,163,184,.4);color:#e2e8f0;font-size:24px;line-height:38px;text-align:center;cursor:pointer';
      closeBtn.addEventListener('click', function(){ if(mask.parentNode) mask.parentNode.removeChild(mask); });
      mask.appendChild(closeBtn);
      document.body.appendChild(mask);
    }catch(e){}
  };
  function G(){ return window.HansenLandGacha; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // —— 卡册页「单词大陆」分区 HTML(供卡册页调用注入) ——
  window.hansenRenderLandCardSection = function(){
    var cb=CB(); if(!cb) return '';
    var owned=cb.ownedCount(), total=cb.total();
    var pct=total?Math.round(owned*100/total):0;
    var all=cb.all();
    var h='';
    // 分区大标题 + 进度
    h+='<div style="margin:22px 4px 10px">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
        '<div style="font-size:16px;font-weight:900;background:linear-gradient(90deg,#fbbf24,#ef4444,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">🌏 单词大陆图鉴</div>'+
        '<div style="font-size:13px;font-weight:900;color:#fbbf24;background:rgba(251,191,36,.15);padding:4px 11px;border-radius:13px">'+owned+' / '+total+'</div></div>';
    h+='<div style="height:8px;background:rgba(15,23,42,.7);border-radius:5px;overflow:hidden;border:1px solid rgba(251,191,36,.2)"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#fbbf24,#ef4444,#ec4899);border-radius:5px"></div></div>';
    // 抽卡入口按钮
    h+='<div class="lg-banner" onclick="window.HansenLandGachaUI&&window.HansenLandGachaUI.open()" style="margin-top:10px;padding:12px 14px;background:linear-gradient(135deg,#7c3aed,#4338ca);border:2px solid #a855f7;border-radius:12px;text-align:center;cursor:pointer">'+
        '<div style="font-size:15px;font-weight:900;color:#fff">🎴 单词大陆抽卡 · 集齐 '+total+' 位强敌</div>'+
        '<div style="font-size:11px;color:#ddd6fe;margin-top:3px">花金币抽 · 独立卡池 · 稀有度越高越难得</div></div>';
    h+='</div>';
    // 8岛分组
    for(var isl=1; isl<=8; isl++){
      var cards=all.filter(function(c){return c.land===isl;});
      if(!cards.length) continue;
      var got=0; cards.forEach(function(c){ if(cb.has(c.id)) got++; });
      h+='<div style="margin:0 4px 16px">';
      h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'+
          '<div style="width:4px;height:15px;border-radius:2px;background:#a855f7"></div>'+
          '<div style="font-size:14px;font-weight:800;color:#e2e8f0">'+esc(ISLAND_NAMES[isl]||('第'+isl+'岛'))+'</div>'+
          '<div style="font-size:11px;color:#94a3b8">'+got+'/'+cards.length+'</div></div>';
      h+='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">';
      cards.forEach(function(c){
        var un=cb.has(c.id);
        if(un){
          h+='<div onclick="window.__hsnOpenLandHall&&window.__hsnOpenLandHall(\''+c.id+'\')" style="cursor:pointer;border:2px solid '+c.frame+';background-color:rgba(30,41,59,.4);border-radius:9px;padding:3px;text-align:center">'+
             '<div style="background:#0f172a;border-radius:6px;overflow:hidden;aspect-ratio:1"><img loading="lazy" decoding="async" src="'+c.img+'?v=994" onerror="hansenImgErr&&hansenImgErr(this)" style="width:100%;height:100%;object-fit:cover;display:block"></div>'+
             '<div style="font-size:8px;font-weight:700;color:#fff;margin-top:2px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.name.split('·').pop())+'</div></div>';
        }else{
          h+='<div style="border:2px dashed #334155;background-color:rgba(15,23,42,.4);border-radius:9px;padding:3px;text-align:center;opacity:.85">'+
             '<div style="background:#0f172a;border-radius:6px;overflow:hidden;aspect-ratio:1;position:relative;display:flex;align-items:center;justify-content:center">'+
             '<img loading="lazy" decoding="async" src="'+c.img+'?v=994" onerror="hansenImgErr&&hansenImgErr(this)" style="width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) brightness(.25) blur(2px);position:absolute;inset:0">'+
             '<div style="position:relative;font-size:20px;color:#475569">🔒</div></div>'+
             '<div style="font-size:8px;font-weight:700;color:#475569;margin-top:2px">???</div></div>';
        }
      });
      h+='</div></div>';
    }
    return h;
  };
})();

// ═══ 抽卡界面 + 星海命轮揭晓动画 (HansenLandGachaUI·独立 lgr-* 引擎) ═══
(function(){
  var lgrActive=null;
  var uiBusy=false;
  function CB(){ return window.HansenLandCardbook; }
  function G(){ return window.HansenLandGacha; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toast(msg){
    var t=document.createElement('div'); t.textContent=msg;
    t.style.cssText='position:fixed;left:50%;bottom:22%;transform:translateX(-50%);background:rgba(15,23,42,.95);color:#fff;padding:11px 20px;border-radius:22px;font-size:14px;font-weight:700;z-index:100000;border:1px solid #a855f7';
    document.body.appendChild(t); setTimeout(function(){ if(t.parentNode)t.remove(); },2200);
  }
  function ensureRevealCSS(){
    if(document.getElementById('hansenLandRevealCSSV955')) return;
    var s=document.createElement('style'); s.id='hansenLandRevealCSSV955';
    s.textContent=''+
      '.lgr-overlay{--lgr-neutral:#93c5fd;--lgr-text:#f8fafc;--lgr-muted:#cbd5e1;position:fixed;inset:0;z-index:100000;display:grid;place-items:center;overflow:hidden;isolation:isolate;contain:layout paint style;background:radial-gradient(circle at 50% 42%,rgba(37,99,235,.26),transparent 31%),radial-gradient(circle at 28% 20%,rgba(124,58,237,.16),transparent 28%),radial-gradient(circle at 75% 74%,rgba(6,182,212,.12),transparent 34%),#050817;color:var(--lgr-text);color-scheme:dark;opacity:0;transition:opacity .16s linear;touch-action:pan-y;-webkit-tap-highlight-color:transparent}'+
      '.lgr-overlay.is-open{opacity:1}'+
      '.lgr-scroll{position:relative;z-index:8;width:430px;max-width:100%;width:min(100%,430px);max-height:100vh;max-height:100dvh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:18px 18px 20px;padding:max(18px,env(safe-area-inset-top)) 18px max(20px,env(safe-area-inset-bottom));box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;scrollbar-width:none}'+
      '.lgr-scroll::-webkit-scrollbar{display:none}'+
      '.lgr-stars,.lgr-stars:before,.lgr-stars:after{position:absolute;inset:0;content:"";pointer-events:none;background-repeat:no-repeat}'+
      '.lgr-stars{z-index:0;background-image:radial-gradient(circle at 8% 18%,#fff 0 1px,transparent 1.8px),radial-gradient(circle at 18% 76%,#93c5fd 0 1px,transparent 1.8px),radial-gradient(circle at 34% 27%,#fff 0 1.2px,transparent 2px),radial-gradient(circle at 47% 83%,#c4b5fd 0 1px,transparent 1.8px),radial-gradient(circle at 62% 12%,#fff 0 1px,transparent 1.8px),radial-gradient(circle at 73% 68%,#67e8f9 0 1.2px,transparent 2px),radial-gradient(circle at 89% 31%,#fff 0 1px,transparent 1.8px),radial-gradient(circle at 95% 88%,#a5b4fc 0 1.2px,transparent 2px);animation:lgrStarsBreathe 2.8s ease-in-out infinite alternate}'+
      '.lgr-stars:before{background-image:radial-gradient(circle at 15% 43%,rgba(255,255,255,.9) 0 1px,transparent 2px),radial-gradient(circle at 27% 8%,rgba(147,197,253,.9) 0 1px,transparent 2px),radial-gradient(circle at 53% 33%,rgba(255,255,255,.85) 0 1px,transparent 2px),radial-gradient(circle at 69% 91%,rgba(196,181,253,.9) 0 1px,transparent 2px),radial-gradient(circle at 82% 52%,rgba(255,255,255,.9) 0 1px,transparent 2px)}'+
      '.lgr-nebula{position:absolute;z-index:1;width:min(90vw,560px);aspect-ratio:1;border-radius:50%;pointer-events:none;opacity:.72;background:radial-gradient(circle,rgba(59,130,246,.22) 0 13%,rgba(124,58,237,.12) 31%,transparent 67%);animation:lgrNebulaPulse 2.2s ease-in-out infinite alternate}'+
      '.lgr-gate{position:absolute;z-index:2;left:50%;top:45%;width:min(92vw,430px);aspect-ratio:1;border-radius:50%;transform:translate3d(-50%,-50%,0);pointer-events:none;border:1px solid rgba(147,197,253,.22);box-shadow:inset 0 0 46px rgba(59,130,246,.12)}'+
      '.lgr-gate:before,.lgr-gate:after{content:"";position:absolute;border-radius:50%;inset:8%;border:2px solid rgba(147,197,253,.34);animation:lgrGatePulse 1.35s ease-in-out infinite alternate}'+
      '.lgr-gate:after{inset:20%;border-color:rgba(196,181,253,.38);animation-delay:.22s}'+
      '.lgr-kicker{position:relative;z-index:6;margin:0 0 13px;padding:6px 14px;border:1px solid rgba(147,197,253,.35);border-radius:999px;background:rgba(15,23,42,.66);color:#dbeafe;font-size:12px;font-weight:900;letter-spacing:.14em;text-align:center}'+
      '.lgr-stage{position:relative;z-index:5;width:58vw;height:81.2vw;max-width:230px;max-height:322px;perspective:1100px;animation:lgrStageEnter .42s cubic-bezier(.18,.88,.24,1) both}'+
      '.lgr-rotor{position:absolute;inset:0;transform-style:preserve-3d;-webkit-transform-style:preserve-3d;will-change:transform}'+
      '.lgr-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}'+
      '.lgr-rear{transform:rotateY(180deg)}'+
      '.lgr-card-back{position:absolute;inset:0;border-radius:20px;padding:9px;box-sizing:border-box;background:linear-gradient(145deg,#f8d77d 0%,#b7791f 8%,#0b1f4b 11%,#09152f 86%,#2563eb 89%,#f8d77d 100%);box-shadow:0 0 0 1px rgba(255,255,255,.25),0 18px 50px rgba(0,0,0,.48)}'+
      '.lgr-card-back:before{content:"";position:absolute;inset:13px;border-radius:14px;border:1px solid rgba(147,197,253,.5);background:radial-gradient(circle at 50% 47%,rgba(96,165,250,.32),transparent 21%),radial-gradient(circle at 50% 50%,transparent 0 31%,rgba(196,181,253,.24) 31.5% 32.5%,transparent 33%),linear-gradient(135deg,rgba(255,255,255,.07),transparent 42% 58%,rgba(59,130,246,.08));box-shadow:inset 0 0 28px rgba(37,99,235,.28)}'+
      '.lgr-card-back:after{content:"✦";position:absolute;left:50%;top:48%;transform:translate3d(-50%,-50%,0);width:70px;height:70px;border-radius:50%;display:grid;place-items:center;border:2px solid rgba(253,230,138,.82);background:radial-gradient(circle,#dbeafe 0 5%,#60a5fa 7% 19%,#312e81 22% 54%,#07142e 58%);box-shadow:0 0 0 8px rgba(96,165,250,.08),0 0 28px rgba(96,165,250,.55);color:#fef3c7;font-size:38px;text-shadow:0 0 12px #fff}'+
      '.lgr-corner{position:absolute;z-index:2;width:24px;height:24px;border-color:#fde68a;opacity:.86}'+
      '.lgr-c1{left:22px;top:22px;border-left:2px solid;border-top:2px solid}.lgr-c2{right:22px;top:22px;border-right:2px solid;border-top:2px solid}.lgr-c3{left:22px;bottom:22px;border-left:2px solid;border-bottom:2px solid}.lgr-c4{right:22px;bottom:22px;border-right:2px solid;border-bottom:2px solid}'+
      '.lgr-overlay[data-phase="spin"] .lgr-rotor{animation:lgrCardSpin 2.05s cubic-bezier(.08,.78,.16,1) both}'+
      '.lgr-overlay[data-phase="settle"] .lgr-rotor,.lgr-overlay.lgr-no-motion .lgr-rotor{animation:none;transform:translateZ(0) rotateY(1440deg)}'+
      '.lgr-hint{position:relative;z-index:6;min-height:25px;margin-top:16px;color:#dbeafe;font-size:14px;font-weight:900;letter-spacing:.08em;text-align:center;text-shadow:0 0 14px rgba(96,165,250,.65)}'+
      '.lgr-dots{display:inline-flex;gap:5px;margin-left:6px;vertical-align:middle}.lgr-dots i{width:5px;height:5px;border-radius:50%;background:#bfdbfe;animation:lgrDot 1s ease-in-out infinite}.lgr-dots i:nth-child(2){animation-delay:.16s}.lgr-dots i:nth-child(3){animation-delay:.32s}'+
      '.lgr-result{position:relative;z-index:7;width:100%;display:flex;flex-direction:column;align-items:center;animation:lgrResultEnter .54s cubic-bezier(.16,.86,.22,1) both}'+
      '.lgr-result-card{--lgr-rc:#93c5fd;position:relative;width:60vw;height:84vw;max-width:238px;max-height:333px;border-radius:21px;padding:7px;box-sizing:border-box;background:linear-gradient(145deg,#fff 0 2%,var(--lgr-rc) 4%,#111827 8% 92%,var(--lgr-rc) 96%,#fff 100%);box-shadow:0 18px 58px rgba(0,0,0,.55),0 0 32px var(--lgr-glow,rgba(147,197,253,.6));overflow:hidden}'+
      '.lgr-result-card:after{content:"";position:absolute;z-index:5;inset:-25% auto -25% -55%;width:32%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);transform:translate3d(-180%,0,0);animation:lgrLightSweep .72s .12s ease-out both;pointer-events:none}'+
      '.lgr-card-inner{height:100%;border-radius:15px;overflow:hidden;background:#091124;display:flex;flex-direction:column}'+
      '.lgr-image-slot{position:relative;flex:1;min-height:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(96,165,250,.23),transparent 52%),#0b1328}'+
      '.lgr-image-slot:before{content:"✦";font-size:54px;color:#93c5fd;opacity:.7;text-shadow:0 0 22px #60a5fa}'+
      '.lgr-image-slot.has-image:before{display:none}.lgr-image{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain;background:#fff}'+
      '.lgr-card-copy{flex:0 0 auto;padding:9px 8px 11px;text-align:center;background:linear-gradient(180deg,#101a33,#070d1c)}'+
      '.lgr-rarity{display:inline-flex;align-items:center;justify-content:center;min-height:23px;padding:2px 11px;border:1px solid var(--lgr-rc);border-radius:999px;color:#fff;background:rgba(2,6,23,.82);font-size:11px;font-weight:900;letter-spacing:.12em}'+
      '.lgr-name{margin-top:7px;color:#fff;font-size:15px;font-weight:950;line-height:1.3;text-shadow:0 1px 3px #000}'+
      '.lgr-meta{width:min(100%,350px);margin-top:12px;text-align:center;animation:lgrMetaEnter .36s .15s ease-out both}'+
      '.lgr-status{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:5px 15px;border:1px solid var(--lgr-rc,#93c5fd);border-radius:999px;background:rgba(15,23,42,.9);color:#fff;font-size:13px;font-weight:900}'+
      '.lgr-desc{margin:8px auto 11px;color:#e2e8f0;font-size:12px;font-weight:650;line-height:1.55;text-shadow:0 1px 2px #000}'+
      '.lgr-ok{min-width:174px;min-height:46px;padding:10px 24px;border:1px solid rgba(255,255,255,.72);border-radius:14px;background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 8px 24px rgba(37,99,235,.34);color:#fff;font-size:16px;font-weight:950;cursor:pointer;touch-action:manipulation}'+
      '.lgr-ok:focus-visible{outline:3px solid #fde68a;outline-offset:3px}'+
      '.lgr-particles{position:absolute;z-index:6;left:50%;top:45%;width:1px;height:1px;pointer-events:none}.lgr-particle{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--lgr-rc,#93c5fd);box-shadow:0 0 10px var(--lgr-rc,#93c5fd);opacity:0;animation:lgrParticle var(--d,850ms) var(--delay,0ms) ease-out both}'+
      '.lgr-overlay[data-paused] *,.lgr-overlay[data-paused] *:before,.lgr-overlay[data-paused] *:after{animation-play-state:paused!important}'+
      '.lgr-overlay[data-phase="reveal"] .lgr-stars,.lgr-overlay[data-phase="reveal"] .lgr-nebula,.lgr-overlay[data-phase="reveal"] .lgr-gate:before,.lgr-overlay[data-phase="reveal"] .lgr-gate:after{animation:none!important}'+
      '@keyframes lgrStarsBreathe{from{opacity:.45;transform:scale(1)}to{opacity:.95;transform:scale(1.025)}}'+
      '@keyframes lgrNebulaPulse{from{opacity:.48;transform:scale(.92)}to{opacity:.8;transform:scale(1.07)}}'+
      '@keyframes lgrGatePulse{from{opacity:.36;transform:scale(.92)}to{opacity:.9;transform:scale(1.04)}}'+
      '@keyframes lgrStageEnter{from{opacity:0;transform:translate3d(0,32px,0) scale(.78)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}'+
      '@keyframes lgrCardSpin{0%{transform:translateZ(0) rotateY(0deg)}100%{transform:translateZ(0) rotateY(1440deg)}}'+
      '@keyframes lgrDot{0%,100%{opacity:.28;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}'+
      '@keyframes lgrResultEnter{from{opacity:0;transform:rotateY(-86deg) scale(.78)}to{opacity:1;transform:rotateY(0deg) scale(1)}}'+
      '@keyframes lgrMetaEnter{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:translate3d(0,0,0)}}'+
      '@keyframes lgrLightSweep{from{transform:translate3d(-180%,0,0)}to{transform:translate3d(620%,0,0)}}'+
      '@keyframes lgrParticle{0%{opacity:0;transform:translate3d(0,0,0) scale(.2)}22%{opacity:1}100%{opacity:0;transform:translate3d(var(--x),var(--y),0) scale(1.25)}}'+
      '@supports (width:clamp(1px,2px,3px)) and (aspect-ratio:5/7){.lgr-stage{width:clamp(176px,58vw,230px);height:auto;max-height:none;aspect-ratio:5/7}.lgr-result-card{width:clamp(184px,60vw,238px);height:auto;max-height:none;aspect-ratio:5/7}}'+
      '@media(max-height:650px){.lgr-scroll{justify-content:flex-start}.lgr-kicker{margin-bottom:8px}.lgr-stage{width:42vh;height:58.8vh;max-width:190px;max-height:266px}.lgr-result-card{width:44vh;height:61.6vh;max-width:196px;max-height:274px}.lgr-meta{margin-top:7px}.lgr-desc{margin:5px auto 7px;line-height:1.35}.lgr-ok{min-height:42px}}'+
      '@supports (width:clamp(1px,2px,3px)) and (aspect-ratio:5/7){@media(max-height:650px){.lgr-stage{width:clamp(150px,42vh,190px);height:auto;max-height:none}.lgr-result-card{width:clamp(154px,44vh,196px);height:auto;max-height:none}}}'+
      '@media(prefers-reduced-motion:reduce){.lgr-stars,.lgr-nebula,.lgr-gate:before,.lgr-gate:after,.lgr-dots i,.lgr-result,.lgr-meta,.lgr-stage,.lgr-result-card:after,.lgr-particle{animation:none!important;transform:none!important}.lgr-particles{display:none}}';
    document.head.appendChild(s);
  }
  function cardBackHTML(extra){
    return '<div class="lgr-face '+extra+'"><div class="lgr-card-back" aria-hidden="true"><i class="lgr-corner lgr-c1"></i><i class="lgr-corner lgr-c2"></i><i class="lgr-corner lgr-c3"></i><i class="lgr-corner lgr-c4"></i></div></div>';
  }
  function readRevealReceipt(){var cb=CB();return cb&&typeof cb.peekPendingReveal==='function'?cb.peekPendingReveal():null;}
  function ackRevealReceipt(txid){var cb=CB();return !!(cb&&typeof cb.ackPendingReveal==='function'&&cb.ackPendingReveal(txid));}
  function setBusy(on){
    uiBusy=!!on;
    var b=document.getElementById('landGachaDrawBtn');
    if(b){b.disabled=uiBusy;b.setAttribute('aria-busy',uiBusy?'true':'false');b.style.opacity=uiBusy?'.58':'1';b.style.cursor=uiBusy?'wait':'pointer';}
  }
  // 全屏抽卡层
  function ensureScreen(){
    var el=document.getElementById('landGachaScreen');
    if(el) return el;
    el=document.createElement('div'); el.id='landGachaScreen';
    el.style.cssText='position:fixed;inset:0;z-index:9800;background:linear-gradient(160deg,#1e1b4b,#312e81 55%,#4338ca);overflow-y:auto;display:none;-webkit-overflow-scrolling:touch';
    el.innerHTML='<div style="max-width:520px;margin:0 auto;padding:14px 14px 40px">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'+
        '<button onclick="window.HansenLandGachaUI.close()" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(15,23,42,.28);color:#fff;font-size:18px;cursor:pointer">‹</button>'+
        '<div style="font-size:18px;font-weight:900;background:linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">🌏 单词大陆抽卡</div>'+
      '</div>'+
      '<div id="landGachaBody"></div></div>';
    document.body.appendChild(el);
    return el;
  }
  function render(){
    var body=document.getElementById('landGachaBody'); if(!body) return;
    var cb=CB(), g=G(); if(!cb||!g) return;
    var owned=cb.ownedCount(), total=cb.total();
    var pity=cb.getPity(); var coins=window.HansenCoins?HansenCoins.get():0;
    var toLeg=g.HARD_PITY-pity; var pityPct=Math.round(pity/g.HARD_PITY*100);
    var lr=g.legRate(pity).toFixed(1); var RI=g.RINFO; var COST=g.cost();
    var h='';
    h+='<div class="gacha-top" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<div style="font-size:13px;color:#e2e8f0">📚 已收集 <b style="color:#fbbf24">'+owned+'</b> / '+total+' 张</div>'+
        '<div style="font-size:14px;color:#fbbf24;font-weight:800">🪙 <b>'+coins+'</b></div></div>';
    // 保底进度
    h+='<div style="background:rgba(15,23,42,.55);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:11px 13px;margin-bottom:12px">'+
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1;margin-bottom:6px"><span>🌟 距「至尊卡」保底还差 <b style="color:#fbbf24">'+toLeg+'</b> 抽</span><span>至尊概率 '+lr+'%</span></div>'+
        '<div style="height:7px;background:rgba(0,0,0,.4);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pityPct+'%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:4px"></div></div>'+
        '<div style="font-size:11px;color:'+(pity>=g.SOFT_START?'#fca5a5':'#94a3b8')+';margin-top:5px">'+(pity>=g.SOFT_START?'🔥 概率飙升中！马上出至尊！':'抽得越多，越接近至尊卡')+'</div></div>';
    // 抽卡按钮
    h+='<div style="text-align:center;margin-bottom:14px"><button id="landGachaDrawBtn" '+(uiBusy?'disabled aria-busy="true"':'aria-busy="false"')+' onclick="window.HansenLandGachaUI.draw()" style="width:100%;max-width:320px;padding:15px;background:linear-gradient(135deg,#7c3aed,#4338ca);border:2px solid #a855f7;border-radius:16px;color:#fff;cursor:'+(uiBusy?'wait':'pointer')+';opacity:'+(uiBusy?'.58':'1')+';box-shadow:0 6px 18px rgba(124,58,237,.4)">'+
        '<div style="font-size:19px;font-weight:900">抽一张</div><div style="font-size:14px;color:#ddd6fe;margin-top:2px">🪙 '+COST+'</div></button></div>';
    // 概率说明
    h+='<div style="background:rgba(15,23,42,.5);border-radius:12px;padding:11px 13px;margin-bottom:12px">'+
        '<div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:7px">📊 抽中概率</div>';
    [['common','普通','55%'],['uncommon','稀有','27%'],['rare','史诗','12%'],['epic','传说','5.5%'],['legendary','至尊','0.5%（100抽必出）']].forEach(function(r){
      h+='<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:'+RI[r[0]].color+';font-weight:700">'+r[1]+'</span><span style="color:#cbd5e1">'+r[2]+'</span></div>';
    });
    h+='</div>';
    // 碎片兑换
    var frags=cb.getFrags(); var FRAG_COST={common:50,uncommon:100,rare:200,epic:400};
    h+='<div style="background:rgba(15,23,42,.5);border-radius:12px;padding:11px 13px">'+
        '<div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:5px">💠 碎片兑换</div>'+
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:8px">抽到重复的卡变碎片，攒够兑换没有的卡（至尊只能抽）。</div>';
    g.RANK.forEach(function(r){
      var ri=RI[r]; var have=frags[r]||0;
      if(r==='legendary'){
        h+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:3px 0"><span style="color:'+ri.color+';font-weight:700">'+ri.cn+'碎片</span><span style="color:#cbd5e1">'+have+' 💠</span><span style="color:#64748b">不可兑换</span></div>';
      }else{
        var cost=FRAG_COST[r]; var done=cb.ownedCountByRarity(r)>=cb.totalByRarity(r); var can=have>=cost&&!done;
        h+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:3px 0"><span style="color:'+ri.color+';font-weight:700">'+ri.cn+'碎片</span><span style="color:#cbd5e1">'+have+'/'+cost+' 💠</span>'+
           (done?'<span style="color:#86efac">已集齐</span>':'<button '+(can?'onclick="window.HansenLandGachaUI.exchange(\''+r+'\')"':'disabled')+' style="padding:3px 12px;border-radius:8px;border:none;background:'+(can?'linear-gradient(135deg,#7c3aed,#4338ca)':'#334155')+';color:'+(can?'#fff':'#64748b')+';font-size:12px;font-weight:700;cursor:'+(can?'pointer':'default')+'">兑换</button>')+'</div>';
      }
    });
    h+='</div>';
    body.innerHTML=h;
  }
  // v955 星海命轮：动画结束前，DOM 中只有完全中性的双面卡背；真实结果只在 lgrDoReveal 内创建。
  function reveal(id, result){
    var ov=null,previousFocus=null,shielded=[],rotor=null,scroll=null,hint=null,preloader=null;
    var timers=[],safetyTimer=0,revealed=false,settled=false,closed=false,hardDeadline=0;
    var rollbackListeners=function(){};
    function restoreShielded(){
      shielded.forEach(function(x){
        try{
          if(!x.node)return;
          if(x.hadAria)x.node.setAttribute('aria-hidden',x.aria);else x.node.removeAttribute('aria-hidden');
          if(x.supportsInert)x.node.inert=x.inert;
        }catch(e){}
      });
      shielded=[];
    }
    try{
    var cb=CB(), c=cb&&cb.cardById(id); if(!c||lgrActive) return false;
    var pending=readRevealReceipt();if(!pending||pending.id!==id)return false;
    result={dup:pending.dup,frag:Number(pending.frag)||0};var receiptToken=pending.txid;
    ensureRevealCSS();
    var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    ov=document.createElement('div');previousFocus=document.activeElement;
    ov.className='lgr-overlay'; ov.setAttribute('data-phase','intro'); ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','正在抽取神秘卡牌'); ov.tabIndex=-1;
    ov.innerHTML='<div class="lgr-stars" aria-hidden="true"></div><div class="lgr-nebula" aria-hidden="true"></div><div class="lgr-gate" aria-hidden="true"></div>'+
      '<div class="lgr-scroll"><div class="lgr-kicker">星海命轮 · 神秘卡牌</div><div class="lgr-stage"><div class="lgr-rotor">'+cardBackHTML('lgr-front')+cardBackHTML('lgr-rear')+'</div></div>'+
      '<div class="lgr-hint" aria-live="polite">命轮正在选择<span class="lgr-dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div>';
    rotor=ov.querySelector('.lgr-rotor');scroll=ov.querySelector('.lgr-scroll');hint=ov.querySelector('.lgr-hint');
    preloader=new Image();var imageReady=false, imageFailed=false;
    preloader.decoding='async'; try{preloader.fetchPriority='high';}catch(e){}
    preloader.onload=function(){imageReady=true;}; preloader.onerror=function(){imageFailed=true;}; preloader.src=c.img+'?v=994';
    hardDeadline=Date.now()+(reduce?1200:3900);
    function later(fn,ms){var n=setTimeout(fn,ms);timers.push(n);return n;}
    function clearAllTimers(){for(var i=0;i<timers.length;i++)clearTimeout(timers[i]);timers=[];if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=0;}}
    function raf2(fn){
      var fired=false;
      function finish(){if(fired)return;fired=true;fn();}
      // 老 WebView、后台页或省电模式可能永远不回调 rAF；96ms 计时器保证状态机仍可前进。
      later(finish,96);
      if(window.requestAnimationFrame)window.requestAnimationFrame(function(){window.requestAnimationFrame(finish);});
    }
    function shieldBackground(){
      var nodes=document.body&&document.body.children?Array.prototype.slice.call(document.body.children):[];
      nodes.forEach(function(node){
        if(node===ov)return;
        var supportsInert='inert' in node;
        shielded.push({node:node,hadAria:node.hasAttribute('aria-hidden'),aria:node.getAttribute('aria-hidden'),supportsInert:supportsInert,inert:supportsInert?node.inert:false});
        node.setAttribute('aria-hidden','true');if(supportsInert)node.inert=true;
      });
    }
    function restoreBackground(){
      restoreShielded();
    }
    function removeListeners(){
      try{document.removeEventListener('visibilitychange',lgrVisibility);}catch(e){}
      try{window.removeEventListener('pagehide',lgrPageHide);}catch(e){}
      try{window.removeEventListener('pageshow',lgrPageShow);}catch(e){}
      try{if(rotor)rotor.removeEventListener('animationend',lgrAnimationEnd);}catch(e){}
      try{document.removeEventListener('keydown',lgrKeydown);}catch(e){}
    }
    rollbackListeners=removeListeners;
    function lgrClose(){
      if(closed)return;closed=true;clearAllTimers();removeListeners();var acked=ackRevealReceipt(receiptToken);
      preloader.onload=null;preloader.onerror=null;
      if(ov.parentNode)ov.parentNode.removeChild(ov);restoreBackground();lgrActive=null;setBusy(false);render();
      var focusTarget=previousFocus&&document.documentElement.contains(previousFocus)?previousFocus:document.getElementById('landGachaDrawBtn');
      if(focusTarget&&focusTarget.focus){try{focusTarget.focus();}catch(e){}}
      if(!acked)toast('卡牌已经入册；下次进入时会再次确认本次结果');
    }
    function addParticles(rc,count){
      var f=document.createElement('div');f.className='lgr-particles';f.style.setProperty('--lgr-rc',rc);
      var coords=[[-122,-96],[118,-108],[-150,-22],[145,4],[-118,104],[126,112],[-72,-145],[70,-152],[-170,70],[168,-66],[-38,154],[44,158],[-190,-136],[188,138],[-200,4],[202,20],[-96,164],[104,-170],[-214,98],[216,-102]];
      for(var i=0;i<count;i++){var p=document.createElement('i'),xy=coords[i%coords.length];p.className='lgr-particle';p.style.setProperty('--x',xy[0]+'px');p.style.setProperty('--y',xy[1]+'px');p.style.setProperty('--d',(700+(i%5)*80)+'ms');p.style.setProperty('--delay',(i%4)*45+'ms');f.appendChild(p);}ov.appendChild(f);
      later(function(){if(f.parentNode)f.parentNode.removeChild(f);},1600);
    }
    function lgrDoReveal(){
      if(document.hidden){ov.setAttribute('data-paused','true');return;}
      if(revealed||closed)return;
      ov.classList.add('is-open');ov.setAttribute('data-phase','reveal');ov.removeAttribute('data-paused');
      var g=G(),ri=g&&g.RINFO?(g.RINFO[c.rarity]||g.RINFO.common):{cn:'卡牌',color:'#93c5fd',glow:'rgba(147,197,253,.6)'};
      var counts={common:6,uncommon:8,rare:12,epic:16,legendary:20},okButton=null,fullReveal=false;
      try{
        var resultBox=document.createElement('div');resultBox.className='lgr-result';
        var card=document.createElement('div');card.className='lgr-result-card';card.style.setProperty('--lgr-rc',ri.color);card.style.setProperty('--lgr-glow',ri.glow);
        card.innerHTML='<div class="lgr-card-inner"><div class="lgr-image-slot"></div><div class="lgr-card-copy"><div class="lgr-rarity">'+esc(c.rarity==='legendary'?'至尊':ri.cn)+'</div><div class="lgr-name" id="lgrResultTitle">'+esc(c.name)+'</div></div></div>';
        var slot=card.querySelector('.lgr-image-slot');
        function mountImage(img){
          img.className='lgr-image';img.alt=c.name;img.title=c.name;
          img.onload=function(){imageReady=true;if(slot)slot.classList.add('has-image');};
          img.onerror=function(){imageFailed=true;if(img.parentNode)img.parentNode.removeChild(img);};
          slot.appendChild(img);if(img.complete&&img.naturalWidth>0)slot.classList.add('has-image');
        }
        if(!imageFailed)mountImage(preloader);
        else{
          var retryImage=new Image();retryImage.decoding='async';mountImage(retryImage);retryImage.src=c.img+'?v=994&retry=1';
        }
        var meta=document.createElement('div');meta.className='lgr-meta';meta.style.setProperty('--lgr-rc',ri.color);
        var status=result.dup?'重复卡 · 已化为 '+(Number(result.frag)||0)+' 枚'+ri.cn+'碎片':'新卡入册 · 首次获得';
        meta.innerHTML='<div class="lgr-status" role="status" aria-live="polite">'+esc(result.dup?'💠 '+status:'🎉 '+status)+'</div><div class="lgr-desc" id="lgrResultDesc">'+esc(c.desc)+'</div><button type="button" class="lgr-ok">收下这张卡</button>';
        resultBox.appendChild(card);resultBox.appendChild(meta);scroll.innerHTML='';scroll.appendChild(resultBox);
        okButton=meta.querySelector('.lgr-ok');okButton.addEventListener('click',lgrClose);
        ov.removeAttribute('aria-label');ov.setAttribute('aria-labelledby','lgrResultTitle');ov.setAttribute('aria-describedby','lgrResultDesc');
        fullReveal=true;
      }catch(buildError){
        // 即使图片解码或复杂 DOM 在旧 WebView 失败，也显示可关闭的高对比结果，且奖励早已安全入册。
        try{
          var fallback=document.createElement('div');fallback.className='lgr-meta';fallback.style.setProperty('--lgr-rc',ri.color);
          var fallbackTitle=document.createElement('div');fallbackTitle.className='lgr-status';fallbackTitle.id='lgrResultTitle';fallbackTitle.textContent='卡牌已安全入册：'+c.name;
          var fallbackDesc=document.createElement('div');fallbackDesc.className='lgr-desc';fallbackDesc.id='lgrResultDesc';fallbackDesc.textContent=result.dup?'重复卡已化为 '+(Number(result.frag)||0)+' 枚碎片':'首次获得这张卡';
          okButton=document.createElement('button');okButton.type='button';okButton.className='lgr-ok';okButton.textContent='收下这张卡';okButton.addEventListener('click',lgrClose);
          fallback.appendChild(fallbackTitle);fallback.appendChild(fallbackDesc);fallback.appendChild(okButton);scroll.innerHTML='';scroll.appendChild(fallback);
          ov.removeAttribute('aria-label');ov.setAttribute('aria-labelledby','lgrResultTitle');ov.setAttribute('aria-describedby','lgrResultDesc');
        }catch(fallbackError){
          hardDeadline=Date.now()+500;lgrScheduleSafety();return;
        }
      }
      // 只有最终结果或可关闭兜底已真正挂到 DOM 后，才提交 revealed，避免半成品把页面永久锁死。
      revealed=true;settled=true;if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=0;}
      if(fullReveal){
        addParticles(ri.color,reduce?0:(counts[c.rarity]||6));
        try{if(window.playCorrect)window.playCorrect();}catch(e){}
        try{if(!reduce&&navigator.vibrate)navigator.vibrate([18,28,32]);}catch(e){}
      }
      later(function(){if(okButton&&okButton.focus)try{okButton.focus();}catch(e){}},120);
    }
    function lgrSettle(){
      if(settled||revealed||closed)return;settled=true;
      ov.setAttribute('data-phase','settle');hint.textContent='星门锁定 · 即将揭晓';hardDeadline=Date.now()+900;lgrScheduleSafety();later(lgrDoReveal,180);
    }
    function lgrForceComplete(){
      if(revealed||closed)return;settled=true;if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=0;}
      if(document.hidden){ov.setAttribute('data-paused','true');return;}
      ov.classList.add('is-open');ov.classList.add('lgr-no-motion');ov.setAttribute('data-phase','settle');ov.removeAttribute('data-paused');
      hint.textContent='星门锁定 · 即将揭晓';raf2(lgrDoReveal);
    }
    function lgrAnimationEnd(e){if(e.target===rotor&&e.animationName==='lgrCardSpin')lgrSettle();}
    function lgrScheduleSafety(){if(safetyTimer)clearTimeout(safetyTimer);safetyTimer=setTimeout(lgrForceComplete,Math.max(80,hardDeadline-Date.now()));}
    function lgrVisibility(){
      if(document.hidden){ov.setAttribute('data-paused','true');if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=0;}return;}
      ov.removeAttribute('data-paused');if(settled&&!revealed){raf2(lgrDoReveal);return;}if(Date.now()>=hardDeadline)lgrForceComplete();else lgrScheduleSafety();
    }
    function lgrPageHide(){ov.setAttribute('data-paused','true');if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=0;}}
    function lgrPageShow(){lgrVisibility();}
    function lgrKeydown(e){
      if(e.key==='Tab'){e.preventDefault();var target=revealed&&ov.querySelector('.lgr-ok');if(target&&target.focus)target.focus();else if(ov.focus)ov.focus();return;}
      if(e.key==='Escape'&&revealed)lgrClose();
    }
    rotor.addEventListener('animationend',lgrAnimationEnd);document.addEventListener('visibilitychange',lgrVisibility);window.addEventListener('pagehide',lgrPageHide);window.addEventListener('pageshow',lgrPageShow);document.addEventListener('keydown',lgrKeydown);
    document.body.appendChild(ov);shieldBackground();lgrActive={close:lgrClose,forceComplete:lgrForceComplete};setBusy(true);lgrScheduleSafety();
    raf2(function(){if(closed)return;ov.classList.add('is-open');ov.focus();if(reduce){ov.classList.add('lgr-no-motion');later(lgrSettle,220);}else{later(function(){if(!closed&&!revealed)ov.setAttribute('data-phase','spin');},360);}});
    return true;
    }catch(setupError){
      // 初始搭台任一步失败都必须完整回滚；待揭晓凭据保留，下次进入仍补播同一张卡且不会二次扣币。
      closed=true;
      try{for(var ti=0;ti<timers.length;ti++)clearTimeout(timers[ti]);}catch(e){}
      try{if(safetyTimer)clearTimeout(safetyTimer);}catch(e){}
      try{rollbackListeners();}catch(e){}
      try{if(preloader){preloader.onload=null;preloader.onerror=null;}}catch(e){}
      try{if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);}catch(e){}
      restoreShielded();lgrActive=null;
      try{setBusy(false);}catch(e){}
      try{render();}catch(e){}
      return false;
    }
  }
  function restoreReveal(known){
    var screen=document.getElementById('landGachaScreen');if(!screen||screen.style.display==='none'||lgrActive||uiBusy)return false;
    var x=known||readRevealReceipt();if(!x)return false;setBusy(true);
    if(reveal(x.id,x))return true;
    setBusy(false);render();return false;
  }

  window.HansenLandGachaUI = {
    open: function(){
      var pending=readRevealReceipt();uiBusy=!!pending;ensureScreen();render();document.getElementById('landGachaScreen').style.display='block';document.body.style.overflow='hidden';
      if(pending){uiBusy=false;if(!restoreReveal(pending))toast('这张卡已经入册；揭晓暂时未启动，请关闭后重新进入');}
    },
    close: function(){ if(lgrActive){toast('请先收下正在揭晓的卡牌');return;}var el=document.getElementById('landGachaScreen'); if(el)el.style.display='none'; document.body.style.overflow=''; if(window.hansenRenderCards)try{window.hansenRenderCards();}catch(e){} },
    refresh: function(){ render(); },
    draw: function(){
      var cb=CB(), g=G(), CO=window.HansenCoins;
      if(!cb||!g||!CO){ toast('抽卡系统未就绪'); return; }
      if(uiBusy||lgrActive){toast('星海命轮正在揭晓，请稍等');return;}
      var queued=readRevealReceipt();if(queued){setBusy(true);if(!reveal(queued.id,queued)){setBusy(false);render();toast('待确认卡牌揭晓暂时未启动，请关闭后重新进入');}return;}
      var cost=g.cost();
      if(CO.get()<cost){ toast('金币不够啦！多答题、打Boss赚金币吧 🪙'); return; }
      setBusy(true);
      var paid=g.purchase();
      if(paid&&paid.status==='reveal-pending'&&paid.result){if(!reveal(paid.id,paid.result))setBusy(false);return;}
      if(!paid||paid.status!=='committed'||!paid.result){setBusy(false);toast('抽卡交易尚未完成；若已扣币，重新进入会自动交付且不会重复扣款');return;}
      var id=paid.id,res=paid.result;
      try{ if(typeof checkAch==='function') checkAch(); }catch(e){}
      if(!reveal(id,res)){setBusy(false);toast('卡牌揭晓暂时未能启动，请重新进入卡册');}
    },
    exchange: function(r){
      var cb=CB(); if(!cb) return;
      if(uiBusy||lgrActive){toast('星海命轮正在揭晓，请稍等');return;}
      var queued=readRevealReceipt();if(queued){setBusy(true);if(!reveal(queued.id,queued)){setBusy(false);render();toast('待确认卡牌揭晓暂时未启动，请关闭后重新进入');}return;}
      setBusy(true);
      var id=cb.exchangeByFrag(r);
      if(!id){setBusy(false);toast('碎片不够或该档已集齐'); return; }
      if(!reveal(id,{dup:false,frag:0})){setBusy(false);toast('卡牌揭晓暂时未能启动，请重新进入卡册');}
    },
    detail: function(id){
      var cb=CB(); var c=cb.cardById(id); if(!c) return;
      var ri=cb.rinfo(c.rarity);
      var ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:24px';
      ov.onclick=function(){ ov.remove(); };
      ov.innerHTML='<div style="max-width:340px;width:100%;background:linear-gradient(160deg,#1e293b,#0f172a);border:3px solid '+c.frame+';border-radius:20px;padding:18px;text-align:center;box-shadow:0 0 40px '+ri.glow+'">'+
        '<div style="font-size:13px;font-weight:900;color:'+ri.color+';margin-bottom:8px">'+(c.rarity==='legendary'?'✨ 至尊 ✨':ri.cn)+'</div>'+
        '<div style="background:#0f172a;border-radius:12px;overflow:hidden;margin-bottom:10px"><img loading="lazy" decoding="async" src="'+c.img+'?v=994" onerror="hansenImgErr&&hansenImgErr(this)" style="width:100%;display:block"></div>'+
        '<div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:6px">'+esc(c.name)+'</div>'+
        '<div style="font-size:13px;color:#cbd5e1;line-height:1.6">'+esc(c.desc)+'</div></div>';
      document.body.appendChild(ov);
    }
  };
  // 所有岛共用同一个稳定入口：星海9页进入40张专属池，其余岛继续进入原20张正片池。
  window.HansenContextGacha = {
    open: function(){
      var page='';try{page=String((window.location&&window.location.pathname)||'');}catch(e){}
      var isStarSea=/(?:^|\/)island_(?:land[1-8]|season)\.html$/i.test(page);
      if(isStarSea&&window.HansenLandGachaUI&&typeof window.HansenLandGachaUI.open==='function')return window.HansenLandGachaUI.open();
      if(window.HansenGacha&&typeof window.HansenGacha.open==='function')return window.HansenGacha.open();
      toast('抽卡系统未就绪，请稍后再试');return false;
    }
  };
})();
