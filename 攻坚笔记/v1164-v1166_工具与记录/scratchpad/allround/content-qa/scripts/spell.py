import json, re, collections
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
rows=json.load(open(B+'data/master.json'))
freq=json.load(open(B+'refdata_dl/spell/en_freq.json'))
cmu=set()
for ln in open(B+'refdata_dl/cmu/cmudict.dict', encoding='utf-8'):
  w=ln.split()[0]; cmu.add(re.sub(r'\(\d+\)$','',w))
unk=collections.defaultdict(list)
for r in rows:
  for fld in ('en','ex'):
    for tok in re.findall(r"[A-Za-z][A-Za-z'’\-]*", r[fld] or ''):
      t=tok.lower().replace('’',"'").strip("'")
      for part in t.split('-'):
        if not part: continue
        base=part
        if base in freq or base in cmu: continue
        b2=re.sub(r"'(s|t|re|ve|ll|d|m)$",'',base)
        if b2 in freq or b2 in cmu: continue
        unk[base].append((r['id'],r['island'],r['en'],fld))
for k,v in sorted(unk.items()):
  print(k, len(v), v[:3])
