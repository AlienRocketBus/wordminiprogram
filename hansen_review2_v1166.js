/* hansen_review2_v1166.js — 复习系统 2.0 · 核心（纯逻辑 + 只读适配器，不碰页面）
 * ============================================================================
 * 设计见 攻坚笔记/review2/DESIGN.md，接线见 INTEGRATION.md。要点：
 *   · 一个英文拼写 = 一个复习项（orange 在色彩岛和食物岛，只复习一次，两岛同时记上）
 *   · 间隔照旧 1/2/4/7/15，盒 4 到期答对 = 毕业；复习里答错降一盒、明天再见
 *   · 掌握星 0–5 只看真实证据（哪几天答对过、能不能自己拼），不看「我认识了」
 *   · 进度只读现有账本；答题结果走现有账本接口写回，再把各岛旧存档同步成账本的样子
 *   · 金币和岛里复习用同一套收据（rvrw:*），同一件事在哪做都只付一次
 *   · 时间只从 now() 拿；一天按手机本地 0 点；手机时间往回拨不会倒退、不能重领
 * 自己只新增一个存储键 hansen_review2_v1166（+_bak）：答对的日子、自己拼对的日子、毕业日、每天分钟数。
 * ============================================================================ */
(function(root){
  'use strict';
  if(!root||root.HansenReview2)return;

  var VERSION=1166;
  var KEY='hansen_review2_v1166',BAK=KEY+'_bak';
  var GAP=[1,2,4,7,15],GRAD=5;                 // 和 hansen_review.js 同一套盒子
  var SESSION_MAX=12,PRACTICE_MAX=6,PATROL_IN_SESSION=3;
  var BACK_TOLERANCE=2;                         // 手机时间往回拨 ≤2 天：仍按见过的最晚日期算
  var FAR_DUE=30;                               // 到期日比今天晚 30 天以上 = 当时手机时间错了 → 今天到期
  var DAYS_KEEP=62,LOG_DAYS=8,MAX_ITEMS=2000,MAX_WRONG=1000000,CLEAR_MAX=9e15;
  var K_SINCE='hansen_review_wrong_since_v963',K_PATROL='hansen_review_patrol_v963',K_STREAK='hansen_review_streak_v963';
  var SINCE_MAX=600,PATROL_MAX=400,PATROL_GAP=30;
  var ISLAND_NAMES={action:'动作岛',adjective:'形容词岛',animal:'动物岛',body:'身体岛',city:'城市岛',clothes:'服装岛',
    color:'色彩数字岛',family:'家庭岛',food:'食物岛',home:'家居岛',job:'职业岛',nature:'自然岛',question:'疑问岛',
    school:'学校岛',sports:'运动岛',time:'时间岛',traffic:'交通岛',treasure:'百宝岛',season:'星海·单词大陆'};

  // ---------- 小工具 ----------
  function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function int(v,max){v=Number(v);if(!isFinite(v)||v<=0)return 0;v=Math.floor(v);return Math.min(v,max||MAX_WRONG);}
  function isObj(o){return !!(o&&typeof o==='object'&&!Array.isArray(o));}
  function text(v,max){return typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').slice(0,max):'';}
  function ls(){try{return root.localStorage||null;}catch(e){return null;}}
  function get(k){try{var s=ls();return s?s.getItem(k):null;}catch(e){return null;}}
  function set(k,v){try{var s=ls();if(!s)return false;s.setItem(k,v);return s.getItem(k)===v;}catch(e){return false;}}
  function parseObj(raw){if(raw===null||raw===undefined)return null;try{var o=JSON.parse(raw);return isObj(o)?o:null;}catch(e){return null;}}
  function lsKeys(){var out=[],s=ls();if(!s)return out;try{for(var i=0;i<s.length;i++){out.push(s.key(i));}}catch(e){}return out.filter(Boolean);}
  function normKey(en){return String(en==null?'':en).trim().toLowerCase().replace(/\s+/g,' ');}

  // ---------- 时间（测试可以拨钟） ----------
  var clockFn=null;
  function now(){var t;try{t=clockFn?Number(clockFn()):Date.now();}catch(e){t=Date.now();}return isFinite(t)?t:Date.now();}
  function pad(n){return (n<10?'0':'')+n;}
  function dayOfMs(ms){var d=new Date(ms);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  // 补零 / 不补零都认（结晶存的是 2026-7-5），统一成 YYYY-MM-DD；不是真日期就给空串
  function normDay(s){
    var m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s==null?'':s));if(!m)return '';
    var y=+m[1],mo=+m[2],d=+m[3];if(y<2000||y>2200||mo<1||mo>12||d<1||d>31)return '';
    var t=new Date(Date.UTC(y,mo-1,d));if(t.getUTCMonth()!==mo-1)return '';
    return y+'-'+pad(mo)+'-'+pad(d);
  }
  // 日期加减用公历日期算（UTC 日历），夏令时、时区都不会差一天
  function dayNum(s){s=normDay(s);if(!s)return NaN;return Math.round(Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/86400000);}
  function addDays(s,n){var k=dayNum(s);if(!isFinite(k))return '';var t=new Date((k+Math.floor(Number(n)||0))*86400000);return t.getUTCFullYear()+'-'+pad(t.getUTCMonth()+1)+'-'+pad(t.getUTCDate());}
  function diffDays(a,b){return dayNum(b)-dayNum(a);}   // b 比 a 晚几天
  function effectiveToday(real,hwm){
    real=normDay(real);hwm=normDay(hwm);
    if(!real)return hwm;if(!hwm)return real;
    var back=diffDays(real,hwm);
    if(back<=0)return real;
    return back<=BACK_TOLERANCE?hwm:real;           // 拨回去很多 = 以前的时间是错的，按真实日期
  }
  function clampDue(due,today){due=normDay(due);if(!due)return today;return diffDays(today,due)>FAR_DUE?today:due;}

  // ---------- 自己的小存档 ----------
  function blankStore(){return {v:1,hwm:'',lm:0,w:{},d:{}};}
  function cleanDays(a){
    var seen={},out=[];(Array.isArray(a)?a:[]).forEach(function(s){s=normDay(s);if(s&&!seen[s]){seen[s]=1;out.push(s);}});
    out.sort();return out.slice(-LOG_DAYS);
  }
  function cleanStore(o){
    var out=blankStore();if(!isObj(o))return out;
    out.hwm=normDay(o.hwm);out.lm=int(o.lm,1e12);
    var w=isObj(o.w)?o.w:{},n=0;
    Object.keys(w).forEach(function(k){
      if(n>=MAX_ITEMS||!isObj(w[k])||k!==normKey(k)||!k||k.length>64||k==='__proto__')return;
      var e=w[k];out.w[k]={c:cleanDays(e.c),s:cleanDays(e.s),x:normDay(e.x),g:normDay(e.g),n:int(e.n),k:int(e.k)};n++;
    });
    var d=isObj(o.d)?o.d:{};
    Object.keys(d).filter(function(k){return normDay(k)===k&&isObj(d[k]);}).sort().slice(-DAYS_KEEP).forEach(function(k){
      var e=d[k];out.d[k]={m:int(e.m,1440),q:int(e.q),k:int(e.k),s:int(e.s)};
    });
    return out;
  }
  var storeMemo={raw:undefined,obj:null};
  function readStore(){
    var raw=get(KEY);
    if(raw===storeMemo.raw&&storeMemo.obj)return storeMemo.obj;
    var o=parseObj(raw);if(!o||o.v!==1)o=parseObj(get(BAK));   // 主档坏了用上一份
    var clean=cleanStore(o&&o.v===1?o:null);storeMemo={raw:raw,obj:clean};
    return clean;
  }
  function storeCopy(){return JSON.parse(JSON.stringify(readStore()));}
  function writeStore(o){
    var raw=JSON.stringify(cleanStore(o)),old=get(KEY);
    if(!set(KEY,raw))return false;
    if(old!==null&&parseObj(old))set(BAK,old);else set(BAK,raw);
    storeMemo={raw:undefined,obj:null};
    return true;
  }
  function today(){
    var real=dayOfMs(now()),s=readStore(),t=effectiveToday(real,s.hwm);
    return t;
  }
  function touchDay(s,t){if(!s.hwm||t>s.hwm||diffDays(t,s.hwm)>BACK_TOLERANCE)s.hwm=t;if(!s.d[t])s.d[t]={m:0,q:0,k:0,s:0};return s.d[t];}

  // ---------- 只读适配器：账本、词表、结晶、v963 ----------
  function HC(){var h=root.HansenCanonical;return h&&typeof h.readRO==='function'&&Array.isArray(h.islands)?h:null;}
  function healthyRaw(raw){var o=parseObj(raw);return !!(o&&isObj(o.islands));}
  var healthMemo={m:undefined,b:undefined,ok:false};
  // 账本两份都坏了（不是「新孩子没有账本」）→ 不出题、不写，免得拿空账本覆盖
  function ledgerReadable(){
    var h=HC();if(!h)return false;
    var m=get(h.STORE_KEY),b=get(h.STORE_KEY+'_bak');
    if(m===healthMemo.m&&b===healthMemo.b)return healthMemo.ok;
    var ok=(m===null&&b===null)||healthyRaw(m)||healthyRaw(b);
    healthMemo={m:m,b:b,ok:ok};return ok;
  }
  function cleanWord(w){
    if(!isObj(w))return null;var en=text(w.en,64).trim();if(!en||!normKey(en))return null;
    return {en:en,cn:text(w.cn,80).trim(),pn:text(w.pn,64),emoji:text(w.emoji,20000)};
  }
  function islandWords(isl){
    var src=isl.id==='season'?root.HANSEN_REVIEW2_SEASON_WORDS:(root.HANSEN_VOCAB_ALL&&root.HANSEN_VOCAB_ALL[isl.saveKey]);
    var arr=new Array(isl.words),i;
    if(Array.isArray(src)&&src.length===isl.words)for(i=0;i<isl.words;i++)arr[i]=cleanWord(src[i]);   // 词数对不上整份不用
    // 当前页就是这个岛（或它的一段）：页面自己的 allW 才是槽位的真义，优先用它
    try{
      var h=HC(),a=h.resolve(h.currentRef()),W=root.allW;
      if(a&&a.id===isl.id&&Array.isArray(W)&&W.length===a.length)for(i=0;i<a.length;i++){var cw=cleanWord(W[i]);if(cw)arr[a.offset+i]=cw;}
    }catch(e){}
    return arr;
  }
  var catMemo=null;
  function catalog(){
    var h=HC();if(!h)return {ok:false,reason:'no-ledger',items:[],byKey:{},byIsland:{}};
    var ref='';try{ref=String(h.currentRef()||'');}catch(e){}
    var sig=[root.HANSEN_VOCAB_ALL,root.HANSEN_REVIEW2_SEASON_WORDS,root.allW,ref];
    if(catMemo&&catMemo.sig.every(function(v,i){return v===sig[i];}))return catMemo.cat;
    var items=[],byKey=Object.create(null),byIsland={};
    h.islands.forEach(function(isl){
      var arr=islandWords(isl);byIsland[isl.id]=[];
      for(var ci=0;ci<isl.words;ci++){
        var w=arr[ci];if(!w)continue;
        var k=normKey(w.en),it=byKey[k];
        if(!it){it={key:k,en:w.en,meanings:[],cn:'',pn:w.pn,emoji:w.emoji,members:[]};byKey[k]=it;items.push(it);}
        if(w.cn&&it.meanings.indexOf(w.cn)<0)it.meanings.push(w.cn);
        if(!it.pn&&w.pn)it.pn=w.pn;if(!it.emoji&&w.emoji)it.emoji=w.emoji;
        it.members.push({id:isl.id,ci:ci,slot:isl.id+':'+ci});
        if(byIsland[isl.id].indexOf(it)<0)byIsland[isl.id].push(it);
      }
    });
    items.forEach(function(it){it.cn=it.meanings.join(' / ');});
    var cat={ok:items.length>0,reason:items.length?'':'no-words',items:items,byKey:byKey,byIsland:byIsland};
    catMemo={sig:sig,cat:cat};return cat;
  }
  var crysMemo={};
  function crystalMap(id){
    var raw=get('hsn_crystal_'+id),memo=crysMemo[id];
    if(memo&&memo.raw===raw)return memo.map;
    var o=parseObj(raw)||parseObj(get('hsn_crystal_'+id+'_bak'))||{},map={};
    Object.keys(o).forEach(function(k){
      if(!/^(?:0|[1-9]\d{0,3})$/.test(k)||!isObj(o[k]))return;
      var r=o[k],lv=Math.min(5,int(r.lv,5)),p=int(r.p,1000);
      map[+k]={lv:lv,p:p,done:(r.done===1||r.done===true)&&lv===5};
    });
    crysMemo[id]={raw:raw,map:map};return map;
  }
  function readMap(k){return parseObj(get(k))||{};}
  function v963(){var r=root.HansenReviewRewardsV963;return r&&isObj(r._debug)?r:null;}

  // ---------- 一个复习项现在的样子 ----------
  function safePlan(v){
    if(!isObj(v))return null;var box=Number(v.box),due=normDay(v.due),last=v.last===''||v.last==null?'':normDay(v.last);
    if(!(box>=0&&box<=4&&Math.floor(box)===box)||!due||(v.last&&!last))return null;
    return {box:box,due:due,last:last};
  }
  function context(){
    var h=HC();if(!h)return {ok:false,reason:'no-ledger'};
    if(!ledgerReadable())return {ok:false,reason:'ledger-unreadable'};
    var st=null;try{st=h.readRO();}catch(e){st=null;}
    if(!st||!isObj(st.islands))return {ok:false,reason:'ledger-unreadable'};
    var cat=catalog();if(!cat.ok)return {ok:false,reason:cat.reason||'no-words'};
    var learnedSets={};
    return {ok:true,h:h,st:st,cat:cat,today:today(),r2:readStore(),patrol:readMap(K_PATROL),crystal:crystalMap,
      learned:function(id){if(!learnedSets[id]){var s={};((st.islands[id]||{}).learned||[]).forEach(function(i){s[i]=1;});learnedSets[id]=s;}return learnedSets[id];}};
  }
  function memberFacts(m,ctx){
    var p=ctx.st.islands[m.id]||{},ci=m.ci,cl=isObj(p.cleared)?p.cleared:{};
    var plan=safePlan(isObj(p.srs)?p.srs[ci]:null);
    var tomb=Number(isObj(cl.srs)?cl.srs[ci]:0)||0;
    var pr=ctx.patrol[m.slot],cr=ctx.crystal(m.id)[ci]||null;
    return {slot:m.slot,id:m.id,ci:ci,wrongs:int(isObj(p.wrongs)?p.wrongs[ci]:0),mc:int(isObj(p.mc)?p.mc[ci]:0),
      learned:!!ctx.learned(m.id)[ci],plan:plan,graduatedTomb:!plan&&tomb>0&&tomb<CLEAR_MAX,
      crystal:cr,patrol:isObj(pr)?{due:normDay(pr.due),stage:int(pr.stage,2)||1}:null};
  }
  function computeStars(ev){
    ev=ev||{};
    var D=Math.max(int(ev.crystalLv,5),ev.crystalDone?5:0,int(ev.boxMax,5),int(ev.r2Days,99),ev.graduated?5:0);
    var P=Math.max(int(ev.mc),int(ev.r2Spell,99));
    var A=D>0||P>0||int(ev.crystalP)>0;
    var s=0;if(A)s=1;if(D>=2)s=2;if(D>=3&&P>=1)s=3;if(D>=4&&P>=2)s=4;if(D>=5&&P>=3)s=5;
    var cap=5,w=int(ev.wrongs);
    if(w>=3)cap=1;else if(w>0)cap=2;                       // 正在错题本里：先别显示得太好
    else if(ev.inPlan)cap=int(ev.planBox,4)<=1?3:4;         // 还在复习计划里：毕业前最多 4 星
    return Math.min(s,cap);
  }
  var STAR_NAMES=['新词','见过','认识','会拼','记得牢','掌握了'];
  function view(it,ctx){
    var facts=it.members.map(function(m){return memberFacts(m,ctx);}),t=ctx.today;
    var plan=null,primary=null,virtual=false,wrongs=0,maxW=0,wslot=null,boxMax=0,inPlan=false;
    facts.forEach(function(f){
      wrongs+=f.wrongs;if(f.wrongs>maxW){maxW=f.wrongs;wslot=f;}
      if(!f.plan)return;inPlan=true;boxMax=Math.max(boxMax,f.plan.box);
      var due=clampDue(f.plan.due,t);
      if(!plan||due<plan.due||(due===plan.due&&f.plan.box<plan.box)){plan={box:f.plan.box,due:due,last:f.plan.last};primary=f;}
    });
    if(!plan&&wrongs>0){plan={box:0,due:t,last:''};virtual=true;primary=wslot;}   // 错题本里有、还没进计划 = 盒0今天到期
    if(!primary)primary=wslot||facts[0];
    var log=ctx.r2.w[it.key]||null,cl=0,cp=0,cd=false,mc=0,seen=false,grad=!!(log&&log.g),patrolDue=null;
    facts.forEach(function(f){
      if(f.crystal){cl=Math.max(cl,f.crystal.lv);cp=Math.max(cp,f.crystal.p);cd=cd||f.crystal.done;}
      mc=Math.max(mc,f.mc);if(f.learned)seen=true;if(f.graduatedTomb)grad=true;
      if(f.patrol){grad=true;if(!patrolDue&&f.patrol.due&&f.patrol.due<=t)patrolDue=f.slot;}
    });
    var ev={crystalLv:cl,crystalP:cp,crystalDone:cd,mc:mc,boxMax:boxMax,inPlan:inPlan,planBox:plan?plan.box:0,wrongs:wrongs,
      r2Days:log?log.c.length:0,r2Spell:log?log.s.length:0,graduated:grad};
    var stars=computeStars(ev);
    seen=seen||stars>0||inPlan||wrongs>0||!!(log&&log.n);
    return {key:it.key,item:it,facts:facts,plan:plan,virtual:virtual,primary:primary,wslot:wslot,wrongs:wrongs,
      due:!!plan&&plan.due<=t,overdue:plan?Math.max(0,diffDays(plan.due,t)):0,inPlan:inPlan,patrolDue:patrolDue,
      evidence:ev,stars:stars,starName:STAR_NAMES[stars],seen:seen,log:log,today:t};
  }
  function byPriority(a,b){
    return (b.wrongs-a.wrongs)||(a.plan.box-b.plan.box)||(b.overdue-a.overdue)||(a.key<b.key?-1:a.key>b.key?1:0);
  }
  function allViews(ctx){return ctx.cat.items.map(function(it){return view(it,ctx);});}

  // ---------- 排期：下一盒 ----------
  /* 答错：降一盒（同一天只降一次），而且今天还算到期 —— 不然「故意全答错」也能把今天的到期清零、领 +20。
     今天答错过（last=今天）的词再答对 = 「重新记住」：盒子不动、明天再见、不给钱（第二天到期答对才升盒）。 */
  function nextPlan(plan,correct,t){
    var e=plan?{box:Math.max(0,Math.min(4,int(plan.box,4))),due:clampDue(plan.due,t),last:normDay(plan.last)}:{box:0,due:t,last:''};
    if(correct){
      if(e.last===t){
        if(e.due<=t)return {change:'relearn',plan:{box:e.box,due:addDays(t,GAP[0]),last:t},gapDays:GAP[0]};
        return {change:'none',reason:'daily-lock',plan:e};                  // 同词每天最多升一次（和岛里同一条）
      }
      if(e.due>t)return {change:'none',reason:'not-due',plan:e};
      var nb=e.box+1;
      if(nb>=GRAD)return {change:'graduate',plan:null};
      return {change:'advance',plan:{box:nb,due:addDays(t,GAP[nb]),last:t},gapDays:GAP[nb]};
    }
    return {change:'demote',plan:{box:e.last===t?e.box:Math.max(0,e.box-1),due:t,last:t},gapDays:0};
  }

  // ---------- 确定性随机（同一天同一个词，题目一样，刷新换不了简单题） ----------
  function hash(s){s=String(s);var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){var a=hash(seed)||1;return function(){a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
  function shuffle(arr,r){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(r()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}

  // ---------- 题面 ----------
  // 要孩子自己想出英文的题，图上不能印着答案（v1165 __hsnQuizPic 同一规则）
  function quizPic(emoji){
    var e=String(emoji||'');
    if(e.indexOf('<')<0)return /[A-Za-z]/.test(e)?'':e;
    if(!safeMarkup(e))return '';
    if(e.indexOf('<svg')<0)return e.indexOf('<img')>=0?e:'';
    var out=e.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,function(t){return /[A-Za-z]/.test(t.replace(/<[^>]*>/g,''))?'':t;});
    return (out.match(/<(circle|rect|path|ellipse|line|polygon|polyline)\b/g)||[]).length>=3?out:'';
  }
  // 图标字段里的 <svg>/<img> 来自打包的词表；再挡一道：带脚本、事件、外链的一律不用
  function safeMarkup(e){
    e=String(e||'');if(e.indexOf('<')<0)return true;
    if(/<\s*(script|iframe|object|embed|foreignObject|style|link|meta)\b/i.test(e))return false;
    if(/\son[a-z]+\s*=/i.test(e)||/javascript:|data:text|xlink:href\s*=\s*["']?\s*(?!#)/i.test(e))return false;
    if(/<img\b/i.test(e)&&/\ssrc\s*=\s*["']?\s*(?:https?:)?\/\//i.test(e))return false;
    return /^\s*<(span|svg|img)\b/i.test(e);
  }
  function spellable(en){
    var s=normKey(en);if(!/^[a-z][a-z '\-.]*$/.test(s))return false;
    var n=s.replace(/[^a-z]/g,'').length;return n>=2&&n<=14;
  }
  function spellSlots(en){return normKey(en).split('').map(function(c){return /[a-z]/.test(c)?{letter:true}:{letter:false,ch:c};});}
  function spellTiles(en,r){
    var letters=normKey(en).replace(/[^a-z]/g,'').split(''),extra=[];
    if(letters.length<=8){
      var pool='abcdefghijklmnopqrstuvwxyz'.split('').filter(function(c){return letters.indexOf(c)<0;});
      extra=shuffle(pool,r).slice(0,2);
    }
    var all=letters.concat(extra),out=all;
    for(var t=0;t<6;t++){out=shuffle(all,r);if(out.join('')!==all.join('')||all.length<2)break;}
    return out;
  }
  function chooseMode(v,hist,r,total){
    var s=v.stars,pool=s<=1?['listen','picture']:(s===2?['picture','listen','spell']:['spell','listen']);
    if(v.kind==='patrol')pool=['spell','listen'];
    var hasPic=!!quizPic(v.item.emoji),canSpell=spellable(v.item.en),spellCap=Math.ceil(total/2);
    pool=pool.filter(function(m){return (m!=='picture'||hasPic)&&(m!=='spell'||(canSpell&&hist.spell<spellCap));});
    var n=hist.modes.length;
    if(n>=2&&hist.modes[n-1]===hist.modes[n-2]){var rep=hist.modes[n-1],alt=pool.filter(function(m){return m!==rep;});if(alt.length)pool=alt;}
    if(!pool.length)pool=['listen'];
    return pool[Math.floor(r()*pool.length)];
  }
  function distractors(v,cat,r,mode){
    var target=v.item,isl=target.members[0].id,picks=[],used={};used[target.key]=1;
    var tm=target.meanings,tpic=quizPic(target.emoji);
    function okCand(it){
      if(used[it.key]||!it.cn)return false;
      for(var i=0;i<it.meanings.length;i++)if(tm.indexOf(it.meanings[i])>=0)return false;   // 意思重叠的不能当干扰项
      for(var j=0;j<picks.length;j++)if(picks[j].cn===it.cn)return false;
      if(mode==='picture'&&tpic&&it.emoji===target.emoji)return false;
      return true;
    }
    [shuffle(cat.byIsland[isl]||[],r),shuffle(cat.items,r)].forEach(function(list){
      for(var i=0;i<list.length&&picks.length<3;i++){if(okCand(list[i])){picks.push(list[i]);used[list[i].key]=1;}}
    });
    return picks;
  }
  function makeQuestion(v,mode,ctx,seed,kind,retry){
    var r=rng(seed+'|'+mode+(retry?'|retry':'')),it=v.item;
    var q={id:hash(seed+mode+(retry?'r':''))+'',key:it.key,kind:kind,mode:mode,retry:!!retry,done:false,
      en:it.en,cn:it.cn,pn:it.pn,emoji:safeMarkup(it.emoji)?it.emoji:'',pic:quizPic(it.emoji),starsAtStart:v.stars};
    if(mode==='spell'){q.slots=spellSlots(it.en);q.tiles=spellTiles(it.en,r);}
    else{
      var opts=[it].concat(distractors(v,ctx.cat,r,mode));
      opts=shuffle(opts,r);
      // 听音题每个选项只写一个意思（orange 若写「橙色 / 橙子」，只有它带斜杠 = 送答案）
      q.options=opts.map(function(o){return {key:o.key,label:mode==='listen'?(o.meanings[Math.floor(r()*o.meanings.length)]||o.cn):o.en};});
      q.answerIndex=opts.indexOf(it);
    }
    return q;
  }

  // ---------- 今天的复习：挑词 ----------
  function overview(){
    var ctx=context();if(!ctx.ok)return {ok:false,reason:ctx.reason};
    var views=allViews(ctx),due=views.filter(function(v){return v.due;}).sort(byPriority);
    var patrol=v963()?views.filter(function(v){return !v.due&&!v.inPlan&&v.wrongs===0&&v.patrolDue;}):[];
    var size=Math.min(SESSION_MAX,due.length)+Math.min(PATROL_IN_SESSION,patrol.length,Math.max(0,SESSION_MAX-due.length));
    // 练一练：学过、没到期、还没满星、今天还没答对过的词，星星少的先练
    var practice=views.filter(function(v){return v.seen&&!v.due&&v.stars<5&&!(v.log&&v.log.c.indexOf(ctx.today)>=0);})
      .sort(function(a,b){return (a.stars-b.stars)||(b.wrongs-a.wrongs)||(a.key<b.key?-1:1);});
    return {ok:true,today:ctx.today,dueCount:due.length,patrolCount:patrol.length,sessionSize:size,practiceCount:Math.min(PRACTICE_MAX,practice.length),
      more:Math.max(0,due.length-SESSION_MAX),due:due,patrol:patrol,practice:practice,views:views,ctx:ctx};
  }
  function buildSession(opts){
    opts=opts||{};
    var ov=overview();if(!ov.ok)return {ok:false,reason:ov.reason};
    var ctx=ov.ctx,picked=[],kind=opts.practice?'practice':'daily';
    if(kind==='daily'){
      ov.due.slice(0,SESSION_MAX).forEach(function(v){v.kind='due';picked.push(v);});
      ov.patrol.slice(0,Math.max(0,Math.min(PATROL_IN_SESSION,SESSION_MAX-picked.length))).forEach(function(v){v.kind='patrol';picked.push(v);});
    }else{
      ov.practice.slice(0,PRACTICE_MAX).forEach(function(v){v.kind='practice';picked.push(v);});
    }
    var hist={modes:[],spell:0},queue=picked.map(function(v){
      var r=rng(ctx.today+'|'+v.key+'|mode'),mode=chooseMode(v,hist,r,picked.length);
      hist.modes.push(mode);if(mode==='spell')hist.spell++;
      return makeQuestion(v,mode,ctx,ctx.today+'|'+v.key,v.kind,false);
    });
    return {ok:true,id:ctx.today+':'+kind+':'+hash(picked.map(function(v){return v.key;}).join(',')),kind:kind,day:ctx.today,
      queue:queue,pos:0,total:queue.length,dueTotal:picked.filter(function(v){return v.kind==='due';}).length,
      more:kind==='daily'?ov.more:0,results:[],coins:0,startedAt:now(),finished:false};
  }

  // ---------- 写回账本（只走现有接口） ----------
  var lastRev=0;
  function resetPending(){try{return typeof root.__hsnHasResetPending==='function'&&!!root.__hsnHasResetPending();}catch(e){return true;}}
  function writable(){return !!HC()&&!root.__hsnStorageReadOnly&&!root.__hansenCanonicalReadFailed&&!resetPending()&&ledgerReadable();}
  function peerWindows(){
    var out=[],seen=[root];
    function add(w){try{if(!w||seen.indexOf(w)>=0)return;seen.push(w);void w.location.href;out.push(w);}catch(e){}}
    try{if(root.parent&&root.parent!==root){add(root.parent);for(var i=0;i<root.parent.frames.length;i++)add(root.parent.frames[i]);}}catch(e){}
    try{for(var j=0;j<root.frames.length;j++)add(root.frames[j]);}catch(e){}
    return out;
  }
  // 当前页和同源页面框里还没落盘的进度先并进账本，免得写完被它们的旧内存冲掉
  function flushPages(){
    try{HC().absorbCurrent();}catch(e){}
    peerWindows().forEach(function(w){try{if(w.HansenCanonical&&w.S)w.HansenCanonical.absorbCurrent();}catch(e){}});
  }
  // 账本合并旧存档时错题数「取大」：不把各岛旧存档同步成账本的样子，下次开岛会把刚减掉的错题加回来
  function syncSaves(touched){
    var h=HC(),cur='',curDone=false;
    try{var ca=h.resolve(h.currentRef());if(root.S&&ca&&touched[ca.id]){h.syncCurrent();curDone=true;cur=String(root.__hsnSaveKey||ca.saveKey||'');}}catch(e){}
    lsKeys().forEach(function(k){
      if(!/^wordIsland/.test(k)||/_bak$|_backup$|_tmp$/i.test(k)||(curDone&&k===cur))return;
      var a=null;try{a=h.resolve(k);}catch(e){}if(!a||!touched[a.id])return;
      var state=parseObj(get(k));if(!state||!Array.isArray(state.learned))return;
      try{h.syncState(k,state,true);}catch(e){}
    });
    peerWindows().forEach(function(w){
      try{var fh=w.HansenCanonical;if(!fh||!w.S)return;var fa=fh.resolve(fh.currentRef());if(fa&&touched[fa.id])fh.syncCurrent();}catch(e){}
    });
  }
  function tomb(p,field,ci,ts){if(!isObj(p.cleared))p.cleared={};if(!isObj(p.cleared[field]))p.cleared[field]={};if((Number(p.cleared[field][ci])||0)<ts)p.cleared[field][ci]=ts;}
  function writeLedger(v,np,wrongSlot){
    if(!writable())return false;
    flushPages();
    var h=HC(),store=null;try{store=h.read();}catch(e){store=null;}
    if(!store||!isObj(store.islands))return false;
    var ts=Math.max(Date.now(),lastRev+1),touched={};
    v.item.members.forEach(function(m){var p=store.islands[m.id],e=p&&isObj(p.srs)?p.srs[m.ci]:null;if(e&&Number(e.updatedAt)>=ts)ts=Number(e.updatedAt)+1;});
    lastRev=ts;
    var dec=np.change==='advance'||np.change==='graduate';
    v.item.members.forEach(function(m){
      var p=store.islands[m.id];if(!p)return;touched[m.id]=1;
      if(!isObj(p.wrongs))p.wrongs={};if(!isObj(p.srs))p.srs={};
      var ci=m.ci,w=int(p.wrongs[ci]);
      if(np.change==='graduate'){
        if(own(p.wrongs,ci)){delete p.wrongs[ci];tomb(p,'wrongs',ci,ts);}
        delete p.srs[ci];tomb(p,'srs',ci,ts);                       // 和 setSrs(null) 一样立墓碑
        return;
      }
      if(dec&&w>0){if(w>1)p.wrongs[ci]=w-1;else{delete p.wrongs[ci];tomb(p,'wrongs',ci,ts);}}   // 和 absorbAnswer 一样立墓碑
      if(wrongSlot===m.slot)p.wrongs[ci]=Math.min(MAX_WRONG,w+1);
      if(np.plan&&np.change!=='none')p.srs[ci]={box:np.plan.box,due:np.plan.due,last:np.plan.last,updatedAt:ts};
    });
    /* 主档和 _bak 写成同一份（账本自带的 exactBackup，清除进度也是这么写的）。
       为什么：账本读的时候会把主档和上一代 _bak 合并，错题数「取大」—— 错题从 2 减到 1（没到 0、没有墓碑）
       会在下一次读时被 _bak 里的 2 冲回去（岛里的 absorbAnswer 也有这个问题，见 REPORT.md）。 */
    var ok=false;try{ok=h.write(store,true)===true;}catch(e){ok=false;}
    if(!ok)return false;
    syncSaves(touched);
    set(KEY+'_bump',String(ts));   // 告诉别的标签页：账本被复习改过（界面模块监听它，重新同步岛页内存）
    return true;
  }

  // ---------- 奖励（和 v963 同一套收据，不新开钱包） ----------
  function coinsApi(){var c=root.HansenCoins;return c&&typeof c.award==='function'?c:null;}
  function hasAward(id){var c=coinsApi();try{return !!(c&&typeof c.hasAward==='function'&&c.hasAward(id));}catch(e){return false;}}
  function payOnce(id,n){
    var c=coinsApi();if(!c||hasAward(id))return false;
    try{return c.award(id,n)===true&&(typeof c.hasAward!=='function'||c.hasAward(id));}catch(e){return false;}
  }
  function sinceStamp(slot,t){
    var m=readMap(K_SINCE);m[slot]=t;var keys=Object.keys(m);
    if(keys.length>SINCE_MAX){keys.sort(function(a,b){return String(m[a]).localeCompare(String(m[b]));});for(var i=0;i<keys.length-SINCE_MAX;i++)delete m[keys[i]];}
    set(K_SINCE,JSON.stringify(m));
  }
  function sinceClear(slot){var m=readMap(K_SINCE);if(own(m,slot)){delete m[slot];set(K_SINCE,JSON.stringify(m));}}
  function gradEligible(slot,t){
    var rec=readMap(K_SINCE)[slot];
    if(typeof rec!=='string'||!/^\d{4}-\d{1,2}-\d{1,2}$/.test(rec))return true;   // 没建档的老错词：v963 同样放行
    return dayNum(rec)<dayNum(t);
  }
  function schedulePatrol(slot,t){
    var r=v963();
    if(r&&typeof r._debug.schedulePatrol==='function'){try{r._debug.schedulePatrol(slot,1);return;}catch(e){}}
    var m=readMap(K_PATROL);m[slot]={due:addDays(t,PATROL_GAP),stage:1};var keys=Object.keys(m);
    if(keys.length>PATROL_MAX){keys.sort(function(a,b){return dayNum(m[a]&&m[a].due)-dayNum(m[b]&&m[b].due);});for(var i=0;i<keys.length-PATROL_MAX;i++)delete m[keys[i]];}
    set(K_PATROL,JSON.stringify(m));
  }
  function payCorrection(slot,t){
    for(var ord=1;ord<=3;ord++){var id='rvrw:'+t+':'+slot+':c'+ord;if(hasAward(id))continue;return payOnce(id,2)?2:0;}
    return 0;
  }
  function payGraduation(slot,t,planned){
    if(!gradEligible(slot,t)){sinceClear(slot);return 0;}   // 当天错当天清：没有毕业金
    var got=0;
    if(payOnce('rvrw:'+t+':'+slot+':grad',15)){
      got=15;
      var since=readMap(K_SINCE)[slot];
      if(typeof since==='string'&&dayNum(since)<=dayNum(t)-30&&payOnce('rvrw:'+t+':'+slot+':oldgrad',15))got+=15;   // 30 天老大难（v963 同规则）
      if(!planned)schedulePatrol(slot,t);
    }
    sinceClear(slot);
    return got;
  }

  // ---------- 答题 ----------
  function current(session){return session&&session.queue?session.queue[session.pos]||null:null;}
  function judge(q,payload){
    payload=payload||{};
    if(q.mode==='spell')return normKey(payload.text)===normKey(q.en);
    return Number(payload.choice)===q.answerIndex;
  }
  function answer(session,payload){
    var q=current(session);if(!q||q.done||session.finished)return {ok:false,reason:'no-question'};
    var correct=judge(q,payload),hinted=!!(payload&&payload.hinted);
    var res=record(q,correct,hinted,session);
    q.done=true;session.pos++;res.correct=correct;res.question=q;
    session.results.push({key:q.key,mode:q.mode,kind:q.kind,retry:q.retry,correct:correct,hinted:hinted,coins:res.coins||0,
      starsBefore:res.starsBefore,starsAfter:res.starsAfter,change:res.change,saved:res.ok});
    if(res.coins)session.coins+=res.coins;
    if(!correct&&!q.retry){   // 本轮最后再考一次（不算数）
      var ctx=context();
      if(ctx.ok&&ctx.cat.byKey[q.key]){var v=view(ctx.cat.byKey[q.key],ctx);session.queue.push(makeQuestion(v,q.mode,ctx,session.day+'|'+q.key,q.kind,true));session.total=session.queue.length;}
    }
    res.finished=session.pos>=session.queue.length;
    return res;
  }
  function logAnswer(key,t,correct,spellProof,graduated){
    var s=storeCopy(),day=touchDay(s,t),e=s.w[key]||{c:[],s:[],x:'',g:'',n:0,k:0};
    e.n=int(e.n)+1;day.q++;
    if(correct){e.k=int(e.k)+1;day.k++;if(e.c.indexOf(t)<0)e.c.push(t);if(spellProof&&e.s.indexOf(t)<0)e.s.push(t);}
    else e.x=t;
    if(graduated)e.g=t;
    s.w[key]=e;return writeStore(s);
  }
  function record(q,correct,hinted,session){
    if(q.retry)return {ok:true,change:'retry',coins:0,starsBefore:q.starsAtStart,starsAfter:q.starsAtStart};   // 刚看过答案，不算数
    var ctx=context();if(!ctx.ok)return {ok:false,reason:ctx.reason,change:'none',coins:0};
    var it=ctx.cat.byKey[q.key];if(!it)return {ok:false,reason:'unknown-word',change:'none',coins:0};
    var v=view(it,ctx),t=ctx.today,np,wrongSlot='',coins=0;
    var isDue=q.kind==='due'&&v.due;                 // 只有「到期的词」答对才动计划
    if(correct)np=isDue?nextPlan(v.plan,true,t):{change:'none',reason:q.kind==='due'?'not-due':q.kind,plan:null};
    else{np=nextPlan(v.inPlan||v.virtual?v.plan:null,false,t);wrongSlot=(v.primary||v.facts[0]).slot;}
    var counted=np.change==='advance'||np.change==='graduate';   // 只有真升盒/毕业才扣错题、才给钱
    var beforeW={};v.facts.forEach(function(f){beforeW[f.slot]=f.wrongs;});
    var needWrite=np.change!=='none'||!!wrongSlot,ok=true;
    if(needWrite)ok=writeLedger(v,np,wrongSlot);
    if(!ok)return {ok:false,reason:'save-failed',change:'none',coins:0,starsBefore:v.stars,starsAfter:v.stars};
    var graduated=np.change==='graduate';
    if(!correct&&wrongSlot&&!beforeW[wrongSlot])sinceStamp(wrongSlot,t);   // 新错词建档（v963 隔天毕业规则要用）
    if(correct&&counted){
      var ws=v.wslot;
      if(ws&&ws.wrongs>0){
        coins+=payCorrection(ws.slot,t);
        var after=graduated?0:ws.wrongs-1;
        if(after===0){var g=payGraduation(ws.slot,t,!graduated);coins+=g;if(graduated&&!g)schedulePatrol(ws.slot,t);}
      }else if(graduated)schedulePatrol((v.primary||v.facts[0]).slot,t);
    }
    if(q.kind==='patrol'&&v.patrolDue){
      // 巡检的 +3 由 v963 自己发（同一张收据），这里只把到账的数记进本轮结果
      var r=v963(),pid='rvrw:'+t+':'+v.patrolDue+':patrol',had=hasAward(pid);
      try{if(r&&typeof r._debug.patrolOnAnswer==='function')r._debug.patrolOnAnswer(v.patrolDue,correct,q.en);}catch(e){}
      if(!had&&hasAward(pid))coins+=3;
    }
    logAnswer(q.key,t,correct,correct&&q.mode==='spell'&&!hinted,graduated);
    var ctx2=context(),v2=ctx2.ok&&ctx2.cat.byKey[q.key]?view(ctx2.cat.byKey[q.key],ctx2):v;
    return {ok:true,change:np.change,reason:np.reason||'',gapDays:np.gapDays||0,graduated:graduated,coins:coins,
      starsBefore:v.stars,starsAfter:v2.stars,plan:v2.plan,wrongs:v2.wrongs};
  }
  function finishSession(session){
    if(!session||session.finished)return session?session.summary:null;
    session.finished=true;
    var t=session.day,firsts=session.results.filter(function(r){return !r.retry;});
    var s=storeCopy();touchDay(s,t).s++;
    var mins=Math.max(1,Math.round((now()-session.startedAt)/60000));if(mins<=30)touchDay(s,t).m=Math.max(touchDay(s,t).m,mins);
    writeStore(s);
    var bonus=0,ov=overview();
    if(session.kind==='daily'&&session.dueTotal>0&&ov.ok&&ov.dueCount===0){
      var id='rvrw:'+t+':todaydone',had=hasAward(id),r=v963();
      if(r&&typeof r.refresh==='function'){try{r.refresh();}catch(e){}}         // v963 自己发 +20、打卡连击
      else if(payOnce(id,20))bonus=20;
      if(!had&&hasAward(id)&&!bonus)bonus=20;
    }
    session.coins+=bonus;
    var up=[];
    firsts.forEach(function(r){if(r.starsAfter>r.starsBefore&&up.indexOf(r.key)<0)up.push(r.key);});
    session.summary={reviewed:firsts.length,correct:firsts.filter(function(r){return r.correct;}).length,
      wrong:firsts.filter(function(r){return !r.correct;}).map(function(r){return r.key;}),
      coins:session.coins,bonus:bonus,starsUp:up,more:ov.ok?Math.max(0,ov.dueCount):0,unsaved:firsts.filter(function(r){return !r.saved;}).length};
    return session.summary;
  }

  // ---------- 学习分钟（同一分钟几个页面框都在数也只算一次） ----------
  function noteActive(ms){
    ms=Number(ms);if(!isFinite(ms))ms=now();
    var minute=Math.floor(ms/60000),s=readStore();
    if(minute<=s.lm&&minute>s.lm-2880)return false;            // 这一分钟算过了（往回拨一点点也不重算）
    s=storeCopy();s.lm=minute;var day=touchDay(s,effectiveToday(dayOfMs(ms),s.hwm));day.m=Math.min(1440,day.m+1);
    return writeStore(s);
  }

  // ---------- 给家长 / 老师 ----------
  function streakInfo(t){
    var s=readMap(K_STREAK),c=int(s.count),last=normDay(s.last);
    var live=!!last&&(last===t||last===addDays(t,-1));
    var chk=0;try{var C=root.HansenCheckin;if(C&&typeof C.getStreak==='function')chk=int(C.getStreak());}catch(e){}
    return {review:live?c:0,reviewedToday:last===t,checkin:chk};
  }
  function parentReport(){
    var ov=overview();if(!ov.ok)return {ok:false,reason:ov.reason};
    var t=ov.today,views=ov.views,counts=[0,0,0,0,0,0],seen=0,islands={};
    views.forEach(function(v){
      counts[v.stars]++;if(v.seen)seen++;
      v.item.members.forEach(function(m){var I=islands[m.id]||(islands[m.id]={id:m.id,name:ISLAND_NAMES[m.id]||m.id,words:0,seen:0,strong:0,mastered:0});
        I.words++;if(v.seen)I.seen++;if(v.stars>=3)I.strong++;if(v.stars===5)I.mastered++;});
    });
    var weak=views.filter(function(v){return v.seen&&v.stars<5;}).sort(function(a,b){
      return (b.wrongs-a.wrongs)||((a.inPlan?a.plan.box:9)-(b.inPlan?b.plan.box:9))||(a.stars-b.stars)||(a.key<b.key?-1:1);
    }).slice(0,10).map(function(v){return {key:v.key,en:v.item.en,cn:v.item.cn,stars:v.stars,wrongs:v.wrongs,
      islands:v.item.members.map(function(m){return ISLAND_NAMES[m.id]||m.id;}).filter(function(x,i,a){return a.indexOf(x)===i;})};});
    var weekAgo=addDays(t,-6),recent=views.filter(function(v){return v.stars>=3&&v.log&&v.log.c.length&&v.log.c[v.log.c.length-1]>=weekAgo;})
      .map(function(v){return {en:v.item.en,cn:v.item.cn,stars:v.stars};}).slice(0,10);
    var s=readStore(),days=[],week={m:0,q:0,k:0};
    for(var i=6;i>=0;i--){var d=addDays(t,-i),e=s.d[d]||{m:0,q:0,k:0,s:0};days.push({day:d,m:e.m,q:e.q,k:e.k,s:e.s});week.m+=e.m;week.q+=e.q;week.k+=e.k;}
    var tomorrow=addDays(t,1),dueTomorrow=views.filter(function(v){return !v.due&&v.plan&&v.plan.due===tomorrow;}).length;
    return {ok:true,today:t,totalWords:views.length,seen:seen,counts:counts,strong:counts[3]+counts[4]+counts[5],mastered:counts[5],
      weakest:weak,recent:recent,streak:streakInfo(t),days:days,week:week,todayMinutes:(s.d[t]||{m:0}).m,
      dueToday:ov.dueCount,dueTomorrow:dueTomorrow,
      islands:Object.keys(islands).map(function(k){return islands[k];})};
  }
  function wordStars(en){
    var ctx=context();if(!ctx.ok)return null;var it=ctx.cat.byKey[normKey(en)];if(!it)return null;
    var v=view(it,ctx);return {key:v.key,stars:v.stars,name:v.starName,due:v.due,plan:v.plan,wrongs:v.wrongs,evidence:v.evidence};
  }

  root.HansenReview2={
    VERSION:VERSION,KEY:KEY,GAP:GAP.slice(),SESSION_MAX:SESSION_MAX,STAR_NAMES:STAR_NAMES.slice(),ISLAND_NAMES:ISLAND_NAMES,
    today:today,overview:function(){var o=overview();if(!o.ok)return o;return {ok:true,today:o.today,dueCount:o.dueCount,patrolCount:o.patrolCount,sessionSize:o.sessionSize,practiceCount:o.practiceCount,more:o.more};},
    buildSession:buildSession,current:current,answer:answer,finishSession:finishSession,
    wordStars:wordStars,parentReport:parentReport,noteActive:noteActive,
    quizPic:quizPic,safeMarkup:safeMarkup,
    _setClock:function(fn){clockFn=typeof fn==='function'?fn:null;storeMemo={raw:undefined,obj:null};},
    _resetMemo:function(){storeMemo={raw:undefined,obj:null};catMemo=null;crysMemo={};healthMemo={m:undefined,b:undefined,ok:false};},
    _pure:{normDay:normDay,dayOfMs:dayOfMs,addDays:addDays,diffDays:diffDays,effectiveToday:effectiveToday,clampDue:clampDue,
      nextPlan:nextPlan,computeStars:computeStars,normKey:normKey,spellable:spellable,spellTiles:spellTiles,rng:rng,
      cleanStore:cleanStore,chooseMode:chooseMode,byPriority:byPriority},
    _debug:{catalog:catalog,context:context,view:function(en){var c=context();if(!c.ok)return null;var it=c.cat.byKey[normKey(en)];return it?view(it,c):null;},
      readStore:readStore,ledgerReadable:ledgerReadable,writable:writable}
  };
})(typeof window!=='undefined'?window:globalThis);
