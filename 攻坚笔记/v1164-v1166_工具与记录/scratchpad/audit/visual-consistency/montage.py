import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; files=sys.argv[2:]
W,H=390,844
ims=[]
for f in files:
    im=Image.open(f).convert('RGB'); im=im.resize((W,int(im.size[1]*W/im.size[0]))); im=im.crop((0,0,W,H)); ims.append((f,im))
n=len(ims); sheet=Image.new('RGB',(W*n+8*(n-1),H+18),(255,255,255))
d=ImageDraw.Draw(sheet)
for i,(f,im) in enumerate(ims):
    sheet.paste(im,(i*(W+8),18)); d.text((i*(W+8)+2,2),f.split('/')[-1][:60],fill=(0,0,0))
sheet.save(out)
