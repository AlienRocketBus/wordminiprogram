# F060 确定的内容更正（生成源）：只改 pn / cn / exCn / emoji，例句英文一个字不动 → 录音和音频锁不受影响
import json, re, sys
WT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt'
SEP = {'available':('可获得的;可用的','可获得的/可用的'),'develop':('发展;发育','发展/发育'),'destroy':('摧毁;毁坏','摧毁/毁坏'),
       'struggle':('奋斗;挣扎','奋斗/挣扎'),'maximum':('最大值;最大的','最大值/最大的'),'minimum':('最小值;最小的','最小值/最小的'),
       'instead':('反而;作为替代','反而/作为替代'),'consequently':('因此;结果','因此/结果'),'generally':('通常;一般来说','通常/一般来说'),
       'fortunately':('幸好;幸运的是','幸好/幸运的是'),'public':('公共的;公众的','公共的/公众的'),'chemical':('化学物质;化学的','化学物质/化学的'),
       'business':('生意;商业','生意/商业'),'employee':('员工;雇员','员工/雇员')}
FIX = [  # (哪个岛, 词, 字段, 旧值, 新值)
  ('time','August','pn','/ɔːˈɡʌst/','/ˈɔːɡəst/'),
  ('food','cabbage','cn','白菜','卷心菜'),
  ('food','cabbage','exCn','奶奶在花园里种白菜。','奶奶在花园里种卷心菜。'),
  ('animal','sheep','cn','羊','绵羊'),
  ('clothes','skirt','cn','短裙','裙子'),
  ('home','table','exCn','我们摆桌子吃晚饭吧。','我们摆好碗筷准备吃晚饭吧。'),
  ('adjective','old','exCn','我爷爷年纪很老了。','我爷爷年纪很大了。'),
  ('time','March','exCn','春天三月开始。','春天从三月开始。'),
  ('job','scientist','emoji','👨‍🔬','👩‍🔬'),
  ('job','singer','emoji','👨‍🎤','👩‍🎤'),
  ('season','meanwhile','exCn','你摆桌子,与此同时我来做晚饭。','你来摆碗筷,与此同时我来做晚饭。'),
  ('season','tradition','emoji','🎎','🥟'),
] + [('season', w, 'cn', a, b) for w, (a, b) in SEP.items()]
LANDFIX = [('meanwhile','exCn','你摆桌子,与此同时我来做晚饭。','你来摆碗筷,与此同时我来做晚饭。'), ('tradition','emoji','🎎','🥟')] + [(w,'cn',a,b) for w,(a,b) in SEP.items()]

def fix_entry(src, en, field, old, new, where):
    pat = re.compile(r'\{en:"' + re.escape(en) + r'",[^\n]*')
    ms = list(pat.finditer(src))
    if len(ms) != 1: raise SystemExit('❌ %s: %s 出现 %d 次' % (where, en, len(ms)))
    m = ms[0]; seg = m.group(0)
    o = field + ':"' + old + '"'; n = field + ':"' + new + '"'
    if seg.count(o) != 1: raise SystemExit('❌ %s %s.%s 找不到旧值 %s' % (where, en, field, old))
    return src[:m.start()] + seg.replace(o, n) + src[m.end():]

raw = open(WT + '/island_data.json', encoding='utf-8').read(); D = json.loads(raw)
assert json.dumps(D, ensure_ascii=False, separators=(',', ':')) + '\n' == raw
for isl, en, field, old, new in FIX:
    D[isl]['DATA'] = fix_entry(D[isl]['DATA'], en, field, old, new, isl)
open(WT + '/island_data.json', 'w', encoding='utf-8').write(json.dumps(D, ensure_ascii=False, separators=(',', ':')) + '\n')

raw = open(WT + '/land_data.json', encoding='utf-8').read(); Ld = json.loads(raw)
assert json.dumps(Ld, ensure_ascii=False, indent=1) == raw
hits = 0
for k in sorted(Ld):
    sl = Ld[k]['slots']
    for i, s in enumerate(sl):
        for en, field, old, new in LANDFIX:
            if re.search(r'\{en:"' + re.escape(en) + r'",', s):
                sl[i] = s = fix_entry(s, en, field, old, new, k + ' slot%d' % i); hits += 1
open(WT + '/land_data.json', 'w', encoding='utf-8').write(json.dumps(Ld, ensure_ascii=False, indent=1))
print('✅ island_data.json %d 处、land_data.json %d 处' % (len(FIX), hits))
