/**
 * 📈 我的学习 · 成长面板 (hansen_mylearning.js) — 19 岛通用
 * "看见自己变强" 的正向激励:把孩子在各岛真实学到的东西聚合起来给他看。
 *
 * 数据来源(全部读游戏现成字段, 零侵入, 不碰 markAnswer / 不改任何岛代码):
 *   每岛加载/离开时, 本文件把【本岛 window.S 的真实学习数据】写进独立命名空间
 *     hsn_progress:<岛标题> = {name,totalWords,learned,ans,cor,boss,level,maxCombo,ts}
 *   面板读取所有 hsn_progress:* 做跨岛聚合。
 *   连续天数读全局 HansenCheckin.getStreak(); 今日复习读 HansenReview._dueCount()。
 *
 * 健康原则(面向初中生, 绝不做操控/上瘾黑科技):
 *   - 只呈现真实进步(已掌握/正确率/探索度), 让"变强"本身成为动力;
 *   - 复习完成 → 庆祝并提示自然收尾, 不诱导"再来一局";
 *   - 连签只展示、只鼓励, 绝不吓唬/制造内疚; 无限时 FOMO; 无随机奖励操控。
 *
 * 铁律(零bug): IIFE 单次注入; 全程 try/catch; 缺字段/缺依赖静默降级;
 *   面板为可交互全屏浮层, 入口卡片注入 .util-row(防重复)。
 */
(function(){
  'use strict';
  if(window.__hsnMyLearning) return;
  window.__hsnMyLearning = true;

  var TOTAL_ISLANDS = 19;
  var PFX = 'hsn_progress:';

  // ── 工具 ──
  function islandTitle(){ try { return ((document.title || '').split('·')[0] || '').trim() || (document.title || '岛屿'); } catch(e){ return '岛屿'; } }
  function num(v){ return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function pct(a, b){ return b > 0 ? Math.round(a / b * 100) : 0; }
  function getStreak(){ try { if(window.HansenCheckin && typeof HansenCheckin.getStreak === 'function') return num(HansenCheckin.getStreak()); } catch(e){} return 0; }
  function dueCount(){ try { if(window.HansenReview && typeof HansenReview._dueCount === 'function'){ var d = HansenReview._dueCount(); return num(d); } } catch(e){} return -1; }
  function daysAgo(ts){ if(!ts) return ''; var d = Math.floor((Date.now() - ts) / 86400000); return d <= 0 ? '今天' : d === 1 ? '昨天' : d + ' 天前'; }
  function esc(s){ return (s == null ? '' : String(s)).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  // ── 快照: 把本岛真实学习数据写进全局命名空间 ──
  function writeSnapshot(){
    try {
      var S = window.S; if(!S) return;
      var allW = window.allW;
      var snap = {
        name: islandTitle(),
        totalWords: Array.isArray(allW) ? allW.length : 0,
        learned: Array.isArray(S.learned) ? S.learned.length : 0,
        ans: num(S.totalAnswers),
        cor: num(S.totalCorrect),
        boss: Array.isArray(S.bossWon) ? S.bossWon.length : 0,
        level: num(S.level) || 1,
        maxCombo: (S.stats && num(S.stats.maxCombo)) || 0,
        ts: Date.now()
      };
      localStorage.setItem(PFX + snap.name, JSON.stringify(snap));
    } catch(e){}
  }

  // ── 聚合所有岛 ──
  function aggregate(){
    var out = { learned: 0, ans: 0, cor: 0, boss: 0, islands: [] };
    try {
      /* v1133: 走快照 —— 边遍历边读会因集合被别的模块改动而漏键 */ var _lsk1=(function(){var _o=[];try{for(var _q=0;_q<localStorage.length;_q++){var _kq=localStorage.key(_q);if(_kq)_o.push(_kq);}}catch(_e){}return _o;})();for(var i=0;i<_lsk1.length;i++){
        var k = _lsk1[i];
        if(!k || k.indexOf(PFX) !== 0) continue;
        var o;
        try { o = JSON.parse(localStorage.getItem(k)); } catch(e){ continue; }
        if(!o || typeof o !== 'object') continue;
        out.learned += num(o.learned);
        out.ans += num(o.ans);
        out.cor += num(o.cor);
        out.boss += num(o.boss);
        out.islands.push(o);
      }
    } catch(e){}
    out.islands.sort(function(a, b){ return num(b.ts) - num(a.ts); });   // 最近学习的排前面
    return out;
  }

  // ── CSS ──
  function injectCSS(){
    if(document.getElementById('hsn-ml-css')) return;
    var st = document.createElement('style'); st.id = 'hsn-ml-css';
    st.textContent = [
      '#hsn-ml{position:fixed;inset:0;z-index:99997;background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 55%,#312e81 100%);overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#e2e8f0}',
      '#hsn-ml .hsn-ml-wrap{max-width:480px;margin:0 auto;padding:14px 16px 40px}',
      '#hsn-ml .hsn-ml-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}',
      '#hsn-ml .hsn-ml-back{width:38px;height:38px;border-radius:12px;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:20px;cursor:pointer;flex:0 0 auto}',
      '#hsn-ml .hsn-ml-title{font-size:19px;font-weight:800;color:#fff}',
      '#hsn-ml .hsn-ml-title small{display:block;font-size:12px;font-weight:500;color:#a5b4fc;margin-top:1px}',
      '#hsn-ml .hsn-ml-hero{background:linear-gradient(135deg,#1e293b,#312e81);border:1px solid rgba(165,180,252,.25);border-radius:18px;padding:20px 16px;text-align:center;margin-bottom:14px;box-shadow:0 8px 24px rgba(0,0,0,.3)}',
      '#hsn-ml .hsn-ml-bignum{font-size:52px;font-weight:900;line-height:1;background:linear-gradient(135deg,#fde047,#fb923c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#fde047}',
      '#hsn-ml .hsn-ml-biglbl{font-size:14px;color:#cbd5e1;margin-top:6px}',
      '#hsn-ml .hsn-ml-mini{display:flex;gap:10px;margin-top:18px}',
      '#hsn-ml .hsn-ml-mc{flex:1;background:rgba(255,255,255,.06);border-radius:12px;padding:10px 6px}',
      '#hsn-ml .hsn-ml-mc .v{font-size:22px;font-weight:800;color:#fff}',
      '#hsn-ml .hsn-ml-mc .l{font-size:11px;color:#94a3b8;margin-top:2px}',
      '#hsn-ml .hsn-ml-cta{border-radius:16px;padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:12px}',
      '#hsn-ml .hsn-ml-cta.todo{background:linear-gradient(135deg,#7c2d12,#9a3412);border:1px solid #fb923c}',
      '#hsn-ml .hsn-ml-cta.done{background:linear-gradient(135deg,#064e3b,#065f46);border:1px solid #34d399}',
      '#hsn-ml .hsn-ml-cta .ico{font-size:30px;flex:0 0 auto}',
      '#hsn-ml .hsn-ml-cta .tx{flex:1}',
      '#hsn-ml .hsn-ml-cta .tx b{display:block;font-size:15px;color:#fff;font-weight:800}',
      '#hsn-ml .hsn-ml-cta .tx span{font-size:12px;color:#fed7aa}',
      '#hsn-ml .hsn-ml-cta.done .tx span{color:#a7f3d0}',
      '#hsn-ml .hsn-ml-gobtn{flex:0 0 auto;background:#fff;color:#1e40af;border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:800;cursor:pointer}',
      '#hsn-ml .hsn-ml-sec{font-size:14px;font-weight:800;color:#e2e8f0;margin:6px 2px 10px;display:flex;justify-content:space-between;align-items:center}',
      '#hsn-ml .hsn-ml-sec .cnt{font-size:13px;color:#a5b4fc;font-weight:600}',
      '#hsn-ml .hsn-ml-isl{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px 14px;margin-bottom:10px}',
      '#hsn-ml .hsn-ml-isl .row1{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}',
      '#hsn-ml .hsn-ml-isl .nm{font-size:15px;font-weight:700;color:#fff}',
      '#hsn-ml .hsn-ml-isl .ago{font-size:11px;color:#64748b}',
      '#hsn-ml .hsn-ml-bar{height:9px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden}',
      '#hsn-ml .hsn-ml-bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#22c55e,#4ade80);transition:width .6s ease-out}',
      '#hsn-ml .hsn-ml-isl .row2{display:flex;justify-content:space-between;margin-top:7px;font-size:12px;color:#94a3b8}',
      '#hsn-ml .hsn-ml-isl .row2 b{color:#cbd5e1}',
      '#hsn-ml .hsn-ml-empty{text-align:center;color:#94a3b8;padding:30px 16px;font-size:14px;line-height:1.7}',
      '#hsn-ml .hsn-ml-foot{text-align:center;font-size:13px;color:#a5b4fc;margin-top:18px;line-height:1.7}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  // ── 渲染面板 ──
  function render(){
    var ag = aggregate();
    var streak = getStreak();
    var acc = pct(ag.cor, ag.ans);
    var due = dueCount();   // 当前岛今日待复习; -1 = 取不到

    var ctaHtml = '';
    if(due > 0){
      ctaHtml = '<div class="hsn-ml-cta todo"><div class="ico">📚</div><div class="tx"><b>本岛今日还有 ' + due + ' 个词要复习</b><span>趁热打铁,记得更牢</span></div><button class="hsn-ml-gobtn" onclick="HansenMyLearning._goReview()">去复习</button></div>';
    } else if(due === 0){
      ctaHtml = '<div class="hsn-ml-cta done"><div class="ico">🎉</div><div class="tx"><b>本岛今日复习已完成!</b><span>做得很棒,休息一下也没关系</span></div></div>';
    }

    var islHtml = '';
    if(ag.islands.length === 0){
      islHtml = '<div class="hsn-ml-empty">还没有学习记录哦~<br>挑一座岛开始你的冒险吧!</div>';
    } else {
      ag.islands.forEach(function(o){
        var p = pct(num(o.learned), num(o.totalWords));
        var ia = pct(num(o.cor), num(o.ans));
        islHtml += '<div class="hsn-ml-isl">' +
          '<div class="row1"><span class="nm">' + esc(o.name) + '</span><span class="ago">' + daysAgo(o.ts) + '</span></div>' +
          '<div class="hsn-ml-bar"><i style="width:' + p + '%"></i></div>' +
          '<div class="row2"><span>已掌握 <b>' + num(o.learned) + ' / ' + num(o.totalWords) + '</b> 词</span>' +
          '<span>正确率 <b>' + ia + '%</b>' + (num(o.boss) > 0 ? ' · 击败 <b>' + num(o.boss) + '</b> Boss' : '') + '</span></div>' +
          '</div>';
      });
    }

    return '<div class="hsn-ml-wrap">' +
      '<div class="hsn-ml-top"><button class="hsn-ml-back" onclick="HansenMyLearning._close()">‹</button>' +
      '<div class="hsn-ml-title">我的学习<small>你的成长足迹</small></div></div>' +
      '<div class="hsn-ml-hero">' +
        '<div class="hsn-ml-bignum">' + ag.learned + '</div>' +
        '<div class="hsn-ml-biglbl">个单词已掌握 🌟</div>' +
        '<div class="hsn-ml-mini">' +
          '<div class="hsn-ml-mc"><div class="v">' + streak + '</div><div class="l">连续学习(天)</div></div>' +
          '<div class="hsn-ml-mc"><div class="v">' + (ag.ans > 0 ? acc + '%' : '—') + '</div><div class="l">总正确率</div></div>' +
          '<div class="hsn-ml-mc"><div class="v">' + ag.boss + '</div><div class="l">击败 Boss</div></div>' +
        '</div>' +
      '</div>' +
      ctaHtml +
      '<div class="hsn-ml-sec"><span>探索进度</span><span class="cnt">已点亮 ' + ag.islands.length + ' / ' + TOTAL_ISLANDS + ' 座岛</span></div>' +
      islHtml +
      '<div class="hsn-ml-foot">' + (ag.islands.length >= TOTAL_ISLANDS ? '全部岛屿点亮,你太厉害了!🏆' : '每天进步一点点,你已经很棒了 💪') + '</div>' +
    '</div>';
  }

  function openPanel(){
    try { writeSnapshot(); } catch(e){}   // 进面板前刷新本岛最新数据
    var el = document.getElementById('hsn-ml');
    if(!el){ el = document.createElement('div'); el.id = 'hsn-ml'; document.body.appendChild(el); }
    el.innerHTML = render();
    el.scrollTop = 0;
  }
  function closePanel(){ var el = document.getElementById('hsn-ml'); if(el) el.remove(); }
  function goReview(){
    closePanel();
    try {
      if(window.HansenReview && typeof HansenReview._openToday === 'function'){ HansenReview._openToday(); return; }
      if(window.HansenReview && typeof HansenReview._open === 'function'){ HansenReview._open(); return; }
    } catch(e){}
  }

  window.HansenMyLearning = { _open: openPanel, _close: closePanel, _goReview: goReview };

  // ── 注入主页入口卡片(.util-row) ──
  function injectEntry(){
    try {
      var cards = document.querySelectorAll('.util-card');
      if(!cards.length) return false;
      var row = null;
      for(var i = 0; i < cards.length; i++){ if(cards[i].parentElement && cards[i].parentElement.classList.contains('util-row')){ row = cards[i].parentElement; break; } }
      if(!row) row = cards[0].parentElement;
      if(!row || row.querySelector('.hsn-ml-entry')) return true;
      var card = document.createElement('div');
      card.className = (cards[0].className || 'util-card') + ' hsn-ml-entry';
      card.innerHTML = '<span class="u-icon"><img src="icons/ic_study.webp" alt="" draggable="false" style="width:75px;height:75px;object-fit:contain;vertical-align:middle;display:inline-block;transform:translate(0px,0px);filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))" onerror="window.hansenImgErr&&window.hansenImgErr(this)"></span><div class="u-label">我的学习</div>';
      card.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openPanel(); });
      row.appendChild(card);
      return true;
    } catch(e){ return false; }
  }

  function init(){
    try { injectCSS(); } catch(e){}
    try { writeSnapshot(); } catch(e){}
    // 入口注入(主页可能稍后渲染 → 短重试)
    var tries = 0;
    var t = setInterval(function(){ tries++; if(injectEntry() || tries > 20) clearInterval(t); }, 400);
    // 周期快照(仅页面可见) + 离开页面时落盘
    try { setInterval(function(){ if(document.visibilityState !== 'hidden') writeSnapshot(); }, 8000); } catch(e){}
    try { document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') writeSnapshot(); }); } catch(e){}
    try { window.addEventListener('pagehide', writeSnapshot); } catch(e){}
    console.log('%c[HansenMyLearning]%c 我的学习面板已就绪', 'color:#4ade80;font-weight:bold', 'color:#94a3b8');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
