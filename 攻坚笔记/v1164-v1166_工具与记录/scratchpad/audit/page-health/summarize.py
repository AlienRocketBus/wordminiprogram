import json, sys, collections
rows = [json.loads(l) for l in open(sys.argv[1] if len(sys.argv) > 1 else 'results.jsonl')]
print('%-40s %4s %5s %4s %4s %4s %4s %5s %6s %7s %6s %5s %5s %3s %s' % ('page', 'W', 'cons', 'pe', 'rej', 'bad', 'ext', 'reqs', 'MB', 'dcl', 'load', 'sw', 'cut', 'fr', 'notes'))
agg = collections.Counter()
for r in rows:
    ph = r.get('ph') or {}
    frame_err = []
    for f in r.get('frames', []):
        p = f.get('ph') or {}
        for k in ('rej', 'winErr', 'resErr'):
            for e in (p.get(k) or []):
                frame_err.append((f['url'], k, e[:120]))
    rej = len(ph.get('rej', [])) + sum(1 for x in frame_err if x[1] == 'rej')
    notes = []
    if r.get('gotoError'): notes.append('GOTO:' + r['gotoError'][:60])
    if r.get('dialogs'): notes.append('dialogs:' + ';'.join(r['dialogs'])[:100])
    if ph.get('resErr'): notes.append('resErr:' + ';'.join(ph['resErr'])[:120])
    if ph.get('winErr'): notes.append('winErr:' + ';'.join(ph['winErr'])[:120])
    if frame_err: notes.append('frameErr:' + str(frame_err[:3])[:200])
    print('%-40s %4d %5d %4d %4d %4d %4d %5d %6.2f %7d %6d %5d %5d %3d %s' % (r['page'][:40], r['width'], len(r['console']), len(r['pageerrors']), rej, len(r['bad']), len(r['ext']), r['reqs'], r['bytes'] / 1e6, r.get('dcl', 0), r.get('load', 0), r.get('scrollW', 0), r.get('cutCount', 0), len(r.get('frames', [])), ' | '.join(notes)))
print()
for r in rows:
    if r['console'] or r['pageerrors'] or r['bad'] or r['failed'] or r['ext']:
        print('DETAIL', r['page'], r['width'], 'console=', r['console'][:6], 'pe=', r['pageerrors'][:3], 'bad=', r['bad'][:6], 'failed=', r['failed'][:6], 'ext=', r['ext'][:6])
for r in rows:
    if r.get('cutCount'):
        print('CUT', r['page'], r['width'], [(c['kind'], c['el'], c['clipBy'], c['left'], c['right'], c['text']) for c in r['cut'][:8]])
for r in rows:
    if r.get('scrollW', 0) > r['width']:
        print('HSCROLL', r['page'], r['width'], 'scrollW', r['scrollW'], 'overflowX', r.get('overflowX'))
