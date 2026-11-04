import glob, hashlib, os, sys
def fingerprint(ROOT):   # copied verbatim from 分批跑测试.py fingerprint()
    h = hashlib.sha256()
    srcs = []
    for pat in ('hansen_*.js', 'sw_*.js', 'test_*.mjs', 'template.html', '*.py'):
        srcs += glob.glob(os.path.join(ROOT, pat))
    for f in sorted(set(srcs)):
        try:
            h.update(os.path.basename(f).encode())
            h.update(open(f, 'rb').read())
        except Exception:
            pass
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        try:
            h.update(os.path.basename(f).encode())
            h.update(str(os.path.getsize(f)).encode())
        except Exception:
            pass
    return h.hexdigest()[:16]
for d in sys.argv[1:]:
    e = open(os.path.join(d,'cloudbase_emulator.mjs'),'rb').read()
    print(fingerprint(d), hashlib.sha256(e).hexdigest()[:12], d)
