import shutil
# ============ A) hansen_cards.js: 路由 + zone选关渲染 + 点击开打 ============
P='hansen_cards.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/cards_bak.js')

# A1) 路由: season1~season5 走 zone 渲染
old_route="    if(getCurrentIslandKey()==='season'){ renderSeasonBossPicker(); return; }"
new_route=("    var __ik=getCurrentIslandKey();\n"
           "    if(__ik==='season'){ renderSeasonBossPicker(); return; }\n"
           "    if(/^season[1-5]$/.test(__ik)){ renderSeasonZoneBossPicker(__ik); return; }  //🔴v871 星域子岛(season1-5)显示自己的BOSSES(非20通用卡)")
assert s.count(old_route)==1, '路由行命中 %d'%s.count(old_route)
s=s.replace(old_route,new_route)

# A2) 新渲染函数(插在 function renderBossPicker 之前)
ANCHOR='  function renderBossPicker(){'
ZONEFN=r'''  /* 🔴v871(Hansen): 星域子岛(island_season1-5)选关网格——渲染【子岛自己的 BOSSES】(全局可读)而非 20 个通用 BOSS_CARDS。
     修复"外壳20通用/里子6新boss"错位。season1=6关按 season1_prog 顺序解锁; season2-5=各自1守护者全解锁。点某关→临时指定打它。 */
  function renderSeasonZoneBossPicker(ik){
    var box=document.getElementById('bossContent'); if(!box) return;
    var zb=(typeof BOSSES!=='undefined' && BOSSES && BOSSES.length)?BOSSES:[];
    var n=zb.length;
    if(!n){ if(typeof renderSeasonBossPicker==='function'){renderSeasonBossPicker();} return; }
    var prog;
    if(ik==='season1'){ prog=0; try{ prog=parseInt(localStorage.getItem('season1_prog')||'0',10)||0; }catch(e){} }
    else { prog=n; }
    var beaten=Math.min(prog,n);
    var curBg=getCurrentBg();
    var html='<div style="padding:10px 6px 40px">';
    html+='<div style="margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,rgba(34,197,94,0.18),rgba(124,58,237,0.18));border:1.5px solid rgba(251,191,36,0.5);border-radius:12px;display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:nowrap">'
        +'<span style="font-size:14px;color:#fff;font-weight:800;white-space:nowrap">已击败 boss '+beaten+'/'+n+'</span>'
        +'<span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap"><span style="font-size:13px;color:#fef3c7;font-weight:800;letter-spacing:.5px">特效</span>'+hansenFxSwitchHTML()+'</span>'
        +'</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">';
    for(var i=0;i<n;i++){
      var bo=zb[i]||{};
      var m=(bo.emoji||'').match(/href="([^"]+)"/); var img=m?m[1]:'';
      var nm=bo.name||('Boss'+(i+1)); var shortNm=(nm.indexOf('\u00b7')>=0)?nm.split('\u00b7').pop():nm;
      var col=bo.color||'#fbbf24';
      var unlocked=(i<=prog);
      if(unlocked){
        var tag=(i<prog)?'\u2713':'\u25b6';
        html+='<div onclick="window.__hsnZoneFight('+i+')" style="position:relative;background:linear-gradient(135deg,'+col+'33,#1e293b);border:2.5px solid '+col+';border-radius:13px;padding:4px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4),0 0 10px '+col+'40;transition:transform 0.2s" ontouchstart="this.style.transform=\'scale(0.95)\'" ontouchend="this.style.transform=\'\'">'
          +'<div style="background:'+curBg.bg+';border-radius:9px;overflow:hidden;position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center">'
          +(img?'<img src="'+img+'" onerror="hansenImgErr(this)" style="width:100%;height:100%;object-fit:contain;display:block">':'')
          +'<span style="position:absolute;top:3px;right:5px;font-size:13px;text-shadow:0 1px 3px #000">'+tag+'</span>'
          +'</div>'
          +'<div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:4px">'
          +'<span style="flex-shrink:0;background:#fef3c7;color:#1e293b;font-size:9px;font-weight:900;padding:2px 5px;border-radius:4px">Lv.'+(i+1)+'</span>'
          +'<span style="font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.6);line-height:1.2">'+shortNm+'</span>'
          +'</div>'
          +'</div>';
      } else {
        html+='<div style="position:relative;background:#1e293b;border:2px dashed #334155;border-radius:13px;padding:4px;opacity:0.45;cursor:default">'
          +'<div style="background:#0f172a;border-radius:9px;overflow:hidden;position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#475569;font-size:38px">\ud83d\udd12</div>'
          +'<div style="text-align:center;font-size:10px;font-weight:700;color:#475569;margin-top:4px;line-height:1.2">Lv.'+(i+1)+' \u672a\u89e3\u9501</div>'
          +'</div>';
      }
    }
    html+='</div></div>';
    box.innerHTML=html;
  }
'''
assert s.count(ANCHOR)==1, 'renderBossPicker锚点命中 %d'%s.count(ANCHOR)
s=s.replace(ANCHOR, ZONEFN+ANCHOR, 1)

# A3) window.__hsnZoneFight(点选关卡→临时指定打第i个)
HOOK='  window.hansenRenderBossPicker = renderBossPicker;'
NEWHOOK=HOOK+'\n  window.__hsnZoneFight = function(i){ try{ window._s1FightIdx=i; if(typeof window.startBoss==="function") window.startBoss(); }catch(e){} };  //🔴v871 星域子岛点选关卡开打'
assert s.count(HOOK)==1
s=s.replace(HOOK,NEWHOOK)
open(P,'w',encoding='utf-8').write(s)
print('A) hansen_cards.js 已注入: 路由+renderSeasonZoneBossPicker+__hsnZoneFight')

# ============ B) template.html: startBoss 支持 _s1FightIdx 临时指定 ============
P2='template.html'
t=open(P2,encoding='utf-8').read()
shutil.copy(P2,'/tmp/template_bak2.html')
old_sb=("  var __isS1=/island_season1\\.html/.test(location.pathname||''); var __s1p=0; if(__isS1){try{__s1p=parseInt(localStorage.getItem('season1_prog')||'0',10)||0;}catch(e){}}\n"
        "  const lvl=__isS1?Math.min(Math.max(0,__s1p),BOSSES.length-1):Math.min(Math.max(0,S.level-1),BOSSES.length-1);\n"
        "  if(__isS1)window._s1Idx=lvl;\n"
        "  bossCurrent=BOSSES[lvl];")
new_sb=("  var __isS1=/island_season1\\.html/.test(location.pathname||''); var __s1p=0; if(__isS1){try{__s1p=parseInt(localStorage.getItem('season1_prog')||'0',10)||0;}catch(e){}}\n"
        "  var __front=__isS1?Math.min(Math.max(0,__s1p),BOSSES.length-1):Math.min(Math.max(0,S.level-1),BOSSES.length-1);\n"
        "  /* 🔴v871 星域选关卡: 点选关卡设 _s1FightIdx 临时指定打第几个(否则默认打前沿). 重打已通关卡不推进进度(bossVictory只在_s1Idx===当前prog时推进). */\n"
        "  const lvl=(__isS1&&window._s1FightIdx!=null)?Math.min(Math.max(0,window._s1FightIdx),BOSSES.length-1):__front;\n"
        "  window._s1FightIdx=null;\n"
        "  if(__isS1)window._s1Idx=lvl;\n"
        "  bossCurrent=BOSSES[lvl];")
assert t.count(old_sb)==1, 'template startBoss命中 %d'%t.count(old_sb)
t=t.replace(old_sb,new_sb)
open(P2,'w',encoding='utf-8').write(t)
print('B) template.html startBoss 已支持 _s1FightIdx')
print('下一步: generate.py 重新盖章')
