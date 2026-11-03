import json, collections
D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/data/'
isl=json.load(open(D+'island_entries.json'))
gen=json.load(open(D+'gen_src_entries.json'))
F=['en','pn','cn','ex','exCn','emojiRaw']
# html vs generator source
hk=collections.defaultdict(list)
for e in isl: hk[e['island']].append(e)
gk=collections.defaultdict(list)
for g in gen: gk[g['island']].append(g)
nd=0
for k,arr in gk.items():
  h=hk.get(k)
  if h is None: print('gen island not in html',k); continue
  if len(h)!=len(arr): print('len mismatch',k,len(h),len(arr))
  for a,b in zip(h,arr):
    for f in F:
      if (a.get(f) or '')!=(b.get(f) or ''): nd+=1; print('HTML!=GEN',k,a['en'],f,(a.get(f) or '')[:100],'||',(b.get(f) or '')[:100])
print('html vs gen diffs',nd, 'islands in gen', sorted(gk.keys()))
# season vs land1-8
season=[e for e in isl if e['island']=='season']
land=[e for e in isl if e['island'].startswith('land')]
print('season',len(season),'land',len(land))
sm={e['en']:e for e in season}
lm={}
for e in land: lm.setdefault(e['en'],[]).append(e)
only_s=[w for w in sm if w not in lm]; only_l=[w for w in lm if w not in sm]
print('only season',only_s); print('only land',only_l)
dl=[(w,len(v)) for w,v in lm.items() if len(v)>1]; print('dup within land', dl)
nd=0
for w,e in sm.items():
  for l in lm.get(w,[]):
    for f in ['pn','cn','ex','exCn','emojiRaw']:
      if (e.get(f) or '')!=(l.get(f) or ''): nd+=1; print('SEASON!=LAND',w,l['island'],f,(e.get(f) or '')[:120],'||',(l.get(f) or '')[:120])
print('season vs land diffs',nd)
# order/category mapping
print([ (e['island'],e['cat']) for e in land[::30]])
print(sorted(set(e['cat'] for e in season)))
