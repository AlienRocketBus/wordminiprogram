#!/usr/bin/env python3
# 组装《新Boss特效工坊》—— 29个boss全部可点可放可调
import os, base64, io, json
from PIL import Image

ROOT='/home/claude/newboss'
# (包, 文件夹, 显示名, 特效函数名, 等级, 一句话)
BOSSES=[
 ('b1','万典之灵 · 未被写下的故事','万典之灵·未被写下的故事','fxWandian','Lv25','稿纸风暴·墨字符文·删除线终结'),
 ('b1','不动明王 焚天镇狱尊','不动明王·焚天镇狱尊','fxMingwang','Lv22','烈阳法轮·六臂金焰杵剑·焚天镇狱'),
 ('b1','亡灵咒术师 · 阿努比斯之影','亡灵咒术师·阿努比斯之影','fxAnubis','Lv24','银蓝冷焰·引魂丝·灵魂剥离'),
 ('b1','古埃及大祭司 · 真理之口的裁决者','古埃及大祭司·真理之口的裁决者','fxDajisi','Lv25','黄金天平·称量扫描·有罪判决'),
 ('b1','夜罗刹 · 红莲战鬼','夜罗刹·红莲战鬼','fxYecha','Lv22','血月·业火四连爪·红莲爆'),
 ('b1','天界守护者 · 黄金斯芬克斯','天界守护者·黄金斯芬克斯','fxSphinx','Lv22','太阳金翼·符文环·日轮审判'),
 ('b1','未成形之神 · 万形之胚','未成形之神·万形之胚','fxWanxing','Lv25','形态流变·丝线编织·万形归一'),
 ('b1','法老王 · 不朽金身','法老王·不朽金身','fxFalao','Lv26','权杖铭文·金箔风暴·圣甲虫·诅咒爆'),
 ('b1','破坏神','破坏神·终焉之相','fxPohuai','Lv25','空间震颤·棱线金电·终焉湮灭'),
 ('b1','虫群先锋 · 刃翼领主','虫群先锋·刃翼领主','fxRenyi','Lv14','毒矛三连·翼刃俯冲·虫群涌来'),
 ('b1','诅咒之躯 · 绷带亡骸','诅咒之躯·绷带亡骸','fxBengdai','Lv13','绷带触手·护符印记·巨手擒抱'),
 ('b1','逆相之影 · 镜渊领主','逆相之影·镜渊领主','fxJingyuan','Lv21','镜片阵列·镜渊光束·万镜归渊'),
 ('b2','万械之神 · 奥米伽','万械之神·奥米伽','fxOmega','Lv28','六眼锁定·机械触手海·核心巨激光'),
 ('b2','丛林幽灵 · 兵王','丛林幽灵·兵王','fxBingwang','Lv28','烟雾弹·狙击红线·闪光军刀·齐爆'),
 ('b2','决斗大师 · 千招之约','决斗大师·千招之约','fxJuedou','Lv23','决斗圈·拳肘连段·千招乱舞·正拳'),
 ('b2','凋零与新生之龙 · 四季轮转的守护者','凋零与新生之龙·四季轮转','fxSijilong','Lv26','春樱→夏炎→秋叶→冬雪 四季轮转'),
 ('b2','剑神 万箭齐发','剑神·万剑归宗','fxJianshen','Lv26','剑冢升剑·飞剑连射·万剑归宗'),
 ('b2','天启征服者 · 索拉里斯','天启征服者·索拉里斯','fxSuolaris','Lv27','六色创世符文·现实涟漪·天启重置'),
 ('b2','影守 · 永夜之壁','影守·永夜之壁','fxYingshou','Lv24','火光熄灭·阴影之手·永夜千手'),
 ('b2','星核泰坦 · 虚空造物主','星核泰坦·虚空造物主','fxTaitan','Lv28','回收吸入·矿石巨锤·废料风暴·过载'),
 ('b2','月亮女神','月之引航者·寂静潮汐','fxYueshen','Lv23','新月悬起·银潮·月光刃·满月引潮'),
 ('b2','混沌之种 · 万象侵蚀者','混沌之种·万象侵蚀者','fxHundun','Lv29','混沌之海·触须八方·同化·吞噬漩涡'),
 ('b2','火柴人 · 原初线条','火柴人·原初线条','fxHuochairen','Lv25','手绘画圈·画剑成真·涂鸦·橡皮擦除'),
 ('b2','画壁判官 · 墨渊','画壁判官·墨渊','fxMoyuan','Lv27','战术网格·锁定弹道·墨蛇·判决落笔'),
 ('b2','破晓仲裁者 · 索拉里斯','破晓仲裁者·索拉里斯','fxZhongcai','Lv25','审判之环·法典三判·金锁链·宝珠收押'),
 ('b2','苍穹守卫 · 阿尔基昂','苍穹守卫·阿尔基昂','fxCangqiong','Lv30','天空降临·音爆冲刺·热视线·脉冲星爆'),
 ('b2','量子观测者 · 阿尔戈','量子观测者·阿尔戈','fxLiangzi','Lv30','波函数·概率分身·观测坍缩·概率抹除'),
 ('b2','银翼 · 麻烦终结者','银翼·麻烦终结者','fxYinyi','Lv1','擦枪上膛·点射·三模式切换·银色风暴'),
 ('b2','魔皇 · 小丑至尊','魔皇·小丑至尊','fxMohuang','Lv30','四魔剑扇展·光弧斩·齐射·死亡之网'),
 ('b3','starmaker series/level 1 暗影先锋 · 破阵者','暗影先锋·破阵者','fxPozhen','Lv8','目镜锁定·卡宾点射·肩撞·双匕收割'),
 ('b3','starmaker series/level 2 武器大师 · 战争铁砧','武器大师·战争铁砧','fxTiezhan','Lv15','架盾机枪·六联导弹·军刀·全武库殉爆'),
 ('b3','starmaker series/level 3 星陨武士 · 流亡之刃','星陨武士·流亡之刃','fxLiuwang','Lv12','光刃·斗篷残影错位·剑之对话·居合一闪'),
 ('b3','starmaker series/level 4 机械主教 · 组装者','机械主教·组装者','fxZuzhuang','Lv10','独眼扫描·切割冲压·流水线出兵·清理协议'),
 ('b3','starmaker series/level 5 活体行星 古老意志','活体行星·古老意志','fxGuyi','Lv25','行星苏醒·引力波·记忆金丝·坍缩超新星'),
]

def img_b64(pkg,folder):
    d=os.path.join(ROOT,pkg,folder)
    fs=os.listdir(d)
    pngs=[f for f in fs if f.lower().endswith('.png')]
    pr=[f for f in pngs if 'Photoroom' in f]
    fp=os.path.join(d,(pr or pngs)[0])
    im=Image.open(fp).convert('RGBA')
    H=380
    w=int(im.width*H/im.height)
    im=im.resize((w,H),Image.LANCZOS)
    im=im.quantize(colors=128,method=Image.FASTOCTREE,dither=Image.NONE).convert('RGBA')
    im2=im.quantize(colors=128)
    buf=io.BytesIO(); im2.save(buf,'PNG',optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode(), w

imgs=[]; total=0
for pkg,folder,nm,fn,lv,desc in BOSSES:
    b64,w=img_b64(pkg,folder)
    imgs.append(b64); total+=len(b64)
    print(f'  {nm[:14]:16s} {len(b64)//1024}KB')
print(f'图片总计 {total//1024//1024}.{total//1024%1024//103}MB')

js_core=open(os.path.join(ROOT,'fx_core.js'),encoding='utf-8').read()
js_all=''.join(open(os.path.join(ROOT,f'fx_batch{i}.js'),encoding='utf-8').read()+'\n' for i in range(1,6))
js_all+=open(os.path.join(ROOT,'fx_v2a.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v2b.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v3.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v4a.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v4b.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v5.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v6a.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v6b.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'fx_v7.js'),encoding='utf-8').read()

reg=json.dumps([{'nm':b[2],'fn':b[3],'lv':b[4],'desc':b[5]} for b in BOSSES],ensure_ascii=False)
imgs_js=json.dumps(imgs)

html='''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">\n<link rel="icon" href="data:,">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>新Boss特效工坊 · 29员大将</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:linear-gradient(180deg,#07070f,#101024 55%,#0a0a18);color:#eef;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;min-height:100vh;padding-bottom:60px}
.hd{padding:16px 14px 8px;text-align:center}
.hd h1{font-size:19px;background:linear-gradient(90deg,#ffd76a,#ff8a5c,#c78aff);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900}
.hd p{font-size:11px;color:#8890b8;margin-top:4px}
.grpTitle{font-size:12px;color:#ffd76a;font-weight:800;padding:12px 14px 6px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 10px}
.cell{background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.13);border-radius:11px;padding:5px 3px 6px;text-align:center;cursor:pointer;transition:transform .12s,border-color .2s}
.cell:active{transform:scale(0.94)}
.cell.cur{border-color:#ffd76a;background:rgba(255,215,106,0.1);box-shadow:0 0 12px rgba(255,215,106,0.35)}
.cell img{height:52px;max-width:100%;object-fit:contain;display:block;margin:0 auto 3px}
.cell .nm{font-size:9px;font-weight:700;color:#dde;line-height:1.2;height:22px;overflow:hidden}
.cell .lv{font-size:8px;color:#ffb86a;font-weight:800}
#stageWrap{position:relative;margin:12px 10px;border-radius:18px;background:radial-gradient(ellipse at 50% 26%,#232349,#0d0d20 70%);border:1px solid rgba(255,255,255,0.12);overflow:hidden}
#stage{position:relative;height:560px}
#bossBox{position:absolute;top:26px;left:50%;transform:translateX(-50%);text-align:center;width:100%}
#bossSprite{height:225px;max-width:82vw;object-fit:contain;filter:drop-shadow(0 10px 26px rgba(0,0,0,0.6))}
#bossNm{font-size:14px;font-weight:900;color:#ffe9b0;text-shadow:0 2px 8px rgba(0,0,0,.7);margin-top:2px}
#bossDesc{font-size:10px;color:#a8b0d8;margin-top:2px}
#hpWrap{position:absolute;top:305px;left:50%;transform:translateX(-50%);width:250px}
#hpBar{height:15px;background:#1c2138;border:2px solid rgba(255,255,255,0.25);border-radius:9px;overflow:hidden}
#hpFill{height:100%;width:100%;background:linear-gradient(90deg,#ff5d5d,#ffb54d);transition:width .35s}
#hpTxt{text-align:center;font-size:10px;color:#ccd2f0;margin-top:2px;font-weight:700}
#heroCard{position:absolute;top:352px;left:50%;transform:translateX(-50%);width:82%;max-width:330px;height:150px;background:rgba(255,255,255,0.07);border:1.5px solid rgba(255,255,255,0.16);border-radius:15px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}
#heroFace{font-size:42px;transition:transform .15s}
#heroCard .tip{font-size:11px;color:#9aa2c8;font-weight:700}
#heroCard.hit{animation:hcHit .4s}
@keyframes hcHit{0%,100%{background:rgba(255,255,255,0.07)}30%{background:rgba(255,80,80,0.28)}}
#ctrls{padding:4px 14px 8px}
.row{display:flex;align-items:center;gap:9px;margin:7px 0}
.row label{font-size:11px;color:#ffd76a;font-weight:800;width:76px;flex-shrink:0}
.row input[type=range]{flex:1;accent-color:#ffd76a;height:22px}
.row .val{font-size:11px;color:#fff;font-weight:800;width:36px;text-align:right}
#playBtn{display:block;width:calc(100% - 28px);margin:6px 14px;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#ffd76a,#ff8a5c);color:#231a08;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 5px 18px rgba(255,160,80,0.4)}
#playBtn:active{transform:scale(0.97)}
#resetBtn{display:block;margin:0 auto 8px;padding:7px 20px;border:1.5px solid rgba(255,255,255,0.3);border-radius:10px;background:transparent;color:#aab;font-size:12px;font-weight:700;cursor:pointer}
</style></head><body>
<div class="hd"><h1>⚔️ 新Boss特效工坊 · 29员大将</h1><p>按人设量身打造 · 实体武器/造物 · 四幕运镜 · 点谁看谁 · 可调大小/速度/强度</p></div>

<div class="grpTitle">📦 第一包(12)</div>
<div class="grid" id="grid1"></div>
<div class="grpTitle">📦 第二包(17)</div>
<div class="grid" id="grid2"></div>
<div class="grpTitle">⭐ 铸星者系列 · 第一星域五守卫(5)</div>
<div class="grid" id="grid3"></div>

<div id="stageWrap"><div id="stage">
  <div id="bossBox"><img id="bossSprite" src=""><div id="bossNm"></div><div id="bossDesc"></div></div>
  <div id="hpWrap"><div id="hpBar"><div id="hpFill"></div></div><div id="hpTxt">勇者 HP 100/100</div></div>
  <div id="heroCard"><div id="heroFace">🦸</div><div class="tip">答题区示意 —— 特效不会侵入这里</div></div>
</div></div>

<button id="playBtn">▶ 释放攻击特效</button>
<div id="ctrls">
  <div class="row"><label>尺寸 sz</label><input type="range" id="rgSz" min="0.6" max="1.6" step="0.05" value="1"><span class="val" id="vSz">1.00</span></div>
  <div class="row"><label>速度 sp</label><input type="range" id="rgSp" min="0.6" max="1.6" step="0.05" value="1"><span class="val" id="vSp">1.00</span></div>
  <div class="row"><label>强度 fxi</label><input type="range" id="rgFxi" min="0.6" max="1.6" step="0.05" value="1"><span class="val" id="vFxi">1.00</span></div>
</div>
<button id="resetBtn">↺ 恢复默认参数</button>

<script>
/* localStorage shim(防隐私模式报错) */
try{localStorage.getItem('x');}catch(e){window.localStorage={_d:{},getItem:function(k){return this._d[k]||null;},setItem:function(k,v){this._d[k]=String(v);},removeItem:function(k){delete this._d[k];}};}
window.__hansenFxLayer=document.getElementById('stage')?null:null; /* 用全屏canvas */
__JS_CORE__
__JS_FX__
var REG=__REG__;
var IMGS=__IMGS__;
var cur=0, HP=100, playing=false;
var SZ=1,SP=1,FXI=1;
function $(id){return document.getElementById(id);}
function build(){
  var g1=$('grid1'),g2=$('grid2'),g3=$('grid3');
  REG.forEach(function(b,i){
    var c=document.createElement('div'); c.className='cell'+(i===0?' cur':''); c.id='cell'+i;
    c.innerHTML='<img src="'+IMGS[i]+'"><div class="nm">'+b.nm.split('·')[1]||b.nm+'</div><div class="lv">'+b.lv+'</div>';
    c.querySelector('.nm').textContent=(b.nm.indexOf('·')>=0?b.nm.split('·')[1]:b.nm);
    c.onclick=function(){ select(i); };
    (i<12?g1:(i<29?g2:g3)).appendChild(c);
  });
  select(0);
}
function select(i){
  cur=i;
  document.querySelectorAll('.cell').forEach(function(c,j){ c.className='cell'+(j===i?' cur':''); });
  $('bossSprite').src=IMGS[i];
  $('bossNm').textContent=REG[i].nm+'  '+REG[i].lv;
  $('bossDesc').textContent=REG[i].desc;
  HP=100; upHP();
  $('stageWrap').scrollIntoView({behavior:'smooth',block:'center'});
}
function upHP(){ $('hpFill').style.width=HP+'%'; $('hpTxt').textContent='勇者 HP '+HP+'/100'; }
function hit(){
  HP=Math.max(0,HP-18); upHP();
  var hc=$('heroCard'); hc.classList.remove('hit'); void hc.offsetWidth; hc.classList.add('hit');
  $('heroFace').style.transform='scale(0.86)';
  setTimeout(function(){ $('heroFace').style.transform=''; },200);
  if(HP<=0){ setTimeout(function(){ HP=100; upHP(); },900); }
}
$('playBtn').onclick=function(){
  if(playing)return; playing=true;
  var pb=$('playBtn'); pb.style.opacity='0.45'; pb.textContent='⚔️ 特效播放中…';
  setTimeout(function(){ playing=false; pb.style.opacity='1'; pb.textContent='▶ 释放攻击特效'; },4800);
  var b=REG[cur];
  var fn=window[b.fn];
  var bsEl=$('bossSprite');
  var hc=$('heroCard').getBoundingClientRect();
  var hp=$('hpBar').getBoundingClientRect();
  var hx=hc.left+hc.width/2;
  var midY=hc.top+hc.height/2;
  var barL=hp.left, barW=hp.width;
  var barBot=hc.bottom;
  try{ fn(bsEl,hx,barL,barW,midY,barBot,{sz:SZ,sp:SP,fxi:FXI,dealDelay:2600},hit); }
  catch(e){ console.error(e); }
};
function bindRange(id,vid,set){ var r=$(id);
  r.oninput=function(){ set(parseFloat(r.value)); $(vid).textContent=parseFloat(r.value).toFixed(2); }; }
bindRange('rgSz','vSz',function(v){SZ=v;});
bindRange('rgSp','vSp',function(v){SP=v;});
bindRange('rgFxi','vFxi',function(v){FXI=v;});
$('resetBtn').onclick=function(){ SZ=SP=FXI=1;
  $('rgSz').value=$('rgSp').value=$('rgFxi').value=1;
  $('vSz').textContent=$('vSp').textContent=$('vFxi').textContent='1.00'; };
build();
</script></body></html>'''

html=html.replace('__JS_CORE__',js_core).replace('__JS_FX__',js_all).replace('__REG__',reg).replace('__IMGS__',imgs_js)
out='/mnt/user-data/outputs/新Boss特效工坊.html'
open(out,'w',encoding='utf-8').write(html)
print('✅ 工坊生成:',out, f'{os.path.getsize(out)//1024//1024}.{os.path.getsize(out)//1024%1024//103}MB')
