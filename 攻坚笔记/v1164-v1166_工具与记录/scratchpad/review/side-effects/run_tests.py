import subprocess, sys, time, os, json, concurrent.futures as cf
ROOT='/home/claude/work/repo'
OUT=sys.argv[2]
os.makedirs(OUT, exist_ok=True)
tests=[l.strip() for l in open(sys.argv[1]) if l.strip()]
par=int(os.environ.get('PAR','2'))
env=dict(os.environ, HANSEN_PLAYWRIGHT_MODULE='/opt/node22/lib/node_modules/playwright/index.mjs')
def run(t):
    t0=time.time()
    lim=900 if '_cloud_v1164' in t else 420
    try:
        r=subprocess.run(['node', os.path.join(ROOT,t)], cwd=ROOT, capture_output=True, timeout=lim, env=env)
        rc=r.returncode; out=(r.stdout or b'').decode('utf-8','replace')+(r.stderr or b'').decode('utf-8','replace')
    except subprocess.TimeoutExpired as e:
        rc='TIMEOUT'; out=((e.stdout or b'').decode('utf-8','replace') if e.stdout else '')+'\n[TIMEOUT]'
    open(os.path.join(OUT,t+'.log'),'w').write(out)
    return t, rc, round(time.time()-t0)
res={}
with cf.ThreadPoolExecutor(par) as ex:
    for t,rc,s in ex.map(run, tests):
        res[t]=(rc,s); print(('PASS' if rc==0 else 'FAIL'), rc, s, t, flush=True)
json.dump(res, open(os.path.join(OUT,'_summary.json'),'w'), indent=1)
print('fails:', [t for t,(rc,s) in res.items() if rc!=0])
