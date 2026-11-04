(function(){
  try{
    var depth=0,w=window;while(w!==w.parent){depth++;w=w.parent;}
    var label=depth+':'+(location.pathname.split('/').pop()||'?')+(location.search.indexOf('warm=1')>=0?'(warm)':'');
    var top=window.top;
    var ps=Storage.prototype.setItem,pr=Storage.prototype.removeItem;
    function log(op,k,v){try{(top.__W=top.__W||[]).push({t:Date.now(),f:label,op:op,k:String(k),v:v==null?null:String(v).slice(0,160)});}catch(e){}}
    Storage.prototype.setItem=function(k,v){if(this===window.localStorage)log('set',k,v);return ps.apply(this,arguments);};
    Storage.prototype.removeItem=function(k){if(this===window.localStorage)log('rm',k,null);return pr.apply(this,arguments);};
  }catch(e){}
})();
