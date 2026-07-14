/* hansen_crystal.js v941 — canonical 知识结晶引擎 */
(function(){
  'use strict';
  if(window.__hansenCrystalLoadedV941) return;
  window.__hansenCrystalLoadedV941=true;

  var MAX_LV=5, STAR_NEED=2, GEM_PER_WORD=4, BOOST_STAR=2, ISLAND_BONUS=50;
  var STATE_KEY='hansen_crystal_state_v941';
  var BOOST_KEY='hansen_crystal_boost_until';
  var RANKS=[
    {n:'新手探险家',need:0,bonus:0},
    {n:'熟练探险家',need:30,bonus:20},
    {n:'高手探险家',need:100,bonus:40},
    {n:'大师探险家',need:250,bonus:80},
    {n:'大神探险家',need:500,bonus:150},
    {n:'传奇探险家',need:800,bonus:300}
  ];

  function C(){ return window.HansenCanonical||null; }
  function today(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
  function readJson(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:d;}catch(e){return d;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
  function lsInt(k){try{var n=parseInt(localStorage.getItem(k)||'0',10);return isFinite(n)?n:0;}catch(e){return 0;}}
  function state(){
    var s=readJson(STATE_KEY,{version:941,slots:{},paid:{},rankPaid:null,islandPaid:{}});
    if(!s.slots)s.slots={};if(!s.paid)s.paid={};if(!s.islandPaid)s.islandPaid={};
    if(s.rankPaid===null||s.rankPaid===undefined)s.rankPaid=Math.max(0,lsInt('hsn_crystal_rank'));
    s.version=941;return s;
  }
  function save(s){return writeJson(STATE_KEY,s);}
  function gemAdd(n){
    n=Math.max(0,Math.floor(Number(n)||0));if(!n)return 0;
    try{if(window.HansenGems&&typeof HansenGems.add==='function')HansenGems.add(n);}catch(e){}
    try{localStorage.setItem('hsn_crystal_gems',String(lsInt('hsn_crystal_gems')+n));}catch(e){}
    try{
      if(window.HansenAch&&typeof HansenAch.unlock==='function')HansenAch.unlock('gem1');
      else if(typeof window.checkAch==='function')window.checkAch();
    }catch(e){}
    return n;
  }
  function isBoosted(){try{return Number(localStorage.getItem(BOOST_KEY)||0)>Date.now();}catch(e){return false;}}
  function boostLeftMin(){try{return Math.max(0,Math.ceil((Number(localStorage.getItem(BOOST_KEY)||0)-Date.now())/60000));}catch(e){return 0;}}
  function grantBoost(minutes,silent){
    minutes=Math.max(0,Math.floor(Number(minutes)||0));if(!minutes)return 0;
    var now=Date.now(), old=0;try{old=Number(localStorage.getItem(BOOST_KEY)||0)||0;}catch(e){}
    var until=Math.max(now,old)+minutes*60000;
    try{localStorage.setItem(BOOST_KEY,String(until));}catch(e){}
    if(!silent)toast('⚡ 记忆强化 +'+minutes+' 分钟');
    refreshBadge();return until;
  }
  function rankIndex(total){var r=0;for(var i=0;i<RANKS.length;i++)if(total>=RANKS[i].need)r=i;return r;}
  function doneCount(s){var n=0;Object.keys(s.slots).forEach(function(k){if(s.slots[k]&&s.slots[k].done)n++;});return n;}

  function legacyMapKey(page){return 'hsn_crystal_'+page;}
  function migrateLegacy(){
    var c=C();if(!c)return state();
    var s=state(), changed=false;
    Object.keys(c.pages).forEach(function(page){
      var pg=c.pages[page], old=readJson(legacyMapKey(page),{});
      Object.keys(old).forEach(function(k){
        var r=c.resolve(Number(k),page), w=old[k];if(!r||!w)return;
        var cur=s.slots[r.slot]||{lv:0,p:0,d:'',done:0};
        var lv=Math.max(0,Math.min(MAX_LV,Number(w.lv)||0));
        if(lv>(cur.lv||0)){cur.lv=lv;changed=true;}
        if((Number(w.p)||0)>(cur.p||0)){cur.p=Number(w.p)||0;changed=true;}
        if(w.d&&(!cur.d||String(w.d)>String(cur.d))){cur.d=w.d;changed=true;}
        if(w.done&&!cur.done){cur.done=1;cur.lv=MAX_LV;changed=true;}
        if(cur.done&&!s.paid[r.slot]){s.paid[r.slot]=1;changed=true;}
        s.slots[r.slot]=cur;
      });
    });
    Object.keys(c.groups).forEach(function(id){
      var p=c.pages['island_'+id];
      var oldFlag=p?'hsn_crystal_isldone_'+p.page:'hsn_crystal_isldone_island_'+id;
      try{if(localStorage.getItem(oldFlag)==='1'&&!s.islandPaid[id]){s.islandPaid[id]=1;changed=true;}}catch(e){}
    });
    if(changed||!localStorage.getItem('hansen_crystal_migrated_v941')){
      save(s);try{localStorage.setItem('hansen_crystal_migrated_v941','1');}catch(e){}
    }
    return s;
  }

  function reconcile(){
    var c=C();if(!c)return;
    var s=migrateLegacy(), total=doneCount(s), changed=false, payments=[];
    var ri=rankIndex(total);
    if(ri>(s.rankPaid||0)){
      var rb=0;for(var i=(s.rankPaid||0)+1;i<=ri;i++)rb+=RANKS[i].bonus;
      s.rankPaid=ri;changed=true;if(rb)payments.push({n:rb,msg:'🏅 '+RANKS[ri].n+' 段位奖励'});
    }
    Object.keys(c.groups).forEach(function(id){
      if(s.islandPaid[id])return;
      var slots=c.slotsForGroup(id), full=slots.length>0;
      for(var j=0;j<slots.length;j++){if(!(s.slots[slots[j]]&&s.slots[slots[j]].done)){full=false;break;}}
      if(full){s.islandPaid[id]=1;changed=true;payments.push({n:ISLAND_BONUS,msg:'🏝️ '+id+' 全词永久掌握'});}
    });
    if(changed&&!save(s))return;
    try{localStorage.setItem('hsn_crystal_total',String(total));localStorage.setItem('hsn_crystal_rank',String(s.rankPaid||0));}catch(e){}
    payments.forEach(function(p){gemAdd(p.n);setTimeout(function(){toast('💎 '+p.msg+' +'+p.n+' 钻石');},400);});
  }

  function crystallize(slot,word){
    var s=state();if(s.paid[slot])return;
    s.paid[slot]=1;
    if(!save(s))return;
    gemAdd(GEM_PER_WORD);
    toast('💎 记牢了'+(word?'「'+word+'」':'')+'！+'+GEM_PER_WORD+' 钻石');
    reconcile();
  }
  function onAnswer(idx,correct){
    var c=C();if(!c||idx===null||idx===undefined||idx<0)return null;
    var mastery=c.recordMastery(idx,!!correct);
    var r=c.resolve(idx);if(!r)return null;
    var s=state(), w=s.slots[r.slot]||{lv:0,p:0,d:'',done:0};
    if(w.done){return w;}
    if(correct){
      w.p=Math.min(STAR_NEED,(Number(w.p)||0)+1);
      if(w.p>=STAR_NEED&&w.d!==today()){
        w.lv=Math.min(MAX_LV,(Number(w.lv)||0)+(isBoosted()?BOOST_STAR:1));
        w.p=0;w.d=today();
        if(w.lv>=MAX_LV)w.done=1;
      }
    }
    s.slots[r.slot]=w;save(s);
    if(w.done){
      var words=c.wordsNow(), en=words[idx]&&words[idx].en;
      crystallize(r.slot,en||'');
    }
    refreshBadge();return {slot:r.slot,word:w,mastery:mastery};
  }

  function isDoneSlot(slot){var s=state();return !!(slot&&s.slots[slot]&&s.slots[slot].done);}
  function stats(){
    var c=C(),s=state(),dist=[0,0,0,0,0,0],mastered=0,seen=0,perWord={};
    Object.keys(s.slots).forEach(function(k){var w=s.slots[k]||{};seen++;if(w.done)mastered++;else dist[Math.max(0,Math.min(5,Number(w.lv)||0))]++;});
    if(c){
      var a=c.wordsNow();
      for(var i=0;i<a.length;i++){var r=c.resolve(i);if(r)perWord[String((a[i]&&a[i].en)||'').toLowerCase()]={mastered:isDoneSlot(r.slot),slot:r.slot};}
    }
    return {dist:dist,mastered:mastered,seen:seen,totalWords:c?c.totalSlots:0,gTotal:mastered,gGems:lsInt('hsn_crystal_gems'),perWord:perWord,perWordReward:GEM_PER_WORD};
  }
  function toast(msg){
    try{
      var old=document.getElementById('hsnCrystalToastV941');if(old)old.remove();
      var d=document.createElement('div');d.id='hsnCrystalToastV941';d.textContent=msg;
      d.style.cssText='position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:100002;background:#172554;color:#e0f2fe;border:1px solid #7dd3fc;border-radius:12px;padding:11px 17px;font:700 14px system-ui,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.5);text-align:center';
      document.body.appendChild(d);setTimeout(function(){if(d&&d.parentNode)d.remove();},2500);
    }catch(e){}
  }
  function open(){
    var s=stats(), old=document.getElementById('hsnCrystalMaskV941');if(old)old.remove();
    var m=document.createElement('div');m.id='hsnCrystalMaskV941';m.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.9);display:flex;align-items:center;justify-content:center;padding:18px';
    var boost=isBoosted()?'⚡ 强化剩余 '+boostLeftMin()+' 分钟':'⚡ 当前未开启记忆强化';
    m.innerHTML='<div lang="zh-CN" style="width:min(430px,94vw);max-height:88vh;overflow:auto;background:#101d36;color:#e2e8f0;border:1px solid #475569;border-radius:18px;padding:20px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">'
      +'<button id="hcv941Close" aria-label="关闭" style="float:right;border:0;border-radius:8px;background:#334155;color:#fff;width:34px;height:34px">✕</button>'
      +'<h2 style="margin:2px 0 8px;color:#bae6fd">💎 知识结晶总账</h2>'
      +'<p style="line-height:1.7;color:#cbd5e1">每个 canonical 词槽在不同日期练满 5 星，只结晶一次。Land1–Land8 与女帝篇共享同一批 240 词，不会重复发钻。</p>'
      +'<div style="font-size:28px;font-weight:900;color:#e9d5ff">'+s.mastered+' / '+s.totalWords+'</div>'
      +'<div style="margin:8px 0;color:#fde68a">'+boost+'</div>'
      +'<div style="line-height:1.8;color:#cbd5e1">已练过：'+s.seen+' 个<br>每词永久掌握：+'+GEM_PER_WORD+'💎<br>每个 canonical 岛全掌握：+'+ISLAND_BONUS+'💎</div></div>';
    document.body.appendChild(m);
    m.querySelector('#hcv941Close').onclick=function(){m.remove();};
    m.onclick=function(e){if(e.target===m)m.remove();};
  }
  function refreshBadge(){
    var b=document.getElementById('hsnCrystalBtn');if(!b)return;
    var n=stats().mastered, x=b.querySelector('.b');if(x){x.textContent=n;x.style.display=n?'flex':'none';}
  }
  function injectBtn(){
    if(document.getElementById('hsnCrystalBtn')){refreshBadge();return;}
    var b=document.createElement('button');b.id='hsnCrystalBtn';b.setAttribute('aria-label','打开知识结晶总账');
    b.style.cssText='position:fixed;right:12px;bottom:120px;z-index:9990;width:52px;height:52px;border-radius:50%;border:1px solid #4a6aa0;background:#10203f;color:#fff;font-size:24px;box-shadow:0 8px 22px rgba(0,0,0,.45)';
    b.innerHTML='💎<span class="b" style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#22c55e;color:#fff;font-size:10px;font-weight:800;display:none;align-items:center;justify-content:center"></span>';
    b.onclick=open;document.body.appendChild(b);refreshBadge();
  }
  function hook(){
    if(typeof window.markAnswer!=='function'||window.markAnswer.__hcv941)return false;
    var orig=window.markAnswer;
    window.markAnswer=function(idx,correct){var ret=orig.apply(this,arguments);try{onAnswer(idx,correct);}catch(e){}return ret;};
    window.markAnswer.__hcv941=true;return true;
  }
  function boot(){
    migrateLegacy();reconcile();injectBtn();hook();
    var n=0,t=setInterval(function(){n++;if(hook()||n>40)clearInterval(t);},150);
  }

  window.HansenCrystal={
    open:open,stats:stats,gems:function(){return lsInt('hsn_crystal_gems');},
    mastered:function(){return doneCount(state());},grantBoost:grantBoost,isBoosted:isBoosted,
    boostLeftMin:boostLeftMin,isDoneSlot:isDoneSlot,reconcileCanonicalRewards:reconcile,
    _onAnswer:onAnswer,_state:state
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();