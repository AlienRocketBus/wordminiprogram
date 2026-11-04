import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
old = "let bossHP=0,bossMaxHP=0,heroHP=0,heroMaxHP=100,bossPool=[],bossActive=false;\n"
new = old + """/* 🔴v1165 bossActive 是 let 变量，不会自己挂到 window 上。外面好几段保护写的是 window.bossActive
   （战斗中再切到 Boss 屏要保留战场、不重画选关；战斗中等特效引擎；战斗中隐藏底栏），以前读到的永远是 undefined，从来没生效。
   这里把 window.bossActive 接到同一个变量上（读写都是它）。 */
try{Object.defineProperty(window,'bossActive',{configurable:true,get:function(){return bossActive;},set:function(v){bossActive=!!v;}});}catch(e){}
"""
rep(BOTH, old, new)
commit()
