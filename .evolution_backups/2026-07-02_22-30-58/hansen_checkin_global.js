/* ============================================================
   hansen_checkin_global.js  —  全局「每日签到」(修复"每个岛各领一次金币"的重大 bug)
   ------------------------------------------------------------
   【bug 背景】
     金币是全局钱包(hansen_coin_wallet.js, 所有岛共享一个余额 hansen_wallet_coins)。
     但原版"今天是否已领签到"的标记 S.chestDay、以及"连续签到"S.streak,
     都是各岛各自存在自己的存档里(wordIslandAnimal / wordIslandFood / ...)。
     于是每个岛都"以为自己今天还没领", 各发一次每日签到, 而币都进同一个总钱包
     → 总金币 = 各岛签到之和(打开 N 个岛就领 N 次)。这显然是 bug —— 每天只该领一次。

   【本文件做什么】(零侵入: 不改各岛 inline 玩法逻辑, 只在末尾包装三个全局函数)
     把"今天已领"和"连续签到"都全局化, 与全局钱包同级:
       · hansen_checkin_last        上次领签到的日期(全局)→ 任意岛领过, 全局锁定当天
       · hansen_checkin_streak      全局连续签到天数(全游戏一份, 不再各岛各算)
       · hansen_checkin_streak_day  连签最后推进的日期
     - 包装 doOpenChest: 全局当天已领 → 任何岛都不再发币; 没领 → 原版正常发, 发完标记全局已领。
       (一天只发一次, 跨岛/连点都防住, 因为标记是同步写入的。)
     - 包装 openChest: 全局当天已领 → 直接显示"今天已领, 明天再来"; 否则正常。
     - 进岛时推进全局连签(一天一次), 并把 S.streak 覆盖成全局值(显示 + 宝箱 bonus 都读它)。
   ============================================================ */
(function () {
  'use strict';

  var LAST_KEY   = 'hansen_checkin_last';        // 上次领签到日期(全局, 与各岛 today() 同格式 YYYY-M-D)
  var STREAK_KEY = 'hansen_checkin_streak';      // 全局连续签到天数
  var SDAY_KEY   = 'hansen_checkin_streak_day';  // 连签最后推进的日期(全局)

  // 与各岛 today() 完全一致的日期串: getFullYear()-'(month+1)'-getDate()
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function todayStr() { return ymd(new Date()); }
  function yestStr() { var d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); }
  function gi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function si(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function getStreak() { var n = parseInt(gi(STREAK_KEY) || '0', 10); return (isFinite(n) && n > 0) ? n : 0; }
  function claimedToday() { return gi(LAST_KEY) === todayStr(); }

  // 全局连签推进: 每个自然日"第一次打开任意岛"时调用, 一天只推进一次, 跨岛不重复。
  function touchLogin() {
    var t = todayStr();
    if (gi(SDAY_KEY) === t) return getStreak();      // 今天已推进过
    var s = getStreak();
    if (gi(SDAY_KEY) === yestStr()) s = s + 1;        // 昨天有 → 连签 +1
    else s = 1;                                       // 断签 / 首次 → 从 1 开始
    si(STREAK_KEY, String(s)); si(SDAY_KEY, t);
    return s;
  }

  // 领取当天签到: 标记全局已领(一天只算一次)。
  function markClaimed() { si(LAST_KEY, todayStr()); }

  window.HansenCheckin = {
    claimedToday: claimedToday,
    getStreak: getStreak,
    touchLogin: touchLogin,
    markClaimed: markClaimed
  };

  // 把全局连签同步到本岛 S.streak —— 各岛的"连续签到 N 天"显示 & 宝箱奖励 bonus 都读 S.streak,
  // 覆盖成全局值后, 显示和奖励倍率就统一用全游戏一份的连签。
  function syncStreakToS() { try { if (window.S) window.S.streak = getStreak(); } catch (e) {} }

  // 全局 ↔ 本岛 chestDay 双向同步(不依赖包装器, 靠各岛 inline 闸门兜底, 彻底防跨岛刷币):
  //   · 全局今天已领 → 把本岛 S.chestDay 也设成今天。各岛 inline 的 openChest()/doOpenChest()
  //     里本来就有 `if(S.chestDay===today())` 闸门(始终运行, 不依赖任何包装), 于是直接显示
  //     "今天已领"且 doOpenChest 直接 return, 一分钱不发。
  //   · 本岛 inline 刚领过(S.chestDay===今天)但全局还没标 → 立即 markClaimed(), 把"今天已领"
  //     广播给其他岛。即使 doOpenChest 的包装器没生效/没装上(时机/旧部署), 也能把领取广播出去。
  function syncChestBothWays() {
    try {
      if (!window.S) return;
      var t = todayStr();
      if (claimedToday()) {
        if (window.S.chestDay !== t) window.S.chestDay = t;   // 全局已领 → 本岛 inline 闸门即生效
      } else if (window.S.chestDay === t) {
        markClaimed();                                        // 本岛已领 → 广播全局
      }
    } catch (e) {}
  }

  function install() {
    // ① 进岛: 推进全局连签(一天一次)+ 覆盖 S.streak + 同步 chestDay
    try { touchLogin(); } catch (e) {}
    syncStreakToS();
    syncChestBothWays();
    // 轻量定时双向同步(700ms, 仅 2 次 localStorage 读, 开销可忽略): 不论包装器是否/何时生效,
    // 都保证「全局已领 → 本岛锁住」与「本岛刚领 → 广播全局」始终一致, 彻底杜绝跨岛重复领。
    try { setInterval(function () { syncStreakToS(); syncChestBothWays(); }, 700); } catch (e) {}
    // S 在 DOMContentLoaded 时可能还没 ready, 早期多补几次同步。
    try { setTimeout(syncChestBothWays, 200); setTimeout(syncChestBothWays, 800); setTimeout(syncChestBothWays, 1600); } catch (e) {}

    // ② 包装 doOpenChest: 全局当天已领 → 不再发; 否则原版发奖, 发完标记全局已领
    if (typeof window.doOpenChest === 'function' && !window.doOpenChest.__hbuGlobal) {
      var _do = window.doOpenChest;
      window.doOpenChest = function () {
        if (claimedToday()) return;            // 全局今天已领 → 任何岛都不再发币(修复点)
        syncStreakToS();                       // 确保奖励 bonus 用全局连签
        var r = _do.apply(this, arguments);    // 原版: 发币(进全局钱包) + XP + UI(它内部会把本岛 S.chestDay 设为 today)
        markClaimed();                         // 同步写入全局"今天已领"(同步执行, 连点/跨岛都防住)
        return r;
      };
      window.doOpenChest.__hbuGlobal = true;
    }

    // ③ 包装 openChest: 全局当天已领 → 直接显示"今天已领"; 否则正常(先把连签同步成全局)
    if (typeof window.openChest === 'function' && !window.openChest.__hbuGlobal) {
      var _open = window.openChest;
      window.openChest = function () {
        syncStreakToS();
        if (claimedToday()) {
          // 🔴 v575: 全局已领 → 仍展示本岛完整打卡页(连续天数+倍率+详表), 由 renderCheckinPage 统一渲染。
          try {
            if (typeof showScreen === 'function') showScreen('chest');
            var c = document.getElementById('chestContent');
            if (c) {
              var __stk = getStreak();
              var __mult = (1 + Math.max(0, Math.min(__stk - 1, 6)) * 0.2).toFixed(1);
              if (typeof window.renderCheckinPage === 'function') {
                c.innerHTML = window.renderCheckinPage(__stk, __mult, true);
              } else {
                c.innerHTML =
                  '<div style="font-size:80px;margin:20px 0">📂</div>' +
                  '<div style="font-size:16px;color:#cbd5e1">今天的签到已经领过啦！<br>明天再来吧～</div>' +
                  '<div style="font-size:13px;color:#cbd5e1;margin-top:12px">连续打卡 <b style="color:#fbbf24">' + __stk + '</b> 天，越久奖励越丰厚！</div>';
              }
            }
          } catch (e) {}
          return;
        }
        return _open.apply(this, arguments);
      };
      window.openChest.__hbuGlobal = true;
    }
  }

  // 🔴v653 每日宝箱「开箱光芒绽放」动画: 宝箱亮度渐增(越来越亮)+金光绽放(光芒四射)+金币飞出, 衔接到奖励卡。
  // 全程仅用 缩放/位移/透明度/亮度滤镜/drop-shadow, 无旋转·无闪烁·无抖动(守防晕红线)。光晕与金币挂到 body 上, 不随内容刷新被截断。
  window.hansenChestFX = function (box) {
    try {
      if (!box) return;
      if (!document.getElementById('hsn-chestfx-css')) {
        var st = document.createElement('style'); st.id = 'hsn-chestfx-css';
        st.textContent =
          '@keyframes hsnChestGlow{0%{filter:brightness(1);transform:scale(1)}50%{filter:brightness(1.6) drop-shadow(0 0 24px rgba(255,216,90,.95));transform:scale(1.05)}100%{filter:brightness(2.7) drop-shadow(0 0 58px rgba(255,238,160,1));transform:scale(1.09)}}'
          + '.hsn-chest-opening{animation:hsnChestGlow .62s ease-in forwards;transform-origin:center center}'
          + '@keyframes hsnBloom{0%{transform:translate(-50%,-50%) scale(.32);opacity:0}45%{opacity:.96}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}'
          + '.hsn-bloom{position:fixed;width:230px;height:230px;border-radius:50%;pointer-events:none;z-index:9998;background:radial-gradient(circle,rgba(255,255,255,.98) 0%,rgba(255,230,130,.9) 26%,rgba(255,196,66,.45) 52%,rgba(255,196,66,0) 74%);animation:hsnBloom .74s ease-out forwards}'
          + '.hsn-coin{position:fixed;font-size:30px;line-height:1;pointer-events:none;z-index:10001;will-change:transform,opacity}';
        document.head.appendChild(st);
      }
      var r = box.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      box.classList.add('hsn-chest-opening');               // 宝箱越来越亮 + 轻微放大
      var bloom = document.createElement('div'); bloom.className = 'hsn-bloom';  // 金光绽放(光芒四射)
      bloom.style.left = (cx - 115) + 'px'; bloom.style.top = (cy - 115) + 'px';
      document.body.appendChild(bloom);
      setTimeout(function () { try { bloom.remove(); } catch (e) {} }, 820);
      var N = 13;                                            // 金币飞出
      for (var k = 0; k < N; k++) {
        (function (k) {
          var c = document.createElement('div'); c.className = 'hsn-coin'; c.textContent = '🪙';
          c.style.left = cx + 'px'; c.style.top = cy + 'px';
          var ang = (-Math.PI / 2) + (((k + .5) / N) - .5) * Math.PI * 1.5;   // 向上扇形喷射
          var dist = 95 + Math.random() * 120;
          var dx = Math.cos(ang) * dist;
          var dy = Math.sin(ang) * dist - (30 + Math.random() * 50);
          var delay = 120 + k * 24;
          document.body.appendChild(c);
          try {
            c.animate([
              { transform: 'translate(-50%,-50%) scale(.35)', opacity: 0, offset: 0 },
              { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: .16 },
              { transform: 'translate(calc(-50% + ' + dx.toFixed(0) + 'px),calc(-50% + ' + dy.toFixed(0) + 'px)) scale(1)', opacity: 1, offset: .68 },
              { transform: 'translate(calc(-50% + ' + dx.toFixed(0) + 'px),calc(-50% + ' + (dy + 80).toFixed(0) + 'px)) scale(.65)', opacity: 0, offset: 1 }
            ], { duration: 980, delay: delay, easing: 'cubic-bezier(.18,.7,.32,1)', fill: 'forwards' });
          } catch (e) {}
          setTimeout(function () { try { c.remove(); } catch (e) {} }, 1100 + delay);
        })(k);
      }
    } catch (e) {}
  };

  if (document.readyState !== 'loading') install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
})();
