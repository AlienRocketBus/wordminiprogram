import json, sys, re
from PIL import Image
def parse(c):
    m = re.match(r'rgba?\(([^)]+)\)', c or '')
    if not m: return None
    p = [float(x) for x in m.group(1).split(',')]
    return p + ([1.0] if len(p) == 3 else [])
def lum(c):
    def f(v):
        v /= 255
        return v/12.92 if v <= 0.03928 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2])
def cr(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb)+0.05)/(min(la, lb)+0.05)
def run(png, boxes, dpr=2):
    im = Image.open(png).convert('RGB'); W, H = im.size
    res = []
    for b in boxes:
        c = parse(b['col'])
        if not c or c[3] < 0.05: continue
        x0, y0 = int(max(0, b['x']-2)*dpr), int(max(0, b['y']-1)*dpr)
        x1, y1 = int(min(W/dpr, b['x']+b['w']+2)*dpr), int(min(H/dpr, b['y']+b['h']+1)*dpr)
        if x1-x0 < 2 or y1-y0 < 2: continue
        reg = im.crop((x0, y0, x1, y1)).resize((max(1,(x1-x0)//2), max(1,(y1-y0)//2)))
        px = list(reg.getdata())
        tc = c[:3]
        # background = pixels far from text color; take median of those
        far = [p for p in px if sum(abs(p[i]-tc[i]) for i in range(3)) > 90]
        if len(far) < len(px)*0.3: far = px
        bg = [sorted(p[i] for p in far)[len(far)//2] for i in range(3)]
        # blend text alpha
        a = c[3]; fg = [tc[i]*a + bg[i]*(1-a) for i in range(3)]
        ratio = cr(fg, bg)
        large = b['fs'] >= 24 or (b['fs'] >= 18.66 and b['fw'] >= 700)
        need = 3.0 if large else 4.5
        res.append(dict(t=b['t'], fs=b['fs'], cr=round(ratio, 2), need=need, ts=b['ts'], y=round(b['y'])))
    return res
if __name__ == '__main__':
    data = json.load(open(sys.argv[1]))
    allout = {}
    for k, v in data.items():
        r = run(v['png'], v['boxes'])
        low = [x for x in r if x['cr'] < x['need']]
        fsb = {'<12': sum(1 for x in v['boxes'] if x['fs'] < 12), '12-13.9': sum(1 for x in v['boxes'] if 12 <= x['fs'] < 14), '14-15.9': sum(1 for x in v['boxes'] if 14 <= x['fs'] < 16), '>=16': sum(1 for x in v['boxes'] if x['fs'] >= 16)}
        allout[k] = dict(n=len(r), low=len(low), fs=fsb, lowSamples=low[:10])
        print(k, 'texts', len(v['boxes']), 'fs', fsb, 'lowContrast', len(low), '/', len(r))
        for x in low[:8]: print('    ', x['t'], 'fs', x['fs'], 'cr', x['cr'], 'shadow' if x['ts'] else '')
    json.dump(allout, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
