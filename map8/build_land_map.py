#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_land_map.py — 生成游戏版 land_map.html
   底图=ChatGPT精美大陆图(base64); 8热区→island_landN.html;
   通关检测=hsn_landmap_cleared_N(游戏真进度·只读); 弹窗=30词+5boss名册(✓/▶/🔒);
   女帝=8/8解锁→island_season.html(hub·已打双路解锁补丁)。
"""
import json

groups=json.load(open('/home/claude/map8/groups.json',encoding='utf-8'))
ranked=json.load(open('/home/claude/map8/boss_ranked.json',encoding='utf-8'))
bg=open('/home/claude/map8/_bg.txt').read().strip()

# 组装每岛数据: 词+boss名册(去⭐)
NUM='①②③④⑤⑥⑦⑧'
data=[]
for g in groups:
    n=g['id']
    key=[k for k in ranked if k.startswith(NUM[n-1])][0]
    bosses=[b['name'].replace('⭐','') for b in ranked[key]['bosses']]
    sysname=ranked[key]['sys']
    data.append({'id':n,'name':g['name'],'theme':g['theme'],'sys':sysname,
                 'words':[{'en':w['en'],'pn':w.get('pn',''),'cn':w['cn']} for w in g['words']],
                 'bosses':bosses})
data_js=json.dumps(data,ensure_ascii=False)

html='''<!DOCTYPE html>
<!--
============================================================
  单词大冒险 © 2026 Hansen / 大冒险教育科技工作室
  Word Adventure © 2026 Hansen Studio
  版权所有, 翻版必究 ALL RIGHTS RESERVED
============================================================
-->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>单词大陆 · 冒险地图</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#1a1410}
#stage{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background-size:cover;background-position:center;overflow:hidden}
.spot{position:absolute;transform:translate(-50%,-50%);cursor:pointer;display:flex;flex-direction:column;align-items:center;transition:transform .15s cubic-bezier(.34,1.5,.5,1)}
.spot:active{transform:translate(-50%,-50%) scale(.88)}
.spot .ring{width:var(--sz);height:var(--sz);border-radius:50%;border:2.5px solid rgba(255,255,255,.55);
  box-shadow:0 0 0 3px rgba(90,60,30,.35),0 3px 10px rgba(0,0,0,.4),inset 0 0 20px rgba(255,255,255,.25);
  display:flex;align-items:center;justify-content:center;position:relative;background:rgba(255,255,255,.06)}
.spot.done .ring{border-color:#ffd24a;box-shadow:0 0 0 3px rgba(224,176,64,.5),0 0 16px rgba(255,210,74,.6),inset 0 0 20px rgba(255,220,120,.3)}
.spot .num{font-size:22px;font-weight:900;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.7)}
.spot .flag{position:absolute;top:-14px;right:-10px;font-size:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
.spot .name{margin-top:5px;font-size:12px;font-weight:800;color:#fff;background:rgba(60,44,26,.82);padding:3px 9px;border-radius:11px;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.25)}
.spot.done .name{background:rgba(60,110,40,.9);border-color:#9fe07a}
.spot .sub{margin-top:2px;font-size:9.5px;color:#ffe;background:rgba(40,30,18,.7);padding:1px 7px;border-radius:8px;white-space:nowrap}
.pulse{position:absolute;width:var(--sz);height:var(--sz);border-radius:50%;border:2px solid rgba(255,255,255,.6);animation:pl 2s ease-out infinite;pointer-events:none}
@keyframes pl{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}
#empress .ring{--sz:78px;border-color:rgba(255,220,180,.7)}
#empress.locked .ring{border-color:rgba(180,160,170,.7)}
#empress .crown{font-size:30px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
#topbar{position:absolute;top:10px;left:0;right:0;text-align:center;z-index:10;pointer-events:none}
#topbar .pt{display:inline-block;background:rgba(216,194,152,.95);border:1.5px solid #6f5a3c;border-radius:20px;padding:6px 18px;font-size:13px;color:#4a3c28;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.3)}
#backBtn{position:absolute;top:8px;left:10px;z-index:11;background:rgba(216,194,152,.95);border:1.5px solid #6f5a3c;border-radius:18px;padding:6px 13px;font-size:13px;color:#4a3c28;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
#hint{position:absolute;bottom:12px;left:0;right:0;text-align:center;font-size:12px;color:#fff;z-index:10;pointer-events:none;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.8)}
#overlay{position:fixed;inset:0;background:rgba(20,14,8,.6);display:none;align-items:center;justify-content:center;z-index:30;padding:16px}
#overlay.show{display:flex}
#panel{width:100%;max-width:340px;max-height:84%;background:#f3ecd8;border-radius:16px;border:3px solid #6f5a3c;box-shadow:0 12px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;transform:scale(.9);opacity:0;transition:.2s}
#overlay.show #panel{transform:scale(1);opacity:1}
#phead{padding:14px 16px 10px;border-bottom:2px solid #d8c8a8;position:relative;flex-shrink:0}
#phead h2{font-size:18px;color:#4a3c28;font-weight:800}
#phead .th{font-size:12px;color:#8a6f48;margin-top:3px}
#pclose{position:absolute;top:10px;right:12px;width:30px;height:30px;border:none;background:#e0d0b0;border-radius:50%;font-size:18px;color:#6f5a3c;cursor:pointer;line-height:1}
#pboss{padding:10px 14px;background:#efe4c8;flex-shrink:0;border-bottom:1px solid #d8c8a8}
#pboss .bt{font-size:12px;color:#8a5030;font-weight:800;margin-bottom:6px}
.brow{display:flex;align-items:center;gap:7px;padding:3px 2px;font-size:12px;color:#5a4630;font-weight:700}
.brow .bst{flex:0 0 18px;text-align:center}
.brow .bnm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brow.guard .bnm{color:#a03a20}
#pwords{overflow-y:auto;padding:6px 12px;flex:1;-webkit-overflow-scrolling:touch}
.wrow{display:flex;align-items:baseline;padding:7px 8px;border-bottom:1px solid #e6dcc2;gap:8px}
.wrow:last-child{border-bottom:none}
.wen{font-size:15px;font-weight:700;color:#3a3020;min-width:96px}
.wpn{font-size:11px;color:#a08858;flex:1}
.wcn{font-size:13px;color:#6a5838;text-align:right}
#pfoot{padding:12px 16px;flex-shrink:0;border-top:2px solid #d8c8a8;display:flex;gap:10px}
.pbtn{flex:1;padding:11px;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer}
.pbtn.enter{background:linear-gradient(#e0a850,#c88830);color:#fff;box-shadow:0 3px 0 #a86818}
.pbtn:active{transform:translateY(2px);box-shadow:none}
</style>
</head>
<body>
<div id="stage"></div>
<button id="backBtn" onclick="goBack()">← 返回</button>
<div id="topbar"><span class="pt" id="ptext">进度 0 / 8</span></div>
<div id="hint">点击岛屿查看单词与Boss · 顺序随意 · 全通解锁女帝</div>
<div id="overlay"><div id="panel">
  <div id="phead"><h2 id="ptitle"></h2><div class="th" id="psubtitle"></div><button id="pclose">×</button></div>
  <div id="pboss"></div><div id="pwords"></div><div id="pfoot"></div>
</div></div>
<script>window.MAP_GROUPS=__DATA__;</script>
<script>window.MAP_BG="__BG__";</script>
<script>
const G=window.MAP_GROUPS;
const NUM='①②③④⑤⑥⑦⑧';
const AR=1672/941;
function clearedN(i){ try{ return localStorage.getItem('hsn_landmap_cleared_'+i)==='1'; }catch(e){ return false; } }
function progOf(i){ try{ return parseInt(localStorage.getItem('land'+i+'_prog')||'0',10)||0; }catch(e){ return 0; } }
const POS={1:[26,20],2:[50,16],3:[74,20],8:[18,50],4:[82,50],7:[25,80],6:[50,84],5:[74,80]};

const stage=document.getElementById('stage');
(function layout(){
  const vw=window.innerWidth, vh=window.innerHeight;
  let w,h; if(vh/vw>AR){h=vh;w=vh/AR;}else{w=vw;h=vw*AR;}
  stage.style.width=w+'px';stage.style.height=h+'px';
  stage.style.backgroundImage='url('+window.MAP_BG+')';
})();
window.addEventListener('resize',function(){location.reload()});

function goIsland(n){ window.location.href='island_land'+n+'.html'; }
function goBack(){
  try{ if(window.parent&&window.parent!==window&&typeof window.parent.closeIsland==='function'){ window.parent.closeIsland(); return; } }catch(e){}
  window.location.href='index.html';
}

G.forEach(function(g){
  const n=g.id, p=POS[n], isDone=clearedN(n);
  const s=document.createElement('div');
  s.className='spot'+(isDone?' done':'');
  s.style.left=p[0]+'%'; s.style.top=p[1]+'%';
  s.style.setProperty('--sz','54px');
  s.innerHTML=(isDone?'':'<div class="pulse" style="--sz:54px"></div>')+
    '<div class="ring"><span class="num">'+NUM[n-1]+'</span>'+(isDone?'<span class="flag">🚩</span>':'')+'</div>'+
    '<div class="name">'+g.name+'</div>'+
    '<div class="sub">30词 · '+g.bosses.length+'boss</div>';
  s.onclick=function(){openIsland(n)};
  stage.appendChild(s);
});

const allDone=G.every(function(g){return clearedN(g.id)});
const em=document.createElement('div');
em.className='spot'+(allDone?'':' locked'); em.id='empress';
em.style.left='50%'; em.style.top='49%';
em.innerHTML=(allDone?'<div class="pulse" style="--sz:78px;border-color:rgba(255,210,120,.7)"></div>':'')+
  '<div class="ring"><span class="crown">'+(allDone?'👑':'🔒')+'</span></div>'+
  '<div class="name" style="'+(allDone?'background:rgba(150,50,90,.9);border-color:#f0a0c0':'background:rgba(70,60,66,.9)')+'">★ 星海女帝 ★</div>'+
  '<div class="sub">'+(allDone?'赛尔娅 · 点击挑战':'8岛全通后解锁')+'</div>';
em.onclick=openEmpress;
stage.appendChild(em);

(function updP(){ var c=0; G.forEach(function(g){if(clearedN(g.id))c++;});
  document.getElementById('ptext').textContent='进度 '+c+' / 8'+(c===8?' · 女帝已解锁!':''); })();

const overlay=document.getElementById('overlay');
function openIsland(n){
  const g=G.find(function(x){return x.id===n});
  const prog=progOf(n), done=clearedN(n);
  document.getElementById('ptitle').textContent=NUM[n-1]+' '+g.name;
  document.getElementById('psubtitle').textContent=g.theme+' · '+g.sys+' · 30 词';
  var bh='<div class="bt">⚔ 岛上盘踞的 '+g.bosses.length+' 位 Boss'+(done?' · ✅已全部击败':' · 已击败 '+Math.min(prog,g.bosses.length)+'/'+g.bosses.length)+'</div>';
  g.bosses.forEach(function(nm,i){
    var st = i<prog?'✓':(i===prog?'▶':'🔒');
    var guard=(i===g.bosses.length-1);
    bh+='<div class="brow'+(guard?' guard':'')+'"><span class="bst">'+st+'</span><span class="bnm">'+(guard?'★守关 ':'Boss'+(i+1)+' ')+nm+'</span></div>';
  });
  document.getElementById('pboss').innerHTML=bh;
  const wc=document.getElementById('pwords'); wc.innerHTML='';
  g.words.forEach(function(w){ const r=document.createElement('div'); r.className='wrow';
    r.innerHTML='<span class="wen">'+w.en+'</span><span class="wpn">'+(w.pn||'')+'</span><span class="wcn">'+w.cn+'</span>'; wc.appendChild(r); });
  wc.scrollTop=0;
  document.getElementById('pfoot').innerHTML='<button class="pbtn enter" onclick="goIsland('+n+')">'+(done?'重进这座岛':'进入学习 · 打 Boss')+'</button>';
  overlay.classList.add('show');
}
function openEmpress(){
  var c=0; G.forEach(function(g){if(clearedN(g.id))c++;});
  if(c<8){
    document.getElementById('ptitle').textContent='★ 星海女帝 · 赛尔娅';
    document.getElementById('psubtitle').textContent='最终 BOSS · 尚未解锁';
    var bh='<div class="bt">🔒 还需通关 '+(8-c)+' 座岛屿</div>';
    document.getElementById('pboss').innerHTML=bh;
    const wc=document.getElementById('pwords'); wc.innerHTML='';
    G.forEach(function(g){ const r=document.createElement('div'); r.className='wrow';
      r.innerHTML='<span class="wen" style="min-width:auto">'+NUM[g.id-1]+' '+g.name+'</span><span class="wcn">'+(clearedN(g.id)?'✓ 已通关':'○ 未通关')+'</span>'; wc.appendChild(r); });
    document.getElementById('pfoot').innerHTML='<button class="pbtn" style="background:#d8c8a8;color:#6a5838" onclick="closeP()">返回地图</button>';
  }else{
    document.getElementById('ptitle').textContent='★ 星海女帝 · 赛尔娅';
    document.getElementById('psubtitle').textContent='最终决战 · 已解锁';
    document.getElementById('pboss').innerHTML='<div class="bt">👑 8 座岛屿全部征服 · 终战开启!</div>';
    document.getElementById('pwords').innerHTML='<div style="padding:24px;text-align:center;color:#6a5838;font-size:14px;line-height:1.9">你已征服全部 240 个单词、39 位 Boss。<br>星海女帝赛尔娅在星海深处等你。<br><br>⚔️ 终战将考验全部 240 词!</div>';
    document.getElementById('pfoot').innerHTML='<button class="pbtn enter" onclick="window.location.href=\\'island_season.html\\'">▶ 前往星海 · 决战女帝</button>';
  }
  overlay.classList.add('show');
}
function closeP(){overlay.classList.remove('show')}
document.getElementById('pclose').onclick=closeP;
overlay.addEventListener('click',function(e){if(e.target===overlay)closeP()});
</script>
</body>
</html>'''

html=html.replace('__DATA__',data_js).replace('__BG__',bg)
open('/home/claude/v846/dev/land_map.html','w',encoding='utf-8').write(html)
print('land_map.html 生成 %.0fKB'%(len(html)/1024))
