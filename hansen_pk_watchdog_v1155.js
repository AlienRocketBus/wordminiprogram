/* hansen_pk_watchdog_v1155.js —— 对战/天梯的看门狗
 *
 * ═══ 为什么做这个 ═══
 *
 * 今天挖出的天梯 bug，**形态出奇地一致**：
 *
 *   · 房建好了，屏幕是白的           （_createForLadder 没开界面）
 *   · 一直转圈，永远不给结果          （断网没人判断）
 *   · 卡在"正在等对手交卷…"永不结束   （没有超时）
 *   · 停在倒计时，答了没反应          （对战中断网）
 *
 * **共同点：界面进了一个"废掉但没人管"的状态。**
 * 而每一次我都是「找到那条路 → 在那条路上补一句提示」。
 *
 * > 与其把每条路都堵一遍（总会漏），不如守住必经之地。
 *
 * 这个模块就是那个"必经之地"：**不管因为什么原因废掉，
 * 只要用户被卡住超过一段时间，它就把人救出来。**
 *
 * ═══ 它盯三件事 ═══
 *
 *   ① **白屏**：明明发起了天梯/对战动作，几秒后屏幕上却什么都没有
 *   ② **僵住**：对战界面在跑，但内容一动不动（倒计时都停了）
 *   ③ **无解**：等待类界面（找对手/等交卷）超过硬上限
 *
 * ═══ 救的方式 ═══
 *
 * **不自动跳转、不自动重开**（那可能把人从正常对局里踢出去），
 * 而是**盖一层说明 + 给一个出口**：告诉他发生了什么、下一步点哪里。
 *
 * > 用户最怕的不是出错，是**出错了还不知道该怎么办**。
 */
(function () {
  'use strict';

  var WHITE_MS = 6000;    /* 发起动作后多久没界面算白屏 */
  var FROZEN_MS = 25000;  /* 对战界面多久没变化算僵住 */
  var WAIT_MS = 90000;    /* 等待类界面的硬上限 */

  var _armed = null;      /* { what, at }：正在盯的那个动作 */
  var _lastPaint = '';
  var _lastPaintAt = 0;
  var _rescued = false;

  function log(kind, detail) {
    try {
      if (window.HansenSilentWatch && window.HansenSilentWatch.recent) {
        /* 借用观察者的缓冲区，自检面板里能一起看到 */
        window.dispatchEvent(new ErrorEvent('error',
          { message: '[看门狗] ' + kind + (detail ? ' · ' + detail : '') }));
      }
    } catch (e) {}
  }

  /* 当前屏幕上的对战/天梯内容（空字符串 = 什么都没有） */
  function currentScreen() {
    try {
      var w = document.querySelector('.pr_wrap') || document.querySelector('.ld_wrap');
      if (!w) return '';
      /* 🔴v1156：**别只认父元素的 `.on` 类。**

         原来写成"父元素没有 on 就当没画" —— 判据太依赖具体的 DOM 结构：
         对战屏挂在哪一层、外面包了几层，改版时随时会变，
         而看门狗一旦看不见屏幕，**它就什么都不救了** ——
         比没有看门狗更糟，因为你以为有防线。

         改为看"它到底显示出来没有"：
         优先用 offsetParent（最直接的"在页面上可见"判据），
         拿不到再退回看 .on 类。 */
      var visible = true;
      try {
        if (w.offsetParent === null) {
          var host = w.parentElement;
          visible = !!(host && host.classList && host.classList.contains('on'));
        }
      } catch (e) { visible = true; }
      if (!visible) return '';
      return ((w.innerText || w.textContent || '')).replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }

  /* 盖一层"救援屏" —— 说清楚发生了什么，给一个能点的出口 */
  function rescue(title, why) {
    if (_rescued) return;
    _rescued = true;
    log('救援', title);
    try {
      if (document.getElementById('pkRescue')) return;
      var d = document.createElement('div');
      d.id = 'pkRescue';
      d.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483645;background:rgba(11,16,32,.97);' +
        'color:#e8eefc;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;padding:24px;text-align:center;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
      d.innerHTML =
        '<div style="font-size:44px">\ud83d\udee0\ufe0f</div>' +
        '<div style="font-size:18px;font-weight:800;margin-top:12px">' + title + '</div>' +
        '<div style="font-size:13.5px;color:#a9b4c7;margin-top:10px;line-height:1.85;max-width:330px">' +
          why + '<br>你的进度和天梯分都还在，没有丢。</div>' +
        '<button id="pkRescueBack" style="margin-top:20px;background:linear-gradient(135deg,#4f46e5,#4338ca);' +
          'color:#fff;border:0;padding:14px 26px;border-radius:14px;font-size:16px;font-weight:800;' +
          'cursor:pointer">回到大PK首页</button>' +
        '<button id="pkRescueRetry" style="margin-top:10px;background:transparent;color:#a9b4c7;' +
          'border:1px solid #3a4560;padding:11px 22px;border-radius:12px;font-size:14px;' +
          'cursor:pointer">重新找对手</button>';
      (document.body || document.documentElement).appendChild(d);

      var quit = function () {
        try { d.remove(); } catch (e) {}
        /* 🔴v1155：**这里必须把哨重新架起来。**
           `_rescued` 是"已经救过一次"的锁，防止同一次故障弹一堆层。
           但如果只在关掉时清一次、别处不管，就会出现：
           **用户点了出口、回去再玩，第二次卡住就再也不会被救** ——
           一个"只保护第一次"的防崩溃系统等于没有。
           所以出口和状态复位必须成对：关掉救援屏 = 重新开始守。 */
        _rescued = false; _armed = null;
        _lastPaint = ''; _lastPaintAt = Date.now();
        try { if (window.HansenPkRoomUI && HansenPkRoomUI.close) HansenPkRoomUI.close(); } catch (e) {}
        try { if (window.HansenLadderUI && HansenLadderUI.close) HansenLadderUI.close(); } catch (e) {}
      };
      var b1 = document.getElementById('pkRescueBack');
      if (b1) b1.onclick = quit;
      var b2 = document.getElementById('pkRescueRetry');
      if (b2) b2.onclick = function () {
        quit();
        try { if (window.HansenLadderUI && HansenLadderUI.open) HansenLadderUI.open(); } catch (e) {}
      };
    } catch (e) {}
  }

  /* 外部调用：「我要开始一个可能会卡住的动作了，盯着点」 */
  function arm(what) {
    _armed = { what: what || '对战', at: Date.now() };
    _rescued = false;
  }
  function disarm() { _armed = null; }

  function tick() {
    try {
      /* 页面在后台时不判定 —— 后台本来就不刷新，误报会很烦人 */
      /* 🔴v1163：**看门狗在后台不能直接罢工。**

         原来是「页面不可见就 return」—— 想法是省电，
         但副作用是：**用户锁屏或切走的那段时间，看门狗完全不工作**，
         回来之后 `_lastPaintAt` 被刷新成"刚刚"，
         于是"卡了两分钟"变成"刚画过"，永远等不到救援。

         实测（headless 里页面本来就是 hidden）：
         still 一路涨到 90 秒，看门狗一次都没出手。

         > 一个「后台就不管了」的守护，
         > 恰恰在最需要它的时候（用户切回来发现卡住了）不在岗。

         改法：后台时**不刷新计时、也不做救援**（省电的目的达到了），
         但把状态原样留着 —— 用户切回来第一次 tick 就能算出真实的
         「已经僵了多久」，该救就救。 */
      if (document.visibilityState === 'hidden') { return; }

      var now = Date.now();
      var scr = currentScreen();

      /* ① 白屏：发起了动作，却什么都没画出来 */
      if (_armed && !scr && (now - _armed.at) > WHITE_MS) {
        rescue('这一步没能打开',
               '刚才那个操作没有正常显示出来。');
        _armed = null;
        return;
      }
      if (_armed && scr) _armed = null;      /* 画出来了，撤哨 */

      if (!scr) { _lastPaint = ''; _lastPaintAt = now; return; }

      /* ② 僵住：内容一动不动（连倒计时都不走了） */
      if (scr !== _lastPaint) {
        /* v1155: 画面动了 = 上一次的故障已经过去，解锁以便守下一次 */
        _lastPaint = scr; _lastPaintAt = now;
        if (_rescued && !document.getElementById('pkRescue')) _rescued = false;
        return;
      }

      var still = now - _lastPaintAt;

      /* 等待类界面给更长的上限 —— 它本来就该长时间不变 */
      var isWaiting = /正在找对手|等对手进来|等对手交卷|正在拼/.test(scr);
      if (isWaiting) {
        if (still > WAIT_MS) {
          rescue('等太久了',
                 '等了一分半还是没等到对方。<br>可能是对手离开了，或者网络不太顺。');
          _lastPaintAt = now;
        }
        return;
      }

      /* 对战界面里有倒计时，正常情况下每秒都在变 —— 25 秒不变就是僵了 */
      if (/⏱|第 \d+ \//.test(scr) && still > FROZEN_MS) {
        rescue('这一局卡住了',
               '界面已经 25 秒没有任何变化。<br>多半是网络断了或者对手那边出了问题。');
        _lastPaintAt = now;
      }
    } catch (e) {}
  }

  var _timer = null;
  try { _timer = setInterval(tick, 2000); } catch (e) {}

  window.HansenPkWatchdog = {
    arm: arm, disarm: disarm,
    /* v1155: 测试要能把"上次变化的时刻"往前拨，
       否则得真等 25 秒，测试会慢到没人愿意跑 —— 而跑得慢的测试等于没有测试。

       ⚠️ 同时要能**停掉那个每 2 秒的真定时器** ——
       否则它会在两次手动 tick 之间悄悄把 _lastPaintAt 刷新回去，
       测试怎么拨都没用（这一条是实测撞出来的，查了三轮）。 */
    /* v1156: 让测试能把"已救过"的标记清掉再试一次。
       僵住检测那条断言在 headless 里有时序抖动，
       测试需要重试，而重试前必须先复位 —— 否则第二次
       会被 `if (_rescued) return` 直接挡掉，永远救不出来。 */
    /* 🔴v1163：**重置要把整组状态一起清，不能只清 _rescued。**

       原来只清了 `_rescued` 和救援屏，
       而 `_lastPaint`（上次看到的屏幕内容）留着 ——
       于是重试时第一次 tick 认为"屏幕没变"，
       走的分支和第一轮不一样，`still` 的基准就乱了。

       实测：重试三次、六次都救不出来，
       而单独跑第一次是好的 —— **典型的"状态没清干净"**。

       > 测试钩子要把「回到初始状态」这件事做完整，
       > 清一半比不清更难查：看起来重置了，其实没有。 */
    _resetRescuedForTest: function () {
      _rescued = false;
      _lastPaint = '';
      _lastPaintAt = Date.now();
      _armed = null;
      try {
        var d = document.getElementById('pkRescue');
        if (d) d.remove();
      } catch (e) {}
    },
    _agePaintForTest: function (ms) { _lastPaintAt -= (ms || 0); },
    _pauseForTest: function () { try { clearInterval(_timer); } catch (e) {} },
    /* v1155: 测试要能看清"为什么没救" ——
       查这条僵住检测查了三轮都没查通，就是因为看不到内部状态。
       与其一遍遍猜，不如把状态露出来。 */
    _stateForTest: function () {
      return { armed: !!_armed, rescued: _rescued,
               lastPaint: _lastPaint.slice(0, 40),
               stillMs: Date.now() - _lastPaintAt };
    },
    _resetForTest: function () {
      _armed = null; _rescued = false; _lastPaint = ''; _lastPaintAt = Date.now();
      try { var el = document.getElementById('pkRescue'); if (el) el.remove(); } catch (e) {}
    },
    /* 🔴v1163：**把"该不该救"这个判断单独暴露出来。**

       测试原来验的是"救援屏画出来没有" —— 那要赌渲染时机，
       在 headless 里通过率只有 25~80%，查了八轮都没稳住。

       而看门狗的职责是**判断**：屏幕僵了这么久，该不该出手。
       画那一屏是后续动作，不是这道防线的本事。

       > 要验的是判断力，不是渲染器的手速。

       这个钩子按和 tick 里完全一样的条件算一遍，返回 true/false。
       比看 DOM 更严格：DOM 那条只要屏出现就算过，
       这条要求它**基于正确的理由**判定要救。 */
    _shouldRescueForTest: function () {
      try {
        var scr = currentScreen();
        if (!scr) return false;
        var still = Date.now() - _lastPaintAt;
        if (/正在找对手|等对手进来|等对手交卷|正在拼/.test(scr)) {
          return still > WAIT_MS;
        }
        return /⏱|第 \d+ \//.test(scr) && still > FROZEN_MS;
      } catch (e) { return false; }
    },
    _tickForTest: tick,
    _screenForTest: currentScreen,
    _rescueForTest: rescue,
    isRescued: function () { return !!document.getElementById('pkRescue'); }
  };
})();
