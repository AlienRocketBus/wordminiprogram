import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
# ① F046 addXP 以全局钱包里的经验为底（别的页面刚加的经验不会被本页的旧数字盖掉）
rep(BOTH, "  var beforeChar=Math.max(0,Math.floor(Number(S.charXP)||0)),targetChar=Math.min(1000000000,beforeChar+n);\n",
          "  var beforeChar=Math.max(0,Math.floor(Number(S.charXP)||0));\n"
          "  /* 🔴v1165 以全局钱包里的人物经验为准：另一个岛/页面刚加过的经验，不能被本页开岛时读到的旧数字盖掉 */\n"
          "  try{var __wcx=localStorage.getItem('hansen_wallet_charxp');if(__wcx!==null&&/^\\d{1,10}$/.test(__wcx)){var __wn=Number(__wcx);if(isFinite(__wn)&&__wn>=0&&__wn<=1000000000)beforeChar=__wn;}}catch(e){}\n"
          "  var targetChar=Math.min(1000000000,beforeChar+n);\n")
# ② F074 满级：顶栏写「已满级 MAX」，不再是「100/0 XP」
rep(BOTH, "document.getElementById('xpText').textContent=getXpInCurrentLevel();\ndocument.getElementById('xpMax').textContent=getXpForNextLevel();\n",
          "/* 🔴v1165 满级（Lv.30）以后没有「下一级」：写「已满级 MAX」，不再显示「100/0 XP」 */\n"
          "(function(){var xt=document.getElementById('xpText'),box=xt&&xt.parentNode;if(!box)return;var full=!getNextAdvLevel();\n"
          "if(full){if(box.getAttribute('data-max')!=='1'){box.setAttribute('data-max','1');box.innerHTML='<span id=\"xpText\">已满级</span> <b id=\"xpMax\">MAX</b>';}return;}\n"
          "if(box.getAttribute('data-max')==='1'){box.removeAttribute('data-max');box.innerHTML='<span id=\"xpText\">0</span>/<span id=\"xpMax\">100</span> XP';}\n"
          "document.getElementById('xpText').textContent=getXpInCurrentLevel();document.getElementById('xpMax').textContent=getXpForNextLevel();})();\n")
# ③ F045 别的页面改了金币/钻石/经验/每日任务，这一页顶栏跟着变
old = "window.addEventListener('storage', function(e){\n  if(e.key === 'theme') applyTheme(e.newValue || 'cosmos');\n});\n"
new = old + """/* 🔴v1165 别的页面（另一个岛、首页、星海）改了金币 / 钻石 / 人物经验 / 每日任务，这一页的顶栏也跟着变
   （以前只同步主题：在别处领了奖、升了级，回到这个岛顶栏还是旧数字）。连着来的几下合成一次刷新。 */
(function(){
  var KEYS={hansen_wallet_coins:1,hansen_wallet_gems:1,hansen_wallet_charxp:1,hansen_global_daily_quests_v941:1};
  var t=null;
  function sync(){
    t=null;
    try{var raw=localStorage.getItem('hansen_wallet_charxp');if(raw!==null&&/^\\d{1,10}$/.test(raw)){var n=Number(raw);if(isFinite(n)&&n>=0&&n<=1000000000&&n!==S.charXP){S.charXP=n;S.level=getAdvLevel().lv;S.xp=getXpInCurrentLevel();}}}catch(e){}
    try{if(window.HansenQuestGlobal&&typeof HansenQuestGlobal.ensure==='function')HansenQuestGlobal.ensure();}catch(e){}
    try{updateTopBar();}catch(e){}
    try{var g=document.getElementById('__hs_gem_count');if(g&&window.HansenGems)g.textContent=HansenGems.get();}catch(e){}
    try{var qs=document.getElementById('questsScreen');if(qs&&qs.classList.contains('active')&&typeof renderQuests==='function')renderQuests();}catch(e){}
  }
  window.addEventListener('storage',function(e){if(!e||!e.key||!KEYS[e.key])return;if(t)clearTimeout(t);t=setTimeout(sync,120);});
})();
"""
rep(BOTH, old, new)
commit()
