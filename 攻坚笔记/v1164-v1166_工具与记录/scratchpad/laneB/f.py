import json,sys
d=json.load(open('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/audit/consolidated.json'))
allf={x['id']:x for x in d['confirmed']+d['uncertain']+d['refuted']}
for a in sys.argv[1:]:
    if a.startswith('MISSED#'):
        i=int(a[7:]); m=d['missed'][i]; print('=== ',a, m['dim']); print(m['text']); print()
        continue
    x=allf.get(a)
    if not x: print('NOT FOUND',a); continue
    print('=== ',a, x['title'], '|', x.get('severity'), x.get('sev2'), x.get('verdict'))
    for k in ['area','repro','observed','expected','evidence','fix','vreason']:
        if k in x: print('--',k,':', x[k] if isinstance(x[k],str) else json.dumps(x[k],ensure_ascii=False))
    print()
