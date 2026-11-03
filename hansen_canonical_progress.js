// hansen_canonical_progress.js v942 — 19 岛 / 952 词权威进度账本
// ============================================================================
// 18 个常规岛共有 712 个不同单词；星海终战共有 240 个不同单词。
// island_land1~8 只是这 240 个星海词的八个 30 词入口，不是八套新单词。
// 本模块把当前入口、旧 Season/Land 存档和旧结晶存档映射到同一 canonical slot，
// 从根上避免宠物、成就、结晶把星海词漏算或重复算。
//
// 数据策略：
//   * 老存档只做并集迁移，不删除、不清零；迁移可重复运行且结果不变。
//   * learned / mc / wrongs / srs 以 canonical slot 保存；别名入口打开时回填其可见切片。
//   * mc 与错误次数合并取 max，不把同一词在两个入口的计数相加。
//   * totalXP 是实际练习量，不属于“单词槽位”，仍由宠物系统按真实存档累计。
// ============================================================================
(function(root){
  'use strict';
  if(!root || root.__hansenCanonicalProgressLoaded) return;
  root.__hansenCanonicalProgressLoaded = true;

  // STORE_KEY 与公开 VERSION 保持 941，确保已发布账本/测试向后兼容；v942 只扩展字段。
  var VERSION = 941;
  var STORE_KEY = 'hansen_canonical_progress_v941';
  var STORE_BAK_KEY = STORE_KEY+'_bak';
  var MASTER_HITS = 3;
  var MAX_PROGRESS_COUNT = 1000000;
  function exactInteger(value,min,max){return typeof value==='number'&&isFinite(value)&&Math.floor(value)===value&&value>=min&&value<=max;}
  function canonicalIndexKey(key,limit){return /^(?:0|[1-9][0-9]*)$/.test(String(key))&&Number(key)<limit;}
  function safeProgressCount(value){return exactInteger(value,1,MAX_PROGRESS_COUNT)?value:0;}
  function safeClearStamp(value){return exactInteger(value,1,Number.MAX_SAFE_INTEGER||9007199254740991)?value:0;}
  function safeDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';}
  function safeRevision(value){return exactInteger(value,1,Number.MAX_SAFE_INTEGER||9007199254740991)?value:0;}
  function safeSrsEntry(value,fallbackUpdatedAt){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    var box=Number(value.box),due=safeDay(value.due),last=value.last===''?'':safeDay(value.last);
    if(!exactInteger(box,0,4)||!due||(value.last!==''&&!last))return null;
    var out={box:box,due:due,last:last},updatedAt=safeRevision(value.updatedAt)||safeRevision(fallbackUpdatedAt);
    if(updatedAt)out.updatedAt=updatedAt;
    return out;
  }
  function publicSrsEntry(value){
    var e=safeSrsEntry(value);return e?{box:e.box,due:e.due,last:e.last}:null;
  }
  function newerSrs(a,b){
    a=safeSrsEntry(a);b=safeSrsEntry(b);if(!a)return b;if(!b)return a;
    var ar=safeRevision(a.updatedAt),br=safeRevision(b.updatedAt);
    if(ar!==br)return ar>br?a:b;
    var al=a.last||'',bl=b.last||'';
    if(al!==bl)return al>bl?a:b;
    if(a.box!==b.box)return a.box>b.box?a:b;
    return a.due>=b.due?a:b;
  }
  var lastSrsRevision=0;
  function nextSrsRevision(){
    var now=Date.now();lastSrsRevision=Math.max(lastSrsRevision+1,safeRevision(now)||1);return lastSrsRevision;
  }

  // 顺序固定；start 是全库 0-based 全局槽位起点。
  var defs = [
    ['action',   'wordIslandVerbs',     67],
    ['adjective','wordIslandAdj',       51],
    ['animal',   'wordIslandAnimal',    42],
    ['body',     'wordIslandBody',      35],
    ['city',     'wordIslandCity',      30],
    ['clothes',  'wordIslandClothes',   30],
    ['color',    'wordIslandColorNum',  35],
    ['family',   'wordIslandFamily',    31],
    ['food',     'wordIslandFood',      56],
    ['home',     'wordIslandHouse',     35],
    ['job',      'wordIslandPeople',    30],
    ['nature',   'wordIslandNature',    40],
    ['question', 'wordIslandPronouns',  32],
    ['school',   'wordIslandSchool',    38],
    ['sports',   'wordIslandSports',    30],
    ['time',     'wordIslandTime',      40],
    ['traffic',  'wordIslandTransport', 30],
    ['treasure', 'wordIslandMisc',      60],
    ['season',   'wordIslandSeason',   240]
  ];
  var islands=[], byId={}, aliases={}, start=0;

  function addAlias(name, id, offset, length, saveKey){
    if(!name) return;
    aliases[String(name).toLowerCase()] = {
      id:id, offset:offset||0, length:length,
      saveKey:saveKey || byId[id].saveKey
    };
  }

  defs.forEach(function(d){
    var item={id:d[0], saveKey:d[1], words:d[2], start:start};
    item.file='island_'+item.id+'.html';
    islands.push(item); byId[item.id]=item; start+=item.words;
  });

  // canonical id / 文件名 / 正式存档键。
  islands.forEach(function(item){
    addAlias(item.id,item.id,0,item.words,item.saveKey);
    addAlias('island_'+item.id,item.id,0,item.words,item.saveKey);
    addAlias(item.file,item.id,0,item.words,item.saveKey);
    addAlias(item.saveKey,item.id,0,item.words,item.saveKey);
  });

  // 星海八岛 = season 的八个 30 词切片。
  for(var li=1;li<=8;li++){
    var off=(li-1)*30, landKey='wordIslandLand'+li;
    ['land'+li,'island_land'+li,'island_land'+li+'.html',landKey].forEach(function(a){
      addAlias(a,'season',off,30,landKey);
    });
  }
  // v871~v872 的旧五域确实是 40+40+40+60+60（不是当前 Land 的 8×30）。
  // 这里按历史真实边界迁移，避免 legacy season3 的第 0 词被错搬到 slot 60（应为 80）。
  [[1,0,40],[2,40,40],[3,80,40],[4,120,60],[5,180,60]].forEach(function(x){
    var n=x[0],oldKey='wordIslandSeason'+n;
    ['season'+n,'island_season'+n,'island_season'+n+'.html',oldKey].forEach(function(a){
      addAlias(a,'season',x[1],x[2],oldKey);
    });
  });
  // 更早版本曾把 240 词总岛写成 StarSea/SeasonMain。
  ['starsea','star_sea','seasonmain','wordislandstarsea','wordislandseasontotal'].forEach(function(a){
    addAlias(a,'season',0,240,'wordIslandSeason');
  });

  var REGULAR_WORDS = byId.season.start;
  var STAR_SEA_WORDS = byId.season.words;
  var TOTAL_WORDS = start;

  function cleanRef(ref){
    var s=String(ref==null?'':ref).replace(/\\/g,'/').split('/').pop();
    s=s.split('?')[0].split('#')[0];
    return s.toLowerCase();
  }
  function resolve(ref){
    var raw=cleanRef(ref), a=aliases[raw];
    if(!a && /\.html?$/.test(raw)) a=aliases[raw.replace(/\.html?$/,'')];
    if(!a && raw.indexOf('hsn_crystal_')===0){
      var tail=raw.slice('hsn_crystal_'.length);
      a=aliases[tail] || aliases[tail.replace(/^island_/,'')];
    }
    if(!a) return null;
    var base=byId[a.id];
    return {
      id:a.id, offset:a.offset, length:a.length, saveKey:a.saveKey,
      words:base.words, start:base.start, file:base.file,
      canonicalSaveKey:base.saveKey
    };
  }
  function currentRef(){
    try{ if(root.__hsnSaveKey) return root.__hsnSaveKey; }catch(e){}
    try{ return root.location && root.location.pathname || ''; }catch(e){ return ''; }
  }
  function toCanonicalIndex(ref, localIndex){
    var a=resolve(ref), n=Number(localIndex);
    if(!a || !isFinite(n)) return -1;
    n=Math.floor(n);
    if(n<0 || n>=a.length) return -1;
    return a.offset+n;
  }
  function fromCanonicalIndex(ref, canonicalIndex){
    var a=resolve(ref), n=Number(canonicalIndex);
    if(!a || !isFinite(n)) return -1;
    n=Math.floor(n)-a.offset;
    return n>=0 && n<a.length ? n : -1;
  }
  function slotId(ref, localIndex){
    var a=resolve(ref), i=toCanonicalIndex(ref,localIndex);
    return a && i>=0 ? a.id+':'+i : '';
  }

  function blankIsland(){
    // cleared 是权威账本的“删除水位”。旧 Season/Land 别名存档仍可能留着
    // 已清掉的 learned/wrongs；没有水位时 migrate() 的并集会把它们复活。
    // 每个槽位记录清除时间，只有更晚保存的真实学习才能重新加入。
    return {learned:[], mc:{}, wrongs:{}, srs:{}, cleared:{learned:{},mc:{},wrongs:{},srs:{}}};
  }
  function blankStore(){
    var o={version:VERSION,islands:{}};
    islands.forEach(function(i){ o.islands[i.id]=blankIsland(); });
    return o;
  }
  function safeParse(raw, fallback){
    try{ var o=JSON.parse(raw); return o && typeof o==='object' ? o : fallback; }
    catch(e){ return fallback; }
  }
  function normaliseStore(o){
    if(!o || typeof o!=='object') o=blankStore();
    if(!o.islands || typeof o.islands!=='object') o.islands={};
    islands.forEach(function(def){
      var p=o.islands[def.id];
      if(!p || typeof p!=='object') p=blankIsland();
      p.learned=Array.isArray(p.learned)?p.learned:[];
      p.mc=(p.mc&&typeof p.mc==='object'&&!Array.isArray(p.mc))?p.mc:{};
      p.wrongs=(p.wrongs&&typeof p.wrongs==='object'&&!Array.isArray(p.wrongs))?p.wrongs:{};
      p.srs=(p.srs&&typeof p.srs==='object'&&!Array.isArray(p.srs))?p.srs:{};
      p.cleared=(p.cleared&&typeof p.cleared==='object'&&!Array.isArray(p.cleared))?p.cleared:{};
      ['learned','mc','wrongs','srs'].forEach(function(field){
        if(!p.cleared[field]||typeof p.cleared[field]!=='object'||Array.isArray(p.cleared[field]))p.cleared[field]={};
      });
      o.islands[def.id]=p;
    });
    o.version=VERSION;
    return o;
  }
  function storeHasFacts(o){
    if(!o||!o.islands)return false;
    for(var i=0;i<islands.length;i++){
      var p=o.islands[islands[i].id];if(!p)continue;
      if((p.learned&&p.learned.length)||Object.keys(p.mc||{}).length||Object.keys(p.wrongs||{}).length||Object.keys(p.srs||{}).length)return true;
      var c=p.cleared||{};if(Object.keys(c.learned||{}).length||Object.keys(c.mc||{}).length||Object.keys(c.wrongs||{}).length||Object.keys(c.srs||{}).length)return true;
    }
    return false;
  }
  /* 主账本是当前代，_bak 是上一份已知良好代。正常清除会在主账本写入逐槽
     cleared 水位，因此“主档缺槽且没有水位”不能被解释成用户删除，更像一次
     截断写入。合并时主档水位阻止旧备份复活；未清除的计数保留两代较强值，
     已清除后重新学习的主档值则保持精确值，避免旧高计数穿过重置。 */
  function mergeCurrentWithPrevious(main,bak){
    var out=compactStore(normaliseStore(safeParse(JSON.stringify(main),blankStore())));
    islands.forEach(function(def){
      var cur=out.islands[def.id],prev=bak.islands[def.id],curLearned={},prevLearned={};
      cur.learned.forEach(function(i){curLearned[i]=1;});
      prev.learned.forEach(function(i){prevLearned[i]=1;});
      ['learned','mc','wrongs','srs'].forEach(function(field){
        var mergedClear={},a=cur.cleared[field]||{},b=prev.cleared[field]||{};
        Object.keys(a).concat(Object.keys(b)).forEach(function(k){var n=Math.max(Number(a[k])||0,Number(b[k])||0);if(n>0)mergedClear[k]=Math.floor(n);});
        cur.cleared[field]=mergedClear;
      });
      Object.keys(prevLearned).forEach(function(k){if(!curLearned[k]&&!cur.cleared.learned[k])curLearned[k]=1;});
      cur.learned=Object.keys(curLearned).map(Number).sort(function(a,b){return a-b;});
      ['mc','wrongs'].forEach(function(field){
        var current=cur[field]||{},previous=prev[field]||{},merged={};
        Object.keys(current).forEach(function(k){
          var now=Number(current[k])||0,old=Number(previous[k])||0;
          // 水位 + 当前事实表示清除后的重新学习，当前低值不能被旧备份抬高。
          merged[k]=cur.cleared[field][k]?now:Math.max(now,old);
        });
        Object.keys(previous).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(current,k)&&!cur.cleared[field][k])merged[k]=Number(previous[k])||0;});
        cur[field]=merged;
      });
      var currentSrs=cur.srs||{},previousSrs=prev.srs||{},mergedSrs={};
      // v1165: 复习计划不再跟着错题数走——错题本清零后词还在计划里，直到毕业。
      Object.keys(currentSrs).forEach(function(k){var e=safeSrsEntry(currentSrs[k]);if(e)mergedSrs[k]=e;});
      Object.keys(previousSrs).forEach(function(k){
        if(!Object.prototype.hasOwnProperty.call(mergedSrs,k)&&!cur.cleared.srs[k]){
          var e=safeSrsEntry(previousSrs[k]);if(e)mergedSrs[k]=e;
        }
      });
      cur.srs=mergedSrs;
    });
    return compactStore(out);
  }
  function readStore(){
    try{
      var mainRaw=root.localStorage.getItem(STORE_KEY),bakRaw=root.localStorage.getItem(STORE_BAK_KEY);
      var main=safeParse(mainRaw,null),bak=safeParse(bakRaw,null);
      root.__hansenCanonicalReadFailed=false;
      if(main&&main.islands){
        var mainSafe=compactStore(normaliseStore(main));
        if(bak&&bak.islands){
          var bakSafe=compactStore(normaliseStore(bak));
          var merged=mergeCurrentWithPrevious(mainSafe,bakSafe),mergedRaw=JSON.stringify(merged);
          // 即使主档不是全空，单岛/单字段被截断也要从 previous-good 补齐；明确
          // 清除过的槽位有 cleared 水位，不会被备份复活。
          if(mergedRaw!==JSON.stringify(mainSafe)){
            root.localStorage.setItem(STORE_KEY,mergedRaw);
            if(root.localStorage.getItem(STORE_KEY)!==mergedRaw)throw new Error('canonical partial-main recovery verify failed');
          }
          return merged;
        }
        return mainSafe;
      }
      if(bak&&bak.islands){
        var recovered=compactStore(normaliseStore(bak)),recoveredRaw2=JSON.stringify(recovered);
        root.localStorage.setItem(STORE_KEY,recoveredRaw2);if(root.localStorage.getItem(STORE_KEY)!==recoveredRaw2)throw new Error('canonical backup recovery verify failed');
        return recovered;
      }
      return blankStore();
    }catch(e){root.__hansenCanonicalReadFailed=true;return null;}
  }
  function uniqSorted(values, limit){
    var seen={}, out=[];
    (values||[]).forEach(function(v){
      var n=v;
      if(exactInteger(n,0,limit-1)&&!seen[n]){ seen[n]=1; out.push(n); }
    });
    return out.sort(function(a,b){return a-b;});
  }
  function compactStore(o){
    islands.forEach(function(def){
      var p=o.islands[def.id];
      p.learned=uniqSorted(p.learned,def.words);
      ['mc','wrongs'].forEach(function(field){
        var src=p[field], dst={};
        Object.keys(src||{}).forEach(function(k){
          if(!canonicalIndexKey(k,def.words))return;
          var i=Number(k),n=safeProgressCount(src[k]);
          if(n>0)dst[i]=n;
        });
        p[field]=dst;
      });
      var srs={};
      Object.keys(p.srs||{}).forEach(function(k){
        if(!canonicalIndexKey(k,def.words))return;
        var e=safeSrsEntry(p.srs[k]);if(e)srs[Number(k)]=e;
      });
      p.srs=srs;
      ['learned','mc','wrongs','srs'].forEach(function(field){
        var src=p.cleared[field], dst={};
        Object.keys(src||{}).forEach(function(k){
          if(!canonicalIndexKey(k,def.words))return;
          var i=Number(k),n=safeClearStamp(src[k]);
          if(n>0)dst[i]=n;
        });
        p.cleared[field]=dst;
      });
    });
    return o;
  }
  function writeStore(o, exactBackup){
    if(!o||root.__hansenCanonicalReadFailed)return false;
    o=compactStore(normaliseStore(o));
    var oldMain=null,oldBak=null;
    try{
      oldMain=root.localStorage.getItem(STORE_KEY);oldBak=root.localStorage.getItem(STORE_BAK_KEY);
      var raw=JSON.stringify(o),oldGood=safeParse(oldMain,null),snapshot=exactBackup?raw:((oldGood&&oldGood.islands)?oldMain:raw);
      root.localStorage.setItem(STORE_KEY,raw);if(root.localStorage.getItem(STORE_KEY)!==raw)throw new Error('canonical main verify failed');
      root.localStorage.setItem(STORE_BAK_KEY,snapshot);if(root.localStorage.getItem(STORE_BAK_KEY)!==snapshot)throw new Error('canonical backup verify failed');
      return true;
    }catch(e){
      try{if(oldMain===null)root.localStorage.removeItem(STORE_KEY);else root.localStorage.setItem(STORE_KEY,oldMain);}catch(_e){}
      try{if(oldBak===null)root.localStorage.removeItem(STORE_BAK_KEY);else root.localStorage.setItem(STORE_BAK_KEY,oldBak);}catch(_e){}
      return false;
    }
  }
  function mergeState(store, ref, state, authoritative){
    var a=resolve(ref);
    if(!a || !state || typeof state!=='object') return false;
    var p=store.islands[a.id], changed=false, learned={};
    var stampRaw=Number(state.lastSaveTime),stamp=isFinite(stampRaw)?Math.max(0,Math.floor(stampRaw)):0;
    function allowed(field,i){
      var cleared=Number(p.cleared&&p.cleared[field]&&p.cleared[field][i])||0;
      return !!authoritative || !cleared || stamp>cleared;
    }
    // 水位永久保留：新事实可以写入 canonical，但不能删水位，否则更老别名下一次又能回灌。
    function revive(){return;}
    p.learned.forEach(function(i){ learned[i]=1; });
    (Array.isArray(state.learned)?state.learned:[]).forEach(function(local){
      var i=toCanonicalIndex(ref,local);
      if(i>=0&&allowed('learned',i)&&!learned[i]){ learned[i]=1; p.learned.push(i); revive('learned',i); changed=true; }
    });
    ['mc','wrongs'].forEach(function(field){
      var src=(state[field]&&typeof state[field]==='object')?state[field]:{};
      Object.keys(src).forEach(function(local){
        if(!canonicalIndexKey(local,a.length))return;
        var i=toCanonicalIndex(ref,Number(local)),n=safeProgressCount(src[local]);
        if(i>=0&&n>0&&allowed(field,i)&&n>safeProgressCount(p[field][i])){ p[field][i]=n; revive(field,i); changed=true; }
      });
    });
    var localSrs=(state.srs&&typeof state.srs==='object'&&!Array.isArray(state.srs))?state.srs:{};
    Object.keys(localSrs).forEach(function(local){
      if(!canonicalIndexKey(local,a.length))return;
      var i=toCanonicalIndex(ref,Number(local)),publicEntry=publicSrsEntry(localSrs[local]);
      var e=publicEntry?safeSrsEntry(publicEntry,stamp):null;
      if(i<0||!e||!allowed('srs',i))return;
      var merged=newerSrs(p.srs[i],e);
      if(JSON.stringify(p.srs[i]||null)!==JSON.stringify(merged)){p.srs[i]=merged;changed=true;}
    });
    return changed;
  }
  function storageKeys(){
    var out=[];
    try{ for(var i=0;i<root.localStorage.length;i++) out.push(root.localStorage.key(i)); }catch(e){return null;}
    return out.filter(Boolean);
  }
  function refFromCrystalKey(key){
    if(String(key).indexOf('hsn_crystal_')!==0) return null;
    var tail=String(key).slice('hsn_crystal_'.length);
    if(tail==='total'||tail==='gems'||tail==='rank'||tail.indexOf('boost_')===0||tail.indexOf('isldone_')===0) return null;
    return resolve(tail);
  }
  function mergeDoneCrystals(store, key, map){
    var a=refFromCrystalKey(key); if(!a || !map || typeof map!=='object') return false;
    var p=store.islands[a.id], changed=false, learned={};
    p.learned.forEach(function(i){learned[i]=1;});
    Object.keys(map).forEach(function(local){
      var rec=map[local]; if(!rec||(rec.done!==1&&rec.done!==true)||Number(rec.lv)!==5||Number(rec.p)!==0) return;
      var i=toCanonicalIndex(key.slice('hsn_crystal_'.length),local); if(i<0) return;
      // 结晶旧表没有可靠保存时间；一旦该槽位被用户明确清除，就不能拿陈年 done 再复活。
      if(!p.cleared.learned[i]&&!learned[i]){ learned[i]=1; p.learned.push(i); changed=true; }
      if(!p.cleared.mc[i]&&(Number(p.mc[i])||0)<MASTER_HITS){ p.mc[i]=MASTER_HITS; changed=true; }
    });
    return changed;
  }

  // 每次启动都做并集合并；因此即使旧迁移标记存在，后来新增的 Land 存档也不会漏掉。
  function migrate(){
    var store=readStore(), changed=false,keys=storageKeys();
    if(!store||!keys)return {changed:false,store:null,error:'storage-read'};
    keys.forEach(function(key){
      if(/_bak$|_backup$|_tmp$/i.test(key)) return;
      if(refFromCrystalKey(key)){
        var crystal=safeParse(root.localStorage.getItem(key),null);
        if(mergeDoneCrystals(store,key,crystal)) changed=true;
        return;
      }
      var a=resolve(key);
      if(a){
        var state=safeParse(root.localStorage.getItem(key),null);
        if(mergeState(store,key,state)) changed=true;
        return;
      }
    });
    // 当前内存可能比 perf_boost 延迟写盘的新；始终优先并入。
    try{ if(root.S && mergeState(store,currentRef(),root.S)) changed=true; }catch(e){}
    if(!writeStore(store))return {changed:false,store:null,error:'storage-write'};
    try{ root.localStorage.setItem('hansen_canonical_migrated_v941','1'); }catch(e){}
    return {changed:changed,store:store};
  }

  function syncState(ref, state, persist){
    var a=resolve(ref), store=readStore();
    if(!a || !store || !state || typeof state!=='object') return false;
    var p=store.islands[a.id], changed=false;
    var learned=[];p.learned.forEach(function(ci){var li=fromCanonicalIndex(ref,ci);if(li>=0)learned.push(li);});
    learned=uniqSorted(learned,a.length);
    if(JSON.stringify(Array.isArray(state.learned)?state.learned:[])!==JSON.stringify(learned))changed=true;
    state.learned=learned;
    ['mc','wrongs'].forEach(function(field){
      var exact={};
      Object.keys(p[field]).forEach(function(ci){
        var li=fromCanonicalIndex(ref,ci), n=safeProgressCount(p[field][ci]);
        if(li>=0&&n>0)exact[li]=n;
      });
      if(JSON.stringify((state[field]&&typeof state[field]==='object'&&!Array.isArray(state[field]))?state[field]:{})!==JSON.stringify(exact))changed=true;
      state[field]=exact;
    });
    var exactSrs={},localSrs=(state.srs&&typeof state.srs==='object'&&!Array.isArray(state.srs))?state.srs:{};
    Object.keys(p.srs||{}).forEach(function(ci){
      var li=fromCanonicalIndex(ref,ci),e=publicSrsEntry(p.srs[ci]);
      if(li<0||!e)return;
      // rp=玩法里真答对过的证据(v963 毕业闸门要看)。账本格式不收它，只在本岛同一盒同一天时原样保留。
      var old=localSrs[li];
      if(old&&old.rp===1&&old.box===e.box&&old.due===e.due)e.rp=1;
      exactSrs[li]=e;
    });
    if(JSON.stringify((state.srs&&typeof state.srs==='object'&&!Array.isArray(state.srs))?state.srs:{})!==JSON.stringify(exactSrs))changed=true;
    state.srs=exactSrs;
    if(changed&&persist){
      try{
        var key=a.saveKey || currentRef();
        if(state===root.S&&typeof root.__hsnSaveNow==='function')root.__hsnSaveNow();
        else{
          var raw=JSON.stringify(state),old=root.localStorage.getItem(key),oldGood=safeParse(old,null);
          root.localStorage.setItem(key,raw);
          if(root.localStorage.getItem(key)===raw)root.localStorage.setItem(key+'_bak',oldGood?old:raw);
        }
      }catch(e){}
    }
    return changed;
  }
  function absorbCurrent(){
    try{
      if(!root.S) return false;
      var store=readStore();if(!store)return false;var changed=mergeState(store,currentRef(),root.S,true);
      if(changed&&!writeStore(store))return false;
      return changed;
    }catch(e){ return false; }
  }
  // 答题后的当前 slot 是最新事实：mc 单调增加，wrongs 则允许答对后下降/清零。
  function absorbAnswer(localIndex){
    try{
      var ref=currentRef(),a=resolve(ref),ci=toCanonicalIndex(ref,localIndex),state=root.S;
      if(!a||ci<0||!state)return false;
      var store=readStore();if(!store)return false;var p=store.islands[a.id],changed=false;
      if(Array.isArray(state.learned)&&state.learned.indexOf(Number(localIndex))>=0){
        if(p.learned.indexOf(ci)<0){p.learned.push(ci);changed=true;}
      }
      var mc=safeProgressCount(state.mc&&state.mc[localIndex]);
      if(mc>safeProgressCount(p.mc[ci])){p.mc[ci]=mc;changed=true;}
      var wrong=safeProgressCount(state.wrongs&&state.wrongs[localIndex]);
      if(wrong>0){
        if(wrong!==safeProgressCount(p.wrongs[ci])){p.wrongs[ci]=wrong;changed=true;}
      }else{
        if(Object.prototype.hasOwnProperty.call(p.wrongs,ci)){delete p.wrongs[ci];changed=true;}
        // 答对把错词降到 0 是一条权威删除，给旧别名存档立墓碑。
        // v1165: 只清错题本，不动复习计划——计划要等到期那天一次次答对、升满盒子才毕业。
        var ts=Date.now(); if((Number(p.cleared.wrongs[ci])||0)<ts){p.cleared.wrongs[ci]=ts;changed=true;}
      }
      if(changed&&!writeStore(store))return false;
      return changed;
    }catch(e){return false;}
  }
  function syncCurrent(){
    try{ return root.S ? syncState(currentRef(),root.S,true) : false; }
    catch(e){ return false; }
  }

  // 复习计划也必须按 canonical slot 写入。Land/Season 只是同一批词的别名入口，
  // 任一入口评分后另一入口立即看到同一 due/box；清错时同步立墓碑，旧存档不能复活。
  function setSrs(ref,localIndex,entry){
    var a=resolve(ref),ci=toCanonicalIndex(ref,localIndex),store=readStore();
    if(!a||ci<0||!store)return false;
    var p=store.islands[a.id],ts=nextSrsRevision(),publicEntry=entry===null?null:publicSrsEntry(entry);
    var e=entry===null?null:(publicEntry?safeSrsEntry(publicEntry,ts):null);
    if(entry!==null&&!e)return false;
    if(e){
      p.srs[ci]=e;   // v1165: 错题本清零后计划仍可升盒
    }else{
      delete p.srs[ci];
      if((Number(p.cleared.srs[ci])||0)<ts)p.cleared.srs[ci]=ts;
    }
    return writeStore(store);
  }
  function setCurrentSrs(localIndex,entry){return setSrs(currentRef(),localIndex,entry);}

  // 清除当前入口对应的 canonical 切片。Land1~8 只清自己的 30 词，
  // Season 总岛清 240 词；其它岛互不影响。墓碑防止旧别名存档下次启动回灌。
  function clearSlice(ref, fields){
    var a=resolve(ref), store=readStore(); if(!a||!store)return false;
    fields=Array.isArray(fields)?fields:['learned','mc','wrongs','srs'];
    // 永久删除水位不依赖客户端时钟；新学习只通过 authoritative absorbCurrent/Answer 恢复。
    var valid={learned:1,mc:1,wrongs:1,srs:1}, p=store.islands[a.id], ts=Number.MAX_SAFE_INTEGER||9007199254740991, changed=false;
    fields.forEach(function(field){
      if(!valid[field])return;
      for(var i=a.offset;i<a.offset+a.length;i++){
        if(field==='learned'){
          var at=p.learned.indexOf(i); if(at>=0){p.learned.splice(at,1);changed=true;}
        }else if(Object.prototype.hasOwnProperty.call(p[field],i)){
          delete p[field][i]; changed=true;
        }
        if((Number(p.cleared[field][i])||0)<ts){p.cleared[field][i]=ts;changed=true;}
        if(field==='wrongs'){
          if(Object.prototype.hasOwnProperty.call(p.srs,i)){delete p.srs[i];changed=true;}
          if((Number(p.cleared.srs[i])||0)<ts){p.cleared.srs[i]=ts;changed=true;}
        }
      }
    });
    // 破坏性清除必须让 main 与 backup 同时写入带墓碑的同一份快照；否则 main 损坏后
    // previous-good backup 会把刚清掉的旧 alias 进度复活。
    if(changed)return writeStore(store,true);
    return true;
  }
  function clearCurrent(fields){return clearSlice(currentRef(),fields);}

  function countLearned(id){var s=readStore();return s&&s.islands[id]?s.islands[id].learned.length:0;}
  function isLearned(ref,localIndex){
    var a=resolve(ref),i=toCanonicalIndex(ref,localIndex);if(!a||i<0)return false;
    var s=readStore();return !!(s&&s.islands[a.id]&&s.islands[a.id].learned.indexOf(i)>=0);
  }
  function mastery(ref,localIndex){
    var a=resolve(ref),i=toCanonicalIndex(ref,localIndex);if(!a||i<0)return 0;
    var s=readStore();return s&&s.islands[a.id]?safeProgressCount(s.islands[a.id].mc[i]):0;
  }
  function isMastered(ref,localIndex,hits){return mastery(ref,localIndex)>=Math.max(1,Math.floor(Number(hits)||MASTER_HITS));}
  function isCrystalDone(ref,localIndex){
    var a=resolve(ref),i=toCanonicalIndex(ref,localIndex);if(!a||i<0)return false;
    try{var m=safeParse(root.localStorage.getItem('hsn_crystal_'+a.id),{}),r=m[i];return !!(r&&(r.done===1||r.done===true)&&Number(r.lv)===5&&Number(r.p)===0);}catch(e){return false;}
  }
  function countMastered(id,hits){
    hits=Math.max(1,Math.floor(Number(hits)||MASTER_HITS));
    var s=readStore(),mc=s&&s.islands[id]?s.islands[id].mc:{},n=0;
    Object.keys(mc).forEach(function(k){if(safeProgressCount(mc[k])>=hits)n++;});
    return n;
  }
  function totalLearned(){
    var s=readStore(), n=0;if(!s)return 0;islands.forEach(function(i){n+=s.islands[i.id].learned.length;}); return n;
  }
  function totalMastered(hits){
    hits=Math.max(1,Math.floor(Number(hits)||MASTER_HITS));
    var s=readStore(), n=0;if(!s)return 0;
    islands.forEach(function(i){Object.keys(s.islands[i.id].mc).forEach(function(k){if(safeProgressCount(s.islands[i.id].mc[k])>=hits)n++;});});
    return n;
  }
  function counts(){
    var out={}; islands.forEach(function(i){out[i.id]={learned:countLearned(i.id),mastered:countMastered(i.id),words:i.words};}); return out;
  }
  // v945 探索页批量快照：一次 readStore() 返回当前入口全部可见词，避免卡片逐词
  // 调 mastery()/isLearned() 而把同一份大账本反复 JSON.parse。读取失败时明确
  // ok:false；调用方必须显示“状态暂不可读”，不能把未知状态伪装成 0/3。
  function sliceSnapshot(ref){
    ref=ref==null?currentRef():ref;
    var a=resolve(ref);
    if(!a)return {ok:false,reason:'invalid-ref',ref:String(ref||''),items:[]};
    // “从未创建账本”是合法的全零新玩家；“已有主/备但两份都坏了”则必须
    // fail closed。readStore() 的通用恢复会把后一种情况退成 blankStore，探索页
    // 若不预检就会误报 0/3。
    try{
      var mainRaw=root.localStorage.getItem(STORE_KEY),bakRaw=root.localStorage.getItem(STORE_BAK_KEY);
      function healthy(raw){var o=safeParse(raw,null);return !!(o&&o.islands&&typeof o.islands==='object'&&!Array.isArray(o.islands));}
      if((mainRaw!==null||bakRaw!==null)&&!healthy(mainRaw)&&!healthy(bakRaw))return {ok:false,reason:'corrupt-store',ref:String(ref||''),id:a.id,offset:a.offset,length:a.length,items:[]};
    }catch(e){return {ok:false,reason:'unreadable',ref:String(ref||''),id:a.id,offset:a.offset,length:a.length,items:[]};}
    var s=readStore();
    if(!s||!s.islands||!s.islands[a.id])return {ok:false,reason:'unreadable',ref:String(ref||''),id:a.id,offset:a.offset,length:a.length,items:[]};
    var p=s.islands[a.id],learned={};
    (p.learned||[]).forEach(function(i){learned[i]=1;});
    var items=[];
    for(var local=0;local<a.length;local++){
      var ci=a.offset+local,mc=safeProgressCount(p.mc&&p.mc[ci]);
      items.push({
        localIndex:local,
        canonicalIndex:ci,
        slotId:a.id+':'+ci,
        learned:!!learned[ci],
        mastery:mc,
        mastered:mc>=MASTER_HITS,
        wrongs:safeProgressCount(p.wrongs&&p.wrongs[ci])
      });
    }
    return {ok:true,ref:String(ref||''),id:a.id,offset:a.offset,length:a.length,words:a.words,masterHits:MASTER_HITS,items:items};
  }
  function allSaveAliases(){
    var seen={}, out=[];
    Object.keys(aliases).forEach(function(k){var sk=aliases[k].saveKey;if(/^wordIsland/.test(sk)&&!seen[sk]){seen[sk]=1;out.push(sk);}});
    return out;
  }

  function hookSave(){
    if(typeof root.save!=='function'||root.save.__hansenCanonical) return;
    var original=root.save;
    root.save=function(){
      var r=original.apply(this,arguments);
      try{ absorbCurrent(); }catch(e){}
      return r;
    };
    root.save.__hansenCanonical=true;
  }
  function hookAnswer(){
    if(typeof root.markAnswer!=='function'||root.markAnswer.__hansenCanonical) return;
    var original=root.markAnswer;
    root.markAnswer=function(){
      var r=original.apply(this,arguments);
      try{ absorbAnswer(arguments[0]); }catch(e){}
      return r;
    };
    root.markAnswer.__hansenCanonical=true;
  }
  function boot(){
    try{
      var resetPending=typeof root.__hsnHasResetPending==='function'&&root.__hsnHasResetPending();
      if(resetPending){if(typeof root.__hsnResumeReset==='function')root.__hsnResumeReset(false);return;}
      migrate(); syncCurrent(); hookSave(); hookAnswer();
    }catch(e){}
  }

  root.HansenCanonical = {
    VERSION:VERSION, STORE_KEY:STORE_KEY,
    REGULAR_WORDS:REGULAR_WORDS, STAR_SEA_WORDS:STAR_SEA_WORDS, TOTAL_WORDS:TOTAL_WORDS,
    islands:islands.map(function(i){return {id:i.id,saveKey:i.saveKey,file:i.file,words:i.words,start:i.start};}),
    resolve:resolve, currentRef:currentRef,
    toCanonicalIndex:toCanonicalIndex, fromCanonicalIndex:fromCanonicalIndex, slotId:slotId,
    migrate:migrate, syncState:syncState, syncCurrent:syncCurrent, absorbCurrent:absorbCurrent, absorbAnswer:absorbAnswer,
    clear:clearSlice, clearCurrent:clearCurrent,
    setSrs:setSrs, setCurrentSrs:setCurrentSrs,
    read:readStore, write:writeStore,
    snapshot:function(){return readStore();},restoreSnapshot:function(s){return writeStore(s,true);},
    isLearned:isLearned, mastery:mastery, isMastered:isMastered, isCrystalDone:isCrystalDone,
    countLearned:countLearned, countMastered:countMastered,
    totalLearned:totalLearned, totalMastered:totalMastered, counts:counts,
    sliceSnapshot:sliceSnapshot,
    allSaveAliases:allSaveAliases,
    _mergeState:mergeState, _blankStore:blankStore
  };

  if(root.document && root.document.readyState==='loading') root.document.addEventListener('DOMContentLoaded',boot);
  else boot();
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
