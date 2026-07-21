// hansen_gacha.js v942 — 抽卡系统(含可恢复付费交易)
// ============================================================
// 抽卡核心 + 界面 + 揭晓动画 + 保底进度条。零侵入独立文件, 各岛引用即有。
// 依赖: HansenCoins(花金币)、HansenCardbook(填卡册+保底计数)、BOSS_CARDS(卡牌数据,在hansen_cards.js)。
//
// 抽卡规则(已测准):
//   - 基础概率: 普通55 稀有27 史诗12 传说5.5 至尊0.5
//   - 至尊硬保底100抽; 软保底第80抽起概率从0.5%爬升到100%
//   - 重复卡转碎片(在 HansenCardbook.obtain 里处理)
//   - 价格 GACHA_COST(变量, 后面调)
// ============================================================
(function(){
  if(window.__hansenGachaLoaded){ return; } window.__hansenGachaLoaded = true;

  // ===== 可调参数 =====
  var GACHA_COST = 1000;       // 单抽价格(v453: 600→1000; 每日任务金币上线后进账近翻倍, 提价以保留"攒着抽"的期待感; 想更柔=800/更贵=1200, 改这一处即可)
  var HARD_PITY = 100;         // 至尊硬保底
  var SOFT_PITY_START = 80;    // 软保底起点
  var BASE = {common:55, uncommon:27, rare:12, epic:5.5, legendary:0.5};

  // 稀有度中文 + 颜色 + 揭晓光色
  var RINFO = {
    common:    {name:'普通', color:'#e2e8f0', glow:'rgba(226,232,240,.5)', cn:'普通'},
    uncommon:  {name:'稀有', color:'#60a5fa', glow:'rgba(96,165,250,.6)', cn:'稀有'},
    rare:      {name:'史诗', color:'#a78bfa', glow:'rgba(167,139,250,.7)', cn:'史诗'},
    epic:      {name:'传说', color:'#fbbf24', glow:'rgba(251,191,36,.8)', cn:'传说'},
    legendary: {name:'至尊', color:'#f472b6', glow:'rgba(244,114,182,.9)', cn:'至尊'}
  };
  var RANK = ['common','uncommon','rare','epic','legendary'];

  // 当前至尊概率(按pity)
  function legendaryRate(pity){
    var draw = pity + 1;
    if(draw >= HARD_PITY) return 100;
    if(draw < SOFT_PITY_START) return BASE.legendary;
    var t = (draw - SOFT_PITY_START) / (HARD_PITY - SOFT_PITY_START);
    return BASE.legendary + t * (100 - BASE.legendary);
  }

  // 只决定本抽结果，不改存档。付费流程必须先写交易日志、再扣款、最后一次性入册。
  function planDraw(){
    var pity = window.HansenCardbook ? HansenCardbook.getPity() : 0;
    var legRate = legendaryRate(pity);
    var r = Math.random()*100;
    var rarity, gotLeg=false;
    if(r < legRate){ rarity='legendary'; gotLeg=true; }
    else{
      var rest=['common','uncommon','rare','epic'];
      var restTotal=BASE.common+BASE.uncommon+BASE.rare+BASE.epic;
      var r2=Math.random()*restTotal, acc=0; rarity='common';
      for(var i=0;i<rest.length;i++){ acc+=BASE[rest[i]]; if(r2<acc){rarity=rest[i];break;} }
    }
    // 从该稀有度的卡里随机一张
    var range={common:[1,4],uncommon:[5,8],rare:[9,12],epic:[13,16],legendary:[17,20]}[rarity];
    var lv = range[0] + Math.floor(Math.random()*(range[1]-range[0]+1));
    return {lv:lv,rarity:rarity,gotLegendary:gotLeg};
  }
  function txId(prefix){
    var rnd='';
    try{ if(window.crypto&&crypto.getRandomValues){ var a=new Uint32Array(2);crypto.getRandomValues(a);rnd=a[0].toString(36)+a[1].toString(36); } }catch(e){}
    if(!rnd) rnd=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    return prefix+Date.now().toString(36)+'_'+rnd;
  }
  // 兼容旧测试/外部调用：免费抽一次，但 pity 与卡牌必须原子落盘。
  function drawOnce(){
    var CB=window.HansenCardbook,plan=planDraw();
    if(!CB||typeof CB.commitFreeDraw!=='function') return null;
    return CB.commitFreeDraw(txId('legacy_'),plan.lv,plan.gotLegendary)?plan.lv:null;
  }

  // 找卡牌数据(从 BOSS_CARDS)
  function cardOf(lv){
    try{
      if(window.BOSS_CARDS){ return window.BOSS_CARDS.find(function(c){return c.lv===lv;}); }
    }catch(e){}
    return {lv:lv, name:'卡牌'+lv, img:'bosses/lv'+(lv<10?'0':'')+lv+'.webp', rarity:'common'};
  }

  // 暴露抽卡核心给外部(测试/复用)
  window.HansenGacha = {
    cost: function(){ return GACHA_COST; },
    setCost: function(n){ GACHA_COST = n|0; },
    drawOnce: drawOnce,
    planDraw: planDraw,
    legendaryRate: legendaryRate,
    HARD_PITY: HARD_PITY,
    open: openGachaScreen
  };

  // ========== 抽卡界面 ==========
  function openGachaScreen(){
    ensureGachaScreen();
    renderGacha();
    if(typeof window.showScreen==='function'){ window.showScreen('gacha'); }
    else{ var s=document.getElementById('gachaScreen'); if(s){s.classList.add('active');} }
  }

  function ensureGachaScreen(){
    if(document.getElementById('gachaScreen')) return;
    injectGachaCSS();
    var screen=document.createElement('div');
    screen.className='screen';
    screen.id='gachaScreen';
    screen.innerHTML=''+
      '<button class="back-btn" onclick="showScreen(\'home\')">← 返回</button>'+
      '<div class="screen-title"><span style="-webkit-text-fill-color:initial;-webkit-background-clip:border-box;background:none;text-shadow:none">🎴</span> 抽卡寻宝</div>'+
      '<div id="gachaBody"></div>';
    (document.getElementById('app')||document.body).appendChild(screen);   // ★放进 #app(像 home/boss 等正常页面一样紧贴顶栏), 不再挂 body 之外导致顶部大空隙(#app 有 90px 底padding给导航栏, 挂在它后面就被下推)
  }

  function renderGacha(){
    var body=document.getElementById('gachaBody'); if(!body) return;
    var CB=window.HansenCardbook;
    var owned = CB?CB.ownedCount():0;
    var pity = CB?CB.getPity():0;
    var coins = window.HansenCoins?HansenCoins.get():0;
    var toLeg = HARD_PITY - pity;          // 距至尊还差几抽
    var pityPct = Math.round(pity/HARD_PITY*100);
    var legRateNow = legendaryRate(pity).toFixed(1);

    var h='';
    // 顶部: 拥有进度 + 金币
    h+='<div class="gacha-top">'+
         '<div class="gacha-owned">📚 已收集 <b>'+owned+'</b> / 20 张卡</div>'+
         '<div class="gacha-coins">🪙 <b>'+coins+'</b></div>'+
       '</div>';
    // 保底进度条(核心: 距至尊还差X抽)
    h+='<div class="gacha-pity">'+
         '<div class="gacha-pity-row"><span>🌟 距「至尊卡」保底还差 <b>'+toLeg+'</b> 抽</span><span>当前至尊概率 '+legRateNow+'%</span></div>'+
         '<div class="gacha-pity-bar"><div class="gacha-pity-fill" style="width:'+pityPct+'%"></div></div>'+
         '<div class="gacha-pity-tip">'+(pity>=SOFT_PITY_START?'🔥 概率正在飙升！马上出至尊！':'抽得越多，越接近至尊卡')+'</div>'+
       '</div>';
    // 抽卡按钮
    h+='<div class="gacha-btns">'+
         '<button class="gacha-draw-btn" onclick="window.__hsnDoDraw()">'+
           '<div class="gd-title">抽一张</div><div class="gd-cost">🪙 '+GACHA_COST+'</div>'+
         '</button>'+
       '</div>';
    // 概率说明
    h+='<div class="gacha-rates">'+
         '<div class="gr-title">📊 抽中概率</div>'+
         '<div class="gr-row"><span style="color:'+RINFO.common.color+'">普通</span><span>55%</span></div>'+
         '<div class="gr-row"><span style="color:'+RINFO.uncommon.color+'">稀有</span><span>27%</span></div>'+
         '<div class="gr-row"><span style="color:'+RINFO.rare.color+'">史诗</span><span>12%</span></div>'+
         '<div class="gr-row"><span style="color:'+RINFO.epic.color+'">传说</span><span>5.5%</span></div>'+
         '<div class="gr-row"><span style="color:'+RINFO.legendary.color+'">至尊</span><span>0.5%（100抽必出）</span></div>'+
       '</div>';
    // 碎片说明 + 兑换
    var frags = CB?CB.getFrags():{common:0,uncommon:0,rare:0,epic:0,legendary:0};
    var FRAG_COST={common:50, uncommon:100, rare:200, epic:400};
    h+='<div class="gacha-frag-box">'+
         '<div class="gr-title">💠 碎片兑换</div>'+
         '<div class="gacha-frag-tip">抽到重复的卡会变成碎片，攒够可以兑换没有的卡（至尊卡碎片不能兑换，只能抽）。</div>';
    RANK.forEach(function(r){
      var ri=RINFO[r];
      var have=frags[r]||0;
      if(r==='legendary'){
        h+='<div class="frag-row"><span style="color:'+ri.color+'">'+ri.cn+'碎片</span>'+
           '<span class="frag-have">'+have+' 💠</span>'+
           '<span class="frag-no">不可兑换</span></div>';
      }else{
        var cost=FRAG_COST[r];
        var canEx=have>=cost && CB && CB.ownedCountByRarity(r)<4;  // 够碎片且该档没集齐
        var allDone=CB && CB.ownedCountByRarity(r)>=4;
        h+='<div class="frag-row"><span style="color:'+ri.color+'">'+ri.cn+'碎片</span>'+
           '<span class="frag-have">'+have+'/'+cost+' 💠</span>'+
           (allDone?'<span class="frag-done">已集齐</span>':
             '<button class="frag-btn'+(canEx?'':' disabled')+'" '+(canEx?'onclick="window.__hsnExchange(\''+r+'\')"':'disabled')+'>兑换</button>')+
           '</div>';
      }
    });
    h+='</div>';
    body.innerHTML=h;
  }

  // 碎片兑换
  window.__hsnExchange = function(rarity){
    var CB=window.HansenCardbook; if(!CB) return;
    var lv = CB.exchangeByFrag(rarity);
    if(lv===null){ showGachaToast('碎片不够或该档已集齐'); return; }
    try{ if(typeof checkAch==='function') checkAch(); }catch(e){}
    showReveal(lv, {rarity: CB.rarityOfLv(lv), dup:false}, false);  // 兑换也走炫酷揭晓
  };

  // 执行一次抽卡
  window.__hsnDoDraw = function(){
    var CB=window.HansenCardbook, CO=window.HansenCoins;
    if(!CB || !CO || typeof CO.spend!=='function' || typeof CB.beginPaidDraw!=='function'){
      alert('抽卡系统未就绪'); return;
    }
    var old=CB.recoverPaidDraw(CO,GACHA_COST);
    if(old.status==='pending'){
      showGachaToast('上一笔抽卡正在安全恢复，请稍后重试（不会重复扣币）'); return;
    }
    if(old.status==='committed'){
      showGachaToast('上一笔已扣款抽卡已经恢复并入册 ✅');
      try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(eR){}
      return; // 本次点击只恢复旧交易；必须再次点击才会开始并扣款一笔新抽卡。
    }
    var cost=GACHA_COST;
    var before=Number(CO.get());
    if(!isFinite(before)||before < cost){
      showGachaToast('金币不够啦！多答题、打Boss赚金币吧 🪙');
      return;
    }
    var plan=planDraw(),id=txId('gacha_');
    // 先写入“将获得哪张卡”的日志；准备失败时绝不扣款。
    if(!CB.beginPaidDraw({id:id,cost:cost,beforeCoins:before,lv:plan.lv,gotLegendary:plan.gotLegendary})){
      showGachaToast('抽卡记录无法保存，本次未扣金币，请释放存储空间后重试'); return;
    }
    // 不能只相信 spend() 的布尔返回：适配器可能“报成功但没扣款”，也可能
    // “已经扣款却在回读时返回 false”。余额必须精确命中 WAL 中的 target 才能交付。
    try{ CO.spend(cost); }catch(eSpend){}
    var after=NaN;
    try{ after=Number(CO.get()); }catch(eGet){}
    if(after!==before-cost){
      if(after===before){
        CB.cancelPaidDraw(id);
        showGachaToast('金币未实际扣除，本次抽卡已取消');
      }else{
        // 余额出现第三种值时不能猜测是否扣款；保留 prepared 日志供恢复，绝不发卡或二扣。
        showGachaToast('金币余额发生非预期变化，抽卡记录已保留；本次没有发卡或再次扣款');
      }
      return;
    }
    // 只有严格回读证实扣款后才把运行期 proof 提交为 paid；stage 只是诊断字段，绝不是付款证明。
    if(typeof CB.confirmPaidDraw!=='function'||!CB.confirmPaidDraw(id,CO,cost)){
      showGachaToast('金币已扣，付款证明处于待恢复状态；本次暂不发卡，重载后会按同一交易继续');return;
    }
    CB.markPaidDrawSpent(id);
    var result=CB.finalizePaidDraw(id,CO,cost);
    if(!result){
      showGachaToast('金币已扣，卡牌已进入待恢复记录；重新打开或再次点击会自动入册，不会重复扣币');
      try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(e0){}
      return;
    }
    var lv=plan.lv;
    // 同步顶栏金币
    try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(e){}
    // 触发成就判定(集卡成就)
    try{ if(typeof checkAch==='function') checkAch(); }catch(e){}
    // 揭晓动画(花钱抽: isPaid=true, 揭晓后显示分享按钮)
    showReveal(lv, result, true);
  };

  // ========== 分享送抽卡 ==========
  // 必须先花金币抽过(揭晓后才出分享按钮)。分享成功→免费抽1次。每天最多3次。
  var SHARE_MAX_PER_DAY = 3;
  var SHARE_KEY = 'hansen_share_draw';
  function _today(){ try{ return (typeof today==='function')?today():new Date().toDateString(); }catch(e){ return new Date().toDateString(); } }
  function _shareId(day,slot){return 'share_'+String(day).replace(/[^a-z0-9]+/gi,'_').slice(0,48)+'_'+slot;}
  function readShareState(){
    try{
      var day=_today(),raw=localStorage.getItem(SHARE_KEY),o=raw?JSON.parse(raw):null;
      if(!o||o.day!==day)return {version:942,day:day,count:0,pending:null};
      var count=Math.max(0,Math.min(SHARE_MAX_PER_DAY,Math.floor(Number(o.count)||0))),p=o.pending;
      if(!p||typeof p!=='object')p=null;
      if(p){
        var slot=Math.floor(Number(p.slot)),lv=Math.floor(Number(p.lv)),expected=_shareId(day,slot);
        if(slot!==count+1||slot<1||slot>SHARE_MAX_PER_DAY||p.id!==expected||lv<1||lv>20||p.gotLegendary!==(lv>=17))p=null;
        else p={id:expected,slot:slot,lv:lv,gotLegendary:p.gotLegendary};
      }
      return {version:942,day:day,count:count,pending:p};
    }catch(e){ return {version:942,day:_today(),count:0,pending:null,unreadable:true}; }
  }
  function writeShareState(s){try{var raw=JSON.stringify(s);localStorage.setItem(SHARE_KEY,raw);return localStorage.getItem(SHARE_KEY)===raw;}catch(e){return false;}}
  function shareCountToday(){ return readShareState().count; }
  function shareLeftToday(){ return Math.max(0, SHARE_MAX_PER_DAY - shareCountToday()); }
  function canShareForDraw(){ return shareLeftToday() > 0; }
  function prepareShare(){
    var s=readShareState();if(s.unreadable||s.count>=SHARE_MAX_PER_DAY)return null;
    if(s.pending)return s.pending;
    var plan=planDraw(),slot=s.count+1;
    s.pending={id:_shareId(s.day,slot),slot:slot,lv:plan.lv,gotLegendary:plan.gotLegendary};
    return writeShareState(s)?s.pending:null;
  }
  function finishShare(){
    var s=readShareState(),p=s.pending,CB=window.HansenCardbook;
    if(!p||!CB||typeof CB.commitFreeDraw!=='function')return null;
    var result=CB.commitFreeDraw(p.id,p.lv,p.gotLegendary);if(!result)return null;
    var done={version:942,day:s.day,count:p.slot,pending:null};
    if(!writeShareState(done))return {pending:true,id:p.id,lv:p.lv,result:result};
    return {pending:false,id:p.id,lv:p.lv,result:result};
  }

  // 点"分享免费再抽"按钮
  window.__hsnShareForDraw = function(){
    if(!canShareForDraw()){ showGachaToast('今天的分享次数用完啦，明天再来～'); return; }
    // 调微信分享(由小程序壳层接 window.wxShareAppMessage 之类)。
    // 如果在微信小程序环境且壳层提供了分享方法, 调它; 分享成功后壳层会回调 window.onShareSuccess()。
    if(typeof window.wxShareForGacha !== 'function'){
      // 网页部署不能把“没有分享桥”伪装成分享成功；否则每天可白拿三抽。
      showGachaToast('当前环境未接入分享能力，本次不会占用次数或发卡');return;
    }
    if(!prepareShare()){showGachaToast('分享抽卡计划无法保存，本次不会发卡，请释放存储空间后重试');return;}
    try{ window.wxShareForGacha(); }catch(e){showGachaToast('分享能力调用失败；计划已保留，再次点击会安全重试');}
    // 真实分享: 等小程序壳层分享成功后调 window.onShareSuccess() 来发免费抽卡
  };

  // 小程序壳层"分享成功"后调这个 → 发1次免费抽卡
  window.onShareSuccess = function(){
    var paid=finishShare();if(!paid)return false;
    // 关掉当前揭晓层
    var ov=document.querySelector('.gacha-reveal-overlay'); if(ov) ov.remove();
    if(paid.pending){showGachaToast('免费卡已安全入册，分享次数正在恢复；再次回调或重载后不会重复发卡');return false;}
    try{ if(typeof updateTopBar==='function') updateTopBar(); }catch(e){}
    try{ if(typeof checkAch==='function') checkAch(); }catch(e2){}
    showReveal(paid.lv,paid.result,false);
    return true;
  };

  // 失败/取消不删除计划：用户再次点击会重试同一个槽位。这样即使“成功回调已发卡、
  // 随后又误报失败”或卡册回读短暂失败，也绝不会释放槽位后再发第二张。
  window.onShareFailure = function(){
    var s=readShareState();if(!s.pending)return true;
    showGachaToast('分享未完成；再次点击会安全重试同一个免费抽卡名额');return false;
  };

  // ========== 炫酷多阶段揭晓: 蓄力悬念 → 爆发闪光 → 卡片登场(稀有度越高越炫) ==========
  // isPaid: 是否花金币抽的(只有花钱抽的揭晓才显示"分享免费再抽1次"按钮)
  function spawnParticles(overlay, n, color){
    var box=document.createElement('div'); box.className='gr-particles';
    for(var i=0;i<n;i++){
      var p=document.createElement('div'); p.className='gr-particle';
      var ang=Math.random()*Math.PI*2, dist=130+Math.random()*230;
      p.style.setProperty('--dx',(Math.cos(ang)*dist).toFixed(0)+'px');
      p.style.setProperty('--dy',(Math.sin(ang)*dist).toFixed(0)+'px');
      p.style.background=color; p.style.boxShadow='0 0 8px '+color;
      p.style.animationDelay=(Math.random()*0.18).toFixed(2)+'s';
      box.appendChild(p);
    }
    overlay.appendChild(box);
    setTimeout(function(){ try{box.remove();}catch(e){} }, 1700);
  }
  function showReveal(lv, result, isPaid){
    var card=cardOf(lv);
    var ri=RINFO[result.rarity]||RINFO.common;
    var isLeg = result.rarity==='legendary';
    var isHigh = (result.rarity==='epic'||result.rarity==='legendary');
    var tier = {common:0,uncommon:1,rare:2,epic:3,legendary:4}[result.rarity]||0;
    // 分享区: 只在花钱抽 + 今天分享次数没满 时显示
    var shareHtml='';
    if(isPaid && canShareForDraw()){
      var left = shareLeftToday();
      shareHtml='<div class="gr-share"><button class="gr-share-btn" onclick="window.__hsnShareForDraw()">📤 分享给好友，免费再抽 1 次</button>'+
                '<div class="gr-share-tip">今天还可分享 '+left+' 次</div></div>';
    }
    var overlay=document.createElement('div');
    overlay.className='gacha-reveal-overlay tier'+tier;
    overlay.style.setProperty('--glow', ri.glow);
    overlay.style.setProperty('--rc', ri.color);
    overlay.innerHTML=''+
      '<div class="gr-flash"></div>'+
      '<div class="gr-charge"><div class="gr-ring"></div><div class="gr-orb"></div><div class="gr-hint">✨ 命运之卡即将揭晓 ✨</div></div>'+
      '<div class="gr-rays"></div>'+
      '<div class="gr-reveal"><div class="gr-card-wrap">'+
        '<div class="gr-portal"></div>'+
        '<div class="gr-spin3d">'+
          '<div class="gr-face gr-front gr-card'+(isLeg?' leg':'')+'">'+
            '<div class="gr-myst"><div class="gr-myst-q">?</div></div>'+
            '<div class="gr-real">'+
              '<div class="gr-rarity" style="color:'+ri.color+'">'+(isLeg?'✨ 至尊 ✨':ri.cn)+'</div>'+
              '<img class="gr-img" src="'+(card.img||'')+'" alt="">'+
              '<div class="gr-name" style="color:'+ri.color+'">'+(card.name||'卡牌')+'</div>'+
            '</div>'+
          '</div>'+
          '<div class="gr-face gr-back"><div class="gr-back-q">?</div></div>'+
        '</div>'+
        '<div class="gr-tail">'+
          '<div class="gr-status">'+(result.dup?
              '<span class="gr-dup">重复 → 获得 '+result.frag+' 💠'+ri.cn+'碎片</span>':
              '<span class="gr-new">✨ NEW! 新卡入册 ✨</span>')+'</div>'+
          shareHtml+
          '<button class="gr-ok" onclick="this.closest(\'.gacha-reveal-overlay\').remove();renderGachaSafe()">确定</button>'+
        '</div>'+
      '</div></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){ overlay.classList.add('show'); });
    // 蓄力音(连续轻响营造期待)
    try{ if(typeof playPop==='function'){ playPop(); setTimeout(function(){try{playPop();}catch(e){}},320); setTimeout(function(){try{playPop();}catch(e){}},640); } }catch(e){}
    var BUILD=1200;
    var FLIP=1900;            // 翻转时长(与 CSS grFlip3d 一致)
    // 阶段1(BUILD): 爆闪 + 卡【以神秘态】飞出旋转(不漏内容/稀有度)
    setTimeout(function(){
      var fl=overlay.querySelector('.gr-flash'); if(fl) fl.classList.add('go');
      var ch=overlay.querySelector('.gr-charge'); if(ch) ch.style.display='none';
      var cw=overlay.querySelector('.gr-card-wrap'); if(cw) cw.classList.add('go');
    }, BUILD);
    // 🔴 揭晓时刻(BUILD+FLIP·翻转停稳): 神秘?消失 → 真内容唰出 + 稀有度色亮起 + 光幕/粒子 + 庆祝反馈
    var grRevealed=false;
    function grDoReveal(){
      if(grRevealed) return; grRevealed=true;
      var cf=overlay.querySelector('.gr-front'); if(cf) cf.classList.add('gr-done');
      var ry=overlay.querySelector('.gr-rays'); if(ry) ry.classList.add('go');
      try{
        if(isLeg){ if(navigator.vibrate) navigator.vibrate([60,40,120,40,200]); if(typeof playLevelUp==='function')playLevelUp(); }
        else if(isHigh){ if(navigator.vibrate)navigator.vibrate([40,30,90]); if(typeof playLevelUp==='function')playLevelUp(); }
        else if(result.rarity==='rare'){ if(navigator.vibrate)navigator.vibrate(50); if(typeof playCorrect==='function')playCorrect(); }
        else { if(navigator.vibrate)navigator.vibrate(25); if(typeof playCoin==='function')playCoin(); }
      }catch(e){}
      if(tier>=3){ spawnParticles(overlay, tier>=4?30:16, ri.glow); }
    }
    setTimeout(grDoReveal, BUILD+FLIP);
    // 结果区(状态/分享/确定)登场
    var grTailShown=false;
    function grShowTail(){ if(grTailShown) return; grTailShown=true; var tl=overlay.querySelector('.gr-tail'); if(tl) tl.classList.add('go'); }
    setTimeout(grShowTail, BUILD+FLIP+420);

    // ===== 🔴 揭晓防卡死(BUG#64): 切后台→setTimeout 被节流/丢弃 → 可能卡在转圈的"?"上、或"确定"一直不出来→关不掉。 =====
    // 兜底: ①回前台后过宽限仍没揭晓/没出确定 → 强制补齐; ②一发更长的安全兜底, 无论如何最终都揭晓+出确定(永不卡死/永远关得掉)。
    var grStart=Date.now();
    function grForceComplete(){
      if(!document.body || !document.body.contains(overlay)) return;   // 已关掉
      var ch=overlay.querySelector('.gr-charge'); if(ch) ch.style.display='none';
      var cw=overlay.querySelector('.gr-card-wrap'); if(cw && !cw.classList.contains('go')) cw.classList.add('go');
      grDoReveal();      // 确保真内容+稀有度揭晓
      grShowTail();      // 确保"确定"按钮出现(永远关得掉)
    }
    function grOnForeground(){
      if(document.visibilityState==='hidden') return;
      if(!document.body || !document.body.contains(overlay)){ cleanupGrAF(); return; }
      if(grTailShown) return;                       // 已正常出确定 → 不动
      // 过宽限期(给被节流的定时器自己恢复的机会)仍没出确定 → 强制补齐
      setTimeout(function(){ if(document.body && document.body.contains(overlay) && !grTailShown) grForceComplete(); }, 1200);
    }
    var grSafetyTimer=setTimeout(function(){ if(!grTailShown) grForceComplete(); }, BUILD+FLIP+2500);  // 最长安全兜底(约5.6s)
    function cleanupGrAF(){ try{ document.removeEventListener('visibilitychange', grOnForeground); }catch(e){} try{ clearTimeout(grSafetyTimer); }catch(e){} }
    try{ document.addEventListener('visibilitychange', grOnForeground); }catch(e){}
    // 关闭时清理监听/兜底(防泄漏): 监视 overlay 被移除
    try{
      var grMo=new MutationObserver(function(){ if(!document.body.contains(overlay)){ cleanupGrAF(); grMo.disconnect(); } });
      grMo.observe(document.body,{childList:true});
    }catch(e){}
  }
  window.renderGachaSafe = function(){ try{ renderGacha(); }catch(e){} };

  function showGachaToast(msg){
    var t=document.createElement('div'); t.className='gacha-toast'; t.textContent=msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('show'); });
    setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){t.remove();},300); }, 2200);
  }

  // ========== CSS ==========
  function injectGachaCSS(){
    if(document.getElementById('hsnGachaCSS')) return;
    var css=''+
    '#gachaScreen{padding:16px;max-width:560px;margin:0 auto}'+
    '.gacha-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:15px;color:#e2e8f0}'+
    '.gacha-owned b{color:#fbbf24}.gacha-coins b{color:#fbbf24}'+
    '.gacha-pity{background:linear-gradient(135deg,#1e1b4b,#0f172a);border:1.5px solid #4c1d95;border-radius:14px;padding:14px 16px;margin-bottom:16px}'+
    '.gacha-pity-row{display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:8px}'+
    '.gacha-pity-row b{color:#f472b6;font-size:16px}'+
    '.gacha-pity-bar{height:12px;background:rgba(148,163,184,.2);border-radius:7px;overflow:hidden}'+
    '.gacha-pity-fill{height:100%;background:linear-gradient(90deg,#a78bfa,#f472b6);border-radius:7px;transition:width .5s}'+
    '.gacha-pity-tip{margin-top:8px;font-size:12px;color:#c4b5fd;text-align:center}'+
    '.gacha-btns{display:flex;justify-content:center;margin-bottom:18px}'+
    '.gacha-draw-btn{background:linear-gradient(135deg,#7c3aed,#db2777);border:none;border-radius:18px;padding:18px 50px;color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(219,39,119,.4)}'+
    '.gacha-draw-btn:active{transform:scale(.97)}'+
    '.gd-title{font-size:22px;font-weight:800}.gd-cost{font-size:15px;margin-top:4px;opacity:.95}'+
    '.gacha-rates{background:rgba(30,41,59,.5);border-radius:12px;padding:12px 16px;margin-bottom:12px}'+
    '.gr-title{font-size:14px;font-weight:800;color:#fbbf24;margin-bottom:8px}'+
    '.gr-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#cbd5e1}'+
    '.gacha-frag-tip{font-size:12px;color:#94a3b8;line-height:1.6;background:rgba(30,41,59,.3);padding:10px 14px;border-radius:10px}'+
    '.gacha-frag-tip b{color:#a78bfa}'+
    '.gacha-frag-box{background:rgba(30,41,59,.5);border-radius:12px;padding:12px 16px;margin-top:12px}'+
    '.frag-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.12);font-size:13px}'+
    '.frag-row:last-child{border-bottom:none}'+
    '.frag-have{flex:1;color:#cbd5e1;text-align:right}'+
    '.frag-btn{background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;border:none;border-radius:8px;padding:5px 16px;font-weight:700;font-size:12px;cursor:pointer}'+
    '.frag-btn.disabled{background:#475569;opacity:.5;cursor:not-allowed}'+
    '.frag-no{color:#64748b;font-size:12px;width:72px;text-align:center}'+
    '.frag-done{color:#22c55e;font-size:12px;width:72px;text-align:center;font-weight:700}'+
    /* 揭晓 - 炫酷多阶段 */
    '.gacha-reveal-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(8,8,20,.92);opacity:0;transition:opacity .3s;overflow:hidden}'+
    '.gacha-reveal-overlay.show{opacity:1}'+
    '.gr-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5}'+
    '.gr-flash.go{animation:grFlash .55s ease-out forwards}'+
    '@keyframes grFlash{0%{opacity:0}15%{opacity:.3}100%{opacity:0}}'+
    '.gr-charge{position:absolute;z-index:4;display:flex;align-items:center;justify-content:center}'+
    '.gr-orb{width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 50% 42%,#fff,#c4b5fd 40%,#7c3aed 68%,transparent 74%);box-shadow:0 0 55px 18px rgba(167,139,250,.6);animation:grOrb 1.2s ease-in forwards}'+
    '@keyframes grOrb{0%{transform:scale(.25);opacity:.4}55%{transform:scale(1);opacity:1}82%{transform:scale(1.18)}100%{transform:scale(.05);opacity:0}}'+
    '.gr-ring{position:absolute;width:152px;height:152px;border-radius:50%;border:4px solid var(--rc,#f472b6);border-top-color:transparent;border-bottom-color:transparent;opacity:.85;animation:grSpin .45s linear infinite}'+
    '@keyframes grSpin{to{transform:rotate(0deg)}}'+
    '.gr-hint{position:absolute;top:calc(50% + 100px);width:260px;text-align:center;font-size:15px;font-weight:800;color:#e9d5ff;letter-spacing:1px;text-shadow:0 0 12px rgba(167,139,250,.85);animation:grBlink .8s ease-in-out infinite}'+
    '@keyframes grBlink{0%,100%{opacity:.45}50%{opacity:1}}'+
    '.gr-rays{position:absolute;z-index:1;width:150vmax;height:150vmax;opacity:0;background:repeating-conic-gradient(from 0deg,var(--glow,rgba(255,255,255,.5)) 0deg 2.5deg,transparent 2.5deg 24deg)}'+
    '.gr-rays.go{animation:grRaysIn .5s ease-out forwards,grRaysSpin 14s linear infinite}'+
    '@keyframes grRaysIn{to{opacity:.45}}'+
    '@keyframes grRaysSpin{to{transform:rotate(0deg)}}'+
    '.gacha-reveal-overlay.tier0 .gr-rays,.gacha-reveal-overlay.tier1 .gr-rays{display:none}'+
    '.gr-reveal{position:relative;z-index:3;text-align:center}'+
    '.gr-card-wrap{position:relative;opacity:0;perspective:1100px;-webkit-perspective:1100px}'+
    '.gr-card-wrap.go{opacity:1}'+
    /* 小光圈: 卡从中飞出, 随后扩散淡出 */
    '.gr-portal{position:absolute;top:50%;left:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:3px solid #8b7fc7;box-shadow:0 0 34px 10px rgba(139,127,199,.55),inset 0 0 20px rgba(139,127,199,.55);opacity:0;pointer-events:none;z-index:1}'+
    '.gr-card-wrap.go .gr-portal{animation:grPortal 1s ease-out forwards}'+
    '@keyframes grPortal{0%{transform:scale(.2);opacity:0}22%{transform:scale(1);opacity:1}60%{transform:scale(2.6);opacity:.45}100%{transform:scale(3.4);opacity:0}}'+
    /* 3D 翻转容器: 从光圈飞出(scale 0→1) + 绕竖轴飞速翻转→减速→正面停 (rotateY·非平面rotate·不眩晕红线安全) */
    '.gr-spin3d{position:relative;width:220px;margin:0 auto;transform:scale(0);transform-style:preserve-3d;-webkit-transform-style:preserve-3d;z-index:2}'+
    '.gr-card-wrap.go .gr-spin3d{animation:grFlip3d 1.9s cubic-bezier(.16,.74,.2,1) forwards}'+
    '@keyframes grFlip3d{0%{transform:scale(.08) rotateY(0deg)}14%{transform:scale(1) rotateY(240deg)}100%{transform:scale(1) rotateY(1080deg)}}'+
    '.gr-face{backface-visibility:hidden;-webkit-backface-visibility:hidden}'+
    '.gr-back{position:absolute;inset:0;transform:rotateY(180deg);background:linear-gradient(160deg,#312e81,#1e1b4b);border:3px solid #6d5fb3;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 34px rgba(124,95,237,.5)}'+
    '.gr-back-q{font-size:84px;font-weight:900;color:#c4b5fd;text-shadow:0 0 18px rgba(167,139,250,.8)}'+
    /* 卡: 默认【神秘态】(中性紫·只显?·不漏稀有度) → 翻转停稳加 .gr-done 才变稀有度色+亮真内容 */
    '.gr-card{background:linear-gradient(160deg,#2a2550,#16142e);border:3px solid #6d5fb3;border-radius:18px;padding:18px;width:220px;margin:0 auto;position:relative;overflow:hidden;box-shadow:0 0 34px rgba(124,95,237,.5)}'+
    '.gr-card.gr-done{background:linear-gradient(160deg,#1e293b,#0f172a);border-color:var(--rc,#f472b6);box-shadow:0 0 40px var(--glow,rgba(255,255,255,.3))}'+
    '.gr-card.gr-done.leg{animation:grLegGlow 1.4s ease-in-out infinite}'+
    '@keyframes grLegGlow{0%,100%{box-shadow:0 0 30px var(--glow)}50%{box-shadow:0 0 70px var(--glow),0 0 120px var(--glow)}}'+
    '.gr-card.gr-done::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-18deg);animation:grShine 2.6s ease-in-out infinite .3s}'+
    '@keyframes grShine{0%{left:-70%}45%{left:140%}100%{left:140%}}'+
    /* 神秘?覆盖层: 旋转全程显示盖住真内容; 真内容默认隐藏, 停稳才唰出 */
    '.gr-myst{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;transition:opacity .3s}'+
    '.gr-myst-q{font-size:96px;font-weight:900;color:#c4b5fd;text-shadow:0 0 22px rgba(167,139,250,.85)}'+
    '.gr-card.gr-done .gr-myst{opacity:0;pointer-events:none}'+
    '.gr-real{position:relative;z-index:2;opacity:0}'+
    '.gr-card.gr-done .gr-real{animation:grRealIn .55s cubic-bezier(.2,1.5,.4,1) forwards}'+
    '@keyframes grRealIn{0%{opacity:0;transform:scale(.6)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}'+
    '.gr-rarity{font-size:16px;font-weight:800;margin-bottom:10px;letter-spacing:2px;position:relative;z-index:2}'+
    '.gr-img{width:170px;height:170px;object-fit:contain;border-radius:12px;position:relative;z-index:2}'+
    '.gr-name{font-size:18px;font-weight:800;margin-top:10px;position:relative;z-index:2}'+
    '.gr-tail{opacity:0}'+
    '.gr-tail.go{animation:grFadeUp .45s ease-out forwards}'+
    '@keyframes grFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}'+
    '.gr-status{margin-top:16px;font-size:15px;font-weight:700}'+
    '.gr-new{color:#fde047}.gr-dup{color:#a78bfa}'+
    '.gr-share{margin-top:16px}'+
    '.gr-share-btn{background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:800;font-size:15px;border:none;border-radius:12px;padding:11px 28px;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,.4)}'+
    '.gr-share-btn:active{transform:scale(.97)}'+
    '.gr-share-tip{margin-top:6px;font-size:12px;color:#6ee7b7}'+
    '.gr-ok{margin-top:18px;background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#3a2800;font-weight:800;font-size:16px;border:none;border-radius:12px;padding:10px 44px;cursor:pointer}'+
    '.gr-particles{position:absolute;inset:0;z-index:6;pointer-events:none;display:flex;align-items:center;justify-content:center}'+
    '.gr-particle{position:absolute;width:9px;height:9px;border-radius:50%;animation:grParticle 1.3s ease-out forwards}'+
    '@keyframes grParticle{0%{transform:translate(0,0) scale(1.3);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}'+
    '.gacha-toast{position:fixed;top:30%;left:50%;transform:translateX(-50%) translateY(-10px);background:rgba(15,23,42,.95);border:1px solid #475569;color:#fbbf24;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:700;z-index:99999;opacity:0;transition:all .3s}'+
    '.gacha-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
    var st=document.createElement('style'); st.id='hsnGachaCSS'; st.textContent=css; document.head.appendChild(st);
  }
  // ========== 自动注入抽卡入口(首页util-card区) ==========
  function injectEntry(){ /* 🔴 v594: 抽卡入口已移至游戏模式网格(火眼金睛旁, 用新joker图 gacha_joker_v594.webp, onclick=HansenGacha.open), 不再注入 util-card(Hansen: 去掉主题商店旁重复抽卡入口) */ }

  function recoverPaidDraw(silent){
    var CB=window.HansenCardbook,CO=window.HansenCoins;
    if(!CB||!CO||typeof CB.recoverPaidDraw!=='function') return {status:'unavailable'};
    var r=CB.recoverPaidDraw(CO,GACHA_COST);
    if(!silent&&r.status==='committed') showGachaToast('上次中断的抽卡已安全入册，没有重复扣币 ✅');
    if(!silent&&r.status==='pending') showGachaToast('检测到待恢复抽卡，交易记录已保留，请勿清理浏览器数据');
    try{ if(r.status==='committed'&&typeof updateTopBar==='function') updateTopBar(); }catch(e){}
    return r;
  }
  window.HansenGacha.recoverPending=recoverPaidDraw;

  // 启动: 钱包脚本位于本脚本之后，延迟到整页解析完再恢复交易。
  function startGacha(){ injectEntry(); recoverPaidDraw(false); }
  if(document.readyState==='complete'||document.readyState==='interactive'){ setTimeout(startGacha,400); }
  else{ document.addEventListener('DOMContentLoaded', function(){ setTimeout(startGacha,400); }); }
})();
