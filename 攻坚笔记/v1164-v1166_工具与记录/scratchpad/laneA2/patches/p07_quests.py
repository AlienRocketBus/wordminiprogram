import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
import P as _P
t = _P._get(T); l = _P._get(L)
# ① 单词大陆：每日任务的定义/规整/抽取和常规岛逐字一样（以前只认 7 个、不认识的任务就整份清空 →「暂无任务」，徽章却是 0/12）
a = t.index('const DAILY_QUEST_POOL=['); b = t.index('function progressQuest(')
tblock = t[a:b]
s1 = tblock.index('/*🔴v1002: 拼写大PK 入口'); s2 = tblock.index('function rollDailyQuests(')
tblock_land = tblock[:s1] + tblock[s2:]
la = l.index('const DAILY_QUEST_POOL=['); lb = l.index('function progressQuest(')
_P._buf[L] = l[:la] + tblock_land + l[lb:]
# ② 单词大陆：打地鼠/钓鱼/火眼金睛按得分算任务（和常规岛、全局任务表「累计得 30 分」一致；以前得 25 分只 +1）
rep(L, "  progressQuest('moles',1);if(!S.stats.molesCleared)S.stats.molesCleared=0",
       "  progressQuest('moles',(typeof molesScore==='number'?molesScore:1));/*🔴v1001 含金量: 按得分*/if(!S.stats.molesCleared)S.stats.molesCleared=0")
rep(L, "  progressQuest('fish',1);if(!S.stats.fishCleared)S.stats.fishCleared=0",
       "  progressQuest('fish',(typeof fishScore==='number'?fishScore:1));/*🔴v1001 含金量: 按得分*/if(!S.stats.fishCleared)S.stats.fishCleared=0")
rep(L, "  progressQuest('eagle',1);if(!S.stats.eagleCleared)S.stats.eagleCleared=0",
       "  progressQuest('eagle',(typeof eagleScore==='number'?eagleScore:1));/*🔴v1001 含金量: 按得分*/if(!S.stats.eagleCleared)S.stats.eagleCleared=0")
# ③ 两个母版：记忆翻牌按配对成功的组数（matchPairs 是 16 张牌的数组，以前判成「不是数字」→ 永远 +1）
rep(T, "progressQuest('match',(typeof matchPairs==='number'?matchPairs:1));/*🔴v1001 含金量: 按配对成功组数*/save()",
       "progressQuest('match',(matchMatched|0)||1);/*🔴v1001 含金量: 按配对成功组数（🔴v1165 matchPairs 是牌的数组，组数是 matchMatched）*/save()")
rep(L, "progressQuest('match',1);save()",
       "progressQuest('match',(matchMatched|0)||1);/*🔴v1001 含金量: 按配对成功组数（🔴v1165 matchPairs 是牌的数组，组数是 matchMatched）*/save()")
# ④ 两个母版：打地鼠/钓鱼「命用完了」那一局的得分也算任务（以前只有打完整档才算，输光命就白打）
rep(BOTH, "      molesActive=false;__hmlLesson('moles',allW.indexOf(molesTarget),function(){});__hmlAttach('moles','molesContent');",
          "      molesActive=false;__hmlLesson('moles',allW.indexOf(molesTarget),function(){});__hmlAttach('moles','molesContent');\n      if(molesScore>0)progressQuest('moles',molesScore);  /* 🔴v1165 命用完那一局的得分也算任务 */")
rep(BOTH, "function fishGameOver(){\n  fishActive=false;__hmlAttach('fish','fishContent');",
          "function fishGameOver(){\n  fishActive=false;__hmlAttach('fish','fishContent');\n  if(fishScore>0)progressQuest('fish',fishScore);  /* 🔴v1165 命用完那一局的得分也算任务 */")
# ⑤ 单词大陆：复习完成也上报「复习单词」「清空今日复习」任务（以前复习任务从来不涨）
t2 = _P._get(T)
qa = t2.index("/* \\U0001f534v1000: \\u590d\\u4e60\\u4efb\\u52a1\\u4e0a\\u62a5")
qb = t2.index("}catch(e){}\n", qa) + len("}catch(e){}\n")
qblock = t2[qa:qb]
anchor = "reviewState.settled=true;reviewState.settling=false;\nsave();\n"
assert _P._get(T).count(anchor + qblock) == 1, 'template anchor'
rep(L, anchor, anchor + qblock)
commit()
