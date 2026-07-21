// hansen_round_bar.js v946 HF6 — Boss逐轮大满贯进度卡
// 只展示 HansenRoundReward 的本轮独立账本；永久通关/解锁记录绝不参与。
(function(){
  'use strict';
  if(/island_season\.html/.test(location.pathname||'')) return;
  var BAR_ID='hsnRoundBar',CSS_ID='hsnRoundBarCss';

  function injectCss(){
    if(document.getElementById(CSS_ID))return;
    var st=document.createElement('style');st.id=CSS_ID;
    st.textContent=''
      +'body.hsn-boss-battle #'+BAR_ID+'{display:none!important}\n'
      +'#'+BAR_ID+'{--rb-bg:linear-gradient(135deg,#1e3a8a,#0f172a);--rb-border:#818cf8;--rb-text:#f8fafc;--rb-title:#fbbf24;--rb-round:#ddd6fe;--rb-count:#bfdbfe;--rb-remain:#fde047;--rb-amount:#f5d0fe;--rb-muted:#f1f5f9;--rb-track:#111c36;--rb-list-bg:#14234a;--rb-list-border:#4b62a5;--rb-ok:#bbf7d0;--rb-bad:#fecaca;'
      +'margin:14px 12px 18px;padding:14px;border-radius:16px;background:var(--rb-bg)!important;border:1.5px solid var(--rb-border)!important;color:var(--rb-text)!important;font-size:13px;line-height:1.55;box-shadow:0 8px 24px rgba(15,23,42,.22)}'
      +'html.hsn-bt-dark #'+BAR_ID+'{--rb-bg:linear-gradient(135deg,#1e3a8a,#0f172a);--rb-border:#818cf8;--rb-text:#f8fafc;--rb-title:#fbbf24;--rb-round:#ddd6fe;--rb-count:#bfdbfe;--rb-remain:#fde047;--rb-amount:#f5d0fe;--rb-muted:#f1f5f9;--rb-track:#111c36;--rb-list-bg:#14234a;--rb-list-border:#4b62a5;--rb-ok:#bbf7d0;--rb-bad:#fecaca}'
      +'html.hsn-bt-light #'+BAR_ID+'{--rb-bg:linear-gradient(135deg,#d7efff,#e8ddff);--rb-border:#6557c8;--rb-text:#13294b;--rb-title:#3730a3;--rb-round:#4c1d95;--rb-count:#1e40af;--rb-remain:#1e40af;--rb-amount:#4c1d95;--rb-muted:#1e3a5f;--rb-track:#b8cff4;--rb-list-bg:#c8e2ff;--rb-list-border:#6f8fc8;--rb-ok:#14532d;--rb-bad:#991b1b;box-shadow:0 8px 22px rgba(67,56,202,.18)}'
      +'html.hsn-bt-cinema #'+BAR_ID+'{--rb-bg:linear-gradient(135deg,#111827,#05070f);--rb-border:#d8b4fe;--rb-text:#f8fafc;--rb-title:#fcd34d;--rb-round:#e9d5ff;--rb-count:#bfdbfe;--rb-remain:#fde68a;--rb-amount:#f5d0fe;--rb-muted:#f1f5f9;--rb-track:#090f1f;--rb-list-bg:#151827;--rb-list-border:#6b5d85;--rb-ok:#bbf7d0;--rb-bad:#fecaca;box-shadow:0 9px 26px rgba(0,0,0,.42)}'
      +'#'+BAR_ID+',#'+BAR_ID+' *{-webkit-text-fill-color:currentColor!important;text-shadow:none!important}'
      +'#'+BAR_ID+' .rb-hd{display:flex;align-items:center;gap:8px;font-weight:900;color:var(--rb-title)!important;font-size:15px;margin-bottom:6px}'
      +'#'+BAR_ID+' .rb-round{color:var(--rb-round)!important;font-size:12.5px;font-weight:800;margin-left:auto}'
      +'#'+BAR_ID+' .rb-nums{font-size:13px;color:var(--rb-count)!important;text-align:right;font-weight:800;margin-bottom:5px}'
      +'#'+BAR_ID+' .rb-track{height:11px;border-radius:7px;background:var(--rb-track)!important;overflow:hidden;position:relative;margin:7px 0 9px}'
      +'#'+BAR_ID+' .rb-fill{height:100%;background:linear-gradient(90deg,#fbbf24,#f97316)!important;border-radius:7px;transition:width .35s ease}'
      +'#'+BAR_ID+' .rb-summary{font-size:13.5px;color:var(--rb-muted)!important;font-weight:700;margin-bottom:8px}'
      +'#'+BAR_ID+' .rb-remain{color:var(--rb-remain)!important;font-weight:900}'
      +'#'+BAR_ID+' .rb-amount{color:var(--rb-amount)!important;font-weight:900}'
      +'#'+BAR_ID+' .rb-lists{background:var(--rb-list-bg)!important;border:1px solid var(--rb-list-border)!important;border-radius:11px;padding:8px 10px;color:var(--rb-muted)!important}'
      +'#'+BAR_ID+' .rb-list{display:grid;grid-template-columns:auto 1fr;gap:4px 7px;align-items:start;font-size:12.5px;font-weight:650;line-height:1.55}'
      +'#'+BAR_ID+' .rb-list+.rb-list{margin-top:5px;padding-top:5px;border-top:1px solid var(--rb-list-border)!important}'
      +'#'+BAR_ID+' .rb-list-label{font-weight:900;white-space:nowrap;color:var(--rb-text)!important}'
      +'#'+BAR_ID+' .rb-levels{color:var(--rb-muted)!important;overflow-wrap:anywhere}'
      +'#'+BAR_ID+' .rb-rule{font-size:11.5px;font-weight:700;color:var(--rb-muted)!important;margin-top:8px}'
      +'#'+BAR_ID+' .rb-complete{color:var(--rb-ok)!important;font-weight:900}'
      +'#'+BAR_ID+'.rb-invalid{--rb-bg:linear-gradient(135deg,#fee2e2,#fecaca);--rb-border:#b91c1c;--rb-text:#450a0a;--rb-title:#7f1d1d;--rb-round:#7f1d1d;--rb-count:#7f1d1d;--rb-muted:#450a0a;--rb-list-bg:#fecaca;--rb-list-border:#b91c1c}'
      +'#'+BAR_ID+' .rb-error{color:var(--rb-bad)!important;font-size:13px;font-weight:900;line-height:1.65}'
      +'html.hsn-bt-light #'+BAR_ID+' .rb-error,#'+BAR_ID+'.rb-invalid .rb-error{color:#7f1d1d!important}'
      +'@media(max-width:350px){#'+BAR_ID+' .rb-list{grid-template-columns:1fr}#'+BAR_ID+' .rb-list-label{white-space:normal}}';
    (document.head||document.documentElement).appendChild(st);
  }

  function levels(list){
    if(!Array.isArray(list)||!list.length)return '暂无';
    return list.map(function(n){return 'Lv'+n;}).join('、');
  }
  function fallbackStatus(R){
    var cleared=R.progress(),remain=R.remain(),n=R.total();
    return {valid:true,roundNo:R.count()+1,completed:R.count(),total:n,cleared:cleared,remain:remain};
  }
  function ensureBar(){
    var scr=document.getElementById('bossScreen');
    if(!scr||document.getElementById(BAR_ID))return;
    injectCss();var d=document.createElement('div');d.id=BAR_ID;scr.appendChild(d);render();
  }
  function render(){
    var d=document.getElementById(BAR_ID);if(!d||!window.HansenRoundReward)return;
    var R=window.HansenRoundReward;
    var s=typeof R.status==='function'?R.status():fallbackStatus(R);
    var n=Math.max(1,Number(s.total)||R.total()||20),done=Array.isArray(s.cleared)?s.cleared.length:0;
    var remain=Array.isArray(s.remain)?s.remain:[],pct=Math.max(0,Math.min(100,Math.round(done/n*100)));
    d.className=s.valid===false?'rb-invalid':'';
    if(s.valid===false){
      d.innerHTML='<div class="rb-hd">🏆 Boss 大满贯 <span class="rb-round">奖励已暂停</span></div>'
        +'<div class="rb-error">本轮进度存档异常。为防止钻石被误发，系统没有覆盖原数据，也没有发奖。请先导出存档再处理。</div>';
      return;
    }
    var summary=remain.length
      ?'还差 <b class="rb-remain">'+remain.length+'</b> 个 Boss，完成本轮得 <b class="rb-amount">+88💎</b>'
      :'<span class="rb-complete">本轮全部 Boss 已核验，正在安全结算奖励…</span>';
    d.innerHTML='<div class="rb-hd">🏆 Boss 大满贯 <span class="rb-round">第 '+s.roundNo+' 轮</span></div>'
      +'<div class="rb-nums">本轮已完成 <span class="rb-remain">'+done+'</span> / '+n+' 个 Boss</div>'
      +'<div class="rb-track" aria-label="本轮进度 '+done+' / '+n+'"><div class="rb-fill" style="width:'+pct+'%"></div></div>'
      +'<div class="rb-summary">'+summary+'</div>'
      +'<div class="rb-lists">'
      +'<div class="rb-list"><span class="rb-list-label">本轮已完成：</span><span class="rb-levels">'+levels(s.cleared)+'</span></div>'
      +'<div class="rb-list"><span class="rb-list-label">本轮还需要：</span><span class="rb-levels rb-needed">'+levels(remain)+'</span></div>'
      +'</div>'
      +'<div class="rb-rule">每个 Boss 每轮只计算 1 次；重复挑战同一关不会多算。</div>';
  }

  window.HansenRoundBar={refresh:render,ensure:ensureBar};
  var t=setInterval(function(){
    if(typeof window.showScreen==='function'&&!window.showScreen.__hrbWrapped){
      var orig=window.showScreen;
      window.showScreen=function(name){var r=orig.apply(this,arguments);try{if(name==='boss'){ensureBar();render();}}catch(e){}return r;};
      window.showScreen.__hrbWrapped=true;clearInterval(t);
    }
  },250);
  setTimeout(function(){clearInterval(t);},15000);
  try{window.addEventListener('storage',function(e){if(e&&typeof e.key==='string'&&e.key.indexOf('hansen_boss_round_state_v946_')===0)render();});}catch(e){}
  if(document.readyState!=='loading')setTimeout(function(){ensureBar();render();},400);
  else document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){ensureBar();render();},400);});
})();
