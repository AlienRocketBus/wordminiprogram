/* hansen_focused_typing_v946.js
 * 探索单词 -> “宠物掌握冲刺”的打字大师定向模式。
 *
 * 核心合同：
 *   1. 只复用正式打字大师的题面、字母格、游戏内键盘、计时器与 typeKey 输入链；
 *   2. 目标词必须连续、完整、精确拼写 remaining=(3-currentMc) 次；
 *   3. 拼错或使用答案提示会清零本次连续进度，提示所在回合不计；
 *   4. 未完成前不调用 markAnswer，完成后才为每次已经发生的合格拼写逐笔走正式账本；
 *   5. 普通打字大师的无提示精确拼写也走 pet 授权通道，选择题等不能伪造宠物掌握。
 */
(function(root){
  'use strict';
  if(!root||root.__hansenFocusedTypingV946)return;
  root.__hansenFocusedTypingV946=true;

  var STORE_KEY='hansen_typing_focus_v946';
  var SCHEMA=1,MASTER_HITS=3,MAX_SAVED=100;
  var active=null,genericHinted=false,serial=0;
  var originals={
    check:root.typeCheckWord,
    hint:root.typeHint,
    timeout:root.typeTimeout,
    next:root.nextTypeQ,
    stop:root.stopTyping,
    keyboard:root.renderKeyboard
  };

  function words(){return Array.isArray(root.allW)?root.allW:[];}
  function clampInt(v,min,max){v=Math.floor(Number(v));if(!isFinite(v))v=min;return Math.max(min,Math.min(max,v));}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function norm(v){return String(v==null?'':v).trim().toLowerCase();}
  function fnv(s){var h=2166136261;s=String(s||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv1a32-'+(h>>>0).toString(16).padStart(8,'0');}
  function recordText(r){return [r.schema,r.slot,r.word,r.needed,r.streak,r.errors,r.hints,r.updatedAt].join('|');}
  function signed(r){var o={schema:SCHEMA,slot:String(r.slot||''),word:norm(r.word),needed:clampInt(r.needed,1,MASTER_HITS),streak:clampInt(r.streak,0,MASTER_HITS),errors:clampInt(r.errors,0,1000000),hints:clampInt(r.hints,0,1000000),updatedAt:clampInt(r.updatedAt,0,Number.MAX_SAFE_INTEGER)};o.checksum=fnv(recordText(o));return o;}
  function validRecord(r,slot,word){
    if(!r||typeof r!=='object'||Array.isArray(r)||r.schema!==SCHEMA)return null;
    if(String(r.slot||'')!==String(slot)||norm(r.word)!==norm(word))return null;
    var clean=signed(r);if(clean.checksum!==String(r.checksum||''))return null;
    if(clean.streak>clean.needed)return null;
    return clean;
  }
  function readStore(){try{var o=JSON.parse(root.localStorage.getItem(STORE_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch(e){return {};}}
  function writeStore(o){
    try{
      var keys=Object.keys(o).filter(function(k){return o[k]&&typeof o[k]==='object';});
      if(keys.length>MAX_SAVED){keys.sort(function(a,b){return (+o[b].updatedAt||0)-(+o[a].updatedAt||0);});var keep={};keys.slice(0,MAX_SAVED).forEach(function(k){keep[k]=o[k];});o=keep;}
      root.localStorage.setItem(STORE_KEY,JSON.stringify(o));return true;
    }catch(e){return false;}
  }
  function saveActive(){if(!active)return false;var o=readStore(),r=signed({slot:active.slot,word:active.word.en,needed:active.needed,streak:active.streak,errors:active.errors,hints:active.hints,updatedAt:Date.now()});o[active.slot]=r;return writeStore(o);}
  function clearSaved(slot){var o=readStore();if(Object.prototype.hasOwnProperty.call(o,slot)){delete o[slot];writeStore(o);}}

  function snapshot(idx){
    try{
      if(root.HansenCanonical&&typeof root.HansenCanonical.sliceSnapshot==='function'){
        var s=root.HansenCanonical.sliceSnapshot(),it=s&&s.ok&&s.items&&s.items[idx];
        if(it)return {ok:true,mc:clampInt(it.mastery,0,1000000),slot:String(it.slotId||((s.id||'island')+':'+idx))};
      }
    }catch(e){}
    try{return {ok:true,mc:clampInt(root.S&&root.S.mc&&root.S.mc[idx],0,1000000),slot:String((root.__hsnSaveKey||location.pathname||'island')+':'+idx)};}catch(e){return {ok:false,mc:0,slot:'island:'+idx};}
  }
  function levelFor(idx){
    try{for(var k=1;k<=3;k++)if(typeof TYPING_LEVELS!=='undefined'&&TYPING_LEVELS[k]&&TYPING_LEVELS[k].filter(idx))return k;}catch(e){}
    var n=norm((words()[idx]||{}).en).replace(/[^a-z]/g,'').length;return n<=4?1:n<=6?2:3;
  }
  function level(){try{return (typeof TYPING_LEVELS!=='undefined'&&TYPING_LEVELS[active.round])||TYPING_LEVELS[1];}catch(e){return {name:'打字',icon:'⌨️',c1:'#4f46e5',c2:'#7c3aed',xpPerWord:5};}}
  function currentMc(){return active?snapshot(active.idx).mc:0;}
  function notify(msg){try{if(typeof root.showToast==='function')root.showToast(msg);else if(typeof root.showComboToast==='function')root.showComboToast(msg);}catch(e){}}
  function progressChanged(correct){try{root.dispatchEvent(new CustomEvent('hansen-progress-changed',{detail:{wordIndex:active?active.idx:-1,correct:!!correct,source:'typing-master-focus'}}));}catch(e){}}

  function authorizePet(idx,meta,fn){
    var gate=root.HansenSpellingProgressV946;
    if(gate&&typeof gate.run==='function')return gate.run('pet',idx,meta,fn);
    // 宠物 wrapper 本身仍须 fail-closed；这里让其它正式答题统计照常结算。
    return fn();
  }

  function addHyphen(html){
    html=String(html||'');
    if(html.indexOf('data-htm-hyphen')>=0)return html;
    var needle='<button class="key space"';
    var pos=html.indexOf(needle);
    if(pos<0)return html;
    return html.slice(0,pos)+'<button class="key" type="button" data-htm-hyphen="1" aria-label="连字符" onclick="typeKey(\'-\')">-</button>'+html.slice(pos);
  }
  if(typeof originals.keyboard==='function'){
    root.renderKeyboard=function(){return addHyphen(originals.keyboard.apply(this,arguments));};
  }

  function injectCSS(){
    if(!root.document||document.getElementById('htm-focus-css'))return;
    var st=document.createElement('style');st.id='htm-focus-css';
    st.textContent=[
      '.htm-focus-head{display:flex;align-items:center;gap:7px;margin:0 8px 10px;padding:9px 10px;border:1px solid rgba(134,239,172,.55);border-radius:14px;background:linear-gradient(135deg,rgba(22,163,74,.3),rgba(30,64,175,.3));color:#fff;font-size:12px;font-weight:800}',
      '.htm-focus-head .htm-title{min-width:0;flex:1}',
      '.htm-focus-head .htm-title b{display:block;color:#fde047;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.htm-focus-head .htm-streak{font-variant-numeric:tabular-nums;white-space:nowrap;border-radius:9px;background:rgba(0,0,0,.28);padding:5px 8px}',
      '.htm-pause{min-height:38px;border:1px solid rgba(255,255,255,.28);border-radius:9px;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-weight:900;padding:4px 8px}',
      '.htm-rule{margin:2px 10px 7px;border-radius:10px;background:rgba(15,23,42,.64);color:#cbd5e1;padding:7px 9px;text-align:center;font-size:11.5px;line-height:1.45}',
      '.htm-focus-feedback{min-height:20px;margin:5px 10px 0;color:#fde68a;text-align:center;font-size:12px;font-weight:800}',
      '.htm-complete{max-width:390px;margin:0 auto;text-align:center;padding:25px 14px;color:#fff}',
      '.htm-complete .htm-medal{font-size:72px;filter:drop-shadow(0 5px 14px rgba(251,191,36,.45))}',
      '.htm-complete h2{margin:8px 0;color:#fde047;font-size:24px}',
      '.htm-complete p{font-size:13px;line-height:1.7;color:#cbd5e1}',
      '.htm-complete button{min-height:48px;border:0;border-radius:13px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font:inherit;font-weight:900;padding:10px 18px}',
      '.htm-pause:focus-visible,.htm-complete button:focus-visible{outline:3px solid #fde047;outline-offset:2px}',
      '@media(max-width:360px){.htm-focus-head{gap:4px;padding:7px 7px}.htm-pause{font-size:11px;padding:3px 5px}}',
      '@media(prefers-reduced-motion:reduce){.htm-complete *{animation:none!important;transition:none!important}}'
    ].join('\n');(document.head||document.documentElement).appendChild(st);
  }

  function patchBack(){
    var b=document.querySelector&&document.querySelector('#typingScreen .back-btn');if(!b)return;
    if(!active.back){active.back={text:b.textContent,onclick:b.getAttribute('onclick')};}
    b.textContent='← 暂停并返回';b.setAttribute('onclick','HansenTypingMasterV946.exit()');
  }
  function restoreBack(a){
    var b=document.querySelector&&document.querySelector('#typingScreen .back-btn');if(!b||!a||!a.back)return;
    b.textContent=a.back.text;if(a.back.onclick==null)b.removeAttribute('onclick');else b.setAttribute('onclick',a.back.onclick);
  }
  function focusedKeyboard(){
    try{return addHyphen(root.renderKeyboard());}catch(e){return '';}
  }
  function slotsFor(target){var h='';target.split('').forEach(function(ch,i){h+='<div class="typing-slot'+(ch===' '?' space':'')+'" id="tslot'+i+'"></div>';});return h;}

  function renderAttempt(message){
    if(!active||active.done)return;
    var token=++serial,w=active.word,L=level(),target=norm(w.en),content=document.getElementById('typingContent');if(!content)return;
    try{typeRound=active.round;typePool=[active.idx];typeIdx=0;typeWord=w;typeInput='';typeDone=0;typeWordStart=Date.now();typeActive=true;}catch(e){return failOpen('打字引擎没有准备好，请返回后重试。');}
    active.eligible=true;active.renderToken=token;
    patchBack();
    content.innerHTML='<div class="htm-focus-head"><span style="font-size:22px">🐾</span><span class="htm-title"><b>宠物掌握冲刺 · '+esc(w.cn||'')+'</b><span>'+esc(L.name||'打字')+' · 连续精确拼写</span></span><span class="htm-streak">'+active.streak+' / '+active.needed+'</span><button type="button" class="htm-pause" onclick="HansenTypingMasterV946.exit()">暂停</button></div>'+
      '<div class="htm-rule">不能靠选择题点亮爪印。必须连续拼对；拼错或看提示会把本次连续进度清零，未完成不结算掌握。</div>'+
      '<div class="typing-area"><div class="typing-emoji">'+((root.__hsnQuizPic?root.__hsnQuizPic(w):w.emoji)||'📘')+'</div><div class="typing-cn">'+esc(w.cn||'')+'</div><div class="typing-pn">'+esc(w.pn||'')+'</div><div class="typing-slots" id="typeSlots"><div class="typing-slots-inner">'+slotsFor(target)+'</div></div><div style="text-align:center;margin:4px 0"><button type="button" class="listen-btn" onclick="speak(typeWord.en)">🔊 听发音</button> <button type="button" class="listen-btn" onclick="typeHint()">💡 提示（清零）</button> <span style="display:inline-block;margin-left:5px;color:#fde047;font-size:12px">⏱️ <b id="typeTimer">0.00s</b></span></div><div class="htm-focus-feedback" id="htmFocusFeedback" aria-live="polite">'+esc(message||'请根据中文和发音，完整拼写英文单词。')+'</div>'+focusedKeyboard()+'</div>';
    try{root.HansenFitSlots(document.getElementById('typeSlots'));}catch(e){}
    try{if(typeof root.startTypeTimer==='function')root.startTypeTimer();else startTypeTimer();}catch(e){}
    try{if(typeof root.speak==='function')root.speak(w.en);}catch(e){}
  }

  function paintResult(ok,input){
    var target=norm(active.word.en),box=document.getElementById('typeSlots');
    for(var i=0;i<target.length;i++){var el=document.getElementById('tslot'+i);if(!el)continue;var same=norm(input).charAt(i)===target.charAt(i);el.classList.remove('wrong');if(ok||same)el.classList.add('filled');else{el.classList.remove('filled');el.classList.add('wrong');}}
    if(!ok&&box&&box.parentNode){var old=document.getElementById('typeCompare');if(old)old.remove();var div=document.createElement('div');div.id='typeCompare';div.style.cssText='margin:8px auto 0;max-width:344px;background:rgba(0,0,0,.5);color:#fff;border-radius:12px;padding:8px 12px;text-align:center';div.innerHTML='<div style="font-size:14px;color:#f87171;font-weight:800">❌ '+esc(String(input||'').trim()||'(空)')+'</div><div style="font-size:17px;color:#34d399;font-weight:900">✓ '+esc(active.word.en)+'</div>';box.parentNode.insertBefore(div,box.nextSibling);}
  }
  function feedback(msg,color){var el=document.getElementById('htmFocusFeedback');if(el){el.textContent=msg;if(color)el.style.color=color;}}

  function focusHint(){
    if(!active||active.done)return originals.hint&&originals.hint.apply(this,arguments);
    active.streak=0;active.hints++;active.eligible=false;saveActive();
    feedback('💡 已查看答案：连续进度清零，这一回合即使拼对也不计。','#fbbf24');
    if(typeof originals.hint==='function')return originals.hint.apply(this,arguments);
  }
  function focusTimeout(){
    if(!active||active.done)return originals.timeout&&originals.timeout.apply(this,arguments);
    try{typeActive=false;typeWordStart=0;}catch(e){}
    active.streak=0;active.errors++;saveActive();feedback('⏰ 超时：连续进度清零，准备重新拼写。','#fca5a5');
    var t=active.renderToken;setTimeout(function(){if(active&&!active.done&&active.renderToken===t)renderAttempt('重新开始连续拼写。');},900);
  }
  function focusCheck(){
    if(!active||active.done)return;
    var target=norm(active.word.en),input='';try{if(!typeActive)return;input=norm(typeInput);typeActive=false;}catch(e){return;}
    var ok=input===target,eligible=!!active.eligible,t=active.renderToken;
    try{if(typeof root.stopTypeTimer==='function')root.stopTypeTimer();else stopTypeTimer();}catch(e){}
    paintResult(ok,input);
    if(!ok){
      active.streak=0;active.errors++;saveActive();
      try{if(typeof root.playWrong==='function')root.playWrong();}catch(e){}
      try{if(typeof root.markAnswer==='function')root.markAnswer(active.idx,false,{hsnProgress:'pet',source:'typing-master',focus:true,exact:false});}catch(e){}
      feedback('❌ 拼写不正确，连续进度已清零。看清正确拼写后再来。','#fca5a5');
      setTimeout(function(){var c=document.getElementById('typeCompare');if(c)c.remove();if(active&&!active.done&&active.renderToken===t)renderAttempt('重新开始连续拼写。');},1500);return;
    }
    if(!eligible){
      saveActive();feedback('🟡 拼对了，但本回合看过提示，不计入掌握；下一回合请独立完成。','#fde68a');
      setTimeout(function(){if(active&&!active.done&&active.renderToken===t)renderAttempt('提示回合已结束，请独立拼写。');},900);return;
    }
    active.streak++;saveActive();
    try{if(typeof root.playCorrect==='function')root.playCorrect();}catch(e){}
    feedback('✅ 独立精确拼对！连续 '+active.streak+' / '+active.needed+'。','#86efac');
    if(active.streak>=active.needed){setTimeout(function(){if(active&&!active.done&&active.renderToken===t)completeFocus();},650);}
    else setTimeout(function(){if(active&&!active.done&&active.renderToken===t)renderAttempt('保持连续：还要独立拼对 '+(active.needed-active.streak)+' 次。');},750);
  }

  function markOne(idx){
    var meta={mode:'typing-master',focus:true,complete:true,exact:true,noHint:true,hsnProgress:'pet',source:'typing-master'};
    return authorizePet(idx,meta,function(){return root.markAnswer(idx,true,{hsnProgress:'pet',source:'typing-master',mode:'typing-master',focus:true,complete:true,exact:true,noHint:true});});
  }
  function completeFocus(){
    if(!active||active.done||active.settling)return;
    active.settling=true;try{typeActive=false;}catch(e){}try{root.stopTypeTimer();}catch(e){}
    var before=currentMc(),need=Math.max(0,MASTER_HITS-before),settled=0,error='';
    try{
      for(var i=0;i<need;i++){var prev=currentMc();markOne(active.idx);var after=currentMc();if(after<=prev)throw new Error('pet mastery gate rejected settlement');settled++;}
    }catch(e){error=String(e&&e.message||e);}
    var now=currentMc();
    if(now<MASTER_HITS){
      active.settling=false;active.streak=Math.max(active.streak,active.needed);saveActive();
      var body=document.getElementById('typingContent');if(body)body.innerHTML='<div class="htm-complete"><div class="htm-medal">🔐</div><h2>掌握账本正在恢复</h2><p>你的连续拼写已经安全保存，但正式掌握账本尚未确认（'+esc(error||'未确认')+'）。没有提前点亮爪印，也不会丢失挑战进度。</p><button type="button" onclick="HansenTypingMasterV946.retry()">重新安全结算</button> <button type="button" onclick="HansenTypingMasterV946.exit()">返回探索</button></div>';
      return;
    }
    // 若另一个标签页刚刚推进了同词 mc，只按本次真正写入账本的 settled 笔数发 XP/统计，
    // 绝不拿启动时的 needed 多发奖励。
    var L=level(),xp=Math.max(0,Math.floor(Number(L.xpPerWord)||5))*settled;
    try{if(xp&&typeof root.addXP==='function')root.addXP(xp);}catch(e){}
    try{if(root.S){if(!S.stats||typeof S.stats!=='object')S.stats={};S.stats.typeCount=(+S.stats.typeCount||0)+settled;}if(typeof root.progressQuest==='function'&&settled>0)root.progressQuest('type',settled);if(typeof root.save==='function')root.save();}catch(e){}
    clearSaved(active.slot);active.done=true;active.settling=false;progressChanged(true);
    try{if(typeof root.bigConfetti==='function')root.bigConfetti();else if(typeof root.confetti==='function')root.confetti(root.innerWidth/2,260,24);}catch(e){}
    var content=document.getElementById('typingContent');if(content)content.innerHTML='<div class="htm-complete"><div class="htm-medal">🐾</div><h2>宠物已经掌握 '+esc(active.word.en)+'！</h2><p>你连续独立拼对 <b>'+active.needed+'</b> 次，正式掌握进度已达到 <b>'+now+' / '+MASTER_HITS+'</b>。<br>本次向掌握账本新增 '+settled+' 次精确拼写，经验 +'+xp+'；没有发放整局钻石加成或整局宠物任务奖。</p><button type="button" onclick="HansenTypingMasterV946.exit()">返回探索单词</button></div>';
  }

  function failOpen(msg){notify(msg);exit();return false;}
  function cleanup(){
    var a=active;if(!a)return;try{typeActive=false;}catch(e){}try{root.stopTypeTimer();}catch(e){}restoreBack(a);active=null;serial++;
  }
  function exit(){
    var had=!!active;cleanup();
    if(had){try{if(typeof root.showScreen==='function')root.showScreen('explore');if(typeof root.renderExplore==='function')root.renderExplore();}catch(e){try{root.showScreen('home');}catch(_){}}}
  }
  function openFocus(idx){
    idx=clampInt(idx,0,Math.max(0,words().length-1));var w=words()[idx];if(!w||!norm(w.en))return false;
    var s=snapshot(idx);if(!s.ok){notify('宠物掌握账本暂不可读，请稍后重试。');return false;}
    if(s.mc>=MASTER_HITS){notify('✅ 这个单词已经计入宠物掌握。');return false;}
    if(active)cleanup();else try{if(typeof originals.stop==='function')originals.stop();}catch(e){}
    var needed=MASTER_HITS-s.mc,o=readStore(),saved=validRecord(o[s.slot],s.slot,w.en);
    active={idx:idx,word:w,slot:s.slot,needed:needed,streak:saved?Math.min(saved.streak,needed):0,errors:saved?saved.errors:0,hints:saved?saved.hints:0,round:levelFor(idx),eligible:true,done:false,settling:false,back:null,renderToken:0};
    saveActive();injectCSS();
    try{if(typeof root.markMode==='function')root.markMode('typing');if(typeof root.showScreen==='function')root.showScreen('typing');}catch(e){cleanup();return false;}
    renderAttempt(active.streak?'已恢复连续进度 '+active.streak+' / '+active.needed+'。':'请根据中文和发音，完整拼写英文单词。');
    if(active&&active.streak>=active.needed)setTimeout(completeFocus,0);
    return true;
  }

  // 包装真实打字大师：只有“未看提示 + 完整精确拼写”才打开 pet channel。
  if(typeof originals.next==='function')root.nextTypeQ=function(){if(active&&!active.done)return renderAttempt();genericHinted=false;return originals.next.apply(this,arguments);};
  if(typeof originals.hint==='function')root.typeHint=function(){if(active&&!active.done)return focusHint.apply(this,arguments);genericHinted=true;return originals.hint.apply(this,arguments);};
  if(typeof originals.timeout==='function')root.typeTimeout=function(){if(active&&!active.done)return focusTimeout.apply(this,arguments);return originals.timeout.apply(this,arguments);};
  if(typeof originals.check==='function')root.typeCheckWord=function(){
    if(active&&!active.done)return focusCheck();
    var idx=-1,exact=false;try{idx=typePool[typeIdx];exact=!!typeWord&&norm(typeInput)===norm(typeWord.en);}catch(e){}
    if(exact&&!genericHinted){var self=this,args=arguments;return authorizePet(idx,{mode:'typing-master',focus:false,complete:true,exact:true,noHint:true,hsnProgress:'pet',source:'typing-master'},function(){return originals.check.apply(self,args);});}
    return originals.check.apply(this,arguments);
  };
  if(typeof originals.stop==='function')root.stopTyping=function(){if(active)cleanup();return originals.stop.apply(this,arguments);};

  injectCSS();
  root.HansenTypingMasterV946={
    openFocus:openFocus,exit:exit,retry:completeFocus,
    state:function(){return active?{idx:active.idx,slot:active.slot,needed:active.needed,streak:active.streak,errors:active.errors,hints:active.hints,eligible:active.eligible,done:active.done}:null;},
    saved:function(idx){var w=words()[idx],s=snapshot(idx);return w&&s.ok?validRecord(readStore()[s.slot],s.slot,w.en):null;},
    _validRecord:validRecord,_signed:signed,_addHyphen:addHyphen
  };
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
