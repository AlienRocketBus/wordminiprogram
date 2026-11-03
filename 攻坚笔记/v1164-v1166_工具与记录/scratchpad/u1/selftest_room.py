# 在内存里验证：房间相关的守卫样本注入后守卫必须变红（不改动共享目录里的文件）
import sys, importlib.util, os
ROOT = '/home/claude/work/repo'
sys.path.insert(0, ROOT)
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
G = load('g', os.path.join(ROOT, 'hansen_guards_v1068.py'))
S = load('s', os.path.join(ROOT, 'jarvis_selftest.py'))
orig_read = G._read
names = {}
for n in dir(G):
    if n.startswith('guard_'): names[n] = getattr(G, n)
cases = [c for c in S.CASES if c[1] == 'hansen_pk_room_v1065.js'] if hasattr(S, 'CASES') else None
if cases is None:
    # 找到列表变量
    for k, v in vars(S).items():
        if isinstance(v, list) and v and isinstance(v[0], tuple) and len(v[0]) == 3 and callable(v[0][2]):
            cases = [c for c in v if c[1] == 'hansen_pk_room_v1065.js']; break
reg = [x for x in vars(G).values() if isinstance(x, list) and x and isinstance(x[0], tuple) and len(x[0]) == 2 and callable(x[0][1])]
reg = reg[0]
by_name = {n: f for n, f in reg}
src = orig_read('hansen_pk_room_v1065.js')
for disp, fn, inj in cases:
    new = inj(src)
    if new is None or new == src:
        print('SKIP/NOOP', disp); continue
    G._read = lambda name, _n=new: _n if name == fn else orig_read(name)
    G.PROBLEMS.clear()
    g = by_name.get(disp)
    if not g: print('NO GUARD', disp); continue
    try: g()
    except Exception as e: print('ERR', disp, e)
    red = any(p[0] == disp if isinstance(p, tuple) else disp in str(p) for p in G.PROBLEMS)
    print(('BITES ' if red else 'DEAD  ') + disp)
G._read = orig_read
G.PROBLEMS.clear()
for disp, fn, inj in cases:
    g = by_name.get(disp); g and g()
print('baseline problems:', G.PROBLEMS)
