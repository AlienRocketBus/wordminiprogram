// hansen_spellbee_gems.js — v946 仅保留 v942 Spelling Bee 钻石账本的历史兼容与恢复
// 每天首次完整拼对“答题前尚未永久掌握”的 5/10/20 个词位，依次 +1/+2/+5💎。
// 去重单位是 canonical slot，不再只看英文文本；星海 8 岛与 240 词总岛的同一词位只算一次。
(function () {
  'use strict';
  var KEY = 'hansen_bee_gem_daily';
  var STATE_VERSION = 942, RECEIPT_SCHEMA = 1;
  var TIERS = [{n:5,gem:1},{n:10,gem:2},{n:20,gem:5}];

  function today() { var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function pageKey() {
    try { return (location.pathname.split('/').pop()||'index').replace(/\.html?$/i,'') || 'index'; }
    catch(e) { return 'index'; }
  }
  function normalizeWord(en) { return String(en||'').trim().toLowerCase(); }
  function plainObject(o) { return !!o && typeof o==='object' && !Array.isArray(o); }
  function exactKeys(o, names) {
    return plainObject(o) && Object.keys(o).sort().join(',')===names.slice().sort().join(',');
  }
  function validDay(day) { return /^\d{4}-\d{1,2}-\d{1,2}$/.test(String(day||'')); }
  function validReceiptId(id, day) {
    id=String(id||'');day=String(day||'');
    return validDay(day) && new RegExp('^sb:'+day.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+':\\d{1,12}$').test(id);
  }
  function fingerprint(r) {
    var src=[r.receiptId,r.day,r.createdAt,r.kind,r.word,r.index,r.ref,r.slot,r.canonicalId,r.canonicalIndex,
      r.learnedBefore?1:0,r.masteryBefore,r.crystalBefore?1:0,r.eligible?1:0].join('|'),h=2166136261;
    for(var i=0;i<src.length;i++){h^=src.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function canonicalDescriptor(ref, idx) {
    idx=Math.floor(+idx);ref=String(ref||'');
    if(!ref || ref.length>160 || !isFinite(idx) || idx<0) return null;
    try{
      var c=window.HansenCanonical;
      if(!c || typeof c.resolve!=='function' || typeof c.toCanonicalIndex!=='function' || typeof c.slotId!=='function') return null;
      var a=c.resolve(ref),ci=c.toCanonicalIndex(ref,idx),slot=resultSlot(c.slotId(ref,idx));
      if(!a || !/^[a-z][a-z0-9_-]{0,31}$/.test(String(a.id||'')) || !isFinite(ci) || Math.floor(ci)!==ci || ci<0 ||
         slot!==String(a.id)+':'+ci) return null;
      return {ref:ref,id:String(a.id),index:ci,slot:slot};
    }catch(e){return null;}
  }
  function canonicalProgress(r) {
    var d=canonicalDescriptor(r.ref,r.index);
    if(!d || d.id!==r.canonicalId || d.index!==r.canonicalIndex || d.slot!==r.slot) return null;
    try{
      var c=window.HansenCanonical,learned=false,mastery=0,crystal=false;
      if(typeof c.isLearned==='function') learned=c.isLearned(r.ref,r.index)===true;
      if(typeof c.mastery==='function') mastery=Math.max(0,Math.floor(+c.mastery(r.ref,r.index)||0));
      if(typeof c.isCrystalDone==='function') crystal=c.isCrystalDone(r.ref,r.index)===true;
      return {learned:learned,mastery:mastery,crystal:crystal};
    }catch(e){return null;}
  }
  function canonicalAdvanced(r) {
    var p=canonicalProgress(r);if(!p)return false;
    return (!r.learnedBefore&&p.learned) || p.mastery>r.masteryBefore || (!r.crystalBefore&&p.crystal);
  }
  function validateStoredReceipt(id,r) {
    if(!exactKeys(r,['schema','receiptId','day','createdAt','kind','word','index','ref','slot','canonicalId','canonicalIndex',
      'learnedBefore','masteryBefore','crystalBefore','eligible','status','fingerprint'])) return null;
    if(r.schema!==RECEIPT_SCHEMA || r.receiptId!==id || !validReceiptId(id,r.day) || r.day!==today() || r.kind!=='mastery') return null;
    if(r.status!=='prepared'&&r.status!=='committed')return null;
    if(typeof r.word!=='string'||!r.word||r.word!==normalizeWord(r.word)||r.word.length>120)return null;
    if(!isFinite(r.index)||Math.floor(r.index)!==r.index||r.index<0||r.index>9999)return null;
    if(!isFinite(r.createdAt)||Math.floor(r.createdAt)!==r.createdAt||r.createdAt<=0)return null;
    if(typeof r.learnedBefore!=='boolean'||typeof r.crystalBefore!=='boolean'||typeof r.eligible!=='boolean'||!isFinite(r.masteryBefore)||
       Math.floor(r.masteryBefore)!==r.masteryBefore||r.masteryBefore<0||r.masteryBefore>1000000)return null;
    var d=canonicalDescriptor(r.ref,r.index);
    if(!d||d.slot!==r.slot||d.id!==r.canonicalId||d.index!==r.canonicalIndex||r.fingerprint!==fingerprint(r))return null;
    return r;
  }
  function normalizeTiers(v) {
    if(!Array.isArray(v))return [];
    return v.map(function(n){return Math.floor(+n);}).filter(function(n,i,a){return TIERS.some(function(t){return t.n===n;})&&a.indexOf(n)===i;});
  }
  function blank() { return {version:STATE_VERSION,date:today(),receipts:{},grantedTiers:[]}; }
  function rawLoad() {
    var s=null;
    try { s=JSON.parse(localStorage.getItem(KEY)||'null'); } catch(e) {}
    if(!plainObject(s) || s.date!==today()) return blank();
    var out=blank();out.grantedTiers=normalizeTiers(s.grantedTiers);
    /* v941 的 words 只是可编辑字符串表，不能证明发生过 Bee 答题。升级时只保留“已发档位”
       以阻止旧用户重复领取，所有 words/legacy:/forged:* 一律不进入 v942 资格计数。 */
    if(s.version!==STATE_VERSION || !exactKeys(s,['version','date','receipts','grantedTiers']) || !plainObject(s.receipts)) return out;
    Object.keys(s.receipts).sort().forEach(function(id){
      var r=validateStoredReceipt(id,s.receipts[id]);
      /* 损坏与任意 forged:* key 都 fail-closed；同一槽位的后续真实答题收据仍需保留来幂等
         canonical mark，但 reconcile 会按唯一 eligible slot 计数。 */
      if(r)out.receipts[id]=r;
    });
    return out;
  }
  function save(s) {
    try { var raw=JSON.stringify(s);localStorage.setItem(KEY,raw);return localStorage.getItem(KEY)===raw; }
    catch(e) { return false; }
  }
  function tierId(s,t) { return 'bee:'+s.date+':tier:'+t.n; }
  function awardTier(s,t,newly) {
    if(s.grantedTiers.indexOf(t.n)>=0) return true;
    var gm=window.HansenGems;
    /* v942：钱包 source ID 才是最终幂等闸门。award 成功而日账保存失败时，
       下次 load 会以同一个 ID 重试，钱包只返回成功而不会再加一次。 */
    if(gm && typeof gm.award==='function') {
      var ok=false;try{ok=gm.award(tierId(s,t),t.gem)===true;}catch(e){ok=false;}
      if(!ok) return false;
      s.grantedTiers.push(t.n);
      if(!save(s)){s.grantedTiers=s.grantedTiers.filter(function(n){return n!==t.n;});return false;}
      newly.push({n:t.n,gem:t.gem});
      return true;
    }
    /* 只给尚未更新钱包脚本的 v941 缓存保留兼容路径：必须先保存 granted 再 add，
       所以旧环境至多沿用“可能少发”，绝不会因刷新重复发。v942 正式页总走 award。 */
    if(gm && typeof gm.add==='function') {
      s.grantedTiers.push(t.n);
      if(!save(s)){s.grantedTiers=s.grantedTiers.filter(function(n){return n!==t.n;});return false;}
      try{gm.add(t.gem);}catch(e2){}
      newly.push({n:t.n,gem:t.gem});
      return true;
    }
    return false;
  }
  function reconcile(s) {
    s=s||rawLoad();var slots={},count=0,newly=[];
    Object.keys(s.receipts||{}).forEach(function(id){var r=s.receipts[id];if(r.eligible&&r.status==='committed'&&canonicalAdvanced(r))slots[r.slot]=1;});
    count=Object.keys(slots).length;
    /* v941 当天已发档位先种进新钱包账本，升级当天不补发。seedAwards 本身幂等；
       即便临时失败，本地 granted 仍会阻止重复奖励，下一次 load 再种。 */
    try{
      if(s.grantedTiers.length&&window.HansenGems&&typeof HansenGems.seedAwards==='function')
        HansenGems.seedAwards(s.grantedTiers.map(function(n){return tierId(s,{n:n});}));
    }catch(e){}
    for(var i=0;i<TIERS.length;i++) {
      var t=TIERS[i];
      if(count>=t.n && s.grantedTiers.indexOf(t.n)<0 && !awardTier(s,t,newly)) break;
    }
    return {state:s,count:count,granted:newly};
  }
  function load() {
    var s=rawLoad();reconcile(s);return rawLoad();
  }
  function resultSlot(v) {
    if(typeof v==='string' && v) return v;
    if(v && typeof v==='object') return String(v.id||v.slot||v.key||v.canonicalId||'');
    return '';
  }
  function fallbackSlot(idx) {
    var page=pageKey();
    var m=page.match(/^island_land([1-8])$/);
    if(m) return 'season:' + (((+m[1]-1)*30)+idx);
    return page.replace(/^island_/,'') + ':' + idx;
  }
  function canonicalSlot(idx) {
    idx=Math.floor(+idx);
    if(!isFinite(idx)||idx<0) return '';
    /* 首选 v941 canonical progress 的正式 API；下面兼容开发期名称，便于旧缓存平滑升级。 */
    try {
      var c=window.HansenCanonical;
      if(c && typeof c.currentRef==='function' && typeof c.slotId==='function') {
        var ref=c.currentRef();
        var official=resultSlot(c.slotId(ref,idx));
        if(official) return official;
      }
      /* 兼容开发期 API 名称。 */
      c=window.HansenCanonicalProgress;
      if(c) {
        var names=['slotForCurrent','resolveCurrentSlot','canonicalSlot','slotFor'];
        for(var i=0;i<names.length;i++) {
          if(typeof c[names[i]]==='function') {
            var got=resultSlot(c[names[i]](idx, window.allW&&window.allW[idx]));
            if(got) return got;
          }
        }
      }
    } catch(e) {}
    return fallbackSlot(idx);
  }
  function readDone(storageKey, idx) {
    try {
      var m=JSON.parse(localStorage.getItem('hsn_crystal_'+storageKey)||'{}');
      return !!(m && m[idx] && m[idx].done);
    } catch(e) { return false; }
  }
  function isMastered(slot, idx) {
    try {
      var c=window.HansenCanonical;
      if(c && typeof c.currentRef==='function') {
        var ref=c.currentRef();
        /* 这里必须是结晶引擎 5 星永久 done；宠物 mastery(mc>=3) 不是同一语义。 */
        if(typeof c.isCrystalDone==='function' && c.isCrystalDone(ref,idx)===true) return true;
        if(typeof c.resolve==='function' && typeof c.toCanonicalIndex==='function') {
          var a=c.resolve(ref), ci=c.toCanonicalIndex(ref,idx);
          if(a && ci>=0 && readDone(a.id,ci)) return true;
        }
      }
      c=window.HansenCanonicalProgress;
      if(c) {
        var checks=['isMasteredSlot','isSlotDone','isMastered','isDone'];
        for(var i=0;i<checks.length;i++) {
          if(typeof c[checks[i]]==='function') {
            var r=c[checks[i]](slot, idx);
            if(r===true) return true;
            if(r===false) break;
          }
        }
      }
    } catch(e) {}
    /* 兼容尚未完成迁移的 v938 存档：当前物理页 + 星海 canonical 总岛双查。 */
    if(readDone(pageKey(),idx)) return true;
    var sm=String(slot||'').match(/^season:(\d+)$/);
    if(sm && readDone('island_season',+sm[1])) return true;
    return false;
  }
  function currentCanonicalRef() {
    try{var c=window.HansenCanonical;if(c&&typeof c.currentRef==='function')return String(c.currentRef()||'');}catch(e){}
    try{return String(location&&location.pathname||'');}catch(e2){return '';}
  }
  function prepare(en, idx) {
    en=normalizeWord(en); idx=Math.floor(+idx);
    if(!en || !isFinite(idx) || idx<0 || !window.allW || idx>=window.allW.length) return null;
    if(normalizeWord((window.allW[idx]||{}).en)!==en) return null;
    var ref=currentCanonicalRef(),d=canonicalDescriptor(ref,idx);
    if(!d || canonicalSlot(idx)!==d.slot) return null;
    var probe={ref:ref,index:idx,canonicalId:d.id,canonicalIndex:d.index,slot:d.slot},p=canonicalProgress(probe);
    if(!p)return null;
    var crystal=isMastered(d.slot,idx);
    return {version:STATE_VERSION,date:today(),word:en,index:idx,ref:ref,slot:d.slot,canonicalId:d.id,canonicalIndex:d.index,
      newBefore:!crystal,learnedBefore:p.learned,masteryBefore:p.mastery,crystalBefore:crystal};
  }
  function validSnapshot(s) {
    if(!exactKeys(s,['version','date','word','index','ref','slot','canonicalId','canonicalIndex','newBefore',
      'learnedBefore','masteryBefore','crystalBefore']) || s.version!==STATE_VERSION || s.date!==today())return null;
    if(typeof s.newBefore!=='boolean'||typeof s.learnedBefore!=='boolean'||typeof s.crystalBefore!=='boolean'||s.newBefore===s.crystalBefore)return null;
    var en=normalizeWord(s.word),idx=Math.floor(+s.index),d=canonicalDescriptor(s.ref,idx);
    if(!en||en!==s.word||!isFinite(idx)||idx<0||!window.allW||idx>=window.allW.length||
       normalizeWord((window.allW[idx]||{}).en)!==en||!d||d.slot!==s.slot||d.id!==s.canonicalId||d.index!==s.canonicalIndex||
       !isFinite(s.masteryBefore)||Math.floor(s.masteryBefore)!==s.masteryBefore||s.masteryBefore<0)return null;
    return s;
  }
  function validMasteryReceipt(r) {
    if(!exactKeys(r,['schema','rewardId','day','coins','xp','kind','word','index','createdAt'])||r.schema!==1||
       !validReceiptId(r.rewardId,r.day)||r.day!==today()||r.kind!=='mastery'||r.coins!==0||r.xp!==0)return null;
    if(typeof r.word!=='string'||!r.word||r.word!==normalizeWord(r.word)||r.word.length>120||
       !isFinite(r.index)||Math.floor(r.index)!==r.index||r.index<0||r.index>9999||
       !isFinite(r.createdAt)||Math.floor(r.createdAt)!==r.createdAt||r.createdAt<=0)return null;
    return r;
  }
  function sameReceipt(stored, incoming) {
    return stored.receiptId===incoming.rewardId&&stored.day===incoming.day&&stored.createdAt===incoming.createdAt&&stored.kind===incoming.kind&&
      stored.word===incoming.word&&stored.index===incoming.index;
  }
  function begin(snapshot, receipt) {
    receipt=validMasteryReceipt(receipt);if(!receipt)return {ok:false,skipped:'invalid_receipt'};
    var s=load(),old=s.receipts[receipt.rewardId];
    if(old){
      if(!sameReceipt(old,receipt))return {ok:false,skipped:'receipt_mismatch'};
      return {ok:true,receiptId:old.receiptId,committed:old.status==='committed',needsMark:old.status==='prepared'&&!canonicalAdvanced(old),eligible:old.eligible};
    }
    snapshot=validSnapshot(snapshot);if(!snapshot)return {ok:false,skipped:'invalid_snapshot'};
    if(snapshot.date!==receipt.day||snapshot.word!==receipt.word||snapshot.index!==receipt.index)return {ok:false,skipped:'receipt_mismatch'};
    var eligible=snapshot.newBefore===true;
    Object.keys(s.receipts).forEach(function(id){if(s.receipts[id].slot===snapshot.slot&&s.receipts[id].eligible)eligible=false;});
    var stored={schema:RECEIPT_SCHEMA,receiptId:receipt.rewardId,day:receipt.day,createdAt:receipt.createdAt,kind:'mastery',word:snapshot.word,index:snapshot.index,
      ref:snapshot.ref,slot:snapshot.slot,canonicalId:snapshot.canonicalId,canonicalIndex:snapshot.canonicalIndex,
      learnedBefore:snapshot.learnedBefore,masteryBefore:snapshot.masteryBefore,crystalBefore:snapshot.crystalBefore,
      eligible:eligible,status:'prepared',fingerprint:''};
    stored.fingerprint=fingerprint(stored);s.receipts[stored.receiptId]=stored;
    /* prepare 必须先于 markAnswer 落盘。若页面在两步之间退出，reload 会比较 canonical 水位，
       未前进才重做 mark；已前进则直接 commit，避免重复累计掌握度。 */
    if(!save(s))return {ok:false,skipped:'storage_failed'};
    return {ok:true,receiptId:stored.receiptId,committed:false,needsMark:!canonicalAdvanced(stored),eligible:eligible};
  }
  function commit(receiptId) {
    receiptId=String(receiptId||'');var s=load(),r=s.receipts[receiptId];
    if(!r)return {ok:false,skipped:'missing_receipt'};
    if(r.status==='committed')return {ok:true,committed:true,duplicate:true,count:reconcile(s).count,granted:[]};
    if(!canonicalAdvanced(r))return {ok:false,skipped:'canonical_unconfirmed'};
    r.status='committed';
    if(!save(s)){r.status='prepared';return {ok:false,skipped:'storage_failed'};}
    var rr=reconcile(s),granted=rr.granted;
    if(granted.length){try{showTierToast(granted,rr.count);}catch(e){}}
    return {ok:true,committed:true,count:rr.count,granted:granted,slot:r.slot,eligible:r.eligible};
  }
  function record(snapshot,receipt) {
    /* 兼容“答题后一次调用”的内部接口；新父页使用 begin→markAnswer→commit 消除崩溃窗口。 */
    var b=begin(snapshot,receipt);if(!b.ok||b.committed)return b;
    if(b.needsMark)return {ok:false,skipped:'canonical_unconfirmed',receiptId:b.receiptId};
    return commit(b.receiptId);
  }
  function hasReceipt(id) {
    id=String(id||'');return !!rawLoad().receipts[id];
  }
  function showTierToast(granted,count) {
    var total=0; for(var i=0;i<granted.length;i++) total+=granted[i].gem;
    var d=document.createElement('div');
    d.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:99998;'
      +'background:linear-gradient(135deg,rgba(88,28,135,.95),rgba(30,58,138,.95));border:1.5px solid #c4b5fd;'
      +'border-radius:14px;padding:12px 18px;color:#e9d5ff;font-size:14px;font-weight:800;'
      +'box-shadow:0 6px 24px rgba(139,92,246,.4);animation:hsbgIn .35s ease;text-align:center';
    d.innerHTML='💎 历史 Bee 里程碑补发 +<b style="font-size:20px;color:#fff">'+total+'</b> 钻石!'
      +'<div style="font-size:11.5px;font-weight:600;color:#c4b5fd;margin-top:3px">今日已首次拼对 '+count+' 个新词位</div>';
    if(!document.getElementById('hsbgAnim')) {
      var st=document.createElement('style'); st.id='hsbgAnim';
      st.textContent='@keyframes hsbgIn{from{opacity:0;transform:translate(-50%,-16px)}to{opacity:1;transform:translate(-50%,0)}}'
        +'@keyframes hsbgOut{from{opacity:1}to{opacity:0;transform:translate(-50%,-8px)}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(d);
    setTimeout(function(){ d.style.animation='hsbgOut .4s ease forwards'; setTimeout(function(){ d.remove(); },400); },2400);
  }

  window.HansenSpellbeeGems={
    prepare:prepare,
    begin:begin,
    commit:commit,
    record:record,
    hasReceipt:hasReceipt,
    status:function(){var s=load(),rr=reconcile(s);return {count:rr.count,granted:s.grantedTiers||[],nextTier:TIERS.filter(function(t){return s.grantedTiers.indexOf(t.n)<0;})[0]||null,capReached:(s.grantedTiers||[]).length===TIERS.length};},
    tiers:function(){return TIERS.slice();},
    canonicalSlot:canonicalSlot,
    _test:{fallbackSlot:fallbackSlot,isMastered:isMastered,load:load,rawLoad:rawLoad,reconcile:reconcile,
      validStoredReceipt:validateStoredReceipt,canonicalAdvanced:canonicalAdvanced,fingerprint:fingerprint}
  };
  /* 页面加载也主动恢复：record/status 之外，单纯重开页面同样会重试钱包 pending。 */
  try{setTimeout(function(){try{load();}catch(e){}},0);}catch(e){}
})();
