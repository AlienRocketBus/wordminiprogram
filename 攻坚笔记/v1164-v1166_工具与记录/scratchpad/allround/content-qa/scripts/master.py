import json, collections
D='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/data/'
isl=json.load(open(D+'island_entries.json'))
# canonical = classic islands (18) + season (240); land1-8 mirror season
canon=[e for e in isl if not e['island'].startswith('land')]
landmap={e['en']:e for e in isl if e['island'].startswith('land')}
rows=[]
for i,e in enumerate(canon):
  r=dict(id=i+1, island=e['island'], src=e['src'], line=e['line'], cat=e['cat'], en=e['en'], pn=e['pn'], cn=e['cn'], ex=e['ex'], exCn=e['exCn'], emojiKind=e['emojiKind'], emojiText=e['emojiText'], svgText=e['svgText'])
  if e['island']=='season':
    l=landmap[e['en']]; r['also']='%s:%s'%(l['src'],l['line'])
  else:
    r['also']='vocab_all.js[%s]'%e['key']
  rows.append(r)
json.dump(rows,open(D+'master.json','w'),ensure_ascii=False,indent=1)
with open(D+'master.tsv','w') as f:
  for r in rows:
    f.write('\t'.join(str(x) for x in [r['id'],r['island'],r['line'],r['en'],r['pn'],r['cn'],r['ex'],r['exCn'],r['emojiText'] if r['emojiKind']=='emoji' else r['emojiKind']+':'+'|'.join(r['svgText'])])+'\n')
print(len(rows))
# duplicates
by=collections.defaultdict(list)
for r in rows: by[r['en'].lower()].append(r)
d=[(k,v) for k,v in by.items() if len(v)>1]
print('dup words',len(d))
for k,v in d:
  print('DUP',k)
  for r in v: print('   ',r['island'],r['line'],r['pn'],r['cn'],'|',r['ex'],'|',r['exCn'])
