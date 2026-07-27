/* hansen_spellbee.js — 把"拼写对战 spelling bee"从【单独网页跳转】改造成【岛内全屏覆盖层】。
   目标(Hansen): 让 spelling bee 像探索单词/泡泡/挑战boss 一样, 是岛页面内部的一个模式 —— 点进点出
   完全不走网页、不走链接, 岛页面永不重新加载。
   做法: open() 在岛上叠一个全屏覆盖层, 内含 spelling_bee.html?embed=1 的【隔离 iframe】;
        close() 移除覆盖层 = 瞬间回到岛(岛始终在底下原封不动)。
   为什么用隔离 iframe: spelling_bee 是 1500 行、目前运行完美的游戏。隔离 iframe = 它的 CSS/JS/定时器/
        音频/键盘监听全部与岛隔离(零冲突), 关闭时浏览器自动清理(零泄漏), 游戏代码一行不改(零风险)。
        这不是"走网页"(不跳转、岛不重载), 而是岛内的一层覆盖。
   硬件/手势返回键: open 时压一条历史, 返回键 → 关覆盖层(而非离开岛)。 */
(function(){
  'use strict';
  var OV_ID = 'hsnSbOverlay';
  var activeFrame = null; /* 只有当前可见 Bee iframe 才有权上报奖励 */
  var activeFocus = null; /* 只有 openFocus() 创建的当前会话才有权提交结晶 proof */

  function lockScroll(on){
    try{ document.body.style.overflow = on ? 'hidden' : ''; }catch(e){}
  }

  function onPop(){
    /* 硬件/手势返回 → 关覆盖层。此时 pushState 压的那条已被浏览器弹出, 不再额外 history.back。 */
    doClose(true);
  }

  function doClose(fromPop){
    var ov = document.getElementById(OV_ID);
    if(!ov){ activeFrame = null; activeFocus = null; return; }
    /* 🔴BUG#98(Hansen): spelling bee 里点"返回"(以及硬件/手势返回键)听不到点击音。
       根因: "返回"=关覆盖层=移除本覆盖层 iframe → 浏览器随之销毁 iframe 文档及其【音频上下文】;
       而 spelling bee 内部的点击音(BUG#96)是在 iframe 自己的音频上下文里播的, iframe 一销毁上下文就被掐断,
       声音还没输出就没了 → 返回键没声音(其他键不关 iframe·故照常有声)。
       修复: 关覆盖层时改由【岛(父页)】的 playNavClick 播音 —— 移除的只是覆盖层 iframe, 岛文档及其音频上下文
       原封不动地存活, 声音照常播完。doClose 是唯一关闭路径 → 一处即覆盖"返回按钮 + 硬件返回键"两条路径;
       hansen_spellbee.js 是共享模块 → 19 岛全生效。play 是 fire-and-forget, 不挡关闭/返回。 */
    try{ if(typeof window.playNavClick === 'function') window.playNavClick(); }catch(e){}
    /* 移除覆盖层(含 iframe)= 浏览器自动销毁 iframe 文档 → 里面所有定时器/音频/keydown 监听全部清掉, 零泄漏 */
    var focusChanged=!!(activeFocus&&activeFocus.consumed);
    activeFrame = null;activeFocus = null;
    if(ov.parentNode) ov.parentNode.removeChild(ov);
    lockScroll(false);
    window.removeEventListener('popstate', onPop);
    if(!fromPop){
      /* 由游戏内"返回"按钮触发: 把 open 时压的那条历史弹掉, 保持历史栈干净(配合 BUG#83 思路) */
      try{ history.back(); }catch(e){}
    }
    if(focusChanged){
      try{window.dispatchEvent(new CustomEvent('hansen-progress-changed',{detail:{source:'focused-spelling-bee',channel:'crystal'}}));}catch(e){}
      try{if(window.HansenExploreProgress&&typeof HansenExploreProgress.refresh==='function')HansenExploreProgress.refresh();}catch(e2){}
    }
  }

  function currentIslandKey(){
    try{var file=(location.pathname.split('/').pop()||'').toLowerCase(),m=file.match(/^island_(action|adjective|animal|body|city|clothes|color|family|food|home|job|land[1-8]|nature|question|school|season|sports|time|traffic|treasure)\.html$/);return m?m[1]:'';}catch(e){return '';}
  }
  function focusSessionId(){
    try{if(!window.crypto||typeof crypto.getRandomValues!=='function')return '';var a=new Uint8Array(16);crypto.getRandomValues(a);var h='';for(var i=0;i<a.length;i++)h+=('0'+a[i].toString(16)).slice(-2);return 'sbf_'+h;}catch(e){return '';}
  }
  function focusAllowed(index){
    try{
      var gate=window.HansenSpellingProgressV946;if(gate&&typeof gate.allows==='function')return gate.allows('crystal',index)===true;
      var crystal=window.HansenCrystal;if(!crystal||typeof crystal.sliceProgress!=='function')return false;
      var snap=crystal.sliceProgress(),item=snap&&snap.ok&&snap.items&&snap.items[index];
      return !!(item&&!item.done&&!item.lockedToday);
    }catch(e){return false;}
  }
  function openFrame(islandKey,focus){
      if(document.getElementById(OV_ID)) return; /* 已打开, 防重复 */
      var ov = document.createElement('div');
      ov.id = OV_ID;
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', '拼写对战');
      /* z-index 盖过岛内最高层(2147483400) */
      ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;'
        + 'z-index:2147483600;background:#0a0f24;overflow:hidden;';
      var ifr = document.createElement('iframe');
      ifr.title = '拼写对战';
      ifr.src = 'spelling_bee.html?v=1056&island=' + encodeURIComponent(islandKey || '') + '&embed=1'
        +(focus?'&focus=crystal&index='+encodeURIComponent(focus.index)+'&session='+encodeURIComponent(focus.sessionId):'');
      ifr.style.cssText = 'display:block;width:100%;height:100%;border:0;margin:0;padding:0;background:#0a0f24;';
      ifr.setAttribute('allow', 'autoplay');
      ifr.setAttribute('scrolling', 'no');
      ov.appendChild(ifr);
      document.body.appendChild(ov);
      activeFrame = ifr;activeFocus=focus||null;
      lockScroll(true);
      /* 硬件/手势返回键 → 关覆盖层(而不是离开岛) */
      try{ history.pushState({ hsnSb: 1 }, ''); }catch(e){}
      window.addEventListener('popstate', onPop);
      return true;
  }
  function openFocused(index){
    index=Number(index);var island=currentIslandKey(),word=null,api=window.HansenSpellingProgressV946;
    if(!island||!isFinite(index)||Math.floor(index)!==index||index<0||!window.allW||index>=allW.length)return false;
    word=String((allW[index]||{}).en||'').trim().toLowerCase();if(!word||word.length>120)return false;
    if(!api||typeof api.run!=='function'||!focusAllowed(index)){try{if(typeof showToast==='function')showToast('这个词今天已完成结晶加固，请明天再来');}catch(e){}return false;}
    var session=focusSessionId();if(!session)return false;
    return openFrame(island,{sessionId:session,channel:'crystal',island:island,index:index,word:word,openedAt:Date.now(),consumed:false});
  }

  window.HansenSpellBee = {
    /* islandKey: 当前岛 key(如 'animal'), 用于 spelling_bee 只考本岛单词 */
    open: function(islandKey){
      return openFrame(islandKey,null);
    },
    /* 探索单词的知识结晶专用入口。词位与当日资格都由父页先验，URL 不是授权。 */
    openFocused:openFocused,
    openFocus:openFocused, /* 兼容开发期调用名 */
    close: function(){ doClose(false); }
  };

  /* v942 奖励跨 iframe 事务：Bee 子页先把稳定 rewardId + 金币/经验写入同源 pending，
     父页只接受 pending 中完全匹配的收据。金币与 XP 各自用稳定 source 幂等入账；两边都确认后
     才回 ACK。消息或 ACK 丢失时子页会重发，同一 rewardId 只会结算一次。 */
  var SB_REWARD_PENDING_KEY = 'hansen_sb_reward_pending_v942';
  function sbObject(key){
    try{var o=JSON.parse(localStorage.getItem(key)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:null;}catch(e){return null;}
  }
  function sbExactKeys(o,names){return !!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===names.slice().sort().join(',');}
  function sbRewardReceipt(d){
    var id=String(d&&d.rewardId||'');
    if(!/^sb:\d{4}-\d{1,2}-\d{1,2}:\d{1,12}$/.test(id))return null;
    var pending=sbObject(SB_REWARD_PENDING_KEY);if(!pending)return null;
    var r=pending[id];if(!r||r.schema!==1||r.rewardId!==id)return null;
    var c=+r.coins,x=+r.xp,kind=String(r.kind||''),day=String(r.day||''),createdAt=+r.createdAt;
    if(id.indexOf('sb:'+day+':')!==0||!/^\d{4}-\d{1,2}-\d{1,2}$/.test(day))return null;
    if(!isFinite(createdAt)||Math.floor(createdAt)!==createdAt||createdAt<=0)return null;
    if(kind==='mastery'){
      if(!sbExactKeys(r,['schema','rewardId','day','coins','xp','kind','word','index','createdAt'])||c!==0||x!==0)return null;
      var word=String(r.word||''),idx=+r.index;
      if(!word||word!==word.trim().toLowerCase()||word.length>120||!isFinite(idx)||Math.floor(idx)!==idx||idx<0||idx>9999)return null;
      if(!d||d.type!=='hsn_sb_mastery'||d.coins!==0||d.xp!==0||String(d.kind||'')!=='mastery'||
         String(d.word||'')!==word||d.index!==idx||d.createdAt!==createdAt)return null;
      return {schema:1,rewardId:id,day:day,coins:0,xp:0,kind:'mastery',word:word,index:idx,createdAt:createdAt};
    }
    if(!sbExactKeys(r,['schema','rewardId','day','coins','xp','kind','createdAt']))return null;
    if(!isFinite(c)||Math.floor(c)!==c||c<1 || c>20||!isFinite(x)||Math.floor(x)!==x||x<0 || x>6)return null;
    if((kind==='word'&&!(x===2||x===4||x===6))||(kind==='match'&&(x!==0||c>15))||(kind!=='word'&&kind!=='match'))return null;
    /* postMessage 只是通知，不是真相；金额必须和子页已落盘收据逐字段一致。 */
    if(!d||d.type!=='hsn_sb_reward'||d.coins!==c||d.xp!==x||String(d.kind||'')!==kind||d.createdAt!==createdAt)return null;
    return {schema:1,rewardId:id,day:day,coins:c,xp:x,kind:kind,createdAt:createdAt};
  }
  function sbAwardReward(r){
    var base='spellbee:'+r.rewardId;
    try{
      if(!window.HansenCoins||typeof HansenCoins.award!=='function'||HansenCoins.award(base+':coin',r.coins)!==true)return false;
      if(r.xp>0){
        if(!window.HansenRewardEffectsV942||typeof HansenRewardEffectsV942.xpAward!=='function'||
           HansenRewardEffectsV942.xpAward(base+':xp',r.xp)!==true)return false;
      }
      return true;
    }catch(e){return false;}
  }
  function sbAck(target,id){
    try{if(target&&typeof target.postMessage==='function')target.postMessage({type:'hsn_sb_reward_ack',rewardId:id},'*');}catch(e){}
  }

  var SB_FOCUS_PENDING_KEY='hansen_sb_focus_pending_v946';
  function focusRule(cpm){cpm=Math.floor(Number(cpm));return cpm>=80?{tier:'advanced',required:5}:(cpm>=50?{tier:'intermediate',required:7}:{tier:'beginner',required:10});}
  function sameFocusProof(a,b){
    var keys=['schema','sessionId','focused','channel','island','index','word','cpm','tier','required','wins','attempts','createdAt'];
    if(!sbExactKeys(a,keys))return false;for(var i=0;i<keys.length;i++)if(a[keys[i]]!==b[keys[i]])return false;return true;
  }
  function focusReceipt(d){
    var msgKeys=['type','schema','sessionId','focused','channel','island','index','word','cpm','tier','required','wins','attempts','createdAt'];
    if(!activeFocus||!sbExactKeys(d,msgKeys)||d.type!=='hsn_sb_focus_complete'||d.schema!==1||d.focused!==true||d.channel!=='crystal'||
       d.sessionId!==activeFocus.sessionId||d.island!==activeFocus.island||d.index!==activeFocus.index||d.word!==activeFocus.word||
       !/^sbf_[a-f0-9]{32}$/.test(String(d.sessionId||''))||!isFinite(d.cpm)||Math.floor(d.cpm)!==d.cpm||d.cpm<10||d.cpm>200||
       !isFinite(d.required)||Math.floor(d.required)!==d.required||!isFinite(d.wins)||Math.floor(d.wins)!==d.wins||
       !isFinite(d.attempts)||Math.floor(d.attempts)!==d.attempts||d.attempts<d.wins||d.attempts>100000||
       !isFinite(d.createdAt)||Math.floor(d.createdAt)!==d.createdAt||d.createdAt<activeFocus.openedAt||d.createdAt>Date.now()+60000)return null;
    var rule=focusRule(d.cpm);if(d.tier!==rule.tier||d.required!==rule.required||d.wins!==d.required)return null;
    if(!window.allW||d.index<0||d.index>=allW.length||String((allW[d.index]||{}).en||'').trim().toLowerCase()!==d.word)return null;
    var pending=sbObject(SB_FOCUS_PENDING_KEY),stored=pending&&pending[d.sessionId];if(!stored||!sameFocusProof(stored,d))return null;
    return stored;
  }
  function settleFocus(r,target){
    var api=window.HansenSpellingProgressV946;if(!api||typeof api.run!=='function'||!activeFocus)return false;
    var meta={mode:'spelling-bee',focused:true,complete:true,exact:true,sessionId:r.sessionId,cpm:r.cpm,botCpm:r.cpm,required:r.required,wins:r.wins,correct:r.wins,attempts:r.attempts};
    var out=null;
    try{out=api.run('crystal',r.index,meta,function(){return typeof window.markAnswer==='function'?window.markAnswer(r.index,true):false;});}catch(e){out=null;}
    if(!out||out.ok!==true||out.consumed!==true)return false;
    activeFocus.consumed=true;
    try{if(target&&typeof target.postMessage==='function')target.postMessage({type:'hsn_sb_focus_ack',sessionId:r.sessionId},'*');}catch(e2){return false;}
    return true;
  }

  /* 拼写对战奖励(v942): spelling_bee.html 每答对一词先持久化带稳定 rewardId 的 receipt，再 postMessage。
     父页核对当前 iframe + 同源 pending 后，通过 HansenCoins.award 与 XP 幂等奖励事务入账，最后 ACK。
     因此消息/ACK 丢失、页面重载或重复投递都只会续做同一笔，不会少发或多发。 */
  window.addEventListener('message', function(e){
    /* v941 安全边界：拒绝主页面、旧 iframe、第三方 iframe 和控制台伪造的 postMessage。 */
    if(!activeFrame || !activeFrame.contentWindow || !e || e.source !== activeFrame.contentWindow) return;
    var d = e && e.data;
    if(d&&d.type==='hsn_sb_focus_complete'){
      var focused=focusReceipt(d);if(focused)settleFocus(focused,e.source);return;
    }
    if(d && d.type === 'hsn_sb_mastery'){
      /* v946 以前遗留的普通 mastery pending 只做严格核验后 ACK 清理，绝不再推进
         宠物或结晶；否则旧 iframe/reload 能绕开探索页的拼写挑战门槛。 */
      var masteryReceipt=sbRewardReceipt(d);
      if(masteryReceipt&&masteryReceipt.kind==='mastery'&&window.allW&&masteryReceipt.index>=0&&masteryReceipt.index<allW.length&&
         String((allW[masteryReceipt.index]||{}).en||'').trim().toLowerCase()===masteryReceipt.word)sbAck(e.source,masteryReceipt.rewardId);
      return;
    }
    if(!d || d.type !== 'hsn_sb_reward') return;
    var receipt=sbRewardReceipt(d);if(!receipt)return;
    if(receipt.kind==='mastery')return;
    if(sbAwardReward(receipt))sbAck(e.source,receipt.rewardId);
  });
})();
