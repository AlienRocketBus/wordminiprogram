# Contrast of each text run vs. the real pixels under it (text-hidden screenshot). Prints JSON summary.
import json, sys, re
from PIL import Image
els = json.load(open(sys.argv[1])); bg = Image.open(sys.argv[2]).convert('RGB'); W, H = bg.size
DPR = W / 390.0 if W > 390 else 1.0
px = bg.load()
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
    fc = parse(e['fill']) if e['fill'] and parse(e['fill']) and parse(e['fill'])[3] > 0 else parse(e['color'])
    if e['clipText'] or not fc or fc[3] == 0:
        res.append(dict(e, ratio=None, note='gradient/transparent text')); continue
    x0, y0, x1, y1 = [int(round(v * DPR)) for v in (e['x0'], e['y0'], e['x1'], e['y1'])]
    x1 = min(W - 1, x1); y1 = min(H - 1, y1)
    if x1 - x0 < 2 or y1 - y0 < 2: continue
    step = max(1, int(((x1 - x0) * (y1 - y0) / 4000) ** 0.5))
    samples = [px[x, y] for y in range(y0, y1, step) for x in range(x0, x1, step)]
    if not samples: continue
    samples.sort(key=lambda p: L(p))
    med = samples[len(samples) // 2]
    alpha = fc[3] * e['op']
    def comp(b): return [fc[i] * alpha + b[i] * (1 - alpha) for i in range(3)]
    r_med = cr(comp(med), med)
    # worst 10% of background pixels (images/gradients under the text)
    ratios = sorted(cr(comp(s), s) for s in samples[:: max(1, len(samples) // 200)])
    r_p10 = ratios[max(0, len(ratios) // 10)]
    large = e['size'] >= 24 or (e['size'] >= 18.66 and e['weight'] >= 700)
    need = 3.0 if large else 4.5
    res.append(dict(e, bg='#%02x%02x%02x' % tuple(med), fg='#%02x%02x%02x' % tuple(int(v) for v in comp(med)), ratio=round(r_med, 2), p10=round(r_p10, 2), large=large, need=need, fail=r_med < need))
meas = [r for r in res if r.get('ratio') is not None and r.get('onTop')]
fails = sorted([r for r in meas if r['fail']], key=lambda r: r['ratio'])
summ = dict(n=len(meas), fail=len(fails), gradientText=len([r for r in res if r.get('note')]),
            minRatio=min([r['ratio'] for r in meas], default=None),
            worst=[{k: r[k] for k in ('text', 'path', 'size', 'weight', 'fg', 'bg', 'ratio', 'p10', 'need', 'shadow', 'font')} for r in fails[:25]],
            fonts=sorted(set(r['font'] for r in meas)))
print(json.dumps(dict(summary=summ, all=meas), ensure_ascii=False))
