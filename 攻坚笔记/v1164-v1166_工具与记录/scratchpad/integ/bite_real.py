import sys, importlib.util
R='/home/user/wordminiprogram/'
spec = importlib.util.spec_from_file_location('g', R+'hansen_guards_v1068.py'); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
spec2 = importlib.util.spec_from_file_location('st', R+'jarvis_selftest.py'); st = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(st)
guards = dict(g.GUARDS)
want = set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None
real = g._read
allok = True
for name, target, inj in st.CASES:
    if want and name not in want: continue
    fn = guards.get(name)
    if not fn: print('NO GUARD', name); allok=False; continue
    g.PROBLEMS.clear(); fn(); base = [p for p in g.PROBLEMS if p[0]==name]
    orig = real(target)
    hurt = inj(orig)
    if hurt is None or hurt == orig: print('SKIP', name); allok=False; continue
    g._read = lambda n, t=target, h=hurt: h if n == t else real(n)
    g.PROBLEMS.clear()
    try: fn()
    except Exception as e: g.PROBLEMS.append((name, 'EXC %s' % e))
    g._read = real
    red = [p for p in g.PROBLEMS if p[0]==name]
    ok = not base and bool(red); allok &= ok
    print(('BITES ' if ok else 'FAIL  ')+name, (red[:1] if not ok else ''), base[:1])
print('ALL OK' if allok else 'SOME FAILED')
