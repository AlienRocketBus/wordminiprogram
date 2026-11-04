import sys, re; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
# ① 单词大陆的听音辨义分档：从本岛 30 个词按长度分（和本页打字/完形同一个 ≤7 / 8 / 9+ 切法），不再写死 ①② 号岛的词
s = open(L, encoding='utf-8').read()
i = s.index('const LISTEN_LEVELS={'); j = s.index('};', i) + 2
old = s[i:j]
new = """const LISTEN_LEVELS={
  /* 🔴v1165 以前 8 个大陆岛共用一张写死的词表（只有①②号岛的词）→ ③–⑧号岛三档都是 0 个词、一点就报错。
     现在从本岛自己的词按长度分档，和本页「打字大师」「完形填空」同一个切法。 */
  easy:{name:'初级',icon:'🌱',c1:'#22c55e',c2:'#16a34a',desc:'7 字母以内',words:allW.filter(w=>w.en.length<=7).map(w=>w.en)},
  medium:{name:'中级',icon:'⚡',c1:'#fbbf24',c2:'#f59e0b',desc:'8 字母词',words:allW.filter(w=>w.en.length>7&&w.en.length<=8).map(w=>w.en)},
  hard:{name:'高级',icon:'🔥',c1:'#ef4444',c2:'#dc2626',desc:'9+ 字母长词',words:allW.filter(w=>w.en.length>8).map(w=>w.en)}
};"""
rep(L, old, new)
# ② 通用的「这一档没有词」灰卡（和火眼金睛原来那张一样）：灰、带 🔒、点不了
anchor = "function showToast(msg){floatText(window.innerWidth/2,window.innerHeight/2-60,msg,'#fbbf24')}"
rep(BOTH, anchor, anchor + """
/* 🔴v1165 难度菜单里 0 个词的那一档：画成灰色 🔒 卡片、不能点（以前看着能玩，一点只弹个提示） */
function __hsnLockedLevelCard(L){return '<div class="hsn-level-locked" style="background:linear-gradient(135deg,'+L.c1+','+L.c2+');border-radius:18px;padding:16px;margin-bottom:12px;opacity:.42;filter:grayscale(.75);display:flex;align-items:center;gap:12px"><div style="font-size:38px;flex-shrink:0">🔒</div><div style="flex:1;min-width:0;color:#fff"><div style="font-size:18px;font-weight:900;margin-bottom:3px">'+L.name+'</div><div style="font-size:13px;font-weight:600;opacity:.92">本岛暂时没有这个难度的单词</div></div><div style="font-size:22px;opacity:.7">🔒</div></div>';}""")
# ③ 听音辨义菜单：0 词画灰卡；开始时 0 词只提示、不进游戏（以前直接报错卡住）
rep(BOTH, "      const L=LISTEN_LEVELS[k];const cnt=LISTEN_LEVEL_IDX[k].length;\n      return '<div onclick=\"startListenLevel(",
          "      const L=LISTEN_LEVELS[k];const cnt=LISTEN_LEVEL_IDX[k].length;\n      if(!cnt)return __hsnLockedLevelCard(L);\n      return '<div onclick=\"startListenLevel(")
rep(BOTH, "function startListenLevel(level){\n  if(!LISTEN_LEVELS[level])return;\n",
          "function startListenLevel(level){\n  if(!LISTEN_LEVELS[level])return;\n  /* 🔴v1165 这一档没有词：只提示，不进游戏（以前 nextListenQ 读不到词直接报错） */if(!LISTEN_LEVEL_IDX[level]||!LISTEN_LEVEL_IDX[level].length){showToast('🔊 本岛暂时没有这个难度的单词，换一档试试~');return;}\n")
commit()
