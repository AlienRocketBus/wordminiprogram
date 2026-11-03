# 每段文字 vs. 它下面真实像素（隐藏文字后的截图）的 WCAG 对比度。用法: contrast.py els.json bg.png fg.png DPR
import json, sys, re
from PIL import Image
els = json.load(open(sys.argv[1])); bg = Image.open(sys.argv[2]).convert('RGB'); DPR = float(sys.argv[4]); W, H = bg.size; px = bg.load()
def parse(c):
    m = re.match(r'rgba?\(([^)]+)\)', c or '')
    if not m: return None
    v = [float(x) for x in m.group(1).replace('/', ',').split(',') if x.strip()]
    if len(v) == 3: v.append(1.0)
    return v
def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
def L(rgb): return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
def cr(a, b):
    la, lb = L(a), L(b)
    if la < lb: la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)
res = []
for e in els:
    f = parse(e['fill']); fc = f if f and f[3] > 0 else parse(e['color'])
    if not fc or fc[3] == 0: continue
    x0, y0, x1, y1 = [int(round(v * DPR)) for v in (e['x0'], e['y0'], e['x1'], e['y1'])]
    x1 = min(W - 1, x1); y1 = min(H - 1, y1)
    if x1 - x0 < 2 or y1 - y0 < 2: continue
    step = max(1, int(((x1 - x0) * (y1 - y0) / 4000) ** 0.5))
    samples = [px[x, y] for y in range(y0, y1, step) for x in range(x0, x1, step)]
    samples.sort(key=lambda p: L(p)); med = samples[len(samples) // 2]
    a = fc[3] * e['op']
    comp = lambda b: [fc[i] * a + b[i] * (1 - a) for i in range(3)]
    r = cr(comp(med), med)
    rs = sorted(cr(comp(s), s) for s in samples[:: max(1, len(samples) // 200)]); p10 = rs[max(0, len(rs) // 10)]
    large = e['size'] >= 24 or (e['size'] >= 18.66 and e['weight'] >= 700)
    need = 3.0 if large else 4.5
    res.append(dict(text=e['text'], path=e['path'], size=e['size'], weight=e['weight'], onTop=e['onTop'], fg='#%02x%02x%02x' % tuple(int(v) for v in comp(med)), bg='#%02x%02x%02x' % tuple(med), ratio=round(r, 2), p10=round(p10, 2), large=large, need=need, fail=r < need))
meas = [r for r in res if r['onTop']]
fails = sorted([r for r in meas if r['fail']], key=lambda r: r['ratio'])
print(json.dumps(dict(n=len(meas), fail=len(fails), minRatio=min([r['ratio'] for r in meas], default=None), worst=fails[:20], all=meas), ensure_ascii=False))
