import json, re, sys
WT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt'
HELPER = """/* 🔴v1165 大欢迎弹窗只在这台设备第一次进岛时出现一次；以后每到一个没玩过的新岛，只用一句话打招呼
   （以前每个新岛都弹一遍全套「欢迎来到…」，像换了一个 App）。藏在后台的预热页不算「进岛」，不占用这一次。 */
function __hsnIntroOnScreen(){
  try{if(/[?&]warm=1(?:&|$)/.test(location.search||''))return false;}catch(e){}
  try{var fe=window.frameElement;if(fe){if(fe.getAttribute&&fe.getAttribute('aria-hidden')==='true')return false;var r=fe.getBoundingClientRect();if(!r.width||!r.height)return false;}}catch(e){}
  return true;
}
function __hsnIntroFirst(){var seen=false;try{seen=localStorage.getItem('hansen_island_intro_seen_v1165')==='1';}catch(e){}if(!seen){try{localStorage.setItem('hansen_island_intro_seen_v1165','1');}catch(e){}}return !seen;}
"""
def wrap(src, name_expr):
    old_head = "if(S.totalAnswers===0&&S.learned.length===0){setTimeout(()=>{"
    assert src.count(old_head) == 1, src[:200]
    i = src.index(old_head)
    j = src.index("},300)}", i) + len("},300)}")
    body = src[i + len("if(S.totalAnswers===0&&S.learned.length===0){"):j - 1]   # setTimeout(()=>{...},300)
    new = ("if(S.totalAnswers===0&&S.learned.length===0&&__hsnIntroOnScreen()){if(__hsnIntroFirst()){" + body + "}"
           "else{setTimeout(function(){try{showToast('👋 欢迎来到'+" + name_expr + "+'！这里有 '+allW.length+' 个单词');}catch(e){}},600);}}")
    return src[:i] + new + src[j:]
# 常规岛母版
p = WT + '/template.html'; t = open(p, encoding='utf-8').read()
anchor = "// Show a welcome message if first time\n"
assert t.count(anchor) == 1
t = t.replace(anchor, anchor + HELPER)
t = wrap(t, "'⟦⟦ISLE_ZH⟧⟧'")
open(p, 'w', encoding='utf-8').write(t)
# 单词大陆母版（函数）+ 8 个岛的欢迎槽位
p = WT + '/land_template.html'; l = open(p, encoding='utf-8').read()
assert l.count(anchor) == 1
l = l.replace(anchor, anchor + HELPER)
open(p, 'w', encoding='utf-8').write(l)
raw = open(WT + '/land_data.json', encoding='utf-8').read(); D = json.loads(raw)
assert json.dumps(D, ensure_ascii=False, indent=1) == raw
for n in range(1, 9):
    sl = D['land%d' % n]['slots']
    name = re.search(r"欢迎来到([^！<]+)！", sl[12]).group(1)
    sl[12] = wrap(sl[12], "'" + name + "'")
open(WT + '/land_data.json', 'w', encoding='utf-8').write(json.dumps(D, ensure_ascii=False, indent=1))
print('✅ welcome patched')
