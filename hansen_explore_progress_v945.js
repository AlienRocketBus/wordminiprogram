// hansen_explore_progress_v945.js — v946 探索单词「拼写才能成长」双进度导航
// =============================================================================
// 只读展示分别以 HansenCanonical / HansenCrystal / HansenGems 的权威账本为准：
//   🐾 宠物掌握：只有打字大师中无提示、整词精确拼写才可以推进 mc。
//   💎 知识结晶：只有聚焦 Spelling Bee 按机器人速度达成 10/7/5 次才锁 1 星；
//      同词同日最多结算一次（普通 1 星，记忆强化 2 星），5 星后仍必须由账本证明 4 钻已到账。
// S.learned 只表示“玩家点过我认识了”，绝不冒充上述两种正式进度。
// 共享模块只负责路由到现有游戏，不再自建选择题。瞬时单次证明不落 localStorage，
// 并且会把 pet/crystal 两条写入通道严格隔离。
// =============================================================================
(function(root){
  'use strict';
  if(!root||root.__hansenExploreProgressV946)return;
  root.__hansenExploreProgressV946=true;

  var FILTERS={all:1,pet:1,crystal:1,done:1};
  var state={filter:'all',snapshot:null,lastTrigger:null,lastTriggerIndex:-1,modalIndex:-1,raf:0,returnFocusPending:false};
  var activeProof=null;

  function beeRequired(cpm){cpm=Math.max(1,Math.floor(Number(cpm)||0));return cpm>=80?5:(cpm>=50?7:10);}
  function validateProof(channel,idx,meta){
    idx=Number(idx);meta=meta&&typeof meta==='object'?meta:{};
    if((channel!=='pet'&&channel!=='crystal')||!isFinite(idx)||Math.floor(idx)!==idx||idx<0||idx>=list().length)return {ok:false,reason:'invalid-target'};
    if(channel==='pet'){
      if(meta.mode!=='typing-master'||meta.complete!==true||meta.exact!==true||meta.noHint!==true)return {ok:false,reason:'typing-proof-required'};
      return {ok:true,index:idx,meta:meta};
    }
    var cpm=Math.floor(Number(meta.cpm!==undefined?meta.cpm:meta.botCpm)),required=beeRequired(cpm),wins=Math.floor(Number(meta.wins!==undefined?meta.wins:meta.correct));
    if(meta.mode!=='spelling-bee'||(meta.focused!==true&&meta.focus!==true)||meta.complete!==true||meta.exact!==true||!isFinite(cpm)||cpm<1||
       Number(meta.required)!==required||!isFinite(wins)||wins<required)return {ok:false,reason:'bee-proof-required'};
    return {ok:true,index:idx,meta:meta};
  }
  function runProof(channel,idx,meta,fn){
    if(activeProof)return {ok:false,consumed:false,reason:'proof-busy'};
    var checked=validateProof(channel,idx,meta);if(!checked.ok)return {ok:false,consumed:false,reason:checked.reason};
    if(typeof fn!=='function')return {ok:false,consumed:false,reason:'callback-required'};
    var proof={channel:channel,index:checked.index,meta:checked.meta,remaining:1,consumed:false,result:null};
    activeProof=proof;
    try{
      var value=fn();
      var settled=!!(proof.result&&proof.result.ok===true),ok=proof.consumed===true&&settled;
      return {ok:ok,consumed:proof.consumed===true,value:value,result:proof.result,reason:ok?'':(!proof.consumed?'proof-not-consumed':((proof.result&&proof.result.reason)||'progress-not-settled'))};
    }catch(e){return {ok:false,consumed:proof.consumed===true,result:proof.result,reason:'callback-failed'};}
    finally{activeProof=null;}
  }
  function consumeProof(channel,idx){
    idx=Number(idx);
    if(!activeProof||activeProof.remaining!==1||activeProof.channel!==channel||activeProof.index!==idx)return null;
    activeProof.remaining=0;activeProof.consumed=true;return activeProof;
  }
  function settleProof(proof,result){if(!proof||proof!==activeProof||proof.consumed!==true)return false;proof.result=result||null;return true;}
  function allowsLaunch(channel,idx){
    idx=Number(idx);if((channel!=='pet'&&channel!=='crystal')||!isFinite(idx)||Math.floor(idx)!==idx)return false;
    var snap=buildSnapshot(),item=itemAt(idx,snap);if(!item)return false;
    if(channel==='pet')return !!(item.masteryReadable&&!item.mastered);
    return !!(item.crystalReadable&&!item.done&&!item.lockedToday);
  }

  root.HansenSpellingProgressV946={
    run:runProof,commit:runProof,consume:consumeProof,settle:settleProof,allows:allowsLaunch,requiredForBee:beeRequired,
    active:function(){return activeProof?{channel:activeProof.channel,index:activeProof.index,meta:activeProof.meta}:null;}
  };

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  /*
   * v946 rendering hotfix: word.emoji is a mixed icon field.  Most entries are
   * Unicode emoji, while app-owned entries are already-rendered <span><svg> or
   * <span><img> illustrations.  Never concatenate that field into textContent
   * (it exposes markup as a giant block of text), and never parse it a second time
   * with innerHTML.  The Explore cards have already rendered the canonical icon,
   * so recommendation chips reuse a detached clone of that DOM.  If the source
   * card is unavailable or malformed, fail closed to a harmless book glyph.
   */
  function recommendationIcon(button,item){
    var wrap=document.createElement('span');wrap.className='hxp-rec-icon';wrap.setAttribute('aria-hidden','true');
    var raw=item&&item.word?String(item.word.emoji||''):'';
    var source=null;
    try{source=document.querySelector('#exploreContent .exp-card[data-hxp-index="'+String(item.index)+'"] .emoji');}catch(e){source=null;}
    if(source&&source.childNodes&&source.childNodes.length){
      var expectsMarkup=raw.indexOf('<')>=0,hasMedia=!!(source.querySelector&&source.querySelector('svg,img'));
      if(!expectsMarkup||hasMedia){Array.prototype.forEach.call(source.childNodes,function(node){wrap.appendChild(node.cloneNode(true));});}
    }
    if(!wrap.childNodes.length)wrap.textContent=raw&&raw.indexOf('<')<0?raw:'📘';
    button.appendChild(wrap);return wrap;
  }
  function clamp(n,min,max){n=Number(n);return isFinite(n)?Math.max(min,Math.min(max,n)):min;}
  function list(){try{return Array.isArray(root.allW)?root.allW:[];}catch(e){return [];}}
  function currentRef(){try{return root.HansenCanonical&&HansenCanonical.currentRef?HansenCanonical.currentRef():(root.location&&root.location.pathname)||'';}catch(e){return '';}}
  function byLocal(snapshot){var out={};(snapshot&&snapshot.items||[]).forEach(function(item){out[item.localIndex]=item;});return out;}

  function buildSnapshot(){
    var words=list(),ref=currentRef(),pet=null,canonical=null,crystal=null;
    // 宠物快照会先把当前岛的内存进度吸收到 canonical；随后再读卡片，保证同一帧一致。
    try{pet=root.HsnPet&&typeof HsnPet.progressSnapshot==='function'?HsnPet.progressSnapshot():null;}catch(e){pet=null;}
    try{canonical=root.HansenCanonical&&typeof HansenCanonical.sliceSnapshot==='function'?HansenCanonical.sliceSnapshot(ref):null;}catch(e){canonical=null;}
    try{crystal=root.HansenCrystal&&typeof HansenCrystal.sliceProgress==='function'?HansenCrystal.sliceProgress(ref):null;}catch(e){crystal=null;}
    var cm=byLocal(canonical),xm=byLocal(crystal),masterHits=(canonical&&canonical.masterHits)||3;
    var rules=(crystal&&crystal.rules)||(root.HansenCrystal&&HansenCrystal.getRules&&HansenCrystal.getRules())||{maxLevel:5,hitsPerStar:2,gemsPerWord:4,boostStarGain:2,dailyStarLocks:1};
    var items=[];
    for(var i=0;i<words.length;i++){
      var c=cm[i],x=xm[i],seen=false;
      try{seen=!!(root.S&&Array.isArray(S.learned)&&S.learned.indexOf(i)>=0);}catch(e){}
      if(canonical&&canonical.ok&&c)seen=!!c.learned;
      var masteryReadable=!!(canonical&&canonical.ok&&c),crystalReadable=!!(crystal&&crystal.ok&&x);
      var mc=masteryReadable?Math.max(0,Math.floor(Number(c.mastery)||0)):null;
      var lv=crystalReadable?Math.floor(Number(x.lv)||0):null,p=crystalReadable?Math.floor(Number(x.p)||0):null;
      items.push({
        index:i,word:words[i],seen:seen,
        masteryReadable:masteryReadable,mastery:mc,mastered:masteryReadable&&mc>=masterHits,masterHits:masterHits,
        crystalReadable:crystalReadable,lv:lv,p:p,done:crystalReadable&&!!x.done,lockedToday:crystalReadable&&!!x.lockedToday,
        boosted:crystalReadable&&!!x.boosted,boostMinutes:crystalReadable?x.boostMinutes:0,
        reward:crystalReadable&&x.reward?x.reward:{state:'blocked',amount:null,at:null},
        slotId:(c&&c.slotId)||(x&&x.slotId)||'',canonicalIndex:(c&&c.canonicalIndex)!==undefined?c.canonicalIndex:(x&&x.canonicalIndex)
      });
    }
    return {at:Date.now(),ref:ref,words:words,items:items,canonical:canonical,crystal:crystal,pet:pet,rules:rules};
  }

  function itemAt(idx,snap){snap=snap||state.snapshot;idx=Math.floor(Number(idx));return snap&&idx>=0&&idx<snap.items.length?snap.items[idx]:null;}
  function rememberTrigger(el,idx){state.lastTrigger=el||null;idx=Math.floor(Number(idx));if(isFinite(idx)&&idx>=0)state.lastTriggerIndex=idx;}
  function focusReturnTarget(){
    if(state.lastTrigger&&document.contains(state.lastTrigger))return state.lastTrigger;
    if(state.lastTriggerIndex>=0)return document.querySelector('#exploreContent .exp-card[data-hxp-index="'+state.lastTriggerIndex+'"]');
    return null;
  }
  function restoreFocusSoon(){
    state.returnFocusPending=true;
    function attempt(){
      var explore=document.getElementById('exploreScreen');if(explore&&!explore.classList.contains('active'))return;
      if(document.getElementById('hsnSbOverlay'))return;
      var wordModal=document.getElementById('wordModal');if(wordModal&&wordModal.classList.contains('show'))return;
      var target=focusReturnTarget();if(target&&document.contains(target)){try{target.focus();}catch(e){}if(document.activeElement===target)state.returnFocusPending=false;}
    }
    setTimeout(attempt,0);
    var raf=root.requestAnimationFrame||function(fn){return setTimeout(fn,16);};raf(function(){raf(attempt);});
    /* 🔴v1066：原来只在 0ms 与两帧后各试一次，窗口约 32ms——
       之后若发生一次重渲染，卡片节点被换掉，焦点就此丢失且不再重试。
       补几次延迟重试；attempt() 成功后会把 returnFocusPending 置 false，
       所以这几次几乎总是空转，代价可忽略。 */

  }
  function paid(item){return !!(item&&item.done&&item.reward&&item.reward.state==='paid');}
  function rewardState(item){return item&&item.reward?String(item.reward.state||'blocked'):'blocked';}
  function crystalScore(item,snap){if(!item||!item.crystalReadable)return -1;return item.lv*(snap.rules.hitsPerStar||2)+item.p;}
  function matches(item,filter){
    if(filter==='pet')return item.masteryReadable&&!item.mastered;
    if(filter==='crystal')return item.crystalReadable&&!item.done&&(item.lv>0||item.p>0);
    if(filter==='done')return item.crystalReadable&&item.done;
    return true;
  }

  function petCandidates(snap){
    return snap.items.filter(function(item){return item.masteryReadable&&!item.mastered;}).sort(function(a,b){
      var d=b.mastery-a.mastery;if(d)return d;
      d=crystalScore(b,snap)-crystalScore(a,snap);return d||a.index-b.index;
    });
  }
  function crystalCandidates(snap){
    return snap.items.filter(function(item){return item.crystalReadable&&!item.done;}).sort(function(a,b){
      var d=crystalScore(b,snap)-crystalScore(a,snap);if(d)return d;
      if(a.masteryReadable&&b.masteryReadable&&a.mastery!==b.mastery)return b.mastery-a.mastery;
      return a.index-b.index;
    });
  }

  function injectCSS(){
    if(!root.document||document.getElementById('hxp-v946-css'))return;
    var st=document.createElement('style');st.id='hxp-v946-css';st.textContent=[
      '#exploreScreen{padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}',
      '#exploreScreen .exp-card{min-width:0;min-height:122px;padding:8px 6px 10px;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;justify-content:center}',
      '#exploreScreen .exp-card.learned{border-color:rgba(34,197,94,.55);background:linear-gradient(135deg,var(--pal-surf-2,#1e293b),rgba(34,197,94,.16))}',
      '#exploreScreen .exp-card.learned::after{content:none!important;display:none!important}',
      '#exploreScreen .exp-card .word,#exploreScreen .exp-card .cn{max-width:100%;overflow-wrap:anywhere}',
      '.hxp-badges{width:100%;display:flex;justify-content:space-between;align-items:center;gap:4px;margin:0 0 5px;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1}',
      '.hxp-badge{display:inline-flex;align-items:center;justify-content:center;min-width:47px;padding:4px 5px;border-radius:999px;border:1px solid rgba(148,163,184,.38);background:rgba(15,23,42,.62);color:#cbd5e1;white-space:nowrap;text-shadow:none}',
      '.hxp-badge.paw.done{color:#052e16;background:#86efac;border-color:#22c55e}',
      '.hxp-badge.gem.progress{color:#e0f2fe;border-color:#38bdf8;background:rgba(3,105,161,.55)}',
      '.hxp-badge.gem.paid{color:#082f49;background:#7dd3fc;border-color:#0ea5e9;box-shadow:0 0 0 2px rgba(125,211,252,.22)}',
      '.hxp-badge.gem.pending{color:#422006;background:#fde68a;border-color:#f59e0b}',
      '.hxp-badge.gem.legacy{color:#3b0764;background:#e9d5ff;border-color:#a855f7}',
      '.hxp-badge.blocked{color:#fecaca;border-color:#ef4444;background:rgba(127,29,29,.7)}',
      '.hxp-seen-mark{position:absolute;left:6px;bottom:5px;font-size:9px;font-weight:800;color:#14532d;background:#bbf7d0;border:1px solid #4ade80;border-radius:999px;padding:2px 5px}',
      '.hxp-overview{margin:0 0 14px;padding:14px;border-radius:18px;border:1px solid rgba(var(--pal-line-rgb,99,102,241),.42);background:linear-gradient(145deg,rgba(var(--pal-line-rgb,99,102,241),.14),rgba(15,23,42,.08));color:var(--pal-ink,#e2e8f0)}',
      '.hxp-overview h2{font-size:17px;margin:0 0 5px;color:var(--pal-ink,#fff)}',
      '.hxp-legend{font-size:12px;line-height:1.65;color:var(--pal-ink-2,#cbd5e1)}',
      '.hxp-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:11px 0}',
      '.hxp-summary-card{border-radius:13px;padding:10px 9px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.3);min-width:0}',
      '.hxp-summary-card b{display:block;font-size:14px;color:#fff;margin-bottom:3px}',
      '.hxp-summary-card span{font-size:11.5px;line-height:1.5;color:#cbd5e1}',
      '.hxp-next{font-size:12px;line-height:1.65;padding:9px 10px;border-radius:11px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.42);color:var(--pal-ink,#fef3c7)}',
      '.hxp-recommend{margin-top:10px}',
      '.hxp-recommend strong{display:block;font-size:12px;color:var(--pal-ink,#fff);margin-bottom:6px}',
      '.hxp-rec-list{display:flex;gap:6px;flex-wrap:wrap}',
      '.hxp-rec{min-height:36px;border-radius:10px;border:1px solid rgba(251,191,36,.5);background:rgba(120,53,15,.32);color:var(--pal-ink,#fff);font:inherit;font-size:11.5px;font-weight:800;padding:7px 9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;max-width:100%}',
      '.hxp-rec-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 20px;width:20px;height:20px;font-size:18px;line-height:1;overflow:hidden}',
      '.hxp-rec-icon>span,.hxp-rec-icon svg{display:block;width:20px!important;height:20px!important;max-width:20px;max-height:20px}',
      '.hxp-rec-label{min-width:0;overflow-wrap:anywhere}',
      '.hxp-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:12px}',
      '.hxp-filter{min-height:44px;border-radius:11px;border:1px solid rgba(148,163,184,.42);background:rgba(15,23,42,.55);color:#e2e8f0;font:inherit;font-size:11px;font-weight:800;padding:5px;cursor:pointer}',
      '.hxp-filter[aria-pressed="true"]{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-color:#c4b5fd;color:#fff}',
      '.hxp-filter-status{min-height:18px;margin-top:7px;font-size:11.5px;color:var(--pal-ink-2,#cbd5e1)}',
      '.hxp-empty{display:none;text-align:center;padding:24px 10px;color:var(--pal-ink-2,#cbd5e1);font-size:13px}',
      '.hxp-empty.show{display:block}',
      '.hxp-progress{margin:14px 0 2px;text-align:left;border-top:1px solid rgba(148,163,184,.28);padding-top:12px}',
      '.hxp-progress h3{font-size:15px;color:var(--pal-ink,#fff);margin:0 0 9px}',
      '.hxp-prow{padding:10px;border-radius:12px;background:rgba(15,23,42,.52);border:1px solid rgba(148,163,184,.28);margin:7px 0;color:#e2e8f0}',
      '.hxp-ptop{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:800}',
      '.hxp-pmeta{font-size:11.5px;line-height:1.55;color:#cbd5e1;margin-top:5px}',
      '.hxp-track{height:9px;border-radius:999px;overflow:hidden;background:#0f172a;border:1px solid #475569;margin-top:7px}',
      '.hxp-track>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#22c55e,#86efac)}',
      '.hxp-prow.gem .hxp-track>i{background:linear-gradient(90deg,#38bdf8,#a78bfa)}',
      '.hxp-stars{letter-spacing:2px;color:#fbbf24;font-size:15px}',
      '.hxp-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}',
      '.hxp-action{min-height:44px;border:none;border-radius:11px;padding:8px 9px;font:inherit;font-size:12px;font-weight:900;color:#fff;background:linear-gradient(135deg,#16a34a,#15803d);cursor:pointer}',
      '.hxp-action.gem{background:linear-gradient(135deg,#0284c7,#7c3aed)}',
      '.hxp-action.retry{grid-column:1/-1;background:linear-gradient(135deg,#d97706,#b45309)}',
      'html.hsn-pal-light .hxp-summary-card{background:linear-gradient(135deg,#fff,var(--pal-surf-2,#eef2f8));border-color:rgba(var(--pal-line-rgb,99,102,241),.28)}',
      'html.hsn-pal-light .hxp-summary-card b{color:var(--pal-ink,#1c2942)}',
      'html.hsn-pal-light .hxp-summary-card span{color:var(--pal-ink-2,#475569)}',
      'html.hsn-pal-light .hxp-prow{background:linear-gradient(135deg,#fff,var(--pal-surf-2,#eef2f8));border-color:rgba(var(--pal-line-rgb,99,102,241),.28);color:var(--pal-ink,#1c2942)}',
      'html.hsn-pal-light .hxp-pmeta{color:var(--pal-ink-2,#475569)}',
      'html.hsn-pal-light .hxp-action.gem{color:#fff;background:linear-gradient(135deg,#0369a1,#6d28d9);border:1px solid #312e81}',
      '#wordModal{padding:10px}',
      '#wordModal .modal{max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow:hidden;display:flex;flex-direction:column}',
      '.hxp-modal-scroll{min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:2px 2px calc(8px + env(safe-area-inset-bottom,0px))}',
      'html.hxp-modal-open,html.hxp-modal-open body{overflow:hidden!important}',
      '.hxp-action[disabled]{cursor:not-allowed;filter:grayscale(.45);opacity:.72;background:linear-gradient(135deg,#475569,#334155)}',
      '.hxp-filter:focus-visible,.hxp-rec:focus-visible,.hxp-action:focus-visible,.exp-card:focus-visible{outline:3px solid #fde047!important;outline-offset:2px}',
      '@media(max-width:480px){#exploreScreen .explore-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hxp-filters{grid-template-columns:1fr 1fr}.hxp-summary{grid-template-columns:1fr}.hxp-actions{grid-template-columns:1fr}.hxp-action.retry{grid-column:auto}}',
      '@media(prefers-reduced-motion:reduce){#wordModal .modal,#exploreScreen .exp-card{animation:none!important;transition:none!important}}'
    ].join('\n');
    (document.head||document.documentElement).appendChild(st);
  }

  function badgeInfo(item){
    var paw={text:'🐾 —',cls:'paw blocked',title:'宠物掌握状态暂不可读'};
    if(item.masteryReadable){var n=Math.min(item.masterHits,item.mastery);paw={text:'🐾 '+n+'/'+item.masterHits,cls:'paw'+(item.mastered?' done':''),title:item.mastered?'已计入宠物升级':'还需在打字大师精确拼对 '+(item.masterHits-n)+' 次'};}
    var gem={text:'💎 —',cls:'gem blocked',title:'知识结晶状态暂不可读'};
    if(item.crystalReadable){
      var rs=rewardState(item),gcls='gem';
      if(item.done&&rs==='paid')gcls+=' paid';
      else if(item.done&&rs==='legacy')gcls+=' legacy';
      else if(item.done)gcls+=(rs==='blocked'||rs==='mismatch'||rs==='invalid')?' blocked':' pending';
      else if(item.lv>0||item.p>0)gcls+=' progress';
      gem={text:'💎 '+item.lv+'/5',cls:gcls,title:item.done?(rs==='paid'?'知识结晶完成，4 钻已到账':rs==='legacy'?'历史结晶已登记':'知识结晶完成，奖励待安全核对'):'知识结晶 '+item.lv+'/5 星'};
    }
    return {paw:paw,gem:gem};
  }

  function makeOverview(snap){
    var sec=document.createElement('section');sec.className='hxp-overview';sec.setAttribute('aria-label','学习进度导航');
    var localMaster=snap.items.filter(function(i){return i.mastered;}).length;
    var localPaid=snap.items.filter(paid).length;
    var cReadable=!!(snap.canonical&&snap.canonical.ok),xReadable=!!(snap.crystal&&snap.crystal.ok),pet=snap.pet;
    sec.innerHTML='<h2>🐾 宠物掌握 · 💎 知识结晶</h2>'+
      '<div class="hxp-legend"><b>已认识</b>只是加入学习，不发宠物掌握或结晶。🐾 只认<b>打字大师的整词拼写</b>；💎 只认<b>聚焦 Spelling Bee</b>，每词每天最结算一次（普通1星、强化2星）。</div>'+
      '<div class="hxp-summary">'+
        '<div class="hxp-summary-card"><b>🐾 本岛 '+(cReadable?(localMaster+' / '+snap.items.length):'状态暂不可读')+'</b><span>每词在打字大师无提示精确拼对 3 次；计数升级后保留。</span></div>'+
        '<div class="hxp-summary-card"><b>💎 已到账 '+(xReadable?(localPaid+' / '+snap.items.length):'状态暂不可读')+'</b><span>Bee 机器人 &lt;50 CPM 需10次、50~79 需7次、≥80 需5次；达标普通锁1星、强化锁2星，5星得 4 钻。</span></div>'+
      '</div>';
    var next=document.createElement('div');next.className='hxp-next';
    if(pet&&pet.ok){
      next.innerHTML=pet.maxed?'🏆 宠物已达到第 '+pet.stageNumber+' / '+pet.totalStages+' 阶终焉形态。':'下一阶「'+esc(pet.nextStageName)+'」需要同时满足：⚡经验 <b>'+pet.xp+' / '+pet.nextXpReq+'</b>（还差 '+pet.remainingXP+'）· 🐾掌握 <b>'+pet.mastered+' / '+pet.nextMasterReq+'</b>（还差 '+pet.remainingWords+' 个词）。';
    }else next.textContent='宠物升级总进度暂不可读；单词卡不会把未知状态显示成 0。';
    sec.appendChild(next);

    var rec=document.createElement('div');rec.className='hxp-recommend';
    var candidates=petCandidates(snap),limit=6;
    if(pet&&pet.ok&&!pet.maxed)limit=Math.max(1,Math.min(6,pet.remainingWords||6));
    var strong=document.createElement('strong');
    strong.textContent=(pet&&pet.ok&&pet.remainingWords===0)?'✅ 宠物单词门槛已经够了，现在主要补经验。':'🚀 最快宠物升级单词（优先 2/3 → 1/3 → 0/3）';
    rec.appendChild(strong);
    var recList=document.createElement('div');recList.className='hxp-rec-list';
    candidates.slice(0,limit).forEach(function(item){
      var b=document.createElement('button');b.type='button';b.className='hxp-rec';b.setAttribute('data-hxp-open',String(item.index));
      b.setAttribute('aria-label',String(item.word.en||'')+'，宠物掌握 '+item.mastery+' / '+item.masterHits+'，打开单词详情');
      recommendationIcon(b,item);
      var label=document.createElement('span');label.className='hxp-rec-label';label.textContent=String(item.word.en||'')+' · 🐾'+item.mastery+'/'+item.masterHits;b.appendChild(label);
      recList.appendChild(b);
    });
    if(!candidates.length){var empty=document.createElement('span');empty.style.cssText='font-size:11.5px;color:var(--pal-ink-2,#cbd5e1)';empty.textContent=cReadable?'本岛所有词都已达到宠物掌握门槛。':'状态恢复后会在这里列出准确单词。';recList.appendChild(empty);}
    rec.appendChild(recList);sec.appendChild(rec);

    var filters=document.createElement('div');filters.className='hxp-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','筛选单词');
    var defs=[['all','全部',snap.items.length],['pet','🐾 宠物冲刺',snap.items.filter(function(i){return matches(i,'pet');}).length],['crystal','💎 结晶中',snap.items.filter(function(i){return matches(i,'crystal');}).length],['done','💎 5星结晶',snap.items.filter(function(i){return matches(i,'done');}).length]];
    defs.forEach(function(d){var b=document.createElement('button');b.type='button';b.className='hxp-filter';b.setAttribute('data-filter',d[0]);b.setAttribute('aria-pressed',state.filter===d[0]?'true':'false');b.textContent=d[1]+' '+d[2];filters.appendChild(b);});
    sec.appendChild(filters);
    var live=document.createElement('div');live.className='hxp-filter-status';live.setAttribute('aria-live','polite');sec.appendChild(live);
    return sec;
  }

  function applyFilter(content,snap){
    var shown=0;
    content.querySelectorAll('.exp-card[data-hxp-index]').forEach(function(card){
      var item=itemAt(card.getAttribute('data-hxp-index'),snap),on=!!(item&&matches(item,state.filter));
      card.hidden=!on;if(on)shown++;
    });
    content.querySelectorAll('.explore-grid').forEach(function(grid){
      var any=Array.prototype.some.call(grid.querySelectorAll('.exp-card[data-hxp-index]'),function(card){return !card.hidden;});
      grid.hidden=!any;var title=grid.previousElementSibling;if(title&&title.classList.contains('cat-title'))title.hidden=!any;
    });
    content.querySelectorAll('.hxp-filter').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-filter')===state.filter?'true':'false');});
    var live=content.querySelector('.hxp-filter-status');if(live)live.textContent='当前显示 '+shown+' 个单词。';
    var empty=content.querySelector('.hxp-empty');if(empty)empty.classList.toggle('show',shown===0);
  }

  function decorateCards(content,snap){
    var seq=0;
    content.querySelectorAll('.exp-card').forEach(function(card){
      var raw=card.getAttribute('onclick')||'',match=raw.match(/showWord\(\s*(\d+)\s*\)/),idx=match?Number(match[1]):seq;seq++;
      var item=itemAt(idx,snap);if(!item)return;
      card.setAttribute('data-hxp-index',String(idx));card.setAttribute('role','button');card.setAttribute('tabindex','0');
      var info=badgeInfo(item),badges=document.createElement('div');badges.className='hxp-badges';badges.setAttribute('aria-hidden','true');
      badges.innerHTML='<span class="hxp-badge '+info.paw.cls+'" title="'+esc(info.paw.title)+'">'+esc(info.paw.text)+'</span><span class="hxp-badge '+info.gem.cls+'" title="'+esc(info.gem.title)+'">'+esc(info.gem.text)+'</span>';
      card.insertBefore(badges,card.firstChild);
      if(item.seen){var seen=document.createElement('span');seen.className='hxp-seen-mark';seen.setAttribute('aria-hidden','true');seen.textContent='✓ 已认识';card.appendChild(seen);}
      var pawAria=item.masteryReadable?(item.mastered?'宠物已掌握':'宠物进度 '+Math.min(item.masterHits,item.mastery)+' / '+item.masterHits):'宠物状态暂不可读';
      var gemAria=item.crystalReadable?('知识结晶 '+item.lv+' / 5'+(paid(item)?'，4 钻已到账':item.done?'，奖励待核对':'')):'知识结晶状态暂不可读';
      card.setAttribute('aria-label',String(item.word.en||'')+'，'+String(item.word.cn||'')+'。'+(item.seen?'已认识。':'尚未标记认识。')+pawAria+'。'+gemAria+'。按回车查看详情。');
    });
  }

  function enhanceExplore(){
    var content=document.getElementById('exploreContent');if(!content)return;
    state.snapshot=buildSnapshot();var snap=state.snapshot;
    decorateCards(content,snap);
    content.insertBefore(makeOverview(snap),content.firstChild);
    var empty=document.createElement('div');empty.className='hxp-empty';empty.textContent='这个筛选条件下暂时没有单词。';content.appendChild(empty);
    applyFilter(content,snap);
    if(!content.__hxpEvents){
      content.__hxpEvents=true;
      content.addEventListener('click',function(ev){
        var filter=ev.target.closest&&ev.target.closest('.hxp-filter');
        if(filter&&FILTERS[filter.getAttribute('data-filter')]){state.filter=filter.getAttribute('data-filter');applyFilter(content,state.snapshot);return;}
        var open=ev.target.closest&&ev.target.closest('[data-hxp-open]');if(open){rememberTrigger(open,open.getAttribute('data-hxp-open'));openWord(open.getAttribute('data-hxp-open'));}
      });
      // 键盘激活统一交给全站 hansen_accessibility.js；这里不再另绑一遍，
      // 避免 Enter/Space 同时触发两套 handler 而把详情打开两次。
    }
    if(state.returnFocusPending)setTimeout(restoreFocusSoon,0);
  }

  function progressBar(now,max,label,readable){
    if(!readable)return '<div class="hxp-track" aria-label="'+esc(label)+'状态暂不可读"><i style="width:0"></i></div>';
    var pct=max>0?Math.round(clamp(now,0,max)/max*100):100;
    return '<div class="hxp-track" role="progressbar" aria-label="'+esc(label)+'" aria-valuemin="0" aria-valuemax="'+max+'" aria-valuenow="'+clamp(now,0,max)+'"><i style="width:'+pct+'%"></i></div>';
  }
  function rewardCopy(item,snap){
    if(!item.crystalReadable)return '结晶状态暂不可读；没有把未知状态当成 0 星。';
    if(!item.done)return '练满 5 星后，这个词一次性结晶 '+snap.rules.gemsPerWord+' 颗钻石。';
    var rs=rewardState(item);
    if(rs==='paid')return '✅ 逐词奖励账本已确认：+'+snap.rules.gemsPerWord+' 钻石已经到账；即使后来花掉，仍保持已到账。';
    if(rs==='legacy')return '🟣 这是旧版本迁移的历史结晶，已登记防止重复发奖；旧账本无法逐词证明当时的 +'+snap.rules.gemsPerWord+'。';
    if(rs==='pending'||rs==='unpaid')return '⏳ 5 星学习已经完成，钻石尚未被账本确认，正在安全补发；不会重复发放。';
    return '⚠️ 结晶已完成，但奖励账本状态暂不可读；钻石图标不会错误点亮。';
  }

  function detailHTML(item,snap){
    if(!item)return '<section class="hxp-progress"><h3>成长进度</h3><div class="hxp-prow">状态暂不可读</div></section>';
    var pawNow=item.masteryReadable?Math.min(item.masterHits,item.mastery):0;
    var pawMeta=!item.masteryReadable?'状态暂不可读；不会显示成 0/3。':item.mastered?('✅ 已计入宠物升级。打字大师累计精确拼对 '+item.mastery+' 次；宠物升级后保留。'):('还需在打字大师中无提示、整词精确拼对 '+(item.masterHits-pawNow)+' 次。选择题、听音选项和看提示拼写都不增加这条进度。');
    var stars='';for(var i=0;i<5;i++)stars+=i<(item.crystalReadable?item.lv:0)?'★':'☆';
    var crystalMeta='';
    if(item.crystalReadable){
      if(item.done)crystalMeta=rewardCopy(item,snap);
      else{
        crystalMeta=item.lockedToday?'✅ 今天这个词已通过聚焦 Spelling Bee 完成一次锁星；为了真正间隔记忆，明天才能再加固。':'打开聚焦 Spelling Bee 后可调机器人速度：<50 CPM 需赢10次，50~79 需赢7次，≥80 需赢5次。整组达标才锁 1 星。';
        if(!item.lockedToday&&item.boosted)crystalMeta+=' ⚡ 记忆强化还剩约 '+item.boostMinutes+' 分钟；挑战次数不减，达标后依原权益锁 '+snap.rules.boostStarGain+' 星。';
        crystalMeta+=' '+rewardCopy(item,snap);
      }
    }else crystalMeta=rewardCopy(item,snap);
    var h='<section class="hxp-progress" id="hxpWordProgress" aria-label="这个单词的成长进度"><h3>这个单词的两条真实进度</h3>'+
      '<div class="hxp-prow"><div class="hxp-ptop"><span>🐾 宠物掌握</span><span>'+(item.masteryReadable?(pawNow+' / '+item.masterHits):'—')+'</span></div>'+progressBar(pawNow,item.masterHits,'宠物掌握进度',item.masteryReadable)+'<div class="hxp-pmeta">'+esc(pawMeta)+'</div></div>'+
      '<div class="hxp-prow gem"><div class="hxp-ptop"><span>💎 知识结晶</span><span class="hxp-stars" aria-label="'+(item.crystalReadable?(item.lv+' / 5 星'):'状态暂不可读')+'">'+(item.crystalReadable?stars:'—')+'</span></div>'+progressBar(item.crystalReadable?item.lv:0,5,'知识结晶星级',item.crystalReadable)+'<div class="hxp-pmeta">'+esc(crystalMeta)+'</div></div>';
    var buttons=[];
    if(item.masteryReadable&&!item.mastered)buttons.push('<button type="button" class="hxp-action" data-hxp-launch="pet">🐾 打字大师·掌握冲刺</button>');
    if(item.crystalReadable&&!item.done){
      if(item.lockedToday)buttons.push('<button type="button" class="hxp-action gem" disabled aria-disabled="true">🌙 今日已完成结晶加固·明天再来</button>');
      else buttons.push('<button type="button" class="hxp-action gem" data-hxp-launch="crystal">💎 Spelling Bee·结晶加固</button>');
    }
    var rs=rewardState(item);if(item.done&&(rs==='pending'||rs==='unpaid'))buttons.push('<button type="button" class="hxp-action retry" data-hxp-retry="1">🔐 安全重试钻石补发</button>');
    if(buttons.length)h+='<div class="hxp-actions">'+buttons.join('')+'</div>';
    return h+'</section>';
  }

  function focusables(box){return Array.prototype.filter.call(box.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'),function(el){return !el.hidden&&el.offsetParent!==null;});}
  function trap(ev,box,closeFn){
    if(ev.key==='Escape'||ev.key==='Esc'){ev.preventDefault();closeFn();return;}
    if(ev.key!=='Tab')return;var f=focusables(box);if(!f.length)return;var first=f[0],last=f[f.length-1];
    if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}
  }

  function decorateModal(idx){
    var modal=document.getElementById('modalInner'),bg=document.getElementById('wordModal');if(!modal||!bg)return;
    var snap=state.snapshot=buildSnapshot(),item=itemAt(idx,snap);state.modalIndex=Number(idx);
    var oldStatus=modal.querySelector('.m-btn.got-it');
    if(!oldStatus)for(var oi=0;oi<modal.children.length;oi++){if(/已掌握/.test(modal.children[oi].textContent||'')){oldStatus=modal.children[oi];break;}}
    if(oldStatus&&!oldStatus.classList.contains('got-it'))oldStatus.textContent='✅ 已认识（已加入学习）';
    var title=modal.querySelector('.m-word');if(title)title.id='hxp-word-title';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','hxp-word-title');modal.setAttribute('aria-describedby','hxpWordProgress');
    modal.querySelectorAll('button').forEach(function(b){b.type='button';});
    var close=modal.querySelector('.close'),scroll=document.createElement('div');scroll.className='hxp-modal-scroll';
    Array.prototype.slice.call(modal.childNodes).forEach(function(node){if(node!==close)scroll.appendChild(node);});
    var holder=document.createElement('div');holder.innerHTML=detailHTML(item,snap);scroll.appendChild(holder.firstChild);modal.appendChild(scroll);
    scroll.querySelectorAll('[data-hxp-launch]').forEach(function(b){b.addEventListener('click',function(){launchGame(b.getAttribute('data-hxp-launch'),idx);});});
    var retry=scroll.querySelector('[data-hxp-retry]');if(retry)retry.addEventListener('click',function(){retryReward(idx);});
    document.documentElement.classList.add('hxp-modal-open');
    modal.onkeydown=function(ev){trap(ev,modal,function(){root.closeModal();});};
    setTimeout(function(){if(close)close.focus();},0);
  }

  function openWord(idx){idx=Math.floor(Number(idx));if(idx<0||idx>=list().length)return;if(typeof root.showWord==='function')root.showWord(idx);}
  function retryReward(idx){
    try{if(root.HansenCrystal&&typeof HansenCrystal.reconcileCanonicalRewards==='function')HansenCrystal.reconcileCanonicalRewards();}catch(e){}
    state.snapshot=buildSnapshot();
    try{if(typeof root.showToast==='function')showToast(paid(itemAt(idx,state.snapshot))?'✅ 钻石账本已确认到账':'⏳ 尚未确认到账，系统会继续安全重试');}catch(e){}
    openWord(idx);
  }

  function toast(text){try{if(typeof root.showToast==='function')root.showToast(text);}catch(e){}}
  function launchGame(mode,idx){
    idx=Math.floor(Number(idx));state.snapshot=buildSnapshot();var item=itemAt(idx,state.snapshot);
    if(!item)return;
    if(mode==='pet'){
      if(item.mastered){toast('✅ 这个词已达到宠物掌握门槛');return;}
      if(!root.HansenTypingMasterV946||typeof HansenTypingMasterV946.openFocus!=='function'){toast('⚠️ 打字大师聚焦模式尚未就绪，本次没有写入进度');return;}
      try{if(typeof root.closeModal==='function')root.closeModal();}catch(e){}
      try{if(HansenTypingMasterV946.openFocus(idx)!==false)return;}catch(e){}
      toast('⚠️ 未能打开打字大师，本次没有写入进度');
      return;
    }
    if(mode==='crystal'){
      if(item.done){toast('✅ 这个词已经完成 5 星结晶');return;}
      if(item.lockedToday){toast('🌙 今天已完成结晶加固，请明天再来间隔记忆');return;}
      var openBee=root.HansenSpellBee&&(typeof HansenSpellBee.openFocused==='function'?HansenSpellBee.openFocused:HansenSpellBee.openFocus);
      if(typeof openBee!=='function'){toast('⚠️ Spelling Bee 聚焦模式尚未就绪，本次没有写入进度');return;}
      try{if(typeof root.closeModal==='function')root.closeModal();}catch(e){}
      try{if(openBee.call(HansenSpellBee,idx)!==false)return;}catch(e){}
      toast('⚠️ 未能打开 Spelling Bee，本次没有写入进度');
    }
  }

  /* 🔴v1066：只靠 requestAnimationFrame 合并是不够的。
     实测（island_action → 探索页，静置 5 秒）：storage 事件触发 **118 次**，
     分散在几十帧里，于是 #exploreContent.innerHTML 被整表重写好几次，
     14 个卡片节点每次全部销毁重建。后果有三个：
       · 关闭单词详情后**焦点丢失**（那张卡的节点已经不在了）；
       · 列表可能闪一下 / 滚动跳位；
       · 停在探索页时白白耗电。
     来源是 v1023「房间预热常驻」的两个后台 iframe（land_map / island_season）
     初始化时写 localStorage —— storage 事件只在**同源的其他文档**改写时触发。
     v1023 与 v945 单独看都没错，是两个功能互相踩到。
     这里再加一层 250ms 防抖：突发的一串写入合并成一次渲染。 */
  function scheduleRefresh(){
    if(state.raf)return;
    var raf=root.requestAnimationFrame||function(fn){return setTimeout(fn,16);};
    state.raf=raf(function(){
      state.raf=0;
      if(state.debounce)return;
      state.debounce=setTimeout(function(){
        state.debounce=0;
        var screen=document.getElementById('exploreScreen');
        if(!(screen&&screen.classList.contains('active')&&typeof root.renderExplore==='function')){state.snapshot=null;return;}
        /* 🔴v1066 曾在这里加过第三层「内容指纹相同就跳过重建」，**已移除**。
           移除原因：我无法证明它安全。指纹取自 buildSnapshot()，
           而快照未必覆盖 renderExplore() 依赖的全部输入——
           一旦漏算，就会出现"进度真的变了、界面却不刷新"，
           那比多渲几次严重得多。
           本项目吃过同类亏：v1039 的 syncNow 因"内容指纹未变"跳过写入，
           导致上传显示成功却一字未写，查了十几版。
           **看起来省事的跳过，往往是下一个难查的 bug。**
           这里只保留能被验证的两层：按 key 过滤 + 250ms 防抖。 */
        root.renderExplore();
      },250);
    });
  }

  /* 🔴v1066：storage 事件带 e.key，据此过滤——
     `hsnViewMode`、`theme`、`*_bak`、各种 pending 事务键根本不影响探索列表，
     此前却一律触发整表重建。只认真正会改变列表内容的键。 */
  function affectsExplore(key){
    if(!key) return true;                       /* key 为 null＝整个 storage 被清空，保守重渲 */
    if(/_bak$|_pending|hsnViewMode|^theme$|temp_unlock|debug|blackbox|admin_access/i.test(key)) return false;
    return /^wordIsland|^hansen_wallet|^hansen_pet|^hansen_crystal|^hansen_gear|charxp|learned|^hansen_ach/i.test(key);
  }
  function onStorage(e){ if(affectsExplore(e&&e.key)) scheduleRefresh(); }

  function wrap(){
    /* 🔴v1066：整表重写会销毁当前聚焦的卡片，键盘/读屏用户的焦点就此丢失
       （关闭单词详情后焦点回不到原来那张卡，正是 test_explore_ui_v945 报的症状）。
       渲染前记住聚焦卡片的位置，渲染后按同一位置归还。
       即使渲染次数已经降下来，这一层也该有——重渲染本来就不该偷走焦点。 */
    if(typeof root.renderExplore==='function'&&!root.renderExplore.__hxpV946){
      var render=root.renderExplore;
      root.renderExplore=function(){
        var con=document.getElementById('exploreContent'), keepIdx=-1;
        try{
          var a=document.activeElement;
          if(a&&con&&con.contains(a)){
            var card=a.closest?a.closest('.exp-card'):null;
            if(card){ var list=[].slice.call(con.querySelectorAll('.exp-card')); keepIdx=list.indexOf(card); }
          }
        }catch(e){}
        var r=render.apply(this,arguments);
        enhanceExplore();
        if(keepIdx>=0){
          try{
            var again=document.getElementById('exploreContent');
            var cards=again?again.querySelectorAll('.exp-card'):null;
            if(cards&&cards[keepIdx]&&typeof cards[keepIdx].focus==='function') cards[keepIdx].focus();
          }catch(e){}
        }else if(state.returnFocusPending){
          /* 🔴v1066：关弹窗后焦点还没归还完，这时又发生一次重渲染——
             正是"关闭详情后焦点丢失"的最后一个窗口。
             ⚠️ 必须走 restoreFocusSoon()，它内部有"弹窗还开着就不动焦点"等守卫；
             直接 focus() 会在弹窗打开期间把焦点从弹窗里抢走（第一版就是这么写错的）。 */
          try{ restoreFocusSoon(); }catch(e){}
        }
        return r;
      };
      root.renderExplore.__hxpV946=true;
    }
    if(typeof root.showWord==='function'&&!root.showWord.__hxpV946){var show=root.showWord;root.showWord=function(idx){var active=document.activeElement;if(active&&active!==document.body)rememberTrigger(active,idx);else rememberTrigger(state.lastTrigger,idx);state.snapshot=buildSnapshot();var r=show.apply(this,arguments);decorateModal(idx);return r;};root.showWord.__hxpV946=true;}
    if(typeof root.closeModal==='function'&&!root.closeModal.__hxpV946){var close=root.closeModal;root.closeModal=function(){var r=close.apply(this,arguments);state.modalIndex=-1;document.documentElement.classList.remove('hxp-modal-open');restoreFocusSoon();return r;};root.closeModal.__hxpV946=true;}
  }

  root.HansenExploreProgress={
    refresh:scheduleRefresh,openWord:openWord,launch:launchGame,
    snapshot:function(){state.snapshot=buildSnapshot();return state.snapshot;},
    _badgeInfo:badgeInfo,_matches:matches,_petCandidates:petCandidates,_crystalCandidates:crystalCandidates,_beeRequired:beeRequired,
    _recommendationIcon:recommendationIcon
  };

  injectCSS();wrap();
  try{root.addEventListener('storage',onStorage);root.addEventListener('pageshow',scheduleRefresh);root.addEventListener('hansen-progress-changed',scheduleRefresh);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')scheduleRefresh();});}catch(e){}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
