import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
# ① 通用：每个小游戏「这一局」的编号 + 只认自己那一局的延时回调
anchor = "function showToast(msg){floatText(window.innerWidth/2,window.innerHeight/2-60,msg,'#fbbf24')}"
rep(BOTH, anchor, anchor + """
/* 🔴v1165 小游戏「这一局」的编号：开局、换难度、停下时都 +1。延时出下一题的回调只认自己那一局——
   编号变了、或者游戏屏已经不在前台，就什么都不做。以前打字大师答完马上返回，0.9 秒后又锁住屏幕、在主页读词；
   换难度后新一局的第一题被旧局的「下一题」顶掉；字母拼拼乐离开后还在主页读词。 */
var __hsnRuns={};
function __hsnRunNew(g){__hsnRuns[g]=(__hsnRuns[g]||0)+1;return __hsnRuns[g];}
function __hsnLater(g,scr,fn){var tok=__hsnRuns[g]||0;return function(){if((__hsnRuns[g]||0)!==tok)return;if(scr){var el=document.getElementById(scr);if(!el||!el.classList.contains('active'))return;}return fn.apply(this,arguments);};}""")

# ② 打字大师
rep(BOTH, "function startTyping(round){markMode('typing');showScreen('typing');typeActive=true;typeDone=0;",
          "function startTyping(round){markMode('typing');showScreen('typing');__hsnRunNew('type');typeActive=true;typeDone=0;")
rep(BOTH, "function showTypingMenu(){markMode('typing');showScreen('typing');typeActive=false;",
          "function showTypingMenu(){markMode('typing');showScreen('typing');__hsnRunNew('type');typeActive=false;")
rep(BOTH, "function stopTyping(){typeActive=false;stopTypeTimer();",
          "function stopTyping(){typeActive=false;__hsnRunNew('type');stopTypeTimer();")
rep(BOTH, "    typeIdx++;setTimeout(function(){typeActive=true;nextTypeQ();},900);",
          "    typeIdx++;setTimeout(__hsnLater('type','typingScreen',function(){typeActive=true;nextTypeQ();}),900);")
rep(BOTH, "var __missT=typePool[typeIdx];typeIdx++;__hmlLesson('typing',__missT,function(){typeActive=true;var c=document.getElementById('typeCompare');if(c)c.remove();nextTypeQ();},2200);",
          "var __missT=typePool[typeIdx];typeIdx++;__hmlLesson('typing',__missT,__hsnLater('type','typingScreen',function(){typeActive=true;var c=document.getElementById('typeCompare');if(c)c.remove();nextTypeQ();}),2200);")

# ③ 听音辨义
rep(BOTH, "function startListen(){\n  showScreen('listen');\n  listenActive=false;listenQ=null;",
          "function startListen(){\n  showScreen('listen');\n  listenActive=false;listenQ=null;__hsnRunNew('listen');")
rep(BOTH, "function stopListen(){listenActive=false}", "function stopListen(){listenActive=false;__hsnRunNew('listen')}")
rep(BOTH, "  listenLevel=level;\n  listenActive=true;listenRight=0;listenTotal=0;listenRound=1;__hmlStart('listen');",
          "  listenLevel=level;__hsnRunNew('listen');\n  listenActive=true;listenRight=0;listenTotal=0;listenRound=1;__hmlStart('listen');")
rep(BOTH, "setTimeout(()=>playListen(),300)}\nfunction playListen(r)",
          "setTimeout(__hsnLater('listen','listenScreen',function(){playListen()}),300)}\nfunction playListen(r)")
rep(BOTH, "setTimeout(function(){speak(w.en,1,function(){setTimeout(listenGoNext,800)})},400);\nsetTimeout(listenGoNext,5000)\n",
          "const __lgo=__hsnLater('listen','listenScreen',listenGoNext);\nsetTimeout(__hsnLater('listen','listenScreen',function(){speak(w.en,1,function(){setTimeout(__lgo,800)})}),400);\nsetTimeout(__lgo,5000)\n")
rep(BOTH, "__hmlLesson('listen',listenQ.idx,function(){\n  if(poolRemaining('listen_'+listenLevel)===0)__hmlRequeue",
          "__hmlLesson('listen',listenQ.idx,__hsnLater('listen','listenScreen',function(){\n  if(poolRemaining('listen_'+listenLevel)===0)__hmlRequeue")
rep(BOTH, "  nextListenQ();\n},1600)}}\n", "  nextListenQ();\n}),1600)}}\n")

# ④ 完形填空
rep(BOTH, "function startCloze(){\n  showScreen('cloze');clozeActive=false;clozeQ=null;",
          "function startCloze(){\n  showScreen('cloze');clozeActive=false;clozeQ=null;__hsnRunNew('cloze');")
rep(BOTH, "function stopCloze(){clozeActive=false}", "function stopCloze(){clozeActive=false;__hsnRunNew('cloze')}")
rep(BOTH, "  clozeLevel=level;clozeActive=true;clozeDone=0;__hmlStart('cloze');",
          "  clozeLevel=level;__hsnRunNew('cloze');clozeActive=true;clozeDone=0;__hmlStart('cloze');")
rep(BOTH, "try{speak(clozeQ.word.ex,1,function(){setTimeout(goNext,800)})}catch(e){goNext()}\n// 兜底: 8 秒强制切下一题 (例句最长 ~3 秒)\nsetTimeout(goNext,8000)",
          "const __cgo=__hsnLater('cloze','clozeScreen',goNext);\ntry{speak(clozeQ.word.ex,1,function(){setTimeout(__cgo,800)})}catch(e){__cgo()}\n// 兜底: 8 秒强制切下一题 (例句最长 ~3 秒)\nsetTimeout(__cgo,8000)")
rep(BOTH, "__hmlLesson('cloze',clozeQ.idx,nextClozeQ,1600,", "__hmlLesson('cloze',clozeQ.idx,__hsnLater('cloze','clozeScreen',nextClozeQ),1600,")

# ⑤ 泡泡
rep(BOTH, "function startBubble(){\n  // 入口: 难度选择\n  showScreen('bubble');\n  bubbleActive=false;",
          "function startBubble(){\n  // 入口: 难度选择\n  showScreen('bubble');\n  bubbleActive=false;__hsnRunNew('bubble');")
rep(BOTH, "  bubbleLevel=level;\n  bubbleActive=true;bubbleScore=0;",
          "  bubbleLevel=level;__hsnRunNew('bubble');\n  bubbleActive=true;bubbleScore=0;")
rep(BOTH, "function stopBubble(){\n  bubbleActive=false;", "function stopBubble(){\n  bubbleActive=false;__hsnRunNew('bubble');")
rep(BOTH, "  if(bubblePool.length===0&&!__hmlRequeue('bubble',bubblePool)){setTimeout(bubbleComplete,200);return}\n  setTimeout(nextBubble,200)\n}\n// 等大泡泡放大动画结束(0.6s)再读单词, 再缓冲 700ms 让小朋友看清楚\nsetTimeout(function(){speak(w.en,1,function(){setTimeout(bubbleGoNext,700)})},650);\n// 5 秒保险: 万一发音回调没触发, 也不会永远卡住\nsetTimeout(bubbleGoNext,5000);",
          "  if(bubblePool.length===0&&!__hmlRequeue('bubble',bubblePool)){setTimeout(__hsnLater('bubble','bubbleScreen',bubbleComplete),200);return}\n  setTimeout(__hsnLater('bubble','bubbleScreen',nextBubble),200)\n}\nconst __bgo=__hsnLater('bubble','bubbleScreen',bubbleGoNext);\n// 等大泡泡放大动画结束(0.6s)再读单词, 再缓冲 700ms 让小朋友看清楚\nsetTimeout(__hsnLater('bubble','bubbleScreen',function(){speak(w.en,1,function(){setTimeout(__bgo,700)})}),650);\n// 5 秒保险: 万一发音回调没触发, 也不会永远卡住\nsetTimeout(__bgo,5000);")
rep(BOTH, "if(bubbleLives>0){__hmlLesson('bubble',allW.indexOf(bubbleTarget),nextBubble,500);}",
          "if(bubbleLives>0){__hmlLesson('bubble',allW.indexOf(bubbleTarget),__hsnLater('bubble','bubbleScreen',nextBubble),500);}")
rep(BOTH, "    __hmlLesson('bubble',allW.indexOf(bubbleTarget),nextBubble,400); // 还有命→小课后跳下一题",
          "    __hmlLesson('bubble',allW.indexOf(bubbleTarget),__hsnLater('bubble','bubbleScreen',nextBubble),400); // 还有命→小课后跳下一题")

# ⑥ 字母拼拼乐：加 scrActive（以前没有「正在玩」的标记，离开后下一词照样出、照样读）
rep(BOTH, "let scrPool=[],scrIdx=0,scrWord=null,scrSlots=[],scrLevel='easy',scrTotal=0,scrCorrect=0;\n",
          "let scrPool=[],scrIdx=0,scrWord=null,scrSlots=[],scrLevel='easy',scrTotal=0,scrCorrect=0,scrActive=false;\n/* 🔴v1165 离开/换难度就停：下一词只在这一局、字母拼拼乐还在前台时出 */\nfunction stopScramble(){scrActive=false;__hsnRunNew('scr')}\n")
rep(BOTH, "function startScramble(){\n  // 入口: 难度选择\n  showScreen('scramble');\n",
          "function startScramble(){\n  // 入口: 难度选择\n  showScreen('scramble');stopScramble();\n")
rep(BOTH, "  scrTotal=scrPool.length;scrIdx=0;scrCorrect=0;__hmlStart('scramble');\n  nextScramble();",
          "  scrTotal=scrPool.length;scrIdx=0;scrCorrect=0;__hmlStart('scramble');\n  __hsnRunNew('scr');scrActive=true;\n  nextScramble();")
rep(BOTH, "function nextScramble(){\n  if(scrIdx>=scrPool.length&&!__hmlRequeue('scramble',scrPool)){scrComplete();return}",
          "function nextScramble(){\n  if(!scrActive)return;\n  if(scrIdx>=scrPool.length&&!__hmlRequeue('scramble',scrPool)){scrComplete();return}")
rep(BOTH, "scrIdx++;setTimeout(nextScramble,1200)}", "scrIdx++;setTimeout(__hsnLater('scr','scrambleScreen',nextScramble),1200)}")
rep(BOTH, "__hmlLesson('scramble',scrPool[scrIdx],clearScramble,1100)}}}", "__hmlLesson('scramble',scrPool[scrIdx],__hsnLater('scr','scrambleScreen',clearScramble),1100)}}}")
rep(BOTH, "var __skI=scrPool[scrIdx];scrIdx++;__hmlLesson('scramble',__skI,nextScramble,0)", "var __skI=scrPool[scrIdx];scrIdx++;__hmlLesson('scramble',__skI,__hsnLater('scr','scrambleScreen',nextScramble),0)")
rep(BOTH, "function scrComplete(){\n  const L=SCRAMBLE_LEVELS[scrLevel]||SCRAMBLE_LEVELS.easy;", "function scrComplete(){\n  scrActive=false;\n  const L=SCRAMBLE_LEVELS[scrLevel]||SCRAMBLE_LEVELS.easy;")
rep(BOTH, "if(id!=='eagle'&&typeof stopEagle==='function')stopEagle();\n",
          "if(id!=='eagle'&&typeof stopEagle==='function')stopEagle();\nif(id!=='scramble'&&typeof stopScramble==='function')stopScramble();\n")

# ⑦ 打地鼠
rep(BOTH, "  showScreen('moles');\n  molesActive=false;\n", "  showScreen('moles');\n  molesActive=false;__hsnRunNew('moles');\n")
rep(BOTH, "  molesLevel=level;\n  const L=MOLES_LEVELS[level];\n  molesActive=true;", "  molesLevel=level;__hsnRunNew('moles');\n  const L=MOLES_LEVELS[level];\n  molesActive=true;")
rep(BOTH, "  setTimeout(startMolesWave,500);\n}\n\nfunction stopMoles(){\n  molesActive=false;\n",
          "  setTimeout(__hsnLater('moles','molesScreen',startMolesWave),500);\n}\n\nfunction stopMoles(){\n  molesActive=false;__hsnRunNew('moles');\n")
rep(BOTH, "    setTimeout(startMolesWave,900);\n", "    setTimeout(__hsnLater('moles','molesScreen',startMolesWave),900);\n")
rep(BOTH, "if(molesLives>0){__hmlLesson('moles',allW.indexOf(molesTarget),startMolesWave,900);}",
          "if(molesLives>0){__hmlLesson('moles',allW.indexOf(molesTarget),__hsnLater('moles','molesScreen',startMolesWave),900);}")

# ⑧ 钓鱼
rep(BOTH, "  showScreen('fish');\n  fishActive=false;\n", "  showScreen('fish');\n  fishActive=false;__hsnRunNew('fish');\n")
rep(BOTH, "  fishLevel=level;\n  var L=FISH_LEVELS[level];\n  fishActive=true;", "  fishLevel=level;__hsnRunNew('fish');\n  var L=FISH_LEVELS[level];\n  fishActive=true;")
rep(BOTH, "function stopFish(){\n  fishActive=false;\n", "function stopFish(){\n  fishActive=false;__hsnRunNew('fish');\n")
rep(BOTH, "      setTimeout(pickFishTarget,400);\n", "      setTimeout(__hsnLater('fish','fishScreen',pickFishTarget),400);\n")
rep(BOTH, "if(fishLives>0){__hmlLesson('fish',allW.indexOf(fishTarget),pickFishTarget,500);}",
          "if(fishLives>0){__hmlLesson('fish',allW.indexOf(fishTarget),__hsnLater('fish','fishScreen',pickFishTarget),500);}")

# ⑨ 火眼金睛
rep(BOTH, "  showScreen('eagle');\n  eagleActive=false;\n", "  showScreen('eagle');\n  eagleActive=false;__hsnRunNew('eagle');\n")
rep(BOTH, "  eagleLevel=level;\n  eagleActive=true;", "  eagleLevel=level;__hsnRunNew('eagle');\n  eagleActive=true;")
rep(BOTH, "  setTimeout(eagleNextRound,400);\n}\n\nfunction stopEagle(){eagleActive=false;",
          "  setTimeout(__hsnLater('eagle','eagleScreen',eagleNextRound),400);\n}\n\nfunction stopEagle(){eagleActive=false;__hsnRunNew('eagle');")
rep(BOTH, "    setTimeout(eagleNextRound,800);\n", "    setTimeout(__hsnLater('eagle','eagleScreen',eagleNextRound),800);\n")
rep(BOTH, "__hmlLesson('eagle',allW.indexOf(eagleTarget),eagleNextRound,1400);", "__hmlLesson('eagle',allW.indexOf(eagleTarget),__hsnLater('eagle','eagleScreen',eagleNextRound),1400);", count=2)
commit()
