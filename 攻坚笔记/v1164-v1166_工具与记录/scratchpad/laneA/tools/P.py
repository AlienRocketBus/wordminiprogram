# 小工具：对两个母版做精确替换（每处必须命中指定次数，否则整体不写）
import sys, os
WT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt'
T = os.path.join(WT, 'template.html')
L = os.path.join(WT, 'land_template.html')
BOTH = (T, L)
_buf = {}
def _get(f):
    if f not in _buf:
        _buf[f] = open(f, encoding='utf-8').read()
    return _buf[f]
def rep(files, old, new, count=1):
    if isinstance(files, str): files = (files,)
    for f in files:
        s = _get(f)
        n = s.count(old)
        if n != count:
            raise SystemExit('❌ %s: expected %d match(es), got %d for:\n%s' % (os.path.basename(f), count, n, old[:300]))
        _buf[f] = s.replace(old, new)
def has(f, s): return s in _get(f)
def commit():
    for f, s in _buf.items():
        open(f, 'w', encoding='utf-8').write(s)
    print('✅ written:', ', '.join(os.path.basename(f) for f in _buf))
