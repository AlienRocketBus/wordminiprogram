import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
runs_c = "/* 🔴v1165 小游戏「这一局」的编号：开局、换难度、停下时都 +1。延时出下一题的回调只认自己那一局——\n   编号变了、或者游戏屏已经不在前台，就什么都不做。以前打字大师答完马上返回，0.9 秒后又锁住屏幕、在主页读词；\n   换难度后新一局的第一题被旧局的「下一题」顶掉；字母拼拼乐离开后还在主页读词。 */\n"
shuf = "/* 🔴v1165 均匀洗牌（Fisher–Yates）。sort(()=>Math.random()-.5) 洗得很不匀：短词常常一出来就是正确顺序 */\nfunction __hsnShuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}\n"
rep(BOTH, runs_c + shuf + "var __hsnRuns={};", shuf + runs_c + "var __hsnRuns={};")
commit()
