// hansen_backup_bootstrap_v944.js — 在任何玩家状态读取前恢复中断的全局备份事务
(function(root){
  'use strict';
  if(!root||root.__hansenBackupBootstrapLoaded)return;root.__hansenBackupBootstrapLoaded=true;

  // KEY remains v942 because it names the persisted journal schema. v960 accepts
  // compatible journals v942-v946 and v950-v960; skipped v947-v949 fail closed.
  var KEY='hansen_backup_restore_journal_v942',SCHEMA=1,CURRENT_APP_VERSION=1025,MIN_JOURNAL_APP_VERSION=942;
  var MAX_ITEMS=1200,MAX_VALUE=2*1024*1024,MAX_TOTAL=12*1024*1024;
  var EXACT={ttsProvider:1,voiceName:1,theme:1,themeName:1,clickSoundEnabled:1,lastIslandKey:1,lastIslandTime:1,sb_best_cpm:1,hsnViewMode:1};
  var PREFIXES=['wordIsland','hansen_','hsn_','bs_hall_','hs_showcase_'];
  var DENY=/^(?:hansen_admin_|hansen_(?:land_)?card_temp_unlock_until$|hansen_autoOpen|hansen_bossfx_override$|hansen_snapshot_|hansen_freepass|hansen_blackbox|hsn_debug|hsn_test)|(?:password|passcode|token|secret|authorization|session)/i;
  var TRANSIENT=/(?:^|[_:\-.])(?:pending|journal|transaction|txn)(?:[_:\-.]|$)|(?:^|_)tmp(?:_|$)/i;
  function transientKey(k){return typeof k==='string'&&/^(?:wordIsland|hansen_|hsn_|bs_hall_|hs_showcase_)/.test(k)&&TRANSIENT.test(k);}
  function supportedJournalAppVersion(v){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&((v>=MIN_JOURNAL_APP_VERSION&&v<=946)||(v!==961&&v!==962&&v>=950&&v<=CURRENT_APP_VERSION));}
  function ownedKey(k){
    if(typeof k!=='string'||!k||k.length>160)return false;
    if(DENY.test(k)||transientKey(k))return false;
    if(EXACT[k])return true;
    if(/^(?:season1_prog|season_boss_perfect|season_word_mastery|season_wrong_words|land[1-8]_prog)$/.test(k))return true;
    for(var i=0;i<PREFIXES.length;i++)if(k.indexOf(PREFIXES[i])===0)return /^[A-Za-z0-9_:\-.]+$/.test(k);
    return false;
  }
  function allowed(k){return k!==KEY&&(ownedKey(k)||transientKey(k));}
  function stableItems(items){return items.map(function(x){return x.key+'\u0000'+x.value;}).join('\u0001');}
  function checksum(s){var h=2166136261;s=String(s||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv1a32-'+(h>>>0).toString(16).padStart(8,'0');}
  function validateSnapshot(list){
    if(!Array.isArray(list)||list.length>MAX_ITEMS*2)throw new Error('恢复日志快照数量无效');
    var seen={},total=0,out=[];
    list.forEach(function(x){
      if(!x||typeof x!=='object'||!allowed(x.key)||typeof x.value!=='string')throw new Error('恢复日志含非法玩家键');
      if(seen[x.key])throw new Error('恢复日志含重复键：'+x.key);seen[x.key]=1;
      var bytes=x.value.length*2;if(bytes>MAX_VALUE)throw new Error('恢复日志单项过大：'+x.key);total+=bytes;
      if(total>MAX_TOTAL*2)throw new Error('恢复日志快照总体积过大');
      out.push({key:x.key,value:x.value});
    });
    return out;
  }
  function removeJournal(){
    localStorage.removeItem(KEY);
    if(localStorage.getItem(KEY)!==null)throw new Error('恢复日志清理失败');
  }
  function restoreRaw(list){
    list=validateSnapshot(list);var remove=[];
    for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(allowed(k))remove.push(k);}
    remove.forEach(function(k){localStorage.removeItem(k);if(localStorage.getItem(k)!==null)throw new Error('原始玩家快照清理失败：'+k);});
    list.forEach(function(x){localStorage.setItem(x.key,x.value);if(localStorage.getItem(x.key)!==x.value)throw new Error('原始玩家快照回滚失败：'+x.key);});
  }
  function readJournal(){
    var raw=localStorage.getItem(KEY);if(raw===null)return null;
    var o;try{o=JSON.parse(raw);}catch(e){throw new Error('恢复日志 JSON 损坏');}
    if(!o||typeof o!=='object'||Array.isArray(o)||o.schema!==SCHEMA||!supportedJournalAppVersion(o.appVersion)||(o.phase!=='prepared'&&o.phase!=='committed'))throw new Error('恢复日志结构无效');
    var beforeRaw=validateSnapshot(o.beforeRaw);
    if(o.checksum!==checksum(stableItems(beforeRaw)))throw new Error('恢复日志校验和不匹配');
    return {phase:o.phase,beforeRaw:beforeRaw};
  }
  function recover(){
    var j=readJournal();if(!j)return {recovered:false};
    // prepared = 目标尚未提交，不论中断在哪一步都回到恢复前。
    // committed = 目标已全部验证，只清理收尾标记。
    if(j.phase==='prepared')restoreRaw(j.beforeRaw);
    removeJournal();
    return {recovered:true,rolledBack:j.phase==='prepared',committed:j.phase==='committed'};
  }
  function block(reason){
    root.__hansenBackupRecoveryBlocked=String(reason||'未知错误');
    try{if(typeof root.stop==='function')root.stop();}catch(e){}
    try{
      /* document.write 在 parser 中既可能阻塞，也可能把安全页插进原页面而不是替换。
         v942 直接用 DOM 节点替换 documentElement；所有文字均走 textContent。 */
      var doc=document,html=doc.documentElement||doc.createElement('html'),head=doc.createElement('head'),body=doc.createElement('body');
      function el(tag,text,cls){var n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
      html.lang='zh-CN';
      var charset=doc.createElement('meta');charset.setAttribute('charset','utf-8');head.appendChild(charset);
      var viewport=doc.createElement('meta');viewport.setAttribute('name','viewport');viewport.setAttribute('content','width=device-width,initial-scale=1');head.appendChild(viewport);
      head.appendChild(el('title','存档安全保护'));
      var style=el('style','body{margin:0;background:#071126;color:#e5edf9;font-family:system-ui,-apple-system,sans-serif;display:grid;min-height:100vh;place-items:center;padding:20px;box-sizing:border-box}.p{max-width:620px;background:#101e3a;border:1px solid #36507b;border-radius:18px;padding:24px;box-shadow:0 18px 50px #0008}h1{font-size:22px;color:#fca5a5}p{line-height:1.7;color:#cbd5e1}.r{padding:10px;border-radius:10px;background:#071126;color:#fde68a;word-break:break-all}button{margin:8px 8px 0 0;padding:10px 14px;border:0;border-radius:10px;font-weight:800;cursor:pointer}.primary{background:#60a5fa;color:#071126}.danger{background:#7f1d1d;color:#fff}');head.appendChild(style);
      var main=el('main',undefined,'p');
      main.appendChild(el('h1','🛡️ 已停止加载，避免扩大存档损坏'));
      main.appendChild(el('p','上一次完整备份恢复没有正常收尾，且持久化恢复日志无法通过校验。系统已保留原日志，没有继续写入玩家数据。'));
      var reasonEl=el('div',root.__hansenBackupRecoveryBlocked,'r');reasonEl.id='hsnRecoveryReason';main.appendChild(reasonEl);
      main.appendChild(el('p','先点“导出恢复日志”保留证据；“重新尝试”不会删除任何数据。只有在你已保存日志且接受可能处于半恢复状态时，才使用“放弃日志并继续”。'));
      var exportBtn=el('button','导出恢复日志','primary');exportBtn.id='hsnRecoveryExport';main.appendChild(exportBtn);
      var retry=el('button','重新尝试');retry.id='hsnRecoveryRetry';main.appendChild(retry);
      var discard=el('button','放弃日志并继续','danger');discard.id='hsnRecoveryDiscard';main.appendChild(discard);
      body.appendChild(main);
      if(typeof html.replaceChildren==='function')html.replaceChildren(head,body);
      else{while(html.firstChild)html.removeChild(html.firstChild);html.appendChild(head);html.appendChild(body);}
      if(!html.parentNode&&doc.appendChild)doc.appendChild(html);
      var exported=false;
      if(exportBtn)exportBtn.onclick=function(){
        try{var raw=localStorage.getItem(KEY)||'';var blob=new Blob([raw],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='wordminiprogram_v1025_restore_journal.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);exported=true;}catch(e){alert('导出失败：'+e.message);}
      };
      if(retry)retry.onclick=function(){location.reload();};
      if(discard)discard.onclick=function(){
        if(!exported){alert('请先导出恢复日志。');return;}
        if(!confirm('放弃日志后无法自动回滚到恢复前。确定继续吗？')||!confirm('最后确认：删除恢复日志并重新加载？'))return;
        try{removeJournal();location.reload();}catch(e){alert('日志仍未删除：'+e.message);}
      };
    }catch(e){try{console.error('[v960 backup bootstrap] '+reason,e);}catch(_e){}}
  }

  var result;
  try{result=recover();}
  catch(e){result={recovered:false,blocked:true,error:e.message};block(e.message);}
  root.__hansenBackupBootstrap={journalKey:KEY,recover:recover,result:result};
})(typeof window!=='undefined'?window:this);
