import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
anchor = "/* 🔴v1165 难度卡上的例词：本档真实的前 3 个词 */"
rep(BOTH, anchor, """/* 🔴v1165 结算页的「🪙 金币 +N」= 这一局钱包里真正多出来的：答对给的金币 + 连胜奖励（以前连胜奖励不算进来，后几局写 +0 钱包却在涨）。
   每个词每天最多给 3 次金币（防刷），这一局一个币都没拿到时，告诉孩子是怎么回事。 */
function __hsnRoundCoins(){
  var n=window._sessionCoins||0,st=window._sessionStreakCoins||0,cap=window._sessionCapHits||0;
  var h='🪙 金币 +'+n+(st>0?'（含连胜奖励 +'+st+'）':'');
  if(n===0&&cap>0)h+='<br><span style="font-size:12.5px;color:#fde68a;font-weight:700">今天这些词的金币领满啦，换个难度或明天再来～</span>';
  return h;
}
""" + anchor)
rep(BOTH, "function markMode(m){window._sessionCoins=0;", "function markMode(m){window._sessionCoins=0;window._sessionStreakCoins=0;window._sessionCapHits=0;")
rep(BOTH, "var _got=earnCoinOnCorrect(idx)?1:0;window._lastCoinGain=_got;if(_got){window._sessionCoins=(window._sessionCoins||0)+1;}",
          "var _got=earnCoinOnCorrect(idx)?1:0;window._lastCoinGain=_got;if(_got){window._sessionCoins=(window._sessionCoins||0)+1;}else{window._sessionCapHits=(window._sessionCapHits||0)+1;}")
rep(BOTH, "  if(m.gems > 0) addGem(m.gems);\n",
          "  if(m.gems > 0){ addGem(m.gems); window._sessionCoins=(window._sessionCoins||0)+m.gems; window._sessionStreakCoins=(window._sessionStreakCoins||0)+m.gems; }  /* 🔴v1165 连胜奖励也算进这一局的金币 */\n")
rep(BOTH, "🪙 金币 +'+(window._sessionCoins||0)+'", "'+__hsnRoundCoins()+'", count=9)
rep(BOTH, "🪙 \\u91d1\\u5e01 +${sc}", "${__hsnRoundCoins()}")
rep(BOTH, "🪙金币 +'+cnt+'", "🪙金币 最多 +'+cnt+'", count=6)
rep(BOTH, "🪙金币 +'+counts[k]+'", "🪙金币 最多 +'+counts[k]+'")
commit()
