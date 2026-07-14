/* hansen_spellbee_gems.js v941 — canonical Bee 钻石里程碑 */
(function(){
  'use strict';
  if(window.__hansenSpellbeeGemsV941)return;
  window.__hansenSpellbeeGemsV941=true;
  var KEY='hansen_bee_gem_daily_v941';
  var TIERS=[{n:5,gem:1},{n:10,gem:2},{n:20,gem:5}];
  function today(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
  function load(){try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(!s||s.date!==today())return{date:today(),slots:{},granted:[]};if(!s.slots)s.slots={};if(!s.granted)s.granted=[];return s;}catch(e){return{date:today(),slots:{},granted:[]};}}
  function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch(e){return false;}}
  function resolve(word,index){
    var c=window.HansenCanonical,r=null;
    try{if(c)r=c.resolveWord(word,index);}catch(e){}
    if(r)return r;
    var w=String(word||'').trim().toLowerCase();if(!w)return null;
    return{slot:'fallback:'+w};
  }
  function record(word,index){
    var r=resolve(word,index);if(!r)return{skipped:'invalid'};
    try{if(window.HansenCrystal&&HansenCrystal.isDoneSlot&&HansenCrystal.isDoneSlot(r.slot))return{skipped:'crystallized',slot:r.slot};}catch(e){}
    var s=load();if(s.slots[r.slot])return{skipped:'duplicate_today',slot:r.slot};
    s.slots[r.slot]=1;
    var count=Object.keys(s.slots).length,awards=[];
    for(var i=0;i<TIERS.length;i++){
      var t=TIERS[i];if(count>=t.n&&s.granted.indexOf(t.n)<0){s.granted.push(t.n);awards.push(t);}
    }
    if(!save(s))return{skipped:'storage_failed',slot:r.slot};
    var total=0;for(var j=0;j<awards.length;j++)total+=awards[j].gem;
    if(total){
      try{if(window.HansenGems&&HansenGems.add)HansenGems.add(total);}catch(e){}
      try{if(window.HansenAch&&HansenAch.unlock)HansenAch.unlock('gem1');}catch(e){}
      toast(total,count);
    }
    return{slot:r.slot,count:count,granted:awards};
  }
  function toast(gems,count){
    try{var d=document.createElement('div');d.textContent='💎 Bee 里程碑 +'+gems+' 钻石 · 今日 '+count+' 个 canonical 新词';d.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:99998;background:#312e81;border:1px solid #c4b5fd;border-radius:13px;padding:11px 16px;color:#fff;font:800 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45);text-align:center';document.body.appendChild(d);setTimeout(function(){if(d.parentNode)d.remove();},2500);}catch(e){}
  }
  window.HansenSpellbeeGems={
    record:record,
    status:function(){var s=load(),n=Object.keys(s.slots).length;return{count:n,granted:s.granted.slice(),nextTier:TIERS.filter(function(t){return s.granted.indexOf(t.n)<0;})[0]||null,capReached:s.granted.length===TIERS.length};},
    tiers:function(){return TIERS.slice();},
    _load:load
  };
})();