/* hansen_mistake_lesson_v1165.js — 答错也变成一节小课
 * ============================================================================
 * 为什么有它：以前答对有大卡片 + 再读一遍，答错只有 1.6 秒红绿框和「💔 连胜被中断」，
 * 不显示英文、不读，孩子错了也不知道正确的词长什么样、怎么读。
 *
 * 这里统一做四件事（各小游戏只管在答错/一轮结束/结算时调用）：
 *   1. lesson(idx, next)  答错后显示和答对一样的揭晓卡（图/英文/音标/中文）并重读，
 *                          约 2.5 秒或点一下就继续。重读走 window.speak()（全局静音、音量规则照旧）。
 *   2. miss / requeue     记下本轮答错的词；本轮题目做完时，把每个错词再考一次（只一次）。
 *   3. isRetry            再考的那道题不算进本轮得分/命数/正确率/纪录。它是「刚看过答案马上再答」，
 *                          所以也不算纠错：不扣错题本、复习计划不升盒、没有 +2 纠错金（见模板 __hmlMark）。
 *   4. attach(mode, el)   结算页列出这次答错的词（每个带 🔊），加「练这 N 个词」按钮，
 *                          进入现成的复习中心（只练这几个词）。
 * 缺了这个文件，各游戏退回原来的定时推进，不会卡住。
 * ============================================================================ */
(function(){
  'use strict';
  if(window.HansenMistakeLesson) return;

  var LESSON_MS = 2500;
  var rounds = {};
  var busy = false;

  function words(){ return Array.isArray(window.allW) ? window.allW : []; }
  function validIdx(i){
    var n = Number(i);
    return Number.isInteger(n) && n >= 0 && n < words().length && words()[n] ? n : -1;
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }
  function round(mode){
    mode = String(mode || 'game');
    if(!rounds[mode]) rounds[mode] = { missed: [], retried: {}, pending: {} };
    return rounds[mode];
  }

  function start(mode){ rounds[String(mode || 'game')] = { missed: [], retried: {}, pending: {} }; }
  function miss(mode, idx){
    var i = validIdx(idx); if(i < 0) return;
    var r = round(mode);
    if(r.missed.indexOf(i) < 0) r.missed.push(i);
  }
  function missed(mode){ return round(mode).missed.slice(); }
  function isRetry(mode, idx){
    var i = validIdx(idx);
    return i >= 0 && !!round(mode).retried[i];
  }
  // 本轮题做完时调用：把一个还没再考过的错词放回游戏自己的题池（游戏从尾部 pop）。
  function requeue(mode, pool){
    if(!Array.isArray(pool)) return false;
    var r = round(mode);
    for(var k = 0; k < r.missed.length; k++){
      var i = r.missed[k];
      if(!r.retried[i]){
        r.retried[i] = 1;
        pool.push(i);
        announce();
        return true;
      }
    }
    return false;
  }
  // 限时玩法（极速 60 秒）没有「本轮做完」这一刻：把错词插回题池，过几题再考一次（只一次）。
  function requeueLater(mode, pool, idx, gap){
    var i = validIdx(idx);
    if(i < 0 || !Array.isArray(pool)) return false;
    miss(mode, i);
    var r = round(mode);
    if(r.retried[i]) return false;
    r.retried[i] = 1;
    r.pending[i] = 1;   // 插回去的这一份才是「再考」；题池洗回来再出现时照常算分
    pool.splice(Math.max(0, pool.length - Math.max(1, gap|0)), 0, i);
    return true;
  }
  // 极速：题从池里取出来那一刻问「这道是不是插回来的再考题」，问一次就作废（只认一次）
  function takeRetry(mode, idx){
    var i = validIdx(idx), r = round(mode);
    if(i < 0 || !r.pending[i]) return false;
    delete r.pending[i];
    return true;
  }
  function pendingRetries(mode){
    var r = round(mode), n = 0;
    r.missed.forEach(function(i){ if(!r.retried[i]) n++; });
    return n;
  }

  /* ---------- 样式（深色 + 亮色主题） ---------- */
  function ensureStyle(){
    if(document.getElementById('hml_style')) return;
    var st = document.createElement('style');
    st.id = 'hml_style';
    st.textContent = [
      '#hml_lesson{position:fixed;inset:0;z-index:9990;background:rgba(2,6,23,.28);cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#hml_lesson .listen-reveal{z-index:9991}',
      '#hml_lesson .hml-tag{display:inline-block;font-size:14px;font-weight:900;color:#0f172a;background:#fde047;border-radius:999px;padding:3px 12px;margin-bottom:8px}',
      '#hml_lesson .hml-tap{font-size:12px;color:rgba(255,255,255,.8);margin-top:8px}',
      '#hml_lesson .hml-ex{font-size:16px;line-height:1.5;font-weight:700;color:#ecfdf5;margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.22)}',
      '#hml_lesson .hml-ex b{color:#fde047;font-weight:900}',
      '#hml_lesson .hml-excn{font-size:14px;line-height:1.5;color:#d1fae5;margin-top:4px}',
      '.hml-retry-pill{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9989;pointer-events:none;background:linear-gradient(135deg,#6366f1,#4338ca);color:#fff;font-size:14px;font-weight:900;padding:7px 16px;border-radius:999px;box-shadow:0 6px 18px rgba(67,56,202,.45);white-space:nowrap;animation:hmlPill 2.2s ease forwards}',
      '@keyframes hmlPill{0%{opacity:0;transform:translate(-50%,-8px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0}}',
      '.hml-result{margin:12px auto 4px;max-width:340px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.35);border-radius:14px;padding:10px 12px;text-align:center}',
      '.hml-result .hml-r-title{font-size:14px;font-weight:800;color:#fde68a;margin-bottom:8px}',
      '.hml-result .hml-r-list{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}',
      '.hml-result .hml-r-word{display:inline-flex;align-items:center;gap:5px;min-height:44px;font-size:15px;font-weight:800;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 10px;cursor:pointer}',
      '.hml-result .hml-r-word small{font-size:13px;font-weight:700;color:#cbd5e1}',
      '.hml-result .hml-r-go{margin-top:10px;min-height:44px;font-size:15px;font-weight:900;color:#0f172a;background:linear-gradient(135deg,#fde047,#f59e0b);border:0;border-radius:12px;padding:9px 18px;cursor:pointer}',
      'html.hsn-pal-light .hml-result{background:rgba(255,255,255,.85);border-color:rgba(15,23,42,.14)}',
      'html.hsn-pal-light .hml-result .hml-r-title{color:var(--pal-accent-text,#1e40af)}',   // 亮色主题用全站统一的强调字色（棕橙色族是禁色）
      'html.hsn-pal-light .hml-result .hml-r-word{color:#0f172a;background:#fff;border-color:rgba(15,23,42,.16)}',
      'html.hsn-pal-light .hml-result .hml-r-word small{color:#475569}',
      'html.hsn-pal-light #hml_lesson{background:rgba(15,23,42,.18)}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  function announce(){
    try{
      ensureStyle();
      var old = document.querySelector('.hml-retry-pill'); if(old) old.remove();
      var p = document.createElement('div');
      p.className = 'hml-retry-pill';
      p.textContent = '刚才错的词，再试一次 💪';
      document.body.appendChild(p);
      setTimeout(function(){ if(p.parentNode) p.remove(); }, 2300);
    }catch(e){}
  }

  /* 例句里把正确的词标亮：先拆成三段再各自转义，句子里的字一律当文字。
     hl = 句子里真正出现的那个词形（完形填空传 clozeQ.fill，如 eyes / cooks / flown）；找不到再用原词 */
  function exHtml(ex, en, hl){
    ex = String(ex || ''); en = String(en || '');
    var m = null;
    function find(t){
      t = String(t || '').trim();
      if(!t) return null;
      try{ return new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').exec(ex); }catch(e){ return null; }
    }
    m = find(hl) || find(en);
    if(!m) return esc(ex);
    return esc(ex.slice(0, m.index)) + '<b>' + esc(m[0]) + '</b>' + esc(ex.slice(m.index + m[0].length));
  }

  /* ---------- 1. 答错小课 ----------
   * opts.say / opts.ex / opts.exCn / opts.waitSpeech：完形填空用——卡片上带着例句，读完整句再继续
   * （以前完形答错就读整句例句，教学价值高；小课不能把它弄丢）。 */
  function lesson(idx, next, opts){
    opts = opts || {};
    var i = validIdx(idx), w = i >= 0 ? words()[i] : null;
    var finished = false, timer = null, el = null, watch = null, t0 = Date.now();
    // 小课开始时孩子在哪个游戏屏；他切走了（返回/换屏），卡片马上收起，也不再替那个游戏出下一题、读下一个词
    var host = null;
    try{ host = document.querySelector('.screen.active'); }catch(e){}
    function goNext(){ try{ if(typeof next === 'function') next(); }catch(e){} }
    function finish(left, tapped){
      if(finished) return; finished = true;
      if(timer){ clearTimeout(timer); timer = null; }
      if(watch){ try{ watch.disconnect(); }catch(e){} watch = null; }
      if(el && el.parentNode) el.remove();
      if(left === true){ busy = false; return; }
      /* 点卡片那一下会给「一键静音」开 120ms 放行窗口（hansen_mute：点了就算想听）。下一题一出来就自动读词，
         在窗口里读就漏声 → 等窗口关上再出下一题（极速的钟这 160ms 也照样停着）；这期间孩子离开了游戏屏就不出了 */
      if(tapped === true){
        setTimeout(function(){ busy = false; if(host && !host.classList.contains('active')) return; goNext(); }, 160);
        return;
      }
      busy = false;
      goNext();
    }
    function spoken(){   // 整句读完：再停一下（至少凑满约 2.5 秒）；开了静音 speak 会立刻回调
      if(finished) return;
      if(timer) clearTimeout(timer);
      timer = setTimeout(finish, Math.max(800, LESSON_MS - (Date.now() - t0)));
    }
    if(!w){ timer = setTimeout(finish, opts.fallbackMs || 1200); return finish; }
    var say = (typeof opts.say === 'string' && opts.say.trim()) ? opts.say : w.en;
    try{
      ensureStyle();
      var prev = document.getElementById('hml_lesson'); if(prev) prev.remove();
      el = document.createElement('div');
      el.id = 'hml_lesson';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', '正确答案：' + String(w.en || '') + '，' + String(w.cn || ''));
      // emoji 字段是岛屿自带数据（可能是 <img> 图标），和答对揭晓卡一样原样显示
      el.innerHTML = '<div class="listen-reveal hml-card">'
        + '<div class="hml-tag">再听一遍 👂</div>'
        + '<div class="lr-emoji">' + (w.emoji || '') + '</div>'
        + '<div class="lr-en">' + esc(w.en) + '</div>'
        + (w.pn ? '<div class="lr-pn">' + esc(w.pn) + '</div>' : '')
        + '<div class="lr-cn">' + esc(w.cn) + '</div>'
        + (opts.ex ? '<div class="hml-ex">' + exHtml(opts.ex, w.en, opts.hl) + '</div>'
            + (opts.exCn ? '<div class="hml-excn">' + esc(opts.exCn) + '</div>' : '') : '')
        + '<div class="hml-tap">点一下继续</div>'
        + '</div>';
      el.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); finish(false, true); });
      document.body.appendChild(el);
      busy = true;
      if(host && window.MutationObserver){
        watch = new MutationObserver(function(){ if(!host.classList.contains('active')) finish(true); });
        watch.observe(host, { attributes: true, attributeFilter: ['class'] });
      }
      // 自动重读：故意晚于点击 120ms 放行窗口，开了「一键静音」就不出声
      setTimeout(function(){
        if(finished) return;
        try{ if(typeof window.speak === 'function') window.speak(say, 1, opts.waitSpeech ? spoken : undefined); }catch(e){}
      }, 200);
    }catch(e){}
    timer = setTimeout(finish, opts.waitSpeech ? (opts.maxMs || 8000) : (opts.ms || LESSON_MS));
    return finish;
  }

  /* ---------- 4. 结算页错词 + 「练这 N 个词」 ---------- */
  function resultHtml(mode){
    var list = missed(mode).filter(function(i){ return validIdx(i) >= 0; });
    if(!list.length) return '';
    var W = words();
    return '<div class="hml-result" data-hml-mode="' + esc(mode) + '">'
      + '<div class="hml-r-title">📒 这次答错的词（点一下听发音）</div>'
      + '<div class="hml-r-list">'
      + list.map(function(i){
          return '<button type="button" class="hml-r-word" data-hml-say="' + i + '">🔊 ' + esc(W[i].en) + ' <small>' + esc(W[i].cn) + '</small></button>';
        }).join('')
      + '</div>'
      + '<button type="button" class="hml-r-go" data-hml-practice="' + esc(mode) + '">练这 ' + list.length + ' 个词</button>'
      + '</div>';
  }
  function attach(mode, container){
    try{
      var host = typeof container === 'string' ? document.getElementById(container) : container;
      if(!host) return false;
      var html = resultHtml(mode);
      if(!html) return false;
      var old = host.querySelector('.hml-result'); if(old) old.remove();
      ensureStyle();
      var box = document.createElement('div');
      box.innerHTML = html;
      var block = box.firstChild;
      // 放在结算页按钮那一排的前面（找最后一个含 .game-btn 的块），找不到就放最后
      var btns = host.querySelectorAll('.game-btn');
      var row = btns.length ? btns[btns.length - 1].parentNode : null;
      if(row && row !== host && host.contains(row)) row.parentNode.insertBefore(block, row);
      else (host.firstElementChild || host).appendChild(block);
      return true;
    }catch(e){ return false; }
  }
  function practice(mode){
    var list = missed(mode);
    if(!list.length) return false;
    var W = words(), wr = (window.S && window.S.wrongs) || {};
    window._huReviewContext = {
      title: '练这 ' + list.length + ' 个词',
      vocabList: W,
      wrongsList: list.map(function(i){
        var c = Number(wr[i]);
        return { idx: i, count: (Number.isInteger(c) && c > 0) ? c : 1, word: W[i] };
      })
    };
    try{
      if(window.HansenReview && typeof window.HansenReview._open === 'function'){ window.HansenReview._open(); return true; }
    }catch(e){}
    return false;
  }

  // 点 🔊 / 「练这 N 个词」——用事件委托，结算页重画也不用重新绑定
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-hml-say],[data-hml-practice]') : null;
    if(!t) return;
    if(t.hasAttribute('data-hml-say')){
      var i = validIdx(t.getAttribute('data-hml-say'));
      if(i >= 0){ try{ window.speak(words()[i].en); }catch(e){} }
    } else {
      practice(t.getAttribute('data-hml-practice'));
    }
  });

  window.HansenMistakeLesson = {
    LESSON_MS: LESSON_MS,
    start: start, miss: miss, missed: missed, isRetry: isRetry,
    requeue: requeue, requeueLater: requeueLater, takeRetry: takeRetry, pendingRetries: pendingRetries,
    lesson: lesson, busy: function(){ return busy; },
    resultHtml: resultHtml, attach: attach, practice: practice
  };
})();
