// hansen_round_bar.js —— 🔴v862 Boss大满贯进度器(Hansen: 在打Boss进入界面最下面·让孩子知道打到哪了差几关拿钻)
// #bossScreen 里注入固定卡片; showScreen('boss')时刷新; 打赢/领奖后自动 refresh。
// 数据源=HansenRoundReward全套API; 无侵入·独立文件。
(function(){
  'use strict';
  var BAR_ID = 'hsnRoundBar';
  var CSS_ID = 'hsnRoundBarCss';
  function injectCss(){
    if(document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID;
    st.textContent = ''
      + 'body.hsn-boss-battle #'+BAR_ID+'{display:none!important}\n' /* 🔴v862修补: 战斗态隐藏进度器·防spellFill/spellPick超屏(H阶段炸过) */
      + '#'+BAR_ID+'{margin:14px 12px 18px;padding:12px 14px;border-radius:14px;'
      +   'background:linear-gradient(135deg,rgba(30,58,138,.68),rgba(15,23,42,.82));'
      +   'border:1.5px solid rgba(196,181,253,.35);color:#e2e8f0;font-size:13px;line-height:1.55}'
      + '#'+BAR_ID+' .rb-hd{display:flex;align-items:center;gap:8px;font-weight:800;color:#fbbf24;font-size:14px;margin-bottom:8px}'
      + '#'+BAR_ID+' .rb-hd .rb-round{color:#c4b5fd;font-size:12px;font-weight:600;margin-left:auto}'
      + '#'+BAR_ID+' .rb-track{height:10px;border-radius:5px;background:rgba(15,23,42,.6);overflow:hidden;position:relative;margin:8px 0 6px}'
      + '#'+BAR_ID+' .rb-fill{height:100%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:5px;transition:width .35s}'
      + '#'+BAR_ID+' .rb-nums{font-size:12px;color:#93c5fd;text-align:right;margin-bottom:6px}'
      + '#'+BAR_ID+' .rb-tip{font-size:12.5px;color:#cbd5e1}'
      + '#'+BAR_ID+' .rb-paid{background:linear-gradient(135deg,rgba(220,38,38,.35),rgba(153,27,27,.5));border-color:rgba(252,165,165,.35)}'
      + '#'+BAR_ID+' .rb-remain{color:#fde047;font-weight:700}';
    (document.head||document.documentElement).appendChild(st);
  }
  function ensureBar(){
    var scr = document.getElementById('bossScreen');
    if(!scr || document.getElementById(BAR_ID)) return;
    injectCss();
    var d = document.createElement('div'); d.id = BAR_ID;
    scr.appendChild(d);
    render();
  }
  function render(){
    var d = document.getElementById(BAR_ID);
    if(!d || !window.HansenRoundReward) return;
    var R = window.HansenRoundReward;
    var cleared = R.progress(), remain = R.remain(), round = R.count(), total = R.total();
    var isSeason = R.isSeason(), amt = R.gemAmount(), paid = R.gemPaidToday();
    var pct = Math.round(cleared.length / total * 100);
    var islandTag = isSeason ? '⭐ 星海' : '本岛';
    var head = '🏆 Boss 大满贯 <span class="rb-round">第 ' + (round + 1) + ' 轮</span>';
    var nums = '<span class="rb-remain">' + cleared.length + '</span> / ' + total + ' 关';
    var tip;
    if(cleared.length >= total){
      tip = paid
        ? '<span style="color:#fca5a5">💎 今日 ' + islandTag + ' 钻石已领·明日再战</span>'
        : '<span style="color:#c4b5fd">👑 全部打通!下次胜利结算 +' + amt + '💎</span>';
    } else if(paid){
      tip = '<span style="color:#fca5a5">💎 今日 ' + islandTag + ' 钻石已领·再打通 ' + remain.length + ' 关也不再给钻(明日重置)</span>'
          + '<div style="margin-top:4px;color:#94a3b8;font-size:11.5px">下次通关仍拿 🪙 300 + ⚡ 加速 120 分钟</div>';
    } else {
      var showR = remain.slice(0, 8).map(function(n){return 'Lv' + n;}).join(' · ');
      var more = remain.length > 8 ? ' · +' + (remain.length - 8) : '';
      tip = '还差 <b class="rb-remain">' + remain.length + '</b> 关拿 <b style="color:#e9d5ff">+' + amt + '💎</b><br>'
          + '<span style="color:#94a3b8;font-size:11.5px">需要打赢: ' + showR + more + '</span>';
    }
    d.className = paid ? 'rb-paid' : '';
    d.innerHTML =
        '<div class="rb-hd">' + head + '</div>'
      + '<div class="rb-nums">' + nums + '</div>'
      + '<div class="rb-track"><div class="rb-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="rb-tip">' + tip + '</div>';
  }
  window.HansenRoundBar = { refresh: render, ensure: ensureBar };
  // 打开#bossScreen时 ensure + render
  var t = setInterval(function(){
    if(typeof window.showScreen === 'function' && !window.showScreen.__hrbWrapped){
      var orig = window.showScreen;
      window.showScreen = function(name){
        var r = orig.apply(this, arguments);
        try{ if(name === 'boss'){ ensureBar(); render(); } }catch(e){}
        return r;
      };
      window.showScreen.__hrbWrapped = true;
      clearInterval(t);
    }
  }, 250);
  setTimeout(function(){ clearInterval(t); }, 15000);
  if(document.readyState !== 'loading'){ setTimeout(function(){ ensureBar(); render(); }, 400); }
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ ensureBar(); render(); }, 400); });
})();
