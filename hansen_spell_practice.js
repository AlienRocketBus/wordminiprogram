/*
 * hansen_spell_practice.js (v243+, v287 改键盘) — 错题本拼写练习模块
 *
 * 提供两个练习模式:
 *   1. openSpellByCn()    — 看汉意拼单词 (看中文意思 + emoji 图标, 用游戏内键盘拼写)
 *   2. openSpellByListen()— 听音拼单词 (自动播放发音 + emoji + 中文提示, 用游戏内键盘拼写)
 *
 * v287 重做: 用打字大师同款游戏内键盘(.keyboard/.key)替代系统输入框, 加 emoji 图标,
 *            整页 flex 布局 (顶部题头 + 中间题面 + 底部键盘), 全部一屏不滚动.
 * 60 秒倒计时未作答自动判错, 显示正确答案, 1.x 秒后下一题. 全部做完显示完成页.
 *
 * 关键设计 (借鉴 BUG #11/#14/#16 教训):
 *   - 按钮闭包持有引用 + ESC 兜底, 不用 closest 字符串选择器
 *   - 每个 setTimeout 用 sessionToken 保护, 关闭后旧回调失效
 *   - 物理键盘 handler 存到模块变量, 切题/关闭时移除, 防泄漏
 */
(function(){
  'use strict';

  var TIMER_SECONDS = 60;
  var sessionToken = 0;
  var curMask = null;
  var curTimerInterval = null;
  var curWords = [];
  var curIdx = 0;
  var curMode = 'cn';
  var curKeyHandler = null;   // 物理键盘 handler (切题/关闭时移除)
  var stats = { correct: 0, assisted: 0, wrong: 0, total: 0 };
  // 🔴 BUG#51 (v471): 锁住整页滚动用 —— 复习/拼写练习是全屏覆盖层, 必须锁 body 滚动,
  // 否则手指在键盘上稍微上滑就会滚动背后的长页面、右侧冒出滚动条、没法打字。
  var _hspPrevHtmlOverflow = '';
  var _hspPrevBodyOverflow = '';
  function _hspBlockScroll(e){ if(e && e.cancelable) e.preventDefault(); }

  // 🔴 BUG#53 (v477): 字母格整排自动缩放到一行 —— Hansen 要求所有打字模式(拼写练习 / 打字大师)
  //   的字母格永远【一排显示, 绝不换行 / 换两排】。长单词(如 basketball 10 字母)字母格总宽超屏时,
  //   把整排 .typing-slots 等比 transform:scale 缩到容器宽度内(短词不缩 = scale1, 不裁切、不换行)。
  //   配合 CSS .typing-slots{flex-wrap:nowrap;overflow:hidden;transform-origin:center}。每渲染一词调一次。
  //   全局挂 window, 供拼写练习 + 各岛"打字大师"渲染处共用。check_resources 检查17 守卫。
  window.HansenFitSlots = function(el){
    if(!el) return;
    try {
      // 🔴 BUG#55 (v479): 外层(.typing-slots, width:100% 居中) + 内层(.typing-slots-inner, 内容尺寸的字母行) 包裹法。
      //   缩【内层】的 transform:scale —— scale 缩的是渲染结果, 不受 flex item "自动最小尺寸"限制
      //   (v477 缩整个 width:100% 元素 → 内容相对框比例不变反被裁切; 后又试缩每格宽 → flex 自动最小尺寸 floor 连 !important 都压不动, 都走不通)。
      //   内层内容超出外层可用宽 → 等比 scale 到正好装进(短词不缩 = none); justify-content:center 自动居中、不裁切。
      var inner = el.querySelector('.typing-slots-inner');
      if(!inner) return;
      inner.style.transform = 'none';
      var content = inner.scrollWidth || inner.offsetWidth;
      var vw = window.innerWidth || document.documentElement.clientWidth || 360;
      var avail = el.clientWidth;
      if(!avail || avail < 40 || avail > vw) avail = vw;
      if(content > avail - 2){
        inner.style.transform = 'scale(' + ((avail - 8) / content).toFixed(4) + ')';
      }
    } catch(e){}
  };

  // 🔴 BUG#54 (v478): 游戏内键盘【极高灵敏度: 触碰/滑过即输入】—— Hansen 反馈原来只能精准"点一下"
  //   才打字, 稍微一滑就不认、灵敏度太低。改为: ① 手指 touchstart 一碰到键就立刻输入(不必等 touchend、
  //   不必干净点击); ② touchmove 滑过【新的字母键】也输入(滑键即打字, 上下左右滑都算)。
  //   打字大师(onclick=typeKey)与拼写练习(委托 click 读 data-k)都用 .key 且都响应 click,
  //   故统一用 el.click() 触发, 两个键盘通吃。touchstart 在键上 preventDefault → 抑制原生 click, 不会重复输入。
  //   滑动(touchmove)只触发【字母键】(textContent 为单个 a-z), 不误触删除/空格/提示; 点按(touchstart)任意键都生效。
  //   全局只装一次。check_resources 检查18 守卫。
  (function(){
    if(window.__hsnKbdTouchSetup) return;
    window.__hsnKbdTouchSetup = true;
    var _lastKey = null;
    function keyAt(t){
      var el = document.elementFromPoint(t.clientX, t.clientY);
      if(!el || !el.closest) return null;
      var k = el.closest('.key');
      if(!k || !k.closest('.keyboard')) return null;
      return k;
    }
    function isLetter(k){ return /^[a-z]$/.test((k.textContent || '').trim()); }
    function fire(k){
      if(!k || k === _lastKey) return;
      _lastKey = k;
      try { k.click(); } catch(e){}
    }
    document.addEventListener('touchstart', function(e){
      var t = e.touches && e.touches[0]; if(!t) return;
      var k = keyAt(t);
      if(k){ _lastKey = null; fire(k); if(e.cancelable) e.preventDefault(); }
    }, { passive: false });
    document.addEventListener('touchmove', function(e){
      var t = e.touches && e.touches[0]; if(!t) return;
      var k = keyAt(t);
      if(k && isLetter(k)){ fire(k); if(e.cancelable) e.preventDefault(); }
    }, { passive: false });
    document.addEventListener('touchend', function(){ _lastKey = null; }, { passive: true });
    document.addEventListener('touchcancel', function(){ _lastKey = null; }, { passive: true });
  })();

  // 工具: 获取词列表 (复用 hansen_review 的 context 逻辑)
  function getWordList(){
    var rawList = null;
    if(window._huReviewContext && window._huReviewContext.wrongsList){
      rawList = window._huReviewContext.wrongsList;
    } else if(typeof window.getCurrentIslandWrongs === 'function'){
      rawList = window.getCurrentIslandWrongs();
    } else {
      var wrongs = (window.S && window.S.wrongs) || {};
      var allW = window.allW || [];
      var arr = [];
      Object.keys(wrongs).forEach(function(idxKey){
        var idx = Number(idxKey);
        var word = allW[idx];
        if(word && wrongs[idxKey] > 0) arr.push(word);
      });
      return arr;
    }
    if(!rawList || !rawList.length) return [];
    return rawList.map(function(item){
      if(item && typeof item === 'object' && item.word && typeof item.word.en === 'string'){
        return item.word;
      }
      return item;
    }).filter(function(w){
      return w && typeof w.en === 'string' && w.en.length > 0;
    });
  }

  // 工具: 关闭练习 (清状态)
  function close(){
    sessionToken++;
    if(curTimerInterval){ clearInterval(curTimerInterval); curTimerInterval = null; }
    if(curKeyHandler){ document.removeEventListener('keydown', curKeyHandler); curKeyHandler = null; }
    // 🔴 BUG#51 (v471): 还原整页滚动 (与 start 的锁成对; curMask 移除时其 touchmove 监听随之销毁)
    try {
      if(curMask){ curMask.removeEventListener('touchmove', _hspBlockScroll, { passive: false }); }
      document.documentElement.style.overflow = _hspPrevHtmlOverflow;
      document.body.style.overflow = _hspPrevBodyOverflow;
    } catch(e){}
    // 🔴v789 治本·零遮罩: 先(在拼写页 curMask 还盖着主页时)在拼写页【之上】重建复习中心(_backFromSpell 内把它提到 z99998), 再撤拼写页 → 主页全程被 拼写页→复习中心 接力盖住·不露主页·无需任何遮罩。
    //   (原来是先撤拼写页[露主页]→再 _backFromSpell[用遮罩盖住重建]·那是治标; 现在调换顺序+复习中心先盖上=治本)
    var _backToReview = (window._huFromReview && window.HansenReview && typeof window.HansenReview._backFromSpell === 'function');
    try { if(_backToReview){ window.HansenReview._backFromSpell(); } } catch(e){}
    if(curMask && curMask.parentNode){ curMask.remove(); }
    curMask = null;
    curWords = [];
    curIdx = 0;
    stats = { correct: 0, assisted: 0, wrong: 0, total: 0 };
    // 🔴v784/v789 从复习页进来→关闭后回复习中心(零遮罩·见上)·叉号/返回键/超时关闭都走这
  }

  // 工具: 安全转义 HTML
  function esc(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // 工具: 调用 speak 朗读
  function trySpeak(word){
    try { if(typeof window.speak === 'function'){ window.speak(word); } } catch(e){}
  }

  // 游戏内键盘 (和打字大师同款 .keyboard/.key 样式)
  function renderHspKeyboard(){
    var rows = [['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']];
    var k = '<div class="keyboard" id="hspKbd">';
    k += '<div class="keyboard-row">'; rows[0].forEach(function(l){ k += '<button class="key" data-k="'+l+'" type="button">'+l+'</button>'; }); k += '</div>';
    k += '<div class="keyboard-row indent">'; rows[1].forEach(function(l){ k += '<button class="key" data-k="'+l+'" type="button">'+l+'</button>'; }); k += '</div>';
    k += '<div class="keyboard-row">'; rows[2].forEach(function(l){ k += '<button class="key" data-k="'+l+'" type="button">'+l+'</button>'; }); k += '<button class="key delete" data-act="del" type="button">⌫</button></div>';
    k += '<div class="keyboard-row"><button class="key hint" data-act="hint" type="button">💡</button><button class="key space" data-act="space" type="button">space</button></div>';
    k += '</div>';
    return k;
  }

  // 渲染单题
  function renderQuestion(){
    if(!curMask) return;
    var myToken = sessionToken;

    if(curIdx >= curWords.length){ renderDone(); return; }
    var w = curWords[curIdx];
    if(!w || !w.en){ curIdx++; renderQuestion(); return; }

    var modeIcon  = curMode === 'listen' ? '🎧' : '✍️';
    var modeTitle = curMode === 'listen' ? '听音拼词' : '看汉意拼单词';
    var wordEmoji = w.emoji || (curMode === 'listen' ? '🎧' : '📝');
    var target = (w.en || '').toLowerCase();
    var targetLetters = target.replace(/ /g, '').length;
    var typed = '';   // 已输入字母 (不含空格)
    var hintUsed = false; // HF2: 用过任何字母提示就不再算“独立正确”。

    var prompt = curMode === 'listen'
      ? '<div style="font-size:13px;color:#94a3b8">听发音, 拼写单词:</div>'
      : '<div style="font-size:13px;color:#94a3b8">看汉语意思, 拼写单词:</div>';
    var cnDisplay = curMode === 'listen'
      ? '<div style="font-size:15px;color:#cbd5e1;margin-top:4px">提示: '+esc(w.cn || '')+'</div>'
      : '<div class="typing-cn" style="margin:4px 0 2px">'+esc(w.cn || '')+'</div>';
    var speakerBtn = '<button id="hspSpeakBtn" class="listen-btn" type="button">🔊 '+(curMode === 'listen' ? '再听一次' : '点击发音')+'</button>';

    var slotsHtml = '';
    target.split('').forEach(function(ch, i){
      if(ch === ' ') slotsHtml += '<div class="typing-slot space" id="hspSlot'+i+'"></div>';
      else slotsHtml += '<div class="typing-slot" id="hspSlot'+i+'"></div>';
    });

    curMask.innerHTML =
      // 顶部题头 + 进度条
      '<div style="flex-shrink:0;padding:12px 18px 0">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;color:#cbd5e1;font-size:14px;font-weight:700">' +
          '<div>'+ modeIcon +' '+ modeTitle +' '+ (curIdx+1) +' / '+ curWords.length +'</div>' +
          '<button id="hspCloseBtn" type="button" style="background:rgba(255,255,255,0.12);border:0;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:17px;line-height:1">✕</button>' +
        '</div>' +
        '<div style="margin-top:9px;height:7px;background:rgba(15,23,42,0.6);border-radius:4px;overflow:hidden"><div id="hspTimerFill" style="height:100%;width:100%;background:linear-gradient(90deg,#ef4444 0%,#f59e0b 25%,#eab308 50%,#22c55e 75%,#06b6d4 100%);transition:width 1s linear;border-radius:4px"></div></div>' +
      '</div>' +
      // 中间题面 (flex:1 居中)
      '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 14px;min-height:0">' +
        prompt +
        '<div class="typing-emoji">'+ wordEmoji +'</div>' +
        cnDisplay +
        '<div style="margin:8px 0 2px">'+ speakerBtn +'</div>' +
        '<div class="typing-slots" id="hspSlots"><div class="typing-slots-inner">'+ slotsHtml +'</div></div>' +
        '<div id="hspHint" style="font-size:12px;color:#94a3b8;min-height:16px;margin-top:2px"></div>' +
        '<div style="display:flex;gap:12px;align-items:center;margin-top:5px"><button id="hspSkipBtn" type="button" style="background:rgba(148,163,184,0.2);color:#cbd5e1;border:0;padding:7px 18px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">跳过</button><span style="font-size:12px;color:#64748b">✓ '+stats.correct+'　✗ '+stats.wrong+'　· 60秒</span></div>' +
      '</div>' +
      // 底部键盘
      renderHspKeyboard();

    var hintEl   = document.getElementById('hspHint');
    var fillEl   = document.getElementById('hspTimerFill');
    var speakBtn = document.getElementById('hspSpeakBtn');
    var closeBtn = document.getElementById('hspCloseBtn');
    var skipBtn  = document.getElementById('hspSkipBtn');
    var kbd      = document.getElementById('hspKbd');

    try { window.HansenFitSlots(document.getElementById('hspSlots')); } catch(e){}

    var answered = false;

    function fillSlots(){
      var idx = 0;
      for(var i = 0; i < target.length; i++){
        var el = document.getElementById('hspSlot'+i);
        if(!el) continue;
        if(target[i] === ' '){ el.textContent = ' '; continue; }
        if(idx < typed.length){ el.textContent = typed[idx]; el.classList.add('filled'); }
        else { el.textContent = ''; el.classList.remove('filled'); }
        idx++;
      }
    }

    function stopTimer(){ if(curTimerInterval){ clearInterval(curTimerInterval); curTimerInterval = null; } }

    function colorSlots(color){
      for(var i = 0; i < target.length; i++){
        var el = document.getElementById('hspSlot'+i);
        if(el && target[i] !== ' '){ el.style.borderBottomColor = color; el.style.color = color; }
      }
    }

    function checkAnswer(){
      if(answered || myToken !== sessionToken) return;
      answered = true;
      stopTimer();
      var isRight = typed.toLowerCase() === target.replace(/ /g, '');
      colorSlots(isRight ? '#22c55e' : '#ef4444');
      if(isRight){
        if(hintUsed){
          stats.assisted++;
          if(hintEl) hintEl.innerHTML = '<span style="color:#fbbf24;font-weight:900">✓ 练习完成</span> <span style="color:#cbd5e1">· 使用了提示，不计独立答对</span>';
        }else{
          stats.correct++;
          if(hintEl) hintEl.innerHTML = '<span style="color:#22c55e;font-weight:900">✓ 独立正确!</span>';
        }
        try { if(window.playCorrect) window.playCorrect(); } catch(e){}
      } else {
        stats.wrong++;
        if(hintEl) hintEl.innerHTML = '<span style="color:#ef4444;font-weight:900">✗</span> 正确: <span style="color:#22c55e;font-family:Consolas,monospace;font-weight:900">'+esc(w.en)+'</span>';
        try { if(window.playWrong) window.playWrong(); } catch(e){}
      }
      setTimeout(function(){ if(myToken !== sessionToken) return; curIdx++; renderQuestion(); }, 1500);
    }

    function skipQuestion(){
      if(answered || myToken !== sessionToken) return;
      answered = true;
      stopTimer();
      stats.wrong++;
      if(hintEl) hintEl.innerHTML = '<span style="color:#94a3b8">已跳过.</span> 答案: <span style="color:#22c55e;font-family:Consolas,monospace;font-weight:900">'+esc(w.en)+'</span>';
      setTimeout(function(){ if(myToken !== sessionToken) return; curIdx++; renderQuestion(); }, 1500);
    }

    function timeUp(){
      if(answered || myToken !== sessionToken) return;
      answered = true;
      stats.wrong++;
      colorSlots('#ef4444');
      if(hintEl) hintEl.innerHTML = '<span style="color:#ef4444;font-weight:900">⏰ 超时!</span> 正确: <span style="color:#22c55e;font-family:Consolas,monospace;font-weight:900">'+esc(w.en)+'</span>';
      try { if(window.playWrong) window.playWrong(); } catch(e){}
      setTimeout(function(){ if(myToken !== sessionToken) return; curIdx++; renderQuestion(); }, 2000);
    }

    // 键盘输入逻辑
    function hspKey(l){
      if(answered || myToken !== sessionToken) return;
      if(typed.length >= targetLetters) return;
      typed += l;
      fillSlots();
      try { if(window.playBeep) window.playBeep(700 + typed.length * 40, 0.04); } catch(e){}
      if(typed.length >= targetLetters){ setTimeout(function(){ if(myToken === sessionToken) checkAnswer(); }, 200); }
    }
    function hspDel(){
      if(answered || myToken !== sessionToken) return;
      if(typed.length === 0) return;
      typed = typed.slice(0, -1);
      fillSlots();
    }
    function hspHint(){
      if(answered || myToken !== sessionToken) return;
      hintUsed = true;
      var nonSpace = target.replace(/ /g, '');
      if(typed.length < nonSpace.length){
        typed += nonSpace[typed.length];
        fillSlots();
        if(hintEl){ hintEl.textContent = '💡 已填入一个字母'; setTimeout(function(){ if(hintEl && myToken === sessionToken) hintEl.textContent = ''; }, 1200); }
        if(typed.length >= targetLetters){ setTimeout(function(){ if(myToken === sessionToken) checkAnswer(); }, 200); }
      }
    }

    // 倒计时
    var startTime = Date.now();
    if(curTimerInterval){ clearInterval(curTimerInterval); }
    curTimerInterval = setInterval(function(){
      if(myToken !== sessionToken){ stopTimer(); return; }
      var elapsed = (Date.now() - startTime) / 1000;
      var remain = Math.max(0, TIMER_SECONDS - elapsed);
      if(fillEl) fillEl.style.width = (remain / TIMER_SECONDS * 100) + '%';
      if(remain <= 0){ stopTimer(); timeUp(); }
    }, 200);

    // 绑定按钮 (闭包, 不靠字符串选择器)
    if(speakBtn) speakBtn.addEventListener('click', function(){ trySpeak(w.en); });
    if(closeBtn) closeBtn.addEventListener('click', close);
    if(skipBtn)  skipBtn.addEventListener('click', skipQuestion);
    if(kbd){
      kbd.addEventListener('click', function(e){
        var btn = e.target;
        if(!btn || !btn.classList || !btn.classList.contains('key')) return;
        if(btn.dataset.k) hspKey(btn.dataset.k);
        else if(btn.dataset.act === 'del') hspDel();
        else if(btn.dataset.act === 'hint') hspHint();
        // space: 空格自动处理, 无操作
      });
    }

    // 物理键盘支持 (电脑端); 切题前移除旧 handler 防泄漏
    if(curKeyHandler){ document.removeEventListener('keydown', curKeyHandler); curKeyHandler = null; }
    curKeyHandler = function(e){
      if(myToken !== sessionToken) return;
      if(e.key === 'Backspace'){ e.preventDefault(); hspDel(); }
      else if(e.key === 'Enter'){ e.preventDefault(); if(typed.length >= targetLetters) checkAnswer(); }
      else if(/^[a-zA-Z]$/.test(e.key)){ hspKey(e.key.toLowerCase()); }
    };
    document.addEventListener('keydown', curKeyHandler);

    // 听音模式: 自动播放
    if(curMode === 'listen'){
      setTimeout(function(){ if(myToken !== sessionToken) return; trySpeak(w.en); }, 400);
    }
  }

  // 完成页
  function renderDone(){
    if(!curMask) return;
    if(curKeyHandler){ document.removeEventListener('keydown', curKeyHandler); curKeyHandler = null; }
    var rate = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
    var emoji = rate >= 80 ? '🏆' : rate >= 60 ? '👍' : '💪';
    var msg = rate >= 80 ? '出色!' : rate >= 60 ? '不错!' : '继续加油!';
    stopTimerBar();
    curMask.innerHTML =
      '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px">' +
      '<div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid rgba(251,191,36,0.4);border-radius:20px;padding:36px 28px;max-width:380px;width:calc(100% - 40px);text-align:center;color:#fff">' +
      '<div style="font-size:72px;line-height:1;margin-bottom:14px">'+emoji+'</div>' +
      '<div style="font-size:24px;font-weight:900;color:#fbbf24;margin-bottom:8px">'+msg+'</div>' +
      '<div style="font-size:14px;color:#cbd5e1;margin-bottom:24px">本次练习完成</div>' +
      '<div style="display:flex;justify-content:space-around;background:rgba(15,23,42,0.5);border-radius:14px;padding:18px 0;margin-bottom:24px">' +
      '<div><div style="font-size:28px;font-weight:900;color:#22c55e">'+stats.correct+'</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">独立答对</div></div>' +
      '<div><div style="font-size:28px;font-weight:900;color:#fbbf24">'+stats.assisted+'</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">提示完成</div></div>' +
      '<div><div style="font-size:28px;font-weight:900;color:#ef4444">'+stats.wrong+'</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">答错</div></div>' +
      '<div><div style="font-size:28px;font-weight:900;color:#fbbf24">'+rate+'%</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">正确率</div></div>' +
      '</div>' +
      '<button id="hspDoneBtn" type="button" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e293b;border:0;padding:13px 40px;border-radius:12px;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(251,191,36,0.4)">返回</button>' +
      '</div></div>';
    var doneBtn = document.getElementById('hspDoneBtn');
    if(doneBtn) doneBtn.addEventListener('click', close);
  }

  function stopTimerBar(){
    if(curTimerInterval){ clearInterval(curTimerInterval); curTimerInterval = null; }
  }

  // 公共: 启动一个练习
  function start(mode){
    var words;
    try { words = getWordList(); }
    catch(e){ console.error('[HansenSpellPractice] 获取词列表失败:', e); words = []; }
    if(!words || words.length === 0){
      if(window.HansenReview && typeof window.HansenReview._toast === 'function'){
        window.HansenReview._toast('暂时没有错题哦, 先去打 boss 吧!');
      } else { alert('暂时没有错题, 先去打 boss 攒错题吧!'); }
      return;
    }
    words = words.filter(function(w){ return w && typeof w.en === 'string' && w.en.length > 0; });
    if(words.length === 0){ alert('错题数据有问题, 请重新打 boss 攒错题'); return; }

    sessionToken++;
    curMode = mode;
    curWords = words.slice();
    curIdx = 0;
    stats = { correct: 0, assisted: 0, wrong: 0, total: words.length };

    curMask = document.createElement('div');
    curMask.id = 'hsp_mask';
    curMask.style.cssText = 'position:fixed;inset:0;z-index:99996;background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%);display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:none;touch-action:none;font-family:"Microsoft YaHei","PingFang SC",sans-serif';
    document.body.appendChild(curMask);
    // 🔴 BUG#51 (v471) 修复: 锁住整页滚动 —— 否则手指在键盘上稍微上滑会滚动背后的长页面、右侧冒出滚动条、没法打字。
    // (check_resources 检查16 守卫: start 不锁滚动 / 覆盖层无 overflow:hidden 即拒打包。close 里成对还原。)
    try {
      _hspPrevHtmlOverflow = document.documentElement.style.overflow;
      _hspPrevBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      curMask.addEventListener('touchmove', _hspBlockScroll, { passive: false });
    } catch(e){}

    var myToken = sessionToken;
    var escHandler = function(e){
      if(e.key === 'Escape' || e.keyCode === 27){
        if(myToken === sessionToken) close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    if(!document.getElementById('hspGlobalCss')){
      var st = document.createElement('style');
      st.id = 'hspGlobalCss';
      st.textContent = '@keyframes hspToastIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.85)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}';
      document.head.appendChild(st);
    }

    renderQuestion();
  }

  // 暴露 API
  window.HansenSpellPractice = {
    openSpellByCn: function(){ start('cn'); },
    openSpellByListen: function(){ start('listen'); },
    close: close
  };
})();
