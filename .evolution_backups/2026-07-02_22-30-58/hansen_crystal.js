// hansen_crystal.js — 知识结晶引擎(Hansen · 钻石=学习成果)
// ============================================================
// 设计核心:钻石 = 知识的结晶。只有"被永久学会"的单词才会结晶成钻石。
//   每个单词有 0→5 星「记忆熟练度」, 遵循间隔复习:
//     · 答对 → 攒记忆进度(答满 STAR_NEED 次填满一格)·🔴v833 进度本身不弹浮层(快游戏每次答对都弹会刷屏)
//     · 进度填满 + 今天还没锁过星(`w.d!==t`)→「锁定」+1 星(一天只锁 1 颗·物理防刷)·此刻亮一下 ⭐(floatMemo·只在锁星这一稀少里程碑弹)
//     · 答错 → 不倒扣(只是这次不涨·鼓励大胆试错)·照常进错题本由原 markAnswer 处理
//     · 练满 5 星(扛过 5 个不同日子的复习)→「永久掌握」(永久锁定·只结晶一次)
//   每永久掌握 1 个词 → 直接结晶 GEM_PER_WORD 颗💎(经 HansenGems 发放)。
// 其它机制(每日/每周/签到/小游戏/Boss)发金币+记忆强化, 帮你更快把词练成结晶。
// ------------------------------------------------------------
// 零侵入:独立 IIFE + 包装 markAnswer 捕获每次答题 + 自管 localStorage + 用 HansenGems 发钻。
//   每岛一份熟练度(单词表各岛不同):localStorage 'hsn_crystal_<岛>'。每词 {lv,p,d,done}。
//   全局结晶总数 + 已发钻数(钻石是全局货币):'hsn_crystal_total' / 'hsn_crystal_gems'。
// 全程无旋转/闪烁/震动/循环 opacity(防晕铁律)。
// ============================================================
(function(){
  if(window.__hansenCrystalLoaded){ return; } window.__hansenCrystalLoaded = true;

  // ===== 可调参数(以后调手感只改这里) =====
  var MAX_LV    = 5;   // 满星 = 永久掌握(要 5 个不同日子各"锁定"一颗星)
  var STAR_NEED = 2;   // 🔴v832 每颗星要"答对 N 次"填满(当场可见进度条·给即时反馈)。注意"一天只锁 1 颗星"的闸门不变→防刷不破。
  var GEM_PER_WORD = 4;// 🔴v832 每永久掌握 1 个词 = 直接结晶 N 颗💎(原来是3词攒1颗·经济严重不足:全952词学透只够装备30%。改后全学透≈5348💎·装备3195买得起还有余)
  var BOOST_STAR = 2;  // 「记忆强化」激活时, 锁定一颗星时多涨 N 星(翻倍·仍受"一天只锁一次"闸门约束·防刷不破)
  var ISLAND_BONUS = 50; // 🔴v832 单岛全部单词永久掌握 → 额外结晶 N 颗💎(一次性大奖·30→50)
  // 🔴v832 统一探险家段位(按"全部岛累计永久掌握词数"晋级·门槛适配全游戏952词·传奇800可达):
  var RANKS = [
    {n:'新手探险家', need:0,   bonus:0},
    {n:'熟练探险家', need:30,  bonus:20},
    {n:'高手探险家', need:100, bonus:40},
    {n:'大师探险家', need:250, bonus:80},
    {n:'大神探险家', need:500, bonus:150},
    {n:'传奇探险家', need:800, bonus:300}
  ];

  // ===== 工具 =====
  function today(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function islandKey(){
    try{ var f=(location.pathname.split('/').pop()||'index').replace(/\.html?$/i,''); return f||'index'; }
    catch(e){ return 'index'; }
  }
  function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(e){} }
  function lsInt(k){ var n=parseInt(lsGet(k,'0'),10); return isFinite(n)?n:0; }

  // ===== 每岛熟练度存档:{ idx: {lv, d, done} } =====
  function loadM(){
    try{ var o=JSON.parse(lsGet('hsn_crystal_'+islandKey(),'{}')); return (o&&typeof o==='object')?o:{}; }
    catch(e){ return {}; }
  }
  function saveM(m){ try{ localStorage.setItem('hsn_crystal_'+islandKey(), JSON.stringify(m)); }catch(e){} }

  // 取单词文本(通知用)
  function wordEn(idx){
    try{ if(window.allW && allW[idx] && allW[idx].en) return allW[idx].en; }catch(e){}
    return '';
  }

  // ===== 结晶发钻(全局)·🔴v832 每永久掌握1词 = 直接发 GEM_PER_WORD 颗💎 =====
  function crystallize(idx){
    var total = lsInt('hsn_crystal_total') + 1;
    lsSet('hsn_crystal_total', total);
    try{ if(window.HansenGems && HansenGems.add) HansenGems.add(GEM_PER_WORD); }catch(e){}
    lsSet('hsn_crystal_gems', lsInt('hsn_crystal_gems') + GEM_PER_WORD);   // 累计结晶钻石(面板展示)
    var en = wordEn(idx);
    toast('💎 记牢了'+(en?'「'+en+'」':'')+'！+'+GEM_PER_WORD+' 颗钻石', true);
    try{ refreshBadge(); }catch(e){}
    try{ checkRankUp(total); }catch(e){}        //🔴v830 探险家段位晋升
    try{ checkIslandComplete(); }catch(e){}     //🔴v830 单岛全词永久掌握大奖
  }

  // ===== 🔴v830 探险家段位(按全部岛累计永久掌握词数) =====
  function rankIndexOf(total){ var i=0; for(var k=0;k<RANKS.length;k++){ if(total>=RANKS[k].need) i=k; } return i; }
  function curRank(){ return RANKS[rankIndexOf(lsInt('hsn_crystal_total'))]; }
  function nextRank(){ var i=rankIndexOf(lsInt('hsn_crystal_total')); return (i+1<RANKS.length)?RANKS[i+1]:null; }
  function checkRankUp(total){
    var ri=rankIndexOf(total), awarded=lsInt('hsn_crystal_rank');
    if(ri>awarded){
      var bonus=0; for(var k=awarded+1;k<=ri;k++){ bonus+=RANKS[k].bonus; }
      if(bonus>0){ try{ if(window.HansenGems&&HansenGems.add) HansenGems.add(bonus); }catch(e){} }
      lsSet('hsn_crystal_rank', ri);
      setTimeout(function(){ toast('🏅 升到「'+RANKS[ri].n+'」！'+(bonus>0?'奖 '+bonus+' 颗钻石 💎':''), true); }, 800);
    }
  }
  // ===== 🔴v830 单岛全词永久掌握(一次性大奖) =====
  function checkIslandComplete(){
    var total=0; try{ total=(window.allW&&allW.length)||0; }catch(e){}
    if(total<=0) return;
    var m=loadM(), done=0; for(var k in m){ if(m.hasOwnProperty(k)&&m[k]&&m[k].done) done++; }
    if(done>=total){
      var flag='hsn_crystal_isldone_'+islandKey();
      if(lsGet(flag,'')!=='1'){
        lsSet(flag,'1');
        try{ if(window.HansenGems&&HansenGems.add) HansenGems.add(ISLAND_BONUS); }catch(e){}
        setTimeout(function(){ toast('🏝️ 这个岛的词全记牢了！多奖 '+ISLAND_BONUS+' 颗钻石 💎', true); }, 1600);
      }
    }
  }

  // ===== 答题 → 更新熟练度(核心) =====
  function onAnswer(idx, correct){
    if(idx==null || idx<0) return;
    var m = loadM();
    var w = m[idx] || {lv:0, p:0, d:'', done:0};
    if(typeof w.p !== 'number') w.p = 0;     // 兼容老存档(没有 p 字段)
    if(w.done){ return; }                    // 已永久掌握 → 锁定, 不再变化
    var t = today();
    if(correct){
      if(w.p < STAR_NEED){ w.p++; }                    // 攒进度(防刷闸门下)·🔴v833 不再每次答对弹浮层(快游戏会刷屏)
      if(w.p >= STAR_NEED && w.d !== t){               // 进度满 + 今天还没锁过星 → 锁定一颗(防刷闸门:一天只锁1次)
        var gain = isBoosted() ? BOOST_STAR : 1;       // 记忆强化中 → 多涨
        w.lv = Math.min(MAX_LV, w.lv + gain);
        w.p = 0; w.d = t;
        if(w.lv >= MAX_LV){ w.done = 1; m[idx]=w; saveM(m); crystallize(idx); return; }
        m[idx]=w; saveM(m); floatMemo(idx,'lock',w.lv); return;   // 🔴v833 只在真正锁定一颗记忆星(稀少里程碑·一天每词一次)弹一下⭐·克制不刷屏
      }
      m[idx]=w; saveM(m);
      // 🔴v833 答对但未锁星(攒进度 / 今天这词已锁过)→ 不弹任何浮层。好反馈要克制:快节奏小游戏每次答对都弹会刷屏·孩子也来不及看·只把⭐留给锁星那一刻。
      return;
    }
    // 🔴v832 答错:不倒扣(鼓励大胆试错·只是这次不涨星)
    m[idx]=w; saveM(m);
  }

  // ===== 🔴v832 即时记忆反馈浮层(单元素·替换式·节流·无旋转闪烁) =====
  function floatMemo(idx, kind, lv, p){
    ensureCSS();
    var en = wordEn(idx);
    var el = document.getElementById('hsnCrystalMemo');
    if(!el){ el=document.createElement('div'); el.id='hsnCrystalMemo'; document.body.appendChild(el); }
    var stars = '';
    for(var i=0;i<MAX_LV;i++){ stars += (i<(lv||0)) ? '★' : '☆'; }
    var html='', cls='hcm';
    if(kind==='lock'){
      cls='hcm lock';
      html = '<b>⭐ '+(en||'单词')+' 记忆 +1</b><span class="s">'+stars+'</span>';
    } else if(kind==='ready'){
      cls='hcm ready';
      html = '<b>✓ '+(en||'单词')+' 今天记牢了</b><span class="t">明天再来加固一颗星</span>';
    } else {
      cls='hcm prog';
      var dots=''; for(var j=0;j<STAR_NEED;j++){ dots += (j<(p||0))?'●':'○'; }
      html = '<b>🧠 '+(en||'单词')+'</b><span class="t">记忆 '+dots+' · 再答对升一颗星</span>';
    }
    el.className=cls; el.innerHTML=html;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    if(floatMemo._t) clearTimeout(floatMemo._t);
    floatMemo._t = setTimeout(function(){ if(el) el.classList.remove('show'); }, 1300);
  }

  // ===== 统计(面板用) =====
  function stats(){
    var m = loadM(), dist=[0,0,0,0,0,0], mastered=0, seen=0;
    for(var k in m){ if(!m.hasOwnProperty(k))continue; var w=m[k]; seen++;
      if(w.done){ mastered++; } else { var lv=Math.max(0,Math.min(5,w.lv|0)); dist[lv]++; } }
    var totalWords=0; try{ totalWords=(window.allW&&allW.length)||0; }catch(e){}
    var gTotal=lsInt('hsn_crystal_total'), gGems=lsInt('hsn_crystal_gems');
    return {dist:dist, mastered:mastered, seen:seen, totalWords:totalWords, gTotal:gTotal, gGems:gGems, perWord:GEM_PER_WORD};
  }

  // ===== Toast 提示 =====
  function ensureCSS(){
    if(document.getElementById('hsnCrystalCSS')) return;
    var css=''
      + '#hsnCrystalMask{position:fixed;inset:0;z-index:99998;background:rgba(6,10,22,.88);display:none;align-items:center;justify-content:center;padding:16px}'
      + '#hsnCrystalMask.show{display:flex}'
      + '.hcr-panel{width:min(420px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(160deg,#142447,#0c1730);border:1px solid #2a3d63;border-radius:18px;padding:20px 18px 22px;color:#eaf1fb;box-shadow:0 24px 60px -16px rgba(0,0,0,.7)}'
      + '.hcr-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}'
      + '.hcr-title{font-size:19px;font-weight:800;letter-spacing:.5px;background:linear-gradient(90deg,#7dd3fc,#c4b5fd,#fbcfe8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}'
      + '.hcr-close{width:30px;height:30px;border:none;border-radius:8px;background:#1d2c4d;color:#cdd9ef;font-size:17px;cursor:pointer;line-height:1}'
      + '.hcr-sub{font-size:12.5px;color:#9fb2d4;margin:2px 0 14px;line-height:1.5}'
      + '.hcr-gem{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(125,211,252,.16),rgba(196,181,253,.12));border:1px solid #34507e;border-radius:14px;padding:14px 16px;margin-bottom:14px}'
      + '.hcr-gem .big{font-size:34px;line-height:1}'
      + '.hcr-gem .n{font-size:26px;font-weight:800;color:#bfe3ff}'
      + '.hcr-gem .lbl{font-size:12px;color:#9fb2d4}'
      + '.hcr-rank{background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(252,211,77,.07));border:1px solid #7a5a23;border-radius:13px;padding:11px 14px;margin-bottom:14px}'
      + '.hcr-rank .rk-top{font-size:15px;font-weight:800;color:#fde68a}'
      + '.hcr-rank .rk-sub{font-size:11.5px;font-weight:600;color:#bfa468;margin-left:6px}'
      + '.hcr-rank .rk-next{font-size:11.5px;color:#caa766;margin-top:6px}'
      + '.hcr-bar{height:9px;border-radius:6px;background:#0c1830;overflow:hidden;margin-top:7px;border:1px solid #293c61}'
      + '.hcr-bar > i{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa);border-radius:6px}'
      + '.hcr-row{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:13.5px}'
      + '.hcr-row .star{width:84px;color:#cbd8ef;font-weight:700;white-space:nowrap}'
      + '.hcr-row .track{flex:1;height:14px;border-radius:7px;background:#0c1830;overflow:hidden;border:1px solid #293c61}'
      + '.hcr-row .track > i{display:block;height:100%;border-radius:7px}'
      + '.hcr-row .cnt{width:38px;text-align:right;color:#9fb2d4;font-weight:700}'
      + '.hcr-foot{font-size:11.5px;color:#7e92b6;margin-top:14px;line-height:1.6;border-top:1px dashed #2a3d63;padding-top:11px}'
      + '#hsnCrystalBtn{position:fixed;right:12px;bottom:120px;z-index:9990;width:52px;height:52px;border-radius:50%;border:1px solid #4a6aa0;background:linear-gradient(150deg,#1a2c52,#10203f);box-shadow:0 8px 22px -6px rgba(0,0,0,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:25px}'
      + '#hsnCrystalBtn .b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#22c55e;color:#fff;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center;line-height:1}'
      + '.hcr-toast{position:fixed;left:50%;bottom:18%;transform:translateX(-50%);max-width:84%;text-align:center;background:linear-gradient(135deg,#1b2c50,#122b4d);color:#eaf1fb;border:1px solid #3a558a;border-radius:12px;padding:11px 18px;font-size:13.5px;font-weight:700;z-index:100002;box-shadow:0 12px 34px -10px rgba(0,0,0,.65)}'
      + '.hcr-toast.gem{border-color:#7dd3fc;background:linear-gradient(135deg,#1d3358,#2a1f4d)}'
      + '.hcr-boost{font-size:12.5px;font-weight:700;border-radius:11px;padding:9px 13px;margin-bottom:13px;line-height:1.45}'
      + '.hcr-boost{background:linear-gradient(135deg,rgba(250,204,21,.18),rgba(245,158,11,.10));border:1px solid #b58a2e;color:#fde68a}'
      + '.hcr-boost.off{background:#101d36;border:1px solid #283a5d;color:#8aa0c4;font-weight:600}'
      + '#hsnCrystalBtn{touch-action:none;-webkit-user-select:none;user-select:none;transition:left .24s cubic-bezier(.22,1,.36,1),top .24s cubic-bezier(.22,1,.36,1),transform .12s ease,box-shadow .15s ease}'  /* 🔴v841 可拖动悬浮球:吸边平滑过渡(只过渡left/top·非循环·不震不闪) */
      + '#hsnCrystalBtn.dragging{transition:none;transform:scale(1.1);box-shadow:0 14px 32px -6px rgba(0,0,0,.72);cursor:grabbing}'  /* 拖动中跟手(去过渡)+轻微放大反馈 */
      + '#hsnCrystalMenu{position:fixed;z-index:9992;background:linear-gradient(150deg,#1b2c50,#111f3c);border:1px solid #3a558a;border-radius:13px;padding:5px;box-shadow:0 14px 34px -8px rgba(0,0,0,.7);display:none;-webkit-user-select:none;user-select:none}'
      + '#hsnCrystalMenu.show{display:block;animation:hcrMenuIn .16s ease-out}'
      + '@keyframes hcrMenuIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'  /* 一次性入场·非循环 */
      + '.hcr-mi{display:flex;align-items:center;gap:9px;padding:9px 13px 9px 10px;border-radius:9px;color:#eaf1fb;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}'
      + '.hcr-mi:active{background:rgba(125,170,240,.2)}'
      + '.hcr-mi .ic{font-size:15px;width:18px;text-align:center;flex:none}'
      + '.hcr-mi.danger{color:#fca5a5}'
      + '#hsnCrystalBtn.boost{border-color:#fbbf24;box-shadow:0 0 0 2px rgba(251,191,36,.35),0 8px 22px -6px rgba(0,0,0,.6)}'
      + '#hsnCrystalBtn .z{position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);background:#fbbf24;color:#1a1205;font-size:9px;font-weight:800;padding:0 4px;border-radius:6px;line-height:1.4;display:none}'
      + '#hsnCrystalBtn.boost .z{display:block}'
      + '#hsnCrystalMemo{position:fixed;left:50%;bottom:24%;z-index:100001;background:linear-gradient(135deg,#16233f,#101b33);border:1px solid #34507e;border-radius:12px;padding:8px 14px;color:#eaf1fb;font-size:12.5px;line-height:1.4;box-shadow:0 10px 26px -10px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:84%;text-align:center;white-space:nowrap;transform:translate(-50%,8px)}'
      + '#hsnCrystalMemo.show{opacity:1;transform:translate(-50%,0)}'
      + '#hsnCrystalMemo b{display:block;font-weight:800}'
      + '#hsnCrystalMemo .s{color:#fcd34d;letter-spacing:2px;font-size:13px}'
      + '#hsnCrystalMemo .t{color:#9fb2d4;font-size:11px}'
      + '#hsnCrystalMemo.lock{border-color:#d4a93a}#hsnCrystalMemo.lock b{color:#fde68a}'
      + '#hsnCrystalMemo.ready{border-color:#3a8a5a}#hsnCrystalMemo.ready b{color:#86efac}'
      + '#hsnCrystalMemo.prog b{color:#bfe3ff}';
    var st=document.createElement('style'); st.id='hsnCrystalCSS'; st.textContent=css; document.head.appendChild(st);
  }
  var _toastT=null;
  function toast(msg, isGem){
    ensureCSS();
    var old=document.getElementById('hsnCrystalToast'); if(old&&old.parentNode)old.parentNode.removeChild(old);
    var t=document.createElement('div'); t.id='hsnCrystalToast'; t.className='hcr-toast'+(isGem?' gem':''); t.textContent=msg;
    document.body.appendChild(t);
    if(_toastT)clearTimeout(_toastT);
    _toastT=setTimeout(function(){ if(t&&t.parentNode)t.parentNode.removeChild(t); }, 2600);
  }

  // ===== 面板 =====
  var STAR_COLORS=['#64748b','#38bdf8','#22d3ee','#34d399','#a78bfa','#fbbf24'];
  function open(){
    ensureCSS();
    var mask=document.getElementById('hsnCrystalMask');
    if(!mask){ mask=document.createElement('div'); mask.id='hsnCrystalMask'; document.body.appendChild(mask);
      mask.addEventListener('click',function(e){ if(e.target===mask) close(); }); }
    var s=stats();
    var maxBar=Math.max(1, s.dist[1]+s.dist[2]+s.dist[3]+s.dist[4], s.mastered, 5);
    var rows='';
    var names=['🌑 没学过','🌒 刚认识(1★)','🌓 有点熟(2★)','🌔 比较熟(3★)','🌕 快记牢(4★)'];
    for(var lv=1; lv<=4; lv++){
      var c=s.dist[lv], w=Math.round(c/maxBar*100);
      rows+='<div class="hcr-row"><span class="star">'+names[lv]+'</span><span class="track"><i style="width:'+w+'%;background:'+STAR_COLORS[lv]+'"></i></span><span class="cnt">'+c+'</span></div>';
    }
    var mw=Math.round(s.mastered/maxBar*100);
    rows+='<div class="hcr-row"><span class="star">💎 已记牢</span><span class="track"><i style="width:'+mw+'%;background:linear-gradient(90deg,#fbbf24,#fde68a)"></i></span><span class="cnt">'+s.mastered+'</span></div>';
    var boostHtml = isBoosted()
      ? '<div class="hcr-boost">⚡ 加速中 · 现在记单词<b>更快</b> · 剩 '+boostLeftMin()+' 分钟 · 快去答！</div>'
      : '<div class="hcr-boost off">💤 加速·没开 · 做每日任务 / 打 Boss / 签到 就能开(开了记单词更快)</div>';
    var rk=curRank(), nr=nextRank();
    var rankPct = nr ? Math.max(0,Math.min(100, Math.round((s.gTotal - rk.need)/(nr.need - rk.need)*100))) : 100;
    var rankHtml = '<div class="hcr-rank"><div class="rk-top">🏅 <b>'+rk.n+'</b></div>'
      + (nr ? '<div class="hcr-bar"><i style="width:'+rankPct+'%;background:linear-gradient(90deg,#f59e0b,#fcd34d)"></i></div><div class="rk-next">再记牢 '+(nr.need-s.gTotal)+' 个词，升「'+nr.n+'」'+(nr.bonus?'(奖 '+nr.bonus+' 💎)':'')+'</div>' : '<div class="rk-next">已经是最高级啦 🎉</div>')
      + '</div>';
    var islDone = lsGet('hsn_crystal_isldone_'+islandKey(),'')==='1';
    var islHdr = islDone
      ? '<div style="font-size:13px;font-weight:700;color:#fcd34d;margin:4px 0 6px">🏝️ 这个岛的词全记牢啦！（'+s.totalWords+' 个）'+(ISLAND_BONUS?'　已奖 '+ISLAND_BONUS+' 💎':'')+'</div>'
      : '<div style="font-size:13px;font-weight:700;color:#cbd8ef;margin:4px 0 6px">这个岛共 '+s.totalWords+' 个词 · 练过 '+s.seen+' 个 · 全部记牢再奖 '+ISLAND_BONUS+' 💎</div>';
    mask.innerHTML=''
      + '<div class="hcr-panel">'
      +   '<div class="hcr-head"><div class="hcr-title">💎 我的钻石</div><button class="hcr-close" id="hcrClose">✕</button></div>'
      +   '<div class="hcr-sub"><b>记牢一个单词 = '+s.perWord+' 颗💎。</b>答对一次还不够，要<b>多练几天、真记牢</b>才算。答错没关系，大胆答！</div>'
      +   boostHtml
      +   '<div class="hcr-gem"><span class="big">💎</span><div style="flex:1"><div class="n">'+s.gGems+' <span style="font-size:13px;color:#9fb2d4">颗钻石</span></div><div class="lbl">你一共记牢了 '+s.gTotal+' 个单词</div></div></div>'
      +   rankHtml
      +   islHdr
      +   rows
      +   '<div class="hcr-foot">💡 钻石<b>刷不出来</b>——它代表你<b>真学会了多少</b>。一个词要隔几天反复答对、真记牢，才算。</div>'
      + '</div>';
    mask.querySelector('#hcrClose').addEventListener('click', close);
    mask.classList.add('show');
  }
  function close(){ var m=document.getElementById('hsnCrystalMask'); if(m)m.classList.remove('show'); }

  // ===== 入口悬浮按钮 =====
  function refreshBadge(){
    var btn=document.getElementById('hsnCrystalBtn'); if(!btn)return;
    if(isBoosted()){ btn.classList.add('boost'); } else { btn.classList.remove('boost'); }
    var b=btn.querySelector('.b'); if(!b)return;
    var s=stats(); // 角标显示"接近满星(4★)的词数"=马上能结晶的提醒
    var near=s.dist[4];
    if(near>0){ b.textContent=near; b.style.display='flex'; } else { b.style.display='none'; }
  }
  // ===== 🔴v841 可拖动悬浮球(像 iPhone AssistiveTouch:屏幕内自由拖动+吸边·进游戏模式自动隐藏·点击弹菜单可关闭·设置里重开) =====
  var _crystalTimers = [];   // 🔴v841 定时器引用(pagehide 时统一清理·防"setInterval无clearInterval"隐患)
  var DRAG_THRESH = 6;     // 移动超过此像素 = 拖动; 否则 = 点击(弹菜单)
  var EDGE_MARGIN = 12;    // 吸边后距屏幕边的留白
  var TOP_SAFE = 64;       // 顶部安全区(避开顶栏)
  var BOT_SAFE = 78;       // 底部安全区(避开底栏导航)
  function btnEl(){ return document.getElementById('hsnCrystalBtn'); }
  function loadPos(){ try{ var p=JSON.parse(lsGet('hsn_crystal_btn_pos','null')); if(p && (p.side==='l'||p.side==='r') && isFinite(p.top)) return p; }catch(e){} return null; }
  function savePos(p){ lsSet('hsn_crystal_btn_pos', JSON.stringify(p)); }
  function isHidden(){ return lsGet('hsn_crystal_btn_hidden','0')==='1'; }   // 用户在菜单/设置里主动关闭
  function setHidden(v){ lsSet('hsn_crystal_btn_hidden', v?'1':'0'); }
  function clampTop(top){
    var h=(btnEl()&&btnEl().offsetHeight)||52;
    var min=TOP_SAFE, max=window.innerHeight - h - BOT_SAFE;
    if(max<min) max=min;
    return Math.max(min, Math.min(max, top));
  }
  // 应用保存的位置(统一用 left 定位·便于 transition 平滑吸边); 无保存=回退 CSS 默认(右下)
  function applyPos(){
    var b=btnEl(); if(!b) return;
    var p=loadPos();
    if(!p){ b.style.left=''; b.style.right=''; b.style.top=''; b.style.bottom=''; return; }
    var w=b.offsetWidth||52;
    var left=(p.side==='l') ? EDGE_MARGIN : (window.innerWidth - w - EDGE_MARGIN);
    b.style.left=left+'px'; b.style.top=clampTop(p.top)+'px'; b.style.right='auto'; b.style.bottom='auto';
  }

  // ---- 拖动(pointer events·兼容触屏+鼠标) ----
  function initDrag(b){
    var startX=0,startY=0,origLeft=0,origTop=0,dragging=false,pressing=false;
    b.addEventListener('pointerdown', function(ev){
      if(ev.button!=null && ev.button!==0) return;   // 仅主键/触摸
      pressing=true; dragging=false;
      startX=ev.clientX; startY=ev.clientY;
      var r=b.getBoundingClientRect(); origLeft=r.left; origTop=r.top;
      try{ b.setPointerCapture(ev.pointerId); }catch(e){}
    });
    b.addEventListener('pointermove', function(ev){
      if(!pressing) return;
      var dx=ev.clientX-startX, dy=ev.clientY-startY;
      if(!dragging && (Math.abs(dx)+Math.abs(dy))>DRAG_THRESH){
        dragging=true; b.classList.add('dragging'); hideMenu();
        b.style.left=origLeft+'px'; b.style.top=origTop+'px'; b.style.right='auto'; b.style.bottom='auto';  // 切到 left/top 定位
      }
      if(dragging){
        if(ev.cancelable) ev.preventDefault();
        var w=b.offsetWidth, h=b.offsetHeight;
        var nl=Math.max(0, Math.min(window.innerWidth-w, origLeft+dx));
        var nt=Math.max(0, Math.min(window.innerHeight-h, origTop+dy));
        b.style.left=nl+'px'; b.style.top=nt+'px';
      }
    });
    function endDrag(ev){
      if(!pressing) return; pressing=false;
      try{ if(ev) b.releasePointerCapture(ev.pointerId); }catch(e){}
      if(dragging){
        dragging=false; b.classList.remove('dragging');
        var r=b.getBoundingClientRect();
        var side=(r.left + r.width/2 < window.innerWidth/2) ? 'l' : 'r';   // 吸到最近的左/右边
        savePos({side:side, top:clampTop(r.top)});
        applyPos();   // transition 平滑滑到吸边位置
      } else {
        toggleMenu();  // 没拖动 = 点击 → 弹菜单
      }
    }
    b.addEventListener('pointerup', endDrag);
    b.addEventListener('pointercancel', endDrag);
  }

  // ---- 点击弹出的小菜单(我的钻石 / 隐藏悬浮球) ----
  var _menuOpen=false;
  function ensureMenu(){
    var m=document.getElementById('hsnCrystalMenu'); if(m) return m;
    m=document.createElement('div'); m.id='hsnCrystalMenu';
    m.innerHTML='<div class="hcr-mi" data-act="open"><span class="ic">💎</span>我的钻石</div>'
              + '<div class="hcr-mi danger" data-act="hide"><span class="ic">🙈</span>隐藏悬浮球</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(ev){
      var it=ev.target.closest && ev.target.closest('.hcr-mi'); if(!it) return;
      var act=it.getAttribute('data-act'); hideMenu();
      if(act==='open') open();
      else if(act==='hide') hideBall();
    });
    return m;
  }
  function positionMenu(){
    var b=btnEl(), m=ensureMenu(); if(!b) return;
    m.classList.add('show');
    var br=b.getBoundingClientRect(), mr=m.getBoundingClientRect();
    var left=(br.left + br.width/2 < window.innerWidth/2) ? (br.right+8) : (br.left - mr.width - 8);  // 球在左→菜单在右; 球在右→菜单在左
    left=Math.max(8, Math.min(window.innerWidth - mr.width - 8, left));
    var top=Math.max(8, Math.min(window.innerHeight - mr.height - 8, br.top + br.height/2 - mr.height/2));
    m.style.left=left+'px'; m.style.top=top+'px';
  }
  function showMenu(){ ensureMenu(); positionMenu(); _menuOpen=true; setTimeout(function(){ document.addEventListener('pointerdown', onDocDown, true); },0); }
  function hideMenu(){ var m=document.getElementById('hsnCrystalMenu'); if(m) m.classList.remove('show'); _menuOpen=false; document.removeEventListener('pointerdown', onDocDown, true); }
  function toggleMenu(){ _menuOpen ? hideMenu() : showMenu(); }
  function onDocDown(ev){ var m=document.getElementById('hsnCrystalMenu'), b=btnEl(); if(m && !m.contains(ev.target) && !(b&&b.contains(ev.target))) hideMenu(); }

  // ---- 隐藏 / 显示悬浮球 ----
  function hideBall(){ setHidden(true); hideMenu(); var b=btnEl(); if(b) b.style.display='none'; refreshSettingsToggle(); toast('已隐藏悬浮球，可在「设置」里重新打开 💎'); }
  function showBall(){ setHidden(false); refreshSettingsToggle(); applyVisibility(); }

  // ---- 进游戏模式自动隐藏(homeScreen 不可见 或 有全屏覆盖层 → 隐藏) ----
  function homeVisible(){
    var home=document.getElementById('homeScreen');
    if(!home) return true;   // 非岛页(如首页)无 homeScreen → 视为可显示
    if(!home.classList.contains('active')) return false;          // 切到别的 screen(探索/Boss/设置等)
    var s=getComputedStyle(home);
    return !(s.display==='none' || s.visibility==='hidden');
  }
  function hasFullOverlay(){
    // 拼写对战/字母拼拼乐等是全屏 fixed 覆盖层(不走 showScreen)·z≥9990 且占满屏 → 隐藏球避免遮挡
    var kids=document.body.children;
    for(var i=0;i<kids.length;i++){
      var el=kids[i];
      if(el.id==='hsnCrystalBtn'||el.id==='hsnCrystalMenu'||el.id==='hsnCrystalMask') continue;
      var s=getComputedStyle(el);
      if(s.position!=='fixed') continue;
      if(s.display==='none'||s.visibility==='hidden'||(+s.opacity)===0) continue;
      if((parseInt(s.zIndex,10)||0) < 9990) continue;
      var r=el.getBoundingClientRect();
      if(r.width>=window.innerWidth*0.8 && r.height>=window.innerHeight*0.6) return true;
    }
    return false;
  }
  function shouldShow(){ return !isHidden() && homeVisible() && !hasFullOverlay(); }
  function applyVisibility(){
    var b=btnEl(); if(!b) return;
    if(shouldShow()){ if(b.style.display==='none'){ applyPos(); } b.style.display='flex'; }
    else { if(b.style.display!=='none') b.style.display='none'; if(_menuOpen) hideMenu(); }
  }
  function startWatch(){
    applyVisibility();
    _crystalTimers.push(setInterval(applyVisibility, 320));    // 🔴v841 轮询(只查 body 直接子·开销小)·覆盖各种进入模式的方式·引用存起便于清理
    hookShowScreen();                     // 包装 showScreen 立即响应·减少延迟
    window.addEventListener('resize', function(){ if(loadPos()) applyPos(); applyVisibility(); });
    // 🔴v841 页面卸载主动清理所有定时器(防御性):切岛时 iframe 卸载本就自动清·这是第二重保险·彻底消除"setInterval未配对clearInterval"隐患
    window.addEventListener('pagehide', function(){ _crystalTimers.forEach(function(t){ clearInterval(t); }); _crystalTimers.length=0; });
  }
  function hookShowScreen(){
    if(typeof window.showScreen==='function'){
      if(window.showScreen.__crystalWatch) return;
      var orig=window.showScreen;
      window.showScreen=function(){ var r=orig.apply(this,arguments); try{ setTimeout(applyVisibility,0); }catch(e){} return r; };
      window.showScreen.__crystalWatch=true;
    } else { setTimeout(hookShowScreen,300); }
  }

  // ---- 设置里加「显示钻石悬浮球」开关(包装 renderSettings·零侵入注入·关闭后从这里重开) ----
  function injectSettingsToggle(){
    var content=document.getElementById('settingsContent'); if(!content) return;
    if(!document.getElementById('hcrBtnToggleSection')){
      var sec=document.createElement('div'); sec.className='settings-section'; sec.id='hcrBtnToggleSection';
      sec.style.borderColor='rgba(125,211,252,.3)';
      content.appendChild(sec);
    }
    refreshSettingsToggle();
  }
  function refreshSettingsToggle(){
    var sec=document.getElementById('hcrBtnToggleSection'); if(!sec) return;
    var on=!isHidden();
    sec.innerHTML='<h3>💎 钻石悬浮球</h3>'
      + '<div class="desc">屏幕上可以拖动的钻石小球，点它能查看「我的钻石」。可以把它拖到屏幕任意位置，进入游戏模式时会自动隐藏，不挡视线。</div>'
      + '<div class="btn-row"><button id="hcrBtnToggleBtn" style="border:none;border-radius:10px;padding:9px 18px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit;color:#fff;background:'
      + (on?'linear-gradient(90deg,#ef4444,#dc2626)':'linear-gradient(90deg,#06b6d4,#0891b2)') + '">'
      + (on?'🙈 隐藏悬浮球':'💎 显示悬浮球') + '</button>'
      + '<span style="align-self:center;font-size:12.5px;color:'+(on?'#86efac':'#94a3b8')+'">当前：'+(on?'显示中':'已隐藏')+'</span></div>';
    var tb=document.getElementById('hcrBtnToggleBtn');
    if(tb) tb.addEventListener('click', function(){ isHidden()?showBall():hideBall(); });
  }
  function hookSettings(){
    if(typeof window.renderSettings==='function'){
      if(window.renderSettings.__crystalToggle) return;
      var orig=window.renderSettings;
      window.renderSettings=function(){ var r=orig.apply(this,arguments); try{ injectSettingsToggle(); }catch(e){} return r; };
      window.renderSettings.__crystalToggle=true;
    } else { setTimeout(hookSettings,300); }
  }

  function injectBtn(){
    if(document.getElementById('hsnCrystalBtn')) return;
    ensureCSS();
    var btn=document.createElement('div'); btn.id='hsnCrystalBtn'; btn.title='我的钻石';
    btn.innerHTML='💎<span class="b"></span><span class="z">2x</span>';
    document.body.appendChild(btn);
    applyPos();              // 🔴v841 应用保存的拖动位置(无则 CSS 默认右下)
    initDrag(btn);           // 🔴v841 拖动+吸边; 点击(非拖动)弹菜单(原 click→open 改为菜单里的"我的钻石"项)
    refreshBadge();
    _crystalTimers.push(setInterval(refreshBadge, 60000));  // 每分钟刷新 buff 状态(到期自动熄灭)·🔴v841引用存起便于pagehide清理
    applyVisibility();       // 🔴v841 初始显隐(隐藏状态/是否在主页)
  }

  // ===== 包装 markAnswer(零侵入挂钩) =====
  function hook(){
    if(typeof window.markAnswer !== 'function'){ setTimeout(hook, 300); return; }
    if(window.markAnswer.__crystalWrapped){ return; }
    var orig = window.markAnswer;
    window.markAnswer = function(idx, correct){
      var r = orig.apply(this, arguments);
      try{ onAnswer(idx, correct); refreshBadge(); }catch(e){}
      return r;
    };
    window.markAnswer.__crystalWrapped = true;
  }

  // ===== 「记忆强化」buff(结晶加速) =====
  // 做日常/打Boss/连签里程碑等 → 激活一段时间的记忆强化, 期间隔天答对涨星翻倍 → 更快结晶。
  // buff 只影响"涨星速度", 不碰"一天只涨一次"的闸门 → 防刷依旧成立。
  function isBoosted(){ return Date.now() < (parseInt(lsGet('hsn_crystal_boost_until','0'),10)||0); }
  function boostLeftMin(){ var u=parseInt(lsGet('hsn_crystal_boost_until','0'),10)||0; return Math.max(0, Math.ceil((u-Date.now())/60000)); }
  function grantBoost(min, silent){
    min = Math.max(1, min|0);
    var now = Date.now();
    var cur = parseInt(lsGet('hsn_crystal_boost_until','0'),10)||0;
    var base = Math.max(now, cur);          // 叠加:在剩余时长基础上继续延长
    lsSet('hsn_crystal_boost_until', base + min*60000);
    if(!silent){ toast('⚡ 加速开始！'+min+' 分钟内记单词更快，快去答 💎', true); }
    try{ refreshBadge(); }catch(e){}
  }

  // ===== 对外接口 =====
  window.HansenCrystal = {
    open: open,
    stats: stats,
    gems: function(){ return lsInt('hsn_crystal_gems'); },
    mastered: function(){ return lsInt('hsn_crystal_total'); },
    grantBoost: grantBoost,      // 供其它机制调用:发"记忆强化"buff(分钟)
    isBoosted: isBoosted,
    boostLeftMin: boostLeftMin,
    _onAnswer: onAnswer   // 供测试
  };

  // ===== 启动 =====
  function boot(){ hook(); injectBtn(); hookSettings(); startWatch(); }  /* 🔴v841 +设置开关注入 +进游戏自动隐藏监听 */
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
