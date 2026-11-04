# Does a screen follow the chosen palette? Pixel diff of each screen vs the default (cosmos) screenshot.
import json, glob, os, sys
from PIL import Image, ImageChops
TV = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual'
pal = ['violet', 'aurora', 'woods', 'cloud', 'sakura', 'cream', 'mint', 'coin_rainbow', 'coin_pink', 'imax_candy', 'gallery_fairy']
screens = sorted(set(os.path.basename(f)[len('m_cosmos_'):-4] for f in glob.glob(TV + '/shots/m_cosmos_*.png')))
res = {}
for s in screens:
    a = Image.open(f'{TV}/shots/m_cosmos_{s}.png').convert('RGB').resize((195, 422))
    row = {}
    for p in pal:
        f = f'{TV}/shots/m_{p}_{s}.png'
        if not os.path.exists(f): continue
        b = Image.open(f).convert('RGB').resize((195, 422))
        d = ImageChops.difference(a, b).convert('L')
        h = d.histogram(); n = sum(h)
        changed = sum(h[25:]) / n * 100
        row[p] = round(changed, 1)
    res[s] = row
json.dump(res, open(TV + '/out/honor_diff.json', 'w'), indent=1)
w = max(len(s) for s in screens)
print('% of pixels that change by >24/255 vs the same screen in default cosmos (higher = follows the theme)')
print(' ' * w, ' '.join(f'{p[:7]:>7}' for p in pal))
for s in screens:
    print(f'{s:{w}}', ' '.join(f"{res[s].get(p, float('nan')):7.1f}" for p in pal))
