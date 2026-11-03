# usage: tile.py out.png cols scale label1=path1 label2=path2 ...
import sys
from PIL import Image, ImageDraw, ImageFont
out, cols, sc = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
items = [a.split('=', 1) for a in sys.argv[4:]]
ims = []
for lab, p in items:
    try: im = Image.open(p).convert('RGB')
    except Exception: im = Image.new('RGB', (780, 1688), (128, 128, 128))
    im = im.resize((int(im.size[0] * sc), int(im.size[1] * sc)))
    ims.append((lab, im))
w = max(i.size[0] for _, i in ims); h = max(i.size[1] for _, i in ims)
rows = (len(ims) + cols - 1) // cols
pad = 22
canvas = Image.new('RGB', (cols * (w + 8), rows * (h + pad + 8)), (255, 255, 255))
d = ImageDraw.Draw(canvas)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 15)
except Exception: f = None
for k, (lab, im) in enumerate(ims):
    x = (k % cols) * (w + 8); y = (k // cols) * (h + pad + 8)
    d.text((x + 4, y + 2), lab, fill=(0, 0, 0), font=f)
    canvas.paste(im, (x, y + pad))
canvas.save(out)
print(out, canvas.size)
