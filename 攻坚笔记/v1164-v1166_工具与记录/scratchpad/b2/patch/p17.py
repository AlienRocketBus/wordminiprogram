# v1165 item 17: 文案/数字校对
import pathlib, sys
ROOT = pathlib.Path('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt')
ok = True
def patch(path, pairs, expect=1):
    global ok
    p = ROOT / path; s = p.read_text(encoding='utf-8')
    for o, n in pairs:
        c = s.count(o)
        want = expect if isinstance(expect, int) else expect.get(o, 1)
        if c != want: print(path, 'count', c, 'want', want, '|', o[:80]); ok = False; continue
        s = s.replace(o, n)
    p.write_text(s, encoding='utf-8')

TPL = [
    # 任务横幅：全局任务的字段是 title，不是 text（以前显示「还差 1 个! undefined」）
    ("showAlmostBanner('🎯 还差 1 个! ' + q.text + ' (' + q.progress + '/' + q.goal + ')');",
     "showAlmostBanner('🎯 还差 1 个! ' + (q.title || q.text || '') + ' (' + q.progress + '/' + q.goal + ')');  /* v1165: 全局任务用 title */"),
    # 成就：1500 词永远达不到（全游戏只有 952 个词）→ 目标 = 全部单词（从权威账本算出来）
    ("name:'万词王者',desc:'词汇量达到 1500 个单词'", "name:'全词王者',desc:'把所有岛屿的单词都认识一遍'"),
    ("    if(lw>=1500)unlockAch('vocabS1500');",
     "    /* v1165: 以前要 1500 词，全游戏才 952 个，永远拿不到；改成「全部单词」，数字从账本算 */\n    if(lw>=(function(){var t=window.HansenCanonical&&HansenCanonical.TOTAL_WORDS;return (typeof t==='number'&&t>600)?t:952})())unlockAch('vocabS1500');"),
    # 欢迎弹窗：玩法数按页面上真有的卡片算（以前写死 12，实际 14 张）
    ("<br>🎮 12 种超酷玩法等你来<br>", "<br>🎮 '+(function(){var n=document.querySelectorAll('.mode-card').length;return n>1?n+' 种':'好多种'})()+'超酷玩法等你来<br>"),
]
patch('template.html', TPL + [
    # 岛里说「5 大动物岛屿」不对：岛里的是小组
    ("🗺️ '+DATA.length+' 大⟦⟦ISLE_THEME⟧⟧岛屿等你探索", "🗺️ '+DATA.length+' 个⟦⟦ISLE_THEME⟧⟧小组等你探索"),
])
patch('land_template.html', TPL)
# 单词大陆的欢迎弹窗在 land_data.json 的槽位里（8 页各一份）
patch('land_data.json', [
    ("🗺️ '+DATA.length+' 大单词岛屿等你探索", "🗺️ '+DATA.length+' 个单词小组等你探索"),
    ("<br>🎮 12 种超酷玩法等你来<br>", "<br>🎮 '+(function(){var n=document.querySelectorAll('.mode-card').length;return n>1?n+' 种':'好多种'})()+'超酷玩法等你来<br>"),
], expect=8)
# 首页
patch('index.html', [
    ("<title>单词大冒险 · 单词大冒险</title>", "<title>单词大冒险</title>"),
    ('<meta name="description" content="27 座英语单词冒险岛 · 多种学习挑战 · 36 阶进化宠物">',
     '<meta name="description" content="英语单词冒险岛 · 十几种学习挑战 · 36 阶进化宠物">'),
    ("快穿越 <b>18 关神奇大冒险</b>, 收集 <b>711+ 单词宝藏</b>, <br>\n        玩转 <b>12 种超酷挑战</b>,",
     "快穿越 <b><span data-hsn-count=\"islands\">18</span> 座单词岛</b>, 收集 <b><span data-hsn-count=\"words\">712</span> 个单词宝藏</b>, <br>\n        玩转 <b>十几种超酷挑战</b>,"),
    ('<div class="title">12 种玩法</div>', '<div class="title">十几种玩法</div>'),
    ('<script src="vocab_all.js?v=1163"></script>',
     '<script src="vocab_all.js?v=1163"></script>\n<script>/* v1165: 首页岛屿数/单词数从词库现算，不再写死（以前写 711+） */try{(function(){var v=window.HANSEN_VOCAB_ALL||{},k=Object.keys(v),n=0;k.forEach(function(x){n+=(v[x]||[]).length});if(k.length&&n){document.querySelectorAll("[data-hsn-count=islands]").forEach(function(e){e.textContent=k.length});document.querySelectorAll("[data-hsn-count=words]").forEach(function(e){e.textContent=n})}})()}catch(e){}</script>'),
])
# 我的学习：分母按真实岛屿页面数算（以前写死 19，单词大陆 8 页也各算一座，会出现「已点亮 22 / 19」）
patch('hansen_mylearning.js', [
    ("  var TOTAL_ISLANDS = 19;\n",
     "  // v1165: 常规 18 岛 + 星海 + 单词大陆 8 页，各页都会记一份快照；从账本现算，算不出来用 27\n"
     "  var TOTAL_ISLANDS = (function(){ try { var HC = window.HansenCanonical; if(HC && HC.islands && typeof HC.resolve === 'function'){ var n = HC.islands.length; for(var i = 1; i <= 50 && HC.resolve('land' + i); i++) n++; return n; } } catch(e){} return 27; })();\n"),
])
sys.exit(0 if ok else 1)
