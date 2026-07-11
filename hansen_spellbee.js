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

  function lockScroll(on){
    try{ document.body.style.overflow = on ? 'hidden' : ''; }catch(e){}
  }

  function onPop(){
    /* 硬件/手势返回 → 关覆盖层。此时 pushState 压的那条已被浏览器弹出, 不再额外 history.back。 */
    doClose(true);
  }

  function doClose(fromPop){
    var ov = document.getElementById(OV_ID);
    if(!ov) return;
    /* 🔴BUG#98(Hansen): spelling bee 里点"返回"(以及硬件/手势返回键)听不到点击音。
       根因: "返回"=关覆盖层=移除本覆盖层 iframe → 浏览器随之销毁 iframe 文档及其【音频上下文】;
       而 spelling bee 内部的点击音(BUG#96)是在 iframe 自己的音频上下文里播的, iframe 一销毁上下文就被掐断,
       声音还没输出就没了 → 返回键没声音(其他键不关 iframe·故照常有声)。
       修复: 关覆盖层时改由【岛(父页)】的 playNavClick 播音 —— 移除的只是覆盖层 iframe, 岛文档及其音频上下文
       原封不动地存活, 声音照常播完。doClose 是唯一关闭路径 → 一处即覆盖"返回按钮 + 硬件返回键"两条路径;
       hansen_spellbee.js 是共享模块 → 19 岛全生效。play 是 fire-and-forget, 不挡关闭/返回。 */
    try{ if(typeof window.playNavClick === 'function') window.playNavClick(); }catch(e){}
    /* 移除覆盖层(含 iframe)= 浏览器自动销毁 iframe 文档 → 里面所有定时器/音频/keydown 监听全部清掉, 零泄漏 */
    if(ov.parentNode) ov.parentNode.removeChild(ov);
    lockScroll(false);
    window.removeEventListener('popstate', onPop);
    if(!fromPop){
      /* 由游戏内"返回"按钮触发: 把 open 时压的那条历史弹掉, 保持历史栈干净(配合 BUG#83 思路) */
      try{ history.back(); }catch(e){}
    }
  }

  window.HansenSpellBee = {
    /* islandKey: 当前岛 key(如 'animal'), 用于 spelling_bee 只考本岛单词 */
    open: function(islandKey){
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
      ifr.src = 'spelling_bee.html?v=919&island=' + encodeURIComponent(islandKey || '') + '&embed=1';
      ifr.style.cssText = 'display:block;width:100%;height:100%;border:0;margin:0;padding:0;background:#0a0f24;';
      ifr.setAttribute('allow', 'autoplay');
      ifr.setAttribute('scrolling', 'no');
      ov.appendChild(ifr);
      document.body.appendChild(ov);
      lockScroll(true);
      /* 硬件/手势返回键 → 关覆盖层(而不是离开岛) */
      try{ history.pushState({ hsnSb: 1 }, ''); }catch(e){}
      window.addEventListener('popstate', onPop);
    },
    close: function(){ doClose(false); }
  };

  /* 拼写对战奖励(Hansen v724): spelling_bee.html(隔离 iframe)每答对一词会 postMessage 上来,
     由岛(父页)把【金币 + 宠物经验】并入系统 —— 直接复用岛自己的 addCoin / addXP, 与平时岛上答题
     走的是同一条路: 金币进全局钱包(hansen_wallet_coins·顶栏自动刷新), 经验进本岛存档 S.xp(→宠物 globalXP 升级)。
     监听只在模块加载时挂一次; 类型校验 + 数值取整防脏数据; iframe 销毁后此监听仍在岛上(无泄漏·无影响)。 */
  window.addEventListener('message', function(e){
    var d = e && e.data;
    if(d && d.type === 'hsn_sb_mastery'){
      // 🔴v861 拼对=真答对: 走官方通道计熟练度(星/结晶/任务/答题金全联动)
      try{ if(typeof window.hansenMarkWordCorrectByEn==='function') window.hansenMarkWordCorrectByEn(d.word); }catch(e){}
      // 🔴v862 Bee钻石里程碑(5/10/20新词→1/3/8💎累计封顶): 走独立防刷模块
      try{ if(window.HansenSpellbeeGems && HansenSpellbeeGems.record) HansenSpellbeeGems.record(d.word); }catch(e){}
      return;
    }
    if(!d || d.type !== 'hsn_sb_reward') return;
    try{
      var c = Math.max(0, Math.floor(+d.coins || 0));
      var x = Math.max(0, Math.floor(+d.xp || 0));
      if(c > 0){
        if(typeof window.addCoin === 'function') window.addCoin(c);          // 岛版已并全局钱包 + 顶栏 + 存档
        else if(window.HansenCoins) window.HansenCoins.add(c);               // 兜底
      }
      if(x > 0){
        if(typeof window.addXP === 'function') window.addXP(x);              // 与平时答对加经验完全同一路径(→宠物)
        else if(window.S){ S.xp = (+S.xp || 0) + x; if(typeof window.save === 'function') save(); }
      }
    }catch(err){}
  });
})();
