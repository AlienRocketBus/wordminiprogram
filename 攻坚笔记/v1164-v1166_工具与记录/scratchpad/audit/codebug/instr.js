(()=>{
  const L=window.__L={add:{},iv:new Map(),ivStack:new Map(),ivSeq:0};
  const name=t=>t===window?'window':t===document?'document':(t&&t===document.body)?'body':null;
  const oa=EventTarget.prototype.addEventListener, orm=EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener=function(type,fn,opt){ const n=name(this); if(n){ const k=n+':'+type; (L.add[k]=L.add[k]||[]).push((new Error().stack||'').split('\n').slice(2,4).join(' | ').replace(/https?:\/\/[^/]+\//g,'')); } return oa.apply(this,arguments); };
  const osi=window.setInterval, oci=window.clearInterval;
  window.setInterval=function(fn,ms){ const id=osi.apply(this,arguments); L.iv.set(id,ms); L.ivStack.set(id,(new Error().stack||'').split('\n').slice(2,3).join('').replace(/https?:\/\/[^/]+\//g,'').trim()); return id; };
  window.clearInterval=function(id){ L.iv.delete(id); L.ivStack.delete(id); return oci.apply(this,arguments); };
  window.__snap=()=>{ const o={}; for(const k in L.add) o[k]=L.add[k].length; return {listeners:o, intervals:L.iv.size}; };
})();
