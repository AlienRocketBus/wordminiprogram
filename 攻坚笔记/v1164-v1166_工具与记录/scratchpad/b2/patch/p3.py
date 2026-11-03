# v1165 item 3: 答错小课 —— 同一组替换同时打到 template.html 与 land_template.html
import pathlib, sys
ROOT = pathlib.Path('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt')
R = []
def rep(old, new): R.append((old, new))

# ---------- 0. 模块装载 + 模板内小入口 ----------
rep('<script defer src="hansen_review.js?v=1163"></script>',
    '<script defer src="hansen_mistake_lesson_v1165.js?v=1163"></script><!-- v1165 答错小课：揭晓卡+重读/本轮末再考一次/结算列错词 -->\n<script defer src="hansen_review.js?v=1163"></script>')
rep("""try{checkAch();}catch(e){}}
/* 💰 答对1题给1金币。""",
"""try{checkAch();}catch(e){}}
/* 🔴v1165 答错小课的统一入口（hansen_mistake_lesson_v1165.js）。模块没加载就退回原来的定时推进，不会卡住。 */
function __hml(){return window.HansenMistakeLesson||null}
function __hmlStart(m){var M=__hml();if(M)M.start(m)}
function __hmlLesson(m,idx,next,ms){var M=__hml();if(M){M.miss(m,idx);M.lesson(idx,next)}else setTimeout(next,ms||1600)}
function __hmlRequeue(m,pool){var M=__hml();return !!(M&&M.requeue(m,pool))}
function __hmlRequeueLater(m,pool,idx,gap){var M=__hml();return !!(M&&M.requeueLater(m,pool,idx,gap))}
function __hmlIsRetry(m,idx){var M=__hml();return !!(M&&M.isRetry(m,idx))}
function __hmlAttach(m,el){var M=__hml();if(M)setTimeout(function(){M.attach(m,el)},0)}
function __hmlResult(m){var M=__hml();return M?M.resultHtml(m):''}
/* 💰 答对1题给1金币。""")

# ---------- 连胜中断文案：不说「被中断」 ----------
rep("""function showComboLost(c, reason){
  if(c < 2) return;
  var icon = reason === 'timeout' ? '⏰' : '💔';
  flashComboBadge(
    '<span class="combo-num">' + icon + ' ' + c + ' 连胜被中断</span>',""",
"""function showComboLost(c, reason){
  if(c < 2) return;
  /* 🔴v1165: 刚答错先安慰：不说「💔 连胜被中断」，告诉孩子刚才连对了几个 */
  var msg = reason === 'timeout' ? ('⏰ 歇一下 · 刚才连对 ' + c + ' 个') : ('🌱 刚才连对 ' + c + ' 个，真棒！');
  flashComboBadge(
    '<span class="combo-num">' + msg + '</span>',""")

# ---------- 听音辨义 ----------
rep("listenActive=true;listenRight=0;listenTotal=0;listenRound=1;\n",
    "listenActive=true;listenRight=0;listenTotal=0;listenRound=1;__hmlStart('listen');\n")
rep("if(opts.length===0||!opts[i])return;\nlistenTotal++;\n",
    "if(opts.length===0||!opts[i])return;\nconst __rtL=__hmlIsRetry('listen',listenQ.idx);/* v1165 本轮末再考的那题不算进得分/正确率 */\nif(!__rtL)listenTotal++;\n")
rep("opts[i].classList.add('correct');playCorrect();addXP(5);listenRight++;\nS.stats.listenRight++;progressQuest('listen',1);markAnswer(listenQ.idx,true);",
    "opts[i].classList.add('correct');playCorrect();if(!__rtL){addXP(5);listenRight++;\nS.stats.listenRight++;progressQuest('listen',1);}markAnswer(listenQ.idx,true);")
rep("  if(poolRemaining('listen_'+listenLevel)===0){ listenComplete(); return; }\n  nextListenQ();\n}}",
    "  if(poolRemaining('listen_'+listenLevel)===0 && !__hmlRequeue('listen',_shuffledPools['listen_'+listenLevel])){ listenComplete(); return; }\n  nextListenQ();\n}}")
rep("""playWrong();markAnswer(listenQ.idx,false);save();
setTimeout(function(){
  if(poolRemaining('listen_'+listenLevel)===0){ listenComplete(); return; }  /* 🔴 v595/BUG#69: 答错后本档听完也走结算页 */
  nextListenQ();
},1600)}}""",
"""playWrong();markAnswer(listenQ.idx,false);save();
/* 🔴v1165 答错小课：揭晓卡+重读(约2.5秒/点一下)；本档听完先把错词再考一次 */
__hmlLesson('listen',listenQ.idx,function(){
  if(poolRemaining('listen_'+listenLevel)===0 && !__hmlRequeue('listen',_shuffledPools['listen_'+listenLevel])){ listenComplete(); return; }  /* 🔴 v595/BUG#69: 答错后本档听完也走结算页 */
  nextListenQ();
},1600)}}""")
rep("  if(!listenActive) return;\n  listenActive=false;\n  var L=LISTEN_LEVELS[listenLevel];",
    "  if(!listenActive) return;\n  listenActive=false;__hmlAttach('listen','listenContent');\n  var L=LISTEN_LEVELS[listenLevel];")

# ---------- 完形填空 ----------
rep("clozeLevel=level;clozeActive=true;clozeDone=0;\n", "clozeLevel=level;clozeActive=true;clozeDone=0;__hmlStart('cloze');\n")
rep("if(clozePool.length===0){clozeComplete();return}\n// 找出下一个有效题目",
    "if(clozePool.length===0&&!__hmlRequeue('cloze',clozePool)){clozeComplete();return}\n// 找出下一个有效题目")
rep("playCorrect();addXP(L.xpPerQ);clozeDone++;S.stats.clozeRight++;progressQuest('cloze',1);markAnswer(clozeQ.idx,true);",
    "playCorrect();if(!__hmlIsRetry('cloze',clozeQ.idx)){addXP(L.xpPerQ);clozeDone++;S.stats.clozeRight++;progressQuest('cloze',1);}markAnswer(clozeQ.idx,true);")
rep("""playWrong();markAnswer(clozeQ.idx,false);save();
let wrongAdvanced=false;
function goNextWrong(){if(!wrongAdvanced){wrongAdvanced=true;nextClozeQ()}}
// 答错: 读整个例句 (本地 NaturalReader mp3, 教学价值高)
try{speak(clozeQ.word.ex,1,function(){setTimeout(goNextWrong,800)})}catch(e){goNextWrong()}
// 兜底: 8 秒强制切 (例句最长 ~3 秒)
setTimeout(goNextWrong,8000)}}""",
"""playWrong();markAnswer(clozeQ.idx,false);save();
/* 🔴v1165 答错小课：空格里已填好正确词，再出揭晓卡+读单词(约2.5秒/点一下) */
__hmlLesson('cloze',clozeQ.idx,nextClozeQ,1600)}}""")
rep("function clozeComplete(){\nclozeActive=false;\n", "function clozeComplete(){\nclozeActive=false;__hmlAttach('cloze','clozeContent');\n")

# ---------- 打地鼠 ----------
rep("molesActive=true;molesScore=0;molesLives=L.lives;molesTarget=null;molesHit=0;\n",
    "molesActive=true;molesScore=0;molesLives=L.lives;molesTarget=null;molesHit=0;__hmlStart('moles');\n")
rep("  if(molesPool.length===0){molesComplete();return}\n  const idx=molesPool.pop();",
    "  if(molesPool.length===0&&!__hmlRequeue('moles',molesPool)){molesComplete();return}\n  const idx=molesPool.pop();")
rep("  const L=MOLES_LEVELS[molesLevel]||MOLES_LEVELS.easy;\n  /* 🔴 BUG#42修复(v465):只锁单坑",
    "  const L=MOLES_LEVELS[molesLevel]||MOLES_LEVELS.easy;\n  const __rtM=__hmlIsRetry('moles',allW.indexOf(molesTarget));/* v1165 再考题不加分、不扣命 */\n  /* 🔴 BUG#42修复(v465):只锁单坑")
rep("    molesScore+=10;molesHit++;\n", "    if(!__rtM){molesScore+=10;molesHit++;}\n")
rep("    addXP(L.xpPerHit);markAnswer(allW.indexOf(molesTarget),true);",
    "    if(!__rtM)addXP(L.xpPerHit);markAnswer(allW.indexOf(molesTarget),true);")
rep("    card.classList.add('mole-wrong');\n    molesLives--;\n", "    card.classList.add('mole-wrong');\n    if(!__rtM)molesLives--;\n")
rep("    if(molesLives>0){setTimeout(startMolesWave,900);}\n    if(molesLives<=0){\n      molesActive=false;\n",
    "    if(molesLives>0){__hmlLesson('moles',allW.indexOf(molesTarget),startMolesWave,900);}\n    if(molesLives<=0){\n      molesActive=false;__hmlLesson('moles',allW.indexOf(molesTarget),function(){});__hmlAttach('moles','molesContent');\n")
rep("function molesComplete(){\n  molesActive=false;\n", "function molesComplete(){\n  molesActive=false;__hmlAttach('moles','molesContent');\n")

# ---------- 钓鱼 ----------
rep("fishActive=true;fishScore=0;fishLives=L.lives;fishOnscreen=0;fishCaught=0;\n",
    "fishActive=true;fishScore=0;fishLives=L.lives;fishOnscreen=0;fishCaught=0;__hmlStart('fish');\n")
rep("  if(fishPool.length===0){fishComplete();return}\n  var idx=fishPool.pop();",
    "  if(fishPool.length===0&&!__hmlRequeue('fish',fishPool)){fishComplete();return}\n  var idx=fishPool.pop();")
rep("      fishScore+=10;fishCaught++;\n      addXP(L.xpPerCatch);\n",
    "      if(!__hmlIsRetry('fish',allW.indexOf(fishTarget))){fishScore+=10;fishCaught++;\n      addXP(L.xpPerCatch);}\n")
rep("      fish.style.filter='drop-shadow(0 0 15px #dc2626) grayscale(.6)';\n      fishLives--;\n",
    "      fish.style.filter='drop-shadow(0 0 15px #dc2626) grayscale(.6)';\n      if(!__hmlIsRetry('fish',allW.indexOf(fishTarget)))fishLives--;\n")
rep("      if(fishLives>0){setTimeout(pickFishTarget,500);}\n",
    "      if(fishLives>0){__hmlLesson('fish',allW.indexOf(fishTarget),pickFishTarget,500);}\n")
rep("      if(fishLives<=0){fishGameOver();return}\n",
    "      if(fishLives<=0){__hmlLesson('fish',allW.indexOf(fishTarget),function(){});fishGameOver();return}\n")
rep("function fishGameOver(){\n  fishActive=false;\n", "function fishGameOver(){\n  fishActive=false;__hmlAttach('fish','fishContent');\n")
rep("function fishComplete(){\n  fishActive=false;\n", "function fishComplete(){\n  fishActive=false;__hmlAttach('fish','fishContent');\n")

# ---------- 泡泡 ----------
rep("bubbleActive=true;bubbleScore=0;bubbleCombo=0;bubbleLives=5;bubbleDone=0;\n",
    "bubbleActive=true;bubbleScore=0;bubbleCombo=0;bubbleLives=5;bubbleDone=0;__hmlStart('bubble');\n")
rep("if(bubblePool.length===0){bubbleComplete();return}\nconst idx=bubblePool.pop();",
    "if(bubblePool.length===0&&!__hmlRequeue('bubble',bubblePool)){bubbleComplete();return}\nconst idx=bubblePool.pop();")
rep("  if(bubblePool.length===0){setTimeout(bubbleComplete,200);return}\n",
    "  if(bubblePool.length===0&&!__hmlRequeue('bubble',bubblePool)){setTimeout(bubbleComplete,200);return}\n")
rep("bubbleStopCountdown(); // 🆕 答对停倒计时\nplayCorrect();bubbleCombo++;bubbleDone++;\nbubbleScore+=10+bubbleCombo*3;\n",
    "bubbleStopCountdown(); // 🆕 答对停倒计时\nconst __rtB=__hmlIsRetry('bubble',allW.indexOf(bubbleTarget));/* v1165 再考题不加分 */\nplayCorrect();bubbleCombo++;if(!__rtB){bubbleDone++;\nbubbleScore+=10+bubbleCombo*3;}\n")
rep("addXP(L.xpPerHit);markAnswer(allW.indexOf(w),true);\nconst rect=b.getBoundingClientRect();confetti(rect.left,rect.top,12);",
    "if(!__rtB)addXP(L.xpPerHit);markAnswer(allW.indexOf(w),true);\nconst rect=b.getBoundingClientRect();confetti(rect.left,rect.top,12);")
rep("}else{b.dataset.done='1';b.classList.add('wrong-pop');playWrong();bubbleStopCountdown();bubbleCombo=0;bubbleLives--;\n",
    "}else{b.dataset.done='1';b.classList.add('wrong-pop');playWrong();bubbleStopCountdown();bubbleCombo=0;if(!__hmlIsRetry('bubble',allW.indexOf(bubbleTarget)))bubbleLives--;\n")
rep("markAnswer(allW.indexOf(w),false);\nvar _ba=document.getElementById('bbArea');",
    "/* 🔴v1165: 记错的是没认出来的目标词——以前记到了点错的那个干扰词上，真正的错词进不了错题本和复习计划 */markAnswer(allW.indexOf(bubbleTarget),false);\nvar _ba=document.getElementById('bbArea');")
rep("if(bubbleLives>0){setTimeout(nextBubble,500);}\nif(bubbleLives<=0){bubbleGameOver();}}};",
    "if(bubbleLives>0){__hmlLesson('bubble',allW.indexOf(bubbleTarget),nextBubble,500);}\nif(bubbleLives<=0){__hmlLesson('bubble',allW.indexOf(bubbleTarget),function(){});bubbleGameOver();}}};")
rep("  bubbleCombo=0;bubbleLives--;\n  playWrong();\n",
    "  bubbleCombo=0;if(!__hmlIsRetry('bubble',allW.indexOf(bubbleTarget)))bubbleLives--;\n  playWrong();\n")
rep("    bubbleGameOver(); // 没命了→失败结算\n  }else{\n    setTimeout(nextBubble,400); // 还有命→自动跳下一题\n",
    "    __hmlLesson('bubble',allW.indexOf(bubbleTarget),function(){});bubbleGameOver(); // 没命了→失败结算\n  }else{\n    __hmlLesson('bubble',allW.indexOf(bubbleTarget),nextBubble,400); // 还有命→小课后跳下一题\n")
rep("function bubbleGameOver(){\n  bubbleActive=false;\n", "function bubbleGameOver(){\n  bubbleActive=false;__hmlAttach('bubble','bubbleContent');\n")
rep("function bubbleComplete(){\n  bubbleActive=false;\n", "function bubbleComplete(){\n  bubbleActive=false;__hmlAttach('bubble','bubbleContent');\n")

# ---------- 拼词 ----------
rep("  scrTotal=scrPool.length;scrIdx=0;scrCorrect=0;\n", "  scrTotal=scrPool.length;scrIdx=0;scrCorrect=0;__hmlStart('scramble');\n")
rep("  if(scrIdx>=scrTotal){scrComplete();return}\n", "  if(scrIdx>=scrPool.length&&!__hmlRequeue('scramble',scrPool)){scrComplete();return}\n")
rep("(scrIdx+1)+' / '+scrTotal", "Math.min(scrIdx+1,scrTotal)+' / '+scrTotal")
rep("playCorrect();addXP(L.xpPerWord);confetti(window.innerWidth/2,300,12);markAnswer(scrPool[scrIdx],true);scrCorrect++;",
    "const __rtS=__hmlIsRetry('scramble',scrPool[scrIdx]);playCorrect();if(!__rtS)addXP(L.xpPerWord);confetti(window.innerWidth/2,300,12);markAnswer(scrPool[scrIdx],true);if(!__rtS)scrCorrect++;")
rep("if(_sw)_sw.classList.add('shake-screen');\nsetTimeout(clearScramble,1100)}}}",
    "if(_sw)_sw.classList.add('shake-screen');\n__hmlLesson('scramble',scrPool[scrIdx],clearScramble,1100)}}}")
rep("function skipScramble(){\n", "function skipScramble(){\n  if(__hmlIsRetry('scramble',scrPool[scrIdx])){scrIdx++;nextScramble();return}  // v1165 再考题跳过就算了，不再记错\n")
rep("  markAnswer(scrPool[scrIdx],false);scrIdx++;nextScramble()\n}",
    "  markAnswer(scrPool[scrIdx],false);var __skI=scrPool[scrIdx];scrIdx++;__hmlLesson('scramble',__skI,nextScramble,0)\n}")
rep("function scrComplete(){\n  const L=SCRAMBLE_LEVELS[scrLevel]||SCRAMBLE_LEVELS.easy;\n",
    "function scrComplete(){\n  const L=SCRAMBLE_LEVELS[scrLevel]||SCRAMBLE_LEVELS.easy;__hmlAttach('scramble','scrambleContent');\n")

# ---------- 极速 60 秒 ----------
rep("  spActive=true;spTime=L.duration;spScore=0;spCombo=0;spSessionMaxCombo=0;\n",
    "  spActive=true;spTime=L.duration;spScore=0;spCombo=0;spSessionMaxCombo=0;__hmlStart('speed');\n")
rep("  spTimer=setInterval(()=>{spTime--;\n",
    "  spTimer=setInterval(()=>{if(window.HansenMistakeLesson&&HansenMistakeLesson.busy())return;/* v1165 小课期间不扣时间 */spTime--;\n")
rep("spScore+=Math.round(10*bonus*L.xpMul);document.getElementById('spScore').textContent=spScore;",
    "const __rtP=__hmlIsRetry('speed',window._spIdx);if(!__rtP)spScore+=Math.round(10*bonus*L.xpMul);document.getElementById('spScore').textContent=spScore;")
rep("playCorrect();addXP(Math.round(2*L.xpMul));markAnswer(window._spIdx,true);",
    "playCorrect();if(!__rtP)addXP(Math.round(2*L.xpMul));markAnswer(window._spIdx,true);")
rep("spCombo=0;document.getElementById('spCombo').textContent='💔';",
    "spCombo=0;document.getElementById('spCombo').textContent='👂';")
rep("playWrong();markAnswer(window._spIdx,false);setTimeout(nextSpeedQ,700)}}",
    "playWrong();markAnswer(window._spIdx,false);__hmlRequeueLater('speed',spPool2,window._spIdx,3);__hmlLesson('speed',window._spIdx,nextSpeedQ,700)}}")
rep("function endSpeed(){\n  spActive=false;\n", "function endSpeed(){\n  spActive=false;__hmlAttach('speed','speedContent');\n")

# ---------- 打字大师 ----------
rep("typeIdx=0;typeWordTimes=[];typeErrors=0;typeWrongWords=[];typeRoundStart=Date.now();startTypeTimer();nextTypeQ()}",
    "typeIdx=0;typeWordTimes=[];typeErrors=0;typeWrongWords=[];typeRoundStart=Date.now();__hmlStart('typing');startTypeTimer();nextTypeQ()}")
rep("function nextTypeQ(){if(!typeActive)return;if(typeIdx>=typePool.length){typeComplete();return}",
    "function nextTypeQ(){if(!typeActive)return;if(typeIdx>=typePool.length&&!__hmlRequeue('typing',typePool)){typeComplete();return}")
rep("    typeWordTimes.push({en:typeWord.en,ms:_wt,letters:_lt});\n",
    "    const __rtT=__hmlIsRetry('typing',typePool[typeIdx]);/* v1165 再考题不进速度纪录、不加分 */\n    if(!__rtT)typeWordTimes.push({en:typeWord.en,ms:_wt,letters:_lt});\n")
rep("playCorrect();addXP(L.xpPerWord);typeDone++;S.stats.typeCount++;progressQuest('type',1);markAnswer(typePool[typeIdx],true);",
    "playCorrect();if(!__rtT){addXP(L.xpPerWord);typeDone++;S.stats.typeCount++;progressQuest('type',1);}markAnswer(typePool[typeIdx],true);")
rep("    typeErrors++;\n    if(typeWrongWords.indexOf(typeWord.en)===-1)",
    "    if(!__hmlIsRetry('typing',typePool[typeIdx]))typeErrors++;\n    if(typeWrongWords.indexOf(typeWord.en)===-1)")
rep("    typeIdx++;setTimeout(function(){typeActive=true;var c=document.getElementById('typeCompare');if(c)c.remove();nextTypeQ();},2200);",
    "    var __missT=typePool[typeIdx];typeIdx++;__hmlLesson('typing',__missT,function(){typeActive=true;var c=document.getElementById('typeCompare');if(c)c.remove();nextTypeQ();},2200);")
rep("var wrongReview='';\nif(typeWrongWords.length){", "var wrongReview=__hmlResult('typing');/* v1165 带 🔊 和「练这 N 个词」 */\nif(!wrongReview&&typeWrongWords.length){")

# ---------- 火眼金睛 ----------
rep("  eagleActive=true;eagleScore=0;eagleRound=0;eagleCombo=0;\n", "  eagleActive=true;eagleScore=0;eagleRound=0;eagleCombo=0;__hmlStart('eagle');\n")
rep("  if(eaglePool.length===0){eagleComplete();return}\n  eagleRound++;\n  const idx=eaglePool.pop();",
    "  if(eaglePool.length===0&&!__hmlRequeue('eagle',eaglePool)){eagleComplete();return}\n  const idx=eaglePool.pop();\n  if(!__hmlIsRetry('eagle',idx))eagleRound++;")
rep("    eagleScore+=points;\n", "    if(!__hmlIsRetry('eagle',allW.indexOf(eagleTarget)))eagleScore+=points;\n")
rep("    addXP(L.xpPerQ);markAnswer(allW.indexOf(eagleTarget),true);",
    "    if(!__hmlIsRetry('eagle',allW.indexOf(eagleTarget)))addXP(L.xpPerQ);markAnswer(allW.indexOf(eagleTarget),true);")
rep("c.style.color='#1a1a2e'}});setTimeout(eagleNextRound,1400);",
    "c.style.color='#1a1a2e'}});__hmlLesson('eagle',allW.indexOf(eagleTarget),eagleNextRound,1400);")
rep("  markAnswer(allW.indexOf(eagleTarget),false);\n  setTimeout(eagleNextRound,1400);\n",
    "  markAnswer(allW.indexOf(eagleTarget),false);\n  __hmlLesson('eagle',allW.indexOf(eagleTarget),eagleNextRound,1400);\n")
rep("  if(!eagleActive)return;\n  eagleActive=false;\n  if(eagleTimer){clearInterval(eagleTimer);eagleTimer=null}\n  const L=EAGLE_LEVELS[eagleLevel]||EAGLE_LEVELS.easy;\n  var eaglePrevBest",
    "  if(!eagleActive)return;\n  eagleActive=false;__hmlAttach('eagle','eagleContent');\n  if(eagleTimer){clearInterval(eagleTimer);eagleTimer=null}\n  const L=EAGLE_LEVELS[eagleLevel]||EAGLE_LEVELS.easy;\n  var eaglePrevBest")

# ---------- 错题复习（本岛） ----------
rep("""playWrong();
markAnswer(targetIdx,false);
showToast('🤔 这次差一点 ~ 没关系, 记住正确答案!');
__hsnAdvanceReviewAfter(q,1800)""",
"""playWrong();
markAnswer(targetIdx,false);
/* 🔴v1165 答错小课：揭晓卡+重读代替一句提示 */
__hmlLesson('review',targetIdx,function(){__hsnAdvanceReviewAfter(q,0)},1800)""")

# ---------- 打 Boss（只加小课：Boss 结算/题池另有守卫，不动） ----------
rep("""    markAnswer(window._bossIdx,false);
    document.body.classList.add('shake-screen');
    setTimeout(function(){document.body.classList.remove('shake-screen')},400);
  }
  
  setTimeout(nextBossQ,1500)
}""",
"""    markAnswer(window._bossIdx,false);
    document.body.classList.add('shake-screen');
    setTimeout(function(){document.body.classList.remove('shake-screen')},400);
    /* 🔴v1165 答错小课：先看完 Boss 反击，再出揭晓卡+重读，然后下一题。
       小课期间告诉看门狗这是过渡(_bossTransUntil)，免得它以为卡死抢着出题 */
    var __bIdx=window._bossIdx;
    setTimeout(function(){try{window._bossTransUntil=Date.now()+3400;}catch(e){}__hmlLesson('boss',__bIdx,nextBossQ,0)},1100);
    return;
  }
  
  setTimeout(nextBossQ,1500)
}""")

def apply(path):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    bad = []
    for old, new in R:
        n = s.count(old)
        if n != 1: bad.append((n, old[:90].replace('\n', '⏎')))
    if bad:
        for b in bad: print(path, 'count', b[0], '|', b[1])
        return False
    for old, new in R: s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
    print(path, 'patched', len(R))
    return True

ok = True
for f in ('template.html', 'land_template.html'):
    ok = apply(f) and ok
sys.exit(0 if ok else 1)
