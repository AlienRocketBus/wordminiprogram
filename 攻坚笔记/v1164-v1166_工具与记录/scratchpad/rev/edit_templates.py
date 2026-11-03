import sys
R = [
 # helpers: lesson opts + fallback that still reads the sentence; one-shot retry; retry-mark
 ("function __hmlLesson(m,idx,next,ms){var M=__hml();if(M){M.miss(m,idx);M.lesson(idx,next)}else setTimeout(next,ms==null?1600:ms)}",
  "function __hmlLesson(m,idx,next,ms,o){var M=__hml();if(M){M.miss(m,idx);M.lesson(idx,next,o);return}"
  "if(o&&o.say){var d=0,go=function(){if(!d){d=1;next()}};try{speak(o.say,1,function(){setTimeout(go,800)})}catch(e){go()}setTimeout(go,8000);return}"
  "setTimeout(next,ms==null?1600:ms)}"),
 ("function __hmlIsRetry(m,idx){var M=__hml();return !!(M&&M.isRetry(m,idx))}",
  "function __hmlIsRetry(m,idx){var M=__hml();return !!(M&&M.isRetry(m,idx))}\n"
  "function __hmlTakeRetry(m,idx){var M=__hml();return !!(M&&typeof M.takeRetry==='function'&&M.takeRetry(m,idx))}\n"
  "/* 🔴v1165 再考题＝刚看过答案、马上再答一遍：照常算一次答对（金币/连击/掌握照旧），但不算「纠错」——\n"
  "   不扣错题本、复习计划不升盒，也就没有 +2 纠错金。否则「故意答错再答对」比一次答对多拿 2 倍金币，\n"
  "   错题本和间隔复习也会在每轮结束时被这一下「清掉」，孩子刚错的词再也排不进复习。 */\n"
  "function __hmlMark(idx,correct,retry){if(!retry||!correct)return markAnswer(idx,correct);window.__hmlRetryAns=1;try{return markAnswer(idx,correct)}finally{window.__hmlRetryAns=0}}"),
 # markAnswer: retry answers do not decrement the wrong book
 ("progressQuest('correct',1);if(_wrong){_wrong--;",
  "progressQuest('correct',1);if(_wrong&&!window.__hmlRetryAns){_wrong--;"),
 # moles / fish / bubble
 ("if(!__rtM)addXP(L.xpPerHit);markAnswer(allW.indexOf(molesTarget),true);",
  "if(!__rtM)addXP(L.xpPerHit);__hmlMark(allW.indexOf(molesTarget),true,__rtM);"),
 ("      markAnswer(allW.indexOf(fishTarget),true);",
  "      __hmlMark(allW.indexOf(fishTarget),true,__hmlIsRetry('fish',allW.indexOf(fishTarget)));"),
 ("if(!__rtB)addXP(L.xpPerHit);markAnswer(allW.indexOf(w),true);",
  "if(!__rtB)addXP(L.xpPerHit);__hmlMark(allW.indexOf(w),true,__rtB);"),
 # scramble
 ("confetti(window.innerWidth/2,300,12);markAnswer(scrPool[scrIdx],true);if(!__rtS)scrCorrect++;",
  "confetti(window.innerWidth/2,300,12);__hmlMark(scrPool[scrIdx],true,__rtS);if(!__rtS)scrCorrect++;"),
 # speed: one-shot retry flag taken when the question is drawn
 ("const idx=spPool2.pop();const w=allW[idx];",
  "const idx=spPool2.pop();window._spRetry=__hmlTakeRetry('speed',idx);/* v1165 只有插回来的那一份算再考 */const w=allW[idx];"),
 ("const __rtP=__hmlIsRetry('speed',window._spIdx);",
  "const __rtP=!!window._spRetry;/* v1165 题池洗回来再出现的同一个词照常算分 */"),
 ("playCorrect();if(!__rtP)addXP(Math.round(2*L.xpMul));markAnswer(window._spIdx,true);",
  "playCorrect();if(!__rtP)addXP(Math.round(2*L.xpMul));__hmlMark(window._spIdx,true,__rtP);"),
 # listen: retry does not bump the pet game counter
 ("S.stats.listenRight++;progressQuest('listen',1);}markAnswer(listenQ.idx,true);if(S.stats.listenRight%10===0)bumpGameCount('listen');",
  "S.stats.listenRight++;progressQuest('listen',1);}__hmlMark(listenQ.idx,true,__rtL);if(!__rtL&&S.stats.listenRight%10===0)bumpGameCount('listen');/* v1165 再考题没加答对数，也不能再记一次宠物练习 */"),
 # typing
 ("progressQuest('type',1);}markAnswer(typePool[typeIdx],true);",
  "progressQuest('type',1);}__hmlMark(typePool[typeIdx],true,__rtT);"),
 # cloze correct + wrong
 ("playCorrect();if(!__hmlIsRetry('cloze',clozeQ.idx)){addXP(L.xpPerQ);clozeDone++;S.stats.clozeRight++;progressQuest('cloze',1);}markAnswer(clozeQ.idx,true);",
  "const __rtC=__hmlIsRetry('cloze',clozeQ.idx);playCorrect();if(!__rtC){addXP(L.xpPerQ);clozeDone++;S.stats.clozeRight++;progressQuest('cloze',1);}__hmlMark(clozeQ.idx,true,__rtC);"),
 ("/* 🔴v1165 答错小课：空格里已填好正确词，再出揭晓卡+读单词(约2.5秒/点一下) */\n__hmlLesson('cloze',clozeQ.idx,nextClozeQ,1600)}}",
  "/* 🔴v1165 答错小课：揭晓卡上带着这句例句（正确的词标亮），和以前一样把整句例句读一遍（教学价值高），\n   读完再停一下才出下一题；点一下也能跳过。模块没加载时照旧读整句、读完进下一题 */\n"
  "__hmlLesson('cloze',clozeQ.idx,nextClozeQ,1600,{say:clozeQ.word.ex||clozeQ.word.en,ex:clozeQ.word.ex,exCn:clozeQ.word.exCn,waitSpeech:true})}}"),
 # eagle
 ("    if(!__hmlIsRetry('eagle',allW.indexOf(eagleTarget)))addXP(L.xpPerQ);markAnswer(allW.indexOf(eagleTarget),true);",
  "    const __rtE=__hmlIsRetry('eagle',allW.indexOf(eagleTarget));if(!__rtE)addXP(L.xpPerQ);__hmlMark(allW.indexOf(eagleTarget),true,__rtE);"),
]
for fn in sys.argv[1:]:
    s = open(fn, encoding='utf-8').read()
    for old, new in R:
        n = s.count(old)
        if n != 1:
            print('FAIL', fn, n, old[:90]); sys.exit(1)
        s = s.replace(old, new)
    open(fn, 'w', encoding='utf-8').write(s)
    print('ok', fn, len(R), 'edits')
