import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
# ── F051 打地鼠/钓鱼结算：漏了就照实写「打中 7 / 8 个」，全中才写「全部」
rep(BOTH, "      '<div style=\"font-size:14px;color:#cbd5e1;margin-bottom:10px\">打中全部 '+molesTotal+' 个</div>'+",
          "      '<div style=\"font-size:14px;color:#cbd5e1;margin-bottom:10px\">'+(molesHit>=molesTotal?'打中全部 '+molesTotal+' 个':'打中 '+molesHit+' / '+molesTotal+' 个')+((L.lives-molesLives)>0?' · 打错 '+(L.lives-molesLives)+' 次':'')+'</div>'+  /* 🔴v1165 漏了就照实写，全中才说「全部」 */")
rep(BOTH, "      '<div style=\"font-size:14px;color:#cbd5e1;margin-bottom:10px\">钓上全部 '+fishTotal+' 条</div>'+",
          "      '<div style=\"font-size:14px;color:#cbd5e1;margin-bottom:10px\">'+(fishCaught>=fishTotal?'钓上全部 '+fishTotal+' 条':'钓上 '+fishCaught+' / '+fishTotal+' 条')+((L.lives-fishLives)>0?' · 钓错 '+(L.lives-fishLives)+' 次':'')+'</div>'+  /* 🔴v1165 漏了就照实写，全中才说「全部」 */")
# ── F052 字母拼拼乐：均匀洗牌；洗出来正好是答案就再洗
rep(BOTH, "var __hsnRuns={};", "/* 🔴v1165 均匀洗牌（Fisher–Yates）。sort(()=>Math.random()-.5) 洗得很不匀：短词常常一出来就是正确顺序 */\nfunction __hsnShuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}\nvar __hsnRuns={};")
rep(BOTH, "  const letters=w.en.split('').sort(()=>Math.random()-.5);\n",
          "  const letters=__hsnShuffle(w.en.split(''));\n  /* 🔴v1165 洗出来正好拼成答案就再洗（最多 20 次；全是同一个字母的词怎么洗都一样，就不洗了） */\n  {const ans=w.en.replace(/ /g,'');if(new Set(ans.split('')).size>1){let g=0;while(g++<20&&letters.filter(l=>l!==' ').join('')===ans)__hsnShuffle(letters);}}\n")
# ── F053 火眼金睛：词组的假选项不能只多/少/挪一个空格（看起来和正确答案一模一样）
rep(BOTH, "  for(let i=0;i<len;i++){\n    const ch=word[i].toLowerCase();\n    const subs=subMap[ch]||[];",
          "  /* 🔴v1165 空格的位置一律不动：只多一个空格/挪一下空格，看起来和正确答案一模一样，选对的孩子会被判错 */\n  const sp=i=>word[i]===' ';\n  for(let i=0;i<len;i++){\n    if(sp(i))continue;\n    const ch=word[i].toLowerCase();\n    const subs=subMap[ch]||[];")
rep(BOTH, "  for(let i=0;i<len;i++){\n    ops.push(word.slice(0,i+1)+word[i]+word.slice(i+1));\n  }",
          "  for(let i=0;i<len;i++){\n    if(sp(i))continue;\n    ops.push(word.slice(0,i+1)+word[i]+word.slice(i+1));\n  }")
rep(BOTH, "    for(let i=0;i<len;i++){\n      ops.push(word.slice(0,i)+word.slice(i+1));\n    }",
          "    for(let i=0;i<len;i++){\n      if(sp(i))continue;\n      ops.push(word.slice(0,i)+word.slice(i+1));\n    }")
rep(BOTH, "  for(let i=0;i<len-1;i++){\n    if(word[i]!==word[i+1])ops.push(",
          "  for(let i=0;i<len-1;i++){\n    if(sp(i)||sp(i+1))continue;\n    if(word[i]!==word[i+1])ops.push(")
rep(BOTH, "  const uniq=[];const seen=new Set([word.toLowerCase()]);\n  ops.forEach(o=>{\n    if(!o)return;\n    const lo=o.toLowerCase();",
          "  const norm=s=>String(s).replace(/\\s+/g,' ').trim().toLowerCase();   /* 比较时不看空格多少、不看大小写 */\n  const uniq=[];const seen=new Set([norm(word)]);\n  ops.forEach(o=>{\n    if(!o)return;\n    const lo=norm(o);")
# ── F057 打字大师：「拼对率」= 拼对的词 / (拼对 + 拼错 + 超时)
rep(BOTH, "let typeWordTimes=[],typeWordStart=0,typeRoundStart=0,typeErrors=0,typeTimerInt=null,typeWrongWords=[];",
          "let typeWordTimes=[],typeWordStart=0,typeRoundStart=0,typeErrors=0,typeTimerInt=null,typeWrongWords=[],typeTimeouts=0;")
rep(BOTH, "typeIdx=0;typeWordTimes=[];typeErrors=0;typeWrongWords=[];typeRoundStart=Date.now();",
          "typeIdx=0;typeWordTimes=[];typeErrors=0;typeTimeouts=0;typeWrongWords=[];typeRoundStart=Date.now();")
rep(BOTH, "  if(!typeActive||!typeWord)return;\n  typeWordStart=0; // 防止本tick内重复触发\n  typeIdx++;",
          "  if(!typeActive||!typeWord)return;\n  typeWordStart=0; // 防止本tick内重复触发\n  if(!__hmlIsRetry('typing',typePool[typeIdx]))typeTimeouts++;  /* 🔴v1165 超时没拼出来也算一次没拼对 */\n  typeIdx++;")
rep(BOTH, "var accuracy=(totalLetters+typeErrors>0)?Math.round(totalLetters/(totalLetters+typeErrors)*100):100;",
          "/* 🔴v1165 「拼对率」按词算：拼对的词 /（拼对 + 拼错 + 超时）。以前把字母数和错词数混在一起（6 对 2 错显示 92%） */\nvar accuracy=(typeDone+typeErrors+typeTimeouts>0)?Math.round(typeDone/(typeDone+typeErrors+typeTimeouts)*100):100;")
rep(BOTH, "<span>准确率 <b style=\"color:'+(accuracy>=95?'#22c55e':'#fbbf24')+'\">'+accuracy+'%</b></span>",
          "<span>拼对率 <b style=\"color:'+(accuracy>=95?'#22c55e':'#fbbf24')+'\">'+accuracy+'%</b></span>")
# ── F058 底栏：点「探索单词」不再点亮「错题」格（那一格已经改成错题总览）
rep(BOTH, "if(navMap[id])document.getElementById(navMap[id]).classList.add('active');",
          "/* 🔴v1165 底栏的「探索」格已被错题总览改成「错题」：进探索单词时不能把它点亮 */\nif(navMap[id]&&id!=='explore')document.getElementById(navMap[id]).classList.add('active');")
# ── F062 showToast：居中、能换行、留够时间读完（有页内提示模块就交给它）
rep(BOTH, "function showToast(msg){floatText(window.innerWidth/2,window.innerHeight/2-60,msg,'#fbbf24')}",
          """/* 🔴v1165 提示条：以前借飘字显示（左边缘从屏幕正中开始、长句被右边截掉、1.2 秒就没了）。
   现在交给页内提示（底部居中、自动换行、约 3 秒）；它还没加载时自己画一个居中的提示框。不闪、不抖、不转。 */
function showToast(msg){
  msg=String(msg==null?'':msg);if(!msg)return;
  var ms=msg.length>8?3000:2000;
  try{if(window.HansenToast&&typeof HansenToast.say==='function'){HansenToast.say(msg,ms);return;}}catch(e){}
  try{
    var d=document.createElement('div');d.className='hsn-island-toast';d.textContent=msg;
    d.style.cssText='position:fixed;left:50%;top:42%;transform:translateX(-50%);max-width:88vw;width:max-content;box-sizing:border-box;white-space:normal;word-break:break-word;text-align:center;z-index:99990;pointer-events:none;background:rgba(15,23,42,.94);color:#fde047;font-size:15px;font-weight:800;line-height:1.6;padding:10px 16px;border-radius:14px;box-shadow:0 6px 22px rgba(0,0,0,.4)';
    (document.body||document.documentElement).appendChild(d);
    setTimeout(function(){try{d.remove();}catch(e){}},ms);
  }catch(e){}
}""")
# ── F063 拼写类题目的配图：自己印着英文单词的位图也不放（酸奶图上写着 YOGURT）
rep(BOTH, "function __hsnQuizPic(w){var e=String((w&&w.emoji)||'');if(e.indexOf('<svg')<0)return e;",
          "/* 🔴v1165 有几张位图自己印着这个词（酸奶杯上写着 YOGURT），拼写类题目里也不放 */\nvar __HSN_WORDY_PICS=/icons\\/food-v958\\/yogurt\\.webp/i;\nfunction __hsnQuizPic(w){var e=String((w&&w.emoji)||'');if(__HSN_WORDY_PICS.test(e))return '';if(e.indexOf('<svg')<0)return e;")
# ── F075 连胜小条：离开游戏就收起来（连胜数照留）
rep(BOTH, "/*🔴BUG#94 返回首页恢复滚动位置·其他屏回顶*/",
          "/* 🔴v1165 连胜小条「🎯3 · 🪙满」只在答题的屏上显示；回主页、去抽卡/卡册等就收起来（连胜数照留，下次答对接着算） */\nif(['listen','match','typing','cloze','scramble','moles','fish','bubble','speed','eagle','boss','review'].indexOf(id)<0){try{hideComboUI();}catch(e){}}\n/*🔴BUG#94 返回首页恢复滚动位置·其他屏回顶*/")
commit()
