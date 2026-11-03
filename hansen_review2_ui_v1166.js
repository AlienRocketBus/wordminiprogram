/* hansen_review2_ui_v1166.js — 复习系统 2.0 · 界面
 * ============================================================================
 * 只管画和点：出题、判对错、写账本、发金币全在 hansen_review2_v1166.js（HansenReview2）里。
 *   open()          今天的复习（全屏浮层）：听音选意思 / 看图选单词 / 看中文拼单词
 *   openParent()    给家长和老师看的只读面板 + 学习报告图
 *   mountEntry(el)  在某个容器里放一个「今天复习 N 个词」按钮（接线时用）
 * 规矩：按钮至少 44px 高；颜色全用现有配色变量（--pal-*），亮色/暗色主题都看得清；
 *       声音只走页面的 speak()（静音规则照旧：静音时自动朗读被吞，孩子点 🔊 那一下照样能听）。
 * 另外：页面在前台、最近一分钟有点按，就记一分钟学习时间（家长面板用）。
 * ============================================================================ */
(function(root){
  'use strict';
  if(!root||!root.document||root.HansenReview2UI)return;
  var doc=root.document;
  var ROOT_ID='hr2_root',STYLE_ID='hr2_style';
  var CORRECT_MS=900;
  var state={session:null,busy:false,spell:null,timer:0,lastRes:null,view:''};

  function R(){return root.HansenReview2||null;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function say(en){try{if(typeof root.speak==='function')root.speak(String(en||''));}catch(e){}}
  function beep(ok){try{if(ok&&typeof root.playCorrect==='function')root.playCorrect();else if(!ok&&typeof root.playWrong==='function')root.playWrong();}catch(e){}}
  function stars(n){n=Math.max(0,Math.min(5,Number(n)||0));var s='';for(var i=0;i<5;i++)s+=i<n?'★':'☆';return s;}
  function picHtml(markup,big){
    var r=R(),e=String(markup||'');if(!e)return '';
    if(e.indexOf('<')>=0)return r&&r.safeMarkup(e)?'<span class="hr2-pic'+(big?' big':'')+'" aria-hidden="true">'+e+'</span>':'';
    return '<span class="hr2-pic'+(big?' big':'')+'" aria-hidden="true">'+esc(e)+'</span>';
  }

  // ---------- 样式（只用现有配色变量，带深色兜底） ----------
  function css(){
    return [
      '#hr2_root{--hr2-bg:var(--pal-surf-1,#0f172a);--hr2-card:var(--pal-surf-2,#1e293b);--hr2-card2:var(--pal-surf-3,#334155);',
      '--hr2-ink:var(--pal-ink,#ffffff);--hr2-ink2:var(--pal-ink-2,#cbd5e1);--hr2-ink3:var(--pal-ink-3,#94a3b8);',
      '--hr2-line:rgba(var(--pal-line-rgb,148,163,184),.38);--hr2-hi:var(--pal-accent-text,#fde68a);',
      'position:fixed;inset:0;z-index:99990;background:var(--hr2-bg);color:var(--hr2-ink);display:flex;flex-direction:column;',
      'font-family:var(--font-body,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif);overflow:hidden;-webkit-text-size-adjust:100%}',
      '#hr2_root *{box-sizing:border-box}',
      '#hr2_root button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
      '#hr2_root .hr2-top{display:flex;align-items:center;gap:10px;padding:max(10px,env(safe-area-inset-top)) 14px 8px}',
      '#hr2_root .hr2-x{min-width:48px;min-height:48px;border-radius:14px;border:1px solid var(--hr2-line);background:var(--hr2-card);font-size:20px}',
      '#hr2_root .hr2-title{flex:1;font-size:17px;font-weight:800;text-align:center}',
      '#hr2_root .hr2-prog{min-width:48px;text-align:right;font-size:16px;font-weight:800;color:var(--hr2-ink2)}',
      '#hr2_root .hr2-bar{height:8px;margin:0 14px 8px;border-radius:8px;background:var(--hr2-card2);overflow:hidden}',
      '#hr2_root .hr2-bar>i{display:block;height:100%;width:0;background:#22c55e;border-radius:8px}',
      '#hr2_root .hr2-main{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px 16px max(18px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center}',
      '#hr2_root .hr2-main>*{flex-shrink:0}',   /* 长页面（家长面板）里条形图不能被压成 0 高 */
      '#hr2_root .hr2-card{width:100%;max-width:440px;background:var(--hr2-card);border:1px solid var(--hr2-line);border-radius:22px;padding:18px 16px;text-align:center;margin:4px 0 14px}',
      '#hr2_root .hr2-ask{font-size:16px;color:var(--hr2-ink2);font-weight:700;margin-bottom:10px}',
      '#hr2_root .hr2-cn{font-size:28px;font-weight:900;line-height:1.3;margin:6px 0}',
      '#hr2_root .hr2-en{font-size:36px;font-weight:900;letter-spacing:.5px;margin:4px 0;word-break:break-word}',
      '#hr2_root .hr2-pn{font-size:16px;color:var(--hr2-ink2)}',
      '#hr2_root .hr2-pic{display:inline-block;font-size:56px;line-height:1.1}',
      '#hr2_root .hr2-pic.big{font-size:84px}',
      '#hr2_root .hr2-pic svg,#hr2_root .hr2-pic img{width:1.4em;height:1.4em;vertical-align:middle}',
      '#hr2_root .hr2-speak{width:112px;height:112px;border-radius:50%;border:0;background:#2563eb;color:#ffffff;font-size:44px;box-shadow:0 6px 18px rgba(0,0,0,.25)}',
      '#hr2_root .hr2-hint{font-size:14px;color:var(--hr2-ink2);margin-top:8px}',
      '#hr2_root .hr2-opts{width:100%;max-width:440px;display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '#hr2_root .hr2-opts.one{grid-template-columns:1fr}',
      '#hr2_root .hr2-opt{min-height:64px;padding:10px 12px;border-radius:16px;border:2px solid var(--hr2-line);background:var(--hr2-card);font-size:20px;font-weight:800;line-height:1.25;word-break:break-word}',
      '#hr2_root .hr2-opt.ok{background:#16a34a;border-color:#16a34a;color:#ffffff}',
      '#hr2_root .hr2-opt.no{border-color:#e11d48;border-style:dashed;opacity:.75}',
      '#hr2_root .hr2-slots{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:12px 0 4px}',
      '#hr2_root .hr2-slot{min-width:38px;height:48px;border-radius:10px;border:2px solid var(--hr2-line);background:var(--hr2-bg);font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 4px}',
      '#hr2_root .hr2-slot.fixed{border:0;background:transparent;min-width:14px}',
      '#hr2_root .hr2-tiles{width:100%;max-width:440px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:4px 0 12px}',
      '#hr2_root .hr2-tile{min-width:52px;min-height:56px;border-radius:14px;border:2px solid var(--hr2-line);background:var(--hr2-card2);font-size:26px;font-weight:900}',
      '#hr2_root .hr2-tile[disabled]{opacity:.25}',
      '#hr2_root .hr2-row{width:100%;max-width:440px;display:flex;gap:10px;margin-top:4px}',
      '#hr2_root .hr2-btn{flex:1;min-height:56px;border-radius:16px;border:1px solid var(--hr2-line);background:var(--hr2-card);font-size:18px;font-weight:800;padding:8px 10px}',
      '#hr2_root .hr2-btn.go{background:#2563eb;border-color:#2563eb;color:#ffffff}',
      '#hr2_root .hr2-btn.big{min-height:64px;font-size:20px}',
      '#hr2_root .hr2-msg{min-height:28px;font-size:18px;font-weight:800;margin:8px 0}',
      '#hr2_root .hr2-lesson{border-width:2px;border-style:dashed}',
      '#hr2_root .hr2-tiny{font-size:14px;color:var(--hr2-ink2);margin-top:6px}',
      '#hr2_root .hr2-stats{width:100%;max-width:440px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 12px}',
      '#hr2_root .hr2-stat{background:var(--hr2-card);border:1px solid var(--hr2-line);border-radius:16px;padding:12px 6px;text-align:center}',
      '#hr2_root .hr2-stat b{display:block;font-size:28px;font-weight:900}',
      '#hr2_root .hr2-stat span{font-size:14px;color:var(--hr2-ink2)}',
      '#hr2_root .hr2-list{width:100%;max-width:440px;list-style:none;margin:0 0 12px;padding:0}',
      '#hr2_root .hr2-list li{display:flex;align-items:center;gap:10px;background:var(--hr2-card);border:1px solid var(--hr2-line);border-radius:14px;padding:8px 10px;margin-bottom:8px;min-height:52px}',
      '#hr2_root .hr2-list .w{flex:1;min-width:0;text-align:left;font-size:17px;font-weight:800;word-break:break-word}',
      '#hr2_root .hr2-list .w small{display:block;font-size:14px;font-weight:600;color:var(--hr2-ink2)}',
      '#hr2_root .hr2-list .st{font-size:16px;letter-spacing:1px;color:var(--hr2-hi);white-space:nowrap}',
      '#hr2_root .hr2-say{min-width:48px;min-height:44px;border-radius:12px;border:1px solid var(--hr2-line);background:var(--hr2-card2);font-size:20px}',
      '#hr2_root h3{width:100%;max-width:440px;font-size:17px;margin:8px 0 8px;text-align:left}',
      '#hr2_root .hr2-dist{width:100%;max-width:440px;display:flex;height:22px;border-radius:11px;overflow:hidden;background:var(--hr2-card2);margin:4px 0 6px}',
      '#hr2_root .hr2-dist i{display:block;height:100%}',
      '#hr2_root .hr2-legend{width:100%;max-width:440px;display:flex;flex-wrap:wrap;gap:6px 12px;font-size:14px;color:var(--hr2-ink2);margin-bottom:10px}',
      '#hr2_root .hr2-legend em{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-1px}',
      '#hr2_root .hr2-days{width:100%;max-width:440px;display:flex;align-items:flex-end;gap:6px;height:110px;margin:4px 0 12px}',
      '#hr2_root .hr2-days div{flex:1;text-align:center;font-size:12px;color:var(--hr2-ink2)}',
      '#hr2_root .hr2-days i{display:block;margin:0 auto 4px;width:70%;min-height:3px;border-radius:6px 6px 2px 2px;background:#3b82f6}',
      '#hr2_root .hr2-input{width:100%;max-width:440px;min-height:48px;border-radius:14px;border:1px solid var(--hr2-line);background:var(--hr2-card);color:var(--hr2-ink);font-size:17px;padding:8px 12px;margin-bottom:10px}',
      '#hr2_root .hr2-report{width:100%;max-width:440px;border-radius:14px;border:1px solid var(--hr2-line);margin:8px 0}',
      '#hr2_root table{width:100%;max-width:440px;border-collapse:collapse;font-size:15px;margin-bottom:12px}',
      '#hr2_root td,#hr2_root th{padding:8px 6px;border-bottom:1px solid var(--hr2-line);text-align:center}',
      '#hr2_root td:first-child,#hr2_root th:first-child{text-align:left}',
      '.hr2-entry{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:10px 16px;border-radius:18px;border:1px solid rgba(var(--pal-line-rgb,148,163,184),.38);background:var(--pal-surf-2,#1e293b);color:var(--pal-ink,#ffffff);font-size:18px;font-weight:800;text-align:left;cursor:pointer}',
      '.hr2-entry small{display:block;font-size:14px;font-weight:600;color:var(--pal-ink-2,#cbd5e1)}',
      '@media (prefers-reduced-motion:no-preference){#hr2_root .hr2-bar>i{transition:width .3s}#hr2_root .hr2-opt,#hr2_root .hr2-tile{transition:background .15s,transform .1s}#hr2_root .hr2-opt:active,#hr2_root .hr2-tile:active,#hr2_root .hr2-btn:active{transform:scale(.97)}}'
    ].join('\n');
  }
  function ensureStyle(){if(doc.getElementById(STYLE_ID))return;var s=doc.createElement('style');s.id=STYLE_ID;s.textContent=css();(doc.head||doc.documentElement).appendChild(s);}
  function shell(title){
    ensureStyle();clearTimeout(state.timer);
    var el=doc.getElementById(ROOT_ID);
    if(!el){el=doc.createElement('div');el.id=ROOT_ID;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');doc.body.appendChild(el);}
    el.innerHTML='<div class="hr2-top"><button class="hr2-x" data-act="close" aria-label="关闭">✕</button><div class="hr2-title">'+esc(title)+'</div><div class="hr2-prog" id="hr2_prog"></div></div>'
      +'<div class="hr2-bar"><i id="hr2_fill"></i></div><div class="hr2-main" id="hr2_main"></div>';
    el.onclick=onClick;
    var bar=el.querySelector('.hr2-bar');if(bar)bar.style.visibility=state.view==='quiz'?'visible':'hidden';
    return doc.getElementById('hr2_main');
  }
  function close(){
    clearTimeout(state.timer);
    var s=state.session;if(s&&!s.finished&&s.results.length){try{R().finishSession(s);}catch(e){}}
    state.session=null;state.spell=null;state.busy=false;state.view='';
    var el=doc.getElementById(ROOT_ID);if(el&&el.parentNode)el.parentNode.removeChild(el);
    try{root.dispatchEvent(new CustomEvent('hansen-review2-closed'));}catch(e){}
  }

  // ---------- 今天的复习 ----------
  function open(opts){
    var r=R();if(!r)return false;
    opts=opts||{};
    var ov=r.overview();
    if(!ov.ok){renderError(ov.reason);return false;}
    if(!opts.practice&&ov.sessionSize===0){renderEmpty(ov.practiceCount);return true;}
    var s=r.buildSession({practice:!!opts.practice});
    if(!s.ok){renderError(s.reason);return false;}
    if(!s.total){renderEmpty(0);return true;}
    state.session=s;state.view='quiz';
    shell(s.kind==='practice'?'练一练':'今天复习 '+s.dueTotal+' 个词');
    renderQuestion();
    return true;
  }
  function setProgress(){
    var s=state.session;if(!s)return;
    var p=doc.getElementById('hr2_prog'),f=doc.getElementById('hr2_fill');
    if(p)p.textContent=Math.min(s.pos+1,s.total)+' / '+s.total;
    if(f)f.style.width=Math.round(s.pos/Math.max(1,s.total)*100)+'%';
  }
  function renderQuestion(){
    var s=state.session,r=R(),q=r&&r.current(s),main=doc.getElementById('hr2_main');
    if(!main)return;
    if(!q){renderResult();return;}
    state.busy=false;setProgress();
    var h='',tag=q.retry?'<div class="hr2-tiny">再考一次 · 不算分</div>':'';
    if(q.mode==='listen'){
      h+='<div class="hr2-card">'+tag+'<div class="hr2-ask">听一听，选出它的意思</div>'
        +'<button class="hr2-speak" data-act="speak" aria-label="点我听发音">🔊</button><div class="hr2-hint">听不到？点喇叭再听一次</div></div>';
    }else if(q.mode==='picture'){
      h+='<div class="hr2-card">'+tag+'<div class="hr2-ask">看图，选出这个单词</div>'+picHtml(q.pic,true)+'<div class="hr2-cn">'+esc(q.cn)+'</div></div>';
    }else{
      h+='<div class="hr2-card">'+tag+'<div class="hr2-ask">看中文，拼出这个单词</div>'+(q.pic?picHtml(q.pic,false):'')+'<div class="hr2-cn">'+esc(q.cn)+'</div>'
        +'<div class="hr2-slots" id="hr2_slots"></div></div>';
    }
    if(q.mode==='spell'){
      state.spell={picked:[],hinted:false};
      h+='<div class="hr2-tiles" id="hr2_tiles">'+q.tiles.map(function(c,i){return '<button class="hr2-tile" data-act="tile" data-i="'+i+'">'+esc(c)+'</button>';}).join('')+'</div>'
        +'<div class="hr2-row"><button class="hr2-btn" data-act="back" aria-label="删一个">⌫ 删一个</button><button class="hr2-btn" data-act="hint">🔊 听一听</button></div>';
    }else{
      var long=q.options.some(function(o){return String(o.label).length>8;});
      h+='<div class="hr2-opts'+(long?' one':'')+'">'+q.options.map(function(o,i){return '<button class="hr2-opt" data-act="opt" data-i="'+i+'">'+esc(o.label)+'</button>';}).join('')+'</div>';
    }
    h+='<div class="hr2-msg" id="hr2_msg" aria-live="polite"></div>';
    main.innerHTML=h;main.scrollTop=0;
    if(q.mode==='spell')drawSlots();
    if(q.mode==='listen')say(q.en);   // 静音时会被吞掉，孩子点 🔊 就能听
  }
  function drawSlots(){
    var q=R().current(state.session),box=doc.getElementById('hr2_slots');if(!q||!box||!state.spell)return;
    var k=0,picked=state.spell.picked;
    box.innerHTML=q.slots.map(function(sl){
      if(!sl.letter)return '<span class="hr2-slot fixed">'+esc(sl.ch===' '?' ':sl.ch)+'</span>';
      var i=picked[k++];return '<span class="hr2-slot">'+(i===undefined?'':esc(q.tiles[i]))+'</span>';
    }).join('');
    var tiles=doc.querySelectorAll('#hr2_tiles .hr2-tile');
    for(var t=0;t<tiles.length;t++)tiles[t].disabled=picked.indexOf(t)>=0;
  }
  function spelled(q){
    var k=0,picked=state.spell.picked;
    return q.slots.map(function(sl){return sl.letter?(q.tiles[picked[k++]]||''):sl.ch;}).join('');
  }
  function onClick(ev){
    var t=ev.target;while(t&&t!==ev.currentTarget&&!(t.getAttribute&&t.getAttribute('data-act')))t=t.parentNode;
    if(!t||t===ev.currentTarget)return;
    var act=t.getAttribute('data-act'),r=R(),s=state.session,q=r&&s?r.current(s):null;
    if(act==='close'){close();return;}
    if(act==='say'){say(t.getAttribute('data-en'));return;}
    if(act==='parent'){openParent();return;}
    if(act==='practice'){open({practice:true});return;}
    if(act==='report'){makeReport();return;}
    if(act==='next'){renderQuestion();return;}
    if(!q||state.busy)return;
    if(act==='speak'){say(q.en);return;}
    if(act==='opt'){submit({choice:Number(t.getAttribute('data-i'))},t);return;}
    if(q.mode!=='spell'||!state.spell)return;
    if(act==='hint'){state.spell.hinted=true;say(q.en);var m=doc.getElementById('hr2_msg');if(m)m.textContent='听了提示也算对，不过「自己拼出来」的星星要下次不听再拼';return;}
    if(act==='back'){state.spell.picked.pop();drawSlots();return;}
    if(act==='tile'){
      var i=Number(t.getAttribute('data-i'));if(state.spell.picked.indexOf(i)>=0)return;
      var need=q.slots.filter(function(x){return x.letter;}).length;if(state.spell.picked.length>=need)return;
      state.spell.picked.push(i);drawSlots();
      if(state.spell.picked.length===need)submit({text:spelled(q),hinted:state.spell.hinted},null);
    }
  }
  function submit(payload,btn){
    var r=R(),s=state.session,q=r.current(s);if(!q||state.busy)return;
    state.busy=true;
    var res=r.answer(s,payload);state.lastRes=res;
    if(!res.ok&&res.reason==='no-question'){state.busy=false;return;}
    var msg=doc.getElementById('hr2_msg');
    if(res.correct){
      if(btn)btn.classList.add('ok');
      if(msg)msg.textContent='✓ 答对了！'+(res.coins?' +'+res.coins+' 金币':'')+(res.graduated?' 🎓 这个词毕业啦':'');
      beep(true);say(q.en);
      if(!res.ok&&msg)msg.textContent+='（这题没记上，不影响继续）';
      state.timer=setTimeout(renderQuestion,CORRECT_MS);
    }else{
      beep(false);
      if(btn){btn.classList.add('no');var all=doc.querySelectorAll('#hr2_main .hr2-opt');if(all[q.answerIndex])all[q.answerIndex].classList.add('ok');}
      renderLesson(q,res);
    }
  }
  // 答错 = 一节小课：图、英文、音标、中文，读一遍；点「知道了」再继续
  function renderLesson(q,res){
    var main=doc.getElementById('hr2_main');if(!main)return;
    say(q.en);
    main.innerHTML='<div class="hr2-card hr2-lesson"><div class="hr2-ask">没关系，记住它：</div>'+picHtml(q.emoji,true)
      +'<div class="hr2-en">'+esc(q.en)+'</div>'+(q.pn?'<div class="hr2-pn">'+esc(q.pn)+'</div>':'')+'<div class="hr2-cn">'+esc(q.cn)+'</div>'
      +(q.retry?'':'<div class="hr2-tiny">这一轮最后还会再考一次</div>')
      +(res&&!res.ok&&!q.retry?'<div class="hr2-tiny">（这题没记上，不影响继续）</div>':'')+'</div>'
      +'<div class="hr2-row"><button class="hr2-btn" data-act="say" data-en="'+esc(q.en)+'">🔊 再听一次</button><button class="hr2-btn go" data-act="next">知道了 →</button></div>';
    state.busy=false;
  }
  function renderResult(){
    var r=R(),s=state.session;if(!s)return;
    var sum=r.finishSession(s)||{reviewed:0,correct:0,coins:0,starsUp:[],wrong:[],more:0};
    state.view='result';
    var main=doc.getElementById('hr2_main'),p=doc.getElementById('hr2_prog'),f=doc.getElementById('hr2_fill');
    if(p)p.textContent='';if(f)f.style.width='100%';if(!main)return;
    var byKey={};s.queue.forEach(function(q){byKey[q.key]=q;});
    var ups=s.results.filter(function(x){return !x.retry&&x.starsAfter>x.starsBefore;});
    var h='<div class="hr2-card"><div class="hr2-pic big" aria-hidden="true">🎉</div><div class="hr2-cn">'+(s.kind==='practice'?'练完啦！':'今天的复习完成！')+'</div>'
      +moreText(sum)+'</div>'
      +'<div class="hr2-stats"><div class="hr2-stat"><b>'+sum.reviewed+'</b><span>复习的词</span></div><div class="hr2-stat"><b>'+sum.correct+'</b><span>一次答对</span></div>'
      +'<div class="hr2-stat"><b>+'+sum.coins+'</b><span>金币</span></div></div>';
    if(ups.length){
      h+='<h3>⭐ 星星涨了</h3><ul class="hr2-list">'+ups.map(function(x){var q=byKey[x.key]||{};return '<li><span class="w">'+esc(q.en)+'<small>'+esc(q.cn)+'</small></span><span class="st" aria-label="'+x.starsAfter+' 颗星">'+stars(x.starsAfter)+'</span></li>';}).join('')+'</ul>';
    }
    if(sum.wrong.length){
      h+='<h3>🔁 再听一次这些词</h3><ul class="hr2-list">'+sum.wrong.map(function(k){var q=byKey[k]||{};return '<li><span class="w">'+esc(q.en)+'<small>'+esc(q.cn)+'</small></span><button class="hr2-say" data-act="say" data-en="'+esc(q.en)+'" aria-label="听 '+esc(q.en)+'">🔊</button></li>';}).join('')+'</ul>';
    }
    if(sum.unsaved)h+='<div class="hr2-tiny">有 '+sum.unsaved+' 题因为存储出了点问题没记上，明天还会再出现</div>';
    h+='<div class="hr2-row"><button class="hr2-btn" data-act="parent">给家长看</button><button class="hr2-btn go big" data-act="close">完成</button></div>';
    main.innerHTML=h;main.scrollTop=0;
    state.session=null;
    try{root.dispatchEvent(new CustomEvent('hansen-review2-finished',{detail:sum}));}catch(e){}
  }
  // 答错的词今天还要再试一次；超过 12 个的明天继续
  function moreText(sum){
    var w=s0(sum.wrong.length),back=Math.max(0,s0(sum.more)-w),out=[];
    if(w)out.push('答错的 '+w+' 个词今天要再试一次，等会儿再点「今天复习」');
    if(back)out.push('还有 '+back+' 个词明天继续');
    return '<div class="hr2-tiny">'+(out.length?out.join('；'):'大脑会在睡觉时悄悄记牢它们')+'</div>';
  }
  function s0(n){n=Number(n);return isFinite(n)&&n>0?Math.floor(n):0;}
  function renderEmpty(practiceCount){
    state.view='empty';var main=shell('今天复习');
    main.innerHTML='<div class="hr2-card"><div class="hr2-pic big" aria-hidden="true">🌈</div><div class="hr2-cn">今天没有要复习的词</div>'
      +'<div class="hr2-tiny">到了该复习的日子会再叫你</div></div>'
      +(practiceCount>0?'<div class="hr2-row"><button class="hr2-btn go big" data-act="practice">练练最弱的 '+practiceCount+' 个词</button></div>'
        +'<div class="hr2-tiny">练一练不给金币，但能让星星长得更快</div>'
        :'<div class="hr2-tiny">学过的词今天都练过了，去岛上学点新词吧</div>')
      +'<div class="hr2-row"><button class="hr2-btn" data-act="parent">给家长看</button><button class="hr2-btn" data-act="close">关闭</button></div>';
  }
  function renderError(reason){
    state.view='error';var main=shell('今天复习');
    main.innerHTML='<div class="hr2-card"><div class="hr2-pic big" aria-hidden="true">🧭</div><div class="hr2-cn">进度暂时读不到</div>'
      +'<div class="hr2-tiny">先去岛上玩一会儿，再回来试试（'+esc(reason||'')+'）</div></div>'
      +'<div class="hr2-row"><button class="hr2-btn go big" data-act="close">好的</button></div>';
  }

  // ---------- 家长 / 老师面板 ----------
  var STAR_COLORS=['#64748b','#93c5fd','#60a5fa','#34d399','#22c55e','#eab308'];
  function openParent(){
    var r=R();if(!r)return false;
    var rep=r.parentReport();
    state.session=null;state.view='parent';var main=shell('给家长和老师');
    if(!rep.ok){main.innerHTML='<div class="hr2-card"><div class="hr2-cn">进度暂时读不到</div></div>';return false;}
    var total=rep.totalWords,names=r.STAR_NAMES;
    var h='<div class="hr2-stats"><div class="hr2-stat"><b>'+rep.mastered+'</b><span>掌握了</span></div><div class="hr2-stat"><b>'+rep.strong+'</b><span>会拼(≥3星)</span></div>'
      +'<div class="hr2-stat"><b>'+rep.seen+'</b><span>学过的词</span></div></div>'
      +'<div class="hr2-tiny">一共 '+total+' 个不同的单词（同一个词在两个岛只算一次）</div>'
      +'<h3>掌握星分布</h3><div class="hr2-dist" role="img" aria-label="掌握星分布">'+rep.counts.map(function(n,i){return n?'<i style="width:'+(n/total*100).toFixed(2)+'%;background:'+STAR_COLORS[i]+'"></i>':'';}).join('')+'</div>'
      +'<div class="hr2-legend">'+rep.counts.map(function(n,i){return '<span><em style="background:'+STAR_COLORS[i]+'"></em>'+i+'星 '+names[i]+' '+n+'</span>';}).join('')+'</div>'
      +'<div class="hr2-stats"><div class="hr2-stat"><b>'+rep.streak.review+'</b><span>连续复习天数</span></div><div class="hr2-stat"><b>'+rep.week.m+'</b><span>这 7 天分钟</span></div>'
      +'<div class="hr2-stat"><b>'+rep.dueToday+'</b><span>今天要复习</span></div></div>';
    var maxM=Math.max(1,Math.max.apply(null,rep.days.map(function(d){return d.m;})));
    h+='<h3>每天学习分钟</h3><div class="hr2-days">'+rep.days.map(function(d){return '<div><i style="height:'+Math.round(d.m/maxM*80)+'px"></i>'+esc(d.day.slice(5))+'<br>'+d.m+'</div>';}).join('')+'</div>';
    h+='<h3>最需要练的词</h3>'+(rep.weakest.length?'<ul class="hr2-list">'+rep.weakest.map(function(w){return '<li><span class="w">'+esc(w.en)+'<small>'+esc(w.cn)+(w.wrongs?' · 错过 '+w.wrongs+' 次':'')+' · '+esc(w.islands.join('、'))+'</small></span><span class="st" aria-label="'+w.stars+' 颗星">'+stars(w.stars)+'</span><button class="hr2-say" data-act="say" data-en="'+esc(w.en)+'" aria-label="听 '+esc(w.en)+'">🔊</button></li>';}).join('')+'</ul>':'<div class="hr2-tiny">还没有学过的词</div>');
    h+='<h3>各岛</h3><table><tr><th>岛</th><th>学过</th><th>会拼</th><th>掌握</th></tr>'+rep.islands.filter(function(i){return i.seen;}).map(function(i){return '<tr><td>'+esc(i.name)+'</td><td>'+i.seen+'/'+i.words+'</td><td>'+i.strong+'</td><td>'+i.mastered+'</td></tr>';}).join('')+'</table>';
    h+='<h3>学习报告图</h3><input class="hr2-input" id="hr2_name" maxlength="12" placeholder="称呼（可不填，不会保存）" autocomplete="off">'
      +'<div class="hr2-row"><button class="hr2-btn go big" data-act="report">生成学习报告图</button></div><div id="hr2_reportbox"></div>'
      +'<div class="hr2-tiny">星星怎么算：在不同的日子里答对过几次、能不能不看提示自己拼出来；还在错题本或复习计划里的词，星星会先少一点。孩子自己点「我认识了」不算星。</div>'
      +'<div class="hr2-row" style="margin-top:12px"><button class="hr2-btn" data-act="close">关闭</button></div>';
    main.innerHTML=h;main.scrollTop=0;
    return true;
  }

  // ---------- 学习报告图（本机 canvas 画，不联网、不上传、不写真名手机号） ----------
  function drawReport(rep,opts){
    opts=opts||{};
    var W=750,H=1200,c=doc.createElement('canvas');c.width=W;c.height=H;
    var g=c.getContext('2d');if(!g)return null;
    var F='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    function txt(s,x,y,size,color,weight,align){g.font=(weight||'700')+' '+size+'px '+F;g.fillStyle=color;g.textAlign=align||'left';g.textBaseline='alphabetic';g.fillText(String(s),x,y);}
    function rect(x,y,w,h,r,color){g.fillStyle=color;g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();g.fill();}
    function fit(s,max,size){g.font='700 '+size+'px '+F;s=String(s);while(s.length>1&&g.measureText(s).width>max)s=s.slice(0,-1);return s;}
    var grd=g.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#1e3a8a');grd.addColorStop(1,'#0f172a');g.fillStyle=grd;g.fillRect(0,0,W,H);
    txt('单词大冒险 · 学习报告',40,86,44,'#ffffff','900');
    var who=String(opts.name||'').replace(/\d{5,}/g,'').trim().slice(0,12)||'小探险家';
    txt(who+'  ·  '+rep.today,40,132,26,'#bfdbfe','700');
    var boxes=[['掌握了',rep.mastered],['会拼(≥3星)',rep.strong],['学过的词',rep.seen]];
    boxes.forEach(function(b,i){var x=40+i*228;rect(x,160,210,140,22,'rgba(255,255,255,.10)');txt(b[1],x+105,240,60,'#fde68a','900','center');txt(b[0],x+105,282,24,'#e2e8f0','700','center');});
    txt('掌握星分布（共 '+rep.totalWords+' 个单词）',40,350,26,'#ffffff','800');
    var x0=40,bw=W-80,acc=0;rect(x0,366,bw,34,17,'rgba(255,255,255,.12)');
    rep.counts.forEach(function(n,i){if(!n)return;var w=n/rep.totalWords*bw;g.fillStyle=STAR_COLORS[i];g.fillRect(x0+acc,366,Math.max(2,w),34);acc+=w;});
    rep.counts.forEach(function(n,i){var x=40+(i%3)*228,y=440+Math.floor(i/3)*40;rect(x,y-20,20,20,4,STAR_COLORS[i]);txt(i+'星 '+n,x+30,y-2,22,'#e2e8f0','700');});
    rect(40,520,325,140,22,'rgba(255,255,255,.10)');rect(385,520,325,140,22,'rgba(255,255,255,.10)');
    txt(rep.streak.review+' 天',202,588,46,'#fde68a','900','center');txt('连续复习',202,636,22,'#e2e8f0','700','center');
    txt(rep.week.m+' 分钟',547,588,46,'#fde68a','900','center');txt('这 7 天学习',547,636,22,'#e2e8f0','700','center');
    txt('每天学习分钟',40,700,26,'#ffffff','800');
    var maxM=Math.max(1,Math.max.apply(null,rep.days.map(function(d){return d.m;})));
    rep.days.forEach(function(d,i){var x=60+i*96,h=Math.round(d.m/maxM*110);rect(x,830-h,56,Math.max(4,h),8,'#3b82f6');txt(d.m,x+28,822-h,20,'#e2e8f0','700','center');txt(d.day.slice(5),x+28,862,20,'#bfdbfe','700','center');});
    txt('最需要练的词',40,920,26,'#ffffff','800');
    rep.weakest.slice(0,5).forEach(function(w,i){var y=962+i*40;txt(fit(w.en,230,26),40,y,26,'#ffffff','800');txt(fit(w.cn,250,22),290,y,22,'#cbd5e1','700');txt(stars(w.stars),W-40,y,24,'#fde68a','700','right');});
    if(!rep.weakest.length)txt('还没有学过的词',40,962,22,'#cbd5e1','700');
    txt('在这台手机上生成 · 没有上传任何信息',W/2,H-34,20,'#94a3b8','600','center');
    return c;
  }
  function makeReport(){
    var r=R();if(!r)return;var rep=r.parentReport(),box=doc.getElementById('hr2_reportbox');if(!rep.ok||!box)return;
    var nameEl=doc.getElementById('hr2_name'),c=drawReport(rep,{name:nameEl?nameEl.value:''});
    if(!c){box.innerHTML='<div class="hr2-tiny">这台手机画不了图片</div>';return;}
    var url='';try{url=c.toDataURL('image/png');}catch(e){url='';}
    if(!url){box.innerHTML='<div class="hr2-tiny">这台手机画不了图片</div>';return;}
    box.innerHTML='<img class="hr2-report" id="hr2_reportimg" alt="学习报告图" src="'+url+'"><div class="hr2-tiny">长按图片保存，或直接发给老师</div>'
      +'<div class="hr2-row"><button class="hr2-btn" id="hr2_save">保存图片</button></div>';
    // 普通浏览器：就在这次点击里下载（微信里不支持下载，用上面的长按保存）
    var save=doc.getElementById('hr2_save');
    if(save)save.addEventListener('click',function(){
      var a=doc.createElement('a');a.href=url;a.download='学习报告_'+(R()?R().today():'')+'.png';doc.body.appendChild(a);a.click();a.parentNode.removeChild(a);
    });
  }

  // ---------- 首页入口按钮（接线时用） ----------
  function mountEntry(container){
    var r=R();if(!r||!container)return null;ensureStyle();
    var b=container.querySelector('.hr2-entry');
    if(!b){b=doc.createElement('button');b.type='button';b.className='hr2-entry';b.addEventListener('click',function(){open();});container.appendChild(b);}
    var ov=r.overview(),n=ov.ok?ov.sessionSize:0;
    b.innerHTML='<span aria-hidden="true" style="font-size:32px">🧠</span><span style="flex:1">'+(n?'今天复习 '+n+' 个词':'今天的复习做完啦')
      +'<small>'+(n?'大约 '+Math.max(1,Math.round(n*0.4))+' 分钟 · 听一听、拼一拼':'可以练练最弱的几个词')+'</small></span>';
    b.setAttribute('aria-label',n?'今天复习 '+n+' 个词':'今天的复习做完啦');
    return b;
  }

  // ---------- 学习分钟：页面在前台、最近一分钟有点按 ----------
  var act={last:0,timer:0,on:false};
  function poke(){act.last=Date.now();}
  function tick(){
    try{if(doc.hidden||Date.now()-act.last>60000)return;var r=R();if(r)r.noteActive();}catch(e){}
  }
  function startActivity(){
    if(act.on)return;act.on=true;
    ['pointerdown','touchstart','keydown'].forEach(function(t){try{doc.addEventListener(t,poke,{passive:true,capture:true});}catch(e){}});
    act.timer=setInterval(tick,15000);
    try{root.addEventListener('pagehide',function(){clearInterval(act.timer);act.on=false;});}catch(e){}
  }
  try{root.addEventListener('pageshow',startActivity);}catch(e){}   // 从返回缓存回来：重新开始数
  // 别的标签页里做了复习（核心每次改完账本写一下 _bump）：本页如果是岛页，把内存里的进度从账本重新同步（免得下次 save 冲掉复习结果）
  try{root.addEventListener('storage',function(e){
    try{if(!e||e.key!=='hansen_review2_v1166_bump')return;var h=root.HansenCanonical;if(h&&root.S&&typeof h.syncCurrent==='function')h.syncCurrent();}catch(_e){}
  });}catch(e){}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',startActivity);else startActivity();

  root.HansenReview2UI={
    open:open,openParent:openParent,close:close,mountEntry:mountEntry,drawReport:drawReport,
    _state:function(){return {view:state.view,busy:state.busy,session:state.session,lastRes:state.lastRes};},
    _tick:tick
  };
})(typeof window!=='undefined'?window:null);
