import sys, io, base64
from PIL import Image
name, imgpath, title, sub, outfile = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
im=Image.open(imgpath).convert('RGBA')
h=440; w=int(im.width*h/im.height); im=im.resize((w,h))
buf=io.BytesIO(); im.save(buf,'PNG'); b64=base64.b64encode(buf.getvalue()).decode()
disp_h=228; disp_w=int(w*disp_h/h)
if disp_w>286:
    disp_w=286; disp_h=int(h*disp_w/w)
js=open('hansen_boss_attack.js',encoding='utf-8').read()
tpl='''<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__TITLE__</title><style>
html,body{margin:0;background:#05070c;font-family:sans-serif}#top{color:#cfe;text-align:center;padding:10px;font-size:14px}#top b{color:#ffc23a}
#stage{position:relative;width:420px;height:720px;margin:0 auto;background:linear-gradient(#0e1420,#080c14);overflow:hidden;border-radius:10px}
#bossSprite{position:absolute;left:50%;top:44px;height:__DH__px;width:__DW__px;transform:translateX(-50%);object-fit:contain;filter:drop-shadow(0 8px 26px rgba(0,0,0,.6))}
.hero-section{position:absolute;left:0;right:0;top:410px;bottom:0}.hero-hp-bar{position:absolute;left:40px;top:44px;width:340px;height:13px;background:#2a2f3a;border-radius:7px;overflow:hidden}
#heroHPFill{width:100%;height:100%;background:linear-gradient(#4ade80,#22c55e);transition:width .25s}#heroHPText{position:absolute;left:40px;top:20px;color:#cfe;font-size:12px}
.answer{position:absolute;left:20px;right:20px;top:96px;bottom:22px;background:#131b28;border:1px solid #223047;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#3a4a63;font-size:13px}
#btn{display:block;margin:12px auto;padding:11px 30px;background:linear-gradient(135deg,#ff8a3a,#e85d2a);color:#fff;border:none;border-radius:22px;font-size:15px;font-weight:bold;cursor:pointer}</style></head><body>
<div id="top">__TITLE__<br><span style="font-size:12px;color:#8a9bb0">__SUB__</span></div>
<div id="stage"><img id="bossSprite" src="data:image/png;base64,__B64__" alt="">
<div class="hero-section"><div id="heroHPText">HP 100 / 100</div><div class="hero-hp-bar"><div id="heroHPFill"></div></div><div class="answer">答题区(特效严禁侵入)</div></div></div>
<button id="btn">▶ 重新播放</button><script>__JS__</script><script>
try{localStorage.setItem('hansen_bossfx_on','1');}catch(e){}
window.HansenHeroHit=function(dmg,newHP,mHP){var f=document.getElementById('heroHPFill'),tx=document.getElementById('heroHPText');var pct=Math.max(0,newHP/mHP*100);if(f)f.style.width=pct+'%';if(tx)tx.textContent='HP '+newHP+' / '+mHP;};
function play(){var f=document.getElementById('heroHPFill');if(f)f.style.width='100%';var tx=document.getElementById('heroHPText');if(tx)tx.textContent='HP 100 / 100';window.HansenBossAttack({name:'__NAME__'},20,80,100);}
document.getElementById('btn').onclick=play;</script></body></html>'''
html=tpl.replace('__DH__',str(disp_h)).replace('__DW__',str(disp_w)).replace('__TITLE__',title).replace('__SUB__',sub).replace('__NAME__',name).replace('__B64__',b64).replace('__JS__',js)
open(outfile,'w',encoding='utf-8').write(html)
print('ok',outfile,'显示',disp_w,'x',disp_h)
