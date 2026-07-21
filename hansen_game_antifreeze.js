/* ============================================================================
 * hansen_game_antifreeze.js — 小游戏防卡死看门狗 (🔴 BUG#63, v492)
 * ----------------------------------------------------------------------------
 * 背景: boss 已有 BUG#62 看门狗。但【打字/复习/钓鱼/打地鼠/泡泡/听音/完形】的"下一题/下一轮/刷目标"
 *   都靠 setTimeout 推进; 页面切后台被浏览器节流/丢弃这一发, 回来就【永久卡住不动】(同 boss BUG#62)。
 *   全部小游戏【0 个有"回前台自愈"】。本模块统一补这一层。全 19 岛函数同名 → 一个共享模块兜全部。
 *
 * 安全核心(绝不破坏正常游戏):
 *   · 只在【visibilitychange/pageshow → 回到前台】后触发, 过【宽限期】仍卡死才恢复。
 *     → 正常【连续】游戏期间(没切过后台)本看门狗【完全不动作】, 结构性杜绝"跳题/重复轮/破坏游戏"。
 *   · "有可操作元素(未答题/可点目标/可输入)" = 活, 一律不恢复(玩家慢慢想不会被打断)。
 *   · 宽限期按是否有自带兜底取值: 无兜底者 ~3s; 有 5~8s 兜底者 ~9s(让其自身兜底先跑, 不打架)。
 *   · 回前台只挂一发宽限定时器(去重), 恢复前【二次确认】仍卡死。
 *
 * 状态访问: 小游戏的 typeActive/bubbleActive/... 是岛内【顶层 let】(不在 window 上)。
 *   本模块通过显式白名单引用这些已知绑定，不动态执行任何字符串。
 *
 * 🔴 最高铁律: 每个模式必须 Playwright 真机【最苛刻条件】验证(能救活 + 绝不误伤)后, 才把 verified 置 true 生效。
 *   未验证的模式 verified:false → 看门狗【跳过不运行】→ 打包任何时候都安全(不会误伤)。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__hansenAntiFreezeV63) return;
  window.__hansenAntiFreezeV63 = true;

  function $(id) { return document.getElementById(id); }
  function scrActive(id) { var s = $(id); return !!(s && s.classList.contains('active')); }
  // 读已知全局(含顶层 let): 返回值或 undefined。
  function G(name) {
    try {
      switch(name){
        case 'typeActive': return typeof typeActive !== 'undefined' ? typeActive : window.typeActive;
        case 'fishActive': return typeof fishActive !== 'undefined' ? fishActive : window.fishActive;
        case 'fishOnscreen': return typeof fishOnscreen !== 'undefined' ? fishOnscreen : window.fishOnscreen;
        case 'bubbleActive': return typeof bubbleActive !== 'undefined' ? bubbleActive : window.bubbleActive;
        case 'listenActive': return typeof listenActive !== 'undefined' ? listenActive : window.listenActive;
        case 'listenQ': return typeof listenQ !== 'undefined' ? listenQ : window.listenQ;
        case 'clozeActive': return typeof clozeActive !== 'undefined' ? clozeActive : window.clozeActive;
        case 'molesActive': return typeof molesActive !== 'undefined' ? molesActive : window.molesActive;
        case 'reviewState': return typeof reviewState !== 'undefined' ? reviewState : window.reviewState;
      }
    } catch(e){}
    return window[name];
  }

  // ---- 各模式 ----  stuck(): "在玩但卡在已答/等下一轮、无可操作元素" → true。 verified: 是否已真机验证(false=不运行)。
  var MODES = [
    {
      name: 'typing', screen: 'typingScreen', grace: 3000, verified: true,
      // 打字: 答完 typeActive=false 等 900/2200ms 出下一词。卡死 = 屏active + typeActive===false + 还停在某个词(#typeSlots 在, 非菜单非结算)。
      // 判据无需猜类名: #typeSlots 仅在"某个词的作答页"出现(菜单/结算页都没有它); typeActive 经显式白名单读顶层 let。
      stuck: function () {
        if (!scrActive('typingScreen')) return false;
        if (G('typeActive') !== false) return false;     // true=玩家可打字(活); 仅 false=判定后等下一词
        if (!$('typeSlots')) return false;               // 无字母格 = 菜单/结算 → 不动
        return true;
      },
      recover: function () { try { if(typeof typeActive !== 'undefined') typeActive = true; if(typeof nextTypeQ === 'function') nextTypeQ(); } catch(e){} }
    },
    {
      name: 'fish', screen: 'fishScreen', grace: 3000, verified: true,
      // 钓鱼: spawnFishLoop 自循环刷鱼(setTimeout)。卡死 = 屏active + fishActive + 屏上没鱼可捞(fishOnscreen<=0)。
      // fishOnscreen 是顶层 let → 显式白名单读取; 池里无鱼=刷鱼定时器被后台丢了。结算/菜单时 fishActive=false → 不动。
      stuck: function () {
        if (!scrActive('fishScreen')) return false;
        if (G('fishActive') !== true) return false;
        var on = G('fishOnscreen');
        if (typeof on !== 'number') { var p = $('fishPond'); on = p ? p.children.length : 1; }
        return on <= 0;
      },
      recover: function () { try { if(typeof fishSpawnTimer !== 'undefined' && fishSpawnTimer){ clearTimeout(fishSpawnTimer); fishSpawnTimer = null; } if(typeof spawnFishLoop === 'function') spawnFishLoop(); } catch(e){} }
    },
    {
      name: 'bubble', screen: 'bubbleScreen', grace: 9000, verified: true,
      // 泡泡: 答对 setTimeout(...bubbleGoNext,700)+兜底5000。卡死 = 屏active + bubbleActive + 无可戳泡泡。
      // 可戳目标 = #bubbleScreen .bubble(实测渲染为 .bubble 元素), 戳掉置 data-done。宽限期 9s(>自带5s兜底, 不打架)。
      stuck: function () {
        if (!scrActive('bubbleScreen')) return false;
        if (G('bubbleActive') !== true) return false;
        return document.querySelectorAll('#bubbleScreen .bubble:not([data-done])').length === 0;
      },
      recover: function () { try { window.bubbleLocked=false; if(typeof nextBubble === 'function') nextBubble(); } catch(e){} }   // 直连渲染下一泡泡(GoNext带bubbleAdvanced闸·在卡死态会被挡; nextBubble无闸·实测必出新泡泡)
    },
    {
      name: 'listen', screen: 'listenScreen', grace: 9000, verified: true,
      // 听音: 选项渲染为 #listenScreen .boss-opt; 答完 listenQ.answered=true + setTimeout(...listenGoNext,800)+兜底5000。
      // 卡死 = 屏active + listenActive + 有选项 + listenQ.answered===true(已答仍停着)。"活"=有选项且未答。宽限期 9s。
      stuck: function () {
        if (!scrActive('listenScreen')) return false;
        if (G('listenActive') !== true) return false;
        var lq = G('listenQ'); if (!lq) return false;
        if (document.querySelectorAll('#listenScreen .boss-opt').length === 0) return false;
        return lq.answered === true;
      },
      recover: function () { try { if(typeof nextListenQ === 'function') nextListenQ(); } catch(e){} }   // 直连渲染下一题(GoNext带listenAdvanced闸会被挡; nextListenQ无闸·实测必出新题)
    },
    {
      name: 'cloze', screen: 'clozeScreen', grace: 9000, verified: true,
      // 完形: 选项 .cloze-opt; 答完 dataset.done='1' + setTimeout(goNext,800)+兜底8000。
      // 卡死 = 屏active + clozeActive + 有 .cloze-opt 但全部已答(无 :not([data-done]))。宽限期 9s(>自带8s兜底)。
      stuck: function () {
        if (!scrActive('clozeScreen')) return false;
        if (G('clozeActive') !== true) return false;
        if (document.querySelectorAll('#clozeScreen .cloze-opt').length === 0) return false;
        return document.querySelectorAll('#clozeScreen .cloze-opt:not([data-done])').length === 0;
      },
      recover: function () { try { if(typeof nextClozeQ === 'function') nextClozeQ(); } catch(e){} }   // 直连渲染下一题(goNext带advanced闸会被挡; nextClozeQ无闸·实测必出新题)
    },
    {
      name: 'moles', screen: 'molesScreen', grace: 3000, verified: true,
      // 打地鼠: 点对/点错后【锁全部坑】(BUG#42), 靠一发 setTimeout(startMolesWave,900) 出下一词【无兜底】。
      // 卡死 = 屏active + molesActive + 坑被锁(已点击等下一词)却超宽限没换词。"活"=坑未锁(可点目标·含reshuffle换位期仍可点)。
      stuck: function () {
        if (!scrActive('molesScreen')) return false;
        if (G('molesActive') !== true) return false;
        var slots = document.querySelectorAll('#molesScreen [id^="moleSlot"]');
        if (slots.length === 0) return false;
        for (var i = 0; i < slots.length; i++) { if (slots[i].dataset && slots[i].dataset.locked) return true; }
        return false;
      },
      recover: function () { try { if(typeof startMolesWave === 'function') startMolesWave(); } catch(e){} }   // 渲染下一词并清锁(无闸·实测)
    },
    {
      name: 'review', screen: 'reviewScreen', grace: 3000, verified: true,
      // 复习(易错词): 答完 reviewState.currentQ.answered=true, 一发 setTimeout(reviewState.idx++; reviewNext, 1200~2500ms)出下一张【无兜底】。
      // reviewState 是顶层 let·显式白名单可读。卡死 = 屏active + 在复习(currentQ存在·idx未到末) + currentQ已答却没推进。"活"=currentQ未答。
      stuck: function () {
        if (!scrActive('reviewScreen')) return false;
        var rs = G('reviewState'); if (!rs || !rs.currentQ) return false;
        if (rs.idx >= (rs.pool ? rs.pool.length : 0)) return false;   // 到末尾走完成页 → 不动
        return rs.currentQ.answered === true;
      },
      recover: function () { try { if(typeof reviewState !== 'undefined' && reviewState){ reviewState.idx++; if(typeof reviewNext === 'function') reviewNext(); } } catch(e){} }   // idx++ 再渲染下一张(无闸·实测)
    }
    // —— 7 个小游戏全部已真机最苛刻验证并启用: 打字/钓鱼/泡泡/听音/完形/打地鼠/复习 ——
  ];

  function activeMode() {
    for (var i = 0; i < MODES.length; i++) {
      if (!MODES[i].verified) continue;
      if (scrActive(MODES[i].screen)) return MODES[i];
    }
    return null;
  }

  var _pending = null;

  function onForeground() {
    var m = activeMode();
    if (!m || !m.stuck()) return;
    if (_pending) { clearTimeout(_pending); _pending = null; }
    _pending = setTimeout(function () {
      _pending = null;
      var mm = activeMode();
      if (!mm || mm.name !== m.name || !mm.stuck()) return;   // 切走了 / 宽限期内已自愈 → 不动
      try { console.warn('[Antifreeze] 🔴 BUG#63 小游戏看门狗: 【' + mm.name + '】回前台后卡死, 强制恢复'); } catch (e) {}
      try { mm.recover(); } catch (e) { try { console.warn('[Antifreeze] BUG#63 恢复失败(' + mm.name + '):', e); } catch (_e) {} }
    }, m.grace);
  }

  try {
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') onForeground(); });
    window.addEventListener('pageshow', function () { if (document.visibilityState !== 'hidden') onForeground(); });
  } catch (e) {}

  // 调试/贾维斯接口
  window.HansenAntiFreeze = {
    version: 'v511',
    activeMode: function () { var m = activeMode(); return m ? m.name : null; },
    isStuck: function () { var m = activeMode(); return !!(m && m.stuck()); },
    _kick: function () { onForeground(); },          // 测试用: 手动触发回前台检查
    _modes: MODES
  };
})();
