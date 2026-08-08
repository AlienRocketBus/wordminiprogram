#!/usr/bin/env python3
"""逐个跑测试并写进闸门进度文件（受限环境下分段推进）"""
import json, glob, os, subprocess, time, hashlib, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
BUDGET = int(sys.argv[1]) if len(sys.argv) > 1 else 640
def fingerprint():
    h = hashlib.sha256(); srcs = []
    for pat in ('hansen_*.js','sw_*.js','test_*.mjs','template.html','*.py'):
        srcs += glob.glob(os.path.join(ROOT, pat))
    for f in sorted(set(srcs)):
        try:
            h.update(os.path.basename(f).encode()); h.update(open(f,'rb').read())
        except Exception: pass
    for f in sorted(glob.glob(os.path.join(ROOT,'*.html'))):
        try:
            h.update(os.path.basename(f).encode()); h.update(str(os.path.getsize(f)).encode())
        except Exception: pass
    return h.hexdigest()[:16]
RES = os.path.join(ROOT, '.jarvis_resume.json')
fp = fingerprint(); data = {'fp': fp, 'done': {}}
try:
    old = json.load(open(RES, encoding='utf-8'))
    if old.get('fp') == fp: data = old
except Exception: pass
done = data['done']
allt = sorted(os.path.basename(x) for x in glob.glob(os.path.join(ROOT,'test_*.mjs')))
times = {}
try: times = json.load(open(os.path.join(ROOT,'.jarvis_time.json'), encoding='utf-8'))
except Exception: pass
left = sorted([x for x in allt if x not in done], key=lambda k: times.get(k, 10))
spent = 0
for name in left:
    if spent + times.get(name,10) > BUDGET: break
    t0 = time.time()
    try: rc = subprocess.run(['node',name],cwd=ROOT,capture_output=True,timeout=400).returncode
    except Exception: rc = 1
    el = time.time()-t0; spent += el
    done[name] = None if rc==0 else name
    times[name] = round(el,1)
    json.dump(data, open(RES,'w',encoding='utf-8'))
    json.dump(times, open(os.path.join(ROOT,'.jarvis_time.json'),'w',encoding='utf-8'))
    if rc: print(f'  XX {name}')
bad = [k for k,v in done.items() if v]
print(f'  进度 {len(done)}/{len(allt)} · 失败 {len(bad)}')
if bad: print('  ', bad[:5])
