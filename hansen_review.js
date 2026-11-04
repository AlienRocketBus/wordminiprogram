/**
 * 🎯 复习中心 - 集中所有复习方式
 * 替代原"单词"标签, 让复习成为一个独立完整的模块
 */
(function(){
  'use strict';
  if(window.HansenReview) return;

  // 🔴v839 红点更新定时器引用: 供页面卸载(pagehide)时主动清理·杜绝任何理论上的堆积。
  // 这两个定时器本就有三重防护(①dataset守卫防重复创建 ②岛iframe卸载自动清 ③首页单次加载)·
  // 此处再存引用+pagehide主动清=第四重保险·让JARVIS静态分析也无可挑剔(有setInterval必有clearInterval)。
  var _hrBadgeTimers = [];
  try { window.addEventListener('pagehide', function(){ try{ _hrBadgeTimers.forEach(function(id){ clearInterval(id); }); _hrBadgeTimers=[]; }catch(e){} }); } catch(e){}

  // ─────────────────────────────────────────────
  // 工具
  // ─────────────────────────────────────────────
  


  // v142am: 安全点击音效
  function _beep(){
    try {
      if(typeof window.playBeep === 'function') window.playBeep(1200, 0.05);
    } catch(e){}
  }

  // v142ai: HTML 转义工具 - 防 XSS
  function esc(s){
    if(s == null) return '';
    return String(s).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  const MAX_WRONG_COUNT = 1000000;
  const MAX_SMART_WEIGHT = 20;
  const MAX_VOCAB_WORDS = 2000;
  function safeWrongCount(value){
    return typeof value === 'number' && Number.isInteger(value) &&
      value >= 1 && value <= MAX_WRONG_COUNT ? value : 0;
  }
  function safeWrongWeight(value){
    const count = safeWrongCount(value);
    return count ? Math.min(MAX_SMART_WEIGHT, count * 2) : 0;
  }
  function safeText(value, maxLength){
    if(typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, maxLength);
  }
  function safeEmoji(value){
    if(typeof value !== 'string' || !value || value.length > 32 || /[<>&]/.test(value)) return '📘';
    return safeText(value, 32) || '📘';
  }
  function normalizeWord(value){
    if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const en = safeText(value.en, 96).trim();
    if(!en) return null;
    return {
      en,
      cn: safeText(value.cn, 192),
      pn: safeText(value.pn, 128),
      ex: safeText(value.ex, 512),
      exCn: safeText(value.exCn, 512),
      emoji: safeEmoji(value.emoji),
    };
  }
  function canonicalWrongIndex(key, vocabLength){
    if(typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/.test(key)) return -1;
    const index = Number(key);
    return Number.isSafeInteger(index) && index >= 0 && index < vocabLength ? index : -1;
  }
  function normalizeVocab(value, preserveIndexes){
    if(!Array.isArray(value)) return [];
    const length = Math.min(value.length, MAX_VOCAB_WORDS);
    const result = [];
    for(let index = 0; index < length; index++){
      const word = normalizeWord(value[index]);
      if(preserveIndexes) result[index] = word;
      else if(word) result.push(word);
    }
    return result;
  }
  function normalizeStoredWrongs(wrongs, rawVocab){
    const vocab = normalizeVocab(rawVocab, true);
    if(!wrongs || typeof wrongs !== 'object' || Array.isArray(wrongs)) return [];
    const result = [];
    for(let index = 0; index < vocab.length; index++){
      const key = String(index);
      if(!Object.prototype.hasOwnProperty.call(wrongs, key)) continue;
      const count = safeWrongCount(wrongs[key]);
      if(!count || !vocab[index]) continue;
      result.push({idx:index, count, weight:safeWrongWeight(count), word:vocab[index]});
    }
    return result;
  }
  function normalizeContextIndex(value, vocabLength){
    if(typeof value === 'string') return canonicalWrongIndex(value, vocabLength);
    return Number.isSafeInteger(value) && value >= 0 && value < vocabLength ? value : -1;
  }
  function safeColor(value){
    return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#fbbf24';
  }

  // v142af: 替代 alert 的漂亮提示
  function showToast(text, color){
    color = safeColor(color);
    const old = document.getElementById('hr_toast');
    if(old) old.remove();
    const t = document.createElement('div');
    t.id = 'hr_toast';
    t.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:30px;cursor:pointer';
    t.innerHTML = '<div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid ' + color + ';border-radius:18px;padding:30px 36px;text-align:center;color:#fff;font-size:18px;line-height:1.6;max-width:300px"><div style="font-size:48px;margin-bottom:10px">💡</div><div style="color:' + color + ';font-weight:800">' + esc(safeText(text, 240)) + '</div></div>';
    t.onclick = () => t.remove();
    document.body.appendChild(t);
    setTimeout(() => { if(t.parentNode) t.remove(); }, 2500);
  }

  function safeJSON(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
  function getCurrentIsland(){
    // v946 HF1: Land1-Land8 contain digits.  The old letters-only matcher
    // returned null there and aborted the entire review module at boot.
    const m = location.pathname.match(/island_([a-z0-9]+)\.html/i);
    return m ? m[1] : null;
  }
  const islandKey = getCurrentIsland();
  if(!islandKey) return;  // 只在岛内激活

  // 统计错题数
  function getWrongCount(){
    let total = 0;
    Object.keys(localStorage).forEach(k => {
      if(k.startsWith('wordIsland')){
        const d = safeJSON(k);
        total += normalizeStoredWrongs(d && d.wrongs, safeJSON('hansen_vocab_' + k)).length;
      }
    });
    return total;
  }
  
  // 当前岛错题
  function getCurrentIslandWrongs(){
    // 找出当前岛 localStorage key (各岛长名各不一样, 用文件大小最近来匹配)
    if(!window.STORAGE_KEY) return [];
    const data = safeJSON(window.STORAGE_KEY);
    if(!data || !data.wrongs) return [];
    return normalizeStoredWrongs(data.wrongs, window.allW);
  }
  
  // 获取当前 context 下的 wrongs 列表 (优先用外部传入 context)
  function getContextWrongs(){
    const context = window._huReviewContext;
    if(context && Array.isArray(context.wrongsList)){
      const rawVocab = Array.isArray(context.vocabList) ? context.vocabList.slice(0, MAX_VOCAB_WORDS) : [];
      const result = [];
      context.wrongsList.slice(0, MAX_VOCAB_WORDS).forEach(entry => {
        if(!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
        const index = normalizeContextIndex(entry.idx, rawVocab.length);
        const count = safeWrongCount(entry.count);
        const word = normalizeWord(entry.word) || (index >= 0 ? normalizeWord(rawVocab[index]) : null);
        if(index < 0 || !count || !word) return;
        result.push({idx:index, count, weight:safeWrongWeight(count), word});
      });
      return result;
    }
    return getCurrentIslandWrongs();
  }
  // 获取当前 context 下的 vocab (全部单词)
  function getContextVocab(){
    if(window._huReviewContext && Array.isArray(window._huReviewContext.vocabList)){
      return normalizeVocab(window._huReviewContext.vocabList, false);
    }
    return normalizeVocab(window.allW, false);
  }
  // 获取标题前缀
  function getContextTitle(){
    if(window._huReviewContext && window._huReviewContext.title){
      return safeText(window._huReviewContext.title, 80);
    }
    return null;
  }

  // Normalize the shared context in place before any child module reads it.
  // hansen_spell_practice consumes this object directly, so returning a safe
  // copy only from getContextWrongs() would leave its emoji HTML sink exposed.
  function sanitizeReviewContext(){
    const context = window._huReviewContext;
    if(!context || typeof context !== 'object' || Array.isArray(context)) return;
    const rawVocab = Array.isArray(context.vocabList) ? context.vocabList.slice(0, MAX_VOCAB_WORDS) : [];
    const vocabList = [], indexMap = new Map();
    rawVocab.forEach((value, oldIndex) => {
      const word = normalizeWord(value);
      if(!word) return;
      indexMap.set(oldIndex, vocabList.length);
      vocabList.push(word);
    });
    const wrongsList = [];
    if(Array.isArray(context.wrongsList)){
      context.wrongsList.slice(0, MAX_VOCAB_WORDS).forEach(entry => {
        if(!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
        const oldIndex = normalizeContextIndex(entry.idx, rawVocab.length);
        const index = indexMap.get(oldIndex);
        const count = safeWrongCount(entry.count);
        const word = normalizeWord(entry.word) || (index !== undefined ? vocabList[index] : null);
        if(index === undefined || !count || !word) return;
        wrongsList.push({idx:index, count, weight:safeWrongWeight(count), word});
      });
    }
    window._huReviewContext = {
      title: safeText(context.title, 80),
      vocabList,
      wrongsList,
    };
  }

  // Generated island pages historically multiplied a wrong count without a
  // ceiling.  Replace that global pool builder at runtime so corrupted state
  // can never allocate an unbounded array; each valid wrong word contributes
  // at most twenty weighted slots.
  function installSmartPoolGuard(){
    if(typeof window.getSmartPool !== 'function') return;
    window.getSmartPool = function(){
      const vocab = Array.isArray(window.allW) ? window.allW.slice(0, MAX_VOCAB_WORDS) : [];
      const wrongs = window.S && window.S.wrongs;
      const wrongPool = [];
      normalizeStoredWrongs(wrongs, vocab).forEach(entry => {
        for(let slot = 0; slot < entry.weight; slot++) wrongPool.push(entry.idx);
      });
      const normalPool = [];
      for(let index = 0; index < vocab.length; index++) if(normalizeWord(vocab[index])) normalPool.push(index);
      return wrongPool.concat(normalPool);
    };
  }
  installSmartPoolGuard();

  // ─────────────────────────────────────────────
  // 拦截 util-card 的"复习" → 弹复习中心
  // 同时恢复底部 nav 的"单词" (不再改它)
  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
  // 🧠 间隔重复调度 (Spaced Repetition)
  //   新错词 → 盒子0(今天到期); 记住升一盒(间隔拉长), 没记住回盒0(明天再见)
  //   盒子间隔(天) = [1,2,4,7,15]; 升满即毕业(从计划/错题中移除)
  //   数据存在 S.srs = { idx: {box, due:'YYYY-MM-DD', last} }, 随 save() 持久化
  //   🔴v1165: 计划和错题本分开记。答对一次只让错题本 -1；词留在计划里，
  //   要在到期那天一次次答对、升满 5 盒才算毕业。以前错题数一归零就把计划删了，
  //   错一次、当天答对一次 → 再也不会复习（间隔复习根本跑不起来）。
  // ─────────────────────────────────────────────
  var SRS_GAP = [1, 2, 4, 7, 15];
  var SRS_GRAD = SRS_GAP.length; // 升到第 5 盒 = 毕业

  function _ymd(d){
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function _todayYMD(){ return _ymd(new Date()); }
  function _addDaysYMD(n){ var d = new Date(); d.setDate(d.getDate() + n); return _ymd(d); }

  // 确保 S.srs 存在, 并把"还没纳入计划的错词"加入(盒0, 今天到期)
  function _ensureSrs(){
    if(!window.S) return null;
    // HF2: Land1~8 和 Season 是同一批 canonical 词的别名入口。先从权威账本
    // 回填当前切片，防止两个入口各自维护 due/box，也防止已清错词继续到期。
    try{if(window.HansenCanonical&&typeof HansenCanonical.syncCurrent==='function')HansenCanonical.syncCurrent();}catch(e){}
    if(!window.S.srs || typeof window.S.srs !== 'object') window.S.srs = {};
    var srs = window.S.srs, wr = window.S.wrongs || {}, changed = false, t = _todayYMD(), seeded = [];
    Object.keys(srs).forEach(function(idx){
      // 🔴v1165: 只清掉坏索引。错题数归零不等于记住了，计划要留着。
      var i=canonicalWrongIndex(idx,Array.isArray(window.allW)?window.allW.length:0);
      if(i<0){delete srs[idx];changed=true;}
    });
    normalizeStoredWrongs(wr, window.allW).forEach(function(entry){
      var idx = String(entry.idx);
      if(!srs[idx]){
        srs[idx] = { box: 0, due: t, last: '' };
        seeded.push(entry.idx);
        changed = true;
      }
    });
    // 新入计划的词马上写进权威账本：save() 可能被防抖，下一次同步会拿账本覆盖 S.srs
    seeded.forEach(function(i){
      try{ if(window.HansenCanonical && typeof HansenCanonical.setCurrentSrs === 'function') HansenCanonical.setCurrentSrs(i, srs[String(i)]); }catch(_seedSync){}
    });
    if(changed && typeof save === 'function'){ try { save(); } catch(e){} }
    return srs;
  }

  // 今天到期、尚未毕业、且单词有效的列表(错得多的排前面)
  function _dueList(){
    var srs = _ensureSrs();
    if(!srs) return [];
    var t = _todayYMD(), vocab = normalizeVocab(window.allW, true), wr = (window.S && window.S.wrongs) || {}, out = [];
    Object.keys(srs).forEach(function(idx){
      var i = canonicalWrongIndex(idx, vocab.length), e = srs[idx];
      var box = e && typeof e.box === 'number' && Number.isInteger(e.box) ? e.box : -1;
      var due = e && typeof e.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.due) ? e.due : '';
      var wrong=safeWrongCount(wr[i]);
      // 🔴v1165: 错题本清空了也照样到期（还没毕业）
      if(i >= 0 && box >= 0 && box < SRS_GRAD && due && due <= t && vocab[i]){
        out.push({ idx: i, word: vocab[i], box: box, wrong: wrong });
      }
    });
    out.sort(function(a, b){ return (b.wrong - a.wrong) || (a.box - b.box); });
    return out;
  }

  // 评分: ok=记住了(升盒/毕业), !ok=没记住(回盒0,明天再见); 返回是否毕业
  function _grade(idx, ok){
    var srs = _ensureSrs();
    if(!srs) return false;
    var e = srs[idx] || { box: 0, due: _todayYMD(), last: '' };
    var graduated = false;
    if(ok){
      var nb = (e.box || 0) + 1;
      if(nb >= SRS_GRAD){
        /* 🔴v963刺一·毕业闸门：自评"记住了"不能独自宣布毕业。
         * 需要真实答题证据(e.rp=1,由任意玩法答对时记下,或当天直接在玩法里答对到期词
         * 自动毕业走 _absorbRealAnswer 路径)。无证据 → 留在盒4、保持到期、不记 last
         * (今天去玩法里答对一次立即毕业),并给出友好指引。 */
        if(!e.rp){
          srs[idx] = e;
          try{
            var _w = (Array.isArray(window.allW) && window.allW[canonicalWrongIndex(idx, window.allW.length)]) || null;
            var _en = _w && _w.en ? String(_w.en) : '这个词';
            if(typeof window.showToast === 'function') showToast('🎓 最后一关：去任意玩法里答对「'+_en+'」一次，即可正式毕业');
          }catch(_gateToast){}
          try{ if(window.HansenCanonical && typeof HansenCanonical.setCurrentSrs === 'function') HansenCanonical.setCurrentSrs(idx, e); }catch(_gateSync){}
          if(typeof save === 'function'){ try{ save(); }catch(_gateSave){} }
          return false;
        }
        /* 🔴v1165: 毕业这一刻错题本里还有没有它。早就清零的词，清零那天已经发过 +15 毕业金，这次不能再发 */
        var hadWrong = safeWrongCount(window.S.wrongs ? window.S.wrongs[idx] : 0) > 0;
        delete srs[idx];
        if(window.S.wrongs) delete window.S.wrongs[idx];
        graduated = true;
        /* 🔴v963刺二：毕业统一事件(自评+证据路径)→奖励模块发毕业金并调度幽灵巡检 */
        try{ if(window.HansenReviewRewardsV963 && typeof HansenReviewRewardsV963.onGraduated === 'function') HansenReviewRewardsV963.onGraduated(idx, { hadWrong: hadWrong }); }catch(_gradEvt){}
      } else {
        e.box = nb; e.due = _addDaysYMD(SRS_GAP[nb]); e.last = _todayYMD();
        srs[idx] = e;
      }
    } else {
      e.box = 0; e.due = _addDaysYMD(SRS_GAP[0]); e.last = _todayYMD();
      delete e.rp;   // 回到盒0，旧的答对证据作废
      srs[idx] = e;
    }
    try{
      if(window.HansenCanonical){
        if(graduated&&typeof HansenCanonical.absorbAnswer==='function')HansenCanonical.absorbAnswer(idx);
        if(typeof HansenCanonical.setCurrentSrs==='function')HansenCanonical.setCurrentSrs(idx,graduated?null:e);
      }
    }catch(_canonicalError){}
    if(typeof save === 'function'){ try { save(); } catch(e){} }
    return graduated;
  }

  /* 🔴v963刺一(心脏手术·用户2026-07-21批准)：真实答题驱动 SRS。
   * 任何现有玩法 markAnswer 真实答对到期词 → 盒子自动前进；升满5盒即毕业(删SRS+错词,
   * 与自评毕业同一条 canonical 链路)。间隔科学保持：未到期不升盒(仅当 box>=4 时记 rp=1
   * 真实证据备忘,供自评毕业闸门使用)；同词每天最多升一次(复用 last 字段,与自评互斥)。
   * 答错不降盒(错误次数已由 markAnswer 加一,词继续到期;避免限时玩法误伤)。 */
  function _absorbRealAnswer(idx, correct){
    try{
      if(!window.S || !Array.isArray(window.allW)) return null;
      /* 🔴v1165: 玩法传进来的是数字下标(markAnswer(3,true))。以前只认字符串 → 永远 -1 →
       * 这个吸收器上线以来一次都没真正跑过（测试里它被桩替换了，所以没人发现）。 */
      var i = normalizeContextIndex(idx, window.allW.length);
      if(i < 0) return null;
      /* 先把这一题交给权威账本，再同步：markAnswer 刚扣掉的错题数还没进账本，
       * 直接 _ensureSrs()→syncCurrent() 会用账本旧值把它冲回去。 */
      try{ if(window.HansenCanonical && typeof HansenCanonical.absorbAnswer === 'function') HansenCanonical.absorbAnswer(i); }catch(_preSync){}
      var srs = _ensureSrs();   // 答错的词在这里进计划（盒0，今天到期）
      if(!srs) return null;
      if(correct !== true) return { advanced:false, reason:'missed', planned: !!srs[String(i)] };
      /* 🔴v1165: 本轮末「再考一次」是刚看过答案马上再答，不算记住了 → 不升盒（模板 __hmlMark 打的标记） */
      if(window.__hmlRetryAns) return { advanced:false, reason:'retry' };
      var key = String(i), t = _todayYMD();
      var wrong = safeWrongCount(window.S.wrongs ? window.S.wrongs[i] : 0);
      var e = srs[key];
      if(!e || typeof e !== 'object') return null;   // 不在计划里 → 与 SRS 无关
      var box = (typeof e.box === 'number' && e.box >= 0) ? e.box : 0;
      if(box >= SRS_GRAD) return null;
      if(e.last === t) return { advanced:false, reason:'daily-lock' };
      var due = (typeof e.due === 'string') ? e.due : t;
      if(due > t){
        if(box >= SRS_GRAD - 1 && !e.rp){     // 未到期:只记证据不升盒(间隔不破)
          e.rp = 1; srs[key] = e;
          try{ if(window.HansenCanonical && typeof HansenCanonical.setCurrentSrs === 'function') HansenCanonical.setCurrentSrs(i, e); }catch(_c){}
          if(typeof save === 'function'){ try{ save(); }catch(_s){} }
          return { advanced:false, reason:'not-due', proof:true };
        }
        return { advanced:false, reason:'not-due' };
      }
      var nb = box + 1;
      if(nb >= SRS_GRAD){
        delete srs[key];
        if(wrong > 0 && window.S.wrongs) delete window.S.wrongs[i];
        try{
          if(window.HansenCanonical){
            if(typeof HansenCanonical.absorbAnswer === 'function') HansenCanonical.absorbAnswer(i);
            if(typeof HansenCanonical.setCurrentSrs === 'function') HansenCanonical.setCurrentSrs(i, null);
          }
        }catch(_c2){}
        if(typeof save === 'function'){ try{ save(); }catch(_s2){} }
        return { advanced:true, graduated:true, box:SRS_GRAD, hadWrong: wrong > 0 };
      }
      e.box = nb; e.due = _addDaysYMD(SRS_GAP[nb]); e.last = t;
      srs[key] = e;
      try{ if(window.HansenCanonical && typeof HansenCanonical.setCurrentSrs === 'function') HansenCanonical.setCurrentSrs(i, e); }catch(_c3){}
      if(typeof save === 'function'){ try{ save(); }catch(_s3){} }
      return { advanced:true, graduated:false, box:nb, gapDays:SRS_GAP[nb] };
    }catch(_absorbError){ return null; }
  }

  // ─────────────────────────────────────────────
  // 今日复习 session(间隔重复主流程)
  // ─────────────────────────────────────────────
  /* 🔴v1165 复查：每天必有一条「复习单词」任务（巩固 3 个 / 6 个 / 清空今日复习）。
     以前只有模板自带的旧复习屏会上报，可底栏「复习」、首页复习卡、错题总览、结算页「练这 N 个词」现在全都进复习中心 ——
     旧复习屏没人打开，这条任务永远是 0，「12 个任务全部完成」的每日大奖也就拿不到。现在在复习中心里真正复习的地方上报。 */
  function _questReview(n){ try{ if(typeof window.progressQuest === 'function') window.progressQuest('review', n); }catch(e){} }
  function _questReviewClear(){ try{ if(typeof window.setQuest === 'function') window.setQuest('reviewClear', 1); }catch(e){} }

  /* 🔴v1165 复查：子界面（今日复习 / 拼写练习 / 闪卡 / 错题本）还开着吗。「保留复习范围」的标记只在子界面开着时才有用 */
  function _subScreenOpen(){
    return !!(document.getElementById('hr_today') || document.getElementById('hr_flashcard') ||
              document.getElementById('hr_wrongbook') || document.getElementById('hsp_mask'));
  }
  function _todayBackToCenter(){
    window._huFromReview = false;
    window._huReviewKeepContext = false;   // 🔴v1165 复查：已经回到复习中心，这个标记用过了（见 _close）
    // 🔴v794 真正无缝·保留滚动位置: 复用【活着的】复习中心(从v791起一直留底下·带着进今日复习前的滚动位置)·而非openReviewCenter重建(重建滚动归零·弹回顶部)。提到今日界面(z9999)之上→先盖主页·撤今日界面即可见·rAF复位z。
    var center = document.getElementById('hr_center');
    if(!center){ openReviewCenter(); center = document.getElementById('hr_center'); }  // 兜底: 不在才重建
    if(center) center.style.zIndex = '99998';
    var el = document.getElementById('hr_today'); if(el) el.remove();
    requestAnimationFrame(function(){ var c = document.getElementById('hr_center'); if(c) c.style.zIndex = ''; });
  }

  function openTodayReview(){
    var due = _dueList();
    var overlay = document.createElement('div');
    overlay.id = 'hr_today';

    if(due.length === 0){
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:linear-gradient(180deg,#064e3b 0%,#0f172a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:30px;text-align:center';
      overlay.innerHTML =
        '<div style="font-size:72px;margin-bottom:16px">🎉</div>' +
        '<div style="font-size:23px;font-weight:900;color:#fbbf24;margin-bottom:10px">今天没有要复习的单词</div>' +
        '<div style="font-size:14px;color:#94a3b8;line-height:1.8;max-width:280px">大脑正在悄悄记牢它们 · 到期了会自动提醒你<br>先去学点新词, 或随便逛逛吧 💪</div>' +
        '<button id="hr_today_back" style="margin-top:28px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;border:0;padding:13px 32px;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer">返回复习中心</button>';
      document.body.appendChild(overlay);
      document.getElementById('hr_today_back').onclick = _todayBackToCenter;
      /* 🔴v963样机: 主动打开确认今日无到期 → 连击不断签(total=0 不发完成金) */
      try{ if(window.HansenReviewRewardsV963) HansenReviewRewardsV963.onTodayComplete({reviewed:0, graduated:0, total:0}); }catch(e){}
      /* 🔴v1165 复查：今天本来就没有到期的词 = 今日复习已经清空了 → 每日任务「清空今日复习」也算完成。
         以前这种日子它永远完不成，「12 个任务全部完成」也就拿不到。别的岛还有到期的词就不算（和横幅「全部到期清零」同一个口径）。 */
      try{
        var _gd = -1, _RR = window.HansenReviewRewardsV963;
        if(_RR && _RR._debug && typeof _RR._debug.globalDueInfo === 'function'){ var _gi = _RR._debug.globalDueInfo(); if(_gi && _gi.ok) _gd = _gi.globalDue | 0; }
        if(_gd <= 0) _questReviewClear();
      }catch(eQ){}
      return;
    }

    /* 🔴v1165 复查：先让复习奖励记下「今天有词到期」（今天刚答错的词当场就到期，奖励模块以前看不到）——
       不然孩子把它们都复习完，也不给「完成今日复习 +20」、连续复习天数不涨 */
    try{ if(window.HansenReviewRewardsV963 && typeof HansenReviewRewardsV963.refresh === 'function') HansenReviewRewardsV963.refresh(); }catch(eR){}
    var i = 0, revealed = false, reviewed = 0, graduated = 0, total = due.length;
    var BOXNAME = ['新词', '第 2 阶', '第 3 阶', '第 4 阶', '冲刺阶'];

    overlay.innerHTML = [
      '<style>',
      '#hr_today{position:fixed;inset:0;z-index:9999;background:linear-gradient(180deg,#7c2d12 0%,#1f1b14 55%,#0f172a 100%);display:flex;flex-direction:column;padding:20px 16px}',
      '#hr_today .ht_top{display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:10px}',
      '#hr_today .ht_top button{background:rgba(255,255,255,.08);color:#cbd5e1;border:0;width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer}',
      '#hr_today .ht_prog{font-size:14px;color:#fde68a;font-weight:800}',
      '#hr_today .ht_bar{height:6px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;margin-bottom:16px}',
      '#hr_today .ht_bar > i{display:block;height:100%;width:0;background:linear-gradient(90deg,#fbbf24,#f59e0b);transition:width .3s}',
      '#hr_today .ht_cardwrap{flex:1;display:flex;align-items:center;justify-content:center}',
      '#hr_today .ht_card{width:100%;max-width:340px;min-height:380px;background:linear-gradient(135deg,#b45309,#92400e);border-radius:24px;padding:28px;text-align:center;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;justify-content:center;align-items:center;user-select:none;-webkit-user-select:none}',
      '#hr_today .ht_card.rev{background:linear-gradient(135deg,#047857,#065f46)}',
      '#hr_today .ht_emoji{font-size:72px;line-height:1;margin-bottom:14px}',
      '#hr_today .ht_en{font-size:44px;font-weight:900;letter-spacing:1px;margin-bottom:6px}',
      '#hr_today .ht_pn{font-size:16px;opacity:.75;margin-bottom:10px}',
      '#hr_today .ht_cn{font-size:34px;font-weight:900;color:#fde047;margin-bottom:12px}',
      '#hr_today .ht_ex{font-size:19px;line-height:1.6;font-weight:600;font-style:italic;opacity:.95;margin-bottom:8px;padding:0 4px}',
      '#hr_today .ht_excn{font-size:15px;opacity:.85;line-height:1.5;padding:0 4px}',
      '#hr_today .ht_box{margin-top:14px;font-size:11px;color:rgba(255,255,255,.6)}',
      '#hr_today .ht_hint{color:rgba(255,255,255,.55);font-size:12px;margin-top:16px}',
      '#hr_today .ht_btm{display:flex;gap:10px;margin-top:18px}',
      '#hr_today .ht_btm button{flex:1;border:0;padding:15px;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer}',
      '#hr_today .ht_speak{background:linear-gradient(135deg,#10b981,#059669);color:#fff}',
      '#hr_today .ht_show{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000}',
      '#hr_today .ht_forgot{background:linear-gradient(135deg,#f87171,#dc2626);color:#fff}',
      '#hr_today .ht_got{background:linear-gradient(135deg,#34d399,#059669);color:#053}',
      '</style>',
      '<div class="ht_top">',
      '  <button id="ht_close">✕</button>',
      '  <div class="ht_prog" id="ht_prog"></div>',
      '  <div style="width:36px"></div>',
      '</div>',
      '<div class="ht_bar"><i id="ht_fill"></i></div>',
      '<div class="ht_cardwrap"><div class="ht_card" id="ht_card"></div></div>',
      '<div class="ht_btm" id="ht_btm"></div>'
    ].join('');
    document.body.appendChild(overlay);

    function render(){
      var it = due[i], w = it.word;
      var card = document.getElementById('ht_card'), btm = document.getElementById('ht_btm');
      document.getElementById('ht_prog').textContent = (i + 1) + ' / ' + total;
      document.getElementById('ht_fill').style.width = Math.round(i / total * 100) + '%';
      if(!revealed){
        card.className = 'ht_card';
        card.innerHTML =
          '<div class="ht_emoji">' + safeEmoji(w.emoji) + '</div>' +
          '<div class="ht_en">' + esc(w.en) + '</div>' +
          (w.pn ? '<div class="ht_pn">' + esc(w.pn) + '</div>' : '') +
          '<div class="ht_box">📦 ' + (BOXNAME[it.box] || '复习') + '</div>' +
          '<div class="ht_hint">先想想中文意思 👇</div>';
        btm.innerHTML =
          '<button class="ht_speak" id="ht_b_speak">🔊 听发音</button>' +
          '<button class="ht_show" id="ht_b_show">看答案 →</button>';
        document.getElementById('ht_b_speak').onclick = function(){ if(window.speak) try { window.speak(w.en); } catch(e){} };
        document.getElementById('ht_b_show').onclick = function(){
          revealed = true; render();
          if(window.speak) setTimeout(function(){ try { window.speak(w.en); } catch(e){} }, 150);
        };
      } else {
        card.className = 'ht_card rev';
        card.innerHTML =
          '<div class="ht_emoji">' + safeEmoji(w.emoji) + '</div>' +
          '<div class="ht_en" style="font-size:30px">' + esc(w.en) + '</div>' +
          '<div class="ht_cn">' + esc(w.cn) + '</div>' +
          (w.ex ? '<div class="ht_ex">"' + esc(w.ex) + '"</div>' : '') +
          (w.exCn ? '<div class="ht_excn">' + esc(w.exCn) + '</div>' : '');
        btm.innerHTML =
          '<button class="ht_forgot" id="ht_b_forgot">😅 没记住</button>' +
          '<button class="ht_got" id="ht_b_got">✅ 记住了</button>';
        document.getElementById('ht_b_forgot').onclick = function(){ grade(false); };
        document.getElementById('ht_b_got').onclick = function(){ grade(true); };
      }
    }

    function grade(ok){
      var it = due[i];
      if(_grade(it.idx, ok)) graduated++;
      if(ok) _questReview(1);   // 「记住了」才算巩固了一个（和旧复习屏一样只计答对）
      /* 🔴v1165 复查：过了一张卡 = 复习了一次（结算页写的「复习了 N 个单词」也是这么数的），成就「复习次数」「累计复习」用它 */
      try{ if(window.HansenReviewRewardsV963 && typeof HansenReviewRewardsV963.noteReview === 'function') HansenReviewRewardsV963.noteReview(1); }catch(eN){}
      reviewed++;
      i++;
      if(i >= total){ finish(); return; }
      revealed = false;
      render();
    }

    function finish(){
      /* 🔴v963样机: 通知复习奖励模块(今日复习完成+20/连击); 模块不存在或非试点岛时静默跳过 */
      try{ if(window.HansenReviewRewardsV963) HansenReviewRewardsV963.onTodayComplete({reviewed:reviewed, graduated:graduated, total:total}); }catch(e){}
      if(total > 0 && reviewed === total) _questReviewClear();   // 今天到期的词一个个都过了一遍 = 清空今日复习
      /* 🔴v1006 修复「底部绿块」事故：
         下面紧接着 overlay.innerHTML=... 会把内部那段 <style>（含
         #hr_today{position:fixed;inset:0;z-index:9999} ）一并冲掉，
         浮层随即退化为普通块元素、掉到页面最底部（用户在成就页/卡册页
         都看到一条绿色长条）。这里必须把定位写成**行内样式**，
         innerHTML 替换不会影响 style 属性，定位才保得住。 */
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;'
        + 'background:linear-gradient(180deg,#064e3b 0%,#0f172a 100%);'
        + 'display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch';
      overlay.innerHTML =
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:30px">' +
          '<div style="font-size:72px;margin-bottom:14px">🎉</div>' +
          '<div style="font-size:24px;font-weight:900;color:#fbbf24;margin-bottom:12px">今日复习完成!</div>' +
          '<div style="font-size:15px;color:#cbd5e1;line-height:1.9">复习了 <b style="color:#fde047">' + reviewed + '</b> 个单词' +
            (graduated > 0 ? ('<br>其中 <b style="color:#34d399">' + graduated + '</b> 个已经记牢毕业 🎓') : '') +
          '</div>' +
          '<button id="hr_today_back2" style="margin-top:28px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;border:0;padding:13px 32px;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer">返回复习中心</button>' +
        '</div>';
      var b = document.getElementById('hr_today_back2');
      if(b) b.onclick = _todayBackToCenter;
    }

    document.getElementById('ht_close').onclick = _todayBackToCenter;
    render();
  }

  function patchReviewBtn(){
    // 找 util 区里的"复习" 按钮 (v138 原本就有的 🔁)
    const utilCards = document.querySelectorAll('.util-card');
    let reviewCard = null;
    utilCards.forEach(card => {
      if(card.textContent.includes('复习')) reviewCard = card;
    });
    if(!reviewCard) return false;
    if(reviewCard.dataset.hrPatched) return true;
    reviewCard.dataset.hrPatched = '1';

    // 拦截原 onclick (原本是 showScreen('review'), 跳到 v138 的错词复习屏)
    reviewCard.removeAttribute('onclick');
    reviewCard.style.position = 'relative';
    reviewCard.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      openReviewCenter();
    });

    // 加红点 badge
    const badge = document.createElement('span');
    badge.className = 'hr_util_badge';
    badge.style.cssText = 'position:absolute;top:4px;right:4px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:8px;min-width:18px;text-align:center;box-shadow:0 1px 4px rgba(239,68,68,.5);border:1.5px solid #0f172a;line-height:1.3;display:none';
    reviewCard.appendChild(badge);

    function updateBadge(){
      const n = getCurrentIslandWrongs().length;
      badge.textContent = n > 99 ? '99+' : n;
      badge.style.display = n > 0 ? 'inline-block' : 'none';
    }
    updateBadge();
    _hrBadgeTimers.push(setInterval(updateBadge, 3000));  //🔴v839 存引用·pagehide清理
    
    return true;
  }

  // 🔴 v576: 给底栏"复习"(navReview)挂错题红点 — 与 util 复习卡同款提醒
  function patchNavReviewBadge(){
    const nav = document.getElementById('navReview');
    if(!nav) return false;
    if(nav.dataset.hrBadge) return true;
    nav.dataset.hrBadge = '1';
    nav.style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = 'hr_nav_badge';
    badge.style.cssText = 'position:absolute;top:2px;right:14px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:8px;min-width:16px;text-align:center;box-shadow:0 1px 4px rgba(239,68,68,.5);border:1.5px solid #0f172a;line-height:1.2;display:none';
    nav.appendChild(badge);
    function upd(){
      try {
        const n = getCurrentIslandWrongs().length;
        badge.textContent = n > 99 ? '99+' : n;
        badge.style.display = n > 0 ? 'inline-block' : 'none';
      } catch(e){}
    }
    upd();
    _hrBadgeTimers.push(setInterval(upd, 3000));  //🔴v839 存引用·pagehide清理
    return true;
  }

  function tryPatch(retries){
    var a = patchReviewBtn();
    var b = patchNavReviewBadge();
    if(a && b) return;
    if(retries > 0) setTimeout(() => tryPatch(retries - 1), 500);
  }
  if(document.body) tryPatch(10);
  else document.addEventListener('DOMContentLoaded', () => tryPatch(10));

  // ─────────────────────────────────────────────
  // 复习中心 overlay
  // ─────────────────────────────────────────────
  function openReviewCenter(){
    // 关掉已有的
    const old = document.getElementById('hr_center');
    if(old) old.remove();

    const wrongCount = getContextWrongs().length;
    const dueCount = window._huReviewContext ? 0 : _dueList().length;
    var _calNow = new Date();
    var _calMon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][_calNow.getMonth()];
    var _calDay = _calNow.getDate();
    const srsCard = window._huReviewContext ? '' : (
      '<div class="hr_section_title">\u23F0 \u95F4\u9694\u590D\u4E60 (\u6309\u8BB0\u5FC6\u66F2\u7EBF)</div>' +
      '<div class="hr_card" style="--c1:#b45309;--c2:#92400e" onclick="window.HansenReview._openToday()">' +
        /* 🔴BUG#103 v750: emoji 必须用【合法 JS 转义】——代理对 \uD83D\uDCC5(=📅)。绝不可用 Python 风格 \U0001F4C5(JS 不认 \U·反斜杠被忽略→原样显示乱码"U0001F4C5")。同理 🎉=\uD83C\uDF89。 */
        /* 🔴v758 真实日期小日历(替换 📅 emoji——苹果该 emoji 图案永远固定显示 JUL 17·与设备真实日期对不上·显示假日期看着怪) */
        '<span class="hr_cal"><span class="hr_cal_m">' + _calMon + '</span><span class="hr_cal_d">' + _calDay + '</span></span>' +
        '<span class="hr_badge ' + (dueCount > 0 ? 'hr_red_dot' : '') + '">' + (dueCount > 0 ? (dueCount + ' \u4E2A\u5230\u671F') : '\u5DF2\u6E05\u7A7A \uD83C\uDF89') + '</span>' +
        '<div class="hr_name">\u4ECA\u65E5\u590D\u4E60</div>' +
        '<div class="hr_desc">' + (dueCount > 0 ? ('\u4ECA\u5929\u6709 ' + dueCount + ' \u4E2A\u5355\u8BCD\u8BE5\u590D\u4E60\u4E86 \u00B7 \u8BB0\u7262\u4E00\u4E2A\u5C11\u4E00\u4E2A') : '\u4ECA\u5929\u7684\u590D\u4E60\u90FD\u5B8C\u6210\u5566 \u00B7 \u660E\u5929\u8BB0\u5FC6\u4F1A\u66F4\u7262\u56FA') + '</div>' +
      '</div>'
    );
    const allCount = getContextVocab().length;
    const learnedCount = (window.S?.learned || []).length;
    const customTitle = getContextTitle();

    const overlay = document.createElement('div');
    overlay.id = 'hr_center';
    overlay.innerHTML = `
      <style>
        @keyframes hr_slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes hr_iconFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        #hr_center{
          position:fixed;inset:0;z-index:9999;
          background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);
          overflow-y:auto;padding:20px 16px 100px;
          
        }
        #hr_center .hr_header{
          display:flex;align-items:center;gap:12px;margin-bottom:6px;padding-top:8px;
        }
        #hr_center .hr_back{
          background:rgba(255,255,255,.08);color:#cbd5e1;border:0;width:36px;height:36px;
          border-radius:10px;font-size:18px;cursor:pointer;flex-shrink:0;
        }
        #hr_center .hr_title{font-size:22px;font-weight:900;color:#fbbf24;letter-spacing:1px}
        #hr_center .hr_sub{color:#94a3b8;font-size:12px;margin-left:48px;margin-bottom:18px;line-height:1.5}
        #hr_center .hr_stat_row{
          display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px;
        }
        #hr_center .hr_stat{
          background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:12px;
          padding:10px 6px;text-align:center;
        }
        #hr_center .hr_stat .num{font-size:22px;font-weight:900;color:#fbbf24;line-height:1}
        #hr_center .hr_stat .lbl{font-size:11px;color:#94a3b8;margin-top:4px}
        #hr_center .hr_section_title{
          color:#cbd5e1;font-size:13px;font-weight:700;margin:18px 4px 10px;
          display:flex;align-items:center;gap:6px;
        }
        #hr_center .hr_card{
          background:linear-gradient(135deg,var(--c1,#1e293b),var(--c2,#0f172a));
          border-radius:16px;padding:18px;margin-bottom:12px;
          cursor:pointer;color:#fff;position:relative;
          box-shadow:0 6px 20px rgba(0,0,0,.4);
          transition:transform .15s;
          border:1px solid rgba(255,255,255,.08);
        }
        #hr_center .hr_card:active{transform:scale(.97)}
        #hr_center .hr_card .hr_icon{font-size:36px;display:inline-block;animation:hr_iconFloat 3s ease-in-out infinite}
        .hr_cal{display:inline-flex;flex-direction:column;width:40px;border-radius:7px;overflow:hidden;background:#fff;box-shadow:0 2px 7px rgba(0,0,0,.28);animation:hr_iconFloat 3s ease-in-out infinite;line-height:1;vertical-align:middle}
        .hr_cal_m{background:#e23b2e;color:#fff;font-size:12px;font-weight:800;text-align:center;padding:2px 0;letter-spacing:.5px}
        .hr_cal_d{color:#1c1c1e;font-size:22px;font-weight:800;text-align:center;padding:3px 0 4px}
        #hr_center .hr_card .hr_name{font-size:17px;font-weight:800;margin-top:4px;letter-spacing:.5px}
        #hr_center .hr_card .hr_desc{font-size:12px;color:rgba(255,255,255,.75);margin-top:4px;line-height:1.5}
        #hr_center .hr_card .hr_badge{
          position:absolute;top:14px;right:14px;
          background:rgba(0,0,0,.3);color:#fff;padding:4px 10px;border-radius:10px;
          font-size:11px;font-weight:700;
        }
        #hr_center .hr_card .hr_red_dot{
          background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-weight:800;
        }
        #hr_center .hr_btm_hint{
          text-align:center;color:#475569;font-size:11px;margin-top:24px;line-height:1.6;
        }
      </style>
      
      <div class="hr_header">
        <button class="hr_back" onclick="window.HansenReview._close()">←</button>
        <div class="hr_title">🎯 ${esc(customTitle || '复习中心')}</div>
      </div>
      <div class="hr_sub">温柔记住每一个不熟的单词</div>
      
      <div class="hr_stat_row">
        <div class="hr_stat"><div class="num">${learnedCount}</div><div class="lbl">已认识</div></div>
        <div class="hr_stat"><div class="num">${wrongCount}</div><div class="lbl">待复习</div></div>
        <div class="hr_stat"><div class="num">${allCount}</div><div class="lbl">本岛单词</div></div>
      </div>
      
      ${srsCard}
      <div id="hr_rewards_slot"></div><!-- 🔴v963样机: 复习奖励状态卡插槽(模块填充·非试点岛为空) -->
      <div class="hr_section_title">🌧️ 温柔复习 (零压力)</div>
      
      <div class="hr_card" style="--c1:#1e1b4b;--c2:#312e81" onclick="window.HansenReview._openSpellByCn()">
        <span class="hr_icon">✍️</span>
        <span class="hr_badge ${wrongCount > 0 ? 'hr_red_dot' : ''}">${wrongCount > 0 ? wrongCount + ' 个错题' : '推荐'}</span>
        <div class="hr_name">看汉意拼单词</div>
        <div class="hr_desc">看中文意思 · 可点喇叭听读音 · 拼写单词 · 60 秒倒计时</div>
      </div>
      
      <div class="hr_card" style="--c1:#365314;--c2:#3f6212" onclick="window.HansenReview._openFlashcard()">
        <span class="hr_icon">🃏</span>
        <span class="hr_badge">${wrongCount > 0 ? wrongCount + ' 张错题卡' : '推荐'}</span>
        <div class="hr_name">闪卡复习</div>
        <div class="hr_desc">一张一张看 · 自己翻自己看 · 不打分不催</div>
      </div>
      
      <div class="hr_card" style="--c1:#0c4a6e;--c2:#075985" onclick="window.HansenReview._openSpellByListen()">
        <span class="hr_icon">🎧</span>
        <span class="hr_badge">${wrongCount > 0 ? wrongCount + ' 个' : '推荐'}</span>
        <div class="hr_name">听音拼词</div>
        <div class="hr_desc">自动播放读音 · 听到后拼出单词 · 60 秒倒计时</div>
      </div>
      
      <div class="hr_section_title">📚 主动学习</div>
      
      <div class="hr_card" style="--c1:#6366f1;--c2:#4338ca" onclick="window.HansenReview._openExplore()">
        <span class="hr_icon">📚</span>
        <span class="hr_badge">${allCount} 个</span>
        <div class="hr_name">浏览全部</div>
        <div class="hr_desc">查看所有单词卡 · 点击查看认识、宠物掌握与知识结晶状态</div>
      </div>
      
      <div class="hr_card" style="--c1:#a16207;--c2:#854d0e" onclick="window.HansenReview._openWrongOnly()">
        <span class="hr_icon">📕</span>
        <span class="hr_badge ${wrongCount > 0 ? 'hr_red_dot' : ''}">${wrongCount} 个</span>
        <div class="hr_name">错题本</div>
        <div class="hr_desc">只看错过的单词 · 一个一个攻克</div>
      </div>
      
      <div class="hr_btm_hint">
        🌟 不要逼自己 · 看到熟悉的脸<br>
        就是在记住它了
      </div>
    `;
    
    document.body.appendChild(overlay);
    /* 🔴v963样机: 中心挂载后填充复习奖励状态卡(非试点岛模块不存在→插槽保持空) */
    try{ if(window.HansenReviewRewardsV963) HansenReviewRewardsV963.fillCenterSlot(); }catch(e){}
  }

  // ─────────────────────────────────────────────
  // 各种复习方式入口
  // ─────────────────────────────────────────────
  window.HansenReview = {
    /* 🔴v963刺一：真实答题→SRS 的唯一公开入口(由 hansen_review_rewards_v963 的 markAnswer 包装层调用) */
    absorbRealAnswer: _absorbRealAnswer,
    _srsMeta: { GAP: SRS_GAP.slice(), GRAD: SRS_GRAD },
    _open: function(){
      _beep();
      sanitizeReviewContext();
      openReviewCenter();
    },
    // v142o: 关 overlay 后回复习中心
    _closeAndBack: function(overlayId){
      _beep();
      const el = document.getElementById(overlayId);
      if(window._huFromReview){
        window._huFromReview = false;
        // 🔴v794 真正无缝·保留滚动位置: 复习中心(hr_center z9999)从v791起就【一直留在底下没删】·带着用户进子界面前的滚动位置。
        //   直接复用这个活着的复习中心·而非openReviewCenter重建(重建=滚动归零·用户下滑进的回来弹回顶部)。把活复习中心提到子界面(z9999)之上→先盖主页·撤子界面即可见·rAF复位z。
        var center = document.getElementById('hr_center');
        if(!center){ openReviewCenter(); center = document.getElementById('hr_center'); }  // 兜底: 不在才重建
        if(center) center.style.zIndex = '99998';   // 提到子界面之上→先盖主页·随后撤子界面即直接可见
        if(el) el.remove();                          // 撤子界面(在活复习中心之下·隐形移除)
        window._huReviewKeepContext = false;         // 🔴v1165 复查：已经回到复习中心，这个标记用过了（见 _close）
        requestAnimationFrame(function(){ var c = document.getElementById('hr_center'); if(c) c.style.zIndex = ''; });
      } else {
        if(el) el.remove();
      }
    },
    _close: function(){
      _beep();
      const c = document.getElementById('hr_center');
      if(c) c.remove();
      // v142ag: 用户主动关 (没 keep 标记) 时清 context
      /* 🔴v1165 复查：「练这 N 个词」「一起复习全部」只管这一次。从拼写练习等子界面回到复习中心后，标记早就用过了 ——
         孩子在复习中心点 ← 关掉它，就连这次的范围一起清掉。以前标记一直留着：过后点底栏「复习」打开的还是那几个词，
         「今日复习」卡也不见了（明明今天有词到期）。只有子界面还开着时才保留范围。 */
      if(!window._huReviewKeepContext || !_subScreenOpen()){
        window._huReviewContext = null;
      }
      window._huReviewKeepContext = false;
    },
    // 🔴v795 已删除"单词雨"功能(_openRain)——该功能不可达(无入口卡片onclick·岛屿主页注入按钮addEntryButton也早已注释停用)·Hansen确认无用·连同 hansen_rain.js 模块+所有script引用一并彻底删除。
    // v243: 看汉语拼词 (替代原"单词雨"入口)
    _openSpellByCn: function(){
      _beep();
      sanitizeReviewContext();
      window._huFromReview = true;
      window._huReviewKeepContext = true;
      // 🔴v791 防御·根治听音拼词/看汉意拼"只出读音卡住进不去": 强制复位复习中心z。
      //   隐患: 上次关闭时复习中心被临时提到z99998·靠requestAnimationFrame复位回9999·但rAF在微信WebView页面切后台等情况可能不执行→复习中心残留99998·下次打开拼写页(z99996)就开在复习中心【后面】=拼写页其实开了(autoplay出读音)但被盖住看不见=卡住。每次开前强制复位→拼写页永远在最上。
      var _c=document.getElementById('hr_center'); if(_c) _c.style.zIndex='';
      // 🔴v789 治本·一步直达·零遮罩: 拼写页(z99996)直接盖在复习中心(hr_center z9999)之上打开。
      //   复习中心【不删·留在底下】→ 拼写页 compositing 期间·主页仍被复习中心盖住(零露出);拼写页合成后盖在最上=用户直接看到拼写页。
      //   全程主页被 复习中心→拼写页 接力盖住·根本没有"露主页的缝"·不需要任何遮罩。关闭由 _backFromSpell 在拼写页之上重建复习中心后再撤拼写页·同样不露主页。
      if(window.HansenSpellPractice) window.HansenSpellPractice.openSpellByCn();
    },
    // v243: 听音拼词 (替代原"耳朵听"入口)
    _openSpellByListen: function(){
      _beep();
      sanitizeReviewContext();
      window._huFromReview = true;
      window._huReviewKeepContext = true;
      // 🔴v791 防御·根治听音拼词"只出读音卡住进不去"(详见 _openSpellByCn): 强制复位复习中心z·拼写页永远在最上。
      var _c=document.getElementById('hr_center'); if(_c) _c.style.zIndex='';
      // 🔴v789 治本·一步直达·零遮罩(同 _openSpellByCn): 拼写页盖在复习中心之上·复习中心留底下盖主页·全程零露出。
      if(window.HansenSpellPractice) window.HansenSpellPractice.openSpellByListen();
    },
    // 🔴v784 拼写练习(看汉意拼/听音拼)关闭后回复习中心·而非露出岛主页(Hansen:叉号别直接回主页·回刚进去的复习页)
    _backFromSpell: function(){
      window._huFromReview = false;
      window._huReviewKeepContext = true;      // 保留复习上下文·回到同一状态
      // 🔴v794 真正无缝·保留滚动位置: 复习中心(hr_center z9999)从v789起就【一直留在底下没删】·带着用户进拼写页前的滚动位置。
      //   所以关闭时【直接复用这个活着的复习中心】·而非openReviewCenter重建(重建=全新DOM·滚动归零+重新渲染·用户下滑到下面进的·回来却弹回顶部)。
      //   把活复习中心临时提到拼写页(z99996)之上→拼写页还盖着主页时它先在其上合成(零露出·零闪)·随后close()撤拼写页即直接可见·rAF复位z。
      //   = 从拼写页回复习中心·位置/滚动/状态完全不变·像从卧室走回客厅·无重载无延迟。
      var center = document.getElementById('hr_center');
      if(!center){ openReviewCenter(); center = document.getElementById('hr_center'); }  // 兜底: 万一复习中心不在了才重建
      if(center) center.style.zIndex = '99998';   // 临时提到拼写页之上→先盖住主页·随后撤拼写页即直接可见
      requestAnimationFrame(function(){ var c = document.getElementById('hr_center'); if(c) c.style.zIndex = ''; });  // 拼写页已撤·复位 z(回 CSS 的 9999)
      /* 🔴v1165 复查：拼写页马上就撤（hansen_spell_practice 的 close 先调这里再撤）—— 回到复习中心以后这个标记就用过了，
         下一帧清掉；复习范围本身（_huReviewContext）照旧留着，直到孩子关掉复习中心 */
      setTimeout(function(){ if(!_subScreenOpen()) window._huReviewKeepContext = false; }, 0);
    },
    _openFlashcard: function(){
      _beep();
      sanitizeReviewContext();
      window._huFromReview = true;
      window._huReviewKeepContext = true;
      var _c=document.getElementById('hr_center'); if(_c) _c.style.zIndex='';  // 🔴v791 防御: 复位复习中心z(防上次关闭rAF未复位残留99998·会盖住本子界面z9999=点了打不开/卡住)
      // 🔴v791 治本·零遮罩(同v789拼写转场): 闪卡子界面(hr_flashcard z9999)直接盖在复习中心(hr_center z9999·DOM后插=在上)之上打开·复习中心【不删·留在底下盖主页】→子界面compositing期间主页仍被复习中心盖住·全程零露出·不需要遮罩。关闭由_closeAndBack在子界面之上重建复习中心再撤子界面·同样不露主页。
      openFlashcard();
    },
    // 🔴v796 已删除"听音循环"功能(_openListenLoop + openListenLoop + hr_listen界面)——不可达(无入口卡片onclick)·Hansen确认无用·彻底删除。
    _openExplore: function(){
      _beep();
      sanitizeReviewContext();
      window._huFromReview = true;
      window._huReviewKeepContext = true;
      var _c=document.getElementById('hr_center'); if(_c) _c.style.zIndex='';  // 🔴v791 防御: 复位复习中心z(防残留99998盖住hr_flashcard=卡住)
      // 🔴v791 治本·零遮罩: 浏览全部走openBrowseAll(=hr_flashcard形式·盖在复习中心之上)·复习中心留底下盖主页·零露出·无遮罩。
      if(window._huReviewContext && window._huReviewContext.vocabList){
        openBrowseAll();
        return;
      }
      // 本岛fallback(复习中心一般有vocabList·不走这): 切explore原生屏(屏切换·非浮层·保留原遮罩衔接)
      const mask = document.createElement('div');
      mask.id = 'hr_to_sub_mask';
      mask.style.cssText = 'position:fixed;inset:0;z-index:9998;background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)';
      document.body.appendChild(mask);
      this._close();
      if(typeof window.showScreen === 'function'){
        window.showScreen('explore');
      }
      setTimeout(() => {
        const m = document.getElementById('hr_to_sub_mask');
        if(m) m.remove();
      }, 300);
    },
    _openToday: function(){
      _beep();
      window._huFromReview = true;
      window._huReviewKeepContext = true;
      var _c=document.getElementById('hr_center'); if(_c) _c.style.zIndex='';  // 🔴v791 防御: 复位复习中心z(防残留99998盖住hr_today=卡住)
      // 🔴v791 治本·零遮罩: 今日复习子界面(hr_today z9999)盖在复习中心之上·复习中心留底下盖主页·零露出·无遮罩。关闭由_todayBackToCenter在其上重建复习中心再撤今日界面。
      openTodayReview();
    },
    _dueCount: function(){ try { return _dueList().length; } catch(e){ return 0; } },
    _openWrongOnly: function(){
      _beep();
      sanitizeReviewContext();
      window._huFromReview = true;
      window._huReviewKeepContext = true;
      var _c=document.getElementById('hr_center'); if(_c) _c.style.zIndex='';  // 🔴v791 防御: 复位复习中心z(防残留99998盖住hr_wrongbook=卡住)
      // 🔴v791 治本·零遮罩: 错题本子界面(hr_wrongbook z9999)盖在复习中心之上·复习中心留底下盖主页·零露出·无遮罩。关闭由_closeAndBack在其上重建复习中心再撤错题本。
      openWrongBook();
    },
    _security: {
      safeWrongCount,
      safeWrongWeight,
      safeEmoji,
      normalizeWord,
      normalizeStoredWrongs,
    },
  };

  // ─────────────────────────────────────────────
  // 闪卡复习
  // ─────────────────────────────────────────────
  function openFlashcard(directPool){
    const wrongs = getContextWrongs();
    let pool;
    if(Array.isArray(directPool)){
      pool = normalizeVocab(directPool, false);
    } else if(wrongs.length > 0){
      pool = wrongs.map(w => w.word);
    } else {
      // 没错题, 用前 20 个单词
      pool = getContextVocab().slice(0, 20);
    }
    if(pool.length === 0){
      showToast('暂无单词');
      return;
    }
    
    let idx = 0;
    let flipped = false;
    
    const overlay = document.createElement('div');
    overlay.id = 'hr_flashcard';
    overlay.innerHTML = `
      <style>
        @keyframes hr_cardFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes hr_cardFlip{0%{transform:rotateY(0)}100%{transform:rotateY(180deg)}}
        #hr_flashcard{
          position:fixed;inset:0;z-index:9999;
          background:linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%);
          display:flex;flex-direction:column;
          /* 🔴v1008: 底部按 Home 横条留安全区, 顶部收紧让内容整体上移 */
          padding:calc(env(safe-area-inset-top,0px) + 12px) 16px calc(env(safe-area-inset-bottom,0px) + 16px);
          
        }
        #hr_flashcard .hr_fc_top{
          display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:10px;
        }
        #hr_flashcard .hr_fc_top button{
          background:rgba(255,255,255,.08);color:#cbd5e1;border:0;
          width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer;
        }
        #hr_flashcard .hr_fc_progress{font-size:14px;color:#94a3b8;font-weight:700}
        #hr_flashcard .hr_card_container{
          flex:1;display:flex;align-items:center;justify-content:center;
          perspective:1200px;
        }
        #hr_flashcard .hr_card_main{
          /* 🔴v1008: 原写死 height:420px, 在 680px 的可用空间里上下各空 130px,
             卡片显小且整体像被压到下半屏。改为随空间伸缩并设上下限。 */
          width:100%;max-width:352px;height:100%;max-height:540px;min-height:320px;
          background:linear-gradient(135deg,#6366f1,#4338ca);
          border-radius:24px;padding:30px;text-align:center;color:#fff;
          box-shadow:0 20px 60px rgba(0,0,0,.5);
          display:flex;flex-direction:column;justify-content:center;align-items:center;
          cursor:pointer;transition:all .3s;
          user-select:none;-webkit-user-select:none;
        }
        #hr_flashcard .hr_card_main.back{
          background:linear-gradient(135deg,#059669,#047857);
        }
        #hr_flashcard .hr_card_emoji{font-size:80px;line-height:1;margin-bottom:16px}
        #hr_flashcard .hr_card_en{font-size:48px;font-weight:900;letter-spacing:1px;margin-bottom:8px}
        #hr_flashcard .hr_card_pn{font-size:16px;opacity:.7;margin-bottom:14px}
        #hr_flashcard .hr_card_cn{font-size:36px;font-weight:900;color:#fde047;margin-bottom:14px}
        #hr_flashcard .hr_card_ex{font-size:20px;line-height:1.6;font-weight:600;font-style:italic;opacity:.95;margin-bottom:10px;padding:0 6px}
        #hr_flashcard .hr_card_excn{font-size:16px;opacity:.85;line-height:1.5;padding:0 6px}
        #hr_flashcard .hr_card_tap_hint{color:rgba(255,255,255,.5);font-size:12px;margin-top:18px}
        #hr_flashcard .hr_fc_btm{
          display:flex;gap:10px;margin-top:14px;
        }
        #hr_flashcard .hr_fc_btm button{
          flex:1;background:rgba(255,255,255,.08);color:#fff;border:0;
          padding:15px 12px;min-height:52px;border-radius:14px;font-size:14.5px;font-weight:800;cursor:pointer;
        }
        #hr_flashcard .hr_fc_btm .next{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000}
        #hr_flashcard .hr_fc_btm .speak{background:linear-gradient(135deg,#10b981,#059669)}
      </style>
      
      <div class="hr_fc_top">
        <button onclick="window.HansenReview._closeAndBack('hr_flashcard')">✕</button>
        <div class="hr_fc_progress" id="hr_fc_prog">1 / ${pool.length}</div>
        <div style="width:36px"></div>
      </div>
      
      <div class="hr_card_container">
        <div class="hr_card_main" id="hr_fc_card"></div>
      </div>
      
      <div class="hr_fc_btm">
        <button class="speak" id="hr_fc_speak">🔊 听单词</button>
        <button class="speak" id="hr_fc_speak_ex" style="display:none">📝 听例句</button>
        <button class="next" id="hr_fc_next">下一张 →</button>
      </div>
    `;
    document.body.appendChild(overlay);
    
    function renderCard(){
      const w = pool[idx];
      const card = document.getElementById('hr_fc_card');
      const prog = document.getElementById('hr_fc_prog');
      if(prog) prog.textContent = (idx + 1) + ' / ' + pool.length;
      // 显示/隐藏 听例句 按钮
      const exBtn = document.getElementById('hr_fc_speak_ex');
      if(exBtn) exBtn.style.display = w.ex ? 'block' : 'none';
      
      if(!flipped){
        // 正面: 只显示英文 + emoji
        card.classList.remove('back');
        card.innerHTML = `
          <div class="hr_card_emoji">${safeEmoji(w.emoji)}</div>
          <div class="hr_card_en">${esc(w.en)}</div>
          ${w.pn ? `<div class="hr_card_pn">${esc(w.pn)}</div>` : ''}
          <div class="hr_card_tap_hint">👆 点卡片看答案</div>
        `;
      } else {
        // 反面: 显示中文 + 例句
        card.classList.add('back');
        card.innerHTML = `
          <div class="hr_card_emoji">${safeEmoji(w.emoji)}</div>
          <div class="hr_card_cn">${esc(w.cn)}</div>
          ${w.ex ? `<div class="hr_card_ex">"${esc(w.ex)}"</div>` : ''}
          ${w.exCn ? `<div class="hr_card_excn">${esc(w.exCn)}</div>` : ''}
          <div class="hr_card_tap_hint">👆 再点看英文</div>
        `;
      }
    }
    renderCard();
    
    document.getElementById('hr_fc_card').onclick = function(){
      flipped = !flipped;
      renderCard();
      // 翻到答案面自动读
      if(flipped && window.speak){
        setTimeout(() => { try { window.speak(pool[idx].en); } catch(e){} }, 200);
      }
    };
    
    document.getElementById('hr_fc_next').onclick = function(){
      idx = (idx + 1) % pool.length;
      flipped = false;
      renderCard();
    };
    
    document.getElementById('hr_fc_speak').onclick = function(){
      if(window.speak) try { window.speak(pool[idx].en); } catch(e){}
    };
    document.getElementById('hr_fc_speak_ex').onclick = function(){
      // 调用岛页面的 speak(ex) - 它会自动查 SENTENCE_MAP 找本地 mp3
      const w = pool[idx];
      if(w && w.ex && window.speak){
        try { window.speak(w.ex); } catch(e){}
      }
    };
  }


  // ─────────────────────────────────────────────
  // 浏览全部 (跨岛上下文用闪卡形式)
  // ─────────────────────────────────────────────
  function openBrowseAll(){
    const pool = getContextVocab();
    if(pool.length === 0){ showToast('暂无单词'); return; }
    openFlashcard(pool);
  }
  
  // ─────────────────────────────────────────────
  // 错题本 (只列错题)
  // ─────────────────────────────────────────────
  function openWrongBook(){
    const wrongs = getContextWrongs();
    if(wrongs.length === 0){
      const msg = document.createElement('div');
      msg.id = 'hr_empty_msg';
      msg.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:30px;cursor:pointer';
      msg.innerHTML = `<div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #22c55e;border-radius:18px;padding:30px;text-align:center;color:#fff;font-size:18px;line-height:1.6;max-width:300px">🌟 太棒了!<br>本岛暂无错题<br><br><button id="hr_empty_close" style="margin-top:14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:0;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">关闭</button></div>`;
      document.body.appendChild(msg);
      // 关闭按钮 + 点击遮罩都关闭
      const closeMsg = () => { const el = document.getElementById('hr_empty_msg'); if(el) el.remove(); };
      document.getElementById('hr_empty_close').onclick = function(e){ e.stopPropagation(); closeMsg(); };
      msg.onclick = function(e){ if(e.target === msg) closeMsg(); };
      return;
    }
    
    // 按错过次数排序 (错得多的优先看)
    wrongs.sort((a, b) => b.count - a.count);
    
    const overlay = document.createElement('div');
    overlay.id = 'hr_wrongbook';
    let listHtml = wrongs.map(w => `
      <div class="hr_wb_item" data-en="${esc(w.word.en || '')}">
        <span class="hr_wb_emoji">${safeEmoji(w.word.emoji)}</span>
        <div class="hr_wb_main">
          <div class="hr_wb_en">${esc(w.word.en)}</div>
          <div class="hr_wb_cn">${esc(w.word.cn) || ''}</div>
        </div>
        <div class="hr_wb_count">错 ${safeWrongCount(w.count)} 次</div>
      </div>
    `).join('');
    
    overlay.innerHTML = `
      <style>
        #hr_wrongbook{
          position:fixed;inset:0;z-index:9999;
          background:linear-gradient(180deg,#1f1b14 0%,#0f172a 100%);
          overflow-y:auto;padding:20px 16px 80px;
        }
        #hr_wrongbook .hr_wb_top{display:flex;align-items:center;gap:12px;margin-bottom:16px}
        #hr_wrongbook .hr_wb_back{
          background:rgba(255,255,255,.08);color:#cbd5e1;border:0;
          width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer;
        }
        #hr_wrongbook .hr_wb_title{font-size:22px;font-weight:900;color:#fbbf24;letter-spacing:1px}
        #hr_wrongbook .hr_wb_intro{color:#94a3b8;font-size:12px;margin-bottom:16px;line-height:1.5}
        #hr_wrongbook .hr_wb_item{
          background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:14px;
          padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:14px;
          cursor:pointer;transition:transform .15s;color:#fff;
        }
        #hr_wrongbook .hr_wb_item:active{transform:scale(.98);background:rgba(99,102,241,.15)}
        #hr_wrongbook .hr_wb_emoji{font-size:36px;flex-shrink:0}
        #hr_wrongbook .hr_wb_main{flex:1}
        #hr_wrongbook .hr_wb_en{font-size:18px;font-weight:800}
        #hr_wrongbook .hr_wb_cn{font-size:14px;color:#fde047;margin-top:2px}
        #hr_wrongbook .hr_wb_count{
          background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;
          padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;
        }
      </style>
      <div class="hr_wb_top">
        <button class="hr_wb_back" onclick="window.HansenReview._closeAndBack('hr_wrongbook')">←</button>
        <div class="hr_wb_title">📕 错题本</div>
      </div>
      <div class="hr_wb_intro">点单词听发音 · 按错过次数排序<br>不要紧, 多看几次就记住了</div>
      ${listHtml}
    `;
    document.body.appendChild(overlay);
    
    // v142ai: 用 addEventListener 替代 inline onclick (防 XSS)
    overlay.querySelectorAll('.hr_wb_item').forEach(function(item){
      item.addEventListener('click', function(){
        const en = item.dataset.en;
        if(en && window.speak) try { window.speak(en); } catch(e){}
      });
    });
  }

  /* 🔴v1165: 开岛时把已有错词都放进复习计划。否则老错词第一次答对就先把错题数扣到 0，
   * 还没来得及进计划就从间隔复习里漏掉。等权威账本(DOMContentLoaded)先启动完再做。 */
  var _bootSeeded = false;
  function _seedPlanAtBoot(){
    if(_bootSeeded) return; _bootSeeded = true;
    try{
      if(typeof window.__hsnHasResetPending === 'function' && window.__hsnHasResetPending()) return;
      _ensureSrs();
    }catch(_bootSeed){}
  }
  // 本文件是 defer 脚本：此时 DOMContentLoaded 还没发，监听排在账本之后；load 只是保险
  if(document.readyState === 'complete') setTimeout(_seedPlanAtBoot, 0);
  else { document.addEventListener('DOMContentLoaded', _seedPlanAtBoot); window.addEventListener('load', _seedPlanAtBoot); }

  console.log('%c[HansenReview]%c 复习中心已就绪',
              'color:#06b6d4;font-weight:bold', 'color:#94a3b8');
})();
