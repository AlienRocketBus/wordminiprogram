(function(){
  try{
    var W=/^(hansen_wallet_|hansen_global_daily_quests|hansen_checkin|hansen_canonical_progress|hsn_crystal|hansen_ach|hansen_card|hansen_gear|hsn_progress:|wordIsland|hansen_coin_awards|hansen_gem_awards|hansen_quest|hansen_reward|hansen_pet|hsn_gear|hansen_cardbook|hansen_totals)/;
    var path=(location.pathname.split('/').pop()||'')+(location.search.indexOf('warm=1')>=0?'?warm':'');
    var depth=0;try{var w=window;while(w!==w.parent){depth++;w=w.parent;}}catch(e){}
    var tag=depth+':'+path;
    var top0;try{top0=window.top;}catch(e){top0=window;}
    function rec(op,k,v){try{if(!W.test(k))return;var T=top0;T.__W=T.__W||[];if(T.__W.length<20000)T.__W.push({t:Date.now(),f:tag,op:op,k:k,v:(v==null?null:String(v).slice(0,80))});}catch(e){}}
    var ps=Storage.prototype.setItem,pr=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(k,v){rec('set',String(k),v);return ps.apply(this,arguments);};
    Storage.prototype.removeItem=function(k){rec('rm',String(k),null);return pr.apply(this,arguments);};
  }catch(e){}
})();
