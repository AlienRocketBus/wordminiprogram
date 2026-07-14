/* hansen_quest_global.js v941 — 27 页面每天共享唯一一套任务 */
(function(){
  'use strict';
  if(window.__hansenQuestGlobalV941)return;
  window.__hansenQuestGlobalV941=true;
  var KEY='hansen_daily_quests_global_v1',LOCK='hansen_daily_quests_claim_lock_v1';

  function S(){try{return new Function('return typeof S!=="undefined"?S:null')();}catch(e){return window.S||null;}}
  function today(){try{if(typeof window.today==='function')return window.today();}catch(e){}var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
  function clone(x){try{return JSON.parse(JSON.stringify(x));}catch(e){return x;}}
  function load(){try{var o=JSON.parse(localStorage.getItem(KEY)||'null');return o&&typeof o==='object'?o:null;}catch(e){return null;}}
  function save(o){try{localStorage.setItem(KEY,JSON.stringify(o));return true;}catch(e){return false;}}
  function normalize(o){
    o=o||{};if(!Array.isArray(o.list))o.list=[];
    o.day=today();o.allDay=o.allDay||'';
    o.list=o.list.map(function(q){q=q||{};q.progress=Math.max(0,Number(q.progress)||0);q.claimed=!!q.claimed;return q;});
    return o;
  }
  var original={};

  function generateDay(){
    var s=S();if(!s)return normalize({list:[],allDay:''});
    var oldLearn=s.learned,oldQ=clone(s.quests),oldSave=window.save;
    try{
      s.learned=[];s.quests={day:'',list:[],allDay:''};
      if(typeof oldSave==='function')window.save=function(){};
      if(typeof original.init==='function')original.init();
      return normalize(clone(s.quests));
    }catch(e){
      return normalize(oldQ||{list:[],allDay:''});
    }finally{
      s.learned=oldLearn;
      if(typeof oldSave==='function')window.save=oldSave;
      s.quests=oldQ;
    }
  }
  function ensure(){
    var o=load();
    if(!o||o.day!==today()||!Array.isArray(o.list)||!o.list.length){
      o=generateDay();o.day=today();o.allDay='';save(o);
    }
    return normalize(o);
  }
  function apply(){
    var s=S(),o=ensure();if(s)s.quests=clone(o);return o;
  }
  function persist(){
    var s=S();if(!s||!s.quests)return ensure();
    var o=normalize(clone(s.quests));save(o);return o;
  }
  function acquire(){
    var nonce=String(Date.now())+'-'+Math.random();
    try{
      var old=JSON.parse(localStorage.getItem(LOCK)||'null');
      if(old&&old.until>Date.now())return null;
      localStorage.setItem(LOCK,JSON.stringify({nonce:nonce,until:Date.now()+3000}));
      var now=JSON.parse(localStorage.getItem(LOCK)||'null');
      return now&&now.nonce===nonce?nonce:null;
    }catch(e){return nonce;}
  }
  function release(nonce){try{var o=JSON.parse(localStorage.getItem(LOCK)||'null');if(o&&o.nonce===nonce)localStorage.removeItem(LOCK);}catch(e){}}

  function install(){
    if(typeof window.initQuests==='function'&&!original.init)original.init=window.initQuests;
    if(typeof window.progressQuest==='function'&&!original.progress)original.progress=window.progressQuest;
    if(typeof window.setQuest==='function'&&!original.set)original.set=window.setQuest;
    if(typeof window.claimQuest==='function'&&!original.claim)original.claim=window.claimQuest;
    if(typeof window.renderQuests==='function'&&!original.render)original.render=window.renderQuests;
    if(typeof window.updateQuestBadge==='function'&&!original.badge)original.badge=window.updateQuestBadge;
    if(!original.init||!original.claim)return false;

    window.initQuests=function(){apply();};
    window.progressQuest=function(type,amount){
      apply();var r=original.progress.apply(this,arguments);persist();return r;
    };
    window.setQuest=function(type,value){
      apply();var r=original.set.apply(this,arguments);persist();return r;
    };
    window.renderQuests=function(){apply();return original.render.apply(this,arguments);};
    window.updateQuestBadge=function(){apply();return original.badge?original.badge.apply(this,arguments):undefined;};
    window.claimQuest=function(idx){
      idx=Math.floor(Number(idx));var nonce=acquire();if(!nonce)return false;
      try{
        var o=ensure(),q=o.list[idx];
        if(!q||q.claimed||(Number(q.progress)||0)<(Number(q.goal)||0))return false;
        var previousAll=o.allDay||'',finalAfter=true;
        o.list[idx].claimed=true;
        for(var i=0;i<o.list.length;i++)if(!o.list[i].claimed){finalAfter=false;break;}
        var awardAll=finalAfter&&previousAll!==today();
        if(awardAll)o.allDay=today();
        if(!save(o))return false;

        var s=S();if(!s)return false;
        var temp=clone(o);temp.list[idx].claimed=false;temp.allDay=previousAll;
        s.quests=temp;
        try{if(window.HansenCheckin&&HansenCheckin.getStreak)s.streak=HansenCheckin.getStreak();}catch(e){}
        var r=original.claim.call(this,idx);
        s.quests=clone(o);
        try{if(typeof window.save==='function')window.save();}catch(e){}
        try{if(original.render)original.render();if(original.badge)original.badge();}catch(e){}
        return r===undefined?true:r;
      }finally{release(nonce);}
    };
    apply();
    try{if(original.render)original.render();if(original.badge)original.badge();}catch(e){}
    window.__hansenQuestGlobalInstalled=true;
    return true;
  }

  window.HansenQuestGlobal={key:KEY,load:ensure,sync:apply,persist:persist,install:install};
  var tries=0,t=setInterval(function(){tries++;if(install()||tries>60)clearInterval(t);},100);
  if(document.readyState!=='loading')setTimeout(install,0);
  else document.addEventListener('DOMContentLoaded',install);
})();