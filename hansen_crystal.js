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
  function lsSet(k,v){ try{var s=String(v);localStorage.setItem(k,s);return localStorage.getItem(k)===s;}catch(e){return false;} }
  function lsInt(k){ var n=parseInt(lsGet(k,'0'),10); return isFinite(n)?n:0; }

  // ===== v941: 19 岛 canonical 熟练度存档 =====
  // Land1~8 / 旧 SeasonN 都映射到 season 的同一 240 槽位，不能各发一次钻石。
  function HC(){ return window.HansenCanonical||null; }
  function currentRef(){
    try{ if(HC()) return HC().currentRef(); }catch(e){}
    return islandKey();
  }
  function currentMap(){
    var h=HC(), a=null;
    try{ if(h)a=h.resolve(currentRef()); }catch(e){}
    return a||{id:islandKey(),offset:0,length:(window.allW&&allW.length)||0,words:(window.allW&&allW.length)||0};
  }
  function canonicalKey(id){ return 'hsn_crystal_'+id; }
  function parseMap(key){
    try{ var o=JSON.parse(lsGet(key,'{}')); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }
    catch(e){ return {}; }
  }
  function canonicalWords(id){
    var h=HC(),n=0;
    try{if(h&&Array.isArray(h.islands))h.islands.some(function(i){if(i&&i.id===id){n=Number(i.words)||0;return true;}return false;});}catch(e){}
    return isFinite(n)&&n>0?Math.floor(n):0;
  }
  function validCrystalDay(v){
    if(v==='')return true;
    var m=typeof v==='string'&&v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return false;
    var y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d));
    return y>=2000&&y<=9999&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d;
  }
  function strictCanonicalRecord(rec){
    if(!rec||typeof rec!=='object'||Array.isArray(rec))return null;
    var lv=Object.prototype.hasOwnProperty.call(rec,'lv')?rec.lv:0;
    var p=Object.prototype.hasOwnProperty.call(rec,'p')?rec.p:0;
    var d=Object.prototype.hasOwnProperty.call(rec,'d')?rec.d:'';
    var done=Object.prototype.hasOwnProperty.call(rec,'done')?rec.done:0;
    if(typeof lv!=='number'||!isFinite(lv)||Math.floor(lv)!==lv||lv<0||lv>MAX_LV)return null;
    if(typeof p!=='number'||!isFinite(p)||Math.floor(p)!==p||p<0||p>=STAR_NEED)return null;
    if(typeof d!=='string'||!validCrystalDay(d))return null;
    if(done!==0&&done!==1&&done!==false&&done!==true)return null;
    done=(done===1||done===true)?1:0;
    // 已完成必须是真实的 5 星终态；不接受只伪造 done 的矛盾记录。
    if(done&&(lv!==MAX_LV||p!==0))return null;
    return {lv:lv,p:p,d:d,done:done};
  }
  function sanitizeCanonicalMap(id,map){
    var words=canonicalWords(id),out={},invalid=0,seen={};
    if(!map||typeof map!=='object'||Array.isArray(map)||words<=0)return {map:{},invalid:1};
    Object.keys(map).forEach(function(k){
      if(!/^(?:0|[1-9]\d*)$/.test(k)){invalid++;return;}
      var idx=Number(k);if(!isFinite(idx)||Math.floor(idx)!==idx||idx<0||idx>=words||seen[idx]){invalid++;return;}
      var rec=strictCanonicalRecord(map[k]);if(!rec){invalid++;return;}
      seen[idx]=1;out[idx]=rec;
    });
    return {map:out,invalid:invalid};
  }
  function mergeCanonicalMaps(a,b){
    var out={},k;Object.keys(a||{}).forEach(function(x){out[x]=a[x];});
    Object.keys(b||{}).forEach(function(x){k=String(x);out[k]=Object.prototype.hasOwnProperty.call(out,k)?stronger(out[k],b[k]):b[k];});
    return out;
  }
  function saveCanonicalMap(id,map,exactBackup){
    var key=canonicalKey(id),bak=key+'_bak',oldMain=null,oldBak=null;
    try{
      var checked=sanitizeCanonicalMap(id,map);if(checked.invalid)return false;map=checked.map;
      oldMain=localStorage.getItem(key);oldBak=localStorage.getItem(bak);var raw=JSON.stringify(map),oldObj=null;
      try{oldObj=JSON.parse(oldMain||'null');}catch(e){}
      var snapshot=exactBackup?raw:((oldObj&&typeof oldObj==='object'&&!Array.isArray(oldObj))?oldMain:raw);
      localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw new Error('crystal main verify failed');
      localStorage.setItem(bak,snapshot);if(localStorage.getItem(bak)!==snapshot)throw new Error('crystal backup verify failed');
      return true;
    }catch(e){
      try{if(oldMain===null)localStorage.removeItem(key);else localStorage.setItem(key,oldMain);}catch(_e){}
      try{if(oldBak===null)localStorage.removeItem(bak);else localStorage.setItem(bak,oldBak);}catch(_e){}
      return false;
    }
  }
  function stronger(a,b){
    // 一条熟练度记录是一个整体：低等级记录的 p/d 绝不能拼到高等级记录上。
    // 例如 canonical lv2/p0 + legacy lv1/p1 必须仍是 lv2/p0；否则旧进度会
    // 污染新等级，导致下一次答题提前升星。只有等级相同才合并同级进度。
    a=exactRecord(a); b=exactRecord(b);
    if(a.done||b.done)return {lv:MAX_LV,p:0,d:a.done?a.d:b.d,done:1};
    if(a.lv!==b.lv)return a.lv>b.lv?a:b;
    var out={lv:a.lv,p:Math.max(a.p,b.p),d:'',done:0};
    function dayValue(v){var m=String(v||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);return m?(+m[1]*10000+ +m[2]*100+ +m[3]):0;}
    out.d=dayValue(b.d)>dayValue(a.d)?String(b.d||''):String(a.d||'');
    return out;
  }
  function mergeInto(dst, idx, rec){
    var before=JSON.stringify(dst[idx]||{}), after=stronger(dst[idx],rec);
    dst[idx]=after; return before!==JSON.stringify(after);
  }
  function exactRecord(rec){
    rec=(rec&&typeof rec==='object')?rec:{};
    var out={
      lv:Math.max(0,Math.min(MAX_LV,Math.floor(Number(rec.lv)||0))),
      p:Math.max(0,Math.min(STAR_NEED-1,Math.floor(Number(rec.p)||0))),
      d:typeof rec.d==='string'?rec.d:'',
      done:(rec.done===1||rec.done===true)?1:0
    };
    if(out.done){out.lv=MAX_LV;out.p=0;}
    return out;
  }
  function sourceSig(raw){
    var h=2166136261,s=String(raw||'');
    for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return s.length+':'+(h>>>0).toString(16);
  }
  function awardGem(source,n){
    try{
      if(window.HansenGems&&typeof HansenGems.award==='function')return HansenGems.award(source,n);
      if(window.HansenGems&&typeof HansenGems.add==='function'){var before=HansenGems.get(),after=HansenGems.add(n);return after===before+n;}
    }catch(e){}
    return false;
  }
  function wordSource(id,idx){return 'crystal:word:'+String(id)+':'+String(idx);}
  var LEGACY_SEED_KEY='hansen_crystal_legacy_seed_v942',SEED_DONE_KEY='hansen_crystal_awards_seeded_v942';
  function legacySeedIds(h){
    var ids=[];
    if(h){
      h.islands.forEach(function(i){var m=loadCanonical(i.id);Object.keys(m).forEach(function(k){if(m[k]&&m[k].done)ids.push(wordSource(i.id,k));});});
      var ri=lsInt('hsn_crystal_rank');for(var r=1;r<=ri;r++)if(RANKS[r]&&RANKS[r].bonus>0)ids.push('crystal:rank:'+r);
      h.islands.forEach(function(i){if(lsGet('hsn_crystal_isldone_'+i.id,'')==='1')ids.push('crystal:island:'+i.id);});
    }
    return ids.filter(function(id,i,a){return a.indexOf(id)===i;}).sort();
  }
  // 首次 v942 boot 就固化“升级前已完成”的 source 边界，与钻石钱包是否已就绪无关。
  // 若边界写失败，boot 不挂答题 hook，防止这个窗口内的新完成被误当成历史已发。
  function captureLegacySeed(h){
    var raw=lsGet(LEGACY_SEED_KEY,''),o=null;
    if(raw){try{o=JSON.parse(raw);}catch(e){return null;}if(!o||o.schema!==1||!Array.isArray(o.ids))return null;return o.ids.filter(function(x){return typeof x==='string';});}
    var snap={schema:1,ids:legacySeedIds(h),createdAt:Date.now()};return lsSet(LEGACY_SEED_KEY,JSON.stringify(snap))?snap.ids:null;
  }
  // v942 首次启用幂等奖励账本时，把已经存在的完成/段位/全岛 flag 记为“历史已发”，
  // 防止升级本身把老玩家的全部奖励再发一遍。此后每个新 source 都可失败重试且绝不重复。
  function seedExistingAwards(h){
    if(lsGet(SEED_DONE_KEY,'')==='1')return true;
    var ids=captureLegacySeed(h);if(!ids)return false;
    if(!window.HansenGems||typeof HansenGems.seedAwards!=='function')return false;
    if(!HansenGems.seedAwards(ids))return false;
    return lsSet(SEED_DONE_KEY,'1');
  }
  function migrateCrystalMaps(){
    var h=HC(); if(!h)return;
    var merged={}, changed={},pendingByIsland={},ledger={};
    try{ledger=JSON.parse(lsGet('hansen_crystal_sources_v942','{}'))||{};}catch(e){ledger={};}
    h.islands.forEach(function(i){merged[i.id]=loadCanonical(i.id);});
    try{
      for(var n=0;n<localStorage.length;n++){
        var key=localStorage.key(n); if(!key||key.indexOf('hsn_crystal_')!==0)continue;
        var tail=key.slice('hsn_crystal_'.length);
        if(tail==='total'||tail==='gems'||tail==='rank'||tail.indexOf('boost_')===0||tail.indexOf('isldone_')===0)continue;
        var a=h.resolve(tail); if(!a)continue;
        // canonical 文件本身就是目的地；旧 island_/Land/Season 别名只在内容变化时迁移。
        // 这样旧记录里的 p=1 不会在新逻辑把 p 清零后，每次启动又被 max() 回灌。
        var raw=lsGet(key,'{}'), canonical=(key===canonicalKey(a.id));
        var sig=sourceSig(raw);
        if(!canonical&&ledger[key]===sig)continue;
        var src=parseMap(key), dst=merged[a.id];
        Object.keys(src).forEach(function(local){
          var rec=strictCanonicalRecord(src[local]);if(!rec)return;
          var ci=h.toCanonicalIndex(tail,local); if(ci>=0&&mergeInto(dst,ci,rec))changed[a.id]=1;
        });
        if(!canonical)(pendingByIsland[a.id]||(pendingByIsland[a.id]=[])).push([key,sig]);
      }
    }catch(e){}
    var nextLedger={};Object.keys(ledger).forEach(function(k){nextLedger[k]=ledger[k];});
    h.islands.forEach(function(i){
      var needsSave=!!changed[i.id]||lsGet(canonicalKey(i.id),'')==='',ok=!needsSave||saveCanonicalMap(i.id,merged[i.id],false);
      // 只有该 canonical map 已严格落盘，才提交它对应的 alias source sig。
      // map 成功而 ledger 失败也没关系：下次合并幂等，仍会重试 ledger。
      if(ok)(pendingByIsland[i.id]||[]).forEach(function(x){nextLedger[x[0]]=x[1];});
    });
    var ledgerOK=lsSet('hansen_crystal_sources_v942',JSON.stringify(nextLedger));
    // 旧完成标记折算：常规岛直接承认；星海总岛或八个 Land 都领过时承认。
    h.islands.forEach(function(i){
      var flag='hsn_crystal_isldone_'+i.id; if(lsGet(flag,'')==='1')return;
      if(lsGet('hsn_crystal_isldone_island_'+i.id,'')==='1')lsSet(flag,'1');
    });
    if(lsGet('hsn_crystal_isldone_season','')!=='1'){
      if(lsGet('hsn_crystal_isldone_island_season','')==='1') lsSet('hsn_crystal_isldone_season','1');
      else {
        var allLand=true,allLegacy=true;
        for(var li=1;li<=8;li++){
          if(lsGet('hsn_crystal_isldone_island_land'+li,'')!=='1'&&lsGet('hsn_crystal_isldone_land'+li,'')!=='1'){allLand=false;break;}
        }
        for(var si=1;si<=5;si++){
          if(lsGet('hsn_crystal_isldone_island_season'+si,'')!=='1'&&lsGet('hsn_crystal_isldone_season'+si,'')!=='1'){allLegacy=false;break;}
        }
        if(allLand||allLegacy)lsSet('hsn_crystal_isldone_season','1');
      }
    }
    if(ledgerOK)lsSet('hansen_crystal_migrated_v941','1');
    return ledgerOK;
  }
  function loadCanonical(id){
    var key=canonicalKey(id),raw=lsGet(key,''),bakRaw=lsGet(key+'_bak',''),o=null,b=null;
    try{o=JSON.parse(raw||'null');}catch(e){}try{b=JSON.parse(bakRaw||'null');}catch(e){b=null;}
    var mainRoot=!!(o&&typeof o==='object'&&!Array.isArray(o));
    var backupRoot=!!(b&&typeof b==='object'&&!Array.isArray(b));
    var main=mainRoot?sanitizeCanonicalMap(id,o):null,backup=backupRoot?sanitizeCanonicalMap(id,b):null;
    if(mainRoot){
      // 主档可能只截断一个槽位，并不一定全空。已有主槽位是当前代的精确状态
      // （p 在锁星后会从 1 合法回到 0），所以不能与旧备份取 max；只从上一份
      // 已知良好备份补齐“主档缺失且通过严格 schema”的槽位。
      var recovered={},changed=main.invalid>0;
      if(backupRoot)Object.keys(backup.map).forEach(function(k){recovered[k]=backup.map[k];});
      Object.keys(main.map).forEach(function(k){recovered[k]=main.map[k];});
      if(backupRoot)Object.keys(backup.map).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(main.map,k))changed=true;});
      if(changed){saveCanonicalMap(id,recovered,true);return recovered;}
      return main.map;
    }
    if(backupRoot){saveCanonicalMap(id,backup.map,true);return backup.map;}
    return {};
  }
  // 对页面继续提供 local idx；底层始终写 canonical idx。
  function loadM(){
    var h=HC(), a=currentMap();
    if(!h)return parseMap('hsn_crystal_'+islandKey());
    var full=loadCanonical(a.id), local={};
    Object.keys(full).forEach(function(ci){var li=h.fromCanonicalIndex(currentRef(),ci);if(li>=0)local[li]=full[ci];});
    return local;
  }
  function saveM(m){
    var h=HC(), a=currentMap();
    if(!h){try{var localRaw=JSON.stringify(m),localKey='hsn_crystal_'+islandKey();localStorage.setItem(localKey,localRaw);return localStorage.getItem(localKey)===localRaw;}catch(e){return false;}}
    var full=loadCanonical(a.id);
    // 当前页面内存是这个切片的最新事实，必须精确覆盖。尤其锁星后 p 从 1→0，
    // 若继续取 max，旧 p 会立刻回到 1，下一天只答一次就提前升星/发钻。
    Object.keys(m||{}).forEach(function(li){var ci=h.toCanonicalIndex(currentRef(),li);if(ci>=0)full[ci]=exactRecord(m[li]);});
    return saveCanonicalMap(a.id,full,false);
  }
  function snapshotCurrentSlice(){var a=currentMap();return {id:a.id,map:loadCanonical(a.id)};}
  function restoreSnapshot(s){return !!(s&&s.id&&s.map&&saveCanonicalMap(s.id,s.map,true));}
  function clearCurrentSlice(){
    var a=currentMap(),full=loadCanonical(a.id),changed=false;
    for(var i=a.offset;i<a.offset+a.length;i++)if(Object.prototype.hasOwnProperty.call(full,i)){delete full[i];changed=true;}
    return changed?saveCanonicalMap(a.id,full,true):true;
  }
  function canonicalDoneTotal(){
    var h=HC(); if(!h)return lsInt('hsn_crystal_total');
    var n=0;h.islands.forEach(function(i){var m=loadCanonical(i.id);Object.keys(m).forEach(function(k){if(m[k]&&m[k].done)n++;});});return n;
  }

  // 取单词文本(通知用)
  function wordEn(idx){
    try{ if(window.allW && allW[idx] && allW[idx].en) return allW[idx].en; }catch(e){}
    return '';
  }

  // ===== 结晶发钻(全局)·🔴v832 每永久掌握1词 = 直接发 GEM_PER_WORD 颗💎 =====
  function crystallize(idx){
    var total = HC() ? canonicalDoneTotal() : lsInt('hsn_crystal_total') + 1;
    lsSet('hsn_crystal_total', total);
    var a=currentMap(),ci=HC()?HC().toCanonicalIndex(currentRef(),idx):idx;
    var paid=awardGem(wordSource(a.id||islandKey(),ci),GEM_PER_WORD);
    if(paid)lsSet('hsn_crystal_gems',total*GEM_PER_WORD);   // 单词结晶累计展示（段位/全岛 bonus 不计入）
    var en = wordEn(idx);
    if(paid)toast('💎 记牢了'+(en?'「'+en+'」':'')+'！+'+GEM_PER_WORD+' 颗钻石', true);
    else toast('⚠️ 已记牢，钻石正在安全补发；请勿清理浏览器数据',true);
    try{ refreshBadge(); }catch(e){}
    try{ checkRankUp(total); }catch(e){}        //🔴v830 探险家段位晋升
    try{ checkIslandComplete(); }catch(e){}     //🔴v830 单岛全词永久掌握大奖
    return paid;
  }

  // ===== 🔴v830 探险家段位(按全部岛累计永久掌握词数) =====
  function rankIndexOf(total){ var i=0; for(var k=0;k<RANKS.length;k++){ if(total>=RANKS[k].need) i=k; } return i; }
  function curRank(){ return RANKS[rankIndexOf(lsInt('hsn_crystal_total'))]; }
  function nextRank(){ var i=rankIndexOf(lsInt('hsn_crystal_total')); return (i+1<RANKS.length)?RANKS[i+1]:null; }
  function checkRankUp(total){
    var ri=rankIndexOf(total), awarded=lsInt('hsn_crystal_rank');
    if(ri>awarded){
      var bonus=0,last=awarded;for(var k=awarded+1;k<=ri;k++){
        var b=RANKS[k].bonus||0;if(b>0&&!awardGem('crystal:rank:'+k,b))break;
        if(!lsSet('hsn_crystal_rank',k))break;last=k;bonus+=b;
      }
      if(last<=awarded)return false;
      setTimeout(function(){ toast('🏅 升到「'+RANKS[last].n+'」！'+(bonus>0?'奖 '+bonus+' 颗钻石 💎':''), true); }, 800);
      return last===ri;
    }
    return true;
  }
  // ===== 🔴v830 单岛全词永久掌握(一次性大奖) =====
  function checkIslandComplete(){
    var a=currentMap(), total=a.words||0;
    if(total<=0) return;
    var m=HC()?loadCanonical(a.id):loadM(), done=0; for(var k in m){ if(m.hasOwnProperty(k)&&m[k]&&m[k].done) done++; }
    if(done>=total){
      var flag='hsn_crystal_isldone_'+a.id;
      if(lsGet(flag,'')!=='1'){
        if(!awardGem('crystal:island:'+a.id,ISLAND_BONUS)||!lsSet(flag,'1'))return false;
        setTimeout(function(){ toast('🏝️ 这个岛的词全记牢了！多奖 '+ISLAND_BONUS+' 颗钻石 💎', true); }, 1600);
      }
    }
    return true;
  }

  // v941 迁移对账：旧存档已有的永久掌握不能只搬数据却漏掉段位/全岛奖励。
  // 先落账再发奖；每个 canonical 岛只有一个 flag，重复启动不会重复发。
  function reconcileCanonicalRewards(){
    migrateCrystalMaps();
    var h=HC();
    if(!h){ checkRankUp(lsInt('hsn_crystal_total')); checkIslandComplete(); return {mastered:lsInt('hsn_crystal_total'),islands:0,bonus:0}; }
    var total=canonicalDoneTotal(); lsSet('hsn_crystal_total',total);
    if(!captureLegacySeed(h))return {mastered:total,islands:0,bonus:0,pending:true,blocked:true};
    if(!seedExistingAwards(h))return {mastered:total,islands:0,bonus:0,pending:true};
    // done 已安全落图但钱包当时失败时，启动对账按稳定 source id 补发；重放只会 no-op。
    h.islands.forEach(function(i){var m=loadCanonical(i.id);Object.keys(m).forEach(function(k){if(m[k]&&m[k].done)awardGem(wordSource(i.id,k),GEM_PER_WORD);});});
    lsSet('hsn_crystal_gems',total*GEM_PER_WORD);
    try{checkRankUp(total);}catch(e){}
    var newly=0, bonus=0, walletReady=!!(window.HansenGems&&typeof HansenGems.award==='function');
    h.islands.forEach(function(i){
      var m=loadCanonical(i.id),done=0;
      Object.keys(m).forEach(function(k){if(m[k]&&m[k].done)done++;});
      if(done<i.words)return;
      var flag='hsn_crystal_isldone_'+i.id;
      if(lsGet(flag,'')==='1')return;
      // 钱包未加载时绝不先写“已发”，稍后 boot 重试，避免奖励永久丢失。
      if(!walletReady)return;
      if(awardGem('crystal:island:'+i.id,ISLAND_BONUS)&&lsSet(flag,'1')){newly++;bonus+=ISLAND_BONUS;}
    });
    if(newly>0)setTimeout(function(){toast('🏝️ 已对账 '+newly+' 座全词岛！补发 '+bonus+' 颗钻石 💎',true);},1000);
    return {mastered:total,islands:newly,bonus:bonus};
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
        if(w.lv >= MAX_LV){ w.done = 1; m[idx]=w;if(saveM(m))crystallize(idx);else toast('⚠️ 记忆进度未能保存，本次不发钻石，请检查存储空间',true);return; }
        m[idx]=w;if(saveM(m)!==false)floatMemo(idx,'lock',w.lv,gain);return;   // 🔴v833 只在真正锁定记忆星(稀少里程碑·一天每词一次)弹一下⭐·克制不刷屏
      }
      m[idx]=w; saveM(m);
      // 🔴v833 答对但未锁星(攒进度 / 今天这词已锁过)→ 不弹任何浮层。好反馈要克制:快节奏小游戏每次答对都弹会刷屏·孩子也来不及看·只把⭐留给锁星那一刻。
      return;
    }
    // 🔴v832 答错:不倒扣(鼓励大胆试错·只是这次不涨星)
    m[idx]=w; saveM(m);
  }

  // v946 探索页专用的 Spelling Bee 结晶结算。一次完整聚焦挑战
  // (机器人 <50 CPM 正确 10 次、50~79 正确 7 次、>=80 正确 5 次)才锁星。
  // 普通状态锁 1 星；已有“记忆强化”仍按旧权益锁 2 星，但绝不减少 5/7/10
  // 的挑战次数。结算不预存同日进度；同词同日最多结算一次。
  // 只能由下方 markAnswer wrapper 消费瞬时证明后调用。
  function onQualifiedSpelling(idx, proof){
    idx=Number(idx);
    if(!isFinite(idx)||Math.floor(idx)!==idx||idx<0)return {ok:false,reason:'invalid-index'};
    var m=loadM(),w=m[idx]||{lv:0,p:0,d:'',done:0};
    if(typeof w.p!=='number')w.p=0;
    if(w.done)return {ok:true,changed:false,reason:'done',level:MAX_LV};
    var t=today();
    if(w.d===t)return {ok:true,changed:false,reason:'locked-today',level:Math.max(0,Math.min(MAX_LV,w.lv|0))};
    var gain=isBoosted()?BOOST_STAR:1;
    w.lv=Math.min(MAX_LV,Math.max(0,w.lv|0)+gain);
    w.p=0;
    w.d=t;
    if(w.lv>=MAX_LV){
      w.done=1;
      m[idx]=w;
      if(saveM(m)){crystallize(idx);return {ok:true,changed:true,done:true,level:MAX_LV};}
      toast('⚠️ 记忆进度未能保存，本次不发钻石，请检查存储空间',true);
      return {ok:false,reason:'save-failed'};
    }
    m[idx]=w;
    if(saveM(m)===false)return {ok:false,reason:'save-failed'};
    floatMemo(idx,'lock',w.lv,gain);
    return {ok:true,changed:true,done:false,level:w.lv,gain:gain};
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
      html = '<b>⭐ '+(en||'单词')+' 记忆 +'+((p&&p>1)?p:1)+'</b><span class="s">'+stars+'</span>';
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

  // v945 探索页批量只读快照。结晶完成(done)只证明学习状态，绝不等同于
  // 钻石到账；到账必须由 HansenGems 的逐 source 奖励账本证明。整页只读一次
  // canonical 结晶图、一次奖励账本，避免 240 张卡片各自访问 localStorage。
  function rules(){
    return {maxLevel:MAX_LV,hitsPerStar:STAR_NEED,gemsPerWord:GEM_PER_WORD,boostStarGain:BOOST_STAR,dailyStarLocks:1};
  }
  function sliceProgress(ref){
    var h=HC(),requested=ref==null?currentRef():ref,a=null;
    try{a=h&&h.resolve(requested);}catch(e){a=null;}
    if(!h||!a)return {ok:false,reason:'canonical-unavailable',ref:String(requested||''),rules:rules(),items:[]};
    try{
      var raw=localStorage.getItem(canonicalKey(a.id)),bakRaw=localStorage.getItem(canonicalKey(a.id)+'_bak');
      function checked(value){
        if(value===null)return null;
        var parsed=null;try{parsed=JSON.parse(value);}catch(e){return false;}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return false;
        return sanitizeCanonicalMap(a.id,parsed).invalid===0;
      }
      var mainOK=checked(raw),bakOK=checked(bakRaw);
      if((raw!==null||bakRaw!==null)&&mainOK!==true&&bakOK!==true)return {ok:false,reason:'corrupt-store',ref:String(requested||''),id:a.id,rules:rules(),items:[]};
    }catch(e){return {ok:false,reason:'storage-unreadable',ref:String(requested||''),id:a.id,rules:rules(),items:[]};}
    var full=null;
    try{full=loadCanonical(a.id);}catch(e){return {ok:false,reason:'storage-unreadable',ref:String(requested||''),id:a.id,rules:rules(),items:[]};}
    if(!full||typeof full!=='object'||Array.isArray(full))return {ok:false,reason:'storage-unreadable',ref:String(requested||''),id:a.id,rules:rules(),items:[]};
    var nowDay=today(),boosted=isBoosted(),boostMinutes=boostLeftMin(),requests=[],items=[];
    for(var local=0;local<a.length;local++){
      var ci=a.offset+local,raw=Object.prototype.hasOwnProperty.call(full,ci)?full[ci]:null;
      var rec=raw?strictCanonicalRecord(raw):{lv:0,p:0,d:'',done:0};
      if(!rec)return {ok:false,reason:'invalid-record',ref:String(requested||''),id:a.id,canonicalIndex:ci,rules:rules(),items:[]};
      var source=wordSource(a.id,ci);
      if(rec.done)requests.push({id:source,amount:GEM_PER_WORD});
      items.push({
        localIndex:local,canonicalIndex:ci,slotId:a.id+':'+ci,
        lv:rec.lv,p:rec.p,d:rec.d,done:!!rec.done,
        lockedToday:rec.d===nowDay,boosted:boosted,boostMinutes:boostMinutes,
        rewardSource:source,reward:{state:rec.done?'checking':'not-earned',amount:null,at:null}
      });
    }
    var rewardMap={};
    try{
      if(requests.length&&window.HansenGems&&typeof HansenGems.awardStates==='function')rewardMap=HansenGems.awardStates(requests)||{};
    }catch(e){rewardMap={};}
    items.forEach(function(item){
      if(!item.done)return;
      var status=rewardMap[item.rewardSource];
      item.reward=(status&&typeof status==='object')?status:{state:'blocked',amount:null,at:null};
    });
    return {ok:true,ref:String(requested||''),id:a.id,offset:a.offset,length:a.length,words:a.words,rules:rules(),boosted:boosted,boostMinutes:boostMinutes,items:items};
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
    var islDone = lsGet('hsn_crystal_isldone_'+currentMap().id,'')==='1';
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
      var proof=null;
      try{
        if(correct && window.HansenSpellingProgressV946 &&
           typeof HansenSpellingProgressV946.consume==='function'){
          proof=HansenSpellingProgressV946.consume('crystal',+idx);
        }
      }catch(e){proof=null;}
      var r = orig.apply(this, arguments);
      try{
        if(proof){
          var qualified=onQualifiedSpelling(idx,proof);
          if(window.HansenSpellingProgressV946&&typeof HansenSpellingProgressV946.settle==='function')HansenSpellingProgressV946.settle(proof,qualified);
        }
        refreshBadge();
      }catch(e){}
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
    getRules:rules,
    sliceProgress:sliceProgress,
    reconcileCanonicalRewards: reconcileCanonicalRewards,
    clearCurrentSlice:clearCurrentSlice,
    snapshotCurrentSlice:snapshotCurrentSlice,
    restoreSnapshot:restoreSnapshot,
    _migrateCrystalMaps:migrateCrystalMaps,
    _captureLegacySeed:captureLegacySeed,
    _onAnswer: onAnswer   // 供测试
  };

  // ===== 启动 =====
  function boot(){
    try{
      var resetPending=typeof window.__hsnHasResetPending==='function'&&window.__hsnHasResetPending();
      if(resetPending){if(typeof window.__hsnResumeReset==='function')window.__hsnResumeReset(false);return;}
    }catch(e){}
    var result=reconcileCanonicalRewards();if(result&&result.blocked){setTimeout(boot,1000);return;}hook(); injectBtn(); hookSettings(); startWatch();
  }  /* v942 重置日志先续做；否则才迁移/对账并挂答题 */
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
