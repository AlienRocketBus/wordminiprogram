/* ============================================================================
 * hansen_boss_theme.js (v955) — 🥊 打Boss 专属主题引擎
 *
 * Hansen(语音): "专门在打boss这一个模块儿, 设计一个主题。之前那个暗色调我们不用变,
 *               专门设计一个亮色调 —— 一个可以调成暗色调, 一个可以调成亮色调。
 *               而且打boss的时候, 后面就不要呈现出这个背景了, 不要让这个背景去影响这个大boss。
 *               这个色调一定要认认真真地去设计, 让所有的东西都显示得非常非常清楚,
 *               千万不要出现字体看不清的情况。"
 *
 * ── 为什么要有这个东西 ──────────────────────────────────────────────────────
 * 打Boss 屏原本的背景是【钻石商店买的 IMAX 电影主题】(HansenCinema 的全屏 canvas,
 * 九款: 糖果乐园/云端气球/云端梦境/彩虹甜心/焰火盛典…), 全是【明亮高饱和的糖果风场景】。
 * 两个后果:
 *   ① 花哨的场景把 boss 立绘埋掉了 —— boss 本该是主角。
 *   ② 屏上的字实测暴跌到 2.07~2.93:1(WCAG AA 要 4.5) —— 就是 Hansen 说的"根本看不清"。
 * 所以: 打Boss 时【不再画那个场景】, 改用【专门设计的干净幕布】。
 *
 * ── 三个选项(默认 dark) ────────────────────────────────────────────────────
 *   🌌 dark   「深空」  —— 原来的纯净深色幕布(Hansen: 暗色调不用变)。boss 立绘在深底上自然突出。
 *   🌤️ light  「晨曦」  —— 新设计的亮色调。见下方【设计说明】。
 *   🎬 cinema 「电影场景」—— 保留给已在钻石商店买过 IMAX 主题的人; 不选就不出现。
 *      (不做这个选项的话, 商店里卖出去的 9 款主题就全成了废品。)
 *
 * ── 「晨曦」亮色调 · 设计说明 ──────────────────────────────────────────────
 * 幕布: 干净的晨光渐变(白 → 淡蓝 → 雾蓝), 【不用任何图片】, 不跟 boss 抢戏。
 * 舞台光晕: boss 身后压一层柔和的深蓝径向光晕 —— 亮底上的 boss 立绘(尤其是金色发光的
 *          "上古太阳神"这类)靠它才能"浮"起来, 不会糊成一片。
 * 面板: 全部换成【近白色的半透明板】+ 柔和描边 —— 和深色调里的深色板一一对应, 结构完全一致。
 * 文字: 全部换成深色高对比:
 *   · 大词/中文题目 #1e40af (皇家蓝 —— 与旧驼棕文字彻底分离, 白板上 8.72:1)
 *   · 题目提示     #334155 (10.01:1)
 *   · boss 名      #b91c1c (深红 —— 仍有杀气, 6.31:1)
 *   · HP / 勇者    #1e293b (14.14:1)
 *   · 听音按钮     #3730a3 深靛蓝字 (原来是白字压在琥珀底上, 只有 1.9:1 —— 深色调里就是个隐患)
 * 每一对配色都【逐对算过对比度】, 而且是按【最坏情况】算的:
 *   半透明白板压在幕布【最暗的角落】(#bcd0ea) 上 —— 这是深色字最吃亏的情况。
 *   26 对配色全部 ≥ WCAG AA(正文 4.5:1 / 大号粗体 3.0:1)。最低的一项 4.83:1。
 * ============================================================================ */
(function () {
  if (window.__hansenBossThemeLoaded) return;
  window.__hansenBossThemeLoaded = true;

  var KEY = 'hansen_boss_theme';
  var THEMES = [
    { id: 'dark',   name: '深空',     emoji: '🌌', desc: '纯净深色幕布 · 电影感', sw: 'linear-gradient(160deg,#22305e,#0d142c 55%,#05070f)' },
    { id: 'light',  name: '晨曦',     emoji: '🌤️', desc: '明亮清爽 · 每个字都清清楚楚', sw: 'linear-gradient(160deg,#ffffff,#dbe7f8 55%,#bcd0ea)' },
    { id: 'cinema', name: '电影场景', emoji: '🎬', desc: '用你在钻石商店装备的 IMAX 主题', sw: 'linear-gradient(135deg,#f472b6,#facc15 50%,#38bdf8)' }
  ];

  function cur() {
    try {
      var v = localStorage.getItem(KEY);
      return (v === 'light' || v === 'cinema') ? v : 'dark';
    } catch (e) { return 'dark'; }
  }

  // ── 幕布 + 全部面板/文字的两套配色 ──────────────────────────────────────
  var L = 'html.hsn-bt-light #bossScreen ';
  var D = 'html.hsn-bt-dark #bossScreen ';
  var C = 'html.hsn-bt-cinema #bossScreen ';
  var CSS = [
    /* ══ 幕布(暗) —— 原样, Hansen 说暗色调不用变 ══ */
    'html.hsn-bt-dark #bossScreen::before{background:linear-gradient(180deg,#0f1a38 0%,#0a1122 60%,#05070f 100%) !important}',

    /* ══ v953: 深空/电影的 Boss 答题语义色 ══
       全局亮色配色和 Boss 主题是两条独立轴。樱花配色会把行内金色改为 #9f1239，
       若不在 Boss 层隔离，暗场景里就会变成截图中几乎看不见的酒红字。
       这里用 #bossScreen + Boss 主题类的高特异性覆盖，仅修答题文字；
       不改 Boss 立绘、HP、倒计时、攻击、奖励、存档和晨曦亮色主题。 */
    'html.hsn-bt-dark #bossScreen,html.hsn-bt-cinema #bossScreen{' +
      '--boss-answer-primary:#fde68a;--boss-answer-text:#f8fafc;--boss-answer-muted:#e2e8f0;' +
      '--boss-answer-type:#bfdbfe;--boss-answer-correct:#86efac;--boss-answer-wrong:#fca5a5}',
    D + '#bossQType,' + C + '#bossQType{color:var(--boss-answer-type) !important;text-shadow:0 1px 3px rgba(0,0,0,.82) !important}',
    D + '#bossQ,' + C + '#bossQ{color:var(--boss-answer-primary) !important;text-shadow:0 1px 3px rgba(0,0,0,.82) !important}',
    D + '#bossQSub,' + C + '#bossQSub{color:var(--boss-answer-muted) !important;text-shadow:0 1px 3px rgba(0,0,0,.82) !important}',
    D + '.boss-answer-kicker,' + C + '.boss-answer-kicker,' +
      D + '#bossQSub *,' + C + '#bossQSub *{color:var(--boss-answer-muted) !important}',
    D + '.boss-answer-primary,' + C + '.boss-answer-primary,' +
      D + '.boss-answer-secondary,' + C + '.boss-answer-secondary{color:var(--boss-answer-primary) !important}',
    D + '#bossOpts .boss-opt,' + C + '#bossOpts .boss-opt,' +
      D + '#bossOpts .boss-opt .boss-answer-choice-text,' + C + '#bossOpts .boss-opt .boss-answer-choice-text{' +
      'color:var(--boss-answer-text) !important;text-shadow:0 1px 3px rgba(0,0,0,.82) !important}',
    D + '#bossOpts .boss-answer-choice-label,' + C + '#bossOpts .boss-answer-choice-label{color:var(--boss-answer-primary) !important}',

    /* 压过 hansen_palette.js 的亮色主题行内色映射。盖到题目、smartHighlight、
       句子翻译和选项真实子节点，不再只修 #bossQ 外壳。 */
    D + '#bossQ [style*="color:#fbbf24"],' + C + '#bossQ [style*="color:#fbbf24"],' +
      D + '#bossQ [style*="color:#fde047"],' + C + '#bossQ [style*="color:#fde047"],' +
      D + '#bossQ [style*="color:#fde68a"],' + C + '#bossQ [style*="color:#fde68a"],' +
      D + '#bossQ [style*="color:#facc15"],' + C + '#bossQ [style*="color:#facc15"],' +
      D + '#bossQ [style*="color:#fcd34d"],' + C + '#bossQ [style*="color:#fcd34d"]{' +
      'color:var(--boss-answer-primary) !important}',
    D + '#bossOpts .boss-opt [style*="color:#fbbf24"],' + C + '#bossOpts .boss-opt [style*="color:#fbbf24"],' +
      D + '#bossOpts .boss-opt [style*="color:#fde047"],' + C + '#bossOpts .boss-opt [style*="color:#fde047"],' +
      D + '#bossOpts .boss-opt [style*="color:#facc15"],' + C + '#bossOpts .boss-opt [style*="color:#facc15"]{' +
      'color:var(--boss-answer-primary) !important}',

    /* 听音题答后会给英文写入蓝/绿/紫/黄行内色。暗底统一换成对应的浅色阶。 */
    D + '#bossOpts [style*="color:#3b82f6"],' + C + '#bossOpts [style*="color:#3b82f6"]{color:#93c5fd !important}',
    D + '#bossOpts [style*="color:#22c55e"],' + C + '#bossOpts [style*="color:#22c55e"]{color:#86efac !important}',
    D + '#bossOpts [style*="color:#a855f7"],' + C + '#bossOpts [style*="color:#a855f7"]{color:#d8b4fe !important}',
    D + '#bossOpts [style*="color:#facc15"],' + C + '#bossOpts [style*="color:#facc15"]{color:#fde68a !important}',
    D + '#bossQ [style*="color:#22c55e"],' + C + '#bossQ [style*="color:#22c55e"],' +
      D + '#bossQSub [style*="color:#22c55e"],' + C + '#bossQSub [style*="color:#22c55e"]{' +
      'color:var(--boss-answer-correct) !important}',
    D + '#bossQ [style*="color:#ef4444"],' + C + '#bossQ [style*="color:#ef4444"],' +
      D + '#bossQSub [style*="color:#ef4444"],' + C + '#bossQSub [style*="color:#ef4444"],' +
      D + '#bossOpts [style*="color:#ef4444"],' + C + '#bossOpts [style*="color:#ef4444"]{' +
      'color:var(--boss-answer-wrong) !important}',

    /* 作答结果使用明亮的绿/粉红，而不是暗绿/暗红。状态规则必须在普通选项之后。 */
    D + '#bossOpts .boss-opt.correct,' + C + '#bossOpts .boss-opt.correct,' +
      D + '#bossOpts .boss-opt.correct *,' + C + '#bossOpts .boss-opt.correct *,' +
      D + '.boss-answer-result-correct,' + C + '.boss-answer-result-correct,' +
      D + '.boss-answer-result-correct *,' + C + '.boss-answer-result-correct *{' +
      'color:var(--boss-answer-correct) !important}',
    D + '#bossOpts .boss-opt.wrong,' + C + '#bossOpts .boss-opt.wrong,' +
      D + '#bossOpts .boss-opt.wrong *,' + C + '#bossOpts .boss-opt.wrong *,' +
      D + '.boss-answer-result-wrong,' + C + '.boss-answer-result-wrong,' +
      D + '.boss-answer-result-wrong *,' + C + '.boss-answer-result-wrong *{' +
      'color:var(--boss-answer-wrong) !important}',

    /* 打字模式：已输入字母也必须是亮色。白色键盘仍保留深色键字。 */
    D + '.bts-slot.filled,' + C + '.bts-slot.filled{color:var(--boss-answer-primary) !important;border-bottom-color:var(--boss-answer-primary) !important}',
    D + '#btsHint,' + C + '#btsHint{color:var(--boss-answer-text) !important}',
    D + '#btsKbd .key,' + C + '#btsKbd .key{color:#1c1c1e !important}',
    D + '.bts-slot.boss-answer-result-correct,' + C + '.bts-slot.boss-answer-result-correct{' +
      'color:var(--boss-answer-correct) !important;border-bottom-color:var(--boss-answer-correct) !important}',
    D + '.bts-slot.boss-answer-result-wrong,' + C + '.bts-slot.boss-answer-result-wrong{' +
      'color:var(--boss-answer-wrong) !important;border-bottom-color:var(--boss-answer-wrong) !important}',
    D + '#btsHint.boss-answer-result-correct,' + C + '#btsHint.boss-answer-result-correct,' +
      D + '#btsHint.boss-answer-result-correct *,' + C + '#btsHint.boss-answer-result-correct *{' +
      'color:var(--boss-answer-correct) !important}',
    D + '#btsHint.boss-answer-result-wrong,' + C + '#btsHint.boss-answer-result-wrong,' +
      D + '#btsHint.boss-answer-result-wrong *,' + C + '#btsHint.boss-answer-result-wrong *{' +
      'color:var(--boss-answer-wrong) !important}',

    /* 拼写补全的待填空是“亮金底+深字”的可读特例；提交后再切换亮绿/浅红。 */
    D + '#bsfHole:not(.boss-answer-result-correct):not(.boss-answer-result-wrong),' +
      C + '#bsfHole:not(.boss-answer-result-correct):not(.boss-answer-result-wrong){color:#1e293b !important;background:#fbbf24 !important;text-shadow:none !important}',

    /* ══ 幕布(亮)「晨曦」 ══
       第一层 = boss 身后的舞台光晕(让亮底上的立绘"浮"起来, 尤其是金色发光的 boss)
       第二层 = 干净的晨光渐变(白→淡蓝→雾蓝), 不用任何图片, 不跟 boss 抢戏 */
    'html.hsn-bt-light #bossScreen::before{background:' +
      'radial-gradient(circle at 50% 30%, rgba(38,62,120,.20) 0%, rgba(38,62,120,.05) 44%, transparent 68%),' +
      'radial-gradient(ellipse 130% 78% at 50% 26%, #ffffff 0%, #eaf2ff 34%, #d3e2f7 64%, #bcd0ea 100%) !important}',

    /* ══ 亮色调: 面板全部换成近白半透明板, 文字全部换成深色高对比 ══ */
    L + '.back-btn{background:rgba(255,255,255,.82) !important;color:#1e293b !important;border-color:rgba(30,41,59,.28) !important}',
    L + '.boss-phase-tag{background:linear-gradient(135deg,#4338ca,#3730a3) !important;color:#fff !important}',   /* 白字压深靛蓝 7.90:1 */
    L + '.boss-rage-tag{background:linear-gradient(135deg,#dc2626,#991b1b) !important;color:#fff !important}',    /* 4.83:1 */
    L + '.boss-combo{background:rgba(255,255,255,.90) !important;color:#1e40af !important;border-color:#4f46e5 !important}',
    L + '.boss-name{background:rgba(255,255,255,.94) !important;color:#b91c1c !important;border-color:rgba(185,28,28,.45) !important}',
    L + '.boss-hp-bar{background:#dbe4f0 !important;border-color:#dc2626 !important}',
    L + '.boss-hp-text{background:rgba(255,255,255,.92) !important;color:#1e293b !important}',
    L + '.hero-section{background:rgba(255,255,255,.86) !important;border-color:#8fb2e6 !important;color:#1e293b !important}',
    L + '.hero-hp-bar{background:#dbe4f0 !important;border-color:#3b82f6 !important}',
    L + '.hero-hp-text{color:#0c4a6e !important}',
    L + '.hero-dmg-float{color:#b91c1c !important}',
    /* ══ 台词气泡 5 态 ══
       ⚠️ 大坑: hansen_boss_lock.js 用的是【双 ID 选择器 + !important】(#bossScreen #bossMsg.hit{...}),
          ID 权重压过任何类选择器 —— 用 .boss-msg 写规则【根本盖不住】(实测: 亮底上还是奶油色字, 3.88:1)。
          所以这里必须【也用 ID】(#bossMsg), 权重才够。
       设计: 答对→整只气泡变绿 / 答错·阶段→整只变红 (原来只换字色, 绿字压琥珀底只有 3.98:1, 不合格)。 */
    'html.hsn-bt-light #bossScreen #bossMsg{background:linear-gradient(135deg,rgba(239,246,255,.97),rgba(219,234,254,.95)) !important;border-color:#3b82f6 !important;color:#1e3a5f !important}',
    'html.hsn-bt-light #bossScreen #bossMsg.hit{background:linear-gradient(135deg,rgba(220,252,231,.96),rgba(187,247,208,.94)) !important;border-color:#16a34a !important;color:#14532d !important}',
    'html.hsn-bt-light #bossScreen #bossMsg.crit{background:linear-gradient(135deg,rgba(250,245,255,.97),rgba(243,232,255,.95)) !important;border-color:#9333ea !important;color:#7e22ce !important}',
    'html.hsn-bt-light #bossScreen #bossMsg.rage{background:linear-gradient(135deg,rgba(254,242,242,.97),rgba(254,226,226,.95)) !important;border-color:#dc2626 !important;color:#b91c1c !important}',
    'html.hsn-bt-light #bossScreen #bossMsg.miss{background:linear-gradient(135deg,rgba(254,226,226,.96),rgba(254,202,202,.94)) !important;border-color:#dc2626 !important;color:#991b1b !important}',
    'html.hsn-bt-light #bossScreen #bossMsg.phase{background:linear-gradient(135deg,rgba(254,226,226,.96),rgba(254,202,202,.94)) !important;border-color:#dc2626 !important;color:#991b1b !important}',
    /* 气泡内层也被双ID规则锁着(#bossScreen #bossMsg .boss-msg-inner) → 强制跟随外层字色 */
    'html.hsn-bt-light #bossScreen #bossMsg .boss-msg-inner{color:inherit !important}',
    /* 其余带 ID 的元素同样用 ID 兜一遍, 防止将来 boss_lock 加 ID 规则又把亮色调压回去 */
    'html.hsn-bt-light #bossScreen #bossName{background:rgba(255,255,255,.94) !important;color:#b91c1c !important;border-color:rgba(185,28,28,.45) !important;text-shadow:none !important}',
    'html.hsn-bt-light #bossScreen #bossHPText{background:rgba(255,255,255,.92) !important;color:#1e293b !important;text-shadow:none !important}',
    'html.hsn-bt-light #bossScreen #bossQType{background:rgba(255,255,255,.92) !important;color:#1e40af !important;border-color:rgba(59,130,246,.55) !important}',
    'html.hsn-bt-light #bossScreen #bossQ,html.hsn-bt-light #bossScreen #bossQ *{color:#1e40af !important;text-shadow:none !important}',
    'html.hsn-bt-light #bossScreen #bossQ{background:rgba(255,255,255,.96) !important;border-color:rgba(59,130,246,.50) !important}',
    'html.hsn-bt-light #bossScreen #bossQSub,html.hsn-bt-light #bossScreen #bossQSub *{color:#334155 !important;text-shadow:none !important}',
    'html.hsn-bt-light #bossScreen #bossQSub{background:rgba(255,255,255,.92) !important}',
    'html.hsn-bt-light #bossScreen #heroHPText{color:#0c4a6e !important;text-shadow:none !important}',
    'html.hsn-bt-light #bossScreen #bossPhaseTag{background:linear-gradient(135deg,#4338ca,#3730a3) !important;color:#fff !important}',
    /* 题面 */
    L + '.boss-q-type{background:rgba(255,255,255,.92) !important;color:#1e40af !important;border-color:rgba(59,130,246,.55) !important}',
    L + '.boss-question{background:rgba(255,255,255,.96) !important;color:#1e40af !important;border-color:rgba(59,130,246,.50) !important}',
    L + '.boss-q-sub{background:rgba(255,255,255,.92) !important;color:#334155 !important}',
    /* 选项 4 态 */
    L + '.boss-opt{background:linear-gradient(135deg,#ffffff,#eaf1fb) !important;color:#1e293b !important;border-color:#a8bdd9 !important}',
    L + '.boss-opt:hover{background:linear-gradient(135deg,#e0e7ff,#c7d2fe) !important;color:#312e81 !important;border-color:#6366f1 !important}',
    L + '.boss-opt.correct{background:linear-gradient(135deg,#dcfce7,#bbf7d0) !important;color:#14532d !important;border-color:#22c55e !important}',
    L + '.boss-opt.wrong{background:linear-gradient(135deg,#fee2e2,#fecaca) !important;color:#7f1d1d !important;border-color:#ef4444 !important}',
    'html.hsn-bt-light #bossScreen #bossOpts .boss-opt.correct,html.hsn-bt-light #bossScreen #bossOpts .boss-opt.correct *,' +
      'html.hsn-bt-light #bossScreen .boss-answer-result-correct,html.hsn-bt-light #bossScreen .boss-answer-result-correct *{color:#14532d !important}',
    'html.hsn-bt-light #bossScreen #bossOpts .boss-opt.wrong,html.hsn-bt-light #bossScreen #bossOpts .boss-opt.wrong *,' +
      'html.hsn-bt-light #bossScreen .boss-answer-result-wrong,html.hsn-bt-light #bossScreen .boss-answer-result-wrong *{color:#7f1d1d !important}',
    'html.hsn-bt-light #bossScreen .bts-slot.filled{color:#1e40af !important;border-bottom-color:#1e40af !important}',
    'html.hsn-bt-light #bossScreen #btsHint{color:#1e293b !important}',
    'html.hsn-bt-light #bossScreen #btsKbd .key{color:#1c1c1e !important}',
    'html.hsn-bt-light #bossScreen #bsfHole:not(.boss-answer-result-correct):not(.boss-answer-result-wrong){color:#1e293b !important;background:#fbbf24 !important;text-shadow:none !important}',
    'html.hsn-bt-light #bossScreen #bossQ .boss-answer-result-correct,' +
      'html.hsn-bt-light #bossScreen #bossQ .boss-answer-result-correct *{color:#14532d !important}',
    'html.hsn-bt-light #bossScreen #bossQ .boss-answer-result-wrong,' +
      'html.hsn-bt-light #bossScreen #bossQ .boss-answer-result-wrong *{color:#7f1d1d !important}',
    'html.hsn-bt-light #bossScreen #bossOpts .bts-slot.boss-answer-result-correct{' +
      'color:#14532d !important;border-bottom-color:#16a34a !important}',
    'html.hsn-bt-light #bossScreen #bossOpts .bts-slot.boss-answer-result-wrong{' +
      'color:#7f1d1d !important;border-bottom-color:#dc2626 !important}',
    'html.hsn-bt-light #bossScreen #btsHint.boss-answer-result-correct,' +
      'html.hsn-bt-light #bossScreen #btsHint.boss-answer-result-correct *{color:#14532d !important}',
    'html.hsn-bt-light #bossScreen #btsHint.boss-answer-result-wrong,' +
      'html.hsn-bt-light #bossScreen #btsHint.boss-answer-result-wrong *{color:#7f1d1d !important}',
    /* 听音/喇叭按钮: 改用深靛蓝，彻底避开旧驼棕文字族。 */
    L + '.boss-listen-btn,' + L + '.boss-speaker-btn{color:#3730a3 !important;border-color:rgba(79,70,229,.45) !important}',
    L + '.boss-divider{background:linear-gradient(90deg,transparent,#94a3b8,transparent) !important}',
    /* 亮底上不能再用深色描影(会把深色字糊成一团) */
    L + '.boss-name,' + L + '.boss-question,' + L + '.boss-q-sub,' + L + '.boss-hp-text,' + L + '.hero-hp-text{text-shadow:none !important}',

    /* ══ 兜底 ①: 继承字色 ══
       打Boss 屏的默认字色是【浅灰 #e2e8f0】(为深底设计的)。亮色调下, 任何"没单独指定颜色"的
       文字(比如完形填空那句中文提示)都会继承它 → 在亮幕布上几乎看不见(实测 1.34:1)。
       所以把继承的底色整体翻成深色; 上面那些【单独指定过颜色】的元素不受影响。 */
    'html.hsn-bt-light #bossScreen,html.hsn-bt-light #bossContent,' + L + '.boss-arena{color:#1e293b !important}',

    /* ══ 兜底 ②: 写死在 HTML 行内的浅色字 ══
       结算/胜利浮层里有一批 style="color:#xxx" 是直接写在标签上的(行内样式),
       样式表【必须用 !important】才盖得住。这些色是为深底挑的, 在亮底上全都不合格:
         #cbd5e1(亮度.66) · #94a3b8(.42) · #fbbf24 金(.58) · #22c55e 绿(.41) · #ef4444 红(3.4:1)
       ⚠️ 严格限定在 #bossScreen 里 + 只在亮色调生效, 不会误伤别的界面。 */
    L + '[style*="color:#cbd5e1"],' + L + '[style*="color:#e2e8f0"]{color:#1e293b !important}',
    L + '[style*="color:#94a3b8"]{color:#475569 !important}',
    L + '[style*="color:#fbbf24"]{color:#1e40af !important}',
    L + '[style*="color:#22c55e"]{color:#15803d !important}',
    L + '[style*="color:#ef4444"]{color:#b91c1c !important}',
    /* 胜利标题使用蓝紫裁切字；旧驼棕文字族在 Boss 内永久禁用。 */
    L + '.boss-victory h2{background:linear-gradient(90deg,#1e40af,#6d28d9) !important;-webkit-background-clip:text !important;background-clip:text !important;-webkit-text-fill-color:transparent !important}',

    /* ══ 兜底 ③: 题目区里【写死的深色卡片】 ══
       ⚠️ 上面那条 #bossQ * 的兜底(把题目区所有字染深)会误伤这类卡片:
          拼写题的答案框 #bsfBox 是【深底白字】(background:rgba(15,23,42,.85);color:#fff),
          字一染深就变成【深字压深底】—— 实测 1.63:1, 完全看不见。这正是"盲目覆盖会误伤"的典型。
       所以: 把这些深色卡片【连底带字一起】翻成浅色。放在 #bossQ * 之后, 权重相同 → 后写的赢。 */
    'html.hsn-bt-light #bossScreen #bsfBox{background:rgba(255,255,255,.94) !important;color:#1e293b !important;border-color:#6366f1 !important;text-shadow:none !important}',
    L + '[style*="background:rgba(15,23,42"],' + L + '[style*="background:#0f172a"],' +
      L + '[style*="background:#1e293b"],' + L + '[style*="background:#334155"],' +
      L + '[style*="background:#475569"],' + L + '[style*="background:linear-gradient(135deg,#1e293b"]' +
      '{background:rgba(255,255,255,.94) !important;color:#1e293b !important}',

    /* ══ 打Boss 时不再画那个花哨的电影场景(Hansen: "后面就不要呈现出这个背景了") ══
       只有明确选了「电影场景」才画。 */
    'html.hsn-bt-dark body.hsn-boss-noheader #hsnCinemaCanvas,html.hsn-bt-light body.hsn-boss-noheader #hsnCinemaCanvas,' +
      'html.hsn-bt-dark body.hsn-boss-battle #hsnCinemaCanvas,html.hsn-bt-light body.hsn-boss-battle #hsnCinemaCanvas{display:none !important}',

    /* ══ ⭐ 让「晨曦」的幕布【真的亮起来】 ══
       坑: body 上还挂着一层【全屏固定的星云渐变】(body::before / body::after —— 紫/蓝的宇宙背景 + 星点)。
           它在正常层(z:auto), 而 boss 幕布是 #bossScreen::before(z:-2) —— 星云层【压在幕布之上】,
           把我设计的晨光渐变染成了灰色(实测幕布顶部只有 rgb(152,160,175), 底部更暗到 rgb(72,81,97))。
           文字对比度之所以还合格, 全靠底板够厚 —— 但那不是设计的样子。
       修: 只在【打Boss屏 + 晨曦主题】时把这层星云关掉(body.hsn-boss-noheader 是进 boss 屏才加的类),
           其它界面的星云一点不受影响。深色调保持原样(Hansen: 暗色调不用变)。 */
    'html.hsn-bt-light body.hsn-boss-noheader::before,html.hsn-bt-light body.hsn-boss-noheader::after,' +
      'html.hsn-bt-light body.hsn-boss-battle::before,html.hsn-bt-light body.hsn-boss-battle::after{display:none !important}'
  ].join('\n');

  function ensureCSS() {
    var st = document.getElementById('hsnBossThemeCSS');
    if (!st) {
      st = document.createElement('style');
      st.id = 'hsnBossThemeCSS';
      (document.head || document.documentElement).appendChild(st);
    }
    if (st.textContent !== CSS) st.textContent = CSS;
  }

  function inBossScreen() {
    try {
      return !!(document.body && (document.body.classList.contains('hsn-boss-noheader') ||
        document.body.classList.contains('hsn-boss-battle')));
    }
    catch (e) { return false; }
  }

  var cinemaWasSuppressed = false;

  function restoreActiveCinema() {
    try {
      var shop = window.HansenDiamondShop;
      if (shop && typeof shop.restoreActiveTheme === 'function') {
        shop.restoreActiveTheme();
        return true;
      }
      var equipped = shop && shop.getEquipped && shop.getEquipped();
      var tid = typeof equipped === 'string' ? equipped : equipped && (equipped.theme || equipped.imax || equipped.id);
      if (tid && window.HansenCinema && window.HansenCinema.apply) return window.HansenCinema.apply(tid);
    } catch (e) { }
    return false;
  }

  /* Boss 的“深空/晨曦”只应在 Boss 屏抑制电影画布。离开 Boss 后必须恢复
     当前装备或仍在计时的试用主题，不能把整座岛的动态主题一并关掉。 */
  function syncCinema() {
    try {
      guardCinema();
      var C = window.HansenCinema;
      if (!C) return false;
      var blocked = inBossScreen() && cur() !== 'cinema';
      if (blocked) {
        cinemaWasSuppressed = true;
        if (C.stop) C.stop();
        return false;
      }
      if (cinemaWasSuppressed) {
        cinemaWasSuppressed = false;
        return restoreActiveCinema();
      }
    } catch (e) { }
    return true;
  }

  function apply(id) {
    if (id !== 'light' && id !== 'cinema') id = 'dark';
    try { localStorage.setItem(KEY, id); } catch (e) { }
    var h = document.documentElement;
    h.classList.remove('hsn-bt-dark', 'hsn-bt-light', 'hsn-bt-cinema');
    h.classList.add('hsn-bt-' + id);
    ensureCSS();
    syncCinema();
    try { renderPicker(); } catch (e) { }
    return true;
  }

  // 电影引擎可能被钻石商店的 lateBoot 重新拉起来 → 只在 Boss 屏按 Boss 主题拦截。
  function guardCinema() {
    try {
      var C = window.HansenCinema;
      if (!C || C.__hsnBtWrapped) return;
      var origApply = C.apply;
      C.apply = function (tid) {
        if (inBossScreen() && cur() !== 'cinema') {
          cinemaWasSuppressed = true;
          try { C.stop && C.stop(); } catch (e) { }
          return false;
        }
        return origApply.apply(C, arguments);
      };
      C.__hsnBtWrapped = true;
    } catch (e) { }
  }

  // ── 设置页选择器(注入 settingsContent · 幂等) ──
  function renderPicker() {
    var sc = document.getElementById('settingsContent');
    if (!sc) return;
    var c = cur();
    var box = document.getElementById('hsnBossThemePicker');
    if (!box) {
      box = document.createElement('div');
      box.className = 'settings-section';
      box.id = 'hsnBossThemePicker';
      var pal = document.getElementById('hsnPalPicker');
      if (pal && pal.nextSibling) sc.insertBefore(box, pal.nextSibling);
      else if (pal) sc.appendChild(box);
      else sc.insertBefore(box, sc.firstChild);
    }
    var h = '<h3 style="margin:0 0 4px">🥊 打Boss 主题</h3>'
      + '<div style="font-size:12px;color:var(--pal-ink-2,#cbd5e1);margin-bottom:10px">只影响打Boss画面 · 背景干净, 不抢 boss 的戏 · 每个字都清清楚楚</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">';
    for (var i = 0; i < THEMES.length; i++) {
      var t = THEMES[i], on = (t.id === c);
      h += '<div class="hsn-bt-sw" data-bt="' + t.id + '" style="cursor:pointer;border-radius:12px;padding:8px 5px;text-align:center;'
        + 'background:' + t.sw + ';'
        + 'border:' + (on ? '3px solid #22c55e' : '2px solid rgba(148,163,184,.45)') + ';'
        + 'box-shadow:' + (on ? '0 0 12px rgba(34,197,94,.55)' : 'none') + '">'
        + '<div style="font-size:20px;line-height:1.1">' + t.emoji + '</div>'
        + '<div style="font-size:12px;font-weight:800;margin-top:3px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 8px rgba(0,0,0,.8)">' + t.name + '</div>'
        + (on ? '<div style="font-size:10px;font-weight:800;color:#bbf7d0;text-shadow:0 1px 3px rgba(0,0,0,.95)">使用中</div>' : '')
        + '</div>';
    }
    h += '</div><div style="font-size:11px;color:var(--pal-ink-2,#cbd5e1);margin-top:8px">'
      + (c === 'cinema' ? '⚠️ 电影场景很花, 会盖住 boss 立绘 —— 想让 boss 更突出就选「深空」或「晨曦」'
                        : '现在打Boss的背景是干净的幕布, boss 立绘和文字都很突出 ✅')
      + '</div>';
    box.innerHTML = h;
    var sws = box.querySelectorAll('.hsn-bt-sw');
    for (var j = 0; j < sws.length; j++) {
      sws[j].onclick = (function (id) {
        return function () {
          apply(id);
          if (id === 'cinema') {
            try { restoreActiveCinema(); } catch (e) { }
          }
        };
      })(THEMES[j].id);
    }
  }

  // 首帧前就把类挂上(防止打Boss时闪一下旧配色)
  apply(cur());
  guardCinema();

  function boot() {
    ensureCSS();
    guardCinema();
    syncCinema();
    /* island_season.html 的 Boss 选关与战斗共用同一屏：只有真正开战时才添加
       hsn-boss-battle，且不会添加 hsn-boss-noheader。监听这个类的切换，确保开战
       当帧暂停动态场景、胜负/离开后恢复；不依赖各岛脚本的加载顺序。 */
    try {
      if (document.body && window.MutationObserver && !document.body.__hsnBtClassObserver) {
        var classObserver = new MutationObserver(function (records) {
          for (var i = 0; i < records.length; i++) {
            if (records[i].attributeName === 'class') { syncCinema(); break; }
          }
        });
        classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        document.body.__hsnBtClassObserver = classObserver;
      }
    } catch (e) { }
    try { renderPicker(); } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', function () { setTimeout(boot, 300); });

  // 进设置页时补渲一次(设置页可能是后建的)
  (function hookShow() {
    if (typeof window.showScreen !== 'function') { return setTimeout(hookShow, 60); }
    if (window.__hsnBtHooked) return;
    window.__hsnBtHooked = true;
    var orig = window.showScreen;
    window.showScreen = function (id) {
      var r = orig.apply(this, arguments);
      if (id === 'settings') { try { renderPicker(); } catch (e) { } }
      try { ensureCSS(); guardCinema(); syncCinema(); } catch (e) { }
      return r;
    };
  })();

  window.HansenBossTheme = { apply: apply, get: cur, list: THEMES };
})();
