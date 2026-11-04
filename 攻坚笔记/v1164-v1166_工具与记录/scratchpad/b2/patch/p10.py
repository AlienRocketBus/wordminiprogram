# v1165 item 10: 拼写/找英文类题目的配图不能印着答案
import pathlib, sys
ROOT = pathlib.Path('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt')
R = []
def rep(o, n): R.append((o, n))
rep("""function __hmlResult(m){var M=__hml();return M?M.resultHtml(m):''}
""", """function __hmlResult(m){var M=__hml();return M?M.resultHtml(m):''}
/* 🔴v1165 题目要孩子自己想出/拼出英文时，配图不能印着答案（身体岛「脚趾」的图上写着 TOE）。
   去掉图里带英文字母的 <text> 标签；去掉后图太空(少于 3 个图形)就不放图，只看中文。
   认词类玩法（单词卡、答对揭晓卡、打地鼠英文题面）照旧显示原图。 */
function __hsnQuizPic(w){var e=String((w&&w.emoji)||'');if(e.indexOf('<svg')<0)return e;
  var out=e.replace(/<text\\b[^>]*>[\\s\\S]*?<\\/text>/g,function(t){return /[A-Za-z]/.test(t.replace(/<[^>]*>/g,''))?'':t});
  return (out.match(/<(circle|rect|path|ellipse|line|polygon|polyline)\\b/g)||[]).length>=3?out:''}
window.__hsnQuizPic=__hsnQuizPic;
""")
rep("""<div class="scramble-emoji">'+w.emoji+'</div>""", """<div class="scramble-emoji">'+__hsnQuizPic(w)+'</div>""")
rep("""<div class="typing-emoji">'+w.emoji+'</div>""", """<div class="typing-emoji">'+__hsnQuizPic(w)+'</div>""")
rep("""<div class="cloze-emoji">'+w.emoji+'</div>""", """<div class="cloze-emoji">'+__hsnQuizPic(w)+'</div>""")
rep("""'👀 找出 <b>'+eagleTarget.emoji+' '+eagleTarget.cn+'</b> 的<u>正确</u>拼写'""", """'👀 找出 <b>'+__hsnQuizPic(eagleTarget)+' '+eagleTarget.cn+'</b> 的<u>正确</u>拼写'""")
rep("""(bubbleDone+1)+' / '+bubbleTotal+'</div><div>'+target.emoji+' '+target.cn+'</div>'""", """(bubbleDone+1)+' / '+bubbleTotal+'</div><div>'+__hsnQuizPic(target)+' '+target.cn+'</div>'""")
rep("""'🎣 钓出: <span style="font-size:24px">'+fishTarget.emoji+'</span> <b>'+fishTarget.cn+'</b>'""", """'🎣 钓出: <span style="font-size:24px">'+__hsnQuizPic(fishTarget)+'</span> <b>'+fishTarget.cn+'</b>'""")
ok = True
for f in ('template.html', 'land_template.html'):
    p = ROOT / f; s = p.read_text(encoding='utf-8')
    bad = [(s.count(o), o[:80]) for o, n in R if s.count(o) != 1]
    if bad: print(f, bad); ok = False; continue
    for o, n in R: s = s.replace(o, n)
    p.write_text(s, encoding='utf-8'); print(f, 'patched', len(R))
# 定向打字大师 / 看汉意拼 / 听音拼
p = ROOT / 'hansen_focused_typing_v946.js'; s = p.read_text(encoding='utf-8')
o1 = """<span class="htm-title"><b>宠物掌握冲刺 · '+esc(w.en)+'</b>"""
n1 = """<span class="htm-title"><b>宠物掌握冲刺 · '+esc(w.cn||'')+'</b>"""
o2 = """<div class="typing-emoji">'+(w.emoji||'📘')+'</div>"""
n2 = """<div class="typing-emoji">'+((root.__hsnQuizPic?root.__hsnQuizPic(w):w.emoji)||'📘')+'</div>"""
for o, n in ((o1, n1), (o2, n2)):
    if s.count(o) != 1: print('focused', s.count(o), o[:60]); ok = False
    else: s = s.replace(o, n)
p.write_text(s, encoding='utf-8')
p = ROOT / 'hansen_spell_practice.js'; s = p.read_text(encoding='utf-8')
o = """    var wordEmoji = w.emoji || (curMode === 'listen' ? '🎧' : '📝');"""
n = """    // v1165: 拼写题配图不能印着答案（去掉图里的英文标签，太空就用默认图标）
    var wordEmoji = (window.__hsnQuizPic ? window.__hsnQuizPic(w) : w.emoji) || (curMode === 'listen' ? '🎧' : '📝');"""
if s.count(o) != 1: print('spell', s.count(o)); ok = False
else: s = s.replace(o, n); p.write_text(s, encoding='utf-8')
sys.exit(0 if ok else 1)
