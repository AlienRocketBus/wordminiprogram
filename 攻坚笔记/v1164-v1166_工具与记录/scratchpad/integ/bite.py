import sys, importlib.util, os
sys.path.insert(0,'/home/user/wordminiprogram')
gpath = sys.argv[1]
spec = importlib.util.spec_from_file_location('g', gpath)
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
if len(sys.argv) > 2 and sys.argv[2] != '-':
    exec(compile(open(sys.argv[2],encoding='utf-8').read(), 'ng', 'exec'), g.__dict__)
ns = {}
exec(compile(open(sys.argv[3] if len(sys.argv)>3 else 'new_samples.py',encoding='utf-8').read(), 'ns', 'exec'), ns)
real_read = g._read
allok = True
for name, target, inj, fn in ns['NEW_CASES']:
    guard = g.__dict__[fn]
    g.PROBLEMS.clear(); guard(); base = list(g.PROBLEMS)
    orig = real_read(target)
    hurt = inj(orig)
    if hurt is None or hurt == orig:
        print('SKIP (anchor missing)', name); allok = False; continue
    g._read = lambda n, t=target, h=hurt: h if n == t else real_read(n)
    g.PROBLEMS.clear(); guard(); red = [p for p in g.PROBLEMS if p[0] == name]
    g._read = real_read
    ok = (not base) and bool(red)
    allok &= ok
    print(('BITES ' if ok else 'FAIL  ') + name, '| base=', base[:1], '| injected=', [p[1][:70] for p in red[:1]])
print('ALL OK' if allok else 'SOME FAILED')
