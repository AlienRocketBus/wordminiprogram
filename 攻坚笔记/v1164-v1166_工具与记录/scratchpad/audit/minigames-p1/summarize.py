import json, glob, re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
files = sys.argv[1:] or sorted(glob.glob(D+'/res_*_390.json'))
EXT = re.compile(r'tcb-api\.tencentcloudapi|tcloudbase|ERR_FAILED')
for f in files:
    r = json.load(open(f))
    print('='*100)
    print(r.get('island'), 'total', round(r.get('totalMs',0)/1000), 's  openMs', r.get('openMs'), 'fatal' if r.get('fatal') else '', r.get('fatal','')[:300])
    print('  notes:', r.get('notes'))
    print('  welcome:', (r.get('welcome') or '')[:120])
    print('  homeOverflow:', r.get('homeOverflow'))
    print('  ext:', r.get('ext'), r.get('extCount'))
    for e in r.get('allEvents', []):
        if EXT.search(e.get('text','')+str(e.get('loc',''))): continue
        print('  [boot-ev]', e)
    for g, v in (r.get('games') or {}).items():
        print('-- %s (%ss) delta=%s' % (g, round(v.get('ms',0)/1000), v.get('delta')))
        for n in v.get('notes', []): print('     note:', n[:400])
        for k in ('played','result','levelText','setup','totalQ','kbLayout','kbBottom','text','afterDraw','over','resPanel'):
            if k in v: print('     %s: %s' % (k, json.dumps(v[k], ensure_ascii=False)[:600]))
        for k in ('overflow','resultOverflow','modalOverflow'):
            if k in v and v[k] and (v[k].get('docOverflow') or v[k].get('items')): print('     %s: %s' % (k, json.dumps(v[k], ensure_ascii=False)[:500]))
        evs = [e for e in v.get('events', []) if not EXT.search(e.get('text','')+str(e.get('loc','')))]
        for e in evs[:8]: print('     EV', json.dumps(e, ensure_ascii=False)[:400])
        if len(evs) > 8: print('     ... %d more events' % (len(evs)-8))
    print('  end:', r.get('end'))
