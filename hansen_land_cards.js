// hansen_land_cards.js v883 — 单词大陆 boss 卡册 + 独立抽卡池 (Hansen)
// 与正片20张卡系统【完全隔离】: 独立数据LAND_CARDS(39张·8岛)·独立存档(localStorage hansen_land_cardbook)·独立抽卡池·独立保底。
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
  var LTEMP_KEY = 'hansen_land_card_temp_unlock_until';  // 🔴v884(Hansen密码解锁): land卡临时全解锁标记(只影响显示·不污染真实owned)
  function _tempOn(){ try{ var u=parseInt(localStorage.getItem(LTEMP_KEY)||'0',10)||0; return Date.now()<u; }catch(e){ return false; } }
  function _read(){
    try{ var o=JSON.parse(localStorage.getItem(LSK)||'{}')||{}; if(!o.owned)o.owned={}; if(!o.frags)o.frags={common:0,uncommon:0,rare:0,epic:0,legendary:0}; if(typeof o.pity!=='number')o.pity=0; if(typeof o.totalDraws!=='number')o.totalDraws=0; return o; }
    catch(e){ return {owned:{},frags:{common:0,uncommon:0,rare:0,epic:0,legendary:0},pity:0,totalDraws:0}; }
  }
  function _write(o){ try{ localStorage.setItem(LSK, JSON.stringify(o)); }catch(e){} }

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
    // 获得一张卡: 已有→碎片·新卡→收入
    obtain: function(id){
      var o=_read(); var c=cardById(id); if(!c) return null; var r=c.rarity;
      if(o.owned[id]){
        var DUP={common:10,uncommon:20,rare:40,epic:80,legendary:200};
        var add=DUP[r]||10; o.frags[r]=(o.frags[r]||0)+add; _write(o);
        return {dup:true, id:id, rarity:r, frag:add};
      } else { o.owned[id]=true; _write(o); return {dup:false, id:id, rarity:r}; }
    },
    setTempUnlock: function(hours){ if(hours==null||isNaN(hours))hours=24; try{ localStorage.setItem(LTEMP_KEY, String(Date.now()+hours*3600*1000)); }catch(e){} if(window.hansenRenderCards)try{window.hansenRenderCards();}catch(e2){} },
    clearTempUnlock: function(){ try{ localStorage.removeItem(LTEMP_KEY); }catch(e){} if(window.hansenRenderCards)try{window.hansenRenderCards();}catch(e2){} },
    bumpPity: function(gotLeg){ var o=_read(); o.pity = gotLeg?0:(o.pity+1); o.totalDraws=(o.totalDraws||0)+1; _write(o); },
    // 碎片兑换(至尊不能换·与正片同规则)
    exchangeByFrag: function(rarity){
      if(rarity==='legendary') return null;
      var COST={common:50,uncommon:100,rare:200,epic:400}; var cost=COST[rarity]; if(!cost) return null;
      var o=_read(); if((o.frags[rarity]||0)<cost) return null;
      var pool=BY_RARITY[rarity]||[]; var pick=null;
      for(var i=0;i<pool.length;i++){ if(!o.owned[pool[i]]){ pick=pool[i]; break; } }
      if(pick===null) return null;
      o.frags[rarity]-=cost; o.owned[pick]=true; _write(o); return pick;
    }
  };

  // ═══ 独立抽卡池 (独立保底·共用金币钱包) ═══
  var L_COST = 1000, L_HARD_PITY = 100, L_SOFT_START = 80;
  var LBASE = {common:55, uncommon:27, rare:12, epic:5.5, legendary:0.5};
  function legRate(pity){ var d=pity+1; if(d>=L_HARD_PITY) return 100; if(d<L_SOFT_START) return LBASE.legendary; var t=(d-L_SOFT_START)/(L_HARD_PITY-L_SOFT_START); return LBASE.legendary+(100-LBASE.legendary)*t; }
  function drawOnce(){
    var CB=window.HansenLandCardbook; var pity=CB.getPity(); var lr=legRate(pity);
    var r=Math.random()*100, rarity, gotLeg=false;
    if(r<lr){ rarity='legendary'; gotLeg=true; }
    else{ var rest=['common','uncommon','rare','epic']; var rt=LBASE.common+LBASE.uncommon+LBASE.rare+LBASE.epic; var r2=Math.random()*rt,acc=0; rarity='common'; for(var i=0;i<rest.length;i++){ acc+=LBASE[rest[i]]; if(r2<acc){rarity=rest[i];break;} } }
    CB.bumpPity(gotLeg);
    var pool=BY_RARITY[rarity]||BY_RARITY.common; var id=pool[Math.floor(Math.random()*pool.length)];
    return id;
  }
  window.HansenLandGacha = { cost:function(){return L_COST;}, setCost:function(n){L_COST=n|0;}, drawOnce:drawOnce, legRate:legRate, HARD_PITY:L_HARD_PITY, SOFT_START:L_SOFT_START, BASE:LBASE, RINFO:LRINFO, RANK:LRANK };

  window.__hansenLandCardsData = { LAND_CARDS:LAND_CARDS, LRINFO:LRINFO, LRANK:LRANK, BY_RARITY:BY_RARITY };
})();

// ═══════════════════════════════════════════════════════════════
// UI: 单词大陆卡册分区(挂卡册页底部) + 抽卡界面 + 揭晓动画
// ═══════════════════════════════════════════════════════════════
(function(){
  var ISLAND_NAMES = {1:'①迷雾心湖',2:'②风纹草原',3:'③时之钟谷',4:'④铸剑锻炉山',5:'⑤晶石回廊',6:'⑥智慧藏书林',7:'⑦万邦港城',8:'⑧星火火山口'};
  function CB(){ return window.HansenLandCardbook; }
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
    h+='<div onclick="window.HansenLandGachaUI&&window.HansenLandGachaUI.open()" style="margin-top:10px;padding:12px 14px;background:linear-gradient(135deg,#7c3aed,#4338ca);border:2px solid #a855f7;border-radius:12px;text-align:center;cursor:pointer">'+
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
          h+='<div onclick="window.HansenLandGachaUI&&window.HansenLandGachaUI.detail(\''+c.id+'\')" style="cursor:pointer;border:2px solid '+c.frame+';background-color:rgba(30,41,59,.4);border-radius:9px;padding:3px;text-align:center">'+
             '<div style="background:#0f172a;border-radius:6px;overflow:hidden;aspect-ratio:1"><img src="'+c.img+'?v=904" onerror="hansenImgErr&&hansenImgErr(this)" style="width:100%;height:100%;object-fit:cover;display:block"></div>'+
             '<div style="font-size:8px;font-weight:700;color:#fff;margin-top:2px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.name.split('·').pop())+'</div></div>';
        }else{
          h+='<div style="border:2px dashed #334155;background-color:rgba(15,23,42,.4);border-radius:9px;padding:3px;text-align:center;opacity:.85">'+
             '<div style="background:#0f172a;border-radius:6px;overflow:hidden;aspect-ratio:1;position:relative;display:flex;align-items:center;justify-content:center">'+
             '<img src="'+c.img+'?v=904" onerror="hansenImgErr&&hansenImgErr(this)" style="width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) brightness(.25) blur(2px);position:absolute;inset:0">'+
             '<div style="position:relative;font-size:20px;color:#475569">🔒</div></div>'+
             '<div style="font-size:8px;font-weight:700;color:#475569;margin-top:2px">???</div></div>';
        }
      });
      h+='</div></div>';
    }
    return h;
  };
})();

// ═══ 抽卡界面 + 揭晓动画 (HansenLandGachaUI·复用正片gacha CSS类) ═══
(function(){
  function CB(){ return window.HansenLandCardbook; }
  function G(){ return window.HansenLandGacha; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toast(msg){
    var t=document.createElement('div'); t.textContent=msg;
    t.style.cssText='position:fixed;left:50%;bottom:22%;transform:translateX(-50%);background:rgba(15,23,42,.95);color:#fff;padding:11px 20px;border-radius:22px;font-size:14px;font-weight:700;z-index:100000;border:1px solid #a855f7';
    document.body.appendChild(t); setTimeout(function(){ if(t.parentNode)t.remove(); },2200);
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
    h+='<div style="text-align:center;margin-bottom:14px"><button onclick="window.HansenLandGachaUI.draw()" style="width:100%;max-width:320px;padding:15px;background:linear-gradient(135deg,#7c3aed,#4338ca);border:2px solid #a855f7;border-radius:16px;color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(124,58,237,.4)">'+
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
  // 揭晓动画(复用正片gacha-reveal CSS类)
  function reveal(id, dup){
    var cb=CB(); var c=cb.cardById(id); if(!c) return;
    var g=G(); var ri=g.RINFO[c.rarity]||g.RINFO.common;
    var isLeg=c.rarity==='legendary';
    var tier={common:0,uncommon:1,rare:2,epic:3,legendary:4}[c.rarity]||0;
    var ov=document.createElement('div');
    ov.className='gacha-reveal-overlay tier'+tier;
    ov.style.setProperty('--glow', ri.glow); ov.style.setProperty('--rc', ri.color);
    ov.innerHTML=''+
      '<div class="gr-flash"></div>'+
      '<div class="gr-charge"><div class="gr-ring"></div><div class="gr-orb"></div><div class="gr-hint">✨ 命运之卡即将揭晓 ✨</div></div>'+
      '<div class="gr-rays"></div>'+
      '<div class="gr-reveal"><div class="gr-card-wrap"><div class="gr-portal"></div><div class="gr-spin3d">'+
        '<div class="gr-face gr-front gr-card'+(isLeg?' leg':'')+'">'+
          '<div class="gr-myst"><div class="gr-myst-q">?</div></div>'+
          '<div class="gr-real"><div class="gr-rarity" style="color:'+ri.color+'">'+(isLeg?'✨ 至尊 ✨':ri.cn)+'</div>'+
          '<img class="gr-img" src="'+c.img+'?v=904" alt="" onerror="hansenImgErr&&hansenImgErr(this)">'+
          '<div class="gr-name" style="color:'+ri.color+'">'+esc(c.name)+'</div></div>'+
        '</div><div class="gr-face gr-back"></div>'+
      '</div></div>'+
      '<div class="gr-info">'+(dup?'<div class="gr-dup">重复 · 已转化为 '+ri.cn+'碎片 💠</div>':'<div class="gr-new" style="color:'+ri.color+'">🎉 新卡入册！</div>')+
        '<div class="gr-desc">'+esc(c.desc)+'</div>'+
        '<button class="gr-ok" onclick="this.closest(&quot;.gacha-reveal-overlay&quot;).remove();window.HansenLandGachaUI.refresh()">收下</button>'+
      '</div></div>';
    document.body.appendChild(ov);
    try{ if(window.playCorrect) window.playCorrect(); }catch(e){}
  }

  window.HansenLandGachaUI = {
    open: function(){ ensureScreen(); render(); document.getElementById('landGachaScreen').style.display='block'; document.body.style.overflow='hidden'; },
    close: function(){ var el=document.getElementById('landGachaScreen'); if(el)el.style.display='none'; document.body.style.overflow=''; if(window.hansenRenderCards)try{window.hansenRenderCards();}catch(e){} },
    refresh: function(){ render(); },
    draw: function(){
      var cb=CB(), g=G(), CO=window.HansenCoins;
      if(!cb||!g||!CO){ toast('抽卡系统未就绪'); return; }
      var cost=g.cost();
      if(CO.get()<cost){ toast('金币不够啦！多答题、打Boss赚金币吧 🪙'); return; }
      CO.spend ? CO.spend(cost) : CO.add(-cost);  // 与正片gacha一致口径
      var id=g.drawOnce(); var res=cb.obtain(id);
      try{ if(typeof checkAch==='function') checkAch(); }catch(e){}
      reveal(id, res.dup);
    },
    exchange: function(r){
      var cb=CB(); if(!cb) return;
      var id=cb.exchangeByFrag(r);
      if(!id){ toast('碎片不够或该档已集齐'); return; }
      reveal(id, false);
    },
    detail: function(id){
      var cb=CB(); var c=cb.cardById(id); if(!c) return;
      var ri=cb.rinfo(c.rarity);
      var ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:24px';
      ov.onclick=function(){ ov.remove(); };
      ov.innerHTML='<div style="max-width:340px;width:100%;background:linear-gradient(160deg,#1e293b,#0f172a);border:3px solid '+c.frame+';border-radius:20px;padding:18px;text-align:center;box-shadow:0 0 40px '+ri.glow+'">'+
        '<div style="font-size:13px;font-weight:900;color:'+ri.color+';margin-bottom:8px">'+(c.rarity==='legendary'?'✨ 至尊 ✨':ri.cn)+'</div>'+
        '<div style="background:#0f172a;border-radius:12px;overflow:hidden;margin-bottom:10px"><img src="'+c.img+'?v=904" onerror="hansenImgErr&&hansenImgErr(this)" style="width:100%;display:block"></div>'+
        '<div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:6px">'+esc(c.name)+'</div>'+
        '<div style="font-size:13px;color:#cbd5e1;line-height:1.6">'+esc(c.desc)+'</div></div>';
      document.body.appendChild(ov);
    }
  };
})();
