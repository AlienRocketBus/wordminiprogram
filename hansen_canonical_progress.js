/* hansen_canonical_progress.js v941 — 952 个唯一词槽与跨页面权威进度 */
(function(){
  'use strict';
  if(window.__hansenCanonicalProgressV941) return;
  window.__hansenCanonicalProgressV941 = true;

  var PAGES = __HANSEN_PAGES__;
  var GROUPS = __HANSEN_GROUPS__;
  var TOTAL = __HANSEN_TOTAL__;
  var STORE_KEY = 'hansen_canonical_progress_v941';

  function pageName(){
    try{
      var n=(location.pathname||'').split('/').pop()||'';
      return n.replace(/\.html?$/i,'').toLowerCase();
    }catch(e){ return ''; }
  }
  function readJson(k,d){
    try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return v&&typeof v==='object'?v:d; }
    catch(e){ return d; }
  }
  function writeJson(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
  function stateNow(){
    try{ return new Function('return typeof S!=="undefined"?S:null')(); }catch(e){ return window.S||null; }
  }
  function wordsNow(){
    try{ return new Function('return typeof allW!=="undefined"?allW:[]')(); }catch(e){ return window.allW||[]; }
  }
  function info(page){
    page=String(page||pageName()).replace(/\.html?$/i,'').toLowerCase();
    return PAGES[page]||null;
  }
  function resolve(idx,page){
    var p=info(page), n=Number(idx);
    if(!p || !isFinite(n) || n<0) return null;
    n=Math.floor(n);
    var ci=p.map[n];
    if(ci===undefined || ci===null || ci<0) return null;
    return {page:p.page,id:p.id,saveKey:p.saveKey,index:ci,localIndex:n,slot:p.id+':'+ci};
  }
  function resolveWord(word,idx,page){
    var r=resolve(idx,page);
    if(r) return r;
    var w=String(word||'').trim().toLowerCase();
    if(!w) return null;
    var a=wordsNow();
    for(var i=0;i<a.length;i++){
      if(String((a[i]&&a[i].en)||'').trim().toLowerCase()===w){
        r=resolve(i,page);
        if(r) return r;
      }
    }
    return null;
  }
  function loadProgress(){
    var p=readJson(STORE_KEY,{version:941,slots:{}});
    if(!p.slots||typeof p.slots!=='object') p.slots={};
    p.version=941;
    return p;
  }
  function saveProgress(p){ return writeJson(STORE_KEY,p); }
  function physicalState(saveKey){
    var cur=info(), s=stateNow();
    if(cur&&cur.saveKey===saveKey&&s&&typeof s==='object') return s;
    return readJson(saveKey,{});
  }
  function valueAt(v,i){
    if(!v) return 0;
    var n=Number(v[i]);
    return isFinite(n)?n:0;
  }
  function learnedAt(v,i){ return Array.isArray(v)&&v.indexOf(i)>=0; }

  function migrate(){
    var p=loadProgress(), changed=false;
    Object.keys(PAGES).forEach(function(k){
      var pg=PAGES[k], st=physicalState(pg.saveKey);
      for(var i=0;i<pg.map.length;i++){
        var r=resolve(i,k); if(!r) continue;
        var hits=Math.max(valueAt(st.mc,i), learnedAt(st.learned,i)?3:0);
        if(hits<=0) continue;
        var cur=p.slots[r.slot]||{hits:0};
        if(hits>(cur.hits||0)){ cur.hits=hits; p.slots[r.slot]=cur; changed=true; }
      }
    });
    if(changed || !localStorage.getItem('hansen_canonical_migrated_v941')){
      saveProgress(p);
      try{ localStorage.setItem('hansen_canonical_migrated_v941','1'); }catch(e){}
    }
    return p;
  }
  function recordMastery(idx,correct,page){
    if(!correct) return null;
    var r=resolve(idx,page); if(!r) return null;
    var p=loadProgress(), s=p.slots[r.slot]||{hits:0};
    s.hits=Math.max(0,Number(s.hits)||0)+1;
    p.slots[r.slot]=s;
    saveProgress(p);
    return {slot:r.slot,hits:s.hits,resolved:r};
  }
  function mastered(need){
    need=Math.max(1,Number(need)||3);
    var p=migrate(), n=0;
    Object.keys(p.slots).forEach(function(k){ if((Number(p.slots[k].hits)||0)>=need)n++; });
    return n;
  }
  function globalXP(){
    var total=0, current=info(), curState=stateNow(), seen={};
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(!k||k.indexOf('wordIsland')!==0||/_bak$|_backup$|_tmp$/i.test(k)) continue;
        if(seen[k]) continue; seen[k]=1;
        if(current&&curState&&k===current.saveKey) continue;
        var o=readJson(k,null); if(!o) continue;
        total+=Math.max(Number(o.totalXP)||0,Number(o.xp)||0);
      }
    }catch(e){}
    if(current&&curState) total+=Math.max(Number(curState.totalXP)||0,Number(curState.xp)||0);
    return total;
  }
  function slotsForGroup(id){
    var g=GROUPS[id], a=[]; if(!g)return a;
    for(var i=0;i<g.length;i++)a.push(id+':'+i);
    return a;
  }

  var API={
    version:941,
    pages:PAGES,
    groups:GROUPS,
    totalSlots:TOTAL,
    pageName:pageName,
    info:info,
    resolve:resolve,
    resolveWord:resolveWord,
    loadProgress:loadProgress,
    saveProgress:saveProgress,
    migrate:migrate,
    recordMastery:recordMastery,
    mastered:mastered,
    globalXP:globalXP,
    slotsForGroup:slotsForGroup,
    stateNow:stateNow,
    wordsNow:wordsNow
  };
  window.HansenCanonical=API;
  migrate();
})();