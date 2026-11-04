import json, collections, sys
D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/data/'
isl=json.load(open(D+'island_entries.json'))
voc=json.load(open(D+'vocab_entries.json'))
gen=json.load(open(D+'gen_src_entries.json'))
F=['en','pn','cn','ex','exCn','emojiRaw']
# 1. island html vs vocab_all by key and position
byKey=collections.defaultdict(list)
for e in isl: byKey[e['key']].append(e)
vk=collections.defaultdict(list)
for v in voc: vk[v['group']].append(v)
diffs=[]
for g,arr in vk.items():
  ia=byKey.get(g)
  if ia is None: print('no island for group',g); continue
  if len(ia)!=len(arr): print('len mismatch',g,len(ia),len(arr))
  imap=collections.defaultdict(list)
  for e in ia: imap[e['en']].append(e)
  for v in arr:
    cands=imap.get(v['en'])
    if not cands: diffs.append(('missing_in_island',g,v['en'],'',''));continue
    e=cands[0]
    for f in F:
      if (e.get(f) or '')!=(v.get(f) or ''):
        diffs.append(('field_diff',g,v['en'],f,(e.get(f) or '')[:150]+' || VOCAB: '+(v.get(f) or '')[:150]))
c=collections.Counter((d[0],d[3]) for d in diffs)
print('island-vs-vocab diffs:',c)
for d in diffs:
  if d[3]!='emojiRaw': print(d)
# emoji diffs summary
em=[d for d in diffs if d[3]=='emojiRaw']
print('emoji diffs count',len(em))
for d in em[:200]:
  print('EMOJI', d[1], d[2], d[4][:300])
